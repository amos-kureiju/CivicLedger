import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthRole,
  AuthUser,
  LocalAccountRecord,
  MobileClearinghouseState,
  OfflineRedemptionItem,
} from "./types";
import { buildMobileSeedState, DEFAULT_ACCOUNTS } from "./seed";
import { ThemeMode } from "./theme";

const KEYS = {
  USER: "cl_mob_user_v2",
  ACCOUNTS: "cl_mob_accounts_v2",
  STATE: "cl_mob_state_v1",
  OFFLINE_QUEUE: "cl_mob_offline_queue_v1",
  REDEEMED_IDS: "cl_mob_redeemed_ids_v1",
  PREFS: "cl_mob_prefs_v1",
};

export interface MobilePrefs {
  theme: ThemeMode;
  largeText: boolean;
  isOfflineMode: boolean;
  serverUrl: string;
}

const DEFAULT_PREFS: MobilePrefs = {
  theme: "light",
  largeText: false,
  isOfflineMode: false,
  serverUrl: "http://localhost:3000",
};

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function toPublicUser(acc: LocalAccountRecord): AuthUser {
  return {
    id: acc.id,
    name: acc.name,
    email: acc.email,
    phone: acc.phone,
    role: acc.role,
    role_label: acc.role_label,
    rt_rw: acc.rt_rw,
    linked_beneficiary_id: acc.linked_beneficiary_id,
    linked_merchant_id: acc.linked_merchant_id,
  };
}

export async function loadPrefs(): Promise<MobilePrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PREFS);
    if (raw) {
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PREFS;
}

export async function savePrefs(prefs: MobilePrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export async function loadSavedUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export async function saveUserSession(user: AuthUser | null): Promise<void> {
  try {
    if (!user) {
      await AsyncStorage.removeItem(KEYS.USER);
    } else {
      await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
    }
  } catch {
    // ignore
  }
}

async function loadLocalAccounts(): Promise<LocalAccountRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalAccountRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const fresh = DEFAULT_ACCOUNTS.map((a) => ({ ...a }));
  try {
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(fresh));
  } catch {
    // ignore
  }
  return fresh;
}

async function saveLocalAccounts(accounts: LocalAccountRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

function findAccount(
  accounts: LocalAccountRecord[],
  identifier: string
): LocalAccountRecord | undefined {
  const clean = identifier.trim().toLowerCase();
  const digits = normalizePhone(identifier);
  return accounts.find(
    (a) =>
      a.email.toLowerCase() === clean ||
      (digits.length >= 8 && normalizePhone(a.phone) === digits)
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 1500
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ==================== AUTH (ONLINE + OFFLINE FALLBACK) ====================

export async function mobileLogin(
  serverUrl: string,
  identifier: string,
  password: string
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  if (!identifier.trim() || !password) {
    return {
      ok: false,
      error: "Email atau nomor HP dan kata sandi wajib diisi.",
    };
  }

  // Coba server dulu jika aktif
  if (serverUrl.trim()) {
    const res = await fetchWithTimeout(
      `${serverUrl.replace(/\/$/, "")}/api/auth`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOGIN",
          identifier,
          password,
        }),
      }
    );
    if (res) {
      try {
        const data = await res.json();
        if (res.ok && data.user) {
          if (data.user.role !== "BENEFICIARY") {
            return {
              ok: false,
              error:
                "Aplikasi HP ini khusus untuk Warga Penerima. Pemilik kedai & pengurus silakan masuk lewat website.",
            };
          }
          await saveUserSession(data.user);
          return { ok: true, user: data.user };
        }
        if (res.status === 401 || res.status === 400) {
          return { ok: false, error: data.error || "Kata sandi salah." };
        }
      } catch {
        // lanjut fallback lokal
      }
    }
  }

  // Fallback lokal (tetap jalan tanpa server / offline)
  const accounts = await loadLocalAccounts();
  const found = findAccount(accounts, identifier);
  if (!found) {
    return {
      ok: false,
      error: "Akun tidak ditemukan. Periksa email atau nomor HP.",
    };
  }
  if (found.password !== password) {
    return {
      ok: false,
      error: "Kata sandi salah. Coba lagi atau klik Lupa Sandi.",
    };
  }
  const pub = toPublicUser(found);
  await saveUserSession(pub);
  return { ok: true, user: pub };
}

export async function mobileRequestResetOtp(
  serverUrl: string,
  identifier: string
): Promise<
  | { ok: true; account_name: string; demo_otp_code: string; message: string }
  | { ok: false; error: string }
> {
  if (!identifier.trim()) {
    return { ok: false, error: "Masukkan email atau nomor HP terlebih dahulu." };
  }

  if (serverUrl.trim()) {
    const res = await fetchWithTimeout(
      `${serverUrl.replace(/\/$/, "")}/api/auth`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST_RESET", identifier }),
      }
    );
    if (res) {
      try {
        const data = await res.json();
        if (res.ok && data.demo_otp_code) {
          return {
            ok: true,
            account_name: data.account_name,
            demo_otp_code: data.demo_otp_code,
            message: data.message,
          };
        }
        if (res.status === 404) {
          return { ok: false, error: data.error || "Akun tidak ditemukan." };
        }
      } catch {
        // fallback lokal
      }
    }
  }

  const accounts = await loadLocalAccounts();
  const found = findAccount(accounts, identifier);
  if (!found) {
    return { ok: false, error: "Email atau nomor HP belum terdaftar." };
  }
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  found.reset_otp = otp;
  found.reset_otp_expires = Date.now() + 10 * 60 * 1000;
  await saveLocalAccounts(accounts);

  return {
    ok: true,
    account_name: found.name,
    demo_otp_code: otp,
    message: `Kode verifikasi 6 angka untuk ${found.name} sudah dibuat (berlaku 10 menit).`,
  };
}

export async function mobileConfirmReset(
  serverUrl: string,
  identifier: string,
  otpCode: string,
  newPassword: string
): Promise<
  | { ok: true; email: string; message: string }
  | { ok: false; error: string }
> {
  if (newPassword.length < 6) {
    return { ok: false, error: "Kata sandi baru minimal 6 karakter." };
  }

  if (serverUrl.trim()) {
    const res = await fetchWithTimeout(
      `${serverUrl.replace(/\/$/, "")}/api/auth`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM_RESET",
          identifier,
          otp_code: otpCode,
          new_password: newPassword,
        }),
      }
    );
    if (res) {
      try {
        const data = await res.json();
        if (res.ok && data.user) {
          return {
            ok: true,
            email: data.user.email,
            message: data.message,
          };
        }
        if (res.status === 400) {
          return { ok: false, error: data.error || "Kode OTP tidak cocok." };
        }
      } catch {
        // fallback lokal
      }
    }
  }

  const accounts = await loadLocalAccounts();
  const found = findAccount(accounts, identifier);
  if (!found || !found.reset_otp) {
    return { ok: false, error: "Kode belum diminta. Silakan minta kode baru." };
  }
  if ((found.reset_otp_expires || 0) < Date.now()) {
    return { ok: false, error: "Kode sudah habis waktunya. Minta kode baru." };
  }
  if (found.reset_otp !== otpCode.trim()) {
    return { ok: false, error: "Kode 6 angka salah." };
  }
  found.password = newPassword;
  found.reset_otp = null;
  found.reset_otp_expires = null;
  await saveLocalAccounts(accounts);

  return {
    ok: true,
    email: found.email,
    message: `Kata sandi ${found.name} berhasil diubah. Silakan masuk.`,
  };
}

export async function mobileRegister(
  serverUrl: string,
  params: {
    name: string;
    email: string;
    phone: string;
    rt_rw?: string;
    password: string;
    role: AuthRole;
  }
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  if (
    !params.name.trim() ||
    !params.email.trim() ||
    !params.phone.trim() ||
    params.password.length < 6
  ) {
    return {
      ok: false,
      error: "Lengkapi semua kolom dan sandi minimal 6 karakter.",
    };
  }

  if (serverUrl.trim()) {
    const res = await fetchWithTimeout(
      `${serverUrl.replace(/\/$/, "")}/api/auth`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REGISTER",
          ...params,
          role: "BENEFICIARY",
        }),
      }
    );
    if (res) {
      try {
        const data = await res.json();
        if (res.ok && data.user) {
          await saveUserSession(data.user);
          return { ok: true, user: data.user };
        }
        if (res.status === 400) {
          return { ok: false, error: data.error || "Pendaftaran gagal." };
        }
      } catch {
        // fallback lokal
      }
    }
  }

  const accounts = await loadLocalAccounts();
  if (findAccount(accounts, params.email)) {
    return { ok: false, error: "Email sudah terdaftar. Silakan masuk." };
  }

  const created: LocalAccountRecord = {
    id: `USR-WARGA-${Date.now().toString(36).toUpperCase()}`,
    name: params.name.trim(),
    email: params.email.trim().toLowerCase(),
    phone: params.phone.trim(),
    role: "BENEFICIARY",
    role_label: "Warga Penerima",
    rt_rw: params.rt_rw?.trim() || "Desa Sitoluama, Laguboti",
    linked_beneficiary_id: "WGA-0401",
    password: params.password,
  };

  accounts.push(created);
  await saveLocalAccounts(accounts);
  const pub = toPublicUser(created);
  await saveUserSession(pub);
  return { ok: true, user: pub };
}

export async function mobileChangePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: "Kata sandi baru minimal 6 karakter." };
  }
  const accounts = await loadLocalAccounts();
  const found = accounts.find((a) => a.id === userId);
  if (!found) {
    return { ok: false, error: "Akun tidak ditemukan di penyimpanan lokal." };
  }
  if (found.password !== oldPassword) {
    return { ok: false, error: "Kata sandi lama salah." };
  }
  found.password = newPassword;
  await saveLocalAccounts(accounts);
  return { ok: true };
}

// ==================== CLEARINGHOUSE STATE & OFFLINE QUEUE ====================

export async function loadClearinghouseData(
  serverUrl: string,
  isOfflineMode: boolean
): Promise<{ state: MobileClearinghouseState; source: "SERVER" | "LOCAL" }> {
  if (!isOfflineMode && serverUrl.trim()) {
    const res = await fetchWithTimeout(
      `${serverUrl.replace(/\/$/, "")}/api/clearinghouse`,
      { method: "GET" },
      1800
    );
    if (res && res.ok) {
      try {
        const data = (await res.json()) as Partial<MobileClearinghouseState>;
        if (
          Array.isArray(data.beneficiaries) &&
          data.beneficiaries.length >= 20 &&
          Array.isArray(data.merchants) &&
          data.merchants.length > 0
        ) {
          const normalized: MobileClearinghouseState = {
            pool_total_idr: data.pool_total_idr ?? 8500000,
            fraud_blocked_count: data.fraud_blocked_count ?? 0,
            beneficiaries: data.beneficiaries,
            merchants: data.merchants,
            vouchers: data.vouchers ?? [],
            ledger: data.ledger ?? [],
            commodity_catalog: data.commodity_catalog ?? [],
          };
          await saveLocalState(normalized);
          return { state: normalized, source: "SERVER" };
        }
      } catch {
        // fallback ke lokal
      }
    }
  }

  try {
    const raw = await AsyncStorage.getItem(KEYS.STATE);
    if (raw) {
      const parsed = JSON.parse(raw) as MobileClearinghouseState;
      if (
        parsed &&
        Array.isArray(parsed.beneficiaries) &&
        parsed.beneficiaries.length >= 20
      ) {
        return { state: parsed, source: "LOCAL" };
      }
    }
  } catch {
    // ignore
  }

  const seeded = buildMobileSeedState();
  await saveLocalState(seeded);
  return { state: seeded, source: "LOCAL" };
}

export async function saveLocalState(
  state: MobileClearinghouseState
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.STATE, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export async function loadOfflineQueue(): Promise<OfflineRedemptionItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE);
    return raw ? (JSON.parse(raw) as OfflineRedemptionItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(
  queue: OfflineRedemptionItem[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export async function loadRedeemedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.REDEEMED_IDS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveRedeemedIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.REDEEMED_IDS, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export async function resetAllMobileDemoData(): Promise<MobileClearinghouseState> {
  const seeded = buildMobileSeedState();
  try {
    await AsyncStorage.multiRemove([
      KEYS.STATE,
      KEYS.OFFLINE_QUEUE,
      KEYS.REDEEMED_IDS,
      KEYS.ACCOUNTS,
    ]);
    await AsyncStorage.setItem(KEYS.STATE, JSON.stringify(seeded));
    await AsyncStorage.setItem(
      KEYS.ACCOUNTS,
      JSON.stringify(DEFAULT_ACCOUNTS.map((a) => ({ ...a })))
    );
  } catch {
    // ignore
  }
  return seeded;
}
