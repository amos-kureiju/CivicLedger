"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { Beneficiary, LedgerEntry, Voucher } from "@/lib/types";
import styles from "./CoordinatorWorkspace.module.css";

export default function CoordinatorSearch({ en, vouchers, beneficiaries, ledger, onVoucher, onResident, onTransaction }: {
  en: boolean;
  vouchers: Voucher[];
  beneficiaries: Beneficiary[];
  ledger: LedgerEntry[];
  onVoucher: (voucher: Voucher) => void;
  onResident: (resident: Beneficiary) => void;
  onTransaction: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const keyword = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(keyword);
  const results = keyword.length < 2 ? [] : [
    ...vouchers.filter(v => matches(v.short_code + " " + v.beneficiary_name)).slice(0, 3).map(v => ({
      key: "voucher-" + v.id, code: v.short_code, label: v.beneficiary_name, select: () => onVoucher(v),
    })),
    ...beneficiaries.filter(b => matches(b.name + " " + b.id)).slice(0, 3).map(b => ({
      key: "resident-" + b.id, code: b.id, label: b.name, select: () => onResident(b),
    })),
    ...ledger.filter(e => matches(e.id + " " + e.client_tx_id + " " + e.short_code)).slice(0, 3).map(e => ({
      key: "transaction-" + e.id, code: e.short_code, label: en ? "Transaction" : "Transaksi", select: onTransaction,
    })),
  ];
  const label = en ? "Search residents, vouchers, or transactions…" : "Cari warga, kupon, atau transaksi…";
  return (
    <div className={styles.search} onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
    }} onKeyDown={(e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Enter" && e.target === e.currentTarget.querySelector("input") && results[0]) {
        results[0].select(); setQuery(""); setOpen(false);
      }
    }}>
      <Search size={17} aria-hidden="true" />
      <input type="search" placeholder={label} aria-label={label} value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} />
      {open && keyword.length >= 2 && <div className={styles.results}>
        {results.length ? results.map(({ key, code, label, select }) => <button key={key} type="button" onClick={() => { select(); setQuery(""); setOpen(false); }}><code>{code}</code> {label}</button>)
          : <p role="status">{en ? "No results in loaded records." : "Tidak ada hasil dalam data yang dimuat."}</p>}
      </div>}
    </div>
  );
}
