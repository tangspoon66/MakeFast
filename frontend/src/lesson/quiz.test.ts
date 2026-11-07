import { describe, expect, it } from 'vitest';
import { FIRST_LESSON_QUIZ as Q, gradeQuiz } from './quiz';

const right = (i: number) => Q.mcq[i].answerIndex;
const wrong = (i: number) => (Q.mcq[i].answerIndex + 1) % Q.mcq[i].choices.length;
const answers = (...ok: boolean[]) => Object.fromEntries(Q.mcq.map((q, i) => [q.id, ok[i] ? right(i) : wrong(i)]));

describe('post-lesson quiz pass rule (F-QZ-03)', () => {
  it('has 3 MCQ + 1 practical', () => {
    expect(Q.mcq).toHaveLength(3);
    expect(Q.practical).toBeTruthy();
  });
  it('2 correct + practical = pass, grants understanding badge', () => {
    const g = gradeQuiz(Q, { mcqAnswers: answers(true, true, false), practicalConfirmed: true });
    expect(g.passed).toBe(true);
    expect(g.mcqCorrect).toBe(2);
    expect(g.badgesGranted).toEqual(['understanding']);
  });
  it('3 correct but no practical = fail', () => {
    expect(gradeQuiz(Q, { mcqAnswers: answers(true, true, true), practicalConfirmed: false }).passed).toBe(false);
  });
  it('1 correct + practical = fail', () => {
    expect(gradeQuiz(Q, { mcqAnswers: answers(true, false, false), practicalConfirmed: true }).passed).toBe(false);
  });
  it('unanswered counts as wrong; badge not granted twice', () => {
    const g = gradeQuiz(Q, { mcqAnswers: {}, practicalConfirmed: true });
    expect(g.mcqCorrect).toBe(0);
    const again = gradeQuiz(Q, { mcqAnswers: answers(true, true, true), practicalConfirmed: true }, ['understanding']);
    expect(again.badgesGranted).toEqual([]);
  });
});
