"use client";

import React from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImageUp,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  AuthUser,
  BatchSyncResultItem,
  LedgerEntry,
  Merchant,
  OfflineRedemptionQueueItem,
  Voucher,
} from "@/lib/types";
import { encodeVoucherToQRPayload } from "@/lib/crypto";
import { AppLang } from "@/lib/i18n";
import {
  CryptoVerificationTrace,
  formatOutcomeLabel,
  formatRupiah,
  formatShortTime,
  formatStatusLabel,
} from "@/lib/formatters";

interface MerchantPosTabProps {
  lang: AppLang;
  currentUser: AuthUser;
  realtimeConnected: boolean;
  isOfflineMode: boolean;
  cameraActive: boolean;
  cameraDetectSupported: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  merchants: Merchant[];
  activeMerchantId: string;
  setActiveMerchantId: (id: string) => void;
  vouchers: Voucher[];
  scannerInputCode: string;
  setScannerInputCode: (code: string) => void;
  setScannedQRPayloadRaw: (raw: string) => void;
  isCodeFormatValid: boolean;
  cryptoTrace: CryptoVerificationTrace | null;
  setCryptoTrace: (t: CryptoVerificationTrace | null) => void;
  showVerifierTechDetails: boolean;
  setShowVerifierTechDetails: (v: boolean) => void;
  offlineQueue: OfflineRedemptionQueueItem[];
  isSyncingBatch: boolean;
  fraudBlockedCount: number;
  ledger: LedgerEntry[];
  lastSyncResults: BatchSyncResultItem[] | null;
  setLastSyncResults: (r: BatchSyncResultItem[] | null) => void;
  onToggleCamera: () => void;
  onUploadQrFile: (file: File) => void;
  onVerifyAndRedeem: (simulateTamperFraud: boolean) => void;
  onSimulateOfflineConflict: () => void;
  onSyncOfflineBatch: () => void;
}

export default function MerchantPosTab({
  lang,
  currentUser,
  realtimeConnected,
  isOfflineMode,
  cameraActive,
  cameraDetectSupported,
  videoRef,
  merchants,
  activeMerchantId,
  setActiveMerchantId,
  vouchers,
  scannerInputCode,
  setScannerInputCode,
  setScannedQRPayloadRaw,
  isCodeFormatValid,
  cryptoTrace,
  setCryptoTrace,
  showVerifierTechDetails,
  setShowVerifierTechDetails,
  offlineQueue,
  isSyncingBatch,
  fraudBlockedCount,
  ledger,
  lastSyncResults,
  setLastSyncResults,
  onToggleCamera,
  onUploadQrFile,
  onVerifyAndRedeem,
  onSimulateOfflineConflict,
  onSyncOfflineBatch,
}: MerchantPosTabProps) {
  const en = lang === "en";
  const isMerchantRole = currentUser.role === "MERCHANT";
  const activeMerchant =
    merchants.find((m) => m.id === activeMerchantId) || merchants[0];
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-5">
      {/* Banner Toko untuk Pemilik Toko */}
      {isMerchantRole && activeMerchant && (
        <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emeraldTech/12 text-emeraldTech flex items-center justify-center shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-ink-primary">
                  {activeMerchant.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emeraldTech/12 text-emeraldTech text-[11px] font-bold">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      realtimeConnected
                        ? "bg-emeraldTech animate-pulse"
                        : "bg-amberTech"
                    }`}
                  />
                  {realtimeConnected
                    ? en
                      ? "Realtime DB Live"
                      : "Database Realtime"
                    : en
                      ? "Offline Ready"
                      : "Mode Offline"}
                </span>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                {activeMerchant.owner} · {activeMerchant.rt_rw} ·{" "}
                {activeMerchant.bank_account}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-line/45">
            <div>
              <p className="text-[11px] text-ink-muted">
                {en ? "Unsettled" : "Belum Cair"}
              </p>
              <p className="font-mono text-base font-bold text-emeraldTech tabular-nums">
                {formatRupiah(activeMerchant.unsettled_balance_idr)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-ink-muted">
                {en ? "Settled" : "Sudah Cair"}
              </p>
              <p className="font-mono text-base font-bold text-ink-primary tabular-nums">
                {formatRupiah(activeMerchant.total_settled_idr)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-ink-muted">
                {en ? "Redeemed" : "Kupon"}
              </p>
              <p className="font-mono text-base font-bold text-ink-primary tabular-nums">
                {activeMerchant.redemption_count}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      <div className="xl:col-span-6 flex flex-col gap-4">
        <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-line/50">
            <div>
              <h2 className="text-base font-bold text-ink-primary flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-emeraldTech" />
                {en ? "Scan & Accept Beneficiary QR" : "Scan QR & Terima Kupon"}
              </h2>
              <p className="text-xs text-ink-secondary mt-1">
                {en
                  ? "Open camera to scan the beneficiary's QR code directly, upload a QR image, or enter the code."
                  : "Buka kamera untuk langsung scan QR kupon penerima, unggah foto QR, atau ketik kode kuponnya."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadQrFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-nested hover:bg-elevated text-ink-primary border border-line/60 text-xs font-semibold transition"
                title={en ? "Decode QR from image" : "Scan QR dari foto/gambar"}
              >
                <ImageUp className="w-4 h-4 text-amberTech" />
                <span>{en ? "Upload QR" : "Foto QR"}</span>
              </button>
              <button
                type="button"
                onClick={onToggleCamera}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                  cameraActive
                    ? "bg-roseTech text-white hover:opacity-90"
                    : "bg-cta-bg text-cta-ink hover:opacity-90"
                }`}
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-4 h-4" />
                    <span>{en ? "Stop Camera" : "Tutup Kamera"}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>{en ? "Open QR Camera" : "Buka Kamera QR"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {cameraActive && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2 border-emeraldTech/60 shadow-md">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-emeraldTech relative flex items-center justify-center rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <span className="px-2.5 py-1 rounded bg-black/80 font-mono text-[10px] text-white uppercase tracking-wider">
                    {en ? "Point at Beneficiary QR" : "Arahkan ke QR Penerima"}
                  </span>
                </div>
              </div>
              <div className="absolute bottom-2.5 left-3 px-2.5 py-1 rounded-lg bg-black/80 text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {cameraDetectSupported
                  ? en
                    ? "Live QR Scanner Active (Auto-Verify)"
                    : "Scanner QR Aktif (Otomatis Cek)"
                  : en
                    ? "Camera active"
                    : "Kamera aktif"}
              </div>
            </div>
          )}

          {!isMerchantRole && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink-primary">
                {en ? "1. Select Partner Stall" : "1. Pilih Kedai"}
              </label>
              <div className="relative">
                <select
                  value={activeMerchantId}
                  onChange={(e) => setActiveMerchantId(e.target.value)}
                  className="w-full h-12 px-3.5 pr-9 bg-surface text-ink-primary border border-line rounded-xl appearance-none text-sm font-semibold focus:outline-none focus:border-cta-bg cursor-pointer"
                >
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.owner}) · {en ? "Unsettled" : "Belum Cair"}{" "}
                      {formatRupiah(m.unsettled_balance_idr)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-primary">
                {en ? "2. Quick-Select Voucher" : "2. Pilih Cepat Kupon"}
              </span>
              <span className="font-mono text-xs text-ink-muted tabular-nums">
                {vouchers.length} {en ? "vouchers" : "kupon"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {vouchers.map((v) => {
                const selected = scannerInputCode === v.short_code;
                const isActive = v.status === "ACTIVE";
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setScannerInputCode(v.short_code);
                      setScannedQRPayloadRaw(encodeVoucherToQRPayload(v));
                      setCryptoTrace(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border transition ${
                      selected
                        ? "bg-cta-bg text-cta-ink border-cta-bg font-bold shadow-sm"
                        : isActive
                          ? "bg-surface hover:bg-nested text-ink-primary border-line/70 font-semibold"
                          : "bg-nested/50 text-ink-muted border-line/40 opacity-85 hover:opacity-100"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selected
                          ? "bg-cta-ink"
                          : isActive
                            ? "bg-emeraldTech"
                            : "bg-ink-muted"
                      }`}
                    />
                    <span>{v.short_code}</span>
                    <span
                      className={`text-[11px] font-sans ${
                        selected ? "text-cta-ink/90" : "text-ink-muted"
                      }`}
                    >
                      · {formatStatusLabel(v.status, lang)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-ink-primary">
                {en ? "3. Voucher Code" : "3. Kode Kupon"}
              </label>
              <span className="font-mono text-xs text-ink-muted">
                {en ? "Example: CL-8841-K9" : "Contoh: CL-8841-K9"}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={scannerInputCode}
                onChange={(e) => {
                  setScannerInputCode(e.target.value.toUpperCase());
                  setScannedQRPayloadRaw("");
                }}
                placeholder={
                  en ? "Enter voucher code..." : "Ketik kode kupon..."
                }
                className="w-full h-12 px-4 pr-28 rounded-xl bg-surface border-2 border-line focus:border-cta-bg font-mono text-lg font-bold tracking-wider uppercase text-ink-primary placeholder:text-ink-muted/70 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-normal outline-none"
              />
              {scannerInputCode.trim().length > 0 && (
                <span
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    isCodeFormatValid
                      ? "bg-emeraldTech/15 text-emeraldTech"
                      : "bg-nested text-ink-muted"
                  }`}
                >
                  {isCodeFormatValid
                    ? en
                      ? "Valid"
                      : "Cocok"
                    : en
                      ? "Check"
                      : "Cek Kode"}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onVerifyAndRedeem(false)}
            className="w-full h-12 rounded-xl bg-cta-bg hover:opacity-90 active:scale-[0.99] text-cta-ink text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>
              {isOfflineMode
                ? en
                  ? "Verify & Buffer Offline"
                  : "Cek & Simpan Offline"
                : en
                  ? "Verify & Redeem Voucher"
                  : "Cek & Terima Kupon"}
            </span>
          </button>

          <div className="pt-3 border-t border-line/45 space-y-2.5">
            <p className="text-xs font-bold text-ink-secondary">
              {en ? "Security & Conflict Lab" : "Simulasi Pengujian"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onVerifyAndRedeem(true)}
                className="h-11 px-3 rounded-xl bg-roseTech/10 hover:bg-roseTech/18 border border-roseTech/35 text-roseTech text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{en ? "Test Tampered Fraud" : "Tes Kupon Palsu"}</span>
              </button>
              <button
                type="button"
                onClick={onSimulateOfflineConflict}
                className="h-11 px-3 rounded-xl bg-amberTech/10 hover:bg-amberTech/18 border border-amberTech/35 text-amberTech text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{en ? "Test Duplicate Claim" : "Tes Kupon Ganda"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Mini KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-muted">
              {en ? "Offline Queue" : "Antrean Offline"}
            </span>
            <span className="font-mono text-xl font-bold text-ink-primary tabular-nums">
              {offlineQueue.length}
            </span>
            <span
              className={`text-xs font-semibold ${
                offlineQueue.length > 0 ? "text-amberTech" : "text-emeraldTech"
              }`}
            >
              {offlineQueue.length > 0
                ? en
                  ? "Pending sync"
                  : "Belum terkirim"
                : en
                  ? "All synced"
                  : "Terkirim semua"}
            </span>
          </div>
          <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-muted">
              {en ? "Fraud Blocked" : "Kupon Ditolak"}
            </span>
            <span className="font-mono text-xl font-bold text-emeraldTech tabular-nums">
              {fraudBlockedCount}
            </span>
            <span className="text-xs text-ink-muted">
              {en ? "Forged / Dup" : "Palsu / ganda"}
            </span>
          </div>
          <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-muted">
              {en ? "Committed" : "Tercatat"}
            </span>
            <span className="font-mono text-xl font-bold text-ink-primary tabular-nums">
              {ledger.length}
            </span>
            <span className="text-xs text-ink-muted">
              {en ? "Transactions" : "Total transaksi"}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT: Verdict & Offline Queue */}
      <div className="xl:col-span-6 flex flex-col gap-4">
        <div className="bg-card rounded-2xl border border-line/75 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-line/50 bg-surface/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emeraldTech" />
              <h3 className="text-base font-bold text-ink-primary">
                {en ? "Verification Verdict" : "Hasil Pengecekan"}
              </h3>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isOfflineMode
                  ? "bg-amberTech/12 text-amberTech"
                  : "bg-emeraldTech/12 text-emeraldTech"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOfflineMode ? "bg-amberTech" : "bg-emeraldTech"
                }`}
              />
              {isOfflineMode ? "Offline" : "Online"}
            </span>
          </div>

          <div className="p-5">
            {cryptoTrace ? (
              <div className="space-y-4">
                {cryptoTrace.hmacValid && cryptoTrace.doubleSpendCheckPassed ? (
                  <div className="p-4 rounded-xl bg-emeraldTech/10 border-2 border-emeraldTech/40 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cta-bg text-cta-ink text-xs font-bold uppercase">
                        <CheckCircle2 className="w-4 h-4" />
                        {cryptoTrace.mode === "OFFLINE_INDEXEDDB"
                          ? en
                            ? "Valid · Buffered Offline"
                            : "Kupon Sah · Simpan Offline"
                          : en
                            ? "Voucher Valid"
                            : "Kupon Sah"}
                      </span>
                      <span className="font-mono text-xs text-ink-secondary tabular-nums">
                        {cryptoTrace.durationMs} ms
                      </span>
                    </div>
                    <p className="text-sm text-ink-primary leading-relaxed">
                      {en ? "Verified package: " : "Kupon cocok. Barang: "}
                      <strong>{cryptoTrace.commodityName}</strong> (
                      {formatRupiah(cryptoTrace.nominalIdr)}){" "}
                      {en ? "for " : "untuk "}
                      <strong>{cryptoTrace.beneficiaryName}</strong>.
                    </p>
                    <p className="text-xs text-ink-secondary">
                      {cryptoTrace.mode === "OFFLINE_INDEXEDDB"
                        ? en
                          ? "Buffered in IndexedDB. Sync once connection returns."
                          : "Catatan disimpan di perangkat. Kirim ke pusat saat sinyal ada."
                        : en
                          ? "Merchant balance updated automatically."
                          : "Saldo kedai bertambah otomatis."}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-roseTech/10 border-2 border-roseTech/45 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-roseTech text-white text-xs font-bold uppercase">
                        <ShieldAlert className="w-4 h-4" />
                        {!cryptoTrace.hmacValid
                          ? en
                            ? "Rejected (Tampered)"
                            : "Kupon Ditolak (Palsu)"
                          : en
                            ? "Rejected (Duplicate)"
                            : "Kupon Ditolak (Sudah Dipakai)"}
                      </span>
                      <span className="font-mono text-xs text-ink-secondary tabular-nums">
                        {cryptoTrace.durationMs} ms
                      </span>
                    </div>
                    <p className="text-sm text-roseTech leading-relaxed font-semibold">
                      {en ? "Rejected. " : "Kupon ditolak. "}
                      {cryptoTrace.errorReason}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-surface border border-line/60">
                    <p className="text-ink-muted">
                      {en ? "Signature" : "Keaslian"}
                    </p>
                    <p
                      className={`font-bold mt-0.5 ${
                        cryptoTrace.hmacValid
                          ? "text-emeraldTech"
                          : "text-roseTech"
                      }`}
                    >
                      {cryptoTrace.hmacValid
                        ? en
                          ? "Authentic"
                          : "Asli"
                        : en
                          ? "Mismatch"
                          : "Tidak Cocok"}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface border border-line/60">
                    <p className="text-ink-muted">
                      {en ? "Single-Use" : "Pemakaian"}
                    </p>
                    <p
                      className={`font-bold mt-0.5 ${
                        cryptoTrace.doubleSpendCheckPassed
                          ? "text-emeraldTech"
                          : "text-roseTech"
                      }`}
                    >
                      {cryptoTrace.doubleSpendCheckPassed
                        ? en
                          ? "Unused"
                          : "Belum Dipakai"
                        : en
                          ? "Already Used"
                          : "Sudah Dipakai"}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface border border-line/60">
                    <p className="text-ink-muted">
                      {en ? "Validity" : "Masa Berlaku"}
                    </p>
                    <p
                      className={`font-bold mt-0.5 ${
                        cryptoTrace.expiryCheckPassed
                          ? "text-emeraldTech"
                          : "text-roseTech"
                      }`}
                    >
                      {cryptoTrace.expiryCheckPassed
                        ? en
                          ? "Active"
                          : "Berlaku"
                        : en
                          ? "Expired"
                          : "Habis"}
                    </p>
                  </div>
                </div>

                <div className="border border-line/60 rounded-xl bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setShowVerifierTechDetails(!showVerifierTechDetails)
                    }
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-ink-secondary hover:text-ink-primary transition"
                  >
                    <span className="font-mono text-[11px]">
                      {en
                        ? "Technical Trace (Web Crypto HMAC-SHA256)"
                        : "Detail Teknis (Web Crypto HMAC-SHA256)"}
                    </span>
                    {showVerifierTechDetails ? (
                      <ChevronUp className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    )}
                  </button>

                  {showVerifierTechDetails && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-line/45 font-mono text-[11px] space-y-2 text-ink-secondary">
                      <div className="flex justify-between gap-4">
                        <span className="text-ink-muted shrink-0">
                          CLIENT_TX_ID
                        </span>
                        <span className="text-ink-primary truncate">
                          {cryptoTrace.clientTxId}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-ink-muted shrink-0">PAYLOAD</span>
                        <span className="truncate">
                          {cryptoTrace.canonicalMessage}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-ink-muted shrink-0">
                          PROVIDED_SIG
                        </span>
                        <span className="truncate">
                          {cryptoTrace.providedSignature}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-ink-muted shrink-0">
                          COMPUTED_HMAC
                        </span>
                        <span
                          className={`truncate ${
                            cryptoTrace.hmacValid
                              ? "text-emeraldTech"
                              : "text-roseTech"
                          }`}
                        >
                          {cryptoTrace.computedSignature}
                        </span>
                      </div>
                      {cryptoTrace.receiptHash && (
                        <div className="flex justify-between gap-4 pt-1.5 border-t border-line/40">
                          <span className="text-ink-muted shrink-0">
                            RECEIPT_SHA256
                          </span>
                          <span className="text-ink-primary truncate">
                            {cryptoTrace.receiptHash}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 px-4 text-center bg-surface rounded-xl border border-line/50 space-y-2">
                <ShieldCheck className="w-7 h-7 text-emeraldTech mx-auto" />
                <p className="text-sm font-bold text-ink-primary">
                  {en
                    ? "No voucher verified yet"
                    : "Belum ada kupon yang dicek"}
                </p>
                <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                  {en
                    ? "Select or enter a voucher code on the left, then click Verify & Redeem."
                    : "Pilih atau ketik kode kupon di kiri, lalu klik Cek & Terima Kupon."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Offline Queue */}
        <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink-primary">
                {en ? "Local Offline Queue" : "Catatan Offline di Perangkat"}
              </h3>
              <span
                className={`font-mono text-xs px-2.5 py-0.5 rounded-full tabular-nums font-semibold ${
                  offlineQueue.length > 0
                    ? "bg-amberTech/15 text-amberTech"
                    : "bg-nested text-ink-secondary"
                }`}
              >
                {offlineQueue.length} {en ? "Pending" : "Antrean"}
              </span>
            </div>
            {offlineQueue.length > 0 && (
              <button
                type="button"
                onClick={onSyncOfflineBatch}
                disabled={isSyncingBatch}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold transition shadow-sm"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                />
                <span>
                  {en ? "Batch Sync to Server" : "Kirim Semua ke Pusat"}
                </span>
              </button>
            )}
          </div>

          {offlineQueue.length === 0 ? (
            <div className="bg-surface border border-line/50 rounded-xl p-5 text-center flex flex-col items-center gap-1.5">
              <CheckCircle2 className="w-6 h-6 text-emeraldTech" />
              <p className="text-sm font-semibold text-ink-primary">
                {en ? "Offline queue is clear." : "Antrean kosong."}
              </p>
              <p className="text-xs text-ink-secondary">
                {en
                  ? "Switch Signal to Offline on the sidebar to simulate transactions without internet."
                  : "Ubah tombol Sinyal di kiri menjadi Offline untuk mencoba transaksi tanpa internet."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto">
              {offlineQueue.map((item) => (
                <div
                  key={item.queue_id}
                  className="p-3.5 rounded-xl bg-surface border border-line/60 border-l-4 border-l-amberTech flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-ink-primary">
                        {item.short_code}
                      </span>
                      {item.is_simulated_conflict && (
                        <span className="px-2 py-0.5 rounded-full bg-roseTech/15 text-roseTech font-mono text-[10px] font-bold">
                          {en ? "CONFLICT TEST" : "TES GANDA"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-secondary mt-0.5 truncate">
                      {item.merchant_name} · {formatShortTime(item.redeemed_at)}{" "}
                      WIB
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-ink-primary tabular-nums">
                      {formatRupiah(item.nominal_idr)}
                    </p>
                    <span className="text-[11px] font-semibold text-amberTech">
                      {en ? "Waiting signal" : "Menunggu sinyal"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Sync / Ledger */}
        <div className="bg-card rounded-2xl border border-line/75 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line/50 bg-surface/60 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-primary">
              {lastSyncResults && lastSyncResults.length > 0
                ? en
                  ? "Batch Sync Results"
                  : "Hasil Kirim Offline"
                : en
                  ? "Recent Transactions"
                  : "Transaksi Terbaru"}
            </h3>
            {lastSyncResults && lastSyncResults.length > 0 ? (
              <button
                type="button"
                onClick={() => setLastSyncResults(null)}
                className="text-xs font-semibold text-ink-muted hover:text-ink-primary"
              >
                {en ? "Dismiss" : "Tutup"}
              </button>
            ) : (
              <span className="text-xs font-semibold text-emeraldTech">
                {en ? "Latest" : "Terbaru"}
              </span>
            )}
          </div>

          <div className="divide-y divide-line/40">
            {lastSyncResults && lastSyncResults.length > 0 ? (
              lastSyncResults.map((r) => (
                <div
                  key={r.client_tx_id}
                  className="p-4 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          r.status === "SYNCED"
                            ? "bg-emeraldTech/15 text-emeraldTech"
                            : "bg-roseTech/15 text-roseTech"
                        }`}
                      >
                        {formatOutcomeLabel(r.outcome, lang)}
                      </span>
                      <span className="font-mono text-xs font-bold text-ink-primary">
                        {r.short_code}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {r.reason}
                    </p>
                  </div>
                </div>
              ))
            ) : ledger.length === 0 ? (
              <p className="p-5 text-center text-xs text-ink-muted">
                {en ? "No transactions yet." : "Belum ada transaksi."}
              </p>
            ) : (
              ledger.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-nested/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold shrink-0 ${
                        entry.sync_mode === "OFFLINE_BATCH_SYNC"
                          ? "bg-amberTech/15 text-amberTech"
                          : "bg-emeraldTech/15 text-emeraldTech"
                      }`}
                    >
                      {entry.sync_mode === "OFFLINE_BATCH_SYNC"
                        ? "Offline"
                        : "Online"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-ink-primary truncate">
                        {entry.short_code} · {formatRupiah(entry.nominal_idr)}
                      </p>
                      <p className="text-xs text-ink-secondary truncate">
                        {entry.merchant_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono text-xs text-ink-muted tabular-nums">
                    {formatShortTime(entry.timestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
