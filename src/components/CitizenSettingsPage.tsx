"use client";

import { KeyRound, LogOut } from "lucide-react";
import { CITIZEN_COPY, CITIZEN_EXPERIENCE_COPY, type AppLang } from "@/lib/i18n";
import portal from "./CitizenPortal.module.css";
import styles from "./CitizenSettingsPage.module.css";

interface Props {
  lang: AppLang;
  dark: boolean;
  largeText: boolean;
  onTheme: (dark: boolean) => void;
  onTextSize: (large: boolean) => void;
  onLanguage: (lang: AppLang) => void;
  onPassword: () => void;
  onLogout: (trigger: HTMLButtonElement) => void;
}

export default function CitizenSettingsPage(p: Props) {
  const c = CITIZEN_COPY[p.lang];
  const t = CITIZEN_EXPERIENCE_COPY[p.lang];
  return <div className={styles.settings}>
    <header><h1 tabIndex={-1}>{c.settings}</h1><p>{t.settingsIntro}</p></header>
    <div className={styles.rows}>
      <section>
        <h2>{t.appearance}</h2>
        <label>{t.theme}<select value={p.dark ? "dark" : "light"} onChange={(event) => p.onTheme(event.target.value === "dark")}>
          <option value="light">{t.light}</option><option value="dark">{t.dark}</option>
        </select></label>
      </section>
      <section>
        <h2>{t.accessibility}</h2>
        <label>{t.size}<select value={p.largeText ? "large" : "normal"} onChange={(event) => p.onTextSize(event.target.value === "large")}>
          <option value="normal">{t.normal}</option><option value="large">{t.large}</option>
        </select></label>
        <p className={styles.preview}>{t.preview}</p>
      </section>
      <section className={styles.language}>
        <h2>{t.language}</h2>
        <select aria-label={t.language} value={p.lang} onChange={(event) => p.onLanguage(event.target.value === "en" ? "en" : "id")}>
          <option value="id" lang="id">Indonesia</option><option value="en" lang="en">English</option>
        </select>
      </section>
      <section>
        <h2>{t.security}</h2>
        <div className={styles.actions}>
          <button type="button" className={portal.button} aria-haspopup="dialog" onClick={p.onPassword}><KeyRound size={18} aria-hidden="true" />{c.password}</button>
          <button type="button" className={portal.button} aria-haspopup="dialog" onClick={(event) => p.onLogout(event.currentTarget)}><LogOut size={18} aria-hidden="true" />{c.logout}</button>
        </div>
      </section>
    </div>
  </div>;
}
