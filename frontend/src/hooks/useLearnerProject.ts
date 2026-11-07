import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { learningClient, LearningProjectError, type LearnerProject, type LearnerProjectSave } from '../api/learningClient';
import { useEditorStore, type ProjectFile } from '../store/editorStore';
import { captureLegacyDraft } from '../utils/legacyDraft';

export type WorkbenchStepId = string;
export type ProjectSaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';
export type DebugPanelPreference = 'auto' | 'open' | 'closed';

function projectFilesFromState(value: unknown): ProjectFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((file, index) => {
    if (!file || typeof file.name !== 'string' || typeof file.content !== 'string') return [];
    return [{
      id: typeof file.id === 'string' ? file.id : `project-file-${index}`,
      name: file.name,
      content: file.content,
      type: file.type,
    } as ProjectFile];
  });
}

export function useLearnerProject(projectId: string | null, ownerId?: string) {
  const code = useEditorStore((state) => state.code);
  const projectFiles = useEditorStore((state) => state.projectFiles);
  const blocksXml = useEditorStore((state) => state.blocksXml);
  const selectedBoard = useEditorStore((state) => state.selectedBoard);
  const [project, setProject] = useState<LearnerProject | null>(null);
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<WorkbenchStepId>('overview');
  const [materialsConfirmed, setMaterialsConfirmed] = useState<string[]>([]);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [debugPanelPreference, setDebugPanelPreference] = useState<DebugPanelPreference>('auto');
  const [saveStatus, setSaveStatus] = useState<ProjectSaveStatus>('saved');
  const [saveMessage, setSaveMessage] = useState('');
  const [savedFingerprint, setSavedFingerprint] = useState('');
  const projectRef = useRef<LearnerProject | null>(null);
  const savingRef = useRef(false);
  const copyProjectIdRef = useRef<string | null>(null);
  const requestKey = `${ownerId || ''}:${projectId || ''}`;
  const loadState = !ownerId || !projectId || loadErrorKey === requestKey
    ? 'error' : project?.project_id === projectId && loadedOwnerId === ownerId ? 'ready' : 'loading';

  useEffect(() => {
    let cancelled = false;
    projectRef.current = null;
    copyProjectIdRef.current = null;
    if (!projectId || !ownerId) return;

    captureLegacyDraft(ownerId);
    void (async () => {
      try {
        await useEditorStore.persist.rehydrate();
        const loaded = await learningClient.getProject(projectId);
        if (cancelled) return;
        const loadedStep = loaded.current_step_id || 'overview';
        const loadedMaterials = Array.isArray(loaded.project_state.materialsConfirmed)
          ? loaded.project_state.materialsConfirmed.filter((value): value is string => typeof value === 'string') : [];
        const loadedCode = typeof loaded.project_state.code === 'string' ? loaded.project_state.code : '';
        const loadedFiles = projectFilesFromState(loaded.project_state.projectFiles);
        const loadedBlocksXml = typeof loaded.project_state.blocksXml === 'string' ? loaded.project_state.blocksXml : null;
        const loadedDebugPreference = loaded.project_state.debugPanelPreference === 'open' || loaded.project_state.debugPanelPreference === 'closed'
          ? loaded.project_state.debugPanelPreference : 'auto';
        useEditorStore.setState({
          code: loadedCode,
          projectFiles: loadedFiles,
          blocksXml: loadedBlocksXml,
          selectedBoard: loaded.board_id || '',
          viewMode: loadedStep === 'code' ? 'code' : loaded.editor_source === 'blocks' ? 'blocks' : 'code',
        });
        setActiveStep(loadedStep);
        setMaterialsConfirmed(loadedMaterials);
        setCompletedStepIds(loaded.completed_step_ids);
        setDebugPanelPreference(loadedDebugPreference);
        projectRef.current = loaded;
        setSavedFingerprint(JSON.stringify({
          title: loaded.title,
          learning_mode: loaded.learning_mode,
          editor_source: loadedBlocksXml ? 'blocks' : 'code',
          board_id: loaded.board_id || null,
          project_state: { ...loaded.project_state, code: loadedCode, projectFiles: loadedFiles, blocksXml: loadedBlocksXml, materialsConfirmed: loadedMaterials, debugPanelPreference: loadedDebugPreference },
          current_step_id: loaded.current_step_id,
          completed_step_ids: loaded.completed_step_ids,
        } satisfies LearnerProjectSave));
        setSaveStatus('saved');
        setSaveMessage('');
        setLoadErrorKey(null);
        setLoadedOwnerId(ownerId);
        setProject(loaded);
      } catch {
        if (!cancelled) setLoadErrorKey(requestKey);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, ownerId, requestKey]);

  const snapshot = useMemo<LearnerProjectSave | null>(() => project ? ({
    title: project.title,
    learning_mode: project.learning_mode,
    editor_source: blocksXml ? 'blocks' : 'code',
    board_id: selectedBoard || null,
    project_state: { ...project.project_state, code, projectFiles, blocksXml, materialsConfirmed, debugPanelPreference },
    current_step_id: activeStep,
    completed_step_ids: completedStepIds,
  }) : null, [project, code, projectFiles, blocksXml, selectedBoard, activeStep, materialsConfirmed, completedStepIds, debugPanelPreference]);
  const fingerprint = snapshot ? JSON.stringify(snapshot) : '';
  const isDirty = loadState === 'ready' && fingerprint !== savedFingerprint;
  const displayedSaveStatus = isDirty && saveStatus === 'saved' ? 'unsaved' : saveStatus;

  const saveNow = useCallback(async (): Promise<boolean> => {
    const currentProject = projectRef.current;
    const currentSnapshot = snapshot;
    if (!currentProject || !currentSnapshot || savingRef.current || !projectId || currentProject.project_id !== projectId) return false;
    const submittedFingerprint = JSON.stringify(currentSnapshot);
    if (submittedFingerprint === savedFingerprint) {
      setSaveStatus('saved');
      return true;
    }
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      const saved = await learningClient.saveProject(projectId, currentProject.revision, currentSnapshot);
      if (projectRef.current?.project_id !== projectId) return false;
      projectRef.current = saved;
      setSavedFingerprint(submittedFingerprint);
      setProject(saved);
      setSaveMessage('');
      setSaveStatus('saved');
      return true;
    } catch (error) {
      if (error instanceof LearningProjectError && error.statusCode === 409) {
        setSaveStatus('conflict');
        setSaveMessage('这个项目在别处有了新版本。本页修改还在，请先复制重要内容，不会自动覆盖新版本。');
      } else {
        setSaveStatus('error');
        setSaveMessage('保存失败，本页修改还在。请检查网络后重试。');
      }
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [projectId, snapshot, savedFingerprint]);

  useEffect(() => {
    if (!isDirty || saveStatus === 'saving' || saveStatus === 'error' || saveStatus === 'conflict') return;
    const timer = window.setTimeout(() => { void saveNow(); }, 900);
    return () => window.clearTimeout(timer);
  }, [isDirty, fingerprint, saveStatus, saveNow]);

  useEffect(() => {
    if (!isDirty && saveStatus !== 'saving') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, saveStatus]);

  const retrySave = useCallback(() => {
    if (saveStatus !== 'conflict') {
      setSaveStatus('unsaved');
      void saveNow();
    }
  }, [saveNow, saveStatus]);

  const saveCopy = useCallback(async (): Promise<string | null> => {
    const currentProject = projectRef.current;
    const currentSnapshot = snapshot;
    if (!currentProject || !currentSnapshot || savingRef.current) return null;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      const copyTitle = `${currentProject.title.slice(0, 110)}（本页副本）`;
      const created = copyProjectIdRef.current
        ? await learningClient.getProject(copyProjectIdRef.current)
        : await learningClient.createProject(copyTitle, currentProject.course_slug);
      copyProjectIdRef.current = created.project_id;
      const saved = await learningClient.saveProject(created.project_id, created.revision, {
        ...currentSnapshot,
        title: copyTitle,
      });
      return saved.project_id;
    } catch {
      setSaveStatus('conflict');
      setSaveMessage('另存失败，本页修改仍在。请检查网络后重试。');
      return null;
    } finally {
      savingRef.current = false;
    }
  }, [snapshot]);

  const toggleMaterial = useCallback((materialId: string, allMaterialIds: string[]) => {
    const next = materialsConfirmed.includes(materialId)
      ? materialsConfirmed.filter((id) => id !== materialId)
      : [...materialsConfirmed, materialId];
    setMaterialsConfirmed(next);
    const allReady = allMaterialIds.length > 0 && allMaterialIds.every((id) => next.includes(id));
    setCompletedStepIds((ids) => allReady
      ? ids.includes('materials') ? ids : [...ids, 'materials']
      : ids.filter((id) => id !== 'materials'));
  }, [materialsConfirmed]);

  const acceptServerProject = useCallback((updated: LearnerProject) => {
    const nextCode = typeof updated.project_state.code === 'string' ? updated.project_state.code : '';
    const nextFiles = projectFilesFromState(updated.project_state.projectFiles);
    const nextBlocksXml = typeof updated.project_state.blocksXml === 'string' ? updated.project_state.blocksXml : null;
    const nextMaterials = Array.isArray(updated.project_state.materialsConfirmed)
      ? updated.project_state.materialsConfirmed.filter((value): value is string => typeof value === 'string') : [];
    const nextPreference = updated.project_state.debugPanelPreference === 'open' || updated.project_state.debugPanelPreference === 'closed'
      ? updated.project_state.debugPanelPreference : 'auto';
    useEditorStore.setState({
      code: nextCode,
      projectFiles: nextFiles,
      blocksXml: nextBlocksXml,
      selectedBoard: updated.board_id || '',
      viewMode: updated.editor_source === 'blocks' ? 'blocks' : 'code',
    });
    projectRef.current = updated;
    setProject(updated);
    setMaterialsConfirmed(nextMaterials);
    setCompletedStepIds(updated.completed_step_ids);
    setDebugPanelPreference(nextPreference);
    setSavedFingerprint(JSON.stringify({
      title: updated.title,
      learning_mode: updated.learning_mode,
      editor_source: nextBlocksXml ? 'blocks' : updated.editor_source,
      board_id: updated.board_id || null,
      project_state: { ...updated.project_state, code: nextCode, projectFiles: nextFiles, blocksXml: nextBlocksXml, materialsConfirmed: nextMaterials, debugPanelPreference: nextPreference },
      current_step_id: updated.current_step_id,
      completed_step_ids: updated.completed_step_ids,
    } satisfies LearnerProjectSave));
    setSaveStatus('saved');
    setSaveMessage('');
  }, []);

  return { project, activeStep, setActiveStep, materialsConfirmed, completedStepIds, toggleMaterial, debugPanelPreference, setDebugPanelPreference, loadState, saveStatus: displayedSaveStatus, saveMessage, isDirty, saveNow, retrySave, saveCopy, acceptServerProject };
}
