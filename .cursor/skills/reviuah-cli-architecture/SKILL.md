---
name: reviuah-cli-architecture
description: >-
  Use when changing the ReviuAh Node CLI entrypoint, Commander flags, git diff
  sources (staged/commit/range), or wiring between cli.ts, review command, and
  git/diff.ts.
---

# ReviuAh CLI architecture

## Flow

1. **`src/cli.ts`** — Commander program: `--commit`, `--range`, `--strict`, `--lang`. Parses argv and calls `reviewCommand`.
2. **`src/commands/review.ts`** — Ensures git repo, resolves diff via `resolveDiff`, trims size, instantiates provider, prints markdown, returns `{ markdown, risk }`.
3. **`src/git/diff.ts`** — `getStagedDiff`, `getCommitDiff`, `getRangeDiff` via `git` + execa.

## Rules

- **Mutually exclusive**: `--commit` and `--range` must not both be set (enforced in `reviewCommand`).
- **Empty diff**: Return fixed markdown + `risk: "unknown"`; do not call the API.
- **Strict mode**: Only `cli.ts` should set `process.exitCode = 1` when `strict && risk === "high"`.

## Setup & config

- **`reviuah setup`** — interactive write to `~/.reviuah/config.json` (apiKey, provider, model, providerUrl). File mode `0600` where supported.
- **`reviuah config`** — print path and masked key status.
- Review uses `resolveReviewCredentials()`: env overrides saved file.

## Branch workflow

- **`--base <ref>`** → `getRangeDiff(\`${ref}...HEAD\`)` (sama semantik dengan `git diff base...HEAD`).
- Hanya satu mode diff: staged (default), `--commit`, `--range`, atau `--base`.

## Extending the CLI

- New flags: add to Commander in `cli.ts`, extend `ReviewCommandOptions` in `review.ts`, thread through `resolveDiff` or provider as needed.
- New diff modes: add a function in `diff.ts` and a branch in `resolveDiff`.
- Keep **stdout** as the primary review output for piping/CI unless adding an explicit `--out` (if README promises it, implement consistently).
