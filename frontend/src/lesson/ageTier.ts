/**
 * 年龄档：低龄（小学）/ 中龄（初中）/ 高龄（高中及以上）。
 * 决定引导卡、小铁猫气泡、诊断/修改卡和聊天的说话方式与长度。存本地 + 学习者画像（随画像同步到后端）。
 */
import { create } from 'zustand';

export type AgeTier = 'low' | 'mid' | 'high';
export const AGE_TIERS: { id: AgeTier; label: string; hint: string; emoji: string }[] = [
  { id: 'low', label: '小学', hint: '短句 + 打比方', emoji: '🧒' },
  { id: 'mid', label: '初中', hint: '简洁说明', emoji: '🧑' },
  { id: 'high', label: '高中及以上', hint: '直接、专业', emoji: '🧑‍🎓' },
];
const KEY = 'makefast.ageTier';
export const isAgeTier = (v: unknown): v is AgeTier => v === 'low' || v === 'mid' || v === 'high';

function read(): AgeTier | null {
  try { const v = localStorage.getItem(KEY); return isAgeTier(v) ? v : null; } catch { return null; }
}

interface S { tier: AgeTier | null; setTier: (t: AgeTier) => void; hydrate: (t: unknown) => void }
type Listener = (t: AgeTier) => void;
const listeners = new Set<Listener>();
/** 画像同步模块订阅这里（避免循环依赖） */
export const onTierChange = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export const useAgeTier = create<S>((set, get) => ({
  tier: read(),
  setTier: (t) => {
    try { localStorage.setItem(KEY, t); } catch { /* 忽略 */ }
    set({ tier: t });
    listeners.forEach((l) => l(t));
  },
  /** 从后端画像恢复：本地没选过才采用 */
  hydrate: (t) => { if (!get().tier && isAgeTier(t)) { try { localStorage.setItem(KEY, t); } catch { /* 忽略 */ } set({ tier: t }); } },
}));

/** 当前生效的档位（没选过时按中龄说话） */
export const effectiveTier = (t: AgeTier | null | undefined): AgeTier => t ?? 'mid';

/**
 * 小铁猫气泡 / 诊断 / 修改卡里的自由文本按档位压缩：
 * 高龄只留第一句；低龄留第一句，再带一句「就像…」的比方（有的话）；中龄最多两句。
 */
export function tierText(text: string, tier: AgeTier): string {
  const t = (text || '').trim();
  if (!t) return t;
  const parts = t.match(/[^。！？!?]+[。！？!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [t];
  if (tier === 'high') return parts[0];
  if (tier === 'low') {
    const analogy = parts.slice(1).find((p) => /就像|好比|像/.test(p));
    return analogy ? `${parts[0]}${analogy}` : parts[0];
  }
  return parts.slice(0, 2).join('');
}
