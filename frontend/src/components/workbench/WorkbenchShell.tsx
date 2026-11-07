import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, PanelRightOpen } from 'lucide-react';

export interface WorkbenchStep {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

export interface WorkbenchShellProps {
  steps: WorkbenchStep[];
  activeStep: string;
  onStepSelect: (step: string) => void;
  currentStepTitle: string;
  agentOpen: boolean;
  onToggleAgent: () => void;
  debugPanelOpen: boolean;
  onToggleDebugPanel: () => void;
  agentOverlay?: ReactNode;
  stepContent: ReactNode;
  editorContent?: ReactNode;
  debugPanel: ReactNode;
  progressLabel?: string;
  stepEyebrow?: string;
  /** Temporary migration slot for legacy workbench content. */
  children?: ReactNode;
}

/**
 * The stable three-zone workbench boundary. Course content and device tools
 * stay in slots so later course schemas can replace the prototype data.
 */
export function WorkbenchShell({
  steps,
  activeStep,
  onStepSelect,
  currentStepTitle,
  agentOpen,
  onToggleAgent,
  debugPanelOpen,
  onToggleDebugPanel,
  agentOverlay,
  stepContent,
  editorContent,
  debugPanel,
  progressLabel = '已完成 0 / 0 步',
  stepEyebrow = '新手引导 · 体验项目',
  children,
}: WorkbenchShellProps) {
  if (children) {
    return (
      <main data-testid="workbench-shell" className="workbench-shell flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-y-auto lg:overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <main data-testid="workbench-shell" className="workbench-shell flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-y-auto lg:overflow-hidden">
      <aside className="course-steps-panel shrink-0 bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
        <div className="course-steps-panel__header">
          <span className="course-steps-panel__eyebrow">{stepEyebrow}</span>
          <strong>温湿度提醒器</strong>
          <span className="course-steps-panel__progress">{progressLabel}</span>
        </div>
        <nav className="course-steps-nav" aria-label="课程步骤">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const active = activeStep === item.id;
            return (
              <button
                type="button"
                key={item.id}
                className={`course-step ${active ? 'course-step--active' : ''}`}
                onClick={() => onStepSelect(item.id)}
                aria-current={active ? 'step' : undefined}
              >
                <span className="course-step__index">{index + 1}</span>
                <span className="course-step__icon"><Icon size={16} /></span>
                <span className="course-step__copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                {active && <ChevronRight size={16} className="course-step__arrow" />}
              </button>
            );
          })}
        </nav>
        <div className="course-steps-panel__footer">后续步骤可以预览；执行动作会在满足前置条件后解锁。</div>
      </aside>

      <section className="workbench-center relative flex-1 flex flex-col min-w-0 min-h-[500px] lg:min-h-0">
        <div className="workbench-stepbar">
          <div>
            <span className="workbench-stepbar__eyebrow">当前步骤</span>
            <h1>{currentStepTitle}</h1>
          </div>
          <div className="workbench-stepbar__actions">
            <button type="button" className="workbench-action-button" onClick={onToggleAgent} data-agent-anchor="agent.toggle">
              <span aria-hidden="true">✦</span> {agentOpen ? '收起 Agent' : '需要帮助'}
            </button>
            <button type="button" className="workbench-action-button" onClick={onToggleDebugPanel} data-agent-anchor="debug.toggle">
              {debugPanelOpen ? '收起调试' : '打开调试'}
            </button>
          </div>
        </div>

        {agentOverlay}
        {stepContent}
        {editorContent}
      </section>

      <aside className={`debug-panel ${debugPanelOpen ? '' : 'debug-panel--collapsed'} w-full lg:w-[320px] shrink-0 flex flex-col gap-4 min-h-0 lg:h-full lg:max-h-full lg:overflow-hidden`}>
        {!debugPanelOpen ? (
          <button type="button" className="debug-panel__restore" onClick={onToggleDebugPanel} data-agent-anchor="debug.restore">
            <PanelRightOpen size={18} />
            <span>设备调试</span>
          </button>
        ) : debugPanel}
      </aside>
    </main>
  );
}
