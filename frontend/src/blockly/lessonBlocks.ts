/**
 * 第一课专用积木（MakeFast 自研）：DHT22 温湿度 + 有源蜂鸣器。
 * 引脚下拉直接用 XIAO ESP32-S3 丝印（D0…D10），生成代码用 GPIO 编号，
 * 与 board.json / 连线图 / checkCodeAgainstGraph 的 #define 绑定一致。
 */
import * as Blockly from 'blockly';
import { arduinoGenerator } from './arduinoGenerator';

const ORDER_ATOMIC = 0;
export const XIAO_PIN_OPTIONS: [string, string][] = [
  ['D0', '1'], ['D1', '2'], ['D2', '3'], ['D3', '4'], ['D4', '5'], ['D5', '6'],
  ['D6', '43'], ['D7', '44'], ['D8', '7'], ['D9', '8'], ['D10', '9'],
];
const pinField = (def: string) => {
  const f = new Blockly.FieldDropdown(XIAO_PIN_OPTIONS);
  f.setValue(def);
  return f;
};

let defined = false;
export function defineLessonBlocks() {
  if (defined) return;
  defined = true;
  Blockly.Blocks['mf_dht_setup'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🌡️ 启动 DHT22 传感器，DATA 接').appendField(pinField('1'), 'PIN');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null);
      this.setColour(20); this.setTooltip('放在「初始化」里：告诉小板传感器接在哪个引脚，并让它开始工作');
    },
  };
  Blockly.Blocks['mf_dht_read_temp'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🌡️ 温度 (°C)');
      this.setOutput(true, 'Number'); this.setColour(20); this.setTooltip('DHT22 测到的温度，单位摄氏度');
    },
  };
  Blockly.Blocks['mf_dht_read_humi'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('💧 湿度 (%)');
      this.setOutput(true, 'Number'); this.setColour(20); this.setTooltip('DHT22 测到的相对湿度，单位 %');
    },
  };
  Blockly.Blocks['mf_buzzer_setup'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🔔 蜂鸣器接在').appendField(pinField('2'), 'PIN');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null);
      this.setColour(330); this.setTooltip('放在「初始化」里：把蜂鸣器引脚设为输出');
    },
  };
  Blockly.Blocks['mf_buzzer_on'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🔔 蜂鸣器').appendField(new Blockly.FieldDropdown([['响', 'HIGH'], ['停', 'LOW']]), 'STATE');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null);
      this.setColour(330); this.setTooltip('有源蜂鸣器：给高电平就响，低电平就停');
    },
  };
  Blockly.Blocks['mf_buzzer_beep'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🔔 嘀一声').appendField(new Blockly.FieldNumber(200, 20, 5000), 'MS').appendField('毫秒');
      this.setPreviousStatement(true, null); this.setNextStatement(true, null);
      this.setColour(330); this.setTooltip('响一下再停下来');
    },
  };

  arduinoGenerator.forBlock['mf_dht_setup'] = () => '  dht.begin();\n';
  arduinoGenerator.forBlock['mf_dht_read_temp'] = () => ['dht.readTemperature()', ORDER_ATOMIC];
  arduinoGenerator.forBlock['mf_dht_read_humi'] = () => ['dht.readHumidity()', ORDER_ATOMIC];
  arduinoGenerator.forBlock['mf_buzzer_setup'] = () => '  pinMode(BUZZER_PIN, OUTPUT);\n';
  arduinoGenerator.forBlock['mf_buzzer_on'] = (b: Blockly.Block) => `  digitalWrite(BUZZER_PIN, ${b.getFieldValue('STATE')});\n`;
  arduinoGenerator.forBlock['mf_buzzer_beep'] = (b: Blockly.Block) =>
    `  digitalWrite(BUZZER_PIN, HIGH);\n  delay(${b.getFieldValue('MS')});\n  digitalWrite(BUZZER_PIN, LOW);\n`;
}

/** 被 arduinoGenerator 的依赖收集调用：根据第一课积木补 #include / #define / 全局对象 */
export function lessonDependencies(blocks: Blockly.Block[], deps: { includes: Set<string>; globals: Set<string> }) {
  const first = (t: string) => blocks.find((b) => b.type === t);
  if (blocks.some((b) => b.type.startsWith('mf_dht_'))) {
    const pin = first('mf_dht_setup')?.getFieldValue('PIN') || '1';
    deps.includes.add('#include <DHT.h>');
    deps.globals.add(`#define DHT_PIN ${pin}`);
    deps.globals.add('#define DHT_TYPE DHT22');
    deps.globals.add('DHT dht(DHT_PIN, DHT_TYPE);');
  }
  if (blocks.some((b) => b.type.startsWith('mf_buzzer_'))) {
    const pin = first('mf_buzzer_setup')?.getFieldValue('PIN') || '2';
    deps.globals.add(`#define BUZZER_PIN ${pin}`);
  }
}

export const LESSON_TOOLBOX_CATEGORY = {
  kind: 'category', name: '⭐ 第一课', colour: '45',
  contents: [
    { kind: 'block', type: 'mf_dht_setup' },
    { kind: 'block', type: 'mf_dht_read_temp' },
    { kind: 'block', type: 'mf_dht_read_humi' },
    { kind: 'block', type: 'mf_buzzer_setup' },
    { kind: 'block', type: 'mf_buzzer_on' },
    { kind: 'block', type: 'mf_buzzer_beep' },
  ],
};

export { FIRST_LESSON_BLOCKS_XML, isFirstLessonProgram } from './lessonBlocksXml';
