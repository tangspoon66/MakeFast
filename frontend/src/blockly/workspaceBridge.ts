/**
 * 当前积木工作区的桥：让 Agent 能定位 / 高亮 / 修改具体积木与字段（C3/C4）。
 * 锚点：block.<blockId>、block.<blockId>.field.<FIELD>
 */
import type * as BlocklyNS from 'blockly';

let ws: BlocklyNS.WorkspaceSvg | null = null;
const listeners = new Set<(w: BlocklyNS.WorkspaceSvg | null) => void>();

export function setActiveWorkspace(w: BlocklyNS.WorkspaceSvg | null) { ws = w; listeners.forEach((l) => l(w)); }
export function getActiveWorkspace() { return ws; }
export function onWorkspaceChange(fn: (w: BlocklyNS.WorkspaceSvg | null) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function parseBlockAnchor(id: string): { blockId: string; field?: string } | null {
  const m = id.match(/^block\.([\w-]+)(?:\.field\.(\w+))?$/);
  return m ? { blockId: m[1], field: m[2] } : null;
}

export function blockElement(id: string): Element | null {
  const p = parseBlockAnchor(id);
  if (!p || !ws) return null;
  const b = ws.getBlockById(p.blockId) as BlocklyNS.BlockSvg | null;
  if (!b) return null;
  if (p.field) {
    const f = b.getField(p.field);
    const root = (f as unknown as { getSvgRoot?: () => SVGElement | null })?.getSvgRoot?.();
    if (root) return root;
  }
  return b.getSvgRoot();
}

let outlined: Element | null = null;
/** 居中 + 选中积木，字段加描边 */
export function revealBlock(id: string): boolean {
  const p = parseBlockAnchor(id);
  if (!p || !ws) return false;
  const b = ws.getBlockById(p.blockId) as BlocklyNS.BlockSvg | null;
  if (!b) return false;
  try { ws.centerOnBlock(p.blockId); } catch { /* 旧版本无此方法 */ }
  try { b.select(); } catch { /* ignore */ }
  outlined?.classList.remove('mf-field-outline');
  outlined = null;
  const el = blockElement(id);
  if (p.field && el) { el.classList.add('mf-field-outline'); outlined = el; }
  return true;
}
export function clearBlockOutline() { outlined?.classList.remove('mf-field-outline'); outlined = null; }

export function getBlockFieldValue(blockId: string, field: string): string | undefined {
  const v = ws?.getBlockById(blockId)?.getFieldValue(field);
  return v === null || v === undefined ? undefined : String(v);
}
export function setBlockFieldValue(blockId: string, field: string, value: string): boolean {
  const b = ws?.getBlockById(blockId);
  const f = b?.getField(field);
  if (!f) return false;
  f.setValue(value);
  return true;
}

/** 目标积木自身（不含下挂子积木）的屏幕矩形：教练卡绝不能盖住它 */
export function blockOwnRect(id: string): DOMRect | null {
  const p = parseBlockAnchor(id);
  if (!p || !ws) return null;
  const b = ws.getBlockById(p.blockId) as BlocklyNS.BlockSvg | null;
  const path = b?.getSvgRoot()?.querySelector(':scope > .blocklyPath') as SVGGraphicsElement | null;
  return (path ?? b?.getSvgRoot())?.getBoundingClientRect() ?? null;
}
