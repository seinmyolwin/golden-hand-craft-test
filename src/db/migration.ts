import { db } from './database';
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

export const MIGRATION_FLAG_KEY = 'shwe_let_yar_migration_status_v2';

export interface MigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  migratedCounts: {
    products: number;
    suppliers: number;
    merchants: number;
    transactions: number;
    sales: number;
    merchantPurchases: number;
    orders: number;
    stockAdjustments: number;
    peerTrades: number;
    deletedItems: number;
    auditLogs: number;
  };
  error?: string;
}

function safeParseLocalStorage<T>(keys: string[], fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  for (const key of keys) {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed !== undefined && parsed !== null) {
          if (Array.isArray(fallback) && !Array.isArray(parsed)) continue;
          return parsed as T;
        }
      }
    } catch {
      // Continue to next fallback key
    }
  }
  return fallback;
}

/**
 * Validate and clean array of products
 */
function validateProducts(items: any[]): Product[] {
  if (!Array.isArray(items)) return DEFAULT_PRODUCTS;
  const cleaned: Product[] = [];
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `prod_${Date.now()}_${index}`);
    const name = String(item.name || '').trim();
    if (!name) return;
    cleaned.push({
      id,
      name,
      defaultPrice: Number(item.defaultPrice) || 0,
      defaultWholesalePrice: Number(item.defaultWholesalePrice || item.defaultPrice) || 0,
      unit: String(item.unit || 'ခု'),
      category: String(item.category || 'အထွေထွေ'),
      openingStock: Number(item.openingStock) || 0,
      currentStock: Number(item.currentStock ?? item.openingStock) || 0,
      minStockAlert: Number(item.minStockAlert) || 5,
      active: item.active !== false,
    });
  });
  return cleaned.length > 0 ? cleaned : DEFAULT_PRODUCTS;
}

/**
 * Validate and clean array of suppliers
 */
function validateSuppliers(items: any[]): Supplier[] {
  if (!Array.isArray(items)) return INITIAL_SUPPLIERS;
  const cleaned: Supplier[] = [];
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `sup_${Date.now()}_${index}`);
    const name = String(item.name || '').trim();
    if (!name) return;
    cleaned.push({
      id,
      code: String(item.code || `S-${String(index + 1).padStart(3, '0')}`),
      name,
      phone: String(item.phone || ''),
      village: String(item.village || ''),
      notes: item.notes ? String(item.notes) : undefined,
      initialAdvance: Number(item.initialAdvance) || 0,
      currentAdvanceBalance: Number(item.currentAdvanceBalance) || 0,
      totalGoodsValueDelivered: Number(item.totalGoodsValueDelivered || item.totalGoodsDeliveredValue) || 0,
      totalAdvanceGiven: Number(item.totalAdvanceGiven || item.totalAdvancesGiven) || 0,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    });
  });
  return cleaned.length > 0 ? cleaned : INITIAL_SUPPLIERS;
}

/**
 * Validate and clean merchants
 */
function validateMerchants(items: any[]): Merchant[] {
  if (!Array.isArray(items)) return INITIAL_MERCHANTS;
  const cleaned: Merchant[] = [];
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `merch_${Date.now()}_${index}`);
    const name = String(item.name || '').trim();
    if (!name) return;
    cleaned.push({
      id,
      code: String(item.code || `M-${String(index + 1).padStart(3, '0')}`),
      name,
      town: String(item.town || ''),
      phone: String(item.phone || ''),
      address: item.address ? String(item.address) : undefined,
      ownerOrContact: item.ownerOrContact ? String(item.ownerOrContact) : undefined,
      notes: item.notes ? String(item.notes) : undefined,
      role: item.role || 'BUYER',
      currentReceivableBalance: Number(item.currentReceivableBalance) || 0,
      payableBalance: Number(item.payableBalance) || 0,
      totalPurchasesValue: Number(item.totalPurchasesValue) || 0,
      totalPaidAmount: Number(item.totalPaidAmount) || 0,
      totalPurchasedFromMerchant: Number(item.totalPurchasedFromMerchant) || 0,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    });
  });
  return cleaned.length > 0 ? cleaned : INITIAL_MERCHANTS;
}

/**
 * Execute Safe, Idempotent Migration from localStorage into IndexedDB
 * Never deletes original localStorage data before or after verification!
 */
export async function runOfflineStorageMigration(): Promise<MigrationResult> {
  try {
    const existingFlag = typeof window !== 'undefined' ? localStorage.getItem(MIGRATION_FLAG_KEY) : null;
    const existingProductCount = await db.products.count();

    if (existingFlag === 'COMPLETED' && existingProductCount > 0) {
      return {
        success: true,
        alreadyMigrated: true,
        migratedCounts: {
          products: existingProductCount,
          suppliers: await db.suppliers.count(),
          merchants: await db.merchants.count(),
          transactions: await db.transactions.count(),
          sales: await db.sales.count(),
          merchantPurchases: await db.merchantPurchases.count(),
          orders: await db.orders.count(),
          stockAdjustments: await db.stockAdjustments.count(),
          peerTrades: await db.peerTrades.count(),
          deletedItems: await db.softDeletedItems.count(),
          auditLogs: await db.auditLogs.count(),
        },
      };
    }

    // 1. Gather raw data from localStorage with fallbacks
    const rawProducts = safeParseLocalStorage<any[]>(['ledger_products_v2', 'ledger_products_v1'], DEFAULT_PRODUCTS);
    const rawSuppliers = safeParseLocalStorage<any[]>(['ledger_suppliers_v2', 'ledger_suppliers_v1'], INITIAL_SUPPLIERS);
    const rawMerchants = safeParseLocalStorage<any[]>(['ledger_merchants_v2', 'ledger_merchants_v1'], INITIAL_MERCHANTS);
    const rawTransactions = safeParseLocalStorage<any[]>(['ledger_transactions_v2', 'ledger_transactions_v1'], INITIAL_TRANSACTIONS);
    const rawSales = safeParseLocalStorage<any[]>(['ledger_sales_v2', 'ledger_sales_v1'], INITIAL_SALES);
    const rawPurchases = safeParseLocalStorage<any[]>(['ledger_merchant_purchases_v1'], []);
    const rawOrders = safeParseLocalStorage<any[]>(['ledger_merchant_orders_v1'], INITIAL_MERCHANT_ORDERS);
    const rawAdjustments = safeParseLocalStorage<any[]>(['ledger_stock_adjustments_v2'], INITIAL_STOCK_ADJUSTMENTS);
    const rawPeerTrades = safeParseLocalStorage<any[]>(['ledger_peer_trades_v1'], []);
    const rawDeletedItems = safeParseLocalStorage<any[]>(['ledger_deleted_items_v1', 'ledger_deleted_history_v1'], []);
    const rawAuditLogs = safeParseLocalStorage<any[]>(['ledger_audit_logs_v1'], []);
    const rawShopSettings = safeParseLocalStorage<any>(['ledger_shop_settings_v2', 'ledger_shop_settings_v1'], null);
    const rawAppLock = safeParseLocalStorage<any>(['ledger_app_lock_v1'], null);
    const rawBackupReminder = safeParseLocalStorage<any>(['ledger_backup_reminder_v1'], null);

    // 2. Validate and transform
    const validProducts = validateProducts(rawProducts);
    const validSuppliers = validateSuppliers(rawSuppliers);
    const validMerchants = validateMerchants(rawMerchants);

    const validTransactions: TransactionRecord[] = Array.isArray(rawTransactions)
      ? rawTransactions.map((t, i) => ({
          ...t,
          id: String(t.id || `tx_${Date.now()}_${i}`),
          voucherNo: String(t.voucherNo || `TX-${i + 1}`),
          supplierId: String(t.supplierId || ''),
          supplierName: String(t.supplierName || ''),
          date: String(t.date || new Date().toISOString().split('T')[0]),
          time: String(t.time || '12:00'),
          items: Array.isArray(t.items) ? t.items : [],
          totalGoodsValue: Number(t.totalGoodsValue) || 0,
          previousAdvanceBalance: Number(t.previousAdvanceBalance) || 0,
          advanceDeducted: Number(t.advanceDeducted) || 0,
          newAdvanceTaken: Number(t.newAdvanceTaken) || 0,
          remainingAdvanceBalance: Number(t.remainingAdvanceBalance) || 0,
        }))
      : [];

    const validSales: SaleRecord[] = Array.isArray(rawSales)
      ? rawSales.map((s, i) => ({
          ...s,
          id: String(s.id || `sale_${Date.now()}_${i}`),
          voucherNo: String(s.voucherNo || `SALE-${i + 1}`),
          merchantId: String(s.merchantId || ''),
          merchantName: String(s.merchantName || ''),
          merchantTown: String(s.merchantTown || ''),
          date: String(s.date || new Date().toISOString().split('T')[0]),
          time: String(s.time || '12:00'),
          items: Array.isArray(s.items) ? s.items : [],
          totalItemsCount: Number(s.totalItemsCount) || (s.items ? s.items.length : 0),
          grandTotal: Number(s.grandTotal) || 0,
          cashPaidByMerchant: Number(s.cashPaidByMerchant) || 0,
          remainingReceivableBalance: Number(s.remainingReceivableBalance) || 0,
        }))
      : [];

    const validPurchases: MerchantPurchaseRecord[] = Array.isArray(rawPurchases)
      ? rawPurchases.map((p, i) => ({
          ...p,
          id: String(p.id || `pur_${Date.now()}_${i}`),
          purchaseNo: String(p.purchaseNo || `PUR-${i + 1}`),
          merchantId: String(p.merchantId || ''),
          merchantName: String(p.merchantName || ''),
          merchantTown: String(p.merchantTown || ''),
          date: String(p.date || new Date().toISOString().split('T')[0]),
          time: String(p.time || '12:00'),
          items: Array.isArray(p.items) ? p.items : [],
          totalAmount: Number(p.totalAmount) || 0,
          paidAmount: Number(p.paidAmount) || 0,
          remainingPayableBalance: Number(p.remainingPayableBalance) || 0,
          createdAt: p.createdAt || new Date().toISOString(),
        }))
      : [];

    const validOrders: MerchantOrder[] = Array.isArray(rawOrders)
      ? rawOrders.map((o, i) => ({
          ...o,
          id: String(o.id || `ord_${Date.now()}_${i}`),
          merchantId: String(o.merchantId || ''),
          merchantName: String(o.merchantName || ''),
          merchantTown: String(o.merchantTown || ''),
          items: Array.isArray(o.items) ? o.items : [],
          status: o.status || 'PENDING',
        }))
      : [];

    const validAdjustments: StockAdjustmentRecord[] = Array.isArray(rawAdjustments)
      ? rawAdjustments.map((a, i) => ({
          ...a,
          id: String(a.id || `adj_${Date.now()}_${i}`),
          productId: String(a.productId || ''),
          productName: String(a.productName || ''),
          quantity: Number(a.quantity) || 0,
          previousStock: Number(a.previousStock) || 0,
          newStock: Number(a.newStock) || 0,
          reason: String(a.reason || 'စစ်ဆေးညှိနှိုင်းမှု'),
          date: String(a.date || new Date().toISOString().split('T')[0]),
          time: String(a.time || '12:00'),
          type: a.type || 'INITIAL',
          createdAt: a.createdAt || new Date().toISOString(),
        }))
      : [];

    const validPeerTrades: PeerTradeRecord[] = Array.isArray(rawPeerTrades)
      ? rawPeerTrades.map((pt, i) => ({
          ...pt,
          id: String(pt.id || `pt_${Date.now()}_${i}`),
          tradeType: pt.tradeType || 'BORROW_IN',
          date: String(pt.date || new Date().toISOString().split('T')[0]),
          time: String(pt.time || '12:00'),
          peerShopName: String(pt.peerShopName || ''),
          peerLocation: String(pt.peerLocation || ''),
          productId: String(pt.productId || ''),
          productName: String(pt.productName || ''),
          quantity: Number(pt.quantity) || 0,
          unit: String(pt.unit || 'ခု'),
          agreedUnitPrice: Number(pt.agreedUnitPrice) || 0,
          totalTradeValue: Number(pt.totalTradeValue) || 0,
          status: pt.status || 'OPEN',
        }))
      : [];

    const validDeleted: SoftDeletedItem[] = Array.isArray(rawDeletedItems)
      ? rawDeletedItems.map((d, i) => ({
          ...d,
          id: String(d.id || `del_${Date.now()}_${i}`),
          originalId: String(d.originalId || ''),
          name: String(d.name || 'ဖျက်ထားသောမှတ်တမ်း'),
          type: String(d.type || 'RECORD'),
          deletedAt: String(d.deletedAt || new Date().toISOString()),
          data: d.data ?? {},
        }))
      : [];

    const validAudit: AuditLogEntry[] = Array.isArray(rawAuditLogs)
      ? rawAuditLogs.map((al, i) => ({
          ...al,
          id: String(al.id || `audit_${Date.now()}_${i}`),
          action: String(al.action || 'System Action'),
          details: String(al.details || ''),
          timestamp: String(al.timestamp || new Date().toISOString()),
        }))
      : [];

    // 3. Write into IndexedDB atomically
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
        db.settings,
      ],
      async () => {
        if (validProducts.length > 0) await db.products.bulkPut(validProducts);
        if (validSuppliers.length > 0) await db.suppliers.bulkPut(validSuppliers);
        if (validMerchants.length > 0) await db.merchants.bulkPut(validMerchants);
        if (validTransactions.length > 0) await db.transactions.bulkPut(validTransactions);
        if (validSales.length > 0) await db.sales.bulkPut(validSales);
        if (validPurchases.length > 0) await db.merchantPurchases.bulkPut(validPurchases);
        if (validOrders.length > 0) await db.orders.bulkPut(validOrders);
        if (validAdjustments.length > 0) await db.stockAdjustments.bulkPut(validAdjustments);
        if (validPeerTrades.length > 0) await db.peerTrades.bulkPut(validPeerTrades);
        if (validDeleted.length > 0) await db.softDeletedItems.bulkPut(validDeleted);
        if (validAudit.length > 0) await db.auditLogs.bulkPut(validAudit);

        if (rawShopSettings) {
          await db.settings.put({ key: 'shopSettings', value: rawShopSettings, updatedAt: new Date().toISOString() });
        }
        if (rawAppLock) {
          await db.settings.put({ key: 'appLockSettings', value: rawAppLock, updatedAt: new Date().toISOString() });
        }
        if (rawBackupReminder) {
          await db.settings.put({ key: 'backupReminderSettings', value: rawBackupReminder, updatedAt: new Date().toISOString() });
        }
      }
    );

    // 4. Verification Step: Verify that data exists in IndexedDB
    const verifiedProductCount = await db.products.count();
    const verifiedSupplierCount = await db.suppliers.count();
    const verifiedMerchantCount = await db.merchants.count();

    if (verifiedProductCount === 0 && validProducts.length > 0) {
      throw new Error('Verification failed: Products count in IndexedDB is 0 after migration.');
    }

    // 5. Mark migration as COMPLETED
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'COMPLETED');
      localStorage.setItem('shwe_let_yar_migration_time', new Date().toISOString());
    }

    return {
      success: true,
      alreadyMigrated: false,
      migratedCounts: {
        products: verifiedProductCount,
        suppliers: verifiedSupplierCount,
        merchants: verifiedMerchantCount,
        transactions: await db.transactions.count(),
        sales: await db.sales.count(),
        merchantPurchases: await db.merchantPurchases.count(),
        orders: await db.orders.count(),
        stockAdjustments: await db.stockAdjustments.count(),
        peerTrades: await db.peerTrades.count(),
        deletedItems: await db.softDeletedItems.count(),
        auditLogs: await db.auditLogs.count(),
      },
    };
  } catch (err: any) {
    console.error('Offline storage migration error:', err);
    return {
      success: false,
      alreadyMigrated: false,
      migratedCounts: {
        products: 0,
        suppliers: 0,
        merchants: 0,
        transactions: 0,
        sales: 0,
        merchantPurchases: 0,
        orders: 0,
        stockAdjustments: 0,
        peerTrades: 0,
        deletedItems: 0,
        auditLogs: 0,
      },
      error: err?.message || String(err),
    };
  }
}
