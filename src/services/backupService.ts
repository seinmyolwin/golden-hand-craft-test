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
  ShopSettings,
  AppLockSettings,
  BackupReminderSettings,
  AutoRecoverySnapshot,
} from '../types';

export interface VersionedBackupFile {
  format: 'SHWE_LET_YAR_BACKUP';
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  recordCounts: {
    products: number;
    suppliers: number;
    merchants: number;
    transactions: number;
    sales: number;
    merchantPurchases: number;
    orders: number;
    stockAdjustments: number;
    peerTrades: number;
  };
  data: {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    merchantPurchases: MerchantPurchaseRecord[];
    orders: MerchantOrder[];
    stockAdjustments: StockAdjustmentRecord[];
    peerTrades: PeerTradeRecord[];
    shopSettings?: ShopSettings;
    appLockSettings?: AppLockSettings;
    backupReminderSettings?: BackupReminderSettings;
    productCategories?: string[];
    rawMaterialCategories?: string[];
  };
}

/**
 * Generate a complete local versioned backup object from IndexedDB
 */
export async function createLocalBackupData(): Promise<VersionedBackupFile> {
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
    shopSettingsRecord,
    appLockRecord,
    backupReminderRecord,
    prodCatsRecord,
    rawCatsRecord,
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
    db.settings.get('shopSettings'),
    db.settings.get('appLockSettings'),
    db.settings.get('backupReminderSettings'),
    db.settings.get('productCategories'),
    db.settings.get('rawMaterialCategories'),
  ]);

  return {
    format: 'SHWE_LET_YAR_BACKUP',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    appVersion: '2.5.0',
    recordCounts: {
      products: products.length,
      suppliers: suppliers.length,
      merchants: merchants.length,
      transactions: transactions.length,
      sales: sales.length,
      merchantPurchases: merchantPurchases.length,
      orders: orders.length,
      stockAdjustments: stockAdjustments.length,
      peerTrades: peerTrades.length,
    },
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
      shopSettings: shopSettingsRecord?.value,
      appLockSettings: appLockRecord?.value,
      backupReminderSettings: backupReminderRecord?.value,
      productCategories: prodCatsRecord?.value,
      rawMaterialCategories: rawCatsRecord?.value,
    },
  };
}

/**
 * Export backup as a downloadable JSON file completely offline
 */
export async function exportLocalBackupFile(): Promise<void> {
  const backup = await createLocalBackupData();
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const nowStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `Shwe_let_yar_backup_v2_${nowStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Save an auto-recovery snapshot in IndexedDB (limited to last 5 to avoid storage waste)
 */
export async function saveLocalRecoverySnapshot(reason: string): Promise<void> {
  try {
    const backup = await createLocalBackupData();
    const snapshot: AutoRecoverySnapshot = {
      id: `snapshot_${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('my-MM', { hour12: false }),
      reason,
      recordCounts: backup.recordCounts,
      data: {
        products: backup.data.products,
        suppliers: backup.data.suppliers,
        merchants: backup.data.merchants,
        transactions: backup.data.transactions,
        sales: backup.data.sales,
        stockAdjustments: backup.data.stockAdjustments,
        merchantOrders: backup.data.orders,
        merchantPurchases: backup.data.merchantPurchases,
        peerTrades: backup.data.peerTrades,
        shopSettings: backup.data.shopSettings || ({} as ShopSettings),
      } as any,
    };

    await db.recoverySnapshots.put(snapshot);

    // Keep only the most recent 5 snapshots
    const allSnapshots = await db.recoverySnapshots.reverse().sortBy('timestamp');
    if (allSnapshots.length > 5) {
      const toDelete = allSnapshots.slice(5).map((s) => s.id);
      await db.recoverySnapshots.bulkDelete(toDelete);
    }
  } catch (err) {
    console.warn('Failed to save recovery snapshot:', err);
  }
}

export interface RestoreResult {
  success: boolean;
  message: string;
  importedCounts?: {
    products: number;
    suppliers: number;
    merchants: number;
    transactions: number;
    sales: number;
    merchantPurchases: number;
  };
}

/**
 * Restore/Import backup data with Smart Merge or Full Overwrite
 * Executes inside an atomic Dexie transaction
 */
export async function restoreLocalBackupData(
  importedJson: any,
  mode: 'MERGE' | 'OVERWRITE' = 'MERGE'
): Promise<RestoreResult> {
  if (!importedJson || typeof importedJson !== 'object') {
    return { success: false, message: 'ဖိုင်ပုံစံ မမှန်ကန်ပါ (Invalid JSON format)' };
  }

  // Handle both version 2 envelope format and legacy flat formats
  const payload = importedJson.data || importedJson;

  const incomingProducts: Product[] = Array.isArray(payload.products) ? payload.products : [];
  const incomingSuppliers: Supplier[] = Array.isArray(payload.suppliers) ? payload.suppliers : [];
  const incomingMerchants: Merchant[] = Array.isArray(payload.merchants) ? payload.merchants : [];
  const incomingTransactions: TransactionRecord[] = Array.isArray(payload.transactions) ? payload.transactions : [];
  const incomingSales: SaleRecord[] = Array.isArray(payload.sales) ? payload.sales : [];
  const incomingPurchases: MerchantPurchaseRecord[] = Array.isArray(payload.merchantPurchases) ? payload.merchantPurchases : [];
  const incomingOrders: MerchantOrder[] = Array.isArray(payload.orders) ? payload.orders : [];
  const incomingAdjustments: StockAdjustmentRecord[] = Array.isArray(payload.stockAdjustments) ? payload.stockAdjustments : [];
  const incomingPeerTrades: PeerTradeRecord[] = Array.isArray(payload.peerTrades) ? payload.peerTrades : [];

  try {
    // 1. Save safety snapshot of current state before applying import
    await saveLocalRecoverySnapshot(`Backup Restore (${mode})`);

    // 2. Execute restoration atomically in Dexie
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
        db.auditLogs,
      ],
      async () => {
        if (mode === 'OVERWRITE') {
          // Clear current tables
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
          ]);

          if (incomingProducts.length > 0) await db.products.bulkPut(incomingProducts);
          if (incomingSuppliers.length > 0) await db.suppliers.bulkPut(incomingSuppliers);
          if (incomingMerchants.length > 0) await db.merchants.bulkPut(incomingMerchants);
          if (incomingTransactions.length > 0) await db.transactions.bulkPut(incomingTransactions);
          if (incomingSales.length > 0) await db.sales.bulkPut(incomingSales);
          if (incomingPurchases.length > 0) await db.merchantPurchases.bulkPut(incomingPurchases);
          if (incomingOrders.length > 0) await db.orders.bulkPut(incomingOrders);
          if (incomingAdjustments.length > 0) await db.stockAdjustments.bulkPut(incomingAdjustments);
          if (incomingPeerTrades.length > 0) await db.peerTrades.bulkPut(incomingPeerTrades);
        } else {
          // MERGE mode: put all records; existing identical IDs are updated, new IDs are inserted
          if (incomingProducts.length > 0) await db.products.bulkPut(incomingProducts);
          if (incomingSuppliers.length > 0) await db.suppliers.bulkPut(incomingSuppliers);
          if (incomingMerchants.length > 0) await db.merchants.bulkPut(incomingMerchants);
          if (incomingTransactions.length > 0) await db.transactions.bulkPut(incomingTransactions);
          if (incomingSales.length > 0) await db.sales.bulkPut(incomingSales);
          if (incomingPurchases.length > 0) await db.merchantPurchases.bulkPut(incomingPurchases);
          if (incomingOrders.length > 0) await db.orders.bulkPut(incomingOrders);
          if (incomingAdjustments.length > 0) await db.stockAdjustments.bulkPut(incomingAdjustments);
          if (incomingPeerTrades.length > 0) await db.peerTrades.bulkPut(incomingPeerTrades);
        }

        // Restore settings if provided
        if (payload.shopSettings) {
          await db.settings.put({ key: 'shopSettings', value: payload.shopSettings, updatedAt: new Date().toISOString() });
        }
        if (payload.productCategories) {
          await db.settings.put({ key: 'productCategories', value: payload.productCategories, updatedAt: new Date().toISOString() });
        }
        if (payload.rawMaterialCategories) {
          await db.settings.put({ key: 'rawMaterialCategories', value: payload.rawMaterialCategories, updatedAt: new Date().toISOString() });
        }

        // Write Audit Log
        await db.auditLogs.put({
          id: `audit-${Date.now()}`,
          action: mode === 'OVERWRITE' ? 'မိတ္တူဖိုင် အစားထိုး ပြန်လည်သွင်းယူခြင်း' : 'မိတ္တူဖိုင် ပေါင်းစည်း ပြန်လည်သွင်းယူခြင်း',
          details: `ကုန်ပစ္စည်း: ${incomingProducts.length}, ကုန်သိမ်း: ${incomingTransactions.length}, အရောင်း: ${incomingSales.length}`,
          timestamp: new Date().toISOString(),
          entityType: 'BACKUP',
        });
      }
    );

    return {
      success: true,
      message:
        mode === 'OVERWRITE'
          ? 'မိတ္တူဖိုင်မှ အချက်အလက်များ အားလုံး အစားထိုးပြီးပါပြီ'
          : 'မိတ္တူဖိုင်မှ အချက်အလက်များကို အောင်မြင်စွာ ပေါင်းစပ်ထည့်သွင်းပြီးပါပြီ',
      importedCounts: {
        products: incomingProducts.length,
        suppliers: incomingSuppliers.length,
        merchants: incomingMerchants.length,
        transactions: incomingTransactions.length,
        sales: incomingSales.length,
        merchantPurchases: incomingPurchases.length,
      },
    };
  } catch (err: any) {
    console.error('Error during backup restore:', err);
    return {
      success: false,
      message: `စာရင်းပြန်သွင်းရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်: ${err?.message || String(err)}`,
    };
  }
}
