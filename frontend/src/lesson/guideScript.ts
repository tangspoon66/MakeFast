/**
 * GuideStep（Data Model R6 §2.5）：每步都有 现在做 / 为什么 / 成功时。
 * 课内零测验（F-AGT-02 / F-QZ-04）：这里只有说明，没有任何题目。
 */

/** 页面里可被高亮的锚点（data-lw-anchor） */
export type GuideHighlight =
  | 'wiring.panel' | 'topbar.board' | 'topbar.connect' | 'topbar.compile' | 'topbar.flash'
  | 'editor' | 'serial' | 'phenomenon';

export interface GuideStep {
  id: string;
  order: number;
  title: string;
  do: string;
  why: string;
  success: string;
  highlight: GuideHighlight;
  /** 连线图里需要高亮的连线 id（ConnectionGraph.stepAnchors） */
  wiringAnchor?: string;
  /** 到达哪个工具链状态时，这一步自动算完成 */
  completesWhen?: 'board' | 'connection' | 'build' | 'flash' | 'phenomenon';
  /** explain = 讲解型（吉祥物进入「讲解」）；默认 action = 操作指引 */
  kind?: 'explain' | 'action';
}

export const FIRST_LESSON_GUIDE: GuideStep[] = [
  {
    id: 'meet', order: 1, title: '认识今天的作品',
    do: '看看右边的「连线图」：一块 XIAO ESP32-S3 小板、一个 DHT22 温湿度传感器、一个蜂鸣器。',
    why: '先知道每个零件是干什么的，后面接线和写程序时就不会迷路。',
    success: '你能指出哪个是“眼睛”（传感器）、哪个是“嘴巴”（蜂鸣器）。',
    highlight: 'wiring.panel', kind: 'explain',
  },
  {
    id: 'board', order: 2, title: '确认开发板',
    do: '看左上角的板型，确认是「XIAO ESP32-S3」，然后点一下它确认。',
    why: '电脑要知道你用的是哪块板，才能把程序翻译成它听得懂的语言。',
    success: '板型按钮出现绿色的 ✓。',
    highlight: 'topbar.board', completesWhen: 'board',
  },
  {
    id: 'wire-dht', order: 3, title: '接上温湿度传感器',
    do: '先拔掉 USB。按连线图把 DHT22 的 VCC 接 3V3、GND 接 GND、DATA 接 D0。',
    why: '传感器需要电（3V3 和 GND）才能工作，DATA 线负责把测到的温度湿度告诉小板。拔掉 USB 再接线更安全。',
    success: '三根线都插紧，颜色和连线图一致。',
    highlight: 'wiring.panel', wiringAnchor: 'dht',
  },
  {
    id: 'wire-buzzer', order: 4, title: '接上蜂鸣器',
    do: '把蜂鸣器的 S（信号）接 D1，VCC 接 3V3，GND 接 GND。',
    why: '小板给 D1 一个“高电平”，蜂鸣器就会响——它就是作品的提醒声音。',
    success: '蜂鸣器的三根线都接好，没有和传感器的线插在同一个孔里（3V3 / GND 可以共用）。',
    highlight: 'wiring.panel', wiringAnchor: 'buzzer',
  },
  {
    id: 'program', order: 5, title: '看看程序',
    do: '在中间的「积木 / 代码」里看看程序：每 2 秒读一次温湿度，太热就让蜂鸣器“嘀”一声。',
    why: '程序就是给小板的说明书。先看懂它在做什么，等会儿看到现象就知道为什么。',
    success: '你找到了“读温度”“打印到串口”“蜂鸣器响”这几块。',
    highlight: 'editor', kind: 'explain',
  },
  {
    id: 'connect', order: 6, title: '连接设备',
    do: '用能传数据的 USB 线把小板接到电脑，然后点顶栏的「连接」，在弹窗里选中你的板子。',
    why: '浏览器要先和小板“握手”，才能把程序送进去、再把它说的话读回来。',
    success: '「连接」按钮变成绿色的 ✓ 已连接。没有板子也可以打开「模拟模式」体验。',
    highlight: 'topbar.connect', completesWhen: 'connection',
  },
  {
    id: 'compile', order: 7, title: '编译程序',
    do: '点顶栏的「编译」。',
    why: '编译就是把我们看得懂的程序，翻译成小板芯片能执行的 0 和 1。',
    success: '「编译」变成绿色的 ✓，下方串口区显示“编译成功”。',
    highlight: 'topbar.compile', completesWhen: 'build',
  },
  {
    id: 'flash', order: 8, title: '烧录到小板',
    do: '点最右边黄色的「烧录」，等进度走完。烧录时不要拔线。',
    why: '烧录就是把翻译好的程序写进小板的“记忆”里，断电后它也记得。',
    success: '进度到 100%，「烧录」变成绿色的 ✓，小板自动重启。',
    highlight: 'topbar.flash', completesWhen: 'flash',
  },
  {
    id: 'observe', order: 9, title: '看见温度和湿度',
    do: '看底部串口：每 2 秒会出现一行“温度 … 湿度 …”。对着传感器轻轻哈口气试试！',
    why: '这是小板通过 USB 在跟你说话——数字变了，说明传感器真的在测你身边的空气。',
    success: '串口出现温湿度读数（系统会自动认出来），或你点「我看到了 / 听到了」。',
    highlight: 'serial', completesWhen: 'phenomenon',
  },
];

export const WRAP_UP_MESSAGE = {
  title: '主线完成！你做出了第一个会感知环境的作品 🎉',
  body: '你刚刚走完了真正工程师的流程：接线 → 写程序 → 编译 → 烧录 → 看现象。现在可以做「课后小练习」巩固一下，答完还能拿徽章。',
};

/** 工具链事件 → Agent 即时反应（儿童语言，F-AGT-03：对编译/烧录/串口事件做出反应） */
export type ToolchainEvent =
  | 'connect.start' | 'connect.done' | 'compile.start' | 'compile.done' | 'flash.start' | 'flash.done'
  | 'serial.listening' | 'phenomenon' | 'error';

export const EVENT_REACTIONS: Record<ToolchainEvent, { text: string; tone: 'info' | 'success' | 'warning' }> = {
  'connect.start': { text: '我在找你的小板，弹窗里选中它就好～', tone: 'info' },
  'connect.done': { text: '连上啦！电脑和小板现在能“说话”了。', tone: 'success' },
  'compile.start': { text: '正在把程序翻译成小板听得懂的语言…', tone: 'info' },
  'compile.done': { text: '编译成功！程序没有语法错误。下一步把它烧录进小板。', tone: 'success' },
  'flash.start': { text: '正在把程序搬进小板，别拔 USB 哦。', tone: 'info' },
  'flash.done': { text: '烧录完成！小板开始运行你的程序了，看看下面的串口。', tone: 'success' },
  'serial.listening': { text: '我在听小板说话…温度和湿度马上出现。', tone: 'info' },
  phenomenon: { text: '读到真实数据啦，你做到了！🎉', tone: 'success' },
  error: { text: '遇到一点小问题，别担心，点我看看怎么改。', tone: 'warning' },
};
