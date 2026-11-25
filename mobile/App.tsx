import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getPalette, fs } from "./src/theme";
import {
  AuthUser,
  LedgerEntry,
  Merchant,
  MobileClearinghouseState,
  OfflineRedemptionItem,
  Voucher,
} from "./src/types";
import {
  loadClearinghouseData,
  loadOfflineQueue,
  loadPrefs,
  loadRedeemedIds,
  loadSavedUser,
  MobilePrefs,
  resetAllMobileDemoData,
  saveLocalState,
  saveOfflineQueue,
  savePrefs,
  saveRedeemedIds,
  saveUserSession,
} from "./src/storage";
import { buildMobileSeedState } from "./src/seed";
import { GENESIS_HASH, sha256Hex } from "./src/crypto";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import VoucherScreen from "./src/screens/VoucherScreen";
import MerchantPosScreen from "./src/screens/MerchantPosScreen";
import KedaiScreen from "./src/screens/KedaiScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import BrandLogo from "./src/components/BrandLogo";

type TabId = "home" | "voucher" | "pos" | "kedai" | "history" | "profile";

interface TabDef {
  id: TabId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const WARGA_TABS: TabDef[] = [
  { id: "home", label: "Beranda", icon: "home-outline", activeIcon: "home" },
  {
    id: "voucher",
    label: "Kupon",
    icon: "qr-code-outline",
    activeIcon: "qr-code",
  },
  {
    id: "kedai",
    label: "Kedai",
    icon: "storefront-outline",
    activeIcon: "storefront",
  },
  {
    id: "history",
    label: "Riwayat",
    icon: "receipt-outline",
    activeIcon: "receipt",
  },
  {
    id: "profile",
    label: "Profil",
    icon: "person-outline",
    activeIcon: "person",
  },
];

const KEDAI_TABS: TabDef[] = [
  { id: "home", label: "Beranda", icon: "home-outline", activeIcon: "home" },
  {
    id: "pos",
    label: "Kasir",
    icon: "qr-code-outline",
    activeIcon: "qr-code",
  },
  {
    id: "kedai",
    label: "Kedai",
    icon: "storefront-outline",
    activeIcon: "storefront",
  },
  {
    id: "history",
    label: "Riwayat",
    icon: "receipt-outline",
    activeIcon: "receipt",
  },
  {
    id: "profile",
    label: "Profil",
    icon: "person-outline",
    activeIcon: "person",
  },
];

function CivicLedgerMobileApp() {
  const [booting, setBooting] = useState(true);
  const [prefs, setPrefs] = useState<MobilePrefs>({
    theme: "light",
    largeText: false,
    isOfflineMode: false,
    serverUrl: "http://localhost:3000",
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<MobileClearinghouseState>(() =>
    buildMobileSeedState()
  );
  const [dataSource, setDataSource] = useState<"SERVER" | "LOCAL">("LOCAL");
  const [offlineQueue, setOfflineQueue] = useState<OfflineRedemptionItem[]>([]);
  const [redeemedIds, setRedeemedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);

  const palette = getPalette(prefs.theme);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const updatePrefs = useCallback((patch: Partial<MobilePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const refreshClearinghouse = useCallback(
    async (serverUrlOverride?: string, offlineOverride?: boolean) => {
      const url = serverUrlOverride ?? prefs.serverUrl;
      const offline = offlineOverride ?? prefs.isOfflineMode;
      const loaded = await loadClearinghouseData(url, offline);
      setState(loaded.state);
      setDataSource(loaded.source);
    },
    [prefs.serverUrl, prefs.isOfflineMode]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedPrefs, savedUser, savedQueue, savedRedeemed] =
        await Promise.all([
          loadPrefs(),
          loadSavedUser(),
          loadOfflineQueue(),
          loadRedeemedIds(),
        ]);
      if (!active) return;
      setPrefs(loadedPrefs);
      // Hanya izinkan Warga & Pemilik Kedai di aplikasi mobile (Pengurus di web)
      setUser(
        savedUser && savedUser.role !== "COORDINATOR" ? savedUser : null
      );
      setOfflineQueue(savedQueue);
      setRedeemedIds(savedRedeemed);

      const loadedData = await loadClearinghouseData(
        loadedPrefs.serverUrl,
        loadedPrefs.isOfflineMode
      );
      if (!active) return;
      setState(loadedData.state);
      setDataSource(loadedData.source);
      setBooting(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sinkronisasi realtime otomatis tiap 4 detik saat Online (agar data Mobile selalu live)
  useEffect(() => {
    if (booting || !user || prefs.isOfflineMode) return;
    const timer = setInterval(() => {
      void refreshClearinghouse();
    }, 4000);
    return () => clearInterval(timer);
  }, [booting, user, prefs.isOfflineMode, refreshClearinghouse]);

  const bottomTabs = useMemo(() => {
    if (!user) return [];
    return user.role === "MERCHANT" ? KEDAI_TABS : WARGA_TABS;
  }, [user]);

  const pendingOfflineCount = useMemo(
    () => offlineQueue.filter((q) => !q.synced).length,
    [offlineQueue]
  );

  const handleRedeemAccepted = useCallback(
    async (params: {
      voucher: Voucher;
      merchant: Merchant;
      mode: "ONLINE" | "OFFLINE";
      clientTxId: string;
      receiptHash: string;
    }) => {
      const nowIso = new Date().toISOString();
      const { voucher, merchant, mode, clientTxId, receiptHash } = params;

      const nextRedeemed = redeemedIds.includes(voucher.id)
        ? redeemedIds
        : [...redeemedIds, voucher.id];
      setRedeemedIds(nextRedeemed);
      await saveRedeemedIds(nextRedeemed);

      if (mode === "OFFLINE") {
        const queueItem: OfflineRedemptionItem = {
          queue_id: `Q-${Date.now().toString(36).toUpperCase()}`,
          client_tx_id: clientTxId,
          voucher_id: voucher.id,
          short_code: voucher.short_code,
          beneficiary_id: voucher.beneficiary_id,
          beneficiary_name: voucher.beneficiary_name,
          commodity_code: voucher.commodity_code,
          commodity_name: voucher.commodity_name,
          commodity_items: voucher.commodity_items,
          nominal_idr: voucher.nominal_idr,
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          hmac_signature: voucher.hmac_signature,
          local_receipt_hash: receiptHash,
          redeemed_at: nowIso,
          synced: false,
        };
        const nextQueue = [queueItem, ...offlineQueue];
        setOfflineQueue(nextQueue);
        await saveOfflineQueue(nextQueue);

        setState((prev) => {
          const updated: MobileClearinghouseState = {
            ...prev,
            vouchers: prev.vouchers.map((v) =>
              v.id === voucher.id
                ? {
                    ...v,
                    status: "REDEEMED",
                    redeemed_by_merchant_id: merchant.id,
                    redeemed_by_merchant_name: merchant.name,
                    redeemed_at: nowIso,
                  }
                : v
            ),
          };
          saveLocalState(updated);
          return updated;
        });

        showToast(`Kupon ${voucher.short_code} disimpan di antrean offline HP.`);
        return;
      }

      let syncedOnServer = false;
      if (prefs.serverUrl.trim()) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1600);
          const res = await fetch(
            `${prefs.serverUrl.replace(/\/$/, "")}/api/clearinghouse`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                action: "REDEEM_ONLINE",
                voucher_id: voucher.id,
                short_code: voucher.short_code,
                merchant_id: merchant.id,
                hmac_signature: voucher.hmac_signature,
                client_tx_id: clientTxId,
              }),
            }
          );
          clearTimeout(timer);
          if (res.ok) {
            syncedOnServer = true;
            await refreshClearinghouse();
          }
        } catch {
          // fallback lokal
        }
      }

      if (!syncedOnServer) {
        setState((prev) => {
          const prevHash =
            prev.ledger.length > 0 ? prev.ledger[0].tx_hash : GENESIS_HASH;
          const txHash = sha256Hex(
            `${prevHash}|${clientTxId}|${voucher.id}|${merchant.id}|${voucher.nominal_idr}|${nowIso}`
          );
          const entry: LedgerEntry = {
            id: `TX-MOB-${Date.now().toString(36).toUpperCase()}`,
            client_tx_id: clientTxId,
            voucher_id: voucher.id,
            short_code: voucher.short_code,
            beneficiary_id: voucher.beneficiary_id,
            merchant_id: merchant.id,
            merchant_name: merchant.name,
            commodity_name: voucher.commodity_name,
            nominal_idr: voucher.nominal_idr,
            hmac_signature: voucher.hmac_signature,
            prev_hash: prevHash,
            tx_hash: txHash,
            sync_mode: "ONLINE",
            timestamp: nowIso,
          };

          const updated: MobileClearinghouseState = {
            ...prev,
            vouchers: prev.vouchers.map((v) =>
              v.id === voucher.id
                ? {
                    ...v,
                    status: "REDEEMED",
                    redeemed_by_merchant_id: merchant.id,
                    redeemed_by_merchant_name: merchant.name,
                    redeemed_at: nowIso,
                  }
                : v
            ),
            merchants: prev.merchants.map((m) =>
              m.id === merchant.id
                ? {
                    ...m,
                    unsettled_balance_idr:
                      m.unsettled_balance_idr + voucher.nominal_idr,
                    redemption_count: m.redemption_count + 1,
                  }
                : m
            ),
            ledger: [entry, ...prev.ledger],
          };
          saveLocalState(updated);
          return updated;
        });
      }

      showToast(`Kupon ${voucher.short_code} diterima oleh ${merchant.name}.`);
    },
    [offlineQueue, prefs.serverUrl, redeemedIds, refreshClearinghouse, showToast]
  );

  const handleFraudBlocked = useCallback(
    (reason: string) => {
      setState((prev) => {
        const next = {
          ...prev,
          fraud_blocked_count: prev.fraud_blocked_count + 1,
        };
        saveLocalState(next);
        return next;
      });
      showToast(reason);
    },
    [showToast]
  );

  const handleSyncOfflineQueue = useCallback(async () => {
    const pending = offlineQueue.filter((q) => !q.synced);
    if (pending.length === 0) {
      return { syncedCount: 0, source: "Lokal" };
    }

    let syncedToServer = false;
    if (prefs.serverUrl.trim()) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(
          `${prefs.serverUrl.replace(/\/$/, "")}/api/clearinghouse`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              action: "BATCH_SYNC_OFFLINE",
              transactions: pending.map((p) => ({
                client_tx_id: p.client_tx_id,
                voucher_id: p.voucher_id,
                short_code: p.short_code,
                merchant_id: p.merchant_id,
                hmac_signature: p.hmac_signature,
                redeemed_at: p.redeemed_at,
                local_receipt_hash: p.local_receipt_hash,
              })),
            }),
          }
        );
        clearTimeout(timer);
        if (res.ok) {
          syncedToServer = true;
          await refreshClearinghouse();
        }
      } catch {
        // rekonsiliasi lokal
      }
    }

    if (!syncedToServer) {
      setState((prev) => {
        let currentPrevHash =
          prev.ledger.length > 0 ? prev.ledger[0].tx_hash : GENESIS_HASH;
        const newEntries: LedgerEntry[] = [];
        const merchantAdditions: Record<string, { nom: number; cnt: number }> =
          {};

        for (const item of [...pending].reverse()) {
          const txHash = sha256Hex(
            `${currentPrevHash}|${item.client_tx_id}|${item.voucher_id}|${item.merchant_id}|${item.nominal_idr}|${item.redeemed_at}`
          );
          newEntries.unshift({
            id: `TX-SYNC-${Date.now().toString(36).toUpperCase()}-${item.short_code}`,
            client_tx_id: item.client_tx_id,
            voucher_id: item.voucher_id,
            short_code: item.short_code,
            beneficiary_id: item.beneficiary_id,
            merchant_id: item.merchant_id,
            merchant_name: item.merchant_name,
            commodity_name: item.commodity_name,
            nominal_idr: item.nominal_idr,
            hmac_signature: item.hmac_signature,
            prev_hash: currentPrevHash,
            tx_hash: txHash,
            sync_mode: "OFFLINE_BATCH_SYNC",
            timestamp: item.redeemed_at,
          });
          currentPrevHash = txHash;

          if (!merchantAdditions[item.merchant_id]) {
            merchantAdditions[item.merchant_id] = { nom: 0, cnt: 0 };
          }
          merchantAdditions[item.merchant_id].nom += item.nominal_idr;
          merchantAdditions[item.merchant_id].cnt += 1;
        }

        const updated: MobileClearinghouseState = {
          ...prev,
          merchants: prev.merchants.map((m) => {
            const add = merchantAdditions[m.id];
            if (!add) return m;
            return {
              ...m,
              unsettled_balance_idr: m.unsettled_balance_idr + add.nom,
              redemption_count: m.redemption_count + add.cnt,
            };
          }),
          ledger: [...newEntries, ...prev.ledger],
        };
        saveLocalState(updated);
        return updated;
      });
    }

    const marked = offlineQueue.map((q) => ({ ...q, synced: true }));
    setOfflineQueue(marked);
    await saveOfflineQueue(marked);

    const sourceLabel = syncedToServer ? "Server Pusat" : "Catatan Lokal HP";
    showToast(`${pending.length} transaksi offline berhasil disinkronkan.`);
    return { syncedCount: pending.length, source: sourceLabel };
  }, [offlineQueue, prefs.serverUrl, refreshClearinghouse, showToast]);

  const handleResetDemo = useCallback(async () => {
    const fresh = await resetAllMobileDemoData();
    setState(fresh);
    setOfflineQueue([]);
    setRedeemedIds([]);
    setDataSource("LOCAL");
    showToast("Data contoh kupon & kedai dikembalikan ke awal.");
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    await saveUserSession(null);
    setUser(null);
    setActiveTab("home");
  }, []);

  const headerTitle = useMemo(() => {
    switch (activeTab) {
      case "home":
        return user?.role === "MERCHANT"
          ? "CivicLedger Kedai"
          : "CivicLedger Warga";
      case "voucher":
        return "Kupon Sembako";
      case "pos":
        return "Kasir Kedai";
      case "kedai":
        return "Kedai Mitra";
      case "history":
        return user?.role === "MERCHANT"
          ? "Riwayat Kasir"
          : "Riwayat Bantuan";
      case "profile":
        return "Profil & Pengaturan";
    }
  }, [activeTab, user]);

  if (booting) {
    return (
      <SafeAreaView
        style={[styles.bootWrap, { backgroundColor: palette.canvas }]}
      >
        <StatusBar style={prefs.theme === "dark" ? "light" : "dark"} />
        <ActivityIndicator size="large" color={palette.primary} />
        <Text
          style={{
            color: palette.inkSecondary,
            fontSize: 14,
            fontWeight: "600",
            marginTop: 12,
          }}
        >
          Memuat CivicLedger...
        </Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{
          flex: 1,
          backgroundColor:
            prefs.theme === "dark" ? "#163529" : palette.primary,
          alignItems: "center",
        }}
      >
        <StatusBar style="light" />
        <View style={[styles.webFrame, { backgroundColor: palette.canvas }]}>
          <AuthScreen
            palette={palette}
            theme={prefs.theme}
            largeText={prefs.largeText}
            serverUrl={prefs.serverUrl}
            onToggleTheme={() =>
              updatePrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })
            }
            onToggleLargeText={() =>
              updatePrefs({ largeText: !prefs.largeText })
            }
            onAuthenticated={(authedUser) => {
              setUser(authedUser);
              setActiveTab("home");
              showToast(`Horas, ${authedUser.name}.`);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeRoot, { backgroundColor: palette.canvas }]}
    >
      <StatusBar style={prefs.theme === "dark" ? "light" : "dark"} />

      <View
        style={[
          styles.webFrame,
          {
            backgroundColor: palette.canvas,
            borderColor:
              Platform.OS === "web" ? palette.border : "transparent",
          },
        ]}
      >
        {/* TOP HEADER */}
        <View
          style={[
            styles.topBar,
            { backgroundColor: palette.card, borderBottomColor: palette.border },
          ]}
        >
          <View style={styles.topLeft}>
            <BrandLogo size={34} />
            <Text
              numberOfLines={1}
              style={{
                color: palette.inkPrimary,
                fontSize: fs(17, prefs.largeText),
                fontWeight: "800",
                flexShrink: 1,
              }}
            >
              {headerTitle}
            </Text>
          </View>

          <View style={styles.topRight}>
            <Pressable
              onPress={() => updatePrefs({ largeText: !prefs.largeText })}
              style={[
                styles.topChip,
                {
                  backgroundColor: prefs.largeText
                    ? palette.primary
                    : palette.nested,
                  borderColor: prefs.largeText
                    ? palette.primary
                    : palette.border,
                },
              ]}
            >
              <Text
                style={{
                  color: prefs.largeText
                    ? palette.primaryText
                    : palette.inkPrimary,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                A+
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                updatePrefs({
                  theme: prefs.theme === "dark" ? "light" : "dark",
                })
              }
              style={[
                styles.topChip,
                {
                  backgroundColor: palette.nested,
                  borderColor: palette.border,
                },
              ]}
            >
              <Ionicons
                name={prefs.theme === "dark" ? "sunny-outline" : "moon-outline"}
                size={16}
                color={
                  prefs.theme === "dark" ? palette.amber : palette.inkSecondary
                }
              />
            </Pressable>
          </View>
        </View>

        {/* OFFLINE STRIP */}
        {prefs.isOfflineMode && (
          <View
            style={[
              styles.offlineStrip,
              {
                backgroundColor: palette.amberSoft,
                borderBottomColor: palette.amber,
              },
            ]}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={15}
              color={palette.amber}
            />
            <Text
              style={{
                color: palette.amber,
                fontSize: fs(12, prefs.largeText),
                fontWeight: "700",
                flex: 1,
              }}
            >
              {user.role === "MERCHANT"
                ? "Mode Offline — Kasir tetap bisa mengecek & menyimpan kupon."
                : "Mode Offline — QR kupon tetap tersimpan dan bisa ditunjukkan ke kedai."}
            </Text>
          </View>
        )}

        {/* TOAST */}
        {toast && (
          <View
            style={[styles.toastBar, { backgroundColor: palette.inkPrimary }]}
          >
            <Text
              style={{
                color: palette.card,
                fontSize: fs(13, prefs.largeText),
                fontWeight: "600",
              }}
            >
              {toast}
            </Text>
          </View>
        )}

        {/* CONTENT */}
        <View style={{ flex: 1 }}>
          {activeTab === "home" && (
            <HomeScreen
              palette={palette}
              largeText={prefs.largeText}
              user={user}
              state={state}
              isOfflineMode={prefs.isOfflineMode}
              offlineQueueCount={pendingOfflineCount}
              dataSource={dataSource}
              onToggleOffline={() =>
                updatePrefs({ isOfflineMode: !prefs.isOfflineMode })
              }
              onRefresh={async () => {
                await refreshClearinghouse();
                showToast("Data berhasil diperbarui.");
              }}
              onOpenVoucher={(v) => {
                if (v) setSelectedVoucherId(v.id);
                setActiveTab("voucher");
              }}
              onOpenPos={() => setActiveTab("pos")}
              onOpenKedai={() => setActiveTab("kedai")}
              onOpenHistory={() => setActiveTab("history")}
            />
          )}

          {activeTab === "voucher" && (
            <VoucherScreen
              palette={palette}
              largeText={prefs.largeText}
              user={user}
              vouchers={state.vouchers}
              selectedVoucherId={selectedVoucherId}
              onSelectVoucher={setSelectedVoucherId}
            />
          )}

          {activeTab === "pos" && (
            <MerchantPosScreen
              palette={palette}
              largeText={prefs.largeText}
              user={user}
              merchants={state.merchants}
              vouchers={state.vouchers}
              isOfflineMode={prefs.isOfflineMode}
              offlineQueue={offlineQueue}
              redeemedIds={redeemedIds}
              onToggleOffline={() =>
                updatePrefs({ isOfflineMode: !prefs.isOfflineMode })
              }
              onRedeemAccepted={handleRedeemAccepted}
              onFraudBlocked={handleFraudBlocked}
              onSyncOfflineQueue={handleSyncOfflineQueue}
            />
          )}

          {activeTab === "kedai" && (
            <KedaiScreen
              palette={palette}
              largeText={prefs.largeText}
              user={user}
              merchants={state.merchants}
            />
          )}

          {activeTab === "history" && (
            <HistoryScreen
              palette={palette}
              largeText={prefs.largeText}
              user={user}
              ledger={state.ledger}
              offlineQueue={offlineQueue}
            />
          )}

          {activeTab === "profile" && (
            <ProfileScreen
              palette={palette}
              theme={prefs.theme}
              largeText={prefs.largeText}
              isOfflineMode={prefs.isOfflineMode}
              serverUrl={prefs.serverUrl}
              dataSource={dataSource}
              user={user}
              onToggleTheme={() =>
                updatePrefs({
                  theme: prefs.theme === "dark" ? "light" : "dark",
                })
              }
              onToggleLargeText={() =>
                updatePrefs({ largeText: !prefs.largeText })
              }
              onToggleOffline={() =>
                updatePrefs({ isOfflineMode: !prefs.isOfflineMode })
              }
              onSaveServerUrl={async (url) => {
                updatePrefs({ serverUrl: url });
                await refreshClearinghouse(url, prefs.isOfflineMode);
              }}
              onResetDemo={handleResetDemo}
              onLogout={handleLogout}
            />
          )}
        </View>

        {/* BOTTOM TAB BAR */}
        <SafeAreaView
          edges={["bottom"]}
          style={[
            styles.tabBarWrap,
            { backgroundColor: palette.card, borderTopColor: palette.border },
          ]}
        >
          <View style={styles.tabBar}>
            {bottomTabs.map((t) => {
              const active = activeTab === t.id;
              const showBadge = t.id === "pos" && pendingOfflineCount > 0;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={styles.tabBtn}
                >
                  <View style={styles.tabIconWrap}>
                    <Ionicons
                      name={active ? t.activeIcon : t.icon}
                      size={22}
                      color={active ? palette.primary : palette.inkMuted}
                    />
                    {showBadge && (
                      <View
                        style={[
                          styles.badgeDot,
                          { backgroundColor: palette.amber },
                        ]}
                      >
                        <Text style={styles.badgeText}>
                          {pendingOfflineCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? palette.primary : palette.inkMuted,
                      fontSize: fs(11, prefs.largeText),
                      fontWeight: active ? "800" : "600",
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

class MobileErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: "#FAF7F2",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: "#1D2622",
              marginBottom: 8,
            }}
          >
            Terjadi Kendala di Aplikasi
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: "#C4363A",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{
              backgroundColor: "#1B6B50",
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
              Coba Lagi
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <MobileErrorBoundary>
      <SafeAreaProvider>
        <CivicLedgerMobileApp />
      </SafeAreaProvider>
    </MobileErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    alignItems: "center",
  },
  webFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    borderLeftWidth: Platform.OS === "web" ? 1 : 0,
    borderRightWidth: Platform.OS === "web" ? 1 : 0,
  },
  bootWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topChip: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toastBar: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabBarWrap: {
    borderTopWidth: 1,
  },
  tabBar: {
    flexDirection: "row",
    minHeight: 64,
    paddingTop: 6,
    paddingBottom: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabIconWrap: {
    position: "relative",
  },
  badgeDot: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
