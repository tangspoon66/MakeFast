import { useCallback, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AgentWidget } from '../AgentWidget';
import type { AgentState } from '../AgentWidget';
import { Check, RotateCcw, X } from 'lucide-react';
import type { AgentProposal } from '../../api/learningClient';

export interface AgentOverlayProps {
  state: AgentState;
  message: string;
  targetId?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onAsk?: (question: string) => void;
  onRequestProposal?: () => void;
  proposalBusy?: boolean;
  proposal?: AgentProposal | null;
  onApplyProposal?: () => void;
  onUndoProposal?: () => void;
  onDismissProposal?: () => void;
  conversations?: Array<{ conversation_id: string; title: string }>;
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: () => void;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AgentAnchorProps {
  id: string;
  children: ReactNode;
  className?: string;
}

/** Marks a real control as a possible target for the Agent character. */
export function AgentAnchor({ id, children, className = '' }: AgentAnchorProps) {
  return (
    <span data-agent-anchor={id} className={`agent-anchor ${className}`.trim()}>
      {children}
    </span>
  );
}

interface OverlayPosition {
  top: number;
  left: number;
}

/**
 * Positions the character beside the actual target control. If a target is
 * unavailable, the overlay remains in the workbench flow instead of pointing
 * at an invented control.
 */
export function AgentOverlay({ state, message, targetId, expanded = true, onToggle, onAsk, onRequestProposal, proposalBusy, proposal, onApplyProposal, onUndoProposal, onDismissProposal, conversations, activeConversationId, onSelectConversation, onNewConversation, onDeleteConversation, messages }: AgentOverlayProps) {
  const [position, setPosition] = useState<OverlayPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!targetId || typeof document === 'undefined') {
      setPosition(null);
      return;
    }
    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-agent-anchor]'))
      .find((element) => element.dataset.agentAnchor === targetId);
    if (!target) {
      setPosition(null);
      return;
    }
    let rect = target.getBoundingClientRect();
    const viewportPadding = 16;
    const targetOutsideViewport = rect.top < viewportPadding || rect.bottom > window.innerHeight - viewportPadding;
    if (targetOutsideViewport && typeof target.scrollIntoView === 'function') {
      // A guide that points below a clipped workbench is not useful. Reveal
      // the real control first, then position the character beside it.
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      rect = target.getBoundingClientRect();
    }
    const gap = 12;
    const left = Math.max(8, Math.min(rect.right + gap, window.innerWidth - 380));
    const top = Math.max(8, Math.min(rect.top - 8, window.innerHeight - 220));
    setPosition({ top, left });
  }, [targetId]);

  useLayoutEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  const style = position ? { top: position.top, left: position.left } : undefined;
  return (
    <div
      className={`agent-overlay z-30 ${position ? 'agent-overlay--anchored' : 'agent-overlay--floating'}`}
      style={style}
      data-agent-target={targetId || undefined}
      data-testid="agent-overlay"
      aria-label="MakeFast Agent 指引"
    >
      <AgentWidget state={state} message={message} expanded={expanded} onToggle={onToggle} onAsk={onAsk}
        onRequestProposal={onRequestProposal} proposalBusy={proposalBusy}
        conversations={conversations} activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation} onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation} messages={messages} />
      {proposal && <section className="agent-proposal-card" aria-label="Agent 修改建议">
        <header><strong>修改建议预览</strong><button type="button" onClick={onDismissProposal} aria-label="关闭修改建议" title="关闭"><X size={15} /></button></header>
        <p>{proposal.summary}</p>
        <span className="agent-proposal-card__status">{proposal.roundtrip_status === 'code_only' ? '仅代码可用，不能安全转回积木' : '可以继续检查积木与代码'}</span>
        {proposal.hardware_assumptions.length > 0 && <div className="agent-proposal-card__list"><strong>需要你确认</strong><ul>{proposal.hardware_assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        <pre aria-label="建议代码预览">{proposal.proposed_code}</pre>
        <footer>{proposal.status === 'preview' && <><button type="button" onClick={onApplyProposal}><Check size={15} />应用建议</button><button type="button" onClick={onDismissProposal}><X size={15} />暂不应用</button></>}{proposal.status === 'applied' && <button type="button" onClick={onUndoProposal}><RotateCcw size={15} />撤销这次应用</button>}{proposal.status === 'undone' && <span>已撤销，项目已恢复</span>}</footer>
      </section>}
    </div>
  );
}
