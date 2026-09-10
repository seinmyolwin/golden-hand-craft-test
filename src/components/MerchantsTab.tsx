import React, { useState, useMemo } from 'react';
import { Merchant, SaleRecord } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  exportMerchantsCSV,
  getTodayDateString,
} from '../utils/storage';
import {
  Building2,
  MapPin,
  Search,
  Plus,
  Phone,
  User,
  DollarSign,
  History,
  Download,
  CreditCard,
  X,
  Edit2,
  Trash2,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

interface MerchantsTabProps {
  merchants: Merchant[];
  sales: SaleRecord[];
  onAddMerchant: (merchant: Merchant) => void;
  onUpdateMerchant: (merchant: Merchant) => void;
  onOpenNewSaleForMerchant: (merchantId: string) => void;
  onViewMerchantHistory: (merchant: Merchant) => void;
  onDeleteMerchant?: (merchantId: string) => void;
  onOpenDeletedHistory?: () => void;
  deletedRecordsCount?: number;
  onOpenExcelImport?: () => void;
}

export const MerchantsTab: React.FC<MerchantsTabProps> = ({
  merchants = [],
  sales = [],
  onAddMerchant,
  onUpdateMerchant,
  onOpenNewSaleForMerchant,
  onViewMerchantHistory,
  onDeleteMerchant,
  onOpenDeletedHistory,
  deletedRecordsCount = 0,
  onOpenExcelImport,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTown, setSelectedTown] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'has_debt' | 'cleared'>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(36);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);

  // Reset display limit when filter changes for instant high performance
  React.useEffect(() => {
    setDisplayLimit(36);
  }, [searchQuery, selectedTown, balanceFilter]);

  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [settlingMerchant, setSettlingMerchant] = useState<Merchant | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNotes, setSettleNotes] = useState<string>('');

  const [name, setName] = useState<string>('');
  const [town, setTown] = useState<string>('မန္တလေး');
  const [phone, setPhone] = useState<string>('');
  const [ownerOrContact, setOwnerOrContact] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const towns = useMemo(() => {
    const set = new Set<string>();
    (merchants || []).forEach((m) => {
      if (m && m.town) set.add(m.town);
    });
    return Array.from(set);
  }, [merchants]);

  const kpis = useMemo(() => {
    let totalReceivable = 0;
    let totalPurchases = 0;
    let totalPaid = 0;
    let debtCount = 0;
    (merchants || []).forEach((m) => {
      if (!m) return;
      totalReceivable += m.currentReceivableBalance || 0;
      totalPurchases += m.totalPurchasesValue || 0;
      totalPaid += m.totalPaidAmount || 0;
      if ((m.currentReceivableBalance || 0) > 0) debtCount++;
    });
    return {
      totalReceivable,
      totalPurchases,
      totalPaid,
      debtCount,
      totalMerchants: (merchants || []).length,
    };
  }, [merchants]);

  const filteredMerchants = useMemo(() => {
    return (merchants || []).filter((m) => {
      if (!m) return false;
      const matchesSearch =
        (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.town || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.phone && m.phone.includes(searchQuery));
      const matchesTown = selectedTown === 'all' || m.town === selectedTown;
      let matchesBalance = true;
      if (balanceFilter === 'has_debt') matchesBalance = (m.currentReceivableBalance || 0) > 0;
      if (balanceFilter === 'cleared') matchesBalance = (m.currentReceivableBalance || 0) === 0;
      return matchesSearch && matchesTown && matchesBalance;
    });
  }, [merchants, searchQuery, selectedTown, balanceFilter]);

  const handleOpenEdit = (m: Merchant) => {
    setEditingMerchant(m);
    setName(m.name);
    setTown(m.town);
    setPhone(m.phone || '');
    setOwnerOrContact(m.ownerOrContact || '');
    setAddress(m.address || '');
    setNotes(m.notes || '');
    setIsAddModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingMerchant(null);
    setName('');
    setTown('မန္တလေး');
    setPhone('');
    setOwnerOrContact('');
    setAddress('');
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleSaveMerchant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingMerchant) {
      const updated: Merchant = {
        ...editingMerchant,
        name: name.trim(),
        town: town.trim() || 'မန္တလေး',
        phone: phone.trim() || '-',
        ownerOrContact: ownerOrContact.trim(),
        address: address.trim(),
        notes: notes.trim(),
        updatedAt: getTodayDateString(),
      };
      onUpdateMerchant(updated);
    } else {
      const newM: Merchant = {
        id: `m-${Date.now()}`,
        code: `M-${String(merchants.length + 1).padStart(3, '0')}`,
        name: name.trim(),
        town: town.trim() || 'မန္တလေး',
        phone: phone.trim() || '-',
        ownerOrContact: ownerOrContact.trim(),
        address: address.trim(),
        notes: notes.trim(),
        currentReceivableBalance: 0,
        totalPurchasesValue: 0,
        totalPaidAmount: 0,
        createdAt: getTodayDateString(),
        updatedAt: getTodayDateString(),
      };
      onAddMerchant(newM);
    }
    setIsAddModalOpen(false);
  };

  const handleSaveSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingMerchant || settleAmount <= 0) return;

    const newReceivable = Math.max(0, (settlingMerchant.currentReceivableBalance || 0) - settleAmount);
    const updatedMerchant: Merchant = {
      ...settlingMerchant,
      currentReceivableBalance: newReceivable,
      totalPaidAmount: (settlingMerchant.totalPaidAmount || 0) + settleAmount,
      notes: settleNotes.trim()
        ? `${settlingMerchant.notes || ''} | [${getTodayDateString()} ကြွေးဆပ်: ${formatNumberOnly(settleAmount)}]`
        : settlingMerchant.notes,
      updatedAt: getTodayDateString(),
    };

    onUpdateMerchant(updatedMerchant);
    setIsSettleModalOpen(false);
    setSettlingMerchant(null);
    setSettleAmount(0);
    setSettleNotes('');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ဖောက်သည်ကုန်သည်များ စာရင်း
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/50">
                  {merchants.length} ဦး
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                မြို့နယ်အလိုက် ကုန်သည်များ၊ ရရန်ကျန်ငွေနှင့် ငွေရှင်းမှတ်တမ်း
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
              className="px-3.5 py-2 bg-blue-900/80 hover:bg-blue-800 text-blue-200 border border-blue-700/60 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>Excel ဖြင့် သွင်းမည်</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ ကုန်သည်အသစ်</span>
          </button>
          <button
            type="button"
            onClick={() => exportMerchantsCSV(filteredMerchants)}
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
            <span className="font-semibold">ရရန်ကျန်ငွေ စုစုပေါင်း</span>
            <CreditCard className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-rose-800 truncate">
            {formatMMK(kpis.totalReceivable)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {kpis.debtCount} ဦး ကျန်ရှိနေသည်
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ဝယ်ယူပြီး စုစုပေါင်း</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
            {formatMMK(kpis.totalPurchases)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            စုစုပေါင်း ကုန်ဖိုးတန်ဖိုး
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ပေးချေပြီး စုစုပေါင်း</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-800 truncate">
            {formatMMK(kpis.totalPaid)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            လက်ငင်း/KPay ရှင်းငွေ
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ကုန်သည် စုစုပေါင်း</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {kpis.totalMerchants} <span className="text-xs font-normal text-slate-500">ဦး</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {towns.length} မြို့နယ်ရှိသည်
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
              placeholder="ကုန်သည်အမည် / မြို့နယ် / ဖုန်းနံပါတ်ဖြင့် ရှာမည်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedTown('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                selectedTown === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              အားလုံး
            </button>
            {towns.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTown(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedTown === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t}
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
              onClick={() => setBalanceFilter('has_debt')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                balanceFilter === 'has_debt' ? 'bg-rose-100 font-bold text-rose-900' : 'hover:bg-slate-100'
              }`}
            >
              ကျန်ငွေရှိသူ ({kpis.debtCount})
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
            တွေ့ရှိသူ <strong className="text-slate-800">{filteredMerchants.length}</strong> ဦး
          </span>
        </div>
      </div>

      {/* Merchants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredMerchants.slice(0, displayLimit).map((merchant) => {
          const hasDebt = (merchant.currentReceivableBalance || 0) > 0;
          const merchantSalesCount = sales.filter((s) => s.merchantId === merchant.id).length;

          return (
            <div
              key={merchant.id}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-900 font-extrabold flex items-center justify-center text-sm shrink-0">
                      {merchant.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
                        {merchant.name}
                      </h3>
                      <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-800 rounded-full font-bold inline-flex items-center gap-1 mt-0.5 border border-blue-200">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        {merchant.town}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(merchant)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                      title="အချက်အလက်ပြင်မည်"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteMerchant && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`ကုန်သည် "${merchant.name}" (${merchant.town}) ကို အမှိုက်ပုံးသို့ ရွှေ့လိုပါသလား?\n\n(မှားဖျက်မိပါက အမှိုက်ပုံးမှ ပြန်လည်ရယူနိုင်ပါသည်)`)) {
                            onDeleteMerchant(merchant.id);
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
                  {merchant.ownerOrContact && (
                    <div className="flex items-center gap-1.5 text-blue-900 font-semibold">
                      <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>ဆက်သွယ်ရန်: {merchant.ownerOrContact}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{merchant.phone || '-'}</span>
                  </div>
                  {merchant.address && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {merchant.address}
                    </div>
                  )}
                </div>

                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between mb-2.5 ${
                    hasDebt
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div>
                    <span className="text-[10px] text-slate-500 block">ရရန်ကျန်ငွေ (အကြွေး)</span>
                    <span
                      className={`text-base font-extrabold ${
                        hasDebt ? 'text-rose-800' : 'text-emerald-800'
                      }`}
                    >
                      {formatMMK(merchant.currentReceivableBalance || 0)}
                    </span>
                  </div>
                  {hasDebt ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSettlingMerchant(merchant);
                        setSettleAmount(merchant.currentReceivableBalance || 0);
                        setIsSettleModalOpen(true);
                      }}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer"
                    >
                      ငွေဆပ်စာရင်းသွင်း
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ကြွေးကျေပြီး
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] py-1.5 px-2 bg-slate-50 rounded border border-slate-100 text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block">စုစုပေါင်းဝယ်ယူမှု:</span>
                    <span className="font-bold text-slate-800">{formatMMK(merchant.totalPurchasesValue || 0)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">ပေးချေပြီးငွေ:</span>
                    <span className="font-bold text-emerald-700">{formatMMK(merchant.totalPaidAmount || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => onViewMerchantHistory(merchant)}
                  className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  <span>အရောင်းမှတ်တမ်း ({merchantSalesCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenNewSaleForMerchant(merchant.id)}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>အရောင်းဖွင့်</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls for Large Scale Datasets */}
      {filteredMerchants.length > displayLimit && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 mt-2 text-xs">
          <span className="text-slate-600">
            စုစုပေါင်း <strong>{filteredMerchants.length}</strong> ဦးအနက် <strong>{displayLimit}</strong> ဦး ပြသထားပါသည်
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => prev + 36)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              နောက်ထပ် ၃၆ ဦး ကြည့်မည် (+36)
            </button>
            <button
              type="button"
              onClick={() => setDisplayLimit(filteredMerchants.length)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors"
            >
              အားလုံးကြည့်မည် ({filteredMerchants.length})
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Merchant Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-300" />
                <h3 className="text-sm font-bold">
                  {editingMerchant ? 'ကုန်သည်အချက်အလက် ပြင်ဆင်ခြင်း' : 'ကုန်သည်အသစ် ထည့်သွင်းခြင်း'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-blue-800 hover:bg-blue-700 text-blue-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveMerchant} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်သည် / ဆိုင်အမည် *</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ရွှေမန္တလေး ယွန်းဆိုင်"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ပိုင်ရှင် သို့မဟုတ် ဆက်သွယ်ရမည့်သူ
                </label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ဒေါ်နွယ်နွယ်ဝင်း (ဆိုင်ပိုင်ရှင်)"
                  value={ownerOrContact}
                  onChange={(e) => setOwnerOrContact(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">မြို့နယ် *</label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - မန္တလေး"
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">လိပ်စာ / ကားဂိတ်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ၇၈ လမ်း၊ မန္တလေးရွှေမန်းသူ ကားဂိတ်ပို့"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - လစဥ်ပုံမှန်အော်ဒါရှိ"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  သိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {isSettleModalOpen && settlingMerchant && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">ကုန်သည် အကြွေးငွေရှင်းမည်</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="w-7 h-7 rounded-full bg-emerald-800 hover:bg-emerald-700 text-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSettlement} className="p-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">ကုန်သည်အမည်</span>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {settlingMerchant.name} ({settlingMerchant.town})
                </div>
                <span className="text-xs text-rose-700 font-bold block mt-1">
                  လက်ရှိရရန်ကျန်ငွေ: {formatMMK(settlingMerchant.currentReceivableBalance || 0)}
                </span>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ပေးဆပ်ငွေပမာဏ (ကျပ်) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  max={settlingMerchant.currentReceivableBalance || 0}
                  value={settleAmount === 0 ? '' : settleAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSettleAmount(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base font-extrabold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">ငွေရှင်းနည်းလမ်း / မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - KPay ဖြင့် လွှဲငွေရှင်းပြီး"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  ငွေလက်ခံပြီး စာရင်းသွင်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
