import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogIdleAgent } from './CatalogIdleAgent';
import { useLessonStore } from '../../lesson/lessonStore';

describe('CatalogIdleAgent (M7 hard gate)', () => {
  it.each(['welcome', 'home-hub', 'catalog'] as const)('forces Agent IDLE on %s with no guide bubble', (surface) => {
    useLessonStore.getState().setSurface('workbench');
    expect(useLessonStore.getState().agent.state).toBe('GUIDING');
    render(<CatalogIdleAgent surface={surface} />);
    expect(useLessonStore.getState().agent.state).toBe('IDLE');
    expect(screen.getByTestId('mascot').dataset.mood).toBe('idle');
    expect(screen.queryByTestId('guide-step-card')).toBeNull();
  });
});
