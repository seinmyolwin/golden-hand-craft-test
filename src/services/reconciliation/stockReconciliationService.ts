/**
 * Shwe Let Yar - Stock Reconciliation Service
 * Phase 18 Implementation
 *
 * Independently verifies that Product currentStock strictly equals:
 *   Opening Stock
 *   + Valid Inbound Movements (Supplier inbounds, Merchant purchases, Peer borrow)
 *   + Valid Return In Movements (Sales returns)
 *   + Positive Stock Adjustments
 *   - Valid Outbound Movements (Merchant sales, Peer lend)
 *   - Valid Return Out Movements (Purchase returns)
 *   - Negative Stock Adjustments / Damage Loss
 *   ± Cancellation Reversals
 *
 * Strict read-only audit: DOES NOT mutate data.
 */

import { db, ShweLetYarDatabase } from '../../db/database';
import { Product, StockMovementRecord } from '../../types';
import {
  ProductStockReconciliation,
  StockReconciliationResult,
  StockReconciliationStatus,
  InvalidStockMovementDetail,
  ReconciliationOptions,
} from './types';
import { roundToPrecision } from '../../utils/moneyMath';

export const VALID_STOCK_INBOUND_TYPES = new Set([
  'SUPPLIER_INBOUND',
  'SUPPLIER_COLLECTION',
  'PURCHASE_INBOUND',
  'MERCHANT_PURCHASE',
  'PEER_BORROW_IN',
]);

export const VALID_STOCK_RETURN_IN_TYPES = new Set([
  'SALES_RETURN_INBOUND',
  'SALES_RETURN_IN',
  'RETURN_INBOUND',
  'PURCHASE_RETURN_RESTOCK',
  'RETURN_RESTOCK',
]);

export const VALID_STOCK_POS_ADJUSTMENT_TYPES = new Set([
  'STOCK_ADJUSTMENT_IN',
  'INITIAL_STOCK',
  'PEER_RETURN_IN',
  'FOUND_ITEM',
]);

export const VALID_STOCK_OUTBOUND_TYPES = new Set([
  'MERCHANT_OUTBOUND',
  'MERCHANT_SALE',
  'SALE',
  'PEER_LEND_OUT',
]);

export const VALID_STOCK_RETURN_OUT_TYPES = new Set([
  'PURCHASE_RETURN_OUT',
  'RETURN_OUTBOUND',
  'DEFECTIVE_RETURN_OUT',
  'SUPPLIER_RETURN_OUT',
]);

export const VALID_STOCK_NEG_ADJUSTMENT_TYPES = new Set([
  'STOCK_ADJUSTMENT_OUT',
  'DAMAGE_LOSS',
  'PEER_RETURN_OUT',
  'EXPIRED_DISCARD',
]);

export const VALID_STOCK_REVERSAL_TYPES = new Set([
  'TRANSACTION_CANCELLED_REVERSAL',
  'SALE_CANCELLED_REVERSAL',
  'PURCHASE_CANCELLED_REVERSAL',
  'REVERSAL',
]);

/**
 * Pure function to reconcile a single product's movements without side effects.
 */
export function reconcileProductStockPure(
  product: Product,
  movements: StockMovementRecord[],
  options?: ReconciliationOptions
): ProductStockReconciliation {
  const invalidMovements: InvalidStockMovementDetail[] = [];
  const issues: string[] = [];

  let movementsIn = 0;
  let returnsIn = 0;
  let posAdjustments = 0;
  let movementsOut = 0;
  let returnsOut = 0;
  let negAdjustments = 0;
  let reversals = 0;

  const relevantMovements = movements.filter((m) => {
    if (m.productId !== product.id) return false;
    if (m.status === 'CANCELLED' || m.status === 'REVERSED') return false;
    if (options?.startDate && m.transactionDate && m.transactionDate < options.startDate) return false;
    if (options?.endDate && m.transactionDate && m.transactionDate > options.endDate) return false;
    return true;
  });

  for (const m of relevantMovements) {
    const qty = typeof m.quantity === 'number' ? m.quantity : parseFloat(String(m.quantity || 0));

    if (isNaN(qty) || !isFinite(qty) || qty <= 0) {
      invalidMovements.push({
        movementId: m.id,
        productId: product.id,
        reason: `Invalid non-positive quantity: ${m.quantity}`,
        movementType: m.movementType,
        quantity: m.quantity,
      });
      continue;
    }

    const type = m.movementType;

    if (VALID_STOCK_INBOUND_TYPES.has(type)) {
      movementsIn += qty;
    } else if (VALID_STOCK_RETURN_IN_TYPES.has(type)) {
      returnsIn += qty;
    } else if (VALID_STOCK_POS_ADJUSTMENT_TYPES.has(type)) {
      posAdjustments += qty;
    } else if (VALID_STOCK_OUTBOUND_TYPES.has(type)) {
      movementsOut += qty;
    } else if (VALID_STOCK_RETURN_OUT_TYPES.has(type)) {
      returnsOut += qty;
    } else if (VALID_STOCK_NEG_ADJUSTMENT_TYPES.has(type)) {
      negAdjustments += qty;
    } else if (VALID_STOCK_REVERSAL_TYPES.has(type)) {
      const signed = m.signedQuantity !== undefined ? m.signedQuantity : (m.direction === 'IN' ? qty : -qty);
      reversals += signed;
    } else {
      // Fallback based on movement direction
      if (m.direction === 'IN') {
        movementsIn += qty;
      } else if (m.direction === 'OUT') {
        movementsOut += qty;
      } else {
        invalidMovements.push({
          movementId: m.id,
          productId: product.id,
          reason: `Unknown movement type '${type}' and unspecified direction`,
          movementType: type,
          quantity: qty,
        });
      }
    }
  }

  const openingStock = roundToPrecision(product.openingStock ?? 0);
  const actualStock = roundToPrecision(product.currentStock ?? product.openingStock ?? 0);

  // Expected Stock Formula
  const expectedStock = roundToPrecision(
    openingStock +
    movementsIn +
    returnsIn +
    posAdjustments -
    movementsOut -
    returnsOut -
    negAdjustments +
    reversals
  );

  const difference = roundToPrecision(actualStock - expectedStock);

  let status: StockReconciliationStatus = 'MATCH';
  if (invalidMovements.length > 0) {
    status = 'INVALID_MOVEMENT';
    issues.push(`${invalidMovements.length} invalid movement(s) detected.`);
  }

  if (Math.abs(difference) > 0.0001) {
    status = 'MISMATCH';
    issues.push(
      `Inventory mismatch: Current stock (${actualStock}) does not equal expected ledger stock (${expectedStock}). Difference: ${difference > 0 ? '+' : ''}${difference}`
    );
  }

  return {
    productId: product.id,
    productName: product.name,
    unit: product.unit || 'ခု',
    openingStock,
    validInboundMovements: roundToPrecision(movementsIn),
    validReturnInMovements: roundToPrecision(returnsIn),
    validPositiveAdjustments: roundToPrecision(posAdjustments),
    validOutboundMovements: roundToPrecision(movementsOut),
    validReturnOutMovements: roundToPrecision(returnsOut),
    validNegativeAdjustments: roundToPrecision(negAdjustments),
    validReversalMovements: roundToPrecision(reversals),
    expectedStock,
    actualStock,
    difference,
    status,
    movementsCount: relevantMovements.length,
    invalidMovements: invalidMovements.length > 0 ? invalidMovements : undefined,
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * Reconciles all products in the database against the immutable StockMovement ledger.
 */
export async function reconcileAllStock(
  targetDb: ShweLetYarDatabase = db,
  options?: ReconciliationOptions
): Promise<StockReconciliationResult> {
  const [products, stockMovements] = await Promise.all([
    targetDb.products.toArray(),
    targetDb.stockMovements.toArray(),
  ]);

  const productReconciliations = products.map((prod) =>
    reconcileProductStockPure(prod, stockMovements, options)
  );

  let matchedCount = 0;
  let mismatchedCount = 0;
  let invalidMovementsCount = 0;
  let totalExpected = 0;
  let totalActual = 0;

  for (const item of productReconciliations) {
    if (item.status === 'MATCH') {
      matchedCount++;
    } else {
      mismatchedCount++;
    }
    if (item.invalidMovements && item.invalidMovements.length > 0) {
      invalidMovementsCount += item.invalidMovements.length;
    }
    totalExpected += item.expectedStock;
    totalActual += item.actualStock;
  }

  const totalDiff = roundToPrecision(totalActual - totalExpected);

  return {
    totalProducts: products.length,
    matchedCount,
    mismatchedCount,
    invalidMovementsCount,
    products: productReconciliations,
    overallStockStatus: mismatchedCount === 0 && invalidMovementsCount === 0 ? 'MATCH' : 'MISMATCH',
    summary: {
      totalExpectedInventoryCount: roundToPrecision(totalExpected),
      totalActualInventoryCount: roundToPrecision(totalActual),
      totalDifference: totalDiff,
    },
  };
}
