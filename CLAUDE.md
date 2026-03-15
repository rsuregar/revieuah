# ReviuAh — context for Claude

## What this repo is

**ReviuAh** is a **Node.js CLI** (TypeScript, ESM) that:

1. Reads a Git diff (staged, single commit, or range e.g. `main...HEAD`).
2. Sends the diff to an LLM via configurable providers (OpenAI-compatible or Gemini native).
3. Returns structured review — either Markdown (summary mode) or JSON (per-file inline mode).
4. Supports `--strict` to exit non-zero when risk is **high** (CI gate).
5. In CI, posts review as PR/MR comment and per-file inline comments on changed lines.

Bin names: **`reviuah`** and **`reviewah`** (alias). Entry: `src/cli.ts` → `dist/cli.js`.

## Stack

- **Runtime**: Node ≥ 20, ESM (`"type": "module"`).
- **CLI**: Commander.
- **Git**: `execa` + `src/git/diff.ts`.
- **LLM**: `openai` package (OpenAI-compatible for all providers including Gemini).
- **TUI**: `blessed` (setup wizard).
- **Versioning**: `semver`.

## Layout

| Area | Path |
|------|------|
| CLI & flags | `src/cli.ts` |
| Commands | `src/commands/` (review, setup, config-status, update, version-bump) |
| Diff collection | `src/git/diff.ts` |
| Provider interface | `src/providers/index.ts` |
| Provider factory | `src/providers/factory.ts` |
| OpenAI-compatible provider | `src/providers/openai.ts` (handles all providers including Gemini) |
| Per-file prompt/parser | `src/providers/per-file-prompt.ts` |
| Config | `src/config/user-config.ts` |
| Shared utils | `src/lib/` (package-root, check-update, read-secret) |
| UI components | `src/ui/` (logo, spinner, setup-wizard, select-box) |

## Config & env

- **`reviuah setup`** — TUI wizard or simple prompts → `~/.reviuah/config.json`.
- **`reviuah config`** — print path & status. `--update` reopens setup.
- Default provider: **agentrouter** (`https://agentrouter.org/v1`).
- Env overrides file: `REVIUAH_API_KEY`, `REVIUAH_PROVIDER`, `REVIUAH_PROVIDER_URL`, `REVIUAH_MODEL`, `REVIUAH_MAX_DIFF_SIZE`, `REVIUAH_REQUEST_TIMEOUT_MS`.

## Conventions

- **TypeScript strict**; keep files focused (≤ 200–300 lines).
- **No secrets in code**; never log API keys.
- **Large diffs**: truncated in `review.ts` (`MAX_DIFF_SIZE`); document if changed.
- After changing review shape, update provider prompts and README.
- **Verify**: `yarn check` (tsc), `yarn build`.

## When adding features

- New diff modes → extend `src/git/diff.ts` and `ReviewCommandOptions`.
- New providers → implement `Provider` interface; wire in `factory.ts`.
- CI behavior → preserve `--strict` semantics; both summary + per-file modes.

See **AGENTS.md** for Cursor/agent pointers and **`.cursor/skills/`** for workflow skills.
