import React, { useState } from 'react';
import { AppLockSettings } from '../types';
import { generateRecoveryKey } from '../utils/storage';
import {
  X,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  Save,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react';

interface AppLockSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appLockSettings: AppLockSettings;
  onSave: (updated: AppLockSettings) => void;
  onLockNow: () => void;
}

export const AppLockSettingsModal: React.FC<AppLockSettingsModalProps> = ({
  isOpen,
  onClose,
  appLockSettings,
  onSave,
  onLockNow,
}) => {
  const [enabled, setEnabled] = useState<boolean>(appLockSettings.enabled ?? false);
  const [passcode, setPasscode] = useState<string>(
    appLockSettings.passcode || appLockSettings.pin || ''
  );
  const [recoveryKey, setRecoveryKey] = useState<string>(() => {
    return appLockSettings.recoveryKey || generateRecoveryKey();
  });
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRegenerateRecoveryKey = () => {
    if (confirm('Recovery Key အသစ် ထုတ်ယူလိုပါသလား? ယခင်ကီး အသုံးမပြုနိုင်တော့ပါ။')) {
      const newKey = generateRecoveryKey();
      setRecoveryKey(newKey);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (enabled && passcode.trim().length < 4) {
      alert('လျှို့ဝှက်ကုဒ် (PIN) သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
      return;
    }

    const updated: AppLockSettings = {
      ...appLockSettings,
      enabled,
      passcode: passcode.trim(),
      pin: passcode.trim(),
      recoveryKey: recoveryKey.trim(),
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold">App Lock & Password Key လုံခြုံရေး</h3>
              <p className="text-[11px] text-slate-400">စကားဝှက် PIN နှင့် Recovery Key စီမံခြင်း</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
          {/* Toggle Lock */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="font-bold text-slate-800 block text-sm">App Lock ဖွင့်ထားမည်</span>
              <span className="text-[11px] text-slate-500">
                ဆော့ဖ်ဝဲဖွင့်တိုင်း လျှို့ဝှက်ကုဒ် PIN တောင်းဆိုမည်
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Passcode (PIN) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 font-bold">
                လျှို့ဝှက်ကုဒ် (Passcode / PIN) *
              </label>
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="text-slate-500 hover:text-slate-800 text-[11px] flex items-center gap-1 cursor-pointer"
              >
                {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasscode ? 'ဝှက်မည်' : 'ပြမည်'}</span>
              </button>
            </div>
            <input
              type={showPasscode ? 'text' : 'password'}
              maxLength={8}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
              placeholder="ဥပမာ - 1234"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tracking-widest font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-500">
              ဂဏန်း ၄ လုံးမှ ၈ လုံးအထိ ထည့်သွင်းနိုင်ပါသည် (မူလ PIN မှာ 1234 ဖြစ်သည်)
            </p>
          </div>

          {/* Password Key Reset & Recovery Option */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                <KeyRound className="w-4 h-4 text-amber-700" />
                <span>Password Recovery Key (အရေးပေါ်သော့)</span>
              </div>
              <button
                type="button"
                onClick={handleRegenerateRecoveryKey}
                className="text-[10px] text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-0.5 cursor-pointer"
                title="ကီးအသစ်ထုတ်မည်"
              >
                <RotateCcw className="w-3 h-3" />
                <span>အသစ်ထုတ်မည်</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={recoveryKey}
                className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-mono text-xs font-bold text-amber-950 text-center tracking-widest select-all"
              />
              <button
                type="button"
                onClick={handleCopyKey}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'ကူးပြီး' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-[10px] text-amber-900 leading-normal">
              PIN စကားဝှက် မေ့သွားပါက ဤ Recovery Key ကို အသုံးပြု၍ ချက်ချင်း Password Key Reset ပြုလုပ်နိုင်ပါသည်။ စာအုပ် သို့မဟုတ် လုံခြုံသောနေရာတွင် ကူးယူမှတ်သားထားပါ။
            </p>
          </div>

          {/* Security Architecture Disclosure */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 leading-relaxed space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-600" />
              <span>လုံခြုံရေး အသိပေးချက် (Security Disclosure)</span>
            </div>
            <p>
              ဤ Passcode/PIN သည် ဖုန်း သို့မဟုတ် ကွန်ပျူတာ အနီးရှိ အခြားသူများ မတော်တဆ ဝင်ကြည့်ခြင်းမှ ကာကွယ်ရန်ဖြစ်ပါသည်။ စက်ကို အပြည့်အဝ ကိုင်တွယ်ခွင့်ရှိသူ သို့မဟုတ် Developer Tools သုံးစွဲသူများထံမှ စက်အဆင့် (OS/Hardware level) ဒေတာကုဒ်ဝှက်ခြင်းနှင့် တူညီမှုမရှိပါ။
            </p>
          </div>

          {/* Lock Immediately Button */}
          {enabled && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockNow();
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>ယခုပင် ချက်ချင်း သော့ခတ်မည် (Lock Now)</span>
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>ဆက်တင် သိမ်းဆည်းမည်</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
