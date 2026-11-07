/** 工作台可玩的课包注册表：/workbench?course=<id> */
import type { AgeTier } from './ageTier';
import { FIRST_LESSON_GUIDE, type GuideStep } from './guideScript';
import { FIRST_LESSON_CODE } from './firmware';
import { FIRST_LESSON_QUIZ, type QuizSpec } from './quiz';
import { FIRST_LESSON_FAQ, FIRST_LESSON_PACK } from './coursePack';
import { DEBUG_DETECTIVE_CODE, DEBUG_DETECTIVE_FAQ, DEBUG_DETECTIVE_GUIDE, DEBUG_DETECTIVE_QUIZ } from './debugDetective';

export interface LessonDef {
  /** 课包 id（URL / 后台 slug / 会话） */
  id: string;
  /** 推荐与画像里用的课程 id（COURSE_META） */
  metaId: string;
  title: string;
  guide: GuideStep[];
  code: string;
  quiz: QuizSpec;
  faq: { q: string; a: string; keywords: string[] }[];
  /** 进课时小铁猫的第一句话（按年龄档） */
  greeting: Record<AgeTier, string>;
}

export const LESSONS: Record<string, LessonDef> = {
  'first-lesson': {
    id: 'first-lesson', metaId: 'course-temp-buzzer', title: FIRST_LESSON_PACK.title,
    guide: FIRST_LESSON_GUIDE, code: FIRST_LESSON_CODE, quiz: FIRST_LESSON_QUIZ, faq: FIRST_LESSON_FAQ,
    greeting: {
      low: '你好，我是小铁猫🐱！今天做一个会感觉冷热的小管家。卡住了，我带你过去。',
      mid: '我是小铁猫。我会看着你的连线、程序和串口，卡住了直接带你过去。',
      high: '我会实时检查连线、代码和串口，出错直接定位到行。',
    },
  },
  'debug-detective': {
    id: 'debug-detective', metaId: 'course-debug-detective', title: '排错小侦探：读懂报错',
    guide: DEBUG_DETECTIVE_GUIDE, code: DEBUG_DETECTIVE_CODE, quiz: DEBUG_DETECTIVE_QUIZ, faq: DEBUG_DETECTIVE_FAQ,
    greeting: {
      low: '侦探你好🕵️！程序里藏了 3 个 bug，报错就是线索，我们一起破案！',
      mid: '程序里藏了 3 个 bug。每条报错都是线索，我会带你跳到出错那一行。',
      high: '3 个 bug，跟着编译器报错逐个定位修复。',
    },
  },
};

export const DEFAULT_LESSON = 'first-lesson';
export function getLesson(id: string | null | undefined): LessonDef {
  return (id && LESSONS[id]) || LESSONS[DEFAULT_LESSON];
}
/** 推荐结果（COURSE_META id）→ 能直接开始的工作台链接 */
export function workbenchLinkForMeta(metaId: string): string | null {
  const l = Object.values(LESSONS).find((x) => x.metaId === metaId);
  return l ? `/workbench?course=${l.id}` : null;
}
/** 目录「开始课程」→ 课文章节页（有文章的课） */
export function articleLinkForMeta(metaId: string): string | null {
  const l = Object.values(LESSONS).find((x) => x.metaId === metaId);
  if (!l) return null;
  // first-lesson / debug-detective：侦探课暂无长文，仍进工作台；第一课走章节页
  if (l.id === 'first-lesson') return `/courses/${l.id}`;
  return workbenchLinkForMeta(metaId);
}
export function articleLinkForSlug(slug: string): string | null {
  if (slug === 'first-lesson' || slug === 'temp-buzzer' || slug === 'course-temp-buzzer') return '/courses/first-lesson';
  const l = LESSONS[slug];
  return l ? articleLinkForMeta(l.metaId) : null;
}
