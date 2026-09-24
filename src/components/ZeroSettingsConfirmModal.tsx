import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  KeyRound,
  Users,
  UserCheck,
  Package,
  DollarSign,
  Layers,
  FileSpreadsheet,
  Store,
  Coins,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Download,
  Upload,
  ArrowRight,
  Info,
  Check,
} from 'lucide-react';
import { Product, Supplier, Merchant, AppLockSettings, ShopSettings, OpeningPosition } from '../types';
import { generateStableId } from '../utils/idGenerator';
import {
  verifyOwnerPin,
  derivePinCredentials,
  generateSecureRecoveryKey,
  deriveRecoveryCredentials,
} from '../services/cryptoSecurity';

export interface ZeroSettingsConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmZeroReset: (options: {
    pin?: string;
    doubleConfirmed: boolean;
    shopName?: string;
    ownerName?: string;
    phone?: string;
    address?: string;
    tagline?: string;
    accountingStartDate?: string;
    customProducts?: Product[];
    customSuppliers?: Supplier[];
    customMerchants?: Merchant[];
    openingPosition?: OpeningPosition;
  }) => Promise<void> | void;
  onLoadDemoData?: () => void;
  appLockSettings?: AppLockSettings | null;
  onUpdateAppLockSettings?: (settings: AppLockSettings) => void;
  currentProducts?: Product[];
  currentSuppliers?: Supplier[];
  currentMerchants?: Merchant[];
  shopSettings?: ShopSettings;
}

export const ZeroSettingsConfirmModal: React.FC<ZeroSettingsConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmZeroReset,
  onLoadDemoData,
  appLockSettings,
  onUpdateAppLockSettings,
  currentProducts = [],
  currentSuppliers = [],
  currentMerchants = [],
  shopSettings,
}) => {
  // Wizard Step: 1 through 10
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Zero Settings baseline acknowledgement
  const [zeroConfirmed, setZeroConfirmed] = useState<boolean>(true);

  // Step 2: Merchants
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantName, setMerchantName] = useState<string>('');
  const [merchantPhone, setMerchantPhone] = useState<string>('');
  const [merchantTown, setMerchantTown] = useState<string>('');
  const [merchantNotes, setMerchantNotes] = useState<string>('');

  // Step 3: Suppliers / Weavers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [supplierVillage, setSupplierVillage] = useState<string>('');
  const [supplierCraft, setSupplierCraft] = useState<string>('ရက်လုပ်သူ');

  // Step 4: Products & Opening Stock
  const [products, setProducts] = useState<Product[]>([]);
  const [productName, setProductName] = useState<string>('');
  const [productCategory, setProductCategory] = useState<string>('ကုန်ချော');
  const [productUnit, setProductUnit] = useState<string>('ထည်');
  const [productStock, setProductStock] = useState<string>('0');
  const [productSalePrice, setProductSalePrice] = useState<string>('');
  const [productBuyPrice, setProductBuyPrice] = useState<string>('');

  // Step 5: Advances (Prepayments)
  const [advances, setAdvances] = useState<
    Array<{ id: string; counterpartName: string; counterpartId?: string; amount: number; notes: string }>
  >([]);
  const [advSupplierName, setAdvSupplierName] = useState<string>('');
  const [advAmount, setAdvAmount] = useState<string>('');
  const [advNotes, setAdvNotes] = useState<string>('');

  // Step 6: Raw Materials
  const [rawMaterials, setRawMaterials] = useState<
    Array<{ id: string; materialName: string; unit: string; quantity: number; unitPrice: number; totalValue: number; notes: string }>
  >([]);
  const [rawName, setRawName] = useState<string>('');
  const [rawUnit, setRawUnit] = useState<string>('လုံး');
  const [rawQty, setRawQty] = useState<string>('');
  const [rawTotalValue, setRawTotalValue] = useState<string>('');
  const [rawNotes, setRawNotes] = useState<string>('');

  // Step 7: Excel Import State
  const [excelTarget, setExcelTarget] = useState<'PRODUCTS' | 'SUPPLIERS' | 'MERCHANTS'>('PRODUCTS');
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string>('');
  const [excelErrorMsg, setExcelErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 8: Shop Profile
  const [shopName, setShopName] = useState<string>(shopSettings?.shopName || 'ရွှေလက်ရာ');
  const [ownerName, setOwnerName] = useState<string>(shopSettings?.ownerName || '');
  const [shopPhone, setShopPhone] = useState<string>(shopSettings?.phone || '');
  const [shopAddress, setShopAddress] = useState<string>(shopSettings?.address || '');
  const [shopTagline, setShopTagline] = useState<string>(shopSettings?.tagline || 'မြန်မာ့ရိုးရာလက်မှု ကုန်ချောများ');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Step 9: Receivables, Payables, Cash
  const [receivables, setReceivables] = useState<
    Array<{ id: string; merchantName: string; merchantId?: string; amount: number; notes: string }>
  >([]);
  const [recMerchantName, setRecMerchantName] = useState<string>('');
  const [recAmount, setRecAmount] = useState<string>('');
  const [recNotes, setRecNotes] = useState<string>('');

  const [payables, setPayables] = useState<
    Array<{ id: string; counterpartName: string; supplierId?: string; amount: number; notes: string }>
  >([]);
  const [paySupplierName, setPaySupplierName] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const [openingCash, setOpeningCash] = useState<string>('0');

  // Step 10: PIN and Final Double Confirmation
  const [doubleConfirmed, setDoubleConfirmed] = useState<boolean>(false);
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [newSetupPin, setNewSetupPin] = useState<string>('');
  const [confirmSetupPin, setConfirmSetupPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step calculations unconditionally defined at top-level
  const totalAdvancesSum = useMemo(() => advances.reduce((s, a) => s + a.amount, 0), [advances]);
  const totalRawMaterialsValue = useMemo(() => rawMaterials.reduce((s, r) => s + r.totalValue, 0), [rawMaterials]);
  const totalReceivablesSum = useMemo(() => receivables.reduce((s, r) => s + r.amount, 0), [receivables]);
  const totalPayablesSum = useMemo(() => payables.reduce((s, p) => s + p.amount, 0), [payables]);
  const totalProductsStockCount = useMemo(() => products.reduce((s, p) => s + (p.openingStock || 0), 0), [products]);

  // Sync settings whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setErrorMsg('');
      setIsSubmitting(false);
      if (shopSettings) {
        setShopName(shopSettings.shopName || 'ရွှေလက်ရာ');
        setOwnerName(shopSettings.ownerName || '');
        setShopPhone(shopSettings.phone || '');
        setShopAddress(shopSettings.address || '');
        setShopTagline(shopSettings.tagline || 'မြန်မာ့ရိုးရာလက်မှု ကုန်ချောများ');
      }
    }
  }, [isOpen, shopSettings]);

  if (!isOpen) return null;

  const hasConfiguredPin = Boolean(
    appLockSettings?.pinHash || appLockSettings?.passcode || appLockSettings?.pin
  );

  // Step names in Myanmar
  const stepTitles = [
    { num: 1, title: 'ဇီးရိုးဆက်တင်', icon: Sparkles },
    { num: 2, title: 'ကုန်သည်စာရင်း', icon: Users },
    { num: 3, title: 'ရက်လုပ်သူ/ကုန်သွင်းသူ', icon: UserCheck },
    { num: 4, title: 'ကုန်လက်ကျန်', icon: Package },
    { num: 5, title: 'အကြိုငွေ', icon: DollarSign },
    { num: 6, title: 'ကုန်ကြမ်းလက်ကျန်', icon: Layers },
    { num: 7, title: 'Excel ထည့်သွင်းခြင်း', icon: FileSpreadsheet },
    { num: 8, title: 'ဆိုင်အချက်အလက်', icon: Store },
    { num: 9, title: 'ရရန်/ပေးရန်/ငွေသား', icon: Coins },
    { num: 10, title: 'စကားဝှက် & Go-Live', icon: Lock },
  ];

  // ==================== Step Actions ====================

  // Add Merchant
  const handleAddMerchant = () => {
    if (!merchantName.trim()) {
      setErrorMsg('ကုန်သည်အမည် ရိုက်ထည့်ပေးပါ');
      return;
    }
    setErrorMsg('');
    const newMerchant: Merchant = {
      id: generateStableId('m_user'),
      code: `M-${merchants.length + 1}`,
      name: merchantName.trim(),
      phone: merchantPhone.trim(),
      town: merchantTown.trim(),
      shopName: merchantTown.trim(),
      notes: merchantNotes.trim(),
      currentReceivableBalance: 0,
      payableBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isUserCreated: true,
    } as any;
    setMerchants((prev) => [...prev, newMerchant]);
    setMerchantName('');
    setMerchantPhone('');
    setMerchantTown('');
    setMerchantNotes('');
  };

  const handleDeleteMerchant = (id: string) => {
    setMerchants((prev) => prev.filter((m) => m.id !== id));
  };

  // Add Supplier / Weaver
  const handleAddSupplier = () => {
    if (!supplierName.trim()) {
      setErrorMsg('ရက်လုပ်သူ/ကုန်သွင်းသူ အမည် ရိုက်ထည့်ပေးပါ');
      return;
    }
    setErrorMsg('');
    const newSupplier: Supplier = {
      id: generateStableId('s_user'),
      code: `S-${suppliers.length + 1}`,
      name: supplierName.trim(),
      phone: supplierPhone.trim(),
      village: supplierVillage.trim(),
      craftType: supplierCraft.trim(),
      initialAdvance: 0,
      currentAdvanceBalance: 0,
      payableBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isUserCreated: true,
    } as any;
    setSuppliers((prev) => [...prev, newSupplier]);
    setSupplierName('');
    setSupplierPhone('');
    setSupplierVillage('');
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  // Add Product
  const handleAddProduct = () => {
    if (!productName.trim()) {
      setErrorMsg('ကုန်ပစ္စည်းအမည် ရိုက်ထည့်ပေးပါ');
      return;
    }
    setErrorMsg('');
    const stockQty = Number(productStock) || 0;
    const salePrice = Number(productSalePrice) || 0;
    const buyPrice = Number(productBuyPrice) || 0;

    const newProduct: Product = {
      id: generateStableId('p_user'),
      code: `P-${products.length + 1}`,
      name: productName.trim(),
      category: productCategory.trim() || 'ကုန်ချော',
      unit: productUnit.trim() || 'ထည်',
      openingStock: stockQty,
      currentStock: stockQty,
      defaultPrice: salePrice,
      defaultWholesalePrice: salePrice,
      costPrice: buyPrice,
      avgCostPrice: buyPrice,
      minStockAlert: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isUserCreated: true,
    };
    setProducts((prev) => [...prev, newProduct]);
    setProductName('');
    setProductStock('0');
    setProductSalePrice('');
    setProductBuyPrice('');
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Add Advance
  const handleAddAdvance = () => {
    const amt = Number(advAmount) || 0;
    if (!advSupplierName.trim()) {
      setErrorMsg('ရက်လုပ်သူ/ကုန်သွင်းသူ အမည် ရွေးပါ သို့မဟုတ် ရိုက်ထည့်ပါ');
      return;
    }
    if (amt <= 0) {
      setErrorMsg('အကြိုငွေ ပမာဏ ရိုက်ထည့်ပေးပါ');
      return;
    }
    setErrorMsg('');
    const matchedSupplier = suppliers.find((s) => s.name.toLowerCase() === advSupplierName.trim().toLowerCase());
    setAdvances((prev) => [
      ...prev,
      {
        id: generateStableId('adv'),
        counterpartName: advSupplierName.trim(),
        counterpartId: matchedSupplier?.id,
        amount: amt,
        notes: advNotes.trim(),
      },
    ]);
    setAdvSupplierName('');
    setAdvAmount('');
    setAdvNotes('');
  };

  const handleDeleteAdvance = (id: string) => {
    setAdvances((prev) => prev.filter((a) => a.id !== id));
  };

  // Add Raw Material
  const handleAddRawMaterial = () => {
    const qty = Number(rawQty) || 0;
    const totVal = Number(rawTotalValue) || 0;
    if (!rawName.trim()) {
      setErrorMsg('ကုန်ကြမ်းအမည် ရိုက်ထည့်ပေးပါ');
      return;
    }
    if (qty <= 0) {
      setErrorMsg('ကုန်ကြမ်း အရေအတွက် ရိုက်ထည့်ပေးပါ');
      return;
    }
    setErrorMsg('');
    setRawMaterials((prev) => [
      ...prev,
      {
        id: generateStableId('raw'),
        materialName: rawName.trim(),
        unit: rawUnit.trim() || 'လုံး',
        quantity: qty,
        unitPrice: qty > 0 ? Math.round(totVal / qty) : 0,
        totalValue: totVal,
        notes: rawNotes.trim(),
      },
    ]);
    setRawName('');
    setRawQty('');
    setRawTotalValue('');
    setRawNotes('');
  };

  const handleDeleteRawMaterial = (id: string) => {
    setRawMaterials((prev) => prev.filter((r) => r.id !== id));
  };

  // Add Receivable
  const handleAddReceivable = () => {
    const amt = Number(recAmount) || 0;
    if (!recMerchantName.trim()) {
      setErrorMsg('ဖောက်သည်/ကုန်သည် အမည် ရိုက်ထည့်ပါ');
      return;
    }
    if (amt <= 0) {
      setErrorMsg('ရရန်ငွေ ပမာဏ ရိုက်ထည့်ပေးပါ');
      return;
    }
    setErrorMsg('');
    const matchedMerchant = merchants.find((m) => m.name.toLowerCase() === recMerchantName.trim().toLowerCase());
    setReceivables((prev) => [
      ...prev,
      {
        id: generateStableId('rec'),
        merchantName: recMerchantName.trim(),
        merchantId: matchedMerchant?.id,
        amount: amt,
        notes: recNotes.trim(),
      },
    ]);
    setRecMerchantName('');
    setRecAmount('');
    setRecNotes('');
  };

  const handleDeleteReceivable = (id: string) => {
    setReceivables((prev) => prev.filter((r) => r.id !== id));
  };

  // Add Payable
  const handleAddPayable = () => {
    const amt = Number(payAmount) || 0;
    if (!paySupplierName.trim()) {
      setErrorMsg('ပေးရန်ရှိသူ အမည် ရိုက်ထည့်ပါ');
      return;
    }
    if (amt <= 0) {
      setErrorMsg('ပေးရန်ငွေ ပမာဏ ရိုက်ထည့်ပေးပါ');
      return;
    }
    setErrorMsg('');
    const matchedSupplier = suppliers.find((s) => s.name.toLowerCase() === paySupplierName.trim().toLowerCase());
    setPayables((prev) => [
      ...prev,
      {
        id: generateStableId('pay'),
        counterpartName: paySupplierName.trim(),
        supplierId: matchedSupplier?.id,
        amount: amt,
        notes: payNotes.trim(),
      },
    ]);
    setPaySupplierName('');
    setPayAmount('');
    setPayNotes('');
  };

  const handleDeletePayable = (id: string) => {
    setPayables((prev) => prev.filter((p) => p.id !== id));
  };

  // Step 7: Excel File Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelErrorMsg('');
    setExcelSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          setExcelErrorMsg('Excel ဖိုင်တွင် အချက်အလက်များ မတွေ့ရှိပါ');
          return;
        }

        let importedCount = 0;
        if (excelTarget === 'PRODUCTS') {
          const newProds: Product[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue;
            const pName = String(row[0]).trim();
            if (!pName) continue;
            const pCat = row[1] ? String(row[1]).trim() : 'ကုန်ချော';
            const pBuy = Number(row[2]) || 0;
            const pSale = Number(row[3]) || 0;
            const pStock = Number(row[4]) || 0;
            const pUnit = row[5] ? String(row[5]).trim() : 'ထည်';

            newProds.push({
              id: generateStableId('p_xl'),
              code: `P-XL-${products.length + newProds.length + 1}`,
              name: pName,
              category: pCat,
              unit: pUnit,
              openingStock: pStock,
              currentStock: pStock,
              defaultPrice: pSale,
              defaultWholesalePrice: pSale,
              costPrice: pBuy,
              avgCostPrice: pBuy,
              minStockAlert: 10,
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isUserCreated: true,
            });
            importedCount++;
          }
          if (newProds.length > 0) {
            setProducts((prev) => [...prev, ...newProds]);
            setExcelSuccessMsg(`ကုန်ပစ္စည်း (${newProds.length}) မျိုးကို Excel မှ အောင်မြင်စွာ ပေါင်းထည့်ပြီးပါပြီ။`);
          }
        } else if (excelTarget === 'SUPPLIERS') {
          const newSupps: Supplier[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[1]) continue;
            const sName = String(row[1]).trim();
            if (!sName) continue;
            const sPhone = row[2] ? String(row[2]).trim() : '';
            const sVillage = row[3] ? String(row[3]).trim() : '';
            const sCraft = row[4] ? String(row[4]).trim() : 'ရက်လုပ်သူ';
            const sAdvance = Number(row[5]) || 0;

            newSupps.push({
              id: generateStableId('s_xl'),
              code: `S-XL-${suppliers.length + newSupps.length + 1}`,
              name: sName,
              phone: sPhone,
              village: sVillage,
              craftType: sCraft,
              initialAdvance: sAdvance,
              currentAdvanceBalance: sAdvance,
              payableBalance: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isUserCreated: true,
            } as any);
            importedCount++;
          }
          if (newSupps.length > 0) {
            setSuppliers((prev) => [...prev, ...newSupps]);
            setExcelSuccessMsg(`ရက်လုပ်သူ/ကုန်သွင်းသူ (${newSupps.length}) ဦးကို Excel မှ အောင်မြင်စွာ ပေါင်းထည့်ပြီးပါပြီ။`);
          }
        } else {
          const newMerchants: Merchant[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[1]) continue;
            const mName = String(row[1]).trim();
            if (!mName) continue;
            const mPhone = row[2] ? String(row[2]).trim() : '';
            const mTown = row[3] ? String(row[3]).trim() : '';
            const mShop = row[4] ? String(row[4]).trim() : '';
            const mRec = Number(row[5]) || 0;

            newMerchants.push({
              id: generateStableId('m_xl'),
              code: `M-XL-${merchants.length + newMerchants.length + 1}`,
              name: mName,
              phone: mPhone,
              town: mTown,
              shopName: mShop,
              notes: '',
              currentReceivableBalance: mRec,
              payableBalance: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isUserCreated: true,
            } as any);
            importedCount++;
          }
          if (newMerchants.length > 0) {
            setMerchants((prev) => [...prev, ...newMerchants]);
            setExcelSuccessMsg(`ကုန်သည် (${newMerchants.length}) ဦးကို Excel မှ အောင်မြင်စွာ ပေါင်းထည့်ပြီးပါပြီ။`);
          }
        }
      } catch (err: any) {
        setExcelErrorMsg('Excel ဖိုင် ဖတ်ရှုရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်: ' + (err.message || ''));
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      let sheetData: any[] = [];
      let filename = '';

      if (excelTarget === 'PRODUCTS') {
        filename = 'Shwe_Let_Yar_Products_Template.xlsx';
        sheetData = [
          ['အမည် (Product Name)', 'အမျိုးအစား (Category)', 'ဝယ်စျေး (Buy Price)', 'ရောင်းစျေး (Sale Price)', 'စတင်လက်ကျန် (Stock)', 'ယူနစ် (Unit)'],
          ['ယွန်း ကွမ်းအစ် (အကြီး)', 'ကုန်ချော', 4500, 5800, 50, 'ထည်'],
          ['ယွန်း ဆွမ်းအုပ် (၁၄ လက်မ)', 'ကုန်ချော', 12000, 15500, 30, 'လုံး'],
          ['ဝါးခမောက် (ရိုးရိုး)', 'ဝါးထည်', 2500, 3200, 100, 'လုံး'],
          ['ကြိမ်ခြင်း (အဝိုင်း)', 'ကြိမ်ထည်', 6000, 7800, 40, 'လုံး'],
        ];
      } else if (excelTarget === 'SUPPLIERS') {
        filename = 'Shwe_Let_Yar_Suppliers_Template.xlsx';
        sheetData = [
          ['ကုဒ် (Code)', 'အမည် (Supplier Name)', 'ဖုန်းနံပါတ် (Phone)', 'ရွာ/လိပ်စာ (Village)', 'လက်မှုအမျိုးအစား (Craft)', 'စတင်အကြိုငွေ (Initial Advance)'],
          ['S-101', 'ဦးဘတင်', '09-450123456', 'ကျောက်ပန်းတောင်းရွာ', 'ကွမ်းအစ်', 50000],
          ['S-102', 'ဒေါ်သန်းခင်', '09-250987654', 'ပလင်းရွာ', 'ဆွမ်းအုပ်', 30000],
        ];
      } else {
        filename = 'Shwe_Let_Yar_Merchants_Template.xlsx';
        sheetData = [
          ['ကုဒ် (Code)', 'အမည် (Merchant Name)', 'ဖုန်းနံပါတ် (Phone)', 'မြို့နယ် (Town)', 'ဆိုင်ခွဲအမည် (Shop Name)', 'စတင်ရရန်ကျန်ငွေ (Initial Receivable)'],
          ['M-101', 'ဒေါ်ခင်အေး', '09-450000111', 'မန္တလေး', 'ရတနာ ကုန်ချောဆိုင်', 150000],
          ['M-102', 'ဦးမင်းမင်း', '09-250000222', 'ရန်ကုန်', 'ရွှေမင်းသမီး လက်ဆောင်ပစ္စည်း', 200000],
        ];
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, filename);
    } catch (e) {
      console.error('Download template error:', e);
    }
  };

  // Handle Step Confirmation & Next
  const handleNextStep = () => {
    setErrorMsg('');
    if (currentStep === 1) {
      if (!zeroConfirmed) {
        setErrorMsg('ဇီးရိုးဆက်တင် သတ်မှတ်ချက်ကို အတည်ပြုပေးပါ');
        return;
      }
    } else if (currentStep === 8) {
      if (!shopName.trim()) {
        setErrorMsg('ဆိုင်အမည် ရိုက်ထည့်ပေးရန် လိုအပ်ပါသည်');
        return;
      }
    }
    if (currentStep < 10) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Step 10: Final Go-Live Execution
  const handleExecuteGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');

    if (!doubleConfirmed) {
      setErrorMsg('လက်တွေ့စတင်အသုံးပြုရန် သဘောတူညီချက် (Double-confirm) ကို အမှန်ခြစ်ပေးပါ');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalPin = ownerPin.trim();

      // If PIN not configured, initialize new Owner PIN (6 digits mandatory)
      if (!hasConfiguredPin) {
        if (!newSetupPin || newSetupPin.trim().length < 6) {
          setErrorMsg('ဆိုင်ရှင် PIN အသစ်သည် အနည်းဆုံး ၆ လုံး ရိုက်ထည့်ရန် လိုအပ်ပါသည်');
          setIsSubmitting(false);
          return;
        }
        if (newSetupPin !== confirmSetupPin) {
          setErrorMsg('PIN အသစ်နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီမှုမရှိပါ');
          setIsSubmitting(false);
          return;
        }

        const pinToSet = newSetupPin.trim();
        const pinCreds = await derivePinCredentials(pinToSet);
        const recKey = generateSecureRecoveryKey();
        const recCreds = await deriveRecoveryCredentials(recKey);

        const updatedSettings: AppLockSettings = {
          ...(appLockSettings || { enabled: true, autoLockMinutes: 5, lockOnStartup: true }),
          enabled: true,
          isPinInitialized: true,
          pinSalt: pinCreds.salt,
          pinHash: pinCreds.hash,
          recoverySalt: recCreds.salt,
          recoveryHash: recCreds.hash,
          recoveryKeyDisplay: recKey,
          failedAttempts: 0,
          lockedUntilTimestamp: undefined,
          lastResetAt: new Date().toISOString(),
          lastUnlockedAt: new Date().toISOString(),
        };

        if (onUpdateAppLockSettings) {
          onUpdateAppLockSettings(updatedSettings);
        }
        finalPin = pinToSet;
      } else {
        if (!finalPin) {
          setErrorMsg('ဆိုင်ရှင် PIN (၆ လုံး) ရိုက်ထည့်ပေးပါ');
          setIsSubmitting(false);
          return;
        }

        const isValid = await verifyOwnerPin(finalPin, appLockSettings);
        if (!isValid) {
          setErrorMsg('ဆိုင်ရှင် PIN မှားယွင်းနေပါသည်။ ပြန်လည်စစ်ဆေးပါ');
          setIsSubmitting(false);
          return;
        }
      }

      // Build Opening Position
      const openingPosition: OpeningPosition = {
        cash: {
          cashAmount: Number(openingCash) || 0,
          bankAmount: 0,
          notes: 'ဆိုင်အဖွင့် လက်ဝယ်ငွေသား စာရင်း',
        },
        finishedGoods: products.map((p) => ({
          productId: p.id,
          productName: p.name,
          quantity: p.openingStock || 0,
          unitPrice: p.defaultWholesalePrice || p.defaultPrice || 0,
          totalValue: (p.openingStock || 0) * (p.defaultWholesalePrice || p.defaultPrice || 0),
        })),
        rawMaterials: rawMaterials.map((r) => ({
          materialName: r.materialName,
          unit: r.unit,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          totalValue: r.totalValue,
        })),
        receivables: receivables.map((r) => ({
          merchantId: r.merchantId,
          merchantName: r.merchantName,
          amount: r.amount,
          notes: r.notes,
        })),
        advances: advances.map((a) => ({
          type: 'SUPPLIER_ADVANCE' as const,
          counterpartId: a.counterpartId,
          counterpartName: a.counterpartName,
          amount: a.amount,
          notes: a.notes,
        })),
        payables: payables.map((p) => ({
          supplierId: p.supplierId,
          counterpartId: p.supplierId,
          counterpartName: p.counterpartName,
          amount: p.amount,
          notes: p.notes,
        })),
        issuedMaterials: [],
        openingCapital: Number(openingCash) || 0,
        notes: 'ဆိုင်သစ် စတင်အသုံးပြုမှု (Go-Live) အဖွင့်စာရင်း',
      };

      await onConfirmZeroReset({
        pin: finalPin,
        doubleConfirmed: true,
        shopName: shopName.trim() || 'ရွှေလက်ရာ',
        ownerName: ownerName.trim(),
        phone: shopPhone.trim(),
        address: shopAddress.trim(),
        tagline: shopTagline.trim(),
        accountingStartDate: startDate,
        customProducts: products,
        customSuppliers: suppliers,
        customMerchants: merchants,
        openingPosition,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Go-Live စတင်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="zero-settings-confirm-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col max-h-[96vh]">
        {/* Modal Top Banner */}
        <div className="px-5 py-3.5 bg-amber-500 text-slate-950 flex items-center justify-between border-b border-amber-600 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-950 leading-tight">
                လက်တွေ့စတင်အသုံးပြုရန် အဆင့်ဆင့် ပြင်ဆင်ခြင်း (Go-Live Wizard)
              </h3>
              <p className="text-[11px] font-bold text-slate-900">
                အဆင့် ({currentStep}/10): {stepTitles[currentStep - 1]?.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-zero-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-slate-950 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="ပိတ်မည်"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicators Bar */}
        <div className="px-4 py-2 bg-slate-900 text-white flex items-center justify-between gap-1 overflow-x-auto text-[11px] border-b border-slate-800 shrink-0">
          {stepTitles.map((step) => {
            const Icon = step.icon;
            const isCurrent = step.num === currentStep;
            const isCompleted = step.num < currentStep;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setCurrentStep(step.num)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md shrink-0 font-bold transition-all ${
                  isCurrent
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : isCompleted
                    ? 'text-emerald-400 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
                title={step.title}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-black/30 flex items-center justify-center text-[9px]">
                    {step.num}
                  </span>
                )}
                <span className="hidden sm:inline whitespace-nowrap">{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Wizard Main Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-xs text-slate-700 space-y-4">
          {/* ================= STEP 1: Zero Setting Baseline ================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>ဇီးရိုးဆက်တင် (Zero Settings) သို့ ပြောင်းလဲသတ်မှတ်ခြင်း</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-xs">
                  စနစ်ကို <strong>ဇီးရိုးဆက်တင် (Zero Settings)</strong> သို့ ပြောင်းလဲပါမည်။ မူလစမ်းသပ်ထားသော နမူနာဒေတာများ ဖျက်သိမ်းပြီး သုည (၀) အဖြစ် အောက်ပါအတိုင်း အသစ်ပြန်လည်စတင်မည် ဖြစ်ပါသည် -
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                    ၀
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">ကုန်သည်အသစ် မပါသေး</h4>
                    <p className="text-[11px] text-slate-600">ယခင်နမူနာ ကုန်သည်စာရင်းများကို ရှင်းလင်းထားမည်</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                    ၀
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">ရက်လုပ်သူ/ကုန်သွင်းသူ မပါသေး</h4>
                    <p className="text-[11px] text-slate-600">ယခင်နမူနာ ပေးသွင်းသူစာရင်းများကို ရှင်းလင်းထားမည်</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                    ၀
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">အရောင်းနှင့် ကုန်သိမ်းမှတ်တမ်း မပါသေး</h4>
                    <p className="text-[11px] text-slate-600">ယခင်အရောင်းအဝယ်၊ အော်ဒါ၊ ဆိုင်ချင်းဖလှယ်မှု သုည သတ်မှတ်မည်</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                    ၀
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">ကုန်ကြမ်းစာရင်း မပါသေး</h4>
                    <p className="text-[11px] text-slate-600">ယခင်ကုန်ကြမ်းစာရင်းနှင့် ကုန်ကြမ်းလက်ကျန် သုည သတ်မှတ်မည်</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={zeroConfirmed}
                    onChange={(e) => setZeroConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5 accent-emerald-600"
                  />
                  <span className="font-bold text-emerald-950 text-xs">
                    ဇီးရိုးဆက်တင် သတ်မှတ်ချက်ကို နားလည်သဘောတူပြီး နောက်တစ်ဆင့် ကုန်သည်အသစ်များ ထည့်သွင်းခြင်းသို့ ဆက်လက်ဆောင်ရွက်ပါမည် (Confirm Zero Baseline)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ================= STEP 2: Merchants ================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>ကုန်သည်စာရင်း (Merchants) အသစ် ထည့်သွင်းပါ</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  ဆိုင်မှ လက်ကားဖြန့်ဖြူးရောင်းချမည့် ကုန်သည်/ဖောက်သည်စာရင်းများကို တစ်ဦးချင်း ထည့်သွင်းပါ (သို့မဟုတ် နောက်တစ်ဆင့်သို့ ကျော်ပြီး ဆက်လက်ဆောင်ရွက်နိုင်ပါသည်)။
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ကုန်သည်အမည် *</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ဒေါ်ခင်အေး"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - 09-450000111"
                      value={merchantPhone}
                      onChange={(e) => setMerchantPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">မြို့နယ်/လိပ်စာ</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - မန္တလေး (၈၄ လမ်း)"
                      value={merchantTown}
                      onChange={(e) => setMerchantTown(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">မှတ်ချက်</label>
                    <input
                      type="text"
                      placeholder="အထည်လက်ကား ဝယ်ယူသူ"
                      value={merchantNotes}
                      onChange={(e) => setMerchantNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddMerchant}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ကုန်သည်စာရင်းသို့ ထည့်မည်</span>
                  </button>
                </div>
              </div>

              {/* Merchants List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>ထည့်သွင်းထားသော ကုန်သည်စာရင်း ({merchants.length} ဦး)</span>
                </div>
                {merchants.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                    လတ်တလော ကုန်သည် ထည့်သွင်းထားခြင်း မရှိသေးပါ။ မထည့်လိုသေးပါက ကျော်နိုင်ပါသည်။
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {merchants.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{m.name}</span>
                          {m.phone && <span className="text-slate-500 text-[11px] ml-2 font-mono">({m.phone})</span>}
                          {m.town && <span className="text-slate-600 text-[11px] ml-2">[{m.town}]</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMerchant(m.id)}
                          className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition-colors"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 3: Suppliers / Weavers ================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>ရက်လုပ်သူ (သို့) ကုန်သွင်းသူ (Weavers / Suppliers) ထည့်သွင်းပါ</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  ကုန်ချောရက်လုပ်ပေးသွင်းသူ၊ လက်မှုပညာရှင်များ သို့မဟုတ် ကုန်ကြမ်းပေးသွင်းသူများ၏ စာရင်းကို ထည့်သွင်းပါ။
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">အမည် *</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ဦးဘတင်"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - 09-450123456"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ရွာ/နေရပ်လိပ်စာ</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ကျောက်ပန်းတောင်းရွာ"
                      value={supplierVillage}
                      onChange={(e) => setSupplierVillage(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">အမျိုးအစား/လက်မှု</label>
                    <select
                      value={supplierCraft}
                      onChange={(e) => setSupplierCraft(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="ရက်လုပ်သူ">ရက်လုပ်သူ (Weaver)</option>
                      <option value="ကုန်သွင်းသူ">ကုန်သွင်းသူ (Finished Goods Supplier)</option>
                      <option value="ကုန်ကြမ်းသွင်းသူ">ကုန်ကြမ်းသွင်းသူ (Raw Material Supplier)</option>
                      <option value="ဝါးနှီးကြိမ်လုပ်သား">ဝါးနှီးကြိမ်လုပ်သား</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddSupplier}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ရက်လုပ်သူ/ကုန်သွင်းသူ ထည့်မည်</span>
                  </button>
                </div>
              </div>

              {/* Suppliers List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>ထည့်သွင်းထားသော ရက်လုပ်သူ/ကုန်သွင်းသူများ ({suppliers.length} ဦး)</span>
                </div>
                {suppliers.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                    လတ်တလော ရက်လုပ်သူ/ကုန်သွင်းသူ ထည့်သွင်းထားခြင်း မရှိသေးပါ။ မထည့်လိုသေးပါက ကျော်နိုင်ပါသည်။
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {suppliers.map((s) => (
                      <div
                        key={s.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{s.name}</span>
                          <span className="text-amber-800 bg-amber-100 text-[10px] px-1.5 py-0.5 rounded-full ml-2 font-semibold">
                            {s.craftType}
                          </span>
                          {s.phone && <span className="text-slate-500 text-[11px] ml-2 font-mono">({s.phone})</span>}
                          {s.village && <span className="text-slate-600 text-[11px] ml-2">[{s.village}]</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSupplier(s.id)}
                          className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition-colors"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 4: Products & Opening Stock ================= */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-600" />
                  <span>ကုန်ချောပစ္စည်းနှင့် စတင်ကုန်လက်ကျန် (Stock Balance) ထည့်သွင်းပါ</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  ဆိုင်တွင် လက်ရှိရောင်းချရန် အသင့်ရှိသော ကုန်ချောပစ္စည်းများနှင့် စတင်လက်ကျန်အရေအတွက်ကို ထည့်သွင်းပါ။
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ကုန်ပစ္စည်းအမည် *</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ယွန်း ကွမ်းအစ် (အကြီး)"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">အမျိုးအစား</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ကုန်ချော / ယွန်းထည်"
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ယူနစ်</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ထည် / လုံး / ခု"
                      value={productUnit}
                      onChange={(e) => setProductUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">စတင်ကုန်လက်ကျန် *</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={productStock}
                      onChange={(e) => setProductStock(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ရောင်းစျေး (ကျပ်)</label>
                    <input
                      type="number"
                      placeholder="ဥပမာ - 5800"
                      value={productSalePrice}
                      onChange={(e) => setProductSalePrice(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ကုန်ပစ္စည်းစာရင်းသို့ ထည့်မည်</span>
                  </button>
                </div>
              </div>

              {/* Products List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>ထည့်သွင်းထားသော ကုန်ပစ္စည်း ({products.length} မျိုး)</span>
                  <span className="text-amber-800">စုစုပေါင်း လက်ကျန်: {totalProductsStockCount} ခု</span>
                </div>
                {products.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                    လတ်တလော ကုန်ပစ္စည်း ထည့်သွင်းထားခြင်း မရှိသေးပါ။ မထည့်လိုသေးပါက ကျော်နိုင်ပါသည်။
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{p.name}</span>
                          <span className="text-slate-500 text-[11px] ml-2 font-mono">
                            လက်ကျန်: {p.openingStock} {p.unit}
                          </span>
                          {p.defaultPrice ? (
                            <span className="text-emerald-700 text-[11px] ml-2 font-mono">
                              ({p.defaultPrice.toLocaleString()} ကျပ်)
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition-colors"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 5: Advances ================= */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span>ရက်လုပ်သူ/ကုန်သွင်းသူများထံ ကြိုတင်ထုတ်ပေးထားသော အကြိုငွေ (Advances)</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  စနစ်မစတင်မီ ရက်လုပ်သူများထံ ကြိုထုတ်ပေးထားသော အကြိုငွေစာရင်းများ ရှိပါက ထည့်သွင်းပေးပါ။ မရှိပါက ကျော်နိုင်ပါသည်။
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ရက်လုပ်သူ/ကုန်သွင်းသူ အမည် *</label>
                    {suppliers.length > 0 ? (
                      <input
                        type="text"
                        list="adv-supplier-suggestions"
                        placeholder="ရွေးပါ သို့မဟုတ် ရိုက်ပါ"
                        value={advSupplierName}
                        onChange={(e) => setAdvSupplierName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder="ဥပမာ - ဦးဘတင်"
                        value={advSupplierName}
                        onChange={(e) => setAdvSupplierName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    )}
                    <datalist id="adv-supplier-suggestions">
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">အကြိုငွေ ပမာဏ (ကျပ်) *</label>
                    <input
                      type="number"
                      placeholder="ဥပမာ - 50000"
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">မှတ်ချက်</label>
                    <input
                      type="text"
                      placeholder="ကွမ်းအစ် ရက်လုပ်ရန် ကြိုငွေ"
                      value={advNotes}
                      onChange={(e) => setAdvNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddAdvance}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>အကြိုငွေ မှတ်တမ်းတင်မည်</span>
                  </button>
                </div>
              </div>

              {/* Advances List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>ထုတ်ပေးထားသော အကြိုငွေများ ({advances.length} ခု)</span>
                  <span className="text-amber-800 font-mono font-bold">
                    စုစုပေါင်း: {totalAdvancesSum.toLocaleString()} ကျပ်
                  </span>
                </div>
                {advances.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                    လတ်တလော အကြိုပေးငွေ မရှိသေးပါ။ မရှိပါက အတည်ပြုပြီး ဆက်သွားနိုင်ပါသည်။
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {advances.map((a) => (
                      <div
                        key={a.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{a.counterpartName}</span>
                          <span className="text-amber-800 font-mono font-bold text-[11px] ml-2">
                            {a.amount.toLocaleString()} ကျပ်
                          </span>
                          {a.notes && <span className="text-slate-500 text-[11px] ml-2">({a.notes})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdvance(a.id)}
                          className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition-colors"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 6: Raw Materials ================= */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>ကုန်ကြမ်းလက်ကျန် (Raw Material Stock) ထည့်သွင်းပါ</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  ဆိုင်လက်ဝယ် သိုလှောင်ထားသော သို့မဟုတ် ရက်လုပ်သူများထံ ထုတ်ပေးထားသော ဝါး၊ ကြိမ်၊ နှီး၊ သစ်စေး၊ ဆေး စသည့် ကုန်ကြမ်းလက်ကျန်များ ထည့်သွင်းပါ။
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ကုန်ကြမ်းအမည် *</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - တင်းဝါး / နှီးလိပ် / သစ်စေး"
                      value={rawName}
                      onChange={(e) => setRawName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ယူနစ်</label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - လုံး / စည်း / ပိဿာ"
                      value={rawUnit}
                      onChange={(e) => setRawUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">အရေအတွက် *</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={rawQty}
                      onChange={(e) => setRawQty(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ခန့်မှန်းတန်ဖိုး စုစုပေါင်း (ကျပ်)</label>
                    <input
                      type="number"
                      placeholder="ဥပမာ - 150000"
                      value={rawTotalValue}
                      onChange={(e) => setRawTotalValue(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">မှတ်ချက်</label>
                    <input
                      type="text"
                      placeholder="ဆိုင်သိုလှောင်ရုံ သို့မဟုတ် အလုပ်သမားထံ ထုတ်ပေးထားမှု"
                      value={rawNotes}
                      onChange={(e) => setRawNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddRawMaterial}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ကုန်ကြမ်းစာရင်းသို့ ထည့်မည်</span>
                  </button>
                </div>
              </div>

              {/* Raw Materials List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>ကုန်ကြမ်းလက်ကျန် စာရင်း ({rawMaterials.length} မျိုး)</span>
                  <span className="text-amber-800 font-mono font-bold">
                    စုစုပေါင်း တန်ဖိုး: {totalRawMaterialsValue.toLocaleString()} ကျပ်
                  </span>
                </div>
                {rawMaterials.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                    လတ်တလော ကုန်ကြမ်းစာရင်း မရှိသေးပါ။ မရှိပါက အတည်ပြုပြီး ဆက်သွားနိုင်ပါသည်။
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {rawMaterials.map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{r.materialName}</span>
                          <span className="text-slate-600 text-[11px] ml-2 font-mono">
                            {r.quantity} {r.unit}
                          </span>
                          {r.totalValue > 0 && (
                            <span className="text-emerald-700 text-[11px] ml-2 font-mono">
                              ({r.totalValue.toLocaleString()} ကျပ်)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRawMaterial(r.id)}
                          className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition-colors"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 7: Excel Import ================= */}
          {currentStep === 7 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  <span>ဆိုင်လက်ရှိ အသုံးပြုနေသော ဒေတာများကို Excel ဖြင့် ထည့်သွင်းပါ</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  ဆိုင်တွင် ယခင်က ရိုက်ကူးသိမ်းဆည်းထားသော Excel (.xlsx, .xls) ဖိုင်များ ရှိပါက တစ်ခါတည်း သွင်းယူနိုင်ပါသည်။ မရှိပါက ကျော်နိုင်ပါသည်။
                </p>
              </div>

              {/* Target Selector Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
                <button
                  type="button"
                  onClick={() => setExcelTarget('PRODUCTS')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    excelTarget === 'PRODUCTS'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ကုန်ပစ္စည်းများ ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExcelTarget('SUPPLIERS')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    excelTarget === 'SUPPLIERS'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ရက်လုပ်သူ/ကုန်သွင်းသူ ({suppliers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExcelTarget('MERCHANTS')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    excelTarget === 'MERCHANTS'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ကုန်သည်များ ({merchants.length})
                </button>
              </div>

              {/* File Upload Zone */}
              <div className="p-5 border-2 border-dashed border-amber-300 bg-amber-50/50 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-200/80 text-amber-900 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-900 text-xs">
                    {excelTarget === 'PRODUCTS'
                      ? 'ကုန်ပစ္စည်း Excel ဖိုင် ရွေးချယ်ပါ (.xlsx, .xls)'
                      : excelTarget === 'SUPPLIERS'
                      ? 'ရက်လုပ်သူ/ကုန်သွင်းသူ Excel ဖိုင် ရွေးချယ်ပါ (.xlsx, .xls)'
                      : 'ကုန်သည် Excel ဖိုင် ရွေးချယ်ပါ (.xlsx, .xls)'}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">ဖိုင်ကို ကလစ်နှိပ်ပြီး ရွေးချယ်ပါ</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="wizard-excel-input"
                  />
                  <label
                    htmlFor="wizard-excel-input"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>ဖိုင်ရွေးချယ်မည်</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>နမူနာပုံစံ ရယူရန်</span>
                  </button>
                </div>
              </div>

              {excelSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{excelSuccessMsg}</span>
                </div>
              )}

              {excelErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{excelErrorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 8: Shop Profile ================= */}
          {currentStep === 8 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-600" />
                  <span>ဆိုင်အမည်နှင့် လုပ်ငန်းအချက်အလက် (Shop Name & Info) ထည့်သွင်းပါ</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  ဘောက်ချာများ၊ ပြေစာများနှင့် အစီရင်ခံစာများတွင် ဖော်ပြမည့် ဆိုင်အမည်နှင့် ဆက်သွယ်ရန် အချက်အလက်များ သတ်မှတ်ပါ။
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-300 rounded-xl space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ဆိုင်/လုပ်ငန်းအမည် (Shop Name) *
                  </label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - ရွှေလက်ရာ - မြန်မာ့ရိုးရာလက်မှု"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ဆိုင်ရှင်အမည် (Owner Name)
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ဦးမောင်မောင်"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ဆက်သွယ်ရန်ဖုန်း (Phone)
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - 09-123456789"
                      value={shopPhone}
                      onChange={(e) => setShopPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ဆိုင်လိပ်စာ (Address)
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ဗိုလ်ချုပ်ဈေး၊ ရန်ကုန်"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      စာရင်းစတင်သည့်ရက်စွဲ (Accounting Start Date)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ဆောင်ပုဒ်/အမှာစကား (Tagline)
                  </label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - သဘာဝဝါးနှီး ရိုးရာလက်မှု ကုန်ချောများ"
                    value={shopTagline}
                    onChange={(e) => setShopTagline(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 9: Receivables, Payables & Cash ================= */}
          {currentStep === 9 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>ရရန်ငွေ၊ ပေးရန်ငွေ နှင့် ဆိုင်အဖွင့်ငွေသား ထည့်သွင်းပါ</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  ဖောက်သည်များထံမှ ရရန်ကျန်ငွေ၊ ပေးသွင်းသူများထံ ပေးရန်ရှိငွေနှင့် ဆိုင်တွင် လက်ဝယ်ရှိသော အဖွင့်ငွေသား စာရင်း ထည့်သွင်းပါ။
                </p>
              </div>

              {/* Section 1: Receivables */}
              <div className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>ဖောက်သည်များထံမှ ရရန်ကျန်ငွေ (Receivables)</span>
                  </h5>
                  <span className="text-emerald-700 font-mono font-bold text-[11px]">
                    စုစုပေါင်း: {totalReceivablesSum.toLocaleString()} ကျပ်
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <input
                      type="text"
                      list="rec-merchant-suggestions"
                      placeholder="ကုန်သည်အမည် ရွေးပါ/ရိုက်ပါ"
                      value={recMerchantName}
                      onChange={(e) => setRecMerchantName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <datalist id="rec-merchant-suggestions">
                      {merchants.map((m) => (
                        <option key={m.id} value={m.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="ရရန်ငွေ (ကျပ်)"
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="မှတ်ချက်"
                      value={recNotes}
                      onChange={(e) => setRecNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddReceivable}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {receivables.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                    {receivables.map((r) => (
                      <div key={r.id} className="p-1.5 bg-emerald-50/60 rounded flex items-center justify-between text-[11px]">
                        <span>
                          <strong>{r.merchantName}</strong>: {r.amount.toLocaleString()} ကျပ် {r.notes && `(${r.notes})`}
                        </span>
                        <button type="button" onClick={() => handleDeleteReceivable(r.id)} className="text-rose-600">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Payables */}
              <div className="p-3.5 bg-white border border-slate-300 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>ပေးရန်ရှိငွေ (Payables)</span>
                  </h5>
                  <span className="text-rose-700 font-mono font-bold text-[11px]">
                    စုစုပေါင်း: {totalPayablesSum.toLocaleString()} ကျပ်
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <input
                      type="text"
                      list="pay-supplier-suggestions"
                      placeholder="ပေးရန်ရှိသူ အမည် ရွေးပါ/ရိုက်ပါ"
                      value={paySupplierName}
                      onChange={(e) => setPaySupplierName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <datalist id="pay-supplier-suggestions">
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="ပေးရန်ငွေ (ကျပ်)"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="မှတ်ချက်"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddPayable}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {payables.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                    {payables.map((p) => (
                      <div key={p.id} className="p-1.5 bg-rose-50/60 rounded flex items-center justify-between text-[11px]">
                        <span>
                          <strong>{p.counterpartName}</strong>: {p.amount.toLocaleString()} ကျပ် {p.notes && `(${p.notes})`}
                        </span>
                        <button type="button" onClick={() => handleDeletePayable(p.id)} className="text-rose-600">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Opening Cash Float */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <h5 className="font-bold text-slate-900 text-xs">ဆိုင်အဖွင့် လက်ဝယ်ငွေသား (Opening Cash Float)</h5>
                <p className="text-[11px] text-slate-600">
                  ဆိုင်ဖွင့်စချိန်တွင် ကောင်တာ/သေတ္တာတွင်း အသင့်ရှိသော အဖွင့်ငွေသား ပမာဏ (ကျပ်)
                </p>
                <input
                  type="number"
                  placeholder="0"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 10: Final Review, Password & Go-Live ================= */}
          {currentStep === 10 && (
            <form onSubmit={handleExecuteGoLive} className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>စနစ်ကို Go-Live လက်တွေ့စတင်အသုံးပြုရန် နောက်ဆုံးအဆင့် စစ်ဆေးခြင်း</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-xs">
                  ထည့်သွင်းထားသော စာရင်းအကျဉ်းချုပ်ကို စစ်ဆေးပြီး ဆိုင်ရှင် စကားဝှက်/PIN ဖြင့် အတည်ပြုကာ စနစ်ကို စတင်အသုံးပြုပါ။
                </p>
              </div>

              {/* Comprehensive Summary Cards */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs">
                <div className="font-extrabold text-slate-900 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                  <span>လုပ်ငန်းအချက်အလက် အကျဉ်းချုပ်</span>
                  <span className="text-amber-700 font-bold">{shopName}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">ကုန်သည်အရေအတွက်</span>
                    <span className="font-bold text-slate-900 text-xs">{merchants.length} ဦး</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">ရက်လုပ်သူ/ကုန်သွင်းသူ</span>
                    <span className="font-bold text-slate-900 text-xs">{suppliers.length} ဦး</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">ကုန်ချောပစ္စည်းလက်ကျန်</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {products.length} မျိုး ({totalProductsStockCount} ခု)
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">အကြိုပေးငွေ စုစုပေါင်း</span>
                    <span className="font-bold text-amber-800 text-xs font-mono">
                      {totalAdvancesSum.toLocaleString()} ကျပ်
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">ကုန်ကြမ်းလက်ကျန် တန်ဖိုး</span>
                    <span className="font-bold text-slate-900 text-xs font-mono">
                      {totalRawMaterialsValue.toLocaleString()} ကျပ်
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">အဖွင့်ငွေသား လက်ကျန်</span>
                    <span className="font-bold text-emerald-800 text-xs font-mono">
                      {Number(openingCash || 0).toLocaleString()} ကျပ်
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span>
                    ရရန်ကျန်ငွေ စုစုပေါင်း: <strong className="text-emerald-800 font-mono">{totalReceivablesSum.toLocaleString()}</strong> ကျပ်
                  </span>
                  <span>
                    ပေးရန်ရှိငွေ စုစုပေါင်း: <strong className="text-rose-800 font-mono">{totalPayablesSum.toLocaleString()}</strong> ကျပ်
                  </span>
                </div>
              </div>

              {/* Owner Password / PIN Verification */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2.5 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>
                    {hasConfiguredPin
                      ? 'ဆိုင်ရှင် လုံခြုံရေး PIN ဖြင့် အတည်ပြုပါ'
                      : 'ဆိုင်ရှင် PIN အသစ် သတ်မှတ်ပြီး စတင်ပါ'}
                  </span>
                </div>

                {hasConfiguredPin ? (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-slate-300 font-semibold">
                      ဆိုင်ရှင် PIN (၆ လုံး စကားဝှက်) ရိုက်ထည့်ပါ *
                    </label>
                    <div className="relative">
                      <input
                        id="golive-owner-pin-input"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="၆ လုံး ရိုက်ထည့်ပါ"
                        value={ownerPin}
                        onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm tracking-widest focus:outline-none focus:border-amber-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      သတ်မှတ်ထားသော ဆိုင်ရှင် PIN (၆ လုံး) ကို ရိုက်ထည့်ပါ။
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                        ဆိုင်ရှင် PIN အသစ် (၆ လုံး သတ်မှတ်ပါ) *
                      </label>
                      <input
                        id="golive-new-pin-input"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="၆ လုံး သတ်မှတ်ပါ"
                        value={newSetupPin}
                        onChange={(e) => setNewSetupPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs tracking-wider focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                        PIN အသစ် ထပ်မံအတည်ပြုပါ (၆ လုံး) *
                      </label>
                      <input
                        id="golive-confirm-pin-input"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="၆ လုံး ထပ်မံရိုက်ပါ"
                        value={confirmSetupPin}
                        onChange={(e) => setConfirmSetupPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs tracking-wider focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Double-Confirmation Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-300 cursor-pointer select-none">
                  <input
                    id="golive-double-confirm-checkbox"
                    type="checkbox"
                    checked={doubleConfirmed}
                    onChange={(e) => setDoubleConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer mt-0.5 accent-amber-600"
                  />
                  <span className="font-bold text-amber-950 text-xs leading-snug">
                    အထက်ဖော်ပြပါ စာရင်းဒေတာများ အားလုံး မှန်ကန်စွာ စစ်ဆေးပြီးဖြစ်၍ နမူနာဒေတာများ ဖျက်သိမ်းကာ လက်တွေ့သုံး (Go-Live) အဆင့်အဖြစ် တရားဝင် စတင်အသုံးပြုပါမည်။
                  </span>
                </label>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Final Submit Button */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>အဆင့် (၉) သို့ ပြန်သွားမည်</span>
                </button>

                <button
                  type="submit"
                  id="confirm-golive-submit-btn"
                  disabled={!doubleConfirmed || isSubmitting}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition-all ${
                    doubleConfirmed && !isSubmitting
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isSubmitting ? 'စတင်အသုံးပြုနေပါသည်...' : 'အတည်ပြုပြီး Go-Live စတင်အသုံးပြုမည်'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Global error alert if outside step 10 */}
          {errorMsg && currentStep !== 10 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls for Steps 1 through 9 */}
        {currentStep < 10 && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
            <div>
              {currentStep === 1 && onLoadDemoData && (
                <button
                  type="button"
                  id="load-demo-from-zero-btn"
                  onClick={() => {
                    onClose();
                    onLoadDemoData();
                  }}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">နမူနာဒေတာ ပြန်လည်ထည့်မည်</span>
                </button>
              )}
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-3.5 py-2 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>ရှေ့သို့ (Back)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="cancel-zero-modal-btn"
                onClick={onClose}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                မလုပ်တော့ပါ
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  {currentStep === 1
                    ? 'ဇီးရိုးဆက်တင် အတည်ပြုပြီး ရှေ့သို့'
                    : currentStep === 9
                    ? 'စစ်ဆေးအတည်ပြုခြင်းသို့'
                    : 'အတည်ပြုပြီး ရှေ့သို့'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
