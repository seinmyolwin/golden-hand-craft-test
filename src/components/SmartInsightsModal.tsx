import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  X,
  Package,
  Calendar,
  CheckCircle2,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';
import { Supplier, Product, SaleRecord, TransactionRecord } from '../types';

interface SmartInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Product[];
  sales: SaleRecord[];
  transactions: TransactionRecord[];
}

export const SmartInsightsModal: React.FC<SmartInsightsModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  products,
  sales,
  transactions,
}) => {
  if (!isOpen) return null;

  // 1. Calculate Top Selling Products
  const productSalesMap: { [prodId: string]: { name: string; qty: number; revenue: number } } = {};
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
      }
      productSalesMap[item.productId].qty += item.quantity;
      productSalesMap[item.productId].revenue += item.subtotal;
    });
  });

  const topSelling = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // 2. High-Risk Artisan Advances (Over 100,000 Ks or no delivery in recent transactions)
  const highRiskSuppliers = suppliers
    .filter((s) => s.currentAdvanceBalance > 50000)
    .sort((a, b) => b.currentAdvanceBalance - a.currentAdvanceBalance);

  // 3. Financial Totals
  const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
  const totalCashCollected = sales.reduce((sum, s) => sum + (s.cashPaidByMerchant || 0), 0);
  const totalReceivables = sales.reduce((sum, s) => sum + (s.remainingReceivableBalance || 0), 0);
  const totalAdvanceOutstanding = suppliers.reduce((sum, s) => sum + (s.currentAdvanceBalance || 0), 0);
  const totalInboundGoodsValue = transactions.reduce((sum, t) => sum + (t.totalGoodsValue || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center text-emerald-300">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>လုပ်ငန်းသုံး စမတ်သုံးသပ်ချက် (Smart Insights)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  100% Offline AI Logic
                </span>
              </h3>
              <p className="text-[11px] text-emerald-200">အရောင်းသွက်ကုန်ပစ္စည်းများ၊ ကုန်ပစ္စည်းပေးသွင်းသူကြိုငွေနှင့် ရာသီအလိုက် အကြံပြုချက်</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 bg-slate-50 flex-1">
          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 block">ရောင်းရငွေ စုစုပေါင်း</span>
              <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                {totalSalesRevenue.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">Ks</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                <ArrowUpRight className="w-3 h-3" />
                <span>{sales.length} ဘောင်ချာ</span>
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 block">လက်ခံရရှိငွေ (Cash In)</span>
              <span className="text-sm font-extrabold text-emerald-700 block mt-0.5">
                {totalCashCollected.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">Ks</span>
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">ကုန်သည်ပေးငွေ</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 block">ကုန်သည် ရရန်ကျန်ငွေ</span>
              <span className="text-sm font-extrabold text-amber-700 block mt-0.5">
                {totalReceivables.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">Ks</span>
              </span>
              <span className="text-[10px] text-amber-600 block mt-1 font-medium">လက်ကျန်ရရန်</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 block">ပေးသွင်းသူ အကြိုငွေတင်</span>
              <span className="text-sm font-extrabold text-rose-700 block mt-0.5">
                {totalAdvanceOutstanding.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">Ks</span>
              </span>
              <span className="text-[10px] text-rose-600 block mt-1 font-medium">လက်ကျန်အကြို</span>
            </div>
          </div>

          {/* Section 1: Top Selling Items */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>ရောင်းအားအကောင်းဆုံး ကုန်ပစ္စည်းများ (Top-Selling Crafts)</span>
              </h4>
              <span className="text-[10px] text-slate-500">စုစုပေါင်း ပစ္စည်း {products.length} မျိုး</span>
            </div>

            {topSelling.length > 0 ? (
              <div className="space-y-2">
                {topSelling.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{item.qty} ခု</span>
                      <span className="text-[10px] text-slate-500 block">({item.revenue.toLocaleString()} Ks)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">အရောင်းဘောင်ချာများ ဖွင့်လှစ်ပြီးပါက ရောင်းအားအကောင်းဆုံးစာရင်းကို ဤနေရာတွင် ပြသပါမည်။</p>
            )}
          </div>

          {/* Section 2: Artisan Advance Aging & Risk Alert */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>ကုန်ပစ္စည်းပေးသွင်းသူ အကြိုငွေစောင့်ကြည့်မှု (Advance Balance Watchlist)</span>
              </h4>
              <span className="text-[10px] text-rose-600 font-semibold">{highRiskSuppliers.length} ဦး</span>
            </div>

            {highRiskSuppliers.length > 0 ? (
              <div className="space-y-2">
                {highRiskSuppliers.slice(0, 4).map((sup) => (
                  <div
                    key={sup.id}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-rose-50/50 border border-rose-100"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{sup.name}</div>
                      <div className="text-[10px] text-slate-500">{sup.village || 'ရွာမသိ'} • {sup.craftType || 'ရိုးရာ'}</div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-rose-700 text-xs">
                        {sup.currentAdvanceBalance.toLocaleString()} Ks
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {sup.activeWorkOrderCount ? `လုပ်လက်စ ${sup.activeWorkOrderCount} ခု` : 'အကြိုငွေကျန်'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ကုန်ပစ္စည်းပေးသွင်းသူအားလုံးတွင် မြင့်မားသော အကြိုငွေတင်ကျန်မှု မရှိပါ။</span>
              </div>
            )}
          </div>

          {/* Section 3: Seasonal Business Tips */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>မြန်မာ့ရိုးရာ ယွန်းထည်/ဝါးနှီး ရာသီအလိုက် အရောင်းဆိုင်ရာ သတိပြုဖွယ်ရာများ:</span>
            </div>
            <ul className="list-disc list-inside text-slate-700 space-y-1 leading-relaxed">
              <li>
                <strong>သီတင်းကျွတ်/တန်ဆောင်တိုင် (စက်တင်ဘာ-နိုဝင်ဘာ):</strong> လူကြီးကန်တော့လက်ဆောင်အဖြစ် ယွန်းကွမ်းအစ်၊ ယွန်းဆွမ်းအုပ်၊ လက်ဖက်အုပ် အဝယ်လိုက်တတ်သဖြင့် ကုန်ချောကြိုတင်စုဆောင်းထားသင့်ပါသည်။
              </li>
              <li>
                <strong>ပုဂံဘုရားဖူးရာသီ (နိုဝင်ဘာ-ဖေဖော်ဝါရီ):</strong> ခရီးသွားအမှတ်တရပစ္စည်းများ (ဝါးခမောက်၊ အလှဆင်ယပ်တောင်၊ ယွန်းပန်းကန်ပြား) အရောင်းသွက်တတ်ပါသည်။
              </li>
              <li>
                <strong>ကုန်ကြမ်းရာသီ (မိုးနှောင်း-ဆောင်းဦး):</strong> မျှင်ဝါး၊ ဝါးပိုးဝါးနှင့် ကြိမ်အချောနှီးများ ဈေးကောင်းခိုက် ကုန်ကြမ်းကြိုထုတ်ပေးထားပါက ကုန်ပစ္စည်းပေးသွင်းသူများ အလုပ်မပြတ်အောင် ထိန်းထားနိုင်ပါသည်။
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-sm transition"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
