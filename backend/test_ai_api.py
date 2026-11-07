#!/usr/bin/env python3
"""
AI API 测试脚本

用于测试 AI 代码生成功能是否正常工作。
"""

import asyncio
import sys
from app.ai_service import get_ai_service


async def test_basic_generation():
    """测试基本代码生成"""
    print("=" * 60)
    print("测试 1: 基本代码生成")
    print("=" * 60)
    
    ai_service = get_ai_service()
    
    messages = [
        {"role": "user", "content": "帮我写一个LED闪烁的代码"}
    ]
    
    result = await ai_service.generate_code(
        messages=messages,
        board_id="esp32"
    )
    
    print(f"\n成功: {result['success']}")
    print(f"\n消息:\n{result['message']}")
    
    if result.get('code'):
        print(f"\n生成的代码:\n{result['code']}")
    
    return result['success']


async def test_with_context():
    """测试带上下文的代码生成"""
    print("\n" + "=" * 60)
    print("测试 2: 带上下文的代码生成")
    print("=" * 60)
    
    ai_service = get_ai_service()
    
    current_code = """void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}"""
    
    messages = [
        {"role": "user", "content": "把延迟改成500毫秒"}
    ]
    
    result = await ai_service.generate_code(
        messages=messages,
        board_id="esp32",
        context=current_code
    )
    
    print(f"\n成功: {result['success']}")
    print(f"\n消息:\n{result['message']}")
    
    if result.get('code'):
        print(f"\n生成的代码:\n{result['code']}")
    
    return result['success']


async def test_serial_communication():
    """测试串口通信代码生成"""
    print("\n" + "=" * 60)
    print("测试 3: 串口通信代码生成")
    print("=" * 60)
    
    ai_service = get_ai_service()
    
    messages = [
        {"role": "user", "content": "生成一个串口通信的示例代码"}
    ]
    
    result = await ai_service.generate_code(
        messages=messages,
        board_id="esp32"
    )
    
    print(f"\n成功: {result['success']}")
    print(f"\n消息:\n{result['message']}")
    
    if result.get('code'):
        print(f"\n生成的代码:\n{result['code']}")
    
    return result['success']


async def test_wifi_connection():
    """测试WiFi连接代码生成"""
    print("\n" + "=" * 60)
    print("测试 4: WiFi连接代码生成")
    print("=" * 60)
    
    ai_service = get_ai_service()
    
    messages = [
        {"role": "user", "content": "写一个连接WiFi的代码"}
    ]
    
    result = await ai_service.generate_code(
        messages=messages,
        board_id="esp32"
    )
    
    print(f"\n成功: {result['success']}")
    print(f"\n消息:\n{result['message']}")
    
    if result.get('code'):
        print(f"\n生成的代码:\n{result['code']}")
    
    return result['success']


async def test_streaming():
    """测试流式生成"""
    print("\n" + "=" * 60)
    print("测试 5: 流式代码生成")
    print("=" * 60)
    
    ai_service = get_ai_service()
    
    messages = [
        {"role": "user", "content": "帮我写一个PWM控制LED亮度的代码"}
    ]
    
    print("\n开始流式生成...")
    print("-" * 60)
    
    try:
        async for chunk in ai_service.generate_code_stream(
            messages=messages,
            board_id="esp32"
        ):
            print(chunk, end='', flush=True)
        
        print("\n" + "-" * 60)
        print("流式生成完成")
        return True
        
    except Exception as e:
        print(f"\n流式生成失败: {e}")
        return False


async def main():
    """运行所有测试"""
    print("\n🤖 AI 代码生成服务测试")
    print("=" * 60)
    
    # 检查配置
    ai_service = get_ai_service()
    if ai_service.api_key:
        print("✅ 检测到 API Key 配置")
        print(f"📝 使用模型: {ai_service.model}")
        print(f"🌐 API 地址: {ai_service.api_base or 'https://api.openai.com/v1'}")
    else:
        print("⚠️  未配置 API Key，将使用模拟模式")
    
    print()
    
    # 运行测试
    tests = [
        ("基本代码生成", test_basic_generation),
        ("带上下文生成", test_with_context),
        ("串口通信", test_serial_communication),
        ("WiFi连接", test_wifi_connection),
        ("流式生成", test_streaming),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            success = await test_func()
            results.append((name, success))
        except Exception as e:
            print(f"\n❌ 测试失败: {e}")
            results.append((name, False))
    
    # 输出总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    for name, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"{status} - {name}")
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    print(f"\n总计: {passed}/{total} 通过")
    
    return passed == total


if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n测试被中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n测试出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
