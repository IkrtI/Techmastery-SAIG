"""OpenRouter chat client with free-model fallback + retry."""
import os
import time

DEFAULT_MODELS = [
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "google/gemma-4-31b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
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
                timeout=45,
                max_retries=0,  # we run our own retry/fallback loop
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
                    if status == 404:
                        break  # model gone — no point retrying it
                    retry_after = 0
                    body = getattr(e, "body", None)
                    if isinstance(body, dict):
                        retry_after = (body.get("error", {}).get("metadata", {})
                                       or {}).get("retry_after_seconds", 0) or 0
                    time.sleep(min(float(retry_after) or 1.5 * (attempt + 1), 20))
            # try next model
        raise RuntimeError(f"all OpenRouter models failed: {last_err}")
