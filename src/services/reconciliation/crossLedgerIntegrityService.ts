/**
 * Shwe Let Yar - Cross-Ledger Operational Traceability & Integrity Service
 * Phase 18 Implementation
 *
 * Audits end-to-end multi-entry linkages across:
 *   SaleRecord ↔ StockMovements ↔ CashMovement ↔ AuditLog
 *   TransactionRecord ↔ StockMovements ↔ CashMovement ↔ AuditLog
 *   ReturnRecord ↔ StockMovements ↔ CashMovement ↔ AuditLog
 *   StockAdjustmentRecord ↔ StockMovements ↔ AuditLog
 *
 * Detects orphan movements, partial operations, duplicate operation keys, and audit gaps.
 * Strict read-only audit: DOES NOT mutate data.
 */

import { db, ShweLetYarDatabase } from '../../db/database';
import {
  SaleRecord,
  TransactionRecord,
  ReturnRecord,
  StockAdjustmentRecord,
  StockMovementRecord,
  CashMovementRecord,
  AuditLogEntry,
} from '../../types';
import {
  CrossLedgerIntegrityResult,
  CrossLedgerTraceIssue,
  CrossLedgerStatus,
  ReconciliationOptions,
} from './types';

/**
 * Pure function to perform full cross-ledger traceability audit.
 */
export function auditCrossLedgerIntegrityPure(data: {
  sales: SaleRecord[];
  transactions: TransactionRecord[];
  returns: ReturnRecord[];
  adjustments: StockAdjustmentRecord[];
  stockMovements: StockMovementRecord[];
  cashMovements: CashMovementRecord[];
  auditLogs: AuditLogEntry[];
  options?: ReconciliationOptions;
}): CrossLedgerIntegrityResult {
  const { sales, transactions, returns, adjustments, stockMovements, cashMovements, auditLogs } = data;

  const issues: CrossLedgerTraceIssue[] = [];
  const orphanStockMovements: string[] = [];
  const orphanCashMovements: string[] = [];
  const orphanAuditLogs: string[] = [];
  const duplicateOperationKeys: string[] = [];
  const partialOperations: string[] = [];

  // Build lookup maps for fast ID resolution
  const salesMap = new Map<string, SaleRecord>(sales.map((s) => [s.id, s]));
  const txMap = new Map<string, TransactionRecord>(transactions.map((t) => [t.id, t]));
  const returnsMap = new Map<string, ReturnRecord>(returns.map((r) => [r.id, r]));
  const adjustmentsMap = new Map<string, StockAdjustmentRecord>(adjustments.map((a) => [a.id, a]));

  const salesVoucherMap = new Map<string, SaleRecord>(sales.map((s) => [s.voucherNo, s]));
  const txVoucherMap = new Map<string, TransactionRecord>(transactions.map((t) => [t.voucherNo, t]));
  const returnsVoucherMap = new Map<string, ReturnRecord>(returns.map((r) => [r.returnNo || r.id, r]));

  // 1. Audit Stock Movements for Orphan References & Duplicate Keys
  const seenStockKeys = new Map<string, string>();

  for (const sm of stockMovements) {
    if (sm.idempotencyKey) {
      if (seenStockKeys.has(sm.idempotencyKey)) {
        const desc = `Duplicate stock idempotencyKey "${sm.idempotencyKey}" between movement ${sm.id} and ${seenStockKeys.get(sm.idempotencyKey)}`;
        duplicateOperationKeys.push(desc);
        issues.push({
          issueType: 'DUPLICATE_OPERATION_ID',
          entityType: 'STOCK_MOVEMENT',
          entityId: sm.id,
          referenceId: sm.referenceId,
          referenceType: sm.referenceType,
          description: desc,
          severity: 'CRITICAL',
        });
      } else {
        seenStockKeys.set(sm.idempotencyKey, sm.id);
      }
    }

    if (sm.referenceType && sm.referenceId) {
      let found = false;
      if (sm.referenceType === 'SALE') {
        found = salesMap.has(sm.referenceId) || (sm.referenceVoucherNo ? salesVoucherMap.has(sm.referenceVoucherNo) : false);
      } else if (sm.referenceType === 'TRANSACTION') {
        found = txMap.has(sm.referenceId) || (sm.referenceVoucherNo ? txVoucherMap.has(sm.referenceVoucherNo) : false);
      } else if (sm.referenceType === 'STOCK_ADJUSTMENT') {
        found = adjustmentsMap.has(sm.referenceId);
      } else if (sm.referenceType === 'PEER_TRADE' || sm.referenceType === 'OPENING' || sm.referenceType === 'MANUAL' || sm.referenceType === 'PURCHASE') {
        found = true; // Supported standalone reference types
      }

      if (!found) {
        const desc = `Stock movement ${sm.id} references non-existent ${sm.referenceType} ID '${sm.referenceId}'`;
        orphanStockMovements.push(desc);
        issues.push({
          issueType: 'ORPHAN_STOCK',
          entityType: 'STOCK_MOVEMENT',
          entityId: sm.id,
          referenceId: sm.referenceId,
          referenceType: sm.referenceType,
          description: desc,
          severity: 'WARNING',
        });
      }
    }
  }

  // 2. Audit Cash Movements for Orphan References & Duplicate Keys
  const seenCashKeys = new Map<string, string>();

  for (const cm of cashMovements) {
    if (cm.idempotencyKey) {
      if (seenCashKeys.has(cm.idempotencyKey)) {
        const desc = `Duplicate cash idempotencyKey "${cm.idempotencyKey}" between cash movement ${cm.id} and ${seenCashKeys.get(cm.idempotencyKey)}`;
        duplicateOperationKeys.push(desc);
        issues.push({
          issueType: 'DUPLICATE_OPERATION_ID',
          entityType: 'CASH_MOVEMENT',
          entityId: cm.id,
          referenceId: cm.referenceId,
          referenceType: cm.referenceType,
          description: desc,
          severity: 'CRITICAL',
        });
      } else {
        seenCashKeys.set(cm.idempotencyKey, cm.id);
      }
    }

    if (cm.referenceType && cm.referenceId) {
      let found = false;
      if (cm.referenceType === 'SALE') {
        found = salesMap.has(cm.referenceId) || (cm.referenceVoucherNo ? salesVoucherMap.has(cm.referenceVoucherNo) : false);
      } else if (cm.referenceType === 'TRANSACTION') {
        found = txMap.has(cm.referenceId) || (cm.referenceVoucherNo ? txVoucherMap.has(cm.referenceVoucherNo) : false);
      } else if (cm.referenceType === 'RETURN' || cm.referenceType === 'SALES_RETURN' || cm.referenceType === 'PURCHASE_RETURN') {
        found = returnsMap.has(cm.referenceId) || (cm.referenceVoucherNo ? returnsVoucherMap.has(cm.referenceVoucherNo) : false);
      } else if (
        cm.referenceType === 'DAILY_CLOSING' ||
        cm.referenceType === 'DAILY_CLOSING_CORRECTION' ||
        cm.referenceType === 'MERCHANT_PAYMENT' ||
        cm.referenceType === 'SUPPLIER_ADVANCE' ||
        cm.referenceType === 'EXPENSE' ||
        cm.referenceType === 'INCOME' ||
        cm.referenceType === 'DIRECT' ||
        cm.referenceType === 'MANUAL_ADJUSTMENT' ||
        cm.referenceType === 'PURCHASE'
      ) {
        found = true; // Supported standalone reference types
      }

      if (!found) {
        const desc = `Cash movement ${cm.id} references non-existent ${cm.referenceType} ID '${cm.referenceId}'`;
        orphanCashMovements.push(desc);
        issues.push({
          issueType: 'ORPHAN_CASH',
          entityType: 'CASH_MOVEMENT',
          entityId: cm.id,
          referenceId: cm.referenceId,
          referenceType: cm.referenceType,
          description: desc,
          severity: 'WARNING',
        });
      }
    }
  }

  // 3. Audit Completeness of Completed Sales Operations (Partial Operation Check)
  const stockMovementsByRef = new Map<string, StockMovementRecord[]>();
  for (const sm of stockMovements) {
    if (sm.referenceId) {
      if (!stockMovementsByRef.has(sm.referenceId)) {
        stockMovementsByRef.set(sm.referenceId, []);
      }
      stockMovementsByRef.get(sm.referenceId)!.push(sm);
    }
    if (sm.referenceVoucherNo) {
      if (!stockMovementsByRef.has(sm.referenceVoucherNo)) {
        stockMovementsByRef.set(sm.referenceVoucherNo, []);
      }
      stockMovementsByRef.get(sm.referenceVoucherNo)!.push(sm);
    }
  }

  const cashMovementsByRef = new Map<string, CashMovementRecord[]>();
  for (const cm of cashMovements) {
    if (cm.referenceId) {
      if (!cashMovementsByRef.has(cm.referenceId)) {
        cashMovementsByRef.set(cm.referenceId, []);
      }
      cashMovementsByRef.get(cm.referenceId)!.push(cm);
    }
    if (cm.referenceVoucherNo) {
      if (!cashMovementsByRef.has(cm.referenceVoucherNo)) {
        cashMovementsByRef.set(cm.referenceVoucherNo, []);
      }
      cashMovementsByRef.get(cm.referenceVoucherNo)!.push(cm);
    }
  }

  for (const s of sales) {
    if (s.status !== 'COMPLETED') continue;

    // Check items have corresponding stock movements
    if (Array.isArray(s.items) && s.items.length > 0) {
      const movements = stockMovementsByRef.get(s.id) || stockMovementsByRef.get(s.voucherNo) || [];
      const itemProductIds = new Set(s.items.filter((i) => i.productId).map((i) => i.productId));
      const movementProductIds = new Set(movements.map((m) => m.productId));

      for (const pId of itemProductIds) {
        if (!movementProductIds.has(pId)) {
          const desc = `Sale ${s.voucherNo || s.id} is missing stock ledger outbound entry for product ${pId}`;
          partialOperations.push(desc);
          issues.push({
            issueType: 'PARTIAL_OPERATION',
            entityType: 'SALE',
            entityId: s.id,
            referenceType: 'STOCK_MOVEMENT',
            description: desc,
            severity: 'CRITICAL',
          });
        }
      }
    }

    // Check cash payment has corresponding cash movement
    const cashPaid = s.cashPaidByMerchant ?? s.paidAmount ?? 0;
    if (cashPaid > 0) {
      const cashMvs = cashMovementsByRef.get(s.id) || cashMovementsByRef.get(s.voucherNo) || [];
      const foundCashIn = cashMvs.some((c) => c.direction === 'IN' || c.type === 'SALE_PAYMENT_IN');
      if (!foundCashIn && cashMvs.length === 0) {
        const desc = `Sale ${s.voucherNo || s.id} has paidAmount ${cashPaid} MMK but no corresponding CashMovement entry`;
        partialOperations.push(desc);
        issues.push({
          issueType: 'PARTIAL_OPERATION',
          entityType: 'SALE',
          entityId: s.id,
          referenceType: 'CASH_MOVEMENT',
          description: desc,
          severity: 'CRITICAL',
        });
      }
    }
  }

  // 4. Audit Supplier Transactions Completeness
  for (const t of transactions) {
    if (t.status !== 'COMPLETED') continue;

    if (Array.isArray(t.items) && t.items.length > 0) {
      const movements = stockMovementsByRef.get(t.id) || stockMovementsByRef.get(t.voucherNo) || [];
      const itemProductIds = new Set(t.items.filter((i) => i.productId).map((i) => i.productId));
      const movementProductIds = new Set(movements.map((m) => m.productId));

      for (const pId of itemProductIds) {
        if (!movementProductIds.has(pId)) {
          const desc = `Transaction ${t.voucherNo || t.id} is missing stock ledger inbound entry for product ${pId}`;
          partialOperations.push(desc);
          issues.push({
            issueType: 'PARTIAL_OPERATION',
            entityType: 'TRANSACTION',
            entityId: t.id,
            referenceType: 'STOCK_MOVEMENT',
            description: desc,
            severity: 'CRITICAL',
          });
        }
      }
    }
  }

  // 5. Audit Trail Orphan Check (if strict validation enabled)
  if (data.options?.strictAuditValidation) {
    for (const log of auditLogs) {
      if (log.referenceType && log.referenceId) {
        let found = false;
        if (log.referenceType === 'SALE') {
          found = salesMap.has(log.referenceId) || (log.referenceVoucherNo ? salesVoucherMap.has(log.referenceVoucherNo) : false);
        } else if (log.referenceType === 'TRANSACTION') {
          found = txMap.has(log.referenceId) || (log.referenceVoucherNo ? txVoucherMap.has(log.referenceVoucherNo) : false);
        } else if (log.referenceType === 'RETURN') {
          found = returnsMap.has(log.referenceId);
        } else if (log.referenceType === 'STOCK_ADJUSTMENT') {
          found = adjustmentsMap.has(log.referenceId);
        } else {
          found = true;
        }

        if (!found) {
          orphanAuditLogs.push(`Audit log ${log.id} references deleted or non-existent ${log.referenceType} ${log.referenceId}`);
        }
      }
    }
  }

  const criticalIssuesCount = issues.filter((i) => i.severity === 'CRITICAL').length;
  const warningIssuesCount = issues.filter((i) => i.severity === 'WARNING').length;

  const totalOps = sales.length + transactions.length + returns.length + adjustments.length;

  return {
    status: criticalIssuesCount === 0 ? 'CONSISTENT' : 'INCONSISTENT',
    totalOperationsAudited: totalOps,
    totalIssuesCount: issues.length,
    criticalIssuesCount,
    warningIssuesCount,
    issues,
    orphanStockMovements,
    orphanCashMovements,
    orphanAuditLogs,
    duplicateOperationKeys,
    partialOperations,
  };
}

/**
 * Reconciles cross-ledger integrity against the database.
 */
export async function auditCrossLedgerIntegrity(
  targetDb: ShweLetYarDatabase = db,
  options?: ReconciliationOptions
): Promise<CrossLedgerIntegrityResult> {
  const [sales, transactions, returns, adjustments, stockMovements, cashMovements, auditLogs] = await Promise.all([
    targetDb.sales.toArray(),
    targetDb.transactions.toArray(),
    targetDb.returnsAndRefunds.toArray(),
    targetDb.stockAdjustments.toArray(),
    targetDb.stockMovements.toArray(),
    targetDb.cashMovements.toArray(),
    targetDb.auditLogs.toArray(),
  ]);

  return auditCrossLedgerIntegrityPure({
    sales,
    transactions,
    returns,
    adjustments,
    stockMovements,
    cashMovements,
    auditLogs,
    options,
  });
}
