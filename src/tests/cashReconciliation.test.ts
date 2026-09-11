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
import { CashMovementRecord, DailyClosingRecord } from '../types';
import {
  reconcileCashPure,
} from '../services/reconciliation/cashReconciliationService';

describe('Phase 18 - Cash Reconciliation Service', () => {
  beforeEach(async () => {
    await db.cashMovements.clear();
    await db.dailyClosings.clear();
  });

  it('correctly reconciles daily cash movements matching closing record', () => {
    const movements: CashMovementRecord[] = [
      {
        id: 'c1',
        amount: 500000,
        signedAmount: 500000,
        direction: 'IN',
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_1',
        description: 'Sale Payment In',
        transactionDate: '2026-03-01',
        createdAt: '2026-03-01T10:00:00Z',
        idempotencyKey: 'key_c1',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
      {
        id: 'c2',
        amount: 200000,
        signedAmount: -200000,
        direction: 'OUT',
        type: 'SUPPLIER_PAYOUT',
        referenceType: 'TRANSACTION',
        referenceId: 'tx_1',
        description: 'Supplier Payout',
        transactionDate: '2026-03-01',
        createdAt: '2026-03-01T12:00:00Z',
        idempotencyKey: 'key_c2',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
      {
        id: 'c3',
        amount: 50000,
        signedAmount: -50000,
        direction: 'OUT',
        type: 'EXPENSE_PAYOUT',
        referenceType: 'EXPENSE',
        referenceId: 'exp_1',
        description: 'Expense Payout',
        transactionDate: '2026-03-01',
        createdAt: '2026-03-01T15:00:00Z',
        idempotencyKey: 'key_c3',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
    ];

    const closings: DailyClosingRecord[] = [
      {
        id: 'closing_2026-03-01',
        closingDate: '2026-03-01',
        openingCash: 100000,
        totalCashIn: 500000,
        totalCashOut: 250000,
        expectedClosingCash: 350000, // 100,000 + 500,000 - 200,000 - 50,000 = 350,000
        actualCountedCash: 350000,
        difference: 0,
        status: 'CLOSED',
        closedAt: '2026-03-01T18:00:00Z',
        createdAt: '2026-03-01T18:00:00Z',
      },
    ];

    const result = reconcileCashPure(movements, closings);

    expect(result.overallCashStatus).toBe('MATCH');
    expect(result.totalDaysChecked).toBe(1);
    expect(result.matchedDaysCount).toBe(1);
    expect(result.mismatchedDaysCount).toBe(0);

    const day0 = result.dailyReconciliations[0];
    expect(day0.expectedClosingCash).toBe(350000);
    expect(day0.difference).toBe(0);
    expect(day0.status).toBe('MATCH');
  });

  it('detects physical cash discrepancies and closing record calculation errors', () => {
    const movements: CashMovementRecord[] = [
      {
        id: 'c10',
        amount: 200000,
        signedAmount: 200000,
        direction: 'IN',
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_10',
        description: 'Sale Payment In',
        transactionDate: '2026-03-02',
        createdAt: '2026-03-02T10:00:00Z',
        idempotencyKey: 'c10_key',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
    ];

    const closings: DailyClosingRecord[] = [
      {
        id: 'closing_2026-03-02',
        closingDate: '2026-03-02',
        openingCash: 0,
        totalCashIn: 200000,
        totalCashOut: 0,
        expectedClosingCash: 200000,
        actualCountedCash: 195000, // Cash shortage: -5,000
        difference: -5000,
        status: 'CLOSED',
        closedAt: '2026-03-02T18:00:00Z',
        createdAt: '2026-03-02T18:00:00Z',
      },
    ];

    const result = reconcileCashPure(movements, closings);

    expect(result.overallCashStatus).toBe('MISMATCH');
    expect(result.mismatchedDaysCount).toBe(1);

    const day = result.dailyReconciliations[0];
    expect(day.status).toBe('MISMATCH');
    expect(day.difference).toBe(-5000);
    expect(day.issues.length).toBeGreaterThan(0);
  });

  it('detects duplicate idempotency keys in cash ledger', () => {
    const movements: CashMovementRecord[] = [
      {
        id: 'c_dup_1',
        amount: 100000,
        signedAmount: 100000,
        direction: 'IN',
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_dup1',
        description: 'Sale Payment In',
        transactionDate: '2026-03-03',
        createdAt: '2026-03-03T10:00:00Z',
        idempotencyKey: 'duplicate_key_123',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
      {
        id: 'c_dup_2',
        amount: 100000,
        signedAmount: 100000,
        direction: 'IN',
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_dup2',
        description: 'Sale Payment In',
        transactionDate: '2026-03-03',
        createdAt: '2026-03-03T10:05:00Z',
        idempotencyKey: 'duplicate_key_123',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
    ];

    const result = reconcileCashPure(movements, []);

    expect(result.duplicateMovements.length).toBe(1);
    expect(result.duplicateMovements[0]).toContain('duplicate_key_123');
    expect(result.overallCashStatus).toBe('MISMATCH');
  });

  it('detects unclosed past dates with active transactions', () => {
    const movements: CashMovementRecord[] = [
      {
        id: 'c_past',
        amount: 50000,
        signedAmount: 50000,
        direction: 'IN',
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_past',
        description: 'Sale Payment In',
        transactionDate: '2025-01-01', // Past date
        createdAt: '2025-01-01T10:00:00Z',
        idempotencyKey: 'c_past_key',
        status: 'COMPLETED',
        schemaVersion: 1,
      },
    ];

    const result = reconcileCashPure(movements, []);
    expect(result.missingClosingsCount).toBe(1);
    expect(result.dailyReconciliations[0].status).toBe('MISSING_DAILY_CLOSING');
  });
});
