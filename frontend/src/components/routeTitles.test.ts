import { describe, it, expect } from 'vitest';
import { titleFor } from './routeTitles';
describe('路由标题', () => {
  it('工作台 / 后台 / 未知', () => {
    expect(titleFor('/workbench')).toBe('工作台 · MakeFast 一键造物');
    expect(titleFor('/admin/courses')).toBe('管理后台 · MakeFast 一键造物');
    expect(titleFor('/xyz')).toBe('MakeFast 一键造物');
  });
});
  it('课文章节与自由创作标题', () => {
    expect(titleFor('/courses/first-lesson')).toContain('课文章节');
    expect(titleFor('/workbench?mode=free')).toContain('自由创作');
  });
