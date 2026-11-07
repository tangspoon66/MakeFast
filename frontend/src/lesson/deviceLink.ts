/**
 * DeviceLink（P0）：Web Serial（真实硬件）+ Mock（无硬件演示）。
 * 烧录复用现有 esptool-js 路径（utils/firmwareUploader.ts）。
 */
import type { FlashFile } from '../api/types';

export interface FlashProgress { percentage: number; message: string }

export interface DeviceLink {
  readonly kind: 'webserial' | 'mock';
  connect(): Promise<{ label: string; usb?: { usbVendorId?: number; usbProductId?: number } }>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  flash(firmwareId: string, files: FlashFile[], onProgress: (p: FlashProgress) => void, signal?: AbortSignal): Promise<void>;
  startSerial(onLine: (line: string) => void, baudRate?: number): Promise<void>;
  stopSerial(): Promise<void>;
}

export function webSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('已取消', 'AbortError')); }, { once: true });
});

/** 模拟设备：可完整走通 连接 → 烧录 → 串口温湿度 */
export class MockDeviceLink implements DeviceLink {
  readonly kind = 'mock' as const;
  private connected = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private opts: { serialIntervalMs?: number; stepMs?: number };
  constructor(opts: { serialIntervalMs?: number; stepMs?: number } = {}) { this.opts = opts; }

  async connect() { await sleep(this.opts.stepMs ?? 500); this.connected = true; return { label: '模拟 XIAO ESP32-S3', usb: { usbVendorId: 0x303a, usbProductId: 0x1001 } }; }
  async disconnect() { await this.stopSerial(); this.connected = false; }
  isConnected() { return this.connected; }

  async flash(_id: string, _files: FlashFile[], onProgress: (p: FlashProgress) => void, signal?: AbortSignal) {
    if (!this.connected) throw new Error('未选择串口设备');
    const stages = [
      [8, '正在连接 ESP32-S3（模拟）…'], [20, '芯片识别：ESP32-S3（模拟）'], [35, '擦除 Flash…'],
      [55, '写入 bootloader…'], [75, '写入程序…'], [92, '校验…'], [100, '完成，正在重启小板'],
    ] as const;
    for (const [pct, msg] of stages) {
      await sleep(this.opts.stepMs ?? 380, signal);
      onProgress({ percentage: pct, message: msg });
    }
  }

  async startSerial(onLine: (line: string) => void) {
    await this.stopSerial();
    this.tick = 0;
    onLine('ESP-ROM:esp32s3-20210327');
    onLine('MakeFast first lesson ready');
    this.timer = setInterval(() => {
      this.tick += 1;
      const t = (25.6 + Math.sin(this.tick / 3) * 0.8 + (this.tick % 7 === 0 ? 1.2 : 0)).toFixed(2);
      const h = (56 + Math.cos(this.tick / 4) * 3).toFixed(2);
      onLine(`Temp: ${t} C, Humidity: ${h} %`);
    }, this.opts.serialIntervalMs ?? 1500);
  }

  async stopSerial() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

/** 真实设备：浏览器 Web Serial */
export class WebSerialDeviceLink implements DeviceLink {
  readonly kind = 'webserial' as const;
  port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private readingDone: Promise<void> | null = null;
  private closed = false;

  async connect() {
    if (!webSerialSupported()) throw new Error('浏览器不支持 Web Serial API');
    this.port = await navigator.serial.requestPort();
    const info = (this.port.getInfo?.() || {}) as { usbVendorId?: number; usbProductId?: number };
    return { label: info.usbVendorId === 0x303a ? 'XIAO ESP32-S3（USB）' : '已选择的串口设备', usb: info };
  }

  async disconnect() { await this.stopSerial(); this.port = null; }
  isConnected() { return !!this.port; }

  async flash(firmwareId: string, files: FlashFile[], onProgress: (p: FlashProgress) => void, signal?: AbortSignal) {
    if (!this.port) throw new Error('未选择串口设备');
    await this.stopSerial();
    const { FirmwareUploader } = await import('../utils/firmwareUploader');
    await FirmwareUploader.upload(firmwareId, files, (p) => onProgress({ percentage: p.percentage, message: p.message }), this.port, signal);
  }

  async startSerial(onLine: (line: string) => void, baudRate = 115200) {
    if (!this.port) throw new Error('未选择串口设备');
    await this.stopSerial();
    this.closed = false;
    try { await this.port.open({ baudRate }); } catch (e) {
      if (!/already open/i.test(String((e as Error)?.message))) throw e;
    }
    if (!this.port.readable) throw new Error('Failed to open serial port');
    const decoder = new TextDecoderStream();
    const pipe = this.port.readable.pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>).catch(() => {});
    this.reader = decoder.readable.getReader();
    const reader = this.reader;
    this.readingDone = (async () => {
      let buf = '';
      try {
        while (!this.closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          const parts = buf.split(/\r?\n/);
          buf = parts.pop() || '';
          parts.filter((l) => l.trim()).forEach(onLine);
        }
      } catch { /* 端口被关闭 */ }
      await pipe;
    })();
  }

  async stopSerial() {
    this.closed = true;
    if (this.reader) {
      try { await this.reader.cancel(); } catch { /* ignore */ }
      try { this.reader.releaseLock(); } catch { /* ignore */ }
      this.reader = null;
    }
    if (this.readingDone) { await this.readingDone.catch(() => {}); this.readingDone = null; }
    if (this.port) { try { await this.port.close(); } catch { /* 可能未打开 */ } }
  }
}
