"use client";

import React from "react";
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  ShieldAlert,
  ShieldCheck,
  Store,
  Server,
  Clock,
  Layers,
  Info,
  Sparkles,
} from "lucide-react";
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

  // Aggregate by commodity
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
  const maxCommodityIdr = Math.max(
    1,
    ...commodityStats.map((c) => c.totalIdr)
  );

  const maxMerchantTurnover = Math.max(
    1,
    ...merchants.map((m) => m.total_settled_idr + m.unsettled_balance_idr)
  );

  return (
    <div className="space-y-6">
      {/* Header & Export Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            Step 5 • Reporting, Analytics &amp; Transparency
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-1.5">
            Community Aid Performance &amp; Audit Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time operational reporting for community organizers, donors, and
            STACK 2026 transparency verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Ledger CSV</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <FileJson className="w-4 h-4" />
            <span>Export Full Audit JSON</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Redemption Rate</span>
            <BarChart3 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {redemptionRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {redeemedOrSettled} of {totalVouchers} issued vouchers redeemed
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Offline vs Online Sync</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {offlineSyncedCount} / {onlineSyncedCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Offline batch synced vs direct online redemptions
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Duplicates &amp; Fraud Blocked</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {fraudBlockedCount}
          </p>
          <p className="text-xs text-rose-700 mt-1 font-medium">
            {conflictReconciledCount} offline conflicts caught in reconciliation
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Local Warung Economy</span>
            <Store className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatRupiah(totalMerchantTurnover)}
          </p>
          <p className="text-xs text-emerald-700 mt-1 font-medium">
            {merchants.length} stalls • {beneficiaries.length} verified
            households
          </p>
        </div>
      </div>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commodity Package Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Allocation Breakdown by Commodity Package
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Every voucher is locked to essential food staples to prevent cash
            diversion.
          </p>
          <div className="space-y-4">
            {commodityStats.map((item) => {
              const pct = Math.round((item.totalIdr / maxCommodityIdr) * 100);
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {item.name}
                    </span>
                    <span className="font-mono text-slate-600">
                      {item.count}x •{" "}
                      <strong className="text-emerald-700">
                        {formatRupiah(item.totalIdr)}
                      </strong>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Remaining Community Aid Pool</span>
            <span className="font-bold text-slate-900">
              {formatRupiah(poolTotalIdr)}
            </span>
          </div>
        </div>

        {/* Merchant Turnover Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Local Merchant Turnover &amp; Disbursement Status
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Retaining mutual aid spending inside neighborhood micro-merchants (
            <em>warung kelontong</em>).
          </p>
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
                    <span className="font-semibold text-slate-800 truncate pr-2">
                      {m.name}
                    </span>
                    <span className="font-mono text-slate-600 whitespace-nowrap">
                      {formatRupiah(total)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-500"
                      style={{ width: `${settledPct}%` }}
                      title={`Settled: ${formatRupiah(m.total_settled_idr)}`}
                    />
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${pendingPct}%` }}
                      title={`Pending: ${formatRupiah(m.unsettled_balance_idr)}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Settled: {formatRupiah(m.total_settled_idr)}
                    </span>
                    <span className="text-amber-700 font-medium">
                      Pending: {formatRupiah(m.unsettled_balance_idr)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Completed Settlement Batches</span>
            <span className="font-bold text-slate-900">
              {settlementBatches.length} Batches
            </span>
          </div>
        </div>
      </div>

      {/* STACK 2026 Compliance, Scope Honesty & Final Day Roadmap */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                STACK 2026 System Architecture &amp; Scope Disclosure
              </h3>
              <p className="text-xs text-slate-400">
                Team <strong>Run.exe</strong> (Amos Belsing Arta Baringbing,
                Jessica Ruth, Jonathan Pasaribu) • Case 2: Stronger Communities
                and Everyday Services
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-300">
            <Server className="w-3.5 h-3.5" />
            <span>
              Active Engine:{" "}
              {backendEngine === "GO_POSTGRES"
                ? "Golang API + PostgreSQL"
                : backendEngine === "GO_LOCAL"
                  ? "Golang API (Local JSON Store)"
                  : "Next.js Local Fallback"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Completed */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed in Current Prototype</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
              <li>
                Organizer beneficiary &amp; merchant registration + commodity-locked
                voucher issuance with HMAC-SHA256 &amp; unique nonces.
              </li>
              <li>
                Beneficiary wallet supporting dynamic QR payloads and 6-character
                SMS/printed fallback codes.
              </li>
              <li>
                Offline-capable Merchant POS using PWA Service Worker,{" "}
                <code className="text-emerald-300">window.crypto.subtle</code>,
                and <code className="text-emerald-300">IndexedDB</code> queue.
              </li>
              <li>
                Golang REST API + PostgreSQL schema with unique{" "}
                <code className="text-emerald-300">client_tx_id</code> conflict
                reconciliation, SHA-256 hash-chained ledger, and CSV/JSON reports.
              </li>
            </ul>
          </div>

          {/* Simulated / Limitations */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <Info className="w-4 h-4" />
              <span>Simulated Data &amp; Known Limitations</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
              <li>
                <strong>Synthetic Data:</strong> Resident profiles (
                <code>WGA-0401</code>–<code>WGA-0404</code>) and local stalls (
                <code>WRG-01</code>–<code>WRG-03</code>) are synthetic demo
                records for Coblong, Bandung.
              </li>
              <li>
                <strong>Simulated Disbursement Rails:</strong> Settlement batches
                generate verifiable SHA-256 receipts without live BI-FAST/QRIS
                bank transfers.
              </li>
              <li>
                <strong>Shared HMAC Secret:</strong> Prototype uses a neighborhood
                HMAC-SHA256 key to verify offline signatures in-browser.
              </li>
            </ul>
          </div>

          {/* Final Day Planned Tasks */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-sky-500/30 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-sky-400">
              <Sparkles className="w-4 h-4" />
              <span>Planned Final Day Build Tasks</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
              <li>
                <strong>Task 1 — Asymmetric Ed25519 Signing:</strong> Upgrade
                offline verification from shared HMAC secret to Ed25519
                public-key verification so merchant browsers never hold a signing
                secret.
              </li>
              <li>
                <strong>Task 2 — Role-Based Auth &amp; Device Binding:</strong>{" "}
                Add JWT login for organizers &amp; authorized merchant device
                provisioning with revocation list sync.
              </li>
              <li>
                <strong>Task 3 — Automated SMS Dispatch &amp; Usability Polish:</strong>{" "}
                Integrate webhook/SMS slip generator and refine low-literacy POS
                confirmation flow from pilot feedback.
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            All claims, metrics, and simulated workflows strictly follow STACK
            2026 integrity rules.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-slate-500" />
            No AI models required in core deterministic clearinghouse logic.
          </span>
        </div>
      </div>
    </div>
  );
}
