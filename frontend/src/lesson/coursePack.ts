/**
 * 第一课课包（CoursePack，Data Model R6 §2.4）。
 * 硬件：Seeed XIAO ESP32-S3 + DHT22 模块（板载上拉电阻）+ 三线有源蜂鸣器模块。
 */
import { FIRST_LESSON_GUIDE } from './guideScript';
import { FIRST_LESSON_QUIZ } from './quiz';
import { FIRST_LESSON_CODE } from './firmware';
import type { CodePinBinding, ComponentDef, ConnectionGraph } from './connectionGraph';

export const FIRST_LESSON_COMPONENTS: ComponentDef[] = [
  {
    type: 'dht22', displayName: 'DHT22 温湿度传感器', emoji: '🌡️',
    ports: [
      { name: 'VCC', role: 'power', accepts: ['power_3v3', 'power_5v'], required: true, hint: '给传感器供电' },
      { name: 'DATA', role: 'signal', accepts: ['digital_in'], required: true, hint: '把温度湿度告诉小板（模块已带上拉电阻）' },
      { name: 'GND', role: 'gnd', accepts: ['gnd'], required: true, hint: '电流回家的路' },
    ],
  },
  {
    type: 'active_buzzer', displayName: '有源蜂鸣器', emoji: '🔔',
    ports: [
      { name: 'S', role: 'signal', accepts: ['digital_out'], required: true, hint: '高电平就响' },
      { name: 'VCC', role: 'power', accepts: ['power_3v3', 'power_5v'], required: true, hint: '给蜂鸣器供电' },
      { name: 'GND', role: 'gnd', accepts: ['gnd'], required: true, hint: '电流回家的路' },
    ],
  },
];

export const WIRE_COLORS = { power: '#E2595B', gnd: '#3D4B5C', signalA: '#F4B400', signalB: '#4A90C8' };

export const FIRST_LESSON_GRAPH: ConnectionGraph = {
  schemaVersion: '1.0',
  id: 'first-lesson-default',
  coursePackId: 'first-lesson',
  boardId: 'xiao-esp32-s3',
  nodes: [
    { id: 'board', kind: 'board', ref: 'xiao-esp32-s3', label: 'XIAO ESP32-S3' },
    { id: 'dht', kind: 'component', ref: 'dht22', label: 'DHT22' },
    { id: 'buzzer', kind: 'component', ref: 'active_buzzer', label: '蜂鸣器' },
  ],
  edges: [
    { id: 'dht-vcc', from: { nodeId: 'dht', port: 'VCC' }, to: { nodeId: 'board', port: '3V3' }, color: WIRE_COLORS.power },
    { id: 'dht-data', from: { nodeId: 'dht', port: 'DATA' }, to: { nodeId: 'board', port: 'D0' }, color: WIRE_COLORS.signalA },
    { id: 'dht-gnd', from: { nodeId: 'dht', port: 'GND' }, to: { nodeId: 'board', port: 'GND' }, color: WIRE_COLORS.gnd },
    { id: 'bz-s', from: { nodeId: 'buzzer', port: 'S' }, to: { nodeId: 'board', port: 'D1' }, color: WIRE_COLORS.signalB },
    { id: 'bz-vcc', from: { nodeId: 'buzzer', port: 'VCC' }, to: { nodeId: 'board', port: '3V3' }, color: WIRE_COLORS.power },
    { id: 'bz-gnd', from: { nodeId: 'buzzer', port: 'GND' }, to: { nodeId: 'board', port: 'GND' }, color: WIRE_COLORS.gnd },
  ],
  stepAnchors: [
    { id: 'dht', edgeIds: ['dht-vcc', 'dht-data', 'dht-gnd'], nodeIds: ['dht'] },
    { id: 'buzzer', edgeIds: ['bz-s', 'bz-vcc', 'bz-gnd'], nodeIds: ['buzzer'] },
  ],
};

export const FIRST_LESSON_CODE_BINDINGS: CodePinBinding[] = [
  { define: 'DHT_PIN', nodeId: 'dht', port: 'DATA' },
  { define: 'BUZZER_PIN', nodeId: 'buzzer', port: 'S' },
];

/** 改线：把某根线的板端换到另一个引脚（返回新图，不修改原图） */
export function rewire(graph: ConnectionGraph, edgeId: string, pinId: string): ConnectionGraph {
  return { ...graph, edges: graph.edges.map((e) => (e.id === edgeId ? { ...e, to: { ...e.to, port: pinId } } : e)) };
}

// ---- 完整课包（目录六要素 + 硬件 + 连线图 + 引导脚本 + 测验 + 程序） ----

export const FIRST_LESSON_PACK = {
  id: 'first-lesson',
  title: '温湿度小管家',
  coverUrl: null as string | null,
  starDifficulty: 1,
  tags: ['入门', 'ESP32'],
  category: '入门教程',
  badge: 'start_here' as const,
  boardId: 'xiao-esp32-s3',
  hardware: ['Seeed XIAO ESP32-S3', 'DHT22 温湿度模块（带上拉电阻）', '三线有源蜂鸣器模块', 'USB-C 数据线', '杜邦线 × 6'],
  components: FIRST_LESSON_COMPONENTS,
  connectionGraph: FIRST_LESSON_GRAPH,
  codeBindings: FIRST_LESSON_CODE_BINDINGS,
  guideScript: FIRST_LESSON_GUIDE,
  quiz: FIRST_LESSON_QUIZ,
  firmware: FIRST_LESSON_CODE,
};

/** 课包 FAQ（离线小助手知识库，R10 §11）。也随聊天请求发给后端。 */
export const FIRST_LESSON_FAQ: { q: string; a: string; keywords: string[] }[] = [
  { q: '编译是什么？', a: '编译就是把你写的程序翻译成芯片能看懂的 0 和 1 💡。翻译好之后，再「烧录」进小板。', keywords: ['编译', '翻译'] },
  { q: '烧录失败怎么办？', a: '1. 按住小板上的 BOOT 键再插 USB；2. 重新点「连接」；3. 再点「烧录」，过程中别拔线。', keywords: ['烧录', '上传', 'boot'] },
  { q: '连接不上小板？', a: '用 Chrome 或 Edge 浏览器，换一根能传数据的 USB 线，再点「连接」选择小板。没有硬件就打开「模拟模式」。', keywords: ['连接', '端口', '驱动', 'usb'] },
  { q: '串口显示 nan？', a: 'nan 表示没读到传感器 🤔。检查 DHT22 的 DATA 线是不是接在 D0，VCC 接 3V3，GND 接 GND。', keywords: ['nan', '读不到', '读数'] },
  { q: 'DATA 线接哪里？', a: 'DHT22 的 DATA 接 XIAO 的 D0（程序里 DHT_PIN 是 1，就是 GPIO1）。看看「连线图」里高亮的那根线。', keywords: ['data', '数据线', '接哪', '引脚'] },
  { q: '为什么接 3V3 不接 5V？', a: 'XIAO 的引脚是 3.3V 的，传感器也用 3.3V 供电最安全，读数也准 ⚡。', keywords: ['3v3', '5v', '电压', '电源'] },
  { q: '蜂鸣器不响？', a: '检查蜂鸣器 S 脚是否接 D1，VCC 接 3V3、GND 接 GND；程序里 BUZZER_PIN 要是 2（GPIO2）。', keywords: ['蜂鸣器', '不响'] },
  { q: '缺少 DHT.h？', a: '编译服务器还没装 DHT 库。先用「模拟模式」体验，并请老师在后台装「DHT sensor library」。', keywords: ['dht.h', 'no such file', '库'] },
  { q: '模拟模式是什么？', a: '没有硬件也能上课：打开顶栏「模拟模式」，连接/烧录/串口都会用虚拟小板演示 🐱。', keywords: ['模拟', '没有硬件'] },
];

/** 每步推荐问题（快捷 chips，R10 §6） */
export const STEP_SUGGESTIONS: Record<string, string[]> = {
  meet: ['DHT22 是什么？', '蜂鸣器有什么用？'],
  board: ['XIAO ESP32-S3 是什么？', '为什么要先选板子？'],
  'wire-dht': ['DATA 线接哪里？', '为什么接 3V3 不接 5V？'],
  'wire-buzzer': ['蜂鸣器怎么接？', '接错了会坏吗？'],
  program: ['setup 和 loop 有什么区别？', 'DHT_PIN 是什么意思？'],
  connect: ['连接不上小板？', '模拟模式是什么？'],
  compile: ['编译是什么？', '缺少 DHT.h？'],
  flash: ['烧录失败怎么办？', 'BOOT 键在哪里？'],
  observe: ['串口显示 nan？', '读数多久出现一次？'],
};
