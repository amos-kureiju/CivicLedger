"use client";

import { ArrowUpRight, Check, MapPin, ScanLine, Ticket } from "lucide-react";
import type { Voucher } from "@/lib/types";
import { CITIZEN_COPY, CITIZEN_EXPERIENCE_COPY, CITIZEN_WALLET_COPY, type AppLang } from "@/lib/i18n";
import { formatRupiah } from "@/lib/formatters";
import styles from "./CitizenWallet.module.css";

interface Props {
  lang: AppLang;
  name: string;
  location?: string;
  amount: number;
  available: number;
  used: number;
  loading: boolean;
  active?: Voucher;
  completed?: Voucher;
  onOpen: (voucher: Voucher, ready: boolean, trigger: HTMLButtonElement) => void;
}

export default function CitizenWalletOverview(p: Props) {
  const c = CITIZEN_COPY[p.lang];
  const t = CITIZEN_EXPERIENCE_COPY[p.lang];
  const w = CITIZEN_WALLET_COPY[p.lang];
  const featured = p.active ?? p.completed;
  const ready = Boolean(p.active);
  return <>
    <header className={styles.greeting + " no-print"}>
      <p className={styles.eyebrow}>{w.welcome}</p>
      <h1 tabIndex={-1}>{c.hello}, <span>{p.name}!</span></h1>
      {p.location && <p className={styles.location}><MapPin size={17} aria-hidden="true" />{p.location}</p>}
    </header>
    <div className={styles.overview + " no-print"}>
      <section className={styles.balance} aria-labelledby="citizen-aid-balance" aria-busy={p.loading}>
        <div className={styles.balanceContents}>
          <h2 id="citizen-aid-balance" className={styles.eyebrow}>{w.balance}</h2>
          <p className={styles.balanceValue}>{p.loading ? "\u2013" : formatRupiah(p.amount)}</p>
          {!p.loading && !p.available && <p className={styles.balanceNote}>{t.noVouchers}</p>}
          <dl>
            <div><dt>{c.availableCount}</dt><dd>{p.loading ? "\u2013" : p.available}</dd></div>
            <div><dt>{c.used}</dt><dd>{p.loading ? "\u2013" : p.used}</dd></div>
          </dl>
        </div>
        <div className={styles.walletArt} aria-hidden="true"><Ticket className={styles.artBack} /><Ticket className={styles.artFront} /></div>
      </section>
      <section className={styles.featured} aria-labelledby="citizen-featured-aid">
        <div className={styles.featureBody}>
          <h2 id="citizen-featured-aid" className={styles.eyebrow}>{featured ? ready ? w.active : w.latest : w.assistance}</h2>
          {featured ? <>
            <p className={styles.featureAmount}>{formatRupiah(featured.nominal_idr)}</p>
            <p className={styles.package}>{featured.commodity_name}</p>
            <p className={styles.featureStatus}>{ready ? <Ticket size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{ready ? c.ready : c.used}</p>
            <button className={styles.featureAction} type="button" aria-haspopup={ready ? "dialog" : undefined} onClick={(event) => p.onOpen(featured, ready, event.currentTarget)}>
              {ready ? <ScanLine size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}{ready ? t.showQr : w.detail}
            </button>
          </> : <p className={styles.package}>{p.loading ? c.loading : w.noHistory}</p>}
        </div>
        <img className={styles.groceries} src="/images/dashboard/citizen-wallet-groceries.webp" alt="" width={600} height={500} />
      </section>
    </div>
  </>;
}
