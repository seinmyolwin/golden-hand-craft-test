/**
 * Shwe Let Yar - Supplier Advance & Payable Reconciliation Service
 * Phase 18 Implementation
 *
 * Independently verifies that Supplier Advance Balances strictly equal:
 *   Opening Advance Balance
 *   + New Advances Given
 *   - Advances Deducted from Goods Deliveries
 *   - Cash Repayments Received from Supplier
 *   ± Cancellation Reversals
 *
 * Compares calculated expected advance against Supplier.currentAdvanceBalance.
 *
 * Strict read-only audit: DOES NOT mutate data.
 */

import { db, ShweLetYarDatabase } from '../../db/database';
import { Supplier, TransactionRecord, CashMovementRecord } from '../../types';
import {
  SupplierBalanceReconciliation,
  SupplierReconciliationResult,
  SupplierReconciliationStatus,
  ReconciliationOptions,
} from './types';
import { toSafeIntMoney, moneyAdd, moneySub } from '../../utils/moneyMath';

/**
 * Pure function to reconcile a single supplier's advance balance across all transactions.
 */
export function reconcileSupplierBalancePure(
  supplier: Supplier,
  transactions: TransactionRecord[],
  cashMovements: CashMovementRecord[],
  options?: ReconciliationOptions
): SupplierBalanceReconciliation {
  const issues: string[] = [];

  const supplierTxs = transactions.filter((t) => {
    if (t.supplierId !== supplier.id) return false;
    if (t.status === 'CANCELLED') return false;
    if (options?.startDate && t.date < options.startDate) return false;
    if (options?.endDate && t.date > options.endDate) return false;
    return true;
  });

  let totalAdvancesGiven = 0;
  let totalAdvancesDeducted = 0;
  let totalRepaymentsReceived = 0;
  let totalGoodsDeliveredValue = 0;
  let totalNetCashPaid = 0;

  for (const tx of supplierTxs) {
    const advGiven = toSafeIntMoney(tx.newAdvanceTaken || 0);
    const advDeducted = toSafeIntMoney(tx.advanceDeducted || 0);
    const repayment = toSafeIntMoney(tx.cashRepaymentReceived || 0);
    const goodsVal = toSafeIntMoney(tx.totalGoodsValue || 0);
    const cashPaid = toSafeIntMoney(tx.cashPaidToSupplier || tx.netCashPaidToSupplier || 0);

    totalAdvancesGiven = moneyAdd(totalAdvancesGiven, advGiven);
    totalAdvancesDeducted = moneyAdd(totalAdvancesDeducted, advDeducted);
    totalRepaymentsReceived = moneyAdd(totalRepaymentsReceived, repayment);
    totalGoodsDeliveredValue = moneyAdd(totalGoodsDeliveredValue, goodsVal);
    totalNetCashPaid = moneyAdd(totalNetCashPaid, cashPaid);
  }

  const openingAdvance = toSafeIntMoney(supplier.initialAdvance || supplier.advanceBalance || 0);

  // Expected Advance Balance Formula:
  // opening + totalAdvancesGiven - totalAdvancesDeducted - totalRepaymentsReceived
  const expectedAdvanceBalance = toSafeIntMoney(
    openingAdvance + totalAdvancesGiven - totalAdvancesDeducted - totalRepaymentsReceived
  );

  const actualAdvanceBalance = toSafeIntMoney(supplier.currentAdvanceBalance ?? 0);
  const difference = toSafeIntMoney(actualAdvanceBalance - expectedAdvanceBalance);

  let status: SupplierReconciliationStatus = 'MATCH';
  if (Math.abs(difference) > 0) {
    status = 'MISMATCH';
    issues.push(
      `Advance balance mismatch: Current advance (${actualAdvanceBalance}) != Expected advance balance (${expectedAdvanceBalance}). Discrepancy: ${difference > 0 ? '+' : ''}${difference} MMK.`
    );
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    openingAdvanceBalance: openingAdvance,
    totalAdvancesGiven,
    totalAdvancesDeducted,
    totalRepaymentsReceived,
    totalGoodsDeliveredValue,
    totalNetCashPaid,
    expectedAdvanceBalance,
    actualAdvanceBalance,
    difference,
    status,
    transactionsCount: supplierTxs.length,
    issues,
  };
}

/**
 * Reconciles all suppliers in the database.
 */
export async function reconcileAllSuppliers(
  targetDb: ShweLetYarDatabase = db,
  options?: ReconciliationOptions
): Promise<SupplierReconciliationResult> {
  const [suppliers, transactions, cashMovements] = await Promise.all([
    targetDb.suppliers.toArray(),
    targetDb.transactions.toArray(),
    targetDb.cashMovements.toArray(),
  ]);

  const supplierReconciliations = suppliers.map((s) =>
    reconcileSupplierBalancePure(s, transactions, cashMovements, options)
  );

  let matchedCount = 0;
  let mismatchedCount = 0;
  let totalExpected = 0;
  let totalActual = 0;

  for (const item of supplierReconciliations) {
    if (item.status === 'MATCH') {
      matchedCount++;
    } else {
      mismatchedCount++;
    }
    totalExpected += item.expectedAdvanceBalance;
    totalActual += item.actualAdvanceBalance;
  }

  return {
    totalSuppliers: suppliers.length,
    matchedCount,
    mismatchedCount,
    suppliers: supplierReconciliations,
    overallSupplierStatus: mismatchedCount === 0 ? 'MATCH' : 'MISMATCH',
    summary: {
      totalExpectedAdvance: totalExpected,
      totalActualAdvance: totalActual,
      totalDifference: totalActual - totalExpected,
    },
  };
}
