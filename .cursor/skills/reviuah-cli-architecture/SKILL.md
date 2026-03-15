---
name: reviuah-cli-architecture
description: >-
  Use when changing the ReviuAh Node CLI entrypoint, Commander flags, git diff
  sources, commands, or wiring between cli.ts, review command, and git/diff.ts.
---

# ReviuAh CLI architecture

## Flow

1. **`src/cli.ts`** — Commander program with subcommands (`setup`, `config`, `version`, `update`) and review flags (`--commit`, `--range`, `--base`, `--strict`, `--lang`, `--out`, `--per-file`).
2. **`src/commands/review.ts`** — Ensures git repo, resolves diff, trims size, instantiates provider via `createProvider()`, runs review or per-file review, outputs result.
3. **`src/git/diff.ts`** — `getStagedDiff`, `getCommitDiff`, `getRangeDiff` via `execa`.

## Rules

- **Mutually exclusive**: only one diff mode allowed (`--commit`, `--range`, `--base`, or default staged).
- **Empty diff**: return fixed markdown + `risk: "unknown"`; do NOT call the API.
- **Strict mode**: only `cli.ts` sets `process.exitCode = 1` when `strict && risk === "high"`.
- **stdout = user output only**: review content goes to stdout; status/debug to stderr.

## Commands

| Command | Purpose |
|---------|---------|
| `setup` | TUI wizard (blessed) or simple prompts → `~/.reviuah/config.json`. Flags: `--wizard`, `--no-wizard`. |
| `config` | Print config path + masked key status. `--update` reopens setup. |
| `version <type>` | Bump `package.json` version using `semver`. |
| `update` | `yarn install` + `yarn build` (development convenience). |

## Config resolution

`resolveReviewCredentials()` in `src/config/user-config.ts`: env vars (`REVIUAH_*`) override saved file. Provider defaults in `openai.ts` `PROVIDER_TEMPLATES`.

## Review modes

- **Summary** (default): single markdown blob via `provider.review()`.
- **Per-file** (`--per-file`): JSON with inline comments via `provider.reviewPerFile()`. Used by CI to post inline PR/MR comments.

## Extending

- New flags → add to Commander in `cli.ts`, extend `ReviewCommandOptions`, thread through.
- New diff modes → add function in `diff.ts`, add branch in `resolveDiff`.
- New commands → create `src/commands/<name>.ts`, register in `cli.ts`.
- Shared utils → `src/lib/` (e.g. `package-root.ts`).
