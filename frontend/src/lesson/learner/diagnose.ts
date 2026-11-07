/** 困难自动诊断（R10 §17）：信号 → 类别 + 解决步骤 + 要按的按钮锚点。规则按优先级匹配，确定性。 */
import type { DifficultyCategory } from './types';

export interface DiagnoseInput {
  compileError?: string | null;
  flashError?: string | null;
  connectError?: string | null;
  wiringErrors?: number;
  serialNanCount?: number;
  rewireCount?: number;
  /** 在讲解型步骤停留过久 / 问“为什么” */
  conceptConfusion?: boolean;
  webSerialSupported?: boolean;
}

export interface Diagnosis {
  category: DifficultyCategory;
  confidence: number;
  title: string;
  steps: string[];
  /** data-lw-anchor：要指向的按钮/区域 */
  anchor: string;
  anchorLabel: string;
}

const RX = {
  library: /(No such file or directory|fatal error: .*\.h|DHT\.h|library not found|找不到库)/i,
  syntax: /(expected|was not declared|before|stray|undefined reference|does not name a type|missing|语法)/i,
  port: /(No port|NotFoundError|NetworkError|Failed to open|port is (busy|already open)|Access denied|not supported|串口|端口)/i,
  flash: /(Failed to connect to ESP32|timed out|Timeout|wrong boot mode|Invalid head of packet|烧录失败|bootloader)/i,
};

export const DIAGNOSIS_TEXT: Record<DifficultyCategory, Omit<Diagnosis, 'category' | 'confidence'>> = {
  wiring: {
    title: '接线可能有问题',
    steps: ['看「连线图」里标红的那根线', '对照高亮的引脚把线插到正确位置', '实在不确定就点「恢复课程推荐接法」'],
    anchor: 'wiring.panel', anchorLabel: '连线图',
  },
  syntax: {
    title: '程序里有一处写法不对',
    steps: ['看编译按钮下面的红色提示，找到出错的那一行', '检查是不是少了分号「;」或括号、名字拼错', '改好后再点一次「编译」'],
    anchor: 'topbar.compile', anchorLabel: '编译',
  },
  library: {
    title: '缺少传感器的「库」',
    steps: ['程序用到了 DHT 传感器库，编译服务器还没装好', '先打开顶栏的「模拟模式」继续体验', '请老师/管理员在后台安装「DHT sensor library」'],
    anchor: 'topbar.compile', anchorLabel: '编译',
  },
  port: {
    title: '电脑没连上小板',
    steps: ['确认用的是 Chrome 或 Edge 浏览器', '换一根能传数据的 USB 线，插紧', '关掉其他占用串口的软件，再点「连接」并选择小板'],
    anchor: 'topbar.connect', anchorLabel: '连接',
  },
  flash: {
    title: '程序没能装进小板',
    steps: ['按住小板上的 BOOT 键，同时插上 USB，再松开', '重新点「连接」，然后点「烧录」', '烧录时不要拔线'],
    anchor: 'topbar.flash', anchorLabel: '烧录',
  },
  concept: {
    title: '这一步的原理有点难',
    steps: ['先看步骤卡里的「为什么」', '点下面的推荐问题问问我', '不懂也没关系，先动手做，做完再回来看会更清楚'],
    anchor: 'guide.card', anchorLabel: '步骤卡',
  },
  unknown: {
    title: '我们一起看看',
    steps: ['再看一眼这一步的「现在做」', '点小铁猫问我具体哪里不懂'],
    anchor: 'agent.summon', anchorLabel: '小铁猫',
  },
};

export function classifyDifficulty(i: DiagnoseInput): { category: DifficultyCategory; confidence: number } {
  const ce = i.compileError || '';
  if (i.connectError || i.webSerialSupported === false) return { category: 'port', confidence: i.connectError && RX.port.test(i.connectError) ? 0.9 : 0.7 };
  if (i.flashError) return { category: RX.port.test(i.flashError) && !RX.flash.test(i.flashError) ? 'port' : 'flash', confidence: 0.85 };
  if (ce && RX.library.test(ce)) return { category: 'library', confidence: 0.95 };
  if ((i.wiringErrors || 0) > 0) return { category: 'wiring', confidence: 0.9 };
  if (ce && RX.syntax.test(ce)) return { category: 'syntax', confidence: 0.85 };
  if (ce) return { category: 'syntax', confidence: 0.5 };
  if ((i.serialNanCount || 0) >= 3 || (i.rewireCount || 0) >= 4) return { category: 'wiring', confidence: 0.75 };
  if (i.conceptConfusion) return { category: 'concept', confidence: 0.6 };
  return { category: 'unknown', confidence: 0.2 };
}

export function diagnose(i: DiagnoseInput): Diagnosis {
  const c = classifyDifficulty(i);
  return { ...c, ...DIAGNOSIS_TEXT[c.category] };
}
