import { db, ShweLetYarDatabase } from '../db/database';
import {
  saveAttachmentRecord,
  getAttachmentsForVoucher as getServiceAttachmentsForVoucher,
  deleteAttachmentSafely,
  cleanupOrphanAttachments,
  migrateLegacyAttachments,
} from '../services/attachmentService';
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
} from '../types';
import {
  IProductRepository,
  ISupplierRepository,
  IMerchantRepository,
  ITransactionRepository,
  ISaleRepository,
  IMerchantPurchaseRepository,
  IOrderRepository,
  IPeerTradeRepository,
  IStockAdjustmentRepository,
  ISoftDeleteRepository,
  IAuditRepository,
  IRawMaterialPresetRepository,
  ISettingsRepository,
  IAttachmentRepository,
} from './types';
import {
  BusinessIntegrityError,
  IdempotencyConflictError,
  EntityNotFoundError,
  InvalidStateTransitionError,
  AccountingInvariantError,
} from './errors';
import { generateStableId, generateVoucherNo } from '../utils/idGenerator';

export * from './types';
export * from './errors';

export class ProductRepository implements IProductRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Product[]> {
    return this.database.products.toArray();
  }

  async getById(id: string): Promise<Product | undefined> {
    return this.database.products.get(id);
  }

  async getActive(): Promise<Product[]> {
    return this.database.products.filter((p) => p.active !== false).toArray();
  }

  async getByCategory(category: string): Promise<Product[]> {
    return this.database.products.where('category').equals(category).toArray();
  }

  async save(product: Product): Promise<string> {
    const now = new Date().toISOString();
    const toSave: Product = {
      ...product,
      id: product.id || generateStableId('prod'),
      createdAt: product.createdAt || now,
      updatedAt: now,
      revision: (product.revision || 0) + 1,
    };
    await this.database.products.put(toSave);
    return toSave.id;
  }

  async saveMany(products: Product[]): Promise<void> {
    const now = new Date().toISOString();
    const enriched = products.map((p) => ({
      ...p,
      id: p.id || generateStableId('prod'),
      createdAt: p.createdAt || now,
      updatedAt: now,
      revision: (p.revision || 0) + 1,
    }));
    await this.database.products.bulkPut(enriched);
  }

  async updateStock(id: string, newStock: number): Promise<void> {
    const product = await this.database.products.get(id);
    if (!product) {
      throw new EntityNotFoundError('Product', id);
    }
    await this.database.products.update(id, {
      currentStock: newStock,
      updatedAt: new Date().toISOString(),
      revision: (product.revision || 0) + 1,
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.products.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.products.clear();
  }

  async count(): Promise<number> {
    return this.database.products.count();
  }
}

export class SupplierRepository implements ISupplierRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Supplier[]> {
    return this.database.suppliers.toArray();
  }

  async getById(id: string): Promise<Supplier | undefined> {
    return this.database.suppliers.get(id);
  }

  async save(supplier: Supplier): Promise<string> {
    const now = new Date().toISOString();
    const toSave: Supplier = {
      ...supplier,
      id: supplier.id || generateStableId('sup'),
      createdAt: supplier.createdAt || now,
      updatedAt: now,
    };
    await this.database.suppliers.put(toSave);
    return toSave.id;
  }

  async saveMany(suppliers: Supplier[]): Promise<void> {
    const now = new Date().toISOString();
    const enriched = suppliers.map((s) => ({
      ...s,
      id: s.id || generateStableId('sup'),
      createdAt: s.createdAt || now,
      updatedAt: now,
    }));
    await this.database.suppliers.bulkPut(enriched);
  }

  async updateAdvanceBalance(id: string, newAdvanceBalance: number): Promise<void> {
    const supplier = await this.database.suppliers.get(id);
    if (!supplier) {
      throw new EntityNotFoundError('Supplier', id);
    }
    await this.database.suppliers.update(id, {
      currentAdvanceBalance: newAdvanceBalance,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.suppliers.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.suppliers.clear();
  }

  async count(): Promise<number> {
    return this.database.suppliers.count();
  }
}

export class MerchantRepository implements IMerchantRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Merchant[]> {
    return this.database.merchants.toArray();
  }

  async getById(id: string): Promise<Merchant | undefined> {
    return this.database.merchants.get(id);
  }

  async save(merchant: Merchant): Promise<string> {
    const now = new Date().toISOString();
    const toSave: Merchant = {
      ...merchant,
      id: merchant.id || generateStableId('merch'),
      createdAt: merchant.createdAt || now,
      updatedAt: now,
    };
    await this.database.merchants.put(toSave);
    return toSave.id;
  }

  async saveMany(merchants: Merchant[]): Promise<void> {
    const now = new Date().toISOString();
    const enriched = merchants.map((m) => ({
      ...m,
      id: m.id || generateStableId('merch'),
      createdAt: m.createdAt || now,
      updatedAt: now,
    }));
    await this.database.merchants.bulkPut(enriched);
  }

  async updateReceivableBalance(id: string, newReceivableBalance: number): Promise<void> {
    const merchant = await this.database.merchants.get(id);
    if (!merchant) {
      throw new EntityNotFoundError('Merchant', id);
    }
    await this.database.merchants.update(id, {
      currentReceivableBalance: newReceivableBalance,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Atomic customer/merchant payment settlement
   */
  async recordMerchantPaymentAtomic(
    merchantId: string,
    paymentAmount: number,
    paymentMethod: string = 'CASH',
    notes?: string
  ): Promise<Merchant> {
    if (paymentAmount <= 0) {
      throw new BusinessIntegrityError('ပေးဆပ်ငွေပမာဏသည် ၀ ထက် ကြီးရပါမည်', 'INVALID_AMOUNT');
    }

    return this.database.transaction(
      'rw',
      [this.database.merchants, this.database.auditLogs],
      async () => {
        const merchant = await this.database.merchants.get(merchantId);
        if (!merchant) {
          throw new EntityNotFoundError('Merchant', merchantId);
        }

        const prevBalance = merchant.currentReceivableBalance || 0;
        const newBalance = Math.max(0, prevBalance - paymentAmount);
        const updatedMerchant: Merchant = {
          ...merchant,
          currentReceivableBalance: newBalance,
          totalPaidAmount: (merchant.totalPaidAmount || 0) + paymentAmount,
          updatedAt: new Date().toISOString(),
        };

        await this.database.merchants.put(updatedMerchant);

        // Audit Log
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'ကုန်သည်ကြွေးကျန် ပေးဆပ်ခြင်း (Atomic)',
          details: `${merchant.name} (${merchant.town}): ပေးဆပ်ငွေ ${paymentAmount.toLocaleString()} ကျပ် (${paymentMethod}) | လက်ကျန်ကြွေး: ${newBalance.toLocaleString()} ကျပ်${notes ? ` | မှတ်ချက်: ${notes}` : ''}`,
          timestamp: new Date().toISOString(),
          entityType: 'MERCHANT',
          entityId: merchant.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return updatedMerchant;
      }
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.merchants.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.merchants.clear();
  }

  async count(): Promise<number> {
    return this.database.merchants.count();
  }
}

export class TransactionRepository implements ITransactionRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<TransactionRecord[]> {
    return this.database.transactions.reverse().sortBy('date');
  }

  async getById(id: string): Promise<TransactionRecord | undefined> {
    return this.database.transactions.get(id);
  }

  async getBySupplier(supplierId: string): Promise<TransactionRecord[]> {
    return this.database.transactions.where('supplierId').equals(supplierId).toArray();
  }

  async getByDate(date: string): Promise<TransactionRecord[]> {
    return this.database.transactions.where('date').equals(date).toArray();
  }

  async save(tx: TransactionRecord): Promise<string> {
    await this.database.transactions.put(tx);
    return tx.id;
  }

  /**
   * Atomic Inbound Goods Collection & Supplier Balance Settlement
   * Guarantees ACID all-or-nothing execution:
   * 1. Idempotency & validation check
   * 2. Increments finished goods stock
   * 3. Updates supplier advance balance & aggregates
   * 4. Inserts transaction record with completed status
   * 5. Appends audit log
   */
  async saveInboundAtomic(tx: TransactionRecord): Promise<TransactionRecord> {
    return this.database.transaction(
      'rw',
      [this.database.transactions, this.database.suppliers, this.database.products, this.database.auditLogs],
      async () => {
        // 1. Idempotency protection
        if (tx.id) {
          const existing = await this.database.transactions.get(tx.id);
          if (existing && existing.status !== 'CANCELLED') {
            throw new IdempotencyConflictError(`Transaction ID "${tx.id}" has already been processed.`);
          }
        }

        // 2. Validate supplier
        const supplier = await this.database.suppliers.get(tx.supplierId);
        if (!supplier) {
          throw new EntityNotFoundError('Supplier', tx.supplierId);
        }

        // 3. Validate products & adjust inventory for collected items
        if (Array.isArray(tx.items)) {
          for (const item of tx.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (!product) {
              throw new EntityNotFoundError('Product', item.productId);
            }
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            const updatedStock = currentStock + (item.quantity || 0);
            await this.database.products.update(item.productId, {
              currentStock: updatedStock,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // 4. Update supplier balance & delivered stats
        const updatedSupplier: Supplier = {
          ...supplier,
          currentAdvanceBalance: tx.remainingAdvanceBalance,
          totalGoodsValueDelivered:
            (supplier.totalGoodsValueDelivered || supplier.totalGoodsDeliveredValue || 0) + (tx.totalGoodsValue || 0),
          totalAdvanceGiven:
            (supplier.totalAdvanceGiven || supplier.totalAdvancesGiven || 0) + (tx.newAdvanceTaken || 0),
          updatedAt: new Date().toISOString(),
        };
        await this.database.suppliers.put(updatedSupplier);

        // 5. Save transaction record
        const now = new Date().toISOString();
        const enrichedTx: TransactionRecord = {
          ...tx,
          id: tx.id || generateStableId('tx'),
          voucherNo: tx.voucherNo || generateVoucherNo('TX', tx.date),
          status: 'COMPLETED',
          createdAt: tx.createdAt || now,
          updatedAt: now,
          revision: (tx.revision || 0) + 1,
        };
        await this.database.transactions.put(enrichedTx);

        // 6. Audit Log
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'ကုန်သိမ်းစာရင်း ရေးသွင်းခြင်း (Atomic)',
          details: `ဘောင်ချာ ${enrichedTx.voucherNo} - ${tx.supplierName}: တန်ဖိုး ${(tx.totalGoodsValue || 0).toLocaleString()} ကျပ် | အကြိုငွေနုတ်: ${(tx.advanceDeducted || 0).toLocaleString()} ကျပ် | လက်ကျန်: ${tx.remainingAdvanceBalance.toLocaleString()} ကျပ်`,
          timestamp: `${tx.date} ${tx.time || ''}`.trim() || now,
          entityType: 'TRANSACTION',
          entityId: enrichedTx.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return enrichedTx;
      }
    );
  }

  /**
   * Atomic Inbound Goods Cancellation (Purchase Reversal)
   * 1. Decrements finished goods stock (reverses stock addition)
   * 2. Reverses supplier balance and aggregates
   * 3. Marks transaction as CANCELLED
   * 4. Logs audit entry
   */
  async cancelInboundAtomic(txId: string, reason: string = 'သုံးစွဲသူမှ ပယ်ဖျက်သည်'): Promise<TransactionRecord> {
    return this.database.transaction(
      'rw',
      [this.database.transactions, this.database.suppliers, this.database.products, this.database.auditLogs],
      async () => {
        const tx = await this.database.transactions.get(txId);
        if (!tx) {
          throw new EntityNotFoundError('Transaction', txId);
        }
        if (tx.status === 'CANCELLED') {
          throw new InvalidStateTransitionError('ဤကုန်သိမ်းစာရင်းအား ဖျက်သိမ်းပြီးဖြစ်ပါသည်');
        }

        // 1. Revert product stocks
        if (Array.isArray(tx.items)) {
          for (const item of tx.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (product) {
              const currentStock = product.currentStock ?? product.openingStock ?? 0;
              const newStock = Math.max(0, currentStock - (item.quantity || 0));
              await this.database.products.update(item.productId, {
                currentStock: newStock,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }

        // 2. Revert supplier balance
        const supplier = await this.database.suppliers.get(tx.supplierId);
        if (supplier) {
          // Re-add deducted advance or revert to previous balance
          const revertedAdvanceBalance = tx.previousAdvanceBalance ?? supplier.currentAdvanceBalance;
          const updatedSupplier: Supplier = {
            ...supplier,
            currentAdvanceBalance: revertedAdvanceBalance,
            totalGoodsValueDelivered: Math.max(
              0,
              (supplier.totalGoodsValueDelivered || supplier.totalGoodsDeliveredValue || 0) - (tx.totalGoodsValue || 0)
            ),
            totalAdvanceGiven: Math.max(
              0,
              (supplier.totalAdvanceGiven || supplier.totalAdvancesGiven || 0) - (tx.newAdvanceTaken || 0)
            ),
            updatedAt: new Date().toISOString(),
          };
          await this.database.suppliers.put(updatedSupplier);
        }

        // 3. Mark transaction as CANCELLED
        const now = new Date().toISOString();
        const cancelledTx: TransactionRecord = {
          ...tx,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: now,
          updatedAt: now,
        };
        await this.database.transactions.put(cancelledTx);

        // 4. Audit Log
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'ကုန်သိမ်းစာရင်း ပြန်လည်ဖျက်သိမ်းခြင်း (Atomic Rollback)',
          details: `ဘောင်ချာ ${tx.voucherNo || tx.id} (${tx.supplierName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
          timestamp: now,
          entityType: 'TRANSACTION',
          entityId: tx.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return cancelledTx;
      }
    );
  }

  /**
   * Atomic Advance Payment Given to Supplier
   */
  async recordSupplierAdvanceAtomic(
    supplierId: string,
    advanceAmount: number,
    reason: string = 'အကြိုငွေထုတ်ပေးခြင်း',
    dateStr?: string,
    timeStr?: string
  ): Promise<TransactionRecord> {
    if (advanceAmount <= 0) {
      throw new BusinessIntegrityError('အကြိုငွေပမာဏသည် ၀ ထက် ကြီးရပါမည်', 'INVALID_AMOUNT');
    }

    return this.database.transaction(
      'rw',
      [this.database.transactions, this.database.suppliers, this.database.auditLogs],
      async () => {
        const supplier = await this.database.suppliers.get(supplierId);
        if (!supplier) {
          throw new EntityNotFoundError('Supplier', supplierId);
        }

        const now = new Date();
        const date = dateStr || now.toISOString().split('T')[0];
        const time = timeStr || now.toTimeString().slice(0, 5);

        const prevBalance = supplier.currentAdvanceBalance || 0;
        const newBalance = prevBalance + advanceAmount;

        const updatedSupplier: Supplier = {
          ...supplier,
          currentAdvanceBalance: newBalance,
          totalAdvanceGiven: (supplier.totalAdvanceGiven || supplier.totalAdvancesGiven || 0) + advanceAmount,
          updatedAt: now.toISOString(),
        };
        await this.database.suppliers.put(updatedSupplier);

        // Record Transaction
        const tx: TransactionRecord = {
          id: generateStableId('tx_adv'),
          voucherNo: generateVoucherNo('ADV', date),
          supplierId,
          supplierName: supplier.name,
          supplierVillage: supplier.village,
          date,
          time,
          type: 'ADVANCE_ONLY',
          items: [],
          totalGoodsValue: 0,
          previousAdvanceBalance: prevBalance,
          advanceDeducted: 0,
          newAdvanceTaken: advanceAmount,
          newAdvanceReason: reason,
          remainingAdvanceBalance: newBalance,
          status: 'COMPLETED',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        await this.database.transactions.put(tx);

        // Audit Log
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'အကြိုငွေသီးသန့် ထုတ်ပေးခြင်း (Atomic)',
          details: `${supplier.name} (${supplier.village}): အကြိုငွေ ${advanceAmount.toLocaleString()} ကျပ် | အကြောင်းပြချက်: ${reason} | လက်ကျန်: ${newBalance.toLocaleString()} ကျပ်`,
          timestamp: now.toISOString(),
          entityType: 'SUPPLIER',
          entityId: supplierId,
        };
        await this.database.auditLogs.put(auditEntry);

        return tx;
      }
    );
  }

  async saveMany(records: TransactionRecord[]): Promise<void> {
    await this.database.transactions.bulkPut(records);
  }

  async delete(id: string): Promise<void> {
    await this.database.transactions.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.transactions.clear();
  }

  async count(): Promise<number> {
    return this.database.transactions.count();
  }
}

export class SaleRepository implements ISaleRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<SaleRecord[]> {
    return this.database.sales.reverse().sortBy('date');
  }

  async getById(id: string): Promise<SaleRecord | undefined> {
    return this.database.sales.get(id);
  }

  async getByMerchant(merchantId: string): Promise<SaleRecord[]> {
    return this.database.sales.where('merchantId').equals(merchantId).toArray();
  }

  async getByDate(date: string): Promise<SaleRecord[]> {
    return this.database.sales.where('date').equals(date).toArray();
  }

  async save(sale: SaleRecord): Promise<string> {
    await this.database.sales.put(sale);
    return sale.id;
  }

  /**
   * Atomic Outbound Sale & Inventory Deduction & Merchant Balance Update
   * Guarantees ACID all-or-nothing execution:
   * 1. Idempotency / Duplicate Check
   * 2. Validates merchant and all products
   * 3. Decrements inventory for sold items
   * 4. Updates merchant receivable balance and aggregates
   * 5. Inserts sale record with completed status
   * 6. Appends audit log
   */
  async saveSaleAtomic(sale: SaleRecord): Promise<SaleRecord> {
    return this.database.transaction(
      'rw',
      [this.database.sales, this.database.merchants, this.database.products, this.database.auditLogs],
      async () => {
        // 1. Idempotency check
        if (sale.id) {
          const existing = await this.database.sales.get(sale.id);
          if (existing && existing.status !== 'CANCELLED') {
            throw new IdempotencyConflictError(`Sale voucher ID "${sale.id}" has already been recorded.`);
          }
        }

        // 2. Validate merchant (if merchantId provided)
        let merchant: Merchant | undefined;
        if (sale.merchantId) {
          merchant = await this.database.merchants.get(sale.merchantId);
          if (!merchant) {
            throw new EntityNotFoundError('Merchant', sale.merchantId);
          }
        }

        // 3. Validate products & decrement inventory
        if (Array.isArray(sale.items) && sale.items.length > 0) {
          for (const item of sale.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (!product) {
              throw new EntityNotFoundError('Product', item.productId);
            }
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            const newStock = currentStock - (item.quantity || 0);
            await this.database.products.update(item.productId, {
              currentStock: newStock,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // 4. Update merchant receivable balance & totals
        if (merchant) {
          const updatedMerchant: Merchant = {
            ...merchant,
            currentReceivableBalance: sale.remainingReceivableBalance,
            totalPurchasesValue: (merchant.totalPurchasesValue || 0) + (sale.grandTotal || 0),
            totalPaidAmount: (merchant.totalPaidAmount || 0) + (sale.cashPaidByMerchant || 0),
            updatedAt: new Date().toISOString(),
          };
          await this.database.merchants.put(updatedMerchant);
        }

        // 5. Save sale record
        const now = new Date().toISOString();
        const enrichedSale: SaleRecord = {
          ...sale,
          id: sale.id || generateStableId('sale'),
          voucherNo: sale.voucherNo || generateVoucherNo('SALE', sale.date),
          status: 'COMPLETED',
          createdAt: sale.createdAt || now,
          updatedAt: now,
          revision: (sale.revision || 0) + 1,
        };
        await this.database.sales.put(enrichedSale);

        // 6. Audit Log
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'အရောင်းဘောင်ချာ ထုတ်ယူခြင်း (Atomic)',
          details: `ဘောင်ချာ ${enrichedSale.voucherNo} - ${sale.merchantName}: ကျသင့်ငွေ ${(sale.grandTotal || 0).toLocaleString()} ကျပ် | ပေးငွေ: ${(sale.cashPaidByMerchant || 0).toLocaleString()} ကျပ် | ကျန်ငွေ: ${sale.remainingReceivableBalance.toLocaleString()} ကျပ်`,
          timestamp: `${sale.date} ${sale.time || ''}`.trim() || now,
          entityType: 'SALE',
          entityId: enrichedSale.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return enrichedSale;
      }
    );
  }

  /**
   * Atomic Sale Cancellation
   * 1. Restores product inventory for all sold items
   * 2. Reverses merchant debt and purchase aggregates
   * 3. Marks sale as CANCELLED
   * 4. Logs audit entry
   */
  async cancelSaleAtomic(saleId: string, reason: string = 'သုံးစွဲသူမှ ပယ်ဖျက်သည်'): Promise<SaleRecord> {
    return this.database.transaction(
      'rw',
      [this.database.sales, this.database.merchants, this.database.products, this.database.auditLogs],
      async () => {
        const sale = await this.database.sales.get(saleId);
        if (!sale) {
          throw new EntityNotFoundError('Sale', saleId);
        }
        if (sale.status === 'CANCELLED') {
          throw new InvalidStateTransitionError('ဤအရောင်းဘောင်ချာအား ဖျက်သိမ်းပြီးဖြစ်ပါသည်');
        }

        // 1. Restore product inventory
        if (Array.isArray(sale.items)) {
          for (const item of sale.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (product) {
              const currentStock = product.currentStock ?? product.openingStock ?? 0;
              const newStock = currentStock + (item.quantity || 0);
              await this.database.products.update(item.productId, {
                currentStock: newStock,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }

        // 2. Reverse merchant balance
        if (sale.merchantId) {
          const merchant = await this.database.merchants.get(sale.merchantId);
          if (merchant) {
            const unpaidAmountOnThisSale = Math.max(0, (sale.grandTotal || 0) - (sale.cashPaidByMerchant || 0));
            const newReceivable = Math.max(0, (merchant.currentReceivableBalance || 0) - unpaidAmountOnThisSale);
            const updatedMerchant: Merchant = {
              ...merchant,
              currentReceivableBalance: newReceivable,
              totalPurchasesValue: Math.max(0, (merchant.totalPurchasesValue || 0) - (sale.grandTotal || 0)),
              totalPaidAmount: Math.max(0, (merchant.totalPaidAmount || 0) - (sale.cashPaidByMerchant || 0)),
              updatedAt: new Date().toISOString(),
            };
            await this.database.merchants.put(updatedMerchant);
          }
        }

        // 3. Mark sale as CANCELLED
        const now = new Date().toISOString();
        const cancelledSale: SaleRecord = {
          ...sale,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: now,
          updatedAt: now,
        };
        await this.database.sales.put(cancelledSale);

        // 4. Audit Log
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'အရောင်းဘောင်ချာ ပြန်လည်ဖျက်သိမ်းခြင်း (Atomic Rollback)',
          details: `ဘောင်ချာ ${sale.voucherNo || sale.id} (${sale.merchantName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
          timestamp: now,
          entityType: 'SALE',
          entityId: sale.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return cancelledSale;
      }
    );
  }

  async saveMany(sales: SaleRecord[]): Promise<void> {
    await this.database.sales.bulkPut(sales);
  }

  async delete(id: string): Promise<void> {
    await this.database.sales.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.sales.clear();
  }

  async count(): Promise<number> {
    return this.database.sales.count();
  }
}

export class MerchantPurchaseRepository implements IMerchantPurchaseRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<MerchantPurchaseRecord[]> {
    return this.database.merchantPurchases.reverse().sortBy('date');
  }

  async getById(id: string): Promise<MerchantPurchaseRecord | undefined> {
    return this.database.merchantPurchases.get(id);
  }

  async getByMerchant(merchantId: string): Promise<MerchantPurchaseRecord[]> {
    return this.database.merchantPurchases.where('merchantId').equals(merchantId).toArray();
  }

  async save(purchase: MerchantPurchaseRecord): Promise<string> {
    await this.database.merchantPurchases.put(purchase);
    return purchase.id;
  }

  /**
   * Atomic Raw Material Purchase from Merchant
   */
  async savePurchaseAtomic(purchase: MerchantPurchaseRecord): Promise<MerchantPurchaseRecord> {
    return this.database.transaction(
      'rw',
      [this.database.merchantPurchases, this.database.merchants, this.database.auditLogs],
      async () => {
        // Idempotency check
        if (purchase.id) {
          const existing = await this.database.merchantPurchases.get(purchase.id);
          if (existing && existing.status !== 'CANCELLED') {
            throw new IdempotencyConflictError(`Purchase ID "${purchase.id}" already processed.`);
          }
        }

        const merchant = await this.database.merchants.get(purchase.merchantId);
        if (!merchant) {
          throw new EntityNotFoundError('Merchant', purchase.merchantId);
        }

        const currentPayable = merchant.payableBalance || 0;
        const updatedPayable = currentPayable + (purchase.remainingPayableBalance || 0);
        await this.database.merchants.update(purchase.merchantId, {
          payableBalance: updatedPayable,
          totalPurchasedFromMerchant: (merchant.totalPurchasedFromMerchant || 0) + (purchase.totalAmount || 0),
          updatedAt: new Date().toISOString(),
        });

        const now = new Date().toISOString();
        const enrichedPurchase: MerchantPurchaseRecord = {
          ...purchase,
          id: purchase.id || generateStableId('pur'),
          purchaseNo: purchase.purchaseNo || generateVoucherNo('PUR', purchase.date),
          status: 'COMPLETED',
          createdAt: purchase.createdAt || now,
          updatedAt: now,
          revision: (purchase.revision || 0) + 1,
        };

        await this.database.merchantPurchases.put(enrichedPurchase);

        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'ကုန်ကြမ်းဝယ်ယူမှု စာရင်းသွင်းခြင်း (Atomic)',
          details: `ဘောင်ချာ ${enrichedPurchase.purchaseNo} - ${purchase.merchantName}: စုစုပေါင်း ${(purchase.totalAmount || 0).toLocaleString()} ကျပ် | ပေးရန်ကျန်: ${(purchase.remainingPayableBalance || 0).toLocaleString()} ကျပ်`,
          timestamp: `${purchase.date} ${purchase.time || ''}`.trim() || now,
          entityType: 'PURCHASE',
          entityId: enrichedPurchase.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return enrichedPurchase;
      }
    );
  }

  /**
   * Atomic Purchase Cancellation
   */
  async cancelPurchaseAtomic(purchaseId: string, reason: string = 'သုံးစွဲသူမှ ပယ်ဖျက်သည်'): Promise<MerchantPurchaseRecord> {
    return this.database.transaction(
      'rw',
      [this.database.merchantPurchases, this.database.merchants, this.database.auditLogs],
      async () => {
        const purchase = await this.database.merchantPurchases.get(purchaseId);
        if (!purchase) {
          throw new EntityNotFoundError('Purchase', purchaseId);
        }
        if (purchase.status === 'CANCELLED') {
          throw new InvalidStateTransitionError('ဤကုန်ကြမ်းဝယ်ယူမှုစာရင်းအား ဖျက်သိမ်းပြီးဖြစ်ပါသည်');
        }

        const merchant = await this.database.merchants.get(purchase.merchantId);
        if (merchant) {
          const newPayable = Math.max(0, (merchant.payableBalance || 0) - (purchase.remainingPayableBalance || 0));
          const newTotalPurchased = Math.max(0, (merchant.totalPurchasedFromMerchant || 0) - (purchase.totalAmount || 0));
          await this.database.merchants.update(purchase.merchantId, {
            payableBalance: newPayable,
            totalPurchasedFromMerchant: newTotalPurchased,
            updatedAt: new Date().toISOString(),
          });
        }

        const now = new Date().toISOString();
        const cancelledPurchase: MerchantPurchaseRecord = {
          ...purchase,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: now,
          updatedAt: now,
        };
        await this.database.merchantPurchases.put(cancelledPurchase);

        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'ကုန်ကြမ်းဝယ်ယူမှု ပြန်လည်ဖျက်သိမ်းခြင်း (Atomic Rollback)',
          details: `ဘောင်ချာ ${purchase.purchaseNo} (${purchase.merchantName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
          timestamp: now,
          entityType: 'PURCHASE',
          entityId: purchase.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return cancelledPurchase;
      }
    );
  }

  async saveMany(purchases: MerchantPurchaseRecord[]): Promise<void> {
    await this.database.merchantPurchases.bulkPut(purchases);
  }

  async delete(id: string): Promise<void> {
    await this.database.merchantPurchases.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.merchantPurchases.clear();
  }

  async count(): Promise<number> {
    return this.database.merchantPurchases.count();
  }
}

export class OrderRepository implements IOrderRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<MerchantOrder[]> {
    return this.database.orders.toArray();
  }

  async getById(id: string): Promise<MerchantOrder | undefined> {
    return this.database.orders.get(id);
  }

  async getByStatus(status: string): Promise<MerchantOrder[]> {
    return this.database.orders.where('status').equals(status).toArray();
  }

  async save(order: MerchantOrder): Promise<string> {
    const now = new Date().toISOString();
    const toSave: MerchantOrder = {
      ...order,
      id: order.id || generateStableId('ord'),
      orderNo: order.orderNo || order.orderNumber || generateVoucherNo('ORD', order.orderDate || order.date),
      createdAt: order.createdAt || now,
    };
    await this.database.orders.put(toSave);
    return toSave.id;
  }

  /**
   * Atomic Order Completion & Sale Conversion
   */
  async completeOrderAtomic(orderId: string, saleRecord?: SaleRecord): Promise<MerchantOrder> {
    return this.database.transaction(
      'rw',
      [this.database.orders, this.database.sales, this.database.merchants, this.database.products, this.database.auditLogs],
      async () => {
        const order = await this.database.orders.get(orderId);
        if (!order) {
          throw new EntityNotFoundError('Order', orderId);
        }
        if (order.status === 'DELIVERED') {
          throw new InvalidStateTransitionError('ဤအော်ဒါအား ပို့ဆောင်ပြီးအဖြစ် သတ်မှတ်ထားပြီးဖြစ်ပါသည်');
        }

        let createdSaleId: string | undefined = order.saleVoucherId;

        // If a sale record is provided for fulfillment, process sale atomically
        if (saleRecord) {
          const saleRepoInstance = new SaleRepository(this.database);
          const savedSale = await saleRepoInstance.saveSaleAtomic(saleRecord);
          createdSaleId = savedSale.id;
        }

        const now = new Date().toISOString();
        const updatedOrder: MerchantOrder = {
          ...order,
          status: 'DELIVERED',
          deliveredDate: now.split('T')[0],
          saleVoucherId: createdSaleId,
        };
        await this.database.orders.put(updatedOrder);

        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'အော်ဒါပို့ဆောင်ပြီးမြောက်ခြင်း (Atomic)',
          details: `အော်ဒါ ${order.orderNo || order.id} - ${order.merchantName}: အောင်မြင်စွာ ပို့ဆောင်ပြီးပါပြီ${createdSaleId ? ` (အရောင်းဘောင်ချာ ID: ${createdSaleId})` : ''}`,
          timestamp: now,
          entityType: 'ORDER',
          entityId: order.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return updatedOrder;
      }
    );
  }

  async cancelOrderAtomic(orderId: string, reason: string = 'အော်ဒါပယ်ဖျက်သည်'): Promise<MerchantOrder> {
    return this.database.transaction(
      'rw',
      [this.database.orders, this.database.auditLogs],
      async () => {
        const order = await this.database.orders.get(orderId);
        if (!order) {
          throw new EntityNotFoundError('Order', orderId);
        }
        if (order.status === 'DELIVERED') {
          throw new InvalidStateTransitionError('ပို့ဆောင်ပြီးသော အော်ဒါကို တိုက်ရိုက်ပယ်ဖျက်၍မရပါ');
        }

        const now = new Date().toISOString();
        const updatedOrder: MerchantOrder = {
          ...order,
          status: 'CANCELLED',
          notes: `${order.notes ? order.notes + ' | ' : ''}[ပယ်ဖျက်: ${reason}]`,
        };
        await this.database.orders.put(updatedOrder);

        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'အော်ဒါပယ်ဖျက်ခြင်း (Atomic)',
          details: `အော်ဒါ ${order.orderNo || order.id} (${order.merchantName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
          timestamp: now,
          entityType: 'ORDER',
          entityId: order.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return updatedOrder;
      }
    );
  }

  async saveMany(orders: MerchantOrder[]): Promise<void> {
    await this.database.orders.bulkPut(orders);
  }

  async delete(id: string): Promise<void> {
    await this.database.orders.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.orders.clear();
  }

  async count(): Promise<number> {
    return this.database.orders.count();
  }
}

export class PeerTradeRepository implements IPeerTradeRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<PeerTradeRecord[]> {
    return this.database.peerTrades.toArray();
  }

  async getById(id: string): Promise<PeerTradeRecord | undefined> {
    return this.database.peerTrades.get(id);
  }

  async save(trade: PeerTradeRecord): Promise<string> {
    await this.database.peerTrades.put(trade);
    return trade.id;
  }

  async saveTradeAtomic(trade: PeerTradeRecord): Promise<PeerTradeRecord> {
    return this.database.transaction(
      'rw',
      [this.database.peerTrades, this.database.products, this.database.auditLogs],
      async () => {
        // Adjust product stock accordingly
        if (trade.productId && trade.quantity) {
          const product = await this.database.products.get(trade.productId);
          if (product) {
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            // BORROW_IN increases stock, LEND_OUT decreases stock
            const diff = trade.tradeType === 'BORROW_IN' ? trade.quantity : -trade.quantity;
            await this.database.products.update(trade.productId, {
              currentStock: currentStock + diff,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        const now = new Date().toISOString();
        const enrichedTrade: PeerTradeRecord = {
          ...trade,
          id: trade.id || generateStableId('peer'),
        };
        await this.database.peerTrades.put(enrichedTrade);

        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'မိတ်ဖက်ဆိုင် ကုန်လွှဲပြောင်းမှု (Atomic)',
          details: `${trade.tradeType === 'BORROW_IN' ? 'အဝင်ချေးယူ' : 'အထွက်ချေးငှား'} - ${trade.productName} (${trade.quantity} ${trade.unit}) [${trade.peerShopName}]`,
          timestamp: `${trade.date} ${trade.time || ''}`.trim() || now,
          entityType: 'PEER_TRADE',
          entityId: enrichedTrade.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return enrichedTrade;
      }
    );
  }

  async saveMany(trades: PeerTradeRecord[]): Promise<void> {
    await this.database.peerTrades.bulkPut(trades);
  }

  async delete(id: string): Promise<void> {
    await this.database.peerTrades.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.peerTrades.clear();
  }

  async count(): Promise<number> {
    return this.database.peerTrades.count();
  }
}

export class StockAdjustmentRepository implements IStockAdjustmentRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<StockAdjustmentRecord[]> {
    return this.database.stockAdjustments.reverse().sortBy('date');
  }

  async getById(id: string): Promise<StockAdjustmentRecord | undefined> {
    return this.database.stockAdjustments.get(id);
  }

  async save(adj: StockAdjustmentRecord): Promise<string> {
    await this.database.stockAdjustments.put(adj);
    return adj.id;
  }

  /**
   * Atomic Stock Adjustment
   * 1. Validates product exists
   * 2. Sets new stock and updates product
   * 3. Inserts adjustment record
   * 4. Logs audit entry
   */
  async saveAdjustmentAtomic(adj: StockAdjustmentRecord): Promise<StockAdjustmentRecord> {
    return this.database.transaction(
      'rw',
      [this.database.stockAdjustments, this.database.products, this.database.auditLogs],
      async () => {
        const product = await this.database.products.get(adj.productId);
        if (!product) {
          throw new EntityNotFoundError('Product', adj.productId);
        }

        const now = new Date().toISOString();
        await this.database.products.update(adj.productId, {
          currentStock: adj.newStock,
          updatedAt: now,
          revision: (product.revision || 0) + 1,
        });

        const enrichedAdj: StockAdjustmentRecord = {
          ...adj,
          id: adj.id || generateStableId('adj'),
          status: 'COMPLETED',
          createdAt: adj.createdAt || now,
          updatedAt: now,
        };

        await this.database.stockAdjustments.put(enrichedAdj);

        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: 'လက်ကျန်စာရင်းညှိနှိုင်းခြင်း (Atomic)',
          details: `${adj.productName}: ${adj.previousStock} -> ${adj.newStock} (${adj.reason})`,
          timestamp: `${adj.date} ${adj.time || ''}`.trim() || now,
          entityType: 'STOCK_ADJUSTMENT',
          entityId: enrichedAdj.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return enrichedAdj;
      }
    );
  }

  async saveMany(adjustments: StockAdjustmentRecord[]): Promise<void> {
    await this.database.stockAdjustments.bulkPut(adjustments);
  }

  async delete(id: string): Promise<void> {
    await this.database.stockAdjustments.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.stockAdjustments.clear();
  }

  async count(): Promise<number> {
    return this.database.stockAdjustments.count();
  }
}

export class SoftDeleteRepository implements ISoftDeleteRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<SoftDeletedItem[]> {
    return this.database.softDeletedItems.reverse().sortBy('deletedAt');
  }

  async getById(id: string): Promise<SoftDeletedItem | undefined> {
    return this.database.softDeletedItems.get(id);
  }

  async save(item: SoftDeletedItem): Promise<string> {
    await this.database.softDeletedItems.put(item);
    return item.id;
  }

  /**
   * Atomic Soft Delete with Recycle Bin movement
   */
  async softDeleteAtomic(
    entityType: 'PRODUCT' | 'SUPPLIER' | 'MERCHANT' | 'TRANSACTION' | 'SALE' | string,
    id: string,
    name?: string,
    reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်'
  ): Promise<SoftDeletedItem> {
    return this.database.transaction(
      'rw',
      [
        this.database.softDeletedItems,
        this.database.products,
        this.database.suppliers,
        this.database.merchants,
        this.database.transactions,
        this.database.sales,
        this.database.auditLogs,
      ],
      async () => {
        let entityData: any = null;
        let displayName = name || id;

        switch (entityType.toUpperCase()) {
          case 'PRODUCT':
            entityData = await this.database.products.get(id);
            if (entityData) {
              displayName = entityData.name || displayName;
              await this.database.products.delete(id);
            }
            break;
          case 'SUPPLIER':
            entityData = await this.database.suppliers.get(id);
            if (entityData) {
              displayName = entityData.name || displayName;
              await this.database.suppliers.delete(id);
            }
            break;
          case 'MERCHANT':
            entityData = await this.database.merchants.get(id);
            if (entityData) {
              displayName = entityData.name || displayName;
              await this.database.merchants.delete(id);
            }
            break;
          case 'TRANSACTION':
            entityData = await this.database.transactions.get(id);
            if (entityData) {
              displayName = entityData.voucherNo || displayName;
              await this.database.transactions.delete(id);
            }
            break;
          case 'SALE':
            entityData = await this.database.sales.get(id);
            if (entityData) {
              displayName = entityData.voucherNo || displayName;
              await this.database.sales.delete(id);
            }
            break;
          default:
            throw new BusinessIntegrityError(`Unsupported entity type: ${entityType}`);
        }

        if (!entityData) {
          throw new EntityNotFoundError(entityType, id);
        }

        const now = new Date().toISOString();
        const softItem: SoftDeletedItem = {
          id: generateStableId('del'),
          originalId: id,
          name: displayName,
          type: entityType,
          deletedAt: now,
          data: entityData,
        };

        await this.database.softDeletedItems.put(softItem);

        // Audit Log
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: `${entityType} အား အမှိုက်ပုံးသို့ ရွှေ့ပြောင်းခြင်း (Atomic Soft Delete)`,
          details: `${displayName} (ID: ${id}) | အကြောင်းပြချက်: ${reason}`,
          timestamp: now,
          entityType,
          entityId: id,
        };
        await this.database.auditLogs.put(auditEntry);

        return softItem;
      }
    );
  }

  /**
   * Atomic Restore from Recycle Bin
   */
  async restoreAtomic(softDeleteId: string): Promise<any> {
    return this.database.transaction(
      'rw',
      [
        this.database.softDeletedItems,
        this.database.products,
        this.database.suppliers,
        this.database.merchants,
        this.database.transactions,
        this.database.sales,
        this.database.auditLogs,
      ],
      async () => {
        const item = await this.database.softDeletedItems.get(softDeleteId);
        if (!item) {
          throw new EntityNotFoundError('SoftDeletedItem', softDeleteId);
        }

        const { type, data, originalId, name } = item;

        switch (type.toUpperCase()) {
          case 'PRODUCT':
            await this.database.products.put(data);
            break;
          case 'SUPPLIER':
            await this.database.suppliers.put(data);
            break;
          case 'MERCHANT':
            await this.database.merchants.put(data);
            break;
          case 'TRANSACTION':
            await this.database.transactions.put(data);
            break;
          case 'SALE':
            await this.database.sales.put(data);
            break;
          default:
            throw new BusinessIntegrityError(`Unsupported entity restore type: ${type}`);
        }

        // Delete from Recycle Bin
        await this.database.softDeletedItems.delete(softDeleteId);

        // Audit Log
        const now = new Date().toISOString();
        const auditEntry: AuditLogEntry = {
          id: generateStableId('audit'),
          action: `${type} အား အမှိုက်ပုံးမှ ပြန်လည်ဆယ်ယူခြင်း (Atomic Restore)`,
          details: `${name} (ID: ${originalId}) အား မူလနေရာသို့ ပြန်လည်ထည့်သွင်းခဲ့သည်`,
          timestamp: now,
          entityType: type,
          entityId: originalId,
        };
        await this.database.auditLogs.put(auditEntry);

        return data;
      }
    );
  }

  async saveMany(items: SoftDeletedItem[]): Promise<void> {
    await this.database.softDeletedItems.bulkPut(items);
  }

  async delete(id: string): Promise<void> {
    await this.database.softDeletedItems.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.softDeletedItems.clear();
  }

  async count(): Promise<number> {
    return this.database.softDeletedItems.count();
  }
}

export class AuditRepository implements IAuditRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<AuditLogEntry[]> {
    return this.database.auditLogs.reverse().sortBy('timestamp');
  }

  async log(action: string, details: string, entityType?: string, entityId?: string): Promise<void> {
    const entry: AuditLogEntry = {
      id: generateStableId('audit'),
      action,
      details,
      timestamp: new Date().toISOString(),
      entityType,
      entityId,
    };
    await this.database.auditLogs.put(entry);
  }

  async saveMany(logs: AuditLogEntry[]): Promise<void> {
    await this.database.auditLogs.bulkPut(logs);
  }

  async clear(): Promise<void> {
    await this.database.auditLogs.clear();
  }

  async count(): Promise<number> {
    return this.database.auditLogs.count();
  }
}

export class RawMaterialPresetRepository implements IRawMaterialPresetRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<RawMaterialPreset[]> {
    return this.database.rawMaterialPresets.toArray();
  }

  async getById(id: string): Promise<RawMaterialPreset | undefined> {
    return this.database.rawMaterialPresets.get(id);
  }

  async save(preset: RawMaterialPreset): Promise<string> {
    await this.database.rawMaterialPresets.put(preset);
    return preset.id;
  }

  async saveMany(presets: RawMaterialPreset[]): Promise<void> {
    await this.database.rawMaterialPresets.bulkPut(presets);
  }

  async delete(id: string): Promise<void> {
    await this.database.rawMaterialPresets.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.rawMaterialPresets.clear();
  }

  async count(): Promise<number> {
    return this.database.rawMaterialPresets.count();
  }
}

export class SettingsRepository implements ISettingsRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const record = await this.database.settings.get(key);
    if (!record || record.value === undefined || record.value === null) return defaultValue;
    return record.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.database.settings.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(key: string): Promise<void> {
    await this.database.settings.delete(key);
  }

  async getAll(): Promise<SettingRecord[]> {
    return this.database.settings.toArray();
  }
}

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async save(voucherId: string, input: File | Blob | string, caption?: string, ownerId?: string): Promise<string> {
    const record = await saveAttachmentRecord({ voucherId, input, caption, ownerId });
    return record.id;
  }

  async getByVoucher(voucherId: string): Promise<AttachmentRecord[]> {
    return getServiceAttachmentsForVoucher(voucherId);
  }

  async delete(id: string, options?: { force?: boolean }): Promise<void> {
    await deleteAttachmentSafely(id, options);
  }

  async deleteByVoucher(voucherId: string): Promise<void> {
    await this.database.attachments.where('voucherId').equals(voucherId).delete();
  }

  async count(): Promise<number> {
    return this.database.attachments.count();
  }

  async cleanupOrphans(): Promise<number> {
    return cleanupOrphanAttachments();
  }

  async migrateLegacy(): Promise<number> {
    return migrateLegacyAttachments();
  }
}

// Singleton instances for presentation / application consumption
export const productRepo = new ProductRepository();
export const supplierRepo = new SupplierRepository();
export const merchantRepo = new MerchantRepository();
export const transactionRepo = new TransactionRepository();
export const saleRepo = new SaleRepository();
export const purchaseRepo = new MerchantPurchaseRepository();
export const orderRepo = new OrderRepository();
export const peerTradeRepo = new PeerTradeRepository();
export const stockAdjustmentRepo = new StockAdjustmentRepository();
export const softDeleteRepo = new SoftDeleteRepository();
export const auditRepo = new AuditRepository();
export const rawMaterialPresetRepo = new RawMaterialPresetRepository();
export const settingsRepo = new SettingsRepository();
export const attachmentRepo = new AttachmentRepository();
