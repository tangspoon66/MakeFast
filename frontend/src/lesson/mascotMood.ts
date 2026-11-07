/**
 * 吉祥物情绪 = f(Agent 状态机, 工具链事件, 引导步骤)。纯函数，便于单测。
 * 优先级：报错 > 正在处理 > 刚成功 > 串口聆听 > 状态机默认。
 */
import type { AgentState } from './agentMachine';
import type { MascotMood } from '../components/lesson/Mascot';

export interface MoodInput {
  state: AgentState;
  /** 连接/编译/烧录任一处于进行中 */
  busy?: boolean;
  /** 当前有报错（连接/编译/烧录/连线图阻断） */
  error?: boolean;
  /** 刚完成某一阶段（短暂庆祝） */
  justSucceeded?: boolean;
  /** 串口正在收数据 */
  listening?: boolean;
  /** 当前引导步骤类型：讲解型（看程序/认识作品）或操作型 */
  stepKind?: 'explain' | 'action';
}

export function mascotMood(i: MoodInput): MascotMood {
  if (i.state === 'IDLE') return 'idle';
  if (i.error) return 'warning';
  if (i.busy) return 'processing';
  if (i.state === 'WRAP_UP' || i.justSucceeded) return 'success';
  if (i.state === 'QUIET_HELP') return 'thinking';
  if (i.listening) return 'listening';
  return i.stepKind === 'explain' ? 'explaining' : 'guiding';
}
