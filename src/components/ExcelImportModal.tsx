import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  RefreshCw,
  Plus,
  ArrowRight,
  Database,
} from 'lucide-react';
import { Product, Supplier, Merchant } from '../types';

export type ExcelImportTarget = 'PRODUCTS' | 'SUPPLIERS' | 'MERCHANTS';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTarget?: ExcelImportTarget;
  existingProducts?: Product[];
  existingSuppliers?: Supplier[];
  existingMerchants?: Merchant[];
  onImportProducts?: (products: Product[]) => void;
  onImportSuppliers?: (suppliers: Supplier[]) => void;
  onImportMerchants?: (merchants: Merchant[]) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  defaultTarget = 'PRODUCTS',
  existingProducts = [],
  existingSuppliers = [],
  existingMerchants = [],
  onImportProducts,
  onImportSuppliers,
  onImportMerchants,
}) => {
  const [activeTarget, setActiveTarget] = useState<ExcelImportTarget>(defaultTarget);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importStats, setImportStats] = useState<{ total: number; valid: number; duplicates: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle switching target tab
  const handleSwitchTarget = (target: ExcelImportTarget) => {
    setActiveTarget(target);
    setParsedRows([]);
    setFileName('');
    setImportStats(null);
    setErrorMsg('');
    setSuccessMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 1. Download Template for current target
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      let sheetData: any[] = [];
      let filename = '';

      if (activeTarget === 'PRODUCTS') {
        filename = 'Shwe_Let_Yar_Products_Template.xlsx';
        sheetData = [
          ['အမည် (Product Name)', 'အမျိုးအစား (Category)', 'ဝယ်စျေး (Buy Price)', 'ရောင်းစျေး (Sale Price)', 'စတင်လက်ကျန် (Stock)', 'ယူနစ် (Unit)', 'သတိပေးလက်ကျန် (Min Stock)'],
          ['ယွန်း ကွမ်းအစ် (အကြီး)', 'ယွန်းထည်', 4500, 5800, 50, 'ထည်', 10],
          ['ယွန်း ဆွမ်းအုပ် (၁၄ လက်မ)', 'ယွန်းထည်', 12000, 15500, 30, 'လုံး', 5],
          ['ဝါးခမောက် (ရိုးရိုး)', 'ဝါးထည်', 2500, 3200, 100, 'လုံး', 20],
          ['ကြိမ်ခြင်း (အဝိုင်း)', 'ကြိမ်ထည်', 6000, 7800, 40, 'လုံး', 10],
        ];
      } else if (activeTarget === 'SUPPLIERS') {
        filename = 'Shwe_Let_Yar_Suppliers_Template.xlsx';
        sheetData = [
          ['ကုဒ် (Code)', 'အမည် (Supplier Name)', 'ဖုန်းနံပါတ် (Phone)', 'ရွာ/လိပ်စာ (Village)', 'လက်မှုအမျိုးအစား (Craft)', 'စတင်အကြိုငွေ (Initial Advance)', 'မှတ်ချက် (Notes)'],
          ['S-101', 'ဦးဘတင်', '09-450123456', 'ကျောက်ပန်းတောင်းရွာ', 'ကွမ်းအစ်', 50000, 'လက်ရာသေသပ် ကွမ်းအစ် အဓိကသွင်းသူ'],
          ['S-102', 'ဒေါ်သန်းခင်', '09-250987654', 'ပလင်းရွာ', 'ဆွမ်းအုပ်', 30000, 'ဆွမ်းအုပ် နှင့် ဗန်း အဓိကသွင်းသူ'],
          ['S-103', 'ကိုအောင်မျိုး', '09-790112233', 'အင်ကြင်းကုန်း', 'ဝါးခမောက်', 0, 'ဝါးထည် သွင်းသူ'],
        ];
      } else {
        filename = 'Shwe_Let_Yar_Merchants_Template.xlsx';
        sheetData = [
          ['ကုဒ် (Code)', 'အမည် (Merchant Name)', 'ဖုန်းနံပါတ် (Phone)', 'မြို့နယ် (Town)', 'ဆိုင်ခွဲအမည် (Shop Name)', 'စတင်ရရန်ကျန်ငွေ (Initial Receivable)', 'မှတ်ချက် (Notes)'],
          ['M-101', 'ဒေါ်ခင်အေး', '09-450000111', 'မန္တလေး', 'ရတနာ ယွန်းထည်ဆိုင်', 150000, '၈၄ လမ်း လက်ကား'],
          ['M-102', 'ဦးမင်းမင်း', '09-250000222', 'ရန်ကုန်', 'ရွှေမင်းသမီး လက်ဆောင်ပစ္စည်း', 200000, 'ဗိုလ်ချုပ်ဈေး'],
          ['M-103', 'ကိုနိုင်ဦး', '09-790000333', 'နေပြည်တော်', 'အောင်သပြေ ရိုးရာထည်', 0, 'သပြေကုန်းဈေး'],
        ];
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      // Auto column width
      ws['!cols'] = sheetData[0].map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Template download error:', err);
      setErrorMsg('Excel နမူနာဖိုင် ဒေါင်းလုဒ်ဆွဲရာတွင် ချို့ယွင်းချက်ရှိပါသည်');
    }
  };

  // Helper to find column value by loose key names
  const findValue = (row: any, ...keys: string[]): any => {
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toLowerCase().includes(lowerKey)) {
          return row[rowKey];
        }
      }
    }
    return undefined;
  };

  // 2. Parse Excel file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');
    setSuccessMsg('');
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          setErrorMsg('ဖိုင်ထဲတွင် အချက်အလက်များ မတွေ့ရှိပါ');
          setIsProcessing(false);
          return;
        }

        // Process rows according to target
        let duplicates = 0;
        let valid = 0;
        const mapped: any[] = [];

        if (activeTarget === 'PRODUCTS') {
          const existingNames = new Set(existingProducts.map((p) => p.name.trim().toLowerCase()));

          jsonData.forEach((row: any, idx: number) => {
            const name = String(findValue(row, 'အမည်', 'name', 'product', 'item') || '').trim();
            if (!name) return; // skip empty rows

            const category = String(findValue(row, 'အမျိုးအစား', 'category', 'type') || 'ယွန်းထည်').trim();
            const buyPrice = Number(findValue(row, 'ဝယ်စျေး', 'buy', 'cost', 'purchase') || 0);
            const salePrice = Number(findValue(row, 'ရောင်းစျေး', 'sale', 'wholesale') || Math.round(buyPrice * 1.25));
            const openingStock = Number(findValue(row, 'လက်ကျန်', 'stock', 'opening', 'qty', 'quantity') || 0);
            const unit = String(findValue(row, 'ယူနစ်', 'unit') || 'ထည်').trim();
            const minStock = Number(findValue(row, 'အနည်းဆုံး', 'min') || 15);

            const isDuplicate = existingNames.has(name.toLowerCase());
            if (isDuplicate) duplicates++;
            else valid++;

            mapped.push({
              tempId: `prod-import-${Date.now()}-${idx}`,
              name,
              category: category || 'ယွန်းထည်',
              defaultPrice: isNaN(buyPrice) ? 0 : buyPrice,
              defaultWholesalePrice: isNaN(salePrice) ? 0 : salePrice,
              openingStock: isNaN(openingStock) ? 0 : openingStock,
              currentStock: isNaN(openingStock) ? 0 : openingStock,
              unit: unit || 'ထည်',
              minStockAlert: isNaN(minStock) ? 15 : minStock,
              isDuplicate,
            });
          });
        } else if (activeTarget === 'SUPPLIERS') {
          const existingNames = new Set(existingSuppliers.map((s) => s.name.trim().toLowerCase()));
          const existingCodes = new Set(existingSuppliers.map((s) => s.code.trim().toUpperCase()));

          jsonData.forEach((row: any, idx: number) => {
            const name = String(findValue(row, 'အမည်', 'name', 'supplier') || '').trim();
            if (!name) return;

            let code = String(findValue(row, 'ကုဒ်', 'code', 'id') || '').trim().toUpperCase();
            if (!code) {
              code = `S-${String(existingSuppliers.length + idx + 1).padStart(3, '0')}`;
            }

            const phone = String(findValue(row, 'ဖုန်း', 'phone', 'mobile') || '').trim();
            const village = String(findValue(row, 'ရွာ', 'village', 'address', 'လိပ်စာ') || 'မင်းနန်သူ').trim();
            const craft = String(findValue(row, 'လက်မှု', 'craft', 'မှတ်ချက်', 'notes') || '').trim();
            const initialAdvance = Number(findValue(row, 'အကြိုငွေ', 'advance', 'ကြိုငွေ') || 0);

            const isDuplicate = existingNames.has(name.toLowerCase()) || existingCodes.has(code);
            if (isDuplicate) duplicates++;
            else valid++;

            mapped.push({
              tempId: `sup-import-${Date.now()}-${idx}`,
              code,
              name,
              phone: phone || '-',
              village: village || 'မင်းနန်သူ',
              notes: craft,
              initialAdvance: isNaN(initialAdvance) ? 0 : initialAdvance,
              currentAdvanceBalance: isNaN(initialAdvance) ? 0 : initialAdvance,
              totalGoodsValueDelivered: 0,
              totalAdvanceGiven: isNaN(initialAdvance) ? 0 : initialAdvance,
              isDuplicate,
            });
          });
        } else {
          // MERCHANTS
          const existingNames = new Set(existingMerchants.map((m) => m.name.trim().toLowerCase()));
          const existingCodes = new Set(existingMerchants.map((m) => m.code.trim().toUpperCase()));

          jsonData.forEach((row: any, idx: number) => {
            const name = String(findValue(row, 'အမည်', 'name', 'merchant') || '').trim();
            if (!name) return;

            let code = String(findValue(row, 'ကုဒ်', 'code', 'id') || '').trim().toUpperCase();
            if (!code) {
              code = `M-${String(existingMerchants.length + idx + 1).padStart(3, '0')}`;
            }

            const phone = String(findValue(row, 'ဖုန်း', 'phone', 'mobile') || '').trim();
            const town = String(findValue(row, 'မြို့', 'town', 'city') || 'မန္တလေး').trim();
            const shopName = String(findValue(row, 'ဆိုင်', 'shop') || '').trim();
            const initialDebt = Number(findValue(row, 'ရရန်ကျန်', 'receivable', 'debt', 'အကြွေး') || 0);
            const notes = String(findValue(row, 'မှတ်ချက်', 'notes') || '').trim();

            const isDuplicate = existingNames.has(name.toLowerCase()) || existingCodes.has(code);
            if (isDuplicate) duplicates++;
            else valid++;

            mapped.push({
              tempId: `merch-import-${Date.now()}-${idx}`,
              code,
              name,
              phone: phone || '-',
              town: town || 'မန္တလေး',
              shopName: shopName || name,
              notes,
              initialReceivable: isNaN(initialDebt) ? 0 : initialDebt,
              currentReceivableBalance: isNaN(initialDebt) ? 0 : initialDebt,
              totalPurchasesValue: 0,
              totalCashPaid: 0,
              isDuplicate,
            });
          });
        }

        setParsedRows(mapped);
        setImportStats({
          total: mapped.length,
          valid,
          duplicates,
        });
      } catch (err: any) {
        console.error('Error parsing Excel:', err);
        setErrorMsg('ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်: ' + (err?.message || ''));
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 3. Confirm Import
  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    if (activeTarget === 'PRODUCTS' && onImportProducts) {
      const formatted: Product[] = parsedRows.map((row) => ({
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: row.name,
        category: row.category,
        defaultPrice: row.defaultPrice,
        defaultWholesalePrice: row.defaultWholesalePrice,
        unit: row.unit,
        openingStock: row.openingStock,
        currentStock: row.currentStock,
        minStockAlert: row.minStockAlert,
        active: true,
      }));
      onImportProducts(formatted);
      setSuccessMsg(`ကုန်ပစ္စည်း ${formatted.length} မျိုး အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!`);
    } else if (activeTarget === 'SUPPLIERS' && onImportSuppliers) {
      const today = new Date().toISOString().slice(0, 10);
      const formatted: Supplier[] = parsedRows.map((row) => ({
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        code: row.code,
        name: row.name,
        phone: row.phone,
        village: row.village,
        notes: row.notes,
        initialAdvance: row.initialAdvance,
        currentAdvanceBalance: row.currentAdvanceBalance,
        totalGoodsValueDelivered: 0,
        totalAdvanceGiven: row.initialAdvance,
        createdAt: today,
        updatedAt: today,
      }));
      onImportSuppliers(formatted);
      setSuccessMsg(`ကုန်ပစ္စည်းပေးသွင်းသူ ${formatted.length} ဦး အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!`);
    } else if (activeTarget === 'MERCHANTS' && onImportMerchants) {
      const today = new Date().toISOString().slice(0, 10);
      const formatted: Merchant[] = parsedRows.map((row) => ({
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        code: row.code,
        name: row.name,
        phone: row.phone,
        town: row.town,
        shopName: row.shopName,
        notes: row.notes,
        initialReceivable: row.initialReceivable,
        currentReceivableBalance: row.currentReceivableBalance,
        totalPurchasesValue: 0,
        totalCashPaid: 0,
        createdAt: today,
        updatedAt: today,
      }));
      onImportMerchants(formatted);
      setSuccessMsg(`ကုန်သည် ${formatted.length} ဦး အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!`);
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700/60 border border-emerald-400/30 flex items-center justify-center text-emerald-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <span>Excel ဖြင့် စာရင်းအစုလိုက် ထည့်သွင်းခြင်း</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  XLSX / CSV
                </span>
              </h3>
              <p className="text-xs text-emerald-200">
                ကုန်ပစ္စည်း၊ ပေးသွင်းသူနှင့် ကုန်သည်စာရင်း ရာထောင်ချီ တစ်ပြိုင်နက် သွင်းယူနည်း
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-emerald-950 hover:bg-emerald-800 text-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Select Tabs */}
        <div className="bg-slate-100 p-2.5 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleSwitchTarget('PRODUCTS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTarget === 'PRODUCTS'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>ကုန်ပစ္စည်းများ ({existingProducts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTarget('SUPPLIERS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTarget === 'SUPPLIERS'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>ကုန်ပစ္စည်းပေးသွင်းသူများ ({existingSuppliers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTarget('MERCHANTS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTarget === 'MERCHANTS'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>ကုန်သည်များ ({existingMerchants.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Step 1: Download Template */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] flex items-center justify-center font-bold">1</span>
                <span>Excel နမူနာဖိုင် ဒေါင်းလုဒ်ဆွဲပါ:</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ပုံစံမှန်ကန်စေရန် အောက်ပါ Template ဖိုင်တွင် အချက်အလက်များ ဖြည့်စွက်ပါ
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>နမူနာဖိုင် ရယူမည် (.xlsx)</span>
            </button>
          </div>

          {/* Step 2: Upload Excel file */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] flex items-center justify-center font-bold">2</span>
              <span>ဖြည့်စွက်ပြီးသော Excel/CSV ဖိုင်ကို တင်ပါ:</span>
            </h4>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 p-5 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {fileName ? `ရွေးချယ်ထားသောဖိုင်: ${fileName}` : 'ဖိုင်ရွေးရန် ဤနေရာကို နှိပ်ပါ (သို့) ဖိုင်ကို ဆွဲထည့်ပါ'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ထောက်ပံ့ပေးထားသောဖိုင်အမျိုးအစား: .xlsx, .xls, .csv
                </p>
              </div>
            </div>
          </div>

          {/* Loading spinner */}
          {isProcessing && (
            <div className="p-4 bg-slate-50 rounded-xl text-center flex items-center justify-center gap-2 text-xs text-slate-600">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Excel ဖိုင်အား ဖတ်ရှုတွက်ချက်နေပါသည်...</span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Step 3: Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                  <span>ဖတ်ရှုရရှိသော အချက်အလက်များ</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {importStats?.total} ခု
                  </span>
                  {importStats && importStats.duplicates > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      {importStats.duplicates} ခု ယခင်ရှိပြီး
                    </span>
                  )}
                </h4>
                <span className="text-[11px] text-slate-500">ပထမ ၂၀ ခု နမူနာပြသမှု</span>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold sticky top-0">
                    <tr>
                      <th className="p-2">စဉ်</th>
                      {activeTarget === 'PRODUCTS' && (
                        <>
                          <th className="p-2">အမည်</th>
                          <th className="p-2">အမျိုးအစား</th>
                          <th className="p-2 text-right">ဝယ်စျေး</th>
                          <th className="p-2 text-right">ရောင်းစျေး</th>
                          <th className="p-2 text-right">လက်ကျန်</th>
                          <th className="p-2">ယူနစ်</th>
                        </>
                      )}
                      {activeTarget === 'SUPPLIERS' && (
                        <>
                          <th className="p-2">ကုဒ်</th>
                          <th className="p-2">အမည်</th>
                          <th className="p-2">ဖုန်း</th>
                          <th className="p-2">ရွာ/လိပ်စာ</th>
                          <th className="p-2 text-right">အကြိုငွေ</th>
                        </>
                      )}
                      {activeTarget === 'MERCHANTS' && (
                        <>
                          <th className="p-2">ကုဒ်</th>
                          <th className="p-2">အမည်</th>
                          <th className="p-2">ဖုန်း</th>
                          <th className="p-2">မြို့နယ်</th>
                          <th className="p-2 text-right">ရရန်ကျန်ငွေ</th>
                        </>
                      )}
                      <th className="p-2 text-center">အခြေအနေ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                        {activeTarget === 'PRODUCTS' && (
                          <>
                            <td className="p-2 font-bold text-slate-900">{row.name}</td>
                            <td className="p-2 text-slate-600">{row.category}</td>
                            <td className="p-2 text-right font-mono text-slate-800">{row.defaultPrice.toLocaleString()} Ks</td>
                            <td className="p-2 text-right font-mono text-blue-700">{row.defaultWholesalePrice.toLocaleString()} Ks</td>
                            <td className="p-2 text-right font-mono text-slate-800">{row.openingStock}</td>
                            <td className="p-2 text-slate-500">{row.unit}</td>
                          </>
                        )}
                        {activeTarget === 'SUPPLIERS' && (
                          <>
                            <td className="p-2 font-mono text-slate-600">{row.code}</td>
                            <td className="p-2 font-bold text-slate-900">{row.name}</td>
                            <td className="p-2 text-slate-600">{row.phone}</td>
                            <td className="p-2 text-slate-600">{row.village}</td>
                            <td className="p-2 text-right font-mono text-amber-700">{row.initialAdvance.toLocaleString()} Ks</td>
                          </>
                        )}
                        {activeTarget === 'MERCHANTS' && (
                          <>
                            <td className="p-2 font-mono text-slate-600">{row.code}</td>
                            <td className="p-2 font-bold text-slate-900">{row.name}</td>
                            <td className="p-2 text-slate-600">{row.phone}</td>
                            <td className="p-2 text-slate-600">{row.town}</td>
                            <td className="p-2 text-right font-mono text-amber-700">{row.initialReceivable.toLocaleString()} Ks</td>
                          </>
                        )}
                        <td className="p-2 text-center">
                          {row.isDuplicate ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              ရှိပြီး
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              အသစ်
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-[11px] text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                စုစုပေါင်း <strong>{parsedRows.length}</strong> ခု ထည့်သွင်းရန် အသင့်ဖြစ်နေပါသည်
              </span>
            ) : (
              <span>ဖိုင်ရွေးချယ်ပြီးပါက အတည်ပြုခလုတ် ပေါ်လာပါမည်</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              မလုပ်တော့ပါ
            </button>

            <button
              type="button"
              disabled={parsedRows.length === 0 || isProcessing}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              <span>စာရင်းထဲသို့ {parsedRows.length > 0 ? `${parsedRows.length} ခု` : ''} ထည့်သွင်းမည်</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
