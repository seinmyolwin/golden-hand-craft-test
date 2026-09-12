import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// Polyfill localStorage for node environment
if (typeof localStorage === 'undefined' || !localStorage.getItem) {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

import { db } from '../db/database';
import {
  createDefaultBusinessInitialization,
  getBusinessInitialization,
  saveBusinessInitializationDraft,
  validateBusinessInitialization,
  confirmAndActivateBusiness,
  guardActiveBusinessOperation,
} from '../services/businessInitializationService';
import { createCompleteBackup, validateBackupFile, executeSafeRestore } from '../services/backupService';
import { BusinessInitializationRecord, Product, Supplier, Merchant } from '../types';

describe('Phase 18A: Business Initialization & Opening Position Foundation', () => {
  beforeEach(async () => {
    // Reset database tables
    await db.settings.clear();
    await db.products.clear();
    await db.suppliers.clear();
    await db.merchants.clear();
    await db.stockMovements.clear();
    await db.cashMovements.clear();
    await db.auditLogs.clear();
  });

  // --------------------------------------------------------------------------
  // 1. Initialization State Machine Tests
  // --------------------------------------------------------------------------

  it('1. initialStateNotInitialized: App starts in NOT_INITIALIZED state on fresh database', async () => {
    const init = await getBusinessInitialization();
    expect(init.state).toBe('NOT_INITIALIZED');
    expect(init.businessName).toBe('');
    expect(init.openingPosition.cash.cashAmount).toBe(0);
  });

  it('2. transitionToSetupInProgress: Draft saving transitions state to SETUP_IN_PROGRESS', async () => {
    const updated = await saveBusinessInitializationDraft({
      state: 'SETUP_IN_PROGRESS',
      businessName: 'ရွှေလက်ရာ ဝါးကြိမ်လုပ်ငန်း',
      ownerName: 'ဦးဘမြင့်',
    });

    expect(updated.state).toBe('SETUP_IN_PROGRESS');
    expect(updated.businessName).toBe('ရွှေလက်ရာ ဝါးကြိမ်လုပ်ငန်း');

    const fetched = await getBusinessInitialization();
    expect(fetched.state).toBe('SETUP_IN_PROGRESS');
    expect(fetched.ownerName).toBe('ဦးဘမြင့်');
  });

  it('3. transitionToReadyForConfirmation: Validating and saving draft transitions state to READY_FOR_CONFIRMATION', async () => {
    await saveBusinessInitializationDraft({ state: 'SETUP_IN_PROGRESS', businessName: 'ရွှေလက်ရာ' });
    const updated = await saveBusinessInitializationDraft({ state: 'READY_FOR_CONFIRMATION' });

    expect(updated.state).toBe('READY_FOR_CONFIRMATION');
    const fetched = await getBusinessInitialization();
    expect(fetched.state).toBe('READY_FOR_CONFIRMATION');
  });

  it('4. transitionToActive: Confirming activation transitions state to ACTIVE with timestamp and operationId', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ လက်မှု';
    draft.accountingStartDate = '2026-09-01';

    const activated = await confirmAndActivateBusiness(draft, { operationId: 'op_test_001' });

    expect(activated.state).toBe('ACTIVE');
    expect(activated.operationId).toBe('op_test_001');
    expect(activated.activationTimestamp).toBeDefined();
    expect(activated.activationDate).toBeDefined();

    const fetched = await getBusinessInitialization();
    expect(fetched.state).toBe('ACTIVE');
    expect(fetched.businessName).toBe('ရွှေလက်ရာ လက်မှု');
  });

  it('5. blockDemoDataWhenActive: Demo seeding functions throw error when state is ACTIVE', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ ဆိုင်';
    await confirmAndActivateBusiness(draft);

    await expect(guardActiveBusinessOperation('နမူနာဒေတာ ထည့်သွင်းခြင်း')).rejects.toThrow(
      'နမူနာဒေတာ ထည့်သွင်းခြင်း'
    );
  });

  it('6. blockRevertingActiveToNotInitialized: Direct transition from ACTIVE to NOT_INITIALIZED is rejected', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ ဆိုင်';
    await confirmAndActivateBusiness(draft);

    await expect(
      saveBusinessInitializationDraft({ state: 'NOT_INITIALIZED' })
    ).rejects.toThrow('အတည်ပြုပြီးသော စီးပွားရေးလုပ်ငန်း စာရင်းအား မူလအခြေအနေသို့ အလိုအလျောက် ပြန်ပြောင်း၍မရပါ');
  });

  // --------------------------------------------------------------------------
  // 2. Opening Position Ledger Integration Tests
  // --------------------------------------------------------------------------

  it('7. openingCashCreatesCashMovement: Activation with opening cash creates OPENING_FLOAT in cashMovements', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.accountingStartDate = '2026-09-01';
    draft.openingPosition.cash = {
      cashAmount: 1500000,
      notes: 'အဖွင့် လက်ဝယ်ငွေသား',
    };

    await confirmAndActivateBusiness(draft);

    const cashRecords = await db.cashMovements.toArray();
    expect(cashRecords.length).toBe(1);
    expect(cashRecords[0].type).toBe('OPENING_FLOAT');
    expect(cashRecords[0].amount).toBe(1500000);
    expect(cashRecords[0].direction).toBe('IN');
    expect(cashRecords[0].transactionDate).toBe('2026-09-01');
  });

  it('8. openingFinishedGoodsUpdatesStock: Activation with opening finished goods updates product stock and adds stockMovement', async () => {
    // Add product first
    const prod: Product = {
      id: 'prod_101',
      name: 'ကြိမ်ကုလားထိုင်',
      category: 'ကြိမ်ထည်',
      unit: 'လုံး',
      defaultPrice: 25000,
      openingStock: 0,
      currentStock: 0,
      minStockAlert: 5,
      active: true,
    };
    await db.products.add(prod);

    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.accountingStartDate = '2026-09-01';
    draft.openingPosition.finishedGoods = [
      {
        productId: 'prod_101',
        productName: 'ကြိမ်ကုလားထိုင်',
        category: 'ကြိမ်ထည်',
        unit: 'လုံး',
        quantity: 12,
        unitPrice: 20000,
        totalValue: 240000,
      },
    ];

    await confirmAndActivateBusiness(draft);

    const updatedProd = await db.products.get('prod_101');
    expect(updatedProd?.openingStock).toBe(12);
    expect(updatedProd?.currentStock).toBe(12);

    const stockMovements = await db.stockMovements.toArray();
    expect(stockMovements.length).toBe(1);
    expect(stockMovements[0].movementType).toBe('OPENING_BALANCE');
    expect(stockMovements[0].quantity).toBe(12);
    expect(stockMovements[0].unitPrice).toBe(20000);
    expect(stockMovements[0].totalValue).toBe(240000);
  });

  it('9. openingReceivableUpdatesMerchant: Activation with opening receivables updates merchant currentReceivableBalance', async () => {
    const merchant: Merchant = {
      id: 'mer_101',
      code: 'M-001',
      name: 'မန္တလေး ကုန်သည်ကြီး',
      town: 'မန္တလေး',
      phone: '0912345678',
      address: 'မန္တလေး',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.merchants.add(merchant);

    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.receivables = [
      {
        merchantId: 'mer_101',
        merchantName: 'မန္တလေး ကုန်သည်ကြီး',
        merchantTown: 'မန္တလေး',
        amount: 850000,
        notes: 'ယခင်ကျန် ရရန်ကျန်ငွေ',
      },
    ];

    await confirmAndActivateBusiness(draft);

    const updatedMer = await db.merchants.get('mer_101');
    expect(updatedMer?.currentReceivableBalance).toBe(850000);
  });

  it('10. openingPayableUpdatesSupplier: Activation with opening payables updates supplier payableBalance', async () => {
    const supplier: Supplier = {
      id: 'sup_101',
      code: 'S-001',
      name: 'ဦးစိုးလင်း (ဝါး ပေးသွင်းသူ)',
      phone: '0998765432',
      village: 'ကျေးရွာ',
      currentAdvanceBalance: 0,
      totalAdvancesGiven: 0,
      totalMaterialCreditGiven: 0,
      payableBalance: 0,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.suppliers.add(supplier);

    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.payables = [
      {
        supplierId: 'sup_101',
        counterpartName: 'ဦးစိုးလင်း (ဝါး ပေးသွင်းသူ)',
        amount: 400000,
        notes: 'ဝါးဖိုး ပေးရန်ကျန်ငွေ',
      },
    ];

    await confirmAndActivateBusiness(draft);

    const updatedSup = await db.suppliers.get('sup_101');
    expect(updatedSup?.payableBalance).toBe(400000);
  });

  it('11. openingAdvanceUpdatesSupplierAdvance: Activation with opening advance updates supplier currentAdvanceBalance & totalAdvancesGiven', async () => {
    const supplier: Supplier = {
      id: 'sup_102',
      code: 'S-002',
      name: 'ဒေါ်အေးအေး (ကြိမ် ခုတ်သူ)',
      phone: '0977766655',
      village: 'ကျေးရွာ',
      currentAdvanceBalance: 0,
      totalAdvancesGiven: 0,
      totalMaterialCreditGiven: 0,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.suppliers.add(supplier);

    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.advances = [
      {
        type: 'SUPPLIER_ADVANCE',
        counterpartId: 'sup_102',
        counterpartName: 'ဒေါ်အေးအေး (ကြိမ် ခုတ်သူ)',
        amount: 150000,
        notes: 'ကြိမ် အကြိုပေးငွေ',
      },
    ];

    await confirmAndActivateBusiness(draft);

    const updatedSup = await db.suppliers.get('sup_102');
    expect(updatedSup?.currentAdvanceBalance).toBe(150000);
    expect(updatedSup?.totalAdvancesGiven).toBe(150000);
  });

  it('12. openingIssuedMaterialsUpdatesMaterialCredit: Activation with issued materials updates worker material credit and advance balance', async () => {
    const worker: Supplier = {
      id: 'wrk_101',
      code: 'W-001',
      name: 'ကိုထွေး (လက်မှု ပန်းပုဆရာ)',
      phone: '0955544433',
      village: 'ကျေးရွာ',
      currentAdvanceBalance: 0,
      totalAdvancesGiven: 0,
      totalMaterialCreditGiven: 0,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.suppliers.add(worker);

    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.issuedMaterials = [
      {
        workerId: 'wrk_101',
        workerName: 'ကိုထွေး (လက်မှု ပန်းပုဆရာ)',
        materialName: 'ကျွန်းသစ်တုံး',
        unit: 'တုံး',
        quantity: 5,
        unitPrice: 30000,
        totalValue: 150000,
        cashAdvance: 50000,
      },
    ];

    await confirmAndActivateBusiness(draft);

    const updatedWorker = await db.suppliers.get('wrk_101');
    expect(updatedWorker?.totalMaterialCreditGiven).toBe(150000);
    expect(updatedWorker?.currentAdvanceBalance).toBe(50000);
  });

  it('13. openingCapitalPersisted: Opening capital amount is persisted in opening position record', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.openingCapital = 10000000; // 10 Million MMK

    const activated = await confirmAndActivateBusiness(draft);

    expect(activated.openingPosition.openingCapital).toBe(10000000);
    const fetched = await getBusinessInitialization();
    expect(fetched.openingPosition.openingCapital).toBe(10000000);
  });

  // --------------------------------------------------------------------------
  // 3. Atomic Activation & Idempotency Tests
  // --------------------------------------------------------------------------

  it('14. atomicActivationRollbackOnError: If validation fails, no tables are modified', async () => {
    const invalidRecord = createDefaultBusinessInitialization();
    invalidRecord.businessName = ''; // Invalid!

    await expect(confirmAndActivateBusiness(invalidRecord)).rejects.toThrow();

    const cashRecords = await db.cashMovements.toArray();
    expect(cashRecords.length).toBe(0);

    const fetched = await getBusinessInitialization();
    expect(fetched.state).toBe('NOT_INITIALIZED');
  });

  it('15. idempotentActivationDuplicateCalls: Calling activation multiple times with same operationId returns active record without duplicating stock/cash movements', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.cash = { cashAmount: 500000 };

    const firstCall = await confirmAndActivateBusiness(draft, { operationId: 'op_idempotency_101' });
    const secondCall = await confirmAndActivateBusiness(draft, { operationId: 'op_idempotency_101' });

    expect(firstCall.state).toBe('ACTIVE');
    expect(secondCall.state).toBe('ACTIVE');

    // Should only have created 1 cash movement, NOT 2!
    const cashRecords = await db.cashMovements.toArray();
    expect(cashRecords.length).toBe(1);
    expect(cashRecords[0].amount).toBe(500000);
  });

  it('16. auditLogRecordedOnActivation: Canonical audit event BUSINESS_INITIALIZATION_ACTIVATED is logged on activation', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.cash = { cashAmount: 1000000 };

    await confirmAndActivateBusiness(draft);

    const logs = await db.auditLogs.toArray();
    expect(logs.length).toBeGreaterThan(0);
    const initLog = logs.find((l) => l.action === 'BUSINESS_INITIALIZATION_ACTIVATED');
    expect(initLog).toBeDefined();
    expect(initLog?.referenceType).toBe('BUSINESS_INITIALIZATION');
  });

  // --------------------------------------------------------------------------
  // 4. Backup & Restore Compatibility Tests
  // --------------------------------------------------------------------------

  it('17. backupIncludesInitializationState: createCompleteBackup includes businessInitialization record', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ အရန်သိမ်းစမ်းသပ်မှု';
    await confirmAndActivateBusiness(draft);

    const backup = await createCompleteBackup();
    expect(backup.data.businessInitialization).toBeDefined();
    expect(backup.data.businessInitialization?.businessName).toBe('ရွှေလက်ရာ အရန်သိမ်းစမ်းသပ်မှု');
    expect(backup.data.businessInitialization?.state).toBe('ACTIVE');
  });

  it('18. restorePreservesInitializationState: Restoring backup preserves exact initialization state and opening position', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ သီးသန့်';
    draft.openingPosition.openingCapital = 5000000;
    await confirmAndActivateBusiness(draft);

    const backup = await createCompleteBackup();

    // Clear db
    await db.settings.clear();

    const validationReport = await validateBackupFile(backup);
    const restoreResult = await executeSafeRestore(validationReport, 'OVERWRITE');
    expect(restoreResult.success).toBe(true);

    const restoredInit = await getBusinessInitialization();
    expect(restoredInit.state).toBe('ACTIVE');
    expect(restoredInit.businessName).toBe('ရွှေလက်ရာ သီးသန့်');
    expect(restoredInit.openingPosition.openingCapital).toBe(5000000);
  });

  it('19. restoreLegacyBackupDefaultsToSetupInProgressIfDataExists: Restoring older backup without initialization metadata that contains data defaults to SETUP_IN_PROGRESS', async () => {
    // Add product to mimic legacy active data
    await db.products.add({
      id: 'legacy_p1',
      name: 'ဝါးကုလားထိုင်',
      category: 'ဝါးထည်',
      unit: 'လုံး',
      defaultPrice: 15000,
      openingStock: 5,
      currentStock: 5,
      active: true,
    });

    const backup = await createCompleteBackup();
    // Delete businessInitialization from backup object to simulate legacy v2/v1 backup
    delete (backup.data as any).businessInitialization;

    // Clear db
    await db.settings.clear();
    await db.products.clear();

    const validationReport = await validateBackupFile(backup);
    const restoreResult = await executeSafeRestore(validationReport, 'OVERWRITE');
    expect(restoreResult.success).toBe(true);

    const restoredInit = await getBusinessInitialization();
    // Must NOT silently set state to ACTIVE!
    expect(restoredInit.state).toBe('SETUP_IN_PROGRESS');
  });

  // --------------------------------------------------------------------------
  // 5. Validation Function & Direct Draft Guard Tests
  // --------------------------------------------------------------------------

  it('20. validationRejectsEmptyBusinessName: validateBusinessInitialization fails if business name is empty', () => {
    const record = createDefaultBusinessInitialization();
    record.businessName = '   '; // Empty

    const result = validateBusinessInitialization(record);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('အမည်'))).toBe(true);
  });

  it('21. validationRejectsInvalidStartDate: validateBusinessInitialization fails if date format is invalid', () => {
    const record = createDefaultBusinessInitialization();
    record.businessName = 'ရွှေလက်ရာ';
    record.accountingStartDate = '01-09-2026'; // Invalid YYYY-MM-DD format!

    const result = validateBusinessInitialization(record);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('ရက်စွဲ'))).toBe(true);
  });

  it('22. validationRejectsNegativeAmounts: validateBusinessInitialization fails if opening cash or capital is negative', () => {
    const record = createDefaultBusinessInitialization();
    record.businessName = 'ရွှေလက်ရာ';
    record.openingPosition.cash.cashAmount = -500; // Negative!

    const result = validateBusinessInitialization(record);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('လက်ဝယ်ငွေသား'))).toBe(true);
  });

  it('23. blockDirectDraftActivation: saveBusinessInitializationDraft throws when trying to set state ACTIVE directly', async () => {
    await expect(saveBusinessInitializationDraft({ state: 'ACTIVE' })).rejects.toThrow(
      'confirmAndActivateBusiness'
    );
  });

  // --------------------------------------------------------------------------
  // 6. Detailed Accounting Integrity & Audit Tests
  // --------------------------------------------------------------------------

  it('24. doubleCountingAuditCashAndStock: Opening cash and stock are NOT counted twice on activation or post-activation movement', async () => {
    const prod: Product = {
      id: 'prod_dc_1',
      name: 'ကြိမ်သေတ္တာ',
      category: 'ကြိမ်ထည်',
      unit: 'လုံး',
      defaultPrice: 50000,
      openingStock: 0,
      currentStock: 0,
      active: true,
    };
    await db.products.add(prod);

    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ စာရင်းစစ်';
    draft.accountingStartDate = '2026-09-01';
    draft.openingPosition.cash = { cashAmount: 5000000, notes: 'အဖွင့်ငွေ' };
    draft.openingPosition.finishedGoods = [
      { productId: 'prod_dc_1', productName: 'ကြိမ်သေတ္တာ', category: 'ကြိမ်ထည်', unit: 'လုံး', quantity: 10, unitPrice: 50000, totalValue: 500000 },
    ];

    await confirmAndActivateBusiness(draft);

    // Verify cash ledger running balance is exactly 5,000,000
    const cashMovements = await db.cashMovements.toArray();
    expect(cashMovements.length).toBe(1);
    expect(cashMovements[0].type).toBe('OPENING_FLOAT');
    expect(cashMovements[0].amount).toBe(5000000);

    // Perform a post-activation cash movement of +100,000
    await db.cashMovements.add({
      id: 'cm_test_post',
      type: 'INCOME_IN',
      direction: 'IN',
      amount: 100000,
      signedAmount: 100000,
      referenceType: 'DIRECT',
      referenceId: 'ref_01',
      transactionDate: '2026-09-02',
      status: 'COMPLETED',
      description: 'Test post movement',
      idempotencyKey: 'ik_test_post',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    });

    const updatedCashMovements = await db.cashMovements.toArray();
    const totalCash = updatedCashMovements.reduce((sum, m) => sum + (m.signedAmount || 0), 0);
    expect(totalCash).toBe(5100000); // Must be 5,100,000 exactly! NOT 5,200,000 or 10,100,000!

    // Verify stock ledger running balance
    const updatedProd = await db.products.get('prod_dc_1');
    expect(updatedProd?.openingStock).toBe(10);
    expect(updatedProd?.currentStock).toBe(10);
  });

  it('25. openingPositionDoesNotCreateFakeBusinessTransactions: Activation creates zero sales, purchases, or returns', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ သန့်သန့်';
    draft.accountingStartDate = '2026-09-01';
    draft.openingPosition.cash = { cashAmount: 2000000 };
    draft.openingPosition.openingCapital = 10000000;

    await confirmAndActivateBusiness(draft);

    const salesCount = await db.sales.count();
    const txCount = await db.transactions.count();
    const purchasesCount = await db.merchantPurchases.count();

    expect(salesCount).toBe(0);
    expect(txCount).toBe(0);
    expect(purchasesCount).toBe(0);
  });

  it('26. openingWorkerMaterialIssuedSettlement: Worker material credit and advance balance update cleanly', async () => {
    const worker: Supplier = {
      id: 'wrk_sc_1',
      name: 'ဦးမြ (လက်မှုပန်းပု)',
      phone: '0911122233',
      village: 'ကျေးရွာ',
      currentAdvanceBalance: 0,
      totalAdvancesGiven: 0,
      totalMaterialCreditGiven: 0,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.suppliers.add(worker);

    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ';
    draft.openingPosition.issuedMaterials = [
      {
        workerId: 'wrk_sc_1',
        workerName: 'ဦးမြ (လက်မှုပန်းပု)',
        materialName: 'ကျွန်းသစ်',
        unit: 'တုံး',
        quantity: 10,
        unitPrice: 20000,
        totalValue: 200000,
        cashAdvance: 50000,
      },
    ];

    await confirmAndActivateBusiness(draft);

    const activeWorker = await db.suppliers.get('wrk_sc_1');
    expect(activeWorker?.totalMaterialCreditGiven).toBe(200000);
    expect(activeWorker?.currentAdvanceBalance).toBe(50000);
  });

  it('27. legacyBackupMigrationScenarios: Verified migration for legacy backup files without businessInitialization metadata', async () => {
    // Scenario A & E: Legacy backup with genuine operational data
    await db.products.add({ id: 'p_leg_1', name: 'ဝါးခြင်း', category: 'ဝါး', unit: 'ခု', defaultPrice: 5000, openingStock: 10, currentStock: 10, active: true });
    await db.sales.add({ id: 's_leg_1', voucherNo: 'S-001', date: '2026-08-01', time: '12:00', merchantId: 'm1', merchantName: 'မလှ', merchantTown: 'မန္တလေး', totalAmount: 50000, paidAmount: 50000, items: [], status: 'COMPLETED', createdAt: '2026-08-01T00:00:00Z' });

    const backupWithData = await createCompleteBackup();
    delete (backupWithData.data as any).businessInitialization;

    await db.settings.clear();
    await db.products.clear();
    await db.sales.clear();

    const reportA = await validateBackupFile(backupWithData);
    await executeSafeRestore(reportA, 'OVERWRITE');
    const initA = await getBusinessInitialization();
    expect(initA.state).toBe('SETUP_IN_PROGRESS'); // Conservative state!

    // Scenario D: Legacy backup with NO operational data
    await db.settings.clear();
    await db.products.clear();
    await db.sales.clear();
    const backupEmpty = await createCompleteBackup();
    delete (backupEmpty.data as any).businessInitialization;

    const reportD = await validateBackupFile(backupEmpty);
    await executeSafeRestore(reportD, 'OVERWRITE');
    const initD = await getBusinessInitialization();
    expect(initD.state).toBe('NOT_INITIALIZED');
  });

  it('28. repeatedRestoreDoesNotDuplicateOpeningEntries: Repeatedly restoring ACTIVE backup preserves exact single opening entries', async () => {
    const draft = createDefaultBusinessInitialization();
    draft.businessName = 'ရွှေလက်ရာ မိတ္တူ';
    draft.openingPosition.cash = { cashAmount: 3000000 };
    await confirmAndActivateBusiness(draft);

    const backup = await createCompleteBackup();

    // Restore 1st time
    const r1 = await validateBackupFile(backup);
    await executeSafeRestore(r1, 'OVERWRITE');

    // Restore 2nd time
    const r2 = await validateBackupFile(backup);
    await executeSafeRestore(r2, 'OVERWRITE');

    const cashMovements = await db.cashMovements.toArray();
    expect(cashMovements.length).toBe(1);
    expect(cashMovements[0].amount).toBe(3000000);

    const init = await getBusinessInitialization();
    expect(init.state).toBe('ACTIVE');
  });
});
