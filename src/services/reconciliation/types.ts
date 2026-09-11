/**
 * Shwe Let Yar - Professional Financial & Data Reconciliation Types
 * Phase 18 Implementation
 *
 * SSoT Type Definitions for independent reconciliation across:
 * - Stock Movements vs Product Inventory
 * - Cash Movements vs Daily Closings
 * - Merchant Receivables & Sales Ledgers
 * - Supplier Payables, Advances & Inbound Ledgers
 * - Cross-Ledger Operational Traceability
 * - Daily Closing Closed-Period Guards
 */

import { DailyClosingRecord } from '../../types';

// ============================================================================
// 1. STOCK RECONCILIATION TYPES
// ============================================================================

export type StockReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'MISSING_REFERENCE'
  | 'INVALID_MOVEMENT'
  | 'UNSUPPORTED_MOVEMENT';

export interface InvalidStockMovementDetail {
  movementId: string;
  productId: string;
  reason: string;
  movementType?: string;
  quantity?: number;
}

export interface ProductStockReconciliation {
  productId: string;
  productName: string;
  unit: string;
  openingStock: number;
  validInboundMovements: number; // supplier inbounds, purchase inbounds, peer borrow in
  validReturnInMovements: number; // sales return inbound
  validPositiveAdjustments: number; // stock adjustments IN, peer return in
  validOutboundMovements: number; // merchant sales, peer lend out
  validReturnOutMovements: number; // purchase return outbound
  validNegativeAdjustments: number; // stock adjustments OUT, damage loss, peer return out
  validReversalMovements: number; // cancellation reversals
  expectedStock: number;
  actualStock: number;
  difference: number; // actualStock - expectedStock (0 = MATCH)
  status: StockReconciliationStatus;
  movementsCount: number;
  invalidMovements?: InvalidStockMovementDetail[];
  issues?: string[];
}

export interface StockReconciliationResult {
  totalProducts: number;
  matchedCount: number;
  mismatchedCount: number;
  invalidMovementsCount: number;
  products: ProductStockReconciliation[];
  overallStockStatus: 'MATCH' | 'MISMATCH';
  summary: {
    totalExpectedInventoryCount: number;
    totalActualInventoryCount: number;
    totalDifference: number;
  };
}

// ============================================================================
// 2. CASH RECONCILIATION TYPES
// ============================================================================

export type CashReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'MISSING_CASH_MOVEMENT'
  | 'DUPLICATE_CASH_MOVEMENT'
  | 'INVALID_AMOUNT'
  | 'MISSING_DAILY_CLOSING'
  | 'CLOSING_MISMATCH';

export interface DayCashReconciliation {
  date: string;
  openingCash: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedClosingCash: number;
  isClosed: boolean;
  closingRecord?: DailyClosingRecord;
  actualCountedCash?: number;
  recordedExpectedClosingCash?: number;
  difference: number; // actualCountedCash (or recorded) - calculated expected
  status: CashReconciliationStatus;
  movementsCount: number;
  issues: string[];
}

export interface CashReconciliationResult {
  totalDaysChecked: number;
  matchedDaysCount: number;
  mismatchedDaysCount: number;
  missingClosingsCount: number;
  dailyReconciliations: DayCashReconciliation[];
  totalExpectedCashBalance: number;
  overallCashStatus: 'MATCH' | 'MISMATCH';
  duplicateMovements: string[];
  invalidAmountMovements: string[];
  orphanMovements: string[];
}

// ============================================================================
// 3. MERCHANT RECEIVABLE RECONCILIATION TYPES
// ============================================================================

export type MerchantReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'ORPHAN_TRANSACTION'
  | 'INVALID_BALANCE';

export interface MerchantBalanceReconciliation {
  merchantId: string;
  merchantName: string;
  openingReceivableBalance: number;
  totalSalesValue: number;
  totalCashPaid: number;
  totalCreditSales: number; // totalSalesValue - totalCashPaid
  totalReturnsAndRefundsCredit: number; // credit adjustment from returns
  totalDebtCollections: number;
  expectedReceivableBalance: number;
  actualReceivableBalance: number;
  difference: number; // actual - expected
  status: MerchantReconciliationStatus;
  vouchersCount: number;
  issues: string[];
}

export interface MerchantReconciliationResult {
  totalMerchants: number;
  matchedCount: number;
  mismatchedCount: number;
  merchants: MerchantBalanceReconciliation[];
  overallMerchantStatus: 'MATCH' | 'MISMATCH';
  summary: {
    totalExpectedReceivable: number;
    totalActualReceivable: number;
    totalDifference: number;
  };
}

// ============================================================================
// 4. SUPPLIER PAYABLE RECONCILIATION TYPES
// ============================================================================

export type SupplierReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'ORPHAN_TRANSACTION'
  | 'INVALID_ADVANCE';

export interface SupplierBalanceReconciliation {
  supplierId: string;
  supplierName: string;
  openingAdvanceBalance: number;
  totalAdvancesGiven: number;
  totalAdvancesDeducted: number;
  totalRepaymentsReceived: number;
  totalGoodsDeliveredValue: number;
  totalNetCashPaid: number;
  expectedAdvanceBalance: number;
  actualAdvanceBalance: number;
  difference: number; // actual - expected
  status: SupplierReconciliationStatus;
  transactionsCount: number;
  issues: string[];
}

export interface SupplierReconciliationResult {
  totalSuppliers: number;
  matchedCount: number;
  mismatchedCount: number;
  suppliers: SupplierBalanceReconciliation[];
  overallSupplierStatus: 'MATCH' | 'MISMATCH';
  summary: {
    totalExpectedAdvance: number;
    totalActualAdvance: number;
    totalDifference: number;
  };
}

// ============================================================================
// 5. CROSS-LEDGER INTEGRITY & TRACEABILITY TYPES
// ============================================================================

export type CrossLedgerStatus = 'CONSISTENT' | 'INCONSISTENT';

export type CrossLedgerIssueType =
  | 'ORPHAN_STOCK'
  | 'ORPHAN_CASH'
  | 'ORPHAN_AUDIT'
  | 'DUPLICATE_OPERATION_ID'
  | 'PARTIAL_OPERATION'
  | 'INCONSISTENT_REFERENCE'
  | 'AMOUNT_MISMATCH';

export interface CrossLedgerTraceIssue {
  issueType: CrossLedgerIssueType;
  entityType: 'SALE' | 'TRANSACTION' | 'RETURN' | 'STOCK_ADJUSTMENT' | 'CASH_MOVEMENT' | 'STOCK_MOVEMENT' | 'AUDIT_LOG' | 'DAILY_CLOSING';
  entityId: string;
  referenceType?: string;
  referenceId?: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING';
}

export interface CrossLedgerIntegrityResult {
  status: CrossLedgerStatus;
  totalOperationsAudited: number;
  totalIssuesCount: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
  issues: CrossLedgerTraceIssue[];
  orphanStockMovements: string[];
  orphanCashMovements: string[];
  orphanAuditLogs: string[];
  duplicateOperationKeys: string[];
  partialOperations: string[];
}

// ============================================================================
// 6. MASTER RECONCILIATION REPORT
// ============================================================================

export type OverallReconciliationStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface ReconciliationReport {
  generatedAt: string; // ISO string
  overallStatus: OverallReconciliationStatus;
  stock: StockReconciliationResult;
  cash: CashReconciliationResult;
  merchants: MerchantReconciliationResult;
  suppliers: SupplierReconciliationResult;
  crossLedger: CrossLedgerIntegrityResult;
  audit: {
    totalAuditLogs: number;
    traceableLogsCount: number;
    orphanLogsCount: number;
    integrityCheckPassed: boolean;
  };
  errors: string[];
  warnings: string[];
}

export interface ReconciliationOptions {
  startDate?: string;
  endDate?: string;
  strictAuditValidation?: boolean;
}
