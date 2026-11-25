import type { Voucher } from "./types";

export const CLEARINGHOUSE_HMAC_SECRET =
  "CIVICLEDGER_RT04_RW08_COBLONG_HMAC_SECRET_2026";

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

// ==================== PURE JS SHA-256 & RFC 2104 HMAC-SHA256 ====================
// Works identically on Android, iOS, and Web with zero native crypto dependencies.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8ToBytes(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(++i);
      code = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function sha256Hex(message: string): string {
  return bytesToHex(sha256Bytes(utf8ToBytes(message)));
}

export function hmacSha256Hex(key: string, message: string): string {
  const blockSize = 64;
  let keyBytes = utf8ToBytes(key);
  if (keyBytes.length > blockSize) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyBytes);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const msgBytes = utf8ToBytes(message);
  const innerInput = new Uint8Array(blockSize + msgBytes.length);
  innerInput.set(iKeyPad, 0);
  innerInput.set(msgBytes, blockSize);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(blockSize + innerHash.length);
  outerInput.set(oKeyPad, 0);
  outerInput.set(innerHash, blockSize);
  return bytesToHex(sha256Bytes(outerInput));
}

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

export function signVoucherOffline(params: {
  voucher_id: string;
  beneficiary_id: string;
  commodity_code: string;
  nominal_idr: number;
  nonce: string;
  expires_at: string;
}): string {
  return hmacSha256Hex(
    CLEARINGHOUSE_HMAC_SECRET,
    buildCanonicalVoucherMessage(params)
  );
}

export function verifyVoucherOffline(params: {
  voucher_id: string;
  beneficiary_id: string;
  commodity_code: string;
  nominal_idr: number;
  nonce: string;
  expires_at: string;
  signature_hex: string;
}): { valid: boolean; expectedSignature: string; canonicalMessage: string } {
  const canonicalMessage = buildCanonicalVoucherMessage(params);
  const expectedSignature = hmacSha256Hex(
    CLEARINGHOUSE_HMAC_SECRET,
    canonicalMessage
  );
  const valid =
    expectedSignature.toLowerCase() ===
    (params.signature_hex || "").trim().toLowerCase();
  return { valid, expectedSignature, canonicalMessage };
}

export function encodeVoucherToQRPayload(voucher: Voucher): string {
  return JSON.stringify({
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
  });
}

export function generateClientTxId(): string {
  const rand = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase();
  return `CTX-MOB-${Date.now().toString(36).toUpperCase()}-${rand}`;
}
