import { KeyRound, Mail, MapPin, Phone, UserRound } from "lucide-react";
import type { AuthUser, Beneficiary } from "@/lib/types";
import { CITIZEN_PROFILE_COPY, type AppLang } from "@/lib/i18n";
import styles from "./CitizenProfilePage.module.css";

export default function CitizenProfilePage({ lang, user, recipient, onPassword }: {
  lang: AppLang; user: AuthUser; recipient?: Beneficiary; onPassword: () => void;
}) {
  const c = CITIZEN_PROFILE_COPY[lang];
  const address = recipient?.rt_rw || user.rt_rw;
  const citizenId = recipient?.id || user.linked_beneficiary_id;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase(lang);
  const personal = [
    { label: c.name, value: user.name },
    { label: c.id, value: citizenId && <code>{citizenId}</code> },
    { label: c.category, value: recipient?.category },
    { label: c.household, value: recipient?.household_size },
    { label: c.address, value: address, wide: true },
  ];
  const account = [
    { label: c.email, value: user.email, Icon: Mail },
    { label: c.phone, value: user.phone, Icon: Phone },
  ];
  return <div className={styles.profile}>
    <header className={styles.heading}>
      <h1 tabIndex={-1}>{c.title} <span>{c.titleEnd}</span></h1>
      <p>{c.intro}</p>
    </header>
    <section className={styles.identity} aria-label={c.role}>
      <span className={styles.avatar} aria-hidden="true">{initials}</span>
      <div className={styles.identityText}>
        <p className={styles.role}>{c.role}</p>
        <h2>{user.name}</h2>
        {citizenId && <code>{citizenId}</code>}
        {address && <p className={styles.location}><MapPin size={17} aria-hidden="true" />{address}</p>}
      </div>
      <div className={styles.art} aria-hidden="true">
        <span className={styles.artAvatar}><UserRound size={31} strokeWidth={1.6} /></span>
        <span className={styles.artLines}><i /><i /><i /></span>
        <span className={styles.artMark}>C</span>
      </div>
    </section>
    <div className={styles.info}>
      <section aria-label={c.personal}>
        <h2>{c.personal}</h2>
        <dl className={styles.personal}>
          {personal.map(({ label, value, wide }) => <div key={label} className={wide ? styles.wide : undefined}>
            <dt>{label}</dt><dd>{value === "" || value == null ? c.missing : value}</dd>
          </div>)}
        </dl>
        <p className={styles.note}>{c.update}</p>
      </section>
      <section aria-label={c.account}>
        <h2>{c.account}</h2>
        <dl>
          {account.map(({ label, value, Icon }) => <div key={label} className={styles.row}>
            <dt><span className={styles.icon}><Icon size={18} aria-hidden="true" /></span>{label}</dt>
            <dd>{value || c.missing}</dd>
          </div>)}
          <div className={styles.row}>
            <dt><span className={styles.icon}><KeyRound size={18} aria-hidden="true" /></span>{c.password}</dt>
            <dd><button type="button" aria-haspopup="dialog" onClick={onPassword}>{c.change}</button></dd>
          </div>
        </dl>
      </section>
    </div>
    <p className={styles.help}><strong>{c.help}</strong> {c.contact}</p>
  </div>;
}
