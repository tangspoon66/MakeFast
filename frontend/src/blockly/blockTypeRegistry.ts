/**
 * 积木类型元数据注册表
 * 从 arduinoBlocks.ts 和 arduinoGenerator.ts 提取，供代码→积木反向解析使用
 */

// ========== 类型定义 ==========

/** 积木输入类型 */
export type InputKind =
  | { type: 'field'; name: string }       // dummy input 中的字段
  | { type: 'value'; name: string }       // value input（嵌入表达式块）
  | { type: 'statement'; name: string };  // statement input（嵌入语句块链）

/** 积木定义 */
export interface BlockDef {
  type: string;
  inputs: InputKind[];
  /** 仅表达式块有 output */
  outputType?: string;
  /** 是否有 prev 连接（可被放在其他块之后） */
  hasPrev: boolean;
  /** 是否有 next 连接（可后接其他块） */
  hasNext: boolean;
  /** 是否有元数据注释标记（歧义积木） */
  hasMetadata: boolean;
}

/** 语句块模式 */
export interface StatementPattern {
  blockType: string;
  /** 正则匹配单行代码 */
  pattern: RegExp;
  /** 从正则匹配提取 field 值 */
  extractFields: (m: RegExpMatchArray) => Record<string, string>;
  /** value input 的名称列表及其在代码中的位置 */
  valueInputs?: string[];
  /** 是否为多行语句 */
  multiLine?: boolean;
}

/** 表达式块模式 */
export interface ExpressionPattern {
  blockType: string;
  /** 函数名，如 'digitalRead', 'analogRead', 'map', 'millis' 等 */
  funcName: string;
  /** 参数个数，-1 表示变长 */
  argCount: number;
  /** 是否可能歧义（多块映射到同一函数） */
  ambiguous?: boolean;
  /** 优先于其他同函数名块 */
  priority?: number;
}

/** 表达式块模式（精确匹配） */
export interface ExactExpressionPattern {
  blockType: string;
  /** 精确匹配整个表达式字符串的正则 */
  pattern: RegExp;
  /** 提取字段 */
  extractFields: (m: RegExpMatchArray) => string[];
  /** 是否为歧义积木 */
  ambiguous?: boolean;
}

// ========== 所有 102 个积木的定义 ==========

export const BLOCK_DEFS: Record<string, BlockDef> = {

  // ==================== 程序结构 ====================
  arduino_setup: {
    type: 'arduino_setup',
    inputs: [{ type: 'statement', name: 'SETUP' }],
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_loop: {
    type: 'arduino_loop',
    inputs: [{ type: 'statement', name: 'LOOP' }],
    hasPrev: true,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 控制流 ====================
  arduino_if: {
    type: 'arduino_if',
    inputs: [
      { type: 'value', name: 'CONDITION' },
      { type: 'statement', name: 'DO' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_if_else: {
    type: 'arduino_if_else',
    inputs: [
      { type: 'value', name: 'CONDITION' },
      { type: 'statement', name: 'DO' },
      { type: 'statement', name: 'ELSE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_for: {
    type: 'arduino_for',
    inputs: [
      { type: 'field', name: 'VAR' },
      { type: 'value', name: 'FROM' },
      { type: 'value', name: 'TO' },
      { type: 'value', name: 'STEP' },
      { type: 'statement', name: 'DO' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_while: {
    type: 'arduino_while',
    inputs: [
      { type: 'value', name: 'CONDITION' },
      { type: 'statement', name: 'DO' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_repeat: {
    type: 'arduino_repeat',
    inputs: [
      { type: 'value', name: 'TIMES' },
      { type: 'statement', name: 'DO' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: true,
  },
  arduino_break: {
    type: 'arduino_break',
    inputs: [],
    hasPrev: true,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 变量 ====================
  arduino_declare_int: {
    type: 'arduino_declare_int',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'value', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_declare_float: {
    type: 'arduino_declare_float',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'value', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_declare_string: {
    type: 'arduino_declare_string',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'value', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_declare_bool: {
    type: 'arduino_declare_bool',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'field', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_set_variable: {
    type: 'arduino_set_variable',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'value', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_get_variable: {
    type: 'arduino_get_variable',
    inputs: [{ type: 'field', name: 'NAME' }],
    outputType: 'untyped',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 运算 ====================
  arduino_math: {
    type: 'arduino_math',
    inputs: [
      { type: 'value', name: 'A' },
      { type: 'field', name: 'OP' },
      { type: 'value', name: 'B' },
    ],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_compare: {
    type: 'arduino_compare',
    inputs: [
      { type: 'value', name: 'A' },
      { type: 'field', name: 'OP' },
      { type: 'value', name: 'B' },
    ],
    outputType: 'Boolean',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_logic: {
    type: 'arduino_logic',
    inputs: [
      { type: 'value', name: 'A' },
      { type: 'field', name: 'OP' },
      { type: 'value', name: 'B' },
    ],
    outputType: 'Boolean',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_not: {
    type: 'arduino_not',
    inputs: [{ type: 'value', name: 'VALUE' }],
    outputType: 'Boolean',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_modulo: {
    type: 'arduino_modulo',
    inputs: [
      { type: 'value', name: 'A' },
      { type: 'value', name: 'B' },
    ],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_map: {
    type: 'arduino_map',
    inputs: [
      { type: 'value', name: 'VALUE' },
      { type: 'value', name: 'FROMLOW' },
      { type: 'value', name: 'FROMHIGH' },
      { type: 'value', name: 'TOLOW' },
      { type: 'value', name: 'TOHIGH' },
    ],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_constrain: {
    type: 'arduino_constrain',
    inputs: [
      { type: 'value', name: 'VALUE' },
      { type: 'value', name: 'MIN' },
      { type: 'value', name: 'MAX' },
    ],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_random: {
    type: 'arduino_random',
    inputs: [
      { type: 'value', name: 'MIN' },
      { type: 'value', name: 'MAX' },
    ],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 数字 I/O ====================
  arduino_pinmode: {
    type: 'arduino_pinmode',
    inputs: [
      { type: 'field', name: 'PIN' },
      { type: 'field', name: 'MODE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_digitalwrite: {
    type: 'arduino_digitalwrite',
    inputs: [
      { type: 'field', name: 'PIN' },
      { type: 'field', name: 'STATE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_digitalread: {
    type: 'arduino_digitalread',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 模拟 I/O ====================
  arduino_analogread: {
    type: 'arduino_analogread',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_analogwrite: {
    type: 'arduino_analogwrite',
    inputs: [
      { type: 'field', name: 'PIN' },
      { type: 'field', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== 时间 ====================
  arduino_delay: {
    type: 'arduino_delay',
    inputs: [{ type: 'field', name: 'TIME' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_millis: {
    type: 'arduino_millis',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 串口 ====================
  arduino_serial_begin: {
    type: 'arduino_serial_begin',
    inputs: [{ type: 'field', name: 'BAUD' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_serial_print: {
    type: 'arduino_serial_print',
    inputs: [{ type: 'value', name: 'TEXT' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_serial_println: {
    type: 'arduino_serial_println',
    inputs: [{ type: 'value', name: 'TEXT' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== 文本和数字 ====================
  arduino_text: {
    type: 'arduino_text',
    inputs: [{ type: 'field', name: 'TEXT' }],
    outputType: 'String',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_number: {
    type: 'arduino_number',
    inputs: [{ type: 'field', name: 'NUM' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 函数 ====================
  arduino_function_void: {
    type: 'arduino_function_void',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'statement', name: 'BODY' },
    ],
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_call_function: {
    type: 'arduino_call_function',
    inputs: [{ type: 'field', name: 'NAME' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== ESP32 ====================
  arduino_ledc_setup: {
    type: 'arduino_ledc_setup',
    inputs: [
      { type: 'field', name: 'CHANNEL' },
      { type: 'field', name: 'FREQ' },
      { type: 'field', name: 'RESOLUTION' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_ledc_attach: {
    type: 'arduino_ledc_attach',
    inputs: [
      { type: 'field', name: 'PIN' },
      { type: 'field', name: 'CHANNEL' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_ledc_write: {
    type: 'arduino_ledc_write',
    inputs: [
      { type: 'field', name: 'CHANNEL' },
      { type: 'field', name: 'DUTY' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_wifi_begin: {
    type: 'arduino_wifi_begin',
    inputs: [
      { type: 'field', name: 'SSID' },
      { type: 'field', name: 'PASS' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_wifi_status: {
    type: 'arduino_wifi_status',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_touch_read: {
    type: 'arduino_touch_read',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_dac_write: {
    type: 'arduino_dac_write',
    inputs: [
      { type: 'field', name: 'PIN' },
      { type: 'field', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== I2C ====================
  arduino_wire_begin: {
    type: 'arduino_wire_begin',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_wire_begin_transmission: {
    type: 'arduino_wire_begin_transmission',
    inputs: [{ type: 'field', name: 'ADDR' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_wire_write: {
    type: 'arduino_wire_write',
    inputs: [{ type: 'value', name: 'DATA' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_wire_end_transmission: {
    type: 'arduino_wire_end_transmission',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_wire_request_from: {
    type: 'arduino_wire_request_from',
    inputs: [
      { type: 'field', name: 'ADDR' },
      { type: 'field', name: 'COUNT' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_wire_read: {
    type: 'arduino_wire_read',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 常用库 ====================
  arduino_servo_attach: {
    type: 'arduino_servo_attach',
    inputs: [{ type: 'field', name: 'PIN' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_servo_write: {
    type: 'arduino_servo_write',
    inputs: [{ type: 'field', name: 'ANGLE' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_tone: {
    type: 'arduino_tone',
    inputs: [
      { type: 'field', name: 'PIN' },
      { type: 'field', name: 'FREQ' },
      { type: 'field', name: 'DURATION' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_notone: {
    type: 'arduino_notone',
    inputs: [{ type: 'field', name: 'PIN' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== 数组 ====================
  arduino_declare_array: {
    type: 'arduino_declare_array',
    inputs: [
      { type: 'field', name: 'TYPE' },
      { type: 'field', name: 'NAME' },
      { type: 'field', name: 'SIZE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_array_set: {
    type: 'arduino_array_set',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'field', name: 'INDEX' },
      { type: 'value', name: 'VALUE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_array_get: {
    type: 'arduino_array_get',
    inputs: [
      { type: 'field', name: 'NAME' },
      { type: 'field', name: 'INDEX' },
    ],
    outputType: 'untyped',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 传感器 ====================
  arduino_dht_begin: {
    type: 'arduino_dht_begin',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_dht_read_temp: {
    type: 'arduino_dht_read_temp',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_dht_read_humidity: {
    type: 'arduino_dht_read_humidity',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_ultrasonic_read: {
    type: 'arduino_ultrasonic_read',
    inputs: [
      { type: 'field', name: 'TRIG_PIN' },
      { type: 'field', name: 'ECHO_PIN' },
    ],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_mpu6050_read: {
    type: 'arduino_mpu6050_read',
    inputs: [
      { type: 'field', name: 'TYPE' },
      { type: 'field', name: 'AXIS' },
    ],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 显示 OLED ====================
  arduino_oled_begin: {
    type: 'arduino_oled_begin',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_oled_clear: {
    type: 'arduino_oled_clear',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_oled_print: {
    type: 'arduino_oled_print',
    inputs: [
      { type: 'field', name: 'X' },
      { type: 'field', name: 'Y' },
      { type: 'value', name: 'TEXT' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_oled_display: {
    type: 'arduino_oled_display',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_oled_set_text_size: {
    type: 'arduino_oled_set_text_size',
    inputs: [{ type: 'field', name: 'SIZE' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== NeoPixel ====================
  arduino_neopixel_begin: {
    type: 'arduino_neopixel_begin',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_neopixel_set_color: {
    type: 'arduino_neopixel_set_color',
    inputs: [
      { type: 'field', name: 'INDEX' },
      { type: 'field', name: 'R' },
      { type: 'field', name: 'G' },
      { type: 'field', name: 'B' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_neopixel_show: {
    type: 'arduino_neopixel_show',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_neopixel_clear: {
    type: 'arduino_neopixel_clear',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_neopixel_brightness: {
    type: 'arduino_neopixel_brightness',
    inputs: [{ type: 'field', name: 'VALUE' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== 数据转换 ====================
  arduino_to_int: {
    type: 'arduino_to_int',
    inputs: [{ type: 'value', name: 'VALUE' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_to_float: {
    type: 'arduino_to_float',
    inputs: [{ type: 'value', name: 'VALUE' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_to_string: {
    type: 'arduino_to_string',
    inputs: [{ type: 'value', name: 'VALUE' }],
    outputType: 'String',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_string_concat: {
    type: 'arduino_string_concat',
    inputs: [
      { type: 'value', name: 'A' },
      { type: 'value', name: 'B' },
    ],
    outputType: 'String',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_string_length: {
    type: 'arduino_string_length',
    inputs: [{ type: 'value', name: 'VALUE' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 中断和定时 ====================
  arduino_attach_interrupt: {
    type: 'arduino_attach_interrupt',
    inputs: [
      { type: 'field', name: 'PIN' },
      { type: 'field', name: 'FUNC' },
      { type: 'field', name: 'MODE' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_detach_interrupt: {
    type: 'arduino_detach_interrupt',
    inputs: [{ type: 'field', name: 'PIN' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_delay_microseconds: {
    type: 'arduino_delay_microseconds',
    inputs: [{ type: 'field', name: 'US' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_micros: {
    type: 'arduino_micros',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },

  // ==================== 红外遥控 ====================
  arduino_ir_begin: {
    type: 'arduino_ir_begin',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_ir_available: {
    type: 'arduino_ir_available',
    inputs: [],
    outputType: 'Boolean',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_ir_read: {
    type: 'arduino_ir_read',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_ir_resume: {
    type: 'arduino_ir_resume',
    inputs: [],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_ir_send: {
    type: 'arduino_ir_send',
    inputs: [{ type: 'field', name: 'CODE' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },

  // ==================== 电机控制 ====================
  arduino_stepper_setup: {
    type: 'arduino_stepper_setup',
    inputs: [
      { type: 'field', name: 'STEPS' },
      { type: 'field', name: 'PIN1' },
      { type: 'field', name: 'PIN2' },
      { type: 'field', name: 'PIN3' },
      { type: 'field', name: 'PIN4' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_stepper_speed: {
    type: 'arduino_stepper_speed',
    inputs: [{ type: 'field', name: 'RPM' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_stepper_step: {
    type: 'arduino_stepper_step',
    inputs: [{ type: 'field', name: 'STEPS' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: false,
  },
  arduino_motor_forward: {
    type: 'arduino_motor_forward',
    inputs: [
      { type: 'field', name: 'IN1' },
      { type: 'field', name: 'IN2' },
      { type: 'field', name: 'ENA' },
      { type: 'field', name: 'SPEED' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: true,
  },
  arduino_motor_backward: {
    type: 'arduino_motor_backward',
    inputs: [
      { type: 'field', name: 'IN1' },
      { type: 'field', name: 'IN2' },
      { type: 'field', name: 'ENA' },
      { type: 'field', name: 'SPEED' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: true,
  },
  arduino_motor_stop: {
    type: 'arduino_motor_stop',
    inputs: [
      { type: 'field', name: 'IN1' },
      { type: 'field', name: 'IN2' },
    ],
    hasPrev: true,
    hasNext: true,
    hasMetadata: true,
  },

  // ==================== 开关控制 ====================
  arduino_relay_on: {
    type: 'arduino_relay_on',
    inputs: [{ type: 'field', name: 'PIN' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: true,
  },
  arduino_relay_off: {
    type: 'arduino_relay_off',
    inputs: [{ type: 'field', name: 'PIN' }],
    hasPrev: true,
    hasNext: true,
    hasMetadata: true,
  },
  arduino_button_read: {
    type: 'arduino_button_read',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: true,
  },
  arduino_pir_read: {
    type: 'arduino_pir_read',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: true,
  },

  // ==================== 环境传感器 ====================
  arduino_bmp280_temp: {
    type: 'arduino_bmp280_temp',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_bmp280_pressure: {
    type: 'arduino_bmp280_pressure',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_bmp280_altitude: {
    type: 'arduino_bmp280_altitude',
    inputs: [],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: false,
  },
  arduino_mq_read: {
    type: 'arduino_mq_read',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: true,
  },
  arduino_sound_read: {
    type: 'arduino_sound_read',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: true,
  },
  arduino_light_read: {
    type: 'arduino_light_read',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: true,
  },
  arduino_soil_read: {
    type: 'arduino_soil_read',
    inputs: [{ type: 'field', name: 'PIN' }],
    outputType: 'Number',
    hasPrev: false,
    hasNext: false,
    hasMetadata: true,
  },
};

// ========== 语句块匹配模式 ==========
// 按匹配优先级排列（更具体的模式在前面）

export const STATEMENT_PATTERNS: StatementPattern[] = [
  // --- 控制流（需在单行匹配之前处理） ---

  // --- 数字 I/O ---
  {
    blockType: 'arduino_pinmode',
    pattern: /^\s*pinMode\s*\(\s*(\d+|[A-Za-z_]\w*)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1], MODE: m[2] }),
  },
  {
    blockType: 'arduino_digitalwrite',
    pattern: /^\s*digitalWrite\s*\(\s*(\d+|[A-Za-z_]\w*)\s*,\s*(HIGH|LOW)\s*\)\s*(?:\s*\/\*.*?\*\/)?\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1], STATE: m[2] }),
  },

  // --- 模拟 I/O ---
  {
    blockType: 'arduino_analogwrite',
    pattern: /^\s*analogWrite\s*\(\s*(\d+|[A-Za-z_]\w*)\s*,\s*(\d+|[A-Za-z_]\w*)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1], VALUE: m[2] }),
  },

  // --- 时间 ---
  {
    blockType: 'arduino_delay',
    pattern: /^\s*delay\s*\(\s*(\d+|[A-Za-z_]\w*)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ TIME: m[1] }),
  },

  // --- 串口 ---
  {
    blockType: 'arduino_serial_begin',
    pattern: /^\s*Serial\s*\.\s*begin\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ BAUD: m[1] }),
  },
  {
    blockType: 'arduino_serial_print',
    pattern: /^\s*Serial\s*\.\s*print\s*\((.+)\)\s*;\s*$/,
    extractFields: () => ({}),
    valueInputs: ['TEXT'],
  },
  {
    blockType: 'arduino_serial_println',
    pattern: /^\s*Serial\s*\.\s*println\s*\((.+)\)\s*;\s*$/,
    extractFields: () => ({}),
    valueInputs: ['TEXT'],
  },

  // --- 变量声明 ---
  {
    blockType: 'arduino_declare_int',
    pattern: /^\s*int\s+([A-Za-z_]\w*)\s*=\s*(.+)\s*;\s*$/,
    extractFields: (m) => ({ NAME: m[1] }),
    valueInputs: ['VALUE'],
  },
  {
    blockType: 'arduino_declare_float',
    pattern: /^\s*float\s+([A-Za-z_]\w*)\s*=\s*(.+)\s*;\s*$/,
    extractFields: (m) => ({ NAME: m[1] }),
    valueInputs: ['VALUE'],
  },
  {
    blockType: 'arduino_declare_string',
    pattern: /^\s*String\s+([A-Za-z_]\w*)\s*=\s*(.+)\s*;\s*$/,
    extractFields: (m) => ({ NAME: m[1] }),
    valueInputs: ['VALUE'],
  },
  {
    blockType: 'arduino_declare_bool',
    pattern: /^\s*bool\s+([A-Za-z_]\w*)\s*=\s*(true|false)\s*;\s*$/,
    extractFields: (m) => ({ NAME: m[1], VALUE: m[2] }),
  },

  // --- 变量赋值 ---
  {
    blockType: 'arduino_set_variable',
    pattern: /^\s*([A-Za-z_]\w*)\s*=\s*(.+)\s*;\s*$/,
    extractFields: (m) => ({ NAME: m[1] }),
    valueInputs: ['VALUE'],
  },

  // --- break ---
  {
    blockType: 'arduino_break',
    pattern: /^\s*break\s*;\s*$/,
    extractFields: () => ({}),
  },

  // --- ESP32 ---
  {
    blockType: 'arduino_ledc_setup',
    pattern: /^\s*ledcSetup\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ CHANNEL: m[1], FREQ: m[2], RESOLUTION: m[3] }),
  },
  {
    blockType: 'arduino_ledc_attach',
    pattern: /^\s*ledcAttachPin\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1], CHANNEL: m[2] }),
  },
  {
    blockType: 'arduino_ledc_write',
    pattern: /^\s*ledcWrite\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ CHANNEL: m[1], DUTY: m[2] }),
  },
  {
    blockType: 'arduino_wifi_begin',
    pattern: /^\s*WiFi\s*\.\s*begin\s*\(\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)\s*;\s*$/,
    extractFields: (m) => ({ SSID: m[1], PASS: m[2] }),
  },
  {
    blockType: 'arduino_dac_write',
    pattern: /^\s*dacWrite\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1], VALUE: m[2] }),
  },

  // --- I2C ---
  {
    blockType: 'arduino_wire_begin',
    pattern: /^\s*Wire\s*\.\s*begin\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_wire_begin_transmission',
    pattern: /^\s*Wire\s*\.\s*beginTransmission\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ ADDR: m[1] }),
  },
  {
    blockType: 'arduino_wire_write',
    pattern: /^\s*Wire\s*\.\s*write\s*\((.+)\)\s*;\s*$/,
    extractFields: () => ({}),
    valueInputs: ['DATA'],
  },
  {
    blockType: 'arduino_wire_end_transmission',
    pattern: /^\s*Wire\s*\.\s*endTransmission\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_wire_request_from',
    pattern: /^\s*Wire\s*\.\s*requestFrom\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ ADDR: m[1], COUNT: m[2] }),
  },

  // --- 常用库 ---
  {
    blockType: 'arduino_servo_attach',
    pattern: /^\s*myServo\s*\.\s*attach\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1] }),
  },
  {
    blockType: 'arduino_servo_write',
    pattern: /^\s*myServo\s*\.\s*write\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ ANGLE: m[1] }),
  },
  {
    blockType: 'arduino_tone',
    pattern: /^\s*tone\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1], FREQ: m[2], DURATION: m[3] }),
  },
  {
    blockType: 'arduino_notone',
    pattern: /^\s*noTone\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1] }),
  },

  // --- 数组 ---
  {
    blockType: 'arduino_declare_array',
    pattern: /^\s*(int|float|String)\s+([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*;\s*$/,
    extractFields: (m) => ({ TYPE: m[1], NAME: m[2], SIZE: m[3] }),
  },
  {
    blockType: 'arduino_array_set',
    pattern: /^\s*([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*=\s*(.+)\s*;\s*$/,
    extractFields: (m) => ({ NAME: m[1], INDEX: m[2] }),
    valueInputs: ['VALUE'],
  },

  // --- 传感器 ---
  {
    blockType: 'arduino_dht_begin',
    pattern: /^\s*dht\s*\.\s*begin\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },

  // --- 显示 OLED ---
  {
    blockType: 'arduino_oled_begin',
    pattern: /^\s*display\s*\.\s*begin\s*\(\s*SSD1306_SWITCHCAPVCC\s*,\s*0x3C\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_oled_clear',
    pattern: /^\s*display\s*\.\s*clearDisplay\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_oled_display',
    pattern: /^\s*display\s*\.\s*display\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_oled_set_text_size',
    pattern: /^\s*display\s*\.\s*setTextSize\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ SIZE: m[1] }),
  },

  // --- NeoPixel ---
  {
    blockType: 'arduino_neopixel_set_color',
    pattern: /^\s*strip\s*\.\s*setPixelColor\s*\(\s*(\d+)\s*,\s*strip\s*\.\s*Color\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ INDEX: m[1], R: m[2], G: m[3], B: m[4] }),
  },
  {
    blockType: 'arduino_neopixel_show',
    pattern: /^\s*strip\s*\.\s*show\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_neopixel_clear',
    pattern: /^\s*strip\s*\.\s*clear\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_neopixel_brightness',
    pattern: /^\s*strip\s*\.\s*setBrightness\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ VALUE: m[1] }),
  },

  // --- 中断 ---
  {
    blockType: 'arduino_attach_interrupt',
    pattern: /^\s*attachInterrupt\s*\(\s*digitalPinToInterrupt\s*\(\s*(\d+)\s*\)\s*,\s*([A-Za-z_]\w*)\s*,\s*(RISING|FALLING|CHANGE)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1], FUNC: m[2], MODE: m[3] }),
  },
  {
    blockType: 'arduino_detach_interrupt',
    pattern: /^\s*detachInterrupt\s*\(\s*digitalPinToInterrupt\s*\(\s*(\d+)\s*\)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ PIN: m[1] }),
  },
  {
    blockType: 'arduino_delay_microseconds',
    pattern: /^\s*delayMicroseconds\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ US: m[1] }),
  },

  // --- 红外 ---
  {
    blockType: 'arduino_ir_begin',
    pattern: /^\s*irrecv\s*\.\s*enableIRIn\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_ir_resume',
    pattern: /^\s*irrecv\s*\.\s*resume\s*\(\s*\)\s*;\s*$/,
    extractFields: () => ({}),
  },
  {
    blockType: 'arduino_ir_send',
    pattern: /^\s*irsend\s*\.\s*sendNEC\s*\(\s*(\d+|0x[0-9a-fA-F]+)\s*,\s*32\s*\)\s*;\s*$/,
    extractFields: (m) => ({ CODE: m[1] }),
  },

  // --- 步进电机 ---
  {
    blockType: 'arduino_stepper_setup',
    pattern: /^\s*Stepper\s+myStepper\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ STEPS: m[1], PIN1: m[2], PIN2: m[3], PIN3: m[4], PIN4: m[5] }),
  },
  {
    blockType: 'arduino_stepper_speed',
    pattern: /^\s*myStepper\s*\.\s*setSpeed\s*\(\s*(\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ RPM: m[1] }),
  },
  {
    blockType: 'arduino_stepper_step',
    pattern: /^\s*myStepper\s*\.\s*step\s*\(\s*(-?\d+)\s*\)\s*;\s*$/,
    extractFields: (m) => ({ STEPS: m[1] }),
  },

  // --- 函数调用 ---
  {
    blockType: 'arduino_call_function',
    pattern: /^\s*([A-Za-z_]\w*)\s*\(\s*\)\s*;\s*$/,
    extractFields: (m) => ({ NAME: m[1] }),
  },
];

// ========== 表达式块模式（按函数名索引） ==========

/** 无歧义表达式块：函数名到积木类型的直接映射 */
export const EXPRESSION_FUNC_MAP: Record<string, { blockType: string; fieldNames: string[] }> = {
  // 数字 I/O
  'digitalRead': { blockType: 'arduino_digitalread', fieldNames: ['PIN'] },

  // 模拟 I/O
  'analogRead': { blockType: 'arduino_analogread', fieldNames: ['PIN'] },

  // 时间
  'millis': { blockType: 'arduino_millis', fieldNames: [] },
  'micros': { blockType: 'arduino_micros', fieldNames: [] },

  // 运算
  'map': { blockType: 'arduino_map', fieldNames: ['VALUE', 'FROMLOW', 'FROMHIGH', 'TOLOW', 'TOHIGH'] },
  'constrain': { blockType: 'arduino_constrain', fieldNames: ['VALUE', 'MIN', 'MAX'] },
  'random': { blockType: 'arduino_random', fieldNames: ['MIN', 'MAX'] },

  // ESP32
  'touchRead': { blockType: 'arduino_touch_read', fieldNames: ['PIN'] },

  // I2C
  'Wire.read': { blockType: 'arduino_wire_read', fieldNames: [] },

  // 传感器
  'dht.readTemperature': { blockType: 'arduino_dht_read_temp', fieldNames: [] },
  'dht.readHumidity': { blockType: 'arduino_dht_read_humidity', fieldNames: [] },
  'bmp.readTemperature': { blockType: 'arduino_bmp280_temp', fieldNames: [] },
  'bmp.readPressure': { blockType: 'arduino_bmp280_pressure', fieldNames: [] },
  'bmp.readAltitude': { blockType: 'arduino_bmp280_altitude', fieldNames: [] },

  // MPU6050
  'mpu.getAccelerationX': { blockType: 'arduino_mpu6050_read', fieldNames: ['TYPE', 'AXIS'] },
  'mpu.getAccelerationY': { blockType: 'arduino_mpu6050_read', fieldNames: ['TYPE', 'AXIS'] },
  'mpu.getAccelerationZ': { blockType: 'arduino_mpu6050_read', fieldNames: ['TYPE', 'AXIS'] },
  'mpu.getRotationX': { blockType: 'arduino_mpu6050_read', fieldNames: ['TYPE', 'AXIS'] },
  'mpu.getRotationY': { blockType: 'arduino_mpu6050_read', fieldNames: ['TYPE', 'AXIS'] },
  'mpu.getRotationZ': { blockType: 'arduino_mpu6050_read', fieldNames: ['TYPE', 'AXIS'] },

  // WiFi
  'WiFi.status': { blockType: 'arduino_wifi_status', fieldNames: [] },

  // 红外
  'irrecv.decode': { blockType: 'arduino_ir_available', fieldNames: [] },
  'results.value': { blockType: 'arduino_ir_read', fieldNames: [] },

  // 字符串
  'String': { blockType: 'arduino_to_string', fieldNames: ['VALUE'] },
};

/** 歧义表达式块：同一函数名对应多个积木，需元数据区分 */
export const AMBIGUOUS_EXPR_FUNCS: Record<string, { blockType: string; priority: number }[]> = {
  'analogRead': [
    { blockType: 'arduino_analogread', priority: 0 },    // 通用形式，优先级最低
    { blockType: 'arduino_mq_read', priority: 10 },
    { blockType: 'arduino_sound_read', priority: 10 },
    { blockType: 'arduino_light_read', priority: 10 },
    { blockType: 'arduino_soil_read', priority: 10 },
  ],
  'digitalRead': [
    { blockType: 'arduino_digitalread', priority: 0 },   // 通用形式
    { blockType: 'arduino_button_read', priority: 10 },
    { blockType: 'arduino_pir_read', priority: 10 },
  ],
};
