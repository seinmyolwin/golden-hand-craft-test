import React from 'react';
import { X, CheckCircle, Receipt, ArrowRight } from 'lucide-react';

interface ActionVoucherPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onOpenVoucher: () => void;
}

export const ActionVoucherPromptModal: React.FC<ActionVoucherPromptModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  onOpenVoucher,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 p-4 text-center">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h3 className="font-extrabold text-base text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-600 mb-4">{message}</p>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
          >
            ပြီးပါပြီ
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenVoucher();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>ဘောင်ချာ ကြည့်မည်</span>
          </button>
        </div>
      </div>
    </div>
  );
};
