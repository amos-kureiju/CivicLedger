-- CivicLedger PostgreSQL ACID Schema
-- Team Run.exe | STACK 2026 by GDGoC ITB (Case 2: Stronger Communities and Everyday Services)

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value_int BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beneficiaries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rt_rw TEXT NOT NULL,
    category TEXT NOT NULL,
    phone TEXT NOT NULL,
    household_size INTEGER NOT NULL DEFAULT 1,
    verified_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    rt_rw TEXT NOT NULL,
    bank_account TEXT NOT NULL,
    unsettled_balance_idr BIGINT NOT NULL DEFAULT 0,
    total_settled_idr BIGINT NOT NULL DEFAULT 0,
    redemption_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    short_code TEXT UNIQUE NOT NULL,
    beneficiary_id TEXT NOT NULL REFERENCES beneficiaries(id),
    beneficiary_name TEXT NOT NULL,
    rt_rw TEXT NOT NULL,
    commodity_code TEXT NOT NULL,
    commodity_name TEXT NOT NULL,
    commodity_items TEXT NOT NULL,
    nominal_idr BIGINT NOT NULL,
    nonce TEXT UNIQUE NOT NULL,
    issued_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    hmac_signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    redeemed_by_merchant_id TEXT,
    redeemed_by_merchant_name TEXT,
    redeemed_at TEXT,
    settlement_batch_id TEXT
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    client_tx_id TEXT UNIQUE NOT NULL,
    voucher_id TEXT NOT NULL REFERENCES vouchers(id),
    short_code TEXT NOT NULL,
    beneficiary_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    merchant_name TEXT NOT NULL,
    commodity_name TEXT NOT NULL,
    nominal_idr BIGINT NOT NULL,
    hmac_signature TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    sync_mode TEXT NOT NULL DEFAULT 'ONLINE',
    timestamp TEXT NOT NULL,
    settlement_batch_id TEXT
);

CREATE TABLE IF NOT EXISTS settlement_batches (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    merchant_name TEXT NOT NULL,
    bank_account TEXT NOT NULL,
    voucher_count INTEGER NOT NULL,
    total_amount_idr BIGINT NOT NULL,
    batch_hash TEXT NOT NULL,
    settled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reconciliation_logs (
    id TEXT PRIMARY KEY,
    client_tx_id TEXT NOT NULL,
    voucher_id TEXT NOT NULL,
    short_code TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    outcome TEXT NOT NULL,
    reason TEXT NOT NULL,
    processed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_beneficiary ON vouchers(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_processed ON reconciliation_logs(processed_at DESC);
