/**
 * Shwe Let Yar - Cash Reconciliation Service
 * Phase 18 Implementation
 *
 * Independently verifies that Cash movements and Daily Closing Records match:
 *   Day Expected Closing Cash = Opening Float + Sum(Cash In) - Sum(Cash Out)
 *
 * Compares against DailyClosingRecord.expectedClosingCash and actualCountedCash.
 * Detects duplicate movements, invalid amounts, unclosed past days, and discrepancies.
 *
 * Strict read-only audit: DOES NOT mutate data.
 */

import { db, ShweLetYarDatabase } from '../../db/database';
import { CashMovementRecord, DailyClosingRecord } from '../../types';
import {
  DayCashReconciliation,
  CashReconciliationResult,
  CashReconciliationStatus,
  ReconciliationOptions,
} from './types';
import { toSafeIntMoney, moneyAdd, moneySub } from '../../utils/moneyMath';

export const VALID_CASH_IN_TYPES = new Set([
  'SALE_PAYMENT_IN',
  'MERCHANT_DEBT_COLLECTION',
  'SUPPLIER_REPAYMENT_IN',
  'CAPITAL_IN',
  'OTHER_INCOME',
  'TRANSACTION_CANCELLED_CASH_REVERSAL', // if reversing a payout
  'SALE_PAYMENT',
  'INCOME',
]);

export const VALID_CASH_OUT_TYPES = new Set([
  'SUPPLIER_PAYOUT',
  'SUPPLIER_ADVANCE_OUT',
  'PURCHASE_PAYMENT_OUT',
  'SALES_RETURN_REFUND_OUT',
  'EXPENSE_OUT',
  'DRAWING_OUT',
  'EXPENSE',
  'DRAWING',
  'SUPPLIER_ADVANCE',
  'REFUND',
  'SALE_CANCELLED_CASH_REVERSAL', // if refunding a collected sale payment
]);

/**
 * Pure function to reconcile cash movements by date against daily closings.
 */
export function reconcileCashPure(
  movements: CashMovementRecord[],
  closings: DailyClosingRecord[],
  options?: ReconciliationOptions
): CashReconciliationResult {
  const duplicateMovements: string[] = [];
  const invalidAmountMovements: string[] = [];
  const orphanMovements: string[] = [];

  const seenIdempotencyKeys = new Map<string, string>();

  // Filter valid completed movements
  const validMovements: CashMovementRecord[] = [];

  for (const m of movements) {
    if (m.status === 'CANCELLED' || (m.status as any) === 'VOID') continue;

    // Check duplicate idempotency keys
    if (m.idempotencyKey) {
      if (seenIdempotencyKeys.has(m.idempotencyKey)) {
        duplicateMovements.push(
          `Duplicate idempotencyKey "${m.idempotencyKey}" between movement ${m.id} and ${seenIdempotencyKeys.get(m.idempotencyKey)}`
        );
      } else {
        seenIdempotencyKeys.set(m.idempotencyKey, m.id);
      }
    }

    const amt = typeof m.amount === 'number' ? m.amount : parseFloat(String(m.amount || 0));
    if (isNaN(amt) || !isFinite(amt) || amt < 0) {
      invalidAmountMovements.push(`Movement ${m.id} has invalid amount ${m.amount}`);
      continue;
    }

    validMovements.push(m);
  }

  // Group by date
  const movementsByDate = new Map<string, CashMovementRecord[]>();
  for (const m of validMovements) {
    const d = m.transactionDate || (m.createdAt ? m.createdAt.slice(0, 10) : 'UNKNOWN_DATE');
    if (!movementsByDate.has(d)) {
      movementsByDate.set(d, []);
    }
    movementsByDate.get(d)!.push(m);
  }

  // Map closings by date
  const closingsByDate = new Map<string, DailyClosingRecord>();
  for (const c of closings) {
    closingsByDate.set(c.closingDate, c);
  }

  // Collect all unique dates
  const allDatesSet = new Set<string>([...movementsByDate.keys(), ...closingsByDate.keys()]);
  const sortedDates = Array.from(allDatesSet)
    .filter((d) => d !== 'UNKNOWN_DATE')
    .sort();

  if (options?.startDate) {
    sortedDates.splice(0, sortedDates.length, ...sortedDates.filter((d) => d >= options.startDate!));
  }
  if (options?.endDate) {
    sortedDates.splice(0, sortedDates.length, ...sortedDates.filter((d) => d <= options.endDate!));
  }

  const dailyReconciliations: DayCashReconciliation[] = [];
  let runningCumulativeExpectedCash = 0;
  let matchedDaysCount = 0;
  let mismatchedDaysCount = 0;
  let missingClosingsCount = 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  for (const date of sortedDates) {
    const dayMovements = movementsByDate.get(date) || [];
    const closingRecord = closingsByDate.get(date);

    let dayCashIn = 0;
    let dayCashOut = 0;
    const issues: string[] = [];

    for (const m of dayMovements) {
      const amt = toSafeIntMoney(m.amount);
      if (m.direction === 'IN' || VALID_CASH_IN_TYPES.has(m.type)) {
        dayCashIn = moneyAdd(dayCashIn, amt);
      } else if (m.direction === 'OUT' || VALID_CASH_OUT_TYPES.has(m.type)) {
        dayCashOut = moneyAdd(dayCashOut, amt);
      } else {
        issues.push(`Unknown cash movement direction/type: id=${m.id}, type=${m.type}`);
      }
    }

    const dayOpeningCash = closingRecord?.openingCash !== undefined
      ? toSafeIntMoney(closingRecord.openingCash)
      : runningCumulativeExpectedCash;

    const dayExpectedClosing = toSafeIntMoney(dayOpeningCash + dayCashIn - dayCashOut);
    runningCumulativeExpectedCash = dayExpectedClosing;

    let status: CashReconciliationStatus = 'MATCH';
    let difference = 0;

    const isClosed = !!(closingRecord && closingRecord.status === 'CLOSED');

    if (closingRecord) {
      const recordedExpected = toSafeIntMoney(closingRecord.expectedClosingCash);
      const actualCounted = closingRecord.actualCountedCash !== undefined
        ? toSafeIntMoney(closingRecord.actualCountedCash)
        : recordedExpected;

      // Check if closing record's expectedClosing matches sum of movements
      const expectedDiff = recordedExpected - dayExpectedClosing;
      if (Math.abs(expectedDiff) > 0) {
        status = 'CLOSING_MISMATCH';
        issues.push(
          `Closing record expected cash (${recordedExpected}) differs from recomputed cash ledger total (${dayExpectedClosing}). Discrepancy: ${expectedDiff}`
        );
      }

      // Check physical cash discrepancy
      difference = actualCounted - dayExpectedClosing;
      if (Math.abs(difference) > 0) {
        if (status === 'MATCH') status = 'MISMATCH';
        issues.push(
          `Physical counted cash (${actualCounted}) has difference of ${difference > 0 ? '+' : ''}${difference} MMK against expected.`
        );
      }
    } else {
      // Past day with cash movements but no daily closing
      if (date < todayStr && dayMovements.length > 0) {
        missingClosingsCount++;
        status = 'MISSING_DAILY_CLOSING';
        issues.push(`Day ${date} has ${dayMovements.length} cash transaction(s) but was never closed.`);
      }
    }

    if (status === 'MATCH') {
      matchedDaysCount++;
    } else {
      mismatchedDaysCount++;
    }

    dailyReconciliations.push({
      date,
      openingCash: dayOpeningCash,
      totalCashIn: dayCashIn,
      totalCashOut: dayCashOut,
      expectedClosingCash: dayExpectedClosing,
      isClosed,
      closingRecord,
      actualCountedCash: closingRecord?.actualCountedCash,
      recordedExpectedClosingCash: closingRecord?.expectedClosingCash,
      difference,
      status,
      movementsCount: dayMovements.length,
      issues,
    });
  }

  return {
    totalDaysChecked: sortedDates.length,
    matchedDaysCount,
    mismatchedDaysCount,
    missingClosingsCount,
    dailyReconciliations,
    totalExpectedCashBalance: runningCumulativeExpectedCash,
    overallCashStatus: mismatchedDaysCount === 0 && duplicateMovements.length === 0 ? 'MATCH' : 'MISMATCH',
    duplicateMovements,
    invalidAmountMovements,
    orphanMovements,
  };
}

/**
 * Reconciles all cash records in the database.
 */
export async function reconcileAllCash(
  targetDb: ShweLetYarDatabase = db,
  options?: ReconciliationOptions
): Promise<CashReconciliationResult> {
  const [movements, closings] = await Promise.all([
    targetDb.cashMovements.toArray(),
    targetDb.dailyClosings.toArray(),
  ]);

  return reconcileCashPure(movements, closings, options);
}
