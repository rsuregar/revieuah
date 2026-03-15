---
name: reviuah-ai-review-output
description: >-
  Use when editing LLM prompts, ReviewResponse/PerFileReviewResponse typing,
  risk level parsing, per-file comments, or adding providers.
---

# ReviuAh AI review output

## Contracts

### Summary mode

- **`ReviewResponse`** (`src/providers/index.ts`): `{ markdown: string; risk: RiskLevel }`.
- **Markdown sections** (order matters): Summary → Risk Level → Security → Performance → Testing → Code Quality → Actionable Suggestions.
- **Risk parsing**: regex in each provider maps text to `low | medium | high | unknown`.

### Per-file mode

- **`PerFileReviewResponse`**: `{ summary: string; risk: RiskLevel; comments: FileComment[] }`.
- **`FileComment`**: `{ path: string; line: number; body: string; severity: "critical" | "warning" | "suggestion" | "praise" }`.
- Prompt + parser in `src/providers/per-file-prompt.ts` (shared by all providers).
- `line` must be in the NEW version of the file (right side of diff). `0` = file-level comment.

## Provider pattern

- **Interface**: `Provider` with `review()` (required) and `reviewPerFile()` (optional).
- **`OpenAIProvider`** — chat completions via `openai` SDK. Handles all providers including Gemini (via OpenAI-compatible endpoint). Supports both review modes.
- **`factory.ts`** — `createProvider()` returns `OpenAIProvider` for all providers.

## Env / safety

- API key passed via constructor; never import env directly in providers.
- Diff truncated before send (`MAX_DIFF_SIZE`); do not expand without updating limits.
- Timeout: `REVIUAH_REQUEST_TIMEOUT_MS` (default 60s).

## When changing prompts

- Keep output machine-parseable for risk extraction and JSON per-file parsing.
- Update **README** "Review output" section if Markdown sections change.
- Test with at least 2 providers (e.g. OpenAI + Gemini via OpenAI-compatible endpoint).
