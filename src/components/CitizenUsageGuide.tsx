"use client";

import { useId, useState } from "react";
import { ChevronDown, ScanLine, ShoppingBasket, Store, Ticket } from "lucide-react";
import { CITIZEN_GUIDE_COPY, type AppLang } from "@/lib/i18n";
import portal from "./CitizenPortal.module.css";
import styles from "./CitizenUsageGuide.module.css";

const visuals = [
  { file: "citizen-guide-store", Icon: Store },
  { file: "citizen-guide-voucher", Icon: ScanLine },
  { file: "citizen-guide-groceries", Icon: ShoppingBasket },
];

export default function CitizenUsageGuide({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const c = CITIZEN_GUIDE_COPY[lang];
  const id = useId();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  return <div className={styles.guide}>
    <section className={portal.welcome + " " + styles.hero}>
      <div><p className={portal.eyebrow}>{c.eyebrow}</p><h1 tabIndex={-1}>{c.title}</h1><p>{c.intro}</p></div>
      <img src="/images/dashboard/citizen-guide-groceries.webp" width={680} height={680} alt="" />
    </section>
    <ol className={styles.steps}>
      {c.steps.map(({ title, body }, index) => {
        const { file, Icon } = visuals[index];
        return <li key={file}>
          {missing.includes(file) ? <div className={styles.fallback}><Icon size={48} aria-hidden="true" /></div> :
            <img src={"/images/dashboard/" + file + ".webp"} alt="" width={680} height={680} onError={() => setMissing((files) => [...files, file])} />}
          <div><p className={styles.step}>{c.step} {String(index + 1).padStart(2, "0")}</p><h2>{title}</h2><p>{body}</p></div>
        </li>;
      })}
    </ol>
    <section className={styles.faq} aria-labelledby={id + "-faq"}>
      <h2 id={id + "-faq"}>{c.faqTitle}</h2>
      {c.faq.map(([question, answer], index) => {
        const open = expanded === index;
        const answerId = id + "-answer-" + index;
        return <div key={index} className={styles.item}>
          <h3><button type="button" aria-expanded={open} aria-controls={answerId} onClick={() => setExpanded(open ? null : index)}>
            {question}<ChevronDown aria-hidden="true" size={20} />
          </button></h3>
          <div id={answerId} className={styles.answer} data-open={open} inert={!open} aria-hidden={!open}><div><p>{answer}</p></div></div>
        </div>;
      })}
    </section>
    <section className={styles.cta}>
      <h2>{c.cta}</h2>
      <button type="button" onClick={onBack}><Ticket size={20} aria-hidden="true" />{c.back}</button>
    </section>
  </div>;
}
