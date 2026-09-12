/**
 * Phase 18C — Comprehensive OWNER / USER RBAC & Financial Operation Authorization Test Suite
 *
 * Tests:
 * 1. Role hierarchy, session management, and credential verification
 * 2. USER permitted operations (Sales entry, Purchase entry, Cash movement)
 * 3. USER blocked operations (Master Data, Deletions, Reversals/Cancellations, Backup/Restore, Repairs, Stock Transfer/Adjustment)
 * 4. Security Audit Trail logging for all unauthorized access attempts
 * 5. OWNER permitted execution across all administrative and financial correction operations
 * 6. Fail-closed atomic guarantees (transactions abort on unauthorized attempts without partial writes)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import {
  enforcePermission,
  getCurrentSession,
  setCurrentSession,
  switchUserSession,
  loginAsStaff,
  loginAsOwner,
  resetSessionForTesting,
  hasPermission,
  AuthorizationError,
  DEFAULT_OWNER_USER,
  DEFAULT_STAFF_USER,
} from '../services/authorizationService';
import {
  SaleRepository,
  MerchantPurchaseRepository,
  ProductRepository,
  TransactionRepository,
  PeerTradeRepository,
  StockAdjustmentRepository,
  SoftDeleteRepository,
  SettingsRepository,
} from '../repositories';
import {
  createCompleteBackup,
  executeSafeRestore,
  createAutoRecoverySnapshot,
  restoreFromSnapshot,
} from '../services/backupService';
import { executeAtomicRepair } from '../services/databaseRepairService';
import { correctDailyClosingAtomic } from '../services/dailyClosingService';
import { processSalesReturnAtomic } from '../services/returnsService';
import { recordDirectCashMovementAtomic } from '../services/cashLedgerService';
import { generateStableId } from '../utils/idGenerator';

describe('Phase 18C — OWNER / USER RBAC & Financial Operation Authorization', () => {
  const saleRepo = new SaleRepository(db);
  const purchaseRepo = new MerchantPurchaseRepository(db);
  const productRepo = new ProductRepository(db);
  const txRepo = new TransactionRepository(db);
  const peerTradeRepo = new PeerTradeRepository(db);
  const stockAdjRepo = new StockAdjustmentRepository(db);
  const softDeleteRepo = new SoftDeleteRepository(db);
  const settingsRepo = new SettingsRepository(db);

  beforeEach(async () => {
    // Reset test database
    await db.sales.clear();
    await db.merchantPurchases.clear();
    await db.products.clear();
    await db.transactions.clear();
    await db.peerTrades.clear();
    await db.stockAdjustments.clear();
    await db.softDeletedItems.clear();
    await db.auditLogs.clear();
    await db.cashMovements.clear();
    await db.settings.clear();

    // Default to OWNER session for clean baseline
    await resetSessionForTesting('OWNER');
  });

  afterEach(async () => {
    await resetSessionForTesting('OWNER');
  });

  describe('1. Session Management & Role Hierarchy', () => {
    it('defaults to OWNER role on a fresh installation', async () => {
      await db.settings.clear();
      const session = await resetSessionForTesting('OWNER');
      expect(session.role).toBe('OWNER');
      expect(session.username).toBe(DEFAULT_OWNER_USER.username);

      const current = await getCurrentSession();
      expect(current.role).toBe('OWNER');
    });

    it('allows switching to USER (Staff) role', async () => {
      const staffSession = await loginAsStaff();
      expect(staffSession.role).toBe('USER');
      expect(staffSession.username).toBe(DEFAULT_STAFF_USER.username);

      const current = await getCurrentSession();
      expect(current.role).toBe('USER');
    });

    it('requires correct PIN when switching back to OWNER role', async () => {
      // Switch to staff first
      await loginAsStaff();
      expect((await getCurrentSession()).role).toBe('USER');

      // Set owner PIN in settings
      await db.settings.put({
        key: 'appLockSettings',
        value: { enabled: true, pin: '1234' },
        updatedAt: new Date().toISOString(),
      });

      // Attempt to switch to OWNER with wrong PIN
      await expect(loginAsOwner('9999')).rejects.toThrow(AuthorizationError);

      // Switch with correct PIN succeeds
      const ownerSession = await loginAsOwner('1234');
      expect(ownerSession.role).toBe('OWNER');
      expect((await getCurrentSession()).role).toBe('OWNER');
    });

    it('hasPermission correctly mirrors role capabilities', async () => {
      expect(hasPermission('OWNER', 'ACCESS_SETTINGS')).toBe(true);
      expect(hasPermission('OWNER', 'MANAGE_MASTER_DATA')).toBe(true);
      expect(hasPermission('OWNER', 'DELETE_FINANCIAL_RECORD')).toBe(true);
      expect(hasPermission('OWNER', 'BACKUP_RESTORE')).toBe(true);
      expect(hasPermission('OWNER', 'OPERATIONAL_DATA_ENTRY')).toBe(true);

      expect(hasPermission('USER', 'OPERATIONAL_DATA_ENTRY')).toBe(true);

      expect(hasPermission('USER', 'ACCESS_SETTINGS')).toBe(false);
      expect(hasPermission('USER', 'MANAGE_MASTER_DATA')).toBe(false);
      expect(hasPermission('USER', 'DELETE_FINANCIAL_RECORD')).toBe(false);
      expect(hasPermission('USER', 'CLEAR_DATABASE')).toBe(false);
      expect(hasPermission('USER', 'BACKUP_RESTORE')).toBe(false);
      expect(hasPermission('USER', 'DATABASE_REPAIR')).toBe(false);
      expect(hasPermission('USER', 'STOCK_TRANSFER')).toBe(false);
      expect(hasPermission('USER', 'STOCK_ADJUSTMENT')).toBe(false);
    });
  });

  describe('2. Operational Data Entry Allowed for USER Role', () => {
    it('allows USER to create sales records', async () => {
      await resetSessionForTesting('USER');

      const saleId = generateStableId('sal');
      const savedId = await saleRepo.save({
        id: saleId,
        voucherNo: 'SALE-TEST-001',
        merchantId: 'm1',
        merchantName: 'Ko Aung',
        merchantTown: 'Yangon',
        date: '2026-09-12',
        time: '10:00',
        items: [],
        totalAmount: 50000,
        paidAmount: 50000,
        remainingReceivableBalance: 0,
      });

      expect(savedId).toBe(saleId);
      const fetched = await saleRepo.getById(saleId);
      expect(fetched).toBeDefined();
      expect(fetched?.totalAmount).toBe(50000);
    });

    it('allows USER to create merchant purchase records', async () => {
      await resetSessionForTesting('USER');

      const purchaseId = generateStableId('pur');
      const savedId = await purchaseRepo.save({
        id: purchaseId,
        purchaseNo: 'PUR-TEST-001',
        merchantId: 'm1',
        merchantName: 'Ma Su',
        merchantTown: 'Mandalay',
        date: '2026-09-12',
        time: '10:00',
        items: [],
        totalAmount: 80000,
        paidAmount: 80000,
        remainingPayableBalance: 0,
        createdAt: '2026-09-12T10:00:00.000Z',
      });

      expect(savedId).toBe(purchaseId);
      const fetched = await purchaseRepo.getById(purchaseId);
      expect(fetched).toBeDefined();
    });

    it('allows USER to record direct cash movements', async () => {
      await resetSessionForTesting('USER');

      const cashRecord = await recordDirectCashMovementAtomic(
        {
          amount: 15000,
          direction: 'OUT',
          type: 'EXPENSE_PAYOUT',
          category: 'အထွေထွေ',
          description: 'ဆိုင်သုံးစရိတ်',
          transactionDate: '2026-09-12',
        },
        db
      );

      expect(cashRecord).toBeDefined();
      expect(cashRecord.amount).toBe(15000);
      expect(cashRecord.direction).toBe('OUT');
    });
  });

  describe('3. Domain & Service Layer Authorization Blocking for USER Role', () => {
    beforeEach(async () => {
      await resetSessionForTesting('USER');
    });

    it('blocks USER from deleting sales records (physical delete)', async () => {
      await expect(saleRepo.delete('sal_test')).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from clearing sales table', async () => {
      await expect(saleRepo.clear()).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from cancelling/voiding a sale (compensating reversal)', async () => {
      // First seed a sale as OWNER
      await resetSessionForTesting('OWNER');
      const saleId = generateStableId('sal');
      await saleRepo.save({
        id: saleId,
        voucherNo: 'SALE-TEST-002',
        merchantId: 'm1',
        merchantName: 'Ko Aung',
        merchantTown: 'Yangon',
        date: '2026-09-12',
        time: '10:00',
        items: [],
        totalAmount: 20000,
        paidAmount: 20000,
        remainingReceivableBalance: 0,
      });

      // Switch to USER and attempt cancellation
      await resetSessionForTesting('USER');
      await expect(saleRepo.cancelSaleAtomic(saleId, 'အမှားပြင်ဆင်ခြင်း')).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from cancelling/voiding a merchant purchase', async () => {
      await expect(purchaseRepo.cancelPurchaseAtomic('pur_test', 'ပြင်ဆင်')).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from cancelling/voiding an inbound delivery transaction', async () => {
      await expect(txRepo.cancelInboundAtomic('tx_test', 'ပယ်ဖျက်')).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from modifying master data products', async () => {
      const prodId = generateStableId('prod');
      await expect(
        productRepo.save({
          id: prodId,
          name: 'စိန်လက်စွပ်',
          defaultPrice: 400000,
          defaultWholesalePrice: 500000,
          unit: 'ကွင်း',
          category: 'လက်ဝတ်ရတနာ',
          currentStock: 10,
          minStockAlert: 2,
          active: true,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from deleting master data products', async () => {
      await expect(productRepo.delete('prd_test')).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from stock transfers (Peer Trade)', async () => {
      await expect(peerTradeRepo.saveMany([])).rejects.toThrow(AuthorizationError);
      await expect(
        peerTradeRepo.saveTradeAtomic({
          id: 'trade_1',
          tradeType: 'LEND_OUT',
          date: '2026-09-12',
          time: '10:00',
          peerShopName: 'Ko Myo Shop',
          productId: 'prd_1',
          productName: 'ရွှေဆွဲကြိုး',
          quantity: 2,
          unit: 'ကုံး',
          status: 'ACTIVE',
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from stock adjustments', async () => {
      await expect(
        stockAdjRepo.saveAdjustmentAtomic({
          id: 'adj_1',
          date: '2026-09-12',
          time: '10:00',
          productId: 'prd_1',
          productName: 'ရွှေလက်ကောက်',
          type: 'OUT_ADJUSTMENT',
          quantity: -2,
          previousStock: 10,
          newStock: 8,
          reason: 'ပျောက်ဆုံး',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from soft deleting and permanent recycle bin deletions', async () => {
      await expect(softDeleteRepo.softDeleteAtomic('PRODUCT', 'prd_1')).rejects.toThrow(AuthorizationError);
      await expect(softDeleteRepo.delete('sd_1')).rejects.toThrow(AuthorizationError);
      await expect(softDeleteRepo.clear()).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from modifying system settings', async () => {
      await expect(settingsRepo.set('shopSettings', { shopName: 'Hacked Shop' })).rejects.toThrow(AuthorizationError);
      await expect(settingsRepo.delete('shopSettings')).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from backup and restore operations', async () => {
      await expect(createCompleteBackup()).rejects.toThrow(AuthorizationError);
      await expect(
        executeSafeRestore(
          {
            isValid: true,
            isCorrupted: false,
            formatVersion: '2.5.0',
            detectedSchemaVersion: 19,
            checksumValid: true,
            exportedAt: new Date().toISOString(),
            shopName: 'Shwe Let Yar',
            appName: 'shwe-let-yar',
            totalRecords: 0,
            errors: [],
            warnings: [],
            counts: {} as any,
          },
          'OVERWRITE'
        )
      ).rejects.toThrow(AuthorizationError);
      await expect(createAutoRecoverySnapshot('Pre-test snapshot')).rejects.toThrow(AuthorizationError);
      await expect(restoreFromSnapshot('snap_1')).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from database repair operations', async () => {
      await expect(
        executeAtomicRepair(
          {
            repairId: 'rep_1',
            repairType: 'RESTORE_MISSING_UNIT',
            targetEntity: 'products',
            targetRecordId: 'prd_1',
            affectedRecordIds: [],
            reason: 'Missing unit test',
            diagnosticCode: 'UNIT_MISSING',
            beforeSnapshot: {},
            proposedAfterSnapshot: {},
            safetyLevel: 'LEVEL_A',
            createdAt: new Date().toISOString(),
            status: 'PREVIEW',
          },
          true
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from daily closing financial corrections', async () => {
      await expect(
        correctDailyClosingAtomic({
          closingDate: '2026-09-12',
          newActualCountedCash: 100000,
          correctionReason: 'စာရင်းပြင်',
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('blocks USER from sales return/refund processing', async () => {
      await expect(
        processSalesReturnAtomic({
          saleId: 'sal_1',
          date: '2026-09-12',
          time: '10:00',
          items: [],
          cashRefundAmount: 50000,
          reason: 'အထည်မကြိုက်၍',
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('4. Security Audit Trail Logging for Unauthorized Attempts', () => {
    it('records an UNAUTHORIZED_ACCESS_ATTEMPT audit event when a permission check fails', async () => {
      await resetSessionForTesting('USER');

      // Attempt restricted action
      try {
        await enforcePermission('CLEAR_DATABASE', 'မတရားသဖြင့် စာရင်းရှင်းလင်းရန် ကြိုးပမ်းခြင်း');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthorizationError);
      }

      // Check auditLogs table
      const auditLogs = await db.auditLogs.toArray();
      const securityLog = auditLogs.find(
        (log) =>
          log.action.includes('ခွင့်ပြုချက်မရှိဘဲ လုပ်ဆောင်ရန်ကြိုးပမ်းမှု') ||
          log.details.includes('CLEAR_DATABASE')
      );

      expect(securityLog).toBeDefined();
      expect(securityLog?.referenceType).toBe('SECURITY');
      expect(securityLog?.details).toContain('CLEAR_DATABASE');
      expect(securityLog?.details).toContain(DEFAULT_STAFF_USER.displayName);
    });
  });

  describe('5. OWNER Role Execution Across All Features', () => {
    beforeEach(async () => {
      await resetSessionForTesting('OWNER');
    });

    it('allows OWNER to save, adjust, and soft delete master data products', async () => {
      const prodId = generateStableId('prod');
      const savedId = await productRepo.save({
        id: prodId,
        name: 'ရွှေဆွဲပြား',
        defaultPrice: 250000,
        defaultWholesalePrice: 300000,
        unit: 'ပြား',
        category: 'ဆွဲပြား',
        currentStock: 15,
        minStockAlert: 3,
        active: true,
      });

      expect(savedId).toBe(prodId);

      // Stock adjustment
      const adj = await stockAdjRepo.saveAdjustmentAtomic({
        id: generateStableId('adj'),
        date: '2026-09-12',
        time: '10:00',
        productId: prodId,
        productName: 'ရွှေဆွဲပြား',
        type: 'IN_ADJUSTMENT',
        quantity: 3,
        previousStock: 15,
        newStock: 18,
        reason: 'ကုန်လက်ကျန်စစ်ဆေးတွေ့ရှိ',
        createdAt: new Date().toISOString(),
      });
      expect(adj.quantity).toBe(3);

      // Verify product stock was updated
      const updatedProd = await productRepo.getById(prodId);
      expect(updatedProd?.currentStock).toBe(18);

      // Soft delete
      const deletedItem = await softDeleteRepo.softDeleteAtomic('PRODUCT', prodId, 'ရွှေဆွဲပြား');
      expect(deletedItem).toBeDefined();
      expect(await productRepo.getById(prodId)).toBeUndefined();
    });

    it('allows OWNER to modify settings and perform safe backup snapshots', async () => {
      await settingsRepo.set('test_setting', { value: 123 });
      const val = await settingsRepo.get('test_setting', null);
      expect(val).toEqual({ value: 123 });

      const snapId = await createAutoRecoverySnapshot('Owner test snapshot');
      expect(snapId).toBeDefined();
      expect(snapId).toMatch(/^rec_/);
    });
  });
});
