/**
 * API 类型定义
 */

export interface ProjectFile {
  name: string;
  content: string;
}

export interface CompileRequest {
  code?: string;
  files?: ProjectFile[];
  board_id: string;
}

export interface CompileError {
  type: 'error' | 'warning';
  line: number;
  message: string;
  hint?: string;
}

export interface FlashFile {
  name: string;        // 文件名，如 'bootloader.bin'
  address: number;     // 烧录地址，如 0x1000
  size: number;        // 文件大小（字节）
  role: string;        // 文件角色，如 'bootloader', 'partitions', 'app'
  format?: 'bin' | 'hex';
}

export interface CompileResult {
  success: boolean;
  firmware_id?: string;
  firmware_size?: number;
  firmware_files?: FlashFile[];  // 烧录文件清单
  errors?: CompileError[];
  warnings?: CompileError[];
  duration: number;
}

export interface BoardInfo {
  id: string;
  name: string;
  fqbn: string;
  description: string;
  platform: string;   // "esp32" | "esp8266" | "arduino-avr"
  flashable: boolean;  // 是否支持 Web Serial 烧录
  chip_family?: string; // 芯片系列（用于分组）
  output_format?: 'bin' | 'hex';
  upload_protocol?: 'esptool' | 'stk500v1' | 'stk500v2' | 'avr109' | 'none';
  upload_speed?: number;
  reset_method?: 'dtr-rts' | 'touch-1200bps' | 'none';
}

// 管理员开发板配置（完整字段）
export interface BoardConfigFull {
  board_id: string;
  name: string;
  fqbn: string;
  description: string;
  platform: string;
  flashable: boolean;
  bootloader_addr: number | null;
  output_format: string;
  chip_family: string;
  upload_protocol: string;
  upload_speed: number;
  reset_method: string;
  builtin: boolean;
  overridden: boolean;
  created_at: string | null;
}

// 搜索结果中的开发板摘要
export interface BoardSearchResult {
  fqbn: string;
  name: string;
  platform: string;
  board_id: string;
  chip_family?: string;
  flashable?: boolean;
  bootloader_addr?: number | null;
  output_format?: string;
  upload_protocol?: string;
  upload_speed?: number;
  reset_method?: string;
}

export interface BoardListResponse {
  boards: BoardInfo[];
}

export interface CourseFolderItem {
  template_id: string;
  sort_order: number;
}

export interface CourseFolder {
  folder_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  cover_url: string;
  pinned: boolean;
  published: boolean;
  sort_order: number;
  items: CourseFolderItem[];
  created_at: string;
  updated_at?: string | null;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  arduino_cli: {
    ok: boolean;
    version: string | null;
  };
  libraries: {
    preinstalled_count: number;
  };
  disk: {
    free_gb: number;
  };
}

export interface FeedbackRequest {
  category: string;
  message: string;
  contact?: string;
  page_url?: string;
  logs?: string[];
}

// ============================================================================
// 固件管理系统类型定义
// ============================================================================

/**
 * 固件文件信息
 */
export interface FirmwareFileInfo {
  name: string;        // 文件名
  address: number;     // 烧录地址
  size: number;        // 文件大小（字节）
  role: string;        // 文件角色：bootloader, partitions, boot_app0, app, firmware
  format?: 'bin' | 'hex';
}

/**
 * 固件元数据
 */
export interface FirmwareMetadata {
  firmware_id: string;
  project_name: string;
  description: string;
  version: string;
  supported_board_ids: string[];
  tags: string[];
  published: boolean;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;

  // 文件信息
  files: FirmwareFileInfo[];
  total_size: number;
  has_thumbnail: boolean;
  
  // 统计信息
  download_count: number;
  flash_count: number;
  flash_success_count: number;
  flash_failure_count: number;
}

/**
 * 固件筛选条件
 */
export interface FirmwareFilters {
  board_id?: string;
  tags?: string[];
  search?: string;
  page?: number;
  page_size?: number;
}

export interface FirmwareListResponse {
  items: FirmwareMetadata[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * 固件上传数据
 */
export interface FirmwareUploadData {
  zip_file: File;
  project_name: string;
  description: string;
  version: string;
  supported_board_ids: string[];
  tags: string[];
  published: boolean;
}

/**
 * 管理员凭证
 */
export interface AdminCredentials {
  username: string;
  password: string;
}

/**
 * 管理员 Token
 */
export interface AdminToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * AI 配置
 */
export interface AIConfig {
  api_key: string;
  api_base: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface ASRConfig {
  enabled: boolean;
  provider: string;
  secret_id: string;
  secret_key: string;
  app_id: string;
  region: string;
  engine_model_type: string;
}

export interface OSSConfig {
  enabled: boolean;
  bucket: string;
  endpoint: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  public_base_url: string;
  prefix: string;
}

export interface EmailConfig {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_ssl: boolean;
  use_tls: boolean;
}

export interface ServiceConfig {
  ai: AIConfig;
  asr: ASRConfig;
  oss: OSSConfig;
  email: EmailConfig;
}

export interface ServiceTestRequest {
  service: 'ai' | 'asr' | 'oss' | 'email';
  config: Record<string, any>;
}

export interface ServiceTestResponse {
  success: boolean;
  message: string;
}

export interface CourseQAItem {
  id: string;
  template_id: string;
  nickname: string;
  email?: string;
  content: string;
  admin_reply: string;
  status: 'pending' | 'approved' | 'replied' | 'hidden';
  is_public: boolean;
  ip_hash?: string;
  user_agent?: string;
  created_at: string;
  approved_at?: string | null;
  replied_at?: string | null;
  updated_at?: string | null;
}

export interface CourseQAQuestionCreate {
  nickname: string;
  email?: string;
  content: string;
}

/**
 * 管理员统计信息
 */
export interface AdminStatistics {
  // 固件统计
  total_firmware_count: number;
  published_firmware_count: number;
  total_storage_mb: number;
  downloads_last_30_days: number;
  flashes_last_30_days: number;
  top_firmware: Array<{
    firmware_id: string;
    project_name: string;
    download_count: number;
    flash_count: number;
  }>;
  storage_warning: boolean;
  compile_stats: {
    total: number;
    success: number;
    failure: number;
    failure_rate: number;
  };
  flash_stats: {
    total: number;
    success: number;
    failure: number;
    failure_rate: number;
  };
  storage: {
    disk_path: string;
    disk_total_mb: number;
    disk_used_mb: number;
    disk_free_mb: number;
    disk_usage_percent: number;
    app_used_mb: number;
    breakdown_mb: Record<string, number>;
    warning: boolean;
  };
  recent_feedback: Array<{
    id: string;
    category: string;
    message: string;
    contact: string;
    page_url: string;
    logs: string[];
    status: string;
    created_at: string;
  }>;

  // 模板统计
  total_template_count: number;
  published_template_count: number;
  total_template_views: number;
  total_template_open_projects: number;
  total_template_downloads: number;
  total_template_package_downloads: number;
  total_template_flashes: number;
  total_template_unlocks: number;
  popular_templates: Array<{
    template_id: string;
    name: string;
    category: string;
    view_count: number;
    download_count: number;
    flash_count: number;
  }>;
}

export interface SystemStatus {
  environment: string;
  domain: string;
  allowed_origins: string[];
  cookie_secure: boolean;
  redis: {
    configured: boolean;
    connected: boolean;
  };
  compile: {
    concurrency: number;
    queue_timeout_seconds: number;
  };
  sqlite: {
    path: string;
    exists: boolean;
    size_mb: number;
    backup_count: number;
    latest_backup: null | {
      name: string;
      size: number;
      created_at: string;
    };
  };
  object_storage: {
    enabled: boolean;
    bucket: string;
    endpoint: string;
    region: string;
    public_base_url: string;
    prefix: string;
    access_key_configured: boolean;
    secret_key_configured: boolean;
  };
  ai_config: {
    runtime_write_allowed: boolean;
    api_key_configured: boolean;
    model: string;
  };
}

export interface BackupInfo {
  name: string;
  size: number;
  created_at: string;
}
