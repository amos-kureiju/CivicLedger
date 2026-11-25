import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppPalette, ThemeMode, fs } from "../theme";
import { AuthUser } from "../types";
import {
  mobileConfirmReset,
  mobileLogin,
  mobileRegister,
  mobileRequestResetOtp,
} from "../storage";

interface AuthScreenProps {
  palette: AppPalette;
  theme: ThemeMode;
  largeText: boolean;
  serverUrl: string;
  onToggleTheme: () => void;
  onToggleLargeText: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

type ScreenView = "LOGIN" | "RESET" | "REGISTER";
type MobileRole = "BENEFICIARY" | "MERCHANT";

export default function AuthScreen({
  palette,
  theme,
  largeText,
  serverUrl,
  onToggleTheme,
  onToggleLargeText,
  onAuthenticated,
}: AuthScreenProps) {
  const [view, setView] = useState<ScreenView>("LOGIN");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err" | "info";
    text: string;
  } | null>(null);

  // Login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Reset Password
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetId, setResetId] = useState("");
  const [resetName, setResetName] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // Register (Warga atau Pemilik Kedai)
  const [regRole, setRegRole] = useState<MobileRole>("BENEFICIARY");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regArea, setRegArea] = useState("Desa Sitoluama, Laguboti");
  const [regPass, setRegPass] = useState("");

  const switchView = (next: ScreenView) => {
    setView(next);
    setFeedback(null);
    if (next === "RESET") {
      setResetStep(1);
    }
  };

  const doLogin = async (idOverride?: string, passOverride?: string) => {
    setFeedback(null);
    setBusy(true);
    const res = await mobileLogin(
      serverUrl,
      idOverride ?? identifier,
      passOverride ?? password
    );
    setBusy(false);
    if (!res.ok) {
      setFeedback({ type: "err", text: res.error });
      return;
    }
    onAuthenticated(res.user);
  };

  const doRequestOtp = async () => {
    setFeedback(null);
    setBusy(true);
    const res = await mobileRequestResetOtp(serverUrl, resetId);
    setBusy(false);
    if (!res.ok) {
      setFeedback({ type: "err", text: res.error });
      return;
    }
    setResetName(res.account_name);
    setDemoOtp(res.demo_otp_code);
    setResetStep(2);
    setFeedback({ type: "info", text: res.message });
  };

  const doConfirmReset = async () => {
    setFeedback(null);
    if (newPass.length < 6) {
      setFeedback({ type: "err", text: "Kata sandi baru minimal 6 karakter." });
      return;
    }
    if (newPass !== confirmPass) {
      setFeedback({ type: "err", text: "Ulangi kata sandi baru belum sama." });
      return;
    }
    setBusy(true);
    const res = await mobileConfirmReset(serverUrl, resetId, otpInput, newPass);
    setBusy(false);
    if (!res.ok) {
      setFeedback({ type: "err", text: res.error });
      return;
    }
    setIdentifier(res.email);
    setPassword("");
    setOtpInput("");
    setNewPass("");
    setConfirmPass("");
    setDemoOtp("");
    setResetStep(1);
    setView("LOGIN");
    setFeedback({ type: "ok", text: res.message });
  };

  const doRegister = async () => {
    setFeedback(null);
    setBusy(true);
    const res = await mobileRegister(serverUrl, {
      name: regName,
      email: regEmail,
      phone: regPhone,
      rt_rw: regArea,
      password: regPass,
      role: regRole,
    });
    setBusy(false);
    if (!res.ok) {
      setFeedback({ type: "err", text: res.error });
      return;
    }
    onAuthenticated(res.user);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollRoot}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* HERO HEADER MELENGKUNG KHUSUS MOBILE */}
        <View
          style={[
            styles.heroHeader,
            {
              backgroundColor:
                theme === "dark" ? "#163529" : palette.primary,
            },
          ]}
        >
          <View style={styles.topUtilityRow}>
            <View style={styles.brandPill}>
              <Ionicons name="leaf-outline" size={16} color="#FFFFFF" />
              <Text style={styles.brandPillText}>CivicLedger</Text>
            </View>

            <View style={styles.utilGroup}>
              <Pressable
                onPress={onToggleLargeText}
                style={[
                  styles.utilBtn,
                  {
                    backgroundColor: largeText
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.16)",
                  },
                ]}
              >
                <Text
                  style={{
                    color: largeText ? "#1B6B50" : "#FFFFFF",
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  A+
                </Text>
              </Pressable>

              <Pressable
                onPress={onToggleTheme}
                style={[
                  styles.utilBtn,
                  { backgroundColor: "rgba(255,255,255,0.16)" },
                ]}
              >
                <Ionicons
                  name={theme === "dark" ? "sunny-outline" : "moon-outline"}
                  size={17}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroBody}>
            {view !== "LOGIN" ? (
              <Pressable
                onPress={() => switchView("LOGIN")}
                style={styles.backPill}
              >
                <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                <Text style={styles.backPillText}>Kembali ke Masuk</Text>
              </Pressable>
            ) : (
              <View style={styles.heroIconCircle}>
                <Ionicons name="qr-code-outline" size={26} color="#FFFFFF" />
              </View>
            )}

            <Text
              style={[
                styles.heroTitle,
                { fontSize: fs(25, largeText), lineHeight: fs(32, largeText) },
              ]}
            >
              {view === "LOGIN"
                ? "Horas!\nMasuk ke CivicLedger"
                : view === "RESET"
                  ? "Atur Ulang\nKata Sandi Anda"
                  : "Buat Akun Baru"}
            </Text>
            <Text
              style={[
                styles.heroSub,
                { fontSize: fs(13, largeText), lineHeight: fs(19, largeText) },
              ]}
            >
              {view === "LOGIN"
                ? "Satu aplikasi untuk warga penerima kupon dan pemilik kedai sembako mitra."
                : view === "RESET"
                  ? "Masukkan nomor HP atau email terdaftar untuk menerima kode 6 angka."
                  : "Pilih apakah Anda mendaftar sebagai warga penerima atau pemilik kedai mitra."}
            </Text>
          </View>
        </View>

        {/* LEMBAR FORM BAWAH */}
        <View
          style={[styles.sheetContainer, { backgroundColor: palette.canvas }]}
        >
          <View
            style={[
              styles.sheetCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            {feedback && (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor:
                      feedback.type === "ok"
                        ? palette.primarySoft
                        : feedback.type === "err"
                          ? palette.roseSoft
                          : palette.amberSoft,
                    borderColor:
                      feedback.type === "ok"
                        ? palette.primary
                        : feedback.type === "err"
                          ? palette.rose
                          : palette.amber,
                  },
                ]}
              >
                <Ionicons
                  name={
                    feedback.type === "ok"
                      ? "checkmark-circle-outline"
                      : feedback.type === "err"
                        ? "alert-circle-outline"
                        : "information-circle-outline"
                  }
                  size={18}
                  color={
                    feedback.type === "ok"
                      ? palette.primary
                      : feedback.type === "err"
                        ? palette.rose
                        : palette.amber
                  }
                />
                <Text
                  style={{
                    flex: 1,
                    color:
                      feedback.type === "ok"
                        ? palette.primary
                        : feedback.type === "err"
                          ? palette.rose
                          : palette.amber,
                    fontSize: fs(13, largeText),
                    fontWeight: "600",
                    lineHeight: fs(19, largeText),
                  }}
                >
                  {feedback.text}
                </Text>
              </View>
            )}

            {/* ============ MASUK (OTOMATIS DETEKSI WARGA / KEDAI) ============ */}
            {view === "LOGIN" && (
              <View style={styles.formStack}>
                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    Nomor HP atau Email
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={palette.inkMuted}
                    />
                    <TextInput
                      value={identifier}
                      onChangeText={setIdentifier}
                      autoCapitalize="none"
                      placeholder="Contoh: 0812-6311-4401"
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.inputInner,
                        {
                          color: palette.inkPrimary,
                          fontSize: fs(15, largeText),
                        },
                      ]}
                    />
                  </View>
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    Kata Sandi
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={palette.inkMuted}
                    />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      placeholder="Masukkan kata sandi"
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.inputInner,
                        {
                          color: palette.inkPrimary,
                          fontSize: fs(15, largeText),
                        },
                      ]}
                    />
                    <Pressable
                      onPress={() => setShowPass(!showPass)}
                      hitSlop={10}
                    >
                      <Ionicons
                        name={showPass ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={palette.inkMuted}
                      />
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => {
                      setResetId(identifier);
                      switchView("RESET");
                    }}
                    style={styles.forgotWrap}
                  >
                    <Text
                      style={{
                        color: palette.primary,
                        fontSize: fs(13, largeText),
                        fontWeight: "700",
                      }}
                    >
                      Lupa kata sandi?
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => doLogin()}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: palette.primary,
                      opacity: pressed || busy ? 0.85 : 1,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={palette.primaryText} />
                  ) : (
                    <>
                      <Text
                        style={{
                          color: palette.primaryText,
                          fontSize: fs(16, largeText),
                          fontWeight: "800",
                        }}
                      >
                        Masuk
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={19}
                        color={palette.primaryText}
                      />
                    </>
                  )}
                </Pressable>

                {/* Pembatas */}
                <View style={styles.orRow}>
                  <View
                    style={[styles.orLine, { backgroundColor: palette.border }]}
                  />
                  <Text
                    style={{
                      color: palette.inkMuted,
                      fontSize: fs(12, largeText),
                      fontWeight: "600",
                    }}
                  >
                    coba akun contoh
                  </Text>
                  <View
                    style={[styles.orLine, { backgroundColor: palette.border }]}
                  />
                </View>

                {/* 2 Tombol Masuk Cepat Ringkas (Warga & Pemilik Kedai) */}
                <View style={styles.quickGrid}>
                  <Pressable
                    onPress={() => doLogin("warga@civicledger.id", "warga2026")}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.quickTile,
                      {
                        backgroundColor: pressed
                          ? palette.elevated
                          : palette.primarySoft,
                        borderColor: palette.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={palette.primary}
                    />
                    <Text
                      style={{
                        color: palette.inkPrimary,
                        fontSize: fs(13, largeText),
                        fontWeight: "800",
                        marginTop: 6,
                      }}
                    >
                      Warga
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: palette.inkSecondary,
                        fontSize: fs(11, largeText),
                      }}
                    >
                      Op. Rina Napitupulu
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => doLogin("kedai@civicledger.id", "kedai2026")}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.quickTile,
                      {
                        backgroundColor: pressed
                          ? palette.elevated
                          : palette.amberSoft,
                        borderColor: palette.amber,
                      },
                    ]}
                  >
                    <Ionicons
                      name="storefront-outline"
                      size={20}
                      color={palette.amber}
                    />
                    <Text
                      style={{
                        color: palette.inkPrimary,
                        fontSize: fs(13, largeText),
                        fontWeight: "800",
                        marginTop: 6,
                      }}
                    >
                      Pemilik Kedai
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: palette.inkSecondary,
                        fontSize: fs(11, largeText),
                      }}
                    >
                      Marta Br. Sihombing
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ============ LUPA SANDI ============ */}
            {view === "RESET" && (
              <View style={styles.formStack}>
                <View
                  style={[styles.stepChip, { backgroundColor: palette.nested }]}
                >
                  <Text
                    style={{
                      color: palette.inkSecondary,
                      fontSize: fs(12, largeText),
                      fontWeight: "700",
                    }}
                  >
                    Langkah {resetStep} dari 2
                  </Text>
                </View>

                {resetStep === 1 ? (
                  <>
                    <View>
                      <Text
                        style={[
                          styles.label,
                          {
                            color: palette.inkPrimary,
                            fontSize: fs(13, largeText),
                          },
                        ]}
                      >
                        Nomor HP atau Email Terdaftar
                      </Text>
                      <View
                        style={[
                          styles.inputBox,
                          {
                            backgroundColor: palette.surface,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name="call-outline"
                          size={18}
                          color={palette.inkMuted}
                        />
                        <TextInput
                          value={resetId}
                          onChangeText={setResetId}
                          autoCapitalize="none"
                          placeholder="0812-6311-4401 atau warga@civicledger.id"
                          placeholderTextColor={palette.inkMuted}
                          style={[
                            styles.inputInner,
                            {
                              color: palette.inkPrimary,
                              fontSize: fs(15, largeText),
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <Pressable
                      onPress={doRequestOtp}
                      disabled={busy}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: palette.primary },
                      ]}
                    >
                      <Text
                        style={{
                          color: palette.primaryText,
                          fontSize: fs(15, largeText),
                          fontWeight: "800",
                        }}
                      >
                        {busy ? "Membuat kode..." : "Minta Kode 6 Angka"}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {demoOtp ? (
                      <View
                        style={[
                          styles.otpCard,
                          {
                            backgroundColor: palette.amberSoft,
                            borderColor: palette.amber,
                          },
                        ]}
                      >
                        <View style={styles.otpTopRow}>
                          <Text
                            style={{
                              color: palette.amber,
                              fontSize: fs(12, largeText),
                              fontWeight: "700",
                            }}
                          >
                            Kode Verifikasi ({resetName})
                          </Text>
                          <Pressable
                            onPress={() => setOtpInput(demoOtp)}
                            style={[
                              styles.autoFillBtn,
                              {
                                backgroundColor: palette.card,
                                borderColor: palette.border,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: palette.inkPrimary,
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              Isi Otomatis
                            </Text>
                          </Pressable>
                        </View>
                        <Text
                          style={{
                            color: palette.inkPrimary,
                            fontSize: fs(28, largeText),
                            fontWeight: "800",
                            letterSpacing: 6,
                            marginTop: 4,
                          }}
                        >
                          {demoOtp}
                        </Text>
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.inputBox,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <TextInput
                        value={otpInput}
                        onChangeText={(t) =>
                          setOtpInput(t.replace(/[^0-9]/g, ""))
                        }
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="Masukkan 6 angka"
                        placeholderTextColor={palette.inkMuted}
                        style={[
                          styles.inputInner,
                          {
                            color: palette.inkPrimary,
                            fontSize: fs(17, largeText),
                            fontWeight: "800",
                            letterSpacing: 4,
                          },
                        ]}
                      />
                    </View>

                    <View
                      style={[
                        styles.inputBox,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <TextInput
                        value={newPass}
                        onChangeText={setNewPass}
                        secureTextEntry={!showPass}
                        placeholder="Kata sandi baru (min. 6 karakter)"
                        placeholderTextColor={palette.inkMuted}
                        style={[
                          styles.inputInner,
                          {
                            color: palette.inkPrimary,
                            fontSize: fs(15, largeText),
                          },
                        ]}
                      />
                    </View>

                    <View
                      style={[
                        styles.inputBox,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <TextInput
                        value={confirmPass}
                        onChangeText={setConfirmPass}
                        secureTextEntry={!showPass}
                        placeholder="Ulangi kata sandi baru"
                        placeholderTextColor={palette.inkMuted}
                        style={[
                          styles.inputInner,
                          {
                            color: palette.inkPrimary,
                            fontSize: fs(15, largeText),
                          },
                        ]}
                      />
                    </View>

                    <Pressable
                      onPress={doConfirmReset}
                      disabled={busy}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: palette.primary },
                      ]}
                    >
                      <Text
                        style={{
                          color: palette.primaryText,
                          fontSize: fs(15, largeText),
                          fontWeight: "800",
                        }}
                      >
                        {busy ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {/* ============ DAFTAR (WARGA ATAU KEDAI) ============ */}
            {view === "REGISTER" && (
              <View style={styles.formStack}>
                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    Mendaftar Sebagai
                  </Text>
                  <View style={styles.quickGrid}>
                    {(
                      [
                        {
                          id: "BENEFICIARY",
                          label: "Warga Penerima",
                          icon: "person-outline",
                        },
                        {
                          id: "MERCHANT",
                          label: "Pemilik Kedai",
                          icon: "storefront-outline",
                        },
                      ] as const
                    ).map((item) => {
                      const active = regRole === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setRegRole(item.id)}
                          style={[
                            styles.roleSelectTile,
                            {
                              backgroundColor: active
                                ? palette.primarySoft
                                : palette.surface,
                              borderColor: active
                                ? palette.primary
                                : palette.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={
                              active ? palette.primary : palette.inkSecondary
                            }
                          />
                          <Text
                            style={{
                              color: active
                                ? palette.primary
                                : palette.inkPrimary,
                              fontSize: fs(13, largeText),
                              fontWeight: "700",
                            }}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    {regRole === "MERCHANT"
                      ? "Nama Pemilik / Kedai"
                      : "Nama Lengkap"}
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={palette.inkMuted}
                    />
                    <TextInput
                      value={regName}
                      onChangeText={setRegName}
                      placeholder={
                        regRole === "MERCHANT"
                          ? "Contoh: Kedai Inang Boru Sihombing"
                          : "Contoh: Mangasi Simatupang"
                      }
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.inputInner,
                        {
                          color: palette.inkPrimary,
                          fontSize: fs(15, largeText),
                        },
                      ]}
                    />
                  </View>
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    Nomor HP (WhatsApp)
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={palette.inkMuted}
                    />
                    <TextInput
                      value={regPhone}
                      onChangeText={setRegPhone}
                      keyboardType="phone-pad"
                      placeholder="0812-6300-1234"
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.inputInner,
                        {
                          color: palette.inkPrimary,
                          fontSize: fs(15, largeText),
                        },
                      ]}
                    />
                  </View>
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    Email
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={palette.inkMuted}
                    />
                    <TextInput
                      value={regEmail}
                      onChangeText={setRegEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="nama@civicledger.id"
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.inputInner,
                        {
                          color: palette.inkPrimary,
                          fontSize: fs(15, largeText),
                        },
                      ]}
                    />
                  </View>
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    Alamat / Desa
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={palette.inkMuted}
                    />
                    <TextInput
                      value={regArea}
                      onChangeText={setRegArea}
                      placeholder="Contoh: Desa Tambunan, Balige"
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.inputInner,
                        {
                          color: palette.inkPrimary,
                          fontSize: fs(15, largeText),
                        },
                      ]}
                    />
                  </View>
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: palette.inkPrimary, fontSize: fs(13, largeText) },
                    ]}
                  >
                    Buat Kata Sandi
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={palette.inkMuted}
                    />
                    <TextInput
                      value={regPass}
                      onChangeText={setRegPass}
                      secureTextEntry={!showPass}
                      placeholder="Minimal 6 karakter"
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.inputInner,
                        {
                          color: palette.inkPrimary,
                          fontSize: fs(15, largeText),
                        },
                      ]}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={doRegister}
                  disabled={busy}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: palette.primary },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.primaryText,
                      fontSize: fs(15, largeText),
                      fontWeight: "800",
                    }}
                  >
                    {busy ? "Mendaftar..." : "Daftar & Masuk"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.footerRow}>
            {view === "LOGIN" ? (
              <Pressable onPress={() => switchView("REGISTER")}>
                <Text
                  style={{
                    color: palette.inkSecondary,
                    fontSize: fs(14, largeText),
                    textAlign: "center",
                  }}
                >
                  Belum punya akun?{" "}
                  <Text style={{ color: palette.primary, fontWeight: "800" }}>
                    Daftar di sini
                  </Text>
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => switchView("LOGIN")}>
                <Text
                  style={{
                    color: palette.inkSecondary,
                    fontSize: fs(14, largeText),
                    textAlign: "center",
                  }}
                >
                  Sudah punya akun?{" "}
                  <Text style={{ color: palette.primary, fontWeight: "800" }}>
                    Masuk di sini
                  </Text>
                </Text>
              </Pressable>
            )}
          </View>

          <Text
            style={{
              color: palette.inkMuted,
              fontSize: fs(11, largeText),
              textAlign: "center",
              paddingHorizontal: 16,
              lineHeight: fs(17, largeText),
            }}
          >
            Untuk Warga Penerima &amp; Pemilik Kedai Mitra.{"\n"}
            Pengurus Bansos menggunakan portal web CivicLedger.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollRoot: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 42,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topUtilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  brandPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  utilGroup: {
    flexDirection: "row",
    gap: 8,
  },
  utilBtn: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBody: {
    marginTop: 22,
    gap: 8,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  backPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 4,
  },
  backPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  heroSub: {
    color: "rgba(255,255,255,0.88)",
  },
  sheetContainer: {
    paddingHorizontal: 18,
    marginTop: -24,
    gap: 18,
  },
  sheetCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  formStack: {
    gap: 15,
  },
  label: {
    fontWeight: "700",
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 10,
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  quickGrid: {
    flexDirection: "row",
    gap: 10,
  },
  quickTile: {
    flex: 1,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  roleSelectTile: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  stepChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  otpCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  otpTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  autoFillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  footerRow: {
    paddingVertical: 4,
  },
});
