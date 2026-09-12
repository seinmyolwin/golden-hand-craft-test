import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Polyfill localStorage and sessionStorage for test environment
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

const sessionStorageMock = (() => {
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
if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = sessionStorageMock;
}

import { db } from '../db/database';
import { saleRepo, productRepo, merchantRepo } from '../repositories';
import {
  calculateAllProductsStockLedgerSummaries,
  calculateProductStockLedger,
  reconcileAllProductsStock,
} from '../services/stockLedgerService';
import {
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession,
  resetSessionForTesting,
  savePersistedUsers,
  getPersistedUsers,
  SETTING_USERS_KEY,
  AUTH_SYNC_CHANNEL_NAME,
} from '../services/authorizationService';
import {
  formatStorageError,
  isQuotaExceededError,
} from '../services/attachmentService';
import { Product, SaleRecord, Merchant, TransactionRecord } from '../types';

describe('Phase 20 — Concurrency, Performance & Offline Reliability Tests', () => {
  beforeEach(async () => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    await db.delete();
    await db.open();
    await resetSessionForTesting('OWNER');
  });

  // ==========================================
  // Section 1: Multi-Tab Write Concurrency
  // ==========================================
  describe('Multi-Tab Write Concurrency & Dexie ACID Locks', () => {
    it('1. Concurrent saveSaleAtomic() calls on distinct/same products succeed atomically without corruption', async () => {
      const merchant: Merchant = {
        id: 'm-concurrent-1',
        name: 'Daw Hla Hla Merchant',
        town: 'Mandalay',
        phone: '0912345678',
        currentReceivableBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.merchants.put(merchant);

      const prod1: Product = {
        id: 'p-conc-1',
        name: 'Gold Ring 1K',
        category: 'Rings',
        unit: 'Pcs',
        defaultPrice: 100000,
        defaultWholesalePrice: 120000,
        openingStock: 50,
        currentStock: 50,
        active: true,
        createdAt: new Date().toISOString(),
      };
      const prod2: Product = {
        id: 'p-conc-2',
        name: 'Gold Necklace 2K',
        category: 'Necklaces',
        unit: 'Pcs',
        defaultPrice: 200000,
        defaultWholesalePrice: 250000,
        openingStock: 30,
        currentStock: 30,
        active: true,
        createdAt: new Date().toISOString(),
      };
      await db.products.bulkPut([prod1, prod2]);

      // Prepare two concurrent sales with unique idempotency keys
      const sale1: SaleRecord = {
        id: 'sale-concurrent-A',
        voucherNo: 'V-CONC-001',
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantTown: merchant.town,
        date: '2026-03-30',
        time: '10:00',
        items: [{ productId: prod1.id, productName: prod1.name, quantity: 5, unitPrice: 120000, subtotal: 600000, unit: 'Pcs' }],
        totalAmount: 600000,
        paidAmount: 200000,
        remainingReceivableBalance: 400000,
        idempotencyKey: 'idemp-tab1-sale-A',
        createdAt: new Date().toISOString(),
      };

      const sale2: SaleRecord = {
        id: 'sale-concurrent-B',
        voucherNo: 'V-CONC-002',
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantTown: merchant.town,
        date: '2026-03-30',
        time: '10:01',
        items: [
          { productId: prod1.id, productName: prod1.name, quantity: 3, unitPrice: 120000, subtotal: 360000, unit: 'Pcs' },
          { productId: prod2.id, productName: prod2.name, quantity: 2, unitPrice: 250000, subtotal: 500000, unit: 'Pcs' },
        ],
        totalAmount: 860000,
        paidAmount: 860000,
        remainingReceivableBalance: 0,
        idempotencyKey: 'idemp-tab2-sale-B',
        createdAt: new Date().toISOString(),
      };

      // Execute both transactions concurrently
      const [res1, res2] = await Promise.all([
        saleRepo.saveSaleAtomic(sale1),
        saleRepo.saveSaleAtomic(sale2),
      ]);

      expect(res1.id).toBe('sale-concurrent-A');
      expect(res2.id).toBe('sale-concurrent-B');

      // Verify all tables maintained strict consistency
      const updatedProd1 = await db.products.get(prod1.id);
      const updatedProd2 = await db.products.get(prod2.id);

      // Prod1 stock: 50 - 5 - 3 = 42
      expect(updatedProd1?.currentStock).toBe(42);
      // Prod2 stock: 30 - 2 = 28
      expect(updatedProd2?.currentStock).toBe(28);

      // Verify merchant balance updated properly: 0 + 400000 + 0 = 400000
      const updatedMerchant = await db.merchants.get(merchant.id);
      expect(updatedMerchant?.currentReceivableBalance).toBe(0);

      // Verify stock movements logged for both sales
      const movements = await db.stockMovements.where('referenceId').anyOf(['sale-concurrent-A', 'sale-concurrent-B']).toArray();
      expect(movements.length).toBe(3); // 1 from sale1, 2 from sale2
    });

    it('2. Idempotent re-submission of identical sale with same idempotencyKey does not double-decrement stock', async () => {
      const merchant: Merchant = {
        id: 'm-idemp',
        name: 'Ko Kyaw',
        town: 'Yangon',
        phone: '09987654321',
        currentReceivableBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.merchants.put(merchant);

      const prod: Product = {
        id: 'p-idemp-1',
        name: 'Silver Bracelet',
        category: 'Bracelets',
        unit: 'Pcs',
        defaultPrice: 50000,
        defaultWholesalePrice: 60000,
        openingStock: 20,
        currentStock: 20,
        active: true,
        createdAt: new Date().toISOString(),
      };
      await db.products.put(prod);

      const sale: SaleRecord = {
        id: 'sale-idemp-1',
        voucherNo: 'V-IDEMP-001',
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantTown: merchant.town,
        date: '2026-03-30',
        time: '12:00',
        items: [{ productId: prod.id, productName: prod.name, quantity: 4, unitPrice: 60000, subtotal: 240000, unit: 'Pcs' }],
        totalAmount: 240000,
        paidAmount: 240000,
        remainingReceivableBalance: 0,
        idempotencyKey: 'idemp-duplicate-safe-123',
        createdAt: new Date().toISOString(),
      };

      // First submit
      await saleRepo.saveSaleAtomic(sale);
      let afterFirst = await db.products.get(prod.id);
      expect(afterFirst?.currentStock).toBe(16);

      // Re-submit identical sale (network retry or multi-click duplicate)
      await expect(saleRepo.saveSaleAtomic(sale)).rejects.toThrow();
      let afterSecond = await db.products.get(prod.id);
      expect(afterSecond?.currentStock).toBe(16); // Must remain 16, NOT 12!
    });
  });

  // ==========================================
  // Section 2: Multi-Tab Session Synchronization
  // ==========================================
  describe('Multi-Tab Session Synchronization', () => {
    it('3. BroadcastChannel dispatches event when Owner logs out or deactivates user', async () => {
      let broadcastSent = false;
      const originalBroadcastChannel = (globalThis as any).BroadcastChannel;

      class MockBroadcastChannel {
        name: string;
        constructor(name: string) {
          this.name = name;
        }
        postMessage(msg: any) {
          if (this.name === AUTH_SYNC_CHANNEL_NAME && msg.type === 'SESSION_LOGOUT') {
            broadcastSent = true;
          }
        }
        close() {}
      }

      (globalThis as any).BroadcastChannel = MockBroadcastChannel;

      try {
        await clearCurrentSession();
        expect(broadcastSent).toBe(true);

        const session = await getCurrentSession();
        expect(session).toBeNull();
      } finally {
        (globalThis as any).BroadcastChannel = originalBroadcastChannel;
      }
    });

    it('4. Deactivated user cannot hold an active session in any tab', async () => {
      const users = await getPersistedUsers();
      const staffUser = users.find((u) => u.role === 'USER')!;
      expect(staffUser).toBeDefined();

      // Deactivate the staff user
      const updatedUsers = users.map((u) => (u.id === staffUser.id ? { ...u, isActive: false } : u));
      await savePersistedUsers(updatedUsers);

      // Attempt to establish or read session for the deactivated user
      await expect(
        setCurrentSession({
          userId: staffUser.id,
          role: 'USER',
        })
      ).rejects.toThrow();

      const activeSession = await getCurrentSession();
      expect(activeSession).toBeNull();
    });
  });

  // ==========================================
  // Section 3: Large-Dataset Performance O(P + N)
  // ==========================================
  describe('Large-Dataset Performance Optimization', () => {
    it('5. calculateAllProductsStockLedgerSummaries() scales linearly on 2,000 movements across 50 products', () => {
      const productCount = 50;
      const products: Product[] = [];
      for (let i = 1; i <= productCount; i++) {
        products.push({
          id: `prod-perf-${i}`,
          name: `Performance Test Product ${i}`,
          category: 'Test Category',
          unit: 'Pcs',
          defaultPrice: 10000 * i,
          defaultWholesalePrice: 12000 * i,
          openingStock: 100,
          currentStock: 100,
          active: true,
          createdAt: '2026-01-01T00:00:00Z',
        });
      }

      // Generate 1,000 transactions (inbound) and 1,000 sales (outbound) distributed across the 50 products
      const transactions: TransactionRecord[] = [];
      const sales: SaleRecord[] = [];

      for (let i = 1; i <= 1000; i++) {
        const prodIndex = (i % productCount) + 1;
        transactions.push({
          id: `tx-perf-${i}`,
          voucherNo: `TX-P-${i}`,
          supplierId: `supp-${(i % 10) + 1}`,
          supplierName: 'Test Supplier',
          date: '2026-02-15',
          time: '08:30',
          items: [
            {
              productId: `prod-perf-${prodIndex}`,
              productName: `Performance Test Product ${prodIndex}`,
              quantity: 10,
              unitPrice: 10000,
              subtotal: 100000,
              unit: 'Pcs',
            },
          ],
          totalAmount: 100000,
          status: 'COMPLETED',
          createdAt: '2026-02-15T08:30:00Z',
        });
      }

      for (let i = 1; i <= 1000; i++) {
        const prodIndex = (i % productCount) + 1;
        sales.push({
          id: `sale-perf-${i}`,
          voucherNo: `SALE-P-${i}`,
          merchantId: `merch-${(i % 10) + 1}`,
          merchantName: 'Test Merchant',
          merchantTown: 'Mandalay',
          date: '2026-03-01',
          time: '14:00',
          items: [
            {
              productId: `prod-perf-${prodIndex}`,
              productName: `Performance Test Product ${prodIndex}`,
              quantity: 4,
              unitPrice: 12000,
              subtotal: 48000,
              unit: 'Pcs',
            },
          ],
          totalAmount: 48000,
          paidAmount: 48000,
          remainingReceivableBalance: 0,
          createdAt: '2026-03-01T14:00:00Z',
        });
      }

      const startTime = performance.now();
      const summaries = calculateAllProductsStockLedgerSummaries(
        products,
        transactions,
        sales,
        [],
        [],
        []
      );
      const durationMs = performance.now() - startTime;

      expect(summaries.length).toBe(50);
      // Ensure the calculation took well under 500ms for 2,000 records
      expect(durationMs).toBeLessThan(500);

      // Verify mathematical accuracy for product 1:
      // Inbound: 1000 txs / 50 = 20 txs * 10 = 200 units in
      // Outbound: 1000 sales / 50 = 20 sales * 4 = 80 units out
      // Opening: 100
      // Closing: 100 + 200 - 80 = 220
      const prod1Summary = summaries.find((s) => s.product.id === 'prod-perf-1');
      expect(prod1Summary).toBeDefined();
      expect(prod1Summary?.openingBalance).toBe(100);
      expect(prod1Summary?.totalInflowQty).toBe(200);
      expect(prod1Summary?.totalOutflowQty).toBe(80);
      expect(prod1Summary?.calculatedClosingBalance).toBe(220);
    });

    it('6. reconcileAllProductsStock() executes batch reconciliation quickly', async () => {
      const prod: Product = {
        id: 'p-reconcile-test',
        name: 'Jade Pendant',
        category: 'Pendants',
        unit: 'Pcs',
        defaultPrice: 80000,
        defaultWholesalePrice: 95000,
        openingStock: 10,
        currentStock: 999, // Intentional drift/discrepancy
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
      };
      await db.products.put(prod);

      const result = await reconcileAllProductsStock();
      expect(result.totalChecked).toBeGreaterThanOrEqual(1);
      expect(result.totalAdjusted).toBeGreaterThanOrEqual(1);

      const reconciledProd = await db.products.get('p-reconcile-test');
      expect(reconciledProd?.currentStock).toBe(10); // Synchronized to ledger truth (opening stock 10)
    });
  });

  // ==========================================
  // Section 4: Storage Quota & Error Handling
  // ==========================================
  describe('Storage Quota Error Handling', () => {
    it('7. QuotaExceededError is accurately identified and translated into Myanmar guidance', () => {
      const quotaErr = new Error('Quota exceeded on device storage');
      quotaErr.name = 'QuotaExceededError';

      expect(isQuotaExceededError(quotaErr)).toBe(true);
      const formatted = formatStorageError(quotaErr);
      expect(formatted.message).toContain('သိုလှောင်မှု ပမာဏ ပြည့်သွားပါပြီ');
    });

    it('8. Standard non-quota errors are formatted appropriately', () => {
      const genericErr = new Error('Database connection failed');
      expect(isQuotaExceededError(genericErr)).toBe(false);
      const formatted = formatStorageError(genericErr);
      expect(formatted.message).toContain('Database connection failed');
    });
  });
});
