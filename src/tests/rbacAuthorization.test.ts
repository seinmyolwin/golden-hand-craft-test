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
import { AppUser } from '../types';
import {
  enforcePermission,
  checkPermission,
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession,
  bootstrapInitialOwnerSession,
  getEffectiveRole,
  switchUserSession,
  loginAsStaff,
  loginAsOwner,
  resetSessionForTesting,
  hasPermission,
  AuthorizationError,
  DEFAULT_OWNER_USER,
  DEFAULT_STAFF_USER,
  savePersistedUsers,
  getPersistedUsers,
  SESSION_STORAGE_KEY,
  SETTING_ACTIVE_SESSION_KEY,
  SETTING_USERS_KEY,
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
  DailyClosingRepository,
  StockMovementRepository,
  CashMovementRepository,
  OrderRepository,
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
import { reconcileProductStock } from '../services/stockLedgerService';
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
  const dailyClosingRepo = new DailyClosingRepository(db);
  const stockMovementRepo = new StockMovementRepository(db);
  const cashMovementRepo = new CashMovementRepository(db);
  const orderRepo = new OrderRepository(db);

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
    it('returns null when no session is active and does NOT silently manufacture an OWNER session', async () => {
      await clearCurrentSession();
      const current = await getCurrentSession();
      expect(current).toBeNull();

      const effectiveRole = await getEffectiveRole();
      expect(effectiveRole).toBe('UNAUTHENTICATED');

      expect(await checkPermission('ACCESS_SETTINGS')).toBe(false);
      expect(await checkPermission('OPERATIONAL_DATA_ENTRY')).toBe(false);

      await expect(enforcePermission('OPERATIONAL_DATA_ENTRY')).rejects.toThrow(AuthorizationError);
      await expect(enforcePermission('ACCESS_SETTINGS')).rejects.toThrow(AuthorizationError);
    });

    it('establishes OWNER role upon explicit bootstrap or login', async () => {
      await clearCurrentSession();
      const session = await bootstrapInitialOwnerSession();
      expect(session.role).toBe('OWNER');
      expect(session.username).toBe(DEFAULT_OWNER_USER.username);

      const current = await getCurrentSession();
      expect(current).not.toBeNull();
      expect(current?.role).toBe('OWNER');
    });

    it('allows switching to USER (Staff) role', async () => {
      const staffSession = await loginAsStaff();
      expect(staffSession.role).toBe('USER');
      expect(staffSession.username).toBe(DEFAULT_STAFF_USER.username);

      const current = await getCurrentSession();
      expect(current).not.toBeNull();
      expect(current?.role).toBe('USER');
    });

    it('requires correct PIN when switching back to OWNER role', async () => {
      // Switch to staff first
      await loginAsStaff();
      expect((await getCurrentSession())?.role).toBe('USER');

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
      expect((await getCurrentSession())?.role).toBe('OWNER');
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

  describe('6. Session Authenticity, Anti-Tampering & Canonical Role Enforcement', () => {
    it('does not trust spoofed role claims in sessionStorage and enforces canonical database role', async () => {
      // Set user session to USER in db
      const staffSession = await resetSessionForTesting('USER');

      // Simulate a malicious client altering sessionStorage to claim role: 'OWNER'
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            userId: DEFAULT_STAFF_USER.id,
            username: DEFAULT_STAFF_USER.username,
            displayName: DEFAULT_STAFF_USER.displayName,
            role: 'OWNER', // TAMPERED ROLE
            loginTimestamp: new Date().toISOString(),
            sessionToken: staffSession.sessionToken,
          })
        );
      }

      // Reset in-memory session to force resolution from storage/db
      const resolvedSession = await getCurrentSession();

      // Effective role MUST be canonical 'USER', not tampered 'OWNER'
      expect(resolvedSession).not.toBeNull();
      expect(resolvedSession?.role).toBe('USER');
      expect(resolvedSession?.userId).toBe(DEFAULT_STAFF_USER.id);

      // Verify that tampered session CANNOT perform OWNER-only action
      await expect(
        stockAdjRepo.saveAdjustmentAtomic({
          id: generateStableId('adj'),
          date: '2026-09-12',
          time: '12:00',
          productId: 'p1',
          productName: 'P1',
          type: 'IN_ADJUSTMENT',
          quantity: 5,
          previousStock: 10,
          newStock: 15,
          reason: 'Tampered attempt',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('does not trust spoofed role claims in Dexie active session setting and enforces canonical database role', async () => {
      const staffSession = await resetSessionForTesting('USER');

      // Maliciously tamper with Dexie active session record
      await db.settings.put({
        key: SETTING_ACTIVE_SESSION_KEY,
        value: {
          userId: DEFAULT_STAFF_USER.id,
          username: DEFAULT_STAFF_USER.username,
          displayName: DEFAULT_STAFF_USER.displayName,
          role: 'OWNER', // FORGED
          loginTimestamp: new Date().toISOString(),
          sessionToken: staffSession.sessionToken,
        },
        updatedAt: new Date().toISOString(),
      });

      const resolved = await getCurrentSession();
      expect(resolved).not.toBeNull();
      expect(resolved?.role).toBe('USER');
    });

    it('rejects nonexistent userId in sessionStorage and returns null without silent OWNER escalation', async () => {
      await clearCurrentSession();
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            userId: 'fake_nonexistent_hacker_id',
            username: 'hacker',
            role: 'OWNER',
          })
        );
      }

      const session = await getCurrentSession();
      expect(session).toBeNull();
      expect(await getEffectiveRole()).toBe('UNAUTHENTICATED');
    });

    it('enforces canonical role when setCurrentSession is called with spoofed role', async () => {
      await setCurrentSession({
        userId: DEFAULT_STAFF_USER.id,
        username: DEFAULT_STAFF_USER.username,
        displayName: DEFAULT_STAFF_USER.displayName,
        role: 'OWNER' as any, // TAMPERED CLAIM
        loginTimestamp: new Date().toISOString(),
      });

      const current = await getCurrentSession();
      expect(current).not.toBeNull();
      expect(current?.role).toBe('USER');
    });

    it('rejects setCurrentSession for deactivated users', async () => {
      // Create deactivated user as OWNER
      await resetSessionForTesting('OWNER');
      const users = await getPersistedUsers();
      const deactivatedUser: AppUser = {
        id: 'usr_deactivated_1',
        username: 'inactive_staff',
        displayName: 'Inactive Staff',
        role: 'USER',
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePersistedUsers([...users, deactivatedUser]);

      await expect(
        setCurrentSession({
          userId: deactivatedUser.id,
          username: deactivatedUser.username,
          displayName: deactivatedUser.displayName,
          role: 'USER',
          loginTimestamp: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('7. Last Owner Protection & User Management Authorization', () => {
    it('prevents removing or deactivating the last active OWNER', async () => {
      await resetSessionForTesting('OWNER');

      // Attempt to demote all users to USER
      const allStaffUsers: AppUser[] = [
        { ...DEFAULT_OWNER_USER, role: 'USER' as const, updatedAt: new Date().toISOString() },
        DEFAULT_STAFF_USER,
      ];

      await expect(savePersistedUsers(allStaffUsers)).rejects.toThrow(
        /အနည်းဆုံး အသုံးပြုနိုင်သော ပိုင်ရှင် \(Active Owner\) အကောင့် တစ်ခု ရှိရပါမည်/
      );

      // Attempt to deactivate the only OWNER
      const deactivatedOwnerUsers: AppUser[] = [
        { ...DEFAULT_OWNER_USER, isActive: false, updatedAt: new Date().toISOString() },
        DEFAULT_STAFF_USER,
      ];

      await expect(savePersistedUsers(deactivatedOwnerUsers)).rejects.toThrow(
        /အနည်းဆုံး အသုံးပြုနိုင်သော ပိုင်ရှင် \(Active Owner\) အကောင့် တစ်ခု ရှိရပါမည်/
      );
    });

    it('allows modifying users as long as at least one active OWNER remains', async () => {
      await resetSessionForTesting('OWNER');

      const secondaryOwner: AppUser = {
        id: 'usr_owner_2',
        username: 'second_owner',
        displayName: 'Second Owner',
        role: 'OWNER',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePersistedUsers([DEFAULT_OWNER_USER, secondaryOwner, DEFAULT_STAFF_USER]);

      // Now deactivating the primary owner succeeds because secondary owner is active
      const updated: AppUser[] = [
        { ...DEFAULT_OWNER_USER, isActive: false, updatedAt: new Date().toISOString() },
        secondaryOwner,
        DEFAULT_STAFF_USER,
      ];

      await expect(savePersistedUsers(updated)).resolves.not.toThrow();
    });

    it('rejects USER role from calling savePersistedUsers', async () => {
      await resetSessionForTesting('USER');
      await expect(savePersistedUsers([DEFAULT_OWNER_USER])).rejects.toThrow(AuthorizationError);
    });
  });

  describe('8. Comprehensive Repository & Service Direct Bypass Prevention', () => {
    beforeEach(async () => {
      await resetSessionForTesting('USER');
    });

    it('rejects USER from calling DailyClosingRepository write & clear methods', async () => {
      await expect(
        dailyClosingRepo.save({
          id: generateStableId('cls'),
          closingDate: '2026-09-12',
          openingCash: 0,
          totalCashIn: 100000,
          totalCashOut: 50000,
          expectedClosingCash: 50000,
          actualCountedCash: 50000,
          difference: 0,
          status: 'CLOSED',
          closedAt: new Date().toISOString(),
          notes: 'Test closing',
          closedBy: 'Staff',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(dailyClosingRepo.saveMany([])).rejects.toThrow(AuthorizationError);
      await expect(dailyClosingRepo.clear()).rejects.toThrow(AuthorizationError);
    });

    it('rejects USER from clearing StockMovement and CashMovement repositories', async () => {
      await expect(stockMovementRepo.clear()).rejects.toThrow(AuthorizationError);
      await expect(cashMovementRepo.clear()).rejects.toThrow(AuthorizationError);
    });

    it('rejects USER from calling stock ledger reconciliation directly', async () => {
      await expect(reconcileProductStock('prod_1')).rejects.toThrow(AuthorizationError);
    });

    it('rejects USER from recording MANUAL_CASH_ADJUSTMENT via cashLedgerService', async () => {
      await expect(
        recordDirectCashMovementAtomic({
          type: 'MANUAL_CASH_ADJUSTMENT',
          direction: 'IN',
          amount: 50000,
          description: 'Unauthorized cash adjustment',
          transactionDate: '2026-09-12',
          notes: 'Unauthorized cash adjustment',
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('allows USER to record standard OPERATIONAL_DATA_ENTRY in cashLedgerService', async () => {
      const expenseMovement = await recordDirectCashMovementAtomic({
        type: 'EXPENSE_PAYOUT',
        direction: 'OUT',
        amount: 5000,
        description: 'Shop tea & coffee expense',
        transactionDate: '2026-09-12',
        notes: 'Shop tea & coffee expense',
      });

      expect(expenseMovement).toBeDefined();
      expect(expenseMovement.type).toBe('EXPENSE_PAYOUT');
      expect(expenseMovement.amount).toBe(5000);
    });

    it('allows USER to save orders and sales within operational bounds', async () => {
      const ordId = await orderRepo.save({
        id: generateStableId('ord'),
        orderNo: 'ORD-20260912-001',
        merchantId: 'm1',
        merchantName: 'မင်္ဂလာ ဆိုင်',
        merchantTown: 'မန္တလေး',
        date: '2026-09-12',
        orderDate: '2026-09-12',
        items: [],
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      expect(ordId).toBeDefined();

      const orderList = await orderRepo.getAll();
      expect(orderList.length).toBeGreaterThan(0);
    });
  });

  describe('9. Hardened Repository Write Gates & RBAC Settings Protection', () => {
    it('A. rejects USER calling StockMovementRepository.recordMovement with arbitrary adjustment record', async () => {
      await resetSessionForTesting('USER');

      await expect(
        stockMovementRepo.recordMovement({
          id: generateStableId('mv'),
          productId: 'prod_1',
          productName: 'P1',
          movementType: 'STOCK_ADJUSTMENT_IN',
          quantity: 10,
          direction: 'IN',
          signedQuantity: 10,
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: 'adj_1',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_mv_adj_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('B. rejects USER calling StockMovementRepository.recordMovementsAtomic with arbitrary records', async () => {
      await resetSessionForTesting('USER');

      await expect(
        stockMovementRepo.recordMovementsAtomic([
          {
            id: generateStableId('mv'),
            productId: 'prod_1',
            productName: 'P1',
            movementType: 'STOCK_ADJUSTMENT_OUT',
            quantity: 5,
            direction: 'OUT',
            signedQuantity: -5,
            referenceType: 'MANUAL',
            referenceId: 'adj_2',
            transactionDate: '2026-09-12',
            idempotencyKey: 'idemp_mv_adj_2',
            schemaVersion: 1,
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
          },
        ])
      ).rejects.toThrow(AuthorizationError);
    });

    it('C. rejects USER calling CashMovementRepository.recordMovement with MANUAL_CASH_ADJUSTMENT', async () => {
      await resetSessionForTesting('USER');

      await expect(
        cashMovementRepo.recordMovement({
          id: generateStableId('csh'),
          amount: 50000,
          direction: 'IN',
          signedAmount: 50000,
          type: 'MANUAL_CASH_ADJUSTMENT',
          referenceType: 'MANUAL_ADJUSTMENT',
          referenceId: 'adj_csh_1',
          description: 'Fabricated cash adjustment',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_csh_adj_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('D. rejects USER calling CashMovementRepository.recordMovementsMany with fabricated protected records', async () => {
      await resetSessionForTesting('USER');

      await expect(
        cashMovementRepo.recordMovementsMany([
          {
            id: generateStableId('csh'),
            amount: 100000,
            direction: 'OUT',
            signedAmount: -100000,
            type: 'DAILY_CLOSING_CORRECTION',
            referenceType: 'DAILY_CLOSING_CORRECTION',
            referenceId: 'corr_1',
            description: 'Unauthorized closing correction',
            transactionDate: '2026-09-12',
            idempotencyKey: 'idemp_csh_corr_1',
            schemaVersion: 1,
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
          },
        ])
      ).rejects.toThrow(AuthorizationError);
    });

    it('E. rejects USER attempting settingsRepo.set(rbac_users)', async () => {
      await resetSessionForTesting('USER');

      await expect(
        settingsRepo.set('rbac_users', [
          {
            id: 'hacker_owner',
            username: 'hacker',
            displayName: 'Hacker',
            role: 'OWNER',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ])
      ).rejects.toThrow(AuthorizationError);
    });

    it('F. rejects USER attempting settingsRepo.delete(rbac_users)', async () => {
      await resetSessionForTesting('USER');

      await expect(settingsRepo.delete('rbac_users')).rejects.toThrow(AuthorizationError);
    });

    it('G. rejects USER attempting to modify rbac_active_session through generic SettingsRepository', async () => {
      await resetSessionForTesting('USER');

      await expect(
        settingsRepo.set('rbac_active_session', {
          userId: 'user_owner',
          username: 'owner',
          displayName: 'Owner',
          role: 'OWNER',
          loginTimestamp: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(settingsRepo.delete('rbac_active_session')).rejects.toThrow(AuthorizationError);
    });

    it('H. rejects unauthenticated caller attempting protected repository mutation', async () => {
      await clearCurrentSession();

      await expect(
        stockMovementRepo.recordMovement({
          id: generateStableId('mv'),
          productId: 'prod_1',
          productName: 'P1',
          movementType: 'SUPPLIER_INBOUND',
          quantity: 10,
          direction: 'IN',
          signedQuantity: 10,
          referenceType: 'TRANSACTION',
          referenceId: 'tx_1',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_mv_unauth_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        cashMovementRepo.recordMovement({
          id: generateStableId('csh'),
          amount: 50000,
          direction: 'IN',
          signedAmount: 50000,
          type: 'SALE_PAYMENT_IN',
          referenceType: 'SALE',
          referenceId: 'sale_1',
          description: 'Unauthenticated payment',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_csh_unauth_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('I. allows OWNER legitimate operational and adjustment workflows', async () => {
      await resetSessionForTesting('OWNER');

      const mvId = await stockMovementRepo.recordMovement({
        id: generateStableId('mv'),
        productId: 'prod_1',
        productName: 'P1',
        movementType: 'STOCK_ADJUSTMENT_IN',
        quantity: 10,
        direction: 'IN',
        signedQuantity: 10,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: 'adj_owner_1',
        transactionDate: '2026-09-12',
        idempotencyKey: 'idemp_mv_owner_1',
        schemaVersion: 1,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      });
      expect(mvId).toBeDefined();

      const cshId = await cashMovementRepo.recordMovement({
        id: generateStableId('csh'),
        amount: 30000,
        direction: 'IN',
        signedAmount: 30000,
        type: 'MANUAL_CASH_ADJUSTMENT',
        referenceType: 'MANUAL_ADJUSTMENT',
        referenceId: 'adj_owner_csh_1',
        description: 'Owner cash adjustment',
        transactionDate: '2026-09-12',
        idempotencyKey: 'idemp_csh_owner_1',
        schemaVersion: 1,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      });
      expect(cshId).toBeDefined();
    });

    it('J. rejects USER direct fabricated stock movement with nonexistent business reference', async () => {
      await resetSessionForTesting('USER');

      await expect(
        stockMovementRepo.recordMovement({
          id: generateStableId('mv'),
          productId: 'prod_1',
          productName: 'P1',
          movementType: 'SUPPLIER_INBOUND',
          quantity: 20,
          direction: 'IN',
          signedQuantity: 20,
          referenceType: 'TRANSACTION',
          referenceId: 'nonexistent_tx_fake_999',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_mv_fake_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('K. rejects USER direct fabricated cash movement with nonexistent business reference', async () => {
      await resetSessionForTesting('USER');

      await expect(
        cashMovementRepo.recordMovement({
          id: generateStableId('csh'),
          amount: 25000,
          direction: 'IN',
          signedAmount: 25000,
          type: 'SALE_PAYMENT_IN',
          referenceType: 'SALE',
          referenceId: 'nonexistent_sale_fake_999',
          description: 'Fabricated sale receipt',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_csh_fake_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('L. allows USER legitimate OPERATIONAL_DATA_ENTRY for verified business transactions', async () => {
      await resetSessionForTesting('OWNER');
      // Create legitimate business entities
      await db.transactions.put({
        id: 'tx_user_legit_1',
        voucherNo: 'V-IN-1001',
        supplierId: 'sup_1',
        supplierName: 'Legit Supplier',
        items: [],
        totalGoodsValue: 50000,
        paidAmount: 50000,
        type: 'COLLECTION_AND_SETTLEMENT',
        status: 'COMPLETED',
        date: '2026-09-12',
        time: '10:00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.sales.put({
        id: 'sale_user_legit_1',
        voucherNo: 'V-OUT-2001',
        merchantId: 'merch_1',
        merchantName: 'Legit Merchant',
        merchantTown: 'Mandalay',
        items: [],
        totalGoodsValue: 25000,
        paidAmount: 25000,
        cashPaidByMerchant: 25000,
        paymentMethod: 'CASH',
        date: '2026-09-12',
        time: '10:00',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Switch to USER role
      await resetSessionForTesting('USER');

      const mvId = await stockMovementRepo.recordMovement({
        id: generateStableId('mv'),
        productId: 'prod_1',
        productName: 'P1',
        movementType: 'SUPPLIER_INBOUND',
        quantity: 20,
        direction: 'IN',
        signedQuantity: 20,
        referenceType: 'TRANSACTION',
        referenceId: 'tx_user_legit_1',
        transactionDate: '2026-09-12',
        idempotencyKey: 'idemp_mv_user_legit_1',
        schemaVersion: 1,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      });
      expect(mvId).toBeDefined();

      const cshId = await cashMovementRepo.recordMovement({
        id: generateStableId('csh'),
        amount: 25000,
        direction: 'IN',
        signedAmount: 25000,
        type: 'SALE_PAYMENT_IN',
        referenceType: 'SALE',
        referenceId: 'sale_user_legit_1',
        description: 'Legit sale receipt',
        transactionDate: '2026-09-12',
        idempotencyKey: 'idemp_csh_user_legit_1',
        schemaVersion: 1,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      });
      expect(cshId).toBeDefined();
    });
  });

  describe('Phase 18C.2 — Remaining RBAC Acceptance Criteria Verification', () => {
    it('1. rejects login attempts for deactivated users (isActive: false)', async () => {
      const users = await getPersistedUsers();
      const deactivatedStaff: AppUser = {
        id: 'user_deactivated_test',
        username: 'deactivated_staff',
        displayName: 'Deactivated Worker',
        role: 'USER',
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await savePersistedUsers([...users, deactivatedStaff]);

      await expect(switchUserSession('user_deactivated_test')).rejects.toThrow(AuthorizationError);
      await expect(switchUserSession('user_deactivated_test')).rejects.toThrow(
        'သတ်မှတ်ထားသော အကောင့်ကို ရှာမတွေ့ပါ သို့မဟုတ် ပိတ်ထားပါသည်'
      );
    });

    it('2. invalidates session immediately on mid-session deactivation during enforcePermission', async () => {
      const activeSession = await resetSessionForTesting('USER');
      expect(activeSession.role).toBe('USER');

      const users = await getPersistedUsers();
      const updatedUsers = users.map((u) =>
        u.id === DEFAULT_STAFF_USER.id ? { ...u, isActive: false } : u
      );
      await db.settings.put({
        key: SETTING_USERS_KEY,
        value: updatedUsers,
        updatedAt: new Date().toISOString(),
      });

      await expect(enforcePermission('OPERATIONAL_DATA_ENTRY')).rejects.toThrow(AuthorizationError);

      const sessionAfterDeactivation = await getCurrentSession();
      expect(sessionAfterDeactivation).toBeNull();
    });

    it('3. prevents privilege bypass via fake referenceId in StockMovementRepository.recordMovement', async () => {
      await resetSessionForTesting('USER');

      await expect(
        stockMovementRepo.recordMovement({
          id: generateStableId('mv_bypass'),
          productId: 'p1',
          productName: 'P1',
          movementType: 'MERCHANT_OUTBOUND',
          quantity: 100,
          direction: 'OUT',
          signedQuantity: -100,
          referenceType: 'SALE',
          referenceId: 'non_existent_sale_99999',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_bypass_mv_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('4. prevents privilege bypass via fake referenceId in CashMovementRepository.recordMovement', async () => {
      await resetSessionForTesting('USER');

      await expect(
        cashMovementRepo.recordMovement({
          id: generateStableId('csh_bypass'),
          amount: 500000,
          direction: 'IN',
          signedAmount: 500000,
          type: 'SALE_PAYMENT_IN',
          referenceType: 'SALE',
          referenceId: 'non_existent_sale_88888',
          description: 'Forged sale cash in',
          transactionDate: '2026-09-12',
          idempotencyKey: 'idemp_bypass_csh_1',
          schemaVersion: 1,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('5. rejects Staff execution of direct repository write functions (StockAdjustment, VoidTransaction, Delete)', async () => {
      await resetSessionForTesting('USER');

      await expect(
        stockAdjRepo.saveAdjustmentAtomic({
          id: generateStableId('adj'),
          date: '2026-09-12',
          time: '12:00',
          productId: 'p1',
          productName: 'P1',
          type: 'IN_ADJUSTMENT',
          quantity: 5,
          previousStock: 10,
          newStock: 15,
          reason: 'Direct adjustment attempt',
          createdAt: new Date().toISOString(),
        })
      ).rejects.toThrow(AuthorizationError);

      await expect(txRepo.cancelInboundAtomic('tx_dummy_id', 'Unauth void attempt')).rejects.toThrow(
        AuthorizationError
      );

      await expect(saleRepo.delete('sale_dummy_id')).rejects.toThrow(AuthorizationError);
    });

    it('6. rejects Staff execution of executeSafeRestore and restoreFromSnapshot', async () => {
      await resetSessionForTesting('USER');

      const dummyReport: any = {
        isValid: true,
        normalizedData: {
          products: [],
          suppliers: [],
          merchants: [],
          transactions: [],
          sales: [],
          merchantPurchases: [],
          orders: [],
          stockAdjustments: [],
          peerTrades: [],
          shopSettings: {},
        },
      };

      await expect(executeSafeRestore(dummyReport, 'OVERWRITE')).rejects.toThrow(AuthorizationError);

      await expect(restoreFromSnapshot('snap_test_123')).rejects.toThrow(AuthorizationError);
    });
  });
});
