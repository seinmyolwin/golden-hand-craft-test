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
 * Uses add(entry) to enforce append-only immutability. If an ID collision occurs,
 * it safely catches the error and retries with a salted unique ID.
 */
export async function recordAuditEvent(
  input: CreateAuditInput,
  txOrDb?: ShweLetYarDatabase | any
): Promise<AuditLogEntry> {
  let entry = buildAuditLogEntry(input);

  const getTable = () => {
    if (txOrDb && txOrDb.auditLogs) return txOrDb.auditLogs;
    if (txOrDb && typeof txOrDb.table === 'function') {
      try {
        const t = txOrDb.table('auditLogs');
        if (t) return t;
      } catch {
        // continue to fallback
      }
    }
    if (txOrDb && typeof txOrDb.add === 'function') return txOrDb;
    return db.auditLogs;
  };

  const table = getTable();
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Proactively check if ID already exists in table to avoid ConstraintError
      // which could bubble and abort an active Dexie transaction
      if (typeof table.get === 'function') {
        const existing = await table.get(entry.id);
        if (existing) {
          const salt = Math.random().toString(36).substring(2, 8);
          entry = { ...entry, id: `${generateStableId('audit')}_${Date.now()}_${salt}` };
          attempt++;
          continue;
        }
      }

      if (typeof table.add === 'function') {
        await table.add(entry);
      } else if (typeof table.put === 'function') {
        await table.put(entry);
      }
      return entry;
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error('Failed to record immutable audit event after retries:', err);
        throw err;
      }
      // Re-generate ID with timestamp and random salt to guarantee uniqueness
      const salt = Math.random().toString(36).substring(2, 8);
      const uniqueId = `${generateStableId('audit')}_${Date.now()}_${salt}`;
      entry = { ...entry, id: uniqueId };
    }
  }

  return entry;
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
