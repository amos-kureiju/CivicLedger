"use client";

import { useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Store, Ticket } from "lucide-react";
import { buildCalendarActivities, operationalDay, operationalTimeZone, type ActivityKind, type CalendarRecords } from "@/lib/calendar-activities";
import { formatRupiah } from "@/lib/formatters";
import type { Voucher } from "@/lib/types";
import styles from "./OperationalCalendar.module.css";

export type CalendarAvailability = "live" | "cached" | "unavailable" | "loading";
const dayMs = 86400000;
const key = (date: Date) => date.toISOString().slice(0, 10);
const dayDate = (value: string) => new Date(value + "T00:00:00Z");
const pageSize = 5;
const icons = { voucher: Ticket, transaction: Store, sync: RefreshCw };
type Filter = ActivityKind | "all";

export default function OperationalCalendar({ records, availability, offline, en, onVoucher }: {
  records: CalendarRecords;
  availability: CalendarAvailability;
  offline: boolean;
  en: boolean;
  onVoucher: (voucher: Voucher) => void;
}) {
  const title = useId();
  const grid = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => operationalDay(Date.now()));
  const [motion, setMotion] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const locale = en ? "en" : "id";
  const today = operationalDay(Date.now());
  const { byDay, missingTimestamps } = useMemo(() => buildCalendarActivities(availability === "unavailable"
    ? { ...records, vouchers: [], ledger: [], settlementBatches: [], reconciliationLogs: [] }
    : records, en), [records, en, availability]);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const dayFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const clock = new Intl.DateTimeFormat(locale, { timeZone: operationalTimeZone, hour: "2-digit", minute: "2-digit" });

  const selectedDate = dayDate(selected);
  const year = selectedDate.getUTCFullYear();
  const month = selectedDate.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const weekStart = en ? 0 : 1;
  const offset = (first.getUTCDay() - weekStart + 7) % 7;
  const start = first.getTime() - offset * dayMs;
  const weeks = Math.ceil((offset + new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) / 7);
  const dates = Array.from({ length: weeks * 7 }, (_, i) => new Date(start + i * dayMs));
  const activities = (byDay.get(selected) ?? []).filter(activity => filter === "all" || activity.kind === filter);
  const filters = [
    { id: "all", text: en ? "All" : "Semua" },
    { id: "voucher", text: en ? "Vouchers" : "Kupon" },
    { id: "transaction", text: en ? "Transactions" : "Transaksi" },
    { id: "sync", text: en ? "Sync" : "Sinkronisasi" },
  ] as const;

  function selectDay(date: Date, focus = false) {
    const next = key(date);
    if (date.getUTCMonth() !== month || date.getUTCFullYear() !== year) setMotion(date > selectedDate ? 1 : -1);
    setSelected(next);
    setShowAll(false);
    if (focus) requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus());
  }

  function changeMonth(amount: number, focus = false) {
    const last = new Date(Date.UTC(year, month + amount + 1, 0)).getUTCDate();
    selectDay(new Date(Date.UTC(year, month + amount, Math.min(selectedDate.getUTCDate(), last))), focus);
  }

  return (
    <section id="coordinator-operational-calendar" className={styles.calendar} aria-labelledby={title}>
      <header className={styles.header}>
        <h2 id={title}><CalendarDays size={17} aria-hidden="true" />{en ? "Operational Calendar" : "Kalender Operasional"}</h2>
        <button type="button" onClick={() => selectDay(dayDate(today))}>{en ? "Today" : "Hari ini"}</button>
      </header>
      <div className={styles.month}>
        <button type="button" aria-label={en ? "Previous month" : "Bulan sebelumnya"} onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
        <strong aria-live="polite">{monthFormatter.format(first)}</strong>
        <button type="button" aria-label={en ? "Next month" : "Bulan berikutnya"} onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {dates.slice(0, 7).map(date => <span key={key(date)}>{weekdayFormatter.format(date)}</span>)}
      </div>
      <div ref={grid} key={key(first)} className={styles.grid} data-direction={motion} role="group" aria-label={monthFormatter.format(first)}
        onKeyDown={event => {
          const shifts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
          if (event.key === "PageUp" || event.key === "PageDown") {
            event.preventDefault();
            changeMonth(event.key === "PageUp" ? -1 : 1, true);
          } else if (event.key in shifts) {
            event.preventDefault();
            selectDay(new Date(selectedDate.getTime() + shifts[event.key] * dayMs), true);
          }
        }}>
        {dates.map(date => {
          const value = key(date);
          const count = byDay.get(value)?.length ?? 0;
          return <button key={value} type="button" data-date={value} data-outside={date.getUTCMonth() !== month} aria-pressed={value === selected}
            aria-current={value === today ? "date" : undefined} tabIndex={value === selected ? 0 : -1}
            aria-label={dayFormatter.format(date) + (count ? `, ${count} ${en ? "activities" : "aktivitas"}` : "")}
            onClick={() => selectDay(date)}>
            {date.getUTCDate()}{count > 0 && <i aria-hidden="true" />}
          </button>;
        })}
      </div>
      <div className={styles.timeline}>
        <div aria-live="polite">
          <h3>{dayFormatter.format(selectedDate)}</h3>
          {(activities.length > 0 || availability !== "unavailable") && availability !== "loading" && <p>{activities.length} {en ? "recorded activities" : "aktivitas tercatat"}</p>}
        </div>
        {(offline || availability === "cached") && <p className={styles.notice}>{en ? "Offline or cached records. Activity may be incomplete." : "Data offline atau dari cache. Aktivitas mungkin belum lengkap."}</p>}
        {availability === "unavailable" && <p className={styles.notice}>{en ? "Server activity records are unavailable." : "Catatan aktivitas dari server belum tersedia."}</p>}
        {missingTimestamps > 0 && availability !== "unavailable" && <p className={styles.notice}>{en ? "Some records have no reliable timestamp." : "Sebagian catatan tidak memiliki tanggal yang dapat dipastikan."}</p>}
        <div className={styles.filters} role="group" aria-label={en ? "Activity filters" : "Filter aktivitas"}>
          {filters.map(({ id, text }) => <button key={id} aria-pressed={id === filter} type="button" onClick={() => { setFilter(id); setShowAll(false); }}>{text}</button>)}
        </div>
        {availability === "loading" ? <div className={styles.skeleton} role="status" aria-label={en ? "Loading activities" : "Memuat aktivitas"} /> :
          !activities.length ? (availability !== "unavailable" && <p className={styles.notice}>{en ? "No activity on this date." : "Tidak ada aktivitas pada tanggal ini."}</p>) :
          <ol key={selected + filter} className={styles.activities}>
            {(showAll ? activities : activities.slice(0, pageSize)).map(activity => {
              const Icon = icons[activity.kind];
              const voucher = activity.voucherId ? records.vouchers.find(record => record.id === activity.voucherId) : undefined;
              const content = <>
                <Icon size={14} aria-hidden="true" />
                <div><strong>{activity.title}</strong><code>{activity.reference}</code>
                  {activity.party && <span>{activity.party}</span>}
                  {typeof activity.amount === "number" && <span>{formatRupiah(activity.amount)}</span>}
                  {activity.status && <small>{activity.status}</small>}
                </div>
              </>;
              return <li key={activity.id}>
                <time dateTime={new Date(activity.timestamp).toISOString()}>{clock.format(activity.timestamp)}</time>
                {voucher ? <button type="button" className={styles.entry} onClick={() => onVoucher(voucher)}>{content}</button> : <div className={styles.entry}>{content}</div>}
              </li>;
            })}
          </ol>}
        {activities.length > pageSize && <button className={styles.more} type="button" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? (en ? "Show fewer" : "Tampilkan lebih sedikit") : (en ? "Show all activities" : "Tampilkan semua aktivitas")}
        </button>}
      </div>
    </section>
  );
}
