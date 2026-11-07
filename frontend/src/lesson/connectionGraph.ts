/**
 * ConnectionGraph（对内模型名；对外文案统一叫「连线图」）。
 * 校验真源 = BoardDocument（board.json）的引脚能力 + 课包 ComponentDef。
 * 行为对标 aily 的“按引脚能力约束连线”约定，代码为 MakeFast 自研（未复制任何 GPL 代码）。
 */
import { findPin, isPowerCap, type BoardDocument, type PinCapability } from './board';

export type PortRole = 'power' | 'gnd' | 'signal';

export interface ComponentPort {
  name: string;
  role: PortRole;
  /** 可接受的板上引脚能力（满足任一即可） */
  accepts: PinCapability[];
  required: boolean;
  /** 儿童可读说明 */
  hint: string;
}

export interface ComponentDef {
  type: string;
  displayName: string;
  emoji: string;
  ports: ComponentPort[];
}

export interface GraphNode {
  id: string;
  kind: 'board' | 'component';
  /** board → BoardDocument.id；component → ComponentDef.type */
  ref: string;
  label?: string;
}

export interface PortRef { nodeId: string; port: string }

export interface GraphEdge {
  id: string;
  from: PortRef; // 元件端口
  to: PortRef;   // 板子引脚
  color?: string;
}

export interface StepAnchor { id: string; edgeIds: string[]; nodeIds: string[] }

export interface ConnectionGraph {
  schemaVersion: string;
  id: string;
  coursePackId: string;
  boardId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stepAnchors: StepAnchor[];
}

export type IssueSeverity = 'error' | 'warning';
export type IssueCode =
  | 'BOARD_MISMATCH' | 'UNKNOWN_NODE' | 'UNKNOWN_COMPONENT' | 'UNKNOWN_PORT' | 'UNKNOWN_PIN'
  | 'NOT_TO_BOARD' | 'CAPABILITY_MISSING' | 'SHORT_CIRCUIT' | 'PIN_CONFLICT'
  | 'PORT_DUPLICATE' | 'PORT_UNCONNECTED' | 'BOARD_CONSTRAINT' | 'VOLTAGE_MISMATCH' | 'CODE_PIN_MISMATCH';

export interface GraphIssue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  childMessage: string;
  edgeId?: string;
  nodeId?: string;
}

export interface ValidationResult {
  /** 没有 error 级问题即 ok（warning 允许编译，显示黄色提示） */
  ok: boolean;
  errors: GraphIssue[];
  warnings: GraphIssue[];
}

const CAP_WORD: Partial<Record<PinCapability, string>> = {
  power_3v3: '3V3 电源', power_5v: '5V 电源', gnd: 'GND（地）', digital_in: '数字输入', digital_out: '数字输出',
};

export function validateGraph(graph: ConnectionGraph, board: BoardDocument, components: ComponentDef[]): ValidationResult {
  const issues: GraphIssue[] = [];
  const push = (i: GraphIssue) => issues.push(i);

  if (graph.boardId !== board.id) {
    push({ code: 'BOARD_MISMATCH', severity: 'error', message: `graph.boardId ${graph.boardId} != ${board.id}`,
      childMessage: `这张连线图是给 ${graph.boardId} 画的，和现在选的开发板不一样。` });
  }

  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const defs = new Map(components.map((c) => [c.type, c]));
  const boardNodeIds = new Set(graph.nodes.filter((n) => n.kind === 'board').map((n) => n.id));
  for (const n of graph.nodes) {
    if (n.kind === 'board' && n.ref !== board.id) {
      push({ code: 'BOARD_MISMATCH', severity: 'error', nodeId: n.id, message: `board node ${n.id} ref ${n.ref}`, childMessage: '连线图里的开发板型号不对。' });
    }
    if (n.kind === 'component' && !defs.has(n.ref)) {
      push({ code: 'UNKNOWN_COMPONENT', severity: 'error', nodeId: n.id, message: `unknown component ${n.ref}`, childMessage: `不认识元件「${n.label || n.ref}」。` });
    }
  }

  const pinUsers = new Map<string, { edgeId: string; role: PortRole; nodeId: string; port: string }[]>();
  const portUse = new Map<string, string[]>(); // `${node}.${port}` -> edgeIds

  for (const e of graph.edges) {
    const compNode = nodes.get(e.from.nodeId);
    const boardNode = nodes.get(e.to.nodeId);
    if (!compNode || !boardNode) {
      push({ code: 'UNKNOWN_NODE', severity: 'error', edgeId: e.id, message: `edge ${e.id} references missing node`, childMessage: '有一根线的一头没有接到任何东西上。' });
      continue;
    }
    if (compNode.kind !== 'component' || !boardNodeIds.has(boardNode.id)) {
      push({ code: 'NOT_TO_BOARD', severity: 'error', edgeId: e.id, message: `edge ${e.id} must go component -> board`, childMessage: '第一课里，每根线都要从元件接到开发板上。' });
      continue;
    }
    const def = defs.get(compNode.ref);
    const port = def?.ports.find((p) => p.name === e.from.port);
    const label = def?.displayName || compNode.ref;
    if (!port) {
      push({ code: 'UNKNOWN_PORT', severity: 'error', edgeId: e.id, message: `${compNode.ref} has no port ${e.from.port}`, childMessage: `「${label}」上没有叫 ${e.from.port} 的脚。` });
      continue;
    }
    const pin = findPin(board, e.to.port);
    if (!pin) {
      push({ code: 'UNKNOWN_PIN', severity: 'error', edgeId: e.id, message: `board has no pin ${e.to.port}`, childMessage: `开发板上没有叫 ${e.to.port} 的引脚。` });
      continue;
    }
    const portKey = `${compNode.id}.${port.name}`;
    portUse.set(portKey, [...(portUse.get(portKey) || []), e.id]);

    const caps = pin.capabilities;
    const powerToGnd = port.role === 'power' && caps.includes('gnd');
    const gndToPower = port.role === 'gnd' && caps.some(isPowerCap);
    if (powerToGnd || gndToPower) {
      push({ code: 'SHORT_CIRCUIT', severity: 'error', edgeId: e.id, message: `${portKey} (${port.role}) -> ${pin.id}`,
        childMessage: `「${label}」的 ${port.name} 接到了 ${pin.id}，电源和地接反会短路，可能烧坏零件！请改接到${port.role === 'power' ? ' 3V3' : ' GND'}。` });
    } else if (!port.accepts.some((c) => caps.includes(c))) {
      const want = port.accepts.map((c) => CAP_WORD[c] || c).join(' 或 ');
      push({ code: 'CAPABILITY_MISSING', severity: 'error', edgeId: e.id, message: `${pin.id} lacks ${port.accepts.join('|')}`,
        childMessage: `「${label}」的 ${port.name} 需要接到「${want}」引脚，${pin.id} 做不到。` });
    }

    pinUsers.set(pin.id, [...(pinUsers.get(pin.id) || []), { edgeId: e.id, role: port.role, nodeId: compNode.id, port: port.name }]);

    for (const c of board.constraints.filter((k) => k.pin === pin.id)) {
      if (port.role !== 'signal') continue;
      push({ code: 'BOARD_CONSTRAINT', severity: c.severity, edgeId: e.id, message: `${pin.id}: ${c.kind}`, childMessage: c.childMessage });
    }
  }

  // 同一个信号引脚只能给一个元件用（电源/地可以共用）
  for (const [pinId, users] of pinUsers) {
    const signals = users.filter((u) => u.role === 'signal');
    if (signals.length > 1) {
      push({ code: 'PIN_CONFLICT', severity: 'error', edgeId: signals[1].edgeId, message: `${pinId} used by ${signals.map((s) => `${s.nodeId}.${s.port}`).join(', ')}`,
        childMessage: `${pinId} 同时接了两个元件的信号线，它们会“抢话”。请把其中一根换到别的引脚。` });
    }
  }

  for (const n of graph.nodes.filter((x) => x.kind === 'component')) {
    const def = defs.get(n.ref);
    if (!def) continue;
    for (const p of def.ports) {
      const used = portUse.get(`${n.id}.${p.name}`) || [];
      if (used.length > 1) {
        push({ code: 'PORT_DUPLICATE', severity: 'error', nodeId: n.id, edgeId: used[1], message: `${n.id}.${p.name} connected ${used.length}x`, childMessage: `「${def.displayName}」的 ${p.name} 接了不止一根线。` });
      }
      if (p.required && used.length === 0) {
        push({ code: 'PORT_UNCONNECTED', severity: 'error', nodeId: n.id, message: `${n.id}.${p.name} unconnected`, childMessage: `「${def.displayName}」的 ${p.name} 还没接线。` });
      }
    }
    // 元件接 5V 供电、信号却接到 3.3V 芯片引脚 → 提醒
    const vccEdge = graph.edges.find((e) => e.from.nodeId === n.id && def.ports.find((p) => p.name === e.from.port)?.role === 'power');
    if (vccEdge && findPin(board, vccEdge.to.port)?.capabilities.includes('power_5v') && board.logicVoltage < 5) {
      push({ code: 'VOLTAGE_MISMATCH', severity: 'warning', nodeId: n.id, edgeId: vccEdge.id, message: `${n.id} powered by 5V on 3.3V board`,
        childMessage: `「${def.displayName}」接的是 5V，但小板的引脚只能承受 3.3V，信号可能太“大声”。第一课建议接 3V3。` });
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}

/** 课包声明：程序里的哪个 #define 对应连线图里的哪根线 */
export interface CodePinBinding { define: string; nodeId: string; port: string }

/** 检查程序里的引脚号是否与连线图一致（不一致 → warning，允许编译） */
export function checkCodeAgainstGraph(code: string, graph: ConnectionGraph, board: BoardDocument, bindings: CodePinBinding[]): GraphIssue[] {
  const issues: GraphIssue[] = [];
  for (const b of bindings) {
    const m = code.match(new RegExp(`#define\\s+${b.define}\\s+(\\w+)`));
    if (!m) continue;
    const edge = graph.edges.find((e) => e.from.nodeId === b.nodeId && e.from.port === b.port);
    if (!edge) continue;
    const pin = findPin(board, edge.to.port);
    if (!pin || pin.gpio === undefined) continue;
    const raw = m[1];
    const codeGpio = /^\d+$/.test(raw) ? Number(raw) : findPin(board, raw)?.gpio;
    if (codeGpio !== undefined && codeGpio !== pin.gpio) {
      issues.push({ code: 'CODE_PIN_MISMATCH', severity: 'warning', edgeId: edge.id,
        message: `${b.define}=${raw} but graph uses ${pin.id}(GPIO${pin.gpio})`,
        childMessage: `程序里 ${b.define} 写的是 ${raw}，但连线图把线接在 ${pin.id}（GPIO${pin.gpio}）。可以编译，但现象可能出不来——把程序改成 ${pin.gpio}，或把线改回去。` });
    }
  }
  return issues;
}
