import React from 'react';
import { X, Sparkles, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

interface UpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  newVersion?: string;
  isChecking?: boolean;
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
  newVersion = 'v2.5.0',
  isChecking = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 border border-slate-200">
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700/80 flex items-center justify-center text-amber-300">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">စနစ် ဗားရှင်းအသစ် ရရှိနိုင်ပါပြီ</h3>
              <p className="text-[11px] text-emerald-200">ဗားရှင်း {newVersion} အဆင့်မြှင့်တင်ရန်</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-emerald-950/60 hover:bg-emerald-900 text-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>ဗားရှင်းအသစ်တွင် ပါဝင်သော ပြင်ဆင်ချက်များ -</span>
            </div>
            <ul className="space-y-1.5 pl-6 list-disc text-[11px] text-slate-700">
              <li>ဖုန်း/တက်ဘလက် နောက်သို့ခလုတ် (Back Key) နိပ်ပါက အက်ပ်မှ မထွက်ပဲ အရင်ကြည့်ခဲ့သော စာမျက်နှာနှင့် ဒက်ရှ်ဘုတ်သို့ ပြန်ရောက်ခြင်း။</li>
              <li>Refresh လုပ်ပါက အက်ပ်မှ ပြန်မထွက်တော့ပဲ ဖွင့်လက်စ စာမျက်နှာတွင် ဆက်လက်ရှိနေခြင်း။</li>
              <li>အရောင်းဘောင်ချာဖွင့်ရာတွင် ကုန်သည်စာရင်း ရှာဖွေရွေးချယ်မှု ပိုမိုလွယ်ကူမြန်ဆန်လာခြင်း။</li>
              <li>စနစ်မြန်ဆန်မှုနှင့် အော့ဖ်လိုင်းဒေတာ လုံခြုံမှု တိုးမြှင့်ထားခြင်း။</li>
            </ul>
          </div>

          <p className="text-slate-600 leading-relaxed text-[11px]">
            ဗားရှင်းအသစ်ကို ချက်ချင်းအသုံးပြုနိုင်ရန် အောက်ပါ <strong>&ldquo;ယခု Update လုပ်မည်&rdquo;</strong> ခလုတ်ကို နှိပ်ပါ။ ဒေတာနှင့် စာရင်းများ ပျက်ပြယ်သွားခြင်း မရှိပါ။
          </p>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer text-xs"
            >
              ခဏနေမှ
            </button>
            <button
              type="button"
              disabled={isChecking}
              onClick={onUpdate}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Update စစ်ဆေးနေပါသည်...' : 'ယခု Update လုပ်မည်'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
