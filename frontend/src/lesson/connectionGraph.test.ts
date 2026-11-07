import { describe, expect, it } from 'vitest';
import { checkCodeAgainstGraph, validateGraph } from './connectionGraph';
import { getBoard } from './board';
import { FIRST_LESSON_CODE_BINDINGS, FIRST_LESSON_COMPONENTS, FIRST_LESSON_GRAPH, rewire } from './coursePack';
import { FIRST_LESSON_CODE } from './firmware';

const board = getBoard('xiao-esp32-s3')!;
const v = (g = FIRST_LESSON_GRAPH) => validateGraph(g, board, FIRST_LESSON_COMPONENTS);

describe('validate(ConnectionGraph, board.json)', () => {
  it('course pack default graph passes with no warnings', () => {
    const r = v();
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('board.json is the capability truth: signal to a power pin is an error', () => {
    const r = v(rewire(FIRST_LESSON_GRAPH, 'dht-data', '5V'));
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe('CAPABILITY_MISSING');
    expect(r.errors[0].childMessage).toContain('DATA');
  });

  it('VCC into GND is a short circuit error', () => {
    const r = v(rewire(FIRST_LESSON_GRAPH, 'bz-vcc', 'GND'));
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('SHORT_CIRCUIT');
  });

  it('two signals on the same pin conflict', () => {
    const r = v(rewire(FIRST_LESSON_GRAPH, 'bz-s', 'D0'));
    expect(r.errors.map((e) => e.code)).toContain('PIN_CONFLICT');
  });

  it('unknown pin and board mismatch are errors', () => {
    expect(v(rewire(FIRST_LESSON_GRAPH, 'bz-s', 'D99')).errors[0].code).toBe('UNKNOWN_PIN');
    expect(v({ ...FIRST_LESSON_GRAPH, boardId: 'arduino-uno' }).ok).toBe(false);
  });

  it('missing wire is an error', () => {
    const g = { ...FIRST_LESSON_GRAPH, edges: FIRST_LESSON_GRAPH.edges.filter((e) => e.id !== 'dht-gnd') };
    expect(v(g).errors.map((e) => e.code)).toContain('PORT_UNCONNECTED');
  });

  it('strapping pin and 5V power are warnings (compile still allowed)', () => {
    const strap = v(rewire(FIRST_LESSON_GRAPH, 'dht-data', 'D2'));
    expect(strap.ok).toBe(true);
    expect(strap.warnings[0].code).toBe('BOARD_CONSTRAINT');
    const five = v(rewire(FIRST_LESSON_GRAPH, 'dht-vcc', '5V'));
    expect(five.ok).toBe(true);
    expect(five.warnings.map((w) => w.code)).toContain('VOLTAGE_MISMATCH');
  });

  it('code pins match the graph; mismatch is a warning', () => {
    expect(checkCodeAgainstGraph(FIRST_LESSON_CODE, FIRST_LESSON_GRAPH, board, FIRST_LESSON_CODE_BINDINGS)).toEqual([]);
    const moved = rewire(FIRST_LESSON_GRAPH, 'bz-s', 'D3');
    const issues = checkCodeAgainstGraph(FIRST_LESSON_CODE, moved, board, FIRST_LESSON_CODE_BINDINGS);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
  });
});
