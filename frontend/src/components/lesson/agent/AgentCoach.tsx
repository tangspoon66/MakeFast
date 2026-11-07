/**
 * 锚定式教练标记（R10 §5）：小铁猫 + 卡片出现在被引导元素旁边，带聚光灯与指向箭头，
 * 自动 flip/shift 不遮挡目标；进出动画；可关闭（× / Esc）。
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { computePlacement, preferredSide, type Placement, type Rect } from '../../../lesson/agent/placement';
import { Mascot, type MascotMood } from '../Mascot';
import { resolveAnchor } from '../../../lesson/agent/anchors';
import { blockOwnRect } from '../../../blockly/workspaceBridge';

/** 锚点解析（注册表 / 动态解析器）；连线图引脚找不到时退回连线图面板，其余找不到时退回召唤按钮（R10 §11） */
function findAnchor(anchor: string): Element | null {
  if (typeof document === 'undefined') return null;
  if (anchor.startsWith('pin.')) {
    const pin = document.querySelector(`[data-pin-mark="${anchor.slice(4)}"]`);
    if (pin && (pin as HTMLElement).getBoundingClientRect().width > 0) return pin;
    const svgPin = document.querySelector(`[data-board-pin="${anchor.slice(4)}"]`);
    if (svgPin && svgPin.getBoundingClientRect().width > 0) return svgPin;
    return document.querySelector('[data-lw-anchor="wiring.panel"]');
  }
  return resolveAnchor(anchor) ?? document.querySelector('[data-lw-anchor="agent.summon"]');
}

/** 卡片尽量不要盖住的区域：标了 data-lw-avoid 的面板（连线图、顶栏工具链），但不包括目标所在的那块 */
function avoidRects(target: Element): Rect[] {
  return [...document.querySelectorAll('[data-lw-avoid]')]
    .filter((el) => !el.contains(target) && !target.contains(el))
    .map((el) => toRect(el.getBoundingClientRect()))
    .filter((r) => r.width > 0 && r.height > 0);
}

function toRect(r: DOMRect): Rect { return { x: r.left, y: r.top, width: r.width, height: r.height }; }

interface Props {
  anchor: string;
  mood: MascotMood;
  children: ReactNode;
  onClose: () => void;
  /** 聚光灯（步骤开始/需要操作时开；成功气泡关） */
  spotlight?: boolean;
  testId?: string;
  tone?: 'info' | 'success' | 'warning';
  label?: string;
  /** 成功星星 */
  stars?: boolean;
}

export function AgentCoach({ anchor, mood, children, onClose, spotlight = true, testId, tone = 'info', label = '小铁猫提示', stars = false }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Rect | null>(null);
  const [pl, setPl] = useState<Placement | null>(null);
  const [leaving, setLeaving] = useState(false);
  const close = () => { setLeaving(true); setTimeout(onClose, 160); };

  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = findAnchor(anchor);
      const card = cardRef.current;
      if (!el || !card) { setTarget(null); setPl(null); return; }
      const t = toRect(el.getBoundingClientRect());
      const size = { width: card.offsetWidth || 340, height: card.offsetHeight || 200 };
      const vp = { width: window.innerWidth, height: window.innerHeight };
      setTarget((prev) => (prev && prev.x === t.x && prev.y === t.y && prev.width === t.width && prev.height === t.height ? prev : t));
      setPl((prev) => {
        const own = anchor.startsWith('block.') ? blockOwnRect(anchor) : null;
        const next = computePlacement(t, size, vp, preferredSide(anchor), 14, 8, avoidRects(el), own ? [toRect(own)] : []);
        return prev && prev.x === next.x && prev.y === next.y && prev.side === next.side ? prev : next;
      });
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    measure();
    // 路由重新进入时布局还没稳定（懒加载样式、字体、面板展开动画）：多量几次
    const settle = [50, 200, 600].map((ms) => window.setTimeout(schedule, ms));
    void document.fonts?.ready?.then(schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    const el = findAnchor(anchor);
    if (ro && el) ro.observe(el);
    if (ro && cardRef.current) ro.observe(cardRef.current);
    const iv = window.setInterval(schedule, 400); // 串口栏拖拽 / 面板折叠
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); ro?.disconnect(); clearInterval(iv); settle.forEach(clearTimeout); };
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const side = pl?.side ?? 'left';
  const style = pl ? { left: pl.x, top: pl.y } : { right: 22, bottom: 120 };

  return (
    <>
      {spotlight && target && (
        <div className="ac-spot" aria-hidden="true" data-testid="agent-spotlight"
          style={{ left: target.x - 6, top: target.y - 6, width: target.width + 12, height: target.height + 12 }} />
      )}
      <div ref={cardRef} className={`ac-card ac-card--${side} ac-card--${tone} ${leaving ? 'is-leaving' : ''}`} style={style}
        role="dialog" aria-label={label} data-testid={testId ?? 'agent-coach'} data-anchor={anchor} data-side={side}>
        {pl && <span className="ac-arrow" aria-hidden="true" style={side === 'top' || side === 'bottom' ? { left: pl.arrowX } : { top: pl.arrowY }} />}
        <div className="ac-cat"><Mascot mood={mood} decorative size={68} />
          {stars && <span className="ac-stars" aria-hidden="true">{['⭐', '✨', '⭐', '✨', '🌟'].map((s, i) => <span key={i} style={{ left: `${10 + i * 18}%`, top: `${i % 2 ? 10 : 40}%`, animationDelay: `${i * 90}ms`, ['--dx' as string]: `${(i - 2) * 8}px`, ['--dy' as string]: `${-24 - (i % 3) * 8}px` }}>{s}</span>)}</span>}
        </div>
        <button type="button" className="ac-close" onClick={close} aria-label="关闭提示">×</button>
        <div className="ac-body" style={{ maxHeight: typeof window !== 'undefined' ? Math.max(160, window.innerHeight - 8 * 2 - 40 - 24) : undefined, overflowY: 'auto' }}>{children}</div>
      </div>
    </>
  );
}
