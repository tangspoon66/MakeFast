/**
 * 课后小练习（QuizSpec，Data Model R6 §2.6；PRD F-QZ-01..04）。
 * 只在主线现象成功后解锁；3 道选择 + 1 道操作复核；
 * 通过 = 选择题至少答对 2 道 且 操作复核通过。
 */
import type { BadgeId } from './lessonStore';

import type { SkillId } from './learner/types';
export interface McqQuestion { id: string; prompt: string; choices: string[]; answerIndex: number; explain: string; skill?: SkillId; expectedSec?: number; difficulty?: 1 | 2 | 3 }
export interface PracticalCheck { id: string; prompt: string; kind: 'serial_temp_seen' | 'buzzer_heard' | 'either' }
export interface QuizSpec {
  mcq: McqQuestion[];
  practical: PracticalCheck;
  passRule: { mcqCorrectMin: number; practicalRequired: boolean };
}

export interface QuizSubmission { mcqAnswers: Record<string, number | undefined>; practicalConfirmed: boolean }
export interface QuizGrade { passed: boolean; mcqCorrect: number; practicalOk: boolean; badgesGranted: BadgeId[]; perQuestion: Record<string, boolean> }

export const FIRST_LESSON_QUIZ: QuizSpec = {
  mcq: [
    {
      id: 'q-data-pin', prompt: '第一课里，DHT22 的 DATA（数据）线接在 XIAO 的哪个引脚？',
      choices: ['D0', 'D1', '3V3', 'GND'], answerIndex: 0, skill: 'wiring', expectedSec: 15,
      explain: 'DATA 接 D0（GPIO1），程序里的 DHT_PIN 1 就是在说这根线。D1 留给了蜂鸣器。',
    },
    {
      id: 'q-why-compile', prompt: '为什么烧录之前要先「编译」？',
      choices: ['给小板充电', '把程序翻译成芯片能执行的机器码', '让蜂鸣器先响一下', '清空串口里的文字'], answerIndex: 1, skill: 'concepts', expectedSec: 20,
      explain: '芯片看不懂我们写的程序，编译就是把它翻译成 0 和 1，烧录再把翻译好的结果写进小板。',
    },
    {
      id: 'q-serial-meaning', prompt: '串口里每隔 2 秒出现一行「温度…湿度…」，说明了什么？',
      choices: ['电脑自己在测温度', '蜂鸣器坏了', '程序没有烧进去', '小板在运行程序，并通过 USB 把读数告诉电脑'], answerIndex: 3, skill: 'programming', expectedSec: 20, difficulty: 2,
      explain: '读数是小板上的程序读传感器后，用 Serial.print 通过 USB 发给电脑的。',
    },
  ],
  practical: { id: 'p-observe', prompt: '操作复核：我亲眼在串口看到了温湿度读数，或者亲耳听到了蜂鸣器“嘀”一声。', kind: 'either' },
  passRule: { mcqCorrectMin: 2, practicalRequired: true },
};

export function gradeQuiz(spec: QuizSpec, sub: QuizSubmission, alreadyHas: BadgeId[] = []): QuizGrade {
  const perQuestion: Record<string, boolean> = {};
  let mcqCorrect = 0;
  for (const q of spec.mcq) {
    const ok = sub.mcqAnswers[q.id] === q.answerIndex;
    perQuestion[q.id] = ok;
    if (ok) mcqCorrect += 1;
  }
  const practicalOk = !spec.passRule.practicalRequired || sub.practicalConfirmed;
  const passed = mcqCorrect >= spec.passRule.mcqCorrectMin && practicalOk;
  const badgesGranted: BadgeId[] = passed && !alreadyHas.includes('understanding') ? ['understanding'] : [];
  return { passed, mcqCorrect, practicalOk, badgesGranted, perQuestion };
}

export const BADGES: Record<BadgeId, { icon: string; name: string; desc: string }> = {
  mainline_complete: { icon: '🛠️', name: '小小造物家', desc: '完成第一课主线：接线 → 编译 → 烧录 → 看到现象' },
  understanding: { icon: '🧠', name: '原理小达人', desc: '课后小练习通过，真正弄懂了它为什么能工作' },
};
