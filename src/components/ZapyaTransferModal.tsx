import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Smartphone,
  FileSpreadsheet,
  ArrowRight,
  Wifi,
  Check,
  Upload,
  Share2,
  RefreshCw,
  GitMerge,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { safeJsonParse } from '../utils/security';
import {
  executeSyncMerge,
  buildLatestSyncPackage,
  persistMergedDataToDatabase,
  SyncMergeMode,
  SyncMergeResult,
} from '../services/syncMergeService';
import { db } from '../db/database';

function isValidSyncPayload(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (data.shweLetYarSync || data.formatVersion || data.version || data.data) return true;
  if (
    Array.isArray(data.products) ||
    Array.isArray(data.suppliers) ||
    Array.isArray(data.merchants) ||
    Array.isArray(data.transactions) ||
    Array.isArray(data.sales)
  ) {
    return true;
  }
  return false;
}

interface ZapyaTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData?: (data: any, mode?: 'MERGE' | 'OVERWRITE') => void;
}

export const ZapyaTransferModal: React.FC<ZapyaTransferModalProps> = ({
  isOpen,
  onClose,
  onImportData,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isPackaging, setIsPackaging] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Pending Import State for Merge vs Overwrite Confirmation Dialog
  const [pendingIncomingPayload, setPendingIncomingPayload] = useState<any | null>(null);
  const [isConfirmingMode, setIsConfirmingMode] = useState<boolean>(false);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // Return Sync Package State (Auto-Ready after merge/overwrite)
  const [returnPackageReady, setReturnPackageReady] = useState<boolean>(false);
  const [lastMergeResult, setLastMergeResult] = useState<SyncMergeResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Detect Network (Wifi / Hotspot / Online status)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Auto-Package & Send Data (Requirement 2)
  const handleSendData = async () => {
    try {
      setIsPackaging(true);
      const pkg = await buildLatestSyncPackage();
      const jsonStr = JSON.stringify(pkg, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const filename = `shwe-let-yar-backup-${nowStr}.json`;

      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'ရွှေလက်ရာ Zapya စာရင်းဖိုင်',
          text: `ရွှေလက်ရာ စာရင်း နောက်ဆုံးအခြေအနေ (${new Date().toLocaleDateString('my-MM')})`,
          files: [file],
        });
        setSuccessMsg('Zapya / Bluetooth ဖြင့် ပေးပို့ရန် မျှဝေပြီးပါပြီ');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessMsg('နောက်ဆုံး စာရင်းဖိုင်ကို ဒေါင်းလုဒ်ရယူပြီးပါပြီ (Zapya ဖွင့်၍ ပေးပို့ပါ)');
      }
      setIsPackaging(false);
    } catch (err) {
      console.error('Zapya send data error:', err);
      setIsPackaging(false);
    }
  };

  // 3. Receive Zapya File
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = safeJsonParse(content);
        if (!isValidSyncPayload(parsed)) {
          alert('ရွေးချယ်ထားသော ဖိုင်သည် ရွှေလက်ရာ စာရင်းဖိုင် ပုံစံမဟုတ်ပါ');
          return;
        }
        setPendingIncomingPayload(parsed);
        setIsConfirmingMode(true);
      } catch {
        alert('ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 4. Confirmation Dialog handler (Requirement 4 & 5)
  const handleConfirmSyncMode = async (mode: SyncMergeMode) => {
    if (!pendingIncomingPayload) return;
    setIsMerging(true);

    try {
      const [
        products,
        suppliers,
        merchants,
        transactions,
        sales,
        merchantPurchases,
        orders,
        stockAdjustments,
        peerTrades,
      ] = await Promise.all([
        db.products.toArray(),
        db.suppliers.toArray(),
        db.merchants.toArray(),
        db.transactions.toArray(),
        db.sales.toArray(),
        db.merchantPurchases.toArray(),
        db.orders.toArray(),
        db.stockAdjustments.toArray(),
        db.peerTrades.toArray(),
      ]);
      const shopSettingsRecord = await db.settings.get('shopSettings');

      const localSnapshot = {
        products,
        suppliers,
        merchants,
        transactions,
        sales,
        merchantPurchases,
        orders,
        stockAdjustments,
        peerTrades,
        shopSettings: shopSettingsRecord?.value,
      };

      const mergeResult = await executeSyncMerge(localSnapshot, pendingIncomingPayload, { mode });

      if (mergeResult.success) {
        await persistMergedDataToDatabase(mergeResult.mergedData);

        if (onImportData) {
          onImportData(mergeResult.mergedData, mode);
        }

        setLastMergeResult(mergeResult);
        setReturnPackageReady(true);
        setIsConfirmingMode(false);
        setPendingIncomingPayload(null);
        setSuccessMsg(mergeResult.message);
      } else {
        alert(mergeResult.message || 'စာရင်း ပေါင်းစည်းမှု မအောင်မြင်ပါ');
        setIsConfirmingMode(false);
      }
    } catch (err: any) {
      console.error('Merge execution error:', err);
      alert(`ပေါင်းစည်းမှု ချို့ယွင်းချက်: ${err?.message || 'Error merging data'}`);
      setIsConfirmingMode(false);
    } finally {
      setIsMerging(false);
    }
  };

  const getIncomingSummary = (payload: any) => {
    if (!payload) return null;
    const raw = payload.data || payload;
    return {
      shopName: payload.shopName || raw.shopSettings?.name || 'အခြားဖုန်း/စက်',
      timestamp: payload.timestamp ? new Date(payload.timestamp).toLocaleString('my-MM') : 'မသိရှိပါ',
      productsCount: Array.isArray(raw.products) ? raw.products.length : 0,
      transactionsCount: Array.isArray(raw.transactions) ? raw.transactions.length : 0,
      salesCount: Array.isArray(raw.sales) ? raw.sales.length : 0,
    };
  };

  if (!isOpen) return null;

  const incomingSummary = getIncomingSummary(pendingIncomingPayload);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-amber-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-300" />
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">Zapya / Bluetooth ဖြင့် ပေးပို့နည်း</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/50">
                Direct
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-amber-950 hover:bg-amber-800 text-amber-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Status Banner (Requirement 1) */}
        <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="font-semibold text-slate-700 text-[11px]">
              {isOnline ? 'Wi-Fi / Hotspot ချိတ်ဆက်မှု အဆင်သင့်' : 'အော့ဖ်လိုင်း Direct Transfer အဆင်သင့်'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>ပို့ရန် အဆင်သင့်</span>
          </span>
        </div>

        <div className="p-4 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-bold animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* CONFIRMATION DIALOG: Merge vs Overwrite (Requirement 4) */}
          {isConfirmingMode && incomingSummary && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 border border-slate-700 shadow-xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-100">စာရင်းပေါင်းစည်းမှု ရွေးချယ်ပါ</h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingMode(false);
                    setPendingIncomingPayload(null);
                  }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  မလုပ်ပါ
                </button>
              </div>

              <div className="p-2.5 bg-slate-800/80 rounded-xl text-[11px] space-y-1 border border-slate-700">
                <div className="flex justify-between text-slate-300">
                  <span>ပေးပို့သူ:</span>
                  <span className="font-bold text-emerald-300">{incomingSummary.shopName}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                  <div className="bg-slate-900/60 p-1 rounded">
                    <span className="text-slate-400 block text-[9px]">ကုန်ပစ္စည်း</span>
                    <span className="font-bold text-white text-xs">{incomingSummary.productsCount}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1 rounded">
                    <span className="text-slate-400 block text-[9px]">ဝယ်ယူမှု</span>
                    <span className="font-bold text-white text-xs">{incomingSummary.transactionsCount}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1 rounded">
                    <span className="text-slate-400 block text-[9px]">အရောင်း</span>
                    <span className="font-bold text-white text-xs">{incomingSummary.salesCount}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isMerging}
                  onClick={() => handleConfirmSyncMode('MERGE')}
                  className="w-full p-3 bg-emerald-950/80 hover:bg-emerald-900 border-2 border-emerald-500 rounded-xl text-left transition-all cursor-pointer flex items-start gap-2.5"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-200">
                        စမတ်ပေါင်းစည်းမည် (Smart Merge)
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold">
                        အကြံပြုချက်
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-300/90 leading-relaxed">
                      ဖုန်းနှစ်လုံးလုံးရှိ စာရင်းများကို မပျောက်ပျက်စေဘဲ ပေါင်းစည်းမည် (Newer Wins + Disjoint Union).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isMerging}
                  onClick={() => {
                    if (window.confirm('လက်ရှိစာရင်းများကို ဖျက်၍ ဖိုင်ဖြင့် အစားထိုးပါမည်လား?')) {
                      handleConfirmSyncMode('OVERWRITE');
                    }
                  }}
                  className="w-full p-2.5 bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500 rounded-xl text-left transition-all cursor-pointer flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1">
                    <span className="text-xs font-bold text-slate-200">
                      အားလုံး အစားထိုးမည် (Clean Overwrite)
                    </span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      လက်ရှိစာရင်းများကို ဖျက်၍ ပေးပို့လာသော ဖိုင်ဖြင့် အစားထိုးမည်။
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* RETURN SYNC PACKAGE AUTO-READY BANNER (Requirement 5) */}
          {returnPackageReady && (
            <div className="p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-900">
                <RotateCcw className="w-4 h-4 text-emerald-600 animate-spin" style={{ animationDuration: '3s' }} />
                <h4 className="text-xs font-extrabold">ကျန်စက်ဆီ ပြန်ပို့ရန် အဆင်သင့်ဖြစ်ပါသည်</h4>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                စာရင်းပေါင်းစည်းမှု အောင်မြင်ပါသည်! ပေါင်းစည်းထားသော စာရင်းအသစ်ကို ကျန်ဖုန်းဆီ ပြန်လည်ပို့ဆောင်ရန် အဆင်သင့် ထုတ်ပေးထားပါသည်။
              </p>
              <button
                type="button"
                onClick={handleSendData}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ကျန်ဖုန်းဆီ ပြန်ပို့မည် (Send Synced File Back)</span>
              </button>
            </div>
          )}

          {!isConfirmingMode && (
            <>
              <p className="text-slate-600 leading-relaxed font-medium">
                အင်တာနက်လိုင်းမရှိသော ကျေးရွာများတွင် Zapya, ShareMe သို့မဟုတ် Bluetooth ဖြင့် စာရင်းဖိုင်ကို အလွယ်တကူ ပေးပို့လက်ခံနိုင်ပါသည်:
              </p>

              <ol className="list-decimal list-inside space-y-2 text-slate-700 font-medium">
                <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <strong>အဆင့် ၁: ဒေတာပို့မည် ကို နှိပ်ပါ</strong>
                  <p className="text-[11px] text-slate-500 pl-4">
                    နောက်ဆုံး update ဖိုင်ကို ထုတ်ယူ၍ Zapya သို့မဟုတ် Bluetooth ဖြင့် ပေးပို့ပါ။
                  </p>
                </li>
                <li className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <strong>အဆင့် ၂: လက်ခံသည့်ဖုန်းတွင် ဖိုင်ပြန်သွင်းပါ</strong>
                  <p className="text-[11px] text-slate-500 pl-4">
                    အောက်ပါ "Zapya ဖိုင် သွင်းယူမည်" ကို နှိပ်ပြီး ရောက်ရှိလာသော ဖိုင်ကို ရွေးချယ်ပါ။
                  </p>
                </li>
              </ol>

              {/* Send Button (Requirement 2) */}
              <button
                type="button"
                onClick={handleSendData}
                disabled={isPackaging}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
              >
                {isPackaging ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Smartphone className="w-4 h-4" />
                )}
                <span>{isPackaging ? 'ဖိုင်ထုပ်ပိုးနေပါသည်...' : 'ဒေတာပို့မည် (Zapya ဖြင့် ပို့ရန် ဖိုင်ထုတ်ယူမည်)'}</span>
              </button>

              {/* Receive File Picker */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Zapya မှ ရရှိသော ဖိုင်သွင်းယူမည် (Receive File)</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>ဒေတာများ လုံခြုံစွာ စစ်ဆေးပြီး ပေါင်းစည်းပါသည်</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
