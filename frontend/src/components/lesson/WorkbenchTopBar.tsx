/**
 * 工作台顶栏（冻结顺序）：← 返回 · 项目/板型 → 连接 → 编译 → 烧录（最右主按钮）
 * 错误只出现在「动作处」（按钮下方小提示）和「结果处」（串口/输出栏），不弹 toast。
 */
import type { ReactNode } from 'react';
import type { PhaseStatus } from '../../lesson/lessonStore';
import type { GuideHighlight } from '../../lesson/guideScript';
import { useAgentAnchor } from '../../lesson/agent/anchors';

export interface ActionMessage { kind: 'error' | 'warning' | 'info'; text: string }

export interface TopAction {
  status: PhaseStatus;
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  progress?: number;
  message?: ActionMessage | null;
  onClick: () => void;
  onDismissMessage?: () => void;
}

const LABELS: Record<string, string> = { 'topbar.board': '板型按钮', 'topbar.connect': '「连接」按钮', 'topbar.compile': '「编译」按钮', 'topbar.flash': '「烧录」按钮' };

const STATUS_WORD: Record<PhaseStatus, string> = { todo: '待做', current: '下一步', done: '完成', error: '需处理' };

function ActionButton({ action, anchor, primary, icon, highlighted }: { action: TopAction; anchor: GuideHighlight; primary?: boolean; icon: ReactNode; highlighted: boolean }) {
  const dot = action.status === 'done' ? '✓' : action.status === 'error' ? '!' : icon;
  const ref = useAgentAnchor<HTMLDivElement>(anchor, { label: LABELS[anchor] || anchor, kind: 'button', region: 'topbar', enabled: !action.disabled });
  return (
    <div className="lw-action" data-lw-anchor={anchor} ref={ref}>
      <button
        type="button"
        className={`lw-btn ${primary ? 'lw-btn--primary' : ''} ${highlighted ? 'lw-highlight' : ''}`}
        data-status={action.status}
        disabled={action.disabled}
        onClick={action.onClick}
        aria-busy={action.busy || undefined}
        data-testid={`action-${anchor.split('.')[1]}`}
      >
        <span className="lw-status-dot" data-status={action.status} aria-hidden="true">{dot}</span>
        <span>{action.busy ? (action.busyLabel || action.label) : action.label}</span>
        <span className="lw-status-word">{STATUS_WORD[action.status]}</span>
      </button>
      {action.busy && typeof action.progress === 'number' && (
        <div className="lw-progress" aria-label={`进度 ${Math.round(action.progress)}%`}><span style={{ width: `${action.progress}%` }} /></div>
      )}
      {action.message && (
        <div className={`lw-action__msg lw-action__msg--${action.message.kind}`} role={action.message.kind === 'error' ? 'alert' : 'status'}>
          {action.message.text}
          {action.onDismissMessage && <button type="button" onClick={action.onDismissMessage}>知道了</button>}
        </div>
      )}
    </div>
  );
}

interface WorkbenchTopBarProps {
  title: string;
  onBack: () => void;
  mockMode: boolean;
  onMockModeChange: (on: boolean) => void;
  board: TopAction;
  /** 插板识别的行内提示，例如「检测到 ESP32-S3 类板子」 */
  detectNote?: string | null;
  connect: TopAction;
  compile: TopAction;
  flash: TopAction;
  highlight?: GuideHighlight | null;
}

export function WorkbenchTopBar({ title, onBack, mockMode, onMockModeChange, board, connect, compile, flash, highlight, detectNote }: WorkbenchTopBarProps) {
  const backRef = useAgentAnchor<HTMLButtonElement>('topbar.back', { label: '「←」返回按钮', kind: 'button', region: 'topbar' });
  const mockRef = useAgentAnchor<HTMLLabelElement>('topbar.mock', { label: '「模拟模式」开关', kind: 'toggle', region: 'topbar', collapsed: !mockMode });
  return (
    <header className="lw-top" data-testid="workbench-topbar">
      <button ref={backRef} type="button" className="lw-top__back" onClick={onBack} aria-label="返回学习主页" title="返回学习主页">←</button>
      <div className="lw-top__project">
        <span className="lw-top__eyebrow">我的项目</span>
        <h1 className="lw-top__title" title={title}>{title}</h1>
      </div>
      <label ref={mockRef} className={`lw-mock ${mockMode ? 'lw-mock--on' : ''}`} title="没有硬件时用模拟设备完整体验">
        <input type="checkbox" checked={mockMode} onChange={(e) => onMockModeChange(e.target.checked)} data-testid="mock-toggle" />
        模拟模式
      </label>
      <span className="lw-help">
        <button type="button" className="lw-help__btn" aria-label="什么是模拟模式？" aria-describedby="mock-help" data-testid="mock-help">?</button>
        <span role="tooltip" id="mock-help" className="lw-help__tip">不用接板子也能上完整节课：编译、烧录、串口读数都由电脑模拟。接上真板子时把它关掉。</span>
      </span>
      <div className="lw-top__spacer" />
      <div className="lw-steps-bar" data-lw-avoid="" role="group" aria-label="工具链步骤：板型、连接、编译、烧录">
        <ActionButton action={board} anchor="topbar.board" icon="1" highlighted={highlight === 'topbar.board'} />
        <span className="lw-arrow" aria-hidden="true">→</span>
        <ActionButton action={connect} anchor="topbar.connect" icon="2" highlighted={highlight === 'topbar.connect'} />
        <span className="lw-arrow" aria-hidden="true">→</span>
        <ActionButton action={compile} anchor="topbar.compile" icon="3" highlighted={highlight === 'topbar.compile'} />
        <span className="lw-arrow" aria-hidden="true">→</span>
        <ActionButton action={flash} anchor="topbar.flash" primary icon="4" highlighted={highlight === 'topbar.flash'} />
      </div>
      {detectNote && <span className="lw-detect" role="status" data-testid="board-detect-note" title={detectNote}>🔌 {detectNote}</span>}
    </header>
  );
}
