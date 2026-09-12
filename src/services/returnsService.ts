/**
 * Shwe Let Yar - Professional Returns, Refunds & Reversals Service
 * Phase 16 Implementation
 *
 * Provides atomic, offline-first processing for Sales Returns and Purchase Returns.
 * Features:
 * - Strict return quantity validation against original sold/purchased quantities
 * - Canonical integration with Stock Ledger and Cash Ledger
 * - Non-destructive compensating reversals (never hard deletes financial history)
 * - Deterministic idempotency protection
 * - Full audit trail logging
 */

import {
  ReturnRecord,
  ReturnItem,
  ReturnType,
  SaleRecord,
  MerchantPurchaseRecord,
  TransactionRecord,
  StockMovementRecord,
  CashMovementRecord,
  Product,
  Merchant,
  Supplier,
  AuditLogEntry,
} from '../types';
import { db } from '../db/database';
import { generateStableId } from '../utils/idGenerator';
import { DailyClosingLockedError } from '../repositories/errors';
import { enforcePermission } from './authorizationService';

export interface ProcessSalesReturnParams {
  saleId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice?: number;
    reason?: string;
  }[];
  cashRefundAmount: number;
  refundPaymentMethod?: string;
  reason?: string;
  notes?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  idempotencyKey?: string;
}

export interface ProcessPurchaseReturnParams {
  purchaseId: string;
  referenceType: 'PURCHASE' | 'TRANSACTION'; // MERCHANT_PURCHASE or SUPPLIER_TRANSACTION
  items: {
    productId: string;
    quantity: number;
    unitPrice?: number;
    reason?: string;
  }[];
  cashRecoveryAmount: number;
  refundPaymentMethod?: string;
  reason?: string;
  notes?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  idempotencyKey?: string;
}

/**
 * Gets map of previously returned quantities for a reference voucher
 */
export async function getPreviouslyReturnedQuantities(
  referenceId: string
): Promise<Record<string, number>> {
  const returns = await db.returnsAndRefunds
    .where('referenceId')
    .equals(referenceId)
    .and((r) => r.status === 'COMPLETED')
    .toArray();

  const returnedMap: Record<string, number> = {};

  for (const ret of returns) {
    for (const item of ret.items) {
      returnedMap[item.productId] = (returnedMap[item.productId] || 0) + item.quantity;
    }
  }

  return returnedMap;
}

export const getReturnedQuantitiesForVoucher = getPreviouslyReturnedQuantities;

/**
 * Validates a proposed sales return against original sale items and previous returns
 */
export async function validateSalesReturn(
  saleId: string,
  itemsToReturn: { productId: string; quantity: number; unitPrice?: number; reason?: string }[]
): Promise<{
  sale: SaleRecord;
  prevReturnedMap: Record<string, number>;
  validatedItems: ReturnItem[];
  totalReturnAmount: number;
}> {
  const sale = await db.sales.get(saleId);
  if (!sale) {
    throw new Error(`Sale record with ID ${saleId} not found.`);
  }
  if (sale.status === 'CANCELLED') {
    throw new Error(`Cannot process return for a cancelled sale voucher #${sale.voucherNo}.`);
  }

  const prevReturnedMap = await getPreviouslyReturnedQuantities(saleId);
  const validatedItems: ReturnItem[] = [];
  let totalReturnAmount = 0;

  for (const proposedItem of itemsToReturn) {
    if (proposedItem.quantity <= 0) continue;

    // Find original sale item
    const origItem = sale.items.find((i) => i.productId === proposedItem.productId);
    if (!origItem) {
      throw new Error(
        `Product ID ${proposedItem.productId} was not part of original sale voucher #${sale.voucherNo}.`
      );
    }

    const prevReturnedQty = prevReturnedMap[proposedItem.productId] || 0;
    const maxReturnableQty = origItem.quantity - prevReturnedQty;

    if (proposedItem.quantity > maxReturnableQty) {
      throw new Error(
        `Return quantity for ${origItem.productName} (${proposedItem.quantity}) exceeds maximum returnable quantity (${maxReturnableQty}).`
      );
    }

    const unitPrice =
      proposedItem.unitPrice ??
      origItem.unitPrice ??
      (origItem.quantity > 0 ? origItem.subtotal / origItem.quantity : 0);

    const totalAmount = proposedItem.quantity * unitPrice;

    validatedItems.push({
      productId: proposedItem.productId,
      productName: origItem.productName,
      unit: origItem.unit || 'ခု',
      quantity: proposedItem.quantity,
      unitPrice,
      totalAmount,
      reason: proposedItem.reason,
    });

    totalReturnAmount += totalAmount;
  }

  if (validatedItems.length === 0) {
    throw new Error('At least one item must have a valid return quantity greater than 0.');
  }

  return {
    sale,
    prevReturnedMap,
    validatedItems,
    totalReturnAmount,
  };
}

/**
 * Validates a proposed purchase return against original purchase items and previous returns
 */
export async function validatePurchaseReturn(
  purchaseId: string,
  referenceType: 'PURCHASE' | 'TRANSACTION',
  itemsToReturn: { productId: string; quantity: number; unitPrice?: number; reason?: string }[]
): Promise<{
  purchaseRecord?: MerchantPurchaseRecord;
  transactionRecord?: TransactionRecord;
  voucherNo: string;
  counterpartName: string;
  merchantId?: string;
  supplierId?: string;
  prevReturnedMap: Record<string, number>;
  validatedItems: ReturnItem[];
  totalReturnAmount: number;
}> {
  let voucherNo = '';
  let counterpartName = '';
  let merchantId: string | undefined;
  let supplierId: string | undefined;
  let purchaseRecord: MerchantPurchaseRecord | undefined;
  let transactionRecord: TransactionRecord | undefined;
  let originalItems: { productId: string; productName: string; quantity: number; unit?: string; unitPrice?: number; subtotal?: number }[] = [];

  if (referenceType === 'PURCHASE') {
    purchaseRecord = await db.merchantPurchases.get(purchaseId);
    if (!purchaseRecord) {
      throw new Error(`Merchant Purchase record with ID ${purchaseId} not found.`);
    }
    if (purchaseRecord.status === 'CANCELLED') {
      throw new Error(`Cannot process return for cancelled purchase #${purchaseRecord.purchaseNo}.`);
    }
    voucherNo = purchaseRecord.purchaseNo;
    counterpartName = purchaseRecord.merchantName;
    merchantId = purchaseRecord.merchantId;
    originalItems = purchaseRecord.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice ?? (i.quantity > 0 ? i.subtotal / i.quantity : 0),
    }));
  } else {
    transactionRecord = await db.transactions.get(purchaseId);
    if (!transactionRecord) {
      throw new Error(`Supplier transaction record with ID ${purchaseId} not found.`);
    }
    if (transactionRecord.status === 'CANCELLED') {
      throw new Error(`Cannot process return for cancelled transaction #${transactionRecord.voucherNo}.`);
    }
    voucherNo = transactionRecord.voucherNo;
    counterpartName = transactionRecord.supplierName;
    supplierId = transactionRecord.supplierId;
    originalItems = (transactionRecord.items || []).map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice ?? (i.quantity > 0 ? i.subtotal / i.quantity : 0),
    }));
  }

  const prevReturnedMap = await getPreviouslyReturnedQuantities(purchaseId);
  const validatedItems: ReturnItem[] = [];
  let totalReturnAmount = 0;

  for (const proposedItem of itemsToReturn) {
    if (proposedItem.quantity <= 0) continue;

    const origItem = originalItems.find((i) => i.productId === proposedItem.productId);
    if (!origItem) {
      throw new Error(
        `Product ID ${proposedItem.productId} was not part of original purchase #${voucherNo}.`
      );
    }

    const prevReturnedQty = prevReturnedMap[proposedItem.productId] || 0;
    const maxReturnableQty = origItem.quantity - prevReturnedQty;

    if (proposedItem.quantity > maxReturnableQty) {
      throw new Error(
        `Return quantity for ${origItem.productName} (${proposedItem.quantity}) exceeds maximum returnable quantity (${maxReturnableQty}).`
      );
    }

    const unitPrice = proposedItem.unitPrice ?? origItem.unitPrice ?? 0;
    const totalAmount = proposedItem.quantity * unitPrice;

    validatedItems.push({
      productId: proposedItem.productId,
      productName: origItem.productName,
      unit: origItem.unit || 'ခု',
      quantity: proposedItem.quantity,
      unitPrice,
      totalAmount,
      reason: proposedItem.reason,
    });

    totalReturnAmount += totalAmount;
  }

  if (validatedItems.length === 0) {
    throw new Error('At least one item must have a valid return quantity greater than 0.');
  }

  return {
    purchaseRecord,
    transactionRecord,
    voucherNo,
    counterpartName,
    merchantId,
    supplierId,
    prevReturnedMap,
    validatedItems,
    totalReturnAmount,
  };
}

/**
 * Processes a Sales Return atomically inside Dexie transaction
 */
export async function processSalesReturnAtomic(
  params: ProcessSalesReturnParams
): Promise<ReturnRecord> {
  await enforcePermission('PROCESS_RETURN_REFUND', 'အရောင်းကုန်ပစ္စည်း ပြန်သွင်းခြင်း/ငွေပြန်အမ်းခြင်း');
  const {
    saleId,
    items,
    cashRefundAmount = 0,
    refundPaymentMethod = 'CASH',
    reason = '',
    notes = '',
    date,
    time,
    idempotencyKey,
  } = params;

  const now = new Date();
  const txDate = date || now.toISOString().split('T')[0];
  const txTime = time || now.toTimeString().substring(0, 5);
  const key = idempotencyKey || `sret_${saleId}_${Date.now()}`;

  // Idempotency check before transaction
  const existingKey = await db.returnsAndRefunds.where('idempotencyKey').equals(key).first();
  if (existingKey) {
    return existingKey;
  }

  return await db.transaction(
    'rw',
    [
      db.sales,
      db.products,
      db.merchants,
      db.stockMovements,
      db.cashMovements,
      db.returnsAndRefunds,
      db.auditLogs,
      db.dailyClosings,
    ],
    async () => {
      const closing = await db.dailyClosings.get(`closing_${txDate}`);
      if (closing && closing.status === 'CLOSED') {
        throw new DailyClosingLockedError(txDate, 'အရောင်းပြန်သွင်းစာရင်း');
      }

      // Re-verify idempotency inside transaction lock
      const doubleCheck = await db.returnsAndRefunds.where('idempotencyKey').equals(key).first();
      if (doubleCheck) return doubleCheck;

      const { sale, validatedItems, totalReturnAmount } = await validateSalesReturn(
        saleId,
        items
      );

      const refundCash = Math.min(Math.max(0, cashRefundAmount), totalReturnAmount);
      const creditAdjustment = Math.max(0, totalReturnAmount - refundCash);

      const returnId = generateStableId('ret');
      const shortCode = returnId.substring(returnId.length - 4).toUpperCase();
      const returnNo = `RET-${txDate.replace(/-/g, '')}-${shortCode}`;

      const returnRecord: ReturnRecord = {
        id: returnId,
        returnNo,
        type: 'SALES_RETURN',
        referenceType: 'SALE',
        referenceId: sale.id,
        referenceVoucherNo: sale.voucherNo,
        merchantId: sale.merchantId,
        merchantName: sale.merchantName,
        date: txDate,
        time: txTime,
        items: validatedItems,
        totalReturnAmount,
        cashRefundAmount: refundCash,
        creditAdjustmentAmount: creditAdjustment,
        refundPaymentMethod,
        reason,
        notes,
        idempotencyKey: key,
        status: 'COMPLETED',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      };

      // 1. Update Merchant Balance if credit adjustment is made
      if (sale.merchantId && creditAdjustment > 0) {
        const merchant = await db.merchants.get(sale.merchantId);
        if (merchant) {
          const currentRec = merchant.currentReceivableBalance || 0;
          const updatedRec = Math.max(0, currentRec - creditAdjustment);
          await db.merchants.update(sale.merchantId, {
            currentReceivableBalance: updatedRec,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Restore Stock via Stock Ledger
      for (const item of validatedItems) {
        const product = await db.products.get(item.productId);
        if (product) {
          const newStock = (product.currentStock || 0) + item.quantity;
          await db.products.update(item.productId, {
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
          });
        }

        const stockMovement: StockMovementRecord = {
          id: generateStableId('sm'),
          productId: item.productId,
          productName: item.productName,
          movementType: 'SALES_RETURN_INBOUND',
          quantity: item.quantity,
          direction: 'IN',
          signedQuantity: item.quantity,
          referenceType: 'SALE',
          referenceId: returnRecord.id,
          referenceVoucherNo: returnRecord.returnNo,
          counterpartName: sale.merchantName || 'Customer',
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalValue: item.totalAmount,
          transactionDate: txDate,
          transactionTime: txTime,
          createdAt: new Date().toISOString(),
          reason: item.reason || reason,
          status: 'COMPLETED',
          idempotencyKey: `${key}_sm_${item.productId}`,
          schemaVersion: 1,
        };
        await db.stockMovements.put(stockMovement);
      }

      // 3. Record Cash Refund in Cash Ledger if cash paid out
      if (refundCash > 0) {
        const cashMovement: CashMovementRecord = {
          id: generateStableId('cm'),
          amount: refundCash,
          direction: 'OUT',
          signedAmount: -refundCash,
          type: 'SALES_RETURN_REFUND_OUT',
          typeLabelMy: 'အရောင်းပြန်အမ်းငွေထုတ် (Sales Return Cash Refund)',
          referenceType: 'SALES_RETURN',
          referenceId: returnRecord.id,
          referenceVoucherNo: returnRecord.returnNo,
          counterpartName: sale.merchantName || 'Customer',
          paymentMethod: refundPaymentMethod,
          description: `Sales Return Refund for Voucher #${sale.voucherNo}`,
          transactionDate: txDate,
          transactionTime: txTime,
          status: 'COMPLETED',
          idempotencyKey: `${key}_cm`,
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
        };
        await db.cashMovements.put(cashMovement);
      }

      // 4. Save Return Record
      await db.returnsAndRefunds.put(returnRecord);

      // 5. Audit Log
      const auditEntry: AuditLogEntry = {
        id: generateStableId('audit'),
        action: 'SALES_RETURN_CREATED',
        details: `Processed Sales Return #${returnNo} for Voucher #${sale.voucherNo}. Amount: ${totalReturnAmount} MMK, Refund: ${refundCash} MMK.`,
        timestamp: new Date().toISOString(),
        entityType: 'RETURN',
        entityId: returnRecord.id,
      };
      await db.auditLogs.put(auditEntry);

      return returnRecord;
    }
  );
}

/**
 * Processes a Purchase Return atomically inside Dexie transaction
 */
export async function processPurchaseReturnAtomic(
  params: ProcessPurchaseReturnParams
): Promise<ReturnRecord> {
  await enforcePermission('PROCESS_RETURN_REFUND', 'ကုန်ဝယ်ယူမှု ပြန်လည်ပို့ဆောင်ခြင်း/ငွေပြန်ရယူခြင်း');
  const {
    purchaseId,
    referenceType,
    items,
    cashRecoveryAmount = 0,
    refundPaymentMethod = 'CASH',
    reason = '',
    notes = '',
    date,
    time,
    idempotencyKey,
  } = params;

  const now = new Date();
  const txDate = date || now.toISOString().split('T')[0];
  const txTime = time || now.toTimeString().substring(0, 5);
  const key = idempotencyKey || `pret_${purchaseId}_${Date.now()}`;

  // Idempotency check before transaction
  const existingKey = await db.returnsAndRefunds.where('idempotencyKey').equals(key).first();
  if (existingKey) {
    return existingKey;
  }

  return await db.transaction(
    'rw',
    [
      db.merchantPurchases,
      db.transactions,
      db.products,
      db.merchants,
      db.suppliers,
      db.stockMovements,
      db.cashMovements,
      db.returnsAndRefunds,
      db.auditLogs,
      db.dailyClosings,
    ],
    async () => {
      const closing = await db.dailyClosings.get(`closing_${txDate}`);
      if (closing && closing.status === 'CLOSED') {
        throw new DailyClosingLockedError(txDate, 'ကုန်ဝယ်ပြန်ပို့စာရင်း');
      }

      const doubleCheck = await db.returnsAndRefunds.where('idempotencyKey').equals(key).first();
      if (doubleCheck) return doubleCheck;

      const {
        voucherNo,
        counterpartName,
        merchantId,
        supplierId,
        validatedItems,
        totalReturnAmount,
      } = await validatePurchaseReturn(purchaseId, referenceType, items);

      const recoveryCash = Math.min(Math.max(0, cashRecoveryAmount), totalReturnAmount);
      const creditAdjustment = Math.max(0, totalReturnAmount - recoveryCash);

      const returnId = generateStableId('ret');
      const shortCode = returnId.substring(returnId.length - 4).toUpperCase();
      const returnNo = `PRET-${txDate.replace(/-/g, '')}-${shortCode}`;

      const returnRecord: ReturnRecord = {
        id: returnId,
        returnNo,
        type: 'PURCHASE_RETURN',
        referenceType: referenceType === 'PURCHASE' ? 'PURCHASE' : 'TRANSACTION',
        referenceId: purchaseId,
        referenceVoucherNo: voucherNo,
        merchantId,
        merchantName: merchantId ? counterpartName : undefined,
        supplierId,
        supplierName: supplierId ? counterpartName : undefined,
        date: txDate,
        time: txTime,
        items: validatedItems,
        totalReturnAmount,
        cashRefundAmount: recoveryCash,
        creditAdjustmentAmount: creditAdjustment,
        refundPaymentMethod,
        reason,
        notes,
        idempotencyKey: key,
        status: 'COMPLETED',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
      };

      // 1. Update Payable/Advance Balance
      if (merchantId && creditAdjustment > 0) {
        const merchant = await db.merchants.get(merchantId);
        if (merchant) {
          const currentPayable = merchant.payableBalance || 0;
          const updatedPayable = Math.max(0, currentPayable - creditAdjustment);
          await db.merchants.update(merchantId, {
            payableBalance: updatedPayable,
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (supplierId && creditAdjustment > 0) {
        const supplier = await db.suppliers.get(supplierId);
        if (supplier) {
          const currentAdv = supplier.currentAdvanceBalance || 0;
          const updatedAdv = currentAdv + creditAdjustment;
          await db.suppliers.update(supplierId, {
            currentAdvanceBalance: updatedAdv,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Reduce Stock via Stock Ledger
      for (const item of validatedItems) {
        const product = await db.products.get(item.productId);
        if (product) {
          const newStock = Math.max(0, (product.currentStock || 0) - item.quantity);
          await db.products.update(item.productId, {
            currentStock: newStock,
            updatedAt: new Date().toISOString(),
          });
        }

        const stockMovement: StockMovementRecord = {
          id: generateStableId('sm'),
          productId: item.productId,
          productName: item.productName,
          movementType: 'PURCHASE_RETURN_OUTBOUND',
          quantity: item.quantity,
          direction: 'OUT',
          signedQuantity: -item.quantity,
          referenceType: 'PURCHASE',
          referenceId: returnRecord.id,
          referenceVoucherNo: returnRecord.returnNo,
          counterpartName: counterpartName || 'Supplier',
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalValue: item.totalAmount,
          transactionDate: txDate,
          transactionTime: txTime,
          createdAt: new Date().toISOString(),
          reason: item.reason || reason,
          status: 'COMPLETED',
          idempotencyKey: `${key}_sm_${item.productId}`,
          schemaVersion: 1,
        };
        await db.stockMovements.put(stockMovement);
      }

      // 3. Record Cash Recovery in Cash Ledger
      if (recoveryCash > 0) {
        const cashMovement: CashMovementRecord = {
          id: generateStableId('cm'),
          amount: recoveryCash,
          direction: 'IN',
          signedAmount: recoveryCash,
          type: 'PURCHASE_RETURN_RECOVERY_IN',
          typeLabelMy: 'ဝယ်ယူမှုပြန်အပ်ငွေရ (Purchase Return Cash Recovery)',
          referenceType: 'PURCHASE_RETURN',
          referenceId: returnRecord.id,
          referenceVoucherNo: returnRecord.returnNo,
          counterpartName: counterpartName || 'Supplier',
          paymentMethod: refundPaymentMethod,
          description: `Purchase Return Recovery for #${voucherNo}`,
          transactionDate: txDate,
          transactionTime: txTime,
          status: 'COMPLETED',
          idempotencyKey: `${key}_cm`,
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
        };
        await db.cashMovements.put(cashMovement);
      }

      // 4. Save Return Record
      await db.returnsAndRefunds.put(returnRecord);

      // 5. Audit Log
      const auditEntry: AuditLogEntry = {
        id: generateStableId('audit'),
        action: 'PURCHASE_RETURN_CREATED',
        details: `Processed Purchase Return #${returnNo} for #${voucherNo}. Amount: ${totalReturnAmount} MMK, Cash Recovered: ${recoveryCash} MMK.`,
        timestamp: new Date().toISOString(),
        entityType: 'RETURN',
        entityId: returnRecord.id,
      };
      await db.auditLogs.put(auditEntry);

      return returnRecord;
    }
  );
}

/**
 * Cancels/Reverses a Return Record using compensating entries
 */
export async function cancelReturnAtomic(
  returnId: string,
  cancellationReason: string
): Promise<ReturnRecord> {
  await enforcePermission('PROCESS_RETURN_REFUND', 'ကုန်ပြန်ပို့မှတ်တမ်း ပယ်ဖျက်ခြင်း');
  const returnRecord = await db.returnsAndRefunds.get(returnId);
  if (!returnRecord) {
    throw new Error(`Return record with ID ${returnId} not found.`);
  }
  if (returnRecord.status === 'CANCELLED') {
    throw new Error(`Return record #${returnRecord.returnNo} is already cancelled.`);
  }

  const now = new Date();
  const txDate = now.toISOString().split('T')[0];
  const txTime = now.toTimeString().substring(0, 5);
  const revKey = `cancel_ret_${returnId}_${Date.now()}`;

  return await db.transaction(
    'rw',
    [
      db.products,
      db.merchants,
      db.suppliers,
      db.stockMovements,
      db.cashMovements,
      db.returnsAndRefunds,
      db.auditLogs,
    ],
    async () => {
      // 1. Mark return record as CANCELLED
      const updatedReturn: ReturnRecord = {
        ...returnRecord,
        status: 'CANCELLED',
        cancellationReason,
        cancelledAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await db.returnsAndRefunds.put(updatedReturn);

      const isSalesReturn = returnRecord.type === 'SALES_RETURN';

      // 2. Reverse Stock Movements
      for (const item of returnRecord.items) {
        const product = await db.products.get(item.productId);
        if (product) {
          let updatedStock = product.currentStock || 0;
          if (isSalesReturn) {
            // Original sales return added stock (IN). Cancellation must subtract stock (OUT).
            updatedStock = Math.max(0, updatedStock - item.quantity);
          } else {
            // Original purchase return subtracted stock (OUT). Cancellation must add stock (IN).
            updatedStock = updatedStock + item.quantity;
          }
          await db.products.update(item.productId, {
            currentStock: updatedStock,
            updatedAt: now.toISOString(),
          });
        }

        const compensatingStock: StockMovementRecord = {
          id: generateStableId('sm'),
          productId: item.productId,
          productName: item.productName,
          movementType: isSalesReturn
            ? 'SALES_RETURN_CANCELLED_REVERSAL'
            : 'PURCHASE_RETURN_CANCELLED_REVERSAL',
          quantity: item.quantity,
          direction: isSalesReturn ? 'OUT' : 'IN',
          signedQuantity: isSalesReturn ? -item.quantity : item.quantity,
          referenceType: isSalesReturn ? 'SALE' : 'PURCHASE',
          referenceId: returnRecord.id,
          referenceVoucherNo: returnRecord.returnNo,
          counterpartName: returnRecord.merchantName || returnRecord.supplierName || 'Counterpart',
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalValue: item.totalAmount,
          transactionDate: txDate,
          transactionTime: txTime,
          createdAt: now.toISOString(),
          reason: `Cancelled Return #${returnRecord.returnNo}: ${cancellationReason}`,
          reversalOf: returnRecord.id,
          status: 'COMPLETED',
          idempotencyKey: `${revKey}_sm_${item.productId}`,
          schemaVersion: 1,
        };
        await db.stockMovements.put(compensatingStock);
      }

      // 3. Reverse Cash Movements if cash refund/recovery took place
      if (returnRecord.cashRefundAmount > 0) {
        const compensatingCash: CashMovementRecord = {
          id: generateStableId('cm'),
          amount: returnRecord.cashRefundAmount,
          direction: isSalesReturn ? 'IN' : 'OUT',
          signedAmount: isSalesReturn
            ? returnRecord.cashRefundAmount
            : -returnRecord.cashRefundAmount,
          type: isSalesReturn
            ? 'SALES_RETURN_CANCELLED_CASH_REVERSAL'
            : 'PURCHASE_RETURN_CANCELLED_CASH_REVERSAL',
          typeLabelMy: isSalesReturn
            ? 'အရောင်းပြန်အမ်းဖျက်သိမ်းငွေပြန်သွင်း'
            : 'ဝယ်ပြန်အပ်ဖျက်သိမ်းငွေပြန်ထုတ်',
          referenceType: isSalesReturn ? 'SALES_RETURN' : 'PURCHASE_RETURN',
          referenceId: returnRecord.id,
          referenceVoucherNo: returnRecord.returnNo,
          counterpartName: returnRecord.merchantName || returnRecord.supplierName || 'Counterpart',
          paymentMethod: returnRecord.refundPaymentMethod || 'CASH',
          description: `Reversal of Return #${returnRecord.returnNo}`,
          transactionDate: txDate,
          transactionTime: txTime,
          reversalOf: returnRecord.id,
          status: 'COMPLETED',
          idempotencyKey: `${revKey}_cm`,
          schemaVersion: 1,
          createdAt: now.toISOString(),
        };
        await db.cashMovements.put(compensatingCash);
      }

      // 4. Reverse Merchant or Supplier credit adjustments
      if (isSalesReturn && returnRecord.merchantId && returnRecord.creditAdjustmentAmount > 0) {
        const merchant = await db.merchants.get(returnRecord.merchantId);
        if (merchant) {
          const currentRec = merchant.currentReceivableBalance || 0;
          await db.merchants.update(returnRecord.merchantId, {
            currentReceivableBalance: currentRec + returnRecord.creditAdjustmentAmount,
            updatedAt: now.toISOString(),
          });
        }
      } else if (!isSalesReturn) {
        if (returnRecord.merchantId && returnRecord.creditAdjustmentAmount > 0) {
          const merchant = await db.merchants.get(returnRecord.merchantId);
          if (merchant) {
            const currentPayable = merchant.payableBalance || 0;
            await db.merchants.update(returnRecord.merchantId, {
              payableBalance: currentPayable + returnRecord.creditAdjustmentAmount,
              updatedAt: now.toISOString(),
            });
          }
        } else if (returnRecord.supplierId && returnRecord.creditAdjustmentAmount > 0) {
          const supplier = await db.suppliers.get(returnRecord.supplierId);
          if (supplier) {
            const currentAdv = supplier.currentAdvanceBalance || 0;
            await db.suppliers.update(returnRecord.supplierId, {
              currentAdvanceBalance: Math.max(0, currentAdv - returnRecord.creditAdjustmentAmount),
              updatedAt: now.toISOString(),
            });
          }
        }
      }

      // 5. Audit Log
      const auditEntry: AuditLogEntry = {
        id: generateStableId('audit'),
        action: 'RETURN_CANCELLED',
        details: `Cancelled Return #${returnRecord.returnNo}. Reason: ${cancellationReason}`,
        timestamp: now.toISOString(),
        entityType: 'RETURN',
        entityId: returnRecord.id,
      };
      await db.auditLogs.put(auditEntry);

      return updatedReturn;
    }
  );
}

/**
 * Gets all returns with optional filtering
 */
export async function getAllReturns(options?: {
  type?: ReturnType;
  referenceId?: string;
  merchantId?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}): Promise<ReturnRecord[]> {
  let collection = db.returnsAndRefunds.toCollection();

  let results = await collection.sortBy('createdAt');
  results.reverse(); // Newest first

  if (options) {
    if (options.type) {
      results = results.filter((r) => r.type === options.type);
    }
    if (options.referenceId) {
      results = results.filter((r) => r.referenceId === options.referenceId);
    }
    if (options.merchantId) {
      results = results.filter((r) => r.merchantId === options.merchantId);
    }
    if (options.supplierId) {
      results = results.filter((r) => r.supplierId === options.supplierId);
    }
    if (options.startDate) {
      results = results.filter((r) => r.date >= options.startDate!);
    }
    if (options.endDate) {
      results = results.filter((r) => r.date <= options.endDate!);
    }
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      results = results.filter(
        (r) =>
          r.returnNo.toLowerCase().includes(q) ||
          r.referenceVoucherNo.toLowerCase().includes(q) ||
          (r.merchantName && r.merchantName.toLowerCase().includes(q)) ||
          (r.supplierName && r.supplierName.toLowerCase().includes(q)) ||
          r.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    }
  }

  return results;
}
