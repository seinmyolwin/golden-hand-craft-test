import Dexie, { type EntityTable } from 'dexie';
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
  ShopSettings,
  AppLockSettings,
  BackupReminderSettings,
  AutoRecoverySnapshot,
  RawMaterialPreset,
  StockMovementRecord,
  CashMovementRecord,
  DailyClosingRecord,
  ReturnRecord,
} from '../types';

export interface SettingRecord {
  key: string;
  value: any;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  voucherId: string;
  ownerId?: string;
  blob?: Blob;
  thumbnail?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  caption?: string;
  createdAt: string;
  imageBase64?: string;
}

export class ShweLetYarDatabase extends Dexie {
  products!: EntityTable<Product, 'id'>;
  suppliers!: EntityTable<Supplier, 'id'>;
  merchants!: EntityTable<Merchant, 'id'>;
  transactions!: EntityTable<TransactionRecord, 'id'>;
  sales!: EntityTable<SaleRecord, 'id'>;
  merchantPurchases!: EntityTable<MerchantPurchaseRecord, 'id'>;
  orders!: EntityTable<MerchantOrder, 'id'>;
  stockAdjustments!: EntityTable<StockAdjustmentRecord, 'id'>;
  peerTrades!: EntityTable<PeerTradeRecord, 'id'>;
  softDeletedItems!: EntityTable<SoftDeletedItem, 'id'>;
  auditLogs!: EntityTable<AuditLogEntry, 'id'>;
  rawMaterialPresets!: EntityTable<RawMaterialPreset, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  recoverySnapshots!: EntityTable<AutoRecoverySnapshot, 'id'>;
  attachments!: EntityTable<AttachmentRecord, 'id'>;
  stockMovements!: EntityTable<StockMovementRecord, 'id'>;
  cashMovements!: EntityTable<CashMovementRecord, 'id'>;
  dailyClosings!: EntityTable<DailyClosingRecord, 'id'>;
  returnsAndRefunds!: EntityTable<ReturnRecord, 'id'>;

  constructor() {
    super('ShweLetYarProductionDB');

    // Version 1: Initial schema
    this.version(1).stores({
      products: 'id, name, category, active',
      suppliers: 'id, code, name, phone, village, updatedAt',
      merchants: 'id, code, name, town, phone, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, createdAt',
      sales: 'id, voucherNo, merchantId, date, time, createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, createdAt',
    });

    // Version 2: Enhanced composite indexes for offline analytics & reports
    this.version(2).stores({
      products: 'id, name, category, active, currentStock',
      suppliers: 'id, code, name, phone, village, currentAdvanceBalance, updatedAt',
      merchants: 'id, code, name, town, phone, currentReceivableBalance, payableBalance, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, [date+supplierId], createdAt',
      sales: 'id, voucherNo, merchantId, date, time, [date+merchantId], createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, [date+merchantId], createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType, entityId',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, createdAt',
    });

    // Version 3: Raw material presets and optimized query indices
    this.version(3).stores({
      products: 'id, name, category, active, currentStock, minStockAlert',
      suppliers: 'id, code, name, phone, village, currentAdvanceBalance, updatedAt',
      merchants: 'id, code, name, town, phone, currentReceivableBalance, payableBalance, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, [date+supplierId], createdAt',
      sales: 'id, voucherNo, merchantId, date, time, [date+merchantId], createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, [date+merchantId], createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType, entityId',
      rawMaterialPresets: 'id, category, name',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, createdAt',
    });

    // Version 4: IndexedDB Blob storage for photo attachments with metadata & owner reference
    this.version(4).stores({
      products: 'id, name, category, active, currentStock, minStockAlert',
      suppliers: 'id, code, name, phone, village, currentAdvanceBalance, updatedAt',
      merchants: 'id, code, name, town, phone, currentReceivableBalance, payableBalance, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, [date+supplierId], createdAt',
      sales: 'id, voucherNo, merchantId, date, time, [date+merchantId], createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, [date+merchantId], createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType, entityId',
      rawMaterialPresets: 'id, category, name',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, ownerId, createdAt',
    });

    // Version 5: Professional Stock Ledger (stockMovements table)
    this.version(5).stores({
      products: 'id, name, category, active, currentStock, minStockAlert',
      suppliers: 'id, code, name, phone, village, currentAdvanceBalance, updatedAt',
      merchants: 'id, code, name, town, phone, currentReceivableBalance, payableBalance, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, [date+supplierId], createdAt',
      sales: 'id, voucherNo, merchantId, date, time, [date+merchantId], createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, [date+merchantId], createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType, entityId',
      rawMaterialPresets: 'id, category, name',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, ownerId, createdAt',
      stockMovements: 'id, productId, movementType, referenceType, referenceId, idempotencyKey, transactionDate, [productId+transactionDate], status, createdAt',
    });

    // Version 6: Cash Ledger & Daily Closing
    this.version(6).stores({
      products: 'id, name, category, active, currentStock, minStockAlert',
      suppliers: 'id, code, name, phone, village, currentAdvanceBalance, updatedAt',
      merchants: 'id, code, name, town, phone, currentReceivableBalance, payableBalance, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, [date+supplierId], createdAt',
      sales: 'id, voucherNo, merchantId, date, time, [date+merchantId], createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, [date+merchantId], createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType, entityId',
      rawMaterialPresets: 'id, category, name',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, ownerId, createdAt',
      stockMovements: 'id, productId, movementType, referenceType, referenceId, idempotencyKey, transactionDate, [productId+transactionDate], status, createdAt',
      cashMovements: 'id, type, referenceType, referenceId, idempotencyKey, transactionDate, [transactionDate+type], status, createdAt',
      dailyClosings: 'id, closingDate, status, closedAt, createdAt',
    });

    // Version 7: Returns, Refunds & Reversals
    this.version(7).stores({
      products: 'id, name, category, active, currentStock, minStockAlert',
      suppliers: 'id, code, name, phone, village, currentAdvanceBalance, updatedAt',
      merchants: 'id, code, name, town, phone, currentReceivableBalance, payableBalance, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, [date+supplierId], createdAt',
      sales: 'id, voucherNo, merchantId, date, time, [date+merchantId], createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, [date+merchantId], createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType, entityId',
      rawMaterialPresets: 'id, category, name',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, ownerId, createdAt',
      stockMovements: 'id, productId, movementType, referenceType, referenceId, idempotencyKey, transactionDate, [productId+transactionDate], status, createdAt',
      cashMovements: 'id, type, referenceType, referenceId, idempotencyKey, transactionDate, [transactionDate+type], status, createdAt',
      dailyClosings: 'id, closingDate, status, closedAt, createdAt',
      returnsAndRefunds: 'id, returnNo, type, referenceType, referenceId, merchantId, supplierId, date, status, idempotencyKey, createdAt',
    });

    // Version 8: Immutable Audit Trail & Traceability Indexing
    this.version(8).stores({
      products: 'id, name, category, active, currentStock, minStockAlert',
      suppliers: 'id, code, name, phone, village, currentAdvanceBalance, updatedAt',
      merchants: 'id, code, name, town, phone, currentReceivableBalance, payableBalance, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, [date+supplierId], createdAt',
      sales: 'id, voucherNo, merchantId, date, time, [date+merchantId], createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, [date+merchantId], createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, actionType, timestamp, entityType, entityId, referenceType, referenceId, referenceVoucherNo, createdAt',
      rawMaterialPresets: 'id, category, name',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, ownerId, createdAt',
      stockMovements: 'id, productId, movementType, referenceType, referenceId, idempotencyKey, transactionDate, [productId+transactionDate], status, createdAt',
      cashMovements: 'id, type, referenceType, referenceId, idempotencyKey, transactionDate, [transactionDate+type], status, createdAt',
      dailyClosings: 'id, closingDate, status, closedAt, createdAt',
      returnsAndRefunds: 'id, returnNo, type, referenceType, referenceId, merchantId, supplierId, date, status, idempotencyKey, createdAt',
    });
  }
}

export const db = new ShweLetYarDatabase();
