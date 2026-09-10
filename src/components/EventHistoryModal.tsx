import React, { useState } from 'react';
import { AuditLogEntry } from '../types';
import { X, History, Search, Shield, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';

interface EventHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLogEntry[];
  onClearLogs?: () => void;
}

export const EventHistoryModal: React.FC<EventHistoryModalProps> = ({
  isOpen,
  onClose,
  auditLogs = [],
  onClearLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filtered = (auditLogs || []).filter((log) => {
    if (!log) return false;
    const match =
      (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entityType || '').toLowerCase().includes(searchQuery.toLowerCase());
    return match;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold">စနစ်လုပ်ဆောင်ချက် မှတ်တမ်း (Audit Logs)</h3>
              <p className="text-[11px] text-slate-400">လုံခြုံရေး၊ အချက်အလက်ဖျက်ခြင်းနှင့် ပြင်ဆင်မှု မှတ်တမ်းများ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="လုပ်ဆောင်ချက် ရှာဖွေမည်..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs focus:outline-none"
          />
          {onClearLogs && (
            <button
              type="button"
              onClick={() => {
                if (confirm('မှတ်တမ်းအားလုံးကို ရှင်းထုတ်ဖျက်ပစ်လိုပါသလား?')) {
                  onClearLogs();
                }
              }}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold whitespace-nowrap cursor-pointer"
            >
              မှတ်တမ်းရှင်းမည်
            </button>
          )}
        </div>

        {/* List */}
        <div className="p-4 flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">မှတ်တမ်း မရှိပါ</div>
          ) : (
            filtered.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">{log.details}</p>
                  {log.entityType && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded mt-1 inline-block">
                      {log.entityType} ({log.entityId})
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
