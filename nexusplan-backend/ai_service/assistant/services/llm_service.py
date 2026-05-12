"""
services/llm_service.py — Unified LLM integration for NexusPlan AI Service.

Fallback chain (applied to EVERY generation call):
  1. Google Gemini  (google-generativeai SDK)
  2. Grok / xAI     (OpenAI-compatible REST, x.ai endpoint)
  3. OpenRouter     (OpenAI-compatible REST, openrouter.ai endpoint)

Required environment variables:
  GEMINI_API_KEY      (or GOOGLE_API_KEY)  — Gemini
  GROK_API_KEY                             — xAI / Grok
  OPENROUTER_API_KEY                       — OpenRouter

Optional overrides:
  GEMINI_MODEL        default: gemini-2.0-flash
  GROK_MODEL          default: grok-3-mini
  OPENROUTER_MODEL    default: nousresearch/hermes-3-llama-3.1-405b:free

Public surface:
  generate_tasks_from_description(description)  -> TaskGenerationResult
  summarize_project_data(project_name, tasks_data) -> TextGenerationResult
  copilot_chat(user_message, context_data)      -> TextGenerationResult
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# ============================================================================
# System prompts
# ============================================================================

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

_PROJECT_SUMMARY_SYSTEM_PROMPT = """
You are an executive-level AI project analyst embedded in **NexusPlan**.
Your role is to synthesise project data into a concise, insightful executive summary
that a CTO or Product Owner can read in under 60 seconds.

RULES:
- Write in clear, professional business English (3–5 short paragraphs).
- Always include: overall health assessment, key progress highlights, risks or blockers,
  and a recommended next focus area.
- Do NOT output JSON, bullet lists, or markdown headings — plain prose only.
- Be direct and data-driven. Avoid generic filler phrases.
- If task data is sparse or missing, acknowledge that and infer what you can.
""".strip()

_COPILOT_SYSTEM_PROMPT = """
You are NexusPlan Copilot, an intelligent project management assistant.
You help project managers, developers, and team leads with strategic advice,
task prioritisation, risk identification, and actionable recommendations.

RULES:
- Be concise but thorough. Aim for responses under 300 words unless complexity demands more.
- Always ground your advice in the project/task context provided.
- When context is missing, ask a single clarifying question rather than speculating.
- Use professional yet approachable language — avoid corporate jargon.
- Format your response with light markdown (bold for key points, short lists where helpful).
- Never fabricate project data. If something is unknown, say so clearly.
""".strip()


# ============================================================================
# Data classes
# ============================================================================

_VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}


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
    model_used: str = ""


@dataclass
class TextGenerationResult:
    """Result of a free-text generation (summary or copilot reply)."""
    text: str = ""
    tokens_used: int = 0
    model_used: str = ""  # Which provider/model actually responded


# ============================================================================
# Parsing helpers
# ============================================================================

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
            logger.warning(
                "Task #%d has invalid priority %r, defaulting to MEDIUM.", idx, priority
            )
            priority = "MEDIUM"

        tasks.append(GeneratedTask(title=title, description=description, priority=priority))

    return tasks


# ============================================================================
# Low-level provider calls  (Gemini / Grok / OpenRouter)
# ============================================================================

def _call_gemini(prompt: str, system_prompt: str) -> tuple[str, int, str]:
    """
    Call Google Gemini via the google-generativeai SDK.

    Returns (raw_text, tokens_used, model_label).
    Raises RuntimeError on any failure so the fallback chain can catch it.
    """
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
    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-preview-04-17")

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
    )

    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0.4,
            top_p=0.95,
            max_output_tokens=2048,
        ),
    )

    raw = response.text or ""

    tokens_used = 0
    if hasattr(response, "usage_metadata") and response.usage_metadata:
        meta = response.usage_metadata
        tokens_used = getattr(meta, "total_token_count", 0) or (
            getattr(meta, "prompt_token_count", 0)
            + getattr(meta, "candidates_token_count", 0)
        )

    return raw, tokens_used, f"gemini/{model_name}"


def _call_openai_compatible(
    prompt: str,
    system_prompt: str,
    api_key: str,
    base_url: str,
    model: str,
) -> tuple[str, int, str]:
    """
    Generic OpenAI-compatible chat completions caller (used by Grok & OpenRouter).

    Returns (raw_text, tokens_used, model_label).
    Raises RuntimeError on any failure.
    """
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexusplane.duckdns.org",
        "X-Title": "NexusPlan",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 2048,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        err_body = exc.read().decode("utf-8") if hasattr(exc, "read") else str(exc)
        raise RuntimeError(f"HTTP request to {base_url} failed: {err_body}") from exc
    except Exception as exc:
        raise RuntimeError(f"Unexpected error calling {base_url}: {exc}") from exc

    raw = resp_data["choices"][0]["message"]["content"]
    tokens_used = resp_data.get("usage", {}).get("total_tokens", 0)

    return raw, tokens_used, f"{base_url}/{model}"


def _call_grok(prompt: str, system_prompt: str) -> tuple[str, int, str]:
    """Call the xAI Grok API (OpenAI-compatible)."""
    api_key = os.environ.get("GROK_API_KEY")
    if not api_key:
        raise RuntimeError("GROK_API_KEY is not set in the environment.")
    model = os.environ.get("GROK_MODEL", "grok-3-mini")
    return _call_openai_compatible(
        prompt, system_prompt, api_key, "https://api.x.ai/v1", model
    )


def _call_openrouter(prompt: str, system_prompt: str) -> tuple[str, int, str]:
    """Call the OpenRouter API (OpenAI-compatible, ultimate fallback)."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set in the environment.")
    model = os.environ.get(
        "OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free"
    )
    return _call_openai_compatible(
        prompt, system_prompt, api_key, "https://openrouter.ai/api/v1", model
    )


# ============================================================================
# Core fallback engine
# ============================================================================

def _generate_text_with_fallbacks(prompt: str, system_prompt: str) -> TextGenerationResult:
    """
    Attempt text generation using a strict priority fallback chain:
      1. Google Gemini  (primary)
      2. Grok / xAI    (fallback 1)
      3. OpenRouter     (fallback 2 / last resort)

    Logs a WARNING each time the chain advances to a lower-priority provider
    so operators can track API health without digging into traces.

    Raises RuntimeError only when ALL three providers have failed.
    """
    errors: list[str] = []

    # ── 1. Gemini ──────────────────────────────────────────────────────────
    try:
        logger.info("[LLM] Attempting Gemini (primary)...")
        raw, tokens, model_label = _call_gemini(prompt, system_prompt)
        logger.info("[LLM] Gemini succeeded | tokens=%d | model=%s", tokens, model_label)
        return TextGenerationResult(text=raw, tokens_used=tokens, model_used=model_label)
    except Exception as exc:
        logger.warning(
            "[LLM] ⚠ Gemini FAILED — falling back to Grok. Error: %s", exc
        )
        errors.append(f"Gemini: {exc}")

    # ── 2. Grok (xAI) ─────────────────────────────────────────────────────
    try:
        logger.info("[LLM] Attempting Grok/xAI (fallback 1)...")
        raw, tokens, model_label = _call_grok(prompt, system_prompt)
        logger.info("[LLM] Grok succeeded | tokens=%d | model=%s", tokens, model_label)
        return TextGenerationResult(text=raw, tokens_used=tokens, model_used=model_label)
    except Exception as exc:
        logger.warning(
            "[LLM] ⚠ Grok FAILED — falling back to OpenRouter. Error: %s", exc
        )
        errors.append(f"Grok: {exc}")

    # ── 3. OpenRouter ──────────────────────────────────────────────────────
    try:
        logger.info("[LLM] Attempting OpenRouter (fallback 2 / last resort)...")
        raw, tokens, model_label = _call_openrouter(prompt, system_prompt)
        logger.info(
            "[LLM] OpenRouter succeeded | tokens=%d | model=%s", tokens, model_label
        )
        return TextGenerationResult(text=raw, tokens_used=tokens, model_used=model_label)
    except Exception as exc:
        logger.error(
            "[LLM] ✖ OpenRouter FAILED — all providers exhausted. Error: %s", exc
        )
        errors.append(f"OpenRouter: {exc}")

    raise RuntimeError(
        "All LLM providers failed. Details: " + " | ".join(errors)
    )


# ============================================================================
# Public API
# ============================================================================

# ── Task generation ──────────────────────────────────────────────────────────

def generate_tasks_from_description(description: str) -> TaskGenerationResult:
    """
    Decompose a project description into structured tasks.
    Uses the fallback chain internally and re-parses the JSON array response.

    Raises:
        ValueError   — model returned unparseable JSON.
        RuntimeError — all providers failed.
    """
    logger.info(
        "[LLM] generate_tasks_from_description | desc_len=%d", len(description)
    )
    result = _generate_text_with_fallbacks(description, _TASK_GENERATION_SYSTEM_PROMPT)
    tasks = _parse_task_list(result.text)
    return TaskGenerationResult(
        tasks=tasks,
        tokens_used=result.tokens_used,
        raw_response=result.text,
        model_used=result.model_used,
    )


# ── Project summary ──────────────────────────────────────────────────────────

def summarize_project_data(project_name: str, tasks_data: list[dict]) -> TextGenerationResult:
    """
    Generate a high-level executive summary of a project's progress.

    Args:
        project_name: Human-readable name of the project.
        tasks_data:   List of task dicts from the task_service, each expected
                      to contain at minimum: title, status, priority.
                      Additional fields (description, assignee, dueDate) are
                      included in the prompt if present.

    Returns:
        TextGenerationResult with a prose summary, token count, and model label.
    """
    logger.info(
        "[LLM] summarize_project_data | project=%s | tasks=%d",
        project_name,
        len(tasks_data),
    )

    # ── Build a structured snapshot for the prompt ─────────────────────────
    total = len(tasks_data)
    by_status: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    high_priority_blockers: list[str] = []

    for task in tasks_data:
        status   = str(task.get("status",   "UNKNOWN")).upper()
        priority = str(task.get("priority", "UNKNOWN")).upper()
        by_status[status]     = by_status.get(status, 0) + 1
        by_priority[priority] = by_priority.get(priority, 0) + 1

        if priority == "HIGH" and status not in {"DONE", "COMPLETED", "CLOSED"}:
            title = task.get("title", "Untitled task")
            high_priority_blockers.append(f'  • {title} [{status}]')

    status_summary = "\n".join(
        f"  {k}: {v}" for k, v in sorted(by_status.items())
    ) or "  (no task status data)"

    priority_summary = "\n".join(
        f"  {k}: {v}" for k, v in sorted(by_priority.items())
    ) or "  (no priority data)"

    blockers_section = (
        "\n".join(high_priority_blockers)
        if high_priority_blockers
        else "  None identified."
    )

    # Include a trimmed task list (cap at 30 to avoid context overload)
    task_lines = []
    for t in tasks_data[:30]:
        line = (
            f'  [{t.get("status", "?")}] ({t.get("priority", "?")}) '
            f'{t.get("title", "Untitled")}'
        )
        if desc := t.get("description"):
            line += f' — {desc[:120]}'
        task_lines.append(line)

    task_detail = "\n".join(task_lines) or "  (no tasks provided)"

    prompt = f"""
PROJECT NAME: {project_name}
TOTAL TASKS:  {total}

TASK STATUS BREAKDOWN:
{status_summary}

TASK PRIORITY BREAKDOWN:
{priority_summary}

HIGH-PRIORITY OPEN TASKS (potential blockers):
{blockers_section}

FULL TASK LIST (up to 30 tasks):
{task_detail}

Please provide an executive summary of this project's current state.
""".strip()

    return _generate_text_with_fallbacks(prompt, _PROJECT_SUMMARY_SYSTEM_PROMPT)


# ── Copilot chat ─────────────────────────────────────────────────────────────

def copilot_chat(user_message: str, context_data: dict) -> TextGenerationResult:
    """
    Answer a user's question about their project or tasks with intelligent advice.

    Args:
        user_message: The user's free-text question or request.
        context_data: Optional context dict that may include:
                      - projectId   (UUID string)
                      - projectName (str)
                      - task        (dict with task details)
                      - recentTasks (list of task dicts)
                      - Any other structured data the frontend wants to include.

    Returns:
        TextGenerationResult with the copilot reply, token count, and model label.
    """
    logger.info(
        "[LLM] copilot_chat | msg_len=%d | context_keys=%s",
        len(user_message),
        list(context_data.keys()),
    )

    # ── Build context block ────────────────────────────────────────────────
    ctx_parts: list[str] = []

    if project_name := context_data.get("projectName"):
        ctx_parts.append(f"Project: {project_name}")
    if project_id := context_data.get("projectId"):
        ctx_parts.append(f"Project ID: {project_id}")

    if task := context_data.get("task"):
        ctx_parts.append(
            f"Currently selected task:\n"
            f"  Title:    {task.get('title', 'N/A')}\n"
            f"  Status:   {task.get('status', 'N/A')}\n"
            f"  Priority: {task.get('priority', 'N/A')}\n"
            f"  Description: {task.get('description', 'N/A')}"
        )

    if recent := context_data.get("recentTasks"):
        lines = [
            f"  [{t.get('status','?')}] {t.get('title','Untitled')}"
            for t in recent[:10]
        ]
        ctx_parts.append("Recent tasks:\n" + "\n".join(lines))

    # Catch-all for any extra context keys the frontend may send
    known_keys = {"projectId", "projectName", "task", "recentTasks"}
    for key, value in context_data.items():
        if key not in known_keys and value:
            ctx_parts.append(f"{key}: {json.dumps(value, default=str)[:300]}")

    context_block = (
        "CONTEXT:\n" + "\n\n".join(ctx_parts)
        if ctx_parts
        else "CONTEXT: No additional context provided."
    )

    prompt = f"{context_block}\n\nUSER QUESTION:\n{user_message}"

    return _generate_text_with_fallbacks(prompt, _COPILOT_SYSTEM_PROMPT)
