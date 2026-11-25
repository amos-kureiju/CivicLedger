"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import {
  LayoutGrid,
  QrCode,
  ScanLine,
  Landmark,
  BarChart3,
  BookOpen,
  Plus,
  Search,
  Copy,
  Check,
  Printer,
  Camera,
  CameraOff,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  X,
  ArrowUpRight,
  Sun,
  Moon,
  Wallet,
  Ticket,
  Store,
  UserCheck,
  UserPlus,
  MapPin,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Info,
  Receipt,
  Send,
  Lock,
  Download,
  HeartHandshake,
  LogOut,
  KeyRound,
  Type,
  Eye,
  EyeOff,
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
  ReconciliationOutcome,
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
import AuthGate from "@/components/AuthGate";
import ReportsComplianceTab from "@/components/ReportsComplianceTab";
import UserGuideTab from "@/components/UserGuideTab";

type ActiveTab =
  | "COORDINATOR"
  | "BENEFICIARY"
  | "MERCHANT_POS"
  | "CLEARINGHOUSE"
  | "REPORTS"
  | "GUIDE";

type ThemeMode = "light" | "dark";

interface CryptoVerificationTrace {
  timestamp: string;
  durationMs: number;
  clientTxId: string;
  voucherId: string;
  shortCode: string;
  beneficiaryName: string;
  commodityName: string;
  nominalIdr: number;
  canonicalMessage: string;
  providedSignature: string;
  computedSignature: string;
  hmacValid: boolean;
  doubleSpendCheckPassed: boolean;
  expiryCheckPassed: boolean;
  mode: "ONLINE" | "OFFLINE_INDEXEDDB";
  receiptHash?: string;
  errorReason?: string;
}

const TAB_META: Record<ActiveTab, { title: string; subtitle: string }> = {
  COORDINATOR: {
    title: "Beranda Pengurus",
    subtitle: "Kelola dana bansos, daftar penerima, dan kupon sembako.",
  },
  BENEFICIARY: {
    title: "Kupon Warga",
    subtitle: "Tunjukkan QR atau kode kupon ini saat mengambil sembako di kedai.",
  },
  MERCHANT_POS: {
    title: "Kasir Kedai",
    subtitle: "Scan QR atau ketik kode kupon warga. Bisa dipakai saat offline.",
  },
  CLEARINGHOUSE: {
    title: "Pencairan & Riwayat",
    subtitle: "Cairkan saldo kedai dan cek riwayat penukaran kupon.",
  },
  REPORTS: {
    title: "Laporan Bansos",
    subtitle: "Ringkasan pembagian sembako dan unduh laporan Excel atau JSON.",
  },
  GUIDE: {
    title: "Cara Pakai",
    subtitle: "Langkah penggunaan tiap menu di CivicLedger.",
  },
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatShortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatStatusLabel(status: VoucherStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Siap Pakai";
    case "REDEEMED":
      return "Sudah Dipakai";
    case "SETTLED":
      return "Sudah Cair";
    case "EXPIRED":
      return "Kedaluwarsa";
  }
}

function formatOutcomeLabel(outcome: ReconciliationOutcome): string {
  switch (outcome) {
    case "SYNCED":
      return "Masuk";
    case "DUPLICATE_CONFLICT":
      return "Ditolak (Ganda)";
    case "INVALID_SIGNATURE":
      return "Ditolak (Palsu)";
    case "EXPIRED":
      return "Ditolak (Habis)";
    case "NOT_FOUND":
      return "Tidak Ditemukan";
  }
}

export default function CivicLedgerApp() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("COORDINATOR");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [largeText, setLargeText] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
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
  const [coordinatorRightView, setCoordinatorRightView] = useState<
    "VOUCHERS" | "BENEFICIARIES"
  >("VOUCHERS");
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
  const [showAddResidentForm, setShowAddResidentForm] =
    useState<boolean>(false);
  const [newResidentName, setNewResidentName] = useState<string>("");
  const [newResidentRtRw, setNewResidentRtRw] = useState<string>(
    "Desa Sitoluama, Laguboti"
  );
  const [newResidentCategory, setNewResidentCategory] = useState<string>(
    "Keluarga Kurang Mampu"
  );
  const [newResidentPhone, setNewResidentPhone] =
    useState<string>("0812-6300-0000");

  const [showAddMerchantForm, setShowAddMerchantForm] =
    useState<boolean>(false);
  const [newMerchantName, setNewMerchantName] = useState<string>("");
  const [newMerchantOwner, setNewMerchantOwner] = useState<string>("");
  const [newMerchantRtRw, setNewMerchantRtRw] =
    useState<string>("Pasar Laguboti, Toba");
  const [newMerchantBank, setNewMerchantBank] =
    useState<string>("BRI / QRIS •• 5510");

  // State Kupon Warga
  const [walletBeneficiaryId, setWalletBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedVoucherForQR, setSelectedVoucherForQR] =
    useState<Voucher | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
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
      if (user.linked_merchant_id) setActiveMerchantId(user.linked_merchant_id);
    } else if (user.role === "BENEFICIARY") {
      setActiveTab("BENEFICIARY");
      if (user.linked_beneficiary_id)
        setWalletBeneficiaryId(user.linked_beneficiary_id);
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

    fetch("/api/auth", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          applyAuthenticatedUser(data.user);
        } else {
          // Bersihkan cache user lama jika sesi tidak cocok
          window.localStorage.removeItem("civicledger_last_user");
        }
      })
      .catch(() => {
        try {
          const cached = window.localStorage.getItem("civicledger_last_user");
          if (cached) {
            const parsed = JSON.parse(cached) as AuthUser;
            if (parsed.email?.endsWith("@civicledger.id")) {
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
      setCameraDetectSupported("BarcodeDetector" in window);
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
      } else {
        const fallback = await buildClientFallbackState();
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
      setQrDataUrl("");
      return;
    }
    const payload = encodeVoucherToQRPayload(selectedVoucherForQR);
    QRCode.toDataURL(payload, {
      width: 240,
      margin: 2,
      color: {
        dark: "#1d2622",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      mediaStreamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const win = window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (
              source: HTMLVideoElement
            ) => Promise<Array<{ rawValue: string }>>;
          };
        };
        if (win.BarcodeDetector && videoRef.current) {
          const detector = new win.BarcodeDetector({ formats: ["qr_code"] });
          scanTimerRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0 && codes[0].rawValue) {
                const decoded = decodeVoucherQRPayload(codes[0].rawValue);
                if (decoded) {
                  setScannedQRPayloadRaw(codes[0].rawValue);
                  setScannerInputCode(decoded.code);
                  stopCamera();
                  showToast(
                    "success",
                    `QR ${decoded.code} terbaca. Klik Cek & Terima Kupon.`
                  );
                }
              }
            } catch {
              // Abaikan error frame sementara
            }
          }, 500);
        }
      }, 150);
    } catch {
      showToast(
        "warning",
        "Kamera tidak bisa dibuka. Pilih kupon di daftar cepat atau ketik kodenya langsung."
      );
    }
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
      setShowAddResidentForm(false);
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
      setShowAddMerchantForm(false);
      showToast("success", `${data.merchant.name} berhasil didaftarkan.`);
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal menyimpan data kedai"
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

  const handleVerifyAndRedeem = async (simulateTamperFraud = false) => {
    const t0 = performance.now();
    const merchant =
      merchants.find((m) => m.id === activeMerchantId) || merchants[0];
    if (!merchant) {
      showToast("error", "Pilih kedai yang sedang melayani.");
      return;
    }

    let targetVoucher: Voucher | null = null;
    const decodedQR = scannedQRPayloadRaw
      ? decodeVoucherQRPayload(scannedQRPayloadRaw)
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
    } else if (scannerInputCode.trim()) {
      const cleanCode = scannerInputCode.trim().toUpperCase();
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
      }
    } catch {
      const fallback = await buildClientFallbackState();
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
        label: "Beranda Pengurus",
        section: "OPERATIONS",
        icon: LayoutGrid,
        roles: ["COORDINATOR"],
      },
      {
        id: "BENEFICIARY",
        label: "Kupon Warga",
        section: "OPERATIONS",
        icon: QrCode,
        roles: ["COORDINATOR", "BENEFICIARY"],
      },
      {
        id: "MERCHANT_POS",
        label: "Kasir Kedai",
        section: "OPERATIONS",
        icon: ScanLine,
        badge: offlineQueue.length,
        roles: ["COORDINATOR", "MERCHANT"],
      },
      {
        id: "CLEARINGHOUSE",
        label: "Pencairan & Riwayat",
        section: "CLEARINGHOUSE",
        icon: Landmark,
        roles: ["COORDINATOR", "MERCHANT"],
      },
      {
        id: "REPORTS",
        label: "Laporan Bansos",
        section: "CLEARINGHOUSE",
        icon: BarChart3,
        roles: ["COORDINATOR"],
      },
      {
        id: "GUIDE",
        label: "Cara Pakai",
        section: "CLEARINGHOUSE",
        icon: BookOpen,
        roles: ["COORDINATOR", "MERCHANT", "BENEFICIARY"],
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
        Memuat halaman...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        theme={theme}
        largeText={largeText}
        onToggleTheme={updateTheme}
        onToggleLargeText={updateLargeText}
        onAuthenticated={(user) => {
          applyAuthenticatedUser(user);
          showToast("success", `Halo, ${user.name} (${user.role_label}).`);
        }}
      />
    );
  }

  const opsNav = navItems.filter((i) => i.section === "OPERATIONS");
  const clearNav = navItems.filter((i) => i.section === "CLEARINGHOUSE");

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen flex bg-canvas text-ink-body"
    >
      {/* ==================== SIDEBAR KIRI (DESKTOP) ==================== */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-surface border-r border-line/70 z-30 select-none">
        <div className="h-16 px-4 flex items-center justify-between border-b border-line/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cta-bg text-cta-ink flex items-center justify-center shrink-0 shadow-sm">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-[15px] tracking-[-0.015em] text-ink-primary block leading-tight">
                CivicLedger
              </span>
              <span className="text-[11px] text-ink-muted">Kupon Sembako</span>
            </div>
          </div>
        </div>

        {/* Profil Akun */}
        <div className="p-3.5 border-b border-line/50 bg-nested/45">
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
        </div>

        {/* Navigasi */}
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

        {/* Kontrol Bawah */}
        <div className="p-3.5 border-t border-line/60 bg-surface space-y-2.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
              <span className="font-medium">Sinyal</span>
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
              <span className="font-medium">Huruf</span>
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
                  Besar
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-line/40 pt-2 space-y-1 text-[11px] text-ink-muted">
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
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="no-print sticky top-0 z-20 h-16 bg-surface/92 backdrop-blur-md border-b border-line/60 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="lg:hidden w-8 h-8 rounded-xl bg-cta-bg text-cta-ink flex items-center justify-center shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-[15px] font-bold tracking-[-0.015em] text-ink-primary truncate">
                {TAB_META[activeTab].title}
              </div>
              <div className="hidden sm:block text-xs text-ink-muted truncate">
                {TAB_META[activeTab].subtitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {offlineQueue.length > 0 && (
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
              Data Simulasi
            </span>

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
          </div>
        </header>

        {/* Tab Mobile */}
        <div className="no-print lg:hidden border-b border-line/60 bg-surface px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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
              {offlineQueue.length > 0 && (
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
            {loading ? (
              <div className="py-20 text-center text-sm text-ink-muted">
                Memuat data bansos...
              </div>
            ) : (
              <>
                {/* ============================================================
                    TAB 1: BERANDA PENGURUS
                   ============================================================ */}
                {activeTab === "COORDINATOR" && (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-emeraldTech">
                          {currentUser.name} · {currentUser.role_label}
                        </p>
                        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary mt-0.5">
                          Ringkasan Penyaluran Bansos
                        </h1>
                        <p className="text-sm text-ink-secondary mt-0.5">
                          Lihat sisa dana, daftar {beneficiaries.length} warga
                          penerima, dan buat kupon sembako.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-line/70 shadow-sm text-xs font-semibold text-ink-primary self-start md:self-auto">
                        <span
                          className={`w-2 h-2 rounded-full ${isOfflineMode
                              ? "bg-amberTech"
                              : "bg-emeraldTech animate-pulse"
                            }`}
                        />
                        {isOfflineMode
                          ? "Offline · Tersimpan di HP"
                          : "Online · Terhubung"}
                      </span>
                    </div>

                    {/* 4 Kartu Ringkasan */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-secondary">
                            Sisa Dana Bansos
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
                            <Wallet className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
                            {formatRupiah(poolTotalIdr)}
                          </p>
                          <p className="text-xs text-ink-muted mt-1">
                            Khusus untuk paket sembako
                          </p>
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-secondary">
                            Kupon Siap Pakai
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
                            <Ticket className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
                            {activeVouchersCount}
                          </p>
                          <p className="text-xs text-ink-muted mt-1 tabular-nums">
                            Dari {vouchers.length} kupon dibuat
                          </p>
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-secondary">
                            Belanja di Kedai
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-amberTech/12 text-amberTech flex items-center justify-center">
                            <Store className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
                            {formatRupiah(totalWarungTurnover)}
                          </p>
                          <p className="text-xs text-ink-muted mt-1 tabular-nums">
                            {merchants.length} kedai mitra terdaftar
                          </p>
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-5 flex flex-col justify-between gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-secondary">
                            Penerima Bansos
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-emeraldTech/12 text-emeraldTech flex items-center justify-center">
                            <UserCheck className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink-primary">
                            {beneficiaries.length} Orang
                          </p>
                          <p
                            className={`text-xs mt-1 flex items-center gap-1.5 font-medium tabular-nums ${fraudBlockedCount > 0
                                ? "text-amberTech"
                                : "text-emeraldTech"
                              }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${fraudBlockedCount > 0
                                  ? "bg-amberTech"
                                  : "bg-emeraldTech"
                                }`}
                            />
                            {fraudBlockedCount} kupon bermasalah ditolak
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2-Column Workspace (5 : 7) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* LEFT PANEL: Buat Kupon */}
                      <div className="lg:col-span-5 bg-card rounded-2xl border border-line/75 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-line/50 flex items-center justify-between gap-2 bg-surface/60">
                          <div>
                            <h2 className="text-base font-bold text-ink-primary">
                              Buat Kupon Sembako
                            </h2>
                            <p className="text-xs text-ink-muted mt-0.5">
                              Pilih nama penerima dan paket sembakonya
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddResidentForm(!showAddResidentForm);
                                setShowAddMerchantForm(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-nested hover:bg-elevated border border-line/60 text-xs font-semibold text-ink-primary transition"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-emeraldTech" />
                              + Warga
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddMerchantForm(!showAddMerchantForm);
                                setShowAddResidentForm(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-nested hover:bg-elevated border border-line/60 text-xs font-semibold text-ink-primary transition"
                            >
                              <Store className="w-3.5 h-3.5 text-amberTech" />
                              + Kedai
                            </button>
                          </div>
                        </div>

                        <div className="p-5 space-y-4">
                          {showAddResidentForm && (
                            <form
                              onSubmit={handleAddBeneficiary}
                              className="p-4 rounded-xl bg-nested/60 border border-line/70 space-y-3"
                            >
                              <p className="text-sm font-bold text-ink-primary">
                                Tambah Penerima Baru
                              </p>
                              <input
                                type="text"
                                required
                                placeholder="Nama lengkap (misal: Mangasi Simatupang)"
                                value={newResidentName}
                                onChange={(e) =>
                                  setNewResidentName(e.target.value)
                                }
                                className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={newResidentRtRw}
                                  onChange={(e) =>
                                    setNewResidentRtRw(e.target.value)
                                  }
                                  placeholder="Desa / Kecamatan"
                                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                                />
                                <input
                                  type="text"
                                  value={newResidentCategory}
                                  onChange={(e) =>
                                    setNewResidentCategory(e.target.value)
                                  }
                                  placeholder="Kategori"
                                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                                />
                              </div>
                              <input
                                type="text"
                                value={newResidentPhone}
                                onChange={(e) =>
                                  setNewResidentPhone(e.target.value)
                                }
                                placeholder="Nomor HP"
                                className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                              />
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setShowAddResidentForm(false)}
                                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink-primary"
                                >
                                  Batal
                                </button>
                                <button
                                  type="submit"
                                  className="px-4 py-2 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold"
                                >
                                  Simpan
                                </button>
                              </div>
                            </form>
                          )}

                          {showAddMerchantForm && (
                            <form
                              onSubmit={handleAddMerchant}
                              className="p-4 rounded-xl bg-nested/60 border border-line/70 space-y-3"
                            >
                              <p className="text-sm font-bold text-ink-primary">
                                Tambah Kedai Mitra
                              </p>
                              <input
                                type="text"
                                required
                                placeholder="Nama kedai (misal: Kedai Sembako Balige)"
                                value={newMerchantName}
                                onChange={(e) =>
                                  setNewMerchantName(e.target.value)
                                }
                                className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  required
                                  placeholder="Nama pemilik"
                                  value={newMerchantOwner}
                                  onChange={(e) =>
                                    setNewMerchantOwner(e.target.value)
                                  }
                                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                                />
                                <input
                                  type="text"
                                  value={newMerchantRtRw}
                                  onChange={(e) =>
                                    setNewMerchantRtRw(e.target.value)
                                  }
                                  placeholder="Alamat kedai"
                                  className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                                />
                              </div>
                              <input
                                type="text"
                                value={newMerchantBank}
                                onChange={(e) =>
                                  setNewMerchantBank(e.target.value)
                                }
                                placeholder="Rekening / QRIS"
                                className="w-full h-11 px-3.5 rounded-xl bg-card border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                              />
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setShowAddMerchantForm(false)}
                                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink-primary"
                                >
                                  Batal
                                </button>
                                <button
                                  type="submit"
                                  className="px-4 py-2 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold"
                                >
                                  Simpan
                                </button>
                              </div>
                            </form>
                          )}

                          <form
                            onSubmit={handleIssueVoucher}
                            className="space-y-4"
                          >
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-ink-primary">
                                1. Nama Penerima ({beneficiaries.length} warga)
                              </label>
                              <div className="relative">
                                <select
                                  value={selectedBeneficiaryId}
                                  onChange={(e) =>
                                    setSelectedBeneficiaryId(e.target.value)
                                  }
                                  className="w-full h-11 px-3.5 pr-9 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary appearance-none outline-none cursor-pointer"
                                >
                                  {beneficiaries.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name} — {b.rt_rw}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-ink-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-ink-primary">
                                2. Paket Sembako
                              </label>
                              <div className="space-y-2">
                                {catalog.map((item) => {
                                  const selected =
                                    selectedCommodityCode === item.code;
                                  return (
                                    <label
                                      key={item.code}
                                      className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${selected
                                          ? "bg-emeraldTech/8 border-cta-bg"
                                          : "bg-surface border-line/60 hover:border-line hover:bg-nested/40"
                                        }`}
                                    >
                                      <div className="flex items-start gap-2.5 min-w-0">
                                        <input
                                          type="radio"
                                          name="commodity"
                                          value={item.code}
                                          checked={selected}
                                          onChange={() =>
                                            setSelectedCommodityCode(item.code)
                                          }
                                          className="mt-1 w-4 h-4 accent-cta-bg cursor-pointer"
                                        />
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-ink-primary leading-snug">
                                            {item.name}
                                          </p>
                                          <p className="text-xs text-ink-secondary mt-0.5 leading-snug">
                                            {item.items}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="font-mono text-sm font-bold text-emeraldTech tabular-nums shrink-0">
                                        {formatRupiah(item.nominal_idr)}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-ink-primary">
                                3. Masa Berlaku Kupon
                              </label>
                              <div className="relative">
                                <select
                                  value={validityHours}
                                  onChange={(e) =>
                                    setValidityHours(Number(e.target.value))
                                  }
                                  className="w-full h-11 px-3.5 pr-9 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary appearance-none outline-none cursor-pointer"
                                >
                                  <option value={24}>1 Hari (24 Jam)</option>
                                  <option value={72}>3 Hari (72 Jam)</option>
                                  <option value={168}>7 Hari</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-ink-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            <button
                              type="submit"
                              className="w-full h-12 px-4 rounded-xl bg-cta-bg hover:opacity-90 active:scale-[0.99] text-cta-ink font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                              Buat Kupon Sembako
                            </button>

                            <p className="text-xs text-ink-secondary flex items-start gap-2 leading-relaxed">
                              <ShieldCheck className="w-4 h-4 text-emeraldTech shrink-0 mt-0.5" />
                              <span>
                                Kupon diberi kode unik agar tidak bisa dipalsukan
                                dan bisa dicek saat kedai offline.
                              </span>
                            </p>
                          </form>
                        </div>
                      </div>

                      {/* RIGHT PANEL: Switcher Daftar Kupon & Daftar 20 Penerima */}
                      <div className="lg:col-span-7 bg-card rounded-2xl border border-line/75 shadow-sm flex flex-col overflow-hidden">
                        {/* Top View Switcher */}
                        <div className="p-4 border-b border-line/50 bg-surface/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="inline-flex bg-nested p-1 rounded-xl border border-line/50 self-start">
                            <button
                              type="button"
                              onClick={() =>
                                setCoordinatorRightView("VOUCHERS")
                              }
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${coordinatorRightView === "VOUCHERS"
                                  ? "bg-card text-ink-primary shadow-sm"
                                  : "text-ink-muted hover:text-ink-primary"
                                }`}
                            >
                              Daftar Kupon ({vouchers.length})
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCoordinatorRightView("BENEFICIARIES")
                              }
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${coordinatorRightView === "BENEFICIARIES"
                                  ? "bg-card text-ink-primary shadow-sm"
                                  : "text-ink-muted hover:text-ink-primary"
                                }`}
                            >
                              Daftar Penerima ({beneficiaries.length})
                            </button>
                          </div>

                          {coordinatorRightView === "VOUCHERS" && (
                            <div className="flex bg-nested p-1 rounded-xl border border-line/50 shrink-0 self-start sm:self-auto">
                              {(
                                [
                                  { id: "ALL", label: "Semua" },
                                  { id: "ACTIVE", label: "Siap Pakai" },
                                  { id: "REDEEMED", label: "Dipakai" },
                                  { id: "SETTLED", label: "Cair" },
                                ] as const
                              ).map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => setVoucherStatusFilter(st.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${voucherStatusFilter === st.id
                                      ? "bg-card text-ink-primary shadow-sm"
                                      : "text-ink-muted hover:text-ink-primary"
                                    }`}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {coordinatorRightView === "VOUCHERS" ? (
                          <>
                            <div className="p-3.5 bg-surface/40 border-b border-line/45">
                              <div className="relative">
                                <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={voucherSearch}
                                  onChange={(e) =>
                                    setVoucherSearch(e.target.value)
                                  }
                                  placeholder="Cari kode kupon, nama warga, atau paket..."
                                  className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-card border border-line/70 focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                                />
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-nested/60 border-b border-line/50 text-xs font-semibold text-ink-secondary">
                                    <th className="py-3 px-4">Kode Kupon</th>
                                    <th className="py-3 px-3">Penerima</th>
                                    <th className="py-3 px-3">Paket</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-4 text-right">
                                      Aksi
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line/40 text-sm">
                                  {filteredVouchers.map((v) => (
                                    <tr
                                      key={v.id}
                                      className="hover:bg-nested/40 transition-colors"
                                    >
                                      <td className="py-3.5 px-4 whitespace-nowrap">
                                        <div className="font-mono font-bold text-ink-primary">
                                          {v.short_code}
                                        </div>
                                        <div className="font-mono text-[11px] text-ink-muted">
                                          {v.id}
                                        </div>
                                      </td>
                                      <td className="py-3.5 px-3">
                                        <div className="font-semibold text-ink-primary leading-snug">
                                          {v.beneficiary_name}
                                        </div>
                                        <div className="text-xs text-ink-muted">
                                          {v.rt_rw}
                                        </div>
                                      </td>
                                      <td className="py-3.5 px-3">
                                        <div className="text-ink-body line-clamp-1 font-medium">
                                          {v.commodity_name}
                                        </div>
                                        <div className="font-mono text-xs text-ink-secondary tabular-nums mt-0.5">
                                          {formatRupiah(v.nominal_idr)}
                                        </div>
                                      </td>
                                      <td className="py-3.5 px-3">
                                        <span
                                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${v.status === "ACTIVE"
                                              ? "bg-emeraldTech/12 text-emeraldTech"
                                              : v.status === "REDEEMED"
                                                ? "bg-amberTech/12 text-amberTech"
                                                : "bg-nested text-ink-secondary"
                                            }`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${v.status === "ACTIVE"
                                                ? "bg-emeraldTech"
                                                : v.status === "REDEEMED"
                                                  ? "bg-amberTech"
                                                  : "bg-ink-muted"
                                              }`}
                                          />
                                          {formatStatusLabel(v.status)}
                                        </span>
                                        {v.redeemed_by_merchant_name && (
                                          <div className="text-[11px] text-ink-muted mt-1 max-w-[180px] truncate">
                                            {v.redeemed_by_merchant_name}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setWalletBeneficiaryId(
                                                v.beneficiary_id
                                              );
                                              setSelectedVoucherForQR(v);
                                              setActiveTab("BENEFICIARY");
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-nested hover:bg-elevated text-ink-primary border border-line/60 text-xs font-semibold transition"
                                          >
                                            Kartu
                                          </button>
                                          {v.status === "ACTIVE" && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                sendVoucherToMerchantScanner(v)
                                              }
                                              className="px-3 py-1.5 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold transition"
                                            >
                                              Tukar
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                  {filteredVouchers.length === 0 && (
                                    <tr>
                                      <td
                                        colSpan={5}
                                        className="py-10 text-center text-ink-muted text-sm"
                                      >
                                        Tidak ada kupon yang cocok.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="px-4 py-3 bg-surface/60 border-t border-line/45 flex items-center justify-between text-xs text-ink-muted">
                              <span className="tabular-nums">
                                Menampilkan {filteredVouchers.length} dari{" "}
                                {vouchers.length} kupon
                              </span>
                              <span className="font-semibold text-emeraldTech">
                                Kupon Sembako
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="p-3.5 bg-surface/40 border-b border-line/45">
                              <div className="relative">
                                <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={beneficiarySearch}
                                  onChange={(e) =>
                                    setBeneficiarySearch(e.target.value)
                                  }
                                  placeholder="Cari nama warga, desa, atau kategori..."
                                  className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-card border border-line/70 focus:border-cta-bg text-sm text-ink-primary placeholder:text-ink-muted outline-none"
                                />
                              </div>
                            </div>

                            <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                              <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10">
                                  <tr className="bg-nested border-b border-line/50 text-xs font-semibold text-ink-secondary">
                                    <th className="py-3 px-4">No / ID</th>
                                    <th className="py-3 px-3">Nama &amp; Desa</th>
                                    <th className="py-3 px-3">Kategori</th>
                                    <th className="py-3 px-3 text-center">
                                      Kupon
                                    </th>
                                    <th className="py-3 px-4 text-right">
                                      Aksi
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line/40 text-sm">
                                  {filteredBeneficiaries.map((b, idx) => {
                                    const countVouchers = vouchers.filter(
                                      (v) => v.beneficiary_id === b.id
                                    ).length;
                                    return (
                                      <tr
                                        key={b.id}
                                        className="hover:bg-nested/40 transition-colors"
                                      >
                                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-ink-muted">
                                          <div className="font-bold text-ink-primary">
                                            {idx + 1}. {b.id}
                                          </div>
                                          <div>{b.household_size} org</div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="font-semibold text-ink-primary">
                                            {b.name}
                                          </div>
                                          <div className="text-xs text-ink-muted">
                                            {b.rt_rw} · {b.phone}
                                          </div>
                                        </td>
                                        <td className="py-3 px-3 text-xs text-ink-secondary">
                                          {b.category}
                                        </td>
                                        <td className="py-3 px-3 text-center font-mono text-xs font-bold text-ink-primary">
                                          {countVouchers}
                                        </td>
                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedBeneficiaryId(b.id);
                                              showToast(
                                                "info",
                                                `${b.name} dipilih di form kiri. Pilih paket lalu klik Buat Kupon Sembako.`
                                              );
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-semibold transition"
                                          >
                                            Pilih
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="px-4 py-3 bg-surface/60 border-t border-line/45 flex items-center justify-between text-xs text-ink-muted">
                              <span className="tabular-nums">
                                Total {filteredBeneficiaries.length} dari{" "}
                                {beneficiaries.length} penerima bansos
                              </span>
                              <span className="font-semibold text-emeraldTech">
                                Data Simulasi Komunitas
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================
                    TAB 2: KUPON WARGA
                   ============================================================ */}
                {activeTab === "BENEFICIARY" && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 border-b border-line/55">
                      <div>
                        <p className="text-xs font-semibold text-emeraldTech">
                          {currentUser.name} · Kupon Sembako
                        </p>
                        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary mt-0.5">
                          Kupon Warga
                        </h1>
                        <p className="text-sm text-ink-secondary mt-0.5">
                          Tunjukkan QR di layar HP atau bawa kode kupon yang
                          dicetak ke kedai terdekat.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={fetchClearinghouseState}
                        className="no-print self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card hover:bg-nested text-ink-primary border border-line/70 shadow-sm text-xs font-semibold transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emeraldTech" />
                        Muat Ulang
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="no-print lg:col-span-5 flex flex-col space-y-5">
                        <section className="bg-card border border-line/75 rounded-2xl shadow-sm p-5">
                          <div className="flex items-center justify-between mb-2">
                            <label
                              htmlFor="family-select"
                              className="text-xs font-bold text-ink-primary"
                            >
                              Nama Penerima
                            </label>
                            {currentWalletBeneficiary && (
                              <span className="font-mono text-xs font-semibold text-emeraldTech">
                                {currentWalletBeneficiary.id}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <select
                              id="family-select"
                              value={walletBeneficiaryId}
                              onChange={(e) =>
                                setWalletBeneficiaryId(e.target.value)
                              }
                              className="w-full h-12 px-3.5 pr-9 bg-surface text-ink-primary border border-line rounded-xl appearance-none text-sm font-semibold focus:outline-none focus:border-cta-bg cursor-pointer"
                            >
                              {beneficiaries.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} — {b.rt_rw}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {currentWalletBeneficiary && (
                            <div className="mt-4 pt-4 border-t border-line/45 grid grid-cols-3 gap-3 text-xs">
                              <div>
                                <div className="text-ink-muted">Kategori</div>
                                <div className="text-ink-primary font-semibold mt-0.5 leading-snug">
                                  {currentWalletBeneficiary.category}
                                </div>
                              </div>
                              <div>
                                <div className="text-ink-muted">Keluarga</div>
                                <div className="text-ink-primary font-mono font-bold mt-0.5">
                                  {currentWalletBeneficiary.household_size}{" "}
                                  Orang
                                </div>
                              </div>
                              <div>
                                <div className="text-ink-muted">Siap Pakai</div>
                                <div className="text-emeraldTech font-mono font-bold mt-0.5">
                                  {currentWalletActiveCount} Kupon
                                </div>
                              </div>
                            </div>
                          )}
                        </section>

                        <section className="bg-card border border-line/75 rounded-2xl shadow-sm p-5 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-ink-primary">
                              Kupon Milik Warga
                            </span>
                            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-nested text-ink-primary font-semibold">
                              {currentWalletVouchers.length} Kupon
                            </span>
                          </div>

                          {currentWalletVouchers.length === 0 ? (
                            <p className="py-6 text-center text-sm text-ink-muted">
                              Belum ada kupon untuk warga ini.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {currentWalletVouchers.map((v) => {
                                const isSelected =
                                  selectedVoucherForQR?.id === v.id;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setSelectedVoucherForQR(v)}
                                    className={`relative w-full text-left p-4 rounded-xl transition-all ${isSelected
                                        ? "bg-emeraldTech/8 border-2 border-cta-bg shadow-sm"
                                        : "bg-surface border border-line/60 hover:border-line"
                                      }`}
                                  >
                                    {isSelected && (
                                      <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full bg-cta-bg text-cta-ink font-mono text-[10px] uppercase font-bold tracking-wider">
                                        Dipilih
                                      </span>
                                    )}

                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-mono text-base font-bold tracking-wider text-ink-primary">
                                        {v.short_code}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${v.status === "ACTIVE"
                                            ? "bg-emeraldTech/12 text-emeraldTech"
                                            : "bg-nested text-ink-muted"
                                          }`}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full ${v.status === "ACTIVE"
                                              ? "bg-emeraldTech"
                                              : "bg-ink-muted"
                                            }`}
                                        />
                                        {formatStatusLabel(v.status)}
                                      </span>
                                    </div>

                                    <p className="text-sm font-bold text-ink-primary mt-2">
                                      {v.commodity_name}
                                    </p>
                                    <p className="text-xs text-ink-secondary mt-0.5">
                                      {v.commodity_items}
                                    </p>

                                    <div className="mt-3 pt-2.5 border-t border-line/40 flex items-center justify-between gap-2">
                                      <span className="font-mono text-base font-bold text-emeraldTech tabular-nums">
                                        {formatRupiah(v.nominal_idr)}
                                      </span>
                                      <span className="text-xs text-ink-muted tabular-nums">
                                        s/d {formatDateTime(v.expires_at)}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-start gap-2 pt-1 text-xs text-ink-secondary leading-relaxed">
                            <Info className="w-4 h-4 text-emeraldTech shrink-0 mt-0.5" />
                            <span>
                              Kupon khusus ditukar sembako di kedai mitra dan
                              tidak dapat diuangkan.
                            </span>
                          </div>
                        </section>
                      </div>

                      {/* Kartu Kupon */}
                      <div className="lg:col-span-7 flex flex-col items-center justify-center">
                        {selectedVoucherForQR ? (
                          <div className="w-full max-w-md bg-card border-2 border-line/80 rounded-2xl p-6 flex flex-col relative shadow-md">
                            <div className="hidden sm:block absolute -left-3 top-28 w-6 h-6 rounded-full bg-canvas border-r-2 border-line/80" />
                            <div className="hidden sm:block absolute -right-3 top-28 w-6 h-6 rounded-full bg-canvas border-l-2 border-line/80" />

                            <div className="flex items-center justify-between pb-4 border-b border-dashed border-line">
                              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emeraldTech">
                                <HeartHandshake className="w-4 h-4" />
                                <span>Kupon Sembako Warga</span>
                              </div>
                              <div
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${selectedVoucherForQR.status === "ACTIVE"
                                    ? "bg-emeraldTech/15 text-emeraldTech"
                                    : "bg-nested text-ink-muted"
                                  }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${selectedVoucherForQR.status === "ACTIVE"
                                      ? "bg-emeraldTech"
                                      : "bg-ink-muted"
                                    }`}
                                />
                                {formatStatusLabel(selectedVoucherForQR.status)}
                              </div>
                            </div>

                            <div className="pt-4 pb-2">
                              <h2 className="text-xl font-bold text-ink-primary">
                                {selectedVoucherForQR.beneficiary_name}
                              </h2>
                              <p className="text-sm text-ink-secondary flex items-center gap-1.5 mt-1">
                                <MapPin className="w-4 h-4 text-emeraldTech shrink-0" />
                                <span>{selectedVoucherForQR.rt_rw}</span>
                              </p>
                            </div>

                            <div className="mt-3 p-4 bg-nested/65 border border-line/60 rounded-xl flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-ink-primary">
                                  {selectedVoucherForQR.commodity_name}
                                </p>
                                <p className="text-xs text-ink-secondary mt-0.5">
                                  {selectedVoucherForQR.commodity_items}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[11px] font-semibold text-ink-muted">
                                  Nilai
                                </p>
                                <p className="font-mono text-lg font-bold text-emeraldTech tabular-nums">
                                  {formatRupiah(
                                    selectedVoucherForQR.nominal_idr
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-col items-center">
                              <div className="bg-white p-4 rounded-2xl border-2 border-line/60 flex items-center justify-center w-56 h-56 shadow-sm">
                                {qrDataUrl ? (
                                  <img
                                    src={qrDataUrl}
                                    alt="Kode QR Kupon"
                                    className="w-full h-full block"
                                  />
                                ) : (
                                  <span className="text-xs text-zinc-500">
                                    Membuat QR...
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ink-secondary mt-3 text-center">
                                Tunjukkan QR ini ke pemilik kedai atau sebutkan
                                kodenya:
                              </p>

                              <div className="w-full mt-3 px-4 py-3.5 bg-surface border-2 border-line rounded-xl flex items-center justify-between gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
                                  Kode Kupon
                                </span>
                                <span className="font-mono text-2xl font-bold tracking-[0.14em] text-ink-primary select-all">
                                  {selectedVoucherForQR.short_code}
                                </span>
                              </div>
                            </div>

                            {/* Detail Teknis Juri */}
                            <div className="no-print mt-4 border border-line/60 rounded-xl bg-surface overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowVoucherTechDetails(
                                    !showVoucherTechDetails
                                  )
                                }
                                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-ink-secondary hover:text-ink-primary transition"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <Lock className="w-3.5 h-3.5 text-emeraldTech" />
                                  <span>Detail Teknis (HMAC &amp; Nonce)</span>
                                </span>
                                {showVoucherTechDetails ? (
                                  <ChevronUp className="w-4 h-4 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 shrink-0" />
                                )}
                              </button>
                              {showVoucherTechDetails && (
                                <div className="px-3.5 pb-3 pt-1.5 border-t border-line/45 font-mono text-[11px] space-y-1.5">
                                  <div className="flex justify-between gap-3">
                                    <span className="text-ink-muted">ID</span>
                                    <span className="text-ink-primary">
                                      {selectedVoucherForQR.id}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <span className="text-ink-muted">
                                      NONCE
                                    </span>
                                    <span className="text-ink-primary">
                                      {selectedVoucherForQR.nonce}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <span className="text-ink-muted shrink-0">
                                      HMAC-SHA256
                                    </span>
                                    <span
                                      className="text-ink-secondary truncate"
                                      title={selectedVoucherForQR.hmac_signature}
                                    >
                                      {selectedVoucherForQR.hmac_signature}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="no-print space-y-2.5 mt-5">
                              <div className="grid grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopySmsSlip(selectedVoucherForQR)
                                  }
                                  className="h-11 px-3 rounded-xl bg-nested hover:bg-elevated border border-line/60 text-ink-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                                >
                                  {copiedSms ? (
                                    <>
                                      <Check className="w-4 h-4 text-emeraldTech" />
                                      <span className="text-emeraldTech">
                                        Tersalin
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4 text-ink-muted" />
                                      <span>Salin SMS / WA</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => window.print()}
                                  className="h-11 px-3 rounded-xl bg-nested hover:bg-elevated border border-line/60 text-ink-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                                >
                                  <Printer className="w-4 h-4 text-ink-muted" />
                                  <span>Cetak Kertas</span>
                                </button>
                              </div>

                              {selectedVoucherForQR.status === "ACTIVE" ? (
                                canSwitchToTab("MERCHANT_POS") ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendVoucherToMerchantScanner(
                                        selectedVoucherForQR
                                      )
                                    }
                                    className="w-full h-12 px-4 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm"
                                  >
                                    <span>Tukar di Kasir Kedai</span>
                                    <ArrowUpRight className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <div className="p-3.5 rounded-xl bg-emeraldTech/10 border border-emeraldTech/30 text-center text-xs text-emeraldTech font-semibold">
                                    Kupon aktif. Bawa HP atau hasil cetak ini ke
                                    kedai mitra terdekat.
                                  </div>
                                )
                              ) : (
                                <div className="p-3.5 rounded-xl bg-nested border border-line/60 text-center text-xs text-ink-secondary">
                                  Sudah ditukar di{" "}
                                  <strong className="text-ink-primary">
                                    {
                                      selectedVoucherForQR.redeemed_by_merchant_name
                                    }
                                  </strong>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full max-w-md bg-card rounded-2xl border border-line/70 p-12 text-center text-ink-muted text-sm">
                            Warga ini belum memiliki kupon sembako.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================
                    TAB 3: KASIR KEDAI
                   ============================================================ */}
                {activeTab === "MERCHANT_POS" && (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    <div className="xl:col-span-6 flex flex-col gap-4">
                      <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 flex flex-col gap-5">
                        <div className="flex items-start justify-between gap-3 pb-4 border-b border-line/50">
                          <div>
                            <h2 className="text-base font-bold text-ink-primary flex items-center gap-2">
                              <ScanLine className="w-5 h-5 text-emeraldTech" />
                              Terima Kupon Warga
                            </h2>
                            <p className="text-xs text-ink-secondary mt-1">
                              Scan QR warga atau ketik kode kuponnya. Bisa
                              dipakai saat offline.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={toggleCamera}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-nested hover:bg-elevated text-ink-primary border border-line/60 text-xs font-semibold shrink-0 transition"
                          >
                            {cameraActive ? (
                              <>
                                <CameraOff className="w-4 h-4 text-ink-muted" />
                                <span>Tutup Kamera</span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-4 h-4 text-emeraldTech" />
                                <span>Scan Kamera</span>
                              </>
                            )}
                          </button>
                        </div>

                        {cameraActive && (
                          <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-line">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-44 h-44 border border-dashed border-emeraldTech/80 relative flex items-center justify-center rounded-lg">
                                <span className="px-2.5 py-1 rounded bg-black/75 font-mono text-[10px] text-white uppercase tracking-wider">
                                  Arahkan ke QR
                                </span>
                              </div>
                            </div>
                            <div className="absolute bottom-2.5 left-3 px-2.5 py-1 rounded-lg bg-black/75 text-[11px] text-white">
                              {cameraDetectSupported
                                ? "Pembaca QR aktif"
                                : "Kamera aktif"}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-ink-primary">
                            1. Pilih Kedai
                          </label>
                          <div className="relative">
                            <select
                              value={activeMerchantId}
                              onChange={(e) =>
                                setActiveMerchantId(e.target.value)
                              }
                              className="w-full h-12 px-3.5 pr-9 bg-surface text-ink-primary border border-line rounded-xl appearance-none text-sm font-semibold focus:outline-none focus:border-cta-bg cursor-pointer"
                            >
                              {merchants.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.owner}) · Belum Cair{" "}
                                  {formatRupiah(m.unsettled_balance_idr)}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink-primary">
                              2. Pilih Cepat Kupon
                            </span>
                            <span className="font-mono text-xs text-ink-muted tabular-nums">
                              {vouchers.length} kupon
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {vouchers.map((v) => {
                              const selected =
                                scannerInputCode === v.short_code;
                              const isActive = v.status === "ACTIVE";
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => {
                                    setScannerInputCode(v.short_code);
                                    setScannedQRPayloadRaw(
                                      encodeVoucherToQRPayload(v)
                                    );
                                    setCryptoTrace(null);
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border transition ${selected
                                      ? "bg-cta-bg text-cta-ink border-cta-bg font-bold shadow-sm"
                                      : isActive
                                        ? "bg-surface hover:bg-nested text-ink-primary border-line/70 font-semibold"
                                        : "bg-nested/50 text-ink-muted border-line/40 opacity-85 hover:opacity-100"
                                    }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${selected
                                        ? "bg-cta-ink"
                                        : isActive
                                          ? "bg-emeraldTech"
                                          : "bg-ink-muted"
                                      }`}
                                  />
                                  <span>{v.short_code}</span>
                                  <span
                                    className={`text-[11px] font-sans ${selected
                                        ? "text-cta-ink/90"
                                        : "text-ink-muted"
                                      }`}
                                  >
                                    · {formatStatusLabel(v.status)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-ink-primary">
                              3. Kode Kupon
                            </label>
                            <span className="font-mono text-xs text-ink-muted">
                              Contoh: CL-8841-K9
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={scannerInputCode}
                              onChange={(e) => {
                                setScannerInputCode(
                                  e.target.value.toUpperCase()
                                );
                                setScannedQRPayloadRaw("");
                              }}
                              placeholder="Ketik kode kupon..."
                              className="w-full h-12 px-4 pr-28 rounded-xl bg-surface border-2 border-line focus:border-cta-bg font-mono text-lg font-bold tracking-wider uppercase text-ink-primary placeholder:text-ink-muted/70 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-normal outline-none"
                            />
                            {scannerInputCode.trim().length > 0 && (
                              <span
                                className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2.5 py-1 rounded-full ${isCodeFormatValid
                                    ? "bg-emeraldTech/15 text-emeraldTech"
                                    : "bg-nested text-ink-muted"
                                  }`}
                              >
                                {isCodeFormatValid ? "Cocok" : "Cek Kode"}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleVerifyAndRedeem(false)}
                          className="w-full h-12 rounded-xl bg-cta-bg hover:opacity-90 active:scale-[0.99] text-cta-ink text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm"
                        >
                          <ShieldCheck className="w-5 h-5" />
                          <span>
                            {isOfflineMode
                              ? "Cek & Simpan Offline"
                              : "Cek & Terima Kupon"}
                          </span>
                        </button>

                        <div className="pt-3 border-t border-line/45 space-y-2.5">
                          <p className="text-xs font-bold text-ink-secondary">
                            Simulasi Pengujian
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleVerifyAndRedeem(true)}
                              className="h-11 px-3 rounded-xl bg-roseTech/10 hover:bg-roseTech/18 border border-roseTech/35 text-roseTech text-xs font-bold flex items-center justify-center gap-1.5 transition"
                            >
                              <ShieldAlert className="w-4 h-4" />
                              <span>Tes Kupon Palsu</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleSimulateOfflineConflict}
                              className="h-11 px-3 rounded-xl bg-amberTech/10 hover:bg-amberTech/18 border border-amberTech/35 text-amberTech text-xs font-bold flex items-center justify-center gap-1.5 transition"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              <span>Tes Kupon Ganda</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 3 Kartu Ringkasan */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-4 flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-ink-muted">
                            Antrean Offline
                          </span>
                          <span className="font-mono text-xl font-bold text-ink-primary tabular-nums">
                            {offlineQueue.length}
                          </span>
                          <span
                            className={`text-xs font-semibold ${offlineQueue.length > 0
                                ? "text-amberTech"
                                : "text-emeraldTech"
                              }`}
                          >
                            {offlineQueue.length > 0
                              ? "Belum terkirim"
                              : "Terkirim semua"}
                          </span>
                        </div>
                        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-4 flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-ink-muted">
                            Kupon Ditolak
                          </span>
                          <span className="font-mono text-xl font-bold text-emeraldTech tabular-nums">
                            {fraudBlockedCount}
                          </span>
                          <span className="text-xs text-ink-muted">
                            Palsu / ganda
                          </span>
                        </div>
                        <div className="bg-card rounded-2xl border border-line/70 shadow-sm p-4 flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-ink-muted">
                            Tercatat
                          </span>
                          <span className="font-mono text-xl font-bold text-ink-primary tabular-nums">
                            {ledger.length}
                          </span>
                          <span className="text-xs text-ink-muted">
                            Total transaksi
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="xl:col-span-6 flex flex-col gap-4">
                      <div className="bg-card rounded-2xl border border-line/75 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-line/50 bg-surface/60 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emeraldTech" />
                            <h3 className="text-base font-bold text-ink-primary">
                              Hasil Pengecekan
                            </h3>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isOfflineMode
                                ? "bg-amberTech/12 text-amberTech"
                                : "bg-emeraldTech/12 text-emeraldTech"
                              }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isOfflineMode
                                  ? "bg-amberTech"
                                  : "bg-emeraldTech"
                                }`}
                            />
                            {isOfflineMode ? "Offline" : "Online"}
                          </span>
                        </div>

                        <div className="p-5">
                          {cryptoTrace ? (
                            <div className="space-y-4">
                              {cryptoTrace.hmacValid &&
                                cryptoTrace.doubleSpendCheckPassed ? (
                                <div className="p-4 rounded-xl bg-emeraldTech/10 border-2 border-emeraldTech/40 space-y-2">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cta-bg text-cta-ink text-xs font-bold uppercase">
                                      <CheckCircle2 className="w-4 h-4" />
                                      {cryptoTrace.mode === "OFFLINE_INDEXEDDB"
                                        ? "Kupon Sah · Simpan Offline"
                                        : "Kupon Sah"}
                                    </span>
                                    <span className="font-mono text-xs text-ink-secondary tabular-nums">
                                      {cryptoTrace.durationMs} ms
                                    </span>
                                  </div>
                                  <p className="text-sm text-ink-primary leading-relaxed">
                                    Kupon cocok. Barang:{" "}
                                    <strong>{cryptoTrace.commodityName}</strong>{" "}
                                    ({formatRupiah(cryptoTrace.nominalIdr)})
                                    untuk{" "}
                                    <strong>
                                      {cryptoTrace.beneficiaryName}
                                    </strong>
                                    .
                                  </p>
                                  <p className="text-xs text-ink-secondary">
                                    {cryptoTrace.mode === "OFFLINE_INDEXEDDB"
                                      ? "Catatan disimpan di HP. Kirim ke pusat saat sinyal ada."
                                      : "Saldo kedai bertambah otomatis."}
                                  </p>
                                </div>
                              ) : (
                                <div className="p-4 rounded-xl bg-roseTech/10 border-2 border-roseTech/45 space-y-2">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-roseTech text-white text-xs font-bold uppercase">
                                      <ShieldAlert className="w-4 h-4" />
                                      {!cryptoTrace.hmacValid
                                        ? "Kupon Ditolak (Palsu)"
                                        : "Kupon Ditolak (Sudah Dipakai)"}
                                    </span>
                                    <span className="font-mono text-xs text-ink-secondary tabular-nums">
                                      {cryptoTrace.durationMs} ms
                                    </span>
                                  </div>
                                  <p className="text-sm text-roseTech leading-relaxed font-semibold">
                                    Kupon ditolak. {cryptoTrace.errorReason}
                                  </p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                <div className="p-3 rounded-xl bg-surface border border-line/60">
                                  <p className="text-ink-muted">Keaslian</p>
                                  <p
                                    className={`font-bold mt-0.5 ${cryptoTrace.hmacValid
                                        ? "text-emeraldTech"
                                        : "text-roseTech"
                                      }`}
                                  >
                                    {cryptoTrace.hmacValid
                                      ? "Asli"
                                      : "Tidak Cocok"}
                                  </p>
                                </div>
                                <div className="p-3 rounded-xl bg-surface border border-line/60">
                                  <p className="text-ink-muted">Pemakaian</p>
                                  <p
                                    className={`font-bold mt-0.5 ${cryptoTrace.doubleSpendCheckPassed
                                        ? "text-emeraldTech"
                                        : "text-roseTech"
                                      }`}
                                  >
                                    {cryptoTrace.doubleSpendCheckPassed
                                      ? "Belum Dipakai"
                                      : "Sudah Dipakai"}
                                  </p>
                                </div>
                                <div className="p-3 rounded-xl bg-surface border border-line/60">
                                  <p className="text-ink-muted">Masa Berlaku</p>
                                  <p
                                    className={`font-bold mt-0.5 ${cryptoTrace.expiryCheckPassed
                                        ? "text-emeraldTech"
                                        : "text-roseTech"
                                      }`}
                                  >
                                    {cryptoTrace.expiryCheckPassed
                                      ? "Berlaku"
                                      : "Habis"}
                                  </p>
                                </div>
                              </div>

                              <div className="border border-line/60 rounded-xl bg-surface overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowVerifierTechDetails(
                                      !showVerifierTechDetails
                                    )
                                  }
                                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-ink-secondary hover:text-ink-primary transition"
                                >
                                  <span className="font-mono text-[11px]">
                                    Detail Teknis (Web Crypto HMAC-SHA256)
                                  </span>
                                  {showVerifierTechDetails ? (
                                    <ChevronUp className="w-4 h-4 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 shrink-0" />
                                  )}
                                </button>

                                {showVerifierTechDetails && (
                                  <div className="px-3.5 pb-3.5 pt-2 border-t border-line/45 font-mono text-[11px] space-y-2 text-ink-secondary">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-ink-muted shrink-0">
                                        CLIENT_TX_ID
                                      </span>
                                      <span className="text-ink-primary truncate">
                                        {cryptoTrace.clientTxId}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-ink-muted shrink-0">
                                        PAYLOAD
                                      </span>
                                      <span className="truncate">
                                        {cryptoTrace.canonicalMessage}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-ink-muted shrink-0">
                                        SIG_KUPON
                                      </span>
                                      <span className="truncate">
                                        {cryptoTrace.providedSignature}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-ink-muted shrink-0">
                                        HMAC_HITUNG
                                      </span>
                                      <span
                                        className={`truncate ${cryptoTrace.hmacValid
                                            ? "text-emeraldTech"
                                            : "text-roseTech"
                                          }`}
                                      >
                                        {cryptoTrace.computedSignature}
                                      </span>
                                    </div>
                                    {cryptoTrace.receiptHash && (
                                      <div className="flex justify-between gap-4 pt-1.5 border-t border-line/40">
                                        <span className="text-ink-muted shrink-0">
                                          STRUK_SHA256
                                        </span>
                                        <span className="text-ink-primary truncate">
                                          {cryptoTrace.receiptHash}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="py-8 px-4 text-center bg-surface rounded-xl border border-line/50 space-y-2">
                              <ShieldCheck className="w-7 h-7 text-emeraldTech mx-auto" />
                              <p className="text-sm font-bold text-ink-primary">
                                Belum ada kupon yang dicek
                              </p>
                              <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                                Pilih atau ketik kode kupon di kiri, lalu klik{" "}
                                <strong className="text-ink-primary">
                                  Cek &amp; Terima Kupon
                                </strong>
                                .
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Antrean Offline */}
                      <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 space-y-3.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-ink-primary">
                              Catatan Offline di HP
                            </h3>
                            <span
                              className={`font-mono text-xs px-2.5 py-0.5 rounded-full tabular-nums font-semibold ${offlineQueue.length > 0
                                  ? "bg-amberTech/15 text-amberTech"
                                  : "bg-nested text-ink-secondary"
                                }`}
                            >
                              {offlineQueue.length} Antrean
                            </span>
                          </div>
                          {offlineQueue.length > 0 && (
                            <button
                              type="button"
                              onClick={handleSyncOfflineBatch}
                              disabled={isSyncingBatch}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold transition shadow-sm"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                              />
                              <span>Kirim Semua ke Pusat</span>
                            </button>
                          )}
                        </div>

                        {offlineQueue.length === 0 ? (
                          <div className="bg-surface border border-line/50 rounded-xl p-5 text-center flex flex-col items-center gap-1.5">
                            <CheckCircle2 className="w-6 h-6 text-emeraldTech" />
                            <p className="text-sm font-semibold text-ink-primary">
                              Antrean kosong.
                            </p>
                            <p className="text-xs text-ink-secondary">
                              Ubah tombol{" "}
                              <strong className="text-ink-primary">
                                Sinyal
                              </strong>{" "}
                              di kiri menjadi{" "}
                              <strong className="text-ink-primary">
                                Offline
                              </strong>{" "}
                              untuk mencoba transaksi tanpa internet.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-56 overflow-y-auto">
                            {offlineQueue.map((item) => (
                              <div
                                key={item.queue_id}
                                className="p-3.5 rounded-xl bg-surface border border-line/60 border-l-4 border-l-amberTech flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-sm font-bold text-ink-primary">
                                      {item.short_code}
                                    </span>
                                    {item.is_simulated_conflict && (
                                      <span className="px-2 py-0.5 rounded-full bg-roseTech/15 text-roseTech font-mono text-[10px] font-bold">
                                        TES GANDA
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-ink-secondary mt-0.5 truncate">
                                    {item.merchant_name} ·{" "}
                                    {formatShortTime(item.redeemed_at)} WIB
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-mono text-sm font-bold text-ink-primary tabular-nums">
                                    {formatRupiah(item.nominal_idr)}
                                  </p>
                                  <span className="text-[11px] font-semibold text-amberTech">
                                    Menunggu sinyal
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Aktivitas Terbaru */}
                      <div className="bg-card rounded-2xl border border-line/75 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-line/50 bg-surface/60 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-ink-primary">
                            {lastSyncResults && lastSyncResults.length > 0
                              ? "Hasil Kirim Offline"
                              : "Transaksi Terbaru"}
                          </h3>
                          {lastSyncResults && lastSyncResults.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setLastSyncResults(null)}
                              className="text-xs font-semibold text-ink-muted hover:text-ink-primary"
                            >
                              Tutup
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-emeraldTech">
                              Terbaru
                            </span>
                          )}
                        </div>

                        <div className="divide-y divide-line/40">
                          {lastSyncResults && lastSyncResults.length > 0 ? (
                            lastSyncResults.map((r) => (
                              <div
                                key={r.client_tx_id}
                                className="p-4 flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${r.status === "SYNCED"
                                          ? "bg-emeraldTech/15 text-emeraldTech"
                                          : "bg-roseTech/15 text-roseTech"
                                        }`}
                                    >
                                      {formatOutcomeLabel(r.outcome)}
                                    </span>
                                    <span className="font-mono text-xs font-bold text-ink-primary">
                                      {r.short_code}
                                    </span>
                                  </div>
                                  <p className="text-xs text-ink-secondary leading-relaxed">
                                    {r.reason}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : ledger.length === 0 ? (
                            <p className="p-5 text-center text-xs text-ink-muted">
                              Belum ada transaksi.
                            </p>
                          ) : (
                            ledger.slice(0, 3).map((entry) => (
                              <div
                                key={entry.id}
                                className="p-4 flex items-center justify-between gap-3 hover:bg-nested/40 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold shrink-0 ${entry.sync_mode === "OFFLINE_BATCH_SYNC"
                                        ? "bg-amberTech/15 text-amberTech"
                                        : "bg-emeraldTech/15 text-emeraldTech"
                                      }`}
                                  >
                                    {entry.sync_mode === "OFFLINE_BATCH_SYNC"
                                      ? "Offline"
                                      : "Online"}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-mono text-xs font-bold text-ink-primary truncate">
                                      {entry.short_code} ·{" "}
                                      {formatRupiah(entry.nominal_idr)}
                                    </p>
                                    <p className="text-xs text-ink-secondary truncate">
                                      {entry.merchant_name}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 font-mono text-xs text-ink-muted tabular-nums">
                                  {formatShortTime(entry.timestamp)}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================
                    TAB 4: PENCAIRAN & RIWAYAT
                   ============================================================ */}
                {activeTab === "CLEARINGHOUSE" && (
                  <div className="space-y-7">
                    <section className="space-y-4">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-emeraldTech">
                            Pencairan Kedai · Simulasi Transfer
                          </p>
                          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink-primary mt-0.5">
                            Pencairan Saldo Kedai
                          </h1>
                          <p className="text-sm text-ink-secondary mt-0.5">
                            Cairkan total penukaran kupon ke rekening atau QRIS
                            masing-masing kedai.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-2 px-3.5 py-2 bg-card border border-line/70 rounded-xl shadow-sm text-xs">
                            <span className="w-2 h-2 rounded-full bg-emeraldTech animate-pulse" />
                            <span className="text-ink-secondary">
                              Sisa Dana:{" "}
                              <strong className="font-mono text-ink-primary tabular-nums">
                                {formatRupiah(poolTotalIdr)}
                              </strong>
                            </span>
                          </div>
                          {currentUser.role === "COORDINATOR" && (
                            <button
                              type="button"
                              onClick={() => handleSettleMerchants()}
                              disabled={totalUnsettledIdr === 0}
                              className={`h-11 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition tabular-nums shadow-sm ${totalUnsettledIdr > 0
                                  ? "bg-cta-bg hover:opacity-90 text-cta-ink"
                                  : "bg-nested text-ink-muted border border-line/60 cursor-not-allowed shadow-none"
                                }`}
                            >
                              <Send className="w-4 h-4" />
                              <span>
                                Cairkan Semua ({formatRupiah(totalUnsettledIdr)}
                                )
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {merchants.length === 0 ? (
                        <div className="bg-card border border-line/70 rounded-2xl p-8 text-center text-sm text-ink-muted">
                          Belum ada kedai terdaftar.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                          {merchants.map((m) => {
                            const hasPending = m.unsettled_balance_idr > 0;
                            return (
                              <div
                                key={m.id}
                                className="bg-card border border-line/75 rounded-2xl shadow-sm p-5 flex flex-col justify-between gap-4"
                              >
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-nested text-ink-secondary font-semibold">
                                      {m.id}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${hasPending
                                          ? "bg-emeraldTech/12 text-emeraldTech"
                                          : "bg-nested text-ink-muted"
                                        }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${hasPending
                                            ? "bg-emeraldTech"
                                            : "bg-ink-muted"
                                          }`}
                                      />
                                      {hasPending ? "Siap Cair" : "Lunas"}
                                    </span>
                                  </div>

                                  <div>
                                    <h3 className="text-base font-bold text-ink-primary leading-snug">
                                      {m.name}
                                    </h3>
                                    <p className="text-xs text-ink-secondary mt-0.5">
                                      {m.owner} · {m.rt_rw}
                                    </p>
                                    <p className="font-mono text-xs text-ink-primary mt-2 flex items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-lg border border-line/50">
                                      <Landmark className="w-3.5 h-3.5 text-emeraldTech shrink-0" />
                                      <span className="truncate">
                                        {m.bank_account}
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                <div className="pt-3.5 border-t border-line/45 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-ink-muted">
                                      Kupon Diterima
                                    </span>
                                    <span className="font-mono text-ink-primary font-bold tabular-nums">
                                      {m.redemption_count}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-ink-muted">
                                      Sudah Cair
                                    </span>
                                    <span className="font-mono text-ink-secondary tabular-nums">
                                      {formatRupiah(m.total_settled_idr)}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline justify-between pt-1.5">
                                    <span className="text-xs font-bold text-ink-secondary">
                                      Belum Cair
                                    </span>
                                    <span
                                      className={`font-mono text-lg font-bold tabular-nums ${hasPending
                                          ? "text-emeraldTech"
                                          : "text-ink-muted"
                                        }`}
                                    >
                                      {formatRupiah(m.unsettled_balance_idr)}
                                    </span>
                                  </div>
                                </div>

                                {hasPending &&
                                  currentUser.role === "COORDINATOR" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSettleMerchants(m.id)}
                                    className="w-full h-10 px-4 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Cairkan Saldo</span>
                                  </button>
                                ) : (
                                  <div className="w-full h-10 px-3 rounded-xl bg-surface border border-line/50 text-ink-muted text-xs font-medium flex items-center justify-center text-center">
                                    {hasPending
                                      ? "Menunggu pencairan pengurus"
                                      : "Sudah lunas"}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    {/* Riwayat Penukaran */}
                    <section className="space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-ink-primary">
                            Riwayat Penukaran Kupon
                          </h2>
                          <p className="text-sm text-ink-secondary mt-0.5">
                            Setiap transaksi saling terhubung secara otomatis
                            supaya data tidak bisa diubah.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setShowFullHashes(!showFullHashes)}
                            className="h-10 px-3.5 rounded-xl bg-card hover:bg-nested text-ink-primary border border-line/70 text-xs font-semibold transition"
                          >
                            {showFullHashes
                              ? "Tutup Hash"
                              : "Kode Hash (Juri)"}
                          </button>
                          <button
                            type="button"
                            onClick={handleVerifyHashChain}
                            disabled={isVerifyingChain}
                            className="h-10 px-4 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                          >
                            <ShieldCheck
                              className={`w-4 h-4 ${isVerifyingChain ? "animate-pulse" : ""}`}
                            />
                            <span>
                              {isVerifyingChain
                                ? "Mengecek..."
                                : "Cek Keaslian Data"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div
                        className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 ${chainCheckResult
                            ? chainCheckResult.valid
                              ? "bg-emeraldTech/10 border-emeraldTech/40"
                              : "bg-roseTech/10 border-roseTech/45"
                            : "bg-card border-line/70"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${chainCheckResult
                                ? chainCheckResult.valid
                                  ? "bg-cta-bg text-cta-ink"
                                  : "bg-roseTech text-white"
                                : "bg-nested text-emeraldTech"
                              }`}
                          >
                            {chainCheckResult && !chainCheckResult.valid ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </div>
                          <div className="text-sm min-w-0">
                            {chainCheckResult ? (
                              <span className="text-ink-primary font-semibold">
                                {chainCheckResult.message}
                              </span>
                            ) : (
                              <span className="text-ink-secondary">
                                Ada{" "}
                                <strong className="text-ink-primary">
                                  {ledger.length} transaksi
                                </strong>{" "}
                                tercatat. Klik{" "}
                                <strong className="text-ink-primary">
                                  Cek Keaslian Data
                                </strong>{" "}
                                untuk memastikan catatan belum berubah.
                              </span>
                            )}
                          </div>
                        </div>
                        {chainCheckResult && (
                          <span className="hidden lg:inline-block font-mono text-xs text-ink-muted shrink-0">
                            HEAD: {chainCheckResult.head_hash.slice(0, 14)}...
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto bg-card border border-line/75 rounded-2xl shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-nested/60 border-b border-line/50 text-xs font-semibold text-ink-secondary">
                              <th className="py-3 px-4">No &amp; Waktu</th>
                              <th className="py-3 px-3">Kupon &amp; Paket</th>
                              <th className="py-3 px-3">Kedai</th>
                              <th className="py-3 px-3 text-right">Nilai</th>
                              <th className="py-3 px-3 text-center">Cara</th>
                              {showFullHashes && (
                                <th className="py-3 px-4">
                                  Hash SHA-256 (Prev / Curr)
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/40 text-sm">
                            {ledger.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={showFullHashes ? 6 : 5}
                                  className="py-10 text-center text-ink-muted text-sm"
                                >
                                  Belum ada transaksi.
                                </td>
                              </tr>
                            ) : (
                              ledger.map((entry) => (
                                <tr
                                  key={entry.id}
                                  className="hover:bg-nested/35 transition-colors"
                                >
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <div className="font-mono font-bold text-ink-primary">
                                      {entry.id}
                                    </div>
                                    <div className="text-xs text-ink-muted tabular-nums mt-0.5">
                                      {formatDateTime(entry.timestamp)}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <span className="font-mono text-xs font-bold text-ink-primary bg-nested px-2 py-0.5 rounded-md">
                                      {entry.short_code}
                                    </span>
                                    <div className="text-xs text-ink-secondary mt-1">
                                      {entry.commodity_name}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="text-ink-primary font-semibold">
                                      {entry.merchant_name}
                                    </div>
                                    <div className="text-xs text-ink-muted mt-0.5">
                                      {entry.settlement_batch_id
                                        ? `Cair (${entry.settlement_batch_id})`
                                        : "Belum cair"}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 text-right font-mono font-bold text-ink-primary tabular-nums whitespace-nowrap">
                                    {formatRupiah(entry.nominal_idr)}
                                  </td>
                                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${entry.sync_mode === "OFFLINE_BATCH_SYNC"
                                          ? "bg-amberTech/12 text-amberTech"
                                          : "bg-emeraldTech/12 text-emeraldTech"
                                        }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${entry.sync_mode ===
                                            "OFFLINE_BATCH_SYNC"
                                            ? "bg-amberTech"
                                            : "bg-emeraldTech"
                                          }`}
                                      />
                                      {entry.sync_mode === "OFFLINE_BATCH_SYNC"
                                        ? "Offline"
                                        : "Online"}
                                    </span>
                                  </td>
                                  {showFullHashes && (
                                    <td className="py-3.5 px-4 font-mono text-[11px] max-w-xs">
                                      <div
                                        className="text-ink-muted truncate"
                                        title={entry.prev_hash}
                                      >
                                        P: {entry.prev_hash.slice(0, 18)}...
                                      </div>
                                      <div
                                        className="text-emeraldTech truncate"
                                        title={entry.tx_hash}
                                      >
                                        C: {entry.tx_hash.slice(0, 18)}...
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* 2 Kolom Bawah */}
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 flex flex-col justify-between gap-4">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-ink-primary">
                                Riwayat Sinkron Offline
                              </h3>
                              <p className="text-xs text-ink-secondary mt-0.5">
                                Daftar data yang dikirim dari mode offline dan
                                kupon ganda yang ditolak
                              </p>
                            </div>
                          </div>

                          {reconciliationLogs.length === 0 ? (
                            <p className="py-8 text-center text-sm text-ink-muted">
                              Belum ada catatan sinkronisasi.
                            </p>
                          ) : (
                            <div className="space-y-4 pl-3 border-l-2 border-line/60 max-h-72 overflow-y-auto pr-1">
                              {reconciliationLogs.map((log) => (
                                <div key={log.id} className="relative pl-4">
                                  <span
                                    className={`absolute -left-[19px] top-1.5 w-3 h-3 rounded-full ring-4 ring-card ${log.outcome === "SYNCED"
                                        ? "bg-emeraldTech"
                                        : "bg-roseTech"
                                      }`}
                                  />
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span
                                      className={`text-xs font-bold ${log.outcome === "SYNCED"
                                          ? "text-emeraldTech"
                                          : "text-roseTech"
                                        }`}
                                    >
                                      {formatOutcomeLabel(log.outcome)} ·{" "}
                                      {log.short_code}
                                    </span>
                                    <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                                      {formatDateTime(log.processed_at)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                                    {log.reason}
                                  </p>
                                  <p className="text-[11px] text-ink-muted mt-1">
                                    {log.merchant_name}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-line/45 flex items-center justify-between gap-2 text-xs">
                          <span className="text-ink-muted">
                            {reconciliationLogs.length} catatan
                          </span>
                          <button
                            type="button"
                            onClick={handleExportJson}
                            className="inline-flex items-center gap-1.5 font-bold text-emeraldTech hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh JSON</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-line/75 shadow-sm p-5 flex flex-col justify-between gap-4">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-ink-primary flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-emeraldTech" />
                                Bukti Pencairan Kedai
                              </h3>
                              <p className="text-xs text-ink-secondary mt-0.5">
                                Daftar pencairan yang sudah dicatat (simulasi)
                              </p>
                            </div>
                            <span className="font-mono text-xs font-semibold text-ink-muted">
                              {settlementBatches.length} Bukti
                            </span>
                          </div>

                          {settlementBatches.length === 0 ? (
                            <p className="py-8 text-center text-sm text-ink-muted">
                              Belum ada pencairan.
                            </p>
                          ) : (
                            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                              {settlementBatches.map((b) => (
                                <div
                                  key={b.id}
                                  className="p-3.5 bg-surface border border-line/60 rounded-xl flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-bold text-ink-primary">
                                        {b.id}
                                      </span>
                                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emeraldTech/12 text-emeraldTech">
                                        SELESAI
                                      </span>
                                    </div>
                                    <p className="text-sm text-ink-primary font-semibold truncate">
                                      {b.merchant_name}
                                    </p>
                                    <p className="text-xs text-ink-secondary truncate">
                                      {b.bank_account} ·{" "}
                                      {formatDateTime(b.settled_at)}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-mono text-sm font-bold text-emeraldTech tabular-nums">
                                      {formatRupiah(b.total_amount_idr)}
                                    </p>
                                    <p className="text-xs text-ink-muted tabular-nums">
                                      {b.voucher_count} kupon
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-line/45 flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-ink-secondary tabular-nums">
                            Total Cair:{" "}
                            <strong className="text-ink-primary">
                              {formatRupiah(totalSettledBatchesIdr)}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="no-print inline-flex items-center gap-1.5 font-bold text-ink-primary hover:underline"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak</span>
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
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
                          "Menu ini hanya untuk akun Pengurus. Keluar lalu masuk pakai akun Pengurus."
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
      {showChangePasswordModal && (
        <div
          onClick={() => setShowChangePasswordModal(false)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card border border-line rounded-2xl shadow-xl p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emeraldTech" />
                  Ganti Kata Sandi
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  {currentUser.name} ({currentUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="p-1 text-ink-muted hover:text-ink-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cpError && (
              <div className="p-3 rounded-xl bg-roseTech/10 border border-roseTech/35 text-xs font-semibold text-roseTech">
                {cpError}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-ink-primary">
                  Kata Sandi Lama
                </label>
                <input
                  type={cpShowPass ? "text" : "password"}
                  required
                  value={cpOldPass}
                  onChange={(e) => setCpOldPass(e.target.value)}
                  placeholder="Masukkan kata sandi lama"
                  className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-ink-primary">
                  Kata Sandi Baru (min. 6 karakter)
                </label>
                <div className="relative">
                  <input
                    type={cpShowPass ? "text" : "password"}
                    required
                    minLength={6}
                    value={cpNewPass}
                    onChange={(e) => setCpNewPass(e.target.value)}
                    placeholder="Masukkan kata sandi baru"
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCpShowPass(!cpShowPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
                  >
                    {cpShowPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-ink-primary">
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type={cpShowPass ? "text" : "password"}
                  required
                  minLength={6}
                  value={cpConfirmPass}
                  onChange={(e) => setCpConfirmPass(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full h-11 px-3.5 rounded-xl bg-surface border border-line focus:border-cta-bg text-sm text-ink-primary outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink-primary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cpBusy}
                  className="px-5 py-2.5 rounded-xl bg-cta-bg hover:opacity-90 text-cta-ink text-xs font-bold transition shadow-sm"
                >
                  {cpBusy ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
