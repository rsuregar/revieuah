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

Interactive setup saves config to `~/.reviuah/config.json`. You can also set `REVIUAH_API_KEY` (and optionally `REVIUAH_PROVIDER`, `REVIUAH_MODEL`) in your environment. Check status: `reviuah config`.

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

| Variable | Description |
|----------|-------------|
| `REVIUAH_API_KEY` | **Required** for API calls |
| `REVIUAH_PROVIDER` | Preset: `agentrouter`, `openai`, `gemini`, `deepseek`, `ollama`, etc. Default: `agentrouter` |
| `REVIUAH_PROVIDER_URL` | Override API base URL |
| `REVIUAH_MODEL` | Override model name |
| `REVIUAH_MAX_DIFF_SIZE` | Max characters of diff sent to the API (default 120000). Lower = fewer tokens / cheaper. |

Env overrides saved config (useful for CI).

---

## CI — Auto Review & Comment on PR / MR

ReviuAh can automatically review every pull request (GitHub) or merge request (GitLab), then **post the review as a comment** on the PR/MR. When the PR is updated, the comment is updated (not duplicated).

### GitHub Actions

1. Add secret `REVIUAH_API_KEY` in repo Settings → Secrets.
2. Copy `.github/workflows/code-review.yml` (included in this repo) or use the snippet below.
3. Every PR will get a comment with the AI review.

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
      pull-requests: write          # needed to post comments
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0            # full history for diff
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g reviuah
      - run: reviuah --range origin/${{ github.base_ref }}...HEAD --out review.md
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

1. Add CI/CD variables: `REVIUAH_API_KEY` and `GITLAB_TOKEN` (personal/project token with `api` scope).
2. Copy `.gitlab-ci-review.yml` to your repo as `.gitlab-ci.yml` (or `include` it).
3. Every MR will get a note with the AI review.

```yaml
code-review:
  stage: review
  image: node:20
  only:
    - merge_requests
  variables:
    GIT_DEPTH: 0
  script:
    - npm install -g reviuah
    - reviuah --range origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME...HEAD --out review.md || true
    - |
      # Post/update comment on MR via GitLab API
      API_URL="$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
      TOKEN="${GITLAB_TOKEN:-$CI_JOB_TOKEN}"
      BODY="<!-- reviuah-review -->\n# 🔍 ReviuAh — AI Code Review\n\n$(cat review.md)"
      curl -sf --request POST --header "PRIVATE-TOKEN: $TOKEN" \
        --data-urlencode "body=$BODY" "$API_URL" > /dev/null
```

> **Tip:** Bisa tambahkan `--strict` agar workflow exit 1 jika risk level high (gagalkan merge).

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
- [docs/panduan-pasang-ci.md](./docs/panduan-pasang-ci.md) — panduan lengkap pasang di repo GitHub / GitLab
