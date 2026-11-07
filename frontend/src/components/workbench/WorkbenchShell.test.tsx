import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookOpenCheck } from 'lucide-react';
import { WorkbenchShell } from './WorkbenchShell';

describe('WorkbenchShell', () => {
  const steps = [{ id: 'overview', title: '认识作品', subtitle: '目标', icon: BookOpenCheck }];

  it('keeps course, content, and debug zones in one tested boundary', () => {
    render(
      <WorkbenchShell
        steps={steps}
        activeStep="overview"
        onStepSelect={vi.fn()}
        currentStepTitle="认识作品"
        agentOpen={false}
        onToggleAgent={vi.fn()}
        debugPanelOpen
        onToggleDebugPanel={vi.fn()}
        stepContent={<div>step content</div>}
        editorContent={<div>editor content</div>}
        debugPanel={<div>debug content</div>}
      />,
    );

    expect(screen.getByTestId('workbench-shell')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '课程步骤' })).toBeInTheDocument();
    expect(screen.getByText('step content')).toBeInTheDocument();
    expect(screen.getByText('editor content')).toBeInTheDocument();
    expect(screen.getByText('debug content')).toBeInTheDocument();
  });

  it('reports step and debug actions to the host page', () => {
    const onStepSelect = vi.fn();
    const onToggleDebugPanel = vi.fn();
    render(
      <WorkbenchShell
        steps={steps}
        activeStep="overview"
        onStepSelect={onStepSelect}
        currentStepTitle="认识作品"
        agentOpen={false}
        onToggleAgent={vi.fn()}
        debugPanelOpen
        onToggleDebugPanel={onToggleDebugPanel}
        stepContent={<div />}
        debugPanel={<div />}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /认识作品/ }));
    fireEvent.click(screen.getByRole('button', { name: '收起调试' }));
    expect(onStepSelect).toHaveBeenCalledWith('overview');
    expect(onToggleDebugPanel).toHaveBeenCalledTimes(1);
  });
});
