import { describe, it, expect } from 'vitest';
import { mergeLearner } from './sync';

describe('画像合并（本地 ⇄ 后端）', () => {
  it('事件去重并集、难点取较大值、本地画像优先', () => {
    const local = { version: 1 as const, events: [{ t: 1, type: 'step.start', stepId: 'a' }], profile: null, difficulties: { wiring: 1 }, quizAttempts: [] };
    const m = mergeLearner(local as never, { events: [{ t: 1, type: 'step.start', stepId: 'a' }, { t: 2, type: 'step.done', stepId: 'a' }], difficulties: { wiring: 3, syntax: 1 }, profile: { stage: 'maker' } } as never);
    expect(m.events).toHaveLength(2);
    expect(m.difficulties).toEqual({ wiring: 3, syntax: 1 });
    expect((m.profile as unknown as { stage: string }).stage).toBe('maker');
  });
  it('后端不可用 → 原样', () => { const l = { version: 1 as const, events: [], profile: null, difficulties: {}, quizAttempts: [] }; expect(mergeLearner(l, null)).toBe(l); });
});
