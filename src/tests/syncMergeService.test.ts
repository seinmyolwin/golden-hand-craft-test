import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecordTimestamp,
  mergeEntityList,
  mergeImmutableLedger,
  areRecordsDataEquivalent,
  executeSyncMerge,
  buildLatestSyncPackage,
  persistMergedDataToDatabase,
  validatePostMergeIntegrity,
} from '../services/syncMergeService';
import { db } from '../db/database';
import { getAuditTrail } from '../services/auditTrailService';

describe('syncMergeService - Safe Sync / Data Integrity Engine', () => {
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
    await db.softDeletedItems.clear();
    await db.auditLogs.clear();
    await db.rawMaterialPresets.clear();
    await db.attachments.clear();
    await db.stockMovements.clear();
    await db.cashMovements.clear();
    await db.dailyClosings.clear();
    if (db.returnsAndRefunds) await db.returnsAndRefunds.clear();
  });

  describe('Financial Immutability and Data Equivalence', () => {
    it('should detect identical records regardless of key ordering', () => {
      const recA = { id: 'tx_1', amount: 5000, voucherNo: 'V-001', note: 'Paid' };
      const recB = { voucherNo: 'V-001', note: 'Paid', amount: 5000, id: 'tx_1' };
      expect(areRecordsDataEquivalent(recA, recB)).toBe(true);
    });

    it('should detect differing content as conflicting', () => {
      const recA = { id: 'tx_1', amount: 5000, voucherNo: 'V-001' };
      const recB = { id: 'tx_1', amount: 9999, voucherNo: 'V-001' };
      expect(areRecordsDataEquivalent(recA, recB)).toBe(false);
    });

    it('Scenario B: Same immutable ID with identical content -> exactly one survives', () => {
      const local = [{ id: 'sm_1', productId: 'p1', quantity: 5, date: '2026-09-10' }];
      const incoming = [{ id: 'sm_1', productId: 'p1', quantity: 5, date: '2026-09-10' }];

      const { merged, conflicts, stats } = mergeImmutableLedger('stockMovements', local, incoming, (m) => m.id);
      expect(merged).toHaveLength(1);
      expect(conflicts).toHaveLength(0);
      expect(stats.identicalDeduplicated).toBe(1);
      expect(stats.added).toBe(0);
    });

    it('Scenario C: Same immutable ID with different content -> conflict, preserves local record, never overwrites', () => {
      const local = [{ id: 'tx_1', voucherNo: 'TX-001', totalAmount: 50000, date: '2026-09-10' }];
      const incoming = [{ id: 'tx_1', voucherNo: 'TX-001', totalAmount: 900000, date: '2026-09-10' }];

      const { merged, conflicts, stats } = mergeImmutableLedger('transactions', local, incoming, (t) => t.id);
      expect(merged).toHaveLength(1);
      expect(merged[0].totalAmount).toBe(50000); // Local preserved!
      expect(conflicts).toHaveLength(1);
      expect(stats.conflicts).toBe(1);
      expect(stats.localPreserved).toBe(1);
    });
  });

  describe('Scenario A & D: Disjoint ledgers and Local stock movement survival', () => {
    it('Scenario A & D: Local ledger + incoming disjoint ledger -> both survive', async () => {
      const localData = {
        stockMovements: [
          { id: 'sm_local', productId: 'prod_1', type: 'IN', quantity: 10, date: '2026-09-10' },
        ],
        transactions: [
          { id: 'tx_local', voucherNo: 'TX-LOC', date: '2026-09-10', totalAmount: 10000 },
        ],
      };

      const incomingData = {
        stockMovements: [
          { id: 'sm_remote', productId: 'prod_2', type: 'OUT', quantity: 3, date: '2026-09-11' },
        ],
        transactions: [
          { id: 'tx_remote', voucherNo: 'TX-REM', date: '2026-09-11', totalAmount: 20000 },
        ],
      };

      const result = await executeSyncMerge(localData, incomingData, { mode: 'MERGE' });
      expect(result.success).toBe(true);
      expect(result.mergedData.stockMovements).toHaveLength(2);
      expect(result.mergedData.transactions).toHaveLength(2);
      expect(result.mergedData.stockMovements.some((m: any) => m.id === 'sm_local')).toBe(true);
      expect(result.mergedData.stockMovements.some((m: any) => m.id === 'sm_remote')).toBe(true);
    });
  });

  describe('Scenario E: Incoming cash movement not present locally persists', () => {
    it('should union incoming cash movements without overwriting existing', async () => {
      const localData = {
        cashMovements: [
          { id: 'cm_1', type: 'IN', amount: 50000, date: '2026-09-10' },
        ],
      };
      const incomingData = {
        cashMovements: [
          { id: 'cm_2', type: 'OUT', amount: 20000, date: '2026-09-11' },
        ],
      };

      const result = await executeSyncMerge(localData, incomingData, { mode: 'MERGE' });
      expect(result.mergedData.cashMovements).toHaveLength(2);
      expect(result.mergedData.cashMovements.map((c: any) => c.id)).toContain('cm_1');
      expect(result.mergedData.cashMovements.map((c: any) => c.id)).toContain('cm_2');
    });
  });

  describe('Scenario F: Returns from both devices union survives', () => {
    it('should safely merge returnsAndRefunds from both devices', async () => {
      const localData = {
        returnsAndRefunds: [
          { id: 'ret_local', returnNo: 'RET-001', refundAmount: 15000, date: '2026-09-10' },
        ],
      };
      const incomingData = {
        returnsAndRefunds: [
          { id: 'ret_remote', returnNo: 'RET-002', refundAmount: 25000, date: '2026-09-11' },
        ],
      };

      const result = await executeSyncMerge(localData, incomingData, { mode: 'MERGE' });
      expect(result.mergedData.returnsAndRefunds).toHaveLength(2);
      expect(result.mergedData.returnsAndRefunds.map((r: any) => r.id)).toEqual(['ret_local', 'ret_remote']);
    });
  });

  describe('Scenario G: Soft-delete tombstones survive', () => {
    it('should union soft deleted tombstones so deletions are never lost', async () => {
      const localData = {
        softDeletedItems: [
          { id: 'del_1', originalId: 'p_old1', type: 'PRODUCT', deletedAt: '2026-09-10' },
        ],
      };
      const incomingData = {
        softDeletedItems: [
          { id: 'del_2', originalId: 'sup_old2', type: 'SUPPLIER', deletedAt: '2026-09-11' },
        ],
      };

      const result = await executeSyncMerge(localData, incomingData, { mode: 'MERGE' });
      expect(result.mergedData.softDeletedItems).toHaveLength(2);
      expect(result.mergedData.softDeletedItems.some((s: any) => s.id === 'del_1')).toBe(true);
      expect(result.mergedData.softDeletedItems.some((s: any) => s.id === 'del_2')).toBe(true);
    });
  });

  describe('Scenario H: Attachment metadata and base64 survive', () => {
    it('should preserve attachment metadata and binary imageBase64', async () => {
      const localData = {
        attachments: [
          { id: 'att_1', voucherId: 'v1', imageBase64: 'data:image/png;base64,AAA', mimeType: 'image/png' },
        ],
      };
      const incomingData = {
        attachments: [
          { id: 'att_2', voucherId: 'v2', imageBase64: 'data:image/png;base64,BBB', mimeType: 'image/png' },
        ],
      };

      const result = await executeSyncMerge(localData, incomingData, { mode: 'MERGE' });
      expect(result.mergedData.attachments).toHaveLength(2);
      expect(result.mergedData.attachments[0].imageBase64).toBe('data:image/png;base64,AAA');
      expect(result.mergedData.attachments[1].imageBase64).toBe('data:image/png;base64,BBB');
    });
  });

  describe('Scenario I & J: Persistence Safety (MERGE never clears, OVERWRITE replaces atomically)', () => {
    it('Scenario I: MERGE mode should never delete unrelated local records in Dexie', async () => {
      // Seed existing local database with unrelated product & transaction
      await db.products.add({
        id: 'unrelated_prod',
        name: 'Local Only Ring',
        category: 'Rings',
        defaultPrice: 10000,
        defaultWholesalePrice: 9000,
        currentStock: 1,
        minStockAlert: 1,
        unit: 'Pcs',
        active: true,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      });
      await db.transactions.add({
        id: 'unrelated_tx',
        voucherNo: 'TX-UNR',
        date: '2026-09-01',
        totalAmount: 5000,
        supplierId: 'sup1',
        items: [],
        createdAt: '2026-09-01',
      } as any);

      // Incoming data does not mention unrelated_prod
      const mergePayload = {
        _mode: 'MERGE' as const,
        products: [
          {
            id: 'incoming_prod',
            name: 'New Incoming Item',
            category: 'Gems',
            defaultPrice: 20000,
            defaultWholesalePrice: 18000,
            currentStock: 2,
            minStockAlert: 1,
            unit: 'Pcs',
            active: true,
            createdAt: '2026-09-12T00:00:00Z',
            updatedAt: '2026-09-12T00:00:00Z',
          },
        ],
      };

      await persistMergedDataToDatabase(mergePayload, { mode: 'MERGE' });

      // Verify unrelated records are NOT deleted
      const allProducts = await db.products.toArray();
      const allTx = await db.transactions.toArray();
      expect(allProducts).toHaveLength(2);
      expect(allProducts.some((p) => p.id === 'unrelated_prod')).toBe(true);
      expect(allProducts.some((p) => p.id === 'incoming_prod')).toBe(true);
      expect(allTx).toHaveLength(1);
      expect(allTx[0].id === 'unrelated_tx').toBe(true);
    });

    it('Scenario J: OVERWRITE mode should atomically replace existing database collections', async () => {
      await db.products.add({
        id: 'old_prod',
        name: 'Old Ring',
        category: 'Rings',
        defaultPrice: 10000,
        defaultWholesalePrice: 9000,
        currentStock: 1,
        minStockAlert: 1,
        unit: 'Pcs',
        active: true,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      });

      const overwritePayload = {
        _mode: 'OVERWRITE' as const,
        products: [
          {
            id: 'fresh_prod',
            name: 'Fresh Ring',
            category: 'Rings',
            defaultPrice: 50000,
            defaultWholesalePrice: 45000,
            currentStock: 3,
            minStockAlert: 1,
            unit: 'Pcs',
            active: true,
            createdAt: '2026-09-14T00:00:00Z',
            updatedAt: '2026-09-14T00:00:00Z',
          },
        ],
      };

      await persistMergedDataToDatabase(overwritePayload, { mode: 'OVERWRITE' });

      const allProducts = await db.products.toArray();
      expect(allProducts).toHaveLength(1);
      expect(allProducts[0].id).toBe('fresh_prod');
    });
  });

  describe('Scenario K: Post-merge validation report', () => {
    it('should validate database consistency and detect no missing ledgers', async () => {
      const beforeCounts = {
        products: 1,
        transactions: 1,
        stockMovements: 1,
      };

      await db.products.add({
        id: 'p1',
        name: 'Gold Ring',
        category: 'Rings',
        defaultPrice: 100000,
        defaultWholesalePrice: 90000,
        currentStock: 1,
        minStockAlert: 1,
        unit: 'Pcs',
        active: true,
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: '2026-09-10T00:00:00Z',
      });
      await db.transactions.add({
        id: 'tx1',
        voucherNo: 'TX-01',
        date: '2026-09-10',
        totalAmount: 100000,
      } as any);
      await db.stockMovements.add({
        id: 'sm1',
        productId: 'p1',
        type: 'IN',
        quantity: 1,
        date: '2026-09-10',
      } as any);

      const report = await validatePostMergeIntegrity(beforeCounts, { mode: 'MERGE' });
      expect(report.isValid).toBe(true);
      expect(report.issues).toHaveLength(0);
      expect(report.ledgerCounts.products).toBe(1);
    });
  });

  describe('buildLatestSyncPackage', () => {
    it('should serialize sync package with attachments and checksum', async () => {
      await db.products.add({
        id: 'pkg_prod_1',
        name: 'Pkg Ring',
        category: 'Rings',
        defaultPrice: 150000,
        defaultWholesalePrice: 160000,
        currentStock: 5,
        minStockAlert: 2,
        unit: 'Pcs',
        active: true,
        createdAt: '2026-09-12T00:00:00Z',
        updatedAt: '2026-09-12T00:00:00Z',
      });

      const pkg = await buildLatestSyncPackage();
      expect(pkg.shweLetYarSync).toBe(true);
      expect(pkg.data.products).toHaveLength(1);
      expect(pkg.checksum).toBeDefined();
      expect(pkg.timestamp).toBeDefined();
    });
  });
});
