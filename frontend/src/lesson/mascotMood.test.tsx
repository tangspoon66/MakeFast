import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { mascotMood } from './mascotMood';
import { Mascot } from '../components/lesson/Mascot';
import { MASCOT_MOODS } from './mascotMoods';

describe('mascotMood 绑定', () => {
  it('IDLE 表面永远待机（M7）', () => {
    expect(mascotMood({ state: 'IDLE', error: true, busy: true })).toBe('idle');
  });
  it('报错 > 处理中 > 成功 > 聆听 > 指引', () => {
    expect(mascotMood({ state: 'GUIDING', error: true, busy: true })).toBe('warning');
    expect(mascotMood({ state: 'GUIDING', busy: true })).toBe('processing');
    expect(mascotMood({ state: 'GUIDING', justSucceeded: true })).toBe('success');
    expect(mascotMood({ state: 'GUIDING', listening: true })).toBe('listening');
    expect(mascotMood({ state: 'GUIDING' })).toBe('guiding');
    expect(mascotMood({ state: 'GUIDING', stepKind: 'explain' })).toBe('explaining');
    expect(mascotMood({ state: 'WRAP_UP' })).toBe('success');
    expect(mascotMood({ state: 'QUIET_HELP' })).toBe('thinking');
  });
  it('8 种状态都都使用概念图帧', () => {
    for (const m of MASCOT_MOODS) {
      const { container, unmount } = render(<Mascot mood={m} />);
      expect(container.querySelector(`[data-mood="${m}"] img[data-frame="${m}"]`)).toBeTruthy();
      unmount();
    }
  });
});
