import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ShweLetYarDatabase } from '../db/database';
import { auditDatabaseState, markDatabaseInitialized } from '../db/databaseStatus';
import { runOfflineStorageMigration, validateProducts, validateSuppliers, validateMerchants } from '../db/migration';
import {
  getStoredProducts,
  getStoredSuppliers,
  getStoredMerchants,
  getStoredTransactions,
  getStoredSales,
  getStoredStockAdjustments,
  getStoredMerchantOrders,
  getStoredPeerTraders,
} from '../utils/storage';
import { Product } from '../types';

// Polyfill localStorage for Node Vitest test runner
const memoryStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
  (globalThis as any).window = globalThis;
}

describe('Database States and Safe Data Initialization Audit', () => {
  let testDb: ShweLetYarDatabase;

  beforeEach(async () => {
    localStorage.clear();
    testDb = new ShweLetYarDatabase();
    await testDb.products.clear();
    await testDb.suppliers.clear();
    await testDb.merchants.clear();
    await testDb.transactions.clear();
    await testDb.sales.clear();
    await testDb.merchantPurchases.clear();
    await testDb.stockAdjustments.clear();
    await testDb.orders.clear();
    await testDb.peerTrades.clear();
    await testDb.softDeletedItems.clear();
    await testDb.auditLogs.clear();
    await testDb.settings.clear();
  });

  afterEach(async () => {
    localStorage.clear();
  });

  // 1. Fresh Installation
  it('1. Correctly classifies FRESH INSTALLATION without auto-injecting demo data', async () => {
    const status = await auditDatabaseState(testDb);
    expect(status.state).toBe('NOT_INITIALIZED');
    expect(status.isFreshInstall).toBe(true);
    expect(status.isEmpty).toBe(true);
    expect(status.isCorrupt).toBe(false);

    // Getters must return empty arrays, NOT default demo data
    expect(getStoredProducts()).toEqual([]);
    expect(getStoredSuppliers()).toEqual([]);
    expect(getStoredMerchants()).toEqual([]);
    expect(getStoredTransactions()).toEqual([]);
    expect(getStoredSales()).toEqual([]);
    expect(getStoredStockAdjustments()).toEqual([]);
    expect(getStoredMerchantOrders()).toEqual([]);
    expect(getStoredPeerTraders()).toEqual([]);
  });

  // 2. Valid Empty Database
  it('2. Distinguishes VALID EMPTY DATABASE after explicit initialization', async () => {
    markDatabaseInitialized();
    const status = await auditDatabaseState(testDb);

    expect(status.state).toBe('INITIALIZED_EMPTY');
    expect(status.isFreshInstall).toBe(false);
    expect(status.isEmpty).toBe(true);
    expect(status.counts.products).toBe(0);
    expect(status.counts.suppliers).toBe(0);
  });

  // 3. Existing Database
  it('3. Detects EXISTING DATABASE with user records', async () => {
    markDatabaseInitialized();
    await testDb.products.put({
      id: 'prod-user-1',
      name: 'စိတ်ကြိုက်ပစ္စည်း',
      defaultPrice: 5000,
      unit: 'ခု',
      category: 'အထွေထွေ',
      openingStock: 10,
      currentStock: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const status = await auditDatabaseState(testDb);
    expect(status.state).toBe('LOADED');
    expect(status.isEmpty).toBe(false);
    expect(status.counts.products).toBe(1);
  });

  // 4. Deleted All Records
  it('4. Handles DELETED ALL RECORDS state safely without re-injecting sample business data', async () => {
    markDatabaseInitialized();

    // User creates a product
    await testDb.products.put({
      id: 'prod-temp',
      name: 'ယာယီပစ္စည်း',
      defaultPrice: 1000,
      unit: 'ခု',
      category: 'အထွေထွေ',
      openingStock: 5,
      currentStock: 5,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect((await auditDatabaseState(testDb)).state).toBe('LOADED');

    // User deletes all products & records
    await testDb.products.clear();
    await testDb.suppliers.clear();
    await testDb.merchants.clear();

    const statusAfterDelete = await auditDatabaseState(testDb);
    expect(statusAfterDelete.state).toBe('INITIALIZED_EMPTY');
    expect(statusAfterDelete.isEmpty).toBe(true);

    // Getters must continue returning empty arrays, NOT fallback sample data
    expect(getStoredProducts()).toEqual([]);
    expect(getStoredSuppliers()).toEqual([]);
  });

  // 5. Migration from legacy localStorage
  it('5. Detects and executes MIGRATION for legacy localStorage data', async () => {
    // Inject legacy data into localStorage
    const legacyProducts: Partial<Product>[] = [
      { id: 'prod-legacy-1', name: 'ဟောင်းသောပစ္စည်း', defaultPrice: 3000, unit: 'ခု' },
    ];
    localStorage.setItem('ledger_products_v2', JSON.stringify(legacyProducts));

    const initialStatus = await auditDatabaseState(testDb);
    expect(initialStatus.state).toBe('MIGRATION_REQUIRED');
    expect(initialStatus.migrationStatus).toBe('REQUIRED');

    // Execute migration
    const migrationResult = await runOfflineStorageMigration();
    expect(migrationResult.success).toBe(true);

    const postMigrationStatus = await auditDatabaseState(testDb);
    expect(postMigrationStatus.migrationStatus).toBe('COMPLETED');
    expect(postMigrationStatus.state).toBe('LOADED');
  });

  // 6. Corrupt Data / DB Failure Handling
  it('6. Handles CORRUPT database errors gracefully', async () => {
    const mockCorruptDb = {
      settings: {
        limit: () => {
          throw new Error('Database disk image is malformed');
        },
      },
    };

    const status = await auditDatabaseState(mockCorruptDb);
    expect(status.state).toBe('CORRUPT');
    expect(status.isCorrupt).toBe(true);
    expect(status.errorMessage).toContain('Database disk image is malformed');
  });

  // 7. Validation Helpers do not insert sample data when input is empty or invalid
  it('7. Validation functions return clean empty arrays for empty/invalid inputs', () => {
    expect(validateProducts([])).toEqual([]);
    expect(validateProducts(null as any)).toEqual([]);
    expect(validateProducts('invalid json string' as any)).toEqual([]);

    expect(validateSuppliers([])).toEqual([]);
    expect(validateSuppliers(undefined as any)).toEqual([]);

    expect(validateMerchants([])).toEqual([]);
    expect(validateMerchants({} as any)).toEqual([]);
  });
});
