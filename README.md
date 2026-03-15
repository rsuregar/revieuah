# ReviuAh

[![npm version](https://img.shields.io/npm/v/reviuah.svg)](https://www.npmjs.com/package/reviuah)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered CLI to review Git diffs before commit or push. Get structured feedback (summary, risk, security, performance, testing) from an LLM. Use staged changes, a commit, or a branch diff.

---

## Install

```bash
npm install -g reviuah
```

Or with yarn / pnpm:

```bash
yarn global add reviuah
pnpm add -g reviuah
```

**Requirements:** Node.js 18+, Git. Commands: `reviuah` or `reviewah` (same).

---

## Quick start

**1. Configure your API key (one-time):**

```bash
reviuah setup
```

Interactive setup saves config to `~/.reviuah/config.json`.  
- **TUI tidak muncul?** Jalankan `reviuah setup --wizard` (paksa form penuh) atau gunakan terminal luar IDE.  
- `reviuah setup --no-wizard` = prompt sederhana saja (untuk automation).  
- **Ubah config lagi:** `reviuah config --update` atau `reviuah setup`. You can also set `REVIUAH_API_KEY` (and optionally `REVIUAH_PROVIDER`, `REVIUAH_MODEL`) in your environment. Check status: `reviuah config`.

**2. Run a review:**

```bash
# Review staged changes (after git add)
reviuah

# Review current branch vs main
reviuah --base main

# Save to file
reviuah --base main --out review.md
```

---

## Usage

| Scenario | Command |
|----------|---------|
| Staged changes only | `reviuah` |
| Specific commit | `reviuah --commit HEAD` |
| Git range | `reviuah --range main...HEAD` |
| Current branch vs base | `reviuah --base main` |
| Fail CI if high risk | `reviuah --base origin/main --strict` |

**Options:** `--lang <code>`, `--out <file>`, `--strict` (exit 1 when risk is high). Run `reviuah --help` for full list.

After a review run, if a newer version is available on npm, ReviuAh prints a one-line notice and suggests updating with `npm install -g reviuah@latest` or `yarn global add reviuah@latest`. (Skipped in CI.)

---

## Review output (Markdown)

The CLI prints structured Markdown:

1. Summary  
2. Risk Level (low / medium / high / unknown) + reason  
3. Security Review  
4. Performance Review  
5. Testing Suggestions  
6. Code Quality & Maintainability  
7. Actionable Suggestions  

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `REVIUAH_API_KEY` | **Required** for API calls |
| `REVIUAH_PROVIDER` | Preset: `agentrouter`, `openai`, `gemini`, `deepseek`, `ollama`, etc. Default: `agentrouter` |
| `REVIUAH_PROVIDER_URL` | Override API base URL |
| `REVIUAH_MODEL` | Override model name |
| `REVIUAH_MAX_DIFF_SIZE` | Max characters of diff sent to the API (default 120000). Lower = fewer tokens / cheaper. |
| `REVIUAH_REQUEST_TIMEOUT_MS` | Timeout for LLM API requests in ms (default 60000). |

Env overrides saved config (useful for CI).

---

## CI (GitHub Actions)

Use `fetch-depth: 0` so the base branch is available for `git diff base...HEAD`.

```yaml
name: AI Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g reviuah
      - run: reviuah --range origin/${{ github.base_ref }}...HEAD --strict
        env:
          REVIUAH_API_KEY: ${{ secrets.REVIUAH_API_KEY }}
```

---

## Similar tools: Commitah vs ReviuAh

[Commitah](https://github.com/utsmannn/commitah) generates **commit messages** from staged diff. **ReviuAh** generates a **code review** from the same input. You can use both: run `reviuah` first, then `commitah`.

---

## Development

```bash
git clone https://github.com/rsuregar/reviewah.git && cd reviewah
yarn install
yarn build
yarn link
```

Then run `reviuah` from any repo. Publish: set `NPM_TOKEN` in repo Secrets and merge to `main`, or run the **Publish to npm** workflow manually (Actions tab).

**Install from source (no npm publish):**

```bash
npm install -g git+https://github.com/rsuregar/reviewah.git
```

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Links

- [npm](https://www.npmjs.com/package/reviuah)
- [GitHub](https://github.com/rsuregar/reviewah)
- [docs/cara-pakai.md](./docs/cara-pakai.md) (short guide, ID)
