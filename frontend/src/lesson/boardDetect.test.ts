import { describe, expect, it } from 'vitest';
import { detectBoard, detectNote, detectSerialIssue, USB_TABLE } from './boardDetect';

describe('插板自动识别', () => {
  it.each([
    [0x303a, 0x1001, 'ESP32-S3 类', true],
    [0x303a, 0x4001, 'Espressif 类', false],
    [0x1a86, 0x7523, 'ESP32 / Arduino 兼容板', true],
    [0x1a86, 0x55d4, 'ESP32 开发板', true],
    [0x10c4, 0xea60, 'ESP32 开发板', true],
    [0x0403, 0x6001, '带 FTDI 的开发板', true],
    [0x2341, 0x0043, 'Arduino 类', false],
  ])('VID %s PID %s → %s', (vid, pid, family, exact) => {
    const g = detectBoard({ usbVendorId: vid, usbProductId: pid });
    expect(g?.family).toBe(family);
    expect(g?.exact).toBe(exact);
  });

  it('未知或没有 VID 返回 null；表里每条都有家族名', () => {
    expect(detectBoard({ usbVendorId: 0x1234 })).toBeNull();
    expect(detectBoard({})).toBeNull();
    expect(detectBoard(null)).toBeNull();
    for (const r of USB_TABLE) expect(r.family.length).toBeGreaterThan(1);
  });

  it('行内提示：ESP32-S3 原生 USB 自动选 XIAO；CH340 只提醒确认', () => {
    const s3 = detectNote(detectBoard({ usbVendorId: 0x303a, usbProductId: 0x1001 }), 'xiao-esp32-s3', 'XIAO ESP32-S3');
    expect(s3).toEqual({ text: '检测到 ESP32-S3 类板子，已选好 XIAO ESP32-S3', autoSelect: true });
    const ch = detectNote(detectBoard({ usbVendorId: 0x1a86, usbProductId: 0x7523 }), 'xiao-esp32-s3', 'XIAO ESP32-S3');
    expect(ch?.autoSelect).toBe(false);
    expect(ch?.text).toContain('CH340');
    expect(detectNote(null, 'xiao-esp32-s3', 'XIAO')?.autoSelect).toBe(false);
  });

  it('串口特征：nan → DHT 没接；Brownout → 供电；正常读数 → 无', () => {
    expect(detectSerialIssue('温度: nan °C  湿度: nan %')?.id).toBe('dht-missing');
    expect(detectSerialIssue('Failed to read from DHT sensor!')?.id).toBe('dht-failed');
    expect(detectSerialIssue('Brownout detector was triggered')?.id).toBe('brownout');
    expect(detectSerialIssue('温度: 25.1 °C  湿度: 40 %')).toBeNull();
    expect(detectSerialIssue('banana nan')).toBeNull();
  });
});
