import { describe, expect, it, beforeEach } from 'vitest';
import { tierText, useAgeTier, effectiveTier } from './ageTier';
import { stepCopy, TIER_COPY } from './tierCopy';
import { LESSONS } from './lessonRegistry';
import { mergeLearner } from './learner/sync';

describe('年龄档', () => {
  beforeEach(() => { localStorage.clear(); useAgeTier.setState({ tier: null }); });

  it('两节课的每一步都有三档文案，且总体比原文短', () => {
    for (const l of Object.values(LESSONS)) {
      let orig = 0; const sum = { low: 0, mid: 0, high: 0 };
      for (const s of l.guide) {
        expect(TIER_COPY[s.id], `${l.id}:${s.id}`).toBeTruthy();
        orig += s.do.length + s.why.length + s.success.length;
        for (const t of ['low', 'mid', 'high'] as const) { const c = stepCopy(s, t); sum[t] += c.do.length + c.why.length + c.success.length; }
      }
      expect(sum.mid).toBeLessThan(orig);
      expect(sum.high).toBeLessThan(sum.mid);
      expect(sum.low).toBeLessThan(orig);
    }
  });

  it('高龄文案每段都是一两行', () => {
    for (const c of Object.values(TIER_COPY)) for (const v of Object.values(c.high)) expect(v.length).toBeLessThanOrEqual(48);
  });

  it('自由文本压缩：高龄一句；低龄带比方；中龄最多两句', () => {
    const t = '少了一个分号。分号就像句号一样。编译器读到这里会迷路。再试一次。';
    expect(tierText(t, 'high')).toBe('少了一个分号。');
    expect(tierText(t, 'low')).toBe('少了一个分号。分号就像句号一样。');
    expect(tierText(t, 'mid')).toBe('少了一个分号。分号就像句号一样。');
    expect(tierText('', 'low')).toBe('');
  });

  it('选择存本地；后端画像只在本地没选时采用；合并画像保留年龄档', () => {
    expect(effectiveTier(useAgeTier.getState().tier)).toBe('mid');
    useAgeTier.getState().hydrate('high');
    expect(useAgeTier.getState().tier).toBe('high');
    useAgeTier.getState().setTier('low');
    useAgeTier.getState().hydrate('high');
    expect(useAgeTier.getState().tier).toBe('low');
    expect(localStorage.getItem('makefast.ageTier')).toBe('low');
    const base = { version: 1 as const, events: [], profile: null, difficulties: {}, quizAttempts: [] };
    expect(mergeLearner(base, { ...base, ageTier: 'high' }).ageTier).toBe('high');
    expect(mergeLearner({ ...base, ageTier: 'low' }, { ...base, ageTier: 'high' }).ageTier).toBe('low');
  });
});
