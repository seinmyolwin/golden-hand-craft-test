import { describe, it, expect, beforeEach } from 'vitest';
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
} from '../services/backupService';
import { Product, Supplier, Merchant, SaleRecord, TransactionRecord } from '../types';
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
      name: 'ယွန်းထည် ပန်းကန်',
      category: 'ယွန်းထည်',
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
});
