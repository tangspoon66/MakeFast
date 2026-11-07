/** 教练卡定位（R10 §5）：首选方向 → 放不下翻转(flip) → 平移进视口(shift)，保证不遮挡目标。参考 floating-ui 思路，自写零依赖。 */
export type Side = 'top' | 'bottom' | 'left' | 'right';
export interface Rect { x: number; y: number; width: number; height: number }
export interface Placement { side: Side; x: number; y: number; arrowX: number; arrowY: number; overlaps: boolean }

const OPP: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

export function preferredSide(anchor: string): Side {
  if (anchor.startsWith('topbar.')) return 'bottom';
  if (anchor.startsWith('code.line.') || anchor.startsWith('block.') || anchor.startsWith('step') || anchor.startsWith('editor.tab') || anchor.startsWith('quiz.')) return 'right';
  if (anchor.startsWith('serial')) return 'top';
  if (anchor.startsWith('wiring') || anchor.startsWith('pin.')) return 'left';
  if (anchor === 'serial' || anchor === 'phenomenon' || anchor === 'agent.summon') return 'top';
  if (anchor === 'editor') return 'right';
  return 'left';
}

function place(side: Side, t: Rect, w: number, h: number, gap: number) {
  switch (side) {
    case 'bottom': return { x: t.x + t.width / 2 - w / 2, y: t.y + t.height + gap };
    case 'top': return { x: t.x + t.width / 2 - w / 2, y: t.y - gap - h };
    case 'left': return { x: t.x - gap - w, y: t.y + t.height / 2 - h / 2 };
    case 'right': return { x: t.x + t.width + gap, y: t.y + t.height / 2 - h / 2 };
  }
}

function fits(side: Side, t: Rect, w: number, h: number, vw: number, vh: number, gap: number, pad: number) {
  if (side === 'bottom') return t.y + t.height + gap + h <= vh - pad;
  if (side === 'top') return t.y - gap - h >= pad;
  if (side === 'left') return t.x - gap - w >= pad;
  return t.x + t.width + gap + w <= vw - pad;
}

export function intersects(a: Rect, b: Rect, margin = 0) {
  return a.x < b.x + b.width + margin && a.x + a.width > b.x - margin && a.y < b.y + b.height + margin && a.y + a.height > b.y - margin;
}

function overlapArea(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * 计算卡片位置。avoid：尽量不要盖住的区域（如「连线图」）；protect：绝不能盖住的区域（目标本身 + 目标所在积木等）。
 * 规则：按 首选 → 对侧 → 其余 依次尝试，放得下且不盖 protect 的优先；再看 avoid 覆盖面积；
 * 四个方向都放不下时，沿各方向平移（shift）并尝试视口四角，取第一个不盖 protect 的位置。
 */
/** 卡片顶部伸出的头像高度 */
export const AVATAR_OVERHANG = 40;

export function computePlacement(target: Rect, size: { width: number; height: number }, viewport: { width: number; height: number }, preferred: Side, gap = 14, pad = 8, avoid: Rect[] = [], protect: Rect[] = []): Placement {
  const { width: w, height: h } = size; const { width: vw, height: vh } = viewport;
  const order: Side[] = [preferred, OPP[preferred], ...(['bottom', 'left', 'top', 'right'] as Side[]).filter((s) => s !== preferred && s !== OPP[preferred])];
  // 卡片上方还有 ~40px 的小铁猫头像：顶部留出它的位置，保证整张卡（含头像）都在视口里
  const top = pad + AVATAR_OVERHANG;
  const clamp = (x: number, y: number) => ({ x: Math.max(pad, Math.min(vw - pad - w, x)), y: Math.max(top, Math.min(vh - pad - h, y)) });
  // 卡片左上角浮着小铁猫头像（约 40px），也算进卡片范围
  const clear = (p: { x: number; y: number }) => !intersects({ x: p.x, y: p.y, width: w, height: h }, target, 4)
    && !protect.some((g) => intersects({ x: p.x, y: p.y - 40, width: w, height: h + 40 }, g, 4));
  const cost = (p: { x: number; y: number }) => avoid.reduce((acc, a) => acc + overlapArea({ x: p.x, y: p.y, width: w, height: h }, a), 0);
  type Cand = { side: Side; x: number; y: number; fit: boolean };
  const cands: Cand[] = order.map((side) => { const q = place(side, target, w, h, gap); return { side, ...clamp(q.x, q.y), fit: fits(side, target, w, h, vw, vh, gap, pad) }; });
  // 平移候选：沿该方向的垂直轴滑动，避开 protect
  for (const side of order) {
    const base = place(side, target, w, h, gap);
    for (const d of [-1, 1]) for (let k = 1; k <= 12; k++) {
      const off = d * k * 40;
      const q = side === 'left' || side === 'right' ? clamp(base.x, base.y + off) : clamp(base.x + off, base.y);
      cands.push({ side, ...q, fit: false });
    }
  }
  for (const [cx, cy] of [[pad, top], [vw - pad - w, top], [pad, vh - pad - h], [vw - pad - w, vh - pad - h]]) {
    cands.push({ side: cy < target.y ? 'top' : 'bottom', x: cx, y: cy, fit: false });
  }
  const ok = cands.filter(clear);
  const pick = (list: Cand[]) => list.reduce<Cand | null>((m, c) => (!m || cost(c) < cost(m) ? c : m), null);
  const best = pick(ok.filter((c) => c.fit && cost(c) === 0)) ?? pick(ok.filter((c) => c.fit)) ?? pick(ok) ?? cands[0];
  const { x, y, side } = best;
  const cx = target.x + target.width / 2; const cy = target.y + target.height / 2;
  const arrowX = Math.max(16, Math.min(w - 16, cx - x));
  const arrowY = Math.max(16, Math.min(h - 16, cy - y));
  return { side, x: Math.round(x), y: Math.round(y), arrowX, arrowY, overlaps: !clear({ x, y }) };
}
