"""Đọc văn bản thành giọng nói tự nhiên bằng Gemini TTS (dùng chung GOOGLE_API_KEY).

Kết quả là file WAV giữ trong bộ nhớ theo mã băm của câu, để máy bố mẹ tải về phát
và bấm "Nghe lại" không phải tạo lại. Lỗi hay chậm thì app tự quay về giọng có sẵn của máy.
"""

import asyncio
import base64
import hashlib
import io
import logging
import wave
from collections import OrderedDict
from functools import lru_cache

import httpx

from src.config import get_settings

logger = logging.getLogger(__name__)

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
SAMPLE_RATE = 24000  # Gemini TTS trả PCM 16 bit, một kênh, 24 kHz.
MAX_CACHED = 64


def pcm_to_wav(pcm: bytes) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm)
    return buffer.getvalue()


class TtsService:
    def __init__(
        self,
        api_key: str,
        model: str,
        voice: str,
        timeout: float,
        client: httpx.AsyncClient | None = None,
        fallback_models: list[str] | None = None,
    ):
        self._api_key = api_key
        self.model = model
        self.models = list(dict.fromkeys([model, *(fallback_models or [])]))
        self.voice = voice
        self._client = client or httpx.AsyncClient(timeout=timeout)
        # mã câu -> việc đang tạo hoặc đã tạo xong; hai lần hỏi cùng một câu chỉ gọi Gemini một lần.
        self._tasks: OrderedDict[str, asyncio.Task[bytes]] = OrderedDict()

    @property
    def enabled(self) -> bool:
        return bool(self._api_key and self.model)

    def audio_id(self, text: str) -> str:
        return hashlib.sha1(f"{self.model}|{self.voice}|{text}".encode()).hexdigest()[:20]

    async def synthesize(self, text: str) -> str:
        """Tạo giọng đọc cho `text`, trả mã để tải file WAV. Lỗi thì ném ngoại lệ."""
        audio_id = self.audio_id(text)
        task = self._tasks.get(audio_id)
        if task is None or (task.done() and (task.cancelled() or task.exception())):
            task = asyncio.create_task(self._generate(text))
            self._tasks[audio_id] = task
            while len(self._tasks) > MAX_CACHED:
                self._tasks.popitem(last=False)
        await asyncio.shield(task)
        return audio_id

    def get(self, audio_id: str) -> bytes | None:
        task = self._tasks.get(audio_id)
        if task is None or not task.done() or task.cancelled() or task.exception():
            return None
        return task.result()

    async def _generate(self, text: str) -> bytes:
        """Thử lần lượt các model: model hết hạn mức (429) hay quá tải thì dùng model kế tiếp."""
        last_error: Exception | None = None
        for model in self.models:
            try:
                return await self._call(model, text)
            except Exception as e:
                last_error = e
                logger.warning("TTS %s lỗi (%s), thử model kế tiếp", model, e)
        raise last_error or RuntimeError("Chưa cấu hình model TTS")

    async def _call(self, model: str, text: str) -> bytes:
        response = await self._client.post(
            API_URL.format(model=model),
            headers={"x-goog-api-key": self._api_key},
            json={
                "contents": [{"parts": [{"text": text}]}],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": self.voice}}},
                },
            },
        )
        response.raise_for_status()
        part = response.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
        return pcm_to_wav(base64.b64decode(part["data"]))


@lru_cache
def get_tts() -> TtsService:
    settings = get_settings()
    fallbacks = [name.strip() for name in settings.tts_fallback_models.split(",") if name.strip()]
    return TtsService(
        settings.google_api_key,
        settings.tts_model,
        settings.tts_voice,
        settings.tts_timeout_seconds,
        fallback_models=fallbacks,
    )
