/**
 * 固件上传器
 * 
 * 使用 Web Serial API 和 esptool-js 上传固件到 ESP32
 */

import { ESPLoader, Transport } from 'esptool-js';
import type { FlashFile } from '../api/types';
import type { LocalFirmwareFile } from './localFirmware';

export interface UploadProgress {
  stage: 'connecting' | 'erasing' | 'writing' | 'verifying' | 'done';
  percentage: number;
  message: string;
}

export type ProgressCallback = (progress: UploadProgress) => void;

/**
 * 固件上传器类
 */
export class FirmwareUploader {
  /**
   * 检查浏览器是否支持 Web Serial API
   */
  static isSupported(): boolean {
    return 'serial' in navigator;
  }
  

  /**
   * 上传本地固件文件（不经过后端固件库）
   */
  static async uploadLocal(
    localFiles: LocalFirmwareFile[],
    onProgress?: ProgressCallback,
    existingPort?: SerialPort | null,
    signal?: AbortSignal
  ): Promise<void> {
    if (!FirmwareUploader.isSupported()) {
      throw new Error('浏览器不支持 Web Serial API');
    }
    if (localFiles.length === 0) {
      throw new Error('请先选择固件文件');
    }

    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw new DOMException('上传已取消', 'AbortError');
      }
    };

    let port: SerialPort | null;
    let transport: Transport | null = null;

    try {
      throwIfAborted();
      if (existingPort) {
        onProgress?.({ stage: 'connecting', percentage: 5, message: '使用已检测的设备...' });
        port = existingPort;
      } else {
        onProgress?.({ stage: 'connecting', percentage: 0, message: '请选择串口设备...' });
        port = await navigator.serial.requestPort();
      }

      if (!port) {
        throw new Error('未选择串口设备');
      }

      onProgress?.({ stage: 'connecting', percentage: 10, message: '正在连接 ESP32...' });
      transport = new Transport(port);
      const esploader = new ESPLoader({
        transport,
        baudrate: 115200,
        terminal: {
          clean: () => {},
          writeLine: (data: string) => console.log(data),
          write: (data: string) => console.log(data)
        }
      });

      onProgress?.({ stage: 'connecting', percentage: 15, message: '正在识别芯片...' });
      const chip = await esploader.main();
      throwIfAborted();
      onProgress?.({ stage: 'connecting', percentage: 18, message: `已识别芯片: ${chip}` });

      const fileArray: Array<{ data: Uint8Array; address: number }> = [];
      for (let i = 0; i < localFiles.length; i++) {
        const file = localFiles[i];
        throwIfAborted();
        onProgress?.({
          stage: 'connecting',
          percentage: 20 + Math.floor((i / localFiles.length) * 15),
          message: `正在读取 ${file.name}...`
        });
        const data = new Uint8Array(await file.file.arrayBuffer());
        fileArray.push({ data, address: file.address });
        console.log(`Loaded local firmware ${file.name}: ${data.length} bytes @ 0x${file.address.toString(16)}`);
      }

      onProgress?.({ stage: 'writing', percentage: 0, message: '正在写入固件...' });
      const fileCount = fileArray.length;
      let lastReportedPercentage = -1;
      await esploader.writeFlash({
        fileArray,
        flashSize: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          throwIfAborted();
          const fileProgress = total > 0 ? written / total : 0;
          const percentage = Math.min(100, Math.floor(((fileIndex + fileProgress) / fileCount) * 100));
          if (percentage === lastReportedPercentage && percentage !== 0 && percentage !== 100) return;
          lastReportedPercentage = percentage;
          onProgress?.({
            stage: 'writing',
            percentage,
            message: `正在写入固件... ${percentage}%`
          });
        }
      });
      throwIfAborted();

      onProgress?.({ stage: 'done', percentage: 95, message: '正在重启设备...' });
      try {
        await port.setSignals({ dataTerminalReady: false });
        await new Promise(resolve => setTimeout(resolve, 100));
        await port.setSignals({ requestToSend: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        await port.setSignals({ requestToSend: false });
      } catch (e) {
        console.log('Reset error (可以忽略):', e);
      }
      onProgress?.({ stage: 'done', percentage: 100, message: '固件烧录完成！' });
    } catch (error) {
      console.error('Local upload error:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('上传已取消');
        if (error.name === 'NotFoundError') throw new Error('未选择串口设备');
        if (error.name === 'SecurityError') throw new Error('没有串口访问权限');
        if (error.name === 'NetworkError') throw new Error('设备连接失败，请检查设备是否正常连接');
        if (error.name === 'InvalidStateError') throw new Error('串口状态异常，请拔插设备后重试');
        throw new Error(`上传失败: ${error.message}`);
      }
      throw new Error('上传失败');
    } finally {
      try {
        if (transport) {
          await transport.disconnect();
        }
      } catch {
        // 忽略断开连接错误
      }
    }
  }

  /**
   * 上传固件（支持多文件烧录）
   * 
   * @param firmwareId 固件 ID
   * @param flashFiles 烧录文件清单（包含地址信息）
   * @param onProgress 进度回调
   * @param existingPort 已有的串口（可选，如果提供则不弹出选择对话框）
   */
  static async upload(
    firmwareId: string,
    flashFiles: FlashFile[],
    onProgress?: ProgressCallback,
    existingPort?: SerialPort | null,
    signal?: AbortSignal
  ): Promise<void> {
    if (!FirmwareUploader.isSupported()) {
      throw new Error('浏览器不支持 Web Serial API');
    }

    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw new DOMException('上传已取消', 'AbortError');
      }
    };
    
    let port: SerialPort | null;
    let transport: Transport | null = null;
    
    try {
      throwIfAborted();
      // 1. 获取串口（优先使用已有串口）
      if (existingPort) {
        onProgress?.({
          stage: 'connecting',
          percentage: 5,
          message: '使用已检测的设备...'
        });
        port = existingPort;
      } else {
        // 请求用户选择串口
        onProgress?.({
          stage: 'connecting',
          percentage: 0,
          message: '请选择串口设备...'
        });
        
        port = await navigator.serial.requestPort();
      }
      
      if (!port) {
        throw new Error('未选择串口设备');
      }
      throwIfAborted();
      
      // 2. 创建 Transport（Transport 会自己打开串口）
      onProgress?.({
        stage: 'connecting',
        percentage: 10,
        message: '正在连接 ESP32...'
      });
      
      transport = new Transport(port);
      
      const esploader = new ESPLoader({
        transport: transport,
        baudrate: 115200,
        terminal: {
          clean: () => {},
          writeLine: (data: string) => console.log(data),
          write: (data: string) => console.log(data)
        }
      });
      
      // 3. 连接芯片
      onProgress?.({
        stage: 'connecting',
        percentage: 15,
        message: '正在识别芯片...'
      });
      
      const chip = await esploader.main();
      console.log('Connected to', chip);
      throwIfAborted();
      
      // 显示芯片信息
      onProgress?.({
        stage: 'connecting',
        percentage: 18,
        message: `已识别芯片: ${chip}`
      });
      
      // 4. 下载所有固件文件
      onProgress?.({
        stage: 'connecting',
        percentage: 20,
        message: '正在下载固件文件...'
      });
      
      const fileArray: Array<{ data: Uint8Array; address: number }> = [];
      
      for (let i = 0; i < flashFiles.length; i++) {
        throwIfAborted();
        const file = flashFiles[i];
        const downloadProgress = 20 + Math.floor((i / flashFiles.length) * 15);
        
        onProgress?.({
          stage: 'connecting',
          percentage: downloadProgress,
          message: `正在下载 ${file.name}...`
        });
        
        // 下载固件文件
        const response = await fetch(`/api/firmware/${firmwareId}/files/${file.name}`, { signal });
        if (!response.ok) {
          throw new Error(`下载 ${file.name} 失败: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        throwIfAborted();
        const data = new Uint8Array(arrayBuffer);
        
        fileArray.push({
          data: data,
          address: file.address
        });
        
        console.log(`Downloaded ${file.name}: ${data.length} bytes @ 0x${file.address.toString(16)}`);
      }
      
      // 5. 写入固件（按地址顺序）
      onProgress?.({
        stage: 'writing',
        percentage: 0,
        message: '正在写入固件...'
      });

      throwIfAborted();

      const fileCount = fileArray.length;
      let lastReportedPercentage = -1;
      await esploader.writeFlash({
        fileArray,
        flashSize: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (_fileIndex: number, written: number, total: number) => {
          throwIfAborted();
          const fileProgress = total > 0 ? written / total : 0;
          const percentage = Math.min(100, Math.floor(((_fileIndex + fileProgress) / fileCount) * 100));
          if (percentage === lastReportedPercentage && percentage !== 0 && percentage !== 100) return;
          lastReportedPercentage = percentage;
          onProgress?.({
            stage: 'writing',
            percentage,
            message: `正在写入固件... ${percentage}%`
          });
        }
      });
      throwIfAborted();
      
      // 6. 完成
      onProgress?.({
        stage: 'done',
        percentage: 95,
        message: '正在重启设备...'
      });
      
      // 7. 硬复位设备
      try {
        await port.setSignals({ dataTerminalReady: false });
        await new Promise(resolve => setTimeout(resolve, 100));
        await port.setSignals({ requestToSend: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        await port.setSignals({ requestToSend: false });
      } catch (e) {
        console.log('Reset error (可以忽略):', e);
      }
      
      onProgress?.({
        stage: 'done',
        percentage: 100,
        message: '上传完成！'
      });
      
    } catch (error) {
      console.error('Upload error:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('上传已取消');
        }
        if (error.name === 'NotFoundError') {
          throw new Error('未选择串口设备');
        } else if (error.name === 'SecurityError') {
          throw new Error('没有串口访问权限');
        } else if (error.name === 'NetworkError') {
          throw new Error('设备连接失败，请检查设备是否正常连接');
        } else if (error.name === 'InvalidStateError') {
          throw new Error('串口状态异常，请拔插设备后重试');
        }
        throw new Error(`上传失败: ${error.message}`);
      }
      throw new Error('上传失败');
      
    } finally {
      // 清理资源
      try {
        if (transport) {
          await transport.disconnect();
        }
      } catch {
        // 忽略断开连接错误
      }
    }
  }
}
