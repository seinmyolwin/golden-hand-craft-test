import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Database,
  Activity,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileCode,
  HardDrive,
  Layers,
  Search,
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  Check,
  Copy,
  Wrench,
  History,
  ShieldAlert,
} from 'lucide-react';
import {
  DatabaseHealthReport,
  HealthCheckCategory,
  HealthCheckResult,
  HealthCheckSeverity,
  HealthOverallStatus,
  AuditLogEntry,
} from '../types';
import {
  runDatabaseDiagnostics,
  downloadDiagnosticReport,
  formatBytes,
} from '../services/databaseHealthService';
import {
  getRepairCapability,
  getRepairHistory,
} from '../services/databaseRepairService';
import { RepairPreviewModal } from './RepairPreviewModal';

interface DatabaseHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseHealthModal: React.FC<DatabaseHealthModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [report, setReport] = useState<DatabaseHealthReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'DIAGNOSTICS' | 'HISTORY'>('DIAGNOSTICS');
  const [activeCategory, setActiveCategory] = useState<HealthCheckCategory | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<HealthCheckSeverity | 'ALL' | 'ISSUES_ONLY'>('ISSUES_ONLY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Repair state
  const [selectedRepairIssue, setSelectedRepairIssue] = useState<HealthCheckResult | null>(null);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState<boolean>(false);
  const [repairHistory, setRepairHistory] = useState<AuditLogEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const executeDiagnostics = async () => {
    setIsRunning(true);
    try {
      const res = await runDatabaseDiagnostics();
      setReport(res);
    } catch (e) {
      console.error('Diagnostic error:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const loadRepairHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await getRepairHistory();
      setRepairHistory(history);
    } catch (e) {
      console.error('Error loading repair history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      executeDiagnostics();
      loadRepairHistory();
    }
  }, [isOpen]);

  const toggleExpand = (id: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredResults = useMemo(() => {
    if (!report) return [];
    return report.results.filter((r) => {
      // Category filter
      if (activeCategory !== 'ALL' && r.category !== activeCategory) {
        return false;
      }

      // Severity filter
      if (severityFilter === 'ISSUES_ONLY') {
        if (r.severity === 'PASS') return false;
      } else if (severityFilter !== 'ALL' && r.severity !== severityFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchMsg = r.message?.toLowerCase().includes(q);
        const matchEntity = r.entity?.toLowerCase().includes(q);
        const matchRecordId = r.recordId?.toLowerCase().includes(q);
        const matchCode = r.code?.toLowerCase().includes(q);
        return matchTitle || matchMsg || matchEntity || matchRecordId || matchCode;
      }

      return true;
    });
  }, [report, activeCategory, severityFilter, searchQuery]);

  if (!isOpen) return null;

  const getStatusBadge = (status: HealthOverallStatus) => {
    switch (status) {
      case 'HEALTHY':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700',
          badge: 'bg-emerald-600 text-white',
          icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
          title: 'ကျန်းမာရေး အခြေအနေ ကောင်းမွန်ပါသည် (HEALTHY)',
          subtitle: 'ဒေတာဘေ့စ်အတွင်း အချက်အလက်များ တည်ငြိမ်ပြီး အဓိကချို့ယွင်းချက် မတွေ့ရှိပါ',
        };
      case 'ATTENTION':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-800',
          badge: 'bg-amber-600 text-white',
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          title: 'သတိပြုရန် လိုအပ်ပါသည် (ATTENTION)',
          subtitle: 'သတိပေးချက်အချို့ တွေ့ရှိရပါသည် (အကြံပြုချက်များကို အောက်တွင် စစ်ဆေးနိုင်ပါသည်)',
        };
      case 'DEGRADED':
        return {
          bg: 'bg-orange-500/10 border-orange-500/30 text-orange-800',
          badge: 'bg-orange-600 text-white',
          icon: <AlertCircle className="w-6 h-6 text-orange-600" />,
          title: 'စနစ်ချို့ယွင်းချက် ရှိနေပါသည် (DEGRADED)',
          subtitle: 'စာရင်း သို့မဟုတ် အကိုးအကား အမှားအချို့ ရှိနေသဖြင့် စစ်ဆေးရန် လိုအပ်ပါသည်',
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-800',
          badge: 'bg-rose-600 text-white',
          icon: <AlertCircle className="w-6 h-6 text-rose-600" />,
          title: 'အရေးပေါ် ချို့ယွင်းချက် တွေ့ရှိပါသည် (CRITICAL)',
          subtitle: 'Primary Key ထပ်နေခြင်း သို့မဟုတ် Database တည်ဆောက်ပုံ အရေးကြီး ချို့ယွင်းချက် ရှိနေပါသည်',
        };
    }
  };

  const statusInfo = report ? getStatusBadge(report.overallStatus) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">ဒေတာဘေ့စ် စစ်ဆေးမှုနှင့် ကျန်းမာရေး</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  Phase 12 Diagnostics
                </span>
              </div>
              <p className="text-xs text-slate-400">Database Health, Referential Integrity & Diagnostics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={executeDiagnostics}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isRunning ? 'စစ်ဆေးနေဆဲ...' : 'စစ်ဆေးမည်'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* View Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('DIAGNOSTICS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'DIAGNOSTICS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>စစ်ဆေးမှု ရလဒ်များ (Diagnostics)</span>
              {report && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
                  {report.results.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('HISTORY');
                loadRepairHistory();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'HISTORY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span>ပြင်ဆင်မှု မှတ်တမ်း (Repair History)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
                {repairHistory.length}
              </span>
            </button>
          </div>

          {activeTab === 'HISTORY' ? (
            /* Repair History Panel */
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs text-slate-800">
                    ဒေတာဘေ့စ် ပြင်ဆင်မှု မှတ်တမ်းများ (Repair Audit Trail)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  စုစုပေါင်း: {repairHistory.length} ခု
                </span>
              </div>

              {isLoadingHistory ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                  <span className="text-xs">Audit log များ ဖတ်ရှုနေပါသည်...</span>
                </div>
              ) : repairHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-xs text-slate-700">ပြင်ဆင်မှုမှတ်တမ်း မရှိသေးပါ</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    ဒေတာဘေ့စ် ပြင်ဆင်မှုများ ပြုလုပ်ပါက Audit Log များကို ဤနေရာတွင် စစ်ဆေးနိုင်ပါသည်
                  </p>
                </div>
              ) : (
                repairHistory.map((log) => {
                  let details: any = null;
                  try {
                    details = JSON.parse(log.details);
                  } catch {}

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {log.entityType || 'Database'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {log.entityId || log.id}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                              details?.result === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {details?.result || 'EXECUTED'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {details?.reason && (
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {details.reason}
                        </p>
                      )}

                      {details && (
                        <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                          <span>Repair ID: {details.repairId}</span>
                          <span>Type: {details.repairType}</span>
                          {details.backupId && (
                            <span className="text-emerald-700 font-semibold">
                              Safety Snapshot: {details.backupId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <>
              {/* Status Banner */}
          {report && statusInfo && (
            <div className={`p-4 rounded-xl border ${statusInfo.bg} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div className="flex items-start sm:items-center gap-3">
                <div className="shrink-0 p-2 rounded-xl bg-white shadow-2xs">
                  {statusInfo.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900">{statusInfo.title}</h3>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${statusInfo.badge}`}>
                      {report.overallStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{statusInfo.subtitle}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => downloadDiagnosticReport(report, 'json')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Export JSON Report"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-600" />
                  <span>JSON Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadDiagnosticReport(report, 'csv')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Export CSV Report"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV Report</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics Cards */}
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Schema Version</span>
                </div>
                <div className="font-mono font-bold text-sm text-slate-800">
                  {report.databaseName} (v{report.databaseSchemaVersion})
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Tables: {Object.keys(report.tableCounts).length} ခု
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>စုစုပေါင်း စာရင်းမှတ်တမ်း</span>
                </div>
                <div className="font-bold text-sm text-slate-800">
                  {Object.values(report.tableCounts).reduce((a: number, b: number) => a + b, 0).toLocaleString()} ခု
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Active in IndexedDB
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                  <span>Storage Quota</span>
                </div>
                <div className="font-bold text-sm text-slate-800">
                  {report.storageEstimate?.usageFormatted || 'Available'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {report.storageEstimate?.quotaFormatted ? `Quota: ${report.storageEstimate.quotaFormatted}` : 'Browser Managed'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>စစ်ဆေးချိန်ကြာမြင့်မှု</span>
                </div>
                <div className="font-bold text-sm text-slate-800">
                  {report.durationMs} ms
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {new Date(report.generatedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}

          {/* Counts Breakdown Chips */}
          {report && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSeverityFilter('ISSUES_ONLY')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                  severityFilter === 'ISSUES_ONLY'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ပြဿနာများသာ ({report.criticalCount + report.errorCount + report.warningCount + report.infoCount})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                  severityFilter === 'ALL'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                အားလုံး ({report.totalChecks})
              </button>
              {report.criticalCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSeverityFilter('CRITICAL')}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                    severityFilter === 'CRITICAL'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  Critical ({report.criticalCount})
                </button>
              )}
              {report.errorCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSeverityFilter('ERROR')}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                    severityFilter === 'ERROR'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  Error ({report.errorCount})
                </button>
              )}
              {report.warningCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSeverityFilter('WARN')}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                    severityFilter === 'WARN'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Warning ({report.warningCount})
                </button>
              )}
              {report.infoCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSeverityFilter('INFO')}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                    severityFilter === 'INFO'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  Info ({report.infoCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setSeverityFilter('PASS')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                  severityFilter === 'PASS'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Pass ({report.passedChecks})
              </button>
            </div>
          )}

          {/* Categorized Filter Tabs & Search */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2">
              {(
                [
                  { id: 'ALL', label: 'ကဏ္ဍအားလုံး' },
                  { id: 'DATABASE', label: 'Database' },
                  { id: 'DATA_INTEGRITY', label: 'Data Integrity' },
                  { id: 'REFERENCES', label: 'References' },
                  { id: 'FINANCIAL', label: 'Financial' },
                  { id: 'STOCK', label: 'Stock' },
                  { id: 'ATTACHMENTS', label: 'Attachments' },
                  { id: 'BACKUP', label: 'Backup' },
                  { id: 'AUDIT_TRAIL', label: 'Audit Trail' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                  {report && cat.id !== 'ALL' && (
                    <span className="ml-1 opacity-80 text-[10px]">
                      ({report.summaryByCategory[cat.id]?.total || 0})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="စစ်ဆေးမှု ရလဒ်များတွင် ရှာဖွေရန် (Title, Code, Record ID, Entity)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-2">
            {isRunning ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
                <p className="font-semibold text-xs text-slate-700">ဒေတာဘေ့စ် စစ်ဆေးနေပါသည်...</p>
                <p className="text-[11px] text-slate-400">IndexedDB table များအား Read-Only စစ်ဆေးနေပါသည်</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-xs text-slate-700">ပြဿနာ မရှိပါ</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ရွေးချယ်ထားသော စစ်ထုတ်မှုအတွင်း ပြဿနာ သို့မဟုတ် အမှားအယွင်း မတွေ့ရှိရပါ
                </p>
              </div>
            ) : (
              filteredResults.map((r) => {
                const isExpanded = expandedIssues.has(r.id);
                let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                if (r.severity === 'CRITICAL') badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
                if (r.severity === 'ERROR') badgeClass = 'bg-orange-100 text-orange-800 border-orange-300';
                if (r.severity === 'WARN') badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                if (r.severity === 'INFO') badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
                if (r.severity === 'PASS') badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

                return (
                  <div
                    key={r.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeClass} shrink-0 mt-0.5`}>
                          {r.severity}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{r.title}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {r.code}
                            </span>
                            {r.entity && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                                {r.entity}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{r.message}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {r.recordId && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(r.recordId!, r.id)}
                            className="text-[10px] font-mono px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Copy Record ID"
                          >
                            {copiedId === r.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{r.recordId}</span>
                          </button>
                        )}
                        {(r.details || (r.relatedRecordIds && r.relatedRecordIds.length > 0)) && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Repair Action / Safe Manual Review Indicator */}
                    {r.severity !== 'PASS' && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="text-[11px]">
                          {(() => {
                            const cap = getRepairCapability(r.code);
                            if (cap.repairAvailable) {
                              return (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  Controlled Repair Available ({cap.safetyLevel})
                                </span>
                              );
                            }
                            return (
                              <span className="text-slate-500 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                ငွေစာရင်း/စတော့ မူလမှတ်တမ်းအား အလိုအလျောက်မပြင်ပါ (Manual Review)
                              </span>
                            );
                          })()}
                        </div>

                        {(() => {
                          const cap = getRepairCapability(r.code);
                          if (cap.repairAvailable) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRepairIssue(r);
                                  setIsRepairModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Wrench className="w-3 h-3 text-emerald-600" />
                                <span>Preview Repair (ပြင်ဆင်ရန်)</span>
                              </button>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 font-bold rounded-lg text-[10px] uppercase">
                              Manual Review Required
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {/* Expandable Technical Details */}
                    {isExpanded && (r.details || (r.relatedRecordIds && r.relatedRecordIds.length > 0)) && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg text-slate-700 space-y-1">
                        {r.relatedRecordIds && r.relatedRecordIds.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-500">Related Record IDs: </span>
                            {r.relatedRecordIds.join(', ')}
                          </div>
                        )}
                        {r.details && (
                          <div>
                            <span className="font-bold text-slate-500">Details: </span>
                            <pre className="whitespace-pre-wrap mt-0.5 text-slate-600">
                              {typeof r.details === 'object' ? JSON.stringify(r.details, null, 2) : String(r.details)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Safe Database Operations — အရေးကြီးဒေတာများကို အလိုအလျောက် မဖျက်ပါ၊ ပြင်ဆင်မှုမပြုမီ အမြဲတမ်း Backup ပြုလုပ်ပါသည်
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
          >
            ပိတ်မည် (Close)
          </button>
        </div>
      </div>

      {/* Safe Repair Preview & Confirmation Modal */}
      <RepairPreviewModal
        isOpen={isRepairModalOpen}
        issue={selectedRepairIssue}
        onClose={() => {
          setIsRepairModalOpen(false);
          setSelectedRepairIssue(null);
        }}
        onRepairSuccess={() => {
          executeDiagnostics();
          loadRepairHistory();
        }}
      />
    </div>
  );
};
