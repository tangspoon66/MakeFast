import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AIAssistant } from './AIAssistant';

describe('AIAssistant debug-only mode', () => {
  it('keeps logs visible when a legacy AI result event arrives', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
    render(<AIAssistant debugOnly logs={[{ timestamp: new Date(), type: 'info', message: '编译开始' }]} />);

    expect(screen.getByText('设备调试')).toBeTruthy();
    expect(screen.getByText('编译开始')).toBeTruthy();
    expect(screen.queryByText('AI 对话')).toBeNull();

    fireEvent(window, new CustomEvent('makefast:firmware-ai-result', {
      detail: { message: '旧的 AI 回复' },
    }));

    expect(screen.getByText('编译开始')).toBeTruthy();
    expect(screen.queryByText('旧的 AI 回复')).toBeNull();
  });
});
