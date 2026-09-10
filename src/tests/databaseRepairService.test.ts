import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ShweLetYarDatabase, AttachmentRecord } from '../db/database';
import {
  REPAIR_CAPABILITY_MATRIX,
  getRepairCapability,
  getRepairCapabilityMatrix,
  sanitizeSnapshot,
  createRepairPreview,
  executeAtomicRepair,
  getRepairHistory,
} from '../services/databaseRepairService';
import {
  Product,
  Supplier,
  Merchant,
  TransactionRecord,
  SaleRecord,
  HealthCheckResult,
  RepairAction,
} from '../types';

// Polyfill localStorage
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

describe('Phase 13: Safe Database Repair & Recovery Test Suite', () => {
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

  // Scenario 1: Repair capability matrix correctly defines capabilities for Level A, B, and C
  it('1. Repair capability matrix correctly defines capabilities for Level A, B, and C', () => {
    const matrix = getRepairCapabilityMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(15);

    // Level A
    const unitCap = getRepairCapability('MISSING_PRODUCT_UNIT');
    expect(unitCap.repairAvailable).toBe(true);
    expect(unitCap.safetyLevel).toBe('LEVEL_A');

    // Level B
    const fkCap = getRepairCapability('BROKEN_FOREIGN_KEY');
    expect(fkCap.repairAvailable).toBe(true);
    expect(fkCap.safetyLevel).toBe('LEVEL_B');
    expect(fkCap.requiresUserConfirmation).toBe(true);

    // Level C
    const moneyCap = getRepairCapability('INVALID_MONETARY_VALUE');
    expect(moneyCap.repairAvailable).toBe(false);
    expect(moneyCap.safetyLevel).toBe('LEVEL_C');

    const stockCap = getRepairCapability('NEGATIVE_STOCK_ON_HAND');
    expect(stockCap.repairAvailable).toBe(false);
    expect(stockCap.safetyLevel).toBe('LEVEL_C');
  });

  // Scenario 2: getRepairCapability returns safe fallback for unknown codes
  it('2. getRepairCapability returns safe fallback (Level C, non-repairable) for unknown codes', () => {
    const unknownCap = getRepairCapability('UNKNOWN_CODE_XYZ');
    expect(unknownCap.repairAvailable).toBe(false);
    expect(unknownCap.safetyLevel).toBe('LEVEL_C');
    expect(unknownCap.requiresUserConfirmation).toBe(false);
  });

  // Scenario 3: sanitizeSnapshot scrubs all sensitive auth keys and passwords recursively
  it('3. sanitizeSnapshot strips PINs, salts, hashes, and secrets recursively', () => {
    const rawData = {
      id: 'usr_1',
      name: 'Admin',
      pin: '123456',
      pinSalt: 'somesalt',
      pinHash: 'hash123',
      recoveryKey: 'supersecretkey',
      profile: {
        passcode: '9999',
        normalField: 'hello',
        secret: 'hide_me',
      },
      list: [
        { token: 'tok_abc', safeValue: 42 },
      ],
    };

    const sanitized = sanitizeSnapshot(rawData);
    expect(sanitized.pin).toBeUndefined();
    expect(sanitized.pinSalt).toBeUndefined();
    expect(sanitized.pinHash).toBeUndefined();
    expect(sanitized.recoveryKey).toBeUndefined();
    expect(sanitized.profile.passcode).toBeUndefined();
    expect(sanitized.profile.secret).toBeUndefined();
    expect(sanitized.profile.normalField).toBe('hello');
    expect(sanitized.list[0].token).toBeUndefined();
    expect(sanitized.list[0].safeValue).toBe(42);
    expect(sanitized.name).toBe('Admin');
  });

  // Scenario 4: createRepairPreview is strictly non-mutating (zero database changes)
  it('4. createRepairPreview is strictly non-mutating and does not alter database state', async () => {
    const prod: Product = {
      id: 'prod_1',
      name: 'ယွန်းပန်းကန်',
      category: 'ယွန်းထည်',
      defaultPrice: 10000,
      currentStock: 5,
      minStockAlert: 2,
      unit: '', // Missing unit
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_missing_unit_prod_1',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'ကုန်ပစ္စည်း ယူနစ် မပါရှိခြင်း',
      message: 'Product "ယွန်းပန်းကန်" lacks a unit',
      entity: 'Product',
      recordId: 'prod_1',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    expect(preview.repairType).toBe('RESTORE_MISSING_UNIT');
    expect(preview.targetRecordId).toBe('prod_1');
    expect(preview.proposedAfterSnapshot.unit).toBe('ခု');

    // Verify database was NOT touched
    const fetched = await testDb.products.get('prod_1');
    expect(fetched?.unit).toBe(''); // Still empty!
    const snapshotsCount = await testDb.recoverySnapshots.count();
    expect(snapshotsCount).toBe(0); // No snapshot created during preview
  });

  // Scenario 5: createRepairPreview generates accurate before/after snapshots for broken foreign keys
  it('5. createRepairPreview generates accurate before/after snapshots for broken foreign keys', async () => {
    const sup: Supplier = {
      id: 'sup_valid',
      code: 'SUP-001',
      name: 'ဦးလှ',
      phone: '0912345678',
      village: 'ကျောက်ပန်းတောင်း',
      currentAdvanceBalance: 0,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.suppliers.put(sup);

    const tx: TransactionRecord = {
      id: 'tx_broken',
      voucherNo: 'TX-001',
      type: 'IN',
      supplierId: 'sup_deleted',
      supplierName: 'Unknown',
      date: '2026-03-01',
      time: '10:00',
      items: [],
      totalGoodsValue: 50000,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.transactions.put(tx);

    const issue: HealthCheckResult = {
      id: 'chk_broken_fk_tx_broken',
      category: 'REFERENCES',
      code: 'BROKEN_FOREIGN_KEY',
      severity: 'ERROR',
      title: 'Broken Supplier Ref',
      message: 'Transaction references non-existent supplier sup_deleted',
      entity: 'Transaction',
      recordId: 'tx_broken',
      relatedRecordIds: ['sup_deleted'],
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb, { newTargetId: 'sup_valid' });
    expect(preview.repairType).toBe('REASSIGN_BROKEN_SUPPLIER_REF');
    expect(preview.beforeSnapshot.supplierId).toBe('sup_deleted');
    expect(preview.proposedAfterSnapshot.supplierId).toBe('sup_valid');
    expect(preview.proposedAfterSnapshot.supplierName).toBe('ဦးလှ');
  });

  // Scenario 6: executeAtomicRepair fails if userConfirmed is false
  it('6. executeAtomicRepair fails if userConfirmed is false', async () => {
    const dummyAction: RepairAction = {
      repairId: 'rep_test',
      repairType: 'RESTORE_MISSING_UNIT',
      targetEntity: 'Product',
      targetRecordId: 'prod_test',
      affectedRecordIds: ['prod_test'],
      reason: 'Restore unit',
      diagnosticCode: 'MISSING_PRODUCT_UNIT',
      beforeSnapshot: {},
      proposedAfterSnapshot: {},
      safetyLevel: 'LEVEL_A',
      createdAt: new Date().toISOString(),
      status: 'PREVIEW',
    };

    await expect(executeAtomicRepair(dummyAction, false, testDb)).rejects.toThrow(
      /explicit user confirmation/i
    );
  });

  // Scenario 7: executeAtomicRepair strictly rejects Level C issues
  it('7. executeAtomicRepair strictly rejects Level C issues and prevents execution', async () => {
    const levelCAction: RepairAction = {
      repairId: 'rep_unsafe',
      repairType: 'RESTORE_MISSING_UNIT',
      targetEntity: 'Transaction',
      targetRecordId: 'tx_1',
      affectedRecordIds: ['tx_1'],
      reason: 'Attempted financial repair',
      diagnosticCode: 'INVALID_MONETARY_VALUE',
      beforeSnapshot: {},
      proposedAfterSnapshot: {},
      safetyLevel: 'LEVEL_C',
      createdAt: new Date().toISOString(),
      status: 'PREVIEW',
    };

    await expect(executeAtomicRepair(levelCAction, true, testDb)).rejects.toThrow(
      /Level C Manual Review Required/i
    );
  });

  // Scenario 8: Safety backup is created before mutation
  it('8. Safety backup is created before any database modification during repair', async () => {
    const prod: Product = {
      id: 'prod_backuptest',
      name: 'ကြွေပန်းကန်',
      category: 'ကြွေထည်',
      defaultPrice: 5000,
      currentStock: 10,
      minStockAlert: 2,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_prod_backuptest',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing unit',
      message: 'Unit missing',
      entity: 'Product',
      recordId: 'prod_backuptest',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const result = await executeAtomicRepair(preview, true, testDb);
    expect(result.success).toBe(true);

    // Verify snapshot was created in recoverySnapshots
    const snapshots = await testDb.recoverySnapshots.toArray();
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].reason).toContain('Pre-Repair Snapshot');
  });

  // Scenario 9: Level A repair: missing metadata normalization (MISSING_PRODUCT_UNIT)
  it('9. Level A repair: successfully normalizes missing product unit', async () => {
    const prod: Product = {
      id: 'prod_levela',
      name: 'ယွန်းသေတ္တာ',
      category: 'ယွန်းထည်',
      defaultPrice: 25000,
      currentStock: 2,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_prod_levela',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing Unit',
      message: 'Product missing unit',
      entity: 'Product',
      recordId: 'prod_levela',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const updated = await testDb.products.get('prod_levela');
    expect(updated?.unit).toBe('ခု');
    expect(updated?.updatedAt).not.toBe('2026-03-01T10:00:00Z');
  });

  // Scenario 10: Level A repair: normalizes corrupt backup timestamp in LocalStorage
  it('10. Level A repair: normalizes corrupt backup timestamp in LocalStorage', async () => {
    localStorageMock.setItem('ledger_last_backup_v2', 'invalid-date-not-a-timestamp');

    const issue: HealthCheckResult = {
      id: 'chk_backup_meta',
      category: 'BACKUP',
      code: 'INVALID_BACKUP_METADATA',
      severity: 'WARN',
      title: 'Corrupt Backup Metadata',
      message: 'Invalid last backup timestamp',
      entity: 'BackupMetadata',
      recordId: 'ledger_last_backup_v2',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);
    expect(localStorageMock.getItem('ledger_last_backup_v2')).toBeNull();
  });

  // Scenario 11: Level B repair: Broken foreign key reassignment to valid supplier
  it('11. Level B repair: reassigns broken foreign key supplier in Transaction', async () => {
    const sup: Supplier = {
      id: 'sup_real',
      code: 'SUP-002',
      name: 'ဒေါ်မြ',
      phone: '0987654321',
      village: 'တောင်တွင်းကြီး',
      currentAdvanceBalance: 0,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.suppliers.put(sup);

    const tx: TransactionRecord = {
      id: 'tx_broken_sup',
      voucherNo: 'TX-SUP-01',
      type: 'IN',
      supplierId: 'non_existent_sup',
      supplierName: 'Old Ghost',
      date: '2026-03-01',
      time: '10:00',
      items: [],
      totalGoodsValue: 30000,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.transactions.put(tx);

    const issue: HealthCheckResult = {
      id: 'chk_tx_broken_sup',
      category: 'REFERENCES',
      code: 'BROKEN_FOREIGN_KEY',
      severity: 'ERROR',
      title: 'Broken Supplier Ref',
      message: 'Transaction points to non-existent supplier non_existent_sup',
      entity: 'Transaction',
      recordId: 'tx_broken_sup',
      relatedRecordIds: ['non_existent_sup'],
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb, { newTargetId: 'sup_real' });
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const updatedTx = await testDb.transactions.get('tx_broken_sup');
    expect(updatedTx?.supplierId).toBe('sup_real');
    expect(updatedTx?.supplierName).toBe('ဒေါ်မြ');
  });

  // Scenario 12: Level B repair: Broken foreign key reassignment to valid merchant in Sale
  it('12. Level B repair: reassigns broken foreign key merchant in Sale record', async () => {
    const merch: Merchant = {
      id: 'merch_real',
      code: 'M-002',
      name: 'ကိုအောင်',
      role: 'BUYER',
      phone: '091234567',
      town: 'ရန်ကုန်',
      address: 'ရန်ကုန်',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.merchants.put(merch);

    const sale: SaleRecord = {
      id: 'sale_broken_merch',
      voucherNo: 'SALE-01',
      date: '2026-03-01',
      time: '10:00',
      merchantId: 'ghost_merchant',
      merchantName: 'Ghost Merchant',
      merchantTown: 'ရန်ကုန်',
      items: [],
      totalItemsCount: 0,
      grandTotal: 40000,
      cashPaidByMerchant: 40000,
      remainingReceivableBalance: 0,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.sales.put(sale);

    const issue: HealthCheckResult = {
      id: 'chk_sale_merch',
      category: 'REFERENCES',
      code: 'BROKEN_FOREIGN_KEY',
      severity: 'ERROR',
      title: 'Broken Merchant Ref',
      message: 'Sale points to non-existent merchant ghost_merchant',
      entity: 'Sale',
      recordId: 'sale_broken_merch',
      relatedRecordIds: ['ghost_merchant'],
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb, { newTargetId: 'merch_real' });
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const updatedSale = await testDb.sales.get('sale_broken_merch');
    expect(updatedSale?.merchantId).toBe('merch_real');
    expect(updatedSale?.merchantName).toBe('ကိုအောင်');
  });

  // Scenario 13: Level B repair: Broken product reference in Transaction items
  it('13. Level B repair: reassigns broken product reference in Transaction items', async () => {
    const validProd: Product = {
      id: 'prod_valid_123',
      name: 'ယွန်းခွက်',
      category: 'ယွန်းထည်',
      defaultPrice: 8000,
      currentStock: 20,
      minStockAlert: 5,
      unit: 'ခု',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(validProd);

    const tx: TransactionRecord = {
      id: 'tx_broken_item_prod',
      voucherNo: 'TX-ITEM-01',
      type: 'IN',
      supplierId: 'sup_temp',
      supplierName: 'Supplier Temp',
      date: '2026-03-01',
      time: '10:00',
      totalGoodsValue: 16000,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      items: [
        {
          productId: 'deleted_prod_999',
          productName: 'Old Product',
          quantity: 2,
          unitPrice: 8000,
          subtotal: 16000,
          unit: 'ခု',
        },
      ],
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.transactions.put(tx);

    const issue: HealthCheckResult = {
      id: 'chk_item_prod',
      category: 'REFERENCES',
      code: 'BROKEN_PRODUCT_REF',
      severity: 'ERROR',
      title: 'Broken Product Reference',
      message: 'Transaction contains non-existent product deleted_prod_999',
      entity: 'Transaction',
      recordId: 'tx_broken_item_prod',
      relatedRecordIds: ['deleted_prod_999'],
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb, { newTargetId: 'prod_valid_123' });
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const updatedTx = await testDb.transactions.get('tx_broken_item_prod');
    expect(updatedTx?.items?.[0].productId).toBe('prod_valid_123');
    expect(updatedTx?.items?.[0].productName).toBe('ယွန်းခွက်');
  });

  // Scenario 14: Level B repair: Orphan attachment safe deletion
  it('14. Level B repair: safely removes orphan attachment when linked voucher does not exist', async () => {
    const att: AttachmentRecord = {
      id: 'att_orphan_1',
      voucherId: 'ghost_voucher_404',
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      createdAt: '2026-03-01T10:00:00Z',
    };
    await testDb.attachments.put(att);

    const issue: HealthCheckResult = {
      id: 'chk_orphan_att',
      category: 'ATTACHMENTS',
      code: 'ORPHAN_ATTACHMENT',
      severity: 'WARN',
      title: 'Orphan Attachment',
      message: 'Attachment att_orphan_1 references non-existent voucher ghost_voucher_404',
      entity: 'Attachment',
      recordId: 'att_orphan_1',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb, { actionType: 'DELETE' });
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const exists = await testDb.attachments.get('att_orphan_1');
    expect(exists).toBeUndefined();
  });

  // Scenario 15: Level B repair: Normalizes invalid merchant enum value
  it('15. Level B repair: normalizes invalid merchant role enum value to valid role', async () => {
    const merch: any = {
      id: 'merch_bad_role',
      code: 'M-BAD',
      name: 'မသီတာ',
      role: 'INVALID_ROLE_XYZ',
      phone: '0911223344',
      town: 'မန္တလေး',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.merchants.put(merch);

    const issue: HealthCheckResult = {
      id: 'chk_bad_role',
      category: 'DATA_INTEGRITY',
      code: 'INVALID_ENUM_VALUE',
      severity: 'WARN',
      title: 'Invalid Enum Value',
      message: 'Merchant has invalid role',
      entity: 'Merchant',
      recordId: 'merch_bad_role',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const updated = await testDb.merchants.get('merch_bad_role');
    expect(updated?.role).toBe('BUYER');
  });

  // Scenario 16: Level C Protection: Explicitly throws when trying to repair FINANCIAL_DISCREPANCY
  it('16. Level C Protection: Explicitly throws and refuses to repair financial discrepancies', async () => {
    const financialIssue: HealthCheckResult = {
      id: 'chk_fin_disc',
      category: 'FINANCIAL',
      code: 'TOTAL_MISMATCH',
      severity: 'CRITICAL',
      title: 'Total Mismatch',
      message: 'Calculated items total does not match voucher total',
      entity: 'Transaction',
      recordId: 'tx_fin_err',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(financialIssue, testDb);
    expect(preview.safetyLevel).toBe('LEVEL_C');
    expect(preview.status).toBe('REJECTED');

    await expect(executeAtomicRepair(preview, true, testDb)).rejects.toThrow(
      /Level C Manual Review Required/i
    );
  });

  // Scenario 17: Level C Protection: Explicitly throws and refuses to repair STOCK_DISCREPANCY
  it('17. Level C Protection: Explicitly throws and refuses to repair stock discrepancies', async () => {
    const stockIssue: HealthCheckResult = {
      id: 'chk_stock_disc',
      category: 'STOCK',
      code: 'STOCK_DISCREPANCY',
      severity: 'CRITICAL',
      title: 'Stock Discrepancy',
      message: 'Product stockOnHand does not match ledger movements',
      entity: 'Product',
      recordId: 'prod_stock_err',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(stockIssue, testDb);
    expect(preview.safetyLevel).toBe('LEVEL_C');
    expect(preview.status).toBe('REJECTED');

    await expect(executeAtomicRepair(preview, true, testDb)).rejects.toThrow(
      /Level C Manual Review Required/i
    );
  });

  // Scenario 18: Atomic rollback on mid-transaction failure
  it('18. Atomic rollback on transaction error leaves database completely unchanged', async () => {
    const prod: Product = {
      id: 'prod_atomic',
      name: 'ယွန်းဗန်း',
      category: 'ယွန်းထည်',
      defaultPrice: 12000,
      currentStock: 3,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    // Provide an invalid target record id in repair action
    const brokenAction: RepairAction = {
      repairId: 'rep_fail',
      repairType: 'RESTORE_MISSING_UNIT',
      targetEntity: 'Product',
      targetRecordId: 'non_existent_product_id',
      affectedRecordIds: ['non_existent_product_id'],
      reason: 'Should fail',
      diagnosticCode: 'MISSING_PRODUCT_UNIT',
      beforeSnapshot: {},
      proposedAfterSnapshot: {},
      safetyLevel: 'LEVEL_A',
      createdAt: new Date().toISOString(),
      status: 'PREVIEW',
    };

    await expect(executeAtomicRepair(brokenAction, true, testDb)).rejects.toThrow();

    // Verify existing product was completely untouched
    const fetched = await testDb.products.get('prod_atomic');
    expect(fetched?.unit).toBe('');
    expect(fetched?.updatedAt).toBe('2026-03-01T10:00:00Z');
  });

  // Scenario 19: Audit trail & history logging and retrieval
  it('19. Audit trail creates sanitized logs with backup snapshot ID and getRepairHistory returns logs chronologically', async () => {
    const prod: Product = {
      id: 'prod_audit',
      name: 'ယွန်းဆွမ်းအုပ်',
      category: 'ယွန်းထည်',
      defaultPrice: 45000,
      currentStock: 1,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_prod_audit',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing Unit',
      message: 'Product missing unit',
      entity: 'Product',
      recordId: 'prod_audit',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const history = await getRepairHistory(testDb);
    expect(history.length).toBeGreaterThanOrEqual(1);

    const latest = history[0];
    expect(latest.action).toBe('DATABASE_REPAIR');
    expect(latest.entityType).toBe('Product');
    expect(latest.entityId).toBe('prod_audit');

    const details = JSON.parse(latest.details);
    expect(details.repairType).toBe('RESTORE_MISSING_UNIT');
    expect(details.result).toBe('SUCCESS');
    expect(details.backupId).toBeDefined();
    expect(details.beforeSummary).toBeDefined();
    expect(details.afterSummary).toBeDefined();

    // Ensure no secrets leaked
    expect(JSON.stringify(details)).not.toContain('pinHash');
    expect(JSON.stringify(details)).not.toContain('pinSalt');
  });
});
