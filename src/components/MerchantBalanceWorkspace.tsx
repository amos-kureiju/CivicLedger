"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Download, Ellipsis, LoaderCircle, Printer, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { formatDateTime, formatRupiah } from "@/lib/formatters";
import { MERCHANT_BALANCE_COPY, UI_COPY, type AppLang } from "@/lib/i18n";
import type { ChainVerificationResult, LedgerEntry, Merchant, OfflineRedemptionQueueItem, ReconciliationLog, SettlementBatch } from "@/lib/types";
import styles from "./MerchantBalanceWorkspace.module.css";

type Copy = (typeof MERCHANT_BALANCE_COPY)[AppLang];
type Tab = "vouchers" | "sync" | "settlements";
type VoucherRow = { kind: "ledger"; entry: LedgerEntry } | { kind: "pending"; entry: OfflineRedemptionQueueItem };
type Detail = { kind: "voucher"; row: VoucherRow } | { kind: "settlement"; batch: SettlementBatch } | { kind: "verify" } | { kind: "hash" };
type Status = "unsettled" | "settled" | "pending";
const tabs: Tab[] = ["vouchers", "sync", "settlements"];
const sizes = [5, 10, 20];
const byNewest = (a: string, b: string) => Date.parse(b) - Date.parse(a);
const rowTime = (row: VoucherRow) => row.kind === "ledger" ? row.entry.timestamp : row.entry.redeemed_at;
const rowStatus = (row: VoucherRow): Status => row.kind === "pending" ? "pending" : row.entry.settlement_batch_id ? "settled" : "unsettled";
const offlineRow = (row: VoucherRow) => row.kind === "pending" || row.entry.sync_mode === "OFFLINE_BATCH_SYNC";
const dateKey = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" });

interface Props {
  lang: AppLang;
  merchant?: Merchant;
  ledger: LedgerEntry[];
  queue: OfflineRedemptionQueueItem[];
  logs: ReconciliationLog[];
  settlements: SettlementBatch[];
  onVerify: () => Promise<ChainVerificationResult>;
  onExport: () => void;
}

function closePopoverOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape" || !event.currentTarget.open) return;
  event.preventDefault();
  event.currentTarget.open = false;
  event.currentTarget.querySelector("summary")?.focus();
}

function DateCell({ iso, lang }: { iso: string; lang: AppLang }) {
  const date = new Date(iso);
  return <time dateTime={iso}>
    {date.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })}
    <small>{date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false })}</small>
  </time>;
}

function Badge({ tone, children }: { tone: "positive" | "pending" | "negative"; children: ReactNode }) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>;
}

function Summary({ merchant, copy }: { merchant?: Merchant; copy: Copy }) {
  return <section className={styles.summary} aria-label={copy.title}>
    {merchant ? <>
      <dl>
        <div><dt>{copy.unsettled}</dt><dd key={merchant.unsettled_balance_idr}>{formatRupiah(merchant.unsettled_balance_idr)}</dd></div>
        <div><dt>{copy.settled}</dt><dd key={merchant.total_settled_idr}>{formatRupiah(merchant.total_settled_idr)}</dd></div>
        <div><dt>{copy.accepted}</dt><dd key={merchant.redemption_count}>{merchant.redemption_count}</dd></div>
      </dl>
      <div className={styles.summaryFoot}>
        <span>{merchant.unsettled_balance_idr > 0 ? copy.waiting : copy.clear}</span>
        {merchant.bank_account && <span>{copy.account} <code>{merchant.bank_account}</code></span>}
      </div>
    </> : <p>{copy.missing}</p>}
  </section>;
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return <dl className={styles.facts}>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function SettlementFacts({ batch, copy }: { batch: SettlementBatch; copy: Copy }) {
  return <Facts items={[
    [copy.settlementId, <code>{batch.id}</code>],
    [copy.date, formatDateTime(batch.settled_at)],
    [copy.amount, formatRupiah(batch.total_amount_idr)],
    [copy.received, batch.voucher_count],
    [copy.status, copy.completed],
    ...(batch.bank_account ? [[copy.account, <code>{batch.bank_account}</code>] as [string, ReactNode]] : []),
    [copy.batchHash, <code>{batch.batch_hash}</code>],
  ]} />;
}

function Pagination({ count, page, pageSize, setPage, setPageSize, copy }: {
  count: number; page: number; pageSize: number; setPage: (page: number) => void; setPageSize: (size: number) => void; copy: Copy;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return <div className={styles.pagination}>
    <span aria-live="polite">{count} {copy.records}</span>
    <div>
      <select aria-label={copy.pageSize} value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
        {sizes.map((size) => <option key={size}>{size}</option>)}
      </select>
      <button type="button" aria-label={copy.previous} disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button>
      <span aria-live="polite">{copy.page} {page}/{pages}</span>
      <button type="button" aria-label={copy.next} disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button>
    </div>
  </div>;
}

export default function MerchantBalanceWorkspace({ lang, merchant, ledger, queue, logs, settlements, onVerify, onExport }: Props) {
  const copy = MERCHANT_BALANCE_COPY[lang];
  const common = UI_COPY[lang];
  const id = useId();
  const [tab, setTab] = useState<Tab>("vouchers");
  const [direction, setDirection] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [check, setCheck] = useState<"idle" | "busy" | "failed" | ChainVerificationResult>("idle");
  const panel = useRef<HTMLDivElement>(null);
  const transition = useRef<Animation | null>(null);
  const previousHeight = useRef<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const checking = useRef(false);

  const recordedIds = new Set([...ledger, ...logs].map((entry) => entry.client_tx_id).filter(Boolean));
  const pending = queue.filter((entry) => !entry.synced && !recordedIds.has(entry.client_tx_id));
  const rows: VoucherRow[] = [
    ...ledger.map((entry) => ({ kind: "ledger" as const, entry })),
    ...pending.map((entry) => ({ kind: "pending" as const, entry })),
  ].sort((a, b) => byNewest(rowTime(a), rowTime(b)));
  const search = query.trim().toLocaleLowerCase(lang);
  const matches = rows.filter((row) =>
    (!search || [row.entry.short_code, row.entry.commodity_name, row.entry.voucher_id, row.entry.client_tx_id, row.kind === "ledger" ? row.entry.id : ""].some((value) => value.toLocaleLowerCase(lang).includes(search))) &&
    (!status || rowStatus(row) === status) &&
    (!mode || offlineRow(row) === (mode === "offline")) &&
    (!date || dateKey.format(new Date(rowTime(row))) === date),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matches.length / pageSize)));
  const visibleRows = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const tabIndex = tabs.indexOf(tab);
  const counts = { vouchers: rows.length, sync: logs.length + pending.length, settlements: settlements.length };
  const receipts = [...settlements].sort((a, b) => byNewest(a.settled_at, b.settled_at));
  const syncRows = [
    ...logs.map((entry) => ({ key: entry.id, code: entry.short_code, time: entry.processed_at, result: entry.outcome === "SYNCED" ? "synced" as const : "rejected" as const, reason: entry.reason })),
    ...pending.map((entry) => ({ key: entry.queue_id, code: entry.short_code, time: entry.redeemed_at, result: "pending" as const, reason: entry.is_simulated_conflict ? copy.simulationTest : "" })),
  ].sort((a, b) => byNewest(a.time, b.time));
  const modeLabel = (row: VoucherRow) => offlineRow(row) ? common.offline : common.online;
  const statusLabel = (row: VoucherRow) => rowStatus(row) === "pending" ? copy.pendingSync : copy[rowStatus(row)];

  useLayoutEffect(() => {
    const element = panel.current;
    const from = previousHeight.current;
    previousHeight.current = null;
    if (!element || from === null) return;
    const to = element.getBoundingClientRect().height;
    if (Math.abs(from - to) < 2) return;
    const resize = element.animate([{ height: from + "px", overflow: "clip" }, { height: to + "px", overflow: "clip" }], {
      duration: 240, easing: "cubic-bezier(.22, 1, .36, 1)",
    });
    return () => resize.cancel();
  }, [tab]);

  function selectTab(next: Tab) {
    transition.current?.cancel();
    if (next === tab) return;
    const sign = tabs.indexOf(next) > tabIndex ? 1 : -1;
    const apply = () => { setDirection(sign); setTab(next); };
    if (!panel.current || matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
    const height = panel.current.getBoundingClientRect().height;
    const animation = panel.current.animate([{ opacity: 1 }, { opacity: 0, transform: "translateX(" + (-sign * 4) + "px)" }], {
      duration: 100, easing: "cubic-bezier(.22, 1, .36, 1)",
    });
    transition.current = animation;
    void animation.finished.then(() => {
      if (transition.current !== animation) return;
      previousHeight.current = height;
      apply();
    }, () => {});
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    document.getElementById(id + "-" + tabs[next])?.focus();
    selectTab(tabs[next]);
  }

  function open(next: Detail, origin: HTMLElement) {
    trigger.current = origin;
    setDetail(next);
    if (!dialog.current?.open) dialog.current?.showModal();
  }

  async function verify() {
    if (checking.current) return;
    checking.current = true;
    setCheck("busy");
    try { setCheck(await onVerify()); }
    catch { setCheck("failed"); }
    finally { checking.current = false; }
  }

  const drawerTitle = detail?.kind === "voucher" ? copy.transaction : detail?.kind === "settlement" ? copy.settlementDetail : detail?.kind === "hash" ? copy.hash : copy.verify;
  const verification = typeof check === "object" ? check : null;
  const drawerRow = detail?.kind === "voucher" ? rows.find((row) => row.entry.client_tx_id && row.entry.client_tx_id === detail.row.entry.client_tx_id) ?? detail.row : null;
  const resolvedPending = drawerRow?.kind === "pending" ? logs.find((log) => log.client_tx_id === drawerRow.entry.client_tx_id) : undefined;
  const drawerStatus = resolvedPending?.outcome === "SYNCED" ? copy.synced : resolvedPending ? copy.rejected : null;

  return <div className={styles.workspace}>
    <header className={styles.heading}>
      <h1>{copy.title} <span>{copy.titleEnd}</span></h1>
      <div className={styles.actions + " no-print"}>
        <button type="button" aria-haspopup="dialog" onClick={(event) => { open({ kind: "verify" }, event.currentTarget); void verify(); }}><ShieldCheck size={17} />{copy.verify}</button>
        <details className={styles.options} onKeyDown={closePopoverOnEscape}>
          <summary aria-label={copy.options} title={copy.options}><Ellipsis size={20} /></summary>
          <div><button type="button" aria-haspopup="dialog" onClick={(event) => {
            const menu = event.currentTarget.closest("details");
            if (!menu) return;
            menu.open = false;
            open({ kind: "hash" }, menu.querySelector("summary") ?? menu);
          }}>{copy.hash}</button></div>
        </details>
      </div>
    </header>

    <Summary merchant={merchant} copy={copy} />

    <section className={styles.history} aria-label={copy.history}>
      <div className={styles.tabs + " no-print"} role="tablist" aria-label={copy.history}>
        {tabs.map((name) => <button type="button" key={name} id={id + "-" + name} role="tab" aria-selected={tab === name} aria-controls={id + "-panel"} tabIndex={tab === name ? 0 : -1}
          onClick={() => selectTab(name)} onKeyDown={(event) => navigateTabs(event, tabs.indexOf(name))}>
          {copy[name]} <span>({counts[name]})</span>
        </button>)}
        <span className={styles.underline} aria-hidden="true" data-layout-id="merchant-history-active-tab" style={{ transform: "translateX(" + (tabIndex * 100) + "%)" }} />
      </div>
      {pending.length > 0 && <p className={styles.warning} role="status">{pending.length} {copy.records} &middot; {copy.pendingSync}</p>}
      <div ref={panel} id={id + "-panel"} role="tabpanel" aria-labelledby={id + "-" + tab} className={styles.panel} tabIndex={0}>
        <div key={tab} className={styles.tabContent} data-direction={direction}>
        {tab === "vouchers" && <>
          <form className={styles.toolbar + " no-print"} onSubmit={(event) => event.preventDefault()}>
            <label className={styles.search}><Search size={16} aria-hidden="true" /><input type="search" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
            <select aria-label={copy.status} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">{copy.anyStatus}</option><option value="unsettled">{copy.unsettled}</option><option value="settled">{copy.settled}</option><option value="pending">{copy.pendingSync}</option>
            </select>
            <details className={styles.filters} onKeyDown={closePopoverOnEscape}>
              <summary><SlidersHorizontal size={16} aria-hidden="true" />{copy.filters}{(mode || date) && <span>({Number(Boolean(mode)) + Number(Boolean(date))})</span>}</summary>
              <div>
                <select aria-label={copy.mode} value={mode} onChange={(event) => { setMode(event.target.value); setPage(1); }}>
                  <option value="">{copy.anyMode}</option><option value="online">{common.online}</option><option value="offline">{common.offline}</option>
                </select>
                <div className={styles.dateFilter}>
                  <input type="date" aria-label={copy.filterDate} title={copy.filterDate} value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} />
                  {date && <button type="button" aria-label={copy.clearDate} onClick={() => { setDate(""); setPage(1); }}><X size={16} /></button>}
                </div>
              </div>
            </details>
          </form>
          {visibleRows.length ? <table className={styles.table} aria-label={copy.vouchers}>
            <thead><tr>{[copy.voucherPackage, copy.date, copy.amount, copy.status, copy.mode, copy.actions].map((label) => <th key={label} scope="col" className={label === copy.amount ? styles.money : undefined}>{label}</th>)}</tr></thead>
            <tbody>{visibleRows.map((row, index) => <tr key={row.entry.client_tx_id || (row.kind === "ledger" ? row.entry.id : row.entry.queue_id)} style={{ animationDelay: (index % 5) * 24 + "ms" }}>
              <td><code>{row.entry.short_code}</code><small>{row.entry.commodity_name}{row.kind === "pending" && row.entry.is_simulated_conflict ? " / " + copy.simulationTest : ""}</small></td>
              <td><DateCell iso={rowTime(row)} lang={lang} /></td>
              <td className={styles.money}>{formatRupiah(row.entry.nominal_idr)}</td>
              <td><Badge tone={rowStatus(row) === "settled" ? "positive" : "pending"}>{statusLabel(row)}</Badge></td>
              <td>{modeLabel(row)}</td>
              <td><button className={styles.rowAction} type="button" aria-label={copy.detail + " " + row.entry.short_code} aria-haspopup="dialog" onClick={(event) => open({ kind: "voucher", row }, event.currentTarget)}>{copy.detail}</button></td>
            </tr>)}</tbody>
          </table> : <p className={styles.empty}>{rows.length ? copy.noMatches : copy.emptyVouchers}</p>}
          <Pagination count={matches.length} page={currentPage} pageSize={pageSize} setPage={setPage} setPageSize={(size) => { setPageSize(size); setPage(1); }} copy={copy} />
        </>}
        {tab === "sync" && <>
          <div className={styles.tabToolbar}><button type="button" onClick={onExport}><Download size={16} />{copy.download}</button></div>
          {syncRows.length ? <ul className={styles.records}>{syncRows.map((row) => <li key={row.key}>
            <div><code>{row.code}</code>{row.reason && <small>{row.reason}</small>}</div>
            <DateCell iso={row.time} lang={lang} />
            <Badge tone={row.result === "synced" ? "positive" : row.result === "pending" ? "pending" : "negative"}>{copy[row.result]}</Badge>
          </li>)}</ul> : <p className={styles.empty}>{copy.emptySync}</p>}
        </>}
        {tab === "settlements" && <>
          <div className={styles.tabToolbar}><span>{copy.simulation}</span><button type="button" onClick={() => window.print()}><Printer size={16} />{copy.print}</button></div>
          {receipts.length ? <ul className={styles.records}>{receipts.map((batch) => <li key={batch.id}>
            <div><code>{batch.id}</code><small>{batch.voucher_count} {copy.vouchers.toLocaleLowerCase(lang)}</small></div>
            <DateCell iso={batch.settled_at} lang={lang} />
            <strong className={styles.money}>{formatRupiah(batch.total_amount_idr)}</strong>
            <Badge tone="positive">{copy.completed}</Badge>
            <button className={styles.rowAction} type="button" aria-label={copy.detail + " " + batch.id} aria-haspopup="dialog" onClick={(event) => open({ kind: "settlement", batch }, event.currentTarget)}>{copy.detail}</button>
          </li>)}</ul> : <p className={styles.empty}>{copy.emptySettlements}</p>}
        </>}
        </div>
      </div>
      {tab === "settlements" && <div className={styles.printReceipts}>
        <h2>{copy.settlementDetail}</h2><p>{merchant?.name} &middot; {copy.simulation}</p>
        {receipts.length ? receipts.map((batch) => <article key={batch.id}><SettlementFacts batch={batch} copy={copy} /></article>) : <p>{copy.emptySettlements}</p>}
        {merchant && <p>{copy.settled} <strong>{formatRupiah(merchant.total_settled_idr)}</strong></p>}
      </div>}
    </section>

    <dialog ref={dialog} className={styles.drawer + " no-print"} aria-labelledby={id + "-drawer"} onClose={() => (trigger.current?.isConnected ? trigger.current : panel.current)?.focus()}
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.drawerBody}>
        <header><h2 id={id + "-drawer"}>{drawerTitle}</h2><button type="button" autoFocus aria-label={copy.close} onClick={() => dialog.current?.close()}><X size={19} /></button></header>
        {drawerRow && <>
          <Facts items={[
            [copy.transactionId, <code>{drawerRow.kind === "ledger" ? drawerRow.entry.id : drawerRow.entry.client_tx_id}</code>],
            [copy.voucherCode, <code>{drawerRow.entry.short_code}</code>],
            [copy.voucherId, <code>{drawerRow.entry.voucher_id}</code>],
            [copy.package, drawerRow.entry.commodity_name],
            [copy.date, formatDateTime(rowTime(drawerRow))],
            [copy.amount, formatRupiah(drawerRow.entry.nominal_idr)],
            [copy.status, drawerStatus ?? statusLabel(drawerRow)],
            [copy.mode, modeLabel(drawerRow)],
            [copy.syncStatus, drawerStatus ?? (drawerRow.kind === "pending" ? copy.pendingSync : offlineRow(drawerRow) ? copy.synced : copy.recorded)],
            ...(resolvedPending?.reason ? [[copy.reason, resolvedPending.reason] as [string, ReactNode]] : []),
            ...(drawerRow.kind === "ledger" && drawerRow.entry.settlement_batch_id ? [[copy.settlementId, <code>{drawerRow.entry.settlement_batch_id}</code>] as [string, ReactNode]] : []),
          ]} />
          <details className={styles.hashDetails}><summary>{copy.hash}</summary>
            {drawerRow.kind === "ledger" ? <Facts items={[[copy.previousHash, <code>{drawerRow.entry.prev_hash}</code>], [copy.currentHash, <code>{drawerRow.entry.tx_hash}</code>]]} />
              : <Facts items={[[copy.localHash, <code>{drawerRow.entry.local_receipt_hash}</code>]]} />}
          </details>
        </>}
        {detail?.kind === "settlement" && <><p className={styles.warning}>{copy.simulation}</p><SettlementFacts batch={detail.batch} copy={copy} /></>}
        {detail?.kind === "hash" && <div className={styles.hashList}>
          {ledger.length ? ledger.map((entry) => <details className={styles.hashDetails} key={entry.id}><summary><code>{entry.short_code} / {entry.id}</code></summary>
            <Facts items={[[copy.previousHash, <code>{entry.prev_hash}</code>], [copy.currentHash, <code>{entry.tx_hash}</code>]]} />
          </details>) : <p>{copy.noHashes}</p>}
        </div>}
        {detail?.kind === "verify" && <>
          <div className={styles.verifyState} role="status" aria-busy={check === "busy"}>
            {check === "busy" ? <LoaderCircle size={20} className={styles.spinner} /> : verification?.valid ? <Check size={20} className={styles.check} /> : (check === "failed" || verification) && <AlertTriangle size={20} />}
            <strong>{check === "busy" ? copy.verifying : check === "failed" ? copy.verifyFailed : verification ? (verification.valid ? copy.verifyOK : copy.verifyChanged) : copy.verifyIdle}</strong>
          </div>
          <p className={styles.muted}>{copy.verificationNote}</p>
          {verification && !verification.valid && ledger.some((entry) => entry.id === verification.broken_at_id) && <p><code>{verification.broken_at_id}</code></p>}
          <button type="button" disabled={check === "busy"} onClick={() => void verify()}>{copy.verifyAgain}</button>
        </>}
      </div>
    </dialog>
  </div>;
}
