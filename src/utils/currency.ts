/**
 * Shwe Let Yar - Myanmar Kyat (MMK) Currency & Financial Rounding Utilities
 * Phase 23 Implementation
 *
 * Myanmar Kyat has no practical sub-unit / cents / pyas in modern commerce.
 * All monetary amounts must be safe, rounded integer MMK values at write boundaries
 * to prevent floating-point drift from accumulating across thousands of transactions.
 *
 * NOTE: Stock quantities are NOT money and must remain exact numbers (do not apply roundMMK to quantity).
 */

import {
  toSafeIntMoney,
  moneyAdd,
  moneySub,
  moneyMul,
  moneyDiv,
  calcPercentage,
  calcDiscount,
  moneyCalcTotal,
  calcRemainingBalance,
  compareMoney,
  areMoneyEqual,
  isZeroMoney,
  isPositiveMoney,
  splitMoneySafely,
  moneyFormat,
} from './moneyMath';

/**
 * Rounds a monetary amount to an exact integer Myanmar Kyat (MMK).
 * Handles numbers, numeric strings, undefined, null, and NaN safely.
 */
export function roundMMK(amount: number | string | undefined | null): number {
  return toSafeIntMoney(amount);
}

/**
 * Validates whether a value is an exact integer MMK amount (no fractional decimals).
 */
export function isIntegerMMK(amount: number | string | undefined | null): boolean {
  if (amount === undefined || amount === null || amount === '') return false;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || !isFinite(num)) return false;
  return Math.floor(num) === num;
}

/**
 * Formats an MMK amount with comma thousand separators and optional suffix.
 */
export function formatMMK(amount: number | string | undefined | null, withSuffix: boolean = false): string {
  const rounded = roundMMK(amount);
  const formatted = rounded.toLocaleString('en-US');
  return withSuffix ? `${formatted} ကျပ်` : formatted;
}

/**
 * Formats an amount with comma thousand separators without any currency suffix.
 * Returns '0' if invalid or nullish.
 */
export function formatNumberOnly(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || (typeof amount === 'number' && isNaN(amount))) return '0';
  return moneyFormat(amount);
}

export {
  toSafeIntMoney,
  moneyAdd,
  moneySub,
  moneyMul,
  moneyDiv,
  calcPercentage,
  calcDiscount,
  moneyCalcTotal,
  calcRemainingBalance,
  compareMoney,
  areMoneyEqual,
  isZeroMoney,
  isPositiveMoney,
  splitMoneySafely,
  moneyFormat,
};
