import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { learningClient, LearningProjectError, type LearnerProject } from '../api/learningClient';
import { useEditorStore } from '../store/editorStore';
import { useLearnerProject } from './useLearnerProject';

const loadedProject: LearnerProject = {
  project_id: 'project-1', course_slug: 'temperature-alert', title: '我的温湿度提醒器',
  learning_mode: 'guided', editor_source: 'code', board_id: 'esp32s3',
  project_state: { code: 'void setup() {}', projectFiles: [] },
  current_step_id: 'code', completed_step_ids: [], revision: 1, updated_at: '2026-09-27T10:00:00Z',
};

describe('owned project editor session', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useEditorStore.setState({ code: '', projectFiles: [], blocksXml: null, selectedBoard: '', viewMode: 'code' });
  });

  it('loads the owned project and autosaves code with its revision', async () => {
    vi.spyOn(learningClient, 'getProject').mockResolvedValue(loadedProject);
    const save = vi.spyOn(learningClient, 'saveProject').mockImplementation(async (_id, _revision, values) => ({
      ...loadedProject, ...values, revision: 2,
    }));

    const { result } = renderHook(() => useLearnerProject('project-1', 'learner-1'));
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(useEditorStore.getState().code).toBe('void setup() {}');
    expect(result.current.activeStep).toBe('code');

    act(() => useEditorStore.getState().setCode('void loop() {}'));
    await waitFor(() => expect(save).toHaveBeenCalled(), { timeout: 2500 });
    expect(save).toHaveBeenCalledWith('project-1', 1, expect.objectContaining({
      project_state: expect.objectContaining({ code: 'void loop() {}' }),
      current_step_id: 'code',
    }));
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
  });

  it('does not overwrite a newer revision and can save a separate copy', async () => {
    vi.spyOn(learningClient, 'getProject').mockResolvedValue(loadedProject);
    const save = vi.spyOn(learningClient, 'saveProject')
      .mockRejectedValueOnce(new LearningProjectError('项目已有更新版本', 409, 'revision_conflict'))
      .mockImplementation(async (id, _revision, values) => ({ ...loadedProject, ...values, project_id: id, revision: 2 }));
    vi.spyOn(learningClient, 'createProject').mockResolvedValue({ ...loadedProject, project_id: 'copy-1', revision: 1 });

    const { result } = renderHook(() => useLearnerProject('project-1', 'learner-1'));
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    act(() => useEditorStore.getState().setCode('my unsaved change'));
    await act(async () => { await result.current.saveNow(); });
    expect(result.current.saveStatus).toBe('conflict');
    expect(useEditorStore.getState().code).toBe('my unsaved change');

    let copyId: string | null = null;
    await act(async () => { copyId = await result.current.saveCopy(); });
    expect(copyId).toBe('copy-1');
    expect(save).toHaveBeenLastCalledWith('copy-1', 1, expect.objectContaining({
      project_state: expect.objectContaining({ code: 'my unsaved change' }),
    }));
  });

  it('persists Blockly workspace XML as the project source', async () => {
    vi.spyOn(learningClient, 'getProject').mockResolvedValue(loadedProject);
    const save = vi.spyOn(learningClient, 'saveProject').mockImplementation(async (_id, _revision, values) => ({
      ...loadedProject, ...values, revision: 2,
    }));
    const { result } = renderHook(() => useLearnerProject('project-1', 'learner-1'));
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    act(() => useEditorStore.getState().setBlocksXml('<xml><block type="arduino_setup" /></xml>'));
    await act(async () => { await result.current.saveNow(); });
    expect(save).toHaveBeenCalledWith('project-1', 1, expect.objectContaining({
      editor_source: 'blocks',
      project_state: expect.objectContaining({ blocksXml: '<xml><block type="arduino_setup" /></xml>' }),
    }));
  });

  it('saves each material confirmation and reverses completion when unchecked', async () => {
    vi.spyOn(learningClient, 'getProject').mockResolvedValue(loadedProject);
    const save = vi.spyOn(learningClient, 'saveProject').mockImplementation(async (_id, _revision, values) => ({
      ...loadedProject, ...values, revision: 2,
    }));
    const { result } = renderHook(() => useLearnerProject('project-1', 'learner-1'));
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    const ids = ['xiao-board', 'dht11', 'buzzer', 'cables'];
    for (const id of ids) {
      act(() => result.current.toggleMaterial(id, ids));
    }
    expect(result.current.materialsConfirmed).toEqual(ids);
    expect(result.current.completedStepIds).toContain('materials');
    await act(async () => { await result.current.saveNow(); });
    expect(save).toHaveBeenCalledWith('project-1', 1, expect.objectContaining({
      project_state: expect.objectContaining({ materialsConfirmed: ids }),
      completed_step_ids: ['materials'],
    }));

    act(() => result.current.toggleMaterial('dht11', ids));
    expect(result.current.materialsConfirmed).not.toContain('dht11');
    expect(result.current.completedStepIds).not.toContain('materials');
  });

  it('restores saved material confirmations without an immediate false save', async () => {
    const restored = {
      ...loadedProject,
      project_state: { ...loadedProject.project_state, materialsConfirmed: ['xiao-board', 'dht11'] },
      completed_step_ids: [],
    };
    vi.spyOn(learningClient, 'getProject').mockResolvedValue(restored);
    const save = vi.spyOn(learningClient, 'saveProject').mockResolvedValue(restored);
    const { result } = renderHook(() => useLearnerProject('project-1', 'learner-1'));
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.materialsConfirmed).toEqual(['xiao-board', 'dht11']);
    expect(result.current.isDirty).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('persists a manual debug-panel choice with the owned project', async () => {
    vi.spyOn(learningClient, 'getProject').mockResolvedValue(loadedProject);
    const save = vi.spyOn(learningClient, 'saveProject').mockImplementation(async (_id, _revision, values) => ({
      ...loadedProject, ...values, revision: 2,
    }));
    const { result } = renderHook(() => useLearnerProject('project-1', 'learner-1'));
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    act(() => result.current.setDebugPanelPreference('closed'));
    await act(async () => { await result.current.saveNow(); });
    expect(save).toHaveBeenCalledWith('project-1', 1, expect.objectContaining({
      project_state: expect.objectContaining({ debugPanelPreference: 'closed' }),
    }));
  });
});
