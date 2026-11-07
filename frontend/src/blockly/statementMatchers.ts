/**
 * 语句匹配器
 * 将 Arduino C++ 代码行解析为积木 AST 节点
 * 处理：单行语句正则匹配、控制流花括号匹配、多行语句、变量声明
 */

import type { BlockNode } from './xmlBuilder';
import { createBlockNode } from './xmlBuilder';
import { STATEMENT_PATTERNS } from './blockTypeRegistry';
import { parseExpression } from './expressionParser';

/** #define 宏映射（由 parseCodeToXml 设置） */
let macroMap: Record<string, string> = {};

/** 设置宏映射表（解析前调用） */
export function setMacroMap(map: Record<string, string>) {
  macroMap = map;
}

// ========== 语句解析结果 ==========

export interface StatementResult {
  block: BlockNode;
  endPos: number;
  /** 消耗的代码行（包括多行语句） */
  consumedLines: number;
}

export interface ControlFlowResult {
  block: BlockNode;
  endPos: number;
}

// ========== 主解析函数 ==========

/**
 * 解析从 pos 开始的代码为积木 AST 节点
 * @param code 完整的代码字符串
 * @param pos 起始位置
 * @returns 解析结果，null 表示无法识别
 */
export function parseStatement(code: string, pos: number): StatementResult | null {

  // 0. 检查元数据注释 /*@block:TYPE|...*/
  const metaResult = tryMatchMetadata(code, pos);
  if (metaResult) return metaResult;

  // 1. 尝试匹配控制流（if, if-else, for, while, repeat）
  const cfResult = tryMatchControlFlow(code, pos);
  if (cfResult) {
    // 计算消耗行数
    const consumed = code.slice(pos, cfResult.endPos);
    const consumedLines = (consumed.match(/\n/g) || []).length;
    return { block: cfResult.block, endPos: cfResult.endPos, consumedLines };
  }

  // 2. 尝试匹配多行语句
  const mlResult = tryMatchMultiLine(code, pos);
  if (mlResult) return mlResult;

  // 3. 提取当前行（到分号或换行）
  const lineEnd = findLineEnd(code, pos);
  let line = code.slice(pos, lineEnd).trim();
  if (!line) return null;

  // 去除行尾注释（// 及之后的内容），避免破坏正则的 $ 匹配
  line = stripTrailingComment(line);
  if (!line) return null;

  // 4. 尝试正则匹配
  const reResult = tryMatchRegex(line);
  if (reResult) {
    // 检查是否有 value input 需要解析
    const block = reResult;
    // 对于有 value input 的积木，需要从 line 中提取表达式进行子解析
    if (STATEMENT_PATTERNS.find(p => p.blockType === block.blockType)?.valueInputs) {
      const pattern = STATEMENT_PATTERNS.find(p => p.blockType === block.blockType)!;
      if (pattern.valueInputs) {
        enrichValueInputs(block, line, pattern);
      }
    }
    return { block, endPos: lineEnd + 1, consumedLines: 1 };
  }

  return null;
}

/**
 * 解析代码块内的所有语句（到下一个 '}' 或代码末尾）
 */
export function parseStatements(
  code: string,
  pos: number,
  endChar: string = '}',
  _context: 'setup' | 'loop' | 'function' | 'global' = 'setup'
): { blocks: BlockNode[]; endPos: number; warnings: string[] } {
  const blocks: BlockNode[] = [];
  const warnings: string[] = [];

  while (pos < code.length) {
    // 跳过空白和注释
    const skipped = skipSpacesAndComments(code, pos);
    if (skipped >= code.length) break;

    // 遇到结束字符则停止
    if (code[skipped] === endChar || code[skipped] === '}') {
      pos = skipped;
      break;
    }

    // 尝试解析一条语句
    const result = parseStatement(code, skipped);
    if (result) {
      blocks.push(result.block);
      pos = result.endPos;
    } else {
      // 无法解析，记录警告并跳到下一行
      const lineEnd = findLineEnd(code, skipped);
      const line = code.slice(skipped, lineEnd).trim();
      if (line && !line.startsWith('//') && !line.startsWith('/*')) {
        warnings.push(`无法识别的语句 (行 ${getLineNumber(code, skipped)}): ${line.slice(0, 50)}`);
      }
      pos = lineEnd + 1;
    }
  }

  return { blocks, endPos: pos, warnings };
}

// ========== 元数据注释匹配 ==========

function tryMatchMetadata(code: string, pos: number): StatementResult | null {
  const remaining = code.slice(pos);
  const m = remaining.match(/^(\s*)(.+?)\s*\/\*@block:(\w+)\|(.*?)\*\/\s*;\s*/);
  if (!m) return null;

  const blockType = m[3];
  const fields: Record<string, string> = {};
  const fieldPairs = m[4].split('|');
  for (const pair of fieldPairs) {
    const [key, ...valParts] = pair.split(':');
    if (key) fields[key] = valParts.join(':');
  }

  const fullMatch = m[0];
  const endPos = pos + fullMatch.length;
  const consumedLines = (fullMatch.match(/\n/g) || []).length;

  return {
    block: createBlockNode(blockType, fields),
    endPos,
    consumedLines,
  };
}

// ========== 控制流匹配 ==========

function tryMatchControlFlow(code: string, pos: number): ControlFlowResult | null {
  const skipped = skipSpacesAndComments(code, pos);
  const remaining = code.slice(skipped);

  // 尝试匹配各种控制流头
  const ifMatch = remaining.match(/^if\s*\(/);
  const forMatch = remaining.match(/^for\s*\(/);
  const whileMatch = remaining.match(/^while\s*\(/);

  if (ifMatch) {
    return parseIfBlock(code, skipped);
  }
  if (forMatch) {
    return parseForBlock(code, skipped);
  }
  if (whileMatch) {
    return parseWhileBlock(code, skipped);
  }

  return null;
}

/** 解析 if / if-else 块 */
function parseIfBlock(code: string, pos: number): ControlFlowResult | null {
  // 提取 condition: if (condition) {
  const parenStart = code.indexOf('(', pos);
  if (parenStart < 0) return null;
  const parenEnd = findMatchingParen(code, parenStart);
  if (parenEnd < 0) return null;

  const condExpr = code.slice(parenStart + 1, parenEnd).trim();
  const condResult = parseExpression(condExpr, 0);

  // 找到 { 位置
  const bracePos = skipSpacesAndComments(code, parenEnd + 1);
  if (bracePos >= code.length || code[bracePos] !== '{') return null;

  // 找到匹配的 }
  const closeBrace = findMatchingBrace(code, bracePos);
  if (closeBrace < 0) return null;

  // 解析 DO 体
  const bodyResult = parseStatements(code, bracePos + 1, '}');
  const block = createBlockNode(
    'arduino_if',
    {},
    { CONDITION: condResult.node },
    { DO: bodyResult.blocks }
  );

  // 检查是否有 else
  let endPos = closeBrace + 1;
  const afterElse = skipSpacesAndComments(code, closeBrace + 1);
  if (code.slice(afterElse, afterElse + 4) === 'else') {
    const elseBraceStart = skipSpacesAndComments(code, afterElse + 4);
    if (elseBraceStart < code.length && code[elseBraceStart] === '{') {
      const elseClose = findMatchingBrace(code, elseBraceStart);
      if (elseClose >= 0) {
        const elseBody = parseStatements(code, elseBraceStart + 1, '}');
        const ifElseBlock = createBlockNode(
          'arduino_if_else',
          {},
          { CONDITION: condResult.node },
          { DO: bodyResult.blocks, ELSE: elseBody.blocks }
        );
        endPos = elseClose + 1;
        return { block: ifElseBlock, endPos };
      }
    }
  }

  return { block, endPos };
}

/** 解析 for 循环块 */
function parseForBlock(code: string, pos: number): ControlFlowResult | null {
  const parenStart = code.indexOf('(', pos);
  if (parenStart < 0) return null;
  const parenEnd = findMatchingParen(code, parenStart);
  if (parenEnd < 0) return null;

  const forHeader = code.slice(parenStart + 1, parenEnd).trim();

  // 检查是否为 arduino_repeat 模式: for (int i = 0; i < N; i++)
  const repeatMatch = forHeader.match(
    /^int\s+(i)\s*=\s*(\d+)\s*;\s*\1\s*<\s*(.+)\s*;\s*\1\s*\+\+\s*$/
  );
  if (repeatMatch) {
    const timesExpr = repeatMatch[2];
    const timesNode = parseExpression(timesExpr, 0);

    // 找到 { } body
    const bracePos = skipSpacesAndComments(code, parenEnd + 1);
    if (bracePos >= code.length || code[bracePos] !== '{') return null;
    const closeBrace = findMatchingBrace(code, bracePos);
    if (closeBrace < 0) return null;

    const bodyResult = parseStatements(code, bracePos + 1, '}');
    return {
      block: createBlockNode(
        'arduino_repeat',
        {},
        { TIMES: timesNode.node },
        { DO: bodyResult.blocks }
      ),
      endPos: closeBrace + 1,
    };
  }

  // 标准 for 循环: for (int VAR = FROM; VAR < TO; VAR += STEP)
  const forMatch = forHeader.match(
    /^int\s+(\w+)\s*=\s*(.+)\s*;\s*\1\s*<\s*(.+)\s*;\s*\1\s*\+=\s*(.+)\s*$/
  );
  if (!forMatch) return null;

  const varName = forMatch[1];
  const fromResult = parseExpression(forMatch[2], 0);
  const toResult = parseExpression(forMatch[3], 0);
  const stepResult = parseExpression(forMatch[4], 0);

  const bracePos = skipSpacesAndComments(code, parenEnd + 1);
  if (bracePos >= code.length || code[bracePos] !== '{') return null;
  const closeBrace = findMatchingBrace(code, bracePos);
  if (closeBrace < 0) return null;

  const bodyResult = parseStatements(code, bracePos + 1, '}');
  return {
    block: createBlockNode(
      'arduino_for',
      { VAR: varName },
      { FROM: fromResult.node, TO: toResult.node, STEP: stepResult.node },
      { DO: bodyResult.blocks }
    ),
    endPos: closeBrace + 1,
  };
}

/** 解析 while 循环块 */
function parseWhileBlock(code: string, pos: number): ControlFlowResult | null {
  const parenStart = code.indexOf('(', pos);
  if (parenStart < 0) return null;
  const parenEnd = findMatchingParen(code, parenStart);
  if (parenEnd < 0) return null;

  const condExpr = code.slice(parenStart + 1, parenEnd).trim();
  const condResult = parseExpression(condExpr, 0);

  const bracePos = skipSpacesAndComments(code, parenEnd + 1);
  if (bracePos >= code.length || code[bracePos] !== '{') return null;
  const closeBrace = findMatchingBrace(code, bracePos);
  if (closeBrace < 0) return null;

  const bodyResult = parseStatements(code, bracePos + 1, '}');
  return {
    block: createBlockNode(
      'arduino_while',
      {},
      { CONDITION: condResult.node },
      { DO: bodyResult.blocks }
    ),
    endPos: closeBrace + 1,
  };
}

// ========== 多行语句匹配 ==========

function tryMatchMultiLine(code: string, pos: number): StatementResult | null {
  const remaining = code.slice(pos);

  // OLED print: display.setCursor(X, Y); display.print(TEXT);
  const oledMatch = remaining.match(
    /^\s*display\s*\.\s*setCursor\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*\n\s*display\s*\.\s*print\s*\((.+)\)\s*;/
  );
  if (oledMatch) {
    const fullMatch = oledMatch[0];
    const x = oledMatch[1];
    const y = oledMatch[2];
    const textExpr = oledMatch[3].trim();
    const textResult = parseExpression(textExpr, 0);
    const consumedLines = (fullMatch.match(/\n/g) || []).length;
    return {
      block: createBlockNode('arduino_oled_print', { X: x, Y: y }, { TEXT: textResult.node }),
      endPos: pos + fullMatch.length,
      consumedLines,
    };
  }

  // NeoPixel begin: strip.begin(); strip.show();
  const neoMatch = remaining.match(
    /^\s*strip\s*\.\s*begin\s*\(\s*\)\s*;\s*\n\s*strip\s*\.\s*show\s*\(\s*\)\s*;/
  );
  if (neoMatch) {
    const fullMatch = neoMatch[0];
    const consumedLines = 2;
    return {
      block: createBlockNode('arduino_neopixel_begin'),
      endPos: pos + fullMatch.length,
      consumedLines,
    };
  }

  // Motor forward: digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); analogWrite(ENA, SPEED);
  const motorFwdMatch = remaining.match(
    /^\s*digitalWrite\s*\(\s*(\d+)\s*,\s*HIGH\s*\)\s*;\s*\n\s*digitalWrite\s*\(\s*(\d+)\s*,\s*LOW\s*\)\s*;\s*\n\s*analogWrite\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;/
  );
  if (motorFwdMatch) {
    const fullMatch = motorFwdMatch[0];
    const consumedLines = 3;
    return {
      block: createBlockNode('arduino_motor_forward', {
        IN1: motorFwdMatch[1],
        IN2: motorFwdMatch[2],
        ENA: motorFwdMatch[3],
        SPEED: motorFwdMatch[4],
      }),
      endPos: pos + fullMatch.length,
      consumedLines,
    };
  }

  // Motor backward: digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH); analogWrite(ENA, SPEED);
  const motorBwdMatch = remaining.match(
    /^\s*digitalWrite\s*\(\s*(\d+)\s*,\s*LOW\s*\)\s*;\s*\n\s*digitalWrite\s*\(\s*(\d+)\s*,\s*HIGH\s*\)\s*;\s*\n\s*analogWrite\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;/
  );
  if (motorBwdMatch) {
    const fullMatch = motorBwdMatch[0];
    const consumedLines = 3;
    return {
      block: createBlockNode('arduino_motor_backward', {
        IN1: motorBwdMatch[1],
        IN2: motorBwdMatch[2],
        ENA: motorBwdMatch[3],
        SPEED: motorBwdMatch[4],
      }),
      endPos: pos + fullMatch.length,
      consumedLines,
    };
  }

  // Motor stop: digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  const motorStopMatch = remaining.match(
    /^\s*digitalWrite\s*\(\s*(\d+)\s*,\s*LOW\s*\)\s*;\s*\n\s*digitalWrite\s*\(\s*(\d+)\s*,\s*LOW\s*\)\s*;/
  );
  if (motorStopMatch) {
    const fullMatch = motorStopMatch[0];
    const consumedLines = 2;
    return {
      block: createBlockNode('arduino_motor_stop', {
        IN1: motorStopMatch[1],
        IN2: motorStopMatch[2],
      }),
      endPos: pos + fullMatch.length,
      consumedLines,
    };
  }

  return null;
}

// ========== 正则匹配 ==========

/** Blockly FieldNumber 字段名集合 — 这些字段只接受数字 */
const NUMERIC_FIELDS = new Set([
  'PIN', 'INDEX', 'TIME', 'VALUE', 'FREQ', 'CHANNEL', 'DURATION',
  'RESOLUTION', 'US', 'STEPS', 'RPM', 'ANGLE', 'SIZE', 'SPEED',
  'DUTY', 'COUNT', 'ADDR', 'CODE', 'FROM', 'TO', 'STEP', 'MIN', 'MAX',
  'FROMLOW', 'FROMHIGH', 'TOLOW', 'TOHIGH',
]);

function tryMatchRegex(line: string): BlockNode | null {
  for (const pattern of STATEMENT_PATTERNS) {
    const m = line.match(pattern.pattern);
    if (m) {
      const fields = pattern.extractFields(m);
      // 校验数值字段：非数字值先尝试通过 #define 宏解析，失败则删除字段用默认值
      for (const key of Object.keys(fields)) {
        if (NUMERIC_FIELDS.has(key) && !/^-?\d+(\.\d+)?$/.test(fields[key])) {
          const resolved = macroMap[fields[key]];
          if (resolved !== undefined) {
            fields[key] = resolved;
          } else {
            delete fields[key];
          }
        }
      }
      return createBlockNode(pattern.blockType, fields);
    }
  }
  return null;
}

/** 从语句行中提取 value input 的表达式并解析 */
function enrichValueInputs(
  block: BlockNode,
  line: string,
  pattern: import('./blockTypeRegistry').StatementPattern
): void {
  if (!pattern.valueInputs) return;

  for (const inputName of pattern.valueInputs) {
    // 从 line 中提取参数表达式
    let exprStr: string | null = null;

    if (inputName === 'TEXT') {
      // Serial.print(TEXT) or Serial.println(TEXT)
      const m = line.match(/Serial\s*\.\s*print(?:ln)?\s*\(\s*(.+)\s*\)\s*;/);
      if (m) exprStr = m[1];
    } else if (inputName === 'VALUE') {
      if (block.blockType === 'arduino_declare_int') {
        const m = line.match(/int\s+\w+\s*=\s*(.+)\s*;/);
        if (m) exprStr = m[1];
      } else if (block.blockType === 'arduino_declare_float') {
        const m = line.match(/float\s+\w+\s*=\s*(.+)\s*;/);
        if (m) exprStr = m[1];
      } else if (block.blockType === 'arduino_declare_string') {
        const m = line.match(/String\s+\w+\s*=\s*(.+)\s*;/);
        if (m) exprStr = m[1];
      } else if (block.blockType === 'arduino_set_variable') {
        const m = line.match(/^\s*\w+\s*=\s*(.+)\s*;/);
        if (m) exprStr = m[1];
      } else if (block.blockType === 'arduino_array_set') {
        const m = line.match(/^\s*\w+\s*\[\s*\d+\s*\]\s*=\s*(.+)\s*;/);
        if (m) exprStr = m[1];
      }
    } else if (inputName === 'DATA') {
      const m = line.match(/Wire\s*\.\s*write\s*\(\s*(.+)\s*\)\s*;/);
      if (m) exprStr = m[1];
    }

    if (exprStr) {
      try {
        const result = parseExpression(exprStr.trim(), 0);
        block.values[inputName] = result.node;
      } catch {
        // 表达式解析失败，用文本占位
        block.values[inputName] = createBlockNode('arduino_text', { TEXT: exprStr });
      }
    }
  }
}

// ========== 辅助函数 ==========

/** 跳过多余空白和注释 */
function skipSpacesAndComments(code: string, pos: number): number {
  while (pos < code.length) {
    if (code[pos] === ' ' || code[pos] === '\t' || code[pos] === '\n' || code[pos] === '\r') {
      pos++;
    } else if (code.slice(pos, pos + 2) === '//') {
      // 跳过行注释
      const newline = code.indexOf('\n', pos);
      pos = newline >= 0 ? newline + 1 : code.length;
    } else if (code.slice(pos, pos + 2) === '/*' && code.slice(pos, pos + 3) !== '/**') {
      // 跳过块注释（但保留元数据注释 /*@...）
      if (code.slice(pos, pos + 4) === '/*@b' || code.slice(pos, pos + 4) === '/*@e') {
        break; // 元数据注释，不跳过
      }
      const end = code.indexOf('*/', pos + 2);
      pos = end >= 0 ? end + 2 : code.length;
    } else {
      break;
    }
  }
  return pos;
}

/** 找到当前行末尾 */
function findLineEnd(code: string, pos: number): number {
  const newline = code.indexOf('\n', pos);
  if (newline >= 0) return newline;
  return code.length;
}

/** 去除行尾注释（// 及之后的内容），保留字符串内的 // */
function stripTrailingComment(line: string): string {
  // 在字符串外查找 //
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === stringChar) { inString = false; }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

/** 找到匹配的括号 */
function findMatchingParen(code: string, openPos: number): number {
  if (code[openPos] !== '(') return -1;
  let depth = 0;
  for (let i = openPos; i < code.length; i++) {
    if (code[i] === '"' || code[i] === "'") {
      // 跳过字符串
      const quote = code[i];
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (code[i] === '(') depth++;
    if (code[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 找到匹配的花括号 */
function findMatchingBrace(code: string, openPos: number): number {
  if (code[openPos] !== '{') return -1;
  let depth = 0;
  for (let i = openPos; i < code.length; i++) {
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (code[i] === '{') depth++;
    if (code[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 获取行号（用于警告信息） */
function getLineNumber(code: string, pos: number): number {
  const before = code.slice(0, pos);
  return (before.match(/\n/g) || []).length + 1;
}
