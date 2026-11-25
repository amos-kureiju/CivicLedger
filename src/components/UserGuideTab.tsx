"use client";

import React, { useState } from "react";
import { ArrowUpRight, Maximize2, X, CheckCircle2 } from "lucide-react";

export type GuideTargetTab =
  | "COORDINATOR"
  | "BENEFICIARY"
  | "MERCHANT_POS"
  | "CLEARINGHOUSE"
  | "REPORTS";

interface FeatureGuideItem {
  id: string;
  shortLabel: string;
  number: string;
  targetTab: GuideTargetTab;
  title: string;
  role: string;
  summary: string;
  imageSrc: string;
  imageCaption: string;
  steps: Array<{
    title: string;
    detail: string;
  }>;
  proTip: string;
}

const FEATURE_GUIDES: FeatureGuideItem[] = [
  {
    id: "organizer",
    shortLabel: "Koordinator",
    number: "01",
    targetTab: "COORDINATOR",
    title: "Konsol Koordinator — Registrasi & Penerbitan Voucher",
    role: "Koordinator Komunitas (RT/RW)",
    summary:
      "Daftarkan keluarga rentan dan warung mitra terverifikasi, lalu terbitkan voucher pangan terkunci yang ditandatangani secara kriptografis dengan HMAC-SHA256.",
    imageSrc: "/guides/guide-1-organizer.jpg",
    imageCaption:
      "Gambar 1 — Koordinator komunitas menyiapkan alokasi voucher bantuan pangan.",
    steps: [
      {
        title: "Daftarkan Warga & Warung Mitra (Opsional)",
        detail:
          "Klik + Warga atau + Warung di kartu Terbitkan Voucher untuk menambahkan penerima manfaat atau warung kelontong baru ke registri.",
      },
      {
        title: "Pilih Penerima Manfaat & Paket Komoditas",
        detail:
          "Pilih warga pada dropdown Penerima Manfaat dan tentukan paket sembako (misal Paket Beras Lokal 5 Kg) agar bantuan terkunci untuk pangan pokok.",
      },
      {
        title: "Terbitkan & Tandatangani Voucher",
        detail:
          "Pilih masa berlaku (24 jam, 72 jam, atau 7 hari) lalu klik Terbitkan & Tandatangani Voucher. Sistem otomatis membuat nonce sekali pakai dan tanda tangan HMAC-SHA256.",
      },
      {
        title: "Cari, Filter & Lanjutkan Alur Demo",
        detail:
          "Gunakan pencarian dan filter status (Semua / Aktif / Ditukar / Cair) pada Registri Alokasi, lalu klik Kartu atau Tukar pada voucher aktif.",
      },
    ],
    proTip:
      "Penerbitan voucher baru memerlukan mode Online; setelah terbit, penukaran di warung tetap bisa berjalan 100% offline.",
  },
  {
    id: "beneficiary",
    shortLabel: "Kartu Warga",
    number: "02",
    targetTab: "BENEFICIARY",
    title: "Kartu Warga — QR Dinamis & Kode SMS Cadangan",
    role: "Keluarga Penerima Manfaat",
    summary:
      "Akses inklusif dua jalur: kode QR dinamis untuk pengguna smartphone serta kode alfanumerik 6-karakter via SMS atau kupon cetak untuk warga lansia.",
    imageSrc: "/guides/guide-2-beneficiary.jpg",
    imageCaption:
      "Gambar 2 — Kode QR kontras tinggi berdampingan dengan kode kupon cetak/SMS 6-karakter.",
    steps: [
      {
        title: "Pilih Profil Keluarga Penerima",
        detail:
          "Pilih nama warga pada dropdown Keluarga Penerima Manfaat untuk melihat seluruh voucher aktif maupun yang sudah ditukarkan.",
      },
      {
        title: "Tunjukkan Kode QR Dinamis",
        detail:
          "Pengguna smartphone cukup menunjukkan QR hitam-putih berkontras tinggi yang memuat payload JSON bertanda tangan HMAC-SHA256 untuk diverifikasi offline.",
      },
      {
        title: "Salin SMS atau Cetak Kupon Kertas",
        detail:
          "Klik Salin Slip SMS untuk mengirim kode 6-karakter (misal CL-8841-K9) lewat SMS/WhatsApp, atau klik Cetak Slip untuk mencetak kupon kertas.",
      },
      {
        title: "Bawa ke Terminal Warung",
        detail:
          "Klik Buka di Terminal Warung untuk mensimulasikan warga menukarkan voucher tersebut di kasir warung mitra.",
      },
    ],
    proTip:
      "Kotak QR selalu memakai latar putih bersih bahkan saat Mode Gelap aktif agar kamera HP standar tetap fokus dengan cepat.",
  },
  {
    id: "merchant",
    shortLabel: "Terminal Warung",
    number: "03",
    targetTab: "MERCHANT_POS",
    title: "Terminal Warung — Verifikasi Offline & Uji Konflik",
    role: "Pemilik Warung Mitra",
    summary:
      "Verifikasi keaslian voucher dalam hitungan milidetik lewat browser HP biasa tanpa internet menggunakan Web Crypto API dan antrean IndexedDB.",
    imageSrc: "/guides/guide-3-merchant.jpg",
    imageCaption:
      "Gambar 3 — Pemilik warung memindai voucher digital warga langsung dari browser ponsel.",
    steps: [
      {
        title: "Aktifkan Mode Offline (Sidebar Kiri)",
        detail:
          "Ubah Mode Koneksi ke Offline di sidebar kiri bawah untuk mensimulasikan hilangnya sinyal internet di gang padat.",
      },
      {
        title: "Pindai QR, Pilih Cepat, atau Ketik Kode",
        detail:
          "Pilih Warung Aktif, lalu klik Pindai Kamera, pilih voucher di daftar Pilih Cepat Voucher, atau ketik kode 6-karakter secara manual.",
      },
      {
        title: "Verifikasi HMAC-SHA256 & Catat Offline",
        detail:
          "Klik Verifikasi HMAC-SHA256 & Tukar. Lihat panel Verifikator Web Crypto yang membuktikan validasi <5 ms dan transaksi tersimpan di Antrean Offline (IndexedDB).",
      },
      {
        title: "Uji Anti-Fraud & Konflik Lintas Perangkat",
        detail:
          "Klik Uji Manipulasi Payload untuk melihat pemalsuan nominal langsung ditolak offline, atau klik Simulasi Konflik Offline lalu Sinkron & Rekonsiliasi Batch.",
      },
    ],
    proTip:
      "Setiap transaksi offline diberi client_tx_id unik agar server dapat menolak klaim ganda secara otomatis saat beberapa perangkat warung kembali online.",
  },
  {
    id: "clearinghouse",
    shortLabel: "Kliring",
    number: "04",
    targetTab: "CLEARINGHOUSE",
    title: "Kliring & Buku Besar — Rekonsiliasi & Pencairan",
    role: "Bendahara & Auditor Komunitas",
    summary:
      "Tinjau hasil rekonsiliasi konflik di sisi server, verifikasi integritas rantai hash SHA-256, dan cairkan dana ke rekening/QRIS warung mitra.",
    imageSrc: "/guides/guide-4-clearinghouse.jpg",
    imageCaption:
      "Gambar 4 — Audit transaksi buku besar berantai hash dan antrean pencairan warung.",
    steps: [
      {
        title: "Kelola Antrean Pencairan Warung",
        detail:
          "Pantau saldo Menunggu Cair vs. Sudah Cair di tiap warung. Klik Cairkan Warung atau Cairkan Semua untuk membuat struk batch SHA-256 (jalur transfer simulasi).",
      },
      {
        title: "Verifikasi Integritas Rantai Hash SHA-256",
        detail:
          "Klik Verifikasi Integritas Rantai pada header Buku Besar Audit untuk memeriksa keutuhan setiap tautan prev_hash → tx_hash dari blok genesis hingga transaksi terbaru.",
      },
      {
        title: "Periksa Log Rekonsiliasi Offline",
        detail:
          "Buka panel Log Audit Rekonsiliasi untuk melihat seluruh transaksi SYNCED yang sah beserta penolakan DUPLICATE_CONFLICT atau INVALID_SIGNATURE.",
      },
    ],
    proTip:
      "Jalankan backend Golang (go run . atau docker compose up) agar indikator Mesin berubah menjadi Go API · Lokal atau Go API · PostgreSQL.",
  },
  {
    id: "reports",
    shortLabel: "Laporan",
    number: "05",
    targetTab: "REPORTS",
    title: "Laporan, Ekspor Audit & Aksesibilitas Tema",
    role: "Koordinator, Donatur & Juri",
    summary:
      "Pantau kinerja penyaluran bantuan, unduh laporan audit CSV/JSON yang transparan, dan ganti ke Mode Terang berkontras tinggi untuk penggunaan luar ruangan.",
    imageSrc: "/guides/guide-5-reports.jpg",
    imageCaption:
      "Gambar 5 — Ekspor laporan audit transparan dan grafik distribusi bantuan pangan.",
    steps: [
      {
        title: "Tinjau Analitik Penyaluran",
        detail:
          "Pantau Tingkat Penukaran, perbandingan transaksi Offline vs. Online, jumlah Anomali Diblokir, grafik Alokasi Komoditas, dan Omzet Warung.",
      },
      {
        title: "Ekspor Data CSV & Audit JSON",
        detail:
          "Klik Ekspor CSV untuk membuka buku besar di Excel/Google Sheets, atau klik Audit JSON untuk menyimpan arsip audit lengkap termasuk log rekonsiliasi.",
      },
      {
        title: "Ganti Tampilan Gelap / Terang",
        detail:
          "Gunakan sakelar Tampilan (Gelap / Terang) di sidebar kiri atau bar atas ponsel agar layar tetap jelas terbaca oleh pemilik warung di bawah sinar matahari.",
      },
    ],
    proTip:
      "Tinjau kartu Arsitektur Sistem & Keterbukaan Ruang Lingkup di bagian bawah halaman Laporan untuk ringkasan transparansi STACK 2026.",
  },
];

interface UserGuideTabProps {
  onNavigate: (tab: GuideTargetTab) => void;
}

export default function UserGuideTab({ onNavigate }: UserGuideTabProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    caption: string;
    title: string;
  } | null>(null);

  const visibleGuides =
    selectedFilter === "ALL"
      ? FEATURE_GUIDES
      : FEATURE_GUIDES.filter((g) => g.id === selectedFilter);

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Panduan Fitur Interaktif &amp; Langkah Penggunaan
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Panduan visual langkah demi langkah untuk koordinator komunitas,
            warga penerima manfaat, pemilik warung, dan juri.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setSelectedFilter("ALL")}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
              selectedFilter === "ALL"
                ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm dark:shadow-none"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
            }`}
          >
            Semua Fitur (5)
          </button>
          {FEATURE_GUIDES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedFilter(g.id)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
                selectedFilter === g.id
                  ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm dark:shadow-none"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
            >
              {g.number}. {g.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Bilah 5 Langkah Alur Hidup Voucher */}
      <div className="grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800/80 border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#111113] rounded-xl overflow-hidden text-xs">
        {FEATURE_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelectedFilter(g.id)}
            className="p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition group"
          >
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              LANGKAH {g.number}
            </span>
            <p className="font-medium text-zinc-900 dark:text-zinc-100 mt-1 group-hover:underline underline-offset-4">
              {g.title.split(" — ")[0]}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              {g.role}
            </p>
          </button>
        ))}
      </div>

      {/* Kartu Panduan Fitur */}
      <div className="space-y-6">
        {visibleGuides.map((guide) => (
          <article
            key={guide.id}
            className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 overflow-hidden"
          >
            <div className="grid grid-cols-1 xl:grid-cols-12">
              {/* Kolom Foto Panduan */}
              <div className="xl:col-span-5 bg-zinc-50 dark:bg-[#0D0D10] p-5 border-b xl:border-b-0 xl:border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    <span>PANDUAN {guide.number}</span>
                    <span>{guide.role}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        src: guide.imageSrc,
                        caption: guide.imageCaption,
                        title: guide.title,
                      })
                    }
                    className="group relative block w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 aspect-video text-left"
                  >
                    <img
                      src={guide.imageSrc}
                      alt={guide.imageCaption}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-950/80 text-zinc-100 text-[10px] font-mono backdrop-blur-sm opacity-90 group-hover:opacity-100">
                      <Maximize2 className="w-3 h-3" />
                      Perbesar
                    </span>
                  </button>

                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    {guide.imageCaption}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-500">
                    Siap mencoba fitur ini?
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate(guide.targetTab)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-medium shrink-0 transition"
                  >
                    <span>Buka Fitur</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Kolom Langkah-Langkah */}
              <div className="xl:col-span-7 p-6 flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold tracking-[-0.015em] text-zinc-950 dark:text-zinc-50">
                      {guide.title}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      {guide.summary}
                    </p>
                  </div>

                  <ol className="space-y-3">
                    {guide.steps.map((step, idx) => (
                      <li
                        key={step.title}
                        className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80"
                      >
                        <span className="font-mono text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {step.title}
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                            {step.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex items-start gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-zinc-900 dark:text-zinc-200 font-medium">
                      Catatan:
                    </strong>{" "}
                    {guide.proTip}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Modal Perbesar Gambar */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                aria-label="Tutup pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-zinc-950">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.caption}
                className="w-full max-h-[75vh] object-contain"
              />
            </div>
            <div className="px-4 py-2.5 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
              {lightboxImage.caption}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
