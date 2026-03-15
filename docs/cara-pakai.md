# Cara pakai ReviuAh

Pola mirip [Commitah](https://github.com/utsmannn/commitah): default membaca **staged diff**; lihat [inspirasi-commitah.md](./inspirasi-commitah.md).

## Setup API key

```bash
reviuah setup
```

Ikuti prompt (API key disembunyikan dengan `*`). Konfigurasi tersimpan di `~/.reviuah/config.json`. Cek status: `reviuah config`.

Prioritas: **variabel lingkungan** mengoverride isi file (berguna di CI).

## Install

- **npm:** `npm install -g reviuah`
- **yarn:** `yarn global add reviuah`
- **pnpm:** `pnpm add -g reviuah`
- **Tanpa global:** `npx reviuah …`

Perintah **`reviewah`** sama dengan **`reviuah`**.

## Di branch fitur

1. `git checkout <branch-kamu>`
2. Set `REVIUAH_API_KEY` (dan opsional provider/model)
3. Jalankan:

```bash
reviuah --base main --lang id
```

Untuk PR yang track `origin/main`:

```bash
reviuah --base origin/main --out review.md
```

## Mode lain

| Kebutuhan | Contoh |
|-----------|--------|
| Staged saja | `git add . && reviuah` |
| Satu commit | `reviuah --commit abc123` |
| Range | `reviuah --range develop...HEAD` |

## Publish npm (maintainer)

Workflow: GitHub Actions **Publish to npm** (butuh secret `NPM_TOKEN`), atau lokal:

```bash
yarn build
npm publish --access public
```
