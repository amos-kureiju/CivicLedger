"use client";

import { ArrowUpRight, Clock3, Store, Ticket, Users, WifiOff } from "lucide-react";
import { formatRupiah, formatStatusLabel } from "@/lib/formatters";
import type { Beneficiary, LedgerEntry, Merchant, Voucher } from "@/lib/types";
import styles from "./CoordinatorOverview.module.css";

export function getOperationalReminders(vouchers: Voucher[], pending: number, en: boolean, now = Date.now()) {
  const expiring = vouchers.filter(voucher => {
    const expires = Date.parse(voucher.expires_at);
    return voucher.status === "ACTIVE" && expires > now && expires - now <= 172800000;
  }).length;
  const awaitingSettlement = vouchers.filter(voucher => voucher.status === "REDEEMED").length;
  return [
    { key: "sync", count: pending, label: en ? "Offline transactions pending sync" : "Transaksi offline menunggu sinkronisasi" },
    { key: "expiry", count: expiring, label: en ? "Vouchers expiring in 48 hours" : "Kupon kedaluwarsa dalam 48 jam" },
    { key: "settlement", count: awaitingSettlement, label: en ? "Redeemed vouchers awaiting settlement" : "Kupon ditukar menunggu pencairan" },
  ].filter(item => item.count > 0);
}

export default function CoordinatorOverview({ en, vouchers, beneficiaries, merchants, ledger, pending, onVoucher, onResource }: {
  en: boolean;
  vouchers: Voucher[];
  beneficiaries: Beneficiary[];
  merchants: Merchant[];
  ledger: LedgerEntry[];
  pending: number;
  onVoucher: (voucher: Voucher) => void;
  onResource: (view: "BENEFICIARIES" | "MERCHANTS") => void;
}) {
  const timeZone = "Asia/Jakarta";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" });
  const clock = new Intl.DateTimeFormat(en ? "en" : "id", { timeZone, hour: "2-digit", minute: "2-digit" });
  const today = day.format(new Date());
  const activity = [
    ...vouchers.map(voucher => ({ id: voucher.id, date: Date.parse(voucher.issued_at), type: en ? "Voucher issued" : "Kupon diterbitkan", code: voucher.short_code })),
    ...ledger.map(entry => ({ id: entry.id, date: Date.parse(entry.timestamp), type: en ? "Voucher redeemed" : "Kupon ditukar", code: entry.short_code })),
  ].filter(item => Number.isFinite(item.date) && day.format(item.date) === today).sort((a, b) => b.date - a.date);
  const reminders = getOperationalReminders(vouchers, pending, en);
  const recent = [...vouchers].sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at)).slice(0, 3);
  const activeStores = merchants.filter(merchant => merchant.redemption_count > 0).sort((a, b) => b.redemption_count - a.redemption_count);
  return (
    <aside className={styles.rail} aria-label={en ? "Operations overview" : "Ringkasan operasional tambahan"}>
      <section className={styles.panel}>
        <h2><Clock3 size={17} />{en ? "Today's Activity" : "Aktivitas Hari Ini"}</h2>
        {activity.length ? <ul className={styles.timeline}>{activity.slice(0, 4).map(item => <li key={item.type + item.id}><time dateTime={new Date(item.date).toISOString()}>{clock.format(item.date)}</time><div><strong>{item.type}</strong><code>{item.code}</code></div></li>)}</ul>
          : <p>{en ? "No voucher activity recorded today." : "Belum ada aktivitas kupon tercatat hari ini."}</p>}
      </section>

      <section className={styles.panel} id="coordinator-reminders">
        <h2><WifiOff size={17} />{en ? "Operational Reminders" : "Pengingat Operasional"}</h2>
        {reminders.length ? <ul className={styles.reminders}>{reminders.map(item => <li key={item.key}><strong>{item.count}</strong>{item.label}</li>)}</ul>
          : <p>{en ? "No operational reminders." : "Tidak ada pengingat operasional."}</p>}
      </section>

      <section className={styles.panel}>
        <h2><Ticket size={17} />{en ? "Recent Vouchers" : "Kupon Terbaru"}</h2>
        {recent.length ? <ul className={styles.records}>{recent.map(voucher => <li key={voucher.id}><button type="button" onClick={() => onVoucher(voucher)}><span><code>{voucher.short_code}</code><small>{formatStatusLabel(voucher.status, en ? "en" : "id")}</small></span><strong>{formatRupiah(voucher.nominal_idr)}</strong></button></li>)}</ul>
          : <p>{en ? "No vouchers have been issued." : "Belum ada kupon diterbitkan."}</p>}
      </section>

      <section className={styles.panel}>
        <h2><Users size={17} />{en ? "Recent Recipients" : "Warga Terbaru"}<button type="button" onClick={() => onResource("BENEFICIARIES")} aria-label={en ? "View recipients" : "Lihat daftar penerima"}><ArrowUpRight size={16} /></button></h2>
        {beneficiaries.length ? <ul className={styles.records}>{beneficiaries.slice(-3).reverse().map(resident => <li key={resident.id}><strong>{resident.name}</strong><small>{resident.rt_rw}</small></li>)}</ul>
          : <p>{en ? "No recipients registered." : "Belum ada warga terdaftar."}</p>}
      </section>

      <section className={styles.panel}>
        <h2><Store size={17} />{en ? "Active Partners" : "Kedai Mitra Aktif"}<button type="button" onClick={() => onResource("MERCHANTS")} aria-label={en ? "View partners" : "Lihat mitra kedai"}><ArrowUpRight size={16} /></button></h2>
        {activeStores.length ? <ul className={styles.records}>{activeStores.slice(0, 3).map(merchant => <li key={merchant.id}><strong>{merchant.name}</strong><small>{merchant.redemption_count} {en ? "redemptions" : "penukaran"}</small></li>)}</ul>
          : <p>{en ? "No partner stores have recorded redemptions." : "Belum ada kedai dengan penukaran tercatat."}</p>}
      </section>
    </aside>
  );
}
