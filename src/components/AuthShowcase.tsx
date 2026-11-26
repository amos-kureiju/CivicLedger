import { ArrowDownLeft, ArrowUpRight, Check, CloudUpload, ScanLine, Ticket, Users } from "lucide-react";
import styles from "./AuthHeading.module.css";

const distribution = [25, 36, 29, 49, 42, 63, 52, 70, 61, 84, 73, 96];
const transactions = [
  { id: "VCR-8K2Q", amount: "Rp150.000" },
  { id: "VCR-5U7C", amount: "Rp100.000" },
  { id: "VCR-3N9P", amount: "Rp150.000" },
];

export default function AuthShowcase({ en }: { en: boolean }) {
  return (
    <aside className={styles.showcase} aria-labelledby="showcase-title">
      <div className={styles.showcaseCopy}>
        <p>{en ? "CivicLedger overview" : "Sekilas CivicLedger"}</p>
        <h2 id="showcase-title">{en ? "Aid that reaches people." : "Bantuan sampai ke warga."}</h2>
      </div>

      <div className={styles.scenery}>
        <div className={styles.dashboard}>
          <div className={styles.dashboardHeader}>
            <span className={styles.dashboardIcon}><ScanLine size={19} /></span>
            <div><strong>{en ? "Aid distribution" : "Distribusi bantuan"}</strong><small>{en ? "July – December" : "Juli – Desember"}</small></div>
            <ArrowUpRight size={17} className={styles.dashboardArrow} />
          </div>
          <div className={styles.metrics}>
            <div><small><Ticket size={14} /> {en ? "Distributed" : "Tersalurkan"}</small><strong>Rp48,6 jt</strong></div>
            <div><small><Users size={14} /> {en ? "Beneficiaries" : "Penerima"}</small><strong>1.248</strong></div>
          </div>
          <div className={styles.chart} aria-hidden="true">
            {distribution.map((height, index) => <span key={index} style={{ height: height + "%" }} />)}
          </div>
          <div className={styles.chartLabels} aria-hidden="true"><span>JUL</span><span>SEP</span><span>OKT</span><span>DES</span></div>
        </div>

        <div className={styles.voucher}>
          <div><Ticket size={23} /><ArrowUpRight size={18} /></div>
          <small>{en ? "Food voucher" : "Kupon sembako"}</small>
          <strong>Rp150.000</strong>
          <code>VCR-8K2Q</code>
        </div>

        <div className={styles.transactions}>
          <div className={styles.dashboardHeader}>
            <span className={styles.dashboardIcon}><ArrowDownLeft size={18} /></span>
            <div><strong>{en ? "Transactions" : "Transaksi"}</strong><small>{en ? "Verification" : "Verifikasi"}</small></div>
          </div>
          {transactions.map(({ id, amount }) => (
            <div key={id} className={styles.transaction}><code>{id}</code><code>{amount}</code><Check size={13} aria-label={en ? "Verified" : "Terverifikasi"} /></div>
          ))}
        </div>

        <div className={styles.sync}>
          <CloudUpload size={23} />
          <div><strong>{en ? "Offline sync" : "Sinkronisasi offline"}</strong><small>{en ? "18 records synced" : "18 catatan tersinkron"}</small></div>
        </div>
      </div>
      <p className={styles.showcaseNote}>{en ? "Product preview · Demo data" : "Pratinjau produk · Data demo"}</p>
    </aside>
  );
}
