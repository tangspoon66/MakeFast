import { describe, it, expect } from 'vitest';
import { getLesson, workbenchLinkForMeta } from './lessonRegistry';
import { lintFirstLesson, ruleFixes } from './agent/fixes';

describe('课包注册表 + 第二课', () => {
  it('未知 id 回到第一课；推荐能跳到第二课', () => {
    expect(getLesson('nope').id).toBe('first-lesson');
    expect(workbenchLinkForMeta('course-debug-detective')).toBe('/workbench?course=debug-detective');
    expect(workbenchLinkForMeta('course-servo-wave')).toBeNull();
  });
  it('排错小侦探：本地检查能找到分号和拼写两个 bug，并给出修改建议', () => {
    const code = getLesson('debug-detective').code;
    const errs = lintFirstLesson(code);
    expect(errs.some((e) => /expected ';'/.test(e.message))).toBe(true);
    expect(errs.some((e) => /readTemprature/.test(e.message))).toBe(true);
    const fixes = ruleFixes({ code, errors: errs });
    expect(fixes.some((f) => f.line === 11 && /;$/.test(f.after ?? ''))).toBe(true);
  });
});
