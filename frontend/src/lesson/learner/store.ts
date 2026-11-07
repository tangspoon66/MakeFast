/** 学习者模型持久化（localStorage makefast.learner.v1），结构对齐后端。 */
import { schedulePush } from './sync';
import type { LearnerEvent, LearnerProfile, DifficultyCategory } from './types';

export const LEARNER_KEY = 'makefast.learner.v1';
export interface LearnerState {
  version: 1;
  events: LearnerEvent[];
  profile: LearnerProfile | null;
  difficulties: Partial<Record<DifficultyCategory, number>>;
  quizAttempts: { at: number; courseId: string; items: { questionId: string; correct: boolean; ms: number }[] }[];
  /** 年龄档 low / mid / high（同步到后端画像） */
  ageTier?: 'low' | 'mid' | 'high';
}
const empty = (): LearnerState => ({ version: 1, events: [], profile: null, difficulties: {}, quizAttempts: [] });

export function loadLearner(): LearnerState {
  try { const raw = localStorage.getItem(LEARNER_KEY); if (raw) { const v = JSON.parse(raw); if (v?.version === 1) return { ...empty(), ...v }; } } catch { /* ignore */ }
  return empty();
}
export function saveLearnerLocal(s: LearnerState) {
  try { localStorage.setItem(LEARNER_KEY, JSON.stringify({ ...s, events: s.events.slice(-500) })); } catch { /* quota */ }
}
/** 本地保存 + 稍后同步到后端（/api/lesson/profile） */
export function saveLearner(s: LearnerState) {
  saveLearnerLocal(s);
  schedulePush();
}
export function logEvent(e: LearnerEvent) { const s = loadLearner(); s.events.push(e); saveLearner(s); return s; }
export function bumpDifficulty(c: DifficultyCategory) { const s = loadLearner(); s.difficulties[c] = (s.difficulties[c] || 0) + 1; saveLearner(s); }
