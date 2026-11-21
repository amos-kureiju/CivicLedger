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

const TAB_META: Record<ActiveTab, { title: string; subtitle: string }> = {
  COORDINATOR: {
    title: "Organizer Console",
    subtitle: "Manage community pool, directory, and signed voucher issuance.",
  },
  BENEFICIARY: {
    title: "Beneficiary Pass",
    subtitle:
      "Cryptographic QR voucher pass and 6-character SMS fallback code.",
  },
  MERCHANT_POS: {
    title: "Merchant Terminal",
    subtitle:
      "Offline-capable browser verification via Web Crypto API and IndexedDB.",
  },
  CLEARINGHOUSE: {
    title: "Clearinghouse & Ledger",
    subtitle:
      "Merchant settlement queue, SHA-256 hash chain, and sync reconciliation.",
  },
  REPORTS: {
    title: "Reports & Audit",
    subtitle:
      "Allocation analytics, CSV/JSON exports, and STACK 2026 disclosures.",
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

  // IndexedDB Offline Queue & Sync State
  const [offlineQueue, setOfflineQueue] = useState<
    OfflineRedemptionQueueItem[]
  >([]);
  const [isSyncingBatch, setIsSyncingBatch] = useState<boolean>(false);
  const [lastSyncResults, setLastSyncResults] = useState<
    BatchSyncResultItem[] | null
  >(null);

  // Hash-Chain Verification State
  const [chainCheckResult, setChainCheckResult] =
    useState<ChainVerificationResult | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState<boolean>(false);

  // Organizer Form State
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedCommodityCode, setSelectedCommodityCode] =
    useState<string>("PKG-BERAS-5KG");
  const [validityHours, setValidityHours] = useState<number>(72);
  const [voucherSearch, setVoucherSearch] = useState<string>("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<
    "ALL" | VoucherStatus
  >("ALL");

  // Directory Inline Forms
  const [showAddResidentForm, setShowAddResidentForm] =
    useState<boolean>(false);
  const [newResidentName, setNewResidentName] = useState<string>("");
  const [newResidentRtRw, setNewResidentRtRw] = useState<string>(
    "RT 04 / RW 08 Coblong, Bandung"
  );
  const [newResidentCategory, setNewResidentCategory] = useState<string>(
    "Verified Vulnerable Household"
  );
  const [newResidentPhone, setNewResidentPhone] = useState<string>(
    "0812-3456-7890 (SMS / Mobile Web)"
  );

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

  // Beneficiary Wallet State
  const [walletBeneficiaryId, setWalletBeneficiaryId] =
    useState<string>("WGA-0401");
  const [selectedVoucherForQR, setSelectedVoucherForQR] =
    useState<Voucher | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedSms, setCopiedSms] = useState<boolean>(false);

  // Merchant POS State
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
          "Network connection restored. Sync queued transactions when ready."
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
      if (!res.ok) throw new Error("Failed to load clearinghouse state");
      const data = await res.json();
      await applyServerState(data);
      const q = await getOfflineRedemptionQueue();
      setOfflineQueue(q);
    } catch {
      const cached = await getCachedVouchersFromIndexedDB();
      if (cached.length > 0) setVouchers(cached);
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

  // High-contrast monochrome QR code (#09090b on #ffffff)
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
                    `Captured QR token ${decoded.code}. Ready for verification.`
                  );
                }
              }
            } catch {
              // Ignore frame error
            }
          }, 500);
        }
      }, 150);
    } catch {
      showToast(
        "warning",
        "Camera permission unavailable. Select a voucher below or enter the 6-character code manually."
      );
    }
  };

  // ==================== ACTIONS ====================

  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOfflineMode) {
      showToast(
        "warning",
        "Issuing new vouchers requires connectivity. Switch to Online mode (Merchant POS remains offline-capable)."
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
        `Issued voucher ${data.voucher.short_code} (${data.voucher.commodity_name}) for ${data.voucher.beneficiary_name}.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Request failed");
    }
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidentName.trim()) return;
    if (isOfflineMode) {
      showToast("warning", "Switch to Online mode to register beneficiaries.");
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
        `Registered beneficiary ${data.beneficiary.name} (${data.beneficiary.id}).`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Request failed");
    }
  };

  const handleAddMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchantName.trim() || !newMerchantOwner.trim()) return;
    if (isOfflineMode) {
      showToast("warning", "Switch to Online mode to register merchants.");
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
        `Onboarded merchant ${data.merchant.name} (${data.merchant.id}).`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Request failed");
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
      `Loaded ${voucher.short_code} into Merchant Terminal for verification.`
    );
  };

  const handleCopySmsSlip = (voucher: Voucher) => {
    const text = `[CivicLedger Aid Voucher]\nRecipient: ${voucher.beneficiary_name}\nCode: ${voucher.short_code}\nPackage: ${voucher.commodity_name} (${formatRupiah(voucher.nominal_idr)})\nValid until: ${formatDateTime(voucher.expires_at)}\nPresent this code at any partner Warung.`;
    navigator.clipboard.writeText(text);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2200);
    showToast("info", `Copied SMS slip for ${voucher.short_code}.`);
  };

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
        "Enter a valid 6-character code (e.g., CL-8841-K9) or pick a voucher from the list."
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
          "HMAC-SHA256 signature mismatch. Altered payload nominal (Rp 500,000) rejected without server round-trip.",
      });
      showToast(
        "error",
        "Rejected: HMAC-SHA256 verification detected payload tampering."
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
        errorReason: `Duplicate redemption blocked. Nonce '${targetVoucher.nonce}' is already marked spent in IndexedDB / Ledger.`,
      });
      showToast(
        "error",
        `Duplicate rejected: Voucher ${targetVoucher.short_code} has already been spent.`
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
        `Verified offline in ${durationMs} ms. Buffered in IndexedDB (${clientTxId}) awaiting sync.`
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
        `Committed ${targetVoucher.short_code} at ${merchant.name} (+${formatRupiah(targetVoucher.nominal_idr)}) in ${durationMs} ms.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Request failed");
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
      `Queued simulated duplicate claim for ${candidate.short_code} from ${altMerchant.name}. Run Batch Sync to test reconciliation.`
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
        `Reconciliation complete: ${synced} committed, ${conflicts} duplicate conflict(s) rejected and logged.`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncingBatch(false);
    }
  };

  const handleSettleMerchants = async (merchantId?: string) => {
    if (isOfflineMode) {
      showToast("warning", "Switch to Online mode to run batch settlements.");
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
        `Settled ${formatRupiah(totalDisbursed)} across ${data.batches.length} merchant(s) (simulated rail).`
      );
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Settlement error");
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
                ? `${serverRes.message} Verified by server & WebCrypto.`
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
    a.download = `civicledger-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Exported transaction ledger as CSV.");
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
    a.download = `civicledger-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Exported full audit snapshot as JSON.");
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
      if (data.state) await applyServerState(data.state);
      setOfflineQueue([]);
      setCryptoTrace(null);
      setLastSyncResults(null);
      setChainCheckResult(null);
      setIsOfflineMode(false);
      showToast("info", "Reset to initial synthetic demonstration state.");
    } catch {
      // Ignore
    }
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
        ? "Go API · Local"
        : "Next.js Local";

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    section: "OPERATIONS" | "CLEARINGHOUSE";
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: "COORDINATOR",
      label: "Organizer Console",
      section: "OPERATIONS",
      icon: LayoutGrid,
    },
    {
      id: "BENEFICIARY",
      label: "Beneficiary Pass",
      section: "OPERATIONS",
      icon: QrCode,
    },
    {
      id: "MERCHANT_POS",
      label: "Merchant Terminal",
      section: "OPERATIONS",
      icon: ScanLine,
      badge: offlineQueue.length > 0 ? offlineQueue.length : undefined,
    },
    {
      id: "CLEARINGHOUSE",
      label: "Clearinghouse",
      section: "CLEARINGHOUSE",
      icon: Landmark,
    },
    {
      id: "REPORTS",
      label: "Reports & Audit",
      section: "CLEARINGHOUSE",
      icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#09090B] text-zinc-100">
      {/* ==================== LEFT NAVIGATION RAIL (DESKTOP) ==================== */}
      <aside className="no-print hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0C0C0E] border-r border-zinc-800/80 z-30">
        {/* Minimal Monochrome Brand Header */}
        <div className="h-14 px-5 flex items-center gap-2.5 border-b border-zinc-800/80">
          <div className="w-6 h-6 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-zinc-950" fill="none">
              <path
                d="M4 7h16M4 12h10M4 17h16"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="square"
              />
              <rect x="17" y="10" width="3" height="4" fill="currentColor" />
            </svg>
          </div>
          <span className="font-semibold text-[14px] tracking-[-0.02em] text-zinc-100">
            CivicLedger
          </span>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          <div>
            <p className="px-2.5 mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              Operations
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
                          ? "bg-zinc-800/90 text-zinc-50 font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${active ? "text-zinc-100" : "text-zinc-500"}`}
                        />
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-amber-500/20 text-amber-300 tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <p className="px-2.5 mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              Clearinghouse
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
                          ? "bg-zinc-800/90 text-zinc-50 font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${active ? "text-zinc-100" : "text-zinc-500"}`}
                        />
                        {item.label}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </nav>

        {/* Bottom System Panel & Network Switch */}
        <div className="p-3.5 border-t border-zinc-800/80 space-y-3">
          {/* Segmented Network Mode Control */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-1.5 px-1">
              Connectivity Mode
            </p>
            <div className="grid grid-cols-2 p-0.5 rounded-lg bg-zinc-950 border border-zinc-800/90 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => {
                  if (isOfflineMode) {
                    setIsOfflineMode(false);
                    showToast("info", "Restored online clearinghouse mode.");
                  }
                }}
                className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  !isOfflineMode
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${!isOfflineMode ? "bg-emerald-400" : "bg-zinc-600"}`}
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
                      "Offline simulation enabled. Verification runs locally via WebCrypto & IndexedDB."
                    );
                  }
                }}
                className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  isOfflineMode
                    ? "bg-zinc-800 text-amber-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? "bg-amber-400" : "bg-zinc-600"}`}
                />
                Offline
              </button>
            </div>
          </div>

          {/* Runtime Info */}
          <div className="px-1 space-y-1 text-[11px] text-zinc-500">
            <div className="flex items-center justify-between">
              <span>Engine</span>
              <span className="font-mono text-zinc-300">{engineBadgeText}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Storage</span>
              <span className="font-mono text-zinc-400">
                IndexedDB{swRegistered ? " · SW" : ""}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDemo}
            className="w-full py-1.5 px-2.5 rounded-lg border border-zinc-800/90 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Synthetic Data
          </button>
        </div>
      </aside>

      {/* ==================== MAIN SHELL ==================== */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top Utility Header */}
        <header className="no-print sticky top-0 z-20 h-14 bg-[#09090B]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className="lg:hidden w-6 h-6 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-zinc-950" fill="none">
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
              <h1 className="text-[14px] font-medium tracking-[-0.015em] text-zinc-100 truncate">
                {TAB_META[activeTab].title}
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 truncate">
                {TAB_META[activeTab].subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {offlineQueue.length > 0 && (
              <button
                onClick={handleSyncOfflineBatch}
                disabled={isSyncingBatch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                />
                <span className="tabular-nums">
                  Sync Queue ({offlineQueue.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsOfflineMode(!isOfflineMode)}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? "bg-amber-400" : "bg-emerald-400"}`}
              />
              {isOfflineMode ? "Offline" : "Online"}
            </button>

            <span className="hidden md:inline-block text-[11px] font-mono text-zinc-500">
              STACK 2026 · Team Run.exe
            </span>
          </div>
        </header>

        {/* Mobile Tab Strip */}
        <div className="no-print lg:hidden border-b border-zinc-800/80 bg-[#0C0C0E] px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Offline Notice Strip */}
        {isOfflineMode && (
          <div className="no-print bg-amber-500/[0.07] border-b border-amber-500/20 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-amber-200/90">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>
                  Offline simulation active — Merchant verification runs locally
                  via <span className="font-mono">crypto.subtle</span> and
                  buffers in <span className="font-mono">IndexedDB</span>.
                </span>
              </div>
              {offlineQueue.length > 0 && (
                <button
                  onClick={handleSyncOfflineBatch}
                  className="text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-4 self-start sm:self-auto"
                >
                  Reconnect &amp; Sync ({offlineQueue.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Minimal Notification Toast Bar */}
        {actionBanner && (
          <div className="no-print px-4 sm:px-6 lg:px-8 pt-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#141417] border border-zinc-800 text-xs text-zinc-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    actionBanner.type === "success"
                      ? "bg-emerald-400"
                      : actionBanner.type === "warning"
                        ? "bg-amber-400"
                        : actionBanner.type === "error"
                          ? "bg-rose-400"
                          : "bg-zinc-400"
                  }`}
                />
                <span className="truncate">{actionBanner.text}</span>
              </div>
              <button
                onClick={() => setActionBanner(null)}
                className="text-zinc-500 hover:text-zinc-300 shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== MAIN WORKSPACE ==================== */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="py-20 text-center text-xs font-mono text-zinc-500">
                Initializing clearinghouse state...
              </div>
            ) : (
              <>
                {/* ============================================================
                    VIEW 1: ORGANIZER CONSOLE
                   ============================================================ */}
                {activeTab === "COORDINATOR" && (
                  <div className="space-y-6">
                    {/* Unified Metric Strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80 border border-zinc-800/90 bg-[#111113] rounded-xl overflow-hidden">
                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Aid Pool Balance
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
                          {formatRupiah(poolTotalIdr)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Commodity-locked mutual aid
                        </p>
                      </div>

                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Active Vouchers
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
                          {activeVouchersCount}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                          {vouchers.length} total issued
                        </p>
                      </div>

                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Local Stall Volume
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
                          {formatRupiah(totalWarungTurnover)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                          {merchants.length} participating warungs
                        </p>
                      </div>

                      <div className="p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Verified Directory
                        </p>
                        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-zinc-50 mt-2">
                          {beneficiaries.length}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                          {fraudBlockedCount} anomaly attempt(s) blocked
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* Left: Issue Voucher Panel */}
                      <div className="lg:col-span-5 bg-[#111113] rounded-xl border border-zinc-800/90 p-5 space-y-5">
                        <div className="flex items-center justify-between gap-2 pb-4 border-b border-zinc-800/80">
                          <div>
                            <h2 className="text-sm font-medium text-zinc-100">
                              Issue Voucher
                            </h2>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Generate HMAC-SHA256 signed allowance
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddResidentForm(!showAddResidentForm);
                                setShowAddMerchantForm(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 transition"
                            >
                              <Plus className="w-3 h-3" />
                              Resident
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddMerchantForm(!showAddMerchantForm);
                                setShowAddResidentForm(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 transition"
                            >
                              <Plus className="w-3 h-3" />
                              Merchant
                            </button>
                          </div>
                        </div>

                        {showAddResidentForm && (
                          <form
                            onSubmit={handleAddBeneficiary}
                            className="p-4 rounded-lg bg-[#0C0C0E] border border-zinc-800 space-y-3"
                          >
                            <p className="text-xs font-medium text-zinc-200">
                              Register Beneficiary Household
                            </p>
                            <input
                              type="text"
                              required
                              placeholder="Full name (e.g., Pak Hendra Wijaya)"
                              value={newResidentName}
                              onChange={(e) =>
                                setNewResidentName(e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={newResidentRtRw}
                                onChange={(e) =>
                                  setNewResidentRtRw(e.target.value)
                                }
                                placeholder="RT / RW"
                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
                              />
                              <input
                                type="text"
                                value={newResidentCategory}
                                onChange={(e) =>
                                  setNewResidentCategory(e.target.value)
                                }
                                placeholder="Category"
                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              value={newResidentPhone}
                              onChange={(e) =>
                                setNewResidentPhone(e.target.value)
                              }
                              placeholder="Phone / SMS"
                              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowAddResidentForm(false)}
                                className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium"
                              >
                                Save Resident
                              </button>
                            </div>
                          </form>
                        )}

                        {showAddMerchantForm && (
                          <form
                            onSubmit={handleAddMerchant}
                            className="p-4 rounded-lg bg-[#0C0C0E] border border-zinc-800 space-y-3"
                          >
                            <p className="text-xs font-medium text-zinc-200">
                              Onboard Local Merchant (Warung)
                            </p>
                            <input
                              type="text"
                              required
                              placeholder="Stall name (e.g., Warung Sembako Maju)"
                              value={newMerchantName}
                              onChange={(e) =>
                                setNewMerchantName(e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                required
                                placeholder="Owner name"
                                value={newMerchantOwner}
                                onChange={(e) =>
                                  setNewMerchantOwner(e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none"
                              />
                              <input
                                type="text"
                                value={newMerchantRtRw}
                                onChange={(e) =>
                                  setNewMerchantRtRw(e.target.value)
                                }
                                placeholder="Location"
                                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              value={newMerchantBank}
                              onChange={(e) =>
                                setNewMerchantBank(e.target.value)
                              }
                              placeholder="Bank / QRIS account"
                              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowAddMerchantForm(false)}
                                className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium"
                              >
                                Save Merchant
                              </button>
                            </div>
                          </form>
                        )}

                        <form onSubmit={handleIssueVoucher} className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                              Beneficiary
                            </label>
                            <select
                              value={selectedBeneficiaryId}
                              onChange={(e) =>
                                setSelectedBeneficiaryId(e.target.value)
                              }
                              className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
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
                              Commodity Package
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
                                        ? "bg-zinc-900 border-zinc-500"
                                        : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
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
                                        className="mt-0.5 accent-zinc-100"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-zinc-100">
                                          {item.name}
                                        </p>
                                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                                          {item.items}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-mono text-xs text-zinc-200 tabular-nums whitespace-nowrap">
                                      {formatRupiah(item.nominal_idr)}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                              Validity Window
                            </label>
                            <select
                              value={validityHours}
                              onChange={(e) =>
                                setValidityHours(Number(e.target.value))
                              }
                              className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
                            >
                              <option value={24}>24 Hours · Emergency</option>
                              <option value={72}>72 Hours · Standard</option>
                              <option value={168}>7 Days · Weekly</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs transition"
                          >
                            Issue &amp; Sign Voucher
                          </button>

                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            Signed with single-use nonce and HMAC-SHA256 for
                            offline browser verification.
                          </p>
                        </form>
                      </div>

                      {/* Right: Allocation Registry Table */}
                      <div className="lg:col-span-7 bg-[#111113] rounded-xl border border-zinc-800/90 overflow-hidden">
                        <div className="p-5 border-b border-zinc-800/80 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h2 className="text-sm font-medium text-zinc-100">
                                Allocation Registry
                              </h2>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Track issued vouchers across their lifecycle
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                              {filteredVouchers.length} records
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                value={voucherSearch}
                                onChange={(e) =>
                                  setVoucherSearch(e.target.value)
                                }
                                placeholder="Filter by code, beneficiary, or commodity..."
                                className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none"
                              />
                            </div>
                            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800">
                              {(
                                ["ALL", "ACTIVE", "REDEEMED", "SETTLED"] as const
                              ).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => setVoucherStatusFilter(st)}
                                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
                                    voucherStatusFilter === st
                                      ? "bg-zinc-800 text-zinc-100"
                                      : "text-zinc-500 hover:text-zinc-300"
                                  }`}
                                >
                                  {st === "ALL"
                                    ? "All"
                                    : st.charAt(0) + st.slice(1).toLowerCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-800/80 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 bg-[#0E0E10]">
                                <th className="py-2.5 pl-5 pr-3">Code</th>
                                <th className="py-2.5 px-3">Beneficiary</th>
                                <th className="py-2.5 px-3">Package</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 pl-3 pr-5 text-right">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 text-xs">
                              {filteredVouchers.map((v) => (
                                <tr
                                  key={v.id}
                                  className="hover:bg-zinc-900/40 transition"
                                >
                                  <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                                    <span className="font-mono font-medium text-zinc-100">
                                      {v.short_code}
                                    </span>
                                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                      {v.id}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="font-medium text-zinc-200">
                                      {v.beneficiary_name}
                                    </div>
                                    <div className="text-[11px] text-zinc-500">
                                      {v.rt_rw}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3">
                                    <div className="text-zinc-200">
                                      {v.commodity_name}
                                    </div>
                                    <div className="font-mono text-[11px] text-zinc-400 tabular-nums mt-0.5">
                                      {formatRupiah(v.nominal_idr)}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          v.status === "ACTIVE"
                                            ? "bg-emerald-400"
                                            : v.status === "REDEEMED"
                                              ? "bg-amber-400"
                                              : "bg-zinc-400"
                                        }`}
                                      />
                                      {v.status === "ACTIVE"
                                        ? "Active"
                                        : v.status === "REDEEMED"
                                          ? "Redeemed"
                                          : "Settled"}
                                    </span>
                                    {v.redeemed_by_merchant_name && (
                                      <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[130px]">
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
                                      className="px-2.5 py-1 rounded-md border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium transition"
                                    >
                                      Pass
                                    </button>
                                    {v.status === "ACTIVE" && (
                                      <button
                                        onClick={() =>
                                          sendVoucherToMerchantScanner(v)
                                        }
                                        className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-[11px] font-medium transition"
                                      >
                                        Redeem
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

                {/* ============================================================
                    VIEW 2: BENEFICIARY PASS
                   ============================================================ */}
                {activeTab === "BENEFICIARY" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Profile & Voucher Selector */}
                    <div className="no-print lg:col-span-5 bg-[#111113] rounded-xl border border-zinc-800/90 p-5 space-y-5">
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                          Beneficiary Household
                        </label>
                        <select
                          value={walletBeneficiaryId}
                          onChange={(e) =>
                            setWalletBeneficiaryId(e.target.value)
                          }
                          className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
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
                          Assigned Vouchers
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
                                    ? "bg-zinc-900 border-zinc-500"
                                    : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs font-medium text-zinc-100">
                                    {v.short_code}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        v.status === "ACTIVE"
                                          ? "bg-emerald-400"
                                          : "bg-zinc-500"
                                      }`}
                                    />
                                    {v.status}
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-zinc-200 mt-2">
                                  {v.commodity_name}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  {v.commodity_items}
                                </p>
                                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/80 text-[11px] font-mono tabular-nums">
                                  <span className="text-zinc-200">
                                    {formatRupiah(v.nominal_idr)}
                                  </span>
                                  <span className="text-zinc-500">
                                    Exp {formatDateTime(v.expires_at)}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Right: Monochrome Architectural Voucher Pass */}
                    <div className="lg:col-span-7 flex justify-center">
                      {selectedVoucherForQR ? (
                        <div className="w-full max-w-md bg-[#111113] rounded-xl border border-zinc-800 overflow-hidden">
                          {/* Pass Header */}
                          <div className="p-5 bg-[#161619] border-b border-zinc-800/90 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500">
                                CivicLedger · Voucher Pass
                              </p>
                              <h3 className="text-base font-semibold tracking-[-0.015em] text-zinc-50 mt-1">
                                {selectedVoucherForQR.beneficiary_name}
                              </h3>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {selectedVoucherForQR.rt_rw}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  selectedVoucherForQR.status === "ACTIVE"
                                    ? "bg-emerald-400"
                                    : "bg-zinc-500"
                                }`}
                              />
                              {selectedVoucherForQR.status}
                            </span>
                          </div>

                          {/* Pass Body */}
                          <div className="p-6 space-y-5">
                            <div className="flex items-baseline justify-between gap-4">
                              <div>
                                <p className="text-xs font-medium text-zinc-200">
                                  {selectedVoucherForQR.commodity_name}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  {selectedVoucherForQR.commodity_items}
                                </p>
                              </div>
                              <p className="text-xl font-semibold tracking-[-0.02em] tabular-nums text-zinc-50 whitespace-nowrap">
                                {formatRupiah(selectedVoucherForQR.nominal_idr)}
                              </p>
                            </div>

                            {/* High-Contrast White QR Container for Reliable Scanning */}
                            <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-zinc-950 border border-zinc-800/90">
                              {qrDataUrl ? (
                                <div className="p-3 bg-white rounded-lg">
                                  <img
                                    src={qrDataUrl}
                                    alt="Voucher QR Code"
                                    className="w-48 h-48 block"
                                  />
                                </div>
                              ) : (
                                <div className="w-48 h-48 flex items-center justify-center text-xs text-zinc-500">
                                  Generating QR...
                                </div>
                              )}
                              <div className="mt-4 w-full pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-zinc-500">
                                  SMS / Print Token
                                </span>
                                <span className="font-mono text-base font-semibold tracking-[0.14em] text-zinc-100">
                                  {selectedVoucherForQR.short_code}
                                </span>
                              </div>
                            </div>

                            {/* Metadata Table */}
                            <div className="p-3.5 rounded-lg bg-[#0C0C0E] border border-zinc-800/80 font-mono text-[11px] space-y-1.5">
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500">ID</span>
                                <span className="text-zinc-300">
                                  {selectedVoucherForQR.id}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500">NONCE</span>
                                <span className="text-zinc-300">
                                  {selectedVoucherForQR.nonce}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-zinc-500 shrink-0">
                                  HMAC-SHA256
                                </span>
                                <span className="text-zinc-400 truncate">
                                  {selectedVoucherForQR.hmac_signature}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="no-print space-y-2.5">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopySmsSlip(selectedVoucherForQR)
                                  }
                                  className="py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                                >
                                  {copiedSms ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Copied
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
                                  className="py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Print Slip
                                </button>
                              </div>

                              {selectedVoucherForQR.status === "ACTIVE" ? (
                                <button
                                  onClick={() =>
                                    sendVoucherToMerchantScanner(
                                      selectedVoucherForQR
                                    )
                                  }
                                  className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs flex items-center justify-center gap-1.5 transition"
                                >
                                  <span>Open in Merchant Terminal</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center text-xs text-zinc-400">
                                  Redeemed at{" "}
                                  {
                                    selectedVoucherForQR.redeemed_by_merchant_name
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#111113] rounded-xl border border-zinc-800 p-12 text-center text-zinc-500 text-xs">
                          No vouchers assigned to this beneficiary.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================================================
                    VIEW 3: MERCHANT POS TERMINAL
                   ============================================================ */}
                {activeTab === "MERCHANT_POS" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left: Terminal Controls */}
                    <div className="lg:col-span-6 bg-[#111113] rounded-xl border border-zinc-800/90 p-5 space-y-5">
                      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                        <div>
                          <h2 className="text-sm font-medium text-zinc-100">
                            Redemption Scanner
                          </h2>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Verify QR payloads or 6-character codes offline
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition"
                        >
                          {cameraActive ? (
                            <>
                              <CameraOff className="w-3.5 h-3.5 text-zinc-400" />
                              Stop Camera
                            </>
                          ) : (
                            <>
                              <Camera className="w-3.5 h-3.5 text-zinc-400" />
                              Camera Scan
                            </>
                          )}
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                          Active Merchant
                        </label>
                        <select
                          value={activeMerchantId}
                          onChange={(e) => setActiveMerchantId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 text-xs text-zinc-100 outline-none"
                        >
                          {merchants.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.owner}) · Unsettled{" "}
                              {formatRupiah(m.unsettled_balance_idr)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {cameraActive && (
                        <div className="relative rounded-lg overflow-hidden bg-black aspect-video border border-zinc-800">
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
                                ? "Auto-detect QR active"
                                : "Camera preview active"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Quick-Pick Voucher List */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                          Quick-Load Voucher (Single-Device Demo)
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
                                    ? "bg-zinc-100 text-zinc-950 border-zinc-100 font-medium"
                                    : v.status === "ACTIVE"
                                      ? "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-600"
                                      : "bg-zinc-950/50 text-zinc-600 border-zinc-800/60"
                                }`}
                              >
                                {v.short_code} · {v.status.toLowerCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Manual Code Input */}
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 mb-1.5">
                          Alphanumeric Code
                        </label>
                        <input
                          type="text"
                          value={scannerInputCode}
                          onChange={(e) => {
                            setScannerInputCode(e.target.value.toUpperCase());
                            setScannedQRPayloadRaw("");
                          }}
                          placeholder="CL-8841-K9"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-zinc-500 font-mono text-sm tracking-wider uppercase text-zinc-100 placeholder:text-zinc-600 outline-none"
                        />
                      </div>

                      {/* Actions */}
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleVerifyAndRedeem(false)}
                          className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs transition"
                        >
                          Verify HMAC-SHA256 &amp; Redeem
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyAndRedeem(true)}
                            className="py-2 px-3 rounded-lg bg-zinc-950 hover:bg-rose-950/30 border border-zinc-800 hover:border-rose-900/50 text-rose-400 text-xs font-medium transition"
                          >
                            Test Tampered Payload
                          </button>

                          <button
                            type="button"
                            onClick={handleSimulateOfflineConflict}
                            className="py-2 px-3 rounded-lg bg-zinc-950 hover:bg-amber-950/30 border border-zinc-800 hover:border-amber-900/50 text-amber-300 text-xs font-medium transition"
                          >
                            Simulate Offline Conflict
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Cryptographic Inspector + Offline Queue */}
                    <div className="lg:col-span-6 space-y-5">
                      {/* WebCrypto Inspector */}
                      <div className="bg-[#0D0D10] rounded-xl border border-zinc-800/90 overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-200">
                            Web Crypto Verifier{" "}
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
                                      ? "Verification Passed"
                                      : "Verification Rejected"}
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
                                    CLIENT_TX
                                  </span>
                                  <span className="text-zinc-200 truncate">
                                    {cryptoTrace.clientTxId}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-500 shrink-0">
                                    CANONICAL
                                  </span>
                                  <span className="text-zinc-300 truncate">
                                    {cryptoTrace.canonicalMessage}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-500 shrink-0">
                                    PROVIDED_SIG
                                  </span>
                                  <span className="text-zinc-400 truncate">
                                    {cryptoTrace.providedSignature}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-500 shrink-0">
                                    COMPUTED_HMAC
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
                                    NONCE_STATUS
                                  </span>
                                  <span
                                    className={
                                      cryptoTrace.doubleSpendCheckPassed
                                        ? "text-emerald-400"
                                        : "text-rose-400"
                                    }
                                  >
                                    {cryptoTrace.doubleSpendCheckPassed
                                      ? "UNSPENT"
                                      : "ALREADY_SPENT"}
                                  </span>
                                </div>
                                {cryptoTrace.receiptHash && (
                                  <div className="flex justify-between gap-4">
                                    <span className="text-zinc-500 shrink-0">
                                      RECEIPT_SHA256
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
                              Select a voucher and execute verification to
                              inspect the cryptographic trace.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* IndexedDB Offline Queue */}
                      <div className="bg-[#111113] rounded-xl border border-zinc-800/90 p-5 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-zinc-100">
                            Offline Queue{" "}
                            <span className="font-mono text-xs text-zinc-500">
                              (IndexedDB)
                            </span>
                          </h3>
                          <span className="font-mono text-xs text-zinc-400 tabular-nums">
                            {offlineQueue.length} pending
                          </span>
                        </div>

                        {offlineQueue.length === 0 ? (
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            Queue is empty. Switch to{" "}
                            <span className="text-zinc-300">Offline</span> mode
                            in the sidebar and redeem a voucher, or run{" "}
                            <span className="text-zinc-300">
                              Simulate Offline Conflict
                            </span>
                            .
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {offlineQueue.map((item) => (
                                <div
                                  key={item.queue_id}
                                  className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium text-zinc-100">
                                        {item.short_code}
                                      </span>
                                      {item.is_simulated_conflict && (
                                        <span className="text-[10px] font-mono text-rose-400 border border-rose-900/60 bg-rose-950/30 px-1.5 py-0.5 rounded">
                                          CONFLICT_TEST
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
                                  <span className="font-mono text-zinc-200 tabular-nums whitespace-nowrap">
                                    {formatRupiah(item.nominal_idr)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <button
                              onClick={handleSyncOfflineBatch}
                              disabled={isSyncingBatch}
                              className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs flex items-center justify-center gap-2 transition"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${isSyncingBatch ? "animate-spin" : ""}`}
                              />
                              <span>Sync &amp; Reconcile Batch</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Latest Sync Reconciliation Report */}
                      {lastSyncResults && lastSyncResults.length > 0 && (
                        <div className="bg-[#111113] rounded-xl border border-zinc-800/90 p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-zinc-400">
                              Latest Reconciliation Output
                            </h3>
                            <button
                              onClick={() => setLastSyncResults(null)}
                              className="text-[11px] text-zinc-500 hover:text-zinc-300"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            {lastSyncResults.map((r) => (
                              <div
                                key={r.client_tx_id}
                                className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-zinc-200">
                                    {r.short_code} · {r.client_tx_id}
                                  </span>
                                  <span
                                    className={`font-mono text-[10px] ${
                                      r.status === "SYNCED"
                                        ? "text-emerald-400"
                                        : "text-rose-400"
                                    }`}
                                  >
                                    {r.outcome}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 mt-1">
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
                    VIEW 4: CLEARINGHOUSE & AUDIT LEDGER
                   ============================================================ */}
                {activeTab === "CLEARINGHOUSE" && (
                  <div className="space-y-6">
                    {/* Merchant Settlement Section */}
                    <div className="bg-[#111113] rounded-xl border border-zinc-800/90 p-5 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-800/80">
                        <div>
                          <h2 className="text-sm font-medium text-zinc-100">
                            Merchant Settlement Queue
                          </h2>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Aggregate redeemed vouchers into hashed payout
                            batches (simulated rail).
                          </p>
                        </div>

                        <button
                          onClick={() => handleSettleMerchants()}
                          disabled={totalUnsettledIdr === 0}
                          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition tabular-nums ${
                            totalUnsettledIdr > 0
                              ? "bg-zinc-100 hover:bg-white text-zinc-950"
                              : "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                          }`}
                        >
                          Settle All ({formatRupiah(totalUnsettledIdr)})
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {merchants.map((m) => (
                          <div
                            key={m.id}
                            className="p-4 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                                <span>{m.id}</span>
                                <span className="tabular-nums">
                                  {m.redemption_count} tx
                                </span>
                              </div>
                              <h3 className="text-sm font-medium text-zinc-100 mt-1.5">
                                {m.name}
                              </h3>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {m.rt_rw}
                              </p>
                              <p className="text-[11px] font-mono text-zinc-400 mt-2">
                                {m.bank_account}
                              </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Pending</span>
                                <span className="font-mono text-zinc-100 tabular-nums">
                                  {formatRupiah(m.unsettled_balance_idr)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Settled</span>
                                <span className="font-mono text-zinc-400 tabular-nums">
                                  {formatRupiah(m.total_settled_idr)}
                                </span>
                              </div>
                              {m.unsettled_balance_idr > 0 && (
                                <button
                                  onClick={() => handleSettleMerchants(m.id)}
                                  className="w-full mt-2.5 py-1.5 px-3 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium transition"
                                >
                                  Settle Merchant
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Immutable Hash-Chained Ledger */}
                    <div className="bg-[#111113] rounded-xl border border-zinc-800/90 overflow-hidden">
                      <div className="p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-zinc-100">
                            SHA-256 Hash-Chained Audit Ledger
                          </h3>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Append-only transaction log linking{" "}
                            <span className="font-mono text-zinc-400">
                              prev_hash
                            </span>{" "}
                            to{" "}
                            <span className="font-mono text-zinc-400">
                              tx_hash
                            </span>
                            .
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleVerifyHashChain}
                          disabled={isVerifyingChain}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium shrink-0 transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
                          <span>
                            {isVerifyingChain
                              ? "Verifying..."
                              : "Verify Chain Integrity"}
                          </span>
                        </button>
                      </div>

                      {chainCheckResult && (
                        <div className="px-5 py-3 bg-[#0E0E10] border-b border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            {chainCheckResult.valid ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            )}
                            <span className="text-zinc-200">
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
                            <tr className="border-b border-zinc-800/80 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 bg-[#0E0E10]">
                              <th className="py-2.5 pl-5 pr-3">Transaction</th>
                              <th className="py-2.5 px-3">Voucher</th>
                              <th className="py-2.5 px-3">Merchant</th>
                              <th className="py-2.5 px-3">Mode</th>
                              <th className="py-2.5 pl-3 pr-5">
                                Hash Chain (Prev / Curr)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60 text-xs">
                            {ledger.map((entry) => (
                              <tr
                                key={entry.id}
                                className="hover:bg-zinc-900/40 transition"
                              >
                                <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                                  <span className="font-mono font-medium text-zinc-100">
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
                                  <span className="font-mono text-zinc-200">
                                    {entry.short_code}
                                  </span>{" "}
                                  <span className="text-zinc-400">
                                    · {entry.commodity_name}
                                  </span>
                                  <div className="font-mono text-[11px] text-zinc-300 tabular-nums mt-0.5">
                                    {formatRupiah(entry.nominal_idr)} ·{" "}
                                    {entry.beneficiary_id}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3">
                                  <div className="text-zinc-200">
                                    {entry.merchant_name}
                                  </div>
                                  <div className="text-[11px] text-zinc-500">
                                    {entry.settlement_batch_id
                                      ? `Settled (${entry.settlement_batch_id})`
                                      : "Unsettled"}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 whitespace-nowrap">
                                  <span className="font-mono text-[10px] text-zinc-400 border border-zinc-800 bg-zinc-950 px-2 py-0.5 rounded">
                                    {entry.sync_mode}
                                  </span>
                                </td>
                                <td className="py-3.5 pl-3 pr-5 font-mono text-[10px] text-zinc-500 max-w-xs">
                                  <div className="truncate">
                                    P: {entry.prev_hash.slice(0, 22)}...
                                  </div>
                                  <div className="truncate text-zinc-300">
                                    C: {entry.tx_hash.slice(0, 22)}...
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Reconciliation Log & Settlement Receipts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="bg-[#111113] rounded-xl border border-zinc-800/90 p-5">
                        <h3 className="text-sm font-medium text-zinc-100">
                          Reconciliation Audit Log
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 mb-4">
                          Server validation history for offline batch syncs
                        </p>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {reconciliationLogs.map((log) => (
                            <div
                              key={log.id}
                              className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-zinc-200">
                                  {log.short_code} · {log.client_tx_id}
                                </span>
                                <span
                                  className={`font-mono text-[10px] ${
                                    log.outcome === "SYNCED"
                                      ? "text-emerald-400"
                                      : "text-rose-400"
                                  }`}
                                >
                                  {log.outcome}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 mt-1">
                                {log.reason}
                              </p>
                              <p className="text-[10px] text-zinc-600 mt-1">
                                {log.merchant_name} ·{" "}
                                {formatDateTime(log.processed_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-[#111113] rounded-xl border border-zinc-800/90 p-5">
                        <h3 className="text-sm font-medium text-zinc-100">
                          Settlement Receipts
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 mb-4">
                          SHA-256 hashed merchant payout batches
                        </p>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {settlementBatches.map((b) => (
                            <div
                              key={b.id}
                              className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-zinc-200">
                                    {b.id}
                                  </span>
                                  <span className="text-[11px] text-zinc-500 tabular-nums">
                                    {formatDateTime(b.settled_at)}
                                  </span>
                                </div>
                                <p className="text-zinc-300 mt-1 truncate">
                                  {b.merchant_name} · {b.bank_account}
                                </p>
                                <p className="font-mono text-[10px] text-zinc-600 mt-0.5 truncate">
                                  SHA256 {b.batch_hash.slice(0, 26)}...
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-medium text-zinc-100 tabular-nums">
                                  {formatRupiah(b.total_amount_idr)}
                                </span>
                                <p className="text-[11px] text-zinc-500 tabular-nums">
                                  {b.voucher_count} voucher(s)
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================
                    VIEW 5: REPORTS & AUDIT
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
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
