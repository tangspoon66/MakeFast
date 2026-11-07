import { describe, expect, it } from 'vitest';
import pinmap from '../packages/xiao-esp32-s3.pinmap.json';
import { FIRST_LESSON_COMPONENTS, FIRST_LESSON_GRAPH } from '../coursePack';
import { collinearOverlap, roundedPath, routeNets, segments, simplify } from './orthoRouter';
import { schematicLayout, type PinAnchor } from './schematicLayout';
import type { ConnectionGraph } from '../connectionGraph';

const PINS = (pinmap as { pins: PinAnchor[] }).pins;

function check(graph: ConnectionGraph) {
  const L = schematicLayout(graph, FIRST_LESSON_COMPONENTS, PINS);
  const r = routeNets(L.nets, L.router);
  expect(r.length).toBe(graph.edges.length);
  const segs = segments(r);
  // 1) 没有斜线：每段要么水平要么竖直
  for (const s of segs) expect(s.a.x === s.b.x || s.a.y === s.b.y, `${s.id} 有斜线`).toBe(true);
  // 2) 不同线之间没有共线重叠（同一个板子引脚出来的几根线属同一电气网络，允许共用出线段）
  const fromOf = new Map(L.nets.map((n) => [n.id, `${n.from.x},${n.from.y}`]));
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const a = segs[i], b = segs[j];
    if (a.id === b.id || fromOf.get(a.id) === fromOf.get(b.id)) continue;
    expect(collinearOverlap(a, b), `${a.id} 与 ${b.id} 重叠`).toBe(false);
  }
  // 3) 起点在板子引脚、终点在元件端口；竖直走线不穿过元件模块
  for (const w of r) {
    const n = L.nets.find((x) => x.id === w.id)!;
    expect(w.points[0]).toEqual(n.from);
    expect(w.points[w.points.length - 1]).toEqual(n.to);
  }
  for (const s of segs) if (s.a.x === s.b.x) expect(s.a.x).toBeLessThan(L.modules[0].x);
  // 4) 都在画布内
  for (const s of segs) for (const p of [s.a, s.b]) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.y).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(L.width); expect(p.y).toBeLessThanOrEqual(L.height); }
  return r;
}

describe('正交连线路由', () => {
  it('第一课默认接法：全是横竖线、不重叠、起止点正确', () => {
    const r = check(FIRST_LESSON_GRAPH);
    // D0 / D1 在板子左侧，必须绕到板子上方再到右边
    const d0 = r.find((w) => FIRST_LESSON_GRAPH.edges.find((e) => e.id === w.id)?.to.port === 'D0')!;
    expect(Math.min(...d0.points.map((p) => p.y))).toBeLessThan(44);
  });

  it('孩子把线改到任意引脚（左右两侧都有）也保持正交、不重叠', () => {
    const ids = PINS.map((p) => p.id);
    for (let k = 0; k < 40; k++) {
      const g: ConnectionGraph = { ...FIRST_LESSON_GRAPH, edges: FIRST_LESSON_GRAPH.edges.map((e, i) => ({ ...e, to: { ...e.to, port: ids[(k * 7 + i * 5) % ids.length] } })) };
      check(g);
    }
  });

  it('simplify 去掉共线点；圆角路径只含 M / L / Q', () => {
    expect(simplify([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 10 }])).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const d = roundedPath([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }], 6);
    expect(d).toMatch(/^M 0 0 L 14 0 Q 20 0 20 6 L 20 20$/);
  });
});
