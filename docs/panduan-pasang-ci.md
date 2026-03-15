# Panduan Memasang ReviuAh di Repo Lain

ReviuAh bisa dipasang di repo mana saja (GitHub atau GitLab) agar **otomatis review dan komentar** di setiap Pull Request / Merge Request.

---

## Persiapan (Semua Platform)

1. **Dapatkan API key** dari provider LLM yang kamu pakai.
   - Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Provider lain: lihat dokumentasi masing-masing.

2. **Simpan API key sebagai secret/variable** di platform CI (langkah di bawah).

---

## GitHub Actions

### Langkah 1 — Tambah Secret

1. Buka repo di GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Klik **New repository secret**.
3. Isi:
   - Name: `REVIUAH_API_KEY`
   - Value: API key kamu
4. Klik **Add secret**.

> `GITHUB_TOKEN` sudah otomatis tersedia, tidak perlu ditambah manual.

### Langkah 2 — Buat File Workflow

Buat file `.github/workflows/code-review.yml` di repo kamu dengan isi:

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
          # Ganti provider URL sesuai kebutuhan (contoh: Gemini native)
          # REVIUAH_PROVIDER_URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent
          # Batas ukuran diff (opsional, default 120000)
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

### Langkah 3 — Commit & Push

```bash
git add .github/workflows/code-review.yml
git commit -m "ci: add ReviuAh auto review on PR"
git push
```

### Langkah 4 — Buat PR untuk Tes

Buat branch baru, ubah file apa saja, buat Pull Request. Dalam beberapa menit, komentar review akan muncul di PR.

---

## GitLab CI/CD

### Langkah 1 — Tambah CI/CD Variables

1. Buka repo di GitLab → **Settings** → **CI/CD** → **Variables**.
2. Tambah variable:

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `REVIUAH_API_KEY` | API key kamu | ✅ | ✅ |
| `GITLAB_TOKEN` | Personal/project token dengan scope `api` | ✅ | ✅ |

> **GITLAB_TOKEN** diperlukan untuk post komentar di MR. Buat di **User Settings → Access Tokens** (personal) atau **Project → Settings → Access Tokens** (project).  
> Scope yang diperlukan: `api`.

### Langkah 2 — Buat/Update `.gitlab-ci.yml`

Tambahkan ke `.gitlab-ci.yml` di repo kamu (atau buat baru):

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

### Langkah 3 — Commit & Push

```bash
git add .gitlab-ci.yml
git commit -m "ci: add ReviuAh auto review on MR"
git push
```

### Langkah 4 — Buat MR untuk Tes

Buat branch baru, ubah file, buat Merge Request. Komentar review akan muncul di MR.

---

## Konfigurasi Opsional

### Ganti Provider

Default: `agentrouter`. Ganti dengan menambah env variable:

```yaml
# Contoh: pakai Gemini native (hemat token)
REVIUAH_PROVIDER_URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent

# Contoh: pakai OpenAI
REVIUAH_PROVIDER: openai
REVIUAH_MODEL: gpt-4o
```

### Batasi Ukuran Diff

Untuk repo besar, batasi diff yang dikirim ke LLM:

```yaml
REVIUAH_MAX_DIFF_SIZE: 60000   # karakter (default 120000)
```

### Bahasa Output

```yaml
# Review dalam Bahasa Indonesia
reviuah --range ... --out review.md --lang id

# Review dalam Bahasa Inggris (default)
reviuah --range ... --out review.md --lang en
```

### Gagalkan PR/MR jika High Risk

Tambah `--strict` — workflow akan exit code 1 jika risk level = high:

```yaml
reviuah --range ... --out review.md --strict
```

Di GitHub, PR check akan jadi ❌ (gagal). Di GitLab, pipeline akan merah.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Komentar tidak muncul | Cek secret `REVIUAH_API_KEY` sudah diisi. Cek log workflow/pipeline. |
| Error 401 dari LLM | API key salah atau expired. Generate ulang. |
| Error 403 post komentar (GitHub) | Pastikan `permissions: pull-requests: write` ada di workflow. |
| Error 403 post komentar (GitLab) | `GITLAB_TOKEN` butuh scope `api`. Atau buat project token baru. |
| Diff terlalu besar | Turunkan `REVIUAH_MAX_DIFF_SIZE` (misal 40000). |
| Review kosong | Pastikan `fetch-depth: 0` (GitHub) atau `GIT_DEPTH: 0` (GitLab). |

---

## Ringkasan

| Platform | File yang dibuat | Secrets yang diperlukan |
|----------|-----------------|------------------------|
| GitHub | `.github/workflows/code-review.yml` | `REVIUAH_API_KEY` |
| GitLab | `.gitlab-ci.yml` (atau include) | `REVIUAH_API_KEY`, `GITLAB_TOKEN` |
