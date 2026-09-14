import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { executeGoLive } from '../services/businessInitializationService';
import { getFullDemoData } from '../data/sampleDemoData';
import { DEFAULT_APP_LOCK, DEFAULT_SHOP_SETTINGS, saveProducts, saveSuppliers, saveMerchants, saveTransactions, saveSales, saveOrders, savePeerTrades, saveStoredStockAdjustments, saveStoredMerchantPurchases, saveShopSettings } from '../utils/storage';
import {
  productRepo,
  supplierRepo,
  merchantRepo,
  transactionRepo,
  saleRepo,
  purchaseRepo,
  orderRepo,
  stockAdjustmentRepo,
  peerTradeRepo,
} from '../repositories';
import { getAuditTrail } from '../services/auditTrailService';

describe('Debug Go-Live Simulation', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('runs Go-Live exactly like the UI', async () => {
    // 1. Setup demo state like fresh app
    const demo = getFullDemoData();
    await db.products.bulkAdd(demo.products);
    await db.suppliers.bulkAdd(demo.suppliers);
    await db.merchants.bulkAdd(demo.merchants);
    await db.transactions.bulkAdd(demo.transactions);
    await db.sales.bulkAdd(demo.sales);

    // Call executeGoLive with empty setup (user just goes through wizard with defaults)
    try {
      const goLiveResult = await executeGoLive({
        pin: '',
        doubleConfirmed: true,
        appLockSettings: { ...DEFAULT_APP_LOCK, isPinInitialized: false, pinHash: undefined },
        shopSettings: DEFAULT_SHOP_SETTINGS,
        businessName: 'ရွှေလက်ရာ',
        ownerName: '',
        phone: '',
        address: '',
        tagline: '',
        customProducts: [],
        customSuppliers: [],
        customMerchants: [],
        openingPosition: {
          cash: { cashAmount: 0, bankAmount: 0, notes: '' },
          finishedGoods: [],
          rawMaterials: [],
          receivables: [],
          advances: [],
          payables: [],
          issuedMaterials: [],
          openingCapital: 0,
          notes: '',
        },
      });
      console.log('executeGoLive succeeded!');

      // Fetch fresh state from repos
      const [
        latestProducts,
        latestSuppliers,
        latestMerchants,
        latestTransactions,
        latestSales,
        latestPurchases,
        latestOrders,
        latestAdjustments,
        latestPeerTrades,
        latestShopRecord,
      ] = await Promise.all([
        productRepo.getAll(),
        supplierRepo.getAll(),
        merchantRepo.getAll(),
        transactionRepo.getAll(),
        saleRepo.getAll(),
        purchaseRepo.getAll(),
        orderRepo.getAll(),
        stockAdjustmentRepo.getAll(),
        peerTradeRepo.getAll(),
        db.settings.get('shopSettings'),
      ]);

      const finalProducts = latestProducts && latestProducts.length > 0 ? latestProducts : goLiveResult.cleanedProducts;
      const finalSuppliers = latestSuppliers && latestSuppliers.length > 0 ? latestSuppliers : goLiveResult.cleanedSuppliers;
      const finalMerchants = latestMerchants && latestMerchants.length > 0 ? latestMerchants : goLiveResult.cleanedMerchants;
      const finalTransactions = latestTransactions || [];
      const finalSales = latestSales || [];
      const finalPurchases = latestPurchases || [];
      const finalOrders = latestOrders || [];
      const finalAdjustments = latestAdjustments || [];
      const finalPeerTrades = latestPeerTrades || [];

      const updatedShop = latestShopRecord?.value || {
        ...DEFAULT_SHOP_SETTINGS,
        shopName: 'ရွှေလက်ရာ',
        isLiveConfirmed: true,
        hideSampleDataButtons: true,
      };

      saveProducts(finalProducts);
      saveSuppliers(finalSuppliers);
      saveMerchants(finalMerchants);
      saveTransactions(finalTransactions);
      saveSales(finalSales);
      saveOrders(finalOrders);
      savePeerTrades(finalPeerTrades);
      saveStoredStockAdjustments(finalAdjustments);
      saveStoredMerchantPurchases(finalPurchases);
      saveShopSettings(updatedShop);

      const latestLogs = await getAuditTrail({ limit: 200 });
      console.log('Audit logs loaded:', latestLogs.length);
    } catch (e: any) {
      console.error('executeGoLive failed with error:', e);
      throw e;
    }
  });
});

