import { describe, expect, it } from 'vitest';
import { analyzeLocalFirmware, analyzeLocalFirmwareFiles, filesToLocalFirmwareFiles, parseFirmwareAiSuggestions, parseHexAddress, stripFirmwareAiJson, summarizeFirmwareSuggestion } from './localFirmware';

describe('local firmware analysis', () => {
  it('detects merged firmware by file name and uses 0x0', () => {
    const result = analyzeLocalFirmware([{ name: 'xiaozhi_esp32s3.bin', size: 2_500_000 }], {
      boardId: 'esp32s3',
      boardName: 'ESP32-S3 Dev Module',
      chipFamily: 'esp32-s3',
    });
    expect(result.firmwareType).toBe('merged');
    expect(result.confidence).toBe('high');
    expect(result.files[0]).toMatchObject({ address: 0x0, role: 'merged' });
  });

  it('detects app firmware and uses 0x10000', () => {
    const result = analyzeLocalFirmware([{ name: 'app.bin', size: 480_000 }], {
      boardId: 'esp32',
      boardName: 'ESP32 Dev Module',
      chipFamily: 'esp32',
    });
    expect(result.firmwareType).toBe('app');
    expect(result.files[0]).toMatchObject({ address: 0x10000, role: 'app' });
  });

  it('uses 0x0 bootloader address for ESP32-S3 multi-file firmware', () => {
    const result = analyzeLocalFirmware([
      { name: 'bootloader.bin', size: 24_000 },
      { name: 'partitions.bin', size: 3_072 },
      { name: 'boot_app0.bin', size: 8_192 },
      { name: 'app.bin', size: 900_000 },
    ], {
      boardId: 'esp32s3',
      boardName: 'ESP32-S3 Dev Module',
      chipFamily: 'esp32-s3',
    });
    expect(result.firmwareType).toBe('multi');
    expect(result.confidence).toBe('high');
    expect(result.files.find(file => file.role === 'bootloader')?.address).toBe(0x0);
    expect(result.files.find(file => file.role === 'partitions')?.address).toBe(0x8000);
    expect(result.files.find(file => file.role === 'boot_app0')?.address).toBe(0xe000);
    expect(result.files.find(file => file.role === 'app')?.address).toBe(0x10000);
  });



  it('detects renamed merged firmware by binary markers', async () => {
    const data = new Uint8Array(0x10000 + 8);
    data[0] = 0xe9;
    data[0x8000] = 0xaa;
    data[0x8001] = 0x50;
    data[0x10000] = 0xe9;
    const file = new File([data], 'abc.bin');
    const result = await analyzeLocalFirmwareFiles([file], { boardId: 'esp32s3', chipFamily: 'esp32-s3' });
    expect(result.files[0]).toMatchObject({ role: 'merged', address: 0x0 });
    expect(result.confidence).toBe('high');
  });

  it('keeps renamed ambiguous tiny firmware cautious', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'abc.bin');
    const result = await analyzeLocalFirmwareFiles([file], { boardId: 'esp32s3', chipFamily: 'esp32-s3' });
    expect(result.confidence).toBe('low');
    expect(result.warnings.join('\n')).toContain('不太确定');
  });

  it('warns when file name suggests another board family', () => {
    const result = analyzeLocalFirmware([{ name: 'project_esp32s3_factory.bin', size: 2_000_000 }], {
      boardId: 'esp32c3',
      boardName: 'ESP32-C3 Dev Module',
      chipFamily: 'esp32-c3',
    });
    expect(result.warnings.join('\n')).toContain('ESP32S3');
  });







  it('hides firmware AI JSON and summarizes in beginner-friendly text', () => {
    const raw = 'merged-binary.bin 是完整固件。\n```json\n{"files":[{"name":"merged-binary.bin","address":"0x0","role":"firmware"}]}\n```';
    expect(stripFirmwareAiJson(raw)).not.toContain('files');
    const summary = summarizeFirmwareSuggestion([{ name: 'merged-binary.bin', address: 0x0, role: 'merged' }], raw);
    expect(summary).toContain('这是完整固件');
    expect(summary).toContain('烧录固件');
    expect(summary).not.toContain('```json');
  });

  it('falls back to actual selected files when analysis item names are missing', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'factory.bin');
    const result = filesToLocalFirmwareFiles([file], {
      firmwareType: 'unknown',
      confidence: 'low',
      reason: 'broken analysis',
      warnings: [],
      files: [{ name: undefined as unknown as string, address: 0x0, role: 'unknown' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('factory.bin');
    expect(result[0].address).toBe(0x0);
  });

  it('extracts AI JSON suggestions for auto filling addresses', () => {
    const suggestions = parseFirmwareAiSuggestions('建议如下：```json\n{"files":[{"name":"app.bin","address":"0x10000","role":"app"}]}\n```');
    expect(suggestions).toEqual([{ name: 'app.bin', address: 0x10000, role: 'app' }]);
  });

  it('parses hex addresses safely', () => {
    expect(parseHexAddress('0x10000')).toBe(0x10000);
    expect(parseHexAddress('8000')).toBe(0x8000);
    expect(parseHexAddress('not-an-address')).toBeNull();
  });
});
