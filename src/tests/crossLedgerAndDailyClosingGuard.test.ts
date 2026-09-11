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
import { SaleRecord, StockMovementRecord, CashMovementRecord } from '../types';
import { auditCrossLedgerIntegrityPure } from '../services/reconciliation/crossLedgerIntegrityService';
import {
  isDateClosed,
  assertDateNotClosed,
  reopenClosedDateWithAudit,
} from '../services/reconciliation/dailyClosingGuardService';
import { generateReconciliationReport } from '../services/reconciliation/reconciliationService';
import { SaleRepository } from '../repositories/index';
import { DailyClosingLockedError } from '../repositories/errors';

describe('Phase 18 - Cross-Ledger Integrity & Daily Closing Guards', () => {
  beforeEach(async () => {
    await db.sales.clear();
    await db.transactions.clear();
    await db.merchants.clear();
    await db.products.clear();
    await db.stockMovements.clear();
    await db.cashMovements.clear();
    await db.auditLogs.clear();
    await db.dailyClosings.clear();
  });

  it('verifies a fully consistent multi-entry transaction across sales, stock, cash and audit', () => {
    const sale: SaleRecord = {
      id: 'sale_101',
      voucherNo: 'SALE-101',
      date: '2026-03-01',
      time: '10:00',
      merchantId: 'm1',
      merchantName: 'Ko San',
      merchantTown: 'Yangon',
      status: 'COMPLETED',
      grandTotal: 100000,
      paidAmount: 100000,
      items: [
        {
          productId: 'prod_1',
          productName: 'Ring',
          unit: 'ကွင်း',
          quantity: 2,
          unitPrice: 50000,
          subtotal: 100000,
        },
      ],
    };

    const stockMovements: StockMovementRecord[] = [
      {
        id: 'sm_101',
        productId: 'prod_1',
        productName: 'Ring',
        quantity: 2,
        signedQuantity: -2,
        direction: 'OUT',
        movementType: 'MERCHANT_OUTBOUND',
        referenceType: 'SALE',
        referenceId: 'sale_101',
        referenceVoucherNo: 'SALE-101',
        transactionDate: '2026-03-01',
        createdAt: '2026-03-01T10:00:00Z',
        idempotencyKey: 'SALE_sale_101_prod_1',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
    ];

    const cashMovements: CashMovementRecord[] = [
      {
        id: 'cm_101',
        amount: 100000,
        signedAmount: 100000,
        direction: 'IN',
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_101',
        referenceVoucherNo: 'SALE-101',
        description: 'Sale Payment In',
        transactionDate: '2026-03-01',
        createdAt: '2026-03-01T10:00:00Z',
        idempotencyKey: 'CSH_SALE_sale_101',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
    ];

    const result = auditCrossLedgerIntegrityPure({
      sales: [sale],
      transactions: [],
      returns: [],
      adjustments: [],
      stockMovements,
      cashMovements,
      auditLogs: [],
    });

    expect(result.status).toBe('CONSISTENT');
    expect(result.criticalIssuesCount).toBe(0);
    expect(result.warningIssuesCount).toBe(0);
  });

  it('detects partial operations when a completed sale is missing stock movement or cash movement', () => {
    const sale: SaleRecord = {
      id: 'sale_broken',
      voucherNo: 'SALE-BROKEN',
      date: '2026-03-01',
      time: '11:00',
      merchantId: 'm2',
      merchantName: 'Daw Mya',
      merchantTown: 'Mandalay',
      status: 'COMPLETED',
      grandTotal: 50000,
      paidAmount: 50000,
      items: [
        {
          productId: 'prod_missing_mv',
          productName: 'Missing Item',
          unit: 'ခု',
          quantity: 1,
          unitPrice: 50000,
          subtotal: 50000,
        },
      ],
    };

    const result = auditCrossLedgerIntegrityPure({
      sales: [sale],
      transactions: [],
      returns: [],
      adjustments: [],
      stockMovements: [], // Missing stock movement!
      cashMovements: [], // Missing cash movement!
      auditLogs: [],
    });

    expect(result.status).toBe('INCONSISTENT');
    expect(result.criticalIssuesCount).toBeGreaterThanOrEqual(2);
    expect(result.partialOperations.length).toBeGreaterThanOrEqual(2);
  });

  it('strictly rejects financial mutations on closed/locked dates with DailyClosingLockedError', async () => {
    const closedDate = '2026-03-01';

    // Record closing for the date
    await db.dailyClosings.put({
      id: `closing_${closedDate}`,
      closingDate: closedDate,
      openingCash: 100000,
      totalCashIn: 0,
      totalCashOut: 0,
      expectedClosingCash: 100000,
      actualCountedCash: 100000,
      difference: 0,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    expect(await isDateClosed(closedDate, db)).toBe(true);

    // Assert date not closed should throw
    await expect(assertDateNotClosed(closedDate, db, 'Sale')).rejects.toThrow(DailyClosingLockedError);

    // SaleRepository atomic write should be rejected on closed date
    const saleRepo = new SaleRepository(db);
    const saleAttempt: SaleRecord = {
      id: 'sale_attempt_closed',
      voucherNo: 'SALE-CLOSED-ATTEMPT',
      date: closedDate,
      time: '12:00',
      merchantId: 'm1',
      merchantName: 'Ko San',
      merchantTown: 'Yangon',
      status: 'PENDING',
      grandTotal: 50000,
      items: [],
    };

    await expect(saleRepo.saveSaleAtomic(saleAttempt)).rejects.toThrow(DailyClosingLockedError);
  });

  it('allows administrative reopening of closed day with explicit audit trail logging', async () => {
    const dateToReopen = '2026-03-02';

    await db.dailyClosings.put({
      id: `closing_${dateToReopen}`,
      closingDate: dateToReopen,
      openingCash: 50000,
      totalCashIn: 0,
      totalCashOut: 0,
      expectedClosingCash: 50000,
      actualCountedCash: 50000,
      difference: 0,
      status: 'CLOSED',
      closedAt: '2026-03-02T18:00:00Z',
      createdAt: '2026-03-02T18:00:00Z',
    });

    expect(await isDateClosed(dateToReopen, db)).toBe(true);

    // Reopen with reason
    await reopenClosedDateWithAudit(
      dateToReopen,
      'စစ်ဆေးတွေ့ရှိချက်အရ အမှားပြင်ဆင်ရန် ပြန်ဖွင့်သည်',
      'Owner',
      db
    );

    // Now date should be open
    expect(await isDateClosed(dateToReopen, db)).toBe(false);

    // Audit log should be recorded
    const auditLogs = await db.auditLogs.toArray();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toContain('Administrative Reopen');
  });

  it('generates a full master reconciliation report across all domains', async () => {
    // Populate simple consistent master data
    await db.products.put({
      id: 'prod_clean',
      name: 'Clean Gold Ring',
      unit: 'ကွင်း',
      category: 'ရွှေထည်',
      defaultPrice: 100000,
      active: true,
      openingStock: 10,
      currentStock: 10,
    });

    const report = await generateReconciliationReport(db);

    expect(report).toBeDefined();
    expect(report.generatedAt).toBeDefined();
    expect(report.overallStatus).toBe('HEALTHY');
    expect(report.stock.overallStockStatus).toBe('MATCH');
    expect(report.cash.overallCashStatus).toBe('MATCH');
    expect(report.merchants.overallMerchantStatus).toBe('MATCH');
    expect(report.suppliers.overallSupplierStatus).toBe('MATCH');
    expect(report.crossLedger.status).toBe('CONSISTENT');
  });
});
