import axios, { AxiosError } from 'axios';

export interface LearnerProfile {
  id: string;
  username: string;
  display_name: string;
  experience_markers: string[];
  created_at: string;
}

export interface LearnerSessionResponse {
  learner: LearnerProfile;
  csrf_token: string;
  expires_in: number;
}

export class LearnerAuthError extends Error {
  statusCode?: number;
  code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'LearnerAuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const client = axios.create({
  baseURL: '/api/auth',
  withCredentials: true,
  timeout: 10000,
});

function handleError(error: unknown, fallback: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: { code?: string; message?: string } }>;
    if (!axiosError.response) {
      throw new LearnerAuthError('暂时无法连接服务器，请稍后再试。');
    }
    const detail = axiosError.response.data?.detail;
    throw new LearnerAuthError(
      detail?.message || fallback,
      axiosError.response.status,
      detail?.code,
    );
  }
  throw new LearnerAuthError(error instanceof Error ? error.message : fallback);
}

export const learnerAuthClient = {
  async register(payload: {
    username: string;
    password: string;
    display_name?: string;
    experience_markers?: string[];
  }): Promise<LearnerSessionResponse> {
    try {
      const response = await client.post<LearnerSessionResponse>('/register', payload);
      return response.data;
    } catch (error) {
      return handleError(error, '注册失败，请检查填写内容。');
    }
  },

  async login(username: string, password: string): Promise<LearnerSessionResponse> {
    try {
      const response = await client.post<LearnerSessionResponse>('/session', { username, password });
      return response.data;
    } catch (error) {
      return handleError(error, '登录失败，请检查用户名和密码。');
    }
  },

  async current(): Promise<LearnerSessionResponse> {
    try {
      // session-status 对游客返回 200 + authenticated:false，避免每页控制台都出现 401
      const response = await client.get<LearnerSessionResponse & { authenticated?: boolean }>('/session-status');
      if (response.data.authenticated === false) throw new LearnerAuthError('登录状态已失效，请重新登录。', 401, 'session_expired');
      return response.data;
    } catch (error) {
      if (error instanceof LearnerAuthError) throw error;
      return handleError(error, '登录状态已失效，请重新登录。');
    }
  },

  async logout(csrfToken: string): Promise<void> {
    try {
      await client.delete('/session', { headers: { 'X-CSRF-Token': csrfToken } });
    } catch (error) {
      return handleError(error, '退出登录失败，请稍后再试。');
    }
  },
};
