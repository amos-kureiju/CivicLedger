"use client";

import { useId, useMemo, useState } from "react";
import { ArrowUpRight, Ticket } from "lucide-react";
import { formatRupiah, formatStatusLabel } from "@/lib/formatters";
import type { LedgerEntry, Voucher, VoucherStatus } from "@/lib/types";
import styles from "./CoordinatorWorkspace.module.css";

const statuses: { id: VoucherStatus; color: string }[] = [
  { id: "ACTIVE", color: "#8dc7ec" }, { id: "REDEEMED", color: "#f04438" },
  { id: "SETTLED", color: "#334967" }, { id: "EXPIRED", color: "#a5aebc" },
];

export default function CoordinatorAnalytics({ vouchers, ledger, en, onOpen, onAll, onReports }: {
  vouchers: Voucher[];
  ledger: LedgerEntry[];
  en: boolean;
  onOpen: (voucher: Voucher) => void;
  onAll: () => void;
  onReports: () => void;
}) {
  const headingId = useId();
  const [period, setPeriod] = useState(6);
  const { counts, recent, months } = useMemo(() => {
    const counts: Record<VoucherStatus, number> = { ACTIVE: 0, REDEEMED: 0, SETTLED: 0, EXPIRED: 0 };
    const validMonth = (value: string) => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.getUTCFullYear() * 12 + date.getUTCMonth() : null;
    };
    const dates = [...vouchers.flatMap(v => [v.issued_at, v.redeemed_at ?? ""]), ...ledger.map(entry => entry.timestamp)];
    const latest = dates.reduce((result, date) => Math.max(result, validMonth(date) ?? -1), -1);
    const months = latest < 0 ? [] : Array.from({ length: period }, (_, index) => {
      const key = latest - period + index + 1;
      const date = new Date(Date.UTC(Math.floor(key / 12), key % 12, 1));
      return { key, date, issued: 0, issuedValue: 0, redeemed: 0, spending: 0, synced: 0 };
    });
    const byMonth = new Map(months.map(month => [month.key, month]));
    for (const voucher of vouchers) {
      counts[voucher.status]++;
      const issue = byMonth.get(validMonth(voucher.issued_at) ?? -1);
      if (issue) { issue.issued++; issue.issuedValue += voucher.nominal_idr; }
      const redemption = byMonth.get(validMonth(voucher.redeemed_at ?? "") ?? -1);
      if (redemption) redemption.redeemed++;
    }
    for (const entry of ledger) {
      const month = byMonth.get(validMonth(entry.timestamp) ?? -1);
      if (month) { month.spending += entry.nominal_idr; if (entry.sync_mode === "OFFLINE_BATCH_SYNC") month.synced++; }
    }
    return {
      counts, months,
      recent: [...vouchers].sort((a, b) => b.issued_at.localeCompare(a.issued_at)).slice(0, 4),
    };
  }, [ledger, period, vouchers]);
  const labels = new Intl.DateTimeFormat(en ? "en" : "id", { month: "short", year: "2-digit", timeZone: "UTC" });
  const amountMax = Math.max(1, ...months.map(month => month.issuedValue));
  const countMax = Math.max(1, ...months.flatMap(month => [month.issued, month.redeemed]));
  const spendMax = Math.max(1, ...months.map(month => month.spending));
  let arcStart = 0;
  const empty = en ? "No recorded data for this period." : "Belum ada data tercatat untuk periode ini.";

  return (
    <section className={styles.analytics} id="coordinator-analytics" aria-labelledby={headingId}>
      <h2 id={headingId}>{en ? "Distribution analytics" : "Analitik penyaluran"}</h2>
      <div className={styles.modules}>
        <article className={styles.module}>
          <h3>{en ? "Voucher status" : "Status Distribusi Kupon"}</h3>
          <div className={styles.ring}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="49" fill="none" stroke="var(--line-soft)" strokeWidth="13" />
              {statuses.map(({ id, color }) => {
                const share = vouchers.length ? counts[id] / vouchers.length * 100 : 0;
                const offset = arcStart;
                arcStart += share;
                return share > 0 && <circle key={id} cx="60" cy="60" r="49" fill="none" stroke={color} strokeWidth="13" pathLength="100" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
              })}
            </svg>
            <div><strong>{vouchers.length}</strong><small>{en ? "Vouchers" : "Kupon"}</small></div>
          </div>
          <ul className={styles.legend}>{statuses.map(({ id, color }) => <li key={id}><i style={{ background: color }} />{formatStatusLabel(id, en ? "en" : "id")}<strong>{counts[id]}</strong></li>)}</ul>
        </article>

        <article className={styles.module}>
          <h3>{en ? "Monthly aid distribution" : "Distribusi Bantuan per Bulan"}</h3>
          <p className={styles.muted}>{en ? "Issued voucher value · IDR" : "Nilai kupon diterbitkan · Rupiah"}</p>
          {!months.length ? <p className={styles.empty}>{empty}</p> : <div className={styles.bars}>
            {months.map((month) => <div key={month.key} className={styles.barColumn}>
              <button type="button" data-empty={month.issuedValue === 0} style={{ "--height": `${month.issuedValue / amountMax * 100}%` } as React.CSSProperties} aria-label={`${labels.format(month.date)}: ${formatRupiah(month.issuedValue)}`}>
                <span className={styles.tooltip}>{formatRupiah(month.issuedValue)}</span>
              </button>
              <small>{labels.format(month.date)}</small>
            </div>)}
          </div>}
        </article>

        <article className={styles.module}>
          <div className={styles.moduleHead}><h3>{en ? "Recent vouchers" : "Kupon Terbaru"}</h3><button type="button" onClick={onAll}>{en ? "View all" : "Lihat semua"} <ArrowUpRight size={14} /></button></div>
          <ul className={styles.recent}>
            {recent.map(voucher => <li key={voucher.id}><button type="button" onClick={() => onOpen(voucher)}>
              <span className={styles.recentIcon}><Ticket size={16} /></span>
              <span><code>{voucher.short_code}</code><small>{voucher.beneficiary_name}</small><time dateTime={voucher.issued_at}>{new Date(voucher.issued_at).toLocaleDateString(en ? "en" : "id", { day: "numeric", month: "short" })}</time></span>
              <span><strong>{formatRupiah(voucher.nominal_idr)}</strong><small className={styles.status} data-state={voucher.status}>{formatStatusLabel(voucher.status, en ? "en" : "id")}</small></span>
            </button></li>)}
          </ul>
          {!recent.length && <p className={styles.empty}>{empty}</p>}
        </article>
      </div>

      <article className={styles.module}>
        <div className={styles.activityHead}>
          <div>
            <h3>{en ? "Distribution & Spending Activity" : "Analisis Aktivitas Penyaluran & Belanja"}</h3>
            <p className={styles.muted}>{en ? "Track aid distribution, voucher redemption, and partner store spending." : "Pantau distribusi bantuan, penggunaan kupon, dan aktivitas belanja di kedai mitra."}</p>
          </div>
          <div className={styles.activityControls}>
            <select aria-label={en ? "Period" : "Periode"} value={period} onChange={event => setPeriod(Number(event.target.value))}>
              {[3, 6, 12].map(value => <option key={value} value={value}>{value} {en ? "months" : "bulan"}</option>)}
            </select>
            <button type="button" onClick={onReports}>{en ? "Reports" : "Laporan"} <ArrowUpRight size={15} /></button>
          </div>
        </div>
        {!months.length ? <p className={styles.empty}>{empty}</p> : <div className={styles.detail}>
          <div>
            <h4>{en ? "Vouchers (count)" : "Kupon (jumlah)"}</h4>
            <p className={styles.muted}><i className={styles.key} />{en ? "Issued" : "Diterbitkan"} <i className={styles.keyRed} />{en ? "Redeemed" : "Ditukar"}</p>
            <div className={styles.bars}>{months.map(month => (
              <div key={month.key} className={styles.barColumn}>
                <button type="button" className={styles.pair} aria-label={`${labels.format(month.date)}: ${month.issued} / ${month.redeemed}`}><span style={{ height: `${month.issued / countMax * 100}%` }} /><span style={{ height: `${month.redeemed / countMax * 100}%` }} /><span className={styles.tooltip}>{month.issued} / {month.redeemed}</span></button>
                <small>{period < 12 ? labels.format(month.date) : month.date.getUTCMonth() + 1}</small>
              </div>
            ))}</div>
          </div>
          <div>
            <h4>{en ? "Partner store spending (IDR)" : "Belanja kedai mitra (Rupiah)"}</h4>
            <p className={styles.muted}>{months.reduce((sum, month) => sum + month.synced, 0)} {en ? "offline transactions synced" : "transaksi offline tersinkron"}</p>
            <div className={styles.line}>
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline fill="none" stroke="#f04438" strokeWidth="2.5" vectorEffect="non-scaling-stroke" points={months.map((month, index) => `${10 + 280 * index / Math.max(1, months.length - 1)},${92 - 79 * month.spending / spendMax}`).join(" ")} />
              </svg>
              <div>{months.map(month => <button type="button" key={month.key} aria-label={`${labels.format(month.date)}: ${formatRupiah(month.spending)}`}><span className={styles.tooltip}>{formatRupiah(month.spending)}</span><small>{period < 12 ? labels.format(month.date) : month.date.getUTCMonth() + 1}</small></button>)}</div>
            </div>
          </div>
        </div>}
      </article>
    </section>
  );
}
