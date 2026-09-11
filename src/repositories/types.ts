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
  SettingRecord,
  AttachmentRecord,
  StockMovementRecord,
  CashMovementRecord,
  DailyClosingRecord,
} from '../types';

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | undefined>;
  getActive(): Promise<Product[]>;
  getByCategory(category: string): Promise<Product[]>;
  save(product: Product): Promise<string>;
  saveMany(products: Product[]): Promise<void>;
  updateStock(id: string, newStock: number): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface ISupplierRepository {
  getAll(): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | undefined>;
  save(supplier: Supplier): Promise<string>;
  saveMany(suppliers: Supplier[]): Promise<void>;
  updateAdvanceBalance(id: string, newAdvanceBalance: number): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface IMerchantRepository {
  getAll(): Promise<Merchant[]>;
  getById(id: string): Promise<Merchant | undefined>;
  save(merchant: Merchant): Promise<string>;
  saveMany(merchants: Merchant[]): Promise<void>;
  updateReceivableBalance(id: string, newReceivableBalance: number): Promise<void>;
  recordMerchantPaymentAtomic(
    merchantId: string,
    paymentAmount: number,
    paymentMethod?: string,
    notes?: string
  ): Promise<Merchant>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface ITransactionRepository {
  getAll(): Promise<TransactionRecord[]>;
  getById(id: string): Promise<TransactionRecord | undefined>;
  getBySupplier(supplierId: string): Promise<TransactionRecord[]>;
  getByDate(date: string): Promise<TransactionRecord[]>;
  save(tx: TransactionRecord): Promise<string>;
  saveInboundAtomic(tx: TransactionRecord): Promise<TransactionRecord>;
  cancelInboundAtomic(txId: string, reason?: string): Promise<TransactionRecord>;
  recordSupplierAdvanceAtomic(
    supplierId: string,
    advanceAmount: number,
    reason?: string,
    date?: string,
    time?: string
  ): Promise<TransactionRecord>;
  saveMany(records: TransactionRecord[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface ISaleRepository {
  getAll(): Promise<SaleRecord[]>;
  getById(id: string): Promise<SaleRecord | undefined>;
  getByMerchant(merchantId: string): Promise<SaleRecord[]>;
  getByDate(date: string): Promise<SaleRecord[]>;
  save(sale: SaleRecord): Promise<string>;
  saveSaleAtomic(sale: SaleRecord): Promise<SaleRecord>;
  cancelSaleAtomic(saleId: string, reason?: string): Promise<SaleRecord>;
  saveMany(sales: SaleRecord[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface IMerchantPurchaseRepository {
  getAll(): Promise<MerchantPurchaseRecord[]>;
  getById(id: string): Promise<MerchantPurchaseRecord | undefined>;
  getByMerchant(merchantId: string): Promise<MerchantPurchaseRecord[]>;
  save(purchase: MerchantPurchaseRecord): Promise<string>;
  savePurchaseAtomic(purchase: MerchantPurchaseRecord): Promise<MerchantPurchaseRecord>;
  cancelPurchaseAtomic(purchaseId: string, reason?: string): Promise<MerchantPurchaseRecord>;
  saveMany(purchases: MerchantPurchaseRecord[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface IOrderRepository {
  getAll(): Promise<MerchantOrder[]>;
  getById(id: string): Promise<MerchantOrder | undefined>;
  getByStatus(status: string): Promise<MerchantOrder[]>;
  save(order: MerchantOrder): Promise<string>;
  completeOrderAtomic(orderId: string, saleRecord?: SaleRecord): Promise<MerchantOrder>;
  cancelOrderAtomic(orderId: string, reason?: string): Promise<MerchantOrder>;
  saveMany(orders: MerchantOrder[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface IPeerTradeRepository {
  getAll(): Promise<PeerTradeRecord[]>;
  getById(id: string): Promise<PeerTradeRecord | undefined>;
  save(trade: PeerTradeRecord): Promise<string>;
  saveTradeAtomic(trade: PeerTradeRecord): Promise<PeerTradeRecord>;
  saveMany(trades: PeerTradeRecord[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface IStockAdjustmentRepository {
  getAll(): Promise<StockAdjustmentRecord[]>;
  getById(id: string): Promise<StockAdjustmentRecord | undefined>;
  save(adj: StockAdjustmentRecord): Promise<string>;
  saveAdjustmentAtomic(adj: StockAdjustmentRecord): Promise<StockAdjustmentRecord>;
  saveMany(adjustments: StockAdjustmentRecord[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface ISoftDeleteRepository {
  getAll(): Promise<SoftDeletedItem[]>;
  getById(id: string): Promise<SoftDeletedItem | undefined>;
  save(item: SoftDeletedItem): Promise<string>;
  softDeleteAtomic(
    entityType: 'PRODUCT' | 'SUPPLIER' | 'MERCHANT' | 'TRANSACTION' | 'SALE' | string,
    id: string,
    name?: string,
    reason?: string
  ): Promise<SoftDeletedItem>;
  restoreAtomic(softDeleteId: string): Promise<any>;
  saveMany(items: SoftDeletedItem[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface IAuditRepository {
  getAll(): Promise<AuditLogEntry[]>;
  log(action: string, details: string, entityType?: string, entityId?: string): Promise<void>;
  saveMany(logs: AuditLogEntry[]): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface IRawMaterialPresetRepository {
  getAll(): Promise<RawMaterialPreset[]>;
  getById(id: string): Promise<RawMaterialPreset | undefined>;
  save(preset: RawMaterialPreset): Promise<string>;
  saveMany(presets: RawMaterialPreset[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

export interface ISettingsRepository {
  get<T>(key: string, defaultValue: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<SettingRecord[]>;
}

export interface IAttachmentRepository {
  save(voucherId: string, input: File | Blob | string, caption?: string, ownerId?: string): Promise<string>;
  getByVoucher(voucherId: string): Promise<AttachmentRecord[]>;
  delete(id: string, options?: { force?: boolean }): Promise<void>;
  deleteByVoucher(voucherId: string): Promise<void>;
  count(): Promise<number>;
  cleanupOrphans?(): Promise<number>;
  migrateLegacy?(): Promise<number>;
}

export interface IStockMovementRepository {
  getAll(): Promise<StockMovementRecord[]>;
  getById(id: string): Promise<StockMovementRecord | undefined>;
  getByProduct(productId: string): Promise<StockMovementRecord[]>;
  getByReference(referenceType: string, referenceId: string): Promise<StockMovementRecord[]>;
  getByIdempotencyKey(key: string): Promise<StockMovementRecord | undefined>;
  recordMovement(movement: StockMovementRecord): Promise<string>;
  recordMovementsMany(movements: StockMovementRecord[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export interface ICashMovementRepository {
  getAll(): Promise<CashMovementRecord[]>;
  getById(id: string): Promise<CashMovementRecord | undefined>;
  getByDate(date: string): Promise<CashMovementRecord[]>;
  getByReference(referenceType: string, referenceId: string): Promise<CashMovementRecord[]>;
  getByIdempotencyKey(key: string): Promise<CashMovementRecord | undefined>;
  recordMovement(movement: CashMovementRecord): Promise<string>;
  recordMovementsMany(movements: CashMovementRecord[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export interface IDailyClosingRepository {
  getAll(): Promise<DailyClosingRecord[]>;
  getByDate(date: string): Promise<DailyClosingRecord | undefined>;
  save(closing: DailyClosingRecord): Promise<string>;
  saveMany(closings: DailyClosingRecord[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

