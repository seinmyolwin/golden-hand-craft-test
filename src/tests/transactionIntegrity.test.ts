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
  OrderRepository,
  PeerTradeRepository,
  SoftDeleteRepository,
  IdempotencyConflictError,
  EntityNotFoundError,
} from '../repositories';
import {
  SaleRecord,
  TransactionRecord,
  Product,
  Merchant,
  Supplier,
  MerchantPurchaseRecord,
  MerchantOrder,
  StockAdjustmentRecord,
  PeerTradeRecord,
} from '../types';
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
  let orderRepo: OrderRepository;
  let peerTradeRepo: PeerTradeRepository;
  let softDeleteRepo: SoftDeleteRepository;

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
    orderRepo = new OrderRepository(testDb);
    peerTradeRepo = new PeerTradeRepository(testDb);
    softDeleteRepo = new SoftDeleteRepository(testDb);
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

  // 6. Duplicate Audit Entry Count == 0 for Atomic Sale & Cancellation
  it('6. Asserts atomic sale execution creates exactly 1 audit entry (duplicate count == 0) and returns auditEntry', async () => {
    const merchant: Merchant = {
      id: 'm-audit-test-1',
      code: 'M-AUD-01',
      name: 'Audit Merchant',
      town: 'Mandalay',
      phone: '091111111',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await merchantRepo.save(merchant);

    const product: Product = {
      id: 'p-audit-test-1',
      name: 'Bamboo Chair',
      category: 'Furniture',
      unit: 'လုံး',
      defaultPrice: 15000,
      openingStock: 20,
      currentStock: 20,
      active: true,
    };
    await productRepo.save(product);

    const sale: SaleRecord = {
      id: 'sale-audit-unique-1',
      voucherNo: 'SL-AUD-001',
      date: '2026-03-30',
      time: '14:00',
      merchantId: 'm-audit-test-1',
      merchantName: 'Audit Merchant',
      merchantTown: 'Mandalay',
      items: [
        {
          productId: 'p-audit-test-1',
          productName: 'Bamboo Chair',
          quantity: 2,
          unit: 'လုံး',
          unitPrice: 15000,
          subtotal: 30000,
        },
      ],
      totalItemsCount: 2,
      grandTotal: 30000,
      cashPaidByMerchant: 10000,
      remainingReceivableBalance: 20000,
    };

    // Execute atomic sale
    const saved = await saleRepo.saveSaleAtomic(sale);

    // Verify auditEntry is populated on returned object
    expect(saved.auditEntry).toBeDefined();
    expect(saved.auditEntry?.entityId).toBe(sale.id);
    expect(saved.auditEntry?.entityType).toBe('SALE');

    // Check DB: exactly 1 audit entry for this entityId (zero duplicate entries)
    const auditLogsForSale = await testDb.auditLogs.where('entityId').equals(sale.id).toArray();
    expect(auditLogsForSale.length).toBe(1);
    expect(auditLogsForSale[0].id).toBe(saved.auditEntry?.id);

    // Cancel sale atomically
    const cancelled = await saleRepo.cancelSaleAtomic(sale.id, 'Customer cancellation');
    expect(cancelled.auditEntry).toBeDefined();
    expect(cancelled.auditEntry?.entityId).toBe(sale.id);
    expect(cancelled.auditEntry?.action).toContain('ဖျက်သိမ်းခြင်း');

    // Check DB: exactly 2 audit entries for this entityId (1 creation + 1 cancellation)
    const updatedAuditLogs = await testDb.auditLogs.where('entityId').equals(sale.id).toArray();
    expect(updatedAuditLogs.length).toBe(2);
  });

  // 7. True Atomicity & Rollback on Transaction Failure (Audit Log Rollback)
  it('7. Rolls back audit log entry when atomic transaction fails midway', async () => {
    // Clear all audit logs before test
    await testDb.auditLogs.clear();
    expect(await testDb.auditLogs.count()).toBe(0);

    const merchant: Merchant = {
      id: 'm-rollback-audit-1',
      code: 'M-RBA-01',
      name: 'Rollback Audit Merchant',
      town: 'Yangon',
      phone: '092222222',
      currentReceivableBalance: 50000,
      totalPurchasesValue: 50000,
      totalPaidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await merchantRepo.save(merchant);

    // Create a sale referencing a non-existent product
    const invalidSale: SaleRecord = {
      id: 'sale-failed-rollback-1',
      voucherNo: 'SL-FAIL-01',
      date: '2026-03-30',
      time: '15:00',
      merchantId: 'm-rollback-audit-1',
      merchantName: 'Rollback Audit Merchant',
      merchantTown: 'Yangon',
      items: [
        {
          productId: 'non-existent-product-for-audit-test',
          productName: 'Missing Item',
          quantity: 5,
          unit: 'ခု',
          unitPrice: 2000,
          subtotal: 10000,
        },
      ],
      totalItemsCount: 5,
      grandTotal: 10000,
      cashPaidByMerchant: 0,
      remainingReceivableBalance: 60000,
    };

    // saveSaleAtomic must throw EntityNotFoundError
    await expect(saleRepo.saveSaleAtomic(invalidSale)).rejects.toThrow(EntityNotFoundError);

    // CRITICAL: True atomicity assertion - audit log must also be rolled back!
    // Total audit logs count in database must be 0
    const auditCount = await testDb.auditLogs.count();
    expect(auditCount).toBe(0);

    const saleRecord = await saleRepo.getById('sale-failed-rollback-1');
    expect(saleRecord).toBeUndefined();
  });

  // 8. Inbound Transaction & Cancel Inbound Atomic Audit Integrity
  it('8. Asserts saveInboundAtomic and cancelInboundAtomic create single audit entries without duplicates', async () => {
    const supplier: Supplier = {
      id: 's-inbound-audit-1',
      code: 'SUP-AUD-01',
      name: 'Audit Supplier',
      village: 'Village A',
      phone: '093333333',
      currentAdvanceBalance: 100000,
      totalGoodsValueDelivered: 0,
      totalAdvanceGiven: 100000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await supplierRepo.save(supplier);

    const product: Product = {
      id: 'p-inbound-audit-1',
      name: 'Rattan Cane',
      category: 'Raw',
      unit: 'ချောင်း',
      defaultPrice: 1000,
      openingStock: 50,
      currentStock: 50,
      active: true,
    };
    await productRepo.save(product);

    const tx: TransactionRecord = {
      id: 'tx-inbound-audit-1',
      voucherNo: 'TX-AUD-001',
      supplierId: 's-inbound-audit-1',
      supplierName: 'Audit Supplier',
      supplierVillage: 'Village A',
      date: '2026-03-30',
      time: '16:00',
      type: 'PARTIAL_DEDUCTION',
      items: [
        {
          productId: 'p-inbound-audit-1',
          productName: 'Rattan Cane',
          quantity: 20,
          unit: 'ချောင်း',
          unitPrice: 1000,
          subtotal: 20000,
        },
      ],
      totalGoodsValue: 20000,
      previousAdvanceBalance: 100000,
      advanceDeducted: 20000,
      newAdvanceTaken: 0,
      remainingAdvanceBalance: 80000,
    };

    const savedTx = await txRepo.saveInboundAtomic(tx);
    expect(savedTx.auditEntry).toBeDefined();
    expect(savedTx.auditEntry?.entityType).toBe('TRANSACTION');
    expect(savedTx.auditEntry?.entityId).toBe(tx.id);

    // Exactly 1 audit entry for this tx.id
    const logsForTx = await testDb.auditLogs.where('entityId').equals(tx.id).toArray();
    expect(logsForTx.length).toBe(1);

    // Cancel inbound atomically
    const cancelledTx = await txRepo.cancelInboundAtomic(tx.id, 'Incorrect entry');
    expect(cancelledTx.auditEntry).toBeDefined();
    expect(cancelledTx.auditEntry?.entityId).toBe(tx.id);

    // Total audit entries for tx.id is now 2 (1 inbound + 1 cancel)
    const updatedLogsForTx = await testDb.auditLogs.where('entityId').equals(tx.id).toArray();
    expect(updatedLogsForTx.length).toBe(2);
  });

  // 9. Merchant Raw Material Purchases Atomic Audit Integrity
  it('9. Asserts savePurchaseAtomic and cancelPurchaseAtomic create single audit entries without duplicates', async () => {
    const merchant: Merchant = {
      id: 'm-purch-audit-1',
      code: 'M-PUR-01',
      name: 'Purchase Merchant',
      town: 'Bagan',
      phone: '094444444',
      currentReceivableBalance: 100000,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await merchantRepo.save(merchant);

    const purchase: MerchantPurchaseRecord = {
      id: 'purch-audit-unique-1',
      purchaseNo: 'PUR-AUD-001',
      merchantId: 'm-purch-audit-1',
      merchantName: 'Purchase Merchant',
      merchantTown: 'Bagan',
      date: '2026-03-30',
      time: '17:00',
      items: [
        {
          productId: 'p-raw-1',
          productName: 'Raw Bamboo',
          quantity: 100,
          unit: 'လုံး',
          unitPrice: 500,
          subtotal: 50000,
        },
      ],
      totalAmount: 50000,
      paidAmount: 50000,
      remainingPayableBalance: 0,
      createdAt: new Date().toISOString(),
    };

    const savedPurchase = await purchaseRepo.savePurchaseAtomic(purchase);
    expect(savedPurchase.auditEntry).toBeDefined();
    expect(savedPurchase.auditEntry?.entityType).toBe('PURCHASE');
    expect(savedPurchase.auditEntry?.entityId).toBe(purchase.id);

    // Exactly 1 audit entry for this purchase.id
    const logs = await testDb.auditLogs.where('entityId').equals(purchase.id).toArray();
    expect(logs.length).toBe(1);

    // Cancel purchase atomically
    const cancelled = await purchaseRepo.cancelPurchaseAtomic(purchase.id, 'Wrong order cancellation');
    expect(cancelled.auditEntry).toBeDefined();

    const updatedLogs = await testDb.auditLogs.where('entityId').equals(purchase.id).toArray();
    expect(updatedLogs.length).toBe(2);
  });

  // 10. Financial Operations & Inventory Adjustment Atomic Audit Integrity
  it('10. Asserts recordMerchantPaymentAtomic, recordSupplierAdvanceAtomic, and saveAdjustmentAtomic write atomic audit logs', async () => {
    const merchant: Merchant = {
      id: 'm-pay-audit-1',
      code: 'M-PAY-01',
      name: 'Paying Merchant',
      town: 'Pyin Oo Lwin',
      phone: '095555555',
      currentReceivableBalance: 200000,
      totalPurchasesValue: 200000,
      totalPaidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await merchantRepo.save(merchant);

    // Record merchant payment atomically
    const paidMerchant = await merchantRepo.recordMerchantPaymentAtomic(
      'm-pay-audit-1',
      50000,
      'CASH',
      'Partial debt settlement'
    );
    expect(paidMerchant.auditEntry).toBeDefined();
    expect(paidMerchant.auditEntry?.entityType).toBe('MERCHANT');
    expect(paidMerchant.auditEntry?.entityId).toBe('m-pay-audit-1');

    // Supplier advance
    const supplier: Supplier = {
      id: 's-adv-audit-1',
      code: 'SUP-ADV-01',
      name: 'Advance Supplier',
      village: 'Village B',
      phone: '096666666',
      currentAdvanceBalance: 50000,
      totalGoodsValueDelivered: 0,
      totalAdvanceGiven: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await supplierRepo.save(supplier);

    const advanceTx = await txRepo.recordSupplierAdvanceAtomic(
      's-adv-audit-1',
      30000,
      'Pre-season advance'
    );
    expect(advanceTx.auditEntry).toBeDefined();
    expect(advanceTx.auditEntry?.entityType).toBe('SUPPLIER_ADVANCE');

    // Stock adjustment
    const product: Product = {
      id: 'p-adj-audit-1',
      name: 'Vase',
      category: 'Craft',
      unit: 'ခု',
      defaultPrice: 5000,
      openingStock: 10,
      currentStock: 10,
      active: true,
    };
    await productRepo.save(product);

    const adj: StockAdjustmentRecord = {
      id: 'adj-audit-1',
      productId: 'p-adj-audit-1',
      productName: 'Vase',
      type: 'OUT_ADJUSTMENT',
      quantity: -2,
      previousStock: 10,
      newStock: 8,
      reason: 'DAMAGED',
      date: '2026-03-30',
      time: '18:00',
      createdAt: new Date().toISOString(),
    };
    const savedAdj = await stockAdjRepo.saveAdjustmentAtomic(adj);
    expect(savedAdj.auditEntry).toBeDefined();
    expect(savedAdj.auditEntry?.entityType).toBe('STOCK_ADJUSTMENT');
  });

  // 11. Soft Delete & Restore and Peer Trade Atomic Audit Integrity
  it('11. Asserts softDeleteAtomic, restoreAtomic, and saveTradeAtomic write atomic audit logs', async () => {
    const supplier: Supplier = {
      id: 's-soft-audit-1',
      code: 'SUP-SFT-01',
      name: 'Deletable Supplier',
      village: 'Village C',
      phone: '097777777',
      currentAdvanceBalance: 0,
      totalGoodsValueDelivered: 0,
      totalAdvanceGiven: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await supplierRepo.save(supplier);

    // Soft delete atomically
    const softItem = await softDeleteRepo.softDeleteAtomic(
      'SUPPLIER',
      's-soft-audit-1',
      'Deletable Supplier (Village C)'
    );
    expect(softItem.auditEntry).toBeDefined();
    expect(softItem.auditEntry?.action).toContain('အမှိုက်ပုံး');

    // Restore atomically
    const restored = await softDeleteRepo.restoreAtomic(softItem.id);
    expect(restored.auditEntry).toBeDefined();
    expect(restored.auditEntry?.action).toContain('ပြန်လည်ဆယ်ယူခြင်း');

    // Peer trade
    const product: Product = {
      id: 'p-trade-audit-1',
      name: 'Mat',
      category: 'Household',
      unit: 'ချပ်',
      defaultPrice: 8000,
      openingStock: 10,
      currentStock: 10,
      active: true,
    };
    await productRepo.save(product);

    const trade: PeerTradeRecord = {
      id: 'trade-audit-1',
      voucherNo: 'TR-AUD-001',
      date: '2026-03-30',
      time: '19:00',
      tradeType: 'LEND_OUT',
      peerShopName: 'Friend Shop',
      productId: 'p-trade-audit-1',
      productName: 'Mat',
      quantity: 3,
      unit: 'ချပ်',
      status: 'PENDING',
    };
    const savedTrade = await peerTradeRepo.saveTradeAtomic(trade);
    expect(savedTrade.auditEntry).toBeDefined();
    expect(savedTrade.auditEntry?.entityType).toBe('PEER_TRADE');
  });
});
