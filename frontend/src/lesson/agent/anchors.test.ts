import { describe, it, expect, beforeEach } from 'vitest';
import { __resetAnchors, isKnownAnchor, navigateTo, prereqsFor, registerAnchor, registerPrereqHandler, uiSnapshot, useAgentNav } from './anchors';

describe('Agent UI 地图', () => {
  beforeEach(() => { __resetAnchors(); document.body.innerHTML = ''; });
  it('前置条件按锚点前缀推导', () => {
    expect(prereqsFor('code.line.5')).toEqual(['editor.tab.code']);
    expect(prereqsFor('block.dht_setup.field.PIN')).toEqual(['editor.tab.blocks']);
    expect(prereqsFor('pin.D0')).toEqual(['wiring.expand']);
    expect(prereqsFor('serial.line.3')).toEqual(['serial.open']);
    expect(isKnownAnchor('code.line.12')).toBe(true);
    expect(isKnownAnchor('javascript:alert(1)')).toBe(false);
  });
  it('navigateTo 先展开面板，再锚定教练卡；快照带可见/可用', async () => {
    const el = document.createElement('button'); el.textContent = '恢复';
    let expanded = false;
    registerPrereqHandler('wiring.expand', () => { expanded = true; document.body.appendChild(el); registerAnchor('wiring.reset', el, { current: { label: '恢复接法', kind: 'button', prereq: ['wiring.expand'] } }); });
    const ok = await navigateTo('wiring.reset');
    expect(expanded).toBe(true);
    expect(ok).toBe(true);
    expect(useAgentNav.getState().target?.id).toBe('wiring.reset');
    const snap = uiSnapshot();
    expect(snap.anchors.find((a) => a.id === 'wiring.reset')).toMatchObject({ label: '恢复接法', enabled: true });
  });
});
