import { db } from '../db/database';
import { Product, Supplier, Merchant, RawMaterialPreset, StockMovementRecord, CategoryDomain, MasterDataCategory } from '../types';
import {
  productRepo,
  supplierRepo,
  merchantRepo,
  softDeleteRepo,
  auditRepo,
  stockMovementRepo,
} from '../repositories';
import { generateStableId } from '../utils/idGenerator';
import { enforcePermission } from './authorizationService';

export interface ReferentialCheckResult {
  hasReferences: boolean;
  details: string[];
  referenceCount: number;
}

export const DEFAULT_FINISHED_GOODS_CATEGORIES: MasterDataCategory[] = [
  { id: 'cat_fg_finished_goods', name: 'ကုန်ချော', domain: 'FINISHED_GOODS', active: true, sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_fg_bamboo', name: 'ဝါးထည်', domain: 'FINISHED_GOODS', active: true, sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_fg_rattan', name: 'ကြိမ်ထည်', domain: 'FINISHED_GOODS', active: true, sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_fg_carving', name: 'ပန်းပု', domain: 'FINISHED_GOODS', active: true, sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_fg_other', name: 'အခြားလက်မှု', domain: 'FINISHED_GOODS', active: true, sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

export const DEFAULT_RAW_MATERIAL_CATEGORIES_MD: MasterDataCategory[] = [
  { id: 'cat_rm_bamboo', name: 'ဝါးကုန်ကြမ်း', domain: 'RAW_MATERIAL', active: true, sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_rm_rattan', name: 'ကြိမ်ကုန်ကြမ်း', domain: 'RAW_MATERIAL', active: true, sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_rm_advance', name: 'ငွေကြိုယူ', domain: 'RAW_MATERIAL', active: true, sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_rm_paint_glue', name: 'ဆေးသုတ်ပစ္စည်း/ကော်', domain: 'RAW_MATERIAL', active: true, sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_rm_other', name: 'အခြားကုန်ကြမ်း', domain: 'RAW_MATERIAL', active: true, sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

export const DEFAULT_MASTER_DATA_CATEGORIES: MasterDataCategory[] = [
  ...DEFAULT_FINISHED_GOODS_CATEGORIES,
  ...DEFAULT_RAW_MATERIAL_CATEGORIES_MD,
];

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
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်ပစ္စည်း ပြင်ဆင်/ထည့်သွင်းခြင်း');
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
    await enforcePermission('DELETE_MASTER_DATA', 'ကုန်ပစ္စည်း ဖျက်ပစ်ခြင်း');
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
    await enforcePermission('MANAGE_MASTER_DATA', 'ပေးသွင်းသူ ပြင်ဆင်/ထည့်သွင်းခြင်း');
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
    await enforcePermission('DELETE_MASTER_DATA', 'ပေးသွင်းသူ ဖျက်ပစ်ခြင်း');
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
    await enforcePermission('MANAGE_MASTER_DATA', 'ကုန်သည် ပြင်ဆင်/ထည့်သွင်းခြင်း');
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
    await enforcePermission('DELETE_MASTER_DATA', 'ကုန်သည် ဖျက်ပစ်ခြင်း');
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

  // ==========================================
  // MASTER DATA CATEGORY OPERATIONS
  // ==========================================

  async getMasterDataCategories(
    domain?: CategoryDomain,
    activeOnly: boolean = false
  ): Promise<MasterDataCategory[]> {
    let list: MasterDataCategory[] = [];
    const setting = await db.settings.get('masterDataCategories');
    if (setting && Array.isArray(setting.value) && setting.value.length > 0) {
      list = setting.value;
    } else {
      list = DEFAULT_MASTER_DATA_CATEGORIES;
      await db.settings.put({
        key: 'masterDataCategories',
        value: list,
        updatedAt: new Date().toISOString(),
      });
    }

    let filtered = list;
    if (domain) {
      filtered = filtered.filter((c) => c.domain === domain);
    }
    if (activeOnly) {
      filtered = filtered.filter((c) => c.active !== false);
    }
    return filtered.sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
  }

  async addCategory(domain: CategoryDomain, name: string): Promise<MasterDataCategory> {
    await enforcePermission('MANAGE_MASTER_DATA', 'အမျိုးအစား အသစ်ထည့်သွင်းခြင်း');
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new Error('အမျိုးအစားအမည် ထည့်သွင်းရန် လိုအပ်ပါသည်');
    }
    if (domain !== 'FINISHED_GOODS' && domain !== 'RAW_MATERIAL') {
      throw new Error('အမျိုးအစား နယ်ပယ် မမှန်ကန်ပါ');
    }

    const allCategories = await this.getMasterDataCategories();
    const duplicate = allCategories.find(
      (c) => c.domain === domain && c.active !== false && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error('ဤအမျိုးအစားအမည် ရှိနှင့်ပြီးဖြစ်ပါသည်');
    }

    const now = new Date().toISOString();
    const newCat: MasterDataCategory = {
      id: generateStableId('cat'),
      name: trimmed,
      domain,
      active: true,
      sortOrder: allCategories.filter((c) => c.domain === domain).length + 1,
      createdAt: now,
      updatedAt: now,
    };

    const updatedList = [...allCategories, newCat];
    await db.settings.put({
      key: 'masterDataCategories',
      value: updatedList,
      updatedAt: now,
    });

    // Synchronize secondary storage caches
    try {
      if (domain === 'RAW_MATERIAL') {
        const rawCatsSetting = await db.settings.get('rawMaterialCategories');
        const currentRawCats = (rawCatsSetting && Array.isArray(rawCatsSetting.value)) ? rawCatsSetting.value : [];
        if (!currentRawCats.includes(trimmed)) {
          const updatedRawCats = [...currentRawCats, trimmed];
          await db.settings.put({ key: 'rawMaterialCategories', value: updatedRawCats, updatedAt: now });
          localStorage.setItem('ledger_raw_material_categories_v1', JSON.stringify(updatedRawCats));
        }
      } else if (domain === 'FINISHED_GOODS') {
        const prodCatsSetting = await db.settings.get('productCategories');
        const currentProdCats = (prodCatsSetting && Array.isArray(prodCatsSetting.value)) ? prodCatsSetting.value : [];
        if (!currentProdCats.includes(trimmed)) {
          const updatedProdCats = [...currentProdCats, trimmed];
          await db.settings.put({ key: 'productCategories', value: updatedProdCats, updatedAt: now });
          localStorage.setItem('ledger_product_categories_v1', JSON.stringify(updatedProdCats));
        }
      }
    } catch (e) {
      console.warn('Category sync warning:', e);
    }

    await auditRepo.log(
      'CATEGORY_CREATED',
      `အမျိုးအစားအသစ် ဖန်တီးခြင်း: ${trimmed} (${domain === 'FINISHED_GOODS' ? 'အချောထည်' : 'ကုန်ကြမ်း'})`,
      'MASTER_DATA',
      newCat.id
    );

    return newCat;
  }

  async renameCategory(categoryId: string, newName: string): Promise<MasterDataCategory> {
    await enforcePermission('MANAGE_MASTER_DATA', 'အမျိုးအစား အမည်ပြင်ဆင်ခြင်း');
    const trimmed = (newName || '').trim();
    if (!trimmed) {
      throw new Error('အမျိုးအစားအမည် ထည့်သွင်းရန် လိုအပ်ပါသည်');
    }

    const allCategories = await this.getMasterDataCategories();
    const target = allCategories.find((c) => c.id === categoryId);
    if (!target) {
      throw new Error('အမျိုးအစား ရှာမတွေ့ပါ');
    }

    const duplicate = allCategories.find(
      (c) => c.id !== categoryId && c.domain === target.domain && c.active !== false && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      throw new Error('ဤအမျိုးအစားအမည် ရှိနှင့်ပြီးဖြစ်ပါသည်');
    }

    const oldName = target.name;
    const now = new Date().toISOString();
    const updatedCat: MasterDataCategory = {
      ...target,
      name: trimmed,
      updatedAt: now,
    };

    const updatedList = allCategories.map((c) => (c.id === categoryId ? updatedCat : c));
    await db.settings.put({
      key: 'masterDataCategories',
      value: updatedList,
      updatedAt: now,
    });

    // Synchronize presets and products with new category name
    try {
      if (target.domain === 'RAW_MATERIAL') {
        // 1. Update presets in db
        const presets = await db.rawMaterialPresets.toArray();
        for (const preset of presets) {
          if (preset.categoryLabel === oldName || preset.category === oldName || preset.category === categoryId) {
            await db.rawMaterialPresets.put({
              ...preset,
              categoryLabel: trimmed,
              category: preset.category === oldName ? trimmed : preset.category,
            });
          }
        }
        // 2. Update localStorage presets
        const rawPresetsStr = localStorage.getItem('ledger_raw_material_presets_v1');
        if (rawPresetsStr) {
          const rawPresets = JSON.parse(rawPresetsStr);
          if (Array.isArray(rawPresets)) {
            const updatedPresets = rawPresets.map((p: any) => {
              if (p.categoryLabel === oldName || p.category === oldName || p.category === categoryId) {
                return {
                  ...p,
                  categoryLabel: trimmed,
                  category: p.category === oldName ? trimmed : p.category,
                };
              }
              return p;
            });
            localStorage.setItem('ledger_raw_material_presets_v1', JSON.stringify(updatedPresets));
          }
        }
        // 3. Update rawMaterialCategories list
        const rawCatsSetting = await db.settings.get('rawMaterialCategories');
        if (rawCatsSetting && Array.isArray(rawCatsSetting.value)) {
          const updatedRawCats = rawCatsSetting.value.map((c: string) => (c === oldName ? trimmed : c));
          await db.settings.put({ key: 'rawMaterialCategories', value: updatedRawCats, updatedAt: now });
        }
        const localCats = localStorage.getItem('ledger_raw_material_categories_v1');
        if (localCats) {
          const parsed = JSON.parse(localCats);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((c: string) => (c === oldName ? trimmed : c));
            localStorage.setItem('ledger_raw_material_categories_v1', JSON.stringify(updated));
          }
        }
      } else if (target.domain === 'FINISHED_GOODS') {
        // 1. Update products in db
        const prods = await db.products.toArray();
        for (const prod of prods) {
          if (prod.category === oldName || prod.categoryId === categoryId) {
            await db.products.put({
              ...prod,
              category: trimmed,
              categoryId: categoryId,
              updatedAt: now,
            });
          }
        }
        // 2. Update productCategories list
        const prodCatsSetting = await db.settings.get('productCategories');
        if (prodCatsSetting && Array.isArray(prodCatsSetting.value)) {
          const updatedProdCats = prodCatsSetting.value.map((c: string) => (c === oldName ? trimmed : c));
          await db.settings.put({ key: 'productCategories', value: updatedProdCats, updatedAt: now });
        }
        const localCats = localStorage.getItem('ledger_product_categories_v1');
        if (localCats) {
          const parsed = JSON.parse(localCats);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((c: string) => (c === oldName ? trimmed : c));
            localStorage.setItem('ledger_product_categories_v1', JSON.stringify(updated));
          }
        }
      }
    } catch (err) {
      console.warn('Cascade update category warning:', err);
    }

    await auditRepo.log(
      'CATEGORY_RENAMED',
      `အမျိုးအစား အမည်ပြင်ဆင်ခြင်း (Renamed): ${oldName} -> ${trimmed}`,
      'MASTER_DATA',
      categoryId
    );

    return updatedCat;
  }

  async deactivateCategory(categoryId: string): Promise<MasterDataCategory> {
    await enforcePermission('MANAGE_MASTER_DATA', 'အမျိုးအစား ပိတ်သိမ်းခြင်း');
    const allCategories = await this.getMasterDataCategories();
    const target = allCategories.find((c) => c.id === categoryId);
    if (!target) {
      throw new Error('အမျိုးအစား ရှာမတွေ့ပါ');
    }

    const now = new Date().toISOString();
    const updatedCat: MasterDataCategory = {
      ...target,
      active: false,
      updatedAt: now,
    };

    const updatedList = allCategories.map((c) => (c.id === categoryId ? updatedCat : c));
    await db.settings.put({
      key: 'masterDataCategories',
      value: updatedList,
      updatedAt: now,
    });

    await auditRepo.log(
      'CATEGORY_DEACTIVATED',
      `အမျိုးအစား ပိတ်ထားခြင်း (Deactivated): ${target.name}`,
      'MASTER_DATA',
      categoryId
    );

    return updatedCat;
  }

  async reactivateCategory(categoryId: string): Promise<MasterDataCategory> {
    await enforcePermission('MANAGE_MASTER_DATA', 'အမျိုးအစား ပြန်လည်ဖွင့်လှစ်ခြင်း');
    const allCategories = await this.getMasterDataCategories();
    const target = allCategories.find((c) => c.id === categoryId);
    if (!target) {
      throw new Error('အမျိုးအစား ရှာမတွေ့ပါ');
    }

    const now = new Date().toISOString();
    const updatedCat: MasterDataCategory = {
      ...target,
      active: true,
      updatedAt: now,
    };

    const updatedList = allCategories.map((c) => (c.id === categoryId ? updatedCat : c));
    await db.settings.put({
      key: 'masterDataCategories',
      value: updatedList,
      updatedAt: now,
    });

    await auditRepo.log(
      'CATEGORY_REACTIVATED',
      `အမျိုးအစား ပြန်လည်ဖွင့်လှစ်ခြင်း (Reactivated): ${target.name}`,
      'MASTER_DATA',
      categoryId
    );

    return updatedCat;
  }

  async deleteCategorySafe(
    categoryId: string
  ): Promise<{ success: boolean; softDeactivated: boolean; message: string }> {
    await enforcePermission('DELETE_MASTER_DATA', 'အမျိုးအစား ဖျက်ပစ်ခြင်း');
    const allCategories = await this.getMasterDataCategories();
    const target = allCategories.find((c) => c.id === categoryId);
    if (!target) {
      throw new Error('အမျိုးအစား ရှာမတွေ့ပါ');
    }

    const products = await db.products.toArray();
    const presets = await db.rawMaterialPresets.toArray();
    const txs = await db.transactions.toArray();
    const sales = await db.sales.toArray();
    const purchases = await db.merchantPurchases.toArray();
    const adjustments = await db.stockAdjustments.toArray();
    const peerTrades = await db.peerTrades.toArray();
    const movements = await db.stockMovements.toArray();

    const isReferencedByProduct = products.some(
      (p) => p.categoryId === categoryId || p.category === target.name
    );
    const isReferencedByPreset = presets.some(
      (pr) => pr.category === categoryId || pr.categoryLabel === target.name || pr.category === target.name
    );
    const isReferencedByTx = txs.some(
      (t) => (t.items || []).some((item: any) => item.categoryId === categoryId || item.category === target.name)
    );
    const isReferencedBySale = sales.some(
      (s) => (s.items || []).some((item: any) => item.categoryId === categoryId || item.category === target.name)
    );
    const isReferencedByPurchase = purchases.some(
      (pur: any) => (pur.items || []).some((item: any) => item.categoryId === categoryId || item.category === target.name) || pur.category === categoryId || pur.category === target.name
    );
    const isReferencedByAdjustment = adjustments.some(
      (adj: any) => adj.categoryId === categoryId || adj.category === target.name
    );
    const isReferencedByTrade = peerTrades.some(
      (trade: any) => trade.categoryId === categoryId || trade.category === target.name
    );
    const isReferencedByMovement = movements.some(
      (m: any) => m.categoryId === categoryId || m.category === target.name
    );

    if (
      isReferencedByProduct ||
      isReferencedByPreset ||
      isReferencedByTx ||
      isReferencedBySale ||
      isReferencedByPurchase ||
      isReferencedByAdjustment ||
      isReferencedByTrade ||
      isReferencedByMovement
    ) {
      await this.deactivateCategory(categoryId);
      return {
        success: true,
        softDeactivated: true,
        message: 'အသုံးပြုထားသော ကုန်ပစ္စည်း/ကုန်ကြမ်း/သမိုင်းဝင် မှတ်တမ်းများ ရှိနေသဖြင့် အပြီးတိုင်ဖျက်မည့်အစား ပိတ်ထား (Deactivate) လိုက်ပါသည်',
      };
    } else {
      const now = new Date().toISOString();
      const updatedList = allCategories.filter((c) => c.id !== categoryId);
      await db.settings.put({
        key: 'masterDataCategories',
        value: updatedList,
        updatedAt: now,
      });

      await auditRepo.log(
        'CATEGORY_DELETED',
        `အမျိုးအစား အပြီးတိုင်ဖျက်ပစ်ခြင်း: ${target.name}`,
        'MASTER_DATA',
        categoryId
      );

      return {
        success: true,
        softDeactivated: false,
        message: 'အမျိုးအစားအား စနစ်တွင်းမှ အပြီးတိုင် ဖျက်ပစ်ပြီးပါပြီ',
      };
    }
  }

  async resolveCategoryDisplay(categoryRef: string, domain?: CategoryDomain): Promise<string> {
    if (!categoryRef) return 'အထွေထွေ';
    const allCats = await this.getMasterDataCategories(domain);
    const found = allCats.find((c) => c.id === categoryRef || c.name === categoryRef);
    return found ? found.name : categoryRef;
  }
}

export const masterDataService = new MasterDataService();
