/**
 * 代码 / 积木修改建议卡（C4）：贴在出问题的那一行 / 那块积木旁边，
 * 显示「改前 → 改后」+ 为什么；「我自己改」会盯着代码，改好了庆祝；「帮我改」需要再确认一次，改完可一键撤销。
 */
import { useState } from 'react';
import { effectiveTier, tierText, useAgeTier } from '../../../lesson/ageTier';
import type { FixSuggestion } from '../../../lesson/agent/fixes';
import { pinLabel } from '../../../lesson/agent/fixes';

export type FixMode = 'offer' | 'self' | 'applied' | 'resolved';

interface Props {
  fix: FixSuggestion;
  mode: FixMode;
  onSelf: () => void;
  onApply: () => void;
  onUndo: () => void;
  onClose: () => void;
  onRecompile?: () => void;
  /** 感知 → 诊断 → 定位 → 建议（透明可解释） */
  reasoning?: string[];
}

function show(fix: FixSuggestion, v: string) {
  if (fix.target === 'block' && fix.field === 'PIN') return pinLabel(v);
  return v || '（空行）';
}

export function FixHintCard({ fix, mode, onSelf, onApply, onUndo, onClose, onRecompile, reasoning }: Props) {
  const [confirming, setConfirming] = useState(false);
  const tier = effectiveTier(useAgeTier((st) => st.tier));
  const why = tierText(fix.why, tier);
  const where = fix.target === 'code_line' ? (fix.insert ? `在第 ${fix.line} 行加一行` : `第 ${fix.line} 行`) : '这块积木';

  if (mode === 'resolved') {
    return (
      <div data-testid="fix-resolved">
        <h4>🎉 你自己改好了！</h4>
        <p style={{ margin: '0 0 6px' }}>{where}已经对了，真厉害。{fix.target === 'code_line' ? '再点一次「编译」看看吧。' : '程序已经跟着积木变了。'}</p>
        <div className="ac-actions">
          {onRecompile && fix.target === 'code_line' && <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={onRecompile}>去点「编译」</button>}
          <button type="button" className="lw-btn lw-btn--sm" onClick={onClose}>好的</button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="fix-card" data-fix-target={fix.target} data-fix-line={fix.line ?? ''} data-fix-block={fix.blockId ?? ''}>
      <h4>💡 {fix.title}</h4>
      <div className="fx-diff" aria-label="改前和改后">
        {!fix.insert && <div className="fx-diff__del"><b aria-hidden="true">− </b>{show(fix, fix.before)}</div>}
        <div className="fx-diff__add"><b aria-hidden="true">+ </b>{show(fix, fix.after)}</div>
      </div>
      {tier === 'high' ? <details className="fx-why"><summary>为什么</summary>{why}</details> : <p className="fx-why"><b>为什么：</b>{why}</p>}
      {reasoning && reasoning.length > 0 && (
        <details className="fx-reason" data-testid="fix-reasoning">
          <summary>🧠 小铁猫是怎么想的</summary>
          <ol>{reasoning.map((r) => <li key={r}>{r}</li>)}</ol>
        </details>
      )}
      {mode === 'self' && <p style={{ margin: '0 0 6px', fontSize: 13 }} data-testid="fix-watching">好，你来改！我在旁边看着，改好了我会告诉你 👀</p>}
      {mode === 'applied' && <p className="fx-done" style={{ margin: '0 0 6px' }} data-testid="fix-applied">✓ 已经帮你改好了{fix.target === 'code_line' ? '，再点「编译」试试' : ''}。不满意可以撤销。</p>}
      <div className="ac-actions">
        {mode === 'applied' ? (
          <>
            <button type="button" className="lw-btn lw-btn--sm" onClick={onUndo} data-testid="fix-undo">↶ 撤销</button>
            {onRecompile && fix.target === 'code_line' && <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={onRecompile}>去点「编译」</button>}
          </>
        ) : confirming ? (
          <>
            <span style={{ fontSize: 13 }}>确定让小铁猫改{where}吗？</span>
            <button type="button" className="lw-btn lw-btn--sm lw-btn--ghost" onClick={() => setConfirming(false)}>再想想</button>
            <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={() => { setConfirming(false); onApply(); }} data-testid="fix-confirm">确定，帮我改</button>
          </>
        ) : (
          <>
            <button type="button" className="lw-btn lw-btn--sm" onClick={onSelf} disabled={mode === 'self'} data-testid="fix-self">我自己改</button>
            <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={() => setConfirming(true)} data-testid="fix-apply">帮我改</button>
          </>
        )}
      </div>
    </div>
  );
}
