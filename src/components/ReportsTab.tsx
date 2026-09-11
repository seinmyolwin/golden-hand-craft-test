import React, { useState, useMemo } from 'react';
import {
  Supplier,
  Product,
  TransactionRecord,
  SaleRecord,
  Merchant,
  MerchantPurchaseRecord,
  ReturnRecord,
} from '../types';
import {
  formatMMK,
  formatNumberOnly,
  getTodayDateString,
  exportDailyCollectionCSV,
  exportMerchantSalesCSV,
} from '../utils/storage';
import {
  FileText,
  Calendar,
  Download,
  TrendingUp,
  DollarSign,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Layers,
  CheckCircle,
  Boxes,
  CreditCard,
  Wallet,
  RotateCcw,
} from 'lucide-react';

interface ReportsTabProps {
  suppliers: Supplier[];
  products: Product[];
  transactions: TransactionRecord[];
  sales: SaleRecord[];
  merchants: Merchant[];
  merchantPurchases?: MerchantPurchaseRecord[];
  returnsAndRefunds?: ReturnRecord[];
  onOpenCashLedger?: () => void;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  suppliers = [],
  products = [],
  transactions = [],
  sales = [],
  merchants = [],
  merchantPurchases = [],
  returnsAndRefunds = [],
  onOpenCashLedger,
}) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(getTodayDateString());

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((t) => t && t.date >= startDate && t.date <= endDate);
  }, [transactions, startDate, endDate]);

  const filteredSales = useMemo(() => {
    return (sales || []).filter((s) => s && s.date >= startDate && s.date <= endDate);
  }, [sales, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    return (merchantPurchases || []).filter((p) => p && p.date >= startDate && p.date <= endDate);
  }, [merchantPurchases, startDate, endDate]);

  const filteredReturns = useMemo(() => {
    return (returnsAndRefunds || []).filter(
      (r) => r && r.status === 'COMPLETED' && r.date >= startDate && r.date <= endDate
    );
  }, [returnsAndRefunds, startDate, endDate]);

  const stats = useMemo(() => {
    let goodsCollectedCount = 0;
    let goodsCollectedValue = 0;
    let advanceDeducted = 0;
    let newAdvanceGiven = 0;
    let cashPaidToSuppliers = 0;

    (filteredTransactions || []).forEach((t) => {
      (t.items || []).forEach((item) => {
        goodsCollectedCount += item.quantity || 0;
      });
      goodsCollectedValue += t.totalGoodsValue || 0;
      advanceDeducted += t.advanceDeducted || 0;
      newAdvanceGiven += t.newAdvanceTaken || 0;
      cashPaidToSuppliers += t.netCashPaidToSupplier || 0;
    });

    let goodsSoldCount = 0;
    let salesRevenue = 0;
    let salesCashReceived = 0;
    let salesCreditIssued = 0;

    (filteredSales || []).forEach((s) => {
      goodsSoldCount += s.totalItemsCount || 0;
      salesRevenue += s.grandTotal || 0;
      salesCashReceived += s.cashPaidByMerchant || 0;
      salesCreditIssued += s.remainingReceivableBalance || 0;
    });

    let rawMaterialTotalValue = 0;
    let rawMaterialCashPaid = 0;
    let rawMaterialPayable = 0;
    let rawMaterialItemCount = 0;

    (filteredPurchases || []).forEach((p) => {
      rawMaterialTotalValue += p.totalAmount || 0;
      rawMaterialCashPaid += p.paidAmount || 0;
      rawMaterialPayable += p.remainingPayableBalance || 0;
      (p.items || []).forEach((it) => {
        rawMaterialItemCount += it.quantity || 0;
      });
    });

    let totalSalesReturnValue = 0;
    let totalSalesCashRefunded = 0;
    let totalPurchaseReturnValue = 0;
    let totalPurchaseCashRecovered = 0;

    (filteredReturns || []).forEach((r) => {
      if (r.returnType === 'SALES_RETURN') {
        totalSalesReturnValue += r.totalRefundAmount || 0;
        totalSalesCashRefunded += r.cashRefundedAmount || 0;
      } else if (r.returnType === 'PURCHASE_RETURN') {
        totalPurchaseReturnValue += r.totalReturnAmount || 0;
        totalPurchaseCashRecovered += r.cashRecoveredAmount || 0;
      }
    });

    // Net Financial Figures
    const netSalesRevenue = salesRevenue - totalSalesReturnValue;
    const netSalesCashReceived = salesCashReceived - totalSalesCashRefunded;
    const netProcurementCost = (goodsCollectedValue + rawMaterialTotalValue) - totalPurchaseReturnValue;
    const netProfitEstimated = netSalesRevenue - netProcurementCost;
    const netCashFlow = netSalesCashReceived - cashPaidToSuppliers - (rawMaterialCashPaid - totalPurchaseCashRecovered);

    return {
      goodsCollectedCount,
      goodsCollectedValue,
      advanceDeducted,
      newAdvanceGiven,
      cashPaidToSuppliers,
      goodsSoldCount,
      salesRevenue,
      salesCashReceived,
      salesCreditIssued,
      rawMaterialTotalValue,
      rawMaterialCashPaid,
      rawMaterialPayable,
      rawMaterialItemCount,
      totalSalesReturnValue,
      totalSalesCashRefunded,
      totalPurchaseReturnValue,
      totalPurchaseCashRecovered,
      netSalesRevenue,
      netSalesCashReceived,
      netProcurementCost,
      netProfitEstimated,
      netCashFlow,
    };
  }, [filteredTransactions, filteredSales, filteredPurchases, filteredReturns]);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                ကာလအလိုက် လုပ်ငန်းဝင်ငွေ/ထွက်ငွေနှင့် ကုန်ကြမ်းစာရင်းရှင်းတမ်း
              </h2>
              <p className="text-xs text-slate-300">
                ရက်စွဲရွေးချယ်၍ ကုန်သိမ်း၊ ကုန်ကြမ်းဝယ်၊ အရောင်း၊ အမြတ်နှင့် လက်ငင်းငွေစီးဆင်းမှု စစ်ဆေးခြင်း
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenCashLedger && (
            <button
              type="button"
              onClick={onOpenCashLedger}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>ငွေစာရင်း & နေ့ချုပ်</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-lg border border-slate-700 text-xs">
            <Calendar className="w-3.5 h-3.5 text-purple-300" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            />
            <span className="text-slate-400">မှ</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">စုစုပေါင်း အရောင်းရငွေ</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-blue-900 truncate">
            {formatMMK(stats.salesRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ရောင်းချပြီး ကုန်ပစ္စည်း {stats.goodsSoldCount} ထည်
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ကုန်ကြမ်းဝယ်ယူစရိတ်</span>
            <Boxes className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-900 truncate">
            {formatMMK(stats.rawMaterialTotalValue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ဝါး/ကြိမ် အပါအဝင် ကုန်ကြမ်းဝယ်ယူငွေ
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">စုစုပေါင်း အရင်းကုန်ကျငွေ</span>
            <ArrowDownLeft className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
            {formatMMK(stats.totalProcurementCost)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            (ကုန်သိမ်း {formatMMK(stats.goodsCollectedValue)} + ကုန်ကြမ်း)
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ခန့်မှန်း အကြမ်းဖျင်းအမြတ်</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className={`text-lg sm:text-xl font-extrabold truncate ${stats.netProfitEstimated >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatMMK(stats.netProfitEstimated)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            အရောင်းရငွေ - စုစုပေါင်းကုန်ကျငွေ
          </p>
        </div>
      </div>

      {/* Cash Flow Balance Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-4 border border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-300 font-medium">လက်ငင်း ငွေသားစီးဆင်းမှု (True Net Cash Flow)</div>
              <div className="text-lg sm:text-xl font-black font-mono mt-0.5">
                {formatMMK(stats.netCashFlow)}
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-300 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700">
            <div>ရရှိငွေသား: <span className="text-emerald-400 font-bold">{formatMMK(stats.salesCashReceived)}</span></div>
            <div>ပေးချေငွေသား: <span className="text-rose-400 font-bold">{formatMMK(stats.cashPaidToSuppliers + stats.rawMaterialCashPaid)}</span></div>
          </div>
        </div>
      </div>

      {/* Three-column Analysis: Inbound, Raw Materials, Outbound */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inbound (Goods Collection) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <span>ကုန်ချောသိမ်းဆည်းမှု</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded">
              {filteredTransactions.length} ကြိမ်
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">သိမ်းဆည်းရရှိ ကုန်ထည်:</span>
              <strong className="text-slate-900">{stats.goodsCollectedCount} ထည်</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">စုစုပေါင်း ကုန်တန်ဖိုး:</span>
              <strong className="text-slate-900">{formatMMK(stats.goodsCollectedValue)}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">အကြိုငွေမှ နုတ်ယူငွေ:</span>
              <strong className="text-emerald-700">{formatMMK(stats.advanceDeducted)}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">အကြိုငွေအသစ် ထုတ်ပေးငွေ:</span>
              <strong className="text-amber-700">{formatMMK(stats.newAdvanceGiven)}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600">လက်ငင်းပေးချေငွေ:</span>
              <strong className="text-blue-700">{formatMMK(stats.cashPaidToSuppliers)}</strong>
            </div>
          </div>
        </div>

        {/* Raw Material Purchases */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-amber-600" />
              <span>ကုန်ကြမ်းဝယ်ယူမှု စာရင်း</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-800 rounded">
              {filteredPurchases.length} ကြိမ်
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">ကုန်ကြမ်း စုစုပေါင်းတန်ဖိုး:</span>
              <strong className="text-amber-900">{formatMMK(stats.rawMaterialTotalValue)}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">လက်ငင်းရှင်းပြီးငွေ:</span>
              <strong className="text-emerald-700">{formatMMK(stats.rawMaterialCashPaid)}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">ပေးသွင်းရန် ကျန်ငွေ (အကြွေး):</span>
              <strong className="text-rose-700">{formatMMK(stats.rawMaterialPayable)}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600">ဝယ်ယူပြီး ကုန်ကြမ်းအရေအတွက်:</span>
              <strong className="text-slate-900">{stats.rawMaterialItemCount} ခု</strong>
            </div>
          </div>
        </div>

        {/* Outbound (Sales) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>ကုန်သည် အရောင်းစာရင်း</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-800 rounded">
              {filteredSales.length} စောင်
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">အရောင်းဘောင်ချာ (Gross):</span>
              <strong className="text-blue-900">{formatMMK(stats.salesRevenue)}</strong>
            </div>
            {stats.totalSalesReturnValue > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-amber-700 font-medium">
                <span>(-) အရောင်းပြန်အပ် တန်ဖိုး:</span>
                <span>-{formatMMK(stats.totalSalesReturnValue)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100 font-bold bg-blue-50/50 px-1 rounded">
              <span className="text-blue-900">အသားတင် အရောင်းရငွေ (Net):</span>
              <strong className="text-blue-900">{formatMMK(stats.netSalesRevenue)}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">လက်ငင်း/လွှဲငွေ ရရှိငွေ:</span>
              <strong className="text-emerald-700">{formatMMK(stats.salesCashReceived)}</strong>
            </div>
            {stats.totalSalesCashRefunded > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                <span>(-) ဝယ်သူသို့ ပြန်အမ်းငွေ:</span>
                <span>-{formatMMK(stats.totalSalesCashRefunded)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">အကြွေးကျန်ငွေ ပေါင်း:</span>
              <strong className="text-rose-700">{formatMMK(stats.salesCreditIssued)}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600">ရောင်းချပြီး ကုန်ပစ္စည်း:</span>
              <strong className="text-slate-900">{stats.goodsSoldCount} ထည်</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 16: Returns & Refunds Detailed Breakdown Card */}
      <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                ပစ္စည်းပြန်အပ်နှင့် ငွေပြန်အမ်း/ပြန်ရ စာရင်း အကျဉ်းချုပ် (Phase 16 Returns)
              </h3>
              <p className="text-2xs text-slate-500">
                သီးခြား စတော့နှင့် ငွေသားစာရင်း ပြန်လည်ညှိနှိုင်းမှု စာရင်းများ
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
            {filteredReturns.length} ကြိမ် ဆောင်ရွက်ပြီး
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Sales Returns Summary */}
          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
            <div className="font-bold text-emerald-900 flex items-center justify-between">
              <span>အရောင်း ပြန်အပ်ခြင်း (Sales Returns)</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex justify-between text-slate-700 pt-1 border-t border-emerald-100">
              <span>ပြန်အပ်ပစ္စည်း စုစုပေါင်း တန်ဖိုး:</span>
              <strong className="font-mono text-emerald-800">{formatMMK(stats.totalSalesReturnValue)}</strong>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>ဝယ်သူသို့ လက်ငင်း ပြန်အမ်းငွေ:</span>
              <strong className="font-mono text-rose-700">{formatMMK(stats.totalSalesCashRefunded)}</strong>
            </div>
          </div>

          {/* Purchase Returns Summary */}
          <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
            <div className="font-bold text-blue-900 flex items-center justify-between">
              <span>ဝယ်ယူမှု ပြန်အပ်ခြင်း (Purchase Returns)</span>
              <ArrowUpRight className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex justify-between text-slate-700 pt-1 border-t border-blue-100">
              <span>ပြန်အပ်ကုန်ကြမ်း စုစုပေါင်း တန်ဖိုး:</span>
              <strong className="font-mono text-blue-800">{formatMMK(stats.totalPurchaseReturnValue)}</strong>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>ကုန်သည်/ဒိုင်ထံမှ ပြန်ရရှိငွေ:</span>
              <strong className="font-mono text-emerald-700">{formatMMK(stats.totalPurchaseCashRecovered)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
