import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import {
  reconcileLedgerIntegrity,
  getCurrentFinancialPosition,
} from '../services/ledgerIntegrityService';
import {
  resetSessionForTesting,
  switchUserSession,
  DEFAULT_STAFF_USER,
  AuthorizationError,
} from '../services/authorizationService';
import {
  StockMovementRepository,
  CashMovementRepository,
} from '../repositories';
import {
  StockMovementRecord,
  CashMovementRecord,
  SaleRecord,
  Product,
  TransactionRecord,
} from '../types';

describe('Phase 18D — Ledger Integrity & Reconciliation Tests', () => {
  const stockRepo = new StockMovementRepository();
  const cashRepo = new CashMovementRepository();

  beforeEach(async () => {
    // Clear IndexedDB tables
    await Promise.all([
      db.stockMovements.clear(),
      db.cashMovements.clear(),
      db.sales.clear(),
      db.transactions.clear(),
      db.merchantPurchases.clear(),
      db.products.clear(),
      db.returnsAndRefunds.clear(),
      db.merchants.clear(),
      db.suppliers.clear(),
      db.stockAdjustments.clear(),
      db.peerTrades.clear(),
      db.settings.clear(),
      db.auditLogs.clear(),
    ]);

    // Set Owner active session by default
    await resetSessionForTesting('OWNER');
  });

  it('6a: Detects orphan movements with non-existent referenceId', async () => {
    const orphanStock: StockMovementRecord = {
      id: 'mv_orphan_1',
      productId: 'prod_1',
      productName: 'ဝါးခုံ',
      movementType: 'MERCHANT_OUTBOUND',
      quantity: 5,
      direction: 'OUT',
      signedQuantity: -5,
      referenceType: 'SALE',
      referenceId: 'sale_non_existent_999',
      referenceVoucherNo: 'SALE-FAKE-999',
      transactionDate: '2026-09-12',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      idempotencyKey: 'KEY_ORPHAN_STOCK_1',
      schemaVersion: 1,
    };
    await db.stockMovements.put(orphanStock);

    const orphanCash: CashMovementRecord = {
      id: 'csh_orphan_1',
      amount: 15000,
      direction: 'IN',
      signedAmount: 15000,
      type: 'SALE_PAYMENT_IN',
      referenceType: 'SALE',
      referenceId: 'sale_non_existent_888',
      referenceVoucherNo: 'SALE-FAKE-888',
      description: 'Test orphan cash',
      transactionDate: '2026-09-12',
      status: 'COMPLETED',
      idempotencyKey: 'KEY_ORPHAN_CASH_1',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    };
    await db.cashMovements.put(orphanCash);

    const report = await reconcileLedgerIntegrity();

    expect(report.orphanStockMovements.length).toBe(1);
    expect(report.orphanStockMovements[0].movement.referenceId).toBe('sale_non_existent_999');

    expect(report.orphanCashMovements.length).toBe(1);
    expect(report.orphanCashMovements[0].movement.referenceId).toBe('sale_non_existent_888');

    expect(report.summary.isClean).toBe(false);
    expect(report.summary.totalIssues).toBe(2);
  });

  it('6b: Detects duplicate movements with same idempotencyKey', async () => {
    const stock1: StockMovementRecord = {
      id: 'mv_dup_1',
      productId: 'prod_1',
      productName: 'ဝါးခုံ',
      movementType: 'STOCK_ADJUSTMENT_IN',
      quantity: 10,
      direction: 'IN',
      signedQuantity: 10,
      referenceType: 'MANUAL',
      referenceId: 'ref_1',
      transactionDate: '2026-09-12',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      idempotencyKey: 'KEY_DUPLICATE_STOCK',
      schemaVersion: 1,
    };
    const stock2: StockMovementRecord = { ...stock1, id: 'mv_dup_2' };

    await db.stockMovements.bulkPut([stock1, stock2]);

    const cash1: CashMovementRecord = {
      id: 'csh_dup_1',
      amount: 5000,
      direction: 'IN',
      signedAmount: 5000,
      type: 'INCOME_IN',
      referenceType: 'DIRECT',
      referenceId: 'csh_ref_1',
      description: 'Test duplicate cash',
      transactionDate: '2026-09-12',
      status: 'COMPLETED',
      idempotencyKey: 'KEY_DUPLICATE_CASH',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    };
    const cash2: CashMovementRecord = { ...cash1, id: 'csh_dup_2' };

    await db.cashMovements.bulkPut([cash1, cash2]);

    const report = await reconcileLedgerIntegrity();

    expect(report.duplicateStockMovements.length).toBeGreaterThanOrEqual(1);
    expect(report.duplicateStockMovements[0].key).toBe('KEY_DUPLICATE_STOCK');
    expect(report.duplicateCashMovements.length).toBeGreaterThanOrEqual(1);
    expect(report.duplicateCashMovements[0].key).toBe('KEY_DUPLICATE_CASH');
    expect(report.summary.isClean).toBe(false);
  });

  it('6c: getCurrentFinancialPosition() correctly matches manually computed expected totals', async () => {
    // Seed 2 products
    const p1: Product = {
      id: 'prod_a',
      name: 'ဝါးကုလားထိုင်',
      defaultPrice: 1000,
      unit: 'ထည်',
      category: 'FINISHED_GOODS',
      active: true,
    };
    const p2: Product = {
      id: 'prod_b',
      name: 'ကြိမ်စားပွဲ',
      defaultPrice: 2000,
      unit: 'လုံး',
      category: 'FINISHED_GOODS',
      active: true,
    };
    await db.products.bulkPut([p1, p2]);

    // Seed stock movements
    // Prod A: IN 50, OUT 10 => Net 40 * 1000 = 40,000 MMK
    // Prod B: IN 20, OUT 5  => Net 15 * 2000 = 30,000 MMK
    // Total stock qty = 55, total stock value = 70,000 MMK
    await db.stockMovements.bulkPut([
      {
        id: 'mv_1',
        productId: 'prod_a',
        productName: p1.name,
        movementType: 'SUPPLIER_INBOUND',
        quantity: 50,
        direction: 'IN',
        signedQuantity: 50,
        referenceType: 'OPENING',
        referenceId: 'op_1',
        unitPrice: 1000,
        transactionDate: '2026-09-12',
        status: 'COMPLETED',
        idempotencyKey: 'K1',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mv_2',
        productId: 'prod_a',
        productName: p1.name,
        movementType: 'MERCHANT_OUTBOUND',
        quantity: 10,
        direction: 'OUT',
        signedQuantity: -10,
        referenceType: 'SALE',
        referenceId: 'sale_1',
        unitPrice: 1000,
        transactionDate: '2026-09-12',
        status: 'COMPLETED',
        idempotencyKey: 'K2',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mv_3',
        productId: 'prod_b',
        productName: p2.name,
        movementType: 'SUPPLIER_INBOUND',
        quantity: 20,
        direction: 'IN',
        signedQuantity: 20,
        referenceType: 'OPENING',
        referenceId: 'op_2',
        unitPrice: 2000,
        transactionDate: '2026-09-12',
        status: 'COMPLETED',
        idempotencyKey: 'K3',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mv_4',
        productId: 'prod_b',
        productName: p2.name,
        movementType: 'MERCHANT_OUTBOUND',
        quantity: 5,
        direction: 'OUT',
        signedQuantity: -5,
        referenceType: 'SALE',
        referenceId: 'sale_1',
        unitPrice: 2000,
        transactionDate: '2026-09-12',
        status: 'COMPLETED',
        idempotencyKey: 'K4',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Seed cash movements
    // Cash IN: 100,000, Cash OUT: 30,000 => Net cash = 70,000 MMK
    await db.cashMovements.bulkPut([
      {
        id: 'c1',
        amount: 100000,
        direction: 'IN',
        signedAmount: 100000,
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_1',
        description: 'Sale payment cash in',
        transactionDate: '2026-09-12',
        status: 'COMPLETED',
        idempotencyKey: 'CK1',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'c2',
        amount: 30000,
        direction: 'OUT',
        signedAmount: -30000,
        type: 'SUPPLIER_PAYOUT',
        referenceType: 'TRANSACTION',
        referenceId: 'tx_1',
        description: 'Supplier payout cash out',
        transactionDate: '2026-09-12',
        status: 'COMPLETED',
        idempotencyKey: 'CK2',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Seed sale with receivable
    // Sale 1: Total = 50,000, Paid = 20,000 => Remaining Receivable = 30,000 MMK
    const saleRecord: SaleRecord = {
      id: 'sale_1',
      voucherNo: 'SALE-20260912-001',
      merchantId: 'm_1',
      merchantName: 'မန္တလေးယွန်းဆိုင်',
      merchantTown: 'မန္တလေး',
      date: '2026-09-12',
      time: '10:00',
      items: [],
      grandTotal: 50000,
      cashPaidByMerchant: 20000,
      status: 'COMPLETED',
    };
    await db.sales.put(saleRecord);

    // Seed supplier transaction with payable
    // Transaction 1: Total = 40,000, Paid = 10,000 => Remaining Payable = 30,000 MMK
    const txRecord: TransactionRecord = {
      id: 'tx_1',
      voucherNo: 'TX-20260912-001',
      supplierId: 'sup_1',
      supplierName: 'ဦးဘ',
      date: '2026-09-12',
      time: '11:00',
      items: [],
      totalAmount: 40000,
      paidAmount: 10000,
      status: 'COMPLETED',
    };
    await db.transactions.put(txRecord);

    const pos = await getCurrentFinancialPosition();

    expect(pos.totalStockQuantity).toBe(55);
    expect(pos.totalStockValue).toBe(70000);
    expect(pos.totalCashIn).toBe(100000);
    expect(pos.totalCashOut).toBe(30000);
    expect(pos.netCashBalance).toBe(70000);
    expect(pos.totalReceivables).toBe(30000);
    expect(pos.totalPayables).toBe(30000);
    // Net Position = cash (70,000) + stock (70,000) + receivables (30,000) - payables (30,000) = 140,000
    expect(pos.netFinancialPosition).toBe(140000);
  });

  it('6d: Ensures idempotency protection avoids duplicate movements on repeated execution', async () => {
    const stockMovementInput: StockMovementRecord = {
      id: 'mv_repeat_1',
      productId: 'prod_1',
      productName: 'ဝါးခုံ',
      movementType: 'STOCK_ADJUSTMENT_IN',
      quantity: 10,
      direction: 'IN',
      signedQuantity: 10,
      referenceType: 'MANUAL',
      referenceId: 'ref_100',
      transactionDate: '2026-09-12',
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
      idempotencyKey: 'UNIQUE_IDEMP_STOCK_KEY',
      schemaVersion: 1,
    };

    // First recording
    const res1 = await stockRepo.recordMovement(stockMovementInput);
    // Second recording with exact same idempotencyKey
    const res2 = await stockRepo.recordMovement(stockMovementInput);

    expect(res1).toBe(res2);

    const stockRecords = await db.stockMovements
      .where('idempotencyKey')
      .equals('UNIQUE_IDEMP_STOCK_KEY')
      .toArray();
    expect(stockRecords.length).toBe(1);

    const cashMovementInput: CashMovementRecord = {
      id: 'csh_repeat_1',
      amount: 25000,
      direction: 'IN',
      signedAmount: 25000,
      type: 'INCOME_IN',
      referenceType: 'DIRECT',
      referenceId: 'csh_ref_100',
      description: 'Repeat cash entry',
      transactionDate: '2026-09-12',
      status: 'COMPLETED',
      idempotencyKey: 'UNIQUE_IDEMP_CASH_KEY',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    };

    const c1 = await cashRepo.recordMovement(cashMovementInput);
    const c2 = await cashRepo.recordMovement(cashMovementInput);

    expect(c1).toBe(c2);

    const cashRecords = await db.cashMovements
      .where('idempotencyKey')
      .equals('UNIQUE_IDEMP_CASH_KEY')
      .toArray();
    expect(cashRecords.length).toBe(1);
  });

  it('6e: Detects cross-ledger mismatch when a Sale has paid cash but no corresponding cash movement', async () => {
    const saleWithCash: SaleRecord = {
      id: 'sale_mismatch_1',
      voucherNo: 'SALE-20260912-888',
      merchantId: 'm_1',
      merchantName: 'မန္တလေးယွန်းဆိုင်',
      merchantTown: 'မန္တလေး',
      date: '2026-09-12',
      time: '12:00',
      items: [],
      grandTotal: 100000,
      cashPaidByMerchant: 50000, // Cash paid 50,000 MMK
      status: 'COMPLETED',
    };
    await db.sales.put(saleWithCash);

    // Intentionally omit cash movement record

    const report = await reconcileLedgerIntegrity();

    expect(report.crossLedgerMismatches.length).toBe(1);
    expect(report.crossLedgerMismatches[0].documentType).toBe('SALE');
    expect(report.crossLedgerMismatches[0].documentId).toBe('sale_mismatch_1');
    expect(report.crossLedgerMismatches[0].issue).toBe('MISSING_CASH_MOVEMENT');
    expect(report.crossLedgerMismatches[0].expectedAmount).toBe(50000);
    expect(report.summary.isClean).toBe(false);
  });

  it('5: Enforces OWNER permission guard for reconciliation and financial position derivation', async () => {
    // Switch to Staff user (USER role)
    await switchUserSession(DEFAULT_STAFF_USER.id);

    await expect(reconcileLedgerIntegrity()).rejects.toThrow(AuthorizationError);
    await expect(getCurrentFinancialPosition()).rejects.toThrow(AuthorizationError);
  });
});
