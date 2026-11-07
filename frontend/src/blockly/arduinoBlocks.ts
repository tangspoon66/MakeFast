/**
 * Arduino 积木块定义
 * 定义所有可用的 Arduino 积木块
 */

import * as Blockly from 'blockly';

// 定义 Arduino 积木块
export const defineArduinoBlocks = () => {
  // ==================== 程序结构 (基础) ====================

  // Setup 块
  Blockly.Blocks['arduino_setup'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('setup');
      this.appendStatementInput('SETUP')
        .setCheck(null);
      this.setColour(120);
      this.setTooltip('Arduino setup 函数，程序启动时执行一次');
      this.setHelpUrl('');
    }
  };

  // Loop 块
  Blockly.Blocks['arduino_loop'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('loop');
      this.appendStatementInput('LOOP')
        .setCheck(null);
      this.setPreviousStatement(true, null);
      this.setColour(120);
      this.setTooltip('Arduino loop 函数，持续循环执行');
      this.setHelpUrl('');
    }
  };

  // ==================== 控制流 (基础) ====================

  // if 块
  Blockly.Blocks['arduino_if'] = {
    init: function() {
      this.appendValueInput('CONDITION')
        .setCheck('Boolean')
        .appendField('如果');
      this.appendStatementInput('DO')
        .setCheck(null)
        .appendField('执行');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('如果条件为真，则执行');
    }
  };

  // if/else 块
  Blockly.Blocks['arduino_if_else'] = {
    init: function() {
      this.appendValueInput('CONDITION')
        .setCheck('Boolean')
        .appendField('如果');
      this.appendStatementInput('DO')
        .setCheck(null)
        .appendField('执行');
      this.appendStatementInput('ELSE')
        .setCheck(null)
        .appendField('否则');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('如果条件为真则执行，否则执行另一段');
    }
  };

  // for 循环块
  Blockly.Blocks['arduino_for'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('计数循环')
        .appendField('变量')
        .appendField(new Blockly.FieldTextInput('i'), 'VAR');
      this.appendValueInput('FROM')
        .setCheck('Number')
        .appendField('从');
      this.appendValueInput('TO')
        .setCheck('Number')
        .appendField('到');
      this.appendValueInput('STEP')
        .setCheck('Number')
        .appendField('步长');
      this.appendStatementInput('DO')
        .setCheck(null)
        .appendField('执行');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('for 循环');
    }
  };

  // while 循环块
  Blockly.Blocks['arduino_while'] = {
    init: function() {
      this.appendValueInput('CONDITION')
        .setCheck('Boolean')
        .appendField('当');
      this.appendStatementInput('DO')
        .setCheck(null)
        .appendField('执行');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('当条件为真时重复执行');
    }
  };

  // repeat N times 块
  Blockly.Blocks['arduino_repeat'] = {
    init: function() {
      this.appendValueInput('TIMES')
        .setCheck('Number')
        .appendField('重复');
      this.appendDummyInput()
        .appendField('次');
      this.appendStatementInput('DO')
        .setCheck(null)
        .appendField('执行');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('重复执行指定次数');
    }
  };

  // break 块
  Blockly.Blocks['arduino_break'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('跳出循环');
      this.setPreviousStatement(true, null);
      this.setColour(120);
      this.setTooltip('跳出当前循环');
    }
  };

  // ==================== 变量 (基础) ====================

  // 声明 int 变量
  Blockly.Blocks['arduino_declare_int'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('声明整数')
        .appendField(new Blockly.FieldTextInput('myVar'), 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('声明一个整数变量');
    }
  };

  // 声明 float 变量
  Blockly.Blocks['arduino_declare_float'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('声明浮点数')
        .appendField(new Blockly.FieldTextInput('myFloat'), 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('声明一个浮点数变量');
    }
  };

  // 声明 String 变量
  Blockly.Blocks['arduino_declare_string'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('String')
        .appendField('声明字符串')
        .appendField(new Blockly.FieldTextInput('myStr'), 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('声明一个字符串变量');
    }
  };

  // 声明 bool 变量
  Blockly.Blocks['arduino_declare_bool'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('声明布尔')
        .appendField(new Blockly.FieldTextInput('myBool'), 'NAME')
        .appendField('=')
        .appendField(new Blockly.FieldDropdown([
          ['true', 'true'],
          ['false', 'false']
        ]), 'VALUE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('声明一个布尔变量');
    }
  };

  // 设置变量值
  Blockly.Blocks['arduino_set_variable'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('设置')
        .appendField(new Blockly.FieldTextInput('myVar'), 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('设置变量的值');
    }
  };

  // 获取变量值
  Blockly.Blocks['arduino_get_variable'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('变量')
        .appendField(new Blockly.FieldTextInput('myVar'), 'NAME');
      this.setOutput(true, null);
      this.setColour(330);
      this.setTooltip('获取变量的值');
    }
  };

  // ==================== 运算 (基础) ====================

  // 数学运算块
  Blockly.Blocks['arduino_math'] = {
    init: function() {
      this.appendValueInput('A')
        .setCheck('Number');
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          ['+', '+'],
          ['-', '-'],
          ['×', '*'],
          ['÷', '/']
        ]), 'OP');
      this.appendValueInput('B')
        .setCheck('Number');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('数学运算');
    }
  };

  // 比较运算块
  Blockly.Blocks['arduino_compare'] = {
    init: function() {
      this.appendValueInput('A')
        .setCheck(null);
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          ['==', '=='],
          ['!=', '!='],
          ['<', '<'],
          ['>', '>'],
          ['<=', '<='],
          ['>=', '>=']
        ]), 'OP');
      this.appendValueInput('B')
        .setCheck(null);
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setColour(230);
      this.setTooltip('比较运算');
    }
  };

  // 逻辑运算块
  Blockly.Blocks['arduino_logic'] = {
    init: function() {
      this.appendValueInput('A')
        .setCheck('Boolean');
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          ['并且', '&&'],
          ['或者', '||']
        ]), 'OP');
      this.appendValueInput('B')
        .setCheck('Boolean');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setColour(230);
      this.setTooltip('逻辑运算');
    }
  };

  // 逻辑非块
  Blockly.Blocks['arduino_not'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('Boolean')
        .appendField('非');
      this.setOutput(true, 'Boolean');
      this.setColour(230);
      this.setTooltip('逻辑取反');
    }
  };

  // 取模运算块
  Blockly.Blocks['arduino_modulo'] = {
    init: function() {
      this.appendValueInput('A')
        .setCheck('Number');
      this.appendDummyInput()
        .appendField('%');
      this.appendValueInput('B')
        .setCheck('Number');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('取模运算（求余数）');
    }
  };

  // map 函数块
  Blockly.Blocks['arduino_map'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('映射');
      this.appendValueInput('FROMLOW')
        .setCheck('Number')
        .appendField('从低');
      this.appendValueInput('FROMHIGH')
        .setCheck('Number')
        .appendField('从高');
      this.appendValueInput('TOLOW')
        .setCheck('Number')
        .appendField('到低');
      this.appendValueInput('TOHIGH')
        .setCheck('Number')
        .appendField('到高');
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('将值从一个范围映射到另一个范围');
    }
  };

  // constrain 函数块
  Blockly.Blocks['arduino_constrain'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('约束');
      this.appendValueInput('MIN')
        .setCheck('Number')
        .appendField('最小');
      this.appendValueInput('MAX')
        .setCheck('Number')
        .appendField('最大');
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('将值约束在最小和最大之间');
    }
  };

  // random 函数块
  Blockly.Blocks['arduino_random'] = {
    init: function() {
      this.appendValueInput('MIN')
        .setCheck('Number')
        .appendField('随机数 从');
      this.appendValueInput('MAX')
        .setCheck('Number')
        .appendField('到');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('生成随机数');
    }
  };

  // ==================== 输入/输出 (Arduino) ====================

  // pinMode 块
  Blockly.Blocks['arduino_pinmode'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('设置引脚')
        .appendField(new Blockly.FieldNumber(13, 0, 39), 'PIN')
        .appendField('模式')
        .appendField(new Blockly.FieldDropdown([
          ['输出', 'OUTPUT'],
          ['输入', 'INPUT'],
          ['上拉输入', 'INPUT_PULLUP']
        ]), 'MODE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(50);
      this.setTooltip('设置引脚模式');
    }
  };

  // digitalWrite 块
  Blockly.Blocks['arduino_digitalwrite'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('数字写入 引脚')
        .appendField(new Blockly.FieldNumber(13, 0, 39), 'PIN')
        .appendField('值')
        .appendField(new Blockly.FieldDropdown([
          ['高', 'HIGH'],
          ['低', 'LOW']
        ]), 'STATE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(50);
      this.setTooltip('数字写入引脚');
    }
  };

  // digitalRead 块
  Blockly.Blocks['arduino_digitalread'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('数字读取 引脚')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(50);
      this.setTooltip('读取数字引脚值');
    }
  };

  // ==================== 输入/输出 — 模拟 (Arduino) ====================

  // analogRead 块
  Blockly.Blocks['arduino_analogread'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('模拟读取 引脚')
        .appendField(new Blockly.FieldNumber(0, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(180);
      this.setTooltip('读取模拟引脚值');
    }
  };

  // analogWrite 块
  Blockly.Blocks['arduino_analogwrite'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('模拟写入 引脚')
        .appendField(new Blockly.FieldNumber(5, 0, 39), 'PIN')
        .appendField('值')
        .appendField(new Blockly.FieldNumber(128, 0, 255), 'VALUE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(180);
      this.setTooltip('模拟写入引脚（PWM）');
    }
  };

  // ==================== 输入/输出 — 时间 (Arduino) ====================

  // delay 块
  Blockly.Blocks['arduino_delay'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('延时')
        .appendField(new Blockly.FieldNumber(1000, 0), 'TIME')
        .appendField('毫秒');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('延时指定毫秒数');
    }
  };

  // millis 块
  Blockly.Blocks['arduino_millis'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('运行时间(毫秒)');
      this.setOutput(true, 'Number');
      this.setColour(290);
      this.setTooltip('获取程序运行时间（毫秒）');
    }
  };

  // ==================== 通信 — 串口 (Arduino) ====================

  // Serial.begin 块
  Blockly.Blocks['arduino_serial_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('串口初始化 波特率')
        .appendField(new Blockly.FieldDropdown([
          ['9600', '9600'],
          ['115200', '115200'],
          ['57600', '57600'],
          ['38400', '38400'],
          ['19200', '19200']
        ]), 'BAUD');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('初始化串口通信');
    }
  };

  // Serial.print 块
  Blockly.Blocks['arduino_serial_print'] = {
    init: function() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('串口输出');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('串口输出（不换行）');
    }
  };

  // Serial.println 块
  Blockly.Blocks['arduino_serial_println'] = {
    init: function() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('串口输出(换行)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('串口输出（换行）');
    }
  };

  // ==================== 运算 — 文本和数字 (基础) ====================

  // 文本块
  Blockly.Blocks['arduino_text'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('"')
        .appendField(new Blockly.FieldTextInput('Hello'), 'TEXT')
        .appendField('"');
      this.setOutput(true, 'String');
      this.setColour(160);
      this.setTooltip('文本字符串');
    }
  };

  // 数字块
  Blockly.Blocks['arduino_number'] = {
    init: function() {
      this.appendDummyInput()
        .appendField(new Blockly.FieldNumber(0), 'NUM');
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('数字');
    }
  };

  // ==================== 函数 (基础) ====================

  // 定义 void 函数
  Blockly.Blocks['arduino_function_void'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('定义函数')
        .appendField(new Blockly.FieldTextInput('myFunction'), 'NAME');
      this.appendStatementInput('BODY')
        .setCheck(null);
      this.setColour(290);
      this.setTooltip('定义一个无返回值的函数');
    }
  };

  // 调用函数
  Blockly.Blocks['arduino_call_function'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('调用函数')
        .appendField(new Blockly.FieldTextInput('myFunction'), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('调用一个函数');
    }
  };

  // ==================== ESP32 ====================

  // ledcSetup 块
  Blockly.Blocks['arduino_ledc_setup'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LEDC设置 通道')
        .appendField(new Blockly.FieldNumber(0, 0, 15), 'CHANNEL')
        .appendField('频率')
        .appendField(new Blockly.FieldNumber(5000, 1), 'FREQ')
        .appendField('分辨率')
        .appendField(new Blockly.FieldNumber(8, 1, 16), 'RESOLUTION');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('设置LEDC PWM通道');
    }
  };

  // ledcAttachPin 块
  Blockly.Blocks['arduino_ledc_attach'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LEDC绑定 引脚')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'PIN')
        .appendField('通道')
        .appendField(new Blockly.FieldNumber(0, 0, 15), 'CHANNEL');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('将引脚绑定到LEDC通道');
    }
  };

  // ledcWrite 块
  Blockly.Blocks['arduino_ledc_write'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LEDC写入 通道')
        .appendField(new Blockly.FieldNumber(0, 0, 15), 'CHANNEL')
        .appendField('占空比')
        .appendField(new Blockly.FieldNumber(128, 0, 255), 'DUTY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('设置LEDC通道占空比');
    }
  };

  // WiFi.begin 块
  Blockly.Blocks['arduino_wifi_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('WiFi连接')
        .appendField('SSID')
        .appendField(new Blockly.FieldTextInput('MyWiFi'), 'SSID')
        .appendField('密码')
        .appendField(new Blockly.FieldTextInput('password'), 'PASS');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('连接WiFi网络');
    }
  };

  // WiFi.status 块
  Blockly.Blocks['arduino_wifi_status'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('WiFi状态');
      this.setOutput(true, 'Number');
      this.setColour(60);
      this.setTooltip('获取WiFi连接状态');
    }
  };

  Blockly.Blocks['arduino_wifi_wait_connected'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('等待 WiFi 连接成功');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('阻塞等待 WiFi 连接成功，适合放在 setup 中');
    }
  };

  Blockly.Blocks['arduino_wifi_local_ip'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('WiFi 本机 IP');
      this.setOutput(true, 'String');
      this.setColour(60);
      this.setTooltip('获取当前 WiFi IP 地址字符串');
    }
  };

  Blockly.Blocks['arduino_http_get'] = {
    init: function() {
      this.appendValueInput('URL')
        .setCheck('String')
        .appendField('HTTP GET 地址');
      this.appendDummyInput()
        .appendField('结果保存到')
        .appendField(new Blockly.FieldTextInput('response'), 'VAR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('发送 HTTP GET 请求，并把响应内容保存到 String 变量');
    }
  };

  Blockly.Blocks['arduino_mqtt_setup'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('MQTT 设置服务器')
        .appendField(new Blockly.FieldTextInput('broker.emqx.io'), 'HOST')
        .appendField('端口')
        .appendField(new Blockly.FieldNumber(1883, 1, 65535), 'PORT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('设置 MQTT 服务器地址和端口');
    }
  };

  Blockly.Blocks['arduino_mqtt_connect'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('MQTT 连接 客户端ID')
        .appendField(new Blockly.FieldTextInput('esp32-client'), 'CLIENT_ID');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('循环等待直到 MQTT 连接成功');
    }
  };

  Blockly.Blocks['arduino_mqtt_publish'] = {
    init: function() {
      this.appendValueInput('PAYLOAD')
        .setCheck(null)
        .appendField('MQTT 发布 主题')
        .appendField(new Blockly.FieldTextInput('makefast/data'), 'TOPIC')
        .appendField('内容');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('向 MQTT 主题发布消息');
    }
  };

  Blockly.Blocks['arduino_mqtt_subscribe'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('MQTT 订阅主题')
        .appendField(new Blockly.FieldTextInput('makefast/cmd'), 'TOPIC');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('订阅 MQTT 主题。回调处理需要在代码中扩展');
    }
  };

  Blockly.Blocks['arduino_mqtt_loop'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('MQTT 保持连接');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('处理 MQTT 网络循环，建议放在 loop 中');
    }
  };

  Blockly.Blocks['arduino_preferences_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('Preferences 打开命名空间')
        .appendField(new Blockly.FieldTextInput('app'), 'NAMESPACE')
        .appendField('只读')
        .appendField(new Blockly.FieldDropdown([
          ['否', 'false'],
          ['是', 'true']
        ]), 'READONLY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(250);
      this.setTooltip('打开 ESP32 Preferences 键值存储');
    }
  };

  Blockly.Blocks['arduino_preferences_put_string'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('String')
        .appendField('Preferences 保存文本 键')
        .appendField(new Blockly.FieldTextInput('name'), 'KEY')
        .appendField('值');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(250);
      this.setTooltip('保存字符串到 ESP32 Preferences');
    }
  };

  Blockly.Blocks['arduino_preferences_get_string'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('Preferences 读取文本 键')
        .appendField(new Blockly.FieldTextInput('name'), 'KEY')
        .appendField('默认')
        .appendField(new Blockly.FieldTextInput(''), 'DEFAULT');
      this.setOutput(true, 'String');
      this.setColour(250);
      this.setTooltip('从 ESP32 Preferences 读取字符串');
    }
  };

  Blockly.Blocks['arduino_preferences_put_int'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('Preferences 保存整数 键')
        .appendField(new Blockly.FieldTextInput('count'), 'KEY')
        .appendField('值');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(250);
      this.setTooltip('保存整数到 ESP32 Preferences');
    }
  };

  Blockly.Blocks['arduino_preferences_get_int'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('Preferences 读取整数 键')
        .appendField(new Blockly.FieldTextInput('count'), 'KEY')
        .appendField('默认')
        .appendField(new Blockly.FieldNumber(0), 'DEFAULT');
      this.setOutput(true, 'Number');
      this.setColour(250);
      this.setTooltip('从 ESP32 Preferences 读取整数');
    }
  };

  Blockly.Blocks['arduino_deep_sleep_timer'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('ESP32 深度睡眠')
        .appendField(new Blockly.FieldNumber(60, 1), 'SECONDS')
        .appendField('秒后唤醒');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('进入深度睡眠，并在指定秒数后定时唤醒');
    }
  };

  // touchRead 块
  Blockly.Blocks['arduino_touch_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('触摸读取 引脚')
        .appendField(new Blockly.FieldNumber(4, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(60);
      this.setTooltip('读取触摸引脚值');
    }
  };

  // dacWrite 块
  Blockly.Blocks['arduino_dac_write'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('DAC写入 引脚')
        .appendField(new Blockly.FieldNumber(25, 25, 26), 'PIN')
        .appendField('值')
        .appendField(new Blockly.FieldNumber(128, 0, 255), 'VALUE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('DAC模拟输出（仅GPIO25/26）');
    }
  };

  // ==================== 通信 — I2C (Arduino) ====================

  // Wire.begin 块
  Blockly.Blocks['arduino_wire_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('I2C 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
      this.setTooltip('初始化I2C通信');
    }
  };

  // Wire.beginTransmission 块
  Blockly.Blocks['arduino_wire_begin_transmission'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('I2C 开始传输 地址')
        .appendField(new Blockly.FieldNumber(0, 0, 127), 'ADDR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
      this.setTooltip('开始I2C传输到指定地址');
    }
  };

  // Wire.write 块
  Blockly.Blocks['arduino_wire_write'] = {
    init: function() {
      this.appendValueInput('DATA')
        .setCheck(null)
        .appendField('I2C 写入');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
      this.setTooltip('I2C写入数据');
    }
  };

  // Wire.endTransmission 块
  Blockly.Blocks['arduino_wire_end_transmission'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('I2C 结束传输');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
      this.setTooltip('结束I2C传输');
    }
  };

  // Wire.requestFrom 块
  Blockly.Blocks['arduino_wire_request_from'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('I2C 请求数据 地址')
        .appendField(new Blockly.FieldNumber(0, 0, 127), 'ADDR')
        .appendField('字节数')
        .appendField(new Blockly.FieldNumber(1, 1, 32), 'COUNT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
      this.setTooltip('从I2C设备请求数据');
    }
  };

  // Wire.read 块
  Blockly.Blocks['arduino_wire_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('I2C 读取');
      this.setOutput(true, 'Number');
      this.setColour(200);
      this.setTooltip('读取I2C数据');
    }
  };

  // ==================== 执行器 — 舵机与蜂鸣器 (Arduino) ====================

  // servo.attach 块
  Blockly.Blocks['arduino_servo_attach'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('舵机绑定 引脚')
        .appendField(new Blockly.FieldNumber(9, 0, 39), 'PIN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(40);
      this.setTooltip('将舵机绑定到引脚');
    }
  };

  // servo.write 块
  Blockly.Blocks['arduino_servo_write'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('舵机转到 角度')
        .appendField(new Blockly.FieldNumber(90, 0, 180), 'ANGLE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(40);
      this.setTooltip('设置舵机角度（0-180）');
    }
  };

  // tone 块
  Blockly.Blocks['arduino_tone'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('发声 引脚')
        .appendField(new Blockly.FieldNumber(8, 0, 39), 'PIN')
        .appendField('频率')
        .appendField(new Blockly.FieldNumber(440, 31, 65535), 'FREQ')
        .appendField('时长')
        .appendField(new Blockly.FieldNumber(500, 0), 'DURATION');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(40);
      this.setTooltip('在引脚上产生指定频率的方波');
    }
  };

  // noTone 块
  Blockly.Blocks['arduino_notone'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('停止发声 引脚')
        .appendField(new Blockly.FieldNumber(8, 0, 39), 'PIN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(40);
      this.setTooltip('停止引脚上的方波输出');
    }
  };

  // ==================== 数据处理 — 数组 (Arduino) ====================

  // 声明数组
  Blockly.Blocks['arduino_declare_array'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('声明数组')
        .appendField(new Blockly.FieldDropdown([
          ['int', 'int'],
          ['float', 'float'],
          ['String', 'String']
        ]), 'TYPE')
        .appendField(new Blockly.FieldTextInput('myArray'), 'NAME')
        .appendField('[')
        .appendField(new Blockly.FieldNumber(10, 1, 1000), 'SIZE')
        .appendField(']');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(260);
      this.setTooltip('声明一个数组');
    }
  };

  // 数组赋值
  Blockly.Blocks['arduino_array_set'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('数组')
        .appendField(new Blockly.FieldTextInput('myArray'), 'NAME')
        .appendField('[')
        .appendField(new Blockly.FieldNumber(0, 0), 'INDEX')
        .appendField('] =');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(260);
      this.setTooltip('设置数组元素的值');
    }
  };

  // 数组取值
  Blockly.Blocks['arduino_array_get'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('数组')
        .appendField(new Blockly.FieldTextInput('myArray'), 'NAME')
        .appendField('[')
        .appendField(new Blockly.FieldNumber(0, 0), 'INDEX')
        .appendField(']');
      this.setOutput(true, null);
      this.setColour(260);
      this.setTooltip('获取数组元素的值');
    }
  };

  // ==================== 传感器 (Arduino) ====================

  // DHT 初始化
  Blockly.Blocks['arduino_dht_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('DHT 初始化 引脚')
        .appendField(new Blockly.FieldNumber(4, 0, 39), 'PIN')
        .appendField('类型')
        .appendField(new Blockly.FieldDropdown([
          ['DHT11', 'DHT11'],
          ['DHT22', 'DHT22'],
          ['DHT21', 'DHT21']
        ]), 'TYPE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(30);
      this.setTooltip('初始化DHT温湿度传感器');
    }
  };

  // DHT 读取温度
  Blockly.Blocks['arduino_dht_read_temp'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('DHT 读取温度');
      this.setOutput(true, 'Number');
      this.setColour(30);
      this.setTooltip('读取DHT传感器温度值');
    }
  };

  // DHT 读取湿度
  Blockly.Blocks['arduino_dht_read_humidity'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('DHT 读取湿度');
      this.setOutput(true, 'Number');
      this.setColour(30);
      this.setTooltip('读取DHT传感器湿度值');
    }
  };

  // 超声波测距
  Blockly.Blocks['arduino_ultrasonic_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('超声波测距 触发引脚')
        .appendField(new Blockly.FieldNumber(12, 0, 39), 'TRIG_PIN')
        .appendField('回声引脚')
        .appendField(new Blockly.FieldNumber(14, 0, 39), 'ECHO_PIN');
      this.setOutput(true, 'Number');
      this.setColour(30);
      this.setTooltip('使用超声波传感器测量距离（厘米）');
    }
  };

  // MPU6050 读取
  Blockly.Blocks['arduino_mpu6050_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('MPU6050 读取')
        .appendField(new Blockly.FieldDropdown([
          ['加速度', 'accel'],
          ['陀螺仪', 'gyro']
        ]), 'TYPE')
        .appendField('轴')
        .appendField(new Blockly.FieldDropdown([
          ['X', 'X'],
          ['Y', 'Y'],
          ['Z', 'Z']
        ]), 'AXIS');
      this.setOutput(true, 'Number');
      this.setColour(30);
      this.setTooltip('读取MPU6050加速度/陀螺仪数据');
    }
  };

  // ==================== 显示与灯带 — OLED (Arduino) ====================

  // OLED 初始化
  Blockly.Blocks['arduino_oled_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('OLED 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('初始化OLED显示屏（SSD1306, 地址0x3C）');
    }
  };

  // OLED 清屏
  Blockly.Blocks['arduino_oled_clear'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('OLED 清屏');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('清除OLED显示内容');
    }
  };

  // OLED 打印文本
  Blockly.Blocks['arduino_oled_print'] = {
    init: function() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('OLED 打印 X')
        .appendField(new Blockly.FieldNumber(0, 0, 127), 'X')
        .appendField('Y')
        .appendField(new Blockly.FieldNumber(0, 0, 63), 'Y')
        .appendField('内容');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('在OLED指定位置打印文本');
    }
  };

  // OLED 刷新显示
  Blockly.Blocks['arduino_oled_display'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('OLED 刷新显示');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('刷新OLED显示（将缓冲区内容显示到屏幕）');
    }
  };

  // OLED 设置文字大小
  Blockly.Blocks['arduino_oled_set_text_size'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('OLED 文字大小')
        .appendField(new Blockly.FieldNumber(1, 1, 8), 'SIZE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('设置OLED文字大小');
    }
  };

  // ==================== 显示与灯带 — NeoPixel (Arduino) ====================

  // NeoPixel 初始化
  Blockly.Blocks['arduino_neopixel_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('NeoPixel 初始化 引脚')
        .appendField(new Blockly.FieldNumber(5, 0, 39), 'PIN')
        .appendField('数量')
        .appendField(new Blockly.FieldNumber(8, 1, 300), 'COUNT');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(300);
      this.setTooltip('初始化NeoPixel灯带');
    }
  };

  // NeoPixel 设置颜色
  Blockly.Blocks['arduino_neopixel_set_color'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('NeoPixel 设置颜色 序号')
        .appendField(new Blockly.FieldNumber(0, 0), 'INDEX')
        .appendField('R')
        .appendField(new Blockly.FieldNumber(255, 0, 255), 'R')
        .appendField('G')
        .appendField(new Blockly.FieldNumber(0, 0, 255), 'G')
        .appendField('B')
        .appendField(new Blockly.FieldNumber(0, 0, 255), 'B');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(300);
      this.setTooltip('设置NeoPixel指定灯珠的颜色');
    }
  };

  // NeoPixel 显示
  Blockly.Blocks['arduino_neopixel_show'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('NeoPixel 显示');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(300);
      this.setTooltip('刷新NeoPixel灯带显示');
    }
  };

  // NeoPixel 清除
  Blockly.Blocks['arduino_neopixel_clear'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('NeoPixel 清除');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(300);
      this.setTooltip('清除NeoPixel所有灯珠颜色');
    }
  };

  // NeoPixel 亮度
  Blockly.Blocks['arduino_neopixel_brightness'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('NeoPixel 亮度')
        .appendField(new Blockly.FieldNumber(50, 0, 255), 'VALUE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(300);
      this.setTooltip('设置NeoPixel灯带亮度（0-255）');
    }
  };

  // ==================== 数据处理 — 数据转换 (Arduino) ====================

  // 转换为整数
  Blockly.Blocks['arduino_to_int'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('转为整数');
      this.setOutput(true, 'Number');
      this.setColour(330);
      this.setTooltip('将值转换为整数类型');
    }
  };

  // 转换为浮点数
  Blockly.Blocks['arduino_to_float'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('转为浮点数');
      this.setOutput(true, 'Number');
      this.setColour(330);
      this.setTooltip('将值转换为浮点数类型');
    }
  };

  // 转换为字符串
  Blockly.Blocks['arduino_to_string'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('转为字符串');
      this.setOutput(true, 'String');
      this.setColour(330);
      this.setTooltip('将值转换为字符串类型');
    }
  };

  // 字符串拼接
  Blockly.Blocks['arduino_string_concat'] = {
    init: function() {
      this.appendValueInput('A')
        .setCheck(null)
        .appendField('字符串拼接');
      this.appendValueInput('B')
        .setCheck(null)
        .appendField('+');
      this.setInputsInline(true);
      this.setOutput(true, 'String');
      this.setColour(330);
      this.setTooltip('拼接两个字符串');
    }
  };

  // 字符串长度
  Blockly.Blocks['arduino_string_length'] = {
    init: function() {
      this.appendValueInput('VALUE')
        .setCheck('String')
        .appendField('字符串长度');
      this.setOutput(true, 'Number');
      this.setColour(330);
      this.setTooltip('获取字符串的长度');
    }
  };

  // ==================== ESP32 — 中断 (Arduino) ====================

  // attachInterrupt
  Blockly.Blocks['arduino_attach_interrupt'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('附加中断 引脚')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'PIN')
        .appendField('函数')
        .appendField(new Blockly.FieldTextInput('onInterrupt'), 'FUNC')
        .appendField('模式')
        .appendField(new Blockly.FieldDropdown([
          ['上升沿', 'RISING'],
          ['下降沿', 'FALLING'],
          ['变化', 'CHANGE']
        ]), 'MODE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(0);
      this.setTooltip('在引脚上附加中断处理函数');
    }
  };

  // detachInterrupt
  Blockly.Blocks['arduino_detach_interrupt'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('移除中断 引脚')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'PIN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(0);
      this.setTooltip('移除引脚上的中断');
    }
  };

  // delayMicroseconds
  Blockly.Blocks['arduino_delay_microseconds'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('延时')
        .appendField(new Blockly.FieldNumber(100, 0), 'US')
        .appendField('微秒');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(0);
      this.setTooltip('延时指定微秒数');
    }
  };

  // micros
  Blockly.Blocks['arduino_micros'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('运行时间(微秒)');
      this.setOutput(true, 'Number');
      this.setColour(0);
      this.setTooltip('获取程序运行时间（微秒）');
    }
  };

  // ==================== 红外遥控 (Arduino) ====================

  // 红外接收 初始化
  Blockly.Blocks['arduino_ir_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('红外接收 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(350);
      this.setTooltip('初始化红外接收器');
    }
  };

  // 红外 有数据
  Blockly.Blocks['arduino_ir_available'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('红外 有数据');
      this.setOutput(true, 'Boolean');
      this.setColour(350);
      this.setTooltip('检测红外是否接收到数据');
    }
  };

  // 红外 读取编码
  Blockly.Blocks['arduino_ir_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('红外 读取编码');
      this.setOutput(true, 'Number');
      this.setColour(350);
      this.setTooltip('读取红外接收到的编码值');
    }
  };

  // 红外 继续接收
  Blockly.Blocks['arduino_ir_resume'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('红外 继续接收');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(350);
      this.setTooltip('红外继续接收下一个信号');
    }
  };

  // 红外发射 编码
  Blockly.Blocks['arduino_ir_send'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('红外发射 编码')
        .appendField(new Blockly.FieldNumber(0, 0), 'CODE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(350);
      this.setTooltip('通过红外发射指定编码（NEC协议，32位）');
    }
  };

  // ==================== 执行器 — 电机控制 (Arduino) ====================

  // 步进电机 初始化
  Blockly.Blocks['arduino_stepper_setup'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('步进电机 初始化')
        .appendField('步数/圈')
        .appendField(new Blockly.FieldNumber(2048, 1), 'STEPS')
        .appendField('引脚1')
        .appendField(new Blockly.FieldNumber(8, 0, 39), 'PIN1')
        .appendField('引脚2')
        .appendField(new Blockly.FieldNumber(9, 0, 39), 'PIN2')
        .appendField('引脚3')
        .appendField(new Blockly.FieldNumber(10, 0, 39), 'PIN3')
        .appendField('引脚4')
        .appendField(new Blockly.FieldNumber(11, 0, 39), 'PIN4');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('初始化步进电机（设置每圈步数和控制引脚）');
    }
  };

  // 步进电机 设置速度
  Blockly.Blocks['arduino_stepper_speed'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('步进电机 设置速度')
        .appendField(new Blockly.FieldNumber(10, 1), 'RPM')
        .appendField('RPM');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('设置步进电机转速（每分钟转数）');
    }
  };

  // 步进电机 转动步数
  Blockly.Blocks['arduino_stepper_step'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('步进电机 转动步数')
        .appendField(new Blockly.FieldNumber(100, -99999, 99999), 'STEPS');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('步进电机转动指定步数（正数正转，负数反转）');
    }
  };

  // 直流电机 正转
  Blockly.Blocks['arduino_motor_forward'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('直流电机 正转')
        .appendField('IN1引脚')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'IN1')
        .appendField('IN2引脚')
        .appendField(new Blockly.FieldNumber(3, 0, 39), 'IN2')
        .appendField('ENA引脚')
        .appendField(new Blockly.FieldNumber(5, 0, 39), 'ENA')
        .appendField('速度')
        .appendField(new Blockly.FieldNumber(200, 0, 255), 'SPEED');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('直流电机正转（L298N驱动）');
    }
  };

  // 直流电机 反转
  Blockly.Blocks['arduino_motor_backward'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('直流电机 反转')
        .appendField('IN1引脚')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'IN1')
        .appendField('IN2引脚')
        .appendField(new Blockly.FieldNumber(3, 0, 39), 'IN2')
        .appendField('ENA引脚')
        .appendField(new Blockly.FieldNumber(5, 0, 39), 'ENA')
        .appendField('速度')
        .appendField(new Blockly.FieldNumber(200, 0, 255), 'SPEED');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('直流电机反转（L298N驱动）');
    }
  };

  // 直流电机 停止
  Blockly.Blocks['arduino_motor_stop'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('直流电机 停止')
        .appendField('IN1引脚')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'IN1')
        .appendField('IN2引脚')
        .appendField(new Blockly.FieldNumber(3, 0, 39), 'IN2');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip('直流电机停止');
    }
  };

  // ==================== 执行器 — 开关控制 & 传感器 — 按钮/PIR (Arduino) ====================

  // 继电器 开启
  Blockly.Blocks['arduino_relay_on'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('继电器 开启 引脚')
        .appendField(new Blockly.FieldNumber(7, 0, 39), 'PIN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(10);
      this.setTooltip('继电器开启（高电平触发）');
    }
  };

  // 继电器 关闭
  Blockly.Blocks['arduino_relay_off'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('继电器 关闭 引脚')
        .appendField(new Blockly.FieldNumber(7, 0, 39), 'PIN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(10);
      this.setTooltip('继电器关闭（低电平）');
    }
  };

  // 按键 读取
  Blockly.Blocks['arduino_button_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('按键 读取 引脚')
        .appendField(new Blockly.FieldNumber(4, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(10);
      this.setTooltip('读取按键状态（数字输入）');
    }
  };

  // 人体感应 读取
  Blockly.Blocks['arduino_pir_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('人体感应 读取 引脚')
        .appendField(new Blockly.FieldNumber(6, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(10);
      this.setTooltip('读取PIR人体红外感应传感器状态');
    }
  };

  // ==================== 传感器 — 环境传感器 (Arduino) ====================

  // BMP280 温度
  Blockly.Blocks['arduino_bmp280_temp'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BMP280 温度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取BMP280温度值（摄氏度）');
    }
  };

  // BMP280 气压
  Blockly.Blocks['arduino_bmp280_pressure'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BMP280 气压');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取BMP280气压值（帕斯卡）');
    }
  };

  // BMP280 海拔
  Blockly.Blocks['arduino_bmp280_altitude'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BMP280 海拔');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取BMP280海拔高度（米）');
    }
  };

  Blockly.Blocks['arduino_bme280_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BME280 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 BME280 温湿度气压传感器，默认 I2C 地址 0x76');
    }
  };

  Blockly.Blocks['arduino_bme280_temp'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BME280 温度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 BME280 温度（摄氏度）');
    }
  };

  Blockly.Blocks['arduino_bme280_humidity'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BME280 湿度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 BME280 湿度（%）');
    }
  };

  Blockly.Blocks['arduino_bme280_pressure'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BME280 气压 hPa');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 BME280 气压（hPa）');
    }
  };

  Blockly.Blocks['arduino_bh1750_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BH1750 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 BH1750 光照传感器');
    }
  };

  Blockly.Blocks['arduino_bh1750_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BH1750 光照 lux');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 BH1750 光照强度 lux');
    }
  };

  Blockly.Blocks['arduino_hx711_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('HX711 初始化 DOUT')
        .appendField(new Blockly.FieldNumber(16, 0, 39), 'DOUT')
        .appendField('SCK')
        .appendField(new Blockly.FieldNumber(17, 0, 39), 'SCK');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 HX711 称重模块');
    }
  };

  Blockly.Blocks['arduino_hx711_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('HX711 读取重量');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 HX711 平均重量值，需要先校准比例系数');
    }
  };

  Blockly.Blocks['arduino_hx711_tare'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('HX711 去皮');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('将当前重量作为零点');
    }
  };

  Blockly.Blocks['arduino_rc522_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('RC522 初始化 SS')
        .appendField(new Blockly.FieldNumber(5, 0, 39), 'SS')
        .appendField('RST')
        .appendField(new Blockly.FieldNumber(22, 0, 39), 'RST');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 RC522 RFID 模块');
    }
  };

  Blockly.Blocks['arduino_rc522_card_available'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('RC522 检测到新卡');
      this.setOutput(true, 'Boolean');
      this.setColour(80);
      this.setTooltip('检测是否有新 RFID 卡片并读取序列号');
    }
  };

  Blockly.Blocks['arduino_rc522_uid'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('RC522 卡片 UID');
      this.setOutput(true, 'String');
      this.setColour(80);
      this.setTooltip('读取当前卡片 UID 字符串');
    }
  };

  // 气体传感器 读取
  Blockly.Blocks['arduino_mq_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('气体传感器 读取 引脚')
        .appendField(new Blockly.FieldNumber(34, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取MQ系列气体传感器模拟值');
    }
  };

  // 声音传感器 读取
  Blockly.Blocks['arduino_sound_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('声音传感器 读取 引脚')
        .appendField(new Blockly.FieldNumber(35, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取声音传感器模拟值');
    }
  };

  // 光照传感器 读取
  Blockly.Blocks['arduino_light_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('光照传感器 读取 引脚')
        .appendField(new Blockly.FieldNumber(36, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取光照传感器模拟值');
    }
  };

  // 土壤湿度 读取
  Blockly.Blocks['arduino_soil_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('土壤湿度 读取 引脚')
        .appendField(new Blockly.FieldNumber(32, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取土壤湿度传感器模拟值');
    }
  };

  Blockly.Blocks['arduino_water_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('水位传感器 读取 引脚')
        .appendField(new Blockly.FieldNumber(33, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取水位/雨滴传感器模拟值');
    }
  };

  Blockly.Blocks['arduino_flame_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('火焰传感器 读取 引脚')
        .appendField(new Blockly.FieldNumber(25, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取火焰传感器状态');
    }
  };

  Blockly.Blocks['arduino_tilt_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('倾斜开关 读取 引脚')
        .appendField(new Blockly.FieldNumber(26, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取倾斜开关状态');
    }
  };

  Blockly.Blocks['arduino_vibration_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('震动传感器 读取 引脚')
        .appendField(new Blockly.FieldNumber(27, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取震动传感器状态');
    }
  };

  Blockly.Blocks['arduino_encoder_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('旋转编码器 读取 引脚')
        .appendField(new Blockly.FieldDropdown([
          ['CLK', 'CLK'],
          ['DT', 'DT'],
          ['SW', 'SW']
        ]), 'PART')
        .appendField(new Blockly.FieldNumber(32, 0, 39), 'PIN');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取旋转编码器的 CLK/DT/SW 引脚状态');
    }
  };

  Blockly.Blocks['arduino_aht20_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('AHT20 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 AHT20 温湿度传感器');
    }
  };

  Blockly.Blocks['arduino_aht20_temp'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('AHT20 温度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 AHT20 温度');
    }
  };

  Blockly.Blocks['arduino_aht20_humidity'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('AHT20 湿度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 AHT20 湿度');
    }
  };

  Blockly.Blocks['arduino_sht31_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('SHT30/SHT31 初始化 地址')
        .appendField(new Blockly.FieldDropdown([
          ['0x44', '0x44'],
          ['0x45', '0x45']
        ]), 'ADDR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 SHT30/SHT31 温湿度传感器');
    }
  };

  Blockly.Blocks['arduino_sht31_temp'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('SHT30/SHT31 温度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 SHT30/SHT31 温度');
    }
  };

  Blockly.Blocks['arduino_sht31_humidity'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('SHT30/SHT31 湿度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 SHT30/SHT31 湿度');
    }
  };

  Blockly.Blocks['arduino_ds18b20_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('DS18B20 初始化 引脚')
        .appendField(new Blockly.FieldNumber(4, 0, 39), 'PIN');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 DS18B20 温度传感器');
    }
  };

  Blockly.Blocks['arduino_ds18b20_temp'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('DS18B20 温度');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('请求并读取 DS18B20 温度');
    }
  };

  Blockly.Blocks['arduino_tcs34725_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('TCS34725 颜色初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 TCS34725 颜色传感器');
    }
  };

  Blockly.Blocks['arduino_tcs34725_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('TCS34725 读取')
        .appendField(new Blockly.FieldDropdown([
          ['红色', 'R'],
          ['绿色', 'G'],
          ['蓝色', 'B'],
          ['清光', 'C']
        ]), 'CHANNEL');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 TCS34725 颜色通道');
    }
  };

  Blockly.Blocks['arduino_gps_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('GPS 初始化 RX')
        .appendField(new Blockly.FieldNumber(16, 0, 39), 'RX')
        .appendField('TX')
        .appendField(new Blockly.FieldNumber(17, 0, 39), 'TX')
        .appendField('波特率')
        .appendField(new Blockly.FieldDropdown([
          ['9600', '9600'],
          ['38400', '38400'],
          ['115200', '115200']
        ]), 'BAUD');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('初始化 GPS 串口');
    }
  };

  Blockly.Blocks['arduino_gps_update'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('GPS 更新数据');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(80);
      this.setTooltip('读取串口中的 GPS 数据，建议放在 loop 中');
    }
  };

  Blockly.Blocks['arduino_gps_value'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('GPS')
        .appendField(new Blockly.FieldDropdown([
          ['纬度', 'lat'],
          ['经度', 'lng'],
          ['速度 km/h', 'speed'],
          ['卫星数', 'satellites']
        ]), 'VALUE');
      this.setOutput(true, 'Number');
      this.setColour(80);
      this.setTooltip('读取 GPS 定位数据');
    }
  };

  Blockly.Blocks['arduino_lcd_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LCD1602 I2C 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('初始化 LCD1602 I2C 显示屏，默认地址 0x27');
    }
  };

  Blockly.Blocks['arduino_lcd_clear'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LCD 清屏');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('清除 LCD 显示内容');
    }
  };

  Blockly.Blocks['arduino_lcd_print'] = {
    init: function() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('LCD 打印 列')
        .appendField(new Blockly.FieldNumber(0, 0, 15), 'COL')
        .appendField('行')
        .appendField(new Blockly.FieldNumber(0, 0, 1), 'ROW')
        .appendField('内容');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('在 LCD 指定位置打印内容');
    }
  };

  Blockly.Blocks['arduino_lcd_backlight'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LCD 背光')
        .appendField(new Blockly.FieldDropdown([
          ['开启', 'backlight'],
          ['关闭', 'noBacklight']
        ]), 'STATE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(140);
      this.setTooltip('打开或关闭 LCD 背光');
    }
  };

  Blockly.Blocks['arduino_rgb_led_write'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('RGB LED 引脚 R')
        .appendField(new Blockly.FieldNumber(25, 0, 39), 'R_PIN')
        .appendField('G')
        .appendField(new Blockly.FieldNumber(26, 0, 39), 'G_PIN')
        .appendField('B')
        .appendField(new Blockly.FieldNumber(27, 0, 39), 'B_PIN');
      this.appendDummyInput()
        .appendField('颜色 R')
        .appendField(new Blockly.FieldNumber(255, 0, 255), 'R')
        .appendField('G')
        .appendField(new Blockly.FieldNumber(0, 0, 255), 'G')
        .appendField('B')
        .appendField(new Blockly.FieldNumber(0, 0, 255), 'B');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(40);
      this.setTooltip('用 PWM 控制普通 RGB LED');
    }
  };

  Blockly.Blocks['arduino_pwm_device_write'] = {
    init: function() {
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([
          ['水泵', '水泵'],
          ['风扇', '风扇'],
          ['LED', 'LED']
        ]), 'DEVICE')
        .appendField('PWM 引脚')
        .appendField(new Blockly.FieldNumber(5, 0, 39), 'PIN')
        .appendField('速度/亮度')
        .appendField(new Blockly.FieldNumber(180, 0, 255), 'VALUE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(40);
      this.setTooltip('控制水泵、风扇或 LED 的 PWM 输出');
    }
  };

  Blockly.Blocks['arduino_buzzer_note'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('蜂鸣器 引脚')
        .appendField(new Blockly.FieldNumber(8, 0, 39), 'PIN')
        .appendField('音符')
        .appendField(new Blockly.FieldDropdown([
          ['C4', '262'],
          ['D4', '294'],
          ['E4', '330'],
          ['F4', '349'],
          ['G4', '392'],
          ['A4', '440'],
          ['B4', '494'],
          ['C5', '523']
        ]), 'FREQ')
        .appendField('时长')
        .appendField(new Blockly.FieldNumber(300, 1), 'DURATION');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(40);
      this.setTooltip('播放常用音符');
    }
  };

  Blockly.Blocks['arduino_littlefs_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LittleFS 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(250);
      this.setTooltip('初始化 ESP32 LittleFS 文件系统');
    }
  };

  Blockly.Blocks['arduino_littlefs_write'] = {
    init: function() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('LittleFS 写文件 路径')
        .appendField(new Blockly.FieldTextInput('/data.txt'), 'PATH')
        .appendField('内容');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(250);
      this.setTooltip('向 LittleFS 文件写入文本');
    }
  };

  Blockly.Blocks['arduino_littlefs_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('LittleFS 读文件 路径')
        .appendField(new Blockly.FieldTextInput('/data.txt'), 'PATH');
      this.setOutput(true, 'String');
      this.setColour(250);
      this.setTooltip('读取 LittleFS 文件文本');
    }
  };

  Blockly.Blocks['arduino_sd_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('SD 卡初始化 CS')
        .appendField(new Blockly.FieldNumber(5, 0, 39), 'CS');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(250);
      this.setTooltip('初始化 SPI SD 卡');
    }
  };

  Blockly.Blocks['arduino_sd_write'] = {
    init: function() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('SD 写文件 路径')
        .appendField(new Blockly.FieldTextInput('/data.txt'), 'PATH')
        .appendField('内容');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(250);
      this.setTooltip('向 SD 卡文件写入文本');
    }
  };

  Blockly.Blocks['arduino_sd_read'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('SD 读文件 路径')
        .appendField(new Blockly.FieldTextInput('/data.txt'), 'PATH');
      this.setOutput(true, 'String');
      this.setColour(250);
      this.setTooltip('读取 SD 卡文件文本');
    }
  };

  Blockly.Blocks['arduino_espnow_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('ESP-NOW 初始化');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('初始化 ESP-NOW 通信');
    }
  };

  Blockly.Blocks['arduino_espnow_send'] = {
    init: function() {
      this.appendValueInput('MESSAGE')
        .setCheck(null)
        .appendField('ESP-NOW 发送到 MAC')
        .appendField(new Blockly.FieldTextInput('FF:FF:FF:FF:FF:FF'), 'MAC')
        .appendField('内容');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('向指定 MAC 地址发送文本消息');
    }
  };

  Blockly.Blocks['arduino_ble_uart_begin'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('BLE UART 初始化 名称')
        .appendField(new Blockly.FieldTextInput('MakeFast ESP32'), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('初始化 BLE 串口服务');
    }
  };

  Blockly.Blocks['arduino_ble_uart_notify'] = {
    init: function() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('BLE UART 发送');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('通过 BLE UART 通知发送文本');
    }
  };
};
