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
