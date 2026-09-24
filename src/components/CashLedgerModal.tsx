import React, { useState, useMemo, useEffect } from 'react';
import {
  CashMovementRecord,
  DailyClosingRecord,
  CashMovementType,
  CashLedgerFilterOptions,
} from '../types';
import {
  calculateCashLedger,
  exportCashLedgerCSV,
  getCashMovementTypeLabel,
  calculateDailyCashSummary,
} from '../services/cashLedgerService';
import {
  recordDailyClosingAtomic,
  correctDailyClosingAtomic,
  exportDailyClosingHistoryCSV,
  getPreviousClosingCash,
} from '../services/dailyClosingService';
import { cashMovementRepo, dailyClosingRepo, supplierRepo } from '../repositories';
import { formatMMK, formatNumberOnly } from '../utils/currency';
import { getSafeErrorMessage } from '../utils/errors';
import { useToast } from '../context/ToastContext';
import { generateStableId } from '../utils/idGenerator';
import {
  X,
  Plus,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Search,
  Calendar,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  Store,
  RefreshCw,
  Clock,
  DollarSign,
  Receipt,
  FileText,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';
import { NumericInput, getNotePlaceholder } from './NumericInput';

interface CashLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

type DatePreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type ActiveTab = 'LEDGER' | 'DAILY_CLOSING';

export const CashLedgerModal: React.FC<CashLedgerModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('LEDGER');
  const [cashMovements, setCashMovements] = useState<CashMovementRecord[]>([]);
  const [dailyClosings, setDailyClosings] = useState<DailyClosingRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters for Cash Ledger
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Daily Closing State
  const [closingDate, setClosingDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isPerformingClosing, setIsPerformingClosing] = useState<boolean>(false);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [closingSuccess, setClosingSuccess] = useState<string | null>(null);

  // New Cash Movement State
  const [isAddMovementOpen, setIsAddMovementOpen] = useState<boolean>(false);
  const [newMovType, setNewMovType] = useState<CashMovementType>('EXPENSE_PAYOUT');
  const [newMovAmount, setNewMovAmount] = useState<string>('');
  const [newMovDescription, setNewMovDescription] = useState<string>('');
  const [newMovCounterpart, setNewMovCounterpart] = useState<string>('');
  const [newMovDate, setNewMovDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newMovNotes, setNewMovNotes] = useState<string>('');
  const [isSavingMovement, setIsSavingMovement] = useState<boolean>(false);

  const handleSaveMovement = async () => {
    const amt = parseFloat(newMovAmount);
    if (!amt || amt <= 0 || isNaN(amt)) {
      showToast('ကျေးဇူးပြု၍ တရားဝင် ငွေပမာဏ ရိုက်ထည့်ပါ', 'warning');
      return;
    }
    if (!newMovDescription.trim()) {
      showToast('ကျေးဇူးပြု၍ အကြောင်းအရာ ရိုက်ထည့်ပါ', 'warning');
      return;
    }

    setIsSavingMovement(true);
    try {
      const isOut = newMovType === 'EXPENSE_PAYOUT' || newMovType === 'DIRECT_CASH_OUT' || newMovType === 'MERCHANT_PURCHASE_PAYOUT' || newMovType === 'SUPPLIER_PAYOUT';
      const dir: 'IN' | 'OUT' = isOut ? 'OUT' : 'IN';
      const signed = isOut ? -Math.abs(amt) : Math.abs(amt);
      const now = new Date().toISOString();
      const movId = generateStableId('cm');

      await cashMovementRepo.recordMovement({
        id: movId,
        amount: Math.abs(amt),
        direction: dir,
        signedAmount: signed,
        type: newMovType,
        typeLabelMy: getCashMovementTypeLabel(newMovType),
        referenceType:
          newMovType === 'OPENING_FLOAT'
            ? 'OPENING'
            : newMovType === 'EXPENSE_PAYOUT'
            ? 'EXPENSE'
            : newMovType === 'INCOME_IN'
            ? 'INCOME'
            : 'MANUAL_ADJUSTMENT',
        referenceId: movId,
        referenceVoucherNo: `CASH-${newMovDate.replace(/-/g, '')}-${movId.slice(-4).toUpperCase()}`,
        counterpartName: newMovCounterpart.trim() || undefined,
        description: newMovDescription.trim(),
        transactionDate: newMovDate,
        transactionTime: now.slice(11, 16),
        notes: newMovNotes.trim() || undefined,
        status: 'COMPLETED',
        schemaVersion: 1,
        idempotencyKey: generateStableId(`ik_${movId}`),
        createdAt: now,
      });

      if (newMovType === 'SUPPLIER_PAYOUT' && newMovCounterpart) {
        try {
          const suppliers = await supplierRepo.getAll();
          const sup = suppliers.find(
            (s) =>
              s.name.toLowerCase().includes(newMovCounterpart.toLowerCase()) ||
              newMovCounterpart.toLowerCase().includes(s.name.toLowerCase())
          );
          if (sup) {
            const currentPayable = sup.payableBalance || 0;
            const updatedPayable = Math.max(0, currentPayable - Math.abs(amt));
            await supplierRepo.update(sup.id, {
              payableBalance: updatedPayable,
            });
          }
        } catch (supErr) {
          console.warn('Could not update supplier payable balance:', supErr);
        }
      }

      setIsAddMovementOpen(false);
      setNewMovAmount('');
      setNewMovDescription('');
      setNewMovCounterpart('');
      setNewMovNotes('');
      await loadData();
      onRefreshData?.();
      showToast('ငွေစာရင်း ရေးသွင်းမှု အောင်မြင်ပါသည်', 'success');
    } catch (err: any) {
      showToast(getSafeErrorMessage(err, 'ငွေစာရင်းသွင်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်'), 'error');
    } finally {
      setIsSavingMovement(false);
    }
  };

  // Load cash movements and closings from DB
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [movements, closings] = await Promise.all([
        cashMovementRepo.getAll(),
        dailyClosingRepo.getAll(),
      ]);
      setCashMovements(movements || []);
      setDailyClosings(closings || []);
    } catch (err) {
      console.error('Failed to load cash ledger data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Compute date filter
  const dateRange = useMemo<{ start?: string; end?: string }>(() => {
    const today = new Date().toISOString().split('T')[0];
    if (datePreset === 'TODAY') {
      return { start: today, end: today };
    }
    if (datePreset === 'WEEK') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { start: d.toISOString().split('T')[0], end: today };
    }
    if (datePreset === 'MONTH') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { start: d.toISOString().split('T')[0], end: today };
    }
    if (datePreset === 'CUSTOM') {
      return {
        start: customStartDate || undefined,
        end: customEndDate || undefined,
      };
    }
    return {};
  }, [datePreset, customStartDate, customEndDate]);

  // Calculate ledger summary and filtered items
  const ledgerReport = useMemo(() => {
    const filters: CashLedgerFilterOptions = {
      startDate: dateRange.start,
      endDate: dateRange.end,
      typeFilter: directionFilter === 'ALL' ? undefined : directionFilter,
      searchQuery: searchQuery.trim() || undefined,
    };
    return calculateCashLedger(cashMovements, filters);
  }, [cashMovements, dateRange, directionFilter, searchQuery]);

  // Existing closing for selected date
  const existingClosing = useMemo(() => {
    return dailyClosings.find((c) => c.closingDate === closingDate);
  }, [dailyClosings, closingDate]);

  // Compute opening balance and closing calculation for selected closing date
  const closingCalc = useMemo(() => {
    // Look up previous closing date
    let prevClosing = 0;
    const priorClosings = dailyClosings
      .filter((c) => c.closingDate < closingDate && c.status === 'CLOSED')
      .sort((a, b) => b.closingDate.localeCompare(a.closingDate));
    if (priorClosings.length > 0) {
      prevClosing = priorClosings[0].actualCountedCash ?? priorClosings[0].expectedClosingCash ?? 0;
    }

    const opening = existingClosing ? existingClosing.openingCash : prevClosing;
    return calculateDailyCashSummary(closingDate, cashMovements, opening, existingClosing);
  }, [closingDate, cashMovements, dailyClosings, existingClosing]);

  useEffect(() => {
    if (existingClosing) {
      setActualCashInput(String(existingClosing.actualCountedCash));
      setClosingNotes(existingClosing.notes || '');
      setCorrectionReason('');
    } else {
      setActualCashInput(String(closingCalc.expectedClosingCash));
      setClosingNotes('');
      setCorrectionReason('');
    }
    setClosingError(null);
    setClosingSuccess(null);
  }, [existingClosing, closingCalc.expectedClosingCash, closingDate]);

  const parsedActualCash = Number(actualCashInput) || 0;
  const currentVariance = parsedActualCash - closingCalc.expectedClosingCash;

  // Handle perform daily closing
  const handlePerformClosing = async () => {
    setClosingError(null);
    setClosingSuccess(null);
    setIsPerformingClosing(true);

    try {
      if (existingClosing && existingClosing.status === 'CLOSED') {
        // Execute correction
        if (!correctionReason.trim()) {
          throw new Error('စာရင်းပိတ်ပြီးသားရက်စွဲကို ပြင်ဆင်ရန် အကြောင်းပြချက် (Correction Reason) ထည့်သွင်းရန် လိုအပ်ပါသည်');
        }
        await correctDailyClosingAtomic({
          closingDate,
          newActualCountedCash: parsedActualCash,
          correctionReason: correctionReason.trim(),
          notes: closingNotes.trim() || undefined,
          correctedBy: 'Admin',
        });
        setClosingSuccess(`${closingDate} နေ့ချုပ်စာရင်း ပြင်ဆင်ချက် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ`);
      } else {
        await recordDailyClosingAtomic({
          closingDate,
          actualCountedCash: parsedActualCash,
          notes: closingNotes.trim() || undefined,
          closedBy: 'Admin',
        });
        setClosingSuccess(`${closingDate} နေ့ချုပ်စာရင်း အောင်မြင်စွာ ပိတ်သိမ်းပြီးပါပြီ`);
      }

      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setClosingError(err?.message || 'နေ့ချုပ်စာရင်း ပိတ်ရာတွင် အမှားအယွင်းရှိပါသည်');
    } finally {
      setIsPerformingClosing(false);
    }
  };

  const handleExportLedgerCSV = () => {
    const rangeText = dateRange.start && dateRange.end ? `${dateRange.start} မှ ${dateRange.end}` : 'အားလုံး';
    exportCashLedgerCSV(ledgerReport.entries, {
      dateRangeStr: rangeText,
    });
  };

  const handleExportClosingsCSV = () => {
    exportDailyClosingHistoryCSV(dailyClosings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                ငွေစာရင်းလယ်ဂျာ နှင့် နေ့ချုပ် (Cash Ledger & Daily Closing)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ငွေအဝင်/အထွက် အသေးစိတ်မှတ်တမ်း နှင့် နေ့စဉ်စာရင်းပိတ်သိမ်းခြင်း
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="အချက်အလက် အသစ်ပြန်တင်ရန်"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'LEDGER'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            ငွေစာရင်းလယ်ဂျာ (Cash Ledger)
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {cashMovements.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('DAILY_CLOSING')}
            className={`flex items-center gap-2 pb-3 px-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'DAILY_CLOSING'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            နေ့ချုပ်စာရင်း (Daily Closing)
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {dailyClosings.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === 'LEDGER' ? (
            /* CASH LEDGER VIEW */
            <div className="space-y-5">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">စတင်ငွေလက်ကျန်</span>
                  <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {formatMMK(ledgerReport.openingBalance)}
                  </div>
                </div>

                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> ငွေစုစုပေါင်းအဝင်
                  </span>
                  <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    +{formatMMK(ledgerReport.totalCashIn)}
                  </div>
                </div>

                <div className="bg-rose-50/60 dark:bg-rose-950/30 p-3.5 rounded-2xl border border-rose-200/60 dark:border-rose-900/40">
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" /> ငွေစုစုပေါင်းအထွက်
                  </span>
                  <div className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-300 mt-1">
                    -{formatMMK(ledgerReport.totalCashOut)}
                  </div>
                </div>

                <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40">
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> လက်ရှိငွေလက်ကျန်
                  </span>
                  <div className="text-base sm:text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-1">
                    {formatMMK(ledgerReport.closingBalance)}
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                {/* Date Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ALL', 'TODAY', 'WEEK', 'MONTH', 'CUSTOM'] as DatePreset[]).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setDatePreset(preset)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        datePreset === preset
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset === 'ALL' && 'အားလုံး'}
                      {preset === 'TODAY' && 'ယနေ့'}
                      {preset === 'WEEK' && '၇ ရက်အတွင်း'}
                      {preset === 'MONTH' && '၃၀ ရက်အတွင်း'}
                      {preset === 'CUSTOM' && 'ရက်စွဲရွေး'}
                    </button>
                  ))}
                </div>

                {/* Direction Filter */}
                <div className="flex items-center gap-2">
                  <select
                    value={directionFilter}
                    onChange={(e) => setDirectionFilter(e.target.value as any)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="ALL">အဝင်/အထွက် အားလုံး</option>
                    <option value="IN">ငွေအဝင်သာ (Cash In)</option>
                    <option value="OUT">ငွေအထွက်သာ (Cash Out)</option>
                  </select>

                  <button
                    onClick={() => setIsAddMovementOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ငွေစာရင်းသွင်း / အသုံးစရိတ်
                  </button>

                  <button
                    onClick={handleExportLedgerCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV ထုတ်ရန်
                  </button>
                </div>
              </div>

              {/* Custom Date Inputs if CUSTOM selected */}
              {datePreset === 'CUSTOM' && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">မှ:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">ထိ:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ဘောင်ချာနံပါတ်၊ လူအမည် သို့မဟုတ် အကြောင်းအရာဖြင့် ရှာဖွေပါ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>

              {/* Movements Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-4">ရက်စွဲ/အချိန်</th>
                        <th className="py-3 px-4">အမျိုးအစား</th>
                        <th className="py-3 px-4">ဆက်စပ်သူ / အကြောင်းအရာ</th>
                        <th className="py-3 px-4">ဘောင်ချာအမှတ်</th>
                        <th className="py-3 px-4 text-right">ငွေအဝင် (+)</th>
                        <th className="py-3 px-4 text-right">ငွေအထွက် (-)</th>
                        <th className="py-3 px-4 text-right">လက်ကျန်ငွေ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {ledgerReport.entries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            ငွေစာရင်းမှတ်တမ်း မရှိသေးပါ
                          </td>
                        </tr>
                      ) : (
                        ledgerReport.entries.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {item.transactionDate}
                              </div>
                              {item.transactionTime && (
                                <div className="text-[11px] text-slate-400">
                                  {item.transactionTime}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  item.direction === 'IN'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                }`}
                              >
                                {item.typeLabelMy || getCashMovementTypeLabel(item.type)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {item.counterpartName || '-'}
                              </div>
                              {item.description && (
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              {item.referenceVoucherNo || item.referenceId || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              {item.direction === 'IN' ? `+${formatNumberOnly(item.amount)}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                              {item.direction === 'OUT' ? `-${formatNumberOnly(item.amount)}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                              {formatNumberOnly(item.balanceAfter)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* DAILY CLOSING VIEW */
            <div className="space-y-6">
              {/* Date Selection & Status Header */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">ရက်စွဲရွေးချယ်ရန်:</span>
                    <input
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {existingClosing ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                      <Lock className="w-3.5 h-3.5" /> စာရင်းပိတ်သိမ်းပြီး ({existingClosing.status})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                      <Unlock className="w-3.5 h-3.5" /> စာရင်းမပိတ်ရသေးပါ (OPEN)
                    </span>
                  )}

                  <button
                    onClick={handleExportClosingsCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    နေ့ချုပ်မှတ်တမ်း CSV
                  </button>
                </div>
              </div>

              {/* Closing Calculation Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Card: System Calculation */}
                <div className="bg-white dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <Receipt className="w-4 h-4 text-emerald-600" /> စနစ်တွက်ချက်မှု ရလဒ် (System Calculation)
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>အဖွင့်ငွေလက်ကျန် (Opening Cash):</span>
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {formatMMK(closingCalc.openingCash)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <span>ယနေ့ ငွေအဝင် စုစုပေါင်း (+ Cash In):</span>
                      <span className="font-semibold text-sm">
                        +{formatMMK(closingCalc.totalCashIn)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                      <span>ယနေ့ ငွေအထွက် စုစုပေါင်း (- Cash Out):</span>
                      <span className="font-semibold text-sm">
                        -{formatMMK(closingCalc.totalCashOut)}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                      <span>ရှိရမည့် စာရင်းပိတ်ငွေ (Expected Closing):</span>
                      <span className="text-base text-indigo-600 dark:text-indigo-400">
                        {formatMMK(closingCalc.expectedClosingCash)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Actual Count & Perform Closing */}
                <div className="bg-white dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <DollarSign className="w-4 h-4 text-emerald-600" /> လက်တွေ့ရေတွက်ရရှိငွေ (Actual Cash Count)
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        လက်တွေ့ရေတွက်ရရှိသော ငွေပမာဏ (ကျပ်):
                      </label>
                      <NumericInput
                        value={actualCashInput}
                        onChange={(e) => setActualCashInput(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold"
                        placeholder="0"
                      />
                    </div>

                    {/* Variance Display */}
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between font-medium ${
                        currentVariance === 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                          : currentVariance > 0
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 text-blue-800 dark:text-blue-300'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      <span>ငွေကွဲလွဲမှု (Difference):</span>
                      <span className="font-bold">
                        {currentVariance === 0
                          ? 'တိကျစွာ ကိုက်ညီပါသည် (Balanced)'
                          : currentVariance > 0
                          ? `+${formatMMK(currentVariance)} (ပိုငွေ/Surplus)`
                          : `-${formatMMK(Math.abs(currentVariance))} (လိုငွေ/Shortage)`}
                      </span>
                    </div>

                    {existingClosing && existingClosing.status === 'CLOSED' && (
                      <div>
                        <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                          စာရင်းပိတ်ပြင်ဆင်ရသည့် အကြောင်းပြချက် (Reason for Correction)*:
                        </label>
                        <input
                          type="text"
                          value={correctionReason}
                          onChange={(e) => setCorrectionReason(e.target.value)}
                          placeholder="ပြင်ဆင်ရသည့် အကြောင်းပြချက် ရှင်းလင်းစွာ ရေးပါ..."
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20 text-slate-900 dark:text-white text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        မှတ်ချက် (Notes):
                      </label>
                      <input
                        type="text"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder={getNotePlaceholder('DAILY_CLOSING')}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      />
                    </div>

                    {closingError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {closingError}
                      </div>
                    )}

                    {closingSuccess && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        {closingSuccess}
                      </div>
                    )}

                    <button
                      onClick={handlePerformClosing}
                      disabled={isPerformingClosing}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isPerformingClosing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      {existingClosing ? 'နေ့ချုပ်စာရင်း ပြင်ဆင်သိမ်းဆည်းရန်' : 'နေ့ချုပ်စာရင်း ပိတ်သိမ်းအတည်ပြုရန်'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Historical Closings List */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" /> ယခင်နေ့ချုပ်မှတ်တမ်းများ (Closing History)
                </h3>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-3 px-4">ပိတ်သည့်ရက်စွဲ</th>
                          <th className="py-3 px-4">အခြေအနေ</th>
                          <th className="py-3 px-4 text-right">စတင်ငွေ</th>
                          <th className="py-3 px-4 text-right">ငွေအဝင်</th>
                          <th className="py-3 px-4 text-right">ငွေအထွက်</th>
                          <th className="py-3 px-4 text-right">ရှိရမည့်ငွေ</th>
                          <th className="py-3 px-4 text-right">ရေတွက်ရငွေ</th>
                          <th className="py-3 px-4 text-right">ကွဲလွဲမှု</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {dailyClosings.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400">
                              နေ့ချုပ်မှတ်တမ်း မရှိသေးပါ
                            </td>
                          </tr>
                        ) : (
                          dailyClosings.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                {c.closingDate}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  c.status === 'CLOSED'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                {formatNumberOnly(c.openingCash)}
                              </td>
                              <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                                +{formatNumberOnly(c.totalCashIn)}
                              </td>
                              <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-semibold">
                                -{formatNumberOnly(c.totalCashOut)}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                                {formatNumberOnly(c.expectedClosingCash)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                                {formatNumberOnly(c.actualCountedCash)}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold">
                                {c.difference === 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">0</span>
                                ) : c.difference > 0 ? (
                                  <span className="text-blue-600">+{formatNumberOnly(c.difference)}</span>
                                ) : (
                                  <span className="text-rose-600">-{formatNumberOnly(Math.abs(c.difference))}</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Cash Movement Modal */}
      {isAddMovementOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                ငွေစာရင်းသွင်းခြင်း / အသုံးစရိတ်
              </h3>
              <button
                onClick={() => setIsAddMovementOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  အမျိုးအစား ရွေးချယ်ပါ
                </label>
                <select
                  value={newMovType}
                  onChange={(e) => setNewMovType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="EXPENSE">ဆိုင်အသုံးစရိတ် (Expense - ငွေအထွက်)</option>
                  <option value="SUPPLIER_PAYOUT">ကုန်သွင်းသူသို့ ကုန်ဖိုးပေးချေခြင်း (Supplier Payout - ငွေအထွက်)</option>
                  <option value="OPENING_FLOAT">အဖွင့်ငွေ (Opening Cash Float - စတင်ငွေလက်ကျန်)</option>
                  <option value="INCOME">အထွေထွေဝင်ငွေ (Other Income - ငွေအဝင်)</option>
                  <option value="CAPITAL_INJECTION">အရင်းထပ်ထည့်ငွေ (Capital Injection - ငွေအဝင်)</option>
                  <option value="OWNER_DRAW">ဆိုင်ရှင်ထုတ်ယူငွေ (Owner Draw - ငွေအထွက်)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ငွေပမာဏ (ကျပ်) *
                </label>
                <input
                  type="number"
                  placeholder="ဥပမာ - ၂၀,၀၀၀"
                  value={newMovAmount}
                  onChange={(e) => setNewMovAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  အကြောင်းအရာ / ခေါင်းစဉ် *
                </label>
                <input
                  type="text"
                  placeholder="ဥပမာ - သယ်ယူပို့ဆောင်ရေးနှင့် ကားခ"
                  value={newMovDescription}
                  onChange={(e) => setNewMovDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ဆက်စပ်သူ (ရှိလျှင်)
                  </label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - ကားသမား"
                    value={newMovCounterpart}
                    onChange={(e) => setNewMovCounterpart(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ရက်စွဲ *
                  </label>
                  <input
                    type="date"
                    value={newMovDate}
                    onChange={(e) => setNewMovDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  မှတ်ချက် (အပိုဆောင်း)
                </label>
                <input
                  type="text"
                  placeholder="မှတ်ချက်များ ရေးသားပါ"
                  value={newMovNotes}
                  onChange={(e) => setNewMovNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMovementOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="button"
                  onClick={handleSaveMovement}
                  disabled={isSavingMovement}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingMovement ? 'သိမ်းဆည်းနေပါသည်...' : 'စာရင်းသွင်းမည်'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
