/**
 * Shwe Let Yar - Professional Database Repair & Recovery Service
 * Phase 13 Implementation
 *
 * Provides a controlled, atomic, audit-trailed database repair service
 * following the strict core safety sequence:
 * BACKUP -> VALIDATE -> PREVIEW -> EXPLICIT USER CONFIRMATION -> ATOMIC REPAIR -> POST-REPAIR DIAGNOSTICS -> AUDIT LOG
 */

import { db, ShweLetYarDatabase } from '../db/database';
import {
  RepairAction,
  RepairAuditDetails,
  RepairCapability,
  RepairSafetyLevel,
  RepairStatus,
  RepairType,
  AuditLogEntry,
  HealthCheckResult,
  DatabaseHealthReport,
} from '../types';
import { runDatabaseDiagnostics } from './databaseHealthService';
import { createAutoRecoverySnapshot, restoreFromSnapshot, CURRENT_APP_VERSION } from './backupService';
import { generateStableId } from '../utils/idGenerator';

/**
 * Explicit Repair Capability Matrix
 * Maps Phase 12 diagnostic issue codes to repair availability, safety level,
 * and required confirmation semantics.
 */
export const REPAIR_CAPABILITY_MATRIX: Record<string, RepairCapability> = {
  // Level B: User-confirmed repairs with selectable valid replacements
  BROKEN_FOREIGN_KEY: {
    code: 'BROKEN_FOREIGN_KEY',
    title: 'ကျိုးပေါက်နေသော ဆက်စပ်အကိုးအကား (Broken Foreign Key)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_B',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'လက်ရှိရှိပြီးသား တရားဝင် ပေးသွင်းသူ သို့မဟုတ် ကုန်သည်များထဲမှ အသုံးပြုသူ ကိုယ်တိုင် ရွေးချယ်ပြီး ဆက်စပ်မှုကို ပြင်ဆင်နိုင်ပါသည်',
  },
  BROKEN_PRODUCT_REF: {
    code: 'BROKEN_PRODUCT_REF',
    title: 'ကျိုးပေါက်နေသော ကုန်ပစ္စည်းအကိုးအကား (Broken Product Reference)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_B',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'စာရင်းအတွင်း မရှိတော့သော ကုန်ပစ္စည်း ID အား လက်ရှိတရားဝင် ကုန်ပစ္စည်းများထဲမှ ရွေးချယ်အစားထိုးနိုင်ပါသည်',
  },
  ORPHAN_ATTACHMENT: {
    code: 'ORPHAN_ATTACHMENT',
    title: 'မိခင်ဘောက်ချာမရှိသော ဓာတ်ပုံမှတ်တမ်း (Orphan Attachment)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_B',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'အကိုးအကားမဲ့နေသော ဓာတ်ပုံဖိုင်အား အသုံးပြုသူ အတည်ပြုချက်ဖြင့် ဖျက်ပစ်ခြင်း သို့မဟုတ် တရားဝင်ဘောက်ချာသို့ ပြန်လည်သတ်မှတ်နိုင်ပါသည်',
  },
  BROKEN_ATTACHMENT_REFERENCE: {
    code: 'BROKEN_ATTACHMENT_REFERENCE',
    title: 'ပျက်ပြယ်နေသော ဓာတ်ပုံအညွှန်း (Broken Attachment Reference)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_B',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'ဘောက်ချာအတွင်းမှ မရှိတော့သော ဓာတ်ပုံ ID အညွှန်းအား ဖယ်ရှားသန့်စင်နိုင်ပါသည်',
  },
  MISSING_ATTACHMENT_PAYLOAD: {
    code: 'MISSING_ATTACHMENT_PAYLOAD',
    title: 'ဒေတာမပါသော ဓာတ်ပုံမှတ်တမ်း (Missing Attachment Payload)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_B',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'ဓာတ်ပုံဒေတာလုံးဝမရှိသော အလွတ်မှတ်တမ်းအား အသုံးပြုသူ အတည်ပြုချက်ဖြင့် ဖျက်ပစ်နိုင်ပါသည်',
  },

  // Level A / B: Metadata normalization
  MISSING_PRODUCT_UNIT: {
    code: 'MISSING_PRODUCT_UNIT',
    title: 'ကုန်ပစ္စည်း ရေတွက်ပုံ ယူနစ် မပါရှိခြင်း (Missing Product Unit)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_A',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'ကုန်ပစ္စည်း၏ အခြေခံ ရေတွက်ပုံယူနစ်အား "ခု" အဖြစ် စံသတ်မှတ်ပေးနိုင်ပါသည်',
  },
  INVALID_ENUM_VALUE: {
    code: 'INVALID_ENUM_VALUE',
    title: 'မမှန်ကန်သော အဆင့်အတန်းတန်ဖိုး (Invalid Enum Value)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_B',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'ကုန်သည်၏ အဆင့်အတန်း (Role) အား တရားဝင်တန်ဖိုး (BUYER / SUPPLIER / BOTH) သို့ အတည်ပြုပြင်ဆင်နိုင်ပါသည်',
  },
  INVALID_BACKUP_METADATA: {
    code: 'INVALID_BACKUP_METADATA',
    title: 'မမှန်ကန်သော Backup မက်တာဒေတာ (Invalid Backup Metadata)',
    repairAvailable: true,
    safetyLevel: 'LEVEL_A',
    isAutomatic: false,
    requiresUserConfirmation: true,
    description: 'ပျက်စီးနေသော LocalStorage နောက်ဆုံး Backup အချိန်မှတ်တမ်းအား ပြန်လည်သတ်မှတ်နိုင်ပါသည်',
  },

  // Level C: UNSAFE / MANUAL ONLY - AUTOMATIC REPAIR FORBIDDEN
  INVALID_MONETARY_VALUE: {
    code: 'INVALID_MONETARY_VALUE',
    title: 'မမှန်ကန်သော ငွေပမာဏ (Invalid Monetary Value)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'ငွေကြေးဆိုင်ရာ အချက်အလက်များအား အလိုအလျောက် ပြင်ဆင်ခွင့်မပြုပါ။ သက်ဆိုင်ရာ စာရင်းတွင် ကိုယ်တိုင်စစ်ဆေးပြင်ဆင်ရပါမည်',
  },
  NEGATIVE_PRICE: {
    code: 'NEGATIVE_PRICE',
    title: 'အနှုတ်ဖြစ်နေသော ဈေးနှုန်း (Negative Price)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'ငွေကြေးဆိုင်ရာ အချက်အလက်များအား အလိုအလျောက် ပြင်ဆင်ခွင့်မပြုပါ',
  },
  PROHIBITED_NEGATIVE_VALUE: {
    code: 'PROHIBITED_NEGATIVE_VALUE',
    title: 'ခွင့်မပြုထားသော အနှုတ်တန်ဖိုး (Prohibited Negative Value)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'စာရင်းရှင်းတမ်းဆိုင်ရာ အမှားဖြစ်သဖြင့် ကိုယ်တိုင်စစ်ဆေးရန် လိုအပ်ပါသည်',
  },
  FLOATING_POINT_RESIDUE: {
    code: 'FLOATING_POINT_RESIDUE',
    title: 'ဒဿမအပိုင်းကိန်း ပါရှိနေခြင်း (Floating Point Residue)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'မြန်မာကျပ်ငွေသည် ကိန်းပြည့်ဖြစ်ရပါမည်။ သက်ဆိုင်ရာ ငွေစာရင်းတွင် ကိုယ်တိုင်စစ်ဆေးပြင်ဆင်ပါ',
  },
  TOTAL_MISMATCH: {
    code: 'TOTAL_MISMATCH',
    title: 'စုစုပေါင်းတန်ဖိုး ကွဲလွဲနေခြင်း (Total Mismatch)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'ဘောက်ချာစုစုပေါင်းငွေနှင့် ကုန်ပစ္စည်းခွဲငွေ ကွဲလွဲနေခြင်းဖြစ်သဖြင့် အလိုအလျောက် ပြင်ဆင်ခြင်း မပြုရပါ',
  },
  GRAND_TOTAL_MISMATCH: {
    code: 'GRAND_TOTAL_MISMATCH',
    title: 'အရောင်းစုစုပေါင်း ကွဲလွဲနေခြင်း (Grand Total Mismatch)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'ငွေစာရင်းဆိုင်ရာ သမိုင်းကြောင်းအား အလိုအလျောက် ခန့်မှန်းပြင်ဆင်ခွင့်မရှိပါ',
  },
  INVALID_QUANTITY: {
    code: 'INVALID_QUANTITY',
    title: 'မမှန်ကန်သော အရေအတွက် (Invalid Quantity)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'ကုန်ပစ္စည်းအရေအတွက်အား အလိုအလျောက် ခန့်မှန်းဖြည့်သွင်းခွင့်မရှိပါ',
  },
  NEGATIVE_STOCK_LEVEL: {
    code: 'NEGATIVE_STOCK_LEVEL',
    title: 'စတော့လက်ကျန် အနှုတ်ပြနေခြင်း (Negative Stock Level)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'စတော့အဝင်/အထွက် စာရင်းများကို ကိုယ်တိုင် ပြန်လည်ချိန်ညှိရန် လိုအပ်ပါသည်',
  },
  STOCK_STATE_INCONSISTENCY: {
    code: 'STOCK_STATE_INCONSISTENCY',
    title: 'စတော့စာရင်း ကွဲလွဲမှု (Stock State Inconsistency)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'စတော့စာရင်းသမိုင်းကြောင်းအား အလိုအလျောက် ပြင်ဆင်ခွင့်မပြုပါ။ Stock Adjustment သို့မဟုတ် စာရင်းစစ်ဆေးခြင်း ပြုလုပ်ပါ',
  },
  MISSING_VOUCHER_NUMBER: {
    code: 'MISSING_VOUCHER_NUMBER',
    title: 'ဘောက်ချာအမှတ် မပါရှိခြင်း (Missing Voucher Number)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'တရားဝင်စာရင်းဘောက်ချာအမှတ်အား အလိုအလျောက် စိတ်ကြိုက်ထုတ်ပေးခြင်း မပြုပါ',
  },
  DUPLICATE_VOUCHER_NUMBER: {
    code: 'DUPLICATE_VOUCHER_NUMBER',
    title: 'ဘောက်ချာအမှတ် ထပ်နေခြင်း (Duplicate Voucher Number)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'စာရင်းဘောက်ချာအမှတ်များ ထပ်နေပါက သက်ဆိုင်ရာဘောက်ချာကို ကိုယ်တိုင်စစ်ဆေးပြင်ဆင်ပါ',
  },
  INVALID_DATE_FORMAT: {
    code: 'INVALID_DATE_FORMAT',
    title: 'မမှန်ကန်သော ရက်စွဲ (Invalid Date Format)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'စာရင်းရေးသွင်းခဲ့သည့် နေ့စွဲဖြစ်သဖြင့် အလိုအလျောက် ခန့်မှန်းပြင်ဆင်ခွင့်မရှိပါ',
  },
  FUTURE_BUSINESS_DATE: {
    code: 'FUTURE_BUSINESS_DATE',
    title: 'အနာဂတ်ကာလ နေ့စွဲဖြစ်နေခြင်း (Future Business Date)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'သက်ဆိုင်ရာ စာရင်းတွင် ကိုယ်တိုင်စစ်ဆေးပြီး ရက်စွဲမှန်ကို ပြင်ဆင်ပါ',
  },
  DUPLICATE_PRIMARY_ID: {
    code: 'DUPLICATE_PRIMARY_ID',
    title: 'မူလ ID ထပ်နေခြင်း (Duplicate Primary ID)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'Primary Key ထပ်နေမှုအား အလိုအလျောက် ဖျက်ပစ်ခြင်း သို့မဟုတ် ပေါင်းစပ်ခြင်း မပြုလုပ်ရပါ။ ကျွမ်းကျင်သူနှင့် စစ်ဆေးပါ',
  },
  MISSING_PRIMARY_ID: {
    code: 'MISSING_PRIMARY_ID',
    title: 'မူလ ID မပါရှိခြင်း (Missing Primary ID)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'အဓိက ID မရှိသော မှတ်တမ်းအား အလိုအလျောက် အမည်ပေးခြင်း မပြုပါ',
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    title: 'မဖြစ်မနေ လိုအပ်သောအချက်အလက် မပါရှိခြင်း (Missing Required Field)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'အမည် သို့မဟုတ် လိုအပ်သောအချက်အလက်အား စိတ်ကြိုက်ဖြည့်စွက်ခွင့်မရှိပါ',
  },
  BROKEN_SALE_VOUCHER_REF: {
    code: 'BROKEN_SALE_VOUCHER_REF',
    title: 'အမှာစာနှင့် ဆက်စပ်အရောင်းဘောက်ချာ ပြတ်တောက်မှု (Broken Sale Voucher Ref)',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'အမှာစာနှင့် ချိတ်ဆက်ထားသော အရောင်းဘောက်ချာအား ကိုယ်တိုင်ပြန်လည်ရွေးချယ်ချိတ်ဆက်ရန် လိုအပ်ပါသည်',
  },
};

/**
 * Get the capability descriptor for a specific diagnostic code
 */
export function getRepairCapability(code: string): RepairCapability {
  if (REPAIR_CAPABILITY_MATRIX[code]) {
    return REPAIR_CAPABILITY_MATRIX[code];
  }
  return {
    code,
    title: 'အလိုအလျောက် ပြင်ဆင်၍မရနိုင်သော ချို့ယွင်းချက်',
    repairAvailable: false,
    safetyLevel: 'LEVEL_C',
    isAutomatic: false,
    requiresUserConfirmation: false,
    description: 'ဤချို့ယွင်းချက်အမျိုးအစားအတွက် အလိုအလျောက် ပြင်ဆင်ခြင်း မပြုလုပ်နိုင်ပါ။ ကိုယ်တိုင်စစ်ဆေးရန် လိုအပ်ပါသည်',
  };
}

/**
 * Return all entries in the repair capability matrix
 */
export function getRepairCapabilityMatrix(): RepairCapability[] {
  return Object.values(REPAIR_CAPABILITY_MATRIX);
}

/**
 * Deeply sanitizes any snapshot or record object so sensitive fields
 * (PIN, salts, password hashes, recovery keys) NEVER leak into audit logs or previews.
 */
export function sanitizeSnapshot(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSnapshot(item));
  }

  const sensitiveKeys = new Set([
    'pin',
    'passcode',
    'pinsalt',
    'pinhash',
    'recoverysalt',
    'recoveryhash',
    'recoverykey',
    'recoveryanswer',
    'recoveryquestion',
    'token',
    'secret',
    'authhash',
  ]);

  const isSensitive = (key: string) => {
    const lk = key.toLowerCase();
    return (
      sensitiveKeys.has(lk) ||
      lk.includes('passcode') ||
      lk.includes('password') ||
      lk.includes('secret') ||
      lk.includes('token')
    );
  };

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitive(key)) {
      // Exclude entirely or mask
      continue;
    }
    if (typeof value === 'object') {
      sanitized[key] = sanitizeSnapshot(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Creates an exact repair preview showing BEFORE and AFTER states
 * strictly WITHOUT mutating any database records.
 */
export async function createRepairPreview(
  issue: HealthCheckResult,
  targetDb: ShweLetYarDatabase = db,
  options?: {
    newTargetId?: string;
    actionType?: 'DELETE' | 'REASSIGN' | 'NORMALIZE';
  }
): Promise<RepairAction> {
  const capability = getRepairCapability(issue.code);
  const repairId = generateStableId('rep');
  const createdAt = new Date().toISOString();

  // If issue is not repairable or Level C, return manual review only action
  if (!capability.repairAvailable || capability.safetyLevel === 'LEVEL_C') {
    return {
      repairId,
      repairType: 'MANUAL_REVIEW_ONLY',
      targetEntity: issue.entity || 'Unknown',
      targetRecordId: issue.recordId || 'Unknown',
      affectedRecordIds: [issue.recordId, ...(issue.relatedRecordIds || [])].filter(Boolean) as string[],
      reason: `${issue.title}: ${issue.message}`,
      diagnosticCode: issue.code,
      beforeSnapshot: sanitizeSnapshot({
        entity: issue.entity,
        recordId: issue.recordId,
        details: issue.details,
      }),
      proposedAfterSnapshot: {
        status: 'MANUAL_REVIEW_REQUIRED',
        instruction: capability.description,
      },
      safetyLevel: 'LEVEL_C',
      createdAt,
      status: 'REJECTED',
      error: 'ဤချို့ယွင်းချက်သည် ငွေစာရင်း သို့မဟုတ် စတော့ဆိုင်ရာ အရေးကြီးအချက်အလက်ဖြစ်သဖြင့် အလိုအလျောက် ပြင်ဆင်ခွင့်မရှိပါ',
    };
  }

  const recordId = issue.recordId || '';
  const entity = issue.entity || '';

  // 1. Broken Foreign Key (Transactions -> Supplier)
  if (issue.code === 'BROKEN_FOREIGN_KEY' && (entity === 'Transaction' || entity === 'transactions')) {
    const tx = await targetDb.transactions.get(recordId);
    if (!tx) {
      throw new Error(`Transaction record "${recordId}" was not found in database.`);
    }

    const replacementSupplierId = options?.newTargetId;
    let replacementSupplierName = 'Selected Supplier';
    if (replacementSupplierId) {
      const sup = await targetDb.suppliers.get(replacementSupplierId);
      if (sup) replacementSupplierName = sup.name;
    }

    return {
      repairId,
      repairType: 'REASSIGN_BROKEN_SUPPLIER_REF',
      targetEntity: 'Transaction',
      targetRecordId: recordId,
      affectedRecordIds: [recordId, ...(tx.supplierId ? [tx.supplierId] : []), ...(replacementSupplierId ? [replacementSupplierId] : [])],
      reason: `Reassign broken supplier reference "${tx.supplierId}" to valid supplier "${replacementSupplierId || 'pending'}"`,
      diagnosticCode: issue.code,
      beforeSnapshot: sanitizeSnapshot({
        id: tx.id,
        voucherNo: tx.voucherNo,
        supplierId: tx.supplierId,
        supplierName: tx.supplierName,
        totalGoodsValue: tx.totalGoodsValue,
      }),
      proposedAfterSnapshot: sanitizeSnapshot({
        id: tx.id,
        voucherNo: tx.voucherNo,
        supplierId: replacementSupplierId || tx.supplierId,
        supplierName: replacementSupplierName,
        totalGoodsValue: tx.totalGoodsValue,
      }),
      safetyLevel: 'LEVEL_B',
      createdAt,
      status: 'PREVIEW',
      selectedOption: replacementSupplierId,
    };
  }

  // 2. Broken Foreign Key (Sales -> Merchant)
  if (issue.code === 'BROKEN_FOREIGN_KEY' && (entity === 'Sale' || entity === 'sales')) {
    const sale = await targetDb.sales.get(recordId);
    if (!sale) {
      throw new Error(`Sale record "${recordId}" was not found in database.`);
    }

    const replacementMerchantId = options?.newTargetId;
    let replacementMerchantName = 'Selected Merchant';
    if (replacementMerchantId) {
      const m = await targetDb.merchants.get(replacementMerchantId);
      if (m) replacementMerchantName = m.name;
    }

    return {
      repairId,
      repairType: 'REASSIGN_BROKEN_MERCHANT_REF',
      targetEntity: 'Sale',
      targetRecordId: recordId,
      affectedRecordIds: [recordId, ...(sale.merchantId ? [sale.merchantId] : []), ...(replacementMerchantId ? [replacementMerchantId] : [])],
      reason: `Reassign broken merchant reference "${sale.merchantId}" to valid merchant "${replacementMerchantId || 'pending'}"`,
      diagnosticCode: issue.code,
      beforeSnapshot: sanitizeSnapshot({
        id: sale.id,
        voucherNo: sale.voucherNo,
        merchantId: sale.merchantId,
        merchantName: sale.merchantName,
        grandTotal: sale.grandTotal,
      }),
      proposedAfterSnapshot: sanitizeSnapshot({
        id: sale.id,
        voucherNo: sale.voucherNo,
        merchantId: replacementMerchantId || sale.merchantId,
        merchantName: replacementMerchantName,
        grandTotal: sale.grandTotal,
      }),
      safetyLevel: 'LEVEL_B',
      createdAt,
      status: 'PREVIEW',
      selectedOption: replacementMerchantId,
    };
  }

  // 3. Broken Foreign Key (MerchantPurchase -> Merchant)
  if (issue.code === 'BROKEN_FOREIGN_KEY' && (entity === 'MerchantPurchase' || entity === 'merchantPurchases')) {
    const purchase = await targetDb.merchantPurchases.get(recordId);
    if (!purchase) {
      throw new Error(`MerchantPurchase record "${recordId}" was not found in database.`);
    }

    const replacementMerchantId = options?.newTargetId;
    let replacementMerchantName = 'Selected Merchant';
    if (replacementMerchantId) {
      const m = await targetDb.merchants.get(replacementMerchantId);
      if (m) replacementMerchantName = m.name;
    }

    return {
      repairId,
      repairType: 'REASSIGN_BROKEN_MERCHANT_REF',
      targetEntity: 'MerchantPurchase',
      targetRecordId: recordId,
      affectedRecordIds: [recordId, ...(purchase.merchantId ? [purchase.merchantId] : []), ...(replacementMerchantId ? [replacementMerchantId] : [])],
      reason: `Reassign broken merchant reference "${purchase.merchantId}" to valid merchant "${replacementMerchantId || 'pending'}"`,
      diagnosticCode: issue.code,
      beforeSnapshot: sanitizeSnapshot({
        id: purchase.id,
        purchaseNo: purchase.purchaseNo,
        merchantId: purchase.merchantId,
        merchantName: purchase.merchantName,
        totalAmount: purchase.totalAmount,
      }),
      proposedAfterSnapshot: sanitizeSnapshot({
        id: purchase.id,
        purchaseNo: purchase.purchaseNo,
        merchantId: replacementMerchantId || purchase.merchantId,
        merchantName: replacementMerchantName,
        totalAmount: purchase.totalAmount,
      }),
      safetyLevel: 'LEVEL_B',
      createdAt,
      status: 'PREVIEW',
      selectedOption: replacementMerchantId,
    };
  }

  // 4. Broken Product Reference (Transaction / Sale)
  if (issue.code === 'BROKEN_PRODUCT_REF') {
    const brokenProductId = issue.relatedRecordIds?.[0];
    const replacementProductId = options?.newTargetId;
    let replacementProductName = 'Selected Product';
    if (replacementProductId) {
      const prod = await targetDb.products.get(replacementProductId);
      if (prod) replacementProductName = prod.name;
    }

    if (entity === 'Transaction' || entity === 'transactions') {
      const tx = await targetDb.transactions.get(recordId);
      if (!tx) throw new Error(`Transaction "${recordId}" not found.`);

      const updatedItems = (tx.items || []).map((it) => {
        if (it.productId === brokenProductId && replacementProductId) {
          return { ...it, productId: replacementProductId, productName: replacementProductName };
        }
        return it;
      });

      return {
        repairId,
        repairType: 'REASSIGN_BROKEN_PRODUCT_REF',
        targetEntity: 'Transaction',
        targetRecordId: recordId,
        affectedRecordIds: [recordId, ...(brokenProductId ? [brokenProductId] : []), ...(replacementProductId ? [replacementProductId] : [])],
        reason: `Replace broken productId "${brokenProductId}" in transaction items with valid product "${replacementProductId || 'pending'}"`,
        diagnosticCode: issue.code,
        beforeSnapshot: sanitizeSnapshot({ id: tx.id, voucherNo: tx.voucherNo, items: tx.items }),
        proposedAfterSnapshot: sanitizeSnapshot({ id: tx.id, voucherNo: tx.voucherNo, items: updatedItems }),
        safetyLevel: 'LEVEL_B',
        createdAt,
        status: 'PREVIEW',
        selectedOption: replacementProductId,
      };
    } else if (entity === 'Sale' || entity === 'sales') {
      const sale = await targetDb.sales.get(recordId);
      if (!sale) throw new Error(`Sale "${recordId}" not found.`);

      const updatedItems = (sale.items || []).map((it) => {
        if (it.productId === brokenProductId && replacementProductId) {
          return { ...it, productId: replacementProductId, productName: replacementProductName };
        }
        return it;
      });

      return {
        repairId,
        repairType: 'REASSIGN_BROKEN_PRODUCT_REF',
        targetEntity: 'Sale',
        targetRecordId: recordId,
        affectedRecordIds: [recordId, ...(brokenProductId ? [brokenProductId] : []), ...(replacementProductId ? [replacementProductId] : [])],
        reason: `Replace broken productId "${brokenProductId}" in sale items with valid product "${replacementProductId || 'pending'}"`,
        diagnosticCode: issue.code,
        beforeSnapshot: sanitizeSnapshot({ id: sale.id, voucherNo: sale.voucherNo, items: sale.items }),
        proposedAfterSnapshot: sanitizeSnapshot({ id: sale.id, voucherNo: sale.voucherNo, items: updatedItems }),
        safetyLevel: 'LEVEL_B',
        createdAt,
        status: 'PREVIEW',
        selectedOption: replacementProductId,
      };
    }
  }

  // 5. Orphan Attachment
  if (issue.code === 'ORPHAN_ATTACHMENT') {
    const att = await targetDb.attachments.get(recordId);
    if (!att) throw new Error(`Attachment "${recordId}" not found.`);

    if (options?.actionType === 'REASSIGN' && options?.newTargetId) {
      return {
        repairId,
        repairType: 'REASSIGN_ORPHAN_ATTACHMENT',
        targetEntity: 'Attachment',
        targetRecordId: recordId,
        affectedRecordIds: [recordId, att.voucherId, options.newTargetId],
        reason: `Reassign orphan attachment "${recordId}" to active voucher "${options.newTargetId}"`,
        diagnosticCode: issue.code,
        beforeSnapshot: sanitizeSnapshot({ id: att.id, voucherId: att.voucherId, mimeType: att.mimeType, sizeBytes: att.sizeBytes }),
        proposedAfterSnapshot: sanitizeSnapshot({ id: att.id, voucherId: options.newTargetId, mimeType: att.mimeType, sizeBytes: att.sizeBytes }),
        safetyLevel: 'LEVEL_B',
        createdAt,
        status: 'PREVIEW',
        selectedOption: options.newTargetId,
      };
    } else {
      // Safe user-confirmed deletion
      return {
        repairId,
        repairType: 'DELETE_ORPHAN_ATTACHMENT',
        targetEntity: 'Attachment',
        targetRecordId: recordId,
        affectedRecordIds: [recordId, att.voucherId],
        reason: `Permanently remove orphan attachment record "${recordId}" (linked voucher "${att.voucherId}" does not exist)`,
        diagnosticCode: issue.code,
        beforeSnapshot: sanitizeSnapshot({ id: att.id, voucherId: att.voucherId, mimeType: att.mimeType, sizeBytes: att.sizeBytes }),
        proposedAfterSnapshot: { action: 'DELETED', id: att.id },
        safetyLevel: 'LEVEL_B',
        createdAt,
        status: 'PREVIEW',
      };
    }
  }

  // 6. Broken Attachment Reference on Voucher
  if (issue.code === 'BROKEN_ATTACHMENT_REFERENCE') {
    const brokenAttId = issue.relatedRecordIds?.[0];
    if (entity === 'Transaction' || entity === 'transactions') {
      const tx = await targetDb.transactions.get(recordId);
      if (!tx) throw new Error(`Transaction "${recordId}" not found.`);
      const updatedPhotos = (tx.attachmentPhotos || []).filter((id) => id !== brokenAttId);

      return {
        repairId,
        repairType: 'REMOVE_BROKEN_ATTACHMENT_REF',
        targetEntity: 'Transaction',
        targetRecordId: recordId,
        affectedRecordIds: [recordId, ...(brokenAttId ? [brokenAttId] : [])],
        reason: `Remove dangling attachment reference "${brokenAttId}" from transaction "${tx.voucherNo || tx.id}"`,
        diagnosticCode: issue.code,
        beforeSnapshot: sanitizeSnapshot({ id: tx.id, voucherNo: tx.voucherNo, attachmentPhotos: tx.attachmentPhotos }),
        proposedAfterSnapshot: sanitizeSnapshot({ id: tx.id, voucherNo: tx.voucherNo, attachmentPhotos: updatedPhotos }),
        safetyLevel: 'LEVEL_B',
        createdAt,
        status: 'PREVIEW',
      };
    } else if (entity === 'Sale' || entity === 'sales') {
      const sale = await targetDb.sales.get(recordId);
      if (!sale) throw new Error(`Sale "${recordId}" not found.`);
      const updatedPhotos = (sale.attachmentPhotos || []).filter((id) => id !== brokenAttId);

      return {
        repairId,
        repairType: 'REMOVE_BROKEN_ATTACHMENT_REF',
        targetEntity: 'Sale',
        targetRecordId: recordId,
        affectedRecordIds: [recordId, ...(brokenAttId ? [brokenAttId] : [])],
        reason: `Remove dangling attachment reference "${brokenAttId}" from sale "${sale.voucherNo || sale.id}"`,
        diagnosticCode: issue.code,
        beforeSnapshot: sanitizeSnapshot({ id: sale.id, voucherNo: sale.voucherNo, attachmentPhotos: sale.attachmentPhotos }),
        proposedAfterSnapshot: sanitizeSnapshot({ id: sale.id, voucherNo: sale.voucherNo, attachmentPhotos: updatedPhotos }),
        safetyLevel: 'LEVEL_B',
        createdAt,
        status: 'PREVIEW',
      };
    }
  }

  // 7. Missing Attachment Payload
  if (issue.code === 'MISSING_ATTACHMENT_PAYLOAD') {
    const att = await targetDb.attachments.get(recordId);
    if (!att) throw new Error(`Attachment "${recordId}" not found.`);

    return {
      repairId,
      repairType: 'DELETE_PAYLOADLESS_ATTACHMENT',
      targetEntity: 'Attachment',
      targetRecordId: recordId,
      affectedRecordIds: [recordId],
      reason: `Remove zero-payload corrupt attachment record "${recordId}"`,
      diagnosticCode: issue.code,
      beforeSnapshot: sanitizeSnapshot({ id: att.id, voucherId: att.voucherId, sizeBytes: att.sizeBytes }),
      proposedAfterSnapshot: { action: 'DELETED', id: att.id },
      safetyLevel: 'LEVEL_B',
      createdAt,
      status: 'PREVIEW',
    };
  }

  // 8. Missing Product Unit
  if (issue.code === 'MISSING_PRODUCT_UNIT') {
    const prod = await targetDb.products.get(recordId);
    if (!prod) throw new Error(`Product "${recordId}" not found.`);

    const defaultUnit = options?.newTargetId || 'ခု';
    return {
      repairId,
      repairType: 'RESTORE_MISSING_UNIT',
      targetEntity: 'Product',
      targetRecordId: recordId,
      affectedRecordIds: [recordId],
      reason: `Set standard default measurement unit "${defaultUnit}" for product "${prod.name}"`,
      diagnosticCode: issue.code,
      beforeSnapshot: sanitizeSnapshot({ id: prod.id, name: prod.name, unit: prod.unit }),
      proposedAfterSnapshot: sanitizeSnapshot({ id: prod.id, name: prod.name, unit: defaultUnit }),
      safetyLevel: 'LEVEL_A',
      createdAt,
      status: 'PREVIEW',
      selectedOption: defaultUnit,
    };
  }

  // 9. Invalid Enum Value (Merchant Role)
  if (issue.code === 'INVALID_ENUM_VALUE' && (entity === 'Merchant' || entity === 'merchants')) {
    const merch = await targetDb.merchants.get(recordId);
    if (!merch) throw new Error(`Merchant "${recordId}" not found.`);

    const targetRole = (options?.newTargetId as any) || 'BUYER';
    return {
      repairId,
      repairType: 'NORMALIZE_MERCHANT_ROLE',
      targetEntity: 'Merchant',
      targetRecordId: recordId,
      affectedRecordIds: [recordId],
      reason: `Normalize merchant role "${merch.role}" to valid enum "${targetRole}"`,
      diagnosticCode: issue.code,
      beforeSnapshot: sanitizeSnapshot({ id: merch.id, name: merch.name, role: merch.role }),
      proposedAfterSnapshot: sanitizeSnapshot({ id: merch.id, name: merch.name, role: targetRole }),
      safetyLevel: 'LEVEL_B',
      createdAt,
      status: 'PREVIEW',
      selectedOption: targetRole,
    };
  }

  // 10. Invalid Backup Metadata
  if (issue.code === 'INVALID_BACKUP_METADATA') {
    return {
      repairId,
      repairType: 'REPAIR_CORRUPT_BACKUP_METADATA',
      targetEntity: 'Setting',
      targetRecordId: 'ledger_last_backup_v2',
      affectedRecordIds: ['ledger_last_backup_v2'],
      reason: 'Clear malformed last backup date string in localStorage',
      diagnosticCode: issue.code,
      beforeSnapshot: { key: 'ledger_last_backup_v2', value: 'MALFORMED' },
      proposedAfterSnapshot: { key: 'ledger_last_backup_v2', value: null },
      safetyLevel: 'LEVEL_A',
      createdAt,
      status: 'PREVIEW',
    };
  }

  // Fallback if not specifically handled
  return {
    repairId,
    repairType: 'MANUAL_REVIEW_ONLY',
    targetEntity: entity,
    targetRecordId: recordId,
    affectedRecordIds: [recordId],
    reason: `${issue.title}: ${issue.message}`,
    diagnosticCode: issue.code,
    beforeSnapshot: sanitizeSnapshot({ recordId, entity, details: issue.details }),
    proposedAfterSnapshot: { status: 'MANUAL_REVIEW_REQUIRED' },
    safetyLevel: 'LEVEL_C',
    createdAt,
    status: 'REJECTED',
    error: 'Unrecognized or unsafe issue code for automated repair',
  };
}

/**
 * Executes a confirmed database repair action following the strict safety sequence:
 * BACKUP -> VALIDATE -> ATOMIC TRANSACTION -> AUDIT LOG -> POST-REPAIR VERIFICATION -> ROLLBACK ON ERROR
 */
export async function executeAtomicRepair(
  repairAction: RepairAction,
  userConfirmed: boolean,
  targetDb: ShweLetYarDatabase = db
): Promise<{
  success: boolean;
  message: string;
  auditId?: string;
  postRepairReport?: DatabaseHealthReport;
}> {
  // Step 1: Explicit user confirmation is strictly MANDATORY
  if (!userConfirmed) {
    repairAction.status = 'REJECTED';
    throw new Error('အသုံးပြုသူမှ အတည်မပြုသဖြင့် ဒေတာပြင်ဆင်မှုကို ရပ်တန့်ခဲ့ပါသည် (Explicit user confirmation required).');
  }

  // Step 2: Strict Level C manual restriction
  if (repairAction.safetyLevel === 'LEVEL_C' || repairAction.repairType === 'MANUAL_REVIEW_ONLY') {
    repairAction.status = 'FAILED';
    throw new Error('ဤချို့ယွင်းချက်သည် ငွေစာရင်း သို့မဟုတ် စတော့အရေးကြီးအချက်အလက်ဖြစ်သဖြင့် အလိုအလျောက် ပြင်ဆင်ခွင့်မပြုပါ (Level C Manual Review Required).');
  }

  // Step 3: PRE-REPAIR SAFETY BACKUP
  // 1. Verify database is readable
  let initialReport: DatabaseHealthReport;
  try {
    initialReport = await runDatabaseDiagnostics(targetDb);
  } catch (err: any) {
    repairAction.status = 'FAILED';
    throw new Error(`Database readability check failed prior to repair: ${err?.message || err}. Mutation aborted.`);
  }

  // 2. Generate a complete current-data safety backup snapshot
  let snapshotId: string;
  try {
    snapshotId = await createAutoRecoverySnapshot(
      `Pre-Repair Snapshot [${repairAction.repairType}] for ${repairAction.targetEntity} ${repairAction.targetRecordId}`,
      targetDb
    );
    // 3. Verify backup integrity / existence in storage
    const verifiedSnapshot = await targetDb.recoverySnapshots.get(snapshotId);
    if (!verifiedSnapshot) {
      throw new Error(`Safety backup snapshot "${snapshotId}" could not be verified in storage.`);
    }
    repairAction.backupId = snapshotId;
  } catch (err: any) {
    repairAction.status = 'FAILED';
    throw new Error(`Pre-repair safety backup failed: ${err?.message || err}. Mutation aborted.`);
  }

  const auditId = generateStableId('aud');
  const nowIso = new Date().toISOString();

  // Step 4: ATOMIC REPAIR IN DEXIE TRANSACTION
  try {
    switch (repairAction.repairType) {
      case 'REASSIGN_BROKEN_SUPPLIER_REF': {
        const newSupId = repairAction.selectedOption;
        if (!newSupId) throw new Error('New supplier ID was not provided.');
        const sup = await targetDb.suppliers.get(newSupId);
        if (!sup) throw new Error(`Selected supplier "${newSupId}" does not exist.`);

        await targetDb.transaction('rw', [targetDb.transactions, targetDb.auditLogs], async () => {
          const tx = await targetDb.transactions.get(repairAction.targetRecordId);
          if (!tx) throw new Error(`Transaction "${repairAction.targetRecordId}" not found.`);

          tx.supplierId = newSupId;
          tx.supplierName = sup.name;
          tx.updatedAt = nowIso;
          await targetDb.transactions.put(tx);

          // Audit log inside transaction
          const auditDetails: RepairAuditDetails = {
            repairId: repairAction.repairId,
            repairType: repairAction.repairType,
            entity: repairAction.targetEntity,
            recordId: repairAction.targetRecordId,
            affectedRecords: repairAction.affectedRecordIds,
            beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
            afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
            reason: repairAction.reason,
            diagnosticCode: repairAction.diagnosticCode,
            result: 'SUCCESS',
            backupId: snapshotId,
            appVersion: CURRENT_APP_VERSION,
          };

          const auditEntry: AuditLogEntry = {
            id: auditId,
            action: 'DATABASE_REPAIR',
            timestamp: nowIso,
            entityType: repairAction.targetEntity,
            entityId: repairAction.targetRecordId,
            details: JSON.stringify(auditDetails),
          };
          await targetDb.auditLogs.put(auditEntry);
        });
        break;
      }

      case 'REASSIGN_BROKEN_MERCHANT_REF': {
        const newMerchId = repairAction.selectedOption;
        if (!newMerchId) throw new Error('New merchant ID was not provided.');
        const merch = await targetDb.merchants.get(newMerchId);
        if (!merch) throw new Error(`Selected merchant "${newMerchId}" does not exist.`);

        if (repairAction.targetEntity === 'Sale') {
          await targetDb.transaction('rw', [targetDb.sales, targetDb.auditLogs], async () => {
            const sale = await targetDb.sales.get(repairAction.targetRecordId);
            if (!sale) throw new Error(`Sale "${repairAction.targetRecordId}" not found.`);

            sale.merchantId = newMerchId;
            sale.merchantName = merch.name;
            sale.updatedAt = nowIso;
            await targetDb.sales.put(sale);

            const auditDetails: RepairAuditDetails = {
              repairId: repairAction.repairId,
              repairType: repairAction.repairType,
              entity: repairAction.targetEntity,
              recordId: repairAction.targetRecordId,
              affectedRecords: repairAction.affectedRecordIds,
              beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
              afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
              reason: repairAction.reason,
              diagnosticCode: repairAction.diagnosticCode,
              result: 'SUCCESS',
              backupId: snapshotId,
              appVersion: CURRENT_APP_VERSION,
            };

            await targetDb.auditLogs.put({
              id: auditId,
              action: 'DATABASE_REPAIR',
              timestamp: nowIso,
              entityType: repairAction.targetEntity,
              entityId: repairAction.targetRecordId,
              details: JSON.stringify(auditDetails),
            });
          });
        } else if (repairAction.targetEntity === 'MerchantPurchase') {
          await targetDb.transaction('rw', [targetDb.merchantPurchases, targetDb.auditLogs], async () => {
            const purchase = await targetDb.merchantPurchases.get(repairAction.targetRecordId);
            if (!purchase) throw new Error(`Purchase "${repairAction.targetRecordId}" not found.`);

            purchase.merchantId = newMerchId;
            purchase.merchantName = merch.name;
            purchase.updatedAt = nowIso;
            await targetDb.merchantPurchases.put(purchase);

            const auditDetails: RepairAuditDetails = {
              repairId: repairAction.repairId,
              repairType: repairAction.repairType,
              entity: repairAction.targetEntity,
              recordId: repairAction.targetRecordId,
              affectedRecords: repairAction.affectedRecordIds,
              beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
              afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
              reason: repairAction.reason,
              diagnosticCode: repairAction.diagnosticCode,
              result: 'SUCCESS',
              backupId: snapshotId,
              appVersion: CURRENT_APP_VERSION,
            };

            await targetDb.auditLogs.put({
              id: auditId,
              action: 'DATABASE_REPAIR',
              timestamp: nowIso,
              entityType: repairAction.targetEntity,
              entityId: repairAction.targetRecordId,
              details: JSON.stringify(auditDetails),
            });
          });
        }
        break;
      }

      case 'REASSIGN_BROKEN_PRODUCT_REF': {
        const newProductId = repairAction.selectedOption;
        if (!newProductId) throw new Error('New product ID was not provided.');
        const prod = await targetDb.products.get(newProductId);
        if (!prod) throw new Error(`Selected product "${newProductId}" does not exist.`);

        const brokenProductId = repairAction.affectedRecordIds[1];

        if (repairAction.targetEntity === 'Transaction') {
          await targetDb.transaction('rw', [targetDb.transactions, targetDb.auditLogs], async () => {
            const tx = await targetDb.transactions.get(repairAction.targetRecordId);
            if (!tx) throw new Error(`Transaction "${repairAction.targetRecordId}" not found.`);

            tx.items = (tx.items || []).map((it) => {
              if (it.productId === brokenProductId) {
                return { ...it, productId: newProductId, productName: prod.name };
              }
              return it;
            });
            tx.updatedAt = nowIso;
            await targetDb.transactions.put(tx);

            const auditDetails: RepairAuditDetails = {
              repairId: repairAction.repairId,
              repairType: repairAction.repairType,
              entity: repairAction.targetEntity,
              recordId: repairAction.targetRecordId,
              affectedRecords: repairAction.affectedRecordIds,
              beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
              afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
              reason: repairAction.reason,
              diagnosticCode: repairAction.diagnosticCode,
              result: 'SUCCESS',
              backupId: snapshotId,
              appVersion: CURRENT_APP_VERSION,
            };

            await targetDb.auditLogs.put({
              id: auditId,
              action: 'DATABASE_REPAIR',
              timestamp: nowIso,
              entityType: repairAction.targetEntity,
              entityId: repairAction.targetRecordId,
              details: JSON.stringify(auditDetails),
            });
          });
        } else if (repairAction.targetEntity === 'Sale') {
          await targetDb.transaction('rw', [targetDb.sales, targetDb.auditLogs], async () => {
            const sale = await targetDb.sales.get(repairAction.targetRecordId);
            if (!sale) throw new Error(`Sale "${repairAction.targetRecordId}" not found.`);

            sale.items = (sale.items || []).map((it) => {
              if (it.productId === brokenProductId) {
                return { ...it, productId: newProductId, productName: prod.name };
              }
              return it;
            });
            sale.updatedAt = nowIso;
            await targetDb.sales.put(sale);

            const auditDetails: RepairAuditDetails = {
              repairId: repairAction.repairId,
              repairType: repairAction.repairType,
              entity: repairAction.targetEntity,
              recordId: repairAction.targetRecordId,
              affectedRecords: repairAction.affectedRecordIds,
              beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
              afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
              reason: repairAction.reason,
              diagnosticCode: repairAction.diagnosticCode,
              result: 'SUCCESS',
              backupId: snapshotId,
              appVersion: CURRENT_APP_VERSION,
            };

            await targetDb.auditLogs.put({
              id: auditId,
              action: 'DATABASE_REPAIR',
              timestamp: nowIso,
              entityType: repairAction.targetEntity,
              entityId: repairAction.targetRecordId,
              details: JSON.stringify(auditDetails),
            });
          });
        }
        break;
      }

      case 'DELETE_ORPHAN_ATTACHMENT':
      case 'DELETE_PAYLOADLESS_ATTACHMENT': {
        await targetDb.transaction('rw', [targetDb.attachments, targetDb.auditLogs], async () => {
          await targetDb.attachments.delete(repairAction.targetRecordId);

          const auditDetails: RepairAuditDetails = {
            repairId: repairAction.repairId,
            repairType: repairAction.repairType,
            entity: repairAction.targetEntity,
            recordId: repairAction.targetRecordId,
            affectedRecords: repairAction.affectedRecordIds,
            beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
            afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
            reason: repairAction.reason,
            diagnosticCode: repairAction.diagnosticCode,
            result: 'SUCCESS',
            backupId: snapshotId,
            appVersion: CURRENT_APP_VERSION,
          };

          await targetDb.auditLogs.put({
            id: auditId,
            action: 'DATABASE_REPAIR',
            timestamp: nowIso,
            entityType: repairAction.targetEntity,
            entityId: repairAction.targetRecordId,
            details: JSON.stringify(auditDetails),
          });
        });
        break;
      }

      case 'REASSIGN_ORPHAN_ATTACHMENT': {
        const targetVoucherId = repairAction.selectedOption;
        if (!targetVoucherId) throw new Error('Target voucher ID was not specified.');

        await targetDb.transaction('rw', [targetDb.attachments, targetDb.auditLogs], async () => {
          const att = await targetDb.attachments.get(repairAction.targetRecordId);
          if (!att) throw new Error(`Attachment "${repairAction.targetRecordId}" not found.`);

          att.voucherId = targetVoucherId;
          att.ownerId = targetVoucherId;
          await targetDb.attachments.put(att);

          const auditDetails: RepairAuditDetails = {
            repairId: repairAction.repairId,
            repairType: repairAction.repairType,
            entity: repairAction.targetEntity,
            recordId: repairAction.targetRecordId,
            affectedRecords: repairAction.affectedRecordIds,
            beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
            afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
            reason: repairAction.reason,
            diagnosticCode: repairAction.diagnosticCode,
            result: 'SUCCESS',
            backupId: snapshotId,
            appVersion: CURRENT_APP_VERSION,
          };

          await targetDb.auditLogs.put({
            id: auditId,
            action: 'DATABASE_REPAIR',
            timestamp: nowIso,
            entityType: repairAction.targetEntity,
            entityId: repairAction.targetRecordId,
            details: JSON.stringify(auditDetails),
          });
        });
        break;
      }

      case 'REMOVE_BROKEN_ATTACHMENT_REF': {
        const brokenAttId = repairAction.affectedRecordIds[1];
        if (repairAction.targetEntity === 'Transaction') {
          await targetDb.transaction('rw', [targetDb.transactions, targetDb.auditLogs], async () => {
            const tx = await targetDb.transactions.get(repairAction.targetRecordId);
            if (!tx) throw new Error(`Transaction "${repairAction.targetRecordId}" not found.`);

            tx.attachmentPhotos = (tx.attachmentPhotos || []).filter((id) => id !== brokenAttId);
            tx.updatedAt = nowIso;
            await targetDb.transactions.put(tx);

            const auditDetails: RepairAuditDetails = {
              repairId: repairAction.repairId,
              repairType: repairAction.repairType,
              entity: repairAction.targetEntity,
              recordId: repairAction.targetRecordId,
              affectedRecords: repairAction.affectedRecordIds,
              beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
              afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
              reason: repairAction.reason,
              diagnosticCode: repairAction.diagnosticCode,
              result: 'SUCCESS',
              backupId: snapshotId,
              appVersion: CURRENT_APP_VERSION,
            };

            await targetDb.auditLogs.put({
              id: auditId,
              action: 'DATABASE_REPAIR',
              timestamp: nowIso,
              entityType: repairAction.targetEntity,
              entityId: repairAction.targetRecordId,
              details: JSON.stringify(auditDetails),
            });
          });
        } else if (repairAction.targetEntity === 'Sale') {
          await targetDb.transaction('rw', [targetDb.sales, targetDb.auditLogs], async () => {
            const sale = await targetDb.sales.get(repairAction.targetRecordId);
            if (!sale) throw new Error(`Sale "${repairAction.targetRecordId}" not found.`);

            sale.attachmentPhotos = (sale.attachmentPhotos || []).filter((id) => id !== brokenAttId);
            sale.updatedAt = nowIso;
            await targetDb.sales.put(sale);

            const auditDetails: RepairAuditDetails = {
              repairId: repairAction.repairId,
              repairType: repairAction.repairType,
              entity: repairAction.targetEntity,
              recordId: repairAction.targetRecordId,
              affectedRecords: repairAction.affectedRecordIds,
              beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
              afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
              reason: repairAction.reason,
              diagnosticCode: repairAction.diagnosticCode,
              result: 'SUCCESS',
              backupId: snapshotId,
              appVersion: CURRENT_APP_VERSION,
            };

            await targetDb.auditLogs.put({
              id: auditId,
              action: 'DATABASE_REPAIR',
              timestamp: nowIso,
              entityType: repairAction.targetEntity,
              entityId: repairAction.targetRecordId,
              details: JSON.stringify(auditDetails),
            });
          });
        }
        break;
      }

      case 'RESTORE_MISSING_UNIT': {
        const unit = repairAction.selectedOption ?? 'ခု';
        await targetDb.transaction('rw', [targetDb.products, targetDb.auditLogs], async () => {
          const prod = await targetDb.products.get(repairAction.targetRecordId);
          if (!prod) throw new Error(`Product "${repairAction.targetRecordId}" not found.`);

          prod.unit = unit;
          prod.updatedAt = nowIso;
          await targetDb.products.put(prod);

          const auditDetails: RepairAuditDetails = {
            repairId: repairAction.repairId,
            repairType: repairAction.repairType,
            entity: repairAction.targetEntity,
            recordId: repairAction.targetRecordId,
            affectedRecords: repairAction.affectedRecordIds,
            beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
            afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
            reason: repairAction.reason,
            diagnosticCode: repairAction.diagnosticCode,
            result: 'SUCCESS',
            backupId: snapshotId,
            appVersion: CURRENT_APP_VERSION,
          };

          await targetDb.auditLogs.put({
            id: auditId,
            action: 'DATABASE_REPAIR',
            timestamp: nowIso,
            entityType: repairAction.targetEntity,
            entityId: repairAction.targetRecordId,
            details: JSON.stringify(auditDetails),
          });
        });
        break;
      }

      case 'NORMALIZE_MERCHANT_ROLE': {
        const role = (repairAction.selectedOption as any) || 'BUYER';
        await targetDb.transaction('rw', [targetDb.merchants, targetDb.auditLogs], async () => {
          const merch = await targetDb.merchants.get(repairAction.targetRecordId);
          if (!merch) throw new Error(`Merchant "${repairAction.targetRecordId}" not found.`);

          merch.role = role;
          merch.updatedAt = nowIso;
          await targetDb.merchants.put(merch);

          const auditDetails: RepairAuditDetails = {
            repairId: repairAction.repairId,
            repairType: repairAction.repairType,
            entity: repairAction.targetEntity,
            recordId: repairAction.targetRecordId,
            affectedRecords: repairAction.affectedRecordIds,
            beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
            afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
            reason: repairAction.reason,
            diagnosticCode: repairAction.diagnosticCode,
            result: 'SUCCESS',
            backupId: snapshotId,
            appVersion: CURRENT_APP_VERSION,
          };

          await targetDb.auditLogs.put({
            id: auditId,
            action: 'DATABASE_REPAIR',
            timestamp: nowIso,
            entityType: repairAction.targetEntity,
            entityId: repairAction.targetRecordId,
            details: JSON.stringify(auditDetails),
          });
        });
        break;
      }

      case 'REPAIR_CORRUPT_BACKUP_METADATA': {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('ledger_last_backup_v2');
        }

        await targetDb.transaction('rw', [targetDb.auditLogs], async () => {
          const auditDetails: RepairAuditDetails = {
            repairId: repairAction.repairId,
            repairType: repairAction.repairType,
            entity: repairAction.targetEntity,
            recordId: repairAction.targetRecordId,
            affectedRecords: repairAction.affectedRecordIds,
            beforeSummary: sanitizeSnapshot(repairAction.beforeSnapshot),
            afterSummary: sanitizeSnapshot(repairAction.proposedAfterSnapshot),
            reason: repairAction.reason,
            diagnosticCode: repairAction.diagnosticCode,
            result: 'SUCCESS',
            backupId: snapshotId,
            appVersion: CURRENT_APP_VERSION,
          };

          await targetDb.auditLogs.put({
            id: auditId,
            action: 'DATABASE_REPAIR',
            timestamp: nowIso,
            entityType: repairAction.targetEntity,
            entityId: repairAction.targetRecordId,
            details: JSON.stringify(auditDetails),
          });
        });
        break;
      }

      default:
        throw new Error(`Unimplemented repair type: ${repairAction.repairType}`);
    }
  } catch (err: any) {
    // Failure during repair transaction rolls back automatically
    repairAction.status = 'FAILED';
    repairAction.error = err?.message || String(err);

    // Record failure in audit logs if possible
    try {
      await targetDb.auditLogs.put({
        id: generateStableId('aud_err'),
        action: 'DATABASE_REPAIR',
        timestamp: new Date().toISOString(),
        entityType: repairAction.targetEntity,
        entityId: repairAction.targetRecordId,
        details: JSON.stringify({
          repairId: repairAction.repairId,
          repairType: repairAction.repairType,
          result: 'FAILED',
          error: String(err?.message || err),
          backupId: snapshotId,
        }),
      });
    } catch {
      // Ignore secondary audit logging error
    }

    throw new Error(`Repair transaction failed and rolled back: ${err?.message || err}`);
  }

  // Step 5: POST-REPAIR VERIFICATION
  let postRepairReport: DatabaseHealthReport;
  try {
    postRepairReport = await runDatabaseDiagnostics(targetDb);
  } catch (err: any) {
    // Database unreadable after mutation -> Critical rollback to snapshot!
    repairAction.status = 'ROLLED_BACK';
    try {
      await restoreFromSnapshot(snapshotId, targetDb);
    } catch (restoreErr) {
      console.error('Fatal emergency rollback error:', restoreErr);
    }
    throw new Error(`Post-repair database diagnostics crashed: ${err?.message || err}. Database rolled back to safety backup.`);
  }

  // Verify that the targeted issue is actually resolved on that record
  const remainingTargetIssue = postRepairReport.results.find(
    (r) => r.code === repairAction.diagnosticCode && r.recordId === repairAction.targetRecordId
  );

  if (remainingTargetIssue) {
    // Issue was not solved
    repairAction.status = 'FAILED';
    throw new Error(`Post-repair verification failed: targeted issue "${repairAction.diagnosticCode}" is still present on record "${repairAction.targetRecordId}".`);
  }

  // Verify no new CRITICAL issues were introduced
  if (postRepairReport.criticalCount > initialReport.criticalCount) {
    // New critical issues introduced! Rollback!
    repairAction.status = 'ROLLED_BACK';
    try {
      await restoreFromSnapshot(snapshotId, targetDb);
    } catch (restoreErr) {
      console.error('Fatal emergency rollback error:', restoreErr);
    }
    throw new Error('Post-repair verification failed: new critical issues were introduced. Database rolled back to safety backup.');
  }

  repairAction.status = 'COMPLETED';
  return {
    success: true,
    message: `ဒေတာဘေ့စ် ပြင်ဆင်မှု အောင်မြင်စွာ ပြီးမြောက်ပါပြီ (Safety Snapshot: ${snapshotId})`,
    auditId,
    postRepairReport,
  };
}

/**
 * Retrieves the complete audit history of all database repair actions.
 * Read-only: Does not allow modifying or clearing history.
 */
export async function getRepairHistory(targetDb: ShweLetYarDatabase = db): Promise<AuditLogEntry[]> {
  try {
    const logs = await targetDb.auditLogs.where('action').equals('DATABASE_REPAIR').toArray();
    return logs.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  } catch (err) {
    console.error('Failed to get repair history', err);
    return [];
  }
}
