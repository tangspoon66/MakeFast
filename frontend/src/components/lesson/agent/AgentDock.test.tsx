import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LessonAgentDock } from '../LessonAgentDock';
import { FIRST_LESSON_GUIDE } from '../../../lesson/guideScript';
import { diagnose } from '../../../lesson/learner/diagnose';

const step = FIRST_LESSON_GUIDE[6];
const base = {
  state: 'GUIDING' as const, step, stepIndex: 6, stepCount: 9, stepDone: false, bottomOffset: 200,
  stepAnchor: 'topbar.compile', chatContext: { course_id: 'c', course_title: 't', step: { id: step.id, title: step.title, do: step.do, why: step.why, success: step.success } },
  suggestions: ['编译是什么？'], onPrev: vi.fn(), onNext: vi.fn(), onAskHelp: vi.fn(), onCloseHelp: vi.fn(), onOpenQuiz: vi.fn(), quizLabel: 'q',
  onGoTo: vi.fn(), onHint: () => '提示文本', onDismissStep: vi.fn(), onDismissStuck: vi.fn(), onAcceptStuck: vi.fn(),
};

describe('锚定式小铁猫', () => {
  it('步骤开始：卡片锚定在当前步骤目标（编译按钮）', () => {
    render(<><div data-lw-anchor="topbar.compile">编译</div><LessonAgentDock {...base} /></>);
    expect(screen.getByTestId('agent-coach').getAttribute('data-anchor')).toBe('topbar.compile');
    expect(screen.getByTestId('guide-step-card')).toBeInTheDocument();
  });
  it('出错：诊断卡锚定在出错按钮 + 带我去', () => {
    const d = diagnose({ flashError: 'Failed to connect to ESP32' });
    const onGoTo = vi.fn();
    render(<LessonAgentDock {...base} warning="烧录失败" diagnosis={d} onGoTo={onGoTo} />);
    const card = screen.getByTestId('agent-diagnosis');
    expect(card.getAttribute('data-anchor')).toBe('topbar.flash');
    fireEvent.click(screen.getByText('带我去「烧录」'));
    expect(onGoTo).toHaveBeenCalledWith('topbar.flash');
  });
  it('卡住：在目标旁询问要不要帮忙', () => {
    render(<LessonAgentDock {...base} stuck={{ stuck: true, reason: 'dwell', level: 'nudge', message: '你在这一步待了一会儿啦' }} />);
    expect(screen.getByTestId('agent-stuck')).toHaveTextContent('待了一会儿');
  });
  it('关闭后收成召唤按钮；点开聊天，离题被友好拒绝', async () => {
    render(<LessonAgentDock {...base} />);
    fireEvent.click(screen.getByLabelText('关闭提示'));
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    fireEvent.click(screen.getByTestId('agent-summon'));
    const input = screen.getByLabelText('输入问题');
    fireEvent.change(input, { target: { value: '讲个笑话' } });
    await act(async () => { fireEvent.submit(input.closest('form')!); });
    const last = screen.getAllByTestId('chat-msg-assistant').pop()!;
    expect(last.getAttribute('data-category')).toBe('off_topic');
    expect(last).toHaveTextContent('回到课程');
  });
  it('IDLE：只显示待机形象', () => {
    render(<LessonAgentDock {...base} state="IDLE" />);
    expect(screen.queryByTestId('agent-coach')).toBeNull();
    expect(screen.queryByTestId('agent-summon')).toBeNull();
  });
});
