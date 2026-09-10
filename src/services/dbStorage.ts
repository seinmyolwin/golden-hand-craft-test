/**
 * Shwe Let Yar - IndexedDB Offline Storage Service
 * Provides multi-gigabyte persistent offline storage for records, vouchers, and compressed photos.
 * Complements and syncs with localStorage to prevent quota exhaustion.
 */

const DB_NAME = 'ShweLetYarDB';
const DB_VERSION = 2;
const STORE_DATA = 'app_state';
const STORE_ATTACHMENTS = 'voucher_attachments';

let dbInstance: IDBDatabase | null = null;

export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        const attachStore = db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
        attachStore.createIndex('voucherId', 'voucherId', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save arbitrary key-value state to IndexedDB
 */
export async function saveToIndexedDB<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_DATA], 'readwrite');
      const store = transaction.objectStore(STORE_DATA);
      const req = store.put({ key, value, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, fallback to localStorage only:', err);
  }
}

/**
 * Load key-value state from IndexedDB
 */
export async function loadFromIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_DATA], 'readonly');
      const store = transaction.objectStore(STORE_DATA);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? (req.result.value as T) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB load failed:', err);
    return null;
  }
}

/**
 * Save an offline image attachment (photo of delivery, voucher signature, receipt)
 */
export async function saveAttachment(voucherId: string, imageBase64: string, caption?: string): Promise<string> {
  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_ATTACHMENTS], 'readwrite');
      const store = transaction.objectStore(STORE_ATTACHMENTS);
      const req = store.put({
        id,
        voucherId,
        imageBase64,
        caption: caption || '',
        createdAt: new Date().toISOString(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return id;
  } catch (err) {
    console.warn('Failed to save attachment to IndexedDB:', err);
    return id;
  }
}

/**
 * Get all attachments for a specific voucher
 */
export async function getAttachmentsForVoucher(voucherId: string): Promise<Array<{ id: string; imageBase64: string; caption?: string; createdAt: string }>> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_ATTACHMENTS], 'readonly');
      const store = transaction.objectStore(STORE_ATTACHMENTS);
      const index = store.index('voucherId');
      const req = index.getAll(voucherId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get attachments from IndexedDB:', err);
    return [];
  }
}

/**
 * Estimate storage usage in KB/MB
 */
export async function getStorageEstimate(): Promise<{ usedBytes: number; quotaBytes: number; percentage: number; isUnlimited: boolean }> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usedBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 0;
      const percentage = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
      return {
        usedBytes,
        quotaBytes,
        percentage,
        isUnlimited: quotaBytes > 100 * 1024 * 1024, // > 100MB
      };
    } catch {
      // ignore
    }
  }

  // Fallback estimation using localStorage
  let lsBytes = 0;
  if (typeof window !== 'undefined' && window.localStorage) {
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        lsBytes += (localStorage[key].length + key.length) * 2;
      }
    }
  }
  return {
    usedBytes: lsBytes,
    quotaBytes: 10 * 1024 * 1024, // typical 10MB localStorage
    percentage: (lsBytes / (10 * 1024 * 1024)) * 100,
    isUnlimited: false,
  };
}
