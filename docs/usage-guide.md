# How to Use ReviuAh

Similar to [Commitah](https://github.com/utsmannn/commitah): by default ReviuAh reads **staged diff**. See [commands-and-env-guide.md](./commands-and-env-guide.md) for the full command reference.

## Setup API key

```bash
reviuah setup
```

Follow the prompts (API key is masked with `*`). Config is saved to `~/.reviuah/config.json`. Check status: `reviuah config`.

Priority: **environment variables** override the config file (useful for CI).

## Install

If `npm install -g reviuah` returns **404** → the package is not on npm yet. Use:

```bash
npm install -g git+https://github.com/rsuregar/reviewah.git
```

Once published on npm: `npm install -g reviuah`. Without global install: `npx reviuah` (only if published).

The **`reviewah`** command is the same as **`reviuah`**.

## On a feature branch

1. `git checkout <your-branch>`
2. Set `REVIUAH_API_KEY` (and optionally provider/model)
3. Run:

```bash
reviuah --base main --lang en
```

For a PR that tracks `origin/main`:

```bash
reviuah --base origin/main --out review.md
```

## Other modes

| Need | Example |
|------|---------|
| Staged only | `git add . && reviuah` |
| Single commit | `reviuah --commit abc123` |
| Range | `reviuah --range develop...HEAD` |

## Prompt file example (`reviuah-prompt.md`)

If you want team-wide review rules, create a file named `reviuah-prompt.md` in your **git repo root**. ReviuAh will use it automatically when `--prompt` and `REVIUAH_CUSTOM_PROMPT` are not set.

Important: the prompt file is read from the **repository where you run `reviuah`**, not from the ReviuAh tool repository. So if you use ReviuAh in another project, that other project needs its own `reviuah-prompt.md` in its repo root.

Example:

```md
# Review role
Act as a senior frontend engineer reviewing React and Next.js code.

# Review principles
Apply SOLID, KISS, DRY, and clean code principles.
Focus on maintainability, readability, component boundaries, state management, rendering behavior, hooks usage, accessibility, and Next.js conventions.

# Severity threshold
Only report findings when severity is medium, high, or critical.
Do not comment on low-severity or purely cosmetic issues.

# Review style
Be concise and actionable.
Prioritize real risks, architectural issues, bugs, performance problems, accessibility issues, and maintainability concerns.
Suggest improvements only when they are concrete and high value.
```

## Publish to npm (maintainers)

- **Automatic:** On every **merge to `main`**, the **Publish to npm** workflow runs: bump patch → publish → push tag. Requires **`NPM_TOKEN`** secret in the repo (Settings → Secrets → Actions).
- **Manual:** Actions tab → Publish to npm → Run workflow (choose patch/minor/major), or locally: `yarn build && npm publish --access public`.

## `reviuah update` (development)

Updates dependencies and rebuilds the ReviuAh project. **Run from the ReviuAh repo root.** If you see "package.json not found", you are either in the wrong directory or using an old global install. Use one of:

```bash
# From ReviuAh repo root (recommended)
yarn build && node dist/cli.js update

# Or reinstall global from current source, then run from repo root
cd /path/to/reviewah && npm install -g . && reviuah update
```
