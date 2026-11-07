/**
 * 编译客户端
 * 
 * 封装与后端 API 的通信
 */

import axios, { AxiosError } from 'axios';
import type { CompileRequest, CompileResult, BoardListResponse, HealthResponse, ProjectFile, FeedbackRequest } from './types';
import { useLearnerAuthStore } from '../store/learnerAuthStore';

// API 基础 URL
const API_BASE_URL = '/api';

// 超时配置
const COMPILE_TIMEOUT = 70000; // 70 秒
const DOWNLOAD_TIMEOUT = 30000; // 30 秒
const DEFAULT_TIMEOUT = 10000; // 10 秒

/**
 * API 错误类
 */
export class ApiError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(
    message: string,
    statusCode?: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 编译客户端类
 */
export class CompilationClient {
  /**
   * 编译代码
   * 
   * @param code 单文件代码（可选）
   * @param boardId 开发板 ID
   * @param files 多文件项目（可选）
   * @returns 编译结果
   */
  static async compile(code?: string, boardId?: string, files?: ProjectFile[], signal?: AbortSignal, jobId?: string): Promise<CompileResult> {
    try {
      const request: CompileRequest = {
        board_id: boardId!
      };

      if (code) {
        request.code = code;
      } else if (files) {
        request.files = files;
      } else {
        throw new Error('Either code or files must be provided');
      }

      const response = await axios.post<CompileResult>(
        `${API_BASE_URL}/compile`,
        request,
        {
          timeout: COMPILE_TIMEOUT,
          signal,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '',
            ...(jobId ? { 'X-Compile-Job-Id': jobId } : {})
          }
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // 超时错误
        if (axiosError.code === 'ECONNABORTED') {
          throw new ApiError(
            '编译超时，请尝试简化代码或稍后重试',
            408
          );
        }
        
        // 网络错误
        if (!axiosError.response) {
          throw new ApiError(
            '无法连接到服务器，请检查网络连接',
            0
          );
        }
        
        // 服务器错误
        const statusCode = axiosError.response.status;
        const errorData = axiosError.response.data as any;
        
        if (statusCode === 400) {
          throw new ApiError(
            errorData.detail || '请求参数错误',
            statusCode,
            errorData
          );
        }
        
        if (statusCode === 422) {
          // 验证错误 - 通常是未选择开发板
          throw new ApiError(
            '请先选择开发板',
            statusCode,
            errorData
          );
        }
        
        if (statusCode === 500) {
          throw new ApiError(
            '服务器内部错误，请稍后重试',
            statusCode,
            errorData
          );
        }
        
        throw new ApiError(
          `请求失败 (${statusCode})`,
          statusCode,
          errorData
        );
      }
      
      // 其他错误
      throw new ApiError(
        error instanceof Error ? error.message : '未知错误'
      );
    }
  }

  static async cancelCompile(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/compile/${jobId}/cancel`,
        {},
        {
          timeout: DEFAULT_TIMEOUT,
          headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' },
        }
      );
      return response.data;
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : '停止编译失败'
      );
    }
  }

  static async submitFeedback(data: FeedbackRequest): Promise<{ success: boolean; id: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/feedback`,
        data,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new ApiError(
        error instanceof Error ? error.message : '反馈提交失败'
      );
    }
  }
  
  /**
   * 下载固件
   * 
   * @param firmwareId 固件 ID
   * @returns 固件二进制数据
   */
  static async downloadFirmware(firmwareId: string): Promise<Blob> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/firmware/${firmwareId}`,
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
          throw new ApiError(
            '下载超时，请稍后重试',
            408
          );
        }
        
        // 网络错误
        if (!axiosError.response) {
          throw new ApiError(
            '无法连接到服务器，请检查网络连接',
            0
          );
        }
        
        // 404 错误
        if (axiosError.response.status === 404) {
          throw new ApiError(
            '固件文件不存在或已过期',
            404
          );
        }
        
        throw new ApiError(
          `下载失败 (${axiosError.response.status})`,
          axiosError.response.status
        );
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : '下载失败'
      );
    }
  }
  
  /**
   * 获取支持的开发板列表
   * 
   * @returns 开发板列表
   */
  static async getBoards(): Promise<BoardListResponse> {
    try {
      const response = await axios.get<BoardListResponse>(
        `${API_BASE_URL}/boards`,
        {
          timeout: DEFAULT_TIMEOUT
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (!axiosError.response) {
          throw new ApiError(
            '无法连接到服务器，请检查网络连接',
            0
          );
        }
        
        throw new ApiError(
          `获取开发板列表失败 (${axiosError.response.status})`,
          axiosError.response.status
        );
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : '获取开发板列表失败'
      );
    }
  }
  
  /**
   * 健康检查
   * 
   * @returns 健康状态
   */
  static async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await axios.get<HealthResponse>(
        `${API_BASE_URL}/health`,
        {
          timeout: DEFAULT_TIMEOUT
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (!axiosError.response) {
          throw new ApiError(
            '无法连接到服务器',
            0
          );
        }
        
        throw new ApiError(
          `健康检查失败 (${axiosError.response.status})`,
          axiosError.response.status
        );
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : '健康检查失败'
      );
    }
  }

  /**
   * 搜索 Arduino 库（公共）
   */
  static async searchLibraries(query: string): Promise<Array<{ name: string; version: string; description?: string }>> {
    try {
      const response = await axios.get('/api/libraries/search', {
        params: { q: query },
        timeout: 30000,
      });
      return response.data.libraries || [];
    } catch (error) {
      console.error('Library search failed:', error);
      return [];
    }
  }

  /**
   * 安装 Arduino 库（公共）
   */
  static async installLibrary(name: string): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const response = await axios.post('/api/libraries/install', { name }, { timeout: 60000 });
      return response.data;
    } catch (error: any) {
      const data = error?.response?.data;
      const message = data?.detail?.message || data?.message || data?.detail || error?.message || '安装失败';
      return { success: false, message: typeof message === 'string' ? message : '安装失败' };
    }
  }

  /** 本地上传库文件（公共） */
  static async uploadLibraryZip(file: File): Promise<{ success: boolean; message: string; name?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('/api/libraries/upload', formData, { timeout: 60000 });
      return response.data;
    } catch (error: any) {
      const data = error?.response?.data;
      const message = data?.detail?.message || data?.message || data?.detail || error?.message || '上传失败';
      return { success: false, message: typeof message === 'string' ? message : '上传失败' };
    }
  }

  /** 获取自定义库列表 */
  static async getCustomLibraries(): Promise<Array<{ name: string }>> {
    try {
      const response = await axios.get('/api/libraries/custom', { timeout: 10000 });
      return response.data.libraries || [];
    } catch {
      return [];
    }
  }

  /** 获取已安装的库列表（用户端验证用） */
  static async getInstalledLibraries(): Promise<Array<{ name: string; version: string }>> {
    try {
      const response = await axios.get('/api/libraries/installed', { timeout: 10000 });
      return response.data.libraries || [];
    } catch {
      return [];
    }
  }
}
