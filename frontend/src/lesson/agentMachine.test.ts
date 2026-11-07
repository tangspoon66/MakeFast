import { describe, expect, it } from 'vitest';
import { agentTransition, canShowGuide, INITIAL_AGENT, type AgentContext } from './agentMachine';

const go = (ctx: AgentContext, ...events: Parameters<typeof agentTransition>[1][]) =>
  events.reduce((c, e) => agentTransition(c, e), ctx);

describe('agent state machine', () => {
  it('stays IDLE on welcome / home / catalog / detail (M7)', () => {
    for (const surface of ['welcome', 'home', 'catalog', 'detail'] as const) {
      const ctx = go(INITIAL_AGENT, { type: 'SURFACE', surface });
      expect(ctx.state).toBe('IDLE');
      expect(canShowGuide(ctx)).toBe(false);
    }
  });

  it('enters GUIDING only on workbench and returns to IDLE when leaving', () => {
    const inWb = go(INITIAL_AGENT, { type: 'SURFACE', surface: 'workbench' });
    expect(inWb.state).toBe('GUIDING');
    expect(canShowGuide(inWb)).toBe(true);
    expect(go(inWb, { type: 'SURFACE', surface: 'catalog' }).state).toBe('IDLE');
  });

  it('ignores ASK_HELP on catalog', () => {
    expect(go(INITIAL_AGENT, { type: 'ASK_HELP' }).state).toBe('IDLE');
  });

  it('QUIET_HELP then back to GUIDING', () => {
    const c = go(INITIAL_AGENT, { type: 'SURFACE', surface: 'workbench' }, { type: 'ASK_HELP' });
    expect(c.state).toBe('QUIET_HELP');
    expect(go(c, { type: 'CLOSE_HELP' }).state).toBe('GUIDING');
  });

  it('phenomenon success → WRAP_UP, and re-entering workbench resumes WRAP_UP', () => {
    const c = go(INITIAL_AGENT, { type: 'SURFACE', surface: 'workbench' }, { type: 'PHENOMENON_SUCCESS' });
    expect(c.state).toBe('WRAP_UP');
    expect(canShowGuide(c)).toBe(false);
    const back = go(c, { type: 'SURFACE', surface: 'catalog' }, { type: 'SURFACE', surface: 'workbench' });
    expect(back.state).toBe('WRAP_UP');
  });

  it('quiz surface is locked (IDLE) before mainline, QUIET_HELP after', () => {
    expect(go(INITIAL_AGENT, { type: 'SURFACE', surface: 'quiz' }).state).toBe('IDLE');
    const done = go(INITIAL_AGENT, { type: 'SURFACE', surface: 'workbench' }, { type: 'PHENOMENON_SUCCESS' }, { type: 'SURFACE', surface: 'quiz' });
    expect(done.state).toBe('QUIET_HELP');
  });
});

  it('自由创作 surface=create：IDLE，求助后 QUIET_HELP，关闭回 IDLE', () => {
    const idle = go(INITIAL_AGENT, { type: 'SURFACE', surface: 'create' });
    expect(idle.state).toBe('IDLE');
    const help = go(idle, { type: 'ASK_HELP' });
    expect(help.state).toBe('QUIET_HELP');
    expect(go(help, { type: 'CLOSE_HELP' }).state).toBe('IDLE');
  });
