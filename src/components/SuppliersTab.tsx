import React, { useState, useMemo, useEffect } from 'react';
import { Supplier, TransactionRecord, RawMaterialItem, PaymentMethod, Product, RawMaterialPreset } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  exportSuppliersCSV,
  getTodayDateString,
  getCurrentTimeString,
  getStoredRawMaterialPresets,
} from '../utils/storage';
import {
  Users,
  Search,
  Plus,
  Phone,
  DollarSign,
  History,
  Download,
  MapPin,
  X,
  Edit2,
  Trash2,
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';

interface SuppliersTabProps {
  suppliers: Supplier[];
  transactions: TransactionRecord[];
  products?: Product[];
  onAddSupplier: (supplier: Supplier) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onOpenNewEntryWithSupplier: (supplierId: string) => void;
  onViewSupplierLedger: (supplier: Supplier) => void;
  onDeleteSupplier?: (supplierId: string) => void;
  onAddTransaction?: (tx: TransactionRecord) => void;
  onOpenDeletedHistory?: () => void;
  deletedRecordsCount?: number;
  onOpenExcelImport?: () => void;
}

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  suppliers = [],
  transactions = [],
  products = [],
  onAddSupplier,
  onUpdateSupplier,
  onOpenNewEntryWithSupplier,
  onViewSupplierLedger,
  onDeleteSupplier,
  onAddTransaction,
  onOpenDeletedHistory,
  deletedRecordsCount = 0,
  onOpenExcelImport,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'has_advance' | 'cleared'>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(36);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Reset display limit when filter changes for instant high performance
  useEffect(() => {
    setDisplayLimit(36);
  }, [searchQuery, selectedVillage, balanceFilter]);

  // Raw Material Credit State & Presets
  const [presets, setPresets] = useState<RawMaterialPreset[]>(() => getStoredRawMaterialPresets());
  const [isRawMaterialModalOpen, setIsRawMaterialModalOpen] = useState<boolean>(false);
  const [selectedSupplierForRaw, setSelectedSupplierForRaw] = useState<Supplier | null>(null);
  const [rawCategory, setRawCategory] = useState<string>('BAMBOO');
  const [rawItemName, setRawItemName] = useState<string>('ဝါးပိုးဝါး (ဝါးလုံး)');
  const [rawQuantity, setRawQuantity] = useState<number>(30);
  const [rawUnit, setRawUnit] = useState<string>('လုံး');
  const [rawUnitPrice, setRawUnitPrice] = useState<number>(3500);
  const [rawNotes, setRawNotes] = useState<string>('');

  // Refresh presets on modal open
  useEffect(() => {
    if (isRawMaterialModalOpen) {
      const stored = getStoredRawMaterialPresets();
      setPresets(stored);
    }
  }, [isRawMaterialModalOpen]);

  const [isRepayModalOpen, setIsRepayModalOpen] = useState<boolean>(false);
  const [selectedSupplierForRepay, setSelectedSupplierForRepay] = useState<Supplier | null>(null);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayMethod, setRepayMethod] = useState<PaymentMethod>('CASH');
  const [repayNotes, setRepayNotes] = useState<string>('');

  const [name, setName] = useState<string>('');
  const [village, setVillage] = useState<string>('မင်းနန်သူ');
  const [phone, setPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [initialAdvance, setInitialAdvance] = useState<number>(0);

  const villages = useMemo(() => {
    const set = new Set<string>();
    (suppliers || []).forEach((s) => {
      if (s && s.village) set.add(s.village);
    });
    return Array.from(set);
  }, [suppliers]);

  const kpis = useMemo(() => {
    let totalAdvance = 0;
    let totalPaidInAdvances = 0;
    let totalGoodsProcured = 0;
    let advanceHolderCount = 0;
    (suppliers || []).forEach((s) => {
      if (!s) return;
      totalAdvance += s.currentAdvanceBalance || 0;
      totalPaidInAdvances += s.totalAdvancesGiven || 0;
      totalGoodsProcured += s.totalGoodsDeliveredValue || 0;
      if ((s.currentAdvanceBalance || 0) > 0) advanceHolderCount++;
    });
    return {
      totalAdvance,
      totalPaidInAdvances,
      totalGoodsProcured,
      advanceHolderCount,
      totalSuppliers: (suppliers || []).length,
    };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    return (suppliers || []).filter((s) => {
      if (!s) return false;
      const matchesSearch =
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.village || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.includes(searchQuery));
      const matchesVillage = selectedVillage === 'all' || s.village === selectedVillage;
      let matchesBalance = true;
      if (balanceFilter === 'has_advance') matchesBalance = (s.currentAdvanceBalance || 0) > 0;
      if (balanceFilter === 'cleared') matchesBalance = (s.currentAdvanceBalance || 0) === 0;
      return matchesSearch && matchesVillage && matchesBalance;
    });
  }, [suppliers, searchQuery, selectedVillage, balanceFilter]);

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setVillage(s.village);
    setPhone(s.phone || '');
    setNotes(s.notes || '');
    setInitialAdvance(s.currentAdvanceBalance || 0);
    setIsAddModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setVillage('မင်းနန်သူ');
    setPhone('');
    setNotes('');
    setInitialAdvance(0);
    setIsAddModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingSupplier) {
      const updated: Supplier = {
        ...editingSupplier,
        name: name.trim(),
        village: village.trim() || 'မင်းနန်သူ',
        phone: phone.trim() || '-',
        notes: notes.trim(),
        updatedAt: getTodayDateString(),
      };
      onUpdateSupplier(updated);
    } else {
      const newS: Supplier = {
        id: `s-${Date.now()}`,
        code: `RK-${String(suppliers.length + 1).padStart(3, '0')}`,
        name: name.trim(),
        village: village.trim() || 'မင်းနန်သူ',
        phone: phone.trim() || '-',
        notes: notes.trim(),
        currentAdvanceBalance: initialAdvance || 0,
        totalAdvancesGiven: initialAdvance || 0,
        totalGoodsDeliveredValue: 0,
        createdAt: getTodayDateString(),
        updatedAt: getTodayDateString(),
      };
      onAddSupplier(newS);
    }
    setIsAddModalOpen(false);
  };

  const handleConfirmRawMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForRaw || rawQuantity <= 0 || rawUnitPrice <= 0) return;

    const totalRawVal = rawQuantity * rawUnitPrice;
    const prevBalance = selectedSupplierForRaw.currentAdvanceBalance || 0;
    const newBalance = prevBalance + totalRawVal;

    const rawItem: RawMaterialItem = {
      id: `raw-${Date.now()}`,
      category: rawCategory,
      name: rawItemName.trim(),
      quantity: rawQuantity,
      unit: rawUnit.trim(),
      unitPrice: rawUnitPrice,
      totalValue: totalRawVal,
    };

    const isCashAdv = rawCategory === 'CASH_ADVANCE';
    const newTx: TransactionRecord = {
      id: `tx-raw-${Date.now()}`,
      voucherNo: `${isCashAdv ? 'ADV' : 'RAW'}-${Date.now().toString().slice(-4)}`,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      supplierId: selectedSupplierForRaw.id,
      supplierName: selectedSupplierForRaw.name,
      supplierVillage: selectedSupplierForRaw.village,
      type: isCashAdv ? 'ADVANCE_ONLY' : 'RAW_MATERIAL_CREDIT',
      items: [
        {
          productId: rawItem.id,
          productName: `[${isCashAdv ? 'ငွေကြိုထုတ်' : 'ကုန်ကြမ်း'}] ${rawItem.name}`,
          quantity: rawItem.quantity,
          unit: rawItem.unit,
          unitPrice: rawItem.unitPrice,
          subtotal: rawItem.totalValue,
        },
      ],
      rawMaterialItems: isCashAdv ? [] : [rawItem],
      totalGoodsValue: 0,
      previousAdvanceBalance: prevBalance,
      advanceDeducted: 0,
      newAdvanceTaken: totalRawVal,
      newAdvanceReason: isCashAdv
        ? (rawNotes.trim() || `ငွေသားကြိုတင်ထုတ်ယူငွေ - ${formatMMK(totalRawVal)}`)
        : `ကြိုတင်ထုတ်ပေးသော ကုန်ကြမ်းဖိုး - ${rawItem.name} (${rawItem.quantity} ${rawItem.unit})`,
      cashPaidToSupplier: isCashAdv ? totalRawVal : 0,
      netCashPaidToSupplier: isCashAdv ? totalRawVal : 0,
      remainingAdvanceBalance: newBalance,
      notes: rawNotes.trim() || (isCashAdv ? 'ငွေသားကြိုထုတ်' : 'ကုန်ကြမ်းကြိုထုတ်'),
    };

    const updatedSupplier: Supplier = {
      ...selectedSupplierForRaw,
      currentAdvanceBalance: newBalance,
      totalAdvancesGiven: (selectedSupplierForRaw.totalAdvancesGiven || 0) + totalRawVal,
      updatedAt: getTodayDateString(),
    };

    if (onAddTransaction) {
      onAddTransaction(newTx);
    }
    onUpdateSupplier(updatedSupplier);

    setIsRawMaterialModalOpen(false);
    setSelectedSupplierForRaw(null);
    setRawQuantity(50);
    setRawUnitPrice(3500);
    setRawNotes('');
  };

  const handleConfirmRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForRepay || repayAmount <= 0) return;

    const prevBalance = selectedSupplierForRepay.currentAdvanceBalance || 0;
    const newBalance = Math.max(0, prevBalance - repayAmount);

    const newTx: TransactionRecord = {
      id: `tx-repay-${Date.now()}`,
      voucherNo: `RPY-${Date.now().toString().slice(-4)}`,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      supplierId: selectedSupplierForRepay.id,
      supplierName: selectedSupplierForRepay.name,
      supplierVillage: selectedSupplierForRepay.village,
      type: 'SUPPLIER_REPAYMENT',
      items: [],
      totalGoodsValue: 0,
      previousAdvanceBalance: prevBalance,
      advanceDeducted: repayAmount,
      cashRepaymentReceived: repayAmount,
      paymentMethod: repayMethod,
      newAdvanceTaken: 0,
      netCashPaidToSupplier: 0,
      remainingAdvanceBalance: newBalance,
      notes: repayNotes.trim() || `ကုန်ပစ္စည်းပေးသွင်းသူမှ အကြိုငွေ ပြန်လည်ဆပ် (${repayMethod})`,
    };

    const updatedSupplier: Supplier = {
      ...selectedSupplierForRepay,
      currentAdvanceBalance: newBalance,
      updatedAt: getTodayDateString(),
    };

    if (onAddTransaction) {
      onAddTransaction(newTx);
    }
    onUpdateSupplier(updatedSupplier);

    setIsRepayModalOpen(false);
    setSelectedSupplierForRepay(null);
    setRepayAmount(0);
    setRepayNotes('');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ကုန်ပစ္စည်းပေးသွင်းသူများ စာရင်း
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  {suppliers.length} ဦး
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                ရွာအလိုက် ကုန်ပစ္စည်းပေးသွင်းသူများ၊ အကြိုငွေလက်ကျန်နှင့် ပစ္စည်းပေးသွင်းမှု
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenDeletedHistory && (
            <button
              type="button"
              onClick={onOpenDeletedHistory}
              className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer border border-rose-800/60 transition-colors"
              title="အမှိုက်ပုံးကြည့်မည်"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>အမှိုက်ပုံး ({deletedRecordsCount})</span>
            </button>
          )}
          {onOpenExcelImport && (
            <button
              type="button"
              onClick={onOpenExcelImport}
              className="px-3.5 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-600/60 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel ဖြင့် သွင်းမည်</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ ပေးသွင်းသူအသစ်</span>
          </button>
          <button
            type="button"
            onClick={() => exportSuppliersCSV(filteredSuppliers)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer transition-colors"
            title="Excel/CSV ထုတ်မည်"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">လက်ကျန်အကြိုငွေ စုစုပေါင်း</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-rose-800 truncate">
            {formatMMK(kpis.totalAdvance)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {kpis.advanceHolderCount} ဦး လက်ဝယ်ရှိနေသည်
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ထုတ်ပေးပြီး အကြိုငွေ စုစုပေါင်း</span>
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
            {formatMMK(kpis.totalPaidInAdvances)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            စာရင်းစတင်ချိန်မှ ယနေ့ထိ
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">သိမ်းဆည်းပြီး ကုန်တန်ဖိုး စုစုပေါင်း</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-800 truncate">
            {formatMMK(kpis.totalGoodsProcured)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ယွန်းထည်ပစ္စည်း ရရှိမှုတန်ဖိုး
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ကုန်ပစ္စည်းပေးသွင်းသူ စုစုပေါင်း</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {kpis.totalSuppliers} <span className="text-xs font-normal text-slate-500">ဦး</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {villages.length} ရွာရှိသည်
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ကုန်ပစ္စည်းပေးသွင်းသူအမည် / ရွာ / ဖုန်းနံပါတ်ဖြင့် ရှာမည်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedVillage('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                selectedVillage === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ရွာအားလုံး
            </button>
            {villages.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSelectedVillage(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedVillage === v
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <MapPin className="w-3 h-3 inline mr-1" />
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBalanceFilter('all')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                balanceFilter === 'all' ? 'bg-slate-200 font-bold text-slate-900' : 'hover:bg-slate-100'
              }`}
            >
              အားလုံး
            </button>
            <button
              type="button"
              onClick={() => setBalanceFilter('has_advance')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                balanceFilter === 'has_advance' ? 'bg-rose-100 font-bold text-rose-900' : 'hover:bg-slate-100'
              }`}
            >
              အကြိုငွေကျန်ရှိသူ ({kpis.advanceHolderCount})
            </button>
            <button
              type="button"
              onClick={() => setBalanceFilter('cleared')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                balanceFilter === 'cleared' ? 'bg-emerald-100 font-bold text-emerald-900' : 'hover:bg-slate-100'
              }`}
            >
              ကျေပြီးသူ
            </button>
          </div>
          <span>
            တွေ့ရှိသူ <strong className="text-slate-800">{filteredSuppliers.length}</strong> ဦး
          </span>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredSuppliers.slice(0, displayLimit).map((supplier) => {
          const hasAdvance = (supplier.currentAdvanceBalance || 0) > 0;
          const supplierTxCount = transactions.filter((t) => t.supplierId === supplier.id).length;

          return (
            <div
              key={supplier.id}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-900 font-extrabold flex items-center justify-center text-sm shrink-0">
                      {supplier.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
                        {supplier.name}
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono font-normal">
                          {supplier.code}
                        </span>
                      </h3>
                      <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full font-bold inline-flex items-center gap-1 mt-0.5 border border-emerald-200">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        {supplier.village}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(supplier)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                      title="အချက်အလက်ပြင်မည်"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteSupplier && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`ကုန်ပစ္စည်းပေးသွင်းသူ "${supplier.name}" (${supplier.village}) ကို အမှိုက်ပုံးသို့ ရွှေ့လိုပါသလား?\n\n(မှားဖျက်မိပါက အမှိုက်ပုံးမှ ပြန်လည်ရယူနိုင်ပါသည်)`)) {
                            onDeleteSupplier(supplier.id);
                          }
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg cursor-pointer transition-colors"
                        title="ဖျက်မည် (Delete to Recycle Bin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supplier.phone || '-'}</span>
                  </div>
                  {supplier.notes && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {supplier.notes}
                    </div>
                  )}
                </div>

                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between mb-2.5 ${
                    hasAdvance
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div>
                    <span className="text-[10px] text-slate-500 block">လက်ကျန်အကြိုငွေ (Advance)</span>
                    <span
                      className={`text-base font-extrabold ${
                        hasAdvance ? 'text-rose-800' : 'text-emerald-800'
                      }`}
                    >
                      {formatMMK(supplier.currentAdvanceBalance || 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasAdvance && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierForRepay(supplier);
                          setRepayAmount(supplier.currentAdvanceBalance || 0);
                          setIsRepayModalOpen(true);
                        }}
                        className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer"
                        title="အကြိုငွေ ပြန်ဆပ်ငွေလက်ခံမည်"
                      >
                        ငွေဆပ်
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplierForRaw(supplier);
                        setIsRawMaterialModalOpen(true);
                      }}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer flex items-center gap-1"
                      title="ဝါး / ကြိမ် ကုန်ကြမ်းကြိုထုတ်ပေးမည်"
                    >
                      <Layers className="w-3 h-3" />
                      <span>ကုန်ကြမ်း</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] py-1.5 px-2 bg-slate-50 rounded border border-slate-100 text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block">စုစုပေါင်းအကြိုငွေ:</span>
                    <span className="font-bold text-slate-800">{formatMMK(supplier.totalAdvancesGiven || 0)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">သိမ်းပြီးကုန်တန်ဖိုး:</span>
                    <span className="font-bold text-emerald-700">{formatMMK(supplier.totalGoodsDeliveredValue || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => onViewSupplierLedger(supplier)}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-emerald-600" />
                  <span>စာရင်းချုပ် ({supplierTxCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenNewEntryWithSupplier(supplier.id)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>ကုန်သိမ်းမည်</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls for Large Scale Datasets */}
      {filteredSuppliers.length > displayLimit && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 mt-2 text-xs">
          <span className="text-slate-600">
            စုစုပေါင်း <strong>{filteredSuppliers.length}</strong> ဦးအနက် <strong>{displayLimit}</strong> ဦး ပြသထားပါသည်
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => prev + 36)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              နောက်ထပ် ၃၆ ဦး ကြည့်မည် (+36)
            </button>
            <button
              type="button"
              onClick={() => setDisplayLimit(filteredSuppliers.length)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors"
            >
              အားလုံးကြည့်မည် ({filteredSuppliers.length})
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  {editingSupplier ? 'ကုန်ပစ္စည်းပေးသွင်းသူ ပြင်ဆင်ခြင်း' : 'ကုန်ပစ္စည်းပေးသွင်းသူအသစ် ထည့်သွင်းခြင်း'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်ပစ္စည်းပေးသွင်းသူအမည် *</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ဦးဘတင်"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ရွာအမည် *</label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - မင်းနန်သူ"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ဖုန်းနံပါတ်</label>
                  <input
                    type="text"
                    placeholder="09-..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              {!editingSupplier && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    စတင်ချိန် လက်ကျန်အကြိုငွေ (ရှိလျှင်)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={initialAdvance === 0 ? '' : initialAdvance}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const cleanStr = e.target.value.replace(/^0+(?=\d)/, '');
                      const val = cleanStr === '' ? 0 : parseInt(cleanStr, 10);
                      setInitialAdvance(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက် / အလုပ်ရုံ</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ကွမ်းအစ် အထူးကျွမ်းကျင်"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  သိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raw Material Credit Modal */}
      {isRawMaterialModalOpen && selectedSupplierForRaw && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-amber-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm font-bold">ဝါး/ကြိမ် ကုန်ကြမ်းကြိုထုတ်ပေးခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRawMaterialModalOpen(false)}
                className="w-7 h-7 rounded-full bg-amber-800 hover:bg-amber-700 text-amber-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRawMaterial} className="p-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">ထုတ်ယူသူ ကုန်ပစ္စည်းပေးသွင်းသူ</span>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {selectedSupplierForRaw.name} ({selectedSupplierForRaw.village})
                </div>
                <span className="text-xs text-rose-700 font-bold block mt-1">
                  လက်ရှိအကြိုငွေ: {formatMMK(selectedSupplierForRaw.currentAdvanceBalance || 0)}
                </span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                      <span>အမျိုးအစား (Category)</span>
                    </label>
                    <select
                      value={rawCategory}
                      onChange={(e) => {
                        const cat = e.target.value;
                        setRawCategory(cat);
                        if (cat === 'CASH_ADVANCE') {
                          setRawItemName('ငွေသားကြိုထုတ် (Cash Advance)');
                          setRawUnit('ကျပ်');
                          setRawUnitPrice(1);
                          setRawQuantity(50000);
                        } else {
                          const catPresets = presets.filter((p) => p.category === cat);
                          if (catPresets.length > 0) {
                            const first = catPresets[0];
                            setRawItemName(first.name);
                            setRawUnit(first.defaultUnit || 'ခု');
                            setRawUnitPrice(first.defaultUnitPrice || 1000);
                            setRawQuantity(cat === 'BAMBOO' ? 30 : cat === 'RATTAN' ? 10 : 5);
                          } else if (cat === 'BAMBOO') {
                            setRawItemName('ဝါးပိုးဝါး (ဝါးလုံး)');
                            setRawUnit('လုံး');
                            setRawUnitPrice(3500);
                            setRawQuantity(30);
                          } else if (cat === 'RATTAN') {
                            setRawItemName('ကြိမ်လုံး (စည်း)');
                            setRawUnit('စည်း');
                            setRawUnitPrice(12000);
                            setRawQuantity(10);
                          } else {
                            setRawItemName('အခြားကုန်ကြမ်း');
                            setRawUnit('ခု');
                            setRawUnitPrice(1500);
                            setRawQuantity(5);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="BAMBOO">ဝါးကုန်ကြမ်း</option>
                      <option value="RATTAN">ကြိမ်ကုန်ကြမ်း</option>
                      <option value="CASH_ADVANCE">ငွေကြိုယူ</option>
                      <option value="OTHER">အခြားကုန်ကြမ်း</option>
                      {/* Show any custom categories from presets */}
                      {Array.from(new Set(presets.map((p) => String(p.category))))
                        .filter((c: string) => !['BAMBOO', 'RATTAN', 'CASH_ADVANCE', 'OTHER', 'LACQUER'].includes(c))
                        .map((c: string) => (
                          <option key={c} value={c}>
                            {presets.find((p) => p.category === c)?.categoryLabel || c}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                      <span>ပစ္စည်း အသင့်ရွေးရန်</span>
                    </label>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        if (val.startsWith('preset-')) {
                          const pId = val.replace('preset-', '');
                          const preset = presets.find((p) => p.id === pId);
                          if (preset) {
                            setRawItemName(preset.name);
                            setRawUnit(preset.defaultUnit);
                            setRawUnitPrice(preset.defaultUnitPrice);
                            if (preset.category === 'CASH_ADVANCE') {
                              setRawQuantity(50000);
                            }
                          }
                        } else if (val.startsWith('prod-')) {
                          const prodId = val.replace('prod-', '');
                          const prod = products.find((p) => p.id === prodId);
                          if (prod) {
                            setRawItemName(prod.name);
                            setRawUnit(prod.unit || 'ခု');
                            setRawUnitPrice(prod.buyPrice || prod.price || 3000);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-amber-50/70 border border-amber-300 rounded-lg font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- စာရင်းထဲမှ ရွေးချယ်နိုင်သည် --</option>
                      <optgroup label={`${rawCategory === 'BAMBOO' ? 'ဝါးကုန်ကြမ်း' : rawCategory === 'RATTAN' ? 'ကြိမ်ကုန်ကြမ်း' : rawCategory === 'CASH_ADVANCE' ? 'ငွေကြိုယူ' : 'အခြားကုန်ကြမ်း'} ပစ္စည်းများ`}>
                        {presets
                          .filter((p) => p.category === rawCategory)
                          .map((p) => (
                            <option key={p.id} value={`preset-${p.id}`}>
                              {p.name} ({p.defaultUnit} - {formatMMK(p.defaultUnitPrice)})
                            </option>
                          ))}
                      </optgroup>
                      {products && products.length > 0 && (
                        <optgroup label="ဆိုင် ကုန်ပစ္စည်းစာရင်းမှ ရွေးရန်">
                          {products.map((prod) => (
                            <option key={prod.id} value={`prod-${prod.id}`}>
                              {prod.name} ({prod.unit})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                    <span>ပစ္စည်းအမည် (သို့မဟုတ် စိတ်ကြိုက်ရိုက်ထည့်ပါ) *</span>
                    <span className="text-[10px] text-slate-400 font-normal">တိုက်ရိုက်ပြင်နိုင်ပါသည်</span>
                  </label>
                  <input
                    type="text"
                    value={rawItemName}
                    onChange={(e) => setRawItemName(e.target.value)}
                    placeholder="ဥပမာ - ဝါးပိုးဝါး (ဝါးလုံး) သို့မဟုတ် ငွေသားကြိုထုတ်"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />

                  {/* Quick Select Preset Chips */}
                  {presets.filter((p) => p.category === rawCategory).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {presets
                        .filter((p) => p.category === rawCategory)
                        .slice(0, 6)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setRawItemName(p.name);
                              setRawUnit(p.defaultUnit);
                              setRawUnitPrice(p.defaultUnitPrice);
                              if (p.category === 'CASH_ADVANCE') {
                                setRawQuantity(50000);
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                              rawItemName === p.name
                                ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {rawCategory === 'CASH_ADVANCE' ? (
                <div className="grid grid-cols-2 gap-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ကြိုယူငွေ ပမာဏ (ကျပ်) *</label>
                    <input
                      type="number"
                      min="1"
                      step="500"
                      value={rawQuantity === 0 ? '' : rawQuantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setRawQuantity(isNaN(val) ? 0 : Math.max(0, val));
                        setRawUnitPrice(1);
                        setRawUnit('ကျပ်');
                      }}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-extrabold text-slate-900 text-base"
                      placeholder="၅၀၀၀၀"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ယူနစ်</label>
                    <input
                      type="text"
                      value={rawUnit}
                      readOnly
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">အရေအတွက်</label>
                    <input
                      type="number"
                      min="1"
                      value={rawQuantity === 0 ? '' : rawQuantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setRawQuantity(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ယူနစ်</label>
                    <input
                      type="text"
                      value={rawUnit}
                      onChange={(e) => setRawUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">နှုန်း (ကျပ်)</label>
                    <input
                      type="number"
                      min="1"
                      value={rawUnitPrice === 0 ? '' : rawUnitPrice}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setRawUnitPrice(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="text-amber-900 font-medium block">
                    {rawCategory === 'CASH_ADVANCE' ? 'ကြိုထုတ်ငွေ စုစုပေါင်း:' : 'ကုန်ကြမ်းတန်ဖိုး စုစုပေါင်း:'}
                  </span>
                  <span className="text-[11px] text-amber-800">
                    အကြိုငွေဟောင်း: {formatMMK(selectedSupplierForRaw.currentAdvanceBalance || 0)} + {formatMMK(rawQuantity * rawUnitPrice)}
                  </span>
                </div>
                <span className="text-base font-black text-amber-950">
                  {formatMMK(rawQuantity * rawUnitPrice)}
                </span>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ဝါးနှီးစိတ်ရန်အတွက် ထုတ်ယူ"
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRawMaterialModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  {rawCategory === 'CASH_ADVANCE' ? 'ငွေကြိုယူငွေ စာရင်းသွင်းမည်' : 'အကြိုငွေစာရင်းတိုး၍ ထုတ်ပေးမည်'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Repay Modal */}
      {isRepayModalOpen && selectedSupplierForRepay && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">ကုန်ပစ္စည်းပေးသွင်းသူ အကြိုငွေ ပြန်ဆပ်ခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRepayModalOpen(false)}
                className="w-7 h-7 rounded-full bg-emerald-800 hover:bg-emerald-700 text-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRepayment} className="p-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">ကုန်ပစ္စည်းပေးသွင်းသူ</span>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {selectedSupplierForRepay.name} ({selectedSupplierForRepay.village})
                </div>
                <span className="text-xs text-rose-700 font-bold block mt-1">
                  လက်ရှိကျန်ငွေ: {formatMMK(selectedSupplierForRepay.currentAdvanceBalance || 0)}
                </span>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ပြန်လည်ပေးဆပ်ငွေ (ကျပ်) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  max={selectedSupplierForRepay.currentAdvanceBalance || 0}
                  value={repayAmount === 0 ? '' : repayAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const cleanStr = e.target.value.replace(/^0+(?=\d)/, '');
                    const val = cleanStr === '' ? 0 : parseInt(cleanStr, 10);
                    setRepayAmount(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base font-extrabold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">ငွေပေးချေမှုပုံစံ</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepayMethod('CASH')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer ${
                      repayMethod === 'CASH'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    လက်ငင်း
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayMethod('KPAY')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer ${
                      repayMethod === 'KPAY'
                        ? 'bg-blue-50 text-blue-800 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    KPay
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayMethod('WAVE')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer ${
                      repayMethod === 'WAVE'
                        ? 'bg-amber-50 text-amber-800 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    Wave
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ကုန်ပစ္စည်းမအပ်နိုင်၍ ငွေသားပြန်ဆပ်"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRepayModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  အကြိုငွေမှ နုတ်ယူရှင်းတမ်းထုတ်မည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
