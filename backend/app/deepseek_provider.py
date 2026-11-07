"""DeepSeek（OpenAI 兼容）LLM provider，供课程 Agent 使用。

环境变量（只读名称，不在代码/日志里输出值）：
- DEEPSEEK_API_KEY      必填，未设置则不启用
- DEEPSEEK_BASE_URL     默认 https://api.deepseek.com
- DEEPSEEK_MODEL        默认 deepseek-chat
- DEEPSEEK_TIMEOUT      单次请求超时秒数，默认 15
- DEEPSEEK_MAX_RETRIES  失败重试次数，默认 2（仅对超时/网络错误/429/5xx 重试）
- DEEPSEEK_MAX_TOKENS   默认 200（回答本身限制 120 字，控制成本）

接口与 AIService 对齐：属性 api_key、协程 _call_ai_api(messages) -> {"message": str}。
出错时抛 ProviderError，由调用方回退到离线 FAQ。
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"
RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504}


class ProviderError(RuntimeError):
    pass


class DeepSeekProvider:
    name = "deepseek"

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None,
                 timeout: Optional[float] = None, max_retries: Optional[int] = None, temperature: float = 0.3,
                 max_tokens: Optional[int] = None, transport: Optional[httpx.AsyncBaseTransport] = None,
                 backoff: float = 0.5) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("DEEPSEEK_API_KEY", "")
        self.base_url = (base_url or os.getenv("DEEPSEEK_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.model = model or os.getenv("DEEPSEEK_MODEL") or DEFAULT_MODEL
        self.timeout = float(timeout if timeout is not None else os.getenv("DEEPSEEK_TIMEOUT", "15"))
        self.max_retries = int(max_retries if max_retries is not None else os.getenv("DEEPSEEK_MAX_RETRIES", "2"))
        self.max_tokens = int(max_tokens if max_tokens is not None else os.getenv("DEEPSEEK_MAX_TOKENS", "200"))
        self.temperature = temperature
        self._transport = transport
        self._backoff = backoff

    def __repr__(self) -> str:  # 不暴露 key
        return f"DeepSeekProvider(model={self.model!r}, base_url={self.base_url!r}, key_set={bool(self.api_key)})"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self.timeout, transport=self._transport)

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def _payload(self, messages: List[Dict[str, str]], stream: bool) -> Dict[str, Any]:
        return {"model": self.model, "messages": messages, "temperature": self.temperature,
                "max_tokens": self.max_tokens, "stream": stream}

    async def _call_ai_api(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        if not self.api_key:
            raise ProviderError("DEEPSEEK_API_KEY not set")
        url = f"{self.base_url}/chat/completions"
        last: Optional[str] = None
        for attempt in range(self.max_retries + 1):
            try:
                async with self._client() as c:
                    r = await c.post(url, headers=self._headers(), json=self._payload(messages, False))
                if r.status_code == 200:
                    try:
                        data = r.json()
                        msg = data["choices"][0]["message"].get("content") or ""
                    except (ValueError, KeyError, IndexError, TypeError):
                        raise ProviderError("bad response") from None
                    if not msg.strip():
                        raise ProviderError("empty completion")
                    return {"message": msg, "usage": data.get("usage", {}), "provider": self.name}
                last = f"HTTP {r.status_code}"
                if r.status_code not in RETRY_STATUS:
                    raise ProviderError(last)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                last = type(e).__name__
            if attempt < self.max_retries:
                await asyncio.sleep(self._backoff * (2 ** attempt))
        raise ProviderError(f"deepseek failed after retries: {last}")

    async def stream(self, messages: List[Dict[str, str]]) -> AsyncIterator[str]:
        """SSE 流式输出，逐段 yield 文本（/api/course-agent/chat/stream 使用）。"""
        if not self.api_key:
            raise ProviderError("DEEPSEEK_API_KEY not set")
        async with self._client() as c:
            async with c.stream("POST", f"{self.base_url}/chat/completions", headers=self._headers(),
                                json=self._payload(messages, True)) as r:
                if r.status_code != 200:
                    raise ProviderError(f"HTTP {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    chunk = line[5:].strip()
                    if chunk == "[DONE]":
                        break
                    try:
                        delta = json.loads(chunk)["choices"][0].get("delta", {}).get("content")
                    except (ValueError, KeyError, IndexError):
                        continue
                    if delta:
                        yield delta


def select_provider() -> Optional[Any]:
    """优先级：DEEPSEEK_API_KEY > 现有 AIService（OPENAI_API_KEY / AI_API_KEY）> None（离线 FAQ）。"""
    if os.getenv("DEEPSEEK_API_KEY"):
        return DeepSeekProvider()
    try:
        from .ai_service import get_ai_service
        svc = get_ai_service()
        if hasattr(svc, "_refresh_config"):
            svc._refresh_config()
        if getattr(svc, "api_key", None):
            return svc
    except Exception:
        pass
    return None
