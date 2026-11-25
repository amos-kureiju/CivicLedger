import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { AppPalette, fs } from "../theme";
import { AuthUser, Voucher } from "../types";
import { encodeVoucherToQRPayload } from "../crypto";
import { formatDateTime, formatRupiah, formatStatusLabel } from "../format";

interface VoucherScreenProps {
  palette: AppPalette;
  largeText: boolean;
  user: AuthUser;
  vouchers: Voucher[];
  selectedVoucherId: string | null;
  onSelectVoucher: (id: string) => void;
}

export default function VoucherScreen({
  palette,
  largeText,
  user,
  vouchers,
  selectedVoucherId,
  onSelectVoucher,
}: VoucherScreenProps) {
  const [showFullQr, setShowFullQr] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const visibleVouchers = vouchers.filter(
    (v) => v.beneficiary_id === (user.linked_beneficiary_id || "WGA-0401")
  );

  const currentVoucher =
    visibleVouchers.find((v) => v.id === selectedVoucherId) ||
    visibleVouchers.find((v) => v.status === "ACTIVE") ||
    visibleVouchers[0] ||
    null;

  const qrValue = currentVoucher
    ? encodeVoucherToQRPayload(currentVoucher)
    : "";

  const handleShareSms = async (v: Voucher) => {
    const msg = `[Kupon Bansos Toba]\nNama: ${v.beneficiary_name}\nKode Kupon: ${v.short_code}\nPaket: ${v.commodity_name} (${formatRupiah(v.nominal_idr)})\nBerlaku s/d: ${formatDateTime(v.expires_at)}\nTunjukkan kode ini ke kedai mitra terdekat.`;
    try {
      await Share.share({ message: msg });
    } catch {
      // pengguna batal berbagi
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Pilihan jika warga punya lebih dari 1 kupon */}
      {visibleVouchers.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {visibleVouchers.map((v) => {
            const active = currentVoucher?.id === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => onSelectVoucher(v.id)}
                style={[
                  styles.voucherChip,
                  {
                    backgroundColor: active ? palette.primary : palette.card,
                    borderColor: active ? palette.primary : palette.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? palette.primaryText : palette.inkPrimary,
                    fontSize: fs(13, largeText),
                    fontWeight: "700",
                  }}
                >
                  {v.short_code} · {formatStatusLabel(v.status)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!currentVoucher ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Ionicons
            name="ticket-outline"
            size={38}
            color={palette.inkMuted}
          />
          <Text
            style={{
              color: palette.inkPrimary,
              fontSize: fs(16, largeText),
              fontWeight: "700",
              marginTop: 8,
            }}
          >
            Belum ada kupon aktif
          </Text>
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(13, largeText),
              textAlign: "center",
              marginTop: 4,
            }}
          >
            Kupon sembako baru dari pengurus desa akan otomatis muncul di sini.
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.ticketCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          {/* Header Tiket */}
          <View
            style={[
              styles.ticketHeader,
              { borderBottomColor: palette.border },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="leaf-outline" size={16} color={palette.primary} />
              <Text
                style={{
                  color: palette.primary,
                  fontSize: fs(12, largeText),
                  fontWeight: "800",
                  letterSpacing: 0.6,
                }}
              >
                KUPON SEMBAKO TOBA
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    currentVoucher.status === "ACTIVE"
                      ? palette.primarySoft
                      : palette.nested,
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      currentVoucher.status === "ACTIVE"
                        ? palette.primary
                        : palette.inkMuted,
                  },
                ]}
              />
              <Text
                style={{
                  color:
                    currentVoucher.status === "ACTIVE"
                      ? palette.primary
                      : palette.inkMuted,
                  fontSize: fs(12, largeText),
                  fontWeight: "700",
                }}
              >
                {formatStatusLabel(currentVoucher.status)}
              </Text>
            </View>
          </View>

          {/* Nama Penerima */}
          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(20, largeText),
                fontWeight: "800",
              }}
            >
              {currentVoucher.beneficiary_name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
              }}
            >
              <Ionicons
                name="location-outline"
                size={15}
                color={palette.primary}
              />
              <Text
                style={{
                  color: palette.inkSecondary,
                  fontSize: fs(13, largeText),
                }}
              >
                {currentVoucher.rt_rw}
              </Text>
            </View>
          </View>

          {/* Paket & Nilai */}
          <View
            style={[
              styles.pkgBox,
              { backgroundColor: palette.nested, borderColor: palette.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: palette.inkPrimary,
                  fontSize: fs(15, largeText),
                  fontWeight: "700",
                }}
              >
                {currentVoucher.commodity_name}
              </Text>
              <Text
                style={{
                  color: palette.inkSecondary,
                  fontSize: fs(12, largeText),
                  marginTop: 3,
                }}
              >
                {currentVoucher.commodity_items}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: palette.inkMuted,
                  fontSize: fs(11, largeText),
                }}
              >
                Nilai
              </Text>
              <Text
                style={{
                  color: palette.primary,
                  fontSize: fs(18, largeText),
                  fontWeight: "800",
                }}
              >
                {formatRupiah(currentVoucher.nominal_idr)}
              </Text>
            </View>
          </View>

          {/* QR Code */}
          <Pressable
            onPress={() => setShowFullQr(true)}
            style={styles.qrSection}
          >
            <View style={styles.qrFrame}>
              <QRCode
                value={qrValue}
                size={200}
                color="#1D2622"
                backgroundColor="#FFFFFF"
              />
            </View>
            <View style={styles.zoomHint}>
              <Ionicons
                name="expand-outline"
                size={15}
                color={palette.primary}
              />
              <Text
                style={{
                  color: palette.primary,
                  fontSize: fs(13, largeText),
                  fontWeight: "700",
                }}
              >
                Ketuk QR untuk Perbesar Layar Penuh
              </Text>
            </View>
          </Pressable>

          {/* Kode Pendek */}
          <View
            style={[
              styles.codeStrip,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text
              style={{
                color: palette.inkSecondary,
                fontSize: fs(12, largeText),
                fontWeight: "700",
              }}
            >
              KODE KUPON
            </Text>
            <Text
              selectable
              style={{
                color: palette.inkPrimary,
                fontSize: fs(23, largeText),
                fontWeight: "800",
                letterSpacing: 3,
              }}
            >
              {currentVoucher.short_code}
            </Text>
          </View>

          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(12, largeText),
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Berlaku sampai {formatDateTime(currentVoucher.expires_at)}
          </Text>

          {/* Detail Keamanan Lipat */}
          <Pressable
            onPress={() => setShowTech(!showTech)}
            style={[
              styles.techToggle,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons
                name="shield-checkmark-outline"
                size={15}
                color={palette.primary}
              />
              <Text
                style={{
                  color: palette.inkSecondary,
                  fontSize: fs(12, largeText),
                  fontWeight: "600",
                }}
              >
                Kode Keaslian Kupon (HMAC)
              </Text>
            </View>
            <Ionicons
              name={showTech ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.inkMuted}
            />
          </Pressable>

          {showTech && (
            <View
              style={[
                styles.techBox,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={{ color: palette.inkMuted, fontSize: 11 }}>
                ID: {currentVoucher.id}
              </Text>
              <Text style={{ color: palette.inkMuted, fontSize: 11 }}>
                Kode Acak: {currentVoucher.nonce}
              </Text>
              <Text
                numberOfLines={2}
                style={{ color: palette.inkSecondary, fontSize: 11 }}
              >
                Tanda Tangan: {currentVoucher.hmac_signature}
              </Text>
            </View>
          )}

          {/* Tombol Aksi */}
          <View style={styles.btnRow}>
            <Pressable
              onPress={() => handleShareSms(currentVoucher)}
              style={[
                styles.secBtn,
                {
                  backgroundColor: palette.nested,
                  borderColor: palette.border,
                },
              ]}
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color={palette.inkPrimary}
              />
              <Text
                style={{
                  color: palette.inkPrimary,
                  fontSize: fs(14, largeText),
                  fontWeight: "700",
                }}
              >
                Kirim WA / SMS
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowFullQr(true)}
              style={[
                styles.secBtn,
                {
                  backgroundColor: palette.primary,
                  borderColor: palette.primary,
                },
              ]}
            >
              <Ionicons
                name="qr-code-outline"
                size={18}
                color={palette.primaryText}
              />
              <Text
                style={{
                  color: palette.primaryText,
                  fontSize: fs(14, largeText),
                  fontWeight: "700",
                }}
              >
                QR Besar
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* MODAL QR LAYAR PENUH */}
      <Modal
        visible={showFullQr && !!currentVoucher}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFullQr(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tunjukkan ke Pemilik Kedai</Text>
            {currentVoucher && (
              <>
                <Text style={styles.modalSub}>
                  {currentVoucher.beneficiary_name} ·{" "}
                  {currentVoucher.commodity_name}
                </Text>
                <View style={styles.modalQrWrap}>
                  <QRCode
                    value={qrValue}
                    size={250}
                    color="#1D2622"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.modalCode}>
                  {currentVoucher.short_code}
                </Text>
                <Text style={styles.modalNominal}>
                  {formatRupiah(currentVoucher.nominal_idr)}
                </Text>
              </>
            )}
            <Pressable
              onPress={() => setShowFullQr(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  voucherChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  ticketCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderStyle: "dashed",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pkgBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  qrSection: {
    alignItems: "center",
    marginTop: 18,
  },
  qrFrame: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4DDD2",
  },
  zoomHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  codeStrip: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  techToggle: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  techBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  secBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1D2622",
  },
  modalSub: {
    fontSize: 14,
    color: "#525F59",
    marginTop: 4,
    textAlign: "center",
  },
  modalQrWrap: {
    marginVertical: 20,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5DDD0",
  },
  modalCode: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#1D2622",
  },
  modalNominal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B6B50",
    marginTop: 4,
  },
  modalCloseBtn: {
    marginTop: 20,
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#1B6B50",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
