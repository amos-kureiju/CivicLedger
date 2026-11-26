"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, Store, Ticket } from "lucide-react";
import { formatRupiah, formatStatusLabel } from "@/lib/formatters";
import type { LedgerEntry, Voucher, VoucherStatus } from "@/lib/types";
import styles from "./CoordinatorBento.module.css";

const statuses: { id: VoucherStatus; color: string }[] = [
  { id: "ACTIVE", color: "#8dc7ec" }, { id: "REDEEMED", color: "#f04438" },
  { id: "SETTLED", color: "#526887" }, { id: "EXPIRED", color: "#a5aebc" },
];
const dayMs = 86400000;
const validTime = (value?: string | null) => {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : null;
};

export default function CoordinatorAnalytics({ vouchers, ledger, turnover, merchantCount, en, onReports }: {
  vouchers: Voucher[];
  ledger: LedgerEntry[];
  turnover: number;
  merchantCount: number;
  en: boolean;
  onReports: () => void;
}) {
  const title = useId();
  const gradient = useId();
  const [period, setPeriod] = useState(6);
  const [active, setActive] = useState<number | null>(null);
  const locale = en ? "en" : "id";
  const { counts, months, timeline } = useMemo(() => {
    const counts: Record<VoucherStatus, number> = { ACTIVE: 0, REDEEMED: 0, SETTLED: 0, EXPIRED: 0 };
    const events = vouchers.flatMap(voucher => [
      { time: validTime(voucher.issued_at), value: voucher.nominal_idr, issued: 1 },
      { time: validTime(voucher.redeemed_at), value: 0, issued: 0 },
    ]).filter((event): event is { time: number; value: number; issued: number } => event.time !== null);
    for (const voucher of vouchers) counts[voucher.status]++;
    if (!events.length) return { counts, months: [], timeline: { rows: [], daily: false } };

    const monthKey = (time: number) => {
      const date = new Date(time);
      return date.getUTCFullYear() * 12 + date.getUTCMonth();
    };
    const latest = events.reduce((max, event) => Math.max(max, event.time), -Infinity);
    const monthEnd = monthKey(latest);
    const months = Array.from({ length: period }, (_, i) => {
      const key = monthEnd - period + i + 1;
      return { key, date: new Date(Date.UTC(Math.floor(key / 12), key % 12, 1)), issued: 0, redeemed: 0, value: 0 };
    });
    const daily = new Set(events.map(event => monthKey(event.time))).size <= 1;
    const dailyEnd = Math.floor(latest / dayMs);
    const dailyRows = Array.from({ length: 7 }, (_, i) => {
      const key = dailyEnd - 6 + i;
      return { key, date: new Date(key * dayMs), issued: 0, redeemed: 0, value: 0 };
    });
    const monthlyByKey = new Map(months.map(month => [month.key, month]));
    const dailyByKey = new Map(dailyRows.map(day => [day.key, day]));
    for (const event of events) {
      const month = monthlyByKey.get(monthKey(event.time));
      const day = dailyByKey.get(Math.floor(event.time / dayMs));
      for (const bucket of [month, day]) {
        if (!bucket) continue;
        bucket.value += event.value;
        if (event.issued) bucket.issued++; else bucket.redeemed++;
      }
    }
    return { counts, months, timeline: { rows: daily ? dailyRows : months, daily } };
  }, [period, vouchers]);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const dateFormatter = new Intl.DateTimeFormat(locale, timeline.daily
    ? { day: "numeric", month: "short", timeZone: "UTC" }
    : { month: "short", year: "2-digit", timeZone: "UTC" });
  const amountMax = months.reduce((max, row) => Math.max(max, row.value), 1);
  const countMax = timeline.rows.reduce((max, row) => Math.max(max, row.issued, row.redeemed), 1);
  const countTicks = Array.from(new Set([countMax, Math.round(countMax * .75), Math.round(countMax * .5), Math.round(countMax * .25), 0]));
  const issued = timeline.rows.reduce((sum, row) => sum + row.issued, 0);
  const redeemed = timeline.rows.reduce((sum, row) => sum + row.redeemed, 0);
  const storeTotals = new Map<string, { name: string; value: number }>();
  for (const entry of ledger) {
    const previous = storeTotals.get(entry.merchant_id);
    storeTotals.set(entry.merchant_id, { name: entry.merchant_name, value: (previous?.value ?? 0) + entry.nominal_idr });
  }
  const topStores = [...storeTotals.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 3);
  const offlineSynced = ledger.filter(entry => entry.sync_mode === "OFFLINE_BATCH_SYNC").length;
  const empty = en ? "No recorded data." : "Belum ada data tercatat.";
  const x = (index: number) => 12 + 276 * index / Math.max(1, timeline.rows.length - 1);
  const y = (value: number) => 124 - 108 * value / countMax;
  const points = (field: "issued" | "redeemed") => timeline.rows.map((row, index) => `${x(index)},${y(row[field])}`).join(" ");
  let arcStart = 0;

  return (
    <section id="coordinator-analytics" aria-labelledby={title} className={styles.analytics}>
      <h2 id={title}>{en ? "Distribution analytics" : "Analitik penyaluran"}</h2>
      <div className={styles.grid}>
        <article className={`${styles.card} ${styles.status}`}>
          <div className={styles.icon}><Ticket size={18} aria-hidden="true" /></div>
          <h3>{en ? "Voucher Distribution Status" : "Status Distribusi Kupon"}</h3>
          <div className={styles.ring}>
            <svg viewBox="0 0 130 130" aria-hidden="true">
              <circle cx="65" cy="65" r="51" fill="none" stroke="var(--line-soft)" strokeWidth="15" />
              {statuses.map(({ id, color }, index) => {
                const share = vouchers.length ? counts[id] / vouchers.length * 100 : 0;
                const offset = arcStart;
                arcStart += share;
                const gap = share >= 6 && share < 100 ? 3.2 : 0;
                const length = Math.max(0, share - gap);
                return length > 0 && (
                  <circle key={id} cx="65" cy="65" r="51" fill="none" stroke={color} strokeWidth="15" strokeLinecap={gap ? "round" : "butt"} pathLength="100"
                    strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-offset - gap / 2} transform="rotate(-90 65 65)"
                    style={{ "--arc": length, "--arc-delay": `${140 + index * 70}ms` } as CSSProperties} />
                );
              })}
            </svg>
            <div><strong>{vouchers.length}</strong><span>{en ? "Vouchers" : "Total kupon"}</span></div>
          </div>
          <ul className={styles.legend}>{statuses.map(({ id, color }) => <li key={id}><i style={{ background: color }} />{formatStatusLabel(id, locale)}<strong>{counts[id]}</strong></li>)}</ul>
        </article>

        <article className={`${styles.card} ${styles.monthly}`}>
          <div className={styles.cardHead}>
            <div><h3>{en ? "Monthly Aid Distribution" : "Distribusi Bantuan per Bulan"}</h3><p>{en ? "Issued voucher value (IDR)" : "Nilai kupon diterbitkan (Rp)"}</p></div>
            <select aria-label={en ? "Monthly period" : "Periode bulanan"} value={period} onChange={event => { setPeriod(Number(event.target.value)); setActive(null); }}>
              {[3, 6, 12].map(value => <option key={value} value={value}>{value} {en ? "months" : "bulan"}</option>)}
            </select>
          </div>
          {!months.some(month => month.issued > 0) ? <p className={styles.empty}>{empty}</p> : (
            <div className={styles.barChart}>
              <span className={styles.barMax}>{formatRupiah(amountMax)}</span>
              <div className={styles.barGrid}>
                {months.map((month, index) => <div key={month.key} className={styles.barColumn}>
                  <button type="button" aria-label={`${monthFormatter.format(month.date)}: ${formatRupiah(month.value)}`}>
                    <i data-empty={!month.value} style={{ height: `${100 * month.value / amountMax}%`, "--bar-delay": `${index * 24}ms` } as CSSProperties} />
                    <span className={styles.tooltip}>{formatRupiah(month.value)}</span>
                  </button>
                  <small>{period <= 6 ? monthFormatter.format(month.date) : month.date.getUTCMonth() + 1}</small>
                </div>)}
              </div>
            </div>
          )}
        </article>

        <article className={`${styles.card} ${styles.spending}`}>
          <span className={styles.icon}><Store size={19} aria-hidden="true" /></span>
          <div><h3>{en ? "Partner Store Spending" : "Belanja di Kedai Mitra"}</h3><strong>{formatRupiah(turnover)}</strong>
            <p>{merchantCount} {en ? "stores" : "kedai"} <span aria-hidden="true">·</span> {offlineSynced} {en ? "offline transactions synced" : "transaksi offline tersinkron"}</p>
            {topStores.length > 0 && <ul className={styles.storeChart} aria-label={en ? "Top stores by recorded spending" : "Kedai dengan belanja tercatat terbesar"}>{topStores.map(([id, store]) => <li key={id}><span>{store.name}</span><strong>{formatRupiah(store.value)}</strong><i style={{ width: (100 * store.value / Math.max(1, topStores[0][1].value)) + "%" }} /></li>)}</ul>}
          </div>
        </article>

        <article className={`${styles.card} ${styles.feature}`}>
          <div className={styles.cardHead}>
            <div><h3>{en ? "Distribution Activity" : "Aktivitas Penyaluran"}</h3><p>{timeline.daily ? (en ? "Daily · Last 7 recorded days" : "Harian · 7 hari terakhir pada data") : (en ? "Monthly · Voucher counts" : "Bulanan · Jumlah kupon")}</p></div>
            <button type="button" onClick={onReports}>{en ? "Reports" : "Laporan"} <ArrowUpRight size={14} /></button>
          </div>
          <div className={styles.trackTotals}>
            <div><strong>{issued}</strong><span><i />{en ? "Issued" : "Diterbitkan"}</span></div>
            <div><strong>{redeemed}</strong><span><i />{en ? "Redeemed" : "Ditukar"}</span></div>
          </div>
          {!issued && !redeemed ? <p className={styles.empty}>{empty}</p> : <>
            <div className={styles.featureChart}>
              <div className={styles.axis} aria-hidden="true">{countTicks.map(value =>
                <span key={value} style={{ top: `${100 * y(value) / 140}%` }}>{value}</span>
              )}</div>
              <svg viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true">
                <defs><linearGradient id={gradient} x2="0%" y2="100%"><stop stopColor="#a9d9f7" stopOpacity=".25" /><stop offset="100%" stopColor="#a9d9f7" stopOpacity="0" /></linearGradient></defs>
                {countTicks.map(value => <path key={value} d={`M0 ${y(value)}H300`} stroke="#d8efff30" vectorEffect="non-scaling-stroke" />)}
                <polygon points={`12,124 ${points("issued")} 288,124`} fill={`url(#${gradient})`} className={styles.area} />
                <polyline className={styles.trace} fill="none" stroke="#a9d9f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" points={points("issued")} />
                <polyline className={styles.trace} fill="none" stroke="#f04438" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" points={points("redeemed")} />
                {timeline.rows.map((row, index) => active === index && <g key={row.key}><path d={`M${x(index)} 16V124`} stroke="#d8efff60" strokeDasharray="3 3" /><circle cx={x(index)} cy={y(row.issued)} r="4" fill="#a9d9f7" /><circle cx={x(index)} cy={y(row.redeemed)} r="4" fill="#f86d63" /></g>)}
              </svg>
              <div className={styles.points}>{timeline.rows.map((row, index) => (
                <button type="button" key={row.key} aria-label={`${dateFormatter.format(row.date)} · ${en ? "Issued" : "Diterbitkan"} ${row.issued} · ${en ? "Redeemed" : "Ditukar"} ${row.redeemed}`}
                  onPointerEnter={() => setActive(index)} onPointerLeave={event => { if (document.activeElement !== event.currentTarget) setActive(null); }} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)}>
                  <small>{timeline.rows.length > 7 ? row.date.getUTCMonth() + 1 : dateFormatter.format(row.date)}</small>
                </button>
              ))}</div>
            </div>
            <p className={styles.readout}>{active !== null && timeline.rows[active]
              ? `${dateFormatter.format(timeline.rows[active].date)} · ${en ? "Issued" : "Terbit"} ${timeline.rows[active].issued} · ${en ? "Redeemed" : "Ditukar"} ${timeline.rows[active].redeemed}`
              : en ? "Explore the chart by date." : "Pilih tanggal untuk melihat jumlah kupon."}</p>
          </>}
        </article>
      </div>
    </section>
  );
}
