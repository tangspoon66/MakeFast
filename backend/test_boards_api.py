#!/usr/bin/env python3
"""测试开发板 API"""

import sys
sys.path.insert(0, 'app')

from routes import SUPPORTED_BOARDS

print(f"总共支持 {len(SUPPORTED_BOARDS)} 个开发板\n")

# 按系列分组
esp8266_boards = [b for b in SUPPORTED_BOARDS if b.id.startswith('esp8266-')]
esp32_boards = [b for b in SUPPORTED_BOARDS if b.id.startswith('esp32') and not any(x in b.id for x in ['esp32s', 'esp32c', 'esp32h'])]
esp32s2_boards = [b for b in SUPPORTED_BOARDS if 'esp32s2' in b.id]
esp32s3_boards = [b for b in SUPPORTED_BOARDS if 'esp32s3' in b.id]
esp32c3_boards = [b for b in SUPPORTED_BOARDS if 'esp32c3' in b.id]
esp32c6_boards = [b for b in SUPPORTED_BOARDS if 'esp32c6' in b.id]
esp32h2_boards = [b for b in SUPPORTED_BOARDS if 'esp32h2' in b.id]
arduino_boards = [b for b in SUPPORTED_BOARDS if b.id.startswith('arduino-')]

print(f"ESP8266 系列: {len(esp8266_boards)} 个")
for b in esp8266_boards:
    print(f"  - {b.name}")

print(f"\nESP32 系列: {len(esp32_boards)} 个")
for b in esp32_boards:
    print(f"  - {b.name}")

print(f"\nESP32-S2 系列: {len(esp32s2_boards)} 个")
for b in esp32s2_boards:
    print(f"  - {b.name}")

print(f"\nESP32-S3 系列: {len(esp32s3_boards)} 个")
for b in esp32s3_boards:
    print(f"  - {b.name}")

print(f"\nESP32-C3 系列: {len(esp32c3_boards)} 个")
for b in esp32c3_boards:
    print(f"  - {b.name}")

print(f"\nESP32-C6 系列: {len(esp32c6_boards)} 个")
for b in esp32c6_boards:
    print(f"  - {b.name}")

print(f"\nESP32-H2 系列: {len(esp32h2_boards)} 个")
for b in esp32h2_boards:
    print(f"  - {b.name}")

print(f"\nArduino 系列: {len(arduino_boards)} 个")
for b in arduino_boards:
    print(f"  - {b.name} ({b.fqbn})")
