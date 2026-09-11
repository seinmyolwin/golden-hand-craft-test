import { db } from '../db/database';
import { Product, Supplier, Merchant, RawMaterialPreset, StockMovementRecord } from '../types';
import {
  productRepo,
  supplierRepo,
  merchantRepo,
  softDeleteRepo,
  auditRepo,
  stockMovementRepo,
} from '../repositories';
import { generateStableId } from '../utils/idGenerator';

export interface ReferentialCheckResult {
  hasReferences: boolean;
  details: string[];
  referenceCount: number;
}

export class MasterDataService {
  // ==========================================
  // PRODUCT MASTER VALIDATION & OPERATIONS
  // ==========================================

  validateProduct(
    product: Partial<Product>,
    existingProducts: Product[] = [],
    isEditingId?: string
  ): { isValid: boolean; error?: string } {
    const name = (product.name || '').trim();
    if (!name) {
      return { isValid: false, error: 'ကုန်ပစ္စည်းအမည် ထည့်သွင်းရန် လိုအပ်ပါသည်' };
    }

    // Check duplicate name
    const duplicate = existingProducts.find(
      (p) => p.id !== isEditingId && p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      return { isValid: false, error: `"${name}" အမည်ဖြင့် ကုန်ပစ္စည်း ရှိနှင့်ပြီးဖြစ်ပါသည်` };
    }

    if ((product.defaultPrice ?? 0) < 0) {
      return { isValid: false, error: 'ဝယ်ယူစျေးနှုန်းသည် ၀ သို့မဟုတ် ၀ ထက်ကြီးရပါမည်' };
    }

    if ((product.defaultWholesalePrice ?? 0) < 0) {
      return { isValid: false, error: 'လက္ကားရောင်းစျေးသည် ၀ သို့မဟုတ် ၀ ထက်ကြီးရပါမည်' };
    }

    if ((product.openingStock ?? 0) < 0) {
      return { isValid: false, error: 'စတင်လက်ကျန်သည် ၀ သို့မဟုတ် ၀ ထက်ကြီးရပါမည်' };
    }

    return { isValid: true };
  }

  async checkProductReferences(productId: string): Promise<ReferentialCheckResult> {
    const details: string[] = [];
    let count = 0;

    // Check transactions
    const txs = await db.transactions.toArray();
    const txMatches = txs.filter((tx) =>
      (tx.items || []).some((item) => item.productId === productId)
    );
    if (txMatches.length > 0) {
      details.push(`ကုန်သိမ်းမှတ်တမ်း ${txMatches.length} ခု`);
      count += txMatches.length;
    }

    // Check sales
    const sales = await db.sales.toArray();
    const saleMatches = sales.filter((s) =>
      (s.items || []).some((item) => item.productId === productId)
    );
    if (saleMatches.length > 0) {
      details.push(`အရောင်းမှတ်တမ်း ${saleMatches.length} ခု`);
      count += saleMatches.length;
    }

    // Check purchases
    const purchases = await db.merchantPurchases.toArray();
    const purchaseMatches = purchases.filter((pur) =>
      (pur.items || []).some((item) => item.productId === productId)
    );
    if (purchaseMatches.length > 0) {
      details.push(`ကုန်ကြမ်းဝယ်ယူမှု ${purchaseMatches.length} ခု`);
      count += purchaseMatches.length;
    }

    // Check peer trades
    const trades = await db.peerTrades.where('productId').equals(productId).toArray();
    if (trades.length > 0) {
      details.push(`မိတ်ဖက်ကုန်ဖလှယ်မှု ${trades.length} ခု`);
      count += trades.length;
    }

    return {
      hasReferences: count > 0,
      details,
      referenceCount: count,
    };
  }

  async saveProduct(productData: Partial<Product>): Promise<Product> {
    const allProducts = await productRepo.getAll();
    const validation = this.validateProduct(productData, allProducts, productData.id);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const id = productData.id || generateStableId('prod');
    const now = new Date().toISOString();
    const initialOpening = Math.max(0, productData.openingStock ?? 0);
    const existing = productData.id ? await productRepo.getById(productData.id) : undefined;
    const isNew = !existing;

    const toSave: Product = {
      id,
      name: (productData.name || '').trim(),
      category: productData.category || 'အခြား',
      unit: productData.unit || 'ထည်',
      defaultPrice: Math.max(0, productData.defaultPrice ?? 0),
      defaultWholesalePrice: Math.max(
        0,
        productData.defaultWholesalePrice ?? Math.round((productData.defaultPrice ?? 0) * 1.25)
      ),
      openingStock: initialOpening,
      currentStock: existing
        ? (existing.currentStock ?? initialOpening)
        : (productData.currentStock ?? initialOpening),
      minStockAlert: productData.minStockAlert ?? 10,
      active: productData.active !== false,
      notes: productData.notes || '',
      createdAt: existing?.createdAt || productData.createdAt || now,
      updatedAt: now,
      revision: (existing?.revision || 0) + 1,
    };

    await productRepo.save(toSave);

    // If newly created product has openingStock > 0, record opening stock movement atomically
    if (isNew && initialOpening > 0) {
      const movementId = generateStableId('mv');
      const movement: StockMovementRecord = {
        id: movementId,
        productId: id,
        productName: toSave.name,
        movementType: 'OPENING_BALANCE',
        quantity: initialOpening,
        direction: 'INITIAL',
        signedQuantity: initialOpening,
        referenceType: 'OPENING',
        referenceId: id,
        referenceVoucherNo: 'OPENING',
        counterpartName: 'စတင်လက်ကျန် (Opening Balance)',
        unitPrice: toSave.defaultPrice,
        totalValue: initialOpening * toSave.defaultPrice,
        transactionDate: now.slice(0, 10),
        transactionTime: now.slice(11, 16),
        createdAt: now,
        status: 'COMPLETED',
        idempotencyKey: `OPENING_${id}`,
        schemaVersion: 1,
      };
      await stockMovementRepo.recordMovement(movement);
    }

    await auditRepo.log(
      isNew ? 'ကုန်ပစ္စည်းအသစ်ဖန်တီးခြင်း' : 'ကုန်ပစ္စည်းအချက်အလက်ပြင်ဆင်ခြင်း',
      `${toSave.name} (${toSave.category}) | ယူနစ်: ${toSave.unit} | စတင်လက်ကျန်: ${toSave.openingStock}`,
      'PRODUCT',
      toSave.id
    );

    return toSave;
  }

  async deleteProductSafe(
    productId: string
  ): Promise<{ success: boolean; softDeleted: boolean; message: string }> {
    const product = await productRepo.getById(productId);
    if (!product) {
      throw new Error(`Product "${productId}" not found`);
    }

    const refCheck = await this.checkProductReferences(productId);

    if (refCheck.hasReferences) {
      // Must soft-delete to preserve foreign-key audit trails
      await softDeleteRepo.softDeleteAtomic(
        'PRODUCT',
        productId,
        product.name,
        `ဆက်စပ်မှတ်တမ်းများ ရှိနေသောကြောင့် မော်ကွန်းထိန်းသိမ်းခဲ့သည် (${refCheck.details.join(', ')})`
      );
      // Mark inactive in products table
      await productRepo.save({
        ...product,
        active: false,
        updatedAt: new Date().toISOString(),
      });
      return {
        success: true,
        softDeleted: true,
        message: `ကုန်ပစ္စည်းတွင် ${refCheck.details.join('၊ ')} ရှိနေသဖြင့် အပြီးပယ်ဖျက်မည့်အစား မော်ကွန်းထိန်းသိမ်း (Soft Delete) ထားရှိလိုက်ပါသည်`,
      };
    } else {
      // Hard delete safe because zero references exist
      await productRepo.delete(productId);
      await auditRepo.log(
        'ကုန်ပစ္စည်း အပြီးတိုင်ဖျက်သိမ်းခြင်း',
        `${product.name} (${productId}) အား စနစ်တွင်းမှ အပြီးတိုင်ဖျက်ပစ်ခဲ့သည်`,
        'PRODUCT',
        productId
      );
      return {
        success: true,
        softDeleted: false,
        message: 'ကုန်ပစ္စည်းအား စနစ်တွင်းမှ အပြီးတိုင် ဖျက်ပစ်ပြီးပါပြီ',
      };
    }
  }

  // ==========================================
  // SUPPLIER MASTER VALIDATION & OPERATIONS
  // ==========================================

  validateSupplier(
    supplier: Partial<Supplier>,
    existingSuppliers: Supplier[] = [],
    isEditingId?: string
  ): { isValid: boolean; error?: string } {
    const name = (supplier.name || '').trim();
    if (!name) {
      return { isValid: false, error: 'ပေးသွင်းသူ/လက်မှုပညာရှင် အမည် ထည့်သွင်းရန် လိုအပ်ပါသည်' };
    }

    // Check duplicate code if code provided
    const code = (supplier.code || '').trim();
    if (code) {
      const dupCode = existingSuppliers.find(
        (s) => s.id !== isEditingId && s.code?.trim().toLowerCase() === code.toLowerCase()
      );
      if (dupCode) {
        return { isValid: false, error: `ကုတ်နံပါတ် "${code}" ဖြင့် ပေးသွင်းသူ ရှိနှင့်ပြီးဖြစ်ပါသည်` };
      }
    }

    return { isValid: true };
  }

  async checkSupplierReferences(supplierId: string): Promise<ReferentialCheckResult> {
    const details: string[] = [];
    let count = 0;

    const txs = await db.transactions.where('supplierId').equals(supplierId).toArray();
    if (txs.length > 0) {
      details.push(`ကုန်သိမ်းမှတ်တမ်း ${txs.length} ခု`);
      count += txs.length;
    }

    return {
      hasReferences: count > 0,
      details,
      referenceCount: count,
    };
  }

  async saveSupplier(supplierData: Partial<Supplier>): Promise<Supplier> {
    const isNew = !supplierData.id;
    const allSuppliers = await supplierRepo.getAll();
    const validation = this.validateSupplier(supplierData, allSuppliers, supplierData.id);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const id = supplierData.id || generateStableId('sup');
    const now = new Date().toISOString();
    const existing = supplierData.id ? await supplierRepo.getById(supplierData.id) : undefined;

    const toSave: Supplier = {
      id,
      code: supplierData.code || '',
      name: (supplierData.name || '').trim(),
      village: (supplierData.village || 'ကူနီ').trim(),
      phone: supplierData.phone || '',
      currentAdvanceBalance: existing?.currentAdvanceBalance ?? supplierData.currentAdvanceBalance ?? 0,
      totalGoodsValueDelivered: existing?.totalGoodsValueDelivered ?? supplierData.totalGoodsValueDelivered ?? 0,
      totalAdvanceGiven: existing?.totalAdvanceGiven ?? supplierData.totalAdvanceGiven ?? 0,
      notes: supplierData.notes || '',
      createdAt: existing?.createdAt || supplierData.createdAt || now,
      updatedAt: now,
    };

    await supplierRepo.save(toSave);

    await auditRepo.log(
      isNew ? 'ပေးသွင်းသူအသစ်မှတ်ပုံတင်ခြင်း' : 'ပေးသွင်းသူအချက်အလက်ပြင်ဆင်ခြင်း',
      `${toSave.name} (${toSave.village}) | ဖုန်း: ${toSave.phone || 'မရှိ'} | အကြိုငွေလက်ကျန်: ${(toSave.currentAdvanceBalance || 0).toLocaleString()} ကျပ်`,
      'SUPPLIER',
      toSave.id
    );

    return toSave;
  }

  async deleteSupplierSafe(
    supplierId: string
  ): Promise<{ success: boolean; softDeleted: boolean; message: string }> {
    const supplier = await supplierRepo.getById(supplierId);
    if (!supplier) {
      throw new Error(`Supplier "${supplierId}" not found`);
    }

    const refCheck = await this.checkSupplierReferences(supplierId);

    if (refCheck.hasReferences || (supplier.currentAdvanceBalance || 0) > 0) {
      const reason = (supplier.currentAdvanceBalance || 0) > 0
        ? `အကြိုငွေကျန် ${(supplier.currentAdvanceBalance || 0).toLocaleString()} ကျပ် ရှိနေပါသည်`
        : `ဆက်စပ်မှတ်တမ်းများ ရှိနေပါသည် (${refCheck.details.join(', ')})`;

      await softDeleteRepo.softDeleteAtomic('SUPPLIER', supplierId, supplier.name, reason);
      return {
        success: true,
        softDeleted: true,
        message: `ပေးသွင်းသူတွင် ${reason} သဖြင့် မော်ကွန်းထိန်းသိမ်း (Soft Delete) ထားရှိလိုက်ပါသည်`,
      };
    } else {
      await supplierRepo.delete(supplierId);
      await auditRepo.log(
        'ပေးသွင်းသူ အပြီးတိုင်ဖျက်သိမ်းခြင်း',
        `${supplier.name} (${supplierId}) အား စနစ်တွင်းမှ အပြီးတိုင်ဖျက်ပစ်ခဲ့သည်`,
        'SUPPLIER',
        supplierId
      );
      return {
        success: true,
        softDeleted: false,
        message: 'ပေးသွင်းသူအား စနစ်တွင်းမှ အပြီးတိုင် ဖျက်ပစ်ပြီးပါပြီ',
      };
    }
  }

  // ==========================================
  // MERCHANT MASTER VALIDATION & OPERATIONS
  // ==========================================

  validateMerchant(
    merchant: Partial<Merchant>,
    existingMerchants: Merchant[] = [],
    isEditingId?: string
  ): { isValid: boolean; error?: string } {
    const name = (merchant.name || '').trim();
    if (!name) {
      return { isValid: false, error: 'ကုန်သည်/ဖောက်သည် အမည် ထည့်သွင်းရန် လိုအပ်ပါသည်' };
    }

    const code = (merchant.code || '').trim();
    if (code) {
      const dupCode = existingMerchants.find(
        (m) => m.id !== isEditingId && m.code?.trim().toLowerCase() === code.toLowerCase()
      );
      if (dupCode) {
        return { isValid: false, error: `ကုတ်နံပါတ် "${code}" ဖြင့် ကုန်သည် ရှိနှင့်ပြီးဖြစ်ပါသည်` };
      }
    }

    return { isValid: true };
  }

  async checkMerchantReferences(merchantId: string): Promise<ReferentialCheckResult> {
    const details: string[] = [];
    let count = 0;

    const sales = await db.sales.where('merchantId').equals(merchantId).toArray();
    if (sales.length > 0) {
      details.push(`အရောင်းမှတ်တမ်း ${sales.length} ခု`);
      count += sales.length;
    }

    const purchases = await db.merchantPurchases.where('merchantId').equals(merchantId).toArray();
    if (purchases.length > 0) {
      details.push(`ကုန်ကြမ်းဝယ်ယူမှု ${purchases.length} ခု`);
      count += purchases.length;
    }

    const orders = await db.orders.where('merchantId').equals(merchantId).toArray();
    if (orders.length > 0) {
      details.push(`အော်ဒါမှတ်တမ်း ${orders.length} ခု`);
      count += orders.length;
    }

    return {
      hasReferences: count > 0,
      details,
      referenceCount: count,
    };
  }

  async saveMerchant(merchantData: Partial<Merchant>): Promise<Merchant> {
    const isNew = !merchantData.id;
    const allMerchants = await merchantRepo.getAll();
    const validation = this.validateMerchant(merchantData, allMerchants, merchantData.id);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const id = merchantData.id || generateStableId('mer');
    const now = new Date().toISOString();
    const existing = merchantData.id ? await merchantRepo.getById(merchantData.id) : undefined;

    const toSave: Merchant = {
      id,
      code: merchantData.code || '',
      name: (merchantData.name || '').trim(),
      town: (merchantData.town || 'မန္တလေး').trim(),
      phone: merchantData.phone || '',
      address: merchantData.address || '',
      contactPerson: merchantData.contactPerson || '',
      role: merchantData.role || 'BUYER',
      currentReceivableBalance:
        existing?.currentReceivableBalance ?? merchantData.currentReceivableBalance ?? 0,
      payableBalance: existing?.payableBalance ?? merchantData.payableBalance ?? 0,
      totalPurchasesValue: existing?.totalPurchasesValue ?? merchantData.totalPurchasesValue ?? 0,
      totalPaidAmount: existing?.totalPaidAmount ?? merchantData.totalPaidAmount ?? 0,
      totalPurchasedFromMerchant:
        existing?.totalPurchasedFromMerchant ?? merchantData.totalPurchasedFromMerchant ?? 0,
      notes: merchantData.notes || '',
      createdAt: existing?.createdAt || merchantData.createdAt || now,
      updatedAt: now,
    };

    await merchantRepo.save(toSave);

    await auditRepo.log(
      isNew ? 'ကုန်သည်အသစ်မှတ်ပုံတင်ခြင်း' : 'ကုန်သည်အချက်အလက်ပြင်ဆင်ခြင်း',
      `${toSave.name} (${toSave.town}) | ဖုန်း: ${toSave.phone || 'မရှိ'} | ရရန်ကျန်: ${(toSave.currentReceivableBalance || 0).toLocaleString()} ကျပ်`,
      'MERCHANT',
      toSave.id
    );

    return toSave;
  }

  async deleteMerchantSafe(
    merchantId: string
  ): Promise<{ success: boolean; softDeleted: boolean; message: string }> {
    const merchant = await merchantRepo.getById(merchantId);
    if (!merchant) {
      throw new Error(`Merchant "${merchantId}" not found`);
    }

    const refCheck = await this.checkMerchantReferences(merchantId);
    const hasBalances = (merchant.currentReceivableBalance || 0) > 0 || (merchant.payableBalance || 0) > 0;

    if (refCheck.hasReferences || hasBalances) {
      const reason = hasBalances
        ? `ရရန်ကျန် ${(merchant.currentReceivableBalance || 0).toLocaleString()} ကျပ် / ပေးရန်ကျန် ${(merchant.payableBalance || 0).toLocaleString()} ကျပ် ရှိနေပါသည်`
        : `ဆက်စပ်မှတ်တမ်းများ ရှိနေပါသည် (${refCheck.details.join(', ')})`;

      await softDeleteRepo.softDeleteAtomic('MERCHANT', merchantId, merchant.name, reason);
      return {
        success: true,
        softDeleted: true,
        message: `ကုန်သည်တွင် ${reason} သဖြင့် မော်ကွန်းထိန်းသိမ်း (Soft Delete) ထားရှိလိုက်ပါသည်`,
      };
    } else {
      await merchantRepo.delete(merchantId);
      await auditRepo.log(
        'ကုန်သည် အပြီးတိုင်ဖျက်သိမ်းခြင်း',
        `${merchant.name} (${merchantId}) အား စနစ်တွင်းမှ အပြီးတိုင်ဖျက်ပစ်ခဲ့သည်`,
        'MERCHANT',
        merchantId
      );
      return {
        success: true,
        softDeleted: false,
        message: 'ကုန်သည်အား စနစ်တွင်းမှ အပြီးတိုင် ဖျက်ပစ်ပြီးပါပြီ',
      };
    }
  }
}

export const masterDataService = new MasterDataService();
