# Studi Kasus Pengujian CivicLedger (Wilayah Kab. Toba)

Dokumen ini berisi **7 skenario pengujian** untuk mengetes semua fitur di CivicLedger memakai data 20 warga penerima bansos dan 4 kedai mitra di sekitar Kabupaten Toba (Balige, Laguboti, Porsea, Sigumpar, Silaen, Tampahan, Uluan).

---

## Akun Uji Coba

| Peran | Nama | Email | Nomor HP | Kata Sandi Awal | Akses Menu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pengurus Bansos** | St. Darwin Pasaribu | `pengurus@toba.id` | `0811-6200-0101` | `toba2026` | Semua menu (Pengurus, Kupon, Kasir, Pencairan, Laporan, Cara Pakai) |
| **Pemilik Kedai** | Marta Br. Sihombing | `kedai@toba.id` | `0812-6300-4821` | `kedai2026` | Kasir Kedai, Pencairan & Riwayat, Cara Pakai |
| **Warga Penerima** | Op. Rina Br. Napitupulu | `warga@toba.id` | `0812-6311-4401` | `warga2026` | Kupon Warga, Cara Pakai |

---

## Studi Kasus 1 — Login Pengurus, Cek 20 Penerima & Buat Kupon Baru
**Skenario:** Pengurus bansos di Laguboti ingin mengecek daftar 20 penerima dan membuat kupon sembako baru untuk salah satu warga yang belum dapat kupon.

**Langkah:**
1. Buka `http://localhost:3000`.
2. Masuk memakai `pengurus@toba.id` dan sandi `toba2026`.
3. Di kotak sebelah kanan, klik tab **Daftar Penerima (20)** lalu coba cari nama misalnya `Parlindungan` atau `Sitorus`.
4. Klik **Pilih** di baris `Tumpal Sitorus` (Desa Parparean, Porsea).
5. Di form sebelah kiri, pilih **Paket Beras 5 Kg** (`Rp 72.500`), pilih masa berlaku **3 Hari (72 Jam)**, lalu klik **Buat Kupon Sembako**.

**Hasil yang Diharapkan:**
- Semua 20 nama warga Toba tampil dan bisa dicari.
- Kupon baru untuk `Tumpal Sitorus` muncul di baris atas **Daftar Kupon** dengan status **Siap Pakai**.
- Sisa Dana Bansos berkurang `Rp 72.500` otomatis.

---

## Studi Kasus 2 — Reset Kata Sandi (Lupa Sandi via OTP 6 Angka)
**Skenario:** Op. Rina Br. Napitupulu lupa kata sandi akunnya saat mau membuka kupon di HP.

**Langkah:**
1. Klik **Keluar** di panel kiri.
2. Klik tab **Lupa Sandi** (atau klik **Lupa kata sandi?**).
3. **Tahap 1:** Ketik `warga@toba.id` (atau nomor HP `0812-6311-4401`), lalu klik **Kirim Kode 6 Angka**.
4. Lihat kotak kuning **Kode OTP Simulasi (Demo Lokal)** yang memunculkan 6 angka. Klik **Isi Kode** atau ketik manual.
5. **Tahap 2:** Isi kata sandi baru `balige2026` di kedua kolom sandi, lalu klik **Simpan Kata Sandi Baru**.
6. Coba masuk dengan sandi lama (`warga2026`) → harus gagal.
7. Masuk lagi dengan sandi baru (`balige2026`) → harus berhasil.

**Hasil yang Diharapkan:**
- Sandi lama langsung ditolak.
- Login memakai sandi baru berhasil dan langsung terbuka di halaman **Kupon Warga**.

---

## Studi Kasus 3 — Cek Kupon Warga, Ukuran Huruf Besar & Cetak Kertas
**Skenario:** Op. Rina membuka kuponnya dari HP, memperbesar tulisan supaya mudah dibaca, lalu mencetak salinan kertas.

**Langkah:**
1. Login sebagai `warga@toba.id`.
2. Pastikan menu kiri hanya menampilkan **Kupon Warga** dan **Cara Pakai**.
3. Klik **Huruf: Besar** di panel kiri bawah (atau ikon huruf di kanan atas pada HP).
4. Cek kartu kupon sebelah kanan (`CL-8841-K9` — Paket Beras 5 Kg).
5. Klik **Salin SMS / WA**, lalu klik **Cetak Kertas**.

**Hasil yang Diharapkan:**
- Seluruh tulisan membesar dengan rapi.
- Teks SMS tersalin ke clipboard, dan pratinjau cetak hanya menampilkan kartu kupon tanpa sidebar.

---

## Studi Kasus 4 — Penukaran Kupon Saat Kedai Offline (Sinyal Mati)
**Skenario:** Sinyal di sekitar Balige sedang hilang, tetapi warga datang membawa kupon `CL-8841-K9` ke Kedai Sembako Inang Boru Sihombing.

**Langkah:**
1. Keluar lalu login sebagai **Pemilik Kedai** (`kedai@toba.id` / `kedai2026`).
2. Ubah tombol **Sinyal** di kiri bawah menjadi **Offline**.
3. Pilih kupon `CL-8841-K9 · Siap Pakai` di daftar cepat (atau ketik manual).
4. Klik **Cek & Simpan Offline**.

**Hasil yang Diharapkan:**
- Langsung muncul kotak hijau **Kupon Sah · Simpan Offline** tanpa butuh internet.
- Kotak **Catatan Offline di HP** bertambah 1 antrean.
- Jika `CL-8841-K9` dicoba ditukar lagi saat masih offline, sistem langsung menolaknya.

---

## Studi Kasus 5 — Tes Kupon Palsu (Nominal Diubah)
**Skenario:** Ada yang mencoba memalsukan nominal kupon di QR dari harga asli ke `Rp 500.000`.

**Langkah:**
1. Di halaman **Kasir Kedai**, pilih salah satu kupon yang masih **Siap Pakai** (misalnya `CL-7732-M4`).
2. Klik tombol merah **Tes Kupon Palsu**.

**Hasil yang Diharapkan:**
- Muncul kotak merah **Kupon Ditolak (Palsu)** dengan keterangan nominal diubah ke Rp 500.000.
- Angka **Kupon Ditolak** bertambah 1 dan saldo kedai tidak ikut bertambah.

---

## Studi Kasus 6 — Tes Kupon Ganda Lintas HP & Sinkronisasi ke Pusat
**Skenario:** Kupon yang sudah dipakai dicoba ditukar lagi dari HP offline di kedai lain (Toko Pangan Pak Binsar) sebelum sinyal kembali.

**Langkah:**
1. Di **Kasir Kedai**, klik tombol oranye **Tes Kupon Ganda**.
2. Lihat kotak **Catatan Offline di HP** — muncul entri baru bertanda **TES GANDA**.
3. Klik tombol **Kirim Semua ke Pusat**.

**Hasil yang Diharapkan:**
- Transaksi yang sah masuk ke buku catatan pusat (**Masuk**).
- Klaim ganda dari HP kedua otomatis ditolak (**Ditolak (Ganda)**) dan tercatat di **Riwayat Sinkron Offline**.

---

## Studi Kasus 7 — Pencairan Saldo Kedai, Cek Keaslian Data & Unduh Excel
**Skenario:** Pengurus mencairkan saldo belanja ke kedai mitra, mengecek keaslian catatan, lalu mengunduh file Excel untuk laporan.

**Langkah:**
1. Login kembali sebagai **Pengurus Bansos** (`pengurus@toba.id` / `toba2026`).
2. Buka menu **Pencairan & Riwayat**.
3. Di kartu `Kedai Sembako Inang Boru Sihombing` atau `Toko Pangan Pak Binsar`, klik **Cairkan Saldo** (atau klik **Cairkan Semua**).
4. Di tabel **Riwayat Penukaran Kupon**, klik **Cek Keaslian Data** (dan coba tombol **Kode Hash (Juri)**).
5. Buka menu **Laporan Bansos**, lalu klik **Unduh Excel (CSV)** dan **Unduh JSON**.

**Hasil yang Diharapkan:**
- Saldo **Belum Cair** kedai menjadi `Rp 0` dan bukti baru muncul di **Bukti Pencairan Kedai**.
- Pengecekan menampilkan status hijau: *"Hasil cek aman. Seluruh X transaksi sesuai dan belum pernah diubah."*
- File `.csv` dan `.json` terunduh dengan daftar 20 penerima dan riwayat transaksi Toba.
