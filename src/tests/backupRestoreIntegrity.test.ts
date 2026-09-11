import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Polyfill localStorage for Node test runner environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
}

import { db } from '../db/database';
import {
  createCompleteBackup,
  validateBackupFile,
  executeSafeRestore,
  getRecoverySnapshots,
  restoreFromSnapshot,
} from '../services/backupService';
import {
  Product,
  Supplier,
  Merchant,
  SaleRecord,
  TransactionRecord,
  MerchantPurchaseRecord,
  MerchantOrder,
  StockAdjustmentRecord,
  PeerTradeRecord,
  AuditLogEntry,
  StockMovementRecord,
  CashMovementRecord,
  DailyClosingRecord,
  ReturnRecord,
} from '../types';
import { generateStableId } from '../utils/idGenerator';

describe('Backup and Restore Reliability Audit', () => {
  beforeEach(async () => {
    // Clear all tables before each test
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
      db.rawMaterialPresets.clear(),
      db.attachments.clear(),
      db.recoverySnapshots.clear(),
    ]);
  });

  // Test Case 1: Normal Backup Generation & Validation
  it('1. Generates complete backup from Dexie source of truth and validates header metadata', async () => {
    // Seed initial records
    const sampleProduct: Product = {
      id: generateStableId('prod'),
      name: 'မြန်မာ့လက်ရာ ခေါင်းအုံး',
      category: 'အိမ်သုံး',
      unit: 'ခု',
      defaultPrice: 15000,
      currentStock: 50,
      active: true,
      createdAt: new Date().toISOString(),
    };
    const sampleSupplier: Supplier = {
      id: generateStableId('sup'),
      code: 'SUP-001',
      name: 'ဦးအေး',
      village: 'မင်းနန်သူ',
      phone: '0912345678',
      currentAdvanceBalance: 0,
      totalGoodsValueDelivered: 500000,
      totalAdvanceGiven: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.products.put(sampleProduct);
    await db.suppliers.put(sampleSupplier);

    // Generate backup
    const backup = await createCompleteBackup();

    expect(backup).toBeDefined();
    expect(backup.formatVersion).toBe('3.0');
    expect(backup.appVersion).toBeDefined();
    expect(backup.databaseSchemaVersion).toBe(3);
    expect(backup.exportedAt).toBeDefined();
    expect(backup.checksum).toBeDefined();
    expect(backup.data.products.length).toBe(1);
    expect(backup.data.products[0].id).toBe(sampleProduct.id);
    expect(backup.data.suppliers.length).toBe(1);

    // Validate generated backup
    const report = await validateBackupFile(backup);
    expect(report.isValid).toBe(true);
    expect(report.isCorrupted).toBe(false);
    expect(report.checksumValid).toBe(true);
    expect(report.errors.length).toBe(0);
  });

  // Test Case 2: Corrupted Backup File Handling
  it('2. Detects corrupted JSON and handles empty / invalid root structures cleanly', async () => {
    const corruptedJson = '{ "formatVersion": "3.0", "data": { "products": [ }'; // Invalid JSON syntax

    const report = await validateBackupFile(corruptedJson);

    expect(report.isValid).toBe(false);
    expect(report.isCorrupted).toBe(true);
    expect(report.errors.some((e) => e.code === 'JSON_SYNTAX_ERROR')).toBe(true);

    const nonObjectReport = await validateBackupFile(12345 as any);
    expect(nonObjectReport.isValid).toBe(false);
    expect(nonObjectReport.isCorrupted).toBe(true);
    expect(nonObjectReport.errors.some((e) => e.code === 'INVALID_ROOT')).toBe(true);
  });

  // Test Case 3: Modified Backup / Checksum Mismatch Detection
  it('3. Flags checksum mismatch when backup data payload is tampered with', async () => {
    const p1: Product = {
      id: generateStableId('prod'),
      name: 'ကုန်ချော ပန်းကန်',
      category: 'ကုန်ချော',
      unit: 'ခု',
      defaultPrice: 25000,
      currentStock: 10,
      active: true,
    };
    await db.products.put(p1);

    const validBackup = await createCompleteBackup();

    // Tamper with data payload without updating checksum
    const tamperedBackup = JSON.parse(JSON.stringify(validBackup));
    tamperedBackup.data.products[0].defaultPrice = 999999; // Modified price!

    const report = await validateBackupFile(tamperedBackup);

    expect(report.checksumValid).toBe(false);
    expect(report.warnings.some((w) => w.code === 'CHECKSUM_MISMATCH')).toBe(true);
    // Should still parse data cleanly for deep inspection
    expect(report.normalizedData?.products[0].defaultPrice).toBe(999999);
  });

  // Test Case 4: Wrong / Newer Database Schema Version
  it('4. Warns on future or newer database schema version', async () => {
    const futureBackup = {
      formatVersion: '3.0',
      appVersion: '9.9.0',
      databaseSchemaVersion: 99, // Future schema version
      exportedAt: new Date().toISOString(),
      data: {
        products: [],
        suppliers: [],
        merchants: [],
        transactions: [],
        sales: [],
        merchantPurchases: [],
        orders: [],
        stockAdjustments: [],
        peerTrades: [],
        softDeletedItems: [],
        auditLogs: [],
        rawMaterialPresets: [],
        attachments: [],
      },
    };

    const report = await validateBackupFile(futureBackup);

    expect(report.warnings.some((w) => w.code === 'NEWER_SCHEMA_VERSION')).toBe(true);
  });

  // Test Case 5: Duplicate ID Detection
  it('5. Detects duplicate entity IDs and logs warning for deduplication', async () => {
    const dupId = generateStableId('prod');
    const duplicateBackup = {
      formatVersion: '3.0',
      databaseSchemaVersion: 3,
      data: {
        products: [
          { id: dupId, name: 'ပစ္စည်း A', defaultPrice: 1000 },
          { id: dupId, name: 'ပစ္စည်း A (Duplicate)', defaultPrice: 1000 },
        ],
        suppliers: [],
        merchants: [],
        transactions: [],
        sales: [],
        merchantPurchases: [],
        orders: [],
        stockAdjustments: [],
        peerTrades: [],
        softDeletedItems: [],
        auditLogs: [],
        rawMaterialPresets: [],
        attachments: [],
      },
    };

    const report = await validateBackupFile(duplicateBackup);

    expect(
      report.warnings.some((w) => w.code === 'DUPLICATE_PRODUCT_IDS' || w.code === 'DUPLICATE_PRODUCTS_IDS')
    ).toBe(true);
  });

  // Test Case 6: Missing References Detection
  it('6. Detects missing merchant/supplier and item product references', async () => {
    const orphanBackup = {
      formatVersion: '3.0',
      databaseSchemaVersion: 3,
      data: {
        products: [{ id: 'prod-01', name: 'ယွန်းသေတ္တာ', defaultPrice: 5000 }],
        suppliers: [],
        merchants: [],
        sales: [
          {
            id: 'sale-01',
            voucherNo: 'SALE-001',
            merchantId: 'non-existent-merchant-id',
            date: '2026-09-10',
            time: '10:00',
            grandTotal: 10000,
            cashPaidByMerchant: 10000,
            remainingReceivableBalance: 0,
            items: [{ productId: 'missing-prod-id', quantity: 2, unitPrice: 5000, subtotal: 10000 }],
          },
        ],
        transactions: [],
        merchantPurchases: [],
        orders: [],
        stockAdjustments: [],
        peerTrades: [],
        softDeletedItems: [],
        auditLogs: [],
        rawMaterialPresets: [],
        attachments: [],
      },
    };

    const report = await validateBackupFile(orphanBackup);

    expect(report.warnings.some((w) => w.code === 'ORPHAN_SALE_MERCHANTS')).toBe(true);
    expect(report.warnings.some((w) => w.code === 'MISSING_PRODUCT_REFERENCE')).toBe(true);
  });

  // Test Case 7: Large Backup Performance & Processing
  it('7. Processes large backup datasets (1000+ records) safely', async () => {
    const largeProducts: Product[] = [];
    for (let i = 0; i < 1000; i++) {
      largeProducts.push({
        id: `prod-bulk-${i}`,
        name: `ကုန်ပစ္စည်း - ${i}`,
        category: 'အမြုတေ',
        unit: 'ခု',
        defaultPrice: 1000 + i,
        currentStock: 100,
        active: true,
      });
    }

    await db.products.bulkPut(largeProducts);

    const largeBackup = await createCompleteBackup();
    expect(largeBackup.data.products.length).toBe(1000);

    const report = await validateBackupFile(largeBackup);
    expect(report.isValid).toBe(true);
    expect(report.counts.products).toBe(1000);

    // Restore overwrite
    const restoreResult = await executeSafeRestore(report, 'OVERWRITE');
    expect(restoreResult.success).toBe(true);

    const countInDb = await db.products.count();
    expect(countInDb).toBe(1000);
  });

  // Test Case 8: Restore Failure Data Protection
  it('8. Ensures existing data remains 100% usable if restore fails or is invalid', async () => {
    // Seed initial baseline product
    const initialProd: Product = {
      id: 'prod-baseline-01',
      name: 'မူလ ကုန်ပစ္စည်း',
      category: 'အထွေထွေ',
      unit: 'ခု',
      defaultPrice: 5000,
      active: true,
    };
    await db.products.put(initialProd);

    // Create an invalid report (e.g. fatal errors)
    const invalidReport: any = {
      isValid: false,
      normalizedData: null,
      errors: [{ field: 'root', message: 'Fatal error', severity: 'FATAL' }],
    };

    await expect(executeSafeRestore(invalidReport, 'OVERWRITE')).rejects.toThrow();

    // Verify baseline product remains untouched
    const currentProds = await db.products.toArray();
    expect(currentProds.length).toBe(1);
    expect(currentProds[0].id).toBe('prod-baseline-01');
  });

  // Test Case 9: Backup Containing Photos / Attachments
  it('9. Backs up and restores voucher attachment photo assets atomically', async () => {
    const attachmentId = generateStableId('att');
    const voucherId = generateStableId('sale');

    await db.attachments.put({
      id: attachmentId,
      voucherId,
      imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      caption: 'အရောင်းပြေစာ လက်မှတ်',
      createdAt: new Date().toISOString(),
    });

    const backup = await createCompleteBackup();
    expect(backup.data.attachments).toBeDefined();
    expect(backup.data.attachments.length).toBe(1);
    expect(backup.data.attachments[0].id).toBe(attachmentId);

    const report = await validateBackupFile(backup);
    expect(report.isValid).toBe(true);

    // Clear DB and restore
    await db.attachments.clear();
    await executeSafeRestore(report, 'OVERWRITE');

    const restoredAttachments = await db.attachments.toArray();
    expect(restoredAttachments.length).toBe(1);
    expect(restoredAttachments[0].id).toBe(attachmentId);
    expect(restoredAttachments[0].imageBase64).toContain('base64');
  });

  // Test Case 10: Complete Round-Trip Record Count Verification (sales, purchases, auditLogs, etc.)
  it('10. Verifies exact round-trip record count consistency across all database tables', async () => {
    // Seed comprehensive multi-table data
    const p1: Product = {
      id: generateStableId('prod'),
      name: 'မြန်မာ့ရိုးရာ လက်ကောက်',
      category: 'ရွှေထည်',
      unit: 'ကွင်း',
      defaultPrice: 50000,
      currentStock: 25,
      active: true,
      createdAt: '2026-09-10T10:00:00Z',
    };
    const s1: Supplier = {
      id: generateStableId('sup'),
      code: 'SUP-01',
      name: 'ဒေါ်ခင်',
      phone: '0911111111',
      village: 'မင်းနန်သူ',
      currentAdvanceBalance: 10000,
      totalGoodsValueDelivered: 100000,
      totalAdvanceGiven: 50000,
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z',
    };
    const m1: Merchant = {
      id: generateStableId('merch'),
      code: 'M-01',
      name: 'ကိုအောင်',
      town: 'မန္တလေး',
      phone: '0922222222',
      currentReceivableBalance: 20000,
      totalPaidAmount: 180000,
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z',
    };
    const sale1: SaleRecord = {
      id: generateStableId('sale'),
      voucherNo: 'SALE-20260910-001',
      merchantId: m1.id,
      merchantName: m1.name,
      merchantTown: 'မန္တလေး',
      date: '2026-09-10',
      time: '14:30',
      items: [{ productId: p1.id, productName: p1.name, quantity: 2, unitPrice: 50000, subtotal: 100000, unit: 'ကွင်း' }],
      grandTotal: 100000,
      cashPaidByMerchant: 80000,
      remainingReceivableBalance: 20000,
      idempotencyKey: generateStableId('idemp'),
    };
    const purch1: MerchantPurchaseRecord = {
      id: generateStableId('mp'),
      purchaseNo: 'PUR-20260910-001',
      merchantId: m1.id,
      merchantName: m1.name,
      merchantTown: 'မန္တလေး',
      date: '2026-09-10',
      time: '11:00',
      items: [{ productId: p1.id, productName: p1.name, quantity: 10, unitPrice: 40000, subtotal: 400000, unit: 'ကွင်း' }],
      totalAmount: 400000,
      paidAmount: 400000,
      remainingPayableBalance: 0,
      paymentMethod: 'CASH',
      idempotencyKey: generateStableId('idemp'),
      createdAt: '2026-09-10T11:00:00Z',
    };
    const tx1: TransactionRecord = {
      id: generateStableId('tx'),
      voucherNo: 'TX-20260910-001',
      supplierId: s1.id,
      supplierName: s1.name,
      items: [],
      type: 'MERCHANT_PAYMENT',
      totalAmount: 50000,
      date: '2026-09-10',
      time: '15:00',
      paymentMethod: 'KBZPAY',
      idempotencyKey: generateStableId('idemp'),
    };
    const audit1: AuditLogEntry = {
      id: generateStableId('aud'),
      action: 'SALE_RECORDED',
      actionType: 'SALE',
      details: 'အရောင်းပြေစာ SALE-20260910-001 အောင်မြင်စွာ မှတ်တမ်းတင်ခဲ့သည်',
      timestamp: '2026-09-10T14:30:00Z',
    };
    const audit2: AuditLogEntry = {
      id: generateStableId('aud'),
      action: 'PURCHASE_RECORDED',
      actionType: 'PURCHASE',
      details: 'အဝယ်ပြေစာ PURCH-20260910-001 အောင်မြင်စွာ မှတ်တမ်းတင်ခဲ့သည်',
      timestamp: '2026-09-10T11:00:00Z',
    };

    await db.products.put(p1);
    await db.suppliers.put(s1);
    await db.merchants.put(m1);
    await db.sales.put(sale1);
    await db.merchantPurchases.put(purch1);
    await db.transactions.put(tx1);
    await db.auditLogs.bulkPut([audit1, audit2]);

    // 1. Generate complete backup
    const backup = await createCompleteBackup();
    expect(backup.data.products.length).toBe(1);
    expect(backup.data.suppliers.length).toBe(1);
    expect(backup.data.merchants.length).toBe(1);
    expect(backup.data.sales.length).toBe(1);
    expect(backup.data.merchantPurchases.length).toBe(1);
    expect(backup.data.transactions.length).toBe(1);
    expect(backup.data.auditLogs.length).toBe(2);

    // 2. Validate backup
    const report = await validateBackupFile(backup);
    expect(report.isValid).toBe(true);
    expect(report.checksumValid).toBe(true);

    // 3. Clear database completely to simulate new device restore
    await Promise.all([
      db.products.clear(),
      db.suppliers.clear(),
      db.merchants.clear(),
      db.sales.clear(),
      db.merchantPurchases.clear(),
      db.transactions.clear(),
      db.auditLogs.clear(),
    ]);

    // 4. Restore in OVERWRITE mode
    const restoreResult = await executeSafeRestore(report, 'OVERWRITE');
    expect(restoreResult.success).toBe(true);

    // 5. Assert all record counts are exactly restored
    const [resProds, resSupps, resMerchs, resSales, resPurchs, resTxs, resAudit] = await Promise.all([
      db.products.count(),
      db.suppliers.count(),
      db.merchants.count(),
      db.sales.count(),
      db.merchantPurchases.count(),
      db.transactions.count(),
      db.auditLogs.count(),
    ]);

    expect(resProds).toBe(1);
    expect(resSupps).toBe(1);
    expect(resMerchs).toBe(1);
    expect(resSales).toBe(1);
    expect(resPurchs).toBe(1);
    expect(resTxs).toBe(1);
    // Audit logs will have the 2 original logs + 1 RESTORE_OVERWRITE audit entry
    expect(resAudit).toBe(3);

    // Verify entity field integrity
    const restoredSale = await db.sales.get(sale1.id);
    expect(restoredSale?.voucherNo).toBe(sale1.voucherNo);
    expect(restoredSale?.grandTotal).toBe(100000);

    const restoredPurch = await db.merchantPurchases.get(purch1.id);
    expect(restoredPurch?.purchaseNo).toBe(purch1.purchaseNo);
    expect(restoredPurch?.totalAmount).toBe(400000);
  });

  // Test Case 11: Corrupt / Truncated Backup File Handling with Zero Partial Writes
  it('11. Gracefully rejects corrupt and truncated backup files without modifying database', async () => {
    // Seed baseline product
    const baselineProduct: Product = {
      id: 'prod-safe-01',
      name: 'လုံခြုံစိတ်ချရသော ကုန်ပစ္စည်း',
      category: 'မူလဒေတာ',
      unit: 'ခု',
      defaultPrice: 30000,
      active: true,
    };
    await db.products.put(baselineProduct);

    // Truncated JSON string (e.g. download interrupted)
    const truncatedJsonString = '{"formatVersion":"3.0","data":{"products":[{"id":"bad-prod-1","name":"ပျက်စီးဖိုင်"';

    const report = await validateBackupFile(truncatedJsonString);
    expect(report.isValid).toBe(false);
    expect(report.isCorrupted).toBe(true);

    // Attempting restore on invalid/corrupted report should reject
    await expect(executeSafeRestore(report, 'OVERWRITE')).rejects.toThrow('မမှန်ကန်သော Backup ဒေတာဖြစ်သဖြင့် Restore ပြုလုပ်၍ မရပါ');

    // Verify database was completely untouched (no partial writes)
    const prods = await db.products.toArray();
    expect(prods.length).toBe(1);
    expect(prods[0].id).toBe('prod-safe-01');
    expect(prods[0].name).toBe('လုံခြုံစိတ်ချရသော ကုန်ပစ္စည်း');
  });

  // Test Case 12: Mid-Transaction Failure and Snapshot Auto-Recovery
  it('12. Rolls back and auto-recovers from pre-restore snapshot when mid-transaction error occurs', async () => {
    // Seed baseline database
    const baselineProduct: Product = {
      id: 'prod-existing-1',
      name: 'မူလရှိပြီးသား ပစ္စည်း',
      category: 'အထည်',
      unit: 'ထည်',
      defaultPrice: 15000,
      active: true,
    };
    const baselineSupplier: Supplier = {
      id: 'sup-existing-1',
      code: 'SUP-01',
      name: 'ဒေါ်လှ',
      village: 'တကောင်း',
      phone: '0999999999',
      currentAdvanceBalance: 0,
      totalGoodsValueDelivered: 50000,
      totalAdvanceGiven: 0,
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    };
    await db.products.put(baselineProduct);
    await db.suppliers.put(baselineSupplier);

    // Create a backup to restore from that will trigger post-restore count mismatch
    const incomingProduct: Product = {
      id: 'prod-incoming-1',
      name: 'အသစ်သွင်းမည့် ပစ္စည်း',
      category: 'အသစ်',
      unit: 'ခု',
      defaultPrice: 20000,
      active: true,
    };
    await db.products.put(incomingProduct);
    const validBackup = await createCompleteBackup();
    const report = await validateBackupFile(validBackup);
    expect(report.isValid).toBe(true);

    // Reset DB to baseline state
    await db.products.clear();
    await db.products.put(baselineProduct);

    // Simulate mid-transaction failure during bulkPut using spy
    const bulkPutSpy = vi
      .spyOn(db.products, 'bulkPut')
      .mockRejectedValueOnce(new Error('Simulated Mid-Transaction Disk Full Failure'));

    try {
      // Attempting restore should fail inside transaction, triggering snapshot auto-recovery
      await expect(executeSafeRestore(report, 'OVERWRITE')).rejects.toThrow(
        'Simulated Mid-Transaction Disk Full Failure'
      );
    } finally {
      bulkPutSpy.mockRestore();
    }

    // Verify auto-recovery restored the baseline database state
    const prodsAfterFailure = await db.products.toArray();
    expect(prodsAfterFailure.length).toBe(1);
    expect(prodsAfterFailure[0].id).toBe(baselineProduct.id);
    expect(prodsAfterFailure[0].name).toBe('မူလရှိပြီးသား ပစ္စည်း');

    const suppsAfterFailure = await db.suppliers.toArray();
    expect(suppsAfterFailure.length).toBe(1);
    expect(suppsAfterFailure[0].id).toBe(baselineSupplier.id);

    // Verify snapshot was created in recoverySnapshots table
    const snapshots = await getRecoverySnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
  });

  // Test Case 13: SMART_MERGE Timestamp Conflict Resolution and Audit Trail Immutability
  it('13. Resolves SMART_MERGE conflicts via timestamps and guarantees audit trail immutability', async () => {
    // 1. Seed existing local database with 2 products and 1 audit log
    const localProductNewer: Product = {
      id: 'prod-conflict-1',
      name: 'ပစ္စည်း ၁ (Local newer edit)',
      category: 'အထည်',
      unit: 'ထည်',
      defaultPrice: 25000, // Local price updated recently
      updatedAt: '2026-09-11T12:00:00Z',
      active: true,
    };
    const localProductOlder: Product = {
      id: 'prod-conflict-2',
      name: 'ပစ္စည်း ၂ (Local older)',
      category: 'အထည်',
      unit: 'ထည်',
      defaultPrice: 10000,
      updatedAt: '2026-09-08T10:00:00Z',
      active: true,
    };
    const existingAuditLog: AuditLogEntry = {
      id: 'aud-immutability-1',
      action: 'ORIGINAL_LOG',
      details: 'မူလ မူရင်း Audit Log ဖြစ်သည် (ဘယ်သောအခါမှ အစားထိုးမခံရပါ)',
      timestamp: '2026-09-08T10:00:00Z',
    };

    await db.products.bulkPut([localProductNewer, localProductOlder]);
    await db.auditLogs.put(existingAuditLog);

    // 2. Incoming backup has:
    // - prod-conflict-1 with OLDER timestamp (2026-09-09) and price 18000 -> Local should be preserved!
    // - prod-conflict-2 with NEWER timestamp (2026-09-11T15:00:00Z) and price 14000 -> Incoming should update!
    // - prod-brand-new -> Incoming should be added!
    // - aud-immutability-1 with tampered details -> Must NOT overwrite existing audit log!
    // - aud-new-historical-log -> Must be appended!
    const incomingBackup = {
      formatVersion: '3.0',
      databaseSchemaVersion: 3,
      data: {
        products: [
          {
            id: 'prod-conflict-1',
            name: 'ပစ္စည်း ၁ (Backup older edit)',
            category: 'အထည်',
            unit: 'ထည်',
            defaultPrice: 18000,
            updatedAt: '2026-09-09T10:00:00Z', // Older than local
            active: true,
          },
          {
            id: 'prod-conflict-2',
            name: 'ပစ္စည်း ၂ (Backup newer edit)',
            category: 'အထည်',
            unit: 'ထည်',
            defaultPrice: 14000,
            updatedAt: '2026-09-11T15:00:00Z', // Newer than local
            active: true,
          },
          {
            id: 'prod-brand-new',
            name: 'ပစ္စည်း အသစ်',
            category: 'အသစ်',
            unit: 'ခု',
            defaultPrice: 30000,
            updatedAt: '2026-09-11T16:00:00Z',
            active: true,
          },
        ],
        suppliers: [],
        merchants: [],
        transactions: [],
        sales: [],
        merchantPurchases: [],
        orders: [],
        stockAdjustments: [],
        peerTrades: [],
        softDeletedItems: [],
        auditLogs: [
          {
            id: 'aud-immutability-1', // Same ID as existing
            action: 'ATTEMPTED_OVERWRITE_ACTION',
            details: 'ဖျက်ဆီး/အစားထိုးရန် ကြိုးစားသော အချက်အလက်',
            timestamp: '2026-09-11T10:00:00Z',
          },
          {
            id: 'aud-new-historical-2',
            action: 'NEW_REMOTE_LOG',
            details: 'အသစ်ထည့်သွင်းမည့် Audit Log',
            timestamp: '2026-09-11T11:00:00Z',
          },
        ],
        rawMaterialPresets: [],
        attachments: [],
      },
    };

    const report = await validateBackupFile(incomingBackup);
    expect(report.isValid).toBe(true);

    // 3. Execute SMART_MERGE
    const mergeResult = await executeSafeRestore(report, 'SMART_MERGE');
    expect(mergeResult.success).toBe(true);

    // 4. Verify conflict resolution outcomes:
    // Product 1: Local is newer -> PRESERVED! Price must remain 25000
    const p1 = await db.products.get('prod-conflict-1');
    expect(p1?.defaultPrice).toBe(25000);
    expect(p1?.name).toBe('ပစ္စည်း ၁ (Local newer edit)');

    // Product 2: Incoming is newer -> UPDATED! Price must be updated to 14000
    const p2 = await db.products.get('prod-conflict-2');
    expect(p2?.defaultPrice).toBe(14000);
    expect(p2?.name).toBe('ပစ္စည်း ၂ (Backup newer edit)');

    // Product 3: Brand new -> ADDED!
    const p3 = await db.products.get('prod-brand-new');
    expect(p3?.name).toBe('ပစ္စည်း အသစ်');

    // 5. Verify Audit Trail Immutability:
    // Existing audit log aud-immutability-1 MUST NOT have been overwritten
    const auditLog1 = await db.auditLogs.get('aud-immutability-1');
    expect(auditLog1?.details).toBe('မူလ မူရင်း Audit Log ဖြစ်သည် (ဘယ်သောအခါမှ အစားထိုးမခံရပါ)');
    expect(auditLog1?.action).toBe('ORIGINAL_LOG');

    // New audit log aud-new-historical-2 MUST be added
    const auditLog2 = await db.auditLogs.get('aud-new-historical-2');
    expect(auditLog2?.details).toBe('အသစ်ထည့်သွင်းမည့် Audit Log');

    // Check no duplicate audit log IDs exist
    const allAuditLogs = await db.auditLogs.toArray();
    const uniqueLogIds = new Set(allAuditLogs.map((a) => a.id));
    expect(uniqueLogIds.size).toBe(allAuditLogs.length);
  });

  // Test Case 14: Backward Compatibility for Legacy v1/v2 Backups
  it('14. Validates structural integrity of legacy v1/v2 backups without cryptographic checksums', async () => {
    // Valid legacy v2 format (contains schema/format version 2.0 and no checksum)
    const validLegacyV2Backup = {
      formatVersion: '2.0',
      databaseSchemaVersion: 2,
      exportedAt: '2025-12-01T12:00:00Z',
      data: {
        products: [
          { id: 'legacy-prod-1', name: 'ရှေးရိုးရာ အင်္ကျီ', defaultPrice: 12000, currentStock: 5 },
        ],
        suppliers: [
          { id: 'legacy-sup-1', name: 'ဒေါ်လှမြင့်', phone: '0977777777' },
        ],
        merchants: [],
        transactions: [],
        sales: [],
        merchantPurchases: [],
        orders: [],
        stockAdjustments: [],
      },
    };

    const report = await validateBackupFile(validLegacyV2Backup);
    expect(report.isValid).toBe(true);
    expect(report.checksumValid).toBe(true);
    expect(
      report.warnings.some((w) => w.code === 'LEGACY_BACKUP_STRUCTURAL_INTEGRITY_VERIFIED')
    ).toBe(true);

    // Corrupt legacy v2 format (products collection is malformed with missing ID)
    const corruptLegacyV2Backup = {
      formatVersion: '2.0',
      data: {
        products: [
          { name: 'Missing ID Product', defaultPrice: 1000 }, // missing id!
        ],
        suppliers: [],
        merchants: [],
        transactions: [],
        sales: [],
      },
    };

    const corruptReport = await validateBackupFile(corruptLegacyV2Backup);
    expect(corruptReport.isValid).toBe(false);
    expect(corruptReport.checksumValid).toBe(false);
    expect(corruptReport.errors.some((e) => e.code === 'MISSING_ENTITY_ID')).toBe(true);
  });
});
