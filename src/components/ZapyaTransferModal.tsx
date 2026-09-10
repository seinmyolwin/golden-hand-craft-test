import React from 'react';
import { X, Send, Smartphone, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { exportAllDataJSON, exportDailyCollectionCSV } from '../utils/storage';

interface ZapyaTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZapyaTransferModal: React.FC<ZapyaTransferModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        <div className="px-4 py-3 bg-amber-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-300" />
            <h3 className="text-sm font-bold">Zapya / Bluetooth ဖြင့် စာရင်းဖိုင် ပေးပို့နည်း</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-amber-950 hover:bg-amber-800 text-amber-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          <p className="text-slate-600 leading-relaxed">
            အင်တာနက်လိုင်းမရှိသော ကျေးရွာများတွင် Zapya, ShareMe သို့မဟုတ် Bluetooth ဖြင့် စာရင်းဖိုင်ကို အောက်ပါအဆင့်များအတိုင်း အလွယ်တကူ လွှဲပြောင်းနိုင်ပါသည်:
          </p>

          <ol className="list-decimal list-inside space-y-2 text-slate-700 font-medium">
            <li className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              အောက်ပါ <strong>"မိတ္တူဖိုင် ဒေါင်းလုဒ်ဆွဲမည်"</strong> ခလုတ်ကို နှိပ်၍ ဖိုင်ကို စက်ထဲ သိမ်းယူပါ။
            </li>
            <li className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              Zapya သို့မဟုတ် ShareIt ဖွင့်ပြီး ဒေါင်းလုဒ်ဖိုင်တွဲ (Download folder) ထဲမှ <code>shwe-let-yar-backup-*.json</code> ဖိုင်ကို အခြားဖုန်းသို့ ပေးပို့ပါ။
            </li>
            <li className="p-2 bg-slate-50 rounded-lg border border-slate-200">
              လက်ခံသည့်ဖုန်းတွင် ဤဆော့ဖ်ဝဲကိုဖွင့်၍ <strong>"မိတ္တူဖိုင်မှ စာရင်းပြန်သွင်းမည်"</strong> ကို နှိပ်ပြီး ထိုဖိုင်ကို ရွေးချယ်ပေးပါ။
            </li>
          </ol>

          <button
            type="button"
            onClick={exportAllDataJSON}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            <span>Zapya ဖြင့် ပို့ရန် မိတ္တူဖိုင် ဒေါင်းလုဒ်ဆွဲမည်</span>
          </button>
        </div>
      </div>
    </div>
  );
};
