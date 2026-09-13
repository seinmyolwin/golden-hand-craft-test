import React, { useState } from 'react';
import {
  X,
  AlertOctagon,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AppLockSettings } from '../types';
import { verifyOwnerPin } from '../services/cryptoSecurity';

interface DemoReloadConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReload: () => Promise<void> | void;
  appLockSettings?: AppLockSettings | null;
}

export const DemoReloadConfirmModal: React.FC<DemoReloadConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmReload,
  appLockSettings,
}) => {
  const [doubleConfirmed, setDoubleConfirmed] = useState<boolean>(false);
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const hasConfiguredPin = Boolean(
    appLockSettings?.pinHash || appLockSettings?.passcode || appLockSettings?.pin
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setErrorMsg('');

    if (!doubleConfirmed) {
      setErrorMsg('ဒေတာအားလုံး ပျက်စီးနိုင်သည်ကို သဘောတူကြောင်း အမှန်ခြစ်ပေးပါ');
      return;
    }

    setIsProcessing(true);
    try {
      if (hasConfiguredPin) {
        if (!ownerPin.trim()) {
          setErrorMsg('ဆိုင်ရှင် PIN ရိုက်ထည့်ပေးပါ');
          setIsProcessing(false);
          return;
        }

        const isValid = await verifyOwnerPin(ownerPin.trim(), appLockSettings);
        if (!isValid) {
          setErrorMsg('ဆိုင်ရှင် PIN မှားယွင်းနေပါသည်။ နမူနာဒေတာ ပြန်လည်ထည့်သွင်းခွင့် မရှိပါ');
          setIsProcessing(false);
          return;
        }
      }

      await onConfirmReload();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'နမူနာဒေတာ ထည့်သွင်းရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="demo-reload-confirm-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-red-300 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-red-600 text-white flex items-center justify-between border-b border-red-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-black">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                နမူနာဒေတာ ပြန်လည်ထည့်သွင်းခြင်း
              </h3>
              <p className="text-xs font-semibold text-red-100">
                Go-Live ဒေတာများ ပျက်စီးနိုင်ခြေ အသိပေးချက်
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-demo-reload-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-700">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2 text-red-900">
            <div className="flex items-center gap-2 font-bold text-sm text-red-800">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>အရေးကြီးသော သတိပေးချက်:</span>
            </div>
            <p className="leading-relaxed">
              လက်ရှိစနစ်သည် <strong>Go-Live (လက်တွေ့သုံး)</strong> အဖြစ် စတင်အသုံးပြုနေပြီ ဖြစ်ပါသည်။ နမူနာဒေတာ ပြန်လည်ထည့်သွင်းပါက လက်ရှိရေးသွင်းထားသော စာရင်းအစစ်အမှန်များ အားလုံး ပျက်စီးပြီး နမူနာဒေတာများဖြင့် အစားထိုးသွားပါမည်။
            </p>
          </div>

          {hasConfiguredPin && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2 border border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>ဆိုင်ရှင် PIN (Owner PIN) ဖြင့် အတည်ပြုပါ</span>
              </div>
              <div className="relative">
                <input
                  id="reload-demo-owner-pin-input"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="ဆိုင်ရှင် PIN ရိုက်ထည့်ပါ"
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm tracking-widest focus:outline-none focus:border-red-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="pt-1">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-300 cursor-pointer select-none">
              <input
                id="reload-demo-double-confirm-checkbox"
                type="checkbox"
                checked={doubleConfirmed}
                onChange={(e) => setDoubleConfirmed(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer mt-0.5 accent-red-600"
              />
              <span className="font-bold text-red-950 text-xs leading-snug">
                ဒေတာအားလုံး ပျက်စီးနိုင်သည်, သေချာပါသည် (နမူနာဒေတာဖြင့် အစားထိုးရန် အတည်ပြုပါသည်)
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              id="cancel-demo-reload-btn"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              id="confirm-demo-reload-btn"
              disabled={!doubleConfirmed || (hasConfiguredPin && !ownerPin.trim()) || isProcessing}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-md transition-all ${
                doubleConfirmed && (!hasConfiguredPin || ownerPin.trim()) && !isProcessing
                  ? 'bg-red-600 hover:bg-red-500 text-white active:scale-95'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isProcessing ? 'ဆောင်ရွက်နေပါသည်...' : 'နမူနာဒေတာ အစားထိုးမည်'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
