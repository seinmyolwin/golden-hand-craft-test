/**
 * Shwe Let Yar - Professional Database Health & Diagnostics Service
 * Phase 12 Implementation
 *
 * Provides a read-only, non-destructive diagnostic engine for Dexie IndexedDB.
 * Detects structural, referential, financial, temporal, stock, attachment,
 * and backup integrity issues before they cause business or reporting defects.
 */

import { db, ShweLetYarDatabase, AttachmentRecord } from '../db/database';
import {
  HealthCheckResult,
  HealthCheckSeverity,
  HealthCheckCategory,
  HealthOverallStatus,
  DatabaseHealthReport,
  StorageEstimateInfo,
  Product,
  Supplier,
  Merchant,
  TransactionRecord,
  SaleRecord,
  MerchantPurchaseRecord,
  MerchantOrder,
  StockAdjustmentRecord,
  PeerTradeRecord,
  AuditLogEntry,
  AutoRecoverySnapshot,
  SettingRecord,
  SoftDeletedItem,
  RawMaterialPreset,
  ReturnRecord,
  StockMovementRecord,
  CashMovementRecord,
  DailyClosingRecord,
} from '../types';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from './attachmentService';
import { CURRENT_APP_VERSION, CURRENT_DATABASE_SCHEMA_VERSION } from './backupService';

export const EXPECTED_DATABASE_TABLES = [
  'products',
  'suppliers',
  'merchants',
  'transactions',
  'sales',
  'merchantPurchases',
  'orders',
  'stockAdjustments',
  'peerTrades',
  'softDeletedItems',
  'auditLogs',
  'rawMaterialPresets',
  'settings',
  'recoverySnapshots',
  'attachments',
  'stockMovements',
  'cashMovements',
  'dailyClosings',
  'returnsAndRefunds',
] as const;

/**
 * Helper to generate unique check result ID
 */
let resultSeq = 0;
function makeCheckId(prefix: string): string {
  resultSeq += 1;
  return `chk_${prefix}_${Date.now()}_${resultSeq}`;
}

/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Safely retrieve storage estimation without throwing
 */
export async function getStorageEstimate(): Promise<StorageEstimateInfo | undefined> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const est = await navigator.storage.estimate();
      const usageBytes = est.usage;
      const quotaBytes = est.quota;
      return {
        usageBytes,
        quotaBytes,
        usageFormatted: usageBytes !== undefined ? formatBytes(usageBytes) : undefined,
        quotaFormatted: quotaBytes !== undefined ? formatBytes(quotaBytes) : undefined,
      };
    } catch {
      // Ignore estimation errors in restricted environments
    }
  }
  return undefined;
}

/**
 * Validate standard YYYY-MM-DD calendar date
 */
function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Validate standard HH:mm or HH:mm:ss time format
 */
function isValidTimeString(timeStr: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(timeStr);
}

/**
 * Primary Diagnostic Runner
 * Strictly READ-ONLY: Never writes, deletes, or alters records.
 */
export async function runDatabaseDiagnostics(
  targetDb: ShweLetYarDatabase = db
): Promise<DatabaseHealthReport> {
  const startTime = Date.now();
  const detectedAt = new Date().toISOString();
  const results: HealthCheckResult[] = [];

  // 1. Inspect Database & Schema
  const tableCounts: Record<string, number> = {};
  let dbName = 'Unknown';
  let schemaVerno = CURRENT_DATABASE_SCHEMA_VERSION;

  try {
    dbName = targetDb.name;
    schemaVerno = targetDb.verno;

    // Verify all expected tables exist in Dexie definition
    const existingTableNames = new Set(targetDb.tables.map((t) => t.name));
    for (const expected of EXPECTED_DATABASE_TABLES) {
      if (!existingTableNames.has(expected)) {
        results.push({
          id: makeCheckId('db_tbl_missing'),
          category: 'DATABASE',
          severity: 'CRITICAL',
          code: 'MISSING_DATABASE_TABLE',
          title: 'Database Table Missing',
          message: `Expected database table "${expected}" was not found in database schema.`,
          entity: expected,
          detectedAt,
        });
      }
    }

    results.push({
      id: makeCheckId('db_schema_pass'),
      category: 'DATABASE',
      severity: 'PASS',
      code: 'SCHEMA_VALID',
      title: 'Database Schema Active',
      message: `Database "${dbName}" active with schema v${schemaVerno} across ${existingTableNames.size} registered tables.`,
      detectedAt,
    });
  } catch (err: any) {
    results.push({
      id: makeCheckId('db_err'),
      category: 'DATABASE',
      severity: 'CRITICAL',
      code: 'DATABASE_OPEN_FAILURE',
      title: 'Database Schema Inspection Failed',
      message: `Failed to inspect Dexie database instance: ${err?.message || err}`,
      details: String(err),
      detectedAt,
    });
  }

  // Read all tables once (O(N) batch load)
  let products: Product[] = [];
  let suppliers: Supplier[] = [];
  let merchants: Merchant[] = [];
  let transactions: TransactionRecord[] = [];
  let sales: SaleRecord[] = [];
  let purchases: MerchantPurchaseRecord[] = [];
  let orders: MerchantOrder[] = [];
  let stockAdjustments: StockAdjustmentRecord[] = [];
  let peerTrades: PeerTradeRecord[] = [];
  let softDeletedItems: SoftDeletedItem[] = [];
  let auditLogs: AuditLogEntry[] = [];
  let rawMaterialPresets: RawMaterialPreset[] = [];
  let settings: SettingRecord[] = [];
  let recoverySnapshots: AutoRecoverySnapshot[] = [];
  let attachments: AttachmentRecord[] = [];
  let stockMovements: StockMovementRecord[] = [];
  let cashMovements: CashMovementRecord[] = [];
  let dailyClosings: DailyClosingRecord[] = [];
  let returnsAndRefunds: ReturnRecord[] = [];

  let readFailed = false;

  try {
    [
      products,
      suppliers,
      merchants,
      transactions,
      sales,
      purchases,
      orders,
      stockAdjustments,
      peerTrades,
      softDeletedItems,
      auditLogs,
      rawMaterialPresets,
      settings,
      recoverySnapshots,
      attachments,
      stockMovements,
      cashMovements,
      dailyClosings,
      returnsAndRefunds,
    ] = await Promise.all([
      targetDb.products.toArray(),
      targetDb.suppliers.toArray(),
      targetDb.merchants.toArray(),
      targetDb.transactions.toArray(),
      targetDb.sales.toArray(),
      targetDb.merchantPurchases.toArray(),
      targetDb.orders.toArray(),
      targetDb.stockAdjustments.toArray(),
      targetDb.peerTrades.toArray(),
      targetDb.softDeletedItems.toArray(),
      targetDb.auditLogs.toArray(),
      targetDb.rawMaterialPresets.toArray(),
      targetDb.settings.toArray(),
      targetDb.recoverySnapshots.toArray(),
      targetDb.attachments.toArray(),
      targetDb.stockMovements.toArray(),
      targetDb.cashMovements.toArray(),
      targetDb.dailyClosings.toArray(),
      targetDb.returnsAndRefunds ? targetDb.returnsAndRefunds.toArray() : Promise.resolve([]),
    ]);

    tableCounts.products = products.length;
    tableCounts.suppliers = suppliers.length;
    tableCounts.merchants = merchants.length;
    tableCounts.transactions = transactions.length;
    tableCounts.sales = sales.length;
    tableCounts.merchantPurchases = purchases.length;
    tableCounts.orders = orders.length;
    tableCounts.stockAdjustments = stockAdjustments.length;
    tableCounts.peerTrades = peerTrades.length;
    tableCounts.softDeletedItems = softDeletedItems.length;
    tableCounts.auditLogs = auditLogs.length;
    tableCounts.rawMaterialPresets = rawMaterialPresets.length;
    tableCounts.settings = settings.length;
    tableCounts.recoverySnapshots = recoverySnapshots.length;
    tableCounts.attachments = attachments.length;
    tableCounts.stockMovements = stockMovements.length;
    tableCounts.cashMovements = cashMovements.length;
    tableCounts.dailyClosings = dailyClosings.length;
    tableCounts.returnsAndRefunds = returnsAndRefunds.length;
  } catch (err: any) {
    readFailed = true;
    results.push({
      id: makeCheckId('read_fail'),
      category: 'DATABASE',
      severity: 'ERROR',
      code: 'DATABASE_READ_FAILURE',
      title: 'Database Read Error',
      message: `Failed to read database records from IndexedDB: ${err?.message || err}`,
      details: String(err),
      detectedAt,
    });
  }

  // Check if database is cleanly empty
  const totalRecords = Object.values(tableCounts).reduce((acc: number, c: number) => acc + c, 0);
  if (!readFailed && totalRecords === 0) {
    results.push({
      id: makeCheckId('empty_db'),
      category: 'DATABASE',
      severity: 'INFO',
      code: 'EMPTY_DATABASE',
      title: 'Empty Database State',
      message: 'Database currently has 0 business records. Fresh installation or cleared state confirmed.',
      detectedAt,
    });
  }

  if (!readFailed) {
    // Lookup Maps & Sets for high-performance O(1) checks
    const productMap = new Map<string, Product>();
    const supplierMap = new Map<string, Supplier>();
    const merchantMap = new Map<string, Merchant>();
    const transactionIdSet = new Set<string>();
    const saleIdSet = new Set<string>();
    const purchaseIdSet = new Set<string>();
    const orderIdSet = new Set<string>();

    const allVoucherAndIds = new Set<string>();

    // -------------------------------------------------------------
    // A & B: Primary ID & Required Fields Integrity
    // -------------------------------------------------------------
    const checkTableIdsAndFields = <T extends { id?: any }>(
      tableName: string,
      items: T[],
      idSet: Set<string>,
      fieldValidator?: (item: T) => void
    ) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const id = item?.id;

        // 1. ID Existence & Type
        if (id === undefined || id === null || id === '') {
          results.push({
            id: makeCheckId('id_empty'),
            category: 'DATA_INTEGRITY',
            severity: 'CRITICAL',
            code: 'MISSING_PRIMARY_ID',
            title: 'Missing Primary ID',
            message: `Record at index ${i} in table "${tableName}" is missing a valid primary ID.`,
            entity: tableName,
            detectedAt,
          });
          continue;
        }

        if (typeof id !== 'string') {
          results.push({
            id: makeCheckId('id_type'),
            category: 'DATA_INTEGRITY',
            severity: 'CRITICAL',
            code: 'MALFORMED_ID_TYPE',
            title: 'Malformed ID Data Type',
            message: `Record in table "${tableName}" has a non-string primary ID (${typeof id}).`,
            entity: tableName,
            recordId: String(id),
            detectedAt,
          });
          continue;
        }

        if (id.trim() === '' || id === 'undefined' || id === 'null') {
          results.push({
            id: makeCheckId('id_malformed'),
            category: 'DATA_INTEGRITY',
            severity: 'CRITICAL',
            code: 'MALFORMED_PRIMARY_ID',
            title: 'Malformed Primary ID',
            message: `Record in table "${tableName}" has an unexpected empty or placeholder ID: "${id}".`,
            entity: tableName,
            recordId: id,
            detectedAt,
          });
        }

        // 2. Duplicate Primary ID
        if (idSet.has(id)) {
          results.push({
            id: makeCheckId('dup_id'),
            category: 'DATA_INTEGRITY',
            severity: 'CRITICAL',
            code: 'DUPLICATE_PRIMARY_ID',
            title: 'Duplicate Primary ID',
            message: `Duplicate primary ID "${id}" detected in table "${tableName}".`,
            entity: tableName,
            recordId: id,
            detectedAt,
          });
        } else {
          idSet.add(id);
        }

        // 3. Entity-specific required field validator
        if (fieldValidator) {
          try {
            fieldValidator(item);
          } catch (e: any) {
            results.push({
              id: makeCheckId('field_val_err'),
              category: 'DATA_INTEGRITY',
              severity: 'ERROR',
              code: 'ENTITY_VALIDATION_ERROR',
              title: 'Validation Exception',
              message: `Error validating entity in "${tableName}": ${e?.message || e}`,
              entity: tableName,
              recordId: id,
              detectedAt,
            });
          }
        }
      }
    };

    // Product Validator
    const prodIdSet = new Set<string>();
    checkTableIdsAndFields('products', products, prodIdSet, (p) => {
      productMap.set(p.id, p);
      if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
        results.push({
          id: makeCheckId('prod_name'),
          category: 'DATA_INTEGRITY',
          severity: 'ERROR',
          code: 'MISSING_REQUIRED_FIELD',
          title: 'Product Missing Name',
          message: `Product ID "${p.id}" has an empty or invalid name.`,
          entity: 'Product',
          recordId: p.id,
          detectedAt,
        });
      }
      if (typeof p.defaultPrice !== 'number' || isNaN(p.defaultPrice)) {
        results.push({
          id: makeCheckId('prod_price_nan'),
          category: 'FINANCIAL',
          severity: 'ERROR',
          code: 'INVALID_MONETARY_VALUE',
          title: 'Invalid Product Price',
          message: `Product "${p.name || p.id}" has a non-numeric or NaN defaultPrice.`,
          entity: 'Product',
          recordId: p.id,
          detectedAt,
        });
      } else if (p.defaultPrice < 0) {
        results.push({
          id: makeCheckId('prod_price_neg'),
          category: 'FINANCIAL',
          severity: 'ERROR',
          code: 'NEGATIVE_PRICE',
          title: 'Negative Product Price',
          message: `Product "${p.name || p.id}" has a negative buy price: ${p.defaultPrice} MMK.`,
          entity: 'Product',
          recordId: p.id,
          detectedAt,
        });
      }
      if (p.defaultWholesalePrice !== undefined) {
        if (typeof p.defaultWholesalePrice !== 'number' || isNaN(p.defaultWholesalePrice) || p.defaultWholesalePrice < 0) {
          results.push({
            id: makeCheckId('prod_ws_price'),
            category: 'FINANCIAL',
            severity: 'ERROR',
            code: 'INVALID_MONETARY_VALUE',
            title: 'Invalid Wholesale Price',
            message: `Product "${p.name || p.id}" has an invalid wholesale price: ${p.defaultWholesalePrice}.`,
            entity: 'Product',
            recordId: p.id,
            detectedAt,
          });
        }
      }
      if (p.unit === undefined || p.unit === null || p.unit === '') {
        results.push({
          id: makeCheckId('prod_unit'),
          category: 'DATA_INTEGRITY',
          severity: 'WARN',
          code: 'MISSING_PRODUCT_UNIT',
          title: 'Missing Product Unit',
          message: `Product "${p.name || p.id}" has no measurement unit defined.`,
          entity: 'Product',
          recordId: p.id,
          detectedAt,
        });
      }
    });

    // Supplier Validator
    const supIdSet = new Set<string>();
    checkTableIdsAndFields('suppliers', suppliers, supIdSet, (s) => {
      supplierMap.set(s.id, s);
      if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
        results.push({
          id: makeCheckId('sup_name'),
          category: 'DATA_INTEGRITY',
          severity: 'ERROR',
          code: 'MISSING_REQUIRED_FIELD',
          title: 'Supplier Missing Name',
          message: `Supplier ID "${s.id}" has an empty or invalid name.`,
          entity: 'Supplier',
          recordId: s.id,
          detectedAt,
        });
      }
      if (!s.code || typeof s.code !== 'string' || !s.code.trim()) {
        results.push({
          id: makeCheckId('sup_code'),
          category: 'DATA_INTEGRITY',
          severity: 'WARN',
          code: 'MISSING_SUPPLIER_CODE',
          title: 'Missing Supplier Code',
          message: `Supplier "${s.name || s.id}" has no identification code.`,
          entity: 'Supplier',
          recordId: s.id,
          detectedAt,
        });
      }
      if (typeof s.currentAdvanceBalance !== 'number' || isNaN(s.currentAdvanceBalance)) {
        results.push({
          id: makeCheckId('sup_bal_nan'),
          category: 'FINANCIAL',
          severity: 'ERROR',
          code: 'INVALID_MONETARY_VALUE',
          title: 'Invalid Supplier Balance',
          message: `Supplier "${s.name || s.id}" has NaN or non-numeric advance balance.`,
          entity: 'Supplier',
          recordId: s.id,
          detectedAt,
        });
      }
    });

    // Merchant Validator
    const merchIdSet = new Set<string>();
    checkTableIdsAndFields('merchants', merchants, merchIdSet, (m) => {
      merchantMap.set(m.id, m);
      if (!m.name || typeof m.name !== 'string' || !m.name.trim()) {
        results.push({
          id: makeCheckId('merch_name'),
          category: 'DATA_INTEGRITY',
          severity: 'ERROR',
          code: 'MISSING_REQUIRED_FIELD',
          title: 'Merchant Missing Name',
          message: `Merchant ID "${m.id}" has an empty or invalid name.`,
          entity: 'Merchant',
          recordId: m.id,
          detectedAt,
        });
      }
      if (typeof m.currentReceivableBalance !== 'number' || isNaN(m.currentReceivableBalance)) {
        results.push({
          id: makeCheckId('merch_bal_nan'),
          category: 'FINANCIAL',
          severity: 'ERROR',
          code: 'INVALID_MONETARY_VALUE',
          title: 'Invalid Merchant Receivable Balance',
          message: `Merchant "${m.name || m.id}" has NaN or non-numeric receivable balance.`,
          entity: 'Merchant',
          recordId: m.id,
          detectedAt,
        });
      }
      if (m.role && !['BUYER', 'SUPPLIER', 'BOTH'].includes(m.role)) {
        results.push({
          id: makeCheckId('merch_role'),
          category: 'DATA_INTEGRITY',
          severity: 'WARN',
          code: 'INVALID_ENUM_VALUE',
          title: 'Invalid Merchant Role Enum',
          message: `Merchant "${m.name || m.id}" has unrecognized role value: "${m.role}".`,
          entity: 'Merchant',
          recordId: m.id,
          detectedAt,
        });
      }
    });

    // Transactions Validator
    checkTableIdsAndFields('transactions', transactions, transactionIdSet, (t) => {
      if (t.id) allVoucherAndIds.add(t.id);
      if (t.voucherNo) allVoucherAndIds.add(t.voucherNo);
    });

    // Sales Validator
    checkTableIdsAndFields('sales', sales, saleIdSet, (s) => {
      if (s.id) allVoucherAndIds.add(s.id);
      if (s.voucherNo) allVoucherAndIds.add(s.voucherNo);
    });

    // Merchant Purchases Validator
    checkTableIdsAndFields('merchantPurchases', purchases, purchaseIdSet, (p) => {
      if (p.id) allVoucherAndIds.add(p.id);
      if (p.purchaseNo) allVoucherAndIds.add(p.purchaseNo);
    });

    // Orders Validator
    checkTableIdsAndFields('orders', orders, orderIdSet, (o) => {
      if (o.id) allVoucherAndIds.add(o.id);
      if (o.orderNo) allVoucherAndIds.add(o.orderNo);
    });

    // Other tables ID validation
    const adjIdSet = new Set<string>();
    checkTableIdsAndFields('stockAdjustments', stockAdjustments, adjIdSet);
    const peerIdSet = new Set<string>();
    checkTableIdsAndFields('peerTrades', peerTrades, peerIdSet);
    const delIdSet = new Set<string>();
    checkTableIdsAndFields('softDeletedItems', softDeletedItems, delIdSet);
    const auditIdSet = new Set<string>();
    checkTableIdsAndFields('auditLogs', auditLogs, auditIdSet);
    const snapIdSet = new Set<string>();
    checkTableIdsAndFields('recoverySnapshots', recoverySnapshots, snapIdSet);
    const attIdSet = new Set<string>();
    checkTableIdsAndFields('attachments', attachments, attIdSet);

    // -------------------------------------------------------------
    // C: Referential Integrity Checks
    // -------------------------------------------------------------

    // 1. Transactions -> Supplier & Product
    for (const t of transactions) {
      if (!t.supplierId) {
        results.push({
          id: makeCheckId('t_no_sup'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'MISSING_FOREIGN_KEY',
          title: 'Transaction Missing Supplier ID',
          message: `Transaction "${t.voucherNo || t.id}" does not specify a supplierId.`,
          entity: 'Transaction',
          recordId: t.id,
          detectedAt,
        });
      } else if (!supplierMap.has(t.supplierId)) {
        results.push({
          id: makeCheckId('t_broken_sup'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'BROKEN_FOREIGN_KEY',
          title: 'Broken Supplier Reference',
          message: `Transaction "${t.voucherNo || t.id}" references non-existent supplier ID "${t.supplierId}".`,
          entity: 'Transaction',
          recordId: t.id,
          relatedRecordIds: [t.supplierId],
          detectedAt,
        });
      }

      // Check items
      if (!Array.isArray(t.items)) {
        results.push({
          id: makeCheckId('t_items_arr'),
          category: 'DATA_INTEGRITY',
          severity: 'ERROR',
          code: 'INVALID_DATA_TYPE',
          title: 'Transaction Items Not Array',
          message: `Transaction "${t.voucherNo || t.id}" has non-array items property.`,
          entity: 'Transaction',
          recordId: t.id,
          detectedAt,
        });
      } else {
        for (const item of t.items) {
          if (!item.productId) {
            results.push({
              id: makeCheckId('t_item_no_pid'),
              category: 'REFERENCES',
              severity: 'ERROR',
              code: 'MISSING_PRODUCT_REF',
              title: 'Transaction Item Missing Product ID',
              message: `Transaction "${t.voucherNo || t.id}" has an item with missing productId.`,
              entity: 'Transaction',
              recordId: t.id,
              detectedAt,
            });
          } else if (!productMap.has(item.productId)) {
            results.push({
              id: makeCheckId('t_item_broken_pid'),
              category: 'REFERENCES',
              severity: 'ERROR',
              code: 'BROKEN_PRODUCT_REF',
              title: 'Broken Product Reference in Transaction',
              message: `Transaction "${t.voucherNo || t.id}" contains item referencing non-existent productId "${item.productId}" (${item.productName || 'Unnamed'}).`,
              entity: 'Transaction',
              recordId: t.id,
              relatedRecordIds: [item.productId],
              detectedAt,
            });
          }
        }
      }
    }

    // 2. Sales -> Merchant & Product
    for (const s of sales) {
      if (!s.merchantId) {
        results.push({
          id: makeCheckId('s_no_merch'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'MISSING_FOREIGN_KEY',
          title: 'Sale Missing Merchant ID',
          message: `Sale "${s.voucherNo || s.id}" does not specify a merchantId.`,
          entity: 'Sale',
          recordId: s.id,
          detectedAt,
        });
      } else if (!merchantMap.has(s.merchantId)) {
        results.push({
          id: makeCheckId('s_broken_merch'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'BROKEN_FOREIGN_KEY',
          title: 'Broken Merchant Reference in Sale',
          message: `Sale "${s.voucherNo || s.id}" references non-existent merchant ID "${s.merchantId}".`,
          entity: 'Sale',
          recordId: s.id,
          relatedRecordIds: [s.merchantId],
          detectedAt,
        });
      }

      if (!Array.isArray(s.items)) {
        results.push({
          id: makeCheckId('s_items_arr'),
          category: 'DATA_INTEGRITY',
          severity: 'ERROR',
          code: 'INVALID_DATA_TYPE',
          title: 'Sale Items Not Array',
          message: `Sale "${s.voucherNo || s.id}" has non-array items property.`,
          entity: 'Sale',
          recordId: s.id,
          detectedAt,
        });
      } else {
        for (const item of s.items) {
          if (!item.productId) {
            results.push({
              id: makeCheckId('s_item_no_pid'),
              category: 'REFERENCES',
              severity: 'ERROR',
              code: 'MISSING_PRODUCT_REF',
              title: 'Sale Item Missing Product ID',
              message: `Sale "${s.voucherNo || s.id}" has an item with missing productId.`,
              entity: 'Sale',
              recordId: s.id,
              detectedAt,
            });
          } else if (!productMap.has(item.productId)) {
            results.push({
              id: makeCheckId('s_item_broken_pid'),
              category: 'REFERENCES',
              severity: 'ERROR',
              code: 'BROKEN_PRODUCT_REF',
              title: 'Broken Product Reference in Sale',
              message: `Sale "${s.voucherNo || s.id}" contains item referencing non-existent productId "${item.productId}" (${item.productName || 'Unnamed'}).`,
              entity: 'Sale',
              recordId: s.id,
              relatedRecordIds: [item.productId],
              detectedAt,
            });
          }
        }
      }
    }

    // 3. Merchant Purchases -> Merchant & Product
    for (const p of purchases) {
      if (!p.merchantId || !merchantMap.has(p.merchantId)) {
        results.push({
          id: makeCheckId('p_broken_merch'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'BROKEN_FOREIGN_KEY',
          title: 'Broken Merchant Reference in Purchase',
          message: `Merchant Purchase "${p.purchaseNo || p.id}" references non-existent merchant ID "${p.merchantId}".`,
          entity: 'MerchantPurchase',
          recordId: p.id,
          relatedRecordIds: [p.merchantId],
          detectedAt,
        });
      }
      if (Array.isArray(p.items)) {
        for (const item of p.items) {
          if (item.productId && !productMap.has(item.productId)) {
            results.push({
              id: makeCheckId('p_broken_pid'),
              category: 'REFERENCES',
              severity: 'ERROR',
              code: 'BROKEN_PRODUCT_REF',
              title: 'Broken Product Reference in Purchase',
              message: `Purchase "${p.purchaseNo || p.id}" references non-existent productId "${item.productId}".`,
              entity: 'MerchantPurchase',
              recordId: p.id,
              relatedRecordIds: [item.productId],
              detectedAt,
            });
          }
        }
      }
    }

    // 4. Orders -> Merchant, Product, & Linked Sale Voucher
    for (const o of orders) {
      if (!o.merchantId || !merchantMap.has(o.merchantId)) {
        results.push({
          id: makeCheckId('o_broken_merch'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'BROKEN_FOREIGN_KEY',
          title: 'Broken Merchant Reference in Order',
          message: `Order "${o.orderNo || o.id}" references non-existent merchant ID "${o.merchantId}".`,
          entity: 'Order',
          recordId: o.id,
          relatedRecordIds: [o.merchantId],
          detectedAt,
        });
      }
      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          if (item.productId && !productMap.has(item.productId)) {
            results.push({
              id: makeCheckId('o_broken_pid'),
              category: 'REFERENCES',
              severity: 'ERROR',
              code: 'BROKEN_PRODUCT_REF',
              title: 'Broken Product Reference in Order',
              message: `Order "${o.orderNo || o.id}" references non-existent productId "${item.productId}".`,
              entity: 'Order',
              recordId: o.id,
              relatedRecordIds: [item.productId],
              detectedAt,
            });
          }
        }
      }
      if (o.saleVoucherId) {
        const matchingSale = sales.find((s) => s.id === o.saleVoucherId || s.voucherNo === o.saleVoucherId);
        if (!matchingSale) {
          results.push({
            id: makeCheckId('o_broken_sale'),
            category: 'REFERENCES',
            severity: 'WARN',
            code: 'BROKEN_SALE_VOUCHER_REF',
            title: 'Broken Sale Voucher Reference in Order',
            message: `Order "${o.orderNo || o.id}" points to saleVoucherId "${o.saleVoucherId}" which was not found in sales records.`,
            entity: 'Order',
            recordId: o.id,
            relatedRecordIds: [o.saleVoucherId],
            detectedAt,
          });
        }
      }
    }

    // 5. Stock Adjustments -> Product
    for (const adj of stockAdjustments) {
      if (!adj.productId || !productMap.has(adj.productId)) {
        results.push({
          id: makeCheckId('adj_broken_pid'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'BROKEN_PRODUCT_REF',
          title: 'Broken Product Reference in Stock Adjustment',
          message: `Stock adjustment "${adj.id}" references non-existent productId "${adj.productId}".`,
          entity: 'StockAdjustment',
          recordId: adj.id,
          relatedRecordIds: [adj.productId],
          detectedAt,
        });
      }
    }

    // 6. Peer Trades -> Product
    for (const pt of peerTrades) {
      if (!pt.productId || !productMap.has(pt.productId)) {
        results.push({
          id: makeCheckId('pt_broken_pid'),
          category: 'REFERENCES',
          severity: 'ERROR',
          code: 'BROKEN_PRODUCT_REF',
          title: 'Broken Product Reference in Peer Trade',
          message: `Peer trade "${pt.id}" references non-existent productId "${pt.productId}".`,
          entity: 'PeerTrade',
          recordId: pt.id,
          relatedRecordIds: [pt.productId],
          detectedAt,
        });
      }
    }

    // -------------------------------------------------------------
    // D & H: Financial & Transaction/Ledger Integrity
    // -------------------------------------------------------------
    const checkNumericField = (
      val: any,
      fieldName: string,
      entity: string,
      recordId: string,
      allowNegative: boolean = false
    ) => {
      if (val === undefined || val === null) return;
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        results.push({
          id: makeCheckId('fin_nan'),
          category: 'FINANCIAL',
          severity: 'ERROR',
          code: 'INVALID_MONETARY_VALUE',
          title: 'NaN or Infinite Value',
          message: `${entity} "${recordId}" has non-numeric, NaN or infinite value in field "${fieldName}".`,
          entity,
          recordId,
          detectedAt,
        });
        return;
      }
      if (!allowNegative && val < 0) {
        results.push({
          id: makeCheckId('fin_neg'),
          category: 'FINANCIAL',
          severity: 'ERROR',
          code: 'PROHIBITED_NEGATIVE_VALUE',
          title: 'Negative Amount Prohibited',
          message: `${entity} "${recordId}" has prohibited negative value (${val}) in field "${fieldName}".`,
          entity,
          recordId,
          detectedAt,
        });
      }
      // MMK Integer Precision check (Myanmar Kyat does not use fractional satangs/cents)
      if (!Number.isInteger(val)) {
        results.push({
          id: makeCheckId('fin_fraction'),
          category: 'FINANCIAL',
          severity: 'WARN',
          code: 'FLOATING_POINT_RESIDUE',
          title: 'Fractional Currency Value',
          message: `${entity} "${recordId}" field "${fieldName}" has fractional decimal precision (${val}). Myanmar Kyat requires whole integer units.`,
          entity,
          recordId,
          detectedAt,
        });
      }
    };

    // Audit Transactions Ledger
    for (const t of transactions) {
      checkNumericField(t.totalGoodsValue, 'totalGoodsValue', 'Transaction', t.id, false);
      checkNumericField(t.previousAdvanceBalance, 'previousAdvanceBalance', 'Transaction', t.id, true);
      checkNumericField(t.advanceDeducted, 'advanceDeducted', 'Transaction', t.id, false);
      checkNumericField(t.newAdvanceTaken, 'newAdvanceTaken', 'Transaction', t.id, false);
      checkNumericField(t.remainingAdvanceBalance, 'remainingAdvanceBalance', 'Transaction', t.id, true);

      // Verify line items sum vs totalGoodsValue
      if (Array.isArray(t.items)) {
        let computedGoodsTotal = 0;
        for (const item of t.items) {
          if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
            results.push({
              id: makeCheckId('t_item_qty'),
              category: 'FINANCIAL',
              severity: 'ERROR',
              code: 'INVALID_QUANTITY',
              title: 'Invalid Item Quantity in Transaction',
              message: `Transaction "${t.voucherNo || t.id}" contains item with impossible quantity (${item.quantity}).`,
              entity: 'Transaction',
              recordId: t.id,
              detectedAt,
            });
          }
          if (typeof item.unitPrice !== 'number' || isNaN(item.unitPrice) || item.unitPrice < 0) {
            results.push({
              id: makeCheckId('t_item_price'),
              category: 'FINANCIAL',
              severity: 'ERROR',
              code: 'INVALID_MONETARY_VALUE',
              title: 'Invalid Item Price in Transaction',
              message: `Transaction "${t.voucherNo || t.id}" contains item with invalid unitPrice (${item.unitPrice}).`,
              entity: 'Transaction',
              recordId: t.id,
              detectedAt,
            });
          }
          computedGoodsTotal += Math.round((item.quantity || 0) * (item.unitPrice || 0));
        }

        // Check sum consistency if items exist
        if (t.items.length > 0 && Math.abs(computedGoodsTotal - (t.totalGoodsValue || 0)) > 1) {
          results.push({
            id: makeCheckId('t_sum_mismatch'),
            category: 'FINANCIAL',
            severity: 'WARN',
            code: 'TOTAL_MISMATCH',
            title: 'Transaction Goods Value Mismatch',
            message: `Transaction "${t.voucherNo || t.id}" recorded totalGoodsValue (${t.totalGoodsValue}) does not match sum of items (${computedGoodsTotal}).`,
            entity: 'Transaction',
            recordId: t.id,
            details: { recorded: t.totalGoodsValue, calculated: computedGoodsTotal },
            detectedAt,
          });
        }
      }
    }

    // Audit Sales Ledger
    for (const s of sales) {
      checkNumericField(s.grandTotal, 'grandTotal', 'Sale', s.id, false);
      checkNumericField(s.cashPaidByMerchant, 'cashPaidByMerchant', 'Sale', s.id, false);
      checkNumericField(s.deliveryFee, 'deliveryFee', 'Sale', s.id, false);
      checkNumericField(s.discount, 'discount', 'Sale', s.id, false);
      checkNumericField(s.remainingReceivableBalance, 'remainingReceivableBalance', 'Sale', s.id, true);

      if (Array.isArray(s.items)) {
        let computedItemsTotal = 0;
        for (const item of s.items) {
          if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
            results.push({
              id: makeCheckId('s_item_qty'),
              category: 'FINANCIAL',
              severity: 'ERROR',
              code: 'INVALID_QUANTITY',
              title: 'Invalid Item Quantity in Sale',
              message: `Sale "${s.voucherNo || s.id}" contains item with impossible quantity (${item.quantity}).`,
              entity: 'Sale',
              recordId: s.id,
              detectedAt,
            });
          }
          computedItemsTotal += Math.round((item.quantity || 0) * (item.unitPrice || 0));
        }

        const expectedGrand = computedItemsTotal + (s.deliveryFee || 0) - (s.discount || 0);
        if (s.items.length > 0 && Math.abs(expectedGrand - (s.grandTotal || 0)) > 1) {
          results.push({
            id: makeCheckId('s_grand_mismatch'),
            category: 'FINANCIAL',
            severity: 'WARN',
            code: 'GRAND_TOTAL_MISMATCH',
            title: 'Sale Grand Total Inconsistent',
            message: `Sale "${s.voucherNo || s.id}" recorded grandTotal (${s.grandTotal}) does not match computed total (${expectedGrand}).`,
            entity: 'Sale',
            recordId: s.id,
            details: { recorded: s.grandTotal, calculated: expectedGrand },
            detectedAt,
          });
        }
      }
    }

    // Audit Purchases Ledger
    for (const p of purchases) {
      checkNumericField(p.totalAmount, 'totalAmount', 'MerchantPurchase', p.id, false);
      checkNumericField(p.paidAmount, 'paidAmount', 'MerchantPurchase', p.id, false);
      checkNumericField(p.remainingPayableBalance, 'remainingPayableBalance', 'MerchantPurchase', p.id, true);
    }

    // -------------------------------------------------------------
    // E: Date & Time Integrity
    // -------------------------------------------------------------
    const nowEpoch = Date.now();
    const futureThresholdEpoch = nowEpoch + 24 * 60 * 60 * 1000; // allow 24h skew max

    const checkDateFields = (
      dateStr: any,
      timeStr: any,
      entity: string,
      recordId: string,
      allowFuture: boolean = false
    ) => {
      if (!dateStr || typeof dateStr !== 'string') {
        results.push({
          id: makeCheckId('dt_missing'),
          category: 'DATA_INTEGRITY',
          severity: 'ERROR',
          code: 'MISSING_DATE',
          title: 'Missing Required Date',
          message: `${entity} "${recordId}" is missing a required date value.`,
          entity,
          recordId,
          detectedAt,
        });
        return;
      }

      if (!isValidDateString(dateStr)) {
        results.push({
          id: makeCheckId('dt_invalid'),
          category: 'DATA_INTEGRITY',
          severity: 'ERROR',
          code: 'INVALID_DATE_FORMAT',
          title: 'Invalid Date String',
          message: `${entity} "${recordId}" has invalid calendar date format: "${dateStr}".`,
          entity,
          recordId,
          detectedAt,
        });
        return;
      }

      if (timeStr && typeof timeStr === 'string' && !isValidTimeString(timeStr)) {
        results.push({
          id: makeCheckId('tm_invalid'),
          category: 'DATA_INTEGRITY',
          severity: 'WARN',
          code: 'INVALID_TIME_FORMAT',
          title: 'Invalid Time String',
          message: `${entity} "${recordId}" has non-standard time format: "${timeStr}".`,
          entity,
          recordId,
          detectedAt,
        });
      }

      if (!allowFuture) {
        const parsed = Date.parse(dateStr);
        if (parsed > futureThresholdEpoch) {
          results.push({
            id: makeCheckId('dt_future'),
            category: 'DATA_INTEGRITY',
            severity: 'WARN',
            code: 'FUTURE_BUSINESS_DATE',
            title: 'Future Business Date Detected',
            message: `${entity} "${recordId}" has completed transaction date in the future (${dateStr}).`,
            entity,
            recordId,
            detectedAt,
          });
        }
      }
    };

    transactions.forEach((t) => checkDateFields(t.date, t.time, 'Transaction', t.id, false));
    sales.forEach((s) => checkDateFields(s.date, s.time, 'Sale', s.id, false));
    purchases.forEach((p) => checkDateFields(p.date, p.time, 'MerchantPurchase', p.id, false));
    stockAdjustments.forEach((a) => checkDateFields(a.date, a.time, 'StockAdjustment', a.id, false));
    peerTrades.forEach((pt) => checkDateFields(pt.date, pt.time, 'PeerTrade', pt.id, false));
    orders.forEach((o) => {
      // Order delivery target date is allowed to be in future!
      if (o.deliveryTargetDate) {
        checkDateFields(o.deliveryTargetDate, undefined, 'OrderDeliveryTarget', o.id, true);
      }
      if (o.orderDate || o.date) {
        checkDateFields((o.orderDate || o.date)!, o.time, 'OrderCreation', o.id, false);
      }
    });

    // -------------------------------------------------------------
    // F: Voucher / Document Number Integrity
    // -------------------------------------------------------------
    const checkVoucherUniqueness = (
      items: { id: string; voucherNo?: string; purchaseNo?: string; orderNo?: string }[],
      numProp: 'voucherNo' | 'purchaseNo' | 'orderNo',
      entityName: string
    ) => {
      const vMap = new Map<string, string>();
      for (const item of items) {
        const vNum = item[numProp];
        if (!vNum || typeof vNum !== 'string' || !vNum.trim()) {
          results.push({
            id: makeCheckId('v_missing'),
            category: 'DATA_INTEGRITY',
            severity: 'ERROR',
            code: 'MISSING_VOUCHER_NUMBER',
            title: `Missing ${numProp} on ${entityName}`,
            message: `${entityName} "${item.id}" has no human-readable voucher or reference number.`,
            entity: entityName,
            recordId: item.id,
            detectedAt,
          });
          continue;
        }

        const normalized = vNum.trim();
        if (vMap.has(normalized)) {
          const firstId = vMap.get(normalized)!;
          results.push({
            id: makeCheckId('v_dup'),
            category: 'DATA_INTEGRITY',
            severity: 'ERROR',
            code: 'DUPLICATE_VOUCHER_NUMBER',
            title: `Duplicate ${entityName} Voucher Number`,
            message: `Human document number "${normalized}" is duplicated between records "${firstId}" and "${item.id}".`,
            entity: entityName,
            recordId: item.id,
            relatedRecordIds: [firstId],
            detectedAt,
          });
        } else {
          vMap.set(normalized, item.id);
        }
      }
    };

    checkVoucherUniqueness(transactions, 'voucherNo', 'Transaction');
    checkVoucherUniqueness(sales, 'voucherNo', 'Sale');
    checkVoucherUniqueness(purchases, 'purchaseNo', 'MerchantPurchase');
    checkVoucherUniqueness(orders, 'orderNo', 'Order');

    // -------------------------------------------------------------
    // G: Stock Integrity & Reconstructed Movements
    // -------------------------------------------------------------
    const stockDeltas = new Map<string, number>();

    // 1. Collections (+ finished goods collected)
    for (const t of transactions) {
      if (t.status !== 'CANCELLED' && Array.isArray(t.items)) {
        for (const item of t.items) {
          if (item.productId && typeof item.quantity === 'number') {
            const current = stockDeltas.get(item.productId) || 0;
            stockDeltas.set(item.productId, current + item.quantity);
          }
        }
      }
    }

    // 2. Purchases (+ goods bought from merchants)
    for (const p of purchases) {
      if (p.status !== 'CANCELLED' && Array.isArray(p.items)) {
        for (const item of p.items) {
          if (item.productId && typeof item.quantity === 'number') {
            const current = stockDeltas.get(item.productId) || 0;
            stockDeltas.set(item.productId, current + item.quantity);
          }
        }
      }
    }

    // 3. Peer Trades (+ BORROW_IN, - LEND_OUT)
    for (const pt of peerTrades) {
      if (pt.productId && typeof pt.quantity === 'number') {
        const delta = pt.tradeType === 'BORROW_IN' ? pt.quantity : -pt.quantity;
        const current = stockDeltas.get(pt.productId) || 0;
        stockDeltas.set(pt.productId, current + delta);
      }
    }

    // 4. Sales (- finished goods sold)
    for (const s of sales) {
      if (s.status !== 'CANCELLED' && Array.isArray(s.items)) {
        for (const item of s.items) {
          if (item.productId && typeof item.quantity === 'number') {
            const current = stockDeltas.get(item.productId) || 0;
            stockDeltas.set(item.productId, current - item.quantity);
          }
        }
      }
    }

    // 5. Stock Adjustments (+ or -)
    for (const adj of stockAdjustments) {
      if (adj.status !== 'CANCELLED' && adj.productId && typeof adj.quantity === 'number') {
        const current = stockDeltas.get(adj.productId) || 0;
        stockDeltas.set(adj.productId, current + adj.quantity);
      }
    }

    // Compare with Product records
    for (const prod of products) {
      const opening = prod.openingStock ?? 0;
      const netMovement = stockDeltas.get(prod.id) || 0;
      const calculatedStock = opening + netMovement;

      if (prod.currentStock !== undefined) {
        if (typeof prod.currentStock !== 'number' || isNaN(prod.currentStock)) {
          results.push({
            id: makeCheckId('stk_nan'),
            category: 'STOCK',
            severity: 'ERROR',
            code: 'INVALID_STOCK_VALUE',
            title: 'Product Stock NaN',
            message: `Product "${prod.name}" has invalid or NaN currentStock.`,
            entity: 'Product',
            recordId: prod.id,
            detectedAt,
          });
        } else if (prod.currentStock < 0) {
          results.push({
            id: makeCheckId('stk_neg'),
            category: 'STOCK',
            severity: 'WARN',
            code: 'NEGATIVE_STOCK_LEVEL',
            title: 'Negative Stock Level',
            message: `Product "${prod.name}" has negative recorded stock (${prod.currentStock} ${prod.unit || 'units'}).`,
            entity: 'Product',
            recordId: prod.id,
            detectedAt,
          });
        } else if (prod.currentStock !== calculatedStock) {
          results.push({
            id: makeCheckId('stk_drift'),
            category: 'STOCK',
            severity: 'WARN',
            code: 'STOCK_STATE_INCONSISTENCY',
            title: 'Stock Ledger Drift',
            message: `Product "${prod.name}" currentStock (${prod.currentStock}) differs from reconstructed stock ledger (${calculatedStock}).`,
            entity: 'Product',
            recordId: prod.id,
            details: { recorded: prod.currentStock, calculated: calculatedStock, difference: prod.currentStock - calculatedStock },
            detectedAt,
          });
        }
      }
    }

    // -------------------------------------------------------------
    // I: Attachment Integrity Checks
    // -------------------------------------------------------------
    const validAttachmentIds = new Set<string>();

    for (const att of attachments) {
      validAttachmentIds.add(att.id);

      // Check voucherId
      if (!att.voucherId || typeof att.voucherId !== 'string' || !att.voucherId.trim()) {
        results.push({
          id: makeCheckId('att_no_v'),
          category: 'ATTACHMENTS',
          severity: 'ERROR',
          code: 'MISSING_ATTACHMENT_VOUCHER_REF',
          title: 'Attachment Missing Voucher ID',
          message: `Attachment record "${att.id}" has no linked voucherId.`,
          entity: 'Attachment',
          recordId: att.id,
          detectedAt,
        });
      } else {
        // Orphan check: does voucherId match any business entity?
        if (!allVoucherAndIds.has(att.voucherId)) {
          results.push({
            id: makeCheckId('att_orphan'),
            category: 'ATTACHMENTS',
            severity: 'WARN',
            code: 'ORPHAN_ATTACHMENT',
            title: 'Orphan Attachment Detected',
            message: `Attachment "${att.id}" references voucherId "${att.voucherId}" which does not correspond to any active transaction, sale, purchase or order.`,
            entity: 'Attachment',
            recordId: att.id,
            details: { voucherId: att.voucherId },
            detectedAt,
          });
        }
      }

      // Check MIME type
      if (att.mimeType) {
        const isAllowedMime = ALLOWED_IMAGE_MIME_TYPES.some((m) => m.toLowerCase() === att.mimeType?.toLowerCase()) || att.mimeType.startsWith('image/');
        if (!isAllowedMime) {
          results.push({
            id: makeCheckId('att_mime'),
            category: 'ATTACHMENTS',
            severity: 'ERROR',
            code: 'INVALID_ATTACHMENT_MIME_TYPE',
            title: 'Invalid Attachment MIME Type',
            message: `Attachment "${att.id}" has unauthorized MIME type "${att.mimeType}".`,
            entity: 'Attachment',
            recordId: att.id,
            detectedAt,
          });
        }
      }

      // Check size metadata
      if (att.sizeBytes !== undefined) {
        if (att.sizeBytes <= 0) {
          results.push({
            id: makeCheckId('att_zero_size'),
            category: 'ATTACHMENTS',
            severity: 'ERROR',
            code: 'INVALID_ATTACHMENT_SIZE',
            title: 'Zero or Negative Attachment Size',
            message: `Attachment "${att.id}" has invalid sizeBytes metadata (${att.sizeBytes}).`,
            entity: 'Attachment',
            recordId: att.id,
            detectedAt,
          });
        } else if (att.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
          results.push({
            id: makeCheckId('att_oversize'),
            category: 'ATTACHMENTS',
            severity: 'WARN',
            code: 'SUSPICIOUS_OVERSIZED_ATTACHMENT',
            title: 'Suspicious Oversized Attachment',
            message: `Attachment "${att.id}" exceeds recommended size limit (${formatBytes(att.sizeBytes)} > ${formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}).`,
            entity: 'Attachment',
            recordId: att.id,
            detectedAt,
          });
        }
      }

      // Blob existence vs payload
      const hasBlob = att.blob && typeof att.blob.size === 'number';
      const hasBase64 = att.imageBase64 && typeof att.imageBase64 === 'string' && att.imageBase64.length > 0;
      if (!hasBlob && !hasBase64) {
        results.push({
          id: makeCheckId('att_missing_blob'),
          category: 'ATTACHMENTS',
          severity: 'ERROR',
          code: 'MISSING_ATTACHMENT_PAYLOAD',
          title: 'Missing Attachment Binary Payload',
          message: `Attachment "${att.id}" has neither an IndexedDB Blob nor Base64 payload stored.`,
          entity: 'Attachment',
          recordId: att.id,
          detectedAt,
        });
      } else if (hasBlob && att.sizeBytes && Math.abs(att.blob!.size - att.sizeBytes) > 10) {
        results.push({
          id: makeCheckId('att_size_mismatch'),
          category: 'ATTACHMENTS',
          severity: 'WARN',
          code: 'ATTACHMENT_BLOB_SIZE_MISMATCH',
          title: 'Attachment Metadata / Blob Size Mismatch',
          message: `Attachment "${att.id}" sizeBytes metadata (${att.sizeBytes}) does not match binary blob size (${att.blob!.size}).`,
          entity: 'Attachment',
          recordId: att.id,
          detectedAt,
        });
      }
    }

    // Check transactions/sales attachment reference integrity
    const checkBrokenAttachmentRefs = (
      items: { id: string; voucherNo?: string; attachmentPhotos?: string[] }[],
      entityName: string
    ) => {
      for (const item of items) {
        if (Array.isArray(item.attachmentPhotos)) {
          for (const photoRef of item.attachmentPhotos) {
            // photoRef can be an attachment ID or legacy base64
            if (photoRef.startsWith('att_') && !validAttachmentIds.has(photoRef)) {
              results.push({
                id: makeCheckId('broken_att_ref'),
                category: 'ATTACHMENTS',
                severity: 'WARN',
                code: 'BROKEN_ATTACHMENT_REFERENCE',
                title: 'Broken Attachment Reference',
                message: `${entityName} "${item.voucherNo || item.id}" references attachment ID "${photoRef}" which was not found in attachments table.`,
                entity: entityName,
                recordId: item.id,
                relatedRecordIds: [photoRef],
                detectedAt,
              });
            }
          }
        }
      }
    };
    checkBrokenAttachmentRefs(transactions, 'Transaction');
    checkBrokenAttachmentRefs(sales, 'Sale');

    // -------------------------------------------------------------
    // Returns & Refunds Integrity Checks (Phase 16)
    // -------------------------------------------------------------
    if (returnsAndRefunds && returnsAndRefunds.length > 0) {
      const returnKeySet = new Set<string>();
      const stockMovementReversalMap = new Map<string, boolean>();
      const cashMovementReversalMap = new Map<string, boolean>();

      for (const sm of stockMovements) {
        if (sm.reversalOf) stockMovementReversalMap.set(sm.reversalOf, true);
      }
      for (const cm of cashMovements) {
        if (cm.reversalOf) cashMovementReversalMap.set(cm.reversalOf, true);
      }

      for (const ret of returnsAndRefunds) {
        // 1. Orphan Return Reference Check
        let refExists = false;
        if (ret.type === 'SALES_RETURN' || ret.referenceType === 'SALE') {
          refExists = saleIdSet.has(ret.referenceId);
        } else if (
          ret.type === 'PURCHASE_RETURN' ||
          ret.referenceType === 'PURCHASE' ||
          ret.referenceType === 'TRANSACTION'
        ) {
          refExists = purchaseIdSet.has(ret.referenceId) || transactionIdSet.has(ret.referenceId);
        }

        if (!refExists) {
          results.push({
            id: makeCheckId('orphan_ret_ref'),
            category: 'REFERENCES',
            severity: 'ERROR',
            code: 'ORPHAN_RETURN_REFERENCE',
            title: 'Orphan Return Voucher Reference',
            message: `Return record #${ret.returnNo} references non-existent ${ret.referenceType} voucher ID "${ret.referenceId}".`,
            entity: 'ReturnRecord',
            recordId: ret.id,
            detectedAt,
          });
        }

        // 2. Duplicate Idempotency Key Check
        if (ret.idempotencyKey) {
          if (returnKeySet.has(ret.idempotencyKey)) {
            results.push({
              id: makeCheckId('dup_ret_key'),
              category: 'DATA_INTEGRITY',
              severity: 'ERROR',
              code: 'DUPLICATE_RETURN_IDEMPOTENCY_KEY',
              title: 'Duplicate Return Idempotency Key',
              message: `Multiple return records share identical idempotency key "${ret.idempotencyKey}".`,
              entity: 'ReturnRecord',
              recordId: ret.id,
              detectedAt,
            });
          } else {
            returnKeySet.add(ret.idempotencyKey);
          }
        }

        // 3. Invalid Return Quantities
        if (!Array.isArray(ret.items) || ret.items.length === 0) {
          results.push({
            id: makeCheckId('ret_no_items'),
            category: 'DATA_INTEGRITY',
            severity: 'ERROR',
            code: 'INVALID_QUANTITY',
            title: 'Return Record Has No Items',
            message: `Return record #${ret.returnNo} contains an empty items list.`,
            entity: 'ReturnRecord',
            recordId: ret.id,
            detectedAt,
          });
        } else {
          for (const item of ret.items) {
            if (typeof item.quantity !== 'number' || item.quantity <= 0) {
              results.push({
                id: makeCheckId('ret_inv_qty'),
                category: 'DATA_INTEGRITY',
                severity: 'ERROR',
                code: 'INVALID_QUANTITY',
                title: 'Invalid Return Item Quantity',
                message: `Return record #${ret.returnNo} item "${item.productName}" has invalid quantity ${item.quantity}.`,
                entity: 'ReturnRecord',
                recordId: ret.id,
                detectedAt,
              });
            }
          }
        }

        // 4. Missing Reversal Links for Cancelled Returns
        if (ret.status === 'CANCELLED') {
          const hasStockRev = stockMovementReversalMap.has(ret.id);
          const hasCashRev = ret.cashRefundAmount > 0 ? cashMovementReversalMap.has(ret.id) : true;

          if (!hasStockRev || !hasCashRev) {
            results.push({
              id: makeCheckId('missing_ret_rev'),
              category: 'FINANCIAL',
              severity: 'CRITICAL',
              code: 'MISSING_RETURN_REVERSAL_LINK',
              title: 'Missing Cancelled Return Reversal Entry',
              message: `Cancelled return record #${ret.returnNo} is missing compensating stock or cash ledger reversal records.`,
              entity: 'ReturnRecord',
              recordId: ret.id,
              detectedAt,
            });
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Audit Trail & Activity History Diagnostics (Phase 17)
    // -------------------------------------------------------------
    const auditSeenIds = new Set<string>();
    const returnIdSet = new Set<string>((returnsAndRefunds || []).map((r) => r.id));
    const dailyClosingIdSet = new Set<string>((dailyClosings || []).map((d) => d.id));

    for (const log of auditLogs) {
      if (!log.id) {
        results.push({
          id: makeCheckId('audit_no_id'),
          category: 'AUDIT_TRAIL',
          severity: 'ERROR',
          code: 'MISSING_REQUIRED_FIELD',
          title: 'Audit Log Missing ID',
          message: 'An audit log record is missing an ID.',
          entity: 'AuditLog',
          recordId: 'unknown',
          detectedAt,
        });
        continue;
      }

      if (auditSeenIds.has(log.id)) {
        results.push({
          id: makeCheckId('audit_dup_id'),
          category: 'AUDIT_TRAIL',
          severity: 'ERROR',
          code: 'DUPLICATE_AUDIT_ID',
          title: 'Duplicate Audit Log ID',
          message: `Multiple audit log entries share identical ID "${log.id}".`,
          entity: 'AuditLog',
          recordId: log.id,
          detectedAt,
        });
      }
      auditSeenIds.add(log.id);

      const refType = log.referenceType || log.entityType;
      const refId = log.referenceId || log.entityId;

      if (!refType || !refId) {
        results.push({
          id: makeCheckId('audit_invalid_ref'),
          category: 'AUDIT_TRAIL',
          severity: 'WARN',
          code: 'INVALID_AUDIT_REFERENCE',
          title: 'Invalid Audit Reference',
          message: `Audit log "${log.id}" is missing referenceType or referenceId.`,
          entity: 'AuditLog',
          recordId: log.id,
          detectedAt,
        });
      } else if (refId !== 'system' && refType !== 'SYSTEM') {
        let exists = true;
        if (refType === 'SALE') exists = saleIdSet.has(refId);
        else if (refType === 'PURCHASE') exists = purchaseIdSet.has(refId);
        else if (refType === 'TRANSACTION') exists = transactionIdSet.has(refId);
        else if (refType === 'PRODUCT') exists = productIdSet.has(refId);
        else if (refType === 'SUPPLIER') exists = supIdSet.has(refId);
        else if (refType === 'MERCHANT') exists = merchIdSet.has(refId);
        else if (refType === 'RETURN') exists = returnIdSet.has(refId);
        else if (refType === 'DAILY_CLOSING') exists = dailyClosingIdSet.has(refId);

        if (!exists && !delIdSet.has(refId)) {
          results.push({
            id: makeCheckId('audit_orphan_ref'),
            category: 'AUDIT_TRAIL',
            severity: 'WARN',
            code: 'ORPHAN_AUDIT_REFERENCE',
            title: 'Orphan Audit Reference',
            message: `Audit log "${log.id}" references non-existent ${refType} record "${refId}".`,
            entity: 'AuditLog',
            recordId: log.id,
            relatedRecordIds: [refId],
            detectedAt,
          });
        }
      }

      // Reversal & Correction traceability links
      const isReversal =
        log.actionType === 'REVERSAL' ||
        (log.action || '').toUpperCase().includes('REVERSAL') ||
        (log.action || '').toUpperCase().includes('CANCEL');
      const isCorrection =
        log.actionType === 'DAILY_CLOSING_CORRECTION' ||
        (log.action || '').toUpperCase().includes('CLOSING_CORRECT') ||
        (log.action || '').toUpperCase().includes('REOPEN');

      if (isReversal || isCorrection) {
        const meta = log.metadata || {};
        const hasLink =
          meta.reversalOf ||
          meta.originalSaleId ||
          meta.originalRecordId ||
          meta.originalVoucherNo ||
          meta.originalAuditId ||
          (log.referenceId && log.referenceId !== 'system') ||
          (log.entityId && log.entityId !== 'system');
        if (!hasLink) {
          results.push({
            id: makeCheckId('audit_missing_rev_link'),
            category: 'AUDIT_TRAIL',
            severity: 'WARN',
            code: 'MISSING_REVERSAL_LINK',
            title: 'Missing Reversal / Correction Link',
            message: `Reversal or correction audit log "${log.id}" does not specify an original target record or reversal link.`,
            entity: 'AuditLog',
            recordId: log.id,
            detectedAt,
          });
        }
      }
    }

    // -------------------------------------------------------------
    // K: Backup & Safety Snapshots Health
    // -------------------------------------------------------------
    try {
      let lastBackupStr: string | null = null;
      if (typeof localStorage !== 'undefined') {
        lastBackupStr = localStorage.getItem('ledger_last_backup_v2');
      }

      if (lastBackupStr) {
        const lastBackupEpoch = Date.parse(lastBackupStr);
        if (isNaN(lastBackupEpoch)) {
          results.push({
            id: makeCheckId('bk_meta_corrupt'),
            category: 'BACKUP',
            severity: 'WARN',
            code: 'INVALID_BACKUP_METADATA',
            title: 'Malformed Backup Metadata',
            message: `Recorded last backup date "${lastBackupStr}" could not be parsed into a valid timestamp.`,
            detectedAt,
          });
        } else {
          const ageHours = (nowEpoch - lastBackupEpoch) / (1000 * 60 * 60);
          const ageDays = ageHours / 24;
          if (ageDays > 7) {
            results.push({
              id: makeCheckId('bk_stale'),
              category: 'BACKUP',
              severity: 'WARN',
              code: 'STALE_BACKUP_METADATA',
              title: 'Backup Overdue (> 7 Days)',
              message: `Last exported backup was ${Math.floor(ageDays)} days ago (${new Date(lastBackupEpoch).toLocaleDateString()}). A fresh manual backup is recommended.`,
              detectedAt,
            });
          } else {
            results.push({
              id: makeCheckId('bk_ok'),
              category: 'BACKUP',
              severity: 'PASS',
              code: 'RECENT_BACKUP_VERIFIED',
              title: 'Recent Backup Present',
              message: `Recent backup verified within ${Math.max(1, Math.round(ageHours))} hours.`,
              detectedAt,
            });
          }
        }
      } else {
        results.push({
          id: makeCheckId('bk_none'),
          category: 'BACKUP',
          severity: 'INFO',
          code: 'NO_BACKUP_METADATA',
          title: 'No Prior Export Record',
          message: 'No manual backup export record found in local storage. Regular offline backups are recommended.',
          detectedAt,
        });
      }

      // Snapshot health
      if (recoverySnapshots.length === 0) {
        results.push({
          id: makeCheckId('snap_zero'),
          category: 'BACKUP',
          severity: 'INFO',
          code: 'NO_SAFETY_SNAPSHOTS',
          title: 'No Safety Snapshots Found',
          message: 'No auto-recovery snapshots are currently saved in IndexedDB.',
          detectedAt,
        });
      } else {
        results.push({
          id: makeCheckId('snap_ok'),
          category: 'BACKUP',
          severity: 'PASS',
          code: 'SAFETY_SNAPSHOTS_AVAILABLE',
          title: 'Safety Snapshots Active',
          message: `${recoverySnapshots.length} auto-recovery rollback snapshots available in IndexedDB.`,
          detectedAt,
        });
      }
    } catch (e: any) {
      results.push({
        id: makeCheckId('bk_check_err'),
        category: 'BACKUP',
        severity: 'WARN',
        code: 'BACKUP_HEALTH_CHECK_ERROR',
        title: 'Backup Health Check Exception',
        message: `Failed to inspect backup metadata: ${e?.message || e}`,
        detectedAt,
      });
    }
  }

  // -------------------------------------------------------------
  // Aggregate Health Summary Calculation
  // -------------------------------------------------------------
  const summaryByCategory: DatabaseHealthReport['summaryByCategory'] = {
    DATABASE: { total: 0, pass: 0, info: 0, warn: 0, error: 0, critical: 0 },
    DATA_INTEGRITY: { total: 0, pass: 0, info: 0, warn: 0, error: 0, critical: 0 },
    REFERENCES: { total: 0, pass: 0, info: 0, warn: 0, error: 0, critical: 0 },
    FINANCIAL: { total: 0, pass: 0, info: 0, warn: 0, error: 0, critical: 0 },
    STOCK: { total: 0, pass: 0, info: 0, warn: 0, error: 0, critical: 0 },
    ATTACHMENTS: { total: 0, pass: 0, info: 0, warn: 0, error: 0, critical: 0 },
    BACKUP: { total: 0, pass: 0, info: 0, warn: 0, error: 0, critical: 0 },
  };

  let passedChecks = 0;
  let infoCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let criticalCount = 0;

  for (const r of results) {
    const cat = summaryByCategory[r.category] || summaryByCategory.DATA_INTEGRITY;
    cat.total += 1;

    switch (r.severity) {
      case 'PASS':
        passedChecks += 1;
        cat.pass += 1;
        break;
      case 'INFO':
        infoCount += 1;
        cat.info += 1;
        break;
      case 'WARN':
        warningCount += 1;
        cat.warn += 1;
        break;
      case 'ERROR':
        errorCount += 1;
        cat.error += 1;
        break;
      case 'CRITICAL':
        criticalCount += 1;
        cat.critical += 1;
        break;
    }
  }

  // Determine overall status according to strict Phase 12 specification
  let overallStatus: HealthOverallStatus = 'HEALTHY';
  if (criticalCount > 0) {
    overallStatus = 'CRITICAL';
  } else if (errorCount > 0) {
    overallStatus = 'DEGRADED';
  } else if (warningCount > 0) {
    overallStatus = 'ATTENTION';
  } else {
    overallStatus = 'HEALTHY';
  }

  // Retrieve Storage Estimate
  const storageEstimate = await getStorageEstimate();
  const durationMs = Math.max(1, Date.now() - startTime);

  return {
    appVersion: CURRENT_APP_VERSION,
    databaseName: dbName,
    databaseSchemaVersion: schemaVerno,
    generatedAt: detectedAt,
    durationMs,
    overallStatus,
    totalChecks: results.length,
    passedChecks,
    infoCount,
    warningCount,
    errorCount,
    criticalCount,
    tableCounts,
    storageEstimate,
    summaryByCategory,
    results,
  };
}

/**
 * Requirement 5: Diagnostic Report Export Serialization
 * Strictly sanitizes output: NEVER includes PIN, recovery key, salts, hashes, or credentials!
 */
export function exportDiagnosticReportJSON(report: DatabaseHealthReport): string {
  // Deep clone and clean results to strip any accidental sensitive keys
  const sanitizedReport = {
    diagnosticReportVersion: '1.0',
    appVersion: report.appVersion,
    databaseName: report.databaseName,
    databaseSchemaVersion: report.databaseSchemaVersion,
    generatedAt: report.generatedAt,
    durationMs: report.durationMs,
    overallStatus: report.overallStatus,
    summary: {
      totalChecks: report.totalChecks,
      passedChecks: report.passedChecks,
      infoCount: report.infoCount,
      warningCount: report.warningCount,
      errorCount: report.errorCount,
      criticalCount: report.criticalCount,
    },
    tableCounts: report.tableCounts,
    storageEstimate: report.storageEstimate,
    summaryByCategory: report.summaryByCategory,
    issues: report.results
      .filter((r) => r.severity !== 'PASS')
      .map((r) => ({
        id: r.id,
        category: r.category,
        severity: r.severity,
        code: r.code,
        title: r.title,
        message: r.message,
        entity: r.entity,
        recordId: r.recordId,
        relatedRecordIds: r.relatedRecordIds,
        details: r.details,
        detectedAt: r.detectedAt,
      })),
  };

  return JSON.stringify(sanitizedReport, null, 2);
}

/**
 * Generate CSV format diagnostic report
 */
export function exportDiagnosticReportCSV(report: DatabaseHealthReport): string {
  const headers = ['Category', 'Severity', 'Code', 'Title', 'Entity', 'Record ID', 'Message', 'Detected At'];
  const rows: string[][] = [headers];

  for (const r of report.results) {
    rows.push([
      `"${r.category}"`,
      `"${r.severity}"`,
      `"${r.code}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.entity || '').replace(/"/g, '""')}"`,
      `"${(r.recordId || '').replace(/"/g, '""')}"`,
      `"${(r.message || '').replace(/"/g, '""')}"`,
      `"${r.detectedAt}"`,
    ]);
  }

  return rows.map((r) => r.join(',')).join('\n');
}

/**
 * Trigger offline browser download of diagnostic report
 */
export function downloadDiagnosticReport(
  report: DatabaseHealthReport,
  format: 'json' | 'csv' = 'json'
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
  const fileName = `ShweLetYar_DB_Diagnostics_${report.overallStatus}_${dateStr}_${timeStr}.${format}`;

  const content = format === 'json' ? exportDiagnosticReportJSON(report) : exportDiagnosticReportCSV(report);
  const mime = format === 'json' ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;';

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
