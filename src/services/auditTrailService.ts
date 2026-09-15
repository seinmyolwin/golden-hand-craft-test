/**
 * Shwe Let Yar - Canonical Audit Trail & Business Activity Service
 * Phase 17 Implementation
 *
 * Provides an immutable, transaction-integrated audit trail for all operational business events:
 * Sale, Purchase, Stock Movement, Cash Movement, Return, Refund, Reversal, Daily Closing,
 * Master Data Mutations, Database Repair, and Backup/Restore.
 */

import { db, ShweLetYarDatabase } from '../db/database';
import { AuditLogEntry, AuditActionType } from '../types';
import { generateStableId } from '../utils/idGenerator';

export interface CreateAuditInput {
  id?: string;
  action: string;
  actionType?: AuditActionType;
  details?: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  referenceVoucherNo?: string;
  entityType?: string;
  entityId?: string;
  amount?: number;
  quantity?: number;
  metadata?: Record<string, any>;
  performer?: string;
  timestamp?: string;
  createdAt?: string;
}

/**
 * Maps arbitrary action strings or entity categories to standard AuditActionType
 */
export function mapActionToActionType(action: string, refType?: string): AuditActionType {
  const upper = (action || '').toUpperCase();
  const refUpper = (refType || '').toUpperCase();

  if (upper.includes('REVERSAL') || upper.includes('CANCEL') || upper.includes('REVERSE') || action.includes('ပယ်ဖျက်')) return 'REVERSAL';
  if (upper.includes('RETURN') || action.includes('ပြန်အပ်')) return 'RETURN';
  if (upper.includes('REFUND') || action.includes('အမ်း')) return 'REFUND';
  if (upper.includes('CLOSING_CORRECT') || upper.includes('REOPEN') || action.includes('ပြင်ဆင်')) return 'DAILY_CLOSING_CORRECTION';
  if (upper.includes('CLOSING') || refUpper === 'DAILY_CLOSING' || action.includes('စာရင်းပိတ်')) return 'DAILY_CLOSING';
  if (upper.includes('SALE') || refUpper === 'SALE' || action.includes('အရောင်း')) return 'SALE';
  if (upper.includes('PURCHASE') || upper.includes('COLLECTION') || refUpper === 'PURCHASE' || refUpper === 'TRANSACTION' || action.includes('အဝယ်') || action.includes('အကောက်')) return 'PURCHASE';
  if (upper.includes('STOCK') || refUpper === 'STOCK_MOVEMENT' || action.includes('ကုန်')) return 'STOCK_MOVEMENT';
  if (upper.includes('CASH') || refUpper === 'CASH_MOVEMENT' || action.includes('ငွေ')) return 'CASH_MOVEMENT';
  if (upper.includes('PRODUCT') || action.includes('ပစ္စည်း')) return 'PRODUCT_CHANGE';
  if (upper.includes('SUPPLIER') || upper.includes('MERCHANT') || upper.includes('PRESET') || action.includes('ဆိုင်') || action.includes('ပွဲရုံ')) return 'MASTER_DATA_CHANGE';
  if (upper.includes('REPAIR') || action.includes('ပြုပြင်')) return 'DATABASE_REPAIR';
  if (upper.includes('RECOVERY') || upper.includes('SNAPSHOT') || action.includes('ပြန်ရယူ')) return 'DATABASE_RECOVERY';
  if (upper.includes('BACKUP') || upper.includes('RESTORE') || action.includes('မိတ္တူ')) return 'BACKUP_RESTORE';

  return 'SYSTEM_ACTION';
}

let lastAuditTimestamp = 0;

function getMonotonicTimestamp(): string {
  const now = Date.now();
  if (now <= lastAuditTimestamp) {
    lastAuditTimestamp += 1;
  } else {
    lastAuditTimestamp = now;
  }
  return new Date(lastAuditTimestamp).toISOString();
}

/**
 * Builds a validated, immutable AuditLogEntry record
 */
export function buildAuditLogEntry(input: CreateAuditInput): AuditLogEntry {
  const now = getMonotonicTimestamp();
  const refType = input.referenceType || input.entityType || 'SYSTEM';
  const refId = input.referenceId || input.entityId || 'system';
  const actType = input.actionType || mapActionToActionType(input.action, refType);
  const textDetails = input.details || input.description || input.action;

  return {
    id: input.id || generateStableId('audit'),
    action: input.action,
    actionType: actType,
    details: textDetails,
    description: textDetails,
    timestamp: input.timestamp || now,
    entityType: refType,
    entityId: refId,
    referenceType: refType,
    referenceId: refId,
    referenceVoucherNo: input.referenceVoucherNo,
    amount: input.amount,
    quantity: input.quantity,
    metadata: input.metadata,
    performer: input.performer || 'system',
    createdAt: input.createdAt || now,
    schemaVersion: 1,
  };
}

/**
 * Records an immutable audit event to Dexie IndexedDB.
 * Supports passing a custom Dexie database instance or an active transaction target object.
 * Strictly uses add(entry) to enforce append-only immutability.
 * If the target table/transaction cannot support append-only add(), fails loudly.
 * If an ID collision occurs, safely retries with a salted unique ID.
 */
export async function recordAuditEvent(
  input: CreateAuditInput,
  txOrDb?: ShweLetYarDatabase | any
): Promise<AuditLogEntry> {
  let entry = buildAuditLogEntry(input);

  const getTable = () => {
    if (!txOrDb) return db.auditLogs;
    if (txOrDb.auditLogs) return txOrDb.auditLogs;
    if (typeof txOrDb.table === 'function') {
      try {
        const t = txOrDb.table('auditLogs');
        if (t) return t;
      } catch {
        // continue to fallback
      }
    }
    if (typeof txOrDb.add === 'function') return txOrDb;
    return null;
  };

  const table = getTable();
  if (!table || typeof table.add !== 'function') {
    throw new Error('Audit trail persistence error: Target does not support append-only add()');
  }

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Proactively check if ID already exists in table to avoid ConstraintError
      // which could bubble and abort an active Dexie transaction
      if (typeof table.get === 'function') {
        const existing = await table.get(entry.id);
        if (existing) {
          entry = { ...entry, id: `${generateStableId('audit')}_${Date.now()}` };
          attempt++;
          continue;
        }
      }

      await table.add(entry);
      return entry;
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error('Failed to record immutable audit event after retries:', err);
        throw err;
      }
      // Re-generate ID with stable generator to guarantee uniqueness
      entry = { ...entry, id: `${generateStableId('audit')}_${Date.now()}` };
    }
  }

  return entry;
}

/**
 * Bulk records multiple immutable audit events using append-only bulkAdd() semantics.
 */
export async function recordAuditEventsBulk(
  inputs: CreateAuditInput[],
  txOrDb?: ShweLetYarDatabase | any
): Promise<AuditLogEntry[]> {
  if (!inputs || inputs.length === 0) return [];

  const getTable = () => {
    if (!txOrDb) return db.auditLogs;
    if (txOrDb.auditLogs) return txOrDb.auditLogs;
    if (typeof txOrDb.table === 'function') {
      try {
        const t = txOrDb.table('auditLogs');
        if (t) return t;
      } catch {
        // continue to fallback
      }
    }
    if (typeof txOrDb.bulkAdd === 'function' || typeof txOrDb.add === 'function') return txOrDb;
    return null;
  };

  const table = getTable();
  if (!table || (typeof table.bulkAdd !== 'function' && typeof table.add !== 'function')) {
    throw new Error('Audit trail persistence error: Target does not support append-only bulkAdd()');
  }

  const entries = inputs.map((input) => buildAuditLogEntry(input));

  if (typeof table.bulkAdd === 'function') {
    await table.bulkAdd(entries);
  } else {
    for (const entry of entries) {
      await table.add(entry);
    }
  }

  return entries;
}

/**
 * Retrieves audit trail records with multi-criteria filtering options
 */
export async function getAuditTrail(options?: {
  date?: string;
  startDate?: string;
  endDate?: string;
  actionType?: AuditActionType | string;
  referenceType?: string;
  referenceVoucherNo?: string;
  searchTerm?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  let entries = await db.auditLogs.toArray();

  // Sort chronological descending (newest first)
  entries.sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime());

  if (options?.date) {
    entries = entries.filter(
      (e) => (e.timestamp || '').startsWith(options.date!) || (e.createdAt || '').startsWith(options.date!)
    );
  }
  if (options?.startDate) {
    entries = entries.filter((e) => (e.timestamp || e.createdAt || '') >= options.startDate!);
  }
  if (options?.endDate) {
    entries = entries.filter((e) => (e.timestamp || e.createdAt || '') <= `${options.endDate!}T23:59:59.999Z`);
  }
  if (options?.actionType && options.actionType !== 'ALL') {
    entries = entries.filter(
      (e) => e.actionType === options.actionType || mapActionToActionType(e.action, e.entityType) === options.actionType
    );
  }
  if (options?.referenceType) {
    entries = entries.filter((e) => e.referenceType === options.referenceType || e.entityType === options.referenceType);
  }
  if (options?.referenceVoucherNo) {
    const q = options.referenceVoucherNo.toLowerCase();
    entries = entries.filter((e) => (e.referenceVoucherNo || '').toLowerCase().includes(q));
  }
  if (options?.searchTerm) {
    const term = options.searchTerm.toLowerCase();
    entries = entries.filter(
      (e) =>
        (e.details || '').toLowerCase().includes(term) ||
        (e.action || '').toLowerCase().includes(term) ||
        (e.referenceVoucherNo || '').toLowerCase().includes(term) ||
        (e.entityId || '').toLowerCase().includes(term) ||
        (e.performer || '').toLowerCase().includes(term) ||
        JSON.stringify(e.metadata || {}).toLowerCase().includes(term)
    );
  }

  if (options?.limit && options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

/**
 * Tracing helper: gets chronological audit history chain for a voucher or record reference
 */
export async function getAuditHistoryForVoucher(voucherNoOrId: string): Promise<AuditLogEntry[]> {
  if (!voucherNoOrId) return [];
  const all = await db.auditLogs.toArray();
  const q = voucherNoOrId.toLowerCase();

  const matched = all.filter(
    (e) =>
      (e.referenceVoucherNo || '').toLowerCase() === q ||
      (e.referenceId || '').toLowerCase() === q ||
      (e.entityId || '').toLowerCase() === q ||
      (e.details || '').toLowerCase().includes(q) ||
      JSON.stringify(e.metadata || {}).toLowerCase().includes(q)
  );

  // Chronological ascending (oldest to newest for lifecycle trace)
  matched.sort((a, b) => new Date(a.timestamp || a.createdAt || 0).getTime() - new Date(b.timestamp || b.createdAt || 0).getTime());
  return matched;
}

/**
 * Maps retention period key to days:
 * 10_DAYS -> 10 days
 * 3_MONTHS -> 90 days
 * 4_MONTHS -> 120 days
 * 5_MONTHS -> 150 days
 * 1_YEAR -> 365 days
 */
export function getRetentionDays(retentionPeriod?: string): number | null {
  switch (retentionPeriod) {
    case '10_DAYS':
      return 10;
    case '3_MONTHS':
      return 90;
    case '4_MONTHS':
      return 120;
    case '5_MONTHS':
      return 150;
    case '1_YEAR':
      return 365;
    case 'FOREVER':
    default:
      return null;
  }
}

/**
 * Cleanup audit logs according to retention policy
 */
export async function cleanupAuditLogsByRetentionPolicy(retentionPeriod?: string): Promise<{ purgedCount: number; cutoffDate?: string }> {
  const days = getRetentionDays(retentionPeriod);
  if (!days) return { purgedCount: 0 };

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const allLogs = await db.auditLogs.toArray();
  const logsToDelete = allLogs.filter((entry) => {
    const entryTime = new Date(entry.timestamp || entry.createdAt || 0).getTime();
    return entryTime > 0 && entryTime < cutoffMs;
  });

  if (logsToDelete.length > 0) {
    const idsToDelete = logsToDelete.map((l) => l.id);
    await db.auditLogs.bulkDelete(idsToDelete);
  }

  return { purgedCount: logsToDelete.length, cutoffDate: cutoffIso.split('T')[0] };
}

