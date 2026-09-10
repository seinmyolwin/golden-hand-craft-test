import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Copy, Check, Download, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface VoucherQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  voucherNo: string;
  data: unknown;
  mode?: 'EXPORT' | 'IMPORT';
  onImport?: (importedData: unknown) => void;
}

export const VoucherQRModal: React.FC<VoucherQRModalProps> = ({
  isOpen,
  onClose,
  title,
  voucherNo,
  data,
  mode = 'EXPORT',
  onImport,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const payloadString = React.useMemo(() => {
    try {
      return JSON.stringify({
        shweLetYarVoucher: true,
        voucherNo,
        data,
        exportedAt: new Date().toISOString(),
      });
    } catch {
      return '';
    }
  }, [voucherNo, data]);

  useEffect(() => {
    if (isOpen && payloadString && mode === 'EXPORT') {
      QRCode.toDataURL(payloadString, {
        width: 320,
        margin: 2,
        color: {
          dark: '#064e3b', // emerald-900
          light: '#f0fdf4', // emerald-50
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err));
    }
  }, [isOpen, payloadString, mode]);

  if (!isOpen) return null;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payloadString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${voucherNo}_${Date.now()}.png`;
    a.click();
  };

  const handleExecuteImport = () => {
    try {
      const parsed = JSON.parse(importText.trim());
      if (!parsed || (!parsed.shweLetYarVoucher && !parsed.voucherNo && !parsed.items)) {
        setImportStatus({
          success: false,
          message: 'မှားယွင်းသော QR စာသားဖြစ်ပါသည်။ ရွှေလက်ရာ ဘောင်ချာ format မဟုတ်ပါ။',
        });
        return;
      }
      if (onImport) {
        onImport(parsed.data || parsed);
        setImportStatus({ success: true, message: 'ဘောင်ချာ စာရင်းကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!' });
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setImportStatus({
        success: false,
        message: 'JSON စာသား မှားယွင်းနေပါသည်။ သေချာစစ်ဆေးပြီး ပြန်လည်ကူးထည့်ပါ။',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-800 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-emerald-200">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{title}</h3>
              <p className="text-[11px] text-emerald-200 font-mono">{voucherNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {mode === 'EXPORT' ? (
            <>
              <div className="text-center space-y-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  အင်တာနက်မလိုဘဲ အခြားဖုန်း သို့မဟုတ် တက်ဘလက်မှ ကင်မရာဖြင့် ဤ QR Code ကို Scan ဖတ်၍ ဘောင်ချာစာရင်းကို တိုက်ရိုက် ရယူနိုင်ပါသည်။
                </p>
              </div>

              {/* QR Image Box */}
              <div className="flex justify-center">
                <div className="p-3 bg-emerald-50 rounded-2xl border-2 border-emerald-200 shadow-inner flex flex-col items-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR Code for ${voucherNo}`}
                      className="w-56 h-56 rounded-xl object-contain shadow-sm"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                      QR Code ထုတ်လုပ်နေပါသည်...
                    </div>
                  )}
                  <div className="mt-2 text-[10px] font-mono text-emerald-800 font-semibold">
                    SHWE LET YAR OFFLINE QR SYNC
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={handleDownloadQR}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>QR ပုံ သိမ်းဆည်းမည်</span>
                </button>
                <button
                  onClick={handleCopyPayload}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'ကူးယူပြီးပါပြီ' : 'စာသား ကူးယူမည်'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                အခြားဖုန်းမှ ပေးပို့လိုက်သော ဘောင်ချာစာသား (သို့မဟုတ် QR စာသား) ကို ဤနေရာတွင် ကူးထည့်၍ စာရင်းထဲသို့ ထည့်သွင်းနိုင်ပါသည် -
              </p>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"shweLetYarVoucher": true, ...}'
                rows={5}
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />

              {importStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    importStatus.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <button
                onClick={handleExecuteImport}
                disabled={!importText.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition"
              >
                <span>စာရင်းထဲသို့ ထည့်သွင်းမည်</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
