/**
 * 管理员客户端
 * 
 * 提供管理员认证和固件管理功能（需要认证）
 */

import axios, { AxiosError } from 'axios';
import type {
  AdminCredentials,
  AdminToken,
  FirmwareMetadata,
  FirmwareFilters,
  FirmwareListResponse,
  FirmwareUploadData,
  AIConfig,
  ServiceConfig,
  ServiceTestRequest,
  ServiceTestResponse,
  AdminStatistics,
  BoardConfigFull,
  BoardSearchResult,
  BackupInfo,
  SystemStatus,
  CourseFolder,
  CourseQAItem,
} from './types';

// API 基础 URL
const ADMIN_API_BASE_URL = '/api/admin';

// 超时配置
const DEFAULT_TIMEOUT = 10000; // 10 秒
const UPLOAD_TIMEOUT = 120000; // 120 秒

// httpOnly cookie 自动携带的 axios 实例
const adminAxios = axios.create({
  withCredentials: true,
});

/**
 * 管理员 API 错误类
 */
export class AdminApiError extends Error {
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
    this.name = 'AdminApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * 管理员客户端类
 */
export class AdminClient {
  /**
   * 获取通用 JSON 请求头。认证只依赖 httpOnly cookie。
   */
  private static getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * 处理 API 错误
   */
  private static handleError(error: unknown, defaultMessage: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      // 超时错误
      if (axiosError.code === 'ECONNABORTED') {
        throw new AdminApiError('请求超时，请稍后重试', 408);
      }
      
      // 网络错误
      if (!axiosError.response) {
        throw new AdminApiError('无法连接到服务器，请检查网络连接', 0);
      }
      
      // 服务器错误
      const statusCode = axiosError.response.status;
      const errorData = axiosError.response.data as any;
      // FastAPI 返回 {"detail": {...}} 格式，提取真实消息
      const detailMsg = errorData?.detail?.message || errorData?.message || errorData?.detail;
      const msg = typeof detailMsg === 'string' ? detailMsg : `${defaultMessage} (${statusCode})`;

      // 401 错误 - 清除 token
      if (statusCode === 401) {
        throw new AdminApiError(
          errorData?.message || '认证失败，请重新登录',
          401,
          errorData?.error_code
        );
      }

      throw new AdminApiError(
        msg,
        statusCode,
        errorData?.error_code,
        errorData
      );
    }
    
    throw new AdminApiError(
      error instanceof Error ? error.message : defaultMessage
    );
  }
  
  // ============================================================================
  // 认证相关
  // ============================================================================
  
  /**
   * 管理员登录
   * 
   * @param credentials 登录凭证
   * @returns Token 信息
   */
  static async login(credentials: AdminCredentials): Promise<AdminToken> {
    try {
      const response = await adminAxios.post<AdminToken>(
        `${ADMIN_API_BASE_URL}/login`,
        credentials,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      this.handleError(error, '登录失败');
    }
  }
  
  /**
   * 管理员登出
   */
  static async logout(): Promise<void> {
    try {
      await adminAxios.post(
        `${ADMIN_API_BASE_URL}/logout`,
        {},
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      console.warn('Logout request failed:', error);
    }
  }
  
  /**
   * 验证 Token
   * 
   * @returns 用户信息
   */
  static async verifyToken(): Promise<{ username: string; expires_at: number }> {
    try {
      const response = await adminAxios.get(
        `${ADMIN_API_BASE_URL}/verify`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
      
      return response.data;
    } catch (error) {
      this.handleError(error, '验证 Token 失败');
    }
  }
  
  /**
   * 检查是否已登录
   */
  static isLoggedIn(): boolean {
    return false;
  }

  /** Structured MakeFast course authoring endpoints. */
  static async getLearningCourseDraft(slug: string): Promise<{ revision: number; content: unknown }> {
    try {
      const response = await adminAxios.get(`${ADMIN_API_BASE_URL}/learning/courses/${encodeURIComponent(slug)}/draft`, { timeout: DEFAULT_TIMEOUT });
      return response.data;
    } catch (error) {
      this.handleError(error, '读取课程草稿失败');
    }
  }

  static async createLearningCourseDraft(content: unknown): Promise<{ revision: number; content: unknown }> {
    try {
      const response = await adminAxios.post(`${ADMIN_API_BASE_URL}/learning/courses`, content, { timeout: DEFAULT_TIMEOUT, headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      this.handleError(error, '创建课程草稿失败');
    }
  }

  static async saveLearningCourseDraft(slug: string, revision: number, content: unknown): Promise<{ revision: number; content: unknown }> {
    try {
      const response = await adminAxios.put(`${ADMIN_API_BASE_URL}/learning/courses/${encodeURIComponent(slug)}/draft`, { revision, content }, { timeout: DEFAULT_TIMEOUT, headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      this.handleError(error, '保存课程草稿失败');
    }
  }

  static async validateLearningCourse(slug: string): Promise<{ valid: boolean; revision: number; errors: Array<{ field: string; message: string }> }> {
    try {
      const response = await adminAxios.post(`${ADMIN_API_BASE_URL}/learning/courses/${encodeURIComponent(slug)}/validate`, {}, { timeout: DEFAULT_TIMEOUT, headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      this.handleError(error, '校验课程失败');
    }
  }

  static async publishLearningCourse(slug: string, revision: number): Promise<{ version: number; published_at: string }> {
    try {
      const response = await adminAxios.post(`${ADMIN_API_BASE_URL}/learning/courses/${encodeURIComponent(slug)}/publish`, { revision }, { timeout: DEFAULT_TIMEOUT, headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      this.handleError(error, '发布课程失败');
    }
  }
  
  // ============================================================================
  // 固件管理
  // ============================================================================
  
  /**
   * 获取所有固件（包括未发布）
   * 
   * @param filters 筛选条件（可选）
   * @returns 固件列表
   */
  static async getAllFirmware(filters?: FirmwareFilters): Promise<FirmwareListResponse> {
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

      const response = await adminAxios.get<FirmwareListResponse>(
        `${ADMIN_API_BASE_URL}/firmware`,
        {
          params,
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );

      return response.data;
    } catch (error) {
      this.handleError(error, '获取固件列表失败');
    }
  }
  
  /**
   * 上传固件包
   * 
   * @param data 固件上传数据
   * @returns 上传结果
   */
  static async uploadFirmware(data: FirmwareUploadData): Promise<{ firmware_id: string }> {
    try {
      const formData = new FormData();
      formData.append('zip_file', data.zip_file);
      formData.append('project_name', data.project_name);
      formData.append('description', data.description);
      formData.append('version', data.version);
      formData.append('supported_board_ids', data.supported_board_ids.join(','));
      formData.append('tags', data.tags.join(','));
      formData.append('published', data.published.toString());
      
      const response = await adminAxios.post(
        `${ADMIN_API_BASE_URL}/firmware`,
        formData,
        {
          timeout: UPLOAD_TIMEOUT,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      this.handleError(error, '上传固件失败');
    }
  }
  
  /**
   * 更新固件元数据
   * 
   * @param firmwareId 固件 ID
   * @param metadata 元数据
   */
  static async updateFirmwareMetadata(
    firmwareId: string,
    metadata: Partial<FirmwareMetadata>
  ): Promise<void> {
    try {
      await adminAxios.put(
        `${ADMIN_API_BASE_URL}/firmware/${firmwareId}`,
        metadata,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      this.handleError(error, '更新固件元数据失败');
    }
  }
  
  /**
   * 删除固件
   * 
   * @param firmwareId 固件 ID
   */
  static async deleteFirmware(firmwareId: string): Promise<void> {
    try {
      await adminAxios.delete(
        `${ADMIN_API_BASE_URL}/firmware/${firmwareId}`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      this.handleError(error, '删除固件失败');
    }
  }

  /**
   * 恢复已删除的固件
   */
  static async restoreFirmware(firmwareId: string): Promise<void> {
    try {
      await adminAxios.post(
        `${ADMIN_API_BASE_URL}/firmware/${firmwareId}/restore`,
        null,
        { timeout: DEFAULT_TIMEOUT, headers: this.getAuthHeaders() }
      );
    } catch (error) {
      this.handleError(error, '恢复固件失败');
    }
  }

  /**
   * 永久删除固件
   */
  static async permanentDeleteFirmware(firmwareId: string): Promise<void> {
    try {
      await adminAxios.delete(
        `${ADMIN_API_BASE_URL}/firmware/${firmwareId}/permanent`,
        { timeout: DEFAULT_TIMEOUT, headers: this.getAuthHeaders() }
      );
    } catch (error) {
      this.handleError(error, '永久删除固件失败');
    }
  }

  /**
   * 获取固件回收站列表
   */
  static async getTrashedFirmware(): Promise<{ success: boolean; items: FirmwareMetadata[]; count: number }> {
    try {
      const response = await adminAxios.get(`${ADMIN_API_BASE_URL}/firmware/trash`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error, '获取固件回收站列表失败');
    }
  }

  /**
   * 清空固件回收站
   */
  static async emptyFirmwareTrash(): Promise<{ success: boolean; deleted_count: number }> {
    try {
      const response = await adminAxios.post(
        `${ADMIN_API_BASE_URL}/firmware/trash/empty`,
        null,
        { timeout: DEFAULT_TIMEOUT, headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, '清空固件回收站失败');
    }
  }

  /**
   * 上传缩略图
   * 
   * @param firmwareId 固件 ID
   * @param file 图片文件
   */
  static async uploadThumbnail(firmwareId: string, file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('thumbnail', file);
      
      await adminAxios.post(
        `${ADMIN_API_BASE_URL}/firmware/${firmwareId}/thumbnail`,
        formData,
        {
          timeout: UPLOAD_TIMEOUT,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
    } catch (error) {
      this.handleError(error, '上传缩略图失败');
    }
  }
  
  /**
   * 切换发布状态
   * 
   * @param firmwareId 固件 ID
   * @param published 是否发布
   */
  static async togglePublish(firmwareId: string, published: boolean): Promise<void> {
    try {
      await adminAxios.patch(
        `${ADMIN_API_BASE_URL}/firmware/${firmwareId}/publish`,
        { published },
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      this.handleError(error, '切换发布状态失败');
    }
  }
  
  // ============================================================================
  // 版本管理
  // ============================================================================

  /**
   * 检查版本冲突
   * 
   * @param projectName 项目名称
   * @param version 版本号
   * @returns 冲突检查结果
   */
  static async checkVersionConflict(
    projectName: string,
    version: string
  ): Promise<{ conflict: boolean; message: string; existing_firmware_id?: string }> {
    try {
      const response = await adminAxios.get(
        `${ADMIN_API_BASE_URL}/firmware/check-version`,
        {
          params: { project_name: projectName, version },
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
      
      return response.data;
    } catch (error) {
      this.handleError(error, '版本冲突检查失败');
    }
  }

  /**
   * 获取项目版本历史
   * 
   * @param projectName 项目名称
   * @returns 该项目的所有版本列表
   */
  static async getProjectVersions(projectName: string): Promise<FirmwareMetadata[]> {
    try {
      const response = await adminAxios.get<FirmwareMetadata[]>(
        `${ADMIN_API_BASE_URL}/firmware/project-versions/${encodeURIComponent(projectName)}`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
      
      return response.data;
    } catch (error) {
      this.handleError(error, '获取项目版本历史失败');
    }
  }

  // ============================================================================
  // 统计信息
  // ============================================================================
  
  /**
   * 获取统计信息
   * 
   * @returns 统计信息
   */
  static async getStatistics(): Promise<AdminStatistics> {
    try {
      const response = await adminAxios.get(
        `${ADMIN_API_BASE_URL}/statistics`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
      
      // 后端返回 { success: true, data: { ... } }，需要映射字段名
      const raw = response.data?.data || response.data;
      return {
        // 固件统计
        total_firmware_count: raw.total_firmwares ?? raw.total_firmware_count ?? 0,
        published_firmware_count: raw.published_firmwares ?? raw.published_firmware_count ?? 0,
        total_storage_mb: raw.total_size_mb ?? raw.total_storage_mb ?? 0,
        downloads_last_30_days: raw.total_downloads ?? raw.downloads_last_30_days ?? 0,
        flashes_last_30_days: raw.total_flashes ?? raw.flashes_last_30_days ?? 0,
        top_firmware: (raw.popular_firmwares ?? raw.top_firmware ?? []).map((f: any) => ({
          firmware_id: f.firmware_id || '',
          project_name: f.project_name || '',
          download_count: f.download_count ?? 0,
          flash_count: f.flash_count ?? 0,
        })),
        storage_warning: raw.storage_warning ?? false,
        compile_stats: {
          total: raw.compile_stats?.total ?? 0,
          success: raw.compile_stats?.success ?? 0,
          failure: raw.compile_stats?.failure ?? 0,
          failure_rate: raw.compile_stats?.failure_rate ?? 0,
        },
        flash_stats: {
          total: raw.flash_stats?.total ?? 0,
          success: raw.flash_stats?.success ?? 0,
          failure: raw.flash_stats?.failure ?? 0,
          failure_rate: raw.flash_stats?.failure_rate ?? 0,
        },
        storage: {
          disk_path: raw.storage?.disk_path ?? '',
          disk_total_mb: raw.storage?.disk_total_mb ?? 0,
          disk_used_mb: raw.storage?.disk_used_mb ?? 0,
          disk_free_mb: raw.storage?.disk_free_mb ?? 0,
          disk_usage_percent: raw.storage?.disk_usage_percent ?? 0,
          app_used_mb: raw.storage?.app_used_mb ?? raw.total_size_mb ?? 0,
          breakdown_mb: raw.storage?.breakdown_mb ?? {},
          warning: raw.storage?.warning ?? raw.storage_warning ?? false,
        },
        recent_feedback: (raw.recent_feedback ?? []).map((item: any) => ({
          id: item.id || '',
          category: item.category || '反馈',
          message: item.message || '',
          contact: item.contact || '',
          page_url: item.page_url || '',
          logs: Array.isArray(item.logs) ? item.logs : [],
          status: item.status || 'new',
          created_at: item.created_at || '',
        })),
        // 模板统计
        total_template_count: raw.total_templates ?? 0,
        published_template_count: raw.published_templates ?? 0,
        total_template_views: raw.total_template_views ?? 0,
        total_template_open_projects: raw.total_template_open_projects ?? 0,
        total_template_downloads: raw.total_template_downloads ?? 0,
        total_template_package_downloads: raw.total_template_package_downloads ?? 0,
        total_template_flashes: raw.total_template_flashes ?? 0,
        total_template_unlocks: raw.total_template_unlocks ?? 0,
        popular_templates: (raw.popular_templates ?? []).map((t: any) => ({
          template_id: t.template_id || '',
          name: t.name || '',
          category: t.category || '',
          view_count: t.view_count ?? 0,
          download_count: t.download_count ?? 0,
          flash_count: t.flash_count ?? 0,
        })),
      };
    } catch (error) {
      this.handleError(error, '获取统计信息失败');
    }
  }
  
  // ============================================================================
  // 固件导入导出
  // ============================================================================

  /**
   * 导出固件包
   * 
   * @param firmwareId 固件 ID
   * @returns 下载 Blob
   */
  static async exportFirmware(firmwareId: string): Promise<Blob> {
    try {
      const response = await adminAxios.get(
        `${ADMIN_API_BASE_URL}/firmware/${firmwareId}/export`,
        {
          timeout: UPLOAD_TIMEOUT,
          responseType: 'blob',
        }
      );

      return response.data;
    } catch (error) {
      this.handleError(error, '导出固件失败');
    }
  }

  /**
   * 导入固件包
   * 
   * @param file ZIP 文件
   * @param overwrite 是否覆盖已存在的同名同版本固件
   * @returns 导入结果
   */
  static async importFirmware(file: File, overwrite: boolean = false): Promise<{
    success: boolean;
    conflict?: boolean;
    firmware_id?: string;
    project_name?: string;
    version?: string;
    existing_firmware_id?: string;
    message?: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('zip_file', file);
      formData.append('overwrite', overwrite.toString());

      const response = await adminAxios.post(
        `${ADMIN_API_BASE_URL}/firmware/import`,
        formData,
        {
          timeout: UPLOAD_TIMEOUT,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return response.data;
    } catch (error) {
      this.handleError(error, '导入固件失败');
    }
  }

  // ============================================================================
  // AI 配置
  // ============================================================================
  
  /**
   * 获取 AI 配置
   * 
   * @returns AI 配置
   */
  static async getAIConfig(): Promise<AIConfig> {
    try {
      const response = await adminAxios.get<{ success: boolean; config: AIConfig }>(
        `${ADMIN_API_BASE_URL}/ai-config`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
      
      return response.data.config;
    } catch (error) {
      this.handleError(error, '获取 AI 配置失败');
    }
  }
  
  /**
   * 更新 AI 配置
   * 
   * @param config AI 配置
   */
  static async updateAIConfig(config: AIConfig): Promise<void> {
    try {
      await adminAxios.put(
        `${ADMIN_API_BASE_URL}/ai-config`,
        config,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      this.handleError(error, '更新 AI 配置失败');
    }
  }

  static async getServiceConfig(): Promise<ServiceConfig> {
    try {
      const response = await adminAxios.get<{ success: boolean; config: ServiceConfig }>(
        `${ADMIN_API_BASE_URL}/service-config`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
      return response.data.config;
    } catch (error) {
      this.handleError(error, '获取服务配置失败');
    }
  }

  static async updateServiceConfig(config: ServiceConfig): Promise<void> {
    try {
      await adminAxios.put(
        `${ADMIN_API_BASE_URL}/service-config`,
        config,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders()
        }
      );
    } catch (error) {
      this.handleError(error, '更新服务配置失败');
    }
  }

  static async testServiceConfig(payload: ServiceTestRequest): Promise<ServiceTestResponse> {
    try {
      const response = await adminAxios.post<{ success: boolean; message: string }>(
        `${ADMIN_API_BASE_URL}/service-config/test`,
        payload,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, '测试连接失败');
    }
  }

  // ==========================================================================
  // 库管理
  // ==========================================================================

  /** 获取已安装库列表 */
  static async getLibraries(): Promise<Array<{ name: string; version: string }>> {
    try {
      const response = await adminAxios.get(`${ADMIN_API_BASE_URL}/libraries`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return response.data.libraries || [];
    } catch (error) {
      this.handleError(error, '获取库列表失败');
    }
  }

  /** 在线安装库 */
  static async installLibrary(name: string): Promise<{ success: boolean; message: string; name?: string; version?: string }> {
    try {
      const response = await adminAxios.post(`${ADMIN_API_BASE_URL}/libraries/install`,
        { name },
        { timeout: 60000, headers: this.getAuthHeaders() },
      );
      return response.data;
    } catch (error) {
      this.handleError(error, '安装库失败');
    }
  }

  /** 卸载库 */
  static async uninstallLibrary(name: string): Promise<void> {
    try {
      await adminAxios.delete(`${ADMIN_API_BASE_URL}/libraries/${encodeURIComponent(name)}`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
    } catch (error) {
      this.handleError(error, '卸载库失败');
    }
  }

  /** 上传自定义库 ZIP */
  static async uploadCustomLibrary(file: File, name: string): Promise<{ success: boolean; message: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/libraries/custom`, formData, {
        timeout: 60000,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '上传自定义库失败');
      return { success: false, message: '上传失败' };
    }
  }

  /** 删除自定义库 */
  static async deleteCustomLibrary(name: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await adminAxios.delete(`${ADMIN_API_BASE_URL}/libraries/custom/${encodeURIComponent(name)}`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '删除自定义库失败');
      return { success: false, message: '删除失败' };
    }
  }

  // ========== 自定义积木管理 ==========

  static async getCustomBlocks(): Promise<any[]> {
    try {
      const resp = await adminAxios.get(`${ADMIN_API_BASE_URL}/blocks`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.blocks || [];
    } catch (error) {
      this.handleError(error, '获取自定义积木列表失败');
      return [];
    }
  }

  static async saveCustomBlock(block: {
    name: string;
    category: string;
    json_definition: any;
    generator_code: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/blocks`, block, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '保存自定义积木失败');
      return { success: false, message: '保存失败' };
    }
  }

  static async deleteCustomBlock(name: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await adminAxios.delete(`${ADMIN_API_BASE_URL}/blocks/${encodeURIComponent(name)}`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '删除自定义积木失败');
      return { success: false, message: '删除失败' };
    }
  }

  /** 检测库冲突 */
  static async checkLibraryConflicts(): Promise<Record<string, string[]>> {
    try {
      const resp = await adminAxios.get(`${ADMIN_API_BASE_URL}/libraries/conflicts`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.conflicts || {};
    } catch (error) {
      this.handleError(error, '检测冲突失败');
      return {};
    }
  }

  // ==========================================================================
  // 开发板管理
  // ==========================================================================

  /** 获取所有开发板（含完整配置） */
  static async getBoards(): Promise<BoardConfigFull[]> {
    try {
      const resp = await adminAxios.get(`${ADMIN_API_BASE_URL}/boards`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.boards || [];
    } catch (error) {
      this.handleError(error, '获取开发板列表失败');
      return [];
    }
  }

  /** 搜索可用开发板（arduino-cli board listall） */
  static async searchBoards(keyword: string): Promise<BoardSearchResult[]> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/boards/search`, { keyword }, {
        timeout: 15000,
        headers: this.getAuthHeaders(),
      });
      return resp.data.boards || [];
    } catch (error) {
      this.handleError(error, '搜索开发板失败');
      return [];
    }
  }

  /** 安装开发板平台核心（流式进度） */
  static async deployBoard(
    fqbn: string,
    onProgress: (line: string) => void,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await fetch(`${ADMIN_API_BASE_URL}/boards/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fqbn }),
        credentials: 'include',
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: { message: resp.statusText } }));
        const msg = err?.detail?.message || err?.message || `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let lastMessage = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            onProgress(data.message || line);
            if (data.type === 'complete') {
              lastMessage = data.message;
            } else if (data.type === 'error') {
              return { success: false, message: data.message };
            }
          } catch {
            onProgress(line);
          }
        }
      }

      return { success: true, message: lastMessage || '安装完成' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : '安装失败';
      return { success: false, message: msg };
    }
  }

  /** 保存开发板（新增或覆盖内置） */
  static async saveBoard(board: Omit<BoardConfigFull, 'builtin' | 'overridden'>): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/boards`, board, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '保存开发板失败');
      return { success: false, message: '保存失败' };
    }
  }

  /** 删除开发板 */
  static async deleteBoard(board_id: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await adminAxios.delete(`${ADMIN_API_BASE_URL}/boards/${encodeURIComponent(board_id)}`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '删除开发板失败');
      return { success: false, message: '删除失败' };
    }
  }

  /** 保存开发板排序 */
  static async reorderBoards(
    orderedIds: string[],
    boardUpdates?: Array<{ board_id: string; chip_family: string }>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/boards/reorder`, {
        ordered_ids: orderedIds,
        board_updates: boardUpdates,
      }, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '保存排序失败');
      return { success: false, message: '保存失败' };
    }
  }

  /** 恢复开发板为默认配置 */
  static async resetBoard(board_id: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/boards/${encodeURIComponent(board_id)}/reset`, {}, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '恢复失败');
      return { success: false, message: '恢复失败' };
    }
  }

  static async getSystemStatus(): Promise<SystemStatus> {
    try {
      const resp = await adminAxios.get(`${ADMIN_API_BASE_URL}/system/status`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.data;
    } catch (error) {
      this.handleError(error, '获取系统状态失败');
    }
  }

  static async listBackups(): Promise<BackupInfo[]> {
    try {
      const resp = await adminAxios.get(`${ADMIN_API_BASE_URL}/backups`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.backups || [];
    } catch (error) {
      this.handleError(error, '获取备份列表失败');
    }
  }

  static async createBackup(): Promise<{ success: boolean; name: string; size: number }> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/backups`, {}, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '创建备份失败');
    }
  }

  static async listCourseQA(params?: { status?: string; template_id?: string; search?: string; limit?: number }): Promise<CourseQAItem[]> {
    try {
      const resp = await adminAxios.get(`${ADMIN_API_BASE_URL}/course-qa`, {
        params,
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.items || [];
    } catch (error) {
      this.handleError(error, '获取课程问答失败');
    }
  }

  static async approveCourseQA(id: string): Promise<CourseQAItem> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/course-qa/${encodeURIComponent(id)}/approve`, {}, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '审核课程问答失败');
    }
  }

  static async hideCourseQA(id: string): Promise<CourseQAItem> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/course-qa/${encodeURIComponent(id)}/hide`, {}, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '隐藏课程问答失败');
    }
  }

  static async replyCourseQA(id: string, admin_reply: string, is_public = true): Promise<{ success: boolean; item: CourseQAItem; email: { sent: boolean; message: string } }> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/course-qa/${encodeURIComponent(id)}/reply`, {
        admin_reply,
        is_public,
      }, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '回复课程问答失败');
    }
  }

  static async deleteCourseQA(id: string): Promise<void> {
    try {
      await adminAxios.delete(`${ADMIN_API_BASE_URL}/course-qa/${encodeURIComponent(id)}`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
    } catch (error) {
      this.handleError(error, '删除课程问答失败');
    }
  }

  static getBackupDownloadUrl(name: string): string {
    return `${ADMIN_API_BASE_URL}/backups/${encodeURIComponent(name)}`;
  }

  static async listCourseFolders(): Promise<CourseFolder[]> {
    try {
      const resp = await adminAxios.get(`${ADMIN_API_BASE_URL}/course-folders`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.folders || [];
    } catch (error) {
      this.handleError(error, '获取课程文件夹失败');
    }
  }

  static async createCourseFolder(data: Partial<CourseFolder> & { template_ids?: string[] }): Promise<CourseFolder> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/course-folders`, data, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '创建课程文件夹失败');
    }
  }

  static async updateCourseFolder(folderId: string, data: Partial<CourseFolder> & { template_ids?: string[] }): Promise<CourseFolder> {
    try {
      const resp = await adminAxios.put(`${ADMIN_API_BASE_URL}/course-folders/${encodeURIComponent(folderId)}`, data, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '更新课程文件夹失败');
    }
  }

  static async uploadCourseFolderCover(folderId: string, file: File): Promise<CourseFolder> {
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/course-folders/${encodeURIComponent(folderId)}/cover`, formData, {
        timeout: UPLOAD_TIMEOUT,
      });
      return resp.data;
    } catch (error) {
      this.handleError(error, '上传课程文件夹封面失败');
    }
  }

  static async deleteCourseFolder(folderId: string): Promise<void> {
    try {
      await adminAxios.delete(`${ADMIN_API_BASE_URL}/course-folders/${encodeURIComponent(folderId)}`, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
    } catch (error) {
      this.handleError(error, '删除课程文件夹失败');
    }
  }

  static async reorderCourseFolders(folderIds: string[]): Promise<CourseFolder[]> {
    try {
      const resp = await adminAxios.post(`${ADMIN_API_BASE_URL}/course-folders/reorder`, {
        folder_ids: folderIds,
      }, {
        timeout: DEFAULT_TIMEOUT,
        headers: this.getAuthHeaders(),
      });
      return resp.data.folders || [];
    } catch (error) {
      this.handleError(error, '保存课程文件夹排序失败');
    }
  }
}
