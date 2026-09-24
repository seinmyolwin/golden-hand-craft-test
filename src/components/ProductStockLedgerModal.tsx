import React, { useState, useMemo } from 'react';
import {
  Product,
  TransactionRecord,
  SaleRecord,
  StockAdjustmentRecord,
  PeerTradeRecord,
  MerchantPurchaseRecord,
} from '../types';
import {
  calculateProductStockLedger,
  exportProductStockLedgerCSV,
  StockLedgerFilterOptions,
} from '../services/stockLedgerService';
import { formatMMK, formatNumberOnly } from '../utils/currency';
import {
  X,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Download,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Package,
  FileSpreadsheet,
  Building2,
  Store,
  RefreshCw,
} from 'lucide-react';

interface ProductStockLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  transactions: TransactionRecord[];
  sales: SaleRecord[];
  stockAdjustments: StockAdjustmentRecord[];
  merchantPurchases?: MerchantPurchaseRecord[];
  peerTrades?: PeerTradeRecord[];
  onOpenStockAdjust?: (product: Product) => void;
}

type DatePreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export const ProductStockLedgerModal: React.FC<ProductStockLedgerModalProps> = ({
  isOpen,
  onClose,
  product,
  transactions = [],
  sales = [],
  stockAdjustments = [],
  merchantPurchases = [],
  peerTrades = [],
  onOpenStockAdjust,
}) => {
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND' | 'PEER' | 'ADJUSTMENT' | 'DAMAGE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Compute date filter based on preset
  const dateRange = useMemo<{ start?: string; end?: string }>(() => {
    const today = new Date().toISOString().split('T')[0];
    if (datePreset === 'TODAY') {
      return { start: today, end: today };
    }
    if (datePreset === 'WEEK') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { start: d.toISOString().split('T')[0], end: today };
    }
    if (datePreset === 'MONTH') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { start: d.toISOString().split('T')[0], end: today };
    }
    if (datePreset === 'CUSTOM') {
      return { start: customStartDate || undefined, end: customEndDate || undefined };
    }
    return {};
  }, [datePreset, customStartDate, customEndDate]);

  const filterOptions: StockLedgerFilterOptions = useMemo(() => {
    return {
      startDate: dateRange.start,
      endDate: dateRange.end,
      movementTypeFilter: typeFilter,
      searchQuery: searchQuery.trim() || undefined,
    };
  }, [dateRange, typeFilter, searchQuery]);

  const ledgerSummary = useMemo(() => {
    if (!product) return null;
    return calculateProductStockLedger(
      product,
      transactions,
      sales,
      stockAdjustments,
      merchantPurchases,
      peerTrades,
      filterOptions
    );
  }, [product, transactions, sales, stockAdjustments, merchantPurchases, peerTrades, filterOptions]);

  if (!isOpen || !product || !ledgerSummary) return null;

  const handleExportCSV = () => {
    exportProductStockLedgerCSV(ledgerSummary);
  };

  const isOutOfStock = ledgerSummary.calculatedClosingBalance <= 0;
  const isLowStock =
    ledgerSummary.calculatedClosingBalance > 0 &&
    ledgerSummary.calculatedClosingBalance <= (product.minStockAlert || 10);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {product.name}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                  {product.category}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-semibold">
                  {product.unit}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                အသေးစိတ် ကုန်ပစ္စည်းအဝင်/အထွက် စာရင်းစာအုပ် (Detailed Stock Movement Ledger)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
              title="Excel / CSV အဖြစ် စာရင်းထုတ်ယူမည်"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel/CSV ထုတ်ယူမည်</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-3 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* Opening Balance */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 block">စတင်လက်ကျန်</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-black text-slate-800 font-mono">
                  {formatNumberOnly(ledgerSummary.openingBalance)}
                </span>
                <span className="text-xs text-slate-500 font-medium">{product.unit}</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">လုပ်ငန်းစတင်ချိန်</span>
            </div>

            {/* Total Inflow */}
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 block">စုစုပေါင်း အဝင် (+)</span>
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-black text-emerald-800 font-mono">
                  +{formatNumberOnly(ledgerSummary.totalInflowQty)}
                </span>
                <span className="text-xs text-emerald-700 font-medium">{product.unit}</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-medium block mt-0.5 truncate">
                {formatMMK(ledgerSummary.totalInflowValue)}
              </span>
            </div>

            {/* Total Outflow */}
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-blue-800 block">စုစုပေါင်း အထွက် (-)</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-black text-blue-800 font-mono">
                  -{formatNumberOnly(ledgerSummary.totalOutflowQty)}
                </span>
                <span className="text-xs text-blue-700 font-medium">{product.unit}</span>
              </div>
              <span className="text-[10px] text-blue-700 font-medium block mt-0.5 truncate">
                {formatMMK(ledgerSummary.totalOutflowValue)}
              </span>
            </div>

            {/* Net Adjustments */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 block">ညှိနှိုင်းမှုရလဒ် (+/-)</span>
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-black text-amber-800 font-mono">
                  {ledgerSummary.totalAdjustmentNetQty >= 0 ? '+' : ''}
                  {formatNumberOnly(ledgerSummary.totalAdjustmentNetQty)}
                </span>
                <span className="text-xs text-amber-700 font-medium">{product.unit}</span>
              </div>
              <span className="text-[10px] text-amber-700 font-medium block mt-0.5">လက်ကျန်ညှိ/ပျက်စီး</span>
            </div>

            {/* Current Closing Balance */}
            <div className={`col-span-2 sm:col-span-1 p-3 rounded-xl border ${
              isOutOfStock
                ? 'bg-rose-50 border-rose-300'
                : isLowStock
                ? 'bg-amber-50 border-amber-300'
                : 'bg-emerald-950 text-white border-emerald-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] sm:text-[11px] font-bold block ${isOutOfStock || isLowStock ? 'text-slate-800' : 'text-emerald-300'}`}>
                  လက်ရှိလက်ကျန်
                </span>
                {ledgerSummary.isBalanced ? (
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isOutOfStock || isLowStock ? 'text-emerald-600' : 'text-emerald-400'}`} title="စာရင်းကိုက်ညီပါသည်" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" title={`ကွာဟချက်: ${ledgerSummary.discrepancy}`} />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-lg sm:text-xl font-black font-mono ${
                  isOutOfStock ? 'text-rose-700' : isLowStock ? 'text-amber-700' : 'text-emerald-400'
                }`}>
                  {formatNumberOnly(ledgerSummary.calculatedClosingBalance)}
                </span>
                <span className={`text-xs font-medium ${isOutOfStock || isLowStock ? 'text-slate-600' : 'text-slate-300'}`}>
                  {product.unit}
                </span>
              </div>
              <span className={`text-[10px] font-semibold block mt-0.5 ${isOutOfStock || isLowStock ? 'text-slate-600' : 'text-slate-300'}`}>
                အရင်း: {formatMMK(ledgerSummary.currentStockCostValuation)}
              </span>
            </div>
          </div>

          {/* Balance Health Alert (if discrepancy exists) */}
          {!ledgerSummary.isBalanced && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>စာရင်းကွာဟချက် သတိပေးချက်:</strong> မှတ်တမ်းတင်လက်ကျန် (
                  {ledgerSummary.recordedCurrentStock}) နှင့် သမိုင်းအဝင်/အထွက်တွက်ချက်လက်ကျန် (
                  {ledgerSummary.calculatedClosingBalance}) တို့ ကွာဟချက်{' '}
                  <strong>{Math.abs(ledgerSummary.discrepancy)}</strong> ခု ရှိနေပါသည်။
                </span>
              </div>
              {onOpenStockAdjust && (
                <button
                  type="button"
                  onClick={() => onOpenStockAdjust(product)}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shrink-0 shadow-2xs cursor-pointer transition-colors"
                >
                  ယခု စာရင်းညှိမည်
                </button>
              )}
            </div>
          )}

          {/* Interactive Filter Toolbar */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
            {/* Movement Type Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                အားလုံး ({ledgerSummary.entriesCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('INBOUND')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === 'INBOUND'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                ကုန်သိမ်းအဝင် (+)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('OUTBOUND')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === 'OUTBOUND'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                အရောင်းအထွက် (-)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('PEER')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === 'PEER'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                မိတ်ဖက်ဆိုင် ချေးယူ/ငှား
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('ADJUSTMENT')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === 'ADJUSTMENT'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                လက်ကျန်ညှိနှိုင်းမှု
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('DAMAGE')}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === 'DAMAGE'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                ပျက်စီးစာရင်းထုတ်
              </button>
            </div>

            {/* Date Presets & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
                <span className="text-slate-500 font-semibold text-[11px] shrink-0">ရက်စွဲ:</span>
                {(['ALL', 'TODAY', 'WEEK', 'MONTH', 'CUSTOM'] as DatePreset[]).map((preset) => {
                  const labels: Record<DatePreset, string> = {
                    ALL: 'အားလုံး',
                    TODAY: 'ယနေ့',
                    WEEK: 'ပြီးခဲ့သော ၇ ရက်',
                    MONTH: 'ပြီးခဲ့သော ၃၀ ရက်',
                    CUSTOM: 'ရွေးချယ်မည်',
                  };
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDatePreset(preset)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        datePreset === preset
                          ? 'bg-slate-800 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {labels[preset]}
                    </button>
                  );
                })}
              </div>

              {/* Quick Search */}
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="ဘောင်ချာနံပါတ် / ဆက်စပ်သူ ရှာမည်..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Custom Date Inputs */}
            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 text-xs">
                <label className="text-slate-600 font-semibold">မှ:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                />
                <label className="text-slate-600 font-semibold">ထိ:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                />
              </div>
            )}
          </div>

          {/* Audit Ledger Movements Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                    <th className="py-2.5 px-3 text-center w-12">စဉ်</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ရက်စွဲ/အချိန်</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">လှုပ်ရှားမှုပုံစံ</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ဘောင်ချာအမှတ်</th>
                    <th className="py-2.5 px-3">ဆက်စပ်သူ / အကြောင်းအရာ</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap text-emerald-800">အဝင် (+)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap text-blue-800">အထွက် (-)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap text-slate-900 font-extrabold bg-slate-200/50">
                      လက်ကျန် (Running)
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">နှုန်း (ကျပ်)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">စုစုပေါင်းတန်ဖိုး</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {ledgerSummary.entries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span className="font-semibold block text-sm">ရှာဖွေမှုနှင့် ကိုက်ညီသော စာရင်းမှတ်တမ်း မရှိပါ</span>
                      </td>
                    </tr>
                  ) : (
                    ledgerSummary.entries.map((entry, idx) => {
                      const isIn = entry.signedQuantity > 0;
                      const isOut = entry.signedQuantity < 0;
                      const isInitial = entry.movementType === 'OPENING_BALANCE';
                      const isDamage = entry.movementType === 'DAMAGE_LOSS';

                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                            <div className="font-bold text-slate-800">{entry.date}</div>
                            <div className="text-[10px] text-slate-400">{entry.time}</div>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                isInitial
                                  ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                  : isDamage
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : isIn
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {entry.typeLabelMy}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-mono font-bold text-slate-700 text-[11px]">
                            {entry.referenceVoucherNo}
                          </td>
                          <td className="py-2 px-3 max-w-xs">
                            <div className="font-semibold text-slate-800 truncate" title={entry.counterpartName}>
                              {entry.counterpartName}
                            </div>
                            {entry.notes && (
                              <div className="text-[10px] text-slate-500 truncate" title={entry.notes}>
                                {entry.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {isIn ? `+${formatNumberOnly(entry.quantity)}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                            {isOut ? `-${formatNumberOnly(entry.quantity)}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-xs bg-slate-100/60 whitespace-nowrap">
                            {formatNumberOnly(entry.balanceAfter)} <span className="text-[10px] font-normal text-slate-500">{entry.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {entry.unitPrice ? formatMMK(entry.unitPrice) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 text-[11px] whitespace-nowrap">
                            {entry.totalValue ? formatMMK(entry.totalValue) : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              စုစုပေါင်း မှတ်တမ်း: <strong>{ledgerSummary.entries.length}</strong> ခု
            </span>
            <span>•</span>
            <span>
              ဝယ်စျေး: <strong>{formatMMK(product.defaultPrice)}</strong>
            </span>
            <span>•</span>
            <span>
              လက္ကားရောင်းစျေး: <strong>{formatMMK(product.defaultWholesalePrice || Math.round((product.defaultPrice || 0) * 1.25))}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportCSV}
              className="sm:hidden px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            {onOpenStockAdjust && (
              <button
                type="button"
                onClick={() => {
                  onOpenStockAdjust(product);
                  onClose();
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                <span>လက်ကျန်ညှိမည်</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
