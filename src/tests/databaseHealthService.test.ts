import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ShweLetYarDatabase, AttachmentRecord } from '../db/database';
import {
  runDatabaseDiagnostics,
  exportDiagnosticReportJSON,
  exportDiagnosticReportCSV,
} from '../services/databaseHealthService';
import {
  Product,
  Supplier,
  Merchant,
  TransactionRecord,
  SettingRecord,
} from '../types';

// Polyfill localStorage if needed
const memoryStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
  (globalThis as any).window = globalThis;
}

describe('Phase 12: Professional Database Health & Diagnostics Service', () => {
  let testDb: ShweLetYarDatabase;

  beforeEach(async () => {
    localStorageMock.clear();
    testDb = new ShweLetYarDatabase();
    await testDb.products.clear();
    await testDb.suppliers.clear();
    await testDb.merchants.clear();
    await testDb.transactions.clear();
    await testDb.sales.clear();
    await testDb.merchantPurchases.clear();
    await testDb.orders.clear();
    await testDb.stockAdjustments.clear();
    await testDb.peerTrades.clear();
    await testDb.softDeletedItems.clear();
    await testDb.auditLogs.clear();
    await testDb.rawMaterialPresets.clear();
    await testDb.settings.clear();
    await testDb.recoverySnapshots.clear();
    await testDb.attachments.clear();
  });

  // Test 1: Healthy database -> HEALTHY
  it('1. Healthy database reports overallStatus: HEALTHY', async () => {
    const prod: Product = {
      id: 'prod_1',
      name: 'ရွှေလက်ရာ ယွန်းပန်းကန်',
      category: 'ကုန်ချော',
      defaultPrice: 15000,
      defaultWholesalePrice: 18000,
      unit: 'ချပ်',
      openingStock: 10,
      currentStock: 15,
      minStockAlert: 5,
      active: true,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.products.add(prod);

    const sup: Supplier = {
      id: 'sup_1',
      code: 'SUP-001',
      name: 'ဦးဘရှင်',
      village: 'မင်းနန်သူ',
      phone: '0912345678',
      currentAdvanceBalance: 50000,
      totalGoodsValueDelivered: 150000,
      totalAdvanceGiven: 200000,
      totalMaterialCreditGiven: 0,
      totalRepaymentReceived: 0,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.suppliers.add(sup);

    const merch: Merchant = {
      id: 'merch_1',
      code: 'M-001',
      name: 'ဒေါ်မြရီ',
      town: 'မန္တလေး',
      phone: '0987654321',
      currentReceivableBalance: 20000,
      totalPurchasesValue: 80000,
      totalPaidAmount: 60000,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.merchants.add(merch);

    const tx: TransactionRecord = {
      id: 'tx_1',
      voucherNo: 'TX-1001',
      supplierId: 'sup_1',
      supplierName: 'ဦးဘရှင်',
      date: '2026-03-01',
      time: '10:30',
      items: [
        {
          productId: 'prod_1',
          productName: 'ရွှေလက်ရာ ယွန်းပန်းကန်',
          quantity: 5,
          unitPrice: 15000,
          subtotal: 75000,
          unit: 'ချပ်',
        },
      ],
      totalGoodsValue: 75000,
      previousAdvanceBalance: 50000,
      advanceDeducted: 20000,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 30000,
      cashPaidToSupplier: 55000,
      status: 'COMPLETED',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.transactions.add(tx);

    const report = await runDatabaseDiagnostics(testDb);

    expect(report.overallStatus).toBe('HEALTHY');
    expect(report.criticalCount).toBe(0);
    expect(report.errorCount).toBe(0);
    expect(report.passedChecks).toBeGreaterThan(0);
  });

  // Test 2: Duplicate ID -> ERROR/CRITICAL
  it('2. Duplicate Primary ID is detected with CRITICAL severity', async () => {
    // We simulate duplicate IDs in products
    const prod1: Product = {
      id: 'prod_dup',
      name: 'Product 1',
      category: 'ကုန်ချော',
      defaultPrice: 5000,
      unit: 'ခု',
      active: true,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.products.add(prod1);

    // Bypass Dexie primary key constraint on table add by injecting via array in read
    const originalToArray = testDb.products.toArray.bind(testDb.products);
    (testDb.products as any).toArray = async () => {
      const items = await originalToArray();
      return [...items, { ...prod1, name: 'Product 2 duplicate ID' }];
    };

    const report = await runDatabaseDiagnostics(testDb);
    expect(report.overallStatus).toBe('CRITICAL');
    expect(report.criticalCount).toBeGreaterThan(0);
    const dupIssue = report.results.find((r) => r.code === 'DUPLICATE_PRIMARY_ID');
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.severity).toBe('CRITICAL');
    expect(dupIssue?.recordId).toBe('prod_dup');
  });

  // Test 3: Missing required field -> ERROR
  it('3. Missing required field is flagged with ERROR severity', async () => {
    const invalidProd: any = {
      id: 'prod_no_name',
      name: '', // Empty required name!
      category: 'ကုန်ချော',
      defaultPrice: 5000,
      unit: 'ခု',
      active: true,
    };
    await testDb.products.add(invalidProd);

    const report = await runDatabaseDiagnostics(testDb);
    expect(['DEGRADED', 'CRITICAL']).toContain(report.overallStatus);
    const issue = report.results.find((r) => r.code === 'MISSING_REQUIRED_FIELD');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('ERROR');
    expect(issue?.recordId).toBe('prod_no_name');
  });

  // Test 4: Broken foreign key -> ERROR
  it('4. Broken foreign key reference is flagged with ERROR severity', async () => {
    const tx: TransactionRecord = {
      id: 'tx_broken',
      voucherNo: 'V-BROKEN-01',
      supplierId: 'non_existent_supplier_123', // Broken reference
      supplierName: 'Missing Supplier',
      date: '2026-03-01',
      time: '11:00',
      items: [],
      totalGoodsValue: 0,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      status: 'COMPLETED',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.transactions.add(tx);

    const report = await runDatabaseDiagnostics(testDb);
    expect(['DEGRADED', 'CRITICAL']).toContain(report.overallStatus);
    const brokenRef = report.results.find((r) => r.code === 'BROKEN_FOREIGN_KEY');
    expect(brokenRef).toBeDefined();
    expect(brokenRef?.severity).toBe('ERROR');
    expect(brokenRef?.relatedRecordIds).toContain('non_existent_supplier_123');
  });

  // Test 5: Orphan attachment -> WARN/ERROR
  it('5. Orphan attachment referencing non-existent voucher is detected', async () => {
    const orphanAtt: AttachmentRecord = {
      id: 'att_orphan_99',
      voucherId: 'NON_EXISTENT_VOUCHER_123', // Orphan
      sizeBytes: 2048,
      mimeType: 'image/jpeg',
      imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      createdAt: '2026-03-01T10:00:00.000Z',
    };
    await testDb.attachments.add(orphanAtt);

    const report = await runDatabaseDiagnostics(testDb);
    const orphanIssue = report.results.find((r) => r.code === 'ORPHAN_ATTACHMENT');
    expect(orphanIssue).toBeDefined();
    expect(['WARN', 'ERROR']).toContain(orphanIssue?.severity);
  });

  // Test 6: Invalid monetary value -> ERROR
  it('6. Invalid monetary value (NaN or negative price) is flagged as ERROR', async () => {
    const prodWithNegativePrice: Product = {
      id: 'prod_neg_price',
      name: 'Negative Price Goods',
      category: 'ကုန်ချော',
      defaultPrice: -5000, // Prohibited negative price!
      unit: 'ခု',
      active: true,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.products.add(prodWithNegativePrice);

    const report = await runDatabaseDiagnostics(testDb);
    const priceIssue = report.results.find((r) => r.code === 'NEGATIVE_PRICE' || r.code === 'INVALID_MONETARY_VALUE');
    expect(priceIssue).toBeDefined();
    expect(priceIssue?.severity).toBe('ERROR');
  });

  // Test 7: Invalid quantity -> ERROR
  it('7. Invalid item quantity (zero or negative) is flagged as ERROR', async () => {
    // Valid product & supplier
    await testDb.products.add({
      id: 'p_valid',
      name: 'Bowl',
      category: 'ကုန်ချော',
      defaultPrice: 1000,
      unit: 'ခု',
      active: true,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    });
    await testDb.suppliers.add({
      id: 's_valid',
      code: 'S-01',
      name: 'U Ba',
      village: 'Village',
      phone: '09123',
      currentAdvanceBalance: 0,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    });

    const txWithNegativeQty: TransactionRecord = {
      id: 'tx_bad_qty',
      voucherNo: 'V-BAD-QTY',
      supplierId: 's_valid',
      supplierName: 'U Ba',
      date: '2026-03-01',
      time: '12:00',
      items: [
        {
          productId: 'p_valid',
          productName: 'Bowl',
          quantity: -10, // Invalid negative quantity!
          unitPrice: 1000,
          subtotal: -10000,
          unit: 'ခု',
        },
      ],
      totalGoodsValue: 0,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      status: 'COMPLETED',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.transactions.add(txWithNegativeQty);

    const report = await runDatabaseDiagnostics(testDb);
    const qtyIssue = report.results.find((r) => r.code === 'INVALID_QUANTITY');
    expect(qtyIssue).toBeDefined();
    expect(qtyIssue?.severity).toBe('ERROR');
  });

  // Test 8: Duplicate voucher number -> WARN/ERROR
  it('8. Duplicate voucher number in transactions is flagged with ERROR', async () => {
    await testDb.suppliers.add({
      id: 's1',
      code: 'S-01',
      name: 'U Ba',
      village: 'Village',
      phone: '09123',
      currentAdvanceBalance: 0,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    });

    const tx1: TransactionRecord = {
      id: 'tx_101',
      voucherNo: 'VOUCHER-DUP-99',
      supplierId: 's1',
      supplierName: 'U Ba',
      date: '2026-03-01',
      time: '10:00',
      items: [],
      totalGoodsValue: 0,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      status: 'COMPLETED',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    const tx2: TransactionRecord = {
      id: 'tx_102',
      voucherNo: 'VOUCHER-DUP-99', // Duplicate voucher number!
      supplierId: 's1',
      supplierName: 'U Ba',
      date: '2026-03-01',
      time: '11:00',
      items: [],
      totalGoodsValue: 0,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      status: 'COMPLETED',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };

    await testDb.transactions.add(tx1);
    await testDb.transactions.add(tx2);

    const report = await runDatabaseDiagnostics(testDb);
    const vDup = report.results.find((r) => r.code === 'DUPLICATE_VOUCHER_NUMBER');
    expect(vDup).toBeDefined();
    expect(['WARN', 'ERROR']).toContain(vDup?.severity);
  });

  // Test 9: Invalid date -> ERROR
  it('9. Invalid calendar date format is flagged with ERROR', async () => {
    await testDb.suppliers.add({
      id: 's_date',
      code: 'S-DATE',
      name: 'U Mya',
      village: 'Town',
      phone: '09123',
      currentAdvanceBalance: 0,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    });

    const txBadDate: TransactionRecord = {
      id: 'tx_bad_date',
      voucherNo: 'V-BAD-DATE',
      supplierId: 's_date',
      supplierName: 'U Mya',
      date: '2026-02-30', // Impossible date (Feb 30th)!
      time: '12:00',
      items: [],
      totalGoodsValue: 0,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      status: 'COMPLETED',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };
    await testDb.transactions.add(txBadDate);

    const report = await runDatabaseDiagnostics(testDb);
    const dateIssue = report.results.find((r) => r.code === 'INVALID_DATE_FORMAT');
    expect(dateIssue).toBeDefined();
    expect(dateIssue?.severity).toBe('ERROR');
  });

  // Test 10: Invalid attachment metadata -> ERROR
  it('10. Invalid attachment metadata (zero or negative size) is flagged with ERROR', async () => {
    const badAtt: AttachmentRecord = {
      id: 'att_bad_meta',
      voucherId: 'v_dummy',
      sizeBytes: -50, // Invalid negative sizeBytes!
      mimeType: 'application/x-executable', // Invalid MIME!
      imageBase64: 'data:text/plain;base64,abc',
      createdAt: '2026-03-01T10:00:00Z',
    };
    await testDb.attachments.add(badAtt);

    const report = await runDatabaseDiagnostics(testDb);
    const sizeIssue = report.results.find((r) => r.code === 'INVALID_ATTACHMENT_SIZE');
    const mimeIssue = report.results.find((r) => r.code === 'INVALID_ATTACHMENT_MIME_TYPE');
    expect(sizeIssue || mimeIssue).toBeDefined();
    expect(sizeIssue?.severity || mimeIssue?.severity).toBe('ERROR');
  });

  // Test 11: Empty database -> HEALTHY/INFO, NOT ERROR
  it('11. Empty database reports HEALTHY / INFO state, NOT an error', async () => {
    const report = await runDatabaseDiagnostics(testDb);

    expect(report.overallStatus).toBe('HEALTHY');
    expect(report.criticalCount).toBe(0);
    expect(report.errorCount).toBe(0);
    const emptyDbInfo = report.results.find((r) => r.code === 'EMPTY_DATABASE');
    expect(emptyDbInfo).toBeDefined();
    expect(emptyDbInfo?.severity).toBe('INFO');
  });

  // Test 12: Database read failure -> ERROR
  it('12. Database read failure is caught and reported as ERROR', async () => {
    // Mock products.toArray to reject
    const brokenDb = new ShweLetYarDatabase();
    (brokenDb.products as any).toArray = async () => {
      throw new Error('IndexedDB storage connection crashed');
    };

    const report = await runDatabaseDiagnostics(brokenDb);
    expect(['DEGRADED', 'CRITICAL']).toContain(report.overallStatus);
    const readFail = report.results.find((r) => r.code === 'DATABASE_READ_FAILURE');
    expect(readFail).toBeDefined();
    expect(readFail?.severity).toBe('ERROR');
  });

  // Test 13: Diagnostics must not mutate database
  it('13. Non-destructive guarantee: Diagnostics does NOT mutate records or counts', async () => {
    // Seed initial records
    await testDb.products.add({
      id: 'p_immutable',
      name: 'Lacquer Box',
      category: 'ကုန်ချော',
      defaultPrice: 20000,
      unit: 'လုံး',
      active: true,
      currentStock: 10,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    });
    await testDb.suppliers.add({
      id: 's_immutable',
      code: 'S-IMM',
      name: 'Daw Khin',
      village: 'Village',
      phone: '091234',
      currentAdvanceBalance: 10000,
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    });

    const beforeProdCount = await testDb.products.count();
    const beforeSupCount = await testDb.suppliers.count();
    const beforeProd = await testDb.products.get('p_immutable');

    // Run diagnostics multiple times
    await runDatabaseDiagnostics(testDb);
    await runDatabaseDiagnostics(testDb);

    const afterProdCount = await testDb.products.count();
    const afterSupCount = await testDb.suppliers.count();
    const afterProd = await testDb.products.get('p_immutable');

    expect(afterProdCount).toBe(beforeProdCount);
    expect(afterSupCount).toBe(beforeSupCount);
    expect(afterProd).toEqual(beforeProd);
  });

  // Test 14: Diagnostic export contains no secrets
  it('14. Diagnostic export strictly excludes secrets, PIN hashes, and salts', async () => {
    // Store security settings with hashes
    const settingWithPin: SettingRecord = {
      key: 'app_lock_settings',
      value: {
        pinSalt: 'SECRET_SALT_123456',
        pinHash: 'SECRET_HASH_ABCDEF',
        recoverySalt: 'SECRET_REC_SALT_789',
        recoveryHash: 'SECRET_REC_HASH_XYZ',
        recoveryKey: 'SECRET_RECOVERY_KEY_LEAK',
        passcode: '1234',
        pin: '1234',
      },
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.settings.add(settingWithPin);

    const report = await runDatabaseDiagnostics(testDb);
    const jsonStr = exportDiagnosticReportJSON(report);
    const csvStr = exportDiagnosticReportCSV(report);

    // Verify none of the secret tokens appear anywhere in JSON or CSV
    expect(jsonStr).not.toContain('SECRET_SALT_123456');
    expect(jsonStr).not.toContain('SECRET_HASH_ABCDEF');
    expect(jsonStr).not.toContain('SECRET_REC_SALT_789');
    expect(jsonStr).not.toContain('SECRET_REC_HASH_XYZ');
    expect(jsonStr).not.toContain('SECRET_RECOVERY_KEY_LEAK');
    expect(jsonStr).not.toContain('"passcode": "1234"');

    expect(csvStr).not.toContain('SECRET_SALT_123456');
    expect(csvStr).not.toContain('SECRET_HASH_ABCDEF');
    expect(csvStr).not.toContain('SECRET_RECOVERY_KEY_LEAK');
  });

  // Test 15: Large dataset does not cause obvious O(n²) implementation
  it('15. Large dataset (thousands of records) runs linearly and completes quickly', async () => {
    const products: Product[] = [];
    for (let i = 0; i < 1200; i++) {
      products.push({
        id: `p_bulk_${i}`,
        name: `Product ${i}`,
        category: 'ကုန်ချော',
        defaultPrice: 1000 + i,
        unit: 'ထည်',
        active: true,
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      });
    }
    await testDb.products.bulkAdd(products);

    const suppliers: Supplier[] = [];
    for (let i = 0; i < 500; i++) {
      suppliers.push({
        id: `s_bulk_${i}`,
        code: `SUP-${i}`,
        name: `Supplier ${i}`,
        village: 'Village',
        phone: '091234',
        currentAdvanceBalance: 0,
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      });
    }
    await testDb.suppliers.bulkAdd(suppliers);

    const txs: TransactionRecord[] = [];
    for (let i = 0; i < 1000; i++) {
      txs.push({
        id: `tx_bulk_${i}`,
        voucherNo: `TX-BULK-${i}`,
        supplierId: `s_bulk_${i % 500}`,
        supplierName: `Supplier ${i % 500}`,
        date: '2026-03-01',
        time: '12:00',
        items: [
          {
            productId: `p_bulk_${i % 1200}`,
            productName: `Product ${i % 1200}`,
            quantity: 2,
            unitPrice: 1000,
            subtotal: 2000,
            unit: 'ထည်',
          },
        ],
        totalGoodsValue: 2000,
        previousAdvanceBalance: 0,
        advanceDeducted: 0,
        newAdvanceTaken: 0,
        remainingAdvanceBalance: 0,
        status: 'COMPLETED',
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      });
    }
    await testDb.transactions.bulkAdd(txs);

    const start = performance.now();
    const report = await runDatabaseDiagnostics(testDb);
    const duration = performance.now() - start;

    expect(report.tableCounts.products).toBe(1200);
    expect(report.tableCounts.suppliers).toBe(500);
    expect(report.tableCounts.transactions).toBe(1000);
    expect(report.overallStatus).toBe('HEALTHY');

    // High performance expectation: should finish well under 3000ms even in simulated environment
    expect(duration).toBeLessThan(3000);
  });
});
