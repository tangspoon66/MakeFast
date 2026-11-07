import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SerialToolbar } from './SerialToolbar';

vi.mock('../api/compilationClient', () => ({
  CompilationClient: { getBoards: vi.fn().mockResolvedValue({ boards: [] }) },
}));

describe('SerialToolbar in workbench', () => {
  it('keeps connection and settings in the header while accepting baud changes from the debug panel', () => {
    const onMonitorStateChange = vi.fn();
    render(<SerialToolbar showMonitorButton={false} onMonitorStateChange={onMonitorStateChange} />);

    expect(screen.getByRole('button', { name: '连接设备' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设备设置' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '监视器' })).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new CustomEvent('serialtoolbar:set-baud-rate', { detail: 9600 })));
    expect(onMonitorStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ baudRate: 9600 }));
  });
});
