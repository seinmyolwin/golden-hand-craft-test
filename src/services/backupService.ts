import { db, ShweLetYarDatabase } from '../db/database';
import { blobToBase64, processImageInput, base64ToBlob } from './attachmentService';
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
  SoftDeletedItem,
  AuditLogEntry,
  RawMaterialPreset,
  ShopSettings,
  AppLockSettings,
  BackupReminderSettings,
  AttachmentRecord,
  AutoRecoverySnapshot,
  VersionedBackupFile,
  BackupDataPayload,
  BackupMetadata,
  BackupValidationReport,
  BackupValidationError,
  BackupValidationWarning,
  EntityComparisonCount,
} from '../types';
import {
  getStoredShopSettings,
  saveStoredShopSettings,
  getStoredAppLockSettings,
  saveStoredAppLockSettings,
  getStoredBackupReminderSettings,
  saveStoredBackupReminderSettings,
  getStoredProductCategories,
  saveStoredProductCategories,
  getStoredRawMaterialCategories,
  saveStoredRawMaterialCategories,
  getStoredRawMaterialPresets,
  saveStoredRawMaterialPresets,
  saveFileWithLocationPrompt,
  DEFAULT_SHOP_SETTINGS,
} from '../utils/storage';
import { generateStableId } from '../utils/idGenerator';

export const CURRENT_BACKUP_FORMAT_VERSION = '3.0';
export const CURRENT_APP_VERSION = '2.5.0';
export const CURRENT_DATABASE_SCHEMA_VERSION = 3;

/**
 * Computes a deterministic SHA-256 hash or fallback checksum of a string
 */
export async function computeChecksum(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const msgBuffer = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Stable polynomial checksum fallback
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return `crc32_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Generates a full, versioned backup payload from the Dexie database
 */
export async function createCompleteBackup(options?: {
  customNotes?: string;
  shopSettings?: ShopSettings;
}): Promise<VersionedBackupFile> {
  // 1. Fetch all datasets from Dexie IndexedDB tables
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
    auditLogs,
    rawMaterialPresets,
    attachments,
  ] = await Promise.all([
    db.products.toArray(),
    db.suppliers.toArray(),
    db.merchants.toArray(),
    db.transactions.toArray(),
    db.sales.toArray(),
    db.merchantPurchases.toArray(),
    db.orders.toArray(),
    db.stockAdjustments.toArray(),
    db.peerTrades.toArray(),
    db.softDeletedItems.toArray(),
    db.auditLogs.toArray(),
    db.rawMaterialPresets.toArray(),
    db.attachments.toArray(),
  ]);

  const shopSettings = options?.shopSettings || getStoredShopSettings();
  const rawAppLock = getStoredAppLockSettings();
  const appLockSettings: AppLockSettings = { ...rawAppLock };
  delete appLockSettings.passcode;
  delete appLockSettings.pin;
  delete appLockSettings.recoveryKey;
  delete appLockSettings.hint;
  delete appLockSettings.recoveryQuestion;
  delete appLockSettings.recoveryAnswer;
  const backupReminderSettings = getStoredBackupReminderSettings();
  const productCategories = getStoredProductCategories();
  const rawMaterialCategories = getStoredRawMaterialCategories();
  const presetsFromStore = rawMaterialPresets.length > 0 ? rawMaterialPresets : getStoredRawMaterialPresets();

  // Find date range
  const allDates: string[] = [];
  transactions.forEach((t) => t.date && allDates.push(t.date));
  sales.forEach((s) => s.date && allDates.push(s.date));
  merchantPurchases.forEach((p) => p.date && allDates.push(p.date));
  orders.forEach((o) => (o.date || o.orderDate) && allDates.push(o.date || o.orderDate || ''));
  const validDates = allDates.filter(Boolean).sort();
  const dateRange = validDates.length > 0
    ? { earliest: validDates[0], latest: validDates[validDates.length - 1] }
    : undefined;

  const totalRecords =
    products.length +
    suppliers.length +
    merchants.length +
    transactions.length +
    sales.length +
    merchantPurchases.length +
    orders.length +
    stockAdjustments.length +
    peerTrades.length +
    softDeletedItems.length +
    auditLogs.length +
    presetsFromStore.length +
    attachments.length;

  const metadata: BackupMetadata = {
    shopName: shopSettings.shopName || 'ရွှေလက်ရာ',
    shopOwner: shopSettings.ownerName,
    appName: 'Shwe Let Yar POS & Craft Ledger',
    totalRecords,
    counts: {
      products: products.length,
      suppliers: suppliers.length,
      merchants: merchants.length,
      transactions: transactions.length,
      sales: sales.length,
      merchantPurchases: merchantPurchases.length,
      orders: orders.length,
      stockAdjustments: stockAdjustments.length,
      peerTrades: peerTrades.length,
      softDeletedItems: softDeletedItems.length,
      auditLogs: auditLogs.length,
      rawMaterialPresets: presetsFromStore.length,
      attachments: attachments.length,
    },
    dateRange,
    customNotes: options?.customNotes,
  };

  const serializableAttachments: AttachmentRecord[] = await Promise.all(
    attachments.map(async (att) => {
      let imageBase64 = att.imageBase64 || '';
      if (!imageBase64 && att.blob) {
        imageBase64 = await blobToBase64(att.blob);
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

  const data: BackupDataPayload = {
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
    auditLogs,
    rawMaterialPresets: presetsFromStore,
    shopSettings,
    appLockSettings,
    backupReminderSettings,
    productCategories,
    rawMaterialCategories,
    attachments: serializableAttachments,
  };

  const dataPayloadString = JSON.stringify(data);
  const checksum = await computeChecksum(dataPayloadString);

  return {
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    appVersion: CURRENT_APP_VERSION,
    exportedAt: new Date().toISOString(),
    databaseSchemaVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    checksum,
    metadata,
    data,
  };
}

/**
 * Exports and downloads the backup file to disk with filename formatting
 */
export async function downloadBackupFile(
  backup: VersionedBackupFile,
  useLocationPicker: boolean = false
): Promise<{ success: boolean; method: 'picker' | 'download'; fileName: string }> {
  const shopNameClean = (backup.metadata.shopName || 'ShweLetYar')
    .trim()
    .replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_');
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `Shwe_let_yar_doc_${shopNameClean}_Backup_${dateStr}_${timeStr}.json`;

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

  // Update last backup timestamp
  try {
    const backupReminder = getStoredBackupReminderSettings();
    saveStoredBackupReminderSettings({
      ...backupReminder,
      lastDismissedDate: dateStr,
    });
    localStorage.setItem('ledger_last_backup_v2', new Date().toISOString());
  } catch (e) {
    console.error('Failed to update last backup date', e);
  }

  if (useLocationPicker) {
    return saveFileWithLocationPrompt(blob, fileName, [
      {
        description: 'Shwe Let Yar JSON Backup (*.json)',
        accept: { 'application/json': ['.json'] },
      },
    ]);
  }

  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = fileName;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { success: true, method: 'download', fileName };
}

/**
 * Normalizes any format of backup (v3.0, v2.0, legacy flat JSON) into standard BackupDataPayload
 */
export function normalizeRawBackup(raw: any): {
  normalized: BackupDataPayload;
  metadata: BackupMetadata;
  formatVersion: string;
  checksum?: string;
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON: Root element is not an object.');
  }

  let formatVersion = '1.0';
  let checksum = raw.checksum;
  let rawData: any = raw;

  if (raw.formatVersion === '3.0' && raw.data) {
    formatVersion = '3.0';
    rawData = raw.data;
  } else if (raw.version === '2.0' || raw.formatVersion === '2.0') {
    formatVersion = '2.0';
    rawData = raw.data || raw;
  }

  const products: Product[] = Array.isArray(rawData.products) ? rawData.products : [];
  const suppliers: Supplier[] = Array.isArray(rawData.suppliers) ? rawData.suppliers : [];
  const merchants: Merchant[] = Array.isArray(rawData.merchants) ? rawData.merchants : [];
  const transactions: TransactionRecord[] = Array.isArray(rawData.transactions) ? rawData.transactions : [];
  const sales: SaleRecord[] = Array.isArray(rawData.sales) ? rawData.sales : [];
  const merchantPurchases: MerchantPurchaseRecord[] = Array.isArray(rawData.merchantPurchases) ? rawData.merchantPurchases : [];
  const orders: MerchantOrder[] = Array.isArray(rawData.orders || rawData.merchantOrders) ? (rawData.orders || rawData.merchantOrders) : [];
  const stockAdjustments: StockAdjustmentRecord[] = Array.isArray(rawData.stockAdjustments) ? rawData.stockAdjustments : [];
  const peerTrades: PeerTradeRecord[] = Array.isArray(rawData.peerTrades) ? rawData.peerTrades : [];
  const softDeletedItems: SoftDeletedItem[] = Array.isArray(rawData.softDeletedItems || rawData.deletedItems) ? (rawData.softDeletedItems || rawData.deletedItems) : [];
  const auditLogs: AuditLogEntry[] = Array.isArray(rawData.auditLogs) ? rawData.auditLogs : [];
  const rawMaterialPresets: RawMaterialPreset[] = Array.isArray(rawData.rawMaterialPresets || rawData.rawMaterials) ? (rawData.rawMaterialPresets || rawData.rawMaterials) : [];
  const attachments: AttachmentRecord[] = Array.isArray(rawData.attachments) ? rawData.attachments : [];

  const shopSettings: ShopSettings = {
    ...DEFAULT_SHOP_SETTINGS,
    ...(rawData.shopSettings || raw.shopSettings || {}),
  };

  const appLockSettings = rawData.appLockSettings || raw.appLockSettings;
  const backupReminderSettings = rawData.backupReminderSettings || raw.backupReminderSettings;
  const productCategories = Array.isArray(rawData.productCategories) ? rawData.productCategories : undefined;
  const rawMaterialCategories = Array.isArray(rawData.rawMaterialCategories) ? rawData.rawMaterialCategories : undefined;

  const totalRecords =
    products.length +
    suppliers.length +
    merchants.length +
    transactions.length +
    sales.length +
    merchantPurchases.length +
    orders.length +
    stockAdjustments.length +
    peerTrades.length +
    softDeletedItems.length +
    auditLogs.length +
    rawMaterialPresets.length +
    attachments.length;

  const counts = {
    products: products.length,
    suppliers: suppliers.length,
    merchants: merchants.length,
    transactions: transactions.length,
    sales: sales.length,
    merchantPurchases: merchantPurchases.length,
    orders: orders.length,
    stockAdjustments: stockAdjustments.length,
    peerTrades: peerTrades.length,
    softDeletedItems: softDeletedItems.length,
    auditLogs: auditLogs.length,
    rawMaterialPresets: rawMaterialPresets.length,
    attachments: attachments.length,
  };

  const allDates: string[] = [];
  transactions.forEach((t) => t.date && allDates.push(t.date));
  sales.forEach((s) => s.date && allDates.push(s.date));
  merchantPurchases.forEach((p) => p.date && allDates.push(p.date));
  orders.forEach((o) => (o.date || o.orderDate) && allDates.push(o.date || o.orderDate || ''));
  const validDates = allDates.filter(Boolean).sort();
  const dateRange = validDates.length > 0
    ? { earliest: validDates[0], latest: validDates[validDates.length - 1] }
    : undefined;

  const metadata: BackupMetadata = {
    shopName: shopSettings.shopName || raw.metadata?.shopName || 'ရွှေလက်ရာ',
    shopOwner: shopSettings.ownerName || raw.metadata?.shopOwner,
    appName: raw.metadata?.appName || 'Shwe Let Yar POS & Craft Ledger',
    totalRecords: raw.metadata?.totalRecords || totalRecords,
    counts: raw.metadata?.counts || counts,
    dateRange: raw.metadata?.dateRange || dateRange,
    customNotes: raw.metadata?.customNotes,
  };

  const normalized: BackupDataPayload = {
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
    auditLogs,
    rawMaterialPresets,
    shopSettings,
    appLockSettings: (() => {
      if (!appLockSettings) return undefined;
      const clean = { ...appLockSettings };
      delete clean.passcode;
      delete clean.pin;
      delete clean.recoveryKey;
      delete clean.hint;
      delete clean.recoveryQuestion;
      delete clean.recoveryAnswer;
      return clean;
    })(),
    backupReminderSettings,
    productCategories,
    rawMaterialCategories,
    attachments,
  };

  return { normalized, metadata, formatVersion, checksum };
}

/**
 * Validates the backup JSON with deep schema, data type, integrity, and comparison checks
 */
export async function validateBackupFile(rawJsonStringOrObject: string | any): Promise<BackupValidationReport> {
  const errors: BackupValidationError[] = [];
  const warnings: BackupValidationWarning[] = [];

  let parsedObj: any;
  if (typeof rawJsonStringOrObject === 'string') {
    try {
      parsedObj = JSON.parse(rawJsonStringOrObject);
    } catch (e: any) {
      return {
        isValid: false,
        isCorrupted: true,
        formatVersion: 'UNKNOWN',
        detectedSchemaVersion: 0,
        checksumValid: false,
        exportedAt: '',
        shopName: '',
        appName: '',
        totalRecords: 0,
        errors: [
          {
            field: 'JSON',
            message: `ဖိုင်ဖတ်ရှု၍ မရပါ (Corrupted JSON Syntax): ${e.message}`,
            code: 'JSON_SYNTAX_ERROR',
            severity: 'FATAL',
          },
        ],
        warnings: [],
        counts: {
          products: 0,
          suppliers: 0,
          merchants: 0,
          transactions: 0,
          sales: 0,
          merchantPurchases: 0,
          orders: 0,
          stockAdjustments: 0,
          peerTrades: 0,
          softDeletedItems: 0,
          auditLogs: 0,
          rawMaterialPresets: 0,
          attachments: 0,
        },
      };
    }
  } else {
    parsedObj = rawJsonStringOrObject;
  }

  if (!parsedObj || typeof parsedObj !== 'object') {
    return {
      isValid: false,
      isCorrupted: true,
      formatVersion: 'UNKNOWN',
      detectedSchemaVersion: 0,
      checksumValid: false,
      exportedAt: '',
      shopName: '',
      appName: '',
      totalRecords: 0,
      errors: [
        {
          field: 'root',
          message: 'ဒေတာဖိုင်၏ Root structure မမှန်ကန်ပါ (Empty or non-object content)',
          code: 'INVALID_ROOT',
          severity: 'FATAL',
        },
      ],
      warnings: [],
      counts: {
        products: 0,
        suppliers: 0,
        merchants: 0,
        transactions: 0,
        sales: 0,
        merchantPurchases: 0,
        orders: 0,
        stockAdjustments: 0,
        peerTrades: 0,
        softDeletedItems: 0,
        auditLogs: 0,
        rawMaterialPresets: 0,
        attachments: 0,
      },
    };
  }

  let normalized: BackupDataPayload;
  let metadata: BackupMetadata;
  let formatVersion: string;
  let checksum: string | undefined;

  try {
    const result = normalizeRawBackup(parsedObj);
    normalized = result.normalized;
    metadata = result.metadata;
    formatVersion = result.formatVersion;
    checksum = result.checksum;
  } catch (e: any) {
    errors.push({
      field: 'normalization',
      message: `ဒေတာများကို ပုံစံညှိယူရာတွင် ချို့ယွင်းချက်ရှိပါသည်: ${e.message}`,
      code: 'NORMALIZATION_FAILED',
      severity: 'FATAL',
    });
    return {
      isValid: false,
      isCorrupted: true,
      formatVersion: 'UNKNOWN',
      detectedSchemaVersion: 0,
      checksumValid: false,
      exportedAt: '',
      shopName: '',
      appName: '',
      totalRecords: 0,
      errors,
      warnings,
      counts: {
        products: 0,
        suppliers: 0,
        merchants: 0,
        transactions: 0,
        sales: 0,
        merchantPurchases: 0,
        orders: 0,
        stockAdjustments: 0,
        peerTrades: 0,
        softDeletedItems: 0,
        auditLogs: 0,
        rawMaterialPresets: 0,
        attachments: 0,
      },
    };
  }

  // 1. Checksum validation (if v3.0 has checksum)
  let checksumValid = true;
  if (formatVersion === '3.0' && checksum && parsedObj.data) {
    const calculatedChecksum = await computeChecksum(JSON.stringify(parsedObj.data));
    if (calculatedChecksum !== checksum) {
      checksumValid = false;
      warnings.push({
        field: 'checksum',
        message: 'ဖိုင်အတွင်း အချက်အလက်များ ပြင်ဆင်ခံထားရနိုင်သည် (Checksum mismatch, continuing with deep field validation)',
        code: 'CHECKSUM_MISMATCH',
      });
    }
  }

  // 2. Format / Schema version checking
  const detectedSchemaVersion = parsedObj.databaseSchemaVersion || (formatVersion === '3.0' ? 3 : formatVersion === '2.0' ? 2 : 1);
  if (detectedSchemaVersion > CURRENT_DATABASE_SCHEMA_VERSION) {
    warnings.push({
      field: 'databaseSchemaVersion',
      message: `ဖိုင်သည် ပိုမိုမြင့်မားသော ဒေတာဘေ့စ်ဗားရှင်း (v${detectedSchemaVersion}) ဖြင့် ထုတ်ယူထားပါသည်`,
      code: 'NEWER_SCHEMA_VERSION',
    });
  }

  // 3. Products validation
  const productIdSet = new Set<string>();
  const productDuplicateIds: string[] = [];
  normalized.products.forEach((p, idx) => {
    if (!p.id || typeof p.id !== 'string') {
      errors.push({
        field: `products[${idx}].id`,
        message: `ကုန်ပစ္စည်းအမှတ် (${idx + 1}) တွင် ID မပါရှိပါ`,
        code: 'MISSING_PRODUCT_ID',
        severity: 'ERROR',
      });
    } else {
      if (productIdSet.has(p.id)) {
        productDuplicateIds.push(p.id);
      }
      productIdSet.add(p.id);
    }
    if (!p.name || typeof p.name !== 'string') {
      errors.push({
        field: `products[${idx}].name`,
        message: `ကုန်ပစ္စည်း ID: ${p.id || idx} တွင် ကုန်ပစ္စည်းအမည် မပါရှိပါ`,
        code: 'MISSING_PRODUCT_NAME',
        severity: 'ERROR',
      });
    }
    if (typeof p.defaultPrice !== 'number' || isNaN(p.defaultPrice) || p.defaultPrice < 0) {
      warnings.push({
        field: `products[${idx}].defaultPrice`,
        message: `ကုန်ပစ္စည်း "${p.name || p.id}" ၏ စျေးနှုန်း (${p.defaultPrice}) သည် မမှန်ကန်ပါ`,
        code: 'INVALID_PRICE',
      });
    }
    if (typeof p.currentStock === 'number' && p.currentStock < 0) {
      warnings.push({
        field: `products[${idx}].currentStock`,
        message: `ကုန်ပစ္စည်း "${p.name || p.id}" ၏ လက်ကျန်စတော့ (${p.currentStock}) သည် အနှုတ်ဖြစ်နေပါသည်`,
        code: 'NEGATIVE_STOCK',
      });
    }
  });

  if (productDuplicateIds.length > 0) {
    warnings.push({
      field: 'products.duplicateIds',
      message: `ထပ်နေသော ကုန်ပစ္စည်း ID ${productDuplicateIds.length} ခု တွေ့ရှိရပြီး Restore ပြုလုပ်ချိန်တွင် Auto-deduplicate ပြုလုပ်ပါမည်`,
      code: 'DUPLICATE_PRODUCT_IDS',
    });
  }

  // Helper to check duplicate IDs across collections
  const checkDuplicateEntityIds = <T extends { id?: string }>(
    items: T[],
    entityKey: string,
    entityTitle: string
  ) => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    items.forEach((item) => {
      if (item.id) {
        if (seen.has(item.id)) dupes.push(item.id);
        seen.add(item.id);
      }
    });
    if (dupes.length > 0) {
      warnings.push({
        field: `${entityKey}.duplicateIds`,
        message: `ထပ်နေသော ${entityTitle} ID ${dupes.length} ခု တွေ့ရှိရပြီး Auto-deduplicate ပြုလုပ်ပါမည်`,
        code: `DUPLICATE_${entityKey.toUpperCase()}_IDS`,
      });
    }
  };

  // 4. Suppliers validation & duplicate check
  const supplierIdSet = new Set<string>();
  checkDuplicateEntityIds(normalized.suppliers, 'suppliers', 'ကုန်ကြမ်းပေးသွင်းသူ');
  normalized.suppliers.forEach((s, idx) => {
    if (!s.id || typeof s.id !== 'string') {
      errors.push({
        field: `suppliers[${idx}].id`,
        message: `ကုန်ပစ္စည်းပေးသွင်းသူအမှတ် (${idx + 1}) တွင် ID မပါရှိပါ`,
        code: 'MISSING_SUPPLIER_ID',
        severity: 'ERROR',
      });
    } else {
      supplierIdSet.add(s.id);
    }
    if (!s.name || typeof s.name !== 'string') {
      errors.push({
        field: `suppliers[${idx}].name`,
        message: `ပေးသွင်းသူ ID: ${s.id || idx} တွင် အမည် မပါရှိပါ`,
        code: 'MISSING_SUPPLIER_NAME',
        severity: 'ERROR',
      });
    }
  });

  // 5. Merchants validation & duplicate check
  const merchantIdSet = new Set<string>();
  checkDuplicateEntityIds(normalized.merchants, 'merchants', 'ကုန်သည်');
  normalized.merchants.forEach((m, idx) => {
    if (!m.id || typeof m.id !== 'string') {
      errors.push({
        field: `merchants[${idx}].id`,
        message: `ကုန်သည်အမှတ် (${idx + 1}) တွင် ID မပါရှိပါ`,
        code: 'MISSING_MERCHANT_ID',
        severity: 'ERROR',
      });
    } else {
      merchantIdSet.add(m.id);
    }
    if (!m.name || typeof m.name !== 'string') {
      errors.push({
        field: `merchants[${idx}].name`,
        message: `ကုန်သည် ID: ${m.id || idx} တွင် အမည် မပါရှိပါ`,
        code: 'MISSING_MERCHANT_NAME',
        severity: 'ERROR',
      });
    }
  });

  // 6. Transactions validation & item product reference / financial checks
  const txIdSet = new Set<string>();
  let orphanTxSuppliers = 0;
  checkDuplicateEntityIds(normalized.transactions, 'transactions', 'ကုန်သိမ်းဘောင်ချာ');
  normalized.transactions.forEach((tx, idx) => {
    if (!tx.id || typeof tx.id !== 'string') {
      errors.push({
        field: `transactions[${idx}].id`,
        message: `ကုန်သိမ်းဘောင်ချာအမှတ် (${idx + 1}) တွင် ID မပါရှိပါ`,
        code: 'MISSING_TX_ID',
        severity: 'ERROR',
      });
    } else {
      txIdSet.add(tx.id);
    }
    if (tx.supplierId && !supplierIdSet.has(tx.supplierId)) {
      orphanTxSuppliers++;
    }
    if (!tx.date || !/^\d{4}-\d{2}-\d{2}/.test(tx.date)) {
      warnings.push({
        field: `transactions[${idx}].date`,
        message: `ဘောင်ချာ (${tx.voucherNo || tx.id}) တွင် ရက်စွဲ (${tx.date}) ပုံစံမမှန်ပါ`,
        code: 'INVALID_TX_DATE',
      });
    }
    if (tx.items && Array.isArray(tx.items)) {
      tx.items.forEach((item, itemIdx) => {
        if (item.productId && !productIdSet.has(item.productId)) {
          warnings.push({
            field: `transactions[${idx}].items[${itemIdx}].productId`,
            message: `ကုန်သိမ်းဘောင်ချာ (${tx.voucherNo || tx.id}) ရှိ ပစ္စည်း ID ${item.productId} သည် ပစ္စည်းစာရင်းတွင် မရှိပါ`,
            code: 'MISSING_PRODUCT_REFERENCE',
          });
        }
        if (typeof item.quantity === 'number' && item.quantity <= 0) {
          warnings.push({
            field: `transactions[${idx}].items[${itemIdx}].quantity`,
            message: `ကုန်သိမ်းဘောင်ချာ (${tx.voucherNo || tx.id}) ရှိ ပစ္စည်း အရေအတွက် မမှန်ကန်ပါ`,
            code: 'INVALID_QUANTITY',
          });
        }
      });
    }
    if (typeof tx.totalGoodsValue === 'number' && tx.totalGoodsValue < 0) {
      warnings.push({
        field: `transactions[${idx}].totalGoodsValue`,
        message: `ကုန်သိမ်းဘောင်ချာ (${tx.voucherNo || tx.id}) ၏ တန်ဖိုး အနှုတ်ဖြစ်နေပါသည်`,
        code: 'INVALID_FINANCIAL_TOTAL',
      });
    }
  });

  if (orphanTxSuppliers > 0) {
    warnings.push({
      field: 'transactions.orphanSuppliers',
      message: `ကုန်သိမ်းဘောင်ချာ ${orphanTxSuppliers} စောင်သည် စာရင်းမရှိသော ပေးသွင်းသူ ID နှင့် ချိတ်ဆက်နေပါသည် (အမည်ဖြင့် အလိုအလျောက် ပေါင်းစပ်ပါမည်)`,
      code: 'ORPHAN_TX_SUPPLIERS',
    });
  }

  // 7. Sales validation & item product reference / financial relationship checks
  const saleIdSet = new Set<string>();
  let orphanSaleMerchants = 0;
  checkDuplicateEntityIds(normalized.sales, 'sales', 'အရောင်းဘောင်ချာ');
  normalized.sales.forEach((sale, idx) => {
    if (!sale.id || typeof sale.id !== 'string') {
      errors.push({
        field: `sales[${idx}].id`,
        message: `အရောင်းဘောင်ချာအမှတ် (${idx + 1}) တွင် ID မပါရှိပါ`,
        code: 'MISSING_SALE_ID',
        severity: 'ERROR',
      });
    } else {
      saleIdSet.add(sale.id);
    }
    if (sale.merchantId && !merchantIdSet.has(sale.merchantId)) {
      orphanSaleMerchants++;
    }
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item, itemIdx) => {
        if (item.productId && !productIdSet.has(item.productId)) {
          warnings.push({
            field: `sales[${idx}].items[${itemIdx}].productId`,
            message: `အရောင်းဘောင်ချာ (${sale.voucherNo || sale.id}) ရှိ ပစ္စည်း ID ${item.productId} သည် ပစ္စည်းစာရင်းတွင် မရှိပါ`,
            code: 'MISSING_PRODUCT_REFERENCE',
          });
        }
        if (typeof item.quantity === 'number' && item.quantity <= 0) {
          warnings.push({
            field: `sales[${idx}].items[${itemIdx}].quantity`,
            message: `အရောင်းဘောင်ချာ (${sale.voucherNo || sale.id}) ရှိ ပစ္စည်း အရေအတွက် မမှန်ကန်ပါ`,
            code: 'INVALID_QUANTITY',
          });
        }
      });
    }
    if (
      typeof sale.grandTotal === 'number' &&
      typeof sale.cashPaidByMerchant === 'number' &&
      typeof sale.remainingReceivableBalance === 'number'
    ) {
      const calcBalance = sale.cashPaidByMerchant + sale.remainingReceivableBalance;
      if (Math.abs(sale.grandTotal - calcBalance) > 1) {
        warnings.push({
          field: `sales[${idx}].grandTotal`,
          message: `အရောင်းဘောင်ချာ (${sale.voucherNo || sale.id}) ၏ စုစုပေါင်း ငွေပမာဏ မကိုက်ညီပါ (GrandTotal: ${sale.grandTotal}, Paid+Balance: ${calcBalance})`,
          code: 'FINANCIAL_MISMATCH',
        });
      }
    }
  });

  if (orphanSaleMerchants > 0) {
    warnings.push({
      field: 'sales.orphanMerchants',
      message: `အရောင်းဘောင်ချာ ${orphanSaleMerchants} စောင်သည် စာရင်းမရှိသော ကုန်သည် ID နှင့် ချိတ်ဆက်နေပါသည်`,
      code: 'ORPHAN_SALE_MERCHANTS',
    });
  }

  // 8. Other entities duplicate & reference validations
  const purchaseIdSet = new Set<string>();
  checkDuplicateEntityIds(normalized.merchantPurchases, 'merchantPurchases', 'ကုန်သည်ဝယ်ယူမှု');
  normalized.merchantPurchases.forEach((p, idx) => {
    if (p.id) purchaseIdSet.add(p.id);
    if (p.merchantId && !merchantIdSet.has(p.merchantId)) {
      warnings.push({
        field: `merchantPurchases[${idx}].merchantId`,
        message: `ကုန်သည်ဝယ်ယူမှု (${p.purchaseNo || p.id}) ရှိ Merchant ID ${p.merchantId} သည် ကုန်သည်စာရင်းတွင် မရှိပါ`,
        code: 'MISSING_MERCHANT_REFERENCE',
      });
    }
  });

  checkDuplicateEntityIds(normalized.orders, 'orders', 'အော်ဒါ');
  normalized.orders.forEach((ord, idx) => {
    if (ord.merchantId && !merchantIdSet.has(ord.merchantId)) {
      warnings.push({
        field: `orders[${idx}].merchantId`,
        message: `အော်ဒါ (${ord.orderNo || ord.id}) ရှိ Merchant ID ${ord.merchantId} သည် ကုန်သည်စာရင်းတွင် မရှိပါ`,
        code: 'MISSING_MERCHANT_REFERENCE',
      });
    }
    if (ord.items && Array.isArray(ord.items)) {
      ord.items.forEach((item, itemIdx) => {
        if (item.productId && !productIdSet.has(item.productId)) {
          warnings.push({
            field: `orders[${idx}].items[${itemIdx}].productId`,
            message: `အော်ဒါ (${ord.orderNo || ord.id}) ရှိ Product ID ${item.productId} သည် ပစ္စည်းစာရင်းတွင် မရှိပါ`,
            code: 'MISSING_PRODUCT_REFERENCE',
          });
        }
      });
    }
  });

  checkDuplicateEntityIds(normalized.stockAdjustments, 'stockAdjustments', 'စတော့ညှိနှိုင်းမှု');
  normalized.stockAdjustments.forEach((adj, idx) => {
    if (adj.productId && !productIdSet.has(adj.productId)) {
      warnings.push({
        field: `stockAdjustments[${idx}].productId`,
        message: `စတော့ညှိနှိုင်းမှု (${adj.id}) ရှိ Product ID ${adj.productId} သည် ပစ္စည်းစာရင်းတွင် မရှိပါ`,
        code: 'MISSING_PRODUCT_REFERENCE',
      });
    }
  });

  checkDuplicateEntityIds(normalized.peerTrades, 'peerTrades', 'အချင်းချင်းကုန်သွယ်မှု');
  checkDuplicateEntityIds(normalized.attachments, 'attachments', 'ဓါတ်ပုံမှတ်တမ်း');
  normalized.attachments.forEach((att, idx) => {
    if (att.voucherId && !txIdSet.has(att.voucherId) && !saleIdSet.has(att.voucherId) && !purchaseIdSet.has(att.voucherId)) {
      warnings.push({
        field: `attachments[${idx}].voucherId`,
        message: `ဓါတ်ပုံမှတ်တမ်း (${att.id}) ရှိ Voucher ID ${att.voucherId} သည် ဘောင်ချာစာရင်းတွင် မရှိပါ`,
        code: 'MISSING_VOUCHER_REFERENCE',
      });
    }
  });

  // 9. Database Comparison (Compare with current Dexie DB)
  let comparison: BackupValidationReport['comparison'];
  try {
    const [
      currentProds,
      currentSupps,
      currentMerchs,
      currentTxs,
      currentSales,
      currentOrders,
    ] = await Promise.all([
      db.products.toArray(),
      db.suppliers.toArray(),
      db.merchants.toArray(),
      db.transactions.toArray(),
      db.sales.toArray(),
      db.orders.toArray(),
    ]);

    const compareCounts = <T extends { id: string }>(incoming: T[], current: T[]): EntityComparisonCount => {
      const currentIds = new Set(current.map((c) => c.id));
      let toAdd = 0;
      let toUpdate = 0;
      incoming.forEach((item) => {
        if (currentIds.has(item.id)) {
          toUpdate++;
        } else {
          toAdd++;
        }
      });
      return {
        inBackup: incoming.length,
        inCurrentDb: current.length,
        toAdd,
        toUpdate,
        toPreserve: current.length - toUpdate,
      };
    };

    comparison = {
      products: compareCounts(normalized.products, currentProds),
      suppliers: compareCounts(normalized.suppliers, currentSupps),
      merchants: compareCounts(normalized.merchants, currentMerchs),
      transactions: compareCounts(normalized.transactions, currentTxs),
      sales: compareCounts(normalized.sales, currentSales),
      orders: compareCounts(normalized.orders, currentOrders),
    };
  } catch (e) {
    console.warn('Could not compare with live database', e);
  }

  const fatalErrors = errors.filter((err) => err.severity === 'FATAL');
  const isValid = fatalErrors.length === 0;

  return {
    isValid,
    isCorrupted: fatalErrors.length > 0,
    formatVersion,
    detectedSchemaVersion,
    checksumValid,
    exportedAt: parsedObj.exportedAt || metadata.dateRange?.latest || new Date().toISOString(),
    shopName: metadata.shopName,
    appName: metadata.appName,
    totalRecords: metadata.totalRecords,
    errors,
    warnings,
    counts: metadata.counts,
    dateRange: metadata.dateRange,
    comparison,
    normalizedData: normalized,
  };
}

/**
 * Creates an automatic recovery snapshot of the entire database prior to restore or danger zone operations
 */
export async function createAutoRecoverySnapshot(
  reason: string,
  targetDb: ShweLetYarDatabase = db
): Promise<string> {
  const snapshotId = generateStableId('rec');
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [
    products,
    suppliers,
    merchants,
    transactions,
    sales,
    stockAdjustments,
    merchantOrders,
    merchantPurchases,
    peerTrades,
  ] = await Promise.all([
    targetDb.products.toArray(),
    targetDb.suppliers.toArray(),
    targetDb.merchants.toArray(),
    targetDb.transactions.toArray(),
    targetDb.sales.toArray(),
    targetDb.stockAdjustments.toArray(),
    targetDb.orders.toArray(),
    targetDb.merchantPurchases.toArray(),
    targetDb.peerTrades.toArray(),
  ]);

  const shopSettings = getStoredShopSettings();

  const snapshot: AutoRecoverySnapshot = {
    id: snapshotId,
    timestamp: Date.now(),
    date: dateStr,
    time: timeStr,
    reason,
    recordCounts: {
      products: products.length,
      suppliers: suppliers.length,
      merchants: merchants.length,
      transactions: transactions.length,
      sales: sales.length,
      stockAdjustments: stockAdjustments.length,
      orders: merchantOrders.length,
    },
    data: {
      products,
      suppliers,
      merchants,
      transactions,
      sales,
      stockAdjustments,
      merchantOrders,
      merchantPurchases,
      peerTraders: [],
      peerTransactions: [],
      shopSettings,
    },
  };

  try {
    await targetDb.recoverySnapshots.put(snapshot);
    // Keep max 20 snapshots to prevent excessive IndexedDB storage use
    const allSnapshots = await targetDb.recoverySnapshots.toArray();
    if (allSnapshots.length > 20) {
      allSnapshots.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = allSnapshots.slice(0, allSnapshots.length - 20);
      await Promise.all(toDelete.map((s) => targetDb.recoverySnapshots.delete(s.id)));
    }
  } catch (err) {
    console.warn('Failed to save auto recovery snapshot to IndexedDB', err);
    throw new Error(`Failed to save auto recovery snapshot: ${err instanceof Error ? err.message : String(err)}`);
  }

  return snapshotId;
}

/**
 * Safely restores database from validated backup report
 */
export async function executeSafeRestore(
  report: BackupValidationReport,
  mode: 'OVERWRITE' | 'SMART_MERGE'
): Promise<{
  success: boolean;
  message: string;
  snapshotId: string;
  stats: Record<string, number>;
}> {
  if (!report.isValid || !report.normalizedData) {
    throw new Error('မမှန်ကန်သော Backup ဒေတာဖြစ်သဖြင့် Restore ပြုလုပ်၍ မရပါ');
  }

  const data = report.normalizedData;

  // Step 1: ALWAYS take safety snapshot first!
  const snapshotReason = `Pre-Restore Snapshot before ${mode === 'OVERWRITE' ? 'Full Overwrite' : 'Smart Merge'} (${data.shopSettings.shopName || 'Backup'})`;
  const snapshotId = await createAutoRecoverySnapshot(snapshotReason);

  const stats = {
    productsRestored: data.products.length,
    suppliersRestored: data.suppliers.length,
    merchantsRestored: data.merchants.length,
    transactionsRestored: data.transactions.length,
    salesRestored: data.sales.length,
    purchasesRestored: data.merchantPurchases.length,
    ordersRestored: data.orders.length,
    stockAdjustmentsRestored: data.stockAdjustments.length,
    peerTradesRestored: data.peerTrades.length,
  };

  // Step 2: Atomic Dexie Transaction
  try {
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
        db.settings,
        db.attachments,
      ],
      async () => {
        // Prepare attachments with native IndexedDB Blobs
        const restoredAttachments: AttachmentRecord[] = [];
        if (data.attachments && data.attachments.length > 0) {
          for (const att of data.attachments) {
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

        if (mode === 'OVERWRITE') {
          // Clear all operational tables
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
          ]);

          if (data.products.length > 0) await db.products.bulkPut(data.products);
          if (data.suppliers.length > 0) await db.suppliers.bulkPut(data.suppliers);
          if (data.merchants.length > 0) await db.merchants.bulkPut(data.merchants);
          if (data.transactions.length > 0) await db.transactions.bulkPut(data.transactions);
          if (data.sales.length > 0) await db.sales.bulkPut(data.sales);
          if (data.merchantPurchases.length > 0) await db.merchantPurchases.bulkPut(data.merchantPurchases);
          if (data.orders.length > 0) await db.orders.bulkPut(data.orders);
          if (data.stockAdjustments.length > 0) await db.stockAdjustments.bulkPut(data.stockAdjustments);
          if (data.peerTrades.length > 0) await db.peerTrades.bulkPut(data.peerTrades);
          if (data.softDeletedItems.length > 0) await db.softDeletedItems.bulkPut(data.softDeletedItems);
          if (restoredAttachments.length > 0) await db.attachments.bulkPut(restoredAttachments);
          if (data.rawMaterialPresets.length > 0) {
            await db.rawMaterialPresets.clear();
            await db.rawMaterialPresets.bulkPut(data.rawMaterialPresets);
          }

          // Shop settings & preferences
          if (data.shopSettings) saveStoredShopSettings(data.shopSettings);
          if (data.productCategories && data.productCategories.length > 0) {
            saveStoredProductCategories(data.productCategories);
          }
          if (data.rawMaterialCategories && data.rawMaterialCategories.length > 0) {
            saveStoredRawMaterialCategories(data.rawMaterialCategories);
          }
          if (data.rawMaterialPresets.length > 0) {
            saveStoredRawMaterialPresets(data.rawMaterialPresets);
          }
        } else {
          // SMART MERGE: Put records with de-duplication
          if (data.products.length > 0) await db.products.bulkPut(data.products);
          if (data.suppliers.length > 0) await db.suppliers.bulkPut(data.suppliers);
          if (data.merchants.length > 0) await db.merchants.bulkPut(data.merchants);
          if (data.transactions.length > 0) await db.transactions.bulkPut(data.transactions);
          if (data.sales.length > 0) await db.sales.bulkPut(data.sales);
          if (data.merchantPurchases.length > 0) await db.merchantPurchases.bulkPut(data.merchantPurchases);
          if (data.orders.length > 0) await db.orders.bulkPut(data.orders);
          if (data.stockAdjustments.length > 0) await db.stockAdjustments.bulkPut(data.stockAdjustments);
          if (data.peerTrades.length > 0) await db.peerTrades.bulkPut(data.peerTrades);
          if (data.softDeletedItems.length > 0) await db.softDeletedItems.bulkPut(data.softDeletedItems);
          if (restoredAttachments.length > 0) await db.attachments.bulkPut(restoredAttachments);
          if (data.rawMaterialPresets.length > 0) await db.rawMaterialPresets.bulkPut(data.rawMaterialPresets);

          // Merge categories
          if (data.productCategories) {
            const current = getStoredProductCategories();
            saveStoredProductCategories(Array.from(new Set([...current, ...data.productCategories])));
          }
          if (data.rawMaterialCategories) {
            const current = getStoredRawMaterialCategories();
            saveStoredRawMaterialCategories(Array.from(new Set([...current, ...data.rawMaterialCategories])));
          }
        }

        // Log audit entry for recovery history
        await db.auditLogs.put({
          id: generateStableId('aud'),
          action: mode === 'OVERWRITE' ? 'RESTORE_OVERWRITE' : 'RESTORE_SMART_MERGE',
          details: `ဒေတာဘေ့စ်အား Backup မှ အောင်မြင်စွာ ပြန်လည်သွင်းယူခဲ့သည် (Pre-restore snapshot ID: ${snapshotId}, စုစုပေါင်းမှတ်တမ်း: ${report.totalRecords})`,
          timestamp: new Date().toISOString(),
          entityType: 'BACKUP_RECOVERY',
          entityId: snapshotId,
        });

        // Verification: Ensure database is healthy and records exist
        const [verProds, verSupps, verMerchs] = await Promise.all([
          db.products.count(),
          db.suppliers.count(),
          db.merchants.count(),
        ]);

        if (mode === 'OVERWRITE') {
          if (data.products.length > 0 && verProds !== data.products.length) {
            throw new Error(`Database verification failed: Product count mismatch (expected ${data.products.length}, found ${verProds})`);
          }
          if (data.suppliers.length > 0 && verSupps !== data.suppliers.length) {
            throw new Error(`Database verification failed: Supplier count mismatch (expected ${data.suppliers.length}, found ${verSupps})`);
          }
        }
      }
    );

    return {
      success: true,
      message:
        mode === 'OVERWRITE'
          ? `ဒေတာများ အားလုံး အောင်မြင်စွာ အစားထိုးထည့်သွင်းပြီးပါပြီ (Pre-restore Snapshot သိမ်းဆည်းပြီးပါပြီ)`
          : `ဒေတာများ အောင်မြင်စွာ ပေါင်းစပ်ပြီးပါပြီ (Pre-restore Snapshot သိမ်းဆည်းပြီးပါပြီ)`,
      snapshotId,
      stats,
    };
  } catch (err: any) {
    console.error('Dexie Transaction Restore Failed:', err);
    throw new Error(`Restore လုပ်ဆောင်မှု မအောင်မြင်ပါ (${err.message})။ ယခင်ဒေတာများကို ထိခိုက်မှုမရှိစေရန် မူလအတိုင်း ထိန်းသိမ်းထားရှိပါသည်။`);
  }
}

/**
 * Retrieves all recovery snapshots stored in IndexedDB
 */
export async function getRecoverySnapshots(): Promise<AutoRecoverySnapshot[]> {
  try {
    const list = await db.recoverySnapshots.toArray();
    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error('Failed to get recovery snapshots', e);
    return [];
  }
}

/**
 * Restores database to a specific recovery snapshot
 */
export async function restoreFromSnapshot(
  snapshotId: string,
  targetDb: ShweLetYarDatabase = db
): Promise<{ success: boolean; message: string }> {
  const snapshot = await targetDb.recoverySnapshots.get(snapshotId);
  if (!snapshot) {
    throw new Error('အဆိုပါ Snapshot မတွေ့ရှိပါ');
  }

  // Take emergency safety snapshot of right now before rollback
  await createAutoRecoverySnapshot(`Emergency Snapshot before rollback to snapshot ${snapshotId}`, targetDb);

  const data = snapshot.data;

  await targetDb.transaction(
    'rw',
    [
      targetDb.products,
      targetDb.suppliers,
      targetDb.merchants,
      targetDb.transactions,
      targetDb.sales,
      targetDb.merchantPurchases,
      targetDb.orders,
      targetDb.stockAdjustments,
      targetDb.peerTrades,
      targetDb.auditLogs,
    ],
    async () => {
      await Promise.all([
        targetDb.products.clear(),
        targetDb.suppliers.clear(),
        targetDb.merchants.clear(),
        targetDb.transactions.clear(),
        targetDb.sales.clear(),
        targetDb.merchantPurchases.clear(),
        targetDb.orders.clear(),
        targetDb.stockAdjustments.clear(),
        targetDb.peerTrades.clear(),
      ]);

      if (data.products?.length > 0) await targetDb.products.bulkPut(data.products);
      if (data.suppliers?.length > 0) await targetDb.suppliers.bulkPut(data.suppliers);
      if (data.merchants?.length > 0) await targetDb.merchants.bulkPut(data.merchants);
      if (data.transactions?.length > 0) await targetDb.transactions.bulkPut(data.transactions);
      if (data.sales?.length > 0) await targetDb.sales.bulkPut(data.sales);
      if (data.merchantPurchases && data.merchantPurchases.length > 0) {
        await targetDb.merchantPurchases.bulkPut(data.merchantPurchases);
      }
      if (data.merchantOrders && data.merchantOrders.length > 0) {
        await targetDb.orders.bulkPut(data.merchantOrders);
      }
      if (data.stockAdjustments?.length > 0) await targetDb.stockAdjustments.bulkPut(data.stockAdjustments);

      if (data.shopSettings) saveStoredShopSettings(data.shopSettings);

      await targetDb.auditLogs.put({
        id: generateStableId('aud'),
        action: 'ROLLBACK_TO_SNAPSHOT',
        details: `Snapshot ${snapshot.date} ${snapshot.time} (${snapshot.reason}) သို့ ဒေတာများ ပြန်လည်ပြောင်းလဲခဲ့သည်`,
        timestamp: new Date().toISOString(),
        entityType: 'RECOVERY_SNAPSHOT',
        entityId: snapshotId,
      });
    }
  );

  return {
    success: true,
    message: `${snapshot.date} ${snapshot.time} ကာလရှိ Snapshot သို့ အောင်မြင်စွာ ပြန်လည်ရောက်ရှိပြီးဖြစ်ပါသည်`,
  };
}

/**
 * Deletes a single recovery snapshot
 */
export async function deleteRecoverySnapshot(snapshotId: string): Promise<void> {
  await db.recoverySnapshots.delete(snapshotId);
}

/**
 * Clears all recovery snapshots
 */
export async function clearAllRecoverySnapshots(): Promise<void> {
  await db.recoverySnapshots.clear();
}
