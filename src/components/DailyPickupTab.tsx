import React, { useState, useMemo } from 'react';
import { Supplier, Product, TransactionRecord, DailySummary, MerchantOrder } from '../types';
import { formatMMK, formatNumberOnly, computeDailySummary, exportDailyCollectionCSV } from '../utils/storage';
import {
  Truck,
  CheckCircle2,
  Clock,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Download,
  Plus,
  Trash2,
  Receipt,
  MapPin,
  Bell,
  Eye,
  ArrowRight,
  X,
} from 'lucide-react';

interface DailyPickupTabProps {
  selectedDate: string;
  suppliers: Supplier[];
  products: Product[];
  transactions: TransactionRecord[];
  onOpenNewEntryWithSupplier: (supplierId: string) => void;
  onOpenNewEntry: () => void;
  onViewVoucher: (tx: TransactionRecord) => void;
  onDeleteTransaction: (txId: string) => void;
  pendingOrders?: MerchantOrder[];
  onNavigateToOrders?: () => void;
  onOpenOrderNotificationModal?: (order: MerchantOrder) => void;
}

export const DailyPickupTab: React.FC<DailyPickupTabProps> = ({
  selectedDate,
  suppliers = [],
  products = [],
  transactions = [],
  onOpenNewEntryWithSupplier,
  onOpenNewEntry,
  onViewVoucher,
  onDeleteTransaction,
  pendingOrders = [],
  onNavigateToOrders,
  onOpenOrderNotificationModal,
}) => {
  const [filterVillage, setFilterVillage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOrderBannerDismissed, setIsOrderBannerDismissed] = useState<boolean>(false);

  const summary: DailySummary = useMemo(() => {
    return computeDailySummary(selectedDate, transactions || [], products || []);
  }, [selectedDate, transactions, products]);

  const todayTransactions = useMemo(() => {
    return (transactions || []).filter((t) => t && t.date === selectedDate);
  }, [transactions, selectedDate]);

  const visitedSupplierIds = useMemo(() => {
    return new Set(todayTransactions.map((t) => t.supplierId));
  }, [todayTransactions]);

  const villages = useMemo(() => {
    const vSet = new Set<string>();
    (suppliers || []).forEach((s) => {
      if (s && s.village) vSet.add(s.village);
    });
    return Array.from(vSet);
  }, [suppliers]);

  const routeSuppliers = useMemo(() => {
    return (suppliers || []).filter((s) => {
      if (!s) return false;
      const matchVillage = filterVillage === 'all' || s.village === filterVillage;
      const matchQuery =
        !searchQuery.trim() ||
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.village || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchVillage && matchQuery;
    });
  }, [suppliers, filterVillage, searchQuery]);

  const latestPendingOrder = pendingOrders && pendingOrders.length > 0 ? pendingOrders[0] : null;

  return (
    <div className="space-y-4 pb-20">
      {/* New Orders Alert Notification Banner on Main Home Screen */}
      {pendingOrders && pendingOrders.length > 0 && !isOrderBannerDismissed && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white rounded-2xl p-3.5 sm:p-4 shadow-lg border border-indigo-500/40 relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                <Bell className="w-5 h-5 stroke-[2.5] animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wide">
                    New Order Alert
                  </span>
                  <span className="text-xs text-indigo-200 font-bold">
                    ဆောင်ရွက်ရန်ကျန် အော်ဒါ ({pendingOrders.length}) စောင် ရှိပါသည်
                  </span>
                </div>
                {latestPendingOrder && (
                  <p className="text-xs sm:text-sm font-semibold text-white mt-1">
                    နောက်ဆုံးအော်ဒါ - <span className="text-amber-300 font-bold">{latestPendingOrder.merchantName} ({latestPendingOrder.merchantTown})</span>: {latestPendingOrder.items.length} မျိုး ({latestPendingOrder.items.reduce((s, it) => s + (it.quantity || 0), 0)} ထည်)
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {latestPendingOrder && onOpenOrderNotificationModal && (
                <button
                  id="main-order-alert-detail-btn"
                  type="button"
                  onClick={() => onOpenOrderNotificationModal(latestPendingOrder)}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-950 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>အသေးစိတ်</span>
                </button>
              )}
              {onNavigateToOrders && (
                <button
                  id="main-order-alert-list-btn"
                  type="button"
                  onClick={onNavigateToOrders}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>အော်ဒါများ ({pendingOrders.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOrderBannerDismissed(true)}
                className="text-indigo-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="ပိတ်မည်"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner & Daily Summary Cards */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                နေ့စဥ် ကုန်သိမ်းစာရင်းချုပ်
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ရက်စွဲ - {selectedDate} (ကုန်ပစ္စည်းပေးသွင်းသူ: {visitedSupplierIds.size} / {suppliers.length} ဦး သွားရောက်ပြီး)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {todayTransactions.length > 0 && (
              <button
                type="button"
                onClick={() => exportDailyCollectionCSV(selectedDate, transactions)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 cursor-pointer border border-slate-700 transition-colors"
                title="Excel / CSV ထုတ်ယူမည်"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Excel ထုတ်မည်</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenNewEntry}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ ကုန်သိမ်းမည်</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80">
            <span className="text-[11px] text-slate-400 block font-medium">သိမ်းဆည်းကုန်စုစုပေါင်း</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-white">{summary.totalGoodsCount}</span>
              <span className="text-xs text-slate-400">ထည်</span>
            </div>
            <span className="text-xs text-emerald-400 font-semibold block mt-0.5">
              {formatMMK(summary.totalGoodsValue)}
            </span>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80">
            <span className="text-[11px] text-emerald-400 block font-medium flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              အကြိုငွေမှ နုတ်ယူငွေ
            </span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-300 block mt-1">
              {formatMMK(summary.totalAdvanceDeducted)}
            </span>
            <span className="text-[10px] text-slate-400">ကျေပြီးငွေစာရင်း</span>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80">
            <span className="text-[11px] text-amber-400 block font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              အကြိုငွေအသစ် ထုတ်ပေးငွေ
            </span>
            <span className="text-base sm:text-lg font-extrabold text-amber-300 block mt-1">
              {formatMMK(summary.totalNewAdvanceGiven)}
            </span>
            <span className="text-[10px] text-slate-400">စာရင်းသစ်တိုး</span>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80">
            <span className="text-[11px] text-sky-400 block font-medium">လက်ငင်းအပိုပေးငွေ</span>
            <span className="text-base sm:text-lg font-extrabold text-sky-300 block mt-1">
              {formatMMK(summary.totalCashPaid)}
            </span>
            <span className="text-[10px] text-slate-400">ရှင်းပေးငွေ</span>
          </div>
        </div>
      </div>

      {/* Today's Loaded Items Breakdown */}
      {Object.keys(summary.itemCounts).length > 0 && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs sm:text-sm">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>ယနေ့ ကားပေါ်တင်ပြီး ကုန်ပစ္စည်းများ ({summary.totalGoodsCount} ထည်)</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">အမျိုးအလိုက် စာရင်း</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(summary.itemCounts).map(([_, item]) => (
              <div
                key={item.name}
                className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between"
              >
                <span className="font-semibold text-xs text-slate-900 truncate">{item.name}</span>
                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-emerald-800">
                    {item.count} {item.unit}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {formatNumberOnly(item.totalValue)} ကျပ်
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Collection Timeline / Vouchers List */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs sm:text-sm">
            <Clock className="w-4 h-4 text-slate-600" />
            <span>ယနေ့ ကုန်သိမ်းဘောင်ချာများ ({todayTransactions.length} စောင်)</span>
          </div>
        </div>

        {todayTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
            <Truck className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">ယနေ့ ကုန်သိမ်းမှတ်တမ်း မရှိသေးပါ</p>
            <button
              type="button"
              onClick={onOpenNewEntry}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>ကုန်သိမ်းစာရင်းသွင်းမည်</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayTransactions.map((tx) => (
              <div
                key={tx.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {tx.time}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{tx.supplierName}</span>
                      <span className="text-[11px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-mono">
                        {tx.voucherNo}
                      </span>
                      {tx.type === 'RAW_MATERIAL_CREDIT' && (
                        <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-full border border-amber-300">
                          ဝါး/ကြိမ်ကုန်ကြမ်း
                        </span>
                      )}
                      {tx.type === 'SUPPLIER_REPAYMENT' && (
                        <span className="text-[10px] px-2 py-0.5 bg-teal-100 text-teal-900 font-bold rounded-full border border-teal-300">
                          ငွေပြန်ဆပ်
                        </span>
                      )}
                    </div>
                    {/* Items chips */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tx.items && tx.items.map((it, idx) => (
                        <span
                          key={idx}
                          className={`text-[11px] px-1.5 py-0.5 rounded border ${
                            tx.type === 'RAW_MATERIAL_CREDIT'
                              ? 'bg-amber-50 text-amber-900 border-amber-300/80'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-200/80'
                          }`}
                        >
                          {it.productName}: <strong>{it.quantity} {it.unit}</strong>
                        </span>
                      ))}
                      {tx.type === 'SUPPLIER_REPAYMENT' && (
                        <span className="text-[11px] text-teal-800 font-medium">
                          ဆပ်ငွေ: {formatMMK(tx.cashRepaymentReceived || tx.advanceDeducted)} ({tx.paymentMethod === 'CASH' ? 'လက်ငင်း' : tx.paymentMethod || 'ငွေလွှဲ'})
                        </span>
                      )}
                      {(!tx.items || tx.items.length === 0) && tx.type !== 'SUPPLIER_REPAYMENT' && (
                        <span className="text-[11px] text-slate-500 italic">ပစ္စည်းမပါ (အကြိုငွေထုတ်)</span>
                      )}
                    </div>
                    {tx.newAdvanceReason && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        အကြိုငွေယူ: {formatMMK(tx.newAdvanceTaken)} ({tx.newAdvanceReason})
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 ml-11 sm:ml-0">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">လက်ကျန်အကြိုငွေ</span>
                    <span
                      className={`text-xs sm:text-sm font-extrabold ${
                        tx.remainingAdvanceBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatMMK(tx.remainingAdvanceBalance)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id={`view-voucher-${tx.id}`}
                      onClick={() => onViewVoucher(tx)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 text-xs font-semibold rounded-md border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                      title="ဘောင်ချာကြည့်မည်"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ဘောင်ချာ</span>
                    </button>
                    <button
                      type="button"
                      id={`delete-tx-${tx.id}`}
                      onClick={() => {
                        if (confirm(`ဘောင်ချာ ${tx.voucherNo} (${tx.supplierName}) ကို ဖျက်လိုပါသလား?`)) {
                          onDeleteTransaction(tx.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      title="ဖျက်မည်"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Route / Pickup Checklist */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>နယ်လှည့်ကုန်သိမ်းလမ်းကြောင်း ({routeSuppliers.length} ဦး)</span>
            </h3>
            <p className="text-xs text-slate-500">ရွာအလိုက် ကုန်ပစ္စည်းပေးသွင်းသူများထံ ကုန်သိမ်းရန် စာရင်း</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterVillage}
              onChange={(e) => setFilterVillage(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">ရွာအားလုံး ({suppliers.length})</option>
              {villages.map((v) => (
                <option key={v} value={v}>
                  {v} ({suppliers.filter((s) => s.village === v).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ကုန်ပစ္စည်းပေးသွင်းသူအမည် / ကုဒ်နံပါတ်ဖြင့် ရှာမည်..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
          />
        </div>

        {/* Supplier Route Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
          {routeSuppliers.map((s) => {
            const isVisitedToday = visitedSupplierIds.has(s.id);
            return (
              <div
                key={s.id}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                  isVisitedToday
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-slate-900 truncate">{s.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-mono">
                        {s.code}
                      </span>
                    </div>
                    {isVisitedToday ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        သိမ်းပြီး
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
                        မသိမ်းရသေး
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mb-2">
                    {s.village} {s.notes ? `• ${s.notes}` : ''}
                  </p>
                  <div className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-600">လက်ကျန်အကြိုငွေ:</span>
                    <span
                      className={`font-bold ${
                        s.currentAdvanceBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatMMK(s.currentAdvanceBalance)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {s.phone ? (
                    <a
                      href={`tel:${s.phone}`}
                      className="text-[11px] text-slate-600 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <span>ဖုန်း: {s.phone}</span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-400">ဖုန်းမရှိ</span>
                  )}
                  <button
                    type="button"
                    id={`route-collect-${s.id}`}
                    onClick={() => onOpenNewEntryWithSupplier(s.id)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-md flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>ကုန်သိမ်းမည်</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
