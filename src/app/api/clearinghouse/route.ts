import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  COMMODITY_CATALOG,
  computeLedgerTxHashNode,
  loadClearinghouseState,
  resetClearinghouseState,
  saveClearinghouseState,
  signVoucherNodeHmac,
  verifyLedgerChainNode,
} from "@/lib/server-ledger";
import { GENESIS_HASH } from "@/lib/crypto";
import {
  BatchSyncResultItem,
  LedgerEntry,
  ReconciliationLog,
  SettlementBatch,
  Voucher,
} from "@/lib/types";

const GO_BACKEND_URL =
  process.env.GO_BACKEND_URL || "http://127.0.0.1:8081";

async function proxyToGoBackend(
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${GO_BACKEND_URL}${path}`, {
      method,
      headers:
        method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const op = req.nextUrl.searchParams.get("op");

  if (op === "verify_chain") {
    const goRes = await proxyToGoBackend("/api/v1/ledger/verify", "GET");
    if (goRes) {
      const data = await goRes.json();
      return NextResponse.json(data, { status: goRes.status });
    }
    const state = loadClearinghouseState();
    return NextResponse.json(verifyLedgerChainNode(state.ledger));
  }

  const goRes = await proxyToGoBackend("/api/v1/state", "GET");
  if (goRes && goRes.ok) {
    const data = await goRes.json();
    return NextResponse.json(data);
  }

  const state = loadClearinghouseState();
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Attempt to route directly to the Golang + PostgreSQL Clearinghouse REST API
    const goActionMap: Record<string, string> = {
      RESET_DEMO: "/api/v1/reset",
      ISSUE_VOUCHER: "/api/v1/vouchers/issue",
      ADD_BENEFICIARY: "/api/v1/beneficiaries",
      ADD_MERCHANT: "/api/v1/merchants",
      REDEEM_VOUCHER: "/api/v1/vouchers/redeem",
      BATCH_SYNC: "/api/v1/sync/batch",
      SETTLE_MERCHANTS: "/api/v1/settlements",
    };

    if (goActionMap[action]) {
      const goRes = await proxyToGoBackend(goActionMap[action], "POST", body);
      if (goRes) {
        const data = await goRes.json();
        return NextResponse.json(data, { status: goRes.status });
      }
    }

    // Seamless fallback to built-in Next.js Clearinghouse Engine when Go API is offline
    const state = loadClearinghouseState();

    if (action === "RESET_DEMO") {
      const fresh = resetClearinghouseState();
      return NextResponse.json({ ok: true, state: fresh });
    }

    if (action === "ISSUE_VOUCHER") {
      const { beneficiary_id, commodity_code, validity_hours = 72 } = body;
      const ben = state.beneficiaries.find((b) => b.id === beneficiary_id);
      if (!ben) {
        return NextResponse.json(
          { error: "Beneficiary not found in registry." },
          { status: 404 }
        );
      }

      const cat = COMMODITY_CATALOG.find((c) => c.code === commodity_code);
      if (!cat) {
        return NextResponse.json(
          { error: "Invalid commodity package selected." },
          { status: 400 }
        );
      }

      const now = Date.now();
      const issued_at = new Date(now).toISOString();
      const expires_at = new Date(
        now + Number(validity_hours) * 3600 * 1000
      ).toISOString();
      const randNum = crypto.randomInt(1000, 9999);
      const suffix = crypto.randomBytes(1).toString("hex").toUpperCase();
      const voucher_id = `VCH-2026-${randNum}`;
      const short_code = `CL-${randNum}-${suffix}`;
      const nonce = crypto.randomBytes(6).toString("hex");

      const hmac_signature = signVoucherNodeHmac({
        voucher_id,
        beneficiary_id: ben.id,
        commodity_code: cat.code,
        nominal_idr: cat.nominal_idr,
        nonce,
        expires_at,
      });

      const newVoucher: Voucher = {
        id: voucher_id,
        short_code,
        beneficiary_id: ben.id,
        beneficiary_name: ben.name,
        rt_rw: ben.rt_rw,
        commodity_code: cat.code,
        commodity_name: cat.name,
        commodity_items: cat.items,
        nominal_idr: cat.nominal_idr,
        nonce,
        issued_at,
        expires_at,
        hmac_signature,
        status: "ACTIVE",
      };

      state.vouchers.unshift(newVoucher);
      state.pool_total_idr = Math.max(0, state.pool_total_idr - cat.nominal_idr);
      saveClearinghouseState(state);

      return NextResponse.json({
        ok: true,
        voucher: newVoucher,
        state,
      });
    }

    if (action === "ADD_BENEFICIARY") {
      const { name, rt_rw, category, phone, household_size } = body;
      if (!name || !rt_rw) {
        return NextResponse.json(
          { error: "Beneficiary name and RT/RW are required." },
          { status: 400 }
        );
      }
      const newBen = {
        id: `WGA-04${state.beneficiaries.length + 10}`,
        name: String(name).trim(),
        rt_rw: String(rt_rw).trim(),
        category: category || "Verified Vulnerable Household",
        phone: phone || "0812-0000-1111 (SMS / Mobile Web)",
        household_size: Number(household_size) || 3,
        verified_by: "RT 04 Coordinator — Pak H. Dedi",
      };
      state.beneficiaries.push(newBen);
      saveClearinghouseState(state);
      return NextResponse.json({ ok: true, beneficiary: newBen, state });
    }

    if (action === "ADD_MERCHANT") {
      const { name, owner, rt_rw, bank_account } = body;
      if (!name || !owner) {
        return NextResponse.json(
          { error: "Merchant stall name and owner are required." },
          { status: 400 }
        );
      }
      const nextNum = String(state.merchants.length + 1).padStart(2, "0");
      const newMerchant = {
        id: `WRG-${nextNum}`,
        name: String(name).trim(),
        owner: String(owner).trim(),
        rt_rw: String(rt_rw || "RT 04 / RW 08 Coblong, Bandung").trim(),
        bank_account: String(bank_account || "QRIS Micro Merchant •• 0000").trim(),
        unsettled_balance_idr: 0,
        total_settled_idr: 0,
        redemption_count: 0,
      };
      state.merchants.push(newMerchant);
      saveClearinghouseState(state);
      return NextResponse.json({ ok: true, merchant: newMerchant, state });
    }

    if (action === "REDEEM_VOUCHER") {
      const {
        client_tx_id,
        voucher_id,
        short_code,
        merchant_id,
        client_hmac_signature,
        sync_mode = "ONLINE",
        redeemed_at,
      } = body;

      const txId =
        client_tx_id ||
        `CTX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      if (state.ledger.some((l) => l.client_tx_id === txId)) {
        state.fraud_blocked_count += 1;
        saveClearinghouseState(state);
        return NextResponse.json(
          {
            error: `Duplicate transaction identifier ${txId} already processed.`,
          },
          { status: 409 }
        );
      }

      const voucher = state.vouchers.find(
        (v) =>
          (voucher_id && v.id === voucher_id) ||
          (short_code &&
            v.short_code.toUpperCase() ===
              String(short_code).trim().toUpperCase())
      );

      if (!voucher) {
        return NextResponse.json(
          { error: "Voucher not found in clearinghouse registry." },
          { status: 404 }
        );
      }

      if (voucher.status !== "ACTIVE") {
        state.fraud_blocked_count += 1;
        saveClearinghouseState(state);
        return NextResponse.json(
          {
            error: `Anti-Double-Spend Reject: Voucher ${voucher.short_code} is already ${voucher.status} (redeemed at ${voucher.redeemed_by_merchant_name || "partner merchant"}).`,
          },
          { status: 409 }
        );
      }

      const merchant = state.merchants.find((m) => m.id === merchant_id);
      if (!merchant) {
        return NextResponse.json(
          { error: "Participating merchant not found." },
          { status: 404 }
        );
      }

      const expectedSig = signVoucherNodeHmac({
        voucher_id: voucher.id,
        beneficiary_id: voucher.beneficiary_id,
        commodity_code: voucher.commodity_code,
        nominal_idr: voucher.nominal_idr,
        nonce: voucher.nonce,
        expires_at: voucher.expires_at,
      });

      if (
        client_hmac_signature &&
        String(client_hmac_signature).toLowerCase() !==
          expectedSig.toLowerCase()
      ) {
        state.fraud_blocked_count += 1;
        saveClearinghouseState(state);
        return NextResponse.json(
          {
            error:
              "Cryptographic verification failed: HMAC-SHA256 signature mismatch (tampered payload detected).",
          },
          { status: 403 }
        );
      }

      const nowIso = redeemed_at || new Date().toISOString();
      const prevHash =
        state.ledger.length > 0 ? state.ledger[0].tx_hash : GENESIS_HASH;

      const txHash = computeLedgerTxHashNode({
        prev_hash: prevHash,
        voucher_id: voucher.id,
        merchant_id: merchant.id,
        nominal_idr: voucher.nominal_idr,
        timestamp: nowIso,
        hmac_sig: expectedSig,
      });

      voucher.status = "REDEEMED";
      voucher.redeemed_by_merchant_id = merchant.id;
      voucher.redeemed_by_merchant_name = merchant.name;
      voucher.redeemed_at = nowIso;

      merchant.unsettled_balance_idr += voucher.nominal_idr;
      merchant.redemption_count += 1;

      const entry: LedgerEntry = {
        id: `TX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        client_tx_id: txId,
        voucher_id: voucher.id,
        short_code: voucher.short_code,
        beneficiary_id: voucher.beneficiary_id,
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        commodity_name: voucher.commodity_name,
        nominal_idr: voucher.nominal_idr,
        hmac_signature: expectedSig,
        prev_hash: prevHash,
        tx_hash: txHash,
        sync_mode:
          sync_mode === "OFFLINE_BATCH_SYNC" ? "OFFLINE_BATCH_SYNC" : "ONLINE",
        timestamp: nowIso,
      };

      state.ledger.unshift(entry);
      saveClearinghouseState(state);

      return NextResponse.json({
        ok: true,
        voucher,
        ledger_entry: entry,
        merchant,
        state,
      });
    }

    if (action === "BATCH_SYNC") {
      const { redemptions = [] } = body;
      const results: BatchSyncResultItem[] = [];
      const processedIso = new Date().toISOString();

      for (const item of redemptions) {
        const ctxId =
          item.client_tx_id ||
          item.queue_id ||
          `CTX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

        const voucher = state.vouchers.find(
          (v) => v.id === item.voucher_id || v.short_code === item.short_code
        );
        const merchant = state.merchants.find((m) => m.id === item.merchant_id);
        const merchantName = merchant?.name || item.merchant_name || item.merchant_id;

        const recordConflict = (
          outcome: ReconciliationLog["outcome"],
          reason: string
        ) => {
          state.fraud_blocked_count += 1;
          const log: ReconciliationLog = {
            id: `REC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
            client_tx_id: ctxId,
            voucher_id: item.voucher_id || item.short_code,
            short_code: item.short_code || voucher?.short_code || "-",
            merchant_id: item.merchant_id,
            merchant_name: merchantName,
            outcome,
            reason,
            processed_at: processedIso,
          };
          state.reconciliation_logs.unshift(log);
          results.push({
            client_tx_id: ctxId,
            voucher_id: log.voucher_id,
            short_code: log.short_code,
            merchant_name: merchantName,
            status: "CONFLICT",
            outcome,
            reason,
          });
        };

        if (!voucher || !merchant) {
          recordConflict("NOT_FOUND", "Voucher or merchant not found in registry.");
          continue;
        }

        if (state.ledger.some((l) => l.client_tx_id === ctxId)) {
          recordConflict(
            "DUPLICATE_CONFLICT",
            `Duplicate client transaction ID ${ctxId} already exists in ledger.`
          );
          continue;
        }

        if (voucher.status !== "ACTIVE") {
          recordConflict(
            "DUPLICATE_CONFLICT",
            `Anti-Double-Spend Reject: Voucher ${voucher.short_code} is already ${voucher.status} (previously redeemed at ${voucher.redeemed_by_merchant_name || "another merchant"}).`
          );
          continue;
        }

        const expectedSig = signVoucherNodeHmac({
          voucher_id: voucher.id,
          beneficiary_id: voucher.beneficiary_id,
          commodity_code: voucher.commodity_code,
          nominal_idr: voucher.nominal_idr,
          nonce: voucher.nonce,
          expires_at: voucher.expires_at,
        });

        if (
          item.hmac_signature &&
          String(item.hmac_signature).toLowerCase() !==
            expectedSig.toLowerCase()
        ) {
          recordConflict(
            "INVALID_SIGNATURE",
            "HMAC-SHA256 signature validation failed during server reconciliation."
          );
          continue;
        }

        const nowIso = item.redeemed_at || processedIso;
        const prevHash =
          state.ledger.length > 0 ? state.ledger[0].tx_hash : GENESIS_HASH;

        const txHash = computeLedgerTxHashNode({
          prev_hash: prevHash,
          voucher_id: voucher.id,
          merchant_id: merchant.id,
          nominal_idr: voucher.nominal_idr,
          timestamp: nowIso,
          hmac_sig: expectedSig,
        });

        voucher.status = "REDEEMED";
        voucher.redeemed_by_merchant_id = merchant.id;
        voucher.redeemed_by_merchant_name = merchant.name;
        voucher.redeemed_at = nowIso;

        merchant.unsettled_balance_idr += voucher.nominal_idr;
        merchant.redemption_count += 1;

        const entry: LedgerEntry = {
          id: `TX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
          client_tx_id: ctxId,
          voucher_id: voucher.id,
          short_code: voucher.short_code,
          beneficiary_id: voucher.beneficiary_id,
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          commodity_name: voucher.commodity_name,
          nominal_idr: voucher.nominal_idr,
          hmac_signature: expectedSig,
          prev_hash: prevHash,
          tx_hash: txHash,
          sync_mode: "OFFLINE_BATCH_SYNC",
          timestamp: nowIso,
        };

        state.ledger.unshift(entry);

        const okReason =
          "Offline redemption validated and appended to SHA-256 hash-chained ledger.";
        state.reconciliation_logs.unshift({
          id: `REC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          client_tx_id: ctxId,
          voucher_id: voucher.id,
          short_code: voucher.short_code,
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          outcome: "SYNCED",
          reason: okReason,
          processed_at: processedIso,
        });

        results.push({
          client_tx_id: ctxId,
          voucher_id: voucher.id,
          short_code: voucher.short_code,
          merchant_name: merchant.name,
          status: "SYNCED",
          outcome: "SYNCED",
          reason: okReason,
        });
      }

      saveClearinghouseState(state);
      const syncedCount = results.filter((r) => r.status === "SYNCED").length;
      const conflictCount = results.filter((r) => r.status === "CONFLICT").length;

      return NextResponse.json({
        ok: true,
        synced_count: syncedCount,
        conflict_count: conflictCount,
        results,
        state,
      });
    }

    if (action === "SETTLE_MERCHANTS") {
      const { merchant_id } = body;
      const targets = state.merchants.filter(
        (m) =>
          m.unsettled_balance_idr > 0 && (!merchant_id || m.id === merchant_id)
      );

      if (targets.length === 0) {
        return NextResponse.json(
          { error: "No unsettled merchant balances awaiting disbursement." },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const createdBatches: SettlementBatch[] = [];

      for (const m of targets) {
        const redeemedVouchers = state.vouchers.filter(
          (v) => v.redeemed_by_merchant_id === m.id && v.status === "REDEEMED"
        );
        const batchId = `STL-2026-${crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase()}`;
        const amount = m.unsettled_balance_idr;
        const vCount = Math.max(redeemedVouchers.length, 1);
        const batchHash = crypto
          .createHash("sha256")
          .update(`${batchId}|${m.id}|${amount}|${nowIso}`, "utf8")
          .digest("hex");

        for (const v of redeemedVouchers) {
          v.status = "SETTLED";
          v.settlement_batch_id = batchId;
        }

        for (const l of state.ledger) {
          if (l.merchant_id === m.id && !l.settlement_batch_id) {
            l.settlement_batch_id = batchId;
          }
        }

        m.total_settled_idr += amount;
        m.unsettled_balance_idr = 0;

        const batch: SettlementBatch = {
          id: batchId,
          merchant_id: m.id,
          merchant_name: m.name,
          bank_account: m.bank_account,
          voucher_count: vCount,
          total_amount_idr: amount,
          batch_hash: batchHash,
          settled_at: nowIso,
        };

        state.settlement_batches.unshift(batch);
        createdBatches.push(batch);
      }

      saveClearinghouseState(state);
      return NextResponse.json({
        ok: true,
        batches: createdBatches,
        state,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
