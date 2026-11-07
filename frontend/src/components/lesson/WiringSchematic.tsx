/**
 * 统一连线图：真实 XIAO ESP32-S3 板形（board.svg + pinmap 的真实引脚坐标，左右两排）+ 写实元件模块，
 * 导线只走横竖线（正交路由，每根线独占车道，拐角小圆角），按信号着色。
 * 「实物照片」页签仍可看板子照片。
 */
import { useState } from 'react';
import pinmap from '../../lesson/packages/xiao-esp32-s3.pinmap.json';
import type { ComponentDef, ConnectionGraph } from '../../lesson/connectionGraph';
import { routeNets, type NetIn } from '../../lesson/wiring/orthoRouter';
import { schematicLayout, type PinAnchor } from '../../lesson/wiring/schematicLayout';

const PINMAP = pinmap as { viewBox: number[]; pins: PinAnchor[] };

interface Props {
  graph: ConnectionGraph;
  components: ComponentDef[];
  activeEdgeIds: string[] | null;
  activeNodeIds: string[] | null;
  errorEdges: Set<string | undefined>;
  warnEdges: Set<string | undefined>;
}

function Module({ def, x, y, w, h, ports }: { def?: ComponentDef; x: number; y: number; w: number; h: number; ports: { name: string; y: number }[] }) {
  const t = def?.type ?? '';
  const body = t.includes('dht') ? (
    <g>
      {/* DHT22：白色带格栅的传感器外壳 */}
      <rect x={x + w - 52} y={y + 8} width={44} height={h - 16} rx={4} fill="#F7F8FA" stroke="#C7CDD4" />
      {Array.from({ length: Math.max(3, Math.floor((h - 28) / 9)) }, (_, i) => (
        <g key={i}>{[0, 1, 2].map((j) => <rect key={j} x={x + w - 46 + j * 12} y={y + 14 + i * 9} width={8} height={5} rx={1.5} fill="#CBD2DA" />)}</g>
      ))}
    </g>
  ) : t.includes('buzzer') ? (
    <g>
      {/* 有源蜂鸣器：黑色圆柱 + 中心孔 */}
      <circle cx={x + w - 30} cy={y + h / 2} r={22} fill="#1E242B" stroke="#0E1216" strokeWidth={2} />
      <circle cx={x + w - 30} cy={y + h / 2} r={14} fill="none" stroke="#39424D" />
      <circle cx={x + w - 30} cy={y + h / 2} r={4} fill="#0B0E11" />
      <text x={x + w - 30} y={y + h / 2 - 9} textAnchor="middle" fontSize={6} fill="#8893A0">+</text>
    </g>
  ) : (
    <text x={x + w - 30} y={y + h / 2 + 6} textAnchor="middle" fontSize={20}>{def?.emoji}</text>
  );
  return (
    <g>
      {/* 模块 PCB（蓝色板 + 安装孔 + 排针） */}
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#1E5FA8" stroke="#164A84" strokeWidth={1.5} />
      <circle cx={x + w - 6} cy={y + 6} r={2.5} fill="#0E3563" />
      <circle cx={x + w - 6} cy={y + h - 6} r={2.5} fill="#0E3563" />
      {body}
      {ports.map((p) => (
        <g key={p.name}>
          <rect x={x - 6} y={p.y - 3} width={10} height={6} rx={1} fill="#C9A227" />
          <rect x={x + 4} y={p.y - 4} width={8} height={8} rx={1} fill="#111" />
          <text x={x + 16} y={p.y + 3.5} fontSize={9} fontWeight={700} fill="#fff">{p.name}</text>
        </g>
      ))}
      <text x={x} y={y - 5} fontSize={10.5} fontWeight={700} fill="#23384D">{def?.emoji} {def?.displayName.replace(/温湿度传感器|有源/, '').trim()}</text>
    </g>
  );
}

export function WiringSchematic({ graph, components, activeEdgeIds, activeNodeIds, errorEdges, warnEdges }: Props) {
  const [view, setView] = useState<'diagram' | 'photo'>('diagram');
  const L = schematicLayout(graph, components, PINMAP.pins);
  const nets: NetIn[] = L.nets;
  const routed = routeNets(nets, L.router, 6);
  const used = new Set(graph.edges.map((e) => e.to.port));
  const edgeOf = new Map(graph.edges.map((e) => [e.id, e]));
  return (
    <figure className="lw-boardview" data-testid="board-pin-view">
      <div className="lw-boardview__tabs" role="tablist" aria-label="连线图视图">
        <button type="button" role="tab" aria-selected={view === 'diagram'} className={view === 'diagram' ? 'is-on' : ''} onClick={() => setView('diagram')}>连线图</button>
        <button type="button" role="tab" aria-selected={view === 'photo'} className={view === 'photo' ? 'is-on' : ''} onClick={() => setView('photo')}>实物照片</button>
      </div>
      {view === 'photo' ? (
        <img src="/boards/xiao-esp32-s3/photo.webp" alt="Seeed Studio XIAO ESP32-S3 实物照片" style={{ width: '100%', maxWidth: 260, borderRadius: 12 }} loading="lazy" />
      ) : (
        <svg viewBox={`0 0 ${L.width} ${L.height}`} width="100%" role="img" data-testid="wiring-schematic"
          aria-label={`连线图：XIAO ESP32-S3 连接 ${graph.nodes.filter((n) => n.kind === 'component').map((n) => n.label).join('、')}`}>
          <image href="/boards/xiao-esp32-s3/board.svg" x={L.board.x} y={L.board.y} width={L.board.width} height={L.board.height} />
          {/* 每个引脚都可被小铁猫定位；用到的引脚画同色圆环 */}
          {PINMAP.pins.map((p) => {
            const e = graph.edges.find((x) => x.to.port === p.id);
            const active = !activeEdgeIds || (e ? activeEdgeIds.includes(e.id) : false);
            return (
              <g key={p.id} data-board-pin={p.id} opacity={used.has(p.id) ? (active ? 1 : 0.35) : 1}>
                <circle cx={L.board.x + p.x} cy={L.board.y + p.y} r={9} fill="transparent" />
                {e && (
                  <g data-pin-mark={p.id}>
                    <circle cx={L.board.x + p.x} cy={L.board.y + p.y} r={9} fill="none" stroke={errorEdges.has(e.id) ? '#E2595B' : e.color || '#4A90C8'} strokeWidth={3}
                      className={activeEdgeIds && active ? 'lw-pin-pulse' : undefined} />
                  </g>
                )}
              </g>
            );
          })}
          {routed.map((w) => {
            const e = edgeOf.get(w.id)!;
            const active = !activeEdgeIds || activeEdgeIds.includes(w.id);
            const isErr = errorEdges.has(w.id);
            return (
              <g key={w.id} opacity={active ? 1 : 0.22} data-edge={w.id} data-lw-anchor={`wire.${w.id}`} data-active={active || undefined} data-points={w.points.map((p) => `${p.x},${p.y}`).join(' ')}>
                {(isErr || warnEdges.has(w.id)) && <path d={w.path} stroke={isErr ? '#E2595B' : '#F4C65C'} strokeWidth={8} fill="none" opacity={0.35} strokeLinejoin="round" />}
                <path d={w.path} stroke="#fff" strokeWidth={activeEdgeIds && active ? 6.5 : 5} fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
                <path d={w.path} stroke={e.color || '#4A90C8'} strokeWidth={activeEdgeIds && active ? 3.5 : 2.6} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={isErr ? '6 4' : undefined} />
                <circle cx={w.points[0].x} cy={w.points[0].y} r={3.2} fill={e.color} />
                <circle cx={w.points[w.points.length - 1].x} cy={w.points[w.points.length - 1].y} r={3.2} fill={e.color} />
              </g>
            );
          })}
          {L.modules.map((m) => (
            <g key={m.nodeId} opacity={!activeNodeIds || activeNodeIds.includes(m.nodeId) ? 1 : 0.4}>
              <Module def={m.def} x={m.x} y={m.y} w={m.w} h={m.h} ports={m.ports} />
            </g>
          ))}
        </svg>
      )}
      <figcaption>USB 口朝上看正面：左边 D0–D6，右边 5V / GND / 3V3 / D10–D7</figcaption>
    </figure>
  );
}
