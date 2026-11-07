import { describe, it, expect } from 'vitest';
import { applyCodeFix, isCodeFixResolved, lintFirstLesson, parseFixSuggestions, ruleFixes, validateFix } from './fixes';
import { FIRST_LESSON_CODE } from '../firmware';

const broken = FIRST_LESSON_CODE.replace('Serial.begin(115200);', 'Serial.begin(115200)');
const lineOf = (code: string, s: string) => code.split('\n').findIndex((l) => l.includes(s)) + 1;

describe('代码修改建议（规则，离线）', () => {
  it('第一课程序本地检查 0 报错', () => { expect(lintFirstLesson(FIRST_LESSON_CODE)).toEqual([]); });
  it("少分号：报错在下一行，建议改上一行（#define 不加）", () => {
    const errs = lintFirstLesson(broken);
    expect(errs[0].message).toMatch(/expected ';'/);
    const n = lineOf(broken, 'Serial.begin');
    expect(errs[0].line).toBe(n + 1);
    const [fix] = ruleFixes({ code: broken, errors: errs });
    expect(fix.line).toBe(n);
    expect(fix.after).toBe('Serial.begin(115200);');
    expect(validateFix(fix, broken).ok).toBe(true);
    const fixed = applyCodeFix(broken, fix);
    expect(fixed).toBe(FIRST_LESSON_CODE);
    expect(isCodeFixResolved(fix, fixed, false)).toBe(true);
    expect(validateFix(fix, fixed).ok).toBe(false);
  });
  it('拼错名字 / 大小写', () => {
    const code = FIRST_LESSON_CODE.replace('dht.readHumidity()', 'dht.readHumdity()').replace('  Serial.println(" %");', '  serial.println(" %");');
    const fixes = ruleFixes({ code, errors: lintFirstLesson(code) });
    expect(fixes.map((f) => f.after)).toEqual(expect.arrayContaining([expect.stringContaining('readHumidity'), 'Serial.println(" %");']));
  });
  it('缺右括号 / 缺 include', () => {
    const code = FIRST_LESSON_CODE.trimEnd().replace(/\}$/, '').replace('#include <DHT.h>\n', '');
    const fixes = ruleFixes({ code, errors: lintFirstLesson(code) });
    expect(fixes.some((f) => f.insert && f.after === '}')).toBe(true);
    expect(fixes.some((f) => f.insert && f.after === '#include <DHT.h>' && f.line === 1)).toBe(true);
  });
  it('引脚与连线图不一致：代码行 / 积木字段', () => {
    const [f] = ruleFixes({ code: FIRST_LESSON_CODE, wiringGpio: { DHT_PIN: 3 } });
    expect(f.after).toBe('#define DHT_PIN 3');
    const [b] = ruleFixes({ code: FIRST_LESSON_CODE, wiringGpio: { DHT_PIN: 1 }, blocksOpen: true, blockPins: { DHT_PIN: '3' } });
    expect(b).toMatchObject({ target: 'block', blockId: 'dht_setup', field: 'PIN', before: '3', after: '1' });
  });
  it('安全解析外部建议', () => {
    const ok = parseFixSuggestions({ fixes: [{ target: 'code_line', line: 11, before: 'a', after: 'a;', why: 'w' }, { target: 'rm -rf', after: 'x', why: 'y' }, { target: 'block', blockId: '<script>', after: '1', why: 'y' }] });
    expect(ok).toHaveLength(1);
    expect(parseFixSuggestions('garbage')).toEqual([]);
  });
});

import { explainFix } from './fixes';
describe('小铁猫的思路（explainFix）', () => {
  it('少分号：讲清楚为什么报在下一行、改的是上一行', () => {
    const fix = { id: 'x', target: 'code_line' as const, line: 11, before: 'Serial.begin(115200)', after: 'Serial.begin(115200);', why: '', title: '第 11 行末尾少了分号', source: 'rules' as const };
    const r = explainFix(fix, { errors: [{ line: 12, message: "expected ';' before 'pinMode'" }] });
    expect(r[0]).toContain('第 12 行');
    expect(r.join('\n')).toContain('真正要改的是上一行——第 11 行');
    expect(r.at(-1)).toContain('本地检查规则');
  });
});
