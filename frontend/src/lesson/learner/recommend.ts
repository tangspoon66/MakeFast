/** 推荐下一课（R10 §18.5）：gap × 教学权重 + 阶段匹配，排除未满足先修与已完成，给出理由。 */
import type { CourseMeta } from './courseMeta';
import type { LearnerProfile, SkillId } from './types';
import { SKILL_LABEL, STAGES } from './types';

export interface Recommendation { course: CourseMeta; score: number; reasons: string[] }

export function recommend(profile: LearnerProfile, catalog: CourseMeta[], topN = 3): Recommendation[] {
  const done = new Set(profile.completedCourses);
  const cur = STAGES.indexOf(profile.stage);
  const out: Recommendation[] = [];
  for (const c of catalog) {
    if (done.has(c.id)) continue;
    if (c.prerequisites.some((p) => !done.has(p))) continue;
    const reasons: string[] = [];
    let score = 0;
    const contribs = (Object.entries(c.skills) as [SkillId, number][]).map(([s, w]) => ({ s, v: ((100 - (profile.skills[s] ?? 0)) / 100) * w }));
    for (const x of contribs) score += x.v;
    const top = contribs.sort((a, b) => b.v - a.v)[0];
    if (top && top.v > 0.2) reasons.push(`你的「${SKILL_LABEL[top.s]}」还可以加强，这门课会重点练它`);
    const diff = STAGES.indexOf(c.level) - cur;
    if (diff === 0) { score += 2; reasons.push('难度和你现在的水平刚好'); }
    else if (diff === 1) { score += 1; reasons.push('难度比你现在高一点点，正适合挑战'); }
    else if (diff < -1) score -= 3;
    else if (diff > 1) score -= 2;
    if (c.prerequisites.length) reasons.push(`你已经学完了它需要的前置课`);
    out.push({ course: c, score: Math.round(score * 100) / 100, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.course.id.localeCompare(b.course.id)).slice(0, topN);
}
