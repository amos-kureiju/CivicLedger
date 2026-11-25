"use client";

import React from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Landmark,
  Printer,
  Receipt,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  AuthUser,
  ChainVerificationResult,
  LedgerEntry,
  Merchant,
  ReconciliationLog,
  SettlementBatch,
} from "@/lib/types";
import { AppLang } from "@/lib/i18n";
import {
  formatDateTime,
  formatOutcomeLabel,
  formatRupiah,
} from "@/lib/formatters";

interface ClearinghouseTabProps {
  lang: AppLang;
  currentUser: AuthUser;
  poolTotalIdr: number;
  totalUnsettledIdr: number;
  totalSettledBatchesIdr: number;
  merchants: Merchant[];
  ledger: LedgerEntry[];
  reconciliationLogs: ReconciliationLog[];
  settlementBatches: SettlementBatch[];
  showFullHashes: boolean;
  setShowFullHashes: (v: boolean) => void;
  isVerifyingChain: boolean;
  chainCheckResult: ChainVerificationResult | null;
  onSettleMerchants: (merchantId?: string) => void;
  onVerifyHashChain: () => void;
  onExportJson: () => void;
}

export default function ClearinghouseTab({
  lang,
  currentUser,
  poolTotalIdr,
  totalUnsettledIdr,
  totalSettledBatchesIdr,
  merchants,
  ledger,
  reconciliationLogs,
  settlementBatches,
  showFullHashes,
  setShowFullHashes,
  isVerifyingChain,
  chainCheckResult,
  onSettleMerchants,
  onVerifyHashChain,
  onExportJson,
}: ClearinghouseTabProps) {
  const en = lang === "en";

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-emeraldTech">
              {en
                ? "Merchant Settlement · Simulated Disbursement"
                : "Pencairan Kedai · Simulasi Transfer"}
            </p>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary mt-0.5">
              {en ? "Merchant Settlement & Clearinghouse" : "Pencairan Saldo Kedai"}
            </h1>
            <p className="text-sm text-ink-secondary mt-0.5">
              {en
                ? "Aggregate redeemed vouchers into verifiable SHA-256 settlement receipts for each stall."
                : "Cairkan total penukaran kupon ke rekening atau QRIS masing-masing kedai."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-card border border-line/70 rounded-xl shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full bg-emeraldTech animate-pulse" />
              <span className="text-ink-secondary">
                {en ? "Pool Balance:" : "Sisa Dana:"}{" "}
                <strong className="font-mono text-ink-primary tabular-nums">
                  {formatRupiah(poolTotalIdr)}
                </strong>
              </span>
            </div>
            {currentUser.role === "COORDINATOR" && (
              <button
                type="button"
                onClick={() => onSettleMerchants()}
                disabled={totalUnsettledIdr === 0}
                className={`h-11 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition tabular-nums shadow-sm ${
                  totalUnsettledIdr > 0
                    ? "bg-cta-bg hover:opacity-90 text-cta-ink"
                    : "bg-nested text-ink-muted border border-line/60 cursor-not-allowed shadow-none"
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {en ? "Settle All" : "Cairkan Semua"} (
                  {formatRupiah(totalUnsettledIdr)})
                </span>
              </button>
            )}
          </div>
        </div>

        {merchants.length === 0 ? (
          <div className="bg-card border border-line/70 rounded-2xl p-8 text-center text-sm text-ink-muted">
            {en ? "No partner stalls registered." : "Belum ada kedai terdaftar."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {merchants.map((m) => {
              const hasPending = m.unsettled_balance_idr > 0;
              return (
                <div
                  key={m.id}
                  className="bg-card border border-line/75 rounded-2xl shadow-sm p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-nested text-ink-secondary font-semibold">
                        {m.id}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          hasPending
                            ? "bg-emeraldTech/12 text-emeraldTech"
                            : "bg-nested text-ink-muted"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            hasPending ? "bg-emeraldTech" : "bg-ink-muted"
                          }`}
                        />
                        {hasPending
                          ? en
                            ? "Ready"
                            : "Siap Cair"
                          : en
                            ? "Settled"
                            : "Lunas"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-ink-primary leading-snug">
                        {m.name}
                      </h3>
                      <p className="text-xs text-ink-secondary mt-0.5">
                        {m.owner} · {m.rt_rw}
                      </p>
                      <p className="font-mono text-xs text-ink-primary mt-2 flex items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-lg border border-line/50">
                        <Landmark className="w-3.5 h-3.5 text-emeraldTech shrink-0" />
                        <span className="truncate">{m.bank_account}</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3.5 border-t border-line/45 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">
                        {en ? "Redeemed" : "Kupon Diterima"}
                      </span>
                      <span className="font-mono text-ink-primary font-bold tabular-nums">
                        {m.redemption_count}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">
                        {en ? "Total Settled" : "Sudah Cair"}
                      </span>
                      <span className="font-mono text-ink-secondary tabular-nums">
                        {formatRupiah(m.total_settled_idr)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1.5">
                      <span className="text-xs font-bold text-ink-secondary">
                        {en ? "Unsettled" : "Belum Cair"}
                      </span>
                      <span
                        className={`font-mono text-lg font-bold tabular-nums ${
                          hasPending ? "text-emeraldTech" : "text-ink-muted"
                        }`}
                      >
                        {formatRupiah(m.unsettled_balance_idr)}
                      </span>
                    </div>
                  </div>

                  {hasPending && currentUser.role === "COORDINATOR" ? (
                    <button
                      type="button"
                      onClick={() => onSettleMerchants(m.id)}
                      className="w-full h-10 px-4 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{en ? "Settle Balance" : "Cairkan Saldo"}</span>
                    </button>
                  ) : (
                    <div className="w-full h-10 px-3 rounded-xl bg-surface border border-line/50 text-ink-muted text-xs font-medium flex items-center justify-center text-center">
                      {hasPending
                        ? en
                          ? "Awaiting organizer settlement"
                          : "Menunggu pencairan pengurus"
                        : en
                          ? "Settled"
                          : "Sudah lunas"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Hash-Chained Ledger */}
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-primary">
              {en ? "Hash-Chained Transaction Ledger" : "Riwayat Penukaran Kupon"}
            </h2>
            <p className="text-sm text-ink-secondary mt-0.5">
              {en
                ? "Every committed transaction links to the previous SHA-256 hash for tamper detection."
                : "Setiap transaksi saling terhubung secara otomatis supaya data tidak bisa diubah."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowFullHashes(!showFullHashes)}
              className="h-10 px-3.5 rounded-xl bg-card hover:bg-nested text-ink-primary border border-line/70 text-xs font-semibold transition"
            >
              {showFullHashes
                ? en
                  ? "Hide Hashes"
                  : "Tutup Hash"
                : en
                  ? "Show SHA-256"
                  : "Kode Hash (Juri)"}
            </button>
            <button
              type="button"
              onClick={onVerifyHashChain}
              disabled={isVerifyingChain}
              className="h-10 px-4 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <ShieldCheck
                className={`w-4 h-4 ${isVerifyingChain ? "animate-pulse" : ""}`}
              />
              <span>
                {isVerifyingChain
                  ? en
                    ? "Verifying..."
                    : "Mengecek..."
                  : en
                    ? "Verify Chain Integrity"
                    : "Cek Keaslian Data"}
              </span>
            </button>
          </div>
        </div>

        <div
          className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 ${
            chainCheckResult
              ? chainCheckResult.valid
                ? "bg-emeraldTech/10 border-emeraldTech/40"
                : "bg-roseTech/10 border-roseTech/45"
              : "bg-card border-line/70"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                chainCheckResult
                  ? chainCheckResult.valid
                    ? "bg-cta-bg text-cta-ink"
                    : "bg-roseTech text-white"
                  : "bg-nested text-emeraldTech"
              }`}
            >
              {chainCheckResult && !chainCheckResult.valid ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </div>
            <div className="text-sm min-w-0">
              {chainCheckResult ? (
                <span className="text-ink-primary font-semibold">
                  {chainCheckResult.message}
                </span>
              ) : (
                <span className="text-ink-secondary">
                  {en
                    ? `${ledger.length} committed records. Click Verify Chain Integrity to audit SHA-256 links.`
                    : `Ada ${ledger.length} transaksi tercatat. Klik Cek Keaslian Data untuk memastikan catatan belum berubah.`}
                </span>
              )}
            </div>
          </div>
          {chainCheckResult && (
            <span className="hidden lg:inline-block font-mono text-xs text-ink-muted shrink-0">
              HEAD: {chainCheckResult.head_hash.slice(0, 14)}...
            </span>
          )}
        </div>

        <div className="overflow-x-auto bg-card border border-line/75 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-nested/60 border-b border-line/50 text-xs font-semibold text-ink-secondary">
                <th className="py-3 px-4">
                  {en ? "ID & Time" : "No & Waktu"}
                </th>
                <th className="py-3 px-3">
                  {en ? "Voucher & Package" : "Kupon & Paket"}
                </th>
                <th className="py-3 px-3">{en ? "Stall" : "Kedai"}</th>
                <th className="py-3 px-3 text-right">
                  {en ? "Amount" : "Nilai"}
                </th>
                <th className="py-3 px-3 text-center">
                  {en ? "Mode" : "Cara"}
                </th>
                {showFullHashes && (
                  <th className="py-3 px-4">SHA-256 (Prev / Curr)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 text-sm">
              {ledger.length === 0 ? (
                <tr>
                  <td
                    colSpan={showFullHashes ? 6 : 5}
                    className="py-10 text-center text-ink-muted text-sm"
                  >
                    {en ? "No transactions yet." : "Belum ada transaksi."}
                  </td>
                </tr>
              ) : (
                ledger.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-nested/35 transition-colors"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-ink-primary">
                        {entry.id}
                      </div>
                      <div className="text-xs text-ink-muted tabular-nums mt-0.5">
                        {formatDateTime(entry.timestamp)}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-xs font-bold text-ink-primary bg-nested px-2 py-0.5 rounded-md">
                        {entry.short_code}
                      </span>
                      <div className="text-xs text-ink-secondary mt-1">
                        {entry.commodity_name}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-ink-primary font-semibold">
                        {entry.merchant_name}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {entry.settlement_batch_id
                          ? `${en ? "Settled" : "Cair"} (${entry.settlement_batch_id})`
                          : en
                            ? "Unsettled"
                            : "Belum cair"}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-ink-primary tabular-nums whitespace-nowrap">
                      {formatRupiah(entry.nominal_idr)}
                    </td>
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          entry.sync_mode === "OFFLINE_BATCH_SYNC"
                            ? "bg-amberTech/12 text-amberTech"
                            : "bg-emeraldTech/12 text-emeraldTech"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            entry.sync_mode === "OFFLINE_BATCH_SYNC"
                              ? "bg-amberTech"
                              : "bg-emeraldTech"
                          }`}
                        />
                        {entry.sync_mode === "OFFLINE_BATCH_SYNC"
                          ? "Offline"
                          : "Online"}
                      </span>
                    </td>
                    {showFullHashes && (
                      <td className="py-3.5 px-4 font-mono text-[11px] max-w-xs">
                        <div
                          className="text-ink-muted truncate"
                          title={entry.prev_hash}
                        >
                          P: {entry.prev_hash.slice(0, 18)}...
                        </div>
                        <div
                          className="text-emeraldTech truncate"
                          title={entry.tx_hash}
                        >
                          C: {entry.tx_hash.slice(0, 18)}...
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom 2 Columns: Reconciliation Audit & Settlement Receipts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-ink-primary">
                {en ? "Offline Reconciliation Audit" : "Riwayat Sinkron Offline"}
              </h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                {en
                  ? "Batch sync outcomes and rejected duplicate conflicts"
                  : "Daftar data yang dikirim dari mode offline dan kupon ganda yang ditolak"}
              </p>
            </div>

            {reconciliationLogs.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">
                {en
                  ? "No reconciliation logs yet."
                  : "Belum ada catatan sinkronisasi."}
              </p>
            ) : (
              <div className="space-y-4 pl-3 border-l-2 border-line/60 max-h-72 overflow-y-auto pr-1">
                {reconciliationLogs.map((log) => (
                  <div key={log.id} className="relative pl-4">
                    <span
                      className={`absolute -left-[19px] top-1.5 w-3 h-3 rounded-full ring-4 ring-card ${
                        log.outcome === "SYNCED"
                          ? "bg-emeraldTech"
                          : "bg-roseTech"
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`text-xs font-bold ${
                          log.outcome === "SYNCED"
                            ? "text-emeraldTech"
                            : "text-roseTech"
                        }`}
                      >
                        {formatOutcomeLabel(log.outcome, lang)} · {log.short_code}
                      </span>
                      <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                        {formatDateTime(log.processed_at)}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                      {log.reason}
                    </p>
                    <p className="text-[11px] text-ink-muted mt-1">
                      {log.merchant_name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line/45 flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-muted">
              {reconciliationLogs.length} {en ? "logs" : "catatan"}
            </span>
            <button
              type="button"
              onClick={onExportJson}
              className="inline-flex items-center gap-1.5 font-bold text-emeraldTech hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{en ? "Export JSON" : "Unduh JSON"}</span>
            </button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-ink-primary flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emeraldTech" />
                  {en ? "Settlement Receipts" : "Bukti Pencairan Kedai"}
                </h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  {en
                    ? "Recorded settlement batches (simulated transfer)"
                    : "Daftar pencairan yang sudah dicatat (simulasi)"}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-ink-muted">
                {settlementBatches.length} {en ? "Receipts" : "Bukti"}
              </span>
            </div>

            {settlementBatches.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">
                {en ? "No settlements recorded yet." : "Belum ada pencairan."}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {settlementBatches.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-surface border border-line/60 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-ink-primary">
                          {b.id}
                        </span>
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emeraldTech/12 text-emeraldTech">
                          {en ? "SETTLED" : "SELESAI"}
                        </span>
                      </div>
                      <p className="text-sm text-ink-primary font-semibold truncate">
                        {b.merchant_name}
                      </p>
                      <p className="text-xs text-ink-secondary truncate">
                        {b.bank_account} · {formatDateTime(b.settled_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold text-emeraldTech tabular-nums">
                        {formatRupiah(b.total_amount_idr)}
                      </p>
                      <p className="text-xs text-ink-muted tabular-nums">
                        {b.voucher_count} {en ? "vouchers" : "kupon"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line/45 flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-ink-secondary tabular-nums">
              {en ? "Total Settled:" : "Total Cair:"}{" "}
              <strong className="text-ink-primary">
                {formatRupiah(totalSettledBatchesIdr)}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-1.5 font-bold text-ink-primary hover:underline"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{en ? "Print" : "Cetak"}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
