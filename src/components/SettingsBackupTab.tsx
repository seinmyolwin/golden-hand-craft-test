import React, { useRef, useState, useMemo } from 'react';
import {
  Supplier,
  Product,
  TransactionRecord,
  Merchant,
  SaleRecord,
  StockAdjustmentRecord,
  ShopSettings,
  BackupReminderSettings,
  AppLockSettings,
  AutoRecoverySnapshot,
  RawMaterialPreset,
  BackupValidationReport,
  UserSession,
  ActiveTab,
} from '../types';
import {
  exportSuppliersCSV,
  exportMerchantsCSV,
  exportDailyCollectionCSV,
  exportSalesHistoryCSV,
  exportInventoryCSV,
  generate100SampleSuppliers,
  computeAllProductsStock,
  DEFAULT_SHOP_SETTINGS,
  DEFAULT_APP_LOCK,
  formatMMK,
  formatNumberOnly,
  getTodayDateString,
  getCurrentTimeString,
  getStoredRawMaterialPresets,
  saveStoredRawMaterialPresets,
  DEFAULT_RAW_MATERIAL_PRESETS,
  loadShopSettings,
} from '../utils/storage';
import { CURRENT_APP_VERSION } from '../constants/version';
import { generateStableId } from '../utils/idGenerator';
import {
  derivePinCredentials,
  deriveRecoveryCredentials,
  generateSecureRecoveryKey,
  verifyAppLockRecoveryKey,
  SECURITY_DISCLOSURE_MY,
} from '../services/cryptoSecurity';
import {
  productRepo,
  supplierRepo,
  merchantRepo,
  transactionRepo,
  saleRepo,
  stockAdjustmentRepo,
} from '../repositories';
import {
  createCompleteBackup,
  downloadBackupFile,
  validateBackupFile,
  createAutoRecoverySnapshot,
  getRecoverySnapshots,
} from '../services/backupService';
import { cleanupAuditLogsByRetentionPolicy } from '../services/auditTrailService';
import { BackupImportPreviewModal } from './BackupImportPreviewModal';
import { AutoRecoverySnapshotsModal } from './AutoRecoverySnapshotsModal';
import { DatabaseHealthModal } from './DatabaseHealthModal';
import { ProductMasterModal } from './master/ProductMasterModal';
import { Logo } from './Logo';
import {
  Activity,
  Database,
  Download,
  Upload,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  Package,
  Store,
  Edit3,
  FolderDown,
  FolderOpen,
  Trash2,
  History,
  BellRing,
  Clock,
  Lock,
  Unlock,
  Radio,
  Share2,
  RotateCcw,
  CheckCircle2,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Search,
  X,
  Tag,
  SlidersHorizontal,
  BookOpen,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  DEFAULT_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_TRANSACTIONS,
  INITIAL_MERCHANTS,
  INITIAL_SALES,
} from '../data/defaultData';

interface SettingsBackupTabProps {
  products: Product[];
  suppliers: Supplier[];
  transactions: TransactionRecord[];
  merchants: Merchant[];
  sales: SaleRecord[];
  stockAdjustments: StockAdjustmentRecord[];
  shopSettings?: ShopSettings;
  currentSession?: UserSession | null;
  deletedRecordsCount?: number;
  backupReminderSettings?: BackupReminderSettings;
  onUpdateBackupReminderSettings?: (newSettings: BackupReminderSettings) => void;
  onOpenBackupReminderModal?: () => void;
  onOpenEditShopProfile?: () => void;
  onOpenBackupSaveModal?: () => void;
  onOpenDeletedHistory?: () => void;
  onOpenClearDataModal?: () => void;
  onOpenAuditHistory?: () => void;
  appLockSettings?: AppLockSettings;
  onUpdateAppLockSettings?: (settings: AppLockSettings) => void;
  snapshots?: AutoRecoverySnapshot[];
  onRestoreSnapshot?: (snapshot: AutoRecoverySnapshot) => void;
  onTakeSnapshotNow?: (reason: string) => void;
  onOpenSyncModal?: () => void;
  onOpenZapyaModal?: () => void;
  onRestoreData: (
    products: Product[],
    suppliers: Supplier[],
    transactions: TransactionRecord[],
    merchants?: Merchant[],
    sales?: SaleRecord[],
    stockAdjustments?: StockAdjustmentRecord[],
    shopSettings?: ShopSettings
  ) => void;
  onAddSupplier?: (supplier: Supplier) => void;
  onAddMerchant?: (merchant: Merchant) => void;
  onAddProduct?: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onOpenUserGuide?: () => void;
  onOpenZeroSettings?: () => void;
  onLoadDemoData?: () => void;
  onOpenExcelImport?: () => void;
  onCheckForUpdates?: () => void;
  isCheckingUpdates?: boolean;
  onSaveSettings?: (settings: ShopSettings) => void;
  isLive?: boolean;
}

export const SettingsBackupTab: React.FC<SettingsBackupTabProps> = ({
  products = [],
  suppliers = [],
  transactions = [],
  merchants = [],
  sales = [],
  stockAdjustments = [],
  shopSettings = DEFAULT_SHOP_SETTINGS,
  currentSession,
  deletedRecordsCount = 0,
  backupReminderSettings,
  onUpdateBackupReminderSettings,
  onOpenBackupReminderModal,
  onOpenEditShopProfile,
  onOpenBackupSaveModal,
  onOpenDeletedHistory,
  onOpenClearDataModal,
  onOpenAuditHistory,
  appLockSettings,
  onUpdateAppLockSettings,
  snapshots = [],
  onRestoreSnapshot,
  onTakeSnapshotNow,
  onOpenSyncModal,
  onOpenZapyaModal,
  onRestoreData,
  onAddSupplier,
  onAddMerchant,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onOpenUserGuide,
  onOpenZeroSettings,
  onLoadDemoData,
  onOpenExcelImport,
  onCheckForUpdates,
  isCheckingUpdates = false,
  onSaveSettings,
  isLive = false,
}) => {
  const isOwner = currentSession ? currentSession.role === 'OWNER' : true;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingPin, setEditingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [snapshotReason, setSnapshotReason] = useState('');
  const [retentionPeriod, setRetentionPeriod] = useState<string>(
    shopSettings?.auditRetentionPeriod || 'FOREVER'
  );
  const [isCleaningAudit, setIsCleaningAudit] = useState<boolean>(false);

  const handleRetentionChange = async (newPeriod: string) => {
    if (!isOwner) {
      alert('စာရင်းစစ် မှတ်တမ်း ထိန်းသိမ်းချိန် သတ်မှတ်ခြင်းကို ဆိုင်ရှင် (OWNER) သာ လုပ်ဆောင်နိုင်ပါသည်');
      return;
    }
    setRetentionPeriod(newPeriod);
    const updatedSettings: ShopSettings = {
      ...(shopSettings || DEFAULT_SHOP_SETTINGS),
      auditRetentionPeriod: newPeriod as any,
    };
    if (onSaveSettings) {
      onSaveSettings(updatedSettings);
    }
    setIsCleaningAudit(true);
    try {
      const result = await cleanupAuditLogsByRetentionPolicy(newPeriod);
      if (result.purgedCount > 0) {
        alert(`သတ်မှတ်ထားသော သက်တမ်း (${newPeriod}) ထက်ကျော်လွန်သည့် စာရင်းစစ် မှတ်တမ်းအဟောင်း ${result.purgedCount} ခုကို အလိုအလျောက် ရှင်းထုတ်ပြီးပါပြီ။`);
      } else {
        alert('သန့်ရှင်းရန် မှတ်တမ်းအဟောင်း မရှိသေးပါ (သို့မဟုတ်) သက်တမ်းမပြည့်သေးပါ။');
      }
    } catch (err) {
      console.error('Audit retention cleanup error:', err);
    } finally {
      setIsCleaningAudit(false);
    }
  };

  // Backup & Safe Recovery System States
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<BackupValidationReport | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isSnapshotsModalOpen, setIsSnapshotsModalOpen] = useState<boolean>(false);
  const [isDatabaseHealthOpen, setIsDatabaseHealthOpen] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState<boolean>(false);

  // Password Recovery Key State
  const [showRecoveryKey, setShowRecoveryKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [isKeyResetOpen, setIsKeyResetOpen] = useState<boolean>(false);
  const [resetKeyInput, setResetKeyInput] = useState<string>('');
  const [resetNewPin, setResetNewPin] = useState<string>('');
  const [resetConfirmPin, setResetConfirmPin] = useState<string>('');
  const [resetError, setResetError] = useState<string>('');
  const [resetSuccess, setResetSuccess] = useState<string>('');

  // Entity Management State (Settings Tab)
  const [productSearch, setProductSearch] = useState<string>('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [isAddSupOpen, setIsAddSupOpen] = useState<boolean>(false);
  const [isAddMerchOpen, setIsAddMerchOpen] = useState<boolean>(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Supplier Form State
  const [supName, setSupName] = useState<string>('');
  const [supVillage, setSupVillage] = useState<string>('မင်းနန်သူ');
  const [supPhone, setSupPhone] = useState<string>('');
  const [supNotes, setSupNotes] = useState<string>('');

  // Merchant Form State
  const [merchName, setMerchName] = useState<string>('');
  const [merchTown, setMerchTown] = useState<string>('မန္တလေး');
  const [merchPhone, setMerchPhone] = useState<string>('');
  const [merchAddress, setMerchAddress] = useState<string>('');
  const [merchNotes, setMerchNotes] = useState<string>('');

  // Product Form State
  const [prodName, setProdName] = useState<string>('');
  const [prodCategory, setProdCategory] = useState<string>('ကုန်ချော');
  const [prodBuyPrice, setProdBuyPrice] = useState<number>(3000);
  const [prodWholesalePrice, setProdWholesalePrice] = useState<number>(4000);
  const [prodUnit, setProdUnit] = useState<string>('ထည်');
  const [prodOpeningStock, setProdOpeningStock] = useState<number>(0);
  const [prodMinStock, setProdMinStock] = useState<number>(10);

  // Raw Material Presets State
  const [rawMaterialPresets, setRawMaterialPresets] = useState<RawMaterialPreset[]>(() =>
    getStoredRawMaterialPresets()
  );
  const [isAddPresetOpen, setIsAddPresetOpen] = useState<boolean>(false);
  const [presetCategory, setPresetCategory] = useState<string>('BAMBOO');
  const [presetName, setPresetName] = useState<string>('');
  const [presetUnit, setPresetUnit] = useState<string>('လုံး');
  const [presetPrice, setPresetPrice] = useState<number>(3500);
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>('all');

  // Master Sections Collapse/Expand Toggles
  const [isProductMasterExpanded, setIsProductMasterExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('settings_product_master_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isRawMasterExpanded, setIsRawMasterExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('settings_raw_master_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleProductMaster = () => {
    setIsProductMasterExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('settings_product_master_expanded', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleRawMaster = () => {
    setIsRawMasterExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('settings_raw_master_expanded', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) {
      alert('ပစ္စည်းအမည် ရိုက်ထည့်ပေးပါ');
      return;
    }
    const catLabels: Record<string, string> = {
      BAMBOO: 'ဝါးကုန်ကြမ်း',
      RATTAN: 'ကြိမ်ကုန်ကြမ်း',
      CASH_ADVANCE: 'ငွေကြိုယူ',
      OTHER: 'အခြားကုန်ကြမ်း',
    };
    const newPreset: RawMaterialPreset = {
      id: generateStableId('preset'),
      name: presetName.trim(),
      category: presetCategory,
      categoryLabel: catLabels[presetCategory] || presetCategory,
      defaultUnit: presetUnit.trim() || 'ခု',
      defaultUnitPrice: Number(presetPrice) || 0,
      isCustom: true,
    };
    const updated = [...rawMaterialPresets, newPreset];
    setRawMaterialPresets(updated);
    saveStoredRawMaterialPresets(updated);
    setIsAddPresetOpen(false);
    setPresetName('');
    alert(`"${newPreset.name}" ကို ကုန်ကြမ်းကြိုထုတ် ရွေးချယ်မှုစာရင်းထဲ ထည့်သွင်းပြီးပါပြီ`);
  };

  const handleDeletePreset = (id: string, name: string) => {
    if (confirm(`"${name}" ကို ရွေးချယ်မှုစာရင်းထဲမှ ဖျက်ထုတ်လိုပါသလား?`)) {
      const updated = rawMaterialPresets.filter((p) => p.id !== id);
      setRawMaterialPresets(updated);
      saveStoredRawMaterialPresets(updated);
    }
  };

  const handleResetPresetsToDefault = () => {
    if (
      confirm('ကုန်ကြမ်းကြိုထုတ် ရွေးချယ်မှုစာရင်းကို မူလသတ်မှတ်ချက်များအတိုင်း ပြန်လည်ထားရှိလိုပါသလား?')
    ) {
      setRawMaterialPresets(DEFAULT_RAW_MATERIAL_PRESETS);
      saveStoredRawMaterialPresets(DEFAULT_RAW_MATERIAL_PRESETS);
      alert('မူလကုန်ကြမ်းစာရင်းများ ပြန်လည်သတ်မှတ်ပြီးပါပြီ');
    }
  };

  // Download Notification State
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string>('');

  const currentRecoveryKey =
    appLockSettings?.recoveryKey || '';

  const handleCopyRecoveryKey = () => {
    if (!currentRecoveryKey) {
      alert('Recovery Key မရှိသေးပါ။ Key အသစ်ထုတ်ယူပေးပါ');
      return;
    }
    navigator.clipboard.writeText(currentRecoveryKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = async () => {
    if (
      confirm(
        'Recovery Key အသစ်ထုတ်ယူလိုပါသလား?\n\n(Key အသစ်ထုတ်ယူပြီးပါက ယခင် Key ဖြင့် ပြန်လည်ရယူနိုင်တော့မည် မဟုတ်ပါ)'
      )
    ) {
      const newKey = generateSecureRecoveryKey();
      const recCreds = await deriveRecoveryCredentials(newKey);
      if (onUpdateAppLockSettings && appLockSettings) {
        onUpdateAppLockSettings({
          ...appLockSettings,
          recoveryKey: newKey,
          recoverySalt: recCreds.salt,
          recoveryHash: recCreds.hash,
        });
      }
      alert(`Recovery Key အသစ် ထုတ်ယူပြီးပါပြီ:\n${newKey}\n\nဤကီးကို သေချာမှတ်သားသိမ်းဆည်းထားပါ`);
    }
  };

  const handleDirectKeyResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!resetKeyInput.trim()) {
      setResetError('Recovery Key ရိုက်ထည့်ပေးပါ');
      return;
    }
    if (!resetNewPin || resetNewPin.length < 4) {
      setResetError('PIN အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
      return;
    }
    if (resetNewPin !== resetConfirmPin) {
      setResetError('PIN အသစ် နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီမှုမရှိပါ');
      return;
    }

    if (!appLockSettings) {
      setResetError('App Lock ဆက်တင် မတွေ့ပါ');
      return;
    }

    const isValid = await verifyAppLockRecoveryKey(resetKeyInput.trim(), appLockSettings);
    if (!isValid) {
      setResetError('Recovery Key မှားယွင်းနေပါသည်။ သေချာစစ်ဆေးပြီး ပြန်လည်ရိုက်ထည့်ပါ');
      return;
    }

    const pinCreds = await derivePinCredentials(resetNewPin);
    const updated: AppLockSettings = {
      ...appLockSettings,
      pinSalt: pinCreds.salt,
      pinHash: pinCreds.hash,
      isPinInitialized: true,
      failedAttempts: 0,
      lockedUntilTimestamp: undefined,
      lastResetAt: new Date().toISOString(),
    };
    delete updated.passcode;
    delete updated.pin;

    if (onUpdateAppLockSettings) {
      onUpdateAppLockSettings(updated);
    }
    setResetSuccess('စကားဝှက် (PIN) အသစ် အောင်မြင်စွာ ပြောင်းလဲသတ်မှတ်ပြီးပါပြီ!');
    setResetKeyInput('');
    setResetNewPin('');
    setResetConfirmPin('');
    setTimeout(() => {
      setIsKeyResetOpen(false);
      setResetSuccess('');
    }, 1500);
  };

  const handleBackup = () => {
    if (onOpenBackupSaveModal) {
      onOpenBackupSaveModal();
    } else {
      handleShweLetYarDocBackup(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) {
      alert('Backup ပြန်လည်သွင်းယူခြင်းကို ဆိုင်ရှင် (OWNER) သာ ဆောင်ရွက်ခွင့်ရှိပါသည်');
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsValidating(true);
    setImportFileName(file.name);

    try {
      const text = await file.text();
      const report = await validateBackupFile(text);
      setValidationReport(report);
      setIsImportPreviewOpen(true);
    } catch (err: any) {
      alert(`ဖိုင်စစ်ဆေး၍ မရပါ: ${err?.message || 'Corrupted file'}`);
    } finally {
      setIsValidating(false);
      e.target.value = '';
    }
  };

  const handleLoad100Suppliers = () => {
    if (!isOwner) {
      alert('နမူနာဒေတာ သွင်းခြင်းကို ဆိုင်ရှင် (OWNER) သာ ဆောင်ရွက်ခွင့်ရှိပါသည်');
      return;
    }
    if (confirm('စမ်းသပ်ရန် ကုန်ကြမ်းပေးသွင်းသူ ၁၀၀ ဦး စာရင်းကို ထည့်သွင်းလိုပါသလား?')) {
      const generated = generate100SampleSuppliers();
      onRestoreData(products, generated, transactions, merchants, sales, stockAdjustments, shopSettings);
      alert(`ကုန်ကြမ်းပေးသွင်းသူ ၁၀၀ ဦး စာရင်း အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!`);
    }
  };

  const handleResetDefaults = () => {
    if (!isOwner) {
      alert('မူလနမူနာဒေတာ ပြန်သတ်မှတ်ခြင်းကို ဆိုင်ရှင် (OWNER) သာ ဆောင်ရွက်ခွင့်ရှိပါသည်');
      return;
    }
    if (confirm('မူလနမူနာ ဒေတာများအတိုင်း အစမှ ပြန်လည်သတ်မှတ်လိုပါသလား?')) {
      onRestoreData(DEFAULT_PRODUCTS, INITIAL_SUPPLIERS, INITIAL_TRANSACTIONS, INITIAL_MERCHANTS, INITIAL_SALES, [], DEFAULT_SHOP_SETTINGS);
      alert('မူလနမူနာဒေတာများ အောင်မြင်စွာ ပြန်လည်သတ်မှတ်ပြီးပါပြီ');
    }
  };

  const handleClearAll = () => {
    if (!isOwner) {
      alert('ဒေတာများ ရှင်းထုတ်ခြင်းကို ဆိုင်ရှင် (OWNER) သာ ဆောင်ရွက်ခွင့်ရှိပါသည်');
      return;
    }
    if (onOpenClearDataModal) {
      onOpenClearDataModal();
    } else {
      if (confirm('ဒေတာအားလုံးကို အပြီးတိုင် ရှင်းထုတ်လိုပါသလား? (သတိပေးချက်: ပြန်လည်ရယူနိုင်မည် မဟုတ်ပါ)')) {
        onRestoreData([], [], [], [], [], []);
        alert('ဒေတာများအားလုံး ရှင်းလင်းပြီးပါပြီ');
      }
    }
  };

  const inventoryStock = computeAllProductsStock(products || [], transactions || [], sales || [], stockAdjustments || []);

  const inventoryStockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventoryStock) {
      if (item.product?.id) {
        map.set(item.product.id, item.currentStock);
      }
    }
    return map;
  }, [inventoryStock]);

  const filteredProductsForSetting = useMemo(() => {
    return (products || []).filter((p) => {
      if (!p) return false;
      const matchesSearch =
        (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(productSearch.toLowerCase());
      const matchesCat = productCategoryFilter === 'all' || p.category === productCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, productSearch, productCategoryFilter]);

  const handleSaveSupplierFromSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      alert('ကုန်ပစ္စည်းပေးသွင်းသူ အမည် ထည့်သွင်းပေးပါ');
      return;
    }
    const newSup: Supplier = {
      id: generateStableId('sup'),
      code: `SUP-${String((suppliers || []).length + 1).padStart(3, '0')}`,
      name: supName.trim(),
      village: supVillage.trim() || 'မင်းနန်သူ',
      phone: supPhone.trim() || '-',
      notes: supNotes.trim(),
      initialAdvance: 0,
      currentAdvanceBalance: 0,
      totalGoodsValueDelivered: 0,
      totalAdvanceGiven: 0,
      totalMaterialCreditGiven: 0,
      totalRepaymentReceived: 0,
      createdAt: getTodayDateString(),
      updatedAt: getTodayDateString(),
    };
    if (onAddSupplier) {
      onAddSupplier(newSup);
      alert(`ကုန်ပစ္စည်းပေးသွင်းသူ "${newSup.name}" ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ`);
    }
    setIsAddSupOpen(false);
    setSupName('');
    setSupPhone('');
    setSupNotes('');
  };

  const handleSaveMerchantFromSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchName.trim()) {
      alert('ကုန်သည် အမည် ထည့်သွင်းပေးပါ');
      return;
    }
    const newMerch: Merchant = {
      id: generateStableId('m'),
      code: `M-${String((merchants || []).length + 1).padStart(3, '0')}`,
      name: merchName.trim(),
      town: merchTown.trim() || 'မန္တလေး',
      phone: merchPhone.trim() || '-',
      address: merchAddress.trim(),
      notes: merchNotes.trim(),
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: getTodayDateString(),
      updatedAt: getTodayDateString(),
    };
    if (onAddMerchant) {
      onAddMerchant(newMerch);
      alert(`ကုန်သည် "${newMerch.name}" ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ`);
    }
    setIsAddMerchOpen(false);
    setMerchName('');
    setMerchPhone('');
    setMerchAddress('');
    setMerchNotes('');
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdCategory(prod.category || 'ကုန်ချော');
    setProdBuyPrice(prod.defaultPrice || 0);
    setProdWholesalePrice(prod.defaultWholesalePrice || prod.defaultPrice || 0);
    setProdUnit(prod.unit || 'ထည်');
    setProdOpeningStock(prod.openingStock || 0);
    setProdMinStock(prod.minStockAlert || 10);
    setIsProductModalOpen(true);
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdCategory('ကုန်ချော');
    setProdBuyPrice(3000);
    setProdWholesalePrice(4000);
    setProdUnit('ထည်');
    setProdOpeningStock(0);
    setProdMinStock(10);
    setIsProductModalOpen(true);
  };

  const handleSaveProductFromSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      alert('ကုန်ပစ္စည်း အမည် ထည့်သွင်းပေးပါ');
      return;
    }
    if (editingProduct) {
      const updated: Product = {
        ...editingProduct,
        name: prodName.trim(),
        category: prodCategory.trim(),
        defaultPrice: Number(prodBuyPrice) || 0,
        defaultWholesalePrice: Number(prodWholesalePrice) || 0,
        unit: prodUnit.trim() || 'ထည်',
        openingStock: Number(prodOpeningStock) || 0,
        minStockAlert: Number(prodMinStock) || 0,
      };
      if (onUpdateProduct) {
        onUpdateProduct(updated);
        alert(`ကုန်ပစ္စည်း "${updated.name}" ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ`);
      }
    } else {
      const newProd: Product = {
        id: generateStableId('p'),
        name: prodName.trim(),
        category: prodCategory.trim(),
        defaultPrice: Number(prodBuyPrice) || 0,
        defaultWholesalePrice: Number(prodWholesalePrice) || 0,
        unit: prodUnit.trim() || 'ထည်',
        openingStock: Number(prodOpeningStock) || 0,
        currentStock: Number(prodOpeningStock) || 0,
        minStockAlert: Number(prodMinStock) || 10,
        active: true,
      };
      if (onAddProduct) {
        onAddProduct(newProd);
        alert(`ကုန်ပစ္စည်းသစ် "${newProd.name}" ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ`);
      }
    }
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleShweLetYarDocBackup = async (useFolderPicker: boolean = false) => {
    if (!isOwner) {
      alert('Backup ထုတ်ယူခြင်းကို ဆိုင်ရှင် (OWNER) သာ ဆောင်ရွက်ခွင့်ရှိပါသည်');
      return;
    }
    setIsBackingUp(true);
    try {
      const backup = await createCompleteBackup({
        shopSettings,
        customNotes: 'Manual Export from Settings Backup Tab',
      });
      const res = await downloadBackupFile(backup, useFolderPicker);
      if (res.success) {
        setDownloadSuccessMsg(
          `ဖိုင်အမည် "${res.fileName}" (${backup.metadata.totalRecords} records, v${backup.formatVersion}) ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။ ဖုန်းအတွင်း Download > "Shwe let yar doc." Folder ထဲသို့ ရွှေ့ပြောင်းသိမ်းဆည်းနိုင်ပါသည်။`
        );
        setTimeout(() => setDownloadSuccessMsg(''), 8000);
      }
    } catch (err: any) {
      alert(`Backup ထုတ်ယူရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်: ${err?.message || err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg space-y-2 border border-slate-800">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base sm:text-lg font-bold text-white">
            စနစ်ဆက်တင်များနှင့် ဒေတာသိမ်းဆည်းမှု (Settings & Backup)
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          ဒေတာများ အရန်သိမ်းဆည်းခြင်း၊ အော့ဖ်လိုင်းအသုံးပြုမှု၊ Password Key Reset နှင့် လုံခြုံရေးထိန်းချုပ်ခြင်း
        </p>
      </div>

      {/* User Guide and Zero Setup Quick Action Card */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 rounded-xl p-4 sm:p-5 text-white shadow-md border border-emerald-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                လမ်းညွှန်နှင့် စတင်အသုံးပြုပုံ
              </span>
              <span className="text-[10px] text-emerald-200 bg-emerald-800/80 px-2 py-0.5 rounded border border-emerald-600/50">
                မြန်မာလို အပြည့်အစုံ
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white mt-1">
              အက်ပ်အသုံးပြုနည်း လမ်းညွှန်နှင့် စတင်အသုံးပြုခြင်း
            </h3>
            <p className="text-xs text-emerald-100/80 mt-0.5 leading-relaxed">
              ကုန်သိမ်း၊ အရောင်း၊ ကုန်လက်ကျန် သတိပေးချက်၊ အော်ဒါ၊ ဆိုင်ချင်းဖလှယ်မှု၊ အော့ဖ်လိုင်း Backup နှင့် အက်ပ်စတင်အသုံးပြုရန် (Zero Setting) နည်းလမ်းများ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {!isLive && onOpenZeroSettings && isOwner && (
            <button
              id="settings-zero-start-btn"
              type="button"
              onClick={onOpenZeroSettings}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all border border-amber-300 animate-pulse"
            >
              <Sparkles className="w-4 h-4 fill-slate-950 text-slate-950" />
              <span>စတင်အသုံးပြုမည် (Zero)</span>
            </button>
          )}

          {onOpenUserGuide && (
            <button
              id="settings-open-user-guide-btn"
              type="button"
              onClick={onOpenUserGuide}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 active:scale-95 text-emerald-900 font-extrabold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <BookOpen className="w-4 h-4 text-emerald-700" />
              <span>လမ်းညွှန်စာအုပ် ဖွင့်ဖတ်မည်</span>
            </button>
          )}
        </div>
      </div>

      {/* Business Profile Management Card */}
      <div className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <Logo
              size="md"
              className="w-12 h-12 rounded-xl border border-amber-400/40 shadow-xs shrink-0"
              alt={shopSettings?.shopName || 'ရွှေလက်ရာ'}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  လုပ်ငန်းအချက်အလက်
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {shopSettings?.shopName || 'ရွှေလက်ရာ'}
              </h3>
              <p className="text-xs text-slate-500">
                {shopSettings?.tagline || 'မြန်မာ့လက်မှု ကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenEditShopProfile}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>ဆိုင်အမည်နှင့် လိပ်စာပြင်မည်</span>
          </button>
        </div>

        {(shopSettings?.phone || shopSettings?.address || shopSettings?.ownerName) && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
            {shopSettings?.ownerName && (
              <div>
                <span className="text-[10px] text-slate-400 block">ပိုင်ရှင်:</span>
                <span className="font-bold text-slate-800">{shopSettings.ownerName}</span>
              </div>
            )}
            {shopSettings?.phone && (
              <div>
                <span className="text-[10px] text-slate-400 block">ဖုန်း:</span>
                <span className="font-bold text-slate-800">{shopSettings.phone}</span>
              </div>
            )}
            {shopSettings?.address && (
              <div>
                <span className="text-[10px] text-slate-400 block">လိပ်စာ:</span>
                <span className="font-bold text-slate-800">{shopSettings.address}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= MASTER MANAGEMENT (ENTITIES & PRODUCTS) ================= */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-emerald-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                အဓိက အချက်အလက်နှင့် ကုန်ပစ္စည်း စီမံခန့်ခွဲမှု (Entity & Products Master)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ကုန်ပစ္စည်းပေးသွင်းသူအသစ်၊ ကုန်သည်အသစ်၊ ကုန်ပစ္စည်းအသစ် ထည့်သွင်းခြင်းနှင့် ကုန်ပစ္စည်းစာရင်း စိတ်ကြိုက် ပြင်ဆင်/ဖျက်/ထည့်ခြင်း
              </p>
            </div>
          </div>
        </div>

        {/* Quick Add Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Add Supplier */}
          <div className="p-3.5 bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-xs text-emerald-950">ကုန်ပစ္စည်းပေးသွင်းသူ အသစ်ထည့်ရန်</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                စုစုပေါင်း {suppliers.length} ဦး
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              ကုန်ချော/လက်မှု ပေးသွင်းသူအသစ်များ၏ အမည်၊ ရွာ၊ ဖုန်းနံပါတ် သတ်မှတ်ချက်များ
            </p>
            <button
              type="button"
              onClick={() => {
                setSupName('');
                setSupVillage('မင်းနန်သူ');
                setSupPhone('');
                setSupNotes('');
                setIsAddSupOpen(true);
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ပေးသွင်းသူ အသစ်ထည့်မည်</span>
            </button>
          </div>

          {/* Add Merchant */}
          <div className="p-3.5 bg-blue-50/60 hover:bg-blue-50 border border-blue-200 rounded-xl space-y-2 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700" />
                <span className="font-bold text-xs text-blue-950">ကုန်သည် အသစ်ထည့်ရန်</span>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                စုစုပေါင်း {merchants.length} ဦး
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              လက်ကားဝယ်ယူသူ ကုန်သည်အသစ်များ၏ အမည်၊ မြို့၊ ဖုန်းနံပါတ်၊ ဆိုင်လိပ်စာများ
            </p>
            <button
              type="button"
              onClick={() => {
                setMerchName('');
                setMerchTown('မန္တလေး');
                setMerchPhone('');
                setMerchAddress('');
                setMerchNotes('');
                setIsAddMerchOpen(true);
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ကုန်သည် အသစ်ထည့်မည်</span>
            </button>
          </div>

          {/* Add Product */}
          <div className="p-3.5 bg-purple-50/60 hover:bg-purple-50 border border-purple-200 rounded-xl space-y-2 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-700" />
                <span className="font-bold text-xs text-purple-950">ကုန်ပစ္စည်း အသစ်ထည့်ရန်</span>
              </div>
              <span className="text-[11px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200">
                စုစုပေါင်း {products.length} မျိုး
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              ပစ္စည်းအသစ်၏ အမည်၊ အမျိုးအစား၊ ဝယ်စျေး၊ လက်ကားစျေး၊ အနိမ့်ဆုံးသတိပေးလက်ကျန်
            </p>
            <button
              type="button"
              onClick={handleOpenAddProduct}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ကုန်ပစ္စည်း အသစ်ထည့်မည်</span>
            </button>
          </div>
        </div>

        {/* Product Management Section */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div
              className="cursor-pointer select-none flex items-center gap-2"
              onClick={toggleProductMaster}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                    ကုန်ပစ္စည်းစီမံခြင်း (Product Master)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {products.length} မျိုး
                  </span>
                  <span className="text-slate-400 hover:text-slate-600 p-0.5">
                    {isProductMasterExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isProductMasterExpanded
                    ? 'ကုန်ပစ္စည်းတစ်ခုချင်းစီ၏ အမည်၊ စျေးနှုန်း၊ အမျိုးအစားများကို ပြင်ဆင်နိုင်သည်'
                    : 'စာရင်းဝှက်ထားပါသည် (ဖွင့်ကြည့်ရန် နှိပ်ပါ)'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleProductMaster}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              >
                {isProductMasterExpanded ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                    <span>ဝှက်မည်</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>ဖော်မည်</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ပစ္စည်းသစ်ထည့်မည်</span>
              </button>
            </div>
          </div>

          {isProductMasterExpanded && (
            <>
              {/* Search and Category Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ကုန်ပစ္စည်း အမည် သို့မဟုတ် အမျိုးအစား ရှာဖွေပါ..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer w-full sm:w-auto"
                  >
                    <option value="all">အမျိုးအစား အားလုံး</option>
                    {Array.from(new Set(products.map((p) => p.category || 'အထွေထွေ'))).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Items Table / Cards */}
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredProductsForSetting.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    ရှာဖွေမှုနှင့် ကိုက်ညီသော ကုန်ပစ္စည်း မရှိပါ
                  </div>
                ) : (
                  filteredProductsForSetting.map((prod) => {
                    const stock = inventoryStockMap.get(prod.id) ?? prod.currentStock ?? 0;
                    return (
                      <div
                        key={prod.id}
                        className="p-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{prod.name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {prod.category}
                            </span>
                            {stock <= (prod.minStockAlert || 10) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                လက်ကျန်နည်း
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <span>ဝယ်စျေး: <strong className="text-slate-800">{formatMMK(prod.defaultPrice || 0)}</strong></span>
                            <span>•</span>
                            <span>လက်ကားစျေး: <strong className="text-emerald-700">{formatMMK(prod.defaultWholesalePrice || prod.defaultPrice || 0)}</strong></span>
                            <span>•</span>
                            <span>လက်ကျန်: <strong className="text-slate-800">{formatNumberOnly(stock)} {prod.unit || 'ထည်'}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(prod)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500" />
                            <span>ပြင်မည်</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`"${prod.name}" ကုန်ပစ္စည်းကို ဖျက်ရန် သေချာပါသလား?`)) {
                                if (onDeleteProduct) {
                                onDeleteProduct(prod.id);
                              }
                            }
                          }}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>ဖျက်</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
      </div>

      {/* ================= APP LOCK & PASSWORD KEY RESET CARD ================= */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-amber-300 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                appLockSettings?.enabled ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {appLockSettings?.enabled ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  App လုံခြုံရေး Password / PIN စနစ်
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    appLockSettings?.enabled
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {appLockSettings?.enabled ? 'Lock ဖွင့်ထားသည် (Active)' : 'Lock ပိတ်ထားသည် (Open)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ခွင့်ပြုချက်မရှိဘဲ စာရင်းမကြည့်နိုင်စေရန် PIN နံပါတ် နှင့် Password Reset Recovery စနစ်
              </p>
            </div>
          </div>
        </div>

        {/* Toggle Lock and Change PIN row */}
        {!isOwner ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>App Lock နှင့် Password/PIN စနစ်ကို ဆိုင်ရှင် (OWNER) သာ ပြင်ဆင်ခွင့်ရှိပါသည်</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/60 p-3 rounded-xl text-xs border border-amber-200">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={appLockSettings?.enabled ?? false}
                onChange={(e) =>
                  onUpdateAppLockSettings?.({
                    ...(appLockSettings || { enabled: false }),
                    enabled: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>App ဖွင့်တိုင်း Password / PIN တောင်းမည်</span>
            </label>

            <div className="flex items-center gap-2">
              {editingPin ? (
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">PIN အသစ်:</span>
                  <input
                    type="password"
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="၄~၈ လုံး"
                    className="w-24 px-2 py-1 bg-white border border-amber-300 rounded-lg text-center font-extrabold text-sm tracking-widest text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (newPin.length < 4) {
                        alert('PIN သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
                        return;
                      }
                      const pinCreds = await derivePinCredentials(newPin);
                      const updated: AppLockSettings = {
                        ...(appLockSettings || { enabled: true }),
                        pinSalt: pinCreds.salt,
                        pinHash: pinCreds.hash,
                        isPinInitialized: true,
                        enabled: true,
                        failedAttempts: 0,
                        lockedUntilTimestamp: undefined,
                      };
                      delete updated.passcode;
                      delete updated.pin;
                      onUpdateAppLockSettings?.(updated);
                      setEditingPin(false);
                      setNewPin('');
                      alert('PIN အသစ် ပြောင်းလဲပြီးပါပြီ!');
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg cursor-pointer"
                  >
                    သိမ်းမည်
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPin(false);
                      setNewPin('');
                    }}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                  >
                    ပယ်ဖျက်
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">
                    {appLockSettings?.isPinInitialized || appLockSettings?.pinHash
                      ? 'PIN သတ်မှတ်ထားပြီး (****)'
                      : 'PIN မသတ်မှတ်ရသေးပါ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPin('');
                      setEditingPin(true);
                    }}
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    PIN ပြောင်းမည်
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Disclosure Notice */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
          <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-slate-700">ဒေသတွင်း မျက်နှာပြင်သော့ အသိပေးချက် (Local App Lock Disclosure)</p>
            <p>{SECURITY_DISCLOSURE_MY}</p>
          </div>
        </div>

        {/* PASSWORD KEY RESET & RECOVERY OPTION SECTION */}
        {isOwner && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-xs text-slate-900">
                Password Recovery Key (စကားဝှက် ပြန်လည်ရယူရေးကီး)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsKeyResetOpen(!isKeyResetOpen)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                {isKeyResetOpen ? 'Reset ပိတ်မည်' : 'Password Key Reset ပြုလုပ်မည်'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            အကယ်၍ PIN စကားဝှက် မေ့သွားပါက ဤ <strong>Recovery Key</strong> ဖြင့် ချက်ချင်း ပြန်လည်ဖွင့်လှစ်ခြင်း သို့မဟုတ် စကားဝှက်အသစ် Reset ပြုလုပ်နိုင်ပါသည်။
          </p>

          {/* Recovery Key Display with Copy button */}
          <div className="p-3 bg-white border border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs text-slate-500 font-medium shrink-0">Recovery Key:</span>
              <span className="font-mono text-sm sm:text-base font-extrabold text-amber-600 tracking-wider">
                {showRecoveryKey ? currentRecoveryKey : '••••-••••-••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowRecoveryKey(!showRecoveryKey)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title={showRecoveryKey ? 'ကီးကို ဝှက်မည်' : 'ကီးကို ပြမည်'}
              >
                {showRecoveryKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleCopyRecoveryKey}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Recovery Key ကူးယူမည်"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'ကူးယူပြီး' : 'Copy Key'}</span>
              </button>

              <button
                type="button"
                onClick={handleRegenerateKey}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Recovery Key အသစ်ထုတ်ယူမည်"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Key အသစ်ထုတ်မည်</span>
              </button>
            </div>
          </div>

          {/* Password Key Reset Form Inline Drawer */}
          {isKeyResetOpen && (
            <form
              onSubmit={handleDirectKeyResetSubmit}
              className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-3 text-xs animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Recovery Key ဖြင့် PIN စကားဝှက် Reset ပြုလုပ်ခြင်း</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsKeyResetOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ပိတ်မည်
                </button>
              </div>

              {resetError && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 text-rose-800 rounded-lg font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">
                  Recovery Key ရိုက်ထည့်ပါ *
                </label>
                <input
                  type="text"
                  required
                  placeholder={`ဥပမာ - ${currentRecoveryKey}`}
                  value={resetKeyInput}
                  onChange={(e) => setResetKeyInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-mono font-bold text-xs uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">PIN အသစ် (၄~၆ လုံး) *</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    placeholder="PIN အသစ်"
                    value={resetNewPin}
                    onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-center font-bold text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">PIN အသစ် ထပ်ရိုက်ပါ *</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    placeholder="PIN ထပ်ရိုက်ပါ"
                    value={resetConfirmPin}
                    onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-center font-bold text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsKeyResetOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  PIN အသစ် အတည်ပြုမည်
                </button>
              </div>
            </form>
          )}
        </div>
        )}
      </div>

      {/* Multi-Device Hotspot Sync & Zapya Offline Transfer Card */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-indigo-900 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  ဖုန်းအချင်းချင်း ဒေတာကူးပြောင်းခြင်း (Multi-Phone Hotspot Sync)
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Wifi / Hotspot
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                အင်တာနက်မရှိချိန် ဖုန်းအချင်းချင်း Hotspot ဖွင့်ပြီး ဒေတာများကို တိုက်ရိုက် ပေါင်းစပ်နိုင်ပါသည်
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white/10 hover:bg-white/15 p-3.5 rounded-xl border border-indigo-400/20 flex flex-col justify-between space-y-3 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white">Hotspot / WiFi ဖြင့် Sync ပြုလုပ်မည်</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                ဖုန်းနှစ်လုံး Hotspot ချိတ်ဆက်ပြီး QR Code / ကုတ်နံပါတ်ဖြင့် အပြန်အလှန် ဒေတာဖလှယ်မည်
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <Radio className="w-4 h-4" />
              <span>Hotspot Sync ဖွင့်မည်</span>
            </button>
          </div>

          <div className="bg-white/10 hover:bg-white/15 p-3.5 rounded-xl border border-purple-400/20 flex flex-col justify-between space-y-3 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-xs text-white">Zapya / Bluetooth ဖြင့် ပို့မည်</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                App တစ်ခုလုံး သို့မဟုတ် Backup ဖိုင်ကို Zapya / ShareMe မှတစ်ဆင့် အခြားဖုန်းသို့ ပေးပို့နိုင်သည်
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenZapyaModal}
              className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Zapya မျှဝေမည်</span>
            </button>
          </div>

          <div className="bg-white/10 hover:bg-white/15 p-3.5 rounded-xl border border-emerald-400/20 flex flex-col justify-between space-y-3 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white">Excel ဖြင့် စာရင်းအမြောက်အမြား သွင်းမည်</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                ကုန်ပစ္စည်း၊ ပေးသွင်းသူ၊ ကုန်သည်စာရင်း ရာထောင်ချီကို Excel (.xlsx) ဖြင့် တစ်ပြိုင်နက် သွင်းနိုင်သည်
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenExcelImport}
              className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel Import ဖွင့်မည်</span>
            </button>
          </div>
        </div>
      </div>

      {/* App Version & Updates Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  အက်ပ် ဗားရှင်းနှင့် အဆင့်မြှင့်တင်မှု စစ်ဆေးခြင်း (App Version & Updates)
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  v{CURRENT_APP_VERSION} (Latest)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ဗားရှင်းအသစ်များ ထွက်ပေါ်လာပါက အချက်ပေးစနစ် အလိုအလျောက် သတိပေးမည်ဖြစ်ပါသည်
              </p>
            </div>
          </div>

          {onCheckForUpdates && (
            <button
              type="button"
              disabled={isCheckingUpdates}
              onClick={onCheckForUpdates}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-all shrink-0 self-start sm:self-auto"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdates ? 'စစ်ဆေးနေပါသည်...' : 'ဗားရှင်းအသစ် စစ်ဆေးမည်'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Mobile Back Key Support</span>
            </span>
            <p className="text-[11px] text-slate-500">
              ဖုန်း/တက်ဘလက် Back key နိပ်ပါက အက်ပ်မှ မထွက်ပဲ မူလစာမျက်နှာသို့ ပြန်ပို့ပေးပါသည်
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Page Refresh Resilience</span>
            </span>
            <p className="text-[11px] text-slate-500">
              Browser refresh ပြုလုပ်ပါက စာရင်းမှ မထွက်ပဲ ဖွင့်လက်စနေရာတွင် ဆက်လက်ရှိနေပါသည်
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Offline Ready (PWA)</span>
            </span>
            <p className="text-[11px] text-slate-500">
              အင်တာနက် မရှိချိန်တွင်လည်း အချက်အလက်များ သိမ်းဆည်းနိုင်ပြီး ပုံမှန်အလုပ်လုပ်ပါသည်
            </p>
          </div>
        </div>
      </div>

      {/* Database Health & System Diagnostics Card (Phase 12) */}
      <div className="bg-white rounded-xl p-4 border border-emerald-300 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300/40">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  ဒေတာဘေ့စ် စစ်ဆေးမှုနှင့် ကျန်းမာရေး (Database Health & Diagnostics)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Read-Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                စာရင်းဒေတာ တည်ငြိမ်မှု၊ ID မထပ်စေရေး၊ အကိုးအကားနှင့် ငွေကြေးဆိုင်ရာ အမှားများအား အလိုအလျောက် စစ်ဆေးခြင်း
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenAuditHistory && (
              <button
                id="settings-audit-trail-btn"
                type="button"
                onClick={onOpenAuditHistory}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>စာရင်းစစ်မှတ်တမ်း (Audit Trail)</span>
              </button>
            )}
            {!isOwner ? (
              <span className="px-3 py-1.5 bg-slate-100 text-slate-500 font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-slate-200">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>စစ်ဆေးပြုပြင်ခြင်းကို ဆိုင်ရှင်သာ လုပ်ဆောင်နိုင်ပါသည်</span>
              </span>
            ) : (
              <button
                id="settings-db-health-btn"
                type="button"
                onClick={() => setIsDatabaseHealthOpen(true)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
              >
                <Activity className="w-4 h-4 text-emerald-300" />
                <span>ကျန်းမာရေး စစ်ဆေးမည် (Run Diagnostics)</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-medium">Schema Status</div>
            <div className="font-bold text-slate-800 mt-0.5">Active (Dexie v4)</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-medium">Data Integrity</div>
            <div className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Protected</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-medium">Offline Architecture</div>
            <div className="font-bold text-slate-800 mt-0.5">IndexedDB Only</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[11px] text-slate-500 font-medium">Safety Guarantee</div>
            <div className="font-bold text-blue-700 mt-0.5">Non-Destructive</div>
          </div>
        </div>
      </div>

      {/* Audit-log Retention Policy Card (Phase 21 Requirement 3) */}
      <div className="bg-white rounded-xl p-4 border border-amber-300 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  စာရင်းစစ် မှတ်တမ်း ထိန်းသိမ်းချိန် သတ်မှတ်ချက် (Audit-Log Retention Policy)
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Owner Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                သတ်မှတ်ထားသော သက်တမ်းထက် ကျော်လွန်သည့် စာရင်းစစ်မှတ်တမ်းများကို အလိုအလျောက် သန့်ရှင်းရေး ပြုလုပ်ပေးပါမည်
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              disabled={!isOwner || isCleaningAudit}
              value={retentionPeriod}
              onChange={(e) => handleRetentionChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-amber-300 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="10_DAYS">၁၀ ရက် (10 Days)</option>
              <option value="3_MONTHS">၃ လ (3 Months)</option>
              <option value="4_MONTHS">၄ လ (4 Months)</option>
              <option value="5_MONTHS">၅ လ (5 Months)</option>
              <option value="1_YEAR">၁ နှစ် (1 Year)</option>
              <option value="FOREVER">အစဉ်အမြဲ ထိန်းသိမ်းမည် (Keep Forever)</option>
            </select>

            <button
              type="button"
              disabled={!isOwner || isCleaningAudit}
              onClick={() => handleRetentionChange(retentionPeriod)}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 disabled:opacity-50"
              title="ယခု အလိုအလျောက် သန့်ရှင်းရေး လုပ်ဆောင်မည်"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isCleaningAudit ? 'animate-spin' : ''}`} />
              <span>{isCleaningAudit ? 'သန့်ရှင်းနေသည်...' : 'သန့်ရှင်းမည်'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Time-stamped AutoRecovery Snapshots List Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  အလိုအလျောက် သိမ်းဆည်းမှတ်တမ်းများ (Time-stamped Snapshots)
                </h3>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {snapshots.length} ခု
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                အရောင်း၊ ကုန်သိမ်းမှု ပြုလုပ်တိုင်း အလိုအလျောက် သီးခြား Snapshot မှတ်တမ်းယူပေးထားပါသည်
              </p>
            </div>
          </div>
          {isOwner ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="အကြောင်းပြချက် (ရွေးချယ်ရန်)..."
                value={snapshotReason}
                onChange={(e) => setSnapshotReason(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg w-40 sm:w-48 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onTakeSnapshotNow?.(snapshotReason || 'ကိုယ်တိုင် မှတ်တမ်းယူ (Manual Snapshot)');
                  setSnapshotReason('');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                <span>Snapshot ယူမည်</span>
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>ဆိုင်ရှင်သာ Snapshot ရယူနိုင်ပါသည်</span>
            </span>
          )}
        </div>

        {snapshots.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
            အရောင်း သို့မဟုတ် ကုန်သိမ်းပြီးပါက Snapshot များ အလိုအလျောက် ဤနေရာတွင် ပေါ်လာပါမည်
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {snapshots.slice(0, 8).map((snap) => (
              <div
                key={snap.id}
                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{snap.reason}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                      {snap.date} {snap.time}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                    <span>ပစ္စည်း: {snap.recordCounts.products}</span>
                    <span>•</span>
                    <span>ပေးသွင်းသူ: {snap.recordCounts.suppliers}</span>
                    <span>•</span>
                    <span>ကုန်သည်: {snap.recordCounts.merchants}</span>
                    <span>•</span>
                    <span>ကုန်သိမ်း: {snap.recordCounts.transactions}</span>
                    <span>•</span>
                    <span>အရောင်း: {snap.recordCounts.sales}</span>
                  </div>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `"${snap.date} ${snap.time}" မှတ်တမ်းသို့ ဒေတာအားလုံး ပြန်လည်ပြောင်းလဲယူလိုပါသလား?`
                        )
                      ) {
                        onRestoreSnapshot?.(snap);
                      }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-blue-600 hover:text-white text-blue-700 font-bold border border-blue-300 rounded-lg cursor-pointer transition-colors shrink-0 flex items-center gap-1 shadow-2xs self-end sm:self-auto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ပြန်ယူမည်</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Backup Reminder Settings Card */}
      <div className="bg-white rounded-xl p-4 border border-emerald-300 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  နေ့စဥ် ပုံမှန် Data Backup သတိပေးချက်
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    backupReminderSettings?.enabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {backupReminderSettings?.enabled ? 'ဖွင့်ထားသည် (Active)' : 'ပိတ်ထားသည် (Off)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                သတ်မှတ်ချိန်ရောက်တိုင်း ဖုန်းတွင် အလိုအလျောက် သတိပေးပြီး Pop-up Box ဖြင့် Backup ယူစေမည်
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner ? (
              <button
                type="button"
                onClick={onOpenBackupReminderModal}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <BellRing className="w-4 h-4 text-emerald-600" />
                <span>သတိပေးချက် စမ်းသပ်မည် (Test Alert)</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>ဆိုင်ရှင်သာ ပြင်ဆင်နိုင်ပါသည်</span>
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/50 p-3 rounded-lg text-xs">
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-2 font-bold text-slate-800 ${!isOwner ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={backupReminderSettings?.enabled ?? true}
                onChange={(e) =>
                  onUpdateBackupReminderSettings?.({
                    ...(backupReminderSettings || {
                      enabled: true,
                      reminderTime: '17:30',
                    }),
                    enabled: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>နေ့စဥ် Backup သတိပေးချက် ဖွင့်မည်</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>သတိပေးချိန်:</span>
            </span>
            <input
              type="time"
              disabled={!isOwner}
              value={backupReminderSettings?.reminderTime || '17:30'}
              onChange={(e) =>
                onUpdateBackupReminderSettings?.({
                  ...(backupReminderSettings || {
                    enabled: true,
                    reminderTime: '17:30',
                  }),
                  reminderTime: e.target.value,
                  lastDismissedDate: '',
                })
              }
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-500">(ညနေပိုင်း အကြံပြု)</span>
          </div>
        </div>
      </div>

      {/* Deleted Records History (Recycle Bin) Card */}
      <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  ဖျက်လိုက်သော မှတ်တမ်းဟောင်းများ (Deleted Records History & Recycle Bin)
                </h3>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {deletedRecordsCount} ခု
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                မှားဖျက်မိပါက အချိန်မရွေး ပြန်လည်ရယူနိုင်ပြီး ဖျက်ခဲ့သမျှ မှတ်တမ်းအားလုံးကို Excel ဖြင့် ထုတ်ယူနိုင်ပါသည်
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenDeletedHistory}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
          >
            <History className="w-4 h-4" />
            <span>အမှိုက်ပုံးကြည့်မည် ({deletedRecordsCount})</span>
          </button>
        </div>
      </div>

      {/* Offline Ready Status Banner */}
      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-emerald-950">
            အင်တာနက်မလိုဘဲ ရာနှုန်းပြည့် အသုံးပြုနိုင်ပါသည် (Offline Ready)
          </h3>
          <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
            ဒေတာအားလုံးသည် သင့်စက်ပစ္စည်း (Device Storage) ပေါ်တွင်သာ လုံခြုံစွာ တည်ရှိနေပြီး အင်တာနက်လိုင်းမရှိဘဲ စာရင်းအကုန် ရေးသွင်း၊ ပြင်ဆင်၊ ပုံနှိပ်နိုင်ပါသည်။
          </p>
        </div>
      </div>

      {/* Data Backup & Restore Cards */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>ဒေတာ အရန်သိမ်းခြင်းနှင့် ပြန်လည်သွင်းယူခြင်း (Backup & Restore)</span>
          </h3>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            ဖိုင်တွဲညွှန်းဆိုမှု: Shwe let yar doc.
          </span>
        </div>

        {downloadSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccessMsg}</span>
          </div>
        )}

        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
          <FolderOpen className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block text-amber-950">
              ဖုန်းအတွင်း သိမ်းဆည်းရန် လမ်းညွှန်ချက် (Shwe let yar doc. Folder):
            </span>
            <p className="text-slate-700 leading-relaxed">
              ဖုန်း၏ File Manager (သို့မဟုတ်) Files App ရှိ <strong>Download</strong> ဖိုင်တွဲအတွင်း{' '}
              <strong className="text-amber-900 font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">
                Shwe let yar doc.
              </strong>{' '}
              ဟူသော folder တစ်ခု ဆောက်ထားပြီး အဆိုပါ folder ထဲသို့ Backup ဖိုင်များ သိမ်းဆည်းနိုင်ပါသည်။
              ဖိုင်အမည်များကို <strong>Shwe_let_yar_doc_backup_[ရက်စွဲ].json</strong> ဖြင့် အလိုအလျောက် သတ်မှတ်ပေးထားပါသည်။
            </p>
          </div>
        </div>

        {!isOwner ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-slate-500 shrink-0" />
            <div>
              <span className="font-bold block text-slate-900">ဒေတာ အရန်သိမ်းခြင်းနှင့် ပြန်လည်သွင်းယူခြင်း (Backup & Restore)</span>
              <span>ဒေတာ အရန်သိမ်းခြင်းနှင့် ပြန်လည်သွင်းယူခြင်းကို ဆိုင်ရှင် (OWNER) သာ ဆောင်ရွက်ခွင့်ရှိပါသည်</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border-2 border-emerald-300 bg-emerald-50/40 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">အပြည့်အစုံ Backup ထုတ်ယူမည် (v3.0 Verified)</span>
                  <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-semibold">အကြံပြုချက်</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  လက်ရှိ စာရင်းသွင်းထားသော ကုန်ပစ္စည်းပေးသွင်းသူ {suppliers.length} ဦး၊ ကုန်သည် {merchants.length} ဦး၊ ကုန်ပစ္စည်း {products.length} မျိုး၊ ဘောင်ချာ {transactions.length + sales.length} စောင် အားလုံးကို SHA-256 Checksum ပါဝင်သော JSON ဖိုင်အဖြစ် ဒေါင်းလုဒ်သိမ်းဆည်းမည်
                </p>
              </div>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  id="direct-download-backup-btn"
                  disabled={isBackingUp}
                  onClick={() => handleShweLetYarDocBackup(false)}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{isBackingUp ? 'Backup ဖိုင် ထုတ်ယူနေပါသည်...' : 'Shwe let yar doc. ထဲ ဒေါင်းလုဒ်သိမ်းမည်'}</span>
                </button>
                <button
                  type="button"
                  id="download-backup-btn"
                  disabled={isBackingUp}
                  onClick={() => handleShweLetYarDocBackup(true)}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-100 disabled:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-slate-600" />
                  <span>နေရာရွေးပြီး Backup သိမ်းမည် (Folder Picker)</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 block">ဒေတာများ ပြန်သွင်းမည် (Safe Restore)</span>
                  <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold">Integrity Verified</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ယခင်သိမ်းဆည်းထားသော .json Backup ဖိုင်ကို ရွေးချယ်ပြီး ဖိုင်စစ်ဆေးမှု၊ နှိုင်းယှဉ်ချက်များနှင့် Smart Merge / Clean Overwrite အဆင့်ဆင့် ပြုလုပ်ပါမည်
                </p>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  className="hidden"
                />
                <button
                  type="button"
                  id="restore-backup-btn"
                  disabled={isValidating}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-white hover:bg-slate-100 disabled:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>{isValidating ? 'ဖိုင်စစ်ဆေးနေပါသည်...' : 'Backup ဖိုင် ရွေးမည် (Preview & Validate)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auto-Recovery Safety Snapshots Management Card */}
      <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                  အလိုအလျောက် Safety Snapshots နှင့် Rollback စနစ်
                </h3>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {snapshots.length} ခု သိမ်းဆည်းပြီး
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Restore, Clear Data သို့မဟုတ် အရေးကြီးသော ပြောင်းလဲမှုများ မပြုလုပ်မီ စနစ်က လက်ရှိဒေတာကို Auto Snapshot အဖြစ် ကာကွယ်သိမ်းဆည်းပေးထားပါသည်
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <button
                type="button"
                id="open-snapshots-modal-btn"
                onClick={() => setIsSnapshotsModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
              >
                <History className="w-4 h-4" />
                <span>Safety Snapshots ကြည့်မည် / ပြန်ယူမည် ({snapshots.length})</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>ဆိုင်ရှင်သာ စီမံခွင့်ရှိပါသည်</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick Emergency Snapshot Bar */}
        {isOwner && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              placeholder="Snapshot အကြောင်းပြချက် (ဥပမာ - လကုန်စာရင်းမရှင်းမီ မှတ်တမ်း)"
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              className="w-full sm:flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              disabled={isCreatingSnapshot}
              onClick={async () => {
                setIsCreatingSnapshot(true);
                try {
                  const reason = emergencyReason.trim() || 'Manual Safety Snapshot';
                  await createAutoRecoverySnapshot(reason);
                  if (onTakeSnapshotNow) {
                    onTakeSnapshotNow(reason);
                  }
                  setEmergencyReason('');
                  alert(`Safety Snapshot "${reason}" ကို IndexedDB ထဲသို့ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ`);
                } catch (e: any) {
                  alert(`Snapshot သိမ်းဆည်းရာတွင် အမှားဖြစ်ပွားပါသည်: ${e?.message || e}`);
                } finally {
                  setIsCreatingSnapshot(false);
                }
              }}
              className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>{isCreatingSnapshot ? 'သိမ်းဆည်းနေပါသည်...' : 'Snapshot ချက်ချင်း ရယူမည်'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Individual Excel Exports */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Excel / CSV ဖိုင်များ ခွဲခြားထုတ်ယူရန်</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => exportSuppliersCSV(suppliers)}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>ကုန်ပစ္စည်းပေးသွင်းသူစာရင်း</span>
            </div>
            <span className="text-[11px] text-slate-500 block">Suppliers ({suppliers.length} ဦး)</span>
          </button>

          <button
            type="button"
            onClick={() => exportMerchantsCSV(merchants)}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>ကုန်သည်အရောင်းစာရင်း</span>
            </div>
            <span className="text-[11px] text-slate-500 block">Merchants ({merchants.length} ဦး)</span>
          </button>

          <button
            type="button"
            onClick={() => exportInventoryCSV(inventoryStock)}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
              <Package className="w-4 h-4 text-amber-600" />
              <span>ကုန်ပစ္စည်းလက်ကျန်</span>
            </div>
            <span className="text-[11px] text-slate-500 block">Inventory ({inventoryStock.length} မျိုး)</span>
          </button>

          <button
            type="button"
            onClick={() => exportSalesHistoryCSV(sales)}
            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
              <Download className="w-4 h-4 text-purple-600" />
              <span>အရောင်းဘောင်ချာများ</span>
            </div>
            <span className="text-[11px] text-slate-500 block">Sales ({sales.length} စောင်)</span>
          </button>
        </div>
      </div>

      {/* ================= RAW MASTER (RAW MATERIAL PRESETS) MANAGEMENT ================= */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div
            className="cursor-pointer select-none flex items-center gap-2"
            onClick={toggleRawMaster}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <Layers className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                  ကုန်ကြမ်းစီမံခြင်း (Raw Master)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {rawMaterialPresets.length} မျိုး
                </span>
                <span className="text-slate-400 hover:text-slate-600 p-0.5">
                  {isRawMasterExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRawMasterExpanded
                  ? 'ဝါး၊ ကြိမ်နှင့် ကုန်ကြမ်းကြိုထုတ် အမျိုးအစားများ စိတ်ကြိုက်စီမံနိုင်ပါသည်'
                  : 'စာရင်းဝှက်ထားပါသည် (ဖွင့်ကြည့်ရန် နှိပ်ပါ)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleRawMaster}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              {isRawMasterExpanded ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>ဝှက်မည်</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>ဖော်မည်</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleResetPresetsToDefault}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer transition-colors"
            >
              မူလအတိုင်း ပြန်ထားမည်
            </button>
            <button
              type="button"
              onClick={() => setIsAddPresetOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ကုန်ကြမ်းအသစ် ထည့်မည်</span>
            </button>
          </div>
        </div>

        {isRawMasterExpanded && (
          <>
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'အားလုံး', count: rawMaterialPresets.length },
                { id: 'BAMBOO', label: 'ဝါးကုန်ကြမ်း', count: rawMaterialPresets.filter((p) => p.category === 'BAMBOO').length },
                { id: 'RATTAN', label: 'ကြိမ်ကုန်ကြမ်း', count: rawMaterialPresets.filter((p) => p.category === 'RATTAN').length },
                { id: 'CASH_ADVANCE', label: 'ငွေကြိုယူ', count: rawMaterialPresets.filter((p) => p.category === 'CASH_ADVANCE').length },
                { id: 'OTHER', label: 'အခြားကုန်ကြမ်း', count: rawMaterialPresets.filter((p) => p.category === 'OTHER').length },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setPresetCategoryFilter(cat.id)}
                  className={`px-3 py-1 text-xs rounded-full font-bold cursor-pointer transition-colors shrink-0 ${
                    presetCategoryFilter === cat.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Presets List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {rawMaterialPresets
                .filter((p) => presetCategoryFilter === 'all' || p.category === presetCategoryFilter)
                .map((preset) => {
                  const badgeColor =
                    preset.category === 'BAMBOO'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : preset.category === 'RATTAN'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : preset.category === 'CASH_ADVANCE'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200';

                  return (
                    <div
                      key={preset.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 flex items-center justify-between gap-2 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                            {preset.categoryLabel || preset.category}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 truncate">{preset.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          ယူနစ်: <span className="font-semibold text-slate-700">{preset.defaultUnit}</span>
                          {preset.category !== 'CASH_ADVANCE' && (
                            <>
                              {' '}• ပေါက်ဈေး:{' '}
                              <span className="font-bold text-slate-900">
                                {formatNumberOnly(preset.defaultUnitPrice)} ကျပ်
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.id, preset.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="ဖျက်မည်"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {/* ================= DATA MANAGEMENT & SETUP OPTIONS ================= */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h3 className="font-bold text-xs sm:text-base text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4.5 h-4.5 text-slate-700" />
            <span>ဒေတာ စီမံခန့်ခွဲမှုနှင့် စနစ်စတင်ခြင်း (Data Management & Setup Options)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            လုပ်ဆောင်ချက် (၃) ခု၏ မတူညီသော ရည်ရွယ်ချက်များကို ရှင်းလင်းစွာ ခွဲခြားထားပြီး စိတ်ချလက်ချ အသုံးပြုနိုင်ပါသည်
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Load Demo Data */}
          <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  စမ်းသပ်လေ့လာရန် (For Practice)
                </span>
                <BookOpen className="w-4 h-4 text-emerald-600" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900">
                ၁။ နမူနာဒေတာ သွင်းမည် (Load Demo Data)
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                စနစ်ကို အစမ်းသုံးကြည့်နိုင်ရန် ကုန်သိမ်း၊ အရောင်း၊ ဝါး/ကြိမ်ကုန်ကြမ်း၊ ငွေကြိုယူ၊ အော်ဒါ၊ ကုန်ဖလှယ်မှု၊ အနိမ့်ဆုံးသတိပေးချက် စုံလင်သော နမူနာဒေတာများကို များလည်းမများ နည်းလည်းမနည်း သင့်တင့်မျှတစွာ ထည့်သွင်းပေးပါမည်။
              </p>
            </div>

            <div className="space-y-2 pt-1 border-t border-emerald-100">
              {!isOwner ? (
                <div className="p-3 bg-white/80 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>ဆိုင်ရှင်သာ ပြောင်းလဲနိုင်ပါသည်</span>
                </div>
              ) : shopSettings?.isLiveConfirmed || shopSettings?.hideSampleDataButtons ? (
                <div className="p-3 bg-white/90 border border-emerald-300 rounded-xl space-y-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>လက်တွေ့ဆိုင်သုံးရန် အတည်ပြုထားပါသည်</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    အချက်အလက်များ မရောထွေးစေရန် နမူနာဒေတာ ခလုတ်များကို အလိုအလျောက် ပိတ်ထားပါသည်
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSaveSettings) {
                        onSaveSettings({
                          ...shopSettings,
                          hideSampleDataButtons: false,
                          isLiveConfirmed: false,
                        });
                      }
                    }}
                    className="text-[10px] text-slate-500 hover:text-emerald-700 underline cursor-pointer"
                  >
                    နမူနာဒေတာ ပြန်ဖွင့်လိုပါက နှိပ်ပါ
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    id="settings-load-demo-data-btn"
                    onClick={onLoadDemoData || handleResetDefaults}
                    className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-600 active:scale-98 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>နမူနာဒေတာ ထည့်မည်</span>
                  </button>
                  <button
                    type="button"
                    id="seed-100-suppliers-btn"
                    onClick={handleLoad100Suppliers}
                    className="w-full py-1.5 px-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Users className="w-3 h-3 text-emerald-600" />
                    <span>ပေးသွင်းသူ ၁၀၀ ဦး စမ်းသပ်ထည့်မည်</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Start Real Business (Zero Settings) */}
          <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/50 flex flex-col justify-between space-y-3 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-400">
                  လက်တွေ့ဆိုင်သုံးရန် (Real Business)
                </span>
                <Sparkles className="w-4 h-4 text-amber-600 fill-amber-500" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-950">
                ၂။ ဆိုင်စာရင်း အသစ်စတင်မည် (Zero Settings)
              </h4>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                ဆိုင်အမည်၊ ပိုင်ရှင်အမည်၊ ကုန်ပစ္စည်းအမည်များနှင့် မိတ်ဆွေစာရင်းများကို မဖျက်ဘဲ ဆက်လက်ထိန်းသိမ်းထားပြီး ယခင်စမ်းသပ်ထားသော အရောင်း/အဝယ်စာရင်း၊ လက်ကျန်ပစ္စည်း၊ အကြိုငွေနှင့် အကြွေးစာရင်း အားလုံးကို ၀ (သုည) သတ်မှတ်ကာ လက်တွေ့စတင်ရန် ဖြစ်ပါသည်။
              </p>
            </div>

            <div className="pt-1 border-t border-amber-200">
              {!isOwner ? (
                <div className="p-2.5 bg-amber-100/60 border border-amber-300 rounded-xl text-center text-xs text-amber-900 font-bold flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>ဆိုင်ရှင်သာ စတင်အသုံးပြုခွင့်ရှိပါသည်</span>
                </div>
              ) : isLive ? (
                <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-center text-xs text-emerald-900 font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ဆိုင်စာရင်းသစ် စတင်ပြီးပါပြီ (Live Mode အသုံးပြုနေသည်)</span>
                </div>
              ) : (
                <button
                  type="button"
                  id="settings-zero-data-btn"
                  onClick={onOpenZeroSettings || handleClearAll}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-all shadow-xs border border-amber-400 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>ဆိုင်စာရင်းသစ် စတင်မည် (၀ သတ်မှတ်)</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Factory Reset / Clear All */}
          <div className="p-4 rounded-xl border-2 border-rose-200 bg-rose-50/40 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  အပြီးတိုင်ဖျက်ရန် (Danger Zone)
                </span>
                <Trash2 className="w-4 h-4 text-rose-600" />
              </div>
              <h4 className="font-extrabold text-sm text-rose-950">
                ၃။ ဒေတာအားလုံး ရှင်းထုတ်မည် (Factory Reset)
              </h4>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                ဖုန်းတွင်းရှိ စာရင်းမှတ်တမ်းများ၊ ကုန်ပစ္စည်းစာရင်း၊ ကုန်ပစ္စည်းပေးသွင်းသူ/ကုန်သည်များ၊ ဆက်တင်များနှင့် စကားဝှက်များကို အပြီးတိုင် ရှင်းထုတ်ပြီး မူလစတင်စက်ဆင်ခါစကဲ့သို့ အကုန်ရှင်းထုတ်ပါမည်။ (မဖျက်မီ Auto Snapshot အရန်သိမ်းပေးပါသည်)။
              </p>
            </div>

            <div className="pt-1 border-t border-rose-100">
              {!isOwner ? (
                <div className="p-2.5 bg-rose-100/60 border border-rose-200 rounded-xl text-center text-xs text-rose-900 font-bold flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>ဆိုင်ရှင် (OWNER) သာ ရှင်းထုတ်ခွင့်ရှိပါသည်</span>
                </div>
              ) : (
                <button
                  type="button"
                  id="settings-clear-all-data-btn"
                  onClick={handleClearAll}
                  className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>ဒေတာအားလုံး အပြီးရှင်းထုတ်မည်</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Guidance Tip Banner */}
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
          <span className="text-base leading-none">💡</span>
          <div className="leading-relaxed text-[11px]">
            <strong className="font-bold">အကြံပြုချက် - </strong>
            ဆိုင်တွင် လက်တွေ့နေ့စဉ်စာရင်း စတင်ရေးသွင်းတော့မည်ဆိုပါက အမှတ် (၂){' '}
            <span className="font-bold text-amber-800">"ဆိုင်စာရင်း အသစ်စတင်မည် (Zero Settings)"</span> ကို အသုံးပြုပါ။ အကယ်၍ အက်ပ်စနစ်ကို အစမ်းလေ့လာလိုပါက အမှတ် (၁){' '}
            <span className="font-bold text-emerald-800">"နမူနာဒေတာ သွင်းမည်"</span> ကို အသုံးပြုပါ။
          </div>
        </div>
      </div>

      {/* ================= MODAL: ADD SUPPLIER ================= */}
      {isAddSupOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">ကုန်ပစ္စည်းပေးသွင်းသူ အသစ်ထည့်သွင်းခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSupOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierFromSettings} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်ပစ္စည်းပေးသွင်းသူ အမည် *</label>
                <input
                  type="text"
                  required
                  placeholder="ဥပမာ - ဒေါ်လှခင်"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ကျေးရွာ</label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - မင်းနန်သူ"
                    value={supVillage}
                    onChange={(e) => setSupVillage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ဖုန်းနံပါတ်</label>
                  <input
                    type="text"
                    placeholder="09-xxxxxxxxx"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ကုန်ချော အချောရက်"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSupOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  ကုန်ပစ္စည်းပေးသွင်းသူ စာရင်းသွင်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD MERCHANT ================= */}
      {isAddMerchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">ကုန်သည် အသစ်ထည့်သွင်းခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMerchOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMerchantFromSettings} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်သည် / ဆိုင်အမည် *</label>
                <input
                  type="text"
                  required
                  placeholder="ဥပမာ - ရွှေမန္တလေး ယွန်းဆိုင်"
                  value={merchName}
                  onChange={(e) => setMerchName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">မြို့နယ်</label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - မန္တလေး"
                    value={merchTown}
                    onChange={(e) => setMerchTown(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ဖုန်းနံပါတ်</label>
                  <input
                    type="text"
                    placeholder="09-xxxxxxxxx"
                    value={merchPhone}
                    onChange={(e) => setMerchPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ဆိုင်လိပ်စာ</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ၂၆ လမ်း၊ ၇၃ လမ်းထောင့်"
                  value={merchAddress}
                  onChange={(e) => setMerchAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="မှတ်ချက်ရေးရန်..."
                  value={merchNotes}
                  onChange={(e) => setMerchNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMerchOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  ကုန်သည် စာရင်းသွင်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CANONICAL MODAL: ADD / EDIT PRODUCT ================= */}
      <ProductMasterModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        productToEdit={editingProduct}
        onSave={(savedProd) => {
          if (editingProduct && onUpdateProduct) {
            onUpdateProduct(savedProd);
          } else if (onAddProduct) {
            onAddProduct(savedProd);
          }
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        availableCategories={Array.from(new Set(['ကုန်ချော', 'ပန်းပု', 'သစ်သား', 'ကြေးထည်', 'အခြား', ...products.map((p) => p.category).filter(Boolean)]))}
      />

      {/* ================= MODAL: ADD RAW MATERIAL PRESET ================= */}
      {isAddPresetOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">ကုန်ကြမ်းကြိုထုတ် အမျိုးအစားအသစ် ထည့်သွင်းခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPresetOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">အမျိုးအစား ရွေးချယ်ပါ *</label>
                <select
                  value={presetCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPresetCategory(val);
                    if (val === 'BAMBOO') {
                      setPresetUnit('လုံး');
                      setPresetPrice(3500);
                    } else if (val === 'RATTAN') {
                      setPresetUnit('စည်း');
                      setPresetPrice(12000);
                    } else if (val === 'CASH_ADVANCE') {
                      setPresetUnit('ကျပ်');
                      setPresetPrice(1);
                      if (!presetName) setPresetName('ငွေကြိုထုတ်');
                    } else {
                      setPresetUnit('ခု');
                      setPresetPrice(5000);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 font-bold text-slate-800"
                >
                  <option value="BAMBOO">ဝါးကုန်ကြမ်း (BAMBOO)</option>
                  <option value="RATTAN">ကြိမ်ကုန်ကြမ်း (RATTAN)</option>
                  <option value="CASH_ADVANCE">ငွေကြိုယူ (CASH_ADVANCE)</option>
                  <option value="OTHER">အခြားကုန်ကြမ်း (OTHER)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ပစ္စည်းအမည် *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    presetCategory === 'BAMBOO'
                      ? 'ဥပမာ - ဝါးပိုးဝါး (အလုံး)'
                      : presetCategory === 'RATTAN'
                      ? 'ဥပမာ - ကြိမ်လုံးကြီး'
                      : presetCategory === 'CASH_ADVANCE'
                      ? 'ဥပမာ - ငွေကြိုယူ'
                      : 'ဥပမာ - ကော်ရည် / သံမှို'
                  }
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">မူလယူနစ်</label>
                  <input
                    type="text"
                    required
                    placeholder="လုံး / စည်း / ခု"
                    value={presetUnit}
                    onChange={(e) => setPresetUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {presetCategory === 'CASH_ADVANCE' ? 'ပေါက်ဈေး (၁ ကျပ်)' : 'မူလပေါက်ဈေး (ကျပ်)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    disabled={presetCategory === 'CASH_ADVANCE'}
                    value={presetPrice}
                    onChange={(e) => setPresetPrice(Number(e.target.value))}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 font-mono font-bold ${
                      presetCategory === 'CASH_ADVANCE' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ဤကုန်ကြမ်းအမည်သည် ကုန်ပစ္စည်းပေးသွင်းသူများထံ ကုန်ကြမ်းကြိုထုတ်ပေးသည့် modal drop-down စာရင်းတွင် ချက်ချင်းပေါ်လာမည်ဖြစ်ပါသည်။
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPresetOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  ကုန်ကြမ်း ထည့်သွင်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Backup Import & Deep Validation Preview Modal */}
      <BackupImportPreviewModal
        isOpen={isImportPreviewOpen}
        onClose={() => {
          setIsImportPreviewOpen(false);
          setValidationReport(null);
        }}
        report={validationReport}
        fileName={importFileName}
        onRestoreSuccess={async (result) => {
          // Re-hydrate state from database
          const refreshedProducts = await productRepo.getAll();
          const refreshedSuppliers = await supplierRepo.getAll();
          const refreshedMerchants = await merchantRepo.getAll();
          const refreshedTransactions = await transactionRepo.getAll();
          const refreshedSales = await saleRepo.getAll();
          const refreshedAdjustments = await stockAdjustmentRepo.getAll();
          const refreshedShopSettings = loadShopSettings();

          onRestoreData(
            refreshedProducts,
            refreshedSuppliers,
            refreshedTransactions,
            refreshedMerchants,
            refreshedSales,
            refreshedAdjustments,
            refreshedShopSettings
          );

          alert(`ဒေတာများ အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ!\n\n${result.message}`);
        }}
      />

      {/* Auto-Recovery Snapshots History & Rollback Modal */}
      <AutoRecoverySnapshotsModal
        isOpen={isSnapshotsModalOpen}
        onClose={() => setIsSnapshotsModalOpen(false)}
        onRestoreSuccess={async (msg) => {
          const refreshedProducts = await productRepo.getAll();
          const refreshedSuppliers = await supplierRepo.getAll();
          const refreshedMerchants = await merchantRepo.getAll();
          const refreshedTransactions = await transactionRepo.getAll();
          const refreshedSales = await saleRepo.getAll();
          const refreshedAdjustments = await stockAdjustmentRepo.getAll();
          const refreshedShopSettings = loadShopSettings();

          onRestoreData(
            refreshedProducts,
            refreshedSuppliers,
            refreshedTransactions,
            refreshedMerchants,
            refreshedSales,
            refreshedAdjustments,
            refreshedShopSettings
          );

          alert(msg);
        }}
      />

      {/* Professional Database Health & Diagnostics Modal (Phase 12) */}
      <DatabaseHealthModal
        isOpen={isDatabaseHealthOpen}
        onClose={() => setIsDatabaseHealthOpen(false)}
      />
    </div>
  );
};
