import {
  Beneficiary,
  ClearinghouseState,
  CommodityItem,
  LedgerEntry,
  Merchant,
  ReconciliationLog,
  SettlementBatch,
  Voucher,
} from "./types";
import { GENESIS_HASH, sha256WebCrypto, signVoucherWebCrypto } from "./crypto";

export const DEFAULT_COMMODITY_CATALOG: CommodityItem[] = [
  {
    code: "PKG-BERAS-5KG",
    name: "Paket Beras Lokal Medium (5 Kg)",
    items: "Beras Medium 5 Kg (Khusus Pangan, Non-Tunai)",
    nominal_idr: 72500,
  },
  {
    code: "PKG-PROTEIN-01",
    name: "Paket Gizi & Protein Keluarga",
    items: "Telur Ayam 1 Kg + Tempe 2 Papan + Tahu 10 Potong",
    nominal_idr: 42000,
  },
  {
    code: "PKG-DAPUR-02",
    name: "Paket Minyak Goreng & Pokok Dapur",
    items: "Minyak Goreng 2 Liter + Gula Pasir 1 Kg + Garam Beryodium",
    nominal_idr: 51000,
  },
  {
    code: "PKG-DARURAT-FULL",
    name: "Paket Sembako Darurat Lengkap",
    items: "Beras 5 Kg + Telur 1 Kg + Minyak Goreng 1L + Susu Anak",
    nominal_idr: 115000,
  },
];

/**
 * Data sintetis cadangan di browser jika API belum tercapai saat pertama kali dibuka offline.
 */
export async function buildClientFallbackState(): Promise<ClearinghouseState> {
  const now = Date.now();
  const issuedIso = new Date(now - 3 * 3600 * 1000).toISOString();
  const expIso = new Date(now + 69 * 3600 * 1000).toISOString();
  const earlierRedeemedIso = new Date(now - 5 * 3600 * 1000).toISOString();
  const settledIso = new Date(now - 24 * 3600 * 1000).toISOString();

  const beneficiaries: Beneficiary[] = [
    {
      id: "WGA-0401",
      name: "Ibu Siti Aminah (Lansia)",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      category: "Keluarga Lansia Rentan",
      phone: "0812-2104-8891 (SMS / Kode Cetak)",
      household_size: 2,
      verified_by: "Koordinator RT 04 — Pak H. Dedi",
    },
    {
      id: "WGA-0402",
      name: "Keluarga Pak Deden Suryana",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      category: "Pekerja Harian Lepas Terdampak",
      phone: "0857-9412-3302 (QR Web Ponsel)",
      household_size: 4,
      verified_by: "Koordinator RT 04 — Pak H. Dedi",
    },
    {
      id: "WGA-0403",
      name: "Ibu Rina Kartika",
      rt_rw: "RT 02 / RW 08 Coblong, Bandung",
      category: "Kepala Keluarga Perempuan",
      phone: "0813-2289-7104 (QR Web Ponsel)",
      household_size: 3,
      verified_by: "Relawan Posyandu RW 08",
    },
    {
      id: "WGA-0404",
      name: "Pak Maman Abdurrahman",
      rt_rw: "RT 05 / RW 08 Coblong, Bandung",
      category: "Pemulihan Medis & Rentan",
      phone: "0896-5541-0029 (SMS / Kode Cetak)",
      household_size: 3,
      verified_by: "Ketua RW 08 — Ir. Bambang",
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
      bank_account: "Bank BJB Mikro / QRIS •• 9012",
      unsettled_balance_idr: 51000,
      total_settled_idr: 350000,
      redemption_count: 4,
    },
    {
      id: "WRG-03",
      name: "Warung Sayur & Pangan Teh Euis",
      owner: "Teh Euis Komariah",
      rt_rw: "RT 05 / RW 08 (Gg. Dago Pojok)",
      bank_account: "Mandiri Mikro / GoPay Merchant •• 3319",
      unsettled_balance_idr: 0,
      total_settled_idr: 290000,
      redemption_count: 3,
    },
  ];

  const [v1Sig, v2Sig, v3Sig, v4Sig] = await Promise.all([
    signVoucherWebCrypto({
      voucher_id: "VCH-2026-8841",
      beneficiary_id: "WGA-0401",
      commodity_code: "PKG-BERAS-5KG",
      nominal_idr: 72500,
      nonce: "n9f81a2b4c6d",
      expires_at: expIso,
    }),
    signVoucherWebCrypto({
      voucher_id: "VCH-2026-7732",
      beneficiary_id: "WGA-0402",
      commodity_code: "PKG-DARURAT-FULL",
      nominal_idr: 115000,
      nonce: "a3c5e7f91b2d",
      expires_at: expIso,
    }),
    signVoucherWebCrypto({
      voucher_id: "VCH-2026-6619",
      beneficiary_id: "WGA-0403",
      commodity_code: "PKG-PROTEIN-01",
      nominal_idr: 42000,
      nonce: "d4e8f1a09c3b",
      expires_at: expIso,
    }),
    signVoucherWebCrypto({
      voucher_id: "VCH-2026-5508",
      beneficiary_id: "WGA-0404",
      commodity_code: "PKG-BERAS-5KG",
      nominal_idr: 72500,
      nonce: "b7c2d9e41f8a",
      expires_at: expIso,
    }),
  ]);

  const vouchers: Voucher[] = [
    {
      id: "VCH-2026-8841",
      short_code: "CL-8841-K9",
      beneficiary_id: "WGA-0401",
      beneficiary_name: "Ibu Siti Aminah (Lansia)",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      commodity_code: "PKG-BERAS-5KG",
      commodity_name: "Paket Beras Lokal Medium (5 Kg)",
      commodity_items: "Beras Medium 5 Kg (Khusus Pangan, Non-Tunai)",
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
      beneficiary_name: "Keluarga Pak Deden Suryana",
      rt_rw: "RT 04 / RW 08 Coblong, Bandung",
      commodity_code: "PKG-DARURAT-FULL",
      commodity_name: "Paket Sembako Darurat Lengkap",
      commodity_items: "Beras 5 Kg + Telur 1 Kg + Minyak Goreng 1L + Susu Anak",
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
      commodity_name: "Paket Gizi & Protein Keluarga",
      commodity_items: "Telur Ayam 1 Kg + Tempe 2 Papan + Tahu 10 Potong",
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
      commodity_name: "Paket Beras Lokal Medium (5 Kg)",
      commodity_items: "Beras Medium 5 Kg (Khusus Pangan, Non-Tunai)",
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

  const [tx1Hash, batch1Hash, batch2Hash] = await Promise.all([
    sha256WebCrypto(
      `${GENESIS_HASH}|VCH-2026-5508|WRG-01|72500|${earlierRedeemedIso}|${v4Sig}`
    ),
    sha256WebCrypto("STL-2026-A81F09|WRG-01|480000"),
    sha256WebCrypto("STL-2026-B42C11|WRG-02|350000"),
  ]);

  const ledger: LedgerEntry[] = [
    {
      id: "TX-9F2A10C4",
      client_tx_id: "CTX-SEED-5508",
      voucher_id: "VCH-2026-5508",
      short_code: "CL-5508-R7",
      beneficiary_id: "WGA-0404",
      merchant_id: "WRG-01",
      merchant_name: "Warung Kelontong Berkah Bu Yati",
      commodity_name: "Paket Beras Lokal Medium (5 Kg)",
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
      batch_hash: batch1Hash,
      settled_at: settledIso,
    },
    {
      id: "STL-2026-B42C11",
      merchant_id: "WRG-02",
      merchant_name: "Toko Sembako Pak Asep Mandiri",
      bank_account: "Bank BJB Mikro / QRIS •• 9012",
      voucher_count: 3,
      total_amount_idr: 350000,
      batch_hash: batch2Hash,
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
        "Penukaran offline terverifikasi melalui HMAC-SHA256 dan dicatat ke buku besar rantai hash.",
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
    commodity_catalog: DEFAULT_COMMODITY_CATALOG,
    backend_engine: "NEXTJS_FALLBACK",
  };
}
