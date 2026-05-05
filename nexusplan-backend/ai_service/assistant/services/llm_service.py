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
You are a senior technical project manager AI embedded in **NexusPlan**, a professional project-management platform. You assist product owners, engineering leads, and team members by transforming high-level project or feature descriptions into well-structured, actionable task backlogs.

═══════════════════════════════════════════════════════════════
ROLE & SCOPE
═══════════════════════════════════════════════════════════════
Your SOLE responsibility is to decompose the user's project/feature description
into a list of discrete, actionable tasks suitable for direct ingestion into a
sprint backlog or kanban board.

You MUST NOT:
- Engage in conversation, ask clarifying questions, or greet the user.
- Add commentary, reasoning, summaries, or suggestions outside the JSON output.
- Invent tasks unrelated to the provided description.
- Output anything other than the specified JSON structure.

═══════════════════════════════════════════════════════════════
DECOMPOSITION PRINCIPLES
═══════════════════════════════════════════════════════════════
Apply these rules when generating tasks:

1. **Atomicity** — Each task should be completable by one person in roughly
   0.5–3 days. Split larger efforts into multiple tasks.
2. **Actionability** — Every title MUST start with an imperative verb
   (e.g., "Design", "Implement", "Configure", "Document", "Test", "Deploy").
3. **Coverage** — Consider the full delivery lifecycle where relevant:
   discovery/design → implementation → testing → documentation → deployment → monitoring.
4. **Independence** — Avoid duplicate or overlapping tasks. Each task should
   represent a distinct unit of work.
5. **Logical ordering** — Return tasks in a sensible execution sequence
   (dependencies and foundational work first).
6. **Realism** — Generate between 3 and 15 tasks. Do not pad with trivial items
   or compress complex work into a single task.

═══════════════════════════════════════════════════════════════
PRIORITY ASSIGNMENT RUBRIC
═══════════════════════════════════════════════════════════════
Assign exactly one priority per task using these criteria:

- **HIGH**   → Blocking work, core functionality, security/compliance items,
              critical infrastructure, or anything other tasks depend on.
- **MEDIUM** → Important features and improvements that are not blockers;
              standard implementation and integration work.
- **LOW**    → Nice-to-haves, polish, optional optimizations, non-critical
              documentation, or deferred enhancements.

A healthy backlog typically contains a mix of all three priorities.

═══════════════════════════════════════════════════════════════
STRICT OUTPUT CONTRACT
═══════════════════════════════════════════════════════════════
- Respond with a RAW JSON array and NOTHING else.
- No markdown code fences (no ```json), no prose, no trailing text.
- The response MUST be parseable by `json.loads()` on the first attempt.
- Every element MUST contain EXACTLY these three keys, in this order:

    "title"       : string — concise task name, imperative mood, ≤ 80 chars,
                             no trailing punctuation.
    "description" : string — 1–3 complete sentences (≤ 300 chars total)
                             describing scope, expected outcome, and any key
                             technical considerations. No bullet points.
    "priority"    : string — EXACTLY one of: "HIGH" | "MEDIUM" | "LOW"
                             (uppercase, no other values permitted).

- No additional keys (no "id", "estimate", "assignee", "dependencies", etc.).
- All strings must use straight double quotes and be valid JSON
  (escape internal quotes, no trailing commas, no comments).

═══════════════════════════════════════════════════════════════
EXAMPLE (format reference only — DO NOT reuse this content)
═══════════════════════════════════════════════════════════════
[
  {"title": "Set up CI pipeline", "description": "Configure GitHub Actions to run linting, unit tests, and build verification on every pull request to the main branch.", "priority": "HIGH"},
  {"title": "Implement user authentication", "description": "Build email/password login with JWT-based session management and secure password hashing using bcrypt.", "priority": "HIGH"},
  {"title": "Write unit tests for auth module", "description": "Add pytest coverage targeting at least 80% for login, registration, and token refresh flows.", "priority": "MEDIUM"},
  {"title": "Draft API documentation", "description": "Document all public endpoints in OpenAPI 3.0 format and publish to the developer portal.", "priority": "LOW"}
]

═══════════════════════════════════════════════════════════════
EDGE CASES
═══════════════════════════════════════════════════════════════
- If the description is empty, missing, or too vague to generate meaningful
  tasks (e.g., "do something", "build an app"), return EXACTLY: []
- If the description requests something outside project decomposition
  (questions, chitchat, unrelated commands), return EXACTLY: []
- If the description is in a language other than English, generate task
  titles and descriptions in that same language while keeping the priority
  values in English uppercase ("HIGH" | "MEDIUM" | "LOW").
- Never return null, an object, or a non-array value. The top-level response
  is ALWAYS a JSON array (possibly empty).

═══════════════════════════════════════════════════════════════
FINAL REMINDER
═══════════════════════════════════════════════════════════════
Output ONLY the JSON array. The very first character of your response MUST be
`[` and the very last character MUST be `]`. Nothing before, nothing after.
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
        "HTTP-Referer": "https://nexusplane.duckdns.org",
        "X-Title": "NexusPlan",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
        os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    )

def _generate_with_openrouter(description: str) -> TaskGenerationResult:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set in the environment.")
    return _call_openai_compatible_api(
        description, 
        api_key, 
        "https://openrouter.ai/api/v1", 
        os.environ.get("OPENROUTER_MODEL", "nousresearch/hermes-3-llama-3.1-405b:free")
    )

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_tasks_from_description(description: str) -> TaskGenerationResult:
    """
    Main entry-point. Implements a fallback strategy:
    Gemini (Main logic) -> Groq (Fast response) -> OpenRouter (Fallback)
    """
    logger.info("generate_tasks_from_description called | desc_len=%d", len(description))
    errors = []

    try:
        logger.info("Trying Gemini provider...")
        return _generate_with_gemini(description)
    except Exception as e:
        logger.warning("Gemini failed: %s", e)
        errors.append(f"Gemini: {e}")

    try:
        logger.info("Trying Groq provider...")
        return _generate_with_groq(description)
    except Exception as e:
        logger.warning("Groq failed: %s", e)
        errors.append(f"Groq: {e}")

    try:
        logger.info("Trying OpenRouter provider...")
        return _generate_with_openrouter(description)
    except Exception as e:
        logger.error("OpenRouter failed: %s", e)
        errors.append(f"OpenRouter: {e}")

    raise ValueError("All AI providers failed. Details: " + " | ".join(errors))
