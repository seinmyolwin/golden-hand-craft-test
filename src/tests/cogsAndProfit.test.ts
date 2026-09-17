import { describe, it, expect, beforeEach } from 'vitest';
import { calculateWeightedAverageCost } from '../utils/cogs';
import { db } from '../db/database';
import { ProductRepository, TransactionRepository, SaleRepository } from '../repositories';
import { Product, Supplier, Merchant } from '../types';

describe('COGS and Weighted Average Cost Tests', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('calculates weighted average cost correctly', () => {
    // Initial: 10 units @ 1000 MMK
    // Incoming: 5 units @ 1600 MMK
    // Expected: (10000 + 8000) / 15 = 1200 MMK
    const newCost = calculateWeightedAverageCost(10, 1000, 5, 1600);
    expect(newCost).toBe(1200);

    // Initial: 0 stock
    // Incoming: 10 units @ 2000 MMK
    const newCostZeroStock = calculateWeightedAverageCost(0, 0, 10, 2000);
    expect(newCostZeroStock).toBe(2000);
  });

  it('updates product avgCostPrice when inventory is collected', async () => {
    const prodRepo = new ProductRepository(db);
    const txRepo = new TransactionRepository(db);

    const product: Product = {
      id: 'prod_1',
      name: 'ယွန်းခွက်',
      defaultPrice: 1000,
      defaultWholesalePrice: 2000,
      unit: 'ခု',
      category: 'FINISHED_GOODS',
      openingStock: 10,
      currentStock: 10,
      avgCostPrice: 1000,
      active: true,
    };
    await prodRepo.save(product);

    const supplier: Supplier = {
      id: 'sup_1',
      name: 'ဦးလှ',
      phone: '0912345678',
      village: 'ပုဂံ',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.suppliers.put(supplier);

    // Inbound transaction: 10 units @ 1600 MMK
    await txRepo.saveInboundAtomic({
      id: 'tx_1',
      voucherNo: 'TX-001',
      supplierId: 'sup_1',
      supplierName: 'ဦးလှ',
      date: '2026-03-01',
      time: '10:00',
      items: [
        {
          productId: 'prod_1',
          productName: 'ယွန်းခွက်',
          quantity: 10,
          unitPrice: 1600,
          subtotal: 16000,
          unit: 'ခု',
        },
      ],
      totalGoodsValue: 16000,
      advanceDeducted: 0,
      cashPaidToSupplier: 16000,
      netCashPaidToSupplier: 16000,
      paidAmount: 16000,
      paymentMethod: 'CASH',
    });

    const updatedProd = await prodRepo.getById('prod_1');
    expect(updatedProd?.currentStock).toBe(20);
    // (10 * 1000 + 10 * 1600) / 20 = 1300 MMK
    expect(updatedProd?.avgCostPrice).toBe(1300);
  });

  it('populates costPrice on sale items during sale processing', async () => {
    const prodRepo = new ProductRepository(db);
    const saleRepo = new SaleRepository(db);

    const product: Product = {
      id: 'prod_2',
      name: 'ယွန်းသေတ္တာ',
      defaultPrice: 5000,
      defaultWholesalePrice: 8000,
      unit: 'ခု',
      category: 'FINISHED_GOODS',
      openingStock: 10,
      currentStock: 10,
      avgCostPrice: 5000,
      active: true,
    };
    await prodRepo.save(product);

    const merchant: Merchant = {
      id: 'merch_1',
      name: 'မန္တလေးဒိုင်',
      town: 'မန္တလေး',
      phone: '0987654321',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.merchants.put(merchant);

    const sale = await saleRepo.saveSaleAtomic({
      id: 'sale_1',
      voucherNo: 'SALE-001',
      merchantId: 'merch_1',
      merchantName: 'မန္တလေးဒိုင်',
      date: '2026-03-02',
      time: '11:00',
      items: [
        {
          productId: 'prod_2',
          productName: 'ယွန်းသေတ္တာ',
          quantity: 2,
          unitPrice: 8000,
          subtotal: 16000,
          unit: 'ခု',
        },
      ],
      grandTotal: 16000,
      paidAmount: 16000,
      cashPaidByMerchant: 16000,
      paymentMethod: 'CASH',
    });

    expect(sale.items[0].costPrice).toBe(5000);
  });
});
