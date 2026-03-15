# Agent instructions — ReviuAh

This file orients coding agents (Cursor, Claude Code, etc.) working on **ReviuAh**, a Node CLI that reviews Git diffs with an LLM.

## Read first

- **[CLAUDE.md](./CLAUDE.md)** — project purpose, layout, env vars, conventions.
- **[README.md](./README.md)** — user-facing CLI, config, CI examples.

## Project skills (Cursor)

Skills live under **`.cursor/skills/`** (committed so the whole team gets them):

| Skill | When to use |
|-------|-------------|
| `reviuah-cli-architecture` | Changing CLI flags, diff scope, git integration, review flow. |
| `reviuah-ai-review-output` | Prompt shape, `ReviewResponse`, risk parsing, provider prompts. |

Agents should load the relevant skill before large edits in those areas.

## Do / don’t

- **Do**: Run `yarn check` after TypeScript changes; keep ESM imports (`.js` suffix in TS source where required by NodeNext).
- **Do**: Preserve structured Markdown sections expected by users and strict-mode risk detection.
- **Don’t**: Commit secrets, `node_modules`, or `.env`; don’t weaken truncation without an explicit product decision.

## Testing commands

```bash
yarn install
yarn check    # tsc --noEmit
yarn build    # emit dist/
```

Local CLI after build: `node dist/cli.js` or `yarn link` from repo root.
