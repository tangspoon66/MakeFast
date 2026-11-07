import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LearnerDashboard } from './LearnerDashboard';
import { learningClient } from '../api/learningClient';

vi.mock('../store/learnerAuthStore', () => ({
  useLearnerAuthStore: () => ({
    learner: { id: 'learner-1', username: 'maker_one', display_name: '小明' },
    logout: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('../api/learningClient', () => ({ learningClient: { dashboard: vi.fn(), createProject: vi.fn(), getProject: vi.fn(), saveProject: vi.fn() } }));

describe('LearnerDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('renders project progress returned by the learner API', async () => {
    vi.mocked(learningClient.dashboard).mockResolvedValue({
      continue_project: {
        project_id: 'project-1',
        course_slug: 'temperature-alert',
        title: '我的温湿度提醒器',
        learning_mode: 'guided',
        editor_source: 'blocks',
        current_step_id: 'connect-sensor',
        completed_step_ids: ['prepare'],
        revision: 2,
        updated_at: '2026-09-27T10:00:00+00:00',
      },
      recent_projects: [{
        project_id: 'project-1',
        course_slug: 'temperature-alert',
        title: '我的温湿度提醒器',
        learning_mode: 'guided',
        editor_source: 'blocks',
        current_step_id: 'connect-sensor',
        completed_step_ids: ['prepare'],
        revision: 2,
        updated_at: '2026-09-27T10:00:00+00:00',
      }],
      project_count: 1,
      points_total: 0,
      badges: [],
    });

    render(<MemoryRouter><LearnerDashboard /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('1 个作品')).toBeInTheDocument());
    expect(screen.getByText('已经开始一门课程')).toBeInTheDocument();
    expect(screen.getByText('课程进行中')).toBeInTheDocument();
    expect(screen.getByText('我的温湿度提醒器')).toBeInTheDocument();
  });

  it('shows an error when the dashboard cannot be loaded', async () => {
    vi.mocked(learningClient.dashboard).mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><LearnerDashboard /></MemoryRouter>);
    expect(await screen.findByText('暂时无法读取学习记录，请刷新页面重试。')).toBeInTheDocument();
  });

  it('uploads a legacy draft only after explicit import', async () => {
    localStorage.setItem('editor-store-v2', JSON.stringify({ state: {
      code: 'void setup() {}', projectFiles: [], savedAt: Date.now(),
    } }));
    vi.mocked(learningClient.dashboard).mockResolvedValue({
      continue_project: null, recent_projects: [], project_count: 0, points_total: 0, badges: [],
    });
    const importedProject = {
      project_id: 'import-1', course_slug: null, title: '从旧草稿导入',
      learning_mode: 'guided' as const, editor_source: 'code' as const, board_id: null,
      project_state: {}, current_step_id: null, completed_step_ids: [], revision: 1, updated_at: '',
    };
    vi.mocked(learningClient.createProject).mockResolvedValue(importedProject);
    vi.mocked(learningClient.saveProject).mockResolvedValue({ ...importedProject, revision: 2 });

    render(<MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/dashboard" element={<LearnerDashboard />} />
      <Route path="/project" element={<div>已进入工作台</div>} />
    </Routes></MemoryRouter>);

    expect(await screen.findByText('这台浏览器里有一份旧草稿')).toBeInTheDocument();
    expect(learningClient.createProject).not.toHaveBeenCalled();
    expect(learningClient.saveProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '导入旧草稿' }));
    await waitFor(() => expect(learningClient.saveProject).toHaveBeenCalledWith(
      'import-1', 1, expect.objectContaining({ project_state: expect.objectContaining({ code: 'void setup() {}' }) }),
    ));
    expect(await screen.findByText('已进入工作台')).toBeInTheDocument();
    expect(localStorage.getItem('makefast-legacy-draft-v1')).toBeNull();
  });
});
