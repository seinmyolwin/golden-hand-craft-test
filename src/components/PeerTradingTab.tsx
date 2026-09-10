import React, { useState, useMemo } from 'react';
import { PeerTradeRecord, Product, Merchant } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/storage';
import {
  ArrowRightLeft,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
  Calendar,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  RotateCcw,
  Check,
  Eye,
  Store,
  DollarSign,
  Package,
} from 'lucide-react';

interface PeerTradingTabProps {
  peerTrades: PeerTradeRecord[];
  products: Product[];
  merchants?: Merchant[];
  onAddPeerTrade: (trade: PeerTradeRecord) => void;
  onUpdatePeerTrade?: (trade: PeerTradeRecord) => void;
  onDeletePeerTrade?: (tradeId: string) => void;
}

export const PeerTradingTab: React.FC<PeerTradingTabProps> = ({
  peerTrades = [],
  products = [],
  merchants = [],
  onAddPeerTrade,
  onUpdatePeerTrade,
  onDeletePeerTrade,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BORROW_IN' | 'LEND_OUT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'SETTLED'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedTradeForDetail, setSelectedTradeForDetail] = useState<PeerTradeRecord | null>(null);

  // Form State
  const [tradeType, setTradeType] = useState<'BORROW_IN' | 'LEND_OUT'>('BORROW_IN');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
  const [peerShopName, setPeerShopName] = useState<string>('');
  const [peerLocation, setPeerLocation] = useState<string>('ပုဂံမြို့ဟောင်း');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(10);
  const [agreedUnitPrice, setAgreedUnitPrice] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const filteredTrades = useMemo(() => {
    return (peerTrades || []).filter((t) => {
      if (!t) return false;
      const matchesSearch =
        (t.peerShopName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.peerLocation || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.merchantName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'ALL' || t.tradeType === typeFilter;
      
      const isSettled = t.status === 'REPAID' || t.status === 'RETRIEVED' || t.status === 'SETTLED' || t.status === 'RETURNED';
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'OPEN' && !isSettled) ||
        (statusFilter === 'SETTLED' && isSettled);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [peerTrades, searchQuery, typeFilter, statusFilter]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let openBorrowCount = 0;
    let openBorrowValue = 0;
    let openLendCount = 0;
    let openLendValue = 0;

    (peerTrades || []).forEach((t) => {
      const isSettled = t.status === 'REPAID' || t.status === 'RETRIEVED' || t.status === 'SETTLED' || t.status === 'RETURNED';
      if (!isSettled) {
        if (t.tradeType === 'BORROW_IN') {
          openBorrowCount++;
          openBorrowValue += t.totalTradeValue || 0;
        } else if (t.tradeType === 'LEND_OUT') {
          openLendCount++;
          openLendValue += t.totalTradeValue || 0;
        }
      }
    });

    return {
      openBorrowCount,
      openBorrowValue,
      openLendCount,
      openLendValue,
    };
  }, [peerTrades]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerShopName.trim()) {
      alert('မိတ်ဖက်ဆိုင် / ကုန်သည် အမည် ထည့်သွင်းပေးပါ');
      return;
    }

    const prod = products.find((p) => p.id === selectedProductId) || products[0];
    if (!prod) {
      alert('ကုန်ပစ္စည်း ရွေးချယ်ပေးပါ');
      return;
    }

    const selectedMerchant = merchants.find((m) => m.id === selectedMerchantId);
    const totalVal = (quantity || 0) * (agreedUnitPrice || 0);

    const newTrade: PeerTradeRecord = {
      id: `pt-${Date.now()}`,
      tradeType,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      peerShopName: peerShopName.trim(),
      peerLocation: peerLocation.trim() || 'ပုဂံ',
      merchantId: selectedMerchantId || undefined,
      merchantName: selectedMerchant ? selectedMerchant.name : undefined,
      productId: prod.id,
      productName: prod.name,
      quantity: quantity || 1,
      unit: prod.unit || 'ထည်',
      agreedUnitPrice: agreedUnitPrice || 0,
      totalTradeValue: totalVal,
      status: 'OPEN',
      notes: notes.trim(),
    };

    onAddPeerTrade(newTrade);
    setIsModalOpen(false);
    setSelectedMerchantId('');
    setPeerShopName('');
    setQuantity(10);
    setAgreedUnitPrice(0);
    setNotes('');
  };

  const handleSettleTrade = (trade: PeerTradeRecord, settlementType: 'REPAID' | 'RETRIEVED' | 'CASH_SETTLED') => {
    if (!onUpdatePeerTrade) return;

    let newStatus: string = 'SETTLED';
    let actionName = '';

    if (settlementType === 'REPAID') {
      newStatus = 'REPAID';
      actionName = 'ပစ္စည်း ပြန်ဆပ်ပြီး';
    } else if (settlementType === 'RETRIEVED') {
      newStatus = 'RETRIEVED';
      actionName = 'ပစ္စည်း ပြန်လည်ရယူပြီး';
    } else {
      newStatus = 'SETTLED';
      actionName = 'ငွေဖြင့် ရှင်းလင်းပြီး';
    }

    const updated: PeerTradeRecord = {
      ...trade,
      status: newStatus,
      settledDate: getTodayDateString(),
      settledTime: getCurrentTimeString(),
      settledType: settlementType,
      settledNotes: `${actionName} (${getTodayDateString()} ${getCurrentTimeString()})`,
    };

    onUpdatePeerTrade(updated);
    if (selectedTradeForDetail && selectedTradeForDetail.id === trade.id) {
      setSelectedTradeForDetail(updated);
    }
  };

  const handleReopenTrade = (trade: PeerTradeRecord) => {
    if (!onUpdatePeerTrade) return;
    const updated: PeerTradeRecord = {
      ...trade,
      status: 'OPEN',
      settledDate: undefined,
      settledTime: undefined,
      settledType: undefined,
      settledNotes: undefined,
    };
    onUpdatePeerTrade(updated);
    if (selectedTradeForDetail && selectedTradeForDetail.id === trade.id) {
      setSelectedTradeForDetail(updated);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                မိတ်ဖက်ဆိုင် / ကုန်သည်များအကြား ကုန်ဖလှယ်/ချေးငှားခြင်း
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-700/50">
                  {peerTrades.length} စောင်
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                အော်ဒါအရေးပေါ်လိုအပ်ချိန် ဆိုင်အချင်းချင်း ကုန်ချေးယူခြင်း၊ ထုတ်ငှားခြင်း၊ ပြန်ဆပ်ခြင်းနှင့် ပြန်လည်ရယူခြင်း
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (products.length > 0 && !selectedProductId) {
              setSelectedProductId(products[0].id);
              setAgreedUnitPrice(products[0].defaultWholesalePrice || products[0].defaultPrice || 0);
            }
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ ကုန်ဖလှယ်မှတ်တမ်းတင်မည်</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-teal-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold">ချေးယူထားဆဲ (ပြန်ဆပ်ရန်ကျန်)</div>
              <div className="text-base font-extrabold text-teal-900">
                {summaryMetrics.openBorrowCount} မှု / {formatMMK(summaryMetrics.openBorrowValue)}
              </div>
            </div>
          </div>
          <span className="text-[11px] px-2 py-0.5 bg-teal-100 text-teal-800 font-bold rounded-full">
            အဝင်လက်ကျန်တိုး
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold">ထုတ်ငှားထားဆဲ (ပြန်ရယူရန်ကျန်)</div>
              <div className="text-base font-extrabold text-amber-900">
                {summaryMetrics.openLendCount} မှု / {formatMMK(summaryMetrics.openLendValue)}
              </div>
            </div>
          </div>
          <span className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full">
            အထွက်လက်ကျန်လျော့
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="မိတ်ဖက်ဆိုင် / ကုန်သည် / ကုန်ပစ္စည်း / နေရာဖြင့် ရှာမည်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                typeFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              အားလုံး
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('BORROW_IN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                typeFilter === 'BORROW_IN' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ချေးယူခြင်း (အဝင်)
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('LEND_OUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                typeFilter === 'LEND_OUT' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ထုတ်ငှားခြင်း (အထွက်)
            </button>

            <span className="text-slate-300">|</span>

            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              စာရင်းအားလုံး
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OPEN')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === 'OPEN' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              မရှင်းလင်းရသေး
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SETTLED')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === 'SETTLED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              ရှင်းလင်းပြီး
            </button>
          </div>
        </div>
      </div>

      {/* Trades Grid */}
      <div className="space-y-3">
        {filteredTrades.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            <ArrowRightLeft className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">ကုန်ဖလှယ်မှတ်တမ်း မရှိသေးပါ</p>
          </div>
        ) : (
          filteredTrades.map((t) => {
            const isSettled = t.status === 'REPAID' || t.status === 'RETRIEVED' || t.status === 'SETTLED' || t.status === 'RETURNED';

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-teal-300 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${
                        t.tradeType === 'BORROW_IN'
                          ? 'bg-teal-100 text-teal-800 border border-teal-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {t.tradeType === 'BORROW_IN' ? (
                        <>
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>ချေးယူ (+) အဝင်</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>ထုတ်ငှား (-) အထွက်</span>
                        </>
                      )}
                    </span>

                    {/* Status Badge */}
                    {t.status === 'REPAID' && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ပစ္စည်း ပြန်ဆပ်ပြီး</span>
                      </span>
                    )}
                    {t.status === 'RETRIEVED' && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 rounded text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ပစ္စည်း ပြန်လည်ရယူပြီး</span>
                      </span>
                    )}
                    {t.status === 'SETTLED' && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 rounded text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ငွေဖြင့် ရှင်းလင်းပြီး</span>
                      </span>
                    )}
                    {(!isSettled || t.status === 'OPEN') && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 rounded text-[11px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>မရှင်းလင်းရသေး (စာရင်းဖွင့်ဆဲ)</span>
                      </span>
                    )}

                    <span className="text-xs text-slate-500">
                      {t.date} {t.time}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      တန်ဖိုး: {formatMMK(t.totalTradeValue)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTradeForDetail(t)}
                      className="px-2 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="အသေးစိတ်ကြည့်ရှုမည်"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>အသေးစိတ်</span>
                    </button>
                    {onDeletePeerTrade && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`မှတ်တမ်း ဖျက်လိုပါသလား?`)) {
                            onDeletePeerTrade(t.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        title="ဖျက်မည်"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-teal-600" />
                      {t.peerShopName}
                      <span className="text-xs text-slate-500 font-normal">({t.peerLocation})</span>
                      {t.merchantName && (
                        <span className="text-[11px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-medium">
                          ကုန်သည်: {t.merchantName}
                        </span>
                      )}
                    </h4>
                  </div>
                  <div className="text-right font-bold text-sm text-slate-800">
                    {t.productName}: <span className="text-teal-700 font-extrabold">{t.quantity}</span> {t.unit}
                    <div className="text-[11px] text-slate-500 font-normal">
                      (@ {formatMMK(t.agreedUnitPrice)}/{t.unit})
                    </div>
                  </div>
                </div>

                {/* Quick Settle Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div className="text-slate-500 italic text-[11px]">
                    {t.settledNotes ? (
                      <span className="text-emerald-700 font-semibold">{t.settledNotes}</span>
                    ) : t.notes ? (
                      `မှတ်ချက်: ${t.notes}`
                    ) : (
                      'မှတ်ချက်မရှိ'
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isSettled ? (
                      <>
                        {t.tradeType === 'BORROW_IN' ? (
                          <button
                            type="button"
                            onClick={() => handleSettleTrade(t, 'REPAID')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>ပစ္စည်း ပြန်ဆပ်မည်</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSettleTrade(t, 'RETRIEVED')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>ပစ္စည်း ပြန်လည်ရယူမည်</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSettleTrade(t, 'CASH_SETTLED')}
                          className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold rounded text-xs cursor-pointer transition-colors"
                        >
                          ငွေဖြင့်ရှင်းမည်
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReopenTrade(t)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>ပြန်ဖွင့်မည်</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Trade Detail Modal */}
      {selectedTradeForDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-sm font-bold">ကုန်ဖလှယ်မှု မှတ်တမ်းအသေးစိတ်</h3>
                  <p className="text-[11px] text-slate-300">ဘောင်ချာနံပါတ်: {selectedTradeForDetail.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTradeForDetail(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Type and Status Header */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-[11px]">ဖလှယ်မှုပုံစံ</div>
                  <div className="font-extrabold text-sm text-slate-900">
                    {selectedTradeForDetail.tradeType === 'BORROW_IN'
                      ? 'အခြားဆိုင်မှ ချေးယူခြင်း (အဝင်လက်ကျန်တိုး)'
                      : 'အခြားဆိုင်သို့ ထုတ်ငှားခြင်း (အထွက်လက်ကျန်လျော့)'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[11px]">စာရင်းအခြေအနေ</div>
                  <div>
                    {selectedTradeForDetail.status === 'REPAID' && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-xs">
                        ပစ္စည်း ပြန်ဆပ်ပြီး
                      </span>
                    )}
                    {selectedTradeForDetail.status === 'RETRIEVED' && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-xs">
                        ပစ္စည်း ပြန်လည်ရယူပြီး
                      </span>
                    )}
                    {selectedTradeForDetail.status === 'SETTLED' && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-xs">
                        ငွေဖြင့် ရှင်းလင်းပြီး
                      </span>
                    )}
                    {(!selectedTradeForDetail.status || selectedTradeForDetail.status === 'OPEN') && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-bold rounded text-xs">
                        မရှင်းလင်းရသေး (ဖွင့်ဆဲ)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="text-slate-500 text-[11px]">မိတ်ဖက်ဆိုင် / ကုန်သည်</div>
                  <div className="font-bold text-slate-900 text-sm">{selectedTradeForDetail.peerShopName}</div>
                  <div className="text-slate-500 text-[11px]">{selectedTradeForDetail.peerLocation}</div>
                  {selectedTradeForDetail.merchantName && (
                    <div className="text-teal-700 text-[11px] font-semibold mt-0.5">
                      ကုန်သည်စာရင်း: {selectedTradeForDetail.merchantName}
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="text-slate-500 text-[11px]">ရက်စွဲနှင့် အချိန်</div>
                  <div className="font-bold text-slate-900 text-sm">{selectedTradeForDetail.date}</div>
                  <div className="text-slate-500 text-[11px]">{selectedTradeForDetail.time}</div>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
                <div className="text-teal-900 font-bold mb-2 flex items-center gap-1.5 text-xs">
                  <Package className="w-4 h-4 text-teal-700" />
                  <span>ကုန်ပစ္စည်းအချက်အလက်</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-slate-500 text-[11px]">ပစ္စည်းအမည်</div>
                    <div className="font-bold text-slate-900">{selectedTradeForDetail.productName}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">အရေအတွက်</div>
                    <div className="font-bold text-teal-800 text-sm">
                      {selectedTradeForDetail.quantity} {selectedTradeForDetail.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">စုစုပေါင်းတန်ဖိုး</div>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {formatMMK(selectedTradeForDetail.totalTradeValue)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Settlement Information */}
              {selectedTradeForDetail.settledNotes && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-emerald-900 font-bold text-xs flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ရှင်းလင်းပြီးစီးမှု မှတ်တမ်း</span>
                  </div>
                  <p className="text-emerald-800 text-xs font-medium">{selectedTradeForDetail.settledNotes}</p>
                </div>
              )}

              {selectedTradeForDetail.notes && (
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 font-semibold">မှတ်ချက်: </span>
                  <span className="text-slate-700">{selectedTradeForDetail.notes}</span>
                </div>
              )}

              {/* Settlement Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <div className="text-slate-700 font-bold text-xs">လုပ်ဆောင်ချက် ရွေးချယ်ပါ -</div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedTradeForDetail.tradeType === 'BORROW_IN' ? (
                    <button
                      type="button"
                      onClick={() => handleSettleTrade(selectedTradeForDetail, 'REPAID')}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>ပစ္စည်း ပြန်ဆပ်မည် (အလိုအလျောက်နှုတ်မည်)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSettleTrade(selectedTradeForDetail, 'RETRIEVED')}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>ပစ္စည်း ပြန်လည်ရယူမည် (လက်ကျန်ပြန်တိုးမည်)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSettleTrade(selectedTradeForDetail, 'CASH_SETTLED')}
                    className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>ငွေဖြင့် ရှင်းလင်းမည်</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleReopenTrade(selectedTradeForDetail)}
                    className="py-1.5 px-3 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>မရှင်းလင်းရသေးအဖြစ် ပြန်ပြောင်းမည်</span>
                  </button>

                  {onDeletePeerTrade && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`မှတ်တမ်း ဖျက်လိုပါသလား?`)) {
                          onDeletePeerTrade(selectedTradeForDetail.id);
                          setSelectedTradeForDetail(null);
                        }
                      }}
                      className="py-1.5 px-3 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>မှတ်တမ်းဖျက်မည်</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-teal-300" />
                <h3 className="text-sm font-bold">ကုန်ဖလှယ်/ချေးငှား မှတ်တမ်းတင်ခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-teal-800 hover:bg-teal-700 text-teal-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ဖလှယ်မှု ပုံစံ</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTradeType('BORROW_IN')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                      tradeType === 'BORROW_IN'
                        ? 'bg-teal-50 text-teal-800 border-teal-500 ring-1 ring-teal-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    အခြားဆိုင်မှ ချေးယူခြင်း (အဝင်)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType('LEND_OUT')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                      tradeType === 'LEND_OUT'
                        ? 'bg-amber-50 text-amber-800 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    အခြားဆိုင်သို့ ထုတ်ငှားခြင်း (အထွက်)
                  </button>
                </div>
              </div>

              {/* Merchant Picker */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်သည် / မိတ်ဖက် ရွေးချယ်ရန်</label>
                <select
                  value={selectedMerchantId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    setSelectedMerchantId(mId);
                    if (mId) {
                      const found = merchants.find((m) => m.id === mId);
                      if (found) {
                        setPeerShopName(found.name);
                        setPeerLocation(found.town || found.address || 'ပုဂံ');
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- ကုန်သည်ရွေးမည် (သို့မဟုတ် အောက်တွင် ကိုယ်တိုင်ရိုက်ထည့်မည်) --</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.town || 'မြို့မဖော်ပြ'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">မိတ်ဖက်ဆိုင် / ကုန်သည်အမည် *</label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - ရွှေပြည်စိုး ယွန်းဆိုင်"
                    value={peerShopName}
                    onChange={(e) => setPeerShopName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">တည်နေရာ/မြို့</label>
                  <input
                    type="text"
                    value={peerLocation}
                    onChange={(e) => setPeerLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်ပစ္စည်း ရွေးချယ်ပါ</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const p = products.find((prod) => prod.id === e.target.value);
                    if (p) setAgreedUnitPrice(p.defaultWholesalePrice || p.defaultPrice || 0);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">အရေအတွက်</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity === 0 ? '' : quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">သတ်မှတ်တန်ဖိုးနှုန်း (ကျပ်)</label>
                  <input
                    type="number"
                    min="0"
                    value={agreedUnitPrice === 0 ? '' : agreedUnitPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAgreedUnitPrice(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - နောက်အပတ် ကုန်သိမ်းပြီး ပြန်ဆပ်မည်"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  သိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
