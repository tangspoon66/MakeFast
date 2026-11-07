import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { defineArduinoBlocks } from './arduinoBlocks';
import { generateArduinoCode } from './arduinoGenerator';
import { defineLessonBlocks, FIRST_LESSON_BLOCKS_XML, isFirstLessonProgram } from './lessonBlocks';
import { FIRST_LESSON_CODE } from '../lesson/firmware';
import { checkCodeAgainstGraph } from '../lesson/connectionGraph';
import { getBoard } from '../lesson/board';
import { FIRST_LESSON_CODE_BINDINGS, FIRST_LESSON_GRAPH } from '../lesson/coursePack';

describe('第一课积木', () => {
  it('识别第一课程序', () => {
    expect(isFirstLessonProgram(FIRST_LESSON_CODE)).toBe(true);
    expect(isFirstLessonProgram('void setup(){}')).toBe(false);
  });
  it('积木 XML 生成的代码与第一课程序等价，且与连线图一致', () => {
    defineArduinoBlocks(); defineLessonBlocks();
    const ws = new Blockly.Workspace();
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(FIRST_LESSON_BLOCKS_XML), ws);
    const code = generateArduinoCode(ws as unknown as Blockly.WorkspaceSvg);
    for (const s of ['#include <DHT.h>', '#define DHT_PIN 1', '#define DHT_TYPE DHT22', '#define BUZZER_PIN 2', 'DHT dht(DHT_PIN, DHT_TYPE);',
      'dht.begin();', 'pinMode(BUZZER_PIN, OUTPUT);', 'Serial.begin(115200);', 'float temperature = dht.readTemperature();',
      'float humidity = dht.readHumidity();', 'temperature > 30', 'digitalWrite(BUZZER_PIN, HIGH);', 'delay(2000);']) {
      expect(code).toContain(s);
    }
    expect(checkCodeAgainstGraph(code, FIRST_LESSON_GRAPH, getBoard('xiao-esp32-s3')!, FIRST_LESSON_CODE_BINDINGS)).toEqual([]);
    ws.dispose();
  });
});
