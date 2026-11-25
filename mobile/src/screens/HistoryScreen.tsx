import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppPalette, fs } from "../theme";
import { AuthUser, LedgerEntry, OfflineRedemptionItem } from "../types";
import { formatDateTime, formatRupiah } from "../format";

interface HistoryScreenProps {
  palette: AppPalette;
  largeText: boolean;
  user: AuthUser;
  ledger: LedgerEntry[];
  offlineQueue: OfflineRedemptionItem[];
}

export default function HistoryScreen({
  palette,
  largeText,
  user,
  ledger,
  offlineQueue,
}: HistoryScreenProps) {
  const [scope, setScope] = useState<"MINE" | "ALL">("MINE");
  const isMerchant = user.role === "MERCHANT";

  const pendingOffline = useMemo(
    () => (isMerchant ? offlineQueue.filter((q) => !q.synced) : []),
    [isMerchant, offlineQueue]
  );

  const filteredLedger = useMemo(() => {
    if (scope === "ALL") return ledger;
    if (isMerchant) {
      return ledger.filter(
        (tx) => tx.merchant_id === (user.linked_merchant_id || "WRG-01")
      );
    }
    return ledger.filter(
      (tx) => tx.beneficiary_id === (user.linked_beneficiary_id || "WGA-0401")
    );
  }, [ledger, scope, isMerchant, user]);

  const totalNominal = useMemo(
    () => filteredLedger.reduce((acc, item) => acc + item.nominal_idr, 0),
    [filteredLedger]
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.summaryRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.inkMuted,
                fontSize: fs(12, largeText),
                fontWeight: "600",
              }}
            >
              {scope === "MINE"
                ? isMerchant
                  ? "Total Transaksi Kedai Saya"
                  : "Total Bantuan Diterima"
                : "Total Penyaluran Komunitas"}
            </Text>
            <Text
              style={{
                color: palette.primary,
                fontSize: fs(24, largeText),
                fontWeight: "800",
                marginTop: 2,
              }}
            >
              {formatRupiah(totalNominal)}
            </Text>
          </View>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: palette.primarySoft },
            ]}
          >
            <Ionicons
              name="receipt-outline"
              size={22}
              color={palette.primary}
            />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.segmented,
          { backgroundColor: palette.nested, borderColor: palette.border },
        ]}
      >
        <Pressable
          onPress={() => setScope("MINE")}
          style={[
            styles.segBtn,
            scope === "MINE" && { backgroundColor: palette.card },
          ]}
        >
          <Text
            style={{
              color: scope === "MINE" ? palette.inkPrimary : palette.inkMuted,
              fontSize: fs(13, largeText),
              fontWeight: "700",
            }}
          >
            {isMerchant ? "Kedai Saya" : "Riwayat Saya"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setScope("ALL")}
          style={[
            styles.segBtn,
            scope === "ALL" && { backgroundColor: palette.card },
          ]}
        >
          <Text
            style={{
              color: scope === "ALL" ? palette.inkPrimary : palette.inkMuted,
              fontSize: fs(13, largeText),
              fontWeight: "700",
            }}
          >
            Catatan Desa ({ledger.length})
          </Text>
        </Pressable>
      </View>

      {pendingOffline.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: palette.amber,
              fontSize: fs(13, largeText),
              fontWeight: "800",
            }}
          >
            Menunggu Sinyal ({pendingOffline.length})
          </Text>
          {pendingOffline.map((item) => (
            <View
              key={item.queue_id}
              style={[
                styles.txCard,
                {
                  backgroundColor: palette.amberSoft,
                  borderColor: palette.amber,
                },
              ]}
            >
              <View style={styles.txTop}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: palette.inkPrimary,
                      fontSize: fs(14, largeText),
                      fontWeight: "800",
                    }}
                  >
                    {item.commodity_name}
                  </Text>
                  <Text
                    style={{
                      color: palette.inkSecondary,
                      fontSize: fs(12, largeText),
                    }}
                  >
                    {item.short_code} · {item.beneficiary_name}
                  </Text>
                </View>
                <Text
                  style={{
                    color: palette.amber,
                    fontSize: fs(15, largeText),
                    fontWeight: "800",
                  }}
                >
                  {formatRupiah(item.nominal_idr)}
                </Text>
              </View>
              <Text
                style={{
                  color: palette.amber,
                  fontSize: fs(11, largeText),
                  fontWeight: "700",
                }}
              >
                Disimpan offline · {formatDateTime(item.redeemed_at)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {filteredLedger.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={36}
            color={palette.inkMuted}
          />
          <Text
            style={{
              color: palette.inkPrimary,
              fontSize: fs(15, largeText),
              fontWeight: "700",
              marginTop: 8,
            }}
          >
            Belum ada riwayat penukaran
          </Text>
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(13, largeText),
              textAlign: "center",
              marginTop: 4,
            }}
          >
            Setelah kupon ditukar di kedai mitra, buktinya akan tercatat otomatis
            di sini.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filteredLedger.map((tx) => {
            const isOfflineSync = tx.sync_mode === "OFFLINE_BATCH_SYNC";
            return (
              <View
                key={tx.id}
                style={[
                  styles.txCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={styles.txTop}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: palette.inkPrimary,
                        fontSize: fs(15, largeText),
                        fontWeight: "800",
                      }}
                    >
                      {tx.commodity_name}
                    </Text>
                    <Text
                      style={{
                        color: palette.inkSecondary,
                        fontSize: fs(13, largeText),
                        marginTop: 2,
                      }}
                    >
                      {tx.merchant_name}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: palette.primary,
                      fontSize: fs(15, largeText),
                      fontWeight: "800",
                    }}
                  >
                    {formatRupiah(tx.nominal_idr)}
                  </Text>
                </View>

                <View style={styles.txFooter}>
                  <View
                    style={[
                      styles.modePill,
                      {
                        backgroundColor: isOfflineSync
                          ? palette.amberSoft
                          : palette.primarySoft,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isOfflineSync ? palette.amber : palette.primary,
                        fontSize: fs(11, largeText),
                        fontWeight: "700",
                      }}
                    >
                      {isMerchant
                        ? isOfflineSync
                          ? "Sinkron Offline"
                          : "Online"
                        : "Sudah Diterima"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: palette.inkMuted,
                      fontSize: fs(12, largeText),
                    }}
                  >
                    {tx.short_code} · {formatDateTime(tx.timestamp)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    padding: 28,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
  },
  txCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  txTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  txFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  modePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
