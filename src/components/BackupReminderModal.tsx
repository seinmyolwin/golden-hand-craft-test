import React from 'react';
import { X, ShieldAlert, Download } from 'lucide-react';
import { exportAllDataJSON } from '../utils/storage';

interface BackupReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupNow: () => void;
}

export const BackupReminderModal: React.FC<BackupReminderModalProps> = ({
  isOpen,
  onClose,
  onBackupNow,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold">စာရင်းမိတ္တူ ကူးယူရန် သတိပေးချက်</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-600 leading-relaxed">
            စာရင်းအချက်အလက်များ လုံခြုံစွာရှိစေရန်အတွက် ယနေ့လုပ်ငန်းသိမ်းချိန်တွင် မိတ္တူ (Backup) သိမ်းဆည်းရန် အကြံပြုအပ်ပါသည်။
          </p>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
            >
              နောက်မှ
            </button>
            <button
              type="button"
              onClick={() => {
                exportAllDataJSON();
                onBackupNow();
                onClose();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ယခု မိတ္တူသိမ်းမည်</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
