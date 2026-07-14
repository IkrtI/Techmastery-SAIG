"""OpenRouter chat client with free-model fallback + retry."""
import os
import time

DEFAULT_MODELS = [
    "deepseek/deepseek-chat-v3-0324:free",
    "qwen/qwen3-235b-a22b:free",
    "google/gemini-2.0-flash-exp:free",
]


def _model_candidates():
    env = os.environ.get("OPENROUTER_MODELS", "")
    return [m.strip() for m in env.split(",") if m.strip()] or DEFAULT_MODELS


class LLMClient:
    def __init__(self, api_key=None, models=None, _client=None):
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY")
        self.models = models or _model_candidates()
        self._client = _client

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.api_key,
            )
        return self._client

    def complete(self, messages, temperature=0.2, max_tokens=1500) -> str:
        last_err = None
        for model in self.models:
            for attempt in range(3):
                try:
                    resp = self.client.chat.completions.create(
                        model=model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                    content = resp.choices[0].message.content
                    if content:
                        return content
                    last_err = RuntimeError(f"empty response from {model}")
                    break
                except Exception as e:  # rate limit / 404 model gone / transient
                    last_err = e
                    status = getattr(e, "status_code", None)
                    if status in (401, 403):
                        raise
                    time.sleep(1.5 * (attempt + 1))
            # try next model
        raise RuntimeError(f"all OpenRouter models failed: {last_err}")
