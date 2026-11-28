"use client";

import { useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Camera, CameraOff, CheckCircle2, ImageUp, Keyboard, LoaderCircle, RefreshCw, ScanLine, ShieldAlert, ShieldCheck, Store, X } from "lucide-react";
import { formatOutcomeLabel, formatRupiah, formatShortTime, formatStatusLabel, type CryptoVerificationTrace } from "@/lib/formatters";
import { encodeVoucherToQRPayload } from "@/lib/crypto";
import type { BatchSyncResultItem, LedgerEntry, Merchant, OfflineRedemptionQueueItem, Voucher } from "@/lib/types";
import styles from "./MerchantWorkspace.module.css";

interface Props {
  en: boolean;
  merchant?: Merchant;
  online: boolean;
  offlineMode: boolean;
  demo: boolean;
  simulation: boolean;
  onToggleSimulation: () => void;
  demoVouchers: Voucher[];
  code: string;
  onCode: (code: string, qr?: string) => void;
  codeFormatValid: boolean;
  cameraActive: boolean;
  cameraPending: boolean;
  cameraError: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onToggleCamera: () => void;
  onStopCamera: () => void;
  onUpload: (file: File) => void;
  uploadPending: boolean;
  uploadError: string;
  verifying: boolean;
  verificationError: string;
  trace: CryptoVerificationTrace | null;
  syncError?: string;
  onVerify: (simulate?: boolean) => void;
  onClear: () => void;
  queue: OfflineRedemptionQueueItem[];
  syncing: boolean;
  onSync: () => void;
  syncResults: BatchSyncResultItem[];
  transactions: LedgerEntry[];
  rejectedCount: number;
  onDuplicateTest: () => void;
  onHistory: () => void;
}

const methods = ["camera", "upload", "manual"] as const;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.panel}><h2>{title}</h2>{children}</section>;
}

function Metrics({ items }: { items: [string, string | number][] }) {
  return <dl className={styles.metrics}>{items.map(([label, value]) => (
    <div key={label}><dt>{label}</dt><dd key={value}>{value}</dd></div>
  ))}</dl>;
}

export function maskSettlementAccount(value: string) {
  const account = value.trim();
  const digits = account.match(/[0-9]{4,}$/)?.[0].slice(-4);
  const masked = account.match(/^([^\d]*[•*]{2,}\s*)\d{1,4}$/);
  return masked ? account : digits ? `•• ${digits}` : "";
}

function MerchantHeader({ merchant, en }: Pick<Props, "merchant" | "en">) {
  if (!merchant) return null;
  return <section className={styles.identity}>
    <div className={styles.identityInfo}>
      <span className={styles.storeIcon}><Store size={22} /></span>
      <div><h2>{merchant.name}</h2><p>{[merchant.owner, merchant.rt_rw].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
    <Metrics items={[
      [en ? "Unsettled" : "Belum Cair", formatRupiah(merchant.unsettled_balance_idr)],
      [en ? "Settled" : "Sudah Cair", formatRupiah(merchant.total_settled_idr)],
      [en ? "Total Vouchers" : "Total Kupon", merchant.redemption_count],
    ]} />
  </section>;
}

function VoucherScanner(p: Props) {
  const [method, setMethod] = useState<(typeof methods)[number]>("camera");
  const [cameraPlaying, setCameraPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const id = useId();
  const tr = (idText: string, enText: string) => p.en ? enText : idText;
  const chooseMethod = (next: typeof method) => {
    if (next === method) return;
    p.onStopCamera();
    setCameraPlaying(false);
    setMethod(next);
  };
  const busy = p.verifying || p.syncing || p.uploadPending;
  const ready = Boolean(p.merchant && p.code.trim()) && !busy && !p.cameraActive && !p.cameraPending;

  return <Panel title={tr("Terima Kupon", "Accept Voucher")}>
    <div className={styles.methods} role="group" aria-label={tr("Metode pemindaian", "Scan method")} style={{ "--method": methods.indexOf(method) } as CSSProperties}>
      {methods.map((item, i) => {
        const Icon = [ScanLine, ImageUp, Keyboard][i];
        return <button key={item} type="button" aria-pressed={item === method} aria-controls={id} disabled={p.uploadPending} onClick={() => chooseMethod(item)}>
          <Icon size={17} />{[tr("Scan QR", "Scan QR"), tr("Unggah Foto", "Upload Photo"), tr("Input Kode", "Enter Code")][i]}
        </button>;
      })}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); if (ready) p.onVerify(); }}>
      <div id={id} className={styles.inputPanel}>
        {method === "camera" && <div className={styles.camera} data-active={p.cameraActive} data-playing={p.cameraActive && cameraPlaying}>
          {p.cameraActive && <video ref={p.videoRef} autoPlay playsInline muted onPlaying={() => setCameraPlaying(true)} onWaiting={() => setCameraPlaying(false)} />}
          <div className={styles.frame} aria-hidden="true"><i /><i /><i /><i /><span /></div>
          {!p.cameraActive && <div className={styles.cameraPrompt}>
            <ScanLine size={26} />
          </div>}
          <button className={styles.cameraButton} type="button" disabled={p.cameraPending || !p.cameraActive && (busy || !p.merchant)} onClick={() => { setCameraPlaying(false); p.onToggleCamera(); }}>
            {p.cameraPending ? <LoaderCircle className={styles.spin} size={17} /> : p.cameraActive ? <CameraOff size={17} /> : <Camera size={17} />}
            {p.cameraPending ? tr("Membuka kamera…", "Opening camera…") : p.cameraActive ? tr("Tutup kamera", "Close camera") : tr("Buka Kamera", "Open camera")}
          </button>
        </div>}
        {method === "camera" && p.cameraError && <p className={styles.error} role="alert">{p.cameraError}</p>}
        {method === "upload" && <div className={styles.upload}>
          <ImageUp size={30} />
          <label htmlFor={`${id}-photo`}>{tr("Pilih foto QR", "Choose a QR photo")}</label>
          <input id={`${id}-photo`} type="file" accept="image/*" disabled={busy || !p.merchant} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) { setFileName(file.name); p.onUpload(file); }
            event.currentTarget.value = "";
          }} />
          <p aria-live="polite">{p.uploadPending ? tr("Membaca foto…", "Reading photo…") : fileName || tr("Gunakan foto dengan QR yang jelas.", "Use an image with a clearly visible QR code.")}</p>
          {p.uploadError && <p className={styles.error} role="alert">{p.uploadError}</p>}
        </div>}
        {method === "manual" && <div className={styles.manual}>
          <label htmlFor={`${id}-code`}>{tr("Kode kupon", "Voucher code")}</label>
          <input id={`${id}-code`} type="text" value={p.code} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="CL-8841-K9" aria-invalid={Boolean(p.code.trim()) && !p.codeFormatValid} aria-describedby={p.code && !p.codeFormatValid ? `${id}-hint` : undefined} onChange={(event) => p.onCode(event.currentTarget.value.toUpperCase())} />
          {p.code && !p.codeFormatValid && <p id={`${id}-hint`}>{tr("Periksa kembali kode kupon.", "Double-check the voucher code.")}</p>}
        </div>}
      </div>
      <button className={styles.primary} type="submit" disabled={!ready || method !== "manual"}>
        {p.verifying ? <LoaderCircle className={styles.spin} size={18} /> : <ShieldCheck size={18} />}
        {p.offlineMode ? tr("Cek & Simpan Offline", "Verify & Save Offline") : tr("Cek & Terima Kupon", "Verify & Accept Voucher")}
      </button>
      {method !== "manual" && <p className={styles.hint}>{tr("Kupon diproses otomatis setelah QR terbaca.", "Vouchers are processed automatically when the QR is read.")}</p>}
    </form>
    {p.demo && p.demoVouchers.length > 0 && <details className={styles.disclosure}>
      <summary>{tr("Pilih Kupon", "Select Voucher")}</summary>
      <select aria-label={tr("Kupon demo", "Demo voucher")} value={p.demoVouchers.some((v) => v.short_code === p.code) ? p.code : ""} disabled={p.verifying || p.uploadPending} onChange={(event) => {
        const voucher = p.demoVouchers.find((v) => v.short_code === event.target.value);
        if (!voucher) return;
        chooseMethod("manual");
        p.onCode(voucher.short_code, encodeVoucherToQRPayload(voucher));
      }}>
        <option value="">{tr("Pilih kupon demo", "Select a demo voucher")}</option>
        {p.demoVouchers.map((v) => <option key={v.id} value={v.short_code}>{v.short_code} · {formatStatusLabel(v.status, p.en ? "en" : "id")}</option>)}
      </select>
    </details>}
  </Panel>;
}

function VoucherVerificationResult({ en, verifying, verificationError, trace, onClear, syncResults, syncError, transactions }: Pick<Props, "en" | "verifying" | "verificationError" | "trace" | "onClear" | "syncResults" | "syncError" | "transactions">) {
  const tr = (id: string, eng: string) => en ? eng : id;
  const syncResult = syncResults.find((result) => result.client_tx_id === trace?.clientTxId);
  const valid = trace?.hmacValid && trace.doubleSpendCheckPassed && trace.expiryCheckPassed;
  const error = verificationError || syncError || (syncResult?.status === "CONFLICT" ? syncResult.reason : trace?.errorReason);
  const recorded = Boolean(trace?.clientTxId && (syncResult?.status === "SYNCED" || transactions.some((entry) => entry.client_tx_id === trace.clientTxId)));
  const pending = trace?.mode === "OFFLINE_INDEXEDDB" && !recorded;
  return <Panel title={tr("Hasil Verifikasi", "Verification result")}>
    <div aria-live="polite" aria-busy={verifying}>
      {verifying ? <div className={styles.status}><LoaderCircle size={25} className={styles.spin} /><strong>{tr("Memeriksa kupon…", "Checking voucher…")}</strong></div>
        : error ? <div className={styles.rejected}>
          <ShieldAlert size={23} /><div><strong>{tr("Kupon ditolak.", "Voucher rejected.")}</strong><p>{error}</p><button type="button" onClick={onClear}>{tr("Bersihkan hasil", "Clear result")}</button></div>
        </div>
        : valid && trace ? <div className={styles.ticket} key={trace.clientTxId}>
          <div className={styles.ticketTop}><span><CheckCircle2 size={16} />{tr("Kupon valid.", "Voucher valid.")}</span><code>{trace.shortCode}</code></div>
          <strong className={styles.amount}>{formatRupiah(trace.nominalIdr)}</strong>
          <p>{trace.commodityName}</p>
          <div className={styles.ticketFoot}>{pending ? tr("Menunggu sinkronisasi.", "Pending sync.") : recorded ? tr("Transaksi tercatat.", "Transaction recorded.") : tr("Transaksi belum tercatat.", "Transaction not yet recorded.")}</div>
        </div>
        : <div className={styles.status}><ScanLine size={25} /><div><strong>{tr("Menunggu kupon.", "Waiting for a voucher.")}</strong></div></div>}
    </div>
  </Panel>;
}

function OfflineQueue({ en, online, offlineMode, queue, syncing, onSync, syncResults }: Pick<Props, "en" | "online" | "offlineMode" | "queue" | "syncing" | "onSync" | "syncResults">) {
  const tr = (id: string, eng: string) => en ? eng : id;
  return <>
    {queue.length === 0 ? <p className={styles.queueEmpty}><CheckCircle2 size={17} />{tr("Antrean kosong", "Queue is clear")}</p> : <>
      <div className={styles.queueHead} aria-live="polite">
        <span>{queue.length} {tr("tersimpan · menunggu sinkronisasi", "saved · pending sync")}</span>
        <button className={styles.secondary} type="button" onClick={onSync} disabled={syncing || !online}><RefreshCw size={15} className={syncing ? styles.spin : undefined} />{syncing ? tr("Mengirim…", "Syncing…") : tr("Kirim ke pusat", "Sync to server")}</button>
      </div>
      <ul className={styles.rows}>{queue.map((item) => <li key={item.queue_id}><div><code>{item.short_code}</code><small>{formatShortTime(item.redeemed_at)}{item.is_simulated_conflict && ` · ${tr("Tes kupon ganda", "Duplicate test")}`}</small></div><strong>{formatRupiah(item.nominal_idr)}</strong></li>)}</ul>
    </>}
    {offlineMode && <p className={styles.hint}>{tr("Pencatatan offline aktif.", "Offline recording is active.")}</p>}
    {syncResults.length > 0 && <details className={styles.disclosure}><summary>{tr("Hasil sinkronisasi terakhir", "Latest sync results")}</summary>
      <ul className={styles.rows}>{syncResults.map((result) => <li key={result.client_tx_id}><div><code>{result.short_code}</code><small>{result.reason}</small></div><strong>{formatOutcomeLabel(result.outcome, en ? "en" : "id")}</strong></li>)}</ul>
    </details>}
  </>;
}

function RecentTransactions({ en, transactions, onHistory }: Pick<Props, "en" | "transactions" | "onHistory">) {
  return <section className={styles.panel}>
    <div className={styles.sectionHeading}><h2>{en ? "Recent Transactions" : "Transaksi Terakhir"}</h2>
      <button className={styles.history} type="button" onClick={onHistory}>{en ? "View All" : "Lihat Semua"}</button>
    </div>
    {transactions.length === 0 ? <p className={styles.hint}>{en ? "No transactions yet." : "Belum ada transaksi."}</p> :
      <ul className={styles.rows}>{[...transactions].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 3).map((entry) => <li key={entry.id}>
        <div><code>{entry.short_code}</code><small>{formatShortTime(entry.timestamp)} WIB</small></div>
        <div className={styles.transactionValue}><strong>{formatRupiah(entry.nominal_idr)}</strong><small>{entry.sync_mode === "ONLINE" ? "Online" : "Offline"} · {entry.settlement_batch_id ? (en ? "Settled" : "Sudah cair") : (en ? "Recorded" : "Tercatat")}</small></div>
      </li>)}</ul>}
  </section>;
}

export default function MerchantWorkspace(p: Props) {
  const tr = (id: string, en: string) => p.en ? en : id;
  const checkoutBusy = p.cameraActive || p.cameraPending || p.uploadPending || p.verifying || p.syncing;
  const drawer = useRef<HTMLDialogElement>(null);
  const queueTrigger = useRef<HTMLButtonElement>(null);
  const drawerTitle = useId();
  return <div className={styles.checkout}>
    <div className={styles.sectionHeading}>
      <h1>{tr("Kasir Kedai", "Merchant Checkout")}</h1>
      {p.demo && <details className={styles.simulation}>
        <summary>{tr("Simulasi Demo", "Demo Simulation")}</summary>
        <div className={styles.simActions} onClick={(event) => { if ((event.target as Element).closest("button:enabled")) event.currentTarget.closest("details")?.removeAttribute("open"); }}>
          <button className={styles.secondary} type="button" aria-pressed={p.simulation} disabled={!p.online || checkoutBusy} onClick={p.onToggleSimulation}>{p.simulation ? tr("Akhiri simulasi offline", "End offline simulation") : tr("Simulasikan offline", "Simulate offline")}</button>
          <button className={styles.secondary} type="button" disabled={checkoutBusy || !p.demoVouchers.some((v) => v.short_code === p.code)} onClick={() => p.onVerify(true)}>{tr("Tes Kupon Palsu", "Test Invalid Voucher")}</button>
          <button className={styles.secondary} type="button" disabled={checkoutBusy} onClick={p.onDuplicateTest}>{tr("Tes Kupon Ganda", "Test Duplicate Voucher")}</button>
        </div>
      </details>}
    </div>
    <MerchantHeader merchant={p.merchant} en={p.en} />
    <div className={styles.columns}>
      <VoucherScanner {...p} />
      <div className={styles.stack}>
        <VoucherVerificationResult {...p} />
        <RecentTransactions {...p} />
      </div>
    </div>
    <section className={styles.panel} aria-label={tr("Statistik kasir", "Checkout statistics")}>
      <dl className={styles.metrics}>
        <div><dt>{tr("Antrean Offline", "Offline Queue")}</dt><dd aria-live="polite">
          {p.queue.length || p.syncResults.length ? <button ref={queueTrigger} className={styles.history} type="button" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()} aria-label={tr("Lihat antrean offline", "View offline queue") + " (" + p.queue.length + ")"}>{p.queue.length}</button> : 0}
        </dd></div>
        <div><dt>{tr("Kupon Ditolak", "Rejected Vouchers")}</dt><dd>{p.rejectedCount}</dd></div>
        <div><dt>{tr("Transaksi Tercatat", "Recorded Transactions")}</dt><dd>{p.merchant?.redemption_count ?? p.transactions.length}</dd></div>
      </dl>
      {(p.queue.length > 0 || p.offlineMode) && <div className={styles.queueHead}>
        <span role="status">{p.queue.length > 0 ? tr("Menunggu sinkronisasi.", "Pending sync.") : tr("Mode offline aktif.", "Offline mode active.")}</span>
        {p.queue.length > 0 && <button className={styles.secondary} type="button" onClick={p.onSync} disabled={p.syncing || !p.online}><RefreshCw size={15} className={p.syncing ? styles.spin : undefined} />{p.syncing ? tr("Mengirim…", "Syncing…") : tr("Sinkronkan", "Sync")}</button>}
      </div>}
    </section>
    <dialog className={styles.drawer} ref={drawer} aria-labelledby={drawerTitle} onClose={() => queueTrigger.current?.focus()}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className={styles.drawerContent}>
        <div className={styles.sectionHeading}>
          <h2 id={drawerTitle}>{tr("Antrean Offline", "Offline Queue")}</h2>
          <button type="button" className={styles.secondary} aria-label={tr("Tutup", "Close")} onClick={() => drawer.current?.close()}><X size={18} /></button>
        </div>
        <OfflineQueue {...p} />
      </div>
    </dialog>
  </div>;
}
