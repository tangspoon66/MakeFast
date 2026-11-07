/**
 * 底部串口栏（可拖拽调整高度）。也是编译/烧录的「结果处」：结果短句写在这里。
 */
import { useCallback, useEffect, useRef } from 'react';
import { useAgentAnchor } from '../../lesson/agent/anchors';

export type DockLineKind = 'serial' | 'info' | 'success' | 'warning' | 'error';
export interface DockLine { id: number; kind: DockLineKind; text: string; hit?: boolean }

interface SerialDockProps {
  lines: DockLine[];
  height: number;
  onHeightChange: (h: number) => void;
  connected: boolean;
  listening: boolean;
  mockMode: boolean;
  phenomenonSuccess: boolean;
  canConfirm: boolean;
  onConfirmPhenomenon: () => void;
  onClear: () => void;
  highlighted?: boolean;
}

export const SERIAL_MIN = 64;
export const SERIAL_MAX = 460;

export function SerialDock(props: SerialDockProps) {
  const { lines, height, onHeightChange, connected, listening, mockMode, phenomenonSuccess, canConfirm, highlighted } = props;
  const outRef = useRef<HTMLPreElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: height };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [height]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const next = dragRef.current.startH + (dragRef.current.startY - e.clientY);
    onHeightChange(Math.max(SERIAL_MIN, Math.min(SERIAL_MAX, next)));
  }, [onHeightChange]);
  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const collapsedNow = height <= SERIAL_MIN + 4;
  const dockRef = useAgentAnchor<HTMLElement>('serial', { label: '底部「串口」栏', kind: 'serial', region: 'serial', collapsed: collapsedNow });
  const confirmRef = useAgentAnchor<HTMLButtonElement>('phenomenon', { label: '「我看到了 / 听到了」按钮', kind: 'button', region: 'serial', enabled: canConfirm, prereq: [] });
  const clearRef = useAgentAnchor<HTMLButtonElement>('serial.clear', { label: '串口「清空」按钮', kind: 'button', region: 'serial', prereq: [] });
  const toggleRef = useAgentAnchor<HTMLButtonElement>('serial.toggle', { label: '串口栏的展开/收起按钮', kind: 'toggle', region: 'serial', collapsed: collapsedNow });
  const lastErrorId = [...lines].reverse().find((l) => l.kind === 'error')?.id;
  const lastId = lines[lines.length - 1]?.id;
  const latest = [...lines].reverse().find((l) => l.kind === 'serial')?.text;
  const collapsed = height <= SERIAL_MIN + 4;
  const statusPill = phenomenonSuccess
    ? <span className="lw-pill lw-pill--success">✓ 已看到温湿度</span>
    : listening ? <span className="lw-pill">● 正在听小板说话</span>
    : connected ? <span className="lw-pill">已连接 · 等待数据</span>
    : <span className="lw-pill lw-pill--warning">未连接</span>;

  return (
    <section
      ref={dockRef}
      className={`lw-serial ${highlighted ? 'lw-highlight' : ''}`}
      style={{ height }}
      data-lw-anchor="serial"
      aria-label="串口"
      data-testid="serial-dock"
    >
      <div
        className="lw-serial__grip"
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖动调整串口高度"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') onHeightChange(Math.min(SERIAL_MAX, height + 24));
          if (e.key === 'ArrowDown') onHeightChange(Math.max(SERIAL_MIN, height - 24));
        }}
      />
      <div className="lw-serial__head">
        <strong>串口</strong>
        {statusPill}
        {mockMode && <span className="lw-pill lw-pill--warning">模拟</span>}
        <span className="lw-serial__latest" title={latest}>{latest ? `最新：${latest}` : '烧录成功后，小板会在这里每 2 秒报告一次温度和湿度'}</span>
        {!phenomenonSuccess && (
          <button ref={confirmRef} type="button" className="lw-btn lw-btn--sm lw-btn--blue" data-lw-anchor="phenomenon" onClick={props.onConfirmPhenomenon} disabled={!canConfirm}
            title={canConfirm ? '看到温湿度或听到蜂鸣就点我' : '先完成烧录'} data-testid="confirm-phenomenon">
            我看到了 / 听到了
          </button>
        )}
        <button ref={clearRef} type="button" className="lw-btn lw-btn--sm lw-btn--ghost" onClick={props.onClear} data-testid="serial-clear">清空</button>
        <button ref={toggleRef} type="button" className="lw-btn lw-btn--sm lw-btn--ghost" onClick={() => onHeightChange(collapsed ? 200 : SERIAL_MIN)} aria-expanded={!collapsed} data-testid="serial-toggle">
          {collapsed ? '展开 ▴' : '收起 ▾'}
        </button>
      </div>
      {!collapsed && (
        <pre className="lw-serial__out" ref={outRef} aria-live="polite">
          {lines.length === 0
            ? <span style={{ color: 'var(--mf-ink-soft)' }}>还没有输出。编译、烧录的结果和小板说的话都会显示在这里。</span>
            : lines.map((l) => (
              <div key={l.id} data-serial-line={l.id} data-lw-anchor={l.id === lastErrorId ? 'serial.line.lastError' : l.id === lastId ? 'serial.line.last' : `serial.line.${l.id}`} className={`${l.hit ? 'lw-serial__line--hit' : ''} lw-serial__line--${l.kind}`}>
                {l.kind === 'serial' ? l.text : `【${l.kind === 'error' ? '出错' : l.kind === 'warning' ? '注意' : l.kind === 'success' ? '成功' : '提示'}】${l.text}`}
              </div>
            ))}
        </pre>
      )}
    </section>
  );
}
