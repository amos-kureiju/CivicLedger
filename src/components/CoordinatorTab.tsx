"use client";

import React from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import {
  ChevronDown,
  Plus,
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
  LedgerEntry,
  Voucher,
  VoucherStatus,
} from "@/lib/types";
import { AppLang } from "@/lib/i18n";
import { formatRupiah } from "@/lib/formatters";

import CoordinatorAnalytics from "./CoordinatorAnalytics";
import styles from "./CoordinatorWorkspace.module.css";
import CoordinatorOverview from "./CoordinatorOverview";
import OperationalCalendar, { type CalendarAvailability } from "./OperationalCalendar";
import type { CalendarRecords } from "@/lib/calendar-activities";
import overview from "./CoordinatorOverview.module.css";
import CoordinatorResources, { type ResourceView } from "./CoordinatorResources";
import resourceStyles from "./CoordinatorResources.module.css";

function MetricValue({ value, currency = false }: { value: number; currency?: boolean }) {
  const current = React.useRef(0);
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    const start = current.current;
    if (start === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = value;
      setDisplay(value);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const time = Math.min((now - started) / 480, 1);
      current.current = Math.round(start + (value - start) * (1 - (1 - time) ** 3));
      setDisplay(current.current);
      if (time < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return currency ? formatRupiah(display) : display;
}

interface CoordinatorTabProps {
  calendarRecords: Omit<CalendarRecords, "vouchers" | "ledger">;
  calendarAvailability: CalendarAvailability;
  deviceOnline: boolean;
  pendingSync: number;
  ledger: LedgerEntry[];
  onReports: () => void;
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
  coordinatorRightView: ResourceView;
  setCoordinatorRightView: (v: ResourceView) => void;
  fullResources: boolean;
  onFullResources: () => void;
  onCopyVoucherSms: (voucher: Voucher) => void;
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
  pendingSync,
  calendarRecords,
  calendarAvailability,
  deviceOnline,
  ledger,
  onReports,
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
  fullResources,
  onFullResources,
  onCopyVoucherSms,
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
  const [calendarVoucher, setCalendarVoucher] = React.useState<Voucher | null>(null);
  const creationDrawer = React.useRef<HTMLDialogElement>(null);
  const [creation, setCreation] = React.useState<ResourceView | "FUNDS">("VOUCHERS");
  function openCreation(view: ResourceView | "FUNDS") {
    setCreation(view);
    creationDrawer.current?.showModal();
  }
  const [topupAmount, setTopupAmount] = React.useState("2000000");
  const [pkgName, setPkgName] = React.useState("");
  const [pkgItems, setPkgItems] = React.useState("");
  const [pkgNominal, setPkgNominal] = React.useState("65000");

  const submitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(topupAmount.replace(/[^0-9]/g, ""));
    if (!val || val <= 0) return;
    await onTopupPool(val);
    creationDrawer.current?.close();
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
    creationDrawer.current?.close();
  };

  return (
    <div className={styles.workspace} id="coordinator-home">
      <div className={overview.layout}>
        <div className={overview.primary}>
          <header className={overview.hero}>
            <div className={overview.heroCopy}>
              <h1>{en ? "Hello," : "Halo,"} <em>{currentUser.name}!</em></h1>
              <p>{en ? "Manage social aid, voucher distribution, and partner store activity with ease." : "Kelola bantuan sosial, distribusi kupon, dan aktivitas kedai mitra dengan lebih mudah."}</p>
            </div>
            <button id="coordinator-issue-trigger" type="button" onClick={() => openCreation("VOUCHERS")}><Plus size={16} />{en ? "Issue voucher" : "Buat Kupon"}</button>
          </header>
          <section className={overview.metrics} id="coordinator-metrics" aria-label={en ? "Operational summary" : "Ringkasan operasional"}>
            {[
              { label: en ? "Aid Pool Balance" : "Sisa Dana Bansos", value: poolTotalIdr, currency: true, icon: Wallet, funds: true },
              { label: en ? "Active Vouchers" : "Kupon Siap Pakai", value: activeVouchersCount, icon: Ticket, note: en ? "Available for use" : "Tersedia untuk digunakan" },
              { label: en ? "Registered Recipients" : "Penerima Terdaftar", value: beneficiaries.length, icon: UserCheck, note: en ? "Registered residents" : "Warga terdaftar" },
              { label: en ? "Store Spending" : "Belanja di Kedai", value: totalWarungTurnover, currency: true, icon: Store, note: en ? "Partner store turnover" : "Transaksi kedai mitra" },
              { label: en ? "Redeemed Vouchers" : "Kupon Sudah Dipakai", value: vouchers.filter(v => v.status === "REDEEMED" || v.status === "SETTLED").length, icon: CheckCircle2, note: en ? "Redeemed and settled" : "Ditukar dan sudah cair" },
              { label: en ? "Offline Sync" : "Sinkronisasi Offline", value: pendingSync, icon: RefreshCw, note: en ? "Awaiting sync" : "Menunggu sinkronisasi" },
            ].map(({ label, value, currency, icon: Icon, note, funds }, index) => (
              <article className={overview.metric} key={label} style={{ "--stagger": index * 65 + "ms" } as React.CSSProperties}>
                <h2>{label}</h2><span className={overview.metricIcon}><Icon size={15} aria-hidden="true" /></span>
                <strong><MetricValue value={value} currency={currency} /></strong>
                {funds ? <button type="button" onClick={() => openCreation("FUNDS")}>{en ? "Add funds" : "Tambah Dana"}</button> : <p>{note}</p>}
              </article>
            ))}
          </section>
          <CoordinatorAnalytics vouchers={vouchers} ledger={ledger} turnover={totalWarungTurnover} merchantCount={merchants.length} en={en} onReports={onReports} />
        </div>
        <CoordinatorOverview en={en} vouchers={vouchers} beneficiaries={beneficiaries} merchants={merchants} pending={pendingSync}
          calendar={<OperationalCalendar en={en} availability={calendarAvailability} offline={isOfflineMode || !deviceOnline} records={{ ...calendarRecords, vouchers, ledger }} onVoucher={setCalendarVoucher} />}
          onVoucher={onOpenVoucherCard} onResource={(view) => {
            setCoordinatorRightView(view);
            onFullResources();
            document.getElementById("coordinator-operations")?.scrollIntoView({ block: "start" });
          }} />
      </div>

      <CoordinatorResources requestedVoucher={calendarVoucher} clearRequestedVoucher={() => setCalendarVoucher(null)} en={en} view={coordinatorRightView} onView={setCoordinatorRightView} preview={!fullResources} onFullView={onFullResources}
        vouchers={vouchers} beneficiaries={beneficiaries} filteredVouchers={filteredVouchers} filteredBeneficiaries={filteredBeneficiaries} merchants={merchants} packages={catalog}
        voucherQuery={voucherSearch} onVoucherQuery={setVoucherSearch} beneficiaryQuery={beneficiarySearch} onBeneficiaryQuery={setBeneficiarySearch} status={voucherStatusFilter} onStatus={setVoucherStatusFilter}
        onAdd={openCreation} onPrint={onOpenVoucherCard} onSms={onCopyVoucherSms}
        onResident={(resident) => { setSelectedBeneficiaryId(resident.id); onNotifySelectedBeneficiary(resident.name); openCreation("VOUCHERS"); }}
      />

      <dialog ref={creationDrawer} className={styles.dialog} aria-labelledby="coordinator-drawer-title">
        <header className={styles.dialogHead}>
          <h2 id="coordinator-drawer-title">{{
            VOUCHERS: en ? "Issue food voucher" : "Buat Kupon Sembako",
            BENEFICIARIES: en ? "Add recipient" : "Tambah Warga",
            MERCHANTS: en ? "Add store" : "Tambah Kedai",
            PACKAGES: en ? "Add food package" : "Tambah Paket Sembako",
            FUNDS: en ? "Add funds" : "Tambah Dana",
          }[creation]}</h2>
          <button type="button" onClick={() => creationDrawer.current?.close()} aria-label={en ? "Close" : "Tutup"}>×</button>
        </header>
        {creation === "VOUCHERS" && (<form onSubmit={(event) => { onIssueVoucher(event); creationDrawer.current?.close(); }} className="space-y-4">
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
                </div>

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
              </form>)}
        {creation === "BENEFICIARIES" && (<form
                onSubmit={(event) => { onAddBeneficiary(event); creationDrawer.current?.close(); }}
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
                    onClick={() => creationDrawer.current?.close()}
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
              </form>)}
        {creation === "MERCHANTS" && (<form
                onSubmit={(event) => { onAddMerchant(event); creationDrawer.current?.close(); }}
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
                    onClick={() => creationDrawer.current?.close()}
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
              </form>)}
        {creation === "FUNDS" && (<form onSubmit={submitTopup} className={resourceStyles.createForm}>
                <input
                  aria-label={en ? "Top-up amount" : "Nominal tambah dana"} required type="number"
                  min={10000}
                  step={10000}
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
              </form>)}
        {creation === "PACKAGES" && <form className={resourceStyles.createForm} onSubmit={submitPkg}>
          <label>{en ? "Package name" : "Nama paket"}<input required value={pkgName} onChange={(event) => setPkgName(event.target.value)} /></label>
          <label>{en ? "Package contents" : "Isi paket"}<textarea required rows={3} value={pkgItems} onChange={(event) => setPkgItems(event.target.value)} /></label>
          <label>{en ? "Amount (IDR)" : "Nominal (Rp)"}<input required type="number" min={5000} step={5000} value={pkgNominal} onChange={(event) => setPkgNominal(event.target.value)} /></label>
          <button type="submit" className={resourceStyles.primary}>{en ? "Save package" : "Simpan Paket"}</button>
        </form>}
      </dialog>
    </div>
  );
}
