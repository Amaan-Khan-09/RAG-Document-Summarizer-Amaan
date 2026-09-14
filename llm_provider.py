# llm_provider.py
#
# Swaps between local Ollama (free, no key, used for local dev) and Google
# Gemini (hosted, used in production since the deployed backend host has
# no GPU/RAM budget for locally-run models) behind one interface, selected
# by the LLM_PROVIDER env var. rag_engine.py only ever talks to this module,
# never to `ollama` or `google.genai` directly.

import os
import time

PROVIDER = os.environ.get("LLM_PROVIDER", "ollama").lower()

GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
GEMINI_EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
GEMINI_EMBED_DIM = 768  # default is 3072; 768 is plenty for this scale and cheaper to store/query

_MAX_RETRIES = 3


def _with_retry(fn, *args, **kwargs):
    """Retry transient rate-limit errors with backoff instead of surfacing
    a raw failure. Matters less on a paid key (much higher throughput than
    the free tier's 10 req/min on gemini-2.5-flash) but a burst of
    concurrent chunk-embedding calls can still trip a transient 429."""
    last_err = None
    for attempt in range(_MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as e:  # noqa: BLE001 - SDK exception types aren't stable across versions
            last_err = e
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                time.sleep(2 ** attempt)
                continue
            raise
    raise last_err


if PROVIDER == "gemini":
    from google import genai
    from google.genai import types

    _api_key = os.environ.get("GEMINI_API_KEY")
    if not _api_key:
        raise RuntimeError(
            "LLM_PROVIDER=gemini but GEMINI_API_KEY is not set. "
            "Set it in the environment before starting the app."
        )
    _client = genai.Client(api_key=_api_key)

    def embed(text, task_type="RETRIEVAL_DOCUMENT"):
        def _call():
            result = _client.models.embed_content(
                model=GEMINI_EMBED_MODEL,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=GEMINI_EMBED_DIM,
                ),
            )
            return result.embeddings[0].values
        return _with_retry(_call)

    def generate_stream(prompt):
        def _call():
            return list(
                _client.models.generate_content_stream(model=GEMINI_CHAT_MODEL, contents=prompt)
            )
        for chunk in _with_retry(_call):
            if chunk.text:
                yield chunk.text

    def generate(prompt):
        def _call():
            response = _client.models.generate_content(model=GEMINI_CHAT_MODEL, contents=prompt)
            return response.text
        return _with_retry(_call)

    def health_check():
        try:
            _client.models.embed_content(model=GEMINI_EMBED_MODEL, contents="ping")
            return True
        except Exception:
            return False

    PROVIDER_LABEL = f"Gemini ({GEMINI_CHAT_MODEL})"

else:  # "ollama" -- local, free, no API key, the default for local dev
    import ollama as _ollama

    def embed(text, task_type=None):
        response = _ollama.embeddings(model="nomic-embed-text", prompt=text)
        return response["embedding"]

    def generate_stream(prompt):
        for part in _ollama.generate(model="llama3.2", prompt=prompt, stream=True):
            token = part.get("response", "")
            if token:
                yield token

    def generate(prompt):
        response = _ollama.generate(model="llama3.2", prompt=prompt)
        return response["response"]

    def health_check():
        try:
            _ollama.list()
            return True
        except Exception:
            return False

    PROVIDER_LABEL = "Ollama (local)"
