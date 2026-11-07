/**
 * 课程聊天面板（R10 §6、§8）：只谈本课与 MakeFast；快捷问题 chips；
 * 先走前端守卫，再请求后端 /api/course-agent/chat（锁定课程上下文），失败时离线 FAQ。
 */
import { learnerId } from '../../../lesson/telemetry';
import { useEffect, useRef, useState } from 'react';
import { localGuard, faqAnswer, type FaqItem } from '../../../lesson/agent/localGuard';
import { Mascot, type MascotMood } from '../Mascot';
import { isKnownAnchor, describeAnchor } from '../../../lesson/agent/anchors';

export interface ChatContextPayload {
  course_id: string; course_title: string;
  step: { id: string; title: string; do: string; why: string; success: string };
  board_summary?: string; wiring_summary?: string; validation?: string[];
  code_excerpt?: string; serial_tail?: string[]; last_error?: string | null;
  faq?: FaqItem[]; hint_level?: string;
  /** 年龄档：low 小学 / mid 初中 / high 高中及以上 */
  age_tier?: "low" | "mid" | "high";
  ui_snapshot?: unknown;
  learner_id?: string;
}
export interface GotoAction { anchor: string; label: string }
interface Msg { role: 'user' | 'assistant'; content: string; source?: string; category?: string; actions?: GotoAction[]; fixes?: unknown[]; trace?: string[]; streaming?: boolean }

/** 回答里提到的界面元素 → 「带我去」chips（离线也能用；后端给的 actions 优先） */
const KEYWORD_ANCHORS: [RegExp, string, string][] = [
  [/D0|DATA|数据脚/i, 'pin.D0', 'D0 引脚'],
  [/D1|蜂鸣器.{0,4}(S|信号)/, 'pin.D1', 'D1 引脚'],
  [/连线图|接线|恢复.*接法/, 'wiring.panel', '连线图'],
  [/编译/, 'topbar.compile', '「编译」按钮'],
  [/烧录|BOOT/i, 'topbar.flash', '「烧录」按钮'],
  [/连接|USB|端口/i, 'topbar.connect', '「连接」按钮'],
  [/串口|115200|nan/i, 'serial', '串口栏'],
  [/模拟模式/, 'topbar.mock', '「模拟模式」开关'],
  [/积木/, 'editor.tab.blocks', '「积木」标签'],
  [/第\s*(\d+)\s*行/, 'code.line.$1', '第 $1 行'],
];
function inferGotoActions(text: string, max = 3): GotoAction[] {
  const out: GotoAction[] = [];
  for (const [rx, anchor, label] of KEYWORD_ANCHORS) {
    const m = text.match(rx);
    if (!m) continue;
    const a = anchor.replace('$1', m[1] ?? ''); const l = label.replace('$1', m[1] ?? '');
    if (!out.some((o) => o.anchor === a)) out.push({ anchor: a, label: l });
    if (out.length >= max) break;
  }
  return out;
}
function sanitizeActions(raw: unknown): GotoAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 4).flatMap((x) => {
    const o = x as { anchor?: unknown; label?: unknown };
    if (typeof o?.anchor !== 'string' || !isKnownAnchor(o.anchor)) return [];
    const label = typeof o.label === 'string' && o.label.length <= 30 ? o.label : describeAnchor(o.anchor)?.label || o.anchor;
    return [{ anchor: o.anchor, label }];
  });
}

interface Props {
  context: ChatContextPayload;
  suggestions: string[];
  opener: string;
  onClose: () => void;
  /** 「给我一点提示」走提示梯度（由页面决定级别与内容） */
  onHint: () => string;
  onAsk?: (q: string, category: string) => void;
  bottom?: number;
  /** 「带我去」：Agent 导航到界面元素 */
  onGoTo?: (anchor: string) => void;
  /** 回答带结构化修改建议时：交给页面校验并展示，返回是否可用 */
  onShowFix?: (raw: unknown) => boolean;
  uiSnapshot?: () => unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 服务端 JSON，逐字段校验
function fromServer(d: any): Msg {
  const actions = sanitizeActions(d.actions);
  return { role: 'assistant', content: String(d.reply ?? ''), source: d.source, category: d.category,
    actions: actions.length ? actions : d.category === 'on_topic' ? inferGotoActions(d.reply || '') : [],
    fixes: Array.isArray(d.fixes) ? d.fixes : undefined,
    trace: Array.isArray(d.trace) ? d.trace.filter((x: unknown) => typeof x === 'string').slice(0, 10).map((x: string) => x.slice(0, 120)) : undefined };
}

/** 流式：边收边显示（DeepSeek 打字效果）；任何问题都退回普通请求 */
async function askCourseAgentStream(message: string, history: Msg[], context: ChatContextPayload, onDelta: (text: string) => void): Promise<Msg> {
  const g = localGuard(message, `要不要继续「${context.step.title}」？`);
  if (!g.allowed) return askCourseAgent(message, history, context);
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    const res = await fetch('/api/course-agent/chat/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ message, history: history.slice(-10).map(({ role, content }) => ({ role, content })), context }),
    });
    if (!res.ok || !res.body || !(res.headers.get('content-type') || '').includes('text/event-stream')) { clearTimeout(t); throw new Error(String(res.status)); }
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let buf = ''; let shown = ''; let done: Msg | null = null;
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) !== -1) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
        if (!line.startsWith('data:')) continue;
        let ev: { type?: string; text?: string; data?: unknown };
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'delta' && typeof ev.text === 'string') { shown += ev.text; onDelta(shown); }
        else if (ev.type === 'done' && ev.data) done = fromServer(ev.data);
      }
    }
    clearTimeout(t);
    if (done) return done;
    throw new Error('no done');
  } catch {
    return askCourseAgent(message, history, context);
  }
}

async function askCourseAgent(message: string, history: Msg[], context: ChatContextPayload): Promise<Msg> {
  const g = localGuard(message, `要不要继续「${context.step.title}」？`);
  if (!g.allowed) return { role: 'assistant', content: g.reply!, source: 'guard', category: g.category, trace: ['🛡️ 判断：这个问题不在本课范围，或不安全，所以不回答（本机安全规则，没有发给服务器）'] };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch('/api/course-agent/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ message, history: history.slice(-10).map(({ role, content }) => ({ role, content })), context }),
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    return fromServer(d);
  } catch {
    const a = faqAnswer(message, context.faq || []);
    const content = a ?? `我们在「${context.step.title}」这一步。现在要做的是：${context.step.do} 💡 为什么：${context.step.why}`;
    return { role: 'assistant', source: 'offline', category: 'on_topic', content, actions: inferGotoActions(`${message} ${content}`),
      trace: [`👀 看了：你正在做「${context.step.title}」这一步`, a ? '💬 回答来源：本课知识库（服务器没连上，用的是本机离线答案）' : '💬 服务器没连上：先把这一步的「现在做 / 为什么」告诉你'] };
  }
}

export function AgentChatPanel({ context, suggestions, opener, onClose, onHint, onAsk, bottom = 120, onGoTo, onShowFix, uiSnapshot }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: opener }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo?.({ top: 1e6 }); }, [msgs, busy]);

  const send = async (q: string) => {
    const text = q.trim(); if (!text || busy) return;
    setInput('');
    if (text === '给我一点提示') { setMsgs((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: onHint(), source: 'ladder' }]); return; }
    const next = [...msgs, { role: 'user' as const, content: text }];
    setMsgs(next); setBusy(true);
    let snap: unknown;
    try { snap = uiSnapshot?.(); } catch { snap = undefined; }
    const ctx = { ...context, learner_id: learnerId(), ...(snap ? { ui_snapshot: snap } : {}) };
    let streamed = false;
    const r = await askCourseAgentStream(text, next, ctx, (partial) => {
      // 第一段到达：换成正在打字的气泡
      setMsgs((m) => (streamed ? [...m.slice(0, -1), { role: 'assistant', content: partial, streaming: true }] : [...m, { role: 'assistant', content: partial, streaming: true }]));
      streamed = true;
    });
    onAsk?.(text, r.category || 'on_topic');
    setMsgs((m) => (streamed ? [...m.slice(0, -1), r] : [...m, r])); setBusy(false);
  };

  const mood: MascotMood = busy ? 'thinking' : msgs[msgs.length - 1]?.category && msgs[msgs.length - 1].category !== 'on_topic' ? 'warning' : 'explaining';
  return (
    <section className="ac-chat" style={{ bottom, maxHeight: `calc(100vh - ${bottom + 70}px)` }} role="dialog" aria-label="问问小铁猫" data-testid="agent-chat">
      <header className="ac-chat__head">
        <Mascot mood={mood} decorative size={44} />
        <div><b>问问小铁猫</b><small>只回答本课和 MakeFast 的问题 · 当前：{context.step.title}</small></div>
        <button type="button" className="ac-close" onClick={onClose} aria-label="收起聊天">×</button>
      </header>
      <div className="ac-chat__list" ref={listRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`ac-msg ac-msg--${m.role} ${m.category && m.category !== 'on_topic' ? 'ac-msg--refusal' : ''}`} data-testid={`chat-msg-${m.role}`} data-category={m.category}>
            {m.content}
            {m.streaming && <span className="ac-caret" aria-hidden="true">▍</span>}
            {m.source === 'offline' && <em className="ac-msg__tag">离线回答</em>}
            {m.source === 'llm' && <em className="ac-msg__tag">AI 回答</em>}
            {m.role === 'assistant' && m.trace && m.trace.length > 0 && (
              <details className="ac-think" data-testid="chat-trace">
                <summary>🧠 小铁猫是怎么想的</summary>
                <ol>{m.trace.map((x) => <li key={x}>{x}</li>)}</ol>
              </details>
            )}
            {m.role === 'assistant' && ((m.actions && m.actions.length > 0) || (m.fixes && m.fixes.length > 0)) && (
              <div className="ac-goto-chips">
                {m.fixes && m.fixes.length > 0 && onShowFix && (
                  <button type="button" className="ac-goto-chip" data-testid="chat-fix-chip" onClick={() => { if (!onShowFix(m.fixes)) setMsgs((x) => [...x, { role: 'assistant', content: '这条修改建议对不上你现在的程序了（可能已经改过啦），再编译一次看看？', source: 'ladder' }]); }}>💡 看看要改哪里</button>
                )}
                {onGoTo && (m.actions || []).map((a) => (
                  <button key={a.anchor} type="button" className="ac-goto-chip" data-testid="chat-goto-chip" data-anchor={a.anchor} onClick={() => onGoTo(a.anchor)}>👉 带我去：{a.label}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && !msgs[msgs.length - 1]?.streaming && <div className="ac-msg ac-msg--assistant ac-msg--typing">小铁猫在想…（在看你的步骤、程序和串口）</div>}
      </div>
      <div className="ac-chips">
        {['给我一点提示', ...suggestions].slice(0, 4).map((s) => <button key={s} type="button" className="ac-chip" onClick={() => void send(s)}>{s}</button>)}
      </div>
      <form className="ac-chat__input" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input value={input} maxLength={200} onChange={(e) => setInput(e.target.value)} placeholder="问问这节课的问题…" aria-label="输入问题" />
        <button type="submit" className="lw-btn lw-btn--sm lw-btn--blue" disabled={!input.trim() || busy}>发送</button>
      </form>
    </section>
  );
}
