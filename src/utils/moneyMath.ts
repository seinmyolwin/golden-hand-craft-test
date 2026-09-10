/**
 * Deterministic Financial Arithmetic Module for Myanmar Kyat (MMK)
 * Avoids unsafe floating point math by converting all financial inputs to exact integer Kyats.
 */

export function toSafeIntMoney(amount: number | string | undefined | null): number {
  if (amount === undefined || amount === null || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num);
}

export function moneyAdd(a: number | string, b: number | string): number {
  return toSafeIntMoney(toSafeIntMoney(a) + toSafeIntMoney(b));
}

export function moneySub(a: number | string, b: number | string): number {
  return toSafeIntMoney(toSafeIntMoney(a) - toSafeIntMoney(b));
}

export function moneyMul(qty: number, unitPrice: number): number {
  const safeQty = isNaN(qty) || !isFinite(qty) ? 0 : qty;
  const safePrice = toSafeIntMoney(unitPrice);
  return Math.round(safeQty * safePrice);
}

export function moneyCalcTotal(items: { quantity: number; unitPrice: number; discount?: number }[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const lineTotal = moneyMul(item.quantity || 0, item.unitPrice || 0) - toSafeIntMoney(item.discount || 0);
    return moneyAdd(sum, Math.max(0, lineTotal));
  }, 0);
}

export function moneyFormat(amount: number | string): string {
  return toSafeIntMoney(amount).toLocaleString('en-US');
}
