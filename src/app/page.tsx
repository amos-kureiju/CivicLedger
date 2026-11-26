"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { Sora } from "next/font/google";
import jsQR from "jsqr";
import {
  LayoutGrid,
  QrCode,
  ScanLine,
  Landmark,
  BarChart3,
  BookOpen,
  RefreshCw,
  RotateCcw,
  X,
  Sun,
  Moon,
  LogOut,
  KeyRound,
  Type,
} from "lucide-react";
import {
  AuthUser,
  BackendEngineType,
  BatchSyncResultItem,
  Beneficiary,
  ChainVerificationResult,
  ClearinghouseState,
  CommodityItem,
  LedgerEntry,
  Merchant,
  OfflineRedemptionQueueItem,
  ReconciliationLog,
  SettlementBatch,
  Voucher,
  VoucherStatus,
} from "@/lib/types";
import {
  decodeVoucherQRPayload,
  encodeVoucherToQRPayload,
  generateClientTxId,
  sha256WebCrypto,
  verifyLedgerChainWebCrypto,
  verifyVoucherWebCrypto,
} from "@/lib/crypto";
import {
  cacheFullStateInIndexedDB,
  cacheVouchersInIndexedDB,
  clearAllOfflineStores,
  clearSyncedOfflineRedemptions,
  enqueueOfflineRedemption,
  getCachedFullStateFromIndexedDB,
  getOfflineRedemptionQueue,
  isVoucherRedeemedLocally,
} from "@/lib/indexeddb";
import {
  buildClientFallbackState,
  DEFAULT_COMMODITY_CATALOG,
} from "@/lib/client-seed";
import { AppLang, UI_COPY } from "@/lib/i18n";
import {
  CryptoVerificationTrace,
  formatDateTime,
  formatOutcomeLabel,
  formatRupiah,
} from "@/lib/formatters";
import AuthGate from "@/components/AuthGate";
import BrandLogo from "@/components/BrandLogo";
import CoordinatorTab from "@/components/CoordinatorTab";
import type { CalendarAvailability } from "@/components/OperationalCalendar";
import { getOperationalReminders } from "@/components/CoordinatorOverview";
import { Bell } from "lucide-react";
import type { ResourceView } from "@/components/CoordinatorResources";
import CoordinatorSearch from "@/components/CoordinatorSearch";
import workspace from "@/components/CoordinatorWorkspace.module.css";
import { Menu, PanelLeftClose, Settings, X as CloseMenu } from "lucide-react";
import BeneficiaryTab from "@/components/BeneficiaryTab";
import MerchantPosTab from "@/components/MerchantPosTab";
import ClearinghouseTab from "@/components/ClearinghouseTab";
import PasswordModal from "@/components/PasswordModal";
import ReportsComplianceTab from "@/components/ReportsComplianceTab";
import UserGuideTab from "@/components/UserGuideTab";

const calendarCacheMarker = "civicledger_calendar_cache_source";

function recordCalendarCacheSource(source: "server" | "fallback") {
  try { localStorage.setItem(calendarCacheMarker, source); } catch { /* Storage may be disabled. */ }
}

function hasRecordedCalendarCache() {
  try { return localStorage.getItem(calendarCacheMarker) === "server"; } catch { return false; }
}

const coordinatorSora = Sora({ subsets: ["latin"], variable: "--font-coordinator-sora", display: "swap" });

type ActiveTab =
  | "COORDINATOR"
  | "BENEFICIARY"
  | "MERCHANT_POS"
  | "CLEARINGHOUSE"
  | "REPORTS"
  | "GUIDE";

type ThemeMode = "light" | "dark";

function playScanBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  } catch {
    // Abaikan jika audio diblokir browser
  }
}

export default function CivicLedgerApp() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [lang, setLang] = useState<AppLang>("id");
  const [compactRail, setCompactRail] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(true);
  useEffect(() => {
    const update = () => setDeviceOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const organizerSettings = useRef<HTMLDetailsElement>(null);
  const mobileNavigation = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("COORDINATOR");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [largeText, setLargeText] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendEngine, setBackendEngine] =
    useState<BackendEngineType>("NEXTJS_FALLBACK");
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "warning" | "error" | "info";
    text: string;
  } | null>(null);

  // Modal Ganti Kata Sandi
  const [showChangePasswordModal, setShowChangePasswordModal] =
    useState<boolean>(false);
  const [cpOldPass, setCpOldPass] = useState<string>("");
  const [cpNewPass, setCpNewPass] = useState<string>("");
  const [cpConfirmPass, setCpConfirmPass] = useState<string>("");
  const [cpShowPass, setCpShowPass] = useState<boolean>(false);
  const [cpBusy, setCpBusy] = useState<boolean>(false);
  const [cpError, setCpError] = useState<string>("");

  // State Data Utama
  const [poolTotalIdr, setPoolTotalIdr] = useState<number>(8500000);
  const [fraudBlockedCount, setFraudBlockedCount] = useState<number>(0);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [calendarAvailability, setCalendarAvailability] = useState<CalendarAvailability>("loading");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [settlementBatches, setSettlementBatches] = useState<SettlementBatch[]>(
    []
  );
  const [reconciliationLogs, setReconciliationLogs] = useState<
    ReconciliationLog[]
  >([]);
  const [catalog, setCatalog] = useState<CommodityItem[]>(
    DEFAULT_COMMODITY_CATALOG
  );

  // Catatan Offline & Pengiriman ke Pusat
  const [offlineQueue, setOfflineQueue] = useState<
    OfflineRedemptionQueueItem[]
  >([]);
  const [isSyncingBatch, setIsSyncingBatch] = useState<boolean>(false);
  const [lastSyncResults, setLastSyncResults] = useState<
    BatchSyncResultItem[] | null
  >(null);

  // Pengecekan Keamanan Catatan
  const [chainCheckResult, setChainCheckResult] =
    useState<ChainVerificationResult | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState<boolean>(false);

  // Toggle detail teknis untuk juri
  const [showVoucherTechDetails, setShowVoucherTechDetails] =
    useState<boolean>(false);
  const [showVerifierTechDetails, setShowVerifierTechDetails] =
    useState<boolean>(false);
  const [showFullHashes, setShowFullHashes] = useState<boolean>(false);

  // Panel Kanan Beranda Pengurus: Daftar Kupon vs Daftar Penerima (20 orang)
  const [coordinatorRightView, setCoordinatorRightView] = useState<ResourceView>("VOUCHERS");
  const [fullCoordinatorResources, setFullCoordinatorResources] = useState(false);
  const [beneficiarySearch, setBeneficiarySearch] = useState<string>("");

  // Form Pengurus
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedCommodityCode, setSelectedCommodityCode] =
    useState<string>("PKG-BERAS-5KG");
  const [validityHours, setValidityHours] = useState<number>(72);
  const [voucherSearch, setVoucherSearch] = useState<string>("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<
    "ALL" | VoucherStatus
  >("ALL");

  // Form Tambah Warga & Kedai
  const [newResidentName, setNewResidentName] = useState<string>("");
  const [newResidentRtRw, setNewResidentRtRw] = useState<string>(
    "Desa Sitoluama, Laguboti"
  );
  const [newResidentCategory, setNewResidentCategory] = useState<string>(
    "Keluarga Kurang Mampu"
  );
  const [newResidentPhone, setNewResidentPhone] =
    useState<string>("0812-6300-0000");

  const [newMerchantName, setNewMerchantName] = useState<string>("");
  const [newMerchantOwner, setNewMerchantOwner] = useState<string>("");
  const [newMerchantRtRw, setNewMerchantRtRw] =
    useState<string>("Pasar Laguboti, Toba");
  const [newMerchantBank, setNewMerchantBank] =
    useState<string>("BRI / QRIS •• 5510");

  // State Kupon Warga
  const [selectedWalletBeneficiaryId, setWalletBeneficiaryId] =
    useState<string>("WGA-0401");
  const walletBeneficiaryId = currentUser?.role === "BENEFICIARY"
    ? currentUser.linked_beneficiary_id ?? ""
    : selectedWalletBeneficiaryId;
  const [selectedVoucherForQR, setSelectedVoucherForQR] =
    useState<Voucher | null>(null);
  const [voucherQr, setVoucherQr] = useState<{ voucherId: string; url: string } | null>(null);
  const [copiedSms, setCopiedSms] = useState<boolean>(false);

  // State Kasir Kedai
  const [activeMerchantId, setActiveMerchantId] = useState<string>("WRG-01");
  const [scannerInputCode, setScannerInputCode] = useState<string>("");
  const [scannedQRPayloadRaw, setScannedQRPayloadRaw] = useState<string>("");
  const [cryptoTrace, setCryptoTrace] =
    useState<CryptoVerificationTrace | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraDetectSupported, setCameraDetectSupported] =
    useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (type: "success" | "warning" | "error" | "info", text: string) => {
      setActionBanner({ type, text });
    },
    []
  );

  const applyAuthenticatedUser = useCallback((user: AuthUser) => {
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("civicledger_last_user", JSON.stringify(user));
    }
    if (user.role === "MERCHANT") {
      setActiveTab("MERCHANT_POS");
      if (user.linked_merchant_id) {
        setActiveMerchantId(user.linked_merchant_id);
      }
    } else if (user.role === "BENEFICIARY") {
      setActiveTab("BENEFICIARY");
    } else {
      setActiveTab("COORDINATOR");
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const savedTheme = window.localStorage.getItem("civicledger_theme_v2");
    const initialTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");

    const savedLarge = window.localStorage.getItem("civicledger_large_text");
    const isLarge = savedLarge === "1";
    setLargeText(isLarge);
    document.documentElement.classList.toggle("text-large", isLarge);

    const savedLang = window.localStorage.getItem("civicledger_lang_v1");
    if (savedLang === "en" || savedLang === "id") {
      setLang(savedLang);
    }

    fetch("/api/auth", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data.user) {
          applyAuthenticatedUser(data.user);
        } else {
          window.localStorage.removeItem("civicledger_last_user");
        }
      })
      .catch(() => {
        try {
          const cached = window.localStorage.getItem("civicledger_last_user");
          if (cached) {
            const parsed = JSON.parse(cached) as AuthUser;
            if (
              (parsed.role === "COORDINATOR" || parsed.role === "MERCHANT" || parsed.role === "BENEFICIARY") &&
              parsed.email?.endsWith("@civicledger.id")
            ) {
              applyAuthenticatedUser(parsed);
            }
          }
        } catch {
          // Ignore
        }
      })
      .finally(() => setAuthChecked(true));
  }, [applyAuthenticatedUser]);

  const updateTheme = (next: ThemeMode) => {
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("civicledger_theme_v2", next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }
  };

  const updateLargeText = (next: boolean) => {
    setLargeText(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("civicledger_large_text", next ? "1" : "0");
      document.documentElement.classList.toggle("text-large", next);
    }
  };

  const updateLang = (next: AppLang) => {
    setLang(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("civicledger_lang_v1", next);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LOGOUT" }),
      });
    } catch {
      // Tetap keluar lokal
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("civicledger_last_user");
    }
    setCurrentUser(null);
    setActionBanner(null);
    setCryptoTrace(null);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError("");
    if (cpNewPass.length < 6) {
      setCpError("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (cpNewPass !== cpConfirmPass) {
      setCpError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setCpBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CHANGE_PASSWORD",
          old_password: cpOldPass,
          new_password: cpNewPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCpError(data.error || "Gagal mengganti kata sandi.");
        return;
      }
      setCpOldPass("");
      setCpNewPass("");
      setCpConfirmPass("");
      setShowChangePasswordModal(false);
      showToast("success", "Kata sandi berhasil diganti.");
    } catch {
      setCpError("Tidak bisa tersambung ke server.");
    } finally {
      setCpBusy(false);
    }
  };

  const applyServerState = useCallback(
    async (data: Partial<ClearinghouseState>, persistToIdb = true) => {
      if (typeof data.pool_total_idr === "number")
        setPoolTotalIdr(data.pool_total_idr);
      if (typeof data.fraud_blocked_count === "number")
        setFraudBlockedCount(data.fraud_blocked_count);

      if (Array.isArray(data.beneficiaries) && data.beneficiaries.length > 0) {
        setBeneficiaries(data.beneficiaries);
        setSelectedBeneficiaryId((prev) =>
          data.beneficiaries!.some((b) => b.id === prev)
            ? prev
            : data.beneficiaries![0].id
        );
        setWalletBeneficiaryId((prev) =>
          data.beneficiaries!.some((b) => b.id === prev)
            ? prev
            : data.beneficiaries![0].id
        );
      }

      if (Array.isArray(data.merchants) && data.merchants.length > 0) {
        setMerchants(data.merchants);
        setActiveMerchantId((prev) =>
          data.merchants!.some((m) => m.id === prev)
            ? prev
            : data.merchants![0].id
        );
      }

      if (Array.isArray(data.vouchers)) {
        setVouchers(data.vouchers);
        if (persistToIdb) {
          await cacheVouchersInIndexedDB(data.vouchers);
        }
      }

      if (Array.isArray(data.ledger)) setLedger(data.ledger);
      if (Array.isArray(data.settlement_batches))
        setSettlementBatches(data.settlement_batches);
      if (Array.isArray(data.reconciliation_logs))
        setReconciliationLogs(data.reconciliation_logs);

      const resolvedCatalog =
        Array.isArray(data.commodity_catalog) &&
          data.commodity_catalog.length > 0
          ? data.commodity_catalog
          : DEFAULT_COMMODITY_CATALOG;
      setCatalog(resolvedCatalog);
      setSelectedCommodityCode((prev) =>
        resolvedCatalog.some((c) => c.code === prev)
          ? prev
          : resolvedCatalog[0].code
      );

      if (data.backend_engine) setBackendEngine(data.backend_engine);

      if (
        persistToIdb &&
        Array.isArray(data.beneficiaries) &&
        data.beneficiaries.length > 0 &&
        Array.isArray(data.merchants) &&
        data.merchants.length > 0
      ) {
        await cacheFullStateInIndexedDB({
          ...data,
          commodity_catalog: resolvedCatalog,
        });
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then(() => setSwRegistered(true))
          .catch(() => setSwRegistered(false));
      }
      setCameraDetectSupported(true);
      const handleOffline = () => setIsOfflineMode(true);
      const handleOnline = () => {
        showToast(
          "info",
          "Internet tersambung lagi. Silakan kirim antrean offline ke pusat."
        );
      };
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
      return () => {
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
      };
    }
  }, [showToast]);

  const fetchClearinghouseState = useCallback(async () => {
    try {
      const res = await fetch("/api/clearinghouse", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = (await res.json()) as Partial<ClearinghouseState>;

      if (
        !Array.isArray(data.beneficiaries) ||
        data.beneficiaries.length < 20 ||
        !Array.isArray(data.merchants) ||
        data.merchants.length === 0
      ) {
        throw new Error("Data lama");
      }

      await applyServerState(data, true);
      recordCalendarCacheSource("server");
      setCalendarAvailability("live");
      const q = await getOfflineRedemptionQueue();
      setOfflineQueue(q);
    } catch {
      const cachedFull = await getCachedFullStateFromIndexedDB();
      if (
        cachedFull &&
        Array.isArray(cachedFull.beneficiaries) &&
        cachedFull.beneficiaries.length >= 20 &&
        Array.isArray(cachedFull.merchants) &&
        cachedFull.merchants.length > 0
      ) {
        await applyServerState(cachedFull, false);
        setCalendarAvailability(previous => previous === "live" ? "cached" : hasRecordedCalendarCache() ? "cached" : "unavailable");
      } else {
        setCalendarAvailability("unavailable");
        const fallback = await buildClientFallbackState();
        recordCalendarCacheSource("fallback");
        await applyServerState(fallback, true);
      }
      const q = await getOfflineRedemptionQueue();
      setOfflineQueue(q);
    } finally {
      setLoading(false);
    }
  }, [applyServerState]);

  useEffect(() => {
    fetchClearinghouseState();
  }, [fetchClearinghouseState]);

  // Realtime SSE subscription: sinkronisasi otomatis antar Pengurus, Pemilik Toko, dan Mobile
  useEffect(() => {
    if (!currentUser || isOfflineMode || typeof window === "undefined") {
      setRealtimeConnected(false);
      return;
    }

    const es = new EventSource("/api/clearinghouse/stream");
    es.onopen = () => {
      setRealtimeConnected(true);
    };
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          state?: Partial<ClearinghouseState>;
        };
        if (payload?.state) {
          void applyServerState(payload.state, true);
          recordCalendarCacheSource("server");
          setCalendarAvailability("live");
          setLoading(false);
        }
      } catch {
        // Abaikan pesan heartbeat/parse error
      }
    };
    es.onerror = () => {
      setRealtimeConnected(false);
    };

    return () => {
      es.close();
      setRealtimeConnected(false);
    };
  }, [currentUser, isOfflineMode, applyServerState]);

  useEffect(() => {
    const benVouchers = vouchers.filter(
      (v) => v.beneficiary_id === walletBeneficiaryId
    );
    if (benVouchers.length > 0) {
      const existing = benVouchers.find(
        (v) => v.id === selectedVoucherForQR?.id
      );
      if (existing) {
        setSelectedVoucherForQR(existing);
      } else {
        const activeOne =
          benVouchers.find((v) => v.status === "ACTIVE") || benVouchers[0];
        setSelectedVoucherForQR(activeOne);
      }
    } else {
      setSelectedVoucherForQR(null);
    }
  }, [walletBeneficiaryId, vouchers, selectedVoucherForQR?.id]);

  useEffect(() => {
    if (!selectedVoucherForQR) {
      setVoucherQr(null);
      return;
    }
    const voucherId = selectedVoucherForQR.id;
    const payload = encodeVoucherToQRPayload(selectedVoucherForQR);
    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: 480,
      margin: 4,
      color: { dark: "#1d2622", light: "#ffffff" },
    })
      .then((url) => { if (!cancelled) setVoucherQr({ voucherId, url }); })
      .catch(() => { if (!cancelled) setVoucherQr(null); });
    return () => { cancelled = true; };
  }, [selectedVoucherForQR]);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (activeTab !== "MERCHANT_POS") stopCamera();
  }, [activeTab, stopCamera]);

  const toggleCamera = async () => {
    if (cameraActive) {
      stopCamera();
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      setCameraActive(true);
      setCameraDetectSupported(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }

        const offscreenCanvas = document.createElement("canvas");
        const ctx = offscreenCanvas.getContext("2d", {
          willReadFrequently: true,
        });

        scanTimerRef.current = window.setInterval(() => {
          const video = videoRef.current;
          if (
            !video ||
            !ctx ||
            video.readyState < 2 ||
            video.videoWidth === 0 ||
            video.videoHeight === 0
          ) {
            return;
          }

          offscreenCanvas.width = video.videoWidth;
          offscreenCanvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

          const imageData = ctx.getImageData(
            0,
            0,
            offscreenCanvas.width,
            offscreenCanvas.height
          );
          const qrResult = jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
            { inversionAttempts: "dontInvert" }
          );

          if (qrResult && qrResult.data) {
            const rawText = qrResult.data.trim();
            const decoded = decodeVoucherQRPayload(rawText);
            const resolvedCode = decoded ? decoded.code : rawText.toUpperCase();

            playScanBeep();
            stopCamera();
            setScannedQRPayloadRaw(decoded ? rawText : "");
            setScannerInputCode(resolvedCode);
            showToast(
              "success",
              lang === "en"
                ? `QR ${resolvedCode} scanned. Verifying voucher automatically...`
                : `QR ${resolvedCode} terbaca dari kamera! Memverifikasi kupon otomatis...`
            );
            void handleVerifyAndRedeem(
              false,
              decoded ? rawText : "",
              resolvedCode
            );
          }
        }, 180);
      }, 150);
    } catch {
      showToast(
        "warning",
        lang === "en"
          ? "Cannot access camera. Allow browser camera permission, upload a QR photo, or type the code."
          : "Kamera tidak bisa dibuka. Izinkan akses kamera di browser, unggah foto QR, atau ketik kodenya langsung."
      );
    }
  };

  const handleUploadQrFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrResult = jsQR(
          imageData.data,
          imageData.width,
          imageData.height,
          { inversionAttempts: "attemptBoth" }
        );

        if (!qrResult || !qrResult.data) {
          showToast(
            "warning",
            lang === "en"
              ? "No QR code detected in the uploaded image. Try a clearer photo."
              : "QR tidak terbaca di gambar tersebut. Coba foto QR yang lebih jelas."
          );
          return;
        }

        const rawText = qrResult.data.trim();
        const decoded = decodeVoucherQRPayload(rawText);
        const resolvedCode = decoded ? decoded.code : rawText.toUpperCase();

        playScanBeep();
        setScannedQRPayloadRaw(decoded ? rawText : "");
        setScannerInputCode(resolvedCode);
        showToast(
          "success",
          lang === "en"
            ? `QR ${resolvedCode} read from image. Verifying automatically...`
            : `QR ${resolvedCode} terbaca dari foto! Memverifikasi kupon...`
        );
        void handleVerifyAndRedeem(false, decoded ? rawText : "", resolvedCode);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // ==================== AKSI UTAMA ====================

  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOfflineMode) {
      showToast(
        "warning",
        "Pembuatan kupon butuh koneksi Online. Ubah Sinyal ke Online dulu."
      );
      return;
    }
    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ISSUE_VOUCHER",
          beneficiary_id: selectedBeneficiaryId,
          commodity_code: selectedCommodityCode,
          validity_hours: validityHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat kupon");

      await applyServerState(data.state);
      setWalletBeneficiaryId(selectedBeneficiaryId);
      setSelectedVoucherForQR(data.voucher);
      setCoordinatorRightView("VOUCHERS");

      showToast(
        "success",
        `Kupon ${data.voucher.short_code} (${data.voucher.commodity_name}) dibuat untuk ${data.voucher.beneficiary_name}.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Permintaan gagal"
      );
    }
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidentName.trim()) return;
    if (isOfflineMode) {
      showToast("warning", "Ubah Sinyal ke Online untuk menambah data warga.");
      return;
    }
    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_BENEFICIARY",
          name: newResidentName.trim(),
          rt_rw: newResidentRtRw,
          category: newResidentCategory,
          phone: newResidentPhone,
          household_size: 4,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await applyServerState(data.state);
      setSelectedBeneficiaryId(data.beneficiary.id);
      setNewResidentName("");
      showToast("success", `${data.beneficiary.name} masuk daftar penerima.`);
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal menyimpan data warga"
      );
    }
  };

  const handleAddMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchantName.trim() || !newMerchantOwner.trim()) return;
    if (isOfflineMode) {
      showToast("warning", "Ubah Sinyal ke Online untuk menambah kedai baru.");
      return;
    }
    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_MERCHANT",
          name: newMerchantName.trim(),
          owner: newMerchantOwner.trim(),
          rt_rw: newMerchantRtRw,
          bank_account: newMerchantBank,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await applyServerState(data.state);
      setActiveMerchantId(data.merchant.id);
      setNewMerchantName("");
      setNewMerchantOwner("");
      showToast("success", `${data.merchant.name} berhasil didaftarkan.`);
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal menyimpan data kedai"
      );
    }
  };

  const handleTopupPool = async (amountIdr: number) => {
    if (isOfflineMode) {
      showToast("warning", "Ubah Sinyal ke Online untuk menambah dana bansos.");
      return;
    }
    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOPUP_POOL",
          amount_idr: amountIdr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah dana");
      await applyServerState(data.state);
      showToast(
        "success",
        `Dana bansos bertambah ${formatRupiah(amountIdr)} secara realtime.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal menambah dana bansos"
      );
    }
  };

  const handleAddCommodity = async (params: {
    name: string;
    items: string;
    nominal_idr: number;
  }) => {
    if (isOfflineMode) {
      showToast("warning", "Ubah Sinyal ke Online untuk menambah paket baru.");
      return;
    }
    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_COMMODITY",
          name: params.name,
          items: params.items,
          nominal_idr: params.nominal_idr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah paket");
      await applyServerState(data.state);
      if (data.commodity?.code) {
        setSelectedCommodityCode(data.commodity.code);
      }
      showToast(
        "success",
        `Paket baru "${params.name}" (${formatRupiah(params.nominal_idr)}) berhasil ditambahkan.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal menambah paket sembako"
      );
    }
  };

  const sendVoucherToMerchantScanner = (voucher: Voucher) => {
    const qrPayload = encodeVoucherToQRPayload(voucher);
    setScannedQRPayloadRaw(qrPayload);
    setScannerInputCode(voucher.short_code);
    setCryptoTrace(null);
    setActiveTab("MERCHANT_POS");
    showToast(
      "info",
      `Kupon ${voucher.short_code} sudah terisi di Kasir Kedai.`
    );
  };

  const handleCopySmsSlip = (voucher: Voucher) => {
    const text = `[Kupon Sembako CivicLedger]\nNama: ${voucher.beneficiary_name}\nKode: ${voucher.short_code}\nPaket: ${voucher.commodity_name} (${formatRupiah(voucher.nominal_idr)})\nBerlaku s/d: ${formatDateTime(voucher.expires_at)}\nTunjukkan kode ini di kedai mitra terdekat.`;
    navigator.clipboard.writeText(text);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2200);
    showToast("info", `Teks SMS untuk kupon ${voucher.short_code} disalin.`);
  };

  const handleVerifyAndRedeem = async (
    simulateTamperFraud = false,
    overrideQrRaw?: string,
    overrideCode?: string
  ) => {
    const t0 = performance.now();
    const merchant =
      merchants.find((m) => m.id === activeMerchantId) || merchants[0];
    if (!merchant) {
      showToast("error", "Pilih kedai yang sedang melayani.");
      return;
    }

    const effectiveQrRaw =
      overrideQrRaw !== undefined ? overrideQrRaw : scannedQRPayloadRaw;
    const effectiveCode =
      overrideCode !== undefined ? overrideCode : scannerInputCode;

    let targetVoucher: Voucher | null = null;
    const decodedQR = effectiveQrRaw
      ? decodeVoucherQRPayload(effectiveQrRaw)
      : null;

    if (decodedQR) {
      targetVoucher = {
        id: decodedQR.id,
        short_code: decodedQR.code,
        beneficiary_id: decodedQR.ben,
        beneficiary_name: decodedQR.benName,
        rt_rw: decodedQR.rtRw,
        commodity_code: decodedQR.com,
        commodity_name: decodedQR.comName,
        commodity_items: decodedQR.items,
        nominal_idr: simulateTamperFraud ? 500000 : decodedQR.nom,
        nonce: decodedQR.nonce,
        issued_at: new Date().toISOString(),
        expires_at: decodedQR.exp,
        hmac_signature: decodedQR.sig,
        status: "ACTIVE",
      };
    } else if (effectiveCode.trim()) {
      const cleanCode = effectiveCode.trim().toUpperCase();
      const found = vouchers.find(
        (v) =>
          v.short_code.toUpperCase() === cleanCode ||
          v.id.toUpperCase() === cleanCode
      );
      if (found) {
        targetVoucher = {
          ...found,
          nominal_idr: simulateTamperFraud ? 500000 : found.nominal_idr,
        };
      }
    }

    if (!targetVoucher) {
      showToast(
        "error",
        "Kode kupon tidak ditemukan. Pilih dari daftar cepat atau ketik kode seperti CL-8841-K9."
      );
      return;
    }

    const clientTxId = generateClientTxId();

    const verification = await verifyVoucherWebCrypto({
      voucher_id: targetVoucher.id,
      beneficiary_id: targetVoucher.beneficiary_id,
      commodity_code: targetVoucher.commodity_code,
      nominal_idr: targetVoucher.nominal_idr,
      nonce: targetVoucher.nonce,
      expires_at: targetVoucher.expires_at,
      signature_hex: targetVoucher.hmac_signature,
    });

    const alreadyRedeemedInIdb = await isVoucherRedeemedLocally(
      targetVoucher.id
    );
    const existingServerVoucher = vouchers.find(
      (v) => v.id === targetVoucher!.id
    );
    const alreadyRedeemedInState =
      existingServerVoucher && existingServerVoucher.status !== "ACTIVE";
    const doubleSpendPassed = !alreadyRedeemedInIdb && !alreadyRedeemedInState;

    const expiryPassed =
      new Date(targetVoucher.expires_at).getTime() > Date.now();
    const durationMs = Math.max(1, Math.round(performance.now() - t0));

    if (!verification.valid) {
      setFraudBlockedCount((c) => c + 1);
      setCryptoTrace({
        timestamp: new Date().toISOString(),
        durationMs,
        clientTxId,
        voucherId: targetVoucher.id,
        shortCode: targetVoucher.short_code,
        beneficiaryName: targetVoucher.beneficiary_name,
        commodityName: targetVoucher.commodity_name,
        nominalIdr: targetVoucher.nominal_idr,
        canonicalMessage: verification.canonicalMessage,
        providedSignature: targetVoucher.hmac_signature,
        computedSignature: verification.expectedSignature,
        hmacValid: false,
        doubleSpendCheckPassed: doubleSpendPassed,
        expiryCheckPassed: expiryPassed,
        mode: isOfflineMode ? "OFFLINE_INDEXEDDB" : "ONLINE",
        errorReason:
          "Nominal kupon tidak sesuai data asli (diubah ke Rp 500.000). Transaksi ditolak otomatis.",
      });
      showToast("error", "Kupon palsu terdeteksi dan langsung ditolak.");
      return;
    }

    if (!doubleSpendPassed) {
      setFraudBlockedCount((c) => c + 1);
      setCryptoTrace({
        timestamp: new Date().toISOString(),
        durationMs,
        clientTxId,
        voucherId: targetVoucher.id,
        shortCode: targetVoucher.short_code,
        beneficiaryName: targetVoucher.beneficiary_name,
        commodityName: targetVoucher.commodity_name,
        nominalIdr: targetVoucher.nominal_idr,
        canonicalMessage: verification.canonicalMessage,
        providedSignature: targetVoucher.hmac_signature,
        computedSignature: verification.expectedSignature,
        hmacValid: true,
        doubleSpendCheckPassed: false,
        expiryCheckPassed: expiryPassed,
        mode: isOfflineMode ? "OFFLINE_INDEXEDDB" : "ONLINE",
        errorReason: `Kupon ${targetVoucher.short_code} sudah pernah dipakai sebelumnya.`,
      });
      showToast(
        "error",
        `Ditolak: Kupon ${targetVoucher.short_code} sudah pernah ditukar.`
      );
      return;
    }

    if (!expiryPassed) {
      showToast(
        "error",
        `Kupon ${targetVoucher.short_code} sudah lewat masa berlakunya.`
      );
      return;
    }

    const redeemedAtIso = new Date().toISOString();
    const localReceiptHash = await sha256WebCrypto(
      `${clientTxId}|${targetVoucher.id}|${merchant.id}|${targetVoucher.nominal_idr}|${redeemedAtIso}|${targetVoucher.hmac_signature}`
    );

    if (isOfflineMode) {
      const queueItem: OfflineRedemptionQueueItem = {
        queue_id: `OFF-${Date.now()}-${Math.floor(Math.random() * 999)}`,
        client_tx_id: clientTxId,
        voucher_id: targetVoucher.id,
        short_code: targetVoucher.short_code,
        beneficiary_id: targetVoucher.beneficiary_id,
        beneficiary_name: targetVoucher.beneficiary_name,
        commodity_code: targetVoucher.commodity_code,
        commodity_name: targetVoucher.commodity_name,
        commodity_items: targetVoucher.commodity_items,
        nominal_idr: targetVoucher.nominal_idr,
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        hmac_signature: targetVoucher.hmac_signature,
        local_receipt_hash: localReceiptHash,
        redeemed_at: redeemedAtIso,
        synced: false,
      };

      await enqueueOfflineRedemption(queueItem);
      const updatedQueue = await getOfflineRedemptionQueue();
      setOfflineQueue(updatedQueue);

      setVouchers((prev) =>
        prev.map((v) =>
          v.id === targetVoucher!.id
            ? {
              ...v,
              status: "REDEEMED",
              redeemed_by_merchant_id: merchant.id,
              redeemed_by_merchant_name: `${merchant.name} (Offline)`,
              redeemed_at: redeemedAtIso,
            }
            : v
        )
      );

      setCryptoTrace({
        timestamp: redeemedAtIso,
        durationMs,
        clientTxId,
        voucherId: targetVoucher.id,
        shortCode: targetVoucher.short_code,
        beneficiaryName: targetVoucher.beneficiary_name,
        commodityName: targetVoucher.commodity_name,
        nominalIdr: targetVoucher.nominal_idr,
        canonicalMessage: verification.canonicalMessage,
        providedSignature: targetVoucher.hmac_signature,
        computedSignature: verification.expectedSignature,
        hmacValid: true,
        doubleSpendCheckPassed: true,
        expiryCheckPassed: true,
        mode: "OFFLINE_INDEXEDDB",
        receiptHash: localReceiptHash,
      });

      showToast(
        "warning",
        "Kupon cocok. Disimpan dulu di HP karena sedang offline."
      );
      return;
    }

    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REDEEM_VOUCHER",
          client_tx_id: clientTxId,
          voucher_id: targetVoucher.id,
          short_code: targetVoucher.short_code,
          merchant_id: merchant.id,
          client_hmac_signature: targetVoucher.hmac_signature,
          sync_mode: "ONLINE",
          redeemed_at: redeemedAtIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Penukaran gagal");

      await applyServerState(data.state);

      setCryptoTrace({
        timestamp: redeemedAtIso,
        durationMs,
        clientTxId,
        voucherId: targetVoucher.id,
        shortCode: targetVoucher.short_code,
        beneficiaryName: targetVoucher.beneficiary_name,
        commodityName: targetVoucher.commodity_name,
        nominalIdr: targetVoucher.nominal_idr,
        canonicalMessage: verification.canonicalMessage,
        providedSignature: targetVoucher.hmac_signature,
        computedSignature: verification.expectedSignature,
        hmacValid: true,
        doubleSpendCheckPassed: true,
        expiryCheckPassed: true,
        mode: "ONLINE",
        receiptHash: data.ledger_entry.tx_hash,
      });

      showToast(
        "success",
        `Kupon ${targetVoucher.short_code} diterima di ${merchant.name} (${formatRupiah(targetVoucher.nominal_idr)}).`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Penukaran gagal"
      );
    }
  };

  const handleSimulateOfflineConflict = async () => {
    const candidate =
      vouchers.find((v) => v.status === "REDEEMED") ||
      (offlineQueue.length > 0
        ? vouchers.find((v) => v.id === offlineQueue[0].voucher_id)
        : null) ||
      vouchers[0];

    if (!candidate) return;
    const altMerchant =
      merchants.find((m) => m.id !== candidate.redeemed_by_merchant_id) ||
      merchants[1] ||
      merchants[0];
    if (!altMerchant) return;

    const nowIso = new Date().toISOString();
    const conflictTxId = generateClientTxId();
    const receiptHash = await sha256WebCrypto(
      `${conflictTxId}|${candidate.id}|${altMerchant.id}|${nowIso}`
    );

    const conflictItem: OfflineRedemptionQueueItem = {
      queue_id: `OFF-CONFLICT-${Date.now()}`,
      client_tx_id: conflictTxId,
      voucher_id: candidate.id,
      short_code: candidate.short_code,
      beneficiary_id: candidate.beneficiary_id,
      beneficiary_name: candidate.beneficiary_name,
      commodity_code: candidate.commodity_code,
      commodity_name: candidate.commodity_name,
      commodity_items: candidate.commodity_items,
      nominal_idr: candidate.nominal_idr,
      merchant_id: altMerchant.id,
      merchant_name: `${altMerchant.name} (HP Offline Lain)`,
      hmac_signature: candidate.hmac_signature,
      local_receipt_hash: receiptHash,
      redeemed_at: nowIso,
      synced: false,
      is_simulated_conflict: true,
    };

    setIsOfflineMode(true);
    await enqueueOfflineRedemption(conflictItem, true);
    const updatedQueue = await getOfflineRedemptionQueue();
    setOfflineQueue(updatedQueue);

    showToast(
      "warning",
      `Tes kupon ganda ${candidate.short_code} (${altMerchant.name}) masuk antrean. Klik Kirim Semua ke Pusat untuk cek penolakan.`
    );
  };

  const handleSyncOfflineBatch = async () => {
    if (offlineQueue.length === 0) return;
    setIsSyncingBatch(true);
    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BATCH_SYNC",
          redemptions: offlineQueue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pengiriman catatan gagal");

      await clearSyncedOfflineRedemptions();
      setOfflineQueue([]);
      setIsOfflineMode(false);
      setLastSyncResults(data.results || []);
      await applyServerState(data.state);

      const synced = data.synced_count ?? 0;
      const conflicts = data.conflict_count ?? 0;

      showToast(
        conflicts > 0 ? "warning" : "success",
        `Sinkron selesai: ${synced} transaksi masuk, ${conflicts} kupon ganda ditolak.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Pengiriman gagal"
      );
    } finally {
      setIsSyncingBatch(false);
    }
  };

  const handleSettleMerchants = async (merchantId?: string) => {
    if (isOfflineMode) {
      showToast("warning", "Ubah Sinyal ke Online dulu untuk mencairkan saldo.");
      return;
    }
    try {
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SETTLE_MERCHANTS",
          merchant_id: merchantId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await applyServerState(data.state);

      const totalDisbursed = data.batches.reduce(
        (acc: number, b: SettlementBatch) => acc + b.total_amount_idr,
        0
      );
      showToast(
        "success",
        `Pencairan ${formatRupiah(totalDisbursed)} ke ${data.batches.length} kedai dicatat (simulasi).`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Pencairan gagal"
      );
    }
  };

  const handleVerifyHashChain = async () => {
    setIsVerifyingChain(true);
    try {
      const clientRes = await verifyLedgerChainWebCrypto(ledger);
      let finalRes = clientRes;
      if (!isOfflineMode) {
        const res = await fetch("/api/clearinghouse?op=verify_chain", {
          cache: "no-store",
        });
        if (res.ok) {
          const serverRes = (await res.json()) as ChainVerificationResult;
          finalRes = {
            ...serverRes,
            valid: serverRes.valid && clientRes.valid,
            message:
              serverRes.valid && clientRes.valid
                ? `Hasil cek aman. Seluruh ${serverRes.checked_count} transaksi sesuai dan belum pernah diubah.`
                : serverRes.message || clientRes.message,
          };
        }
      }
      setChainCheckResult(finalRes);
      showToast(finalRes.valid ? "success" : "error", finalRes.message);
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "No_Catatan",
      "ID_Perangkat",
      "Waktu",
      "ID_Kupon",
      "Kode_Kupon",
      "ID_Warga",
      "ID_Kedai",
      "Nama_Kedai",
      "Paket_Sembako",
      "Nominal_IDR",
      "Cara_Catat",
      "No_Pencairan",
      "Prev_Hash",
      "Tx_Hash",
    ];
    const rows = ledger.map((l) => [
      l.id,
      l.client_tx_id,
      l.timestamp,
      l.voucher_id,
      l.short_code,
      l.beneficiary_id,
      l.merchant_id,
      `"${l.merchant_name.replace(/"/g, '""')}"`,
      `"${l.commodity_name.replace(/"/g, '""')}"`,
      l.nominal_idr,
      l.sync_mode,
      l.settlement_batch_id || "BELUM_CAIR",
      l.prev_hash,
      l.tx_hash,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civicledger-laporan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "File Excel (CSV) berhasil diunduh.");
  };

  const handleExportJson = () => {
    const snapshot = {
      diunduh_pada: new Date().toISOString(),
      proyek: "CivicLedger — Resilient Local Voucher Clearinghouse",
      tim: "Run.exe (STACK 2026 by GDGoC ITB — Kasus 2)",
      mesin_backend: backendEngine,
      dana_tersedia_idr: poolTotalIdr,
      kupon_ditolak: fraudBlockedCount,
      daftar_penerima: beneficiaries,
      daftar_kedai: merchants,
      daftar_kupon: vouchers,
      riwayat_penukaran: ledger,
      riwayat_offline: reconciliationLogs,
      bukti_pencairan: settlementBatches,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civicledger-arsip-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "File arsip (JSON) berhasil diunduh.");
  };

  const handleResetDemo = async () => {
    try {
      await clearAllOfflineStores();
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_DEMO" }),
      });
      if (!res.ok) throw new Error("API tidak tersedia");
      const data = await res.json();
      if (data.state) {
        await applyServerState(data.state, true);
        recordCalendarCacheSource("server");
        setCalendarAvailability("live");
      }
    } catch {
      const fallback = await buildClientFallbackState();
      recordCalendarCacheSource("fallback");
      setCalendarAvailability("unavailable");
      await applyServerState(fallback, true);
    }
    setOfflineQueue([]);
    setCryptoTrace(null);
    setLastSyncResults(null);
    setChainCheckResult(null);
    setIsOfflineMode(false);
    showToast("info", "Data demo dikembalikan ke kondisi awal.");
  };

  const activeVouchersCount = vouchers.filter(
    (v) => v.status === "ACTIVE"
  ).length;
  const totalWarungTurnover = merchants.reduce(
    (acc, m) => acc + m.total_settled_idr + m.unsettled_balance_idr,
    0
  );
  const totalUnsettledIdr = merchants.reduce(
    (acc, m) => acc + m.unsettled_balance_idr,
    0
  );
  const totalSettledBatchesIdr = settlementBatches.reduce(
    (acc, b) => acc + b.total_amount_idr,
    0
  );

  const filteredVouchers = vouchers.filter((v) => {
    const matchesStatus =
      voucherStatusFilter === "ALL" || v.status === voucherStatusFilter;
    const q = voucherSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      v.short_code.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      v.beneficiary_name.toLowerCase().includes(q) ||
      v.commodity_name.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const q = beneficiarySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.rt_rw.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q)
    );
  });

  const currentWalletBeneficiary = beneficiaries.find(
    (b) => b.id === walletBeneficiaryId
  );
  const currentWalletVouchers = vouchers.filter(
    (v) => v.beneficiary_id === walletBeneficiaryId
  );
  const currentWalletActiveCount = currentWalletVouchers.filter(
    (v) => v.status === "ACTIVE"
  ).length;

  const isCodeFormatValid =
    /^CL-\d{4}-[A-Z0-9]{2}$/i.test(scannerInputCode.trim()) ||
    vouchers.some(
      (v) =>
        v.short_code.toUpperCase() === scannerInputCode.trim().toUpperCase() ||
        v.id.toUpperCase() === scannerInputCode.trim().toUpperCase()
    );

  const engineShortText =
    backendEngine === "GO_POSTGRES"
      ? "Go + DB"
      : backendEngine === "GO_LOCAL"
        ? "Go Lokal"
        : "Lokal";

  const t = UI_COPY[lang];

  const allNavItems: Array<{
    id: ActiveTab;
    label: string;
    section: "OPERATIONS" | "CLEARINGHOUSE";
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    roles: Array<AuthUser["role"]>;
  }> = [
    {
      id: "COORDINATOR",
      label: t.tabs.COORDINATOR.label,
      section: "OPERATIONS",
      icon: LayoutGrid,
      roles: ["COORDINATOR"],
    },
    {
      id: "BENEFICIARY",
      label: currentUser?.role === "BENEFICIARY" ? t.tabs.BENEFICIARY.label : (lang === "en" ? "Print Voucher Slip" : "Cetak Slip Kupon"),
      section: "OPERATIONS",
      icon: QrCode,
      roles: ["COORDINATOR", "BENEFICIARY"],
    },
    {
      id: "MERCHANT_POS",
      label:
        currentUser?.role === "MERCHANT"
          ? lang === "en"
            ? "POS & QR Scanner"
            : "Kasir & Scan QR"
          : lang === "en"
            ? "POS Simulator (PWA)"
            : "Simulasi Kasir (PWA)",
      section: "OPERATIONS",
      icon: ScanLine,
      badge: offlineQueue.length,
      roles: ["COORDINATOR", "MERCHANT"],
    },
    {
      id: "CLEARINGHOUSE",
      label:
        currentUser?.role === "MERCHANT"
          ? lang === "en"
            ? "Balance & History"
            : "Saldo & Riwayat"
          : t.tabs.CLEARINGHOUSE.label,
      section: "CLEARINGHOUSE",
      icon: Landmark,
      roles: ["COORDINATOR", "MERCHANT"],
    },
    {
      id: "REPORTS",
      label: t.tabs.REPORTS.label,
      section: "CLEARINGHOUSE",
      icon: BarChart3,
      roles: ["COORDINATOR"],
    },
    {
      id: "GUIDE",
      label: t.tabs.GUIDE.label,
      section: "CLEARINGHOUSE",
      icon: BookOpen,
      roles: ["COORDINATOR", "MERCHANT"],
    },
  ];

  const navItems = currentUser
    ? allNavItems.filter((item) => item.roles.includes(currentUser.role))
    : allNavItems;

  const canSwitchToTab = (tab: ActiveTab) =>
    navItems.some((item) => item.id === tab);

  if (!mounted || !authChecked) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen bg-canvas flex items-center justify-center text-sm text-ink-muted"
      >
        {lang === "en" ? "Loading..." : "Memuat halaman..."}
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        lang={lang}
        theme={theme}
        largeText={largeText}
        onToggleLang={updateLang}
        onToggleTheme={updateTheme}
        onToggleLargeText={updateLargeText}
        onAuthenticated={(user) => {
          applyAuthenticatedUser(user);
          if (user.role !== "COORDINATOR") showToast("success", `Halo, ${user.name} (${user.role_label}).`);
        }}
      />
    );
  }

  const organizer = currentUser.role === "COORDINATOR";
  const opsNav = navItems.filter((i) => i.section === "OPERATIONS");
  const clearNav = navItems.filter((i) => i.section === "CLEARINGHOUSE");
  const openPassword = () => {
    setCpError("");
    setShowChangePasswordModal(true);
  };
  function gotoCoordinator(id: string, view?: ResourceView) {
    setActiveTab("COORDINATOR");
    if (view) { setCoordinatorRightView(view); setFullCoordinatorResources(true); }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }));
  }
  function openOrganizerSettings() {
    mobileNavigation.current?.close();
    const settings = organizerSettings.current;
    if (!settings) return;
    settings.open = true;
    settings.querySelector("summary")?.focus();
  }

  const reminders = organizer ? getOperationalReminders(vouchers, offlineQueue.length, lang === "en") : [];
  function organizerNavigation() {
    const groups = [
      { name: "Workspace", entries: opsNav },
      { name: "Management", entries: clearNav },
    ];
    return (
      <nav className={workspace.organizerNav} aria-label={lang === "en" ? "Organizer navigation" : "Navigasi pengurus"}>
        {groups.map(({ name, entries }) => (
          <div key={name} className={workspace.navGroup}>
            <p>{name}</p>
            {entries.map(({ id, label, icon: Icon }) => {
              const title = id === "COORDINATOR" ? "Dashboard" : id === "CLEARINGHOUSE" ? (lang === "en" ? "Fund Settlement" : "Pencairan Dana") : label;
              return (
                <button key={id} type="button" title={title} aria-label={title} aria-current={id === activeTab ? "page" : undefined} onClick={(event) => {
                  const button = event.currentTarget;
                  const previous = button.closest("nav")?.querySelector('[aria-current="page"]');
                  const distance = previous ? previous.getBoundingClientRect().top - button.getBoundingClientRect().top : 0;
                  mobileNavigation.current?.close();
                  setActiveTab(id);
                  window.scrollTo(0, 0);
                  if (distance && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    requestAnimationFrame(() => button.querySelector("[data-nav-marker]")?.animate(
                      [{ transform: "translateY(" + distance + "px)", opacity: .3 }, { transform: "translateY(0)", opacity: 1 }],
                      { duration: 340, easing: "cubic-bezier(.22, .7, .24, 1)" },
                    ));
                  }
                }}>
                  <i className={workspace.navMarker} data-nav-marker aria-hidden="true" />
                  <Icon className="w-[18px] h-[18px]" />
                  <span>{title}</span>
                </button>
              );
            })}
          </div>
        ))}
        <div className={workspace.navGroup}>
          <p>Account</p>
          <button type="button" title={lang === "en" ? "Settings" : "Pengaturan"} aria-label={lang === "en" ? "Settings" : "Pengaturan"} onClick={openOrganizerSettings}>
            <Settings size={18} /><span>{lang === "en" ? "Settings" : "Pengaturan"}</span>
          </button>
          <button type="button" title={lang === "en" ? "Sign out" : "Keluar"} aria-label={lang === "en" ? "Sign out" : "Keluar"} onClick={handleLogout}>
            <LogOut size={18} /><span>{lang === "en" ? "Sign out" : "Keluar"}</span>
          </button>
        </div>
      </nav>
    );
  }

  function openVoucher(voucher: Voucher) {
    setWalletBeneficiaryId(voucher.beneficiary_id);
    setSelectedVoucherForQR(voucher);
    setActiveTab("BENEFICIARY");
  }

  return (
    <div
      suppressHydrationWarning
      className={`min-h-screen flex bg-canvas text-ink-body ${organizer ? workspace.shell + " " + coordinatorSora.variable : ""}`}
      data-compact={organizer && compactRail}
    >
      {/* ==================== SIDEBAR KIRI (DESKTOP) ==================== */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-surface border-r border-line/70 z-30 select-none">
        {organizer ? (
          <div className={workspace.brandHeader}>
            <button
              className={workspace.brandMark}
              type="button"
              disabled={!compactRail}
              aria-hidden={!compactRail}
              aria-label={lang === "en" ? "Expand menu" : "Perluas menu"}
              aria-expanded={!compactRail}
              onClick={(event) => {
                const header = event.currentTarget.parentElement;
                setCompactRail(false);
                requestAnimationFrame(() => header?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]:not(:disabled)')?.focus());
              }}
            ><span aria-hidden="true">C</span></button>
            <div className={workspace.brandCopy} aria-hidden={compactRail}>
              <div className={workspace.brandMask}><span>Civic<em>Ledger.</em></span></div>
              <p>Community Workspace</p>
            </div>
            <button
              className={workspace.brandCollapse}
              type="button"
              disabled={compactRail}
              aria-hidden={compactRail}
              aria-label={lang === "en" ? "Collapse menu" : "Ringkas menu"}
              aria-expanded={!compactRail}
              onClick={(event) => {
                const header = event.currentTarget.parentElement;
                setCompactRail(true);
                requestAnimationFrame(() => header?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]:not(:disabled)')?.focus());
              }}
            ><PanelLeftClose size={16} /></button>
          </div>
        ) : (
        <div className="h-16 px-4 flex items-center justify-between border-b border-line/60">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={34} className="shrink-0 shadow-sm rounded-xl" />
            <div>
              <span className="font-bold text-[15px] tracking-[-0.015em] text-ink-primary block leading-tight">
                CivicLedger
              </span>
              <span className="text-[11px] text-ink-muted">
                {currentUser.role === "MERCHANT"
                  ? lang === "en"
                    ? "Store Owner Portal"
                    : "Portal Pemilik Toko"
                  : currentUser.role === "BENEFICIARY"
                    ? (lang === "en" ? "Aid Recipient Portal" : "Portal Warga Penerima")
                    : t.portalSub}
              </span>
            </div>
          </div>
        </div>
        )}

        {/* Profil Akun */}
        {!organizer && <div className="p-3.5 border-b border-line/50 bg-nested/45">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-cta-bg text-cta-ink flex items-center justify-center font-bold text-sm shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-ink-primary truncate">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-emeraldTech font-semibold truncate">
                {currentUser.role_label}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={() => {
                setCpError("");
                setShowChangePasswordModal(true);
              }}
              className="py-1.5 px-2 rounded-lg bg-card hover:bg-elevated border border-line/60 text-[11px] font-semibold text-ink-primary flex items-center justify-center gap-1 transition"
            >
              <KeyRound className="w-3 h-3 text-emeraldTech" />
              Ganti Sandi
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="py-1.5 px-2 rounded-lg bg-card hover:bg-roseTech/10 border border-line/60 hover:border-roseTech/40 text-[11px] font-semibold text-ink-secondary hover:text-roseTech flex items-center justify-center gap-1 transition"
            >
              <LogOut className="w-3 h-3" />
              Keluar
            </button>
          </div>
        </div>}

        {organizer ? organizerNavigation() : (
        <nav className="flex-1 py-4 space-y-5 overflow-y-auto px-2.5">
          {opsNav.length > 0 && (
            <div>
              <p className="px-2.5 mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Menu Utama
              </p>
              <div className="space-y-1">
                {opsNav.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] transition ${active
                          ? "bg-cta-bg text-cta-ink font-semibold shadow-sm"
                          : "text-ink-body hover:text-ink-primary hover:bg-nested"
                        }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`w-[18px] h-[18px] ${active ? "text-cta-ink" : "text-ink-muted"
                            }`}
                        />
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded-full tabular-nums ${item.badge > 0
                              ? "bg-amberTech text-white font-bold"
                              : active
                                ? "bg-white/20 text-cta-ink"
                                : "bg-nested text-ink-muted"
                            }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {clearNav.length > 0 && (
            <div>
              <p className="px-2.5 mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Pencairan &amp; Panduan
              </p>
              <div className="space-y-1">
                {clearNav.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] transition ${active
                          ? "bg-cta-bg text-cta-ink font-semibold shadow-sm"
                          : "text-ink-body hover:text-ink-primary hover:bg-nested"
                        }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`w-[18px] h-[18px] ${active ? "text-cta-ink" : "text-ink-muted"
                            }`}
                        />
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
        )}

        {/* Kontrol Bawah */}
        <div className="p-3.5 border-t border-line/60 bg-surface space-y-2.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
              <span className="font-medium">{organizer ? (lang === "en" ? "Simulation" : "Simulasi") : "Sinyal"}</span>
              <div className="flex bg-nested p-0.5 rounded-lg border border-line/60">
                <button
                  type="button"
                  onClick={() => {
                    if (isOfflineMode) {
                      setIsOfflineMode(false);
                      showToast("info", "Mode Online aktif.");
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition ${!isOfflineMode
                      ? "bg-card text-emeraldTech shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${!isOfflineMode ? "bg-emeraldTech" : "bg-ink-muted/50"
                      }`}
                  />
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isOfflineMode) {
                      setIsOfflineMode(true);
                      showToast(
                        "warning",
                        "Mode Offline aktif. Kasir Kedai tetap bisa mengecek kupon."
                      );
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition ${isOfflineMode
                      ? "bg-card text-amberTech shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  {isOfflineMode && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amberTech" />
                  )}
                  Offline
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
              <span className="font-medium">Layar</span>
              <div className="flex bg-nested p-0.5 rounded-lg border border-line/60">
                <button
                  type="button"
                  onClick={() => updateTheme("light")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition ${theme === "light"
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  <Sun className="w-3 h-3 text-amberTech" />
                  Siang
                </button>
                <button
                  type="button"
                  onClick={() => updateTheme("dark")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition ${theme === "dark"
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  <Moon className="w-3 h-3" />
                  Malam
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
              <span className="font-medium">
                {lang === "en" ? "Text" : "Huruf"}
              </span>
              <div className="flex bg-nested p-0.5 rounded-lg border border-line/60">
                <button
                  type="button"
                  onClick={() => updateLargeText(false)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${!largeText
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => updateLargeText(true)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${largeText
                      ? "bg-cta-bg text-cta-ink shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  {lang === "en" ? "Large" : "Besar"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
              <span className="font-medium">
                {lang === "en" ? "Language" : "Bahasa"}
              </span>
              <div className="flex bg-nested p-0.5 rounded-lg border border-line/60">
                <button
                  type="button"
                  onClick={() => updateLang("id")}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${lang === "id"
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => updateLang("en")}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${lang === "en"
                      ? "bg-card text-ink-primary shadow-sm"
                      : "text-ink-muted hover:text-ink-primary"
                    }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-line/40 pt-2 space-y-1 text-[11px] text-ink-muted">
            {organizer && <div className="flex justify-between gap-2"><span>{lang === "en" ? "Device connection" : "Koneksi perangkat"}</span><strong>{deviceOnline ? "Online" : "Offline"}</strong></div>}
            <div
              className="flex items-center justify-between gap-2"
              title={`Backend: ${backendEngine}`}
            >
              <span>Server</span>
              <span className="font-mono text-ink-secondary truncate">
                {engineShortText}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Database</span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  realtimeConnected && !isOfflineMode
                    ? "text-emeraldTech"
                    : "text-amberTech"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    realtimeConnected && !isOfflineMode
                      ? "bg-emeraldTech animate-pulse"
                      : "bg-amberTech"
                  }`}
                />
                {isOfflineMode
                  ? "Offline"
                  : realtimeConnected
                    ? "Realtime"
                    : "Menyambung..."}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Offline</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emeraldTech">
                <span className="w-1.5 h-1.5 rounded-full bg-emeraldTech" />
                {swRegistered ? "Siap" : "Aktif"}
              </span>
            </div>
          </div>

          {currentUser.role === "COORDINATOR" && (
            <button
              type="button"
              onClick={handleResetDemo}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-nested hover:bg-elevated text-ink-primary border border-line/60 transition text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
              Reset Data Demo
            </button>
          )}
        </div>
      </aside>

      {/* ==================== AREA KONTEN UTAMA ==================== */}
      <div className={`flex-1 lg:pl-64 flex flex-col min-w-0 ${organizer ? workspace.body : ""}`}>
        <header className="no-print sticky top-0 z-20 h-16 bg-surface/92 backdrop-blur-md border-b border-line/60 px-4 sm:px-6 flex items-center justify-between gap-3">
          {organizer ? <>
            <button className={workspace.mobileMenu} type="button" aria-label={lang === "en" ? "Open navigation" : "Buka navigasi"} onClick={() => mobileNavigation.current?.showModal()}><Menu size={20} /></button>
            <CoordinatorSearch en={lang === "en"} vouchers={vouchers} beneficiaries={beneficiaries} ledger={ledger} onVoucher={openVoucher} onResident={(resident) => { setBeneficiarySearch(resident.name); gotoCoordinator("coordinator-operations", "BENEFICIARIES"); }} onTransaction={() => setActiveTab("CLEARINGHOUSE")} />
          </> : <div className="min-w-0 flex items-center gap-3">
            <BrandLogo size={34} className="lg:hidden shrink-0 rounded-xl shadow-sm" />
            <div className="truncate">
              <div className="text-[15px] font-bold tracking-[-0.015em] text-ink-primary truncate">
                {t.tabs[activeTab].title}
              </div>
              <div className="hidden sm:block text-xs text-ink-muted truncate">
                {t.tabs[activeTab].subtitle}
              </div>
            </div>
          </div>}

          <div className="flex items-center gap-2 shrink-0">
            {currentUser.role !== "BENEFICIARY" && offlineQueue.length > 0 && (
              <button
                onClick={handleSyncOfflineBatch}
                disabled={isSyncingBatch}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amberTech/15 hover:bg-amberTech/25 border border-amberTech/40 text-amberTech text-xs font-bold transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                />
                <span className="tabular-nums">
                  Kirim Offline ({offlineQueue.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => updateLargeText(!largeText)}
              title="Ubah ukuran tulisan"
              className={`lg:hidden inline-flex items-center justify-center px-2.5 h-9 rounded-lg border text-xs font-semibold ${largeText
                  ? "bg-cta-bg text-cta-ink border-cta-bg"
                  : "bg-card border-line text-ink-primary"
                }`}
            >
              <Type className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => updateTheme(theme === "dark" ? "light" : "dark")}
              title="Ganti tema layar"
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-line text-ink-primary"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amberTech" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsOfflineMode(!isOfflineMode)}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-card border border-line text-xs font-semibold text-ink-primary"
            >
              <span
                className={`w-2 h-2 rounded-full ${isOfflineMode ? "bg-amberTech" : "bg-emeraldTech"
                  }`}
              />
              {isOfflineMode ? "Offline" : "Online"}
            </button>

            <span
              title="Seluruh data di website ini adalah data contoh simulasi untuk STACK 2026."
              className="hidden md:inline-flex items-center px-3 py-1.5 rounded-full bg-nested border border-line/60 text-[11px] font-semibold text-ink-secondary"
            >
              {t.simBadge}
            </span>

            <button
              type="button"
              onClick={() => updateLang(lang === "id" ? "en" : "id")}
              title="Switch Language ID/EN"
              className="inline-flex items-center justify-center px-2.5 h-9 rounded-lg bg-card hover:bg-nested border border-line text-xs font-bold text-ink-primary transition"
            >
              {lang === "id" ? "EN" : "ID"}
            </button>

            <span className="hidden xl:inline-flex items-center px-3 py-1.5 rounded-full bg-emeraldTech/12 border border-emeraldTech/30 font-mono text-[11px] font-semibold text-emeraldTech">
              STACK 2026 · Tim Run.exe
            </span>

            <button
              type="button"
              onClick={handleLogout}
              title="Keluar"
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-line text-ink-secondary hover:text-roseTech"
            >
              <LogOut className="w-4 h-4" />
            </button>
            {organizer && <details className={workspace.notifications}>
              <summary aria-label={lang === "en" ? "Notifications" : "Notifikasi"}><Bell size={17} />{reminders.length > 0 && <i aria-hidden="true" />}</summary>
              <div><strong>{lang === "en" ? "Operational notifications" : "Notifikasi operasional"}</strong>
                {reminders.length ? <ul>{reminders.map(reminder => <li key={reminder.key}>{reminder.count} {reminder.label}</li>)}</ul> : <p>{lang === "en" ? "No reminders right now." : "Belum ada pengingat."}</p>}
                <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); gotoCoordinator("coordinator-reminders"); }}>{lang === "en" ? "View reminders" : "Lihat pengingat"}</button>
              </div>
            </details>}
            {organizer && <details ref={organizerSettings} className={workspace.profile}>
              <summary aria-label={lang === "en" ? "Account and settings" : "Akun dan pengaturan"}><span className={workspace.avatar}>{currentUser.name.charAt(0)}</span><strong>{currentUser.role_label}</strong></summary>
              <div onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}>
                <strong>{currentUser.name}</strong>
                <button type="button" onClick={() => updateTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? t.dayMode : t.nightMode}</button>
                <button type="button" onClick={() => updateLargeText(!largeText)}>{largeText ? t.largeTextOn : t.largeTextOff}</button>
                <button type="button" onClick={() => setIsOfflineMode(!isOfflineMode)}>{isOfflineMode ? (lang === "en" ? "Stop offline simulation" : "Akhiri simulasi offline") : (lang === "en" ? "Simulate offline" : "Simulasi offline")}</button>
                <button type="button" onClick={openPassword}>{lang === "en" ? "Change password" : "Ganti kata sandi"}</button>
                <button type="button" onClick={handleResetDemo}>{lang === "en" ? "Reset demo data" : "Reset data demo"}</button>
                <button type="button" onClick={handleLogout}>{lang === "en" ? "Sign out" : "Keluar"}</button>
              </div>
            </details>}
          </div>
        </header>
        {organizer && <dialog ref={mobileNavigation} className={workspace.dialog} aria-labelledby="rail-title">
          <header className={workspace.dialogHead}><h2 id="rail-title">CivicLedger</h2><button type="button" onClick={() => mobileNavigation.current?.close()} aria-label={lang === "en" ? "Close" : "Tutup"}><CloseMenu size={18} /></button></header>
          {organizerNavigation()}
        </dialog>}

        {/* Tab Mobile */}
        <div className={organizer ? "hidden" : "no-print lg:hidden border-b border-line/60 bg-surface px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto"}>
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                      aria-current={active ? "page" : undefined}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${active
                    ? "bg-cta-bg text-cta-ink shadow-sm"
                    : "text-ink-body hover:text-ink-primary bg-card border border-line/60"
                  }`}
              >
                {item.label}
                {item.badge !== undefined && item.badge > 0
                  ? ` (${item.badge})`
                  : ""}
              </button>
            );
          })}
        </div>

        {/* Banner Offline */}
        {isOfflineMode && (
          <div className="no-print bg-amberTech/12 border-b border-amberTech/35 px-4 sm:px-6 py-3">
            <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[13.5px] text-amberTech">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amberTech shrink-0 animate-pulse" />
                <span>
                  <strong>Mode Offline aktif.</strong> Kedai tetap bisa menerima
                  kupon warga. Catatan disimpan dulu di HP ini.
                </span>
              </div>
              {currentUser.role !== "BENEFICIARY" && offlineQueue.length > 0 && (
                <button
                  onClick={handleSyncOfflineBatch}
                  className="text-xs font-bold underline underline-offset-4 self-start sm:self-auto whitespace-nowrap"
                >
                  Sambungkan &amp; Kirim ({offlineQueue.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Toast */}
        {actionBanner && (
          <div className="no-print px-4 sm:px-6 pt-4">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-card border border-line shadow-sm text-[13.5px] text-ink-primary">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${actionBanner.type === "success"
                      ? "bg-emeraldTech"
                      : actionBanner.type === "warning"
                        ? "bg-amberTech"
                        : actionBanner.type === "error"
                          ? "bg-roseTech"
                          : "bg-ink-secondary"
                    }`}
                />
                <span className="leading-snug font-medium">
                  {actionBanner.text}
                </span>
              </div>
              <button
                onClick={() => setActionBanner(null)}
                className="text-ink-muted hover:text-ink-primary shrink-0 p-1"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== KONTEN HALAMAN ==================== */}
        <main className="flex-1 px-4 sm:px-6 py-6">
          <div className="max-w-[1440px] mx-auto">
            {loading && organizer ? (
              <div className={workspace.skeleton} role="status" aria-label={lang === "en" ? "Loading dashboard" : "Memuat dashboard"}><span /><span /><span /><span /><span /></div>
            ) : loading ? (
              <div className="py-20 text-center text-sm text-ink-muted">
                Memuat data bansos...
              </div>
            ) : (
              <>
                {/* TAB 1: BERANDA PENGURUS */}
                {activeTab === "COORDINATOR" && (
                  <CoordinatorTab
                    pendingSync={offlineQueue.length}
                    calendarRecords={{ settlementBatches, reconciliationLogs, offlineQueue }}
                    calendarAvailability={calendarAvailability}
                    deviceOnline={deviceOnline}
                    ledger={ledger}
                    onReports={() => setActiveTab("REPORTS")}
                    lang={lang}
                    currentUser={currentUser}
                    isOfflineMode={isOfflineMode}
                    poolTotalIdr={poolTotalIdr}
                    activeVouchersCount={activeVouchersCount}
                    totalWarungTurnover={totalWarungTurnover}
                    fraudBlockedCount={fraudBlockedCount}
                    beneficiaries={beneficiaries}
                    merchants={merchants}
                    vouchers={vouchers}
                    catalog={catalog}
                    filteredVouchers={filteredVouchers}
                    filteredBeneficiaries={filteredBeneficiaries}
                    selectedBeneficiaryId={selectedBeneficiaryId}
                    setSelectedBeneficiaryId={setSelectedBeneficiaryId}
                    selectedCommodityCode={selectedCommodityCode}
                    setSelectedCommodityCode={setSelectedCommodityCode}
                    validityHours={validityHours}
                    setValidityHours={setValidityHours}
                    newResidentName={newResidentName}
                    setNewResidentName={setNewResidentName}
                    newResidentRtRw={newResidentRtRw}
                    setNewResidentRtRw={setNewResidentRtRw}
                    newResidentCategory={newResidentCategory}
                    setNewResidentCategory={setNewResidentCategory}
                    newResidentPhone={newResidentPhone}
                    setNewResidentPhone={setNewResidentPhone}
                    newMerchantName={newMerchantName}
                    setNewMerchantName={setNewMerchantName}
                    newMerchantOwner={newMerchantOwner}
                    setNewMerchantOwner={setNewMerchantOwner}
                    newMerchantRtRw={newMerchantRtRw}
                    setNewMerchantRtRw={setNewMerchantRtRw}
                    newMerchantBank={newMerchantBank}
                    setNewMerchantBank={setNewMerchantBank}
                    coordinatorRightView={coordinatorRightView}
                    setCoordinatorRightView={setCoordinatorRightView}
                    fullResources={fullCoordinatorResources}
                    onFullResources={() => setFullCoordinatorResources(true)}
                    onCopyVoucherSms={handleCopySmsSlip}
                    voucherStatusFilter={voucherStatusFilter}
                    setVoucherStatusFilter={setVoucherStatusFilter}
                    voucherSearch={voucherSearch}
                    setVoucherSearch={setVoucherSearch}
                    beneficiarySearch={beneficiarySearch}
                    setBeneficiarySearch={setBeneficiarySearch}
                    onAddBeneficiary={handleAddBeneficiary}
                    onAddMerchant={handleAddMerchant}
                    onTopupPool={handleTopupPool}
                    onAddCommodity={handleAddCommodity}
                    onIssueVoucher={handleIssueVoucher}
                    onOpenVoucherCard={openVoucher}
                    onNotifySelectedBeneficiary={(name) =>
                      showToast(
                        "info",
                        lang === "en"
                          ? `${name} selected. Choose a package and click Issue Signed Voucher.`
                          : `${name} dipilih. Pilih paket lalu klik Buat Kupon Sembako.`
                      )
                    }
                  />
                )}

                {/* TAB 2: KUPON WARGA / SLIP CETAK */}
                {activeTab === "BENEFICIARY" && (
                  <BeneficiaryTab
                    className={coordinatorSora.variable}
                    lang={lang}
                    currentUser={currentUser}
                    beneficiaries={currentUser.role === "BENEFICIARY"
                      ? beneficiaries.filter((beneficiary) => beneficiary.id === walletBeneficiaryId)
                      : beneficiaries}
                    walletBeneficiaryId={walletBeneficiaryId}
                    setWalletBeneficiaryId={setWalletBeneficiaryId}
                    currentWalletBeneficiary={currentWalletBeneficiary || null}
                    currentWalletVouchers={currentWalletVouchers}
                    currentWalletActiveCount={currentWalletActiveCount}
                    selectedVoucherForQR={selectedVoucherForQR?.beneficiary_id === walletBeneficiaryId ? selectedVoucherForQR : null}
                    setSelectedVoucherForQR={setSelectedVoucherForQR}
                    qrDataUrl={voucherQr && voucherQr.voucherId === selectedVoucherForQR?.id ? voucherQr.url : ""}
                    showVoucherTechDetails={showVoucherTechDetails}
                    setShowVoucherTechDetails={setShowVoucherTechDetails}
                    copiedSms={copiedSms}
                    canOpenMerchantPos={canSwitchToTab("MERCHANT_POS")}
                    onRefresh={fetchClearinghouseState}
                    onCopySmsSlip={handleCopySmsSlip}
                    onSendToMerchantPos={sendVoucherToMerchantScanner}
                  />
                )}

                {/* TAB 3: KASIR KEDAI & SCAN QR */}
                {activeTab === "MERCHANT_POS" && (
                  <MerchantPosTab
                    lang={lang}
                    currentUser={currentUser}
                    realtimeConnected={realtimeConnected}
                    isOfflineMode={isOfflineMode}
                    cameraActive={cameraActive}
                    cameraDetectSupported={cameraDetectSupported}
                    videoRef={videoRef}
                    merchants={merchants}
                    activeMerchantId={activeMerchantId}
                    setActiveMerchantId={setActiveMerchantId}
                    vouchers={vouchers}
                    scannerInputCode={scannerInputCode}
                    setScannerInputCode={setScannerInputCode}
                    setScannedQRPayloadRaw={setScannedQRPayloadRaw}
                    isCodeFormatValid={isCodeFormatValid}
                    cryptoTrace={cryptoTrace}
                    setCryptoTrace={setCryptoTrace}
                    showVerifierTechDetails={showVerifierTechDetails}
                    setShowVerifierTechDetails={setShowVerifierTechDetails}
                    offlineQueue={offlineQueue}
                    isSyncingBatch={isSyncingBatch}
                    fraudBlockedCount={fraudBlockedCount}
                    ledger={ledger}
                    lastSyncResults={lastSyncResults}
                    setLastSyncResults={setLastSyncResults}
                    onToggleCamera={toggleCamera}
                    onUploadQrFile={handleUploadQrFile}
                    onVerifyAndRedeem={handleVerifyAndRedeem}
                    onSimulateOfflineConflict={handleSimulateOfflineConflict}
                    onSyncOfflineBatch={handleSyncOfflineBatch}
                  />
                )}

                {/* TAB 4: PENCAIRAN & RIWAYAT */}
                {activeTab === "CLEARINGHOUSE" && (
                  <ClearinghouseTab
                    lang={lang}
                    currentUser={currentUser}
                    poolTotalIdr={poolTotalIdr}
                    totalUnsettledIdr={totalUnsettledIdr}
                    totalSettledBatchesIdr={totalSettledBatchesIdr}
                    merchants={merchants}
                    ledger={ledger}
                    reconciliationLogs={reconciliationLogs}
                    settlementBatches={settlementBatches}
                    showFullHashes={showFullHashes}
                    setShowFullHashes={setShowFullHashes}
                    isVerifyingChain={isVerifyingChain}
                    chainCheckResult={chainCheckResult}
                    onSettleMerchants={handleSettleMerchants}
                    onVerifyHashChain={handleVerifyHashChain}
                    onExportJson={handleExportJson}
                  />
                )}

                {/* TAB 5: LAPORAN */}
                {activeTab === "REPORTS" && (
                  <ReportsComplianceTab
                    poolTotalIdr={poolTotalIdr}
                    fraudBlockedCount={fraudBlockedCount}
                    beneficiaries={beneficiaries}
                    merchants={merchants}
                    vouchers={vouchers}
                    ledger={ledger}
                    settlementBatches={settlementBatches}
                    reconciliationLogs={reconciliationLogs}
                    backendEngine={backendEngine}
                    formatRupiah={formatRupiah}
                    onExportCsv={handleExportCsv}
                    onExportJson={handleExportJson}
                  />
                )}

                {/* TAB 6: CARA PAKAI */}
                {activeTab === "GUIDE" && (
                  <UserGuideTab
                    onNavigate={(tab) => {
                      if (canSwitchToTab(tab)) {
                        setActiveTab(tab);
                      } else {
                        showToast(
                          "info",
                          lang === "en"
                            ? "This menu is reserved for Organizers."
                            : "Menu ini hanya untuk akun Pengurus."
                        );
                      }
                    }}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* MODAL GANTI KATA SANDI */}
      <PasswordModal
        lang={lang}
        currentUser={currentUser}
        open={showChangePasswordModal}
        cpError={cpError}
        cpOldPass={cpOldPass}
        setCpOldPass={setCpOldPass}
        cpNewPass={cpNewPass}
        setCpNewPass={setCpNewPass}
        cpConfirmPass={cpConfirmPass}
        setCpConfirmPass={setCpConfirmPass}
        cpShowPass={cpShowPass}
        setCpShowPass={setCpShowPass}
        cpBusy={cpBusy}
        onClose={() => setShowChangePasswordModal(false)}
        onSubmit={handleChangePasswordSubmit}
      />
    </div>
  );
}
