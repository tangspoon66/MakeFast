/**
 * 课程 Agent「小铁猫」（R10）：不再固定右下角。
 * - 引导时：锚定在当前要操作的元素旁（AgentCoach：聚光灯 + 箭头 + flip/shift），
 * - 不引导时：收成右下角召唤按钮，点开是只谈本课的聊天面板，
 * - 出错时：锚定在出错按钮旁给诊断 +「带我去」，卡住时：在目标旁问“要不要帮忙”。
 */
import { AGE_TIERS, effectiveTier, tierText, useAgeTier } from '../../lesson/ageTier';
import { stepCopy } from '../../lesson/tierCopy';
import { useEffect, useState, type ReactElement } from 'react';
import '../../styles/agent-coach.css';
import type { AgentState } from '../../lesson/agentMachine';
import type { GuideStep } from '../../lesson/guideScript';
import { WRAP_UP_MESSAGE } from '../../lesson/guideScript';
import type { Diagnosis } from '../../lesson/learner/diagnose';
import type { StuckResult } from '../../lesson/learner/stuck';
import { Mascot, type MascotMood } from './Mascot';
import { AgentCoach } from './agent/AgentCoach';
import { AgentChatPanel, type ChatContextPayload } from './agent/AgentChatPanel';
import { FixHintCard, type FixMode } from './agent/FixHintCard';
import type { FixSuggestion } from '../../lesson/agent/fixes';
import { useAgentNav } from '../../lesson/agent/anchors';

export interface FixView {
  fix: FixSuggestion; mode: FixMode; anchor: string;
  onSelf: () => void; onApply: () => void; onUndo: () => void; onClose: () => void; onRecompile?: () => void;
  reasoning?: string[];
}

export interface CoachReaction { text: string; tone: 'info' | 'success' | 'warning'; anchor?: string }

interface LessonAgentDockProps {
  state: AgentState;
  step: GuideStep;
  stepIndex: number;
  stepCount: number;
  stepDone: boolean;
  bottomOffset: number;
  warning?: string | null;
  mood?: MascotMood;
  reaction?: CoachReaction | null;
  /** 当前步骤要锚定的元素（data-lw-anchor 或 pin.D0） */
  stepAnchor: string;
  diagnosis?: Diagnosis | null;
  stuck?: StuckResult | null;
  chatContext: ChatContextPayload;
  suggestions: string[];
  onPrev: () => void;
  onNext: () => void;
  onAskHelp: () => void;
  onCloseHelp: () => void;
  onOpenQuiz: () => void;
  quizLabel: string;
  /** 「带我去」：聚焦并高亮目标 */
  onGoTo: (anchor: string) => void;
  /** 提示梯度：返回本次提示文本 */
  onHint: () => string;
  onDismissStep: () => void;
  onDismissStuck: () => void;
  onAcceptStuck: () => void;
  onChatAsk?: (q: string, category: string) => void;
  /** 当前要给孩子看的修改建议（代码行 / 积木） */
  fix?: FixView | null;
  /** 聊天回答里的结构化修改建议 → 页面校验后展示 */
  onShowFix?: (raw: unknown) => boolean;
  /** 发聊天时附带的实时 UI 快照 */
  uiSnapshot?: () => unknown;
  /** 进课第一步时小铁猫主动打招呼（说清楚它会看什么、会怎么帮） */
  greeting?: string;
}

export function GuideStepCard({ step, stepIndex, stepCount, stepDone, onPrev, onNext, onCollapse, greeting }: {
  step: GuideStep; stepIndex: number; stepCount: number; stepDone: boolean; greeting?: string;
  onPrev: () => void; onNext: () => void; onCollapse?: () => void;
}) {
  const chosen = useAgeTier((s) => s.tier);
  const setTier = useAgeTier((s) => s.setTier);
  const tier = effectiveTier(chosen);
  const c = stepCopy(step, tier);
  const why = <div className="lw-card__row lw-card__row--why"><dt>💡 为什么</dt><dd>{c.why}</dd></div>;
  return (
    <section className="lw-card" aria-label="课程引导" data-testid="guide-step-card" data-lw-anchor="guide.card" data-tier={tier}>
      <div className="lw-card__eyebrow">
        <span>第 {stepIndex + 1} / {stepCount} 步 {stepDone && <span className="lw-pill lw-pill--success">已完成</span>}</span>
        {onCollapse && <button type="button" className="lw-card__close" onClick={onCollapse} aria-label="收起引导">×</button>}
      </div>
      {!chosen && (
        <div className="lw-tier-pick" data-testid="age-tier-chooser" role="group" aria-label="选择年级">
          <span>你在上几年级？我换成适合你的说法：</span>
          <div>{AGE_TIERS.map((t) => <button key={t.id} type="button" className="lw-btn lw-btn--sm" onClick={() => setTier(t.id)} data-testid={`age-tier-${t.id}`}>{t.emoji} {t.label}</button>)}</div>
        </div>
      )}
      {greeting && <p className="lw-card__greet" data-testid="agent-greeting">🐱 {greeting}</p>}
      <h4>{step.title}</h4>
      <dl>
        <div className="lw-card__row lw-card__row--do"><dt>👉 现在做</dt><dd>{c.do}</dd></div>
        {tier === 'high' ? <details className="lw-card__whyfold" data-testid="why-folded"><summary>💡 为什么</summary><dd>{c.why}</dd></details> : why}
        <div className="lw-card__row lw-card__row--ok"><dt>✅ 成功时</dt><dd>{c.success}</dd></div>
      </dl>
      <div className="lw-card__actions">
        <button type="button" className="lw-btn lw-btn--sm lw-btn--ghost" onClick={onPrev} disabled={stepIndex === 0}>上一步</button>
        <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={onNext} disabled={stepIndex >= stepCount - 1}>
          {stepDone ? '下一步' : '我做好了，下一步'}
        </button>
      </div>
    </section>
  );
}

type View = 'step' | 'collapsed' | 'chat';

export function LessonAgentDock(props: LessonAgentDockProps) {
  const { state, step, stepIndex, stepCount, stepDone, bottomOffset, warning, diagnosis, stuck } = props;
  const [view, setView] = useState<View>('step');
  const [diagDismissed, setDiagDismissed] = useState<string | null>(null);
  const [reactionDismissed, setReactionDismissed] = useState<string | null>(null);
  const nav = useAgentNav((st) => st.target);
  const tier = effectiveTier(useAgeTier((s) => s.tier));
  const T = (x?: string | null) => tierText(x ?? "", tier);
  const clearNav = useAgentNav((st) => st.clear);

  // 步骤开始 → 重新弹出锚定步骤卡（除非正在聊天）
  const [seen, setSeen] = useState({ step: step.id, state });
  if (seen.step !== step.id || seen.state !== state) {
    if (seen.step !== step.id || state === 'WRAP_UP') setView((v) => (v === 'chat' ? v : 'step'));
    setSeen({ step: step.id, state });
  }
  useEffect(() => { clearNav(); }, [step.id, clearNav]);

  const mood: MascotMood = props.mood ?? (warning ? 'warning' : state === 'WRAP_UP' ? 'success' : state === 'GUIDING' ? 'guiding' : state === 'QUIET_HELP' ? 'thinking' : 'idle');
  const summonBottom = bottomOffset;
  // 召唤按钮上的短气泡：处理中 / 成功 / 提醒时冒一句；CSS 动画 2.6s 后自动淡出
  const bubbleText = mood === 'processing' ? '我在帮你处理…' : mood === 'success' ? '成功啦！🎉' : mood === 'warning' ? '这里要注意哦' : null;

  if (state === 'IDLE') {
    return <div className="lw-agent" style={{ bottom: summonBottom }} data-agent-state={state} data-testid="lesson-agent"><Mascot mood="idle" decorative /></div>;
  }

  const diagKey = diagnosis ? `${diagnosis.category}:${warning}` : null;
  const showDiag = !!diagnosis && diagnosis.category !== 'unknown' && diagKey !== diagDismissed && state !== 'QUIET_HELP' && view !== 'chat';
  const reactKey = props.reaction ? props.reaction.text : null;
  const showReaction = !!props.reaction && !showDiag && reactKey !== reactionDismissed && view !== 'chat' && props.reaction.tone !== 'warning';
  const showStuck = !!stuck?.stuck && !!stuck.message && !showDiag && view !== 'chat' && state === 'GUIDING';

  const fix = props.fix;
  let coach: ReactElement | null = null;
  if (nav) {
    coach = (
      <AgentCoach key={`nav-${nav.id}-${nav.nonce}`} anchor={nav.id} mood={nav.tone === 'warning' ? 'warning' : 'guiding'} tone={nav.tone ?? 'info'} onClose={clearNav} testId="agent-nav" label="带你去">
        {nav.title && <h4>👉 {nav.title}</h4>}
        {nav.text && <p style={{ margin: '0 0 6px', whiteSpace: 'pre-line' }}>{T(nav.text)}</p>}
        <div className="ac-actions"><button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={clearNav}>知道了</button></div>
      </AgentCoach>
    );
  } else if (fix && view !== 'chat') {
    coach = (
      <AgentCoach key={`fix-${fix.fix.id}-${fix.mode === 'resolved' ? 'r' : ''}`} anchor={fix.anchor} mood={fix.mode === 'resolved' ? 'success' : fix.mode === 'self' ? 'listening' : 'explaining'}
        tone={fix.mode === 'resolved' ? 'success' : 'warning'} stars={fix.mode === 'resolved'} onClose={fix.onClose} testId="agent-fix" label="小铁猫修改建议">
        <FixHintCard fix={fix.fix} mode={fix.mode} onSelf={fix.onSelf} onApply={fix.onApply} onUndo={fix.onUndo} onClose={fix.onClose} onRecompile={fix.onRecompile} reasoning={fix.reasoning} />
      </AgentCoach>
    );
  } else if (state === 'QUIET_HELP' && view !== 'chat') {
    coach = (
      <AgentCoach anchor={diagnosis?.anchor && diagnosis.category !== 'unknown' ? diagnosis.anchor : props.stepAnchor} mood="thinking" onClose={props.onCloseHelp} testId="quiet-help-card" label="小铁猫">
        <h4>卡住了？别急 🙂</h4>
        <p style={{ margin: '0 0 6px' }}>你现在在「{step.title}」。{warning ? '我帮你看了刚才的问题：' : `这一步要做的是：${stepCopy(step, tier).do}`}</p>
        {warning && <p className="lw-help-explain" data-testid="help-explain">{T(warning)}</p>}
        {diagnosis && diagnosis.category !== 'unknown' && <ol>{diagnosis.steps.slice(0, tier === 'high' ? 2 : 3).map((s) => <li key={s}>{T(s)}</li>)}</ol>}
        {tier !== 'high' && <p style={{ margin: 0, fontSize: 13 }}><b>为什么？</b>{stepCopy(step, tier).why}</p>}
        <div className="ac-actions">
          {diagnosis && diagnosis.category !== 'unknown' && <button type="button" className="lw-btn lw-btn--sm" onClick={() => props.onGoTo(diagnosis.anchor)}>带我去「{diagnosis.anchorLabel}」</button>}
          <button type="button" className="lw-btn lw-btn--sm" onClick={() => { props.onCloseHelp(); setView('chat'); }}>问问小铁猫</button>
          <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={props.onCloseHelp}>继续上课</button>
        </div>
      </AgentCoach>
    );
  } else if (showDiag && diagnosis) {
    coach = (
      <AgentCoach key={diagKey!} anchor={diagnosis.anchor} mood="warning" tone="warning" onClose={() => setDiagDismissed(diagKey)} testId="agent-diagnosis" label="小铁猫诊断">
        <h4>🔧 {diagnosis.title}</h4>
        {warning && <p className="lw-help-explain">{T(warning)}</p>}
        <ol>{diagnosis.steps.slice(0, tier === 'high' ? 2 : 3).map((s) => <li key={s}>{T(s)}</li>)}</ol>
        <div className="ac-actions">
          <button type="button" className="lw-btn lw-btn--sm" onClick={() => setView('chat')}>还是不懂，问问我</button>
          <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={() => props.onGoTo(diagnosis.anchor)}>带我去「{diagnosis.anchorLabel}」</button>
        </div>
      </AgentCoach>
    );
  } else if (showStuck && stuck) {
    coach = (
      <AgentCoach key={`stuck-${stuck.reason}`} anchor={props.stepAnchor} mood="explaining" onClose={props.onDismissStuck} testId="agent-stuck" label="需要帮忙吗">
        <p style={{ margin: '0 0 4px' }}>{T(stuck.message)}</p>
        <div className="ac-actions">
          <button type="button" className="lw-btn lw-btn--sm lw-btn--ghost" onClick={props.onDismissStuck}>我自己再试试</button>
          <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={() => { props.onAcceptStuck(); setView('chat'); }}>给我提示</button>
        </div>
      </AgentCoach>
    );
  } else if (showReaction && props.reaction && view !== 'step') {
    coach = (
      <AgentCoach key={reactKey!} anchor={props.reaction.anchor || props.stepAnchor} mood={mood} tone={props.reaction.tone} spotlight={false} onClose={() => setReactionDismissed(reactKey)} testId="agent-reaction" label="小铁猫">
        <p style={{ margin: 0 }} role="status" aria-live="polite">{T(props.reaction.text)}</p>
      </AgentCoach>
    );
  } else if (view === 'step' && state === 'GUIDING') {
    coach = (
      <AgentCoach key={`step-${step.id}`} anchor={props.stepAnchor} mood={mood} onClose={() => { setView('collapsed'); props.onDismissStep(); }} label="课程引导">
        {props.reaction && <p className={`lw-reaction lw-reaction--${props.reaction.tone}`} role="status" data-testid="agent-reaction" style={{ margin: '0 0 8px', maxWidth: 'none' }}>{T(props.reaction.text)}</p>}
        <GuideStepCard step={step} stepIndex={stepIndex} stepCount={stepCount} stepDone={stepDone} onPrev={props.onPrev} onNext={props.onNext} greeting={props.greeting} />
      </AgentCoach>
    );
  } else if (view === 'step' && state === 'WRAP_UP') {
    coach = (
      <AgentCoach anchor="serial" mood="success" tone="success" onClose={() => setView('collapsed')} testId="wrap-up-card" label="主线完成">
        <h4>{WRAP_UP_MESSAGE.title}</h4>
        <p style={{ margin: 0 }}>{T(WRAP_UP_MESSAGE.body)}</p>
        <div className="ac-actions"><button type="button" className="lw-btn lw-btn--primary lw-btn--sm" onClick={props.onOpenQuiz}>{props.quizLabel}</button></div>
      </AgentCoach>
    );
  }

  const opener = warning ? `你在「${step.title}」，刚才遇到了一点问题，要我解释一下吗？` : `你在第 ${stepIndex + 1} 步「${step.title}」。有关这节课的问题都可以问我哦 🐱`;
  return (
    <div data-agent-state={state} data-testid="lesson-agent" data-view={view}>
      {coach}
      {view === 'chat' ? (
        <>
          <AgentChatPanel bottom={summonBottom} context={props.chatContext} suggestions={props.suggestions} opener={opener}
            onClose={() => { setView('collapsed'); if (state === 'QUIET_HELP') props.onCloseHelp(); }} onHint={props.onHint} onAsk={props.onChatAsk}
            onGoTo={(a) => { props.onGoTo(a); }} onShowFix={props.onShowFix} uiSnapshot={props.uiSnapshot} />
        </>
      ) : (
        <button type="button" className="ac-summon" style={{ bottom: summonBottom }} data-lw-anchor="agent.summon" data-testid="agent-summon"
          aria-label="问问小铁猫" onClick={() => setView('chat')}>
          <Mascot mood={coach ? 'idle' : mood} decorative size={58} bubble={coach ? null : bubbleText} />
          {warning && <span className="ac-summon__dot" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
