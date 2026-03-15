# Inspirasi dari Commitah

[Commitah](https://github.com/utsmannn/commitah) (utsmannn/commitah) adalah CLI yang:

1. Membaca **staged diff** (`git diff --cached`)
2. Mengirim ke berbagai provider AI
3. Menghasilkan **pesan commit** dengan UI interaktif

## ReviuAh mengikuti pola input yang sama

- **Default `reviuah`** juga memakai **hanya perubahan yang sudah di-stage**, sama seperti alur dasar Commitah.
- Bedanya: output ReviuAh adalah **ulasan kode** (Markdown terstruktur + level risiko), bukan generator commit message.

## Kapan pakai apa

| Kebutuhan | Alat |
|-----------|------|
| Pesan commit dari diff | Commitah (`commitah`) |
| Review sebelum commit/PR | ReviuAh (`reviuah` atau `--base main`) |

Keduanya bisa dipasang global (`npm install -g commitah` / `reviuah`) dan memakai API key masing-masing atau provider serupa (OpenAI-compatible).
