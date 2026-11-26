"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  WifiOff,
  QrCode,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  UserCheck,
  Store,
  Users,
  Sun,
  Moon,
  Type,
  Copy,
  Check,
  UserPlus,
  LogIn,
} from "lucide-react";
import { AuthRole, AuthUser } from "@/lib/types";
import { AppLang, UI_COPY } from "@/lib/i18n";
import BrandLogo from "@/components/BrandLogo";
import styles from "./AuthHeading.module.css";

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

  return (
    <div className="min-h-screen bg-canvas text-ink-body flex flex-col">
      {/* Bar Atas */}
      <header className="w-full border-b border-line/60 bg-surface/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo size={38} className="shrink-0 shadow-sm rounded-xl" />
            <div>
              <span className="font-bold text-base tracking-[-0.015em] text-ink-primary block leading-tight">
                CivicLedger
              </span>
              <span className="text-xs text-ink-muted">
                {t.brandSub}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex bg-nested p-0.5 rounded-lg border border-line">
              <button
                type="button"
                onClick={() => onToggleLang("id")}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition ${
                  lang === "id"
                    ? "bg-card text-ink-primary shadow-sm"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => onToggleLang("en")}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition ${
                  lang === "en"
                    ? "bg-card text-ink-primary shadow-sm"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => onToggleLargeText(!largeText)}
              title={en ? "Toggle text size" : "Ubah ukuran tulisan"}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                largeText
                  ? "bg-cta-bg text-cta-ink border-cta-bg"
                  : "bg-card hover:bg-nested text-ink-primary border-line"
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {largeText ? t.largeTextOn : t.largeTextOff}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onToggleTheme(theme === "dark" ? "light" : "dark")}
              title={en ? "Switch theme" : "Ganti tema layar"}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-nested border border-line text-xs font-semibold text-ink-primary transition"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amberTech" />
                  <span className="hidden sm:inline">{t.dayMode}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-ink-muted" />
                  <span className="hidden sm:inline">{t.nightMode}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Konten 2 Kolom */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* KOLOM KIRI */}
          <div className="lg:col-span-6 space-y-6 lg:pt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emeraldTech/12 border border-emeraldTech/30 text-emeraldTech text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emeraldTech" />
              <span>{t.auth.badge}</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-ink-primary leading-tight">
                {t.auth.heroLine1}{" "}
                <span className="text-emeraldTech">{t.auth.heroAccent}</span>
              </h1>
              <p className="text-[15px] text-ink-secondary leading-relaxed max-w-xl">
                {t.auth.heroDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3.5">
              <div className="p-4 rounded-xl bg-card border border-line/70 shadow-sm flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emeraldTech/12 text-emeraldTech flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">
                    {t.auth.feat1Title}
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                    {t.auth.feat1Desc}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-line/70 shadow-sm flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amberTech/12 text-amberTech flex items-center justify-center shrink-0">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">
                    {t.auth.feat2Title}
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                    {t.auth.feat2Desc}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-line/70 shadow-sm flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emeraldTech/12 text-emeraldTech flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">
                    {t.auth.feat3Title}
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                    {t.auth.feat3Desc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-card border border-line/80 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-nested border border-line/50">
                <button
                  type="button"
                  onClick={() => {
                    setMode("LOGIN");
                    setFeedback(null);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold transition ${
                    mode === "LOGIN"
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("RESET");
                    setResetStep(1);
                    setFeedback(null);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold transition ${
                    mode === "RESET"
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  Lupa Sandi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("REGISTER");
                    setFeedback(null);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold transition ${
                    mode === "REGISTER"
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  Daftar
                </button>
              </div>

              {feedback && (
                <div
                  className={`p-3.5 rounded-xl border text-[13px] flex items-start gap-2.5 leading-relaxed ${
                    feedback.type === "success"
                      ? "bg-emeraldTech/10 border-emeraldTech/35 text-emeraldTech"
                      : feedback.type === "error"
                        ? "bg-roseTech/10 border-roseTech/35 text-roseTech"
                        : "bg-amberTech/10 border-amberTech/35 text-amberTech"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-medium">{feedback.text}</span>
                </div>
              )}

              {/* FORM MASUK */}
              {mode === "LOGIN" && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                    <label className="block text-xs font-semibold text-ink-primary">
                      Email atau Nomor HP
                    </label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Contoh: pengurus@civicledger.id atau 0811-6200-0101"
                      className="w-full h-12 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-ink-primary">
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("RESET");
                          setResetIdentifier(identifier);
                          setResetStep(1);
                          setFeedback(null);
                        }}
                        className="text-xs font-semibold text-emeraldTech hover:underline"
                      >
                        Lupa kata sandi?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi"
                        className="w-full h-12 pl-3.5 pr-12 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted hover:text-ink-primary"
                        aria-label={
                          showPassword
                            ? "Sembunyikan kata sandi"
                            : "Lihat kata sandi"
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
                    className="w-full h-12 rounded-xl bg-cta-bg hover:opacity-90 active:scale-[0.99] text-cta-ink font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{busy ? "Memeriksa..." : "Masuk"}</span>
                  </button>
                </form>
              )}

              {/* FORM RESET PASSWORD */}
              {mode === "RESET" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-emeraldTech" />
                        Reset Kata Sandi
                      </h2>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Minta kode 6 angka lalu buat kata sandi baru.
                      </p>
                    </div>
                    <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-nested text-ink-primary font-semibold shrink-0">
                      Tahap {resetStep}/2
                    </span>
                  </div>

                  {resetStep === 1 ? (
                    <form
                      onSubmit={handleRequestResetOtp}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-ink-primary">
                          Email atau Nomor HP Akun
                        </label>
                        <input
                          type="text"
                          required
                          value={resetIdentifier}
                          onChange={(e) => setResetIdentifier(e.target.value)}
                          placeholder="Contoh: warga@civicledger.id atau 0812-6311-4401"
                          className="w-full h-12 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none transition"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full h-12 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
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
                        className="w-full py-2 text-xs font-semibold text-ink-muted hover:text-ink-primary flex items-center justify-center gap-1.5"
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-line text-[11px] font-semibold text-ink-primary hover:bg-nested"
                            >
                              {copiedOtp ? (
                                <>
                                  <Check className="w-3 h-3 text-emeraldTech" />
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
                          <p className="text-xs text-ink-secondary">
                            Kode verifikasi untuk{" "}
                            <strong>{resetAccountName}</strong>:
                          </p>
                          <p className="font-mono text-2xl font-bold tracking-[0.22em] text-ink-primary">
                            {demoOtpBanner}
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-ink-primary">
                          1. Kode 6 Angka
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otpInput}
                          onChange={(e) =>
                            setOtpInput(e.target.value.replace(/[^0-9]/g, ""))
                          }
                          placeholder="Masukkan 6 angka"
                          className="w-full h-12 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg font-mono text-lg font-bold tracking-[0.2em] text-ink-primary placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-ink-primary">
                          2. Kata Sandi Baru (min. 6 karakter)
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Contoh: balige2026"
                            className="w-full h-12 pl-3.5 pr-12 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted hover:text-ink-primary"
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
                        <label className="block text-xs font-semibold text-ink-primary">
                          3. Ketik Ulang Kata Sandi Baru
                        </label>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={confirmNewPassword}
                          onChange={(e) =>
                            setConfirmNewPassword(e.target.value)
                          }
                          placeholder="Ketik ulang kata sandi baru"
                          className="w-full h-12 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full h-12 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
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
                        className="w-full py-1.5 text-xs font-semibold text-ink-muted hover:text-ink-primary"
                      >
                        Ganti email atau minta kode baru
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* FORM DAFTAR */}
              {mode === "REGISTER" && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <h2 className="text-lg font-bold text-ink-primary">
                      Daftar Akun Baru
                    </h2>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Isi data di bawah untuk membuat akun baru.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-ink-primary">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Contoh: Mangasi Simatupang"
                      className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-ink-primary">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="nama@civicledger.id"
                        className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-ink-primary">
                        Nomor HP
                      </label>
                      <input
                        type="text"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0812-6300-1234"
                        className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emeraldTech/10 border border-emeraldTech/25 text-xs text-ink-secondary">
                    Pendaftaran melalui portal web otomatis membuat akun{" "}
                    <strong className="text-emeraldTech">Pengurus Bansos</strong>.
                    Untuk Warga Penerima dan Pemilik Kedai, silakan mendaftar
                    lewat aplikasi HP CivicLedger.
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-ink-primary">
                      Kata Sandi (min. 6 karakter)
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Buat kata sandi"
                        className="w-full h-11 pl-3.5 pr-12 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted hover:text-ink-primary"
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
                    className="w-full h-12 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{busy ? "Mendaftar..." : "Daftar & Masuk"}</span>
                  </button>
                </form>
              )}
            </div>

            {/* Akun Demo Pengurus */}
            <div className="bg-card border border-line/75 rounded-2xl p-5 space-y-3 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  {t.auth.primaryWebTitle}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                  {t.auth.primaryWebDesc}
                </p>
              </div>

              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <div
                      key={acc.email}
                      className="p-3.5 rounded-xl bg-surface border border-emeraldTech/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-bold text-ink-primary">
                              {en ? acc.titleEn : acc.titleId}
                            </span>
                            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emeraldTech/12 text-emeraldTech">
                              {en ? acc.badgeEn : acc.badgeId}
                            </span>
                          </div>
                          <p className="text-xs text-ink-secondary truncate">
                            {acc.subtitle}
                          </p>
                          <p className="font-mono text-[11px] text-ink-muted mt-0.5">
                            {acc.email} · {en ? "pass:" : "sandi:"}{" "}
                            <strong>{acc.password}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setMode("LOGIN");
                            setIdentifier(acc.email);
                            setPassword(acc.password);
                            setFeedback(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-nested hover:bg-elevated text-xs font-semibold text-ink-primary transition"
                        >
                          {t.auth.fillBtn}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleLoginSubmit(undefined, acc.email, acc.password)
                          }
                          className="px-3 py-1.5 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold transition"
                        >
                          {t.auth.loginBtn}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2.5 border-t border-line/50 text-xs text-ink-muted leading-relaxed space-y-1">
                <p>
                  <strong className="text-ink-primary">
                    {en ? "Field Users (Mobile App):" : "Pengguna Lapangan (Aplikasi HP):"}
                  </strong>{" "}
                  {en
                    ? "Beneficiaries and Local Merchants use the CivicLedger Mobile App (Expo / React Native)."
                    : "Warga penerima bansos & pemilik kedai sembako masuk melalui Aplikasi Mobile CivicLedger di HP."}
                </p>
                <p className="font-mono text-[11px]">
                  {en ? "Mobile Demo:" : "Akun Mobile:"} warga@civicledger.id (warga2026) · kedai@civicledger.id (kedai2026)
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
