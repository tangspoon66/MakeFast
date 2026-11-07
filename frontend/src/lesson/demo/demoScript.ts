/**
 * 评委演示脚本（/workbench?course=first-lesson&demo=1）。
 * 不造假：每一步都是在真实界面上点按钮 / 改程序，小铁猫的反应全部来自真实的感知与诊断逻辑。
 * 叙事线：感知 → 诊断 → 跳到出错那一行并解释 → 征得同意再改 → 工具链反应 → 自动识别成功 → 问答带我去 → 成长卡 → 推荐下一课。
 */
import { useEditorStore } from '../../store/editorStore';
import { useLessonStore } from '../lessonStore';
import type { QuizSpec } from '../quiz';

export interface DemoStep {
  id: string;
  title: string;
  /** 给评委看的旁白：这一步小铁猫在「感知 / 诊断 / 行动」什么 */
  narration: string;
  run: (ctx: DemoCtx) => Promise<void>;
}
export interface DemoCtx { code: string; quiz: QuizSpec; signal: AbortSignal }

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
});
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
async function waitFor<T>(fn: () => T | null | undefined | false, signal: AbortSignal, timeout = 20000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v as T;
    if (Date.now() - t0 > timeout) throw new Error('演示等待超时');
    await sleep(120, signal);
  }
}
async function click(sel: string, signal: AbortSignal, timeout = 20000) {
  const el = await waitFor(() => {
    const host = q<HTMLElement>(sel);
    // 锚点可能挂在外层容器上：点它里面真正的按钮
    const e = host && (host.matches('button, a, input') ? host : host.querySelector<HTMLElement>('button, a, input')) as HTMLButtonElement | null;
    return e && !e.disabled ? e : null;
  }, signal, timeout);
  el.scrollIntoView?.({ block: 'nearest' });
  el.click();
}
/** 给受控输入框填值（走 React 的 onChange） */
function fill(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
const phaseDone = (p: 'board' | 'connection' | 'build' | 'flash') => useLessonStore.getState().toolchain[p].status === 'done';

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'welcome', title: '① 主动迎接',
    narration: '进课时小铁猫先主动打招呼：说清楚它会一直「看着」连线图、程序和串口。下面每一步，都是真实界面上的真实操作。',
    run: async ({ code, signal }) => {
      const st = useLessonStore.getState();
      st.resetLesson(); st.setMockMode(true);
      useEditorStore.getState().setCode(code);
      await click('[data-testid="tab-code"]', signal).catch(() => {});
      await waitFor(() => q('[data-testid="agent-greeting"]'), signal, 4000).catch(() => {});
    },
  },
  {
    id: 'bug', title: '② 孩子手滑：删掉了一个分号',
    narration: '模拟一个最常见的第一课错误：Serial.begin(115200) 后面的「;」被删掉了。孩子自己通常看不出来。',
    run: async ({ code, signal }) => {
      useEditorStore.getState().setCode(code.replace('Serial.begin(115200);', 'Serial.begin(115200)'));
      await click('[data-lw-anchor="topbar.board"]', signal);
      await sleep(400, signal);
    },
  },
  {
    id: 'diagnose', title: '③ 感知报错 → 诊断 → 跳到那一行',
    narration: '编译器报的是「第 12 行 expected \';\'」。小铁猫知道少分号会被报在下一行，所以直接把孩子带到第 11 行，给出改前/改后和原因。展开「小铁猫是怎么想的」可以看到完整推理。',
    run: async ({ signal }) => {
      await click('[data-lw-anchor="topbar.compile"]', signal);
      await waitFor(() => q('[data-testid="fix-card"]'), signal);
      const d = await waitFor(() => q<HTMLDetailsElement>('[data-testid="fix-reasoning"]'), signal, 4000).catch(() => null);
      if (d) d.open = true;
    },
  },
  {
    id: 'fix', title: '④ 征得同意再改（可一键撤销）',
    narration: '孩子可以选「我自己改」（小铁猫会盯着、改对了庆祝），也可以选「帮我改」——必须再确认一次才动代码，改完随时能撤销。',
    run: async ({ signal }) => {
      await click('[data-testid="fix-apply"]', signal);
      await sleep(500, signal);
      await click('[data-testid="fix-confirm"]', signal);
      await waitFor(() => q('[data-testid="fix-applied"]'), signal, 4000).catch(() => {});
    },
  },
  {
    id: 'toolchain', title: '⑤ 连接 → 编译 → 烧录',
    narration: '工具链每走一步，小铁猫都有即时反应（处理中 / 成功 / 提醒）。这里用的是模拟设备；接真板子时流程完全一样。',
    run: async ({ signal }) => {
      await click('[data-lw-anchor="topbar.connect"]', signal);
      await waitFor(() => phaseDone('connection'), signal);
      await click('[data-lw-anchor="topbar.compile"]', signal);
      await waitFor(() => phaseDone('build'), signal);
      await click('[data-lw-anchor="topbar.flash"]', signal);
      await waitFor(() => phaseDone('flash'), signal, 40000);
    },
  },
  {
    id: 'observe', title: '⑥ 从串口自动认出「成功了」',
    narration: '小铁猫在读串口：一看到合理的温湿度读数，就自动判断主线完成——不需要孩子自己说“我好了”。',
    run: async ({ signal }) => {
      await waitFor(() => useLessonStore.getState().phenomenonSuccess, signal, 30000).catch(async () => { await click('[data-testid="confirm-phenomenon"]', signal); });
    },
  },
  {
    id: 'ask', title: '⑦ 提问 → 结合上下文回答 → 带我去',
    narration: '孩子问「DATA 线接哪里？」。回答会结合当前步骤、程序和串口（有 DeepSeek 时流式输出，没有时用本课知识库），并给出「带我去」按钮直接定位到连线图上的引脚。',
    run: async ({ signal }) => {
      if (!q('[data-testid="agent-chat"]')) await click('[data-testid="agent-summon"]', signal);
      const input = await waitFor(() => q<HTMLInputElement>('[data-testid="agent-chat"] input'), signal);
      fill(input, 'DATA 线接哪里？');
      await sleep(200, signal);
      await click('[data-testid="agent-chat"] button[type="submit"]', signal);
      const chip = await waitFor(() => q<HTMLButtonElement>('[data-testid="chat-goto-chip"]'), signal, 20000).catch(() => null);
      const tr = q<HTMLDetailsElement>('[data-testid="chat-trace"]:last-of-type');
      if (tr) tr.open = true;
      if (chip) { await sleep(1200, signal); chip.click(); }
    },
  },
  {
    id: 'growth', title: '⑧ 小练习 → 成长卡 → 推荐下一课',
    narration: '课后 3 道题 + 操作复核。成长卡根据答题、用时、提示次数和修错过程给 5 个维度打分，并推荐下一课——推荐的「排错小侦探」是真的可以直接去学的。',
    run: async ({ quiz, signal }) => {
      q<HTMLButtonElement>('[aria-label="收起聊天"]')?.click();
      await click('[data-testid="open-quiz"]', signal);
      const modal = await waitFor(() => q('[data-testid="quiz-modal"]'), signal);
      const sets = [...modal.querySelectorAll('fieldset')].filter((f) => f.querySelector('input[type=radio]'));
      for (let i = 0; i < sets.length; i++) {
        const radios = sets[i].querySelectorAll<HTMLInputElement>('input[type=radio]');
        radios[quiz.mcq[i]?.answerIndex ?? 0]?.click();
        await sleep(250, signal);
      }
      q<HTMLInputElement>('[data-testid="practical-check"]')?.click();
      await click('[data-testid="quiz-submit"]', signal);
      const rec = await waitFor(() => q('[data-testid="recommendations"]'), signal, 6000).catch(() => null);
      rec?.scrollIntoView?.({ block: 'center' });
    },
  },
];
