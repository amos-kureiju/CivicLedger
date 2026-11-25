"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import {
  LayoutGrid,
  QrCode,
  ScanLine,
  Landmark,
  BarChart3,
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
  AlertTriangle,
  X,
  ArrowUpRight,
  Sun,
  Moon,
  BookOpen,
} from "lucide-react";
import {
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
import ReportsComplianceTab from "@/components/ReportsComplianceTab";
import UserGuideTab from "@/components/UserGuideTab";

type ActiveTab =
  | "COORDINATOR"
  | "BENEFICIARY"
  | "MERCHANT_POS"
  | "CLEARINGHOUSE"
  | "REPORTS"
  | "GUIDE";

type ThemeMode = "dark" | "light";

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
    title: "Konsol Koordinator",
    subtitle:
      "Kelola dana bantuan komunitas, direktori warga/warung, dan penerbitan voucher.",
  },
  BENEFICIARY: {
    title: "Kartu Warga",
    subtitle:
      "Kartu voucher QR kriptografis dan kode cadangan SMS 6-karakter.",
  },
  MERCHANT_POS: {
    title: "Terminal Warung",
    subtitle:
      "Verifikasi browser berkemampuan offline menggunakan Web Crypto API dan IndexedDB.",
  },
  CLEARINGHOUSE: {
    title: "Kliring & Buku Besar",
    subtitle:
      "Antrean pencairan warung, rantai hash SHA-256, dan log rekonsiliasi sinkronisasi.",
  },
  REPORTS: {
    title: "Laporan & Audit",
    subtitle:
      "Analitik penyaluran, ekspor CSV/JSON, dan keterbukaan ruang lingkup STACK 2026.",
  },
  GUIDE: {
    title: "Panduan Pengguna",
    subtitle:
      "Panduan visual langkah demi langkah dan foto referensi untuk setiap fitur.",
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

function formatStatusLabel(status: VoucherStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "REDEEMED":
      return "Ditukar";
    case "SETTLED":
      return "Cair";
    case "EXPIRED":
      return "Kedaluwarsa";
  }
}

export default function CivicLedgerApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("COORDINATOR");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendEngine, setBackendEngine] =
    useState<BackendEngineType>("NEXTJS_FALLBACK");
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "warning" | "error" | "info";
    text: string;
  } | null>(null);

  // State Kliring
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

  // Antrean Offline IndexedDB & Sinkronisasi
  const [offlineQueue, setOfflineQueue] = useState<
    OfflineRedemptionQueueItem[]
  >([]);
  const [isSyncingBatch, setIsSyncingBatch] = useState<boolean>(false);
  const [lastSyncResults, setLastSyncResults] = useState<
    BatchSyncResultItem[] | null
  >(null);

  // Verifikasi Rantai Hash
  const [chainCheckResult, setChainCheckResult] =
    useState<ChainVerificationResult | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState<boolean>(false);

  // Form Koordinator
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedCommodityCode, setSelectedCommodityCode] =
    useState<string>("PKG-BERAS-5KG");
  const [validityHours, setValidityHours] = useState<number>(72);
  const [voucherSearch, setVoucherSearch] = useState<string>("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<
    "ALL" | VoucherStatus
  >("ALL");

  // Form Registrasi Warga & Warung
  const [showAddResidentForm, setShowAddResidentForm] =
    useState<boolean>(false);
  const [newResidentName, setNewResidentName] = useState<string>("");
  const [newResidentRtRw, setNewResidentRtRw] = useState<string>(
    "RT 04 / RW 08 Coblong, Bandung"
  );
  const [newResidentCategory, setNewResidentCategory] = useState<string>(
    "Keluarga Rentan Terverifikasi"
  );
  const [newResidentPhone, setNewResidentPhone] = useState<string>(
    "0812-3456-7890 (SMS / Web Ponsel)"
  );

  const [showAddMerchantForm, setShowAddMerchantForm] =
    useState<boolean>(false);
  const [newMerchantName, setNewMerchantName] = useState<string>("");
  const [newMerchantOwner, setNewMerchantOwner] = useState<string>("");
  const [newMerchantRtRw, setNewMerchantRtRw] = useState<string>(
    "RT 03 / RW 08 Coblong, Bandung"
  );
  const [newMerchantBank, setNewMerchantBank] = useState<string>(
    "BRI Mikro / QRIS •• 5510"
  );

  // State Kartu Warga
  const [walletBeneficiaryId, setWalletBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedVoucherForQR, setSelectedVoucherForQR] =
    useState<Voucher | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedSms, setCopiedSms] = useState<boolean>(false);

  // State Terminal Warung
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("civicledger_theme");
    const initial: ThemeMode = saved === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const updateTheme = (next: ThemeMode) => {
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("civicledger_theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
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
          "Koneksi internet kembali aktif. Sinkronkan antrean offline jika tersedia."
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
      if (!res.ok) throw new Error("Gagal memuat data kliring");
      const data = (await res.json()) as Partial<ClearinghouseState>;

      if (
        !Array.isArray(data.beneficiaries) ||
        data.beneficiaries.length === 0 ||
        !Array.isArray(data.merchants) ||
        data.merchants.length === 0
      ) {
        throw new Error("Payload state API tidak lengkap");
      }

      await applyServerState(data, true);
      const q = await getOfflineRedemptionQueue();
      setOfflineQueue(q);
    } catch {
      const cachedFull = await getCachedFullStateFromIndexedDB();
      if (
        cachedFull &&
        Array.isArray(cachedFull.beneficiaries) &&
        cachedFull.beneficiaries.length > 0 &&
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
        dark: "#09090b",
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
                    `Token QR ${decoded.code} terbaca dari kamera. Siap diverifikasi.`
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
        "Izin kamera tidak tersedia. Pilih voucher di daftar cepat atau ketik kode 6-karakter secara manual."
      );
    }
  };

  // ==================== AKSI UTAMA ====================

  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOfflineMode) {
      showToast(
        "warning",
        "Penerbitan voucher baru memerlukan koneksi. Ubah ke mode Online (Terminal Warung tetap berjalan 100% offline)."
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
      if (!res.ok) throw new Error(data.error || "Gagal menerbitkan voucher");

      await applyServerState(data.state);
      setWalletBeneficiaryId(selectedBeneficiaryId);
      setSelectedVoucherForQR(data.voucher);

      showToast(
        "success",
        `Voucher ${data.voucher.short_code} (${data.voucher.commodity_name}) berhasil diterbitkan untuk ${data.voucher.beneficiary_name}.`
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
      showToast("warning", "Ubah ke mode Online untuk mendaftarkan warga baru.");
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
      showToast(
        "success",
        `Warga penerima ${data.beneficiary.name} (${data.beneficiary.id}) berhasil didaftarkan.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Permintaan gagal"
      );
    }
  };

  const handleAddMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchantName.trim() || !newMerchantOwner.trim()) return;
    if (isOfflineMode) {
      showToast(
        "warning",
        "Ubah ke mode Online untuk mendaftarkan warung mitra baru."
      );
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
      showToast(
        "success",
        `Warung mitra ${data.merchant.name} (${data.merchant.id}) berhasil didaftarkan.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Permintaan gagal"
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
      `Voucher ${voucher.short_code} dimuat ke Terminal Warung dan siap diverifikasi.`
    );
  };

  const handleCopySmsSlip = (voucher: Voucher) => {
    const text = `[Voucher Bantuan CivicLedger]\nPenerima: ${voucher.beneficiary_name}\nKode: ${voucher.short_code}\nPaket: ${voucher.commodity_name} (${formatRupiah(voucher.nominal_idr)})\nBerlaku sampai: ${formatDateTime(voucher.expires_at)}\nTunjukkan kode ini di warung mitra terdekat.`;
    navigator.clipboard.writeText(text);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2200);
    showToast("info", `Slip SMS untuk voucher ${voucher.short_code} disalin.`);
  };

  const handleVerifyAndRedeem = async (simulateTamperFraud = false) => {
    const t0 = performance.now();
    const merchant =
      merchants.find((m) => m.id === activeMerchantId) || merchants[0];
    if (!merchant) {
      showToast("error", "Belum ada warung aktif yang dipilih.");
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
        "Masukkan kode 6-karakter yang valid (misal CL-8841-K9) atau pilih dari daftar cepat."
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
          "Tanda tangan HMAC-SHA256 tidak cocok. Manipulasi nominal payload (Rp 500.000) langsung ditolak tanpa perlu koneksi server.",
      });
      showToast(
        "error",
        "Ditolak: Verifikasi HMAC-SHA256 mendeteksi manipulasi isi payload."
      );
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
        errorReason: `Penukaran ganda diblokir. Nonce '${targetVoucher.nonce}' sudah tercatat terpakai di IndexedDB / Buku Besar.`,
      });
      showToast(
        "error",
        `Duplikat ditolak: Voucher ${targetVoucher.short_code} sudah pernah ditukarkan.`
      );
      return;
    }

    if (!expiryPassed) {
      showToast("error", `Voucher ${targetVoucher.short_code} sudah kedaluwarsa.`);
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
                redeemed_by_merchant_name: `${merchant.name} (Antrean Offline)`,
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
        `Terverifikasi offline dalam ${durationMs} ms. Disimpan di IndexedDB (${clientTxId}) menunggu sinkronisasi.`
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
        `Voucher ${targetVoucher.short_code} berhasil ditebus di ${merchant.name} (+${formatRupiah(targetVoucher.nominal_idr)}) dalam ${durationMs} ms.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Permintaan gagal"
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
      merchant_name: `${altMerchant.name} (Perangkat Offline ke-2)`,
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
      `Simulasi klaim duplikat untuk ${candidate.short_code} dari ${altMerchant.name} masuk antrean. Klik Sinkron & Rekonsiliasi Batch untuk menguji penolakan server.`
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
      if (!res.ok) throw new Error(data.error || "Sinkronisasi batch gagal");

      await clearSyncedOfflineRedemptions();
      setOfflineQueue([]);
      setIsOfflineMode(false);
      setLastSyncResults(data.results || []);
      await applyServerState(data.state);

      const synced = data.synced_count ?? 0;
      const conflicts = data.conflict_count ?? 0;

      showToast(
        conflicts > 0 ? "warning" : "success",
        `Rekonsiliasi selesai: ${synced} transaksi sah dicatat, ${conflicts} konflik duplikat otomatis ditolak dan dicatat di log.`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Sinkronisasi gagal"
      );
    } finally {
      setIsSyncingBatch(false);
    }
  };

  const handleSettleMerchants = async (merchantId?: string) => {
    if (isOfflineMode) {
      showToast(
        "warning",
        "Ubah ke mode Online untuk menjalankan pencairan batch warung."
      );
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
        `Berhasil mencairkan ${formatRupiah(totalDisbursed)} ke ${data.batches.length} warung mitra (jalur transfer simulasi).`
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal melakukan pencairan"
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
                ? `${serverRes.message} Terverifikasi ganda oleh server & WebCrypto.`
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
      "TX_ID",
      "Client_TX_ID",
      "Waktu",
      "Voucher_ID",
      "Kode_Pendek",
      "ID_Warga",
      "ID_Warung",
      "Nama_Warung",
      "Komoditas",
      "Nominal_IDR",
      "Mode_Sinkron",
      "Batch_Pencairan",
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
      l.settlement_batch_id || "MENUNGGU",
      l.prev_hash,
      l.tx_hash,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civicledger-buku-besar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Buku besar transaksi berhasil diekspor sebagai CSV.");
  };

  const handleExportJson = () => {
    const snapshot = {
      dieksport_pada: new Date().toISOString(),
      proyek: "CivicLedger — Lembaga Kliring Voucher Bantuan Komunitas",
      tim: "Run.exe (STACK 2026 by GDGoC ITB — Kasus 2)",
      mesin_backend: backendEngine,
      saldo_kas_idr: poolTotalIdr,
      anomali_diblokir: fraudBlockedCount,
      warga: beneficiaries,
      warung: merchants,
      voucher: vouchers,
      buku_besar: ledger,
      log_rekonsiliasi: reconciliationLogs,
      batch_pencairan: settlementBatches,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civicledger-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Snapshot audit lengkap berhasil diekspor sebagai JSON.");
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
    showToast("info", "Data demo sintetis berhasil dikembalikan ke kondisi awal.");
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

  const engineBadgeText =
    backendEngine === "GO_POSTGRES"
      ? "Go API · PostgreSQL"
      : backendEngine === "GO_LOCAL"
        ? "Go API · Lokal"
        : "Next.js Lokal";

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    section: "OPERATIONS" | "CLEARINGHOUSE";
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: "COORDINATOR",
      label: "Konsol Koordinator",
      section: "OPERATIONS",
      icon: LayoutGrid,
    },
    {
      id: "BENEFICIARY",
      label: "Kartu Warga",
      section: "OPERATIONS",
      icon: QrCode,
    },
    {
      id: "MERCHANT_POS",
      label: "Terminal Warung",
      section: "OPERATIONS",
      icon: ScanLine,
      badge: offlineQueue.length > 0 ? offlineQueue.length : undefined,
    },
    {
      id: "CLEARINGHOUSE",
      label: "Kliring & Buku Besar",
      section: "CLEARINGHOUSE",
      icon: Landmark,
    },
    {
      id: "REPORTS",
      label: "Laporan & Audit",
      section: "CLEARINGHOUSE",
      icon: BarChart3,
    },
    {
      id: "GUIDE",
      label: "Panduan Pengguna",
      section: "CLEARINGHOUSE",
      icon: BookOpen,
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#F7F7F8] text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100">
      {/* ==================== SIDEBAR NAVIGASI KIRI (DESKTOP) ==================== */}
      <aside className="no-print hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-white dark:bg-[#0C0C0E] border-r border-zinc-200 dark:border-zinc-800/80 z-30">
        {/* Header Brand */}
        <div className="h-14 px-5 flex items-center gap-2.5 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 text-white dark:text-zinc-950"
              fill="none"
            >
              <path
                d="M4 7h16M4 12h10M4 17h16"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="square"
              />
              <rect x="17" y="10" width="3" height="4" fill="currentColor" />
            </svg>
          </div>
          <span className="font-semibold text-[14px] tracking-[-0.02em] text-zinc-900 dark:text-zinc-100">
            CivicLedger
          </span>
        </div>

        {/* Grup Menu Navigasi */}
        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          <div>
            <p className="px-2.5 mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
              Operasional
            </p>
            <div className="space-y-0.5">
              {navItems
                .filter((i) => i.section === "OPERATIONS")
                .map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition ${
                        active
                          ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-50 font-medium"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${
                            active
                              ? "text-zinc-900 dark:text-zinc-100"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        />
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <p className="px-2.5 mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
              Kliring &amp; Panduan
            </p>
            <div className="space-y-0.5">
              {navItems
                .filter((i) => i.section === "CLEARINGHOUSE")
                .map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition ${
                        active
                          ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-50 font-medium"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${
                            active
                              ? "text-zinc-900 dark:text-zinc-100"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        />
                        {item.label}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </nav>

        {/* Kontrol Bawah: Mode Koneksi, Tampilan, Mesin & Reset */}
        <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800/80 space-y-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500 mb-1.5 px-1">
              Mode Koneksi
            </p>
            <div className="grid grid-cols-2 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => {
                  if (isOfflineMode) {
                    setIsOfflineMode(false);
                    showToast("info", "Kembali ke mode Online kliring.");
                  }
                }}
                className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  !isOfflineMode
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm dark:shadow-none"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${!isOfflineMode ? "bg-emerald-500 dark:bg-emerald-400" : "bg-zinc-400 dark:bg-zinc-600"}`}
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
                      "Simulasi mode Offline aktif. Verifikasi berjalan lokal via WebCrypto & IndexedDB."
                    );
                  }
                }}
                className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  isOfflineMode
                    ? "bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 shadow-sm dark:shadow-none"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? "bg-amber-500 dark:bg-amber-400" : "bg-zinc-400 dark:bg-zinc-600"}`}
                />
                Offline
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400 dark:text-zinc-500 mb-1.5 px-1">
              Tampilan
            </p>
            <div className="grid grid-cols-2 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => updateTheme("dark")}
                className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <Moon className="w-3 h-3" />
                Gelap
              </button>
              <button
                type="button"
                onClick={() => updateTheme("light")}
                className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  theme === "light"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Sun className="w-3 h-3" />
                Terang
              </button>
            </div>
          </div>

          <div className="px-1 space-y-1 text-[11px] text-zinc-500">
            <div className="flex items-center justify-between">
              <span>Mesin</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-300">
                {engineBadgeText}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Simpanan</span>
              <span className="font-mono text-zinc-600 dark:text-zinc-400">
                IndexedDB{swRegistered ? " · SW" : ""}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDemo}
            className="w-full py-1.5 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/90 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Data Sintetis
          </button>
        </div>
      </aside>

      {/* ==================== AREA UTAMA ==================== */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Bar Atas */}
        <header className="no-print sticky top-0 z-20 h-14 bg-[#F7F7F8]/90 dark:bg-[#09090B]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className="lg:hidden w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0">
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 text-white dark:text-zinc-950"
                fill="none"
              >
                <path
                  d="M4 7h16M4 12h10M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="square"
                />
                <rect x="17" y="10" width="3" height="4" fill="currentColor" />
              </svg>
            </div>
            <div className="truncate">
              <h1 className="text-[14px] font-medium tracking-[-0.015em] text-zinc-950 dark:text-zinc-100 truncate">
                {TAB_META[activeTab].title}
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 truncate">
                {TAB_META[activeTab].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {offlineQueue.length > 0 && (
              <button
                onClick={handleSyncOfflineBatch}
                disabled={isSyncingBatch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                />
                <span className="tabular-nums">
                  Sinkron Antrean ({offlineQueue.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => updateTheme(theme === "dark" ? "light" : "dark")}
              title="Ganti Mode Gelap / Terang"
              className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsOfflineMode(!isOfflineMode)}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? "bg-amber-500" : "bg-emerald-500"}`}
              />
              {isOfflineMode ? "Offline" : "Online"}
            </button>

            <span
              title="Seluruh profil warga, warung, dan pencairan adalah data demo sintetis untuk STACK 2026."
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-300/80 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-400"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
              Data Demo Sintetis
            </span>

            <span className="hidden xl:inline-block text-[11px] font-mono text-zinc-500 pl-1">
              STACK 2026 · Tim Run.exe
            </span>
          </div>
        </header>

        {/* Tab Ponsel */}
        <div className="no-print lg:hidden border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0C0C0E] px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Banner Mode Offline */}
        {isOfflineMode && (
          <div className="no-print bg-amber-500/10 dark:bg-amber-500/[0.07] border-b border-amber-500/25 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-amber-900 dark:text-amber-200/90">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                <span>
                  Simulasi offline aktif — Verifikasi warung berjalan lokal via{" "}
                  <span className="font-mono">crypto.subtle</span> dan antrean
                  disimpan di <span className="font-mono">IndexedDB</span>.
                </span>
              </div>
              {offlineQueue.length > 0 && (
                <button
                  onClick={handleSyncOfflineBatch}
                  className="text-xs font-medium text-amber-800 dark:text-amber-300 underline underline-offset-4 self-start sm:self-auto"
                >
                  Hubungkan &amp; Sinkronkan ({offlineQueue.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notifikasi Toast */}
        {actionBanner && (
          <div className="no-print px-4 sm:px-6 lg:px-8 pt-4">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    actionBanner.type === "success"
                      ? "bg-emerald-500 dark:bg-emerald-400"
                      : actionBanner.type === "warning"
                        ? "bg-amber-500 dark:bg-amber-400"
                        : actionBanner.type === "error"
                          ? "bg-rose-500 dark:bg-rose-400"
                          : "bg-zinc-400"
                  }`}
                />
                <span className="truncate">{actionBanner.text}</span>
              </div>
              <button
                onClick={() => setActionBanner(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 shrink-0"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== KONTEN UTAMA ==================== */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1440px] mx-auto">
            {loading ? (
              <div className="py-20 text-center text-xs font-mono text-zinc-500">
                Memuat data lembaga kliring...
              </div>
            ) : (
              <>
                {/* ============================================================
                    TAB 1: KONSOL KOORDINATOR
                   ============================================================ */}
                {activeTab === "COORDINATOR" && (
                  <div className="space-y-6">
                    {/* Bar Metrik KPI */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800/80 border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#111113] rounded-xl overflow-hidden">
                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Saldo Kas Bantuan
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
                          {formatRupiah(poolTotalIdr)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Terkunci untuk bantuan pangan pokok
                        </p>
                      </div>

                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Voucher Aktif
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
                          {activeVouchersCount}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                          {vouchers.length} total voucher diterbitkan
                        </p>
                      </div>

                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Omzet Warung Lokal
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
                          {formatRupiah(totalWarungTurnover)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                          {merchants.length} warung mitra terdaftar
                        </p>
                      </div>

                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Direktori Terverifikasi
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-950 dark:text-zinc-50 mt-2">
                          {beneficiaries.length}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                          {fraudBlockedCount} percobaan anomali diblokir
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* Kiri: Terbitkan Voucher */}
                      <div className="lg:col-span-5 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5 space-y-5">
                        <div className="flex items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
                          <div>
                            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              Terbitkan Voucher
                            </h2>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Buat alokasi bertanda tangan HMAC-SHA256
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddResidentForm(!showAddResidentForm);
                                setShowAddMerchantForm(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-800 dark:text-zinc-300 transition"
                            >
                              <Plus className="w-3 h-3" />
                              Warga
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddMerchantForm(!showAddMerchantForm);
                                setShowAddResidentForm(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-800 dark:text-zinc-300 transition"
                            >
                              <Plus className="w-3 h-3" />
                              Warung
                            </button>
                          </div>
                        </div>

                        {showAddResidentForm && (
                          <form
                            onSubmit={handleAddBeneficiary}
                            className="p-4 rounded-lg bg-zinc-50 dark:bg-[#0C0C0E] border border-zinc-200 dark:border-zinc-800 space-y-3"
                          >
                            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                              Daftarkan Keluarga Penerima Manfaat
                            </p>
                            <input
                              type="text"
                              required
                              placeholder="Nama lengkap (misal: Pak Hendra Wijaya)"
                              value={newResidentName}
                              onChange={(e) =>
                                setNewResidentName(e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={newResidentRtRw}
                                onChange={(e) =>
                                  setNewResidentRtRw(e.target.value)
                                }
                                placeholder="RT / RW"
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                              />
                              <input
                                type="text"
                                value={newResidentCategory}
                                onChange={(e) =>
                                  setNewResidentCategory(e.target.value)
                                }
                                placeholder="Kategori"
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              value={newResidentPhone}
                              onChange={(e) =>
                                setNewResidentPhone(e.target.value)
                              }
                              placeholder="Nomor HP / SMS"
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowAddResidentForm(false)}
                                className="px-3 py-1.5 rounded-md text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                              >
                                Batal
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-medium"
                              >
                                Simpan Warga
                              </button>
                            </div>
                          </form>
                        )}

                        {showAddMerchantForm && (
                          <form
                            onSubmit={handleAddMerchant}
                            className="p-4 rounded-lg bg-zinc-50 dark:bg-[#0C0C0E] border border-zinc-200 dark:border-zinc-800 space-y-3"
                          >
                            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                              Daftarkan Warung Mitra Lokal
                            </p>
                            <input
                              type="text"
                              required
                              placeholder="Nama warung (misal: Warung Sembako Maju)"
                              value={newMerchantName}
                              onChange={(e) =>
                                setNewMerchantName(e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
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
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                              />
                              <input
                                type="text"
                                value={newMerchantRtRw}
                                onChange={(e) =>
                                  setNewMerchantRtRw(e.target.value)
                                }
                                placeholder="Lokasi"
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              value={newMerchantBank}
                              onChange={(e) =>
                                setNewMerchantBank(e.target.value)
                              }
                              placeholder="Rekening Bank / QRIS"
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowAddMerchantForm(false)}
                                className="px-3 py-1.5 rounded-md text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                              >
                                Batal
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-medium"
                              >
                                Simpan Warung
                              </button>
                            </div>
                          </form>
                        )}

                        <form onSubmit={handleIssueVoucher} className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                              Penerima Manfaat
                            </label>
                            <select
                              value={selectedBeneficiaryId}
                              onChange={(e) =>
                                setSelectedBeneficiaryId(e.target.value)
                              }
                              className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                            >
                              {beneficiaries.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} — {b.rt_rw}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                              Paket Komoditas Pangan
                            </label>
                            <div className="space-y-1.5">
                              {catalog.map((item) => {
                                const selected =
                                  selectedCommodityCode === item.code;
                                return (
                                  <label
                                    key={item.code}
                                    className={`flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                      selected
                                        ? "bg-zinc-100/90 dark:bg-zinc-900 border-zinc-900 dark:border-zinc-500"
                                        : "bg-zinc-50/70 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700"
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
                                        className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                          {item.name}
                                        </p>
                                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                                          {item.items}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 tabular-nums whitespace-nowrap">
                                      {formatRupiah(item.nominal_idr)}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                              Masa Berlaku
                            </label>
                            <select
                              value={validityHours}
                              onChange={(e) =>
                                setValidityHours(Number(e.target.value))
                              }
                              className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                            >
                              <option value={24}>24 Jam · Bantuan Darurat</option>
                              <option value={72}>72 Jam · Standar RT/RW</option>
                              <option value={168}>7 Hari · Alokasi Mingguan</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-medium text-xs transition"
                          >
                            Terbitkan &amp; Tandatangani Voucher
                          </button>

                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            Dilengkapi nonce sekali pakai dan tanda tangan
                            HMAC-SHA256 agar bisa diverifikasi offline di browser
                            warung.
                          </p>
                        </form>
                      </div>

                      {/* Kanan: Registri Alokasi */}
                      <div className="lg:col-span-7 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 overflow-hidden">
                        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Registri Alokasi Voucher
                              </h2>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Pantau seluruh voucher dari penerbitan hingga
                                pencairan
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                              {filteredVouchers.length} data
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                value={voucherSearch}
                                onChange={(e) =>
                                  setVoucherSearch(e.target.value)
                                }
                                placeholder="Cari kode, nama warga, atau paket komoditas..."
                                className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                              />
                            </div>
                            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                              {(
                                [
                                  { id: "ALL", label: "Semua" },
                                  { id: "ACTIVE", label: "Aktif" },
                                  { id: "REDEEMED", label: "Ditukar" },
                                  { id: "SETTLED", label: "Cair" },
                                ] as const
                              ).map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => setVoucherStatusFilter(st.id)}
                                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
                                    voucherStatusFilter === st.id
                                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm dark:shadow-none"
                                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                                  }`}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-200 dark:border-zinc-800/80 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 bg-zinc-50 dark:bg-[#0E0E10]">
                                <th className="py-2.5 pl-5 pr-3">Kode</th>
                                <th className="py-2.5 px-3">Penerima</th>
                                <th className="py-2.5 px-3">Paket</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 pl-3 pr-5 text-right">
                                  Aksi
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/60 text-xs">
                              {filteredVouchers.map((v) => (
                                <tr
                                  key={v.id}
                                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition"
                                >
                                  <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                                      {v.short_code}
                                    </span>
                                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                      {v.id}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="font-medium text-zinc-900 dark:text-zinc-200">
                                      {v.beneficiary_name}
                                    </div>
                                    <div className="text-[11px] text-zinc-500">
                                      {v.rt_rw}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="text-zinc-800 dark:text-zinc-200">
                                      {v.commodity_name}
                                    </div>
                                    <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                                      {formatRupiah(v.nominal_idr)}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-800 dark:text-zinc-300 whitespace-nowrap">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          v.status === "ACTIVE"
                                            ? "bg-emerald-500 dark:bg-emerald-400"
                                            : v.status === "REDEEMED"
                                              ? "bg-amber-500 dark:bg-amber-400"
                                              : "bg-zinc-400"
                                        }`}
                                      />
                                      {formatStatusLabel(v.status)}
                                    </span>
                                    {v.redeemed_by_merchant_name && (
                                      <div className="text-[11px] text-zinc-500 mt-0.5 max-w-[230px] leading-snug">
                                        {v.redeemed_by_merchant_name}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap space-x-1.5">
                                    <button
                                      onClick={() => {
                                        setWalletBeneficiaryId(v.beneficiary_id);
                                        setSelectedVoucherForQR(v);
                                        setActiveTab("BENEFICIARY");
                                      }}
                                      className="px-2.5 py-1 rounded-md border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition"
                                    >
                                      Kartu
                                    </button>
                                    {v.status === "ACTIVE" && (
                                      <button
                                        onClick={() =>
                                          sendVoucherToMerchantScanner(v)
                                        }
                                        className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-[11px] font-medium transition"
                                      >
                                        Tukar
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {filteredVouchers.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="py-10 text-center text-zinc-500 text-xs"
                                  >
                                    Tidak ada voucher yang sesuai dengan filter.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================
                    TAB 2: KARTU WARGA
                   ============================================================ */}
                {activeTab === "BENEFICIARY" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="no-print lg:col-span-5 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5 space-y-5">
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                          Keluarga Penerima Manfaat
                        </label>
                        <select
                          value={walletBeneficiaryId}
                          onChange={(e) =>
                            setWalletBeneficiaryId(e.target.value)
                          }
                          className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                        >
                          {beneficiaries.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} — {b.rt_rw}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Daftar Voucher Milik Warga
                        </p>
                        {vouchers
                          .filter(
                            (v) => v.beneficiary_id === walletBeneficiaryId
                          )
                          .map((v) => {
                            const isSelected = selectedVoucherForQR?.id === v.id;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setSelectedVoucherForQR(v)}
                                className={`w-full text-left p-4 rounded-lg border transition ${
                                  isSelected
                                    ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-900 dark:border-zinc-500"
                                    : "bg-zinc-50/70 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                    {v.short_code}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        v.status === "ACTIVE"
                                          ? "bg-emerald-500 dark:bg-emerald-400"
                                          : "bg-zinc-400 dark:bg-zinc-500"
                                      }`}
                                    />
                                    {formatStatusLabel(v.status)}
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200 mt-2">
                                  {v.commodity_name}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  {v.commodity_items}
                                </p>
                                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px] font-mono tabular-nums">
                                  <span className="text-zinc-900 dark:text-zinc-200">
                                    {formatRupiah(v.nominal_idr)}
                                  </span>
                                  <span className="text-zinc-500">
                                    Berlaku s/d {formatDateTime(v.expires_at)}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Kanan: Kartu Voucher */}
                    <div className="lg:col-span-7 flex justify-center">
                      {selectedVoucherForQR ? (
                        <div className="w-full max-w-md bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm dark:shadow-none">
                          <div className="p-5 bg-zinc-50 dark:bg-[#161619] border-b border-zinc-200 dark:border-zinc-800/90 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500">
                                CivicLedger · Kartu Voucher
                              </p>
                              <h3 className="text-base font-semibold tracking-[-0.015em] text-zinc-950 dark:text-zinc-50 mt-1">
                                {selectedVoucherForQR.beneficiary_name}
                              </h3>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {selectedVoucherForQR.rt_rw}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  selectedVoucherForQR.status === "ACTIVE"
                                    ? "bg-emerald-500 dark:bg-emerald-400"
                                    : "bg-zinc-400 dark:bg-zinc-500"
                                }`}
                              />
                              {formatStatusLabel(selectedVoucherForQR.status)}
                            </span>
                          </div>

                          <div className="p-6 space-y-5">
                            <div className="flex items-baseline justify-between gap-4">
                              <div>
                                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                                  {selectedVoucherForQR.commodity_name}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  {selectedVoucherForQR.commodity_items}
                                </p>
                              </div>
                              <p className="text-xl font-semibold tracking-[-0.02em] tabular-nums text-zinc-950 dark:text-zinc-50 whitespace-nowrap">
                                {formatRupiah(selectedVoucherForQR.nominal_idr)}
                              </p>
                            </div>

                            <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90">
                              {qrDataUrl ? (
                                <div className="p-3 bg-white rounded-lg border border-zinc-200 dark:border-transparent">
                                  <img
                                    src={qrDataUrl}
                                    alt="Kode QR Voucher"
                                    className="w-48 h-48 block"
                                  />
                                </div>
                              ) : (
                                <div className="w-48 h-48 flex items-center justify-center text-xs text-zinc-500">
                                  Membuat QR...
                                </div>
                              )}
                              <div className="mt-4 w-full pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-zinc-500">
                                  Kode SMS / Cetak
                                </span>
                                <span className="font-mono text-base font-semibold tracking-[0.14em] text-zinc-950 dark:text-zinc-100">
                                  {selectedVoucherForQR.short_code}
                                </span>
                              </div>
                            </div>

                            <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#0C0C0E] border border-zinc-200 dark:border-zinc-800/80 font-mono text-[11px] space-y-1.5">
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500">ID</span>
                                <span className="text-zinc-800 dark:text-zinc-300">
                                  {selectedVoucherForQR.id}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500">NONCE</span>
                                <span className="text-zinc-800 dark:text-zinc-300">
                                  {selectedVoucherForQR.nonce}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500 shrink-0">
                                  HMAC-SHA256
                                </span>
                                <span className="text-zinc-600 dark:text-zinc-400 truncate">
                                  {selectedVoucherForQR.hmac_signature}
                                </span>
                              </div>
                            </div>

                            <div className="no-print space-y-2.5">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopySmsSlip(selectedVoucherForQR)
                                  }
                                  className="py-2 px-3 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                                >
                                  {copiedSms ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Tersalin
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      Salin Slip SMS
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => window.print()}
                                  className="py-2 px-3 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Cetak Slip
                                </button>
                              </div>

                              {selectedVoucherForQR.status === "ACTIVE" ? (
                                <button
                                  onClick={() =>
                                    sendVoucherToMerchantScanner(
                                      selectedVoucherForQR
                                    )
                                  }
                                  className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-medium text-xs flex items-center justify-center gap-1.5 transition"
                                >
                                  <span>Buka di Terminal Warung</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-600 dark:text-zinc-400">
                                  Telah ditukar di{" "}
                                  {
                                    selectedVoucherForQR.redeemed_by_merchant_name
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500 text-xs">
                          Warga ini belum memiliki voucher aktif.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================================================
                    TAB 3: TERMINAL WARUNG (POS OFFLINE)
                   ============================================================ */}
                {activeTab === "MERCHANT_POS" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    <div className="lg:col-span-6 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5 space-y-5">
                      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
                        <div>
                          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Pemindai Penukaran
                          </h2>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Verifikasi payload QR atau kode 6-karakter secara
                            offline
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition"
                        >
                          {cameraActive ? (
                            <>
                              <CameraOff className="w-3.5 h-3.5 text-zinc-500" />
                              Matikan Kamera
                            </>
                          ) : (
                            <>
                              <Camera className="w-3.5 h-3.5 text-zinc-500" />
                              Pindai Kamera
                            </>
                          )}
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                          Warung Aktif
                        </label>
                        <select
                          value={activeMerchantId}
                          onChange={(e) => setActiveMerchantId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                        >
                          {merchants.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.owner}) · Menunggu Cair{" "}
                              {formatRupiah(m.unsettled_balance_idr)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {cameraActive && (
                        <div className="relative rounded-lg overflow-hidden bg-black aspect-video border border-zinc-300 dark:border-zinc-800">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 border border-zinc-400/50 m-8 rounded-lg pointer-events-none flex items-end justify-center pb-2">
                            <span className="px-2.5 py-0.5 rounded bg-black/80 text-zinc-200 text-[10px] font-mono">
                              {cameraDetectSupported
                                ? "Deteksi QR otomatis aktif"
                                : "Pratinjau kamera aktif"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Pilih Cepat Voucher (Demo 1 Perangkat)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {vouchers.map((v) => {
                            const selected = scannerInputCode === v.short_code;
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
                                className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono border transition ${
                                  selected
                                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100 font-medium"
                                    : v.status === "ACTIVE"
                                      ? "bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-600"
                                      : "bg-zinc-100/70 dark:bg-zinc-950/50 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800/60"
                                }`}
                              >
                                {v.short_code} ·{" "}
                                {formatStatusLabel(v.status).toLowerCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                          Kode Alfanumerik
                        </label>
                        <input
                          type="text"
                          value={scannerInputCode}
                          onChange={(e) => {
                            setScannerInputCode(e.target.value.toUpperCase());
                            setScannedQRPayloadRaw("");
                          }}
                          placeholder="CL-8841-K9"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 font-mono text-sm tracking-wider uppercase text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleVerifyAndRedeem(false)}
                          className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-medium text-xs transition"
                        >
                          Verifikasi HMAC-SHA256 &amp; Tukar
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyAndRedeem(true)}
                            className="py-2 px-3 rounded-lg bg-white hover:bg-rose-50 dark:bg-zinc-950 dark:hover:bg-rose-950/30 border border-zinc-300 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-medium transition"
                          >
                            Uji Manipulasi Payload
                          </button>

                          <button
                            type="button"
                            onClick={handleSimulateOfflineConflict}
                            className="py-2 px-3 rounded-lg bg-white hover:bg-amber-50 dark:bg-zinc-950 dark:hover:bg-amber-950/30 border border-zinc-300 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-medium transition"
                          >
                            Simulasi Konflik Offline
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Kanan: Verifikator Web Crypto + Antrean IndexedDB */}
                    <div className="lg:col-span-6 space-y-5">
                      <div className="bg-zinc-950 dark:bg-[#0D0D10] text-zinc-100 rounded-xl border border-zinc-800 overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-200">
                            Verifikator Web Crypto{" "}
                            <span className="font-mono text-zinc-500">
                              (crypto.subtle)
                            </span>
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-zinc-400">
                            {isOfflineMode
                              ? "Offline · IndexedDB"
                              : "Online · ACID"}
                          </span>
                        </div>

                        <div className="p-5">
                          {cryptoTrace ? (
                            <div className="space-y-3.5 font-mono text-[11px]">
                              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                                <span className="inline-flex items-center gap-2 font-sans text-xs font-medium">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      cryptoTrace.hmacValid &&
                                      cryptoTrace.doubleSpendCheckPassed
                                        ? "bg-emerald-400"
                                        : "bg-rose-400"
                                    }`}
                                  />
                                  <span
                                    className={
                                      cryptoTrace.hmacValid &&
                                      cryptoTrace.doubleSpendCheckPassed
                                        ? "text-zinc-100"
                                        : "text-rose-300"
                                    }
                                  >
                                    {cryptoTrace.hmacValid &&
                                    cryptoTrace.doubleSpendCheckPassed
                                      ? "Verifikasi Berhasil"
                                      : "Verifikasi Ditolak"}
                                  </span>
                                </span>
                                <span className="text-zinc-500 tabular-nums">
                                  {cryptoTrace.durationMs} ms
                                </span>
                              </div>

                              {cryptoTrace.errorReason && (
                                <p className="font-sans text-xs text-rose-300/90 bg-rose-950/30 border border-rose-900/40 rounded-lg p-3 leading-relaxed">
                                  {cryptoTrace.errorReason}
                                </p>
                              )}

                              <div className="space-y-2 text-zinc-400">
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-500 shrink-0">
                                    ID_TX_KLIEN
                                  </span>
                                  <span className="text-zinc-200 truncate">
                                    {cryptoTrace.clientTxId}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-500 shrink-0">
                                    PAYLOAD_KANONIS
                                  </span>
                                  <span className="text-zinc-300 truncate">
                                    {cryptoTrace.canonicalMessage}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-500 shrink-0">
                                    SIG_VOUCHER
                                  </span>
                                  <span className="text-zinc-400 truncate">
                                    {cryptoTrace.providedSignature}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-500 shrink-0">
                                    HASIL_HMAC
                                  </span>
                                  <span
                                    className={`truncate ${
                                      cryptoTrace.hmacValid
                                        ? "text-zinc-200"
                                        : "text-rose-400"
                                    }`}
                                  >
                                    {cryptoTrace.computedSignature}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 pt-2 border-t border-zinc-800/80">
                                  <span className="text-zinc-500">
                                    STATUS_NONCE
                                  </span>
                                  <span
                                    className={
                                      cryptoTrace.doubleSpendCheckPassed
                                        ? "text-emerald-400"
                                        : "text-rose-400"
                                    }
                                  >
                                    {cryptoTrace.doubleSpendCheckPassed
                                      ? "BELUM_TERPAKAI"
                                      : "SUDAH_TERPAKAI"}
                                  </span>
                                </div>
                                {cryptoTrace.receiptHash && (
                                  <div className="flex justify-between gap-4">
                                    <span className="text-zinc-500 shrink-0">
                                      STRUK_SHA256
                                    </span>
                                    <span className="text-zinc-300 truncate">
                                      {cryptoTrace.receiptHash}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="py-6 text-center text-xs text-zinc-500">
                              Pilih voucher lalu jalankan verifikasi untuk
                              melihat jejak kriptografi secara langsung.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Antrean Offline{" "}
                            <span className="font-mono text-xs text-zinc-500">
                              (IndexedDB)
                            </span>
                          </h3>
                          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                            {offlineQueue.length} tertunda
                          </span>
                        </div>

                        {offlineQueue.length === 0 ? (
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            Antrean kosong. Ubah ke mode{" "}
                            <span className="text-zinc-800 dark:text-zinc-300 font-medium">
                              Offline
                            </span>{" "}
                            di sidebar lalu tukarkan voucher, atau klik{" "}
                            <span className="text-zinc-800 dark:text-zinc-300 font-medium">
                              Simulasi Konflik Offline
                            </span>
                            .
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {offlineQueue.map((item) => (
                                <div
                                  key={item.queue_id}
                                  className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                                        {item.short_code}
                                      </span>
                                      {item.is_simulated_conflict && (
                                        <span className="text-[10px] font-mono text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded">
                                          UJI_KONFLIK
                                        </span>
                                      )}
                                      <span className="text-zinc-500 truncate">
                                        {item.merchant_name}
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
                                      {item.client_tx_id} ·{" "}
                                      {item.local_receipt_hash.slice(0, 16)}...
                                    </div>
                                  </div>
                                  <span className="font-mono text-zinc-900 dark:text-zinc-200 tabular-nums whitespace-nowrap">
                                    {formatRupiah(item.nominal_idr)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <button
                              onClick={handleSyncOfflineBatch}
                              disabled={isSyncingBatch}
                              className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 transition"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                              />
                              <span>Sinkron &amp; Rekonsiliasi Batch</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {lastSyncResults && lastSyncResults.length > 0 && (
                        <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">
                              Hasil Rekonsiliasi Server Terbaru
                            </h3>
                            <button
                              onClick={() => setLastSyncResults(null)}
                              className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                            >
                              Bersihkan
                            </button>
                          </div>
                          <div className="space-y-2">
                            {lastSyncResults.map((r) => (
                              <div
                                key={r.client_tx_id}
                                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-zinc-900 dark:text-zinc-200">
                                    {r.short_code} · {r.client_tx_id}
                                  </span>
                                  <span
                                    className={`font-mono text-[10px] ${
                                      r.status === "SYNCED"
                                        ? "text-emerald-700 dark:text-emerald-400"
                                        : "text-rose-700 dark:text-rose-400"
                                    }`}
                                  >
                                    {r.outcome}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-500 mt-1">
                                  {r.reason}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================================================
                    TAB 4: KLIRING & BUKU BESAR AUDIT
                   ============================================================ */}
                {activeTab === "CLEARINGHOUSE" && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
                        <div>
                          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Antrean Pencairan Warung Mitra
                          </h2>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Gabungkan voucher tertukar menjadi batch pencairan
                            ber-hash (jalur transfer simulasi).
                          </p>
                        </div>

                        <button
                          onClick={() => handleSettleMerchants()}
                          disabled={totalUnsettledIdr === 0}
                          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition tabular-nums ${
                            totalUnsettledIdr > 0
                              ? "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950"
                              : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                          }`}
                        >
                          Cairkan Semua ({formatRupiah(totalUnsettledIdr)})
                        </button>
                      </div>

                      {merchants.length === 0 ? (
                        <p className="py-8 text-center text-xs text-zinc-500">
                          Belum ada warung mitra yang terdaftar.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {merchants.map((m) => (
                            <div
                              key={m.id}
                              className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                                  <span>{m.id}</span>
                                  <span className="tabular-nums">
                                    {m.redemption_count} tx
                                  </span>
                                </div>
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1.5">
                                  {m.name}
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                  {m.rt_rw}
                                </p>
                                <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-2">
                                  {m.bank_account}
                                </p>
                              </div>

                              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-zinc-500">
                                    Menunggu Cair
                                  </span>
                                  <span className="font-mono text-zinc-950 dark:text-zinc-100 tabular-nums">
                                    {formatRupiah(m.unsettled_balance_idr)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-500">
                                    Sudah Cair
                                  </span>
                                  <span className="font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                                    {formatRupiah(m.total_settled_idr)}
                                  </span>
                                </div>
                                {m.unsettled_balance_idr > 0 ? (
                                  <button
                                    onClick={() => handleSettleMerchants(m.id)}
                                    className="w-full mt-2.5 py-1.5 px-3 rounded-md bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-medium transition"
                                  >
                                    Cairkan Warung
                                  </button>
                                ) : (
                                  <p className="pt-2 text-[11px] text-zinc-400 dark:text-zinc-600">
                                    Tidak ada saldo menunggu cair
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Buku Besar Audit Rantai Hash */}
                    <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 overflow-hidden">
                      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Buku Besar Audit Berantai Hash SHA-256
                          </h3>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Catatan transaksi tahan manipulasi yang menautkan{" "}
                            <span className="font-mono text-zinc-700 dark:text-zinc-400">
                              prev_hash
                            </span>{" "}
                            ke{" "}
                            <span className="font-mono text-zinc-700 dark:text-zinc-400">
                              tx_hash
                            </span>
                            .
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleVerifyHashChain}
                          disabled={isVerifyingChain}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-medium shrink-0 transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                          <span>
                            {isVerifyingChain
                              ? "Memverifikasi..."
                              : "Verifikasi Integritas Rantai"}
                          </span>
                        </button>
                      </div>

                      {chainCheckResult && (
                        <div className="px-5 py-3 bg-zinc-50 dark:bg-[#0E0E10] border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            {chainCheckResult.valid ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                            )}
                            <span className="text-zinc-800 dark:text-zinc-200">
                              {chainCheckResult.message}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500 hidden md:inline">
                            HEAD {chainCheckResult.head_hash.slice(0, 18)}...
                          </span>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800/80 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 bg-zinc-50 dark:bg-[#0E0E10]">
                              <th className="py-2.5 pl-5 pr-3">Transaksi</th>
                              <th className="py-2.5 px-3">Voucher</th>
                              <th className="py-2.5 px-3">Warung Mitra</th>
                              <th className="py-2.5 px-3">Mode</th>
                              <th className="py-2.5 pl-3 pr-5">
                                Rantai Hash (Prev / Curr)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/60 text-xs">
                            {ledger.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-10 text-center text-zinc-500 text-xs"
                                >
                                  Belum ada transaksi buku besar yang tercatat.
                                </td>
                              </tr>
                            ) : (
                              ledger.map((entry) => (
                                <tr
                                  key={entry.id}
                                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition"
                                >
                                  <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                                      {entry.id}
                                    </span>
                                    <div className="text-[10px] font-mono text-zinc-500">
                                      {entry.client_tx_id}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                                      {formatDateTime(entry.timestamp)}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <span className="font-mono text-zinc-900 dark:text-zinc-200">
                                      {entry.short_code}
                                    </span>{" "}
                                    <span className="text-zinc-500 dark:text-zinc-400">
                                      · {entry.commodity_name}
                                    </span>
                                    <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 tabular-nums mt-0.5">
                                      {formatRupiah(entry.nominal_idr)} ·{" "}
                                      {entry.beneficiary_id}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="text-zinc-900 dark:text-zinc-200">
                                      {entry.merchant_name}
                                    </div>
                                    <div className="text-[11px] text-zinc-500">
                                      {entry.settlement_batch_id
                                        ? `Cair (${entry.settlement_batch_id})`
                                        : "Belum dicairkan"}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 whitespace-nowrap">
                                    <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded">
                                      {entry.sync_mode}
                                    </span>
                                  </td>
                                  <td className="py-3.5 pl-3 pr-5 font-mono text-[10px] text-zinc-500 max-w-xs">
                                    <div className="truncate">
                                      P: {entry.prev_hash.slice(0, 22)}...
                                    </div>
                                    <div className="truncate text-zinc-800 dark:text-zinc-300">
                                      C: {entry.tx_hash.slice(0, 22)}...
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Log Rekonsiliasi & Struk Pencairan */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          Log Audit Rekonsiliasi
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 mb-4">
                          Riwayat validasi server untuk sinkronisasi batch
                          offline
                        </p>
                        {reconciliationLogs.length === 0 ? (
                          <p className="py-8 text-center text-xs text-zinc-500">
                            Belum ada catatan rekonsiliasi offline.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {reconciliationLogs.map((log) => (
                              <div
                                key={log.id}
                                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-zinc-900 dark:text-zinc-200">
                                    {log.short_code} · {log.client_tx_id}
                                  </span>
                                  <span
                                    className={`font-mono text-[10px] ${
                                      log.outcome === "SYNCED"
                                        ? "text-emerald-700 dark:text-emerald-400"
                                        : "text-rose-700 dark:text-rose-400"
                                    }`}
                                  >
                                    {log.outcome}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                                  {log.reason}
                                </p>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">
                                  {log.merchant_name} ·{" "}
                                  {formatDateTime(log.processed_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-zinc-800/90 p-5">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          Struk Batch Pencairan
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 mb-4">
                          Riwayat batch pencairan warung ber-hash SHA-256
                        </p>
                        {settlementBatches.length === 0 ? (
                          <p className="py-8 text-center text-xs text-zinc-500">
                            Belum ada batch pencairan yang selesai.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {settlementBatches.map((b) => (
                              <div
                                key={b.id}
                                className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-zinc-900 dark:text-zinc-200">
                                      {b.id}
                                    </span>
                                    <span className="text-[11px] text-zinc-500 tabular-nums">
                                      {formatDateTime(b.settled_at)}
                                    </span>
                                  </div>
                                  <p className="text-zinc-700 dark:text-zinc-300 mt-1 truncate">
                                    {b.merchant_name} · {b.bank_account}
                                  </p>
                                  <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-600 mt-0.5 truncate">
                                    SHA256 {b.batch_hash.slice(0, 26)}...
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-medium text-zinc-950 dark:text-zinc-100 tabular-nums">
                                    {formatRupiah(b.total_amount_idr)}
                                  </span>
                                  <p className="text-[11px] text-zinc-500 tabular-nums">
                                    {b.voucher_count} voucher
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================
                    TAB 5: LAPORAN & AUDIT
                   ============================================================ */}
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

                {/* ============================================================
                    TAB 6: PANDUAN PENGGUNA
                   ============================================================ */}
                {activeTab === "GUIDE" && (
                  <UserGuideTab onNavigate={(tab) => setActiveTab(tab)} />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
