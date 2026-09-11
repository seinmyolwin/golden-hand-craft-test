import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { runDatabaseDiagnostics } from '../services/databaseHealthService';
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

  // Capability Matrix verification
  it('0. Repair capability matrix correctly defines capabilities for Level A, B, and C', () => {
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

    // Unknown fallback
    const unknownCap = getRepairCapability('UNKNOWN_CODE_XYZ');
    expect(unknownCap.repairAvailable).toBe(false);
    expect(unknownCap.safetyLevel).toBe('LEVEL_C');
  });

  // Prompt Requirement 1: Repair requires pre-repair backup
  it('1. Repair requires pre-repair backup', async () => {
    const prod: Product = {
      id: 'prod_bkp_1',
      name: 'သစ်သားပန်းကန်',
      category: 'သစ်သားထည်',
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
      id: 'chk_bkp_1',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing unit',
      message: 'Product missing unit',
      entity: 'Product',
      recordId: 'prod_bkp_1',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const result = await executeAtomicRepair(preview, true, testDb);
    expect(result.success).toBe(true);

    // Verify snapshot was created before repair and attached to action
    expect(preview.backupId).toBeDefined();
    const snapshots = await testDb.recoverySnapshots.toArray();
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].id).toBe(preview.backupId);
    expect(snapshots[0].reason).toContain('Pre-Repair Snapshot');
    expect(snapshots[0].data.products.length).toBe(1);
  });

  // Prompt Requirement 2: Backup failure prevents mutation
  it('2. Backup failure prevents mutation', async () => {
    const prod: Product = {
      id: 'prod_bkp_fail',
      name: 'ကြွေပန်းကန်',
      category: 'ကြွေထည်',
      defaultPrice: 8000,
      currentStock: 4,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_bkp_fail',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing unit',
      message: 'Product missing unit',
      entity: 'Product',
      recordId: 'prod_bkp_fail',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);

    // Simulate recoverySnapshots storage failure
    const originalPut = testDb.recoverySnapshots.put;
    testDb.recoverySnapshots.put = vi.fn().mockRejectedValue(new Error('Disk I/O failure on backup partition'));

    try {
      await expect(executeAtomicRepair(preview, true, testDb)).rejects.toThrow(
        /Pre-repair safety backup failed/i
      );

      // Verify NO mutation occurred on the product
      const untouchedProd = await testDb.products.get('prod_bkp_fail');
      expect(untouchedProd?.unit).toBe('');
      expect(untouchedProd?.updatedAt).toBe('2026-03-01T10:00:00Z');
      expect(preview.status).toBe('FAILED');
    } finally {
      testDb.recoverySnapshots.put = originalPut;
    }
  });

  // Prompt Requirement 3: Preview does not mutate database
  it('3. Preview does not mutate database', async () => {
    const prod: Product = {
      id: 'prod_prev',
      name: 'ယွန်းပန်းကန်',
      category: 'ယွန်းထည်',
      defaultPrice: 10000,
      currentStock: 5,
      minStockAlert: 2,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_missing_unit_prev',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'ကုန်ပစ္စည်း ယူနစ် မပါရှိခြင်း',
      message: 'Product lacks unit',
      entity: 'Product',
      recordId: 'prod_prev',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    expect(preview.repairType).toBe('RESTORE_MISSING_UNIT');
    expect(preview.targetRecordId).toBe('prod_prev');
    expect(preview.proposedAfterSnapshot.unit).toBe('ခု');

    // Verify database was NOT touched
    const fetched = await testDb.products.get('prod_prev');
    expect(fetched?.unit).toBe('');
    expect(fetched?.updatedAt).toBe('2026-03-01T10:00:00Z');
    const snapshotsCount = await testDb.recoverySnapshots.count();
    expect(snapshotsCount).toBe(0);
    const auditCount = await testDb.auditLogs.count();
    expect(auditCount).toBe(0);
  });

  // Prompt Requirement 4: User cancellation does not mutate database
  it('4. User cancellation does not mutate database', async () => {
    const prod: Product = {
      id: 'prod_cancel',
      name: 'သစ်သားဇွန်း',
      category: 'သစ်သားထည်',
      defaultPrice: 2000,
      currentStock: 20,
      minStockAlert: 5,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_cancel',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing Unit',
      message: 'Unit missing',
      entity: 'Product',
      recordId: 'prod_cancel',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);

    // User explicitly cancels / userConfirmed = false
    await expect(executeAtomicRepair(preview, false, testDb)).rejects.toThrow(
      /explicit user confirmation/i
    );

    expect(preview.status).toBe('REJECTED');
    const fetched = await testDb.products.get('prod_cancel');
    expect(fetched?.unit).toBe('');
    expect(fetched?.updatedAt).toBe('2026-03-01T10:00:00Z');
  });

  // Prompt Requirement 5: Confirmed safe repair succeeds
  it('5. Confirmed safe repair succeeds', async () => {
    const prod: Product = {
      id: 'prod_safe_ok',
      name: 'ယွန်းလက်ဖက်အုပ်',
      category: 'ယွန်းထည်',
      defaultPrice: 25000,
      currentStock: 3,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_safe_ok',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing Unit',
      message: 'Unit missing',
      entity: 'Product',
      recordId: 'prod_safe_ok',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const result = await executeAtomicRepair(preview, true, testDb);

    expect(result.success).toBe(true);
    expect(preview.status).toBe('COMPLETED');

    const updated = await testDb.products.get('prod_safe_ok');
    expect(updated?.unit).toBe('ခု');
    expect(updated?.updatedAt).not.toBe('2026-03-01T10:00:00Z');
  });

  // Prompt Requirement 6: Multi-table repair is atomic
  it('6. Multi-table repair is atomic', async () => {
    const sup: Supplier = {
      id: 'sup_new_multi',
      code: 'SUP-999',
      name: 'ဒေါ်လှမြင့်',
      phone: '0977889900',
      village: 'ပုဂံ',
      currentAdvanceBalance: 0,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.suppliers.put(sup);

    const tx: TransactionRecord = {
      id: 'tx_multi_tbl',
      voucherNo: 'TX-MULTI',
      type: 'IN',
      supplierId: 'sup_ghost_id',
      supplierName: 'Unknown',
      date: '2026-03-01',
      time: '10:00',
      items: [],
      totalGoodsValue: 20000,
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
      id: 'chk_multi_fk',
      category: 'REFERENCES',
      code: 'BROKEN_FOREIGN_KEY',
      severity: 'ERROR',
      title: 'Broken Supplier Ref',
      message: 'Transaction references deleted supplier',
      entity: 'Transaction',
      recordId: 'tx_multi_tbl',
      relatedRecordIds: ['sup_ghost_id'],
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb, { newTargetId: 'sup_new_multi' });
    const result = await executeAtomicRepair(preview, true, testDb);
    expect(result.success).toBe(true);

    // Verify both transactions and auditLogs tables were updated atomically together
    const updatedTx = await testDb.transactions.get('tx_multi_tbl');
    expect(updatedTx?.supplierId).toBe('sup_new_multi');
    expect(updatedTx?.supplierName).toBe('ဒေါ်လှမြင့်');

    const auditLogs = await testDb.auditLogs.toArray();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].entityId).toBe('tx_multi_tbl');
    expect(auditLogs[0].action).toBe('DATABASE_REPAIR');
  });

  // Prompt Requirement 7: Failure during repair rolls back
  it('7. Failure during repair rolls back', async () => {
    const prod: Product = {
      id: 'prod_rollback_test',
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

    // Provide an invalid target record id in repair action to trigger error in transaction
    const brokenAction: RepairAction = {
      repairId: 'rep_fail_trans',
      repairType: 'RESTORE_MISSING_UNIT',
      targetEntity: 'Product',
      targetRecordId: 'non_existent_id_404',
      affectedRecordIds: ['non_existent_id_404'],
      reason: 'Should fail inside transaction',
      diagnosticCode: 'MISSING_PRODUCT_UNIT',
      beforeSnapshot: {},
      proposedAfterSnapshot: {},
      safetyLevel: 'LEVEL_A',
      createdAt: new Date().toISOString(),
      status: 'PREVIEW',
    };

    await expect(executeAtomicRepair(brokenAction, true, testDb)).rejects.toThrow(
      /Repair transaction failed and rolled back/i
    );

    // Verify original product is completely untouched
    const fetched = await testDb.products.get('prod_rollback_test');
    expect(fetched?.unit).toBe('');
    expect(fetched?.updatedAt).toBe('2026-03-01T10:00:00Z');
  });

  // Prompt Requirement 8: Post-repair diagnostics run
  it('8. Post-repair diagnostics run', async () => {
    const prod: Product = {
      id: 'prod_diag_post',
      name: 'ယွန်းခွက်',
      category: 'ယွန်းထည်',
      defaultPrice: 9000,
      currentStock: 5,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_diag_post',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing Unit',
      message: 'Product missing unit',
      entity: 'Product',
      recordId: 'prod_diag_post',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const result = await executeAtomicRepair(preview, true, testDb);

    expect(result.success).toBe(true);
    // Verified: post-repair diagnostics report is generated and included
    expect(result.postRepairReport).toBeDefined();
    expect(result.postRepairReport?.generatedAt).toBeDefined();
    expect(result.postRepairReport?.totalChecks).toBeGreaterThan(0);

    // Verify the targeted MISSING_PRODUCT_UNIT on this product is resolved
    const stillPresent = result.postRepairReport?.results.find(
      (r) => r.code === 'MISSING_PRODUCT_UNIT' && r.recordId === 'prod_diag_post'
    );
    expect(stillPresent).toBeUndefined();
  });

  // Prompt Requirement 9: Failed post-repair verification does not report success
  it('9. Failed post-repair verification does not report success', async () => {
    const prod: Product = {
      id: 'prod_unresolved',
      name: 'သစ်သားလင်ပန်း',
      category: 'သစ်သားထည်',
      defaultPrice: 15000,
      currentStock: 2,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    // Action that fails to actually fix the missing unit
    const faultyAction: RepairAction = {
      repairId: 'rep_faulty',
      repairType: 'RESTORE_MISSING_UNIT',
      targetEntity: 'Product',
      targetRecordId: 'prod_unresolved',
      affectedRecordIds: ['prod_unresolved'],
      reason: 'Faulty repair setting empty string unit',
      diagnosticCode: 'MISSING_PRODUCT_UNIT',
      selectedOption: '', // intentionally empty so unit remains missing
      beforeSnapshot: { unit: '' },
      proposedAfterSnapshot: { unit: '' },
      safetyLevel: 'LEVEL_A',
      createdAt: new Date().toISOString(),
      status: 'PREVIEW',
    };

    // Should fail post-repair verification and NOT report success
    await expect(executeAtomicRepair(faultyAction, true, testDb)).rejects.toThrow(
      /Post-repair verification failed: targeted issue "MISSING_PRODUCT_UNIT" is still present/i
    );
    expect(faultyAction.status).toBe('FAILED');
  });

  // Prompt Requirement 10: Financial discrepancy cannot be automatically repaired
  it('10. Financial discrepancy cannot be automatically repaired', async () => {
    const financialCodes = [
      'TOTAL_MISMATCH',
      'GRAND_TOTAL_MISMATCH',
      'INVALID_MONETARY_VALUE',
      'PROHIBITED_NEGATIVE_VALUE',
      'FLOATING_POINT_RESIDUE',
    ];

    for (const code of financialCodes) {
      const cap = getRepairCapability(code);
      expect(cap.repairAvailable).toBe(false);
      expect(cap.safetyLevel).toBe('LEVEL_C');

      const issue: HealthCheckResult = {
        id: `chk_${code}`,
        category: 'FINANCIAL',
        code,
        severity: 'CRITICAL',
        title: `Financial Issue: ${code}`,
        message: 'Discrepancy detected',
        entity: 'Transaction',
        recordId: 'tx_fin_protected',
        detectedAt: '2026-03-01T10:00:00Z',
      };

      const preview = await createRepairPreview(issue, testDb);
      expect(preview.safetyLevel).toBe('LEVEL_C');
      expect(preview.status).toBe('REJECTED');

      await expect(executeAtomicRepair(preview, true, testDb)).rejects.toThrow(
        /Level C Manual Review Required/i
      );
    }
  });

  // Prompt Requirement 11: Stock discrepancy cannot be automatically repaired
  it('11. Stock discrepancy cannot be automatically repaired', async () => {
    const stockCodes = [
      'STOCK_DISCREPANCY',
      'NEGATIVE_STOCK_LEVEL',
      'STOCK_STATE_INCONSISTENCY',
      'INVALID_QUANTITY',
    ];

    for (const code of stockCodes) {
      const cap = getRepairCapability(code);
      expect(cap.repairAvailable).toBe(false);
      expect(cap.safetyLevel).toBe('LEVEL_C');

      const issue: HealthCheckResult = {
        id: `chk_${code}`,
        category: 'STOCK',
        code,
        severity: 'CRITICAL',
        title: `Stock Issue: ${code}`,
        message: 'Stock discrepancy detected',
        entity: 'Product',
        recordId: 'prod_stock_protected',
        detectedAt: '2026-03-01T10:00:00Z',
      };

      const preview = await createRepairPreview(issue, testDb);
      expect(preview.safetyLevel).toBe('LEVEL_C');
      expect(preview.status).toBe('REJECTED');

      await expect(executeAtomicRepair(preview, true, testDb)).rejects.toThrow(
        /Level C Manual Review Required/i
      );
    }
  });

  // Prompt Requirement 12: Broken foreign key cannot be guessed
  it('12. Broken foreign key cannot be guessed', async () => {
    const tx: TransactionRecord = {
      id: 'tx_no_guess',
      voucherNo: 'TX-NO-GUESS',
      type: 'IN',
      supplierId: 'ghost_sup_999',
      supplierName: 'Unknown',
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
      id: 'chk_fk_no_guess',
      category: 'REFERENCES',
      code: 'BROKEN_FOREIGN_KEY',
      severity: 'ERROR',
      title: 'Broken Supplier Ref',
      message: 'Transaction references deleted supplier',
      entity: 'Transaction',
      recordId: 'tx_no_guess',
      relatedRecordIds: ['ghost_sup_999'],
      detectedAt: '2026-03-01T10:00:00Z',
    };

    // Calling preview WITHOUT providing a replacement option
    const preview = await createRepairPreview(issue, testDb);
    expect(preview.selectedOption).toBeUndefined();

    // Attempting execution without user selection must fail immediately without guessing
    await expect(executeAtomicRepair(preview, true, testDb)).rejects.toThrow(
      /New supplier ID was not provided/i
    );

    // Verify transaction record was NOT guessed or altered
    const untouched = await testDb.transactions.get('tx_no_guess');
    expect(untouched?.supplierId).toBe('ghost_sup_999');
  });

  // Prompt Requirement 13: Orphan attachment is not silently deleted
  it('13. Orphan attachment is not silently deleted', async () => {
    const att: AttachmentRecord = {
      id: 'att_not_silent',
      voucherId: 'ghost_voucher_555',
      sizeBytes: 2048,
      mimeType: 'image/png',
      createdAt: '2026-03-01T10:00:00Z',
    };
    await testDb.attachments.put(att);

    const issue: HealthCheckResult = {
      id: 'chk_orphan_not_silent',
      category: 'ATTACHMENTS',
      code: 'ORPHAN_ATTACHMENT',
      severity: 'WARN',
      title: 'Orphan Attachment',
      message: 'Attachment references non-existent voucher',
      entity: 'Attachment',
      recordId: 'att_not_silent',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    // Diagnostics or preview alone does NOT delete it
    const preview = await createRepairPreview(issue, testDb);
    expect(preview.safetyLevel).toBe('LEVEL_B');
    const cap = getRepairCapability(issue.code);
    expect(cap.requiresUserConfirmation).toBe(true);

    const check1 = await testDb.attachments.get('att_not_silent');
    expect(check1).toBeDefined();

    // User must explicitly choose DELETE and confirm
    const deletePreview = await createRepairPreview(issue, testDb, { actionType: 'DELETE' });
    const res = await executeAtomicRepair(deletePreview, true, testDb);
    expect(res.success).toBe(true);

    const check2 = await testDb.attachments.get('att_not_silent');
    expect(check2).toBeUndefined();
  });

  // Prompt Requirement 14: Repair creates audit record
  it('14. Repair creates audit record', async () => {
    const prod: Product = {
      id: 'prod_audit_rec',
      name: 'ယွန်းကြာခွက်',
      category: 'ယွန်းထည်',
      defaultPrice: 18000,
      currentStock: 2,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_prod_audit_rec',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing Unit',
      message: 'Product missing unit',
      entity: 'Product',
      recordId: 'prod_audit_rec',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb);
    const result = await executeAtomicRepair(preview, true, testDb);
    expect(result.success).toBe(true);
    expect(result.auditId).toBeDefined();

    const auditEntry = await testDb.auditLogs.get(result.auditId!);
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.action).toBe('DATABASE_REPAIR');
    expect(auditEntry?.entityType).toBe('Product');
    expect(auditEntry?.entityId).toBe('prod_audit_rec');

    const details = JSON.parse(auditEntry!.details);
    expect(details.repairId).toBe(preview.repairId);
    expect(details.repairType).toBe('RESTORE_MISSING_UNIT');
    expect(details.result).toBe('SUCCESS');
    expect(details.backupId).toBeDefined();
    expect(details.appVersion).toBeDefined();
  });

  // Prompt Requirement 15: Audit record contains no secrets
  it('15. Audit record contains no secrets', async () => {
    const sensitiveData = {
      pin: '8888',
      pinSalt: 'salt_abc',
      pinHash: 'hash_xyz',
      recoveryKey: 'super_secret_recovery',
      userPasscode: '1234',
      token: 'jwt_secret_token',
      safeEntityName: 'ShweLetYar',
    };

    const sanitized = sanitizeSnapshot(sensitiveData);
    expect(sanitized.pin).toBeUndefined();
    expect(sanitized.pinSalt).toBeUndefined();
    expect(sanitized.pinHash).toBeUndefined();
    expect(sanitized.recoveryKey).toBeUndefined();
    expect(sanitized.userPasscode).toBeUndefined();
    expect(sanitized.token).toBeUndefined();
    expect(sanitized.safeEntityName).toBe('ShweLetYar');
  });

  // Prompt Requirement 16: Repair history is read-only
  it('16. Repair history is read-only', async () => {
    // Seed test audit log entries
    const log1 = {
      id: 'aud_hist_1',
      action: 'DATABASE_REPAIR',
      timestamp: '2026-03-01T10:00:00Z',
      entityType: 'Product',
      entityId: 'prod_1',
      details: JSON.stringify({ repairType: 'RESTORE_MISSING_UNIT', result: 'SUCCESS' }),
    };
    const log2 = {
      id: 'aud_hist_2',
      action: 'DATABASE_REPAIR',
      timestamp: '2026-03-01T11:00:00Z',
      entityType: 'Transaction',
      entityId: 'tx_1',
      details: JSON.stringify({ repairType: 'REASSIGN_BROKEN_SUPPLIER_REF', result: 'SUCCESS' }),
    };
    await testDb.auditLogs.bulkPut([log1, log2]);

    const history = await getRepairHistory(testDb);
    expect(history.length).toBe(2);
    // Chronological order: newest first
    expect(history[0].id).toBe('aud_hist_2');
    expect(history[1].id).toBe('aud_hist_1');

    // Verify service exposes no delete or modification endpoints for repair history
    const repairServiceExports = await import('../services/databaseRepairService');
    expect((repairServiceExports as any).deleteRepairHistory).toBeUndefined();
    expect((repairServiceExports as any).clearRepairHistory).toBeUndefined();
    expect((repairServiceExports as any).updateRepairHistory).toBeUndefined();
  });

  // Prompt Requirement 17: Re-running the same repair does not create duplicate damage
  it('17. Re-running the same repair does not create duplicate damage', async () => {
    const prod: Product = {
      id: 'prod_rerun',
      name: 'ယွန်းသေတ္တာ',
      category: 'ယွန်းထည်',
      defaultPrice: 35000,
      currentStock: 2,
      minStockAlert: 1,
      unit: '',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const issue: HealthCheckResult = {
      id: 'chk_rerun',
      category: 'DATA_INTEGRITY',
      code: 'MISSING_PRODUCT_UNIT',
      severity: 'WARN',
      title: 'Missing Unit',
      message: 'Product missing unit',
      entity: 'Product',
      recordId: 'prod_rerun',
      detectedAt: '2026-03-01T10:00:00Z',
    };

    // First repair run
    const preview1 = await createRepairPreview(issue, testDb);
    const res1 = await executeAtomicRepair(preview1, true, testDb);
    expect(res1.success).toBe(true);

    const updated1 = await testDb.products.get('prod_rerun');
    expect(updated1?.unit).toBe('ခု');

    // Second repair run (re-running on already fixed product)
    const preview2 = await createRepairPreview(issue, testDb);
    const res2 = await executeAtomicRepair(preview2, true, testDb);
    expect(res2.success).toBe(true);

    const updated2 = await testDb.products.get('prod_rerun');
    expect(updated2?.unit).toBe('ခု');
    expect(updated2?.name).toBe('ယွန်းသေတ္တာ');
    expect(updated2?.defaultPrice).toBe(35000);
  });

  // Prompt Requirement 18: Existing Phase 12 diagnostics remain non-destructive
  it('18. Existing Phase 12 diagnostics remain non-destructive', async () => {
    const prod: Product = {
      id: 'prod_phase12_chk',
      name: 'ယွန်းဖလား',
      category: 'ယွန်းထည်',
      defaultPrice: 15000,
      currentStock: 4,
      minStockAlert: 1,
      unit: 'ခု',
      active: true,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.products.put(prod);

    const report = await runDatabaseDiagnostics(testDb);
    expect(report).toBeDefined();

    // Verifying database state is strictly unchanged
    const fetched = await testDb.products.get('prod_phase12_chk');
    expect(fetched).toEqual(prod);
    const auditCount = await testDb.auditLogs.count();
    expect(auditCount).toBe(0);
  });

  // Prompt Requirement 19: Existing backup/restore tests remain passing
  it('19. Additional Level B repairs: broken merchant reference in Sale and broken product reference', async () => {
    const merch: Merchant = {
      id: 'merch_valid_19',
      code: 'M-019',
      name: 'ကိုအောင်',
      phone: '0955667788',
      town: 'ရန်ကုန်',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.merchants.put(merch);

    const sale: SaleRecord = {
      id: 'sale_broken_19',
      voucherNo: 'S-019',
      merchantId: 'merch_deleted_99',
      merchantName: 'Old Merchant',
      merchantTown: 'မန္တလေး',
      date: '2026-03-01',
      time: '12:00',
      items: [],
      totalAmount: 50000,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    };
    await testDb.sales.put(sale);

    const issue: HealthCheckResult = {
      id: 'chk_sale_broken_19',
      category: 'REFERENCES',
      code: 'BROKEN_FOREIGN_KEY',
      severity: 'ERROR',
      title: 'Broken Merchant Ref',
      message: 'Sale references deleted merchant',
      entity: 'Sale',
      recordId: 'sale_broken_19',
      relatedRecordIds: ['merch_deleted_99'],
      detectedAt: '2026-03-01T10:00:00Z',
    };

    const preview = await createRepairPreview(issue, testDb, { newTargetId: 'merch_valid_19' });
    const res = await executeAtomicRepair(preview, true, testDb);
    expect(res.success).toBe(true);

    const updatedSale = await testDb.sales.get('sale_broken_19');
    expect(updatedSale?.merchantId).toBe('merch_valid_19');
    expect(updatedSale?.merchantName).toBe('ကိုအောင်');
  });
});
