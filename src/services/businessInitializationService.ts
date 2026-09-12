import { db } from '../db/database';
import { recordAuditEvent } from './auditTrailService';
import {
  BusinessInitializationRecord,
  InitializationState,
  OpeningPosition,
  OpeningCashPosition,
  OpeningReceivablePosition,
  OpeningPayablePosition,
  OpeningAdvancePosition,
  OpeningRawMaterialPosition,
  OpeningFinishedGoodsPosition,
  OpeningIssuedMaterialPosition,
  ShopSettings,
} from '../types';
import { generateStableId } from '../utils/idGenerator';
import { getTodayDateString } from '../utils/storage';

export function createEmptyOpeningPosition(): OpeningPosition {
  return {
    cash: { cashAmount: 0, notes: '' },
    receivables: [],
    payables: [],
    advances: [],
    rawMaterials: [],
    finishedGoods: [],
    issuedMaterials: [],
    openingCapital: 0,
    notes: '',
  };
}

export function createDefaultBusinessInitialization(): BusinessInitializationRecord {
  const now = new Date().toISOString();
  return {
    id: 'current_business',
    state: 'NOT_INITIALIZED',
    businessName: '',
    tagline: '',
    ownerName: '',
    phone: '',
    address: '',
    businessType: '',
    accountingStartDate: getTodayDateString(),
    openingPosition: createEmptyOpeningPosition(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Retrieves the persisted business initialization record from Dexie settings table.
 */
export async function getBusinessInitialization(): Promise<BusinessInitializationRecord> {
  try {
    const record = await db.settings.get('businessInitialization');
    if (record && record.value) {
      const val = record.value as BusinessInitializationRecord;
      // Ensure nested fields exist
      if (!val.openingPosition) {
        val.openingPosition = createEmptyOpeningPosition();
      }
      return val;
    }
  } catch (e) {
    console.error('Error fetching business initialization:', e);
  }
  return createDefaultBusinessInitialization();
}

/**
 * Validates a business initialization record for completeness and financial sanity.
 */
export function validateBusinessInitialization(record: BusinessInitializationRecord): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!record.businessName || !record.businessName.trim()) {
    errors.push('စီးပွားရေးလုပ်ငန်း/ဆိုင်အမည် ထည့်သွင်းရန် လိုအပ်ပါသည်');
  }

  if (!record.accountingStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(record.accountingStartDate)) {
    errors.push('စာရင်း စတင်အသုံးပြုမည့် ရက်စွဲ မှန်ကန်စွာ ထည့်သွင်းရန် လိုအပ်ပါသည် (YYYY-MM-DD)');
  }

  const cashAmount = record.openingPosition?.cash?.cashAmount ?? 0;
  if (isNaN(cashAmount) || cashAmount < 0) {
    errors.push('အဖွင့် လက်ဝယ်ငွေသား ပမာဏသည် ၀ သို့မဟုတ် ၀ ထက် ကြီးရပါမည်');
  }

  const openingCapital = record.openingPosition?.openingCapital ?? 0;
  if (isNaN(openingCapital) || openingCapital < 0) {
    errors.push('အဖွင့် မတည်ငွေ ပမာဏသည် ၀ သို့မဟုတ် ၀ ထက် ကြီးရပါမည်');
  }

  // Validate Receivables
  (record.openingPosition?.receivables || []).forEach((r, idx) => {
    if (!r.merchantName || !r.merchantName.trim()) {
      errors.push(`ရရန်ကျန်ငွေ စာရင်းစဉ် (${idx + 1}) တွင် ကုန်သည်အမည် ထည့်သွင်းပါ`);
    }
    if (isNaN(r.amount) || r.amount < 0) {
      errors.push(`ရရန်ကျန်ငွေ စာရင်းစဉ် (${idx + 1}) တွင် ပမာဏ မမှန်ကန်ပါ`);
    }
  });

  // Validate Payables
  (record.openingPosition?.payables || []).forEach((p, idx) => {
    if (!p.counterpartName || !p.counterpartName.trim()) {
      errors.push(`ပေးရန်ရှိငွေ စာရင်းစဉ် (${idx + 1}) တွင် အမည် ထည့်သွင်းပါ`);
    }
    if (isNaN(p.amount) || p.amount < 0) {
      errors.push(`ပေးရန်ရှိငွေ စာရင်းစဉ် (${idx + 1}) တွင် ပမာဏ မမှန်ကန်ပါ`);
    }
  });

  // Validate Finished Goods
  (record.openingPosition?.finishedGoods || []).forEach((fg, idx) => {
    if (!fg.productName || !fg.productName.trim()) {
      errors.push(`အဖွင့်ကုန်ချော စာရင်းစဉ် (${idx + 1}) တွင် ကုန်ပစ္စည်းအမည် ထည့်သွင်းပါ`);
    }
    if (isNaN(fg.quantity) || fg.quantity < 0) {
      errors.push(`အဖွင့်ကုန်ချော စာရင်းစဉ် (${idx + 1}) တွင် အရေအတွက် မမှန်ကန်ပါ`);
    }
    if (isNaN(fg.unitPrice) || fg.unitPrice < 0) {
      errors.push(`အဖွင့်ကုန်ချော စာရင်းစဉ် (${idx + 1}) တွင် တန်ဖိုး/စျေးနှုန်း မမှန်ကန်ပါ`);
    }
  });

  // Validate Advances
  (record.openingPosition?.advances || []).forEach((adv, idx) => {
    if (!adv.counterpartName || !adv.counterpartName.trim()) {
      errors.push(`အကြိုပေးငွေ စာရင်းစဉ် (${idx + 1}) တွင် အမည် ထည့်သွင်းပါ`);
    }
    if (isNaN(adv.amount) || adv.amount < 0) {
      errors.push(`အကြိုပေးငွေ စာရင်းစဉ် (${idx + 1}) တွင် ပမာဏ မမှန်ကန်ပါ`);
    }
  });

  // Validate Issued Materials to Workers
  (record.openingPosition?.issuedMaterials || []).forEach((iss, idx) => {
    if (!iss.workerName || !iss.workerName.trim()) {
      errors.push(`လုပ်သားပေးထုတ်ကုန်ကြမ်း စာရင်းစဉ် (${idx + 1}) တွင် လုပ်သားအမည် ထည့်သွင်းပါ`);
    }
    if (isNaN(iss.quantity) || iss.quantity < 0) {
      errors.push(`လုပ်သားပေးထုတ်ကုန်ကြမ်း စာရင်းစဉ် (${idx + 1}) တွင် အရေအတွက် မမှန်ကန်ပါ`);
    }
    if (isNaN(iss.totalValue) || iss.totalValue < 0) {
      errors.push(`လုပ်သားပေးထုတ်ကုန်ကြမ်း စာရင်းစဉ် (${idx + 1}) တွင် ကုန်ကြမ်းတန်ဖိုး မမှန်ကန်ပါ`);
    }
    if (isNaN(iss.cashAdvance) || iss.cashAdvance < 0) {
      errors.push(`လုပ်သားပေးထုတ်ကုန်ကြမ်း စာရင်းစဉ် (${idx + 1}) တွင် ထုတ်ပေးငွေ မမှန်ကန်ပါ`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Saves a draft or step state (e.g. SETUP_IN_PROGRESS or READY_FOR_CONFIRMATION).
 */
export async function saveBusinessInitializationDraft(
  draft: Partial<BusinessInitializationRecord>
): Promise<BusinessInitializationRecord> {
  const current = await getBusinessInitialization();

  if (current.state === 'ACTIVE' && draft.state && draft.state !== 'ACTIVE') {
    throw new Error('အတည်ပြုပြီးသော စီးပွားရေးလုပ်ငန်း စာရင်းအား မူလအခြေအနေသို့ အလိုအလျောက် ပြန်ပြောင်း၍မရပါ');
  }

  if (current.state !== 'ACTIVE' && draft.state === 'ACTIVE') {
    throw new Error('စီးပွားရေးလုပ်ငန်း အတည်ပြုခြင်းအား confirmAndActivateBusiness ဖြင့်သာ ဆောင်ရွက်ရပါမည်');
  }

  const nowIso = new Date().toISOString();
  const updated: BusinessInitializationRecord = {
    ...current,
    ...draft,
    openingPosition: {
      ...current.openingPosition,
      ...(draft.openingPosition || {}),
    },
    updatedAt: nowIso,
  };

  await db.settings.put({
    key: 'businessInitialization',
    value: updated,
    updatedAt: nowIso,
  });

  return updated;
}

/**
 * Atomically confirms and activates the business opening position in Dexie.
 * Enforces idempotency and updates all primary ledgers (stock, cash, debts).
 */
export async function confirmAndActivateBusiness(
  record: BusinessInitializationRecord,
  options?: { operationId?: string }
): Promise<BusinessInitializationRecord> {
  const current = await getBusinessInitialization();

  const opId = options?.operationId || record.operationId || generateStableId('init_op');

  // Idempotency Guard: If already ACTIVE and has same operationId or is already active, return cleanly
  if (current.state === 'ACTIVE') {
    if (current.operationId === opId || current.activationTimestamp) {
      return current;
    }
    return current;
  }

  // Validate inputs
  const validation = validateBusinessInitialization(record);
  if (!validation.isValid) {
    throw new Error(`လုပ်ငန်းတည်ထောင်မှု အချက်အလက် မပြည့်စုံပါ:\n- ${validation.errors.join('\n- ')}`);
  }

  const nowIso = new Date().toISOString();
  const activeRecord: BusinessInitializationRecord = {
    ...record,
    state: 'ACTIVE',
    activationTimestamp: nowIso,
    activationDate: getTodayDateString(),
    operationId: opId,
    updatedAt: nowIso,
  };

  // Atomic Dexie transaction across affected tables
  await db.transaction(
    'rw',
    [
      db.settings,
      db.products,
      db.suppliers,
      db.merchants,
      db.stockMovements,
      db.cashMovements,
      db.auditLogs,
    ],
    async () => {
      // 1. Persist Business Initialization Record
      await db.settings.put({
        key: 'businessInitialization',
        value: activeRecord,
        updatedAt: nowIso,
      });

      // 2. Update Shop Settings
      const shopSettingsRecord = await db.settings.get('shopSettings');
      const currentShopSettings: ShopSettings = (shopSettingsRecord?.value as ShopSettings) || {
        shopName: '',
      };

      await db.settings.put({
        key: 'shopSettings',
        value: {
          ...currentShopSettings,
          shopName: record.businessName,
          ownerName: record.ownerName || '',
          phone: record.phone || '',
          address: record.address || '',
          tagline: record.tagline || '',
        },
        updatedAt: nowIso,
      });

      // 3. Apply Opening Finished Goods -> products + stockMovements
      if (record.openingPosition.finishedGoods && record.openingPosition.finishedGoods.length > 0) {
        for (const item of record.openingPosition.finishedGoods) {
          if (!item.productId) continue;
          const p = await db.products.get(item.productId);
          if (p) {
            await db.products.update(item.productId, {
              openingStock: item.quantity,
              currentStock: item.quantity,
            });

            await db.stockMovements.add({
              id: generateStableId('sm_open'),
              productId: p.id,
              productName: p.name,
              unit: p.unit,
              movementType: 'OPENING_BALANCE',
              direction: 'IN',
              quantity: item.quantity,
              signedQuantity: item.quantity,
              unitPrice: item.unitPrice || p.defaultPrice || 0,
              totalValue: item.quantity * (item.unitPrice || p.defaultPrice || 0),
              referenceType: 'OPENING',
              referenceId: `opening_${p.id}`,
              referenceVoucherNo: 'OPENING-STOCK',
              transactionDate: record.accountingStartDate,
              transactionTime: '00:00:00',
              status: 'COMPLETED',
              notes: item.notes || 'အဖွင့် ကုန်ပစ္စည်း လက်ကျန် စာရင်း',
              idempotencyKey: generateStableId(`ik_sm_${p.id}`),
              schemaVersion: 1,
              createdAt: nowIso,
            });
          }
        }
      }

      // 4. Apply Opening Cash -> cashMovements
      if (record.openingPosition.cash && record.openingPosition.cash.cashAmount > 0) {
        await db.cashMovements.add({
          id: generateStableId('cm_open'),
          type: 'OPENING_FLOAT',
          direction: 'IN',
          amount: record.openingPosition.cash.cashAmount,
          signedAmount: record.openingPosition.cash.cashAmount,
          referenceType: 'OPENING',
          referenceId: 'opening_cash_float',
          referenceVoucherNo: 'OPENING-CASH',
          transactionDate: record.accountingStartDate,
          transactionTime: '00:00:00',
          status: 'COMPLETED',
          description: record.openingPosition.cash.notes || 'အဖွင့် လက်ဝယ်ငွေသား စာရင်း',
          idempotencyKey: generateStableId('ik_cm_open'),
          schemaVersion: 1,
          createdAt: nowIso,
        });
      }

      // 5. Apply Opening Receivables -> merchants
      if (record.openingPosition.receivables && record.openingPosition.receivables.length > 0) {
        for (const r of record.openingPosition.receivables) {
          if (!r.merchantId) continue;
          const m = await db.merchants.get(r.merchantId);
          if (m) {
            await db.merchants.update(r.merchantId, {
              currentReceivableBalance: r.amount,
            });
          }
        }
      }

      // 6. Apply Opening Payables & Advances -> suppliers
      if (record.openingPosition.payables && record.openingPosition.payables.length > 0) {
        for (const p of record.openingPosition.payables) {
          if (p.supplierId) {
            const s = await db.suppliers.get(p.supplierId);
            if (s) {
              await db.suppliers.update(p.supplierId, {
                payableBalance: p.amount,
              });
            }
          }
        }
      }

      if (record.openingPosition.advances && record.openingPosition.advances.length > 0) {
        for (const adv of record.openingPosition.advances) {
          if (adv.counterpartId) {
            const s = await db.suppliers.get(adv.counterpartId);
            if (s) {
              await db.suppliers.update(adv.counterpartId, {
                currentAdvanceBalance: adv.amount,
                totalAdvancesGiven: adv.amount,
              });
            }
          }
        }
      }

      if (record.openingPosition.issuedMaterials && record.openingPosition.issuedMaterials.length > 0) {
        for (const iss of record.openingPosition.issuedMaterials) {
          if (iss.workerId) {
            const s = await db.suppliers.get(iss.workerId);
            if (s) {
              const currentMat = s.totalMaterialCreditGiven || 0;
              const currentAdv = s.currentAdvanceBalance || 0;
              await db.suppliers.update(iss.workerId, {
                totalMaterialCreditGiven: currentMat + (iss.totalValue || 0),
                currentAdvanceBalance: currentAdv + (iss.cashAdvance || 0),
              });
            }
          }
        }
      }

      // 7. Audit Log using canonical auditTrailService
      await recordAuditEvent(
        {
          action: 'BUSINESS_INITIALIZATION_ACTIVATED',
          actionType: 'SYSTEM_ACTION',
          referenceType: 'BUSINESS_INITIALIZATION',
          referenceId: activeRecord.id,
          details: `လုပ်ငန်းအမည်: ${activeRecord.businessName}, စာရင်းစတင်ရက်: ${activeRecord.accountingStartDate}, အဖွင့်ငွေသား: ${activeRecord.openingPosition.cash.cashAmount} ကျပ်, အဖွင့်မတည်ငွေ: ${activeRecord.openingPosition.openingCapital} ကျပ်`,
          timestamp: nowIso,
        },
        db
      );
    }
  );

  return activeRecord;
}

/**
 * Service level guard: Prevents demo seeding or demo data resets if business is ACTIVE.
 */
export async function guardActiveBusinessOperation(actionName: string): Promise<void> {
  const current = await getBusinessInitialization();
  if (current.state === 'ACTIVE') {
    throw new Error(
      `"${actionName}" မပြုလုပ်နိုင်ပါ - စီးပွားရေးလုပ်ငန်း လက်တွေ့စတင်အသုံးပြုနေပြီ ဖြစ်ပါသည်`
    );
  }
}
