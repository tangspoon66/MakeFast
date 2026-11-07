/**
 * 积木模式 AI 约束
 *
 * 当用户处于积木视图时，AI 只能使用积木支持的 Arduino 函数和语法生成代码。
 * 这确保 AI 生成的代码可以被 parseCodeToXml 零警告转换回积木。
 */

/** 积木支持的所有 Arduino 函数白名单 */
export const BLOCKLY_FUNCTIONS = [
  // 数字 I/O
  'pinMode', 'digitalWrite', 'digitalRead',
  // 模拟 I/O
  'analogRead', 'analogWrite',
  // 时间
  'delay', 'millis', 'micros', 'delayMicroseconds',
  // 串口
  'Serial.begin', 'Serial.print', 'Serial.println',
  // ESP32
  'ledcSetup', 'ledcAttachPin', 'ledcWrite',
  'WiFi.begin', 'WiFi.status', 'WiFi.localIP',
  'HTTPClient.begin', 'HTTPClient.GET', 'HTTPClient.getString', 'HTTPClient.end',
  'preferences.begin', 'preferences.putString', 'preferences.getString',
  'preferences.putInt', 'preferences.getInt',
  'esp_sleep_enable_timer_wakeup', 'esp_deep_sleep_start',
  'touchRead', 'dacWrite',
  // I2C
  'Wire.begin', 'Wire.beginTransmission', 'Wire.write',
  'Wire.endTransmission', 'Wire.requestFrom', 'Wire.read',
  // 常用库
  'myServo.attach', 'myServo.write',
  'tone', 'noTone',
  // 传感器
  'dht.begin', 'dht.readTemperature', 'dht.readHumidity',
  'mpu.getAccelerationX', 'mpu.getAccelerationY', 'mpu.getAccelerationZ',
  'mpu.getRotationX', 'mpu.getRotationY', 'mpu.getRotationZ',
  'bmp.readTemperature', 'bmp.readPressure', 'bmp.readAltitude',
  // 显示
  'display.begin', 'display.clearDisplay', 'display.setCursor',
  'display.print', 'display.display', 'display.setTextSize',
  // NeoPixel
  'strip.begin', 'strip.show', 'strip.setPixelColor',
  'strip.clear', 'strip.setBrightness',
  // 红外
  'irrecv.enableIRIn', 'irrecv.decode', 'irrecv.resume',
  'irsend.sendNEC',
  // 步进电机
  'myStepper.setSpeed', 'myStepper.step',
  // 中断
  'attachInterrupt', 'detachInterrupt',
  // 数据转换
  'map', 'constrain', 'random',
  // 字符串
  'String',
];

/** 积木模式 AI system prompt 约束文本 */
export const BLOCKLY_CONSTRAINT_PROMPT = `
你正在积木模式下工作。生成的代码只能使用以下 Arduino 函数，不得使用任何其他函数：

${BLOCKLY_FUNCTIONS.join(', ')}

规则：
1. 每条语句独占一行，行尾可以添加 // 注释
2. 变量声明：int/float/String/bool。bool 变量只能初始化为 true 或 false
3. 禁止使用：#define、指针、结构体、switch/case、三元运算符、函数参数
4. 禁止使用任何上述列表之外的函数（包括其他 Arduino 库函数）
5. 变量赋值语句：x = value; 直接使用
6. 控制流：if/else、for、while 可用，花括号单独一行或同行均可
7. void setup() 和 void loop() 必须存在

生成的代码必须可以被拖拽到积木视图中直接展示。`.trim();
