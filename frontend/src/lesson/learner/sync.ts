/**
 * 学习者画像 / 课程会话 ⇄ 后端（/api/lesson，R6）。localStorage 始终是第一份；后端可用时双向合并。
 * 未登录用 localStorage 的 learner_id 识别；登录后后端按账号识别（cookie）。所有请求失败静默。
 */
import { learnerId } from '../telemetry';
import { loadLearner, saveLearnerLocal, type LearnerState } from './store';
import { isAgeTier, onTierChange, useAgeTier } from '../ageTier';

// 孩子换了年龄档：写进本地画像并推给后端
onTierChange((t) => { saveLearnerLocal({ ...loadLearner(), ageTier: t }); schedulePush(300); });

const disabled = () => typeof fetch === 'undefined' || import.meta.env.MODE === 'test';
const headers = () => ({ 'Content-Type': 'application/json', 'X-Learner-Id': learnerId() });

export function mergeLearner(local: LearnerState, remote: Partial<LearnerState> | null): LearnerState {
  if (!remote) return local;
  const seen = new Set(local.events.map((e) => `${e.t}|${e.type}|${e.stepId}`));
  const events = [...local.events, ...(remote.events ?? []).filter((e) => e && typeof e.t === 'number' && !seen.has(`${e.t}|${e.type}|${e.stepId}`))].sort((a, b) => a.t - b.t).slice(-500);
  const difficulties = { ...local.difficulties };
  for (const [k, v] of Object.entries(remote.difficulties ?? {})) difficulties[k as keyof typeof difficulties] = Math.max(difficulties[k as keyof typeof difficulties] ?? 0, Number(v) || 0);
  const qa = new Set(local.quizAttempts.map((q) => q.at));
  const quizAttempts = [...local.quizAttempts, ...(remote.quizAttempts ?? []).filter((q) => q && !qa.has(q.at))].sort((a, b) => a.at - b.at).slice(-100);
  const ageTier = local.ageTier ?? (isAgeTier(remote.ageTier) ? remote.ageTier : undefined);
  return { version: 1, events, difficulties, quizAttempts, profile: local.profile ?? remote.profile ?? null, ...(ageTier ? { ageTier } : {}) };
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function schedulePush(delay = 1500) {
  if (disabled()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void pushProfile(); }, delay);
}

export async function pushProfile(): Promise<boolean> {
  if (disabled()) return false;
  const s = loadLearner();
  try {
    const r = await fetch('/api/lesson/profile', { method: 'PUT', headers: headers(), credentials: 'same-origin',
      body: JSON.stringify({ learner_id: learnerId(), profile: s.profile, difficulties: s.difficulties, events: s.events.slice(-500), quizAttempts: s.quizAttempts.slice(-100), ageTier: s.ageTier ?? null }) });
    return r.ok;
  } catch { return false; }
}

/** 进入工作台时调用：拉后端画像合并进本地，再推一次 */
export async function syncProfile(): Promise<void> {
  if (disabled()) return;
  try {
    const r = await fetch('/api/lesson/profile', { headers: headers(), credentials: 'same-origin' });
    if (!r.ok) return;
    const merged = mergeLearner(loadLearner(), await r.json());
    saveLearnerLocal(merged);
    if (merged.ageTier) useAgeTier.getState().hydrate(merged.ageTier);
    await pushProfile();
  } catch { /* 离线：只用本地 */ }
}

// ---- 课程会话 ----
let sessionId: string | null = null;
export const currentSessionId = () => sessionId;

export async function startSession(courseId: string): Promise<string | null> {
  if (disabled()) return null;
  try {
    const r = await fetch(`/api/lesson/courses/${encodeURIComponent(courseId)}/sessions`, { method: 'POST', headers: headers(), credentials: 'same-origin', body: JSON.stringify({ learner_id: learnerId() }) });
    sessionId = r.ok ? (await r.json()).sessionId : null;
  } catch { sessionId = null; }
  return sessionId;
}

export interface SessionPatch { surface?: string; agent_state?: string; step_index?: number; done_steps?: string[]; toolchain?: Record<string, string>; mainline_completed?: boolean }
let pending: SessionPatch = {};
let ptimer: ReturnType<typeof setTimeout> | null = null;
export function patchSession(p: SessionPatch) {
  if (disabled() || !sessionId) return;
  pending = { ...pending, ...p };
  if (ptimer) clearTimeout(ptimer);
  ptimer = setTimeout(() => {
    const body = { ...pending, learner_id: learnerId() }; pending = {}; ptimer = null;
    void fetch(`/api/lesson/sessions/${sessionId}`, { method: 'PATCH', headers: headers(), credentials: 'same-origin', body: JSON.stringify(body) }).catch(() => {});
  }, 600);
}

/** 测验提交：有会话走 R6 接口（服务端判分 + 用时统计）；没有会话返回 false，调用方退回 telemetry */
export async function submitQuizToSession(items: { question_id: string; correct: boolean; ms: number; skill?: string }[], practical: boolean, passed: boolean): Promise<boolean> {
  if (disabled() || !sessionId) return false;
  try {
    if (ptimer) { clearTimeout(ptimer); ptimer = null; const body = { ...pending, learner_id: learnerId() }; pending = {};
      await fetch(`/api/lesson/sessions/${sessionId}`, { method: 'PATCH', headers: headers(), credentials: 'same-origin', body: JSON.stringify(body) }); }
    const r = await fetch(`/api/lesson/sessions/${sessionId}/quiz/submit`, { method: 'POST', headers: headers(), credentials: 'same-origin',
      body: JSON.stringify({ learner_id: learnerId(), items, practical_confirmed: practical, passed }) });
    return r.ok;
  } catch { return false; }
}

/** 本地这门课还没进度时，从后端最近一次会话恢复（换浏览器 / 清缓存） */
export async function fetchLatestSession(courseId: string): Promise<{ stepIndex: number; mainlineCompleted: boolean } | null> {
  if (disabled()) return null;
  try {
    const r = await fetch(`/api/lesson/courses/${encodeURIComponent(courseId)}/sessions/latest`, { headers: headers(), credentials: 'same-origin' });
    if (!r.ok) return null;
    const d = await r.json();
    return d.session ? { stepIndex: Number(d.session.stepIndex) || 0, mainlineCompleted: !!d.session.mainlineCompleted } : null;
  } catch { return null; }
}
