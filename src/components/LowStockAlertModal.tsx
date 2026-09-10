import React from 'react';
import { Product } from '../types';
import { AlertTriangle, ArrowRight, ArrowDownLeft, X, Package, ShieldAlert } from 'lucide-react';

interface LowStockAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockProducts: { product: Product; currentStock: number; minStockAlert: number }[];
  onOpenNewEntryWithProduct?: (productId: string) => void;
  onGoToInventory?: () => void;
}

export const LowStockAlertModal: React.FC<LowStockAlertModalProps> = ({
  isOpen,
  onClose,
  lowStockProducts = [],
  onOpenNewEntryWithProduct,
  onGoToInventory,
}) => {
  if (!isOpen || lowStockProducts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-amber-300 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 bg-amber-600 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-1.5">
                <span>နောက်ထပ် ဦးစားပေးဝယ်ယူ/မှာယူရန် သတိပေးချက်</span>
                <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full">
                  {lowStockProducts.length} မျိုး
                </span>
              </h3>
              <p className="text-[11px] text-amber-100">
                သတ်မှတ် အနည်းဆုံးလက်ကျန်ထက် လျော့နည်းနေသော ကုန်ပစ္စည်းများ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-amber-700 hover:bg-amber-800 text-amber-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Low Stock Products */}
        <div className="p-4 space-y-3 text-xs max-h-[60vh] overflow-y-auto">
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
            အောက်ပါ ကုန်ပစ္စည်းများသည် ဆိုင်တွင် သတ်မှတ်ထားသော အနည်းဆုံးလက်ကျန် (Min Stock) ထက် နည်းပါးနေပါသဖြင့် ကုန်ပစ္စည်းပေးသွင်းသူများထံမှ အမြန်ဆုံး ထပ်မံကုန်သိမ်း/အပ်နှံရန် လိုအပ်ပါသည်:
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
            {lowStockProducts.map(({ product, currentStock, minStockAlert }) => {
              const shortfall = Math.max(0, minStockAlert - currentStock);
              return (
                <div key={product.id} className="p-3 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 hover:bg-amber-50/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{product.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                        {product.category || 'လက်မှုထည်'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-rose-700 font-extrabold">
                        လက်ရှိကျန်: {currentStock} {product.unit}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">
                        အနည်းဆုံးသတ်မှတ်ချက်: {minStockAlert} {product.unit}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                        လိုငွေ: {shortfall} {product.unit}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {onOpenNewEntryWithProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenNewEntryWithProduct(product.id);
                        }}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>ပေးသွင်းသူထံ ကုန်သိမ်းမည်</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          {onGoToInventory ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToInventory();
              }}
              className="px-3 py-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>လက်ကျန်ကုန်ပစ္စည်းစာရင်း ကြည့်မည်</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
