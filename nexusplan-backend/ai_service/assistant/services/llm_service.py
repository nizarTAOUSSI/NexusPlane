"""
services/llm_service.py — Gemini / OpenAI-compatible LLM integration.

Provider selection (env var LLM_PROVIDER):
  "gemini"  → Google Generative AI SDK  (default, already in requirements.txt)
  "openai"  → openai SDK                (add openai to requirements.txt if needed)

Required env vars:
  GEMINI_API_KEY   — for the Gemini provider
  OPENAI_API_KEY   — for the OpenAI provider

The public surface is intentionally small:
  generate_tasks_from_description(description: str) -> TaskGenerationResult
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

_TASK_GENERATION_SYSTEM_PROMPT = """
You are a senior project manager assistant embedded in NexusPlan, a professional
project-management platform.

Your ONLY job is to decompose a project or feature description into a list of
actionable tasks.

STRICT OUTPUT CONTRACT:
- Respond with a RAW JSON array and NOTHING else.
- No markdown fences (no ```json), no explanations, no extra keys.
- Every element MUST have exactly these three keys:
    "title"       : string  — concise task name (≤ 80 chars)
    "description" : string  — clear, actionable details (1-3 sentences)
    "priority"    : string  — exactly one of: HIGH | MEDIUM | LOW

EXAMPLE (format only — do not reuse content):
[
  {"title": "Set up CI pipeline", "description": "Configure GitHub Actions for lint, test, and build steps.", "priority": "HIGH"},
  {"title": "Write unit tests",   "description": "Add pytest coverage for the authentication module.",        "priority": "MEDIUM"}
]

If the description is too vague to generate meaningful tasks, return an empty
array: []
""".strip()


@dataclass
class GeneratedTask:
    title: str
    description: str
    priority: str  # HIGH | MEDIUM | LOW


@dataclass
class TaskGenerationResult:
    tasks: list[GeneratedTask] = field(default_factory=list)
    tokens_used: int = 0
    raw_response: str = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}


def _parse_task_list(raw: str) -> list[GeneratedTask]:
    """
    Extract and validate the JSON array from the model's raw text output.
    Strips accidental markdown fences if the model misbehaves.
    """
    clean = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

    try:
        data: Any = json.loads(clean)
    except json.JSONDecodeError as exc:
        logger.error("LLM returned invalid JSON: %s | raw=%r", exc, raw[:300])
        raise ValueError(f"Model did not return valid JSON: {exc}") from exc

    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array, got {type(data).__name__}.")

    tasks: list[GeneratedTask] = []
    for idx, item in enumerate(data):
        if not isinstance(item, dict):
            logger.warning("Task #%d is not a dict, skipping.", idx)
            continue

        title       = str(item.get("title", "")).strip()
        description = str(item.get("description", "")).strip()
        priority    = str(item.get("priority", "MEDIUM")).strip().upper()

        if not title:
            logger.warning("Task #%d has no title, skipping.", idx)
            continue

        if priority not in _VALID_PRIORITIES:
            logger.warning("Task #%d has invalid priority %r, defaulting to MEDIUM.", idx, priority)
            priority = "MEDIUM"

        tasks.append(GeneratedTask(title=title, description=description, priority=priority))

    return tasks


# ---------------------------------------------------------------------------
# Gemini provider
# ---------------------------------------------------------------------------

def _generate_with_gemini(description: str) -> TaskGenerationResult:
    """Call Google Gemini via the google-generativeai SDK."""
    try:
        import google.generativeai as genai  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "google-generativeai is not installed. "
            "Add it to requirements.txt and rebuild the container."
        ) from exc

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY (or GOOGLE_API_KEY) is not set in the environment."
        )

    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
        system_instruction=_TASK_GENERATION_SYSTEM_PROMPT,
    )

    response = model.generate_content(
        description,
        generation_config=genai.types.GenerationConfig(
            temperature=0.3,
            top_p=0.95,
            max_output_tokens=2048,
        ),
    )

    raw = response.text or ""

    tokens_used = 0
    if hasattr(response, "usage_metadata") and response.usage_metadata:
        meta = response.usage_metadata
        tokens_used = (
            getattr(meta, "total_token_count", 0)
            or (
                getattr(meta, "prompt_token_count", 0)
                + getattr(meta, "candidates_token_count", 0)
            )
        )

    tasks = _parse_task_list(raw)
    return TaskGenerationResult(tasks=tasks, tokens_used=tokens_used, raw_response=raw)


# ---------------------------------------------------------------------------
# OpenAI-compatible API caller (used by Groq & OpenRouter)
# ---------------------------------------------------------------------------

def _call_openai_compatible_api(description: str, api_key: str, base_url: str, model: str) -> TaskGenerationResult:
    import urllib.request
    import urllib.error

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexusplane.duckdns.org", # Required by OpenRouter
        "X-Title": "NexusPlan"
    }
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": _TASK_GENERATION_SYSTEM_PROMPT},
            {"role": "user", "content": description}
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            resp_body = response.read().decode("utf-8")
            resp_data = json.loads(resp_body)
    except urllib.error.URLError as e:
        err_msg = e.read().decode("utf-8") if hasattr(e, 'read') else str(e)
        raise RuntimeError(f"API call to {base_url} failed: {err_msg}")
        
    raw = resp_data["choices"][0]["message"]["content"]
    usage = resp_data.get("usage", {})
    tokens_used = usage.get("total_tokens", 0)
    
    tasks = _parse_task_list(raw)
    return TaskGenerationResult(tasks=tasks, tokens_used=tokens_used, raw_response=raw)

def _generate_with_groq(description: str) -> TaskGenerationResult:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")
    return _call_openai_compatible_api(
        description, 
        api_key, 
        "https://api.groq.com/openai/v1", 
        os.environ.get("GROQ_MODEL", "llama3-8b-8192")
    )

def _generate_with_openrouter(description: str) -> TaskGenerationResult:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set in the environment.")
    return _call_openai_compatible_api(
        description, 
        api_key, 
        "https://openrouter.ai/api/v1", 
        os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3-8b-instruct:free")
    )

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_tasks_from_description(description: str) -> TaskGenerationResult:
    """
    Main entry-point. Implements a fallback strategy:
    Gemini (Main logic) -> Groq (Fast response) -> OpenRouter (Fallback)

    Args:
        description: Free-text project or feature description from the user.

    Returns:
        TaskGenerationResult with a validated list of GeneratedTask objects.

    Raises:
        ValueError: All AI providers failed.
    """
    logger.info("generate_tasks_from_description called | desc_len=%d", len(description))

    try:
        logger.info("Trying Gemini provider...")
        return _generate_with_gemini(description)
    except Exception as e:
        logger.warning("Gemini failed: %s", e)

    try:
        logger.info("Trying Groq provider...")
        return _generate_with_groq(description)
    except Exception as e:
        logger.warning("Groq failed: %s", e)

    try:
        logger.info("Trying OpenRouter provider...")
        return _generate_with_openrouter(description)
    except Exception as e:
        logger.error("OpenRouter failed: %s", e)

    raise ValueError("All AI providers (Gemini, Groq, OpenRouter) failed or are missing API keys.")
