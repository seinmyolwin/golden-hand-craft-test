import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecordTimestamp,
  mergeEntityList,
  executeSyncMerge,
  buildLatestSyncPackage,
  unpackSyncPayload,
} from '../services/syncMergeService';
import { db } from '../db/database';
import { getAuditTrail } from '../services/auditTrailService';

describe('syncMergeService - Per-record Newer-Wins & Disjoint Union Engine', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.suppliers.clear();
    await db.merchants.clear();
    await db.transactions.clear();
    await db.sales.clear();
    await db.auditLogs.clear();
  });

  describe('getRecordTimestamp', () => {
    it('should extract numeric timestamps correctly', () => {
      expect(getRecordTimestamp({ updatedAt: 1700000000000 })).toBe(1700000000000);
      expect(getRecordTimestamp({ timestamp: 1690000000000 })).toBe(1690000000000);
      expect(getRecordTimestamp({ createdAt: 1680000000000 })).toBe(1680000000000);
    });

    it('should parse ISO date strings for updatedAt and createdAt', () => {
      const iso = '2026-09-12T10:00:00.000Z';
      const expected = Date.parse(iso);
      expect(getRecordTimestamp({ updatedAt: iso })).toBe(expected);
      expect(getRecordTimestamp({ createdAt: iso })).toBe(expected);
    });

    it('should fallback to date and time fields', () => {
      const ts = getRecordTimestamp({ date: '2026-09-12', time: '14:30:00' });
      expect(ts).toBe(Date.parse('2026-09-12T14:30:00'));
    });

    it('should return 0 for invalid or empty records', () => {
      expect(getRecordTimestamp(null)).toBe(0);
      expect(getRecordTimestamp({})).toBe(0);
    });
  });

  describe('mergeEntityList', () => {
    it('should perform disjoint union of records', () => {
      const local = [
        { id: 'p1', name: 'Gold Ring', currentStock: 10, updatedAt: 1000 },
        { id: 'p2', name: 'Gold Necklace', currentStock: 5, updatedAt: 1000 },
      ];
      const incoming = [
        { id: 'p3', name: 'Gold Bangle', currentStock: 8, updatedAt: 1000 },
      ];

      const { merged, stats } = mergeEntityList(local, incoming, (p) => p.id);
      expect(merged).toHaveLength(3);
      expect(stats.added).toBe(1);
      expect(stats.updated).toBe(0);
      expect(merged.map((m) => m.id)).toEqual(['p1', 'p2', 'p3']);
    });

    it('should apply newer-wins when keys collide', () => {
      const local = [
        { id: 'p1', name: 'Gold Ring', currentStock: 10, price: 100000, updatedAt: 1000 },
        { id: 'p2', name: 'Gold Necklace', currentStock: 5, price: 500000, updatedAt: 3000 },
      ];
      const incoming = [
        // p1 is newer in incoming -> should update
        { id: 'p1', name: 'Gold Ring Modified', currentStock: 12, price: 120000, updatedAt: 2000 },
        // p2 is older in incoming -> should keep local
        { id: 'p2', name: 'Old Necklace', currentStock: 1, price: 400000, updatedAt: 1500 },
      ];

      const { merged, stats } = mergeEntityList(local, incoming, (p) => p.id);
      expect(merged).toHaveLength(2);
      expect(stats.updated).toBe(1);
      expect(stats.unchanged).toBe(1);

      const p1 = merged.find((p) => p.id === 'p1');
      expect(p1?.name).toBe('Gold Ring Modified');
      expect(p1?.currentStock).toBe(12);

      const p2 = merged.find((p) => p.id === 'p2');
      expect(p2?.name).toBe('Gold Necklace');
      expect(p2?.currentStock).toBe(5);
    });
  });

  describe('executeSyncMerge', () => {
    it('should merge full database collections without whole-file overwrite', async () => {
      const localData = {
        products: [
          { id: 'prod_1', name: 'Ring 1', updatedAt: '2026-09-10T10:00:00Z' },
        ],
        transactions: [
          { id: 'tx_1', voucherNo: 'TX-001', date: '2026-09-10', totalAmount: 50000 },
        ],
        sales: [
          { id: 's_1', voucherNo: 'SL-001', date: '2026-09-10', grandTotal: 80000 },
        ],
        suppliers: [
          { id: 'sup_1', name: 'U Ba', updatedAt: 1000 },
        ],
        merchants: [
          { id: 'mer_1', name: 'Daw Mya', updatedAt: 1000 },
        ],
      };

      const incomingData = {
        products: [
          { id: 'prod_1', name: 'Ring 1 Updated', updatedAt: '2026-09-12T10:00:00Z' },
          { id: 'prod_2', name: 'Ring 2 New', updatedAt: '2026-09-11T10:00:00Z' },
        ],
        transactions: [
          { id: 'tx_2', voucherNo: 'TX-002', date: '2026-09-11', totalAmount: 70000 },
        ],
        sales: [
          { id: 's_2', voucherNo: 'SL-002', date: '2026-09-11', grandTotal: 120000 },
        ],
        suppliers: [
          { id: 'sup_2', name: 'U Hla', updatedAt: 2000 },
        ],
        merchants: [
          { id: 'mer_2', name: 'Daw Nu', updatedAt: 2000 },
        ],
      };

      const result = await executeSyncMerge(localData, incomingData, { mode: 'MERGE' });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('MERGE');
      expect(result.mergedData.products).toHaveLength(2);
      expect(result.mergedData.products.find((p: any) => p.id === 'prod_1')?.name).toBe('Ring 1 Updated');
      expect(result.mergedData.transactions).toHaveLength(2);
      expect(result.mergedData.sales).toHaveLength(2);
      expect(result.mergedData.suppliers).toHaveLength(2);
      expect(result.mergedData.merchants).toHaveLength(2);

      // Verify audit log was recorded
      const logs = await getAuditTrail();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toContain('Smart Merge');
    });

    it('should support clean overwrite mode when explicitly selected', async () => {
      const localData = {
        products: [{ id: 'old_1', name: 'Old Product' }],
        transactions: [{ id: 'tx_old', voucherNo: 'OLD-001' }],
      };

      const incomingData = {
        products: [{ id: 'new_1', name: 'New Product' }],
        transactions: [{ id: 'tx_new', voucherNo: 'NEW-001' }],
      };

      const result = await executeSyncMerge(localData, incomingData, { mode: 'OVERWRITE' });
      expect(result.success).toBe(true);
      expect(result.mode).toBe('OVERWRITE');
      expect(result.mergedData.products).toHaveLength(1);
      expect(result.mergedData.products[0].id).toBe('new_1');

      const logs = await getAuditTrail();
      expect(logs[0].action).toContain('Clean Overwrite');
    });
  });

  describe('buildLatestSyncPackage', () => {
    it('should generate a valid sync package with timestamp and checksum', async () => {
      await db.products.add({
        id: 'test_prod_1',
        name: 'Test Ring',
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
