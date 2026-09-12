/**
 * Shwe Let Yar - Ledger Integrity & Reconciliation Service
 * Phase 18D Implementation
 *
 * Provides read-only Owner-level ledger verification, orphan/duplicate detection,
 * cross-ledger cash/stock consistency checking, and pure movement-derived financial positioning.
 */

import { db } from '../db/database';
import { enforcePermission } from './authorizationService';
import {
  StockMovementRecord,
  CashMovementRecord,
  SaleRecord,
  TransactionRecord,
  MerchantPurchaseRecord,
  ReturnRecord,
} from '../types';

export interface OrphanStockMovementReport {
  movement: StockMovementRecord;
  reason: string;
}

export interface OrphanCashMovementReport {
  movement: CashMovementRecord;
  reason: string;
}

export interface DuplicateStockMovementReport {
  key: string;
  movements: StockMovementRecord[];
  reason: string;
}

export interface DuplicateCashMovementReport {
  key: string;
  movements: CashMovementRecord[];
  reason: string;
}

export interface CrossLedgerMismatch {
  documentType: 'SALE' | 'TRANSACTION' | 'PURCHASE' | 'RETURN';
  documentId: string;
  voucherNo?: string;
  expectedAmount: number;
  expectedDirection: 'IN' | 'OUT';
  foundAmount?: number;
  foundDirection?: 'IN' | 'OUT';
  issue: 'MISSING_CASH_MOVEMENT' | 'AMOUNT_MISMATCH' | 'DIRECTION_MISMATCH';
  details: string;
}

export interface LedgerIntegrityReport {
  orphanStockMovements: OrphanStockMovementReport[];
  orphanCashMovements: OrphanCashMovementReport[];
  duplicateStockMovements: DuplicateStockMovementReport[];
  duplicateCashMovements: DuplicateCashMovementReport[];
  crossLedgerMismatches: CrossLedgerMismatch[];
  summary: {
    totalOrphanStockMovements: number;
    totalOrphanCashMovements: number;
    totalDuplicateStockMovements: number;
    totalDuplicateCashMovements: number;
    totalCrossLedgerMismatches: number;
    totalIssues: number;
    isClean: boolean;
  };
  generatedAt: string;
}

export interface ProductFinancialPosition {
  productId: string;
  productName: string;
  totalInQuantity: number;
  totalOutQuantity: number;
  netQuantity: number;
  unitPrice: number;
  totalValue: number;
}

export interface FinancialPositionReport {
  totalStockQuantity: number;
  totalStockValue: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashBalance: number;
  totalReceivables: number;
  totalPayables: number;
  netFinancialPosition: number;
  productPositions: ProductFinancialPosition[];
  generatedAt: string;
}

/**
 * Audit and reconcile ledger integrity without altering data (Read-Only).
 * Detects orphan movements, duplicate entries, and cross-ledger discrepancies.
 */
export async function reconcileLedgerIntegrity(): Promise<LedgerIntegrityReport> {
  await enforcePermission(
    'ACCESS_AUDIT_HISTORY',
    'စာရင်းများ ကိုက်ညီမှန်ကန်မှု စစ်ဆေးခြင်း (Ledger Integrity Reconciliation)'
  );

  const [
    stockMovements,
    cashMovements,
    sales,
    transactions,
    merchantPurchases,
    peerTrades,
    stockAdjustments,
    returnsAndRefunds,
    merchants,
    suppliers,
  ] = await Promise.all([
    db.stockMovements.toArray(),
    db.cashMovements.toArray(),
    db.sales.toArray(),
    db.transactions.toArray(),
    db.merchantPurchases.toArray(),
    db.peerTrades.toArray(),
    db.stockAdjustments.toArray(),
    db.returnsAndRefunds.toArray(),
    db.merchants.toArray(),
    db.suppliers.toArray(),
  ]);

  const saleIds = new Set(sales.map((s) => s.id));
  const txIds = new Set(transactions.map((t) => t.id));
  const purchaseIds = new Set(merchantPurchases.map((p) => p.id));
  const peerTradeIds = new Set(peerTrades.map((pt) => pt.id));
  const adjIds = new Set(stockAdjustments.map((a) => a.id));
  const returnIds = new Set(returnsAndRefunds.map((r) => r.id));
  const merchantIds = new Set(merchants.map((m) => m.id));
  const supplierIds = new Set(suppliers.map((s) => s.id));

  // 1. Detect Orphan Stock Movements
  const orphanStockMovements: OrphanStockMovementReport[] = [];
  for (const m of stockMovements) {
    if (m.status === 'CANCELLED') continue;
    const refType = m.referenceType;
    const refId = m.referenceId;

    if (!refId || refType === 'OPENING' || refType === 'MANUAL') continue;

    let isOrphan = false;
    let targetType = '';

    if (refType === 'SALE' && !saleIds.has(refId)) {
      isOrphan = true;
      targetType = 'Sales Voucher (sales)';
    } else if (refType === 'PURCHASE' && !purchaseIds.has(refId)) {
      isOrphan = true;
      targetType = 'Merchant Purchase (merchantPurchases)';
    } else if (refType === 'TRANSACTION' && !txIds.has(refId)) {
      isOrphan = true;
      targetType = 'Supplier Transaction (transactions)';
    } else if (refType === 'PEER_TRADE' && !peerTradeIds.has(refId)) {
      isOrphan = true;
      targetType = 'Peer Trade (peerTrades)';
    } else if (refType === 'STOCK_ADJUSTMENT' && !adjIds.has(refId)) {
      isOrphan = true;
      targetType = 'Stock Adjustment (stockAdjustments)';
    } else if (
      ((refType as string) === 'RETURN' || (refType as string) === 'SALES_RETURN' || (refType as string) === 'PURCHASE_RETURN') &&
      !returnIds.has(refId)
    ) {
      isOrphan = true;
      targetType = 'Return Record (returnsAndRefunds)';
    }

    if (isOrphan) {
      orphanStockMovements.push({
        movement: m,
        reason: `မရှိတော့သော သို့မဟုတ် ပျက်စီးနေသော ${targetType} referenceId (${refId}) သို့ ညွှန်းဆိုထားပါသည်`,
      });
    }
  }

  // 2. Detect Orphan Cash Movements
  const orphanCashMovements: OrphanCashMovementReport[] = [];
  for (const m of cashMovements) {
    if (m.status === 'CANCELLED') continue;
    const refType = m.referenceType;
    const refId = m.referenceId;

    if (
      !refId ||
      refType === 'OPENING' ||
      refType === 'MANUAL_ADJUSTMENT' ||
      refType === 'DIRECT' ||
      refType === 'DAILY_CLOSING' ||
      refType === 'DAILY_CLOSING_CORRECTION'
    ) {
      continue;
    }

    let isOrphan = false;
    let targetType = '';

    if (refType === 'SALE' && !saleIds.has(refId)) {
      isOrphan = true;
      targetType = 'Sales Voucher (sales)';
    } else if (refType === 'PURCHASE' && !purchaseIds.has(refId)) {
      isOrphan = true;
      targetType = 'Merchant Purchase (merchantPurchases)';
    } else if (refType === 'TRANSACTION' && !txIds.has(refId)) {
      isOrphan = true;
      targetType = 'Supplier Transaction (transactions)';
    } else if (refType === 'MERCHANT_PAYMENT' && !merchantIds.has(refId) && !saleIds.has(refId)) {
      isOrphan = true;
      targetType = 'Merchant Account or Sale (merchants / sales)';
    } else if (refType === 'SUPPLIER_ADVANCE' && !supplierIds.has(refId) && !txIds.has(refId)) {
      isOrphan = true;
      targetType = 'Supplier Account or Transaction (suppliers / transactions)';
    } else if ((refType === 'RETURN' || refType === 'SALES_RETURN' || refType === 'PURCHASE_RETURN') && !returnIds.has(refId)) {
      isOrphan = true;
      targetType = 'Return Record (returnsAndRefunds)';
    }

    if (isOrphan) {
      orphanCashMovements.push({
        movement: m,
        reason: `မရှိတော့သော သို့မဟုတ် ပျက်စီးနေသော ${targetType} referenceId (${refId}) သို့ ညွှန်းဆိုထားပါသည်`,
      });
    }
  }

  // 3. Detect Duplicate Stock Movements
  const duplicateStockMovements: DuplicateStockMovementReport[] = [];
  const stockByToken = new Map<string, StockMovementRecord[]>();
  const stockByTuple = new Map<string, StockMovementRecord[]>();

  for (const m of stockMovements) {
    if (m.status === 'CANCELLED') continue;

    if (m.idempotencyKey) {
      const list = stockByToken.get(m.idempotencyKey) || [];
      list.push(m);
      stockByToken.set(m.idempotencyKey, list);
    }

    if (m.referenceId && m.productId) {
      const tupleKey = `${m.referenceId}_${m.referenceType}_${m.movementType}_${m.productId}`;
      const list = stockByTuple.get(tupleKey) || [];
      list.push(m);
      stockByTuple.set(tupleKey, list);
    }
  }

  const processedStockKeys = new Set<string>();

  for (const [key, list] of stockByToken.entries()) {
    if (list.length > 1) {
      duplicateStockMovements.push({
        key,
        movements: list,
        reason: `တူညီသော idempotencyKey (${key}) ဖြင့် ကုန်ပစ္စည်းလှုပ်ရှားမှု ${list.length} ခု ထပ်နေပါသည်`,
      });
      processedStockKeys.add(key);
    }
  }

  for (const [key, list] of stockByTuple.entries()) {
    if (list.length > 1) {
      // Check if any of these were already flagged by token
      const hasFlagged = list.some((m) => m.idempotencyKey && processedStockKeys.has(m.idempotencyKey));
      if (!hasFlagged) {
        duplicateStockMovements.push({
          key,
          movements: list,
          reason: `တူညီသော reference + product tuple (${key}) ဖြင့် ကုန်ပစ္စည်းလှုပ်ရှားမှု ${list.length} ခု ထပ်နေပါသည်`,
        });
      }
    }
  }

  // 4. Detect Duplicate Cash Movements
  const duplicateCashMovements: DuplicateCashMovementReport[] = [];
  const cashByToken = new Map<string, CashMovementRecord[]>();
  const cashByTuple = new Map<string, CashMovementRecord[]>();

  for (const m of cashMovements) {
    if (m.status === 'CANCELLED') continue;

    if (m.idempotencyKey) {
      const list = cashByToken.get(m.idempotencyKey) || [];
      list.push(m);
      cashByToken.set(m.idempotencyKey, list);
    }

    if (m.referenceId && m.type) {
      const tupleKey = `${m.referenceId}_${m.referenceType}_${m.type}`;
      const list = cashByTuple.get(tupleKey) || [];
      list.push(m);
      cashByTuple.set(tupleKey, list);
    }
  }

  const processedCashKeys = new Set<string>();

  for (const [key, list] of cashByToken.entries()) {
    if (list.length > 1) {
      duplicateCashMovements.push({
        key,
        movements: list,
        reason: `တူညီသော idempotencyKey (${key}) ဖြင့် ငွေသားလှုပ်ရှားမှု ${list.length} ခု ထပ်နေပါသည်`,
      });
      processedCashKeys.add(key);
    }
  }

  for (const [key, list] of cashByTuple.entries()) {
    if (list.length > 1) {
      const hasFlagged = list.some((m) => m.idempotencyKey && processedCashKeys.has(m.idempotencyKey));
      if (!hasFlagged) {
        duplicateCashMovements.push({
          key,
          movements: list,
          reason: `တူညီသော reference + type tuple (${key}) ဖြင့် ငွေသားလှုပ်ရှားမှု ${list.length} ခု ထပ်နေပါသည်`,
        });
      }
    }
  }

  // 5. Cross-Ledger Consistency Check (Sales / Transactions / Purchases / Returns)
  const crossLedgerMismatches: CrossLedgerMismatch[] = [];

  // 5a. Sales vs Cash
  for (const sale of sales) {
    if (sale.status === 'CANCELLED') continue;
    const expectedCash = sale.cashPaidByMerchant ?? sale.paidAmount ?? 0;
    if (expectedCash <= 0) continue;

    const matchingCashMoves = cashMovements.filter(
      (c) =>
        c.status !== 'CANCELLED' &&
        (c.referenceId === sale.id || (c.referenceVoucherNo && c.referenceVoucherNo === sale.voucherNo))
    );

    if (matchingCashMoves.length === 0) {
      crossLedgerMismatches.push({
        documentType: 'SALE',
        documentId: sale.id,
        voucherNo: sale.voucherNo,
        expectedAmount: expectedCash,
        expectedDirection: 'IN',
        issue: 'MISSING_CASH_MOVEMENT',
        details: `အရောင်းဘောင်ချာ (${sale.voucherNo}) အတွက် ပေးငွေ ${expectedCash} ကျပ် ရှိသော်လည်း ငွေသားမှတ်တမ်း မရှိပါ`,
      });
      continue;
    }

    const foundAmount = matchingCashMoves.reduce((acc, c) => acc + c.amount, 0);
    const hasWrongDir = matchingCashMoves.some((c) => c.direction !== 'IN');

    if (foundAmount !== expectedCash) {
      crossLedgerMismatches.push({
        documentType: 'SALE',
        documentId: sale.id,
        voucherNo: sale.voucherNo,
        expectedAmount: expectedCash,
        expectedDirection: 'IN',
        foundAmount,
        foundDirection: matchingCashMoves[0]?.direction || 'IN',
        issue: 'AMOUNT_MISMATCH',
        details: `အရောင်းဘောင်ချာ (${sale.voucherNo}) ၏ ပေးငွေ (${expectedCash}) နှင့် ငွေသားမှတ်တမ်းပမာဏ (${foundAmount}) မကိုက်ညီပါ`,
      });
    } else if (hasWrongDir) {
      crossLedgerMismatches.push({
        documentType: 'SALE',
        documentId: sale.id,
        voucherNo: sale.voucherNo,
        expectedAmount: expectedCash,
        expectedDirection: 'IN',
        foundAmount,
        foundDirection: matchingCashMoves[0]?.direction,
        issue: 'DIRECTION_MISMATCH',
        details: `အရောင်းဘောင်ချာ (${sale.voucherNo}) အတွက် ငွေသားဝင်ရမည် (IN) ဖြစ်သော်လည်း လမ်းကြောင်းမှားယွင်းနေပါသည်`,
      });
    }
  }

  // 5b. Supplier Transactions vs Cash
  for (const tx of transactions) {
    if (tx.status === 'CANCELLED') continue;
    const expectedCash = tx.paidAmount || 0;
    if (expectedCash <= 0) continue;

    const matchingCashMoves = cashMovements.filter(
      (c) =>
        c.status !== 'CANCELLED' &&
        (c.referenceId === tx.id || (c.referenceVoucherNo && c.referenceVoucherNo === tx.voucherNo))
    );

    if (matchingCashMoves.length === 0) {
      crossLedgerMismatches.push({
        documentType: 'TRANSACTION',
        documentId: tx.id,
        voucherNo: tx.voucherNo,
        expectedAmount: expectedCash,
        expectedDirection: 'OUT',
        issue: 'MISSING_CASH_MOVEMENT',
        details: `ကုန်ဝယ်စာရင်း (${tx.voucherNo}) အတွက် ပေးငွေ ${expectedCash} ကျပ် ရှိသော်လည်း ငွေသားမှတ်တမ်း မရှိပါ`,
      });
      continue;
    }

    const foundAmount = matchingCashMoves.reduce((acc, c) => acc + c.amount, 0);
    const hasWrongDir = matchingCashMoves.some((c) => c.direction !== 'OUT');

    if (foundAmount !== expectedCash) {
      crossLedgerMismatches.push({
        documentType: 'TRANSACTION',
        documentId: tx.id,
        voucherNo: tx.voucherNo,
        expectedAmount: expectedCash,
        expectedDirection: 'OUT',
        foundAmount,
        foundDirection: matchingCashMoves[0]?.direction || 'OUT',
        issue: 'AMOUNT_MISMATCH',
        details: `ကုန်ဝယ်စာရင်း (${tx.voucherNo}) ၏ ပေးငွေ (${expectedCash}) နှင့် ငွေသားမှတ်တမ်းပမာဏ (${foundAmount}) မကိုက်ညီပါ`,
      });
    } else if (hasWrongDir) {
      crossLedgerMismatches.push({
        documentType: 'TRANSACTION',
        documentId: tx.id,
        voucherNo: tx.voucherNo,
        expectedAmount: expectedCash,
        expectedDirection: 'OUT',
        foundAmount,
        foundDirection: matchingCashMoves[0]?.direction,
        issue: 'DIRECTION_MISMATCH',
        details: `ကုန်ဝယ်စာရင်း (${tx.voucherNo}) အတွက် ငွေသားထွက်ရမည် (OUT) ဖြစ်သော်လည်း လမ်းကြောင်းမှားယွင်းနေပါသည်`,
      });
    }
  }

  // 5c. Merchant Purchases vs Cash
  for (const pur of merchantPurchases) {
    if (pur.status === 'CANCELLED') continue;
    const expectedCash = pur.paidAmount || 0;
    if (expectedCash <= 0) continue;

    const purVoucherNo = pur.purchaseNo || pur.id;

    const matchingCashMoves = cashMovements.filter(
      (c) =>
        c.status !== 'CANCELLED' &&
        (c.referenceId === pur.id || (c.referenceVoucherNo && c.referenceVoucherNo === purVoucherNo))
    );

    if (matchingCashMoves.length === 0) {
      crossLedgerMismatches.push({
        documentType: 'PURCHASE',
        documentId: pur.id,
        voucherNo: purVoucherNo,
        expectedAmount: expectedCash,
        expectedDirection: 'OUT',
        issue: 'MISSING_CASH_MOVEMENT',
        details: `ကုန်သည်ဝယ်ယူမှု (${purVoucherNo}) အတွက် ပေးငွေ ${expectedCash} ကျပ် ရှိသော်လည်း ငွေသားမှတ်တမ်း မရှိပါ`,
      });
    }
  }

  const totalOrphanStockMovements = orphanStockMovements.length;
  const totalOrphanCashMovements = orphanCashMovements.length;
  const totalDuplicateStockMovements = duplicateStockMovements.length;
  const totalDuplicateCashMovements = duplicateCashMovements.length;
  const totalCrossLedgerMismatches = crossLedgerMismatches.length;
  const totalIssues =
    totalOrphanStockMovements +
    totalOrphanCashMovements +
    totalDuplicateStockMovements +
    totalDuplicateCashMovements +
    totalCrossLedgerMismatches;

  return {
    orphanStockMovements,
    orphanCashMovements,
    duplicateStockMovements,
    duplicateCashMovements,
    crossLedgerMismatches,
    summary: {
      totalOrphanStockMovements,
      totalOrphanCashMovements,
      totalDuplicateStockMovements,
      totalDuplicateCashMovements,
      totalCrossLedgerMismatches,
      totalIssues,
      isClean: totalIssues === 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Derives current financial position directly from underlying movement logs and primary documents.
 * Must NOT read from any pre-summed counter fields in products or settings.
 */
export async function getCurrentFinancialPosition(): Promise<FinancialPositionReport> {
  await enforcePermission(
    'ACCESS_AUDIT_HISTORY',
    'လက်ရှိ ဘဏ္ဍာရေးနှင့် ကုန်ပစ္စည်းအခြေအနေ တွက်ချက်ခြင်း (Financial Position Derivation)'
  );

  const [stockMovements, cashMovements, sales, transactions, merchantPurchases, products] =
    await Promise.all([
      db.stockMovements.toArray(),
      db.cashMovements.toArray(),
      db.sales.toArray(),
      db.transactions.toArray(),
      db.merchantPurchases.toArray(),
      db.products.toArray(),
    ]);

  const productMap = new Map<string, { name: string; price: number }>();
  for (const p of products) {
    productMap.set(p.id, { name: p.name, price: p.defaultPrice || p.defaultWholesalePrice || 0 });
  }

  // 1. Stock Quantities & Valuation derived strictly from stockMovements
  const productStockStats = new Map<
    string,
    { name: string; inQty: number; outQty: number; netQty: number; unitPrice: number }
  >();

  for (const m of stockMovements) {
    if (m.status === 'CANCELLED') continue;
    const pid = m.productId;
    if (!pid) continue;

    const existing = productStockStats.get(pid) || {
      name: m.productName || productMap.get(pid)?.name || 'Unknown Product',
      inQty: 0,
      outQty: 0,
      netQty: 0,
      unitPrice: m.unitPrice || productMap.get(pid)?.price || 0,
    };

    const signed = m.signedQuantity !== undefined ? m.signedQuantity : m.direction === 'IN' ? m.quantity : -m.quantity;

    if (signed > 0) {
      existing.inQty += Math.abs(signed);
    } else {
      existing.outQty += Math.abs(signed);
    }
    existing.netQty += signed;

    if (m.unitPrice && m.unitPrice > 0) {
      existing.unitPrice = m.unitPrice;
    }

    productStockStats.set(pid, existing);
  }

  const productPositions: ProductFinancialPosition[] = [];
  let totalStockQuantity = 0;
  let totalStockValue = 0;

  for (const [pid, stats] of productStockStats.entries()) {
    const totalValue = stats.netQty * stats.unitPrice;
    productPositions.push({
      productId: pid,
      productName: stats.name,
      totalInQuantity: stats.inQty,
      totalOutQuantity: stats.outQty,
      netQuantity: stats.netQty,
      unitPrice: stats.unitPrice,
      totalValue,
    });
    totalStockQuantity += stats.netQty;
    totalStockValue += totalValue;
  }

  // 2. Cash In / Out / Balance derived strictly from cashMovements
  let totalCashIn = 0;
  let totalCashOut = 0;

  for (const c of cashMovements) {
    if (c.status === 'CANCELLED') continue;
    if (c.direction === 'IN') {
      totalCashIn += c.amount;
    } else if (c.direction === 'OUT') {
      totalCashOut += c.amount;
    }
  }

  const netCashBalance = totalCashIn - totalCashOut;

  // 3. Receivables derived from sales minus cash payments
  let totalReceivables = 0;
  for (const s of sales) {
    if (s.status === 'CANCELLED') continue;
    const grandTotal = s.grandTotal ?? s.totalAmount ?? 0;
    const paid = s.cashPaidByMerchant ?? s.paidAmount ?? 0;
    const remaining = Math.max(0, grandTotal - paid);
    totalReceivables += remaining;
  }

  // 4. Payables derived from transactions / purchases minus cash payouts
  let totalPayables = 0;
  for (const t of transactions) {
    if (t.status === 'CANCELLED') continue;
    const docTotal = t.totalAmount ?? t.totalGoodsValue ?? 0;
    const paid = t.paidAmount ?? 0;
    const remaining = Math.max(0, docTotal - paid);
    totalPayables += remaining;
  }

  for (const pur of merchantPurchases) {
    if (pur.status === 'CANCELLED') continue;
    const docTotal = pur.totalAmount ?? 0;
    const paid = pur.paidAmount ?? 0;
    const remaining = Math.max(0, docTotal - paid);
    totalPayables += remaining;
  }

  const netFinancialPosition = netCashBalance + totalStockValue + totalReceivables - totalPayables;

  return {
    totalStockQuantity,
    totalStockValue,
    totalCashIn,
    totalCashOut,
    netCashBalance,
    totalReceivables,
    totalPayables,
    netFinancialPosition,
    productPositions,
    generatedAt: new Date().toISOString(),
  };
}
