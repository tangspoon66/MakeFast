import axios from 'axios';
import { useLearnerAuthStore } from '../store/learnerAuthStore';
import type { ProjectFile } from '../store/editorStore';

export interface LearnerProjectSummary {
  project_id: string;
  course_slug: string | null;
  course_version?: number | null;
  title: string;
  learning_mode: 'guided' | 'assisted' | 'autonomous';
  editor_source: 'blocks' | 'code';
  current_step_id: string | null;
  completed_step_ids: string[];
  revision: number;
  updated_at: string;
}

export interface LearnerDashboardData {
  continue_project: LearnerProjectSummary | null;
  recent_projects: LearnerProjectSummary[];
  project_count: number;
  points_total: number;
  badges: Array<{ key: string; name: string; criteria?: string; unlocked?: boolean }>;
  recent_events?: Array<{ event_type: string; label?: string; points: number; project_id: string | null; created_at: string }>;
  badge_catalog?: Array<{ key: string; name: string; criteria: string }>;
  event_catalog?: Array<{ event_type: string; label: string; first_points: number }>;
}

export interface AgentConversation {
  conversation_id: string;
  project_id: string;
  course_slug: string;
  course_version: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>;
}

export interface AgentProposal {
  proposal_id: string;
  project_id: string;
  conversation_id: string | null;
  base_revision: number;
  source_mode: 'code' | 'blocks';
  proposed_code: string | null;
  proposed_blocks_xml: string | null;
  summary: string;
  dependencies: string[];
  hardware_assumptions: string[];
  roundtrip_status: 'roundtrip_safe' | 'code_only' | 'unsupported';
  status: 'preview' | 'applied' | 'undone';
  applied_revision: number | null;
  created_at: string;
}

export interface LearnerProject extends LearnerProjectSummary {
  project_state: { code?: string; projectFiles?: ProjectFile[]; [key: string]: unknown };
  board_id: string | null;
}

export type LearnerProjectSave = Pick<LearnerProject, 'title' | 'learning_mode' | 'editor_source' | 'board_id' | 'project_state' | 'current_step_id' | 'completed_step_ids'>;

export class LearningProjectError extends Error {
  statusCode?: number;
  code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'LearningProjectError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const client = axios.create({ baseURL: '/api', withCredentials: true, timeout: 10000 });

export const learningClient = {
  async dashboard(): Promise<LearnerDashboardData> {
    const response = await client.get<LearnerDashboardData>('/users/me/dashboard');
    return response.data;
  },

  async createProject(title: string, courseSlug: string | null = null): Promise<LearnerProject> {
    const csrfToken = useLearnerAuthStore.getState().csrfToken;
    const response = await client.post<LearnerProject>('/learning/projects', { title, course_slug: courseSlug }, {
      headers: { 'X-CSRF-Token': csrfToken || '' },
    });
    return response.data;
  },

  async getProject(projectId: string): Promise<LearnerProject> {
    const response = await client.get<LearnerProject>(`/learning/projects/${encodeURIComponent(projectId)}`);
    return response.data;
  },

  async archiveProject(projectId: string): Promise<void> {
    await client.post(`/learning/projects/${encodeURIComponent(projectId)}/archive`, {}, { headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' } });
  },

  async saveProject(projectId: string, revision: number, values: LearnerProjectSave): Promise<LearnerProject> {
    try {
      const response = await client.put<LearnerProject>(`/learning/projects/${encodeURIComponent(projectId)}`, {
        revision,
        ...values,
      }, { headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' } });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail as { code?: string; message?: string } | undefined;
        throw new LearningProjectError(detail?.message || '项目保存失败，请重试。', error.response?.status, detail?.code);
      }
      throw error;
    }
  },

  async recordProgress(eventType: string, eventKey: string, projectId?: string | null, evidence?: string): Promise<{ recorded: boolean; points_awarded: number }> {
    const response = await client.post('/learning/progress/events', {
      event_type: eventType, event_key: eventKey, project_id: projectId || null, evidence: evidence || null,
    }, { headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' } });
    return response.data;
  },

  async listAgentConversations(projectId: string): Promise<AgentConversation[]> {
    const response = await client.get<{ items: AgentConversation[] }>(`/learning/projects/${encodeURIComponent(projectId)}/agent/conversations`);
    return response.data.items;
  },

  async createAgentConversation(projectId: string, title = '新对话'): Promise<AgentConversation> {
    const response = await client.post<AgentConversation>(`/learning/projects/${encodeURIComponent(projectId)}/agent/conversations`, { title }, {
      headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' },
    });
    return response.data;
  },

  async getAgentConversation(projectId: string, conversationId: string): Promise<AgentConversation> {
    const response = await client.get<AgentConversation>(`/learning/projects/${encodeURIComponent(projectId)}/agent/conversations/${encodeURIComponent(conversationId)}`);
    return response.data;
  },

  async renameAgentConversation(projectId: string, conversationId: string, title: string): Promise<AgentConversation> {
    const response = await client.patch<AgentConversation>(`/learning/projects/${encodeURIComponent(projectId)}/agent/conversations/${encodeURIComponent(conversationId)}`, { title }, {
      headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' },
    });
    return response.data;
  },

  async archiveAgentConversation(projectId: string, conversationId: string): Promise<void> {
    await client.delete(`/learning/projects/${encodeURIComponent(projectId)}/agent/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' },
    });
  },

  async askAgent(projectId: string, conversationId: string, question: string, currentStepId: string | null): Promise<{ answer: string; conversation: AgentConversation }> {
    const response = await client.post<{ answer: string; conversation: AgentConversation }>(
      `/learning/projects/${encodeURIComponent(projectId)}/agent/conversations/${encodeURIComponent(conversationId)}/ask`,
      { question, current_step_id: currentStepId },
      { headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' } },
    );
    return response.data;
  },

  async createAgentProposal(projectId: string, question: string, conversationId: string | null, currentStepId: string | null): Promise<{ proposal: AgentProposal; current_code: string }> {
    const response = await client.post<{ proposal: AgentProposal; current_code: string }>(
      `/learning/projects/${encodeURIComponent(projectId)}/agent/proposals`,
      { question, conversation_id: conversationId, current_step_id: currentStepId },
      { headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' } },
    );
    return response.data;
  },

  async applyAgentProposal(projectId: string, proposalId: string): Promise<{ proposal: AgentProposal; project: LearnerProject }> {
    const response = await client.post<{ proposal: AgentProposal; project: LearnerProject }>(
      `/learning/projects/${encodeURIComponent(projectId)}/agent/proposals/${encodeURIComponent(proposalId)}/apply`,
      {}, { headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' } },
    );
    return response.data;
  },

  async undoAgentProposal(projectId: string, proposalId: string): Promise<{ proposal: AgentProposal; project: LearnerProject }> {
    const response = await client.post<{ proposal: AgentProposal; project: LearnerProject }>(
      `/learning/projects/${encodeURIComponent(projectId)}/agent/proposals/${encodeURIComponent(proposalId)}/undo`,
      {}, { headers: { 'X-CSRF-Token': useLearnerAuthStore.getState().csrfToken || '' } },
    );
    return response.data;
  },
};
