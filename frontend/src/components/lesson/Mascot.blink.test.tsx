import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mascot } from './Mascot';

describe('小铁猫眨眼 + 气泡', () => {
  it('idle 帧有闭眼覆盖层，success 帧没有（眼睛形状特殊，不硬套）', () => {
    const { rerender } = render(<Mascot mood="idle" decorative />);
    expect(screen.getByTestId('mascot-blink').getAttribute('src')).toBe('/agent/mascot/blink/idle.webp');
    rerender(<Mascot mood="success" decorative />);
    expect(screen.queryByTestId('mascot-blink')).toBeNull();
  });
  it('气泡显示文字', () => {
    render(<Mascot mood="processing" decorative bubble="我在帮你处理…" />);
    expect(screen.getByTestId('mascot-bubble').textContent).toBe('我在帮你处理…');
  });
});
