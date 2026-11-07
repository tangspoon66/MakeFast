/**
 * Pre-course Agent dock — IDLE only (M7 / F-CAT-03).
 * Shows mascot; never opens guide bubble or auto-speaks.
 * Used on Welcome, Home Hub, and Course Catalog.
 */
import { useEffect } from 'react';
import { Mascot } from '../lesson/Mascot';
import { useLessonStore } from '../../lesson/lessonStore';

type IdleSurface = 'welcome' | 'home-hub' | 'catalog' | 'detail';

interface CatalogIdleAgentProps {
  surface?: IdleSurface;
}

export function CatalogIdleAgent({ surface = 'catalog' }: CatalogIdleAgentProps) {
  // M7：进入 Welcome / Hub / 目录时，课程 Agent 状态机切回 IDLE（暂停引导）
  useEffect(() => {
    const map = surface === 'home-hub' ? 'home' : surface;
    useLessonStore.getState().setSurface(map);
  }, [surface]);
  return (
    <div
      className="pointer-events-auto fixed bottom-5 right-5 z-20"
      data-agent-surface={surface}
      data-agent-state="idle"
      data-testid={`${surface}-idle-agent`}
      aria-label="小铁猫待机中"
    >
      {/* IDLE：只显示待机形象（呼吸动画），不弹引导气泡、不自动开讲 */}
      <Mascot mood="idle" label="小铁猫在休息，进入课程后会开始带你做" />
    </div>
  );
}
