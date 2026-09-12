import React, { useState } from 'react';
import {
  X,
  Crown,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { UserSession, AppLockSettings } from '../types';
import { switchUserSession } from '../services/authorizationService';
import {
  derivePinCredentials,
  deriveRecoveryCredentials,
  generateSecureRecoveryKey,
} from '../services/cryptoSecurity';
import { saveAppLockSettings } from '../utils/storage';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: UserSession | null;
  appLockSettings?: AppLockSettings;
  onSessionChanged: (newSession: UserSession | null) => void;
  onLogout: () => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  onClose,
  currentSession,
  appLockSettings,
  onSessionChanged,
  onLogout,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<'OWNER' | 'USER' | null>(null);
  const [pinInput, setPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const isOwnerActive = currentSession?.role === 'OWNER';
  const hasConfiguredPin = Boolean(
    appLockSettings?.enabled &&
      (appLockSettings?.pinHash || appLockSettings?.passcode || appLockSettings?.pin)
  );

  const handleSwitchToStaff = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const newSession = await switchUserSession('USER');
      onSessionChanged(newSession);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'ဝန်ထမ်းအကောင့်သို့ ပြောင်းလဲရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwitchToOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (!hasConfiguredPin) {
        // First time setup PIN
        const cleanPin = pinInput.trim();
        const cleanConfirm = confirmPinInput.trim();

        if (cleanPin.length < 4) {
          setErrorMsg('PIN သည် အနည်းဆုံး ၄ လုံး (ဂဏန်းများ) ဖြစ်ရပါမည်');
          setIsProcessing(false);
          return;
        }

        if (cleanPin !== cleanConfirm) {
          setErrorMsg('PIN အသစ်နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီမှုမရှိပါ');
          setIsProcessing(false);
          return;
        }

        const pinCreds = await derivePinCredentials(cleanPin);
        const recKey = generateSecureRecoveryKey();
        const recCreds = await deriveRecoveryCredentials(recKey);

        const updatedSettings: AppLockSettings = {
          ...(appLockSettings || { enabled: true, autoLockMinutes: 5, lockOnStartup: true }),
          enabled: true,
          isPinInitialized: true,
          pinSalt: pinCreds.salt,
          pinHash: pinCreds.hash,
          recoverySalt: recCreds.salt,
          recoveryHash: recCreds.hash,
          recoveryKeyDisplay: recKey,
          failedAttempts: 0,
          lockedUntilTimestamp: undefined,
          lastResetAt: new Date().toISOString(),
          lastUnlockedAt: new Date().toISOString(),
        };
        delete updatedSettings.passcode;
        delete updatedSettings.pin;

        saveAppLockSettings(updatedSettings);

        const newSession = await switchUserSession('OWNER', { pin: cleanPin });
        onSessionChanged(newSession);
        onClose();
      } else {
        // Standard Owner PIN verification
        const newSession = await switchUserSession('OWNER', {
          pin: pinInput,
        });
        onSessionChanged(newSession);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'ဆိုင်ရှင်အကောင့်သို့ ပြောင်းလဲရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-left text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">အသုံးပြုသူ အကောင့် ပြောင်းလဲခြင်း</h2>
              <p className="text-[11px] text-slate-400">
                လက်ရှိ: <span className="font-bold text-amber-300">{currentSession?.displayName || 'အကောင့်မရှိသေးပါ'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-rose-950/80 border border-rose-700 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Target Options */}
        {selectedTarget !== 'OWNER' ? (
          <div className="mt-4 space-y-3">
            {/* Switch to Owner */}
            <button
              type="button"
              disabled={isOwnerActive || isProcessing}
              onClick={() => {
                setSelectedTarget('OWNER');
                setPinInput('');
                setConfirmPinInput('');
                setErrorMsg('');
              }}
              className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                isOwnerActive
                  ? 'bg-amber-500/10 border-amber-400/40 opacity-70 cursor-default'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-amber-400/80 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-200">ဆိုင်ရှင် (Owner)</span>
                    {isOwnerActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                        လက်ရှိအကောင့်
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ဆက်တင်၊ စာရင်းချုပ်နှင့် လုပ်ပိုင်ခွင့် အပြည့်အစုံ
                  </p>
                </div>
              </div>
              {!isOwnerActive && <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />}
            </button>

            {/* Switch to Staff */}
            <button
              type="button"
              disabled={!isOwnerActive || isProcessing}
              onClick={handleSwitchToStaff}
              className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                !isOwnerActive
                  ? 'bg-emerald-500/10 border-emerald-400/40 opacity-70 cursor-default'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-emerald-500/80 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">အရောင်း/ဝန်ထမ်း (Staff)</span>
                    {!isOwnerActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        လက်ရှိအကောင့်
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    နေ့စဉ် အရောင်းဘောင်ချာနှင့် ပစ္စည်းလက်ခံခြင်း
                  </p>
                </div>
              </div>
              {isOwnerActive && <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />}
            </button>

            {/* Complete Logout / Lock */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full py-2.5 px-4 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/60 text-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>စနစ်မှ အပြီးထွက်မည် (Log Out / Lock)</span>
              </button>
            </div>
          </div>
        ) : (
          /* OWNER PIN PROMPT OR SETUP */
          <form onSubmit={handleSwitchToOwnerSubmit} className="mt-4 space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-center gap-2">
              <KeyRound className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                {hasConfiguredPin
                  ? 'ဆိုင်ရှင်အဆင့်သို့ ပြောင်းလဲရန် ဆိုင်ရှင် PIN ရိုက်ထည့်ပါ'
                  : 'ပထမဆုံးအကြိမ် ဆိုင်ရှင် PIN သတ်မှတ်ပါ'}
              </span>
            </div>

            {hasConfiguredPin ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ဆိုင်ရှင် PIN *</label>
                <input
                  type="password"
                  autoFocus
                  maxLength={8}
                  required
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN ၄ လုံး ရိုက်ထည့်ပါ"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest text-lg text-amber-400 focus:outline-none focus:border-amber-400"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">ဆိုင်ရှင် PIN အသစ် *</label>
                  <input
                    type="password"
                    autoFocus
                    maxLength={8}
                    required
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="PIN အသစ် ရိုက်ထည့်ပါ (အနည်းဆုံး ၄ လုံး)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest text-lg text-amber-400 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">PIN အသစ် ထပ်မံအတည်ပြုပါ *</label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="PIN အသစ် ပြန်ရိုက်ထည့်ပါ"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center tracking-widest text-lg text-amber-400 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedTarget(null);
                  setPinInput('');
                  setConfirmPinInput('');
                  setErrorMsg('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                နောက်သို့
              </button>
              <button
                type="submit"
                disabled={isProcessing || pinInput.length < 4}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>
                  {isProcessing
                    ? 'ဆောင်ရွက်နေပါသည်...'
                    : hasConfiguredPin
                    ? 'ဆိုင်ရှင်အဖြစ် ပြောင်းမည်'
                    : 'PIN သတ်မှတ်၍ ဝင်မည်'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
