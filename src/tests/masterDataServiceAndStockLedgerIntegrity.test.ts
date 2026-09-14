import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import { masterDataService } from '../services/masterDataService';
import {
  recordStockMovement,
  reconcileProductStock,
  reconcileAllProductsStock,
  initializeOrMigrateStockLedger,
  getPersistedStockMovements,
  calculateProductStockLedger,
} from '../services/stockLedgerService';
import { Product, Supplier, Merchant, TransactionRecord, SaleRecord, MerchantPurchaseRecord } from '../types';
import {
  TransactionRepository,
  SaleRepository,
  MerchantPurchaseRepository,
} from '../repositories';

describe('Master Data Service & Stock Ledger Persistence (Phase 14)', () => {
  beforeEach(async () => {
    // Clear all test tables in the singleton db
    await db.products.clear();
    await db.suppliers.clear();
    await db.merchants.clear();
    await db.transactions.clear();
    await db.sales.clear();
    await db.merchantPurchases.clear();
    await db.orders.clear();
    await db.stockAdjustments.clear();
    await db.peerTrades.clear();
    await db.stockMovements.clear();
    await db.softDeletedItems.clear();
    await db.auditLogs.clear();
  });

  describe('Master Data Service - Product Validation & Operations', () => {
    it('creates a product with valid input and initializes opening stock movement', async () => {
      const validProduct: Partial<Product> = {
        id: 'p-test-1',
        name: 'ယွန်း ကွမ်းအစ် (ကြီး)',
        category: 'ကုန်ချော',
        unit: 'ထည်',
        defaultPrice: 25000,
        defaultWholesalePrice: 32000,
        openingStock: 20,
        currentStock: 20,
        minStockAlert: 5,
        active: true,
      };

      const saved = await masterDataService.saveProduct(validProduct);
      expect(saved.id).toBe('p-test-1');
      expect(saved.name).toBe('ယွန်း ကွမ်းအစ် (ကြီး)');

      const fetched = await db.products.get('p-test-1');
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe('ယွန်း ကွမ်းအစ် (ကြီး)');

      // Verify opening stock movement was recorded in stockMovements
      const movements = await db.stockMovements.where('productId').equals('p-test-1').toArray();
      expect(movements.length).toBe(1);
      expect(movements[0].movementType).toBe('OPENING_BALANCE');
      expect(movements[0].quantity).toBe(20);
      expect(movements[0].direction).toBe('INITIAL');
    });

    it('validates product and rejects empty name or negative price', () => {
      const emptyNameValidation = masterDataService.validateProduct({ name: '', defaultPrice: 1000 });
      expect(emptyNameValidation.isValid).toBe(false);
      expect(emptyNameValidation.error).toContain('ကုန်ပစ္စည်းအမည်');

      const negativePriceValidation = masterDataService.validateProduct({ name: 'ကွမ်းအစ်', defaultPrice: -500 });
      expect(negativePriceValidation.isValid).toBe(false);
      expect(negativePriceValidation.error).toContain('ဝယ်ယူစျေးနှုန်း');
    });

    it('soft-deletes product if historical references exist', async () => {
      const prod: Partial<Product> = {
        id: 'p-with-tx',
        name: 'ယွန်းခွက်',
        category: 'ကုန်ချော',
        unit: 'လုံး',
        defaultPrice: 5000,
        openingStock: 10,
        currentStock: 10,
        active: true,
      };
      await masterDataService.saveProduct(prod);

      // Add a transaction referencing this product
      await db.transactions.add({
        id: 'tx-ref-1',
        voucherNo: 'INB-001',
        date: '2026-01-01',
        time: '10:00',
        supplierId: 'sup-1',
        supplierName: 'ကိုစန်း',
        supplierVillage: 'ကူနီ',
        items: [{ productId: 'p-with-tx', productName: 'ယွန်းခွက်', quantity: 5, unitPrice: 5000, subtotal: 25000, unit: 'လုံး' }],
        rawMaterialDeductions: [],
        totalAmount: 25000,
        rawMaterialDeductionTotal: 0,
        netPayable: 25000,
        paidAmount: 25000,
        remainingAdvanceBalance: 0,
      });

      const delResult = await masterDataService.deleteProductSafe('p-with-tx');
      expect(delResult.success).toBe(true);
      expect(delResult.softDeleted).toBe(true);

      const fetched = await db.products.get('p-with-tx');
      expect(fetched?.active).toBe(false); // soft-deleted in products table
    });
  });

  describe('Master Data Service - Supplier Validation & Operations', () => {
    it('creates and validates supplier', async () => {
      const supplier: Partial<Supplier> = {
        id: 'sup-test-1',
        code: 'S-001',
        name: 'ဦးမြစိုး',
        village: 'ကူနီ',
        phone: '09-12345678',
        currentAdvanceBalance: 0,
        totalAdvanceGiven: 0,
        totalGoodsValueDelivered: 0,
      };

      const saved = await masterDataService.saveSupplier(supplier);
      expect(saved.id).toBe('sup-test-1');
      expect(saved.code).toBe('S-001');

      const fetched = await db.suppliers.get('sup-test-1');
      expect(fetched?.name).toBe('ဦးမြစိုး');
    });

    it('rejects duplicate supplier code in validation', async () => {
      const sup1: Partial<Supplier> = {
        id: 'sup-1',
        code: 'S-999',
        name: 'ကိုအောင်',
        village: 'ကူနီ',
      };
      await masterDataService.saveSupplier(sup1);

      const allSuppliers = await db.suppliers.toArray();
      const validation = masterDataService.validateSupplier(
        { id: 'sup-2', code: 'S-999', name: 'ကိုမျိုး' },
        allSuppliers
      );
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('S-999');
    });
  });

  describe('Master Data Service - Merchant Validation & Operations', () => {
    it('creates and validates merchant', async () => {
      const merchant: Partial<Merchant> = {
        id: 'merch-test-1',
        code: 'M-001',
        name: 'ရွှေမန္တလေး ယွန်းတိုက်',
        town: 'မန္တလေး',
        phone: '09-98765432',
        currentReceivableBalance: 0,
        totalPurchasesValue: 0,
        totalPaidAmount: 0,
      };

      const saved = await masterDataService.saveMerchant(merchant);
      expect(saved.id).toBe('merch-test-1');

      const fetched = await db.merchants.get('merch-test-1');
      expect(fetched?.name).toBe('ရွှေမန္တလေး ယွန်းတိုက်');
    });
  });

  describe('Stock Ledger Service - Persistence & Idempotency', () => {
    it('records stock movements idempotently without duplicating', async () => {
      const movement = {
        productId: 'prod-idem-1',
        movementType: 'SUPPLIER_INBOUND' as const,
        quantity: 15,
        direction: 'IN' as const,
        signedQuantity: 15,
        referenceType: 'TRANSACTION' as const,
        referenceId: 'tx-idem-1',
        referenceVoucherNo: 'INB-100',
        transactionDate: '2026-01-10',
        idempotencyKey: 'INBOUND_tx-idem-1_prod-idem-1',
      };

      const res1 = await recordStockMovement(movement);
      expect(res1.id).toBeDefined();

      // Duplicate attempt with exact same idempotencyKey
      const res2 = await recordStockMovement(movement);
      expect(res2.id).toBe(res1.id);

      const count = await db.stockMovements.where('productId').equals('prod-idem-1').count();
      expect(count).toBe(1);
    });

    it('reconciles stock discrepancies and synchronizes Product.currentStock', async () => {
      const prod: Product = {
        id: 'prod-recon-1',
        name: 'ကွမ်းအစ်အထူး',
        category: 'ကုန်ချော',
        unit: 'ထည်',
        defaultPrice: 10000,
        openingStock: 10,
        currentStock: 999, // Intentional mismatch
        active: true,
      };
      await db.products.add(prod);

      // Record a valid inbound movement (+15) via transaction record
      await db.transactions.add({
        id: 'tx-recon-1',
        voucherNo: 'INB-RECON',
        date: '2026-01-02',
        time: '10:00',
        supplierId: 'sup-1',
        supplierName: 'ကိုစန်း',
        supplierVillage: 'ကူနီ',
        items: [{ productId: 'prod-recon-1', productName: 'ကွမ်းအစ်အထူး', quantity: 15, unitPrice: 10000, subtotal: 150000, unit: 'ထည်' }],
        rawMaterialDeductions: [],
        totalAmount: 150000,
        rawMaterialDeductionTotal: 0,
        netPayable: 150000,
        paidAmount: 150000,
        remainingAdvanceBalance: 0,
      });

      // Expected balance: 10 (opening) + 15 (inbound) = 25
      const reconResult = await reconcileProductStock('prod-recon-1');
      expect(reconResult.reconciled).toBe(true);
      expect(reconResult.previousStock).toBe(999);
      expect(reconResult.newStock).toBe(25);
      expect(reconResult.discrepancy).toBe(999 - 25);

      const fixedProd = await db.products.get('prod-recon-1');
      expect(fixedProd?.currentStock).toBe(25);
    });

    it('migrates legacy database to stock movements safely and idempotently', async () => {
      const prod: Product = {
        id: 'legacy-p1',
        name: 'ရှေးရိုးယွန်းအိုး',
        category: 'ကုန်ချော',
        unit: 'လုံး',
        defaultPrice: 20000,
        openingStock: 5,
        currentStock: 25,
        active: true,
      };
      await db.products.add(prod);

      await db.transactions.add({
        id: 'legacy-tx-1',
        voucherNo: 'INB-LEGACY',
        date: '2026-01-01',
        time: '09:00',
        supplierId: 'sup-1',
        supplierName: 'ကိုအောင်',
        supplierVillage: 'ကူနီ',
        items: [{ productId: 'legacy-p1', productName: 'ရှေးရိုးယွန်းအိုး', quantity: 20, unitPrice: 20000, subtotal: 400000, unit: 'လုံး' }],
        rawMaterialDeductions: [],
        totalAmount: 400000,
        rawMaterialDeductionTotal: 0,
        netPayable: 400000,
        paidAmount: 400000,
        remainingAdvanceBalance: 0,
      });

      const migrationResult = await initializeOrMigrateStockLedger();
      expect(migrationResult.migratedCount).toBeGreaterThanOrEqual(2); // opening + transaction

      const movements = await db.stockMovements.where('productId').equals('legacy-p1').toArray();
      expect(movements.some((m) => m.movementType === 'OPENING_BALANCE')).toBe(true);
      expect(movements.some((m) => m.movementType === 'SUPPLIER_INBOUND')).toBe(true);

      // Running migration a second time skips (idempotent)
      const secondRun = await initializeOrMigrateStockLedger();
      expect(secondRun.skipped).toBe(true);
    });
  });

  describe('Phase 22 — Auto-create Supplier/Merchant on Entry (Atomic)', () => {
    const txRepo = new TransactionRepository(db);
    const saleRepo = new SaleRepository(db);
    const purRepo = new MerchantPurchaseRepository(db);

    it('auto-creates a new supplier inside saveInboundAtomic when supplierId is __NEW__', async () => {
      // 1. Setup product
      const prod: Product = {
        id: 'prod-auto-1',
        name: 'ယွန်းပန်းကန်',
        category: 'ကုန်ချော',
        unit: 'ချပ်',
        defaultPrice: 5000,
        openingStock: 10,
        currentStock: 10,
        active: true,
      };
      await db.products.add(prod);

      const tx: TransactionRecord = {
        id: 'tx-auto-sup-1',
        voucherNo: 'IN-AUTO-001',
        date: '2026-03-01',
        time: '14:30',
        supplierId: '__NEW__',
        supplierName: 'ဦးမောင်မောင်',
        supplierVillage: 'ကူနီ',
        supplierPhone: '0912345678',
        type: 'COLLECTION_AND_SETTLEMENT',
        items: [{ productId: 'prod-auto-1', productName: 'ယွန်းပန်းကန်', quantity: 20, unitPrice: 5000, subtotal: 100000, unit: 'ချပ်' }],
        totalGoodsValue: 100000,
        previousAdvanceBalance: 0,
        advanceDeducted: 0,
        newAdvanceTaken: 0,
        cashPaidToSupplier: 100000,
        netCashPaidToSupplier: 100000,
        remainingAdvanceBalance: 0,
      };

      const savedTx = await txRepo.saveInboundAtomic(tx);
      expect(savedTx.supplierId).not.toBe('__NEW__');
      expect(savedTx.supplierName).toBe('ဦးမောင်မောင်');

      // Verify supplier was created in DB
      const createdSup = await db.suppliers.get(savedTx.supplierId);
      expect(createdSup).toBeDefined();
      expect(createdSup?.name).toBe('ဦးမောင်မောင်');
      expect(createdSup?.village).toBe('ကူနီ');
      expect(createdSup?.phone).toBe('0912345678');
      expect(createdSup?.totalGoodsValueDelivered).toBe(100000);

      // Verify audit log
      const audit = await db.auditLogs.where('referenceId').equals(savedTx.supplierId).first();
      expect(audit).toBeDefined();
      expect(audit?.actionType).toBe('CREATE_SUPPLIER');

      // Verify product stock updated
      const updatedProd = await db.products.get('prod-auto-1');
      expect(updatedProd?.currentStock).toBe(30);
    });

    it('reuses existing supplier case-insensitively without creating duplicate suppliers', async () => {
      // Create initial supplier
      const sup: Supplier = {
        id: 'sup-exist-1',
        code: 'SUP-001',
        name: 'ဒေါ်အေးသန်း',
        village: 'ဝက်လက်',
        phone: '0998765432',
        currentAdvanceBalance: 10000,
        totalGoodsValueDelivered: 50000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.suppliers.add(sup);

      const prod: Product = {
        id: 'prod-auto-2',
        name: 'ယွန်းသေတ္တာ',
        category: 'ကုန်ချော',
        unit: 'လုံး',
        defaultPrice: 15000,
        openingStock: 5,
        currentStock: 5,
        active: true,
      };
      await db.products.add(prod);

      const tx: TransactionRecord = {
        id: 'tx-reuse-sup-1',
        voucherNo: 'IN-REUSE-001',
        date: '2026-03-01',
        time: '15:00',
        supplierId: '__NEW__',
        supplierName: '  ဒေါ်အေးသန်း  ', // Same name with whitespace
        supplierVillage: 'ဝက်လက်',
        items: [{ productId: 'prod-auto-2', productName: 'ယွန်းသေတ္တာ', quantity: 2, unitPrice: 15000, subtotal: 30000, unit: 'လုံး' }],
        totalGoodsValue: 30000,
        previousAdvanceBalance: 10000,
        advanceDeducted: 10000,
        newAdvanceTaken: 0,
        cashPaidToSupplier: 20000,
        netCashPaidToSupplier: 20000,
        remainingAdvanceBalance: 0,
      };

      const savedTx = await txRepo.saveInboundAtomic(tx);
      expect(savedTx.supplierId).toBe('sup-exist-1');

      // Ensure no duplicate supplier was created
      const allSups = await db.suppliers.toArray();
      expect(allSups.length).toBe(1);

      // Verify balance update on existing supplier
      const updatedSup = await db.suppliers.get('sup-exist-1');
      expect(updatedSup?.currentAdvanceBalance).toBe(0);
      expect(updatedSup?.totalGoodsValueDelivered).toBe(80000);
    });

    it('auto-creates a new merchant inside saveSaleAtomic when merchantId is __NEW__', async () => {
      const prod: Product = {
        id: 'prod-sale-1',
        name: 'ယွန်းဖလား',
        category: 'ကုန်ချော',
        unit: 'လုံး',
        defaultPrice: 8000,
        defaultWholesalePrice: 12000,
        openingStock: 50,
        currentStock: 50,
        active: true,
      };
      await db.products.add(prod);

      const sale: SaleRecord = {
        id: 'sale-auto-merch-1',
        voucherNo: 'SL-AUTO-001',
        date: '2026-03-02',
        time: '11:00',
        merchantId: '__NEW__',
        merchantName: 'ရတနာရွှေပြည် ကုန်သည်',
        merchantTown: 'မန္တလေး',
        merchantPhone: '0977788899',
        items: [{ productId: 'prod-sale-1', productName: 'ယွန်းဖလား', quantity: 10, unitPrice: 12000, subtotal: 120000, unit: 'လုံး' }],
        totalItemsCount: 10,
        grandTotal: 120000,
        cashPaidByMerchant: 50000,
        remainingReceivableBalance: 70000,
      };

      const savedSale = await saleRepo.saveSaleAtomic(sale);
      expect(savedSale.merchantId).not.toBe('__NEW__');
      expect(savedSale.merchantName).toBe('ရတနာရွှေပြည် ကုန်သည်');

      // Check DB
      const createdMerch = await db.merchants.get(savedSale.merchantId!);
      expect(createdMerch).toBeDefined();
      expect(createdMerch?.name).toBe('ရတနာရွှေပြည် ကုန်သည်');
      expect(createdMerch?.town).toBe('မန္တလေး');
      expect(createdMerch?.currentReceivableBalance).toBe(70000);
      expect(createdMerch?.totalPurchasesValue).toBe(120000);
      expect(createdMerch?.totalPaidAmount).toBe(50000);

      // Audit log
      const audit = await db.auditLogs.where('referenceId').equals(savedSale.merchantId!).first();
      expect(audit).toBeDefined();
      expect(audit?.actionType).toBe('CREATE_MERCHANT');

      // Product stock decremented
      const updatedProd = await db.products.get('prod-sale-1');
      expect(updatedProd?.currentStock).toBe(40);
    });

    it('reuses existing merchant in saveSaleAtomic and savePurchaseAtomic without duplicates', async () => {
      const merch: Merchant = {
        id: 'merch-exist-1',
        code: 'M-001',
        name: 'အောင်သပြေ ရောင်းဝယ်ရေး',
        town: 'ရန်ကုန်',
        phone: '0944455566',
        currentReceivableBalance: 10000,
        totalPurchasesValue: 50000,
        totalPaidAmount: 40000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.merchants.add(merch);

      const prod: Product = {
        id: 'prod-sale-2',
        name: 'ယွန်းဗန်း',
        category: 'ကုန်ချော',
        unit: 'ချပ်',
        defaultPrice: 10000,
        defaultWholesalePrice: 15000,
        openingStock: 20,
        currentStock: 20,
        active: true,
      };
      await db.products.add(prod);

      const sale: SaleRecord = {
        id: 'sale-reuse-merch-1',
        voucherNo: 'SL-REUSE-001',
        date: '2026-03-02',
        time: '12:00',
        merchantId: '__NEW__',
        merchantName: '  အောင်သပြေ ရောင်းဝယ်ရေး  ',
        merchantTown: 'ရန်ကုန်',
        items: [{ productId: 'prod-sale-2', productName: 'ယွန်းဗန်း', quantity: 5, unitPrice: 15000, subtotal: 75000, unit: 'ချပ်' }],
        grandTotal: 75000,
        cashPaidByMerchant: 75000,
        remainingReceivableBalance: 10000,
      };

      const savedSale = await saleRepo.saveSaleAtomic(sale);
      expect(savedSale.merchantId).toBe('merch-exist-1');

      const allMerchants = await db.merchants.toArray();
      expect(allMerchants.length).toBe(1);
    });

    it('rolls back newly created supplier if a downstream error occurs in saveInboundAtomic', async () => {
      const tx: TransactionRecord = {
        id: 'tx-fail-1',
        voucherNo: 'IN-FAIL-001',
        date: '2026-03-01',
        time: '16:00',
        supplierId: '__NEW__',
        supplierName: 'ဦးကံဆိုး',
        supplierVillage: 'ကူနီ',
        type: 'COLLECTION_AND_SETTLEMENT',
        items: [{ productId: 'non-existent-product-id', productName: 'မရှိသောပစ္စည်း', quantity: 10, unitPrice: 5000, subtotal: 50000, unit: 'ခု' }],
        totalGoodsValue: 50000,
        previousAdvanceBalance: 0,
        advanceDeducted: 0,
        newAdvanceTaken: 0,
        cashPaidToSupplier: 50000,
        netCashPaidToSupplier: 50000,
        remainingAdvanceBalance: 0,
      };

      await expect(txRepo.saveInboundAtomic(tx)).rejects.toThrow();

      // Ensure rollback: supplier must NOT exist in DB
      const sup = await db.suppliers.where('name').equals('ဦးကံဆိုး').first();
      expect(sup).toBeUndefined();

      // Ensure transaction record was not saved
      const txInDb = await db.transactions.get('tx-fail-1');
      expect(txInDb).toBeUndefined();
    });
  });
});
