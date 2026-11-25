import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  ChainVerificationResult,
  ClearinghouseState,
  LedgerEntry,
  ReconciliationLog,
  SettlementBatch,
  Voucher,
} from "./types";
import {
  CLEARINGHOUSE_HMAC_SECRET,
  GENESIS_HASH,
  buildCanonicalVoucherMessage,
} from "./crypto";
import {
  DEFAULT_COMMODITY_CATALOG,
  SEED_BENEFICIARIES,
  SEED_MERCHANTS,
} from "./client-seed";

const STATE_FILE = path.join(process.cwd(), ".civicledger-ledger.json");

export const COMMODITY_CATALOG = DEFAULT_COMMODITY_CATALOG;

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
      message: "Belum ada transaksi yang tercatat.",
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
        message: `Urutan catatan tidak cocok pada transaksi ${e.id}.`,
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
        message: `Data pada transaksi ${e.id} terdeteksi berubah.`,
      };
    }
    expectedPrev = e.tx_hash;
  }
  return {
    valid: true,
    checked_count: entries.length,
    head_hash: entries[0].tx_hash,
    message: `Hasil cek aman. Seluruh ${entries.length} transaksi sesuai dan belum pernah diubah.`,
  };
}

function buildInitialSeedState(): ClearinghouseState {
  const now = Date.now();
  const issuedIso = new Date(now - 3 * 3600 * 1000).toISOString();
  const expIso = new Date(now + 69 * 3600 * 1000).toISOString();
  const earlierRedeemedIso = new Date(now - 5 * 3600 * 1000).toISOString();
  const secondRedeemedIso = new Date(now - 4 * 3600 * 1000).toISOString();
  const settledIso = new Date(now - 24 * 3600 * 1000).toISOString();

  const beneficiaries = SEED_BENEFICIARIES.map((b) => ({ ...b }));
  const merchants = SEED_MERCHANTS.map((m) => ({ ...m }));

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
    voucher_id: "VCH-2026-4420",
    beneficiary_id: "WGA-0405",
    commodity_code: "PKG-DAPUR-02",
    nominal_idr: 51000,
    nonce: "c1a9f4b28e0d",
    expires_at: expIso,
  });
  const v5Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-3318",
    beneficiary_id: "WGA-0406",
    commodity_code: "PKG-BERAS-5KG",
    nominal_idr: 72500,
    nonce: "e8b2c4d71a5f",
    expires_at: expIso,
  });
  const v6Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-2195",
    beneficiary_id: "WGA-0407",
    commodity_code: "PKG-DARURAT-FULL",
    nominal_idr: 115000,
    nonce: "f2d7a9c14b6e",
    expires_at: expIso,
  });
  const v7Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-5508",
    beneficiary_id: "WGA-0404",
    commodity_code: "PKG-BERAS-5KG",
    nominal_idr: 72500,
    nonce: "b7c2d9e41f8a",
    expires_at: expIso,
  });
  const v8Sig = signVoucherNodeHmac({
    voucher_id: "VCH-2026-5102",
    beneficiary_id: "WGA-0408",
    commodity_code: "PKG-DAPUR-02",
    nominal_idr: 51000,
    nonce: "91e4a7c32d8b",
    expires_at: expIso,
  });

  const vouchers: Voucher[] = [
    {
      id: "VCH-2026-8841",
      short_code: "CL-8841-K9",
      beneficiary_id: "WGA-0401",
      beneficiary_name: "Op. Rina Br. Napitupulu",
      rt_rw: "Desa Sitoluama, Laguboti",
      commodity_code: "PKG-BERAS-5KG",
      commodity_name: "Paket Beras 5 Kg",
      commodity_items: "Beras 5 kg (khusus sembako, tidak bisa diuangkan)",
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
      beneficiary_name: "Maruli Siahaan",
      rt_rw: "Desa Tambunan, Balige",
      commodity_code: "PKG-DARURAT-FULL",
      commodity_name: "Paket Sembako Lengkap",
      commodity_items: "Beras 5 kg, telur 1 kg, minyak goreng 1 liter, susu",
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
      beneficiary_name: "Tiurma Br. Simanjuntak",
      rt_rw: "Kel. Sangkar Nihuta, Balige",
      commodity_code: "PKG-PROTEIN-01",
      commodity_name: "Paket Telur & Lauk",
      commodity_items: "Telur ayam 1 kg, tempe 2 papan, tahu 10 potong",
      nominal_idr: 42000,
      nonce: "d4e8f1a09c3b",
      issued_at: issuedIso,
      expires_at: expIso,
      hmac_signature: v3Sig,
      status: "ACTIVE",
    },
    {
      id: "VCH-2026-4420",
      short_code: "CL-4420-T5",
      beneficiary_id: "WGA-0405",
      beneficiary_name: "Rosmawati Br. Tampubolon",
      rt_rw: "Desa Tampahan, Kec. Tampahan",
      commodity_code: "PKG-DAPUR-02",
      commodity_name: "Paket Minyak & Gula",
      commodity_items: "Minyak goreng 2 liter, gula pasir 1 kg, garam",
      nominal_idr: 51000,
      nonce: "c1a9f4b28e0d",
      issued_at: issuedIso,
      expires_at: expIso,
      hmac_signature: v4Sig,
      status: "ACTIVE",
    },
    {
      id: "VCH-2026-3318",
      short_code: "CL-3318-B8",
      beneficiary_id: "WGA-0406",
      beneficiary_name: "Parlindungan Pardede",
      rt_rw: "Desa Lumban Pea, Balige",
      commodity_code: "PKG-BERAS-5KG",
      commodity_name: "Paket Beras 5 Kg",
      commodity_items: "Beras 5 kg (khusus sembako, tidak bisa diuangkan)",
      nominal_idr: 72500,
      nonce: "e8b2c4d71a5f",
      issued_at: issuedIso,
      expires_at: expIso,
      hmac_signature: v5Sig,
      status: "ACTIVE",
    },
    {
      id: "VCH-2026-2195",
      short_code: "CL-2195-N3",
      beneficiary_id: "WGA-0407",
      beneficiary_name: "Op. Doli Manurung",
      rt_rw: "Desa Patane II, Porsea",
      commodity_code: "PKG-DARURAT-FULL",
      commodity_name: "Paket Sembako Lengkap",
      commodity_items: "Beras 5 kg, telur 1 kg, minyak goreng 1 liter, susu",
      nominal_idr: 115000,
      nonce: "f2d7a9c14b6e",
      issued_at: issuedIso,
      expires_at: expIso,
      hmac_signature: v6Sig,
      status: "ACTIVE",
    },
    {
      id: "VCH-2026-5508",
      short_code: "CL-5508-R7",
      beneficiary_id: "WGA-0404",
      beneficiary_name: "Hotman Hutagaol",
      rt_rw: "Desa Sibuea, Laguboti",
      commodity_code: "PKG-BERAS-5KG",
      commodity_name: "Paket Beras 5 Kg",
      commodity_items: "Beras 5 kg (khusus sembako, tidak bisa diuangkan)",
      nominal_idr: 72500,
      nonce: "b7c2d9e41f8a",
      issued_at: earlierRedeemedIso,
      expires_at: expIso,
      hmac_signature: v7Sig,
      status: "REDEEMED",
      redeemed_by_merchant_id: "WRG-01",
      redeemed_by_merchant_name: "Kedai Sembako Inang Boru Sihombing",
      redeemed_at: earlierRedeemedIso,
    },
    {
      id: "VCH-2026-5102",
      short_code: "CL-5102-S4",
      beneficiary_id: "WGA-0408",
      beneficiary_name: "Nurhayati Br. Sibarani",
      rt_rw: "Desa Sibarani Nasampulu, Laguboti",
      commodity_code: "PKG-DAPUR-02",
      commodity_name: "Paket Minyak & Gula",
      commodity_items: "Minyak goreng 2 liter, gula pasir 1 kg, garam",
      nominal_idr: 51000,
      nonce: "91e4a7c32d8b",
      issued_at: secondRedeemedIso,
      expires_at: expIso,
      hmac_signature: v8Sig,
      status: "REDEEMED",
      redeemed_by_merchant_id: "WRG-02",
      redeemed_by_merchant_name: "Toko Pangan Pak Binsar",
      redeemed_at: secondRedeemedIso,
    },
  ];

  const tx1Hash = computeLedgerTxHashNode({
    prev_hash: GENESIS_HASH,
    voucher_id: "VCH-2026-5508",
    merchant_id: "WRG-01",
    nominal_idr: 72500,
    timestamp: earlierRedeemedIso,
    hmac_sig: v7Sig,
  });

  const tx2Hash = computeLedgerTxHashNode({
    prev_hash: tx1Hash,
    voucher_id: "VCH-2026-5102",
    merchant_id: "WRG-02",
    nominal_idr: 51000,
    timestamp: secondRedeemedIso,
    hmac_sig: v8Sig,
  });

  const ledger: LedgerEntry[] = [
    {
      id: "TX-4B8E21D9",
      client_tx_id: "CTX-SEED-5102",
      voucher_id: "VCH-2026-5102",
      short_code: "CL-5102-S4",
      beneficiary_id: "WGA-0408",
      merchant_id: "WRG-02",
      merchant_name: "Toko Pangan Pak Binsar",
      commodity_name: "Paket Minyak & Gula",
      nominal_idr: 51000,
      hmac_signature: v8Sig,
      prev_hash: tx1Hash,
      tx_hash: tx2Hash,
      sync_mode: "ONLINE",
      timestamp: secondRedeemedIso,
    },
    {
      id: "TX-9F2A10C4",
      client_tx_id: "CTX-SEED-5508",
      voucher_id: "VCH-2026-5508",
      short_code: "CL-5508-R7",
      beneficiary_id: "WGA-0404",
      merchant_id: "WRG-01",
      merchant_name: "Kedai Sembako Inang Boru Sihombing",
      commodity_name: "Paket Beras 5 Kg",
      nominal_idr: 72500,
      hmac_signature: v7Sig,
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
      merchant_name: "Kedai Sembako Inang Boru Sihombing",
      bank_account: "BRI / QRIS •• 4821",
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
      merchant_name: "Toko Pangan Pak Binsar",
      bank_account: "Bank Sumut / QRIS •• 9012",
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
      merchant_name: "Kedai Sembako Inang Boru Sihombing",
      outcome: "SYNCED",
      reason: "Transaksi offline sudah dicek dan masuk ke catatan pusat.",
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
      if (
        parsed &&
        Array.isArray(parsed.beneficiaries) &&
        parsed.beneficiaries.length >= 20
      ) {
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
