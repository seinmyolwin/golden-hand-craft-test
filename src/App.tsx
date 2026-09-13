import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Supplier,
  Product,
  TransactionRecord,
  SaleRecord,
  Merchant,
  MerchantOrder,
  PeerTradeRecord,
  ShopSettings,
  AuditLogEntry,
  SoftDeletedItem,
  AppLockSettings,
  TabType,
  ActiveTab,
  StockAdjustmentRecord,
  BackupReminderSettings,
  AutoRecoverySnapshot,
  OrderStatus,
  MerchantPurchaseRecord,
  ReturnRecord,
} from './types';
import {
  DEFAULT_SHOP_SETTINGS,
  loadSuppliers,
  saveSuppliers,
  loadMerchants,
  saveMerchants,
  loadProducts,
  saveProducts,
  loadTransactions,
  saveTransactions,
  loadSales,
  saveSales,
  loadOrders,
  saveOrders,
  loadPeerTrades,
  savePeerTrades,
  loadShopSettings,
  saveShopSettings,
  loadDeletedItems,
  saveDeletedItems,
  loadAppLockSettings,
  saveAppLockSettings,
  getStoredStockAdjustments,
  saveStoredStockAdjustments,
  getStoredBackupReminderSettings,
  saveStoredBackupReminderSettings,
  getStoredRecoverySnapshots,
  createAutoRecoverySnapshot,
  computeAllProductsStock,
  getStoredMerchantPurchases,
  saveStoredMerchantPurchases,
  mergeDatabaseSnapshots,
  getTodayDateString,
  getCurrentTimeString,
} from './utils/storage';
import { generateStableId, generateVoucherNo } from './utils/idGenerator';
import { CURRENT_APP_VERSION } from './constants/version';

// UI Components
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DailyPickupTab } from './components/DailyPickupTab';
import { MerchantSalesTab } from './components/MerchantSalesTab';
import { RetailSalesTab } from './components/RetailSalesTab';
import { MerchantOrdersTab } from './components/MerchantOrdersTab';
import { MerchantPurchasesTab } from './components/MerchantPurchasesTab';
import { PeerTradingTab } from './components/PeerTradingTab';
import { InventoryTab } from './components/InventoryTab';
import { SuppliersTab } from './components/SuppliersTab';
import { MerchantsTab } from './components/MerchantsTab';
import { ProductsTab } from './components/ProductsTab';
import { UnifiedHistoryTab } from './components/UnifiedHistoryTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsBackupTab } from './components/SettingsBackupTab';

// Security & Lock Screen
import { AppLockScreen } from './components/AppLockScreen';
import { LoginScreen } from './components/LoginScreen';
import { UserSwitchModal } from './components/UserSwitchModal';
import { AppLockSettingsModal } from './components/AppLockSettingsModal';
import { getCurrentSession, logoutUserSession, UserSession, AUTH_SYNC_CHANNEL_NAME, enforcePermission } from './services/authorizationService';

// Modals
import { NewEntryModal } from './components/NewEntryModal';
import { NewSaleModal } from './components/NewSaleModal';
import { VoucherModal } from './components/VoucherModal';
import { SaleVoucherModal } from './components/SaleVoucherModal';
import { SupplierLedgerModal } from './components/SupplierLedgerModal';
import { EditShopProfileModal } from './components/EditShopProfileModal';
import { BackupSaveModal } from './components/BackupSaveModal';
import { DeletedHistoryModal } from './components/DeletedHistoryModal';
import { ClearDataModal } from './components/ClearDataModal';
import { BackupReminderModal } from './components/BackupReminderModal';
import { NewOrderNotificationModal } from './components/NewOrderNotificationModal';
import { ActionVoucherPromptModal } from './components/ActionVoucherPromptModal';
import { LocalSyncModal } from './components/LocalSyncModal';
import { ZapyaTransferModal } from './components/ZapyaTransferModal';
import { UserGuideModal } from './components/UserGuideModal';
import { ZeroSettingsConfirmModal } from './components/ZeroSettingsConfirmModal';
import { DemoReloadConfirmModal } from './components/DemoReloadConfirmModal';
import { LowStockAlertModal } from './components/LowStockAlertModal';
import { ExcelImportModal, ExcelImportTarget } from './components/ExcelImportModal';
import { UpdateNotificationModal } from './components/UpdateNotificationModal';
import { CashLedgerModal } from './components/CashLedgerModal';
import { ReturnRefundModal } from './components/ReturnRefundModal';
import { AuditHistoryModal } from './components/AuditHistoryModal';
import { recordAuditEvent, getAuditTrail, cleanupAuditLogsByRetentionPolicy } from './services/auditTrailService';
import { getCleanZeroData, getFullDemoData } from './data/sampleDemoData';
import { executeGoLive, checkIsBusinessLive, cleanupDemoDataForGoLive, authorizeDemoDataReload } from './services/businessInitializationService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { executeSyncMerge } from './services/syncMergeService';
import { db } from './db/database';
import { runOfflineStorageMigration, validateProducts, validateSuppliers, validateMerchants } from './db/migration';
import { migrateLegacyAppLockSettings } from './services/cryptoSecurity';
import {
  productRepo,
  supplierRepo,
  merchantRepo,
  transactionRepo,
  saleRepo,
  purchaseRepo,
  orderRepo,
  peerTradeRepo,
  stockAdjustmentRepo,
  softDeleteRepo,
  auditRepo,
  settingsRepo,
} from './repositories';

export default function App() {
  // Main Navigation & Date State (Persisted across refreshes)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shwe_let_yar_last_tab');
      const validTabs: TabType[] = [
        'daily',
        'sales',
        'orders',
        'peers',
        'inventory',
        'suppliers',
        'merchants',
        'products',
        'history',
        'reports',
        'backup',
      ];
      if (saved && validTabs.includes(saved as TabType)) {
        return saved as TabType;
      }
    }
    return 'daily';
  });
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());

  // Save activeTab whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('shwe_let_yar_last_tab', activeTab);
    } catch (e) {
      // ignore
    }
  }, [activeTab]);

  // Core Data States (Dexie IndexedDB Single Source of Truth)
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [peerTrades, setPeerTrades] = useState<PeerTradeRecord[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [merchantPurchases, setMerchantPurchases] = useState<MerchantPurchaseRecord[]>([]);
  const [returnsAndRefunds, setReturnsAndRefunds] = useState<ReturnRecord[]>([]);
  const [backupReminderSettings, setBackupReminderSettings] = useState<BackupReminderSettings>(() => getStoredBackupReminderSettings());
  const [snapshots, setSnapshots] = useState<AutoRecoverySnapshot[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [deletedItems, setDeletedItems] = useState<SoftDeletedItem[]>([]);

  // Safe offline migration & IndexedDB Hydration on initial launch
  useEffect(() => {
    let isMounted = true;
    async function initOfflineDatabase() {
      try {
        const res = await runOfflineStorageMigration();
        if (res.success && isMounted) {
          const [
            dbProducts,
            dbSuppliers,
            dbMerchants,
            dbTransactions,
            dbSales,
            dbPurchases,
            dbOrders,
            dbAdjustments,
            dbPeerTrades,
            dbDeleted,
            dbAudit,
            shopRecord,
            dbReturns,
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
            softDeleteRepo.getAll(),
            getAuditTrail({ limit: 200 }),
            db.settings.get('shopSettings'),
            db.returnsAndRefunds ? db.returnsAndRefunds.toArray() : Promise.resolve([]),
          ]);

          setProducts(dbProducts || []);
          setSuppliers(dbSuppliers || []);
          setMerchants(dbMerchants || []);
          setTransactions(dbTransactions || []);
          setSales(dbSales || []);
          setMerchantPurchases(dbPurchases || []);
          setOrders(dbOrders || []);
          setStockAdjustments(dbAdjustments || []);
          setPeerTrades(dbPeerTrades || []);
          setDeletedItems(dbDeleted || []);
          setAuditLogs(dbAudit || []);
          setReturnsAndRefunds(dbReturns || []);
          if (shopRecord?.value) {
            setShopSettings(shopRecord.value);
          }
          setIsDbLoaded(true);
        }
      } catch (err) {
        console.warn('Database initialization warning:', err);
      }
    }

    initOfflineDatabase();
    return () => {
      isMounted = false;
    };
  }, []);

  // Exit Confirm Modal State for Back-Button Navigation
  const [isExitConfirmModalOpen, setIsExitConfirmModalOpen] = useState<boolean>(false);
  const lastBackPressRef = useRef<number>(0);
  const screenStackRef = useRef<string[]>(['daily']);

  // Auto-cleanup Audit Log Retention background job
  useEffect(() => {
    if (isDbLoaded && shopSettings?.auditRetentionPeriod) {
      cleanupAuditLogsByRetentionPolicy(shopSettings.auditRetentionPeriod)
        .then((result) => {
          if (result.purgedCount > 0) {
            console.log(
              `[Auto-Cleanup Audit Job] Purged ${result.purgedCount} audit logs older than retention period (${shopSettings.auditRetentionPeriod})`
            );
          }
        })
        .catch((err) => console.error('Auto-cleanup audit logs error:', err));
    }
  }, [isDbLoaded, shopSettings?.auditRetentionPeriod]);

  // Back-button Navigation & History Stack Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push state when tab changes
    if (screenStackRef.current[screenStackRef.current.length - 1] !== activeTab) {
      screenStackRef.current.push(activeTab);
      window.history.pushState({ tab: activeTab }, '', `#${activeTab}`);
    }

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      const now = Date.now();

      // If screen stack has past views, pop to previous screen
      if (screenStackRef.current.length > 1) {
        screenStackRef.current.pop();
        const prevTab = screenStackRef.current[screenStackRef.current.length - 1] as TabType;
        if (prevTab) {
          setActiveTab(prevTab);
        }
        return;
      }

      // Root screen reached: check for back x2 within 3 seconds
      if (lastBackPressRef.current && now - lastBackPressRef.current < 3000) {
        setIsExitConfirmModalOpen(true);
      } else {
        lastBackPressRef.current = now;
        window.history.pushState({ root: true }, '', `#${activeTab}`);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab]);

  // User Session & Role State
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [isResolvingSession, setIsResolvingSession] = useState<boolean>(true);
  const [isUserSwitchModalOpen, setIsUserSwitchModalOpen] = useState<boolean>(false);

  // RBAC Tab Access Guard: Automatically redirect staff away from unauthorized tabs
  useEffect(() => {
    if (currentSession && currentSession.role !== 'OWNER') {
      const allowed = currentSession.allowedTabs || shopSettings.staffAllowedTabs || [
        'daily',
        'inventory',
        'orders',
        'sales',
        'purchases',
        'peers',
        'merchants',
        'suppliers',
        'history',
      ];
      if (!allowed.includes(activeTab as any)) {
        setActiveTab('daily');
      }
    }
  }, [currentSession, activeTab, shopSettings.staffAllowedTabs]);

  // Security Lock State (using sessionStorage to persist session across page refresh)
  const [appLockSettings, setAppLockSettings] = useState<AppLockSettings>(() => loadAppLockSettings());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    const lock = loadAppLockSettings();
    if (!lock.enabled) return true;
    if (typeof window !== 'undefined' && sessionStorage.getItem('shwe_let_yar_session_unlocked') === 'true') {
      return true;
    }
    return false;
  });

  // Modals visibility state
  const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState<boolean>(false);
  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState<boolean>(false);
  const [initialEntrySupplierId, setInitialEntrySupplierId] = useState<string | undefined>(undefined);
  const [initialSaleMerchantId, setInitialSaleMerchantId] = useState<string | undefined>(undefined);

  const [activeVoucherTx, setActiveVoucherTx] = useState<TransactionRecord | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);

  const [activeSaleVoucher, setActiveSaleVoucher] = useState<SaleRecord | null>(null);
  const [isSaleVoucherModalOpen, setIsSaleVoucherModalOpen] = useState<boolean>(false);

  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState<boolean>(false);

  const [isShopProfileModalOpen, setIsShopProfileModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isDeletedHistoryModalOpen, setIsDeletedHistoryModalOpen] = useState<boolean>(false);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState<boolean>(false);
  const [isBackupReminderOpen, setIsBackupReminderOpen] = useState<boolean>(false);
  const [isLocalSyncModalOpen, setIsLocalSyncModalOpen] = useState<boolean>(false);
  const [isZapyaModalOpen, setIsZapyaModalOpen] = useState<boolean>(false);
  const [isAppLockSettingsOpen, setIsAppLockSettingsOpen] = useState<boolean>(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState<boolean>(false);
  const [isZeroResetModalOpen, setIsZeroResetModalOpen] = useState<boolean>(false);
  const [isDemoReloadGuardModalOpen, setIsDemoReloadGuardModalOpen] = useState<boolean>(false);
  const [isLowStockAlertModalOpen, setIsLowStockAlertModalOpen] = useState<boolean>(false);
  const [isCashLedgerModalOpen, setIsCashLedgerModalOpen] = useState<boolean>(false);
  const [isAuditHistoryModalOpen, setIsAuditHistoryModalOpen] = useState<boolean>(false);
  const [isReturnRefundModalOpen, setIsReturnRefundModalOpen] = useState<boolean>(false);
  const [selectedReturnSale, setSelectedReturnSale] = useState<SaleRecord | null>(null);
  const [selectedReturnPurchase, setSelectedReturnPurchase] = useState<MerchantPurchaseRecord | null>(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState<boolean>(false);
  const [excelImportTarget, setExcelImportTarget] = useState<ExcelImportTarget>('PRODUCTS');

  // Version Update & PWA State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [hasPendingUpdate, setHasPendingUpdate] = useState<boolean>(false);

  // Phone / Tablet Back Key & Double-Tap Exit State
  const [showExitToast, setShowExitToast] = useState<boolean>(false);
  const lastBackPressTimeRef = useRef<number>(0);

  // New Notification & Action Prompts
  const [notificationOrder, setNotificationOrder] = useState<MerchantOrder | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);

  const [actionPrompt, setActionPrompt] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'INBOUND' | 'OUTBOUND';
    item: TransactionRecord | SaleRecord | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'INBOUND',
    item: null,
  });

  // Track if ANY modal or sub-view overlay is open
  const isAnyModalOpen = Boolean(
    isNewEntryModalOpen ||
    isNewSaleModalOpen ||
    isVoucherModalOpen ||
    isSaleVoucherModalOpen ||
    isLedgerModalOpen ||
    isShopProfileModalOpen ||
    isBackupModalOpen ||
    isDeletedHistoryModalOpen ||
    isClearDataModalOpen ||
    isBackupReminderOpen ||
    isLocalSyncModalOpen ||
    isZapyaModalOpen ||
    isAppLockSettingsOpen ||
    isUserGuideOpen ||
    isZeroResetModalOpen ||
    isLowStockAlertModalOpen ||
    isExcelImportOpen ||
    isNotificationOpen ||
    actionPrompt.isOpen ||
    isUpdateModalOpen
  );

  // Helper to close all open modals
  const closeAllModals = useCallback(() => {
    setIsNewEntryModalOpen(false);
    setIsNewSaleModalOpen(false);
    setIsVoucherModalOpen(false);
    setIsSaleVoucherModalOpen(false);
    setIsLedgerModalOpen(false);
    setIsShopProfileModalOpen(false);
    setIsBackupModalOpen(false);
    setIsDeletedHistoryModalOpen(false);
    setIsClearDataModalOpen(false);
    setIsBackupReminderOpen(false);
    setIsLocalSyncModalOpen(false);
    setIsZapyaModalOpen(false);
    setIsAppLockSettingsOpen(false);
    setIsUserGuideOpen(false);
    setIsZeroResetModalOpen(false);
    setIsLowStockAlertModalOpen(false);
    setIsExcelImportOpen(false);
    setIsNotificationOpen(false);
    setActionPrompt((prev) => ({ ...prev, isOpen: false }));
    setIsUpdateModalOpen(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const revalidateSession = () => {
      getCurrentSession()
        .then((session) => {
          if (isMounted) {
            setCurrentSession(session);
            if (!session) {
              closeAllModals();
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            setCurrentSession(null);
            closeAllModals();
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsResolvingSession(false);
          }
        });
    };

    revalidateSession();

    // 1. Cross-tab sync via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME);
        channel.onmessage = () => {
          revalidateSession();
        };
      }
    } catch {
      // Ignore if BroadcastChannel unsupported
    }

    // 2. Storage event fallback for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'shwe_let_yar_auth_event' || e.key === 'shwe_let_yar_rbac_session') {
        revalidateSession();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Tab visibility / focus revalidation
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateSession();
      }
    };
    const handleFocus = () => {
      revalidateSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      if (channel) {
        try {
          channel.close();
        } catch {}
      }
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [closeAllModals]);

  // Back Key Navigation Handling for Phone & Tablet (Hardware & Gestures)
  const activeTabRef = useRef<TabType>(activeTab);
  const isAnyModalOpenRef = useRef<boolean>(isAnyModalOpen);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    isAnyModalOpenRef.current = isAnyModalOpen;
  }, [isAnyModalOpen]);

  // Push state to browser history whenever navigation or modal changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.pushState({ tab: activeTab, hasModal: isAnyModalOpen }, '');
  }, [activeTab, isAnyModalOpen]);

  // Intercept back button / gesture
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      // 1. If any modal is open -> Close the modal and remain in app
      if (isAnyModalOpenRef.current) {
        closeAllModals();
        window.history.pushState({ tab: activeTabRef.current, hasModal: false }, '');
        return;
      }

      // 2. If inside a sub-tab (not 'daily' dashboard) -> Return to 'daily' dashboard
      if (activeTabRef.current !== 'daily') {
        setActiveTab('daily');
        window.history.pushState({ tab: 'daily', hasModal: false }, '');
        return;
      }

      // 3. At 'daily' dashboard -> Prompt double-tap back to safely exit
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2000) {
        // Double tap confirmed -> Allow browser/PWA default exit
        return;
      } else {
        lastBackPressTimeRef.current = now;
        window.history.pushState({ tab: 'daily', hasModal: false }, '');
        setShowExitToast(true);
        setTimeout(() => {
          setShowExitToast(false);
        }, 2000);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [closeAllModals]);

  // Service Worker Update Listener & Periodic Checks
  useEffect(() => {
    const handleSWUpdate = () => {
      setHasPendingUpdate(true);
      setIsUpdateModalOpen(true);
    };

    window.addEventListener('sw-update-available', handleSWUpdate);

    // Periodic check every 10 minutes
    const interval = setInterval(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) {
            reg.update();
            if (reg.waiting) {
              setHasPendingUpdate(true);
              setIsUpdateModalOpen(true);
            }
          }
        });
      }
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener('sw-update-available', handleSWUpdate);
      clearInterval(interval);
    };
  }, []);

  // Update Execution Handler
  const handleApplyUpdate = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      });
    } else {
      window.location.reload();
    }
  }, []);

  // Manual Check for Updates
  const handleManualCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    let found = false;
    try {
      if ('serviceWorker' in navigator) {
        const reg = (window as any).__swRegistration || (await navigator.serviceWorker.getRegistration());
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            found = true;
            setHasPendingUpdate(true);
            setIsUpdateModalOpen(true);
          }
        }
      }
    } catch (e) {
      console.warn('Update check error:', e);
    } finally {
      setIsCheckingUpdate(false);
      if (!found) {
        alert(`လက်ရှိ ဗားရှင်း v${CURRENT_APP_VERSION} သည် နောက်ဆုံးထွက် ဗားရှင်းဖြစ်ပါသည်။ အသစ်ထွက်ပေါ်လာပါက အလိုအလျောက် သတိပေးမည်ဖြစ်ပါသည်။`);
      }
    }
  }, []);

  const handleOpenReturnRefundModal = useCallback((sale?: SaleRecord, purchase?: MerchantPurchaseRecord) => {
    setSelectedReturnSale(sale || null);
    setSelectedReturnPurchase(purchase || null);
    setIsReturnRefundModalOpen(true);
  }, []);

  const handleReturnSuccess = useCallback(async () => {
    if (db.returnsAndRefunds) {
      const dbReturns = await db.returnsAndRefunds.toArray();
      setReturnsAndRefunds(dbReturns || []);
    }
    const [dbProducts, dbTransactions, dbSales, dbPurchases] = await Promise.all([
      productRepo.getAll(),
      transactionRepo.getAll(),
      saleRepo.getAll(),
      purchaseRepo.getAll(),
    ]);
    setProducts(dbProducts || []);
    setTransactions(dbTransactions || []);
    setSales(dbSales || []);
    setMerchantPurchases(dbPurchases || []);
  }, []);

  // App Lock Controls (Session persistent)
  const handleUnlock = useCallback(async () => {
    try {
      sessionStorage.setItem('shwe_let_yar_session_unlocked', 'true');
    } catch (e) {}
    setIsUnlocked(true);
    try {
      const entry = await recordAuditEvent({
        action: 'App Lock ဖွင့်လှစ်ခြင်း',
        details: 'Unlocked successfully with PIN/Recovery Key',
        entityType: 'SECURITY',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleLockApp = useCallback(() => {
    try {
      sessionStorage.removeItem('shwe_let_yar_session_unlocked');
    } catch (e) {}
    setIsUnlocked(false);
  }, []);

  const handleUpdateAppLock = useCallback(async (updated: AppLockSettings) => {
    try {
      await enforcePermission('ACCESS_SETTINGS', 'App Lock ဆက်တင် ပြင်ဆင်ခြင်း');
    } catch (err: any) {
      alert(err.message || 'ခွင့်ပြုချက်မရှိပါ: App Lock ဆက်တင်အား ဆိုင်ရှင် (OWNER) သာ ပြင်ဆင်ခွင့်ရှိပါသည်');
      throw err;
    }
    setAppLockSettings(updated);
    if (!updated.enabled) {
      try {
        sessionStorage.removeItem('shwe_let_yar_session_unlocked');
      } catch (e) {}
      setIsUnlocked(true);
    }
    try {
      const entry = await recordAuditEvent({
        action: 'App Lock ဆက်တင် ပြင်ဆင်ခြင်း',
        details: `Enabled: ${updated.enabled ? 'Yes' : 'No'}`,
        entityType: 'SECURITY',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  // Persist State Changes to Dexie IndexedDB
  useEffect(() => { if (isDbLoaded) saveSuppliers(suppliers); }, [suppliers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveMerchants(merchants); }, [merchants, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveProducts(products); }, [products, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveTransactions(transactions); }, [transactions, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveSales(sales); }, [sales, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveOrders(orders); }, [orders, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) savePeerTrades(peerTrades); }, [peerTrades, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveStoredStockAdjustments(stockAdjustments); }, [stockAdjustments, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveStoredBackupReminderSettings(backupReminderSettings); }, [backupReminderSettings, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveShopSettings(shopSettings); }, [shopSettings, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveDeletedItems(deletedItems); }, [deletedItems, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) saveAppLockSettings(appLockSettings); }, [appLockSettings, isDbLoaded]);

  // Transparently migrate legacy plaintext app lock credentials to salted hashes on initial startup
  useEffect(() => {
    async function checkAndMigrateAppLock() {
      if (appLockSettings?.passcode || appLockSettings?.pin) {
        try {
          const migrated = await migrateLegacyAppLockSettings(appLockSettings);
          setAppLockSettings(migrated);
        } catch (e) {
          console.warn('AppLock migration notice:', e);
        }
      }
    }
    checkAndMigrateAppLock();
  }, []);

  // Auto-Lock Inactivity & Tab Visibility Timer
  useEffect(() => {
    if (!appLockSettings.enabled || !isUnlocked) return;

    const autoLockMinutes = appLockSettings.autoLockMinutes ?? 5;
    if (autoLockMinutes === -1) return; // Never auto-lock

    let inactivityTimer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      if (autoLockMinutes > 0) {
        inactivityTimer = setTimeout(() => {
          handleLockApp();
        }, autoLockMinutes * 60 * 1000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (autoLockMinutes === 0) {
          // Immediate lock on backgrounding / switching tab
          handleLockApp();
        }
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appLockSettings.enabled, appLockSettings.autoLockMinutes, isUnlocked, handleLockApp]);

  // Periodic Backup Reminder Check (shows once if transactions exist and no recent backup)
  useEffect(() => {
    const lastReminded = localStorage.getItem('last_backup_reminder_shown');
    const today = getTodayDateString();
    if (lastReminded !== today && transactions.length > 5) {
      const timer = setTimeout(() => {
        setIsBackupReminderOpen(true);
        localStorage.setItem('last_backup_reminder_shown', today);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [transactions.length]);

  // Inbound Collection (New Transaction) - Atomic
  const handleSaveTransaction = useCallback(async (record: TransactionRecord) => {
    try {
      // Execute Atomic ACID transaction in Dexie
      const saved = await transactionRepo.saveInboundAtomic(record);

      setTransactions((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);

      // Update Supplier's Advance Balance
      setSuppliers((prev) =>
        prev.map((s) => {
          if (s.id === saved.supplierId) {
            return {
              ...s,
              currentAdvanceBalance: saved.remainingAdvanceBalance,
              totalGoodsValueDelivered: (s.totalGoodsValueDelivered || 0) + (saved.totalGoodsValue || 0),
              totalAdvanceGiven: (s.totalAdvanceGiven || 0) + (saved.newAdvanceTaken || 0),
              lastSettledDate: saved.date,
            };
          }
          return s;
        })
      );

      // Refresh products from repo to reflect updated stocks accurately
      const refreshedProducts = await productRepo.getAll();
      if (refreshedProducts && refreshedProducts.length > 0) {
        setProducts(refreshedProducts);
      }

      if (saved.auditEntry) {
        setAuditLogs((prev) => [saved.auditEntry!, ...prev.slice(0, 199)]);
      }

      // Show prompt to view voucher
      setActionPrompt({
        isOpen: true,
        title: 'ကုန်သိမ်းစာရင်း အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ',
        message: `${saved.supplierName} ထံမှ ကုန်သိမ်းငွေရှင်းပြေစာ (Voucher #${saved.voucherNo}) ကို ယခု ကြည့်ရှုလိုပါသလား?`,
        type: 'INBOUND',
        item: saved,
      });
    } catch (err: any) {
      console.error('Failed to save inbound transaction atomically:', err);
      alert(`ကုန်သိမ်းစာရင်း သိမ်းဆည်းမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  // Outbound Sales (New Sale) - Atomic
  const handleSaveSale = useCallback(async (sale: SaleRecord) => {
    try {
      // Execute Atomic ACID transaction in Dexie
      const saved = await saleRepo.saveSaleAtomic(sale);

      setSales((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);

      // Update Merchant's Receivable Debt
      setMerchants((prev) =>
        prev.map((m) => {
          if (m.id === saved.merchantId) {
            return {
              ...m,
              currentReceivableBalance: saved.remainingReceivableBalance,
              totalPurchasesValue: (m.totalPurchasesValue || 0) + (saved.grandTotal || 0),
              totalPaidAmount: (m.totalPaidAmount || 0) + (saved.cashPaidByMerchant || 0),
              lastPurchaseDate: saved.date,
            };
          }
          return m;
        })
      );

      // Refresh products from repo to reflect updated stocks accurately
      const refreshedProducts = await productRepo.getAll();
      if (refreshedProducts && refreshedProducts.length > 0) {
        setProducts(refreshedProducts);
      }

      if (saved.auditEntry) {
        setAuditLogs((prev) => [saved.auditEntry!, ...prev.slice(0, 199)]);
      }

      // Show prompt to view sale voucher
      setActionPrompt({
        isOpen: true,
        title: 'အရောင်းဘောင်ချာ ထုတ်ယူပြီးပါပြီ',
        message: `${saved.merchantName} သို့ ရောင်းချငွေရှင်းပြေစာ (Invoice #${saved.voucherNo}) ကို ယခု ကြည့်ရှုလိုပါသလား?`,
        type: 'OUTBOUND',
        item: saved,
      });
    } catch (err: any) {
      console.error('Failed to save sale atomically:', err);
      alert(`အရောင်းဘောင်ချာ သိမ်းဆည်းမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  // Suppliers CRUD
  const handleAddSupplier = useCallback(async (s: Supplier) => {
    setSuppliers((prev) => [s, ...prev]);
    supplierRepo.save(s).catch((err) => console.error('Supplier save error:', err));
    try {
      const entry = await recordAuditEvent({
        action: 'ကုန်ပစ္စည်းပေးသွင်းသူ အသစ်ထည့်သွင်းခြင်း',
        details: `${s.name} (${s.village})`,
        entityType: 'SUPPLIER',
        entityId: s.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleUpdateSupplier = useCallback(async (s: Supplier) => {
    setSuppliers((prev) => prev.map((item) => (item.id === s.id ? s : item)));
    supplierRepo.save(s).catch((err) => console.error('Supplier update error:', err));
    try {
      const entry = await recordAuditEvent({
        action: 'ကုန်ပစ္စည်းပေးသွင်းသူ ပြင်ဆင်ခြင်း',
        details: `${s.name} (${s.village})`,
        entityType: 'SUPPLIER',
        entityId: s.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleDeleteSupplier = useCallback(async (supplierId: string) => {
    const s = suppliers.find((item) => item.id === supplierId);
    if (!s) return;

    try {
      const softItem = await softDeleteRepo.softDeleteAtomic('SUPPLIER', supplierId, `${s.name} (${s.village})`);
      setDeletedItems((prev) => [softItem, ...prev]);
      setSuppliers((prev) => prev.filter((item) => item.id !== supplierId));
      if (softItem.auditEntry) {
        setAuditLogs((prev) => [softItem.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to soft delete supplier:', err);
      alert(`ဖျက်ဆီးမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, [suppliers]);

  // Merchants CRUD
  const handleAddMerchant = useCallback(async (m: Merchant) => {
    setMerchants((prev) => [m, ...prev]);
    merchantRepo.save(m).catch((err) => console.error('Merchant save error:', err));
    try {
      const entry = await recordAuditEvent({
        action: 'ကုန်သည် အသစ်ထည့်သွင်းခြင်း',
        details: `${m.name} (${m.town})`,
        entityType: 'MERCHANT',
        entityId: m.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleUpdateMerchant = useCallback(async (m: Merchant) => {
    setMerchants((prev) => prev.map((item) => (item.id === m.id ? m : item)));
    merchantRepo.save(m).catch((err) => console.error('Merchant update error:', err));
    try {
      const entry = await recordAuditEvent({
        action: 'ကုန်သည် ပြင်ဆင်ခြင်း',
        details: `${m.name} (${m.town})`,
        entityType: 'MERCHANT',
        entityId: m.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleDeleteMerchant = useCallback(async (merchantId: string) => {
    const m = merchants.find((item) => item.id === merchantId);
    if (!m) return;

    try {
      const softItem = await softDeleteRepo.softDeleteAtomic('MERCHANT', merchantId, `${m.name} (${m.town})`);
      setDeletedItems((prev) => [softItem, ...prev]);
      setMerchants((prev) => prev.filter((item) => item.id !== merchantId));
      if (softItem.auditEntry) {
        setAuditLogs((prev) => [softItem.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to soft delete merchant:', err);
      alert(`ဖျက်ဆီးမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, [merchants]);

  // Products CRUD
  const handleAddProduct = useCallback(async (p: Product) => {
    setProducts((prev) => [p, ...prev]);
    productRepo.save(p).catch((err) => console.error('Product save error:', err));
    try {
      const entry = await recordAuditEvent({
        action: 'ကုန်ပစ္စည်း အသစ်ထည့်သွင်းခြင်း',
        details: `${p.name} (${p.category})`,
        entityType: 'PRODUCT',
        entityId: p.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleUpdateProduct = useCallback(async (p: Product) => {
    setProducts((prev) => prev.map((item) => (item.id === p.id ? p : item)));
    productRepo.save(p).catch((err) => console.error('Product update error:', err));
    try {
      const entry = await recordAuditEvent({
        action: 'ကုန်ပစ္စည်း ပြင်ဆင်ခြင်း',
        details: `${p.name}`,
        entityType: 'PRODUCT',
        entityId: p.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleDeleteProduct = useCallback(async (productId: string) => {
    const p = products.find((item) => item.id === productId);
    if (!p) return;

    try {
      const softItem = await softDeleteRepo.softDeleteAtomic('PRODUCT', productId, `${p.name} (${p.category})`);
      setDeletedItems((prev) => [softItem, ...prev]);
      setProducts((prev) => prev.filter((item) => item.id !== productId));
      if (softItem.auditEntry) {
        setAuditLogs((prev) => [softItem.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to soft delete product:', err);
      alert(`ဖျက်ဆီးမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, [products]);

  // Orders CRUD
  const handleAddOrder = useCallback(async (ord: MerchantOrder) => {
    setOrders((prev) => [ord, ...prev]);
    orderRepo.save(ord).catch((err) => console.error('Order save error:', err));
    try {
      const entry = await recordAuditEvent({
        action: 'အော်ဒါ အသစ်ရေးသွင်းခြင်း',
        details: `${ord.merchantName} - ${ord.orderNumber}`,
        entityType: 'ORDER',
        entityId: ord.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleUpdateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
    orderRepo.getById(orderId).then((ord) => {
      if (ord) orderRepo.save({ ...ord, status }).catch(console.error);
    });
    try {
      const entry = await recordAuditEvent({
        action: 'အော်ဒါ အခြေအနေ ပြောင်းလဲခြင်း',
        details: `Order ID: ${orderId} -> ${status}`,
        entityType: 'ORDER',
        entityId: orderId,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleConvertOrderToSale = useCallback(async (order: MerchantOrder) => {
    const items = order.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      subtotal: it.subtotal,
    }));

    const totalItems = items.reduce((sum, it) => sum + it.quantity, 0);
    const voucherNo = generateVoucherNo('SL');

    const newSale: SaleRecord = {
      id: generateStableId('sale'),
      voucherNo,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      merchantId: order.merchantId,
      merchantName: order.merchantName,
      merchantTown: order.merchantTown,
      items,
      totalItemsCount: totalItems,
      grandTotal: order.totalEstimatedValue,
      cashPaidByMerchant: 0,
      paymentMethod: 'CASH',
      remainingReceivableBalance: order.totalEstimatedValue,
      notes: `အော်ဒါ ${order.orderNumber} မှ အရောင်းသို့ ပြောင်းလဲခဲ့သည်`,
    };

    try {
      const updatedOrder = await orderRepo.completeOrderAtomic(order.id, newSale);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedOrder : o)));
      const refreshedSales = await saleRepo.getAll();
      const refreshedProducts = await productRepo.getAll();
      const refreshedMerchants = await merchantRepo.getAll();
      if (refreshedSales.length > 0) setSales(refreshedSales);
      if (refreshedProducts.length > 0) setProducts(refreshedProducts);
      if (refreshedMerchants.length > 0) setMerchants(refreshedMerchants);
      if (updatedOrder.auditEntry) {
        setAuditLogs((prev) => [updatedOrder.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to convert order to sale atomically:', err);
      alert(`အော်ဒါ ပြောင်းလဲမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  const handleDeleteOrder = useCallback(async (orderId: string) => {
    try {
      const cancelledOrder = await orderRepo.cancelOrderAtomic(orderId, 'သုံးစွဲသူမှ ဖျက်ပစ်သည်');
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (cancelledOrder.auditEntry) {
        setAuditLogs((prev) => [cancelledOrder.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to cancel order atomically:', err);
      alert(`အော်ဒါ ဖျက်ပစ်မှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  // Peer Trades
  const handleAddPeerTrade = useCallback(async (trade: PeerTradeRecord) => {
    try {
      const saved = await peerTradeRepo.saveTradeAtomic(trade);
      setPeerTrades((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
      const refreshedProducts = await productRepo.getAll();
      if (refreshedProducts.length > 0) setProducts(refreshedProducts);
      if (saved.auditEntry) {
        setAuditLogs((prev) => [saved.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to save peer trade atomically:', err);
      alert(`မိတ်ဖက်ဆိုင် ကုန်ဖလှယ်မှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  const handleUpdatePeerTrade = useCallback(async (trade: PeerTradeRecord) => {
    setPeerTrades((prev) => prev.map((t) => (t.id === trade.id ? trade : t)));
    peerTradeRepo.save(trade).catch(console.error);
    try {
      const entry = await recordAuditEvent({
        action: 'ကုန်ဖလှယ်မှတ်တမ်း ပြင်ဆင်/ရှင်းလင်းခြင်း',
        details: `${trade.peerShopName} - ${trade.productName} အခြေအနေ: ${trade.status}`,
        entityType: 'PEER_TRADE',
        entityId: trade.id,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  const handleDeletePeerTrade = useCallback(async (tradeId: string) => {
    setPeerTrades((prev) => prev.filter((t) => t.id !== tradeId));
    peerTradeRepo.delete(tradeId).catch(console.error);
    try {
      const entry = await recordAuditEvent({
        action: 'မိတ်ဖက်ဆိုင် မှတ်တမ်း ဖျက်ခြင်း',
        details: `ID: ${tradeId}`,
        entityType: 'PEER_TRADE',
        entityId: tradeId,
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  // Delete Transaction / Sale
  const handleDeleteTransaction = useCallback(async (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    try {
      const softItem = await transactionRepo.softDeleteTransactionAtomic(txId, 'သုံးစွဲသူမှ ဖျက်ပစ်သည်');
      setDeletedItems((prev) => [softItem, ...prev]);
      setTransactions((prev) => prev.filter((t) => t.id !== txId));
      const refreshedProducts = await productRepo.getAll();
      const refreshedSuppliers = await supplierRepo.getAll();
      if (refreshedProducts.length > 0) setProducts(refreshedProducts);
      if (refreshedSuppliers.length > 0) setSuppliers(refreshedSuppliers);
      if (softItem.auditEntry) {
        setAuditLogs((prev) => [softItem.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to soft delete transaction atomically:', err);
      alert(`ဘောင်ချာ ဖျက်ပစ်မှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, [transactions]);

  const handleDeleteSale = useCallback(async (saleId: string) => {
    const s = sales.find((sale) => sale.id === saleId);
    if (!s) return;

    try {
      const cancelled = await saleRepo.cancelSaleAtomic(saleId, 'သုံးစွဲသူမှ ဖျက်ပစ်သည်');
      setSales((prev) => prev.map((sale) => (sale.id === saleId ? cancelled : sale)));
      const refreshedProducts = await productRepo.getAll();
      const refreshedMerchants = await merchantRepo.getAll();
      if (refreshedProducts.length > 0) setProducts(refreshedProducts);
      if (refreshedMerchants.length > 0) setMerchants(refreshedMerchants);
      if (cancelled.auditEntry) {
        setAuditLogs((prev) => [cancelled.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to cancel sale atomically:', err);
      alert(`ဘောင်ချာ ဖျက်ပစ်မှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, [sales]);

  // Recycle Bin / Restore / Empty
  const handleRestoreDeletedItem = useCallback(async (item: SoftDeletedItem) => {
    try {
      const restored = await softDeleteRepo.restoreAtomic(item.id);
      if (item.type === 'SUPPLIER') {
        setSuppliers((prev) => [restored, ...prev.filter((s) => s.id !== restored.id)]);
      } else if (item.type === 'MERCHANT') {
        setMerchants((prev) => [restored, ...prev.filter((m) => m.id !== restored.id)]);
      } else if (item.type === 'PRODUCT') {
        setProducts((prev) => [restored, ...prev.filter((p) => p.id !== restored.id)]);
      } else if (item.type === 'TRANSACTION') {
        setTransactions((prev) => [restored, ...prev.filter((t) => t.id !== restored.id)]);
        const refreshedProducts = await productRepo.getAll();
        const refreshedSuppliers = await supplierRepo.getAll();
        if (refreshedProducts.length > 0) setProducts(refreshedProducts);
        if (refreshedSuppliers.length > 0) setSuppliers(refreshedSuppliers);
      } else if (item.type === 'SALE') {
        setSales((prev) => [restored, ...prev.filter((s) => s.id !== restored.id)]);
        const refreshedProducts = await productRepo.getAll();
        const refreshedMerchants = await merchantRepo.getAll();
        if (refreshedProducts.length > 0) setProducts(refreshedProducts);
        if (refreshedMerchants.length > 0) setMerchants(refreshedMerchants);
      }

      setDeletedItems((prev) => prev.filter((d) => d.id !== item.id));
      if (restored.auditEntry) {
        setAuditLogs((prev) => [restored.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to restore item atomically:', err);
      alert(`ပြန်လည်ရယူမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  const handlePermanentDelete = useCallback((id: string) => {
    setDeletedItems((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleEmptyTrash = useCallback(async () => {
    setDeletedItems([]);
    try {
      const entry = await recordAuditEvent({
        action: 'အမှိုက်ပုံးအားလုံး ရှင်းထုတ်ခြင်း',
        details: 'Recycle bin emptied',
        entityType: 'SYSTEM',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }, []);

  // Clear All Data
  const handleConfirmClearAll = useCallback(async () => {
    // Reset all product stocks to 0
    const zeroedProducts: Product[] = products.map((p) => ({
      ...p,
      openingStock: 0,
      currentStock: 0,
    }));

    // Reset all supplier financial advances/deliveries to 0
    const zeroedSuppliers: Supplier[] = suppliers.map((s) => ({
      ...s,
      initialAdvance: 0,
      currentAdvanceBalance: 0,
      totalGoodsValueDelivered: 0,
      totalAdvanceGiven: 0,
      totalMaterialCreditGiven: 0,
      totalRepaymentReceived: 0,
    }));

    // Reset all merchant receivables/purchases to 0
    const zeroedMerchants: Merchant[] = merchants.map((m) => ({
      ...m,
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      payableBalance: 0,
      totalPurchasedFromMerchant: 0,
    }));

    // Reset all transactional activity (Audit trail is immutable and preserved)
    setTransactions([]);
    setSales([]);
    setOrders([]);
    setPeerTrades([]);
    setStockAdjustments([]);
    setDeletedItems([]);
    setMerchantPurchases([]);
    setProducts(zeroedProducts);
    setSuppliers(zeroedSuppliers);
    setMerchants(zeroedMerchants);

    // Save directly to localStorage to guarantee persistent state
    saveTransactions([]);
    saveSales([]);
    saveOrders([]);
    savePeerTrades([]);
    saveStoredStockAdjustments([]);
    saveStoredMerchantPurchases([]);
    saveDeletedItems([]);
    saveProducts(zeroedProducts);
    saveSuppliers(zeroedSuppliers);
    saveMerchants(zeroedMerchants);
    // Explicitly preserve and re-save user shop settings (Shop Name, Owner Name, Phone, Address)
    saveShopSettings(shopSettings);

    try {
      const entry = await recordAuditEvent({
        action: 'အချက်အလက်အားလုံး ရှင်းလင်းခြင်း',
        details: 'All transactional numbers reset to zero while preserving shop profile and immutable audit trail',
        entityType: 'SYSTEM',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
    alert('စာရင်းများနှင့် ကိန်းဂဏန်းများအားလုံးကို ၀ (သုည) အဖြစ် အောင်မြင်စွာ ရှင်းလင်းပြီးပါပြီ။ စာရင်းစစ်မှတ်တမ်း (Audit Trail) နှင့် ဆိုင်အချက်အလက်များကို ဆက်လက်ထိန်းသိမ်းထားပါသည်။');
  }, [products, suppliers, merchants, shopSettings]);

  // Zero Settings (Real Shop Launch / Go-Live)
  const handleConfirmZeroReset = useCallback(
    async (options?: { pin?: string; doubleConfirmed: boolean }) => {
      try {
        const goLiveResult = await executeGoLive({
          pin: options?.pin,
          doubleConfirmed: options?.doubleConfirmed ?? true,
          appLockSettings,
          shopSettings,
        });

        localStorage.setItem('ledger_zero_settings_activated', 'true');
        setProducts(goLiveResult.cleanedProducts);
        setSuppliers(goLiveResult.cleanedSuppliers);
        setMerchants(goLiveResult.cleanedMerchants);
        setTransactions([]);
        setSales([]);
        setOrders([]);
        setPeerTrades([]);
        setStockAdjustments([]);
        setDeletedItems([]);
        setMerchantPurchases([]);

        const updatedShop = {
          ...shopSettings,
          isLiveConfirmed: true,
          hideSampleDataButtons: true,
        };
        setShopSettings(updatedShop);

        saveProducts(goLiveResult.cleanedProducts);
        saveSuppliers(goLiveResult.cleanedSuppliers);
        saveMerchants(goLiveResult.cleanedMerchants);
        saveTransactions([]);
        saveSales([]);
        saveOrders([]);
        savePeerTrades([]);
        saveStoredStockAdjustments([]);
        saveStoredMerchantPurchases([]);
        saveDeletedItems([]);
        saveShopSettings(updatedShop);

        setIsZeroResetModalOpen(false);

        try {
          const latestLogs = await getAuditTrail();
          setAuditLogs(latestLogs.slice(0, 200));
        } catch (err) {
          console.error('Audit log error:', err);
        }
        alert('Go-Live စတင်ခြင်း အောင်မြင်ပါသည်။ နမူနာဒေတာများ ဖျက်သိမ်းပြီး ဆိုင်ရှင်ဒေတာချည်းဖြင့် စာရင်းအသစ် စတင်ပါပြီ။');
      } catch (err: any) {
        console.error('Go-Live activation failed:', err);
        alert(`Go-Live စတင်ခြင်း မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
      }
    },
    [products, suppliers, merchants, shopSettings, appLockSettings]
  );

  // Merchant Raw Material Purchases Handlers
  const handleSaveMerchantPurchase = useCallback(async (record: MerchantPurchaseRecord) => {
    try {
      const saved = await purchaseRepo.savePurchaseAtomic(record);
      setMerchantPurchases((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      const refreshedMerchants = await merchantRepo.getAll();
      if (refreshedMerchants.length > 0) setMerchants(refreshedMerchants);
      if (saved.auditEntry) {
        setAuditLogs((prev) => [saved.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to save merchant purchase atomically:', err);
      alert(`ကုန်ကြမ်းဝယ်ယူမှု သိမ်းဆည်းမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  const handleDeleteMerchantPurchase = useCallback(
    async (id: string) => {
      const target = merchantPurchases.find((p) => p.id === id);
      if (!target) return;

      try {
        const cancelled = await purchaseRepo.cancelPurchaseAtomic(id, 'သုံးစွဲသူမှ ဖျက်ပစ်သည်');
        setMerchantPurchases((prev) => prev.map((p) => (p.id === id ? cancelled : p)));
        const refreshedMerchants = await merchantRepo.getAll();
        if (refreshedMerchants.length > 0) setMerchants(refreshedMerchants);
        if (cancelled.auditEntry) {
          setAuditLogs((prev) => [cancelled.auditEntry!, ...prev.slice(0, 199)]);
        }
      } catch (err: any) {
        console.error('Failed to cancel merchant purchase atomically:', err);
        alert(`ကုန်ကြမ်းဝယ်ယူမှု ပယ်ဖျက်မှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
      }
    },
    [merchantPurchases]
  );

  // Full Demo Data Loader Executor
  const handleExecuteDemoDataReload = useCallback(async (options?: { pin?: string; doubleConfirmed?: boolean }) => {
    try {
      const isLive = await checkIsBusinessLive(db) || Boolean(shopSettings?.isLiveConfirmed);
      if (isLive) {
        await authorizeDemoDataReload({
          pin: options?.pin,
          doubleConfirmed: options?.doubleConfirmed ?? false,
          appLockSettings,
          targetDb: db,
        });
      }
    } catch (authErr: any) {
      alert(authErr.message || 'နမူနာဒေတာ ပြန်လည်သွင်းယူခွင့် ငြင်းပယ်ခံရပါသည်');
      return;
    }

    localStorage.removeItem('ledger_zero_settings_activated');
    const demo = getFullDemoData();
    setProducts(demo.products);
    setSuppliers(demo.suppliers);
    setMerchants(demo.merchants);
    setTransactions(demo.transactions);
    setSales(demo.sales);
    setOrders(demo.orders);
    setPeerTrades(demo.peerTrades);
    setStockAdjustments(demo.stockAdjustments);

    const updatedShop = {
      ...shopSettings,
      isLiveConfirmed: false,
      hideSampleDataButtons: false,
    };
    setShopSettings(updatedShop);

    saveProducts(demo.products);
    saveSuppliers(demo.suppliers);
    saveMerchants(demo.merchants);
    saveTransactions(demo.transactions);
    saveSales(demo.sales);
    saveOrders(demo.orders);
    savePeerTrades(demo.peerTrades);
    saveStoredStockAdjustments(demo.stockAdjustments);
    saveShopSettings(updatedShop);

    // Update Dexie database tables
    try {
      await db.transaction('rw', [db.products, db.suppliers, db.merchants, db.transactions, db.sales, db.orders, db.peerTrades, db.stockAdjustments, db.settings], async () => {
        await db.products.clear();
        await db.products.bulkAdd(demo.products);
        await db.suppliers.clear();
        await db.suppliers.bulkAdd(demo.suppliers);
        await db.merchants.clear();
        await db.merchants.bulkAdd(demo.merchants);
        await db.transactions.clear();
        await db.transactions.bulkAdd(demo.transactions);
        await db.sales.clear();
        await db.sales.bulkAdd(demo.sales);
        await db.orders.clear();
        await db.orders.bulkAdd(demo.orders);
        await db.peerTrades.clear();
        await db.peerTrades.bulkAdd(demo.peerTrades);
        await db.stockAdjustments.clear();
        await db.stockAdjustments.bulkAdd(demo.stockAdjustments);
        await db.settings.put({ key: 'goLive', value: { isLive: false }, updatedAt: new Date().toISOString() });
        await db.settings.put({ key: 'businessInitialization', value: { state: 'DEMO' }, updatedAt: new Date().toISOString() });
      });
    } catch (dbErr) {
      console.error('Dexie demo reload sync error:', dbErr);
    }

    setIsZeroResetModalOpen(false);
    setIsDemoReloadGuardModalOpen(false);

    try {
      const entry = await recordAuditEvent({
        action: 'နမူနာဒေတာများ အစုံအလင် သွင်းယူခြင်း',
        details: 'Full demo data populated',
        entityType: 'SYSTEM',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log error:', err);
    }
    alert('နမူနာဒေတာများ အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။ စနစ်ကို အစမ်းလေ့လာနိုင်ပါပြီ။');
  }, [shopSettings, appLockSettings]);

  // Demo Data Loader entry point: Guarded if Go-Live is active
  const handleLoadDemoData = useCallback(async () => {
    const isLive = Boolean(
      shopSettings?.isLiveConfirmed ||
        localStorage.getItem('ledger_zero_settings_activated') === 'true'
    );

    if (isLive) {
      // If Go-Live is active, strictly require Owner PIN + double-confirm modal
      setIsDemoReloadGuardModalOpen(true);
      return;
    }

    if (
      confirm(
        'စနစ်အစမ်းသုံးကြည့်နိုင်ရန် ကုန်သိမ်း၊ အရောင်း၊ ဝါး/ကြိမ်ကုန်ကြမ်း၊ အော်ဒါ နမူနာဒေတာများကို ထည့်သွင်းလိုပါသလား?'
      )
    ) {
      await handleExecuteDemoDataReload();
    }
  }, [shopSettings, handleExecuteDemoDataReload]);

  // Import Backup & Local Sync with Smart Merge support
  const handleImportBackupData = useCallback(async (backup: any, mode: 'MERGE' | 'OVERWRITE' = 'MERGE') => {
    if (!backup || typeof backup !== 'object') {
      alert('ထည့်သွင်းထားသော ဖိုင် သို့မဟုတ် ကုဒ် ပုံစံမမှန်ကန်ပါ');
      return;
    }

    const localData = {
      suppliers,
      merchants,
      products,
      transactions,
      sales,
      merchantPurchases,
      orders,
      peerTrades,
      stockAdjustments,
      shopSettings,
    };

    const result = await executeSyncMerge(localData, backup, { mode });
    if (result.success && result.mergedData) {
      if (result.mergedData.suppliers) setSuppliers(result.mergedData.suppliers);
      if (result.mergedData.merchants) setMerchants(result.mergedData.merchants);
      if (result.mergedData.products) setProducts(result.mergedData.products);
      if (result.mergedData.transactions) setTransactions(result.mergedData.transactions);
      if (result.mergedData.sales) setSales(result.mergedData.sales);
      if (result.mergedData.merchantPurchases) setMerchantPurchases(result.mergedData.merchantPurchases);
      if (result.mergedData.orders) setOrders(result.mergedData.orders);
      if (result.mergedData.peerTrades) setPeerTrades(result.mergedData.peerTrades);
      if (result.mergedData.stockAdjustments) saveStoredStockAdjustments(result.mergedData.stockAdjustments);
      if (result.mergedData.shopSettings) setShopSettings(result.mergedData.shopSettings);
      if (result.mergedData.appLockSettings) setAppLockSettings(result.mergedData.appLockSettings);

      try {
        const latestLogs = await getAuditTrail();
        setAuditLogs(latestLogs.slice(0, 200));
      } catch (err) {
        console.error('Audit log refresh error:', err);
      }
      return;
    }

    alert('အချက်အလက်များ ထည့်သွင်းရာတွင် ချို့ယွင်းချက် ရှိနေပါသည်');
  }, [suppliers, merchants, products, transactions, sales, merchantPurchases, orders, peerTrades, stockAdjustments, shopSettings]);

  // Excel Bulk Import Handlers
  const handleOpenExcelImport = useCallback((target: ExcelImportTarget = 'PRODUCTS') => {
    setExcelImportTarget(target);
    setIsExcelImportOpen(true);
  }, []);

  const handleImportProducts = useCallback(async (newProducts: Product[]) => {
    const validated = validateProducts(newProducts);
    if (validated.length === 0) return;

    let finalProducts: Product[] = [];
    setProducts((prev) => {
      const existingMap = new Map(prev.map((p) => [p.name.trim().toLowerCase(), p]));
      const updated = [...prev];
      validated.forEach((np) => {
        const key = np.name.trim().toLowerCase();
        if (existingMap.has(key)) {
          const idx = updated.findIndex((p) => p.name.trim().toLowerCase() === key);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...np, id: updated[idx].id };
          }
        } else {
          updated.push(np);
        }
      });
      finalProducts = updated;
      return updated;
    });

    try {
      // Persist all imported products to repository
      await Promise.all(validated.map((p) => productRepo.save(p)));
      const entry = await recordAuditEvent({
        action: 'Excel Bulk Import',
        details: `ကုန်ပစ္စည်း ${validated.length} မျိုး သွင်းယူခြင်း`,
        entityType: 'PRODUCTS',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log or product save error:', err);
    }
  }, []);

  const handleImportSuppliers = useCallback(async (newSuppliers: Supplier[]) => {
    const validated = validateSuppliers(newSuppliers);
    if (validated.length === 0) return;

    setSuppliers((prev) => {
      const existingMap = new Map(prev.map((s) => [s.name.trim().toLowerCase(), s]));
      const updated = [...prev];
      validated.forEach((ns) => {
        const key = ns.name.trim().toLowerCase();
        if (existingMap.has(key)) {
          const idx = updated.findIndex((s) => s.name.trim().toLowerCase() === key);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...ns, id: updated[idx].id };
          }
        } else {
          updated.push(ns);
        }
      });
      return updated;
    });

    try {
      // Persist all imported suppliers to repository
      await Promise.all(validated.map((s) => supplierRepo.save(s)));
      const entry = await recordAuditEvent({
        action: 'Excel Bulk Import',
        details: `ကုန်ပစ္စည်းပေးသွင်းသူ ${validated.length} ဦး သွင်းယူခြင်း`,
        entityType: 'SUPPLIER',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log or supplier save error:', err);
    }
  }, []);

  const handleImportMerchants = useCallback(async (newMerchants: Merchant[]) => {
    const validated = validateMerchants(newMerchants);
    if (validated.length === 0) return;

    setMerchants((prev) => {
      const existingMap = new Map(prev.map((m) => [m.name.trim().toLowerCase(), m]));
      const updated = [...prev];
      validated.forEach((nm) => {
        const key = nm.name.trim().toLowerCase();
        if (existingMap.has(key)) {
          const idx = updated.findIndex((m) => m.name.trim().toLowerCase() === key);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...nm, id: updated[idx].id };
          }
        } else {
          updated.push(nm);
        }
      });
      return updated;
    });

    try {
      // Persist all imported merchants to repository
      await Promise.all(validated.map((m) => merchantRepo.save(m)));
      const entry = await recordAuditEvent({
        action: 'Excel Bulk Import',
        details: `ကုန်သည် ${validated.length} ဦး သွင်းယူခြင်း`,
        entityType: 'MERCHANT',
      });
      setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.error('Audit log or merchant save error:', err);
    }
  }, []);

  // View Voucher Helpers
  const handleViewInboundVoucher = useCallback((tx: TransactionRecord) => {
    setActiveVoucherTx(tx);
    setIsVoucherModalOpen(true);
  }, []);

  const handleViewSaleVoucher = useCallback((sale: SaleRecord) => {
    setActiveSaleVoucher(sale);
    setIsSaleVoucherModalOpen(true);
  }, []);

  const handleViewSupplierLedger = useCallback((s: Supplier) => {
    setLedgerSupplier(s);
    setIsLedgerModalOpen(true);
  }, []);

  // Open Add Modals with initial selections
  const handleOpenNewEntry = useCallback((supId?: string) => {
    setInitialEntrySupplierId(supId);
    setIsNewEntryModalOpen(true);
  }, []);

  const handleOpenNewSale = useCallback((mId?: string) => {
    setInitialSaleMerchantId(mId);
    setIsNewSaleModalOpen(true);
  }, []);

  // Stock Adjustment Handler
  const handleAddStockAdjustment = useCallback(async (adj: StockAdjustmentRecord) => {
    try {
      const saved = await stockAdjustmentRepo.saveAdjustmentAtomic(adj);
      setStockAdjustments((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)]);
      const refreshedProducts = await productRepo.getAll();
      if (refreshedProducts.length > 0) setProducts(refreshedProducts);
      if (saved.auditEntry) {
        setAuditLogs((prev) => [saved.auditEntry!, ...prev.slice(0, 199)]);
      }
    } catch (err: any) {
      console.error('Failed to save stock adjustment atomically:', err);
      alert(`လက်ကျန်ပစ္စည်း ချိန်ညှိမှု မအောင်မြင်ပါ: ${err.message || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည်'}`);
    }
  }, []);

  // Full Restore Data for Backup Tab
  const handleRestoreData = useCallback(
    async (
      newProducts: Product[],
      newSuppliers: Supplier[],
      newTransactions: TransactionRecord[],
      newMerchants?: Merchant[],
      newSales?: SaleRecord[],
      newAdjustments?: StockAdjustmentRecord[],
      newShopSettings?: ShopSettings
    ) => {
      if (newProducts) setProducts(newProducts);
      if (newSuppliers) setSuppliers(newSuppliers);
      if (newTransactions) setTransactions(newTransactions);
      if (newMerchants) setMerchants(newMerchants);
      if (newSales) setSales(newSales);
      if (newAdjustments) setStockAdjustments(newAdjustments);
      if (newShopSettings) setShopSettings(newShopSettings);
      try {
        const entry = await recordAuditEvent({
          action: 'အချက်အလက်များ အားလုံး အစားထိုး ပြန်လည်ရယူခြင်း',
          details: 'Full data restored',
          entityType: 'SYSTEM',
        });
        setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
      } catch (err) {
        console.error('Audit log error:', err);
      }
    },
    []
  );

  // Snapshot Restore & Take Now Handlers
  const handleRestoreSnapshot = useCallback(
    async (snap: AutoRecoverySnapshot) => {
      if (snap.data) {
        if (snap.data.products) setProducts(snap.data.products);
        if (snap.data.suppliers) setSuppliers(snap.data.suppliers);
        if (snap.data.transactions) setTransactions(snap.data.transactions);
        if (snap.data.merchants) setMerchants(snap.data.merchants);
        if (snap.data.sales) setSales(snap.data.sales);
        if (snap.data.merchantOrders) setOrders(snap.data.merchantOrders);
        if (snap.data.shopSettings) setShopSettings(snap.data.shopSettings);
        if (snap.data.stockAdjustments) setStockAdjustments(snap.data.stockAdjustments);
        try {
          const entry = await recordAuditEvent({
            action: 'Snapshot မှ ပြန်လည်ရယူခြင်း',
            details: snap.reason || snap.id,
            entityType: 'SYSTEM',
          });
          setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
        } catch (err) {
          console.error('Audit log error:', err);
        }
        alert('Snapshot မှ စာရင်းများ အောင်မြင်စွာ ပြန်လည်ရယူပြီးပါပြီ');
      }
    },
    []
  );

  const handleTakeSnapshotNow = useCallback(
    async (reason: string) => {
      const snap = createAutoRecoverySnapshot(reason, {
        products,
        suppliers,
        merchants,
        transactions,
        sales,
        stockAdjustments,
        merchantOrders: orders,
        shopSettings,
      });
      setSnapshots(getStoredRecoverySnapshots());
      try {
        const entry = await recordAuditEvent({
          action: 'အလိုအလျောက် Snapshot အသစ် ရယူခြင်း',
          details: reason,
          entityType: 'SYSTEM',
          entityId: snap.id,
        });
        setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
      } catch (err) {
        console.error('Audit log error:', err);
      }
    },
    [products, suppliers, transactions, merchants, sales, orders, shopSettings, stockAdjustments]
  );

  // Compute Accurate Inventory Stock using computeAllProductsStock
  const inventoryStock = useMemo(() => {
    const stats = computeAllProductsStock(
      products || [],
      transactions || [],
      sales || [],
      stockAdjustments || [],
      [],
      peerTrades || []
    );
    return stats.map((stat) => ({
      product: stat.product,
      inbound: stat.totalInflow,
      outbound: stat.totalOutflow,
      currentStock: stat.currentStock,
    }));
  }, [products, transactions, sales, stockAdjustments, peerTrades]);

  // Tab Badge & Navigation Counts
  const todayInboundCount = useMemo(() => {
    return transactions.filter((t) => t.date === selectedDate).length;
  }, [transactions, selectedDate]);

  const todaySalesCount = useMemo(() => {
    return sales.filter((s) => s.date === selectedDate).length;
  }, [sales, selectedDate]);

  const lowStockProductsList = useMemo(() => {
    return inventoryStock
      .filter((i) => i.currentStock <= (i.product.minStockAlert || 5))
      .map((i) => ({
        product: i.product,
        currentStock: i.currentStock,
        minStockAlert: i.product.minStockAlert || 5,
      }));
  }, [inventoryStock]);

  const lowStockAlertCount = useMemo(() => {
    return lowStockProductsList.length;
  }, [lowStockProductsList]);

  const pendingOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === 'PENDING').length;
  }, [orders]);

  const pendingOrdersList = useMemo(() => {
    return orders.filter((o) => o.status === 'PENDING');
  }, [orders]);

  // Normalize activeTab to ActiveTab so both lowercase and legacy uppercase keys function seamlessly
  const normalizedTab: ActiveTab = useMemo(() => {
    switch (activeTab) {
      case 'PICKUP':
        return 'daily';
      case 'MERCHANT_SALES':
        return 'sales';
      case 'ORDERS':
        return 'orders';
      case 'PEER_TRADING':
        return 'peers';
      case 'INVENTORY':
        return 'inventory';
      case 'SUPPLIERS':
        return 'suppliers';
      case 'MERCHANTS':
        return 'merchants';
      case 'PRODUCTS':
        return 'products';
      case 'HISTORY':
        return 'history';
      case 'REPORTS':
        return 'reports';
      case 'BACKUP':
      case 'SETTINGS':
        return 'backup';
      default:
        return (activeTab as ActiveTab) || 'daily';
    }
  }, [activeTab]);

  // Session Resolution Loading Gate
  if (isResolvingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400 mb-3"></div>
        <p className="text-sm font-semibold text-slate-300">စနစ်ဖွင့်လှစ်နေပါသည်...</p>
      </div>
    );
  }

  // Session & App Lock Screen Guard
  if (!currentSession || (appLockSettings.enabled && !isUnlocked)) {
    return (
      <ErrorBoundary>
        <LoginScreen
          appLockSettings={appLockSettings}
          shopSettings={shopSettings}
          onLoginSuccess={(session) => {
            setCurrentSession(session);
            handleUnlock();
          }}
          onUpdateAppLockSettings={handleUpdateAppLock}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-emerald-500 selection:text-white">
        {/* Global Header */}
        <Header
          shopSettings={shopSettings}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onOpenNewEntry={() => handleOpenNewEntry()}
          onOpenNewSale={() => handleOpenNewSale()}
          todayInboundCount={todayInboundCount}
          todaySalesCount={todaySalesCount}
          pendingOrdersCount={pendingOrdersCount}
          lowStockCount={lowStockAlertCount}
          onOpenLowStockAlert={() => setIsLowStockAlertModalOpen(true)}
          onNavigateToOrders={() => setActiveTab('orders')}
          onOpenEditProfile={() => setIsShopProfileModalOpen(true)}
          onOpenBackup={() => setActiveTab('backup')}
          onOpenAuditLogs={() => setIsAuditHistoryModalOpen(true)}
          onOpenDeletedHistory={() => setIsDeletedHistoryModalOpen(true)}
          onOpenClearData={() => setIsClearDataModalOpen(true)}
          onOpenZeroSettings={() => setIsZeroResetModalOpen(true)}
          onOpenLocalSync={() => setIsLocalSyncModalOpen(true)}
          onOpenZapya={() => setIsZapyaModalOpen(true)}
          appLockEnabled={appLockSettings.enabled ?? false}
          onOpenAppLockSettings={() => setIsAppLockSettingsOpen(true)}
          onLockApp={handleLockApp}
          onOpenUserGuide={() => setIsUserGuideOpen(true)}
          currentSession={currentSession}
          onOpenUserSwitch={() => setIsUserSwitchModalOpen(true)}
          hasPendingUpdate={hasPendingUpdate}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        />

        {/* Main Content Area - Dynamic Tab Routing */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 pb-24">
          {normalizedTab === 'daily' && (
            <DailyPickupTab
              selectedDate={selectedDate}
              suppliers={suppliers}
              products={products}
              transactions={transactions}
              onOpenNewEntry={() => handleOpenNewEntry()}
              onOpenNewEntryWithSupplier={(supId) => handleOpenNewEntry(supId)}
              onViewVoucher={handleViewInboundVoucher}
              onDeleteTransaction={handleDeleteTransaction}
              pendingOrders={pendingOrdersList}
              onNavigateToOrders={() => setActiveTab('orders')}
              onOpenOrderNotificationModal={(order) => {
                setNotificationOrder(order);
                setIsNotificationOpen(true);
              }}
              onOpenCashLedger={() => setIsCashLedgerModalOpen(true)}
            />
          )}

          {normalizedTab === 'inventory' && (
            <InventoryTab
              products={products}
              transactions={transactions}
              sales={sales}
              stockAdjustments={stockAdjustments}
              peerTrades={peerTrades}
              onUpdateProduct={handleUpdateProduct}
              onAddProduct={handleAddProduct}
              onAddStockAdjustment={handleAddStockAdjustment}
              onSaveAdjustment={handleAddStockAdjustment}
              onOpenNewSale={() => handleOpenNewSale()}
              onOpenNewSupplierCollection={() => handleOpenNewEntry()}
            />
          )}

          {normalizedTab === 'orders' && (
            <MerchantOrdersTab
              orders={orders}
              merchants={merchants}
              products={products}
              onAddOrder={handleAddOrder}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onConvertOrderToSale={handleConvertOrderToSale}
              onDeleteOrder={handleDeleteOrder}
            />
          )}

          {normalizedTab === 'retail' && (
            <RetailSalesTab
              products={products}
              merchants={merchants}
              sales={sales}
              currentSession={currentSession}
              shopSettings={shopSettings}
              onSaleCompleted={(sale) => {
                setSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);
                productRepo.getAll().then((prods) => {
                  if (prods.length > 0) setProducts(prods);
                });
              }}
              onOpenVoucher={handleViewSaleVoucher}
            />
          )}

          {normalizedTab === 'sales' && (
            <MerchantSalesTab
              sales={sales}
              merchants={merchants}
              products={products}
              selectedDate={selectedDate}
              inventoryStock={inventoryStock}
              onOpenNewSale={() => handleOpenNewSale()}
              onViewSaleVoucher={handleViewSaleVoucher}
              onDeleteSale={handleDeleteSale}
              onOpenReturnRefundModal={(sale) => handleOpenReturnRefundModal(sale)}
            />
          )}

          {normalizedTab === 'purchases' && (
            <MerchantPurchasesTab
              purchases={merchantPurchases}
              merchants={merchants}
              products={products}
              selectedDate={selectedDate}
              onSavePurchase={handleSaveMerchantPurchase}
              onDeletePurchase={handleDeleteMerchantPurchase}
              onOpenReturnRefundModal={(purchase) => handleOpenReturnRefundModal(undefined, purchase)}
            />
          )}

          {normalizedTab === 'peers' && (
            <PeerTradingTab
              peerTrades={peerTrades}
              products={products}
              merchants={merchants}
              onAddPeerTrade={handleAddPeerTrade}
              onUpdatePeerTrade={handleUpdatePeerTrade}
              onDeletePeerTrade={handleDeletePeerTrade}
            />
          )}

          {normalizedTab === 'merchants' && (
            <MerchantsTab
              merchants={merchants}
              sales={sales}
              onAddMerchant={handleAddMerchant}
              onUpdateMerchant={handleUpdateMerchant}
              onDeleteMerchant={handleDeleteMerchant}
              onOpenNewSaleForMerchant={(mId) => handleOpenNewSale(mId)}
              onViewMerchantHistory={() => {}}
              onOpenDeletedHistory={() => setIsDeletedHistoryModalOpen(true)}
              deletedRecordsCount={deletedItems.filter((d) => d.type === 'MERCHANT').length}
              onOpenExcelImport={() => handleOpenExcelImport('MERCHANTS')}
            />
          )}

          {normalizedTab === 'suppliers' && (
            <SuppliersTab
              suppliers={suppliers}
              transactions={transactions}
              products={products}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onOpenNewEntryWithSupplier={(supId) => handleOpenNewEntry(supId)}
              onViewSupplierLedger={handleViewSupplierLedger}
              onOpenDeletedHistory={() => setIsDeletedHistoryModalOpen(true)}
              deletedRecordsCount={deletedItems.filter((d) => d.type === 'SUPPLIER').length}
              onOpenExcelImport={() => handleOpenExcelImport('SUPPLIERS')}
            />
          )}

          {normalizedTab === 'products' && (
            <ProductsTab
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onOpenExcelImport={() => handleOpenExcelImport('PRODUCTS')}
            />
          )}

          {normalizedTab === 'history' && (
            <UnifiedHistoryTab
              transactions={transactions}
              sales={sales}
              onViewInboundVoucher={handleViewInboundVoucher}
              onViewSaleVoucher={handleViewSaleVoucher}
              onDeleteTransaction={handleDeleteTransaction}
              onDeleteSale={handleDeleteSale}
            />
          )}

          {normalizedTab === 'reports' && (
            <ReportsTab
              suppliers={suppliers}
              products={products}
              transactions={transactions}
              sales={sales}
              merchants={merchants}
              merchantPurchases={merchantPurchases}
              returnsAndRefunds={returnsAndRefunds}
              onOpenCashLedger={() => setIsCashLedgerModalOpen(true)}
            />
          )}

          {normalizedTab === 'backup' && (
            <SettingsBackupTab
              products={products}
              suppliers={suppliers}
              transactions={transactions}
              merchants={merchants}
              sales={sales}
              stockAdjustments={stockAdjustments}
              shopSettings={shopSettings}
              currentSession={currentSession}
              deletedRecordsCount={deletedItems.length}
              backupReminderSettings={backupReminderSettings}
              onUpdateBackupReminderSettings={setBackupReminderSettings}
              onOpenBackupReminderModal={() => setIsBackupReminderOpen(true)}
              onOpenEditShopProfile={() => setIsShopProfileModalOpen(true)}
              onOpenBackupSaveModal={() => setIsBackupModalOpen(true)}
              onOpenDeletedHistory={() => setIsDeletedHistoryModalOpen(true)}
              onOpenClearDataModal={() => setIsClearDataModalOpen(true)}
              onOpenAuditHistory={() => setIsAuditHistoryModalOpen(true)}
              appLockSettings={appLockSettings}
              onUpdateAppLockSettings={handleUpdateAppLock}
              snapshots={snapshots}
              onRestoreSnapshot={handleRestoreSnapshot}
              onTakeSnapshotNow={handleTakeSnapshotNow}
              onOpenSyncModal={() => setIsLocalSyncModalOpen(true)}
              onOpenZapyaModal={() => setIsZapyaModalOpen(true)}
              onOpenZeroSettings={() => setIsZeroResetModalOpen(true)}
              onLoadDemoData={handleLoadDemoData}
              onOpenExcelImport={() => handleOpenExcelImport('PRODUCTS')}
              onOpenUserGuide={() => setIsUserGuideOpen(true)}
              onRestoreData={handleRestoreData}
              onAddSupplier={handleAddSupplier}
              onAddMerchant={handleAddMerchant}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onCheckForUpdates={handleManualCheckUpdate}
              isCheckingUpdates={isCheckingUpdate}
              onSaveSettings={setShopSettings}
            />
          )}
        </main>

        {/* Global Bottom Navigation */}
        <BottomNav
          activeTab={normalizedTab}
          onTabChange={(tab) => setActiveTab(tab)}
          todayInboundCount={todayInboundCount}
          todaySalesCount={todaySalesCount}
          lowStockAlertCount={lowStockAlertCount}
          pendingOrdersCount={pendingOrdersCount}
          currentSession={currentSession}
          allowedTabs={currentSession?.allowedTabs || shopSettings.staffAllowedTabs}
        />

        {/* Modals */}
        <NewEntryModal
          isOpen={isNewEntryModalOpen}
          onClose={() => setIsNewEntryModalOpen(false)}
          suppliers={suppliers}
          products={products}
          initialSupplierId={initialEntrySupplierId}
          selectedDate={selectedDate}
          onSave={handleSaveTransaction}
          onAddSupplier={handleAddSupplier}
          onAddProduct={handleAddProduct}
        />

        <NewSaleModal
          isOpen={isNewSaleModalOpen}
          onClose={() => setIsNewSaleModalOpen(false)}
          merchants={merchants}
          products={products}
          initialMerchantId={initialSaleMerchantId}
          selectedDate={selectedDate}
          inventoryStock={inventoryStock}
          onSave={handleSaveSale}
          onAddNewMerchant={handleAddMerchant}
        />

        <VoucherModal
          isOpen={isVoucherModalOpen}
          onClose={() => setIsVoucherModalOpen(false)}
          transaction={activeVoucherTx}
          shopSettings={shopSettings}
        />

        <SaleVoucherModal
          isOpen={isSaleVoucherModalOpen}
          onClose={() => setIsSaleVoucherModalOpen(false)}
          sale={activeSaleVoucher}
          shopSettings={shopSettings}
        />

        <SupplierLedgerModal
          isOpen={isLedgerModalOpen}
          onClose={() => setIsLedgerModalOpen(false)}
          supplier={ledgerSupplier}
          transactions={transactions}
          onViewVoucher={handleViewInboundVoucher}
        />

        <EditShopProfileModal
          isOpen={isShopProfileModalOpen}
          onClose={() => setIsShopProfileModalOpen(false)}
          shopSettings={shopSettings}
          onSave={setShopSettings}
        />

        <BackupSaveModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          onImportBackup={handleImportBackupData}
        />

        <DeletedHistoryModal
          isOpen={isDeletedHistoryModalOpen}
          onClose={() => setIsDeletedHistoryModalOpen(false)}
          deletedItems={deletedItems}
          onRestore={handleRestoreDeletedItem}
          onPermanentDelete={handlePermanentDelete}
          onEmptyTrash={handleEmptyTrash}
        />

        <ClearDataModal
          isOpen={isClearDataModalOpen}
          onClose={() => setIsClearDataModalOpen(false)}
          onConfirmClear={handleConfirmClearAll}
        />

        <BackupReminderModal
          isOpen={isBackupReminderOpen}
          onClose={() => setIsBackupReminderOpen(false)}
          onBackupNow={async () => {
            try {
              const entry = await recordAuditEvent({
                action: 'မိတ္တူ သိမ်းဆည်းခြင်း',
                details: 'Backup downloaded',
                entityType: 'BACKUP',
              });
              setAuditLogs((prev) => [entry, ...prev.slice(0, 199)]);
            } catch (err) {
              console.error('Audit log error:', err);
            }
          }}
        />

        <NewOrderNotificationModal
          isOpen={isNotificationOpen}
          onClose={() => setIsNotificationOpen(false)}
          order={notificationOrder}
          onGoToOrders={() => setActiveTab('orders')}
        />

        <ActionVoucherPromptModal
          isOpen={actionPrompt.isOpen}
          onClose={() => setActionPrompt((prev) => ({ ...prev, isOpen: false }))}
          title={actionPrompt.title}
          message={actionPrompt.message}
          onOpenVoucher={() => {
            if (actionPrompt.type === 'INBOUND' && actionPrompt.item) {
              handleViewInboundVoucher(actionPrompt.item as TransactionRecord);
            } else if (actionPrompt.type === 'OUTBOUND' && actionPrompt.item) {
              handleViewSaleVoucher(actionPrompt.item as SaleRecord);
            }
          }}
        />

        <LocalSyncModal
          isOpen={isLocalSyncModalOpen}
          onClose={() => setIsLocalSyncModalOpen(false)}
          onImportData={handleImportBackupData}
        />

        <ZapyaTransferModal
          isOpen={isZapyaModalOpen}
          onClose={() => setIsZapyaModalOpen(false)}
          onImportData={handleImportBackupData}
        />

        <AppLockSettingsModal
          isOpen={isAppLockSettingsOpen}
          onClose={() => setIsAppLockSettingsOpen(false)}
          appLockSettings={appLockSettings}
          onSave={handleUpdateAppLock}
          onLockNow={handleLockApp}
        />

        <UserGuideModal
          isOpen={isUserGuideOpen}
          onClose={() => setIsUserGuideOpen(false)}
          onOpenZeroReset={() => setIsZeroResetModalOpen(true)}
          onOpenNewEntry={() => handleOpenNewEntry()}
          onOpenNewSale={() => handleOpenNewSale()}
        />

        <ZeroSettingsConfirmModal
          isOpen={isZeroResetModalOpen}
          onClose={() => setIsZeroResetModalOpen(false)}
          onConfirmZeroReset={handleConfirmZeroReset}
          onLoadDemoData={handleLoadDemoData}
          appLockSettings={appLockSettings}
          onUpdateAppLockSettings={handleUpdateAppLock}
        />

        <DemoReloadConfirmModal
          isOpen={isDemoReloadGuardModalOpen}
          onClose={() => setIsDemoReloadGuardModalOpen(false)}
          onConfirmReload={handleExecuteDemoDataReload}
          appLockSettings={appLockSettings}
        />

        <LowStockAlertModal
          isOpen={isLowStockAlertModalOpen}
          onClose={() => setIsLowStockAlertModalOpen(false)}
          lowStockProducts={lowStockProductsList}
          onOpenNewEntryWithProduct={() => {
            handleOpenNewEntry();
          }}
          onGoToInventory={() => {
            setActiveTab('inventory');
            setIsLowStockAlertModalOpen(false);
          }}
        />

        <ExcelImportModal
          isOpen={isExcelImportOpen}
          onClose={() => setIsExcelImportOpen(false)}
          defaultTarget={excelImportTarget}
          existingProducts={products}
          existingSuppliers={suppliers}
          existingMerchants={merchants}
          onImportProducts={handleImportProducts}
          onImportSuppliers={handleImportSuppliers}
          onImportMerchants={handleImportMerchants}
        />

        <UpdateNotificationModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          onUpdate={handleApplyUpdate}
          newVersion={`v${CURRENT_APP_VERSION}`}
          isChecking={isCheckingUpdate}
        />

        <CashLedgerModal
          isOpen={isCashLedgerModalOpen}
          onClose={() => setIsCashLedgerModalOpen(false)}
          onRefreshData={async () => {
            const [dbTransactions, dbSales, dbPurchases] = await Promise.all([
              transactionRepo.getAll(),
              saleRepo.getAll(),
              purchaseRepo.getAll(),
            ]);
            setTransactions(dbTransactions);
            setSales(dbSales);
            setMerchantPurchases(dbPurchases);
          }}
        />

        <ReturnRefundModal
          isOpen={isReturnRefundModalOpen}
          onClose={() => {
            setIsReturnRefundModalOpen(false);
            setSelectedReturnSale(null);
            setSelectedReturnPurchase(null);
          }}
          sales={sales}
          merchantPurchases={merchantPurchases}
          products={products}
          initialSelectedSale={selectedReturnSale}
          initialSelectedPurchase={selectedReturnPurchase}
          onReturnSuccess={handleReturnSuccess}
        />

        <AuditHistoryModal
          isOpen={isAuditHistoryModalOpen}
          onClose={() => setIsAuditHistoryModalOpen(false)}
          auditLogs={auditLogs}
        />

        <UserSwitchModal
          isOpen={isUserSwitchModalOpen}
          onClose={() => setIsUserSwitchModalOpen(false)}
          currentSession={currentSession}
          appLockSettings={appLockSettings}
          onSessionChanged={(newSession) => setCurrentSession(newSession)}
          onLogout={() => {
            logoutUserSession();
            setCurrentSession(null);
            handleLockApp();
          }}
        />

        {/* Exit Confirm Dialog Modal for Back Navigation */}
        {isExitConfirmModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">အက်ပ်မှ ထွက်လိုပါသလား?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ရွှေလက်ရာ အပလီကေးရှင်းမှ ထွက်ခွာပါတော့မည်။
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setIsExitConfirmModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
                >
                  မထွက်သေးပါ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExitConfirmModalOpen(false);
                    if (typeof window !== 'undefined') {
                      window.close();
                      window.location.href = 'about:blank';
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  အက်ပ်မှ ထွက်မည်
                </button>
              </div>
            </div>
          </div>
        )}

        {showExitToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-950/90 text-white rounded-xl shadow-2xl text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2 border border-slate-700 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>အက်ပ်မှ ထွက်ရန် နောက်သို့ ထပ်နှိပ်ပါ (Press back again to exit)</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
