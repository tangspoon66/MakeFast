import { LESSON_TOOLBOX_CATEGORY } from './lessonBlocks';
/**
 * Blockly 工具箱配置
 * 参考 Mind+/Mixly 分类，分为基础、ESP32、Arduino 三大组
 */

export const toolboxConfig = {
  kind: 'categoryToolbox',
  contents: [
    // ======================== 基础 ========================
    LESSON_TOOLBOX_CATEGORY,
    { kind: 'sep', gap: '24' }, // 分组：基础（顶层 label 只在 flyout 里合法，会报 console.warn）

    // 1. 程序结构
    {
      kind: 'category',
      name: '程序结构',
      colour: '120',
      contents: [
        { kind: 'block', type: 'arduino_setup' },
        { kind: 'block', type: 'arduino_loop' }
      ]
    },
    // 2. 控制流
    {
      kind: 'category',
      name: '控制流',
      colour: '30',
      contents: [
        { kind: 'block', type: 'arduino_if' },
        { kind: 'block', type: 'arduino_if_else' },
        {
          kind: 'block',
          type: 'arduino_for',
          inputs: {
            FROM: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } },
            TO: { shadow: { type: 'arduino_number', fields: { NUM: 10 } } },
            STEP: { shadow: { type: 'arduino_number', fields: { NUM: 1 } } }
          }
        },
        { kind: 'block', type: 'arduino_while' },
        {
          kind: 'block',
          type: 'arduino_repeat',
          inputs: {
            TIMES: { shadow: { type: 'arduino_number', fields: { NUM: 10 } } }
          }
        },
        { kind: 'block', type: 'arduino_break' }
      ]
    },
    // 3. 变量
    {
      kind: 'category',
      name: '变量',
      colour: '270',
      contents: [
        {
          kind: 'block',
          type: 'arduino_declare_int',
          inputs: {
            VALUE: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } }
          }
        },
        {
          kind: 'block',
          type: 'arduino_declare_float',
          inputs: {
            VALUE: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } }
          }
        },
        {
          kind: 'block',
          type: 'arduino_declare_string',
          inputs: {
            VALUE: { shadow: { type: 'arduino_text', fields: { TEXT: 'hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_declare_bool' },
        {
          kind: 'block',
          type: 'arduino_set_variable',
          inputs: {
            VALUE: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } }
          }
        },
        { kind: 'block', type: 'arduino_get_variable' }
      ]
    },
    // 4. 运算
    {
      kind: 'category',
      name: '运算',
      colour: '210',
      contents: [
        {
          kind: 'block',
          type: 'arduino_math',
          inputs: {
            A: { shadow: { type: 'arduino_number', fields: { NUM: 1 } } },
            B: { shadow: { type: 'arduino_number', fields: { NUM: 1 } } }
          }
        },
        {
          kind: 'block',
          type: 'arduino_compare',
          inputs: {
            A: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } },
            B: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } }
          }
        },
        { kind: 'block', type: 'arduino_logic' },
        { kind: 'block', type: 'arduino_not' },
        {
          kind: 'block',
          type: 'arduino_modulo',
          inputs: {
            A: { shadow: { type: 'arduino_number', fields: { NUM: 10 } } },
            B: { shadow: { type: 'arduino_number', fields: { NUM: 3 } } }
          }
        },
        {
          kind: 'block',
          type: 'arduino_map',
          inputs: {
            VALUE: { shadow: { type: 'arduino_number', fields: { NUM: 512 } } },
            FROMLOW: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } },
            FROMHIGH: { shadow: { type: 'arduino_number', fields: { NUM: 1023 } } },
            TOLOW: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } },
            TOHIGH: { shadow: { type: 'arduino_number', fields: { NUM: 255 } } }
          }
        },
        {
          kind: 'block',
          type: 'arduino_constrain',
          inputs: {
            VALUE: { shadow: { type: 'arduino_number', fields: { NUM: 128 } } },
            MIN: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } },
            MAX: { shadow: { type: 'arduino_number', fields: { NUM: 255 } } }
          }
        },
        {
          kind: 'block',
          type: 'arduino_random',
          inputs: {
            MIN: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } },
            MAX: { shadow: { type: 'arduino_number', fields: { NUM: 100 } } }
          }
        },
        { kind: 'block', type: 'arduino_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'arduino_text', fields: { TEXT: 'Hello' } }
      ]
    },
    // 5. 函数
    {
      kind: 'category',
      name: '函数',
      colour: '270',
      contents: [
        { kind: 'block', type: 'arduino_function_void' },
        { kind: 'block', type: 'arduino_call_function' }
      ]
    },

    // ======================== 硬件通用 ========================
    { kind: 'sep', gap: '24' }, // 分组：硬件通用（顶层 label 只在 flyout 里合法，会报 console.warn）

    // 7. 输入/输出
    {
      kind: 'category',
      name: '输入/输出',
      colour: '180',
      contents: [
        { kind: 'block', type: 'arduino_pinmode', fields: { PIN: 13, MODE: 'OUTPUT' } },
        { kind: 'block', type: 'arduino_digitalwrite', fields: { PIN: 13, STATE: 'HIGH' } },
        { kind: 'block', type: 'arduino_digitalread', fields: { PIN: 2 } },
        { kind: 'block', type: 'arduino_analogread', fields: { PIN: 34 } },
        { kind: 'block', type: 'arduino_analogwrite', fields: { PIN: 5, VALUE: 128 } },
        { kind: 'block', type: 'arduino_tone', fields: { PIN: 8, FREQ: 440, DURATION: 500 } },
        { kind: 'block', type: 'arduino_notone', fields: { PIN: 8 } },
        { kind: 'block', type: 'arduino_delay', fields: { TIME: 1000 } },
        { kind: 'block', type: 'arduino_millis' },
        { kind: 'block', type: 'arduino_delay_microseconds', fields: { US: 100 } },
        { kind: 'block', type: 'arduino_micros' }
      ]
    },
    // 8. 通信
    {
      kind: 'category',
      name: '通信',
      colour: '160',
      contents: [
        { kind: 'block', type: 'arduino_serial_begin', fields: { BAUD: '115200' } },
        {
          kind: 'block',
          type: 'arduino_serial_print',
          inputs: {
            TEXT: { shadow: { type: 'arduino_text', fields: { TEXT: 'Hello' } } }
          }
        },
        {
          kind: 'block',
          type: 'arduino_serial_println',
          inputs: {
            TEXT: { shadow: { type: 'arduino_text', fields: { TEXT: 'Hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_wire_begin' },
        { kind: 'block', type: 'arduino_wire_begin_transmission', fields: { ADDR: 0x3C } },
        {
          kind: 'block',
          type: 'arduino_wire_write',
          inputs: {
            DATA: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } }
          }
        },
        { kind: 'block', type: 'arduino_wire_end_transmission' },
        { kind: 'block', type: 'arduino_wire_request_from', fields: { ADDR: 0x3C, COUNT: 1 } },
        { kind: 'block', type: 'arduino_wire_read' }
      ]
    },
    // 9. 传感器
    {
      kind: 'category',
      name: '传感器',
      colour: '20',
      contents: [
        { kind: 'block', type: 'arduino_dht_begin' },
        { kind: 'block', type: 'arduino_dht_read_temp' },
        { kind: 'block', type: 'arduino_dht_read_humidity' },
        { kind: 'block', type: 'arduino_ultrasonic_read', fields: { TRIG_PIN: 12, ECHO_PIN: 14 } },
        { kind: 'block', type: 'arduino_mpu6050_read' },
        { kind: 'block', type: 'arduino_bmp280_temp' },
        { kind: 'block', type: 'arduino_bmp280_pressure' },
        { kind: 'block', type: 'arduino_bmp280_altitude' },
        { kind: 'block', type: 'arduino_bme280_begin' },
        { kind: 'block', type: 'arduino_bme280_temp' },
        { kind: 'block', type: 'arduino_bme280_humidity' },
        { kind: 'block', type: 'arduino_bme280_pressure' },
        { kind: 'block', type: 'arduino_bh1750_begin' },
        { kind: 'block', type: 'arduino_bh1750_read' },
        { kind: 'block', type: 'arduino_aht20_begin' },
        { kind: 'block', type: 'arduino_aht20_temp' },
        { kind: 'block', type: 'arduino_aht20_humidity' },
        { kind: 'block', type: 'arduino_sht31_begin' },
        { kind: 'block', type: 'arduino_sht31_temp' },
        { kind: 'block', type: 'arduino_sht31_humidity' },
        { kind: 'block', type: 'arduino_ds18b20_begin', fields: { PIN: 4 } },
        { kind: 'block', type: 'arduino_ds18b20_temp' },
        { kind: 'block', type: 'arduino_tcs34725_begin' },
        { kind: 'block', type: 'arduino_tcs34725_read' },
        { kind: 'block', type: 'arduino_gps_begin', fields: { RX: 16, TX: 17, BAUD: '9600' } },
        { kind: 'block', type: 'arduino_gps_update' },
        { kind: 'block', type: 'arduino_gps_value' },
        { kind: 'block', type: 'arduino_hx711_begin', fields: { DOUT: 16, SCK: 17 } },
        { kind: 'block', type: 'arduino_hx711_read' },
        { kind: 'block', type: 'arduino_hx711_tare' },
        { kind: 'block', type: 'arduino_rc522_begin', fields: { SS: 5, RST: 22 } },
        { kind: 'block', type: 'arduino_rc522_card_available' },
        { kind: 'block', type: 'arduino_rc522_uid' },
        { kind: 'block', type: 'arduino_mq_read', fields: { PIN: 34 } },
        { kind: 'block', type: 'arduino_sound_read', fields: { PIN: 35 } },
        { kind: 'block', type: 'arduino_light_read', fields: { PIN: 36 } },
        { kind: 'block', type: 'arduino_soil_read', fields: { PIN: 32 } },
        { kind: 'block', type: 'arduino_water_read', fields: { PIN: 33 } },
        { kind: 'block', type: 'arduino_flame_read', fields: { PIN: 25 } },
        { kind: 'block', type: 'arduino_tilt_read', fields: { PIN: 26 } },
        { kind: 'block', type: 'arduino_vibration_read', fields: { PIN: 27 } },
        { kind: 'block', type: 'arduino_encoder_read', fields: { PIN: 32 } },
        { kind: 'block', type: 'arduino_button_read', fields: { PIN: 4 } },
        { kind: 'block', type: 'arduino_pir_read', fields: { PIN: 6 } }
      ]
    },
    // 10. 执行器
    {
      kind: 'category',
      name: '执行器',
      colour: '200',
      contents: [
        { kind: 'block', type: 'arduino_servo_attach', fields: { PIN: 9 } },
        { kind: 'block', type: 'arduino_servo_write', fields: { ANGLE: 90 } },
        { kind: 'block', type: 'arduino_stepper_setup', fields: { STEPS: 2048, PIN1: 8, PIN2: 9, PIN3: 10, PIN4: 11 } },
        { kind: 'block', type: 'arduino_stepper_speed', fields: { RPM: 10 } },
        { kind: 'block', type: 'arduino_stepper_step', fields: { STEPS: 100 } },
        { kind: 'block', type: 'arduino_motor_forward', fields: { IN1: 2, IN2: 3, ENA: 5, SPEED: 200 } },
        { kind: 'block', type: 'arduino_motor_backward', fields: { IN1: 2, IN2: 3, ENA: 5, SPEED: 200 } },
        { kind: 'block', type: 'arduino_motor_stop', fields: { IN1: 2, IN2: 3 } },
        { kind: 'block', type: 'arduino_relay_on', fields: { PIN: 7 } },
        { kind: 'block', type: 'arduino_relay_off', fields: { PIN: 7 } },
        { kind: 'block', type: 'arduino_rgb_led_write' },
        { kind: 'block', type: 'arduino_pwm_device_write', fields: { PIN: 5, VALUE: 180 } },
        { kind: 'block', type: 'arduino_buzzer_note', fields: { PIN: 8, FREQ: '440', DURATION: 300 } }
      ]
    },
    // 11. 显示与灯光
    {
      kind: 'category',
      name: '显示与灯光',
      colour: '310',
      contents: [
        { kind: 'block', type: 'arduino_oled_begin' },
        { kind: 'block', type: 'arduino_oled_clear' },
        {
          kind: 'block',
          type: 'arduino_oled_print',
          inputs: {
            TEXT: { shadow: { type: 'arduino_text', fields: { TEXT: 'Hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_oled_display' },
        { kind: 'block', type: 'arduino_oled_set_text_size', fields: { SIZE: 1 } },
        { kind: 'block', type: 'arduino_lcd_begin' },
        { kind: 'block', type: 'arduino_lcd_clear' },
        {
          kind: 'block',
          type: 'arduino_lcd_print',
          inputs: {
            TEXT: { shadow: { type: 'arduino_text', fields: { TEXT: 'Hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_lcd_backlight' },
        { kind: 'block', type: 'arduino_neopixel_begin', fields: { PIN: 5, COUNT: 8 } },
        { kind: 'block', type: 'arduino_neopixel_set_color', fields: { INDEX: 0, R: 255, G: 0, B: 0 } },
        { kind: 'block', type: 'arduino_neopixel_show' },
        { kind: 'block', type: 'arduino_neopixel_clear' },
        { kind: 'block', type: 'arduino_neopixel_brightness', fields: { VALUE: 50 } }
      ]
    },
    // 13. 数据处理
    {
      kind: 'category',
      name: '数据处理',
      colour: '20',
      contents: [
        { kind: 'block', type: 'arduino_declare_array' },
        {
          kind: 'block',
          type: 'arduino_array_set',
          inputs: {
            VALUE: { shadow: { type: 'arduino_number', fields: { NUM: 0 } } }
          }
        },
        { kind: 'block', type: 'arduino_array_get' },
        { kind: 'block', type: 'arduino_to_int' },
        { kind: 'block', type: 'arduino_to_float' },
        { kind: 'block', type: 'arduino_to_string' },
        { kind: 'block', type: 'arduino_string_concat' },
        { kind: 'block', type: 'arduino_string_length' }
      ]
    },

    // ======================== 通信与联网 ========================
    { kind: 'sep', gap: '24' }, // 分组：通信与联网（顶层 label 只在 flyout 里合法，会报 console.warn）

    {
      kind: 'category',
      name: 'WiFi/HTTP',
      colour: '160',
      contents: [
        { kind: 'block', type: 'arduino_wifi_begin' },
        { kind: 'block', type: 'arduino_wifi_wait_connected' },
        { kind: 'block', type: 'arduino_wifi_status' },
        { kind: 'block', type: 'arduino_wifi_local_ip' },
        {
          kind: 'block',
          type: 'arduino_http_get',
          inputs: {
            URL: { shadow: { type: 'arduino_text', fields: { TEXT: 'https://example.com' } } }
          }
        },
        { kind: 'block', type: 'arduino_mqtt_setup' },
        { kind: 'block', type: 'arduino_mqtt_connect' },
        {
          kind: 'block',
          type: 'arduino_mqtt_publish',
          inputs: {
            PAYLOAD: { shadow: { type: 'arduino_text', fields: { TEXT: 'hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_mqtt_subscribe' },
        { kind: 'block', type: 'arduino_mqtt_loop' },
        { kind: 'block', type: 'arduino_espnow_begin' },
        {
          kind: 'block',
          type: 'arduino_espnow_send',
          inputs: {
            MESSAGE: { shadow: { type: 'arduino_text', fields: { TEXT: 'hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_ble_uart_begin' },
        {
          kind: 'block',
          type: 'arduino_ble_uart_notify',
          inputs: {
            TEXT: { shadow: { type: 'arduino_text', fields: { TEXT: 'hello' } } }
          }
        }
      ]
    },

    {
      kind: 'category',
      name: '红外遥控',
      colour: '40',
      contents: [
        { kind: 'block', type: 'arduino_ir_begin' },
        { kind: 'block', type: 'arduino_ir_available' },
        { kind: 'block', type: 'arduino_ir_read' },
        { kind: 'block', type: 'arduino_ir_resume' },
        { kind: 'block', type: 'arduino_ir_send', fields: { CODE: 0 } }
      ]
    },

    // ======================== ESP 专用 ========================
    { kind: 'sep', gap: '24' }, // 分组：ESP 专用（顶层 label 只在 flyout 里合法，会报 console.warn）

    {
      kind: 'category',
      name: 'ESP32 硬件',
      colour: '340',
      contents: [
        { kind: 'block', type: 'arduino_ledc_setup', fields: { CHANNEL: 0, FREQ: 5000, RESOLUTION: 8 } },
        { kind: 'block', type: 'arduino_ledc_attach', fields: { PIN: 2, CHANNEL: 0 } },
        { kind: 'block', type: 'arduino_ledc_write', fields: { CHANNEL: 0, DUTY: 128 } },
        { kind: 'block', type: 'arduino_touch_read', fields: { PIN: 4 } },
        { kind: 'block', type: 'arduino_dac_write', fields: { PIN: 25, VALUE: 128 } },
        { kind: 'block', type: 'arduino_attach_interrupt' },
        { kind: 'block', type: 'arduino_detach_interrupt', fields: { PIN: 2 } },
        { kind: 'block', type: 'arduino_deep_sleep_timer', fields: { SECONDS: 60 } }
      ]
    },

    {
      kind: 'category',
      name: 'ESP 存储',
      colour: '250',
      contents: [
        { kind: 'block', type: 'arduino_preferences_begin' },
        {
          kind: 'block',
          type: 'arduino_preferences_put_string',
          inputs: {
            VALUE: { shadow: { type: 'arduino_text', fields: { TEXT: 'hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_preferences_get_string' },
        {
          kind: 'block',
          type: 'arduino_preferences_put_int',
          inputs: {
            VALUE: { shadow: { type: 'arduino_number', fields: { NUM: 1 } } }
          }
        },
        { kind: 'block', type: 'arduino_preferences_get_int' },
        { kind: 'block', type: 'arduino_littlefs_begin' },
        {
          kind: 'block',
          type: 'arduino_littlefs_write',
          inputs: {
            TEXT: { shadow: { type: 'arduino_text', fields: { TEXT: 'hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_littlefs_read' },
        { kind: 'block', type: 'arduino_sd_begin', fields: { CS: 5 } },
        {
          kind: 'block',
          type: 'arduino_sd_write',
          inputs: {
            TEXT: { shadow: { type: 'arduino_text', fields: { TEXT: 'hello' } } }
          }
        },
        { kind: 'block', type: 'arduino_sd_read' }
      ]
    }
  ]
};
