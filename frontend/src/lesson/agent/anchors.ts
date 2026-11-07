/**
 * Agent UI 地图（C3）：所有“有意义的元素”的锚点注册表。
 * - 组件用 useAgentAnchor(id, meta) 注册自己（顶栏按钮、板型、模拟模式、步骤、积木/代码标签、
 *   代码行、积木/字段、连线图引脚/连线、串口栏/串口行、测验题、各面板…）；
 * - 动态锚点（code.line.N、block.<id>[.field.<NAME>]、pin.X、wire.<edge>、serial.line.N）走前缀解析器；
 * - navigateTo(id) 先满足前置条件（展开面板、切标签、打开串口栏、滚到代码行、居中积木），
 *   等元素真正可见后，把教练卡 + 聚光灯锚上去；
 * - uiSnapshot() 给聊天请求带上实时布局（rect / 可见 / 可用 / 收起）。
 */
import { useCallback, useLayoutEffect, useRef } from 'react';
import { create } from 'zustand';

export type AnchorKind =
  | 'button' | 'toggle' | 'select' | 'panel' | 'tab' | 'step' | 'code-line' | 'block' | 'block-field'
  | 'pin' | 'wire' | 'serial' | 'serial-line' | 'quiz-item' | 'card' | 'other';
export type Prereq = 'steps.expand' | 'wiring.expand' | 'editor.tab.code' | 'editor.tab.blocks' | 'serial.open';

export interface AnchorMeta {
  label: string;
  kind: AnchorKind;
  region?: 'topbar' | 'steps' | 'editor' | 'wiring' | 'serial' | 'agent' | 'quiz' | 'page';
  prereq?: Prereq[];
  enabled?: boolean;
  collapsed?: boolean;
}
export interface AnchorInfo extends AnchorMeta {
  id: string;
  visible: boolean;
  enabled: boolean;
  rect: { x: number; y: number; w: number; h: number } | null;
}

interface Entry { el: Element; meta: { current: AnchorMeta } }
const registry = new Map<string, Entry>();
type Resolver = (id: string) => Element | null;
const resolvers: { prefix: string; fn: Resolver }[] = [];
const prereqHandlers = new Map<Prereq, () => void | Promise<void>>();
type Revealer = (id: string) => boolean | void | Promise<boolean | void>;
const revealers: { prefix: string; fn: Revealer }[] = [];

export function registerAnchor(id: string, el: Element, meta: { current: AnchorMeta }) {
  registry.set(id, { el, meta });
  if (!el.getAttribute('data-lw-anchor')) el.setAttribute('data-lw-anchor', id);
}
export function unregisterAnchor(id: string, el?: Element | null) {
  const cur = registry.get(id);
  if (cur && (!el || cur.el === el)) registry.delete(id);
}
export function registerResolver(prefix: string, fn: Resolver) {
  resolvers.push({ prefix, fn });
  return () => { const i = resolvers.findIndex((r) => r.fn === fn); if (i >= 0) resolvers.splice(i, 1); };
}
export function registerPrereqHandler(p: Prereq, fn: () => void | Promise<void>) {
  prereqHandlers.set(p, fn);
  return () => { if (prereqHandlers.get(p) === fn) prereqHandlers.delete(p); };
}
export function registerRevealer(prefix: string, fn: Revealer) {
  revealers.push({ prefix, fn });
  return () => { const i = revealers.findIndex((r) => r.fn === fn); if (i >= 0) revealers.splice(i, 1); };
}

/** 找到锚点元素：注册表 → 前缀解析器（最长前缀优先）→ data-lw-anchor 兜底 */
export function resolveAnchor(id: string): Element | null {
  if (typeof document === 'undefined') return null;
  const e = registry.get(id);
  if (e && e.el.isConnected) return e.el;
  const rs = resolvers.filter((r) => id.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of rs) { const el = r.fn(id); if (el) return el; }
  try { return document.querySelector(`[data-lw-anchor="${CSS.escape ? CSS.escape(id) : id}"]`); } catch { return null; }
}

/** 动态锚点的前置条件（静态锚点用 meta.prereq） */
export function prereqsFor(id: string): Prereq[] {
  const meta = registry.get(id)?.meta.current;
  if (meta?.prereq) return meta.prereq;
  if (id.startsWith('code.line.')) return ['editor.tab.code'];
  if (id.startsWith('block.')) return ['editor.tab.blocks'];
  if (id.startsWith('pin.') || id.startsWith('wire.') || (id.startsWith('wiring.') && id !== 'wiring.panel' && id !== 'wiring.toggle')) return ['wiring.expand'];
  if (id.startsWith('serial.line.') || id === 'phenomenon' || id === 'serial.clear') return ['serial.open'];
  if (id.startsWith('step.') || id === 'steps.quiz' || id === 'steps.reset') return ['steps.expand'];
  return [];
}

export function isVisible(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 && r.height <= 0) return false;
  const he = el as HTMLElement;
  if (typeof he.checkVisibility === 'function' && !he.checkVisibility()) return false;
  const vw = window.innerWidth, vh = window.innerHeight;
  return r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
}

function isEnabled(el: Element, meta?: AnchorMeta): boolean {
  if (meta?.enabled !== undefined) return meta.enabled;
  const ctl = (el.matches('button, input, select, textarea') ? el : el.querySelector('button, input, select, textarea')) as HTMLButtonElement | null;
  if (ctl && ctl.disabled) return false;
  return el.getAttribute('aria-disabled') !== 'true';
}

function round(r: DOMRect) { return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }

export function describeAnchor(id: string): AnchorInfo | null {
  const entry = registry.get(id);
  const el = resolveAnchor(id);
  const meta = entry?.meta.current ?? { label: id, kind: 'other' as AnchorKind };
  if (!el) return { ...meta, id, visible: false, enabled: false, rect: null };
  return { ...meta, id, visible: isVisible(el), enabled: isEnabled(el, meta), rect: round(el.getBoundingClientRect()) };
}

export function listAnchors(): AnchorInfo[] {
  return [...registry.keys()].map((id) => describeAnchor(id)!).filter(Boolean);
}

/** 发给后端的紧凑 UI 快照（最多 80 个锚点） */
export function uiSnapshot(extra: Record<string, unknown> = {}) {
  const anchors = listAnchors().slice(0, 80).map((a) => ({
    id: a.id, label: a.label, kind: a.kind, visible: a.visible, enabled: a.enabled,
    ...(a.collapsed !== undefined ? { collapsed: a.collapsed } : {}), ...(a.rect ? { rect: a.rect } : {}),
  }));
  return { viewport: typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : null, anchors, ...extra };
}

export function isKnownAnchor(id: string): boolean {
  if (registry.has(id)) return true;
  return /^(code\.line\.\d+|block\.[\w-]+(\.field\.\w+)?|pin\.\w+|wire\.[\w-]+|serial\.line\.(\d+|last|lastError)|step\.[\w-]+|quiz\.q\.[\w-]+)$/.test(id);
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function waitFor(id: string, timeout = 1600): Promise<Element | null> {
  const t0 = Date.now();
  for (;;) {
    const el = resolveAnchor(id);
    if (el && el.getBoundingClientRect().width > 0) return el;
    if (Date.now() - t0 > timeout) return el;
    await wait(40);
  }
}

// ---- 导航状态：教练卡锚到哪里 ----
export interface NavTarget { id: string; title?: string; text?: string; tone?: 'info' | 'success' | 'warning'; nonce: number }
interface NavState { target: NavTarget | null; show: (t: Omit<NavTarget, 'nonce'>) => void; clear: () => void }
export const useAgentNav = create<NavState>((set) => ({
  target: null,
  show: (t) => set({ target: { ...t, nonce: Date.now() } }),
  clear: () => set({ target: null }),
}));

export interface NavigateOptions { title?: string; text?: string; tone?: NavTarget['tone']; coach?: boolean }

/**
 * 带孩子去某个元素：满足前置条件 → 揭示（滚到代码行 / 居中积木）→ 等元素可见 → 滚入视口 → 锚定教练卡 + 聚光灯。
 * 返回是否找到元素。
 */
export async function navigateTo(id: string, opts: NavigateOptions = {}): Promise<boolean> {
  for (const p of prereqsFor(id)) {
    const h = prereqHandlers.get(p);
    if (h) { await h(); await wait(30); }
  }
  let revealed = false;
  for (const r of revealers.filter((x) => id.startsWith(x.prefix))) {
    const ok = await r.fn(id);
    if (ok !== false) revealed = true;
  }
  const el = await waitFor(id);
  if (!el) return false;
  if (!revealed || !isVisible(el)) (el as HTMLElement).scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  el.classList.add('lw-goto');
  setTimeout(() => el.classList.remove('lw-goto'), 3000);
  if (opts.coach !== false) {
    const label = registry.get(id)?.meta.current.label;
    useAgentNav.getState().show({ id, title: opts.title ?? (label ? `在这里：${label}` : '在这里'), text: opts.text, tone: opts.tone });
  }
  return true;
}

/** 组件注册锚点：返回 callback ref；meta 每次渲染更新（enabled / collapsed 实时） */
export function useAgentAnchor<T extends Element = HTMLElement>(id: string | null | undefined, meta: AnchorMeta) {
  const metaRef = useRef(meta);
  useLayoutEffect(() => { metaRef.current = meta; });
  const elRef = useRef<T | null>(null);
  return useCallback((el: T | null) => {
    if (!id) return;
    if (elRef.current && elRef.current !== el) unregisterAnchor(id, elRef.current);
    elRef.current = el;
    if (el) registerAnchor(id, el, metaRef);
  }, [id]);
}

/** 测试用 */
export function __resetAnchors() { registry.clear(); resolvers.length = 0; revealers.length = 0; prereqHandlers.clear(); useAgentNav.setState({ target: null }); }
