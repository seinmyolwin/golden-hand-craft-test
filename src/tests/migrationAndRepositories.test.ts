import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// Polyfill localStorage for Node test runner environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
}

import Dexie from 'dexie';
import { ShweLetYarDatabase, db } from '../db/database';
import { runOfflineStorageMigration, MIGRATION_FLAG_KEY } from '../db/migration';
import {
  ProductRepository,
  SupplierRepository,
  MerchantRepository,
  TransactionRepository,
  SaleRepository,
  MerchantPurchaseRepository,
  StockAdjustmentRepository,
  IdempotencyConflictError,
  EntityNotFoundError,
  InvalidStateTransitionError,
} from '../repositories';
import {
  parseBilingualNumber,
  normalizeBilingualDigits,
} from '../utils/storage';
import {
  Product,
  Supplier,
  Merchant,
  TransactionRecord,
  SaleRecord,
  MerchantPurchaseRecord,
  StockAdjustmentRecord,
} from '../types';

describe('Bilingual Number Parsing and Normalization', () => {
  it('parses Myanmar numerals correctly', () => {
    expect(parseBilingualNumber('၁၂၅၀၀')).toBe(12500);
    expect(parseBilingualNumber('၀')).toBe(0);
    expect(parseBilingualNumber('ဝ')).toBe(0); // Burmese letter Wa used as 0
    expect(parseBilingualNumber('၅,၀၀၀ ကျပ်')).toBe(5000);
    expect(parseBilingualNumber('၁၅၀၀.၅၀')).toBe(1500.5);
  });

  it('parses standard English numbers', () => {
    expect(parseBilingualNumber(45000)).toBe(45000);
    expect(parseBilingualNumber(' 3,200 ')).toBe(3200);
    expect(parseBilingualNumber('0')).toBe(0);
    expect(parseBilingualNumber(null)).toBe(0);
  });

  it('normalizes mixed digits to English digits', () => {
    expect(normalizeBilingualDigits('ဖုန်း- ၀၉-၁၂၃၄၅၆၇၈')).toBe('ဖုန်း- 09-12345678');
    expect(normalizeBilingualDigits('၁၀,၀၀၀')).toBe('10,000');
  });
});

describe('Database Integrity & Atomic Business Operations', () => {
  let testDb: ShweLetYarDatabase;
  let productRepo: ProductRepository;
  let supplierRepo: SupplierRepository;
  let merchantRepo: MerchantRepository;
  let txRepo: TransactionRepository;
  let saleRepo: SaleRepository;
  let purchaseRepo: MerchantPurchaseRepository;
  let stockAdjustmentRepo: StockAdjustmentRepository;

  beforeEach(async () => {
    testDb = new ShweLetYarDatabase();
    await testDb.products.clear();
    await testDb.suppliers.clear();
    await testDb.merchants.clear();
    await testDb.transactions.clear();
    await testDb.sales.clear();
    await testDb.merchantPurchases.clear();
    await testDb.stockAdjustments.clear();
    await testDb.orders.clear();
    await testDb.softDeletedItems.clear();
    await testDb.auditLogs.clear();

    productRepo = new ProductRepository(testDb);
    supplierRepo = new SupplierRepository(testDb);
    merchantRepo = new MerchantRepository(testDb);
    txRepo = new TransactionRepository(testDb);
    saleRepo = new SaleRepository(testDb);
    purchaseRepo = new MerchantPurchaseRepository(testDb);
    stockAdjustmentRepo = new StockAdjustmentRepository(testDb);
  });

  // 1. Successful sale
  it('1. Successfully executes atomic sale with inventory deduction and merchant debt update', async () => {
    const product: Product = {
      id: 'prod-1',
      name: 'ယွန်းဖလား',
      defaultPrice: 5000,
      defaultWholesalePrice: 6000,
      unit: 'လုံး',
      category: 'ယွန်းထည်',
      openingStock: 25,
      currentStock: 25,
      minStockAlert: 5,
      active: true,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await productRepo.save(product);

    const merchant: Merchant = {
      id: 'merch-1',
      code: 'M-001',
      name: 'ဒေါ်အေးအေး',
      town: 'မန္တလေး',
      phone: '09-123456',
      role: 'BUYER',
      currentReceivableBalance: 10000,
      payableBalance: 0,
      totalPurchasesValue: 10000,
      totalPaidAmount: 0,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await merchantRepo.save(merchant);

    const sale: SaleRecord = {
      id: 'sale-1',
      voucherNo: 'INV-1001',
      merchantId: 'merch-1',
      merchantName: 'ဒေါ်အေးအေး',
      merchantTown: 'မန္တလေး',
      date: '2026-09-10',
      time: '14:00',
      items: [
        {
          productId: 'prod-1',
          productName: 'ယွန်းဖလား',
          quantity: 10,
          unit: 'လုံး',
          unitPrice: 6000,
          subtotal: 60000,
        },
      ],
      totalItemsCount: 10,
      grandTotal: 60000,
      cashPaidByMerchant: 20000,
      remainingReceivableBalance: 50000, // 10,000 + (60,000 - 20,000)
      paymentMethod: 'CASH',
    };

    const result = await saleRepo.saveSaleAtomic(sale);
    expect(result.status).toBe('COMPLETED');

    const updatedProd = await productRepo.getById('prod-1');
    expect(updatedProd?.currentStock).toBe(15);

    const updatedMerch = await merchantRepo.getById('merch-1');
    expect(updatedMerch?.currentReceivableBalance).toBe(50000);
    expect(updatedMerch?.totalPurchasesValue).toBe(70000);
    expect(updatedMerch?.totalPaidAmount).toBe(20000);

    const auditCount = await testDb.auditLogs.count();
    expect(auditCount).toBe(1);
  });

  // 2. Failed sale with missing product causing atomic rollback
  it('2. Rolls back all changes if sale contains non-existent product', async () => {
    const validProduct: Product = {
      id: 'prod-valid',
      name: 'ပလိုင်း',
      defaultPrice: 2000,
      unit: 'လုံး',
      category: 'ကြိမ်ထည်',
      openingStock: 30,
      currentStock: 30,
      active: true,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await productRepo.save(validProduct);

    const merchant: Merchant = {
      id: 'merch-2',
      code: 'M-002',
      name: 'ကိုကျော်',
      town: 'ရန်ကုန်',
      phone: '09-999999',
      currentReceivableBalance: 5000,
      totalPurchasesValue: 5000,
      totalPaidAmount: 0,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await merchantRepo.save(merchant);

    const invalidSale: SaleRecord = {
      id: 'sale-invalid-1',
      voucherNo: 'INV-ERR',
      merchantId: 'merch-2',
      merchantName: 'ကိုကျော်',
      merchantTown: 'ရန်ကုန်',
      date: '2026-09-10',
      time: '11:00',
      items: [
        {
          productId: 'prod-valid',
          productName: 'ပလိုင်း',
          quantity: 5,
          unit: 'လုံး',
          unitPrice: 2000,
          subtotal: 10000,
        },
        {
          productId: 'prod-non-existent-999',
          productName: 'မရှိသောပစ္စည်း',
          quantity: 2,
          unit: 'ခု',
          unitPrice: 5000,
          subtotal: 10000,
        },
      ],
      totalItemsCount: 7,
      grandTotal: 20000,
      cashPaidByMerchant: 0,
      remainingReceivableBalance: 25000,
    };

    await expect(saleRepo.saveSaleAtomic(invalidSale)).rejects.toThrow(EntityNotFoundError);

    // Verify product stock was NOT decremented
    const prodAfter = await productRepo.getById('prod-valid');
    expect(prodAfter?.currentStock).toBe(30);

    // Verify merchant debt was NOT altered
    const merchAfter = await merchantRepo.getById('merch-2');
    expect(merchAfter?.currentReceivableBalance).toBe(5000);

    // Verify no sale was stored
    const saleStored = await saleRepo.getById('sale-invalid-1');
    expect(saleStored).toBeUndefined();
  });

  // 3. Stock update failure with non-existent product
  it('3. Throws EntityNotFoundError on invalid product stock update', async () => {
    await expect(productRepo.updateStock('non-existent-id', 100)).rejects.toThrow(EntityNotFoundError);
  });

  // 4. Balance update failure on missing merchant
  it('4. Throws EntityNotFoundError on invalid merchant receivable update', async () => {
    await expect(merchantRepo.updateReceivableBalance('non-existent-merch', 50000)).rejects.toThrow(
      EntityNotFoundError
    );
  });

  // 5. Rollback verification on Inbound Goods failure
  it('5. Rolls back supplier balance and inventory if inbound collection fails midway', async () => {
    const product: Product = {
      id: 'prod-inbound-1',
      name: 'ယွန်းသေတ္တာ',
      defaultPrice: 10000,
      unit: 'လုံး',
      category: 'ယွန်းထည်',
      openingStock: 10,
      currentStock: 10,
      active: true,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await productRepo.save(product);

    const supplier: Supplier = {
      id: 'sup-5',
      code: 'S-005',
      name: 'ဦးစံရှား',
      phone: '09-555555',
      village: 'ညောင်ဦး',
      currentAdvanceBalance: 50000,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await supplierRepo.save(supplier);

    const brokenTx: TransactionRecord = {
      id: 'tx-broken',
      voucherNo: 'TX-ERR',
      supplierId: 'sup-5',
      supplierName: 'ဦးစံရှား',
      date: '2026-09-10',
      time: '09:00',
      items: [
        {
          productId: 'prod-inbound-1',
          productName: 'ယွန်းသေတ္တာ',
          quantity: 5,
          unit: 'လုံး',
          unitPrice: 10000,
          subtotal: 50000,
        },
        {
          productId: 'prod-ghost-id-404',
          productName: 'မရှိသောကုန်',
          quantity: 1,
          unit: 'လုံး',
          unitPrice: 10000,
          subtotal: 10000,
        },
      ],
      totalGoodsValue: 60000,
      previousAdvanceBalance: 50000,
      advanceDeducted: 50000,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
    };

    await expect(txRepo.saveInboundAtomic(brokenTx)).rejects.toThrow(EntityNotFoundError);

    const supAfter = await supplierRepo.getById('sup-5');
    expect(supAfter?.currentAdvanceBalance).toBe(50000);

    const prodAfter = await productRepo.getById('prod-inbound-1');
    expect(prodAfter?.currentStock).toBe(10);
  });

  // 6. Duplicate sale submission (Idempotency Protection)
  it('6. Blocks duplicate sale submission and protects idempotency', async () => {
    const product: Product = {
      id: 'prod-idem',
      name: 'ကျောက်ဆစ် ဗုဒ္ဓရုပ်ပွားတော်',
      defaultPrice: 15000,
      unit: 'ဆူ',
      category: 'ကျောက်ဆစ်',
      openingStock: 10,
      currentStock: 10,
      active: true,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await productRepo.save(product);

    const merchant: Merchant = {
      id: 'merch-idem',
      code: 'M-IDEM',
      name: 'ဆိုင်အရောင်း (လက်လီ)',
      town: 'ပုဂံ',
      phone: '09-000000',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await merchantRepo.save(merchant);

    const sale: SaleRecord = {
      id: 'sale-idem-1',
      voucherNo: 'INV-IDEM-001',
      merchantId: 'merch-idem',
      merchantName: 'ဆိုင်အရောင်း (လက်လီ)',
      merchantTown: 'ပုဂံ',
      date: '2026-09-10',
      time: '15:30',
      items: [
        {
          productId: 'prod-idem',
          productName: 'ကျောက်ဆစ် ဗုဒ္ဓရုပ်ပွားတော်',
          quantity: 2,
          unit: 'ဆူ',
          unitPrice: 15000,
          subtotal: 30000,
        },
      ],
      totalItemsCount: 2,
      grandTotal: 30000,
      cashPaidByMerchant: 30000,
      remainingReceivableBalance: 0,
    };

    // First submission succeeds
    await saleRepo.saveSaleAtomic(sale);
    const prodAfterFirst = await productRepo.getById('prod-idem');
    expect(prodAfterFirst?.currentStock).toBe(8);

    // Second submission with exact same ID fails with IdempotencyConflictError
    await expect(saleRepo.saveSaleAtomic(sale)).rejects.toThrow(IdempotencyConflictError);

    // Product stock must still be 8, not 6
    const prodAfterSecond = await productRepo.getById('prod-idem');
    expect(prodAfterSecond?.currentStock).toBe(8);
  });

  // 7. Sale cancellation (Atomic Reversal)
  it('7. Atomically reverses inventory stock and merchant balance on sale cancellation', async () => {
    const product: Product = {
      id: 'prod-cancel-test',
      name: 'ပုဂံ ပန်းချီကား',
      defaultPrice: 20000,
      unit: 'ချပ်',
      category: 'ပန်းချီ',
      openingStock: 10,
      currentStock: 10,
      active: true,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await productRepo.save(product);

    const merchant: Merchant = {
      id: 'merch-cancel-test',
      code: 'M-003',
      name: 'ဦးအောင်မင်း',
      town: 'တောင်ကြီး',
      phone: '09-777777',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await merchantRepo.save(merchant);

    const sale: SaleRecord = {
      id: 'sale-cancel-1',
      voucherNo: 'INV-CANCEL-1',
      merchantId: 'merch-cancel-test',
      merchantName: 'ဦးအောင်မင်း',
      merchantTown: 'တောင်ကြီး',
      date: '2026-09-10',
      time: '17:00',
      items: [
        {
          productId: 'prod-cancel-test',
          productName: 'ပုဂံ ပန်းချီကား',
          quantity: 3,
          unit: 'ချပ်',
          unitPrice: 20000,
          subtotal: 60000,
        },
      ],
      totalItemsCount: 3,
      grandTotal: 60000,
      cashPaidByMerchant: 20000,
      remainingReceivableBalance: 40000,
    };

    await saleRepo.saveSaleAtomic(sale);

    // Check post-sale state
    let prod = await productRepo.getById('prod-cancel-test');
    expect(prod?.currentStock).toBe(7);
    let merch = await merchantRepo.getById('merch-cancel-test');
    expect(merch?.currentReceivableBalance).toBe(40000);

    // Now Cancel the Sale
    const cancelled = await saleRepo.cancelSaleAtomic('sale-cancel-1', 'ဝယ်သူမှ ကုန်ပစ္စည်း လာရောက်မယူပါ');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toBe('ဝယ်သူမှ ကုန်ပစ္စည်း လာရောက်မယူပါ');

    // Verify stock is restored back to 10
    prod = await productRepo.getById('prod-cancel-test');
    expect(prod?.currentStock).toBe(10);

    // Verify merchant debt is restored back to 0
    merch = await merchantRepo.getById('merch-cancel-test');
    expect(merch?.currentReceivableBalance).toBe(0);
    expect(merch?.totalPurchasesValue).toBe(0);
    expect(merch?.totalPaidAmount).toBe(0);

    // Trying to cancel again throws InvalidStateTransitionError
    await expect(saleRepo.cancelSaleAtomic('sale-cancel-1')).rejects.toThrow(InvalidStateTransitionError);
  });

  // 8. Purchase (Raw Material) atomic execution
  it('8. Atomically records raw material purchase and updates merchant payable debt', async () => {
    const merchantSupplier: Merchant = {
      id: 'merch-raw-1',
      code: 'M-RAW-1',
      name: 'ကိုစိုးလွင် (သစ်စေးရောင်းဝယ်ရေး)',
      town: 'ကျောက်ပန်းတောင်း',
      phone: '09-888888',
      role: 'SUPPLIER',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      payableBalance: 15000,
      totalPurchasedFromMerchant: 15000,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await merchantRepo.save(merchantSupplier);

    const purchase: MerchantPurchaseRecord = {
      id: 'pur-1',
      purchaseNo: 'PUR-001',
      merchantId: 'merch-raw-1',
      merchantName: 'ကိုစိုးလွင် (သစ်စေးရောင်းဝယ်ရေး)',
      merchantTown: 'ကျောက်ပန်းတောင်း',
      date: '2026-09-10',
      time: '13:00',
      items: [
        {
          productId: 'mat-1',
          productName: 'သစ်စေးအစိမ်း',
          quantity: 5,
          unit: 'ပိဿာ',
          unitPrice: 8000,
          subtotal: 40000,
        },
      ],
      totalAmount: 40000,
      paidAmount: 10000,
      remainingPayableBalance: 30000,
      createdAt: '2026-09-10',
    };

    const saved = await purchaseRepo.savePurchaseAtomic(purchase);
    expect(saved.status).toBe('COMPLETED');

    const updatedMerch = await merchantRepo.getById('merch-raw-1');
    expect(updatedMerch?.payableBalance).toBe(45000); // 15,000 + 30,000
    expect(updatedMerch?.totalPurchasedFromMerchant).toBe(55000); // 15,000 + 40,000
  });

  // 9. Purchase cancellation (Atomic Reversal)
  it('9. Atomically cancels raw material purchase and restores payable balance', async () => {
    const merchantSupplier: Merchant = {
      id: 'merch-raw-2',
      code: 'M-RAW-2',
      name: 'ဒေါ်လှနု',
      town: 'မန္တလေး',
      phone: '09-444444',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      payableBalance: 0,
      totalPurchasedFromMerchant: 0,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await merchantRepo.save(merchantSupplier);

    const purchase: MerchantPurchaseRecord = {
      id: 'pur-2',
      purchaseNo: 'PUR-002',
      merchantId: 'merch-raw-2',
      merchantName: 'ဒေါ်လှနု',
      merchantTown: 'မန္တလေး',
      date: '2026-09-10',
      time: '14:30',
      items: [
        {
          productId: 'mat-2',
          productName: 'ဝါးစိမ်း',
          quantity: 100,
          unit: 'လုံး',
          unitPrice: 500,
          subtotal: 50000,
        },
      ],
      totalAmount: 50000,
      paidAmount: 20000,
      remainingPayableBalance: 30000,
      createdAt: '2026-09-10',
    };

    await purchaseRepo.savePurchaseAtomic(purchase);
    let merch = await merchantRepo.getById('merch-raw-2');
    expect(merch?.payableBalance).toBe(30000);

    // Cancel purchase
    await purchaseRepo.cancelPurchaseAtomic('pur-2', 'အရည်အသွေးမပြည့်မီ၍ ပြန်အပ်သည်');

    merch = await merchantRepo.getById('merch-raw-2');
    expect(merch?.payableBalance).toBe(0);
    expect(merch?.totalPurchasedFromMerchant).toBe(0);

    const cancelledPur = await purchaseRepo.getById('pur-2');
    expect(cancelledPur?.status).toBe('CANCELLED');
    expect(cancelledPur?.cancellationReason).toBe('အရည်အသွေးမပြည့်မီ၍ ပြန်အပ်သည်');
  });

  // 10. Stock adjustment
  it('10. Atomically records stock adjustment, updates product stock, and logs audit', async () => {
    const product: Product = {
      id: 'prod-adj-1',
      name: 'ယွန်း လက်ဖက်အုပ်',
      defaultPrice: 8000,
      unit: 'အုပ်',
      category: 'ယွန်းထည်',
      openingStock: 20,
      currentStock: 20,
      active: true,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await productRepo.save(product);

    const adjustment: StockAdjustmentRecord = {
      id: 'adj-101',
      productId: 'prod-adj-1',
      productName: 'ယွန်း လက်ဖက်အုပ်',
      date: '2026-09-10',
      time: '16:00',
      type: 'DAMAGE',
      quantity: -3,
      previousStock: 20,
      newStock: 17,
      reason: 'ပျက်စီး/ကျိုးပဲ့မှုကြောင့် နုတ်ပယ်ခြင်း',
      createdAt: '2026-09-10',
    };

    const savedAdj = await stockAdjustmentRepo.saveAdjustmentAtomic(adjustment);
    expect(savedAdj.status).toBe('COMPLETED');

    const updatedProd = await productRepo.getById('prod-adj-1');
    expect(updatedProd?.currentStock).toBe(17);

    const auditLogs = await testDb.auditLogs.toArray();
    const lastAudit = auditLogs.find((a) => a.entityType === 'STOCK_ADJUSTMENT');
    expect(lastAudit).toBeDefined();
    expect(lastAudit?.details).toContain('20 -> 17');
  });
});

describe('Dexie Schema V1 -> V8 Upgrades & Evolution', () => {
  it('seamlessly upgrades from Version 1 schema to Version 8 without losing records', async () => {
    const testDbName = `UpgradeEvolutionTest_${Date.now()}`;

    // Step 1: Open with Version 1 schema only
    const v1Db = new Dexie(testDbName);
    v1Db.version(1).stores({
      products: 'id, name, category, active',
      suppliers: 'id, code, name, phone, village, updatedAt',
      merchants: 'id, code, name, town, phone, updatedAt',
      transactions: 'id, voucherNo, supplierId, date, time, createdAt',
      sales: 'id, voucherNo, merchantId, date, time, createdAt',
      merchantPurchases: 'id, purchaseNo, merchantId, date, time, createdAt',
      orders: 'id, orderNo, merchantId, status, deliveryTargetDate, date',
      stockAdjustments: 'id, productId, date, type, createdAt',
      peerTrades: 'id, tradeType, status, productId, date',
      softDeletedItems: 'id, originalId, type, deletedAt',
      auditLogs: 'id, action, timestamp, entityType',
      settings: 'key, updatedAt',
      recoverySnapshots: 'id, timestamp, date',
      attachments: 'id, voucherId, createdAt',
    });
    await v1Db.open();

    // Insert legacy v1 records
    await v1Db.table('products').add({
      id: 'legacy-p1',
      name: 'ရွှေယွန်း ဆွမ်းအုပ်',
      category: 'ယွန်းထည်',
      active: true,
    });
    await v1Db.table('suppliers').add({
      id: 'legacy-s1',
      code: 'S-001',
      name: 'ကိုအောင်ကျော်',
      phone: '0912345678',
      village: 'ကျောက်ကာ',
      updatedAt: '2026-01-01',
    });
    await v1Db.table('auditLogs').add({
      id: 'legacy-log1',
      action: 'Initial Setup',
      timestamp: '2026-01-01T00:00:00.000Z',
      entityType: 'SYSTEM',
    });

    await v1Db.close();

    // Step 2: Open the same database using ShweLetYarDatabase (contains versions 1 through 8)
    const upgradedDb = new ShweLetYarDatabase(testDbName);
    await upgradedDb.open();

    expect(upgradedDb.verno).toBe(8);

    // Verify legacy records persist intact
    const legacyProd = await upgradedDb.products.get('legacy-p1');
    expect(legacyProd).toBeDefined();
    expect(legacyProd?.name).toBe('ရွှေယွန်း ဆွမ်းအုပ်');

    const legacySup = await upgradedDb.suppliers.get('legacy-s1');
    expect(legacySup).toBeDefined();
    expect(legacySup?.name).toBe('ကိုအောင်ကျော်');

    // Verify audit log received upgraded fields via v8 upgrade hook
    const legacyLog = await upgradedDb.auditLogs.get('legacy-log1');
    expect(legacyLog).toBeDefined();
    expect(legacyLog?.actionType).toBe('SYSTEM');
    expect(legacyLog?.createdAt).toBe('2026-01-01T00:00:00.000Z');

    // Verify newly added Version 8 tables are ready and queryable
    const returnsCount = await upgradedDb.returnsAndRefunds.count();
    expect(returnsCount).toBe(0);
    const stockMovementsCount = await upgradedDb.stockMovements.count();
    expect(stockMovementsCount).toBe(0);

    await upgradedDb.close();
    await Dexie.delete(testDbName);
  });
});

describe('Offline Storage Migration Stress & Edge Cases', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.products.clear();
    await db.suppliers.clear();
    await db.merchants.clear();
    await db.transactions.clear();
    await db.sales.clear();
    await db.auditLogs.clear();
  });

  it('is strictly idempotent: running twice yields identical state and returns alreadyMigrated: true', async () => {
    const products = [
      { id: 'p-mig-1', name: 'ယွန်း သေတ္တာ', defaultPrice: 12000, currentStock: 10 },
      { id: 'p-mig-2', name: 'ယွန်း ပန်းကန်', defaultPrice: 8000, currentStock: 25 },
    ];
    localStorage.setItem('ledger_products_v2', JSON.stringify(products));

    // Run 1: initial migration
    const res1 = await runOfflineStorageMigration();
    expect(res1.success).toBe(true);
    expect(res1.alreadyMigrated).toBe(false);
    expect(res1.migratedCounts.products).toBe(2);
    expect(await db.products.count()).toBe(2);

    // Run 2: second run must not duplicate or re-write
    const res2 = await runOfflineStorageMigration();
    expect(res2.success).toBe(true);
    expect(res2.alreadyMigrated).toBe(true);
    expect(await db.products.count()).toBe(2);
  });

  it('prioritizes v2 localStorage keys over v1 legacy keys', async () => {
    const v2Products = [{ id: 'p-v2', name: 'V2 ခေတ်မီပစ္စည်း', defaultPrice: 20000 }];
    const v1Products = [{ id: 'p-v1', name: 'V1 ရှေးဟောင်းပစ္စည်း', defaultPrice: 10000 }];

    localStorage.setItem('ledger_products_v2', JSON.stringify(v2Products));
    localStorage.setItem('ledger_products_v1', JSON.stringify(v1Products));

    const res = await runOfflineStorageMigration();
    expect(res.success).toBe(true);
    const stored = await db.products.toArray();
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('V2 ခေတ်မီပစ္စည်း');
  });

  it('handles corrupted JSON, missing keys, empty arrays, and non-array values safely without crashing', async () => {
    localStorage.setItem('ledger_products_v2', 'CORRUPT_JSON_DATA{{{{');
    localStorage.setItem('ledger_suppliers_v2', '{"invalid": "not-an-array"}');
    localStorage.setItem('ledger_merchants_v2', '[]');
    // ledger_transactions_v2 is missing

    const res = await runOfflineStorageMigration();
    expect(res.success).toBe(true); // Gracefully completes with safe fallbacks
    expect(res.migratedCounts.products).toBe(0);
    expect(res.migratedCounts.suppliers).toBe(0);
    expect(res.migratedCounts.merchants).toBe(0);
  });
});
