/**
 * 递归下降表达式解析器
 * 将 Arduino C++ 表达式解析为积木 AST 节点（BlockNode）
 * 处理 7 级运算符优先级、函数调用、类型转换、成员访问、元数据注释
 */

import type { BlockNode } from './xmlBuilder';
import { createBlockNode } from './xmlBuilder';
import { EXPRESSION_FUNC_MAP, AMBIGUOUS_EXPR_FUNCS } from './blockTypeRegistry';

// ========== 解析结果 ==========

export interface ParseResult {
  node: BlockNode;
  endPos: number;
  /** 表达式原始文本（用于嵌入父块的 value input） */
  rawText: string;
}

// ========== 字符判断辅助 ==========

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

function isAlpha(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
}

function isAlphaNumeric(c: string): boolean {
  return isAlpha(c) || isDigit(c);
}

function isSpace(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

// ========== 元数据注释解析 ==========

/**
 * 检测并解析元数据注释 /*@expr:TYPE|FIELD1:val1|...*\/
 * 返回积木类型和字段值，如果不存在则返回 null
 */
function parseMetadataComment(
  code: string,
  exprEnd: number
): { blockType: string; fields: Record<string, string> } | null {
  const rest = code.slice(exprEnd);
  const m = rest.match(/^\s*\/\*@(?:expr|block):(\w+)\|(.*?)\*\//);
  if (!m) return null;

  const blockType = m[1];
  const fields: Record<string, string> = {};
  const fieldPairs = m[2].split('|');
  for (const pair of fieldPairs) {
    const [key, ...valParts] = pair.split(':');
    if (key) fields[key] = valParts.join(':');
  }
  return { blockType, fields };
}

/** 在字符串中跳过空白后查找元数据注释 */
function findMetadata(
  code: string,
  pos: number
): { blockType: string; fields: Record<string, string>; endPos: number } | null {
  let i = pos;
  while (i < code.length && isSpace(code[i])) i++;
  const result = parseMetadataComment(code, i);
  if (!result) return null;
  // 计算元数据注释结束位置
  const rest = code.slice(i);
  const mMeta = rest.match(/^\s*\/\*@(?:expr|block):\w+\|.*?\*\//);
  return { ...result, endPos: i + (mMeta ? mMeta[0].length : 0) };
}

// ========== 主解析入口 ==========

/**
 * 解析一个完整的表达式
 * @param code 完整的代码字符串
 * @param startPos 表达式起始位置
 * @returns ParseResult，如果解析失败则抛出错误
 */
export function parseExpression(code: string, startPos: number = 0): ParseResult {
  const result = parseLogicalOr(code, startPos);
  return result;
}

// ========== 优先级 1: || (logical OR) ==========

function parseLogicalOr(code: string, pos: number): ParseResult {
  let left = parseLogicalAnd(code, pos);

  while (pos < code.length) {
    const skipped = skipSpaces(code, left.endPos);
    if (code.slice(skipped, skipped + 2) === '||') {
      const right = parseLogicalAnd(code, skipped + 2);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_logic', { OP: '||' }, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else {
      break;
    }
  }
  return left;
}

// ========== 优先级 2: && (logical AND) ==========

function parseLogicalAnd(code: string, pos: number): ParseResult {
  let left = parseEquality(code, pos);

  while (pos < code.length) {
    const skipped = skipSpaces(code, left.endPos);
    if (code.slice(skipped, skipped + 2) === '&&') {
      const right = parseEquality(code, skipped + 2);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_logic', { OP: '&&' }, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else {
      break;
    }
  }
  return left;
}

// ========== 优先级 3: ==, != ==========

function parseEquality(code: string, pos: number): ParseResult {
  let left = parseRelational(code, pos);

  while (pos < code.length) {
    const skipped = skipSpaces(code, left.endPos);
    const op2 = code.slice(skipped, skipped + 2);
    if (op2 === '==' || op2 === '!=') {
      const right = parseRelational(code, skipped + 2);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_compare', { OP: op2 }, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else {
      break;
    }
  }
  return left;
}

// ========== 优先级 4: <, >, <=, >= ==========

function parseRelational(code: string, pos: number): ParseResult {
  let left = parseAdditive(code, pos);

  while (pos < code.length) {
    const skipped = skipSpaces(code, left.endPos);
    const op2 = code.slice(skipped, skipped + 2);
    if (op2 === '<=' || op2 === '>=') {
      const right = parseAdditive(code, skipped + 2);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_compare', { OP: op2 }, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else if (code[skipped] === '<' || code[skipped] === '>') {
      const right = parseAdditive(code, skipped + 1);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_compare', { OP: code[skipped] }, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else {
      break;
    }
  }
  return left;
}

// ========== 优先级 5: +, - ==========

function parseAdditive(code: string, pos: number): ParseResult {
  let left = parseMultiplicative(code, pos);

  while (pos < code.length) {
    const skipped = skipSpaces(code, left.endPos);
    const ch = code[skipped];
    if (ch === '+' || ch === '-') {
      const right = parseMultiplicative(code, skipped + 1);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_math', { OP: ch }, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else {
      break;
    }
  }
  return left;
}

// ========== 优先级 6: *, /, % ==========

function parseMultiplicative(code: string, pos: number): ParseResult {
  let left = parseUnary(code, pos);

  while (pos < code.length) {
    const skipped = skipSpaces(code, left.endPos);
    const ch = code[skipped];
    if (ch === '*' || ch === '/') {
      const right = parseUnary(code, skipped + 1);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_math', { OP: ch }, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else if (ch === '%') {
      const right = parseUnary(code, skipped + 1);
      const rawText = code.slice(pos, right.endPos).trim();
      left = {
        node: createBlockNode('arduino_modulo', {}, { A: left.node, B: right.node }),
        endPos: right.endPos,
        rawText,
      };
    } else {
      break;
    }
  }
  return left;
}

// ========== 优先级 7: ! (unary) ==========

function parseUnary(code: string, pos: number): ParseResult {
  const skipped = skipSpaces(code, pos);
  if (code[skipped] === '!') {
    const operand = parseAtom(code, skipped + 1);
    const rawText = code.slice(pos, operand.endPos).trim();
    return {
      node: createBlockNode('arduino_not', {}, { VALUE: operand.node }),
      endPos: operand.endPos,
      rawText,
    };
  }
  return parseAtom(code, pos);
}

// ========== 原子表达式 ==========

function parseAtom(code: string, pos: number): ParseResult {
  const skipped = skipSpaces(code, pos);

  if (skipped >= code.length) {
    throw new Error(`Unexpected end of expression at position ${pos}`);
  }

  const ch = code[skipped];

  // 1. 数字字面量
  if (isDigit(ch) || (ch === '.' && skipped + 1 < code.length && isDigit(code[skipped + 1]))) {
    return parseNumber(code, skipped);
  }

  // 2. 字符串字面量
  if (ch === '"') {
    return parseStringLiteral(code, skipped);
  }

  // 3. 括号表达式
  if (ch === '(') {
    return parseParenExpr(code, skipped);
  }

  // 4. 类型转换 (int)(...) 或 (float)(...)
  if (ch === '(' && skipped + 1 < code.length) {
    const nextRest = code.slice(skipped + 1).trimStart();
    if (nextRest.startsWith('int)') || nextRest.startsWith('float)')) {
      return parseTypeCast(code, skipped);
    }
  }

  // 5. 标识符：变量名、函数调用、成员访问、构造函数调用
  if (isAlpha(ch)) {
    return parseIdentifier(code, skipped);
  }

  throw new Error(`Unexpected character '${ch}' at position ${skipped} in expression`);
}

// ========== 数字解析 ==========

function parseNumber(code: string, pos: number): ParseResult {
  let i = pos;
  if (code[i] === '-') i++;
  while (i < code.length && isDigit(code[i])) i++;
  if (i < code.length && code[i] === '.') {
    i++;
    while (i < code.length && isDigit(code[i])) i++;
  }
  const rawText = code.slice(pos, i);
  const node = createBlockNode('arduino_number', { NUM: rawText });

  // 检查元数据注释
  const meta = findMetadata(code, i);
  if (meta) {
    return { node: createBlockNode(meta.blockType, meta.fields), endPos: meta.endPos, rawText: code.slice(pos, meta.endPos).trim() };
  }

  return { node, endPos: i, rawText };
}

// ========== 字符串字面量解析 ==========

function parseStringLiteral(code: string, pos: number): ParseResult {
  let i = pos + 1; // 跳过开头的 "
  while (i < code.length) {
    if (code[i] === '\\') {
      i += 2; // 跳过转义字符
    } else if (code[i] === '"') {
      i++; // 跳过结尾的 "
      break;
    } else {
      i++;
    }
  }
  const text = code.slice(pos + 1, i - 1); // 去掉引号
  const rawText = code.slice(pos, i);
  const node = createBlockNode('arduino_text', { TEXT: text });

  // 检查元数据注释
  const meta = findMetadata(code, i);
  if (meta) {
    return { node: createBlockNode(meta.blockType, meta.fields), endPos: meta.endPos, rawText: code.slice(pos, meta.endPos).trim() };
  }

  return { node, endPos: i, rawText };
}

// ========== 括号表达式解析 ==========

function parseParenExpr(code: string, pos: number): ParseResult {
  // 跳过 (
  const inner = parseExpression(code, pos + 1);
  let endPos = skipSpaces(code, inner.endPos);
  if (code[endPos] === ')') {
    endPos++;
  }
  const rawText = code.slice(pos, endPos);

  // 括号内的表达式直接返回，不包装额外积木
  inner.endPos = endPos;
  inner.rawText = rawText;
  return inner;
}

// ========== 类型转换解析 ==========

function parseTypeCast(code: string, pos: number): ParseResult {
  // 匹配 (int) 或 (float)
  const rest = code.slice(pos + 1).trimStart();
  let castType: string;
  let castIdx: number;

  if (rest.startsWith('int)')) {
    castType = 'arduino_to_int';
    castIdx = pos + 1 + (code.slice(pos + 1).length - rest.length) + 4; // (int) 长度
  } else if (rest.startsWith('float)')) {
    castType = 'arduino_to_float';
    castIdx = pos + 1 + (code.slice(pos + 1).length - rest.length) + 6; // (float) 长度
  } else {
    // 不是类型转换，是普通括号
    return parseParenExpr(code, pos);
  }

  const operand = parseAtom(code, castIdx);
  const rawText = code.slice(pos, operand.endPos).trim();
  return {
    node: createBlockNode(castType, {}, { VALUE: operand.node }),
    endPos: operand.endPos,
    rawText,
  };
}

// ========== 标识符解析（变量/函数调用/成员访问/构造函数） ==========

function parseIdentifier(code: string, pos: number): ParseResult {
  // 读取完整的标识符链（如 dht.readTemperature）
  let i = pos;
  while (i < code.length && (isAlphaNumeric(code[i]) || code[i] === '.')) i++;
  const name = code.slice(pos, i);

  // 跳过空格
  const j = skipSpaces(code, i);

  // 检查是否为函数调用 (后面跟着 '(')
  if (j < code.length && code[j] === '(') {
    // 解析参数列表
    const args = parseArgList(code, j);
    const endPos = args.endPos;
    const rawText = code.slice(pos, endPos);

    // 检查是否为构造函数调用 String(...)
    if (name === 'String' && args.args.length === 1) {
      const meta = findMetadata(code, endPos);
      if (meta) {
        return { node: createBlockNode(meta.blockType, meta.fields), endPos: meta.endPos, rawText: code.slice(pos, meta.endPos).trim() };
      }
      return {
        node: createBlockNode('arduino_to_string', {}, { VALUE: args.args[0].node }),
        endPos,
        rawText,
      };
    }

    // 尝试匹配函数名到积木类型
    const blockInfo = matchFuncToBlock(name, args.args);
    if (blockInfo) {
      const meta = findMetadata(code, endPos);
      if (meta) {
        return { node: createBlockNode(meta.blockType, meta.fields), endPos: meta.endPos, rawText: code.slice(pos, meta.endPos).trim() };
      }
      return blockInfo;
    }

    // 检查元数据注释
    const meta = findMetadata(code, endPos);
    if (meta) {
      return { node: createBlockNode(meta.blockType, meta.fields), endPos: meta.endPos, rawText: code.slice(pos, meta.endPos).trim() };
    }

    // 无法匹配 — 返回通用变量引用（可能是未定义的函数）
    // 这通常是用户手写代码中不支持的函数
    const node = createBlockNode('arduino_get_variable', { NAME: name + '()' });
    return { node, endPos, rawText };
  }

  // 不是函数调用 — 是变量引用或简单表达式
  const rawText = code.slice(pos, i);

  // 检查元数据注释
  const meta = findMetadata(code, i);
  if (meta) {
    return { node: createBlockNode(meta.blockType, meta.fields), endPos: meta.endPos, rawText: code.slice(pos, meta.endPos).trim() };
  }

  // 尝试精确匹配已知的无参数表达式（如 millis, micros 等）
  const simpleMatch = EXPRESSION_FUNC_MAP[name];
  if (simpleMatch && simpleMatch.fieldNames.length === 0) {
    return { node: createBlockNode(simpleMatch.blockType), endPos: i, rawText };
  }

  // 检查是否为特殊常量
  if (name === 'HIGH' || name === 'LOW') {
    // HIGH/LOW 作为数字值用在表达式中，转为 number 积木
    return { node: createBlockNode('arduino_number', { NUM: name }), endPos: i, rawText };
  }
  if (name === 'true' || name === 'false') {
    return { node: createBlockNode('arduino_number', { NUM: name }), endPos: i, rawText };
  }

  // 变量引用
  return { node: createBlockNode('arduino_get_variable', { NAME: name }), endPos: i, rawText };
}

// ========== 函数参数列表解析 ==========

interface ArgListResult {
  args: ParseResult[];
  endPos: number; // 指向 ')' 之后
}

function parseArgList(code: string, openParenPos: number): ArgListResult {
  const args: ParseResult[] = [];
  let pos = openParenPos + 1; // 跳过 '('

  while (pos < code.length) {
    pos = skipSpaces(code, pos);
    if (pos >= code.length) break;
    if (code[pos] === ')') {
      pos++;
      break;
    }

    // 解析一个参数
    const arg = parseExpression(code, pos);
    args.push(arg);
    pos = arg.endPos;

    pos = skipSpaces(code, pos);
    if (code[pos] === ',') {
      pos++;
    } else if (code[pos] === ')') {
      pos++;
      break;
    }
  }

  return { args, endPos: pos };
}

// ========== 函数名到积木的映射 ==========

function matchFuncToBlock(
  funcName: string,
  args: ParseResult[]
): ParseResult | null {
  // 1. 检查精确映射
  const exact = EXPRESSION_FUNC_MAP[funcName];
  if (exact) {
    const fields: Record<string, string> = {};
    const values: Record<string, BlockNode> = {};

    for (let i = 0; i < exact.fieldNames.length; i++) {
      const fieldName = exact.fieldNames[i];
      const arg = args[i];
      if (!arg) break;
      // 如果参数是简单的数字或变量，放入 fields；否则放入 values
      if (arg.node.blockType === 'arduino_number' && arg.node.fields.NUM !== undefined) {
        fields[fieldName] = arg.node.fields.NUM;
      } else if (arg.node.blockType === 'arduino_get_variable' && arg.node.fields.NAME !== undefined) {
        // 对于引脚字段，变量引用也放入 fields
        fields[fieldName] = arg.node.fields.NAME;
      } else {
        values[fieldName] = arg.node;
      }
    }

    // 构建 rawText
    const rawText = `${funcName}(${args.map(a => a.rawText).join(', ')})`;

    // 特殊处理 MPU6050
    if (funcName.startsWith('mpu.getAcceleration') || funcName.startsWith('mpu.getRotation')) {
      const type = funcName.includes('Acceleration') ? 'accel' : 'gyro';
      const axis = funcName.slice(-1); // X, Y, or Z
      const endPos = args.length > 0 ? args[args.length - 1].endPos + 1 : 0;
      return {
        node: createBlockNode('arduino_mpu6050_read', { TYPE: type, AXIS: axis }),
        endPos,
        rawText,
      };
    }

    // 返回最后一个参数的结束位置 + 1 (for ')')
    const endPos = args.length > 0 ? args[args.length - 1].endPos + 1 : 0;
    return {
      node: createBlockNode(exact.blockType, fields, values),
      endPos,
      rawText,
    };
  }

  // 2. 检查超声波测距（动态函数名 readUltrasonic_TRIG_ECHO）
  const ultrasonicMatch = funcName.match(/^readUltrasonic_(\d+)_(\d+)$/);
  if (ultrasonicMatch) {
    return {
      node: createBlockNode('arduino_ultrasonic_read', {
        TRIG_PIN: ultrasonicMatch[1],
        ECHO_PIN: ultrasonicMatch[2],
      }),
      endPos: 0, // 将由调用者覆盖
      rawText: `${funcName}()`,
    };
  }

  return null;
}

// ========== 辅助函数 ==========

function skipSpaces(code: string, pos: number): number {
  while (pos < code.length && isSpace(code[pos])) pos++;
  return pos;
}

/**
 * 判断一个标识符是否为表达式函数名（非语句）
 * 用于语句解析器区分 `digitalWrite(...)` 是语句还是表达式
 */
export function isExpressionFunc(name: string): boolean {
  return name in EXPRESSION_FUNC_MAP || name in AMBIGUOUS_EXPR_FUNCS;
}

/**
 * 获取表达式中函数调用对应的积木类型名
 */
export function getExpressionBlockType(name: string): string | null {
  const exact = EXPRESSION_FUNC_MAP[name];
  if (exact) return exact.blockType;
  const ambiguous = AMBIGUOUS_EXPR_FUNCS[name];
  if (ambiguous && ambiguous.length > 0) return ambiguous[0].blockType;
  return null;
}
