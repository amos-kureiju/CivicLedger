export type AuthRole = "BENEFICIARY" | "MERCHANT" | "COORDINATOR";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AuthRole;
  role_label: string;
  rt_rw: string;
  linked_beneficiary_id?: string;
  linked_merchant_id?: string;
}

export interface LocalAccountRecord extends AuthUser {
  password: string;
  reset_otp?: string | null;
  reset_otp_expires?: number | null;
}

export interface Beneficiary {
  id: string;
  name: string;
  rt_rw: string;
  category: string;
  phone: string;
  household_size: number;
  verified_by: string;
}

export interface Merchant {
  id: string;
  name: string;
  owner: string;
  rt_rw: string;
  bank_account: string;
  unsettled_balance_idr: number;
  total_settled_idr: number;
  redemption_count: number;
}

export interface CommodityItem {
  code: string;
  name: string;
  items: string;
  nominal_idr: number;
}

export type VoucherStatus = "ACTIVE" | "REDEEMED" | "SETTLED" | "EXPIRED";

export interface Voucher {
  id: string;
  short_code: string;
  beneficiary_id: string;
  beneficiary_name: string;
  rt_rw: string;
  commodity_code: string;
  commodity_name: string;
  commodity_items: string;
  nominal_idr: number;
  nonce: string;
  issued_at: string;
  expires_at: string;
  hmac_signature: string;
  status: VoucherStatus;
  redeemed_by_merchant_id?: string | null;
  redeemed_by_merchant_name?: string | null;
  redeemed_at?: string | null;
}

export interface LedgerEntry {
  id: string;
  client_tx_id: string;
  voucher_id: string;
  short_code: string;
  beneficiary_id: string;
  merchant_id: string;
  merchant_name: string;
  commodity_name: string;
  nominal_idr: number;
  hmac_signature: string;
  prev_hash: string;
  tx_hash: string;
  sync_mode: "ONLINE" | "OFFLINE_BATCH_SYNC";
  timestamp: string;
}

export interface OfflineRedemptionItem {
  queue_id: string;
  client_tx_id: string;
  voucher_id: string;
  short_code: string;
  beneficiary_id: string;
  beneficiary_name: string;
  commodity_code: string;
  commodity_name: string;
  commodity_items: string;
  nominal_idr: number;
  merchant_id: string;
  merchant_name: string;
  hmac_signature: string;
  local_receipt_hash: string;
  redeemed_at: string;
  synced: boolean;
  is_simulated_conflict?: boolean;
}

export interface VerificationResult {
  timestamp: string;
  durationMs: number;
  clientTxId: string;
  voucherId: string;
  shortCode: string;
  beneficiaryName: string;
  commodityName: string;
  nominalIdr: number;
  hmacValid: boolean;
  doubleSpendPassed: boolean;
  expiryPassed: boolean;
  mode: "ONLINE" | "OFFLINE";
  providedSignature: string;
  computedSignature: string;
  receiptHash?: string;
  errorReason?: string;
}

export interface MobileClearinghouseState {
  pool_total_idr: number;
  fraud_blocked_count: number;
  beneficiaries: Beneficiary[];
  merchants: Merchant[];
  vouchers: Voucher[];
  ledger: LedgerEntry[];
  commodity_catalog: CommodityItem[];
}
