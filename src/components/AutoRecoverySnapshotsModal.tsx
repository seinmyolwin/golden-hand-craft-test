import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RotateCcw,
  Trash2,
  Download,
  ShieldCheck,
  Calendar,
  Clock,
  Database,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { AutoRecoverySnapshot } from '../types';
import {
  getRecoverySnapshots,
  restoreFromSnapshot,
  deleteRecoverySnapshot,
  clearAllRecoverySnapshots,
  downloadBackupFile,
  createCompleteBackup,
} from '../services/backupService';

interface AutoRecoverySnapshotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: (msg: string) => void;
}

export const AutoRecoverySnapshotsModal: React.FC<AutoRecoverySnapshotsModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const [snapshots, setSnapshots] = useState<AutoRecoverySnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const list = await getRecoverySnapshots();
      setSnapshots(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
      setActionMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRollback = async (snapshot: AutoRecoverySnapshot) => {
    const confirmed = window.confirm(
      `⚠️ အရေးကြီးသတိပေးချက်:\n\n${snapshot.date} ${snapshot.time} ရှိ Snapshot သို့ စာရင်းများ ပြန်လည်ပြောင်းလဲမည်မှာ သေချာပါသလား?\n\n(ယခုလက်ရှိစာရင်းများကိုလည်း Emergency Snapshot အဖြစ် အလိုအလျောက် သိမ်းဆည်းထားပေးပါမည်)`
    );
    if (!confirmed) return;

    try {
      const res = await restoreFromSnapshot(snapshot.id);
      onRestoreSuccess(res.message);
      onClose();
    } catch (e: any) {
      alert(`Rollback မအောင်မြင်ပါ: ${e.message}`);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    if (confirm('ဤ Snapshot ကို ဖျက်မည်မှာ သေချာပါသလား?')) {
      await deleteRecoverySnapshot(snapshotId);
      loadSnapshots();
    }
  };

  const handleClearAll = async () => {
    if (confirm('Snapshot အားလုံးကို အပြီးတိုင် ရှင်းထုတ်မည်မှာ သေချာပါသလား?')) {
      await clearAllRecoverySnapshots();
      loadSnapshots();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>အလိုအလျောက် အရန်သိမ်းမှတ်တမ်းများ (Auto Recovery Snapshots)</span>
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                  {snapshots.length} ခု
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Restore မပြုလုပ်မီ သို့မဟုတ် အရေးကြီး လုပ်ဆောင်ချက်များမတိုင်မီ စနစ်မှ အလိုအလျောက် ရိုက်ယူထားသော ဒေတာပုံရိပ်များ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-blue-950">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>စနစ်၏ လုံခြုံစိတ်ချရမှု အာမခံချက်: </strong>
              ဒေတာများ ပြန်သွင်းသည့်အခါတိုင်း စက်တွင်း IndexedDB တွင် Auto Recovery Snapshot အလိုအလျောက် ရိုက်ယူပေးထားသဖြင့် မတော်တဆ မှားယွင်း restore လုပ်မိလျှင်ပင် ဤနေရာမှ မူလအခြေအနေသို့ ချက်ချင်း ပြန်လည်ရောက်ရှိနိုင်ပါသည်။
            </div>
          </div>

          {snapshots.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <Database className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">လက်ရှိတွင် Snapshot များ မရှိသေးပါ</h4>
              <p className="text-slate-500 text-[11px]">
                ဒေတာ Restore သို့မဟုတ် စနစ်စတင်ခြင်းများ လုပ်ဆောင်သည့်အခါ အလိုအလျောက် ပေါ်လာပါမည်။
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {snap.date} {snap.time}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        ID: {snap.id}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 font-medium">
                      {snap.reason || 'Auto Safety Snapshot'}
                    </p>

                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-0.5">
                      <span>ကုန်ပစ္စည်း: <strong>{snap.recordCounts?.products || 0}</strong></span>
                      <span>•</span>
                      <span>ပေးသွင်းသူ: <strong>{snap.recordCounts?.suppliers || 0}</strong></span>
                      <span>•</span>
                      <span>ကုန်သည်: <strong>{snap.recordCounts?.merchants || 0}</strong></span>
                      <span>•</span>
                      <span>ဘောင်ချာ: <strong>{(snap.recordCounts?.transactions || 0) + (snap.recordCounts?.sales || 0)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRollback(snap)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>ပြန်လည်ရယူမည် (Rollback)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(snap.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      title="ဖျက်မည်"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {snapshots.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Snapshot အားလုံး ရှင်းထုတ်မည်</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            ပိတ်မည် (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
