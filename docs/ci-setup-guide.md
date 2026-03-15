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

Optional variable (Actions → **Variables**) for per-repo behavior:
- `REVIUAH_ENABLE_SUMMARY` = `0` to disable summary comment generation (per-file review still runs)

> `GITHUB_TOKEN` is already available; no need to add it manually.

**Comment author:** With `GITHUB_TOKEN`, comments and reviews appear as **"github-actions bot"**. GitHub does not allow renaming this. To show a different author (e.g. your username or "ReviuAh"), use a [Personal Access Token (PAT)](https://github.com/settings/tokens) with `repo` scope: add it as a secret (e.g. `GH_PAT`) and in the workflow use `github-token: ${{ secrets.GH_PAT }}` instead of `secrets.GITHUB_TOKEN` in the steps that post comments. The comment will then appear as the user who created the PAT.

### Step 2 — Create Workflow File

The workflow installs ReviuAh from npm (`npm install -g reviuah@latest`) and runs the `reviuah` command — **no build from source**, so it works when copied to any repo. For the full workflow (summary + per-file review + comment posting), copy [`.github/workflows/code-review.yml`](https://github.com/rsuregar/reviewah/blob/main/.github/workflows/code-review.yml) from the ReviuAh repo.

Minimal example (summary only):

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
          node-version: "22"

      - run: npm install -g reviuah@latest

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
| `REVIUAH_ENABLE_SUMMARY` | *(optional)* `0` to skip summary note (per-file only) | — | — |

> **GITLAB_TOKEN** is required to post comments on MRs. Create it under **User Settings → Access Tokens** (personal) or **Project → Settings → Access Tokens** (project).  
> Required scope: `api`.

#### GitLab: Token permissions and why CI might fail (CLI works, CI doesn’t)

ReviuAh uses **two different tokens** in CI. If it works locally but not in CI, check the following.

**1. REVIUAH_API_KEY (LLM API)**

| Check | What to do |
|-------|------------|
| **Variable exists** | Settings → CI/CD → Variables. Key must be exactly `REVIUAH_API_KEY`. |
| **Protected** | If the variable is **Protected**, it is only available on **protected branches**. Merge request pipelines often run in the context of the **source branch** (e.g. your feature branch). If that branch is **not** protected, the variable is **not** exposed and ReviuAh will not see the key. **Fix:** Either uncheck **Protected** for `REVIUAH_API_KEY`, or ensure the branch you use for MRs is protected. |
| **Masked** | If your API key contains characters GitLab cannot mask (e.g. some symbols), the variable may not work when masked. **Fix:** Try creating the variable with **Masked** unchecked to test. Re-mask after confirming it works. |
| **Value** | Copy the key again from your provider (Gemini, OpenAI, etc.). No extra spaces; use “Reveal” in GitLab to confirm. |
| **Logs** | In the job log, look for ReviuAh errors: `401` = bad key; `429` = rate limit; `Cannot read properties of undefined` = API returned an error body (check key and provider). |

**2. GITLAB_TOKEN (post comments on the MR)**

| Check | What to do |
|-------|------------|
| **Variable set** | The job uses `GITLAB_TOKEN` if set, otherwise `CI_JOB_TOKEN`. **CI_JOB_TOKEN** in merge request pipelines often **cannot** create or update MR notes (comments). You must set **GITLAB_TOKEN** explicitly. |
| **Token type** | Use a **Personal Access Token** (User → Settings → Access Tokens) or **Project Access Token** (Project → Settings → Access Tokens). Required scope: **`api`** (full API access). |
| **Protected** | Same as above: if the variable is Protected and your MR branch is not protected, the token is not available and the script will fall back to `CI_JOB_TOKEN`, which may get 401/403 when posting the comment. **Fix:** Uncheck **Protected** for `GITLAB_TOKEN` or use a protected branch. |
| **403 when posting** | GitLab returns 403 if the token lacks permission. Ensure the token has **api** scope and is not expired. Create a new token if in doubt. |

**3. Quick check in the job**

Add this once at the start of your `script` to confirm variables are present (values are not printed):

```yaml
- |
  echo "REVIUAH_API_KEY is set: $([ -n \"$REVIUAH_API_KEY\" ] && echo yes || echo no)"
  echo "GITLAB_TOKEN is set: $([ -n \"$GITLAB_TOKEN\" ] && echo yes || echo no)"
```

If either prints `no`, fix the variable (name, Protected, or scope) as above.

**4. Summary**

- **ReviuAh runs but no comment on MR** → Usually **GITLAB_TOKEN** missing or wrong scope or Protected + unprotected branch.  
- **ReviuAh fails in CI (401 / rate limit / error)** → Usually **REVIUAH_API_KEY** missing (e.g. Protected), wrong value, or provider issue.  
- **Both tokens** → If using **Protected**, ensure your MR source branch is protected, or uncheck Protected for these variables.

### Step 2 — Create or Update `.gitlab-ci.yml`

The workflow installs ReviuAh from npm (`npm install -g reviuah@latest`) and runs `reviuah` — **no build from source**, so it works in any repo. For the full template (summary + per-file + MR notes), copy [`.gitlab-ci-review.yml`](https://github.com/rsuregar/reviewah/blob/main/.gitlab-ci-review.yml) from the ReviuAh repo as `.gitlab-ci.yml`.

Minimal example:

```yaml
stages:
  - review

code-review:
  stage: review
  image: node:22
  only:
    - merge_requests
  variables:
    GIT_DEPTH: 0
  script:
    - npm install -g reviuah@latest

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
- Tambah variable: `REVIUAH_PROVIDER`, `REVIUAH_MODEL`, `REVIUAH_ENABLE_SUMMARY` (optional).  
- Workflow `code-review.yml` baca `vars.REVIUAH_PROVIDER`, `vars.REVIUAH_MODEL`, dan `vars.REVIUAH_ENABLE_SUMMARY`; jika `REVIUAH_ENABLE_SUMMARY=0`, summary step + summary comment akan dilewati.

**GitLab CI**  
- Buka repo → **Settings** → **CI/CD** → **Variables**.  
- Tambah variable: `REVIUAH_PROVIDER`, `REVIUAH_MODEL`, `REVIUAH_ENABLE_SUMMARY` (optional).  
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

# Repo D: per-file only (skip summary comment)
REVIUAH_ENABLE_SUMMARY: "0"
```

### Limit Diff Size

For large repos, limit the diff sent to the LLM:

```yaml
REVIUAH_MAX_DIFF_SIZE: 60000   # characters (default 120000)
```

ReviuAh also reduces token usage before sending the diff:
- filters token-heavy files such as lockfiles, build artifacts, minified assets, and common binary files
- preserves whole file sections when truncating, instead of hard-cutting raw diff text
- uses smaller diff context in compact mode to reduce prompt size further

### Enable/Disable Summary

Use `REVIUAH_ENABLE_SUMMARY` to control summary generation in CI workflows:

```yaml
# default (or unset): summary enabled
REVIUAH_ENABLE_SUMMARY: "1"

# disable summary (run per-file only)
REVIUAH_ENABLE_SUMMARY: "0"
```

When disabled:
- GitHub workflow skips the "Run overall review" and "Post summary comment" steps.
- GitLab workflow skips summary review and MR summary note posting.

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
| **GitLab: CLI works, CI doesn’t** | See [GitLab: Token permissions and why CI might fail](#gitlab-token-permissions-and-why-ci-might-fail-cli-works-ci-doesnt) above. Most often: **Protected** variables not available on MR branch, or **GITLAB_TOKEN** not set (CI_JOB_TOKEN cannot post notes). |
| Comment does not appear (GitLab) | Set **GITLAB_TOKEN** (Personal/Project token with `api` scope). Uncheck **Protected** if the MR branch is not protected. Check job log for "GITLAB_TOKEN is set: no". |
| Comment does not appear (GitHub) | Check that secret **REVIUAH_API_KEY** is set. Check workflow/pipeline logs. |
| 401 from LLM | API key wrong or expired. In GitLab, if **REVIUAH_API_KEY** is Protected and the MR branch is not protected, the variable is not exposed — uncheck Protected or use a protected branch. |
| 403 when posting comment (GitHub) | Ensure `permissions: pull-requests: write` is in the workflow. |
| 403 when posting comment (GitLab) | **GITLAB_TOKEN** must be a Personal or Project token with **api** scope. CI_JOB_TOKEN is not enough. Create a new token if needed. |
| Diff too large | Lower `REVIUAH_MAX_DIFF_SIZE` (e.g. 40000). |
| Empty review | Ensure `fetch-depth: 0` (GitHub) or `GIT_DEPTH: 0` (GitLab). |
| review.md is 0 bytes / empty | The LLM returned no content. ReviuAh will not write the file and will print a warning. Check provider, model, and rate limits; try again. In CI, the comment step will be skipped. |

---

## Summary

| Platform | File to create | Secrets required |
|----------|----------------|------------------|
| GitHub | `.github/workflows/code-review.yml` | `REVIUAH_API_KEY` |
| GitLab | `.gitlab-ci.yml` (or include) | `REVIUAH_API_KEY`, `GITLAB_TOKEN` |
