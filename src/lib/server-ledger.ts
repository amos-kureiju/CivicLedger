import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  Beneficiary,
  ChainVerificationResult,
  ClearinghouseState,
  CommodityItem,
  LedgerEntry,
  Merchant,
  ReconciliationLog,
  SettlementBatch,
  Voucher,
} from "./types";
import {
  CLEARINGHOUSE_HMAC_SECRET,
  GENESIS_HASH,
  buildCanonicalVoucherMessage,
} from "./crypto";

const STATE_FILE = path.join(process.cwd(), ".civicledger-ledger.json");

export const COMMODITY_CATALOG: CommodityItem[] = [
  {
    code: "PKG-BERAS-5KG",
    name: "Local Rice Staple Pack (5 Kg)",
    items: "5 Kg Medium-Grade Rice (Commodity-Locked, Non-Cash)",
    nominal_idr: 72500,
  },
  {
    code: "PKG-PROTEIN-01",
    name: "Family Protein & Nutrition Pack",
    items: "1 Kg Eggs + 2 Blocks Tempeh + 10 Pieces Tofu",
    nominal_idr: 42000,
  },
  {
    code: "PKG-DAPUR-02",
    name: "Cooking Oil & Kitchen Essentials",
    items: "2L Cooking Oil + 1 Kg Granulated Sugar + Iodized Salt",
    nominal_idr: 51000,
  },
  {
    code: "PKG-DARURAT-FULL",
    name: "Emergency Complete Staple Pack",
    items: "5 Kg Rice + 1 Kg Eggs + 1L Cooking Oil + Child Milk",
    nominal_idr: 115000,
  },
];

export function signVoucherNodeHmac(params: {
  voucher_id: string;
  beneficiary_id: string;
  commodity_code: string;
  nominal_idr: number;
  nonce: string;
  expires_at: string;
}): string {
  const canonical = buildCanonicalVoucherMessage(params);
  return crypto
    .createHmac("sha256", CLEARINGHOUSE_HMAC_SECRET)
    .update(canonical, "utf8")
    .digest("hex");
}

export function computeLedgerTxHashNode(params: {
  prev_hash: string;
  voucher_id: string;
  merchant_id: string;
  nominal_idr: number;
  timestamp: string;
  hmac_sig: string;
}): string {
  const payload = `${params.prev_hash}|${params.voucher_id}|${params.merchant_id}|${params.nominal_idr}|${params.timestamp}|${params.hmac_sig}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

export function verifyLedgerChainNode(
  entries: LedgerEntry[]
): ChainVerificationResult {
  if (entries.length === 0) {
    return {
      valid: true,
      checked_count: 0,
      head_hash: GENESIS_HASH,
      message: "Ledger is empty; genesis hash intact.",
    };
  }
  let expectedPrev = GENESIS_HASH;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.prev_hash !== expectedPrev) {
      return {
        valid: false,
        checked_count: entries.length - i,
        head_hash: entries[0].tx_hash,
        broken_at_id: e.id,
        message: `Hash chain discontinuity at ${e.id}.`,
      };
    }
    const recomputed = computeLedgerTxHashNode({
      prev_hash: e.prev_hash,
      voucher_id: e.voucher_id,
      merchant_id: e.merchant_id,
      nominal_idr: e.nominal_idr,
      timestamp: e.timestamp,
      hmac_sig: e.hmac_signature,
    });
    if (recomputed.toLowerCase() !== e.tx_hash.toLowerCase()) {
      return {
        valid: false,
        checked_count: entries.length - i,
        head_hash: entries[0].tx_hash,
        broken_at_id: e.id,
        message: `Tampered payload detected at ${e.id}.`,
      };
    }
    expectedPrev = e.tx_hash;
  }
  return {
    valid: true,
    checked_count: entries.length,
    head_hash: entries[0].tx_hash,
    message: `All ${entries.length} ledger entries verified against SHA-256 hash chain.`,
  };
}

function buildInitialSeedState(): ClearinghouseState {
  const now = Date.now();
  const issuedIso = new Date(now - 3 * 3600 * 1000).toISOString();
  const expIso = new Date(now + 69 * 3600 * 1000).toISOString();
  const earlierRedeemedIso = new Date(now - 5 * 3600 * 1000).toISOString();
  const settledIso = new Date(now - 24 * 3600 * 1000).toISOString();

  const beneficiaries: Beneficiary[] = [
    {
      id: "WGA-0401",
      name: "Ibu Siti Aminah (Elderly)",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      category: "Vulnerable Senior Household",
      phone: "0812-2104-8891 (SMS / Printed Code)",
      household_size: 2,
      verified_by: "RT 04 Coordinator — Pak H. Dedi",
    },
    {
      id: "WGA-0402",
      name: "Pak Deden Suryana Family",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      category: "Displaced Daily-Wage Worker",
      phone: "0857-9412-3302 (Mobile PWA QR)",
      household_size: 4,
      verified_by: "RT 04 Coordinator — Pak H. Dedi",
    },
    {
      id: "WGA-0403",
      name: "Ibu Rina Kartika",
      rt_rw: "RT 02 / RW 08 Coblong, Bandung",
      category: "Single-Parent Household",
      phone: "0813-2289-7104 (Mobile PWA QR)",
      household_size: 3,
      verified_by: "RW 08 Posyandu Volunteer",
    },
    {
      id: "WGA-0404",
      name: "Pak Maman Abdurrahman",
      rt_rw: "RT 05 / RW 08 Coblong, Bandung",
      category: "Medical Recovery Support",
      phone: "0896-5541-0029 (SMS / Printed Code)",
      household_size: 3,
      verified_by: "RW 08 Chair — Ir. Bambang",
    },
  ];

  const merchants: Merchant[] = [
    {
      id: "WRG-01",
      name: "Warung Kelontong Berkah Bu Yati",
      owner: "Ibu Yati Rohayati",
      rt_rw: "RT 04 / RW 08 (Gg. Sangkuriang Dalam)",
      bank_account: "BRI Simpedes / QRIS •• 4821",
      unsettled_balance_idr: 72500,
      total_settled_idr: 480000,
      redemption_count: 5,
    },
    {
      id: "WRG-02",
      name: "Toko Sembako Pak Asep Mandiri",
      owner: "Pak Asep Sunandar",
      rt_rw: "RT 02 / RW 08 (Jl. Cisitu Lama)",
      bank_account: "Bank BJB Micro / QRIS •• 9012",
      unsettled_balance_idr: 51000,
      total_settled_idr: 350000,
      redemption_count: 4,
    },
    {
      id: "WRG-03",
      name: "Warung Sayur & Pangan Teh Euis",
      owner: "Teh Euis Komariah",
      rt_rw: "RT 05 / RW 08 (Gg. Dago Pojok)",
      bank_account: "Mandiri Micro / GoPay Merchant •• 3319",
      unsettled_balance_idr: 0,
      total_settled_idr: 290000,
      redemption_count: 3,
    },
  ];

  const v1Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-8841",
    beneficiary_id: "WGA-0401",
    commodity_code: "PKG-BERAS-5KG",
    nominal_idr: 72500,
    nonce: "n9f81a2b4c6d",
    expires_at: expIso,
  });

  const v2Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-7732",
    beneficiary_id: "WGA-0402",
    commodity_code: "PKG-DARURAT-FULL",
    nominal_idr: 115000,
    nonce: "a3c5e7f91b2d",
    expires_at: expIso,
  });

  const v3Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-6619",
    beneficiary_id: "WGA-0403",
    commodity_code: "PKG-PROTEIN-01",
    nominal_idr: 42000,
    nonce: "d4e8f1a09c3b",
    expires_at: expIso,
  });

  const v4Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-5508",
    beneficiary_id: "WGA-0404",
    commodity_code: "PKG-BERAS-5KG",
    nominal_idr: 72500,
    nonce: "b7c2d9e41f8a",
    expires_at: expIso,
  });

  const vouchers: Voucher[] = [
    {
      id: "VCH-2026-8841",
      short_code: "CL-8841-K9",
      beneficiary_id: "WGA-0401",
      beneficiary_name: "Ibu Siti Aminah (Elderly)",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      commodity_code: "PKG-BERAS-5KG",
      commodity_name: "Local Rice Staple Pack (5 Kg)",
      commodity_items: "5 Kg Medium-Grade Rice (Commodity-Locked, Non-Cash)",
      nominal_idr: 72500,
      nonce: "n9f81a2b4c6d",
      issued_at: issuedIso,
      expires_at: expIso,
      hmac_signature: v1Sig,
      status: "ACTIVE",
    },
    {
      id: "VCH-2026-7732",
      short_code: "CL-7732-M4",
      beneficiary_id: "WGA-0402",
      beneficiary_name: "Pak Deden Suryana Family",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      commodity_code: "PKG-DARURAT-FULL",
      commodity_name: "Emergency Complete Staple Pack",
      commodity_items: "5 Kg Rice + 1 Kg Eggs + 1L Cooking Oil + Child Milk",
      nominal_idr: 115000,
      nonce: "a3c5e7f91b2d",
      issued_at: issuedIso,
      expires_at: expIso,
      hmac_signature: v2Sig,
      status: "ACTIVE",
    },
    {
      id: "VCH-2026-6619",
      short_code: "CL-6619-P2",
      beneficiary_id: "WGA-0403",
      beneficiary_name: "Ibu Rina Kartika",
      rt_rw: "RT 02 / RW 08 Coblong, Bandung",
      commodity_code: "PKG-PROTEIN-01",
      commodity_name: "Family Protein & Nutrition Pack",
      commodity_items: "1 Kg Eggs + 2 Blocks Tempeh + 10 Pieces Tofu",
      nominal_idr: 42000,
      nonce: "d4e8f1a09c3b",
      issued_at: issuedIso,
      expires_at: expIso,
      hmac_signature: v3Sig,
      status: "ACTIVE",
    },
    {
      id: "VCH-2026-5508",
      short_code: "CL-5508-R7",
      beneficiary_id: "WGA-0404",
      beneficiary_name: "Pak Maman Abdurrahman",
      rt_rw: "RT 05 / RW 08 Coblong, Bandung",
      commodity_code: "PKG-BERAS-5KG",
      commodity_name: "Local Rice Staple Pack (5 Kg)",
      commodity_items: "5 Kg Medium-Grade Rice (Commodity-Locked, Non-Cash)",
      nominal_idr: 72500,
      nonce: "b7c2d9e41f8a",
      issued_at: earlierRedeemedIso,
      expires_at: expIso,
      hmac_signature: v4Sig,
      status: "REDEEMED",
      redeemed_by_merchant_id: "WRG-01",
      redeemed_by_merchant_name: "Warung Kelontong Berkah Bu Yati",
      redeemed_at: earlierRedeemedIso,
    },
  ];

  const tx1Hash = computeLedgerTxHashNode({
    prev_hash: GENESIS_HASH,
    voucher_id: "VCH-2026-5508",
    merchant_id: "WRG-01",
    nominal_idr: 72500,
    timestamp: earlierRedeemedIso,
    hmac_sig: v4Sig,
  });

  const ledger: LedgerEntry[] = [
    {
      id: "TX-9F2A10C4",
      client_tx_id: "CTX-SEED-5508",
      voucher_id: "VCH-2026-5508",
      short_code: "CL-5508-R7",
      beneficiary_id: "WGA-0404",
      merchant_id: "WRG-01",
      merchant_name: "Warung Kelontong Berkah Bu Yati",
      commodity_name: "Local Rice Staple Pack (5 Kg)",
      nominal_idr: 72500,
      hmac_signature: v4Sig,
      prev_hash: GENESIS_HASH,
      tx_hash: tx1Hash,
      sync_mode: "OFFLINE_BATCH_SYNC",
      timestamp: earlierRedeemedIso,
    },
  ];

  const settlement_batches: SettlementBatch[] = [
    {
      id: "STL-2026-A81F09",
      merchant_id: "WRG-01",
      merchant_name: "Warung Kelontong Berkah Bu Yati",
      bank_account: "BRI Simpedes / QRIS •• 4821",
      voucher_count: 4,
      total_amount_idr: 480000,
      batch_hash: crypto
        .createHash("sha256")
        .update("STL-2026-A81F09|WRG-01|480000", "utf8")
        .digest("hex"),
      settled_at: settledIso,
    },
    {
      id: "STL-2026-B42C11",
      merchant_id: "WRG-02",
      merchant_name: "Toko Sembako Pak Asep Mandiri",
      bank_account: "Bank BJB Micro / QRIS •• 9012",
      voucher_count: 3,
      total_amount_idr: 350000,
      batch_hash: crypto
        .createHash("sha256")
        .update("STL-2026-B42C11|WRG-02|350000", "utf8")
        .digest("hex"),
      settled_at: settledIso,
    },
  ];

  const reconciliation_logs: ReconciliationLog[] = [
    {
      id: "REC-SEED-001",
      client_tx_id: "CTX-SEED-5508",
      voucher_id: "VCH-2026-5508",
      short_code: "CL-5508-R7",
      merchant_id: "WRG-01",
      merchant_name: "Warung Kelontong Berkah Bu Yati",
      outcome: "SYNCED",
      reason:
        "Offline redemption verified via HMAC-SHA256 and committed to hash-chained ledger.",
      processed_at: earlierRedeemedIso,
    },
  ];

  return {
    pool_total_idr: 8500000,
    fraud_blocked_count: 0,
    beneficiaries,
    merchants,
    vouchers,
    ledger,
    settlement_batches,
    reconciliation_logs,
    commodity_catalog: COMMODITY_CATALOG,
    backend_engine: "NEXTJS_FALLBACK",
  };
}

export function loadClearinghouseState(): ClearinghouseState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<ClearinghouseState>;
      if (parsed && Array.isArray(parsed.beneficiaries) && parsed.beneficiaries.length > 0) {
        return {
          pool_total_idr: parsed.pool_total_idr ?? 8500000,
          fraud_blocked_count: parsed.fraud_blocked_count ?? 0,
          beneficiaries: parsed.beneficiaries,
          merchants: parsed.merchants ?? [],
          vouchers: parsed.vouchers ?? [],
          ledger: (parsed.ledger ?? []).map((l) => ({
            ...l,
            client_tx_id: l.client_tx_id || `CTX-LEGACY-${l.id}`,
          })),
          settlement_batches: parsed.settlement_batches ?? [],
          reconciliation_logs: parsed.reconciliation_logs ?? [],
          commodity_catalog: COMMODITY_CATALOG,
          backend_engine: "NEXTJS_FALLBACK",
        };
      }
    }
  } catch {
    // Fallback to initial seed
  }
  const initial = buildInitialSeedState();
  saveClearinghouseState(initial);
  return initial;
}

export function saveClearinghouseState(state: ClearinghouseState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Ignore write errors in read-only environments
  }
}

export function resetClearinghouseState(): ClearinghouseState {
  const initial = buildInitialSeedState();
  saveClearinghouseState(initial);
  return initial;
}
