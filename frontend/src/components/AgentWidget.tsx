import { useState } from 'react';
import type { FormEvent } from 'react';
import { FileDiff, MessageCircle, Plus, Send, Sparkles, Trash2 } from 'lucide-react';

export type AgentState =
  | 'standby'
  | 'guide'
  | 'explain'
  | 'listening'
  | 'thinking'
  | 'success'
  | 'warning'
  | 'waiting';

interface AgentWidgetProps {
  state: AgentState;
  message: string;
  compact?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAsk?: (question: string) => void;
  onRequestProposal?: () => void;
  proposalBusy?: boolean;
  conversations?: Array<{ conversation_id: string; title: string }>;
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: () => void;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const stateLabels: Record<AgentState, string> = {
  standby: '待机',
  guide: '指引',
  explain: '讲解',
  listening: '聆听',
  thinking: '思考',
  success: '成功',
  warning: '警告',
  waiting: '等待确认',
};

// The reference sheet is split into per-state project assets. Waiting reuses
// the listening pose until a dedicated confirmation pose is supplied.
const stateImages: Record<AgentState, string> = {
  standby: '/agent/mascot/idle.webp',
  guide: '/agent/mascot/guiding.webp',
  explain: '/agent/mascot/explaining.webp',
  listening: '/agent/mascot/listening.webp',
  thinking: '/agent/mascot/thinking.webp',
  success: '/agent/mascot/success.webp',
  warning: '/agent/mascot/warning.webp',
  waiting: '/agent/mascot/listening.webp',
};

export function AgentWidget({
  state,
  message,
  compact = false,
  expanded = false,
  onToggle,
  onAsk,
  onRequestProposal,
  proposalBusy = false,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  messages = [],
}: AgentWidgetProps) {
  const [question, setQuestion] = useState('');

  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    if (!value) return;
    onAsk?.(value);
    setQuestion('');
  };

  return (
    <div className={`agent-widget agent-widget--${state} ${compact ? 'agent-widget--compact' : ''} ${expanded ? 'agent-widget--expanded' : ''}`}>
      <button
        type="button"
        className="agent-avatar"
        onClick={onToggle}
        aria-label={`召唤 MakeFast Agent，当前状态：${stateLabels[state]}`}
        title="召唤 MakeFast Agent"
      >
        <img src={stateImages[state]} alt="" className="agent-avatar__image" />
      </button>

      {!compact && expanded && (
        <div className="agent-bubble">
          <div className="agent-bubble__header">
            <span className="agent-bubble__title"><Sparkles size={14} /> MakeFast Agent</span>
            <span className="agent-bubble__state">{stateLabels[state]}</span>
          </div>
          {onSelectConversation && <div className="agent-conversations">
            <select aria-label="切换学习对话" value={activeConversationId || ''} onChange={(event) => onSelectConversation(event.target.value)}>
              <option value="">新对话</option>
              {conversations.map((conversation) => <option key={conversation.conversation_id} value={conversation.conversation_id}>{conversation.title}</option>)}
            </select>
            <button type="button" aria-label="新建对话" title="新建对话" onClick={onNewConversation}><Plus size={15} /></button>
            {activeConversationId && onDeleteConversation && <button type="button" aria-label="删除当前对话" title="删除当前对话" onClick={onDeleteConversation}><Trash2 size={15} /></button>}
          </div>}
          <p className="agent-bubble__message" role="status" aria-live="polite">{message}</p>
          {messages.length > 0 && <div className="agent-history" aria-label="对话记录">
            {messages.slice(-8).map((item, index) => <p className={`agent-history__message agent-history__message--${item.role}`} key={`${index}-${item.role}`}>
              <strong>{item.role === 'user' ? '你' : 'Agent'}</strong>{item.content}
            </p>)}
          </div>}
          <form className="agent-bubble__form" onSubmit={submitQuestion}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="继续问我…"
              aria-label="继续询问 Agent"
            />
            <button type="submit" aria-label="发送问题" title="发送问题">
              <Send size={15} />
            </button>
          </form>
          {onRequestProposal && <button type="button" className="agent-proposal-trigger" onClick={onRequestProposal} disabled={proposalBusy}>
            <FileDiff size={14} /> {proposalBusy ? '正在准备建议…' : '为当前代码准备修改建议'}
          </button>}
          <div className="agent-bubble__hint"><MessageCircle size={12} /> 可以问“下一步做什么？”</div>
        </div>
      )}
    </div>
  );
}
