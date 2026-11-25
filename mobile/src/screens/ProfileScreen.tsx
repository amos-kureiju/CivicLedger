import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppPalette, ThemeMode, fs } from "../theme";
import { AuthUser } from "../types";
import { mobileChangePassword } from "../storage";

interface ProfileScreenProps {
  palette: AppPalette;
  theme: ThemeMode;
  largeText: boolean;
  isOfflineMode: boolean;
  serverUrl: string;
  dataSource: "SERVER" | "LOCAL";
  user: AuthUser;
  onToggleTheme: () => void;
  onToggleLargeText: () => void;
  onToggleOffline: () => void;
  onSaveServerUrl: (url: string) => Promise<void>;
  onResetDemo: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export default function ProfileScreen({
  palette,
  theme,
  largeText,
  isOfflineMode,
  serverUrl,
  dataSource,
  user,
  onToggleTheme,
  onToggleLargeText,
  onToggleOffline,
  onSaveServerUrl,
  onResetDemo,
  onLogout,
}: ProfileScreenProps) {
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [urlSavedMsg, setUrlSavedMsg] = useState<string | null>(null);

  // Modal Ganti Sandi
  const [showPassModal, setShowPassModal] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg, setPassMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Konfirmasi Reset
  const [confirmReset, setConfirmReset] = useState(false);

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const handleSaveUrl = async () => {
    setUrlSavedMsg(null);
    await onSaveServerUrl(urlInput.trim());
    setUrlSavedMsg("Alamat server disimpan & sedang dicek.");
  };

  const handleChangePass = async () => {
    setPassMsg(null);
    if (newPass.length < 6) {
      setPassMsg({
        type: "err",
        text: "Kata sandi baru minimal 6 karakter.",
      });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ type: "err", text: "Ulangi kata sandi baru belum sama." });
      return;
    }
    const res = await mobileChangePassword(user.id, oldPass, newPass);
    if (!res.ok) {
      setPassMsg({ type: "err", text: res.error });
      return;
    }
    setPassMsg({ type: "ok", text: "Kata sandi berhasil diganti." });
    setOldPass("");
    setNewPass("");
    setConfirmPass("");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Kartu Identitas */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.avatarRow}>
          <View
            style={[styles.avatar, { backgroundColor: palette.primary }]}
          >
            <Text
              style={{
                color: palette.primaryText,
                fontSize: fs(20, largeText),
                fontWeight: "800",
              }}
            >
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(18, largeText),
                fontWeight: "800",
              }}
            >
              {user.name}
            </Text>
            <View
              style={[
                styles.rolePill,
                { backgroundColor: palette.primarySoft },
              ]}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontSize: fs(12, largeText),
                  fontWeight: "700",
                }}
              >
                {user.role_label}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.infoBox,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text
            style={{
              color: palette.inkSecondary,
              fontSize: fs(13, largeText),
            }}
          >
            Wilayah: {user.rt_rw}
          </Text>
          <Text
            style={{
              color: palette.inkSecondary,
              fontSize: fs(13, largeText),
            }}
          >
            Email: {user.email}
          </Text>
          <Text
            style={{
              color: palette.inkSecondary,
              fontSize: fs(13, largeText),
            }}
          >
            Nomor HP: {user.phone}
          </Text>
        </View>
      </View>

      {/* Kenyamanan Tampilan */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text
          style={{
            color: palette.inkPrimary,
            fontSize: fs(15, largeText),
            fontWeight: "800",
          }}
        >
          Kenyamanan Layar
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(14, largeText),
                fontWeight: "700",
              }}
            >
              Huruf Besar (A+)
            </Text>
            <Text
              style={{
                color: palette.inkMuted,
                fontSize: fs(12, largeText),
              }}
            >
              Memperbesar tulisan agar mudah dibaca orang tua.
            </Text>
          </View>
          <Switch
            value={largeText}
            onValueChange={onToggleLargeText}
            trackColor={{ false: palette.border, true: palette.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View
          style={[styles.divider, { backgroundColor: palette.border }]}
        />

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(14, largeText),
                fontWeight: "700",
              }}
            >
              Layar Malam
            </Text>
            <Text
              style={{
                color: palette.inkMuted,
                fontSize: fs(12, largeText),
              }}
            >
              Warna gelap hangat agar tidak silau di malam hari.
            </Text>
          </View>
          <Switch
            value={theme === "dark"}
            onValueChange={onToggleTheme}
            trackColor={{ false: palette.border, true: palette.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Koneksi & Server */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text
          style={{
            color: palette.inkPrimary,
            fontSize: fs(15, largeText),
            fontWeight: "800",
          }}
        >
          Koneksi &amp; Server ({dataSource === "SERVER" ? "Tersambung" : "Lokal HP"})
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(14, largeText),
                fontWeight: "700",
              }}
            >
              Mode Offline (Simulasi Tanpa Sinyal)
            </Text>
            <Text
              style={{
                color: palette.inkMuted,
                fontSize: fs(12, largeText),
              }}
            >
              Nyalakan jika sedang berada di tempat tanpa sinyal — kupon QR
              tetap bisa dibuka.
            </Text>
          </View>
          <Switch
            value={isOfflineMode}
            onValueChange={onToggleOffline}
            trackColor={{ false: palette.border, true: palette.amber }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View
          style={[styles.divider, { backgroundColor: palette.border }]}
        />

        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: palette.inkSecondary,
              fontSize: fs(12, largeText),
              fontWeight: "700",
            }}
          >
            Alamat Server Web (Opsional untuk LAN Wi-Fi)
          </Text>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            placeholder="http://192.168.1.10:3000"
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.inkPrimary,
                fontSize: fs(14, largeText),
              },
            ]}
          />
          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(11, largeText),
              lineHeight: fs(16, largeText),
            }}
          >
            Jika menjalankan di HP via Expo Go dan ingin tersambung ke web di
            laptop, isi IP Wi-Fi laptop. Jika server mati, aplikasi tetap jalan
            normal dengan data lokal di HP.
          </Text>
          {urlSavedMsg && (
            <Text
              style={{
                color: palette.primary,
                fontSize: fs(12, largeText),
                fontWeight: "700",
              }}
            >
              {urlSavedMsg}
            </Text>
          )}
          <Pressable
            onPress={handleSaveUrl}
            style={[
              styles.secBtn,
              {
                backgroundColor: palette.nested,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(13, largeText),
                fontWeight: "700",
              }}
            >
              Simpan &amp; Coba Sambungkan
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Keamanan & Aksi Akun */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Pressable
          onPress={() => {
            setPassMsg(null);
            setShowPassModal(true);
          }}
          style={[
            styles.actionRow,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Ionicons
            name="key-outline"
            size={20}
            color={palette.primary}
          />
          <Text
            style={{
              flex: 1,
              color: palette.inkPrimary,
              fontSize: fs(14, largeText),
              fontWeight: "700",
            }}
          >
            Ganti Kata Sandi
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={palette.inkMuted}
          />
        </Pressable>

        {!confirmReset ? (
          <Pressable
            onPress={() => setConfirmReset(true)}
            style={[
              styles.actionRow,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={palette.amber}
            />
            <Text
              style={{
                flex: 1,
                color: palette.inkPrimary,
                fontSize: fs(14, largeText),
                fontWeight: "700",
              }}
            >
              Reset Data Demo ke Awal
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={palette.inkMuted}
            />
          </Pressable>
        ) : (
          <View
            style={[
              styles.confirmBox,
              {
                backgroundColor: palette.amberSoft,
                borderColor: palette.amber,
              },
            ]}
          >
            <Text
              style={{
                color: palette.amber,
                fontSize: fs(13, largeText),
                fontWeight: "700",
              }}
            >
              Yakin kembalikan 20 warga &amp; kupon ke kondisi awal?
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={() => setConfirmReset(false)}
                style={[
                  styles.smallBtn,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: palette.inkPrimary,
                    fontSize: fs(13, largeText),
                    fontWeight: "700",
                  }}
                >
                  Batal
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setConfirmReset(false);
                  await onResetDemo();
                }}
                style={[
                  styles.smallBtn,
                  { backgroundColor: palette.amber, borderColor: palette.amber },
                ]}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: fs(13, largeText),
                    fontWeight: "700",
                  }}
                >
                  Ya, Reset
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          onPress={onLogout}
          style={[
            styles.logoutBtn,
            { backgroundColor: palette.roseSoft, borderColor: palette.rose },
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={palette.rose} />
          <Text
            style={{
              color: palette.rose,
              fontSize: fs(15, largeText),
              fontWeight: "800",
            }}
          >
            Keluar dari Akun
          </Text>
        </Pressable>
      </View>

      <Text
        style={{
          color: palette.inkMuted,
          fontSize: fs(11, largeText),
          textAlign: "center",
          lineHeight: fs(17, largeText),
        }}
      >
        CivicLedger Mobile · Tim Run.exe (STACK 2026){"\n"}Data warga, kode
        OTP, dan pencairan bersifat simulasi lokal.
      </Text>

      {/* MODAL GANTI KATA SANDI */}
      <Modal
        visible={showPassModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPassModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text
              style={{
                color: palette.inkPrimary,
                fontSize: fs(17, largeText),
                fontWeight: "800",
              }}
            >
              Ganti Kata Sandi
            </Text>

            {passMsg && (
              <View
                style={[
                  styles.passBanner,
                  {
                    backgroundColor:
                      passMsg.type === "ok"
                        ? palette.primarySoft
                        : palette.roseSoft,
                    borderColor:
                      passMsg.type === "ok" ? palette.primary : palette.rose,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      passMsg.type === "ok" ? palette.primary : palette.rose,
                    fontSize: fs(13, largeText),
                    fontWeight: "600",
                  }}
                >
                  {passMsg.text}
                </Text>
              </View>
            )}

            <TextInput
              value={oldPass}
              onChangeText={setOldPass}
              secureTextEntry
              placeholder="Kata sandi lama"
              placeholderTextColor={palette.inkMuted}
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.inkPrimary,
                  fontSize: fs(14, largeText),
                },
              ]}
            />
            <TextInput
              value={newPass}
              onChangeText={setNewPass}
              secureTextEntry
              placeholder="Kata sandi baru (min. 6 karakter)"
              placeholderTextColor={palette.inkMuted}
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.inkPrimary,
                  fontSize: fs(14, largeText),
                },
              ]}
            />
            <TextInput
              value={confirmPass}
              onChangeText={setConfirmPass}
              secureTextEntry
              placeholder="Ulangi kata sandi baru"
              placeholderTextColor={palette.inkMuted}
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.inkPrimary,
                  fontSize: fs(14, largeText),
                },
              ]}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={() => setShowPassModal(false)}
                style={[
                  styles.smallBtn,
                  {
                    backgroundColor: palette.nested,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: palette.inkPrimary,
                    fontSize: fs(14, largeText),
                    fontWeight: "700",
                  }}
                >
                  Tutup
                </Text>
              </Pressable>
              <Pressable
                onPress={handleChangePass}
                style={[
                  styles.smallBtn,
                  {
                    backgroundColor: palette.primary,
                    borderColor: palette.primary,
                  },
                ]}
              >
                <Text
                  style={{
                    color: palette.primaryText,
                    fontSize: fs(14, largeText),
                    fontWeight: "700",
                  }}
                >
                  Simpan
                </Text>
              </Pressable>
            </View>
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
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rolePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  infoBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  divider: {
    height: 1,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  secBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  confirmBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  smallBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  passBanner: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
