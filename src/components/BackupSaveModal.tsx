import React, { useRef } from 'react';
import { exportAllDataJSON, exportDailyCollectionCSV, exportMerchantSalesCSV } from '../utils/storage';
import { X, Download, Upload, Shield, CheckCircle2, FileText, Database } from 'lucide-react';

interface BackupSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBackup: (importedData: any, mode?: 'MERGE' | 'OVERWRITE') => void;
}

export const BackupSaveModal: React.FC<BackupSaveModalProps> = ({
  isOpen,
  onClose,
  onImportBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingData, setPendingData] = React.useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setPendingData(json);
      } catch (err) {
        alert('ဖိုင်ဖတ်ရှု၍ မရပါ၊ မှန်ကန်သော JSON backup ဖိုင်ဖြစ်ပါစေ');
      }
    };
    reader.readAsText(file);
    // Reset file input so user can re-select same file if needed
    e.target.value = '';
  };

  const handleConfirmMerge = () => {
    if (!pendingData) return;
    onImportBackup(pendingData, 'MERGE');
    setPendingData(null);
    onClose();
  };

  const handleConfirmOverwrite = () => {
    if (!pendingData) return;
    if (confirm('သတိပေးချက် - လက်ရှိစာရင်းများအားလုံးကို အစားထိုးမည်မှာ သေချာပါသလား?')) {
      onImportBackup(pendingData, 'OVERWRITE');
      setPendingData(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold">အချက်အလက် မိတ္တူကူးခြင်းနှင့် ပြန်သွင်းခြင်း</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          <p className="text-slate-600 leading-relaxed">
            ဖုန်း သို့မဟုတ် ကွန်ပျူတာ ပျက်စီး/ပျောက်ဆုံးပါက စာရင်းများမဆုံးရှုံးစေရန် အပတ်စဉ် သို့မဟုတ် လစဉ် မိတ္တူ (Backup) သိမ်းဆည်းထားသင့်ပါသည်။
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={exportAllDataJSON}
              className="w-full p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-between font-bold text-emerald-900 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-700" />
                <span>စာရင်းအားလုံး အပြည့်အစုံ သိမ်းမည် (JSON Backup)</span>
              </div>
              <Download className="w-4 h-4 text-emerald-700" />
            </button>

            <button
              type="button"
              onClick={exportDailyCollectionCSV}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between font-bold text-slate-800 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                <span>ကုန်သိမ်းမှတ်တမ်း Excel/CSV ထုတ်ယူမည်</span>
              </div>
              <Download className="w-4 h-4 text-slate-600" />
            </button>

            <button
              type="button"
              onClick={exportMerchantSalesCSV}
              className="w-full p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-between font-bold text-blue-900 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>အရောင်းမှတ်တမ်း Excel/CSV ထုတ်ယူမည်</span>
              </div>
              <Download className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          {pendingData ? (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs sm:text-sm">
                    မိတ္တူဖိုင် ဖတ်ရှုပြီးပါပြီ
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    မည်သည့်ပုံစံဖြင့် စာရင်းပြန်သွင်းလိုပါသလဲ ရွေးချယ်ပေးပါ-
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmMerge}
                  className="w-full p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex flex-col items-start gap-0.5 cursor-pointer transition-colors shadow-2xs text-left"
                >
                  <span className="flex items-center gap-1.5 font-black">
                    🔄 စာရင်းများ ပေါင်းစည်းမည် (Smart Merge - အကြံပြုထားသည်)
                  </span>
                  <span className="text-[10px] text-emerald-100 font-normal">
                    လက်ရှိစာရင်းများ မပျောက်ဘဲ မိတ္တူဖိုင်မှ အသစ်များကိုသာ စစ်ဆေးပေါင်းစပ်ထည့်သွင်းပါမည်
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmOverwrite}
                  className="w-full p-2.5 bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 rounded-lg font-bold text-xs flex flex-col items-start gap-0.5 cursor-pointer transition-colors text-left"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    ⚠️ လက်ရှိစာရင်းအားလုံး အစားထိုးမည် (Full Overwrite)
                  </span>
                  <span className="text-[10px] text-rose-600 font-normal">
                    လက်ရှိစာရင်းများကို ဖျက်ပြီး မိတ္တူဖိုင်ပါအတိုင်း အစအဆုံး ပြန်လည်ထားရှိပါမည်
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPendingData(null)}
                  className="w-full py-1.5 text-center text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  မလုပ်တော့ပါ (Cancel)
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-200">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>မိတ္တူဖိုင်မှ စာရင်းပြန်သွင်းမည် (Restore Backup)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
