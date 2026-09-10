import React, { useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { Logo } from './Logo';

interface ZeroSettingsConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmZeroReset: () => void;
  onLoadDemoData?: () => void;
}

export const ZeroSettingsConfirmModal: React.FC<ZeroSettingsConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmZeroReset,
  onLoadDemoData,
}) => {
  const [understood, setUnderstood] = useState<boolean>(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-500 text-slate-950 flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-950">
                အက်ပ်ကို လက်တွေ့ စတင်အသုံးပြုမည် (Zero Setting)
              </h3>
              <p className="text-xs font-semibold text-slate-800">
                လက်ကျန် သုည (၀)၊ ရရန်/ပေးရန် သုည (၀) စာရင်းသစ်ဖြင့် စတင်ခြင်း
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>သတိပြုရန် အချက်အလက်များ:</span>
            </div>
            <p className="text-slate-700">
              ဤခလုတ်ကို နှိပ်လိုက်ပါက လက်ရှိ စမ်းသပ်ထားသော နမူနာ အရောင်းအဝယ်မှတ်တမ်းများကို ရှင်းလင်းပေးပြီး လူကြီးမင်း၏ ဆိုင်တွင် လက်တွေ့နေ့စဉ် စာရင်းအသစ် စတင်ရေးသွင်းနိုင်ရန် <strong>Zero Setting</strong> သို့ ပြောင်းပေးမည်ဖြစ်ပါသည်။
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="font-bold text-slate-900 text-xs">
              အောက်ပါ အချက်အလက်များအားလုံး သုည (၀) သို့ အလိုအလျောက် သတ်မှတ်ပါမည်:
            </div>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>ကုန်လက်ကျန်များ (Stock):</strong> ပစ္စည်းအားလုံး၏ မူလလက်ကျန်နှင့် လက်ရှိလက်ကျန် အားလုံး = ၀ ဖြစ်သွားပါမည်။</span>
              </li>
              <li className="flex items-start gap-2 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>ကုန်ပစ္စည်းပေးသွင်းသူ အကြိုငွေ (Supplier Advance):</strong> ပေးရန်ကျန် အကြိုငွေ အားလုံး = ၀ ကျပ် ဖြစ်သွားပါမည်။</span>
              </li>
              <li className="flex items-start gap-2 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>ကုန်သည် ရရန်ငွေ (Merchant Receivable):</strong> ရရန်ကျန် အကြွေးငွေ အားလုံး = ၀ ကျပ် ဖြစ်သွားပါမည်။</span>
              </li>
              <li className="flex items-start gap-2 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>မှတ်တမ်းများ:</strong> ကုန်သိမ်းဘောင်ချာ၊ အရောင်းဘောင်ချာ၊ အော်ဒါမှတ်တမ်းများကို သုညဖြင့် စတင်နိုင်ရန် ရှင်းလင်းပေးပါမည်။</span>
              </li>
              <li className="flex items-start gap-2 text-blue-900 font-medium pt-1 border-t border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>ထိန်းသိမ်းပေးထားမည့်အရာ:</strong> ဆိုင်အမည်၊ ပိုင်ရှင်အမည်၊ ဖုန်း၊ ကုန်ပစ္စည်းအမည် ၁၅ မျိုးနှင့် ကုန်ပစ္စည်းပေးသွင်းသူ/ကုန်သည်အမည်များကို ပြန်ရိုက်စရာမလိုဘဲ အသင့်သုံးနိုင်ရန် ဆက်လက်ထားရှိပေးပါမည်။</span>
              </li>
            </ul>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span className="font-semibold text-slate-800 text-xs select-none">
              စာရင်းများကို သုည (Zero) ဖြင့် စတင်အသုံးပြုမည်ဖြစ်ကြောင်း သဘောတူပါသည်
            </span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {onLoadDemoData ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLoadDemoData();
              }}
              className="px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors w-full sm:w-auto justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>နမူနာဒေတာ ပြန်လည်ထည့်မည်</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="button"
              disabled={!understood}
              onClick={() => {
                onConfirmZeroReset();
                onClose();
              }}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-md transition-all ${
                understood
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>စာရင်းအားလုံး သုည သတ်မှတ်မည်</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
