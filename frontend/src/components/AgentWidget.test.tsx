import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentWidget } from './AgentWidget';

describe('AgentWidget accessibility', () => {
  it('keeps live announcements separate from interactive controls', () => {
    render(
      <AgentWidget
        state="guide"
        message="先确认材料"
        expanded
        onAsk={vi.fn()}
        onRequestProposal={vi.fn()}
      />,
    );

    const bubble = screen.getByText('先确认材料').closest('.agent-bubble');
    expect(bubble).toBeInTheDocument();
    expect(bubble).not.toHaveAttribute('role', 'status');
    expect(screen.getByText('先确认材料')).toHaveAttribute('role', 'status');
    expect(screen.getByText('先确认材料')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('textbox', { name: '继续询问 Agent' })).toBeInTheDocument();
  });
});
