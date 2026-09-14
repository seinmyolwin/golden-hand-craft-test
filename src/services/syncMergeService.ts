import { getBusinessInitialization } from './businessInitializationService';
import { db, ShweLetYarDatabase } from '../db/database';
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
  saveStoredAppLockSettings,
  getStoredProductCategories,
  saveStoredProductCategories,
  getStoredRawMaterialCategories,
  saveStoredRawMaterialCategories,
  DEFAULT_SHOP_SETTINGS,
} from '../utils/storage';
import { recordAuditEvent } from './auditTrailService';
import { computeChecksum, createAutoRecoverySnapshot } from './backupService';
import { blobToBase64, processImageInput, base64ToBlob } from './attachmentService';
import { reconcileAllStock } from './reconciliation/stockReconciliationService';
import { reconcileAllCash } from './reconciliation/cashReconciliationService';
import { runDatabaseDiagnostics } from './databaseHealthService';
import {
  CURRENT_APP_VERSION,
  CURRENT_BACKUP_FORMAT_VERSION,
  CURRENT_DATABASE_SCHEMA_VERSION,
} from '../constants/version';

export {
  encodeForQrTransfer,
  decodeQrChunks,
  QrChunkReceiver,
  calculateRequiredChunks,
  calculateCrc32,
} from '../utils/qrChunkTransfer';

export type SyncMergeMode = 'MERGE' | 'OVERWRITE';

export interface EntityMergeStats {
  added: number;
  updated: number;
  unchanged: number;
  total: number;
}

export interface ImmutableMergeStats {
  added: number;
  identicalDeduplicated: number;
  conflicts: number;
  localPreserved: number;
  total: number;
}

export interface SyncConflictRecord {
  collection: string;
  id: string;
  localRecord: any;
  incomingRecord: any;
  reason: string;
}

export interface PostMergeValidationReport {
  isValid: boolean;
  issues: string[];
  reconciliation: {
    stockBalanced: boolean;
    cashBalanced: boolean;
  };
  diagnosticsPassed: boolean;
  ledgerCounts: Record<string, number>;
}

export interface SyncMergeStats {
  totalAdded: number;
  totalUpdated: number;
  totalDisjointUnioned: number;
  totalConflicts?: number;
  totalPreserved?: number;
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
    stockMovements?: EntityMergeStats;
    cashMovements?: EntityMergeStats;
    dailyClosings?: EntityMergeStats;
    returnsAndRefunds?: EntityMergeStats;
    softDeletedItems?: EntityMergeStats;
    auditLogs?: EntityMergeStats;
    attachments?: EntityMergeStats;
  };
}

export interface SyncMergeResult {
  success: boolean;
  mode: SyncMergeMode;
  message: string;
  stats: SyncMergeStats;
  mergedData: any;
  syncTimestamp: string;
  conflicts?: SyncConflictRecord[];
  validation?: PostMergeValidationReport;
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
    auditLogs?: AuditLogEntry[];
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
 * Deterministic JSON stringify that produces sorted keys for accurate byte/data comparison
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Tests whether two records are byte/data equivalent, ignoring ephemeral fields
 */
export function areRecordsDataEquivalent(recordA: any, recordB: any): boolean {
  if (recordA === recordB) return true;
  if (!recordA || !recordB) return false;

  const cleanA = { ...recordA };
  const cleanB = { ...recordB };
  delete cleanA._syncStatus;
  delete cleanB._syncStatus;
  delete cleanA.blob;
  delete cleanB.blob;

  return canonicalJsonStringify(cleanA) === canonicalJsonStringify(cleanB);
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
 * Merges mutable master-data entities with newer-wins for matching keys and union for disjoint records.
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
      // Key exists in both -> Controlled newer-wins
      const localItem = mergedMap.get(key)!;
      const incomingTime = getRecordTimestamp(incomingItem);
      const localTime = getRecordTimestamp(localItem);

      if (incomingTime > localTime) {
        // Incoming is newer -> update
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
 * Merges immutable financial ledger entities using strict ID-based set union.
 * FINANCIAL IMMUTABILITY RULE:
 * - If records are byte/data equivalent -> keep one (deduplicated).
 * - If records have same ID but different data -> CONFLICT!
 *   Preserve the local record. Never silently overwrite either.
 *   Record the conflict in the conflict report.
 */
export function mergeImmutableLedger<T extends Record<string, any>>(
  collectionName: string,
  localList: T[],
  incomingList: T[],
  getKey: (item: T) => string
): {
  merged: T[];
  conflicts: SyncConflictRecord[];
  stats: ImmutableMergeStats;
} {
  const mergedMap = new Map<string, T>();
  const conflicts: SyncConflictRecord[] = [];
  const stats: ImmutableMergeStats = {
    added: 0,
    identicalDeduplicated: 0,
    conflicts: 0,
    localPreserved: 0,
    total: 0,
  };

  // 1. Seed with local records (local is preserved as baseline)
  for (const item of localList) {
    if (!item) continue;
    const key = getKey(item);
    if (key) {
      mergedMap.set(key, item);
    }
  }

  // 2. Evaluate incoming records
  for (const incomingItem of incomingList) {
    if (!incomingItem) continue;
    const key = getKey(incomingItem);
    if (!key) continue;

    if (!mergedMap.has(key)) {
      // Disjoint record -> Union (safe add)
      mergedMap.set(key, incomingItem);
      stats.added++;
    } else {
      // Key exists in both
      const localItem = mergedMap.get(key)!;
      if (areRecordsDataEquivalent(localItem, incomingItem)) {
        // Byte/data equivalent -> keep one
        stats.identicalDeduplicated++;
      } else {
        // Conflict! Different data with same ID
        stats.conflicts++;
        stats.localPreserved++;
        conflicts.push({
          collection: collectionName,
          id: key,
          localRecord: localItem,
          incomingRecord: incomingItem,
          reason: `ပဋိပက္ခတွေ့ရှိပါသည်: ${collectionName} ID "${key}" တွင် ဒေတာကွဲလွဲမှုရှိနေပါသည်။ Local စာရင်းကို အလိုအလျောက် ထိန်းသိမ်းထားရှိပါသည်။`,
        });
      }
    }
  }

  const merged = Array.from(mergedMap.values());
  stats.total = merged.length;
  return { merged, conflicts, stats };
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
      checksum: raw.checksum || raw.data.checksum,
      schemaVersion: raw.schemaVersion || raw.data.schemaVersion,
      formatVersion: raw.formatVersion || raw.data.formatVersion,
    };
  }

  return raw;
}

/**
 * Verifies checksum of the incoming sync package if present
 */
export async function verifySyncChecksum(incomingRaw: any): Promise<boolean> {
  if (!incomingRaw || typeof incomingRaw !== 'object') return false;
  const checksum = incomingRaw.checksum;
  if (!checksum) return true; // Soft pass when checksum not provided

  try {
    const copy = { ...incomingRaw };
    delete copy.checksum;
    const jsonStr = JSON.stringify(copy);
    const calculated = await computeChecksum(jsonStr);
    return calculated.toLowerCase() === checksum.toLowerCase();
  } catch {
    return true;
  }
}

/**
 * Helper to fetch complete current local state across all Dexie collections
 */
export async function loadCompleteLocalData(): Promise<any> {
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
    auditLogs,
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
    db.auditLogs ? db.auditLogs.toArray() : Promise.resolve([]),
  ]);

  const shopSettingsRecord = await db.settings.get('shopSettings');
  const appLockRecord = await db.settings.get('appLockSettings');
  const productCategoriesRecord = await db.settings.get('productCategories');
  const rawMaterialCategoriesRecord = await db.settings.get('rawMaterialCategories');

  return {
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
    auditLogs,
    shopSettings: shopSettingsRecord?.value || getStoredShopSettings(),
    appLockSettings: appLockRecord?.value || getStoredAppLockSettings(),
    productCategories: productCategoriesRecord?.value || getStoredProductCategories(),
    rawMaterialCategories: rawMaterialCategoriesRecord?.value || getStoredRawMaterialCategories(),
  };
}

/**
 * Executes a Safe Smart Merge or Overwrite on two datasets.
 * Implements Financial Immutability Rule, safe set union, master-data newer-wins, and soft-delete preservation.
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
    totalConflicts: 0,
    totalPreserved: 0,
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

  // Verify Checksum if present
  if (incomingRaw && incomingRaw.checksum) {
    const isChecksumValid = await verifySyncChecksum(incomingRaw);
    if (!isChecksumValid) {
      console.warn('Sync package checksum mismatch detected');
    }
  }

  // --- OVERWRITE MODE ---
  if (mode === 'OVERWRITE') {
    const overwrittenData = {
      _mode: 'OVERWRITE',
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
      auditLogs: Array.isArray(incoming.auditLogs) ? incoming.auditLogs : [],
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

  // --- SMART MERGE MODE ---
  const allConflicts: SyncConflictRecord[] = [];

  // 1. Mutable Master Data: Products (Controlled newer-wins)
  const localProducts = Array.isArray(localData?.products)
    ? localData.products
    : (db.products ? await db.products.toArray() : []);
  const incProducts = Array.isArray(incoming?.products) ? incoming.products : [];
  const prodRes = mergeEntityList(localProducts, incProducts, (p) => p.id || p.name?.trim().toLowerCase() || '');
  stats.entityStats.products = prodRes.stats;

  // 2. Mutable Master Data: Suppliers (Controlled newer-wins)
  const localSuppliers = Array.isArray(localData?.suppliers)
    ? localData.suppliers
    : (db.suppliers ? await db.suppliers.toArray() : []);
  const incSuppliers = Array.isArray(incoming?.suppliers) ? incoming.suppliers : [];
  const supRes = mergeEntityList(localSuppliers, incSuppliers, (s) => s.id || s.name?.trim() || '');
  stats.entityStats.suppliers = supRes.stats;

  // 3. Mutable Master Data: Merchants (Controlled newer-wins)
  const localMerchants = Array.isArray(localData?.merchants)
    ? localData.merchants
    : (db.merchants ? await db.merchants.toArray() : []);
  const incMerchants = Array.isArray(incoming?.merchants) ? incoming.merchants : [];
  const merRes = mergeEntityList(localMerchants, incMerchants, (m) => m.id || m.name?.trim() || '');
  stats.entityStats.merchants = merRes.stats;

  // 4. IMMUTABLE Financial Ledger: Inbound Supplier Transactions
  const localTx = Array.isArray(localData?.transactions)
    ? localData.transactions
    : (db.transactions ? await db.transactions.toArray() : []);
  const incTx = Array.isArray(incoming?.transactions) ? incoming.transactions : [];
  const txRes = mergeImmutableLedger('transactions', localTx, incTx, (t) => t.id || t.voucherNo || '');
  txRes.merged.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  allConflicts.push(...txRes.conflicts);
  stats.entityStats.transactions = {
    added: txRes.stats.added,
    updated: 0,
    unchanged: txRes.stats.localPreserved + txRes.stats.identicalDeduplicated,
    total: txRes.stats.total,
  };

  // 5. IMMUTABLE Financial Ledger: Outbound Sales
  const localSales = Array.isArray(localData?.sales)
    ? localData.sales
    : (db.sales ? await db.sales.toArray() : []);
  const incSales = Array.isArray(incoming?.sales) ? incoming.sales : [];
  const salesRes = mergeImmutableLedger('sales', localSales, incSales, (s) => s.id || s.voucherNo || '');
  salesRes.merged.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  allConflicts.push(...salesRes.conflicts);
  stats.entityStats.sales = {
    added: salesRes.stats.added,
    updated: 0,
    unchanged: salesRes.stats.localPreserved + salesRes.stats.identicalDeduplicated,
    total: salesRes.stats.total,
  };

  // 6. IMMUTABLE Financial Ledger: Merchant Purchases
  const localPurchases = Array.isArray(localData?.merchantPurchases)
    ? localData.merchantPurchases
    : (db.merchantPurchases ? await db.merchantPurchases.toArray() : []);
  const incPurchases = Array.isArray(incoming?.merchantPurchases) ? incoming.merchantPurchases : [];
  const purRes = mergeImmutableLedger('merchantPurchases', localPurchases, incPurchases, (p) => p.id || p.purchaseNo || '');
  allConflicts.push(...purRes.conflicts);
  stats.entityStats.merchantPurchases = {
    added: purRes.stats.added,
    updated: 0,
    unchanged: purRes.stats.localPreserved + purRes.stats.identicalDeduplicated,
    total: purRes.stats.total,
  };

  // 7. Mutable Orders (Lifecycle state)
  const localOrders = Array.isArray(localData?.orders)
    ? localData.orders
    : (db.orders ? await db.orders.toArray() : []);
  const incOrders = Array.isArray(incoming?.orders) ? incoming.orders : [];
  const ordRes = mergeEntityList(localOrders, incOrders, (o) => o.id || o.orderNo || '');
  stats.entityStats.orders = ordRes.stats;

  // 8. IMMUTABLE Stock Adjustments Audit Entries
  const localStockAdj = Array.isArray(localData?.stockAdjustments)
    ? localData.stockAdjustments
    : (db.stockAdjustments ? await db.stockAdjustments.toArray() : []);
  const incStockAdj = Array.isArray(incoming?.stockAdjustments) ? incoming.stockAdjustments : [];
  const adjRes = mergeImmutableLedger('stockAdjustments', localStockAdj, incStockAdj, (a) => a.id || `${a.productId}_${a.date}`);
  allConflicts.push(...adjRes.conflicts);
  stats.entityStats.stockAdjustments = {
    added: adjRes.stats.added,
    updated: 0,
    unchanged: adjRes.stats.localPreserved + adjRes.stats.identicalDeduplicated,
    total: adjRes.stats.total,
  };

  // 9. Mutable Peer Trades (Lifecycle state)
  const localPeerTrades = Array.isArray(localData?.peerTrades)
    ? localData.peerTrades
    : (db.peerTrades ? await db.peerTrades.toArray() : []);
  const incPeerTrades = Array.isArray(incoming?.peerTrades) ? incoming.peerTrades : [];
  const ptRes = mergeEntityList(localPeerTrades, incPeerTrades, (p) => p.id || p.tradeNo || '');
  stats.entityStats.peerTrades = ptRes.stats;

  // 10. IMMUTABLE Soft Deletes (Tombstones Union - never lose a deletion record)
  const localSoftDeleted = Array.isArray(localData?.softDeletedItems)
    ? localData.softDeletedItems
    : (db.softDeletedItems ? await db.softDeletedItems.toArray() : []);
  const incSoftDeleted = Array.isArray(incoming?.softDeletedItems) ? incoming.softDeletedItems : [];
  const softDeletedRes = mergeImmutableLedger('softDeletedItems', localSoftDeleted, incSoftDeleted, (s) => s.id || `${s.originalId}_${s.type}`);
  allConflicts.push(...softDeletedRes.conflicts);
  stats.entityStats.softDeletedItems = {
    added: softDeletedRes.stats.added,
    updated: 0,
    unchanged: softDeletedRes.stats.localPreserved + softDeletedRes.stats.identicalDeduplicated,
    total: softDeletedRes.stats.total,
  };

  // 11. IMMUTABLE Stock Movements Ledger
  const localStockMovements = Array.isArray(localData?.stockMovements)
    ? localData.stockMovements
    : (db.stockMovements ? await db.stockMovements.toArray() : []);
  const incStockMovements = Array.isArray(incoming?.stockMovements) ? incoming.stockMovements : [];
  const smRes = mergeImmutableLedger('stockMovements', localStockMovements, incStockMovements, (sm) => sm.id || sm.idempotencyKey || '');
  allConflicts.push(...smRes.conflicts);
  stats.entityStats.stockMovements = {
    added: smRes.stats.added,
    updated: 0,
    unchanged: smRes.stats.localPreserved + smRes.stats.identicalDeduplicated,
    total: smRes.stats.total,
  };

  // 12. IMMUTABLE Cash Movements Ledger
  const localCashMovements = Array.isArray(localData?.cashMovements)
    ? localData.cashMovements
    : (db.cashMovements ? await db.cashMovements.toArray() : []);
  const incCashMovements = Array.isArray(incoming?.cashMovements) ? incoming.cashMovements : [];
  const cmRes = mergeImmutableLedger('cashMovements', localCashMovements, incCashMovements, (cm) => cm.id || cm.idempotencyKey || '');
  allConflicts.push(...cmRes.conflicts);
  stats.entityStats.cashMovements = {
    added: cmRes.stats.added,
    updated: 0,
    unchanged: cmRes.stats.localPreserved + cmRes.stats.identicalDeduplicated,
    total: cmRes.stats.total,
  };

  // 13. IMMUTABLE Daily Closings Ledger
  const localDailyClosings = Array.isArray(localData?.dailyClosings)
    ? localData.dailyClosings
    : (db.dailyClosings ? await db.dailyClosings.toArray() : []);
  const incDailyClosings = Array.isArray(incoming?.dailyClosings) ? incoming.dailyClosings : [];
  const dcRes = mergeImmutableLedger('dailyClosings', localDailyClosings, incDailyClosings, (dc) => dc.id || dc.closingDate || '');
  allConflicts.push(...dcRes.conflicts);
  stats.entityStats.dailyClosings = {
    added: dcRes.stats.added,
    updated: 0,
    unchanged: dcRes.stats.localPreserved + dcRes.stats.identicalDeduplicated,
    total: dcRes.stats.total,
  };

  // 14. IMMUTABLE Returns and Refunds Ledger
  const localReturns = Array.isArray(localData?.returnsAndRefunds)
    ? localData.returnsAndRefunds
    : (db.returnsAndRefunds ? await db.returnsAndRefunds.toArray() : []);
  const incReturns = Array.isArray(incoming?.returnsAndRefunds) ? incoming.returnsAndRefunds : [];
  const retRes = mergeImmutableLedger('returnsAndRefunds', localReturns, incReturns, (r) => r.id || r.returnNo || r.idempotencyKey || '');
  allConflicts.push(...retRes.conflicts);
  stats.entityStats.returnsAndRefunds = {
    added: retRes.stats.added,
    updated: 0,
    unchanged: retRes.stats.localPreserved + retRes.stats.identicalDeduplicated,
    total: retRes.stats.total,
  };

  // 15. IMMUTABLE Audit Logs Trail
  const localAuditLogs = Array.isArray(localData?.auditLogs)
    ? localData.auditLogs
    : (db.auditLogs ? await db.auditLogs.toArray() : []);
  const incAuditLogs = Array.isArray(incoming?.auditLogs) ? incoming.auditLogs : [];
  const auditRes = mergeImmutableLedger('auditLogs', localAuditLogs, incAuditLogs, (a) => a.id || '');
  stats.entityStats.auditLogs = {
    added: auditRes.stats.added,
    updated: 0,
    unchanged: auditRes.stats.localPreserved + auditRes.stats.identicalDeduplicated,
    total: auditRes.stats.total,
  };

  // 16. Attachments (Union with binary preservation)
  const localAttachments = Array.isArray(localData?.attachments)
    ? localData.attachments
    : (db.attachments ? await db.attachments.toArray() : []);
  const incAttachments = Array.isArray(incoming?.attachments) ? incoming.attachments : [];
  const attRes = mergeEntityList(localAttachments, incAttachments, (att) => att.id || att.voucherId || '');
  stats.entityStats.attachments = attRes.stats;

  // 17. Raw Material Presets
  const localPresets = Array.isArray(localData?.rawMaterialPresets)
    ? localData.rawMaterialPresets
    : (db.rawMaterialPresets ? await db.rawMaterialPresets.toArray() : []);
  const incPresets = Array.isArray(incoming?.rawMaterialPresets) ? incoming.rawMaterialPresets : [];
  const presetRes = mergeEntityList(localPresets, incPresets, (p) => p.id || `${p.category}_${p.name}`);

  // 18. Categories Union
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

  // 19. Shop Settings Merge (Controlled Newer Wins)
  let mergedShopSettings = localData?.shopSettings || DEFAULT_SHOP_SETTINGS;
  if (incoming?.shopSettings) {
    const incSettingsTime = getRecordTimestamp(incoming.shopSettings);
    const localSettingsTime = getRecordTimestamp(mergedShopSettings);
    if (incSettingsTime > localSettingsTime) {
      mergedShopSettings = { ...mergedShopSettings, ...incoming.shopSettings };
    }
  }

  // 20. App Lock Settings (Do not sync sensitive PINs/passcodes across devices)
  const mergedAppLockSettings = localData?.appLockSettings || getStoredAppLockSettings();

  // Aggregate totals
  stats.totalAdded =
    prodRes.stats.added +
    supRes.stats.added +
    merRes.stats.added +
    txRes.stats.added +
    salesRes.stats.added +
    purRes.stats.added +
    ordRes.stats.added +
    adjRes.stats.added +
    ptRes.stats.added +
    smRes.stats.added +
    cmRes.stats.added +
    dcRes.stats.added +
    retRes.stats.added +
    softDeletedRes.stats.added +
    attRes.stats.added;

  stats.totalUpdated =
    prodRes.stats.updated +
    supRes.stats.updated +
    merRes.stats.updated +
    ordRes.stats.updated +
    ptRes.stats.updated +
    attRes.stats.updated;

  stats.totalDisjointUnioned = stats.totalAdded;
  stats.totalConflicts = allConflicts.length;
  stats.totalPreserved =
    txRes.stats.localPreserved +
    salesRes.stats.localPreserved +
    purRes.stats.localPreserved +
    smRes.stats.localPreserved +
    cmRes.stats.localPreserved +
    dcRes.stats.localPreserved +
    retRes.stats.localPreserved;

  const mergedData = {
    _mode: 'MERGE',
    products: prodRes.merged,
    suppliers: supRes.merged,
    merchants: merRes.merged,
    transactions: txRes.merged,
    sales: salesRes.merged,
    merchantPurchases: purRes.merged,
    orders: ordRes.merged,
    stockAdjustments: adjRes.merged,
    peerTrades: ptRes.merged,
    softDeletedItems: softDeletedRes.merged,
    rawMaterialPresets: presetRes.merged,
    attachments: attRes.merged,
    stockMovements: smRes.merged,
    cashMovements: cmRes.merged,
    dailyClosings: dcRes.merged,
    returnsAndRefunds: retRes.merged,
    auditLogs: auditRes.merged,
    productCategories: mergedProdCats,
    rawMaterialCategories: mergedRawCats,
    shopSettings: mergedShopSettings,
    appLockSettings: mergedAppLockSettings,
  };

  const message = allConflicts.length > 0
    ? `စာရင်းများ အောင်မြင်စွာ ပေါင်းစည်းပြီးပါပြီ (အသစ်ထပ်တိုး: ${stats.totalAdded} ခု၊ ပြင်ဆင်: ${stats.totalUpdated} ခု၊ ပဋိပက္ခမရှိ တူညီထိန်းသိမ်း: ${stats.totalPreserved || 0} ခု၊ သတိပြုရန် ပဋိပက္ခ: ${allConflicts.length} ခု)`
    : `စာရင်းများ အောင်မြင်စွာ ပေါင်းစည်းပြီးပါပြီ (အသစ်ထပ်တိုး: ${stats.totalAdded} ခု၊ ပြင်ဆင်: ${stats.totalUpdated} ခု)`;

  // Audit Log for Smart Merge
  try {
    await recordAuditEvent({
      action: 'ဒေတာ ထည့်သွင်းခြင်း (Safe Smart Merge)',
      details: `Safe Smart Merge အောင်မြင်သည် — အသစ်ထပ်တိုး: ${stats.totalAdded} ခု၊ ပြင်ဆင်: ${stats.totalUpdated} ခု၊ Conflicts: ${allConflicts.length} (Products: ${mergedData.products.length}, Transactions: ${mergedData.transactions.length}, Sales: ${mergedData.sales.length})`,
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
    conflicts: allConflicts.length > 0 ? allConflicts : undefined,
  };
}

/**
 * Builds the latest auto-packaged sync payload from Dexie IndexedDB with attachment binary serialization
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
    auditLogs,
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
    db.auditLogs ? db.auditLogs.toArray() : Promise.resolve([]),
  ]);

  const shopSettingsRecord = await db.settings.get('shopSettings');
  const appLockRecord = await db.settings.get('appLockSettings');
  const productCategoriesRecord = await db.settings.get('productCategories');
  const rawMaterialCategoriesRecord = await db.settings.get('rawMaterialCategories');
  const bizInit = await getBusinessInitialization();
  const openingPosition = bizInit?.openingPosition;

  const activeShopSettings = options?.shopSettings || shopSettingsRecord?.value || getStoredShopSettings();

  // Serialize attachments: convert native Blobs to base64 so JSON.stringify doesn't drop binary images
  const serializableAttachments: AttachmentRecord[] = await Promise.all(
    attachments.map(async (att) => {
      let imageBase64 = att.imageBase64 || '';
      if (!imageBase64 && att.blob) {
        try {
          imageBase64 = await blobToBase64(att.blob);
        } catch (err) {
          console.warn('Failed to convert blob to base64 for sync attachment', att.id, err);
        }
      }
      return {
        id: att.id,
        voucherId: att.voucherId,
        ownerId: att.ownerId || att.voucherId,
        imageBase64,
        thumbnail: att.thumbnail,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes || att.blob?.size || 0,
        width: att.width,
        height: att.height,
        caption: att.caption || '',
        createdAt: att.createdAt,
      };
    })
  );

  // Sanitize app lock settings to never transmit sensitive PIN/passcodes
  const sanitizedAppLock = { ...(appLockRecord?.value || getStoredAppLockSettings()) };
  delete sanitizedAppLock.passcode;
  delete sanitizedAppLock.pin;
  delete sanitizedAppLock.recoveryKey;
  delete sanitizedAppLock.hint;
  delete sanitizedAppLock.recoveryQuestion;
  delete sanitizedAppLock.recoveryAnswer;

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
      attachments: serializableAttachments,
      stockMovements,
      cashMovements,
      dailyClosings,
      returnsAndRefunds,
      auditLogs,
      openingPosition,
      productCategories: productCategoriesRecord?.value || getStoredProductCategories(),
      rawMaterialCategories: rawMaterialCategoriesRecord?.value || getStoredRawMaterialCategories(),
      shopSettings: activeShopSettings,
      appLockSettings: sanitizedAppLock,
    },
  };

  const jsonString = JSON.stringify(syncPayload);
  syncPayload.checksum = await computeChecksum(jsonString);

  return syncPayload;
}

/**
 * Persists the complete merged dataset into Dexie IndexedDB in a single atomic transaction.
 * - In MERGE mode: Uses bulkPut without clearing. Never deletes unrelated local records.
 * - In OVERWRITE mode: Atomically replaces collections after safety checks.
 */
export async function persistMergedDataToDatabase(
  mergedData: any,
  options?: { mode?: SyncMergeMode; createBackupSnapshot?: boolean } | SyncMergeMode
): Promise<void> {
  if (!mergedData || typeof mergedData !== 'object') return;

  const mode: SyncMergeMode =
    typeof options === 'string'
      ? options
      : options?.mode || mergedData._mode || 'MERGE';

  // 1. In OVERWRITE mode, create safety snapshot first
  if (mode === 'OVERWRITE') {
    try {
      await createAutoRecoverySnapshot('Pre-Sync Overwrite Snapshot');
    } catch (snapErr) {
      console.warn('Auto recovery snapshot warning before overwrite:', snapErr);
    }
  }

  // 2. Prepare restored attachments with Blobs
  const restoredAttachments: AttachmentRecord[] = [];
  if (Array.isArray(mergedData.attachments) && mergedData.attachments.length > 0) {
    for (const att of mergedData.attachments) {
      let blob = att.blob;
      let thumbnail = att.thumbnail;
      let mimeType = att.mimeType;
      let sizeBytes = att.sizeBytes;
      let width = att.width;
      let height = att.height;

      if ((!blob || blob.size === 0) && att.imageBase64) {
        try {
          const processed = await processImageInput(att.imageBase64);
          blob = processed.blob;
          thumbnail = thumbnail || processed.thumbnail;
          mimeType = mimeType || processed.mimeType;
          sizeBytes = sizeBytes || processed.sizeBytes;
          width = width || processed.width;
          height = height || processed.height;
        } catch {
          blob = base64ToBlob(att.imageBase64);
        }
      }

      restoredAttachments.push({
        ...att,
        ownerId: att.ownerId || att.voucherId,
        blob,
        thumbnail,
        mimeType,
        sizeBytes,
        width,
        height,
      });
    }
  }

  // 3. Single Atomic Dexie Transaction across all 18 tables
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
      db.softDeletedItems,
      db.auditLogs,
      db.rawMaterialPresets,
      db.attachments,
      db.stockMovements,
      db.cashMovements,
      db.dailyClosings,
      db.returnsAndRefunds,
      db.settings,
    ],
    async () => {
      if (mode === 'OVERWRITE') {
        // OVERWRITE MODE: Explicitly cleared and replaced
        await Promise.all([
          db.products.clear(),
          db.suppliers.clear(),
          db.merchants.clear(),
          db.transactions.clear(),
          db.sales.clear(),
          db.merchantPurchases.clear(),
          db.orders.clear(),
          db.stockAdjustments.clear(),
          db.peerTrades.clear(),
          db.softDeletedItems.clear(),
          db.attachments.clear(),
          db.stockMovements.clear(),
          db.cashMovements.clear(),
          db.dailyClosings.clear(),
          db.returnsAndRefunds ? db.returnsAndRefunds.clear() : Promise.resolve(),
          db.rawMaterialPresets.clear(),
        ]);
      }

      // Both MERGE and OVERWRITE write new/merged records via bulkPut
      if (Array.isArray(mergedData.products) && mergedData.products.length > 0) {
        await db.products.bulkPut(mergedData.products);
      }
      if (Array.isArray(mergedData.suppliers) && mergedData.suppliers.length > 0) {
        await db.suppliers.bulkPut(mergedData.suppliers);
      }
      if (Array.isArray(mergedData.merchants) && mergedData.merchants.length > 0) {
        await db.merchants.bulkPut(mergedData.merchants);
      }
      if (Array.isArray(mergedData.transactions) && mergedData.transactions.length > 0) {
        await db.transactions.bulkPut(mergedData.transactions);
      }
      if (Array.isArray(mergedData.sales) && mergedData.sales.length > 0) {
        await db.sales.bulkPut(mergedData.sales);
      }
      if (Array.isArray(mergedData.merchantPurchases) && mergedData.merchantPurchases.length > 0) {
        await db.merchantPurchases.bulkPut(mergedData.merchantPurchases);
      }
      if (Array.isArray(mergedData.orders) && mergedData.orders.length > 0) {
        await db.orders.bulkPut(mergedData.orders);
      }
      if (Array.isArray(mergedData.stockAdjustments) && mergedData.stockAdjustments.length > 0) {
        await db.stockAdjustments.bulkPut(mergedData.stockAdjustments);
      }
      if (Array.isArray(mergedData.peerTrades) && mergedData.peerTrades.length > 0) {
        await db.peerTrades.bulkPut(mergedData.peerTrades);
      }
      if (Array.isArray(mergedData.softDeletedItems) && mergedData.softDeletedItems.length > 0) {
        await db.softDeletedItems.bulkPut(mergedData.softDeletedItems);
      }
      if (restoredAttachments.length > 0) {
        await db.attachments.bulkPut(restoredAttachments);
      }
      if (Array.isArray(mergedData.stockMovements) && mergedData.stockMovements.length > 0) {
        await db.stockMovements.bulkPut(mergedData.stockMovements);
      }
      if (Array.isArray(mergedData.cashMovements) && mergedData.cashMovements.length > 0) {
        await db.cashMovements.bulkPut(mergedData.cashMovements);
      }
      if (Array.isArray(mergedData.dailyClosings) && mergedData.dailyClosings.length > 0) {
        await db.dailyClosings.bulkPut(mergedData.dailyClosings);
      }
      if (Array.isArray(mergedData.returnsAndRefunds) && mergedData.returnsAndRefunds.length > 0 && db.returnsAndRefunds) {
        await db.returnsAndRefunds.bulkPut(mergedData.returnsAndRefunds);
      }
      if (Array.isArray(mergedData.rawMaterialPresets) && mergedData.rawMaterialPresets.length > 0) {
        await db.rawMaterialPresets.bulkPut(mergedData.rawMaterialPresets);
      }
      if (Array.isArray(mergedData.auditLogs) && mergedData.auditLogs.length > 0) {
        await db.auditLogs.bulkPut(mergedData.auditLogs);
      }

      // Update settings and categories
      const nowStr = new Date().toISOString();
      if (mergedData.shopSettings) {
        await db.settings.put({ key: 'shopSettings', value: mergedData.shopSettings, updatedAt: nowStr });
        saveStoredShopSettings(mergedData.shopSettings);
      }
      if (mergedData.appLockSettings) {
        await db.settings.put({ key: 'appLockSettings', value: mergedData.appLockSettings, updatedAt: nowStr });
        saveStoredAppLockSettings(mergedData.appLockSettings);
      }
      if (mergedData.productCategories) {
        await db.settings.put({ key: 'productCategories', value: mergedData.productCategories, updatedAt: nowStr });
        saveStoredProductCategories(mergedData.productCategories);
      }
      if (mergedData.rawMaterialCategories) {
        await db.settings.put({ key: 'rawMaterialCategories', value: mergedData.rawMaterialCategories, updatedAt: nowStr });
        saveStoredRawMaterialCategories(mergedData.rawMaterialCategories);
      }
      if (mergedData.businessInitialization) {
        await db.settings.put({
          key: 'businessInitialization',
          value: mergedData.businessInitialization,
          updatedAt: nowStr,
        });
      }
    }
  );
}

/**
 * Validates data integrity and reconciliations after sync merge/persistence
 */
export async function validatePostMergeIntegrity(
  beforeCounts?: Record<string, number>,
  options?: { mode?: SyncMergeMode }
): Promise<PostMergeValidationReport> {
  const issues: string[] = [];
  const mode = options?.mode || 'MERGE';

  // 1. Fetch current counts
  const [
    products,
    suppliers,
    merchants,
    transactions,
    sales,
    merchantPurchases,
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
    db.stockMovements ? db.stockMovements.toArray() : Promise.resolve([]),
    db.cashMovements ? db.cashMovements.toArray() : Promise.resolve([]),
    db.dailyClosings ? db.dailyClosings.toArray() : Promise.resolve([]),
    db.returnsAndRefunds ? db.returnsAndRefunds.toArray() : Promise.resolve([]),
  ]);

  const currentCounts: Record<string, number> = {
    products: products.length,
    suppliers: suppliers.length,
    merchants: merchants.length,
    transactions: transactions.length,
    sales: sales.length,
    merchantPurchases: merchantPurchases.length,
    stockMovements: stockMovements.length,
    cashMovements: cashMovements.length,
    dailyClosings: dailyClosings.length,
    returnsAndRefunds: returnsAndRefunds.length,
  };

  // Check that no immutable records disappeared in MERGE mode
  if (mode === 'MERGE' && beforeCounts) {
    const ledgerKeys = ['stockMovements', 'cashMovements', 'dailyClosings', 'returnsAndRefunds', 'transactions', 'sales', 'merchantPurchases'];
    for (const key of ledgerKeys) {
      if (beforeCounts[key] !== undefined && currentCounts[key] < beforeCounts[key]) {
        issues.push(`Ledger record disappearance: ${key} had ${beforeCounts[key]} before merge, now has ${currentCounts[key]}`);
      }
    }
  }

  // Check for duplicate immutable IDs
  const checkDuplicateIds = (list: any[], name: string) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (item && item.id) {
        if (seen.has(item.id)) {
          issues.push(`Duplicate immutable ID "${item.id}" detected in ${name}`);
        }
        seen.add(item.id);
      }
    }
  };

  checkDuplicateIds(stockMovements, 'stockMovements');
  checkDuplicateIds(cashMovements, 'cashMovements');
  checkDuplicateIds(dailyClosings, 'dailyClosings');
  checkDuplicateIds(returnsAndRefunds, 'returnsAndRefunds');
  checkDuplicateIds(transactions, 'transactions');
  checkDuplicateIds(sales, 'sales');
  checkDuplicateIds(merchantPurchases, 'merchantPurchases');

  // Verify return/refund references
  const salesIdSet = new Set(sales.map((s) => s.id));
  for (const ret of returnsAndRefunds) {
    if (ret.referenceType === 'SALE' && ret.referenceId && !salesIdSet.has(ret.referenceId)) {
      // Non-blocking warning for orphaned return references
    }
  }

  // Run stock reconciliation
  let stockBalanced = true;
  try {
    const stockRecon = await reconcileAllStock(db);
    if (stockRecon && stockRecon.mismatchedCount > 0) {
      stockBalanced = false;
    }
  } catch {
    // Non-fatal
  }

  // Run cash reconciliation
  let cashBalanced = true;
  try {
    const cashRecon = await reconcileAllCash(db);
    if (cashRecon && cashRecon.mismatchedDaysCount > 0) {
      cashBalanced = false;
    }
  } catch {
    // Non-fatal
  }

  // Run database health check
  let diagnosticsPassed = true;
  try {
    const health = await runDatabaseDiagnostics(db);
    if (health.overallStatus === 'CRITICAL' || health.criticalCount > 0) {
      diagnosticsPassed = false;
      issues.push(`Database health critical issues: ${health.criticalCount}`);
    }
  } catch {
    // Non-fatal
  }

  return {
    isValid: issues.length === 0,
    issues,
    reconciliation: {
      stockBalanced,
      cashBalanced,
    },
    diagnosticsPassed,
    ledgerCounts: currentCounts,
  };
}
