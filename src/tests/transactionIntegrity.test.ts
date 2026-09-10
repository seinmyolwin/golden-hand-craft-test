import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { ShweLetYarDatabase } from '../db/database';
import {
  SaleRepository,
  TransactionRepository,
  MerchantPurchaseRepository,
  StockAdjustmentRepository,
  ProductRepository,
  MerchantRepository,
  SupplierRepository,
  IdempotencyConflictError,
  EntityNotFoundError,
} from '../repositories';
import { SaleRecord, TransactionRecord, Product, Merchant, Supplier } from '../types';
import { generateStableId } from '../utils/idGenerator';
import { moneyAdd, moneySub, moneyMul, moneyCalcTotal, toSafeIntMoney } from '../utils/moneyMath';

describe('Transaction Integrity & Idempotency Safeguards', () => {
  let testDb: ShweLetYarDatabase;
  let saleRepo: SaleRepository;
  let txRepo: TransactionRepository;
  let purchaseRepo: MerchantPurchaseRepository;
  let stockAdjRepo: StockAdjustmentRepository;
  let productRepo: ProductRepository;
  let merchantRepo: MerchantRepository;
  let supplierRepo: SupplierRepository;

  beforeEach(async () => {
    testDb = new ShweLetYarDatabase();
    await testDb.open();

    saleRepo = new SaleRepository(testDb);
    txRepo = new TransactionRepository(testDb);
    purchaseRepo = new MerchantPurchaseRepository(testDb);
    stockAdjRepo = new StockAdjustmentRepository(testDb);
    productRepo = new ProductRepository(testDb);
    merchantRepo = new MerchantRepository(testDb);
    supplierRepo = new SupplierRepository(testDb);
  });

  // 1. Rollback on missing product during sale
  it('1. Rolls back entire transaction when product is missing during sale creation', async () => {
    const merchant: Merchant = {
      id: 'm-rollback-1',
      code: 'M-001',
      name: 'Test Merchant',
      town: 'Yangon',
      phone: '091234567',
      currentReceivableBalance: 100000,
      totalPurchasesValue: 100000,
      totalPaidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await merchantRepo.save(merchant);

    const sale: SaleRecord = {
      id: 'sale-rollback-1',
      voucherNo: 'SL-ROLLBACK-01',
      date: '2026-03-30',
      time: '10:00',
      merchantId: 'm-rollback-1',
      merchantName: 'Test Merchant',
      merchantTown: 'Yangon',
      items: [
        {
          productId: 'non-existent-product-id',
          productName: 'Ghost Item',
          quantity: 50,
          unit: 'ထည်',
          unitPrice: 1000,
          subtotal: 50000,
        },
      ],
      totalItemsCount: 50,
      grandTotal: 50000,
      cashPaidByMerchant: 0,
      remainingReceivableBalance: 150000,
    };

    await expect(saleRepo.saveSaleAtomic(sale)).rejects.toThrow(EntityNotFoundError);

    // Verify nothing was saved and merchant balance was NOT modified
    const savedSale = await saleRepo.getById('sale-rollback-1');
    expect(savedSale).toBeUndefined();

    const untouchedMerchant = await merchantRepo.getById('m-rollback-1');
    expect(untouchedMerchant?.currentReceivableBalance).toBe(100000);
  });

  // 2. Rollback on missing supplier during inbound transaction
  it('2. Rolls back inbound transaction when supplier does not exist', async () => {
    const product: Product = {
      id: 'p-inbound-1',
      name: 'Raw Material A',
      category: 'Raw',
      unit: 'ခု',
      defaultPrice: 500,
      openingStock: 10,
      currentStock: 10,
      active: true,
    };
    await productRepo.save(product);

    const tx: TransactionRecord = {
      id: 'tx-rollback-1',
      voucherNo: 'TX-ROLLBACK-01',
      supplierId: 'non-existent-supplier-id',
      supplierName: 'Ghost Supplier',
      supplierVillage: 'Village X',
      date: '2026-03-30',
      time: '11:00',
      type: 'FULL_SETTLEMENT',
      items: [
        {
          productId: 'p-inbound-1',
          productName: 'Raw Material A',
          quantity: 100,
          unit: 'ခု',
          unitPrice: 500,
          subtotal: 50000,
        },
      ],
      totalGoodsValue: 50000,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 0,
    };

    await expect(txRepo.saveInboundAtomic(tx)).rejects.toThrow(EntityNotFoundError);

    // Product stock must remain unchanged (10)
    const untouchedProduct = await productRepo.getById('p-inbound-1');
    expect(untouchedProduct?.currentStock).toBe(10);
  });

  // 3. Duplicate submission idempotency check
  it('3. Rejects duplicate sale submission with IdempotencyConflictError', async () => {
    const merchant: Merchant = {
      id: 'm-idemp-1',
      code: 'M-002',
      name: 'Idempotent Merchant',
      town: 'Mandalay',
      phone: '099876543',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await merchantRepo.save(merchant);

    const sale: SaleRecord = {
      id: 'sale-idemp-unique',
      voucherNo: 'SL-IDEMP-01',
      date: '2026-03-30',
      time: '12:00',
      merchantId: 'm-idemp-1',
      merchantName: 'Idempotent Merchant',
      merchantTown: 'Mandalay',
      items: [],
      totalItemsCount: 0,
      grandTotal: 25000,
      cashPaidByMerchant: 25000,
      remainingReceivableBalance: 0,
    };

    // First save succeeds
    const firstAttempt = await saleRepo.saveSaleAtomic(sale);
    expect(firstAttempt.status).toBe('COMPLETED');

    // Second save with SAME ID must throw IdempotencyConflictError
    await expect(saleRepo.saveSaleAtomic(sale)).rejects.toThrow(IdempotencyConflictError);
  });

  // 4. Financial Calculation Safety Test
  it('4. Performs exact integer money calculations with zero precision drift', () => {
    expect(toSafeIntMoney(125000.49)).toBe(125000);
    expect(toSafeIntMoney(125000.51)).toBe(125001);
    expect(moneyAdd(15000, 25000)).toBe(40000);
    expect(moneySub(50000, 12500)).toBe(37500);
    expect(moneyMul(15, 3500)).toBe(52500);

    const items = [
      { quantity: 10, unitPrice: 1250 },
      { quantity: 5, unitPrice: 3200, discount: 500 },
      { quantity: 2, unitPrice: 45000 },
    ];
    // Line 1: 10 * 1250 = 12500
    // Line 2: 5 * 3200 - 500 = 15500
    // Line 3: 2 * 45000 = 90000
    // Total = 118000
    expect(moneyCalcTotal(items)).toBe(118000);
  });

  // 5. Collision-resistant ID generation test
  it('5. Generates unique collision-resistant UUIDs using crypto.randomUUID()', () => {
    const ids = new Set<string>();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      const id = generateStableId('test');
      expect(id).toMatch(/^test_[0-9a-fA-F-]+$/);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
    expect(ids.size).toBe(count);
  });
});
