import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// Polyfill localStorage
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

import { db } from '../db/database';
import { Product, StockMovementRecord } from '../types';
import {
  reconcileProductStockPure,
  reconcileAllStock,
} from '../services/reconciliation/stockReconciliationService';

describe('Phase 18 - Stock Reconciliation Service', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.stockMovements.clear();
  });

  it('correctly validates a matched product inventory against stock movements', () => {
    const product: Product = {
      id: 'prod_001',
      name: 'ရွှေလက်ရာ လက်ကောက်',
      unit: 'ကွင်း',
      category: 'ရွှေထည်',
      defaultPrice: 150000,
      active: true,
      openingStock: 10,
      currentStock: 25, // 10 (open) + 20 (in) + 5 (return in) + 2 (pos adj) - 10 (out) - 2 (neg adj) = 25
    };

    const movements: StockMovementRecord[] = [
      {
        id: 'sm_1',
        productId: 'prod_001',
        productName: 'ရွှေလက်ရာ လက်ကောက်',
        movementType: 'SUPPLIER_INBOUND',
        quantity: 20,
        direction: 'IN',
        signedQuantity: 20,
        referenceType: 'TRANSACTION',
        referenceId: 'tx_1',
        status: 'COMPLETED',
        createdAt: '2026-03-01T10:00:00Z',
        transactionDate: '2026-03-01',
        idempotencyKey: 'sm_1_key',
        schemaVersion: 1,
      },
      {
        id: 'sm_2',
        productId: 'prod_001',
        productName: 'ရွှေလက်ရာ လက်ကောက်',
        movementType: 'SALES_RETURN_INBOUND',
        quantity: 5,
        direction: 'IN',
        signedQuantity: 5,
        referenceType: 'SALE',
        referenceId: 'ret_1',
        status: 'COMPLETED',
        createdAt: '2026-03-02T11:00:00Z',
        transactionDate: '2026-03-02',
        idempotencyKey: 'sm_2_key',
        schemaVersion: 1,
      },
      {
        id: 'sm_3',
        productId: 'prod_001',
        productName: 'ရွှေလက်ရာ လက်ကောက်',
        movementType: 'STOCK_ADJUSTMENT_IN',
        quantity: 2,
        direction: 'IN',
        signedQuantity: 2,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: 'adj_1',
        status: 'COMPLETED',
        createdAt: '2026-03-02T12:00:00Z',
        transactionDate: '2026-03-02',
        idempotencyKey: 'sm_3_key',
        schemaVersion: 1,
      },
      {
        id: 'sm_4',
        productId: 'prod_001',
        productName: 'ရွှေလက်ရာ လက်ကောက်',
        movementType: 'MERCHANT_OUTBOUND',
        quantity: 10,
        direction: 'OUT',
        signedQuantity: -10,
        referenceType: 'SALE',
        referenceId: 'sale_1',
        status: 'COMPLETED',
        createdAt: '2026-03-03T14:00:00Z',
        transactionDate: '2026-03-03',
        idempotencyKey: 'sm_4_key',
        schemaVersion: 1,
      },
      {
        id: 'sm_5',
        productId: 'prod_001',
        productName: 'ရွှေလက်ရာ လက်ကောက်',
        movementType: 'DAMAGE_LOSS',
        quantity: 2,
        direction: 'OUT',
        signedQuantity: -2,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: 'adj_2',
        status: 'COMPLETED',
        createdAt: '2026-03-04T16:00:00Z',
        transactionDate: '2026-03-04',
        idempotencyKey: 'sm_5_key',
        schemaVersion: 1,
      },
    ];

    const result = reconcileProductStockPure(product, movements);

    expect(result.status).toBe('MATCH');
    expect(result.expectedStock).toBe(25);
    expect(result.actualStock).toBe(25);
    expect(result.difference).toBe(0);
    expect(result.validInboundMovements).toBe(20);
    expect(result.validReturnInMovements).toBe(5);
    expect(result.validOutboundMovements).toBe(10);
  });

  it('detects stock discrepancies without mutating data when currentStock is out of sync', () => {
    const product: Product = {
      id: 'prod_002',
      name: 'ရွှေလက်ရာ ဆွဲကြိုး',
      unit: 'ကုံး',
      category: 'ရွှေထည်',
      defaultPrice: 200000,
      active: true,
      openingStock: 50,
      currentStock: 40, // Should be 50 + 10 - 5 = 55! (Discrepancy: -15)
    };

    const movements: StockMovementRecord[] = [
      {
        id: 'sm_10',
        productId: 'prod_002',
        productName: 'ရွှေလက်ရာ ဆွဲကြိုး',
        movementType: 'SUPPLIER_INBOUND',
        quantity: 10,
        signedQuantity: 10,
        direction: 'IN',
        referenceType: 'TRANSACTION',
        referenceId: 'tx_10',
        status: 'COMPLETED',
        createdAt: '2026-03-01T10:00:00Z',
        transactionDate: '2026-03-01',
        idempotencyKey: 'sm_10_key',
        schemaVersion: 1,
      },
      {
        id: 'sm_11',
        productId: 'prod_002',
        productName: 'ရွှေလက်ရာ ဆွဲကြိုး',
        movementType: 'MERCHANT_OUTBOUND',
        quantity: 5,
        signedQuantity: -5,
        direction: 'OUT',
        referenceType: 'SALE',
        referenceId: 'sale_10',
        status: 'COMPLETED',
        createdAt: '2026-03-02T10:00:00Z',
        transactionDate: '2026-03-02',
        idempotencyKey: 'sm_11_key',
        schemaVersion: 1,
      },
    ];

    const result = reconcileProductStockPure(product, movements);

    expect(result.status).toBe('MISMATCH');
    expect(result.expectedStock).toBe(55);
    expect(result.actualStock).toBe(40);
    expect(result.difference).toBe(-15);
    expect(result.issues?.length).toBeGreaterThan(0);
  });

  it('identifies invalid movements with negative or NaN quantity', () => {
    const product: Product = {
      id: 'prod_003',
      name: 'ရွှေလက်ရာ နားကပ်',
      unit: 'ရံ',
      category: 'ရွှေထည်',
      defaultPrice: 80000,
      active: true,
      openingStock: 0,
      currentStock: 0,
    };

    const movements: StockMovementRecord[] = [
      {
        id: 'sm_bad_1',
        productId: 'prod_003',
        productName: 'ရွှေလက်ရာ နားကပ်',
        movementType: 'SUPPLIER_INBOUND',
        quantity: -5,
        signedQuantity: -5,
        direction: 'IN',
        referenceType: 'TRANSACTION',
        referenceId: 'tx_bad',
        status: 'COMPLETED',
        createdAt: '2026-03-01T10:00:00Z',
        transactionDate: '2026-03-01',
        idempotencyKey: 'sm_bad_1_key',
        schemaVersion: 1,
      },
      {
        id: 'sm_bad_2',
        productId: 'prod_003',
        productName: 'ရွှေလက်ရာ နားကပ်',
        movementType: 'UNKNOWN_TYPE' as any,
        quantity: 10,
        signedQuantity: 10,
        direction: 'UNKNOWN' as any,
        referenceType: 'TRANSACTION',
        referenceId: 'tx_bad2',
        status: 'COMPLETED',
        createdAt: '2026-03-01T11:00:00Z',
        transactionDate: '2026-03-01',
        idempotencyKey: 'sm_bad_2_key',
        schemaVersion: 1,
      },
    ];

    const result = reconcileProductStockPure(product, movements);
    expect(result.status).toBe('INVALID_MOVEMENT');
    expect(result.invalidMovements?.length).toBe(2);
  });

  it('reconciles entire database and generates structured summary', async () => {
    await db.products.bulkPut([
      {
        id: 'p1',
        name: 'Product 1',
        unit: 'ခု',
        category: 'အထွေထွေ',
        defaultPrice: 10000,
        active: true,
        openingStock: 100,
        currentStock: 80,
      },
      {
        id: 'p2',
        name: 'Product 2',
        unit: 'ခု',
        category: 'အထွေထွေ',
        defaultPrice: 20000,
        active: true,
        openingStock: 50,
        currentStock: 50,
      },
    ]);

    await db.stockMovements.bulkPut([
      {
        id: 'sm_p1',
        productId: 'p1',
        productName: 'Product 1',
        movementType: 'MERCHANT_OUTBOUND',
        quantity: 20,
        signedQuantity: -20,
        direction: 'OUT',
        referenceType: 'SALE',
        referenceId: 'sale_p1',
        status: 'COMPLETED',
        createdAt: '2026-03-01T10:00:00Z',
        transactionDate: '2026-03-01',
        idempotencyKey: 'sm_p1_key',
        schemaVersion: 1,
      },
    ]);

    const result = await reconcileAllStock(db);

    expect(result.totalProducts).toBe(2);
    expect(result.matchedCount).toBe(2);
    expect(result.mismatchedCount).toBe(0);
    expect(result.overallStockStatus).toBe('MATCH');
    expect(result.summary.totalExpectedInventoryCount).toBe(130);
    expect(result.summary.totalActualInventoryCount).toBe(130);
  });
});
