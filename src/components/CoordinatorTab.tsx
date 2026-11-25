"use client";

import React from "react";
import {
  ChevronDown,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Ticket,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  AuthUser,
  Beneficiary,
  CommodityItem,
  Merchant,
  Voucher,
  VoucherStatus,
} from "@/lib/types";
import { AppLang } from "@/lib/i18n";
import { formatRupiah, formatStatusLabel } from "@/lib/formatters";

interface CoordinatorTabProps {
  lang: AppLang;
  currentUser: AuthUser;
  isOfflineMode: boolean;
  poolTotalIdr: number;
  activeVouchersCount: number;
  totalWarungTurnover: number;
  fraudBlockedCount: number;
  beneficiaries: Beneficiary[];
  merchants: Merchant[];
  vouchers: Voucher[];
  catalog: CommodityItem[];
  filteredVouchers: Voucher[];
  filteredBeneficiaries: Beneficiary[];
  selectedBeneficiaryId: string;
  setSelectedBeneficiaryId: (id: string) => void;
  selectedCommodityCode: string;
  setSelectedCommodityCode: (code: string) => void;
  validityHours: number;
  setValidityHours: (hours: number) => void;
  showAddResidentForm: boolean;
  setShowAddResidentForm: (v: boolean) => void;
  showAddMerchantForm: boolean;
  setShowAddMerchantForm: (v: boolean) => void;
  newResidentName: string;
  setNewResidentName: (v: string) => void;
  newResidentRtRw: string;
  setNewResidentRtRw: (v: string) => void;
  newResidentCategory: string;
  setNewResidentCategory: (v: string) => void;
  newResidentPhone: string;
  setNewResidentPhone: (v: string) => void;
  newMerchantName: string;
  setNewMerchantName: (v: string) => void;
  newMerchantOwner: string;
  setNewMerchantOwner: (v: string) => void;
  newMerchantRtRw: string;
  setNewMerchantRtRw: (v: string) => void;
  newMerchantBank: string;
  setNewMerchantBank: (v: string) => void;
  coordinatorRightView: "VOUCHERS" | "BENEFICIARIES";
  setCoordinatorRightView: (v: "VOUCHERS" | "BENEFICIARIES") => void;
  voucherStatusFilter: "ALL" | VoucherStatus;
  setVoucherStatusFilter: (v: "ALL" | VoucherStatus) => void;
  voucherSearch: string;
  setVoucherSearch: (v: string) => void;
  beneficiarySearch: string;
  setBeneficiarySearch: (v: string) => void;
  onAddBeneficiary: (e: React.FormEvent) => void;
  onAddMerchant: (e: React.FormEvent) => void;
  onTopupPool: (amountIdr: number) => Promise<void>;
  onAddCommodity: (params: {
    name: string;
    items: string;
    nominal_idr: number;
  }) => Promise<void>;
  onIssueVoucher: (e: React.FormEvent) => void;
  onOpenVoucherCard: (v: Voucher) => void;
  onNotifySelectedBeneficiary: (name: string) => void;
}

export default function CoordinatorTab({
  lang,
  currentUser,
  isOfflineMode,
  poolTotalIdr,
  activeVouchersCount,
  totalWarungTurnover,
  fraudBlockedCount,
  beneficiaries,
  merchants,
  vouchers,
  catalog,
  filteredVouchers,
  filteredBeneficiaries,
  selectedBeneficiaryId,
  setSelectedBeneficiaryId,
  selectedCommodityCode,
  setSelectedCommodityCode,
  validityHours,
  setValidityHours,
  showAddResidentForm,
  setShowAddResidentForm,
  showAddMerchantForm,
  setShowAddMerchantForm,
  newResidentName,
  setNewResidentName,
  newResidentRtRw,
  setNewResidentRtRw,
  newResidentCategory,
  setNewResidentCategory,
  newResidentPhone,
  setNewResidentPhone,
  newMerchantName,
  setNewMerchantName,
  newMerchantOwner,
  setNewMerchantOwner,
  newMerchantRtRw,
  setNewMerchantRtRw,
  newMerchantBank,
  setNewMerchantBank,
  coordinatorRightView,
  setCoordinatorRightView,
  voucherStatusFilter,
  setVoucherStatusFilter,
  voucherSearch,
  setVoucherSearch,
  beneficiarySearch,
  setBeneficiarySearch,
  onAddBeneficiary,
  onAddMerchant,
  onTopupPool,
  onAddCommodity,
  onIssueVoucher,
  onOpenVoucherCard,
  onNotifySelectedBeneficiary,
}: CoordinatorTabProps) {
  const en = lang === "en";
  const [showTopupForm, setShowTopupForm] = React.useState(false);
  const [topupAmount, setTopupAmount] = React.useState("2000000");
  const [showAddPkgForm, setShowAddPkgForm] = React.useState(false);
  const [pkgName, setPkgName] = React.useState("");
  const [pkgItems, setPkgItems] = React.useState("");
  const [pkgNominal, setPkgNominal] = React.useState("65000");

  const submitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(topupAmount.replace(/[^0-9]/g, ""));
    if (!val || val <= 0) return;
    await onTopupPool(val);
    setShowTopupForm(false);
  };

  const submitPkg = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(pkgNominal.replace(/[^0-9]/g, ""));
    if (!pkgName.trim() || !pkgItems.trim() || !val) return;
    await onAddCommodity({
      name: pkgName.trim(),
      items: pkgItems.trim(),
      nominal_idr: val,
    });
    setPkgName("");
    setPkgItems("");
    setPkgNominal("65000");
    setShowAddPkgForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-emeraldTech">
            {currentUser.name} · {currentUser.role_label}
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary mt-0.5">
            {en ? "Aid Distribution Overview" : "Ringkasan Penyaluran Bansos"}
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {en
              ? `Monitor available funds, manage ${beneficiaries.length} registered beneficiaries, and issue signed vouchers.`
              : `Lihat sisa dana, daftar ${beneficiaries.length} warga penerima, dan buat kupon sembako.`}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-line/70 shadow-sm text-xs font-semibold text-ink-primary self-start md:self-auto">
          <span
            className={`w-2 h-2 rounded-full ${
              isOfflineMode ? "bg-amberTech" : "bg-emeraldTech animate-pulse"
            }`}
          />
          {isOfflineMode
            ? en
              ? "Offline · Buffered Locally"
              : "Offline · Tersimpan di Perangkat"
            : en
              ? "Online · Connected"
              : "Online · Terhubung"}
        </span>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              {en ? "Aid Pool Balance" : "Sisa Dana Bansos"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
              {formatRupiah(poolTotalIdr)}
            </p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-xs text-ink-muted">
                {en ? "Dynamic aid pool" : "Dana sembako dinamis"}
              </p>
              <button
                type="button"
                onClick={() => setShowTopupForm(!showTopupForm)}
                className="text-[11px] font-bold text-emeraldTech hover:underline"
              >
                {showTopupForm
                  ? en
                    ? "Close"
                    : "Tutup"
                  : en
                    ? "+ Top Up"
                    : "+ Tambah Dana"}
              </button>
            </div>
            {showTopupForm && (
              <form onSubmit={submitTopup} className="mt-2.5 flex gap-1.5">
                <input
                  type="number"
                  min={10000}
                  step={50000}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-surface border border-line text-xs font-mono text-ink-primary outline-none"
                  placeholder="2000000"
                />
                <button
                  type="submit"
                  className="px-3 h-9 rounded-lg bg-cta-bg text-cta-ink text-xs font-bold shrink-0"
                >
                  {en ? "Add" : "Tambah"}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              {en ? "Active Vouchers" : "Kupon Siap Pakai"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
              {activeVouchersCount}
            </p>
            <p className="text-xs text-ink-muted mt-1 tabular-nums">
              {en
                ? `Out of ${vouchers.length} issued`
                : `Dari ${vouchers.length} kupon dibuat`}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              {en ? "Local Stall Turnover" : "Belanja di Kedai"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amberTech/12 text-amberTech flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
              {formatRupiah(totalWarungTurnover)}
            </p>
            <p className="text-xs text-ink-muted mt-1 tabular-nums">
              {en
                ? `${merchants.length} partner stalls registered`
                : `${merchants.length} kedai mitra terdaftar`}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-secondary">
              {en ? "Beneficiaries" : "Penerima Bansos"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
              {beneficiaries.length} {en ? "Households" : "Orang"}
            </p>
            <p
              className={`text-xs mt-1 flex items-center gap-1.5 font-medium tabular-nums ${
                fraudBlockedCount > 0 ? "text-amberTech" : "text-emeraldTech"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  fraudBlockedCount > 0 ? "bg-amberTech" : "bg-emeraldTech"
                }`}
              />
              {en
                ? `${fraudBlockedCount} invalid/duplicate blocked`
                : `${fraudBlockedCount} kupon bermasalah ditolak`}
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Issue Voucher */}
        <div className="lg:col-span-5 bg-card rounded-2xl border border-line/75 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-line/50 flex items-center justify-between gap-2 bg-surface/60">
            <div>
              <h2 className="text-base font-bold text-ink-primary">
                {en ? "Issue Food Voucher" : "Buat Kupon Sembako"}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                {en
                  ? "Select a beneficiary and commodity aid package"
                  : "Pilih nama penerima dan paket sembakonya"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowAddResidentForm(!showAddResidentForm);
                  setShowAddMerchantForm(false);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-nested hover:bg-elevated border border-line/60 text-xs font-semibold text-ink-primary transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-emeraldTech" />
                {en ? "+ Resident" : "+ Warga"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddMerchantForm(!showAddMerchantForm);
                  setShowAddResidentForm(false);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-nested hover:bg-elevated border border-line/60 text-xs font-semibold text-ink-primary transition"
              >
                <Store className="w-3.5 h-3.5 text-amberTech" />
                {en ? "+ Stall" : "+ Kedai"}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {showAddResidentForm && (
              <form
                onSubmit={onAddBeneficiary}
                className="p-4 rounded-xl bg-nested/60 border border-line/70 space-y-3"
              >
                <p className="text-sm font-bold text-ink-primary">
                  {en ? "Register New Beneficiary" : "Tambah Penerima Baru"}
                </p>
                <input
                  type="text"
                  required
                  placeholder={
                    en ? "Full name" : "Nama lengkap (misal: Mangasi Simatupang)"
                  }
                  value={newResidentName}
                  onChange={(e) => setNewResidentName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newResidentRtRw}
                    onChange={(e) => setNewResidentRtRw(e.target.value)}
                    placeholder={en ? "Village / District" : "Desa / Kecamatan"}
                    className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                  />
                  <input
                    type="text"
                    value={newResidentCategory}
                    onChange={(e) => setNewResidentCategory(e.target.value)}
                    placeholder={en ? "Category" : "Kategori"}
                    className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={newResidentPhone}
                  onChange={(e) => setNewResidentPhone(e.target.value)}
                  placeholder={en ? "Phone number" : "Nomor HP"}
                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddResidentForm(false)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink-primary"
                  >
                    {en ? "Cancel" : "Batal"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold"
                  >
                    {en ? "Save" : "Simpan"}
                  </button>
                </div>
              </form>
            )}

            {showAddMerchantForm && (
              <form
                onSubmit={onAddMerchant}
                className="p-4 rounded-xl bg-nested/60 border border-line/70 space-y-3"
              >
                <p className="text-sm font-bold text-ink-primary">
                  {en ? "Register Local Stall" : "Tambah Kedai Mitra"}
                </p>
                <input
                  type="text"
                  required
                  placeholder={en ? "Stall name" : "Nama kedai sembako"}
                  value={newMerchantName}
                  onChange={(e) => setNewMerchantName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder={en ? "Owner name" : "Nama pemilik"}
                    value={newMerchantOwner}
                    onChange={(e) => setNewMerchantOwner(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                  />
                  <input
                    type="text"
                    value={newMerchantRtRw}
                    onChange={(e) => setNewMerchantRtRw(e.target.value)}
                    placeholder={en ? "Address" : "Alamat kedai"}
                    className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={newMerchantBank}
                  onChange={(e) => setNewMerchantBank(e.target.value)}
                  placeholder={en ? "Bank account / QRIS" : "Rekening / QRIS"}
                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddMerchantForm(false)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink-primary"
                  >
                    {en ? "Cancel" : "Batal"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold"
                  >
                    {en ? "Save" : "Simpan"}
                  </button>
                </div>
              </form>
            )}

            <form onSubmit={onIssueVoucher} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-primary">
                  {en
                    ? `1. Beneficiary (${beneficiaries.length} registered)`
                    : `1. Nama Penerima (${beneficiaries.length} warga)`}
                </label>
                <div className="relative">
                  <select
                    value={selectedBeneficiaryId}
                    onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                    className="w-full h-11 px-3.5 pr-9 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary appearance-none outline-none cursor-pointer"
                  >
                    {beneficiaries.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.rt_rw}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-ink-primary">
                    {en ? "2. Commodity Package" : "2. Paket Sembako"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddPkgForm(!showAddPkgForm)}
                    className="text-[11px] font-bold text-emeraldTech hover:underline"
                  >
                    {showAddPkgForm
                      ? en
                        ? "Close"
                        : "Tutup"
                      : en
                        ? "+ Custom Package"
                        : "+ Tambah Paket"}
                  </button>
                </div>

                {showAddPkgForm && (
                  <div className="p-3.5 rounded-xl bg-nested/60 border border-line/70 space-y-2.5">
                    <input
                      type="text"
                      placeholder={
                        en
                          ? "Package name (e.g. Baby Nutrition Pack)"
                          : "Nama paket (misal: Paket Gizi Balita)"
                      }
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-card border border-line text-xs text-ink-primary outline-none"
                    />
                    <input
                      type="text"
                      placeholder={
                        en
                          ? "Items included (e.g. Milk, eggs, oats)"
                          : "Isi barang (misal: Susu, telur, biskuit)"
                      }
                      value={pkgItems}
                      onChange={(e) => setPkgItems(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-card border border-line text-xs text-ink-primary outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={5000}
                        step={5000}
                        value={pkgNominal}
                        onChange={(e) => setPkgNominal(e.target.value)}
                        placeholder="65000"
                        className="flex-1 h-10 px-3 rounded-lg bg-card border border-line text-xs font-mono text-ink-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={submitPkg}
                        className="px-3.5 h-10 rounded-lg bg-cta-bg text-cta-ink text-xs font-bold"
                      >
                        {en ? "Save Package" : "Simpan Paket"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {catalog.map((item) => {
                    const selected = selectedCommodityCode === item.code;
                    return (
                      <label
                        key={item.code}
                        className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          selected
                            ? "bg-emeraldTech/8 border-cta-bg"
                            : "bg-surface border-line/60 hover:border-line hover:bg-nested/40"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <input
                            type="radio"
                            name="commodity"
                            value={item.code}
                            checked={selected}
                            onChange={() => setSelectedCommodityCode(item.code)}
                            className="mt-1 w-4 h-4 accent-cta-bg cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink-primary leading-snug">
                              {item.name}
                            </p>
                            <p className="text-xs text-ink-secondary mt-0.5 leading-snug">
                              {item.items}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-emeraldTech tabular-nums shrink-0">
                          {formatRupiah(item.nominal_idr)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-primary">
                  {en ? "3. Voucher Validity" : "3. Masa Berlaku Kupon"}
                </label>
                <div className="relative">
                  <select
                    value={validityHours}
                    onChange={(e) => setValidityHours(Number(e.target.value))}
                    className="w-full h-11 px-3.5 pr-9 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary appearance-none outline-none cursor-pointer"
                  >
                    <option value={24}>
                      {en ? "1 Day (24 Hours)" : "1 Hari (24 Jam)"}
                    </option>
                    <option value={72}>
                      {en ? "3 Days (72 Hours)" : "3 Hari (72 Jam)"}
                    </option>
                    <option value={168}>{en ? "7 Days" : "7 Hari"}</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-12 px-4 rounded-xl bg-cta-bg hover:opacity-90 active:scale-[0.99] text-cta-ink font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {en ? "Issue Signed Voucher" : "Buat Kupon Sembako"}
              </button>

              <p className="text-xs text-ink-secondary flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emeraldTech shrink-0 mt-0.5" />
                <span>
                  {en
                    ? "Each voucher carries a single-use nonce and HMAC-SHA256 signature for instant offline stall verification."
                    : "Kupon diberi kode unik agar tidak bisa dipalsukan dan bisa dicek saat kedai offline."}
                </span>
              </p>
            </form>
          </div>
        </div>

        {/* RIGHT: Vouchers & Beneficiaries Registry */}
        <div className="lg:col-span-7 bg-card rounded-2xl border border-line/75 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-line/50 bg-surface/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex bg-nested p-1 rounded-xl border border-line/50 self-start">
              <button
                type="button"
                onClick={() => setCoordinatorRightView("VOUCHERS")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  coordinatorRightView === "VOUCHERS"
                    ? "bg-card text-ink-primary shadow-sm"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                {en
                  ? `Vouchers (${vouchers.length})`
                  : `Daftar Kupon (${vouchers.length})`}
              </button>
              <button
                type="button"
                onClick={() => setCoordinatorRightView("BENEFICIARIES")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  coordinatorRightView === "BENEFICIARIES"
                    ? "bg-card text-ink-primary shadow-sm"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
              >
                {en
                  ? `Beneficiaries (${beneficiaries.length})`
                  : `Daftar Penerima (${beneficiaries.length})`}
              </button>
            </div>

            {coordinatorRightView === "VOUCHERS" && (
              <div className="flex bg-nested p-1 rounded-xl border border-line/50 shrink-0 self-start sm:self-auto">
                {(
                  [
                    { id: "ALL", label: en ? "All" : "Semua" },
                    { id: "ACTIVE", label: en ? "Active" : "Siap Pakai" },
                    { id: "REDEEMED", label: en ? "Redeemed" : "Dipakai" },
                    { id: "SETTLED", label: en ? "Settled" : "Cair" },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setVoucherStatusFilter(st.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      voucherStatusFilter === st.id
                        ? "bg-card text-ink-primary shadow-sm"
                        : "text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {coordinatorRightView === "VOUCHERS" ? (
            <>
              <div className="p-3.5 bg-surface/40 border-b border-line/45">
                <div className="relative">
                  <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={voucherSearch}
                    onChange={(e) => setVoucherSearch(e.target.value)}
                    placeholder={
                      en
                        ? "Search voucher code, resident, or package..."
                        : "Cari kode kupon, nama warga, atau paket..."
                    }
                    className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-card border border-line/70 focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-nested/60 border-b border-line/50 text-xs font-semibold text-ink-secondary">
                      <th className="py-3 px-4">
                        {en ? "Code" : "Kode Kupon"}
                      </th>
                      <th className="py-3 px-3">
                        {en ? "Beneficiary" : "Penerima"}
                      </th>
                      <th className="py-3 px-3">{en ? "Package" : "Paket"}</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">
                        {en ? "Action" : "Aksi"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40 text-sm">
                    {filteredVouchers.map((v) => (
                      <tr
                        key={v.id}
                        className="hover:bg-nested/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-ink-primary">
                            {v.short_code}
                          </div>
                          <div className="font-mono text-[11px] text-ink-muted">
                            {v.id}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-ink-primary leading-snug">
                            {v.beneficiary_name}
                          </div>
                          <div className="text-xs text-ink-muted">
                            {v.rt_rw}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-ink-body line-clamp-1 font-medium">
                            {v.commodity_name}
                          </div>
                          <div className="font-mono text-xs text-ink-secondary tabular-nums mt-0.5">
                            {formatRupiah(v.nominal_idr)}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                              v.status === "ACTIVE"
                                ? "bg-emeraldTech/12 text-emeraldTech"
                                : v.status === "REDEEMED"
                                  ? "bg-amberTech/12 text-amberTech"
                                  : "bg-nested text-ink-secondary"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                v.status === "ACTIVE"
                                  ? "bg-emeraldTech"
                                  : v.status === "REDEEMED"
                                    ? "bg-amberTech"
                                    : "bg-ink-muted"
                              }`}
                            />
                            {formatStatusLabel(v.status, lang)}
                          </span>
                          {v.redeemed_by_merchant_name && (
                            <div className="text-[11px] text-ink-muted mt-1 max-w-[180px] truncate">
                              {v.redeemed_by_merchant_name}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenVoucherCard(v)}
                            className="px-3 py-1.5 rounded-lg bg-nested hover:bg-elevated text-ink-primary border border-line/60 text-xs font-semibold transition"
                          >
                            {en ? "Print / SMS" : "Cetak / SMS"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredVouchers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 text-center text-ink-muted text-sm"
                        >
                          {en
                            ? "No matching vouchers found."
                            : "Tidak ada kupon yang cocok."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-surface/60 border-t border-line/45 flex items-center justify-between text-xs text-ink-muted">
                <span className="tabular-nums">
                  {en
                    ? `Showing ${filteredVouchers.length} of ${vouchers.length} vouchers`
                    : `Menampilkan ${filteredVouchers.length} dari ${vouchers.length} kupon`}
                </span>
                <span className="font-semibold text-emeraldTech">
                  {en ? "Community Vouchers" : "Kupon Sembako"}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 bg-surface/40 border-b border-line/45">
                <div className="relative">
                  <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={beneficiarySearch}
                    onChange={(e) => setBeneficiarySearch(e.target.value)}
                    placeholder={
                      en
                        ? "Search beneficiary name, village, or category..."
                        : "Cari nama warga, desa, atau kategori..."
                    }
                    className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-card border border-line/70 focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-nested border-b border-line/50 text-xs font-semibold text-ink-secondary">
                      <th className="py-3 px-4">No / ID</th>
                      <th className="py-3 px-3">
                        {en ? "Name & Address" : "Nama & Desa"}
                      </th>
                      <th className="py-3 px-3">
                        {en ? "Category" : "Kategori"}
                      </th>
                      <th className="py-3 px-3 text-center">
                        {en ? "Vouchers" : "Kupon"}
                      </th>
                      <th className="py-3 px-4 text-right">
                        {en ? "Action" : "Aksi"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40 text-sm">
                    {filteredBeneficiaries.map((b, idx) => {
                      const countVouchers = vouchers.filter(
                        (v) => v.beneficiary_id === b.id
                      ).length;
                      return (
                        <tr
                          key={b.id}
                          className="hover:bg-nested/40 transition-colors"
                        >
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-ink-muted">
                            <div className="font-bold text-ink-primary">
                              {idx + 1}. {b.id}
                            </div>
                            <div>
                              {b.household_size} {en ? "ppl" : "org"}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-ink-primary">
                              {b.name}
                            </div>
                            <div className="text-xs text-ink-muted">
                              {b.rt_rw} · {b.phone}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs text-ink-secondary">
                            {b.category}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-xs font-bold text-ink-primary">
                            {countVouchers}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBeneficiaryId(b.id);
                                onNotifySelectedBeneficiary(b.name);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold transition"
                            >
                              {en ? "Select" : "Pilih"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-surface/60 border-t border-line/45 flex items-center justify-between text-xs text-ink-muted">
                <span className="tabular-nums">
                  {en
                    ? `Showing ${filteredBeneficiaries.length} of ${beneficiaries.length} beneficiaries`
                    : `Total ${filteredBeneficiaries.length} dari ${beneficiaries.length} penerima bansos`}
                </span>
                <span className="font-semibold text-emeraldTech">
                  {en ? "Synthetic Sample Dataset" : "Data Simulasi Komunitas"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
