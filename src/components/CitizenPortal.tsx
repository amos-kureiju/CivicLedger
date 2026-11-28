"use client";

import { flushSync } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, Check, CircleAlert, Clock3, Copy, LogOut, MapPin, Menu, Moon, PanelLeftClose, Printer, RefreshCw, ScanLine, Settings, ShoppingBasket, Store, Sun, Ticket, UserRound, X } from "lucide-react";
import type { AuthUser, Beneficiary, Voucher } from "@/lib/types";
import { CITIZEN_COPY, CITIZEN_EXPERIENCE_COPY, UI_COPY, type AppLang } from "@/lib/i18n";
import { formatDateTime, formatRupiah } from "@/lib/formatters";
import { encodeVoucherToQRPayload } from "@/lib/crypto";
import workspace from "./CoordinatorWorkspace.module.css";
import rail from "./MerchantWorkspace.module.css";
import ticket from "./BeneficiaryTab.module.css";
import styles from "./CitizenPortal.module.css";
import CitizenUsageGuide from "./CitizenUsageGuide";
import CitizenProfilePage from "./CitizenProfilePage";
import CitizenSettingsPage from "./CitizenSettingsPage";

type VoucherGroup = "ready" | "used" | "expired";
type View = "my" | "guide" | "profile" | "settings";
type Drawer = "navigation" | "qr" | "logout";
type CopyFeedback = "copied" | "copyFailed" | "smsDone" | "smsFailed";
const groups: VoucherGroup[] = ["ready", "used", "expired"];

interface Props {
  fontClass: string;
  lang: AppLang;
  user: AuthUser;
  recipient?: Beneficiary;
  vouchers: Voucher[];
  selected: Voucher | null;
  qr: { payload: string; url: string } | null;
  online: boolean;
  cached: boolean;
  loading: boolean;
  simulation: boolean;
  passwordChanged: boolean;
  compact: boolean;
  largeText: boolean;
  dark: boolean;
  onSelect: (voucher: Voucher) => void;
  onCompact: (compact: boolean) => void;
  onLanguage: (lang: AppLang) => void;
  onTextSize: (large: boolean) => void;
  onTheme: (dark: boolean) => void;
  onRefresh: () => Promise<void>;
  onCopySms: (voucher: Voucher) => Promise<void>;
  onPassword: () => void;
  onLogout: () => void;
}

function classify(voucher: Voucher, now: number): VoucherGroup {
  if (voucher.status === "REDEEMED" || voucher.status === "SETTLED") return "used";
  return voucher.status === "ACTIVE" && Date.parse(voucher.expires_at) > now ? "ready" : "expired";
}

function useExpiryClock(vouchers: Voucher[]) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const next = vouchers.reduce((earliest, voucher) => {
      const expiry = Date.parse(voucher.expires_at);
      return voucher.status === "ACTIVE" && expiry > now ? Math.min(earliest, expiry) : earliest;
    }, Infinity);
    const timer = Number.isFinite(next) ? window.setTimeout(update, Math.min(2_147_483_647, Math.max(1, next - Date.now()))) : undefined;
    window.addEventListener("focus", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [now, vouchers]);
  return now;
}

export default function CitizenPortal(p: Props) {
  const c = CITIZEN_COPY[p.lang];
  const common = UI_COPY[p.lang];
  const t = CITIZEN_EXPERIENCE_COPY[p.lang];
  const id = useId();
  const now = useExpiryClock(p.vouchers);
  const [tab, setTab] = useState<VoucherGroup>("ready");
  const [lastSelected, setLastSelected] = useState<Partial<Record<VoucherGroup, string>>>({});
  const [view, setView] = useState<View>("my");
  const [drawer, setDrawer] = useState<Drawer>("navigation");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [copying, setCopying] = useState(false);
  const [feedback, setFeedback] = useState<{ id: string; message: CopyFeedback } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const openFrom = useRef<HTMLElement | null>(null);
  const suppressRestore = useRef(false);
  const sidebar = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const brand = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const pageTransition = useRef<ViewTransition | null>(null);
  const navigationRevision = useRef(0);
  const voucherContent = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | null>(null);
  const voucherGroups: Record<VoucherGroup, Voucher[]> = { ready: [], used: [], expired: [] };
  for (const item of p.vouchers) voucherGroups[classify(item, now)].push(item);
  const visibleGroups = voucherGroups.expired.length || tab === "expired" ? groups : groups.slice(0, 2);
  const items = voucherGroups[tab];
  const voucher = items.find((item) => item.id === lastSelected[tab]) ?? items[0];
  const qr = voucher && tab === "ready" && p.qr?.payload === encodeVoucherToQRPayload(voucher) ? p.qr.url : "";
  const aid = voucherGroups.ready.reduce((sum, item) => sum + item.nominal_idr, 0);
  const activeFeedback = feedback?.id === voucher?.id ? feedback : null;
  const ThemeIcon = p.dark ? Sun : Moon;
  const themeLabel = p.dark ? common.dayMode : common.nightMode;
  const connection = p.online ? common.online : common.offline;

  useEffect(() => {
    if (tab === "ready" && voucher && p.selected?.id !== voucher.id) p.onSelect(voucher);
  }, [tab, voucher, p.selected?.id, p.onSelect]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const element = voucherContent.current;
    const from = previousHeight.current;
    previousHeight.current = null;
    if (!element || from === null || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = element.getBoundingClientRect().height;
    if (Math.abs(from - to) < 2) return;
    const animation = element.animate([{ height: from + "px" }, { height: to + "px" }], { duration: 250, easing: "cubic-bezier(.22, 1, .36, 1)" });
    return () => animation.cancel();
  }, [tab, voucher?.id]);

  function openDrawer(next: Drawer, origin: HTMLElement) {
    if (!dialog.current?.open) openFrom.current = origin;
    suppressRestore.current = false;
    flushSync(() => setDrawer(next));
    if (!dialog.current?.open) dialog.current?.showModal();
    else dialog.current.querySelector<HTMLButtonElement>("[data-close]")?.focus();
  }

  useLayoutEffect(() => {
    const element = sidebar.current;
    const marker = indicator.current;
    const target = element?.querySelector<HTMLElement>('[data-view="' + view + '"]');
    if (!element || !marker || !target) return;
    const update = () => {
      const railRect = element.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (!targetRect.height) return;
      marker.style.setProperty("--marker-top", targetRect.top - railRect.top + element.scrollTop + "px");
      marker.style.setProperty("--marker-height", targetRect.height + "px");
      element.dataset.indicator = "ready";
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(element);
    element.querySelectorAll("[data-view]").forEach((button) => resize.observe(button));
    return () => resize.disconnect();
  }, [view]);

  useEffect(() => {
    if (drawer === "qr" && dialog.current?.open && (!voucher || tab !== "ready")) dialog.current.close();
  }, [drawer, voucher, tab]);

  function navigate(next: View) {
    suppressRestore.current = Boolean(dialog.current?.open);
    dialog.current?.close();
    const revision = ++navigationRevision.current;
    const update = () => {
      if (revision !== navigationRevision.current) return;
      flushSync(() => setView(next));
      window.scrollTo({ top: 0, behavior: "instant" });
      main.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    };
    pageTransition.current?.skipTransition();
    if (next === view || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      return;
    }
    document.documentElement.dataset.citizenTransition = "";
    const transition = document.startViewTransition(update);
    pageTransition.current = transition;
    // Rapid navigation can skip a captured frame before it is ready.
    void transition.ready.catch(() => {});
    const finish = () => {
      if (pageTransition.current !== transition) return;
      pageTransition.current = null;
      delete document.documentElement.dataset.citizenTransition;
    };
    void transition.finished.then(finish, finish);
  }

  useEffect(() => () => {
    navigationRevision.current += 1;
    pageTransition.current?.skipTransition();
    pageTransition.current = null;
    delete document.documentElement.dataset.citizenTransition;
  }, []);

  function toggleRail() {
    p.onCompact(!p.compact);
    requestAnimationFrame(() => brand.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
  }

  function chooseVoucher(item: Voucher) {
    previousHeight.current = voucherContent.current?.getBoundingClientRect().height ?? null;
    setLastSelected((previous) => ({ ...previous, [tab]: item.id }));
    if (tab === "ready") p.onSelect(item);
  }

  function changeTab(next: VoucherGroup) {
    if (next === tab) return;
    previousHeight.current = voucherContent.current?.getBoundingClientRect().height ?? null;
    setTab(next);
  }

  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = { ArrowLeft: (index + visibleGroups.length - 1) % visibleGroups.length, ArrowRight: (index + 1) % visibleGroups.length, Home: 0, End: visibleGroups.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = visibleGroups[next];
    document.getElementById(id + "-" + target)?.focus();
    changeTab(target);
  }

  async function copy(kind: "code" | "sms") {
    if (!voucher || classify(voucher, Date.now()) !== "ready" || copying) return;
    setCopying(true);
    try {
      if (kind === "code") await navigator.clipboard.writeText(voucher.short_code);
      else await p.onCopySms(voucher);
      setFeedback({ id: voucher.id, message: kind === "code" ? "copied" : "smsDone" });
    } catch {
      setFeedback({ id: voucher.id, message: kind === "code" ? "copyFailed" : "smsFailed" });
    } finally { setCopying(false); }
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshFailed(false);
    try { await p.onRefresh(); }
    catch { setRefreshFailed(true); }
    finally { setRefreshing(false); }
  }

  function navigation() {
    const entries = [
      { key: "my", label: c.my, Icon: Ticket },
      { key: "guide", label: c.guide, Icon: BookOpen },
      { key: "profile", label: c.profile, Icon: UserRound },
    ] as const;
    return <nav className={workspace.organizerNav + " " + rail.sidebarNav} aria-label={c.menu}>
      <div className={workspace.navGroup}>
        <p>{c.menu}</p>
        {entries.map(({ key, label, Icon }) => <button type="button" key={key} data-view={key} aria-label={label} title={label}
          aria-current={view === key ? "page" : undefined}
          onClick={() => navigate(key)}>
          <i className={workspace.navMarker} data-nav-marker aria-hidden="true" /><Icon size={18} aria-hidden="true" /><span>{label}</span>
        </button>)}
      </div>
    </nav>;
  }

  function footer() {
    return <footer className={rail.sidebarFooter + " " + styles.sidebarFooter}>
      <button type="button" aria-label={c.settings} title={c.settings} data-view="settings" aria-current={view === "settings" ? "page" : undefined} onClick={() => navigate("settings")}><Settings size={18} aria-hidden="true" /><span>{c.settings}</span></button>
      <button type="button" aria-label={c.logout} title={c.logout} aria-haspopup="dialog" onClick={(event) => openDrawer("logout", event.currentTarget)}><LogOut size={18} aria-hidden="true" /><span>{c.logout}</span></button>
    </footer>;
  }

  return <div className={[workspace.shell, rail.shell, styles.portal, p.fontClass].join(" ")} data-compact={p.compact}>
    <aside ref={sidebar} className="no-print hidden lg:flex lg:flex-col" aria-label={c.portal}>
      <span ref={indicator} className={styles.activeRail} data-layout-id="citizen-sidebar-active" data-footer={view === "settings"} aria-hidden="true" />
      <div ref={brand} className={workspace.brandHeader + " " + rail.sidebarBrand}>
        <button type="button" className={workspace.brandMark} disabled={!p.compact} aria-hidden={!p.compact} aria-expanded={!p.compact} aria-label={c.expand} onClick={toggleRail}><span aria-hidden="true">C</span></button>
        <div className={workspace.brandCopy} aria-hidden={p.compact}><div className={workspace.brandMask}><span>Civic<em>Ledger</em></span></div><p>{c.portal}</p></div>
        <button type="button" className={workspace.brandCollapse} disabled={p.compact} aria-hidden={p.compact} aria-expanded={!p.compact} aria-label={c.collapse} onClick={toggleRail}><PanelLeftClose size={17} aria-hidden="true" /></button>
      </div>
      {navigation()}
      {footer()}
    </aside>

    <div className={[workspace.body, rail.body, styles.body].join(" ")}>
      <header className={styles.topbar + " no-print"}>
        <div className={styles.topLead}>
          <button className={workspace.mobileMenu} type="button" aria-label={c.openNav} aria-haspopup="dialog" onClick={(event) => openDrawer("navigation", event.currentTarget)}><Menu size={21} aria-hidden="true" /></button>
          <strong>{c.portal}</strong><span className={styles.connection} data-online={p.online}>{connection}</span>
        </div>
        {p.simulation && <span className={styles.simulation}>{common.simBadge}</span>}
        <div className={styles.controls}>
          <button type="button" aria-label={c.textSize} aria-pressed={p.largeText} title={c.textSize} onClick={() => p.onTextSize(!p.largeText)}><span aria-hidden="true">Aa</span></button>
          <button type="button" aria-label={c.language} title={c.language} onClick={() => p.onLanguage(p.lang === "id" ? "en" : "id")}>{p.lang === "id" ? "EN" : "ID"}</button>
          <button type="button" aria-label={themeLabel} title={themeLabel} onClick={() => p.onTheme(!p.dark)}><ThemeIcon size={19} aria-hidden="true" /></button>
          <button type="button" aria-label={c.profile} title={c.profile} onClick={() => navigate("profile")}><UserRound size={19} aria-hidden="true" /></button>
        </div>
      </header>

      <main ref={main}>
        <div className={styles.page} key={view} data-page={view}>
        {p.passwordChanged && <p className={styles.notice + " no-print"} data-tone="success" role="status"><Check size={18} aria-hidden="true" />{c.passwordChanged}</p>}
        {view === "settings" ? <CitizenSettingsPage lang={p.lang} dark={p.dark} largeText={p.largeText} onTheme={p.onTheme} onTextSize={p.onTextSize} onLanguage={p.onLanguage} onPassword={p.onPassword} onLogout={(trigger) => openDrawer("logout", trigger)} /> : view === "guide" ? <CitizenUsageGuide lang={p.lang} onBack={() => navigate("my")} /> : view === "profile" ? <>
          <CitizenProfilePage lang={p.lang} user={p.user} recipient={p.recipient} onPassword={p.onPassword} />
        </> : <div className={styles.content}>
          <section className={styles.welcome + " no-print"}>
            <div><p className={styles.eyebrow}>{c.welcome}</p><h1 tabIndex={-1}>{c.hello}, {p.user.name}!</h1><p>{c.intro}</p>
              {(p.recipient?.rt_rw || p.user.rt_rw) && <p className={styles.location}><MapPin size={17} aria-hidden="true" />{p.recipient?.rt_rw || p.user.rt_rw}</p>}
            </div>
            <img src="/images/dashboard/citizen-grocery-hero.webp" width={1040} height={585} alt="" />
          </section>

          <dl aria-busy={p.loading} className={styles.aid + " no-print"}>
            <div><dt>{c.availableCount}</dt><dd>{p.loading ? "?" : voucherGroups.ready.length}</dd></div>
            <div><dt>{c.used}</dt><dd>{p.loading ? "?" : voucherGroups.used.length}</dd></div>
            <div><dt>{c.availableValue}</dt><dd>{p.loading ? "?" : formatRupiah(aid)}</dd></div>
          </dl>
          {(!p.online || p.cached) && <p role="status" className={styles.notice + " no-print"}><CircleAlert size={18} aria-hidden="true" />{p.online ? c.cached : c.offline}</p>}

          <section aria-labelledby={id + "-vouchers"} className={styles.wallet}>
            <div className={styles.sectionHeading + " no-print"}>
              <h2 id={id + "-vouchers"}>{c.my}</h2>
              <button className={styles.button} type="button" aria-label={c.refresh} title={c.refresh} disabled={refreshing} aria-busy={refreshing} onClick={() => void refresh()}><RefreshCw size={19} aria-hidden="true" /></button>
            </div>
            {(refreshing || refreshFailed) && <p className={styles.feedback + " no-print"} role="status">{refreshing ? c.refreshing : c.refreshFailed}</p>}
            <div className={styles.tabs + " no-print"} role="tablist" aria-label={c.my} data-count={visibleGroups.length} data-selected={tab}>
              {visibleGroups.map((group, index) => <button type="button" id={id + "-" + group} key={group} role="tab" aria-selected={tab === group} aria-controls={id + "-panel"} tabIndex={tab === group ? 0 : -1}
                onClick={() => changeTab(group)} onKeyDown={(event) => tabKeys(event, index)}>{c[group]} <span>({voucherGroups[group].length})</span></button>)}
              <i className={styles.underline} aria-hidden="true" />
            </div>
            <div ref={voucherContent} className={styles.voucherContent} id={id + "-panel"} role="tabpanel" aria-labelledby={id + "-" + tab} tabIndex={0}>
              {items.length > 1 && <>
                <div className={styles.choices + " no-print"}>
                  {items.map((item) => <button key={item.id} type="button" className={styles.button} aria-pressed={voucher?.id === item.id} onClick={() => chooseVoucher(item)}>
                    <code>{item.short_code}</code><span>{item.commodity_name}</span>
                  </button>)}
                </div>
                <label className={styles.mobileChoice + " no-print"}>{c.chooseVoucher}
                  <select value={voucher?.id} onChange={(event) => {
                    const item = items.find((option) => option.id === event.target.value);
                    if (item) chooseVoucher(item);
                  }}>
                    {items.map((item) => <option key={item.id} value={item.id}>{item.short_code} / {item.commodity_name}</option>)}
                  </select>
                </label>
              </>}
              {voucher ? <article className={styles.voucher} data-status={tab}>
                <div key={voucher.id} className={ticket.feature + " " + styles.ticketFace}>
                  <div className={styles.ticketHeader}><span>CivicLedger</span><span className={styles.badge}>
                    {tab === "used" ? <Check className={styles.usedCheck} size={16} aria-hidden="true" /> : tab === "expired" ? <Clock3 size={16} aria-hidden="true" /> : <Ticket size={16} aria-hidden="true" />}{c[tab]}
                  </span></div>
                  <p>{c.ticket}</p><strong className={styles.amount}>{formatRupiah(voucher.nominal_idr)}</strong>
                  <div className={styles.ticketDetails}><strong>{voucher.commodity_name}</strong><p>{voucher.commodity_items}</p><p>{voucher.beneficiary_name}</p>
                    <p>{c.validUntil} <time dateTime={voucher.expires_at}>{formatDateTime(voucher.expires_at)}</time></p></div>
                </div>
                {tab === "ready" ? <div className={styles.redemption}>
                  <div className={ticket.qrFrame + " " + styles.qr}>
                    {qr ? <img src={qr} alt={c.qr} width={480} height={480} /> : <p role="status">{c.qrWait}</p>}
                  </div>
                  <div className={styles.instructions}>
                    <strong>{c.show}</strong>
                    <span>{c.code}</span>
                    <div className={styles.codeRow}><code>{voucher.short_code}</code><button type="button" className={styles.button + " no-print"} aria-label={c.copyCode} title={c.copyCode} disabled={copying} onClick={() => void copy("code")}>
                      {activeFeedback?.message === "copied" ? <Check className={styles.usedCheck} size={19} aria-hidden="true" /> : <Copy size={19} aria-hidden="true" />}
                    </button></div>
                    {activeFeedback && <p role="status" className={styles.feedback + " no-print"}>{c[activeFeedback.message]}</p>}
                    <div className={styles.actions + " no-print"}>
                      <button type="button" className={styles.primary} disabled={!qr} aria-haspopup="dialog" onClick={(event) => { if (classify(voucher, Date.now()) === "ready") openDrawer("qr", event.currentTarget); }}><ScanLine size={18} aria-hidden="true" />{t.showQr}</button>
                      <button type="button" className={styles.button} disabled={!qr} onClick={() => { if (classify(voucher, Date.now()) === "ready") window.print(); }}><Printer size={18} aria-hidden="true" />{c.print}</button>
                      <button type="button" className={styles.button} disabled={copying} onClick={() => void copy("sms")}><Copy size={18} aria-hidden="true" />{c.sms}</button>
                    </div>
                  </div>
                </div> : <div className={styles.history}>
                  <strong>{tab === "used" ? c.usedMessage : c.expiredMessage}</strong>
                  <p>{c.code} <code>{voucher.short_code}</code></p>
                  {tab === "used" && voucher.redeemed_by_merchant_name && <p>{c.store} <strong>{voucher.redeemed_by_merchant_name}</strong></p>}
                  {tab === "used" && voucher.redeemed_at && <p>{c.usedAt} <time dateTime={voucher.redeemed_at}>{formatDateTime(voucher.redeemed_at)}</time></p>}
                </div>}
              </article> : !p.loading && tab === "ready" ? <div className={styles.emptyWallet}>
                <span className={styles.emptyIcon}><Ticket size={29} aria-hidden="true" /></span>
                <div role="status"><strong>{t.noVouchers}</strong><p>{t.newVouchers}</p></div>
                <button type="button" className={styles.button} onClick={() => { changeTab("used"); document.getElementById(id + "-used")?.focus(); }}>{t.voucherHistory}</button>
              </div> : <p className={styles.empty} role="status">{p.loading ? c.loading : c.empty}</p>}
            </div>
          </section>

          <section className={styles.guide + " no-print"} aria-labelledby={id + "-guide"}>
            <div className={styles.sectionHeading}><h2 id={id + "-guide"}>{t.quickGuide}</h2><button type="button" className={styles.button} onClick={() => navigate("guide")}>{t.guideLink}</button></div>
            <ol>{[c.stepStore, c.stepShow, c.stepTake].map((label, index) =>
              <li key={label}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>
            <p>{t.restriction}</p>
            <p><strong>{c.help}</strong> {c.helpText}</p>
          </section>
        </div>}
        </div>
      </main>
    </div>

    <dialog ref={dialog} className={(drawer === "navigation" ? styles.drawer : styles.popup) + " no-print"} aria-labelledby={id + "-drawer"}
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      onClose={() => {
        if (!suppressRestore.current && openFrom.current?.isConnected) openFrom.current.focus();
        suppressRestore.current = false;
      }}>
      <div className={styles.drawerBody}>
        <div className={styles.sectionHeading}>
          <h2 id={id + "-drawer"}>{drawer === "navigation" ? c.portal : drawer === "qr" ? c.show : t.confirmLogout}</h2>
          <button data-close type="button" className={styles.button} aria-label={c.close} onClick={() => dialog.current?.close()}><X size={21} aria-hidden="true" /></button>
        </div>
        {drawer === "navigation" && <>{navigation()}{footer()}</>}
        {drawer === "qr" && voucher && tab === "ready" && <div className={styles.qrPresentation}>
          {qr ? <img src={qr} alt={c.qr} width={480} height={480} /> : <p role="status">{c.qrWait}</p>}
          <p>{c.code} <code>{voucher.short_code}</code></p>
        </div>}
        {drawer === "logout" && <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => dialog.current?.close()}>{t.cancel}</button>
          <button type="button" className={styles.primary} onClick={p.onLogout}>{c.logout}</button>
        </div>}
      </div>
    </dialog>
  </div>;
}
