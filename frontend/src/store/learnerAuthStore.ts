import { create } from 'zustand';
import {
  learnerAuthClient,
  LearnerAuthError,
  type LearnerProfile,
} from '../api/learnerAuthClient';
import { useEditorStore } from './editorStore';

interface LearnerAuthState {
  learner: LearnerProfile | null;
  csrfToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  register: (payload: {
    username: string;
    password: string;
    display_name?: string;
    experience_markers?: string[];
  }) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useLearnerAuthStore = create<LearnerAuthState>((set, get) => ({
  learner: null,
  csrfToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await learnerAuthClient.current();
      set({
        learner: session.learner,
        csrfToken: session.csrf_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        learner: null,
        csrfToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof LearnerAuthError && error.statusCode !== 401
          ? error.message
          : null,
      });
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const session = await learnerAuthClient.register(payload);
      set({ learner: session.learner, csrfToken: session.csrf_token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      const message = error instanceof LearnerAuthError ? error.message : '注册失败，请稍后再试。';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const session = await learnerAuthClient.login(username, password);
      set({ learner: session.learner, csrfToken: session.csrf_token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      const message = error instanceof LearnerAuthError ? error.message : '登录失败，请稍后再试。';
      set({ learner: null, csrfToken: null, isAuthenticated: false, isLoading: false, error: message });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      const csrfToken = get().csrfToken;
      if (csrfToken) await learnerAuthClient.logout(csrfToken);
    } finally {
      useEditorStore.getState().reset();
      useEditorStore.persist.clearStorage();
      set({ learner: null, csrfToken: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
