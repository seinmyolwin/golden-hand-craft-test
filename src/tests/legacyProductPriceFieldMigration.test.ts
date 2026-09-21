import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { migrateLegacyProductPriceFieldNames } from '../services/databaseHealthService';
import { Product } from '../types';

describe('Legacy product price field-name migration (Go-Live setup bug)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('migrates products saved with old "wholesalePrice"/"purchasePrice" field names', async () => {
    const legacyProduct = {
      id: 'p-legacy-1',
      code: 'P-1',
      name: 'ဝါးခြင်းတောင်း (အကြီး)',
      category: 'ဝါးထည်',
      unit: 'လုံး',
      openingStock: 20,
      currentStock: 20,
      defaultPrice: 9000,
      wholesalePrice: 9000,
      purchasePrice: 7000,
      minStockAlert: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isUserCreated: true,
    } as unknown as Product;

    await db.products.add(legacyProduct);

    const result = await migrateLegacyProductPriceFieldNames();
    expect(result.scanned).toBe(1);
    expect(result.migrated).toBe(1);
    expect(result.migratedProductIds).toContain('p-legacy-1');

    const migrated = await db.products.get('p-legacy-1');
    expect(migrated?.defaultWholesalePrice).toBe(9000);
    expect(migrated?.costPrice).toBe(7000);
    expect(migrated?.avgCostPrice).toBe(7000);
  });

  it('does not touch products that already have correct field names', async () => {
    const correctProduct: Product = {
      id: 'p-correct-1',
      name: 'ကြိမ်တောင်း',
      category: 'ကြိမ်ထည်',
      unit: 'လုံး',
      openingStock: 10,
      currentStock: 10,
      defaultPrice: 5000,
      defaultWholesalePrice: 6500,
      costPrice: 4000,
      avgCostPrice: 4000,
      minStockAlert: 5,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.products.add(correctProduct);

    const result = await migrateLegacyProductPriceFieldNames();
    expect(result.migrated).toBe(0);

    const unchanged = await db.products.get('p-correct-1');
    expect(unchanged?.defaultWholesalePrice).toBe(6500);
    expect(unchanged?.costPrice).toBe(4000);
  });

  it('resolves the correct wholesale sale price after migration (no 25% fallback)', async () => {
    const legacyProduct = {
      id: 'p-legacy-2',
      name: 'ဝါးခြင်းတောင်း (အကြီး)',
      category: 'ဝါးထည်',
      unit: 'လုံး',
      openingStock: 20,
      currentStock: 20,
      defaultPrice: 9000,
      wholesalePrice: 9000,
      purchasePrice: 7000,
      minStockAlert: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Product;

    await db.products.add(legacyProduct);
    await migrateLegacyProductPriceFieldNames();

    const product = await db.products.get('p-legacy-2');
    const resolvedWholesalePrice =
      product?.defaultWholesalePrice || Math.round((product?.defaultPrice || 0) * 1.25);

    expect(resolvedWholesalePrice).toBe(9000); // NOT 11250
  });
});
