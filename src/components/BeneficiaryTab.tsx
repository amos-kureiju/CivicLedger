"use client";

import React from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  Lock,
  MapPin,
  Printer,
  RefreshCw,
} from "lucide-react";
import { AuthUser, Beneficiary, Voucher } from "@/lib/types";
import { AppLang } from "@/lib/i18n";
import BrandLogo from "@/components/BrandLogo";
import {
  formatDateTime,
  formatRupiah,
  formatStatusLabel,
} from "@/lib/formatters";

interface BeneficiaryTabProps {
  lang: AppLang;
  currentUser: AuthUser;
  beneficiaries: Beneficiary[];
  walletBeneficiaryId: string;
  setWalletBeneficiaryId: (id: string) => void;
  currentWalletBeneficiary: Beneficiary | null;
  currentWalletVouchers: Voucher[];
  currentWalletActiveCount: number;
  selectedVoucherForQR: Voucher | null;
  setSelectedVoucherForQR: (v: Voucher) => void;
  qrDataUrl: string;
  showVoucherTechDetails: boolean;
  setShowVoucherTechDetails: (v: boolean) => void;
  copiedSms: boolean;
  canOpenMerchantPos: boolean;
  onRefresh: () => void;
  onCopySmsSlip: (v: Voucher) => void;
  onSendToMerchantPos: (v: Voucher) => void;
}

export default function BeneficiaryTab({
  lang,
  currentUser,
  beneficiaries,
  walletBeneficiaryId,
  setWalletBeneficiaryId,
  currentWalletBeneficiary,
  currentWalletVouchers,
  currentWalletActiveCount,
  selectedVoucherForQR,
  setSelectedVoucherForQR,
  qrDataUrl,
  showVoucherTechDetails,
  setShowVoucherTechDetails,
  copiedSms,
  canOpenMerchantPos,
  onRefresh,
  onCopySmsSlip,
  onSendToMerchantPos,
}: BeneficiaryTabProps) {
  const en = lang === "en";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 border-b border-line/55">
        <div>
          <p className="text-xs font-semibold text-emeraldTech">
            {currentUser.name} · {en ? "Food Vouchers" : "Kupon Sembako"}
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary mt-0.5">
            {en ? "Beneficiary Voucher Slip" : "Kupon Warga"}
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {en
              ? "Show this QR on your phone or print the short code slip for non-smartphone residents."
              : "Tunjukkan QR di layar HP atau bawa kode kupon yang dicetak ke kedai terdekat."}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="no-print self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card hover:bg-nested text-ink-primary border border-line/70 shadow-sm text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emeraldTech" />
          {en ? "Refresh" : "Muat Ulang"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="no-print lg:col-span-5 flex flex-col space-y-5">
          <section className="bg-card border border-line/75 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="family-select"
                className="text-xs font-bold text-ink-primary"
              >
                {en ? "Beneficiary Name" : "Nama Penerima"}
              </label>
              {currentWalletBeneficiary && (
                <span className="font-mono text-xs font-semibold text-emeraldTech">
                  {currentWalletBeneficiary.id}
                </span>
              )}
            </div>
            <div className="relative">
              <select
                id="family-select"
                value={walletBeneficiaryId}
                onChange={(e) => setWalletBeneficiaryId(e.target.value)}
                className="w-full h-12 px-3.5 pr-9 bg-surface text-ink-primary border border-line rounded-xl appearance-none text-sm font-semibold focus:outline-none focus:border-cta-bg cursor-pointer"
              >
                {beneficiaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.rt_rw}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {currentWalletBeneficiary && (
              <div className="mt-4 pt-4 border-t border-line/45 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-ink-muted">
                    {en ? "Category" : "Kategori"}
                  </div>
                  <div className="text-ink-primary font-semibold mt-0.5 leading-snug">
                    {currentWalletBeneficiary.category}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">
                    {en ? "Household" : "Keluarga"}
                  </div>
                  <div className="text-ink-primary font-mono font-bold mt-0.5">
                    {currentWalletBeneficiary.household_size}{" "}
                    {en ? "Ppl" : "Orang"}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">
                    {en ? "Active" : "Siap Pakai"}
                  </div>
                  <div className="text-emeraldTech font-mono font-bold mt-0.5">
                    {currentWalletActiveCount} {en ? "Vouchers" : "Kupon"}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="bg-card border border-line/75 rounded-2xl shadow-sm p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink-primary">
                {en ? "Resident Vouchers" : "Kupon Milik Warga"}
              </span>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-nested text-ink-primary font-semibold">
                {currentWalletVouchers.length} {en ? "Vouchers" : "Kupon"}
              </span>
            </div>

            {currentWalletVouchers.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                {en
                  ? "No vouchers issued for this resident yet."
                  : "Belum ada kupon untuk warga ini."}
              </p>
            ) : (
              <div className="space-y-3">
                {currentWalletVouchers.map((v) => {
                  const isSelected = selectedVoucherForQR?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVoucherForQR(v)}
                      className={`relative w-full text-left p-4 rounded-xl transition-all ${
                        isSelected
                          ? "bg-emeraldTech/8 border-2 border-cta-bg shadow-sm"
                          : "bg-surface border border-line/60 hover:border-line"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full bg-cta-bg text-cta-ink font-mono text-[10px] uppercase font-bold tracking-wider">
                          {en ? "Selected" : "Dipilih"}
                        </span>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-base font-bold tracking-wider text-ink-primary">
                          {v.short_code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            v.status === "ACTIVE"
                              ? "bg-emeraldTech/12 text-emeraldTech"
                              : "bg-nested text-ink-muted"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              v.status === "ACTIVE"
                                ? "bg-emeraldTech"
                                : "bg-ink-muted"
                            }`}
                          />
                          {formatStatusLabel(v.status, lang)}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-ink-primary mt-2">
                        {v.commodity_name}
                      </p>
                      <p className="text-xs text-ink-secondary mt-0.5">
                        {v.commodity_items}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-line/40 flex items-center justify-between gap-2">
                        <span className="font-mono text-base font-bold text-emeraldTech tabular-nums">
                          {formatRupiah(v.nominal_idr)}
                        </span>
                        <span className="text-xs text-ink-muted tabular-nums">
                          {en ? "Exp" : "s/d"} {formatDateTime(v.expires_at)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-start gap-2 pt-1 text-xs text-ink-secondary leading-relaxed">
              <Info className="w-4 h-4 text-emeraldTech shrink-0 mt-0.5" />
              <span>
                {en
                  ? "Vouchers are commodity-locked for essential goods at partner stalls and cannot be cashed out."
                  : "Kupon khusus ditukar sembako di kedai mitra dan tidak dapat diuangkan."}
              </span>
            </div>
          </section>
        </div>

        {/* Ticket Pass */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          {selectedVoucherForQR ? (
            <div className="w-full max-w-md bg-card border-2 border-line/80 rounded-2xl p-6 flex flex-col relative shadow-md">
              <div className="hidden sm:block absolute -left-3 top-28 w-6 h-6 rounded-full bg-canvas border-r-2 border-line/80" />
              <div className="hidden sm:block absolute -right-3 top-28 w-6 h-6 rounded-full bg-canvas border-l-2 border-line/80" />

              <div className="flex items-center justify-between pb-4 border-b border-dashed border-line">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emeraldTech">
                  <BrandLogo size={20} className="shrink-0" />
                  <span>
                    {en ? "Community Food Voucher" : "Kupon Sembako Warga"}
                  </span>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    selectedVoucherForQR.status === "ACTIVE"
                      ? "bg-emeraldTech/15 text-emeraldTech"
                      : "bg-nested text-ink-muted"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      selectedVoucherForQR.status === "ACTIVE"
                        ? "bg-emeraldTech"
                        : "bg-ink-muted"
                    }`}
                  />
                  {formatStatusLabel(selectedVoucherForQR.status, lang)}
                </div>
              </div>

              <div className="pt-4 pb-2">
                <h2 className="text-xl font-bold text-ink-primary">
                  {selectedVoucherForQR.beneficiary_name}
                </h2>
                <p className="text-sm text-ink-secondary flex items-center gap-1.5 mt-1">
                  <MapPin className="w-4 h-4 text-emeraldTech shrink-0" />
                  <span>{selectedVoucherForQR.rt_rw}</span>
                </p>
              </div>

              <div className="mt-3 p-4 bg-nested/65 border border-line/60 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-primary">
                    {selectedVoucherForQR.commodity_name}
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    {selectedVoucherForQR.commodity_items}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-semibold text-ink-muted">
                    {en ? "Value" : "Nilai"}
                  </p>
                  <p className="font-mono text-lg font-bold text-emeraldTech tabular-nums">
                    {formatRupiah(selectedVoucherForQR.nominal_idr)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl border-2 border-line/60 flex items-center justify-center w-56 h-56 shadow-sm">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Voucher QR Code"
                      className="w-full h-full block"
                    />
                  ) : (
                    <span className="text-xs text-zinc-500">
                      {en ? "Generating QR..." : "Membuat QR..."}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-secondary mt-3 text-center">
                  {en
                    ? "Show this QR at a partner stall or read out the short code:"
                    : "Tunjukkan QR ini ke pemilik kedai atau sebutkan kodenya:"}
                </p>

                <div className="w-full mt-3 px-4 py-3.5 bg-surface border-2 border-line rounded-xl flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
                    {en ? "Voucher Code" : "Kode Kupon"}
                  </span>
                  <span className="font-mono text-2xl font-bold tracking-[0.14em] text-ink-primary select-all">
                    {selectedVoucherForQR.short_code}
                  </span>
                </div>
              </div>

              <div className="no-print mt-4 border border-line/60 rounded-xl bg-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setShowVoucherTechDetails(!showVoucherTechDetails)
                  }
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-ink-secondary hover:text-ink-primary transition"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emeraldTech" />
                    <span>
                      {en
                        ? "Cryptographic Details (HMAC & Nonce)"
                        : "Detail Teknis (HMAC & Nonce)"}
                    </span>
                  </span>
                  {showVoucherTechDetails ? (
                    <ChevronUp className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  )}
                </button>
                {showVoucherTechDetails && (
                  <div className="px-3.5 pb-3 pt-1.5 border-t border-line/45 font-mono text-[11px] space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-muted">ID</span>
                      <span className="text-ink-primary">
                        {selectedVoucherForQR.id}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-muted">NONCE</span>
                      <span className="text-ink-primary">
                        {selectedVoucherForQR.nonce}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-muted shrink-0">
                        HMAC-SHA256
                      </span>
                      <span
                        className="text-ink-secondary truncate"
                        title={selectedVoucherForQR.hmac_signature}
                      >
                        {selectedVoucherForQR.hmac_signature}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="no-print space-y-2.5 mt-5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onCopySmsSlip(selectedVoucherForQR)}
                    className="h-11 px-3 rounded-xl bg-nested hover:bg-elevated border border-line/60 text-ink-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    {copiedSms ? (
                      <>
                        <Check className="w-4 h-4 text-emeraldTech" />
                        <span className="text-emeraldTech">
                          {en ? "Copied" : "Tersalin"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-ink-muted" />
                        <span>{en ? "Copy SMS / WA" : "Salin SMS / WA"}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-11 px-3 rounded-xl bg-nested hover:bg-elevated border border-line/60 text-ink-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-4 h-4 text-ink-muted" />
                    <span>{en ? "Print Paper Slip" : "Cetak Kertas"}</span>
                  </button>
                </div>

                {selectedVoucherForQR.status === "ACTIVE" ? (
                  canOpenMerchantPos ? (
                    <button
                      type="button"
                      onClick={() => onSendToMerchantPos(selectedVoucherForQR)}
                      className="w-full h-12 px-4 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm"
                    >
                      <span>
                        {en ? "Redeem at Merchant POS" : "Tukar di Kasir Kedai"}
                      </span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emeraldTech/10 border border-emeraldTech/30 text-center text-xs text-emeraldTech font-semibold">
                      {en
                        ? "Active voucher. Present this screen or printed slip at any participating stall."
                        : "Kupon aktif. Bawa HP atau hasil cetak ini ke kedai mitra terdekat."}
                    </div>
                  )
                ) : (
                  <div className="p-3.5 rounded-xl bg-nested border border-line/60 text-center text-xs text-ink-secondary">
                    {en ? "Redeemed at " : "Sudah ditukar di "}
                    <strong className="text-ink-primary">
                      {selectedVoucherForQR.redeemed_by_merchant_name}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md bg-card rounded-2xl border border-line/70 p-12 text-center text-ink-muted text-sm">
              {en
                ? "This resident does not have any vouchers yet."
                : "Warga ini belum memiliki kupon sembako."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
