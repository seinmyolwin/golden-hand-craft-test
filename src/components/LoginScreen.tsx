import React, { useState, useEffect } from 'react';
import {
  Shield,
  User,
  Crown,
  KeyRound,
  Lock,
  Unlock,
  AlertCircle,
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  X,
  ShieldCheck,
  Building2,
  Sparkles,
} from 'lucide-react';
import { AppLockSettings, ShopSettings, UserSession } from '../types';
import { Logo } from './Logo';
import {
  verifyAppLockPin,
  verifyAppLockRecoveryKey,
  checkAppLockout,
  handleFailedAttempt,
  handleSuccessfulUnlock,
  derivePinCredentials,
} from '../services/cryptoSecurity';
import { switchUserSession } from '../services/authorizationService';

interface LoginScreenProps {
  appLockSettings?: AppLockSettings;
  shopSettings?: ShopSettings;
  onLoginSuccess: (session: UserSession) => void;
  onUpdateAppLockSettings?: (updated: AppLockSettings) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  appLockSettings,
  shopSettings,
  onLoginSuccess,
  onUpdateAppLockSettings,
}) => {
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'USER' | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

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

  const shopName = shopSettings?.shopName?.trim() || 'ရွှေလက်ရာ';
  const ownerName = shopSettings?.ownerName?.trim() || 'ဦးစိန်မျိုးလွင်';

  // Check lockout status
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

  // Check if PIN is configured for Owner
  const hasConfiguredPin = Boolean(
    appLockSettings?.enabled &&
      (appLockSettings?.pinHash || appLockSettings?.passcode || appLockSettings?.pin)
  );

  // Direct Staff Login (No PIN required)
  const handleSelectStaff = async () => {
    setIsVerifying(true);
    setErrorMsg('');
    try {
      const session = await switchUserSession('USER');
      onLoginSuccess(session);
    } catch (err: any) {
      setErrorMsg(err.message || 'ဝန်ထမ်းအကောင့်သို့ ဝင်ရောက်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsVerifying(false);
    }
  };

  // Select Owner -> If no PIN configured, log in immediately; otherwise show PIN keypad
  const handleSelectOwner = async () => {
    setErrorMsg('');
    setEnteredPin('');
    if (!hasConfiguredPin) {
      // No PIN configured -> direct login as OWNER
      setIsVerifying(true);
      try {
        const session = await switchUserSession('OWNER');
        onLoginSuccess(session);
      } catch (err: any) {
        setErrorMsg(err.message || 'ဆိုင်ရှင်အကောင့်သို့ ဝင်ရောက်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
      } finally {
        setIsVerifying(false);
      }
    } else {
      setSelectedRole('OWNER');
    }
  };

  // Verify Owner PIN
  const handleVerifyOwnerPin = async (pinToTest: string) => {
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
        const session = await switchUserSession('OWNER', { pin: pinToTest });
        setEnteredPin('');
        onLoginSuccess(session);
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
            `ဆိုင်ရှင် PIN မှားယွင်းနေပါသည်။ (${remainingAttempts} ကြိမ်သာ ကျန်ပါသည်)`
          );
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'စစ်ဆေးရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
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
        handleVerifyOwnerPin(next);
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

  // Handle Recovery Key Reset
  const handlePerformKeyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    if (!recoveryKeyInput.trim()) {
      setRecoveryError('Recovery Key ကို ရိုက်ထည့်ပေးပါ');
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
        setRecoverySuccess('Recovery Key အတည်ပြုပြီးပါပြီ! ဆိုင်ရှင်အဖြစ် ဖွင့်လှစ်နေပါသည်...');
        const unlockedSettings = handleSuccessfulUnlock(appLockSettings);
        if (onUpdateAppLockSettings) {
          onUpdateAppLockSettings(unlockedSettings);
        }
        const session = await switchUserSession('OWNER');
        setTimeout(() => {
          setRecoveryKeyInput('');
          setIsRecoveryModalOpen(false);
          onLoginSuccess(session);
        }, 800);
        return;
      }

      // Reset PIN Mode
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
      delete updated.passcode;
      delete updated.pin;

      if (onUpdateAppLockSettings) {
        onUpdateAppLockSettings(updated);
      }

      const session = await switchUserSession('OWNER', { pin: newPinInput });
      setRecoverySuccess('စကားဝှက် (PIN) အသစ် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ!');
      setTimeout(() => {
        setRecoveryKeyInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setIsRecoveryModalOpen(false);
        onLoginSuccess(session);
      }, 1000);
    } catch {
      setRecoveryError('စစ်ဆေးဆောင်ရွက်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsProcessingRecovery(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center p-4 select-none overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center my-auto">
        {/* Brand Header */}
        <div className="relative mb-3">
          <Logo
            size="xl"
            className="w-20 h-20 rounded-3xl border-2 border-amber-400/60 shadow-2xl bg-slate-950/40"
            alt={shopName}
          />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 border-2 border-slate-900 flex items-center justify-center text-white shadow-md">
            <Shield className="w-3.5 h-3.5" />
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{shopName}</h1>
        <p className="text-xs text-emerald-400 font-medium mt-0.5">
          မြန်မာ့လက်မှု ကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း စာရင်းကိုင်စနစ်
        </p>

        {/* ========================================================================= */}
        {/* VIEW 1: ROLE SELECTION (Owner vs Staff) */}
        {/* ========================================================================= */}
        {selectedRole !== 'OWNER' ? (
          <div className="w-full mt-6 space-y-4">
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl text-left">
              <p className="text-xs font-bold text-slate-200">အသုံးပြုသူ အခန်းကဏ္ဍ ရွေးချယ်ပါ</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ဆိုင်ရှင် သို့မဟုတ် ဝန်ထမ်းအဖြစ် စနစ်သို့ ဝင်ရောက်နိုင်ပါသည်
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-300 text-xs rounded-xl flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Card 1: ဆိုင်ရှင် (Owner) */}
            <button
              id="login-select-owner-btn"
              type="button"
              disabled={isVerifying}
              onClick={handleSelectOwner}
              className="w-full p-4.5 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-emerald-500/10 hover:from-amber-500/20 hover:to-emerald-500/20 active:scale-[0.99] border-2 border-amber-400/50 hover:border-amber-400 rounded-2xl text-left flex items-center justify-between group transition-all cursor-pointer shadow-lg shadow-amber-950/20"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
                  <Crown className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-amber-200">ဆိုင်ရှင် (Owner)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      Full Access
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 truncate">
                    {ownerName} • စီမံခန့်ခွဲမှု၊ စာရင်းချုပ်နှင့် ဆက်တင်များ
                  </p>
                  <p className="text-[10px] text-amber-300/80 mt-1 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    <span>{hasConfiguredPin ? 'PIN စကားဝှက် လိုအပ်ပါသည်' : 'တိုက်ရိုက်ဝင်ရောက်နိုင်ပါသည်'}</span>
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* Card 2: ဝန်ထမ်း / အရောင်း (Staff) */}
            <button
              id="login-select-staff-btn"
              type="button"
              disabled={isVerifying}
              onClick={handleSelectStaff}
              className="w-full p-4.5 bg-slate-800/80 hover:bg-slate-800 active:scale-[0.99] border-2 border-slate-700 hover:border-emerald-500/60 rounded-2xl text-left flex items-center justify-between group transition-all cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition-transform">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white">ဝန်ထမ်း / အရောင်း (Staff)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Data Entry
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 truncate">
                    နေ့စဉ် အရောင်းဘောင်ချာ၊ ပစ္စည်းလက်ခံနှင့် ငွေစာရင်းသွင်းရန်
                  </p>
                  <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span>PIN မလိုဘဲ ချက်ချင်း စတင်သုံးနိုင်ပါသည်</span>
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* Offline Status Badge */}
            <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Offline-First PWA • အင်တာနက်မလိုဘဲ အပြည့်အဝ သုံးနိုင်ပါသည်</span>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: OWNER PIN VERIFICATION KEYPAD */
          /* ========================================================================= */
          <div className="w-full mt-4 flex flex-col items-center">
            {/* Back to Role Selection Button */}
            <div className="w-full flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setEnteredPin('');
                  setErrorMsg('');
                }}
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>← အခန်းကဏ္ဍ ပြန်ရွေးမည်</span>
              </button>

              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                <span>ဆိုင်ရှင် PIN စစ်ဆေးခြင်း</span>
              </span>
            </div>

            {/* Lockout Warning Banner */}
            {lockoutSeconds > 0 && (
              <div className="w-full mb-3 p-3 bg-rose-950/80 border border-rose-600/70 rounded-2xl flex items-center gap-2 text-left text-xs text-rose-200">
                <Clock className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                <div>
                  <p className="font-bold">မှားယွင်းမှု အကြိမ်အရေအတွက် ကျော်လွန်နေပါသည်</p>
                  <p className="text-[11px] text-rose-300">
                    လုံခြုံရေးအရ <span className="font-bold font-mono text-white text-sm">{lockoutSeconds}</span> စက္ကန့် စောင့်ဆိုင်းပေးပါ
                  </p>
                </div>
              </div>
            )}

            {/* PIN Dots Indicator */}
            <div className="flex justify-center items-center gap-3 my-2">
              {[0, 1, 2, 3].map((idx) => {
                const hasDigit = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      hasDigit
                        ? 'bg-amber-400 border-amber-300 scale-110 shadow-sm shadow-amber-400/50'
                        : 'border-slate-600 bg-slate-800/60'
                    }`}
                  />
                );
              })}
            </div>

            {/* Hidden / Accessible PIN Input */}
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
                  handleVerifyOwnerPin(val);
                }
              }}
              placeholder="ဆိုင်ရှင် PIN ရိုက်ထည့်ပါ"
              className="w-full text-center bg-slate-800/80 border border-slate-700 text-amber-300 font-mono tracking-widest text-lg rounded-xl py-2 px-3 focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50 my-2"
            />

            {errorMsg && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium mb-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Numeric Keypad for fast mobile tapping */}
            <div className="w-full grid grid-cols-3 gap-2.5 max-w-[280px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={lockoutSeconds > 0 || isVerifying}
                  onClick={() => handleDigitPress(digit)}
                  className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-lg rounded-2xl border border-slate-700/60 shadow-xs transition-all cursor-pointer"
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
                className="py-3 bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-lg rounded-2xl border border-slate-700/60 shadow-xs transition-all cursor-pointer"
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

            {/* Manual Submit Button */}
            <button
              type="button"
              disabled={lockoutSeconds > 0 || isVerifying || enteredPin.length < 4}
              onClick={() => handleVerifyOwnerPin(enteredPin)}
              className="w-full mt-4 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Unlock className="w-4 h-4" />
              <span>{isVerifying ? 'စစ်ဆေးနေပါသည်...' : 'ဆိုင်ရှင်အဖြစ် ဝင်ရောက်မည်'}</span>
            </button>

            {/* Recovery Key Reset Button */}
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
              className="mt-3 w-full py-2 px-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-amber-300 hover:text-amber-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>PIN မေ့နေပါသလား? Recovery Key ဖြင့် ပြန်ယူမည်</span>
            </button>
          </div>
        )}
      </div>

      {/* RECOVERY & PIN RESET MODAL */}
      {isRecoveryModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <ShieldCheck className="w-5 h-5" />
                <span>Recovery Key ဖြင့် ဆိုင်ရှင် PIN ပြန်လည်ရယူခြင်း</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePerformKeyReset} className="mt-4 space-y-4">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRecoveryMode('reset')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    recoveryMode === 'reset'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PIN အသစ် ပြောင်းမည်
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryMode('emergency_unlock')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    recoveryMode === 'emergency_unlock'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ချက်ချင်း ဖွင့်လှစ်မည်
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  လုံခြုံရေး Recovery Key *
                </label>
                <input
                  type="text"
                  required
                  value={recoveryKeyInput}
                  onChange={(e) => setRecoveryKeyInput(e.target.value)}
                  placeholder="ဥပမာ: ABCD-EFGH-1234-5678"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-emerald-400 focus:outline-none focus:border-amber-400 uppercase"
                />
              </div>

              {recoveryMode === 'reset' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-300">PIN အသစ် (၄~၈ လုံး) *</label>
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
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
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-emerald-400 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      PIN အသစ် ထပ်မံအတည်ပြုပါ *
                    </label>
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      maxLength={8}
                      required
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="PIN အသစ် ထပ်မံရိုက်ထည့်ပါ"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-emerald-400 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              {recoveryError && (
                <div className="p-2.5 bg-rose-950/80 border border-rose-700 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoverySuccess && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{recoverySuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecoveryModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  ပယ်ဖျက်မည်
                </button>
                <button
                  type="submit"
                  disabled={isProcessingRecovery}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>{isProcessingRecovery ? 'ဆောင်ရွက်နေပါသည်...' : 'အတည်ပြုမည်'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
