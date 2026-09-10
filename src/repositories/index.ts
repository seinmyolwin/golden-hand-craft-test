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
  SoftDeletedItem,
  AuditLogEntry,
  ShopSettings,
  AppLockSettings,
  BackupReminderSettings,
} from '../types';

export class ProductRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Product[]> {
    return this.database.products.toArray();
  }

  async getById(id: string): Promise<Product | undefined> {
    return this.database.products.get(id);
  }

  async save(product: Product): Promise<string> {
    await this.database.products.put(product);
    return product.id;
  }

  async saveMany(products: Product[]): Promise<void> {
    await this.database.products.bulkPut(products);
  }

  async delete(id: string): Promise<void> {
    await this.database.products.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.products.clear();
  }
}

export class SupplierRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Supplier[]> {
    return this.database.suppliers.toArray();
  }

  async getById(id: string): Promise<Supplier | undefined> {
    return this.database.suppliers.get(id);
  }

  async save(supplier: Supplier): Promise<string> {
    await this.database.suppliers.put(supplier);
    return supplier.id;
  }

  async saveMany(suppliers: Supplier[]): Promise<void> {
    await this.database.suppliers.bulkPut(suppliers);
  }

  async delete(id: string): Promise<void> {
    await this.database.suppliers.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.suppliers.clear();
  }
}

export class MerchantRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Merchant[]> {
    return this.database.merchants.toArray();
  }

  async getById(id: string): Promise<Merchant | undefined> {
    return this.database.merchants.get(id);
  }

  async save(merchant: Merchant): Promise<string> {
    await this.database.merchants.put(merchant);
    return merchant.id;
  }

  async saveMany(merchants: Merchant[]): Promise<void> {
    await this.database.merchants.bulkPut(merchants);
  }

  async delete(id: string): Promise<void> {
    await this.database.merchants.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.merchants.clear();
  }
}

export class TransactionRepository {
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

  /**
   * Atomic Inbound Goods Collection & Supplier Balance Settlement
   * Guarantees all-or-nothing execution:
   * 1. Inserts transaction record
   * 2. Updates supplier balance & totals
   * 3. Increases finished goods inventory
   * 4. Appends audit log
   */
  async saveInboundAtomic(
    tx: TransactionRecord,
    options?: { previousTx?: TransactionRecord }
  ): Promise<TransactionRecord> {
    return this.database.transaction(
      'rw',
      [this.database.transactions, this.database.suppliers, this.database.products, this.database.auditLogs],
      async () => {
        // 1. Fetch current supplier
        const supplier = await this.database.suppliers.get(tx.supplierId);
        if (!supplier) {
          throw new Error(`Supplier with id ${tx.supplierId} not found in database`);
        }

        // 2. Adjust inventory for items
        for (const item of tx.items) {
          if (!item.productId) continue;
          const product = await this.database.products.get(item.productId);
          if (product) {
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            const updatedStock = currentStock + (item.quantity || 0);
            await this.database.products.update(item.productId, { currentStock: updatedStock });
          }
        }

        // 3. Update supplier financial balance
        const updatedSupplier: Supplier = {
          ...supplier,
          currentAdvanceBalance: tx.remainingAdvanceBalance,
          totalGoodsValueDelivered: (supplier.totalGoodsValueDelivered || 0) + (tx.totalGoodsValue || 0),
          totalAdvanceGiven: (supplier.totalAdvanceGiven || 0) + (tx.newAdvanceTaken || 0),
          updatedAt: new Date().toISOString(),
        };
        await this.database.suppliers.put(updatedSupplier);

        // 4. Save transaction record
        await this.database.transactions.put(tx);

        // 5. Audit Log
        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'ကုန်သိမ်းစာရင်း ရေးသွင်းခြင်း (Atomic)',
          details: `ဘောင်ချာ ${tx.voucherNo || tx.id} - ${tx.supplierName}: တန်ဖိုး ${tx.totalGoodsValue} ကျပ်`,
          timestamp: `${tx.date} ${tx.time || ''}`.trim(),
          entityType: 'TRANSACTION',
          entityId: tx.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return tx;
      }
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.transactions.delete(id);
  }

  async saveMany(records: TransactionRecord[]): Promise<void> {
    await this.database.transactions.bulkPut(records);
  }

  async clear(): Promise<void> {
    await this.database.transactions.clear();
  }
}

export class SaleRepository {
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

  /**
   * Atomic Outbound Sale & Inventory Deduction & Merchant Balance Update
   * Guarantees all-or-nothing execution:
   * 1. Inserts sale record
   * 2. Decrements product stock
   * 3. Updates merchant receivable balance
   * 4. Appends audit log
   */
  async saveSaleAtomic(sale: SaleRecord): Promise<SaleRecord> {
    return this.database.transaction(
      'rw',
      [this.database.sales, this.database.merchants, this.database.products, this.database.auditLogs],
      async () => {
        // 1. Fetch merchant
        const merchant = await this.database.merchants.get(sale.merchantId);
        if (!merchant) {
          throw new Error(`Merchant with id ${sale.merchantId} not found in database`);
        }

        // 2. Decrement inventory for sold items
        for (const item of sale.items) {
          if (!item.productId) continue;
          const product = await this.database.products.get(item.productId);
          if (product) {
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            const newStock = currentStock - (item.quantity || 0);
            await this.database.products.update(item.productId, { currentStock: newStock });
          }
        }

        // 3. Update merchant receivable balance & cumulative stats
        const updatedMerchant: Merchant = {
          ...merchant,
          currentReceivableBalance: sale.remainingReceivableBalance,
          totalPurchasesValue: (merchant.totalPurchasesValue || 0) + (sale.grandTotal || 0),
          totalPaidAmount: (merchant.totalPaidAmount || 0) + (sale.cashPaidByMerchant || 0),
          updatedAt: new Date().toISOString(),
        };
        await this.database.merchants.put(updatedMerchant);

        // 4. Save sale record
        await this.database.sales.put(sale);

        // 5. Audit Log
        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'အရောင်းဘောင်ချာ ထုတ်ယူခြင်း (Atomic)',
          details: `ဘောင်ချာ ${sale.voucherNo || sale.id} - ${sale.merchantName}: ကျသင့်ငွေ ${sale.grandTotal} ကျပ်`,
          timestamp: `${sale.date} ${sale.time || ''}`.trim(),
          entityType: 'SALE',
          entityId: sale.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return sale;
      }
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.sales.delete(id);
  }

  async saveMany(sales: SaleRecord[]): Promise<void> {
    await this.database.sales.bulkPut(sales);
  }

  async clear(): Promise<void> {
    await this.database.sales.clear();
  }
}

export class MerchantPurchaseRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<MerchantPurchaseRecord[]> {
    return this.database.merchantPurchases.reverse().sortBy('date');
  }

  async savePurchaseAtomic(purchase: MerchantPurchaseRecord): Promise<MerchantPurchaseRecord> {
    return this.database.transaction(
      'rw',
      [this.database.merchantPurchases, this.database.merchants, this.database.auditLogs],
      async () => {
        const merchant = await this.database.merchants.get(purchase.merchantId);
        if (merchant) {
          const currentPayable = merchant.payableBalance || 0;
          const updatedPayable = currentPayable + (purchase.remainingPayableBalance || 0);
          await this.database.merchants.update(purchase.merchantId, {
            payableBalance: updatedPayable,
            totalPurchasedFromMerchant: (merchant.totalPurchasedFromMerchant || 0) + (purchase.totalAmount || 0),
            updatedAt: new Date().toISOString(),
          });
        }

        await this.database.merchantPurchases.put(purchase);

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'ကုန်ကြမ်းဝယ်ယူမှု စာရင်းသွင်းခြင်း (Atomic)',
          details: `ဘောင်ချာ ${purchase.purchaseNo} - ${purchase.merchantName}: စုစုပေါင်း ${purchase.totalAmount} ကျပ်`,
          timestamp: `${purchase.date} ${purchase.time || ''}`.trim(),
          entityType: 'PURCHASE',
          entityId: purchase.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return purchase;
      }
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.merchantPurchases.delete(id);
  }

  async saveMany(purchases: MerchantPurchaseRecord[]): Promise<void> {
    await this.database.merchantPurchases.bulkPut(purchases);
  }

  async clear(): Promise<void> {
    await this.database.merchantPurchases.clear();
  }
}

export class OrderRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<MerchantOrder[]> {
    return this.database.orders.toArray();
  }

  async save(order: MerchantOrder): Promise<string> {
    await this.database.orders.put(order);
    return order.id;
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
}

export class PeerTradeRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<PeerTradeRecord[]> {
    return this.database.peerTrades.toArray();
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
            });
          }
        }

        await this.database.peerTrades.put(trade);

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'မိတ်ဖက်ဆိုင် ကုန်လွှဲပြောင်းမှု (Atomic)',
          details: `${trade.tradeType === 'BORROW_IN' ? 'အဝင်ချေးယူ' : 'အထွက်ချေးငှား'} - ${trade.productName} (${trade.quantity} ${trade.unit})`,
          timestamp: `${trade.date} ${trade.time || ''}`.trim(),
          entityType: 'PEER_TRADE',
          entityId: trade.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return trade;
      }
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.peerTrades.delete(id);
  }

  async saveMany(trades: PeerTradeRecord[]): Promise<void> {
    await this.database.peerTrades.bulkPut(trades);
  }

  async clear(): Promise<void> {
    await this.database.peerTrades.clear();
  }
}

export class StockAdjustmentRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<StockAdjustmentRecord[]> {
    return this.database.stockAdjustments.reverse().sortBy('date');
  }

  async saveAdjustmentAtomic(adj: StockAdjustmentRecord): Promise<StockAdjustmentRecord> {
    return this.database.transaction(
      'rw',
      [this.database.stockAdjustments, this.database.products, this.database.auditLogs],
      async () => {
        const product = await this.database.products.get(adj.productId);
        if (product) {
          await this.database.products.update(adj.productId, {
            currentStock: adj.newStock,
          });
        }

        await this.database.stockAdjustments.put(adj);

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          action: 'လက်ကျန်စာရင်းညှိနှိုင်းခြင်း (Atomic)',
          details: `${adj.productName}: ${adj.previousStock} -> ${adj.newStock} (${adj.reason})`,
          timestamp: `${adj.date} ${adj.time || ''}`.trim(),
          entityType: 'STOCK_ADJUSTMENT',
          entityId: adj.id,
        };
        await this.database.auditLogs.put(auditEntry);

        return adj;
      }
    );
  }

  async saveMany(adjustments: StockAdjustmentRecord[]): Promise<void> {
    await this.database.stockAdjustments.bulkPut(adjustments);
  }

  async clear(): Promise<void> {
    await this.database.stockAdjustments.clear();
  }
}

export class SoftDeleteRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<SoftDeletedItem[]> {
    return this.database.softDeletedItems.reverse().sortBy('deletedAt');
  }

  async save(item: SoftDeletedItem): Promise<string> {
    await this.database.softDeletedItems.put(item);
    return item.id;
  }

  async delete(id: string): Promise<void> {
    await this.database.softDeletedItems.delete(id);
  }

  async clear(): Promise<void> {
    await this.database.softDeletedItems.clear();
  }
}

export class AuditRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<AuditLogEntry[]> {
    return this.database.auditLogs.reverse().sortBy('timestamp');
  }

  async log(action: string, details: string, entityType?: string, entityId?: string): Promise<void> {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
}

export class SettingsRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const record = await this.database.settings.get(key);
    if (!record) return defaultValue;
    return record.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.database.settings.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
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
export const settingsRepo = new SettingsRepository();
