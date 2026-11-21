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
        ? "Golang REST API · Local Store"
        : "Next.js Local Fallback";

  return (
    <div className="space-y-6">
      {/* Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">
            Operational Summary &amp; Audit Exports
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Download verifiable transaction logs and review scope disclosures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Audit JSON</span>
          </button>
        </div>
      </div>

      {/* Unified 4-Column KPI Frame */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80 border border-zinc-800/90 bg-[#111113] rounded-xl overflow-hidden">
        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Redemption Rate
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
            {redemptionRate}%
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {redeemedOrSettled} of {totalVouchers} vouchers redeemed
          </p>
        </div>

        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Offline / Online Sync
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
            {offlineSyncedCount} / {onlineSyncedCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Batch synced vs. direct commits
          </p>
        </div>

        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Blocked Attempts
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
            {fraudBlockedCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {conflictReconciledCount} offline conflicts reconciled
          </p>
        </div>

        <div className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
            Local Merchant Volume
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
            {formatRupiah(totalMerchantTurnover)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {merchants.length} stalls · {beneficiaries.length} households
          </p>
        </div>
      </div>

      {/* Monochrome Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#111113] rounded-xl border border-zinc-800/90 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-100">
                Allocation by Commodity
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Restricted staple disbursement distribution
              </p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              Pool: {formatRupiah(poolTotalIdr)}
            </span>
          </div>

          <div className="space-y-4">
            {commodityStats.map((item) => {
              const pct = Math.round((item.totalIdr / maxCommodityIdr) * 100);
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200 font-medium">
                      {item.name}
                    </span>
                    <span className="font-mono text-zinc-400 tabular-nums">
                      {item.count}× ·{" "}
                      <span className="text-zinc-100">
                        {formatRupiah(item.totalIdr)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-200 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(6, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111113] rounded-xl border border-zinc-800/90 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-100">
                Merchant Turnover &amp; Settlement
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Settled vs. pending balances per neighborhood warung
              </p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              {settlementBatches.length} Batches
            </span>
          </div>

          <div className="space-y-4">
            {merchants.map((m) => {
              const total = m.total_settled_idr + m.unsettled_balance_idr;
              const settledPct =
                maxMerchantTurnover > 0
                  ? Math.round((m.total_settled_idr / maxMerchantTurnover) * 100)
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
                    <span className="text-zinc-200 font-medium truncate pr-2">
                      {m.name}
                    </span>
                    <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                      {formatRupiah(total)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-zinc-200 transition-all duration-500"
                      style={{ width: `${settledPct}%` }}
                    />
                    <div
                      className="h-full bg-zinc-500 transition-all duration-500"
                      style={{ width: `${pendingPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 tabular-nums">
                    <span>Settled {formatRupiah(m.total_settled_idr)}</span>
                    <span>Pending {formatRupiah(m.unsettled_balance_idr)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* System Architecture & STACK 2026 Compliance Disclosure */}
      <div className="bg-[#111113] rounded-xl border border-zinc-800/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">
              System Architecture &amp; Scope Disclosure
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Team Run.exe (Amos Belsing Arta Baringbing, Jessica Ruth, Jonathan
              Pasaribu) · STACK 2026 Case 2
            </p>
          </div>
          <span className="font-mono text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md self-start sm:self-auto">
            {engineLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800/80 text-xs">
          <div className="p-5 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-400">
              Implemented Prototype
            </p>
            <ul className="space-y-2 text-zinc-400 leading-relaxed">
              <li>
                Organizer registration for beneficiaries &amp; local merchants,
                plus HMAC-SHA256 voucher issuance with unique nonces.
              </li>
              <li>
                Dual-channel beneficiary pass with dynamic QR code and
                6-character SMS / printed code fallback.
              </li>
              <li>
                Offline-capable Merchant POS using Web Crypto API (
                <span className="font-mono text-zinc-300">crypto.subtle</span>)
                and <span className="font-mono text-zinc-300">IndexedDB</span>{" "}
                queue.
              </li>
              <li>
                Golang REST API + PostgreSQL schema with server-side conflict
                reconciliation, SHA-256 hash-chained ledger, and CSV/JSON export.
              </li>
            </ul>
          </div>

          <div className="p-5 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-400">
              Simulated Scope &amp; Limitations
            </p>
            <ul className="space-y-2 text-zinc-400 leading-relaxed">
              <li>
                <span className="text-zinc-200">Synthetic Data:</span> Pre-loaded
                beneficiaries (WGA-0401–0404) and merchants (WRG-01–03) are
                synthetic demonstration records.
              </li>
              <li>
                <span className="text-zinc-200">Settlement Rails:</span> Payout
                batches produce SHA-256 receipts without live BI-FAST or QRIS
                bank transfers.
              </li>
              <li>
                <span className="text-zinc-200">Shared Secret Key:</span>{" "}
                Browser offline verification currently uses a shared neighborhood
                HMAC secret.
              </li>
            </ul>
          </div>

          <div className="p-5 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-400">
              Planned Final Day Tasks
            </p>
            <ul className="space-y-2 text-zinc-400 leading-relaxed">
              <li>
                <span className="text-zinc-200">1. Asymmetric Ed25519:</span>{" "}
                Replace shared HMAC verification with server-signed Ed25519
                public-key checks in merchant browsers.
              </li>
              <li>
                <span className="text-zinc-200">2. Auth &amp; Device Binding:</span>{" "}
                Add JWT organizer login and authorized merchant device
                provisioning with revocation sync.
              </li>
              <li>
                <span className="text-zinc-200">3. SMS Dispatch &amp; Polish:</span>{" "}
                Integrate automated SMS slip webhook and apply pilot usability
                improvements.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
