/**
 * Web Serial API 类型声明
 */

interface SerialPort {
  open(options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: "none" | "even" | "odd";
    bufferSize?: number;
    flowControl?: "none" | "hardware";
  }): Promise<void>;
  close(): Promise<void>;
  connected?: boolean;
  setSignals(signals: {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
    break?: boolean;
  }): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
}

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortRequestOptions {
  filters?: Array<{
    usbVendorId?: number;
    usbProductId?: number;
  }>;
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
  serial: Serial;
}
