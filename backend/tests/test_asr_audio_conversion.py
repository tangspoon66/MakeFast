import io
import wave

from app.asr_service import _convert_to_wav, _detect_voice_format


def test_detect_voice_format_webm():
    assert _detect_voice_format('audio/webm', 'speech.webm') == 'webm'


def test_convert_to_wav_passthrough():
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b'\x00\x00' * 160)
    wav = buf.getvalue()
    assert _convert_to_wav(wav, 'audio/wav', 'speech.wav') == wav
