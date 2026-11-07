import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/compilationClient', () => ({
  ApiError: class ApiError extends Error { statusCode?: number },
  CompilationClient: { compile: vi.fn().mockRejectedValue(new Error('Network Error')) },
}));
vi.mock('../lesson/deviceLink', async (orig) => {
  const mod = await orig<typeof import('../lesson/deviceLink')>();
  class FastMock extends mod.MockDeviceLink { constructor() { super({ serialIntervalMs: 10, stepMs: 1 }); } }
  return { ...mod, MockDeviceLink: FastMock };
});

import { LessonWorkbenchPage } from './LessonWorkbenchPage';
import { useLessonStore } from '../lesson/lessonStore';
import { useEditorStore } from '../store/editorStore';

const renderPage = () => render(<MemoryRouter><LessonWorkbenchPage /></MemoryRouter>);

describe('LessonWorkbenchPage (mock mode end-to-end)', () => {
  beforeEach(() => {
    localStorage.clear();
    useLessonStore.getState().resetLesson();
    useLessonStore.getState().setMockMode(true);
    useEditorStore.getState().setCode('');
  });

  it('renders frozen layout: 连线图 panel, ordered toolbar, GUIDING card with do/why/success', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: '连线图' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Wiring Graph/i);
    const order = ['action-board', 'action-connect', 'action-compile', 'action-flash'].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(useLessonStore.getState().agent.state).toBe('GUIDING');
    const card = screen.getByTestId('guide-step-card');
    expect(card.textContent).toContain('现在做');
    expect(card.textContent).toContain('为什么');
    expect(card.textContent).toContain('成功时');
    expect(screen.queryByRole('radio')).toBeNull(); // 课内零测验
  });

  it('graph error blocks compile at the action site', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('DHT22 DATA 接到'), { target: { value: '5V' } });
    await act(async () => { fireEvent.click(screen.getByTestId('action-compile')); });
    expect(useLessonStore.getState().toolchain.build.status).toBe('error');
    expect(screen.getAllByRole('alert').some((el) => el.textContent?.includes('连线图里有'))).toBe(true);
  });

  it('board → connect → compile → flash → serial readings → WRAP_UP → quiz unlock', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('action-board'));
    await act(async () => { fireEvent.click(screen.getByTestId('action-connect')); });
    await waitFor(() => expect(useLessonStore.getState().toolchain.connection.status).toBe('done'));
    await act(async () => { fireEvent.click(screen.getByTestId('action-compile')); });
    await waitFor(() => expect(useLessonStore.getState().toolchain.build.status).toBe('done'));
    await act(async () => { fireEvent.click(screen.getByTestId('action-flash')); });
    await waitFor(() => expect(useLessonStore.getState().phenomenonSuccess).toBe(true), { timeout: 4000 });
    expect(useLessonStore.getState().phenomenonSource).toBe('auto_serial');
    expect(useLessonStore.getState().agent.state).toBe('WRAP_UP');
    expect(await screen.findByTestId('wrap-up-card')).toBeInTheDocument();
    expect(useLessonStore.getState().quizStatus).toBe('available');
    expect(useLessonStore.getState().badges).toContain('mainline_complete');

    fireEvent.click(screen.getByTestId('open-quiz'));
    expect(useLessonStore.getState().agent.state).toBe('QUIET_HELP');
    expect(screen.queryByTestId('quiz-locked')).toBeNull();
  });

  it('quiz is locked before mainline', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('open-quiz'));
    expect(screen.getByTestId('quiz-locked')).toBeInTheDocument();
  });
});
