import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEntry, AuditActionType } from '../types';
import {
  X,
  Shield,
  Search,
  Filter,
  Calendar,
  FileText,
  Clock,
  User,
  Hash,
  ChevronRight,
  Eye,
  CheckCircle2,
  Lock,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { getAuditTrail, getAuditHistoryForVoucher } from '../services/auditTrailService';

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs?: AuditLogEntry[];
}

const ACTION_TYPE_OPTIONS: { value: AuditActionType | 'ALL'; label: string; bg: string; text: string }[] = [
  { value: 'ALL', label: 'လုပ်ဆောင်ချက်အားလုံး (All Actions)', bg: 'bg-slate-100', text: 'text-slate-700' },
  { value: 'SALE', label: 'အရောင်း (Sales)', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { value: 'PURCHASE', label: 'အဝယ်/အကောက် (Purchases)', bg: 'bg-amber-100', text: 'text-amber-800' },
  { value: 'STOCK_MOVEMENT', label: 'ကုန်ပစ္စည်းလှုပ်ရှားမှု (Stock Movements)', bg: 'bg-blue-100', text: 'text-blue-800' },
  { value: 'CASH_MOVEMENT', label: 'ငွေကြေးဝင်ထွက် (Cash Ledger)', bg: 'bg-teal-100', text: 'text-teal-800' },
  { value: 'RETURN', label: 'ကုန်ပစ္စည်းပြန်အပ် (Returns)', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  { value: 'REFUND', label: 'ငွေပြန်အမ်း (Refunds)', bg: 'bg-sky-100', text: 'text-sky-800' },
  { value: 'REVERSAL', label: 'စာရင်းပယ်ဖျက်/ပြန်ပြင် (Reversals)', bg: 'bg-rose-100', text: 'text-rose-800' },
  { value: 'DAILY_CLOSING', label: 'နေ့စဉ်စာရင်းပိတ် (Daily Closing)', bg: 'bg-purple-100', text: 'text-purple-800' },
  { value: 'DAILY_CLOSING_CORRECTION', label: 'စာရင်းပိတ်ပြင်ဆင်မှု (Closing Correction)', bg: 'bg-fuchsia-100', text: 'text-fuchsia-800' },
  { value: 'PRODUCT_CHANGE', label: 'ကုန်ပစ္စည်း အပြောင်းအလဲ (Products)', bg: 'bg-cyan-100', text: 'text-cyan-800' },
  { value: 'MASTER_DATA_CHANGE', label: 'အခြေခံ စာရင်းအချက်အလက် (Master Data)', bg: 'bg-orange-100', text: 'text-orange-800' },
  { value: 'DATABASE_REPAIR', label: 'ဒေတာဘေ့စ် ပြုပြင်ခြင်း (DB Repair)', bg: 'bg-amber-100', text: 'text-amber-900' },
  { value: 'DATABASE_RECOVERY', label: 'ဒေတာ ပြန်လည်ရယူခြင်း (Recovery)', bg: 'bg-emerald-100', text: 'text-emerald-900' },
  { value: 'BACKUP_RESTORE', label: 'Backup / Restore', bg: 'bg-violet-100', text: 'text-violet-800' },
];

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  isOpen,
  onClose,
  auditLogs: propLogs,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedActionType, setSelectedActionType] = useState<AuditActionType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [voucherSearchTerm, setVoucherSearchTerm] = useState<string>('');
  const [inspectAudit, setInspectAudit] = useState<AuditLogEntry | null>(null);
  const [voucherChain, setVoucherChain] = useState<AuditLogEntry[]>([]);
  const [isChainLoading, setIsChainLoading] = useState<boolean>(false);

  // Load audit trail from service or prop
  const reloadData = async () => {
    try {
      const fetched = await getAuditTrail();
      setLogs(fetched);
    } catch {
      if (propLogs) setLogs(propLogs);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
    }
  }, [isOpen]);

  // Filter logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date filter
      if (selectedDate) {
        const logDate = (log.timestamp || log.createdAt || '').slice(0, 10);
        if (logDate !== selectedDate) return false;
      }

      // Action type filter
      if (selectedActionType !== 'ALL') {
        const logActionType = log.actionType || 'SYSTEM_ACTION';
        if (logActionType !== selectedActionType) return false;
      }

      // Voucher / Ref filter
      if (voucherSearchTerm.trim()) {
        const v = voucherSearchTerm.trim().toLowerCase();
        const vNo = (log.referenceVoucherNo || '').toLowerCase();
        const refId = (log.referenceId || log.entityId || '').toLowerCase();
        if (!vNo.includes(v) && !refId.includes(v)) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const text = `${log.action || ''} ${log.details || ''} ${log.description || ''} ${log.performer || ''} ${JSON.stringify(log.metadata || {})}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [logs, selectedDate, selectedActionType, voucherSearchTerm, searchTerm]);

  // Inspect voucher chain traceability
  const handleInspectVoucherTrace = async (voucherNoOrId: string) => {
    setIsChainLoading(true);
    try {
      const chain = await getAuditHistoryForVoucher(voucherNoOrId);
      setVoucherChain(chain);
    } finally {
      setIsChainLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white text-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">လုပ်ငန်းဆောင်ရွက်မှု မှတ်တမ်းအပြည့်အစုံ (Immutable Audit Trail)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Phase 17 Verified
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                အရောင်း၊ အဝယ်၊ ကုန်လှုပ်ရှားမှု၊ စာရင်းပိတ်၊ ပြန်အပ်မှုနှင့် ပြုပြင်မှု မှတ်တမ်းများအားလုံး မပြောင်းလဲနိုင်သော Audit Trail အဖြစ် ထိန်းသိမ်းထားပါသည်
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

        {/* Filter Controls Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0 text-xs">
          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-emerald-500 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-transparent text-slate-800 font-semibold focus:outline-none"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-slate-400 hover:text-rose-600 font-bold px-1"
                title="ရက်စွဲ ပယ်ဖျက်မည်"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Type Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-emerald-500 shadow-xs">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value as any)}
              className="w-full bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voucher / Reference Search */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-emerald-500 shadow-xs">
            <Hash className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="ဘောက်ချာ/အကိုးအကား အမှတ်..."
              value={voucherSearchTerm}
              onChange={(e) => setVoucherSearchTerm(e.target.value)}
              className="w-full bg-transparent text-slate-800 font-semibold focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* General Text Search */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-emerald-500 shadow-xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="အကြောင်းအရာ/အသေးစိတ် ရှာရန်..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-slate-800 font-semibold focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Audit Trail List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <FileText className="w-10 h-10 text-slate-300" />
              <p className="font-semibold text-sm">ရှာဖွေမှုနှင့် ကိုက်ညီသော Audit မှတ်တမ်း မရှိပါ</p>
              <p className="text-xs text-slate-400">စစ်ထုတ်မှု ချိန်ညှိချက်များကို ပြန်လည်စစ်ဆေးပါ</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const opt = ACTION_TYPE_OPTIONS.find((o) => o.value === log.actionType) || {
                bg: 'bg-slate-100',
                text: 'text-slate-700',
                label: log.actionType || 'SYSTEM',
              };

              return (
                <div
                  key={log.id}
                  className="py-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 group cursor-pointer"
                  onClick={() => {
                    setInspectAudit(log);
                    if (log.referenceVoucherNo || log.referenceId) {
                      handleInspectVoucherTrace(log.referenceVoucherNo || log.referenceId || '');
                    }
                  }}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 group-hover:scale-125 transition-transform" />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{log.action}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${opt.bg} ${opt.text}`}>
                          {log.actionType || 'SYSTEM'}
                        </span>
                        {log.referenceVoucherNo && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-900 text-amber-300 border border-slate-700">
                            #{log.referenceVoucherNo}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-700 text-xs font-medium leading-relaxed">{log.details}</p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap pt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {log.timestamp || log.createdAt}
                        </span>
                        {log.entityType && (
                          <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                            <Tag className="w-3 h-3" /> {log.entityType} ({log.entityId})
                          </span>
                        )}
                        {log.amount !== undefined && (
                          <span className="font-bold text-emerald-700">
                            ပမာဏ: {log.amount.toLocaleString()} ကျပ်
                          </span>
                        )}
                        {log.quantity !== undefined && (
                          <span className="font-bold text-blue-700">
                            အရေအတွက်: {log.quantity.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> အသေးစိတ်
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary Bar */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold shrink-0">
          <div>
            စုစုပေါင်း Audit မှတ်တမ်း: <span className="font-bold text-slate-900">{filteredLogs.length}</span> ခု
          </div>
          <div className="text-[11px] text-slate-500 italic">
            🔒 Audit records are strictly immutable and permanent
          </div>
        </div>
      </div>

      {/* Detail View & Traceability Inspector Modal */}
      {inspectAudit && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[88vh] flex flex-col">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-sm">Audit Record Detail & Traceability Chain</h4>
              </div>
              <button
                type="button"
                onClick={() => setInspectAudit(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Record Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-400">ID: {inspectAudit.id}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {inspectAudit.actionType || 'SYSTEM'}
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900">{inspectAudit.action}</h3>
                <p className="text-slate-700 text-xs">{inspectAudit.details}</p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">အချိန်မှတ်တမ်း:</span>
                    <span className="font-bold text-slate-800 font-mono">{inspectAudit.timestamp || inspectAudit.createdAt}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ဘောက်ချာ/အကိုးအကား:</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {inspectAudit.referenceVoucherNo || inspectAudit.referenceId || inspectAudit.entityId || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metadata JSON Inspector if present */}
              {inspectAudit.metadata && Object.keys(inspectAudit.metadata).length > 0 && (
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-700 text-xs">အသေးစိတ် မက်တာဒေတာ (Structured Metadata)</h5>
                  <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                    {JSON.stringify(inspectAudit.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Traceability Chain Section */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  ဘောက်ချာ လုပ်ငန်းစဉ် အစအဆုံး သမိုင်းကြောင်း (Lifecycle Chain)
                </h5>

                {isChainLoading ? (
                  <div className="p-4 text-center text-slate-400">သမိုင်းကြောင်း ရှာဖွေနေပါသည်...</div>
                ) : voucherChain.length <= 1 ? (
                  <p className="text-slate-500 text-[11px] italic p-2 bg-slate-50 rounded-lg">
                    ဤ ဘောက်ချာ/မှတ်တမ်းနှင့် ပတ်သက်သည့် အခြား ဆက်စပ် သမိုင်း အစီအစဉ်များ မရှိပါ။
                  </p>
                ) : (
                  <div className="space-y-2 relative pl-4 border-l-2 border-emerald-500/30">
                    {voucherChain.map((chainItem, idx) => (
                      <div key={chainItem.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            #{idx + 1}. {chainItem.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{chainItem.timestamp}</span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{chainItem.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setInspectAudit(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                ပိတ်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
