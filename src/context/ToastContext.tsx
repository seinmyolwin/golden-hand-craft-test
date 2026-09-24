import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showConfirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    options: ConfirmDialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback((options: ConfirmDialogOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmDialogOptions =
        typeof options === 'string'
          ? { message: options, confirmText: 'သေချာပါသည်', cancelText: 'မလုပ်တော့ပါ' }
          : {
              confirmText: 'သေချာပါသည်',
              cancelText: 'မလုပ်တော့ပါ',
              ...options,
            };
      setConfirmDialog({ options: opts, resolve });
    });
  }, []);

  const handleConfirmResponse = useCallback((result: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(result);
      setConfirmDialog(null);
    }
  }, [confirmDialog]);

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Floating Toast Notification Stack */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => {
          let bg = 'bg-slate-900 border-slate-700 text-white';
          let icon = <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />;

          if (t.type === 'success') {
            bg = 'bg-emerald-900/95 border-emerald-600 text-emerald-50';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
          } else if (t.type === 'error') {
            bg = 'bg-rose-950/95 border-rose-600 text-rose-50';
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
          } else if (t.type === 'warning') {
            bg = 'bg-amber-950/95 border-amber-600 text-amber-50';
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
          }

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-2 ${bg}`}
            >
              {icon}
              <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                {t.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                aria-label="ပိတ်ရန်"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Reusable Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    confirmDialog.options.isDangerous
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900">
                    {confirmDialog.options.title || 'အတည်ပြုရန် လိုအပ်ပါသည်'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {confirmDialog.options.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleConfirmResponse(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 active:scale-95 transition-all"
              >
                {confirmDialog.options.cancelText || 'မလုပ်တော့ပါ'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmResponse(true)}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm active:scale-95 transition-all ${
                  confirmDialog.options.isDangerous
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {confirmDialog.options.confirmText || 'သေချာပါသည်'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside ToastProvider
    return {
      showToast: (msg: string) => {
        if (typeof window !== 'undefined') alert(msg);
      },
      showConfirm: async (opts: ConfirmDialogOptions | string) => {
        const msg = typeof opts === 'string' ? opts : opts.message;
        return typeof window !== 'undefined' ? window.confirm(msg) : true;
      },
    };
  }
  return context;
};
