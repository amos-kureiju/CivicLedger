# CivicLedger Mobile (Beneficiary & Local Merchant App)

Aplikasi HP berbasis **React Native + Expo (TypeScript)** yang menyatukan dua pengguna lapangan dalam satu aplikasi komunitas (berlaku untuk komunitas/desa mana pun di Indonesia, dengan data contoh simulasi):
- **Warga Penerima Bansos** -> Cek kupon sembako, perbesar QR layar penuh, kirim WA/SMS, lihat lokasi kedai mitra + Google Maps, dan cek riwayat bantuan.
- **Pemilik Kedai Sembako** -> Terima & cek keaslian kupon warga secara **offline (HMAC-SHA256)**, cegah kupon palsu/ganda, simpan catatan saat sinyal hilang, lalu kirim ke pusat saat sinyal normal.

Sementara **Pengurus Bansos / Koordinator Komunitas** menggunakan **portal web CivicLedger** di komputer/laptop untuk mendata warga, menerbitkan kupon, memantau rekonsiliasi, mencairkan saldo kedai, dan mengunduh laporan audit.

## Akun Contoh (Data Simulasi)

| Peran | Nomor HP / Email | Kata Sandi |
| --- | --- | --- |
| **Warga Penerima** (Op. Rina Br. Napitupulu) | `0812-6311-4401` / `warga@civicledger.id` | `warga2026` |
| **Warga Penerima** (Maruli Siahaan) | `0852-7019-2812` / `maruli@civicledger.id` | `warga2026` |
| **Pemilik Kedai** (Marta Br. Sihombing · WRG-01) | `0812-6300-4821` / `kedai@civicledger.id` | `kedai2026` |
| **Pemilik Kedai** (Binsar Hutabarat · WRG-02) | `0813-6200-9012` / `binsar@civicledger.id` | `kedai2026` |

## Cara Menjalankan

Dari folder root proyek (`C:\PA2\CivicLedger`):
- **Di HP (Expo Go lewat tunnel ngrok):**
  ```powershell
  npm run mobile:tunnel
  ```
- **Di Browser Laptop (tampilan layar HP):**
  ```powershell
  npm run mobile:web
  ```
  Lalu buka `http://localhost:8085`.
