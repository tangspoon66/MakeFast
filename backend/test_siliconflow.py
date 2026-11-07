#!/usr/bin/env python3
"""
硅基流动 API 快速测试

测试 DeepSeek-V3 模型是否能正常工作
"""

import asyncio
import httpx
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

API_KEY = os.getenv('OPENAI_API_KEY')
API_BASE = os.getenv('OPENAI_API_BASE', 'https://api.siliconflow.cn/v1')
MODEL = os.getenv('AI_MODEL', 'deepseek-ai/DeepSeek-V3')


async def test_simple_request():
    """测试简单的 API 请求"""
    print("=" * 60)
    print("测试硅基流动 API")
    print("=" * 60)
    print(f"API 地址: {API_BASE}")
    print(f"模型: {MODEL}")
    print(f"API Key: {API_KEY[:20]}..." if API_KEY else "未配置")
    print()
    
    if not API_KEY:
        print("❌ 错误：未配置 API Key")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            print("📤 发送请求...")
            
            response = await client.post(
                f"{API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "你是一个Arduino代码助手，帮助用户生成简洁的代码。"
                        },
                        {
                            "role": "user",
                            "content": "帮我写一个让LED闪烁的Arduino代码，要简短"
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500
                },
                timeout=30.0
            )
            
            print(f"📥 响应状态: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                message = data['choices'][0]['message']['content']
                
                print("\n✅ 请求成功！")
                print("\n" + "=" * 60)
                print("AI 生成的代码：")
                print("=" * 60)
                print(message)
                print("=" * 60)
                
                return True
            else:
                print(f"\n❌ 请求失败")
                print(f"状态码: {response.status_code}")
                print(f"响应: {response.text}")
                return False
                
    except httpx.TimeoutException:
        print("\n❌ 请求超时")
        return False
    except Exception as e:
        print(f"\n❌ 请求出错: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_streaming():
    """测试流式响应"""
    print("\n" + "=" * 60)
    print("测试流式响应")
    print("=" * 60)
    
    if not API_KEY:
        print("❌ 错误：未配置 API Key")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            print("📤 发送流式请求...\n")
            
            async with client.stream(
                "POST",
                f"{API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": "写一个串口通信的Arduino代码"
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500,
                    "stream": True
                },
                timeout=30.0
            ) as response:
                if response.status_code != 200:
                    print(f"❌ 请求失败: {response.status_code}")
                    return False
                
                print("📥 开始接收流式响应：")
                print("-" * 60)
                
                import json
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            content = chunk['choices'][0]['delta'].get('content', '')
                            if content:
                                print(content, end='', flush=True)
                        except json.JSONDecodeError:
                            continue
                
                print("\n" + "-" * 60)
                print("✅ 流式响应完成")
                return True
                
    except Exception as e:
        print(f"\n❌ 流式请求出错: {e}")
        return False


async def main():
    """运行测试"""
    print("\n🚀 硅基流动 DeepSeek-V3 API 测试\n")
    
    # 测试1：简单请求
    success1 = await test_simple_request()
    
    # 测试2：流式请求
    success2 = await test_streaming()
    
    # 总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    print(f"{'✅' if success1 else '❌'} 简单请求")
    print(f"{'✅' if success2 else '❌'} 流式请求")
    
    if success1 and success2:
        print("\n🎉 所有测试通过！AI 助手已准备就绪。")
        return True
    else:
        print("\n⚠️  部分测试失败，请检查配置。")
        return False


if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n测试被中断")
        exit(1)
