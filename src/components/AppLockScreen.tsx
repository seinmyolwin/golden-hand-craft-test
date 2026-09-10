import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { AppLockSettings, ShopSettings } from '../types';
import { Logo } from './Logo';
import {
  resetAppLockPinWithRecoveryKey,
  verifyRecoveryKey,
  DEFAULT_APP_LOCK,
} from '../utils/storage';

interface AppLockScreenProps {
  appLockSettings?: AppLockSettings;
  pin?: string;
  shopName?: string;
  shopSettings?: ShopSettings;
  onUnlock: () => void;
  onUpdateAppLockSettings?: (updated: AppLockSettings) => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  appLockSettings,
  pin: propPin,
  shopName: propShopName,
  shopSettings,
  onUnlock,
  onUpdateAppLockSettings,
}) => {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);

  // Recovery & Reset Modal State
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState<boolean>(false);
  const [recoveryMode, setRecoveryMode] = useState<'reset' | 'emergency_unlock'>('reset');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string>('');
  const [recoverySuccess, setRecoverySuccess] = useState<string>('');

  // Effective correct PIN & details
  const correctPin =
    propPin ??
    appLockSettings?.passcode ??
    appLockSettings?.pin ??
    '';

  const currentRecoveryKey =
    appLockSettings?.recoveryKey || '';

  const shopName =
    propShopName ??
    shopSettings?.shopName ??
    'ရွှေလက်ရာ';

  const handleDigitPress = (digit: string) => {
    if (pin.length < 8) {
      const next = pin + digit;
      setPin(next);
      setErrorMsg('');
      if (next === correctPin) {
        onUnlock();
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      onUnlock();
    } else {
      setErrorMsg('လျှို့ဝှက်ကုဒ် (PIN) မှားယွင်းနေပါသည်။ ပြန်လည်ရိုက်ထည့်ပါ');
      setAttempts((prev) => prev + 1);
    }
  };

  // Handle Password Key Reset Form
  const handlePerformKeyReset = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    if (!recoveryKeyInput.trim()) {
      setRecoveryError('Recovery Key (ပြန်လည်ရယူရေးကီး) ကို ရိုက်ထည့်ပေးပါ');
      return;
    }

    if (!verifyRecoveryKey(recoveryKeyInput.trim())) {
      setRecoveryError('Recovery Key မမှန်ကန်ပါ။ သေချာစစ်ဆေးပြီး ပြန်လည်ရိုက်ထည့်ပါ');
      return;
    }

    if (recoveryMode === 'emergency_unlock') {
      // Direct Emergency Unlock
      setRecoverySuccess('Recovery Key အတည်ပြုပြီးပါပြီ! အက်ပ်ကို ဖွင့်လှစ်နေပါသည်...');
      setTimeout(() => {
        setIsRecoveryModalOpen(false);
        onUnlock();
      }, 1000);
      return;
    }

    // Reset Mode: Validate new PIN
    if (!newPinInput || newPinInput.length < 4) {
      setRecoveryError('PIN အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setRecoveryError('PIN အသစ်နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီမှုမရှိပါ');
      return;
    }

    const res = resetAppLockPinWithRecoveryKey(recoveryKeyInput.trim(), newPinInput);
    if (res.success) {
      setRecoverySuccess(res.message);
      if (onUpdateAppLockSettings && appLockSettings) {
        onUpdateAppLockSettings({
          ...appLockSettings,
          passcode: newPinInput,
          pin: newPinInput,
        });
      }
      setTimeout(() => {
        setIsRecoveryModalOpen(false);
        onUnlock();
      }, 1200);
    } else {
      setRecoveryError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center p-4 select-none overflow-y-auto">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center my-auto">
        {/* Logo and Lock Header */}
        <div className="relative mb-3">
          <Logo size="xl" className="w-20 h-20 rounded-3xl border-2 border-amber-400/50 shadow-2xl" alt={shopName} />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 border-2 border-slate-900 flex items-center justify-center text-white shadow-md">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{shopName}</h1>
        <p className="text-xs text-emerald-400 font-medium mt-0.5">လုံခြုံရေး PIN စကားဝှက်ဖြင့် ပိတ်ထားပါသည်</p>

        {/* PIN Dots display */}
        <form onSubmit={handleManualSubmit} className="w-full my-4">
          <div className="flex justify-center items-center gap-3 mb-3">
            {[0, 1, 2, 3].map((idx) => {
              const hasDigit = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    hasDigit
                      ? 'bg-emerald-500 border-emerald-400 scale-110 shadow-sm shadow-emerald-500/50'
                      : 'border-slate-600 bg-slate-800/60'
                  }`}
                />
              );
            })}
          </div>

          <input
            type="password"
            autoFocus
            maxLength={8}
            value={pin}
            onChange={(e) => {
              const val = e.target.value;
              setPin(val);
              if (val === correctPin) {
                onUnlock();
              }
            }}
            placeholder="PIN ရိုက်ထည့်ပါ"
            className="w-full text-center bg-slate-800/80 border border-slate-700 text-white font-mono tracking-widest text-lg rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500 transition-colors"
          />

          {errorMsg && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium mt-2 animate-bounce">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {attempts >= 2 && !errorMsg && (
            <p className="text-[11px] text-slate-400 mt-2">
              (မူလ PIN နံပါတ်: <span className="text-amber-400 font-bold font-mono">1234</span>)
            </p>
          )}
        </form>

        {/* Numeric Keypad for fast mobile tapping */}
        <div className="w-full grid grid-cols-3 gap-2.5 max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-emerald-600 active:scale-95 text-white font-bold text-lg rounded-2xl border border-slate-700/60 shadow-xs transition-all cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="py-3 bg-slate-800/50 hover:bg-slate-700/80 text-slate-400 hover:text-white font-medium text-xs rounded-2xl border border-slate-800 transition-all cursor-pointer"
          >
            ရှင်းမည်
          </button>
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-emerald-600 active:scale-95 text-white font-bold text-lg rounded-2xl border border-slate-700/60 shadow-xs transition-all cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="py-3 bg-slate-800/50 hover:bg-slate-700/80 text-slate-400 hover:text-rose-400 font-medium text-xs rounded-2xl border border-slate-800 transition-all cursor-pointer"
          >
            ဖျက်မည်
          </button>
        </div>

        {/* Unlock Button */}
        <button
          type="button"
          onClick={() => {
            if (pin === correctPin) {
              onUnlock();
            } else {
              setErrorMsg('PIN မမှန်ကန်ပါ (မူလ PIN: 1234)');
            }
          }}
          className="w-full mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <Unlock className="w-4 h-4" />
          <span>App ဖွင့်မည် (Unlock)</span>
        </button>

        {/* Quick Demo / Preview Bypass */}
        <button
          type="button"
          onClick={onUnlock}
          className="w-full mt-2 py-1.5 px-3 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 text-[11px] font-medium rounded-xl border border-slate-700/60 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          title="စမ်းသပ်အသုံးပြုရန် ချက်ချင်းကျော်မည်"
        >
          <span>အစမ်းကြည့်ရှုရန် တိုက်ရိုက်ဝင်မည် (Preview)</span>
        </button>

        {/* Password Key Reset & Recovery Option Trigger Button */}
        <button
          type="button"
          onClick={() => {
            setRecoveryError('');
            setRecoverySuccess('');
            setRecoveryKeyInput('');
            setNewPinInput('');
            setConfirmPinInput('');
            setIsRecoveryModalOpen(true);
          }}
          className="mt-3 w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          <span>စကားဝှက် မေ့သွားပါသလား? (Reset / Recovery)</span>
        </button>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>မူလစမ်းသပ် PIN: <span className="text-emerald-400 font-mono font-bold">1234</span></span>
        </div>
      </div>

      {/* ================= PASSWORD KEY RESET & RECOVERY MODAL ================= */}
      {isRecoveryModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 text-slate-100 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                    Password Key Reset & Recovery
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    စကားဝှက် ပြန်လည်ရယူရေးနှင့် PIN အသစ်သတ်မှတ်ခြင်း
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setRecoveryMode('reset');
                  setRecoveryError('');
                }}
                className={`flex-1 py-2.5 px-3 text-center flex items-center justify-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
                  recoveryMode === 'reset'
                    ? 'border-amber-500 text-amber-400 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>PIN အသစ်ပြောင်းမည်</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryMode('emergency_unlock');
                  setRecoveryError('');
                }}
                className={`flex-1 py-2.5 px-3 text-center flex items-center justify-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
                  recoveryMode === 'emergency_unlock'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>တိုက်ရိုက်ဖွင့်မည်</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handlePerformKeyReset} className="p-4 sm:p-5 space-y-4 overflow-y-auto text-left text-xs">
              {/* Alert Feedback Messages */}
              {recoveryError && (
                <div className="p-3 bg-rose-950/80 border border-rose-600/60 rounded-xl text-rose-200 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{recoveryError}</span>
                </div>
              )}

              {recoverySuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-200 flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-bold">{recoverySuccess}</span>
                </div>
              )}

              {/* Master Recovery Key Input */}
              <div className="space-y-1.5">
                <label className="block text-slate-200 font-bold text-xs flex items-center justify-between">
                  <span>Recovery Key (ပြန်လည်ရယူရေးကီး) *</span>
                  <span className="text-[10px] text-slate-400 font-normal">ပုံစံ: SLY-XXXX-XXXX</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={recoveryKeyInput}
                    onChange={(e) => setRecoveryKeyInput(e.target.value.toUpperCase())}
                    placeholder="ဥပမာ - SLY-8842-9173"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono tracking-wider font-bold text-sm text-amber-300 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  လုံခြုံရေးအတွက် ဆက်တင်တွင် ထုတ်ပေးထားသော ပြန်လည်ရယူရေးကီးကို ရိုက်ထည့်ပါ။
                </p>
              </div>

              {/* Reset Mode: Inputs for New PIN */}
              {recoveryMode === 'reset' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-200 font-bold text-xs">
                        စကားဝှက် (PIN အသစ် ၄~၆ လုံး) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {showNewPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showNewPin ? 'ဝှက်မည်' : 'ပြမည်'}</span>
                      </button>
                    </div>
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      maxLength={6}
                      required
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="PIN အသစ် ရိုက်ထည့်ပါ (ဥပမာ: 5678)"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest font-extrabold text-base text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-200 font-bold text-xs">
                      PIN အသစ် ထပ်မံအတည်ပြုပါ *
                    </label>
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      maxLength={6}
                      required
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="PIN အသစ် ထပ်မံရိုက်ထည့်ပါ"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest font-extrabold text-base text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Help & Recovery Info Card */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5 text-slate-400 text-[11px]">
                <div className="flex items-center gap-1 text-slate-300 font-bold">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>အရေးပေါ် အချက်အလက်နှင့် အကူအညီ</span>
                </div>
                <p>
                  App Lock ဖွင့်လှစ်ချိန်တွင် မိမိသီးသန့် သိမ်းဆည်းထားခဲ့သော Recovery Key (ပြန်လည်ရယူရေးကီး) ကို ရိုက်ထည့်ပေးပါ။
                </p>
                <p className="text-slate-500">
                  (လုံခြုံရေးအတွက် မူလစကားဝှက်များကို ဆော့ဖ်ဝဲလ်တွင်း၌ ထည့်သွင်းမထားဘဲ အသုံးပြုသူ ကိုယ်တိုင်သာ ထိန်းသိမ်းရမည်ဖြစ်ပါသည်)
                </p>
              </div>

              {/* Submit Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRecoveryModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 font-bold text-white rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all ${
                    recoveryMode === 'reset'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {recoveryMode === 'reset' ? (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>စကားဝှက် ပြောင်းပြီး ဖွင့်မည်</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>အရေးပေါ် ဖွင့်မည်</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
