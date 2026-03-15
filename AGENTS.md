# Agent Instructions — ReviuAh

This file orients coding agents (Cursor, Claude Code, etc.) working on **ReviuAh**, a Node CLI that reviews Git diffs with an LLM.

## Read first

- **[CLAUDE.md](./CLAUDE.md)** — project purpose, layout, env vars, conventions.
- **[README.md](./README.md)** — user-facing CLI, config, CI examples.

## Engineering principles

1. **KISS** — prefer simple, readable solutions. Avoid cleverness that hurts clarity.
2. **DRY** — shared logic lives in `src/lib/`. Check before duplicating.
3. **YAGNI** — only add what the current task requires; remove dead code immediately.
4. **SOLID** — single responsibility per file/function; depend on interfaces (`Provider`), not concrete classes.
5. **Clean code** — meaningful names, small functions (<30 lines), no magic numbers, no commented-out code.
6. **Files ≤ 200–300 lines** — refactor proactively when a file grows beyond this.

## Architecture

```
src/
├── cli.ts                  # Commander entrypoint (flags, subcommands)
├── commands/               # One file per command (review, setup, config, update, version)
├── config/user-config.ts   # Read/write ~/.reviuah/config.json, env resolution
├── git/diff.ts             # Git operations (staged, commit, range)
├── lib/                    # Shared utilities (package-root, check-update, read-secret)
├── providers/
│   ├── index.ts            # Provider interface, types (ReviewResponse, FileComment, etc.)
│   ├── factory.ts          # createProvider() → OpenAIProvider
│   ├── openai.ts           # OpenAI-compatible provider (all providers incl. Gemini) + templates
│   └── per-file-prompt.ts  # Shared prompt + parser for per-file inline review
└── ui/                     # TUI components (banner, spinner, wizard, select-box)
```

## Project skills (Cursor)

Skills live under **`.cursor/skills/`** (committed):

| Skill | When to use |
|-------|-------------|
| `reviuah-cli-architecture` | CLI flags, diff flow, commands, git integration. |
| `reviuah-ai-review-output` | LLM prompts, `ReviewResponse`/`PerFileReviewResponse`, risk parsing, per-file comments. |
| `reviuah-ci-integration`   | GitHub/GitLab workflows, PR/MR commenting, `--per-file` CI usage. |

Load the relevant skill before large edits in those areas.

## Do / Don't

**Do:**
- Run `yarn check` after every TypeScript change.
- Keep ESM imports (`.js` suffix in TS source, required by NodeNext).
- Preserve structured Markdown sections expected by users and strict-mode risk detection.
- Write clear, specific error messages with actionable guidance.
- Keep provider logic behind the `Provider` interface — never import a concrete provider outside `factory.ts`.

**Don't:**
- Commit secrets, `node_modules`, `.env`, `review.md`, or `review.json`.
- Weaken diff truncation without explicit product decision.
- Add dependencies without justification — the CLI must stay lightweight.
- Mix console.log (user output) and console.error (debug/status) — stdout is for review content only.

## Testing

```bash
yarn install
yarn check    # tsc --noEmit
yarn build    # emit dist/
```

Local CLI after build: `node dist/cli.js` or `yarn link` from repo root.

## Review modes

| Mode | Flag | Output |
|------|------|--------|
| Summary (default) | — | Markdown to stdout or `--out file.md` |
| Per-file inline | `--per-file` | JSON to stdout or `--out file.json` |

CI workflows use both modes: summary as PR/MR comment, per-file as inline review comments.
