/** 评委演示导览：一步步（或自动播放）走完 感知 → 诊断 → 修复 → 成长卡 → 推荐 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEMO_STEPS } from '../../lesson/demo/demoScript';
import type { QuizSpec } from '../../lesson/quiz';
import '../../styles/demo-director.css';

export function DemoDirector({ code, quiz, onExit }: { code: string; quiz: QuizSpec; onExit: () => void }) {
  const [idx, setIdx] = useState(0); // 下一步要执行的序号
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [min, setMin] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const done = idx >= DEMO_STEPS.length;
  const shown = DEMO_STEPS[Math.min(Math.max(idx - (running ? 0 : 1), 0), DEMO_STEPS.length - 1)];

  const runOne = async (i: number) => {
    const s = DEMO_STEPS[i];
    if (!s) return false;
    ctl.current = new AbortController();
    setRunning(true); setErr(null);
    try {
      await s.run({ code, quiz, signal: ctl.current.signal });
      setIdx(i + 1);
      return true;
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr(`这一步没走通：${(e as Error).message}。可以点「再试一次」，或手动操作。`);
      return false;
    } finally { setRunning(false); }
  };

  useEffect(() => {
    if (!auto || running || done || err) return;
    const t = setTimeout(() => { void runOne(idx); }, idx === 0 ? 300 : 2600);
    return () => clearTimeout(t);
  }, [auto, running, done, err, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => ctl.current?.abort(), []);

  // 步骤栏展开时嵌进步骤栏顶部（不遮挡）；收起时退回左下角浮层
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const t = setInterval(() => setSlot((cur) => { const el = document.getElementById('lw-demo-slot'); return el === cur ? cur : el; }), 400);
    return () => clearInterval(t);
  }, []);

  const exit = () => { ctl.current?.abort(); onExit(); };
  const panel = (
    <aside className={`demo-dir ${slot ? 'demo-dir--docked' : ''} ${min ? 'demo-dir--min' : ''}`} role="region" aria-label="评委演示导览" data-testid="demo-director">
      <header>
        <b>🎬 评委演示 · 约 3 分钟</b>
        <span className="demo-dir__count">{Math.min(idx, DEMO_STEPS.length)} / {DEMO_STEPS.length}</span>
        <button type="button" onClick={() => setMin((v) => !v)} aria-label={min ? '展开演示导览' : '收起演示导览'}>{min ? '▴' : '▾'}</button>
      </header>
      {!min && (
        <>
          <ol className="demo-dir__steps">
            {DEMO_STEPS.map((s, i) => <li key={s.id} className={i < idx ? 'is-done' : i === idx && running ? 'is-now' : ''}>{s.title}</li>)}
          </ol>
          <p className="demo-dir__say" data-testid="demo-narration" aria-live="polite">
            {idx === 0 && !running ? '点「下一步」或「自动播放」。每一步都在真实界面上操作，小铁猫的反应全部来自真实逻辑。' : shown.narration}
          </p>
          {err && <p className="demo-dir__err" role="alert">{err}</p>}
          <div className="demo-dir__btns">
            {!done && <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" disabled={running} onClick={() => void runOne(idx)} data-testid="demo-next">{err ? '再试一次' : running ? '进行中…' : '下一步 ▶'}</button>}
            {!done && <button type="button" className="lw-btn lw-btn--sm" onClick={() => setAuto((v) => !v)} data-testid="demo-auto">{auto ? '⏸ 暂停' : '⏯ 自动播放'}</button>}
            {done && <a className="lw-btn lw-btn--sm lw-btn--blue" href="/workbench?course=debug-detective" data-testid="demo-next-course">去第二课：排错小侦探 →</a>}
            <button type="button" className="lw-btn lw-btn--sm lw-btn--ghost" onClick={exit}>退出演示</button>
          </div>
        </>
      )}
    </aside>
  );
  return slot ? createPortal(panel, slot) : panel;
}
