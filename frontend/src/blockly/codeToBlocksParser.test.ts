import { describe, expect, it } from 'vitest';
import { parseCodeToXml } from './codeToBlocksParser';

describe('code to blocks conversion boundary', () => {
  it('keeps a location-aware warning when a statement is unsupported', () => {
    const result = parseCodeToXml('void setup() {\n  customSensor.begin();\n}\n');

    expect(result.success).toBe(false);
    expect(result.xml).toBeTruthy();
    expect(result.warnings.some((warning) => /行\s*2/.test(warning))).toBe(true);
  });

  it('converts supported setup and loop code without warnings', () => {
    const result = parseCodeToXml('void setup() {\n  pinMode(2, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(2, HIGH);\n  delay(1000);\n}\n');

    expect(result.success).toBe(true);
    expect(result.xml).toContain('arduino_setup');
    expect(result.xml).toContain('arduino_loop');
    expect(result.warnings).toEqual([]);
  });
});
