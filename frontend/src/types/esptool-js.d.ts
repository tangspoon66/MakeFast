/**
 * esptool-js 类型声明
 */

declare module 'esptool-js' {
  export class Transport {
    constructor(port: SerialPort, tracing?: boolean);
    disconnect(): Promise<void>;
  }

  export interface ESPLoaderOptions {
    transport: Transport;
    baudrate: number;
    romBaudrate?: number;
    terminal?: {
      clean: () => void;
      writeLine: (data: string) => void;
      write: (data: string) => void;
    };
  }

  export interface WriteFlashOptions {
    fileArray: Array<{
      data: Uint8Array;
      address: number;
    }>;
    flashSize: string;
    eraseAll: boolean;
    compress: boolean;
    reportProgress?: (fileIndex: number, written: number, total: number) => void;
  }

  export type After = "hard_reset" | "soft_reset" | "no_reset" | "no_reset_stub" | "custom_reset";

  export class ESPLoader {
    constructor(options: ESPLoaderOptions);
    main(): Promise<string>;
    eraseFlash(): Promise<void>;
    writeFlash(options: WriteFlashOptions): Promise<void>;
    after(mode?: After, usingUsbOtg?: boolean, sequenceString?: string): Promise<void>;
  }
}
