import React from 'react';
import { MerchantOrder } from '../types';
import { formatMMK } from '../utils/storage';
import { X, Bell, ShoppingBag, ArrowRight } from 'lucide-react';

interface NewOrderNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: MerchantOrder | null;
  onGoToOrders: () => void;
}

export const NewOrderNotificationModal: React.FC<NewOrderNotificationModalProps> = ({
  isOpen,
  onClose,
  order,
  onGoToOrders,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-indigo-500/40 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/50 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 animate-bounce" />
        </div>
        <div className="flex-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-300">အော်ဒါအသစ် ရောက်ရှိလာပါသည်!</span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h4 className="font-extrabold text-sm text-white mt-1">
            {order.merchantName} ({order.merchantTown})
          </h4>
          <p className="text-slate-300 mt-0.5">
            ခန့်မှန်းတန်ဖိုး: {formatMMK(order.totalEstimatedValue)}
          </p>

          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToOrders();
            }}
            className="mt-2.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>အော်ဒါစာရင်းသို့ သွားမည်</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
