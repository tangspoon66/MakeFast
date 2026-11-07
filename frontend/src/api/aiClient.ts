import { useLearnerAuthStore } from '../store/learnerAuthStore';

/**
 * AI 代码助手 API 客户端
 * 用于对接大语言模型服务
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AICompileError {
  type: string;
  line: number;
  message: string;
  hint?: string;
}

export interface AIGenerateRequest {
  messages: AIMessage[];
  board?: string;  // 当前选择的开发板
  context?: string;  // 当前代码上下文
  model?: string;
  project_files?: Array<{ name: string; content: string }>;  // 多文件项目
  current_file?: string;  // 当前编辑的文件名
  compile_errors?: AICompileError[];  // 编译错误列表
  project_context?: string;  // 项目结构摘要
  signal?: AbortSignal;  // 允许前端终止正在生成的请求
}

export interface AIGenerateResponse {
  success: boolean;
  code?: string;  // 生成的代码
  message: string;  // AI的回复消息
  error?: string;
}

/**
 * AI 客户端配置
 */
interface AIClientConfig {
  apiUrl: string;
  apiKey?: string;
  model?: string;
}

class AIClient {
  private config: AIClientConfig;

  constructor(config?: Partial<AIClientConfig>) {
    this.config = {
      apiUrl: config?.apiUrl || import.meta.env.VITE_AI_API_URL || '/api/ai',
      apiKey: config?.apiKey || import.meta.env.VITE_AI_API_KEY,
      model: config?.model || import.meta.env.VITE_AI_MODEL || 'gpt-4'
    };
  }

  /**
   * 生成代码
   */
  async generateCode(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    try {
      const response = await fetch(`${this.config.apiUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          messages: request.messages,
          board: request.board,
          context: request.context,
          model: this.config.model,
          project_files: request.project_files,
          current_file: request.current_file,
          compile_errors: request.compile_errors,
          project_context: request.project_context,
        }),
        signal: request.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  }

  /**
   * 流式生成代码（支持实时输出）
   */
  async *generateCodeStream(
    request: AIGenerateRequest
  ): AsyncGenerator<string, void, unknown> {
    try {
      const response = await fetch(`${this.config.apiUrl}/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          messages: request.messages,
          board: request.board,
          context: request.context,
          model: this.config.model,
          project_files: request.project_files,
          current_file: request.current_file,
          compile_errors: request.compile_errors,
          project_context: request.project_context,
        }),
        signal: request.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                yield parsed.content;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('AI streaming error:', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AIClientConfig>) {
    this.config = { ...this.config, ...config };
  }
}

// 导出单例
export const aiClient = new AIClient();

// 导出类以支持自定义实例
export { AIClient };
