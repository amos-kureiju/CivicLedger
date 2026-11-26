"use client";

import { useState, type PointerEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CloudUpload, Pause, Play, ShieldCheck, Ticket, Users } from "lucide-react";
import BrandLogo from "./BrandLogo";
import frame from "./AuthHeading.module.css";
import styles from "./AuthShowcase.module.css";

const distribution = [34, 57, 48, 72, 66, 92];
const transactions = [
  { id: "DEMO-8K2Q", amount: "Rp150.000", redemption: false },
  { id: "DEMO-5U7C", amount: "Rp100.000", redemption: true },
  { id: "DEMO-3N9P", amount: "Rp150.000", redemption: false },
];

function DecorativeCode() {
  return (
    <svg className={styles.codeArt} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="9" fill="#fffaf0" />
      <path fill="#202b39" d="M8 8h18v18H8zM38 38h18v18H38zM33 8h5v9h-5zM43 10h12v5H43zM45 19h6v9h-6zM30 23h8v11h-8zM10 33h13v6H10zM25 38h8v7h-8zM8 45h8v11H8zM21 50h15v6H21zM41 30h14v4H41z" />
      <path fill="#fffaf0" d="M12 12h10v10H12zM42 42h10v10H42z" />
      <path fill="#c92e25" d="M15 15h4v4h-4zM45 45h4v4h-4z" />
    </svg>
  );
}

export default function AuthShowcase({ en }: { en: boolean }) {
  const [paused, setPaused] = useState(false);

  function moveLight(event: PointerEvent<HTMLElement>) {
    if (paused || event.pointerType !== "mouse" || !window.matchMedia("(min-width: 881px) and (hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const panel = event.currentTarget;
    const { left, top, width, height } = panel.getBoundingClientRect();
    panel.style.setProperty("--pointer-x", ((event.clientX - left) / width * 2 - 1).toFixed(3));
    panel.style.setProperty("--pointer-y", ((event.clientY - top) / height * 2 - 1).toFixed(3));
  }

  function resetLight(panel: HTMLElement) {
    panel.style.removeProperty("--pointer-x");
    panel.style.removeProperty("--pointer-y");
  }

  return (
    <aside
      className={`${frame.showcase} ${styles.scene}`}
      aria-labelledby="showcase-title"
      aria-describedby="showcase-demo"
      data-paused={paused}
      onPointerMove={moveLight}
      onPointerLeave={(event) => resetLight(event.currentTarget)}
    >
      <div className={styles.atmosphere} aria-hidden="true">
        <div className={styles.ribbon} />
        <div className={styles.reflection} />
      </div>

      <header className={styles.identity}>
        <BrandLogo size={36} className={styles.logo} />
        <div>
          <h2 id="showcase-title">CivicLedger</h2>
          <p>{en ? "Community Aid & Digital Vouchers" : "Bantuan Warga & Voucher Digital"}</p>
        </div>
      </header>

      <div className={styles.depth}>
        <section className={`${styles.card} ${styles.analytics}`}>
          <div className={styles.cardHeader}>
            <span className={styles.icon}><ArrowUpRight size={19} /></span>
            <div><h3>{en ? "Aid distribution" : "Distribusi bantuan"}</h3><p>{en ? "Monthly overview" : "Ringkasan bulanan"}</p></div>
          </div>
          <div className={styles.chart} aria-hidden="true">
            {distribution.map((height, index) => <span key={index} style={{ height: height + "%" }} />)}
          </div>
          <div className={styles.months} aria-hidden="true">
            {(en ? ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["Jul", "Agu", "Sep", "Okt", "Nov", "Des"]).map((month) => <span key={month}>{month}</span>)}
          </div>
          <div className={styles.analyticsStats}>
            <div><small>{en ? "Voucher value" : "Nilai kupon"}</small><strong>Rp48,6 jt</strong></div>
            <div><small>{en ? "Recipients" : "Penerima"}</small><strong>1.248</strong></div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.total}`}>
          <Ticket size={21} />
          <h3>{en ? "Total aid distributed" : "Total penyaluran bantuan"}</h3>
          <strong className={styles.figure}>Rp48,6 jt</strong>
          <p>{en ? "Registered food vouchers" : "Kupon sembako tercatat"}</p>
        </section>

        <section className={`${styles.card} ${styles.activity}`}>
          <div className={styles.cardHeader}>
            <span className={styles.icon}><ArrowDownLeft size={18} /></span>
            <div><h3>{en ? "Transaction activity" : "Aktivitas transaksi"}</h3><p>{en ? "Distribution and redemption" : "Penyaluran dan penukaran"}</p></div>
          </div>
          <ul>
            {transactions.map(({ id, amount, redemption }) => (
              <li key={id}>
                <div><strong>{redemption ? (en ? "Voucher redeemed" : "Kupon ditukar") : (en ? "Voucher distributed" : "Kupon disalurkan")}</strong><code>{id}</code></div>
                <code>{amount}</code>
                <Check size={15} className={styles.verified} aria-label={en ? "Verified" : "Terverifikasi"} />
              </li>
            ))}
          </ul>
        </section>

        <section className={`${styles.card} ${styles.beneficiaries}`}>
          <span className={styles.icon}><Users size={19} /></span>
          <div><h3>{en ? "Registered recipients" : "Penerima terdaftar"}</h3><strong className={styles.figure}>1.248</strong></div>
        </section>

        <section className={`${styles.card} ${styles.voucher}`}>
          <div className={styles.voucherContent}>
            <div className={styles.voucherTop}><Ticket size={26} /><span>DEMO</span></div>
            <div className={styles.voucherMain}>
              <div><h3>{en ? "Food voucher" : "Kupon sembako"}</h3><strong className={styles.figure}>Rp150.000</strong><code>VCR-DEMO</code></div>
              <DecorativeCode />
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.sync}`}>
          <div className={styles.cardHeader}>
            <span className={styles.icon}><CloudUpload size={20} /></span>
            <div><h3>{en ? "Verification and sync" : "Verifikasi dan sinkronisasi"}</h3><p>{en ? "Offline transactions" : "Transaksi offline"}</p></div>
          </div>
          <span className={styles.syncStatus}><ShieldCheck size={15} /> {en ? "Synced" : "Tersinkron"}</span>
        </section>
      </div>

      <footer className={styles.controls}>
        <p id="showcase-demo">{en ? "Product preview · Demo data" : "Pratinjau produk · Data demo"}</p>
        <button type="button" aria-pressed={paused} aria-label={en ? "Pause showcase animation" : "Jeda animasi pratinjau"} title={paused ? (en ? "Resume animation" : "Lanjutkan animasi") : (en ? "Pause animation" : "Jeda animasi")} onClick={(event) => {
          resetLight(event.currentTarget.closest("aside")!);
          setPaused(!paused);
        }}>
          {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
        </button>
      </footer>
    </aside>
  );
}
