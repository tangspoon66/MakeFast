/**
 * 第二课「排错小侦探：读懂报错」——和第一课同一套硬件、同一张连线图，
 * 但程序里藏了 3 个常见 bug。主角是小铁猫的「感知 → 诊断 → 带你到出错那一行 → 修好 → 复盘」。
 */
import type { GuideStep } from './guideScript';
import type { QuizSpec } from './quiz';

/** 3 个 bug：第 11 行少分号；第 4 行 DHT_PIN 写成 2（和蜂鸣器撞了，连线图里 DATA 在 D0=GPIO1）；第 19 行函数名拼错 */
export const DEBUG_DETECTIVE_CODE = `#include <DHT.h>

// 侦探任务：这段程序藏了 3 个 bug，编译一下，跟着小铁猫一个个找出来！
#define DHT_PIN 2
#define DHT_TYPE DHT22
#define BUZZER_PIN 2

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200)
  pinMode(BUZZER_PIN, OUTPUT);
  dht.begin();
  Serial.println("MakeFast detective ready");
}

void loop() {
  float temperature = dht.readTemprature();
  float humidity = dht.readHumidity();

  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print(" C, Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  if (temperature > 30) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
  }

  delay(2000);
}
`;

export const DEBUG_DETECTIVE_GUIDE: GuideStep[] = [
  {
    id: 'dd-mission', order: 1, title: '接下侦探任务',
    do: '这节课的程序里藏了 3 个 bug。不用怕报错——报错就是程序留下的「线索」。',
    why: '真正的工程师每天都在读报错。学会读线索，以后遇到问题就能自己解决。',
    success: '你知道这节课要找 3 个 bug。',
    highlight: 'editor', kind: 'explain',
  },
  {
    id: 'board', order: 2, title: '确认开发板',
    do: '确认左上角是「XIAO ESP32-S3」，点一下它。',
    why: '编译器要知道是哪块板，才能按它的规则检查程序。',
    success: '板型按钮出现绿色的 ✓。',
    highlight: 'topbar.board', completesWhen: 'board',
  },
  {
    id: 'dd-clue', order: 3, title: '编译，收集线索',
    do: '点「编译」。编译器会说「第几行、哪里不对」，小铁猫会带你跳到那一行。',
    why: '编译器就像侦探的放大镜：它会指出第一个看不懂的地方。',
    success: '修好所有 bug 后，「编译」变成绿色的 ✓。',
    highlight: 'topbar.compile', completesWhen: 'build',
  },
  {
    id: 'connect', order: 4, title: '连接设备',
    do: '点「连接」（没有板子就打开「模拟模式」）。',
    why: '程序修好了，要送进小板才算破案。',
    success: '「连接」变成 ✓ 已连接。',
    highlight: 'topbar.connect', completesWhen: 'connection',
  },
  {
    id: 'flash', order: 5, title: '烧录',
    do: '点黄色的「烧录」，等进度走完。',
    why: '把修好的程序写进小板。',
    success: '「烧录」变成绿色的 ✓。',
    highlight: 'topbar.flash', completesWhen: 'flash',
  },
  {
    id: 'dd-observe', order: 6, title: '验证破案',
    do: '看串口：温度和湿度又出现了，就说明 3 个 bug 都修好了。',
    why: '「看到现象」是检验修复的最终证据。',
    success: '串口出现温湿度读数，或你点「我看到了 / 听到了」。',
    highlight: 'serial', completesWhen: 'phenomenon',
  },
];

export const DEBUG_DETECTIVE_QUIZ: QuizSpec = {
  mcq: [
    {
      id: 'dq-semicolon', prompt: '编译器说「expected \';\' before …」，最可能是哪里错了？',
      choices: ['上一行末尾少了分号', '小板没插好', '传感器坏了', '要换一个浏览器'], answerIndex: 0, skill: 'debugging', expectedSec: 20,
      explain: '编译器发现“这一句还没结束，下一句就开始了”，所以常常把少分号报在下一行。先看上一行的末尾。',
    },
    {
      id: 'dq-typo', prompt: '「has no member named \'readTemprature\'」说明什么？',
      choices: ['温度太高了', '函数名拼错了，应该是 readTemperature', '要多等一会儿', '缺少电源线'], answerIndex: 1, skill: 'programming', expectedSec: 20,
      explain: '编译器不认识这个名字——多半是拼错了。对照正确的拼写改过来就好。',
    },
    {
      id: 'dq-pin', prompt: 'DHT_PIN 和 BUZZER_PIN 都写成 2，会怎么样？',
      choices: ['没关系', '传感器和蜂鸣器抢同一个引脚，读不到温度', '蜂鸣器会更响', '小板会变快'], answerIndex: 1, skill: 'wiring', expectedSec: 20, difficulty: 2,
      explain: '程序里的引脚号要和连线图一致：DATA 线接在 D0（GPIO1），所以 DHT_PIN 应该是 1。',
    },
  ],
  practical: { id: 'dp-observe', prompt: '操作复核：修好之后，我亲眼在串口看到了温湿度读数。', kind: 'serial_temp_seen' },
  passRule: { mcqCorrectMin: 2, practicalRequired: true },
};

export const DEBUG_DETECTIVE_FAQ: { q: string; a: string; keywords: string[] }[] = [
  { q: '报错看不懂怎么办？', a: '先只看第一条报错：它说「第几行」和「哪里不对」。点小铁猫给的「带我去」，它会带你跳到那一行。', keywords: ['报错', '看不懂', 'error'] },
  { q: '为什么报错的行号不对？', a: '少分号时，编译器常常把错误报在下一行——它是读到下一句才发现上一句没结束。看看上一行的末尾。', keywords: ['行号', '不对', '下一行'] },
  { q: '引脚号写几？', a: '看连线图：DHT22 的 DATA 接 D0，D0 就是 GPIO1，所以 DHT_PIN 写 1；蜂鸣器 S 接 D1（GPIO2），BUZZER_PIN 写 2。', keywords: ['引脚', 'pin', 'gpio', '几'] },
];
