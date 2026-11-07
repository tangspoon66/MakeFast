/**
 * 插板自动识别（表驱动）：Web Serial 的 getInfo() 给出 USB VID/PID → 推断板子 / 芯片家族 / 转串口芯片。
 * 另有串口输出特征表：烧录后从串口判断传感器是否在线（如 DHT 读出 nan）。
 */
export interface UsbIds { usbVendorId?: number; usbProductId?: number }
export interface UsbRule {
  vid: number; pid?: number[];
  /** 行内提示里说的板子类别 */
  family: string;
  /** 适合的课程板型 id（命中当前板型就自动选上） */
  boards: string[];
  bridge?: string;
}

export const USB_TABLE: UsbRule[] = [
  { vid: 0x303a, pid: [0x1001], family: 'ESP32-S3 类', boards: ['xiao-esp32-s3', 'esp32-s3-devkit'], bridge: '原生 USB（ESP32-S3/C3）' },
  { vid: 0x303a, pid: [0x0002], family: 'ESP32-S2 类', boards: ['esp32-s2'], bridge: '原生 USB' },
  { vid: 0x303a, family: 'Espressif 类', boards: ['xiao-esp32-s3'], bridge: 'Espressif 原生 USB' },
  { vid: 0x2886, family: 'Seeed XIAO 类', boards: ['xiao-esp32-s3'], bridge: 'Seeed USB' },
  { vid: 0x1a86, pid: [0x7523, 0x7522, 0x5523], family: 'ESP32 / Arduino 兼容板', boards: ['esp32', 'uno'], bridge: 'CH340 USB 转串口' },
  { vid: 0x1a86, pid: [0x55d4, 0x55d3], family: 'ESP32 开发板', boards: ['esp32'], bridge: 'CH9102 USB 转串口' },
  { vid: 0x10c4, pid: [0xea60, 0xea70], family: 'ESP32 开发板', boards: ['esp32'], bridge: 'CP210x USB 转串口' },
  { vid: 0x0403, pid: [0x6001, 0x6010, 0x6014, 0x6015], family: '带 FTDI 的开发板', boards: [], bridge: 'FTDI USB 转串口' },
  { vid: 0x2341, family: 'Arduino 类', boards: ['uno'], bridge: 'Arduino 原生 USB' },
  { vid: 0x2e8a, family: '树莓派 RP2040 类', boards: [], bridge: 'RP2040 原生 USB' },
  { vid: 0x239a, family: 'Adafruit 类', boards: [], bridge: 'Adafruit 原生 USB' },
];

export interface BoardGuess { family: string; bridge?: string; boards: string[]; exact: boolean }

export function detectBoard(ids: UsbIds | null | undefined): BoardGuess | null {
  if (!ids || ids.usbVendorId === undefined) return null;
  const { usbVendorId: vid, usbProductId: pid } = ids;
  const exact = USB_TABLE.find((r) => r.vid === vid && r.pid && pid !== undefined && r.pid.includes(pid));
  const family = exact ?? USB_TABLE.find((r) => r.vid === vid && !r.pid) ?? USB_TABLE.find((r) => r.vid === vid);
  if (!family) return null;
  return { family: family.family, bridge: family.bridge, boards: family.boards, exact: !!exact };
}

/** 行内提示（不弹 toast）：命中当前板型就自动选好，否则提醒确认 */
export function detectNote(guess: BoardGuess | null, boardId: string, boardName: string): { text: string; autoSelect: boolean } | null {
  if (!guess) return { text: '没认出这块板子，请手动确认板型。', autoSelect: false };
  if (guess.boards.includes(boardId)) return { text: `检测到 ${guess.family}板子，已选好 ${boardName}`, autoSelect: true };
  return { text: `检测到 ${guess.family}板子（${guess.bridge ?? 'USB'}），本课用 ${boardName}，请确认插的是哪块。`, autoSelect: false };
}

/** 串口输出特征 → 传感器 / 供电问题（表驱动） */
export interface SerialRule { id: string; test: RegExp; when?: RegExp; sensor: string; message: string; anchor: string }
export const SERIAL_RULES: SerialRule[] = [
  { id: 'dht-missing', test: /\bnan\b/i, when: /(temp|温度|hum|湿度)/i, sensor: 'DHT22', message: '读到了 nan：DHT22 没回话。拔掉 USB，检查 DATA 是否接在 D0、VCC/GND 是否插紧。', anchor: 'wire.dht-data' },
  { id: 'dht-failed', test: /failed to read from dht/i, sensor: 'DHT22', message: 'DHT22 读取失败：多半是 DATA 线松了或接错脚（应接 D0）。', anchor: 'wire.dht-data' },
  { id: 'brownout', test: /brownout/i, sensor: '供电', message: '小板电压不够（Brownout）：换一根好的 USB 线或别的 USB 口。', anchor: 'topbar.connect' },
];

export function detectSerialIssue(line: string): SerialRule | null {
  return SERIAL_RULES.find((r) => r.test.test(line) && (!r.when || r.when.test(line))) ?? null;
}
