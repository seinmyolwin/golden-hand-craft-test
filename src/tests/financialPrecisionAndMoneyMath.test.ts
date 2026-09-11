import { describe, it, expect } from 'vitest';
import {
  toSafeIntMoney,
  moneyAdd,
  moneySub,
  moneyMul,
  moneyDiv,
  roundToPrecision,
  calcPercentage,
  calcDiscount,
  calcRemainingBalance,
  splitMoneySafely,
  compareMoney,
  areMoneyEqual,
  isZeroMoney,
  isPositiveMoney,
  moneyFormat,
} from '../utils/moneyMath';

describe('Phase 18 - Financial Precision & Deterministic Money Math', () => {
  it('correctly handles integer conversion and eliminates floating point drift', () => {
    // 0.1 + 0.2 in JS float is 0.30000000000000004
    expect(roundToPrecision(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundToPrecision(10.005, 2)).toBe(10.01);
    expect(toSafeIntMoney(1500.49)).toBe(1500);
    expect(toSafeIntMoney(1500.51)).toBe(1501);
    expect(toSafeIntMoney('250000')).toBe(250000);
    expect(toSafeIntMoney(null)).toBe(0);
    expect(toSafeIntMoney(undefined)).toBe(0);
  });

  it('performs deterministic addition and subtraction', () => {
    expect(moneyAdd(10000, 25000, 5000)).toBe(40000);
    expect(moneySub(50000, 15000)).toBe(35000);
    expect(moneySub(10000, 15000)).toBe(-5000);
  });

  it('performs multiplication and division with exact rounding', () => {
    expect(moneyMul(3.5, 2000)).toBe(7000);
    expect(moneyMul(10, 12500)).toBe(125000);
    expect(moneyDiv(10000, 3)).toBe(3333);
    expect(moneyDiv(10000, 3, 2)).toBe(3333.33);
    expect(moneyDiv(10000, 0)).toBe(0);
  });

  it('calculates percentages and discounts deterministically', () => {
    expect(calcPercentage(100000, 5)).toBe(5000); // 5% of 100,000 = 5,000
    expect(calcPercentage(150000, 7.5)).toBe(11250);

    const fixedDiscount = calcDiscount(50000, 5000, false);
    expect(fixedDiscount.discountAmount).toBe(5000);
    expect(fixedDiscount.finalAmount).toBe(45000);

    const percentDiscount = calcDiscount(200000, 10, true);
    expect(percentDiscount.discountAmount).toBe(20000);
    expect(percentDiscount.finalAmount).toBe(180000);
  });

  it('calculates remaining receivable balance with previous balance', () => {
    // Previous balance: 50,000, New Sale: 100,000, Paid: 30,000 -> Remaining: 120,000
    expect(calcRemainingBalance(100000, 30000, 50000)).toBe(120000);
    expect(calcRemainingBalance(50000, 50000, 0)).toBe(0);
  });

  it('compares money amounts with safe epsilon tolerances', () => {
    expect(areMoneyEqual(1000, 1000)).toBe(true);
    expect(areMoneyEqual(1000, 1000.00000001)).toBe(true);
    expect(areMoneyEqual(1000, 1001)).toBe(false);

    expect(compareMoney(5000, 3000)).toBe(1);
    expect(compareMoney(2000, 4000)).toBe(-1);
    expect(compareMoney(5000, 5000)).toBe(0);

    expect(isZeroMoney(0)).toBe(true);
    expect(isZeroMoney(0.000000001)).toBe(true);
    expect(isPositiveMoney(100)).toBe(true);
    expect(isPositiveMoney(-50)).toBe(false);
  });

  it('splits total money across parts without losing penny remainders', () => {
    // 100 Kyats split into 3 parts: should sum exactly to 100 (34, 33, 33)
    const parts3 = splitMoneySafely(100, 3);
    expect(parts3).toEqual([34, 33, 33]);
    expect(parts3.reduce((a, b) => a + b, 0)).toBe(100);

    // 1,000 Kyats split into 6 parts: 167 + 167 + 167 + 167 + 166 + 166 = 1000
    const parts6 = splitMoneySafely(1000, 6);
    expect(parts6.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts6).toEqual([167, 167, 167, 167, 166, 166]);
  });

  it('formats money consistently', () => {
    expect(moneyFormat(1250000)).toBe('1,250,000');
  });
});
