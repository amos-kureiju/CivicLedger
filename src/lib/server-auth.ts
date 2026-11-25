import crypto from "crypto";
import fs from "fs";
import path from "path";
import { AuthRole, AuthUser } from "./types";

const AUTH_FILE = path.join(process.cwd(), ".civicledger-auth.json");
const SESSION_SECRET =
  process.env.CIVICLEDGER_SESSION_SECRET ||
  "CIVICLEDGER_DEMO_SESSION_KEY_2026";
export const SESSION_COOKIE_NAME = "civicledger_session";

interface StoredAuthAccount extends AuthUser {
  password_salt: string;
  password_hash: string;
  reset_otp_hash?: string | null;
  reset_otp_expires_at?: string | null;
}

interface AuthStoreData {
  accounts: StoredAuthAccount[];
}

function hashPasswordScrypt(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function verifyPasswordScrypt(
  password: string,
  salt: string,
  expectedHash: string
): boolean {
  const actual = Buffer.from(hashPasswordScrypt(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function hashOtp(otp: string, accountId: string): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${accountId}|${otp.trim()}`)
    .digest("hex");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function makeAccount(
  user: AuthUser,
  plainPassword: string
): StoredAuthAccount {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    ...user,
    password_salt: salt,
    password_hash: hashPasswordScrypt(plainPassword, salt),
    reset_otp_hash: null,
    reset_otp_expires_at: null,
  };
}

function buildDefaultAccounts(): AuthStoreData {
  return {
    accounts: [
      makeAccount(
        {
          id: "USR-PENGURUS-01",
          name: "St. Darwin Pasaribu",
          email: "pengurus@civicledger.id",
          phone: "0811-6200-0101",
          role: "COORDINATOR",
          role_label: "Pengurus Bansos",
          rt_rw: "Desa Sitoluama, Laguboti",
        },
        "pengurus2026"
      ),
      makeAccount(
        {
          id: "USR-KEDAI-01",
          name: "Marta Br. Sihombing",
          email: "kedai@civicledger.id",
          phone: "0812-6300-4821",
          role: "MERCHANT",
          role_label: "Pemilik Kedai Sembako",
          rt_rw: "Jl. Patuan Nagari, Balige",
          linked_merchant_id: "WRG-01",
        },
        "kedai2026"
      ),
      makeAccount(
        {
          id: "USR-WARGA-01",
          name: "Op. Rina Br. Napitupulu",
          email: "warga@civicledger.id",
          phone: "0812-6311-4401",
          role: "BENEFICIARY",
          role_label: "Warga Penerima",
          rt_rw: "Desa Sitoluama, Laguboti",
          linked_beneficiary_id: "WGA-0401",
        },
        "warga2026"
      ),
    ],
  };
}

function loadAuthStore(): AuthStoreData {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const raw = fs.readFileSync(AUTH_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<AuthStoreData>;
      if (
        parsed &&
        Array.isArray(parsed.accounts) &&
        parsed.accounts.some((a) => a.email === "pengurus@civicledger.id")
      ) {
        return { accounts: parsed.accounts };
      }
    }
  } catch {
    // Fallback to default seed
  }
  const seeded = buildDefaultAccounts();
  saveAuthStore(seeded);
  return seeded;
}

function saveAuthStore(store: AuthStoreData): void {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Ignore read-only environments
  }
}

export function resetAuthDemoStore(): void {
  saveAuthStore(buildDefaultAccounts());
}

export function toPublicUser(acc: StoredAuthAccount): AuthUser {
  return {
    id: acc.id,
    name: acc.name,
    email: acc.email,
    phone: acc.phone,
    role: acc.role,
    role_label: acc.role_label,
    rt_rw: acc.rt_rw,
    linked_merchant_id: acc.linked_merchant_id,
    linked_beneficiary_id: acc.linked_beneficiary_id,
  };
}

function findAccountByIdentifier(
  accounts: StoredAuthAccount[],
  identifier: string
): StoredAuthAccount | undefined {
  const clean = identifier.trim().toLowerCase();
  const cleanDigits = normalizePhone(identifier);
  return accounts.find(
    (a) =>
      a.email.toLowerCase() === clean ||
      (cleanDigits.length >= 8 && normalizePhone(a.phone) === cleanDigits)
  );
}

export function authenticateUser(
  identifier: string,
  password: string
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  if (!identifier.trim() || !password) {
    return {
      ok: false,
      error: "Email atau nomor HP dan kata sandi wajib diisi.",
    };
  }
  const store = loadAuthStore();
  const account = findAccountByIdentifier(store.accounts, identifier);
  if (!account) {
    return {
      ok: false,
      error: "Akun tidak ditemukan. Periksa kembali email atau nomor HP.",
    };
  }
  const valid = verifyPasswordScrypt(
    password,
    account.password_salt,
    account.password_hash
  );
  if (!valid) {
    return {
      ok: false,
      error: "Kata sandi salah. Coba lagi atau klik Lupa Kata Sandi.",
    };
  }
  return { ok: true, user: toPublicUser(account) };
}

export function requestPasswordResetOtp(identifier: string):
  | {
      ok: true;
      account_name: string;
      masked_contact: string;
      demo_otp_code: string;
      expires_in_minutes: number;
    }
  | { ok: false; error: string } {
  if (!identifier.trim()) {
    return {
      ok: false,
      error: "Masukkan email atau nomor HP akun terlebih dahulu.",
    };
  }
  const store = loadAuthStore();
  const account = findAccountByIdentifier(store.accounts, identifier);
  if (!account) {
    return {
      ok: false,
      error: "Email atau nomor HP belum terdaftar.",
    };
  }

  const otpCode = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  account.reset_otp_hash = hashOtp(otpCode, account.id);
  account.reset_otp_expires_at = expiresAt;
  saveAuthStore(store);

  return {
    ok: true,
    account_name: account.name,
    masked_contact: `${account.email} / ${account.phone}`,
    demo_otp_code: otpCode,
    expires_in_minutes: 10,
  };
}

export function confirmPasswordReset(params: {
  identifier: string;
  otp_code: string;
  new_password: string;
}): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const { identifier, otp_code, new_password } = params;
  if (!identifier.trim() || !otp_code.trim() || !new_password) {
    return {
      ok: false,
      error: "Lengkapi kode 6 angka dan kata sandi baru.",
    };
  }
  if (new_password.length < 6) {
    return {
      ok: false,
      error: "Kata sandi baru minimal 6 karakter.",
    };
  }

  const store = loadAuthStore();
  const account = findAccountByIdentifier(store.accounts, identifier);
  if (!account || !account.reset_otp_hash || !account.reset_otp_expires_at) {
    return {
      ok: false,
      error: "Kode belum diminta. Silakan minta kode baru.",
    };
  }

  if (new Date(account.reset_otp_expires_at).getTime() < Date.now()) {
    account.reset_otp_hash = null;
    account.reset_otp_expires_at = null;
    saveAuthStore(store);
    return {
      ok: false,
      error: "Kode sudah habis waktunya (lebih dari 10 menit). Minta kode baru.",
    };
  }

  const expectedHash = Buffer.from(account.reset_otp_hash, "hex");
  const actualHash = Buffer.from(hashOtp(otp_code, account.id), "hex");
  if (
    expectedHash.length !== actualHash.length ||
    !crypto.timingSafeEqual(expectedHash, actualHash)
  ) {
    return {
      ok: false,
      error: "Kode 6 angka salah. Cek kembali angka yang diketik.",
    };
  }

  const newSalt = crypto.randomBytes(16).toString("hex");
  account.password_salt = newSalt;
  account.password_hash = hashPasswordScrypt(new_password, newSalt);
  account.reset_otp_hash = null;
  account.reset_otp_expires_at = null;
  saveAuthStore(store);

  return { ok: true, user: toPublicUser(account) };
}

export function changePasswordForUser(params: {
  user_id: string;
  old_password: string;
  new_password: string;
}): { ok: true } | { ok: false; error: string } {
  const { user_id, old_password, new_password } = params;
  if (!old_password || !new_password) {
    return {
      ok: false,
      error: "Isi kata sandi lama dan kata sandi baru.",
    };
  }
  if (new_password.length < 6) {
    return {
      ok: false,
      error: "Kata sandi baru minimal 6 karakter.",
    };
  }

  const store = loadAuthStore();
  const account = store.accounts.find((a) => a.id === user_id);
  if (!account) {
    return { ok: false, error: "Akun tidak ditemukan." };
  }

  if (
    !verifyPasswordScrypt(
      old_password,
      account.password_salt,
      account.password_hash
    )
  ) {
    return {
      ok: false,
      error: "Kata sandi lama tidak sesuai.",
    };
  }

  const newSalt = crypto.randomBytes(16).toString("hex");
  account.password_salt = newSalt;
  account.password_hash = hashPasswordScrypt(new_password, newSalt);
  saveAuthStore(store);

  return { ok: true };
}

export function registerNewCommunityAccount(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: AuthRole;
  rt_rw?: string;
}): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const phone = params.phone.trim();
  if (!name || !email || !phone || !params.password) {
    return { ok: false, error: "Lengkapi semua kolom pendaftaran." };
  }
  if (params.password.length < 6) {
    return {
      ok: false,
      error: "Kata sandi minimal 6 karakter.",
    };
  }

  const store = loadAuthStore();
  if (findAccountByIdentifier(store.accounts, email)) {
    return {
      ok: false,
      error: "Email sudah terdaftar. Silakan langsung masuk.",
    };
  }

  const roleLabels: Record<AuthRole, string> = {
    COORDINATOR: "Pengurus Bansos",
    MERCHANT: "Pemilik Kedai",
    BENEFICIARY: "Warga Penerima",
  };

  const newAccount = makeAccount(
    {
      id: `USR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      name,
      email,
      phone,
      role: params.role,
      role_label: roleLabels[params.role],
      rt_rw: params.rt_rw?.trim() || "Desa Sitoluama, Laguboti",
      linked_beneficiary_id:
        params.role === "BENEFICIARY" ? "WGA-0401" : undefined,
      linked_merchant_id: params.role === "MERCHANT" ? "WRG-01" : undefined,
    },
    params.password
  );

  store.accounts.push(newAccount);
  saveAuthStore(store);
  return { ok: true, user: toPublicUser(newAccount) };
}

export function createSignedSessionToken(user: AuthUser): string {
  const payload = {
    uid: user.id,
    role: user.role,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySignedSessionToken(
  token: string | undefined
): AuthUser | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as { uid: string; exp: number };
    if (!parsed.uid || parsed.exp < Date.now()) return null;

    const store = loadAuthStore();
    const account = store.accounts.find((a) => a.id === parsed.uid);
    return account ? toPublicUser(account) : null;
  } catch {
    return null;
  }
}
