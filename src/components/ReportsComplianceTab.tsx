"use client";

import React from "react";
import { Download, BarChart3, Store, ShieldCheck, Layers } from "lucide-react";
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
    totalVouchers > 0
      ? Math.round((redeemedOrSettled / totalVouchers) * 100)
      : 0;

  const offlineSyncedCount = ledger.filter(
    (l) => l.sync_mode === "OFFLINE_BATCH_SYNC"
  ).length;
  const onlineSyncedCount = ledger.filter(
    (l) => l.sync_mode === "ONLINE"
  ).length;

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
      ? "Go API + PostgreSQL"
      : backendEngine === "GO_LOCAL"
        ? "Go API (Lokal)"
        : "Next.js Lokal";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-line/55">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary">
            Laporan Penyaluran Bansos
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            Ringkasan pembagian kupon sembako dan tombol unduh laporan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-sm font-semibold transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Excel (CSV)</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-card hover:bg-nested text-ink-primary border border-line/70 shadow-sm text-sm font-semibold transition"
          >
            <Download className="w-4 h-4 text-emeraldTech" />
            <span>Unduh JSON</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              Kupon Terpakai
            </span>
            <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-ink-primary">
              {redemptionRate}%
            </p>
            <p className="text-xs text-ink-muted mt-1 tabular-nums">
              {redeemedOrSettled} dari {totalVouchers} kupon
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              Offline / Online
            </span>
            <div className="w-8 h-8 rounded-lg bg-amberTech/12 text-amberTech flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-ink-primary">
              {offlineSyncedCount} / {onlineSyncedCount}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Dari offline vs langsung
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              Kupon Ditolak
            </span>
            <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-ink-primary">
              {fraudBlockedCount}
            </p>
            <p className="text-xs text-ink-muted mt-1 tabular-nums">
              {conflictReconciledCount} konflik ganda tercatat
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              Total Belanja Kedai
            </span>
            <div className="w-8 h-8 rounded-lg bg-amberTech/12 text-amberTech flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-ink-primary">
              {formatRupiah(totalMerchantTurnover)}
            </p>
            <p className="text-xs text-ink-muted mt-1 tabular-nums">
              {merchants.length} kedai · {beneficiaries.length} penerima
            </p>
          </div>
        </div>
      </div>

      {/* Grafik Distribusi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-bold text-ink-primary">
                Pembagian Paket Sembako
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Jumlah kupon berdasarkan jenis paket
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-emeraldTech bg-emeraldTech/10 px-2.5 py-1 rounded-full tabular-nums shrink-0">
              Sisa Dana: {formatRupiah(poolTotalIdr)}
            </span>
          </div>

          {commodityStats.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              Belum ada paket dibagikan.
            </p>
          ) : (
            <div className="space-y-4">
              {commodityStats.map((item) => {
                const pct = Math.round((item.totalIdr / maxCommodityIdr) * 100);
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink-primary font-semibold">
                        {item.name}
                      </span>
                      <span className="font-mono text-xs text-ink-secondary tabular-nums shrink-0">
                        {item.count} kupon ·{" "}
                        <strong className="text-ink-primary">
                          {formatRupiah(item.totalIdr)}
                        </strong>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-nested rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cta-bg rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(8, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-bold text-ink-primary">
                Transaksi &amp; Pencairan Kedai
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Uang sudah cair dibanding yang belum cair
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-ink-secondary bg-nested px-2.5 py-1 rounded-full tabular-nums shrink-0">
              {settlementBatches.length} Pencairan
            </span>
          </div>

          {merchants.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              Belum ada kedai terdaftar.
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
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink-primary font-semibold truncate">
                        {m.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-ink-primary tabular-nums whitespace-nowrap">
                        {formatRupiah(total)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-nested rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-cta-bg transition-all duration-500"
                        style={{ width: `${settledPct}%` }}
                      />
                      <div
                        className="h-full bg-amberTech transition-all duration-500"
                        style={{ width: `${pendingPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-muted tabular-nums">
                      <span>
                        Sudah Cair:{" "}
                        <span className="text-emeraldTech font-mono font-semibold">
                          {formatRupiah(m.total_settled_idr)}
                        </span>
                      </span>
                      <span>
                        Belum Cair:{" "}
                        <span className="text-amberTech font-mono font-semibold">
                          {formatRupiah(m.unsettled_balance_idr)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Catatan Ruang Lingkup STACK 2026 */}
      <div className="bg-card rounded-2xl border border-line/75 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line/50 bg-surface/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink-primary">
              Info Sistem &amp; Batasan Demo (STACK 2026)
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Tim Run.exe (Amos Belsing Arta Baringbing, Jessica Ruth, Jonathan
              Pasaribu) · Kasus 2
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-emeraldTech bg-emeraldTech/12 px-3 py-1 rounded-full self-start sm:self-auto">
            {engineLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line/50 text-xs">
          <div className="p-5 space-y-2.5">
            <p className="font-bold text-emeraldTech uppercase tracking-wider">
              Yang Sudah Dibuat
            </p>
            <ul className="space-y-2 text-ink-secondary leading-relaxed">
              <li>
                Login per peran (Pengurus, Pemilik Kedai, Warga), daftar akun,
                ganti sandi, dan reset sandi dengan kode OTP 6 angka (hash{" "}
                <code>scrypt</code> + cookie sesi HMAC).
              </li>
              <li>
                Data contoh 20 penerima bansos &amp; 4 kedai mitra (simulasi
                komunitas lokal), pembuatan kupon bertanda tangan HMAC-SHA256,
                QR, kode kertas, dan tombol Huruf Besar.
              </li>
              <li>
                Kasir Kedai offline (Web Crypto API + IndexedDB) dengan
                penolakan kupon palsu dan kupon ganda.
              </li>
              <li>
                Backend Golang + skema PostgreSQL, catatan berantai SHA-256, dan
                ekspor CSV/JSON.
              </li>
            </ul>
          </div>

          <div className="p-5 space-y-2.5">
            <p className="font-bold text-amberTech uppercase tracking-wider">
              Batasan Simulasi
            </p>
            <ul className="space-y-2 text-ink-secondary leading-relaxed">
              <li>
                <strong className="text-ink-primary">Data Contoh:</strong> 20
                nama penerima (WGA-0401 s/d WGA-0420) dan 4 kedai adalah data
                simulasi untuk demo.
              </li>
              <li>
                <strong className="text-ink-primary">OTP Lokal:</strong> Kode
                OTP 6 angka ditampilkan di layar simulasi karena belum memakai
                layanan SMS berbayar.
              </li>
              <li>
                <strong className="text-ink-primary">
                  Pencairan Simulasi:
                </strong>{" "}
                Pencairan kedai mencatat struk di sistem tanpa transfer uang
                sungguhan.
              </li>
            </ul>
          </div>

          <div className="p-5 space-y-2.5">
            <p className="font-bold text-ink-primary uppercase tracking-wider">
              Rencana Tahap Final
            </p>
            <ul className="space-y-2 text-ink-secondary leading-relaxed">
              <li>
                <strong className="text-ink-primary">
                  1. Kunci Publik Ed25519:
                </strong>{" "}
                Mengganti kunci bersama menjadi verifikasi kunci publik di
                perangkat kedai.
              </li>
              <li>
                <strong className="text-ink-primary">
                  2. Pengiriman SMS / WA:
                </strong>{" "}
                Kirim kode kupon dan OTP langsung ke nomor HP penerima.
              </li>
              <li>
                <strong className="text-ink-primary">
                  3. Database Akun Terpusat:
                </strong>{" "}
                Menyatukan penyimpanan akun pengguna ke PostgreSQL di Golang
                API.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
