/** 实时学习状态感知（R10 §16）：把步骤/操作/工具链/改线/求助写进事件流，定时跑卡住检测。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HintLevel, LearnerEvent, LearnerEventType } from './types';
import { HINT_LADDER } from './types';
import { detectStuck, type StuckReason, type StuckResult } from './stuck';
import { loadLearner, saveLearner } from './store';

export function useLearnerSensing(stepId: string, expectedSec: number, enabled: boolean) {
  const eventsRef = useRef<LearnerEvent[]>(loadLearner().events);
  const promptedRef = useRef<Partial<Record<StuckReason, number>>>({});
  const dismissedRef = useRef<Record<string, boolean>>({});
  const lastActRef = useRef(0);
  const [stuck, setStuck] = useState<StuckResult | null>(null);
  const [stuckStep, setStuckStep] = useState(stepId);
  if (stuckStep !== stepId) { setStuckStep(stepId); setStuck(null); }

  const log = useCallback((type: LearnerEventType, data?: LearnerEvent['data'], sid = stepId) => {
    const e: LearnerEvent = { t: Date.now(), type, stepId: sid, data };
    eventsRef.current = [...eventsRef.current, e].slice(-500);
    const s = loadLearner(); s.events = eventsRef.current; saveLearner(s);
  }, [stepId]);

  // 步骤进入 / 离开（含停留时长）
  useEffect(() => {
    if (!enabled) return;
    const enterAt = Date.now();
    log('step.enter', undefined, stepId);
    promptedRef.current = {};
    return () => log('step.exit', { ms: Date.now() - enterAt }, stepId);
  }, [stepId, enabled, log]);

  // 操作（节流 5s）
  useEffect(() => {
    if (!enabled) return;
    const onAct = () => { const n = Date.now(); if (n - lastActRef.current > 5000) { lastActRef.current = n; log('activity'); } };
    window.addEventListener('keydown', onAct); window.addEventListener('pointerdown', onAct);
    return () => { window.removeEventListener('keydown', onAct); window.removeEventListener('pointerdown', onAct); };
  }, [enabled, log]);

  const evaluate = useCallback((now = Date.now()) => {
    const r = detectStuck({ events: eventsRef.current, now, stepId, expectedSec, lastPrompted: promptedRef.current, dismissed: !!dismissedRef.current[stepId] });
    if (r.stuck && r.reason && r.reason !== 'help') { promptedRef.current[r.reason] = now; setStuck(r); }
    return r;
  }, [stepId, expectedSec]);

  // 定时检测（5s）
  useEffect(() => {
    if (!enabled) return;
    const iv = setInterval(() => evaluate(), 5000);
    return () => clearInterval(iv);
  }, [enabled, evaluate]);

  const levelRef = useRef<Record<string, number>>({});
  /** 提示梯度：每次 +1 级（nudge → hint → show → do） */
  const nextHintLevel = useCallback((): HintLevel => {
    const cur = levelRef.current[stepId] ?? -1;
    const n = Math.min(HINT_LADDER.length - 1, cur + 1);
    levelRef.current[stepId] = n;
    log('help.request'); log('hint.shown', { level: HINT_LADDER[n] });
    return HINT_LADDER[n];
  }, [stepId, log]);

  const maxHintLevel = () => Math.max(-1, ...Object.values(levelRef.current));

  return {
    log, stuck, evaluate, nextHintLevel, maxHintLevel,
    events: () => eventsRef.current,
    dismissStuck: () => { dismissedRef.current[stepId] = true; setStuck(null); log('coach.dismiss'); },
    dismissStep: () => { dismissedRef.current[stepId] = true; log('coach.dismiss'); },
    clearStuck: () => setStuck(null),
  };
}
