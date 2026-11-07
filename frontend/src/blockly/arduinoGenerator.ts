/**
 * Arduino 代码生成器
 * 将 Blockly 积木块转换为 Arduino C++ 代码
 */

import * as Blockly from 'blockly';
import { lessonDependencies } from './lessonBlocks';

// 创建 Arduino 代码生成器
export const arduinoGenerator = new Blockly.Generator('Arduino');

// 修复：基类 scrub_ 不会串接 next 语句块，导致积木里只有每段的第一块被生成代码
arduinoGenerator.scrub_ = function(block, code, thisOnly) {
  const next = block.nextConnection && block.nextConnection.targetBlock();
  if (next && !thisOnly) return code + arduinoGenerator.blockToCode(next);
  return code;
};

// 定义操作符优先级常量
const ORDER_ATOMIC = 0;
const ORDER_MULTIPLICATIVE = 5;
const ORDER_ADDITIVE = 6;
const ORDER_RELATIONAL = 8;
const ORDER_EQUALITY = 9;
const ORDER_LOGICAL_AND = 13;
const ORDER_LOGICAL_OR = 14;
const ORDER_NONE = 99;

type DependencyBundle = {
  includes: Set<string>;
  globals: Set<string>;
  helpers: Set<string>;
};

const addCommonDependencies = (workspace: Blockly.WorkspaceSvg): DependencyBundle => {
  const deps: DependencyBundle = {
    includes: new Set(),
    globals: new Set(),
    helpers: new Set(),
  };

  const blocks = workspace.getAllBlocks(false);
  const hasType = (type: string) => blocks.some(block => block.type === type);
  const firstBlock = (type: string) => blocks.find(block => block.type === type);

  if (hasType('arduino_wifi_begin') || hasType('arduino_wifi_status') || hasType('arduino_wifi_wait_connected') || hasType('arduino_wifi_local_ip')) {
    deps.includes.add('#include <WiFi.h>');
  }

  if (hasType('arduino_http_get')) {
    deps.includes.add('#include <WiFi.h>');
    deps.includes.add('#include <HTTPClient.h>');
  }

  if (hasType('arduino_mqtt_setup') || hasType('arduino_mqtt_connect') || hasType('arduino_mqtt_publish') || hasType('arduino_mqtt_subscribe') || hasType('arduino_mqtt_loop')) {
    deps.includes.add('#include <WiFi.h>');
    deps.includes.add('#include <PubSubClient.h>');
    deps.globals.add('WiFiClient wifiClient;');
    deps.globals.add('PubSubClient mqttClient(wifiClient);');
  }

  if (hasType('arduino_preferences_begin') || hasType('arduino_preferences_put_string') || hasType('arduino_preferences_get_string') || hasType('arduino_preferences_put_int') || hasType('arduino_preferences_get_int')) {
    deps.includes.add('#include <Preferences.h>');
    deps.globals.add('Preferences preferences;');
  }

  if (hasType('arduino_deep_sleep_timer')) {
    deps.includes.add('#include <esp_sleep.h>');
  }

  lessonDependencies(blocks, deps);

  if (hasType('arduino_dht_begin') || hasType('arduino_dht_read_temp') || hasType('arduino_dht_read_humidity')) {
    const block = firstBlock('arduino_dht_begin');
    const pin = block?.getFieldValue('PIN') || '4';
    const type = block?.getFieldValue('TYPE') || 'DHT11';
    deps.includes.add('#include <DHT.h>');
    deps.globals.add(`#define DHT_PIN ${pin}`);
    deps.globals.add(`#define DHT_TYPE ${type}`);
    deps.globals.add('DHT dht(DHT_PIN, DHT_TYPE);');
  }

  if (hasType('arduino_servo_attach') || hasType('arduino_servo_write')) {
    deps.includes.add('#include <ESP32Servo.h>');
    deps.globals.add('Servo myServo;');
  }

  if (hasType('arduino_stepper_setup') || hasType('arduino_stepper_speed') || hasType('arduino_stepper_step')) {
    const block = firstBlock('arduino_stepper_setup');
    const steps = block?.getFieldValue('STEPS') || '2048';
    const pin1 = block?.getFieldValue('PIN1') || '8';
    const pin2 = block?.getFieldValue('PIN2') || '9';
    const pin3 = block?.getFieldValue('PIN3') || '10';
    const pin4 = block?.getFieldValue('PIN4') || '11';
    deps.includes.add('#include <Stepper.h>');
    deps.globals.add(`Stepper myStepper(${steps}, ${pin1}, ${pin2}, ${pin3}, ${pin4});`);
  }

  if (hasType('arduino_oled_begin') || hasType('arduino_oled_clear') || hasType('arduino_oled_print') || hasType('arduino_oled_display') || hasType('arduino_oled_set_text_size')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <Adafruit_GFX.h>');
    deps.includes.add('#include <Adafruit_SSD1306.h>');
    deps.globals.add('#define SCREEN_WIDTH 128');
    deps.globals.add('#define SCREEN_HEIGHT 64');
    deps.globals.add('Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);');
  }

  if (hasType('arduino_neopixel_begin') || hasType('arduino_neopixel_set_color') || hasType('arduino_neopixel_show') || hasType('arduino_neopixel_clear') || hasType('arduino_neopixel_brightness')) {
    const block = firstBlock('arduino_neopixel_begin');
    const pin = block?.getFieldValue('PIN') || '5';
    const count = block?.getFieldValue('COUNT') || '8';
    deps.includes.add('#include <Adafruit_NeoPixel.h>');
    deps.globals.add(`Adafruit_NeoPixel strip(${count}, ${pin}, NEO_GRB + NEO_KHZ800);`);
  }

  if (hasType('arduino_bmp280_temp') || hasType('arduino_bmp280_pressure') || hasType('arduino_bmp280_altitude')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <Adafruit_BMP280.h>');
    deps.globals.add('Adafruit_BMP280 bmp;');
  }

  if (hasType('arduino_bme280_begin') || hasType('arduino_bme280_temp') || hasType('arduino_bme280_humidity') || hasType('arduino_bme280_pressure')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <Adafruit_BME280.h>');
    deps.globals.add('Adafruit_BME280 bme;');
  }

  if (hasType('arduino_lcd_begin') || hasType('arduino_lcd_clear') || hasType('arduino_lcd_print') || hasType('arduino_lcd_backlight')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <LiquidCrystal_I2C.h>');
    deps.globals.add('LiquidCrystal_I2C lcd(0x27, 16, 2);');
  }

  if (hasType('arduino_bh1750_begin') || hasType('arduino_bh1750_read')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <BH1750.h>');
    deps.globals.add('BH1750 lightMeter;');
  }

  if (hasType('arduino_aht20_begin') || hasType('arduino_aht20_temp') || hasType('arduino_aht20_humidity')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <Adafruit_AHTX0.h>');
    deps.globals.add('Adafruit_AHTX0 aht;');
    deps.globals.add('sensors_event_t ahtHumidity, ahtTemp;');
    deps.helpers.add(`void updateAHT20() {
  aht.getEvent(&ahtHumidity, &ahtTemp);
}`);
  }

  if (hasType('arduino_sht31_begin') || hasType('arduino_sht31_temp') || hasType('arduino_sht31_humidity')) {
    const block = firstBlock('arduino_sht31_begin');
    const addr = block?.getFieldValue('ADDR') || '0x44';
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <Adafruit_SHT31.h>');
    deps.globals.add('Adafruit_SHT31 sht31 = Adafruit_SHT31();');
    deps.globals.add(`const uint8_t SHT31_ADDR = ${addr};`);
  }

  if (hasType('arduino_ds18b20_begin') || hasType('arduino_ds18b20_temp')) {
    const block = firstBlock('arduino_ds18b20_begin');
    const pin = block?.getFieldValue('PIN') || '4';
    deps.includes.add('#include <OneWire.h>');
    deps.includes.add('#include <DallasTemperature.h>');
    deps.globals.add(`OneWire oneWire(${pin});`);
    deps.globals.add('DallasTemperature ds18b20(&oneWire);');
  }

  if (hasType('arduino_tcs34725_begin') || hasType('arduino_tcs34725_read')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <Adafruit_TCS34725.h>');
    deps.globals.add('Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);');
    deps.globals.add('uint16_t tcsR = 0, tcsG = 0, tcsB = 0, tcsC = 0;');
    deps.helpers.add(`void updateTCS34725() {
  tcs.getRawData(&tcsR, &tcsG, &tcsB, &tcsC);
}`);
  }

  if (hasType('arduino_gps_begin') || hasType('arduino_gps_update') || hasType('arduino_gps_value')) {
    const block = firstBlock('arduino_gps_begin');
    const rx = block?.getFieldValue('RX') || '16';
    const tx = block?.getFieldValue('TX') || '17';
    deps.includes.add('#include <TinyGPSPlus.h>');
    deps.globals.add('TinyGPSPlus gps;');
    deps.globals.add('HardwareSerial gpsSerial(1);');
    deps.globals.add(`const int GPS_RX = ${rx};`);
    deps.globals.add(`const int GPS_TX = ${tx};`);
  }

  if (hasType('arduino_hx711_begin') || hasType('arduino_hx711_read') || hasType('arduino_hx711_tare')) {
    const block = firstBlock('arduino_hx711_begin');
    const dout = block?.getFieldValue('DOUT') || '16';
    const sck = block?.getFieldValue('SCK') || '17';
    deps.includes.add('#include <HX711.h>');
    deps.globals.add('HX711 scale;');
    deps.globals.add(`const int HX711_DOUT = ${dout};`);
    deps.globals.add(`const int HX711_SCK = ${sck};`);
  }

  if (hasType('arduino_rc522_begin') || hasType('arduino_rc522_card_available') || hasType('arduino_rc522_uid')) {
    const block = firstBlock('arduino_rc522_begin');
    const ss = block?.getFieldValue('SS') || '5';
    const rst = block?.getFieldValue('RST') || '22';
    deps.includes.add('#include <SPI.h>');
    deps.includes.add('#include <MFRC522.h>');
    deps.globals.add(`MFRC522 rfid(${ss}, ${rst});`);
  }

  if (hasType('arduino_littlefs_begin') || hasType('arduino_littlefs_write') || hasType('arduino_littlefs_read')) {
    deps.includes.add('#include <LittleFS.h>');
    deps.helpers.add(`String readLittleFSFile(const char* path) {
  File file = LittleFS.open(path, "r");
  if (!file) return "";
  String content = file.readString();
  file.close();
  return content;
}

void writeLittleFSFile(const char* path, const String& text) {
  File file = LittleFS.open(path, "w");
  if (!file) return;
  file.print(text);
  file.close();
}`);
  }

  if (hasType('arduino_sd_begin') || hasType('arduino_sd_write') || hasType('arduino_sd_read')) {
    deps.includes.add('#include <SPI.h>');
    deps.includes.add('#include <SD.h>');
    deps.helpers.add(`String readSDFile(const char* path) {
  File file = SD.open(path, FILE_READ);
  if (!file) return "";
  String content = file.readString();
  file.close();
  return content;
}

void writeSDFile(const char* path, const String& text) {
  File file = SD.open(path, FILE_WRITE);
  if (!file) return;
  file.print(text);
  file.close();
}`);
  }

  if (hasType('arduino_espnow_begin') || hasType('arduino_espnow_send')) {
    deps.includes.add('#include <WiFi.h>');
    deps.includes.add('#include <esp_now.h>');
    deps.helpers.add(`void parseMacAddress(const char* text, uint8_t mac[6]) {
  unsigned int values[6] = {0, 0, 0, 0, 0, 0};
  sscanf(text, "%x:%x:%x:%x:%x:%x", &values[0], &values[1], &values[2], &values[3], &values[4], &values[5]);
  for (int i = 0; i < 6; i++) mac[i] = (uint8_t)values[i];
}

void ensureEspNowPeer(const uint8_t mac[6]) {
  if (esp_now_is_peer_exist(mac)) return;
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, mac, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);
}`);
  }

  if (hasType('arduino_ble_uart_begin') || hasType('arduino_ble_uart_notify')) {
    deps.includes.add('#include <BLEDevice.h>');
    deps.includes.add('#include <BLEServer.h>');
    deps.includes.add('#include <BLEUtils.h>');
    deps.includes.add('#include <BLE2902.h>');
    deps.globals.add('BLECharacteristic* bleTxCharacteristic = nullptr;');
    deps.globals.add('const char* BLE_UART_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";');
    deps.globals.add('const char* BLE_UART_TX_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";');
  }

  if (hasType('arduino_mpu6050_read')) {
    deps.includes.add('#include <Wire.h>');
    deps.includes.add('#include <MPU6050.h>');
    deps.globals.add('MPU6050 mpu;');
  }

  if (hasType('arduino_ir_begin') || hasType('arduino_ir_available') || hasType('arduino_ir_read') || hasType('arduino_ir_resume') || hasType('arduino_ir_send')) {
    deps.includes.add('#include <IRremote.h>');
    deps.globals.add('IRrecv irrecv(15);');
    deps.globals.add('IRsend irsend;');
    deps.globals.add('decode_results results;');
  }

  const ultrasonicBlocks = blocks.filter(block => block.type === 'arduino_ultrasonic_read');
  for (const block of ultrasonicBlocks) {
    const trigPin = block.getFieldValue('TRIG_PIN');
    const echoPin = block.getFieldValue('ECHO_PIN');
    const funcName = `readUltrasonic_${trigPin}_${echoPin}`;
    deps.helpers.add(`long ${funcName}() {
  digitalWrite(${trigPin}, LOW);
  delayMicroseconds(2);
  digitalWrite(${trigPin}, HIGH);
  delayMicroseconds(10);
  digitalWrite(${trigPin}, LOW);
  long duration = pulseIn(${echoPin}, HIGH, 30000);
  return duration * 0.034 / 2;
}`);
  }

  return deps;
};

const prependDependencies = (workspace: Blockly.WorkspaceSvg, code: string): string => {
  const deps = addCommonDependencies(workspace);
  const sections = [
    Array.from(deps.includes).join('\n'),
    Array.from(deps.globals).join('\n'),
    Array.from(deps.helpers).join('\n\n'),
  ].filter(Boolean);

  if (sections.length === 0) {
    return code;
  }

  return `${sections.join('\n\n')}\n\n${code}`;
};

// ==================== 程序结构 ====================

arduinoGenerator.forBlock['arduino_setup'] = function(block, generator) {
  const statements = generator.statementToCode(block, 'SETUP');
  const code = `void setup() {\n${statements}}\n\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_loop'] = function(block, generator) {
  const statements = generator.statementToCode(block, 'LOOP');
  const code = `void loop() {\n${statements}}\n\n`;
  return code;
};

// ==================== 控制流 ====================

arduinoGenerator.forBlock['arduino_if'] = function(block, generator) {
  const condition = generator.valueToCode(block, 'CONDITION', ORDER_NONE) || 'false';
  const statements = generator.statementToCode(block, 'DO');
  const code = `  if (${condition}) {\n${statements}  }\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_if_else'] = function(block, generator) {
  const condition = generator.valueToCode(block, 'CONDITION', ORDER_NONE) || 'false';
  const doStatements = generator.statementToCode(block, 'DO');
  const elseStatements = generator.statementToCode(block, 'ELSE');
  const code = `  if (${condition}) {\n${doStatements}  } else {\n${elseStatements}  }\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_for'] = function(block, generator) {
  const variable = block.getFieldValue('VAR');
  const from = generator.valueToCode(block, 'FROM', ORDER_ATOMIC) || '0';
  const to = generator.valueToCode(block, 'TO', ORDER_ATOMIC) || '10';
  const step = generator.valueToCode(block, 'STEP', ORDER_ATOMIC) || '1';
  const statements = generator.statementToCode(block, 'DO');
  const code = `  for (int ${variable} = ${from}; ${variable} < ${to}; ${variable} += ${step}) {\n${statements}  }\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_while'] = function(block, generator) {
  const condition = generator.valueToCode(block, 'CONDITION', ORDER_NONE) || 'false';
  const statements = generator.statementToCode(block, 'DO');
  const code = `  while (${condition}) {\n${statements}  }\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_repeat'] = function(block, generator) {
  const times = generator.valueToCode(block, 'TIMES', ORDER_ATOMIC) || '10';
  const statements = generator.statementToCode(block, 'DO');
  const code = `  for (int i = 0; i < ${times}; i++) {  /*@block:arduino_repeat*/\n${statements}  }\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_break'] = function() {
  return '  break;\n';
};

// ==================== 变量 ====================

arduinoGenerator.forBlock['arduino_declare_int'] = function(block, generator) {
  const name = block.getFieldValue('NAME');
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const code = `  int ${name} = ${value};\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_declare_float'] = function(block, generator) {
  const name = block.getFieldValue('NAME');
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0.0';
  const code = `  float ${name} = ${value};\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_declare_string'] = function(block, generator) {
  const name = block.getFieldValue('NAME');
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '""';
  const code = `  String ${name} = ${value};\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_declare_bool'] = function(block) {
  const name = block.getFieldValue('NAME');
  const value = block.getFieldValue('VALUE');
  const code = `  bool ${name} = ${value};\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_set_variable'] = function(block, generator) {
  const name = block.getFieldValue('NAME');
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const code = `  ${name} = ${value};\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_get_variable'] = function(block) {
  const name = block.getFieldValue('NAME');
  return [name, ORDER_ATOMIC];
};

// ==================== 运算 ====================

arduinoGenerator.forBlock['arduino_math'] = function(block, generator) {
  const a = generator.valueToCode(block, 'A', ORDER_ATOMIC) || '0';
  const op = block.getFieldValue('OP');
  const b = generator.valueToCode(block, 'B', ORDER_ATOMIC) || '0';
  const order = (op === '*' || op === '/') ? ORDER_MULTIPLICATIVE : ORDER_ADDITIVE;
  const code = `${a} ${op} ${b}`;
  return [code, order];
};

arduinoGenerator.forBlock['arduino_compare'] = function(block, generator) {
  const a = generator.valueToCode(block, 'A', ORDER_ATOMIC) || '0';
  const op = block.getFieldValue('OP');
  const b = generator.valueToCode(block, 'B', ORDER_ATOMIC) || '0';
  const order = (op === '==' || op === '!=') ? ORDER_EQUALITY : ORDER_RELATIONAL;
  const code = `${a} ${op} ${b}`;
  return [code, order];
};

arduinoGenerator.forBlock['arduino_logic'] = function(block, generator) {
  const a = generator.valueToCode(block, 'A', ORDER_ATOMIC) || 'false';
  const op = block.getFieldValue('OP');
  const b = generator.valueToCode(block, 'B', ORDER_ATOMIC) || 'false';
  const order = (op === '&&') ? ORDER_LOGICAL_AND : ORDER_LOGICAL_OR;
  const code = `${a} ${op} ${b}`;
  return [code, order];
};

arduinoGenerator.forBlock['arduino_not'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || 'false';
  const code = `!${value}`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_modulo'] = function(block, generator) {
  const a = generator.valueToCode(block, 'A', ORDER_ATOMIC) || '0';
  const b = generator.valueToCode(block, 'B', ORDER_ATOMIC) || '1';
  const code = `${a} % ${b}`;
  return [code, ORDER_MULTIPLICATIVE];
};

arduinoGenerator.forBlock['arduino_map'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const fromLow = generator.valueToCode(block, 'FROMLOW', ORDER_ATOMIC) || '0';
  const fromHigh = generator.valueToCode(block, 'FROMHIGH', ORDER_ATOMIC) || '1023';
  const toLow = generator.valueToCode(block, 'TOLOW', ORDER_ATOMIC) || '0';
  const toHigh = generator.valueToCode(block, 'TOHIGH', ORDER_ATOMIC) || '255';
  const code = `map(${value}, ${fromLow}, ${fromHigh}, ${toLow}, ${toHigh})`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_constrain'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const min = generator.valueToCode(block, 'MIN', ORDER_ATOMIC) || '0';
  const max = generator.valueToCode(block, 'MAX', ORDER_ATOMIC) || '255';
  const code = `constrain(${value}, ${min}, ${max})`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_random'] = function(block, generator) {
  const min = generator.valueToCode(block, 'MIN', ORDER_ATOMIC) || '0';
  const max = generator.valueToCode(block, 'MAX', ORDER_ATOMIC) || '100';
  const code = `random(${min}, ${max})`;
  return [code, ORDER_ATOMIC];
};

// ==================== 数字 I/O ====================

arduinoGenerator.forBlock['arduino_pinmode'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const mode = block.getFieldValue('MODE');
  const code = `  pinMode(${pin}, ${mode});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_digitalwrite'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const state = block.getFieldValue('STATE');
  const code = `  digitalWrite(${pin}, ${state});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_digitalread'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `digitalRead(${pin})`;
  return [code, ORDER_ATOMIC];
};

// ==================== 模拟 I/O ====================

arduinoGenerator.forBlock['arduino_analogread'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `analogRead(${pin})`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_analogwrite'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const value = block.getFieldValue('VALUE');
  const code = `  analogWrite(${pin}, ${value});\n`;
  return code;
};

// ==================== 时间 ====================

arduinoGenerator.forBlock['arduino_delay'] = function(block) {
  const time = block.getFieldValue('TIME');
  const code = `  delay(${time});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_millis'] = function() {
  const code = 'millis()';
  return [code, ORDER_ATOMIC];
};

// ==================== 串口通信 ====================

arduinoGenerator.forBlock['arduino_serial_begin'] = function(block) {
  const baud = block.getFieldValue('BAUD');
  const code = `  Serial.begin(${baud});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_serial_print'] = function(block, generator) {
  const text = generator.valueToCode(block, 'TEXT', ORDER_ATOMIC) || '""';
  const code = `  Serial.print(${text});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_serial_println'] = function(block, generator) {
  const text = generator.valueToCode(block, 'TEXT', ORDER_ATOMIC) || '""';
  const code = `  Serial.println(${text});\n`;
  return code;
};

// ==================== 文本和数字 ====================

arduinoGenerator.forBlock['arduino_text'] = function(block) {
  const text = block.getFieldValue('TEXT');
  const code = `"${text}"`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_number'] = function(block) {
  const num = block.getFieldValue('NUM');
  const code = String(num);
  return [code, ORDER_ATOMIC];
};

// ==================== 函数 ====================

arduinoGenerator.forBlock['arduino_function_void'] = function(block, generator) {
  const name = block.getFieldValue('NAME');
  const body = generator.statementToCode(block, 'BODY');
  const code = `void ${name}() {\n${body}}\n\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_call_function'] = function(block) {
  const name = block.getFieldValue('NAME');
  const code = `  ${name}();\n`;
  return code;
};

// ==================== ESP32 ====================

arduinoGenerator.forBlock['arduino_ledc_setup'] = function(block) {
  const channel = block.getFieldValue('CHANNEL');
  const freq = block.getFieldValue('FREQ');
  const resolution = block.getFieldValue('RESOLUTION');
  const code = `  ledcSetup(${channel}, ${freq}, ${resolution});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_ledc_attach'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const channel = block.getFieldValue('CHANNEL');
  const code = `  ledcAttachPin(${pin}, ${channel});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_ledc_write'] = function(block) {
  const channel = block.getFieldValue('CHANNEL');
  const duty = block.getFieldValue('DUTY');
  const code = `  ledcWrite(${channel}, ${duty});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_wifi_begin'] = function(block) {
  const ssid = block.getFieldValue('SSID');
  const pass = block.getFieldValue('PASS');
  const code = `  WiFi.begin("${ssid}", "${pass}");\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_wifi_status'] = function() {
  const code = 'WiFi.status()';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_wifi_wait_connected'] = function() {
  return '  while (WiFi.status() != WL_CONNECTED) {\n    delay(500);\n  }\n';
};

arduinoGenerator.forBlock['arduino_wifi_local_ip'] = function() {
  return ['WiFi.localIP().toString()', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_http_get'] = function(block, generator) {
  const url = generator.valueToCode(block, 'URL', ORDER_ATOMIC) || '""';
  const varName = block.getFieldValue('VAR') || 'response';
  return `  HTTPClient http;\n  http.begin(${url});\n  int httpCode = http.GET();\n  String ${varName} = httpCode > 0 ? http.getString() : "";\n  http.end();\n`;
};

arduinoGenerator.forBlock['arduino_mqtt_setup'] = function(block) {
  const host = block.getFieldValue('HOST');
  const port = block.getFieldValue('PORT');
  return `  mqttClient.setServer("${host}", ${port});\n`;
};

arduinoGenerator.forBlock['arduino_mqtt_connect'] = function(block) {
  const clientId = block.getFieldValue('CLIENT_ID');
  return `  while (!mqttClient.connected()) {\n    mqttClient.connect("${clientId}");\n    delay(500);\n  }\n`;
};

arduinoGenerator.forBlock['arduino_mqtt_publish'] = function(block, generator) {
  const topic = block.getFieldValue('TOPIC');
  const payload = generator.valueToCode(block, 'PAYLOAD', ORDER_ATOMIC) || '""';
  return `  mqttClient.publish("${topic}", String(${payload}).c_str());\n`;
};

arduinoGenerator.forBlock['arduino_mqtt_subscribe'] = function(block) {
  const topic = block.getFieldValue('TOPIC');
  return `  mqttClient.subscribe("${topic}");\n`;
};

arduinoGenerator.forBlock['arduino_mqtt_loop'] = function() {
  return '  mqttClient.loop();\n';
};

arduinoGenerator.forBlock['arduino_preferences_begin'] = function(block) {
  const ns = block.getFieldValue('NAMESPACE');
  const readonly = block.getFieldValue('READONLY');
  return `  preferences.begin("${ns}", ${readonly});\n`;
};

arduinoGenerator.forBlock['arduino_preferences_put_string'] = function(block, generator) {
  const key = block.getFieldValue('KEY');
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '""';
  return `  preferences.putString("${key}", ${value});\n`;
};

arduinoGenerator.forBlock['arduino_preferences_get_string'] = function(block) {
  const key = block.getFieldValue('KEY');
  const fallback = block.getFieldValue('DEFAULT');
  return [`preferences.getString("${key}", "${fallback}")`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_preferences_put_int'] = function(block, generator) {
  const key = block.getFieldValue('KEY');
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  return `  preferences.putInt("${key}", ${value});\n`;
};

arduinoGenerator.forBlock['arduino_preferences_get_int'] = function(block) {
  const key = block.getFieldValue('KEY');
  const fallback = block.getFieldValue('DEFAULT');
  return [`preferences.getInt("${key}", ${fallback})`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_deep_sleep_timer'] = function(block) {
  const seconds = block.getFieldValue('SECONDS');
  return `  esp_sleep_enable_timer_wakeup((uint64_t)${seconds} * 1000000ULL);\n  esp_deep_sleep_start();\n`;
};

arduinoGenerator.forBlock['arduino_touch_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `touchRead(${pin})`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_dac_write'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const value = block.getFieldValue('VALUE');
  const code = `  dacWrite(${pin}, ${value});\n`;
  return code;
};

// ==================== I2C ====================

arduinoGenerator.forBlock['arduino_wire_begin'] = function() {
  return '  Wire.begin();\n';
};

arduinoGenerator.forBlock['arduino_wire_begin_transmission'] = function(block) {
  const addr = block.getFieldValue('ADDR');
  const code = `  Wire.beginTransmission(${addr});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_wire_write'] = function(block, generator) {
  const data = generator.valueToCode(block, 'DATA', ORDER_ATOMIC) || '0';
  const code = `  Wire.write(${data});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_wire_end_transmission'] = function() {
  return '  Wire.endTransmission();\n';
};

arduinoGenerator.forBlock['arduino_wire_request_from'] = function(block) {
  const addr = block.getFieldValue('ADDR');
  const count = block.getFieldValue('COUNT');
  const code = `  Wire.requestFrom(${addr}, ${count});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_wire_read'] = function() {
  const code = 'Wire.read()';
  return [code, ORDER_ATOMIC];
};

// ==================== 常用库 ====================

arduinoGenerator.forBlock['arduino_servo_attach'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `  myServo.attach(${pin});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_servo_write'] = function(block) {
  const angle = block.getFieldValue('ANGLE');
  const code = `  myServo.write(${angle});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_tone'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const freq = block.getFieldValue('FREQ');
  const duration = block.getFieldValue('DURATION');
  const code = `  tone(${pin}, ${freq}, ${duration});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_notone'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `  noTone(${pin});\n`;
  return code;
};

// ==================== 数组 ====================

arduinoGenerator.forBlock['arduino_declare_array'] = function(block) {
  const type = block.getFieldValue('TYPE');
  const name = block.getFieldValue('NAME');
  const size = block.getFieldValue('SIZE');
  const code = `  ${type} ${name}[${size}];\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_array_set'] = function(block, generator) {
  const name = block.getFieldValue('NAME');
  const index = block.getFieldValue('INDEX');
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const code = `  ${name}[${index}] = ${value};\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_array_get'] = function(block) {
  const name = block.getFieldValue('NAME');
  const index = block.getFieldValue('INDEX');
  const code = `${name}[${index}]`;
  return [code, ORDER_ATOMIC];
};

// ==================== 传感器 ====================

arduinoGenerator.forBlock['arduino_dht_begin'] = function() {
  return '  dht.begin();\n';
};

arduinoGenerator.forBlock['arduino_dht_read_temp'] = function() {
  const code = 'dht.readTemperature()';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_dht_read_humidity'] = function() {
  const code = 'dht.readHumidity()';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_ultrasonic_read'] = function(block) {
  const trigPin = block.getFieldValue('TRIG_PIN');
  const echoPin = block.getFieldValue('ECHO_PIN');
  const funcName = `readUltrasonic_${trigPin}_${echoPin}`;
  const code = `${funcName}()`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_mpu6050_read'] = function(block) {
  const type = block.getFieldValue('TYPE');
  const axis = block.getFieldValue('AXIS');
  let code: string;
  if (type === 'accel') {
    code = `mpu.getAcceleration${axis}()`;
  } else {
    code = `mpu.getRotation${axis}()`;
  }
  return [code, ORDER_ATOMIC];
};

// ==================== 显示 ====================

arduinoGenerator.forBlock['arduino_oled_begin'] = function() {
  return '  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n  display.clearDisplay();\n  display.setTextColor(SSD1306_WHITE);\n';
};

arduinoGenerator.forBlock['arduino_oled_clear'] = function() {
  return '  display.clearDisplay();\n';
};

arduinoGenerator.forBlock['arduino_oled_print'] = function(block, generator) {
  const x = block.getFieldValue('X');
  const y = block.getFieldValue('Y');
  const text = generator.valueToCode(block, 'TEXT', ORDER_ATOMIC) || '""';
  const code = `  display.setCursor(${x}, ${y});\n  display.print(${text});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_oled_display'] = function() {
  return '  display.display();\n';
};

arduinoGenerator.forBlock['arduino_oled_set_text_size'] = function(block) {
  const size = block.getFieldValue('SIZE');
  const code = `  display.setTextSize(${size});\n`;
  return code;
};

// ==================== NeoPixel ====================

arduinoGenerator.forBlock['arduino_neopixel_begin'] = function() {
  return '  strip.begin();\n  strip.show();\n';
};

arduinoGenerator.forBlock['arduino_neopixel_set_color'] = function(block) {
  const index = block.getFieldValue('INDEX');
  const r = block.getFieldValue('R');
  const g = block.getFieldValue('G');
  const b = block.getFieldValue('B');
  const code = `  strip.setPixelColor(${index}, strip.Color(${r}, ${g}, ${b}));\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_neopixel_show'] = function() {
  return '  strip.show();\n';
};

arduinoGenerator.forBlock['arduino_neopixel_clear'] = function() {
  return '  strip.clear();\n';
};

arduinoGenerator.forBlock['arduino_neopixel_brightness'] = function(block) {
  const value = block.getFieldValue('VALUE');
  const code = `  strip.setBrightness(${value});\n`;
  return code;
};

// ==================== 数据转换 ====================

arduinoGenerator.forBlock['arduino_to_int'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const code = `(int)(${value})`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_to_float'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const code = `(float)(${value})`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_to_string'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '0';
  const code = `String(${value})`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_string_concat'] = function(block, generator) {
  const a = generator.valueToCode(block, 'A', ORDER_ATOMIC) || '""';
  const b = generator.valueToCode(block, 'B', ORDER_ATOMIC) || '""';
  const code = `${a} + ${b}`;
  return [code, ORDER_ADDITIVE];
};

arduinoGenerator.forBlock['arduino_string_length'] = function(block, generator) {
  const value = generator.valueToCode(block, 'VALUE', ORDER_ATOMIC) || '""';
  const code = `${value}.length()`;
  return [code, ORDER_ATOMIC];
};

// ==================== 中断和定时 ====================

arduinoGenerator.forBlock['arduino_attach_interrupt'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const func = block.getFieldValue('FUNC');
  const mode = block.getFieldValue('MODE');
  const code = `  attachInterrupt(digitalPinToInterrupt(${pin}), ${func}, ${mode});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_detach_interrupt'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `  detachInterrupt(digitalPinToInterrupt(${pin}));\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_delay_microseconds'] = function(block) {
  const us = block.getFieldValue('US');
  const code = `  delayMicroseconds(${us});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_micros'] = function() {
  const code = 'micros()';
  return [code, ORDER_ATOMIC];
};

// ==================== 红外遥控 ====================

arduinoGenerator.forBlock['arduino_ir_begin'] = function() {
  return '  irrecv.enableIRIn();\n';
};

arduinoGenerator.forBlock['arduino_ir_available'] = function() {
  const code = 'irrecv.decode(&results)';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_ir_read'] = function() {
  const code = 'results.value';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_ir_resume'] = function() {
  return '  irrecv.resume();\n';
};

arduinoGenerator.forBlock['arduino_ir_send'] = function(block) {
  const code_val = block.getFieldValue('CODE');
  const code = `  irsend.sendNEC(${code_val}, 32);\n`;
  return code;
};

// ==================== 电机控制 ====================

arduinoGenerator.forBlock['arduino_stepper_setup'] = function(block) {
  void block;
  return '';
};

arduinoGenerator.forBlock['arduino_stepper_speed'] = function(block) {
  const rpm = block.getFieldValue('RPM');
  const code = `  myStepper.setSpeed(${rpm});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_stepper_step'] = function(block) {
  const steps = block.getFieldValue('STEPS');
  const code = `  myStepper.step(${steps});\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_motor_forward'] = function(block) {
  const in1 = block.getFieldValue('IN1');
  const in2 = block.getFieldValue('IN2');
  const ena = block.getFieldValue('ENA');
  const speed = block.getFieldValue('SPEED');
  const code = `  digitalWrite(${in1}, HIGH);  /*@block:arduino_motor_forward|IN1:${in1}|IN2:${in2}|ENA:${ena}|SPEED:${speed}*/\n  digitalWrite(${in2}, LOW);  /*@block:arduino_motor_forward*/\n  analogWrite(${ena}, ${speed});  /*@block:arduino_motor_forward*/\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_motor_backward'] = function(block) {
  const in1 = block.getFieldValue('IN1');
  const in2 = block.getFieldValue('IN2');
  const ena = block.getFieldValue('ENA');
  const speed = block.getFieldValue('SPEED');
  const code = `  digitalWrite(${in1}, LOW);  /*@block:arduino_motor_backward|IN1:${in1}|IN2:${in2}|ENA:${ena}|SPEED:${speed}*/\n  digitalWrite(${in2}, HIGH);  /*@block:arduino_motor_backward*/\n  analogWrite(${ena}, ${speed});  /*@block:arduino_motor_backward*/\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_motor_stop'] = function(block) {
  const in1 = block.getFieldValue('IN1');
  const in2 = block.getFieldValue('IN2');
  const code = `  digitalWrite(${in1}, LOW);  /*@block:arduino_motor_stop|IN1:${in1}|IN2:${in2}*/\n  digitalWrite(${in2}, LOW);  /*@block:arduino_motor_stop*/\n`;
  return code;
};

// ==================== 开关控制 ====================

arduinoGenerator.forBlock['arduino_relay_on'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `  digitalWrite(${pin}, HIGH);  /*@block:arduino_relay_on|PIN:${pin}*/\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_relay_off'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `  digitalWrite(${pin}, LOW);  /*@block:arduino_relay_off|PIN:${pin}*/\n`;
  return code;
};

arduinoGenerator.forBlock['arduino_button_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `digitalRead(${pin})  /*@expr:arduino_button_read|PIN:${pin}*/`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_pir_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `digitalRead(${pin})  /*@expr:arduino_pir_read|PIN:${pin}*/`;
  return [code, ORDER_ATOMIC];
};

// ==================== 环境传感器 ====================

arduinoGenerator.forBlock['arduino_bmp280_temp'] = function() {
  const code = 'bmp.readTemperature()';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_bmp280_pressure'] = function() {
  const code = 'bmp.readPressure()';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_bmp280_altitude'] = function() {
  const code = 'bmp.readAltitude(1013.25)';
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_bme280_begin'] = function() {
  return '  bme.begin(0x76);\n';
};

arduinoGenerator.forBlock['arduino_bme280_temp'] = function() {
  return ['bme.readTemperature()', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_bme280_humidity'] = function() {
  return ['bme.readHumidity()', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_bme280_pressure'] = function() {
  return ['bme.readPressure() / 100.0F', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_lcd_begin'] = function() {
  return '  lcd.init();\n  lcd.backlight();\n';
};

arduinoGenerator.forBlock['arduino_lcd_clear'] = function() {
  return '  lcd.clear();\n';
};

arduinoGenerator.forBlock['arduino_lcd_print'] = function(block, generator) {
  const col = block.getFieldValue('COL');
  const row = block.getFieldValue('ROW');
  const text = generator.valueToCode(block, 'TEXT', ORDER_ATOMIC) || '""';
  return `  lcd.setCursor(${col}, ${row});\n  lcd.print(${text});\n`;
};

arduinoGenerator.forBlock['arduino_lcd_backlight'] = function(block) {
  const state = block.getFieldValue('STATE');
  return `  lcd.${state}();\n`;
};

arduinoGenerator.forBlock['arduino_bh1750_begin'] = function() {
  return '  lightMeter.begin();\n';
};

arduinoGenerator.forBlock['arduino_bh1750_read'] = function() {
  return ['lightMeter.readLightLevel()', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_hx711_begin'] = function() {
  return '  scale.begin(HX711_DOUT, HX711_SCK);\n';
};

arduinoGenerator.forBlock['arduino_hx711_read'] = function() {
  return ['scale.get_units(5)', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_hx711_tare'] = function() {
  return '  scale.tare();\n';
};

arduinoGenerator.forBlock['arduino_rc522_begin'] = function() {
  return '  SPI.begin();\n  rfid.PCD_Init();\n';
};

arduinoGenerator.forBlock['arduino_rc522_card_available'] = function() {
  return ['rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()', ORDER_LOGICAL_AND];
};

arduinoGenerator.forBlock['arduino_rc522_uid'] = function() {
  return ['String(rfid.uid.uidByte[0], HEX) + String(rfid.uid.uidByte[1], HEX) + String(rfid.uid.uidByte[2], HEX) + String(rfid.uid.uidByte[3], HEX)', ORDER_ADDITIVE];
};

arduinoGenerator.forBlock['arduino_mq_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `analogRead(${pin})  /*@expr:arduino_mq_read|PIN:${pin}*/`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_sound_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `analogRead(${pin})  /*@expr:arduino_sound_read|PIN:${pin}*/`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_light_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `analogRead(${pin})  /*@expr:arduino_light_read|PIN:${pin}*/`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_soil_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const code = `analogRead(${pin})  /*@expr:arduino_soil_read|PIN:${pin}*/`;
  return [code, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_water_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  return [`analogRead(${pin})  /*@expr:arduino_water_read|PIN:${pin}*/`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_flame_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  return [`digitalRead(${pin})  /*@expr:arduino_flame_read|PIN:${pin}*/`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_tilt_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  return [`digitalRead(${pin})  /*@expr:arduino_tilt_read|PIN:${pin}*/`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_vibration_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  return [`digitalRead(${pin})  /*@expr:arduino_vibration_read|PIN:${pin}*/`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_encoder_read'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const part = block.getFieldValue('PART');
  return [`digitalRead(${pin})  /*@expr:arduino_encoder_read|PART:${part}|PIN:${pin}*/`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_aht20_begin'] = function() {
  return '  aht.begin();\n';
};

arduinoGenerator.forBlock['arduino_aht20_temp'] = function() {
  return ['(updateAHT20(), ahtTemp.temperature)', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_aht20_humidity'] = function() {
  return ['(updateAHT20(), ahtHumidity.relative_humidity)', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_sht31_begin'] = function() {
  return '  sht31.begin(SHT31_ADDR);\n';
};

arduinoGenerator.forBlock['arduino_sht31_temp'] = function() {
  return ['sht31.readTemperature()', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_sht31_humidity'] = function() {
  return ['sht31.readHumidity()', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_ds18b20_begin'] = function() {
  return '  ds18b20.begin();\n';
};

arduinoGenerator.forBlock['arduino_ds18b20_temp'] = function() {
  return ['(ds18b20.requestTemperatures(), ds18b20.getTempCByIndex(0))', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_tcs34725_begin'] = function() {
  return '  tcs.begin();\n';
};

arduinoGenerator.forBlock['arduino_tcs34725_read'] = function(block) {
  const channel = block.getFieldValue('CHANNEL');
  const varName = channel === 'R' ? 'tcsR' : channel === 'G' ? 'tcsG' : channel === 'B' ? 'tcsB' : 'tcsC';
  return [`(updateTCS34725(), ${varName})`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_gps_begin'] = function(block) {
  const baud = block.getFieldValue('BAUD');
  return `  gpsSerial.begin(${baud}, SERIAL_8N1, GPS_RX, GPS_TX);\n`;
};

arduinoGenerator.forBlock['arduino_gps_update'] = function() {
  return '  while (gpsSerial.available() > 0) {\n    gps.encode(gpsSerial.read());\n  }\n';
};

arduinoGenerator.forBlock['arduino_gps_value'] = function(block) {
  const value = block.getFieldValue('VALUE');
  const codeByValue: Record<string, string> = {
    lat: 'gps.location.lat()',
    lng: 'gps.location.lng()',
    speed: 'gps.speed.kmph()',
    satellites: 'gps.satellites.value()',
  };
  return [codeByValue[value] || '0', ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_rgb_led_write'] = function(block) {
  const rPin = block.getFieldValue('R_PIN');
  const gPin = block.getFieldValue('G_PIN');
  const bPin = block.getFieldValue('B_PIN');
  const r = block.getFieldValue('R');
  const g = block.getFieldValue('G');
  const b = block.getFieldValue('B');
  return `  analogWrite(${rPin}, ${r});\n  analogWrite(${gPin}, ${g});\n  analogWrite(${bPin}, ${b});\n`;
};

arduinoGenerator.forBlock['arduino_pwm_device_write'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const value = block.getFieldValue('VALUE');
  return `  analogWrite(${pin}, ${value});\n`;
};

arduinoGenerator.forBlock['arduino_buzzer_note'] = function(block) {
  const pin = block.getFieldValue('PIN');
  const freq = block.getFieldValue('FREQ');
  const duration = block.getFieldValue('DURATION');
  return `  tone(${pin}, ${freq}, ${duration});\n`;
};

arduinoGenerator.forBlock['arduino_littlefs_begin'] = function() {
  return '  LittleFS.begin(true);\n';
};

arduinoGenerator.forBlock['arduino_littlefs_write'] = function(block, generator) {
  const path = block.getFieldValue('PATH');
  const text = generator.valueToCode(block, 'TEXT', ORDER_ATOMIC) || '""';
  return `  writeLittleFSFile("${path}", String(${text}));\n`;
};

arduinoGenerator.forBlock['arduino_littlefs_read'] = function(block) {
  const path = block.getFieldValue('PATH');
  return [`readLittleFSFile("${path}")`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_sd_begin'] = function(block) {
  const cs = block.getFieldValue('CS');
  return `  SD.begin(${cs});\n`;
};

arduinoGenerator.forBlock['arduino_sd_write'] = function(block, generator) {
  const path = block.getFieldValue('PATH');
  const text = generator.valueToCode(block, 'TEXT', ORDER_ATOMIC) || '""';
  return `  writeSDFile("${path}", String(${text}));\n`;
};

arduinoGenerator.forBlock['arduino_sd_read'] = function(block) {
  const path = block.getFieldValue('PATH');
  return [`readSDFile("${path}")`, ORDER_ATOMIC];
};

arduinoGenerator.forBlock['arduino_espnow_begin'] = function() {
  return '  WiFi.mode(WIFI_STA);\n  esp_now_init();\n';
};

arduinoGenerator.forBlock['arduino_espnow_send'] = function(block, generator) {
  const mac = block.getFieldValue('MAC');
  const message = generator.valueToCode(block, 'MESSAGE', ORDER_ATOMIC) || '""';
  return `  uint8_t peerMac[6];\n  parseMacAddress("${mac}", peerMac);\n  ensureEspNowPeer(peerMac);\n  String espNowMessage = String(${message});\n  esp_now_send(peerMac, (const uint8_t*)espNowMessage.c_str(), espNowMessage.length());\n`;
};

arduinoGenerator.forBlock['arduino_ble_uart_begin'] = function(block) {
  const name = block.getFieldValue('NAME');
  return `  BLEDevice::init("${name}");\n  BLEServer* bleServer = BLEDevice::createServer();\n  BLEService* bleService = bleServer->createService(BLE_UART_SERVICE_UUID);\n  bleTxCharacteristic = bleService->createCharacteristic(BLE_UART_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);\n  bleTxCharacteristic->addDescriptor(new BLE2902());\n  bleService->start();\n  bleServer->getAdvertising()->start();\n`;
};

arduinoGenerator.forBlock['arduino_ble_uart_notify'] = function(block, generator) {
  const text = generator.valueToCode(block, 'TEXT', ORDER_ATOMIC) || '""';
  return `  if (bleTxCharacteristic) {\n    String bleText = String(${text});\n    bleTxCharacteristic->setValue(bleText.c_str());\n    bleTxCharacteristic->notify();\n  }\n`;
};

// 生成完整的 Arduino 代码
export const generateArduinoCode = (workspace: Blockly.WorkspaceSvg): string => {
  return prependDependencies(workspace, arduinoGenerator.workspaceToCode(workspace));
};
