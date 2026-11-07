/**
 * 固件客户端（用户端）
 * 
 * 提供用户端固件浏览、搜索、下载和烧录功能（无需认证）
 */

import axios, { AxiosError } from 'axios';
import type { FirmwareMetadata, FirmwareFilters, FirmwareListResponse } from './types';

// API 基础 URL
const API_BASE_URL = '/api/firmware';

// 超时配置
const DEFAULT_TIMEOUT = 10000; // 10 秒
const DOWNLOAD_TIMEOUT = 60000; // 60 秒

/**
 * API 错误类
 */
export class FirmwareApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'FirmwareApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * 固件客户端类（用户端）
 */
export class FirmwareClient {
  /**
   * 获取已发布固件列表
   * 
   * @param filters 筛选条件（可选）
   * @returns 固件列表
   */
  static async getFirmwareList(filters?: FirmwareFilters): Promise<FirmwareListResponse> {
    try {
      const params: Record<string, string> = {};

      if (filters?.board_id) {
        params.board_id = filters.board_id;
      }

      if (filters?.tags && filters.tags.length > 0) {
        params.tags = filters.tags.join(',');
      }

      if (filters?.search) {
        params.search = filters.search;
      }

      if (filters?.page) {
        params.page = String(filters.page);
      }

      if (filters?.page_size) {
        params.page_size = String(filters.page_size);
      }

      const response = await axios.get<FirmwareListResponse>(
        API_BASE_URL,
        {
          params,
          timeout: DEFAULT_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // 超时错误
        if (axiosError.code === 'ECONNABORTED') {
          throw new FirmwareApiError(
            '请求超时，请稍后重试',
            408
          );
        }
        
        // 网络错误
        if (!axiosError.response) {
          throw new FirmwareApiError(
            '无法连接到服务器，请检查网络连接',
            0
          );
        }
        
        // 服务器错误
        const statusCode = axiosError.response.status;
        const errorData = axiosError.response.data as any;
        
        throw new FirmwareApiError(
          errorData?.message || `获取固件列表失败 (${statusCode})`,
          statusCode,
          errorData?.error_code,
          errorData
        );
      }
      
      // 其他错误
      throw new FirmwareApiError(
        error instanceof Error ? error.message : '获取固件列表失败'
      );
    }
  }
  
  /**
   * 获取固件详情
   * 
   * @param firmwareId 固件 ID
   * @returns 固件详情
   */
  static async getFirmwareDetail(firmwareId: string): Promise<FirmwareMetadata> {
    try {
      const response = await axios.get<FirmwareMetadata>(
        `${API_BASE_URL}/${firmwareId}`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // 超时错误
        if (axiosError.code === 'ECONNABORTED') {
          throw new FirmwareApiError(
            '请求超时，请稍后重试',
            408
          );
        }
        
        // 网络错误
        if (!axiosError.response) {
          throw new FirmwareApiError(
            '无法连接到服务器，请检查网络连接',
            0
          );
        }
        
        // 404 错误
        const statusCode = axiosError.response.status;
        const errorData = axiosError.response.data as any;
        
        if (statusCode === 404) {
          throw new FirmwareApiError(
            '固件包不存在或未发布',
            404,
            errorData?.error_code
          );
        }
        
        throw new FirmwareApiError(
          errorData?.message || `获取固件详情失败 (${statusCode})`,
          statusCode,
          errorData?.error_code,
          errorData
        );
      }
      
      throw new FirmwareApiError(
        error instanceof Error ? error.message : '获取固件详情失败'
      );
    }
  }
  
  /**
   * 下载固件包（ZIP 格式）
   * 
   * @param firmwareId 固件 ID
   * @returns 固件包 Blob
   */
  static async downloadFirmware(firmwareId: string): Promise<Blob> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/${firmwareId}/download`,
        {
          timeout: DOWNLOAD_TIMEOUT,
          responseType: 'blob'
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // 超时错误
        if (axiosError.code === 'ECONNABORTED') {
          throw new FirmwareApiError(
            '下载超时，请稍后重试',
            408
          );
        }
        
        // 网络错误
        if (!axiosError.response) {
          throw new FirmwareApiError(
            '无法连接到服务器，请检查网络连接',
            0
          );
        }
        
        // 404 错误
        const statusCode = axiosError.response.status;
        
        if (statusCode === 404) {
          throw new FirmwareApiError(
            '固件包不存在或未发布',
            404
          );
        }
        
        throw new FirmwareApiError(
          `下载固件包失败 (${statusCode})`,
          statusCode
        );
      }
      
      throw new FirmwareApiError(
        error instanceof Error ? error.message : '下载固件包失败'
      );
    }
  }
  
  /**
   * 下载单个固件文件
   * 
   * @param firmwareId 固件 ID
   * @param filename 文件名
   * @returns 文件 Blob
   */
  static async downloadFirmwareFile(firmwareId: string, filename: string): Promise<Blob> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/${firmwareId}/files/${filename}`,
        {
          timeout: DOWNLOAD_TIMEOUT,
          responseType: 'blob'
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // 超时错误
        if (axiosError.code === 'ECONNABORTED') {
          throw new FirmwareApiError(
            '下载超时，请稍后重试',
            408
          );
        }
        
        // 网络错误
        if (!axiosError.response) {
          throw new FirmwareApiError(
            '无法连接到服务器，请检查网络连接',
            0
          );
        }
        
        // 404 错误
        const statusCode = axiosError.response.status;
        
        if (statusCode === 404) {
          throw new FirmwareApiError(
            '固件文件不存在',
            404
          );
        }
        
        throw new FirmwareApiError(
          `下载固件文件失败 (${statusCode})`,
          statusCode
        );
      }
      
      throw new FirmwareApiError(
        error instanceof Error ? error.message : '下载固件文件失败'
      );
    }
  }
  
  /**
   * 获取缩略图 URL
   * 
   * @param firmwareId 固件 ID
   * @returns 缩略图 URL
   */
  static getThumbnailUrl(firmwareId: string): string {
    return `${API_BASE_URL}/${firmwareId}/thumbnail`;
  }
  
  /**
   * 记录烧录事件（用于统计）
   * 
   * @param firmwareId 固件 ID
   * @param success 是否成功
   */
  static async logFlashEvent(firmwareId: string, success: boolean): Promise<void> {
    try {
      await axios.post(
        `${API_BASE_URL}/${firmwareId}/flash-log`,
        { success },
        {
          timeout: DEFAULT_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      // 记录失败不影响用户操作，只记录日志
      console.warn('Failed to log flash event:', error);
    }
  }
}
