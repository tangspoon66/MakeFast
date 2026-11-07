/**
 * 正交连线路由（像 aily-blockly 那样只走横竖线）：
 * 板子右侧引脚 → 右侧走线通道里的独立竖道 → 元件引脚；
 * 板子左侧引脚 → 左侧竖道 → 绕到板子上方/下方的独立横道 → 右侧竖道 → 元件引脚。
 * 每根线在每个通道里都有自己的车道（x 或 y 不同），所以不同线之间不会共线重叠，只会十字交叉。
 * 同一个板子引脚上的几根线（GND、3V3 共用）是同一电气网络，允许共用出线段。
 */
export type Pt = { x: number; y: number };
export type Side = 'left' | 'right';
export interface NetIn { id: string; from: Pt; fromSide: Side; to: Pt; color: string }
export interface Layout {
  /** 板子外框 */
  board: { x: number; y: number; width: number; height: number };
  /** 右侧通道（板子右边缘与元件左边缘之间）的 x 范围 */
  rightChannel: [number, number];
  /** 左侧通道（板子左边缘外）的 x 范围；车道从靠近板子往外排 */
  leftChannel: [number, number];
  /** 横道间距 */
  pitch?: number;
}
export interface Routed { id: string; color: string; points: Pt[]; path: string }

const keyOf = (p: Pt) => `${Math.round(p.x)},${Math.round(p.y)}`;

export function routeNets(nets: NetIn[], layout: Layout, radius = 6): Routed[] {
  const pitch = layout.pitch ?? 10;
  const { board } = layout;
  // 右侧车道：按“终点 y”排序分配，减少交叉；同一源引脚+同一终点不会出现
  const order = [...nets].sort((a, b) => a.to.y - b.to.y || a.from.y - b.from.y);
  const [r0, r1] = layout.rightChannel;
  const rightLanes = new Map<string, number>();
  const rSpan = Math.max(1, order.length - 1);
  const rStep = Math.min(pitch * 1.6, (r1 - r0 - 2 * pitch) / rSpan);
  // 往下走的线用靠近元件的车道、往上走的用靠近板子的车道，这样相邻线基本平行不交叉
  order.forEach((n, i) => rightLanes.set(n.id, r0 + pitch + i * rStep));

  const lefties = nets.filter((n) => n.fromSide === 'left');
  const midY = board.y + board.height / 2;
  const top = lefties.filter((n) => n.from.y <= midY).sort((a, b) => a.from.y - b.from.y);
  const bottom = lefties.filter((n) => n.from.y > midY).sort((a, b) => b.from.y - a.from.y);
  const leftLane = new Map<string, number>();
  const busY = new Map<string, number>();
  const [l0, l1] = layout.leftChannel; // l1 靠近板子
  // 上方：最上面的引脚走最里面（靠近板子）的竖道和最低的横道 → 嵌套不交叉
  top.forEach((n, i) => { leftLane.set(n.id, l1 - pitch - i * pitch); busY.set(n.id, board.y - pitch - i * pitch); });
  bottom.forEach((n, i) => { leftLane.set(n.id, l1 - pitch - i * pitch); busY.set(n.id, board.y + board.height + pitch + i * pitch); });
  void l0;

  return nets.map((n) => {
    const rx = rightLanes.get(n.id)!;
    let pts: Pt[];
    if (n.fromSide === 'right') {
      pts = [n.from, { x: rx, y: n.from.y }, { x: rx, y: n.to.y }, n.to];
    } else {
      const lx = leftLane.get(n.id)!; const by = busY.get(n.id)!;
      pts = [n.from, { x: lx, y: n.from.y }, { x: lx, y: by }, { x: rx, y: by }, { x: rx, y: n.to.y }, n.to];
    }
    pts = simplify(pts);
    return { id: n.id, color: n.color, points: pts, path: roundedPath(pts, radius) };
  });
}

/** 去掉重复点和共线中间点 */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length && keyOf(out[out.length - 1]) === keyOf(p)) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}

/** 折线 → SVG 路径，拐角用小圆角 */
export function roundedPath(pts: Pt[], r: number): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const d1 = Math.hypot(c.x - p.x, c.y - p.y), d2 = Math.hypot(n.x - c.x, n.y - c.y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = { x: c.x - ((c.x - p.x) / (d1 || 1)) * rr, y: c.y - ((c.y - p.y) / (d1 || 1)) * rr };
    const b = { x: c.x + ((n.x - c.x) / (d2 || 1)) * rr, y: c.y + ((n.y - c.y) / (d2 || 1)) * rr };
    d += ` L ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export type Seg = { a: Pt; b: Pt; id: string };
export function segments(r: Routed[]): Seg[] {
  return r.flatMap((w) => w.points.slice(1).map((b, i) => ({ a: w.points[i], b, id: w.id })));
}
/** 两条线段是否共线且有一段重叠（长度 > 0） */
export function collinearOverlap(s: Seg, t: Seg): boolean {
  const H = (q: Seg) => q.a.y === q.b.y;
  if (H(s) && H(t) && s.a.y === t.a.y) {
    const [a0, a1] = [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)];
    const [b0, b1] = [Math.min(t.a.x, t.b.x), Math.max(t.a.x, t.b.x)];
    return Math.min(a1, b1) - Math.max(a0, b0) > 0.5;
  }
  if (!H(s) && !H(t) && s.a.x === t.a.x) {
    const [a0, a1] = [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)];
    const [b0, b1] = [Math.min(t.a.y, t.b.y), Math.max(t.a.y, t.b.y)];
    return Math.min(a1, b1) - Math.max(a0, b0) > 0.5;
  }
  return false;
}
