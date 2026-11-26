import { formatStatusLabel } from "./formatters";
import type { LedgerEntry, OfflineRedemptionQueueItem, ReconciliationLog, SettlementBatch, Voucher } from "./types";

export const operationalTimeZone = "Asia/Jakarta";
const dayFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: operationalTimeZone, year: "numeric", month: "2-digit", day: "2-digit" });
export const operationalDay = (timestamp: number) => dayFormatter.format(timestamp);

export type ActivityKind = "voucher" | "transaction" | "sync";
export interface CalendarActivity {
  id: string;
  kind: ActivityKind;
  timestamp: number;
  title: string;
  reference: string;
  party?: string;
  amount?: number;
  status?: string;
  voucherId?: string;
}

export interface CalendarRecords {
  vouchers: Voucher[];
  ledger: LedgerEntry[];
  settlementBatches: SettlementBatch[];
  reconciliationLogs: ReconciliationLog[];
  offlineQueue: OfflineRedemptionQueueItem[];
}

export function buildCalendarActivities(records: CalendarRecords, en: boolean, now = Date.now()) {
  const { vouchers, ledger, settlementBatches, reconciliationLogs, offlineQueue } = records;
  const byDay = new Map<string, CalendarActivity[]>();
  const knownVouchers = new Map(vouchers.map(voucher => [voucher.id, voucher]));
  const ledgerVouchers = new Set(ledger.map(entry => entry.voucher_id));
  const syncedTransactions = new Set(ledger.map(entry => entry.client_tx_id));
  let missingTimestamps = 0;

  function add(time: string, activity: Omit<CalendarActivity, "timestamp">) {
    const timestamp = Date.parse(time);
    if (!Number.isFinite(timestamp)) { missingTimestamps++; return; }
    const key = operationalDay(timestamp);
    const list = byDay.get(key) ?? [];
    list.push({ ...activity, timestamp });
    byDay.set(key, list);
  }

  for (const voucher of vouchers) {
    const common = { reference: voucher.short_code, voucherId: voucher.id, party: voucher.beneficiary_name, amount: voucher.nominal_idr };
    const status = formatStatusLabel(voucher.status, en ? "en" : "id");
    add(voucher.issued_at, { ...common, id: "issue-" + voucher.id, kind: "voucher", title: en ? "Voucher issued" : "Kupon diterbitkan", status });
    if (voucher.redeemed_at && !ledgerVouchers.has(voucher.id)) {
      add(voucher.redeemed_at, { ...common, id: "redeem-" + voucher.id, kind: "transaction", title: en ? "Voucher redeemed" : "Kupon ditukar", party: voucher.redeemed_by_merchant_name || common.party, status });
    } else if (!voucher.redeemed_at && !ledgerVouchers.has(voucher.id) && (voucher.status === "REDEEMED" || voucher.status === "SETTLED")) {
      missingTimestamps++;
    }
    if (voucher.status === "ACTIVE" || voucher.status === "EXPIRED") {
      const scheduled = Date.parse(voucher.expires_at) > now;
      add(voucher.expires_at, {
        ...common, id: "expiry-" + voucher.id, kind: "voucher",
        title: scheduled ? (en ? "Scheduled voucher expiry" : "Jadwal kedaluwarsa kupon") : (en ? "Voucher validity ended" : "Masa berlaku kupon berakhir"),
      });
    }
  }

  for (const entry of ledger) {
    const voucher = knownVouchers.get(entry.voucher_id);
    add(voucher?.redeemed_at || entry.timestamp, {
      id: "ledger-" + entry.id, kind: "transaction", title: en ? "Voucher redeemed" : "Kupon ditukar",
      reference: entry.short_code || entry.id, party: entry.merchant_name, amount: entry.nominal_idr, voucherId: voucher?.id,
      status: entry.sync_mode === "OFFLINE_BATCH_SYNC" ? (en ? "Offline redemption" : "Penukaran offline") : undefined,
    });
  }

  for (const batch of settlementBatches) {
    add(batch.settled_at, {
      id: "batch-" + batch.id, kind: "transaction", title: en ? "Store settlement" : "Pencairan kedai",
      reference: batch.id, party: batch.merchant_name, amount: batch.total_amount_idr,
    });
  }

  for (const log of reconciliationLogs) {
    add(log.processed_at, {
      id: "sync-" + log.id, kind: "sync", title: en ? "Offline reconciliation" : "Rekonsiliasi offline",
      reference: log.short_code || log.client_tx_id, party: log.merchant_name,
      voucherId: knownVouchers.has(log.voucher_id) ? log.voucher_id : undefined,
      status: log.outcome === "SYNCED" ? (en ? "Synced" : "Tersinkron") : (en ? "Conflict" : "Konflik"),
    });
  }

  for (const entry of offlineQueue) {
    if (entry.synced || syncedTransactions.has(entry.client_tx_id)) continue;
    add(entry.redeemed_at, {
      id: "queue-" + entry.queue_id, kind: "sync", title: en ? "Offline redemption queued" : "Penukaran offline dalam antrean",
      reference: entry.short_code || entry.client_tx_id, party: entry.merchant_name, amount: entry.nominal_idr,
      voucherId: knownVouchers.has(entry.voucher_id) ? entry.voucher_id : undefined,
      status: en ? "Pending sync" : "Menunggu sinkronisasi",
    });
  }

  for (const list of byDay.values()) list.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  return { byDay, missingTimestamps };
}
