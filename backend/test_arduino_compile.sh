#!/bin/bash
# 测试 Arduino 代码编译

echo "测试 Arduino UNO 编译..."

curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{
    "code": "void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}",
    "board_id": "arduino-uno"
  }' | python3 -m json.tool

echo -e "\n\n测试 Arduino Nano 编译..."

curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{
    "code": "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"Hello Arduino!\");\n}\n\nvoid loop() {\n  delay(1000);\n}",
    "board_id": "arduino-nano"
  }' | python3 -m json.tool
