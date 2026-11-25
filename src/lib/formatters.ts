import { ReconciliationOutcome, VoucherStatus } from "@/lib/types";
import { AppLang } from "@/lib/i18n";

export interface CryptoVerificationTrace {
  timestamp: string;
  durationMs: number;
  clientTxId: string;
  voucherId: string;
  shortCode: string;
  beneficiaryName: string;
  commodityName: string;
  nominalIdr: number;
  canonicalMessage: string;
  providedSignature: string;
  computedSignature: string;
  hmacValid: boolean;
  doubleSpendCheckPassed: boolean;
  expiryCheckPassed: boolean;
  mode: "ONLINE" | "OFFLINE_INDEXEDDB";
  receiptHash?: string;
  errorReason?: string;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatShortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatStatusLabel(
  status: VoucherStatus,
  lang: AppLang = "id"
): string {
  if (lang === "en") {
    switch (status) {
      case "ACTIVE":
        return "Active";
      case "REDEEMED":
        return "Redeemed";
      case "SETTLED":
        return "Settled";
      case "EXPIRED":
        return "Expired";
    }
  }
  switch (status) {
    case "ACTIVE":
      return "Siap Pakai";
    case "REDEEMED":
      return "Sudah Dipakai";
    case "SETTLED":
      return "Sudah Cair";
    case "EXPIRED":
      return "Kedaluwarsa";
  }
}

export function formatOutcomeLabel(
  outcome: ReconciliationOutcome,
  lang: AppLang = "id"
): string {
  if (lang === "en") {
    switch (outcome) {
      case "SYNCED":
        return "Synced";
      case "DUPLICATE_CONFLICT":
        return "Rejected (Duplicate)";
      case "INVALID_SIGNATURE":
        return "Rejected (Tampered)";
      case "EXPIRED":
        return "Rejected (Expired)";
      case "NOT_FOUND":
        return "Not Found";
    }
  }
  switch (outcome) {
    case "SYNCED":
      return "Masuk";
    case "DUPLICATE_CONFLICT":
      return "Ditolak (Ganda)";
    case "INVALID_SIGNATURE":
      return "Ditolak (Palsu)";
    case "EXPIRED":
      return "Ditolak (Habis)";
    case "NOT_FOUND":
      return "Tidak Ditemukan";
  }
}
