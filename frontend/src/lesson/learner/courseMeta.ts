/** 课程元数据（推荐用）：等级、教授技能权重、先修。与 catalog/courseCatalog.ts 的 id 对齐。 */
import type { SkillId, Stage } from './types';

export interface CourseMeta {
  id: string;
  title: string;
  level: Stage;
  skills: Partial<Record<SkillId, number>>; // 0–1 教学权重
  prerequisites: string[];
  durationMin: number;
  available: boolean;
}

export const COURSE_META: CourseMeta[] = [
  { id: 'course-temp-buzzer', title: '第一课：温湿度小管家', level: '入门', skills: { wiring: 0.6, sensors: 0.8, programming: 0.4, debugging: 0.5, concepts: 0.6 }, prerequisites: [], durationMin: 45, available: true },
  { id: 'course-led-blink', title: '点亮第一盏 LED', level: '入门', skills: { wiring: 0.8, programming: 0.5, concepts: 0.6 }, prerequisites: [], durationMin: 30, available: false },
  { id: 'course-servo-wave', title: '舵机挥手小机器人', level: '进阶', skills: { wiring: 0.6, programming: 0.8, concepts: 0.5, debugging: 0.4 }, prerequisites: ['course-temp-buzzer'], durationMin: 60, available: false },
  { id: 'course-light-alarm', title: '光线感应小夜灯', level: '进阶', skills: { sensors: 0.9, programming: 0.6, wiring: 0.5 }, prerequisites: ['course-temp-buzzer'], durationMin: 50, available: false },
  { id: 'course-debug-detective', title: '排错小侦探：读懂报错', level: '进阶', skills: { debugging: 1, programming: 0.6, concepts: 0.4 }, prerequisites: ['course-temp-buzzer'], durationMin: 30, available: true },
  { id: 'course-weather-station', title: '联网小气象站', level: '熟练', skills: { programming: 0.9, sensors: 0.7, debugging: 0.6, concepts: 0.7 }, prerequisites: ['course-light-alarm', 'course-servo-wave'], durationMin: 90, available: false },
];
