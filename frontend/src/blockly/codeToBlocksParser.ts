/**
 * 代码→积木 转换器（顶层入口）
 * 将 Arduino C++ 代码字符串解析为 Blockly XML
 */

import type { TopLevelFunction, GlobalBlock } from './xmlBuilder';
import { buildBlocklyXml, createBlockNode } from './xmlBuilder';
import { parseStatements, setMacroMap } from './statementMatchers';
import { parseExpression } from './expressionParser';

// ========== 宏定义解析 ==========

/**
 * 扫描代码中的 #define 指令，构建宏名到值的映射
 * 例如 `#define LED_BUILTIN 2` → `{ LED_BUILTIN: '2' }`
 */
function extractDefines(code: string): Record<string, string> {
  const macros: Record<string, string> = {};
  const re = /^\s*#define\s+([A-Za-z_]\w*)\s+(.+?)(?:\s*\/\/.*)?$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const name = m[1];
    const value = m[2].trim();
    // 只保留简单的数字/字符串宏（不处理带运算符的宏表达式）
    if (/^-?\d+$/.test(value) || /^0x[0-9a-fA-F]+$/.test(value)) {
      macros[name] = value;
    }
  }
  return macros;
}

// ========== 解析结果 ==========

export interface CodeParseResult {
  /** 是否完全成功（无警告） */
  success: boolean;
  /** Blockly XML 字符串，失败时为 null */
  xml: string | null;
  /** 警告信息列表 */
  warnings: string[];
  /** 无法识别的行号列表 */
  unrecognizedLines: number[];
}

// ========== 顶层函数提取 ==========

interface ExtractedFunction {
  type: 'setup' | 'loop' | 'function_void';
  name?: string;
  bodyStart: number;    // '{' 之后的第一个字符位置
  bodyEnd: number;      // '}' 的位置
}

interface FunctionExtractionResult {
  functions: ExtractedFunction[];
  globalRanges: Array<{ start: number; end: number }>;
}

/**
 * 扫描代码，识别顶层函数和全局作用域
 */
function extractTopLevelFunctions(code: string): FunctionExtractionResult {
  const functions: ExtractedFunction[] = [];
  const globalRanges: Array<{ start: number; end: number }> = [];

  let pos = 0;
  let lastGlobalEnd = 0;

  while (pos < code.length) {
    // 跳过空白
    while (pos < code.length && (code[pos] === ' ' || code[pos] === '\t' || code[pos] === '\n' || code[pos] === '\r')) {
      pos++;
    }

    if (pos >= code.length) break;

    const remaining = code.slice(pos);

    // 匹配 void setup() {
    const setupMatch = remaining.match(/^void\s+setup\s*\(\s*\)\s*\{?/);
    if (setupMatch) {
      // 记录 setup 之前的全局代码
      if (pos > lastGlobalEnd) {
        const globalText = code.slice(lastGlobalEnd, pos).trim();
        if (globalText && globalText.length > 1) {
          globalRanges.push({ start: lastGlobalEnd, end: pos });
        }
      }

      const openBrace = findOpenBraceAfterMatch(code, pos, setupMatch[0]);
      if (openBrace >= 0) {
        const closeBrace = findMatchingBraceGlobal(code, openBrace);
        if (closeBrace >= 0) {
          functions.push({
            type: 'setup',
            bodyStart: openBrace + 1,
            bodyEnd: closeBrace,
          });
          pos = closeBrace + 1;
          lastGlobalEnd = pos;
          continue;
        }
      }
    }

    // 匹配 void loop() {
    const loopMatch = remaining.match(/^void\s+loop\s*\(\s*\)\s*\{?/);
    if (loopMatch) {
      if (pos > lastGlobalEnd) {
        const globalText = code.slice(lastGlobalEnd, pos).trim();
        if (globalText && globalText.length > 1) {
          globalRanges.push({ start: lastGlobalEnd, end: pos });
        }
      }

      const openBrace = findOpenBraceAfterMatch(code, pos, loopMatch[0]);
      if (openBrace >= 0) {
        const closeBrace = findMatchingBraceGlobal(code, openBrace);
        if (closeBrace >= 0) {
          functions.push({
            type: 'loop',
            bodyStart: openBrace + 1,
            bodyEnd: closeBrace,
          });
          pos = closeBrace + 1;
          lastGlobalEnd = pos;
          continue;
        }
      }
    }

    // 匹配 void myFunc() {
    const funcMatch = remaining.match(/^void\s+(\w+)\s*\(\s*\)\s*\{?/);
    if (funcMatch) {
      if (pos > lastGlobalEnd) {
        const globalText = code.slice(lastGlobalEnd, pos).trim();
        if (globalText && globalText.length > 1) {
          globalRanges.push({ start: lastGlobalEnd, end: pos });
        }
      }

      const funcName = funcMatch[1];
      if (funcName !== 'setup' && funcName !== 'loop') {
        const openBrace = findOpenBraceAfterMatch(code, pos, funcMatch[0]);
        if (openBrace >= 0) {
          const closeBrace = findMatchingBraceGlobal(code, openBrace);
          if (closeBrace >= 0) {
            functions.push({
              type: 'function_void',
              name: funcName,
              bodyStart: openBrace + 1,
              bodyEnd: closeBrace,
            });
            pos = closeBrace + 1;
            lastGlobalEnd = pos;
            continue;
          }
        }
      }
    }

    // 未匹配到函数声明，跳到下一行
    const newline = code.indexOf('\n', pos);
    pos = newline >= 0 ? newline + 1 : code.length;
  }

  // 最后一个函数之后的全局代码
  if (pos > lastGlobalEnd) {
    const globalText = code.slice(lastGlobalEnd).trim();
    if (globalText && globalText.length > 1) {
      globalRanges.push({ start: lastGlobalEnd, end: code.length });
    }
  }

  return { functions, globalRanges };
}

/**
 * 从正则匹配文本中定位 { 的位置
 * 如果匹配文本已包含 {，直接返回其位置；否则向后查找
 */
function findOpenBraceAfterMatch(code: string, matchStart: number, matchedText: string): number {
  if (matchedText.endsWith('{')) {
    return matchStart + matchedText.length - 1;
  }
  return findTrailingOpenBrace(code, matchStart + matchedText.length);
}

/** 向后查找紧跟的 {（跳过空白和注释） */
function findTrailingOpenBrace(code: string, pos: number): number {
  while (pos < code.length) {
    const ch = code[pos];
    if (ch === '{') return pos;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { pos++; continue; }
    if (code.slice(pos, pos + 2) === '//') {
      const newline = code.indexOf('\n', pos);
      pos = newline >= 0 ? newline + 1 : code.length;
      continue;
    }
    if (code.slice(pos, pos + 2) === '/*' && code.slice(pos, pos + 4) !== '/*@') {
      const end = code.indexOf('*/', pos + 2);
      pos = end >= 0 ? end + 2 : code.length;
      continue;
    }
    break; // 遇到非空白非注释非花括号字符
  }
  return -1;
}

/** 全局花括号匹配 */
function findMatchingBraceGlobal(code: string, openPos: number): number {
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

// ========== 全局作用域代码解析 ==========

function parseGlobalCode(code: string, ranges: Array<{ start: number; end: number }>): {
  blocks: GlobalBlock[];
  warnings: string[];
} {
  const blocks: GlobalBlock[] = [];
  const allWarnings: string[] = [];

  for (const range of ranges) {
    const text = code.slice(range.start, range.end).trim();
    if (!text || text.length <= 2) continue;

    // 按行解析全局代码
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

      // 尝试匹配全局声明
      // Stepper myStepper(...);
      const stepperMatch = trimmed.match(
        /^\s*Stepper\s+myStepper\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/
      );
      if (stepperMatch) {
        blocks.push({
          blockType: 'arduino_stepper_setup',
          fields: {
            STEPS: stepperMatch[1],
            PIN1: stepperMatch[2],
            PIN2: stepperMatch[3],
            PIN3: stepperMatch[4],
            PIN4: stepperMatch[5],
          },
          values: {},
          statements: {},
        });
        continue;
      }

      // 变量声明 int/float/String/bool name = value;
      const declMatch = trimmed.match(
        /^\s*(int|float|String|bool)\s+(\w+)\s*=\s*(.+)\s*;\s*$/
      );
      if (declMatch) {
        const varType = declMatch[1];
        const varName = declMatch[2];
        const varValue = declMatch[3].trim();

        // bool 声明：只接受 true/false（dropdown 字段）
        if (varType === 'bool') {
          if (varValue === 'true' || varValue === 'false') {
            blocks.push({
              blockType: 'arduino_declare_bool',
              fields: { NAME: varName, VALUE: varValue },
              values: {},
              statements: {},
            });
          } else {
            // bool 不能用表达式初始化，降级为警告
            allWarnings.push(
              `bool 变量 "${varName}" 的值 "${varValue}" 不是 true/false，无法用积木表示`
            );
          }
          continue;
        }

        // int/float/String：VALUE 是 value input（表达式块），不是 field
        const typeMap: Record<string, string> = {
          'int': 'arduino_declare_int',
          'float': 'arduino_declare_float',
          'String': 'arduino_declare_string',
        };
        const blockType = typeMap[varType];
        if (!blockType) continue;

        try {
          const exprResult = parseExpression(varValue, 0);
          blocks.push({
            blockType,
            fields: { NAME: varName },
            values: { VALUE: exprResult.node },
            statements: {},
          });
        } catch {
          // 表达式解析失败，用文本占位
          blocks.push({
            blockType,
            fields: { NAME: varName },
            values: { VALUE: createBlockNode('arduino_text', { TEXT: varValue }) },
            statements: {},
          });
        }
        continue;
      }

      // 数组声明
      const arrMatch = trimmed.match(
        /^\s*(int|float|String)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*;\s*$/
      );
      if (arrMatch) {
        blocks.push({
          blockType: 'arduino_declare_array',
          fields: { TYPE: arrMatch[1], NAME: arrMatch[2], SIZE: arrMatch[3] },
          values: {},
          statements: {},
        });
        continue;
      }

      // 无法识别
      if (trimmed.length > 1 && !trimmed.startsWith('#')) {
        allWarnings.push(`全局代码无法识别: ${trimmed.slice(0, 50)}`);
      }
    }
  }

  return { blocks, warnings: allWarnings };
}

// ========== 主入口 ==========

/**
 * 将 Arduino C++ 代码解析为 Blockly XML 字符串
 * @param code Arduino 代码
 * @returns 解析结果（含 XML、警告信息）
 */
export function parseCodeToXml(code: string): CodeParseResult {
  const warnings: string[] = [];
  const unrecognizedLines: number[] = [];

  if (!code || !code.trim()) {
    return { success: false, xml: null, warnings: ['代码为空'], unrecognizedLines: [] };
  }

  // 阶段 0：扫描 #define 宏，传给语句匹配器解析常量
  const defines = extractDefines(code);
  setMacroMap(defines);

  // 阶段 1：提取顶层函数
  const { functions, globalRanges } = extractTopLevelFunctions(code);

  // 阶段 2：解析全局作用域代码
  const globalResult = parseGlobalCode(code, globalRanges);
  warnings.push(...globalResult.warnings);

  // 阶段 3：解析每个函数体
  const topLevelFuncs: TopLevelFunction[] = [];

  for (const func of functions) {
    const bodyCode = code.slice(func.bodyStart, func.bodyEnd);
    const bodyResult = parseStatements(bodyCode, 0, '}', func.type === 'function_void' ? 'function' : func.type);
    warnings.push(...bodyResult.warnings);

    topLevelFuncs.push({
      type: func.type,
      name: func.name,
      body: bodyResult.blocks,
    });
  }

  // 阶段 4：如果没有找到 setup/loop/函数，尝试将整个代码作为 setup 体解析
  if (topLevelFuncs.length === 0) {
    const bodyResult = parseStatements(code, 0, '}', 'setup');
    warnings.push(...bodyResult.warnings);

    if (bodyResult.blocks.length > 0 || globalResult.blocks.length > 0) {
      topLevelFuncs.push({
        type: 'setup',
        body: bodyResult.blocks,
      });
    }
  }

  // 阶段 5：构建 XML
  if (topLevelFuncs.length === 0 && globalResult.blocks.length === 0) {
    return {
      success: false,
      xml: null,
      warnings: [...warnings, '代码中未找到可识别的积木结构'],
      unrecognizedLines: [],
    };
  }

  try {
    const xml = buildBlocklyXml(topLevelFuncs, globalResult.blocks);
    return {
      success: warnings.length === 0,
      xml,
      warnings,
      unrecognizedLines,
    };
  } catch (err) {
    return {
      success: false,
      xml: null,
      warnings: [...warnings, `XML 构建失败: ${err instanceof Error ? err.message : '未知错误'}`],
      unrecognizedLines,
    };
  }
}

/** 便捷函数：直接返回 XML 字符串或 null */
export function codeToBlocklyXml(code: string): string | null {
  const result = parseCodeToXml(code);
  return result.xml;
}
