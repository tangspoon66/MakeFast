/** 第一课积木 XML 与识别（不依赖 blockly 运行时，工作台首屏可直接用；blockly 本体按需加载） */
const txt = (t: string) => `<value name="TEXT"><block type="arduino_text"><field name="TEXT">${t}</field></block></value>`;
const varv = (n: string) => `<value name="TEXT"><block type="arduino_get_variable"><field name="NAME">${n}</field></block></value>`;
/** 把多个语句块串成 next 链：每个块的最外层闭合标签前插入下一个块 */
const chain = (xs: string[]): string => {
  if (!xs.length) return '';
  const [head, ...rest] = xs;
  if (!rest.length) return head;
  const cut = head.lastIndexOf('</block>');
  return `${head.slice(0, cut)}<next>${chain(rest)}</next></block>`;
};
const st = (inner: string) => inner;

/** 第一课程序的积木版本（与 FIRST_LESSON_CODE 等价） */
export const FIRST_LESSON_BLOCKS_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="arduino_setup" x="20" y="20"><statement name="SETUP">${chain([
  st('<block type="arduino_serial_begin" id="serial_begin"><field name="BAUD">115200</field></block>'),
  st('<block type="mf_buzzer_setup" id="buzzer_setup"><field name="PIN">2</field></block>'),
  st('<block type="mf_dht_setup" id="dht_setup"><field name="PIN">1</field></block>'),
  st(`<block type="arduino_serial_println">${txt('MakeFast first lesson ready')}</block>`),
])}</statement></block>
<block type="arduino_loop" x="20" y="230"><statement name="LOOP">${chain([
  st('<block type="arduino_declare_float"><field name="NAME">temperature</field><value name="VALUE"><block type="mf_dht_read_temp"></block></value></block>'),
  st('<block type="arduino_declare_float"><field name="NAME">humidity</field><value name="VALUE"><block type="mf_dht_read_humi"></block></value></block>'),
  st(`<block type="arduino_serial_print">${txt('Temp: ')}</block>`),
  st(`<block type="arduino_serial_print">${varv('temperature')}</block>`),
  st(`<block type="arduino_serial_print">${txt(' C, Humidity: ')}</block>`),
  st(`<block type="arduino_serial_print">${varv('humidity')}</block>`),
  st(`<block type="arduino_serial_println">${txt(' %')}</block>`),
  st('<block type="arduino_if" id="temp_check"><value name="CONDITION"><block type="arduino_compare"><field name="OP">&gt;</field><value name="A"><block type="arduino_get_variable"><field name="NAME">temperature</field></block></value><value name="B"><block type="arduino_number"><field name="NUM">30</field></block></value></block></value><statement name="DO"><block type="mf_buzzer_beep" id="buzzer_beep"><field name="MS">200</field></block></statement></block>'),
  st('<block type="arduino_delay" id="loop_delay"><field name="TIME">2000</field></block>'),
])}</statement></block>
</xml>`;

/** 判断代码是否为第一课程序（DHT + 蜂鸣器结构），可用积木版打开 */
export function isFirstLessonProgram(code: string): boolean {
  return /DHT\s+dht\s*\(/.test(code) && /BUZZER_PIN/.test(code) && /readTemperature/.test(code);
}
