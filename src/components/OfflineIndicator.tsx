import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, HardDrive, CheckCircle2, ShieldCheck } from 'lucide-react';

export const OfflineIndicator: React.FC<{ className?: string; showDetails?: boolean }> = ({
  className = '',
  showDetails = false,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [storageUsage, setStorageUsage] = useState<{ usedMb: number; quotaMb: number } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Query local storage estimate
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        if (est.usage !== undefined && est.quota !== undefined) {
          setStorageUsage({
            usedMb: Math.round((est.usage / (1024 * 1024)) * 10) / 10,
            quotaMb: Math.round(est.quota / (1024 * 1024)),
          });
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Offline/Online Status Pill */}
      {!isOnline ? (
        <div className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-bold text-amber-200 bg-amber-950/90 border border-amber-400/60 rounded-xl shadow-2xs animate-pulse">
          <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="whitespace-nowrap">အော့ဖ်လိုင်းမုဒ် (Offline Active)</span>
        </div>
      ) : (
        <div className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-bold text-emerald-100 bg-emerald-950/80 border border-emerald-400/50 rounded-xl shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          <span className="whitespace-nowrap">100% Offline Ready</span>
        </div>
      )}

      {/* Storage quota info when showDetails is true */}
      {showDetails && storageUsage && (
        <div className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-300 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700">
          <HardDrive className="w-3 h-3 text-slate-400" />
          <span>စက်တွင်းသိုလှောင်မှု: {storageUsage.usedMb} MB</span>
        </div>
      )}
    </div>
  );
};
