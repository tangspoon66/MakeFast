/**
 * 模板 API 客户端
 *
 * 提供项目模板的浏览（公共）和管理（管理员）功能
 * - 公共端点: /api/templates（无需认证）
 * - 管理员端点: /api/admin/templates（需要 httpOnly cookie 会话）
 */

import axios, { AxiosError } from 'axios';
import type { CourseFolder, CourseQAItem, CourseQAQuestionCreate } from './types';
import { useLearnerAuthStore } from '../store/learnerAuthStore';

// ============================================================================
// TypeScript 接口定义
// ============================================================================

/** 模板源代码文件 */
export interface TemplateSourceFile {
  name: string;
  content: string;
}

/** 模板列表项（不含源文件内容） */
export interface TemplateListItem {
  template_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  supported_board_ids: string[];
  published: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at?: string;
  file_count: number;
  total_size: number;
  article?: string;
  video_url?: string;
  cover_url?: string;
  has_thumbnail?: boolean;
  level?: number;
  pinned?: boolean;
  packages?: string[];
  locked_resources?: string[];
  unlock_code?: string | null;
}

/** 模板详情（含源文件内容） */
export interface TemplateDetail extends TemplateListItem {
  files: TemplateSourceFile[];
}

/** 模板列表分页响应 */
export interface TemplateListResponse {
  templates: TemplateListItem[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

/** 附件包信息 */
export interface PackageInfo {
  tag: string;
  filename: string;
  size: number;
  locked: boolean;
  url?: string | null;
}

/** 创建模板请求 */
export interface TemplateCreateRequest {
  name: string;
  description: string;
  category: string;
  tags?: string[];
  supported_board_ids: string[];
  published?: boolean;
  files: TemplateSourceFile[];
  article?: string;
  video_url?: string;
  cover_url?: string;
  level?: number;
  pinned?: boolean;
  packages?: string[];
  locked_resources?: string[];
  unlock_code?: string;
}

/** 更新模板请求（所有字段可选） */
export interface TemplateUpdateRequest {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  supported_board_ids?: string[];
  published?: boolean;
  files?: TemplateSourceFile[];
  article?: string;
  video_url?: string;
  cover_url?: string;
  level?: number;
  pinned?: boolean;
  packages?: string[];
  locked_resources?: string[];
  unlock_code?: string;
}

/** 模板列表查询参数 */
export interface TemplateListParams {
  category?: string;
  tags?: string;
  board_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// 配置
// ============================================================================

const PUBLIC_API_BASE = '/api/templates';
const ADMIN_API_BASE = '/api/admin/templates';

const DEFAULT_TIMEOUT = 10000; // 10 秒
const UPLOAD_TIMEOUT = 120000; // 120 秒
const adminAxios = axios.create({ withCredentials: true });

// ============================================================================
// 错误处理
// ============================================================================

/** 模板 API 错误类 */
export class TemplateApiError extends Error {
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
    this.name = 'TemplateApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * 获取管理员认证头
 */
function getAdminAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

function getMultipartHeaders(): Record<string, string> {
  return {
    'Content-Type': 'multipart/form-data',
  };
}

/**
 * 统一错误处理
 */
function handleError(error: unknown, defaultMessage: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    if (axiosError.code === 'ECONNABORTED') {
      throw new TemplateApiError('请求超时，请稍后重试', 408);
    }

    if (!axiosError.response) {
      throw new TemplateApiError('无法连接到服务器，请检查网络连接', 0);
    }

    const statusCode = axiosError.response.status;
    const errorData = axiosError.response.data as any;

    if (statusCode === 401) {
      throw new TemplateApiError(
        errorData?.message || '认证失败，请重新登录',
        401,
        errorData?.error_code
      );
    }

    throw new TemplateApiError(
      errorData?.message || `${defaultMessage} (${statusCode})`,
      statusCode,
      errorData?.error_code,
      errorData
    );
  }

  throw new TemplateApiError(
    error instanceof Error ? error.message : defaultMessage
  );
}

// ============================================================================
// 模板 API 客户端
// ============================================================================

export const templateApi = {
  // ==========================================================================
  // 公共端点（无需认证）
  // ==========================================================================

  /**
   * 获取已发布模板列表（公共）
   */
  async list(params?: TemplateListParams): Promise<TemplateListResponse> {
    try {
      const response = await axios.get<TemplateListResponse>(PUBLIC_API_BASE, {
        params,
        timeout: DEFAULT_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      handleError(error, '获取模板列表失败');
    }
  },

  /** 获取已发布课程文件夹 */
  async listCourseFolders(): Promise<CourseFolder[]> {
    try {
      const response = await axios.get<{ folders: CourseFolder[] }>('/api/course-folders', {
        timeout: DEFAULT_TIMEOUT,
      });
      return response.data.folders || [];
    } catch (error) {
      handleError(error, '获取课程文件夹失败');
    }
  },

  /**
   * 获取模板详情（含源文件，公共）
   */
  async getDetail(id: string): Promise<TemplateDetail> {
    try {
      const response = await adminAxios.get<TemplateDetail>(
        `${PUBLIC_API_BASE}/${id}`,
        { timeout: DEFAULT_TIMEOUT }
      );
      return response.data;
    } catch (error) {
      handleError(error, '获取模板详情失败');
    }
  },

  /** 验证口令并获取完整模板详情 */
  async unlockDetail(id: string, code: string): Promise<TemplateDetail> {
    try {
      const response = await axios.post<TemplateDetail>(
        `${PUBLIC_API_BASE}/${id}/unlock-detail`,
        { code },
        {
          timeout: DEFAULT_TIMEOUT,
          headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' },
        },
      );
      return response.data;
    } catch (error) {
      handleError(error, '解锁课程详情失败');
    }
  },


  async listCourseQA(templateId: string): Promise<CourseQAItem[]> {
    try {
      const response = await axios.get<{ items: CourseQAItem[] }>(
        `${PUBLIC_API_BASE}/${encodeURIComponent(templateId)}/qa`,
        { timeout: DEFAULT_TIMEOUT },
      );
      return response.data.items || [];
    } catch (error) {
      handleError(error, '获取课程问答失败');
    }
  },

  async submitCourseQA(templateId: string, data: CourseQAQuestionCreate): Promise<{ success: boolean; id: string; message: string }> {
    try {
      const response = await axios.post<{ success: boolean; id: string; message: string }>(
        `${PUBLIC_API_BASE}/${encodeURIComponent(templateId)}/qa`,
        data,
        { timeout: DEFAULT_TIMEOUT },
      );
      return response.data;
    } catch (error) {
      handleError(error, '提交课程问答失败');
    }
  },

  // ==========================================================================
  // 管理员端点（需要认证）
  // ==========================================================================

  /**
   * 管理员获取模板详情（含未发布）
   */
  async adminGetDetail(id: string): Promise<TemplateDetail> {
    try {
      const response = await axios.get<TemplateDetail>(
        `${ADMIN_API_BASE}/${id}`,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: getAdminAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      handleError(error, '获取模板详情失败');
    }
  },

  /**
   * 管理员获取所有模板列表（含未发布）
   */
  async adminList(params?: TemplateListParams): Promise<TemplateListResponse> {
    try {
      const response = await adminAxios.get<TemplateListResponse>(ADMIN_API_BASE, {
        params,
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      handleError(error, '获取模板列表失败');
    }
  },

  /**
   * 创建模板（JSON 方式）
   */
  async create(data: TemplateCreateRequest): Promise<TemplateListItem> {
    try {
      const response = await adminAxios.post<TemplateListItem>(ADMIN_API_BASE, data, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      handleError(error, '创建模板失败');
    }
  },

  /**
   * ZIP 上传创建模板
   */
  async uploadZip(formData: FormData): Promise<TemplateListItem> {
    try {
      const response = await adminAxios.post<TemplateListItem>(
        `${ADMIN_API_BASE}/upload-zip`,
        formData,
        {
          timeout: UPLOAD_TIMEOUT,
          headers: getMultipartHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      handleError(error, '上传模板 ZIP 失败');
    }
  },

  /**
   * 更新模板
   */
  async update(id: string, data: TemplateUpdateRequest): Promise<TemplateListItem> {
    try {
      const response = await adminAxios.put<TemplateListItem>(
        `${ADMIN_API_BASE}/${id}`,
        data,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: getAdminAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      handleError(error, '更新模板失败');
    }
  },

  /**
   * 删除模板
   */
  async delete(id: string): Promise<void> {
    try {
      await adminAxios.delete(`${ADMIN_API_BASE}/${id}`, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
    } catch (error) {
      handleError(error, '删除模板失败');
    }
  },

  /** 复制模板 */
  async copy(id: string): Promise<void> {
    try {
      await adminAxios.post(`${ADMIN_API_BASE}/${id}/copy`, null, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
    } catch (error) {
      handleError(error, '复制模板失败');
    }
  },

  /**
   * 切换模板发布状态
   */
  async togglePublish(id: string, published: boolean): Promise<void> {
    try {
      await adminAxios.patch(
        `${ADMIN_API_BASE}/${id}/publish?published=${published}`,
        null,
        {
          timeout: DEFAULT_TIMEOUT,
          headers: getAdminAuthHeaders(),
        }
      );
    } catch (error) {
      handleError(error, '切换发布状态失败');
    }
  },

  /** 解析 MD 文档 */
  async parseMd(file: File): Promise<{
    success: boolean;
    title: string;
    category: string;
    tags: string;
    boards: string;
    cover: string;
    video_bilibili: string;
    video_douyin: string;
    video_xiaohongshu: string;
    level: number | null;
    description: string;
    article: string;
  }> {
    const formData = new FormData();
    formData.append('md_file', file);
    const response = await adminAxios.post(`${ADMIN_API_BASE}/parse-md`, formData, {
      timeout: DEFAULT_TIMEOUT,
      headers: getMultipartHeaders(),
    });
    return response.data;
  },

  /** 获取 B 站视频封面 */
  async getBilibiliCover(bvid: string): Promise<{ cover_url: string; title: string }> {
    const response = await adminAxios.get(`${ADMIN_API_BASE}/bilibili-cover`, {
      params: { bvid },
      timeout: DEFAULT_TIMEOUT,
      headers: getAdminAuthHeaders(),
    });
    return response.data;
  },

  /** 上传模板缩略图 */
  async uploadThumbnail(templateId: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('thumbnail', file);
    await adminAxios.post(`${ADMIN_API_BASE}/${templateId}/thumbnail`, formData, {
      timeout: UPLOAD_TIMEOUT,
      headers: getMultipartHeaders(),
    });
  },

  // ==========================================================================
  // 附件包（管理员）
  // ==========================================================================

  /** 上传附件包 */
  async uploadPackage(templateId: string, file: File, tag: string, filename?: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tag', tag);
    if (filename) {
      formData.append('filename', filename);
    }
    await adminAxios.post(`${ADMIN_API_BASE}/${templateId}/packages`, formData, {
      timeout: UPLOAD_TIMEOUT,
      headers: getMultipartHeaders(),
    });
  },

  /** 删除附件包 */
  async deletePackage(templateId: string, tag: string): Promise<void> {
    await adminAxios.delete(`${ADMIN_API_BASE}/${templateId}/packages/${tag}`, {
      timeout: DEFAULT_TIMEOUT,
      headers: getAdminAuthHeaders(),
    });
  },

  /** 重命名附件包资源类型 */
  async renamePackage(templateId: string, oldTag: string, newTag: string): Promise<void> {
    const formData = new FormData();
    formData.append('new_tag', newTag);
    await adminAxios.put(`${ADMIN_API_BASE}/${templateId}/packages/${oldTag}/rename`, formData, {
      timeout: DEFAULT_TIMEOUT,
      headers: getMultipartHeaders(),
    });
  },

  /** 重命名附件包展示文件名 */
  async renamePackageFile(templateId: string, tag: string, filename: string): Promise<void> {
    const formData = new FormData();
    formData.append('filename', filename);
    await adminAxios.put(`${ADMIN_API_BASE}/${templateId}/packages/${tag}/filename`, formData, {
      timeout: DEFAULT_TIMEOUT,
      headers: getMultipartHeaders(),
    });
  },

  /** 列出附件包 */
  async listPackages(templateId: string): Promise<PackageInfo[]> {
    const response = await adminAxios.get<{ success: boolean; packages: PackageInfo[] }>(
      `${ADMIN_API_BASE}/${templateId}/packages`,
      { timeout: DEFAULT_TIMEOUT, headers: getAdminAuthHeaders() },
    );
    return response.data.packages;
  },

  // ==========================================================================
  // 公开下载和解锁
  // ==========================================================================

  /** 获取附件包下载 URL */
  getPackageDownloadUrl(templateId: string, tag: string, unlockCode?: string): string {
    const query = unlockCode ? `?code=${encodeURIComponent(unlockCode)}` : '';
    return `${PUBLIC_API_BASE}/${templateId}/packages/${tag}${query}`;
  },

  /** 获取源代码 ZIP 下载 URL */
  getSourceDownloadUrl(templateId: string, unlockCode?: string): string {
    const query = unlockCode ? `?code=${encodeURIComponent(unlockCode)}` : '';
    return `${PUBLIC_API_BASE}/${templateId}/download-source${query}`;
  },

  /** 验证解锁口令 */
  async verifyUnlock(templateId: string, code: string): Promise<boolean> {
    try {
      const response = await axios.post<{ success: boolean }>(
        `${PUBLIC_API_BASE}/${templateId}/verify-unlock`,
        { code },
        { timeout: DEFAULT_TIMEOUT },
      );
      return response.data.success;
    } catch {
      return false;
    }
  },

  // ==========================================================================
  // 统计事件记录（fire-and-forget）
  // ==========================================================================

  /** 记录烧录事件（从课程触发） */
  async logFlash(templateId: string, success: boolean): Promise<void> {
    try {
      await axios.post(
        `${PUBLIC_API_BASE}/${templateId}/flash-log`,
        { success },
        { timeout: DEFAULT_TIMEOUT },
      );
    } catch (error) {
      console.warn('Failed to log template flash event:', error);
    }
  },

  /** 记录打开项目事件 */
  async logOpen(templateId: string): Promise<void> {
    try {
      await axios.post(
        `${PUBLIC_API_BASE}/${templateId}/log-open`,
        {},
        { timeout: DEFAULT_TIMEOUT },
      );
    } catch (error) {
      console.warn('Failed to log template open event:', error);
    }
  },

  // ==========================================================================
  // 回收站（管理员）
  // ==========================================================================

  /** 恢复已删除模板 */
  async restoreTrash(id: string): Promise<void> {
    try {
      await axios.post(`${ADMIN_API_BASE}/${id}/restore`, null, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
    } catch (error) {
      handleError(error, '恢复模板失败');
    }
  },

  /** 永久删除模板 */
  async permanentDelete(id: string): Promise<void> {
    try {
      await axios.delete(`${ADMIN_API_BASE}/${id}/permanent`, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
    } catch (error) {
      handleError(error, '永久删除模板失败');
    }
  },

  /** 获取回收站模板列表 */
  async getTrashed(): Promise<{ success: boolean; trashed: TemplateListItem[]; count: number }> {
    try {
      const response = await axios.get(`${ADMIN_API_BASE}/trash`, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      handleError(error, '获取回收站列表失败');
    }
  },

  /** 清空回收站 */
  async emptyTrash(): Promise<{ success: boolean; deleted_count: number }> {
    try {
      const response = await axios.post(`${ADMIN_API_BASE}/trash/empty`, null, {
        timeout: DEFAULT_TIMEOUT,
        headers: getAdminAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      handleError(error, '清空回收站失败');
    }
  },
};
