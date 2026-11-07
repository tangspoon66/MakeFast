import { describe, expect, it } from 'vitest';
import {
  avr109AddressBytes,
  buildStk500v2Frame,
  getAvrBaudRateCandidates,
  getAvrResetStrategies,
  parseIntelHex,
} from './avrFirmwareUploader';

describe('parseIntelHex', () => {
  it('parses data records into flash bytes', () => {
    const data = parseIntelHex([
      ':100000000C9434000C9451000C9451000C94510049',
      ':00000001FF',
    ].join('\n'));

    expect(Array.from(data.slice(0, 4))).toEqual([0x0c, 0x94, 0x34, 0x00]);
    expect(data.length).toBe(16);
  });

  it('supports extended linear addresses', () => {
    const data = parseIntelHex([
      ':020000040001F9',
      ':0400000001020304F2',
      ':00000001FF',
    ].join('\n'));

    expect(data.length).toBe(0x10004);
    expect(Array.from(data.slice(0x10000, 0x10004))).toEqual([1, 2, 3, 4]);
    expect(data[0]).toBe(0xff);
  });

  it('rejects invalid checksums', () => {
    expect(() => parseIntelHex(':100000000C9434000C9451000C9451000C94510048')).toThrow(/校验失败/);
  });
});

describe('getAvrBaudRateCandidates', () => {
  it('tries the configured rate before common Nano bootloader fallbacks', () => {
    expect(getAvrBaudRateCandidates(57600)).toEqual([57600, 115200]);
    expect(getAvrBaudRateCandidates(115200)).toEqual([115200, 57600]);
    expect(getAvrBaudRateCandidates(38400)).toEqual([38400, 115200, 57600]);
  });
});

describe('getAvrResetStrategies', () => {
  it('tries multiple reset strategies for Uno/Nano STK500v1 uploads', () => {
    expect(getAvrResetStrategies('stk500v1', 'dtr-rts')).toEqual([
      'standard',
      'dtr-low',
      'dtr-rts-low',
      'open-settle',
    ]);
  });

  it('keeps non-STK500v1 protocols conservative', () => {
    expect(getAvrResetStrategies('stk500v2', 'dtr-rts')).toEqual(['standard']);
    expect(getAvrResetStrategies('avr109', 'touch-1200bps')).toEqual(['standard']);
    expect(getAvrResetStrategies('stk500v1', 'none')).toEqual(['standard']);
  });
});

describe('STK500v2 helpers', () => {
  it('builds frames with xor checksum', () => {
    const frame = buildStk500v2Frame(1, [0x01]);
    const bytes = Array.from(frame);
    const checksum = bytes.slice(0, -1).reduce((sum, byte) => sum ^ byte, 0);

    expect(bytes).toEqual([0x1b, 0x01, 0x00, 0x01, 0x0e, 0x01, checksum]);
  });
});

describe('AVR109 helpers', () => {
  it('converts byte addresses to word address bytes', () => {
    expect(avr109AddressBytes(0)).toEqual([0x00, 0x00]);
    expect(avr109AddressBytes(128)).toEqual([0x00, 0x40]);
    expect(avr109AddressBytes(0x1234)).toEqual([0x09, 0x1a]);
  });
});
