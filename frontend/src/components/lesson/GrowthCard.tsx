/** 课后成长卡（R10 §18.4–18.5）：5 维技能条 + 阶段 + 做得好/可以练 + 推荐下一课（带理由）。 */
import { workbenchLinkForMeta } from '../../lesson/lessonRegistry';
import type { LearnerProfile } from '../../lesson/learner/types';
import { SKILLS, SKILL_LABEL } from '../../lesson/learner/types';
import { strengthsAndGaps } from '../../lesson/learner/profile';
import type { Recommendation } from '../../lesson/learner/recommend';
import { Mascot } from './Mascot';

export function GrowthCard({ profile, recs }: { profile: LearnerProfile; recs: Recommendation[] }) {
  const { strengths, gap } = strengthsAndGaps(profile.skills);
  const latest = profile.evidence.slice(-8);
  return (
    <section className="gc" data-testid="growth-card" aria-label="我的成长卡">
      <header className="gc__head">
        <Mascot mood="success" decorative size={64} />
        <div>
          <div className="gc__stage" data-testid="learner-stage">当前阶段：<b>{profile.stage}</b></div>
          <small>已完成 {profile.completedCourses.length} 门课 · 入门 → 进阶 → 熟练 → 高级</small>
        </div>
      </header>
      <ul className="gc__bars">
        {SKILLS.map((s) => (
          <li key={s}><span>{SKILL_LABEL[s]}</span><i><b style={{ width: `${profile.skills[s]}%` }} /></i><em>{profile.skills[s]}</em></li>
        ))}
      </ul>
      <p className="gc__note">👍 做得好：{strengths.map((s) => SKILL_LABEL[s]).join('、')} 🌱 下次可以多练：{SKILL_LABEL[gap]}</p>
      <details className="gc__why"><summary>为什么是这些分？</summary><ul>{latest.map((e, i) => <li key={i}>{SKILL_LABEL[e.skill]}：{e.reason}</li>)}</ul></details>
      {recs.length > 0 && (
        <div className="gc__recs" data-testid="recommendations">
          <h4>小铁猫推荐你下一步学</h4>
          {recs.map((r, i) => (
            <div key={r.course.id} className="gc__rec">
              <b>{i + 1}. {r.course.title}</b> <span className="lw-pill">{r.course.level}</span>{!r.course.available && <span className="lw-pill lw-pill--warning">即将开放</span>}
              <ul>{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              {workbenchLinkForMeta(r.course.id) && <a className="lw-btn lw-btn--sm lw-btn--primary gc__go" href={workbenchLinkForMeta(r.course.id)!} data-testid="rec-go">去学这一课 →</a>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
