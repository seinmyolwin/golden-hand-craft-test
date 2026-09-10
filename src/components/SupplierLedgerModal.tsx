import React, { useMemo } from 'react';
import { Supplier, TransactionRecord } from '../types';
import { formatMMK, formatNumberOnly } from '../utils/storage';
import { X, Users, MapPin, Receipt, ArrowDownLeft, ArrowUpRight, DollarSign } from 'lucide-react';

interface SupplierLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  transactions: TransactionRecord[];
  onViewVoucher: (tx: TransactionRecord) => void;
}

export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({
  isOpen,
  onClose,
  supplier,
  transactions = [],
  onViewVoucher,
}) => {
  if (!isOpen || !supplier) return null;

  const supplierTransactions = useMemo(() => {
    return (transactions || [])
      .filter((t) => t && t.supplierId === supplier.id)
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [transactions, supplier.id]);

  const summary = useMemo(() => {
    let totalGoodsVal = 0;
    let totalDeducted = 0;
    let totalNewAdvances = 0;
    let totalCashReceived = 0;

    supplierTransactions.forEach((t) => {
      totalGoodsVal += t.totalGoodsValue || 0;
      totalDeducted += t.advanceDeducted || 0;
      totalNewAdvances += t.newAdvanceTaken || 0;
      totalCashReceived += t.netCashPaidToSupplier || 0;
    });

    return {
      totalGoodsVal,
      totalDeducted,
      totalNewAdvances,
      totalCashReceived,
      txCount: supplierTransactions.length,
    };
  }, [supplierTransactions]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                {supplier.name} ({supplier.village})
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200">
                  {supplier.code}
                </span>
              </h3>
              <p className="text-xs text-emerald-200">အကြိုငွေနှင့် ကုန်သိမ်းစာရင်းချုပ် စာအုပ်</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-emerald-800 hover:bg-emerald-700 text-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs shrink-0">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 block">လက်ကျန်အကြိုငွေ</span>
            <span className={`text-base font-extrabold ${supplier.currentAdvanceBalance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatMMK(supplier.currentAdvanceBalance)}
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 block">သိမ်းဆည်းပြီး ကုန်တန်ဖိုး</span>
            <span className="text-base font-extrabold text-slate-900">
              {formatMMK(summary.totalGoodsVal)}
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 block">အကြိုငွေမှ နုတ်ယူငွေ</span>
            <span className="text-base font-extrabold text-emerald-700">
              {formatMMK(summary.totalDeducted)}
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 block">အသစ်ထုတ်အကြိုငွေ</span>
            <span className="text-base font-extrabold text-amber-700">
              {formatMMK(summary.totalNewAdvances)}
            </span>
          </div>
        </div>

        {/* Transactions History */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <h4 className="font-bold text-xs text-slate-700 mb-2">
            ဘောင်ချာမှတ်တမ်းများ ({supplierTransactions.length} စောင်)
          </h4>

          {supplierTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              မှတ်တမ်း မရှိသေးပါ
            </div>
          ) : (
            supplierTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {tx.voucherNo}
                    </span>
                    <span className="text-xs text-slate-400">
                      {tx.date} ({tx.time})
                    </span>
                    {tx.type === 'RAW_MATERIAL_CREDIT' && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold">
                        ကုန်ကြမ်း
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1">
                    {tx.items && tx.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-1.5 py-0.2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded"
                      >
                        {it.productName}: <strong>{it.quantity} {it.unit}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right text-xs">
                    <span className="text-[10px] text-slate-400 block">လက်ကျန်ငွေ</span>
                    <span className={`font-bold ${tx.remainingAdvanceBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatMMK(tx.remainingAdvanceBalance)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewVoucher(tx)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ဘောင်ချာ</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
