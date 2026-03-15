# ReviuAh CI Setup — Install in Your Repo

ReviuAh can be added to any repository (GitHub or GitLab) to **automatically review and comment** on every Pull Request or Merge Request.

**Two review modes:**
- **Summary** — a single overall summary comment on the PR/MR.
- **Per-file** (`--per-file`) — inline comments on specific lines of code, like a human reviewer.

---

## Prerequisites (All Platforms)

1. **Get an API key** from your LLM provider.
   - Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Other providers: see their documentation.

2. **Store the API key as a secret/variable** in your CI platform (steps below).

---

## GitHub Actions

### Step 1 — Add Secret

1. Open your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret**.
3. Fill in:
   - Name: `REVIUAH_API_KEY`
   - Value: your API key
4. Click **Add secret**.

> `GITHUB_TOKEN` is already available; no need to add it manually.

**Comment author:** With `GITHUB_TOKEN`, comments and reviews appear as **"github-actions bot"**. GitHub does not allow renaming this. To show a different author (e.g. your username or "ReviuAh"), use a [Personal Access Token (PAT)](https://github.com/settings/tokens) with `repo` scope: add it as a secret (e.g. `GH_PAT`) and in the workflow use `github-token: ${{ secrets.GH_PAT }}` instead of `secrets.GITHUB_TOKEN` in the steps that post comments. The comment will then appear as the user who created the PAT.

### Step 2 — Create Workflow File

Create `.github/workflows/code-review.yml` in your repo with:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm install -g reviuah

      - name: Run review
        run: reviuah --range origin/${{ github.base_ref }}...HEAD --out review.md --lang en
        env:
          REVIUAH_API_KEY: ${{ secrets.REVIUAH_API_KEY }}
          # Change provider as needed (e.g. Gemini)
          # REVIUAH_PROVIDER: gemini
          # Diff size limit (optional, default 120000)
          # REVIUAH_MAX_DIFF_SIZE: 60000

      - name: Post review comment
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync('review.md', 'utf8').trim();
            if (!body) return;

            const marker = '<!-- reviuah-review -->';
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const existing = comments.find(c => c.body?.includes(marker));
            const content = `${marker}\n# 🔍 ReviuAh — AI Code Review\n\n${body}`;

            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body: content,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: content,
              });
            }
```

### Step 3 — Commit & Push

```bash
git add .github/workflows/code-review.yml
git commit -m "ci: add ReviuAh auto review on PR"
git push
```

### Step 4 — Test with a PR

Create a new branch, change any file, and open a Pull Request. Within a few minutes, the review comment will appear on the PR.

---

## GitLab CI/CD

### Step 1 — Add CI/CD Variables

1. Open your repo on GitLab → **Settings** → **CI/CD** → **Variables**.
2. Add variables:

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `REVIUAH_API_KEY` | Your API key | ✅ | ✅ |
| `GITLAB_TOKEN` | Personal or project token with `api` scope | ✅ | ✅ |
| `REVIUAH_PROVIDER` | *(optional)* e.g. `gemini`, `openai`, `agentrouter` | — | — |
| `REVIUAH_MODEL` | *(optional)* e.g. `gpt-4o`, `gemini-2.0` | — | — |

> **GITLAB_TOKEN** is required to post comments on MRs. Create it under **User Settings → Access Tokens** (personal) or **Project → Settings → Access Tokens** (project).  
> Required scope: `api`.

### Step 2 — Create or Update `.gitlab-ci.yml`

Add to `.gitlab-ci.yml` in your repo (or create a new file):

```yaml
stages:
  - review

code-review:
  stage: review
  image: node:20
  only:
    - merge_requests
  variables:
    GIT_DEPTH: 0
  script:
    - npm install -g reviuah

    - >
      reviuah
      --range origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME...HEAD
      --out review.md
      --lang en
      || true

    - |
      if [ ! -s review.md ]; then
        echo "No review output."
        exit 0
      fi

      API_URL="$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
      TOKEN="${GITLAB_TOKEN:-$CI_JOB_TOKEN}"
      MARKER="<!-- reviuah-review -->"

      EXISTING_ID=$(curl -sf --header "PRIVATE-TOKEN: $TOKEN" "$API_URL?per_page=100" \
        | python3 -c "
      import json, sys
      notes = json.load(sys.stdin)
      for n in notes:
          if '$MARKER' in n.get('body',''):
              print(n['id'])
              break
      " 2>/dev/null || true)

      REVIEW_BODY=$(cat review.md)
      COMMENT_BODY="$MARKER
      # 🔍 ReviuAh — AI Code Review

      $REVIEW_BODY"

      if [ -n "$EXISTING_ID" ]; then
        curl -sf --request PUT --header "PRIVATE-TOKEN: $TOKEN" \
          --data-urlencode "body=$COMMENT_BODY" \
          "$API_URL/$EXISTING_ID" > /dev/null
        echo "Updated review comment."
      else
        curl -sf --request POST --header "PRIVATE-TOKEN: $TOKEN" \
          --data-urlencode "body=$COMMENT_BODY" \
          "$API_URL" > /dev/null
        echo "Posted review comment."
      fi
```

### Step 3 — Commit & Push

```bash
git add .gitlab-ci.yml
git commit -m "ci: add ReviuAh auto review on MR"
git push
```

### Step 4 — Test with an MR

Create a new branch, make changes, and open a Merge Request. The review comment will appear on the MR.

---

## Optional Configuration

### Different provider/model per repo

Setiap repo bisa memakai **provider dan model berbeda** lewat variable (tanpa ubah kode workflow).

**GitHub Actions**  
- Buka repo → **Settings** → **Secrets and variables** → **Actions** → tab **Variables**.  
- Tambah variable: `REVIUAH_PROVIDER`, `REVIUAH_MODEL`.  
- Workflow `code-review.yml` sudah baca `vars.REVIUAH_PROVIDER` dan `vars.REVIUAH_MODEL`; kalau tidak di-set, provider default = `gemini`.

**GitLab CI**  
- Buka repo → **Settings** → **CI/CD** → **Variables**.  
- Tambah variable: `REVIUAH_PROVIDER`, `REVIUAH_MODEL`.  
- Variable CI/CD otomatis tersedia di job; ReviuAh baca dari environment.

**Contoh:**

```yaml
# Repo A: pakai Gemini
REVIUAH_PROVIDER: gemini
REVIUAH_MODEL: gemini-2.0

# Repo B: pakai OpenAI
REVIUAH_PROVIDER: openai
REVIUAH_MODEL: gpt-4o

# Repo C: pakai AgentRouter (default), tidak perlu set variable
```

### Limit Diff Size

For large repos, limit the diff sent to the LLM:

```yaml
REVIUAH_MAX_DIFF_SIZE: 60000   # characters (default 120000)
```

### Output Language

```yaml
# Review in Indonesian
reviuah --range ... --out review.md --lang id

# Review in English (default)
reviuah --range ... --out review.md --lang en
```

### Fail PR/MR on High Risk

Add `--strict` — the workflow will exit with code 1 when risk level is high:

```yaml
reviuah --range ... --out review.md --strict
```

On GitHub, the PR check will fail (❌). On GitLab, the pipeline will fail.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Comment does not appear | Check that secret `REVIUAH_API_KEY` is set. Check workflow/pipeline logs. |
| 401 from LLM | API key is wrong or expired. Generate a new one. |
| 403 when posting comment (GitHub) | Ensure `permissions: pull-requests: write` is in the workflow. |
| 403 when posting comment (GitLab) | `GITLAB_TOKEN` needs `api` scope. Or create a new project token. |
| Diff too large | Lower `REVIUAH_MAX_DIFF_SIZE` (e.g. 40000). |
| Empty review | Ensure `fetch-depth: 0` (GitHub) or `GIT_DEPTH: 0` (GitLab). |

---

## Summary

| Platform | File to create | Secrets required |
|----------|----------------|------------------|
| GitHub | `.github/workflows/code-review.yml` | `REVIUAH_API_KEY` |
| GitLab | `.gitlab-ci.yml` (or include) | `REVIUAH_API_KEY`, `GITLAB_TOKEN` |
