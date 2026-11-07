"""Tencent Cloud one-sentence ASR integration."""

import base64
import io
import os
import subprocess
import time
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class TencentASRConfig:
    enabled: bool
    secret_id: str = ""
    secret_key: str = ""
    app_id: str = ""
    region: str = "ap-guangzhou"
    engine_model_type: str = "16k_zh"

    @classmethod
    def from_env(cls) -> "TencentASRConfig":
        return cls(
            enabled=os.getenv("TENCENT_ASR_ENABLED", "false").lower() == "true",
            secret_id=os.getenv("TENCENT_ASR_SECRET_ID", ""),
            secret_key=os.getenv("TENCENT_ASR_SECRET_KEY", ""),
            app_id=os.getenv("TENCENT_ASR_APP_ID", ""),
            region=os.getenv("TENCENT_ASR_REGION", "ap-guangzhou"),
            engine_model_type=os.getenv("TENCENT_ASR_ENGINE_MODEL_TYPE", "16k_zh"),
        )

    def validate(self) -> None:
        if not self.enabled:
            raise RuntimeError("语音识别未启用")
        missing = [
            name for name, value in {
                "TENCENT_ASR_SECRET_ID": self.secret_id,
                "TENCENT_ASR_SECRET_KEY": self.secret_key,
            }.items()
            if not value
        ]
        if missing:
            raise RuntimeError(f"腾讯云 ASR 配置缺失: {', '.join(missing)}")


def _detect_voice_format(content_type: Optional[str], filename: Optional[str]) -> str:
    value = f"{content_type or ''} {filename or ''}".lower()
    if "wav" in value:
        return "wav"
    if "mp3" in value or "mpeg" in value:
        return "mp3"
    if "m4a" in value or "mp4" in value:
        return "m4a"
    if "ogg" in value:
        return "ogg-opus"
    if "webm" in value:
        return "webm"
    return "webm"


def _convert_to_wav(audio: bytes, content_type: Optional[str], filename: Optional[str]) -> bytes:
    """Convert browser audio blobs to 16k mono wav for Tencent ASR.

    Browser MediaRecorder commonly emits webm/opus, which Tencent's
    SentenceRecognition does not accept directly. We normalize those files
    to wav before sending them upstream.
    """
    source_format = _detect_voice_format(content_type, filename)
    if source_format == "wav":
        return audio

    try:
        process = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                "pipe:0",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-f",
                "wav",
                "pipe:1",
            ],
            input=audio,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return process.stdout
    except FileNotFoundError as exc:
        raise RuntimeError("当前环境缺少 ffmpeg，无法处理浏览器录音") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or b"").decode("utf-8", errors="ignore").strip()
        raise RuntimeError(f"音频格式转换失败: {stderr or '未知错误'}") from exc


async def transcribe_once(audio: bytes, content_type: Optional[str], filename: Optional[str]) -> str:
    """Recognize a short audio clip with Tencent Cloud SentenceRecognition."""
    config = TencentASRConfig.from_env()
    config.validate()

    if not audio:
        raise RuntimeError("音频为空")
    if len(audio) > 5 * 1024 * 1024:
        raise RuntimeError("音频过大，请控制在 5MB 内")

    audio = _convert_to_wav(audio, content_type, filename)

    from tencentcloud.common import credential
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.asr.v20190614 import asr_client, models

    http_profile = HttpProfile()
    http_profile.endpoint = "asr.tencentcloudapi.com"
    client_profile = ClientProfile()
    client_profile.httpProfile = http_profile

    cred = credential.Credential(config.secret_id, config.secret_key)
    client = asr_client.AsrClient(cred, config.region, client_profile)

    req = models.SentenceRecognitionRequest()
    req.ProjectId = 0
    req.SubServiceType = 2
    req.EngSerViceType = config.engine_model_type
    req.SourceType = 1
    req.VoiceFormat = "wav"
    req.UsrAudioKey = f"makefast-{int(time.time() * 1000)}"
    req.Data = base64.b64encode(audio).decode("ascii")
    req.DataLen = len(audio)

    resp = client.SentenceRecognition(req)
    return (getattr(resp, "Result", "") or "").strip()
