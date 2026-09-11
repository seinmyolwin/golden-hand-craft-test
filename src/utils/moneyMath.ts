/**
 * Deterministic Financial Arithmetic Module for Myanmar Kyat (MMK) and Multi-currency Accounting
 * Avoids unsafe floating point math by using deterministic rounding, epsilon tolerances, and safe arithmetic.
 */

export const MONEY_EPSILON = 0.0000001;

/**
 * Rounds a number to a fixed decimal precision deterministically (eliminating 0.1 + 0.2 floating point inaccuracies).
 */
export function roundToPrecision(amount: number | string | undefined | null, decimals: number = 2): number {
  if (amount === undefined || amount === null || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || !isFinite(num)) return 0;
  const factor = Math.pow(10, decimals);
  // Using Number.EPSILON ensures half-up rounding behaves consistently across JavaScript engines
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Converts value to safe integer Myanmar Kyat (MMK default).
 */
export function toSafeIntMoney(amount: number | string | undefined | null): number {
  if (amount === undefined || amount === null || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num);
}

/**
 * Deterministic addition of multiple monetary amounts.
 */
export function moneyAdd(...amounts: (number | string | undefined | null)[]): number {
  return amounts.reduce<number>((sum, cur) => sum + toSafeIntMoney(cur), 0);
}

/**
 * Deterministic subtraction of monetary amounts (a - b).
 */
export function moneySub(a: number | string | undefined | null, b: number | string | undefined | null): number {
  return toSafeIntMoney(toSafeIntMoney(a) - toSafeIntMoney(b));
}

/**
 * Deterministic multiplication of quantity and unit price.
 */
export function moneyMul(qty: number | string | undefined | null, unitPrice: number | string | undefined | null): number {
  const q = typeof qty === 'number' ? qty : parseFloat(String(qty || 0));
  const safeQty = isNaN(q) || !isFinite(q) ? 0 : q;
  const safePrice = toSafeIntMoney(unitPrice);
  return Math.round(safeQty * safePrice);
}

/**
 * Deterministic division with rounding.
 */
export function moneyDiv(total: number | string | undefined | null, divisor: number | string | undefined | null, decimals: number = 0): number {
  const t = toSafeIntMoney(total);
  const d = typeof divisor === 'number' ? divisor : parseFloat(String(divisor || 0));
  if (isNaN(d) || !isFinite(d) || d === 0) return 0;
  if (decimals === 0) {
    return Math.round(t / d);
  }
  return roundToPrecision(t / d, decimals);
}

/**
 * Calculates a percentage of a base amount deterministically.
 */
export function calcPercentage(baseAmount: number | string, percentage: number | string): number {
  const base = toSafeIntMoney(baseAmount);
  const pct = typeof percentage === 'number' ? percentage : parseFloat(String(percentage || 0));
  if (isNaN(pct) || !isFinite(pct) || pct <= 0) return 0;
  return Math.round((base * pct) / 100);
}

/**
 * Calculates discount and net amount.
 */
export function calcDiscount(
  baseAmount: number | string,
  discountValue: number | string,
  isPercent: boolean = false
): { discountAmount: number; finalAmount: number } {
  const base = toSafeIntMoney(baseAmount);
  let discountAmount = 0;
  if (isPercent) {
    discountAmount = calcPercentage(base, discountValue);
  } else {
    discountAmount = toSafeIntMoney(discountValue);
  }
  discountAmount = Math.min(base, Math.max(0, discountAmount));
  const finalAmount = Math.max(0, moneySub(base, discountAmount));
  return { discountAmount, finalAmount };
}

/**
 * Calculates subtotal for an array of items with optional line discounts.
 */
export function moneyCalcTotal(items: { quantity: number; unitPrice: number; discount?: number }[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const lineTotal = moneyMul(item.quantity || 0, item.unitPrice || 0) - toSafeIntMoney(item.discount || 0);
    return moneyAdd(sum, Math.max(0, lineTotal));
  }, 0);
}

/**
 * Calculates remaining receivable balance:
 * (previousBalance + totalAmount) - paidAmount
 */
export function calcRemainingBalance(
  totalAmount: number | string,
  paidAmount: number | string,
  previousBalance: number | string = 0
): number {
  const gross = moneyAdd(previousBalance, totalAmount);
  return moneySub(gross, paidAmount);
}

/**
 * Compares two monetary amounts with floating point tolerance.
 * Returns 0 if equal within tolerance, 1 if a > b, -1 if a < b.
 */
export function compareMoney(a: number | string, b: number | string, epsilon: number = MONEY_EPSILON): number {
  const diff = toSafeIntMoney(a) - toSafeIntMoney(b);
  if (Math.abs(diff) < epsilon) return 0;
  return diff > 0 ? 1 : -1;
}

/**
 * Checks if two monetary amounts are equal within safe tolerance.
 */
export function areMoneyEqual(a: number | string, b: number | string, epsilon: number = MONEY_EPSILON): boolean {
  return compareMoney(a, b, epsilon) === 0;
}

/**
 * Checks if amount is zero within safe tolerance.
 */
export function isZeroMoney(amount: number | string, epsilon: number = MONEY_EPSILON): boolean {
  return Math.abs(toSafeIntMoney(amount)) < epsilon;
}

/**
 * Checks if amount is positive.
 */
export function isPositiveMoney(amount: number | string): boolean {
  return toSafeIntMoney(amount) > 0;
}

/**
 * Splits a total amount into N integer parts safely without losing any rounding remainder (penny/kyat allocation).
 */
export function splitMoneySafely(total: number | string, partsCount: number): number[] {
  const t = toSafeIntMoney(total);
  if (partsCount <= 0) return [];
  if (partsCount === 1) return [t];

  const basePart = Math.floor(t / partsCount);
  let remainder = t - basePart * partsCount;

  const result: number[] = [];
  for (let i = 0; i < partsCount; i++) {
    const part = basePart + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    result.push(part);
  }
  return result;
}

/**
 * Formats monetary amount to locale string.
 */
export function moneyFormat(amount: number | string): string {
  return toSafeIntMoney(amount).toLocaleString('en-US');
}

