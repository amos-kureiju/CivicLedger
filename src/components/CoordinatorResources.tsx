"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search, Ticket, X } from "lucide-react";
import { formatRupiah, formatStatusLabel } from "@/lib/formatters";
import type { Beneficiary, CommodityItem, Merchant, Voucher, VoucherStatus } from "@/lib/types";
import styles from "./CoordinatorResources.module.css";
import workspace from "./CoordinatorWorkspace.module.css";

const tabs = [
  ["VOUCHERS", "Daftar Kupon", "Vouchers"],
  ["BENEFICIARIES", "Daftar Penerima", "Recipients"],
  ["MERCHANTS", "Mitra Kedai", "Partner Stores"],
  ["PACKAGES", "Paket Sembako", "Food Packages"],
] as const;

export type ResourceView = (typeof tabs)[number][0];
type Status = "ALL" | VoucherStatus;

interface Props {
  requestedVoucher?: Voucher | null;
  clearRequestedVoucher?: () => void;
  en: boolean;
  view: ResourceView;
  onView: (view: ResourceView) => void;
  preview: boolean;
  onFullView: () => void;
  vouchers: Voucher[];
  beneficiaries: Beneficiary[];
  filteredVouchers: Voucher[];
  filteredBeneficiaries: Beneficiary[];
  merchants: Merchant[];
  packages: CommodityItem[];
  voucherQuery: string;
  beneficiaryQuery: string;
  onVoucherQuery: (query: string) => void;
  onBeneficiaryQuery: (query: string) => void;
  status: Status;
  onStatus: (status: Status) => void;
  onAdd: (view: ResourceView) => void;
  onPrint: (voucher: Voucher) => void;
  onSms: (voucher: Voucher) => void;
  onResident: (resident: Beneficiary) => void;
}

const statuses: Status[] = ["ALL", "ACTIVE", "REDEEMED", "SETTLED", "EXPIRED"];

export default function CoordinatorResources(props: Props) {
  const { en, view, onView, preview } = props;
  const [size, setSize] = useState(preview ? 5 : 10);
  const [page, setPage] = useState(1);
  const [otherQuery, setOtherQuery] = useState({ MERCHANTS: "", PACKAGES: "" });
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [menuVoucher, setMenuVoucher] = useState<Voucher | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const tabId = useId();
  const locale = en ? "en" : "id";
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const displayDate = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? date.format(new Date(value)) : "—";
  const query = view === "VOUCHERS" ? props.voucherQuery : view === "BENEFICIARIES" ? props.beneficiaryQuery : otherQuery[view];
  const search = query.trim().toLowerCase();
  const matches = (...values: string[]) => values.some(value => value.toLowerCase().includes(search));
  const counts = { VOUCHERS: props.vouchers.length, BENEFICIARIES: props.beneficiaries.length, MERCHANTS: props.merchants.length, PACKAGES: props.packages.length };
  const actions = {
    VOUCHERS: en ? "Issue voucher" : "Buat Kupon",
    BENEFICIARIES: en ? "Add recipient" : "Tambah Warga",
    MERCHANTS: en ? "Add store" : "Tambah Kedai",
    PACKAGES: en ? "Add package" : "Tambah Paket",
  };

  useEffect(() => setPage(1), [view, query, props.status, size]);
  useEffect(() => setSize(preview ? 5 : 10), [preview]);

  const { requestedVoucher, clearRequestedVoucher } = props;
  useEffect(() => {
    if (!requestedVoucher) return;
    setSelected(requestedVoucher);
    if (!drawer.current?.open) drawer.current?.showModal();
    clearRequestedVoucher?.();
  }, [requestedVoucher, clearRequestedVoucher]);

  function updateQuery(value: string) {
    if (view === "VOUCHERS") props.onVoucherQuery(value);
    else if (view === "BENEFICIARIES") props.onBeneficiaryQuery(value);
    else setOtherQuery(queryByTab => ({ ...queryByTab, [view]: value }));
  }

  function openDetails(voucher: Voucher) {
    menu.current?.hidePopover?.();
    setSelected(voucher);
    drawer.current?.showModal();
  }

  function openActions(button: HTMLButtonElement, voucher: Voucher) {
    const target = menu.current;
    if (!target?.showPopover) { openDetails(voucher); return; }
    const anchor = button.getBoundingClientRect();
    target.style.left = Math.max(8, Math.min(window.innerWidth - 194, anchor.right - 184)) + "px";
    target.style.top = (anchor.bottom + 144 < window.innerHeight ? anchor.bottom + 4 : anchor.top - 140) + "px";
    setMenuVoucher(voucher);
    if (!target.matches(":popover-open")) target.showPopover();
    requestAnimationFrame(() => target.querySelector("button")?.focus());
  }

  function voucherAction(voucher: Voucher, action: "print" | "sms") {
    menu.current?.hidePopover?.();
    drawer.current?.close();
    if (action === "print") props.onPrint(voucher);
    else props.onSms(voucher);
  }

  function lines(primary: ReactNode, secondary: ReactNode) {
    return <><strong>{primary}</strong><small>{secondary}</small></>;
  }
  const columns = {
    VOUCHERS: en ? ["Code / Recipient", "Package / Amount", "Status", "Actions"] : ["Kode Kupon / Penerima", "Paket / Nominal", "Status", "Aksi"],
    BENEFICIARIES: en ? ["Recipient", "Category / Address", "Contact / Household", "Actions"] : ["Penerima", "Kategori / Alamat", "Kontak / Keluarga", "Aksi"],
    MERCHANTS: en ? ["Store / Owner", "Address / Account", "Pending / Settled", "Redemptions"] : ["Kedai / Pemilik", "Alamat / Rekening", "Belum Cair / Cair", "Penukaran"],
    PACKAGES: en ? ["Package", "Contents", "Amount"] : ["Paket", "Isi Paket", "Nominal"],
  }[view];
  const voucherTotals = new Map<string, number>();
  if (view === "BENEFICIARIES") for (const voucher of props.vouchers) voucherTotals.set(voucher.beneficiary_id, (voucherTotals.get(voucher.beneficiary_id) ?? 0) + 1);
  const rows: { id: string; cells: ReactNode[]; voucher?: Voucher }[] = {
    VOUCHERS: () => props.filteredVouchers.map(v => ({ id: v.id, voucher: v, cells: [
      <button className={styles.rowLink} type="button" onClick={() => openDetails(v)}>{lines(<code>{v.short_code}</code>, v.beneficiary_name)}</button>,
      lines(v.commodity_name, formatRupiah(v.nominal_idr)),
      <span className={styles.chip} data-status={v.status}>{formatStatusLabel(v.status, locale)}</span>,
      <button type="button" className={styles.menuTrigger} aria-label={en ? `Actions for ${v.short_code}` : `Aksi untuk ${v.short_code}`} onClick={event => openActions(event.currentTarget, v)}><MoreHorizontal size={20} /></button>,
    ] })),
    BENEFICIARIES: () => props.filteredBeneficiaries.map(b => ({ id: b.id, cells: [
      lines(b.name, <><code>{b.id}</code> · {voucherTotals.get(b.id) ?? 0} {en ? "vouchers" : "kupon"}</>), lines(b.category, b.rt_rw), lines(b.phone || "—", `${b.household_size} · ${b.verified_by || "—"}`),
      <button className={styles.rowLink} type="button" onClick={() => props.onResident(b)}>{en ? "Select" : "Pilih"}</button>,
    ] })),
    MERCHANTS: () => props.merchants.filter(m => matches(m.id, m.name, m.owner, m.rt_rw)).map(m => ({ id: m.id, cells: [
      lines(m.name, `${m.owner} · ${m.id}`), lines(m.rt_rw, m.bank_account || "—"), lines(formatRupiah(m.unsettled_balance_idr), formatRupiah(m.total_settled_idr)), m.redemption_count,
    ] })),
    PACKAGES: () => props.packages.filter(p => matches(p.code, p.name, p.items)).map(p => ({ id: p.code, cells: [
      lines(p.name, <code>{p.code}</code>), p.items, formatRupiah(p.nominal_idr),
    ] })),
  }[view]();
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  const voucher = props.vouchers.find(v => v.id === selected?.id) ?? selected;
  const resident = voucher && props.beneficiaries.find(b => b.id === voucher.beneficiary_id);
  const tabLabel = tabs.find(([id]) => id === view)?.[en ? 2 : 1];

  return (
    <section className={styles.resources} id="coordinator-operations" aria-label={en ? "Resource management" : "Kelola sumber daya"}>
      <div className={styles.header}>
        <h2>{en ? "Resource management" : "Kelola Sumber Daya"}</h2>
        {preview && <button type="button" className={styles.soft} onClick={props.onFullView}>{en ? "View all records" : "Lihat semua data"}</button>}
      </div>
      <div role="tablist" className={styles.tabs} aria-label={en ? "Resources" : "Sumber daya"} onKeyDown={event => {
        const index = tabs.findIndex(([id]) => id === view);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault();
        onView(tabs[next][0]);
        event.currentTarget.querySelectorAll("button")[next]?.focus();
      }}>
        {tabs.map(([id, label, english]) => <button key={id} id={`${tabId}-${id}`} role="tab" type="button" aria-selected={view === id} aria-controls={`${tabId}-panel`} tabIndex={view === id ? 0 : -1} onClick={() => onView(id)}>{en ? english : label}<span>{counts[id]}</span></button>)}
      </div>
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${view}`}>
        <div className={styles.toolbar}>
          <label><Search size={16} aria-hidden="true" /><input type="search" aria-label={en ? "Search records" : "Cari data"} placeholder={en ? "Search records…" : "Cari data…"} value={query} onChange={event => updateQuery(event.target.value)} /></label>
          {view === "VOUCHERS" && <select aria-label={en ? "Filter status" : "Filter status"} value={props.status} onChange={event => props.onStatus(event.target.value as Status)}>
            {statuses.map(status => <option key={status} value={status}>{status === "ALL" ? (en ? "All statuses" : "Semua status") : formatStatusLabel(status, locale)}</option>)}
          </select>}
          <button type="button" className={styles.primary} onClick={() => props.onAdd(view)}><Plus size={16} />{actions[view]}</button>
        </div>
        <div key={view} className={styles.tableFrame}>
          <table aria-label={tabLabel} data-resource={view}>
            <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
            <tbody>{rows.slice(start, start + size).map(row => <tr key={row.id} data-clickable={row.voucher ? true : undefined} onClick={row.voucher ? (event) => { if (row.voucher && !(event.target as HTMLElement).closest("button")) openDetails(row.voucher); } : undefined}>{row.cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}
              {!rows.length && <tr><td colSpan={columns.length} className={styles.empty}>{en ? "No matching records." : "Tidak ada data yang cocok."}</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className={styles.pagination}>
          <span aria-live="polite">{rows.length ? start + 1 : 0}–{Math.min(start + size, rows.length)} / {rows.length} {en ? "records" : "data"}</span>
          <div>
            <select aria-label={en ? "Records per page" : "Data per halaman"} value={size} onChange={event => setSize(Number(event.target.value))}>{[5,10,20].map(value => <option key={value} value={value}>{value} / {en ? "page" : "hal."}</option>)}</select>
            <button type="button" disabled={current <= 1} aria-label={en ? "Previous page" : "Halaman sebelumnya"} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></button>
            <span>{current} / {pages}</span>
            <button type="button" disabled={current >= pages} aria-label={en ? "Next page" : "Halaman berikutnya"} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></button>
          </div>
        </footer>
      </div>

      <div className={styles.actions} popover="auto" ref={menu}>
        {menuVoucher && <>
          <button type="button" onClick={() => openDetails(menuVoucher)}>{en ? "View details" : "Lihat detail"}</button>
          <button type="button" onClick={() => voucherAction(menuVoucher, "print")}>{en ? "Print voucher slip" : "Cetak slip kupon"}</button>
          <button type="button" onClick={() => voucherAction(menuVoucher, "sms")}>{en ? "Copy SMS" : "Salin SMS kupon"}</button>
        </>}
      </div>

      <dialog className={`${workspace.dialog} ${styles.detail}`} aria-labelledby={`${tabId}-detail`} ref={drawer}>
        <header className={workspace.dialogHead}><h2 id={`${tabId}-detail`}>{en ? "Voucher details" : "Detail Kupon"}</h2><button type="button" onClick={() => drawer.current?.close()} aria-label={en ? "Close" : "Tutup"}><X size={19} /></button></header>
        {voucher && <>
          <div className={styles.ticket}><Ticket size={22} aria-hidden="true" /><small>{voucher.commodity_name}</small><strong>{formatRupiah(voucher.nominal_idr)}</strong><code>{voucher.short_code}</code></div>
          <dl className={styles.details}>
            {[
              [en ? "Recipient" : "Penerima", `${voucher.beneficiary_name} · ${voucher.beneficiary_id}`],
              ["RT / RW", voucher.rt_rw],
              [en ? "Phone" : "Telepon", resident?.phone],
              [en ? "Package" : "Paket", `${voucher.commodity_name} · ${voucher.commodity_code}`],
              [en ? "Contents" : "Isi paket", voucher.commodity_items],
              [en ? "Issued" : "Diterbitkan", displayDate(voucher.issued_at)],
              [en ? "Expires" : "Berlaku hingga", displayDate(voucher.expires_at)],
              ["Status", formatStatusLabel(voucher.status, locale)],
              [en ? "Redeemed at" : "Waktu penukaran", displayDate(voucher.redeemed_at)],
              [en ? "Redeemed by store" : "Kedai penukar", voucher.redeemed_by_merchant_name ?? voucher.redeemed_by_merchant_id],
              [en ? "Settlement batch" : "Batch pencairan", voucher.settlement_batch_id],
            ].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value || "—"}</dd></div>)}
          </dl>
          <details className={styles.technical}><summary>{en ? "Technical identifiers" : "Identitas teknis"}</summary><dl className={styles.details}><div><dt>ID</dt><dd><code>{voucher.id}</code></dd></div><div><dt>Nonce</dt><dd><code>{voucher.nonce}</code></dd></div><div><dt>HMAC</dt><dd><code>{voucher.hmac_signature}</code></dd></div></dl></details>
          <div className={styles.detailActions}><button type="button" className={styles.primary} onClick={() => voucherAction(voucher, "print")}>{en ? "Print voucher slip" : "Cetak slip kupon"}</button><button type="button" className={styles.soft} onClick={() => voucherAction(voucher, "sms")}>{en ? "Copy SMS" : "Salin SMS kupon"}</button></div>
        </>}
      </dialog>
    </section>
  );
}
