import React, { useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  KeyRound,
} from 'lucide-react';
import { AppLockSettings } from '../types';
import {
  verifyOwnerPin,
  derivePinCredentials,
  generateSecureRecoveryKey,
  deriveRecoveryCredentials,
} from '../services/cryptoSecurity';

interface ZeroSettingsConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmZeroReset: (options: { pin?: string; doubleConfirmed: boolean }) => Promise<void> | void;
  onLoadDemoData?: () => void;
  appLockSettings?: AppLockSettings | null;
  onUpdateAppLockSettings?: (settings: AppLockSettings) => void;
}

export const ZeroSettingsConfirmModal: React.FC<ZeroSettingsConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmZeroReset,
  onLoadDemoData,
  appLockSettings,
  onUpdateAppLockSettings,
}) => {
  const [doubleConfirmed, setDoubleConfirmed] = useState<boolean>(false);
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [newSetupPin, setNewSetupPin] = useState<string>('');
  const [confirmSetupPin, setConfirmSetupPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const hasConfiguredPin = Boolean(
    appLockSettings?.pinHash || appLockSettings?.passcode || appLockSettings?.pin
  );

  const handleSubmitGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');

    if (!doubleConfirmed) {
      setErrorMsg('လက်တွေ့စတင်အသုံးပြုရန် သဘောတူညီချက်ကို အမှန်ခြစ်ပေးပါ');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalPin = ownerPin.trim();

      // If PIN is not yet set up, initialize Owner PIN first
      if (!hasConfiguredPin) {
        if (!newSetupPin || newSetupPin.length < 4) {
          setErrorMsg('ဆိုင်ရှင် PIN အသစ်သည် အနည်းဆုံး ၄ လုံး (ဂဏန်းများ) ဖြစ်ရပါမည်');
          setIsSubmitting(false);
          return;
        }
        if (newSetupPin !== confirmSetupPin) {
          setErrorMsg('PIN အသစ်နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီမှုမရှိပါ');
          setIsSubmitting(false);
          return;
        }

        const pinCreds = await derivePinCredentials(newSetupPin);
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

        if (onUpdateAppLockSettings) {
          onUpdateAppLockSettings(updatedSettings);
        }
        finalPin = newSetupPin;
      } else {
        // Verify configured Owner PIN
        if (!finalPin) {
          setErrorMsg('ဆိုင်ရှင် PIN ရိုက်ထည့်ပေးပါ');
          setIsSubmitting(false);
          return;
        }

        const isValid = await verifyOwnerPin(finalPin, appLockSettings);
        if (!isValid) {
          setErrorMsg('ဆိုင်ရှင် PIN မှားယွင်းနေပါသည်။ ပြန်လည်စစ်ဆေးပါ');
          setIsSubmitting(false);
          return;
        }
      }

      await onConfirmZeroReset({ pin: finalPin, doubleConfirmed: true });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Go-Live စတင်ရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="zero-settings-confirm-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-500 text-slate-950 flex items-center justify-between border-b border-amber-600 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-950">
                အက်ပ်ကို လက်တွေ့ စတင်အသုံးပြုမည် (Go-Live Setting)
              </h3>
              <p className="text-xs font-semibold text-slate-800">
                နမူနာဒေတာများ ဖျက်သိမ်းပြီး ဆိုင်ရှင်ဒေတာချည်းဖြင့် စာရင်းအသစ် စတင်ခြင်း
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-zero-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitGoLive} className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed overflow-y-auto flex-1">
          {/* Warning Banner */}
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>သတိပြုရန် အချက်အလက်များ:</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              ဤလုပ်ငန်းစဉ်သည် စနစ်ကို <strong>Go-Live (လက်တွေ့သုံး အဆင့်)</strong> သို့ ပြောင်းလဲပေးမည်ဖြစ်ပြီး နမူနာ အရောင်းအဝယ်၊ ကုန်သိမ်းနှင့် အော်ဒါ မှတ်တမ်းများကို အလိုအလျောက် ရှင်းလင်းပေးပါမည်။ ဆိုင်ရှင် ကိုယ်တိုင် ထည့်သွင်းထားသော စာရင်းများချည်းသာ ကျန်ရှိပါမည်။
            </p>
          </div>

          {/* Detailed Changes list */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="font-bold text-slate-900 text-xs">
              Go-Live ပြုလုပ်ပါက အောက်ပါအတိုင်း ဆောင်ရွက်ပါမည်:
            </div>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>နမူနာ မှတ်တမ်းများ ဖျက်ခြင်း:</strong> စမ်းသပ်ထားသော အရောင်း၊ ကုန်သိမ်း၊ အော်ဒါ၊ ဆိုင်ချင်းဖလှယ်မှု နမူနာမှတ်တမ်း အားလုံးကို ရှင်းလင်းပါမည်။</span>
              </li>
              <li className="flex items-start gap-2 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>ဆိုင်ရှင် ဒေတာ ထိန်းသိမ်းခြင်း:</strong> ဆိုင်ရှင် ကိုယ်တိုင် ထည့်ထားသော ကုန်ပစ္စည်းစာရင်း၊ ပေးသွင်းသူနှင့် ကုန်သည် စာရင်းများကိုသာ စနစ်တကျ ဆက်လက်ထိန်းသိမ်းပေးပါမည်။</span>
              </li>
              <li className="flex items-start gap-2 text-blue-900 font-medium pt-1 border-t border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>Go-Live လုံခြုံရေး:</strong> Go-Live ပြီးပါက နမူနာဒေတာ ခလုတ်များကို ပိတ်ထားမည်ဖြစ်ပြီး ဆိုင်ရှင် PIN မပါဘဲ demo data ပြန်ထည့်ခွင့် ပိတ်ပင်ထားပါမည်။</span>
              </li>
            </ul>
          </div>

          {/* Owner PIN Authentication Section */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2.5 border border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>{hasConfiguredPin ? 'ဆိုင်ရှင် လုံခြုံရေး PIN ဖြင့် အတည်ပြုပါ' : 'ဆိုင်ရှင် PIN အသစ် သတ်မှတ်ပြီး စတင်ပါ'}</span>
            </div>

            {hasConfiguredPin ? (
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-300 font-semibold">
                  ဆိုင်ရှင် PIN (Owner PIN) ရိုက်ထည့်ပါ *
                </label>
                <div className="relative">
                  <input
                    id="golive-owner-pin-input"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    placeholder="PIN ဂဏန်း ရိုက်ထည့်ပါ"
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm tracking-widest focus:outline-none focus:border-amber-400"
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
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    ဆိုင်ရှင် PIN အသစ် (အနည်းဆုံး ၄ လုံး) *
                  </label>
                  <input
                    id="golive-new-pin-input"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    placeholder="ဥပမာ - 1234"
                    value={newSetupPin}
                    onChange={(e) => setNewSetupPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs tracking-wider focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    PIN အသစ် ထပ်မံအတည်ပြုပါ *
                  </label>
                  <input
                    id="golive-confirm-pin-input"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    placeholder="PIN အသစ် ပြန်ရိုက်ပါ"
                    value={confirmSetupPin}
                    onChange={(e) => setConfirmSetupPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs tracking-wider focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Double-Confirmation Checkbox */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-300 cursor-pointer select-none">
              <input
                id="golive-double-confirm-checkbox"
                type="checkbox"
                checked={doubleConfirmed}
                onChange={(e) => setDoubleConfirmed(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer mt-0.5 accent-amber-600"
              />
              <span className="font-bold text-amber-950 text-xs leading-snug">
                နမူနာဒေတာများ ဖျက်သိမ်းပြီး ဆိုင်ရှင်ဒေတာချည်းသာ ချန်ထားကာ စာရင်းအသစ်ဖြင့် လက်တွေ့စတင်အသုံးပြုမည်ဖြစ်ကြောင်း သေချာပါသည် (Double-Confirm)
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {onLoadDemoData ? (
              <button
                type="button"
                id="load-demo-from-zero-btn"
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
                id="cancel-zero-modal-btn"
                onClick={onClose}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="submit"
                id="confirm-golive-submit-btn"
                disabled={!doubleConfirmed || isSubmitting}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-md transition-all ${
                  doubleConfirmed && !isSubmitting
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'ဆောင်ရွက်နေပါသည်...' : 'Go-Live စတင်အသုံးပြုမည်'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
