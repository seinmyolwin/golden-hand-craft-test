import React, { useState, useEffect } from 'react';
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
  ShieldAlert,
  Clock,
  Key,
} from 'lucide-react';
import { AppLockSettings, ShopSettings } from '../types';
import { Logo } from './Logo';
import {
  verifyAppLockPin,
  verifyAppLockRecoveryKey,
  checkAppLockout,
  handleFailedAttempt,
  handleSuccessfulUnlock,
  derivePinCredentials,
  SECURITY_DISCLOSURE_MY,
} from '../services/cryptoSecurity';

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
  shopName: propShopName,
  shopSettings,
  onUnlock,
  onUpdateAppLockSettings,
}) => {
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Initial PIN Setup Mode (if app lock is enabled but no PIN verifier exists yet)
  const isSetupNeeded =
    !appLockSettings?.isPinInitialized &&
    !appLockSettings?.pinHash &&
    !appLockSettings?.passcode &&
    !appLockSettings?.pin;

  const [setupPin, setSetupPin] = useState<string>('');
  const [setupConfirmPin, setSetupConfirmPin] = useState<string>('');
  const [showSetupPin, setShowSetupPin] = useState<boolean>(false);

  // Recovery & Reset Modal State
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState<boolean>(false);
  const [recoveryMode, setRecoveryMode] = useState<'reset' | 'emergency_unlock'>('reset');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string>('');
  const [recoverySuccess, setRecoverySuccess] = useState<string>('');
  const [isProcessingRecovery, setIsProcessingRecovery] = useState<boolean>(false);

  const shopName =
    propShopName ??
    shopSettings?.shopName ??
    'ရွှေလက်ရာ';

  // Check lockout status on mount or change
  useEffect(() => {
    if (appLockSettings) {
      const { isLocked, remainingSeconds } = checkAppLockout(appLockSettings);
      if (isLocked) {
        setLockoutSeconds(remainingSeconds);
      }
    }
  }, [appLockSettings]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Handle Initial PIN Creation (User creates their own initial PIN)
  const handleInitialSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (setupPin.length < 4) {
      setErrorMsg('PIN သည် အနည်းဆုံး ဂဏန်း ၄ လုံး ရှိရပါမည်');
      return;
    }

    if (setupPin !== setupConfirmPin) {
      setErrorMsg('PIN နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီမှုမရှိပါ');
      return;
    }

    try {
      setIsVerifying(true);
      const creds = await derivePinCredentials(setupPin);
      const updated: AppLockSettings = {
        ...(appLockSettings || { enabled: true }),
        enabled: true,
        pinSalt: creds.salt,
        pinHash: creds.hash,
        isPinInitialized: true,
        failedAttempts: 0,
        lockedUntilTimestamp: undefined,
        lastUnlockedAt: new Date().toISOString(),
      };

      if (onUpdateAppLockSettings) {
        onUpdateAppLockSettings(updated);
      }
      setSetupPin('');
      setSetupConfirmPin('');
      onUnlock();
    } catch {
      setErrorMsg('PIN သတ်မှတ်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyEnteredPin = async (pinToTest: string) => {
    if (!appLockSettings || lockoutSeconds > 0 || isVerifying) return;

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const isValid = await verifyAppLockPin(pinToTest, appLockSettings);
      if (isValid) {
        const unlockedSettings = handleSuccessfulUnlock(appLockSettings);
        if (onUpdateAppLockSettings) {
          onUpdateAppLockSettings(unlockedSettings);
        }
        setEnteredPin('');
        onUnlock();
      } else {
        const { updatedSettings, lockoutSeconds: delay, remainingAttempts } =
          handleFailedAttempt(appLockSettings);
        if (onUpdateAppLockSettings) {
          onUpdateAppLockSettings(updatedSettings);
        }

        setEnteredPin('');
        if (delay > 0) {
          setLockoutSeconds(delay);
          setErrorMsg(`မှားယွင်းမှုများလွန်းသဖြင့် ${delay} စက္ကန့် စောင့်ဆိုင်းပေးပါ`);
        } else {
          setErrorMsg(
            `လျှို့ဝှက်ကုဒ် (PIN) မှားယွင်းနေပါသည်။ (${remainingAttempts} ကြိမ်သာ ကျန်ပါသည်)`
          );
        }
      }
    } catch {
      setErrorMsg('စစ်ဆေးရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitPress = (digit: string) => {
    if (lockoutSeconds > 0 || isVerifying) return;
    if (enteredPin.length < 8) {
      const next = enteredPin + digit;
      setEnteredPin(next);
      setErrorMsg('');
      if (next.length >= 4) {
        // Automatically test once minimum length reached
        handleVerifyEnteredPin(next);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSeconds > 0) return;
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    if (lockoutSeconds > 0) return;
    setEnteredPin('');
    setErrorMsg('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.length >= 4) {
      handleVerifyEnteredPin(enteredPin);
    } else {
      setErrorMsg('PIN သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
    }
  };

  // Handle Recovery Key Reset or Emergency Unlock
  const handlePerformKeyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    if (!recoveryKeyInput.trim()) {
      setRecoveryError('Recovery Key (ပြန်လည်ရယူရေးကီး) ကို ရိုက်ထည့်ပေးပါ');
      return;
    }

    if (!appLockSettings) {
      setRecoveryError('App Lock ဆက်တင် ရှာမတွေ့ပါ');
      return;
    }

    try {
      setIsProcessingRecovery(true);
      const isKeyValid = await verifyAppLockRecoveryKey(recoveryKeyInput.trim(), appLockSettings);
      if (!isKeyValid) {
        setRecoveryError('Recovery Key မမှန်ကန်ပါ။ သေချာစစ်ဆေးပြီး ပြန်လည်ရိုက်ထည့်ပါ');
        return;
      }

      if (recoveryMode === 'emergency_unlock') {
        // Direct Emergency Unlock
        setRecoverySuccess('Recovery Key အတည်ပြုပြီးပါပြီ! အက်ပ်ကို ဖွင့်လှစ်နေပါသည်...');
        const unlockedSettings = handleSuccessfulUnlock(appLockSettings);
        if (onUpdateAppLockSettings) {
          onUpdateAppLockSettings(unlockedSettings);
        }
        setTimeout(() => {
          setRecoveryKeyInput('');
          setIsRecoveryModalOpen(false);
          onUnlock();
        }, 800);
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

      const creds = await derivePinCredentials(newPinInput);
      const updated: AppLockSettings = {
        ...appLockSettings,
        pinSalt: creds.salt,
        pinHash: creds.hash,
        isPinInitialized: true,
        failedAttempts: 0,
        lockedUntilTimestamp: undefined,
        lastResetAt: new Date().toISOString(),
        lastUnlockedAt: new Date().toISOString(),
      };
      // Clean legacy plaintext secrets
      delete updated.passcode;
      delete updated.pin;

      if (onUpdateAppLockSettings) {
        onUpdateAppLockSettings(updated);
      }

      setRecoverySuccess('စကားဝှက် (PIN) အသစ် အောင်မြင်စွာ ပြောင်းလဲသတ်မှတ်ပြီးပါပြီ!');
      setTimeout(() => {
        setRecoveryKeyInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setIsRecoveryModalOpen(false);
        onUnlock();
      }, 1000);
    } catch {
      setRecoveryError('စစ်ဆေးဆောင်ရွက်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsProcessingRecovery(false);
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
        <p className="text-xs text-emerald-400 font-medium mt-0.5">
          {isSetupNeeded ? 'စကားဝှက် (PIN) အသစ် သတ်မှတ်ပေးပါ' : 'လုံခြုံရေး PIN စကားဝှက်ဖြင့် ပိတ်ထားပါသည်'}
        </p>

        {/* Lockout Warning Banner */}
        {lockoutSeconds > 0 && (
          <div className="w-full mt-3 p-3 bg-rose-950/80 border border-rose-600/70 rounded-2xl flex items-center gap-2 text-left text-xs text-rose-200">
            <Clock className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold">မှားယွင်းမှု အကြိမ်အရေအတွက် ကျော်လွန်နေပါသည်</p>
              <p className="text-[11px] text-rose-300">
                လုံခြုံရေးအရ <span className="font-bold font-mono text-white text-sm">{lockoutSeconds}</span> စက္ကန့် စောင့်ဆိုင်းပေးပါ
              </p>
            </div>
          </div>
        )}

        {/* INITIAL SETUP FORM (If App Lock is enabled but no PIN verifier configured yet) */}
        {isSetupNeeded ? (
          <form onSubmit={handleInitialSetupSubmit} className="w-full my-4 space-y-3 text-left text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-[11px] leading-relaxed">
              ပထမဆုံးအကြိမ် အသုံးပြုရန် မိမိစိတ်ကြိုက် ၄~၈ လုံးပါ PIN စကားဝှက်ကို ဖန်တီးပေးပါ။
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold">PIN စကားဝှက် အသစ် *</label>
                <button
                  type="button"
                  onClick={() => setShowSetupPin(!showSetupPin)}
                  className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {showSetupPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showSetupPin ? 'ဝှက်မည်' : 'ပြမည်'}</span>
                </button>
              </div>
              <input
                type={showSetupPin ? 'text' : 'password'}
                maxLength={8}
                required
                value={setupPin}
                onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                placeholder="ဥပမာ: 1234"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest font-bold text-base text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-bold">PIN အသစ် ထပ်မံအတည်ပြုပါ *</label>
              <input
                type={showSetupPin ? 'text' : 'password'}
                maxLength={8}
                required
                value={setupConfirmPin}
                onChange={(e) => setSetupConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN ထပ်မံရိုက်ထည့်ပါ"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest font-bold text-base text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {errorMsg && (
              <div className="p-2 bg-rose-950/80 border border-rose-700 text-rose-300 text-[11px] rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Key className="w-4 h-4" />
              <span>{isVerifying ? 'သတ်မှတ်နေပါသည်...' : 'PIN စကားဝှက် သတ်မှတ်ပြီး ဖွင့်မည်'}</span>
            </button>
          </form>
        ) : (
          /* STANDARD UNLOCK INTERFACE */
          <>
            <form onSubmit={handleManualSubmit} className="w-full my-4">
              <div className="flex justify-center items-center gap-3 mb-3">
                {[0, 1, 2, 3].map((idx) => {
                  const hasDigit = enteredPin.length > idx;
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
                disabled={lockoutSeconds > 0}
                maxLength={8}
                value={enteredPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setEnteredPin(val);
                  setErrorMsg('');
                  if (val.length >= 4) {
                    handleVerifyEnteredPin(val);
                  }
                }}
                placeholder="PIN ရိုက်ထည့်ပါ"
                className="w-full text-center bg-slate-800/80 border border-slate-700 text-white font-mono tracking-widest text-lg rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              />

              {errorMsg && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium mt-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>

            {/* Numeric Keypad for fast mobile tapping */}
            <div className="w-full grid grid-cols-3 gap-2.5 max-w-[280px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={lockoutSeconds > 0 || isVerifying}
                  onClick={() => handleDigitPress(digit)}
                  className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-emerald-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-lg rounded-2xl border border-slate-700/60 shadow-xs transition-all cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={lockoutSeconds > 0}
                onClick={handleClear}
                className="py-3 bg-slate-800/50 hover:bg-slate-700/80 disabled:opacity-40 text-slate-400 hover:text-white font-medium text-xs rounded-2xl border border-slate-800 transition-all cursor-pointer"
              >
                ရှင်းမည်
              </button>
              <button
                type="button"
                disabled={lockoutSeconds > 0 || isVerifying}
                onClick={() => handleDigitPress('0')}
                className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-emerald-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-lg rounded-2xl border border-slate-700/60 shadow-xs transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                disabled={lockoutSeconds > 0}
                onClick={handleBackspace}
                className="py-3 bg-slate-800/50 hover:bg-slate-700/80 disabled:opacity-40 text-slate-400 hover:text-rose-400 font-medium text-xs rounded-2xl border border-slate-800 transition-all cursor-pointer"
              >
                ဖျက်မည်
              </button>
            </div>

            {/* Manual Unlock Submit Button */}
            <button
              type="button"
              disabled={lockoutSeconds > 0 || isVerifying || enteredPin.length < 4}
              onClick={() => handleVerifyEnteredPin(enteredPin)}
              className="w-full mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Unlock className="w-4 h-4" />
              <span>{isVerifying ? 'စစ်ဆေးနေပါသည်...' : 'App ဖွင့်မည် (Unlock)'}</span>
            </button>
          </>
        )}

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

        {/* Honest Security Disclaimer */}
        <p className="mt-3 text-[10px] text-slate-500 leading-relaxed px-2">
          {SECURITY_DISCLOSURE_MY}
        </p>
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
                    placeholder="ဥပမာ - SLY-8K3N-7R4W"
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
                        စကားဝှက် (PIN အသစ် ၄~၈ လုံး) *
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
                      maxLength={8}
                      required
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="PIN အသစ် ရိုက်ထည့်ပါ"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest font-extrabold text-base text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-200 font-bold text-xs">
                      PIN အသစ် ထပ်မံအတည်ပြုပါ *
                    </label>
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      maxLength={8}
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
                  disabled={isProcessingRecovery}
                  className={`px-4 py-2 font-bold text-white rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all ${
                    recoveryMode === 'reset'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {recoveryMode === 'reset' ? (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>{isProcessingRecovery ? 'ပြောင်းနေပါသည်...' : 'စကားဝှက် ပြောင်းပြီး ဖွင့်မည်'}</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>{isProcessingRecovery ? 'ဖွင့်နေပါသည်...' : 'အရေးပေါ် ဖွင့်မည်'}</span>
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
