# ReviuAh

> AI-powered CLI to review Git diffs before commit or push.\
> Install via **npm**, **yarn**, or **pnpm**; use on your branch with `--base` or `reviewah`.

---

## Install

### Kalau `npm install -g reviuah` error 404

Paket ini **belum dipublish** ke [npm](https://www.npmjs.com/package/reviuah) (atau namanya belum kamu ambil). Pakai salah satu di bawah.

**Dari GitHub (global, build otomatis saat install):**

```bash
npm install -g git+https://github.com/rsuregar/reviewah.git
```

**Lokal (clone):**

```bash
git clone https://github.com/rsuregar/reviewah.git && cd reviewah
npm install
npm run build
npm link
```

### Setelah publish ke npm

```bash
npm install -g reviuah
# atau: yarn global add reviuah / pnpm add -g reviuah
```

Publish: login `npm login`, lalu di repo `npm publish --access public` (butuh akun npm & nama `reviuah` belum dipakai orang lain).

**Perintah:** `reviuah` atau **`reviewah`** (alias sama).

**Setup API key (disarankan):**

```bash
reviuah setup
```

Menyimpan key ke **`~/.reviuah/config.json`** (hanya di mesin kamu). Setelah itu cukup jalankan `reviuah` tanpa export env.

**Atau** set env (mengoverride file): `REVIUAH_API_KEY`, opsional `REVIUAH_PROVIDER`, `REVIUAH_MODEL`, `REVIUAH_PROVIDER_URL`.

```bash
reviuah config   # cek lokasi file & apakah key sudah tersimpan
```

---

## Inspirasi: [Commitah](https://github.com/utsmannn/commitah) vs ReviuAh

[Commitah](https://github.com/utsmannn/commitah) pakai satu perintah CLI (`commitah`): analisis **perubahan yang sudah di-stage** → AI menghasilkan **pesan commit** (conventional commits, UI interaktif).

**ReviuAh** memakai pola yang sama untuk input default:

| | Commitah | ReviuAh |
|---|----------|---------|
| Perintah | `commitah` | `reviuah` (tanpa opsi) |
| Sumber diff | Staged (`git add` dulu) | Sama |
| Output | Saran commit message | **Review** (summary, risiko, security, testing, …) |

Jadi: **Commitah** = “tulis commit message dari diff”; **ReviuAh** = “tinjau diff sebelum commit/push”. Keduanya bisa dipakai berurutan, misalnya `reviuah` dulu (cek kualitas), lalu `commitah` (pesan commit). Detail singkat: [docs/inspirasi-commitah.md](./docs/inspirasi-commitah.md).

---

## Cara pakai (alur branch)

Typical flow: kamu sedang di **branch fitur**, ingin review selisih terhadap `main`:

```bash
git checkout feature/kerjaan-kamu
export REVIUAH_API_KEY="sk-..."   # atau key provider lain

# Review branch ini vs main (setara git diff main...HEAD)
reviuah --base main

# Kalau remote default beda nama branch
reviuah --base origin/main

# Simpan ke file (buka di editor / share ke PR)
reviuah --base main --out review.md --lang id
```

| Skenario | Perintah |
|----------|----------|
| Hanya perubahan yang sudah **di-stage** | `reviuah` |
| Satu **commit** | `reviuah --commit HEAD` |
| Range manual | `reviuah --range main...HEAD` |
| **Branch aktif** vs base | `reviuah --base main` |
| CI: gagal jika risk **high** | `reviuah --base origin/main --strict` |

**Tip:** di shell bisa alias supaya “satu klik” dari terminal:

```bash
alias reviewah='reviuah --base main --lang id'
# lalu: reviewah
```

---

## CLI (English)

```bash
reviuah --help
reviuah --version

reviuah                          # staged diff
reviuah --commit HEAD
reviuah --range origin/main...HEAD
reviuah --base main              # branch vs main
reviuah --out review.md
reviuah --strict
reviuah --lang en
```

---

## Required review output (Markdown)

1. Summary  
2. Risk Level (low / medium / high / unknown) + reason  
3. Security Review  
4. Performance Review  
5. Testing Suggestions  
6. Code Quality & Maintainability  
7. Actionable Suggestions  

---

## Architecture (current)

```
src/
  cli.ts
  commands/review.ts
  git/diff.ts
  providers/
    index.ts
    openai.ts
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `REVIUAH_API_KEY` | Required for API calls |
| `REVIUAH_PROVIDER` | Default preset: **`agentrouter`** → `https://agentrouter.org/v1`. Lainnya: `openai`, `gemini`, `deepseek`, `ollama`, … |
| `REVIUAH_PROVIDER_URL` | Override base URL |
| `REVIUAH_MODEL` | Override model (default untuk agentrouter: `gpt-4o`; sesuaikan di dashboard AgentRouter) |

---

## CI (GitHub Actions)

**Why `fetch-depth: 0`:** ReviuAh needs the base branch (e.g. `origin/main`) to compute `git diff base...HEAD`. The default shallow clone only fetches the single commit; `fetch-depth: 0` fetches full history so the diff works correctly.

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

Untuk `pull_request`, checkout default adalah merge commit; untuk diff seperti di lokal, fetch branch dan gunakan `--base origin/main` atau `--range origin/main...HEAD` setelah checkout ke **head** PR (lihat [docs/cara-pakai.md](./docs/cara-pakai.md)).

---

## For AI assistants

- [AGENTS.md](./AGENTS.md) · [CLAUDE.md](./CLAUDE.md) · `.cursor/skills/`

## Development

```bash
yarn install
yarn build
yarn link          # lokal: perintah reviuah / reviewah dari repo ini
reviuah --help
```

**Publish manual:** `npm publish --access public` (setelah `yarn build` dan login npm).

**Publish lewat GitHub Actions (saat merge ke main):** Workflow **Publish to npm** otomatis jalan setiap **push ke branch `main`** (termasuk setelah merge PR): build → bump **patch** → publish ke npm → push commit + tag ke repo. Pastikan secret **`NPM_TOKEN`** (token npm dengan izin publish / bypass 2FA) sudah ditambah di repo → Settings → Secrets → Actions. Commit hasil bump pakai pesan `chore: release X.Y.Z [skip ci]` agar workflow tidak jalan lagi (hindari loop).

---

## Design philosophy

ReviuAh is a **pre-review** assistant and CI gate (`--strict`), not a replacement for human review.

Lihat juga **[docs/cara-pakai.md](./docs/cara-pakai.md)** (ringkas, Indonesia).
