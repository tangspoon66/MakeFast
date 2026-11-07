import { describe, it, expect } from 'vitest';
import { AVATAR_OVERHANG, computePlacement, preferredSide } from './placement';

const VP = { width: 1440, height: 900 };
const CARD = { width: 340, height: 260 };
describe('教练卡定位', () => {
  it('顶栏按钮 → 下方，不遮挡', () => {
    const p = computePlacement({ x: 1200, y: 12, width: 90, height: 40 }, CARD, VP, preferredSide('topbar.flash'));
    expect(p.side).toBe('bottom'); expect(p.overlaps).toBe(false);
    expect(p.x + CARD.width).toBeLessThanOrEqual(VP.width - 8); // shift 进视口
  });
  it('串口栏 → 上方；左侧放不下时翻转到右侧', () => {
    expect(computePlacement({ x: 0, y: 700, width: 1440, height: 200 }, CARD, VP, preferredSide('serial')).side).toBe('top');
    const p = computePlacement({ x: 20, y: 300, width: 100, height: 60 }, CARD, VP, 'left');
    expect(p.side).toBe('right'); expect(p.overlaps).toBe(false);
  });
  it('底部空间不足 → 翻转到上方', () => {
    const p = computePlacement({ x: 600, y: 800, width: 80, height: 40 }, CARD, VP, 'bottom');
    expect(p.side).toBe('top'); expect(p.overlaps).toBe(false);
  });
  it('箭头指向目标中心', () => {
    const t = { x: 700, y: 20, width: 100, height: 40 };
    const p = computePlacement(t, CARD, VP, 'bottom');
    expect(p.x + p.arrowX).toBe(750);
  });
});

describe('protect：绝不盖住目标积木', () => {
  it('四周都挤时平移 / 换角落，也不盖住目标和它所在积木', () => {
    const vp = { width: 900, height: 700 }; // 卡片 + 头像必须整体在视口内，留够上下空间
    const card = { width: 340, height: 260 };
    const target = { x: 420, y: 300, width: 60, height: 24 };
    const block = { x: 330, y: 290, width: 300, height: 44 };
    const avoid = [{ x: 600, y: 0, width: 300, height: 640 }];
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const p = computePlacement(target, card, vp, side, 14, 8, avoid, [block]);
      const r = { x: p.x, y: p.y, width: card.width, height: card.height };
      const hit = (a: typeof r, b: typeof r) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(hit(r, block)).toBe(false);
      expect(hit(r, target)).toBe(false);
      expect(p.overlaps).toBe(false);
    }
  });
});

describe('始终在视口内（含头像）', () => {
  it('目标贴着顶栏时，卡片顶部至少留出头像高度', () => {
    const vp = { width: 1280, height: 720 };
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const p = computePlacement({ x: 640, y: 4, width: 120, height: 40 }, { width: 340, height: 420 }, vp, side);
      expect(p.y).toBeGreaterThanOrEqual(8 + AVATAR_OVERHANG);
      expect(p.y + 420).toBeLessThanOrEqual(720 - 8);
      expect(p.x).toBeGreaterThanOrEqual(8);
      expect(p.x + 340).toBeLessThanOrEqual(1280 - 8);
    }
  });
});
