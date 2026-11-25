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
import { AuthUser, MobileClearinghouseState } from "./src/types";
import {
  loadClearinghouseData,
  loadPrefs,
  loadSavedUser,
  MobilePrefs,
  resetAllMobileDemoData,
  savePrefs,
  saveUserSession,
} from "./src/storage";
import { buildMobileSeedState } from "./src/seed";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import VoucherScreen from "./src/screens/VoucherScreen";
import KedaiScreen from "./src/screens/KedaiScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

type TabId = "home" | "voucher" | "kedai" | "history" | "profile";

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
      const [loadedPrefs, savedUser] = await Promise.all([
        loadPrefs(),
        loadSavedUser(),
      ]);
      if (!active) return;
      setPrefs(loadedPrefs);
      // Pastikan hanya sesi warga yang dipulihkan di aplikasi khusus warga
      setUser(savedUser && savedUser.role === "BENEFICIARY" ? savedUser : null);

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

  const handleResetDemo = useCallback(async () => {
    const fresh = await resetAllMobileDemoData();
    setState(fresh);
    setDataSource("LOCAL");
    showToast("Data contoh kupon warga sudah dikembalikan ke awal.");
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    await saveUserSession(null);
    setUser(null);
    setActiveTab("home");
  }, []);

  const headerTitle = useMemo(() => {
    switch (activeTab) {
      case "home":
        return "CivicLedger Warga";
      case "voucher":
        return "Kupon Sembako";
      case "kedai":
        return "Kedai Mitra Toba";
      case "history":
        return "Riwayat Bantuan";
      case "profile":
        return "Profil & Pengaturan";
    }
  }, [activeTab]);

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
          Memuat Kupon Sembako Toba...
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
            <View
              style={[styles.brandIcon, { backgroundColor: palette.primary }]}
            >
              <Ionicons
                name="leaf-outline"
                size={17}
                color={palette.primaryText}
              />
            </View>
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
              Mode Offline — QR kupon tetap tersimpan dan bisa ditunjukkan ke
              kedai.
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
              dataSource={dataSource}
              onToggleOffline={() =>
                updatePrefs({ isOfflineMode: !prefs.isOfflineMode })
              }
              onRefresh={async () => {
                await refreshClearinghouse();
                showToast("Data kupon berhasil diperbarui.");
              }}
              onOpenVoucher={(v) => {
                if (v) setSelectedVoucherId(v.id);
                setActiveTab("voucher");
              }}
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

          {activeTab === "kedai" && (
            <KedaiScreen
              palette={palette}
              largeText={prefs.largeText}
              merchants={state.merchants}
            />
          )}

          {activeTab === "history" && (
            <HistoryScreen
              palette={palette}
              largeText={prefs.largeText}
              user={user}
              ledger={state.ledger}
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
            {WARGA_TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={styles.tabBtn}
                >
                  <Ionicons
                    name={active ? t.activeIcon : t.icon}
                    size={22}
                    color={active ? palette.primary : palette.inkMuted}
                  />
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
});
