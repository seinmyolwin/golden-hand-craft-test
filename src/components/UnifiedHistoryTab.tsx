import React, { useState, useMemo } from 'react';
import { TransactionRecord, SaleRecord } from '../types';
import { formatMMK, formatNumberOnly } from '../utils/storage';
import {
  History,
  Search,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Download,
  Trash2,
} from 'lucide-react';

interface UnifiedHistoryTabProps {
  transactions: TransactionRecord[];
  sales: SaleRecord[];
  onViewInboundVoucher: (tx: TransactionRecord) => void;
  onViewSaleVoucher: (sale: SaleRecord) => void;
  onDeleteTransaction?: (txId: string) => void;
  onDeleteSale?: (saleId: string) => void;
}

export const UnifiedHistoryTab: React.FC<UnifiedHistoryTabProps> = ({
  transactions = [],
  sales = [],
  onViewInboundVoucher,
  onViewSaleVoucher,
  onDeleteTransaction,
  onDeleteSale,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');

  const unifiedList = useMemo(() => {
    const list: {
      id: string;
      date: string;
      time: string;
      type: 'INBOUND' | 'OUTBOUND';
      voucherNo: string;
      partyName: string;
      sublocation: string;
      itemsCount: number;
      totalValue: number;
      settledAmount: number;
      balance: number;
      originalItem: TransactionRecord | SaleRecord;
    }[] = [];

    (transactions || []).forEach((t) => {
      if (!t) return;
      const count = (t.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
      list.push({
        id: t.id,
        date: t.date,
        time: t.time,
        type: 'INBOUND',
        voucherNo: t.voucherNo,
        partyName: t.supplierName,
        sublocation: t.supplierVillage,
        itemsCount: count,
        totalValue: t.totalGoodsValue,
        settledAmount: t.advanceDeducted + t.netCashPaidToSupplier,
        balance: t.remainingAdvanceBalance,
        originalItem: t,
      });
    });

    (sales || []).forEach((s) => {
      if (!s) return;
      list.push({
        id: s.id,
        date: s.date,
        time: s.time,
        type: 'OUTBOUND',
        voucherNo: s.voucherNo,
        partyName: s.merchantName,
        sublocation: s.merchantTown,
        itemsCount: s.totalItemsCount,
        totalValue: s.grandTotal,
        settledAmount: s.cashPaidByMerchant,
        balance: s.remainingReceivableBalance,
        originalItem: s,
      });
    });

    return list.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [transactions, sales]);

  const filtered = useMemo(() => {
    return unifiedList.filter((item) => {
      const matchType = typeFilter === 'ALL' || item.type === typeFilter;
      const matchSearch =
        item.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sublocation.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }, [unifiedList, typeFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                လုပ်ငန်းမှတ်တမ်းပေါင်းချုပ် (Unified Timeline)
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {unifiedList.length} စောင်
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                ကုန်သိမ်းခြင်းနှင့် အရောင်းဘောင်ချာများအားလုံး အချိန်အလိုက် စီတန်းထားရှိမှု
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ဘောင်ချာနံပါတ် / ကုန်ပစ္စည်းပေးသွင်းသူ / ကုန်သည်အမည် / ရွာ / မြို့နယ်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                typeFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              အားလုံး ({unifiedList.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('INBOUND')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                typeFilter === 'INBOUND' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              ကုန်သိမ်း ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('OUTBOUND')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                typeFilter === 'OUTBOUND' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              အရောင်း ({sales.length})
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            မှတ်တမ်း မရှိသေးပါ
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    item.type === 'INBOUND'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {item.type === 'INBOUND' ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                        item.type === 'INBOUND'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {item.type === 'INBOUND' ? 'ကုန်သိမ်း' : 'အရောင်း'}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {item.voucherNo}
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.date} {item.time}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 mt-1">
                    {item.partyName}
                    <span className="text-xs text-slate-500 font-normal ml-1">
                      ({item.sublocation})
                    </span>
                  </h4>

                  <div className="text-xs text-slate-500 mt-0.5">
                    အရေအတွက်: <strong className="text-slate-700">{item.itemsCount} ထည်</strong> • စုစုပေါင်း: <strong className="text-slate-900">{formatMMK(item.totalValue)}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 ml-12 sm:ml-0">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">
                    {item.type === 'INBOUND' ? 'လက်ကျန်အကြိုငွေ' : 'ရရန်ကျန်ငွေ'}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-extrabold ${
                      item.balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatMMK(item.balance)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.type === 'INBOUND') {
                        onViewInboundVoucher(item.originalItem as TransactionRecord);
                      } else {
                        onViewSaleVoucher(item.originalItem as SaleRecord);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>ဘောင်ချာ</span>
                  </button>
                  {item.type === 'INBOUND' && onDeleteTransaction && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`ဘောင်ချာ ${item.voucherNo} ကို ဖျက်လိုပါသလား?`)) {
                          onDeleteTransaction(item.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.type === 'OUTBOUND' && onDeleteSale && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`ဘောင်ချာ ${item.voucherNo} ကို ဖျက်လိုပါသလား?`)) {
                          onDeleteSale(item.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
