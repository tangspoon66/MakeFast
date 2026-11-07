/**
 * Blockly XML 构建器
 * 将解析后的积木 AST 转换为 Blockly 可加载的 XML 字符串
 */

// ========== AST 类型 ==========

/** 积木 AST 节点 */
export interface BlockNode {
  blockType: string;
  fields: Record<string, string>;
  /** statement input name → 子语句块列表 */
  statements: Record<string, BlockNode[]>;
  /** value input name → 子表达式块 */
  values: Record<string, BlockNode>;
  /** 下一个兄弟块（通过 prev/next 连接） */
  next?: BlockNode;
}

/** 顶层函数 */
export interface TopLevelFunction {
  type: 'setup' | 'loop' | 'function_void';
  name?: string;
  body: BlockNode[];
}

/** 全局作用域块（独立堆叠） */
export interface GlobalBlock {
  blockType: string;
  fields: Record<string, string>;
  statements: Record<string, BlockNode[]>;
  values: Record<string, BlockNode>;
}

// ========== XML 构建 ==========

/** XML 转义 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 构建语句块链的 XML（多个同级块通过 <next> 连接） */
function buildStatementChainXml(blocks: BlockNode[], indent: string): string {
  if (blocks.length === 0) return '';
  // 用 next 指针链接所有块
  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].next = blocks[i + 1];
  }
  // 只渲染第一个块，next 递归展开整条链
  return buildBlockXml(blocks[0], indent);
}

/** 构建单个积木块的 XML（传入 nextBlock 参数时优先使用，否则用 block.next） */
function buildBlockXml(
  block: BlockNode,
  indent: string,
  nextBlock?: BlockNode
): string {
  let xml = `${indent}<block type="${escapeXml(block.blockType)}">\n`;

  // 字段
  for (const [name, value] of Object.entries(block.fields)) {
    xml += `${indent}  <field name="${escapeXml(name)}">${escapeXml(value)}</field>\n`;
  }

  // value inputs（嵌入单个表达式块）
  for (const [name, childBlock] of Object.entries(block.values)) {
    xml += `${indent}  <value name="${escapeXml(name)}">\n`;
    xml += buildBlockXml(childBlock, indent + '    ');
    xml += `${indent}  </value>\n`;
  }

  // statement inputs（嵌入语句块链）
  for (const [name, childBlocks] of Object.entries(block.statements)) {
    if (childBlocks.length === 0) continue;
    xml += `${indent}  <statement name="${escapeXml(name)}">\n`;
    xml += buildStatementChainXml(childBlocks, indent + '    ');
    xml += `${indent}  </statement>\n`;
  }

  // 下一个兄弟块：参数优先，否则用 block.next（由 buildStatementChainXml 设置）
  const next = nextBlock || block.next;
  if (next) {
    xml += `${indent}  <next>\n`;
    xml += buildBlockXml(next, indent + '    ');
    xml += `${indent}  </next>\n`;
  }

  xml += `${indent}</block>\n`;
  return xml;
}

/** 构建全局独立块的 XML（无 prev/next 的独立堆叠） */
function buildGlobalBlockXml(block: GlobalBlock, x: number, y: number, indent: string): string {
  let xml = `${indent}<block type="${escapeXml(block.blockType)}" x="${x}" y="${y}">\n`;

  for (const [name, value] of Object.entries(block.fields)) {
    xml += `${indent}  <field name="${escapeXml(name)}">${escapeXml(value)}</field>\n`;
  }

  for (const [name, childBlock] of Object.entries(block.values)) {
    xml += `${indent}  <value name="${escapeXml(name)}">\n`;
    xml += buildBlockXml(childBlock, indent + '    ');
    xml += `${indent}  </value>\n`;
  }

  for (const [name, childBlocks] of Object.entries(block.statements)) {
    if (childBlocks.length === 0) continue;
    xml += `${indent}  <statement name="${escapeXml(name)}">\n`;
    xml += buildStatementChainXml(childBlocks, indent + '    ');
    xml += `${indent}  </statement>\n`;
  }

  xml += `${indent}</block>\n`;
  return xml;
}

/** 构建完整的 Blockly XML */
export function buildBlocklyXml(
  functions: TopLevelFunction[],
  globalBlocks: GlobalBlock[] = []
): string {
  let xml = '<xml xmlns="https://developers.google.com/blockly/xml">\n';

  let yOffset = 20;

  // 全局独立块（放在最上面）
  for (const gb of globalBlocks) {
    xml += buildGlobalBlockXml(gb, 20, yOffset, '');
    yOffset += 100;
  }

  // setup 块
  for (const func of functions) {
    if (func.type === 'setup') {
      xml += `<block type="arduino_setup" x="20" y="${yOffset}">\n`;
      if (func.body.length > 0) {
        xml += '  <statement name="SETUP">\n';
        xml += buildStatementChainXml(func.body, '    ');
        xml += '  </statement>\n';
      }
      xml += '</block>\n';
      yOffset += 100;
    }
  }

  // loop 块
  for (const func of functions) {
    if (func.type === 'loop') {
      xml += `<block type="arduino_loop" x="20" y="${yOffset}">\n`;
      if (func.body.length > 0) {
        xml += '  <statement name="LOOP">\n';
        xml += buildStatementChainXml(func.body, '    ');
        xml += '  </statement>\n';
      }
      xml += '</block>\n';
      yOffset += 100;
    }
  }

  // 自定义函数
  for (const func of functions) {
    if (func.type === 'function_void') {
      xml += `<block type="arduino_function_void" x="400" y="${yOffset}">\n`;
      xml += `  <field name="NAME">${escapeXml(func.name || 'myFunction')}</field>\n`;
      if (func.body.length > 0) {
        xml += '  <statement name="BODY">\n';
        xml += buildStatementChainXml(func.body, '    ');
        xml += '  </statement>\n';
      }
      xml += '</block>\n';
      yOffset += 100;
    }
  }

  xml += '</xml>';
  return xml;
}

// ========== 辅助：将语句块数组转为 BlockNode 链 ==========

/** 将积木块数组用 next 连接为链表 */
export function chainBlocks(blocks: BlockNode[]): BlockNode | null {
  if (blocks.length === 0) return null;
  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].next = blocks[i + 1];
  }
  return blocks[0];
}

/** 创建简单的字段块节点 */
export function createBlockNode(
  blockType: string,
  fields: Record<string, string> = {},
  values: Record<string, BlockNode> = {},
  statements: Record<string, BlockNode[]> = {}
): BlockNode {
  return { blockType, fields, values, statements };
}
