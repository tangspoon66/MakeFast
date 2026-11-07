/** 前端离线守卫 + FAQ（后端不可达时使用；规则与 backend/app/course_agent.py 保持一致）。 */
export type GuardCategory = 'on_topic' | 'off_topic' | 'injection' | 'unsafe';

const INJECTION = [/ignore (all |the )?(previous|above|prior) (instructions|prompts?)/i, /disregard (the )?(previous|above|system)/i, /(system|developer) prompt/i, /jailbreak/i, /pretend (you are|to be)/i, /\bact as\b/i,
  /(忽略|无视|忘掉|忘记).{0,8}(指令|指示|提示|规则|设定)/, /你现在是/, /扮演/, /系统提示/, /提示词/, /越狱/, /开发者模式/, /不受限制/];
const UNSAFE = [/自杀/, /自残/, /杀人/, /炸弹/, /爆炸物/, /毒品/, /色情/, /赌博/, /枪支/, /武器/, /\bkill\b/i, /\bbomb\b/i, /suicide/i, /porn/i];
const COURSE = ['xiao', 'esp32', '板', '芯片', 'dht', '温度', '湿度', '传感器', '蜂鸣器', 'buzzer', '引脚', 'gpio', 'd0', 'd1', '3v3', '5v', 'gnd', '电源', '电压', 'data', 'usb', 'boot', 'led', '电路', '接线', '连线', '线',
  '代码', '程序', '积木', 'arduino', 'setup', 'loop', 'serial', 'delay', '函数', '变量', '库', '分号', '报错', '错误', 'error', '编译', '烧录', '上传', '串口', '端口', '驱动', '连接', 'nan', '读数', '模拟模式',
  'makefast', '课程', '这一步', '下一步', '步骤', '第一课', '练习', '测验', '徽章', '连线图', '工作台', '小铁猫', '卡住', '提示', '做不出来'];
const OFF = ['作业', '数学题', '作文', '游戏', '王者', '原神', '我的世界', 'minecraft', '明星', '电影', '动画片', '股票', '政治', '翻译', '总统', '八卦', '笑话', '唱歌', '写诗', '吃什么', '谁是', '历史', '诗', '故事', '天空', '恐龙'];
const STRONG = ['dht', 'esp32', 'xiao', '编译', '烧录', '串口', '引脚', 'makefast', '连线图', '蜂鸣器'];

export function localGuard(msg: string, redirect = '看看现在这一步要做什么？'): { allowed: boolean; category: GuardCategory; reply?: string } {
  const low = msg.toLowerCase();
  if (INJECTION.some((r) => r.test(msg))) return { allowed: false, category: 'injection', reply: `嘿嘿，我只听课程的安排哦 🐱。我能帮你的是这节课的接线、程序、编译、烧录和串口问题。${redirect}` };
  if (UNSAFE.some((r) => r.test(msg))) return { allowed: false, category: 'unsafe', reply: `这个话题我不能聊哦。如果你遇到让你不舒服或危险的事，请马上告诉爸爸妈妈或老师。我们回到课程吧：${redirect}` };
  const on = COURSE.some((k) => low.includes(k)); const off = OFF.some((k) => low.includes(k));
  const refuse = `这个我不太懂哦，我是专门陪你上 MakeFast 课程的小铁猫 🐱。我们回到课程吧：${redirect}`;
  if (on && !off) return { allowed: true, category: 'on_topic' };
  if (on && off && STRONG.some((k) => low.includes(k))) return { allowed: true, category: 'on_topic' };
  return { allowed: false, category: 'off_topic', reply: refuse };
}

export interface FaqItem { q: string; a: string; keywords: string[] }
export function faqAnswer(msg: string, faq: FaqItem[]): string | null {
  const low = msg.toLowerCase(); let best: FaqItem | null = null; let bs = 0;
  for (const f of faq) { const s = f.keywords.filter((k) => low.includes(k.toLowerCase())).length * 2; if (s > bs) { bs = s; best = f; } }
  return best && bs >= 2 ? best.a : null;
}
