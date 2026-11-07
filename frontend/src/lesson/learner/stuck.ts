/** 卡住检测（R10 §16.2）：纯函数，阈值透明可调。 */
import type { HintLevel, LearnerEvent } from './types';
import { HINT_LADDER } from './types';

export const STUCK_RULES = {
  defaultExpectedSec: 60,
  idleSec: 90,
  dwellFactor: 2,
  sameErrorRepeat: 2,
  compileFailTotal: 3,
  deviceFailTotal: 2,
  rewireRepeat: 4,
  cooldownSec: 60,
};

export type StuckReason = 'dwell' | 'idle' | 'repeat_error' | 'compile_fails' | 'device_fails' | 'rewire_loop' | 'help';

export interface StuckResult { stuck: boolean; reason?: StuckReason; level?: HintLevel; message?: string }

export interface StuckInput {
  events: LearnerEvent[];
  now: number;
  stepId: string;
  expectedSec?: number;
  /** 本步已经因哪些原因提示过（原因 → 时间），用于冷却 */
  lastPrompted?: Partial<Record<StuckReason, number>>;
  /** 孩子关闭过本步的教练卡：dwell/idle 不再主动弹出 */
  dismissed?: boolean;
}

/** 错误签名：去掉数字/路径，便于判断“同一错误” */
export function errorSignature(text = ''): string {
  return text.replace(/\/[^\s:]+/g, '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function bump(level: HintLevel, n: number): HintLevel {
  return HINT_LADDER[Math.min(HINT_LADDER.length - 1, HINT_LADDER.indexOf(level) + n)];
}

export function detectStuck(i: StuckInput): StuckResult {
  const R = STUCK_RULES;
  const stepEvents = [];
  for (let k = i.events.length - 1; k >= 0; k--) {
    const e = i.events[k];
    if (e.stepId !== i.stepId) { if (e.type === 'step.enter') break; continue; }
    stepEvents.unshift(e);
    if (e.type === 'step.enter') break;
  }
  const cooled = (r: StuckReason) => {
    const at = i.lastPrompted?.[r];
    return at === undefined || i.now - at >= R.cooldownSec * 1000;
  };
  const helps = stepEvents.filter((e) => e.type === 'help.request').length;
  const shownLevels = stepEvents.filter((e) => e.type === 'hint.shown').map((e) => HINT_LADDER.indexOf(e.data?.level || 'nudge'));
  const maxShown = shownLevels.length ? Math.max(...shownLevels) : -1;
  const fromLadder = (base: HintLevel): HintLevel => {
    const lvl = bump(base, helps);
    return HINT_LADDER.indexOf(lvl) <= maxShown ? bump(HINT_LADDER[maxShown], 1) : lvl;
  };

  // 1. 同一错误重复
  const fails = stepEvents.filter((e) => e.type === 'compile.fail' || e.type === 'flash.fail' || e.type === 'connect.fail');
  const sigCount = new Map<string, number>();
  for (const f of fails) { const s = f.type + errorSignature(f.data?.text); sigCount.set(s, (sigCount.get(s) || 0) + 1); }
  if ([...sigCount.values()].some((n) => n >= R.sameErrorRepeat) && cooled('repeat_error'))
    return { stuck: true, reason: 'repeat_error', level: fromLadder('hint'), message: '同一个问题出现了好几次，我来帮你一起看看？' };
  const compileFails = i.events.filter((e) => e.type === 'compile.fail').length;
  if (compileFails >= R.compileFailTotal && cooled('compile_fails'))
    return { stuck: true, reason: 'compile_fails', level: fromLadder('hint'), message: '编译试了好几次还没成功，我们一起找找原因吧。' };
  const devFails = stepEvents.filter((e) => e.type === 'flash.fail' || e.type === 'connect.fail').length;
  if (devFails >= R.deviceFailTotal && cooled('device_fails'))
    return { stuck: true, reason: 'device_fails', level: fromLadder('hint'), message: '小板好像连不上，我有几个小妙招。' };
  // 2. 改线反复仍有错误
  const rewires = stepEvents.filter((e) => e.type === 'wiring.change');
  const last = rewires[rewires.length - 1];
  if (rewires.length >= R.rewireRepeat && (last?.data?.errors || 0) > 0 && cooled('rewire_loop'))
    return { stuck: true, reason: 'rewire_loop', level: fromLadder('hint'), message: '这根线改了好几次啦，要不要看看推荐接法？' };
  // 3. 求助
  if (helps > 0 && stepEvents[stepEvents.length - 1]?.type === 'help.request')
    return { stuck: true, reason: 'help', level: fromLadder('nudge') };
  if (i.dismissed) return { stuck: false };
  // 4. 停留过长 / 无操作
  const enter = stepEvents.find((e) => e.type === 'step.enter');
  const dwellSec = enter ? (i.now - enter.t) / 1000 : 0;
  const lastAct = [...stepEvents].reverse().find((e) => e.type !== 'idle' && e.type !== 'hint.shown');
  const idleSec = lastAct ? (i.now - lastAct.t) / 1000 : dwellSec;
  if (idleSec >= R.idleSec && cooled('idle'))
    return { stuck: true, reason: 'idle', level: fromLadder('nudge'), message: '你好像停下来了，需要我给点提示吗？' };
  if (dwellSec >= (i.expectedSec ?? R.defaultExpectedSec) * R.dwellFactor && cooled('dwell'))
    return { stuck: true, reason: 'dwell', level: fromLadder('nudge'), message: '你在这一步待了一会儿啦，要不要我帮帮你？' };
  return { stuck: false };
}
