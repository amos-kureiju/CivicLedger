import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppPalette, fs } from "../theme";
import {
  AuthUser,
  Merchant,
  OfflineRedemptionItem,
  VerificationResult,
  Voucher,
} from "../types";
import {
  generateClientTxId,
  sha256Hex,
  verifyVoucherOffline,
} from "../crypto";
import { formatDateTime, formatRupiah, formatShortTime } from "../format";

interface MerchantPosScreenProps {
  palette: AppPalette;
  largeText: boolean;
  user: AuthUser;
  merchants: Merchant[];
  vouchers: Voucher[];
  isOfflineMode: boolean;
  offlineQueue: OfflineRedemptionItem[];
  redeemedIds: string[];
  onToggleOffline: () => void;
  onRedeemAccepted: (params: {
    voucher: Voucher;
    merchant: Merchant;
    mode: "ONLINE" | "OFFLINE";
    clientTxId: string;
    receiptHash: string;
  }) => Promise<void>;
  onFraudBlocked: (reason: string) => void;
  onSyncOfflineQueue: () => Promise<{ syncedCount: number; source: string }>;
}

export default function MerchantPosScreen({
  palette,
  largeText,
  user,
  merchants,
  vouchers,
  isOfflineMode,
  offlineQueue,
  redeemedIds,
  onToggleOffline,
  onRedeemAccepted,
  onFraudBlocked,
  onSyncOfflineQueue,
}: MerchantPosScreenProps) {
  const myMerchant = useMemo(
    () =>
      merchants.find((m) => m.id === user.linked_merchant_id) || merchants[0],
    [merchants, user.linked_merchant_id]
  );

  const [codeInput, setCodeInput] = useState("");
  const [verdict, setVerdict] = useState<VerificationResult | null>(null);
  const [showTech, setShowTech] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);

  const activeVouchers = useMemo(
    () => vouchers.filter((v) => v.status === "ACTIVE"),
    [vouchers]
  );

  const pendingQueue = useMemo(
    () => offlineQueue.filter((q) => !q.synced),
    [offlineQueue]
  );

  const resolveVoucherInput = (raw: string): {
    voucher: Voucher | null;
    tamperedSig?: string;
    tamperedNominal?: number;
  } => {
    const trimmed = raw.trim();
    if (!trimmed) return { voucher: null };

    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        const byId = vouchers.find(
          (v) =>
            v.id === parsed.id ||
            v.short_code.toUpperCase() ===
              String(parsed.code || "").toUpperCase()
        );
        if (byId) {
          return {
            voucher: byId,
            tamperedSig: parsed.sig,
            tamperedNominal:
              typeof parsed.nom === "number" ? parsed.nom : byId.nominal_idr,
          };
        }
      } catch {
        // bukan JSON
      }
    }

    const upper = trimmed.toUpperCase();
    const match = vouchers.find(
      (v) =>
        v.short_code.toUpperCase() === upper || v.id.toUpperCase() === upper
    );
    return { voucher: match || null };
  };

  const runVerification = async (rawInput: string, simulateTamper = false) => {
    if (!myMerchant) return;
    setSyncBanner(null);
    const start = Date.now();
    const clientTxId = generateClientTxId();
    const { voucher, tamperedSig, tamperedNominal } =
      resolveVoucherInput(rawInput);

    if (!voucher) {
      setVerdict({
        timestamp: new Date().toISOString(),
        durationMs: Math.max(1, Date.now() - start),
        clientTxId,
        voucherId: "-",
        shortCode: rawInput.trim().toUpperCase() || "-",
        beneficiaryName: "Tidak dikenal",
        commodityName: "-",
        nominalIdr: 0,
        hmacValid: false,
        doubleSpendPassed: false,
        expiryPassed: false,
        mode: isOfflineMode ? "OFFLINE" : "ONLINE",
        providedSignature: "tidak-ada",
        computedSignature: "-",
        errorReason:
          "Kode kupon tidak terdaftar. Pastikan huruf dan angkanya sudah benar.",
      });
      onFraudBlocked("Kode kupon tidak ditemukan");
      return;
    }

    const nominalToCheck = simulateTamper
      ? voucher.nominal_idr + 500000
      : (tamperedNominal ?? voucher.nominal_idr);
    const sigToCheck = simulateTamper
      ? `${voucher.hmac_signature.slice(0, -6)}dead00`
      : (tamperedSig ?? voucher.hmac_signature);

    const check = verifyVoucherOffline({
      voucher_id: voucher.id,
      beneficiary_id: voucher.beneficiary_id,
      commodity_code: voucher.commodity_code,
      nominal_idr: nominalToCheck,
      nonce: voucher.nonce,
      expires_at: voucher.expires_at,
      signature_hex: sigToCheck,
    });

    const expiryPassed = new Date(voucher.expires_at).getTime() > Date.now();
    const alreadyUsed =
      voucher.status !== "ACTIVE" || redeemedIds.includes(voucher.id);
    const doubleSpendPassed = !alreadyUsed;

    if (!check.valid) {
      setVerdict({
        timestamp: new Date().toISOString(),
        durationMs: Math.max(1, Date.now() - start),
        clientTxId,
        voucherId: voucher.id,
        shortCode: voucher.short_code,
        beneficiaryName: voucher.beneficiary_name,
        commodityName: voucher.commodity_name,
        nominalIdr: nominalToCheck,
        hmacValid: false,
        doubleSpendPassed,
        expiryPassed,
        mode: isOfflineMode ? "OFFLINE" : "ONLINE",
        providedSignature: sigToCheck,
        computedSignature: check.expectedSignature,
        errorReason:
          "Tanda tangan kupon tidak cocok (kupon palsu atau nominal diubah). Jangan serahkan barang.",
      });
      onFraudBlocked(`Kupon palsu ditolak (${voucher.short_code})`);
      return;
    }

    if (!doubleSpendPassed) {
      setVerdict({
        timestamp: new Date().toISOString(),
        durationMs: Math.max(1, Date.now() - start),
        clientTxId,
        voucherId: voucher.id,
        shortCode: voucher.short_code,
        beneficiaryName: voucher.beneficiary_name,
        commodityName: voucher.commodity_name,
        nominalIdr: voucher.nominal_idr,
        hmacValid: true,
        doubleSpendPassed: false,
        expiryPassed,
        mode: isOfflineMode ? "OFFLINE" : "ONLINE",
        providedSignature: sigToCheck,
        computedSignature: check.expectedSignature,
        errorReason: `Kupon ${voucher.short_code} sudah pernah dipakai${
          voucher.redeemed_by_merchant_name
            ? ` di ${voucher.redeemed_by_merchant_name}`
            : ""
        }. Tidak bisa dipakai dua kali.`,
      });
      onFraudBlocked(`Kupon ganda ditolak (${voucher.short_code})`);
      return;
    }

    if (!expiryPassed) {
      setVerdict({
        timestamp: new Date().toISOString(),
        durationMs: Math.max(1, Date.now() - start),
        clientTxId,
        voucherId: voucher.id,
        shortCode: voucher.short_code,
        beneficiaryName: voucher.beneficiary_name,
        commodityName: voucher.commodity_name,
        nominalIdr: voucher.nominal_idr,
        hmacValid: true,
        doubleSpendPassed: true,
        expiryPassed: false,
        mode: isOfflineMode ? "OFFLINE" : "ONLINE",
        providedSignature: sigToCheck,
        computedSignature: check.expectedSignature,
        errorReason: "Masa berlaku kupon sudah habis.",
      });
      onFraudBlocked(`Kupon kedaluwarsa (${voucher.short_code})`);
      return;
    }

    setBusy(true);
    const receiptHash = sha256Hex(
      `${clientTxId}|${voucher.id}|${myMerchant.id}|${voucher.nominal_idr}|${Date.now()}`
    );
    const mode = isOfflineMode ? "OFFLINE" : "ONLINE";
    await onRedeemAccepted({
      voucher,
      merchant: myMerchant,
      mode,
      clientTxId,
      receiptHash,
    });
    setBusy(false);

    setVerdict({
      timestamp: new Date().toISOString(),
      durationMs: Math.max(1, Date.now() - start),
      clientTxId,
      voucherId: voucher.id,
      shortCode: voucher.short_code,
      beneficiaryName: voucher.beneficiary_name,
      commodityName: voucher.commodity_name,
      nominalIdr: voucher.nominal_idr,
      hmacValid: true,
      doubleSpendPassed: true,
      expiryPassed: true,
      mode,
      providedSignature: sigToCheck,
      computedSignature: check.expectedSignature,
      receiptHash,
    });
    setCodeInput("");
  };

  const handleTestTamper = () => {
    const sample = activeVouchers[0] || vouchers[0];
    if (!sample) return;
    setCodeInput(sample.short_code);
    runVerification(sample.short_code, true);
  };

  const handleTestDuplicate = () => {
    const used =
      vouchers.find((v) => v.status !== "ACTIVE") ||
      vouchers.find((v) => redeemedIds.includes(v.id)) ||
      vouchers[0];
    if (!used) return;
    setCodeInput(used.short_code);
    runVerification(used.short_code, false);
  };

  const handleSyncPress = async () => {
    if (isOfflineMode) {
      setSyncBanner(
        "Mode Offline masih aktif. Matikan Mode Offline dulu agar catatan bisa dikirim."
      );
      return;
    }
    setSyncing(true);
    setSyncBanner(null);
    const res = await onSyncOfflineQueue();
    setSyncing(false);
    setSyncBanner(
      `${res.syncedCount} catatan offline berhasil dikirim (${res.source}).`
    );
  };

  const verdictPassed =
    verdict &&
    verdict.hmacValid &&
    verdict.doubleSpendPassed &&
    verdict.expiryPassed;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Info Kedai & Status Sinyal */}
      <View
        style={[
          styles.signalCard,
          {
            backgroundColor: isOfflineMode
              ? palette.amberSoft
              : palette.primarySoft,
            borderColor: isOfflineMode ? palette.amber : palette.primary,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: isOfflineMode ? palette.amber : palette.primary,
              fontSize: fs(14, largeText),
              fontWeight: "800",
            }}
          >
            {myMerchant?.name || "Kasir Kedai"}
          </Text>
          <Text
            style={{
              color: palette.inkSecondary,
              fontSize: fs(12, largeText),
              marginTop: 2,
            }}
          >
            {isOfflineMode
              ? "Mode Offline: Kupon tetap dicek di HP & disimpan dulu."
              : `Online · Saldo Belum Cair: ${formatRupiah(myMerchant?.unsettled_balance_idr || 0)}`}
          </Text>
        </View>
        <Pressable
          onPress={onToggleOffline}
          style={[
            styles.signalBtn,
            {
              backgroundColor: palette.card,
              borderColor: isOfflineMode ? palette.amber : palette.primary,
            },
          ]}
        >
          <Text
            style={{
              color: isOfflineMode ? palette.amber : palette.primary,
              fontSize: fs(12, largeText),
              fontWeight: "700",
            }}
          >
            {isOfflineMode ? "Ubah Online" : "Tes Offline"}
          </Text>
        </Pressable>
      </View>

      {/* Form Terima Kupon */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text
          style={{
            color: palette.inkPrimary,
            fontSize: fs(16, largeText),
            fontWeight: "800",
          }}
        >
          Terima Kupon Sembako
        </Text>
        <Text
          style={{
            color: palette.inkSecondary,
            fontSize: fs(13, largeText),
            marginTop: 2,
          }}
        >
          Masukkan kode di kupon warga (misal CL-8841-K9) atau pilih cepat di
          bawah.
        </Text>

        {activeVouchers.length > 0 && (
          <View style={{ marginTop: 12, gap: 6 }}>
            <Text
              style={{
                color: palette.inkMuted,
                fontSize: fs(11, largeText),
                fontWeight: "700",
              }}
            >
              PILIH CEPAT KUPON WARGA ({activeVouchers.length}):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {activeVouchers.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setCodeInput(v.short_code)}
                  style={[
                    styles.quickVoucherChip,
                    {
                      backgroundColor:
                        codeInput.toUpperCase() === v.short_code.toUpperCase()
                          ? palette.primarySoft
                          : palette.nested,
                      borderColor:
                        codeInput.toUpperCase() === v.short_code.toUpperCase()
                          ? palette.primary
                          : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.inkPrimary,
                      fontSize: fs(13, largeText),
                      fontWeight: "800",
                    }}
                  >
                    {v.short_code}
                  </Text>
                  <Text
                    style={{
                      color: palette.inkSecondary,
                      fontSize: fs(11, largeText),
                    }}
                  >
                    {v.beneficiary_name.split(" ").slice(0, 2).join(" ")} ·{" "}
                    {formatRupiah(v.nominal_idr)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={codeInput}
            onChangeText={setCodeInput}
            autoCapitalize="characters"
            placeholder="Ketik kode kupon: CL-8841-K9"
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.codeInput,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.inkPrimary,
                fontSize: fs(18, largeText),
              },
            ]}
          />
          {codeInput.length > 0 && (
            <Pressable onPress={() => setCodeInput("")} style={styles.clearBtn}>
              <Ionicons
                name="close-circle"
                size={22}
                color={palette.inkMuted}
              />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => runVerification(codeInput)}
          disabled={busy || !codeInput.trim()}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: isOfflineMode ? palette.amber : palette.primary,
              opacity: busy || !codeInput.trim() ? 0.55 : pressed ? 0.9 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name={
                  isOfflineMode
                    ? "cloud-offline-outline"
                    : "shield-checkmark-outline"
                }
                size={21}
                color={isOfflineMode ? "#FFFFFF" : palette.primaryText}
              />
              <Text
                style={{
                  color: isOfflineMode ? "#FFFFFF" : palette.primaryText,
                  fontSize: fs(15, largeText),
                  fontWeight: "800",
                }}
              >
                {isOfflineMode ? "Cek & Simpan Offline" : "Cek & Terima Kupon"}
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.simRow}>
          <Pressable
            onPress={handleTestTamper}
            style={[
              styles.simBtn,
              { backgroundColor: palette.roseSoft, borderColor: palette.rose },
            ]}
          >
            <Ionicons name="warning-outline" size={15} color={palette.rose} />
            <Text
              style={{
                color: palette.rose,
                fontSize: fs(12, largeText),
                fontWeight: "700",
              }}
            >
              Tes Kupon Palsu
            </Text>
          </Pressable>

          <Pressable
            onPress={handleTestDuplicate}
            style={[
              styles.simBtn,
              {
                backgroundColor: palette.amberSoft,
                borderColor: palette.amber,
              },
            ]}
          >
            <Ionicons name="copy-outline" size={15} color={palette.amber} />
            <Text
              style={{
                color: palette.amber,
                fontSize: fs(12, largeText),
                fontWeight: "700",
              }}
            >
              Tes Kupon Ganda
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Hasil Pengecekan */}
      {verdict && (
        <View
          style={[
            styles.verdictCard,
            {
              backgroundColor: verdictPassed
                ? palette.primarySoft
                : palette.roseSoft,
              borderColor: verdictPassed ? palette.primary : palette.rose,
            },
          ]}
        >
          <View style={styles.verdictHeader}>
            <Ionicons
              name={verdictPassed ? "checkmark-circle" : "close-circle"}
              size={30}
              color={verdictPassed ? palette.primary : palette.rose}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: verdictPassed ? palette.primary : palette.rose,
                  fontSize: fs(16, largeText),
                  fontWeight: "800",
                }}
              >
                {verdictPassed
                  ? "Kupon Sah — Serahkan Sembako"
                  : "Kupon Ditolak — Jangan Serahkan"}
              </Text>
              <Text
                style={{
                  color: palette.inkSecondary,
                  fontSize: fs(12, largeText),
                }}
              >
                {verdict.shortCode} · {verdict.durationMs} ms (
                {verdict.mode === "OFFLINE" ? "Offline di HP" : "Online"})
              </Text>
            </View>
          </View>

          {verdictPassed ? (
            <View
              style={[
                styles.verdictBody,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text
                style={{
                  color: palette.inkPrimary,
                  fontSize: fs(15, largeText),
                  fontWeight: "700",
                }}
              >
                {verdict.beneficiaryName}
              </Text>
              <Text
                style={{
                  color: palette.inkSecondary,
                  fontSize: fs(13, largeText),
                  marginTop: 2,
                }}
              >
                {verdict.commodityName} ·{" "}
                <Text style={{ color: palette.primary, fontWeight: "800" }}>
                  {formatRupiah(verdict.nominalIdr)}
                </Text>
              </Text>
              <Text
                style={{
                  color: palette.inkMuted,
                  fontSize: fs(12, largeText),
                  marginTop: 4,
                }}
              >
                {verdict.mode === "OFFLINE"
                  ? "Disimpan di antrean offline HP. Kirim saat sinyal kembali."
                  : "Saldo pencairan kedai otomatis bertambah."}
              </Text>
            </View>
          ) : (
            <Text
              style={{
                color: palette.rose,
                fontSize: fs(13, largeText),
                fontWeight: "600",
                lineHeight: fs(19, largeText),
              }}
            >
              {verdict.errorReason}
            </Text>
          )}

          <Pressable
            onPress={() => setShowTech(!showTech)}
            style={styles.techRow}
          >
            <Text
              style={{
                color: palette.inkSecondary,
                fontSize: fs(12, largeText),
                fontWeight: "700",
              }}
            >
              {showTech
                ? "Sembunyikan Detail Keamanan"
                : "Lihat Detail Keamanan (HMAC-SHA256)"}
            </Text>
            <Ionicons
              name={showTech ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.inkSecondary}
            />
          </Pressable>

          {showTech && (
            <View
              style={[
                styles.techBox,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={{ color: palette.inkSecondary, fontSize: 11 }}>
                HMAC: {verdict.hmacValid ? "COCOK" : "TIDAK COCOK"} | Anti-Ganda:{" "}
                {verdict.doubleSpendPassed ? "AMAN" : "GANDA"}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: palette.inkMuted, fontSize: 11 }}
              >
                TX ID: {verdict.clientTxId}
              </Text>
              {verdict.receiptHash && (
                <Text
                  numberOfLines={1}
                  style={{ color: palette.primary, fontSize: 11 }}
                >
                  Resi SHA-256: {verdict.receiptHash}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Antrean Offline */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.queueHeader}>
          <View>
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(15, largeText),
                fontWeight: "800",
              }}
            >
              Catatan Offline di HP
            </Text>
            <Text
              style={{
                color: palette.inkMuted,
                fontSize: fs(12, largeText),
              }}
            >
              {pendingQueue.length} transaksi menunggu dikirim
            </Text>
          </View>
          {pendingQueue.length > 0 && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: palette.amberSoft },
              ]}
            >
              <Text
                style={{
                  color: palette.amber,
                  fontSize: fs(13, largeText),
                  fontWeight: "800",
                }}
              >
                {pendingQueue.length}
              </Text>
            </View>
          )}
        </View>

        {syncBanner && (
          <View
            style={[
              styles.syncBanner,
              {
                backgroundColor: palette.primarySoft,
                borderColor: palette.primary,
              },
            ]}
          >
            <Text
              style={{
                color: palette.primary,
                fontSize: fs(12, largeText),
                fontWeight: "700",
              }}
            >
              {syncBanner}
            </Text>
          </View>
        )}

        {pendingQueue.length === 0 ? (
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(13, largeText),
              marginTop: 8,
            }}
          >
            Semua catatan sudah terkirim. Kupon yang diterima saat Mode Offline
            akan tampil di sini.
          </Text>
        ) : (
          <View style={{ gap: 10, marginTop: 10 }}>
            {pendingQueue.map((item) => (
              <View
                key={item.queue_id}
                style={[
                  styles.queueItem,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: palette.inkPrimary,
                      fontSize: fs(14, largeText),
                      fontWeight: "700",
                    }}
                  >
                    {item.short_code} · {item.beneficiary_name}
                  </Text>
                  <Text
                    style={{
                      color: palette.inkSecondary,
                      fontSize: fs(12, largeText),
                    }}
                  >
                    {item.commodity_name} · {formatShortTime(item.redeemed_at)}
                  </Text>
                </View>
                <Text
                  style={{
                    color: palette.amber,
                    fontSize: fs(14, largeText),
                    fontWeight: "800",
                  }}
                >
                  {formatRupiah(item.nominal_idr)}
                </Text>
              </View>
            ))}

            <Pressable
              onPress={handleSyncPress}
              disabled={syncing}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: isOfflineMode
                    ? palette.nested
                    : palette.primary,
                  marginTop: 4,
                },
              ]}
            >
              {syncing ? (
                <ActivityIndicator color={palette.primaryText} />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={20}
                    color={
                      isOfflineMode ? palette.inkSecondary : palette.primaryText
                    }
                  />
                  <Text
                    style={{
                      color: isOfflineMode
                        ? palette.inkSecondary
                        : palette.primaryText,
                      fontSize: fs(14, largeText),
                      fontWeight: "800",
                    }}
                  >
                    {isOfflineMode
                      ? "Matikan Mode Offline untuk Kirim"
                      : `Kirim Semua ke Pusat (${pendingQueue.length})`}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {offlineQueue.some((q) => q.synced) && (
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(11, largeText),
              marginTop: 10,
            }}
          >
            Terakhir tersinkron:{" "}
            {formatDateTime(
              offlineQueue.find((q) => q.synced)?.redeemed_at ||
                new Date().toISOString()
            )}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  signalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  signalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  quickVoucherChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  inputRow: {
    marginTop: 14,
    position: "relative",
    justifyContent: "center",
  },
  codeInput: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingRight: 44,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  clearBtn: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  primaryBtn: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  simRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  simBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  verdictCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 10,
  },
  verdictHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  verdictBody: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  techBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  syncBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
