import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  RotateCcw,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { AppLockSettings } from '../types';
import { verifyOwnerPin } from '../services/cryptoSecurity';

interface RevertLiveStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRevert: (pin: string) => Promise<void> | void;
  appLockSettings?: AppLockSettings | null;
}

export const RevertLiveStatusModal: React.FC<RevertLiveStatusModalProps> = ({
  isOpen,
  onClose,
  onConfirmRevert,
  appLockSettings,
}) => {
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [doubleConfirmed, setDoubleConfirmed] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setErrorMsg('');

    if (!doubleConfirmed) {
      setErrorMsg('လုံခြုံရေးသဘောတူညီချက်ကို အမှန်ခြစ်ပေးပါ');
      return;
    }

    if (!pin.trim()) {
      setErrorMsg('စကားဝှက် (PIN ၆ လုံး) ရိုက်ထည့်ပေးပါ');
      return;
    }

    setIsProcessing(true);
    try {
      const isValid = await verifyOwnerPin(pin.trim(), appLockSettings);
      if (!isValid) {
        setErrorMsg('စကားဝှက် (PIN) မှားယွင်းနေပါသည်။ ပုံသေ စကားဝှက်မှာ 123456 ဖြစ်ပါသည်');
        setIsProcessing(false);
        return;
      }

      await onConfirmRevert(pin.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Live Status ဖြုတ်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="revert-live-status-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-amber-300 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between border-b border-amber-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-black">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Live Status ယာယီဖြုတ်/ပြင်ဆင်ခြင်း
              </h3>
              <p className="text-xs font-semibold text-amber-100">
                ဆိုင်ဆက်တင်များနှင့် အစပျိုးစာရင်း ပြင်ဆင်ရန်
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-revert-live-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            title="ပိတ်မည်"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-slate-700">
            <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>အလိုအလျောက် ဒေတာ Backup ပြုလုပ်ပေးမည့် အာမခံချက်</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Live Status ကို ယာယီဖြုတ်လိုက်ပါက သင်၏ ဆိုင်အချက်အလက်၊ ကုန်သည်၊ ကုန်ကြမ်း၊ အစပျိုးစာရင်းများကို စိတ်ကြိုက် ပြန်လည်ပြင်ဆင်နိုင်မည် ဖြစ်ပါသည်။
            </p>
            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200 text-amber-900 font-bold text-[11px]">
              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>လက်ရှိ စာရင်းဒေတာအားလုံးကို အလိုအလျောက် Backup သိမ်းဆည်းပြီးမှသာ ဆောင်ရွက်ပေးပါမည်။</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              ဆိုင်ရှင် စကားဝှက် / PIN (၆ လုံး) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPin ? 'text' : 'password'}
                required
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="ဥပမာ - 123456"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-widest font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              စကားဝှက်မပြောင်းရသေးပါက ပုံသေစကားဝှက် <strong>123456</strong> ကို ရိုက်ထည့်နိုင်ပါသည်။
            </p>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={doubleConfirmed}
              onChange={(e) => setDoubleConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span className="text-[11px] font-semibold text-slate-700 leading-snug">
              Live Status ကို ယာယီဖြုတ်ပြီး ဆက်တင်များကို ပြင်ဆင်ရန် သဘောတူအတည်ပြုပါသည် (ပြင်ဆင်ပြီးပါက 'စတင်အသုံးပြုမည်' ဖြင့် Go-Live ပြန်လုပ်နိုင်ပါသည်)
            </span>
          </label>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isProcessing ? 'Backup ယူပြီး ဖြုတ်နေပါသည်...' : 'Live Status ယာယီဖြုတ်မည်'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
