/**
 * 现象成功判定（F-HW-01）：优先自动识别串口里的温湿度读数；否则用户点「我看到了 / 听到了」。
 */
export interface Reading { temperature: number; humidity: number }

const TEMP_RE = /(?:temp(?:erature)?|温度)\s*[:：=]?\s*(-?\d+(?:\.\d+)?)/i;
const HUM_RE = /(?:hum(?:idity)?|湿度)\s*[:：=]?\s*(\d+(?:\.\d+)?)/i;

/** 解析一行串口输出；读数需在合理范围内（排除 nan / 传感器未接时的异常值） */
export function parseReading(line: string): Reading | null {
  const t = line.match(TEMP_RE);
  const h = line.match(HUM_RE);
  if (!t || !h) return null;
  const temperature = Number(t[1]);
  const humidity = Number(h[1]);
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) return null;
  if (temperature < -40 || temperature > 80 || humidity < 0 || humidity > 100) return null;
  return { temperature, humidity };
}

/** 读数行里出现 nan → 传感器没读到（多半是接线问题），给儿童可读提示 */
export function looksLikeSensorFailure(line: string): boolean {
  return /(temp|温度)/i.test(line) && /\bnan\b/i.test(line);
}

export const AUTO_SUCCESS_READINGS = 2;

/** 累积判定：连续拿到 N 次有效读数即成功 */
export function createPhenomenonDetector(required = AUTO_SUCCESS_READINGS) {
  let count = 0;
  return {
    feed(line: string): { reading: Reading | null; success: boolean } {
      const reading = parseReading(line);
      if (reading) count += 1;
      return { reading, success: count >= required };
    },
    reset() { count = 0; },
    get count() { return count; },
  };
}
