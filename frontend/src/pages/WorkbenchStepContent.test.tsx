import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchStepContent } from './HomePage';
import type { CourseStep } from '../api/learningCourseClient';
import { starterFinishedMedia } from '../data/starterCourse';

const quizStep: CourseStep = {
  id: 'check-one', type: 'quiz', title: '知识检查', body: '',
  prerequisite_ids: [], agent_anchor: null, material_ids: [], connection_ids: [],
  expected_observation: null, challenge: null,
  quiz: {
    question: '哪个部件能读出温度？',
    options: [{ id: 'sensor', text: '温湿度传感器' }, { id: 'buzzer', text: '蜂鸣器' }],
    answer_id: 'sensor', explanation: '传感器负责感知，蜂鸣器负责提醒。',
  },
};

describe('WorkbenchStepContent knowledge check', () => {
  it('offers keyboard-selectable answers and shows feedback without claiming saved progress', () => {
    render(<WorkbenchStepContent
      step={quizStep}
      materials={[]}
      materialsConfirmed={[]}
      onToggleMaterial={vi.fn()}
      finishedMedia={starterFinishedMedia}
      monitorState={{ isOpen: false, lines: [], baudRate: 115200, isPaused: false }}
    />);

    const wrong = screen.getByRole('button', { name: '蜂鸣器' });
    fireEvent.keyDown(wrong, { key: 'Enter' });
    fireEvent.click(wrong);
    expect(wrong).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('再想一想')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '温湿度传感器' }));
    expect(screen.getByText('答对了')).toBeInTheDocument();
    expect(screen.getByText(/正式答题进度和积分会在后续功能中记录/)).toBeInTheDocument();
  });
});
