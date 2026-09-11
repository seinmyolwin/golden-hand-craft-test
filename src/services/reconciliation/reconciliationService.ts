/**
 * Shwe Let Yar - Master Financial & Data Reconciliation Service
 * Phase 18 Implementation
 *
 * Orchestrates all domain-specific reconciliation audits:
 *   1. Stock Ledger vs Current Inventory
 *   2. Cash Ledger vs Daily Closings
 *   3. Merchant Receivables vs Sales Ledger
 *   4. Supplier Advances vs Inbound Transactions
 *   5. Cross-Ledger Operational Traceability
 *   6. Immutable Audit Trail Completeness
 *
 * SSoT Read-Only Engine. Strict Zero Data Mutation.
 */

import { db, ShweLetYarDatabase } from '../../db/database';
import {
  ReconciliationReport,
  ReconciliationOptions,
  OverallReconciliationStatus,
} from './types';
import { reconcileAllStock } from './stockReconciliationService';
import { reconcileAllCash } from './cashReconciliationService';
import { reconcileAllMerchants } from './merchantReconciliationService';
import { reconcileAllSuppliers } from './supplierReconciliationService';
import { auditCrossLedgerIntegrity } from './crossLedgerIntegrityService';

/**
 * Generates an end-to-end Comprehensive Financial & Data Integrity Reconciliation Report.
 */
export async function generateReconciliationReport(
  targetDb: ShweLetYarDatabase = db,
  options?: ReconciliationOptions
): Promise<ReconciliationReport> {
  const [stockResult, cashResult, merchantResult, supplierResult, crossLedgerResult, auditLogs] =
    await Promise.all([
      reconcileAllStock(targetDb, options),
      reconcileAllCash(targetDb, options),
      reconcileAllMerchants(targetDb, options),
      reconcileAllSuppliers(targetDb, options),
      auditCrossLedgerIntegrity(targetDb, options),
      targetDb.auditLogs.toArray(),
    ]);

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Stock Issues
  if (stockResult.mismatchedCount > 0) {
    errors.push(
      `Stock Reconciliation: ${stockResult.mismatchedCount} product(s) have inventory discrepancies between currentStock and movement ledger.`
    );
  }
  if (stockResult.invalidMovementsCount > 0) {
    errors.push(
      `Stock Reconciliation: ${stockResult.invalidMovementsCount} invalid movement record(s) detected.`
    );
  }

  // 2. Cash Issues
  if (cashResult.mismatchedDaysCount > 0) {
    errors.push(
      `Cash Reconciliation: ${cashResult.mismatchedDaysCount} day(s) have cash discrepancies or closing mismatches.`
    );
  }
  if (cashResult.duplicateMovements.length > 0) {
    errors.push(
      `Cash Reconciliation: ${cashResult.duplicateMovements.length} duplicate cash movement(s) detected.`
    );
  }
  if (cashResult.missingClosingsCount > 0) {
    warnings.push(
      `Cash Reconciliation: ${cashResult.missingClosingsCount} past day(s) had transactions but were never closed.`
    );
  }

  // 3. Merchant Receivables Issues
  if (merchantResult.mismatchedCount > 0) {
    errors.push(
      `Merchant Reconciliation: ${merchantResult.mismatchedCount} merchant(s) have receivable balance discrepancies.`
    );
  }

  // 4. Supplier Advances Issues
  if (supplierResult.mismatchedCount > 0) {
    errors.push(
      `Supplier Reconciliation: ${supplierResult.mismatchedCount} supplier(s) have advance balance discrepancies.`
    );
  }

  // 5. Cross-Ledger Issues
  if (crossLedgerResult.criticalIssuesCount > 0) {
    errors.push(
      `Cross-Ledger Integrity: ${crossLedgerResult.criticalIssuesCount} critical multi-entry linkage failure(s) found (partial operations, duplicate keys).`
    );
  }
  if (crossLedgerResult.warningIssuesCount > 0) {
    warnings.push(
      `Cross-Ledger Integrity: ${crossLedgerResult.warningIssuesCount} reference warnings detected (e.g. orphan entries).`
    );
  }

  // Determine Overall Status
  let overallStatus: OverallReconciliationStatus = 'HEALTHY';
  if (errors.length > 0 || crossLedgerResult.criticalIssuesCount > 0) {
    overallStatus = 'CRITICAL';
  } else if (warnings.length > 0) {
    overallStatus = 'WARNING';
  }

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    stock: stockResult,
    cash: cashResult,
    merchants: merchantResult,
    suppliers: supplierResult,
    crossLedger: crossLedgerResult,
    audit: {
      totalAuditLogs: auditLogs.length,
      traceableLogsCount: auditLogs.length - crossLedgerResult.orphanAuditLogs.length,
      orphanLogsCount: crossLedgerResult.orphanAuditLogs.length,
      integrityCheckPassed: overallStatus !== 'CRITICAL',
    },
    errors,
    warnings,
  };
}
