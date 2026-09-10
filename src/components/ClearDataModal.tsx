import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: () => void;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
}) => {
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const handleClear = () => {
    if (confirmText === 'CLEAR') {
      onConfirmClear();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        <div className="px-4 py-3 bg-rose-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold">အချက်အလက်အားလုံး ရှင်းလင်းခြင်း</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-rose-900 hover:bg-rose-800 text-rose-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-700 leading-relaxed font-semibold">
            သတိပြုရန် - ဤလုပ်ဆောင်ချက်သည် စာရင်းများ၊ အရောင်း၊ ကုန်သိမ်းမှုနှင့် အကြိုငွေမှတ်တမ်းအားလုံးကို ရှင်းလင်းဖျက်ပစ်မည်ဖြစ်ပြီး ပြန်လည်ရယူနိုင်မည်မဟုတ်ပါ။
          </p>

          <div>
            <label className="block text-slate-600 font-bold mb-1">
              အတည်ပြုရန် <strong>CLEAR</strong> ဟု စာလုံးကြီးဖြင့် ရိုက်ထည့်ပါ:
            </label>
            <input
              type="text"
              placeholder="CLEAR"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-rose-300 rounded-lg text-sm font-bold tracking-widest text-center"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="button"
              disabled={confirmText !== 'CLEAR'}
              onClick={handleClear}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                confirmText === 'CLEAR'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>အကုန်ရှင်းမည်</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
