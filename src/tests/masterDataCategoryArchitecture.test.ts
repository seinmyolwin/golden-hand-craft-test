import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import { masterDataService } from '../services/masterDataService';
import { createCompleteBackup, executeSafeRestore } from '../services/backupService';
import { Product, MasterDataCategory } from '../types';

describe('Phase 18B — Master Data & Category Architecture', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.suppliers.clear();
    await db.merchants.clear();
    await db.transactions.clear();
    await db.sales.clear();
    await db.merchantPurchases.clear();
    await db.orders.clear();
    await db.stockAdjustments.clear();
    await db.peerTrades.clear();
    await db.rawMaterialPresets.clear();
    await db.settings.clear();
    await db.auditLogs.clear();
  });

  describe('1. Canonical Settings Store & Initialization', () => {
    it('initializes default categories in db.settings when fetched for the first time', async () => {
      const categories = await masterDataService.getMasterDataCategories();
      expect(categories.length).toBeGreaterThan(0);
      
      const finishedGoods = categories.filter((c) => c.domain === 'FINISHED_GOODS');
      const rawMaterials = categories.filter((c) => c.domain === 'RAW_MATERIAL');

      expect(finishedGoods.length).toBeGreaterThan(0);
      expect(rawMaterials.length).toBeGreaterThan(0);

      // Verify db.settings holds masterDataCategories
      const setting = await db.settings.get('masterDataCategories');
      expect(setting).toBeDefined();
      expect(setting?.value.length).toBe(categories.length);
    });
  });

  describe('2. Category Creation with Stable IDs & Validation', () => {
    it('creates a new Finished Goods category with whitespace trimming', async () => {
      const newCat = await masterDataService.addCategory('FINISHED_GOODS', '  ကျွန်းပန်းပု  ');
      expect(newCat.id).toBeDefined();
      expect(newCat.name).toBe('ကျွန်းပန်းပု');
      expect(newCat.domain).toBe('FINISHED_GOODS');
      expect(newCat.active).toBe(true);

      const all = await masterDataService.getMasterDataCategories('FINISHED_GOODS');
      const found = all.find((c) => c.id === newCat.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('ကျွန်းပန်းပု');
    });

    it('creates a new Raw Material category', async () => {
      const newCat = await masterDataService.addCategory('RAW_MATERIAL', 'သစ်စေး (ကုန်ကြမ်း)');
      expect(newCat.id).toBeDefined();
      expect(newCat.domain).toBe('RAW_MATERIAL');

      const all = await masterDataService.getMasterDataCategories('RAW_MATERIAL');
      expect(all.some((c) => c.id === newCat.id)).toBe(true);
    });

    it('rejects empty name or duplicate name in same domain', async () => {
      await expect(masterDataService.addCategory('FINISHED_GOODS', '   ')).rejects.toThrow('အမျိုးအစားအမည် ထည့်သွင်းရန် လိုအပ်ပါသည်');

      await masterDataService.addCategory('FINISHED_GOODS', 'ဝါးထည်အသစ်');
      await expect(masterDataService.addCategory('FINISHED_GOODS', 'ဝါးထည်အသစ်')).rejects.toThrow('ဤအမျိုးအစားအမည် ရှိနှင့်ပြီးဖြစ်ပါသည်');
      await expect(masterDataService.addCategory('FINISHED_GOODS', '  ဝါးထည်အသစ်  ')).rejects.toThrow('ဤအမျိုးအစားအမည် ရှိနှင့်ပြီးဖြစ်ပါသည်');
    });
  });

  describe('3. Category Renaming', () => {
    it('renames category and updates database without breaking references', async () => {
      const cat = await masterDataService.addCategory('FINISHED_GOODS', 'မူလအမည်');
      const renamed = await masterDataService.renameCategory(cat.id, 'အမည်သစ်');
      expect(renamed.name).toBe('အမည်သစ်');

      const all = await masterDataService.getMasterDataCategories('FINISHED_GOODS');
      expect(all.find((c) => c.id === cat.id)?.name).toBe('အမည်သစ်');

      // Verify audit log entry was created
      const logs = await db.auditLogs.toArray();
      expect(logs.some((l) => l.action.includes('CATEGORY_RENAMED') || l.details.includes('အမည်သစ်'))).toBe(true);
    });
  });

  describe('4. Category Deactivation and Reactivation', () => {
    it('deactivates category safely without physical deletion', async () => {
      const cat = await masterDataService.addCategory('FINISHED_GOODS', 'ယာယီပိတ်မည့်အမျိုးအစား');
      
      const deactivated = await masterDataService.deactivateCategory(cat.id);
      expect(deactivated.active).toBe(false);

      const activeOnly = await masterDataService.getMasterDataCategories('FINISHED_GOODS', true);
      expect(activeOnly.some((c) => c.id === cat.id)).toBe(false);

      const all = await masterDataService.getMasterDataCategories('FINISHED_GOODS', false);
      expect(all.some((c) => c.id === cat.id)).toBe(true);
    });

    it('reactivates a deactivated category', async () => {
      const cat = await masterDataService.addCategory('FINISHED_GOODS', 'ပြန်ဖွင့်မည့်အမျိုးအစား');
      await masterDataService.deactivateCategory(cat.id);

      const reactivated = await masterDataService.reactivateCategory(cat.id);
      expect(reactivated.active).toBe(true);

      const activeOnly = await masterDataService.getMasterDataCategories('FINISHED_GOODS', true);
      expect(activeOnly.some((c) => c.id === cat.id)).toBe(true);
    });
  });

  describe('5. Safe Delete Guard', () => {
    it('soft-deactivates category if referenced by products', async () => {
      const cat = await masterDataService.addCategory('FINISHED_GOODS', 'အထူးဝါးထည်');
      
      // Add a product referencing this category
      const product: Product = {
        id: 'p-cat-ref',
        name: 'ဝါးခြင်းတောင်း',
        category: 'အထူးဝါးထည်',
        categoryId: cat.id,
        defaultPrice: 5000,
        unit: 'လုံး',
        active: true,
      };
      await db.products.add(product);

      const result = await masterDataService.deleteCategorySafe(cat.id);
      expect(result.success).toBe(true);
      expect(result.softDeactivated).toBe(true);

      const all = await masterDataService.getMasterDataCategories('FINISHED_GOODS');
      const found = all.find((c) => c.id === cat.id);
      expect(found?.active).toBe(false);
    });

    it('deletes category permanently if zero references exist', async () => {
      const cat = await masterDataService.addCategory('FINISHED_GOODS', 'အသုံးမပြုသောအမျိုးအစား');
      
      const result = await masterDataService.deleteCategorySafe(cat.id);
      expect(result.success).toBe(true);
      expect(result.softDeactivated).toBe(false);

      const all = await masterDataService.getMasterDataCategories('FINISHED_GOODS');
      expect(all.some((c) => c.id === cat.id)).toBe(false);
    });
  });

  describe('6. Backup & Restore Data Integrity', () => {
    it('includes master data categories in backup and restores them faithfully', async () => {
      const customCat = await masterDataService.addCategory('FINISHED_GOODS', 'စမ်းသပ်အမျိုးအစား');
      
      const backup = await createCompleteBackup();
      expect(backup.data.masterDataCategories).toBeDefined();
      expect(backup.data.masterDataCategories?.some((c) => c.id === customCat.id)).toBe(true);

      // Clear settings and restore
      await db.settings.clear();
      await executeSafeRestore(
        {
          isValid: true,
          isCorrupted: false,
          formatVersion: '3.0',
          detectedSchemaVersion: 9,
          checksumValid: true,
          exportedAt: new Date().toISOString(),
          shopName: 'ရွှေလက်ရာ',
          appName: 'Shwe Let Yar',
          errors: [],
          warnings: [],
          normalizedData: backup.data,
          dateRange: backup.metadata.dateRange,
          totalRecords: backup.metadata.totalRecords,
          counts: backup.metadata.counts,
        },
        'OVERWRITE'
      );

      const restoredCategories = await masterDataService.getMasterDataCategories('FINISHED_GOODS');
      expect(restoredCategories.some((c) => c.id === customCat.id && c.name === 'စမ်းသပ်အမျိုးအစား')).toBe(true);
    });
  });
});
