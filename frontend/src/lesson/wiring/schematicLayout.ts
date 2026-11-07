/** 统一连线图的几何布局（纯函数，便于测试）：真实板形在左，元件模块在右，左右两侧留走线通道。 */
import type { ComponentDef, ConnectionGraph } from '../connectionGraph';
import type { Layout, NetIn } from './orthoRouter';

export interface PinAnchor { id: string; x: number; y: number; side: string; gpio?: number }

export const BOARD_W = 210, BOARD_H = 250;
const LEFT_CH = 46, TOP = 44;
const MOD_X = BOARD_W + LEFT_CH + 84, MOD_W = 112, PORT_DY = 22, MOD_HEAD = 18, MOD_GAP = 34;

export function schematicLayout(graph: ConnectionGraph, components: ComponentDef[], pins: PinAnchor[]) {
  const board = { x: LEFT_CH, y: TOP, width: BOARD_W, height: BOARD_H };
  const defs = new Map(components.map((c) => [c.type, c]));
  const pinPos = new Map(pins.map((p) => [p.id, p]));
  const modules: { nodeId: string; def?: ComponentDef; x: number; y: number; w: number; h: number; ports: { name: string; y: number }[] }[] = [];
  // 元件纵向排开；端口 y 错开半个引脚间距，避免和板子引脚同一水平线（减少共线）
  let y = TOP + 18;
  for (const n of graph.nodes.filter((x) => x.kind === 'component')) {
    const def = defs.get(n.ref);
    const k = def?.ports.length ?? 0;
    const h = Math.max(64, MOD_HEAD + k * PORT_DY + 8);
    modules.push({ nodeId: n.id, def, x: MOD_X, y, w: MOD_W, h, ports: (def?.ports ?? []).map((p, i) => ({ name: p.name, y: y + MOD_HEAD + 6 + i * PORT_DY })) });
    y += h + MOD_GAP;
  }
  const portAt = new Map(modules.flatMap((m) => m.ports.map((p) => [`${m.nodeId}:${p.name}`, { x: m.x - 6, y: p.y }])));
  const nets: NetIn[] = [];
  for (const e of graph.edges) {
    const pin = pinPos.get(e.to.port);
    const to = portAt.get(`${e.from.nodeId}:${e.from.port}`);
    if (!pin || !to) continue;
    nets.push({ id: e.id, from: { x: board.x + pin.x, y: board.y + pin.y }, fromSide: pin.side === 'left' ? 'left' : 'right', to, color: e.color || '#4A90C8' });
  }
  const router: Layout = { board, rightChannel: [board.x + BOARD_W, MOD_X - 6], leftChannel: [0, board.x], pitch: 9 };
  const width = MOD_X + MOD_W + 8;
  const height = Math.max(TOP + BOARD_H + 30, y);
  return { board, modules, nets, router, width, height };
}
