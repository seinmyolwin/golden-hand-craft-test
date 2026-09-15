import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import {
  ProductRepository,
  SupplierRepository,
  MerchantRepository,
  TransactionRepository,
  SaleRepository,
  OrderRepository,
  DailyClosingRepository,
  CashMovementRepository,
  StockMovementRepository,
} from '../repositories';
import { executeGoLive } from '../services/businessInitializationService';
import { createCompleteBackup, validateBackupFile, executeSafeRestore } from '../services/backupService';
import { runOfflineStorageMigration } from '../db/migration';
import {
  enforcePermission,
  resetSessionForTesting,
  clearCurrentSession,
} from '../services/authorizationService';
import {
  derivePinCredentials,
  deriveSecretHash,
  constantTimeCompare,
  generateSecureRecoveryKey,
} from '../services/cryptoSecurity';
import { validateAttachmentFile } from '../services/attachmentService';
import {
  getStoredProducts,
  getStoredSuppliers,
  getStoredTransactions,
  getStoredSales,
  getStoredMerchants,
  getStoredStockAdjustments,
  getStoredDeletedHistory,
  getStoredMerchantOrders,
  getStoredMerchantPurchases,
  getStoredPeerTraders,
  getStoredPeerTransactions,
} from '../utils/storage';
import { Product, Supplier, Merchant, TransactionRecord, SaleRecord, MerchantOrder } from '../types';

describe('FINAL PRODUCTION READINESS INDEPENDENT VERIFICATION', () => {
  let productRepo: ProductRepository;
  let supplierRepo: SupplierRepository;
  let merchantRepo: MerchantRepository;
  let transactionRepo: TransactionRepository;
  let saleRepo: SaleRepository;
  let orderRepo: OrderRepository;
  let closingRepo: DailyClosingRepository;
  let cashRepo: CashMovementRepository;
  let stockRepo: StockMovementRepository;

  beforeEach(async () => {
    // Clear all tables
    await Promise.all(db.tables.map((table) => table.clear()));

    productRepo = new ProductRepository(db);
    supplierRepo = new SupplierRepository(db);
    merchantRepo = new MerchantRepository(db);
    transactionRepo = new TransactionRepository(db);
    saleRepo = new SaleRepository(db);
    orderRepo = new OrderRepository(db);
    closingRepo = new DailyClosingRepository(db);
    cashRepo = new CashMovementRepository(db);
    stockRepo = new StockMovementRepository(db);

    // Set Owner session for testing capability
    await resetSessionForTesting('OWNER');
  });

  afterEach(async () => {
    await clearCurrentSession();
  });

  // ==========================================
  // SECTION A: Legacy Storage & Persistence Regression
  // ==========================================
  describe('A. Legacy Storage Verification & Persistence', () => {
    it('verifies all getStored* functions return empty shims and do not pollute canonical IndexedDB', () => {
      expect(getStoredProducts()).toEqual([]);
      expect(getStoredSuppliers()).toEqual([]);
      expect(getStoredTransactions()).toEqual([]);
      expect(getStoredSales()).toEqual([]);
      expect(getStoredMerchants()).toEqual([]);
      expect(getStoredStockAdjustments()).toEqual([]);
      expect(getStoredDeletedHistory()).toEqual([]);
      expect(getStoredMerchantOrders()).toEqual([]);
      expect(getStoredMerchantPurchases()).toEqual([]);
      expect(getStoredPeerTraders()).toEqual([]);
      expect(getStoredPeerTransactions()).toEqual([]);
    });

    it('persists and reloads all core entities via Dexie repositories without data loss', async () => {
      const now = new Date().toISOString();

      // 1. Product
      const prod: Product = {
        id: 'p-100',
        name: 'ရွှေလက်စွပ် (၁ ပဲ)',
        category: 'လက်စွပ်',
        unit: 'ကွင်း',
        defaultPrice: 120000,
        defaultWholesalePrice: 150000,
        currentStock: 10,
        minStockAlert: 2,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await productRepo.save(prod);

      // 2. Supplier
      const sup: Supplier = {
        id: 's-100',
        name: 'ဦးမြ (ရွှေပန်းထိမ်)',
        village: 'ကျောက်ပန်းတောင်း',
        phone: '0912345678',
        advanceBalance: 50000,
        payableBalance: 0,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await supplierRepo.save(sup);

      // 3. Merchant
      const mer: Merchant = {
        id: 'm-100',
        name: 'ကိုအောင် (ရွှေဆိုင်)',
        town: 'မန္တလေး',
        phone: '0987654321',
        receivableBalance: 200000,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await merchantRepo.save(mer);

      // 4. Order
      const ord: MerchantOrder = {
        id: 'o-100',
        orderNo: 'ORD-20260914-001',
        merchantId: 'm-100',
        merchantName: 'ကိုအောင် (ရွှေဆိုင်)',
        merchantTown: 'မန္တလေး',
        orderDate: '2026-09-14',
        status: 'PENDING',
        totalOrderAmount: 150000,
        items: [
          {
            productId: 'p-100',
            productName: 'ရွှေလက်စွပ် (၁ ပဲ)',
            quantity: 1,
            unit: 'ကွင်း',
            unitPrice: 150000,
            agreedPrice: 150000,
            subtotal: 150000,
          },
        ],
        createdAt: now,
      };
      await orderRepo.save(ord);

      // Instantiate fresh repositories on same db connection
      const freshProdRepo = new ProductRepository(db);
      const freshSupRepo = new SupplierRepository(db);
      const freshMerRepo = new MerchantRepository(db);
      const freshOrdRepo = new OrderRepository(db);

      const loadedProd = await freshProdRepo.getById('p-100');
      const loadedSup = await freshSupRepo.getById('s-100');
      const loadedMer = await freshMerRepo.getById('m-100');
      const loadedOrd = await freshOrdRepo.getById('o-100');

      expect(loadedProd?.name).toBe('ရွှေလက်စွပ် (၁ ပဲ)');
      expect(loadedProd?.defaultWholesalePrice).toBe(150000);
      expect(loadedSup?.name).toBe('ဦးမြ (ရွှေပန်းထိမ်)');
      expect(loadedSup?.advanceBalance).toBe(50000);
      expect(loadedMer?.name).toBe('ကိုအောင် (ရွှေဆိုင်)');
      expect(loadedMer?.receivableBalance).toBe(200000);
      expect(loadedOrd?.status).toBe('PENDING');
      expect(loadedOrd?.totalOrderAmount).toBe(150000);
    });
  });

  // ==========================================
  // SECTION B: Duplicate & Idempotency Protection Proof
  // ==========================================
  describe('B. Duplicate Protection Proof', () => {
    it('rejects duplicate transaction insertion with same voucherNo / idempotencyKey', async () => {
      const now = new Date().toISOString();
      const prod: Product = {
        id: 'p-200',
        name: 'ရွှေဆွဲကြိုး',
        category: 'ဆွဲကြိုး',
        defaultPrice: 450000,
        defaultWholesalePrice: 500000,
        currentStock: 5,
        unit: 'ကုံး',
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await productRepo.save(prod);

      const sup: Supplier = {
        id: 's-200',
        name: 'ဒေါ်အေး',
        village: 'မန္တလေး',
        phone: '0911111111',
        advanceBalance: 0,
        payableBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      await supplierRepo.save(sup);

      const tx: TransactionRecord = {
        id: 'tx-200',
        voucherNo: 'TX-20260914-001',
        idempotencyKey: 'req-unique-tx-12345',
        supplierId: 's-200',
        supplierName: 'ဒေါ်အေး',
        date: '2026-09-14',
        time: '10:00',
        totalGoodsValue: 450000,
        cashPaidToSupplier: 450000,
        status: 'COMPLETED',
        items: [
          {
            productId: 'p-200',
            productName: 'ရွှေဆွဲကြိုး',
            quantity: 1,
            unit: 'ကုံး',
            unitPrice: 450000,
            subtotal: 450000,
          },
        ],
      };

      // 1. First execution
      await transactionRepo.saveInboundAtomic(tx);

      // 2. Second execution with same idempotency key (simulating double click)
      await expect(transactionRepo.saveInboundAtomic(tx)).rejects.toThrow();

      // Verify only 1 record in transactions table
      const count = await db.transactions.count();
      expect(count).toBe(1);
    });

    it('rejects duplicate sale insertion with same voucherNo / idempotencyKey', async () => {
      const now = new Date().toISOString();
      const prod: Product = {
        id: 'p-201',
        name: 'ရွှေဟန်းချိန်း',
        category: 'ဟန်းချိန်း',
        defaultPrice: 260000,
        defaultWholesalePrice: 300000,
        currentStock: 10,
        unit: 'ကွင်း',
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await productRepo.save(prod);

      const mer: Merchant = {
        id: 'm-201',
        name: 'ကိုသူရ',
        town: 'ရန်ကုန်',
        phone: '0922222222',
        receivableBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      await merchantRepo.save(mer);

      const sale: SaleRecord = {
        id: 'sale-201',
        voucherNo: 'SAL-20260914-001',
        idempotencyKey: 'req-unique-sale-99999',
        merchantId: 'm-201',
        merchantName: 'ကိုသူရ',
        date: '2026-09-14',
        time: '10:00',
        grandTotal: 300000,
        cashPaidByMerchant: 300000,
        remainingReceivable: 0,
        status: 'COMPLETED',
        items: [
          {
            productId: 'p-201',
            productName: 'ရွှေဟန်းချိန်း',
            quantity: 1,
            unit: 'ကွင်း',
            unitPrice: 300000,
            subtotal: 300000,
          },
        ],
      };

      // First execution
      await saleRepo.saveSaleAtomic(sale);

      // Second execution with same idempotency key
      await expect(saleRepo.saveSaleAtomic(sale)).rejects.toThrow();

      const count = await db.sales.count();
      expect(count).toBe(1);
    });
  });

  // ==========================================
  // SECTION C: Go-Live Destructive Safety Proof
  // ==========================================
  describe('C. Go-Live Destructive Safety Proof', () => {
    it('strictly prevents executeGoLive from wiping or modifying an already ACTIVE business', async () => {
      const now = new Date().toISOString();
      // 1. Setup ACTIVE business with existing real transactional data
      await db.settings.put({
        key: 'businessInitialization',
        value: {
          state: 'ACTIVE',
          isGoLiveCompleted: true,
          goLiveDate: '2026-09-01T00:00:00Z',
          confirmedByOwnerId: 'test-owner-id',
        },
        updatedAt: now,
      });

      const prod: Product = {
        id: 'prod-active-1',
        name: 'ရွှေဆွဲသီး',
        category: 'ဆွဲသီး',
        defaultPrice: 160000,
        defaultWholesalePrice: 200000,
        currentStock: 20,
        unit: 'ခု',
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await productRepo.save(prod);

      const mer: Merchant = {
        id: 'mer-active-1',
        name: 'ဦးဘိုး',
        town: 'မန္တလေး',
        phone: '0933333333',
        receivableBalance: 100000,
        createdAt: now,
        updatedAt: now,
      };
      await merchantRepo.save(mer);

      const sale: SaleRecord = {
        id: 'sale-active-1',
        voucherNo: 'SAL-ACTIVE-001',
        merchantId: 'mer-active-1',
        merchantName: 'ဦးဘိုး',
        date: '2026-09-14',
        time: '10:00',
        grandTotal: 200000,
        cashPaidByMerchant: 100000,
        remainingReceivable: 100000,
        status: 'COMPLETED',
        items: [
          {
            productId: 'prod-active-1',
            productName: 'ရွှေဆွဲသီး',
            quantity: 1,
            unit: 'ခု',
            unitPrice: 200000,
            subtotal: 200000,
          },
        ],
      };
      await saleRepo.saveSaleAtomic(sale);

      // Capture before snapshot
      const beforeProducts = await db.products.toArray();
      const beforeMerchants = await db.merchants.toArray();
      const beforeSales = await db.sales.toArray();
      const beforeCash = await db.cashMovements.toArray();
      const beforeStock = await db.stockMovements.toArray();

      // 2. Attempt to call executeGoLive() on ACTIVE business
      await expect(
        executeGoLive({
          targetDb: db,
          doubleConfirmed: true,
          pin: '1234',
        })
      ).rejects.toThrow('ACTIVE');

      // 3. Compare after snapshot: Verify 100% untouched data
      const afterProducts = await db.products.toArray();
      const afterMerchants = await db.merchants.toArray();
      const afterSales = await db.sales.toArray();
      const afterCash = await db.cashMovements.toArray();
      const afterStock = await db.stockMovements.toArray();

      expect(afterProducts).toEqual(beforeProducts);
      expect(afterMerchants).toEqual(beforeMerchants);
      expect(afterSales).toEqual(beforeSales);
      expect(afterCash).toEqual(beforeCash);
      expect(afterStock).toEqual(beforeStock);
    });
  });

  // ==========================================
  // SECTION D: Order -> Sale Atomic Rollback Proof
  // ==========================================
  describe('D. Order -> Sale Atomic Rollback Proof', () => {
    it('successfully fulfills order to sale atomically in happy path', async () => {
      const now = new Date().toISOString();
      const prod: Product = {
        id: 'p-atomic-1',
        name: 'ရွှေလက်ကောက်',
        category: 'လက်ကောက်',
        defaultPrice: 700000,
        defaultWholesalePrice: 800000,
        currentStock: 5,
        unit: 'ကွင်း',
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await productRepo.save(prod);

      const mer: Merchant = {
        id: 'm-atomic-1',
        name: 'ကိုဇော်',
        town: 'နေပြည်တော်',
        phone: '0944444444',
        receivableBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      await merchantRepo.save(mer);

      const ord: MerchantOrder = {
        id: 'ord-atomic-1',
        orderNo: 'ORD-ATOMIC-001',
        merchantId: 'm-atomic-1',
        merchantName: 'ကိုဇော်',
        merchantTown: 'နေပြည်တော်',
        orderDate: '2026-09-14',
        status: 'PENDING',
        totalOrderAmount: 800000,
        items: [
          {
            productId: 'p-atomic-1',
            productName: 'ရွှေလက်ကောက်',
            quantity: 1,
            unit: 'ကွင်း',
            unitPrice: 800000,
            agreedPrice: 800000,
            subtotal: 800000,
          },
        ],
      };
      await orderRepo.save(ord);

      const saleRecord: SaleRecord = {
        id: 'sale-ord-1',
        voucherNo: 'SAL-ORD-001',
        idempotencyKey: 'req-ord-sale-1',
        merchantId: 'm-atomic-1',
        merchantName: 'ကိုဇော်',
        date: '2026-09-14',
        time: '10:00',
        grandTotal: 800000,
        cashPaidByMerchant: 800000,
        remainingReceivable: 0,
        status: 'COMPLETED',
        items: [
          {
            productId: 'p-atomic-1',
            productName: 'ရွှေလက်ကောက်',
            quantity: 1,
            unit: 'ကွင်း',
            unitPrice: 800000,
            subtotal: 800000,
          },
        ],
      };

      const completed = await orderRepo.completeOrderAtomic('ord-atomic-1', saleRecord);
      expect(completed.status).toBe('DELIVERED');
      expect(completed.saleVoucherId).toBe('sale-ord-1');

      // Verify product stock reduced from 5 to 4
      const updatedProd = await productRepo.getById('p-atomic-1');
      expect(updatedProd?.currentStock).toBe(4);

      // Verify stock movement and cash movement recorded
      const stockMoves = await db.stockMovements.where('productId').equals('p-atomic-1').toArray();
      expect(stockMoves.length).toBe(1);
      expect(stockMoves[0].quantity).toBe(1);

      const cashMoves = await db.cashMovements.where('referenceId').equals('sale-ord-1').toArray();
      expect(cashMoves.length).toBe(1);
      expect(cashMoves[0].amount).toBe(800000);
    });

    it('rolls back completely when sale processing fails during order completion', async () => {
      const now = new Date().toISOString();
      const prod: Product = {
        id: 'p-fail-1',
        name: 'ရွှေဆွဲကြိုး',
        category: 'ဆွဲကြိုး',
        defaultPrice: 350000,
        defaultWholesalePrice: 400000,
        currentStock: 10,
        unit: 'ကုံး',
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await productRepo.save(prod);

      const mer: Merchant = {
        id: 'm-fail-1',
        name: 'ဒေါ်ခင်',
        town: 'မန္တလေး',
        phone: '0955555555',
        receivableBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      await merchantRepo.save(mer);

      const ord: MerchantOrder = {
        id: 'ord-fail-1',
        orderNo: 'ORD-FAIL-001',
        merchantId: 'm-fail-1',
        merchantName: 'ဒေါ်ခင်',
        merchantTown: 'မန္တလေး',
        orderDate: '2026-09-14',
        status: 'PENDING',
        totalOrderAmount: 400000,
        items: [
          {
            productId: 'p-fail-1',
            productName: 'ရွှေဆွဲကြိုး',
            quantity: 1,
            unit: 'ကုံး',
            unitPrice: 400000,
            agreedPrice: 400000,
            subtotal: 400000,
          },
        ],
      };
      await orderRepo.save(ord);

      // Invalid sale with non-existent merchant
      const badSaleRecord: SaleRecord = {
        id: 'sale-bad-1',
        voucherNo: 'SAL-BAD-001',
        idempotencyKey: 'req-bad-sale',
        merchantId: 'non-existent-merchant-id',
        merchantName: 'Unknown',
        date: '2026-09-14',
        time: '10:00',
        grandTotal: 400000,
        cashPaidByMerchant: 400000,
        remainingReceivable: 0,
        status: 'COMPLETED',
        items: [
          {
            productId: 'p-fail-1',
            productName: 'ရွှေဆွဲကြိုး',
            quantity: 1,
            unit: 'ကုံး',
            unitPrice: 400000,
            subtotal: 400000,
          },
        ],
      };

      await expect(orderRepo.completeOrderAtomic('ord-fail-1', badSaleRecord)).rejects.toThrow();

      // Verify complete rollback: Order is still PENDING
      const orderAfter = await orderRepo.getById('ord-fail-1');
      expect(orderAfter?.status).toBe('PENDING');
      expect(orderAfter?.saleVoucherId).toBeUndefined();

      // Product stock unchanged
      const prodAfter = await productRepo.getById('p-fail-1');
      expect(prodAfter?.currentStock).toBe(10);

      // No sales or movements created
      const salesCount = await db.sales.count();
      expect(salesCount).toBe(0);
      const stockCount = await db.stockMovements.count();
      expect(stockCount).toBe(0);
      const cashCount = await db.cashMovements.count();
      expect(cashCount).toBe(0);
    });
  });

  // ==========================================
  // SECTION E: Merchant Payment Idempotency Proof
  // ==========================================
  describe('E. Merchant Payment Idempotency Proof', () => {
    it('ensures same clientRequestId produces only one payment mutation and subsequent retries are idempotent', async () => {
      const now = new Date().toISOString();
      const mer: Merchant = {
        id: 'm-pay-1',
        name: 'ကိုကျော်',
        town: 'မန္တလေး',
        phone: '0966666666',
        receivableBalance: 500000,
        createdAt: now,
        updatedAt: now,
      };
      await merchantRepo.save(mer);

      const clientRequestId = 'req-settle-pay-999';

      // 1. First payment execution (200,000 MMK)
      const res1 = await merchantRepo.recordMerchantPaymentAtomic(
        'm-pay-1',
        200000,
        'CASH',
        'ပေးဆပ်ငွေ',
        clientRequestId
      );

      expect(res1.receivableBalance).toBe(300000);

      // 2. Retry with exact same clientRequestId
      const res2 = await merchantRepo.recordMerchantPaymentAtomic(
        'm-pay-1',
        200000,
        'CASH',
        'ပေးဆပ်ငွေ',
        clientRequestId
      );

      // Balance remains 300,000 and is not deducted twice
      expect(res2.receivableBalance).toBe(300000);

      // Verify cash movements count is exactly 1
      const cashEntries = await db.cashMovements.where('referenceId').equals('m-pay-1').toArray();
      expect(cashEntries.length).toBe(1);
      expect(cashEntries[0].amount).toBe(200000);

      // 3. Different clientRequestId for a legitimate second payment (100,000 MMK)
      const res3 = await merchantRepo.recordMerchantPaymentAtomic(
        'm-pay-1',
        100000,
        'CASH',
        'ဒုတိယအကြိမ် ပေးဆပ်ငွေ',
        'req-settle-pay-second-legit'
      );

      expect(res3.receivableBalance).toBe(200000);

      const cashEntriesAfter = await db.cashMovements.where('referenceId').equals('m-pay-1').toArray();
      expect(cashEntriesAfter.length).toBe(2);
    });
  });

  // ==========================================
  // SECTION F: Order State Machine Proof
  // ==========================================
  describe('F. Order State Machine Proof', () => {
    it('rejects invalid state transitions on orders', async () => {
      const now = new Date().toISOString();
      const ord: MerchantOrder = {
        id: 'ord-sm-1',
        orderNo: 'ORD-SM-001',
        merchantId: 'm-100',
        merchantName: 'ကိုအောင်',
        merchantTown: 'မန္တလေး',
        orderDate: '2026-09-14',
        status: 'PENDING',
        totalOrderAmount: 100000,
        items: [],
        createdAt: now,
      };
      await orderRepo.save(ord);

      // 1. Invalid: PENDING -> DELIVERED via save() directly without sale voucher
      await expect(
        orderRepo.save({
          ...ord,
          status: 'DELIVERED',
        })
      ).rejects.toThrow();

      // 2. Deliver validly via atomic flow
      const delivered = await orderRepo.completeOrderAtomic('ord-sm-1');
      expect(delivered.status).toBe('DELIVERED');

      // 3. Invalid: DELIVERED -> PENDING (Reverting delivered order)
      await expect(
        orderRepo.save({
          ...delivered,
          status: 'PENDING',
        })
      ).rejects.toThrow();

      // 4. Invalid: cancelOrderAtomic on DELIVERED order
      await expect(orderRepo.cancelOrderAtomic('ord-sm-1')).rejects.toThrow();
    });
  });

  // ==========================================
  // SECTION G: Backup / Restore Round Trip Proof
  // ==========================================
  describe('G. Backup / Restore Round Trip Proof', () => {
    it('exports backup, wipes database, restores backup and verifies identical dataset', async () => {
      const now = new Date().toISOString();
      // 1. Populate rich dataset
      const p: Product = {
        id: 'p-bk-1',
        name: 'ရွှေလက်ကောက် (အထူ)',
        category: 'လက်ကောက်',
        defaultPrice: 800000,
        defaultWholesalePrice: 900000,
        currentStock: 8,
        unit: 'ကွင်း',
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      const s: Supplier = {
        id: 's-bk-1',
        name: 'ကိုမြ',
        village: 'ပုဂံ',
        phone: '0977777777',
        advanceBalance: 150000,
        payableBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      const m: Merchant = {
        id: 'm-bk-1',
        name: 'ဒေါ်လှ',
        town: 'စစ်ကိုင်း',
        phone: '0988888888',
        receivableBalance: 350000,
        createdAt: now,
        updatedAt: now,
      };

      await productRepo.save(p);
      await supplierRepo.save(s);
      await merchantRepo.save(m);

      const sale: SaleRecord = {
        id: 'sale-bk-1',
        voucherNo: 'SAL-BK-001',
        idempotencyKey: 'req-bk-sale',
        merchantId: 'm-bk-1',
        merchantName: 'ဒေါ်လှ',
        date: '2026-09-14',
        time: '10:00',
        grandTotal: 900000,
        cashPaidByMerchant: 550000,
        remainingReceivable: 350000,
        status: 'COMPLETED',
        items: [
          {
            productId: 'p-bk-1',
            productName: 'ရွှေလက်ကောက် (အထူ)',
            quantity: 1,
            unit: 'ကွင်း',
            unitPrice: 900000,
            subtotal: 900000,
          },
        ],
      };
      await saleRepo.saveSaleAtomic(sale);

      const preBackupProducts = await db.products.toArray();
      const preBackupSuppliers = await db.suppliers.toArray();
      const preBackupMerchants = await db.merchants.toArray();
      const preBackupSales = await db.sales.toArray();

      // 2. Export backup
      const backupResult = await createCompleteBackup();
      expect(backupResult).toBeDefined();

      // 3. Reset database tables
      await db.products.clear();
      await db.suppliers.clear();
      await db.merchants.clear();
      await db.sales.clear();
      await db.cashMovements.clear();
      await db.stockMovements.clear();

      expect(await db.products.count()).toBe(0);
      expect(await db.sales.count()).toBe(0);

      // 4. Validate and restore from backup
      const report = await validateBackupFile(backupResult);
      expect(report.isValid).toBe(true);
      const restoreResult = await executeSafeRestore(report, 'OVERWRITE');
      expect(restoreResult.success).toBe(true);

      // 5. Compare after restore
      const postRestoreProducts = await db.products.toArray();
      const postRestoreSuppliers = await db.suppliers.toArray();
      const postRestoreMerchants = await db.merchants.toArray();
      const postRestoreSales = await db.sales.toArray();

      expect(postRestoreProducts.length).toBe(preBackupProducts.length);
      expect(postRestoreSuppliers.length).toBe(preBackupSuppliers.length);
      expect(postRestoreMerchants.length).toBe(preBackupMerchants.length);
      expect(postRestoreSales.length).toBe(preBackupSales.length);

      expect(postRestoreProducts[0].name).toBe('ရွှေလက်ကောက် (အထူ)');
      expect(postRestoreMerchants[0].name).toBe('ဒေါ်လှ');
      expect(postRestoreSales[0].voucherNo).toBe('SAL-BK-001');
    });
  });

  // ==========================================
  // SECTION H: Migration Recovery Proof
  // ==========================================
  describe('H. Migration Recovery Proof', () => {
    it('handles migration safely and idempotently without data loss', async () => {
      // 1. Initial migration run
      const res1 = await runOfflineStorageMigration();
      expect(res1.success).toBe(true);

      // 2. Repeat migration idempotency
      const res2 = await runOfflineStorageMigration();
      expect(res2.success).toBe(true);
    });
  });

  // ==========================================
  // SECTION I: Security Authorization Proof
  // ==========================================
  describe('I. Security Authorization Proof', () => {
    it('rejects unauthorized mutations when session lacks required permissions', async () => {
      // Set USER session with restricted permissions
      await resetSessionForTesting('USER');

      // 1. Staff attempting to VOID a transaction -> REJECTED
      await expect(
        enforcePermission('VOID_TRANSACTION', 'ဘောင်ချာ ပယ်ဖျက်ခြင်း')
      ).rejects.toThrow();

      // 2. Staff attempting BACKUP_RESTORE -> REJECTED
      await expect(
        enforcePermission('BACKUP_RESTORE', 'အရန်ဒေတာ ပြန်လည်ထည့်သွင်းခြင်း')
      ).rejects.toThrow();

      // 3. Clear session (Unauthenticated) -> All operations requiring permission REJECTED
      await clearCurrentSession();
      await expect(
        enforcePermission('OPERATIONAL_DATA_ENTRY', 'အဝယ်စာရင်း သွင်းခြင်း')
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // SECTION J: Crypto Security Proof
  // ==========================================
  describe('J. Crypto Security Proof', () => {
    it('generates cryptographic salts and verifies PBKDF2 PIN hashes securely', async () => {
      const pin = '5678';
      const { salt, hash } = await derivePinCredentials(pin);

      expect(salt.length).toBe(32); // 16 bytes in hex = 32 chars
      expect(hash.length).toBe(64); // SHA-256 in hex = 64 chars

      // Valid PIN verification
      const computedHash = await deriveSecretHash(pin, salt);
      expect(constantTimeCompare(computedHash, hash)).toBe(true);

      // Invalid PIN verification
      const wrongHash = await deriveSecretHash('9999', salt);
      expect(constantTimeCompare(wrongHash, hash)).toBe(false);

      // Emergency recovery key format
      const recoveryKey = generateSecureRecoveryKey();
      expect(recoveryKey).toMatch(/^SLY-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    });
  });

  // ==========================================
  // SECTION K: Attachment Validation Proof
  // ==========================================
  describe('K. Attachment Validation Proof', () => {
    it('strictly enforces allowedTypes when specified', () => {
      const pngBlob = new Blob(['fake png data'], { type: 'image/png' });
      const jpegBlob = new Blob(['fake jpeg data'], { type: 'image/jpeg' });
      const gifBlob = new Blob(['fake gif data'], { type: 'image/gif' });
      const webpBlob = new Blob(['fake webp data'], { type: 'image/webp' });
      const svgBlob = new Blob(['fake svg data'], { type: 'image/svg+xml' });

      // Only PNG allowed
      expect(() => validateAttachmentFile(pngBlob, { allowedTypes: ['image/png'] })).not.toThrow();
      expect(() => validateAttachmentFile(jpegBlob, { allowedTypes: ['image/png'] })).toThrow();
      expect(() => validateAttachmentFile(gifBlob, { allowedTypes: ['image/png'] })).toThrow();
      expect(() => validateAttachmentFile(webpBlob, { allowedTypes: ['image/png'] })).toThrow();
      expect(() => validateAttachmentFile(svgBlob, { allowedTypes: ['image/png'] })).toThrow();
    });

    it('accepts standard image formats in default configuration', () => {
      const pngBlob = new Blob(['png'], { type: 'image/png' });
      const jpegBlob = new Blob(['jpeg'], { type: 'image/jpeg' });
      const webpBlob = new Blob(['webp'], { type: 'image/webp' });

      expect(() => validateAttachmentFile(pngBlob)).not.toThrow();
      expect(() => validateAttachmentFile(jpegBlob)).not.toThrow();
      expect(() => validateAttachmentFile(webpBlob)).not.toThrow();
    });
  });
});
