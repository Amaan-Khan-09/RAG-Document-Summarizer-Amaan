# llm_provider.py
#
# Chat/generation and embeddings are independently swappable, because Groq
# (chosen for chat: free tier, very fast streaming) has no embeddings API at
# all -- it isn't a "pick one provider" choice like the earlier Gemini-only
# design was. rag_engine.py only ever calls embed() / generate() /
# generate_stream() / health_check() here, never a provider SDK directly.
#
# CHAT_PROVIDER: "ollama" (default, local, free) | "groq" | "gemini"
# EMBED_PROVIDER: "ollama" (default, local, free) | "gemini"
#   (defaults to "gemini" automatically when CHAT_PROVIDER=groq, since groq
#   can't embed at all and gemini is the only wired-up cloud embedder)

import os
import time

CHAT_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama").lower()
_default_embed_provider = "gemini" if CHAT_PROVIDER == "groq" else CHAT_PROVIDER
EMBED_PROVIDER = os.environ.get("EMBED_PROVIDER", _default_embed_provider).lower()

GROQ_CHAT_MODEL = os.environ.get("GROQ_CHAT_MODEL", "openai/gpt-oss-20b")
GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
GEMINI_EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
GEMINI_EMBED_DIM = 768  # default is 3072; 768 is plenty at this scale and cheaper

_MAX_RETRIES = 3


def _with_retry(fn):
    """Retry transient rate-limit errors with backoff instead of surfacing
    a raw failure -- a burst of concurrent chunk-embedding calls can trip a
    transient 429 even on a well-provisioned key."""
    last_err = None
    for attempt in range(_MAX_RETRIES):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 - SDK exception types aren't stable across versions/providers
            last_err = e
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e) or "rate_limit" in str(e).lower():
                time.sleep(2 ** attempt)
                continue
            raise
    raise last_err


# ---------------------------------------------------------------- Ollama ----
# Only imported/initialized if actually selected by either provider.
if CHAT_PROVIDER == "ollama" or EMBED_PROVIDER == "ollama":
    import ollama as _ollama

    def _ollama_health():
        try:
            _ollama.list()
            return True
        except Exception:
            return False

if EMBED_PROVIDER == "ollama":
    def _ollama_embed(text, task_type=None):
        return _ollama.embeddings(model="nomic-embed-text", prompt=text)["embedding"]

if CHAT_PROVIDER == "ollama":
    def _ollama_generate_stream(prompt):
        for part in _ollama.generate(model="llama3.2", prompt=prompt, stream=True):
            token = part.get("response", "")
            if token:
                yield token

    def _ollama_generate(prompt):
        return _ollama.generate(model="llama3.2", prompt=prompt)["response"]


# ---------------------------------------------------------------- Gemini ----
if CHAT_PROVIDER == "gemini" or EMBED_PROVIDER == "gemini":
    from google import genai
    from google.genai import types as _genai_types

    _gemini_key = os.environ.get("GEMINI_API_KEY")
    if not _gemini_key:
        raise RuntimeError(
            "GEMINI_API_KEY is required (used for chat and/or embeddings) but not set."
        )
    # Without an explicit timeout, a stalled outbound call hangs the request
    # indefinitely instead of failing fast -- a real problem in a Flask
    # worker thread, since one hung request can block others behind it.
    _gemini_client = genai.Client(
        api_key=_gemini_key,
        http_options=_genai_types.HttpOptions(timeout=20000),  # milliseconds
    )

if EMBED_PROVIDER == "gemini":
    def _gemini_embed(text, task_type="RETRIEVAL_DOCUMENT"):
        def _call():
            result = _gemini_client.models.embed_content(
                model=GEMINI_EMBED_MODEL,
                contents=text,
                config=_genai_types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=GEMINI_EMBED_DIM,
                ),
            )
            return result.embeddings[0].values
        return _with_retry(_call)

    def _gemini_embed_health():
        try:
            _gemini_client.models.embed_content(model=GEMINI_EMBED_MODEL, contents="ping")
            return True
        except Exception:
            return False

if CHAT_PROVIDER == "gemini":
    def _gemini_generate_stream(prompt):
        def _call():
            return list(
                _gemini_client.models.generate_content_stream(model=GEMINI_CHAT_MODEL, contents=prompt)
            )
        for chunk in _with_retry(_call):
            if chunk.text:
                yield chunk.text

    def _gemini_generate(prompt):
        def _call():
            return _gemini_client.models.generate_content(model=GEMINI_CHAT_MODEL, contents=prompt).text
        return _with_retry(_call)

    def _gemini_chat_health():
        try:
            _gemini_client.models.embed_content(model=GEMINI_EMBED_MODEL, contents="ping")
            return True
        except Exception:
            return False


# ------------------------------------------------------------------ Groq ----
if CHAT_PROVIDER == "groq":
    from groq import Groq

    _groq_key = os.environ.get("GROQ_API_KEY")
    if not _groq_key:
        raise RuntimeError("LLM_PROVIDER=groq but GROQ_API_KEY is not set.")
    # Same reasoning as the Gemini client's http_options timeout above: fail
    # fast on a stalled call instead of hanging the request indefinitely.
    _groq_client = Groq(api_key=_groq_key, timeout=20.0)

    def _groq_generate_stream(prompt):
        def _call():
            return list(
                _groq_client.chat.completions.create(
                    model=GROQ_CHAT_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    stream=True,
                )
            )
        for chunk in _with_retry(_call):
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    def _groq_generate(prompt):
        def _call():
            response = _groq_client.chat.completions.create(
                model=GROQ_CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content
        return _with_retry(_call)

    def _groq_health():
        try:
            _groq_client.models.list()
            return True
        except Exception:
            return False


# ------------------------------------------------------------- dispatch ----

_EMBED_FNS = {}
if EMBED_PROVIDER == "ollama":
    _EMBED_FNS["ollama"] = _ollama_embed
if EMBED_PROVIDER == "gemini":
    _EMBED_FNS["gemini"] = _gemini_embed

_GENERATE_STREAM_FNS = {}
_GENERATE_FNS = {}
_HEALTH_FNS = {}
if CHAT_PROVIDER == "ollama":
    _GENERATE_STREAM_FNS["ollama"] = _ollama_generate_stream
    _GENERATE_FNS["ollama"] = _ollama_generate
    _HEALTH_FNS["ollama"] = _ollama_health
if CHAT_PROVIDER == "gemini":
    _GENERATE_STREAM_FNS["gemini"] = _gemini_generate_stream
    _GENERATE_FNS["gemini"] = _gemini_generate
    _HEALTH_FNS["gemini"] = _gemini_chat_health
if CHAT_PROVIDER == "groq":
    _GENERATE_STREAM_FNS["groq"] = _groq_generate_stream
    _GENERATE_FNS["groq"] = _groq_generate
    _HEALTH_FNS["groq"] = _groq_health

_EMBED_HEALTH_FNS = {}
if EMBED_PROVIDER == "ollama":
    _EMBED_HEALTH_FNS["ollama"] = _ollama_health
if EMBED_PROVIDER == "gemini":
    _EMBED_HEALTH_FNS["gemini"] = _gemini_embed_health


def embed(text, task_type="RETRIEVAL_DOCUMENT"):
    return _EMBED_FNS[EMBED_PROVIDER](text, task_type)


def generate_stream(prompt):
    yield from _GENERATE_STREAM_FNS[CHAT_PROVIDER](prompt)


def generate(prompt):
    return _GENERATE_FNS[CHAT_PROVIDER](prompt)


_HEALTH_CACHE_TTL = 60  # seconds
_health_cache = {"result": None, "checked_at": 0.0}


def health_check():
    """True only if both the chat backend and the embedding backend (when
    they're different providers) are reachable.

    Cached for _HEALTH_CACHE_TTL: the frontend polls this every
    HEALTH_POLL_MS, and for cloud providers a "real" check is a live network
    call (Groq's models.list(), Gemini's embed_content("ping")) -- without
    caching, an idle open tab would silently spend a real Gemini embedding
    call every poll, indefinitely, for zero user benefit.
    """
    now = time.time()
    if _health_cache["result"] is not None and now - _health_cache["checked_at"] < _HEALTH_CACHE_TTL:
        return _health_cache["result"]

    chat_ok = _HEALTH_FNS[CHAT_PROVIDER]()
    result = chat_ok if EMBED_PROVIDER == CHAT_PROVIDER else chat_ok and _EMBED_HEALTH_FNS[EMBED_PROVIDER]()

    _health_cache["result"] = result
    _health_cache["checked_at"] = now
    return result


_chat_label = {"ollama": "Ollama (local)", "groq": f"Groq ({GROQ_CHAT_MODEL})", "gemini": f"Gemini ({GEMINI_CHAT_MODEL})"}[CHAT_PROVIDER]
if EMBED_PROVIDER == CHAT_PROVIDER:
    PROVIDER_LABEL = _chat_label
else:
    _embed_label = {"ollama": "Ollama embeddings", "gemini": "Gemini embeddings"}[EMBED_PROVIDER]
    PROVIDER_LABEL = f"{_chat_label} + {_embed_label}"
