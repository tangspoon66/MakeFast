/**
 * 「连线图」面板。接线步骤自动全屏（大板 / 大字）；可手动开关；Esc 退出。
 * 引脚下拉统一样式：文字省略号、箭头固定右侧垂直居中。
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WiringSchematic } from './WiringSchematic';
import { useAgentAnchor } from '../../lesson/agent/anchors';
import type { BoardDocument } from '../../lesson/board';
import type { ComponentDef, ConnectionGraph, GraphIssue, ValidationResult } from '../../lesson/connectionGraph';

interface WiringDiagramPanelProps {
  graph: ConnectionGraph;
  board: BoardDocument;
  components: ComponentDef[];
  validation: ValidationResult;
  codeIssues: GraphIssue[];
  activeAnchor?: string | null;
  highlighted?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onRewire: (edgeId: string, pinId: string) => void;
  onReset: () => void;
  isDefault: boolean;
  /** 全屏（接线步骤自动进入；手动开关 / Esc 退出） */
  fullscreen: boolean;
  onFullscreenChange: (v: boolean) => void;
}

export function WiringDiagramPanel(props: WiringDiagramPanelProps) {
  const { graph, board, components, validation, codeIssues, activeAnchor, highlighted, collapsed, fullscreen } = props;
  const panelRef = useAgentAnchor<HTMLElement>('wiring.panel', { label: '「连线图」面板', kind: 'panel', region: 'wiring', collapsed: collapsed && !fullscreen });
  const toggleRef = useAgentAnchor<HTMLButtonElement>('wiring.toggle', { label: '连线图的展开/收起按钮', kind: 'toggle', region: 'wiring', collapsed });
  const resetRef = useAgentAnchor<HTMLButtonElement>('wiring.reset', { label: '「恢复课程推荐接法」按钮', kind: 'button', region: 'wiring' });
  const fsBtnRef = useAgentAnchor<HTMLButtonElement>('wiring.fullscreen', { label: '连线图全屏开关', kind: 'button', region: 'wiring' });
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onFullscreenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, props.onFullscreenChange]);

  if (collapsed && !fullscreen) {
    return (
      <aside ref={panelRef} className="lw-panel lw-wiring lw-wiring--collapsed" data-lw-anchor="wiring.panel" data-lw-avoid="" aria-label="连线图（已收起）">
        <button ref={toggleRef} type="button" className="lw-course__toggle" style={{ margin: 10 }} onClick={props.onToggle} aria-label="展开连线图">«</button>
        <span style={{ writingMode: 'vertical-rl', margin: '4px auto', fontWeight: 700, color: 'var(--mf-primary-ink)' }}>连线图</span>
        <button ref={fsBtnRef} type="button" className="lw-wiring__fsbtn" style={{ margin: '8px auto' }} onClick={() => props.onFullscreenChange(true)} aria-label="全屏查看连线图" data-testid="wiring-fullscreen-enter" title="全屏">⛶</button>
      </aside>
    );
  }

  const anchor = graph.stepAnchors.find((a) => a.id === activeAnchor);
  const errorEdges = new Set(validation.errors.map((e) => e.edgeId).filter(Boolean));
  const warnEdges = new Set([...validation.warnings, ...codeIssues].map((e) => e.edgeId).filter(Boolean));
  const allWarnings = [...validation.warnings, ...codeIssues];

  const head = (
    <div className="lw-panel__head">
      <h3>连线图</h3>
      {validation.ok
        ? allWarnings.length ? <span className="lw-pill lw-pill--warning">有 {allWarnings.length} 个提醒</span> : <span className="lw-pill lw-pill--success">✓ 连线正确</span>
        : <span className="lw-pill lw-pill--error">有 {validation.errors.length} 处要改</span>}
      <span className="lw-tabs__spacer" />
      {fullscreen ? (
        <button ref={fsBtnRef} type="button" className="lw-btn lw-btn--sm lw-wiring__exitfs" onClick={() => props.onFullscreenChange(false)} aria-label="退出全屏" data-testid="wiring-fullscreen-exit">退出全屏 ✕</button>
      ) : (
        <>
          <button ref={fsBtnRef} type="button" className="lw-wiring__fsbtn" onClick={() => props.onFullscreenChange(true)} aria-label="全屏查看连线图" data-testid="wiring-fullscreen-enter" title="全屏">⛶</button>
          <button ref={toggleRef} type="button" className="lw-course__toggle" onClick={props.onToggle} aria-label="收起连线图">»</button>
        </>
      )}
    </div>
  );

  const body = (
    <div ref={bodyRef} className="lw-panel__body">
      <WiringSchematic graph={graph} components={components} activeEdgeIds={anchor ? anchor.edgeIds : null} activeNodeIds={anchor ? anchor.nodeIds : null} errorEdges={errorEdges} warnEdges={warnEdges} />

      <div className="lw-wiring__legend">
        <span><b style={{ color: '#E2595B' }}>━</b> 红线：电源（3V3）</span>
        <span><b style={{ color: '#3D4B5C' }}>━</b> 黑线：地（GND）</span>
        <span><b style={{ color: '#F4B400' }}>━</b><b style={{ color: '#4A90C8' }}>━</b> 黄/蓝线：信号</span>
      </div>

      {validation.errors.length > 0 && (
        <ul className="lw-action__msg--error" style={{ position: 'static', listStyle: 'none', padding: '8px 10px', borderRadius: 10, margin: '0 0 8px' }} role="alert">
          {validation.errors.map((e, i) => <li key={i}>⛔ {e.childMessage}</li>)}
        </ul>
      )}
      {allWarnings.length > 0 && (
        <ul className="lw-action__msg--warning" style={{ position: 'static', listStyle: 'none', padding: '8px 10px', borderRadius: 10, margin: '0 0 8px' }}>
          {allWarnings.map((e, i) => <li key={i}>⚠️ {e.childMessage}</li>)}
        </ul>
      )}

      <table className="lw-wiring__table" aria-label="接线清单">
        <thead><tr><th>元件脚</th><th>接到小板</th></tr></thead>
        <tbody>
          {graph.edges.map((e) => {
            const n = graph.nodes.find((x) => x.id === e.from.nodeId);
            const active = !anchor || anchor.edgeIds.includes(e.id);
            const tone = errorEdges.has(e.id) ? 'error' : warnEdges.has(e.id) ? 'warn' : 'ok';
            return (
              <tr key={e.id} style={{ opacity: active ? 1 : 0.5 }}>
                <td><span className="lw-wiring__dot" style={{ background: e.color }} />{n?.label} · {e.from.port}</td>
                <td>
                  <select
                    className={`lw-pin-select lw-pin-select--${tone}`}
                    data-lw-anchor={`wire.${e.id}.select`}
                    data-testid={`pin-select-${e.id}`}
                    value={e.to.port}
                    onChange={(ev) => props.onRewire(e.id, ev.target.value)}
                    aria-label={`${n?.label} ${e.from.port} 接到`}
                  >
                    {board.pins.map((p) => <option key={p.id} value={p.id}>{p.id}{p.gpio !== undefined ? `（GPIO${p.gpio}）` : ''}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!props.isDefault && (
        <button ref={resetRef} type="button" className="lw-btn lw-btn--sm" style={{ marginTop: 10 }} onClick={props.onReset}>恢复课程推荐接法</button>
      )}
    </div>
  );

  if (fullscreen) {
    const overlay = (
      <aside
        ref={panelRef}
        className={`lw-panel lw-wiring lw-wiring--fs ${highlighted ? 'lw-highlight' : ''}`}
        data-lw-anchor="wiring.panel"
        data-testid="wiring-fullscreen"
        role="dialog"
        aria-modal="true"
        aria-label="连线图全屏"
      >
        {head}
        {body}
      </aside>
    );
    return (
      <>
        {/* 侧栏占位，避免中间编辑区突然变宽；全屏内容走 portal，锚点仍在 overlay 上 */}
        <aside className="lw-panel lw-wiring lw-wiring--fs-slot" aria-hidden="true" />
        {typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay}
      </>
    );
  }

  return (
    <aside ref={panelRef} className={`lw-panel lw-wiring ${highlighted ? 'lw-highlight' : ''}`} data-lw-anchor="wiring.panel" data-lw-avoid="" aria-label="连线图" data-testid="wiring-panel">
      {head}
      {body}
    </aside>
  );
}
