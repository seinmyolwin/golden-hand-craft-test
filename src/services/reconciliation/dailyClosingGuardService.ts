/**
 * Shwe Let Yar - Daily Closing Guard Service
 * Phase 18 Implementation
 *
 * Enforces Closed-Period Mutation Invariants:
 * Once a day is CLOSED or LOCKED, financial mutations for that date
 * must be rejected with DailyClosingLockedError.
 *
 * Controlled reversals and administrative unlocking must record explicit audit events.
 */

import { db, ShweLetYarDatabase } from '../../db/database';
import { DailyClosingLockedError } from '../../repositories/errors';
import { recordAuditEvent } from '../auditTrailService';

/**
 * Checks whether a given transaction date has already been closed/locked.
 */
export async function isDateClosed(date: string, targetDb: ShweLetYarDatabase = db): Promise<boolean> {
  if (!date) return false;
  const closing = await targetDb.dailyClosings.get(`closing_${date}`);
  if (!closing) return false;
  return closing.status === 'CLOSED';
}

/**
 * Asserts that a given transaction date is OPEN.
 * Throws DailyClosingLockedError if the date is closed/locked.
 */
export async function assertDateNotClosed(
  date: string,
  targetDb: ShweLetYarDatabase = db,
  operationName?: string
): Promise<void> {
  if (!date) return;
  const isClosed = await isDateClosed(date, targetDb);
  if (isClosed) {
    throw new DailyClosingLockedError(date, operationName);
  }
}

/**
 * Controlled Administrative Reopening of a Closed Date with Audit Trail Logging.
 */
export async function reopenClosedDateWithAudit(
  date: string,
  reason: string,
  authorizedBy: string = 'Owner/Admin',
  targetDb: ShweLetYarDatabase = db
): Promise<void> {
  if (!reason || reason.trim().length < 5) {
    throw new Error('Reopening a closed date requires an explicit reason (minimum 5 characters).');
  }

  const closingKey = `closing_${date}`;
  const closing = await targetDb.dailyClosings.get(closingKey);
  if (!closing) {
    throw new Error(`No daily closing record found for date ${date}.`);
  }

  const now = new Date().toISOString();

  await targetDb.transaction('rw', [targetDb.dailyClosings, targetDb.auditLogs], async () => {
    await targetDb.dailyClosings.update(closingKey, {
      status: 'REOPENED_ADJUSTED',
      correctedAt: now,
      correctionReason: reason,
      updatedAt: now,
    });

    await recordAuditEvent(
      {
        action: 'ပိတ်သိမ်းပြီးသော နေ့စဉ်စာရင်းအား ပြန်လည်ဖွင့်လှစ်ခြင်း (Administrative Reopen)',
        actionType: 'UPDATE',
        details: `ရက်စွဲ ${date} အတွက် စာရင်းအား ${authorizedBy} မှ ပြန်လည်ဖွင့်လှစ်ခဲ့သည်။ အကြောင်းပြချက်: ${reason}`,
        referenceType: 'DAILY_CLOSING',
        referenceId: closing.id,
        referenceVoucherNo: date,
        timestamp: now,
      },
      targetDb
    );
  });
}
