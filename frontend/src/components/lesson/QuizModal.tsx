/**
 * 课后小练习（C-QUIZ）：主线完成后才可打开；3 选择 + 1 操作复核；通过得「原理小达人」徽章。
 * 测验中 Agent 只做轻答疑（QUIET_HELP），不阻挡已完成的主线。
 */
import { sendTelemetry } from '../../lesson/telemetry';
import { submitQuizToSession } from '../../lesson/learner/sync';
import { useEffect, useRef, useState } from 'react';
import { buildProfile, lessonEvidence, quizEvidence, type LessonPerformance, type QuizItemResult } from '../../lesson/learner/profile';
import { recommend, type Recommendation } from '../../lesson/learner/recommend';
import { COURSE_META } from '../../lesson/learner/courseMeta';
import { loadLearner, saveLearner } from '../../lesson/learner/store';
import type { LearnerProfile } from '../../lesson/learner/types';
import { GrowthCard } from './GrowthCard';
import { BADGES, gradeQuiz, type QuizGrade, type QuizSpec } from '../../lesson/quiz';
import type { BadgeId } from '../../lesson/lessonStore';

interface QuizModalProps {
  spec: QuizSpec;
  locked: boolean;
  badges: BadgeId[];
  autoObserved: boolean;
  onSubmit: (grade: QuizGrade) => void;
  onClose: () => void;
  onBackToCatalog: () => void;
  courseId?: string;
  /** 课内表现（来自事件流），用于画像 */
  lessonPerf?: LessonPerformance;
}

export function QuizModal({ spec, locked, badges, autoObserved, onSubmit, onClose, onBackToCatalog, courseId = 'course-temp-buzzer', lessonPerf }: QuizModalProps) {
  const openedAt = useRef(0);
  const lastAt = useRef(0);
  useEffect(() => { openedAt.current = Date.now(); lastAt.current = openedAt.current; }, []);
  const timing = useRef<Record<string, number>>({});
  const [growth, setGrowth] = useState<{ profile: LearnerProfile; recs: Recommendation[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});
  const [practical, setPractical] = useState(false);
  const [grade, setGrade] = useState<QuizGrade | null>(null);

  const submit = () => {
    const g = gradeQuiz(spec, { mcqAnswers: answers, practicalConfirmed: practical }, badges);
    setGrade(g);
    onSubmit(g);
    // 画像：测验（含每题用时）+ 课内表现 → 技能分、阶段、推荐（R10 §18）
    const items: QuizItemResult[] = spec.mcq.map((q) => ({ questionId: q.id, skill: q.skill || 'concepts', correct: !!g.perQuestion[q.id], ms: timing.current[q.id] ?? Date.now() - openedAt.current, expectedSec: q.expectedSec ?? 20, difficulty: q.difficulty }));
    const st = loadLearner();
    const ev = [...quizEvidence(items), ...(lessonPerf ? lessonEvidence(lessonPerf) : [])];
    if (g.practicalOk) ev.push({ skill: 'sensors', score: 1, weight: 1, source: 'quiz', reason: '操作复核：亲眼看到了传感器读数' });
    const profile = buildProfile(st.profile, ev, courseId);
    st.profile = profile;
    const qItems = items.map((i) => ({ question_id: i.questionId, correct: i.correct, ms: Math.min(Math.round(i.ms), 3_600_000), skill: String(i.skill).slice(0, 30) }));
    void submitQuizToSession(qItems, practical, g.passed).then((ok) => { if (!ok) sendTelemetry({ kind: 'quiz_attempt', passed: g.passed, items: qItems }); });
    st.quizAttempts.push({ at: Date.now(), courseId, items: items.map(({ questionId, correct, ms }) => ({ questionId, correct, ms })) });
    saveLearner(st);
    setGrowth({ profile, recs: recommend(profile, COURSE_META) });
  };
  const retry = () => { setGrade(null); setAnswers({}); setGrowth(null); timing.current = {}; openedAt.current = lastAt.current = Date.now(); };
  const allAnswered = spec.mcq.every((q) => answers[q.id] !== undefined);

  return (
    <div className="lw-modal-mask" role="dialog" aria-modal="true" aria-label="课后小练习" data-testid="quiz-modal">
      <div className="lw-modal">
        <div className="lw-modal__head">
          <h2>课后小练习（巩固一下）</h2>
          <span className="lw-tabs__spacer" />
          <button type="button" className="lw-card__close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        {locked ? (
          <div className="lw-modal__body" data-testid="quiz-locked">
            <div className="lw-empty">
              <span style={{ fontSize: 40 }}>🔒</span>
              <strong>先完成主线，再来做小练习</strong>
              <span>烧录成功并看到串口里的温湿度（或听到蜂鸣）后，这里就会解锁。</span>
            </div>
          </div>
        ) : (
          <>
            <div className="lw-modal__body">
              {spec.mcq.map((q, qi) => {
                const state = grade ? (grade.perQuestion[q.id] ? 'right' : 'wrong') : null;
                return (
                  <fieldset key={q.id} data-lw-anchor={`quiz.q.${q.id}`} className={`lw-q ${state ? `lw-q--${state}` : ''}`}>
                    <legend>第 {qi + 1} 题 {q.prompt}</legend>
                    {q.choices.map((c, ci) => (
                      <label key={ci}>
                        <input type="radio" name={q.id} checked={answers[q.id] === ci} disabled={!!grade}
                          onChange={() => { const n = Date.now(); timing.current[q.id] = (timing.current[q.id] ?? 0) + (n - lastAt.current); lastAt.current = n; setAnswers((a) => ({ ...a, [q.id]: ci })); }} />
                        {c}
                      </label>
                    ))}
                    {grade && <p className="lw-q__explain">{state === 'right' ? '✅ 答对了！' : '💡 '}{q.explain}</p>}
                  </fieldset>
                );
              })}
              <fieldset className={`lw-q ${grade ? (grade.practicalOk ? 'lw-q--right' : 'lw-q--wrong') : ''}`}>
                <legend>第 4 题 操作复核</legend>
                <label>
                  <input type="checkbox" checked={practical} disabled={!!grade} onChange={(e) => setPractical(e.target.checked)} data-testid="practical-check" data-lw-anchor="quiz.practical" />
                  {spec.practical.prompt}
                </label>
                {autoObserved && !grade && <p className="lw-q__explain">提示：系统已经在串口里认出了你的读数，确认一下就好。</p>}
              </fieldset>

              {grade && (
                <div role="status" data-testid="quiz-result">
                  {grade.passed ? (
                    <>
                      <h3 style={{ margin: '4px 0 10px' }}>🎉 通过啦！答对 {grade.mcqCorrect} / {spec.mcq.length} 题</h3>
                      <div className="lw-badges">
                        {(['mainline_complete', 'understanding'] as BadgeId[]).filter((b) => badges.includes(b) || grade.badgesGranted.includes(b)).map((b) => (
                          <div key={b} className="lw-badge"><span className="lw-badge__icon">{BADGES[b].icon}</span><span>{BADGES[b].name}<br /><small style={{ fontWeight: 400 }}>{BADGES[b].desc}</small></span></div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <h3 style={{ margin: '4px 0' }}>
                      差一点点！答对 {grade.mcqCorrect} 题{!grade.practicalOk ? '，操作复核还没确认' : ''}。看看上面的解析，再试一次吧（答对 2 题 + 完成复核就能通过）。
                    </h3>
                  )}
                  {growth && <GrowthCard profile={growth.profile} recs={growth.recs} />}
                </div>
              )}
            </div>
            <div className="lw-modal__foot">
              {!grade && <button type="button" className="lw-btn lw-btn--primary" onClick={submit} disabled={!allAnswered} data-testid="quiz-submit" data-lw-anchor="quiz.submit">提交</button>}
              {grade && !grade.passed && <button type="button" className="lw-btn lw-btn--blue" onClick={retry}>再试一次</button>}
              {grade?.passed && <button type="button" className="lw-btn lw-btn--blue" onClick={onBackToCatalog}>回课程目录</button>}
              {grade && <button type="button" className="lw-btn" onClick={onClose}>回到工作台</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
