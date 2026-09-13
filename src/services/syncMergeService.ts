import { getBusinessInitialization } from './businessInitializationService';
import { db } from '../db/database';
import {
  Product,
  Supplier,
  Merchant,
  TransactionRecord,
  SaleRecord,
  MerchantPurchaseRecord,
  MerchantOrder,
  StockAdjustmentRecord,
  PeerTradeRecord,
  StockMovementRecord,
  CashMovementRecord,
  DailyClosingRecord,
  ReturnRecord,
  SoftDeletedItem,
  AuditLogEntry,
  MasterDataCategory,
  RawMaterialPreset,
  ShopSettings,
  AppLockSettings,
  AttachmentRecord,
  OpeningPosition,
} from '../types';
import {
  getStoredShopSettings,
  saveStoredShopSettings,
  getStoredAppLockSettings,
  getStoredProductCategories,
  saveStoredProductCategories,
  getStoredRawMaterialCategories,
  saveStoredRawMaterialCategories,
  getStoredRawMaterialPresets,
  saveStoredRawMaterialPresets,
  DEFAULT_SHOP_SETTINGS,
} from '../utils/storage';
import { recordAuditEvent } from './auditTrailService';
import { safeJsonParse, deepSanitizeUntrustedObject } from '../utils/security';
import { computeChecksum } from './backupService';
import {
  APP_VERSION,
  CURRENT_APP_VERSION,
  BACKUP_FORMAT_VERSION,
  CURRENT_BACKUP_FORMAT_VERSION,
  DATABASE_SCHEMA_VERSION,
  CURRENT_DATABASE_SCHEMA_VERSION,
} from '../constants/version';

export type SyncMergeMode = 'MERGE' | 'OVERWRITE';

export interface EntityMergeStats {
  added: number;
  updated: number;
  unchanged: number;
  total: number;
}

export interface SyncMergeStats {
  totalAdded: number;
  totalUpdated: number;
  totalDisjointUnioned: number;
  entityStats: {
    products: EntityMergeStats;
    suppliers: EntityMergeStats;
    merchants: EntityMergeStats;
    transactions: EntityMergeStats;
    sales: EntityMergeStats;
    merchantPurchases: EntityMergeStats;
    orders: EntityMergeStats;
    stockAdjustments: EntityMergeStats;
    peerTrades: EntityMergeStats;
    categories: { productCount: number; rawMaterialCount: number };
  };
}

export interface SyncMergeResult {
  success: boolean;
  mode: SyncMergeMode;
  message: string;
  stats: SyncMergeStats;
  mergedData: any;
  syncTimestamp: string;
}

export interface SyncPackagePayload {
  shweLetYarSync: boolean;
  formatVersion: string;
  appVersion: string;
  schemaVersion: number;
  timestamp: string;
  deviceId?: string;
  deviceName?: string;
  shopName?: string;
  checksum?: string;
  data: {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    merchantPurchases?: MerchantPurchaseRecord[];
    orders?: MerchantOrder[];
    stockAdjustments?: StockAdjustmentRecord[];
    peerTrades?: PeerTradeRecord[];
    softDeletedItems?: SoftDeletedItem[];
    rawMaterialPresets?: RawMaterialPreset[];
    attachments?: AttachmentRecord[];
    stockMovements?: StockMovementRecord[];
    cashMovements?: CashMovementRecord[];
    dailyClosings?: DailyClosingRecord[];
    returnsAndRefunds?: ReturnRecord[];
    productCategories?: string[];
    rawMaterialCategories?: string[];
    openingPositions?: OpeningPosition[];
    openingPosition?: OpeningPosition;
    businessInitialization?: any;
    shopSettings?: ShopSettings;
    appLockSettings?: AppLockSettings;
  };
}

/**
 * Extracts a numeric timestamp from any entity record based on updatedAt, timestamp, createdAt, or date+time
 */
export function getRecordTimestamp(record: any): number {
  if (!record || typeof record !== 'object') return 0;

  // 1. Direct numeric timestamp
  if (typeof record.updatedAt === 'number' && !isNaN(record.updatedAt)) {
    return record.updatedAt;
  }
  if (typeof record.timestamp === 'number' && !isNaN(record.timestamp)) {
    return record.timestamp;
  }
  if (typeof record.createdAt === 'number' && !isNaN(record.createdAt)) {
    return record.createdAt;
  }

  // 2. ISO String or Date string
  if (typeof record.updatedAt === 'string') {
    const parsed = Date.parse(record.updatedAt);
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof record.createdAt === 'string') {
    const parsed = Date.parse(record.createdAt);
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof record.timestamp === 'string') {
    const parsed = Date.parse(record.timestamp);
    if (!isNaN(parsed)) return parsed;
  }

  // 3. Fallback to date + time
  if (record.date) {
    const timeStr = record.time ? `T${record.time}` : 'T00:00:00';
    const dateTimeStr = `${record.date}${timeStr}`;
    const parsed = Date.parse(dateTimeStr);
    if (!isNaN(parsed)) return parsed;
  }

  return 0;
}

/**
 * Merges two arrays of entities with newer-wins for identical keys and union for disjoint records.
 */
export function mergeEntityList<T extends Record<string, any>>(
  localList: T[],
  incomingList: T[],
  getKey: (item: T) => string
): { merged: T[]; stats: EntityMergeStats } {
  const mergedMap = new Map<string, T>();
  const stats: EntityMergeStats = {
    added: 0,
    updated: 0,
    unchanged: 0,
    total: 0,
  };

  // Seed with local items
  for (const item of localList) {
    if (!item) continue;
    const key = getKey(item);
    if (key) {
      mergedMap.set(key, item);
    }
  }

  // Merge incoming items
  for (const incomingItem of incomingList) {
    if (!incomingItem) continue;
    const key = getKey(incomingItem);
    if (!key) continue;

    if (!mergedMap.has(key)) {
      // Disjoint record -> Union (Add)
      mergedMap.set(key, incomingItem);
      stats.added++;
    } else {
      // Key exists in both -> Newer wins
      const localItem = mergedMap.get(key)!;
      const incomingTime = getRecordTimestamp(incomingItem);
      const localTime = getRecordTimestamp(localItem);

      if (incomingTime > localTime) {
        // Incoming is newer
        mergedMap.set(key, { ...localItem, ...incomingItem });
        stats.updated++;
      } else {
        // Local is newer or equal -> keep local
        stats.unchanged++;
      }
    }
  }

  const merged = Array.from(mergedMap.values());
  stats.total = merged.length;
  return { merged, stats };
}

/**
 * Extracts and unpacks incoming raw payload into structured data
 */
export function unpackSyncPayload(raw: any): any {
  if (!raw || typeof raw !== 'object') return null;

  // Handle nested .data (e.g. VersionedBackupFile or SyncPacket)
  if (raw.data && typeof raw.data === 'object') {
    return {
      ...raw.data,
      productCategories: raw.data.productCategories || raw.productCategories || [],
      rawMaterialCategories: raw.data.rawMaterialCategories || raw.rawMaterialCategories || [],
      shopSettings: raw.data.shopSettings || raw.shopSettings,
      appLockSettings: raw.data.appLockSettings || raw.appLockSettings,
    };
  }

  return raw;
}

/**
 * Executes a Smart Merge or Overwrite on two datasets.
 */
export async function executeSyncMerge(
  localData: any,
  incomingRaw: any,
  options?: {
    mode?: SyncMergeMode;
    userId?: string;
    userName?: string;
  }
): Promise<SyncMergeResult> {
  const mode: SyncMergeMode = options?.mode || 'MERGE';
  const incoming = unpackSyncPayload(incomingRaw);

  const stats: SyncMergeStats = {
    totalAdded: 0,
    totalUpdated: 0,
    totalDisjointUnioned: 0,
    entityStats: {
      products: { added: 0, updated: 0, unchanged: 0, total: 0 },
      suppliers: { added: 0, updated: 0, unchanged: 0, total: 0 },
      merchants: { added: 0, updated: 0, unchanged: 0, total: 0 },
      transactions: { added: 0, updated: 0, unchanged: 0, total: 0 },
      sales: { added: 0, updated: 0, unchanged: 0, total: 0 },
      merchantPurchases: { added: 0, updated: 0, unchanged: 0, total: 0 },
      orders: { added: 0, updated: 0, unchanged: 0, total: 0 },
      stockAdjustments: { added: 0, updated: 0, unchanged: 0, total: 0 },
      peerTrades: { added: 0, updated: 0, unchanged: 0, total: 0 },
      categories: { productCount: 0, rawMaterialCount: 0 },
    },
  };

  if (!incoming || typeof incoming !== 'object') {
    return {
      success: false,
      mode,
      message: 'မမှန်ကန်သော ဒေတာဖိုင် ဖြစ်နေပါသည် (Invalid sync payload)',
      stats,
      mergedData: localData,
      syncTimestamp: new Date().toISOString(),
    };
  }

  // --- OVERWRITE MODE ---
  if (mode === 'OVERWRITE') {
    const overwrittenData = {
      products: Array.isArray(incoming.products) ? incoming.products : [],
      suppliers: Array.isArray(incoming.suppliers) ? incoming.suppliers : [],
      merchants: Array.isArray(incoming.merchants) ? incoming.merchants : [],
      transactions: Array.isArray(incoming.transactions) ? incoming.transactions : [],
      sales: Array.isArray(incoming.sales) ? incoming.sales : [],
      merchantPurchases: Array.isArray(incoming.merchantPurchases) ? incoming.merchantPurchases : [],
      orders: Array.isArray(incoming.orders) ? incoming.orders : [],
      stockAdjustments: Array.isArray(incoming.stockAdjustments) ? incoming.stockAdjustments : [],
      peerTrades: Array.isArray(incoming.peerTrades) ? incoming.peerTrades : [],
      softDeletedItems: Array.isArray(incoming.softDeletedItems) ? incoming.softDeletedItems : [],
      rawMaterialPresets: Array.isArray(incoming.rawMaterialPresets) ? incoming.rawMaterialPresets : [],
      attachments: Array.isArray(incoming.attachments) ? incoming.attachments : [],
      stockMovements: Array.isArray(incoming.stockMovements) ? incoming.stockMovements : [],
      cashMovements: Array.isArray(incoming.cashMovements) ? incoming.cashMovements : [],
      dailyClosings: Array.isArray(incoming.dailyClosings) ? incoming.dailyClosings : [],
      returnsAndRefunds: Array.isArray(incoming.returnsAndRefunds) ? incoming.returnsAndRefunds : [],
      openingPositions: Array.isArray(incoming.openingPositions) ? incoming.openingPositions : [],
      productCategories: Array.isArray(incoming.productCategories) ? incoming.productCategories : getStoredProductCategories(),
      rawMaterialCategories: Array.isArray(incoming.rawMaterialCategories) ? incoming.rawMaterialCategories : getStoredRawMaterialCategories(),
      shopSettings: incoming.shopSettings || localData?.shopSettings || DEFAULT_SHOP_SETTINGS,
      appLockSettings: incoming.appLockSettings || localData?.appLockSettings || getStoredAppLockSettings(),
    };

    // Audit Log for Overwrite
    try {
      await recordAuditEvent({
        action: 'ဒေတာ ထည့်သွင်းခြင်း (Clean Overwrite)',
        details: `ဒေတာ အားလုံးကို ပေးပို့လာသောဖိုင်ဖြင့် အစားထိုးခဲ့သည် (Products: ${overwrittenData.products.length}, Transactions: ${overwrittenData.transactions.length}, Sales: ${overwrittenData.sales.length})`,
        entityType: 'SYSTEM',
      });
    } catch (err) {
      console.error('Audit log error:', err);
    }

    return {
      success: true,
      mode: 'OVERWRITE',
      message: 'ဒေတာများ အားလုံးကို အောင်မြင်စွာ အစားထိုးပြီးပါပြီ (Clean Overwrite Completed)',
      stats,
      mergedData: overwrittenData,
      syncTimestamp: new Date().toISOString(),
    };
  }

  // --- SMART MERGE MODE (Newer Wins + Disjoint Union) ---

  // 1. Products
  const localProducts = Array.isArray(localData?.products) ? localData.products : [];
  const incProducts = Array.isArray(incoming?.products) ? incoming.products : [];
  const prodRes = mergeEntityList(localProducts, incProducts, (p) => p.id || p.name?.trim().toLowerCase() || '');
  stats.entityStats.products = prodRes.stats;

  // 2. Suppliers
  const localSuppliers = Array.isArray(localData?.suppliers) ? localData.suppliers : [];
  const incSuppliers = Array.isArray(incoming?.suppliers) ? incoming.suppliers : [];
  const supRes = mergeEntityList(localSuppliers, incSuppliers, (s) => s.id || s.name?.trim() || '');
  stats.entityStats.suppliers = supRes.stats;

  // 3. Merchants
  const localMerchants = Array.isArray(localData?.merchants) ? localData.merchants : [];
  const incMerchants = Array.isArray(incoming?.merchants) ? incoming.merchants : [];
  const merRes = mergeEntityList(localMerchants, incMerchants, (m) => m.id || m.name?.trim() || '');
  stats.entityStats.merchants = merRes.stats;

  // 4. Inbound Transactions
  const localTx = Array.isArray(localData?.transactions) ? localData.transactions : [];
  const incTx = Array.isArray(incoming?.transactions) ? incoming.transactions : [];
  const txRes = mergeEntityList(localTx, incTx, (t) => t.id || t.voucherNo || '');
  txRes.merged.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  stats.entityStats.transactions = txRes.stats;

  // 5. Outbound Sales
  const localSales = Array.isArray(localData?.sales) ? localData.sales : [];
  const incSales = Array.isArray(incoming?.sales) ? incoming.sales : [];
  const salesRes = mergeEntityList(localSales, incSales, (s) => s.id || s.voucherNo || '');
  salesRes.merged.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  stats.entityStats.sales = salesRes.stats;

  // 6. Merchant Purchases
  const localPurchases = Array.isArray(localData?.merchantPurchases) ? localData.merchantPurchases : [];
  const incPurchases = Array.isArray(incoming?.merchantPurchases) ? incoming.merchantPurchases : [];
  const purRes = mergeEntityList(localPurchases, incPurchases, (p) => p.id || p.purchaseNo || '');
  stats.entityStats.merchantPurchases = purRes.stats;

  // 7. Orders
  const localOrders = Array.isArray(localData?.orders) ? localData.orders : [];
  const incOrders = Array.isArray(incoming?.orders) ? incoming.orders : [];
  const ordRes = mergeEntityList(localOrders, incOrders, (o) => o.id || o.orderNo || '');
  stats.entityStats.orders = ordRes.stats;

  // 8. Stock Adjustments
  const localStockAdj = Array.isArray(localData?.stockAdjustments) ? localData.stockAdjustments : [];
  const incStockAdj = Array.isArray(incoming?.stockAdjustments) ? incoming.stockAdjustments : [];
  const adjRes = mergeEntityList(localStockAdj, incStockAdj, (a) => a.id || `${a.productId}_${a.date}`);
  stats.entityStats.stockAdjustments = adjRes.stats;

  // 9. Peer Trades
  const localPeerTrades = Array.isArray(localData?.peerTrades) ? localData.peerTrades : [];
  const incPeerTrades = Array.isArray(incoming?.peerTrades) ? incoming.peerTrades : [];
  const ptRes = mergeEntityList(localPeerTrades, incPeerTrades, (p) => p.id || p.tradeNo || '');
  stats.entityStats.peerTrades = ptRes.stats;

  // 10. Categories Union
  const localProdCats = Array.isArray(localData?.productCategories) ? localData.productCategories : getStoredProductCategories();
  const incProdCats = Array.isArray(incoming?.productCategories) ? incoming.productCategories : [];
  const mergedProdCats = Array.from(new Set([...localProdCats, ...incProdCats]));
  saveStoredProductCategories(mergedProdCats);

  const localRawCats = Array.isArray(localData?.rawMaterialCategories) ? localData.rawMaterialCategories : getStoredRawMaterialCategories();
  const incRawCats = Array.isArray(incoming?.rawMaterialCategories) ? incoming.rawMaterialCategories : [];
  const mergedRawCats = Array.from(new Set([...localRawCats, ...incRawCats]));
  saveStoredRawMaterialCategories(mergedRawCats);

  stats.entityStats.categories = {
    productCount: mergedProdCats.length,
    rawMaterialCount: mergedRawCats.length,
  };

  // 11. Shop Settings Merge (Newer wins)
  let mergedShopSettings = localData?.shopSettings || DEFAULT_SHOP_SETTINGS;
  if (incoming?.shopSettings) {
    const incSettingsTime = getRecordTimestamp(incoming.shopSettings);
    const localSettingsTime = getRecordTimestamp(mergedShopSettings);
    if (incSettingsTime > localSettingsTime) {
      mergedShopSettings = { ...mergedShopSettings, ...incoming.shopSettings };
    }
  }

  // Calculate overall totals
  stats.totalAdded =
    prodRes.stats.added +
    supRes.stats.added +
    merRes.stats.added +
    txRes.stats.added +
    salesRes.stats.added +
    purRes.stats.added +
    ordRes.stats.added +
    adjRes.stats.added +
    ptRes.stats.added;

  stats.totalUpdated =
    prodRes.stats.updated +
    supRes.stats.updated +
    merRes.stats.updated +
    txRes.stats.updated +
    salesRes.stats.updated +
    purRes.stats.updated +
    ordRes.stats.updated +
    adjRes.stats.updated +
    ptRes.stats.updated;

  stats.totalDisjointUnioned = stats.totalAdded;

  const mergedData = {
    products: prodRes.merged,
    suppliers: supRes.merged,
    merchants: merRes.merged,
    transactions: txRes.merged,
    sales: salesRes.merged,
    merchantPurchases: purRes.merged,
    orders: ordRes.merged,
    stockAdjustments: adjRes.merged,
    peerTrades: ptRes.merged,
    productCategories: mergedProdCats,
    rawMaterialCategories: mergedRawCats,
    shopSettings: mergedShopSettings,
    softDeletedItems: Array.isArray(incoming?.softDeletedItems) ? incoming.softDeletedItems : (localData?.softDeletedItems || []),
    rawMaterialPresets: Array.isArray(incoming?.rawMaterialPresets) ? incoming.rawMaterialPresets : (localData?.rawMaterialPresets || []),
    attachments: Array.isArray(incoming?.attachments) ? incoming.attachments : (localData?.attachments || []),
    stockMovements: Array.isArray(incoming?.stockMovements) ? incoming.stockMovements : (localData?.stockMovements || []),
    cashMovements: Array.isArray(incoming?.cashMovements) ? incoming.cashMovements : (localData?.cashMovements || []),
    dailyClosings: Array.isArray(incoming?.dailyClosings) ? incoming.dailyClosings : (localData?.dailyClosings || []),
    returnsAndRefunds: Array.isArray(incoming?.returnsAndRefunds) ? incoming.returnsAndRefunds : (localData?.returnsAndRefunds || []),
    openingPositions: Array.isArray(incoming?.openingPositions) ? incoming.openingPositions : (localData?.openingPositions || []),
  };

  const message = `စာရင်းများ အောင်မြင်စွာ ပေါင်းစည်းပြီးပါပြီ (အသစ်ထပ်တိုး: ${stats.totalAdded} ခု၊ နောက်ဆုံးအခြေအနေပြင်ဆင်: ${stats.totalUpdated} ခု)`;

  // Audit Log for Smart Merge
  try {
    await recordAuditEvent({
      action: 'ဒေတာ ထည့်သွင်းခြင်း (Smart Merge)',
      details: `Smart Merge အောင်မြင်သည် — အသစ်ထပ်တိုး: ${stats.totalAdded} ခု၊ ပြင်ဆင်: ${stats.totalUpdated} ခု (Total Products: ${mergedData.products.length}, Transactions: ${mergedData.transactions.length}, Sales: ${mergedData.sales.length})`,
      entityType: 'SYSTEM',
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }

  return {
    success: true,
    mode: 'MERGE',
    message,
    stats,
    mergedData,
    syncTimestamp: new Date().toISOString(),
  };
}

/**
 * Builds the latest auto-packaged sync payload from Dexie IndexedDB
 */
export async function buildLatestSyncPackage(options?: {
  customNotes?: string;
  shopSettings?: ShopSettings;
}): Promise<SyncPackagePayload> {
  const [
    products,
    suppliers,
    merchants,
    transactions,
    sales,
    merchantPurchases,
    orders,
    stockAdjustments,
    peerTrades,
    softDeletedItems,
    rawMaterialPresets,
    attachments,
    stockMovements,
    cashMovements,
    dailyClosings,
    returnsAndRefunds,
  ] = await Promise.all([
    db.products ? db.products.toArray() : Promise.resolve([]),
    db.suppliers ? db.suppliers.toArray() : Promise.resolve([]),
    db.merchants ? db.merchants.toArray() : Promise.resolve([]),
    db.transactions ? db.transactions.toArray() : Promise.resolve([]),
    db.sales ? db.sales.toArray() : Promise.resolve([]),
    db.merchantPurchases ? db.merchantPurchases.toArray() : Promise.resolve([]),
    db.orders ? db.orders.toArray() : Promise.resolve([]),
    db.stockAdjustments ? db.stockAdjustments.toArray() : Promise.resolve([]),
    db.peerTrades ? db.peerTrades.toArray() : Promise.resolve([]),
    db.softDeletedItems ? db.softDeletedItems.toArray() : Promise.resolve([]),
    db.rawMaterialPresets ? db.rawMaterialPresets.toArray() : Promise.resolve([]),
    db.attachments ? db.attachments.toArray() : Promise.resolve([]),
    db.stockMovements ? db.stockMovements.toArray() : Promise.resolve([]),
    db.cashMovements ? db.cashMovements.toArray() : Promise.resolve([]),
    db.dailyClosings ? db.dailyClosings.toArray() : Promise.resolve([]),
    db.returnsAndRefunds ? db.returnsAndRefunds.toArray() : Promise.resolve([]),
  ]);

  const shopSettingsRecord = await db.settings.get('shopSettings');
  const appLockRecord = await db.settings.get('appLockSettings');
  const productCategoriesRecord = await db.settings.get('productCategories');
  const rawMaterialCategoriesRecord = await db.settings.get('rawMaterialCategories');
  const bizInit = await getBusinessInitialization();
  const openingPosition = bizInit?.openingPosition;

  const activeShopSettings = options?.shopSettings || shopSettingsRecord?.value || getStoredShopSettings();

  const syncPayload: SyncPackagePayload = {
    shweLetYarSync: true,
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    appVersion: CURRENT_APP_VERSION,
    schemaVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    shopName: activeShopSettings.name,
    data: {
      products,
      suppliers,
      merchants,
      transactions,
      sales,
      merchantPurchases,
      orders,
      stockAdjustments,
      peerTrades,
      softDeletedItems,
      rawMaterialPresets,
      attachments,
      stockMovements,
      cashMovements,
      dailyClosings,
      returnsAndRefunds,
      openingPosition,
      productCategories: productCategoriesRecord?.value || getStoredProductCategories(),
      rawMaterialCategories: rawMaterialCategoriesRecord?.value || getStoredRawMaterialCategories(),
      shopSettings: activeShopSettings,
      appLockSettings: appLockRecord?.value || getStoredAppLockSettings(),
    },
  };

  const jsonString = JSON.stringify(syncPayload);
  syncPayload.checksum = await computeChecksum(jsonString);

  return syncPayload;
}

/**
 * Persists the complete merged dataset into Dexie IndexedDB in a single transaction
 */
export async function persistMergedDataToDatabase(mergedData: any): Promise<void> {
  if (!mergedData || typeof mergedData !== 'object') return;

  await db.transaction(
    'rw',
    [
      db.products,
      db.suppliers,
      db.merchants,
      db.transactions,
      db.sales,
      db.merchantPurchases,
      db.orders,
      db.stockAdjustments,
      db.peerTrades,
      db.settings,
    ],
    async () => {
      if (Array.isArray(mergedData.products)) {
        await db.products.clear();
        if (mergedData.products.length > 0) await db.products.bulkAdd(mergedData.products);
      }
      if (Array.isArray(mergedData.suppliers)) {
        await db.suppliers.clear();
        if (mergedData.suppliers.length > 0) await db.suppliers.bulkAdd(mergedData.suppliers);
      }
      if (Array.isArray(mergedData.merchants)) {
        await db.merchants.clear();
        if (mergedData.merchants.length > 0) await db.merchants.bulkAdd(mergedData.merchants);
      }
      if (Array.isArray(mergedData.transactions)) {
        await db.transactions.clear();
        if (mergedData.transactions.length > 0) await db.transactions.bulkAdd(mergedData.transactions);
      }
      if (Array.isArray(mergedData.sales)) {
        await db.sales.clear();
        if (mergedData.sales.length > 0) await db.sales.bulkAdd(mergedData.sales);
      }
      if (Array.isArray(mergedData.merchantPurchases)) {
        await db.merchantPurchases.clear();
        if (mergedData.merchantPurchases.length > 0) await db.merchantPurchases.bulkAdd(mergedData.merchantPurchases);
      }
      if (Array.isArray(mergedData.orders)) {
        await db.orders.clear();
        if (mergedData.orders.length > 0) await db.orders.bulkAdd(mergedData.orders);
      }
      if (Array.isArray(mergedData.stockAdjustments)) {
        await db.stockAdjustments.clear();
        if (mergedData.stockAdjustments.length > 0) await db.stockAdjustments.bulkAdd(mergedData.stockAdjustments);
      }
      if (Array.isArray(mergedData.peerTrades)) {
        await db.peerTrades.clear();
        if (mergedData.peerTrades.length > 0) await db.peerTrades.bulkAdd(mergedData.peerTrades);
      }

      const nowStr = new Date().toISOString();
      if (mergedData.shopSettings) {
        await db.settings.put({ key: 'shopSettings', value: mergedData.shopSettings, updatedAt: nowStr });
        saveStoredShopSettings(mergedData.shopSettings);
      }
      if (mergedData.productCategories) {
        await db.settings.put({ key: 'productCategories', value: mergedData.productCategories, updatedAt: nowStr });
        saveStoredProductCategories(mergedData.productCategories);
      }
      if (mergedData.rawMaterialCategories) {
        await db.settings.put({ key: 'rawMaterialCategories', value: mergedData.rawMaterialCategories, updatedAt: nowStr });
        saveStoredRawMaterialCategories(mergedData.rawMaterialCategories);
      }
    }
  );
}
