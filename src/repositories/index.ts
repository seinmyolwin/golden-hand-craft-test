import { db, ShweLetYarDatabase } from '../db/database';
import {
  saveAttachmentRecord,
  getAttachmentsForVoucher as getServiceAttachmentsForVoucher,
  deleteAttachmentSafely,
  cleanupOrphanAttachments,
  migrateLegacyAttachments,
} from '../services/attachmentService';
import {
  Product,
  Supplier,
  Merchant,
  TransactionRecord,
  SaleRecord,
  MerchantPurchaseRecord,
  MerchantOrder,
  StockAdjustmentRecord,
  PeerTradeRecord,
  SoftDeletedItem,
  AuditLogEntry,
  RawMaterialPreset,
  SettingRecord,
  AttachmentRecord,
  StockMovementRecord,
  CashMovementRecord,
  DailyClosingRecord,
  PermissionAction,
} from '../types';
import {
  IProductRepository,
  ISupplierRepository,
  IMerchantRepository,
  ITransactionRepository,
  ISaleRepository,
  IMerchantPurchaseRepository,
  IOrderRepository,
  IPeerTradeRepository,
  IStockAdjustmentRepository,
  ISoftDeleteRepository,
  IAuditRepository,
  IRawMaterialPresetRepository,
  ISettingsRepository,
  IAttachmentRepository,
  IStockMovementRepository,
  ICashMovementRepository,
  IDailyClosingRepository,
} from './types';
import {
  BusinessIntegrityError,
  IdempotencyConflictError,
  EntityNotFoundError,
  InvalidStateTransitionError,
  AccountingInvariantError,
  DailyClosingLockedError,
} from './errors';
import { generateStableId, generateVoucherNo } from '../utils/idGenerator';
import { buildCashIdempotencyKey, getCashMovementTypeLabel } from '../services/cashLedgerService';
import { recordAuditEvent } from '../services/auditTrailService';
import { enforcePermission, AuthorizationError } from '../services/authorizationService';
import { roundMMK, moneyMul, moneyAdd, moneySub, calcRemainingBalance } from '../utils/currency';

export * from './types';
export * from './errors';

export class ProductRepository implements IProductRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Product[]> {
    return this.database.products.toArray();
  }

  async getById(id: string): Promise<Product | undefined> {
    return this.database.products.get(id);
  }

  async getActive(): Promise<Product[]> {
    return this.database.products.filter((p) => p.active !== false).toArray();
  }

  async getByCategory(category: string): Promise<Product[]> {
    return this.database.products.where('category').equals(category).toArray();
  }

  async save(product: Product): Promise<string> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ပစ္စည်း မာစတာဒေတာ သိမ်းဆည်းခြင်း');
    const now = new Date().toISOString();
    const toSave: Product = {
      ...product,
      id: product.id || generateStableId('prod'),
      createdAt: product.createdAt || now,
      updatedAt: now,
      revision: (product.revision || 0) + 1,
    };
    await this.database.products.put(toSave);
    return toSave.id;
  }

  async saveMany(products: Product[]): Promise<void> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ပစ္စည်း မာစတာဒေတာများ သိမ်းဆည်းခြင်း');
    const now = new Date().toISOString();
    const enriched = products.map((p) => ({
      ...p,
      id: p.id || generateStableId('prod'),
      createdAt: p.createdAt || now,
      updatedAt: now,
      revision: (p.revision || 0) + 1,
    }));
    await this.database.products.bulkPut(enriched);
  }

  async updateStock(id: string, newStock: number): Promise<void> {
    const product = await this.database.products.get(id);
    if (!product) {
      throw new EntityNotFoundError('Product', id);
    }
    await this.database.products.update(id, {
      currentStock: newStock,
      updatedAt: new Date().toISOString(),
      revision: (product.revision || 0) + 1,
    });
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_MASTER_DATA', 'ကုန်ပစ္စည်း ဖျက်ပစ်ခြင်း');
    await this.database.products.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ကုန်ပစ္စည်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.products.clear();
  }

  async count(): Promise<number> {
    return this.database.products.count();
  }
}

export class SupplierRepository implements ISupplierRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Supplier[]> {
    return this.database.suppliers.toArray();
  }

  async getById(id: string): Promise<Supplier | undefined> {
    return this.database.suppliers.get(id);
  }

  async save(supplier: Supplier): Promise<string> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ကြမ်းပေးသွင်းသူ မာစတာဒေတာ သိမ်းဆည်းခြင်း');
    const now = new Date().toISOString();
    const toSave: Supplier = {
      ...supplier,
      id: supplier.id || generateStableId('sup'),
      createdAt: supplier.createdAt || now,
      updatedAt: now,
    };
    await this.database.suppliers.put(toSave);
    return toSave.id;
  }

  async saveMany(suppliers: Supplier[]): Promise<void> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ကြမ်းပေးသွင်းသူ မာစတာဒေတာများ သိမ်းဆည်းခြင်း');
    const now = new Date().toISOString();
    const enriched = suppliers.map((s) => ({
      ...s,
      id: s.id || generateStableId('sup'),
      createdAt: s.createdAt || now,
      updatedAt: now,
    }));
    await this.database.suppliers.bulkPut(enriched);
  }

  async updateAdvanceBalance(id: string, newAdvanceBalance: number): Promise<void> {
    const supplier = await this.database.suppliers.get(id);
    if (!supplier) {
      throw new EntityNotFoundError('Supplier', id);
    }
    await this.database.suppliers.update(id, {
      currentAdvanceBalance: newAdvanceBalance,
      updatedAt: new Date().toISOString(),
    });
  }

  async update(id: string, changes: Partial<Supplier>): Promise<void> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ကြမ်းပေးသွင်းသူ အချက်အလက် ပြင်ဆင်ခြင်း');
    await this.database.suppliers.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_MASTER_DATA', 'ပေးသွင်းသူ ဖျက်ပစ်ခြင်း');
    await this.database.suppliers.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ပေးသွင်းသူများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.suppliers.clear();
  }

  async count(): Promise<number> {
    return this.database.suppliers.count();
  }
}

export class MerchantRepository implements IMerchantRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<Merchant[]> {
    return this.database.merchants.toArray();
  }

  async getById(id: string): Promise<Merchant | undefined> {
    return this.database.merchants.get(id);
  }

  async save(merchant: Merchant): Promise<string> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ဝယ်ယူသူ/ကုန်သည် မာစတာဒေတာ သိမ်းဆည်းခြင်း');
    const now = new Date().toISOString();
    const toSave: Merchant = {
      ...merchant,
      id: merchant.id || generateStableId('merch'),
      createdAt: merchant.createdAt || now,
      updatedAt: now,
    };
    await this.database.merchants.put(toSave);
    return toSave.id;
  }

  async saveMany(merchants: Merchant[]): Promise<void> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ဝယ်ယူသူ/ကုန်သည် မာစတာဒေတာများ သိမ်းဆည်းခြင်း');
    const now = new Date().toISOString();
    const enriched = merchants.map((m) => ({
      ...m,
      id: m.id || generateStableId('merch'),
      createdAt: m.createdAt || now,
      updatedAt: now,
    }));
    await this.database.merchants.bulkPut(enriched);
  }

  async updateReceivableBalance(id: string, newReceivableBalance: number): Promise<void> {
    const merchant = await this.database.merchants.get(id);
    if (!merchant) {
      throw new EntityNotFoundError('Merchant', id);
    }
    await this.database.merchants.update(id, {
      currentReceivableBalance: newReceivableBalance,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Atomic customer/merchant payment settlement
   */
  async recordMerchantPaymentAtomic(
    merchantId: string,
    paymentAmount: number,
    paymentMethod: string = 'CASH',
    notes?: string,
    clientRequestId?: string
  ): Promise<Merchant & { auditEntry?: AuditLogEntry }> {
    if (paymentAmount <= 0) {
      throw new BusinessIntegrityError('ပေးဆပ်ငွေပမာဏသည် ၀ ထက် ကြီးရပါမည်', 'INVALID_AMOUNT');
    }

    return this.database.transaction(
      'rw',
      [this.database.merchants, this.database.auditLogs, this.database.cashMovements],
      async () => {
        const merchant = await this.database.merchants.get(merchantId);
        if (!merchant) {
          throw new EntityNotFoundError('Merchant', merchantId);
        }

        const requestId = clientRequestId || generateStableId('mset');
        const idempotencyKey = buildCashIdempotencyKey('MERCHANT_DEBT_COLLECTION_IN', merchant.id, requestId);

        // Check if an existing cash movement already exists with this idempotency key
        const existingCashMovement = await this.database.cashMovements.where('idempotencyKey').equals(idempotencyKey).first();
        if (existingCashMovement) {
          return merchant;
        }

        const now = new Date().toISOString();
        const paymentAmountMMK = roundMMK(paymentAmount);
        const prevBalance = roundMMK((merchant as any).currentBalance ?? merchant.currentReceivableBalance ?? merchant.receivableBalance ?? 0);
        const newBalance = Math.max(0, moneySub(prevBalance, paymentAmountMMK));
        const updatedMerchant: Merchant = {
          ...merchant,
          currentReceivableBalance: newBalance,
          receivableBalance: newBalance,
          totalPaidAmount: moneyAdd(merchant.totalPaidAmount || 0, paymentAmountMMK),
          updatedAt: now,
        };

        await this.database.merchants.put(updatedMerchant);

        // Record Cash Movement in Cash Ledger
        const cashId = generateStableId('csh');
        await this.database.cashMovements.put({
          id: cashId,
          amount: Math.abs(paymentAmountMMK),
          direction: 'IN',
          signedAmount: Math.abs(paymentAmountMMK),
          type: 'MERCHANT_DEBT_COLLECTION_IN',
          typeLabelMy: getCashMovementTypeLabel('MERCHANT_DEBT_COLLECTION_IN'),
          referenceType: 'MERCHANT_PAYMENT',
          referenceId: merchant.id,
          counterpartName: merchant.name,
          paymentMethod: paymentMethod || 'CASH',
          description: `ကုန်သည်ကြွေးဟောင်းဆပ်ငွေ: ${merchant.name} (${merchant.town})`,
          transactionDate: now.slice(0, 10),
          transactionTime: now.slice(11, 16),
          notes,
          status: 'COMPLETED',
          idempotencyKey,
          schemaVersion: 1,
          createdAt: now,
        });

        // Audit Log
        const auditEntry = await recordAuditEvent(
          {
            action: 'ကုန်သည်ကြွေးကျန် ပေးဆပ်ခြင်း (Atomic)',
            actionType: 'CASH_MOVEMENT',
            details: `${merchant.name} (${merchant.town}): ပေးဆပ်ငွေ ${paymentAmountMMK.toLocaleString()} ကျပ် (${paymentMethod}) | လက်ကျန်ကြွေး: ${newBalance.toLocaleString()} ကျပ်${notes ? ` | မှတ်ချက်: ${notes}` : ''}`,
            referenceType: 'MERCHANT',
            referenceId: merchant.id,
            amount: paymentAmountMMK,
          },
          this.database
        );

        return { ...updatedMerchant, auditEntry };
      }
    );
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_MASTER_DATA', 'ကုန်သည် ဖျက်ပစ်ခြင်း');
    await this.database.merchants.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ကုန်သည်များ အားလုံးရှင်းလင်းခြင်း');
    await this.database.merchants.clear();
  }

  async count(): Promise<number> {
    return this.database.merchants.count();
  }
}

export class TransactionRepository implements ITransactionRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<TransactionRecord[]> {
    return this.database.transactions.reverse().sortBy('date');
  }

  async getById(id: string): Promise<TransactionRecord | undefined> {
    return this.database.transactions.get(id);
  }

  async getBySupplier(supplierId: string): Promise<TransactionRecord[]> {
    return this.database.transactions.where('supplierId').equals(supplierId).toArray();
  }

  async getByDate(date: string): Promise<TransactionRecord[]> {
    return this.database.transactions.where('date').equals(date).toArray();
  }

  async save(tx: TransactionRecord): Promise<string> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'ကုန်သိမ်းစာရင်း သိမ်းဆည်းခြင်း');
    await this.database.transactions.put(tx);
    return tx.id;
  }

  /**
   * Atomic Inbound Goods Collection & Supplier Balance Settlement
   * Guarantees ACID all-or-nothing execution:
   * 1. Idempotency & validation check
   * 2. Increments finished goods stock
   * 3. Updates supplier advance balance & aggregates
   * 4. Inserts transaction record with completed status
   * 5. Appends audit log
   */
  async saveInboundAtomic(tx: TransactionRecord): Promise<TransactionRecord> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'ကုန်သိမ်းစာရင်းသွင်းခြင်း');
    if (tx.supplierId === '__NEW__' || (!tx.supplierId && tx.supplierName?.trim())) {
      await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ပစ္စည်းပေးသွင်းသူ အသစ်ဖန်တီးခြင်း (Atomic)');
    }
    return this.database.transaction(
      'rw',
      [
        this.database.transactions,
        this.database.suppliers,
        this.database.products,
        this.database.auditLogs,
        this.database.stockMovements,
        this.database.cashMovements,
        this.database.dailyClosings,
      ],
      async () => {
        const txDate = tx.date || new Date().toISOString().slice(0, 10);
        const closing = await this.database.dailyClosings.get(`closing_${txDate}`);
        if (closing && closing.status === 'CLOSED') {
          throw new DailyClosingLockedError(txDate, 'ကုန်သိမ်းစာရင်းသွင်းခြင်း');
        }

        // 1. Idempotency protection
        if (tx.id) {
          const existing = await this.database.transactions.get(tx.id);
          if (existing && existing.status !== 'CANCELLED') {
            throw new IdempotencyConflictError(`Transaction ID "${tx.id}" has already been processed.`);
          }
        }

        // 2. Validate supplier (or auto-create / reuse within same atomic transaction)
        const now = new Date().toISOString();
        let supplier: Supplier | undefined;
        if (tx.supplierId && tx.supplierId !== '__NEW__') {
          supplier = await this.database.suppliers.get(tx.supplierId);
          if (!supplier) {
            throw new EntityNotFoundError('Supplier', tx.supplierId);
          }
        }

        if (!supplier) {
          const supplierNameTrimmed = (tx.supplierName || '').trim();
          if (!supplierNameTrimmed) {
            throw new EntityNotFoundError('Supplier', tx.supplierId || '__NEW__');
          }

          // Check if existing supplier matches name (trimmed, case-insensitive)
          const allSuppliers = await this.database.suppliers.toArray();
          const existing = allSuppliers.find(
            (s) => s.name.trim().toLowerCase() === supplierNameTrimmed.toLowerCase()
          );

          if (existing) {
            supplier = existing;
          } else {
            const newSupplierId = (tx.supplierId && tx.supplierId !== '__NEW__') ? tx.supplierId : generateStableId('sup');
            const supCode = `SUP-${String(allSuppliers.length + 1).padStart(3, '0')}`;
            const newSupplier: Supplier = {
              id: newSupplierId,
              code: supCode,
              name: supplierNameTrimmed,
              village: (tx.supplierVillage || 'အထွေထွေ').trim(),
              phone: (tx.supplierPhone || '').trim(),
              currentAdvanceBalance: 0,
              totalAdvanceGiven: 0,
              totalGoodsValueDelivered: 0,
              createdAt: now,
              updatedAt: now,
            };
            await this.database.suppliers.put(newSupplier);

            await recordAuditEvent(
              {
                action: 'ကုန်ပစ္စည်းပေးသွင်းသူ အသစ်ထည့်သွင်းခြင်း (Auto-created on Inbound)',
                actionType: 'CREATE_SUPPLIER',
                details: `${newSupplier.name} (${newSupplier.village}) - ကုန်သိမ်းစာရင်းသွင်းစဉ် အလိုအလျောက် ထည့်သွင်းခဲ့သည်`,
                referenceType: 'SUPPLIER',
                referenceId: newSupplier.id,
              },
              this.database
            );

            supplier = newSupplier;
          }
        }

        const normalizedTxDate = (tx.date || now.slice(0, 10)).trim().slice(0, 10);
        const rawCashPaid = tx.cashPaidToSupplier ?? tx.netCashPaidToSupplier ?? (tx.type === 'CASH_PAYMENT_ONLY' ? tx.paidAmount : 0) ?? 0;
        const cashPaid = roundMMK(rawCashPaid);
        const totalGoodsVal = roundMMK(tx.totalGoodsValue || 0);
        const advDeducted = roundMMK(tx.advanceDeducted || 0);
        const newAdvTaken = roundMMK(tx.newAdvanceTaken || 0);
        const remAdvBalance = roundMMK(tx.remainingAdvanceBalance || 0);
        const cashRepayment = roundMMK(tx.cashRepaymentReceived || 0);

        const enrichedTx: TransactionRecord = {
          ...tx,
          id: tx.id || generateStableId('tx'),
          voucherNo: tx.voucherNo || generateVoucherNo('TX', normalizedTxDate),
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierVillage: supplier.village,
          date: normalizedTxDate,
          type: tx.type || 'COLLECTION_AND_SETTLEMENT',
          totalGoodsValue: totalGoodsVal,
          advanceDeducted: advDeducted,
          newAdvanceTaken: newAdvTaken,
          remainingAdvanceBalance: remAdvBalance,
          cashRepaymentReceived: cashRepayment,
          cashPaidToSupplier: cashPaid,
          netCashPaidToSupplier: tx.netCashPaidToSupplier !== undefined ? roundMMK(tx.netCashPaidToSupplier) : cashPaid,
          netPayable: tx.netPayable !== undefined ? roundMMK(tx.netPayable) : (tx.paymentMethod === 'CREDIT' ? Math.max(0, totalGoodsVal - advDeducted - cashPaid) : 0),
          status: 'COMPLETED',
          createdAt: tx.createdAt || now,
          updatedAt: now,
          revision: (tx.revision || 0) + 1,
        };

        // 3. Validate products, adjust inventory & record ledger movement for collected items
        if (Array.isArray(tx.items)) {
          for (const item of tx.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (!product) {
              throw new EntityNotFoundError('Product', item.productId);
            }
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            const updatedStock = currentStock + (item.quantity || 0);
            await this.database.products.update(item.productId, {
              currentStock: updatedStock,
              updatedAt: now,
            });

            // Write stock movement ledger
            const mvId = generateStableId('mv');
            const unitPrice = roundMMK(item.unitPrice || 0);
            const totalVal = roundMMK(moneyMul(item.quantity || 0, unitPrice));
            await this.database.stockMovements.put({
              id: mvId,
              productId: item.productId,
              productName: product.name,
              movementType: 'SUPPLIER_INBOUND',
              quantity: item.quantity || 0,
              direction: 'IN',
              signedQuantity: item.quantity || 0,
              referenceType: 'TRANSACTION',
              referenceId: enrichedTx.id,
              referenceVoucherNo: enrichedTx.voucherNo,
              counterpartName: tx.supplierName || supplier.name,
              unitPrice,
              totalValue: totalVal,
              transactionDate: normalizedTxDate,
              transactionTime: tx.time,
              createdAt: now,
              status: 'COMPLETED',
              idempotencyKey: `INBOUND_${enrichedTx.id}_${item.productId}`,
              schemaVersion: 1,
            });
          }
        }

        // 4. Update supplier balance & delivered stats
        const updatedSupplier: Supplier = {
          ...supplier,
          currentAdvanceBalance: remAdvBalance,
          payableBalance: moneyAdd(
            supplier.payableBalance || 0,
            enrichedTx.netPayable || 0
          ),
          totalGoodsValueDelivered: moneyAdd(
            supplier.totalGoodsValueDelivered || (supplier as any).totalGoodsDeliveredValue || 0,
            totalGoodsVal
          ),
          totalAdvanceGiven: moneyAdd(
            supplier.totalAdvanceGiven || (supplier as any).totalAdvancesGiven || 0,
            newAdvTaken
          ),
          updatedAt: now,
        };
        await this.database.suppliers.put(updatedSupplier);

        // 5. Cash Ledger Recording
        if (cashPaid > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('SUPPLIER_PAYOUT', enrichedTx.id);
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(cashPaid),
            direction: 'OUT',
            signedAmount: -Math.abs(cashPaid),
            type: 'SUPPLIER_PAYOUT',
            typeLabelMy: getCashMovementTypeLabel('SUPPLIER_PAYOUT'),
            referenceType: 'TRANSACTION',
            referenceId: enrichedTx.id,
            referenceVoucherNo: enrichedTx.voucherNo,
            counterpartName: tx.supplierName || supplier.name,
            paymentMethod: tx.paymentMethod || 'CASH',
            description: `ကုန်သိမ်းငွေပေးချေမှု: ${tx.supplierName || supplier.name} (ဘောင်ချာ ${enrichedTx.voucherNo})`,
            transactionDate: normalizedTxDate,
            transactionTime: tx.time || now.slice(11, 16),
            notes: tx.notes,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        // 5b. Cash Advance given during collection
        if (newAdvTaken > 0) {
          const advCashId = generateStableId('csh');
          const advIdempotencyKey = buildCashIdempotencyKey('SUPPLIER_ADVANCE_GIVEN', enrichedTx.id);
          await this.database.cashMovements.put({
            id: advCashId,
            amount: Math.abs(newAdvTaken),
            direction: 'OUT',
            signedAmount: -Math.abs(newAdvTaken),
            type: 'SUPPLIER_ADVANCE_GIVEN',
            typeLabelMy: getCashMovementTypeLabel('SUPPLIER_ADVANCE_GIVEN'),
            referenceType: 'TRANSACTION',
            referenceId: enrichedTx.id,
            referenceVoucherNo: enrichedTx.voucherNo,
            counterpartName: tx.supplierName || supplier.name,
            paymentMethod: tx.paymentMethod || 'CASH',
            description: `ကုန်သိမ်းစဉ် အကြိုငွေထုတ်ပေးမှု: ${tx.supplierName || supplier.name} (ဘောင်ချာ ${enrichedTx.voucherNo})`,
            transactionDate: normalizedTxDate,
            transactionTime: tx.time || now.slice(11, 16),
            notes: tx.newAdvanceReason || tx.notes,
            status: 'COMPLETED',
            idempotencyKey: advIdempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        if (cashRepayment > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('SUPPLIER_REPAYMENT_IN', enrichedTx.id);
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(cashRepayment),
            direction: 'IN',
            signedAmount: Math.abs(cashRepayment),
            type: 'SUPPLIER_REPAYMENT_IN',
            typeLabelMy: getCashMovementTypeLabel('SUPPLIER_REPAYMENT_IN'),
            referenceType: 'TRANSACTION',
            referenceId: enrichedTx.id,
            referenceVoucherNo: enrichedTx.voucherNo,
            counterpartName: tx.supplierName || supplier.name,
            paymentMethod: tx.paymentMethod || 'CASH',
            description: `ကြိုတင်ငွေပြန်ဆပ်မှု: ${tx.supplierName || supplier.name} (ဘောင်ချာ ${enrichedTx.voucherNo})`,
            transactionDate: normalizedTxDate,
            transactionTime: tx.time || now.slice(11, 16),
            notes: tx.notes,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        // 6. Save transaction record
        await this.database.transactions.put(enrichedTx);

        // 7. Audit Log
        const auditEntry = await recordAuditEvent(
          {
            action: 'ကုန်သိမ်းစာရင်း ရေးသွင်းခြင်း (Atomic)',
            actionType: 'PURCHASE',
            details: `ဘောင်ချာ ${enrichedTx.voucherNo} - ${tx.supplierName}: တန်ဖိုး ${totalGoodsVal.toLocaleString()} ကျပ် | အကြိုငွေနုတ်: ${advDeducted.toLocaleString()} ကျပ် | လက်ကျန်: ${remAdvBalance.toLocaleString()} ကျပ်`,
            referenceType: 'TRANSACTION',
            referenceId: enrichedTx.id,
            referenceVoucherNo: enrichedTx.voucherNo,
            amount: totalGoodsVal,
            timestamp: `${tx.date} ${tx.time || ''}`.trim() || now,
          },
          this.database
        );

        return { ...enrichedTx, auditEntry };
      }
    );
  }

  /**
   * Atomic Inbound Goods Cancellation (Purchase Reversal)
   * 1. Decrements finished goods stock (reverses stock addition)
   * 2. Reverses supplier balance and aggregates
   * 3. Reverses cash ledger movements with compensating entries
   * 4. Marks transaction as CANCELLED
   * 5. Appends reversal stock movements to ledger
   * 6. Logs audit entry
   */
  async cancelInboundAtomic(txId: string, reason: string = 'သုံးစွဲသူမှ ပယ်ဖျက်သည်'): Promise<TransactionRecord> {
    await enforcePermission('VOID_TRANSACTION', 'ကုန်သိမ်းမှတ်တမ်း ပယ်ဖျက်ခြင်း');
    return this.database.transaction(
      'rw',
      [
        this.database.transactions,
        this.database.suppliers,
        this.database.products,
        this.database.auditLogs,
        this.database.stockMovements,
        this.database.cashMovements,
      ],
      async () => {
        const tx = await this.database.transactions.get(txId);
        if (!tx) {
          throw new EntityNotFoundError('Transaction', txId);
        }
        if (tx.status === 'CANCELLED') {
          throw new InvalidStateTransitionError('ဤကုန်သိမ်းစာရင်းအား ဖျက်သိမ်းပြီးဖြစ်ပါသည်');
        }

        const now = new Date().toISOString();

        // 1. Revert product stocks & record cancellation reversal in ledger
        if (Array.isArray(tx.items)) {
          for (const item of tx.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (product) {
              const currentStock = product.currentStock ?? product.openingStock ?? 0;
              const newStock = Math.max(0, currentStock - (item.quantity || 0));
              await this.database.products.update(item.productId, {
                currentStock: newStock,
                updatedAt: now,
              });

              const unitPrice = roundMMK(item.unitPrice || 0);
              const totalVal = roundMMK(moneyMul(item.quantity || 0, unitPrice));
              await this.database.stockMovements.put({
                id: generateStableId('mv'),
                productId: item.productId,
                productName: product.name,
                movementType: 'TRANSACTION_CANCELLED_REVERSAL',
                quantity: item.quantity || 0,
                direction: 'OUT',
                signedQuantity: -(item.quantity || 0),
                referenceType: 'TRANSACTION',
                referenceId: tx.id,
                referenceVoucherNo: tx.voucherNo,
                counterpartName: tx.supplierName,
                unitPrice,
                totalValue: totalVal,
                transactionDate: now.slice(0, 10),
                transactionTime: now.slice(11, 16),
                createdAt: now,
                reason,
                status: 'COMPLETED',
                idempotencyKey: `INBOUND_REV_${tx.id}_${item.productId}`,
                schemaVersion: 1,
              });
            }
          }
        }

        // 2. Compensating Cash Ledger Reversals
        const rawCashPaid = tx.cashPaidToSupplier || tx.netCashPaidToSupplier || (tx.type === 'CASH_PAYMENT_ONLY' ? tx.paidAmount : 0) || 0;
        const cashPaid = roundMMK(rawCashPaid);
        if (cashPaid > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('TRANSACTION_CANCELLED_CASH_REVERSAL', tx.id, 'PAYOUT_REV');
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(cashPaid),
            direction: 'IN',
            signedAmount: Math.abs(cashPaid),
            type: 'TRANSACTION_CANCELLED_CASH_REVERSAL',
            typeLabelMy: getCashMovementTypeLabel('TRANSACTION_CANCELLED_CASH_REVERSAL'),
            referenceType: 'TRANSACTION',
            referenceId: tx.id,
            referenceVoucherNo: tx.voucherNo,
            counterpartName: tx.supplierName,
            paymentMethod: tx.paymentMethod || 'CASH',
            description: `ကုန်သိမ်းဖျက်သိမ်းငွေပြန်ရ (Reversal): ${tx.supplierName} (ဘောင်ချာ ${tx.voucherNo || tx.id})`,
            transactionDate: now.slice(0, 10),
            transactionTime: now.slice(11, 16),
            reversalOf: tx.id,
            notes: reason,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        const rawCashRepayment = tx.cashRepaymentReceived || 0;
        const cashRepayment = roundMMK(rawCashRepayment);
        if (cashRepayment > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('TRANSACTION_CANCELLED_CASH_REVERSAL', tx.id, 'REP_REV');
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(cashRepayment),
            direction: 'OUT',
            signedAmount: -Math.abs(cashRepayment),
            type: 'TRANSACTION_CANCELLED_CASH_REVERSAL',
            typeLabelMy: getCashMovementTypeLabel('TRANSACTION_CANCELLED_CASH_REVERSAL'),
            referenceType: 'TRANSACTION',
            referenceId: tx.id,
            referenceVoucherNo: tx.voucherNo,
            counterpartName: tx.supplierName,
            paymentMethod: tx.paymentMethod || 'CASH',
            description: `ကြိုတင်ငွေပြန်ဆပ်မှုဖျက်သိမ်း (Reversal): ${tx.supplierName} (ဘောင်ချာ ${tx.voucherNo || tx.id})`,
            transactionDate: now.slice(0, 10),
            transactionTime: now.slice(11, 16),
            reversalOf: tx.id,
            notes: reason,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        const rawNewAdv = tx.newAdvanceTaken || 0;
        const newAdv = roundMMK(rawNewAdv);
        if (newAdv > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('TRANSACTION_CANCELLED_CASH_REVERSAL', tx.id, 'ADV_REV');
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(newAdv),
            direction: 'IN',
            signedAmount: Math.abs(newAdv),
            type: 'TRANSACTION_CANCELLED_CASH_REVERSAL',
            typeLabelMy: getCashMovementTypeLabel('TRANSACTION_CANCELLED_CASH_REVERSAL'),
            referenceType: 'TRANSACTION',
            referenceId: tx.id,
            referenceVoucherNo: tx.voucherNo,
            counterpartName: tx.supplierName,
            paymentMethod: tx.paymentMethod || 'CASH',
            description: `ကုန်သိမ်းအကြိုငွေဖျက်သိမ်း (Reversal): ${tx.supplierName} (ဘောင်ချာ ${tx.voucherNo || tx.id})`,
            transactionDate: now.slice(0, 10),
            transactionTime: now.slice(11, 16),
            reversalOf: tx.id,
            notes: reason,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        // 3. Revert supplier balance
        const supplier = await this.database.suppliers.get(tx.supplierId);
        if (supplier) {
          const revertedAdvanceBalance = tx.previousAdvanceBalance !== undefined
            ? roundMMK(tx.previousAdvanceBalance)
            : supplier.currentAdvanceBalance;
          const updatedSupplier: Supplier = {
            ...supplier,
            currentAdvanceBalance: revertedAdvanceBalance,
            totalGoodsValueDelivered: Math.max(
              0,
              moneySub(supplier.totalGoodsValueDelivered || (supplier as any).totalGoodsDeliveredValue || 0, tx.totalGoodsValue || 0)
            ),
            totalAdvanceGiven: Math.max(
              0,
              moneySub(supplier.totalAdvanceGiven || (supplier as any).totalAdvancesGiven || 0, tx.newAdvanceTaken || 0)
            ),
            updatedAt: now,
          };
          await this.database.suppliers.put(updatedSupplier);
        }

        // 4. Mark transaction as CANCELLED
        const cancelledTx: TransactionRecord = {
          ...tx,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: now,
          updatedAt: now,
        };
        await this.database.transactions.put(cancelledTx);

        // 5. Audit Log
        const auditEntry = await recordAuditEvent(
          {
            action: 'ကုန်သိမ်းစာရင်း ပြန်လည်ဖျက်သိမ်းခြင်း (Atomic Rollback)',
            actionType: 'REVERSAL',
            details: `ဘောင်ချာ ${tx.voucherNo || tx.id} (${tx.supplierName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
            referenceType: 'TRANSACTION',
            referenceId: tx.id,
            referenceVoucherNo: tx.voucherNo,
            amount: tx.totalGoodsValue || 0,
          },
          this.database
        );

        return { ...cancelledTx, auditEntry };
      }
    );
  }

  /**
   * Atomic Soft Delete for Inbound Goods Collection / Transaction
   */
  async softDeleteTransactionAtomic(txId: string, reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်'): Promise<SoftDeletedItem> {
    return softDeleteTransactionAtomic(txId, reason, this.database);
  }

  /**
   * Atomic Advance Payment Given to Supplier
   */
  async recordSupplierAdvanceAtomic(
    supplierId: string,
    advanceAmount: number,
    reason: string = 'အကြိုငွေထုတ်ပေးခြင်း',
    dateStr?: string,
    timeStr?: string
  ): Promise<TransactionRecord> {
    if (advanceAmount <= 0) {
      throw new BusinessIntegrityError('အကြိုငွေပမာဏသည် ၀ ထက် ကြီးရပါမည်', 'INVALID_AMOUNT');
    }

    return this.database.transaction(
      'rw',
      [this.database.transactions, this.database.suppliers, this.database.auditLogs, this.database.cashMovements, this.database.dailyClosings],
      async () => {
        const now = new Date();
        const date = dateStr || now.toISOString().split('T')[0];
        const time = timeStr || now.toTimeString().slice(0, 5);

        const closing = await this.database.dailyClosings.get(`closing_${date}`);
        if (closing && closing.status === 'CLOSED') {
          throw new DailyClosingLockedError(date, 'အကြိုငွေထုတ်ပေးခြင်း');
        }

        const supplier = await this.database.suppliers.get(supplierId);
        if (!supplier) {
          throw new EntityNotFoundError('Supplier', supplierId);
        }

        const advanceMMK = roundMMK(advanceAmount);
        const prevBalance = roundMMK(supplier.currentAdvanceBalance || 0);
        const newBalance = moneyAdd(prevBalance, advanceMMK);

        const updatedSupplier: Supplier = {
          ...supplier,
          currentAdvanceBalance: newBalance,
          totalAdvanceGiven: moneyAdd(supplier.totalAdvanceGiven || (supplier as any).totalAdvancesGiven || 0, advanceMMK),
          updatedAt: now.toISOString(),
        };
        await this.database.suppliers.put(updatedSupplier);

        // Record Transaction
        const tx: TransactionRecord = {
          id: generateStableId('tx_adv'),
          voucherNo: generateVoucherNo('ADV', date),
          supplierId,
          supplierName: supplier.name,
          supplierVillage: supplier.village,
          date,
          time,
          type: 'ADVANCE_ONLY',
          items: [],
          totalGoodsValue: 0,
          previousAdvanceBalance: prevBalance,
          advanceDeducted: 0,
          newAdvanceTaken: advanceMMK,
          newAdvanceReason: reason,
          remainingAdvanceBalance: newBalance,
          status: 'COMPLETED',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        await this.database.transactions.put(tx);

        // Record Cash Movement in Cash Ledger
        const cashId = generateStableId('csh');
        const idempotencyKey = buildCashIdempotencyKey('SUPPLIER_ADVANCE_GIVEN', tx.id);
        await this.database.cashMovements.put({
          id: cashId,
          amount: Math.abs(advanceMMK),
          direction: 'OUT',
          signedAmount: -Math.abs(advanceMMK),
          type: 'SUPPLIER_ADVANCE_GIVEN',
          typeLabelMy: getCashMovementTypeLabel('SUPPLIER_ADVANCE_GIVEN'),
          referenceType: 'SUPPLIER_ADVANCE',
          referenceId: tx.id,
          referenceVoucherNo: tx.voucherNo,
          counterpartName: supplier.name,
          paymentMethod: 'CASH',
          description: `အကြိုငွေထုတ်ပေးမှု: ${supplier.name} (${supplier.village || ''})`,
          transactionDate: date,
          transactionTime: time,
          notes: reason,
          status: 'COMPLETED',
          idempotencyKey,
          schemaVersion: 1,
          createdAt: now.toISOString(),
        });

        // Audit Log
        const auditEntry = await recordAuditEvent(
          {
            action: 'အကြိုငွေသီးသန့် ထုတ်ပေးခြင်း (Atomic)',
            actionType: 'CASH_MOVEMENT',
            details: `${supplier.name} (${supplier.village}): အကြိုငွေ ${advanceMMK.toLocaleString()} ကျပ် | အကြောင်းပြချက်: ${reason} | လက်ကျန်: ${newBalance.toLocaleString()} ကျပ်`,
            referenceType: 'SUPPLIER_ADVANCE',
            referenceId: tx.id,
            referenceVoucherNo: tx.voucherNo,
            amount: advanceMMK,
          },
          this.database
        );

        return { ...tx, auditEntry };
      }
    );
  }

  async saveMany(records: TransactionRecord[]): Promise<void> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'ကုန်သိမ်းစာရင်းများ သိမ်းဆည်းခြင်း');
    await this.database.transactions.bulkPut(records);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_FINANCIAL_RECORD', 'ကုန်သိမ်းငွေစာရင်း ဖျက်ပစ်ခြင်း');
    await this.database.transactions.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ကုန်သိမ်းငွေစာရင်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.transactions.clear();
  }

  async count(): Promise<number> {
    return this.database.transactions.count();
  }
}

/**
 * Internal logic for executing a sale within an existing or newly scoped atomic Dexie transaction.
 * Caller must perform permission checks prior to opening the database transaction.
 */
export async function executeProcessSaleAtomicInternal(
  database: ShweLetYarDatabase,
  sale: SaleRecord
): Promise<SaleRecord> {
  const saleDate = sale.date || new Date().toISOString().slice(0, 10);
  const closing = await database.dailyClosings.get(`closing_${saleDate}`);
  if (closing && closing.status === 'CLOSED') {
    throw new DailyClosingLockedError(saleDate, 'အရောင်းဘောင်ချာသွင်းခြင်း');
  }

  // 1. Idempotency check
  if (sale.id) {
    const existing = await database.sales.get(sale.id);
    if (existing && existing.status !== 'CANCELLED') {
      throw new IdempotencyConflictError(`Sale voucher ID "${sale.id}" has already been recorded.`);
    }
  }

  // 2. Validate merchant (or auto-create / reuse within same atomic transaction)
  const now = new Date().toISOString();
  let merchant: Merchant | undefined;
  if (sale.merchantId && sale.merchantId !== '__NEW__') {
    merchant = await database.merchants.get(sale.merchantId);
    if (!merchant && !sale.merchantName?.trim()) {
      throw new EntityNotFoundError('Merchant', sale.merchantId);
    }
  }

  const merchantNameTrimmed = (sale.merchantName || '').trim();
  if (!merchant && (sale.merchantId === '__NEW__' || merchantNameTrimmed)) {
    if (merchantNameTrimmed) {
      // Check if existing merchant matches name (case-insensitive, trimmed)
      const allMerchants = await database.merchants.toArray();
      const existing = allMerchants.find(
        (m) => m.name.trim().toLowerCase() === merchantNameTrimmed.toLowerCase()
      );

      if (existing) {
        merchant = existing;
      } else {
        const newMerchantId = (sale.merchantId && sale.merchantId !== '__NEW__') ? sale.merchantId : generateStableId('merch');
        const merchCode = `M-${String(allMerchants.length + 1).padStart(3, '0')}`;
        const newMerchant: Merchant = {
          id: newMerchantId,
          code: merchCode,
          name: merchantNameTrimmed,
          town: (sale.merchantTown || 'အထွေထွေ').trim(),
          phone: (sale.merchantPhone || (sale as any).driverPhone || '').trim(),
          currentReceivableBalance: 0,
          receivableBalance: 0,
          totalPurchasesValue: 0,
          totalPaidAmount: 0,
          createdAt: now,
          updatedAt: now,
        };
        await database.merchants.put(newMerchant);

        await recordAuditEvent(
          {
            action: 'ကုန်သည် အသစ်ထည့်သွင်းခြင်း (Auto-created on Sale)',
            actionType: 'CREATE_MERCHANT',
            details: `${newMerchant.name} (${newMerchant.town}) - အရောင်းဘောင်ချာဖွင့်စဉ် အလိုအလျောက် ထည့်သွင်းခဲ့သည်`,
            referenceType: 'MERCHANT',
            referenceId: newMerchant.id,
          },
          database
        );

        merchant = newMerchant;
      }
    }
  }

  const grandTotalVal = roundMMK(sale.grandTotal ?? sale.totalAmount ?? 0);
  const paidVal = roundMMK(sale.cashPaidByMerchant ?? sale.paidAmount ?? 0);

  const enrichedSale: SaleRecord = {
    ...sale,
    id: sale.id || generateStableId('sale'),
    voucherNo: sale.voucherNo || generateVoucherNo('SALE', sale.date),
    merchantId: merchant?.id || sale.merchantId,
    merchantName: merchant?.name || sale.merchantName,
    merchantTown: merchant?.town || sale.merchantTown,
    grandTotal: grandTotalVal,
    totalAmount: grandTotalVal,
    paidAmount: paidVal,
    cashPaidByMerchant: paidVal,
    remainingReceivableBalance: sale.remainingReceivableBalance !== undefined ? roundMMK(sale.remainingReceivableBalance) : undefined,
    status: 'COMPLETED',
    createdAt: sale.createdAt || now,
    updatedAt: now,
    revision: (sale.revision || 0) + 1,
  };

  // 3. Validate products & decrement inventory & record ledger movement
  if (Array.isArray(sale.items) && sale.items.length > 0) {
    for (const item of sale.items) {
      if (!item.productId) continue;
      const product = await database.products.get(item.productId);
      if (!product) {
        throw new EntityNotFoundError('Product', item.productId);
      }
      const currentStock = product.currentStock ?? product.openingStock ?? 0;
      const newStock = currentStock - (item.quantity || 0);
      await database.products.update(item.productId, {
        currentStock: newStock,
        updatedAt: now,
      });

      // Write stock movement ledger
      const mvId = generateStableId('mv');
      const unitPrice = roundMMK(item.unitPrice || 0);
      const totalVal = roundMMK(moneyMul(item.quantity || 0, unitPrice));
      await database.stockMovements.put({
        id: mvId,
        productId: item.productId,
        productName: product.name,
        movementType: 'MERCHANT_OUTBOUND',
        quantity: item.quantity || 0,
        direction: 'OUT',
        signedQuantity: -(item.quantity || 0),
        referenceType: 'SALE',
        referenceId: enrichedSale.id,
        referenceVoucherNo: enrichedSale.voucherNo,
        counterpartName: sale.merchantName || merchant?.name || 'ကုန်သည်',
        unitPrice,
        totalValue: totalVal,
        transactionDate: sale.date || now.slice(0, 10),
        transactionTime: sale.time,
        createdAt: now,
        status: 'COMPLETED',
        idempotencyKey: `SALE_${enrichedSale.id}_${item.productId}`,
        schemaVersion: 1,
      });
    }
  }

  // 4. Update merchant receivable balance & totals
  if (merchant) {
    const currentBal = roundMMK((merchant as any).currentBalance ?? merchant.currentReceivableBalance ?? merchant.receivableBalance ?? 0);
    const remainingVal = enrichedSale.remainingReceivableBalance !== undefined
      ? enrichedSale.remainingReceivableBalance
      : moneySub(moneyAdd(currentBal, grandTotalVal), paidVal);
    enrichedSale.remainingReceivableBalance = remainingVal;

    const updatedMerchant: Merchant = {
      ...merchant,
      currentReceivableBalance: remainingVal,
      receivableBalance: remainingVal,
      totalPurchasesValue: moneyAdd(merchant.totalPurchasesValue || 0, grandTotalVal),
      totalPaidAmount: moneyAdd(merchant.totalPaidAmount || 0, paidVal),
      updatedAt: now,
    };
    await database.merchants.put(updatedMerchant);
  }

  // 5. Cash Ledger Recording
  if (paidVal > 0) {
    const cashId = generateStableId('csh');
    const idempotencyKey = buildCashIdempotencyKey('SALE_PAYMENT_IN', enrichedSale.id);
    await database.cashMovements.put({
      id: cashId,
      amount: Math.abs(paidVal),
      direction: 'IN',
      signedAmount: Math.abs(paidVal),
      type: 'SALE_PAYMENT_IN',
      typeLabelMy: getCashMovementTypeLabel('SALE_PAYMENT_IN'),
      referenceType: 'SALE',
      referenceId: enrichedSale.id,
      referenceVoucherNo: enrichedSale.voucherNo,
      counterpartName: sale.merchantName || merchant?.name || 'ကုန်သည်',
      paymentMethod: sale.paymentMethod || 'CASH',
      description: `အရောင်းရငွေ: ${sale.merchantName || merchant?.name || 'ကုန်သည်'} (ဘောင်ချာ ${enrichedSale.voucherNo})`,
      transactionDate: sale.date || now.slice(0, 10),
      transactionTime: sale.time || now.slice(11, 16),
      notes: sale.notes,
      status: 'COMPLETED',
      idempotencyKey,
      schemaVersion: 1,
      createdAt: now,
    });
  }

  // 6. Save sale record
  await database.sales.put(enrichedSale);

  // 7. Audit Log
  const remainingVal = enrichedSale.remainingReceivableBalance ?? (enrichedSale as any).remainingBalance ?? 0;

  const auditEntry = await recordAuditEvent(
    {
      action: 'အရောင်းဘောင်ချာ ထုတ်ယူခြင်း (Atomic)',
      actionType: 'SALE',
      details: `ဘောင်ချာ ${enrichedSale.voucherNo} - ${sale.merchantName}: ကျသင့်ငွေ ${grandTotalVal.toLocaleString()} ကျပ် | ပေးငွေ: ${paidVal.toLocaleString()} ကျပ် | ကျန်ငွေ: ${remainingVal.toLocaleString()} ကျပ်`,
      referenceType: 'SALE',
      referenceId: enrichedSale.id,
      referenceVoucherNo: enrichedSale.voucherNo,
      amount: grandTotalVal,
      timestamp: `${sale.date} ${sale.time || ''}`.trim() || now,
    },
    database
  );

  return { ...enrichedSale, auditEntry };
}

export class SaleRepository implements ISaleRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<SaleRecord[]> {
    return this.database.sales.reverse().sortBy('date');
  }

  async getById(id: string): Promise<SaleRecord | undefined> {
    return this.database.sales.get(id);
  }

  async getByMerchant(merchantId: string): Promise<SaleRecord[]> {
    return this.database.sales.where('merchantId').equals(merchantId).toArray();
  }

  async getByDate(date: string): Promise<SaleRecord[]> {
    return this.database.sales.where('date').equals(date).toArray();
  }

  async save(sale: SaleRecord): Promise<string> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'အရောင်းမှတ်တမ်း သိမ်းဆည်းခြင်း');
    await this.database.sales.put(sale);
    return sale.id;
  }

  /**
   * Atomic Outbound Sale & Inventory Deduction & Merchant Balance Update
   * Guarantees ACID all-or-nothing execution:
   * 1. Idempotency / Duplicate Check
   * 2. Validates merchant and all products
   * 3. Decrements inventory for sold items
   * 4. Updates merchant receivable balance and aggregates
   * 5. Inserts sale record with completed status
   * 6. Appends audit log
   */
  async saveSaleAtomic(sale: SaleRecord): Promise<SaleRecord> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'အရောင်းဘောင်ချာ ထုတ်ယူခြင်း');
    if (sale.merchantId === '__NEW__' || (!sale.merchantId && sale.merchantName?.trim())) {
      await enforcePermission('MANAGE_MASTER_DATA', 'ဝယ်ယူသူ/ကုန်သည် မာစတာဒေတာ သိမ်းဆည်းခြင်း');
    }
    return this.database.transaction(
      'rw',
      [
        this.database.sales,
        this.database.merchants,
        this.database.products,
        this.database.auditLogs,
        this.database.stockMovements,
        this.database.cashMovements,
        this.database.dailyClosings,
      ],
      async () => {
        return executeProcessSaleAtomicInternal(this.database, sale);
      }
    );
  }

  /**
   * Atomic Sale Cancellation
   * 1. Restores product inventory for all sold items
   * 2. Reverses merchant debt and purchase aggregates
   * 3. Reverses cash received with compensating cash ledger entry
   * 4. Marks sale as CANCELLED
   * 5. Appends reversal stock movements to ledger
   * 6. Logs audit entry
   */
  async cancelSaleAtomic(saleId: string, reason: string = 'သုံးစွဲသူမှ ပယ်ဖျက်သည်'): Promise<SaleRecord> {
    await enforcePermission('VOID_TRANSACTION', 'အရောင်းမှတ်တမ်း ပယ်ဖျက်ခြင်း');
    return this.database.transaction(
      'rw',
      [
        this.database.sales,
        this.database.merchants,
        this.database.products,
        this.database.auditLogs,
        this.database.stockMovements,
        this.database.cashMovements,
      ],
      async () => {
        const sale = await this.database.sales.get(saleId);
        if (!sale) {
          throw new EntityNotFoundError('Sale', saleId);
        }
        if (sale.status === 'CANCELLED') {
          throw new InvalidStateTransitionError('ဤအရောင်းဘောင်ချာအား ဖျက်သိမ်းပြီးဖြစ်ပါသည်');
        }

        const now = new Date().toISOString();

        // 1. Restore product inventory & record ledger reversal
        if (Array.isArray(sale.items)) {
          for (const item of sale.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (product) {
              const currentStock = product.currentStock ?? product.openingStock ?? 0;
              const newStock = currentStock + (item.quantity || 0);
              await this.database.products.update(item.productId, {
                currentStock: newStock,
                updatedAt: now,
              });

              const unitPrice = roundMMK(item.unitPrice || 0);
              const totalVal = roundMMK(moneyMul(item.quantity || 0, unitPrice));
              await this.database.stockMovements.put({
                id: generateStableId('mv'),
                productId: item.productId,
                productName: product.name,
                movementType: 'SALE_CANCELLED_REVERSAL',
                quantity: item.quantity || 0,
                direction: 'IN',
                signedQuantity: item.quantity || 0,
                referenceType: 'SALE',
                referenceId: sale.id,
                referenceVoucherNo: sale.voucherNo,
                counterpartName: sale.merchantName,
                unitPrice,
                totalValue: totalVal,
                transactionDate: now.slice(0, 10),
                transactionTime: now.slice(11, 16),
                createdAt: now,
                reason,
                status: 'COMPLETED',
                idempotencyKey: `SALE_REV_${sale.id}_${item.productId}`,
                schemaVersion: 1,
              });
            }
          }
        }

        // 2. Compensating Cash Ledger Reversal
        const rawPaid = sale.cashPaidByMerchant ?? sale.paidAmount ?? 0;
        const paidAmount = roundMMK(rawPaid);
        if (paidAmount > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('SALE_CANCELLED_CASH_REVERSAL', sale.id);
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(paidAmount),
            direction: 'OUT',
            signedAmount: -Math.abs(paidAmount),
            type: 'SALE_CANCELLED_CASH_REVERSAL',
            typeLabelMy: getCashMovementTypeLabel('SALE_CANCELLED_CASH_REVERSAL'),
            referenceType: 'SALE',
            referenceId: sale.id,
            referenceVoucherNo: sale.voucherNo,
            counterpartName: sale.merchantName,
            paymentMethod: sale.paymentMethod || 'CASH',
            description: `အရောင်းဖျက်သိမ်းငွေပြန်ထုတ် (Reversal): ${sale.merchantName} (ဘောင်ချာ ${sale.voucherNo || sale.id})`,
            transactionDate: now.slice(0, 10),
            transactionTime: now.slice(11, 16),
            reversalOf: sale.id,
            notes: reason,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        // 3. Reverse merchant balance
        if (sale.merchantId) {
          const merchant = await this.database.merchants.get(sale.merchantId);
          if (merchant) {
            const grandTotalVal = roundMMK(sale.grandTotal ?? sale.totalAmount ?? 0);
            const unpaidAmountOnThisSale = Math.max(0, moneySub(grandTotalVal, paidAmount));
            const newReceivable = Math.max(0, moneySub(merchant.currentReceivableBalance || 0, unpaidAmountOnThisSale));
            const updatedMerchant: Merchant = {
              ...merchant,
              currentReceivableBalance: newReceivable,
              totalPurchasesValue: Math.max(0, moneySub(merchant.totalPurchasesValue || 0, grandTotalVal)),
              totalPaidAmount: Math.max(0, moneySub(merchant.totalPaidAmount || 0, paidAmount)),
              updatedAt: now,
            };
            await this.database.merchants.put(updatedMerchant);
          }
        }

        // 4. Mark sale as CANCELLED
        const cancelledSale: SaleRecord = {
          ...sale,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: now,
          updatedAt: now,
        };
        await this.database.sales.put(cancelledSale);

        // 5. Audit Log
        const auditEntry = await recordAuditEvent(
          {
            action: 'အရောင်းဘောင်ချာ ပြန်လည်ဖျက်သိမ်းခြင်း (Atomic Rollback)',
            actionType: 'REVERSAL',
            details: `ဘောင်ချာ ${sale.voucherNo || sale.id} (${sale.merchantName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
            referenceType: 'SALE',
            referenceId: sale.id,
            referenceVoucherNo: sale.voucherNo,
            amount: sale.grandTotal || 0,
          },
          this.database
        );

        return { ...cancelledSale, auditEntry };
      }
    );
  }

  /**
   * Atomic Soft Delete for Sale Record
   */
  async softDeleteSaleAtomic(saleId: string, reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်'): Promise<SoftDeletedItem> {
    return softDeleteSaleAtomic(saleId, reason, this.database);
  }

  async saveMany(sales: SaleRecord[]): Promise<void> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'အရောင်းမှတ်တမ်းများ သိမ်းဆည်းခြင်း');
    await this.database.sales.bulkPut(sales);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_FINANCIAL_RECORD', 'အရောင်းငွေစာရင်း ဖျက်ပစ်ခြင်း');
    await this.database.sales.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'အရောင်းငွေစာရင်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.sales.clear();
  }

  async count(): Promise<number> {
    return this.database.sales.count();
  }
}

export class MerchantPurchaseRepository implements IMerchantPurchaseRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<MerchantPurchaseRecord[]> {
    return this.database.merchantPurchases.reverse().sortBy('date');
  }

  async getById(id: string): Promise<MerchantPurchaseRecord | undefined> {
    return this.database.merchantPurchases.get(id);
  }

  async getByMerchant(merchantId: string): Promise<MerchantPurchaseRecord[]> {
    return this.database.merchantPurchases.where('merchantId').equals(merchantId).toArray();
  }

  async save(purchase: MerchantPurchaseRecord): Promise<string> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'ကုန်ကြမ်းဝယ်ယူမှု သိမ်းဆည်းခြင်း');
    await this.database.merchantPurchases.put(purchase);
    return purchase.id;
  }

  /**
   * Atomic Raw Material Purchase from Merchant
   */
  async savePurchaseAtomic(purchase: MerchantPurchaseRecord): Promise<MerchantPurchaseRecord> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'ကုန်ကြမ်းဝယ်ယူမှု စာရင်းသွင်းခြင်း');
    if (purchase.merchantId === '__NEW__' || (!purchase.merchantId && purchase.merchantName?.trim())) {
      await enforcePermission('MANAGE_MASTER_DATA', 'ဝယ်ယူသူ/ကုန်သည် မာစတာဒေတာ သိမ်းဆည်းခြင်း');
    }
    return this.database.transaction(
      'rw',
      [
        this.database.merchantPurchases,
        this.database.merchants,
        this.database.products,
        this.database.auditLogs,
        this.database.stockMovements,
        this.database.cashMovements,
      ],
      async () => {
        // Idempotency check
        if (purchase.id) {
          const existing = await this.database.merchantPurchases.get(purchase.id);
          if (existing && existing.status !== 'CANCELLED') {
            throw new IdempotencyConflictError(`Purchase ID "${purchase.id}" already processed.`);
          }
        }

        const now = new Date().toISOString();
        let merchant = (purchase.merchantId && purchase.merchantId !== '__NEW__') ? await this.database.merchants.get(purchase.merchantId) : undefined;
        if (!merchant) {
          const merchantNameTrimmed = (purchase.merchantName || 'အမည်မသိ ကုန်သည်').trim();
          const allMerchants = await this.database.merchants.toArray();
          const existing = allMerchants.find(
            (m) => m.name.trim().toLowerCase() === merchantNameTrimmed.toLowerCase()
          );

          if (existing) {
            merchant = existing;
            const currentPayable = merchant.payableBalance || 0;
            const updatedPayable = currentPayable + (purchase.remainingPayableBalance || 0);
            await this.database.merchants.update(merchant.id, {
              payableBalance: updatedPayable,
              totalPurchasedFromMerchant: (merchant.totalPurchasedFromMerchant || 0) + (purchase.totalAmount || 0),
              updatedAt: now,
            });
          } else {
            const newMerchantId = (purchase.merchantId && purchase.merchantId !== '__NEW__') ? purchase.merchantId : generateStableId('merch');
            const merchCode = `M-${String(allMerchants.length + 1).padStart(3, '0')}`;
            merchant = {
              id: newMerchantId,
              code: merchCode,
              name: merchantNameTrimmed,
              town: (purchase.merchantTown || 'အထွေထွေ').trim(),
              phone: (purchase.sellerPhone || '').trim(),
              role: 'SUPPLIER',
              payableBalance: purchase.remainingPayableBalance || 0,
              totalPurchasedFromMerchant: purchase.totalAmount || 0,
              currentReceivableBalance: 0,
              totalPurchasesValue: 0,
              totalPaidAmount: 0,
              createdAt: now,
              updatedAt: now,
            };
            await this.database.merchants.put(merchant);

            await recordAuditEvent(
              {
                action: 'ကုန်သည် အသစ်ထည့်သွင်းခြင်း (Auto-created on Purchase)',
                actionType: 'CREATE_MERCHANT',
                details: `${merchant.name} (${merchant.town}) - ကုန်ကြမ်းဝယ်ယူမှုသွင်းစဉ် အလိုအလျောက် ထည့်သွင်းခဲ့သည်`,
                referenceType: 'MERCHANT',
                referenceId: merchant.id,
              },
              this.database
            );
          }
        } else {
          const currentPayable = roundMMK(merchant.payableBalance || 0);
          const remPayable = roundMMK(purchase.remainingPayableBalance || 0);
          const totalAmt = roundMMK(purchase.totalAmount || 0);
          const updatedPayable = moneyAdd(currentPayable, remPayable);
          await this.database.merchants.update(merchant.id, {
            payableBalance: updatedPayable,
            totalPurchasedFromMerchant: moneyAdd(merchant.totalPurchasedFromMerchant || 0, totalAmt),
            updatedAt: now,
          });
        }

        const totalAmt = roundMMK(purchase.totalAmount || 0);
        const paidAmt = roundMMK(purchase.paidAmount || 0);
        const remPayable = roundMMK(purchase.remainingPayableBalance || 0);

        const enrichedPurchase: MerchantPurchaseRecord = {
          ...purchase,
          id: purchase.id || generateStableId('pur'),
          merchantId: merchant.id,
          purchaseNo: purchase.purchaseNo || generateVoucherNo('PUR', purchase.date),
          totalAmount: totalAmt,
          paidAmount: paidAmt,
          remainingPayableBalance: remPayable,
          status: 'COMPLETED',
          createdAt: purchase.createdAt || now,
          updatedAt: now,
          revision: (purchase.revision || 0) + 1,
        };

        // Update product inventory and record stock movements for purchase items
        if (Array.isArray(purchase.items) && purchase.items.length > 0) {
          for (const item of purchase.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (product) {
              const currentStock = product.currentStock ?? product.openingStock ?? 0;
              const newStock = currentStock + (item.quantity || 0);
              await this.database.products.update(item.productId, {
                currentStock: newStock,
                updatedAt: now,
              });

              const unitPrice = roundMMK(item.unitPrice || 0);
              const totalVal = roundMMK(moneyMul(item.quantity || 0, unitPrice));
              await this.database.stockMovements.put({
                id: generateStableId('mv'),
                productId: item.productId,
                productName: product.name,
                movementType: 'MERCHANT_PURCHASE_INBOUND',
                quantity: item.quantity || 0,
                direction: 'IN',
                signedQuantity: item.quantity || 0,
                referenceType: 'PURCHASE',
                referenceId: enrichedPurchase.id,
                referenceVoucherNo: enrichedPurchase.purchaseNo,
                counterpartName: purchase.merchantName || merchant.name,
                unitPrice,
                totalValue: totalVal,
                transactionDate: purchase.date || now.slice(0, 10),
                transactionTime: purchase.time,
                createdAt: now,
                status: 'COMPLETED',
                idempotencyKey: `PUR_${enrichedPurchase.id}_${item.productId}`,
                schemaVersion: 1,
              });
            }
          }
        }

        // Record Cash Ledger Movement
        if (paidAmt > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('MERCHANT_PURCHASE_PAYOUT', enrichedPurchase.id);
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(paidAmt),
            direction: 'OUT',
            signedAmount: -Math.abs(paidAmt),
            type: 'MERCHANT_PURCHASE_PAYOUT',
            typeLabelMy: getCashMovementTypeLabel('MERCHANT_PURCHASE_PAYOUT'),
            referenceType: 'PURCHASE',
            referenceId: enrichedPurchase.id,
            referenceVoucherNo: enrichedPurchase.purchaseNo,
            counterpartName: purchase.merchantName || merchant.name,
            paymentMethod: purchase.paymentMethod || 'CASH',
            description: `ကုန်ကြမ်းဝယ်ယူငွေပေးချေမှု: ${purchase.merchantName || merchant.name} (ဘောင်ချာ ${enrichedPurchase.purchaseNo})`,
            transactionDate: purchase.date || now.slice(0, 10),
            transactionTime: purchase.time || now.slice(11, 16),
            notes: purchase.notes,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        await this.database.merchantPurchases.put(enrichedPurchase);

        const auditEntry = await recordAuditEvent(
          {
            action: 'ကုန်ကြမ်းဝယ်ယူမှု စာရင်းသွင်းခြင်း (Atomic)',
            actionType: 'PURCHASE',
            details: `ဘောင်ချာ ${enrichedPurchase.purchaseNo} - ${purchase.merchantName}: စုစုပေါင်း ${totalAmt.toLocaleString()} ကျပ် | ပေးရန်ကျန်: ${remPayable.toLocaleString()} ကျပ်`,
            referenceType: 'PURCHASE',
            referenceId: enrichedPurchase.id,
            referenceVoucherNo: enrichedPurchase.purchaseNo,
            amount: totalAmt,
            timestamp: `${purchase.date} ${purchase.time || ''}`.trim() || now,
          },
          this.database
        );

        return { ...enrichedPurchase, auditEntry };
      }
    );
  }

  /**
   * Atomic Purchase Cancellation
   */
  async cancelPurchaseAtomic(purchaseId: string, reason: string = 'သုံးစွဲသူမှ ပယ်ဖျက်သည်'): Promise<MerchantPurchaseRecord> {
    await enforcePermission('VOID_TRANSACTION', 'ကုန်ဝယ်မှတ်တမ်း ပယ်ဖျက်ခြင်း');
    return this.database.transaction(
      'rw',
      [
        this.database.merchantPurchases,
        this.database.merchants,
        this.database.products,
        this.database.auditLogs,
        this.database.stockMovements,
        this.database.cashMovements,
      ],
      async () => {
        const purchase = await this.database.merchantPurchases.get(purchaseId);
        if (!purchase) {
          throw new EntityNotFoundError('Purchase', purchaseId);
        }
        if (purchase.status === 'CANCELLED') {
          throw new InvalidStateTransitionError('ဤကုန်ကြမ်းဝယ်ယူမှုစာရင်းအား ဖျက်သိမ်းပြီးဖြစ်ပါသည်');
        }

        const now = new Date().toISOString();

        const merchant = await this.database.merchants.get(purchase.merchantId);
        if (merchant) {
          const remPayable = roundMMK(purchase.remainingPayableBalance || 0);
          const totalAmt = roundMMK(purchase.totalAmount || 0);
          const newPayable = Math.max(0, moneySub(merchant.payableBalance || 0, remPayable));
          const newTotalPurchased = Math.max(0, moneySub(merchant.totalPurchasedFromMerchant || 0, totalAmt));
          await this.database.merchants.update(purchase.merchantId, {
            payableBalance: newPayable,
            totalPurchasedFromMerchant: newTotalPurchased,
            updatedAt: now,
          });
        }

        // Revert product stock and record ledger reversal
        if (Array.isArray(purchase.items) && purchase.items.length > 0) {
          for (const item of purchase.items) {
            if (!item.productId) continue;
            const product = await this.database.products.get(item.productId);
            if (product) {
              const currentStock = product.currentStock ?? product.openingStock ?? 0;
              const newStock = Math.max(0, currentStock - (item.quantity || 0));
              await this.database.products.update(item.productId, {
                currentStock: newStock,
                updatedAt: now,
              });

              const unitPrice = roundMMK(item.unitPrice || 0);
              const totalVal = roundMMK(moneyMul(item.quantity || 0, unitPrice));
              await this.database.stockMovements.put({
                id: generateStableId('mv'),
                productId: item.productId,
                productName: product.name,
                movementType: 'PURCHASE_CANCELLED_REVERSAL',
                quantity: item.quantity || 0,
                direction: 'OUT',
                signedQuantity: -(item.quantity || 0),
                referenceType: 'PURCHASE',
                referenceId: purchase.id,
                referenceVoucherNo: purchase.purchaseNo,
                counterpartName: purchase.merchantName,
                unitPrice,
                totalValue: totalVal,
                transactionDate: now.slice(0, 10),
                transactionTime: now.slice(11, 16),
                createdAt: now,
                reason,
                status: 'COMPLETED',
                idempotencyKey: `PUR_REV_${purchase.id}_${item.productId}`,
                schemaVersion: 1,
              });
            }
          }
        }

        // Compensating Cash Ledger Reversal
        const rawPaid = purchase.paidAmount || 0;
        const paidAmount = roundMMK(rawPaid);
        if (paidAmount > 0) {
          const cashId = generateStableId('csh');
          const idempotencyKey = buildCashIdempotencyKey('PURCHASE_CANCELLED_CASH_REVERSAL', purchase.id);
          await this.database.cashMovements.put({
            id: cashId,
            amount: Math.abs(paidAmount),
            direction: 'IN',
            signedAmount: Math.abs(paidAmount),
            type: 'PURCHASE_CANCELLED_CASH_REVERSAL',
            typeLabelMy: getCashMovementTypeLabel('PURCHASE_CANCELLED_CASH_REVERSAL'),
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            referenceVoucherNo: purchase.purchaseNo,
            counterpartName: purchase.merchantName,
            paymentMethod: purchase.paymentMethod || 'CASH',
            description: `ကုန်ကြမ်းဝယ်ယူမှုဖျက်သိမ်းငွေပြန်ရ (Reversal): ${purchase.merchantName} (ဘောင်ချာ ${purchase.purchaseNo || purchase.id})`,
            transactionDate: now.slice(0, 10),
            transactionTime: now.slice(11, 16),
            reversalOf: purchase.id,
            notes: reason,
            status: 'COMPLETED',
            idempotencyKey,
            schemaVersion: 1,
            createdAt: now,
          });
        }

        const cancelledPurchase: MerchantPurchaseRecord = {
          ...purchase,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: now,
          updatedAt: now,
        };
        await this.database.merchantPurchases.put(cancelledPurchase);

        const auditEntry = await recordAuditEvent(
          {
            action: 'ကုန်ကြမ်းဝယ်ယူမှု ပြန်လည်ဖျက်သိမ်းခြင်း (Atomic Rollback)',
            actionType: 'REVERSAL',
            details: `ဘောင်ချာ ${purchase.purchaseNo} (${purchase.merchantName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            referenceVoucherNo: purchase.purchaseNo,
            amount: purchase.totalAmount || 0,
          },
          this.database
        );

        return { ...cancelledPurchase, auditEntry };
      }
    );
  }

  async saveMany(purchases: MerchantPurchaseRecord[]): Promise<void> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'ကုန်ကြမ်းဝယ်ယူမှုများ သိမ်းဆည်းခြင်း');
    await this.database.merchantPurchases.bulkPut(purchases);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_FINANCIAL_RECORD', 'ကုန်ဝယ်ငွေစာရင်း ဖျက်ပစ်ခြင်း');
    await this.database.merchantPurchases.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ကုန်ဝယ်ငွေစာရင်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.merchantPurchases.clear();
  }

  async count(): Promise<number> {
    return this.database.merchantPurchases.count();
  }
}

export class OrderRepository implements IOrderRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<MerchantOrder[]> {
    return this.database.orders.toArray();
  }

  async getById(id: string): Promise<MerchantOrder | undefined> {
    return this.database.orders.get(id);
  }

  async getByStatus(status: string): Promise<MerchantOrder[]> {
    return this.database.orders.where('status').equals(status).toArray();
  }

  async save(order: MerchantOrder): Promise<string> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'အော်ဒါမှတ်တမ်း သိမ်းဆည်းခြင်း');

    if (order.id) {
      const existing = await this.database.orders.get(order.id);
      if (existing) {
        if (existing.status === 'DELIVERED' && order.status !== 'DELIVERED') {
          throw new InvalidStateTransitionError('ပို့ဆောင်ပြီးသော အော်ဒါ၏ အခြေအနေအား ပြန်လည်ပြောင်းလဲ၍ မရပါ (Cannot revert DELIVERED order)');
        }
        if (existing.status === 'CANCELLED' && order.status !== 'CANCELLED') {
          throw new InvalidStateTransitionError('ပယ်ဖျက်ပြီးသော အော်ဒါ၏ အခြေအနေအား ပြန်လည်ပြောင်းလဲ၍ မရပါ (Cannot revert CANCELLED order)');
        }
        if (existing.status === 'PENDING' && order.status === 'DELIVERED' && !order.saleVoucherId) {
          throw new InvalidStateTransitionError('အော်ဒါအား အရောင်းဘောင်ချာ မပါဘဲ တိုက်ရိုက် ပို့ဆောင်ပြီးအဖြစ် သတ်မှတ်၍ မရပါ (Use completeOrderAtomic)');
        }
      }
    } else {
      if (order.status === 'DELIVERED' && !order.saleVoucherId) {
        throw new InvalidStateTransitionError('အော်ဒါအသစ်အား အရောင်းဘောင်ချာ မပါဘဲ တိုက်ရိုက် ပို့ဆောင်ပြီးအဖြစ် သတ်မှတ်၍ မရပါ');
      }
    }

    const now = new Date().toISOString();
    const toSave: MerchantOrder = {
      ...order,
      id: order.id || generateStableId('ord'),
      orderNo: order.orderNo || order.orderNumber || generateVoucherNo('ORD', order.orderDate || order.date),
      createdAt: order.createdAt || now,
    };
    await this.database.orders.put(toSave);
    return toSave.id;
  }

  /**
   * Atomic Order Completion & Sale Conversion
   */
  async completeOrderAtomic(orderId: string, saleRecord?: SaleRecord): Promise<MerchantOrder> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'အော်ဒါ ပို့ဆောင်ပြီးစီးခြင်း');
    if (saleRecord) {
      await enforcePermission('OPERATIONAL_DATA_ENTRY', 'အရောင်းဘောင်ချာ ထုတ်ယူခြင်း');
      if (saleRecord.merchantId === '__NEW__' || (!saleRecord.merchantId && saleRecord.merchantName?.trim())) {
        await enforcePermission('MANAGE_MASTER_DATA', 'ဝယ်ယူသူ/ကုန်သည် မာစတာဒေတာ သိမ်းဆည်းခြင်း');
      }
    }
    return this.database.transaction(
      'rw',
      [
        this.database.orders,
        this.database.sales,
        this.database.merchants,
        this.database.products,
        this.database.auditLogs,
        this.database.stockMovements,
        this.database.cashMovements,
        this.database.dailyClosings,
      ],
      async () => {
        const order = await this.database.orders.get(orderId);
        if (!order) {
          throw new EntityNotFoundError('Order', orderId);
        }
        if (order.status === 'DELIVERED') {
          throw new InvalidStateTransitionError('ဤအော်ဒါအား ပို့ဆောင်ပြီးအဖြစ် သတ်မှတ်ထားပြီးဖြစ်ပါသည်');
        }

        let createdSaleId: string | undefined = order.saleVoucherId;

        // If a sale record is provided for fulfillment, process sale atomically within this transaction
        if (saleRecord) {
          const savedSale = await executeProcessSaleAtomicInternal(this.database, saleRecord);
          createdSaleId = savedSale.id;
        }

        const now = new Date().toISOString();
        const updatedOrder: MerchantOrder = {
          ...order,
          status: 'DELIVERED',
          deliveredDate: now.split('T')[0],
          saleVoucherId: createdSaleId,
        };
        await this.database.orders.put(updatedOrder);

        const auditEntry = await recordAuditEvent(
          {
            action: 'အော်ဒါပို့ဆောင်ပြီးမြောက်ခြင်း (Atomic)',
            actionType: 'SALE',
            details: `အော်ဒါ ${order.orderNo || order.id} - ${order.merchantName}: အောင်မြင်စွာ ပို့ဆောင်ပြီးပါပြီ${createdSaleId ? ` (အရောင်းဘောင်ချာ ID: ${createdSaleId})` : ''}`,
            referenceType: 'ORDER',
            referenceId: order.id,
            referenceVoucherNo: order.orderNo,
          },
          this.database
        );

        return { ...updatedOrder, auditEntry };
      }
    );
  }

  async cancelOrderAtomic(orderId: string, reason: string = 'အော်ဒါပယ်ဖျက်သည်'): Promise<MerchantOrder> {
    await enforcePermission('VOID_TRANSACTION', 'အော်ဒါမှတ်တမ်း ပယ်ဖျက်ခြင်း');
    return this.database.transaction(
      'rw',
      [this.database.orders, this.database.auditLogs],
      async () => {
        const order = await this.database.orders.get(orderId);
        if (!order) {
          throw new EntityNotFoundError('Order', orderId);
        }
        if (order.status === 'DELIVERED') {
          throw new InvalidStateTransitionError('ပို့ဆောင်ပြီးသော အော်ဒါကို တိုက်ရိုက်ပယ်ဖျက်၍မရပါ');
        }

        const now = new Date().toISOString();
        const updatedOrder: MerchantOrder = {
          ...order,
          status: 'CANCELLED',
          notes: `${order.notes ? order.notes + ' | ' : ''}[ပယ်ဖျက်: ${reason}]`,
        };
        await this.database.orders.put(updatedOrder);

        const auditEntry = await recordAuditEvent(
          {
            action: 'အော်ဒါပယ်ဖျက်ခြင်း (Atomic)',
            actionType: 'REVERSAL',
            details: `အော်ဒါ ${order.orderNo || order.id} (${order.merchantName}) အား ပယ်ဖျက်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
            referenceType: 'ORDER',
            referenceId: order.id,
            referenceVoucherNo: order.orderNo,
          },
          this.database
        );

        return { ...updatedOrder, auditEntry };
      }
    );
  }

  async saveMany(orders: MerchantOrder[]): Promise<void> {
    await enforcePermission('OPERATIONAL_DATA_ENTRY', 'အော်ဒါမှတ်တမ်းများ သိမ်းဆည်းခြင်း');
    await this.database.orders.bulkPut(orders);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_FINANCIAL_RECORD', 'အော်ဒါမှတ်တမ်း ဖျက်ပစ်ခြင်း');
    await this.database.orders.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'အော်ဒါမှတ်တမ်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.orders.clear();
  }

  async count(): Promise<number> {
    return this.database.orders.count();
  }
}

export class PeerTradeRepository implements IPeerTradeRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<PeerTradeRecord[]> {
    return this.database.peerTrades.toArray();
  }

  async getById(id: string): Promise<PeerTradeRecord | undefined> {
    return this.database.peerTrades.get(id);
  }

  async save(trade: PeerTradeRecord): Promise<string> {
    await enforcePermission('STOCK_TRANSFER', 'အချင်းချင်း ကုန်ပစ္စည်း လွှဲပြောင်းဖလှယ်ခြင်း');
    await this.database.peerTrades.put(trade);
    return trade.id;
  }

  async saveTradeAtomic(trade: PeerTradeRecord): Promise<PeerTradeRecord> {
    await enforcePermission('STOCK_TRANSFER', 'အချင်းချင်း ကုန်ပစ္စည်း လွှဲပြောင်းဖလှယ်ခြင်း');
    return this.database.transaction(
      'rw',
      [this.database.peerTrades, this.database.products, this.database.auditLogs, this.database.stockMovements],
      async () => {
        let product: Product | undefined;
        // Adjust product stock accordingly
        if (trade.productId && trade.quantity) {
          product = await this.database.products.get(trade.productId);
          if (product) {
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            // BORROW_IN increases stock, LEND_OUT decreases stock
            const diff = trade.tradeType === 'BORROW_IN' ? trade.quantity : -trade.quantity;
            await this.database.products.update(trade.productId, {
              currentStock: currentStock + diff,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        const now = new Date().toISOString();
        const enrichedTrade: PeerTradeRecord = {
          ...trade,
          id: trade.id || generateStableId('peer'),
        };
        await this.database.peerTrades.put(enrichedTrade);

        // Record stock movement in ledger
        if (trade.productId && trade.quantity) {
          const isBorrowIn = trade.tradeType === 'BORROW_IN';
          const qty = Math.abs(trade.quantity);
          await this.database.stockMovements.put({
            id: generateStableId('mv'),
            productId: trade.productId,
            productName: trade.productName || product?.name || 'Unknown',
            movementType: isBorrowIn ? 'PEER_BORROW_IN' : 'PEER_LEND_OUT',
            quantity: qty,
            direction: isBorrowIn ? 'IN' : 'OUT',
            signedQuantity: isBorrowIn ? qty : -qty,
            referenceType: 'PEER_TRADE',
            referenceId: enrichedTrade.id,
            referenceVoucherNo: trade.voucherNo || `PEER-${enrichedTrade.id.slice(0, 6)}`,
            counterpartName: trade.peerShopName || 'မိတ်ဖက်ဆိုင်',
            transactionDate: trade.date || now.slice(0, 10),
            transactionTime: trade.time,
            createdAt: now,
            status: 'COMPLETED',
            idempotencyKey: `PEER_${enrichedTrade.id}`,
            schemaVersion: 1,
          });
        }

        const auditEntry = await recordAuditEvent(
          {
            action: 'မိတ်ဖက်ဆိုင် ကုန်လွှဲပြောင်းမှု (Atomic)',
            actionType: 'STOCK_MOVEMENT',
            details: `${trade.tradeType === 'BORROW_IN' ? 'အဝင်ချေးယူ' : 'အထွက်ချေးငှား'} - ${trade.productName} (${trade.quantity} ${trade.unit}) [${trade.peerShopName}]`,
            referenceType: 'PEER_TRADE',
            referenceId: enrichedTrade.id,
            referenceVoucherNo: enrichedTrade.voucherNo,
            quantity: trade.quantity,
            timestamp: `${trade.date} ${trade.time || ''}`.trim() || now,
          },
          this.database
        );

        return { ...enrichedTrade, auditEntry };
      }
    );
  }

  async saveMany(trades: PeerTradeRecord[]): Promise<void> {
    await enforcePermission('STOCK_TRANSFER', 'အချင်းချင်း ကုန်ပစ္စည်း လွှဲပြောင်းဖလှယ်ခြင်း');
    await this.database.peerTrades.bulkPut(trades);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_FINANCIAL_RECORD', 'အချင်းချင်း ကုန်ပစ္စည်းလွှဲပြောင်းမှု ဖျက်ပစ်ခြင်း');
    await this.database.peerTrades.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'အချင်းချင်း ကုန်ပစ္စည်းလွှဲပြောင်းမှုများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.peerTrades.clear();
  }

  async count(): Promise<number> {
    return this.database.peerTrades.count();
  }
}

export class StockAdjustmentRepository implements IStockAdjustmentRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<StockAdjustmentRecord[]> {
    return this.database.stockAdjustments.reverse().sortBy('date');
  }

  async getById(id: string): Promise<StockAdjustmentRecord | undefined> {
    return this.database.stockAdjustments.get(id);
  }

  async save(adj: StockAdjustmentRecord): Promise<string> {
    await enforcePermission('STOCK_ADJUSTMENT', 'ကုန်ပစ္စည်း လက်ကျန်ညှိနှိုင်းမှု ပြုလုပ်ခြင်း');
    await this.database.stockAdjustments.put(adj);
    return adj.id;
  }

  /**
   * Atomic Stock Adjustment
   * 1. Validates product exists
   * 2. Sets new stock and updates product
   * 3. Inserts adjustment record
   * 4. Logs audit entry
   */
  async saveAdjustmentAtomic(adj: StockAdjustmentRecord): Promise<StockAdjustmentRecord> {
    await enforcePermission('STOCK_ADJUSTMENT', 'ကုန်ပစ္စည်း လက်ကျန်ညှိနှိုင်းမှု ပြုလုပ်ခြင်း');
    return this.database.transaction(
      'rw',
      [this.database.stockAdjustments, this.database.products, this.database.auditLogs, this.database.stockMovements],
      async () => {
        const product = await this.database.products.get(adj.productId);
        if (!product) {
          throw new EntityNotFoundError('Product', adj.productId);
        }

        const now = new Date().toISOString();
        await this.database.products.update(adj.productId, {
          currentStock: adj.newStock,
          updatedAt: now,
          revision: (product.revision || 0) + 1,
        });

        const enrichedAdj: StockAdjustmentRecord = {
          ...adj,
          id: adj.id || generateStableId('adj'),
          status: 'COMPLETED',
          createdAt: adj.createdAt || now,
          updatedAt: now,
        };

        await this.database.stockAdjustments.put(enrichedAdj);

        // Record stock movement in ledger
        const isDamage = adj.type === 'DAMAGE';
        const isIn = adj.type === 'IN_ADJUSTMENT' || (adj.quantity > 0 && !isDamage);
        const absQty = Math.abs(Number(adj.quantity) || 0);

        await this.database.stockMovements.put({
          id: generateStableId('mv'),
          productId: adj.productId,
          productName: adj.productName || product.name,
          movementType: isDamage ? 'DAMAGE_LOSS' : isIn ? 'STOCK_ADJUSTMENT_IN' : 'STOCK_ADJUSTMENT_OUT',
          quantity: absQty,
          direction: isDamage || !isIn ? 'OUT' : 'IN',
          signedQuantity: isDamage || !isIn ? -absQty : absQty,
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: enrichedAdj.id,
          referenceVoucherNo: `ADJ-${enrichedAdj.id.slice(0, 6)}`,
          counterpartName: 'စာရင်းညှိနှိုင်းမှု (Adjustment)',
          transactionDate: adj.date || now.slice(0, 10),
          transactionTime: adj.time,
          createdAt: now,
          reason: adj.reason,
          status: 'COMPLETED',
          idempotencyKey: `ADJ_${enrichedAdj.id}`,
          schemaVersion: 1,
        });

        const auditEntry = await recordAuditEvent(
          {
            action: 'လက်ကျန်စာရင်းညှိနှိုင်းခြင်း (Atomic)',
            actionType: 'STOCK_MOVEMENT',
            details: `${adj.productName}: ${adj.previousStock} -> ${adj.newStock} (${adj.reason})`,
            referenceType: 'STOCK_ADJUSTMENT',
            referenceId: enrichedAdj.id,
            referenceVoucherNo: `ADJ-${enrichedAdj.id.slice(0, 6)}`,
            quantity: Math.abs(Number(adj.quantity) || 0),
            timestamp: `${adj.date} ${adj.time || ''}`.trim() || now,
          },
          this.database
        );

        return { ...enrichedAdj, auditEntry };
      }
    );
  }

  async saveMany(adjustments: StockAdjustmentRecord[]): Promise<void> {
    await enforcePermission('STOCK_ADJUSTMENT', 'ကုန်ပစ္စည်း လက်ကျန်ညှိနှိုင်းမှု ပြုလုပ်ခြင်း');
    await this.database.stockAdjustments.bulkPut(adjustments);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_FINANCIAL_RECORD', 'လက်ကျန်ညှိနှိုင်းမှု ဖျက်ပစ်ခြင်း');
    await this.database.stockAdjustments.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'လက်ကျန်ညှိနှိုင်းမှုများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.stockAdjustments.clear();
  }

  async count(): Promise<number> {
    return this.database.stockAdjustments.count();
  }
}

/**
 * Atomic Soft Delete for Inbound Goods Collection / Transaction
 * 1. Retrieve the transaction by txId
 * 2. Reverse inventory stock (subtract collected quantities from products)
 * 3. Revert supplier metrics (currentAdvanceBalance and totalGoodsValueDelivered)
 * 4. Create a SoftDeletedItem entry with type 'TRANSACTION', original transaction payload as data, stored in db.softDeletedItems
 * 5. Remove record from db.transactions
 * 6. Record audit event
 */
export async function softDeleteTransactionAtomic(
  txId: string,
  reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်',
  database: ShweLetYarDatabase = db
): Promise<SoftDeletedItem> {
  await enforcePermission('VOID_TRANSACTION', 'ကုန်သိမ်းစာရင်း ဖျက်ပစ်ခြင်း');
  return database.transaction(
    'rw',
    [
      database.transactions,
      database.products,
      database.suppliers,
      database.softDeletedItems,
      database.auditLogs,
    ],
    async () => {
      const tx = await database.transactions.get(txId);
      if (!tx) {
        throw new EntityNotFoundError('Transaction', txId);
      }

      const now = new Date().toISOString();

      // 1. Reverse inventory stock (subtract collected quantities from products)
      if (Array.isArray(tx.items)) {
        for (const item of tx.items) {
          if (!item.productId) continue;
          const product = await database.products.get(item.productId);
          if (product) {
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            const updatedStock = Math.max(0, currentStock - (item.quantity || 0));
            await database.products.update(item.productId, {
              currentStock: updatedStock,
              updatedAt: now,
              revision: (product.revision || 0) + 1,
            });
          }
        }
      }

      // 2. Revert supplier metrics (currentAdvanceBalance and totalGoodsValueDelivered)
      if (tx.supplierId) {
        const supplier = await database.suppliers.get(tx.supplierId);
        if (supplier) {
          const revertedAdvanceBalance =
            tx.previousAdvanceBalance !== undefined
              ? tx.previousAdvanceBalance
              : Math.max(0, (supplier.currentAdvanceBalance ?? 0) + (tx.advanceDeducted || 0) - (tx.newAdvanceTaken || 0));
          const currentDelivered = supplier.totalGoodsValueDelivered || (supplier as any).totalGoodsDeliveredValue || 0;
          const revertedDelivered = Math.max(0, currentDelivered - (tx.totalGoodsValue || 0));

          await database.suppliers.update(tx.supplierId, {
            currentAdvanceBalance: revertedAdvanceBalance,
            totalGoodsValueDelivered: revertedDelivered,
            updatedAt: now,
          });
        }
      }

      // 3. Create SoftDeletedItem entry with type 'TRANSACTION'
      const softItem: SoftDeletedItem = {
        id: generateStableId('del'),
        originalId: tx.id,
        name: tx.voucherNo || `ဘောင်ချာ ${tx.id}`,
        type: 'TRANSACTION',
        deletedAt: now,
        reason,
        data: tx,
      };
      await database.softDeletedItems.put(softItem);

      // 4. Remove record from transactions table
      await database.transactions.delete(tx.id);

      // 5. Log audit event
      const auditEntry = await recordAuditEvent(
        {
          action: 'ကုန်သိမ်းစာရင်းအား အမှိုက်ပုံးသို့ ရွှေ့ပြောင်းဖျက်ပစ်ခြင်း (Soft Delete Transaction)',
          actionType: 'SYSTEM_ACTION',
          details: `ဘောင်ချာ ${tx.voucherNo || tx.id} (${tx.supplierName || 'ပေးသွင်းသူ'}) အား ဖျက်ပစ်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
          referenceType: 'TRANSACTION',
          referenceId: tx.id,
          referenceVoucherNo: tx.voucherNo,
          amount: tx.totalGoodsValue || 0,
        },
        database
      );

      return { ...softItem, auditEntry };
    }
  );
}

/**
 * Atomic Soft Delete for Sale Record
 * 1. Retrieve the sale by saleId
 * 2. Reverse inventory stock (add back sold quantities to products)
 * 3. Revert merchant metrics (currentReceivableBalance, totalPurchasesValue, totalPaidAmount)
 * 4. Create a SoftDeletedItem entry with type 'SALE', original sale payload as data, stored in db.softDeletedItems
 * 5. Remove record from sales table
 * 6. Record audit event
 */
export async function softDeleteSaleAtomic(
  saleId: string,
  reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်',
  database: ShweLetYarDatabase = db
): Promise<SoftDeletedItem> {
  await enforcePermission('VOID_TRANSACTION', 'အရောင်းမှတ်တမ်း ဖျက်ပစ်ခြင်း');
  return database.transaction(
    'rw',
    [
      database.sales,
      database.products,
      database.merchants,
      database.softDeletedItems,
      database.auditLogs,
    ],
    async () => {
      const sale = await database.sales.get(saleId);
      if (!sale) {
        throw new EntityNotFoundError('Sale', saleId);
      }

      const now = new Date().toISOString();

      // 1. Reverse inventory stock (add back sold quantities to products)
      if (Array.isArray(sale.items)) {
        for (const item of sale.items) {
          if (!item.productId) continue;
          const product = await database.products.get(item.productId);
          if (product) {
            const currentStock = product.currentStock ?? product.openingStock ?? 0;
            const updatedStock = currentStock + (item.quantity || 0);
            await database.products.update(item.productId, {
              currentStock: updatedStock,
              updatedAt: now,
              revision: (product.revision || 0) + 1,
            });
          }
        }
      }

      // 2. Revert merchant metrics (currentReceivableBalance, totalPurchasesValue, totalPaidAmount)
      if (sale.merchantId) {
        const merchant = await database.merchants.get(sale.merchantId);
        if (merchant) {
          const grandTotalVal = sale.grandTotal ?? sale.totalAmount ?? 0;
          const paidVal = sale.cashPaidByMerchant ?? sale.paidAmount ?? 0;
          let revertedReceivable = merchant.currentReceivableBalance ?? 0;
          if (sale.previousReceivableBalance !== undefined) {
            revertedReceivable = sale.previousReceivableBalance;
          } else {
            revertedReceivable = Math.max(0, revertedReceivable - (grandTotalVal - paidVal));
          }
          const currentPurchases = merchant.totalPurchasesValue || 0;
          const currentPaid = merchant.totalPaidAmount || 0;

          await database.merchants.update(sale.merchantId, {
            currentReceivableBalance: revertedReceivable,
            totalPurchasesValue: Math.max(0, currentPurchases - grandTotalVal),
            totalPaidAmount: Math.max(0, currentPaid - paidVal),
            updatedAt: now,
          });
        }
      }

      // 3. Create SoftDeletedItem entry with type 'SALE'
      const softItem: SoftDeletedItem = {
        id: generateStableId('del'),
        originalId: sale.id,
        name: sale.voucherNo || `အရောင်းဘောင်ချာ ${sale.id}`,
        type: 'SALE',
        deletedAt: now,
        reason,
        data: sale,
      };
      await database.softDeletedItems.put(softItem);

      // 4. Remove record from sales table
      await database.sales.delete(sale.id);

      // 5. Log audit event
      const auditEntry = await recordAuditEvent(
        {
          action: 'အရောင်းစာရင်းအား အမှိုက်ပုံးသို့ ရွှေ့ပြောင်းဖျက်ပစ်ခြင်း (Soft Delete Sale)',
          actionType: 'SYSTEM_ACTION',
          details: `ဘောင်ချာ ${sale.voucherNo || sale.id} (${sale.merchantName || 'ကုန်သည်'}) အား ဖျက်ပစ်ခဲ့သည် | အကြောင်းပြချက်: ${reason}`,
          referenceType: 'SALE',
          referenceId: sale.id,
          referenceVoucherNo: sale.voucherNo,
          amount: sale.grandTotal ?? sale.totalAmount ?? 0,
        },
        database
      );

      return { ...softItem, auditEntry };
    }
  );
}

export class SoftDeleteRepository implements ISoftDeleteRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<SoftDeletedItem[]> {
    return this.database.softDeletedItems.reverse().sortBy('deletedAt');
  }

  async getById(id: string): Promise<SoftDeletedItem | undefined> {
    return this.database.softDeletedItems.get(id);
  }

  async save(item: SoftDeletedItem): Promise<string> {
    await this.database.softDeletedItems.put(item);
    return item.id;
  }

  /**
   * Atomic Soft Delete for Inbound Goods Collection / Transaction
   */
  async softDeleteTransactionAtomic(
    txId: string,
    reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်'
  ): Promise<SoftDeletedItem> {
    return softDeleteTransactionAtomic(txId, reason, this.database);
  }

  /**
   * Atomic Soft Delete for Sale Record
   */
  async softDeleteSaleAtomic(
    saleId: string,
    reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်'
  ): Promise<SoftDeletedItem> {
    return softDeleteSaleAtomic(saleId, reason, this.database);
  }

  /**
   * Atomic Soft Delete with Recycle Bin movement
   */
  async softDeleteAtomic(
    entityType: 'PRODUCT' | 'SUPPLIER' | 'MERCHANT' | 'TRANSACTION' | 'SALE' | string,
    id: string,
    name?: string,
    reason: string = 'သုံးစွဲသူမှ ဖျက်ပစ်သည်'
  ): Promise<SoftDeletedItem> {
    if (entityType.toUpperCase() === 'TRANSACTION') {
      return this.softDeleteTransactionAtomic(id, reason);
    }
    if (entityType.toUpperCase() === 'SALE') {
      return this.softDeleteSaleAtomic(id, reason);
    }

    await enforcePermission('DELETE_MASTER_DATA', 'မော်ကွန်းထိန်းသိမ်း ဖျက်ပစ်ခြင်း');
    return this.database.transaction(
      'rw',
      [
        this.database.softDeletedItems,
        this.database.products,
        this.database.suppliers,
        this.database.merchants,
        this.database.transactions,
        this.database.sales,
        this.database.auditLogs,
      ],
      async () => {
        let entityData: any = null;
        let displayName = name || id;

        switch (entityType.toUpperCase()) {
          case 'PRODUCT':
            entityData = await this.database.products.get(id);
            if (entityData) {
              displayName = entityData.name || displayName;
              await this.database.products.delete(id);
            }
            break;
          case 'SUPPLIER':
            entityData = await this.database.suppliers.get(id);
            if (entityData) {
              displayName = entityData.name || displayName;
              await this.database.suppliers.delete(id);
            }
            break;
          case 'MERCHANT':
            entityData = await this.database.merchants.get(id);
            if (entityData) {
              displayName = entityData.name || displayName;
              await this.database.merchants.delete(id);
            }
            break;
          default:
            throw new BusinessIntegrityError(`Unsupported entity type: ${entityType}`);
        }

        if (!entityData) {
          throw new EntityNotFoundError(entityType, id);
        }

        const now = new Date().toISOString();
        const softItem: SoftDeletedItem = {
          id: generateStableId('del'),
          originalId: id,
          name: displayName,
          type: entityType,
          deletedAt: now,
          reason,
          data: entityData,
        };

        await this.database.softDeletedItems.put(softItem);

        // Audit Log
        const auditEntry = await recordAuditEvent(
          {
            action: `${entityType} အား အမှိုက်ပုံးသို့ ရွှေ့ပြောင်းခြင်း (Atomic Soft Delete)`,
            actionType: 'SYSTEM_ACTION',
            details: `${displayName} (ID: ${id}) | အကြောင်းပြချက်: ${reason}`,
            referenceType: entityType,
            referenceId: id,
          },
          this.database
        );

        return { ...softItem, auditEntry };
      }
    );
  }

  /**
   * Atomic Restore from Recycle Bin
   */
  async restoreAtomic(softDeleteId: string): Promise<any> {
    await enforcePermission('MANAGE_MASTER_DATA', 'အမှိုက်ပုံးမှ ပြန်လည်ဆယ်ယူခြင်း');
    return this.database.transaction(
      'rw',
      [
        this.database.softDeletedItems,
        this.database.products,
        this.database.suppliers,
        this.database.merchants,
        this.database.transactions,
        this.database.sales,
        this.database.auditLogs,
      ],
      async () => {
        const item = await this.database.softDeletedItems.get(softDeleteId);
        if (!item) {
          throw new EntityNotFoundError('SoftDeletedItem', softDeleteId);
        }

        const { type, data, originalId, name } = item;

        switch (type.toUpperCase()) {
          case 'PRODUCT':
            await this.database.products.put(data);
            break;
          case 'SUPPLIER':
            await this.database.suppliers.put(data);
            break;
          case 'MERCHANT':
            await this.database.merchants.put(data);
            break;
          case 'TRANSACTION':
            await this.database.transactions.put(data);
            if (Array.isArray(data.items)) {
              for (const it of data.items) {
                if (!it.productId) continue;
                const product = await this.database.products.get(it.productId);
                if (product) {
                  const currentStock = product.currentStock ?? product.openingStock ?? 0;
                  await this.database.products.update(it.productId, {
                    currentStock: currentStock + (it.quantity || 0),
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
            }
            if (data.supplierId) {
              const supplier = await this.database.suppliers.get(data.supplierId);
              if (supplier) {
                const curDelivered = supplier.totalGoodsValueDelivered || (supplier as any).totalGoodsDeliveredValue || 0;
                const goodsVal = roundMMK(data.totalGoodsValue || 0);
                await this.database.suppliers.update(data.supplierId, {
                  currentAdvanceBalance: data.remainingAdvanceBalance !== undefined ? roundMMK(data.remainingAdvanceBalance) : supplier.currentAdvanceBalance,
                  totalGoodsValueDelivered: moneyAdd(curDelivered, goodsVal),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
            break;
          case 'SALE':
            await this.database.sales.put(data);
            if (Array.isArray(data.items)) {
              for (const it of data.items) {
                if (!it.productId) continue;
                const product = await this.database.products.get(it.productId);
                if (product) {
                  const currentStock = product.currentStock ?? product.openingStock ?? 0;
                  await this.database.products.update(it.productId, {
                    currentStock: Math.max(0, currentStock - (it.quantity || 0)),
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
            }
            if (data.merchantId) {
              const merchant = await this.database.merchants.get(data.merchantId);
              if (merchant) {
                const grandTotal = roundMMK(data.grandTotal ?? data.totalAmount ?? 0);
                const paid = roundMMK(data.cashPaidByMerchant ?? data.paidAmount ?? 0);
                const currentBal = roundMMK(merchant.currentReceivableBalance || 0);
                await this.database.merchants.update(data.merchantId, {
                  currentReceivableBalance:
                    data.remainingReceivableBalance !== undefined
                      ? roundMMK(data.remainingReceivableBalance)
                      : moneySub(moneyAdd(currentBal, grandTotal), paid),
                  totalPurchasesValue: moneyAdd(merchant.totalPurchasesValue || 0, grandTotal),
                  totalPaidAmount: moneyAdd(merchant.totalPaidAmount || 0, paid),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
            break;
          default:
            throw new BusinessIntegrityError(`Unsupported entity restore type: ${type}`);
        }

        // Delete from Recycle Bin
        await this.database.softDeletedItems.delete(softDeleteId);

        // Audit Log
        const auditEntry = await recordAuditEvent(
          {
            action: `${type} အား အမှိုက်ပုံးမှ ပြန်လည်ဆယ်ယူခြင်း (Atomic Restore)`,
            actionType: 'SYSTEM_ACTION',
            details: `${name} (ID: ${originalId}) အား မူလနေရာသို့ ပြန်လည်ထည့်သွင်းခဲ့သည်`,
            referenceType: type,
            referenceId: originalId,
          },
          this.database
        );

        return { ...data, auditEntry };
      }
    );
  }

  async saveMany(items: SoftDeletedItem[]): Promise<void> {
    await this.database.softDeletedItems.bulkPut(items);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_MASTER_DATA', 'အမှိုက်ပုံးမှ အပြီးတိုင်ဖျက်ပစ်ခြင်း');
    await this.database.softDeletedItems.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('DELETE_MASTER_DATA', 'အမှိုက်ပုံးတစ်ခုလုံး ရှင်းလင်းခြင်း');
    await this.database.softDeletedItems.clear();
  }

  async count(): Promise<number> {
    return this.database.softDeletedItems.count();
  }
}

export class AuditRepository implements IAuditRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<AuditLogEntry[]> {
    return this.database.auditLogs.reverse().sortBy('timestamp');
  }

  async log(action: string, details: string, entityType?: string, entityId?: string): Promise<void> {
    await recordAuditEvent(
      {
        action,
        details,
        entityType,
        entityId,
      },
      this.database
    );
  }

  async saveMany(logs: AuditLogEntry[]): Promise<void> {
    await this.database.auditLogs.bulkPut(logs);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'လုပ်ဆောင်ချက်မှတ်တမ်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.auditLogs.clear();
  }

  async count(): Promise<number> {
    return this.database.auditLogs.count();
  }
}

export class RawMaterialPresetRepository implements IRawMaterialPresetRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<RawMaterialPreset[]> {
    return this.database.rawMaterialPresets.toArray();
  }

  async getById(id: string): Promise<RawMaterialPreset | undefined> {
    return this.database.rawMaterialPresets.get(id);
  }

  async save(preset: RawMaterialPreset): Promise<string> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ကြမ်းအမျိုးအစား သတ်မှတ်ချက် သိမ်းဆည်းခြင်း');
    await this.database.rawMaterialPresets.put(preset);
    return preset.id;
  }

  async saveMany(presets: RawMaterialPreset[]): Promise<void> {
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ကြမ်းအမျိုးအစား သတ်မှတ်ချက်များ သိမ်းဆည်းခြင်း');
    await this.database.rawMaterialPresets.bulkPut(presets);
  }

  async delete(id: string): Promise<void> {
    await enforcePermission('DELETE_MASTER_DATA', 'ကုန်ကြမ်းအမျိုးအစား သတ်မှတ်ချက် ဖျက်ပစ်ခြင်း');
    await this.database.rawMaterialPresets.delete(id);
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ကုန်ကြမ်းအမျိုးအစား သတ်မှတ်ချက်များ အားလုံးရှင်းလင်းခြင်း');
    await this.database.rawMaterialPresets.clear();
  }

  async count(): Promise<number> {
    return this.database.rawMaterialPresets.count();
  }
}

export class SettingsRepository implements ISettingsRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const record = await this.database.settings.get(key);
    if (!record || record.value === undefined || record.value === null) return defaultValue;
    return record.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (key === 'rbac_users') {
      await enforcePermission('MANAGE_USERS', `သုံးစွဲသူ အကောင့်များ ပြင်ဆင်သိမ်းဆည်းခြင်း (${key})`);
      if (!Array.isArray(value) || value.length === 0 || !value.some((u: any) => u.role === 'OWNER' && u.isActive !== false)) {
        throw new AuthorizationError('MANAGE_USERS', 'OWNER', 'စနစ်တွင် အနည်းဆုံး အသုံးပြုနိုင်သော ပိုင်ရှင် (Active Owner) အကောင့် တစ်ခု ရှိရပါမည်။');
      }
    } else if (key === 'rbac_active_session') {
      await enforcePermission('ACCESS_SETTINGS', `အသုံးပြုသူ Session ပြင်ဆင်ခြင်း (${key})`);
    } else {
      await enforcePermission('ACCESS_SETTINGS', `စနစ်ဆက်တင်များ ပြင်ဆင်ခြင်း (${key})`);
    }
    await this.database.settings.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(key: string): Promise<void> {
    if (key === 'rbac_users') {
      await enforcePermission('MANAGE_USERS', `သုံးစွဲသူ အကောင့်များ ဖျက်ပစ်ခြင်း (${key})`);
      throw new AuthorizationError('MANAGE_USERS', 'OWNER', 'အသုံးပြုသူစာရင်း (rbac_users) ကို လုံးဝဖျက်ပစ်ခွင့် မရှိပါ။');
    } else if (key === 'rbac_active_session') {
      await enforcePermission('ACCESS_SETTINGS', `အသုံးပြုသူ Session ဖျက်ပစ်ခြင်း (${key})`);
    } else {
      await enforcePermission('ACCESS_SETTINGS', `စနစ်ဆက်တင် ဖျက်ပစ်ခြင်း (${key})`);
    }
    await this.database.settings.delete(key);
  }

  async getAll(): Promise<SettingRecord[]> {
    return this.database.settings.toArray();
  }
}

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async save(voucherId: string, input: File | Blob | string, caption?: string, ownerId?: string): Promise<string> {
    const record = await saveAttachmentRecord({ voucherId, input, caption, ownerId });
    return record.id;
  }

  async getByVoucher(voucherId: string): Promise<AttachmentRecord[]> {
    return getServiceAttachmentsForVoucher(voucherId);
  }

  async delete(id: string, options?: { force?: boolean }): Promise<void> {
    await deleteAttachmentSafely(id, options);
  }

  async deleteByVoucher(voucherId: string): Promise<void> {
    await this.database.attachments.where('voucherId').equals(voucherId).delete();
  }

  async count(): Promise<number> {
    return this.database.attachments.count();
  }

  async cleanupOrphans(): Promise<number> {
    return cleanupOrphanAttachments();
  }

  async migrateLegacy(): Promise<number> {
    return migrateLegacyAttachments();
  }
}

function getStockMovementPermission(movement: StockMovementRecord): PermissionAction {
  if (movement.movementType === 'OPENING_BALANCE' || movement.referenceType === 'OPENING') {
    return 'BUSINESS_INITIALIZATION';
  }
  if (
    movement.movementType === 'STOCK_ADJUSTMENT_IN' ||
    movement.movementType === 'STOCK_ADJUSTMENT_OUT' ||
    movement.movementType === 'DAMAGE_LOSS' ||
    movement.referenceType === 'STOCK_ADJUSTMENT' ||
    (movement.referenceType as string) === 'ADJUSTMENT'
  ) {
    return 'STOCK_ADJUSTMENT';
  }
  if (
    movement.movementType === 'TRANSACTION_CANCELLED_REVERSAL' ||
    movement.movementType === 'SALE_CANCELLED_REVERSAL' ||
    movement.movementType === 'PURCHASE_CANCELLED_REVERSAL' ||
    movement.movementType === 'SALES_RETURN_CANCELLED_REVERSAL' ||
    movement.movementType === 'PURCHASE_RETURN_CANCELLED_REVERSAL'
  ) {
    return 'VOID_TRANSACTION';
  }
  if (movement.referenceType === 'MANUAL') {
    return 'STOCK_ADJUSTMENT';
  }
  return 'OPERATIONAL_DATA_ENTRY';
}

async function verifyStockMovementBusinessContext(
  database: ShweLetYarDatabase,
  movement: StockMovementRecord
): Promise<PermissionAction> {
  const basePermission = getStockMovementPermission(movement);
  if (basePermission !== 'OPERATIONAL_DATA_ENTRY') {
    return basePermission;
  }

  // Verify that an operational stock movement has a valid, existing business transaction context
  let hasValidContext = false;
  try {
    if (movement.referenceType === 'TRANSACTION') {
      const tx = await database.transactions.get(movement.referenceId);
      if (tx) hasValidContext = true;
    } else if (movement.referenceType === 'SALE') {
      const sale = await database.sales.get(movement.referenceId);
      if (sale) hasValidContext = true;
    } else if (movement.referenceType === 'PURCHASE') {
      const mp = await database.merchantPurchases.get(movement.referenceId);
      if (mp) hasValidContext = true;
    } else if (movement.referenceType === 'PEER_TRADE') {
      const pt = await database.peerTrades.get(movement.referenceId);
      if (pt) hasValidContext = true;
    }
  } catch {
    hasValidContext = false;
  }

  // If no legitimate referenced entity exists in the database, direct injection is treated as STOCK_ADJUSTMENT
  if (!hasValidContext) {
    return 'STOCK_ADJUSTMENT';
  }

  return 'OPERATIONAL_DATA_ENTRY';
}

export class StockMovementRepository implements IStockMovementRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<StockMovementRecord[]> {
    return this.database.stockMovements.reverse().sortBy('transactionDate');
  }

  async getById(id: string): Promise<StockMovementRecord | undefined> {
    return this.database.stockMovements.get(id);
  }

  async getByProduct(productId: string): Promise<StockMovementRecord[]> {
    return this.database.stockMovements.where('productId').equals(productId).reverse().sortBy('transactionDate');
  }

  async getByProductId(productId: string): Promise<StockMovementRecord[]> {
    return this.getByProduct(productId);
  }

  async getByIdempotencyKey(key: string): Promise<StockMovementRecord | undefined> {
    return this.database.stockMovements.where('idempotencyKey').equals(key).first();
  }

  async getByReference(referenceType: string, referenceId: string): Promise<StockMovementRecord[]> {
    return this.database.stockMovements
      .where('referenceType')
      .equals(referenceType)
      .filter((m) => m.referenceId === referenceId)
      .toArray();
  }

  async getByDateRange(startDate: string, endDate: string): Promise<StockMovementRecord[]> {
    return this.database.stockMovements
      .where('transactionDate')
      .between(startDate, endDate, true, true)
      .reverse()
      .sortBy('transactionDate');
  }

  async recordMovement(movement: StockMovementRecord): Promise<string> {
    const requiredPermission = await verifyStockMovementBusinessContext(this.database, movement);
    await enforcePermission(requiredPermission, `ကုန်ပစ္စည်းလှုပ်ရှားမှု စာရင်းရေးသွင်းခြင်း (${movement.movementType})`);
    if (movement.idempotencyKey) {
      const existing = await this.database.stockMovements.where('idempotencyKey').equals(movement.idempotencyKey).first();
      if (existing) {
        return existing.id;
      }
    }
    await this.database.stockMovements.put(movement);
    return movement.id;
  }

  async recordMovementsMany(movements: StockMovementRecord[]): Promise<void> {
    return this.recordMovementsAtomic(movements);
  }

  async recordMovementsAtomic(movements: StockMovementRecord[]): Promise<void> {
    for (const m of movements) {
      const requiredPermission = await verifyStockMovementBusinessContext(this.database, m);
      await enforcePermission(requiredPermission, `ကုန်ပစ္စည်းလှုပ်ရှားမှု စာရင်းရေးသွင်းခြင်း (${m.movementType})`);
    }
    return this.database.transaction('rw', [this.database.stockMovements], async () => {
      for (const m of movements) {
        if (m.idempotencyKey) {
          const existing = await this.database.stockMovements.where('idempotencyKey').equals(m.idempotencyKey).first();
          if (existing) continue;
        }
        await this.database.stockMovements.put(m);
      }
    });
  }

  async count(): Promise<number> {
    return this.database.stockMovements.count();
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ကုန်ပစ္စည်းလှုပ်ရှားမှု စာရင်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.stockMovements.clear();
  }
}

function getCashMovementPermission(movement: CashMovementRecord): PermissionAction {
  if (movement.type === 'OPENING_FLOAT' || movement.referenceType === 'OPENING') {
    return 'BUSINESS_INITIALIZATION';
  }
  if (
    movement.type === 'MANUAL_CASH_ADJUSTMENT' ||
    movement.referenceType === 'MANUAL_ADJUSTMENT'
  ) {
    return 'CASH_ADJUSTMENT';
  }
  if (
    movement.type === 'DAILY_CLOSING_CORRECTION' ||
    movement.referenceType === 'DAILY_CLOSING_CORRECTION'
  ) {
    return 'DAILY_CLOSING_CORRECTION';
  }
  if (
    movement.type === 'SALE_CANCELLED_CASH_REVERSAL' ||
    movement.type === 'TRANSACTION_CANCELLED_CASH_REVERSAL' ||
    movement.type === 'PURCHASE_CANCELLED_CASH_REVERSAL' ||
    movement.type === 'SALES_RETURN_CANCELLED_CASH_REVERSAL' ||
    movement.type === 'PURCHASE_RETURN_CANCELLED_CASH_REVERSAL'
  ) {
    return 'VOID_TRANSACTION';
  }
  return 'OPERATIONAL_DATA_ENTRY';
}

async function verifyCashMovementBusinessContext(
  database: ShweLetYarDatabase,
  movement: CashMovementRecord
): Promise<PermissionAction> {
  const basePermission = getCashMovementPermission(movement);
  if (basePermission !== 'OPERATIONAL_DATA_ENTRY') {
    return basePermission;
  }

  // Verify that an operational cash movement has a valid, existing business transaction context
  let hasValidContext = false;
  try {
    if (movement.referenceType === 'SALE' || movement.type === 'SALE_PAYMENT_IN') {
      const sale = await database.sales.get(movement.referenceId);
      if (sale) hasValidContext = true;
    } else if (
      movement.referenceType === 'TRANSACTION' ||
      movement.type === 'SUPPLIER_PAYOUT' ||
      movement.type === 'SUPPLIER_ADVANCE_GIVEN' ||
      movement.type === 'SUPPLIER_REPAYMENT_IN'
    ) {
      const tx = await database.transactions.get(movement.referenceId);
      if (tx) hasValidContext = true;
    } else if (
      movement.referenceType === 'PURCHASE' ||
      movement.type === 'MERCHANT_PURCHASE_PAYOUT'
    ) {
      const mp = await database.merchantPurchases.get(movement.referenceId);
      if (mp) hasValidContext = true;
    } else if (
      movement.referenceType === 'MERCHANT_PAYMENT' ||
      movement.type === 'MERCHANT_DEBT_COLLECTION_IN'
    ) {
      const m = await database.merchants.get(movement.referenceId);
      if (m) hasValidContext = true;
    } else if (movement.referenceType === 'SUPPLIER_ADVANCE') {
      const s = await database.suppliers.get(movement.referenceId);
      if (s) hasValidContext = true;
    } else if (movement.referenceType === 'DAILY_CLOSING') {
      const dc = await database.dailyClosings.get(movement.referenceId);
      if (dc) hasValidContext = true;
    } else if (
      movement.referenceType === 'RETURN' ||
      movement.referenceType === 'SALES_RETURN' ||
      movement.referenceType === 'PURCHASE_RETURN' ||
      movement.type === 'SALES_RETURN_REFUND_OUT' ||
      movement.type === 'PURCHASE_RETURN_RECOVERY_IN'
    ) {
      const ret = await database.returnsAndRefunds.get(movement.referenceId);
      if (ret) hasValidContext = true;
    }
  } catch {
    hasValidContext = false;
  }

  // If no legitimate referenced entity exists in the database, direct injection is treated as CASH_ADJUSTMENT
  if (!hasValidContext) {
    return 'CASH_ADJUSTMENT';
  }

  return 'OPERATIONAL_DATA_ENTRY';
}

export class CashMovementRepository implements ICashMovementRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<CashMovementRecord[]> {
    return this.database.cashMovements.reverse().sortBy('transactionDate');
  }

  async getById(id: string): Promise<CashMovementRecord | undefined> {
    return this.database.cashMovements.get(id);
  }

  async getByDate(date: string): Promise<CashMovementRecord[]> {
    return this.database.cashMovements.where('transactionDate').equals(date).toArray();
  }

  async getByReference(referenceType: string, referenceId: string): Promise<CashMovementRecord[]> {
    return this.database.cashMovements
      .where('referenceType')
      .equals(referenceType)
      .filter((m) => m.referenceId === referenceId)
      .toArray();
  }

  async getByIdempotencyKey(key: string): Promise<CashMovementRecord | undefined> {
    return this.database.cashMovements.where('idempotencyKey').equals(key).first();
  }

  async recordMovement(movement: CashMovementRecord): Promise<string> {
    const requiredPermission = await verifyCashMovementBusinessContext(this.database, movement);
    await enforcePermission(requiredPermission, `ငွေသားလှုပ်ရှားမှု စာရင်းရေးသွင်းခြင်း (${movement.type})`);
    if (movement.idempotencyKey) {
      const existing = await this.database.cashMovements.where('idempotencyKey').equals(movement.idempotencyKey).first();
      if (existing) {
        return existing.id;
      }
    }
    await this.database.cashMovements.put(movement);
    return movement.id;
  }

  async recordMovementsMany(movements: CashMovementRecord[]): Promise<void> {
    for (const m of movements) {
      const requiredPermission = await verifyCashMovementBusinessContext(this.database, m);
      await enforcePermission(requiredPermission, `ငွေသားလှုပ်ရှားမှု စာရင်းရေးသွင်းခြင်း (${m.type})`);
    }
    return this.database.transaction('rw', [this.database.cashMovements], async () => {
      for (const m of movements) {
        if (m.idempotencyKey) {
          const existing = await this.database.cashMovements.where('idempotencyKey').equals(m.idempotencyKey).first();
          if (existing) continue;
        }
        await this.database.cashMovements.put(m);
      }
    });
  }

  async count(): Promise<number> {
    return this.database.cashMovements.count();
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'ငွေသားလှုပ်ရှားမှု စာရင်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.cashMovements.clear();
  }
}

export class DailyClosingRepository implements IDailyClosingRepository {
  constructor(private database: ShweLetYarDatabase = db) {}

  async getAll(): Promise<DailyClosingRecord[]> {
    return this.database.dailyClosings.reverse().sortBy('closingDate');
  }

  async getByDate(date: string): Promise<DailyClosingRecord | undefined> {
    return this.database.dailyClosings.where('closingDate').equals(date).first();
  }

  async save(closing: DailyClosingRecord): Promise<string> {
    await enforcePermission('ACCESS_SETTINGS', 'နေ့ချုပ်စာရင်း သိမ်းဆည်းခြင်း');
    await this.database.dailyClosings.put(closing);
    return closing.id;
  }

  async saveMany(closings: DailyClosingRecord[]): Promise<void> {
    await enforcePermission('ACCESS_SETTINGS', 'နေ့ချုပ်စာရင်းများ သိမ်းဆည်းခြင်း');
    await this.database.dailyClosings.bulkPut(closings);
  }

  async count(): Promise<number> {
    return this.database.dailyClosings.count();
  }

  async clear(): Promise<void> {
    await enforcePermission('CLEAR_DATABASE', 'နေ့ချုပ်စာရင်းများ အားလုံးရှင်းလင်းခြင်း');
    await this.database.dailyClosings.clear();
  }
}

// Singleton instances for presentation / application consumption
export const productRepo = new ProductRepository();
export const supplierRepo = new SupplierRepository();
export const merchantRepo = new MerchantRepository();
export const transactionRepo = new TransactionRepository();
export const saleRepo = new SaleRepository();
export const purchaseRepo = new MerchantPurchaseRepository();
export const orderRepo = new OrderRepository();
export const peerTradeRepo = new PeerTradeRepository();
export const stockAdjustmentRepo = new StockAdjustmentRepository();
export const stockMovementRepo = new StockMovementRepository();
export const cashMovementRepo = new CashMovementRepository();
export const dailyClosingRepo = new DailyClosingRepository();
export const softDeleteRepo = new SoftDeleteRepository();
export const auditRepo = new AuditRepository();
export const rawMaterialPresetRepo = new RawMaterialPresetRepository();
export const settingsRepo = new SettingsRepository();
export const attachmentRepo = new AttachmentRepository();
