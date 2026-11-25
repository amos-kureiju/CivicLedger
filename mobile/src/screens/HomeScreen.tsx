import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppPalette, fs } from "../theme";
import { AuthUser, MobileClearinghouseState, Voucher } from "../types";
import { formatDateTime, formatRupiah } from "../format";

interface HomeScreenProps {
  palette: AppPalette;
  largeText: boolean;
  user: AuthUser;
  state: MobileClearinghouseState;
  isOfflineMode: boolean;
  dataSource: "SERVER" | "LOCAL";
  onToggleOffline: () => void;
  onRefresh: () => void;
  onOpenVoucher: (voucher?: Voucher) => void;
  onOpenKedai: () => void;
  onOpenHistory: () => void;
}

export default function HomeScreen({
  palette,
  largeText,
  user,
  state,
  isOfflineMode,
  dataSource,
  onToggleOffline,
  onRefresh,
  onOpenVoucher,
  onOpenKedai,
  onOpenHistory,
}: HomeScreenProps) {
  const myBeneficiaryId = user.linked_beneficiary_id || "WGA-0401";
  const myVouchers = state.vouchers.filter(
    (v) => v.beneficiary_id === myBeneficiaryId
  );
  const activeVoucher =
    myVouchers.find((v) => v.status === "ACTIVE") || myVouchers[0] || null;
  const activeCount = myVouchers.filter((v) => v.status === "ACTIVE").length;
  const myHistoryCount = state.ledger.filter(
    (tx) => tx.beneficiary_id === myBeneficiaryId
  ).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Sapaan Warga */}
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(13, largeText),
              fontWeight: "600",
            }}
          >
            Horas, Warga Penerima
          </Text>
          <Text
            style={{
              color: palette.inkPrimary,
              fontSize: fs(22, largeText),
              fontWeight: "800",
              marginTop: 2,
            }}
          >
            {user.name}
          </Text>
          <Text
            style={{
              color: palette.inkSecondary,
              fontSize: fs(13, largeText),
              marginTop: 2,
            }}
          >
            {user.rt_rw}
          </Text>
        </View>

        <Pressable
          onPress={onToggleOffline}
          style={[
            styles.statusPill,
            {
              backgroundColor: isOfflineMode
                ? palette.amberSoft
                : palette.primarySoft,
              borderColor: isOfflineMode ? palette.amber : palette.primary,
            },
          ]}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: isOfflineMode
                  ? palette.amber
                  : palette.primary,
              },
            ]}
          />
          <Text
            style={{
              color: isOfflineMode ? palette.amber : palette.primary,
              fontSize: fs(12, largeText),
              fontWeight: "700",
            }}
          >
            {isOfflineMode ? "Offline" : "Online"}
          </Text>
        </Pressable>
      </View>

      {/* Kartu Kupon Utama */}
      <View style={[styles.heroCard, { backgroundColor: palette.primary }]}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.primaryText,
                opacity: 0.85,
                fontSize: fs(12, largeText),
                fontWeight: "700",
                letterSpacing: 0.5,
              }}
            >
              {activeCount > 0
                ? `${activeCount} KUPON SEMBAKO SIAP DIPAKAI`
                : "STATUS KUPON ANDA"}
            </Text>

            {activeVoucher ? (
              <>
                <Text
                  style={{
                    color: palette.primaryText,
                    fontSize: fs(22, largeText),
                    fontWeight: "800",
                    marginTop: 6,
                  }}
                >
                  {activeVoucher.commodity_name}
                </Text>
                <Text
                  style={{
                    color: palette.primaryText,
                    opacity: 0.92,
                    fontSize: fs(14, largeText),
                    marginTop: 3,
                  }}
                >
                  {formatRupiah(activeVoucher.nominal_idr)} · Kode{" "}
                  <Text style={{ fontWeight: "800" }}>
                    {activeVoucher.short_code}
                  </Text>
                </Text>
                <Text
                  style={{
                    color: palette.primaryText,
                    opacity: 0.8,
                    fontSize: fs(12, largeText),
                    marginTop: 4,
                  }}
                >
                  Berlaku sampai {formatDateTime(activeVoucher.expires_at)}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  color: palette.primaryText,
                  fontSize: fs(16, largeText),
                  fontWeight: "700",
                  marginTop: 6,
                }}
              >
                Belum ada kupon aktif untuk saat ini.
              </Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={() => onOpenVoucher(activeVoucher || undefined)}
          style={({ pressed }) => [
            styles.heroCta,
            {
              backgroundColor: "#FFFFFF",
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name="qr-code-outline" size={20} color="#1B6B50" />
          <Text
            style={{
              color: "#1B6B50",
              fontSize: fs(15, largeText),
              fontWeight: "800",
            }}
          >
            Tunjukkan QR ke Kedai
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#1B6B50" />
        </Pressable>
      </View>

      {/* Menu Cepat */}
      <View style={styles.tilesGrid}>
        <Pressable
          onPress={onOpenKedai}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: pressed ? palette.nested : palette.card,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[
              styles.tileIcon,
              { backgroundColor: palette.primarySoft },
            ]}
          >
            <Ionicons
              name="storefront-outline"
              size={22}
              color={palette.primary}
            />
          </View>
          <Text
            style={{
              color: palette.inkPrimary,
              fontSize: fs(14, largeText),
              fontWeight: "700",
              marginTop: 10,
            }}
          >
            Kedai Terdekat
          </Text>
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(12, largeText),
              marginTop: 2,
            }}
          >
            {state.merchants.length} kedai di Toba
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenHistory}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: pressed ? palette.nested : palette.card,
              borderColor: palette.border,
            },
          ]}
        >
          <View
            style={[styles.tileIcon, { backgroundColor: palette.amberSoft }]}
          >
            <Ionicons name="receipt-outline" size={22} color={palette.amber} />
          </View>
          <Text
            style={{
              color: palette.inkPrimary,
              fontSize: fs(14, largeText),
              fontWeight: "700",
              marginTop: 10,
            }}
          >
            Riwayat Saya
          </Text>
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(12, largeText),
              marginTop: 2,
            }}
          >
            {myHistoryCount} kali penukaran
          </Text>
        </Pressable>
      </View>

      {/* 3 Langkah Singkat */}
      <View
        style={[
          styles.stepsCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.stepsHeader}>
          <Text
            style={{
              color: palette.inkPrimary,
              fontSize: fs(15, largeText),
              fontWeight: "700",
            }}
          >
            Cara Ambil Sembako
          </Text>
          <Pressable onPress={onRefresh}>
            <Text
              style={{
                color: palette.primary,
                fontSize: fs(12, largeText),
                fontWeight: "700",
              }}
            >
              Perbarui ({dataSource === "SERVER" ? "Server" : "HP"})
            </Text>
          </Pressable>
        </View>

        {[
          {
            no: "1",
            title: "Datang ke kedai mitra terdekat",
            desc: "Pilih kedai sembako di Balige, Laguboti, Sitoluama, atau Porsea.",
          },
          {
            no: "2",
            title: "Tunjukkan QR atau kode kupon",
            desc: "Buka menu Kupon untuk memperbesar QR, atau sebutkan kode pendeknya.",
          },
          {
            no: "3",
            title: "Terima paket sembako Anda",
            desc: "Kupon tetap bisa dibuka di HP walau sinyal sedang hilang.",
          },
        ].map((step) => (
          <View key={step.no} style={styles.stepRow}>
            <View
              style={[
                styles.stepBadge,
                { backgroundColor: palette.primarySoft },
              ]}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontSize: fs(13, largeText),
                  fontWeight: "800",
                }}
              >
                {step.no}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: palette.inkPrimary,
                  fontSize: fs(14, largeText),
                  fontWeight: "700",
                }}
              >
                {step.title}
              </Text>
              <Text
                style={{
                  color: palette.inkSecondary,
                  fontSize: fs(12, largeText),
                  lineHeight: fs(18, largeText),
                  marginTop: 2,
                }}
              >
                {step.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    gap: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroCta: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tilesGrid: {
    flexDirection: "row",
    gap: 12,
  },
  tile: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  stepsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
});
