import React, { useState, useMemo } from 'react';
import {
  MerchantPurchaseRecord,
  CollectionItem,
  Merchant,
  Product,
} from '../types';
import {
  formatMMK,
  getTodayDateString,
  getCurrentTimeString,
  parseBilingualNumber,
} from '../utils/storage';
import {
  Boxes,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Printer,
  Trash2,
  X,
  CreditCard,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface MerchantPurchasesTabProps {
  purchases: MerchantPurchaseRecord[];
  merchants: Merchant[];
  products: Product[];
  selectedDate: string;
  onSavePurchase: (purchase: MerchantPurchaseRecord) => void;
  onDeletePurchase: (id: string) => void;
}

export const MerchantPurchasesTab: React.FC<MerchantPurchasesTabProps> = ({
  purchases = [],
  merchants = [],
  selectedDate,
  onSavePurchase,
  onDeletePurchase,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<MerchantPurchaseRecord | null>(null);

  // New Purchase Form State
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(selectedDate || getTodayDateString());
  const [purchaseTime, setPurchaseTime] = useState(getCurrentTimeString());
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Items for new purchase
  const [items, setItems] = useState<
    { id: string; materialName: string; quantity: string; unit: string; unitPrice: string }[]
  >([
    { id: '1', materialName: 'ဝါးပိုးဝါး (ဝါးလုံး)', quantity: '100', unit: 'လုံး', unitPrice: '3500' },
  ]);

  const rawPresets = [
    { name: 'ဝါးပိုးဝါး (ဝါးလုံး)', unit: 'လုံး', price: 3500 },
    { name: 'တင်းဝါး (ဝါးလုံး)', unit: 'လုံး', price: 2800 },
    { name: 'ဝါးနှီးစိပ် (စည်း)', unit: 'စည်း', price: 4500 },
    { name: 'ကြိမ်လုံး (စည်း)', unit: 'စည်း', price: 12000 },
    { name: 'ကြိမ်ကြိုး (ခွေ)', unit: 'ခွေ', price: 8500 },
    { name: 'သစ်သားကော် / ကပ်ဆေး', unit: 'ပုလင်း', price: 6000 },
    { name: 'အရောင်တင်ဆီ / သုတ်ဆေး', unit: 'ပုလင်း', price: 8000 },
    { name: 'သဲစက္ကူ (ကော်ပတ်)', unit: 'ချပ်', price: 1500 },
  ];

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        materialName: '',
        quantity: '1',
        unit: 'လုံး',
        unitPrice: '1000',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleApplyPreset = (index: number, presetName: string) => {
    const p = rawPresets.find((x) => x.name === presetName);
    if (!p) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      materialName: p.name,
      unit: p.unit,
      unitPrice: String(p.price),
    };
    setItems(updated);
  };

  const totalCalculated = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = parseBilingualNumber(it.quantity);
      const p = parseBilingualNumber(it.unitPrice);
      return sum + q * p;
    }, 0);
  }, [items]);

  const paidAmount = parseBilingualNumber(paidAmountStr);
  const remainingPayable = Math.max(0, totalCalculated - paidAmount);

  const handleOpenNewModal = () => {
    setSellerName('');
    setSellerPhone('');
    setSellerAddress('');
    setPurchaseDate(selectedDate || getTodayDateString());
    setPurchaseTime(getCurrentTimeString());
    setPaidAmountStr('');
    setNotes('');
    setItems([
      { id: '1', materialName: 'ဝါးပိုးဝါး (ဝါးလုံး)', quantity: '100', unit: 'လုံး', unitPrice: '3500' },
    ]);
    setIsNewModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!sellerName.trim()) {
      alert('ဝယ်ယူသည့် ဆိုင်/ကုန်သည်/ရွာသား အမည် ထည့်သွင်းပေးပါ');
      return;
    }

    const validItems: CollectionItem[] = items
      .map((it) => {
        const q = parseBilingualNumber(it.quantity);
        const p = parseBilingualNumber(it.unitPrice);
        if (!it.materialName.trim() || q <= 0) return null;
        return {
          productId: `raw-${it.materialName.trim().replace(/\s+/g, '-')}`,
          productName: it.materialName.trim(),
          quantity: q,
          unit: it.unit.trim() || 'ခု',
          unitPrice: p,
          subtotal: q * p,
        };
      })
      .filter((it): it is CollectionItem => it !== null);

    if (validItems.length === 0) {
      alert('အနည်းဆုံး ကုန်ကြမ်းပစ္စည်း ၁ မျိုး ထည့်သွင်းပေးပါ');
      return;
    }

    setIsSubmitting(true);

    const purchaseNo = `PUR-${Date.now().toString().slice(-6)}`;
    const newRecord: MerchantPurchaseRecord = {
      id: `pur-${Date.now()}`,
      purchaseNo,
      merchantId: `sel-${Date.now()}`,
      merchantName: sellerName.trim(),
      merchantTown: sellerAddress.trim() || 'အထွေထွေ',
      sellerPhone: sellerPhone.trim(),
      date: purchaseDate,
      time: purchaseTime,
      items: validItems,
      totalAmount: totalCalculated,
      paidAmount: paidAmount,
      remainingPayableBalance: remainingPayable,
      paymentMethod,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSavePurchase(newRecord);
    setIsSubmitting(false);
    setIsNewModalOpen(false);
  };

  // Filtered List
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.purchaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.items.some((it) => it.productName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchDate = !filterDate || p.date === filterDate;
      return matchSearch && matchDate;
    });
  }, [purchases, searchTerm, filterDate]);

  // Totals
  const summary = useMemo(() => {
    let totalAmt = 0;
    let totalPaid = 0;
    let totalPayable = 0;
    filteredPurchases.forEach((p) => {
      totalAmt += p.totalAmount || 0;
      totalPaid += p.paidAmount || 0;
      totalPayable += p.remainingPayableBalance || 0;
    });
    return { totalAmt, totalPaid, totalPayable, count: filteredPurchases.length };
  }, [filteredPurchases]);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-amber-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>ဝါး/ကြိမ် ကုန်ကြမ်းဝယ်ယူမှု စာရင်း</span>
              <span className="text-xs bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full font-mono">
                {purchases.length} ကြိမ်
              </span>
            </h2>
            <p className="text-xs text-amber-200/90">
              ဝါးလုံး၊ ကြိမ်၊ သုတ်ဆေးနှင့် ကုန်ကြမ်းဝယ်ယူငွေ၊ ပေးချေငွေနှင့် ပေးရန်ကျန် စာရင်းထိန်းသိမ်းမှု
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenNewModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-950 rounded-xl font-bold text-xs sm:text-sm shadow-md cursor-pointer transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ ကုန်ကြမ်းဝယ်ယူမှု အသစ်သွင်းမည်</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">စုစုပေါင်း ဝယ်ယူတန်ဖိုး</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {formatMMK(summary.totalAmt)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">ကျသင့်ငွေ စုစုပေါင်း</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">လက်ငင်း ပေးချေငွေ</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-700">
            {formatMMK(summary.totalPaid)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">ရှင်းပြီးသား ငွေသား</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ပေးရန်ကျန်ငွေ (အကြွေး)</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-700">
            {formatMMK(summary.totalPayable)}
          </div>
          <div className="text-[11px] text-rose-600 mt-1">ပေးသွင်းရန် ကျန်ရှိငွေ</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">ဝယ်ယူမှု အရေအတွက်</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900">
            {summary.count} ကြိမ်
          </div>
          <div className="text-[11px] text-slate-500 mt-1">ရွေးချယ်ထားသော စာရင်း</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ဆိုင်အမည်၊ ကုန်ကြမ်းအမည်၊ ဘောင်ချာနံပါတ် ဖြင့် ရှာရန်..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-2 rounded-lg text-xs w-full sm:w-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold px-1"
                title="ရက်စွဲရှင်းမည်"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Records List */}
      <div className="space-y-3">
        {filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">ကုန်ကြမ်းဝယ်ယူမှု စာရင်း မရှိသေးပါ</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              ဝါး၊ ကြိမ်၊ သုတ်ဆေး စသည့် ကုန်ကြမ်းများ ဝယ်ယူသောအခါ အထက်ပါခလုတ်ကို နှိပ်၍ စာရင်းသွင်းနိုင်ပါသည်။
            </p>
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ကုန်ကြမ်းဝယ်ယူမှု အသစ်ထည့်မည်</span>
            </button>
          </div>
        ) : (
          filteredPurchases.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 font-mono text-xs font-bold flex items-center justify-center">
                    PUR
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{rec.merchantName}</span>
                      {rec.merchantTown && (
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {rec.merchantTown}
                        </span>
                      )}
                      {rec.sellerPhone && (
                        <span className="text-[11px] text-slate-500">📞 {rec.sellerPhone}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-mono text-slate-600 font-bold">{rec.purchaseNo}</span>
                      <span>•</span>
                      <span>{rec.date}</span>
                      <span>{rec.time}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setSelectedVoucher(rec)}
                    className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors border border-slate-200"
                    title="ဘောင်ချာကြည့်မည်"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ဘောင်ချာ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`ဘောင်ချာနံပါတ် "${rec.purchaseNo}" စာရင်းကို ဖျက်ရန် သေချာပါသလား?`)) {
                        onDeletePurchase(rec.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                    title="ဖျက်မည်"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 pb-1 font-medium">
                      <th className="py-1">ကုန်ကြမ်းပစ္စည်း</th>
                      <th className="py-1 text-center">အရေအတွက်</th>
                      <th className="py-1 text-right">နှုန်းထား</th>
                      <th className="py-1 text-right">ကျသင့်ငွေ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rec.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-1.5 font-medium text-slate-800">{it.productName}</td>
                        <td className="py-1.5 text-center font-mono text-slate-700">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-1.5 text-right font-mono text-slate-600">
                          {formatMMK(it.unitPrice)}
                        </td>
                        <td className="py-1.5 text-right font-mono font-bold text-slate-900">
                          {formatMMK(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Calculations */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-slate-500">
                  {rec.notes ? (
                    <span>မှတ်ချက်: <span className="text-slate-700">{rec.notes}</span></span>
                  ) : (
                    <span>ရှင်းလင်းနည်း: <span className="font-semibold text-slate-700">{rec.paymentMethod || 'ငွေသား'}</span></span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">ကျသင့်ငွေ: </span>
                    <span className="font-bold font-mono text-slate-900">{formatMMK(rec.totalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ပေးငွေ: </span>
                    <span className="font-bold font-mono text-emerald-700">{formatMMK(rec.paidAmount)}</span>
                  </div>
                  {rec.remainingPayableBalance > 0 && (
                    <div>
                      <span className="text-rose-500 font-semibold">ပေးရန်ကျန်: </span>
                      <span className="font-bold font-mono text-rose-700">
                        {formatMMK(rec.remainingPayableBalance)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Purchase Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-100 max-h-[95vh] flex flex-col">
            <div className="px-4 py-3 bg-amber-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold">ကုန်ကြမ်းဝယ်ယူမှု စာရင်းရေးသွင်းမည်</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="w-7 h-7 rounded-full bg-amber-950 hover:bg-amber-800 text-amber-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs flex-1 overflow-y-auto overscroll-contain">
              {/* Seller Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    ဝယ်ယူသည့် ဆိုင်/ကုန်သည်/ရွာသား အမည် *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ဥပမာ - ဝါးကုန်သည် ဦးတင်လှ"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    list="merchant-sellers-list"
                  />
                  <datalist id="merchant-sellers-list">
                    {merchants.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.town ? `${m.name} (${m.town})` : m.name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">ဖုန်းနံပါတ် / ဆက်သွယ်ရန်</label>
                  <input
                    type="text"
                    placeholder="09-xxxxxxxxx"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ဝယ်ယူသည့် ရက်စွဲ</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">အချိန်</label>
                  <input
                    type="time"
                    value={purchaseTime}
                    onChange={(e) => setPurchaseTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-700" />
                    ကုန်ကြမ်း ပစ္စည်းများ ရွေးချယ်/ဖြည့်သွင်းပါ
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    + အမယ်ထပ်ထည့်ရန်
                  </button>
                </div>

                {items.map((it, idx) => (
                  <div key={it.id} className="bg-white p-2.5 rounded-lg border border-amber-200/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          placeholder="ကုန်ကြမ်းအမည် (ဥပမာ - ဝါးပိုးဝါး၊ ကြိမ်လုံး)"
                          value={it.materialName}
                          onChange={(e) => handleItemChange(idx, 'materialName', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-amber-500"
                          list={`preset-materials-${idx}`}
                        />
                        <datalist id={`preset-materials-${idx}`}>
                          {rawPresets.map((rp, rIdx) => (
                            <option key={rIdx} value={rp.name}>
                              {rp.name} ({rp.unit} လျှင် {rp.price} ကျပ်)
                            </option>
                          ))}
                        </datalist>
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">ဦးရေ/အရေအတွက်</label>
                        <input
                          type="text"
                          required
                          placeholder="အရေအတွက် (အင်္ဂလိပ် သို့ မြန်မာဂဏန်း)"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">ယူနစ်</label>
                        <input
                          type="text"
                          placeholder="လုံး၊ စည်း၊ ပိဿာ"
                          value={it.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">နှုန်းထား (ကျပ်)</label>
                        <input
                          type="text"
                          required
                          placeholder="နှုန်းထား (ဂဏန်း)"
                          value={it.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold focus:bg-white text-right"
                        />
                      </div>
                    </div>

                    <div className="text-right text-[11px] font-bold text-amber-900">
                      ကျသင့်ငွေ: {formatMMK(parseBilingualNumber(it.quantity) * parseBilingualNumber(it.unitPrice))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Settlement / Payments */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  <span>စုစုပေါင်း ကျသင့်ငွေ</span>
                  <span className="font-mono text-base text-amber-900">{formatMMK(totalCalculated)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      လက်ငင်း ပေးချေငွေ (ကျပ်)
                    </label>
                    <input
                      type="text"
                      placeholder="ပေးချေငွေ ထည့်ပါ (၀ သို့ အပြည့်)"
                      value={paidAmountStr}
                      onChange={(e) => setPaidAmountStr(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 text-right"
                    />
                    <div className="flex gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => setPaidAmountStr(String(totalCalculated))}
                        className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold cursor-pointer"
                      >
                        အပြည့်ပေးချေမည်
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmountStr('0')}
                        className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded font-bold cursor-pointer"
                      >
                        အကြွေးထားမည် (၀ ကျပ်)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ပေးချေသည့် နည်းလမ်း</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="CASH">ငွေသား (Cash)</option>
                      <option value="KPAY">KPay</option>
                      <option value="WAVE">WavePay</option>
                      <option value="BANK_TRANSFER">ဘဏ်စာရင်း (KBZ / AYA / CB)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold pt-1.5 border-t border-slate-200">
                  <span className={remainingPayable > 0 ? 'text-rose-600' : 'text-slate-500'}>
                    ပေးသွင်းရန် ကျန်ရှိငွေ (အကြွေး):
                  </span>
                  <span
                    className={`font-mono text-sm ${
                      remainingPayable > 0 ? 'text-rose-700' : 'text-slate-700'
                    }`}
                  >
                    {formatMMK(remainingPayable)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ကုန်ကြမ်းအရည်အသွေး၊ ပို့ဆောင်သည့်ကားနံပါတ်၊ အခြားမှတ်ချက်များ..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'သိမ်းဆည်းနေပါသည်...' : 'စာရင်းသိမ်းဆည်းမည်'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">ကုန်ကြမ်းဝယ်ယူမှု ဘောင်ချာ</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 text-xs space-y-4 voucher-printable-scope">
              <div className="text-center border-b border-slate-200 pb-3">
                <h2 className="text-base font-black text-slate-900">ရွှေလက်ရာ - ကုန်ကြမ်းဝယ်ယူမှု ပြေစာ</h2>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  ဘောင်ချာနံပါတ်: {selectedVoucher.purchaseNo} • ရက်စွဲ: {selectedVoucher.date} {selectedVoucher.time}
                </p>
              </div>

              <div className="flex justify-between text-xs">
                <div>
                  <span className="text-slate-500">ရောင်းချသူ: </span>
                  <span className="font-bold text-slate-900">{selectedVoucher.merchantName}</span>
                </div>
                {selectedVoucher.sellerPhone && (
                  <div>
                    <span className="text-slate-500">ဖုန်း: </span>
                    <span className="font-mono font-bold text-slate-900">{selectedVoucher.sellerPhone}</span>
                  </div>
                )}
              </div>

              <table className="w-full text-xs text-left border-t border-b border-slate-200 py-1">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-bold">
                    <th className="py-1">ပစ္စည်းအမည်</th>
                    <th className="py-1 text-center">ဦးရေ</th>
                    <th className="py-1 text-right">နှုန်း</th>
                    <th className="py-1 text-right">ကျသင့်ငွေ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedVoucher.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1 font-medium">{it.productName}</td>
                      <td className="py-1 text-center font-mono">{it.quantity} {it.unit}</td>
                      <td className="py-1 text-right font-mono">{formatMMK(it.unitPrice)}</td>
                      <td className="py-1 text-right font-mono font-bold">{formatMMK(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-right text-xs">
                <div>
                  <span className="text-slate-500 mr-2">စုစုပေါင်းကျသင့်ငွေ:</span>
                  <span className="font-bold font-mono text-sm">{formatMMK(selectedVoucher.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 mr-2">ပေးချေငွေ:</span>
                  <span className="font-bold font-mono text-emerald-700">{formatMMK(selectedVoucher.paidAmount)}</span>
                </div>
                {selectedVoucher.remainingPayableBalance > 0 && (
                  <div>
                    <span className="text-rose-600 mr-2 font-bold">ပေးရန်ကျန်ငွေ:</span>
                    <span className="font-bold font-mono text-rose-700">
                      {formatMMK(selectedVoucher.remainingPayableBalance)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print-hidden">
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                ပိတ်မည်
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>ပရင့်ထုတ်မည်</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
