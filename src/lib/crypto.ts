import { ChainVerificationResult, LedgerEntry, Voucher, VoucherQRPayload } from "./types";

export const CLEARINGHOUSE_HMAC_SECRET =
  "CIVICLEDGER_RT04_RW08_COBLONG_HMAC_SECRET_2026";

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export function buildCanonicalVoucherMessage(params: {
  voucher_id: string;
  beneficiary_id: string;
  commodity_code: string;
  nominal_idr: number;
  nonce: string;
  expires_at: string;
}): string {
  return `${params.voucher_id}|${params.beneficiary_id}|${params.commodity_code}|${params.nominal_idr}|${params.nonce}|${params.expires_at}`;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes HMAC-SHA256 signature using standard Web Cryptography API (crypto.subtle).
 */
export async function signVoucherWebCrypto(params: {
  voucher_id: string;
  beneficiary_id: string;
  commodity_code: string;
  nominal_idr: number;
  nonce: string;
  expires_at: string;
}): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(CLEARINGHOUSE_HMAC_SECRET);
  const messageData = encoder.encode(buildCanonicalVoucherMessage(params));

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );

  return bufferToHex(signatureBuffer);
}

/**
 * Verifies voucher authenticity client-side using Web Cryptography API (crypto.subtle).
 * Works 100% offline inside standard mobile and desktop browsers.
 */
export async function verifyVoucherWebCrypto(params: {
  voucher_id: string;
  beneficiary_id: string;
  commodity_code: string;
  nominal_idr: number;
  nonce: string;
  expires_at: string;
  signature_hex: string;
}): Promise<{
  valid: boolean;
  expectedSignature: string;
  canonicalMessage: string;
}> {
  const canonicalMessage = buildCanonicalVoucherMessage(params);
  const expectedSignature = await signVoucherWebCrypto(params);
  const valid =
    expectedSignature.toLowerCase() ===
    (params.signature_hex || "").trim().toLowerCase();

  return {
    valid,
    expectedSignature,
    canonicalMessage,
  };
}

/**
 * Generates an immutable SHA-256 receipt or ledger hash using Web Crypto API.
 */
export async function sha256WebCrypto(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Independently verifies the entire SHA-256 hash chain client-side in the browser.
 */
export async function verifyLedgerChainWebCrypto(
  entries: LedgerEntry[]
): Promise<ChainVerificationResult> {
  if (entries.length === 0) {
    return {
      valid: true,
      checked_count: 0,
      head_hash: GENESIS_HASH,
      message: "Ledger is empty; genesis anchor intact.",
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
        message: `Hash chain break detected at ${e.id}.`,
      };
    }
    const payload = `${e.prev_hash}|${e.voucher_id}|${e.merchant_id}|${e.nominal_idr}|${e.timestamp}|${e.hmac_signature}`;
    const recomputed = await sha256WebCrypto(payload);
    if (recomputed.toLowerCase() !== e.tx_hash.toLowerCase()) {
      return {
        valid: false,
        checked_count: entries.length - i,
        head_hash: entries[0].tx_hash,
        broken_at_id: e.id,
        message: `Payload integrity mismatch detected at ${e.id}.`,
      };
    }
    expectedPrev = e.tx_hash;
  }

  return {
    valid: true,
    checked_count: entries.length,
    head_hash: entries[0].tx_hash,
    message: `Verified all ${entries.length} ledger transactions from genesis to head with zero tampering.`,
  };
}

/**
 * Encodes a Voucher into a compact JSON string for Dynamic QR token presentation.
 */
export function encodeVoucherToQRPayload(voucher: Voucher): string {
  const payload: VoucherQRPayload = {
    v: 1,
    id: voucher.id,
    code: voucher.short_code,
    ben: voucher.beneficiary_id,
    benName: voucher.beneficiary_name,
    rtRw: voucher.rt_rw,
    com: voucher.commodity_code,
    comName: voucher.commodity_name,
    items: voucher.commodity_items,
    nom: voucher.nominal_idr,
    nonce: voucher.nonce,
    exp: voucher.expires_at,
    sig: voucher.hmac_signature,
  };
  return JSON.stringify(payload);
}

export function decodeVoucherQRPayload(raw: string): VoucherQRPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1 && parsed.id && parsed.sig) {
      return parsed as VoucherQRPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function generateClientTxId(): string {
  const bytes = new Uint8Array(4);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `CTX-${Date.now().toString(36).toUpperCase()}-${hex}`;
}
