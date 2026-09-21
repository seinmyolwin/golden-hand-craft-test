import { db } from '../db/database';
import { recordAuditEvent } from './auditTrailService';
import { enforcePermission } from './authorizationService';
import { verifyOwnerPin } from './cryptoSecurity';
import { DEFAULT_PRODUCTS } from '../data/defaultData';
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
  AppLockSettings,
  Product,
  Supplier,
  Merchant,
} from '../types';

export type {
  OpeningPosition,
  OpeningCashPosition,
  OpeningReceivablePosition,
  OpeningPayablePosition,
  OpeningAdvancePosition,
  OpeningRawMaterialPosition,
  OpeningFinishedGoodsPosition,
  OpeningIssuedMaterialPosition,
};
import { generateStableId } from '../utils/idGenerator';
import { getTodayDateString, STORAGE_KEYS } from '../utils/storage';

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
  await enforcePermission('BUSINESS_INITIALIZATION', 'စီးပွားရေးလုပ်ငန်း စတင်တည်ထောင်မှု မူကြမ်းပြင်ဆင်ခြင်း');
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
  await enforcePermission('BUSINESS_INITIALIZATION', 'စီးပွားရေးလုပ်ငန်း စတင်တည်ထောင်မှု အတည်ပြုဖွင့်လှစ်ခြင်း');
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
 * Checks whether the business has been activated / Go-Live is completed.
 */
export async function checkIsBusinessLive(targetDb = db): Promise<boolean> {
  try {
    const initRecord = await targetDb.settings.get('businessInitialization');
    if (initRecord && (initRecord.value as BusinessInitializationRecord)?.state === 'ACTIVE') {
      return true;
    }
    const goLiveRecord = await targetDb.settings.get('goLive');
    if (goLiveRecord && (goLiveRecord.value as any)?.isLive === true) {
      return true;
    }
    const shopSettingsRecord = await targetDb.settings.get('shopSettings');
    if (shopSettingsRecord && (shopSettingsRecord.value as ShopSettings)?.isLiveConfirmed === true) {
      return true;
    }
  } catch (e) {
    console.error('Error checking Go-Live status:', e);
  }
  return false;
}

/**
 * Automatically purges all demo/sample transactions, demo categories, and demo products,
 * keeping ONLY owner-created products, categories, and opening balances.
 */
export async function cleanupDemoDataForGoLive(options?: {
  customProducts?: Product[];
  customSuppliers?: Supplier[];
  customMerchants?: Merchant[];
  targetDb?: typeof db;
}): Promise<{
  cleanedProducts: Product[];
  cleanedSuppliers: Supplier[];
  cleanedMerchants: Merchant[];
}> {
  const targetDb = options?.targetDb || db;
  const nowIso = new Date().toISOString();

  const demoProductIds = new Set(DEFAULT_PRODUCTS.map((p) => p.id));
  const currentProducts = options?.customProducts || (await targetDb.products.toArray());
  const currentSuppliers = options?.customSuppliers || (await targetDb.suppliers.toArray());
  const currentMerchants = options?.customMerchants || (await targetDb.merchants.toArray());

  // Keep only owner-created products (products with custom IDs or explicitly created by owner)
  // or products that have custom names / opening balances.
  const ownerProducts: Product[] = currentProducts.filter(
    (p) => !demoProductIds.has(p.id) || (p as any).isUserCreated === true
  );

  // Guard against re-running Go-Live on an already active business
  const initRecord = await targetDb.settings.get('businessInitialization');
  const currentInit = initRecord?.value as BusinessInitializationRecord | undefined;
  if (currentInit?.state === 'ACTIVE') {
    throw new Error('စီးပွားရေးလုပ်ငန်း စာရင်းဖွင့်ခြင်း (Go-Live) သည် ACTIVE ဖြစ်ပြီးဖြစ်သဖြင့် ထပ်မံလုပ်ဆောင်၍ မရပါ');
  }

  // If the owner has opening position products, preserve them
  const openingPosition = currentInit?.openingPosition;
  if (openingPosition?.finishedGoods && openingPosition.finishedGoods.length > 0) {
    const openingProductIds = new Set(openingPosition.finishedGoods.map((fg) => fg.productId));
    currentProducts.forEach((p) => {
      if (openingProductIds.has(p.id) && !ownerProducts.some((op) => op.id === p.id)) {
        ownerProducts.push(p);
      }
    });
  }

  // Ensure owner products have clean zeroed stock if not specified in opening position
  const cleanedProducts: Product[] = ownerProducts.map((p) => ({
    ...p,
    openingStock: p.openingStock ?? 0,
    currentStock: p.currentStock ?? p.openingStock ?? 0,
    minStockAlert: p.minStockAlert || 10,
    active: true,
  }));

  // Clean suppliers and merchants of demo transactions/balances
  const demoSupplierIds = new Set(['s-1', 's-2', 's-3', 's-4', 's-5', 's-6']);
  const demoMerchantIds = new Set(['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6']);

  const ownerSuppliers: Supplier[] = currentSuppliers.filter(
    (s) => !demoSupplierIds.has(s.id) || (s as any).isUserCreated === true
  );
  const cleanedSuppliers: Supplier[] = ownerSuppliers.map((s) => ({
    ...s,
    initialAdvance: s.initialAdvance ?? 0,
    currentAdvanceBalance: s.currentAdvanceBalance ?? 0,
    totalGoodsValueDelivered: 0,
    totalAdvanceGiven: 0,
    totalMaterialCreditGiven: 0,
    totalRepaymentReceived: 0,
  }));

  const ownerMerchants: Merchant[] = currentMerchants.filter(
    (m) => !demoMerchantIds.has(m.id) || (m as any).isUserCreated === true
  );
  const cleanedMerchants: Merchant[] = ownerMerchants.map((m) => ({
    ...m,
    currentReceivableBalance: m.currentReceivableBalance ?? 0,
    payableBalance: 0,
    totalPurchasesValue: 0,
    totalPaidAmount: 0,
    totalPurchasedFromMerchant: 0,
  }));

  // Extract any owner-defined raw materials from opening position
  const ownerRawPresets = (openingPosition?.rawMaterials && openingPosition.rawMaterials.length > 0)
    ? openingPosition.rawMaterials.map((rm, idx) => ({
        id: `rm-owner-${idx + 1}`,
        name: rm.materialName || (rm as any).name || 'ကုန်ကြမ်း',
        category: (rm as any).category || 'OTHER',
        categoryLabel: (rm as any).categoryLabel || 'ကုန်ကြမ်း',
        defaultUnit: rm.unit || 'ခု',
        defaultUnitPrice: rm.unitPrice || 0,
        isUserCreated: true,
      }))
    : [];

  // Clean all demo transactions in database tables
  await targetDb.transaction(
    'rw',
    [
      targetDb.products,
      targetDb.suppliers,
      targetDb.merchants,
      targetDb.transactions,
      targetDb.sales,
      targetDb.orders,
      targetDb.peerTrades,
      targetDb.stockAdjustments,
      targetDb.merchantPurchases,
      targetDb.dailyClosings,
      targetDb.softDeletedItems,
      targetDb.rawMaterialPresets,
    ],
    async () => {
      // Clear all demo activity ledgers
      await targetDb.transactions.clear();
      await targetDb.sales.clear();
      await targetDb.orders.clear();
      await targetDb.peerTrades.clear();
      await targetDb.stockAdjustments.clear();
      await targetDb.merchantPurchases.clear();
      await targetDb.dailyClosings.clear();
      await targetDb.softDeletedItems.clear();

      // Clear all sample raw material presets and add owner's presets if defined
      await targetDb.rawMaterialPresets.clear();
      if (ownerRawPresets.length > 0) {
        await targetDb.rawMaterialPresets.bulkAdd(ownerRawPresets as any);
      }

      // Replace products with cleaned owner products
      await targetDb.products.clear();
      if (cleanedProducts.length > 0) {
        await targetDb.products.bulkAdd(cleanedProducts);
      }

      // Replace suppliers with cleaned owner suppliers
      await targetDb.suppliers.clear();
      if (cleanedSuppliers.length > 0) {
        await targetDb.suppliers.bulkAdd(cleanedSuppliers);
      }

      // Replace merchants with cleaned owner merchants
      await targetDb.merchants.clear();
      if (cleanedMerchants.length > 0) {
        await targetDb.merchants.bulkAdd(cleanedMerchants);
      }
    }
  );

  // Sync with local storage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.RAW_MATERIAL_PRESETS, JSON.stringify(ownerRawPresets));
    localStorage.setItem('ledger_zero_settings_activated', 'true');
  }

  return {
    cleanedProducts,
    cleanedSuppliers,
    cleanedMerchants,
  };
}

export interface ExecuteGoLiveOptions {
  pin?: string;
  doubleConfirmed: boolean;
  appLockSettings?: AppLockSettings | null;
  shopSettings?: ShopSettings;
  businessName?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  tagline?: string;
  targetDb?: typeof db;
  customProducts?: Product[];
  customSuppliers?: Supplier[];
  customMerchants?: Merchant[];
  openingPosition?: OpeningPosition;
}

/**
 * Validates Owner PIN + double-confirmation, persists "Go-Live" state in db.settings,
 * applies opening positions, and purges all demo/sample data automatically.
 */
export async function executeGoLive(options: ExecuteGoLiveOptions): Promise<{
  businessInitialization: BusinessInitializationRecord;
  cleanedProducts: Product[];
  cleanedSuppliers: Supplier[];
  cleanedMerchants: Merchant[];
}> {
  const targetDb = options.targetDb || db;
  const nowIso = new Date().toISOString();
  const today = getTodayDateString();

  // 0. Check if business is already ACTIVE/Live
  const isAlreadyLive = await checkIsBusinessLive(targetDb);
  if (isAlreadyLive) {
    throw new Error('လက်ရှိစနစ်သည် Go-Live (ACTIVE) အဖြစ် စတင်အသုံးပြုနေပြီး ဖြစ်ပါသည်။ အစပျိုးစာရင်းအား ထပ်မံပြင်ဆင်ခွင့်မရှိပါ');
  }

  // 1. Enforce Double-Confirmation
  if (!options.doubleConfirmed) {
    throw new Error('လက်တွေ့စတင်အသုံးပြုရန် သဘောတူညီချက် (Double-confirm) ကို အမှန်ခြစ်ပေးရန် လိုအပ်ပါသည်');
  }

  // 2. Enforce Owner PIN verification - mandatory PIN setup or verification
  const hasConfiguredPin = Boolean(
    options.appLockSettings?.pinHash ||
      options.appLockSettings?.passcode ||
      options.appLockSettings?.pin
  );

  if (!hasConfiguredPin) {
    throw new Error('ဆိုင်ရှင် PIN စကားဝှက် သတ်မှတ်ထားခြင်း မရှိပါ။ လုပ်ဆောင်ချက် မပြုလုပ်မီ ဆိုင်ရှင် PIN သတ်မှတ်ပါ');
  } else {
    if (!options.pin || !options.pin.trim()) {
      throw new Error('ဆိုင်ရှင် PIN စကားဝှက် ရိုက်ထည့်ပေးရန် လိုအပ်ပါသည်');
    }
    const isPinValid = await verifyOwnerPin(options.pin, options.appLockSettings);
    if (!isPinValid) {
      throw new Error('ဆိုင်ရှင် PIN စကားဝှက် မှားယွင်းနေပါသည်။ ပြန်လည်စစ်ဆေးပါ');
    }
  }

  // 3. Retrieve or create business initialization record
  const currentInit = await getBusinessInitialization();
  const activeRecord: BusinessInitializationRecord = {
    ...currentInit,
    businessName: options.businessName || currentInit.businessName || options.shopSettings?.shopName || 'ရွှေလက်ရာ',
    ownerName: options.ownerName || currentInit.ownerName || options.shopSettings?.ownerName || '',
    phone: options.phone || currentInit.phone || options.shopSettings?.phone || '',
    address: options.address || currentInit.address || options.shopSettings?.address || '',
    tagline: options.tagline || currentInit.tagline || options.shopSettings?.tagline || '',
    openingPosition: options.openingPosition || currentInit.openingPosition || createEmptyOpeningPosition(),
    state: 'ACTIVE',
    accountingStartDate: currentInit.accountingStartDate || today,
    activationTimestamp: nowIso,
    activationDate: today,
    operationId: generateStableId('golive_op'),
    updatedAt: nowIso,
  };

  // 4. Purge demo data and retain owner-created data
  const { cleanedProducts, cleanedSuppliers, cleanedMerchants } = await cleanupDemoDataForGoLive({
    customProducts: options.customProducts,
    customSuppliers: options.customSuppliers,
    customMerchants: options.customMerchants,
    targetDb,
  });

  // 5. Persist Go-Live states and Opening Position to Dexie
  await targetDb.transaction(
    'rw',
    [
      targetDb.settings,
      targetDb.products,
      targetDb.suppliers,
      targetDb.merchants,
      targetDb.stockMovements,
      targetDb.cashMovements,
    ],
    async () => {
      // A. Business Initialization record
      await targetDb.settings.put({
        key: 'businessInitialization',
        value: activeRecord,
        updatedAt: nowIso,
      });

      // B. Explicit Go-Live status record
      await targetDb.settings.put({
        key: 'goLive',
        value: {
          isLive: true,
          activatedAt: nowIso,
          activatedBy: 'OWNER',
          operationId: activeRecord.operationId,
        },
        updatedAt: nowIso,
      });

      // C. Shop Settings record
      const existingShopSettingsRecord = await targetDb.settings.get('shopSettings');
      const existingShopSettings = (existingShopSettingsRecord?.value as ShopSettings) || options.shopSettings || { shopName: 'ရွှေလက်ရာ' };
      await targetDb.settings.put({
        key: 'shopSettings',
        value: {
          ...existingShopSettings,
          shopName: activeRecord.businessName,
          ownerName: activeRecord.ownerName || existingShopSettings.ownerName || '',
          phone: activeRecord.phone || existingShopSettings.phone || '',
          address: activeRecord.address || existingShopSettings.address || '',
          tagline: activeRecord.tagline || existingShopSettings.tagline || '',
          isLiveConfirmed: true,
          hideSampleDataButtons: true,
        },
        updatedAt: nowIso,
      });

      // D. Apply Opening Cash Float if provided
      if (activeRecord.openingPosition?.cash?.cashAmount && activeRecord.openingPosition.cash.cashAmount > 0) {
        await targetDb.cashMovements.add({
          id: generateStableId('cm_open'),
          type: 'OPENING_FLOAT',
          direction: 'IN',
          amount: activeRecord.openingPosition.cash.cashAmount,
          signedAmount: activeRecord.openingPosition.cash.cashAmount,
          referenceType: 'OPENING',
          referenceId: 'opening_cash_float',
          referenceVoucherNo: 'OPENING-CASH',
          transactionDate: activeRecord.accountingStartDate || today,
          transactionTime: '00:00:00',
          status: 'COMPLETED',
          description: activeRecord.openingPosition.cash.notes || 'အဖွင့် လက်ဝယ်ငွေသား စာရင်း',
          idempotencyKey: generateStableId('ik_cm_open'),
          schemaVersion: 1,
          createdAt: nowIso,
        });
      }

      // E. Apply Opening Finished Goods to stockMovements
      if (activeRecord.openingPosition?.finishedGoods && activeRecord.openingPosition.finishedGoods.length > 0) {
        for (const item of activeRecord.openingPosition.finishedGoods) {
          if (!item.productId) continue;
          const p = await targetDb.products.get(item.productId);
          if (p) {
            await targetDb.products.update(item.productId, {
              openingStock: item.quantity,
              currentStock: item.quantity,
            });

            await targetDb.stockMovements.add({
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
              transactionDate: activeRecord.accountingStartDate || today,
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

      // F. Apply Opening Receivables to merchants
      if (activeRecord.openingPosition?.receivables && activeRecord.openingPosition.receivables.length > 0) {
        for (const r of activeRecord.openingPosition.receivables) {
          if (!r.merchantId) continue;
          const m = await targetDb.merchants.get(r.merchantId);
          if (m) {
            await targetDb.merchants.update(r.merchantId, {
              currentReceivableBalance: r.amount,
            });
          }
        }
      }

      // G. Apply Opening Advances & Payables to suppliers
      if (activeRecord.openingPosition?.advances && activeRecord.openingPosition.advances.length > 0) {
        for (const adv of activeRecord.openingPosition.advances) {
          if (!adv.counterpartId) continue;
          const s = await targetDb.suppliers.get(adv.counterpartId);
          if (s) {
            await targetDb.suppliers.update(adv.counterpartId, {
              currentAdvanceBalance: adv.amount,
              totalAdvancesGiven: adv.amount,
            });
          }
        }
      }

      if (activeRecord.openingPosition?.payables && activeRecord.openingPosition.payables.length > 0) {
        for (const p of activeRecord.openingPosition.payables) {
          const supId = p.supplierId || p.counterpartId;
          if (!supId) continue;
          const s = await targetDb.suppliers.get(supId);
          if (s) {
            await targetDb.suppliers.update(supId, {
              payableBalance: p.amount,
            });
          }
        }
      }
    }
  );

  // 6. Record Audit Event
  await recordAuditEvent(
    {
      action: 'GO_LIVE_ACTIVATED',
      actionType: 'SYSTEM_ACTION',
      referenceType: 'BUSINESS_INITIALIZATION',
      referenceId: activeRecord.id,
      details: `အက်ပ်ကို လက်တွေ့ စတင်အသုံးပြုခြင်း (Go-Live) အောင်မြင်ပါသည်။ နမူနာဒေတာများ ဖျက်သိမ်းပြီး ဆိုင်ရှင်ဒေတာ ${cleanedProducts.length} မျိုးဖြင့် စတင်ပါသည်။`,
      timestamp: nowIso,
    },
    targetDb
  );

  return {
    businessInitialization: activeRecord,
    cleanedProducts,
    cleanedSuppliers,
    cleanedMerchants,
  };
}

/**
 * Authorizes loading demo data after Go-Live:
 * Strictly blocks execution without Owner PIN verification + explicit double-confirmation.
 */
export async function authorizeDemoDataReload(options: {
  pin?: string;
  doubleConfirmed: boolean;
  appLockSettings?: AppLockSettings | null;
  targetDb?: typeof db;
}): Promise<boolean> {
  const targetDb = options.targetDb || db;
  const isLive = await checkIsBusinessLive(targetDb);

  // If business is not live yet, standard demo loading is permissible
  if (!isLive) {
    return true;
  }

  // If business is LIVE, require double confirmation
  if (!options.doubleConfirmed) {
    throw new Error(
      'ဒေတာအားလုံး ပျက်စီးနိုင်သည်ကို သဘောတူညီကြောင်း (Double-confirm) အမှန်ခြစ်ပေးရန် လိုအပ်ပါသည်'
    );
  }

  // Require Owner PIN - mandatory PIN setup or verification
  const hasConfiguredPin = Boolean(
    options.appLockSettings?.pinHash ||
      options.appLockSettings?.passcode ||
      options.appLockSettings?.pin
  );

  if (!hasConfiguredPin) {
    throw new Error('ဆိုင်ရှင် PIN စကားဝှက် သတ်မှတ်ထားခြင်း မရှိပါ။ လုပ်ဆောင်ချက် မပြုလုပ်မီ ဆိုင်ရှင် PIN သတ်မှတ်ပါ');
  } else {
    if (!options.pin || !options.pin.trim()) {
      throw new Error('လက်တွေ့သုံး စနစ်တွင် နမူနာဒေတာ ပြန်ထည့်ရန် ဆိုင်ရှင် PIN ရိုက်ထည့်ရန် လိုအပ်ပါသည်');
    }
    const isPinValid = await verifyOwnerPin(options.pin, options.appLockSettings);
    if (!isPinValid) {
      throw new Error('ဆိုင်ရှင် PIN မှားယွင်းနေပါသည်။ နမူနာဒေတာ ထည့်သွင်းခွင့် ပိတ်ပင်ထားပါသည်');
    }
  }

  return true;
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
