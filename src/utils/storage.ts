import {
  Product,
  Supplier,
  TransactionRecord,
  DailySummary,
  Merchant,
  SaleRecord,
  StockAdjustmentRecord,
  ShopSettings,
  DeletedRecord,
  BackupReminderSettings,
  AppLockSettings,
  AutoRecoverySnapshot,
  MerchantOrder,
  MerchantPurchaseRecord,
  PeerTrader,
  PeerTransaction,
  PeerTradeRecord,
  SyncPacket,
  RawMaterialPreset,
  RawMaterialStockStat,
} from '../types';
import {
  DEFAULT_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_TRANSACTIONS,
  INITIAL_MERCHANTS,
  INITIAL_SALES,
  INITIAL_STOCK_ADJUSTMENTS,
  INITIAL_MERCHANT_ORDERS,
  INITIAL_PEER_TRADERS,
} from '../data/defaultData';
import { db } from '../db/database';
import { generateSecureRecoveryKey, encryptBackupPayload } from '../services/cryptoSecurity';
import { generateStableId } from './idGenerator';
import { createCompleteBackup, downloadBackupFile } from '../services/backupService';
import { calculateAllProductsStockLedgerSummaries } from '../services/stockLedgerService';

export const STORAGE_KEYS = {
  PRODUCTS: 'ledger_products_v2',
  SUPPLIERS: 'ledger_suppliers_v2',
  TRANSACTIONS: 'ledger_transactions_v2',
  MERCHANTS: 'ledger_merchants_v2',
  SALES: 'ledger_sales_v2',
  STOCK_ADJUSTMENTS: 'ledger_stock_adjustments_v2',
  SHOP_SETTINGS: 'ledger_shop_settings_v2',
  LAST_BACKUP: 'ledger_last_backup_v2',
  DELETED_HISTORY: 'ledger_deleted_history_v1',
  BACKUP_REMINDER: 'ledger_backup_reminder_v1',
  APP_LOCK: 'ledger_app_lock_v1',
  RECOVERY_SNAPSHOTS: 'ledger_recovery_snapshots_v1',
  MERCHANT_ORDERS: 'ledger_merchant_orders_v1',
  MERCHANT_PURCHASES: 'ledger_merchant_purchases_v1',
  PEER_TRADERS: 'ledger_peer_traders_v1',
  PEER_TRANSACTIONS: 'ledger_peer_transactions_v1',
  DEVICE_INFO: 'ledger_device_info_v1',
  RAW_MATERIAL_PRESETS: 'ledger_raw_material_presets_v1',
  PRODUCT_CATEGORIES: 'ledger_product_categories_v2',
  RAW_MATERIAL_CATEGORIES: 'ledger_raw_material_categories_v2',
};

export const DEFAULT_PRODUCT_CATEGORIES: string[] = [
  'ကုန်ချော',
  'ဝါးထည်',
  'ကြိမ်ထည်',
  'ပန်းပု',
  'အခြားလက်မှု',
];

export const DEFAULT_RAW_MATERIAL_CATEGORIES: string[] = [
  'ဝါးကုန်ကြမ်း',
  'ကြိမ်ကုန်ကြမ်း',
  'ငွေကြိုယူ',
  'ဆေးသုတ်ပစ္စည်း/ကော်',
  'အခြားကုန်ကြမ်း',
];

/**
 * Parses numbers input in either English (0-9) or Myanmar digits (၀-၉, including ဝ U+1015).
 * Removes thousand separators (commas), currency labels and whitespace.
 * Returns 0 if invalid or empty.
 */
export function parseBilingualNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  const myanmarToEnglishMap: { [key: string]: string } = {
    '၀': '0', // U+1040 Myanmar digit zero
    'ဝ': '0', // U+1015 Myanmar letter Wa
    '၁': '1',
    '၂': '2',
    '၃': '3',
    '၄': '4',
    '၅': '5',
    '၆': '6',
    '၇': '7',
    '၈': '8',
    '၉': '9',
  };

  let normalized = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (myanmarToEnglishMap[ch] !== undefined) {
      normalized += myanmarToEnglishMap[ch];
    } else if ((ch >= '0' && ch <= '9') || ch === '.' || ch === '-') {
      normalized += ch;
    }
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalizes input text by converting any Myanmar digits into standard English numeric characters.
 */
export function normalizeBilingualDigits(input: string): string {
  if (!input) return '';
  const myanmarToEnglishMap: { [key: string]: string } = {
    '၀': '0', 'ဝ': '0',
    '၁': '1', '၂': '2', '၃': '3', '၄': '4',
    '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9',
  };
  let res = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (myanmarToEnglishMap[ch] !== undefined) {
      res += myanmarToEnglishMap[ch];
    } else {
      res += ch;
    }
  }
  return res;
}

export function getStoredProductCategories(): string[] {
  return DEFAULT_PRODUCT_CATEGORIES;
}

export function saveStoredProductCategories(categories: string[]): void {
  try {
    const clean = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    const finalCats = clean.length > 0 ? clean : DEFAULT_PRODUCT_CATEGORIES;
    db.settings.put({ key: 'productCategories', value: finalCats, updatedAt: new Date().toISOString() })
      .catch((err) => console.error('Dexie save product categories error:', err));
  } catch (e) {
    console.error('Error saving product categories', e);
  }
}

export function getStoredRawMaterialCategories(): string[] {
  return DEFAULT_RAW_MATERIAL_CATEGORIES;
}

export function saveStoredRawMaterialCategories(categories: string[]): void {
  try {
    const clean = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    const finalCats = clean.length > 0 ? clean : DEFAULT_RAW_MATERIAL_CATEGORIES;
    db.settings.put({ key: 'rawMaterialCategories', value: finalCats, updatedAt: new Date().toISOString() })
      .catch((err) => console.error('Dexie save raw material categories error:', err));
  } catch (e) {
    console.error('Error saving raw material categories', e);
  }
}

// Generate a cryptographically random formatted recovery key e.g. "SLY-8K3N-7R4W"
export function generateRandomRecoveryKey(): string {
  return generateSecureRecoveryKey();
}
export const generateRecoveryKey = generateRandomRecoveryKey;

export const DEFAULT_APP_LOCK: AppLockSettings = {
  enabled: false,
  isPinInitialized: false,
  autoLockMinutes: 5,
  lockOnStartup: true,
  failedAttempts: 0,
};

export const DEFAULT_BACKUP_REMINDER: BackupReminderSettings = {
  enabled: true,
  reminderTime: '17:30',
  lastDismissedDate: '',
  snoozedUntilTimestamp: 0,
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shopName: 'ရွှေလက်ရာ',
  tagline: 'မြန်မာ့လက်မှု ကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း',
  ownerName: 'ဦးစိန်မျိုးလွင်',
  phone: '09-123456789',
  address: 'ပုဂံမြို့ဟောင်း၊ မန္တလေးတိုင်း',
  soundEnabled: true,
  soundTheme: 'BELL',
};

export const DEFAULT_RAW_MATERIAL_PRESETS: RawMaterialPreset[] = [
  // ဝါးကုန်ကြမ်း (၃ မျိုး)
  { id: 'rm-1', category: 'BAMBOO', categoryLabel: 'ဝါးကုန်ကြမ်း', name: 'ဝါးပိုးဝါး (ဝါးလုံး)', defaultUnit: 'လုံး', defaultUnitPrice: 3500 },
  { id: 'rm-2', category: 'BAMBOO', categoryLabel: 'ဝါးကုန်ကြမ်း', name: 'တင်းဝါး (ဝါးလုံး)', defaultUnit: 'လုံး', defaultUnitPrice: 2800 },
  { id: 'rm-3', category: 'BAMBOO', categoryLabel: 'ဝါးကုန်ကြမ်း', name: 'ဝါးနှီးစိပ် (စည်း)', defaultUnit: 'စည်း', defaultUnitPrice: 4500 },

  // ကြိမ်ကုန်ကြမ်း (၃ မျိုး)
  { id: 'rm-4', category: 'RATTAN', categoryLabel: 'ကြိမ်ကုန်ကြမ်း', name: 'ကြိမ်လုံး (စည်း)', defaultUnit: 'စည်း', defaultUnitPrice: 12000 },
  { id: 'rm-5', category: 'RATTAN', categoryLabel: 'ကြိမ်ကုန်ကြမ်း', name: 'ကြိမ်ကြိုး (ခွေ)', defaultUnit: 'ခွေ', defaultUnitPrice: 8500 },
  { id: 'rm-6', category: 'RATTAN', categoryLabel: 'ကြိမ်ကုန်ကြမ်း', name: 'ကြိမ်အူ (စည်း)', defaultUnit: 'စည်း', defaultUnitPrice: 15000 },

  // ငွေကြိုယူ (၃ မျိုး)
  { id: 'rm-7', category: 'CASH_ADVANCE', categoryLabel: 'ငွေကြိုယူ', name: 'ငွေသားကြိုထုတ် (Cash Advance)', defaultUnit: 'ကျပ်', defaultUnitPrice: 1 },
  { id: 'rm-8', category: 'CASH_ADVANCE', categoryLabel: 'ငွေကြိုယူ', name: 'အလုပ်သမားစရိတ်ကြိုယူ', defaultUnit: 'ကျပ်', defaultUnitPrice: 1 },
  { id: 'rm-9', category: 'CASH_ADVANCE', categoryLabel: 'ငွေကြိုယူ', name: 'လုပ်အားခကြိုယူငွေ', defaultUnit: 'ကျပ်', defaultUnitPrice: 1 },

  // အခြားကုန်ကြမ်း (၃ မျိုး)
  { id: 'rm-10', category: 'OTHER', categoryLabel: 'အခြားကုန်ကြမ်း', name: 'သဲစက္ကူ (ကော်ပတ်)', defaultUnit: 'ချပ်', defaultUnitPrice: 1500 },
  { id: 'rm-11', category: 'OTHER', categoryLabel: 'အခြားကုန်ကြမ်း', name: 'သစ်သားကော် / ကော်ကပ်ဆေး', defaultUnit: 'ပုလင်း', defaultUnitPrice: 6000 },
  { id: 'rm-12', category: 'OTHER', categoryLabel: 'အခြားကုန်ကြမ်း', name: 'အရောင်တင်ဆီ / သုတ်ဆေး', defaultUnit: 'ပုလင်း', defaultUnitPrice: 8000 },
];

export function getStoredRawMaterialPresets(): RawMaterialPreset[] {
  try {
    const isLive = typeof localStorage !== 'undefined' && localStorage.getItem('ledger_zero_settings_activated') === 'true';
    const data = localStorage.getItem(STORAGE_KEYS.RAW_MATERIAL_PRESETS);
    if (data === null) {
      if (isLive) {
        localStorage.setItem(STORAGE_KEYS.RAW_MATERIAL_PRESETS, JSON.stringify([]));
        return [];
      }
      localStorage.setItem(STORAGE_KEYS.RAW_MATERIAL_PRESETS, JSON.stringify(DEFAULT_RAW_MATERIAL_PRESETS));
      localStorage.setItem('raw_material_presets_initialized_v2', 'true');
      return DEFAULT_RAW_MATERIAL_PRESETS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Filter out any lingering LACQUER / သစ်စေး items if user had previous version
      const filtered = parsed.filter((p: any) => p && p.category !== 'LACQUER' && p.categoryLabel !== 'သစ်စေး' && !p.name?.includes('သစ်စေး'));
      if (isLive) {
        return filtered.filter((p: any) => p.isUserCreated === true);
      }
      return filtered;
    }
    return isLive ? [] : DEFAULT_RAW_MATERIAL_PRESETS;
  } catch (e) {
    console.error('Error reading raw material presets', e);
    return [];
  }
}

export function saveStoredRawMaterialPresets(presets: RawMaterialPreset[]): void {
  const list = Array.isArray(presets) ? presets : [];
  try {
    localStorage.setItem(STORAGE_KEYS.RAW_MATERIAL_PRESETS, JSON.stringify(list));
    localStorage.setItem('raw_material_presets_initialized_v2', 'true');
  } catch (e) {
    console.error('Error saving raw material presets to localStorage', e);
  }

  db.transaction('rw', db.rawMaterialPresets, async () => {
    await db.rawMaterialPresets.clear();
    if (list.length > 0) {
      await db.rawMaterialPresets.bulkPut(list);
    }
  }).catch((err) => console.error('Dexie save raw material presets error:', err));
}

let inMemoryLocalStorage: Record<string, string> = {};

function getLocalStorage(): Storage | undefined {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) {
    // Fall back to in-memory storage
  }
  return {
    getItem: (key: string) => inMemoryLocalStorage[key] ?? null,
    setItem: (key: string, val: string) => { inMemoryLocalStorage[key] = String(val); },
    removeItem: (key: string) => { delete inMemoryLocalStorage[key]; },
    clear: () => { inMemoryLocalStorage = {}; },
    length: Object.keys(inMemoryLocalStorage).length,
    key: (i: number) => Object.keys(inMemoryLocalStorage)[i] ?? null,
  };
}

export function safeLocalStorageGet<T>(key: string, fallback: T): T {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      return fallback;
    }
    const item = storage.getItem(key);
    if (item === null || item === undefined || item === '') {
      return fallback;
    }
    const parsed = JSON.parse(item);
    if (parsed === null || parsed === undefined) {
      return fallback;
    }
    return parsed as T;
  } catch (err) {
    console.warn(`[safeLocalStorageGet] Failed reading key "${key}". Falling back safely.`, err);
    return fallback;
  }
}

export function safeLocalStorageSet<T>(key: string, value: T): boolean {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      return false;
    }
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[safeLocalStorageSet] Failed saving key "${key}".`, err);
    return false;
  }
}

// --- Storage Retrieval & Saving ---

export function getStoredShopSettings(): ShopSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SHOP_SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SHOP_SETTINGS, JSON.stringify(DEFAULT_SHOP_SETTINGS));
      return DEFAULT_SHOP_SETTINGS;
    }
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_SHOP_SETTINGS,
      ...parsed,
      shopName: parsed.shopName?.trim() || DEFAULT_SHOP_SETTINGS.shopName,
      ownerName: parsed.ownerName?.trim() || DEFAULT_SHOP_SETTINGS.ownerName,
      phone: parsed.phone?.trim() || DEFAULT_SHOP_SETTINGS.phone,
      address: parsed.address?.trim() || DEFAULT_SHOP_SETTINGS.address,
      tagline: parsed.tagline?.trim() || DEFAULT_SHOP_SETTINGS.tagline,
    };
  } catch (e) {
    console.error('Error reading shop settings', e);
    return DEFAULT_SHOP_SETTINGS;
  }
}

export function saveStoredShopSettings(settings: ShopSettings): void {
  const clean = settings || DEFAULT_SHOP_SETTINGS;
  safeLocalStorageSet(STORAGE_KEYS.SHOP_SETTINGS, clean);
  db.settings.put({ key: 'shopSettings', value: clean, updatedAt: new Date().toISOString() })
    .catch((err) => console.error('Dexie save shop settings error:', err));
}

export function getStoredProducts(): Product[] {
  return [];
}

export function saveStoredProducts(products: Product[]): void {
  const list = products || [];
  db.transaction('rw', db.products, async () => {
    await db.products.clear();
    if (list.length > 0) {
      await db.products.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save products error:', err);
    throw new Error('IndexedDB storage write failed for products: ' + err.message);
  });
}

export function getStoredSuppliers(): Supplier[] {
  return [];
}

export function saveStoredSuppliers(suppliers: Supplier[]): void {
  const list = suppliers || [];
  db.transaction('rw', db.suppliers, async () => {
    await db.suppliers.clear();
    if (list.length > 0) {
      await db.suppliers.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save suppliers error:', err);
    throw new Error('IndexedDB storage write failed for suppliers: ' + err.message);
  });
}

export function getStoredTransactions(): TransactionRecord[] {
  return [];
}

export function saveStoredTransactions(transactions: TransactionRecord[]): void {
  const list = transactions || [];
  db.transaction('rw', db.transactions, async () => {
    await db.transactions.clear();
    if (list.length > 0) {
      await db.transactions.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save transactions error:', err);
    throw new Error('IndexedDB storage write failed for transactions: ' + err.message);
  });
}

export function getStoredMerchants(): Merchant[] {
  return [];
}

export function saveStoredMerchants(merchants: Merchant[]): void {
  const list = merchants || [];
  db.transaction('rw', db.merchants, async () => {
    await db.merchants.clear();
    if (list.length > 0) {
      await db.merchants.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save merchants error:', err);
    throw new Error('IndexedDB storage write failed for merchants: ' + err.message);
  });
}

export function getStoredSales(): SaleRecord[] {
  return [];
}

export function saveStoredSales(sales: SaleRecord[]): void {
  const list = sales || [];
  db.transaction('rw', db.sales, async () => {
    await db.sales.clear();
    if (list.length > 0) {
      await db.sales.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save sales error:', err);
    throw new Error('IndexedDB storage write failed for sales: ' + err.message);
  });
}

export function getStoredStockAdjustments(): StockAdjustmentRecord[] {
  return [];
}

export function saveStoredStockAdjustments(adjustments: StockAdjustmentRecord[]): void {
  const list = adjustments || [];
  db.transaction('rw', db.stockAdjustments, async () => {
    await db.stockAdjustments.clear();
    if (list.length > 0) {
      await db.stockAdjustments.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save stock adjustments error:', err);
    throw new Error('IndexedDB storage write failed for stock adjustments: ' + err.message);
  });
}

export function getStoredDeletedHistory(): DeletedRecord[] {
  return [];
}

export function saveStoredDeletedHistory(history: DeletedRecord[]): void {
  const list = history || [];
  db.transaction('rw', db.softDeletedItems, async () => {
    await db.softDeletedItems.clear();
    if (list.length > 0) {
      const formatted = list.map((item: any) => ({
        id: item.id || generateStableId('del'),
        originalId: item.originalId || item.id,
        name: item.name || 'Deleted Item',
        type: item.type || 'RECORD',
        deletedAt: item.deletedAt || new Date().toISOString(),
        data: item.data || item,
      }));
      await db.softDeletedItems.bulkPut(formatted);
    }
  }).catch((err) => console.error('Dexie save soft deleted items error:', err));
}

export function getStoredBackupReminderSettings(): BackupReminderSettings {
  return DEFAULT_BACKUP_REMINDER;
}

export function saveStoredBackupReminderSettings(settings: BackupReminderSettings): void {
  const clean = settings || DEFAULT_BACKUP_REMINDER;
  db.settings.put({ key: 'backupReminder', value: clean, updatedAt: new Date().toISOString() })
    .catch((err) => console.error('Dexie save backup reminder error:', err));
}

export function getStoredAppLockSettings(): AppLockSettings {
  try {
    const parsed = safeLocalStorageGet<Partial<AppLockSettings> | null>(STORAGE_KEYS.APP_LOCK, null);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_APP_LOCK;
    }
    const settings: AppLockSettings = {
      ...DEFAULT_APP_LOCK,
      ...parsed,
      enabled: parsed.enabled ?? DEFAULT_APP_LOCK.enabled,
      pinSalt: parsed.pinSalt,
      pinHash: parsed.pinHash,
      recoverySalt: parsed.recoverySalt,
      recoveryHash: parsed.recoveryHash,
      isPinInitialized: parsed.isPinInitialized ?? (Boolean(parsed.pinHash) || Boolean(parsed.passcode) || Boolean(parsed.pin)),
      failedAttempts: parsed.failedAttempts ?? 0,
      lockedUntilTimestamp: parsed.lockedUntilTimestamp,
      autoLockMinutes: parsed.autoLockMinutes ?? 5,
      lockOnStartup: parsed.lockOnStartup ?? true,
    };

    // Purge legacy plaintext fields if salted verifiers exist
    if (settings.pinHash && settings.pinSalt) {
      delete settings.passcode;
      delete settings.pin;
    }
    if (settings.recoveryHash && settings.recoverySalt) {
      delete settings.recoveryKey;
    }
    delete settings.hint;
    delete settings.recoveryQuestion;
    delete settings.recoveryAnswer;

    return settings;
  } catch (e) {
    console.error('Error reading app lock settings', e);
    return DEFAULT_APP_LOCK;
  }
}

export function saveStoredAppLockSettings(settings: AppLockSettings): void {
  try {
    const cleanSettings: AppLockSettings = {
      ...DEFAULT_APP_LOCK,
      ...(settings || {}),
    };
    // Always purge plaintext credential fields before persisting to storage
    if (cleanSettings.pinHash && cleanSettings.pinSalt) {
      delete cleanSettings.passcode;
      delete cleanSettings.pin;
    }
    if (cleanSettings.recoveryHash && cleanSettings.recoverySalt) {
      delete cleanSettings.recoveryKey;
    }
    delete cleanSettings.hint;
    delete cleanSettings.recoveryQuestion;
    delete cleanSettings.recoveryAnswer;

    safeLocalStorageSet(STORAGE_KEYS.APP_LOCK, cleanSettings);
    db.settings.put({ key: 'appLock', value: cleanSettings, updatedAt: new Date().toISOString() })
      .catch((err) => console.error('Dexie save app lock error:', err));
  } catch (e) {
    console.error('Error saving app lock settings', e);
  }
}

export function getStoredMerchantOrders(): MerchantOrder[] {
  return [];
}

export function saveStoredMerchantOrders(orders: MerchantOrder[]): void {
  const list = orders || [];
  db.transaction('rw', db.orders, async () => {
    await db.orders.clear();
    if (list.length > 0) {
      await db.orders.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save orders error:', err);
    throw new Error('IndexedDB storage write failed for orders: ' + err.message);
  });
}

export function getStoredMerchantPurchases(): MerchantPurchaseRecord[] {
  return [];
}

export function saveStoredMerchantPurchases(purchases: MerchantPurchaseRecord[]): void {
  const list = purchases || [];
  db.transaction('rw', db.merchantPurchases, async () => {
    await db.merchantPurchases.clear();
    if (list.length > 0) {
      await db.merchantPurchases.bulkPut(list);
    }
  }).catch((err) => {
    console.error('Dexie save merchant purchases error:', err);
    throw new Error('IndexedDB storage write failed for merchant purchases: ' + err.message);
  });
}

export function getStoredPeerTraders(): PeerTrader[] {
  return [];
}

export function saveStoredPeerTraders(peers: PeerTrader[]): void {
  // Saved inside peerTrades repository / Dexie table
}

export function getStoredPeerTransactions(): PeerTransaction[] {
  return [];
}

export function saveStoredPeerTransactions(txs: PeerTransaction[]): void {
  // Saved inside peerTrades repository / Dexie table
}

export function getStoredRecoverySnapshots(): AutoRecoverySnapshot[] {
  return [];
}

export function saveStoredRecoverySnapshots(snapshots: AutoRecoverySnapshot[]): void {
  const list = snapshots || [];
  db.transaction('rw', db.recoverySnapshots, async () => {
    if (list.length > 0) {
      await db.recoverySnapshots.bulkPut(list);
    }
  }).catch((err) => console.error('Dexie save recovery snapshots error:', err));
}

export function createInMemoryStateSnapshot(
  reason: string,
  data: {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    stockAdjustments: StockAdjustmentRecord[];
    merchantOrders?: MerchantOrder[];
    merchantPurchases?: MerchantPurchaseRecord[];
    peerTraders?: PeerTrader[];
    peerTransactions?: PeerTransaction[];
    shopSettings?: ShopSettings;
  }
): AutoRecoverySnapshot {
  const existing = getStoredRecoverySnapshots();
  const snapshot: AutoRecoverySnapshot = {
    id: generateStableId('snap'),
    timestamp: Date.now(),
    date: getTodayDateString(),
    time: getCurrentTimeString(),
    reason: reason || 'အလိုအလျောက် မှတ်တမ်း (Auto Snapshot)',
    recordCounts: {
      products: (data.products || []).length,
      suppliers: (data.suppliers || []).length,
      merchants: (data.merchants || []).length,
      transactions: (data.transactions || []).length,
      sales: (data.sales || []).length,
      stockAdjustments: (data.stockAdjustments || []).length,
      orders: (data.merchantOrders || []).length,
      peerTransactions: (data.peerTransactions || []).length,
    },
    data: {
      products: data.products || [],
      suppliers: data.suppliers || [],
      merchants: data.merchants || [],
      transactions: data.transactions || [],
      sales: data.sales || [],
      stockAdjustments: data.stockAdjustments || [],
      merchantOrders: data.merchantOrders || [],
      merchantPurchases: data.merchantPurchases || [],
      peerTraders: data.peerTraders || [],
      peerTransactions: data.peerTransactions || [],
      shopSettings: data.shopSettings || DEFAULT_SHOP_SETTINGS,
    },
  };
  saveStoredRecoverySnapshots([snapshot, ...existing]);
  return snapshot;
}

export function getStoredDeviceSettings(): { deviceId: string; deviceName: string; shopGroupId: string } {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DEVICE_INFO);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    // ignore
  }
  const defaults = {
    deviceId: `dev-${Math.random().toString(36).substring(2, 8)}`,
    deviceName: 'ပင်မဖုန်း (Host)',
    shopGroupId: 'SHWE-LET-YAR-01',
  };
  try {
    localStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(defaults));
  } catch (e) {
    // ignore
  }
  return defaults;
}

export function saveStoredDeviceSettings(info: { deviceId: string; deviceName: string; shopGroupId: string }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(info));
  } catch (e) {
    console.error('Error saving device info', e);
  }
}

export function generateOrderNo(index: number = 0, dateStr: string = getTodayDateString()): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const seq = String(index + 1).padStart(3, '0');
  return `ORD-${cleanDate}-${seq}`;
}

export function generatePurchaseNo(index: number = 0, dateStr: string = getTodayDateString()): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const seq = String(index + 1).padStart(3, '0');
  return `PUR-${cleanDate}-${seq}`;
}

export function generatePeerVoucherNo(type: string, index: number = 0, dateStr: string = getTodayDateString()): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const prefix = type.includes('BORROW') ? 'BRW' : type.includes('LEND') ? 'LND' : 'PEER';
  const seq = String(index + 1).padStart(3, '0');
  return `${prefix}-${cleanDate}-${seq}`;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeString(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function computeDailySummary(
  date: string,
  transactions: TransactionRecord[] = [],
  _products: Product[] = []
): DailySummary {
  const targetDate = (date || '').trim().slice(0, 10);
  const dayTxs = (transactions || []).filter((t) => t && (t.date || '').trim().slice(0, 10) === targetDate);
  const visitedSupplierIds = new Set<string>();
  let totalGoodsCount = 0;
  let totalGoodsValue = 0;
  let totalAdvanceDeducted = 0;
  let totalNewAdvanceGiven = 0;
  let totalCashPaid = 0;
  let totalMaterialCreditGiven = 0;
  let totalRepaymentReceived = 0;
  const itemCounts: { [productId: string]: { name: string; count: number; unit: string; totalValue: number } } = {};

  dayTxs.forEach((tx) => {
    if (!tx) return;
    if (tx.supplierId) visitedSupplierIds.add(tx.supplierId);
    totalGoodsValue += tx.totalGoodsValue || 0;
    totalAdvanceDeducted += tx.advanceDeducted || 0;
    totalNewAdvanceGiven += tx.newAdvanceTaken || 0;
    totalCashPaid += (tx.cashPaidToSupplier ?? tx.netCashPaidToSupplier ?? 0);

    if (tx.type === 'RAW_MATERIAL_CREDIT') {
      totalMaterialCreditGiven += tx.materialTotalValue || tx.newAdvanceTaken || 0;
    } else if (tx.type === 'SUPPLIER_REPAYMENT') {
      totalRepaymentReceived += tx.cashRepaymentReceived || 0;
    }
    if (tx.materialTotalValue && tx.type !== 'RAW_MATERIAL_CREDIT') {
      totalMaterialCreditGiven += tx.materialTotalValue;
    }
    if (tx.cashRepaymentReceived && tx.type !== 'SUPPLIER_REPAYMENT') {
      totalRepaymentReceived += tx.cashRepaymentReceived;
    }

    if ((tx.type === 'COLLECTION_AND_SETTLEMENT' || !tx.type) && tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
      tx.items.forEach((item) => {
        if (!item) return;
        const isRawMaterial =
          (item.productName && (item.productName.includes('ကုန်ကြမ်း') || item.productName.includes('ဝါးနှီး'))) ||
          (_products || []).some((p) => p && p.id === item.productId && p.category && p.category.includes('ကုန်ကြမ်း'));
        if (isRawMaterial) {
          return;
        }
        totalGoodsCount += item.quantity || 0;
        if (!itemCounts[item.productId]) {
          itemCounts[item.productId] = {
            name: item.productName || '',
            count: 0,
            unit: item.unit || 'ထည်',
            totalValue: 0,
          };
        }
        itemCounts[item.productId].count += item.quantity || 0;
        itemCounts[item.productId].totalValue += item.subtotal || 0;
      });
    }
  });

  return {
    date,
    totalSuppliersVisited: visitedSupplierIds.size,
    totalGoodsCount,
    totalGoodsValue,
    totalAdvanceDeducted,
    totalNewAdvanceGiven,
    totalCashPaid,
    totalMaterialCreditGiven,
    totalRepaymentReceived,
    itemCounts,
  };
}

export interface ProductStockStats {
  product: Product;
  openingStock: number;
  totalInflow: number;
  totalOutflow: number;
  adjustments: number;
  currentStock: number;
  procurementValue: number;
  potentialSalesValue: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
}

export function computeAllProductsStock(
  products: Product[] = [],
  transactions: TransactionRecord[] = [],
  sales: SaleRecord[] = [],
  adjustments: StockAdjustmentRecord[] = [],
  merchantPurchases: MerchantPurchaseRecord[] = [],
  peerTrades: PeerTradeRecord[] = []
): ProductStockStats[] {
  const summaries = calculateAllProductsStockLedgerSummaries(
    products,
    transactions,
    sales,
    adjustments,
    merchantPurchases,
    peerTrades
  );

  return summaries.map((s) => {
    const minAlert = s.product.minStockAlert ?? 10;
    let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' = 'IN_STOCK';
    if (s.calculatedClosingBalance <= 0) {
      status = 'OUT_OF_STOCK';
    } else if (s.calculatedClosingBalance <= minAlert) {
      status = 'LOW_STOCK';
    }

    return {
      product: s.product,
      openingStock: s.openingBalance,
      totalInflow: s.totalInflowQty,
      totalOutflow: s.totalOutflowQty,
      adjustments: s.totalAdjustmentNetQty,
      currentStock: s.calculatedClosingBalance,
      procurementValue: s.currentStockCostValuation,
      potentialSalesValue: s.currentStockWholesaleValuation,
      status,
    };
  });
}

export function computeRawMaterialsStock(
  presets: RawMaterialPreset[] = [],
  merchantPurchases: MerchantPurchaseRecord[] = [],
  transactions: TransactionRecord[] = [],
  sales: SaleRecord[] = [],
  _adjustments: StockAdjustmentRecord[] = []
): RawMaterialStockStat[] {
  // Filter out pure cash advances as they are money, not raw materials
  const materialPresets = (presets || []).filter((p) => p && p.category !== 'CASH_ADVANCE');

  // Map to accumulate inflows, outflows, and details
  const materialMap = new Map<
    string,
    {
      id: string;
      name: string;
      category: string;
      categoryLabel: string;
      unit: string;
      unitPrice: number;
      inflow: number;
      outflow: number;
    }
  >();

  materialPresets.forEach((p) => {
    materialMap.set(p.name.trim().toLowerCase(), {
      id: p.id,
      name: p.name,
      category: p.category,
      categoryLabel: p.categoryLabel || 'ကုန်ကြမ်း',
      unit: p.defaultUnit || 'ခု',
      unitPrice: p.defaultUnitPrice || 0,
      inflow: 0,
      outflow: 0,
    });
  });

  // 1. Process Merchant Purchases (Inflows)
  (merchantPurchases || []).forEach((pur) => {
    if (pur.status === 'CANCELLED') return;
    (pur.items || []).forEach((item) => {
      const name = (item.productName || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      let record = materialMap.get(key);
      if (!record) {
        record = {
          id: item.productId || `rm-${generateStableId('custom')}`,
          name,
          category: 'OTHER',
          categoryLabel: 'အခြားကုန်ကြမ်း',
          unit: item.unit || 'ခု',
          unitPrice: item.unitPrice || 0,
          inflow: 0,
          outflow: 0,
        };
        materialMap.set(key, record);
      }
      record.inflow += Number(item.quantity) || 0;
      if (item.unitPrice && item.unitPrice > 0) {
        record.unitPrice = item.unitPrice;
      }
    });
  });

  // 2. Process Supplier Transactions (Outflow via Raw Material Credit)
  (transactions || []).forEach((tx) => {
    if (tx.status === 'CANCELLED') return;
    if (tx.type === 'RAW_MATERIAL_CREDIT') {
      const items = tx.rawMaterialItems && tx.rawMaterialItems.length > 0 ? tx.rawMaterialItems : tx.items || [];
      items.forEach((item: any) => {
        const name = (item.name || item.productName || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        let record = materialMap.get(key);
        if (!record) {
          record = {
            id: item.id || `rm-${generateStableId('custom')}`,
            name,
            category: 'OTHER',
            categoryLabel: 'အခြားကုန်ကြမ်း',
            unit: item.unit || 'ခု',
            unitPrice: item.unitPrice || 0,
            inflow: 0,
            outflow: 0,
          };
          materialMap.set(key, record);
        }
        record.outflow += Number(item.quantity) || 0;
      });
    }
  });

  // 3. Process Direct Sales (Outflow via Direct Raw Material Sales)
  (sales || []).forEach((sale) => {
    if (sale.status === 'CANCELLED') return;
    (sale.items || []).forEach((item) => {
      let rawName = '';
      if (item.productId && (item.productId.startsWith('rm-') || materialPresets.some((p) => p.id === item.productId))) {
        rawName = item.productName.replace(/^\[ကုန်ကြမ်း\]\s*/, '').trim();
      } else if (item.productName && item.productName.startsWith('[ကုန်ကြမ်း]')) {
        rawName = item.productName.replace(/^\[ကုန်ကြမ်း\]\s*/, '').trim();
      } else {
        const directMatch = materialPresets.find(
          (p) => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase()
        );
        if (directMatch) rawName = directMatch.name;
      }

      if (rawName) {
        const key = rawName.toLowerCase();
        const record = materialMap.get(key);
        if (record) {
          record.outflow += Number(item.quantity) || 0;
        }
      }
    });
  });

  // 4. Build final stats
  return Array.from(materialMap.values()).map((m) => {
    const currentStock = Math.max(0, m.inflow - m.outflow);
    let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' = 'IN_STOCK';
    if (currentStock <= 0) {
      status = 'OUT_OF_STOCK';
    } else if (currentStock <= 10) {
      status = 'LOW_STOCK';
    }

    return {
      id: m.id,
      name: m.name,
      category: m.category,
      categoryLabel: m.categoryLabel,
      defaultUnit: m.unit,
      unitPrice: m.unitPrice,
      totalInflow: m.inflow,
      totalOutflow: m.outflow,
      currentStock,
      estimatedValuation: currentStock * m.unitPrice,
      status,
    };
  });
}

export async function saveFileWithLocationPrompt(
  blob: Blob,
  defaultFilename: string,
  pickerTypes?: { description: string; accept: Record<string, string[]> }[]
): Promise<{ success: boolean; method: 'picker' | 'download'; fileName: string }> {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const ext = '.' + (defaultFilename.split('.').pop() || 'json');
      const mime = blob.type || 'application/octet-stream';
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: pickerTypes || [
          {
            description: ext === '.json' ? 'JSON Backup File' : 'CSV Data File',
            accept: { [mime]: [ext] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, method: 'picker', fileName: handle.name || defaultFilename };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'picker', fileName: defaultFilename };
      }
      console.warn('showSaveFilePicker fallback to anchor download', err);
    }
  }

  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = defaultFilename;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { success: true, method: 'download', fileName: defaultFilename };
}

export async function exportBackupJSON(
  products: Product[],
  suppliers: Supplier[],
  transactions: TransactionRecord[],
  merchants: Merchant[],
  sales: SaleRecord[],
  stockAdjustments: StockAdjustmentRecord[],
  shopSettings?: ShopSettings,
  customFileName?: string,
  useLocationPicker: boolean = false
): Promise<{ success: boolean; method: 'picker' | 'download'; fileName: string }> {
  const completeBackup = await createCompleteBackup();
  return downloadBackupFile(completeBackup, useLocationPicker);
}

export function exportSuppliersCSV(suppliers: Supplier[]): void {
  const headers = ['စဥ်', 'ကုဒ်', 'အမည်', 'ဖုန်း', 'ရွာ/လိပ်စာ', 'လက်ကျန်အကြိုငွေ (ကျပ်)', 'ပေးသွင်းပြီးတန်ဖိုး (ကျပ်)', 'ထုတ်ပေးပြီးအကြိုငွေ (ကျပ်)', 'မှတ်ချက်'];
  const rows = suppliers.map((s, index) => [
    index + 1,
    `"${s.code}"`,
    `"${s.name}"`,
    `"${s.phone || '-'}"`,
    `"${s.village || '-'}"`,
    s.currentAdvanceBalance,
    s.totalGoodsValueDelivered,
    s.totalAdvanceGiven,
    `"${(s.notes || '').replace(/"/g, '""')}"`,
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = `ကုန်ကြမ်းပေးသွင်းသူများ_${getTodayDateString()}.csv`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportMerchantsCSV(merchants: Merchant[]): void {
  const headers = ['စဥ်', 'ကုဒ်', 'ကုန်သည်အမည်', 'မြို့နယ်', 'ဖုန်း', 'လိပ်စာ', 'ရရန်ကျန်ငွေ (ကျပ်)', 'ဝယ်ယူမှုစုစုပေါင်း (ကျပ်)', 'ပေးချေပြီးငွေ (ကျပ်)', 'မှတ်ချက်'];
  const rows = merchants.map((m, index) => [
    index + 1,
    `"${m.code}"`,
    `"${m.name}"`,
    `"${m.town || '-'}"`,
    `"${m.phone || '-'}"`,
    `"${(m.address || '-').replace(/"/g, '""')}"`,
    m.currentReceivableBalance,
    m.totalPurchasesValue,
    m.totalPaidAmount,
    `"${(m.notes || '').replace(/"/g, '""')}"`,
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = `ကုန်သည်များစာရင်း_${getTodayDateString()}.csv`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportInventoryCSV(stockStats: ProductStockStats[]): void {
  const headers = ['စဥ်', 'ကုန်ပစ္စည်းအမည်', 'အမျိုးအစား', 'ယူနစ်', 'စတင်လက်ကျန်', 'အဝင်စုစုပေါင်း', 'အထွက်စုစုပေါင်း', 'လက်ရှိလက်ကျန်', 'ဝယ်စျေး (ကျပ်)', 'လက္ကားရောင်းစျေး (ကျပ်)', 'အရင်းတန်ဖိုး (ကျပ်)', 'အခြေအနေ'];
  const rows = stockStats.map((item, index) => [
    index + 1,
    `"${item.product.name}"`,
    `"${item.product.category}"`,
    `"${item.product.unit}"`,
    item.openingStock,
    item.totalInflow,
    item.totalOutflow,
    item.currentStock,
    item.product.defaultPrice,
    item.product.defaultWholesalePrice || Math.round(item.product.defaultPrice * 1.25),
    item.procurementValue,
    item.status === 'OUT_OF_STOCK' ? 'ပစ္စည်းပြတ်' : item.status === 'LOW_STOCK' ? 'လက်ကျန်နည်း' : 'လက်ကျန်ရှိ',
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = `ကုန်ပစ္စည်းလက်ကျန်_${getTodayDateString()}.csv`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportMerchantSalesCSV(sales: SaleRecord[] = []): void {
  const headers = ['ဘောင်ချာနံပါတ်', 'ရက်စွဲ', 'အချိန်', 'ကုန်သည်အမည်', 'မြို့နယ်', 'ကုန်ပစ္စည်းအမည်', 'အရေအတွက်', 'ယူနစ်', 'ရောင်းစျေး', 'ကျသင့်ငွေ', 'စုစုပေါင်းကျသင့်ငွေ', 'ပေးငွေ', 'ရရန်ကျန်ငွေ (ကျပ်)', 'မှတ်ချက်'];
  const rows: (string | number)[][] = [];
  (sales || []).forEach((s) => {
    if (s && s.items && s.items.length > 0) {
      s.items.forEach((item, idx) => {
        rows.push([
          `"${s.voucherNo || ''}"`,
          `"${s.date || ''}"`,
          `"${s.time || ''}"`,
          `"${s.merchantName || ''}"`,
          `"${s.merchantTown || ''}"`,
          `"${item?.productName || ''}"`,
          item?.quantity || 0,
          `"${item?.unit || ''}"`,
          item?.unitPrice || 0,
          item?.subtotal || 0,
          idx === 0 ? (s.grandTotal || 0) : '',
          idx === 0 ? (s.cashPaidByMerchant || 0) : '',
          idx === 0 ? (s.remainingReceivableBalance || 0) : '',
          idx === 0 ? `"${(s.notes || '').replace(/"/g, '""')}"` : '',
        ]);
      });
    }
  });
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = `ကုန်သည်အရောင်းမှတ်တမ်း_${getTodayDateString()}.csv`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export const exportSalesHistoryCSV = exportMerchantSalesCSV;
export { generate100SampleSuppliers } from '../data/defaultData';

export function exportDailyCollectionCSV(date: string, transactions: TransactionRecord[] = []): void {
  const dayTxs = (transactions || []).filter((t) => t && t.date === date);
  const headers = ['ဘောင်ချာနံပါတ်', 'အချိန်', 'ကုန်ကြမ်းပေးသွင်းသူ', 'ပစ္စည်းအမည်', 'အရေအတွက်', 'ယူနစ်', 'စျေးနှုန်း', 'သင့်ငွေ', 'ယခင်အကြိုငွေ', 'နုတ်ယူငွေ', 'အပိုပေးငွေ', 'အကြိုငွေအသစ်', 'လက်ကျန်အကြိုငွေ', 'မှတ်ချက်'];
  const rows: (string | number)[][] = [];
  dayTxs.forEach((tx) => {
    if (tx && tx.items && tx.items.length > 0) {
      tx.items.forEach((item, itemIdx) => {
        rows.push([
          `"${tx.voucherNo || ''}"`,
          `"${tx.time || ''}"`,
          `"${tx.supplierName || ''}"`,
          `"${item?.productName || ''}"`,
          item?.quantity || 0,
          `"${item?.unit || ''}"`,
          item?.unitPrice || 0,
          item?.subtotal || 0,
          itemIdx === 0 ? (tx.previousAdvanceBalance || 0) : '',
          itemIdx === 0 ? (tx.advanceDeducted || 0) : '',
          itemIdx === 0 ? (tx.cashPaidToSupplier || 0) : '',
          itemIdx === 0 ? (tx.newAdvanceTaken || 0) : '',
          itemIdx === 0 ? (tx.remainingAdvanceBalance || 0) : '',
          itemIdx === 0 ? `"${(tx.notes || '').replace(/"/g, '""')}"` : '',
        ]);
      });
    } else if (tx) {
      rows.push([
        `"${tx.voucherNo || ''}"`,
        `"${tx.time || ''}"`,
        `"${tx.supplierName || ''}"`,
        '-',
        0,
        '-',
        0,
        0,
        tx.previousAdvanceBalance || 0,
        tx.advanceDeducted || 0,
        tx.cashPaidToSupplier || 0,
        tx.newAdvanceTaken || 0,
        tx.remainingAdvanceBalance || 0,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
      ]);
    }
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = `နေ့စဥ်ကုန်သိမ်းစာရင်း_${date}.csv`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function createSyncPacket(
  products: Product[],
  suppliers: Supplier[],
  merchants: Merchant[],
  transactions: TransactionRecord[],
  sales: SaleRecord[],
  stockAdjustments: StockAdjustmentRecord[],
  merchantOrders: MerchantOrder[] = [],
  merchantPurchases: MerchantPurchaseRecord[] = [],
  peerTraders: PeerTrader[] = [],
  peerTransactions: PeerTransaction[] = [],
  shopSettings: ShopSettings = DEFAULT_SHOP_SETTINGS
): SyncPacket {
  const dev = getStoredDeviceSettings();
  return {
    shopId: dev.shopGroupId || 'SHWE-LET-YAR-01',
    shopName: shopSettings.shopName || 'ရွှေလက်ရာ',
    senderDeviceId: dev.deviceId,
    senderDeviceName: dev.deviceName,
    timestamp: Date.now(),
    version: '2.0.0',
    data: {
      products,
      suppliers,
      merchants,
      transactions,
      sales,
      stockAdjustments,
      merchantOrders,
      merchantPurchases,
      peerTraders,
      peerTransactions,
      shopSettings,
    },
  };
}

export interface MergeResult {
  success: boolean;
  message: string;
  products: Product[];
  suppliers: Supplier[];
  merchants: Merchant[];
  transactions: TransactionRecord[];
  sales: SaleRecord[];
  stockAdjustments: StockAdjustmentRecord[];
  merchantOrders: MerchantOrder[];
  merchantPurchases: MerchantPurchaseRecord[];
  peerTraders: PeerTrader[];
  peerTransactions: PeerTransaction[];
  shopSettings: ShopSettings;
  newTransactionsCount: number;
  newSalesCount: number;
  newOrdersCount: number;
  newPeersCount: number;
}

export function mergeSyncPacket(
  incomingOrLocal: SyncPacket | {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    stockAdjustments: StockAdjustmentRecord[];
    merchantOrders?: MerchantOrder[];
    merchantPurchases?: MerchantPurchaseRecord[];
    peerTraders?: PeerTrader[];
    peerTransactions?: PeerTransaction[];
    shopSettings?: ShopSettings;
  },
  maybeIncoming?: SyncPacket
): MergeResult {
  let localData: {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    stockAdjustments: StockAdjustmentRecord[];
    merchantOrders?: MerchantOrder[];
    merchantPurchases?: MerchantPurchaseRecord[];
    peerTraders?: PeerTrader[];
    peerTransactions?: PeerTransaction[];
    shopSettings?: ShopSettings;
  };
  let incoming: SyncPacket;

  if (maybeIncoming) {
    localData = incomingOrLocal as any;
    incoming = maybeIncoming;
  } else {
    incoming = incomingOrLocal as SyncPacket;
    localData = {
      products: getStoredProducts(),
      suppliers: getStoredSuppliers(),
      merchants: getStoredMerchants(),
      transactions: getStoredTransactions(),
      sales: getStoredSales(),
      stockAdjustments: getStoredStockAdjustments(),
      merchantOrders: getStoredMerchantOrders(),
      peerTraders: getStoredPeerTraders(),
      peerTransactions: getStoredPeerTransactions(),
      shopSettings: getStoredShopSettings(),
    };
  }

  const local = localData;
  const remote = incoming.data || ({} as any);

  const localTxMap = new Map<string, TransactionRecord>();
  (local.transactions || []).forEach((t) => localTxMap.set(t.id, t));
  let newTransactionsCount = 0;
  (remote.transactions || []).forEach((rt: TransactionRecord) => {
    if (!localTxMap.has(rt.id)) {
      localTxMap.set(rt.id, rt);
      newTransactionsCount++;
    }
  });
  const mergedTransactions = Array.from(localTxMap.values()).sort(
    (a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))
  );

  const localSaleMap = new Map<string, SaleRecord>();
  (local.sales || []).forEach((s) => localSaleMap.set(s.id, s));
  let newSalesCount = 0;
  (remote.sales || []).forEach((rs: SaleRecord) => {
    if (!localSaleMap.has(rs.id)) {
      localSaleMap.set(rs.id, rs);
      newSalesCount++;
    }
  });
  const mergedSales = Array.from(localSaleMap.values()).sort(
    (a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))
  );

  const localOrderMap = new Map<string, MerchantOrder>();
  (local.merchantOrders || []).forEach((o) => localOrderMap.set(o.id, o));
  let newOrdersCount = 0;
  (remote.merchantOrders || []).forEach((ro: MerchantOrder) => {
    if (!localOrderMap.has(ro.id)) {
      localOrderMap.set(ro.id, ro);
      newOrdersCount++;
    } else {
      const lo = localOrderMap.get(ro.id)!;
      if (ro.status === 'DELIVERED' && lo.status !== 'DELIVERED') {
        localOrderMap.set(ro.id, ro);
      }
    }
  });
  const mergedOrders = Array.from(localOrderMap.values());

  const localPurMap = new Map<string, MerchantPurchaseRecord>();
  (local.merchantPurchases || []).forEach((p) => localPurMap.set(p.id, p));
  (remote.merchantPurchases || []).forEach((rp: MerchantPurchaseRecord) => {
    if (!localPurMap.has(rp.id)) {
      localPurMap.set(rp.id, rp);
    }
  });
  const mergedPurchases = Array.from(localPurMap.values());

  const localPeerMap = new Map<string, PeerTrader>();
  (local.peerTraders || []).forEach((p) => localPeerMap.set(p.id, p));
  (remote.peerTraders || []).forEach((rp: PeerTrader) => {
    if (!localPeerMap.has(rp.id)) {
      localPeerMap.set(rp.id, rp);
    }
  });
  const mergedPeers = Array.from(localPeerMap.values());

  const localPtxMap = new Map<string, PeerTransaction>();
  (local.peerTransactions || []).forEach((ptx) => localPtxMap.set(ptx.id, ptx));
  let newPeersCount = 0;
  (remote.peerTransactions || []).forEach((rptx: PeerTransaction) => {
    if (!localPtxMap.has(rptx.id)) {
      localPtxMap.set(rptx.id, rptx);
      newPeersCount++;
    }
  });
  const mergedPeerTransactions = Array.from(localPtxMap.values());

  const localAdjMap = new Map<string, StockAdjustmentRecord>();
  (local.stockAdjustments || []).forEach((a) => localAdjMap.set(a.id, a));
  (remote.stockAdjustments || []).forEach((ra: StockAdjustmentRecord) => {
    if (!localAdjMap.has(ra.id)) {
      localAdjMap.set(ra.id, ra);
    }
  });
  const mergedAdjustments = Array.from(localAdjMap.values());

  const localProdMap = new Map<string, Product>();
  (local.products || []).forEach((p) => localProdMap.set(p.id, p));
  (remote.products || []).forEach((rp: Product) => {
    if (!localProdMap.has(rp.id)) {
      localProdMap.set(rp.id, rp);
    }
  });
  const mergedProducts = Array.from(localProdMap.values());

  const localSuppMap = new Map<string, Supplier>();
  (local.suppliers || []).forEach((s) => localSuppMap.set(s.id, s));
  (remote.suppliers || []).forEach((rs: Supplier) => {
    if (!localSuppMap.has(rs.id)) {
      localSuppMap.set(rs.id, rs);
    }
  });

  const mergedSuppliers = Array.from(localSuppMap.values()).map((supp) => {
    const suppTxs = mergedTransactions.filter((t) => t.supplierId === supp.id);
    if (suppTxs.length === 0) return supp;
    const latestTx = suppTxs[0];
    let totalGoodsDelivered = 0;
    let totalAdvanceGiven = supp.initialAdvance || 0;
    suppTxs.forEach((t) => {
      totalGoodsDelivered += t.totalGoodsValue || 0;
      totalAdvanceGiven += t.newAdvanceTaken || 0;
    });
    return {
      ...supp,
      currentAdvanceBalance: latestTx.remainingAdvanceBalance ?? supp.currentAdvanceBalance,
      totalGoodsValueDelivered: Math.max(supp.totalGoodsValueDelivered || 0, totalGoodsDelivered),
      totalAdvanceGiven: Math.max(supp.totalAdvanceGiven || 0, totalAdvanceGiven),
      updatedAt: getTodayDateString(),
    };
  });

  const localMerchMap = new Map<string, Merchant>();
  (local.merchants || []).forEach((m) => localMerchMap.set(m.id, m));
  (remote.merchants || []).forEach((rm: Merchant) => {
    if (!localMerchMap.has(rm.id)) {
      localMerchMap.set(rm.id, rm);
    }
  });
  const mergedMerchants = Array.from(localMerchMap.values()).map((merch) => {
    const merchSales = mergedSales.filter((s) => s.merchantId === merch.id);
    if (merchSales.length === 0) return merch;
    const latestSale = merchSales[0];
    let totalPurchases = 0;
    let totalPaid = 0;
    merchSales.forEach((s) => {
      totalPurchases += s.grandTotal || (s as any).totalAmount || 0;
      totalPaid += s.cashPaidByMerchant || (s as any).paidAmount || 0;
    });
    return {
      ...merch,
      currentReceivableBalance: latestSale.remainingReceivableBalance ?? merch.currentReceivableBalance,
      totalPurchasesValue: Math.max(merch.totalPurchasesValue || 0, totalPurchases),
      totalPaidAmount: Math.max(merch.totalPaidAmount || 0, totalPaid),
      updatedAt: getTodayDateString(),
    };
  });

  saveStoredProducts(mergedProducts);
  saveStoredSuppliers(mergedSuppliers);
  saveStoredMerchants(mergedMerchants);
  saveStoredTransactions(mergedTransactions);
  saveStoredSales(mergedSales);
  saveStoredStockAdjustments(mergedAdjustments);
  saveStoredMerchantOrders(mergedOrders);
  saveStoredPeerTraders(mergedPeers);
  saveStoredPeerTransactions(mergedPeerTransactions);
  if (remote.shopSettings) {
    saveStoredShopSettings(remote.shopSettings);
  }

  return {
    success: true,
    message: `ဒေတာ အောင်မြင်စွာ ပေါင်းစပ်ပြီးပါပြီ! (အရောင်း: ${newSalesCount} စောင်၊ ကုန်သိမ်း: ${newTransactionsCount} စောင်၊ အော်ဒါ: ${newOrdersCount} ခု)`,
    products: mergedProducts,
    suppliers: mergedSuppliers,
    merchants: mergedMerchants,
    transactions: mergedTransactions,
    sales: mergedSales,
    stockAdjustments: mergedAdjustments,
    merchantOrders: mergedOrders,
    merchantPurchases: mergedPurchases,
    peerTraders: mergedPeers,
    peerTransactions: mergedPeerTransactions,
    shopSettings: remote.shopSettings || local.shopSettings || DEFAULT_SHOP_SETTINGS,
    newTransactionsCount,
    newSalesCount,
    newOrdersCount,
    newPeersCount,
  };
}

export function exportOfflineAppPackage(
  data: {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    shopSettings: ShopSettings;
  }
): void {
  const serialized = JSON.stringify(data, null, 2);
  const htmlContent = `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.shopSettings.shopName || 'ရွှေလက်ရာ'} - Offline App Package</title>
  <style>
    body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; text-align: center; }
    .card { max-width: 480px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #10b981; font-size: 20px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .btn { display: block; width: 100%; padding: 14px; margin-top: 16px; background: #10b981; color: white; border: none; border-radius: 10px; font-weight: bold; font-size: 16px; cursor: pointer; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${data.shopSettings.shopName || 'ရွှေလက်ရာ'}</h1>
    <p>ဤဖိုင်သည် Zapya သို့မဟုတ် Bluetooth ဖြင့် ကူးယူအသုံးပြုနိုင်သော အော့ဖ်လိုင်းအက်ပ်ပတ်ကေ့ဂျ်ဖြစ်ပါသည်။</p>
    <p>ဖုန်း browser တွင် တိုက်ရိုက်ဖွင့်ပြီး App ကို ဆက်လက်အသုံးပြုနိုင်ပါသည်။</p>
    <a href="http://localhost:3000" class="btn">အက်ပ်ဖွင့်မည် (Open App)</a>
    <script>
      window.__OFFLINE_DATA__ = ${serialized};
    </script>
  </div>
</body>
</html>`;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = `ShweLetYar_Offline_App_${getTodayDateString()}.html`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Convenience Aliases & Storage Handlers
export const loadSuppliers = getStoredSuppliers;
export const saveSuppliers = saveStoredSuppliers;
export const loadMerchants = getStoredMerchants;
export const saveMerchants = saveStoredMerchants;
export const loadProducts = getStoredProducts;
export const saveProducts = saveStoredProducts;
export const loadTransactions = getStoredTransactions;
export const saveTransactions = saveStoredTransactions;
export const loadSales = getStoredSales;
export const saveSales = saveStoredSales;
export const loadOrders = getStoredMerchantOrders;
export const saveOrders = saveStoredMerchantOrders;
export const loadShopSettings = getStoredShopSettings;
export const saveShopSettings = saveStoredShopSettings;
export const loadAppLockSettings = getStoredAppLockSettings;
export const saveAppLockSettings = saveStoredAppLockSettings;

export function loadPeerTrades(): any[] {
  return safeLocalStorageGet('ledger_peer_trades_v1', []);
}

export function savePeerTrades(trades: any[]): void {
  try {
    const list = trades || [];
    db.peerTrades.clear().then(() => db.peerTrades.bulkPut(list)).catch((err) => console.error('Dexie save peer trades error:', err));
  } catch (e) {
    console.error('Error saving peer trades', e);
  }
}

export function loadDeletedItems(): any[] {
  return safeLocalStorageGet('ledger_deleted_items_v1', []);
}

export function saveDeletedItems(items: any[]): void {
  try {
    const list = items || [];
    db.softDeletedItems.clear().then(() => db.softDeletedItems.bulkPut(list)).catch((err) => console.error('Dexie save soft deleted error:', err));
  } catch (e) {
    console.error('Error saving deleted items', e);
  }
}

export function findPotentialDuplicateTransaction(
  newTx: Partial<TransactionRecord>,
  existingTransactions: TransactionRecord[]
): TransactionRecord | null {
  if (!newTx || !existingTransactions || existingTransactions.length === 0) return null;
  const targetSupplierId = newTx.supplierId;
  const targetDate = newTx.date;
  const targetTotal = newTx.totalGoodsValue || 0;
  const targetNetCash = newTx.netCashPaidToSupplier || 0;

  return (
    existingTransactions.find((tx) => {
      if (tx.supplierId !== targetSupplierId) return false;
      if (tx.date !== targetDate) return false;
      if (Math.abs((tx.totalGoodsValue || 0) - targetTotal) > 0.01) return false;
      if (Math.abs((tx.netCashPaidToSupplier || 0) - targetNetCash) > 0.01) return false;
      const txItems = tx.items || [];
      const newItems = newTx.items || [];
      if (txItems.length !== newItems.length) return false;
      return newItems.every((nIt) =>
        txItems.some(
          (tIt) =>
            (tIt.productId === nIt.productId || tIt.productName === nIt.productName) &&
            tIt.quantity === nIt.quantity
        )
      );
    }) || null
  );
}

export function findPotentialDuplicateSale(
  newSale: Partial<SaleRecord>,
  existingSales: SaleRecord[]
): SaleRecord | null {
  if (!newSale || !existingSales || existingSales.length === 0) return null;
  const targetMerchantId = newSale.merchantId;
  const targetDate = newSale.date;
  const targetTotal = newSale.grandTotal || 0;
  const targetCash = newSale.cashPaidByMerchant || 0;

  return (
    existingSales.find((s) => {
      if (s.merchantId !== targetMerchantId) return false;
      if (s.date !== targetDate) return false;
      if (Math.abs((s.grandTotal || 0) - targetTotal) > 0.01) return false;
      if (Math.abs((s.cashPaidByMerchant || 0) - targetCash) > 0.01) return false;
      const sItems = s.items || [];
      const newItems = newSale.items || [];
      if (sItems.length !== newItems.length) return false;
      return newItems.every((nIt) =>
        sItems.some(
          (sIt) =>
            (sIt.productId === nIt.productId || sIt.productName === nIt.productName) &&
            sIt.quantity === nIt.quantity
        )
      );
    }) || null
  );
}

export interface MergeSyncResult {
  success: boolean;
  message: string;
  stats: {
    addedTransactions: number;
    addedSales: number;
    addedPurchases: number;
    addedOrders: number;
    addedProducts: number;
    addedSuppliers: number;
    addedMerchants: number;
    addedPeerTrades: number;
  };
  mergedData: any;
}

/**
 * Intelligently merges snapshots from multiple devices (e.g. Phone A and Phone B over Hotspot/Wifi/Zapya).
 * Combines transactions, sales, products, merchants without creating duplicate records or overwriting unsynced entries.
 */
export function mergeDatabaseSnapshots(
  localData: any,
  incomingData: any
): MergeSyncResult {
  const stats = {
    addedTransactions: 0,
    addedSales: 0,
    addedPurchases: 0,
    addedOrders: 0,
    addedProducts: 0,
    addedSuppliers: 0,
    addedMerchants: 0,
    addedPeerTrades: 0,
  };

  if (!incomingData || typeof incomingData !== 'object') {
    return {
      success: false,
      message: 'မမှန်ကန်သော ဒေတာဖိုင် ဖြစ်နေပါသည် (Data format invalid)',
      stats,
      mergedData: localData,
    };
  }

  // 1. Transactions Merge (De-duplicate by ID or voucherNo)
  const localTx: TransactionRecord[] = Array.isArray(localData?.transactions) ? [...localData.transactions] : [];
  const incTx: TransactionRecord[] = Array.isArray(incomingData?.transactions) ? incomingData.transactions : [];
  incTx.forEach((it) => {
    if (!it) return;
    const exists = localTx.some((lt) => lt.id === it.id || (lt.voucherNo && lt.voucherNo === it.voucherNo));
    if (!exists) {
      localTx.push(it);
      stats.addedTransactions++;
    }
  });
  localTx.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

  // 2. Sales Merge (De-duplicate by ID or voucherNo)
  const localSales: SaleRecord[] = Array.isArray(localData?.sales) ? [...localData.sales] : [];
  const incSales: SaleRecord[] = Array.isArray(incomingData?.sales) ? incomingData.sales : [];
  incSales.forEach((is) => {
    if (!is) return;
    const exists = localSales.some((ls) => ls.id === is.id || (ls.voucherNo && ls.voucherNo === is.voucherNo));
    if (!exists) {
      localSales.push(is);
      stats.addedSales++;
    }
  });
  localSales.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

  // 3. Merchant Purchases Merge
  const localPurchases: MerchantPurchaseRecord[] = Array.isArray(localData?.merchantPurchases) ? [...localData.merchantPurchases] : [];
  const incPurchases: MerchantPurchaseRecord[] = Array.isArray(incomingData?.merchantPurchases) ? incomingData.merchantPurchases : [];
  incPurchases.forEach((ip) => {
    if (!ip) return;
    const exists = localPurchases.some((lp) => lp.id === ip.id || (lp.purchaseNo && lp.purchaseNo === ip.purchaseNo));
    if (!exists) {
      localPurchases.push(ip);
      stats.addedPurchases++;
    }
  });

  // 4. Products Merge (Combine products)
  const localProducts: Product[] = Array.isArray(localData?.products) ? [...localData.products] : [];
  const incProducts: Product[] = Array.isArray(incomingData?.products) ? incomingData.products : [];
  incProducts.forEach((ip) => {
    if (!ip || !ip.name) return;
    const existsIndex = localProducts.findIndex((lp) => lp.id === ip.id || lp.name.trim().toLowerCase() === ip.name.trim().toLowerCase());
    if (existsIndex === -1) {
      localProducts.push(ip);
      stats.addedProducts++;
    }
  });

  // 5. Suppliers Merge (Combine suppliers)
  const localSuppliers: Supplier[] = Array.isArray(localData?.suppliers) ? [...localData.suppliers] : [];
  const incSuppliers: Supplier[] = Array.isArray(incomingData?.suppliers) ? incomingData.suppliers : [];
  incSuppliers.forEach((is) => {
    if (!is || !is.name) return;
    const exists = localSuppliers.some((ls) => ls.id === is.id || ls.name.trim() === is.name.trim());
    if (!exists) {
      localSuppliers.push(is);
      stats.addedSuppliers++;
    }
  });

  // 6. Merchants Merge
  const localMerchants: Merchant[] = Array.isArray(localData?.merchants) ? [...localData.merchants] : [];
  const incMerchants: Merchant[] = Array.isArray(incomingData?.merchants) ? incomingData.merchants : [];
  incMerchants.forEach((im) => {
    if (!im || !im.name) return;
    const exists = localMerchants.some((lm) => lm.id === im.id || lm.name.trim() === im.name.trim());
    if (!exists) {
      localMerchants.push(im);
      stats.addedMerchants++;
    }
  });

  // 7. Orders Merge
  const localOrders: MerchantOrder[] = Array.isArray(localData?.orders) ? [...localData.orders] : [];
  const incOrders: MerchantOrder[] = Array.isArray(incomingData?.orders) ? incomingData.orders : [];
  incOrders.forEach((io) => {
    if (!io) return;
    const existsIndex = localOrders.findIndex((lo) => lo.id === io.id || (lo.orderNo && lo.orderNo === io.orderNo));
    if (existsIndex === -1) {
      localOrders.push(io);
      stats.addedOrders++;
    } else {
      // If incoming order has a different status or date, sync it
      if (io.status && io.status !== localOrders[existsIndex].status) {
        localOrders[existsIndex] = { ...localOrders[existsIndex], ...io };
      }
    }
  });

  // 8. Categories Union
  const localProdCats = getStoredProductCategories();
  const incProdCats: string[] = Array.isArray(incomingData?.productCategories) ? incomingData.productCategories : [];
  const mergedProdCats = Array.from(new Set([...localProdCats, ...incProdCats]));
  saveStoredProductCategories(mergedProdCats);

  const localRawCats = getStoredRawMaterialCategories();
  const incRawCats: string[] = Array.isArray(incomingData?.rawMaterialCategories) ? incomingData.rawMaterialCategories : [];
  const mergedRawCats = Array.from(new Set([...localRawCats, ...incRawCats]));
  saveStoredRawMaterialCategories(mergedRawCats);

  const mergedData = {
    suppliers: localSuppliers,
    merchants: localMerchants,
    products: localProducts,
    transactions: localTx,
    sales: localSales,
    merchantPurchases: localPurchases,
    orders: localOrders,
    peerTrades: localData?.peerTrades || [],
    shopSettings: localData?.shopSettings || incomingData?.shopSettings || DEFAULT_SHOP_SETTINGS,
    productCategories: mergedProdCats,
    rawMaterialCategories: mergedRawCats,
    mergedAt: new Date().toISOString(),
  };

  // Save merged state into localStorage
  safeLocalStorageSet(STORAGE_KEYS.SUPPLIERS, localSuppliers);
  safeLocalStorageSet(STORAGE_KEYS.MERCHANTS, localMerchants);
  safeLocalStorageSet(STORAGE_KEYS.PRODUCTS, localProducts);
  safeLocalStorageSet(STORAGE_KEYS.TRANSACTIONS, localTx);
  safeLocalStorageSet(STORAGE_KEYS.SALES, localSales);
  safeLocalStorageSet(STORAGE_KEYS.MERCHANT_PURCHASES, localPurchases);
  safeLocalStorageSet(STORAGE_KEYS.MERCHANT_ORDERS, localOrders);

  return {
    success: true,
    message: `ဒေတာများ အောင်မြင်စွာ ပေါင်းစည်းပြီးပါပြီ (ကုန်သိမ်း +${stats.addedTransactions}, အရောင်း +${stats.addedSales}, ကုန်သည် +${stats.addedMerchants}, ကုန်သွင်းသူ +${stats.addedSuppliers})`,
    stats,
    mergedData,
  };
}

export async function exportAllDataJSON(passphrase?: string): Promise<void> {
  try {
    const fullBackup = {
      suppliers: getStoredSuppliers(),
      merchants: getStoredMerchants(),
      products: getStoredProducts(),
      transactions: getStoredTransactions(),
      sales: getStoredSales(),
      merchantPurchases: getStoredMerchantPurchases(),
      orders: getStoredMerchantOrders(),
      peerTrades: loadPeerTrades(),
      productCategories: getStoredProductCategories(),
      rawMaterialCategories: getStoredRawMaterialCategories(),
      rawMaterials: getStoredRawMaterialPresets(),
      shopSettings: getStoredShopSettings(),
      appLockSettings: getStoredAppLockSettings(),
      exportedAt: new Date().toISOString(),
    };
    let output: any = fullBackup;
    if (passphrase && passphrase.trim()) {
      const jsonStr = JSON.stringify(fullBackup);
      output = await encryptBackupPayload(jsonStr, passphrase.trim());
    }
    const jsonStr = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Shwe_let_yar_doc_backup_${getTodayDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export backup', err);
  }
}

