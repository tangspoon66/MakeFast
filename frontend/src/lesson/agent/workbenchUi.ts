/** 工作台 UI 状态（可被 Agent 导航驱动）：编辑区标签、要揭示的代码行、代码行装饰。 */
import { create } from 'zustand';

export type EditorTab = 'blocks' | 'code';
export interface LineDecoration { line: number; kind: 'error' | 'fix' | 'focus'; note?: string }

interface WorkbenchUiState {
  editorTab: EditorTab;
  setEditorTab: (t: EditorTab) => void;
  reveal: { line: number; nonce: number; focus?: boolean } | null;
  revealLine: (line: number) => void;
  decorations: LineDecoration[];
  setDecorations: (d: LineDecoration[]) => void;
}

export const useWorkbenchUi = create<WorkbenchUiState>((set) => ({
  editorTab: 'code',
  setEditorTab: (editorTab) => set({ editorTab }),
  reveal: null,
  revealLine: (line) => set({ reveal: { line, nonce: Date.now() + Math.random() } }),
  decorations: [],
  setDecorations: (decorations) => set({ decorations }),
}));
