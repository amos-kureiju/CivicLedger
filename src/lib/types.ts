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
  settlement_batch_id?: string | null;
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
  settlement_batch_id?: string | null;
}

export interface SettlementBatch {
  id: string;
  merchant_id: string;
  merchant_name: string;
  bank_account: string;
  voucher_count: number;
  total_amount_idr: number;
  batch_hash: string;
  settled_at: string;
}

export type ReconciliationOutcome =
  | "SYNCED"
  | "DUPLICATE_CONFLICT"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "NOT_FOUND";

export interface ReconciliationLog {
  id: string;
  client_tx_id: string;
  voucher_id: string;
  short_code: string;
  merchant_id: string;
  merchant_name: string;
  outcome: ReconciliationOutcome;
  reason: string;
  processed_at: string;
}

export interface BatchSyncResultItem {
  client_tx_id: string;
  voucher_id: string;
  short_code: string;
  merchant_name: string;
  status: "SYNCED" | "CONFLICT";
  outcome: ReconciliationOutcome;
  reason: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  checked_count: number;
  head_hash: string;
  broken_at_id?: string;
  message: string;
}

export interface OfflineRedemptionQueueItem {
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

export interface VoucherQRPayload {
  v: 1;
  id: string;
  code: string;
  ben: string;
  benName: string;
  rtRw: string;
  com: string;
  comName: string;
  items: string;
  nom: number;
  nonce: string;
  exp: string;
  sig: string;
}

export type BackendEngineType = "GO_POSTGRES" | "GO_LOCAL" | "NEXTJS_FALLBACK";

export interface ClearinghouseState {
  pool_total_idr: number;
  fraud_blocked_count: number;
  beneficiaries: Beneficiary[];
  merchants: Merchant[];
  vouchers: Voucher[];
  ledger: LedgerEntry[];
  settlement_batches: SettlementBatch[];
  reconciliation_logs: ReconciliationLog[];
  commodity_catalog: CommodityItem[];
  backend_engine: BackendEngineType;
}

export type AuthRole = "COORDINATOR" | "MERCHANT" | "BENEFICIARY";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AuthRole;
  role_label: string;
  rt_rw: string;
  linked_merchant_id?: string;
  linked_beneficiary_id?: string;
}

