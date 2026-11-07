/**
 * ESP 芯片检测工具
 * 
 * 使用 esptool-js 检测连接的 ESP 芯片型号
 */

import { ESPLoader, Transport } from 'esptool-js';

/**
 * 芯片检测结果
 */
export interface ChipDetectionResult {
  success: boolean;
  chipType?: string;        // 'ESP8266', 'ESP32', 'ESP32-S2', 'ESP32-S3', 'ESP32-C3', 'ESP32-C6', 'ESP32-H2'
  chipId?: string;          // 芯片 ID (十六进制)
  macAddress?: string;      // MAC 地址
  flashSize?: number;       // Flash 大小（字节）
  features?: string[];      // 芯片特性
  port?: SerialPort;        // 使用的串口（用于后续上传）
  error?: string;           // 错误信息
}

/**
 * 芯片类型到开发板 ID 的映射
 */
export const CHIP_TO_BOARD_ID: Record<string, string> = {
  'ESP8266': 'esp8266-generic',
  'ESP32': 'esp32',
  'ESP32-S2': 'esp32s2',
  'ESP32-S3': 'esp32s3',
  'ESP32-C3': 'esp32c3',
  'ESP32-C6': 'esp32c6',
  'ESP32-H2': 'esp32h2',
};

export function normalizeChipType(chipType: string): string {
  const normalized = chipType.trim().toUpperCase();
  if (normalized.includes('ESP32-S3')) return 'ESP32-S3';
  if (normalized.includes('ESP32-S2')) return 'ESP32-S2';
  if (normalized.includes('ESP32-C6')) return 'ESP32-C6';
  if (normalized.includes('ESP32-C3')) return 'ESP32-C3';
  if (normalized.includes('ESP32-H2')) return 'ESP32-H2';
  if (normalized.includes('ESP8266')) return 'ESP8266';
  if (normalized.includes('ESP32')) return 'ESP32';
  return chipType.trim();
}

/**
 * 从指定串口检测芯片
 * 
 * @param port 串口对象
 * @returns 芯片检测结果
 */
export async function detectChipFromPort(port: SerialPort): Promise<ChipDetectionResult> {
  let transport: Transport | null = null;
  
  try {
    console.log('esptool.js');
    console.log('Serial port', port);
    console.log('Connecting...');
    
    // 创建 Transport 对象（不传第二个参数，让 ESPLoader.main() 处理连接）
    transport = new Transport(port);
    
    // 创建 ESPLoader 并连接
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal: {
        clean: () => {},
        writeLine: (text: string) => console.log(text),
        write: (text: string) => console.log(text),
      },
    });
    
    // 连接到芯片（main() 会自动打开串口并连接）
    const chipName = await loader.main();
    console.log('检测到芯片:', chipName);
    
    // 从 loader 对象中获取芯片信息（这些信息在 main() 执行后已经可用）
    const loaderAny = loader as any;
    const chipInfo = {
      chipType: chipName,
      // 尝试从 loader 对象中获取信息，如果不存在则使用默认值
      chipId: loaderAny.chip?.CHIP_NAME || chipName,
      macAddress: loaderAny.macAddr || 'Unknown',
      flashSize: loaderAny.flashSize || 0,
      features: loaderAny.features || [],
    };
    
    console.log('芯片信息:', chipInfo);
    
    // 断开连接
    await loader.after('hard_reset');
    await transport.disconnect();
    
    return {
      success: true,
      chipType: chipName,
      chipId: chipInfo.chipId,
      macAddress: chipInfo.macAddress,
      flashSize: chipInfo.flashSize,
      features: chipInfo.features,
      port: port,  // 返回串口供后续使用
    };
    
  } catch (error) {
    // 确保断开连接
    try {
      if (transport) {
        await transport.disconnect();
      }
    } catch (e) {
      console.error('关闭串口失败:', e);
    }
    
    // 打印详细错误信息用于调试
    console.error('芯片检测错误:', error);
    
    // 处理不同类型的错误
    if (error instanceof DOMException) {
      if (error.name === 'NotFoundError') {
        return {
          success: false,
          error: '未找到串口设备。请确保开发板已连接。',
        };
      } else if (error.name === 'SecurityError') {
        return {
          success: false,
          error: '串口访问被拒绝。请授予串口权限。',
        };
      } else if (error.name === 'InvalidStateError') {
        return {
          success: false,
          error: '串口状态异常，请刷新页面后重试。',
        };
      }
    }
    
    // 返回详细的错误信息
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `检测失败：${errorMessage}`,
    };
  }
}

/**
 * 检测 ESP 芯片型号（手动选择串口）
 * 
 * @returns 芯片检测结果
 */
export async function detectESPChip(): Promise<ChipDetectionResult> {
  try {
    // 请求用户选择串口
    const port = await navigator.serial.requestPort();
    return await detectChipFromPort(port);
  } catch (error) {
    // 处理用户取消选择
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return {
        success: false,
        error: '未选择串口设备',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '芯片检测失败',
    };
  }
}

/**
 * 获取当前已授权的串口列表
 * 
 * @returns 串口列表
 */
export async function getAuthorizedPorts(): Promise<SerialPort[]> {
  if (!('serial' in navigator)) {
    return [];
  }
  return await navigator.serial.getPorts();
}

/**
 * 等待新设备插入
 * 
 * @param beforePorts 插入前的设备列表
 * @param timeoutMs 超时时间（毫秒）
 * @returns 新插入的设备，如果超时则返回 null
 */
export async function waitForNewDevice(
  beforePorts: SerialPort[],
  timeoutMs: number = 30000
): Promise<SerialPort | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const currentPorts = await navigator.serial.getPorts();
    
    // 找到新设备
    const newPort = currentPorts.find(
      port => !beforePorts.some(oldPort => oldPort === port)
    );
    
    if (newPort) {
      return newPort;
    }
    
    // 等待 500ms 后再检查
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return null;
}

/**
 * 根据芯片类型获取推荐的开发板 ID
 * 
 * @param chipType 芯片类型
 * @returns 开发板 ID，如果未找到则返回 null
 */
export function getRecommendedBoardId(chipType: string): string | null {
  return CHIP_TO_BOARD_ID[normalizeChipType(chipType)] || null;
}

/**
 * 格式化 Flash 大小
 * 
 * @param bytes Flash 大小（字节）
 * @returns 格式化的字符串，如 "4MB"
 */
export function formatFlashSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

/**
 * 格式化 MAC 地址
 * 
 * @param mac MAC 地址字符串
 * @returns 格式化的 MAC 地址，如 "AA:BB:CC:DD:EE:FF"
 */
export function formatMacAddress(mac: string): string {
  // 如果已经是格式化的，直接返回
  if (mac.includes(':')) {
    return mac.toUpperCase();
  }
  
  // 否则每两个字符插入一个冒号
  return mac.match(/.{1,2}/g)?.join(':').toUpperCase() || mac;
}
