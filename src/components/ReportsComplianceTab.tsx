"use client";

import React from "react";
import { Download } from "lucide-react";
import {
  BackendEngineType,
  Beneficiary,
  LedgerEntry,
  Merchant,
  ReconciliationLog,
  SettlementBatch,
  Voucher,
} from "@/lib/types";

interface ReportsComplianceTabProps {
  poolTotalIdr: number;
  fraudBlockedCount: number;
  beneficiaries: Beneficiary[];
  merchants: Merchant[];
  vouchers: Voucher[];
  ledger: LedgerEntry[];
  settlementBatches: SettlementBatch[];
  reconciliationLogs: ReconciliationLog[];
  backendEngine: BackendEngineType;
  formatRupiah: (amount: number) => string;
  onExportCsv: () => void;
  onExportJson: () => void;
}

export default function ReportsComplianceTab({
  poolTotalIdr,
  fraudBlockedCount,
  beneficiaries,
  merchants,
  vouchers,
  ledger,
  settlementBatches,
  reconciliationLogs,
  backendEngine,
  formatRupiah,
  onExportCsv,
  onExportJson,
}: ReportsComplianceTabProps) {
  const totalVouchers = vouchers.length;
  const redeemedOrSettled = vouchers.filter(
    (v) => v.status === "REDEEMED" || v.status === "SETTLED"
  ).length;
  const redemptionRate =
    totalVouchers > 0 ? Math.round((redeemedOrSettled / totalVouchers) * 100) : 0;

  const offlineSyncedCount = ledger.filter(
    (l) => l.sync_mode === "OFFLINE_BATCH_SYNC"
  ).length;
  const onlineSyncedCount = ledger.filter((l) => l.sync_mode === "ONLINE").length;

  const conflictReconciledCount = reconciliationLogs.filter(
    (r) => r.outcome !== "SYNCED"
  ).length;

  const totalMerchantTurnover = merchants.reduce(
    (acc, m) => acc + m.total_settled_idr + m.unsettled_balance_idr,
    0
  );

  const commodityMap = new Map<
    string,
    { name: string; count: number; totalIdr: number }
  >();
  for (const v of vouchers) {
    const cur = commodityMap.get(v.commodity_code) || {
      name: v.commodity_name,
      count: 0,
      totalIdr: 0,
    };
    cur.count += 1;
    cur.totalIdr += v.nominal_idr;
    commodityMap.set(v.commodity_code, cur);
  }
  const commodityStats = Array.from(commodityMap.values()).sort(
    (a, b) => b.totalIdr - a.totalIdr
  );
  const maxCommodityIdr = Math.max(1, ...commodityStats.map((c) => c.totalIdr));
  const maxMerchantTurnover = Math.max(
    1,
    ...merchants.map((m) => m.total_settled_idr + m.unsettled_balance_idr)
  );

  const engineLabel =
    backendEngine === "GO_POSTGRES"
      ? "Golang REST API · PostgreSQL 16"
      : backendEngine === "GO_LOCAL"
        ? "Golang REST API · Penyimpanan Lokal"
        : "Next.js Lokal (Cadangan)";

  return (
    <div className="space-y-6">
      {/* Bar Ekspor */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Ringkasan Operasional &amp; Ekspor Audit
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Unduh log transaksi yang dapat diverifikasi dan tinjau keterbukaan
            ruang lingkup STACK 2026.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-800 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Audit JSON</span>
          </button>
        </div>
      </div>

      {/* KPI 4 Kolom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800/80 border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#111113] rounded-xl overflow-hidden">
        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Tingkat Penukaran
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            {redemptionRate}%
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {redeemedOrSettled} dari {totalVouchers} voucher telah ditukar
          </p>
        </div>

        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Sinkron Offline / Online
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            {offlineSyncedCount} / {onlineSyncedCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Batch offline vs. transaksi langsung
          </p>
        </div>

        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Anomali Diblokir
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            {fraudBlockedCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {conflictReconciledCount} konflik offline direkonsiliasi
          </p>
        </div>

        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Omzet Warung Lokal
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
            {formatRupiah(totalMerchantTurnover)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {merchants.length} warung · {beneficiaries.length} keluarga
          </p>
        </div>
      </div>

      {/* Grafik Distribusi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Alokasi per Paket Komoditas
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Distribusi bantuan pangan pokok terkunci
              </p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              Kas: {formatRupiah(poolTotalIdr)}
            </span>
          </div>

          {commodityStats.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-500">
              Belum ada alokasi komoditas yang tercatat.
            </p>
          ) : (
            <div className="space-y-4">
              {commodityStats.map((item) => {
                const pct = Math.round((item.totalIdr / maxCommodityIdr) * 100);
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {item.name}
                      </span>
                      <span className="font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {item.count}× ·{" "}
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {formatRupiah(item.totalIdr)}
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800/90 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-zinc-900 dark:bg-zinc-200 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(6, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Omzet &amp; Pencairan Warung Mitra
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Perbandingan dana cair vs. saldo menunggu pencairan
              </p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              {settlementBatches.length} Batch
            </span>
          </div>

          {merchants.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-500">
              Belum ada warung mitra yang terdaftar.
            </p>
          ) : (
            <div className="space-y-4">
              {merchants.map((m) => {
                const total = m.total_settled_idr + m.unsettled_balance_idr;
                const settledPct =
                  maxMerchantTurnover > 0
                    ? Math.round(
                        (m.total_settled_idr / maxMerchantTurnover) * 100
                      )
                    : 0;
                const pendingPct =
                  maxMerchantTurnover > 0
                    ? Math.round(
                        (m.unsettled_balance_idr / maxMerchantTurnover) * 100
                      )
                    : 0;
                return (
                  <div key={m.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate pr-2">
                        {m.name}
                      </span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                        {formatRupiah(total)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800/90 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-zinc-900 dark:bg-zinc-200 transition-all duration-500"
                        style={{ width: `${settledPct}%` }}
                      />
                      <div
                        className="h-full bg-zinc-400 dark:bg-zinc-500 transition-all duration-500"
                        style={{ width: `${pendingPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 tabular-nums">
                      <span>Sudah Cair {formatRupiah(m.total_settled_idr)}</span>
                      <span>
                        Menunggu {formatRupiah(m.unsettled_balance_idr)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Arsitektur Sistem & Keterbukaan Ruang Lingkup STACK 2026 */}
      <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Arsitektur Sistem &amp; Keterbukaan Ruang Lingkup
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tim Run.exe (Amos Belsing Arta Baringbing, Jessica Ruth, Jonathan
              Pasaribu) · STACK 2026 Kasus 2
            </p>
          </div>
          <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 rounded-md self-start sm:self-auto">
            {engineLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800/80 text-xs">
          <div className="p-5 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-600 dark:text-zinc-400">
              Prototipe Terimplementasi
            </p>
            <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <li>
                Registrasi warga penerima manfaat &amp; warung mitra, serta
                penerbitan voucher bertanda tangan HMAC-SHA256 dengan nonce
                unik.
              </li>
              <li>
                Kartu voucher dual-kanal: QR dinamis untuk pengguna smartphone
                dan kode 6-karakter SMS / cetak untuk lansia.
              </li>
              <li>
                Terminal POS Warung berkemampuan offline memakai Web Crypto API
                (
                <span className="font-mono text-zinc-800 dark:text-zinc-300">
                  crypto.subtle
                </span>
                ) dan antrean{" "}
                <span className="font-mono text-zinc-800 dark:text-zinc-300">
                  IndexedDB
                </span>
                .
              </li>
              <li>
                REST API Golang + skema PostgreSQL dengan rekonsiliasi konflik
                di sisi server, buku besar rantai hash SHA-256, dan ekspor
                CSV/JSON.
              </li>
            </ul>
          </div>

          <div className="p-5 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-600 dark:text-zinc-400">
              Simulasi &amp; Keterbatasan
            </p>
            <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <li>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">
                  Data Sintetis:
                </span>{" "}
                Profil warga (WGA-0401–0404) dan warung (WRG-01–03) adalah data
                demonstrasi sintetis.
              </li>
              <li>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">
                  Jalur Pencairan Simulasi:
                </span>{" "}
                Batch pencairan menghasilkan struk SHA-256 tanpa melakukan
                transfer bank BI-FAST / QRIS sungguhan.
              </li>
              <li>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">
                  Kunci Rahasia Bersama:
                </span>{" "}
                Verifikasi offline di browser saat ini masih memakai kunci
                bersama HMAC tingkat RW.
              </li>
            </ul>
          </div>

          <div className="p-5 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-600 dark:text-zinc-400">
              Rencana Tugas Final Day
            </p>
            <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <li>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">
                  1. Tanda Tangan Asimetris Ed25519:
                </span>{" "}
                Mengganti kunci HMAC bersama menjadi verifikasi kunci publik
                Ed25519 agar browser warung tidak menyimpan kunci penandatangan.
              </li>
              <li>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">
                  2. Autentikasi &amp; Otorisasi Perangkat:
                </span>{" "}
                Menambahkan login JWT koordinator serta pendaftaran dan daftar
                pencabutan perangkat warung resmi.
              </li>
              <li>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">
                  3. Pengiriman SMS &amp; Penyempurnaan UX:
                </span>{" "}
                Integrasi webhook pengiriman slip SMS otomatis dan penyempurnaan
                antarmuka dari uji coba lapangan.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
