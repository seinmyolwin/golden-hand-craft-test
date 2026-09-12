/**
 * Shwe Let Yar - Daily Closing Service
 * Phase 15 Implementation
 *
 * Implements a strict, idempotent Daily Cash Closing system.
 * Features:
 * - Expected cash formula: expectedClosing = openingCash + cashIn - cashOut
 * - Difference formula: difference = actualCountedCash - expectedClosing
 * - Closed-period protection: Prevents duplicate closings and protects closed days
 * - Audit logging: DAILY_CLOSING and DAILY_CLOSING_CORRECTION
 * - Automatic carryover of closing cash as opening cash for subsequent days
 * - UTF-8 BOM Myanmar CSV export for Daily Closing Reports
 */

import { DailyClosingRecord, CashMovementRecord, AuditLogEntry } from '../types';
import { db, ShweLetYarDatabase } from '../db/database';
import { generateStableId } from '../utils/idGenerator';
import { calculateDailyCashSummary, buildCashIdempotencyKey } from './cashLedgerService';
import { enforcePermission } from './authorizationService';

export interface DailyClosingInput {
  closingDate: string; // YYYY-MM-DD
  openingCash?: number;
  actualCountedCash: number;
  notes?: string;
  closedBy?: string;
  deviceId?: string;
}

export interface DailyClosingCorrectionInput {
  closingDate: string;
  newActualCountedCash: number;
  correctionReason: string;
  notes?: string;
  correctedBy?: string;
}

/**
 * Retrieves the latest closed cash balance prior to the given date to use as automatic opening float
 */
export async function getPreviousClosingCash(
  date: string,
  targetDb: ShweLetYarDatabase = db
): Promise<number> {
  const previousClosings = await targetDb.dailyClosings
    .where('closingDate')
    .below(date)
    .reverse()
    .sortBy('closingDate');

  if (previousClosings.length > 0) {
    const lastClosed = previousClosings[0];
    return lastClosed.actualCountedCash ?? lastClosed.expectedClosingCash ?? 0;
  }
  return 0;
}

/**
 * Checks if a specific business date is already closed
 */
export async function isDateClosed(
  date: string,
  targetDb: ShweLetYarDatabase = db
): Promise<boolean> {
  const existing = await targetDb.dailyClosings.where('closingDate').equals(date).first();
  return existing !== undefined && existing.status === 'CLOSED';
}

/**
 * Executes an atomic Daily Cash Closing
 */
export async function recordDailyClosingAtomic(
  input: DailyClosingInput,
  targetDb: ShweLetYarDatabase = db
): Promise<DailyClosingRecord> {
  const { closingDate, actualCountedCash, notes, closedBy, deviceId } = input;

  if (!closingDate || !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) {
    throw new Error('မမှန်ကန်သော ရက်စွဲဖြစ်ပါသည် (YYYY-MM-DD format လိုအပ်ပါသည်)');
  }
  if (actualCountedCash < 0 || isNaN(actualCountedCash)) {
    throw new Error('ရေတွက်ရရှိငွေသည် အနှုတ်မဖြစ်ရပါ');
  }

  return targetDb.transaction('rw', [targetDb.dailyClosings, targetDb.cashMovements, targetDb.auditLogs], async () => {
    // 1. Idempotency check - Prevent closing twice
    const existing = await targetDb.dailyClosings.where('closingDate').equals(closingDate).first();
    if (existing && existing.status === 'CLOSED') {
      throw new Error(`ရက်စွဲ ${closingDate} အတွက် နေ့စဉ်စာရင်း ပိတ်သိမ်းပြီးဖြစ်ပါသည်။ ပြင်ဆင်လိုပါက နေ့ချုပ်ပြင်ဆင်ခြင်း (Correction) အား အသုံးပြုပါ`);
    }

    // 2. Fetch all cash movements for the date
    const dayMovements = await targetDb.cashMovements
      .where('transactionDate')
      .equals(closingDate)
      .toArray();

    // 3. Determine opening cash (use provided or carry over from previous closed day)
    let openingCash = input.openingCash;
    if (openingCash === undefined) {
      openingCash = await getPreviousClosingCash(closingDate, targetDb);
    }

    // 4. Calculate expected closing and difference
    const summary = calculateDailyCashSummary(closingDate, dayMovements, openingCash);
    const expectedClosingCash = summary.expectedClosingCash;
    const difference = actualCountedCash - expectedClosingCash;

    const now = new Date().toISOString();
    const id = existing ? existing.id : `closing_${closingDate}`;

    // 5. Build categorized breakdown
    const breakdown = {
      salesCash: 0,
      debtCollectionCash: 0,
      otherIncomeCash: 0,
      supplierCashPayout: 0,
      supplierAdvanceCash: 0,
      purchaseCashPayout: 0,
      expensesCash: 0,
      reversalsNet: 0,
      directCashNet: 0,
    };

    dayMovements.forEach((m) => {
      if (m.status === 'CANCELLED') return;
      const amt = Math.abs(m.amount);
      switch (m.type) {
        case 'SALE_PAYMENT_IN':
          breakdown.salesCash += amt;
          break;
        case 'MERCHANT_DEBT_COLLECTION_IN':
          breakdown.debtCollectionCash += amt;
          break;
        case 'INCOME_IN':
          breakdown.otherIncomeCash += amt;
          break;
        case 'SUPPLIER_PAYOUT':
          breakdown.supplierCashPayout += amt;
          break;
        case 'SUPPLIER_ADVANCE_GIVEN':
          breakdown.supplierAdvanceCash += amt;
          break;
        case 'MERCHANT_PURCHASE_PAYOUT':
          breakdown.purchaseCashPayout += amt;
          break;
        case 'EXPENSE_PAYOUT':
          breakdown.expensesCash += amt;
          break;
        case 'SALE_CANCELLED_CASH_REVERSAL':
        case 'TRANSACTION_CANCELLED_CASH_REVERSAL':
        case 'PURCHASE_CANCELLED_CASH_REVERSAL':
          breakdown.reversalsNet += (m.signedAmount || 0);
          break;
        case 'DIRECT_CASH_IN':
        case 'DIRECT_CASH_OUT':
          breakdown.directCashNet += (m.signedAmount || 0);
          break;
      }
    });

    const closingRecord: DailyClosingRecord = {
      id,
      closingDate,
      openingCash,
      totalCashIn: summary.totalCashIn,
      totalCashOut: summary.totalCashOut,
      expectedClosingCash,
      actualCountedCash,
      difference,
      breakdown,
      notes: notes || '',
      status: 'CLOSED',
      closedAt: now,
      closedBy: closedBy || 'Shop Admin',
      deviceId,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await targetDb.dailyClosings.put(closingRecord);

    // 6. Record Audit Log Entry
    const diffText = difference === 0
      ? 'ကိုက်ညီသည် (Balanced)'
      : difference > 0
      ? `ပိုငွေ +${difference.toLocaleString()} ကျပ် (Surplus)`
      : `လိုငွေ ${difference.toLocaleString()} ကျပ် (Shortage)`;

    const auditEntry: AuditLogEntry = {
      id: generateStableId('audit'),
      action: 'DAILY_CLOSING',
      details: `နေ့စဉ်စာရင်းပိတ်သိမ်းခြင်း (${closingDate}): အဖွင့်ငွေ ${openingCash.toLocaleString()} ကျပ် | ဝင်ငွေ ${summary.totalCashIn.toLocaleString()} ကျပ် | ထွက်ငွေ ${summary.totalCashOut.toLocaleString()} ကျပ် | စာရင်းအရကျန်ငွေ ${expectedClosingCash.toLocaleString()} ကျပ် | လက်တွေ့ရေတွက်ရရှိငွေ ${actualCountedCash.toLocaleString()} ကျပ် | ကွဲလွဲချက်: ${diffText}${notes ? ` | မှတ်ချက်: ${notes}` : ''}`,
      timestamp: now,
      entityType: 'DAILY_CLOSING',
      entityId: id,
    };
    await targetDb.auditLogs.put(auditEntry);

    return closingRecord;
  });
}

/**
 * Executes an atomic Daily Cash Closing Correction
 */
export async function correctDailyClosingAtomic(
  input: DailyClosingCorrectionInput,
  targetDb: ShweLetYarDatabase = db
): Promise<DailyClosingRecord> {
  await enforcePermission('DAILY_CLOSING_CORRECTION', 'နေ့ချုပ်စာရင်း ပြင်ဆင်ညှိနှိုင်းခြင်း');
  const { closingDate, newActualCountedCash, correctionReason, notes, correctedBy } = input;

  if (!closingDate) {
    throw new Error('ရက်စွဲ သတ်မှတ်ရန် လိုအပ်ပါသည်');
  }
  if (!correctionReason || !correctionReason.trim()) {
    throw new Error('ပြင်ဆင်ရသည့် အကြောင်းပြချက် ထည့်သွင်းရန် လိုအပ်ပါသည်');
  }
  if (newActualCountedCash < 0 || isNaN(newActualCountedCash)) {
    throw new Error('ရေတွက်ရရှိငွေသည် အနှုတ်မဖြစ်ရပါ');
  }

  return targetDb.transaction('rw', [targetDb.dailyClosings, targetDb.cashMovements, targetDb.auditLogs], async () => {
    const existing = await targetDb.dailyClosings.where('closingDate').equals(closingDate).first();
    if (!existing) {
      throw new Error(`ရက်စွဲ ${closingDate} အတွက် စာရင်းပိတ်မှတ်တမ်း ရှာမတွေ့ပါ`);
    }

    const dayMovements = await targetDb.cashMovements
      .where('transactionDate')
      .equals(closingDate)
      .toArray();

    const summary = calculateDailyCashSummary(closingDate, dayMovements, existing.openingCash);
    const expectedClosingCash = summary.expectedClosingCash;
    const oldActual = existing.actualCountedCash;
    const newDifference = newActualCountedCash - expectedClosingCash;
    const now = new Date().toISOString();

    const updatedRecord: DailyClosingRecord = {
      ...existing,
      totalCashIn: summary.totalCashIn,
      totalCashOut: summary.totalCashOut,
      expectedClosingCash,
      actualCountedCash: newActualCountedCash,
      difference: newDifference,
      status: 'REOPENED_ADJUSTED',
      correctionReason,
      correctedAt: now,
      notes: notes ? `${existing.notes ? existing.notes + ' | ' : ''}ပြင်ဆင်ချက်: ${notes}` : existing.notes,
      updatedAt: now,
    };

    await targetDb.dailyClosings.put(updatedRecord);

    // Audit Log Entry
    const auditEntry: AuditLogEntry = {
      id: generateStableId('audit'),
      action: 'DAILY_CLOSING_CORRECTION',
      details: `နေ့စဉ်စာရင်းပိတ်ပြင်ဆင်ချက် (${closingDate}): ယခင်ရေတွက်ရရှိငွေ ${oldActual.toLocaleString()} ကျပ် -> ပြင်ဆင်ပြီးရေတွက်ရရှိငွေ ${newActualCountedCash.toLocaleString()} ကျပ် | အကြောင်းပြချက်: ${correctionReason} | စာရင်းစစ်: ${correctedBy || 'Admin'}`,
      timestamp: now,
      entityType: 'DAILY_CLOSING',
      entityId: existing.id,
    };
    await targetDb.auditLogs.put(auditEntry);

    return updatedRecord;
  });
}

/**
 * Generates Unicode UTF-8 BOM CSV for Daily Closing History
 */
export function exportDailyClosingHistoryCSV(
  closings: DailyClosingRecord[],
  options?: {
    shopName?: string;
    filename?: string;
  }
): void {
  const shop = options?.shopName || 'ရွှေလက်ရာ လက်မှုလုပ်ငန်း';
  const headerInfo = [
    `"${shop} - နေ့စဉ်ငွေစာရင်းပိတ်မှတ်တမ်းများ (Daily Cash Closing Report)"`,
    `"ထုတ်ယူသည့်အချိန်: ${new Date().toLocaleString('my-MM')}"`,
    `"စုစုပေါင်း ရက်စွဲမှတ်တမ်း: ${closings.length} ရက်"`,
    '',
    '"စဉ်","ရက်စွဲ","အဖွင့်ငွေ (ကျပ်)","ငွေဝင်စုစုပေါင်း (ကျပ်)","ငွေထွက်စုစုပေါင်း (ကျပ်)","စာရင်းအရကျန်ငွေ (ကျပ်)","လက်တွေ့ရေတွက်ရရှိငွေ (ကျပ်)","ကွဲလွဲချက် (ကျပ်)","အခြေအနေ","ပိတ်သိမ်းချိန်","ပိတ်သိမ်းသူ","မှတ်ချက်"',
  ];

  const rows = closings.map((c, index) => {
    const diffStatus = c.difference === 0 ? 'ကိုက်ညီ' : c.difference > 0 ? `ပို (+${c.difference})` : `လို (${c.difference})`;
    const statusText = c.status === 'CLOSED' ? 'ပိတ်သိမ်းပြီး' : 'ပြင်ဆင်ထား';
    const cleanNotes = (c.notes || '').replace(/"/g, '""');

    return `"${index + 1}","${c.closingDate}","${c.openingCash}","${c.totalCashIn}","${c.totalCashOut}","${c.expectedClosingCash}","${c.actualCountedCash}","${c.difference} (${diffStatus})","${statusText}","${c.closedAt}","${c.closedBy || '-'}","${cleanNotes}"`;
  });

  const csvContent = '\uFEFF' + [...headerInfo, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options?.filename || `ShweLetYar_Daily_Closings_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
