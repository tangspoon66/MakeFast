#!/usr/bin/env python3
"""
测试固件烧录修复

验证编译服务是否正确生成烧录文件清单
"""

import sys
import os
from pathlib import Path

# 添加 app 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from app.compilation_service import CompilationService

# 测试代码
TEST_CODE = """
void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
  delay(1000);
  digitalWrite(2, LOW);
  delay(1000);
}
"""

def test_compilation():
    """测试编译服务"""
    print("=" * 60)
    print("测试固件烧录修复")
    print("=" * 60)
    
    # 创建编译服务
    service = CompilationService(
        temp_dir="/tmp/test_compile_service",
        firmware_dir="/tmp/test_firmware_service",
        compile_timeout=60
    )
    
    print("\n1. 编译测试代码...")
    result = service.compile(TEST_CODE, "esp32")
    
    if not result.success:
        print("❌ 编译失败:")
        for error in result.errors:
            print(f"  - {error.message}")
        return False
    
    print(f"✅ 编译成功 (耗时: {result.duration:.2f}秒)")
    print(f"   固件 ID: {result.firmware_id}")
    print(f"   总大小: {result.firmware_size / 1024:.2f} KB")
    
    # 检查烧录文件清单
    print("\n2. 检查烧录文件清单...")
    if not result.firmware_files:
        print("❌ 缺少烧录文件清单!")
        return False
    
    print(f"✅ 找到 {len(result.firmware_files)} 个烧录文件:")
    
    expected_files = {
        'bootloader.bin': 0x1000,
        'partitions.bin': 0x8000,
        'boot_app0.bin': 0xe000,
        'app.bin': 0x10000
    }
    
    found_files = {}
    for file in result.firmware_files:
        found_files[file.name] = file.address
        print(f"   - 0x{file.address:05x}  {file.name:20s}  {file.size / 1024:8.2f} KB  ({file.role})")
    
    # 验证文件
    print("\n3. 验证烧录文件...")
    all_ok = True
    
    for name, expected_addr in expected_files.items():
        if name not in found_files:
            print(f"❌ 缺少文件: {name}")
            all_ok = False
        elif found_files[name] != expected_addr:
            print(f"❌ 地址错误: {name} (期望 0x{expected_addr:05x}, 实际 0x{found_files[name]:05x})")
            all_ok = False
        else:
            print(f"✅ {name:20s} @ 0x{expected_addr:05x}")
    
    # 检查文件是否存在
    print("\n4. 检查文件是否存在...")
    firmware_dir = service.firmware_dir / result.firmware_id
    
    for file in result.firmware_files:
        file_path = firmware_dir / file.name
        if file_path.exists():
            actual_size = file_path.stat().st_size
            if actual_size == file.size:
                print(f"✅ {file.name:20s} 存在 ({actual_size} bytes)")
            else:
                print(f"❌ {file.name:20s} 大小不匹配 (期望 {file.size}, 实际 {actual_size})")
                all_ok = False
        else:
            print(f"❌ {file.name:20s} 不存在")
            all_ok = False
    
    print("\n" + "=" * 60)
    if all_ok:
        print("✅ 所有测试通过!")
        print("=" * 60)
        return True
    else:
        print("❌ 部分测试失败")
        print("=" * 60)
        return False

if __name__ == "__main__":
    try:
        success = test_compilation()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
