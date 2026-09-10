import React, { useState, useEffect } from 'react';
import { AppLockSettings } from '../types';
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
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  generateSecureRecoveryKey,
  derivePinCredentials,
  deriveRecoveryCredentials,
  SECURITY_DISCLOSURE_MY,
} from '../services/cryptoSecurity';

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
  const [passcode, setPasscode] = useState<string>('');
  const [confirmPasscode, setConfirmPasscode] = useState<string>('');
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(
    appLockSettings.autoLockMinutes ?? 5
  );
  const [lockOnStartup, setLockOnStartup] = useState<boolean>(
    appLockSettings.lockOnStartup ?? true
  );

  // Recovery Key (generated on demand if not existing)
  const [activeRecoveryKey, setActiveRecoveryKey] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen) {
      setEnabled(appLockSettings.enabled ?? false);
      setAutoLockMinutes(appLockSettings.autoLockMinutes ?? 5);
      setLockOnStartup(appLockSettings.lockOnStartup ?? true);
      setPasscode('');
      setConfirmPasscode('');
      setErrorMsg('');
      setCopiedKey(false);

      // Generate a new unique recovery key candidate if no recovery hash exists
      if (!appLockSettings.recoveryHash && !appLockSettings.recoveryKey) {
        setActiveRecoveryKey(generateSecureRecoveryKey());
      } else {
        setActiveRecoveryKey(appLockSettings.recoveryKey || generateSecureRecoveryKey());
      }
    }
  }, [isOpen, appLockSettings]);

  if (!isOpen) return null;

  const handleRegenerateRecoveryKey = () => {
    if (confirm('Recovery Key အသစ် ထုတ်ယူလိုပါသလား? ယခင်ကီး အသုံးမပြုနိုင်တော့ပါ။')) {
      const newKey = generateSecureRecoveryKey();
      setActiveRecoveryKey(newKey);
      setCopiedKey(false);
    }
  };

  const handleCopyKey = () => {
    if (!activeRecoveryKey) return;
    navigator.clipboard.writeText(activeRecoveryKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Check if enabling App Lock requires setting a PIN
    const hasExistingPin = !!appLockSettings.pinHash || !!appLockSettings.pinSalt || !!appLockSettings.passcode;
    const isSettingNewPin = passcode.trim().length > 0;

    if (enabled && !hasExistingPin && !isSettingNewPin) {
      setErrorMsg('App Lock ဖွင့်ရန် လျှို့ဝှက်ကုဒ် (PIN) အနည်းဆုံး ၄ လုံး သတ်မှတ်ပေးပါ');
      return;
    }

    if (isSettingNewPin) {
      if (passcode.trim().length < 4) {
        setErrorMsg('လျှို့ဝှက်ကုဒ် (PIN) သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
        return;
      }
      if (passcode.trim() !== confirmPasscode.trim()) {
        setErrorMsg('PIN နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီမှုမရှိပါ');
        return;
      }
    }

    try {
      setIsSaving(true);
      const updated: AppLockSettings = {
        ...appLockSettings,
        enabled,
        autoLockMinutes,
        lockOnStartup,
        failedAttempts: 0,
        lockedUntilTimestamp: undefined,
      };

      // If user set a new PIN, derive salted cryptographic verifier
      if (isSettingNewPin) {
        const pinCreds = await derivePinCredentials(passcode.trim());
        updated.pinSalt = pinCreds.salt;
        updated.pinHash = pinCreds.hash;
        updated.isPinInitialized = true;
      }

      // If active recovery key was newly generated or changed, derive its salted verifier
      if (activeRecoveryKey && activeRecoveryKey.trim()) {
        const recCreds = await deriveRecoveryCredentials(activeRecoveryKey.trim());
        updated.recoverySalt = recCreds.salt;
        updated.recoveryHash = recCreds.hash;
        updated.recoveryKey = activeRecoveryKey.trim();
      }

      // Remove legacy plaintext fields
      delete updated.passcode;
      delete updated.pin;

      onSave(updated);
      onClose();
    } catch {
      setErrorMsg('ဆက်တင် သိမ်းဆည်းရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold">App Lock & လုံခြုံရေး စီမံခြင်း</h3>
              <p className="text-[11px] text-slate-400">စကားဝှက် PIN နှင့် Recovery Key</p>
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

        <form onSubmit={handleSave} className="p-4 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

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

          {/* Passcode (PIN) Input */}
          <div className="space-y-2 p-3 bg-slate-50/60 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="block text-slate-800 font-bold">
                {appLockSettings.pinHash || appLockSettings.isPinInitialized
                  ? 'PIN အသစ်ပြောင်းမည် (မပြောင်းလိုပါက ချန်ထားပါ)'
                  : 'လျှို့ဝှက်ကုဒ် (PIN) အသစ် သတ်မှတ်ပါ *'}
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
              placeholder="PIN အသစ် (၄~၈ လုံး)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tracking-widest font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {passcode.length > 0 && (
              <input
                type={showPasscode ? 'text' : 'password'}
                maxLength={8}
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN အသစ် ထပ်မံအတည်ပြုပါ"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tracking-widest font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
            <p className="text-[10px] text-slate-500">
              ဂဏန်း ၄ လုံးမှ ၈ လုံးအထိ သတ်မှတ်နိုင်ပါသည်
            </p>
          </div>

          {/* Session / Lockout Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Auto-Lock အချိန်သတ်မှတ်ချက်</span>
              </label>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={0}>Tab ပြောင်း/ကွယ်တိုင်း ချက်ချင်း Lock မည်</option>
                <option value={1}>၁ မိနစ် မလှုပ်ရှားပါက</option>
                <option value={5}>၅ မိနစ် မလှုပ်ရှားပါက (ပုံမှန်)</option>
                <option value={15}>၁၅ မိနစ် မလှုပ်ရှားပါက</option>
                <option value={30}>၃၀ မိနစ် မလှုပ်ရှားပါက</option>
                <option value={-1}>အလိုအလျောက် Lock မချပါ</option>
              </select>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">Startup Lock</label>
                <span className="text-[10px] text-slate-500">အက်ပ်စဖွင့်တိုင်း PIN တောင်းမည်</span>
              </div>
              <input
                type="checkbox"
                checked={lockOnStartup}
                onChange={(e) => setLockOnStartup(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
            </div>
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
                value={activeRecoveryKey}
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
              PIN စကားဝှက် မေ့သွားပါက ဤ Recovery Key ကို အသုံးပြု၍ ချက်ချင်း Password Reset ပြုလုပ်နိုင်ပါသည်။
            </p>
          </div>

          {/* Security Architecture Disclosure */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 leading-relaxed space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-600" />
              <span>လုံခြုံရေး အသိပေးချက် (Local Screen Lock)</span>
            </div>
            <p>{SECURITY_DISCLOSURE_MY}</p>
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
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'သိမ်းဆည်းနေပါသည်...' : 'ဆက်တင် သိမ်းဆည်းမည်'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
