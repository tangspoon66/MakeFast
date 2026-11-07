import type { FlashFile } from '../api/types';
import type { ProgressCallback } from './firmwareUploader';

export interface AvrUploadOptions {
  protocol: string;
  baudRate: number;
  resetMethod?: string;
}

type AvrResetStrategy = 'standard' | 'dtr-low' | 'dtr-rts-low' | 'open-settle';

const RESET_STRATEGY_LABELS: Record<AvrResetStrategy, string> = {
  standard: '标准自动复位',
  'dtr-low': 'DTR 低脉冲复位',
  'dtr-rts-low': 'DTR/RTS 双低脉冲复位',
  'open-settle': '仅打开串口等待 bootloader',
};

const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const CRC_EOP = 0x20;
const STK500V2_MESSAGE_START = 0x1b;
const STK500V2_TOKEN = 0x0e;
const STK500V2_STATUS_CMD_OK = 0x00;

const PAGE_SIZE = 128;
const STK500V1_FALLBACK_BAUD_RATES = [115200, 57600];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('上传已取消', 'AbortError');
  }
}

export function getAvrBaudRateCandidates(primaryBaudRate: number): number[] {
  const candidates = [primaryBaudRate || 115200, ...STK500V1_FALLBACK_BAUD_RATES];
  return Array.from(new Set(candidates.filter(rate => Number.isFinite(rate) && rate > 0)));
}

export function buildStk500v2Frame(sequence: number, payload: number[] | Uint8Array): Uint8Array {
  const body = Array.from(payload);
  const frame = [
    STK500V2_MESSAGE_START,
    sequence & 0xff,
    (body.length >> 8) & 0xff,
    body.length & 0xff,
    STK500V2_TOKEN,
    ...body,
  ];
  const checksum = frame.reduce((sum, byte) => sum ^ byte, 0);
  frame.push(checksum);
  return new Uint8Array(frame);
}

export function avr109AddressBytes(byteAddress: number): [number, number] {
  const wordAddress = byteAddress >> 1;
  return [(wordAddress >> 8) & 0xff, wordAddress & 0xff];
}

export function parseIntelHex(hexText: string): Uint8Array {
  const memory = new Map<number, number>();
  let upperAddress = 0;
  let maxAddress = 0;

  for (const rawLine of hexText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.startsWith(':')) {
      throw new Error('HEX 文件格式错误：记录必须以冒号开头');
    }

    const byteCount = parseInt(line.slice(1, 3), 16);
    const address = parseInt(line.slice(3, 7), 16);
    const recordType = parseInt(line.slice(7, 9), 16);
    const dataStart = 9;
    const expectedLength = 11 + byteCount * 2;
    if (line.length < expectedLength) {
      throw new Error('HEX 文件格式错误：记录长度不完整');
    }

    let checksum = byteCount + (address >> 8) + (address & 0xff) + recordType;
    const bytes: number[] = [];
    for (let i = 0; i < byteCount; i += 1) {
      const value = parseInt(line.slice(dataStart + i * 2, dataStart + i * 2 + 2), 16);
      bytes.push(value);
      checksum += value;
    }
    const expectedChecksum = parseInt(line.slice(dataStart + byteCount * 2, dataStart + byteCount * 2 + 2), 16);
    if (((checksum + expectedChecksum) & 0xff) !== 0) {
      throw new Error('HEX 文件校验失败，请重新编译后再试');
    }

    if (recordType === 0x00) {
      const absolute = upperAddress + address;
      for (let i = 0; i < bytes.length; i += 1) {
        memory.set(absolute + i, bytes[i]);
      }
      maxAddress = Math.max(maxAddress, absolute + bytes.length);
    } else if (recordType === 0x01) {
      break;
    } else if (recordType === 0x04) {
      upperAddress = ((bytes[0] << 8) | bytes[1]) << 16;
    } else if (recordType === 0x02) {
      upperAddress = ((bytes[0] << 8) | bytes[1]) << 4;
    }
  }

  const output = new Uint8Array(maxAddress);
  output.fill(0xff);
  for (const [address, value] of memory.entries()) {
    output[address] = value;
  }
  return output;
}

class SerialByteStream {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer: number[] = [];
  private readonly port: SerialPort;

  constructor(port: SerialPort) {
    this.port = port;
  }

  open(): void {
    if (!this.port.readable || !this.port.writable) {
      throw new Error('串口不可读写，请重新选择设备');
    }
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
  }

  async write(bytes: number[] | Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('串口写入器未初始化');
    await this.writer.write(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  async readByte(timeoutMs = 1200): Promise<number> {
    if (this.buffer.length > 0) return this.buffer.shift()!;
    if (!this.reader) throw new Error('串口读取器未初始化');

    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('等待开发板响应超时')), timeoutMs);
    });
    const result = await Promise.race([this.reader.read(), timeout]);
    if (result.done || !result.value) {
      throw new Error('串口连接已断开');
    }
    this.buffer.push(...Array.from(result.value));
    return this.buffer.shift()!;
  }

  async readUntil(expected: number, timeoutMs = 1200): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remaining = Math.max(80, deadline - Date.now());
      const actual = await this.readByte(remaining);
      if (actual === expected) return;
    }
    throw new Error('等待开发板响应超时');
  }

  async readOptionalBytes(count: number, timeoutMs = 120): Promise<number[]> {
    const bytes: number[] = [];
    for (let i = 0; i < count; i += 1) {
      try {
        bytes.push(await this.readByte(timeoutMs));
      } catch {
        break;
      }
    }
    return bytes;
  }

  async readExpected(expected: number, timeoutMs = 1200): Promise<void> {
    const actual = await this.readByte(timeoutMs);
    if (actual !== expected) {
      throw new Error(`开发板响应异常：期待 0x${expected.toString(16)}，收到 0x${actual.toString(16)}`);
    }
  }

  async close(): Promise<void> {
    try {
      await this.reader?.cancel();
    } catch {
      // ignore
    }
    try {
      this.reader?.releaseLock();
    } catch {
      // ignore
    }
    try {
      this.writer?.releaseLock();
    } catch {
      // ignore
    }
    this.reader = null;
    this.writer = null;
  }
}

async function resetAvr(port: SerialPort, method: string, strategy: AvrResetStrategy = 'standard'): Promise<void> {
  if (method === 'none') return;
  if (method === 'touch-1200bps') {
    if (port.readable || port.writable) {
      await port.close();
      await delay(80);
    }
    await port.open({ baudRate: 1200 });
    await port.setSignals({ dataTerminalReady: false });
    await delay(120);
    await port.close();
    await delay(1000);
    return;
  }

  if (strategy === 'open-settle') {
    await delay(650);
    return;
  }

  if (strategy === 'dtr-low') {
    await port.setSignals({ dataTerminalReady: true, requestToSend: false });
    await delay(60);
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await delay(90);
    await port.setSignals({ dataTerminalReady: true, requestToSend: false });
    await delay(450);
    return;
  }

  if (strategy === 'dtr-rts-low') {
    await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    await delay(60);
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await delay(100);
    await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    await delay(450);
    return;
  }

  await port.setSignals({ dataTerminalReady: false, requestToSend: true });
  await delay(80);
  await port.setSignals({ dataTerminalReady: true, requestToSend: false });
  await delay(350);
}

export function getAvrResetStrategies(protocol: string, resetMethod?: string): AvrResetStrategy[] {
  if (resetMethod === 'none' || resetMethod === 'touch-1200bps') return ['standard'];
  if (protocol !== 'stk500v1') return ['standard'];
  return ['standard', 'dtr-low', 'dtr-rts-low', 'open-settle'];
}

class Stk500v1Uploader {
  private readonly stream: SerialByteStream;
  private readonly signal?: AbortSignal;

  constructor(stream: SerialByteStream, signal?: AbortSignal) {
    this.stream = stream;
    this.signal = signal;
  }

  private async command(bytes: number[], timeoutMs = 1200, options: { scanForInSync?: boolean } = {}): Promise<void> {
    throwIfAborted(this.signal);
    await this.stream.write([...bytes, CRC_EOP]);
    if (options.scanForInSync) {
      await this.stream.readUntil(STK_INSYNC, timeoutMs);
    } else {
      await this.stream.readExpected(STK_INSYNC, timeoutMs);
    }
    await this.stream.readExpected(STK_OK, timeoutMs);
  }

  async sync(): Promise<void> {
    for (let i = 0; i < 6; i += 1) {
      try {
        await this.command([0x30], 650, { scanForInSync: true });
        return;
      } catch {
        await delay(120);
      }
    }
    throw new Error('无法进入 Arduino bootloader，请确认开发板型号和串口是否正确');
  }

  async enterProgramming(): Promise<void> {
    await this.command([0x50]);
  }

  async leaveProgramming(): Promise<void> {
    await this.command([0x51]);
  }

  async loadAddress(byteAddress: number): Promise<void> {
    const wordAddress = byteAddress >> 1;
    await this.command([0x55, wordAddress & 0xff, (wordAddress >> 8) & 0xff]);
  }

  async writePage(bytes: Uint8Array): Promise<void> {
    throwIfAborted(this.signal);
    await this.stream.write([0x64, (bytes.length >> 8) & 0xff, bytes.length & 0xff, 0x46]);
    await this.stream.write(bytes);
    await this.stream.write([CRC_EOP]);
    await this.stream.readExpected(STK_INSYNC, 2000);
    await this.stream.readExpected(STK_OK, 2000);
  }
}

class Stk500v2Uploader {
  private readonly stream: SerialByteStream;
  private readonly signal?: AbortSignal;
  private sequence = 1;

  constructor(stream: SerialByteStream, signal?: AbortSignal) {
    this.stream = stream;
    this.signal = signal;
  }

  private async transact(payload: number[] | Uint8Array, timeoutMs = 2000): Promise<number[]> {
    throwIfAborted(this.signal);
    const sequence = this.sequence;
    this.sequence = (this.sequence + 1) & 0xff;
    await this.stream.write(buildStk500v2Frame(sequence, payload));

    await this.stream.readUntil(STK500V2_MESSAGE_START, timeoutMs);
    const responseSequence = await this.stream.readByte(timeoutMs);
    if (responseSequence !== sequence) {
      throw new Error('STK500v2 响应序号不匹配');
    }
    const sizeHigh = await this.stream.readByte(timeoutMs);
    const sizeLow = await this.stream.readByte(timeoutMs);
    const size = (sizeHigh << 8) | sizeLow;
    const token = await this.stream.readByte(timeoutMs);
    if (token !== STK500V2_TOKEN) {
      throw new Error('STK500v2 响应 token 异常');
    }
    const response: number[] = [];
    const checksumBytes = [
      STK500V2_MESSAGE_START,
      responseSequence,
      sizeHigh,
      sizeLow,
      token,
    ];
    for (let i = 0; i < size; i += 1) {
      const value = await this.stream.readByte(timeoutMs);
      response.push(value);
      checksumBytes.push(value);
    }
    const checksum = await this.stream.readByte(timeoutMs);
    const expected = checksumBytes.reduce((sum, byte) => sum ^ byte, 0);
    if (checksum !== expected) {
      throw new Error('STK500v2 响应校验失败');
    }
    if (response[1] !== STK500V2_STATUS_CMD_OK) {
      throw new Error(`STK500v2 命令失败：状态 0x${(response[1] ?? -1).toString(16)}`);
    }
    return response;
  }

  async sync(): Promise<void> {
    for (let i = 0; i < 5; i += 1) {
      try {
        await this.transact([0x01]);
        return;
      } catch {
        await delay(180);
      }
    }
    throw new Error('无法进入 Mega bootloader，请确认开发板型号和串口是否正确');
  }

  async enterProgramming(): Promise<void> {
    await this.transact([0x10, 0xc8, 0x64, 0x19, 0x20, 0x00, 0x53, 0x03, 0xac, 0x53, 0x00, 0x00]);
  }

  async leaveProgramming(): Promise<void> {
    await this.transact([0x11, 0x01, 0x01]);
  }

  async loadAddress(byteAddress: number): Promise<void> {
    const wordAddress = byteAddress >> 1;
    await this.transact([
      0x06,
      (wordAddress >> 24) & 0xff,
      (wordAddress >> 16) & 0xff,
      (wordAddress >> 8) & 0xff,
      wordAddress & 0xff,
    ]);
  }

  async writePage(bytes: Uint8Array): Promise<void> {
    await this.transact([
      0x13,
      (bytes.length >> 8) & 0xff,
      bytes.length & 0xff,
      0xc1,
      0x0a,
      0x40,
      0x4c,
      0x20,
      0x00,
      0x00,
      ...Array.from(bytes),
    ], 4000);
  }
}

class Avr109Uploader {
  private readonly stream: SerialByteStream;
  private readonly signal?: AbortSignal;

  constructor(stream: SerialByteStream, signal?: AbortSignal) {
    this.stream = stream;
    this.signal = signal;
  }

  private async command(bytes: number[] | Uint8Array, expected?: number, timeoutMs = 1500): Promise<void> {
    throwIfAborted(this.signal);
    await this.stream.write(bytes);
    if (expected !== undefined) {
      await this.stream.readExpected(expected, timeoutMs);
    }
  }

  async sync(): Promise<void> {
    for (let i = 0; i < 6; i += 1) {
      try {
        throwIfAborted(this.signal);
        await this.stream.write([0x53]);
        const first = await this.stream.readByte(1000);
        if (first === 0x0d) return;
        const rest = await this.stream.readOptionalBytes(6, 120);
        const signature = String.fromCharCode(first, ...rest);
        if (/^[\x20-\x7e]{2,}$/.test(signature)) return;
      } catch {
        await delay(180);
      }
    }
    throw new Error('无法进入 Leonardo/Micro bootloader，请确认开发板型号和串口是否正确');
  }

  async enterProgramming(): Promise<void> {
    await this.command([0x50], 0x0d);
  }

  async leaveProgramming(): Promise<void> {
    await this.command([0x4c], 0x0d);
  }

  async loadAddress(byteAddress: number): Promise<void> {
    const [high, low] = avr109AddressBytes(byteAddress);
    await this.command([0x41, high, low], 0x0d);
  }

  async writePage(bytes: Uint8Array): Promise<void> {
    await this.command([
      0x42,
      (bytes.length >> 8) & 0xff,
      bytes.length & 0xff,
      0x46,
      ...Array.from(bytes),
    ], 0x0d, 4000);
  }
}

export class AvrFirmwareUploader {
  static isSupported(): boolean {
    return 'serial' in navigator;
  }

  static async upload(
    firmwareId: string,
    flashFiles: FlashFile[],
    options: AvrUploadOptions,
    onProgress?: ProgressCallback,
    existingPort?: SerialPort | null,
    signal?: AbortSignal
  ): Promise<void> {
    if (!AvrFirmwareUploader.isSupported()) {
      throw new Error('浏览器不支持 Web Serial API');
    }
    if (!['stk500v1', 'stk500v2', 'avr109'].includes(options.protocol)) {
      throw new Error('该 Arduino 开发板的在线烧录协议仍在适配中');
    }

    const hexFile = flashFiles.find(file => file.format === 'hex' || file.name.endsWith('.hex'));
    if (!hexFile) {
      throw new Error('编译结果缺少 Arduino HEX 固件，请重新编译');
    }

    let port: SerialPort | null = null;

    try {
      throwIfAborted(signal);
      onProgress?.({ stage: 'connecting', percentage: 0, message: '请选择 Arduino 串口设备...' });
      port = existingPort || await navigator.serial.requestPort();
      if (!port) throw new Error('未选择串口设备');

      onProgress?.({ stage: 'connecting', percentage: 10, message: '正在下载 HEX 固件...' });
      const response = await fetch(`/api/firmware/${firmwareId}/files/${hexFile.name}`, { signal });
      if (!response.ok) {
        throw new Error(`下载 ${hexFile.name} 失败: ${response.statusText}`);
      }
      const firmware = parseIntelHex(await response.text());
      throwIfAborted(signal);

      const baudRates = options.protocol === 'stk500v1'
        ? getAvrBaudRateCandidates(options.baudRate)
        : [options.baudRate || 115200];
      const resetStrategies = getAvrResetStrategies(options.protocol, options.resetMethod);
      const attempts = baudRates.flatMap(baudRate => resetStrategies.map(resetStrategy => ({ baudRate, resetStrategy })));
      let lastError: unknown = null;

      for (let attempt = 0; attempt < attempts.length; attempt += 1) {
        const { baudRate, resetStrategy } = attempts[attempt];
        let stream: SerialByteStream | null = null;
        try {
          throwIfAborted(signal);
          const suffix = attempt === 0 ? '' : `，正在尝试${RESET_STRATEGY_LABELS[resetStrategy]}`;
          onProgress?.({
            stage: 'connecting',
            percentage: 20,
            message: `正在复位 Arduino (${baudRate} baud)${suffix}...`
          });

          const resetMethod = options.resetMethod || 'dtr-rts';
          if (resetMethod !== 'touch-1200bps' && !port.readable && !port.writable) {
            await port.open({ baudRate });
          }
          await resetAvr(port, resetMethod, resetStrategy);

          if (resetMethod === 'touch-1200bps') {
            onProgress?.({
              stage: 'connecting',
              percentage: 24,
              message: '开发板已进入 bootloader，请在弹窗中选择新出现的 Arduino 串口...'
            });
            port = await navigator.serial.requestPort();
          }

          if (!port.readable || !port.writable) {
            await port.open({ baudRate });
          }
          stream = new SerialByteStream(port);
          stream.open();

          const uploader = options.protocol === 'stk500v2'
            ? new Stk500v2Uploader(stream, signal)
            : options.protocol === 'avr109'
              ? new Avr109Uploader(stream, signal)
              : new Stk500v1Uploader(stream, signal);
          onProgress?.({
            stage: 'connecting',
            percentage: 30,
            message: `正在连接 Arduino bootloader (${baudRate} baud / ${RESET_STRATEGY_LABELS[resetStrategy]})...`
          });
          await uploader.sync();
          await uploader.enterProgramming();

          onProgress?.({ stage: 'writing', percentage: 0, message: '正在写入 Arduino 固件...' });
          for (let offset = 0; offset < firmware.length; offset += PAGE_SIZE) {
            throwIfAborted(signal);
            const page = firmware.slice(offset, Math.min(offset + PAGE_SIZE, firmware.length));
            await uploader.loadAddress(offset);
            await uploader.writePage(page);
            const percentage = Math.min(99, Math.floor(((offset + page.length) / firmware.length) * 100));
            onProgress?.({
              stage: 'writing',
              percentage,
              message: `正在写入 Arduino 固件... ${percentage}%`
            });
          }

          onProgress?.({ stage: 'done', percentage: 95, message: '正在退出烧录模式...' });
          await uploader.leaveProgramming();
          await delay(80);
          onProgress?.({ stage: 'done', percentage: 100, message: 'Arduino 上传完成！' });
          return;
        } catch (error) {
          lastError = error;
          await stream?.close();
          try {
            if (port.readable || port.writable) {
              await port.close();
            }
          } catch {
            // ignore close errors before retry
          }

          if (error instanceof Error && error.name === 'AbortError') throw error;
          if (attempt < attempts.length - 1) {
            const next = attempts[attempt + 1];
            onProgress?.({
              stage: 'connecting',
              percentage: 28,
              message: `当前烧录参数无响应，正在自动切换到 ${next.baudRate} baud / ${RESET_STRATEGY_LABELS[next.resetStrategy]}...`
            });
            await delay(350);
            continue;
          }
        }
      }

      if (lastError instanceof Error) {
        throw lastError;
      }
      throw new Error('无法进入 Arduino bootloader，请确认开发板型号和串口是否正确');
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('上传已取消');
        if (error.name === 'NotFoundError') throw new Error('未选择串口设备');
        if (error.name === 'InvalidStateError') throw new Error('串口状态异常，请拔插设备后重试');
        throw new Error(`Arduino 上传失败: ${error.message}`);
      }
      throw new Error('Arduino 上传失败');
    } finally {
      try {
        if (port?.readable || port?.writable) {
          await port.close();
        }
      } catch {
        // ignore close errors
      }
    }
  }
}
