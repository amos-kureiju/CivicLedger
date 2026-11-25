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
    shortLabel: "Pengurus",
    number: "01",
    targetTab: "COORDINATOR",
    title: "Beranda Pengurus: Data Warga & Buat Kupon",
    role: "Pengurus Bansos",
    summary:
      "Lihat daftar 20 warga penerima, tambah warga atau kedai baru, lalu buat kupon sembako.",
    imageSrc: "/guides/guide-1-organizer.jpg",
    imageCaption: "Foto 1 — Pengurus menyiapkan pembagian kupon sembako.",
    steps: [
      {
        title: "Tambah Warga atau Kedai (Bila Perlu)",
        detail:
          "Klik + Warga atau + Kedai di kotak Buat Kupon Sembako untuk menambah data baru.",
      },
      {
        title: "Pilih Penerima & Paket Sembako",
        detail:
          "Pilih nama warga dari dropdown atau klik tab Daftar Penerima di kanan, lalu pilih paket sembako yang sesuai.",
      },
      {
        title: "Buat Kupon Sembako",
        detail:
          "Tentukan masa berlaku kupon lalu klik Buat Kupon Sembako. Kode kupon otomatis dibuat.",
      },
      {
        title: "Lihat Kartu atau Langsung Tukar",
        detail:
          "Di tabel Daftar Kupon sebelah kanan, klik Kartu untuk melihat QR atau klik Tukar untuk tes di Kasir Kedai.",
      },
    ],
    proTip:
      "Jika lupa kata sandi saat masuk, klik tab Lupa Sandi untuk meminta kode 6 angka dan mengganti sandi baru.",
  },
  {
    id: "beneficiary",
    shortLabel: "Kupon Warga",
    number: "02",
    targetTab: "BENEFICIARY",
    title: "Kupon Warga: QR di HP & Kode Kertas",
    role: "Warga Penerima",
    summary:
      "Warga bisa menunjukkan QR lewat HP atau membawa kode kupon yang dicetak di kertas ke kedai terdekat.",
    imageSrc: "/guides/guide-2-beneficiary.jpg",
    imageCaption: "Foto 2 — Contoh QR kupon dan kode pendek di kertas.",
    steps: [
      {
        title: "Perbesar Tulisan Bila Perlu",
        detail:
          "Di panel kiri bawah (atau kanan atas di HP), pilih Huruf: Besar agar tulisan lebih besar dan mudah dibaca.",
      },
      {
        title: "Tunjukkan QR di Layar HP",
        detail:
          "Tunjukkan kotak QR putih kepada pemilik kedai untuk langsung dipindai.",
      },
      {
        title: "Salin SMS atau Cetak Kertas",
        detail:
          "Klik Salin SMS / WA untuk mengirim kode kupon lewat pesan, atau klik Cetak Kertas untuk dicetak.",
      },
      {
        title: "Tukar di Kedai Mitra",
        detail:
          "Bawa HP atau kertas kupon ke kedai terdaftar di Balige, Laguboti, Sitoluama, atau Porsea.",
      },
    ],
    proTip:
      "Kotak QR selalu berlatar putih supaya mudah dibaca kamera HP pemilik kedai.",
  },
  {
    id: "merchant",
    shortLabel: "Kasir Kedai",
    number: "03",
    targetTab: "MERCHANT_POS",
    title: "Kasir Kedai: Cek Kupon Online & Offline",
    role: "Pemilik Kedai",
    summary:
      "Pemilik kedai bisa mengecek dan menerima kupon warga lewat browser HP meski sinyal internet sedang tidak ada.",
    imageSrc: "/guides/guide-3-merchant.jpg",
    imageCaption: "Foto 3 — Pemilik kedai mengecek kupon warga lewat HP.",
    steps: [
      {
        title: "Coba Mode Offline",
        detail:
          "Ubah tombol Sinyal di kiri bawah ke Offline untuk mengetes kondisi tanpa sinyal internet.",
      },
      {
        title: "Scan Kamera, Pilih Cepat, atau Ketik Kode",
        detail:
          "Pilih nama kedai, lalu klik Scan Kamera, pilih kupon di daftar cepat, atau ketik kodenya.",
      },
      {
        title: "Klik Cek & Terima Kupon",
        detail:
          "Jika muncul tanda hijau Kupon Sah, barang sembako boleh diserahkan ke warga. Saat offline, transaksi disimpan dulu di HP.",
      },
      {
        title: "Tes Kupon Palsu & Kupon Ganda",
        detail:
          "Klik Tes Kupon Palsu untuk melihat penolakan nominal palsu, atau klik Tes Kupon Ganda lalu Kirim Semua ke Pusat.",
      },
    ],
    proTip:
      "Begitu sinyal kembali, klik Kirim Semua ke Pusat supaya semua catatan offline masuk ke saldo kedai.",
  },
  {
    id: "clearinghouse",
    shortLabel: "Pencairan",
    number: "04",
    targetTab: "CLEARINGHOUSE",
    title: "Pencairan & Riwayat Transaksi",
    role: "Pengurus / Bendahara",
    summary:
      "Cairkan saldo belanja ke rekening kedai dan periksa keaslian seluruh catatan transaksi.",
    imageSrc: "/guides/guide-4-clearinghouse.jpg",
    imageCaption: "Foto 4 — Pemeriksaan riwayat penukaran dan pencairan kedai.",
    steps: [
      {
        title: "Cairkan Saldo Kedai",
        detail:
          "Cek angka Belum Cair di tiap kartu kedai, lalu klik Cairkan Saldo atau Cairkan Semua.",
      },
      {
        title: "Cek Keaslian Data",
        detail:
          "Klik Cek Keaslian Data di atas tabel riwayat untuk memastikan tidak ada transaksi yang diubah.",
      },
      {
        title: "Lihat Riwayat Offline & Bukti Pencairan",
        detail:
          "Di bagian bawah terlihat catatan kiriman offline (termasuk kupon ganda yang ditolak) dan bukti pencairan kedai.",
      },
    ],
    proTip:
      "Klik tombol Kode Hash (Juri) di kanan atas tabel bila ingin melihat hash SHA-256 setiap transaksi.",
  },
  {
    id: "reports",
    shortLabel: "Laporan",
    number: "05",
    targetTab: "REPORTS",
    title: "Laporan Bansos & Unduh Excel",
    role: "Pengurus & Donatur",
    summary:
      "Pantau persentase kupon yang sudah dipakai dan unduh laporan dalam format Excel (CSV) atau JSON.",
    imageSrc: "/guides/guide-5-reports.jpg",
    imageCaption: "Foto 5 — Ringkasan grafik pembagian sembako dan ekspor data.",
    steps: [
      {
        title: "Cek Grafik Paket & Kedai",
        detail:
          "Buka menu Laporan Bansos untuk melihat pembagian paket sembako dan total belanja di tiap kedai.",
      },
      {
        title: "Unduh Excel (CSV) atau JSON",
        detail:
          "Klik Unduh Excel (CSV) untuk membuka daftar transaksi di Microsoft Excel atau Google Sheets.",
      },
      {
        title: "Atur Tampilan Layar",
        detail:
          "Pilih Layar Siang atau Malam di panel kiri bawah sesuai kondisi pencahayaan.",
      },
    ],
    proTip:
      "Ringkasan fitur yang sudah berjalan dan batasan simulasi tercantum di bagian bawah halaman Laporan Bansos.",
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
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-4 border-b border-line/55">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary">
            Cara Pakai CivicLedger
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            Panduan singkat penggunaan untuk pengurus, warga penerima, dan
            pemilik kedai.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-card border border-line/70 shadow-sm">
          <button
            type="button"
            onClick={() => setSelectedFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${selectedFilter === "ALL"
                ? "bg-cta-bg text-cta-ink"
                : "text-ink-muted hover:text-ink-primary"
              }`}
          >
            Semua (5)
          </button>
          {FEATURE_GUIDES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedFilter(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${selectedFilter === g.id
                  ? "bg-cta-bg text-cta-ink"
                  : "text-ink-muted hover:text-ink-primary"
                }`}
            >
              {g.number}. {g.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {FEATURE_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelectedFilter(g.id)}
            className={`p-4 text-left rounded-2xl border transition-all group shadow-sm ${selectedFilter === g.id
                ? "bg-emeraldTech/10 border-cta-bg"
                : "bg-card border-line/70 hover:bg-nested/50"
              }`}
          >
            <span className="font-mono text-[11px] text-emeraldTech font-bold">
              TAHAP {g.number}
            </span>
            <p className="text-sm font-bold text-ink-primary mt-1 group-hover:underline underline-offset-4">
              {g.shortLabel}
            </p>
            <p className="text-xs text-ink-muted mt-0.5 truncate">{g.role}</p>
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {visibleGuides.map((guide) => (
          <article
            key={guide.id}
            className="bg-card rounded-2xl border border-line/75 shadow-sm overflow-hidden"
          >
            <div className="grid grid-cols-1 xl:grid-cols-12">
              <div className="xl:col-span-5 bg-surface/70 p-5 border-b xl:border-b-0 xl:border-r border-line/50 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-emeraldTech">
                      PANDUAN {guide.number}
                    </span>
                    <span className="font-semibold text-ink-muted">
                      {guide.role}
                    </span>
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
                    className="group relative block w-full overflow-hidden rounded-xl border border-line/70 bg-nested aspect-video text-left"
                  >
                    <img
                      src={guide.imageSrc}
                      alt={guide.imageCaption}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-semibold backdrop-blur-sm">
                      <Maximize2 className="w-3 h-3" />
                      Perbesar
                    </span>
                  </button>

                  <p className="text-xs text-ink-secondary leading-relaxed">
                    {guide.imageCaption}
                  </p>
                </div>

                <div className="pt-3 border-t border-line/50 flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-muted">
                    Langsung coba menu ini:
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate(guide.targetTab)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold shrink-0 transition shadow-sm"
                  >
                    <span>Buka Menu</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="xl:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink-primary">
                      {guide.title}
                    </h2>
                    <p className="text-sm text-ink-secondary mt-1 leading-relaxed">
                      {guide.summary}
                    </p>
                  </div>

                  <ol className="space-y-2.5">
                    {guide.steps.map((step, idx) => (
                      <li
                        key={step.title}
                        className="flex items-start gap-3 p-3.5 rounded-xl bg-surface border border-line/55"
                      >
                        <span className="font-mono text-xs font-bold text-cta-ink bg-cta-bg w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink-primary">
                            {step.title}
                          </p>
                          <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                            {step.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex items-start gap-2 pt-3 border-t border-line/50 text-xs text-ink-secondary leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emeraldTech shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-ink-primary font-bold">
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

      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full bg-card rounded-2xl border border-line overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-line/60 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-ink-primary truncate">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="text-ink-muted hover:text-ink-primary p-1"
                aria-label="Tutup foto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.caption}
                className="w-full max-h-[75vh] object-contain"
              />
            </div>
            <div className="px-5 py-3 text-xs text-ink-secondary border-t border-line/60">
              {lightboxImage.caption}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
