# CivicLedger Warga (Aplikasi HP Penerima Bansos Toba)

Aplikasi HP berbasis **React Native + Expo (TypeScript)** yang dirancang khusus untuk **warga penerima bansos** di Kabupaten Toba. Pengurus desa dan pemilik kedai menggunakan portal web utama.

## Fitur Khusus Warga

- **Login Mobile-Native (Khusus Warga):**
  - Header hijau melengkung dengan sapaan hangat, input nomor HP/email yang sederhana, tombol 1 ketuk masuk cepat warga, serta halaman terpisah untuk **Lupa Sandi (OTP 6 angka)** dan **Daftar Warga** (tanpa pilihan role pengurus/kedai).
- **Ramah Orang Tua:**
  - Tombol **Huruf Besar (`A+`)** di bagian atas layar untuk memperbesar tulisan seketika.
  - Pilihan **Layar Siang / Malam** dan 5 menu bawah sederhana (`Beranda`, `Kupon`, `Kedai`, `Riwayat`, `Profil`).
- **Kupon QR Layar Penuh & Bagikan WA/SMS:**
  - Ketuk QR untuk memperbesar ke layar penuh putih cerah agar mudah dipindai di kedai, atau kirim kode pendek ke WhatsApp / SMS keluarga.
  - Tetap bisa dibuka walaupun sinyal HP sedang hilang.
- **Kedai Terdekat + Google Maps:**
  - Daftar 4 kedai mitra di Balige, Laguboti, Sitoluama, dan Porsea lengkap dengan tombol **Buka Lokasi di Google Maps**.

## Akun Contoh Warga

| Nama Warga | Nomor HP / Email | Kata Sandi |
| --- | --- | --- |
| **Op. Rina Br. Napitupulu** (Sitoluama, Laguboti) | `0812-6311-4401` / `warga@toba.id` | `warga2026` |
| **Maruli Siahaan** (Tambunan, Balige) | `0852-7019-2812` / `maruli@toba.id` | `warga2026` |
| **Tiurma Br. Simanjuntak** (Sangkar Nihuta, Balige) | `0813-7540-9103` / `tiurma@toba.id` | `warga2026` |

## Cara Menjalankan

Dari folder root proyek (`C:\PA2\CivicLedger`):
- **Di HP (Expo Go lewat tunnel ngrok, paling aman untuk Hotspot/Wi-Fi Public):**
  ```powershell
  npm run mobile:tunnel
  ```
- **Di Browser Laptop (tampilan layar HP):**
  ```powershell
  npm run mobile:web
  ```
  Lalu buka `http://localhost:8085`.
