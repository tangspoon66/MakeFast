import { AgeTierSelect } from '../AgeTierSelect';
import type React from 'react';
import type { ReactNode } from 'react';
import type { GuideStep } from '../../lesson/guideScript';
import { useAgentAnchor } from '../../lesson/agent/anchors';

interface CourseStepsPanelProps {
  title: string;
  steps: GuideStep[];
  activeIndex: number;
  doneIds: Set<string>;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (index: number) => void;
  footer?: ReactNode;
}

/** 左侧课程步骤（可折叠）。点任意步都可回看，不设答题门闩。 */
export function CourseStepsPanel({ title, steps, activeIndex, doneIds, collapsed, onToggle, onSelect, footer }: CourseStepsPanelProps) {
  const doneCount = steps.filter((s) => doneIds.has(s.id)).length;
  const panelRef = useAgentAnchor<HTMLElement>('steps.panel', { label: '左侧课程步骤', kind: 'panel', region: 'steps', collapsed });
  const toggleRef = useAgentAnchor<HTMLButtonElement>('steps.toggle', { label: '课程步骤的展开/收起按钮', kind: 'toggle', region: 'steps', collapsed });
  return (
    <aside ref={panelRef} className={`lw-course ${collapsed ? 'lw-course--collapsed' : ''}`} aria-label="课程步骤" data-testid="course-steps">
      <div className="lw-course__head">
        {!collapsed && <div><small>本课</small><h2>{title}</h2></div>}
        <button ref={toggleRef} type="button" className="lw-course__toggle" onClick={onToggle} aria-label={collapsed ? '展开课程步骤' : '收起课程步骤'} aria-expanded={!collapsed}>
          {collapsed ? '»' : '«'}
        </button>
      </div>
      {/* 评委演示导览放在这里（不再浮在步骤上面挡住内容） */}
      {!collapsed && <div id="lw-demo-slot" className="lw-course__demo" />}
      {!collapsed && <div className="lw-course__tier"><AgeTierSelect compact /></div>}
      <ol className="lw-course__list">
        {steps.map((s, i) => {
          const done = doneIds.has(s.id);
          return (
            <li key={s.id}>
              <StepButton id={s.id} label={`第 ${i + 1} 步「${s.title}」`}
                type="button"
                className={`lw-course__item ${done ? 'lw-course__item--done' : ''}`}
                aria-current={i === activeIndex ? 'step' : undefined}
                onClick={() => onSelect(i)}
                title={s.title}
              >
                <span className="lw-course__num">{done ? '✓' : i + 1}</span>
                {!collapsed && <span>{s.title}</span>}
              </StepButton>
            </li>
          );
        })}
      </ol>
      {!collapsed && (
        <div className="lw-course__foot">
          <small>已完成 {doneCount} / {steps.length} 步</small>
          <div className="lw-course__progress"><span style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          {footer}
        </div>
      )}
    </aside>
  );
}

function StepButton({ id, label, ...rest }: { id: string; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useAgentAnchor<HTMLButtonElement>(`step.${id}`, { label, kind: 'step', region: 'steps' });
  return <button ref={ref} {...rest} />;
}
