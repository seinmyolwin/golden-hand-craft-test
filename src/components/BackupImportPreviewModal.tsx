import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Database,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Calendar,
  Layers,
  Store,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { BackupValidationReport } from '../types';
import { executeSafeRestore } from '../services/backupService';

interface BackupImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: BackupValidationReport | null;
  fileName?: string;
  onRestoreSuccess: (result: { message: string; mode: 'OVERWRITE' | 'SMART_MERGE' }) => void;
}

export const BackupImportPreviewModal: React.FC<BackupImportPreviewModalProps> = ({
  isOpen,
  onClose,
  report,
  fileName,
  onRestoreSuccess,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  if (!isOpen || !report) return null;

  const handleRestore = async (mode: 'OVERWRITE' | 'SMART_MERGE') => {
    if (mode === 'OVERWRITE') {
      const confirmed = window.confirm(
        '⚠️ သတိပေးချက်: လက်ရှိဒေတာများကို Backup ဖိုင်ပါ အချက်အလက်များဖြင့် အစားထိုးပါမည်။\n\n(မအစားထိုးမီ လက်ရှိဒေတာကို Auto Safety Snapshot အဖြစ် အလိုအလျောက် သိမ်းဆည်းပေးပါမည်)\n\nဆက်လက်လုပ်ဆောင်မည်မှာ သေချာပါသလား?'
      );
      if (!confirmed) return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const result = await executeSafeRestore(report, mode);
      setIsRestoring(false);
      onRestoreSuccess({ message: result.message, mode });
      onClose();
    } catch (err: any) {
      setIsRestoring(false);
      setRestoreError(err.message || 'Restore လုပ်ဆောင်ရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ခဲ့ပါသည်');
    }
  };

  const hasFatalErrors = report.errors.some((e) => e.severity === 'FATAL');
  const hasWarnings = report.warnings.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Backup စစ်ဆေးမှုနှင့် အကြိုကြည့်ရှုခြင်း (Import Preview)</span>
                <span className="text-[10px] bg-emerald-700/80 text-white px-2 py-0.5 rounded-full font-mono">
                  v{report.formatVersion}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-md">
                {fileName || 'Backup File'} • စုစုပေါင်း မှတ်တမ်း {report.totalRecords.toLocaleString()} ခု
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Integrity & Validation Status Banner */}
          {hasFatalErrors ? (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900">
              <div className="flex items-center gap-2 font-bold text-rose-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Backup ဖိုင်တွင် မူမမှန်သော ချို့ယွင်းချက်များ တွေ့ရှိရပါသည် (Fatal Errors)</span>
              </div>
              <p className="text-[11px] text-rose-800">
                ဤဖိုင်သည် ပျက်စီးနေခြင်း သို့မဟုတ် ပုံစံမမှန်ကန်ခြင်းကြောင့် Restore လုပ်ဆောင်၍ မရပါ။
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800 pt-1 font-mono">
                {report.errors.map((err, idx) => (
                  <li key={idx}>
                    <span className="font-bold">[{err.field}]:</span> {err.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 text-emerald-950">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-emerald-900">
                    ဒေတာဖွဲ့စည်းပုံ စစ်ဆေးမှု အောင်မြင်ပါသည် (Integrity Verified)
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    {report.checksumValid
                      ? 'ဖိုင်၏ Cryptographic Checksum နှင့် ဇယားများအားလုံး စံသတ်မှတ်ချက်အတိုင်း ကိုက်ညီပါသည်'
                      : 'ဇယားများနှင့် အမျိုးအစားများအားလုံး မှန်ကန်စွာ စစ်ဆေးပြီးပါပြီ'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-300 shrink-0">
                Schema v{report.detectedSchemaVersion}
              </span>
            </div>
          )}

          {/* Shop Metadata Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5">
              <Store className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">ဆိုင်အမည် / ပိုင်ရှင်</span>
                <span className="text-xs font-black text-slate-900">{report.shopName || 'မဖော်ပြထားပါ'}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Export ပြုလုပ်ခဲ့သည့် ရက်စွဲ</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {report.exportedAt ? new Date(report.exportedAt).toLocaleString() : 'မသိရှိပါ'}
                </span>
              </div>
            </div>

            {report.dateRange && (
              <div className="sm:col-span-2 flex items-start gap-2.5 pt-1 border-t border-slate-200/60">
                <Calendar className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">စာရင်းမှတ်တမ်း ကာလ (Date Range)</span>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {report.dateRange.earliest} မှ {report.dateRange.latest} အထိ
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Counts Overview Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Database className="w-4 h-4 text-slate-700" />
              <span>အရန်ဖိုင်တွင်း ပါဝင်သော စာရင်းများ (Entity Breakdown)</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">ကုန်ပစ္စည်း</span>
                <span className="text-sm font-black text-slate-900">{report.counts.products}</span>
                <span className="text-[9px] text-slate-400 block">Products</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">ကုန်ကြမ်းပေးသွင်းသူ</span>
                <span className="text-sm font-black text-emerald-700">{report.counts.suppliers}</span>
                <span className="text-[9px] text-slate-400 block">Suppliers</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">ကုန်သည်စာရင်း</span>
                <span className="text-sm font-black text-blue-700">{report.counts.merchants}</span>
                <span className="text-[9px] text-slate-400 block">Merchants</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">ကုန်သိမ်းဘောင်ချာ</span>
                <span className="text-sm font-black text-purple-700">{report.counts.transactions}</span>
                <span className="text-[9px] text-slate-400 block">Collections</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">အရောင်းဘောင်ချာ</span>
                <span className="text-sm font-black text-amber-700">{report.counts.sales}</span>
                <span className="text-[9px] text-slate-400 block">Sales Vouchers</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">ကုန်သည်အော်ဒါ</span>
                <span className="text-sm font-black text-indigo-700">{report.counts.orders}</span>
                <span className="text-[9px] text-slate-400 block">Orders</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">စတော့ညှိနှိုင်းမှု</span>
                <span className="text-sm font-black text-slate-700">{report.counts.stockAdjustments}</span>
                <span className="text-[9px] text-slate-400 block">Adjustments</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 block font-semibold">ကုန်ကြမ်းသတ်မှတ်ချက်</span>
                <span className="text-sm font-black text-slate-700">{report.counts.rawMaterialPresets}</span>
                <span className="text-[9px] text-slate-400 block">Presets</span>
              </div>
            </div>
          </div>

          {/* Live DB Comparison (if available) */}
          {report.comparison && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <h4 className="font-bold text-blue-950 text-xs flex items-center justify-between">
                <span>လက်ရှိစက်တွင်း ဒေတာဘေ့စ်နှင့် နှိုင်းယှဉ်ချက် (Live Database Comparison)</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-slate-600 block">ကုန်ပစ္စည်း:</span>
                  <span className="font-bold text-blue-900">
                    ဖိုင်ထဲတွင် {report.comparison.products.inBackup} မျိုး (လက်ရှိ {report.comparison.products.inCurrentDb} မျိုး)
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-slate-600 block">ကုန်သွင်းသူ:</span>
                  <span className="font-bold text-blue-900">
                    ဖိုင်ထဲတွင် {report.comparison.suppliers.inBackup} ဦး (လက်ရှိ {report.comparison.suppliers.inCurrentDb} ဦး)
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-slate-600 block">ကုန်သည်:</span>
                  <span className="font-bold text-blue-900">
                    ဖိုင်ထဲတွင် {report.comparison.merchants.inBackup} ဦး (လက်ရှိ {report.comparison.merchants.inCurrentDb} ဦး)
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-slate-600 block">ကုန်သိမ်းဘောင်ချာ:</span>
                  <span className="font-bold text-blue-900">
                    ဖိုင်ထဲတွင် {report.comparison.transactions.inBackup} စောင် (လက်ရှိ {report.comparison.transactions.inCurrentDb} စောင်)
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-slate-600 block">အရောင်းဘောင်ချာ:</span>
                  <span className="font-bold text-blue-900">
                    ဖိုင်ထဲတွင် {report.comparison.sales.inBackup} စောင် (လက်ရှိ {report.comparison.sales.inCurrentDb} စောင်)
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <span className="text-slate-600 block">အော်ဒါစာရင်း:</span>
                  <span className="font-bold text-blue-900">
                    ဖိုင်ထဲတွင် {report.comparison.orders.inBackup} ခု (လက်ရှိ {report.comparison.orders.inCurrentDb} ခု)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warnings Section (if any) */}
          {hasWarnings && (
            <div className="border border-amber-200 bg-amber-50/70 rounded-xl p-3 space-y-1.5">
              <button
                type="button"
                onClick={() => setShowWarnings(!showWarnings)}
                className="w-full flex items-center justify-between text-left text-amber-900 font-bold cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>သတိပြုရန် အချက်များ ({report.warnings.length} ခု တွေ့ရှိရသည်)</span>
                </div>
                <span className="text-[10px] text-amber-700 underline">
                  {showWarnings ? 'ခေါက်သိမ်းမည်' : 'အသေးစိတ် ကြည့်မည်'}
                </span>
              </button>
              {showWarnings && (
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900 pt-1">
                  {report.warnings.map((w, idx) => (
                    <li key={idx}>
                      <span className="font-bold">[{w.field}]:</span> {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Safety Guarantee Notice */}
          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Auto Safety Guarantee: </strong>
              Restore မပြုလုပ်မီ လက်ရှိဒေတာများကို IndexedDB တွင်း <strong>Auto Recovery Snapshot</strong> အဖြစ် အလိုအလျောက် အရန်သိမ်းပေးမည်ဖြစ်ပြီး ချို့ယွင်းမှုတစ်စုံတစ်ရာ ဖြစ်ပေါ်ပါက မူလအတိုင်း ပြန်လည်ထားရှိပေးပါမည်။
            </div>
          </div>

          {/* Restore Error (if thrown during action) */}
          {restoreError && (
            <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{restoreError}</span>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            မလုပ်တော့ပါ (Cancel)
          </button>

          {!hasFatalErrors && (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                id="modal-restore-merge-btn"
                onClick={() => handleRestore('SMART_MERGE')}
                disabled={isRestoring}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                {isRestoring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>စာရင်းများ ပေါင်းစပ်သွင်းမည် (Smart Merge)</span>
              </button>

              <button
                type="button"
                id="modal-restore-overwrite-btn"
                onClick={() => handleRestore('OVERWRITE')}
                disabled={isRestoring}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                {isRestoring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>အစားထိုး ပြန်သွင်းမည် (Safe Overwrite)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
