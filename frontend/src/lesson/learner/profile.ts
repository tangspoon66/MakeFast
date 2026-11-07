/** 技能画像与阶段（R10 §18.1–18.3）：确定性计分，每条证据带理由。 */
import type { Evidence, LearnerProfile, SkillId, Stage } from './types';
import { SKILLS } from './types';

export interface QuizItemResult { questionId: string; skill: SkillId; correct: boolean; ms: number; expectedSec: number; difficulty?: 1 | 2 | 3 }

/** 作答用时修正：流利 ×1，犹豫 ×0.8，很慢 ×0.6 */
export function timingFactor(ms: number, expectedSec: number): number {
  const r = ms / 1000 / expectedSec;
  if (r <= 1) return 1;
  if (r <= 3) return 0.8;
  return 0.6;
}

export function isGuess(item: QuizItemResult): boolean { return !item.correct && item.ms < 3000; }

export function quizEvidence(items: QuizItemResult[]): Evidence[] {
  return items.map((it) => {
    const w = it.difficulty ?? 1;
    if (!it.correct) return { skill: it.skill, score: 0, weight: w, source: 'quiz', reason: `「${it.questionId}」答错${isGuess(it) ? '（答得太快，可能是猜的）' : ''}` };
    const f = timingFactor(it.ms, it.expectedSec);
    const label = f === 1 ? '又快又对' : f === 0.8 ? '想了一会儿答对' : '花了很久才答对';
    return { skill: it.skill, score: f, weight: w, source: 'quiz', reason: `「${it.questionId}」${label}（${Math.round(it.ms / 1000)} 秒）` };
  });
}

export interface LessonPerformance {
  wiringFirstTry: boolean;
  compileFails: number;
  deviceFails: number;
  maxHintLevel: number; // -1 无提示，0 nudge … 3 do
  selfResolved: boolean;
  phenomenon: boolean;
}

export function lessonEvidence(p: LessonPerformance): Evidence[] {
  const ind = p.maxHintLevel >= 3 ? 0.5 : p.maxHintLevel >= 2 ? 0.75 : 1; // 提示越多独立性越低
  const ev: Evidence[] = [];
  ev.push({ skill: 'wiring', score: (p.wiringFirstTry ? 1 : 0.6) * ind, weight: 1, source: 'lesson', reason: p.wiringFirstTry ? '接线一次通过校验' : '接线改了几次才对' });
  ev.push({ skill: 'sensors', score: p.phenomenon ? 0.9 * ind : 0.3, weight: 1, source: 'lesson', reason: p.phenomenon ? '成功读出了温湿度' : '还没看到传感器读数' });
  const fails = p.compileFails + p.deviceFails;
  const dbg = fails === 0 ? 0.7 : p.selfResolved ? Math.max(0.6, 1 - 0.05 * fails) : 0.4;
  ev.push({ skill: 'debugging', score: dbg * ind, weight: fails === 0 ? 0.5 : 1, source: 'lesson', reason: fails === 0 ? '没遇到报错（排错证据较少）' : p.selfResolved ? `遇到 ${fails} 次报错并自己解决` : `遇到 ${fails} 次报错，借助了提示` });
  ev.push({ skill: 'programming', score: (p.compileFails === 0 ? 0.7 : 0.6) * ind, weight: 0.5, source: 'lesson', reason: '完成了程序的编译与烧录' });
  return ev;
}

export function scoreSkills(evidence: Evidence[]): Record<SkillId, number> {
  const out = {} as Record<SkillId, number>;
  for (const s of SKILLS) {
    const e = evidence.filter((x) => x.skill === s);
    const w = e.reduce((a, b) => a + b.weight, 0);
    out[s] = w ? Math.round((e.reduce((a, b) => a + b.score * b.weight, 0) / w) * 100) : 0;
  }
  return out;
}

export function stageFor(skills: Record<SkillId, number>, completedCount: number, advancedCompleted = 0): Stage {
  const avg = SKILLS.reduce((a, s) => a + skills[s], 0) / SKILLS.length;
  if (completedCount <= 1) return avg >= 65 ? '进阶' : '入门';
  if (avg >= 85 && advancedCompleted >= 3) return '高级';
  if (avg >= 65) return '熟练';
  if (avg >= 40) return '进阶';
  return '入门';
}

const ORDER: Stage[] = ['入门', '进阶', '熟练', '高级'];
export function buildProfile(prev: LearnerProfile | null, newEvidence: Evidence[], courseId: string, now = Date.now()): LearnerProfile {
  const evidence = [...(prev?.evidence || []), ...newEvidence].slice(-200);
  const skills = scoreSkills(evidence);
  const completedCourses = Array.from(new Set([...(prev?.completedCourses || []), courseId]));
  let stage = stageFor(skills, completedCourses.length);
  if (prev && ORDER.indexOf(prev.stage) > ORDER.indexOf(stage)) stage = prev.stage; // 只升不降
  return { skills, evidence, stage, completedCourses, updatedAt: now };
}

export function strengthsAndGaps(skills: Record<SkillId, number>) {
  const sorted = [...SKILLS].sort((a, b) => skills[b] - skills[a]);
  return { strengths: sorted.slice(0, 2), gap: sorted[sorted.length - 1] };
}

/** 从事件流推导课内表现（R10 §18.2） */
export function perfFromEvents(events: { type: string; data?: { errors?: number } }[], maxHintLevel: number, phenomenon: boolean): LessonPerformance {
  const compileFails = events.filter((e) => e.type === 'compile.fail').length;
  const deviceFails = events.filter((e) => e.type === 'flash.fail' || e.type === 'connect.fail').length;
  const wiringErr = events.some((e) => e.type === 'wiring.change' && (e.data?.errors || 0) > 0);
  const lastOk = events.some((e) => e.type === 'flash.ok' || e.type === 'phenomenon.ok');
  return { wiringFirstTry: !wiringErr, compileFails, deviceFails, maxHintLevel, selfResolved: lastOk && maxHintLevel < 2, phenomenon };
}
