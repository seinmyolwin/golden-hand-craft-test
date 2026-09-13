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
import {
  recordDailyClosingAtomic,
  getPreviousClosingCash,
  correctDailyClosingAtomic,
} from '../services/dailyClosingService';
import { calculateDailyCashSummary } from '../services/cashLedgerService';
import { TransactionRepository } from '../repositories/index';
import { computeDailySummary } from '../utils/storage';
import { Supplier, Product, TransactionRecord } from '../types';

describe('P0.3 — dailyClosingService & Inbound Cash/Stock Re-Audit', () => {
  const txRepo = new TransactionRepository();

  beforeEach(async () => {
    await db.transactions.clear();
    await db.suppliers.clear();
    await db.products.clear();
    await db.stockMovements.clear();
    await db.cashMovements.clear();
    await db.dailyClosings.clear();
    await db.auditLogs.clear();
    await db.settings.clear();
  });

  it('verifies new supplier inbound collection atomic save correctly records cash movements and daily closing', async () => {
    // 1. Setup supplier & product
    const supplier: Supplier = {
      id: 'sup_test_1',
      code: 'S-001',
      name: 'ဦးမြ',
      phone: '091234567',
      village: 'မင်းနန်သူ',
      currentAdvanceBalance: 50000,
      totalGoodsValueDelivered: 0,
      totalAdvanceGiven: 50000,
      active: true,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    await db.suppliers.put(supplier);

    const product: Product = {
      id: 'prod_test_1',
      name: 'ဝါးခြင်း',
      category: 'ကုန်ချော',
      unit: 'လုံး',
      defaultPrice: 5000,
      currentStock: 10,
      openingStock: 10,
      minStockAlert: 5,
      active: true,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    await db.products.put(product);

    // 2. Perform inbound transaction with cash paid out + new advance given
    const txInput: TransactionRecord = {
      id: 'tx_test_1',
      voucherNo: 'TX-001',
      supplierId: 'sup_test_1',
      supplierName: 'ဦးမြ',
      date: '2026-03-01',
      time: '10:30',
      totalGoodsValue: 50000,
      advanceDeducted: 20000,
      newAdvanceTaken: 10000,
      newAdvanceReason: 'ဝါးဖိုးကြိုထုတ်',
      cashPaidToSupplier: 30000,
      netCashPaidToSupplier: 30000,
      remainingAdvanceBalance: 40000, // 50000 - 20000 + 10000
      items: [
        {
          productId: 'prod_test_1',
          productName: 'ဝါးခြင်း',
          quantity: 10,
          unit: 'လုံး',
          unitPrice: 5000,
          subtotal: 50000,
        },
      ],
    };

    const savedTx = await txRepo.saveInboundAtomic(txInput);
    expect(savedTx.id).toBeDefined();
    expect(savedTx.type).toBe('COLLECTION_AND_SETTLEMENT');
    expect(savedTx.cashPaidToSupplier).toBe(30000);

    // 3. Verify stock movements created
    const stockMvs = await db.stockMovements.where('referenceId').equals(savedTx.id).toArray();
    expect(stockMvs.length).toBe(1);
    expect(stockMvs[0].signedQuantity).toBe(10);

    // 4. Verify cash movements created:
    // - Payout: 30,000 MMK
    // - Advance given: 10,000 MMK
    const cashMvs = await db.cashMovements.where('referenceId').equals(savedTx.id).toArray();
    expect(cashMvs.length).toBe(2);

    const payoutMv = cashMvs.find((m) => m.type === 'SUPPLIER_PAYOUT');
    expect(payoutMv).toBeDefined();
    expect(payoutMv?.signedAmount).toBe(-30000);
    expect(payoutMv?.transactionDate).toBe('2026-03-01');

    const advanceMv = cashMvs.find((m) => m.type === 'SUPPLIER_ADVANCE_GIVEN');
    expect(advanceMv).toBeDefined();
    expect(advanceMv?.signedAmount).toBe(-10000);
    expect(advanceMv?.transactionDate).toBe('2026-03-01');

    // 5. Test computeDailySummary utility
    const allTxs = await db.transactions.toArray();
    const allProds = await db.products.toArray();
    const summary = computeDailySummary('2026-03-01', allTxs, allProds);
    expect(summary.totalCashPaid).toBe(30000);
    expect(summary.totalNewAdvanceGiven).toBe(10000);
    expect(summary.totalAdvanceDeducted).toBe(20000);
    expect(summary.totalGoodsCount).toBe(10);

    // 6. Test Daily Cash Closing on 2026-03-01
    // Total cash out = 30000 + 10000 = 40000
    // Opening cash = 100,000
    // Expected closing = 100000 - 40000 = 60000
    const closing = await recordDailyClosingAtomic({
      closingDate: '2026-03-01',
      openingCash: 100000,
      actualCountedCash: 60000,
      notes: 'စာရင်းမှန်ကန်ပါသည်',
      closedBy: 'ဦးစိန်မျိုးလွင်',
    });

    expect(closing.totalCashOut).toBe(40000);
    expect(closing.expectedClosingCash).toBe(60000);
    expect(closing.actualCountedCash).toBe(60000);
    expect(closing.difference).toBe(0);
    expect(closing.breakdown.supplierCashPayout).toBe(30000);
    expect(closing.breakdown.supplierAdvanceCash).toBe(10000);
  });

  it('correctly uses business initialization opening cash float when no prior day closing exists', async () => {
    // Seed business initialization setting
    await db.settings.put({
      key: 'businessInitialization',
      value: {
        openingPosition: {
          cash: {
            cashAmount: 250000,
          },
        },
      },
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const openingCash = await getPreviousClosingCash('2026-03-05');
    expect(openingCash).toBe(250000);
  });

  it('does not double count OPENING_FLOAT in cash movements as daily operational cash-in', () => {
    const movements: any[] = [
      {
        id: 'c1',
        amount: 500000,
        signedAmount: 500000,
        direction: 'IN',
        type: 'OPENING_FLOAT',
        transactionDate: '2026-03-01',
        status: 'COMPLETED',
      },
      {
        id: 'c2',
        amount: 20000,
        signedAmount: 20000,
        direction: 'IN',
        type: 'SALE_PAYMENT_IN',
        transactionDate: '2026-03-01',
        status: 'COMPLETED',
      },
    ];

    const dailySummary = calculateDailyCashSummary('2026-03-01', movements, 500000);
    // Operational cash in should ONLY be 20,000, NOT 520,000
    expect(dailySummary.totalCashIn).toBe(20000);
    expect(dailySummary.openingCash).toBe(500000);
    expect(dailySummary.expectedClosingCash).toBe(520000);
  });

  it('reverses both cash payout and advance taken when cancelling inbound transaction', async () => {
    const supplier: Supplier = {
      id: 'sup_test_2',
      code: 'S-002',
      name: 'ဒေါ်အေး',
      phone: '097654321',
      village: 'တောင်ဘီ',
      currentAdvanceBalance: 10000,
      totalGoodsValueDelivered: 0,
      totalAdvanceGiven: 10000,
      active: true,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    await db.suppliers.put(supplier);

    const product: Product = {
      id: 'prod_test_2',
      name: 'ပန်းခြင်း',
      category: 'ကုန်ချော',
      unit: 'လုံး',
      defaultPrice: 4000,
      currentStock: 5,
      openingStock: 5,
      minStockAlert: 2,
      active: true,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    await db.products.put(product);

    const tx = await txRepo.saveInboundAtomic({
      id: 'tx_test_2',
      voucherNo: 'TX-002',
      supplierId: 'sup_test_2',
      supplierName: 'ဒေါ်အေး',
      date: '2026-03-02',
      time: '14:00',
      totalGoodsValue: 20000,
      advanceDeducted: 10000,
      newAdvanceTaken: 5000,
      cashPaidToSupplier: 10000,
      remainingAdvanceBalance: 5000,
      items: [
        {
          productId: 'prod_test_2',
          productName: 'ပန်းခြင်း',
          quantity: 5,
          unit: 'လုံး',
          unitPrice: 4000,
          subtotal: 20000,
        },
      ],
    });

    // Now cancel the transaction
    await txRepo.cancelInboundAtomic(tx.id, 'မှားယွင်းသွင်းမိ၍');

    // Verify cancellation cash reversals
    const reversalMvs = await db.cashMovements
      .where('referenceId')
      .equals(tx.id)
      .filter((m) => m.reversalOf === tx.id)
      .toArray();

    // Reversal for payout (10,000 IN) and reversal for advance (5,000 IN)
    expect(reversalMvs.length).toBe(2);
    const payoutRev = reversalMvs.find((m) => m.idempotencyKey.includes('PAYOUT_REV'));
    expect(payoutRev?.signedAmount).toBe(10000);

    const advRev = reversalMvs.find((m) => m.idempotencyKey.includes('ADV_REV'));
    expect(advRev?.signedAmount).toBe(5000);
  });
});
