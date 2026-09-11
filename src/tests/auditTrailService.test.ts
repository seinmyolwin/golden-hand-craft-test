import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// Polyfill localStorage
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
  recordAuditEvent,
  getAuditTrail,
  getAuditHistoryForVoucher,
  buildAuditLogEntry,
  mapActionToActionType,
} from '../services/auditTrailService';
import { runDatabaseDiagnostics } from '../services/databaseHealthService';
import {
  createCompleteBackup,
  validateBackupFile,
  executeSafeRestore,
} from '../services/backupService';

describe('Phase 17 - Canonical Audit Trail & Traceability Engine', () => {
  beforeEach(async () => {
    await db.auditLogs.clear();
    await db.sales.clear();
    await db.stockMovements.clear();
    await db.cashMovements.clear();
  });

  it('correctly maps raw actions to standard AuditActionType', () => {
    expect(mapActionToActionType('အရောင်း စာရင်းသွင်းမှု')).toBe('SALE');
    expect(mapActionToActionType('အဝယ် စာရင်းသွင်းမှု')).toBe('PURCHASE');
    expect(mapActionToActionType('Stock Movement Out')).toBe('STOCK_MOVEMENT');
    expect(mapActionToActionType('Cash Inflow Ledger')).toBe('CASH_MOVEMENT');
    expect(mapActionToActionType('Customer Return')).toBe('RETURN');
    expect(mapActionToActionType('Cash Refund')).toBe('REFUND');
    expect(mapActionToActionType('Voucher Reversal')).toBe('REVERSAL');
    expect(mapActionToActionType('Daily Closing')).toBe('DAILY_CLOSING');
    expect(mapActionToActionType('Database Repair')).toBe('DATABASE_REPAIR');
  });

  it('creates immutable audit records with accurate default structures', async () => {
    const entry = await recordAuditEvent({
      action: 'အရောင်း စာရင်းသွင်းမှု',
      referenceType: 'SALE',
      referenceId: 'sale-101',
      referenceVoucherNo: 'SAL-20260910-001',
      amount: 150000,
      quantity: 5,
      details: 'Merchant Kyaw Kyaw 5 units sold',
    });

    expect(entry.id).toBeDefined();
    expect(entry.actionType).toBe('SALE');
    expect(entry.amount).toBe(150000);
    expect(entry.quantity).toBe(5);

    const stored = await db.auditLogs.get(entry.id);
    expect(stored).toBeDefined();
    expect(stored?.referenceVoucherNo).toBe('SAL-20260910-001');
  });

  it('supports transactional database context passing for atomic operations', async () => {
    await db.transaction('rw', [db.sales, db.auditLogs], async (tx) => {
      await db.sales.put({
        id: 'sale-tx-1',
        voucherNo: 'SAL-TX-01',
        merchantId: 'merch-1',
        merchantName: 'Trader Aung',
        merchantTown: 'Mandalay',
        date: '2026-09-10',
        time: '10:00',
        items: [],
        totalAmount: 50000,
        paidAmount: 50000,
        remainingReceivableBalance: 0,
        createdAt: new Date().toISOString(),
      });

      await recordAuditEvent(
        {
          action: 'Sale Created',
          referenceType: 'SALE',
          referenceId: 'sale-tx-1',
          referenceVoucherNo: 'SAL-TX-01',
          amount: 50000,
        },
        tx
      );
    });

    const logs = await getAuditTrail({ referenceVoucherNo: 'SAL-TX-01' });
    expect(logs.length).toBe(1);
    expect(logs[0].referenceId).toBe('sale-tx-1');
  });

  it('traces full lifecycle history for a voucher across sale, stock, return, and reversal', async () => {
    const vNo = 'SAL-TRACE-999';

    // 1. Initial Sale Event
    await recordAuditEvent({
      action: 'Initial Sale Recorded',
      referenceType: 'SALE',
      referenceId: 'sale-999',
      referenceVoucherNo: vNo,
      amount: 200000,
    });

    // 2. Stock Out Event
    await recordAuditEvent({
      action: 'Stock Out Executed',
      referenceType: 'STOCK_MOVEMENT',
      referenceId: 'stock-sm-1',
      referenceVoucherNo: vNo,
      quantity: 10,
    });

    // 3. Return Event
    await recordAuditEvent({
      action: 'Sales Return Submitted',
      referenceType: 'RETURN',
      referenceId: 'ret-11',
      referenceVoucherNo: vNo,
      amount: 40000,
      quantity: 2,
    });

    // 4. Reversal Event
    await recordAuditEvent({
      action: 'Sale Reversal Executed',
      referenceType: 'REVERSAL',
      referenceId: 'rev-22',
      referenceVoucherNo: vNo,
      metadata: { reversalOf: 'sale-999' },
    });

    const chain = await getAuditHistoryForVoucher(vNo);
    expect(chain.length).toBe(4);
    expect(chain[0].action).toBe('Initial Sale Recorded');
    expect(chain[3].action).toBe('Sale Reversal Executed');
  });

  it('runs health diagnostics on audit integrity and detects duplicate IDs or orphan references', async () => {
    // Add orphan audit reference
    await recordAuditEvent({
      id: 'audit-orphan-1',
      action: 'Broken Ref Action',
      referenceType: 'SALE',
      referenceId: 'non-existent-sale-id-xyz',
    });

    const health = await runDatabaseDiagnostics();
    const orphanIssue = health.results.find((i) => i.code === 'ORPHAN_AUDIT_REFERENCE');
    expect(orphanIssue).toBeDefined();
    expect(orphanIssue?.recordId).toBe('audit-orphan-1');
  });

  it('ensures audit logs are backed up and restored completely without data loss', async () => {
    await recordAuditEvent({
      action: 'Backup Test Event',
      referenceType: 'SYSTEM',
      referenceId: 'sys-1',
      amount: 12345,
    });

    const backupFile = await createCompleteBackup();
    expect(backupFile.data.auditLogs).toBeDefined();
    expect(backupFile.data.auditLogs?.length).toBeGreaterThan(0);

    // Clear local audit table
    await db.auditLogs.clear();
    expect((await db.auditLogs.toArray()).length).toBe(0);

    const validation = await validateBackupFile(backupFile);
    await executeSafeRestore(validation, 'OVERWRITE');

    const restored = await db.auditLogs.toArray();
    expect(restored.length).toBeGreaterThan(0);
    const restoredEvent = restored.find((l) => l.action === 'Backup Test Event');
    expect(restoredEvent).toBeDefined();
    expect(restoredEvent?.amount).toBe(12345);
  });

  it('regression: allows inserting 250 audit records without data loss (no 200-item truncation bug)', async () => {
    // Clear audit table to start from 0
    await db.auditLogs.clear();
    expect(await db.auditLogs.count()).toBe(0);

    // Concurrently or sequentially insert 250 records
    const promises = [];
    for (let i = 1; i <= 250; i++) {
      promises.push(
        recordAuditEvent({
          action: `Event Number #${i}`,
          details: `Batch event test ${i}`,
          referenceType: 'SYSTEM',
          referenceId: `batch-test-${i}`,
          amount: i * 100,
        })
      );
    }
    await Promise.all(promises);

    // Verify exactly 250 records exist in IndexedDB without any 200-item truncation
    const count = await db.auditLogs.count();
    expect(count).toBe(250);

    // Verify getAuditTrail with limit > 200 retrieves all 250 records
    const allRecords = await getAuditTrail({ limit: 500 });
    expect(allRecords.length).toBe(250);

    // Verify first and last entries exist
    const foundFirst = allRecords.some((r) => r.action === 'Event Number #1');
    const found250 = allRecords.some((r) => r.action === 'Event Number #250');
    expect(foundFirst).toBe(true);
    expect(found250).toBe(true);
  });
});

