/** 第一课三档 HTML 样例（图文：boards & components 真图） */
const BOARD = '/boards/xiao-esp32-s3';
const DHT = '/components/dht22/module.svg';
const BUZ = '/components/active-buzzer/module.svg';

function fig(src: string, caption: string) {
  return `<figure class="ca-figure"><img src="${src}" alt="${caption}" /><figcaption>${caption}</figcaption></figure>`;
}

function callout(tone: 'tip' | 'warn' | 'info', text: string) {
  const tag = tone === 'warn' ? '注意' : tone === 'info' ? '提示' : '小贴士';
  return `<aside class="ca-callout ca-callout--${tone}" data-callout="${tone}"><span class="ca-callout__tag">${tag}</span><p>${text}</p></aside>`;
}

function gallery(items: { src: string; caption: string }[]) {
  const cards = items.map((i) =>
    `<figure class="ca-figure ca-figure--card"><img src="${i.src}" alt="${i.caption}" /><figcaption>${i.caption}</figcaption></figure>`).join('');
  return `<div class="ca-gallery">${cards}</div>`;
}

function bili(bvid: string, title: string) {
  return `<div class="ca-bilibili" data-bilibili="${bvid}" data-title="${title}"><div class="ca-bilibili__ph"><strong>B 站视频位</strong><span>${title}</span><code>bvid=${bvid}</code></div></div>`;
}

export const FIRST_LESSON_DOCS = {
  low: `
<h2>今天做什么</h2>
${fig(`${BOARD}/cover.webp`, '做好以后：小板会告诉你冷热干湿')}
<p>我们要做一个小管家：它能感觉空气热不热、潮不潮。太热时，它会“嘀”一声提醒你。</p>
${callout('info', '没有板子也没关系！打开「模拟模式」一样能玩完全程。')}
<h2>需要哪些零件</h2>
<h3>三件好朋友</h3>
${gallery([
  { src: `${BOARD}/photo.webp`, caption: '小脑袋：XIAO 板' },
  { src: DHT, caption: '眼睛：温湿度传感器' },
  { src: BUZ, caption: '嘴巴：蜂鸣器' },
])}
<p>再加几根杜邦线，像给它们握手一样接起来。</p>
${fig(`${BOARD}/pinout-front.webp`, '板子正面：左右两边都有小脚（引脚）')}
<h2>先看一看</h2>
<p>下面有个视频位。老师放好后，你可以先看一遍，再动手。看不懂也没关系，小铁猫会在创作时带你。</p>
${callout('tip', '看视频时注意：黄线接传感器，蓝线接蜂鸣器。')}
${bili('BV1xx411c7mD', '（占位）第一课实操导览')}
<h2>然后呢</h2>
<p>准备好了，点右下角「开始创作」。小铁猫会一步步陪你接线、写程序、看串口。</p>
${callout('tip', '卡住了就点小铁猫提问，它会带你到出问题的地方。')}
`.trim(),

  mid: `
<h2>作品目标</h2>
${fig(`${BOARD}/photo.webp`, '成品示意：XIAO + DHT22 + 蜂鸣器')}
<p>做出一个温湿度提醒器：每 2 秒读一次 DHT22，串口打印读数；温度超过阈值时蜂鸣器短响。</p>
${callout('info', '没有硬件可用「模拟模式」完整体验编译 / 烧录 / 串口。')}
<h2>材料清单</h2>
${gallery([
  { src: `${BOARD}/cover.webp`, caption: 'Seeed XIAO ESP32-S3' },
  { src: DHT, caption: 'DHT22 温湿度模块' },
  { src: BUZ, caption: '有源蜂鸣器' },
])}
<p>另需：杜邦线、USB-C 数据线。接线时 DATA→D0，蜂鸣器 S→D1，共地并接 3V3。</p>
${fig(`${BOARD}/pinout-front.webp`, '正面引脚：D0 / D1 在右侧')}
${callout('warn', '有源蜂鸣器自带振荡，高电平即可响；无源的需要 PWM。')}
<h2>视频导览</h2>
<p>建议先看接线与现象，再进工作台。B 站稿件由老师替换。</p>
${bili('BV1xx411c7mD', '（占位）第一课实操导览')}
<h2>进入创作</h2>
<p>点「开始创作」打开课程工作台。小铁猫会按步骤引导接线、编译、烧录与观察。</p>
`.trim(),

  high: `
<h2>目标与数据流</h2>
${fig(`${BOARD}/photo.webp`, '硬件总览')}
<p>传感器（输入）→ MCU 处理 → 串口 / 蜂鸣器（输出）。阈值：T &gt; 30°C。</p>
${callout('info', '数据流：DHT22 单总线 → GPIO1(D0) → 逻辑判断 → GPIO2(D1) 驱动有源蜂鸣器。')}
<h2>BOM</h2>
${gallery([
  { src: `${BOARD}/board.svg`, caption: 'XIAO ESP32-S3（USB-C）' },
  { src: DHT, caption: 'DHT22 DATA→D0/GPIO1' },
  { src: BUZ, caption: '有源蜂鸣器 S→D1/GPIO2' },
])}
${fig(`${BOARD}/pinout-front.webp`, '引脚正面')}
${fig(`${BOARD}/pinout-back.webp`, '引脚背面（核对丝印）')}
<p>供电：3V3 / GND 共网。杜邦线尽量短，避免 DHT 读数抖动。</p>
<h2>参考视频</h2>
<p>Bilibili 占位（bvid 可在后台文章编辑器替换）。</p>
${bili('BV1xx411c7mD', '（占位）第一课实操导览')}
<h2>开始创作</h2>
<p>进入工作台完成接线校验、固件编译烧录与串口验证。</p>
`.trim(),
};
