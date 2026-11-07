import type { ProjectFile } from '../store/editorStore';

const OLD_STORE_KEY = 'editor-store-v2';
const DRAFT_KEY = 'makefast-legacy-draft-v1';
const SCANNED_KEY = 'makefast-legacy-draft-scanned-v1';
const LEGACY_TTL_MS = 24 * 60 * 60 * 1000;

export interface LegacyDraft {
  ownerId: string;
  code: string;
  projectFiles: ProjectFile[];
  boardId: string | null;
}

function readDraft(): LegacyDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as LegacyDraft;
    return typeof draft.ownerId === 'string' && typeof draft.code === 'string' && Array.isArray(draft.projectFiles)
      ? draft : null;
  } catch {
    return null;
  }
}

export function getLegacyDraft(ownerId: string): LegacyDraft | null {
  const draft = readDraft();
  return draft?.ownerId === ownerId ? draft : null;
}

export function captureLegacyDraft(ownerId: string): LegacyDraft | null {
  const existing = readDraft();
  if (existing) return existing.ownerId === ownerId ? existing : null;
  try {
    if (localStorage.getItem(SCANNED_KEY)) return null;
    const raw = localStorage.getItem(OLD_STORE_KEY);
    localStorage.setItem(SCANNED_KEY, ownerId);
    if (!raw) return null;
    const state = JSON.parse(raw).state as Record<string, unknown> | undefined;
    if (!state) return null;
    const savedAt = Number(state.savedAt || 0);
    if (savedAt && Date.now() - savedAt > LEGACY_TTL_MS) return null;
    const code = typeof state.code === 'string' ? state.code : '';
    const projectFiles = Array.isArray(state.projectFiles)
      ? state.projectFiles.filter((file): file is ProjectFile =>
        file && typeof file === 'object' && typeof file.name === 'string' && typeof file.content === 'string')
      : [];
    if ((!code.trim() || code.trim() === '//使用 AI 助手写代码，一键部署!') && projectFiles.length === 0) return null;
    const draft: LegacyDraft = {
      ownerId,
      code,
      projectFiles,
      boardId: typeof state.selectedBoard === 'string' ? state.selectedBoard : null,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

export function clearLegacyDraft(ownerId: string): void {
  if (getLegacyDraft(ownerId)) localStorage.removeItem(DRAFT_KEY);
}
