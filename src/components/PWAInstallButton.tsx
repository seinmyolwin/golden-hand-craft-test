import React, { useState } from 'react';
import { Download, Share, PlusSquare, CheckCircle, Info, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'badge' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, canPromptDirectly, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  if (isInstalled) {
    if (variant === 'badge') {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>အက်ပ်သွင်းယူပြီးပါပြီ (Installed)</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (canPromptDirectly) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {variant === 'card' ? (
        <div className={`p-4 bg-emerald-50 border border-emerald-200 rounded-xl ${className}`}>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-emerald-950 text-sm">
                အင်တာနက်မလိုဘဲ တိုက်ရိုက်သုံးရန် အက်ပ်သွင်းယူပါ
              </h4>
              <p className="text-xs text-emerald-800 mt-1">
                ဖုန်း သို့မဟုတ် ကွန်ပျူတာ ပင်မမျက်နှာပြင်တွင် ထည့်သွင်းထားပါက လိုင်းမရှိသည့်တိုင် ပိုမိုမြန်ဆန်စွာ ဖွင့်လှစ်အသုံးပြုနိုင်ပါသည်။
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-lg shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isInstalling ? 'သွင်းယူနေပါသည်...' : 'အက်ပ် သွင်းယူမည် (Install App)'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          title="Install App as Offline PWA"
          className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-200 border border-emerald-400 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-emerald-950 stroke-[2.5]" />
          <span>{isInstalling ? 'သွင်းနေပါသည်...' : 'အက်ပ်သွင်းယူရန်'}</span>
        </button>
      )}

      {/* iOS Manual Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">iOS (iPhone/iPad) တွင် အက်ပ်သွင်းယူနည်း</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Safari ဘရောက်ဇာတွင် အောက်ပါအဆင့်အတိုင်း ပင်မမျက်နှာပြင်သို့ ထည့်သွင်းနိုင်ပါသည်-
              </p>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="p-1.5 bg-slate-200 rounded text-slate-700">
                  <Share className="w-4 h-4" />
                </div>
                <span>၁။ Safari အောက်ဘက်ရှိ <strong>Share (မျှဝေရန်)</strong> ခလုတ်ကို နှိပ်ပါ။</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="p-1.5 bg-slate-200 rounded text-slate-700">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <span>၂။ အောက်သို့ဆွဲပြီး <strong>'Add to Home Screen'</strong> (ပင်မမျက်နှာပြင်သို့ ထည့်ရန်) ကို ရွေးချယ်ပါ။</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="p-1.5 bg-emerald-600 text-white rounded">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span>၃။ ညာဘက်အပေါ်ထောင့်ရှိ <strong>'Add' (ထည့်ရန်)</strong> ကို နှိပ်ပြီး ပြီးဆုံးပါပြီ။</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2 bg-emerald-700 text-white font-medium text-xs rounded-xl hover:bg-emerald-800 transition-colors"
            >
              နားလည်ပါပြီ (Done)
            </button>
          </div>
        </div>
      )}
    </>
  );
};
