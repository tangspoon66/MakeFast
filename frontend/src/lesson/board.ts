/**
 * BoardDocument（Data Model R6 §2.1）。引脚能力真源 = board.json。
 */
import xiaoEsp32s3 from './boards/xiao-esp32-s3.board.json';

export type PinCapability =
  | 'digital_in' | 'digital_out' | 'adc' | 'pwm'
  | 'i2c_sda' | 'i2c_scl' | 'uart_tx' | 'uart_rx'
  | 'spi_sck' | 'spi_miso' | 'spi_mosi'
  | 'power_3v3' | 'power_5v' | 'gnd';

export interface PinDef {
  id: string;
  gpio?: number;
  labels: string[];
  capabilities: PinCapability[];
  side?: 'left' | 'right';
}

export interface BoardConstraint {
  pin: string;
  kind: string;
  severity: 'error' | 'warning';
  childMessage: string;
}

export interface BoardDocument {
  schemaVersion: string;
  id: string;
  name: string;
  vendor: string;
  mcu: string;
  logicVoltage: number;
  pins: PinDef[];
  constraints: BoardConstraint[];
  toolchain: { backendBoardId: string; fqbn: string; uploadProtocol: string; baudRate: number };
}

const BOARDS: Record<string, BoardDocument> = {
  'xiao-esp32-s3': xiaoEsp32s3 as BoardDocument,
};

export function getBoard(id: string): BoardDocument | undefined {
  return BOARDS[id];
}

export function findPin(board: BoardDocument, pinId: string): PinDef | undefined {
  return board.pins.find((p) => p.id === pinId);
}

export function isPowerCap(c: PinCapability) { return c === 'power_3v3' || c === 'power_5v'; }
