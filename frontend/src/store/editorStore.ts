/**
 * 编辑器状态管理
 *
 * 使用 zustand + persist 中间件管理全局状态
 * code、selectedBoard 和 projectFiles 自动持久化到 localStorage
 * 保存的数据在 24 小时后过期
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CompileResult } from '../api/types';

// 项目文件类型
export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  type?: 'ino' | 'cpp' | 'h' | 'c' | 'hpp' | 'other';
}


export interface EditorState {
  // 代码内容
  code: string;
  setCode: (code: string) => void;

  // 项目文件（多文件项目）
  projectFiles: ProjectFile[];
  setProjectFiles: (files: ProjectFile[]) => void;

  blocksXml: string | null;
  setBlocksXml: (xml: string | null) => void;

  // 选中的开发板
  selectedBoard: string;
  setSelectedBoard: (boardId: string) => void;

  // 记住开发板选择
  rememberBoard: boolean;
  setRememberBoard: (remember: boolean) => void;

  // 已检测的串口（用于上传时复用）
  detectedPort: SerialPort | null;
  setDetectedPort: (port: SerialPort | null) => void;

  // 检测到的芯片类型（用于验证串口是否正确）
  detectedChipType: string | null;
  setDetectedChipType: (chipType: string | null) => void;

  // 编译状态
  isCompiling: boolean;
  setIsCompiling: (isCompiling: boolean) => void;

  // 编译结果
  compileResult: CompileResult | null;
  setCompileResult: (result: CompileResult | null) => void;

  // 上传状态
  isUploading: boolean;
  setIsUploading: (isUploading: boolean) => void;

  // 上传进度 (0-100)
  uploadProgress: number;
  setUploadProgress: (progress: number) => void;

  // 错误消息
  errorMessage: string;
  setErrorMessage: (message: string) => void;

  // 当前视图模式（供 AI 助手和 EditorTabs 共享）
  viewMode: 'code' | 'blocks' | 'library' | 'firmware';
  setViewMode: (mode: 'code' | 'blocks' | 'library' | 'firmware') => void;

  // AI 部署到积木的刷新触发器（自增计数器）
  blocksRefreshTrigger: number;
  triggerBlocksRefresh: () => void;

  // 重置所有状态
  reset: () => void;
}

const DEFAULT_CODE = `//使用 AI 助手写代码，一键部署!
`;
const PERSIST_VERSION = 4;
const PERSIST_TTL_MS = 24 * 60 * 60 * 1000;

// 从 localStorage 读取"记住选择"设置（独立于 persist）
const getRememberBoard = (): boolean => {
  try {
    return localStorage.getItem('rememberBoard') === 'true';
  } catch {
    return false;
  }
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // 初始状态
      code: DEFAULT_CODE,
      projectFiles: [],
      blocksXml: null,
      selectedBoard: '',
      rememberBoard: getRememberBoard(),
      detectedPort: null,
      detectedChipType: null,
      isCompiling: false,
      compileResult: null,
      isUploading: false,
      uploadProgress: 0,
      errorMessage: '',

      // 状态更新方法
      setCode: (code) => set({ code }),
      setProjectFiles: (files) => set({ projectFiles: files }),
      setBlocksXml: (blocksXml) => set({ blocksXml }),
      setSelectedBoard: (boardId) => {
        set({ selectedBoard: boardId });
        try {
          const remember = get().rememberBoard;
          if (remember) {
            localStorage.setItem('selectedBoard', boardId);
          }
        } catch (e) {
          console.error('Failed to save board selection:', e);
        }
      },
      setRememberBoard: (remember) => {
        set({ rememberBoard: remember });
        try {
          localStorage.setItem('rememberBoard', String(remember));
          if (remember) {
            const board = get().selectedBoard;
            if (board) {
              localStorage.setItem('selectedBoard', board);
            }
          } else {
            localStorage.removeItem('selectedBoard');
          }
        } catch (e) {
          console.error('Failed to save remember setting:', e);
        }
      },
      setDetectedPort: (port) => set({ detectedPort: port }),
      setDetectedChipType: (chipType) => set({ detectedChipType: chipType }),
      setIsCompiling: (isCompiling) => set({ isCompiling }),
      setCompileResult: (result) => set({ compileResult: result }),
      setIsUploading: (isUploading) => set({ isUploading }),
      setUploadProgress: (progress) => set({ uploadProgress: progress }),
      setErrorMessage: (message) => set({ errorMessage: message }),

      // 视图模式（默认代码视图）
      viewMode: 'code' as const,
      setViewMode: (mode) => set({ viewMode: mode }),

      // AI 部署到积木刷新触发器
      blocksRefreshTrigger: 0,
      triggerBlocksRefresh: () => set((s) => ({ blocksRefreshTrigger: s.blocksRefreshTrigger + 1 })),

      // 重置状态
      reset: () => set({
        code: DEFAULT_CODE,
        projectFiles: [],
        blocksXml: null,
        selectedBoard: get().selectedBoard,
        rememberBoard: getRememberBoard(),
        detectedPort: null,
        detectedChipType: null,
        isCompiling: false,
        compileResult: null,
        isUploading: false,
        uploadProgress: 0,
        errorMessage: ''
      })
    }),
    {
      name: 'editor-store-v2',
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        code: state.code,
        selectedBoard: state.selectedBoard,
        projectFiles: state.projectFiles,
        blocksXml: state.blocksXml,
        savedAt: Date.now(),
      }),
      migrate: (persistedState: any) => {
        const savedAt = Number(persistedState?.savedAt || 0);
        if (savedAt && Date.now() - savedAt > PERSIST_TTL_MS) {
          return {
            code: DEFAULT_CODE,
            selectedBoard: getRememberBoard() ? (localStorage.getItem('selectedBoard') || '') : '',
            projectFiles: [],
            blocksXml: null,
          };
        }

        if (Array.isArray(persistedState?.projectFiles)) {
          persistedState.projectFiles = persistedState.projectFiles.map((file: ProjectFile, index: number) => ({
            ...file,
            id: file.id || `file-restored-${index}-${file.name}`,
          }));
        }

        return persistedState;
      },
      merge: (persistedState: any, currentState) => {
        const savedAt = Number(persistedState?.savedAt || 0);
        if (savedAt && Date.now() - savedAt > PERSIST_TTL_MS) {
          return currentState;
        }
        return {
          ...currentState,
          ...persistedState,
          isCompiling: false,
          isUploading: false,
          uploadProgress: 0,
          compileResult: null,
          errorMessage: '',
          detectedPort: null,
          detectedChipType: null,
        };
      },
    }
  )
);
