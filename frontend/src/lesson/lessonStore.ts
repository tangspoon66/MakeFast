/**
 * 第一课 CourseSession（前端本地版，P0 单用户）。
 * 对齐 Data Model R6 §2.7；后端 /sessions API 接入前先存 localStorage。
 * 禁止字段：autonomyLevel / fadeStage / inLessonQuizScore。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionGraph } from './connectionGraph';
import { agentTransition, INITIAL_AGENT, type AgentContext, type AgentEvent, type Surface } from './agentMachine';

export type PhaseId = 'board' | 'connection' | 'build' | 'flash' | 'serial';
export type PhaseStatus = 'todo' | 'current' | 'done' | 'error';

export interface PhaseState {
  status: PhaseStatus;
  /** 短句（动作处 / 结果处显示），面向儿童 */
  message?: string;
}

export type QuizStatus = 'locked' | 'available' | 'in_progress' | 'passed' | 'failed';
export type BadgeId = 'mainline_complete' | 'understanding';

export interface LessonSession {
  coursePackId: string;
  agent: AgentContext;
  guideStepIndex: number;
  stepsCollapsed: boolean;
  mockMode: boolean;
  toolchain: Record<PhaseId, PhaseState>;
  phenomenonSuccess: boolean;
  phenomenonSource?: 'auto_serial' | 'user_confirm';
  mainlineCompletedAt?: string;
  quizStatus: QuizStatus;
  quizResult?: { mcqCorrect: number; practicalOk: boolean; passed: boolean };
  badges: BadgeId[];
  /** 学习者改过的连线图快照；null = 课包默认图 */
  graphSnapshot: ConnectionGraph | null;
  wiringCollapsed: boolean;
}

/** 每门课各自保存的进度（不含模拟模式开关和工具链实时状态） */
export type CourseProgress = Omit<LessonSession, 'mockMode' | 'toolchain'>;
const PROGRESS_KEYS = ['coursePackId', 'agent', 'guideStepIndex', 'stepsCollapsed', 'phenomenonSuccess', 'phenomenonSource', 'mainlineCompletedAt', 'quizStatus', 'quizResult', 'badges', 'graphSnapshot', 'wiringCollapsed'] as const;
export function progressOf(s: LessonSession): CourseProgress {
  const o: Record<string, unknown> = {};
  for (const k of PROGRESS_KEYS) o[k] = s[k];
  return o as unknown as CourseProgress;
}
/** v1（单一共享会话）→ v2（按课分桶）：原来的进度归到它自己的 coursePackId（默认 first-lesson） */
export function migrateLessonState(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== 'object') return persisted;
  const st = persisted as LessonSession & { byCourse?: Record<string, CourseProgress> };
  if (version < 2) {
    const id = st.coursePackId || 'first-lesson';
    return { ...st, coursePackId: id, byCourse: { [id]: progressOf({ ...st, coursePackId: id }) } };
  }
  return st;
}

export const initialToolchain = (): Record<PhaseId, PhaseState> => ({
  board: { status: 'current' },
  connection: { status: 'todo' },
  build: { status: 'todo' },
  flash: { status: 'todo' },
  serial: { status: 'todo' },
});

const freshSession = (coursePackId = 'first-lesson'): LessonSession => ({
  coursePackId,
  agent: INITIAL_AGENT,
  guideStepIndex: 0,
  stepsCollapsed: false,
  mockMode: true,
  toolchain: initialToolchain(),
  phenomenonSuccess: false,
  quizStatus: 'locked',
  badges: [],
  graphSnapshot: null,
  wiringCollapsed: false,
});

interface LessonActions {
  dispatchAgent: (event: AgentEvent) => void;
  setSurface: (surface: Surface) => void;
  setGuideStep: (index: number) => void;
  toggleSteps: () => void;
  setMockMode: (on: boolean) => void;
  setPhase: (phase: PhaseId, state: PhaseState) => void;
  setToolchain: (tc: Record<PhaseId, PhaseState>) => void;
  markPhenomenon: (source: 'auto_serial' | 'user_confirm') => void;
  setQuizStatus: (status: QuizStatus) => void;
  recordQuiz: (result: { mcqCorrect: number; practicalOk: boolean; passed: boolean }) => void;
  resetLesson: () => void;
  /** 换课：进度换成新课的全新会话（保留模拟模式开关） */
  switchCourse: (coursePackId: string) => void;
  byCourse: Record<string, CourseProgress>;
  setGraphSnapshot: (g: ConnectionGraph | null) => void;
  toggleWiring: () => void;
}

export const useLessonStore = create<LessonSession & LessonActions>()(
  persist(
    (set, get) => ({
      ...freshSession(),
      byCourse: {},
      dispatchAgent: (event) => set({ agent: agentTransition(get().agent, event) }),
      setSurface: (surface) => set({ agent: agentTransition(get().agent, { type: 'SURFACE', surface }) }),
      setGuideStep: (index) => set({ guideStepIndex: Math.max(0, index) }),
      toggleSteps: () => set({ stepsCollapsed: !get().stepsCollapsed }),
      setMockMode: (on) => set({ mockMode: on }),
      setPhase: (phase, state) => set({ toolchain: { ...get().toolchain, [phase]: state } }),
      setToolchain: (tc) => set({ toolchain: tc }),
      markPhenomenon: (source) => {
        if (get().phenomenonSuccess) return;
        const badges = get().badges.includes('mainline_complete') ? get().badges : [...get().badges, 'mainline_complete' as const];
        set({
          phenomenonSuccess: true,
          phenomenonSource: source,
          mainlineCompletedAt: new Date().toISOString(),
          quizStatus: get().quizStatus === 'locked' ? 'available' : get().quizStatus,
          badges,
          agent: agentTransition(get().agent, { type: 'PHENOMENON_SUCCESS' }),
        });
      },
      setQuizStatus: (status) => {
        if (!get().phenomenonSuccess && status !== 'locked') return; // QUIZ_LOCKED
        set({ quizStatus: status });
      },
      recordQuiz: (result) => {
        const badges = result.passed && !get().badges.includes('understanding') ? [...get().badges, 'understanding' as const] : get().badges;
        set({ quizResult: result, quizStatus: result.passed ? 'passed' : 'failed', badges });
      },
      setGraphSnapshot: (g) => set({ graphSnapshot: g }),
      toggleWiring: () => set({ wiringCollapsed: !get().wiringCollapsed }),
      switchCourse: (coursePackId) => {
        const cur = get();
        if (cur.coursePackId === coursePackId) return;
        const surface = cur.agent.surface;
        const byCourse = { ...cur.byCourse, [cur.coursePackId]: progressOf(cur) };
        const saved = byCourse[coursePackId];
        const base = saved ? { ...freshSession(coursePackId), ...saved } : freshSession(coursePackId);
        set({ ...base, toolchain: initialToolchain(), mockMode: cur.mockMode, byCourse, agent: agentTransition({ ...base.agent, surface }, { type: 'SURFACE', surface }) });
      },
      resetLesson: () => {
        const surface = get().agent.surface;
        const fresh = freshSession(get().coursePackId);
        set({ ...fresh, mockMode: get().mockMode, agent: agentTransition({ ...fresh.agent, surface }, { type: 'SURFACE', surface }) });
      },
    }),
    {
      name: 'makefast.lesson.first-lesson.v1', // 沿用旧 key，靠 version/migrate 升级，保留已有进度
      version: 2,
      migrate: migrateLessonState,
      partialize: (s) => ({
        byCourse: { ...s.byCourse, [s.coursePackId]: progressOf(s) },
        coursePackId: s.coursePackId, agent: s.agent, guideStepIndex: s.guideStepIndex, stepsCollapsed: s.stepsCollapsed,
        mockMode: s.mockMode, phenomenonSuccess: s.phenomenonSuccess, phenomenonSource: s.phenomenonSource,
        mainlineCompletedAt: s.mainlineCompletedAt, quizStatus: s.quizStatus, quizResult: s.quizResult, badges: s.badges,
        graphSnapshot: s.graphSnapshot, wiringCollapsed: s.wiringCollapsed,
        // 工具链状态不持久化：刷新后设备连接已断开，需要重新走一遍
      }),
    },
  ),
);
