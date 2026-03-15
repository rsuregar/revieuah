# ReviuAh

[![npm version](https://img.shields.io/npm/v/reviuah.svg)](https://www.npmjs.com/package/reviuah)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered CLI to review Git diffs before commit or push. Get structured feedback (summary, risk, security, performance, testing) from an LLM. Use staged changes, a commit, or a branch diff. With `--per-file`, inline comments can include optional **suggested code** (optimal fix or improvement).

---

## Install

```bash
npm install -g reviuah
```

Or with yarn:

```bash
yarn global add reviuah
```

**Requirements:** Node.js 20+ (22 LTS recommended; CI uses Node 22). Git. Commands: `reviuah` or `reviewah` (same).

---

## Quick start

**1. Configure your API key (one-time):**

```bash
reviuah setup
```

Interactive setup saves config to `~/.reviuah/config.json`. You can also set `REVIUAH_API_KEY` (and optionally `REVIUAH_PROVIDER`, `REVIUAH_MODEL`) in your environment. Check status: `reviuah config`.

**2. Run a review:**

```bash
# Review staged changes (after git add)
reviuah

# Review current branch vs main
reviuah --base main

# Save to file
reviuah --base main --out review.md

# Custom instructions (e.g. focus on security)
reviuah --base main --prompt "Focus on security and SQL injection risks."
```

---

## Usage

| Scenario               | Command                               |
| ---------------------- | ------------------------------------- |
| Staged changes only    | `reviuah`                             |
| Specific commit        | `reviuah --commit HEAD`               |
| Git range              | `reviuah --range main...HEAD`         |
| Current branch vs base | `reviuah --base main`                 |
| Fail CI if high risk   | `reviuah --base origin/main --strict` |

**Options:** `--lang <code>`, `--out <file>`, `--strict` (exit 1 when risk is high), `--summary` / `--no-summary`, `--prompt <text>` (custom instructions for the reviewer). Run `reviuah --help` for full list.

After a review run, if a newer version is available on npm, ReviuAh prints a one-line notice (Commitah-style) and suggests updating with `npm install -g reviuah@latest`. (Skipped in CI.)

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

| Variable                     | Description                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `REVIUAH_API_KEY`            | **Required** for API calls                                                                                        |
| `REVIUAH_PROVIDER`           | Preset: `agentrouter`, `openai`, `gemini`, `deepseek`, `ollama`, etc. Default: `agentrouter`                      |
| `REVIUAH_PROVIDER_URL`       | Override API base URL                                                                                             |
| `REVIUAH_MODEL`              | Override model name                                                                                               |
| `REVIUAH_MAX_DIFF_SIZE`      | Max characters of diff sent to the API (default 120000). Lower = fewer tokens / cheaper.                          |
| `REVIUAH_REQUEST_TIMEOUT_MS` | Timeout for LLM API requests in milliseconds (default 60000).                                                     |
| `REVIUAH_ENABLE_SUMMARY`     | Set to `0` / `false` to disable summary markdown generation (same effect as `--no-summary`). Default enabled.     |
| `REVIUAH_COMPACT`            | Set to `1` or `true` for minimal review output. Same as `--compact`. It also uses a smaller git diff context to reduce input tokens. |
| `REVIUAH_MAX_OUTPUT_TOKENS`  | Cap completion length (e.g. `2000`). Reduces output tokens; may truncate long reviews.                            |
| `REVIUAH_CUSTOM_PROMPT`      | Custom instructions for the reviewer (e.g. focus on security, follow our style guide). Same effect as `--prompt`. |

**Reducing token usage:** Use `--compact` or `REVIUAH_COMPACT=1` for shorter reviews and smaller diff context. Lower `REVIUAH_MAX_DIFF_SIZE` (e.g. `60000`) to send less diff. ReviuAh also filters token-heavy files such as lockfiles, build outputs, minified assets, and common binaries before sending the diff, and when truncation is still needed it trims at file boundaries instead of hard-cutting raw text. Set `REVIUAH_MAX_OUTPUT_TOKENS` (e.g. `1500`) to cap response length.

**Prompt file:** If neither `--prompt` nor `REVIUAH_CUSTOM_PROMPT` is set, ReviuAh looks for `reviuah-prompt.md` in the **git repo root** and uses its contents as the custom prompt. Use this to share review instructions with your team (commit the file).

Env overrides saved config (useful for CI).

---

## CI — Auto Review & Comment on PR / MR

ReviuAh can automatically review every pull request (GitHub) or merge request (GitLab), then **post the review as a comment** on the PR/MR. When the PR is updated, the comment is updated (not duplicated).

### GitHub Actions

1. Add secret `REVIUAH_API_KEY` in repo Settings → Secrets.
2. (Optional) Add variable `REVIUAH_ENABLE_SUMMARY=0` if you want inline/per-file review only (skip summary comment).
3. Copy `.github/workflows/code-review.yml` (included in this repo) into your repo — it installs ReviuAh from npm and runs it (no build from source; works in any repo). Or use the snippet below.
4. Every PR will get a comment with the AI review.

```yaml
name: AI Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # needed to post comments
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history for diff
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm install -g reviuah@latest
      - run: reviuah --range origin/${{ github.base_ref }}...HEAD --per-file --out review.json --out review.md
        env:
          REVIUAH_API_KEY: ${{ secrets.REVIUAH_API_KEY }}
      - name: Comment on PR
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync('review.md', 'utf8').trim();
            if (!body) return;
            const marker = '<!-- reviuah-review -->';
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const existing = comments.find(c => c.body?.includes(marker));
            const content = `${marker}\n# 🔍 ReviuAh — AI Code Review\n\n${body}`;
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body: content,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body: content,
              });
            }
```

### GitLab CI

1. Add CI/CD variables: `REVIUAH_API_KEY` and `GITLAB_TOKEN` (personal or project token with **api** scope).
2. (Optional) Add `REVIUAH_ENABLE_SUMMARY=0` to skip summary note and run per-file only.
3. Copy `.gitlab-ci-review.yml` to your repo as `.gitlab-ci.yml` (or `include` it). It installs ReviuAh from npm (works in any repo).
4. Every MR will get a note with the AI review.

**CLI works but CI doesn’t?** Check token permissions: [CI setup guide — GitLab token permissions](docs/ci-setup-guide.md#gitlab-token-permissions-and-why-ci-might-fail-cli-works-ci-doesnt) (e.g. **Protected** variables, **GITLAB_TOKEN** must be set with `api` scope).

**CLI works but CI doesn’t?** Check token permissions: [CI setup guide — GitLab token permissions](docs/ci-setup-guide.md#gitlab-token-permissions-and-why-ci-might-fail-cli-works-ci-doesnt) (e.g. **Protected** variables, **GITLAB_TOKEN** must be set with `api` scope).

```yaml
code-review:
  stage: review
  image: node:22
  only:
    - merge_requests
  variables:
    GIT_DEPTH: 0
  script:
    - npm install -g reviuah@latest
    - reviuah --range origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME...HEAD --out review.md || true
    - |
      # Post/update comment on MR via GitLab API
      API_URL="$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
      TOKEN="${GITLAB_TOKEN:-$CI_JOB_TOKEN}"
      BODY="<!-- reviuah-review -->\n# 🔍 ReviuAh — AI Code Review\n\n$(cat review.md)"
      curl -sf --request POST --header "PRIVATE-TOKEN: $TOKEN" \
        --data-urlencode "body=$BODY" "$API_URL" > /dev/null
```

> **Tip:** Add `--strict` to fail the workflow when risk level is high (block merge).

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, guidelines, and how to submit a PR.

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

Then run `reviuah` from any repo. See [CONTRIBUTING.md](./CONTRIBUTING.md) for full development workflow.

Publish: set `NPM_TOKEN` in repo Secrets and merge to `main`, or run the **Publish to npm** workflow manually (Actions tab).

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
- [docs/commands-and-env-guide.md](./docs/commands-and-env-guide.md) — Full guide: all CLI commands and environment variables
- [docs/usage-guide.md](./docs/usage-guide.md) — Short usage guide
- [docs/ci-setup-guide.md](./docs/ci-setup-guide.md) — CI setup for GitHub / GitLab
