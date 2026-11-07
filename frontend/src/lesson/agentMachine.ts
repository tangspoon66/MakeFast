/**
 * 课程 Agent 状态机（PRD F-AGT-*, Data Model R6 §2.7/2.8）
 *
 * - IDLE：Welcome / Hub / 目录 / 详情。只显示待机形象，不下发引导（M7 硬门禁）。
 * - GUIDING：仅当 surface === 'workbench' 且主线未完成。
 * - WRAP_UP：现象成功后在工作台收束，引导去「课后小练习」。
 * - QUIET_HELP：用户主动求助或在测验表面；轻答疑，不挡操作。
 *
 * 纯函数，便于单测；React 侧由 lessonStore 调用。
 */

export type AgentState = 'IDLE' | 'GUIDING' | 'WRAP_UP' | 'QUIET_HELP';
export type Surface = 'welcome' | 'home' | 'catalog' | 'detail' | 'workbench' | 'create' | 'quiz';

export interface AgentContext {
  state: AgentState;
  surface: Surface;
  mainlineComplete: boolean;
}

export type AgentEvent =
  | { type: 'SURFACE'; surface: Surface }
  | { type: 'PHENOMENON_SUCCESS' }
  | { type: 'ASK_HELP' }
  | { type: 'CLOSE_HELP' }
  | { type: 'RESET_LESSON' };

export const INITIAL_AGENT: AgentContext = { state: 'IDLE', surface: 'catalog', mainlineComplete: false };

/** 在工作台里「不求助时」应处于的状态 */
function workbenchResting(mainlineComplete: boolean): AgentState {
  return mainlineComplete ? 'WRAP_UP' : 'GUIDING';
}

export function agentTransition(ctx: AgentContext, event: AgentEvent): AgentContext {
  switch (event.type) {
    case 'SURFACE': {
      const surface = event.surface;
      if (surface === 'workbench') {
        return { ...ctx, surface, state: workbenchResting(ctx.mainlineComplete) };
      }
      if (surface === 'create') {
        // 自由创作：不自动 GUIDING；求助时 QUIET_HELP
        return { ...ctx, surface, state: 'IDLE' };
      }
      if (surface === 'quiz') {
        // 测验仅在主线完成后可进入；未完成时保持 IDLE（QUIZ_LOCKED 由 UI 拦截）
        return { ...ctx, surface, state: ctx.mainlineComplete ? 'QUIET_HELP' : 'IDLE' };
      }
      // welcome / home / catalog / detail：一律 IDLE，暂停引导
      return { ...ctx, surface, state: 'IDLE' };
    }
    case 'PHENOMENON_SUCCESS': {
      if (ctx.surface !== 'workbench') return { ...ctx, mainlineComplete: true };
      return { ...ctx, mainlineComplete: true, state: 'WRAP_UP' };
    }
    case 'ASK_HELP': {
      if (ctx.surface !== 'workbench' && ctx.surface !== 'quiz' && ctx.surface !== 'create') return ctx; // 目录不响应
      return { ...ctx, state: 'QUIET_HELP' };
    }
    case 'CLOSE_HELP': {
      if (ctx.state !== 'QUIET_HELP') return ctx;
      if (ctx.surface === 'workbench') return { ...ctx, state: workbenchResting(ctx.mainlineComplete) };
      if (ctx.surface === 'create') return { ...ctx, state: 'IDLE' };
      return ctx; // 测验表面保持轻答疑
    }
    case 'RESET_LESSON':
      return { ...ctx, mainlineComplete: false, state: ctx.surface === 'workbench' ? 'GUIDING' : 'IDLE' };
    default:
      return ctx;
  }
}

/** 是否允许展示逐步引导卡片（GuideStepCard） */
export function canShowGuide(ctx: AgentContext): boolean {
  return ctx.surface === 'workbench' && ctx.state === 'GUIDING';
}
