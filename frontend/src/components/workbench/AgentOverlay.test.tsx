import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentOverlay } from './AgentOverlay';

describe('AgentOverlay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the active semantic target for the guided character', () => {
    render(
      <>
        <button data-agent-anchor="compile.button">编译代码</button>
        <AgentOverlay state="guide" message="点击这里开始编译" targetId="compile.button" />
      </>,
    );

    expect(screen.getByTestId('agent-overlay')).toHaveAttribute('data-agent-target', 'compile.button');
    expect(screen.getByText('点击这里开始编译')).toBeInTheDocument();
  });

  it('reveals a clipped real target before positioning the character', () => {
    const scrollIntoView = vi.fn();
    render(
      <>
        <button data-agent-anchor="debug.compile">编译代码</button>
        <AgentOverlay state="guide" message="先把真实按钮带到眼前" targetId="debug.compile" />
      </>,
    );

    const target = screen.getByRole('button', { name: '编译代码' });
    vi.spyOn(target, 'getBoundingClientRect')
      .mockReturnValueOnce({ top: 940, bottom: 980, left: 120, right: 220, width: 100, height: 40, x: 120, y: 940, toJSON: () => ({}) })
      .mockReturnValue({ top: 360, bottom: 400, left: 120, right: 220, width: 100, height: 40, x: 120, y: 360, toJSON: () => ({}) });
    Object.defineProperty(target, 'scrollIntoView', { value: scrollIntoView, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    expect(screen.getByTestId('agent-overlay')).toHaveStyle({ top: '352px' });
  });
});
