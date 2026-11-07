/**
 * 代码 / 积木修改建议（C4）：
 * - FixSuggestion：{ target: code_line | block, line / blockId(+field), before, after, why }
 * - ruleFixes()：第一课常见错误的规则修复（离线可用）：少分号、括号不配对、缺 #include、名字拼错 / 大小写、
 *   程序引脚与连线图不一致、波特率不是 115200；
 * - parseFixSuggestions()：安全解析后端 / LLM 给的结构化建议；validateFix()：应用前校验 before 仍然成立；
 * - lintFirstLesson()：模拟编译时的本地语法检查（输出 GCC 风格报错，保证无后端也能演示）。
 */
export type FixTarget = 'code_line' | 'block';
export interface FixSuggestion {
  id: string;
  target: FixTarget;
  /** code_line：1 起始行号；insert=true 表示在该行之前插入新行 */
  line?: number;
  insert?: boolean;
  blockId?: string;
  field?: string;
  before: string;
  after: string;
  why: string;
  title: string;
  source: 'rules' | 'llm' | 'server';
}
export interface CompileErr { line?: number; column?: number; message: string }

const MAX_LEN = 300;
const isStr = (v: unknown): v is string => typeof v === 'string';

/** 安全解析外部建议：类型 / 长度 / 字段白名单；非法项丢弃 */
export function parseFixSuggestions(raw: unknown, source: FixSuggestion['source'] = 'server'): FixSuggestion[] {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { fixes?: unknown }).fixes) ? (raw as { fixes: unknown[] }).fixes : [];
  const out: FixSuggestion[] = [];
  for (const it of arr.slice(0, 5)) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const target = o.target === 'code_line' || o.target === 'block' ? o.target : null;
    if (!target || !isStr(o.after) || !isStr(o.why)) continue;
    const before = isStr(o.before) ? o.before : '';
    if (before.length > MAX_LEN || o.after.length > MAX_LEN || o.why.length > MAX_LEN) continue;
    if (/[\r\n]/.test(o.after) && target === 'code_line' && o.after.split('\n').length > 3) continue;
    const fix: FixSuggestion = {
      id: `${source}-${out.length}-${target}`, target, before, after: o.after, why: o.why,
      title: isStr(o.title) && o.title.length <= 60 ? o.title : target === 'code_line' ? '这一行要改一下' : '这块积木要改一下', source,
    };
    if (target === 'code_line') {
      const line = Number(o.line);
      if (!Number.isInteger(line) || line < 1 || line > 5000) continue;
      fix.line = line; fix.insert = o.insert === true;
    } else {
      if (!isStr(o.blockId) || !/^[\w-]{1,40}$/.test(o.blockId)) continue;
      fix.blockId = o.blockId;
      if (o.field !== undefined) { if (!isStr(o.field) || !/^[A-Z_][A-Z0-9_]{0,30}$/.test(o.field)) continue; fix.field = o.field; }
    }
    out.push(fix);
  }
  return out;
}

const lines = (code: string) => code.split('\n');

/** 应用前校验：行号在范围内、该行内容（去空白）仍等于 before */
export function validateFix(fix: FixSuggestion, code: string): { ok: boolean; reason?: string } {
  if (fix.target !== 'code_line') return { ok: true };
  const ls = lines(code);
  const n = fix.line ?? 0;
  if (fix.insert) return n >= 1 && n <= ls.length + 1 ? { ok: true } : { ok: false, reason: '行号超出范围' };
  if (n < 1 || n > ls.length) return { ok: false, reason: '行号超出范围' };
  if (ls[n - 1].trim() !== fix.before.trim()) return { ok: false, reason: '这一行已经变了' };
  return { ok: true };
}

export function applyCodeFix(code: string, fix: FixSuggestion): string {
  const ls = lines(code);
  const i = (fix.line ?? 1) - 1;
  if (fix.insert) { ls.splice(i, 0, fix.after); return ls.join('\n'); }
  const indent = ls[i].match(/^\s*/)?.[0] ?? '';
  ls[i] = /^\s/.test(fix.after) ? fix.after : indent + fix.after.trimStart();
  return ls.join('\n');
}

/** 孩子自己改好了吗？（该行已变成 after，或原问题不再存在） */
export function isCodeFixResolved(fix: FixSuggestion, code: string, stillDetected: boolean): boolean {
  if (fix.target !== 'code_line') return !stillDetected;
  const ls = lines(code);
  const want = fix.after.trim();
  if (fix.insert) return ls.some((l) => l.trim() === want) || !stillDetected;
  const near = [fix.line! - 2, fix.line! - 1, fix.line!].filter((i) => i >= 0 && i < ls.length);
  return near.some((i) => ls[i].trim() === want) || !stillDetected;
}

// ---------- 规则 ----------
const CONTROL = /^(if|for|while|switch|else|do)\b/;
const DECL_HEADER = /^(void|int|float|bool|char|long|unsigned|double|String|byte)\s+\w+\s*\([^;]*\)\s*$/;
function stripComment(l: string) { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; }
/** “普通语句”且末尾缺分号 */
export function needsSemicolon(line: string): boolean {
  const t = stripComment(line).trim();
  if (!t || t.startsWith('#') || t.startsWith('/*') || t.startsWith('*')) return false;
  if (/[;{},:]$/.test(t) || t === '}' ) return false;
  if (CONTROL.test(t) || DECL_HEADER.test(t)) return false;
  return /[\w)\]"']$/.test(t);
}
function addSemicolon(line: string): string {
  const i = line.indexOf('//');
  if (i < 0) return line.replace(/\s*$/, ';');
  return line.slice(0, i).replace(/\s*$/, ';') + ' ' + line.slice(i);
}

const KNOWN = ['Serial', 'begin', 'print', 'println', 'dht', 'DHT', 'readTemperature', 'readHumidity', 'pinMode', 'digitalWrite', 'delay',
  'HIGH', 'LOW', 'OUTPUT', 'INPUT', 'DHT_PIN', 'DHT_TYPE', 'BUZZER_PIN', 'DHT22', 'temperature', 'humidity', 'isnan', 'setup', 'loop'];
function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function closestKnown(name: string): string | null {
  let best: string | null = null; let bd = 3;
  for (const k of KNOWN) {
    if (k === name) return null;
    const dist = k.toLowerCase() === name.toLowerCase() ? 0.5 : lev(k, name);
    if (dist < bd && dist <= Math.max(1, Math.floor(k.length / 4))) { bd = dist; best = k; }
  }
  return best;
}

export interface RuleInput {
  code: string;
  errors?: CompileErr[];
  /** 连线图里 DHT DATA / 蜂鸣器 S 实际 GPIO（用于程序引脚一致性） */
  wiringGpio?: { DHT_PIN?: number; BUZZER_PIN?: number };
  /** 积木视图打开时，引脚不一致给积木修复（第一课积木 id） */
  blocksOpen?: boolean;
  blockPins?: { DHT_PIN?: string; BUZZER_PIN?: string };
}

const PIN_LABEL: Record<number, string> = { 1: 'D0', 2: 'D1', 3: 'D2', 4: 'D3', 5: 'D4', 6: 'D5', 43: 'D6', 44: 'D7', 7: 'D8', 8: 'D9', 9: 'D10' };
export const pinLabel = (gpio: number | string) => { const n = Number(gpio); return PIN_LABEL[n] ? `${PIN_LABEL[n]}（GPIO${n}）` : `GPIO${gpio}`; };

export function ruleFixes(input: RuleInput): FixSuggestion[] {
  const { code } = input;
  const ls = lines(code);
  const out: FixSuggestion[] = [];
  const push = (f: Omit<FixSuggestion, 'id' | 'source'>) => {
    if (out.some((o) => o.target === f.target && o.line === f.line && o.blockId === f.blockId)) return;
    out.push({ ...f, id: `rule-${out.length}-${f.target}-${f.line ?? f.blockId}`, source: 'rules' });
  };

  for (const e of input.errors || []) {
    const msg = e.message || '';
    const L = e.line && e.line >= 1 ? Math.min(e.line, ls.length) : 0;
    if (/expected ';'/.test(msg) && L) {
      // GCC 把少分号报在“下一句”，所以先看上一行，再看本行、上上行
      const cand = [L - 1, L, L - 2].filter((n) => n >= 1 && n <= ls.length);
      const n = cand.find((k) => needsSemicolon(ls[k - 1]));
      if (n) push({ target: 'code_line', line: n, before: ls[n - 1].trim(), after: addSemicolon(ls[n - 1]).trim(), title: `第 ${n} 行末尾少了分号`,
        why: '每一句普通语句后面都要加「;」，就像句号。编译器到下一句才发现，所以报错行可能在它下面一行。（#define、#include 那种行不用加）' });
      continue;
    }
    const undecl = msg.match(/'([A-Za-z_]\w*)' was not declared/);
    if (undecl) {
      const bad = undecl[1]; const good = closestKnown(bad);
      const rx = new RegExp(`\\b${bad}\\b`);
      const n = (L && rx.test(ls[L - 1]) ? L : ls.findIndex((l) => rx.test(stripComment(l))) + 1) || 0;
      if (good && n) push({ target: 'code_line', line: n, before: ls[n - 1].trim(), after: ls[n - 1].replace(new RegExp(`\\b${bad}\\b`, 'g'), good).trim(),
        title: `「${bad}」应该写成「${good}」`, why: `电脑只认识「${good}」这个名字，大小写和拼写都要一模一样。` });
      continue;
    }
    const member = msg.match(/has no member named '(\w+)'/);
    if (member) {
      const bad = member[1]; const good = closestKnown(bad);
      const rx = new RegExp(`\\.${bad}\\b`);
      const n = (L && rx.test(ls[L - 1]) ? L : ls.findIndex((l) => rx.test(l)) + 1) || 0;
      if (good && n) push({ target: 'code_line', line: n, before: ls[n - 1].trim(), after: ls[n - 1].replace(rx, `.${good}`).trim(),
        title: `「${bad}」应该写成「${good}」`, why: `传感器 / 串口只提供「${good}」这个功能，名字要拼对。` });
      continue;
    }
    if (/expected '\}' at end of input/.test(msg)) {
      push({ target: 'code_line', line: ls.length + 1, insert: true, before: '', after: '}', title: '少了一个右大括号「}」',
        why: '每个「{」都要有一个「}」配对，程序最后少了一个。' });
      continue;
    }
    if (/'DHT' does not name a type|DHT\.h/.test(msg) && !/#include\s*<DHT\.h>/.test(code)) {
      push({ target: 'code_line', line: 1, insert: true, before: '', after: '#include <DHT.h>', title: '少了传感器库的 #include',
        why: '要先用 #include 把 DHT 传感器的“说明书”拿进来，程序才认识 DHT。' });
    }
  }

  // 程序引脚与连线图不一致（不阻断编译，但现象出不来）
  for (const def of ['DHT_PIN', 'BUZZER_PIN'] as const) {
    const want = input.wiringGpio?.[def];
    if (want === undefined) continue;
    if (input.blocksOpen && input.blockPins?.[def] !== undefined) {
      const cur = input.blockPins[def]!;
      if (Number(cur) !== want) {
        push({ target: 'block', blockId: def === 'DHT_PIN' ? 'dht_setup' : 'buzzer_setup', field: 'PIN', before: cur, after: String(want),
          title: def === 'DHT_PIN' ? 'DHT22 积木的引脚和连线图不一样' : '蜂鸣器积木的引脚和连线图不一样',
          why: `连线图把线接在 ${pinLabel(want)}，积木里却选了 ${pinLabel(cur)}。程序和实际接线要对上，才能读到数据 / 响起来。` });
      }
      continue;
    }
    const n = ls.findIndex((l) => new RegExp(`^\\s*#define\\s+${def}\\s+\\w+`).test(l)) + 1;
    if (!n) continue;
    const raw = ls[n - 1].match(new RegExp(`#define\\s+${def}\\s+(\\w+)`))![1];
    if (/^\d+$/.test(raw) && Number(raw) !== want) {
      push({ target: 'code_line', line: n, before: ls[n - 1].trim(), after: ls[n - 1].replace(new RegExp(`(#define\\s+${def}\\s+)\\w+`), `$1${want}`).trim(),
        title: `程序里的 ${def} 和连线图不一样`, why: `连线图把线接在 ${pinLabel(want)}，程序里写的是 ${raw}。改成 ${want}，程序才会去对的引脚找传感器 / 蜂鸣器。` });
    }
  }

  // 波特率：串口栏按 115200 听
  const baud = ls.findIndex((l) => /Serial\.begin\(\s*(\d+)\s*\)/.test(l) && !/Serial\.begin\(\s*115200\s*\)/.test(l)) + 1;
  if (baud) push({ target: 'code_line', line: baud, before: ls[baud - 1].trim(), after: ls[baud - 1].replace(/Serial\.begin\(\s*\d+\s*\)/, 'Serial.begin(115200)').trim(),
    title: '串口速度要和串口栏一样', why: '串口栏按 115200 的速度“听”小板说话，速度不一样就会看到乱码。' });
  return out;
}

/**
 * 模拟编译时的本地检查（只覆盖第一课常见错误）：返回 GCC 风格错误，行号 1 起始。
 */
export function lintFirstLesson(code: string): CompileErr[] {
  const ls = lines(code);
  const errs: CompileErr[] = [];
  let depth = 0;
  for (let i = 0; i < ls.length; i++) {
    const t = stripComment(ls[i]);
    if (depth > 0 && needsSemicolon(ls[i])) {
      let j = i + 1; while (j < ls.length && !stripComment(ls[j]).trim()) j++;
      const next = j < ls.length ? stripComment(ls[j]).trim() : '';
      if (!next.startsWith('{') && !next.startsWith('.') && !/^[+\-*/&|?:]/.test(next)) {
        const tok = next.match(/^[\w}]+/)?.[0] || '}';
        errs.push({ line: j < ls.length ? j + 1 : i + 1, message: `expected ';' before '${tok}'` });
      }
    }
    for (const ch of t.replace(/"([^"\\]|\\.)*"/g, '""')) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  }
  if (depth > 0) errs.push({ line: ls.length, message: "expected '}' at end of input" });
  if (/\bDHT\s+dht\s*\(/.test(code) && !/#include\s*<DHT\.h>/.test(code)) {
    const n = ls.findIndex((l) => /\bDHT\s+dht\s*\(/.test(l)) + 1;
    errs.push({ line: n, message: "'DHT' does not name a type" });
  }
  const used = new Set<string>();
  ls.forEach((l, i) => {
    const s = stripComment(l).replace(/"([^"\\]|\\.)*"/g, '""');
    if (s.trim().startsWith('#')) return;
    for (const m of s.matchAll(/\b([A-Za-z_]\w*)\s*(?=[.(])/g)) {
      const name = m[1];
      if (m.index && s[m.index - 1] === '.') continue; // obj.method( 交给下面的成员检查
      if (used.has(name) || KNOWN.includes(name) || /^(if|for|while|switch|return|sizeof|float|int|void|bool)$/.test(name)) continue;
      const good = closestKnown(name);
      if (good && good !== name) { used.add(name); errs.push({ line: i + 1, message: `'${name}' was not declared in this scope` }); }
    }
    for (const m of s.matchAll(/\.(\w+)\s*\(/g)) {
      const name = m[1];
      if (KNOWN.includes(name) || used.has('.' + name)) continue;
      const good = closestKnown(name);
      if (good) { used.add('.' + name); errs.push({ line: i + 1, message: `class has no member named '${name}'` }); }
    }
  });
  return errs.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

/**
 * 「小铁猫是怎么想的」：把一条修改建议背后的 感知 → 诊断 → 定位 → 建议 讲给孩子（和评委）听。
 * 只用已有的证据（编译器报错、连线图、积木字段），不编造。
 */
export function explainFix(fix: FixSuggestion, ctx: { errors?: CompileErr[]; wiringGpio?: Record<string, number | undefined> } = {}): string[] {
  const out: string[] = [];
  const wired = fix.blockId ? ctx.wiringGpio?.[/buzzer/.test(fix.blockId) ? 'BUZZER_PIN' : 'DHT_PIN'] : undefined;
  const near = fix.target === 'code_line' && fix.line
    ? (ctx.errors || []).find((e) => e.line !== undefined && Math.abs(e.line - fix.line!) <= 2)
    : undefined;
  if (near) out.push(`👀 感知：编译器说第 ${near.line} 行「${near.message.slice(0, 80)}」`);
  else if (fix.target === 'block') out.push(`👀 感知：这块积木里写的是 ${show(fix.field, fix.before)}${wired != null ? `，可连线图里线接在 ${pinLabel(String(wired))}` : ''}`);
  else if (/引脚|PIN/i.test(fix.title + fix.before)) out.push('👀 感知：程序里的引脚号和「连线图」对不上');
  else out.push('👀 感知：我读了一遍你的程序，发现这里和平常的写法不一样');
  out.push(`🧠 诊断：${fix.title}`);
  if (fix.target === 'code_line') {
    if (near && near.line !== fix.line && /expected ';'/.test(near.message)) out.push(`📍 定位：少分号时，编译器常常读到下一句才发现，所以报在第 ${near.line} 行；真正要改的是上一行——第 ${fix.line} 行的末尾`);
    else out.push(`📍 定位：${fix.insert ? `要在第 ${fix.line} 行前面加一行` : `问题就在第 ${fix.line} 行`}，我把你带到那里了`);
  } else out.push('📍 定位：我把这块积木和要改的格子框出来了');
  out.push(`🔧 建议：把「${show(fix.field, fix.before) || '（空）'}」改成「${show(fix.field, fix.after)}」`);
  out.push(fix.source === 'rules' ? '✅ 依据：这是本地检查规则发现的，不用联网也能用' : '✅ 依据：这是 AI 根据你的程序想到的，我先核对过它和你现在的代码对得上');
  return out;
}
function show(field: string | undefined, v: string) { return field === 'PIN' ? pinLabel(v) : v; }
