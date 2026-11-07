import { describe, expect, it } from 'vitest';
import { childCompileMessage, invalidateFrom, normalizeToolchain } from './toolchain';
import { initialToolchain } from './lessonStore';
import { createPhenomenonDetector, looksLikeSensorFailure, parseReading } from './phenomenon';
import { MockDeviceLink } from './deviceLink';

describe('toolchain stepper', () => {
  it('marks first unfinished phase current', () => {
    const tc = normalizeToolchain({ ...initialToolchain(), board: { status: 'done' } });
    expect(tc.connection.status).toBe('current');
    expect(tc.build.status).toBe('todo');
  });
  it('invalidating build resets build/flash/serial', () => {
    const all = { board: { status: 'done' }, connection: { status: 'done' }, build: { status: 'done' }, flash: { status: 'done' }, serial: { status: 'done' } } as const;
    const tc = invalidateFrom({ ...all }, 'build');
    expect(tc.connection.status).toBe('done');
    expect(tc.build.status).toBe('current');
    expect(tc.flash.status).toBe('todo');
  });
  it('compile errors become child-readable', () => {
    expect(childCompileMessage("expected ';' before '}' token", 12)).toContain('第 12 行');
    expect(childCompileMessage("'dhtt' was not declared in this scope")).toContain('dhtt');
  });
});

describe('phenomenon detection', () => {
  it('parses english and chinese reading lines', () => {
    expect(parseReading('Temp: 25.40 C, Humidity: 56.10 %')).toEqual({ temperature: 25.4, humidity: 56.1 });
    expect(parseReading('温度: 26.1 °C  湿度: 60 %')).toEqual({ temperature: 26.1, humidity: 60 });
    expect(parseReading('Temp: nan C, Humidity: nan %')).toBeNull();
    expect(looksLikeSensorFailure('Temp: nan C, Humidity: nan %')).toBe(true);
  });
  it('needs two valid readings', () => {
    const d = createPhenomenonDetector();
    expect(d.feed('MakeFast first lesson ready').success).toBe(false);
    expect(d.feed('Temp: 25 C, Humidity: 50 %').success).toBe(false);
    expect(d.feed('Temp: 25.2 C, Humidity: 51 %').success).toBe(true);
  });
  it('mock device streams detectable readings', async () => {
    const link = new MockDeviceLink({ serialIntervalMs: 5, stepMs: 1 });
    await link.connect();
    const progress: number[] = [];
    await link.flash('x', [], (p) => progress.push(p.percentage));
    expect(progress.at(-1)).toBe(100);
    const lines: string[] = [];
    await link.startSerial((l) => lines.push(l));
    await new Promise((r) => setTimeout(r, 40));
    await link.stopSerial();
    expect(lines.filter((l) => parseReading(l)).length).toBeGreaterThanOrEqual(2);
  });
});
