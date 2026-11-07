import { describe, it, expect, beforeEach } from 'vitest';
import { detectStuck, errorSignature } from './stuck';
import { classifyDifficulty, diagnose } from './diagnose';
import { timingFactor, quizEvidence, scoreSkills, buildProfile, stageFor, lessonEvidence } from './profile';
import { recommend } from './recommend';
import { COURSE_META } from './courseMeta';
import type { LearnerEvent } from './types';
import { loadLearner, logEvent, LEARNER_KEY } from './store';

const S = 'wire-dht';
const ev = (t: number, type: LearnerEvent['type'], data?: LearnerEvent['data'], stepId = S): LearnerEvent => ({ t: t * 1000, type, stepId, data });

describe('卡住检测', () => {
  it('刚进入步骤不算卡住', () => {
    expect(detectStuck({ events: [ev(0, 'step.enter')], now: 10_000, stepId: S }).stuck).toBe(false);
  });
  it('停留超过预期 2 倍 → nudge(dwell)', () => {
    const r = detectStuck({ events: [ev(0, 'step.enter'), ev(80, 'activity')], now: 125_000, stepId: S });
    expect(r).toMatchObject({ stuck: true, reason: 'dwell', level: 'nudge' });
  });
  it('90 秒无操作 → idle', () => {
    expect(detectStuck({ events: [ev(0, 'step.enter')], now: 95_000, stepId: S, expectedSec: 120 }).reason).toBe('idle');
  });
  it('同一编译错误 2 次 → hint', () => {
    const e = [ev(0, 'step.enter'), ev(5, 'compile.fail', { text: "line 12: expected ';'" }), ev(9, 'compile.fail', { text: "line 13: expected ';'" })];
    expect(detectStuck({ events: e, now: 10_000, stepId: S })).toMatchObject({ reason: 'repeat_error', level: 'hint' });
  });
  it('冷却期内不重复提示；关闭后不因停留弹出', () => {
    const e = [ev(0, 'step.enter')];
    expect(detectStuck({ events: e, now: 130_000, stepId: S, lastPrompted: { idle: 100_000, dwell: 100_000 } }).stuck).toBe(false);
    expect(detectStuck({ events: e, now: 130_000, stepId: S, dismissed: true }).stuck).toBe(false);
  });
  it('求助按梯度升级，不跳过已给过的级别', () => {
    const e = [ev(0, 'step.enter'), ev(3, 'hint.shown', { level: 'hint' }), ev(5, 'help.request')];
    expect(detectStuck({ events: e, now: 6000, stepId: S }).level).toBe('show');
  });
  it('错误签名忽略行号', () => { expect(errorSignature('a.ino:12: x')).toBe(errorSignature('a.ino:99: x')); });
});

describe('困难诊断分类', () => {
  it.each([
    [{ compileError: 'fatal error: DHT.h: No such file or directory' }, 'library', 'topbar.compile'],
    [{ compileError: "error: expected ';' before '}' token" }, 'syntax', 'topbar.compile'],
    [{ connectError: 'NotFoundError: No port selected by the user' }, 'port', 'topbar.connect'],
    [{ flashError: 'Failed to connect to ESP32: Timed out waiting for packet header' }, 'flash', 'topbar.flash'],
    [{ wiringErrors: 1 }, 'wiring', 'wiring.panel'],
    [{ serialNanCount: 4 }, 'wiring', 'wiring.panel'],
    [{ conceptConfusion: true }, 'concept', 'guide.card'],
    [{}, 'unknown', 'agent.summon'],
  ])('%j → %s', (input, cat, anchor) => {
    const d = diagnose(input);
    expect(d.category).toBe(cat);
    expect(d.anchor).toBe(anchor);
    expect(d.steps.length).toBeGreaterThan(0);
  });
  it('浏览器不支持 Web Serial → port', () => { expect(classifyDifficulty({ webSerialSupported: false }).category).toBe('port'); });
});

describe('技能计分（含作答用时）', () => {
  it('用时修正', () => {
    expect(timingFactor(5000, 10)).toBe(1);
    expect(timingFactor(25000, 10)).toBe(0.8);
    expect(timingFactor(40000, 10)).toBe(0.6);
  });
  it('答得快且对 > 慢而对 > 错', () => {
    const fast = scoreSkills(quizEvidence([{ questionId: 'a', skill: 'wiring', correct: true, ms: 4000, expectedSec: 15 }]));
    const slow = scoreSkills(quizEvidence([{ questionId: 'a', skill: 'wiring', correct: true, ms: 60000, expectedSec: 15 }]));
    const wrong = scoreSkills(quizEvidence([{ questionId: 'a', skill: 'wiring', correct: false, ms: 1000, expectedSec: 15 }]));
    expect(fast.wiring).toBe(100); expect(slow.wiring).toBe(60); expect(wrong.wiring).toBe(0);
    expect(quizEvidence([{ questionId: 'a', skill: 'wiring', correct: false, ms: 1000, expectedSec: 15 }])[0].reason).toContain('猜');
  });
  it('提示越多课内证据越低', () => {
    const base = { wiringFirstTry: true, compileFails: 0, deviceFails: 0, selfResolved: true, phenomenon: true };
    const a = scoreSkills(lessonEvidence({ ...base, maxHintLevel: -1 }));
    const b = scoreSkills(lessonEvidence({ ...base, maxHintLevel: 3 }));
    expect(a.wiring).toBeGreaterThan(b.wiring);
  });
  it('阶段：首课最多到进阶；阶段只升不降', () => {
    expect(stageFor({ wiring: 90, programming: 90, sensors: 90, debugging: 90, concepts: 90 }, 1)).toBe('进阶');
    expect(stageFor({ wiring: 20, programming: 20, sensors: 20, debugging: 20, concepts: 20 }, 1)).toBe('入门');
    const p1 = buildProfile(null, quizEvidence([{ questionId: 'a', skill: 'wiring', correct: true, ms: 1000, expectedSec: 10 }]).concat(
      (['programming', 'sensors', 'debugging', 'concepts'] as const).map((s) => ({ skill: s, score: 1, weight: 1, reason: 'x', source: 'quiz' as const }))), 'c1');
    expect(p1.stage).toBe('进阶');
    const p2 = buildProfile(p1, (['wiring', 'programming', 'sensors', 'debugging', 'concepts'] as const).map((s) => ({ skill: s, score: 0, weight: 50, reason: 'x', source: 'quiz' as const })), 'c2');
    expect(p2.stage).toBe('进阶');
  });
});

describe('推荐下一课', () => {
  const prof = (skills: Partial<Record<string, number>>) => ({ skills: { wiring: 70, programming: 70, sensors: 70, debugging: 70, concepts: 70, ...skills }, evidence: [], stage: '入门' as const, completedCourses: ['course-temp-buzzer'], updatedAt: 0 });
  it('排除已完成与未满足先修', () => {
    const ids = recommend(prof({}), COURSE_META, 10).map((r) => r.course.id);
    expect(ids).not.toContain('course-temp-buzzer');
    expect(ids).not.toContain('course-weather-station');
  });
  it('调试弱 → 推荐排错课，并给出理由', () => {
    const r = recommend(prof({ debugging: 10 }), COURSE_META.filter((c) => c.level === '进阶'))[0];
    expect(r.course.id).toBe('course-debug-detective');
    expect(r.reasons.join()).toContain('调试排错');
  });
  it('确定性：同输入同输出', () => {
    expect(recommend(prof({ sensors: 20 }), COURSE_META)).toEqual(recommend(prof({ sensors: 20 }), COURSE_META));
  });
});

describe('持久化', () => {
  beforeEach(() => localStorage.removeItem(LEARNER_KEY));
  it('事件写入 localStorage', () => {
    logEvent(ev(1, 'step.enter'));
    expect(loadLearner().events).toHaveLength(1);
  });
});
