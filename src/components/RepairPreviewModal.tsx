import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Info,
  Check,
} from 'lucide-react';
import {
  HealthCheckResult,
  RepairAction,
  Supplier,
  Merchant,
  Product,
} from '../types';
import { db } from '../db/database';
import {
  createRepairPreview,
  executeAtomicRepair,
  getRepairCapability,
} from '../services/databaseRepairService';

interface RepairPreviewModalProps {
  isOpen: boolean;
  issue: HealthCheckResult | null;
  onClose: () => void;
  onRepairSuccess: () => void;
}

export const RepairPreviewModal: React.FC<RepairPreviewModalProps> = ({
  isOpen,
  issue,
  onClose,
  onRepairSuccess,
}) => {
  const [previewAction, setPreviewAction] = useState<RepairAction | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Replacement candidates for selection
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [availableMerchants, setAvailableMerchants] = useState<Merchant[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedActionType, setSelectedActionType] = useState<'DELETE' | 'REASSIGN'>('DELETE');

  // Load lookup options if broken foreign key or product reference
  useEffect(() => {
    if (!isOpen || !issue) {
      setPreviewAction(null);
      setExecutionError(null);
      setSuccessMessage(null);
      setSelectedTargetId('');
      return;
    }

    const loadCandidates = async () => {
      try {
        if (issue.code === 'BROKEN_FOREIGN_KEY') {
          if (issue.entity === 'Transaction' || issue.entity === 'transactions') {
            const sups = await db.suppliers.toArray();
            setAvailableSuppliers(sups);
            if (sups.length > 0) setSelectedTargetId(sups[0].id);
          } else if (issue.entity === 'Sale' || issue.entity === 'MerchantPurchase') {
            const merchants = await db.merchants.toArray();
            setAvailableMerchants(merchants);
            if (merchants.length > 0) setSelectedTargetId(merchants[0].id);
          }
        } else if (issue.code === 'BROKEN_PRODUCT_REF') {
          const prods = await db.products.toArray();
          setAvailableProducts(prods);
          if (prods.length > 0) setSelectedTargetId(prods[0].id);
        }
      } catch (e) {
        console.error('Error loading candidates', e);
      }
    };

    loadCandidates();
  }, [isOpen, issue]);

  // Generate preview
  useEffect(() => {
    if (!isOpen || !issue) return;

    let isSubscribed = true;
    const loadPreview = async () => {
      setIsLoadingPreview(true);
      setExecutionError(null);
      try {
        const preview = await createRepairPreview(issue, db, {
          newTargetId: selectedTargetId || undefined,
          actionType: selectedActionType,
        });
        if (isSubscribed) {
          setPreviewAction(preview);
        }
      } catch (err: any) {
        if (isSubscribed) {
          setExecutionError(err?.message || 'Failed to generate repair preview');
        }
      } finally {
        if (isSubscribed) {
          setIsLoadingPreview(false);
        }
      }
    };

    loadPreview();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen, issue, selectedTargetId, selectedActionType]);

  if (!isOpen || !issue) return null;

  const capability = getRepairCapability(issue.code);

  const handleConfirmRepair = async () => {
    if (!previewAction) return;

    setIsExecuting(true);
    setExecutionError(null);
    try {
      const result = await executeAtomicRepair(previewAction, true, db);
      setSuccessMessage(result.message);
      setTimeout(() => {
        onRepairSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setExecutionError(err?.message || 'Repair execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Safe Database Repair Preview</h2>
              <p className="text-[11px] text-slate-300">
                ဘေးကင်းလုံခြုံသော ဒေတာပြင်ဆင်မှု အကြိုစစ်ဆေးချက်
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Safety Principle Banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed text-[11px]">
              <span className="font-bold">Core Safety Sequence Guaranteed:</span>
              <p className="text-emerald-800">
                ပြင်ဆင်မှု မစတင်မီ အလိုအလျောက် ဘေးကင်းရေး Backup Snapshot ပြုလုပ်မည်ဖြစ်ပြီး၊ ပြဿနာရှိပါက
                ချက်ချင်း Rollback ပြုလုပ်ပါမည်။ မူလစာရင်းများကို မည်သည့်အခါမျှ ထိခိုက်စေမည်မဟုတ်ပါ။
              </p>
            </div>
          </div>

          {/* Diagnostic Context */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{issue.title}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[10px] font-mono font-bold text-slate-700">
                  {issue.code}
                </span>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${
                  capability.safetyLevel === 'LEVEL_A'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : capability.safetyLevel === 'LEVEL_B'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                {capability.safetyLevel} (
                {capability.safetyLevel === 'LEVEL_A'
                  ? 'Safe Metadata'
                  : capability.safetyLevel === 'LEVEL_B'
                  ? 'User Confirmed'
                  : 'Manual Only'}
                )
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">{issue.message}</p>
            {issue.recordId && (
              <div className="text-[11px] font-mono text-slate-500">
                Target Record ID: <span className="font-bold text-slate-800">{issue.recordId}</span> ({issue.entity})
              </div>
            )}
          </div>

          {/* Option Selector for Level B User-Confirmed Repairs */}
          {issue.code === 'BROKEN_FOREIGN_KEY' && (issue.entity === 'Transaction' || issue.entity === 'transactions') && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <label className="font-bold text-blue-900 block">
                အစားထိုးချိတ်ဆက်မည့် တရားဝင် ကုန်ကြမ်းပေးသွင်းသူကို ရွေးချယ်ပါ:
              </label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                disabled={isExecuting}
                className="w-full p-2 bg-white border border-blue-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                {availableSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `[${s.code}] ` : ''}{s.name} ({s.village || 'ရွာမသိ'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {issue.code === 'BROKEN_FOREIGN_KEY' && (issue.entity === 'Sale' || issue.entity === 'MerchantPurchase') && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <label className="font-bold text-blue-900 block">
                အစားထိုးချိတ်ဆက်မည့် တရားဝင် ကုန်သည်ကို ရွေးချယ်ပါ:
              </label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                disabled={isExecuting}
                className="w-full p-2 bg-white border border-blue-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                {availableMerchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role || 'BUYER'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {issue.code === 'BROKEN_PRODUCT_REF' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <label className="font-bold text-blue-900 block">
                အစားထိုးချိတ်ဆက်မည့် တရားဝင် ကုန်ပစ္စည်းကို ရွေးချယ်ပါ:
              </label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                disabled={isExecuting}
                className="w-full p-2 bg-white border border-blue-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              >
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category || 'အထွေထွေ'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {issue.code === 'ORPHAN_ATTACHMENT' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <label className="font-bold text-amber-900 block">
                မိခင်ဘောက်ချာမဲ့နေသော ဓာတ်ပုံအား မည်သို့ပြုလုပ်လိုပါသနည်း:
              </label>
              <div className="flex gap-4 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="att_action"
                    value="DELETE"
                    checked={selectedActionType === 'DELETE'}
                    onChange={() => setSelectedActionType('DELETE')}
                  />
                  <span>ဘေးကင်းစွာ အပြီးအပိုင် ဖျက်ပစ်မည် (Safe Delete)</span>
                </label>
              </div>
            </div>
          )}

          {/* Preview BEFORE / AFTER Comparison */}
          {isLoadingPreview ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
              <p className="text-xs text-slate-600">Generating atomic preview...</p>
            </div>
          ) : previewAction ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Proposed Atomic Changes:</span>
                <span className="text-[10px] font-mono text-slate-400">{previewAction.repairType}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* BEFORE */}
                <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-rose-700 block">
                    BEFORE (လက်ရှိ အခြေအနေ)
                  </span>
                  <pre className="text-[11px] font-mono text-rose-900 bg-white/70 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(previewAction.beforeSnapshot, null, 2)}
                  </pre>
                </div>

                {/* AFTER */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    AFTER (ပြင်ဆင်မည့် အခြေအနေ)
                    <ArrowRight className="w-3 h-3" />
                  </span>
                  <pre className="text-[11px] font-mono text-emerald-900 bg-white/70 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(previewAction.proposedAfterSnapshot, null, 2)}
                  </pre>
                </div>
              </div>

              {previewAction.affectedRecordIds.length > 0 && (
                <div className="text-[10px] text-slate-500 font-mono">
                  Affected Records: {previewAction.affectedRecordIds.join(', ')}
                </div>
              )}
            </div>
          ) : null}

          {/* Feedback Messages */}
          {executionError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{executionError}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs font-bold">{successMessage}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            မပြုလုပ်ပါ (Cancel)
          </button>

          {capability.repairAvailable && capability.safetyLevel !== 'LEVEL_C' ? (
            <button
              type="button"
              onClick={handleConfirmRepair}
              disabled={isExecuting || isLoadingPreview || !previewAction}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>စစ်ဆေးပြင်ဆင်နေပါသည်...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>သေချာပါသည်၊ အတည်ပြုပြင်ဆင်မည် (Confirm Repair)</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>အလိုအလျောက် ပြင်ဆင်ခွင့်မရှိပါ (Manual Review Required)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
