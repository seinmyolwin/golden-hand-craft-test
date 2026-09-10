import React, { useState, useEffect, useMemo } from 'react';
import { Merchant, Product, SaleRecord, SaleItem, PaymentMethod } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  getTodayDateString,
  getCurrentTimeString,
  findPotentialDuplicateSale,
  getStoredSales,
  parseBilingualNumber,
} from '../utils/storage';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Building2,
  Truck,
  DollarSign,
  AlertTriangle,
  Search,
  UserCheck,
  Check,
  UserPlus,
} from 'lucide-react';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchants: Merchant[];
  products: Product[];
  initialMerchantId?: string;
  selectedDate: string;
  inventoryStock?: any[];
  onSave: (sale: SaleRecord) => void;
  onAddNewMerchant?: (merchant: Merchant) => void;
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  merchants = [],
  products = [],
  initialMerchantId,
  selectedDate,
  inventoryStock = [],
  onSave,
  onAddNewMerchant,
}) => {
  const [merchantId, setMerchantId] = useState<string>(initialMerchantId || (merchants[0]?.id || ''));
  const [merchantSearch, setMerchantSearch] = useState<string>('');
  const [isQuickAddMerchantOpen, setIsQuickAddMerchantOpen] = useState<boolean>(false);
  const [newMerchantName, setNewMerchantName] = useState<string>('');
  const [newMerchantTown, setNewMerchantTown] = useState<string>('');
  const [newMerchantPhone, setNewMerchantPhone] = useState<string>('');

  const [saleDate, setSaleDate] = useState<string>(selectedDate || getTodayDateString());
  const [saleTime, setSaleTime] = useState<string>(getCurrentTimeString());

  const [items, setItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([
    {
      productId: products[0]?.id || '',
      quantity: 10,
      unitPrice: products[0]?.defaultWholesalePrice || Math.round((products[0]?.defaultPrice || 1000) * 1.25),
    },
  ]);

  const [cashPaidByMerchant, setCashPaidByMerchant] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [deliveryVehicle, setDeliveryVehicle] = useState<string>('');
  const [driverOrContact, setDriverOrContact] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Keep merchantId valid and synchronized whenever modal opens or merchants list updates
  useEffect(() => {
    if (!isOpen) return;

    if (initialMerchantId && merchants.some((m) => m.id === initialMerchantId)) {
      setMerchantId(initialMerchantId);
    } else if (merchantId && merchants.some((m) => m.id === merchantId)) {
      // current merchant is already valid
    } else if (merchants.length > 0) {
      setMerchantId(merchants[0].id);
    } else {
      setMerchantId('');
    }
  }, [isOpen, initialMerchantId, merchants]);

  // Ensure default items have valid products
  useEffect(() => {
    if (isOpen && items.length === 0 && products.length > 0) {
      const firstProd = products[0];
      setItems([
        {
          productId: firstProd.id,
          quantity: 10,
          unitPrice: firstProd.defaultWholesalePrice || Math.round(firstProd.defaultPrice * 1.25),
        },
      ]);
    }
  }, [isOpen, products, items.length]);

  const currentMerchant = useMemo(() => {
    return merchants.find((m) => m.id === merchantId);
  }, [merchants, merchantId]);

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch.trim()) return merchants;
    const q = merchantSearch.toLowerCase().trim();
    return merchants.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.town || '').toLowerCase().includes(q) ||
        (m.phone || '').includes(q)
    );
  }, [merchants, merchantSearch]);

  const handleQuickAddMerchantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchantName.trim()) {
      alert('ကုန်သည်အမည် ရိုက်ထည့်ပေးပါ');
      return;
    }

    const newM: Merchant = {
      id: `merchant-${Date.now()}`,
      code: `M-${(merchants.length + 1).toString().padStart(3, '0')}`,
      name: newMerchantName.trim(),
      town: newMerchantTown.trim() || 'မန္တလေး',
      phone: newMerchantPhone.trim() || '-',
      currentReceivableBalance: 0,
      totalPurchasesValue: 0,
      totalPaidAmount: 0,
      createdAt: getTodayDateString(),
      updatedAt: getTodayDateString(),
    };

    if (onAddNewMerchant) {
      onAddNewMerchant(newM);
    }
    setMerchantId(newM.id);
    setNewMerchantName('');
    setNewMerchantTown('');
    setNewMerchantPhone('');
    setIsQuickAddMerchantOpen(false);
  };

  const previousReceivableBalance = currentMerchant?.currentReceivableBalance || 0;

  const grandTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
  }, [items]);

  const totalItemsCount = useMemo(() => {
    return items.reduce((sum, it) => sum + it.quantity, 0);
  }, [items]);

  const remainingReceivableBalance = Math.max(0, grandTotal - cashPaidByMerchant);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const firstProd = products[0];
    setItems([
      ...items,
      {
        productId: firstProd?.id || '',
        quantity: 10,
        unitPrice: firstProd?.defaultWholesalePrice || Math.round((firstProd?.defaultPrice || 1000) * 1.25),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, pId: string) => {
    const prod = products.find((p) => p.id === pId);
    const updated = [...items];
    updated[index].productId = pId;
    if (prod) {
      updated[index].unitPrice = prod.defaultWholesalePrice || Math.round(prod.defaultPrice * 1.25);
    }
    setItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMerchant || isSubmitting) return;

    const validItems: SaleItem[] = items
      .map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        if (!prod || it.quantity <= 0) return null;
        return {
          productId: prod.id,
          productName: prod.name,
          quantity: it.quantity,
          unit: prod.unit,
          unitPrice: it.unitPrice,
          subtotal: it.quantity * it.unitPrice,
        };
      })
      .filter((it): it is SaleItem => it !== null);

    if (validItems.length === 0) {
      alert('အနည်းဆုံး ရောင်းချမည့် ကုန်ပစ္စည်း ၁ မျိုး ထည့်သွင်းပေးပါ');
      return;
    }

    // Duplicate Sale Check
    const existingSales = getStoredSales();
    const duplicate = findPotentialDuplicateSale(
      {
        merchantId: currentMerchant.id,
        date: saleDate,
        grandTotal,
        items: validItems,
        cashPaidByMerchant,
      },
      existingSales
    );

    if (duplicate) {
      const confirmed = window.confirm(
        `သတိပေးချက် - အလားတူ အရောင်းဘောင်ချာကို ယခင်က ထည့်သွင်းထားပြီးဖြစ်ပါသည်!\n\n` +
        `• ယခင်ဘောင်ချာ: ${duplicate.voucherNo}\n` +
        `• ရက်စွဲ: ${duplicate.date}\n` +
        `• ဝယ်ယူသူကုန်သည်: ${duplicate.merchantName}\n` +
        `• စုစုပေါင်းတန်ဖိုး: ${formatMMK(duplicate.grandTotal)}\n\n` +
        `စာရင်းထပ်မံမဝင်စေရန် စစ်ဆေးပါ။ ဆက်လက်ထုတ်ယူလိုပါသလား?`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsSubmitting(true);
    const voucherNo = `SL-${Date.now().toString().slice(-6)}`;

    const newSale: SaleRecord = {
      id: `sale-${Date.now()}`,
      voucherNo,
      date: saleDate,
      time: saleTime,
      merchantId: currentMerchant.id,
      merchantName: currentMerchant.name,
      merchantTown: currentMerchant.town,
      items: validItems,
      totalItemsCount,
      grandTotal,
      cashPaidByMerchant,
      paymentMethod,
      remainingReceivableBalance,
      deliveryVehicle: deliveryVehicle.trim(),
      driverOrContact: driverOrContact.trim(),
      driverPhone: driverPhone.trim(),
      notes: notes.trim(),
    };

    try {
      onSave(newSale);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-blue-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-300" />
            <h3 className="text-base font-bold">ကုန်သည် အရောင်းဘောင်ချာဖွင့်မည်</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-blue-950 hover:bg-blue-800 text-blue-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs flex-1 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-bold flex items-center gap-1">
                  <span>ကုန်သည် ရွေးချယ်ပါ *</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                    ({merchants.length})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickAddMerchantOpen(true)}
                  className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ ကုန်သည်အသစ်</span>
                </button>
              </div>

              {/* Merchant search filter input */}
              {merchants.length > 3 && (
                <div className="relative mb-1.5">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ကုန်သည်အမည် / မြို့နယ်ဖြင့် အမြန်ရှာရန်..."
                    value={merchantSearch}
                    onChange={(e) => setMerchantSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                  {merchantSearch && (
                    <button
                      type="button"
                      onClick={() => setMerchantSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Merchant Dropdown Select */}
              <select
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-2 border-blue-300 focus:border-blue-600 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer touch-manipulation select-auto"
                required
              >
                {merchants.length === 0 ? (
                  <option value="">-- ကုန်သည်စာရင်း မရှိသေးပါ (+ အသစ်ထည့်ပါ) --</option>
                ) : (
                  <>
                    <option value="">-- ကုန်သည် ရွေးချယ်ပါ ({filteredMerchants.length} ဦး) --</option>
                    {filteredMerchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.town}){m.phone && m.phone !== '-' ? ` • ${m.phone}` : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>

              {merchants.length === 0 && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <span className="text-[11px] text-amber-800 font-semibold">ကုန်သည်စာရင်း မရှိသေးပါ</span>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddMerchantOpen(true)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ အခုချက်ချင်းထည့်မည်</span>
                  </button>
                </div>
              )}

              {currentMerchant && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-blue-50/80 border border-blue-100 rounded-lg flex items-center justify-between text-[11px]">
                  <span className="text-blue-900 font-bold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                    <span>{currentMerchant.name} ({currentMerchant.town})</span>
                  </span>
                  {currentMerchant.phone && currentMerchant.phone !== '-' && (
                    <span className="text-blue-700 font-mono font-semibold">{currentMerchant.phone}</span>
                  )}
                </div>
              )}
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center">
              <span className="text-[11px] text-slate-500">ယခင်ရရန်ကျန်ငွေ (အကြွေးဟောင်း)</span>
              <span className={`text-base font-extrabold ${previousReceivableBalance > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {formatMMK(previousReceivableBalance)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">ရက်စွဲ</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">အချိန်</label>
              <input
                type="time"
                value={saleTime}
                onChange={(e) => setSaleTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                required
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 font-bold">ရောင်းချသော ကုန်ပစ္စည်းများ</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-blue-700 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ပစ္စည်းထပ်ထည့်မည်</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const curProdStock = inventoryStock.find((st) => st.product?.id === item.productId);
                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-5">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
                      {curProdStock && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          လက်ကျန်: {curProdStock.currentStock} {curProdStock.product.unit}
                        </span>
                      )}
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="အရေအတွက်"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = parseBilingualNumber(e.target.value);
                          const updated = [...items];
                          updated[idx].quantity = isNaN(val) ? 0 : Math.max(0, val);
                          setItems(updated);
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                        required
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="ရောင်းစျေး"
                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = parseBilingualNumber(e.target.value);
                          const updated = [...items];
                          updated[idx].unitPrice = isNaN(val) ? 0 : Math.max(0, val);
                          setItems(updated);
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-900"
                        required
                      />
                    </div>
                    <div className="sm:col-span-1 text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Settlement */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-blue-950">ကျသင့်ငွေ စုစုပေါင်း:</span>
              <span className="text-base font-black text-blue-900">{formatMMK(grandTotal)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  လက်ငင်း/လွှဲပေးငွေ (ကျပ်)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cashPaidByMerchant === 0 ? '' : cashPaidByMerchant}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = parseBilingualNumber(e.target.value);
                    setCashPaidByMerchant(isNaN(val) ? 0 : Math.min(grandTotal, Math.max(0, val)));
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-emerald-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">ငွေရှင်းနည်းလမ်း</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold"
                >
                  <option value="CASH">လက်ငင်းငွေသား (Cash)</option>
                  <option value="KPAY">KPay</option>
                  <option value="WAVE">Wave Pay</option>
                  <option value="BANK_TRANSFER">ဘဏ်အကောင့်လွှဲငွေ</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-200 flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">ယခုဘောင်ချာအတွက် ရရန်ကျန်ငွေ:</span>
              <span className={`font-black text-sm ${remainingReceivableBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatMMK(remainingReceivableBalance)}
              </span>
            </div>
          </div>

          {/* Transport & Delivery Vehicle Details */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span className="text-blue-600 font-extrabold">🚗 တင်ပေးလိုက်သည့် ကားနှင့် ဆက်သွယ်ရန်</span>
              <span className="text-[10px] text-slate-500 font-normal">(ဂိတ်ပို့ဆောင်မှု မှတ်တမ်း)</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                တင်ပေးလိုက်သည့်ကား / ယာဉ်အမှတ် / ဂိတ်
              </label>
              <input
                type="text"
                placeholder="ဥပမာ - ရွှေမန္တလာ အဝေးပြေးကား 3B-5591 / မန္တလေးရွှေမန်းသူဂိတ်"
                value={deliveryVehicle}
                onChange={(e) => setDeliveryVehicle(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ယာဉ်မောင်း / ဆက်သွယ်ရမည့်သူ
                </label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ကိုအောင်ကျော် (ယာဉ်မောင်း)"
                  value={driverOrContact}
                  onChange={(e) => setDriverOrContact(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ဆက်သွယ်ရမည့် ဖုန်းနံပါတ်
                </label>
                <input
                  type="text"
                  placeholder="ဥပမာ - 09-790123456"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">အခြား မှတ်ချက်</label>
            <input
              type="text"
              placeholder="ဥပမာ - အထုပ်သေချာကြပ်ထုပ်ထားသည်"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm cursor-pointer ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'ဘောင်ချာထုတ်နေပါသည်...' : 'အရောင်းဘောင်ချာထုတ်မည်'}
            </button>
          </div>
        </form>

        {/* Quick Add Merchant Modal Overlay */}
        {isQuickAddMerchantOpen && (
          <div className="fixed inset-0 z-60 bg-slate-950/70 flex items-center justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-4 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-sm text-slate-900">ကုန်သည်အသစ် အမြန်ထည့်သွင်းမည်</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickAddMerchantOpen(false)}
                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleQuickAddMerchantSubmit} className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ကုန်သည် / ဆိုင်အမည် *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="ဥပမာ - ရွှေမန္တလေး ယွန်းဆိုင်"
                    value={newMerchantName}
                    onChange={(e) => setNewMerchantName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">မြို့နယ် *</label>
                    <input
                      type="text"
                      required
                      placeholder="မန္တလေး"
                      value={newMerchantTown}
                      onChange={(e) => setNewMerchantTown(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">ဖုန်းနံပါတ်</label>
                    <input
                      type="text"
                      placeholder="09-..."
                      value={newMerchantPhone}
                      onChange={(e) => setNewMerchantPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsQuickAddMerchantOpen(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                  >
                    ပယ်ဖျက်
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg cursor-pointer"
                  >
                    ထည့်သွင်းပြီး ရွေးချယ်မည်
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
