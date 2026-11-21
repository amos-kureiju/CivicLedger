"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  Store,
  Users,
  Landmark,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Lock,
  Database,
  BarChart3,
  Sparkles,
  PlusCircle,
  Send,
  Camera,
  CameraOff,
  KeyRound,
  Receipt,
  Layers,
  BadgeCheck,
  Clock,
  ShieldAlert,
  RotateCcw,
  Wallet,
  Search,
  Copy,
  Check,
  Printer,
  Server,
  GitCompareArrows,
  XCircle,
} from "lucide-react";
import {
  BackendEngineType,
  BatchSyncResultItem,
  Beneficiary,
  ChainVerificationResult,
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
  cacheVouchersInIndexedDB,
  clearAllOfflineStores,
  clearSyncedOfflineRedemptions,
  enqueueOfflineRedemption,
  getCachedVouchersFromIndexedDB,
  getOfflineRedemptionQueue,
  isVoucherRedeemedLocally,
} from "@/lib/indexeddb";
import ReportsComplianceTab from "@/components/ReportsComplianceTab";

type ActiveTab =
  | "COORDINATOR"
  | "BENEFICIARY"
  | "MERCHANT_POS"
  | "CLEARINGHOUSE"
  | "REPORTS";

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

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
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

export default function CivicLedgerApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("COORDINATOR");
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendEngine, setBackendEngine] =
    useState<BackendEngineType>("NEXTJS_FALLBACK");
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "warning" | "error" | "info";
    text: string;
  } | null>(null);

  // Clearinghouse State
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
  const [catalog, setCatalog] = useState<CommodityItem[]>([]);

  // IndexedDB Offline Queue & Sync Reconciliation State
  const [offlineQueue, setOfflineQueue] = useState<
    OfflineRedemptionQueueItem[]
  >([]);
  const [isSyncingBatch, setIsSyncingBatch] = useState<boolean>(false);
  const [lastSyncResults, setLastSyncResults] = useState<
    BatchSyncResultItem[] | null
  >(null);

  // Ledger Hash-Chain Verification State
  const [chainCheckResult, setChainCheckResult] =
    useState<ChainVerificationResult | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState<boolean>(false);

  // Step 1: Coordinator Form State
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedCommodityCode, setSelectedCommodityCode] =
    useState<string>("PKG-BERAS-5KG");
  const [validityHours, setValidityHours] = useState<number>(72);
  const [voucherSearch, setVoucherSearch] = useState<string>("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<
    "ALL" | VoucherStatus
  >("ALL");

  // Add Beneficiary Form
  const [showAddResidentForm, setShowAddResidentForm] =
    useState<boolean>(false);
  const [newResidentName, setNewResidentName] = useState<string>("");
  const [newResidentRtRw, setNewResidentRtRw] = useState<string>(
    "RT 04 / RW 08 Coblong, Bandung"
  );
  const [newResidentCategory, setNewResidentCategory] = useState<string>(
    "Newly Verified Vulnerable Household"
  );
  const [newResidentPhone, setNewResidentPhone] = useState<string>(
    "0812-3456-7890 (SMS / Mobile Web)"
  );

  // Add Merchant Form
  const [showAddMerchantForm, setShowAddMerchantForm] =
    useState<boolean>(false);
  const [newMerchantName, setNewMerchantName] = useState<string>("");
  const [newMerchantOwner, setNewMerchantOwner] = useState<string>("");
  const [newMerchantRtRw, setNewMerchantRtRw] = useState<string>(
    "RT 03 / RW 08 Coblong, Bandung"
  );
  const [newMerchantBank, setNewMerchantBank] = useState<string>(
    "BRI Micro / QRIS •• 5510"
  );

  // Step 2: Beneficiary Wallet State
  const [walletBeneficiaryId, setWalletBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedVoucherForQR, setSelectedVoucherForQR] =
    useState<Voucher | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedSms, setCopiedSms] = useState<boolean>(false);

  // Step 3: Merchant POS Scanner State
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

  const applyServerState = useCallback(
    async (data: {
      pool_total_idr?: number;
      fraud_blocked_count?: number;
      beneficiaries?: Beneficiary[];
      merchants?: Merchant[];
      vouchers?: Voucher[];
      ledger?: LedgerEntry[];
      settlement_batches?: SettlementBatch[];
      reconciliation_logs?: ReconciliationLog[];
      commodity_catalog?: CommodityItem[];
      backend_engine?: BackendEngineType;
    }) => {
      if (typeof data.pool_total_idr === "number")
        setPoolTotalIdr(data.pool_total_idr);
      if (typeof data.fraud_blocked_count === "number")
        setFraudBlockedCount(data.fraud_blocked_count);
      if (data.beneficiaries) setBeneficiaries(data.beneficiaries);
      if (data.merchants) setMerchants(data.merchants);
      if (data.vouchers) {
        setVouchers(data.vouchers);
        await cacheVouchersInIndexedDB(data.vouchers);
      }
      if (data.ledger) setLedger(data.ledger);
      if (data.settlement_batches) setSettlementBatches(data.settlement_batches);
      if (data.reconciliation_logs)
        setReconciliationLogs(data.reconciliation_logs);
      if (data.commodity_catalog) setCatalog(data.commodity_catalog);
      if (data.backend_engine) setBackendEngine(data.backend_engine);
    },
    []
  );

  // Register Service Worker & listen to real online/offline events
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
          "Browser network restored. Click 'Sync Offline Queue' if pending transactions exist in IndexedDB."
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

  // Load initial state from API and sync cache to IndexedDB
  const fetchClearinghouseState = useCallback(async () => {
    try {
      const res = await fetch("/api/clearinghouse", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch clearinghouse state");
      const data = await res.json();
      await applyServerState(data);
      const q = await getOfflineRedemptionQueue();
      setOfflineQueue(q);
    } catch {
      const cached = await getCachedVouchersFromIndexedDB();
      if (cached.length > 0) {
        setVouchers(cached);
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

  // Keep selectedVoucherForQR synced when walletBeneficiaryId or vouchers change
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

  // Render QR code Data URL whenever selectedVoucherForQR changes
  useEffect(() => {
    if (!selectedVoucherForQR) {
      setQrDataUrl("");
      return;
    }
    const payload = encodeVoucherToQRPayload(selectedVoucherForQR);
    QRCode.toDataURL(payload, {
      width: 260,
      margin: 2,
      color: {
        dark: "#064e3b",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, [selectedVoucherForQR]);

  // Cleanup camera stream
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
    if (activeTab !== "MERCHANT_POS") {
      stopCamera();
    }
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
        // Use native Chrome/Edge BarcodeDetector if available for real live QR scanning
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
                    `QR code ${decoded.code} captured from camera! Ready for cryptographic verification.`
                  );
                }
              }
            } catch {
              // Ignore frame decode error
            }
          }, 500);
        }
      }, 150);
    } catch {
      showToast(
        "warning",
        "Camera permission unavailable on this device. Use 'Quick-Pick Voucher' or enter the 6-character alphanumeric code directly."
      );
    }
  };

  // ==================== ACTIONS ====================

  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOfflineMode) {
      showToast(
        "warning",
        "Issuing new allocations requires connectivity to the Clearinghouse server. (Merchant redemptions continue 100% offline!)"
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
      if (!res.ok) throw new Error(data.error || "Failed to issue voucher");

      await applyServerState(data.state);
      setWalletBeneficiaryId(selectedBeneficiaryId);
      setSelectedVoucherForQR(data.voucher);

      showToast(
        "success",
        `Voucher ${data.voucher.short_code} (${data.voucher.commodity_name}) issued & signed with HMAC-SHA256 for ${data.voucher.beneficiary_name}.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Unexpected error");
    }
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidentName.trim()) return;
    if (isOfflineMode) {
      showToast("warning", "Disable Offline Mode to register new beneficiaries.");
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
        `Beneficiary '${data.beneficiary.name}' (${data.beneficiary.id}) registered and verified.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Unexpected error");
    }
  };

  const handleAddMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchantName.trim() || !newMerchantOwner.trim()) return;
    if (isOfflineMode) {
      showToast("warning", "Disable Offline Mode to onboard new merchants.");
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
        `Partner merchant '${data.merchant.name}' (${data.merchant.id}) onboarded to clearinghouse.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Unexpected error");
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
      `Voucher ${voucher.short_code} (${voucher.beneficiary_name}) loaded into Merchant POS for verification.`
    );
  };

  const handleCopySmsSlip = (voucher: Voucher) => {
    const text = `[CivicLedger Aid Voucher]\nRecipient: ${voucher.beneficiary_name}\nCode: ${voucher.short_code}\nPackage: ${voucher.commodity_name} (${formatRupiah(voucher.nominal_idr)})\nValid until: ${formatDateTime(voucher.expires_at)}\nPresent this code at any partner Warung.`;
    navigator.clipboard.writeText(text);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2200);
    showToast("info", `SMS fallback slip for ${voucher.short_code} copied.`);
  };

  // Core Step 3: Verify & Redeem Voucher (Online + 100% Offline IndexedDB + Tamper Fraud Test)
  const handleVerifyAndRedeem = async (simulateTamperFraud = false) => {
    const t0 = performance.now();
    const merchant =
      merchants.find((m) => m.id === activeMerchantId) || merchants[0];
    if (!merchant) return;

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
        "Enter a valid 6-character code (e.g., CL-8841-K9) or select a voucher from the quick-pick list."
      );
      return;
    }

    const clientTxId = generateClientTxId();

    // 1. Client-side Web Cryptography API (window.crypto.subtle) HMAC-SHA256 verification
    const verification = await verifyVoucherWebCrypto({
      voucher_id: targetVoucher.id,
      beneficiary_id: targetVoucher.beneficiary_id,
      commodity_code: targetVoucher.commodity_code,
      nominal_idr: targetVoucher.nominal_idr,
      nonce: targetVoucher.nonce,
      expires_at: targetVoucher.expires_at,
      signature_hex: targetVoucher.hmac_signature,
    });

    // 2. Local Anti-Double-Spend check (IndexedDB + state)
    const alreadyRedeemedInIdb = await isVoucherRedeemedLocally(
      targetVoucher.id
    );
    const existingServerVoucher = vouchers.find(
      (v) => v.id === targetVoucher!.id
    );
    const alreadyRedeemedInState =
      existingServerVoucher && existingServerVoucher.status !== "ACTIVE";
    const doubleSpendPassed = !alreadyRedeemedInIdb && !alreadyRedeemedInState;

    // 3. Expiration check
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
          "CRYPTOGRAPHIC REJECT: HMAC-SHA256 signature does not match payload! Detected altered voucher value (Rp 500,000) without clearinghouse signing key.",
      });
      showToast(
        "error",
        "FRAUD BLOCKED: Web Cryptography API (HMAC-SHA256) rejected the tampered voucher payload offline!"
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
        errorReason: `ANTI-DOUBLE-SPEND REJECT: Nonce '${targetVoucher.nonce}' for voucher ${targetVoucher.short_code} is already recorded in local IndexedDB / Clearinghouse Ledger.`,
      });
      showToast(
        "error",
        `DUPLICATE BLOCKED: Voucher ${targetVoucher.short_code} has already been redeemed!`
      );
      return;
    }

    if (!expiryPassed) {
      showToast("error", `Voucher ${targetVoucher.short_code} has expired.`);
      return;
    }

    const redeemedAtIso = new Date().toISOString();
    const localReceiptHash = await sha256WebCrypto(
      `${clientTxId}|${targetVoucher.id}|${merchant.id}|${targetVoucher.nominal_idr}|${redeemedAtIso}|${targetVoucher.hmac_signature}`
    );

    // 4A. OFFLINE MODE: Queue into IndexedDB
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
                redeemed_by_merchant_name: `${merchant.name} (Offline Queue)`,
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
        `OFFLINE VERIFICATION PASSED (${durationMs} ms): HMAC-SHA256 valid! Stored in IndexedDB with unique TX ID ${clientTxId} awaiting sync.`
      );
      return;
    }

    // 4B. ONLINE MODE: Commit directly to Clearinghouse Backend
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
      if (!res.ok) throw new Error(data.error || "Redemption failed");

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
        `REDEMPTION COMMITTED (${durationMs} ms): Voucher ${targetVoucher.short_code} redeemed at ${merchant.name}. Merchant balance increased by ${formatRupiah(targetVoucher.nominal_idr)}.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Unexpected error");
    }
  };

  // Simulate an offline duplicate claim from a second disconnected merchant device
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
      merchant_name: `${altMerchant.name} (2nd Offline Device)`,
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
      `Simulated cross-device offline duplicate claim for ${candidate.short_code} queued from ${altMerchant.name}. Click 'Sync Batch to Server' to watch server-side conflict reconciliation reject the duplicate!`
    );
  };

  // Sync Offline IndexedDB Queue to Clearinghouse Server
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
      if (!res.ok) throw new Error(data.error || "Batch sync failed");

      await clearSyncedOfflineRedemptions();
      setOfflineQueue([]);
      setIsOfflineMode(false);
      setLastSyncResults(data.results || []);
      await applyServerState(data.state);

      const synced = data.synced_count ?? 0;
      const conflicts = data.conflict_count ?? 0;

      showToast(
        conflicts > 0 ? "warning" : "success",
        `BATCH RECONCILIATION COMPLETE: ${synced} offline transaction(s) committed to ledger, ${conflicts} conflicting duplicate(s) automatically rejected & logged.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncingBatch(false);
    }
  };

  // Step 4: Settle Merchant Balances
  const handleSettleMerchants = async (merchantId?: string) => {
    if (isOfflineMode) {
      showToast(
        "warning",
        "Disable Offline Mode first to disburse batch settlements to merchant accounts."
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
        `SETTLEMENT BATCH GENERATED: ${formatRupiah(totalDisbursed)} reconciled across ${data.batches.length} merchant(s) with SHA-256 settlement receipts (simulated disbursement rail).`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Settlement error");
    }
  };

  // Verify Hash Chain Integrity (Client WebCrypto + Server Endpoint)
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
                ? `${serverRes.message} (Double-verified by Backend & Browser WebCrypto)`
                : serverRes.message || clientRes.message,
          };
        }
      }
      setChainCheckResult(finalRes);
      showToast(
        finalRes.valid ? "success" : "error",
        finalRes.message
      );
    } finally {
      setIsVerifyingChain(false);
    }
  };

  // Export CSV / JSON Reports
  const handleExportCsv = () => {
    const headers = [
      "TX_ID",
      "Client_TX_ID",
      "Timestamp",
      "Voucher_ID",
      "Short_Code",
      "Beneficiary_ID",
      "Merchant_ID",
      "Merchant_Name",
      "Commodity",
      "Nominal_IDR",
      "Sync_Mode",
      "Settlement_Batch",
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
      l.settlement_batch_id || "PENDING",
      l.prev_hash,
      l.tx_hash,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civicledger-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Audit ledger exported as CSV.");
  };

  const handleExportJson = () => {
    const snapshot = {
      exported_at: new Date().toISOString(),
      project: "CivicLedger — Resilient Local Voucher Clearinghouse",
      team: "Run.exe (STACK 2026 by GDGoC ITB — Case 2)",
      backend_engine: backendEngine,
      pool_total_idr: poolTotalIdr,
      fraud_blocked_count: fraudBlockedCount,
      beneficiaries,
      merchants,
      vouchers,
      ledger,
      reconciliation_logs: reconciliationLogs,
      settlement_batches: settlementBatches,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civicledger-full-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Full audit snapshot exported as JSON.");
  };

  const handleResetDemo = async () => {
    try {
      await clearAllOfflineStores();
      const res = await fetch("/api/clearinghouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_DEMO" }),
      });
      const data = await res.json();
      if (data.state) {
        await applyServerState(data.state);
      }
      setOfflineQueue([]);
      setCryptoTrace(null);
      setLastSyncResults(null);
      setChainCheckResult(null);
      setIsOfflineMode(false);
      showToast("info", "Demo state reset to initial synthetic dataset.");
    } catch {
      // Ignore
    }
  };

  // Derived metrics & filtered vouchers
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
      ? "Go API + PostgreSQL"
      : backendEngine === "GO_LOCAL"
        ? "Go API (Local Store)"
        : "Next.js Local Engine";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* ==================== TOP HEADER & CONNECTIVITY BAR ==================== */}
      <header className="no-print sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-950">
                <ShieldCheck className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-bold text-lg tracking-tight text-white">
                    CivicLedger
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    STACK 2026 • Case 2
                  </span>
                  <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Team Run.exe
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Resilient Local Voucher Clearinghouse for Community Mutual Aid
                </p>
              </div>
            </div>

            <button
              onClick={handleResetDemo}
              title="Reset Demo Data"
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {/* Interactive Connectivity, Engine & PWA Status Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-slate-300">
              <Server
                className={`w-3.5 h-3.5 ${
                  backendEngine === "NEXTJS_FALLBACK"
                    ? "text-sky-400"
                    : "text-emerald-400"
                }`}
              />
              <span>{engineBadgeText}</span>
              <span className="text-slate-600">•</span>
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>IndexedDB {swRegistered ? "+ SW" : ""}</span>
            </div>

            {offlineQueue.length > 0 && (
              <button
                onClick={handleSyncOfflineBatch}
                disabled={isSyncingBatch}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-sm transition animate-pulse"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                />
                <span>Sync {offlineQueue.length} Offline Queue</span>
              </button>
            )}

            <button
              onClick={() => {
                const nextMode = !isOfflineMode;
                setIsOfflineMode(nextMode);
                showToast(
                  nextMode ? "warning" : "info",
                  nextMode
                    ? "OFFLINE MODE ENABLED: Simulating connectivity loss at a local warung. QR verification runs 100% locally via Web Crypto API & IndexedDB."
                    : "ONLINE MODE RESTORED: Connected to the Clearinghouse REST API."
                );
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                isOfflineMode
                  ? "bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30"
                  : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
              }`}
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="w-4 h-4 text-amber-400" />
                  <span>Offline Mode: ACTIVE</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span>Online (Simulate Offline)</span>
                </>
              )}
            </button>

            <button
              onClick={handleResetDemo}
              title="Reset Synthetic Demo Data"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-950/70 border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab("COORDINATOR")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "COORDINATOR"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. Organizer Console</span>
            </button>

            <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:block" />

            <button
              onClick={() => setActiveTab("BENEFICIARY")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "BENEFICIARY"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>2. Beneficiary Wallet</span>
            </button>

            <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:block" />

            <button
              onClick={() => setActiveTab("MERCHANT_POS")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "MERCHANT_POS"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Store className="w-4 h-4" />
              <span>3. Merchant POS (Offline)</span>
              {offlineQueue.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-400 text-slate-950 font-bold">
                  {offlineQueue.length}
                </span>
              )}
            </button>

            <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:block" />

            <button
              onClick={() => setActiveTab("CLEARINGHOUSE")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeTab === "CLEARINGHOUSE"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>4. Clearinghouse &amp; Ledger</span>
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setActiveTab("REPORTS")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition ${
                activeTab === "REPORTS"
                  ? "bg-teal-600 border-teal-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-700 text-emerald-300 hover:bg-slate-800"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>5. Reports &amp; Compliance</span>
            </button>
          </div>
        </div>
      </header>

      {/* ==================== OFFLINE MODE BANNER ==================== */}
      {isOfflineMode && (
        <div className="no-print bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>OFFLINE WARUNG SIMULATION ACTIVE:</strong> Server
                connectivity is cut. Merchant POS continues verifying voucher
                authenticity locally via{" "}
                <code className="px-1.5 py-0.5 rounded bg-amber-200/70 font-mono">
                  window.crypto.subtle (HMAC-SHA256)
                </code>{" "}
                and buffering signed redemptions in{" "}
                <code className="px-1.5 py-0.5 rounded bg-amber-200/70 font-mono">
                  IndexedDB
                </code>
                .
              </span>
            </div>
            {offlineQueue.length > 0 && (
              <button
                onClick={handleSyncOfflineBatch}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold shrink-0 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect &amp; Sync ({offlineQueue.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== FEEDBACK BANNER ==================== */}
      {actionBanner && (
        <div className="no-print max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium shadow-sm ${
              actionBanner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : actionBanner.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : actionBanner.type === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-sky-50 border-sky-200 text-sky-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionBanner.type === "success" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {actionBanner.type === "warning" && (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              {actionBanner.type === "error" && (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              {actionBanner.type === "info" && (
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
              )}
              <span>{actionBanner.text}</span>
            </div>
            <button
              onClick={() => setActionBanner(null)}
              className="text-xs underline opacity-75 hover:opacity-100 shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ==================== MAIN WORKSPACE CONTENT ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Loading CivicLedger Clearinghouse &amp; initializing Web Cryptography
            API...
          </div>
        ) : (
          <>
            {/* ====================================================================
                TAB 1: ORGANIZER CONSOLE (BENEFICIARIES, MERCHANTS & ISSUANCE)
               ==================================================================== */}
            {activeTab === "COORDINATOR" && (
              <div className="space-y-6">
                {/* KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <span>Community Aid Pool</span>
                      <Wallet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-2">
                      {formatRupiah(poolTotalIdr)}
                    </p>
                    <p className="text-xs text-emerald-700 mt-1 font-medium">
                      100% locked to essential staples
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <span>Active Vouchers</span>
                      <QrCode className="w-4 h-4 text-sky-600" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-2">
                      {activeVouchersCount} Ready
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {vouchers.length} total HMAC-signed vouchers issued
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <span>Local Warung Turnover</span>
                      <Store className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-2">
                      {formatRupiah(totalWarungTurnover)}
                    </p>
                    <p className="text-xs text-amber-700 mt-1 font-medium">
                      Across {merchants.length} participating neighborhood stalls
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <span>Verified Directory</span>
                      <Clock className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-2">
                      {beneficiaries.length} Households
                    </p>
                    <p className="text-xs text-indigo-700 mt-1 font-medium">
                      {fraudBlockedCount} duplicate/tamper attempts blocked
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Issue Voucher + Register Beneficiary/Merchant */}
                  <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                          Step 1 • Community Organizer
                        </span>
                        <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                          Issue Cryptographic Voucher
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddResidentForm(!showAddResidentForm);
                            setShowAddMerchantForm(false);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 transition"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Resident</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddMerchantForm(!showAddMerchantForm);
                            setShowAddResidentForm(false);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800 transition"
                        >
                          <Store className="w-3.5 h-3.5" />
                          <span>Merchant</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Form: Register Beneficiary */}
                    {showAddResidentForm && (
                      <form
                        onSubmit={handleAddBeneficiary}
                        className="mb-5 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3"
                      >
                        <p className="text-xs font-bold text-emerald-900">
                          Register Verified Beneficiary Household
                        </p>
                        <input
                          type="text"
                          required
                          placeholder="Full Name (e.g., Pak Hendra Wijaya)"
                          value={newResidentName}
                          onChange={(e) => setNewResidentName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newResidentRtRw}
                            onChange={(e) => setNewResidentRtRw(e.target.value)}
                            placeholder="RT / RW Area"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                          />
                          <input
                            type="text"
                            value={newResidentCategory}
                            onChange={(e) =>
                              setNewResidentCategory(e.target.value)
                            }
                            placeholder="Vulnerability Category"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                          />
                        </div>
                        <input
                          type="text"
                          value={newResidentPhone}
                          onChange={(e) => setNewResidentPhone(e.target.value)}
                          placeholder="Phone / SMS channel"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddResidentForm(false)}
                            className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold"
                          >
                            Save Beneficiary
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Inline Form: Register Merchant */}
                    {showAddMerchantForm && (
                      <form
                        onSubmit={handleAddMerchant}
                        className="mb-5 p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3"
                      >
                        <p className="text-xs font-bold text-amber-900">
                          Onboard Local Participating Merchant (Warung)
                        </p>
                        <input
                          type="text"
                          required
                          placeholder="Stall Name (e.g., Warung Sembako Maju)"
                          value={newMerchantName}
                          onChange={(e) => setNewMerchantName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Owner Name"
                            value={newMerchantOwner}
                            onChange={(e) =>
                              setNewMerchantOwner(e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                          />
                          <input
                            type="text"
                            value={newMerchantRtRw}
                            onChange={(e) => setNewMerchantRtRw(e.target.value)}
                            placeholder="Location (RT/RW)"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                          />
                        </div>
                        <input
                          type="text"
                          value={newMerchantBank}
                          onChange={(e) => setNewMerchantBank(e.target.value)}
                          placeholder="Settlement Account / QRIS"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddMerchantForm(false)}
                            className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold"
                          >
                            Register Merchant
                          </button>
                        </div>
                      </form>
                    )}

                    <form onSubmit={handleIssueVoucher} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Select Verified Beneficiary
                        </label>
                        <select
                          value={selectedBeneficiaryId}
                          onChange={(e) =>
                            setSelectedBeneficiaryId(e.target.value)
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          {beneficiaries.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} — {b.rt_rw} ({b.category})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Commodity-Locked Aid Package
                        </label>
                        <div className="space-y-2">
                          {catalog.map((item) => {
                            const selected =
                              selectedCommodityCode === item.code;
                            return (
                              <label
                                key={item.code}
                                className={`flex items-start justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                  selected
                                    ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600"
                                    : "border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <input
                                    type="radio"
                                    name="commodity"
                                    value={item.code}
                                    checked={selected}
                                    onChange={() =>
                                      setSelectedCommodityCode(item.code)
                                    }
                                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <div>
                                    <p className="text-xs font-bold text-slate-900">
                                      {item.name}
                                    </p>
                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                      {item.items}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">
                                  {formatRupiah(item.nominal_idr)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Voucher Validity Window
                        </label>
                        <select
                          value={validityHours}
                          onChange={(e) =>
                            setValidityHours(Number(e.target.value))
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                        >
                          <option value={24}>24 Hours (Emergency Daily Aid)</option>
                          <option value={72}>
                            72 Hours / 3 Days (Standard RT/RW Cycle)
                          </option>
                          <option value={168}>
                            7 Days (Weekly Family Allocation)
                          </option>
                        </select>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 text-xs space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-emerald-400">
                          <Lock className="w-3.5 h-3.5" />
                          <span>HMAC-SHA256 Offline-Verifiable Token</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Each voucher generates a{" "}
                          <strong>single-use cryptographic nonce</strong> +{" "}
                          <strong>HMAC-SHA256 signature</strong> so partner
                          stalls can verify authenticity even without internet.
                        </p>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Issue &amp; Sign Voucher (HMAC-SHA256)</span>
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Searchable Voucher Registry */}
                  <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          Community Voucher Allocation Registry
                        </h2>
                        <p className="text-xs text-slate-500">
                          Inspect issued tokens, jump to the Beneficiary QR pass,
                          or send directly to Merchant POS.
                        </p>
                      </div>
                    </div>

                    {/* Search & Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={voucherSearch}
                          onChange={(e) => setVoucherSearch(e.target.value)}
                          placeholder="Search code, resident name, or package..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {(["ALL", "ACTIVE", "REDEEMED", "SETTLED"] as const).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setVoucherStatusFilter(st)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                                voucherStatusFilter === st
                                  ? "bg-white text-slate-900 shadow-sm"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                            <th className="py-2.5 pr-3">Code / ID</th>
                            <th className="py-2.5 px-3">Beneficiary</th>
                            <th className="py-2.5 px-3">Locked Commodity</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 pl-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredVouchers.map((v) => (
                            <tr
                              key={v.id}
                              className="hover:bg-slate-50/80 transition"
                            >
                              <td className="py-3 pr-3 whitespace-nowrap">
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                  {v.short_code}
                                </span>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  {v.id}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">
                                  {v.beneficiary_name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {v.rt_rw}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-800">
                                  {v.commodity_name}
                                </div>
                                <div className="text-[11px] font-bold text-emerald-700">
                                  {formatRupiah(v.nominal_idr)}
                                </div>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                {v.status === "ACTIVE" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    ACTIVE
                                  </span>
                                )}
                                {v.status === "REDEEMED" && (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                      REDEEMED
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                                      at {v.redeemed_by_merchant_name}
                                    </div>
                                  </div>
                                )}
                                {v.status === "SETTLED" && (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                      SETTLED
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      Batch: {v.settlement_batch_id}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 pl-3 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  onClick={() => {
                                    setWalletBeneficiaryId(v.beneficiary_id);
                                    setSelectedVoucherForQR(v);
                                    setActiveTab("BENEFICIARY");
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-[11px]"
                                >
                                  View QR
                                </button>
                                {v.status === "ACTIVE" && (
                                  <button
                                    onClick={() =>
                                      sendVoucherToMerchantScanner(v)
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px]"
                                  >
                                    Redeem →
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {filteredVouchers.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-8 text-center text-slate-400 text-xs"
                              >
                                No vouchers match the current filter.
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

            {/* ====================================================================
                TAB 2: BENEFICIARY WALLET (DYNAMIC QR & SMS FALLBACK TOKEN)
               ==================================================================== */}
            {activeTab === "BENEFICIARY" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column */}
                <div className="no-print lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      Step 2 • Beneficiary Presentation
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                      Beneficiary Voucher Wallet
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Designed for inclusive access: smartphone users present a
                      signed QR code, while elderly/non-smartphone residents use
                      the 6-character SMS or printed code.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Beneficiary Profile
                    </label>
                    <select
                      value={walletBeneficiaryId}
                      onChange={(e) => setWalletBeneficiaryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                    >
                      {beneficiaries.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} — {b.rt_rw}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Assigned Vouchers
                    </p>
                    {vouchers
                      .filter((v) => v.beneficiary_id === walletBeneficiaryId)
                      .map((v) => {
                        const isSelected = selectedVoucherForQR?.id === v.id;
                        return (
                          <div
                            key={v.id}
                            onClick={() => setSelectedVoucherForQR(v)}
                            className={`p-4 rounded-xl border cursor-pointer transition ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-900 text-white">
                                {v.short_code}
                              </span>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  v.status === "ACTIVE"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {v.status}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 mt-2">
                              {v.commodity_name}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {v.commodity_items}
                            </p>
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/70 text-xs">
                              <span className="font-bold text-emerald-700">
                                Value: {formatRupiah(v.nominal_idr)}
                              </span>
                              <span className="text-slate-500">
                                Exp: {formatDateTime(v.expires_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Right Column: Mobile Voucher Pass */}
                <div className="lg:col-span-7 flex justify-center">
                  {selectedVoucherForQR ? (
                    <div className="w-full max-w-md bg-white rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden">
                      <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-300" />
                            <span className="font-bold text-sm tracking-wide">
                              CIVICLEDGER VOUCHER PASS
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-emerald-200">
                            {selectedVoucherForQR.status}
                          </span>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs text-emerald-200">
                            Verified Beneficiary:
                          </p>
                          <h3 className="text-lg font-bold">
                            {selectedVoucherForQR.beneficiary_name}
                          </h3>
                          <p className="text-xs text-slate-300">
                            {selectedVoucherForQR.rt_rw}
                          </p>
                        </div>
                      </div>

                      <div className="p-6 space-y-5">
                        <div className="text-center">
                          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                            {selectedVoucherForQR.commodity_name}
                          </span>
                          <p className="text-xs text-slate-600 mt-1.5">
                            {selectedVoucherForQR.commodity_items}
                          </p>
                          <p className="text-2xl font-extrabold text-slate-900 mt-2">
                            {formatRupiah(selectedVoucherForQR.nominal_idr)}
                          </p>
                        </div>

                        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200">
                          {qrDataUrl ? (
                            <img
                              src={qrDataUrl}
                              alt="Cryptographic Voucher QR"
                              className="w-52 h-52 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                            />
                          ) : (
                            <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-400">
                              Generating QR...
                            </div>
                          )}
                          <p className="text-[11px] text-slate-500 mt-2 text-center">
                            Encodes signed JSON payload with{" "}
                            <strong>HMAC-SHA256</strong> for offline merchant
                            verification.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                            Alphanumeric Fallback Token (SMS / Printed Slip)
                          </p>
                          <p className="font-mono text-xl font-black tracking-widest text-slate-900 mt-1">
                            {selectedVoucherForQR.short_code}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900 text-slate-300 font-mono text-[10px] space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">VOUCHER ID:</span>
                            <span className="text-emerald-400">
                              {selectedVoucherForQR.id}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">NONCE:</span>
                            <span>{selectedVoucherForQR.nonce}</span>
                          </div>
                          <div className="truncate">
                            <span className="text-slate-500">HMAC-SHA256: </span>
                            <span className="text-sky-400">
                              {selectedVoucherForQR.hmac_signature}
                            </span>
                          </div>
                        </div>

                        {/* Utility Actions */}
                        <div className="no-print grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopySmsSlip(selectedVoucherForQR)
                            }
                            className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            {copiedSms ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copied SMS!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy SMS Slip
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print Paper Slip
                          </button>
                        </div>

                        {selectedVoucherForQR.status === "ACTIVE" ? (
                          <button
                            onClick={() =>
                              sendVoucherToMerchantScanner(selectedVoucherForQR)
                            }
                            className="no-print w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition"
                          >
                            <Send className="w-4 h-4" />
                            <span>Present Voucher to Merchant POS →</span>
                          </button>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-100 text-center text-xs font-semibold text-slate-600">
                            Already redeemed at{" "}
                            {selectedVoucherForQR.redeemed_by_merchant_name}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
                      This beneficiary currently has no assigned vouchers.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ====================================================================
                TAB 3: MERCHANT POS (OFFLINE SCANNER, WEBCRYPTO & RECONCILIATION)
               ==================================================================== */}
            {activeTab === "MERCHANT_POS" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column */}
                  <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                          Step 3 • Participating Merchant POS
                        </span>
                        <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                          Browser Voucher Scanner &amp; Offline Verifier
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Runs in any standard mobile browser—zero dedicated EDC
                          hardware needed.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Active Partner Merchant (Warung)
                      </label>
                      <select
                        value={activeMerchantId}
                        onChange={(e) => setActiveMerchantId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-medium"
                      >
                        {merchants.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.owner}) — Unsettled:{" "}
                            {formatRupiah(m.unsettled_balance_idr)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Camera Scanner & Quick-Pick Simulation */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <QrCode className="w-4 h-4 text-emerald-600" />
                          Quick-Pick Voucher (1-Device Scan Demo)
                        </span>
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition"
                        >
                          {cameraActive ? (
                            <>
                              <CameraOff className="w-3.5 h-3.5 text-rose-400" />
                              Stop Camera
                            </>
                          ) : (
                            <>
                              <Camera className="w-3.5 h-3.5 text-emerald-400" />
                              Open Web Camera
                            </>
                          )}
                        </button>
                      </div>

                      {cameraActive && (
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 border-2 border-emerald-400/70 m-8 rounded-xl pointer-events-none flex items-end justify-center pb-2">
                            <span className="px-2.5 py-0.5 rounded bg-black/70 text-emerald-300 text-[10px] font-mono">
                              {cameraDetectSupported
                                ? "Auto-Detect QR Active — Point at Beneficiary QR"
                                : "Camera Preview — Or select voucher code below"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {vouchers.map((v) => (
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition ${
                              scannerInputCode === v.short_code
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : v.status === "ACTIVE"
                                  ? "bg-white text-slate-800 border-slate-300 hover:border-emerald-500"
                                  : "bg-slate-100 text-slate-400 border-slate-200"
                            }`}
                          >
                            {v.short_code} ({v.beneficiary_name.split(" ")[0]} •{" "}
                            {v.status})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Code Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Or Enter 6-Character Alphanumeric Token (SMS / Slip)
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={scannerInputCode}
                          onChange={(e) => {
                            setScannerInputCode(e.target.value.toUpperCase());
                            setScannedQRPayloadRaw("");
                          }}
                          placeholder="Example: CL-8841-K9"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Primary & Security Verification Controls */}
                    <div className="space-y-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleVerifyAndRedeem(false)}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition"
                      >
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>
                          Verify HMAC-SHA256 &amp; Record Redemption
                        </span>
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleVerifyAndRedeem(true)}
                          className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Tamper Fraud Test</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSimulateOfflineConflict}
                          className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <GitCompareArrows className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Simulate Offline Conflict</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live WebCrypto Terminal + IndexedDB Queue + Sync Reconciliation */}
                  <div className="lg:col-span-6 space-y-5">
                    {/* WebCrypto Terminal */}
                    <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-sm font-bold tracking-wide text-white">
                            Web Cryptography API (<code>crypto.subtle</code>)
                            Trace
                          </h3>
                        </div>
                        <span
                          className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full ${
                            isOfflineMode
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {isOfflineMode ? "OFFLINE • INDEXEDDB" : "ONLINE • ACID"}
                        </span>
                      </div>

                      {cryptoTrace ? (
                        <div className="space-y-3 font-mono text-xs">
                          <div
                            className={`p-3 rounded-xl border ${
                              cryptoTrace.hmacValid &&
                              cryptoTrace.doubleSpendCheckPassed
                                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                                : "bg-rose-950/70 border-rose-500/40 text-rose-200"
                            }`}
                          >
                            <div className="flex items-center justify-between font-sans font-bold text-sm">
                              <span>
                                {cryptoTrace.hmacValid &&
                                cryptoTrace.doubleSpendCheckPassed
                                  ? "CRYPTOGRAPHIC VERIFICATION PASSED"
                                  : "TRANSACTION REJECTED"}
                              </span>
                              <span className="text-xs font-mono">
                                {cryptoTrace.durationMs} ms
                              </span>
                            </div>
                            {cryptoTrace.errorReason && (
                              <p className="font-sans text-xs mt-1 text-rose-300">
                                {cryptoTrace.errorReason}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1.5 text-[11px] text-slate-300 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                            <div>
                              <span className="text-slate-500">
                                [0] Client TX ID:{" "}
                              </span>
                              <span className="text-emerald-300">
                                {cryptoTrace.clientTxId}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">
                                [1] Canonical Payload:{" "}
                              </span>
                              <span className="text-amber-300 break-all">
                                {cryptoTrace.canonicalMessage}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">
                                [2] QR Signature:{" "}
                              </span>
                              <span className="text-sky-400 break-all">
                                {cryptoTrace.providedSignature}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">
                                [3] Computed HMAC-SHA256:{" "}
                              </span>
                              <span
                                className={`break-all ${
                                  cryptoTrace.hmacValid
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {cryptoTrace.computedSignature}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                              <span className="text-slate-400">
                                [4] Anti-Double-Spend Nonce Check:
                              </span>
                              <span
                                className={
                                  cryptoTrace.doubleSpendCheckPassed
                                    ? "text-emerald-400 font-bold"
                                    : "text-rose-400 font-bold"
                                }
                              >
                                {cryptoTrace.doubleSpendCheckPassed
                                  ? "PASSED (UNSPENT)"
                                  : "REJECTED (ALREADY SPENT)"}
                              </span>
                            </div>
                            {cryptoTrace.receiptHash && (
                              <div className="pt-1 border-t border-slate-800">
                                <span className="text-slate-500">
                                  [5] Receipt SHA-256:{" "}
                                </span>
                                <span className="text-emerald-300 break-all">
                                  {cryptoTrace.receiptHash}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                          <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
                          <p>
                            Select a voucher on the left and click{" "}
                            <strong>Verify HMAC-SHA256 &amp; Record Redemption</strong>{" "}
                            to inspect the real-time cryptographic trace.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Offline IndexedDB Buffer Panel */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-amber-600" />
                          <h3 className="text-sm font-bold text-slate-900">
                            Offline Queue (<code>IndexedDB</code> Local Storage)
                          </h3>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {offlineQueue.length} Queued
                        </span>
                      </div>

                      {offlineQueue.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No pending offline redemptions. Toggle{" "}
                          <strong>Simulate Offline</strong> in the top bar and
                          redeem a voucher—or click{" "}
                          <strong>Simulate Offline Conflict</strong>—to test
                          offline buffering and server reconciliation.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {offlineQueue.map((item) => (
                              <div
                                key={item.queue_id}
                                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                  item.is_simulated_conflict
                                    ? "bg-rose-50/70 border-rose-200"
                                    : "bg-amber-50/70 border-amber-200"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-slate-900">
                                      {item.short_code}
                                    </span>
                                    {item.is_simulated_conflict && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">
                                        CONFLICT TEST
                                      </span>
                                    )}
                                    <span className="text-slate-600 truncate">
                                      — {item.merchant_name}
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                    TX: {item.client_tx_id} • SHA256:{" "}
                                    {item.local_receipt_hash.slice(0, 16)}...
                                  </div>
                                </div>
                                <span className="font-bold text-slate-900 whitespace-nowrap">
                                  {formatRupiah(item.nominal_idr)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={handleSyncOfflineBatch}
                            disabled={isSyncingBatch}
                            className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${isSyncingBatch ? "animate-spin" : ""}`}
                            />
                            <span>
                              Sync Batch to Server &amp; Reconcile Conflicts
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Latest Batch Sync Reconciliation Report */}
                    {lastSyncResults && lastSyncResults.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <GitCompareArrows className="w-4 h-4 text-emerald-600" />
                            Latest Server Reconciliation Result
                          </h3>
                          <button
                            onClick={() => setLastSyncResults(null)}
                            className="text-[11px] text-slate-400 hover:text-slate-600"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="space-y-2">
                          {lastSyncResults.map((r) => (
                            <div
                              key={r.client_tx_id}
                              className={`p-3 rounded-xl border text-xs ${
                                r.status === "SYNCED"
                                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                                  : "bg-rose-50/70 border-rose-200 text-rose-900"
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1.5 font-mono">
                                  {r.status === "SYNCED" ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  )}
                                  {r.short_code} ({r.client_tx_id})
                                </span>
                                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/80">
                                  {r.outcome}
                                </span>
                              </div>
                              <p className="text-[11px] mt-1 opacity-90">
                                {r.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================================
                TAB 4: CLEARINGHOUSE SETTLEMENT & HASH-CHAINED AUDIT LEDGER
               ==================================================================== */}
            {activeTab === "CLEARINGHOUSE" && (
              <div className="space-y-6">
                {/* Merchant Settlement Cards */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        Step 4 • Automated Batch Settlement (Simulated Rail)
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                        Partner Merchant Disbursement Queue
                      </h2>
                      <p className="text-xs text-slate-500">
                        Aggregates verified voucher redemptions into auditable
                        settlement batches for neighborhood stalls.
                      </p>
                    </div>

                    <button
                      onClick={() => handleSettleMerchants()}
                      disabled={totalUnsettledIdr === 0}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition ${
                        totalUnsettledIdr > 0
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <BadgeCheck className="w-4 h-4" />
                      <span>
                        Settle All Merchants ({formatRupiah(totalUnsettledIdr)})
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {merchants.map((m) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-slate-500">
                              {m.id}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              {m.redemption_count} Redemptions
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-1">
                            {m.name}
                          </h3>
                          <p className="text-xs text-slate-500">{m.rt_rw}</p>
                          <p className="text-[11px] font-mono text-slate-600 mt-1">
                            Account: {m.bank_account}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">
                              Pending Settlement:
                            </span>
                            <span className="font-bold text-amber-700">
                              {formatRupiah(m.unsettled_balance_idr)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">
                              Total Disbursed:
                            </span>
                            <span className="font-bold text-emerald-700">
                              {formatRupiah(m.total_settled_idr)}
                            </span>
                          </div>

                          {m.unsettled_balance_idr > 0 && (
                            <button
                              onClick={() => handleSettleMerchants(m.id)}
                              className="w-full mt-2 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                            >
                              Settle This Merchant
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Immutable Hash-Chained Audit Ledger */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Immutable SHA-256 Hash-Chained Audit Ledger
                        </h3>
                        <p className="text-xs text-slate-500">
                          Every committed redemption links{" "}
                          <code className="font-mono text-slate-700">
                            prev_hash
                          </code>{" "}
                          →{" "}
                          <code className="font-mono text-slate-700">
                            tx_hash
                          </code>{" "}
                          for tamper-evident community accounting.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyHashChain}
                      disabled={isVerifyingChain}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 transition"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>
                        {isVerifyingChain
                          ? "Verifying..."
                          : "Verify Hash-Chain Integrity"}
                      </span>
                    </button>
                  </div>

                  {chainCheckResult && (
                    <div
                      className={`mb-4 p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        chainCheckResult.valid
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {chainCheckResult.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>
                          <strong>
                            {chainCheckResult.valid
                              ? "CHAIN INTEGRITY VERIFIED:"
                              : "INTEGRITY FAILURE:"}
                          </strong>{" "}
                          {chainCheckResult.message}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] opacity-80 hidden md:inline">
                        HEAD: {chainCheckResult.head_hash.slice(0, 18)}...
                      </span>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 pr-3">TX ID &amp; Time</th>
                          <th className="py-2.5 px-3">Voucher &amp; Commodity</th>
                          <th className="py-2.5 px-3">Partner Merchant</th>
                          <th className="py-2.5 px-3">Sync Mode</th>
                          <th className="py-2.5 pl-3">
                            SHA-256 Chain (Prev → Current)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {ledger.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-900">
                                {entry.id}
                              </span>
                              <div className="text-[10px] font-mono text-slate-400">
                                {entry.client_tx_id}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatDateTime(entry.timestamp)}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {entry.short_code}
                              </span>{" "}
                              <span className="font-semibold text-slate-800">
                                {entry.commodity_name}
                              </span>
                              <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                                {formatRupiah(entry.nominal_idr)} • Beneficiary:{" "}
                                {entry.beneficiary_id}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900">
                                {entry.merchant_name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {entry.settlement_batch_id
                                  ? `Settled (${entry.settlement_batch_id})`
                                  : "Awaiting Settlement Batch"}
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  entry.sync_mode === "OFFLINE_BATCH_SYNC"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {entry.sync_mode}
                              </span>
                            </td>
                            <td className="py-3 pl-3 font-mono text-[10px] text-slate-500 max-w-xs">
                              <div className="truncate">
                                <span className="text-slate-400">PREV: </span>
                                {entry.prev_hash.slice(0, 24)}...
                              </div>
                              <div className="truncate text-emerald-700 font-bold">
                                <span className="text-slate-400">CURR: </span>
                                {entry.tx_hash.slice(0, 24)}...
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Offline Sync Reconciliation Audit Trail & Settlement History */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Reconciliation Logs */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                      <GitCompareArrows className="w-4 h-4 text-emerald-600" />
                      Offline Sync Reconciliation Log
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Records every server-side validation decision when offline
                      devices reconnect and sync queued transactions.
                    </p>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {reconciliationLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-3 rounded-xl border text-xs ${
                            log.outcome === "SYNCED"
                              ? "bg-emerald-50/50 border-emerald-200"
                              : "bg-rose-50/60 border-rose-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {log.short_code} • {log.client_tx_id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.outcome === "SYNCED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {log.outcome}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 mt-1">
                            {log.reason}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {log.merchant_name} •{" "}
                            {formatDateTime(log.processed_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Settlement Batch History */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      Settlement Batch Receipts
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Cryptographically hashed payout batches issued to partner
                      merchants (disbursement rail simulated).
                    </p>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {settlementBatches.map((b) => (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                {b.id}
                              </span>
                              <span className="text-slate-500">
                                {formatDateTime(b.settled_at)}
                              </span>
                            </div>
                            <p className="font-bold text-slate-900 mt-1">
                              {b.merchant_name} ({b.bank_account})
                            </p>
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                              Batch SHA-256: {b.batch_hash.slice(0, 28)}...
                            </p>
                          </div>
                          <div className="text-right pl-2">
                            <span className="text-sm font-extrabold text-emerald-700">
                              {formatRupiah(b.total_amount_idr)}
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {b.voucher_count} Voucher(s)
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================================
                TAB 5: REPORTS, EXPORT & STACK 2026 COMPLIANCE
               ==================================================================== */}
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
          </>
        )}
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="no-print bg-white border-t border-slate-200 py-4 px-4 sm:px-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>CivicLedger</strong> by Team <strong>Run.exe</strong> — Case
            2: Stronger Communities and Everyday Services (STACK 2026 by GDGoC
            ITB) • <em>Synthetic Demonstration Data</em>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            React PWA • IndexedDB • Web Crypto API • Golang REST API • PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  );
}
