"use client";

import React, { useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Store,
  Users,
  Sun,
  Moon,
  Type,
  Copy,
  Check,
  UserPlus,
  LogIn,
  X,
} from "lucide-react";
import { AuthRole, AuthUser } from "@/lib/types";
import { AppLang, UI_COPY } from "@/lib/i18n";
import styles from "./AuthHeading.module.css";
import AuthShowcase from "./AuthShowcase";

type AuthScreenMode = "LOGIN" | "RESET" | "REGISTER";
type ThemeMode = "light" | "dark";

interface AuthGateProps {
  lang: AppLang;
  theme: ThemeMode;
  largeText: boolean;
  onToggleLang: (next: AppLang) => void;
  onToggleTheme: (next: ThemeMode) => void;
  onToggleLargeText: (next: boolean) => void;
  onAuthenticated: (user: AuthUser) => void;
}

const DEMO_ACCOUNTS: Array<{
  titleId: string;
  titleEn: string;
  subtitle: string;
  email: string;
  phone: string;
  password: string;
  role: AuthRole;
  badgeId: string;
  badgeEn: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    titleId: "Pengurus Bansos",
    titleEn: "Community Organizer",
    subtitle: "St. Darwin Pasaribu · Koordinator Komunitas",
    email: "pengurus@civicledger.id",
    phone: "0811-6200-0101",
    password: "pengurus2026",
    role: "COORDINATOR",
    badgeId: "Portal Pengurus",
    badgeEn: "Organizer Portal",
    icon: Users,
  },
  {
    titleId: "Pemilik Toko / Kedai",
    titleEn: "Local Store Owner",
    subtitle: "Marta Br. Sihombing · Kasir Web & Scan Kamera QR",
    email: "kedai@civicledger.id",
    phone: "0812-6300-4821",
    password: "kedai2026",
    role: "MERCHANT",
    badgeId: "Kasir & Scan QR",
    badgeEn: "POS & QR Camera",
    icon: Store,
  },
];

export default function AuthGate({
  lang,
  theme,
  largeText,
  onToggleLang,
  onToggleTheme,
  onToggleLargeText,
  onAuthenticated,
}: AuthGateProps) {
  const t = UI_COPY[lang];
  const en = lang === "en";
  const demoDialog = useRef<HTMLDialogElement>(null);
  const formPanel = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<AuthScreenMode>("LOGIN");
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Login State
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Reset Password State
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetIdentifier, setResetIdentifier] = useState<string>("");
  const [resetAccountName, setResetAccountName] = useState<string>("");
  const [demoOtpBanner, setDemoOtpBanner] = useState<string>("");
  const [otpInput, setOtpInput] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [copiedOtp, setCopiedOtp] = useState<boolean>(false);

  // Register State
  const [regName, setRegName] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPhone, setRegPhone] = useState<string>("");
  const [regRole] = useState<AuthRole>("COORDINATOR");
  const [regPassword, setRegPassword] = useState<string>("");
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);

  const handleLoginSubmit = async (
    e?: React.FormEvent,
    overrideEmail?: string,
    overridePass?: string
  ) => {
    if (e) e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOGIN",
          identifier: overrideEmail ?? identifier,
          password: overridePass ?? password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Gagal masuk. Periksa lagi email dan sandi.",
        });
        return;
      }
      if (data.user?.role !== "COORDINATOR") {
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "LOGOUT" }),
        }).catch(() => {});
        setFeedback({
          type: "error",
          text: "Website ini khusus untuk Pengurus Bansos. Warga penerima & pemilik kedai silakan masuk lewat aplikasi HP CivicLedger.",
        });
        return;
      }
      if (data.user?.role !== "COORDINATOR" && data.user?.role !== "MERCHANT") {
        setFeedback({
          type: "info",
          text: en
            ? "Beneficiary accounts use the CivicLedger Mobile App to show their QR voucher. Organizers and Store Owners can sign in here."
            : "Akun Warga Penerima menggunakan Aplikasi Mobile CivicLedger di HP untuk menunjukkan QR kupon. Portal web ini untuk Pengurus & Pemilik Toko.",
        });
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setFeedback({
        type: "error",
        text: "Tidak bisa tersambung ke server lokal.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_RESET",
          identifier: resetIdentifier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Akun tidak ditemukan.",
        });
        return;
      }
      setResetAccountName(data.account_name);
      setDemoOtpBanner(data.demo_otp_code);
      setResetStep(2);
      setFeedback({
        type: "info",
        text: data.message,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Gagal meminta kode verifikasi.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword.length < 6) {
      setFeedback({
        type: "error",
        text: "Kata sandi baru minimal 6 karakter.",
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFeedback({
        type: "error",
        text: "Konfirmasi kata sandi tidak sama.",
      });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM_RESET",
          identifier: resetIdentifier,
          otp_code: otpInput,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Gagal mengganti kata sandi.",
        });
        return;
      }
      setIdentifier(data.user.email);
      setPassword("");
      setOtpInput("");
      setNewPassword("");
      setConfirmNewPassword("");
      setDemoOtpBanner("");
      setResetStep(1);
      setMode("LOGIN");
      setFeedback({
        type: "success",
        text: data.message,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Gagal menyimpan kata sandi baru.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (regPassword.length < 6) {
      setFeedback({
        type: "error",
        text: "Kata sandi minimal 6 karakter.",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REGISTER",
          name: regName,
          email: regEmail,
          phone: regPhone,
          role: regRole,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Pendaftaran gagal.",
        });
        return;
      }
      if (data.user?.role !== "COORDINATOR" && data.user?.role !== "MERCHANT") {
        setFeedback({
          type: "info",
          text: en
            ? "Beneficiary accounts use the CivicLedger Mobile App to show their QR voucher. Organizers and Store Owners can sign in here."
            : "Akun Warga Penerima menggunakan Aplikasi Mobile CivicLedger di HP untuk menunjukkan QR kupon. Portal web ini untuk Pengurus & Pemilik Toko.",
        });
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setFeedback({
        type: "error",
        text: "Tidak bisa tersambung ke server.",
      });
    } finally {
      setBusy(false);
    }
  };


  function switchMode(next: AuthScreenMode) {
    setFeedback(null);
    setMode(next);
    formPanel.current?.focus();
  }

  return (
    <main className={styles.shell} data-register={mode === "REGISTER"}>
      <AuthShowcase en={en} />
      <section className={styles.panel} ref={formPanel} tabIndex={-1} aria-label={en ? "Authentication" : "Autentikasi"}>
        <header className={styles.header}>
          <div className={styles.wordmark}><span aria-hidden="true">C</span> CivicLedger</div>
          <div className={styles.tools}>
            <button type="button" onClick={() => onToggleLang(en ? "id" : "en")} aria-label={en ? "Switch to Indonesian" : "Ganti ke bahasa Inggris"}>{en ? "ID" : "EN"}</button>
            <button type="button" onClick={() => onToggleLargeText(!largeText)} aria-label={en ? "Large text" : "Tulisan besar"} aria-pressed={largeText}><Type size={17} /></button>
            <button type="button" onClick={() => onToggleTheme(theme === "dark" ? "light" : "dark")} aria-label={en ? "Dark mode" : "Mode gelap"} aria-pressed={theme === "dark"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </header>
        <div className={styles.content}>
          {feedback && (
            <p className={styles.feedback} data-type={feedback.type} role={feedback.type === "error" ? "alert" : "status"}>
              {feedback.text}
            </p>
          )}
    {/* FORM MASUK */}
    {mode === "LOGIN" && (
      <form onSubmit={handleLoginSubmit} className={styles.form}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{t.auth.loginEyebrow}</p>
          <h2 className={styles.title}>
            <span className={styles.reveal}>
              {t.auth.loginHeading}{" "}
              <span className={styles.brand}>CivicLedger.</span>
            </span>
          </h2>
          <p className={styles.description}>{t.auth.loginSub}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auth-identifier" className="block text-xs font-semibold">
            {t.auth.emailPhoneLabel}
          </label>
          <input id="auth-identifier"
            type="text"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            className="w-full h-12 px-3.5 rounded-xl border text-sm outline-none transition"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password" className="block text-xs font-semibold">
              {t.auth.passLabel}
            </label>
            <button
              type="button"
              onClick={() => {
                setMode("RESET");
                setResetIdentifier(identifier);
                setResetStep(1);
                setFeedback(null);
              }}
              className="text-xs font-semibold hover:underline"
            >
              {t.auth.forgotLink}
            </button>
          </div>
          <div className="relative">
            <input id="auth-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full h-12 pl-3.5 pr-12 rounded-xl border text-sm outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5"
              aria-label={
                showPassword
                  ? (en ? "Hide password" : "Sembunyikan kata sandi")
                  : (en ? "Show password" : "Lihat kata sandi")
              }
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-12 rounded-xl hover:opacity-90 active:scale-[0.99] font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
        >
          <LogIn className="w-4 h-4" />
          <span>{busy ? t.auth.loginBusy : t.auth.loginBtn}</span>
        </button>
        <div className={styles.google}>
          <button type="button" disabled aria-describedby="google-status">
            <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M43.6 20H42V20H24v8h11.3A12 12 0 1 1 32 15l5.7-5.7A20 20 0 1 0 44 24c0-1.4-.1-2.7-.4-4Z" />
              <path fill="#34A853" d="M24 44c5.2 0 9.8-1.9 13.3-5l-6.2-5.1A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44Z" />
              <path fill="#FBBC05" d="m6.2 33 6.5-5a12 12 0 0 1 0-8l-6.5-5a20 20 0 0 0 0 18Z" />
              <path fill="#EA4335" d="M24 12c3 0 5.8 1.1 8 3l5.7-5.7A20 20 0 0 0 6.2 15l6.5 5A12 12 0 0 1 24 12Z" />
            </svg>
            {en ? "Sign in with Google" : "Masuk dengan Google"}
          </button>
          <p id="google-status">{en ? "Unavailable until Google Sign-In is configured." : "Belum tersedia. Google Sign-In perlu dikonfigurasi."}</p>
        </div>
      </form>
    )}

    {/* FORM RESET PASSWORD */}
    {mode === "RESET" && (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Reset Kata Sandi
            </h2>
            <p className="text-xs mt-0.5">
              Minta kode 6 angka lalu buat kata sandi baru.
            </p>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded-full font-semibold shrink-0">
            Tahap {resetStep}/2
          </span>
        </div>

        {resetStep === 1 ? (
          <form
            onSubmit={handleRequestResetOtp}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="auth-resetIdentifier" className="block text-xs font-semibold">
                Email atau Nomor HP Akun
              </label>
              <input id="auth-resetIdentifier"
                type="text"
                required
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="Contoh: warga@civicledger.id atau 0812-6311-4401"
                className="w-full h-12 px-3.5 rounded-xl border text-sm outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl hover:opacity-90 font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {busy ? "Mengirim kode..." : "Kirim Kode 6 Angka"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("LOGIN");
                setFeedback(null);
              }}
              className="w-full py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke halaman Masuk
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            {demoOtpBanner && (
              <div className="p-4 rounded-xl bg-amberTech/10 border border-amberTech/35 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amberTech">
                    Kode OTP Simulasi (Demo Lokal)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpInput(demoOtpBanner);
                      navigator.clipboard?.writeText(demoOtpBanner);
                      setCopiedOtp(true);
                      setTimeout(() => setCopiedOtp(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border text-[11px] font-semibold hover:"
                  >
                    {copiedOtp ? (
                      <>
                        <Check className="w-3 h-3" />
                        Terisi
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Isi Kode
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs">
                  Kode verifikasi untuk{" "}
                  <strong>{resetAccountName}</strong>:
                </p>
                <p className="font-mono text-2xl font-bold tracking-[0.22em]">
                  {demoOtpBanner}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="auth-otpInput" className="block text-xs font-semibold">
                1. Kode 6 Angka
              </label>
              <input id="auth-otpInput"
                type="text"
                required
                maxLength={6}
                value={otpInput}
                onChange={(e) =>
                  setOtpInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Masukkan 6 angka"
                className="w-full h-12 px-3.5 rounded-xl border font-mono text-lg font-bold tracking-[0.2em] placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="auth-newPassword" className="block text-xs font-semibold">
                2. Kata Sandi Baru (min. 6 karakter)
              </label>
              <div className="relative">
                <input id="auth-newPassword"
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contoh: balige2026"
                  className="w-full h-12 pl-3.5 pr-12 rounded-xl border text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="auth-confirmNewPassword" className="block text-xs font-semibold">
                3. Ketik Ulang Kata Sandi Baru
              </label>
              <input id="auth-confirmNewPassword"
                type={showNewPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmNewPassword}
                onChange={(e) =>
                  setConfirmNewPassword(e.target.value)
                }
                placeholder="Ketik ulang kata sandi baru"
                className="w-full h-12 px-3.5 rounded-xl border text-sm outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl hover:opacity-90 font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {busy ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setResetStep(1);
                setFeedback(null);
              }}
              className="w-full py-1.5 text-xs font-semibold"
            >
              Ganti email atau minta kode baru
            </button>
          </form>
        )}
      </div>
    )}

    {/* FORM DAFTAR */}
    {mode === "REGISTER" && (
      <form onSubmit={handleRegisterSubmit} className={styles.form}>
        <div>
          <h2 className="text-lg font-bold">
            {en ? "Create your account" : "Daftar Akun Baru"}
          </h2>
          <p className="text-xs mt-0.5">
            {en ? "Get started with CivicLedger." : "Isi data di bawah untuk membuat akun baru."}
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="auth-regName" className="block text-xs font-semibold">
            Nama Lengkap
          </label>
          <input id="auth-regName"
            type="text"
            required
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            placeholder="Contoh: Mangasi Simatupang"
            className="w-full h-11 px-3.5 rounded-xl border text-sm outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="auth-regEmail" className="block text-xs font-semibold">
              Email
            </label>
            <input id="auth-regEmail"
              type="email"
              required
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="nama@civicledger.id"
              className="w-full h-11 px-3.5 rounded-xl border text-sm outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="auth-regPhone" className="block text-xs font-semibold">
              Nomor HP
            </label>
            <input id="auth-regPhone"
              type="text"
              required
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              placeholder="0812-6300-1234"
              className="w-full h-11 px-3.5 rounded-xl border text-sm outline-none"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl border text-xs">
          Pendaftaran melalui portal web otomatis membuat akun{" "}
          <strong className="">Pengurus Bansos</strong>.
          Untuk Warga Penerima dan Pemilik Kedai, silakan mendaftar
          lewat aplikasi HP CivicLedger.
        </div>

        <div className="space-y-1">
          <label htmlFor="auth-regPassword" className="block text-xs font-semibold">
            Kata Sandi (min. 6 karakter)
          </label>
          <div className="relative">
            <input id="auth-regPassword"
              type={showRegPassword ? "text" : "password"}
              required
              minLength={6}
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="Buat kata sandi"
              className="w-full h-11 pl-3.5 pr-12 rounded-xl border text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowRegPassword(!showRegPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5"
            >
              {showRegPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-12 rounded-xl hover:opacity-90 font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>{busy ? "Mendaftar..." : "Daftar & Masuk"}</span>
        </button>
      </form>
    )}

          {mode !== "RESET" && (
            <p className={styles.switch}>
              {mode === "LOGIN" ? (en ? "New to CivicLedger?" : "Belum punya akun?") : (en ? "Already have an account?" : "Sudah punya akun?")}{" "}
              <button type="button" onClick={() => switchMode(mode === "LOGIN" ? "REGISTER" : "LOGIN")}>
                {mode === "LOGIN" ? t.auth.tabRegister : t.auth.tabLogin}
              </button>
            </p>
          )}
          <button className={styles.demoLink} type="button" onClick={() => demoDialog.current?.showModal()}>
            {en ? "Try a demo account" : "Coba akun demo"}
          </button>
        </div>
      </section>
      <dialog ref={demoDialog} className={styles.dialog} aria-labelledby="demo-title">
        <div className={styles.dialogHeader}>
          <h2 id="demo-title">{en ? "Demo accounts" : "Akun demo"}</h2>
          <button type="button" onClick={() => demoDialog.current?.close()} aria-label={en ? "Close" : "Tutup"}><X size={20} /></button>
        </div>
        {DEMO_ACCOUNTS.map((acc) => (
          <article key={acc.email} className={styles.demoAccount}>
            <div><strong>{en ? acc.titleEn : acc.titleId}</strong><br /><code>{acc.email}</code></div>
            <div className={styles.demoActions}>
              <button type="button" onClick={() => {
                demoDialog.current?.close();
                setIdentifier(acc.email);
                setPassword(acc.password);
                switchMode("LOGIN");
              }}>{t.auth.fillBtn}</button>
              <button type="button" disabled={busy} onClick={() => {
                demoDialog.current?.close();
                switchMode("LOGIN");
                void handleLoginSubmit(undefined, acc.email, acc.password);
              }}>{t.auth.loginBtn}</button>
            </div>
          </article>
        ))}
        <p className={styles.mobileDemo}>
          {en ? "Mobile app demo accounts" : "Akun demo aplikasi HP"}<br />
          <code>warga@civicledger.id (warga2026)</code><br />
          <code>kedai@civicledger.id (kedai2026)</code>
        </p>
      </dialog>
    </main>
  );
}
