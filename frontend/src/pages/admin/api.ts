/** 管理员后台 API 客户端（/api/admin/console/*，httpOnly cookie 认证）。 */
export type Role = 'admin' | 'editor' | 'viewer';

export class ConsoleApiError extends Error {
  status: number;
  errors: string[];
  constructor(message: string, status: number, errors: string[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const BASE = '/api/admin/console';

function messageFrom(detail: unknown, fallback: string): { message: string; errors: string[] } {
  if (typeof detail === 'string') return { message: detail, errors: [] };
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: { msg?: string; loc?: unknown[] }) => `${(d.loc || []).slice(1).join('.')}: ${d.msg ?? ''}`);
    return { message: '输入有误：' + msgs.join('；'), errors: msgs };
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { message?: string; errors?: string[] };
    return { message: d.message || fallback, errors: d.errors || [] };
  }
  return { message: fallback, errors: [] };
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
  } catch {
    throw new ConsoleApiError('无法连接后端服务', 0);
  }
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const { message, errors } = messageFrom((body as { detail?: unknown })?.detail ?? body, `请求失败（${res.status}）`);
    throw new ConsoleApiError(message, res.status, errors);
  }
  return body as T;
}

export const get = <T,>(p: string) => api<T>(p);
export const post = <T,>(p: string, data?: unknown) => api<T>(p, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
export const put = <T,>(p: string, data: unknown) => api<T>(p, { method: 'PUT', body: JSON.stringify(data) });
export const patch = <T,>(p: string, data: unknown) => api<T>(p, { method: 'PATCH', body: JSON.stringify(data) });
export const del = <T,>(p: string) => api<T>(p, { method: 'DELETE' });

export interface Me { username: string; role: Role; display_name?: string; source: string }

export interface Dashboard {
  learner_count: number; active_sessions: number; started_learners: number;
  completion_rate: number | null; quiz_pass_rate: number | null;
  agent_messages: number; agent_conversations: number; agent_refusals: number;
  refusal_categories: Record<string, number>;
  common_errors: { label: string; count: number; rate: number | null }[];
  event_funnel: Record<string, number>;
  quiz_timings?: { question_id: string; attempts: number; avg_sec: number; correct_rate: number }[];
}

export interface CourseStep { id: string; title: string; why: string }
export interface QuizItem { id: string; prompt: string; choices: string[]; answer_index: number; explain: string }
export interface CoursePack {
  slug: string; title: string; level: '入门' | '进阶' | '熟练' | '高级'; summary: string;
  skills: string[]; prerequisites: string[]; cover: string; duration_min: number; board_id: string;
  steps: CourseStep[]; quiz: QuizItem[];
  resources?: { id: string; name: string; kind: 'pdf' | 'stl' | 'link'; url: string; note?: string }[];
  article?: Record<string, unknown> | null;
  status?: 'draft' | 'published'; revision?: number; updated_at?: string; updated_by?: string; published_at?: string | null;
}

export interface HardwareItem {
  kind: 'board' | 'component'; id: string; name: string; data: Record<string, unknown>;
  pinmap: Record<string, unknown> | null; pin_count: number; updated_at: string; updated_by: string; errors: string[];
}

export interface LearnerRow {
  id: string; username: string; display_name: string; created_at: string; points: number; event_count: number;
  completed: boolean; quiz_passed: boolean; stage: string; last_active: string;
}
export interface LearnerDetail {
  id: string; username: string; display_name: string; created_at: string; points: number; completed: boolean;
  stage: string; skills: Record<string, number>;
  events: { event_type: string; event_key: string; points: number; created_at: string }[];
  quiz_history: { event_type: string; event_key: string; created_at: string }[];
  quiz_timings?: { created_at: string; passed?: boolean | null; items: { question_id: string; correct: boolean; ms: number }[] }[];
  compile_errors?: { created_at: string; error_text: string; line?: number | null }[];
  lesson_profile?: { profile: Record<string, unknown> | null; age_tier?: string | null; difficulties: Record<string, number>; event_count: number; quiz_attempts: number; updated_at: string } | null;
  lesson_sessions?: { session_id: string; course_id: string; step_index: number; mainline_completed: boolean; quiz_passed: boolean | null; updated_at: string }[];
  projects: Record<string, string>[];
}

export interface Faq { id: number; question: string; answer: string; tags: string[]; course_slug: string; enabled: boolean; updated_at: string }
export interface AgentEvent { event_id: number; created_at: string; user_ref: string; course_slug: string; kind: string; category: string; question: string; answer: string }
export interface Conversation { id: string; learner: string; course_slug: string; title: string; updated_at: string; archived: boolean; messages: { role: string; content: string; created_at: string }[] }
export interface Provider { id: string; label: string; key_configured: boolean; key_env: string; model: string | null }
export interface AdminUser { username: string; role: Role; display_name: string; disabled: boolean; created_at: string; last_login_at: string | null }
export interface Settings {
  site_name: string; registration_open: boolean; agent_enabled: boolean; agent_offline_only: boolean;
  agent_daily_message_limit: number; agent_max_reply_chars: number; log_retention_days: number;
  default_course: string; maintenance_banner: string;
}

export const ROLE_LABEL: Record<Role, string> = { admin: '管理员', editor: '编辑', viewer: '只读' };
export const canEdit = (r?: Role) => r === 'admin' || r === 'editor';
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 1000) / 10}%`);
export const fmtTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN', { hour12: false });
};
