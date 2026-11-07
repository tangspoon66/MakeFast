/** 学习者模型（R10 §16–18）。字段与后端 R6 LearningEvent / LearnerProfile 对齐（P1 API 层做 snake_case 映射）。 */
export type SkillId = 'wiring' | 'programming' | 'sensors' | 'debugging' | 'concepts';
export const SKILLS: SkillId[] = ['wiring', 'programming', 'sensors', 'debugging', 'concepts'];
export const SKILL_LABEL: Record<SkillId, string> = {
  wiring: '电子与接线', programming: '编程逻辑', sensors: '传感器', debugging: '调试排错', concepts: '原理理解',
};
export type Stage = '入门' | '进阶' | '熟练' | '高级';
export const STAGES: Stage[] = ['入门', '进阶', '熟练', '高级'];

export type LearnerEventType =
  | 'step.enter' | 'step.exit' | 'element.focus' | 'activity' | 'idle'
  | 'wiring.change' | 'compile.start' | 'compile.ok' | 'compile.fail'
  | 'flash.start' | 'flash.ok' | 'flash.fail' | 'connect.ok' | 'connect.fail'
  | 'serial.nan' | 'phenomenon.ok' | 'help.request' | 'hint.shown' | 'coach.dismiss';

export interface LearnerEvent {
  t: number;
  type: LearnerEventType;
  stepId: string;
  data?: { text?: string; edgeId?: string; errors?: number; level?: HintLevel; ms?: number; element?: string };
}

export type HintLevel = 'nudge' | 'hint' | 'show' | 'do';
export const HINT_LADDER: HintLevel[] = ['nudge', 'hint', 'show', 'do'];

export type DifficultyCategory = 'wiring' | 'syntax' | 'library' | 'port' | 'flash' | 'concept' | 'unknown';

export interface Evidence { skill: SkillId; score: number; weight: number; reason: string; source: 'quiz' | 'lesson' }

export interface LearnerProfile {
  skills: Record<SkillId, number>;
  evidence: Evidence[];
  stage: Stage;
  completedCourses: string[];
  updatedAt: number;
}
