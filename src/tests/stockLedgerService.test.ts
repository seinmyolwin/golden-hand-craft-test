import { describe, it, expect } from 'vitest';
import {
  calculateProductStockLedger,
  calculateAllProductsStockLedgerSummaries,
  getMovementTypeLabel,
  StockMovementType,
} from '../services/stockLedgerService';
import {
  Product,
  TransactionRecord,
  SaleRecord,
  StockAdjustmentRecord,
  PeerTradeRecord,
  MerchantPurchaseRecord,
} from '../types';

describe('Stock Ledger Service - Phase 14', () => {
  const dummyProduct: Product = {
    id: 'prod-001',
    name: 'ယွန်း ကွမ်းအစ် (အလတ်)',
    category: 'ယွန်းထည်',
    unit: 'ထည်',
    defaultPrice: 15000,
    defaultWholesalePrice: 20000,
    openingStock: 10,
    currentStock: 10,
    minStockAlert: 5,
    active: true,
    createdAt: '2026-01-01T08:00:00Z',
  };

  it('calculates initial opening stock correctly', () => {
    const summary = calculateProductStockLedger(dummyProduct, [], [], [], [], []);
    expect(summary.openingBalance).toBe(10);
    expect(summary.calculatedClosingBalance).toBe(10);
    expect(summary.isBalanced).toBe(true);
    expect(summary.entries.length).toBe(1);
    expect(summary.entries[0].movementType).toBe('OPENING_BALANCE');
    expect(summary.entries[0].balanceAfter).toBe(10);
    expect(summary.currentStockCostValuation).toBe(10 * 15000);
    expect(summary.currentStockWholesaleValuation).toBe(10 * 20000);
  });

  it('accurately computes running balance with inflows, sales, purchases, and adjustments', () => {
    // 1. Supplier Collection: +25 units on 2026-01-05
    const transactions: TransactionRecord[] = [
      {
        id: 'tx-001',
        voucherNo: 'INB-001',
        date: '2026-01-05',
        time: '10:00',
        supplierId: 'sup-1',
        supplierName: 'ကိုအောင်',
        supplierVillage: 'ကူနီ',
        items: [
          {
            productId: 'prod-001',
            productName: dummyProduct.name,
            quantity: 25,
            unitPrice: 15000,
            subtotal: 375000,
            unit: 'ထည်',
          },
        ],
        rawMaterialDeductions: [],
        totalAmount: 375000,
        rawMaterialDeductionTotal: 0,
        netPayable: 375000,
        paidAmount: 375000,
        remainingAdvanceBalance: 0,
        createdAt: '2026-01-05T10:00:00Z',
      },
    ];

    // 2. Merchant Sale: -15 units on 2026-01-10
    const sales: SaleRecord[] = [
      {
        id: 'sale-001',
        voucherNo: 'SL-001',
        date: '2026-01-10',
        time: '14:30',
        merchantId: 'merch-1',
        merchantName: 'ဒေါ်ခင်စန်း',
        merchantTown: 'မန္တလေး',
        items: [
          {
            productId: 'prod-001',
            productName: dummyProduct.name,
            quantity: 15,
            unitPrice: 20000,
            subtotal: 300000,
            unit: 'ထည်',
          },
        ],
        totalAmount: 300000,
        paidAmount: 300000,
        remainingReceivable: 0,
        createdAt: '2026-01-10T14:30:00Z',
      },
    ];

    // 3. Peer Trade: -5 units lent to peer shop on 2026-01-12
    const peerTrades: PeerTradeRecord[] = [
      {
        id: 'pt-001',
        voucherNo: 'PT-001',
        date: '2026-01-12',
        time: '11:00',
        productId: 'prod-001',
        productName: dummyProduct.name,
        peerShopName: 'ရွှေမင်းသမီး',
        tradeType: 'LEND_OUT',
        quantity: 5,
        unit: 'ထည်',
        status: 'ACTIVE',
        notes: 'မိတ်ဖက်ဆိုင်သို့ ချေးငှားသည်',
        createdAt: '2026-01-12T11:00:00Z',
      },
    ];

    // 4. Damage adjustment: -2 units damaged on 2026-01-15
    const adjustments: StockAdjustmentRecord[] = [
      {
        id: 'adj-001',
        date: '2026-01-15',
        time: '16:00',
        productId: 'prod-001',
        productName: dummyProduct.name,
        type: 'DAMAGE',
        quantity: -2,
        previousStock: 15,
        newStock: 13,
        reason: 'သယ်ယူစဉ် ကွဲအက်ပျက်စီး',
        createdAt: '2026-01-15T16:00:00Z',
      },
    ];

    // Expected progression:
    // Initial: 10
    // + Inbound (25): 35
    // - Sale (15): 20
    // - Peer Lend (5): 15
    // - Damage (2): 13

    const productWithUpdatedStock: Product = {
      ...dummyProduct,
      currentStock: 13,
    };

    const summary = calculateProductStockLedger(
      productWithUpdatedStock,
      transactions,
      sales,
      adjustments,
      [],
      peerTrades
    );

    expect(summary.openingBalance).toBe(10);
    expect(summary.totalInflowQty).toBe(25);
    expect(summary.totalOutflowQty).toBe(15 + 5 + 2); // 22
    expect(summary.calculatedClosingBalance).toBe(13);
    expect(summary.recordedCurrentStock).toBe(13);
    expect(summary.isBalanced).toBe(true);
    expect(summary.discrepancy).toBe(0);

    // Verify chronological running balance
    // Because entries in summary.entries are ordered newest first:
    const newest = summary.entries[0];
    expect(newest.movementType).toBe('DAMAGE_LOSS');
    expect(newest.balanceAfter).toBe(13);

    const oldest = summary.entries[summary.entries.length - 1];
    expect(oldest.movementType).toBe('OPENING_BALANCE');
    expect(oldest.balanceAfter).toBe(10);
  });

  it('detects discrepancy if recorded currentStock does not match calculated ledger balance', () => {
    const productWithCorruptedStock: Product = {
      ...dummyProduct,
      openingStock: 10,
      currentStock: 50, // Arbitrary corrupted stock
    };

    const summary = calculateProductStockLedger(productWithCorruptedStock, [], [], [], [], []);
    expect(summary.calculatedClosingBalance).toBe(10);
    expect(summary.recordedCurrentStock).toBe(50);
    expect(summary.discrepancy).toBe(40);
    expect(summary.isBalanced).toBe(false);
  });

  it('ignores cancelled transactions and cancelled sales', () => {
    const cancelledTx: TransactionRecord = {
      id: 'tx-cancelled',
      voucherNo: 'INB-CANCELLED',
      date: '2026-01-05',
      time: '10:00',
      supplierId: 'sup-1',
      supplierName: 'ကိုအောင်',
      supplierVillage: 'ကူနီ',
      status: 'CANCELLED',
      items: [
        {
          productId: 'prod-001',
          productName: dummyProduct.name,
          quantity: 100,
          unitPrice: 15000,
          subtotal: 1500000,
          unit: 'ထည်',
        },
      ],
      rawMaterialDeductions: [],
      totalAmount: 1500000,
      rawMaterialDeductionTotal: 0,
      netPayable: 1500000,
      paidAmount: 1500000,
      remainingAdvanceBalance: 0,
      createdAt: '2026-01-05T10:00:00Z',
    };

    const cancelledSale: SaleRecord = {
      id: 'sale-cancelled',
      voucherNo: 'SL-CANCELLED',
      date: '2026-01-10',
      time: '14:30',
      merchantId: 'merch-1',
      merchantName: 'ဒေါ်ခင်စန်း',
      merchantTown: 'မန္တလေး',
      status: 'CANCELLED',
      items: [
        {
          productId: 'prod-001',
          productName: dummyProduct.name,
          quantity: 50,
          unitPrice: 20000,
          subtotal: 1000000,
          unit: 'ထည်',
        },
      ],
      totalAmount: 1000000,
      paidAmount: 1000000,
      remainingReceivable: 0,
      createdAt: '2026-01-10T14:30:00Z',
    };

    const summary = calculateProductStockLedger(
      dummyProduct,
      [cancelledTx],
      [cancelledSale],
      [],
      [],
      []
    );

    // Cancelled events should not change closing balance from opening 10
    expect(summary.calculatedClosingBalance).toBe(10);
    expect(summary.entries.length).toBe(1); // Only opening stock
  });

  it('filters by date range and movement type', () => {
    const transactions: TransactionRecord[] = [
      {
        id: 'tx-jan',
        voucherNo: 'INB-JAN',
        date: '2026-01-05',
        time: '10:00',
        supplierId: 'sup-1',
        supplierName: 'ကိုအောင်',
        supplierVillage: 'ကူနီ',
        items: [{ productId: 'prod-001', productName: dummyProduct.name, quantity: 10, unitPrice: 15000, subtotal: 150000, unit: 'ထည်' }],
        rawMaterialDeductions: [],
        totalAmount: 150000,
        rawMaterialDeductionTotal: 0,
        netPayable: 150000,
        paidAmount: 150000,
        remainingAdvanceBalance: 0,
        createdAt: '2026-01-05T10:00:00Z',
      },
      {
        id: 'tx-feb',
        voucherNo: 'INB-FEB',
        date: '2026-02-10',
        time: '10:00',
        supplierId: 'sup-1',
        supplierName: 'ကိုအောင်',
        supplierVillage: 'ကူနီ',
        items: [{ productId: 'prod-001', productName: dummyProduct.name, quantity: 20, unitPrice: 15000, subtotal: 300000, unit: 'ထည်' }],
        rawMaterialDeductions: [],
        totalAmount: 300000,
        rawMaterialDeductionTotal: 0,
        netPayable: 300000,
        paidAmount: 300000,
        remainingAdvanceBalance: 0,
        createdAt: '2026-02-10T10:00:00Z',
      },
    ];

    const filtered = calculateProductStockLedger(
      dummyProduct,
      transactions,
      [],
      [],
      [],
      [],
      { startDate: '2026-02-01', endDate: '2026-02-28' }
    );

    // Only tx-feb falls into February
    expect(filtered.entries.length).toBe(1);
    expect(filtered.entries[0].referenceVoucherNo).toBe('INB-FEB');
    // Note: total running balance still calculated correctly from all history
    expect(filtered.calculatedClosingBalance).toBe(40); // 10 open + 10 jan + 20 feb
  });

  it('provides comprehensive summary for all products', () => {
    const prod2: Product = {
      id: 'prod-002',
      name: 'ဝါးခမောက်',
      category: 'ဝါးထည်',
      unit: 'လုံး',
      defaultPrice: 3000,
      defaultWholesalePrice: 4000,
      openingStock: 50,
      currentStock: 50,
      minStockAlert: 10,
      active: true,
    };

    const summaries = calculateAllProductsStockLedgerSummaries([dummyProduct, prod2]);
    expect(summaries.length).toBe(2);
    expect(summaries[0].product.id).toBe('prod-001');
    expect(summaries[1].product.id).toBe('prod-002');
  });

  it('provides Myanmar label for every movement type', () => {
    const types: StockMovementType[] = [
      'OPENING_BALANCE',
      'SUPPLIER_INBOUND',
      'MERCHANT_OUTBOUND',
      'MERCHANT_PURCHASE_INBOUND',
      'PEER_BORROW_IN',
      'PEER_LEND_OUT',
      'PEER_RETURN_IN',
      'PEER_RETURN_OUT',
      'STOCK_ADJUSTMENT_IN',
      'STOCK_ADJUSTMENT_OUT',
      'DAMAGE_LOSS',
      'TRANSACTION_CANCELLED_REVERSAL',
      'SALE_CANCELLED_REVERSAL',
      'PURCHASE_CANCELLED_REVERSAL',
    ];

    types.forEach((t) => {
      const label = getMovementTypeLabel(t);
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
    });
  });
});
