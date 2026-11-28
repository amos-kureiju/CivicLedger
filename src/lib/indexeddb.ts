import {
  ClearinghouseState,
  OfflineRedemptionQueueItem,
  Voucher,
} from "./types";

const DB_NAME = "CivicLedgerOfflineDB";
const DB_VERSION = 3;
const STORE_QUEUE = "offline_redemptions";
const STORE_NONCES = "redeemed_nonces";
const STORE_VOUCHERS = "cached_vouchers";
const STORE_STATE = "cached_state";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "queue_id" });
      }
      if (!db.objectStoreNames.contains(STORE_NONCES)) {
        db.createObjectStore(STORE_NONCES, { keyPath: "voucher_id" });
      }
      if (!db.objectStoreNames.contains(STORE_VOUCHERS)) {
        db.createObjectStore(STORE_VOUCHERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheFullStateInIndexedDB(
  state: Partial<ClearinghouseState>
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_STATE, "readwrite");
    tx.objectStore(STORE_STATE).put({
      key: "latest",
      saved_at: new Date().toISOString(),
      state,
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore on SSR
  }
}

export async function getCachedFullStateFromIndexedDB(): Promise<Partial<ClearinghouseState> | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_STATE, "readonly");
    const req = tx.objectStore(STORE_STATE).get("latest");
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result?.state ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cacheVouchersInIndexedDB(
  vouchers: Voucher[]
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_VOUCHERS, STORE_NONCES], "readwrite");
    const voucherStore = tx.objectStore(STORE_VOUCHERS);
    const nonceStore = tx.objectStore(STORE_NONCES);

    for (const v of vouchers) {
      voucherStore.put(v);
      if (v.status === "REDEEMED" || v.status === "SETTLED") {
        nonceStore.put({
          voucher_id: v.id,
          short_code: v.short_code,
          nonce: v.nonce,
          redeemed_at: v.redeemed_at || new Date().toISOString(),
        });
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore on SSR
  }
}

export async function getCachedVouchersFromIndexedDB(): Promise<Voucher[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_VOUCHERS, "readonly");
    const store = tx.objectStore(STORE_VOUCHERS);
    const req = store.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function isVoucherRedeemedLocally(
  voucherId: string
): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NONCES, "readonly");
    const store = tx.objectStore(STORE_NONCES);
    const req = store.get(voucherId);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function enqueueOfflineRedemption(
  item: OfflineRedemptionQueueItem,
  skipNonceLock = false
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORE_QUEUE, STORE_NONCES, STORE_VOUCHERS],
    "readwrite"
  );
  tx.objectStore(STORE_QUEUE).put(item);

  if (!skipNonceLock) {
    tx.objectStore(STORE_NONCES).put({
      voucher_id: item.voucher_id,
      short_code: item.short_code,
      redeemed_at: item.redeemed_at,
    });

    const voucherStore = tx.objectStore(STORE_VOUCHERS);
    const getReq = voucherStore.get(item.voucher_id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        const updated: Voucher = {
          ...getReq.result,
          status: "REDEEMED",
          redeemed_by_merchant_id: item.merchant_id,
          redeemed_by_merchant_name: item.merchant_name,
          redeemed_at: item.redeemed_at,
        };
        voucherStore.put(updated);
      }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineRedemptionQueue(): Promise<
  OfflineRedemptionQueueItem[]
> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () =>
        resolve((req.result || []).filter((i) => !i.synced));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearSyncedOfflineRedemptions(queueIds?: string[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_QUEUE);
    if (queueIds) {
      for (const id of queueIds) store.delete(id);
    } else {
      store.clear();
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    if (queueIds) throw error;
  }
}

export async function clearAllOfflineStores(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(
      [STORE_QUEUE, STORE_NONCES, STORE_VOUCHERS, STORE_STATE],
      "readwrite"
    );
    tx.objectStore(STORE_QUEUE).clear();
    tx.objectStore(STORE_NONCES).clear();
    tx.objectStore(STORE_VOUCHERS).clear();
    tx.objectStore(STORE_STATE).clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}
