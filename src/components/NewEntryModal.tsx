import React, { useState, useEffect, useMemo } from 'react';
import { Supplier, Product, TransactionRecord, TransactionItem } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  getTodayDateString,
  getCurrentTimeString,
  findPotentialDuplicateTransaction,
  getStoredTransactions,
  parseBilingualNumber,
} from '../utils/storage';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  User,
  Package,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { PhotoAttachmentField } from './PhotoAttachmentField';

interface NewEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Product[];
  initialSupplierId?: string;
  selectedDate: string;
  onSave: (record: TransactionRecord) => void;
}

export const NewEntryModal: React.FC<NewEntryModalProps> = ({
  isOpen,
  onClose,
  suppliers = [],
  products = [],
  initialSupplierId,
  selectedDate,
  onSave,
}) => {
  const [supplierId, setSupplierId] = useState<string>(initialSupplierId || (suppliers[0]?.id || ''));
  const [entryDate, setEntryDate] = useState<string>(selectedDate || getTodayDateString());
  const [entryTime, setEntryTime] = useState<string>(getCurrentTimeString());

  const [items, setItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([
    { productId: products[0]?.id || '', quantity: 10, unitPrice: products[0]?.defaultPrice || 0 },
  ]);

  const [newAdvanceTaken, setNewAdvanceTaken] = useState<number>(0);
  const [newAdvanceReason, setNewAdvanceReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attachmentPhotos, setAttachmentPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (initialSupplierId) {
      setSupplierId(initialSupplierId);
    } else if (suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].id);
    }
  }, [initialSupplierId, suppliers]);

  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId);
  }, [suppliers, supplierId]);

  const previousAdvanceBalance = currentSupplier?.currentAdvanceBalance || 0;

  const totalGoodsValue = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
  }, [items]);

  // Advance deduction logic
  const advanceDeducted = Math.min(previousAdvanceBalance, totalGoodsValue);
  const netCashPaidToSupplier = Math.max(0, totalGoodsValue - advanceDeducted);
  const remainingAdvanceBalance = previousAdvanceBalance - advanceDeducted + newAdvanceTaken;

  if (!isOpen) return null;

  const handleAddItem = () => {
    const firstProd = products[0];
    setItems([
      ...items,
      { productId: firstProd?.id || '', quantity: 10, unitPrice: firstProd?.defaultPrice || 0 },
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
      updated[index].unitPrice = prod.defaultPrice;
    }
    setItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSupplier || isSubmitting) return;

    const validItems: TransactionItem[] = items
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
      .filter((it): it is TransactionItem => it !== null);

    if (validItems.length === 0) {
      alert('အနည်းဆုံး ကုန်ပစ္စည်း ၁ မျိုး ထည့်သွင်းပေးပါ');
      return;
    }

    // Duplicate Entry Protection
    const existingTxs = getStoredTransactions();
    const duplicate = findPotentialDuplicateTransaction(
      {
        supplierId: currentSupplier.id,
        date: entryDate,
        totalGoodsValue,
        items: validItems,
        netCashPaidToSupplier,
      },
      existingTxs
    );

    if (duplicate) {
      const confirmed = window.confirm(
        `သတိပေးချက် - အလားတူ ကုန်သိမ်းစာရင်းကို ယခင်က ထည့်သွင်းထားပြီးဖြစ်ပါသည်!\n\n` +
        `• ယခင်ဘောင်ချာ: ${duplicate.voucherNo}\n` +
        `• ရက်စွဲ: ${duplicate.date}\n` +
        `• ပေးသွင်းသူ: ${duplicate.supplierName}\n` +
        `• ကုန်တန်ဖိုး: ${formatMMK(duplicate.totalGoodsValue)}\n\n` +
        `စာရင်းထပ်မံမဝင်စေရန် စစ်ဆေးပါ။ ဆက်လက်ထည့်သွင်းမည် သေချာပါသလား?`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsSubmitting(true);
    const voucherNo = `IN-${Date.now().toString().slice(-6)}`;

    const newRecord: TransactionRecord = {
      id: `tx-${Date.now()}`,
      voucherNo,
      date: entryDate,
      time: entryTime,
      supplierId: currentSupplier.id,
      supplierName: currentSupplier.name,
      supplierVillage: currentSupplier.village,
      items: validItems,
      totalGoodsValue,
      previousAdvanceBalance,
      advanceDeducted,
      newAdvanceTaken,
      newAdvanceReason: newAdvanceReason.trim(),
      netCashPaidToSupplier,
      remainingAdvanceBalance,
      notes: notes.trim(),
      attachmentPhotos,
    };

    try {
      onSave(newRecord);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 max-h-[95vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">ကုန်သိမ်းစာရင်း ရေးသွင်းမည်</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-emerald-900/80 hover:bg-emerald-700 text-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs flex-1 overflow-y-auto overscroll-contain">
          {/* Supplier Selection & Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">ကုန်ပစ္စည်းပေးသွင်းသူ ရွေးချယ်ပါ *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                required
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.village}) - {s.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-center">
              <span className="text-[11px] text-slate-500">လက်ရှိလက်ကျန်အကြိုငွေ (Advance)</span>
              <span className={`text-base font-extrabold ${previousAdvanceBalance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {formatMMK(previousAdvanceBalance)}
              </span>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">ရက်စွဲ</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">အချိန်</label>
              <input
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                required
              />
            </div>
          </div>

          {/* Products List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 font-bold">သိမ်းဆည်းသော ကုန်ပစ္စည်းများ</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ပစ္စည်းထပ်ထည့်မည်</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                >
                  <div className="sm:col-span-6">
                    <select
                      value={item.productId}
                      onChange={(e) => handleProductChange(idx, e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit}) - {formatNumberOnly(p.defaultPrice)} Ks
                        </option>
                      ))}
                    </select>
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
                  <div className="sm:col-span-2 text-right font-extrabold text-slate-800 text-xs truncate">
                    {formatNumberOnly(item.quantity * item.unitPrice)} Ks
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
              ))}
            </div>
          </div>

          {/* New Advance Option */}
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
            <span className="font-bold text-amber-900 block">အကြိုငွေ အသစ်ထုတ်ပေးငွေ (ရှိလျှင်)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="ငွေပမာဏ - 0"
                  value={newAdvanceTaken === 0 ? '' : newAdvanceTaken}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = parseBilingualNumber(e.target.value);
                    setNewAdvanceTaken(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="အကြောင်းပြချက် (ဥပမာ - ဝါးနှီးဖိုးအကြိုထုတ်)"
                  value={newAdvanceReason}
                  onChange={(e) => setNewAdvanceReason(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Summary Calculation */}
          <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">သိမ်းဆည်းကုန်တန်ဖိုး စုစုပေါင်း:</span>
              <strong className="text-emerald-400">{formatMMK(totalGoodsValue)}</strong>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">အကြိုငွေမှ နုတ်ယူငွေ:</span>
              <strong className="text-slate-200">{formatMMK(advanceDeducted)}</strong>
            </div>
            {netCashPaidToSupplier > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">ကုန်ပစ္စည်းပေးသွင်းသူသို့ လက်ငင်းရှင်းပေးငွေ:</span>
                <strong className="text-blue-300">{formatMMK(netCashPaidToSupplier)}</strong>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
              <span>ကျန်ရှိမည့် အကြိုငွေစာရင်း:</span>
              <span className={`text-base font-black ${remainingAdvanceBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatMMK(remainingAdvanceBalance)}
              </span>
            </div>
          </div>

          {/* Photo Attachment */}
          <PhotoAttachmentField
            photos={attachmentPhotos}
            onChange={setAttachmentPhotos}
            label="ကုန်သိမ်းပြေစာ / ပစ္စည်း ဓာတ်ပုံ ပူးတွဲမှတ်တမ်း"
          />

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
            <input
              type="text"
              placeholder="ဥပမာ - နောက်အပတ်တွင် ပန်းကန်ထပ်အပ်မည်"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Buttons */}
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
              className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'ဘောင်ချာဖွင့်နေပါသည်...' : 'ဘောင်ချာဖွင့်၍ စာရင်းသွင်းမည်'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
