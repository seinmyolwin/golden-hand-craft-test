import { db, ShweLetYarDatabase } from '../db/database';
import { enforcePermission, getPersistedUsers, SETTING_USERS_KEY } from './authorizationService';
import { blobToBase64, processImageInput, base64ToBlob } from './attachmentService';
import {
  getBusinessInitialization,
  createEmptyOpeningPosition,
} from './businessInitializationService';
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
  AppUser,
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
import { masterDataService } from './masterDataService';
import { safeJsonParse, deepSanitizeUntrustedObject } from '../utils/security';
import {
  encryptBackupPayload,
  decryptBackupPayload,
  EncryptedBackupEnvelope,
} from './cryptoSecurity';
import {
  APP_VERSION,
  CURRENT_APP_VERSION,
  BACKUP_FORMAT_VERSION,
  CURRENT_BACKUP_FORMAT_VERSION,
  DATABASE_SCHEMA_VERSION,
  CURRENT_DATABASE_SCHEMA_VERSION,
} from '../constants/version';

export {
  APP_VERSION,
  CURRENT_APP_VERSION,
  BACKUP_FORMAT_VERSION,
  CURRENT_BACKUP_FORMAT_VERSION,
  DATABASE_SCHEMA_VERSION,
  CURRENT_DATABASE_SCHEMA_VERSION,
};

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
  passphrase?: undefined;
}): Promise<VersionedBackupFile>;
export async function createCompleteBackup(options: {
  customNotes?: string;
  shopSettings?: ShopSettings;
  passphrase: string;
}): Promise<EncryptedBackupEnvelope>;
export async function createCompleteBackup(options?: {
  customNotes?: string;
  shopSettings?: ShopSettings;
  passphrase?: string;
}): Promise<VersionedBackupFile | EncryptedBackupEnvelope> {
  await enforcePermission('BACKUP_EXPORT', 'ဒေတာ မိတ္တူ ထုတ်ယူခြင်း (Export Backup)');
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
    stockMovements,
    cashMovements,
    dailyClosings,
    returnsAndRefunds,
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
    db.stockMovements.toArray(),
    db.cashMovements.toArray(),
    db.dailyClosings.toArray(),
    db.returnsAndRefunds ? db.returnsAndRefunds.toArray() : Promise.resolve([]),
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
  const masterDataCategories = await masterDataService.getMasterDataCategories();
  const presetsFromStore = rawMaterialPresets.length > 0 ? rawMaterialPresets : getStoredRawMaterialPresets();
  const rbacUsers = await getPersistedUsers();

  // Find date range
  const allDates: string[] = [];
  transactions.forEach((t) => t.date && allDates.push(t.date));
  sales.forEach((s) => s.date && allDates.push(s.date));
  merchantPurchases.forEach((p) => p.date && allDates.push(p.date));
  orders.forEach((o) => (o.date || o.orderDate) && allDates.push(o.date || o.orderDate || ''));
  cashMovements.forEach((c) => c.transactionDate && allDates.push(c.transactionDate));
  dailyClosings.forEach((d) => d.closingDate && allDates.push(d.closingDate));
  returnsAndRefunds.forEach((r) => r.date && allDates.push(r.date));
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
    attachments.length +
    stockMovements.length +
    cashMovements.length +
    dailyClosings.length +
    returnsAndRefunds.length;

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
      stockMovements: stockMovements.length,
      cashMovements: cashMovements.length,
      dailyClosings: dailyClosings.length,
      returnsAndRefunds: returnsAndRefunds.length,
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

  const businessInitialization = await getBusinessInitialization();

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
    businessInitialization,
    appLockSettings,
    backupReminderSettings,
    productCategories,
    rawMaterialCategories,
    masterDataCategories,
    attachments: serializableAttachments,
    stockMovements,
    cashMovements,
    dailyClosings,
    returnsAndRefunds,
    rbacUsers,
    rbac_users: rbacUsers,
  };

  const dataPayloadString = JSON.stringify(data);
  const checksum = await computeChecksum(dataPayloadString);

  const backupFile: VersionedBackupFile = {
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    appVersion: CURRENT_APP_VERSION,
    exportedAt: new Date().toISOString(),
    databaseSchemaVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    checksum,
    metadata,
    data,
  };

  if (options?.passphrase && options.passphrase.trim()) {
    const serialized = JSON.stringify(backupFile);
    return await encryptBackupPayload(serialized, options.passphrase.trim());
  }

  return backupFile;
}

/**
 * Exports and downloads the backup file to disk with filename formatting
 */
export async function downloadBackupFile(
  backup: VersionedBackupFile | EncryptedBackupEnvelope,
  useLocationPicker: boolean = false
): Promise<{ success: boolean; method: 'picker' | 'download'; fileName: string }> {
  let shopNameClean = 'ShweLetYar';
  if ('metadata' in backup && backup.metadata?.shopName) {
    shopNameClean = (backup.metadata.shopName || 'ShweLetYar')
      .trim()
      .replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_');
  }
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
  const stockMovements: StockMovementRecord[] = Array.isArray(rawData.stockMovements) ? rawData.stockMovements : [];
  const cashMovements: CashMovementRecord[] = Array.isArray(rawData.cashMovements) ? rawData.cashMovements : [];
  const dailyClosings: DailyClosingRecord[] = Array.isArray(rawData.dailyClosings) ? rawData.dailyClosings : [];
  const returnsAndRefunds: ReturnRecord[] = Array.isArray(rawData.returnsAndRefunds) ? rawData.returnsAndRefunds : [];

  const shopSettings: ShopSettings = {
    ...DEFAULT_SHOP_SETTINGS,
    ...(rawData.shopSettings || raw.shopSettings || {}),
  };

  const appLockSettings = rawData.appLockSettings || raw.appLockSettings;
  const backupReminderSettings = rawData.backupReminderSettings || raw.backupReminderSettings;
  const productCategories = Array.isArray(rawData.productCategories) ? rawData.productCategories : undefined;
  const rawMaterialCategories = Array.isArray(rawData.rawMaterialCategories) ? rawData.rawMaterialCategories : undefined;
  const masterDataCategories: MasterDataCategory[] | undefined = Array.isArray(rawData.masterDataCategories)
    ? rawData.masterDataCategories
    : undefined;
  const rbacUsers: AppUser[] | undefined = Array.isArray(rawData.rbacUsers || rawData.rbac_users)
    ? (rawData.rbacUsers || rawData.rbac_users)
    : undefined;
  const businessInitialization = rawData.businessInitialization || raw.businessInitialization;

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
    attachments.length +
    stockMovements.length +
    cashMovements.length +
    dailyClosings.length +
    returnsAndRefunds.length +
    (masterDataCategories?.length || 0);

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
    stockMovements: stockMovements.length,
    cashMovements: cashMovements.length,
    dailyClosings: dailyClosings.length,
    returnsAndRefunds: returnsAndRefunds.length,
    masterDataCategories: masterDataCategories?.length || 0,
  };

  const allDates: string[] = [];
  transactions.forEach((t) => t.date && allDates.push(t.date));
  sales.forEach((s) => s.date && allDates.push(s.date));
  merchantPurchases.forEach((p) => p.date && allDates.push(p.date));
  orders.forEach((o) => (o.date || o.orderDate) && allDates.push(o.date || o.orderDate || ''));
  cashMovements.forEach((c) => c.transactionDate && allDates.push(c.transactionDate));
  dailyClosings.forEach((d) => d.closingDate && allDates.push(d.closingDate));
  returnsAndRefunds.forEach((r) => r.date && allDates.push(r.date));
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
    businessInitialization,
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
    masterDataCategories,
    attachments,
    stockMovements,
    cashMovements,
    dailyClosings,
    returnsAndRefunds,
    rbacUsers,
    rbac_users: rbacUsers,
  };

  return { normalized, metadata, formatVersion, checksum };
}

/**
 * Validates the backup JSON with deep schema, data type, integrity, and comparison checks
 */
export async function validateBackupFile(
  rawJsonStringOrObject: string | any,
  passphrase?: string
): Promise<BackupValidationReport> {
  const errors: BackupValidationError[] = [];
  const warnings: BackupValidationWarning[] = [];

  const emptyCounts = {
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
    returnsAndRefunds: 0,
  };

  let parsedObj: any;
  const originalRaw = rawJsonStringOrObject;

  if (typeof rawJsonStringOrObject === 'string') {
    try {
      parsedObj = safeJsonParse(rawJsonStringOrObject);
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
        counts: emptyCounts,
      };
    }
  } else {
    parsedObj = deepSanitizeUntrustedObject(rawJsonStringOrObject);
  }

  // Handle encrypted backup payload envelope
  if (parsedObj && typeof parsedObj === 'object' && parsedObj.encrypted === true) {
    if (!passphrase || !passphrase.trim()) {
      return {
        isValid: false,
        isCorrupted: false,
        isEncrypted: true,
        rawEncryptedPayload: originalRaw,
        formatVersion: 'AES-GCM',
        detectedSchemaVersion: 0,
        checksumValid: false,
        exportedAt: '',
        shopName: '',
        appName: '',
        totalRecords: 0,
        errors: [
          {
            field: 'ENCRYPTION',
            message: 'စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်',
            code: 'ENCRYPTED_BACKUP_PASSPHRASE_REQUIRED',
            severity: 'FATAL',
          },
        ],
        warnings: [],
        counts: emptyCounts,
      };
    }

    try {
      const decryptedJsonStr = await decryptBackupPayload(parsedObj, passphrase.trim());
      parsedObj = safeJsonParse(decryptedJsonStr);
    } catch {
      return {
        isValid: false,
        isCorrupted: true,
        isEncrypted: true,
        rawEncryptedPayload: originalRaw,
        formatVersion: 'AES-GCM',
        detectedSchemaVersion: 0,
        checksumValid: false,
        exportedAt: '',
        shopName: '',
        appName: '',
        totalRecords: 0,
        errors: [
          {
            field: 'DECRYPTION',
            message: 'စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်',
            code: 'DECRYPTION_FAILED',
            severity: 'FATAL',
          },
        ],
        warnings: [],
        counts: emptyCounts,
      };
    }
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
        returnsAndRefunds: 0,
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
        returnsAndRefunds: 0,
      },
    };
  }

  // 1. Checksum & Structural Integrity validation
  let checksumValid = true;
  if (formatVersion === '3.0') {
    if (checksum && parsedObj.data) {
      const calculatedChecksum = await computeChecksum(JSON.stringify(parsedObj.data));
      if (calculatedChecksum !== checksum) {
        checksumValid = false;
        warnings.push({
          field: 'checksum',
          message: 'ဖိုင်အတွင်း အချက်အလက်များ ပြင်ဆင်ခံထားရနိုင်သည် (Checksum mismatch, continuing with deep field validation)',
          code: 'CHECKSUM_MISMATCH',
        });
      }
    } else if (!checksum) {
      checksumValid = false;
      warnings.push({
        field: 'checksum',
        message: 'v3.0 ဖိုင်ဖြစ်သော်လည်း Checksum မပါရှိပါ',
        code: 'MISSING_CHECKSUM',
      });
    }
  } else if (formatVersion === '2.0' || formatVersion === '1.0') {
    // Backward-compatibility: v1/v2 legacy backups
    if (checksum) {
      const payloadToCheck = parsedObj.data || parsedObj;
      const calculatedChecksum = await computeChecksum(JSON.stringify(payloadToCheck));
      if (calculatedChecksum !== checksum) {
        checksumValid = false;
        warnings.push({
          field: 'checksum',
          message: 'Legacy backup checksum မကိုက်ညီပါ (Checksum mismatch)',
          code: 'CHECKSUM_MISMATCH',
        });
      }
    } else {
      // Legacy format without cryptographic checksum:
      // Perform strict structural integrity verification
      let structuralFailure = false;
      const checkCollectionStructure = (items: any[], entityName: string) => {
        if (!Array.isArray(items)) {
          structuralFailure = true;
          errors.push({
            field: entityName,
            message: `Legacy format တွင် ${entityName} စာရင်းသည် array မဟုတ်ပါ`,
            code: 'INVALID_COLLECTION_STRUCTURE',
            severity: 'FATAL',
          });
          return;
        }
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item || typeof item !== 'object') {
            structuralFailure = true;
            errors.push({
              field: `${entityName}[${i}]`,
              message: `Legacy format ရှိ ${entityName} အမှတ် (${i + 1}) သည် object မဟုတ်ပါ`,
              code: 'INVALID_ENTITY_STRUCTURE',
              severity: 'FATAL',
            });
            break;
          }
          if (!item.id || typeof item.id !== 'string') {
            structuralFailure = true;
            errors.push({
              field: `${entityName}[${i}].id`,
              message: `Legacy format ရှိ ${entityName} အမှတ် (${i + 1}) တွင် ID မပါရှိပါ`,
              code: 'MISSING_ENTITY_ID',
              severity: 'FATAL',
            });
            break;
          }
        }
      };

      checkCollectionStructure(normalized.products, 'products');
      checkCollectionStructure(normalized.suppliers, 'suppliers');
      checkCollectionStructure(normalized.merchants, 'merchants');
      checkCollectionStructure(normalized.transactions, 'transactions');
      checkCollectionStructure(normalized.sales, 'sales');

      if (structuralFailure) {
        checksumValid = false;
      } else {
        checksumValid = true;
        warnings.push({
          field: 'formatVersion',
          message: `v${formatVersion} Legacy format: Cryptographic checksum မပါရှိပါ (v3.0 သို့ အလိုအလျောက် အဆင့်မြှင့်တင်ပါမည်)။ Structural integrity စစ်ဆေးမှု အောင်မြင်ပါသည်။`,
          code: 'LEGACY_BACKUP_STRUCTURAL_INTEGRITY_VERIFIED',
        });
      }
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
  checkDuplicateEntityIds(normalized.auditLogs, 'auditLogs', 'စာရင်းစစ်မှတ်တမ်း');
  checkDuplicateEntityIds(normalized.returnsAndRefunds || [], 'returnsAndRefunds', 'ကုန်ပစ္စည်းပြန်အပ်/အမ်းငွေ');

  (normalized.returnsAndRefunds || []).forEach((ret, idx) => {
    if (!ret.id || typeof ret.id !== 'string') {
      errors.push({
        field: `returnsAndRefunds[${idx}].id`,
        message: `ကုန်ပစ္စည်းပြန်အပ်/အမ်းငွေ မှတ်တမ်း (${idx + 1}) တွင် ID မပါရှိပါ`,
        code: 'MISSING_RETURN_ID',
        severity: 'ERROR',
      });
    }
    if (!ret.referenceId && !ret.referenceVoucherNo) {
      warnings.push({
        field: `returnsAndRefunds[${idx}].referenceId`,
        message: `ပြန်အပ်/အမ်းငွေ (${ret.returnNo || ret.id}) တွင် မူလဘောင်ချာ အညွှန်းမပါရှိပါ`,
        code: 'MISSING_RETURN_REFERENCE',
      });
    }
    if (ret.referenceType === 'SALE' && ret.referenceId && !saleIdSet.has(ret.referenceId)) {
      warnings.push({
        field: `returnsAndRefunds[${idx}].referenceId`,
        message: `ပြန်အပ်မှတ်တမ်း (${ret.returnNo || ret.id}) ၏ မူလအရောင်းဘောင်ချာ ID ${ret.referenceId} သည် အရောင်းစာရင်းတွင် မရှိပါ`,
        code: 'ORPHAN_RETURN_REFERENCE',
      });
    }
    if (ret.items && Array.isArray(ret.items)) {
      ret.items.forEach((item, itemIdx) => {
        if (item.productId && !productIdSet.has(item.productId)) {
          warnings.push({
            field: `returnsAndRefunds[${idx}].items[${itemIdx}].productId`,
            message: `ပြန်အပ်မှတ်တမ်း (${ret.returnNo || ret.id}) ရှိ Product ID ${item.productId} သည် ပစ္စည်းစာရင်းတွင် မရှိပါ`,
            code: 'MISSING_PRODUCT_REFERENCE',
          });
        }
        if (typeof item.quantity === 'number' && item.quantity <= 0) {
          warnings.push({
            field: `returnsAndRefunds[${idx}].items[${itemIdx}].quantity`,
            message: `ပြန်အပ်မှတ်တမ်း (${ret.returnNo || ret.id}) ၏ ပြန်အပ်အရေအတွက် (${item.quantity}) သည် သုည သို့မဟုတ် အနှုတ်ဖြစ်နေပါသည်`,
            code: 'INVALID_RETURN_QUANTITY',
          });
        }
      });
    }
  });

  normalized.auditLogs.forEach((log, idx) => {
    if (!log.id) {
      warnings.push({
        field: `auditLogs[${idx}].id`,
        message: `စာရင်းစစ်မှတ်တမ်း (${idx + 1}) တွင် ID မပါရှိပါ`,
        code: 'MISSING_AUDIT_ID',
      });
    }
  });
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
      currentReturns,
    ] = await Promise.all([
      db.products.toArray(),
      db.suppliers.toArray(),
      db.merchants.toArray(),
      db.transactions.toArray(),
      db.sales.toArray(),
      db.orders.toArray(),
      db.returnsAndRefunds ? db.returnsAndRefunds.toArray() : Promise.resolve([]),
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
      returnsAndRefunds: compareCounts(normalized.returnsAndRefunds || [], currentReturns),
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
  await enforcePermission('BACKUP_RESTORE', `အလိုအလျောက် ပြန်လည်ရယူရေး Snapshot ရယူခြင်း: ${reason}`);
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
    softDeletedItems,
    auditLogs,
    rawMaterialPresets,
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
    targetDb.stockAdjustments.toArray(),
    targetDb.orders.toArray(),
    targetDb.merchantPurchases.toArray(),
    targetDb.peerTrades.toArray(),
    targetDb.softDeletedItems.toArray(),
    targetDb.auditLogs.toArray(),
    targetDb.rawMaterialPresets.toArray(),
    targetDb.attachments.toArray(),
    targetDb.stockMovements.toArray(),
    targetDb.cashMovements.toArray(),
    targetDb.dailyClosings.toArray(),
    targetDb.returnsAndRefunds ? targetDb.returnsAndRefunds.toArray() : Promise.resolve([]),
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
      peerTrades: peerTrades.length,
      stockMovements: stockMovements.length,
      cashMovements: cashMovements.length,
      dailyClosings: dailyClosings.length,
      returnsAndRefunds: returnsAndRefunds.length,
      auditLogs: auditLogs.length,
      softDeletedItems: softDeletedItems.length,
      attachments: attachments.length,
      rawMaterialPresets: rawMaterialPresets.length,
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
      peerTrades,
      shopSettings,
      stockMovements,
      cashMovements,
      dailyClosings,
      returnsAndRefunds,
      auditLogs,
      softDeletedItems,
      attachments,
      rawMaterialPresets,
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
 * Extracts a numeric timestamp from an entity for conflict resolution
 */
function getEntityTimestamp(entity: any): number {
  if (!entity) return 0;
  const dateCandidate =
    entity.updatedAt ||
    entity.createdAt ||
    entity.timestamp ||
    (entity.date && entity.time ? `${entity.date}T${entity.time}:00` : entity.date);
  if (dateCandidate) {
    const parsed = new Date(dateCandidate).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Resolves conflict for entity collections during SMART_MERGE:
 * - If record doesn't exist: insert (added)
 * - If record exists: compare timestamps (updatedAt > createdAt > date)
 *   Only overwrite if incoming is strictly newer; preserve local if local is newer or equal
 */
async function smartMergeCollection<T extends { id: string }>(
  table: any,
  incomingItems: T[]
): Promise<{ added: number; updated: number; preserved: number }> {
  if (!incomingItems || incomingItems.length === 0) {
    return { added: 0, updated: 0, preserved: 0 };
  }

  let added = 0;
  let updated = 0;
  let preserved = 0;
  const toPut: T[] = [];

  const incomingIds = incomingItems.map((i) => i.id).filter(Boolean);
  const existingItems = await table.where('id').anyOf(incomingIds).toArray();
  const existingMap = new Map<string, any>(existingItems.map((item: any) => [item.id, item]));

  for (const incoming of incomingItems) {
    if (!incoming.id) continue;
    const existing = existingMap.get(incoming.id);
    if (!existing) {
      toPut.push(incoming);
      added++;
    } else {
      const existingTs = getEntityTimestamp(existing);
      const incomingTs = getEntityTimestamp(incoming);

      if (incomingTs > existingTs) {
        toPut.push(incoming);
        updated++;
      } else {
        preserved++;
      }
    }
  }

  if (toPut.length > 0) {
    await table.bulkPut(toPut);
  }

  return { added, updated, preserved };
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
  await enforcePermission('BACKUP_RESTORE', 'ဒေတာ ပြန်လည်သွင်းယူခြင်း (Restore Backup)');
  if (!report.isValid || !report.normalizedData) {
    throw new Error('မမှန်ကန်သော Backup ဒေတာဖြစ်သဖြင့် Restore ပြုလုပ်၍ မရပါ');
  }

  const data = report.normalizedData;

  // Step 1: ALWAYS take safety snapshot first!
  const snapshotReason = `Pre-Restore Snapshot before ${mode === 'OVERWRITE' ? 'Full Overwrite' : 'Smart Merge'} (${data.shopSettings.shopName || 'Backup'})`;
  const snapshotId = await createAutoRecoverySnapshot(snapshotReason);

  const stats: Record<string, number> = {
    productsRestored: data.products.length,
    suppliersRestored: data.suppliers.length,
    merchantsRestored: data.merchants.length,
    transactionsRestored: data.transactions.length,
    salesRestored: data.sales.length,
    purchasesRestored: data.merchantPurchases.length,
    ordersRestored: data.orders.length,
    stockAdjustmentsRestored: data.stockAdjustments.length,
    peerTradesRestored: data.peerTrades.length,
    stockMovementsRestored: data.stockMovements?.length || 0,
    cashMovementsRestored: data.cashMovements?.length || 0,
    dailyClosingsRestored: data.dailyClosings?.length || 0,
    returnsRestored: data.returnsAndRefunds?.length || 0,
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
        db.stockMovements,
        db.cashMovements,
        db.dailyClosings,
        db.returnsAndRefunds,
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
            db.auditLogs.clear(),
            db.attachments.clear(),
            db.stockMovements.clear(),
            db.cashMovements.clear(),
            db.dailyClosings.clear(),
            db.returnsAndRefunds ? db.returnsAndRefunds.clear() : Promise.resolve(),
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
          if (data.auditLogs && data.auditLogs.length > 0) await db.auditLogs.bulkPut(data.auditLogs);
          if (restoredAttachments.length > 0) await db.attachments.bulkPut(restoredAttachments);
          if (data.stockMovements && data.stockMovements.length > 0) await db.stockMovements.bulkPut(data.stockMovements);
          if (data.cashMovements && data.cashMovements.length > 0) await db.cashMovements.bulkPut(data.cashMovements);
          if (data.dailyClosings && data.dailyClosings.length > 0) await db.dailyClosings.bulkPut(data.dailyClosings);
          if (data.returnsAndRefunds && data.returnsAndRefunds.length > 0 && db.returnsAndRefunds) {
            await db.returnsAndRefunds.bulkPut(data.returnsAndRefunds);
          }
          if (data.rawMaterialPresets.length > 0) {
            await db.rawMaterialPresets.clear();
            await db.rawMaterialPresets.bulkPut(data.rawMaterialPresets);
          }

          // Shop settings & preferences
          if (data.shopSettings) saveStoredShopSettings(data.shopSettings);
          if (data.businessInitialization) {
            await db.settings.put({
              key: 'businessInitialization',
              value: data.businessInitialization,
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Conservative Migration Rule for Legacy Backups (without businessInitialization metadata):
            // Operational records alone must NOT automatically activate an unknown legacy business.
            // If the legacy backup has pre-existing records (products, sales, transactions, shopSettings),
            // migrate to state = 'SETUP_IN_PROGRESS' so the user can review business details and explicitly confirm activation.
            // If it has no operational data, set to 'NOT_INITIALIZED'.
            const hasExistingData =
              (data.sales?.length || 0) +
              (data.transactions?.length || 0) +
              (data.products?.length || 0) +
              (data.merchants?.length || 0) +
              (data.suppliers?.length || 0) > 0;
            const legacyInit = {
              id: 'current_business',
              state: (hasExistingData ? 'SETUP_IN_PROGRESS' : 'NOT_INITIALIZED') as any,
              businessName: data.shopSettings?.shopName || '',
              ownerName: data.shopSettings?.ownerName || '',
              phone: data.shopSettings?.phone || '',
              address: data.shopSettings?.address || '',
              tagline: data.shopSettings?.tagline || '',
              accountingStartDate: report.dateRange?.earliest || new Date().toISOString().slice(0, 10),
              openingPosition: createEmptyOpeningPosition(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await db.settings.put({
              key: 'businessInitialization',
              value: legacyInit,
              updatedAt: new Date().toISOString(),
            });
          }
          if (data.productCategories && data.productCategories.length > 0) {
            saveStoredProductCategories(data.productCategories);
          }
          if (data.rawMaterialCategories && data.rawMaterialCategories.length > 0) {
            saveStoredRawMaterialCategories(data.rawMaterialCategories);
          }
          if (data.masterDataCategories && data.masterDataCategories.length > 0) {
            await db.settings.put({
              key: 'masterDataCategories',
              value: data.masterDataCategories,
              updatedAt: new Date().toISOString(),
            });
          }
          if (data.rbacUsers && data.rbacUsers.length > 0) {
            await db.settings.put({
              key: SETTING_USERS_KEY,
              value: data.rbacUsers,
              updatedAt: new Date().toISOString(),
            });
          }
          if (data.rawMaterialPresets.length > 0) {
            saveStoredRawMaterialPresets(data.rawMaterialPresets);
          }
        } else {
          // SMART MERGE: Timestamp-based conflict resolution (newer wins, local preserved if newer/equal)
          const mergeResults = await Promise.all([
            smartMergeCollection(db.products, data.products),
            smartMergeCollection(db.suppliers, data.suppliers),
            smartMergeCollection(db.merchants, data.merchants),
            smartMergeCollection(db.transactions, data.transactions),
            smartMergeCollection(db.sales, data.sales),
            smartMergeCollection(db.merchantPurchases, data.merchantPurchases),
            smartMergeCollection(db.orders, data.orders),
            smartMergeCollection(db.stockAdjustments, data.stockAdjustments),
            smartMergeCollection(db.peerTrades, data.peerTrades),
            smartMergeCollection(db.softDeletedItems, data.softDeletedItems),
            smartMergeCollection(db.attachments, restoredAttachments),
            data.stockMovements?.length ? smartMergeCollection(db.stockMovements, data.stockMovements) : Promise.resolve({ added: 0, updated: 0, preserved: 0 }),
            data.cashMovements?.length ? smartMergeCollection(db.cashMovements, data.cashMovements) : Promise.resolve({ added: 0, updated: 0, preserved: 0 }),
            data.dailyClosings?.length ? smartMergeCollection(db.dailyClosings, data.dailyClosings) : Promise.resolve({ added: 0, updated: 0, preserved: 0 }),
            data.returnsAndRefunds?.length && db.returnsAndRefunds ? smartMergeCollection(db.returnsAndRefunds, data.returnsAndRefunds) : Promise.resolve({ added: 0, updated: 0, preserved: 0 }),
            data.rawMaterialPresets?.length ? smartMergeCollection(db.rawMaterialPresets, data.rawMaterialPresets) : Promise.resolve({ added: 0, updated: 0, preserved: 0 }),
          ]);

          stats.mergeAdded = mergeResults.reduce((acc, r) => acc + r.added, 0);
          stats.mergeUpdated = mergeResults.reduce((acc, r) => acc + r.updated, 0);
          stats.mergePreserved = mergeResults.reduce((acc, r) => acc + r.preserved, 0);

          // Audit trail immutability: Never overwrite existing audit logs, deduplicate incoming
          if (data.auditLogs && data.auditLogs.length > 0) {
            const incomingLogIds = data.auditLogs.map((l) => l.id).filter(Boolean);
            const existingLogs = await db.auditLogs.where('id').anyOf(incomingLogIds).toArray();
            const existingLogIdSet = new Set(existingLogs.map((l) => l.id));

            const newAuditLogs = data.auditLogs.filter((l) => !existingLogIdSet.has(l.id));
            if (newAuditLogs.length > 0) {
              await db.auditLogs.bulkAdd(newAuditLogs);
            }
            stats.auditLogsAdded = newAuditLogs.length;
            stats.auditLogsPreserved = existingLogs.length;
          }

          // Merge categories
          if (data.productCategories) {
            const current = getStoredProductCategories();
            saveStoredProductCategories(Array.from(new Set([...current, ...data.productCategories])));
          }
          if (data.rawMaterialCategories) {
            const current = getStoredRawMaterialCategories();
            saveStoredRawMaterialCategories(Array.from(new Set([...current, ...data.rawMaterialCategories])));
          }
          if (data.masterDataCategories && data.masterDataCategories.length > 0) {
            const currentCats = await masterDataService.getMasterDataCategories();
            const catMap = new Map<string, MasterDataCategory>(currentCats.map((c) => [c.id, c]));
            data.masterDataCategories.forEach((incoming) => {
              const existingById = catMap.get(incoming.id);
              if (existingById) {
                const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
                const existingTime = new Date(existingById.updatedAt || existingById.createdAt || 0).getTime();
                if (incomingTime > existingTime) {
                  catMap.set(incoming.id, incoming);
                }
              } else {
                const existingByName = Array.from(catMap.values()).find(
                  (c) => c.domain === incoming.domain && c.name.trim().toLowerCase() === incoming.name.trim().toLowerCase()
                );
                if (existingByName) {
                  const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
                  const existingTime = new Date(existingByName.updatedAt || existingByName.createdAt || 0).getTime();
                  if (incomingTime > existingTime) {
                    catMap.set(existingByName.id, {
                      ...existingByName,
                      name: incoming.name,
                      active: incoming.active,
                      updatedAt: incoming.updatedAt,
                    });
                  }
                } else {
                  catMap.set(incoming.id, incoming);
                }
              }
            });
            await db.settings.put({
              key: 'masterDataCategories',
              value: Array.from(catMap.values()),
              updatedAt: new Date().toISOString(),
            });
          }
          if (data.rbacUsers && data.rbacUsers.length > 0) {
            const currentUsers = await getPersistedUsers();
            const userMap = new Map<string, AppUser>(currentUsers.map((u) => [u.id, u]));
            data.rbacUsers.forEach((incomingUser) => {
              const existing = userMap.get(incomingUser.id);
              if (!existing) {
                userMap.set(incomingUser.id, incomingUser);
              } else {
                const incomingTime = new Date(incomingUser.updatedAt || incomingUser.createdAt || 0).getTime();
                const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                if (incomingTime > existingTime) {
                  userMap.set(incomingUser.id, incomingUser);
                }
              }
            });
            await db.settings.put({
              key: SETTING_USERS_KEY,
              value: Array.from(userMap.values()),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // Log audit entry for recovery history (strictly append-only)
        const nowIso = new Date().toISOString();
        await db.auditLogs.add({
          id: generateStableId('aud'),
          action: mode === 'OVERWRITE' ? 'RESTORE_OVERWRITE' : 'RESTORE_SMART_MERGE',
          actionType: 'BACKUP_RESTORE',
          referenceType: 'BACKUP',
          referenceId: snapshotId,
          details: `ဒေတာဘေ့စ်အား Backup မှ အောင်မြင်စွာ ပြန်လည်သွင်းယူခဲ့သည် (Pre-restore snapshot ID: ${snapshotId}, စုစုပေါင်းမှတ်တမ်း: ${report.totalRecords})`,
          timestamp: nowIso,
          createdAt: nowIso,
          entityType: 'BACKUP_RECOVERY',
          entityId: snapshotId,
          schemaVersion: 1,
          metadata: {
            mode,
            snapshotId,
            totalRecords: report.totalRecords,
            formatVersion: report.formatVersion,
          },
        });

        // Post-Restore Integrity Verification
        if (mode === 'OVERWRITE') {
          // 1. Table record count checks
          const [
            cntProds,
            cntSupps,
            cntMerchs,
            cntTxs,
            cntSales,
            cntPurchs,
            cntOrders,
            cntAdjs,
            cntTrades,
            cntSoft,
            cntAtts,
            cntReturns,
          ] = await Promise.all([
            db.products.count(),
            db.suppliers.count(),
            db.merchants.count(),
            db.transactions.count(),
            db.sales.count(),
            db.merchantPurchases.count(),
            db.orders.count(),
            db.stockAdjustments.count(),
            db.peerTrades.count(),
            db.softDeletedItems.count(),
            db.attachments.count(),
            db.returnsAndRefunds ? db.returnsAndRefunds.count() : Promise.resolve(0),
          ]);

          if (data.products.length !== cntProds) {
            throw new Error(`Post-restore count mismatch on products (expected ${data.products.length}, found ${cntProds})`);
          }
          if (data.suppliers.length !== cntSupps) {
            throw new Error(`Post-restore count mismatch on suppliers (expected ${data.suppliers.length}, found ${cntSupps})`);
          }
          if (data.merchants.length !== cntMerchs) {
            throw new Error(`Post-restore count mismatch on merchants (expected ${data.merchants.length}, found ${cntMerchs})`);
          }
          if (data.sales.length !== cntSales) {
            throw new Error(`Post-restore count mismatch on sales (expected ${data.sales.length}, found ${cntSales})`);
          }
          if (data.transactions.length !== cntTxs) {
            throw new Error(`Post-restore count mismatch on transactions (expected ${data.transactions.length}, found ${cntTxs})`);
          }
          if (data.merchantPurchases.length !== cntPurchs) {
            throw new Error(`Post-restore count mismatch on merchantPurchases (expected ${data.merchantPurchases.length}, found ${cntPurchs})`);
          }
          if (data.orders.length !== cntOrders) {
            throw new Error(`Post-restore count mismatch on orders (expected ${data.orders.length}, found ${cntOrders})`);
          }
          if (data.stockAdjustments.length !== cntAdjs) {
            throw new Error(`Post-restore count mismatch on stockAdjustments (expected ${data.stockAdjustments.length}, found ${cntAdjs})`);
          }
          if (data.peerTrades.length !== cntTrades) {
            throw new Error(`Post-restore count mismatch on peerTrades (expected ${data.peerTrades.length}, found ${cntTrades})`);
          }
          if (data.softDeletedItems.length !== cntSoft) {
            throw new Error(`Post-restore count mismatch on softDeletedItems (expected ${data.softDeletedItems.length}, found ${cntSoft})`);
          }
          if (restoredAttachments.length !== cntAtts) {
            throw new Error(`Post-restore count mismatch on attachments (expected ${restoredAttachments.length}, found ${cntAtts})`);
          }
          if (data.returnsAndRefunds && db.returnsAndRefunds) {
            const expectedReturns = data.returnsAndRefunds.length;
            if (expectedReturns !== cntReturns) {
              throw new Error(`Post-restore count mismatch on returnsAndRefunds (expected ${expectedReturns}, found ${cntReturns})`);
            }
          }

          // 2. Exact primary key matching verification
          if (data.products.length > 0) {
            const restoredProdIds = new Set((await db.products.toArray()).map((p) => p.id));
            for (const p of data.products) {
              if (!restoredProdIds.has(p.id)) {
                throw new Error(`Post-restore integrity check failed: Product ID ${p.id} missing in database`);
              }
            }
          }
          if (data.sales.length > 0) {
            const restoredSaleIds = new Set((await db.sales.toArray()).map((s) => s.id));
            for (const s of data.sales) {
              if (!restoredSaleIds.has(s.id)) {
                throw new Error(`Post-restore integrity check failed: Sale ID ${s.id} missing in database`);
              }
            }
          }
          if (data.transactions.length > 0) {
            const restoredTxIds = new Set((await db.transactions.toArray()).map((t) => t.id));
            for (const t of data.transactions) {
              if (!restoredTxIds.has(t.id)) {
                throw new Error(`Post-restore integrity check failed: Transaction ID ${t.id} missing in database`);
              }
            }
          }
          if (data.returnsAndRefunds && data.returnsAndRefunds.length > 0 && db.returnsAndRefunds) {
            const restoredReturnIds = new Set((await db.returnsAndRefunds.toArray()).map((r) => r.id));
            for (const r of data.returnsAndRefunds) {
              if (!restoredReturnIds.has(r.id)) {
                throw new Error(`Post-restore integrity check failed: Return ID ${r.id} missing in database`);
              }
            }
          }
        } else {
          // SMART_MERGE post-restore integrity check:
          // 1. Verify all incoming IDs are present in DB
          if (data.products.length > 0) {
            const restoredProdIds = new Set((await db.products.toArray()).map((p) => p.id));
            for (const p of data.products) {
              if (!restoredProdIds.has(p.id)) {
                throw new Error(`Post-restore smart-merge check failed: Product ID ${p.id} missing in database`);
              }
            }
          }
          if (data.returnsAndRefunds && data.returnsAndRefunds.length > 0 && db.returnsAndRefunds) {
            const restoredReturnIds = new Set((await db.returnsAndRefunds.toArray()).map((r) => r.id));
            for (const r of data.returnsAndRefunds) {
              if (!restoredReturnIds.has(r.id)) {
                throw new Error(`Post-restore smart-merge check failed: Return ID ${r.id} missing in database`);
              }
            }
          }
          // 2. Verify audit logs contain no duplicates
          const allLogs = await db.auditLogs.toArray();
          const logIdSet = new Set<string>();
          for (const log of allLogs) {
            if (logIdSet.has(log.id)) {
              throw new Error(`Post-restore audit log integrity check failed: Duplicate audit log ID ${log.id}`);
            }
            logIdSet.add(log.id);
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
    // Automatic fallback & recovery from pre-restore snapshot
    try {
      await restoreFromSnapshot(snapshotId, db);
    } catch (recoveryErr) {
      console.error('Pre-restore snapshot auto-recovery error:', recoveryErr);
    }
    throw new Error(`Restore လုပ်ဆောင်မှု မအောင်မြင်ပါ (${err.message})။ Pre-restore snapshot (${snapshotId}) မှ မူလဒေတာများကို အလိုအလျောက် ပြန်လည်ရယူထိန်းသိမ်းထားပါသည်။`);
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
  await enforcePermission('BACKUP_RESTORE', 'အရန်သိမ်းဆည်းမှုမှ ပြန်လည်ရယူခြင်း (Snapshot Rollback)');
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
      targetDb.softDeletedItems,
      targetDb.attachments,
      targetDb.rawMaterialPresets,
      targetDb.auditLogs,
      targetDb.stockMovements,
      targetDb.cashMovements,
      targetDb.dailyClosings,
      targetDb.returnsAndRefunds,
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
        targetDb.softDeletedItems.clear(),
        targetDb.attachments.clear(),
        targetDb.rawMaterialPresets.clear(),
        targetDb.auditLogs.clear(),
        targetDb.stockMovements.clear(),
        targetDb.cashMovements.clear(),
        targetDb.dailyClosings.clear(),
        targetDb.returnsAndRefunds ? targetDb.returnsAndRefunds.clear() : Promise.resolve(),
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
      if (data.peerTrades && data.peerTrades.length > 0) await targetDb.peerTrades.bulkPut(data.peerTrades);
      if (data.softDeletedItems && data.softDeletedItems.length > 0) await targetDb.softDeletedItems.bulkPut(data.softDeletedItems);
      if (data.attachments && data.attachments.length > 0) await targetDb.attachments.bulkPut(data.attachments);
      if (data.rawMaterialPresets && data.rawMaterialPresets.length > 0) await targetDb.rawMaterialPresets.bulkPut(data.rawMaterialPresets);
      if (data.auditLogs && data.auditLogs.length > 0) await targetDb.auditLogs.bulkPut(data.auditLogs);
      if (data.stockMovements && data.stockMovements.length > 0) {
        await targetDb.stockMovements.bulkPut(data.stockMovements);
      }
      if (data.cashMovements && data.cashMovements.length > 0) {
        await targetDb.cashMovements.bulkPut(data.cashMovements);
      }
      if (data.dailyClosings && data.dailyClosings.length > 0) {
        await targetDb.dailyClosings.bulkPut(data.dailyClosings);
      }
      if (data.returnsAndRefunds && data.returnsAndRefunds.length > 0 && targetDb.returnsAndRefunds) {
        await targetDb.returnsAndRefunds.bulkPut(data.returnsAndRefunds);
      }

      if (data.shopSettings) saveStoredShopSettings(data.shopSettings);

      await targetDb.auditLogs.put({
        id: generateStableId('aud'),
        action: 'ROLLBACK_TO_SNAPSHOT',
        actionType: 'DATABASE_RECOVERY',
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
  await enforcePermission('BACKUP_RESTORE', 'အရန်သိမ်းဆည်းမှု ဖျက်ပစ်ခြင်း');
  await db.recoverySnapshots.delete(snapshotId);
}

/**
 * Clears all recovery snapshots
 */
export async function clearAllRecoverySnapshots(): Promise<void> {
  await enforcePermission('BACKUP_RESTORE', 'အရန်သိမ်းဆည်းမှုများ အားလုံး ရှင်းလင်းခြင်း');
  await db.recoverySnapshots.clear();
}

/**
 * Convenience wrapper for generating backup payload (encrypted or plain)
 */
export async function exportBackupPayload(options?: {
  customNotes?: string;
  shopSettings?: ShopSettings;
  passphrase?: string;
}): Promise<VersionedBackupFile | EncryptedBackupEnvelope> {
  if (options?.passphrase) {
    return createCompleteBackup({ ...options, passphrase: options.passphrase });
  }
  return createCompleteBackup(options as any);
}

/**
 * Exports complete Dexie DB backup as a JSON string (encrypted if passphrase provided)
 */
export async function exportDatabaseJSON(passphrase?: string): Promise<string> {
  const payload = await exportBackupPayload({ passphrase });
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports and parses a backup JSON string (decrypting if encrypted)
 */
export async function importDatabaseJSON(
  jsonString: string,
  passphrase?: string
): Promise<VersionedBackupFile> {
  let parsed: any;
  try {
    parsed = safeJsonParse(jsonString);
  } catch {
    throw new Error('စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်');
  }

  if (parsed && typeof parsed === 'object' && parsed.encrypted === true) {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်');
    }
    const decryptedStr = await decryptBackupPayload(parsed, passphrase.trim());
    try {
      return safeJsonParse(decryptedStr);
    } catch {
      throw new Error('စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်');
    }
  }

  return parsed;
}

/**
 * Restores DB from raw JSON payload or object, supporting encrypted payloads
 */
export async function restoreFromBackupPayload(
  payload: any,
  mode: 'OVERWRITE' | 'SMART_MERGE' = 'SMART_MERGE',
  passphrase?: string
): Promise<{ success: boolean; message: string }> {
  let finalObj = payload;
  if (typeof payload === 'string') {
    finalObj = await importDatabaseJSON(payload, passphrase);
  } else if (payload && typeof payload === 'object' && payload.encrypted === true) {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်');
    }
    const decryptedStr = await decryptBackupPayload(payload, passphrase.trim());
    finalObj = safeJsonParse(decryptedStr);
  }

  const report = await validateBackupFile(finalObj, passphrase);
  if (!report.isValid) {
    throw new Error(
      report.errors[0]?.message || 'စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်'
    );
  }

  return executeSafeRestore(report, mode);
}

