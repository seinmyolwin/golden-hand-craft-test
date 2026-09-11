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
import { Merchant, Supplier, SaleRecord, TransactionRecord, ReturnRecord, CashMovementRecord } from '../types';
import {
  reconcileMerchantBalancePure,
} from '../services/reconciliation/merchantReconciliationService';
import {
  reconcileSupplierBalancePure,
} from '../services/reconciliation/supplierReconciliationService';

describe('Phase 18 - Merchant & Supplier Balance Reconciliation', () => {
  beforeEach(async () => {
    await db.merchants.clear();
    await db.suppliers.clear();
    await db.sales.clear();
    await db.transactions.clear();
    await db.returnsAndRefunds.clear();
    await db.cashMovements.clear();
  });

  it('correctly reconciles a matching merchant receivable balance', () => {
    const merchant: Merchant = {
      id: 'merch_01',
      name: 'ရွှေစင် ကုန်သည်ကြီး',
      town: 'ရန်ကုန်',
      phone: '091234567',
      receivableBalance: 100000,
      currentReceivableBalance: 250000, // 100,000 (open) + (300,000 - 100,000) (credit sale) - 50,000 (debt col) = 250,000
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };

    const sales: SaleRecord[] = [
      {
        id: 'sale_1',
        voucherNo: 'SALE-001',
        merchantId: 'merch_01',
        merchantName: 'ရွှေစင် ကုန်သည်ကြီး',
        merchantTown: 'ရန်ကုန်',
        date: '2026-03-01',
        time: '10:00',
        grandTotal: 300000,
        paidAmount: 100000,
        remainingReceivableBalance: 200000,
        status: 'COMPLETED',
        items: [],
      },
    ];

    const returns: ReturnRecord[] = [];

    const cashMovements: CashMovementRecord[] = [
      {
        id: 'c_debt_1',
        type: 'MERCHANT_DEBT_COLLECTION_IN',
        referenceType: 'MERCHANT_PAYMENT',
        referenceId: 'merch_01',
        counterpartName: 'ရွှေစင် ကုန်သည်ကြီး',
        amount: 50000,
        signedAmount: 50000,
        direction: 'IN',
        description: 'Merchant Debt Collection',
        status: 'COMPLETED',
        transactionDate: '2026-03-02',
        createdAt: '2026-03-02T10:00:00Z',
        idempotencyKey: 'c_debt_1_key',
        schemaVersion: 1,
      },
    ];

    const result = reconcileMerchantBalancePure(merchant, sales, returns, cashMovements);

    expect(result.status).toBe('MATCH');
    expect(result.expectedReceivableBalance).toBe(250000);
    expect(result.actualReceivableBalance).toBe(250000);
    expect(result.difference).toBe(0);
    expect(result.totalSalesValue).toBe(300000);
    expect(result.totalCashPaid).toBe(100000);
    expect(result.totalCreditSales).toBe(200000);
    expect(result.totalDebtCollections).toBe(50000);
  });

  it('detects merchant receivable discrepancies when balance is out of sync', () => {
    const merchant: Merchant = {
      id: 'merch_02',
      name: 'ရတနာ ကုန်စည်',
      town: 'မန္တလေး',
      phone: '091234567',
      receivableBalance: 0,
      currentReceivableBalance: 50000, // Should be 100,000
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };

    const sales: SaleRecord[] = [
      {
        id: 'sale_2',
        voucherNo: 'SALE-002',
        merchantId: 'merch_02',
        merchantName: 'ရတနာ ကုန်စည်',
        merchantTown: 'မန္တလေး',
        date: '2026-03-01',
        time: '11:00',
        grandTotal: 100000,
        paidAmount: 0,
        status: 'COMPLETED',
        items: [],
      },
    ];

    const result = reconcileMerchantBalancePure(merchant, sales, [], []);

    expect(result.status).toBe('MISMATCH');
    expect(result.expectedReceivableBalance).toBe(100000);
    expect(result.actualReceivableBalance).toBe(50000);
    expect(result.difference).toBe(-50000);
  });

  it('correctly reconciles a matching supplier advance balance', () => {
    const supplier: Supplier = {
      id: 'supp_01',
      name: 'ဦးလှ ပန်းထိမ်',
      phone: '0912345678',
      village: 'တောင်ရွာ',
      initialAdvance: 500000,
      advanceBalance: 500000,
      currentAdvanceBalance: 400000, // 500,000 (open) + 200,000 (adv given) - 300,000 (adv deducted) = 400,000
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };

    const transactions: TransactionRecord[] = [
      {
        id: 'tx_1',
        voucherNo: 'TX-001',
        supplierId: 'supp_01',
        supplierName: 'ဦးလှ ပန်းထိမ်',
        date: '2026-03-01',
        time: '12:00',
        type: 'COLLECTION_AND_PAYMENT',
        totalGoodsValue: 500000,
        advanceDeducted: 300000,
        newAdvanceTaken: 200000,
        cashPaidToSupplier: 200000,
        remainingAdvanceBalance: 400000,
        status: 'COMPLETED',
        items: [],
      },
    ];

    const result = reconcileSupplierBalancePure(supplier, transactions, []);

    expect(result.status).toBe('MATCH');
    expect(result.expectedAdvanceBalance).toBe(400000);
    expect(result.actualAdvanceBalance).toBe(400000);
    expect(result.difference).toBe(0);
    expect(result.totalAdvancesGiven).toBe(200000);
    expect(result.totalAdvancesDeducted).toBe(300000);
  });

  it('detects supplier advance discrepancies when advance balance is out of sync', () => {
    const supplier: Supplier = {
      id: 'supp_02',
      name: 'ဒေါ်အေး ပန်းထိမ်',
      phone: '0987654321',
      village: 'မြောက်ရွာ',
      initialAdvance: 200000,
      advanceBalance: 200000,
      currentAdvanceBalance: 100000, // Should be 200,000 - 50,000 = 150,000
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };

    const transactions: TransactionRecord[] = [
      {
        id: 'tx_2',
        voucherNo: 'TX-002',
        supplierId: 'supp_02',
        supplierName: 'ဒေါ်အေး ပန်းထိမ်',
        date: '2026-03-01',
        time: '14:00',
        type: 'COLLECTION_AND_PAYMENT',
        totalGoodsValue: 100000,
        advanceDeducted: 50000,
        newAdvanceTaken: 0,
        status: 'COMPLETED',
        items: [],
      },
    ];

    const result = reconcileSupplierBalancePure(supplier, transactions, []);

    expect(result.status).toBe('MISMATCH');
    expect(result.expectedAdvanceBalance).toBe(150000);
    expect(result.actualAdvanceBalance).toBe(100000);
    expect(result.difference).toBe(-50000);
  });
});
