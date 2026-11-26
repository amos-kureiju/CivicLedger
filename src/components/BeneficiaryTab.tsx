"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { ArrowUpRight, Check, ChevronDown, Copy, Info, Lock, MapPin, Printer, RefreshCw, Search, Ticket, UserRound } from "lucide-react";
import type { AuthUser, Beneficiary, Voucher } from "@/lib/types";
import type { AppLang } from "@/lib/i18n";
import { formatDateTime, formatRupiah, formatStatusLabel } from "@/lib/formatters";
import styles from "./BeneficiaryTab.module.css";

interface BeneficiaryTabProps {
  className?: string;
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
  onRefresh: () => void | Promise<void>;
  onCopySmsSlip: (v: Voucher) => void;
  onSendToMerchantPos: (v: Voucher) => void;
}

function VoucherStatus({ status, lang }: { status: Voucher["status"]; lang: AppLang }) {
  return <span className={styles.badge} data-status={status}><i aria-hidden="true" />{formatStatusLabel(status, lang)}</span>;
}

function VoucherAmount({ amount }: { amount: number }) {
  const current = useRef(amount);
  const [value, setValue] = useState(amount);
  useEffect(() => {
    const from = current.current;
    if (from === amount) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = amount;
      setValue(amount);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const time = Math.min(1, (now - start) / 250);
      current.current = Math.round(from + (amount - from) * (1 - (1 - time) ** 3));
      setValue(current.current);
      if (time < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount]);
  return <strong aria-label={formatRupiah(amount)} data-print-value={formatRupiah(amount)}>{formatRupiah(value)}</strong>;
}

function tiltVoucher(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
  const card = event.currentTarget;
  const { left, top, width, height } = card.getBoundingClientRect();
  const clamp = (value: number) => Math.max(-3, Math.min(3, value));
  card.style.setProperty("--tilt-x", clamp((.5 - (event.clientY - top) / height) * 6) + "deg");
  card.style.setProperty("--tilt-y", clamp(((event.clientX - left) / width - .5) * 6) + "deg");
}

export default function BeneficiaryTab({
  className,
  lang,
  currentUser,
  beneficiaries,
  walletBeneficiaryId,
  setWalletBeneficiaryId,
  currentWalletBeneficiary: recipient,
  currentWalletVouchers,
  currentWalletActiveCount,
  selectedVoucherForQR: voucher,
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
  const technicalId = useId();
  const [recipientQuery, setRecipientQuery] = useState("");
  const [copyResult, setCopyResult] = useState<{ code: string; ok: boolean } | null>(null);
  const [copying, setCopying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const query = recipientQuery.trim().toLocaleLowerCase(lang);
  const matchingRecipients = query ? beneficiaries.filter(person =>
    [person.name, person.id, person.rt_rw].some(value => value.toLocaleLowerCase(lang).includes(query))
  ) : beneficiaries;
  const selectedRecipient = beneficiaries.find(person => person.id === walletBeneficiaryId);
  const recipientOptions = selectedRecipient && !matchingRecipients.includes(selectedRecipient)
    ? [selectedRecipient, ...matchingRecipients]
    : matchingRecipients;
  const canSearchRecipients = currentUser.role !== "BENEFICIARY" && beneficiaries.length > 1;
  const code = voucher?.short_code;
  const copied = copyResult?.code === code ? copyResult : null;

  useEffect(() => {
    if (!copyResult) return;
    const timer = window.setTimeout(() => setCopyResult(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copyResult]);

  async function copyVoucherCode() {
    if (!code || copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(code);
      setCopyResult({ code, ok: true });
    } catch {
      setCopyResult({ code, ok: false });
    } finally {
      setCopying(false);
    }
  }

  async function refreshVouchers() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      await onRefresh();
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className={`${styles.workspace} ${className ?? ""}`}>
      <header className={`no-print ${styles.heading}`}>
        <div>
          <h1>{en ? "Resident Vouchers" : "Kupon Warga"}</h1>
          <p>{en ? "Select a voucher to show at the store or print a slip." : "Pilih kupon untuk ditunjukkan di kedai atau dicetak sebagai slip."}</p>
          {refreshFailed && <p role="status">{en ? "Could not refresh voucher records." : "Data kupon gagal dimuat ulang."}</p>}
        </div>
        <button type="button" onClick={refreshVouchers} disabled={refreshing} aria-busy={refreshing} className={styles.button}>
          <RefreshCw size={16} className={refreshing ? styles.spinning : undefined} aria-hidden="true" />
          {refreshing ? (en ? "Refreshing…" : "Memuat…") : (en ? "Refresh" : "Muat Ulang")}
        </button>
      </header>

      <div className={styles.columns}>
        <div className={`no-print ${styles.selection}`}>
          <section className={styles.card} aria-labelledby="voucher-recipient-heading">
            <div className={styles.cardHeading}>
              <h2 id="voucher-recipient-heading"><UserRound size={17} aria-hidden="true" />{en ? "Recipient" : "Penerima"}</h2>
              {recipient && <span className={styles.recipientId}>{recipient.id}</span>}
            </div>
            {recipient && <div className={styles.profile}>
              <span className={styles.initials} aria-hidden="true">{recipient.name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase()}</span>
              <div><strong>{recipient.name}</strong><p><MapPin size={13} aria-hidden="true" />{recipient.rt_rw}</p></div>
            </div>}
            {canSearchRecipients && <label className={styles.recipientSearch}>
              <Search size={15} aria-hidden="true" />
              <input type="search" aria-label={en ? "Search recipients" : "Cari penerima"} placeholder={en ? "Search name, ID, or address" : "Cari nama, ID, atau alamat"} value={recipientQuery} onChange={event => setRecipientQuery(event.target.value)} />
            </label>}
            {canSearchRecipients && query && !matchingRecipients.length && <p className={styles.searchMessage} role="status">{en ? "No matching recipients." : "Penerima tidak ditemukan."}</p>}
            <label className={styles.selectLabel} htmlFor="family-select">{en ? "Beneficiary name" : "Nama penerima"}</label>
            <div className={styles.selectWrap}>
              <select id="family-select" value={walletBeneficiaryId} onChange={event => { setWalletBeneficiaryId(event.target.value); setRecipientQuery(""); }} disabled={!beneficiaries.length || currentUser.role === "BENEFICIARY"}>
                {!beneficiaries.length && <option value="">{en ? "No linked recipient" : "Penerima belum terhubung"}</option>}
                {recipientOptions.map(beneficiary => <option key={beneficiary.id} value={beneficiary.id}>{beneficiary.name} — {beneficiary.rt_rw}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </div>
            {recipient && <dl className={styles.recipientInfo}>
              <div><dt>{en ? "Category" : "Kategori"}</dt><dd>{recipient.category}</dd></div>
              <div><dt>{en ? "Household" : "Keluarga"}</dt><dd>{recipient.household_size} {en ? "people" : "orang"}</dd></div>
              <div><dt>{en ? "Available" : "Siap pakai"}</dt><dd>{currentWalletActiveCount} {en ? "vouchers" : "kupon"}</dd></div>
            </dl>}
          </section>

          <section className={styles.card} aria-labelledby="resident-vouchers-heading">
            <div className={styles.cardHeading}>
              <h2 id="resident-vouchers-heading"><Ticket size={17} aria-hidden="true" />{en ? "Voucher list" : "Daftar kupon"}</h2>
              <span className={styles.count}>{currentWalletVouchers.length}</span>
            </div>
            {currentWalletVouchers.length ? (
              <ul className={styles.list}>
                {currentWalletVouchers.map(item => <li key={item.id}>
                  <button type="button" aria-pressed={voucher?.id === item.id} className={styles.choice} onClick={() => setSelectedVoucherForQR(item)}>
                    <span className={styles.choiceRow}><span className={styles.choiceCode}><code>{item.short_code}</code>{voucher?.id === item.id && <Check size={15} aria-hidden="true" />}</span><VoucherStatus status={item.status} lang={lang} /></span>
                    <strong>{item.commodity_name}</strong>
                    <span className={styles.muted}>{item.commodity_items}</span>
                    <span className={styles.choiceRow}><b>{formatRupiah(item.nominal_idr)}</b><span className={styles.muted}>{en ? "Expires" : "Berlaku s/d"} {formatDateTime(item.expires_at)}</span></span>
                  </button>
                </li>)}
              </ul>
            ) : <p className={styles.empty}>{en ? "This resident has no vouchers yet." : "Belum ada kupon untuk warga ini."}</p>}
          </section>

          <p className={styles.guidance}><Info size={17} aria-hidden="true" /><span>{en ? "Redeem vouchers for essential goods at partner stores. Vouchers cannot be exchanged for cash." : "Kupon hanya dapat ditukar dengan sembako di kedai mitra dan tidak dapat diuangkan."}</span></p>
        </div>

        {voucher ? (
          <article id="voucher-workspace-preview" className={styles.voucher} aria-label={en ? "Selected voucher" : "Kupon terpilih"}>
            <div className={styles.feature} onPointerMove={tiltVoucher} onPointerLeave={event => {
              event.currentTarget.style.removeProperty("--tilt-x");
              event.currentTarget.style.removeProperty("--tilt-y");
            }}>
              <div className={styles.featureTop}><span><Ticket size={17} aria-hidden="true" />CivicLedger</span><VoucherStatus status={voucher.status} lang={lang} /></div>
              <div className={styles.amount}><span>{en ? "Food aid voucher" : "Kupon Bantuan Sembako"}</span><VoucherAmount amount={voucher.nominal_idr} /></div>
              <div className={styles.featureMeta} key={voucher.id}>
                <div><h2>{voucher.beneficiary_name}</h2><p><MapPin size={14} aria-hidden="true" />{voucher.rt_rw}</p></div>
                <div><strong>{voucher.commodity_name}</strong><p>{voucher.commodity_items}</p><p>{en ? "Valid until" : "Berlaku hingga"} <time dateTime={voucher.expires_at}>{formatDateTime(voucher.expires_at)}</time></p></div>
              </div>
            </div>

            <div className={styles.voucherBody}>
              <div className={styles.redemption}>
                <div className={styles.qrFrame}>
                  {qrDataUrl ? <img src={qrDataUrl} alt={en ? "Voucher QR code" : "QR kupon"} width={480} height={480} />
                    : <span role="status">{en ? "Generating QR…" : "Membuat QR…"}</span>}
                </div>
                <div className={styles.instructions}>
                  <h3>{en ? "Show at a partner store" : "Tunjukkan di Kedai Mitra"}</h3>
                  <p>{en ? "Show this QR to the store owner or read out the voucher code." : "Tunjukkan QR ini ke pemilik kedai atau sebutkan kode kupon."}</p>
                  <div className={styles.shortCode}>
                    <div><span>{en ? "Voucher code" : "Kode kupon"}</span><code>{voucher.short_code}</code></div>
                    <button type="button" className={"no-print " + styles.copyCode} onClick={copyVoucherCode} disabled={copying} aria-busy={copying} aria-label={en ? "Copy voucher code" : "Salin kode kupon"}>
                      {copied?.ok ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                    </button>
                  </div>
                  {copied && <p className="no-print" role="status">{copied.ok ? (en ? "Code copied." : "Kode disalin.") : (en ? "Could not copy. Select the code to copy it manually." : "Gagal menyalin. Pilih kode untuk menyalin manual.")}</p>}
                </div>
              </div>

              <div className={`no-print ${styles.technical}`}>
                <button type="button" aria-expanded={showVoucherTechDetails} aria-controls={technicalId} onClick={() => setShowVoucherTechDetails(!showVoucherTechDetails)}>
                  <span><Lock size={15} aria-hidden="true" />{en ? "Technical details (HMAC & Nonce)" : "Detail Teknis (HMAC & Nonce)"}</span><ChevronDown size={17} aria-hidden="true" />
                </button>
                <div id={technicalId} className={styles.techBody} data-open={showVoucherTechDetails} aria-hidden={!showVoucherTechDetails}>
                  <dl>
                    <div><dt>ID</dt><dd><code>{voucher.id}</code></dd></div>
                    <div><dt>Nonce</dt><dd><code>{voucher.nonce}</code></dd></div>
                    <div><dt>HMAC-SHA256</dt><dd><code>{voucher.hmac_signature}</code></dd></div>
                  </dl>
                </div>
              </div>

              <div className={`no-print ${styles.actions}`}>
                {voucher.status === "ACTIVE" && canOpenMerchantPos && (
                  <button type="button" className={styles.primary} onClick={() => onSendToMerchantPos(voucher)}>
                    {en ? "Redeem at Merchant POS" : "Tukar di Kasir Kedai"}<ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                )}
                <button type="button" className={styles.button} onClick={() => onCopySmsSlip(voucher)}>
                  {copiedSms ? <><Check size={16} aria-hidden="true" />{en ? "Copied" : "Tersalin"}</> : <><Copy size={16} aria-hidden="true" />{en ? "Copy SMS / WA" : "Salin SMS / WA"}</>}
                </button>
                <button type="button" className={styles.button} onClick={() => window.print()}><Printer size={16} aria-hidden="true" />{en ? "Print Paper Slip" : "Cetak Kertas"}</button>
              </div>
              {voucher.redeemed_by_merchant_name && <p className={styles.redeemed}>{en ? "Redeemed at" : "Ditukar di"} <strong>{voucher.redeemed_by_merchant_name}</strong></p>}
            </div>
          </article>
        ) : <section className={`${styles.card} ${styles.empty}`}><Ticket size={21} aria-hidden="true" /><h2>{en ? "No voucher selected" : "Belum ada kupon dipilih"}</h2><p>{en ? "Vouchers issued for this resident will appear here." : "Kupon yang diterbitkan untuk warga ini akan muncul di sini."}</p></section>}
      </div>
    </div>
  );
}
