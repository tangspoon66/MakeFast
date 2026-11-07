import { describe, it, expect, beforeEach } from 'vitest';
import { useLessonStore, migrateLessonState } from './lessonStore';

describe('按课保存进度', () => {
  beforeEach(() => { localStorage.clear(); useLessonStore.setState({ coursePackId: 'first-lesson', byCourse: {}, guideStepIndex: 0, phenomenonSuccess: false, badges: [] }); });
  it('v1 单一会话迁移到 first-lesson 桶，进度不丢', () => {
    const v1 = { coursePackId: 'first-lesson', guideStepIndex: 6, phenomenonSuccess: true, badges: ['mainline_complete'], mockMode: true };
    const m = migrateLessonState(v1, 1) as { byCourse: Record<string, { guideStepIndex: number; phenomenonSuccess: boolean }>; guideStepIndex: number };
    expect(m.guideStepIndex).toBe(6);
    expect(m.byCourse['first-lesson']).toMatchObject({ guideStepIndex: 6, phenomenonSuccess: true });
    expect(migrateLessonState(undefined, 1)).toBeUndefined();
  });
  it('换课再换回来：两门课的步骤进度各自保留', () => {
    const s = useLessonStore.getState();
    s.setGuideStep(5);
    s.switchCourse('debug-detective');
    expect(useLessonStore.getState().guideStepIndex).toBe(0);
    useLessonStore.getState().setGuideStep(2);
    useLessonStore.getState().switchCourse('first-lesson');
    expect(useLessonStore.getState().guideStepIndex).toBe(5);
    useLessonStore.getState().switchCourse('debug-detective');
    expect(useLessonStore.getState().guideStepIndex).toBe(2);
    const persisted = JSON.parse(localStorage.getItem('makefast.lesson.first-lesson.v1')!);
    expect(persisted.version).toBe(2);
    expect(persisted.state.byCourse['first-lesson'].guideStepIndex).toBe(5);
  });
});
