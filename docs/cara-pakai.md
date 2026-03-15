# Cara pakai ReviuAh

Pola mirip [Commitah](https://github.com/utsmannn/commitah): default membaca **staged diff**; lihat [inspirasi-commitah.md](./inspirasi-commitah.md).

## Setup API key

```bash
reviuah setup
```

Ikuti prompt (API key disembunyikan dengan `*`). Konfigurasi tersimpan di `~/.reviuah/config.json`. Cek status: `reviuah config`.

Prioritas: **variabel lingkungan** mengoverride isi file (berguna di CI).

## Install

Jika `npm install -g reviuah` **404** → paket belum di npm. Pakai:

```bash
npm install -g git+https://github.com/rsuregar/reviewah.git
```

Setelah terbit di npm: `npm install -g reviuah`. Tanpa global dari npm: `npx reviuah` (hanya jika sudah publish).

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

- **Otomatis:** Setiap **merge ke `main`**, workflow **Publish to npm** jalan: bump patch → publish → push tag. Butuh secret **`NPM_TOKEN`** di repo (Settings → Secrets → Actions).
- **Manual:** Tab Actions → Publish to npm → Run workflow (pilih patch/minor/major), atau lokal: `yarn build && npm publish --access public`.
