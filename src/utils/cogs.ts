import { roundMMK } from './currency';

/**
 * Calculates weighted average cost per unit when new inventory arrives.
 * Formula: New Avg Cost = ((Current Stock * Current Avg Cost) + (Incoming Qty * Incoming Price)) / (Current Stock + Incoming Qty)
 * 
 * @param currentStock Current available stock quantity before incoming addition
 * @param currentAvgCost Current weighted average unit cost (or default cost price)
 * @param incomingQty Incoming inventory quantity
 * @param incomingPrice Unit price/cost of incoming inventory
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingPrice: number
): number {
  const qtyIn = Math.max(0, incomingQty || 0);
  const priceIn = Math.max(0, incomingPrice || 0);

  if (qtyIn <= 0) {
    return roundMMK(currentAvgCost || 0);
  }

  const stockBefore = Math.max(0, currentStock || 0);
  const costBefore = Math.max(0, currentAvgCost || 0);

  if (stockBefore <= 0 || costBefore <= 0) {
    return roundMMK(priceIn);
  }

  const totalValue = (stockBefore * costBefore) + (qtyIn * priceIn);
  const totalStock = stockBefore + qtyIn;

  if (totalStock <= 0) {
    return roundMMK(priceIn);
  }

  return roundMMK(totalValue / totalStock);
}
