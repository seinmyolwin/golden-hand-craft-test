import { describe, it, expect, beforeEach } from 'vitest';
import {
  roundMMK,
  formatMMK,
  moneyAdd,
  moneySub,
  moneyMul,
  moneyDiv,
  calcPercentage,
  calcDiscount,
  moneyCalcTotal,
  calcRemainingBalance,
  isIntegerMMK,
  toSafeIntMoney,
} from '../utils/currency';
import { db } from '../db/database';
import {
  processSalesReturnAtomic,
  processPurchaseReturnAtomic,
  cancelReturnAtomic,
} from '../services/returnsService';

describe('Phase 23: Currency & Rounding Integrity Audit Tests', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  describe('1. roundMMK and Core Primitives', () => {
    it('rounds floats to nearest integer MMK correctly', () => {
      expect(roundMMK(100.49)).toBe(100);
      expect(roundMMK(100.5)).toBe(101);
      expect(roundMMK(100.51)).toBe(101);
      expect(roundMMK(0)).toBe(0);
      expect(roundMMK(0.00001)).toBe(0);
      expect(roundMMK(999999999.9)).toBe(1000000000);
    });

    it('handles negative amounts correctly', () => {
      expect(roundMMK(-100.49)).toBe(-100);
      expect(roundMMK(-100.51)).toBe(-101);
      expect(roundMMK(-100.9)).toBe(-101);
    });

    it('guards against NaN, undefined, null, and Infinity', () => {
      expect(roundMMK(NaN)).toBe(0);
      expect(roundMMK(null as unknown as number)).toBe(0);
      expect(roundMMK(undefined as unknown as number)).toBe(0);
      expect(roundMMK(Infinity)).toBe(0);
      expect(roundMMK(-Infinity)).toBe(0);
    });

    it('isIntegerMMK correctly identifies whether numbers are clean integer MMK', () => {
      expect(isIntegerMMK(50000)).toBe(true);
      expect(isIntegerMMK(0)).toBe(true);
      expect(isIntegerMMK(50000.05)).toBe(false);
      expect(isIntegerMMK(NaN)).toBe(false);
    });

    it('formats MMK with Burmese/Latin locale correctly', () => {
      expect(formatMMK(1500000)).toBe('1,500,000');
      expect(formatMMK(1500000.75)).toBe('1,500,001');
      expect(formatMMK(250000, true)).toBe('250,000 ကျပ်');
    });
  });

  describe('2. Safe Arithmetic & Floating-Point Drift Elimination', () => {
    it('avoids standard JavaScript 0.1 + 0.2 float anomalies', () => {
      // Standard JS 0.1 + 0.2 === 0.30000000000000004
      const jsSum = 0.1 + 0.2;
      expect(jsSum).not.toBe(0.3);

      // Money arithmetic guarantees integer outputs
      expect(moneyAdd(100000, 200000)).toBe(300000);
      expect(moneySub(300000, 100000)).toBe(200000);
    });

    it('multiplies fractional quantities with integer prices cleanly', () => {
      // 3.333 units at 1,500 MMK each
      expect(moneyMul(3.333, 1500)).toBe(5000);

      // 1.5 units at 3,333 MMK each
      expect(moneyMul(1.5, 3333)).toBe(5000);
    });

    it('divides money into integer MMK cleanly without residue', () => {
      expect(moneyDiv(10000, 3)).toBe(3333);
      expect(moneyDiv(10000, 0)).toBe(0); // zero division guard
    });

    it('calculates percentages and discounts as integer MMK', () => {
      // 5% discount on 137,550 MMK = 6,877.5 MMK -> rounds to 6,878 MMK
      expect(calcPercentage(137550, 5)).toBe(6878);

      const discountResult = calcDiscount(137550, 5, true);
      expect(discountResult.discountAmount).toBe(6878);
      expect(discountResult.finalAmount).toBe(130672);
      expect(moneyAdd(discountResult.discountAmount, discountResult.finalAmount)).toBe(137550);
    });

    it('calculates remaining receivable balance with exact integer preservation', () => {
      // Previous Balance: 150,000, Grand Total: 275,350, Paid: 200,000 -> Remaining: 225,350
      expect(calcRemainingBalance(275350, 200000, 150000)).toBe(225350);
    });
  });

  describe('3. Cumulative Drift Stress Test (1,000 Transactions)', () => {
    it('preserves exact ledger integrity across 1,000 float-generating calculations', () => {
      let cumulativeBalance = 0;
      let sumOfLineTotals = 0;

      // Simulate 1,000 transactions with 3.33% service fees and fractional quantity multiplications
      for (let i = 1; i <= 1000; i++) {
        const qty = 1.25 + (i % 10) * 0.333; // e.g., 1.25, 1.583, 1.916...
        const unitPrice = 1250 + (i % 7) * 111;
        const lineTotal = moneyMul(qty, unitPrice);

        expect(Number.isInteger(lineTotal)).toBe(true);
        sumOfLineTotals = moneyAdd(sumOfLineTotals, lineTotal);

        const fee = calcPercentage(lineTotal, 3.33);
        expect(Number.isInteger(fee)).toBe(true);

        const net = moneySub(lineTotal, fee);
        expect(Number.isInteger(net)).toBe(true);

        cumulativeBalance = moneyAdd(cumulativeBalance, net);
      }

      expect(Number.isInteger(cumulativeBalance)).toBe(true);
      expect(Number.isInteger(sumOfLineTotals)).toBe(true);
      expect(isIntegerMMK(cumulativeBalance)).toBe(true);
    });
  });

  describe('4. Returns & Partial Refund Money Rounding', () => {
    it('executes atomic sales return with exact integer MMK refund and ledger posting', async () => {
      const now = new Date().toISOString();
      // Setup product, merchant, and original sale
      await db.products.put({
        id: 'prod_test_1',
        name: 'တောင်သူသုံး သကြား',
        category: 'ကုန်ချော',
        unit: 'အိတ်',
        defaultPrice: 70000,
        currentStock: 100,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      await db.merchants.put({
        id: 'merch_test_1',
        name: 'ကိုအောင်',
        town: 'မန္တလေး',
        phone: '0912345678',
        currentReceivableBalance: 150000,
        totalPurchasesValue: 150000,
        totalPaidAmount: 0,
        createdAt: now,
        updatedAt: now,
      });

      const saleId = 'sale_test_1';
      await db.sales.put({
        id: saleId,
        voucherNo: 'SALE-2026-001',
        merchantId: 'merch_test_1',
        merchantName: 'ကိုအောင်',
        date: '2026-09-14',
        time: '10:00',
        items: [
          {
            productId: 'prod_test_1',
            productName: 'တောင်သူသုံး သကြား',
            quantity: 2,
            unit: 'အိတ်',
            unitPrice: 75000,
            subtotal: 150000,
          },
        ],
        totalAmount: 150000,
        grandTotal: 150000,
        paidAmount: 50000,
        cashPaidByMerchant: 50000,
        remainingReceivableBalance: 100000,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      });

      // Process a partial return: 1 item returned (value 75,000 MMK, refund 25,000 MMK in cash, 50,000 deducted from receivable)
      const returnRecord = await processSalesReturnAtomic({
        saleId,
        items: [
          {
            productId: 'prod_test_1',
            quantity: 1,
            unitPrice: 75000,
            reason: 'ဖောက်သည်မှ ပို၍ ပြန်အပ်ခြင်း',
          },
        ],
        cashRefundAmount: 25000,
        refundPaymentMethod: 'CASH',
        reason: 'ဖောက်သည်မှ ပို၍ ပြန်အပ်ခြင်း',
        date: '2026-09-14',
        time: '11:00',
      });

      expect(returnRecord.id).toBeDefined();
      expect(isIntegerMMK(returnRecord.totalReturnAmount)).toBe(true);
      expect(isIntegerMMK(returnRecord.cashRefundAmount)).toBe(true);
      expect(isIntegerMMK(returnRecord.creditAdjustmentAmount)).toBe(true);
      expect(returnRecord.totalReturnAmount).toBe(75000);
      expect(returnRecord.cashRefundAmount).toBe(25000);
      expect(returnRecord.creditAdjustmentAmount).toBe(50000);

      // Verify updated merchant receivable balance
      const updatedMerchant = await db.merchants.get('merch_test_1');
      expect(updatedMerchant?.currentReceivableBalance).toBe(100000); // 150,000 - 50,000 = 100,000

      // Verify stock movement ledger
      const movements = await db.stockMovements.where('referenceId').equals(returnRecord.id).toArray();
      expect(movements.length).toBe(1);
      expect(movements[0].movementType).toBe('SALES_RETURN_INBOUND');
      expect(movements[0].quantity).toBe(1);
      expect(movements[0].totalValue).toBe(75000);
      expect(isIntegerMMK(movements[0].totalValue || 0)).toBe(true);

      // Verify cash movement ledger
      const cashMv = await db.cashMovements.where('referenceId').equals(returnRecord.id).first();
      expect(cashMv).toBeDefined();
      expect(cashMv?.amount).toBe(25000);
      expect(cashMv?.direction).toBe('OUT');
      expect(isIntegerMMK(cashMv?.amount || 0)).toBe(true);
    });
  });
});
