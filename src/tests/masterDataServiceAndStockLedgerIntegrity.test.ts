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
import { Product, Supplier, Merchant } from '../types';

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
        category: 'ယွန်းထည်',
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
        category: 'ယွန်းထည်',
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
        category: 'ယွန်းထည်',
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
        category: 'ယွန်းထည်',
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
});
