import { describe, it, expect } from 'vitest';
import board from './boards/xiao-esp32-s3.board.json';
import pinmap from './packages/xiao-esp32-s3.pinmap.json';
import dht from './packages/dht22.pinmap.json';
import buzzer from './packages/active-buzzer.pinmap.json';
import { FIRST_LESSON_COMPONENTS } from './coursePack';

describe('板/元件数据包', () => {
  it('pinmap 覆盖 board.json 的每个引脚，且 GPIO 一致', () => {
    for (const p of board.pins) {
      const m = pinmap.pins.find((x) => x.id === p.id);
      expect(m, p.id).toBeTruthy();
      if ('gpio' in p) expect((m as { gpio?: number }).gpio).toBe(p.gpio);
    }
  });
  it('元件 pinmap 与课包 ComponentDef 端口一致', () => {
    const map: Record<string, { pins: { id: string }[] }> = { dht22: dht, active_buzzer: buzzer };
    for (const c of FIRST_LESSON_COMPONENTS) {
      expect(map[c.type].pins.map((p) => p.id).sort()).toEqual(c.ports.map((p) => p.name).sort());
    }
  });
});
