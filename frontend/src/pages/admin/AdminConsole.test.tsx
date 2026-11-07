import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { mockFetch, renderAdmin } from './testUtils';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ConsoleDashboard } from './ConsoleDashboard';
import { CoursesPage } from './CoursesPage';
import { HardwarePage } from './HardwarePage';
import { AgentPage } from './AgentPage';
import { UsersPage } from './UsersPage';
import { SettingsPage } from './SettingsPage';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const emptyDash = { learner_count: 0, active_sessions: 0, started_learners: 0, completion_rate: null, quiz_pass_rate: null,
  agent_messages: 0, agent_conversations: 0, agent_refusals: 0, refusal_categories: {}, common_errors: [], event_funnel: {} };

const course = { slug: 'first-lesson', title: '第一课：温湿度小管家', level: '入门', summary: '', skills: ['传感器'], prerequisites: [],
  cover: '', duration_min: 45, board_id: 'xiao-esp32-s3', steps: [{ id: 'meet', title: '认识作品', why: '' }],
  quiz: [{ id: 'q1', prompt: '接哪?', choices: ['D0', '5V'], answer_index: 0, explain: '' }], status: 'published', revision: 3, updated_at: '2026-10-10T00:00:00Z', updated_by: 'seed' };

describe('AdminLayout', () => {
  it('shows role-filtered nav for viewers and redirects to login when unauthenticated', async () => {
    mockFetch({ 'GET /me': { username: 'v', role: 'viewer', source: 'console' } });
    render(<MemoryRouter initialEntries={['/admin']}><Routes><Route path="/admin" element={<AdminLayout />}><Route index element={<div>首页内容</div>} /></Route></Routes></MemoryRouter>);
    expect(await screen.findByText('首页内容')).toBeInTheDocument();
    expect(screen.getByText('只读')).toBeInTheDocument();
    expect(screen.queryByText('用户与角色')).not.toBeInTheDocument();
    expect(screen.getByText('课程管理')).toBeInTheDocument();
  });

  it('redirects to /admin/login on 401', async () => {
    mockFetch({ 'GET /me': { __status: 401, body: { detail: { message: '未登录' } } } });
    render(<MemoryRouter initialEntries={['/admin']}><Routes>
      <Route path="/admin" element={<AdminLayout />}><Route index element={<div>x</div>} /></Route>
      <Route path="/admin/login" element={<div>登录页</div>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('登录页')).toBeInTheDocument();
  });
});

describe('ConsoleDashboard', () => {
  it('renders empty states when no data', async () => {
    mockFetch({ 'GET /dashboard': emptyDash });
    renderAdmin(<ConsoleDashboard />);
    expect(await screen.findByText('还没有学习数据')).toBeInTheDocument();
    expect(screen.getByText('暂无错误记录')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
  it('renders metrics', async () => {
    mockFetch({ 'GET /dashboard': { ...emptyDash, learner_count: 12, started_learners: 10, completion_rate: 0.4, event_funnel: { course_completed: 4 },
      common_errors: [{ label: '编译失败', count: 7, rate: 12.5 }] } });
    renderAdmin(<ConsoleDashboard />);
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('编译失败')).toBeInTheDocument();
  });
});

describe('CoursesPage', () => {
  it('lists, previews, unpublishes and creates a course', async () => {
    const calls = mockFetch({
      'GET /courses': { items: [course] },
      'POST /courses/first-lesson/unpublish': { ...course, status: 'draft' },
      'POST /courses': (_u: string, init?: RequestInit) => ({ ...JSON.parse(String(init?.body)), status: 'draft', revision: 1 }),
    });
    renderAdmin(<CoursesPage />, { username: 'e', role: 'editor', source: 'console' });
    expect(await screen.findByText('第一课：温湿度小管家')).toBeInTheDocument();
    fireEvent.click(screen.getByText('预览'));
    expect(screen.getByLabelText('课程预览')).toHaveTextContent('认识作品');
    fireEvent.click(screen.getByLabelText('关闭'));
    fireEvent.click(screen.getByText('下架'));
    await waitFor(() => expect(calls.some((c) => c.url === '/courses/first-lesson/unpublish')).toBe(true));
    // editors cannot delete
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('+ 新建课程'));
    fireEvent.change(screen.getByLabelText('课程标识'), { target: { value: 'led-blink' } });
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '点亮 LED' } });
    fireEvent.click(screen.getByText('+ 电子与接线'));
    fireEvent.click(screen.getByText('+ 添加步骤'));
    fireEvent.change(screen.getByLabelText('步骤1标题'), { target: { value: '接 LED' } });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url === '/courses')).toBeTruthy());
    const body = calls.find((c) => c.method === 'POST' && c.url === '/courses')!.body as { slug: string; skills: string[]; steps: { title: string }[] };
    expect(body.slug).toBe('led-blink');
    expect(body.skills).toEqual(['电子与接线']);
    expect(body.steps[0].title).toBe('接 LED');
    expect(await screen.findByText('已保存「点亮 LED」')).toBeInTheDocument();
  });

  it('viewer sees no edit buttons', async () => {
    mockFetch({ 'GET /courses': { items: [course] } });
    renderAdmin(<CoursesPage />, { username: 'v', role: 'viewer', source: 'console' });
    await screen.findByText('第一课：温湿度小管家');
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('+ 新建课程')).not.toBeInTheDocument();
  });
});

describe('HardwarePage', () => {
  const hw = { kind: 'board', id: 'xiao-esp32-s3', name: 'XIAO', data: { id: 'xiao-esp32-s3', name: 'XIAO' }, pinmap: { pins: [{ id: 'D0', x: 1, y: 2, gpio: 1 }] }, pin_count: 1, updated_at: '', updated_by: 'seed', errors: [] };
  it('blocks invalid JSON locally and shows server validation errors', async () => {
    mockFetch({ 'GET /hardware': { items: [hw] }, 'PUT /hardware/board/xiao-esp32-s3': { __status: 422, body: { detail: { message: '校验未通过', errors: ['引脚 ID 重复：D0'] } } } });
    renderAdmin(<HardwarePage />);
    fireEvent.click(await screen.findByText('xiao-esp32-s3'));
    expect(screen.getByText('D0')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('数据 JSON'), { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: '校验' }));
    expect(await screen.findByText('JSON 格式错误')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('数据 JSON'), { target: { value: JSON.stringify(hw.data) } });
    fireEvent.click(screen.getByText('保存'));
    expect(await screen.findByText('引脚 ID 重复：D0')).toBeInTheDocument();
  });
});

describe('AgentPage', () => {
  it('guard test shows verdict and FAQ create works', async () => {
    const calls = mockFetch({
      'GET /agent/conversations': { items: [], events: [] },
      'GET /agent/guard': { lists: { course: ['蜂鸣器'], off_topic: ['作业'], injection: [], unsafe: [], pii: [] } },
      'POST /agent/guard/test': { verdict: 'off_topic', allowed: false, pii: false, redacted: '', hits: { off_topic: ['作业'] } },
      'GET /agent/faq': { items: [] },
      'POST /agent/faq': { id: 1 },
      'GET /agent/providers': { items: [{ id: 'deepseek', label: 'DeepSeek', key_configured: true, key_env: 'DEEPSEEK_API_KEY', model: null }], mode: 'online' },
    });
    renderAdmin(<AgentPage />, { username: 'e', role: 'editor', source: 'console' }, '/admin/agent');
    expect(await screen.findByText('还没有 Agent 对话')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '守卫关键词' }));
    fireEvent.change(await screen.findByLabelText('测试消息'), { target: { value: '帮我写作业' } });
    fireEvent.click(screen.getByText('检测'));
    expect(await screen.findByText('拒答：off_topic')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'FAQ 知识库' }));
    fireEvent.click(await screen.findByText('+ 新增 FAQ'));
    fireEvent.change(screen.getByLabelText('问题'), { target: { value: 'LED 不亮？' } });
    fireEvent.change(screen.getByLabelText('答案'), { target: { value: '检查正负极' } });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url === '/agent/faq')).toBe(true));
    fireEvent.click(screen.getByRole('tab', { name: '服务商状态' }));
    expect(await screen.findByText('已配置')).toBeInTheDocument();
  });
});

describe('UsersPage & SettingsPage', () => {
  it('admin can change a role; self row is locked', async () => {
    const calls = mockFetch({
      'GET /users': { items: [
        { username: 'mfadmin', role: 'admin', display_name: '本地管理员', disabled: false, created_at: '', last_login_at: null },
        { username: 'ed', role: 'editor', display_name: 'ed', disabled: false, created_at: '', last_login_at: null }], env_admin: 'admin', env_admin_configured: true },
      'PATCH /users/ed': { username: 'ed', role: 'viewer' },
    });
    renderAdmin(<UsersPage />);
    const sel = await screen.findByLabelText('ed 的角色');
    expect(screen.getByLabelText('mfadmin 的角色')).toBeDisabled();
    fireEvent.change(sel, { target: { value: 'viewer' } });
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ role: 'viewer' }));
  });
  it('non-admin sees users page locked and settings read-only', async () => {
    mockFetch({ 'GET /settings': { settings: { site_name: 'MF', registration_open: true, agent_enabled: true, agent_offline_only: false,
      agent_daily_message_limit: 60, agent_max_reply_chars: 120, log_retention_days: 30, default_course: 'first-lesson', maintenance_banner: '' } },
    'GET /courses': { items: [course] } });
    const { unmount } = renderAdmin(<UsersPage />, { username: 'v', role: 'viewer', source: 'console' });
    expect(screen.getByText('需要管理员角色')).toBeInTheDocument();
    unmount();
    renderAdmin(<SettingsPage />, { username: 'v', role: 'viewer', source: 'console' });
    const name = await screen.findByLabelText('站点名称');
    expect(name).toBeDisabled();
    expect(screen.queryByText('保存设置')).not.toBeInTheDocument();
    expect(within(document.body).getByText('仅管理员可见')).toBeInTheDocument();
  });
});
