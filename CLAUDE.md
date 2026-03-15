# ReviuAh — context for Claude

## What this repo is

**ReviuAh** is a **Node.js CLI** (TypeScript, ESM) that:

1. Reads a Git diff (staged, single commit, or range e.g. `main...HEAD`).
2. Sends the diff to an LLM (currently OpenAI-compatible via `OpenAIProvider`).
3. Prints structured Markdown: summary, risk, security, performance, testing, quality, actionable items.
4. Supports `--strict` to exit non-zero when risk is **high** (CI gate).

Bin names: **`reviuah`** and **`reviewah`** (alias). Entry: `src/cli.ts` → `dist/cli.js`.

## Stack

- **Runtime**: Node ≥18, ESM (`"type": "module"`).
- **CLI**: Commander.
- **Git**: `execa` + `src/git/diff.ts`.
- **LLM**: `openai` package; base URL/model overridable for compatible APIs.

## Layout

| Area | Path |
|------|------|
| CLI & flags | `src/cli.ts` |
| Review orchestration | `src/commands/review.ts` (`--base`, `--out`, staged/commit/range) |
| Diff collection | `src/git/diff.ts` |
| Provider types | `src/providers/index.ts` |
| OpenAI-compatible provider | `src/providers/openai.ts` |

## Config & env

- **`reviuah setup`** — simpan API key + provider ke `~/.reviuah/config.json`.
- **`reviuah config`** — tampilkan path & status key.
- Default provider tanpa config: **agentrouter** (`https://agentrouter.org/v1`, model default `gpt-4o`). Env mengoverride file: `REVIUAH_API_KEY`, `REVIUAH_PROVIDER`, `REVIUAH_PROVIDER_URL`, `REVIUAH_MODEL`.

## Conventions

- **TypeScript strict**; keep files focused (<~300 lines).
- **No secrets in code**; never log API keys.
- **Large diffs**: truncated in `review.ts` (`MAX_DIFF_SIZE`); document if changed.
- After changing review shape, update provider system prompt and README “Required Review Output Structure”.
- **Verify**: `yarn check` (tsc), `yarn build`.

## When adding features

- New diff modes → extend `src/git/diff.ts` and `reviewCommand` options.
- New providers → implement same `ReviewResponse` contract as `OpenAIProvider`; wire in `review.ts`.
- CI behavior → preserve `--strict` semantics documented in README.

See **AGENTS.md** for Cursor/agent pointers and **`.cursor/skills/`** for workflow skills.
