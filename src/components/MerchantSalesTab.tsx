import React, { useState, useMemo } from 'react';
import { SaleRecord, Merchant, Product } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  exportMerchantSalesCSV,
  getTodayDateString,
} from '../utils/storage';
import {
  Truck,
  Search,
  Plus,
  Filter,
  Download,
  FileText,
  MapPin,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  CreditCard,
  Eye,
} from 'lucide-react';

interface MerchantSalesTabProps {
  sales: SaleRecord[];
  merchants: Merchant[];
  products: Product[];
  selectedDate?: string;
  inventoryStock?: any[];
  onOpenNewSale: () => void;
  onViewSaleVoucher: (sale: SaleRecord) => void;
  onDeleteSale?: (saleId: string) => void;
  onViewMerchantHistory?: (merchant: Merchant) => void;
}

export const MerchantSalesTab: React.FC<MerchantSalesTabProps> = ({
  sales = [],
  merchants = [],
  products: _products = [],
  selectedDate = '',
  inventoryStock: _inventoryStock,
  onOpenNewSale,
  onViewSaleVoucher,
  onDeleteSale: _onDeleteSale,
  onViewMerchantHistory: _onViewMerchantHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTown, setSelectedTown] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDate, setCustomDate] = useState<string>(selectedDate || getTodayDateString());

  const towns = useMemo(() => {
    const set = new Set<string>();
    (merchants || []).forEach((m) => {
      if (m && m.town) set.add(m.town);
    });
    (sales || []).forEach((s) => {
      if (s && s.merchantTown) set.add(s.merchantTown);
    });
    return Array.from(set);
  }, [merchants, sales]);

  const filteredSales = useMemo(() => {
    return (sales || []).filter((s) => {
      if (!s) return false;
      const matchesSearch =
        (s.merchantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.merchantTown || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.voucherNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.items || []).some((it) => (it?.productName || '').toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTown = selectedTown === 'all' || s.merchantTown === selectedTown;
      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = s.date === getTodayDateString();
      } else if (dateFilter === 'custom') {
        matchesDate = s.date === customDate;
      }
      return matchesSearch && matchesTown && matchesDate;
    });
  }, [sales, searchQuery, selectedTown, dateFilter, customDate]);

  const metrics = useMemo(() => {
    let totalSalesRevenue = 0;
    let totalCashReceived = 0;
    let totalOutstandingReceivable = 0;
    let totalPiecesSold = 0;

    (filteredSales || []).forEach((s) => {
      if (!s) return;
      totalSalesRevenue += s.grandTotal || 0;
      totalCashReceived += s.cashPaidByMerchant || 0;
      totalOutstandingReceivable += s.remainingReceivableBalance || 0;
      totalPiecesSold += s.totalItemsCount || 0;
    });

    return {
      totalSalesRevenue,
      totalCashReceived,
      totalOutstandingReceivable,
      totalPiecesSold,
      salesCount: (filteredSales || []).length,
    };
  }, [filteredSales]);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ကုန်သည်အရောင်းနှင့် ဘောင်ချာများ
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/50">
                  {sales.length} စောင်
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                မြို့နယ်အသီးသီးရှိ ကုန်သည်များထံ လက်ကားဖြန့်ချိမှုနှင့် ရရန်ကျန်ငွေ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewSale}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ အရောင်းဖွင့်မည်</span>
          </button>
          <button
            type="button"
            onClick={() => exportMerchantSalesCSV(filteredSales)}
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
            <span className="font-semibold">အရောင်းတန်ဖိုး စုစုပေါင်း</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
            {formatMMK(metrics.totalSalesRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.salesCount} စောင် ရောင်းချပြီး
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ရရှိပြီးငွေ</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-800 truncate">
            {formatMMK(metrics.totalCashReceived)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            လက်ငင်း/KPay ရှင်းငွေ
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ရောင်းချပြီး ကုန်အရေအတွက်</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {formatNumberOnly(metrics.totalPiecesSold)} <span className="text-xs font-normal text-slate-500">ထည်</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ကားတင်ပို့ပြီး ကုန်ပစ္စည်းများ
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ကုန်သည်များထံ ရရန်ကျန်ငွေ</span>
            <CreditCard className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-rose-800 truncate">
            {formatMMK(
              merchants.reduce((sum, m) => sum + (m.currentReceivableBalance || 0), 0)
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            အကြွေးကျန်ရှိသူ {merchants.filter((m) => m.currentReceivableBalance > 0).length} ဦး
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ဘောင်ချာနံပါတ် / ကုန်သည်အမည် / မြို့နယ်ဖြင့် ရှာမည်..."
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
              မြို့နယ်အားလုံး
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
                <MapPin className="w-3 h-3 inline mr-1" />
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                dateFilter === 'all' ? 'bg-slate-200 font-bold text-slate-900' : 'hover:bg-slate-100'
              }`}
            >
              ရက်စွဲအားလုံး
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                dateFilter === 'today' ? 'bg-blue-100 font-bold text-blue-900' : 'hover:bg-slate-100'
              }`}
            >
              ယနေ့
            </button>
          </div>
          <span>
            အရောင်းစာရင်း <strong className="text-slate-800">{filteredSales.length}</strong> စောင်
          </span>
        </div>
      </div>

      {/* Sales Transactions List */}
      <div className="space-y-3">
        {filteredSales.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">အရောင်းမှတ်တမ်း မရှိသေးပါ</p>
            <button
              type="button"
              onClick={onOpenNewSale}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>အရောင်းဘောင်ချာဖွင့်မည်</span>
            </button>
          </div>
        ) : (
          filteredSales.map((sale) => (
            <div
              key={sale.id}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-blue-300 transition-all space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 font-extrabold rounded text-xs">
                    {sale.voucherNo}
                  </span>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {sale.date} • {sale.time}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewSaleVoucher(sale)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>ဘောင်ချာကြည့်မည်</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0">
                    {sale.merchantName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                      {sale.merchantName}
                      <span className="text-[11px] px-2 py-0.5 bg-white border border-slate-200 text-blue-700 rounded-full font-bold">
                        <MapPin className="w-3 h-3 inline mr-0.5" />
                        {sale.merchantTown}
                      </span>
                    </h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">ကျသင့်ငွေ စုစုပေါင်း</span>
                  <span className="text-base font-extrabold text-blue-900">
                    {formatMMK(sale.grandTotal)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-[11px] text-slate-500 font-medium">
                  ကုန်ပစ္စည်းများ ({sale.totalItemsCount} ထည်)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {sale.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-100/70 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="font-bold text-slate-800">
                        {item.productName}
                        <span className="text-slate-500 font-normal ml-1">
                          ({item.quantity} {item.unit})
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900">
                        {formatNumberOnly(item.subtotal)} Ks
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <div className="text-slate-600">
                    ပေးငွေ:{' '}
                    <strong className="text-emerald-700">{formatMMK(sale.cashPaidByMerchant)}</strong>
                  </div>
                  <div className="text-slate-600">
                    ရရန်ကျန်:{' '}
                    <strong
                      className={
                        sale.remainingReceivableBalance > 0
                          ? 'text-rose-700 font-bold'
                          : 'text-slate-800'
                      }
                    >
                      {formatMMK(sale.remainingReceivableBalance)}
                    </strong>
                  </div>
                </div>
                {sale.notes && (
                  <div className="text-[11px] text-slate-500 italic truncate max-w-xs">
                    မှတ်ချက်: {sale.notes}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
