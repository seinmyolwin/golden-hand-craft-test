/**
 * Shwe Let Yar - Merchant Receivable Reconciliation Service
 * Phase 18 Implementation
 *
 * Independently verifies that Merchant Receivable Balances strictly equal:
 *   Opening Balance
 *   + Net Sales Receivable (Grand Total - Immediate Cash Paid)
 *   - Debt Collections / Payments Received Later
 *   - Sales Returns Credit Adjustments
 *   ± Cancellation Reversals
 *
 * Compares calculated expected balance against Merchant.currentReceivableBalance.
 *
 * Strict read-only audit: DOES NOT mutate data.
 */

import { db, ShweLetYarDatabase } from '../../db/database';
import { Merchant, SaleRecord, ReturnRecord, CashMovementRecord } from '../../types';
import {
  MerchantBalanceReconciliation,
  MerchantReconciliationResult,
  MerchantReconciliationStatus,
  ReconciliationOptions,
} from './types';
import { toSafeIntMoney, moneyAdd, moneySub } from '../../utils/moneyMath';

/**
 * Pure function to reconcile a single merchant's balance across all source documents.
 */
export function reconcileMerchantBalancePure(
  merchant: Merchant,
  sales: SaleRecord[],
  returns: ReturnRecord[],
  cashMovements: CashMovementRecord[],
  options?: ReconciliationOptions
): MerchantBalanceReconciliation {
  const issues: string[] = [];

  const merchantSales = sales.filter((s) => {
    if (s.merchantId !== merchant.id) return false;
    if (s.status === 'CANCELLED') return false;
    if (options?.startDate && s.date < options.startDate) return false;
    if (options?.endDate && s.date > options.endDate) return false;
    return true;
  });

  const merchantReturns = returns.filter((r) => {
    if (r.merchantId !== merchant.id && r.merchantName !== merchant.name) return false;
    if (r.status === 'CANCELLED') return false;
    if (options?.startDate && r.date < options.startDate) return false;
    if (options?.endDate && r.date > options.endDate) return false;
    return true;
  });

  const debtCollections = cashMovements.filter((c) => {
    if (c.status === 'CANCELLED' || c.status === 'REVERSED') return false;
    if (c.type !== 'MERCHANT_DEBT_COLLECTION_IN') return false;
    const matchesId = c.referenceId === merchant.id || c.counterpartName === merchant.name;
    if (!matchesId) return false;
    if (options?.startDate && c.transactionDate && c.transactionDate < options.startDate) return false;
    if (options?.endDate && c.transactionDate && c.transactionDate > options.endDate) return false;
    return true;
  });

  let totalSalesValue = 0;
  let totalCashPaidAtSale = 0;

  for (const s of merchantSales) {
    const total = toSafeIntMoney(s.grandTotal);
    const paid = toSafeIntMoney(s.paidAmount ?? 0);
    totalSalesValue = moneyAdd(totalSalesValue, total);
    totalCashPaidAtSale = moneyAdd(totalCashPaidAtSale, paid);
  }

  const totalCreditSales = moneySub(totalSalesValue, totalCashPaidAtSale);

  let totalReturnsCredit = 0;
  for (const r of merchantReturns) {
    if (r.type === 'SALES_RETURN') {
      // Credit adjustment reduces customer receivable
      const creditAdj = toSafeIntMoney(r.creditAdjustmentAmount ?? 0);
      totalReturnsCredit = moneyAdd(totalReturnsCredit, creditAdj);
    }
  }

  let totalDebtCollections = 0;
  for (const col of debtCollections) {
    totalDebtCollections = moneyAdd(totalDebtCollections, toSafeIntMoney(col.amount));
  }

  const openingReceivable = toSafeIntMoney(merchant.receivableBalance || 0);

  // Expected Receivable Balance Formula:
  // opening + (sales - cashPaidAtSale) - debtCollections - returnsCredit
  const expectedReceivableBalance = toSafeIntMoney(
    openingReceivable + totalCreditSales - totalDebtCollections - totalReturnsCredit
  );

  const actualReceivableBalance = toSafeIntMoney(merchant.currentReceivableBalance ?? 0);
  const difference = toSafeIntMoney(actualReceivableBalance - expectedReceivableBalance);

  let status: MerchantReconciliationStatus = 'MATCH';
  if (Math.abs(difference) > 0) {
    status = 'MISMATCH';
    issues.push(
      `Receivable balance mismatch: Current balance (${actualReceivableBalance}) != Expected ledger balance (${expectedReceivableBalance}). Discrepancy: ${difference > 0 ? '+' : ''}${difference} MMK.`
    );
  }

  return {
    merchantId: merchant.id,
    merchantName: merchant.name,
    openingReceivableBalance: openingReceivable,
    totalSalesValue,
    totalCashPaid: totalCashPaidAtSale,
    totalCreditSales,
    totalReturnsAndRefundsCredit: totalReturnsCredit,
    totalDebtCollections,
    expectedReceivableBalance,
    actualReceivableBalance,
    difference,
    status,
    vouchersCount: merchantSales.length + merchantReturns.length + debtCollections.length,
    issues,
  };
}

/**
 * Reconciles all merchants in the database.
 */
export async function reconcileAllMerchants(
  targetDb: ShweLetYarDatabase = db,
  options?: ReconciliationOptions
): Promise<MerchantReconciliationResult> {
  const [merchants, sales, returns, cashMovements] = await Promise.all([
    targetDb.merchants.toArray(),
    targetDb.sales.toArray(),
    targetDb.returnsAndRefunds.toArray(),
    targetDb.cashMovements.toArray(),
  ]);

  const merchantReconciliations = merchants.map((m) =>
    reconcileMerchantBalancePure(m, sales, returns, cashMovements, options)
  );

  let matchedCount = 0;
  let mismatchedCount = 0;
  let totalExpected = 0;
  let totalActual = 0;

  for (const item of merchantReconciliations) {
    if (item.status === 'MATCH') {
      matchedCount++;
    } else {
      mismatchedCount++;
    }
    totalExpected += item.expectedReceivableBalance;
    totalActual += item.actualReceivableBalance;
  }

  return {
    totalMerchants: merchants.length,
    matchedCount,
    mismatchedCount,
    merchants: merchantReconciliations,
    overallMerchantStatus: mismatchedCount === 0 ? 'MATCH' : 'MISMATCH',
    summary: {
      totalExpectedReceivable: totalExpected,
      totalActualReceivable: totalActual,
      totalDifference: totalActual - totalExpected,
    },
  };
}
