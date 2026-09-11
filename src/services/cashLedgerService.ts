/**
 * Shwe Let Yar - Professional Cash Ledger Service
 * Phase 15 Implementation
 *
 * Provides a canonical, immutable cash ledger for offline-first accounting.
 * Features:
 * - Single Source of Truth (SSoT) for all cash inflows and outflows
 * - Strictly deterministic idempotency keys
 * - Signed amounts (+ for Inflows, - for Outflows)
 * - Chronological running balance calculations
 * - Atomic business integration (Sales, Inbounds, Purchases, Expenses)
 * - Non-destructive compensating reversals
 * - UTF-8 BOM Myanmar CSV export
 */

import {
  CashMovementRecord,
  CashMovementType,
  CashReferenceType,
  CashLedgerEntry,
  DailyCashSummary,
  CashLedgerFilterOptions,
  CashLedgerSummary,
  DailyClosingRecord,
  AuditLogEntry,
} from '../types';
import { db, ShweLetYarDatabase } from '../db/database';
import { generateStableId } from '../utils/idGenerator';
import { formatMMK, formatNumberOnly } from '../utils/storage';

/**
 * Myanmar localized labels for cash movement types
 */
export function getCashMovementTypeLabel(type: CashMovementType): string {
  switch (type) {
    case 'OPENING_FLOAT':
      return 'စတင်မတည်ငွေ (Opening Cash Float)';
    case 'SALE_PAYMENT_IN':
      return 'အရောင်းရငွေ (Sale Payment Received)';
    case 'SUPPLIER_PAYOUT':
      return 'ကုန်သိမ်းငွေပေးချေမှု (Supplier Payout)';
    case 'SUPPLIER_ADVANCE_GIVEN':
      return 'အကြိုငွေထုတ်ပေးမှု (Supplier Advance Given)';
    case 'SUPPLIER_REPAYMENT_IN':
      return 'ကြိုတင်ငွေပြန်ဆပ်မှု (Supplier Repayment In)';
    case 'MERCHANT_PURCHASE_PAYOUT':
      return 'ကုန်ကြမ်းဝယ်ငွေပေးချေမှု (Raw Material Purchase)';
    case 'MERCHANT_DEBT_COLLECTION_IN':
      return 'ကုန်သည်ကြွေးဟောင်းဆပ်ငွေ (Merchant Debt Repayment)';
    case 'EXPENSE_PAYOUT':
      return 'ဆိုင်အသုံးစရိတ် (Shop Operating Expense)';
    case 'INCOME_IN':
      return 'အခြားဝင်ငွေ (Other Income)';
    case 'DIRECT_CASH_IN':
      return 'ငွေသားတိုက်ရိုက်သွင်း (Direct Cash Deposit)';
    case 'DIRECT_CASH_OUT':
      return 'ငွေသားတိုက်ရိုက်ထုတ် (Direct Cash Drawing)';
    case 'SALE_CANCELLED_CASH_REVERSAL':
      return 'အရောင်းဖျက်သိမ်းငွေပြန်ထုတ် (Sale Cancelled Cash Refund)';
    case 'TRANSACTION_CANCELLED_CASH_REVERSAL':
      return 'ကုန်သိမ်းဖျက်သိမ်းငွေပြန်ရ (Supplier Inbound Cancelled Cash Recovery)';
    case 'PURCHASE_CANCELLED_CASH_REVERSAL':
      return 'ကုန်ကြမ်းဝယ်ဖျက်သိမ်းငွေပြန်ရ (Purchase Cancelled Cash Recovery)';
    case 'MANUAL_CASH_ADJUSTMENT':
      return 'ငွေစာရင်းချိန်ညှိမှု (Cash Ledger Adjustment)';
    case 'DAILY_CLOSING_CORRECTION':
      return 'နေ့ချုပ်စာရင်းပြင်ဆင်မှု (Daily Closing Correction)';
    case 'SALES_RETURN_REFUND_OUT':
      return 'အရောင်းပြန်အမ်းငွေထုတ် (Sales Return Cash Refund)';
    case 'PURCHASE_RETURN_RECOVERY_IN':
      return 'ဝယ်ယူမှုပြန်အပ်ငွေရ (Purchase Return Cash Recovery)';
    case 'SALES_RETURN_CANCELLED_CASH_REVERSAL':
      return 'အရောင်းပြန်အမ်းဖျက်သိမ်းငွေပြန်သွင်း (Sales Return Cancelled Reversal)';
    case 'PURCHASE_RETURN_CANCELLED_CASH_REVERSAL':
      return 'ဝယ်ပြန်အပ်ဖျက်သိမ်းငွေပြန်ထုတ် (Purchase Return Cancelled Reversal)';
    default:
      return type;
  }
}

/**
 * Myanmar localized labels for cash reference types
 */
export function getCashReferenceTypeLabel(refType: CashReferenceType): string {
  switch (refType) {
    case 'SALE':
      return 'အရောင်းဘောင်ချာ';
    case 'TRANSACTION':
      return 'ကုန်သိမ်းဘောင်ချာ';
    case 'PURCHASE':
      return 'ကုန်ကြမ်းဝယ်ဘောင်ချာ';
    case 'MERCHANT_PAYMENT':
      return 'ကုန်သည်ကြွေးဆပ်';
    case 'SUPPLIER_ADVANCE':
      return 'အကြိုငွေထုတ်ပေးမှု';
    case 'EXPENSE':
      return 'ဆိုင်အသုံးစရိတ်';
    case 'INCOME':
      return 'အခြားဝင်ငွေ';
    case 'DIRECT':
      return 'တိုက်ရိုက်ငွေသွင်း/ထုတ်';
    case 'MANUAL_ADJUSTMENT':
      return 'လက်စွဲစာရင်းချိန်ညှိ';
    case 'DAILY_CLOSING':
      return 'နေ့စဉ်စာရင်းပိတ်';
    case 'DAILY_CLOSING_CORRECTION':
      return 'နေ့ချုပ်ပြင်ဆင်ချက်';
    case 'RETURN':
    case 'SALES_RETURN':
      return 'အရောင်းပြန်လက်ခံဘောင်ချာ';
    case 'PURCHASE_RETURN':
      return 'ဝယ်ယူမှုပြန်အပ်ဘောင်ချာ';
    default:
      return refType;
  }
}

/**
 * Builds deterministic idempotency key for cash transactions
 */
export function buildCashIdempotencyKey(
  type: CashMovementType,
  referenceId: string,
  extraSuffix?: string
): string {
  const cleanType = type.trim().toUpperCase();
  const cleanRef = referenceId.trim();
  const suffix = extraSuffix ? `_${extraSuffix.trim()}` : '';
  return `CASH_${cleanType}_${cleanRef}${suffix}`;
}

/**
 * Calculates full chronological cash ledger with running balances
 */
export function calculateCashLedger(
  allMovements: CashMovementRecord[] = [],
  filterOptions?: CashLedgerFilterOptions,
  openingBalance: number = 0
): CashLedgerSummary {
  // 1. Sort all movements chronologically (date ASC, time ASC, createdAt ASC)
  const sorted = [...allMovements].sort((a, b) => {
    const dateComp = (a.transactionDate || '').localeCompare(b.transactionDate || '');
    if (dateComp !== 0) return dateComp;
    const timeComp = (a.transactionTime || '00:00').localeCompare(b.transactionTime || '00:00');
    if (timeComp !== 0) return timeComp;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  let runningBalance = openingBalance;
  const processedEntries: CashLedgerEntry[] = [];

  for (const mov of sorted) {
    if (mov.status === 'CANCELLED') continue;

    const previousBalance = runningBalance;
    const signedAmount = mov.signedAmount !== undefined
      ? mov.signedAmount
      : mov.direction === 'IN'
      ? Math.abs(mov.amount)
      : -Math.abs(mov.amount);

    runningBalance += signedAmount;

    const dateStr = mov.transactionDate || (mov.createdAt ? mov.createdAt.slice(0, 10) : '');
    const timeStr = mov.transactionTime || (mov.createdAt ? mov.createdAt.slice(11, 16) : '00:00');
    let timestamp = 0;
    try {
      timestamp = new Date(`${dateStr}T${timeStr}:00`).getTime();
    } catch {
      timestamp = Date.now();
    }

    processedEntries.push({
      id: mov.id,
      transactionDate: dateStr,
      transactionTime: timeStr,
      timestamp,
      type: mov.type,
      typeLabelMy: mov.typeLabelMy || getCashMovementTypeLabel(mov.type),
      direction: mov.direction,
      amount: Math.abs(mov.amount),
      signedAmount,
      previousBalance,
      balanceAfter: runningBalance,
      referenceType: mov.referenceType,
      referenceId: mov.referenceId,
      referenceVoucherNo: mov.referenceVoucherNo,
      counterpartName: mov.counterpartName,
      paymentMethod: mov.paymentMethod || 'CASH',
      category: mov.category,
      description: mov.description || mov.notes || getCashMovementTypeLabel(mov.type),
      notes: mov.notes,
      status: mov.status,
      idempotencyKey: mov.idempotencyKey,
    });
  }

  // 2. Apply filters if provided
  let filtered = processedEntries;
  if (filterOptions) {
    const { startDate, endDate, typeFilter, paymentMethodFilter, searchQuery } = filterOptions;

    if (startDate) {
      filtered = filtered.filter((e) => e.transactionDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((e) => e.transactionDate <= endDate);
    }
    if (typeFilter && typeFilter !== 'ALL') {
      if (typeFilter === 'IN' || typeFilter === 'OUT') {
        filtered = filtered.filter((e) => e.direction === typeFilter);
      } else {
        filtered = filtered.filter((e) => e.type === typeFilter);
      }
    }
    if (paymentMethodFilter && paymentMethodFilter !== 'ALL') {
      filtered = filtered.filter((e) => (e.paymentMethod || 'CASH') === paymentMethodFilter);
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((e) =>
        (e.description || '').toLowerCase().includes(q) ||
        (e.referenceVoucherNo || '').toLowerCase().includes(q) ||
        (e.counterpartName || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.typeLabelMy || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }
  }

  // 3. Compute totals over filtered items
  let totalCashIn = 0;
  let totalCashOut = 0;
  for (const entry of filtered) {
    if (entry.signedAmount > 0) {
      totalCashIn += entry.signedAmount;
    } else {
      totalCashOut += Math.abs(entry.signedAmount);
    }
  }

  const netCashFlow = totalCashIn - totalCashOut;
  const closingBalance = filtered.length > 0 ? filtered[filtered.length - 1].balanceAfter : openingBalance;

  return {
    openingBalance,
    totalCashIn,
    totalCashOut,
    netCashFlow,
    closingBalance,
    totalEntriesCount: filtered.length,
    entries: filtered,
  };
}

/**
 * Computes daily cash summary for a specific business date
 */
export function calculateDailyCashSummary(
  date: string,
  allMovements: CashMovementRecord[] = [],
  openingCash: number = 0,
  closingRecord?: DailyClosingRecord
): DailyCashSummary {
  const fullSummary = calculateCashLedger(allMovements, { startDate: date, endDate: date }, openingCash);

  const totalCashIn = fullSummary.totalCashIn;
  const totalCashOut = fullSummary.totalCashOut;
  const netCashFlow = totalCashIn - totalCashOut;
  const expectedClosingCash = openingCash + netCashFlow;

  const actualCountedCash = closingRecord?.actualCountedCash;
  const difference = actualCountedCash !== undefined
    ? actualCountedCash - expectedClosingCash
    : undefined;

  return {
    date,
    openingCash,
    totalCashIn,
    totalCashOut,
    netCashFlow,
    expectedClosingCash,
    actualCountedCash,
    difference,
    isClosed: closingRecord?.status === 'CLOSED',
    closingRecord,
    entriesCount: fullSummary.entries.length,
    entries: fullSummary.entries,
  };
}

/**
 * Creates and records a direct manual cash movement (e.g. Shop Expense, Capital, Drawing)
 */
export async function recordDirectCashMovementAtomic(
  params: {
    amount: number;
    direction: 'IN' | 'OUT';
    type: CashMovementType;
    category?: string;
    description: string;
    transactionDate: string;
    transactionTime?: string;
    counterpartName?: string;
    paymentMethod?: string;
    notes?: string;
  },
  targetDb: ShweLetYarDatabase = db
): Promise<CashMovementRecord> {
  if (!params.amount || params.amount <= 0 || isNaN(params.amount)) {
    throw new Error('ငွေပမာဏသည် သုညထက်ကြီးသော ကိန်းဂဏန်း ဖြစ်ရပါမည်');
  }

  const now = new Date().toISOString();
  const id = generateStableId('csh');
  const signedAmount = params.direction === 'IN' ? Math.abs(params.amount) : -Math.abs(params.amount);
  const idempotencyKey = buildCashIdempotencyKey(params.type, id, params.transactionDate);

  const record: CashMovementRecord = {
    id,
    amount: Math.abs(params.amount),
    direction: params.direction,
    signedAmount,
    type: params.type,
    typeLabelMy: getCashMovementTypeLabel(params.type),
    referenceType: 'DIRECT',
    referenceId: id,
    counterpartName: params.counterpartName,
    paymentMethod: params.paymentMethod || 'CASH',
    category: params.category,
    description: params.description,
    transactionDate: params.transactionDate,
    transactionTime: params.transactionTime || now.slice(11, 16),
    notes: params.notes,
    status: 'COMPLETED',
    idempotencyKey,
    schemaVersion: 1,
    createdAt: now,
  };

  return targetDb.transaction('rw', [targetDb.cashMovements, targetDb.auditLogs], async () => {
    // Check duplicate idempotency
    const existing = await targetDb.cashMovements.where('idempotencyKey').equals(idempotencyKey).first();
    if (existing) {
      return existing;
    }

    await targetDb.cashMovements.put(record);

    // Audit Log Entry
    const audit: AuditLogEntry = {
      id: generateStableId('audit'),
      action: 'CASH_ENTRY',
      details: `${getCashMovementTypeLabel(params.type)}: ${params.description} | ငွေပမာဏ: ${(params.amount || 0).toLocaleString()} ကျပ် (${params.direction === 'IN' ? 'ဝင်' : 'ထွက်'}) | နေ့စွဲ: ${params.transactionDate}`,
      timestamp: now,
      entityType: 'CASH_MOVEMENT',
      entityId: id,
    };
    await targetDb.auditLogs.put(audit);

    return record;
  });
}

/**
 * Generates Unicode UTF-8 BOM CSV for Cash Ledger History
 */
export function exportCashLedgerCSV(
  entries: CashLedgerEntry[],
  options?: {
    shopName?: string;
    dateRangeStr?: string;
    filename?: string;
  }
): void {
  const shop = options?.shopName || 'ရွှေလက်ရာ လက်မှုလုပ်ငန်း';
  const headerInfo = [
    `"${shop} - ငွေသားစာရင်းမှတ်တမ်း (Cash Ledger Report)"`,
    `"ရက်စွဲကာလ: ${options?.dateRangeStr || 'အားလုံး'}"`,
    `"ထုတ်ယူသည့်အချိန်: ${new Date().toLocaleString('my-MM')}"`,
    `"စုစုပေါင်း မှတ်တမ်း: ${entries.length} ခု"`,
    '',
    '"စဉ်","ရက်စွဲ","အချိန်","အမျိုးအစား","ဖော်ပြချက်/အကြောင်းအရာ","သက်ဆိုင်သူ","ငွေပေးချေမှု","ဘောက်ချာအမှတ်","ငွေဝင် (+)","ငွေထွက် (-)","လက်ကျန်ငွေ (ကျပ်)"',
  ];

  const rows = entries.map((e, index) => {
    const inAmount = e.signedAmount > 0 ? e.amount.toString() : '-';
    const outAmount = e.signedAmount < 0 ? e.amount.toString() : '-';
    const cleanDesc = (e.description || '').replace(/"/g, '""');
    const cleanCounterpart = (e.counterpartName || '-').replace(/"/g, '""');
    const cleanVoucher = (e.referenceVoucherNo || '-').replace(/"/g, '""');

    return `"${index + 1}","${e.transactionDate}","${e.transactionTime}","${e.typeLabelMy}","${cleanDesc}","${cleanCounterpart}","${e.paymentMethod || 'CASH'}","${cleanVoucher}","${inAmount}","${outAmount}","${e.balanceAfter}"`;
  });

  const csvContent = '\uFEFF' + [...headerInfo, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options?.filename || `ShweLetYar_Cash_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
