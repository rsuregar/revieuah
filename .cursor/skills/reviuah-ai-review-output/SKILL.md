---
name: reviuah-ai-review-output
description: >-
  Use when editing LLM prompts, ReviewResponse typing, risk level parsing, or
  adding OpenAI-compatible providers for ReviuAh diff review output.
---

# ReviuAh AI review output

## Contract

- **`ReviewResponse`** (`src/providers/index.ts`): `{ markdown: string; risk: "low" | "medium" | "high" | "unknown" }`.
- **Markdown sections** (order matters for users): Summary; Risk Level + reasoning; Security; Performance; Testing; Code Quality; Actionable Suggestions.
- **Risk**: Parser in provider should map model text to `low` | `medium` | `high` | `unknown`. `--strict` treats only **`high`** as failure.

## Provider pattern

- **`OpenAIProvider`** (`src/providers/openai.ts`): builds system/user messages from diff + language; calls chat completions; parses risk from reply.
- New providers must return the same section structure so docs and CI stay valid.

## Env / safety

- API key from `REVIUAH_API_KEY` only in command layer; provider receives key via constructor.
- Diff is truncated before send; do not expand without updating limits and README.

## When changing prompts

- Keep output machine-friendly enough to parse risk.
- Update **README** “Required Review Output Structure” if sections change.
