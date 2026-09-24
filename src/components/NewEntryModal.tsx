import React, { useState, useEffect, useMemo } from 'react';
import { Supplier, Product, TransactionRecord, TransactionItem } from '../types';
import {
  getTodayDateString,
  getCurrentTimeString,
  findPotentialDuplicateTransaction,
  parseBilingualNumber,
} from '../utils/storage';
import { formatMMK, formatNumberOnly } from '../utils/currency';
import { generateStableId, generateVoucherNo } from '../utils/idGenerator';
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
  UserPlus,
} from 'lucide-react';
import { PhotoAttachmentField } from './PhotoAttachmentField';
import { SupplierMasterModal } from './master/SupplierMasterModal';
import { ProductMasterModal } from './master/ProductMasterModal';
import { NumericInput, getNotePlaceholder } from './NumericInput';

interface NewEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Product[];
  existingTransactions?: TransactionRecord[];
  initialSupplierId?: string;
  selectedDate: string;
  onSave: (record: TransactionRecord) => void;
  onAddSupplier?: (supplier: Supplier) => void;
  onAddProduct?: (product: Product) => void;
}

export const NewEntryModal: React.FC<NewEntryModalProps> = ({
  isOpen,
  onClose,
  suppliers = [],
  products = [],
  existingTransactions = [],
  initialSupplierId,
  selectedDate,
  onSave,
  onAddSupplier,
  onAddProduct,
}) => {
  const [supplierId, setSupplierId] = useState<string>(initialSupplierId || (suppliers[0]?.id || ''));
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierVillage, setNewSupplierVillage] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(selectedDate || getTodayDateString());
  const [entryTime, setEntryTime] = useState<string>(getCurrentTimeString());
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState<boolean>(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState<boolean>(false);

  const [items, setItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([
    { productId: products[0]?.id || '', quantity: 10, unitPrice: products[0]?.defaultPrice || 0 },
  ]);

  const [newAdvanceTaken, setNewAdvanceTaken] = useState<number>(0);
  const [newAdvanceReason, setNewAdvanceReason] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CREDIT'>('CASH');
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
    if (supplierId === '__NEW__') {
      return {
        id: '__NEW__',
        name: newSupplierName.trim(),
        village: newSupplierVillage.trim() || 'အထွေထွေ',
        phone: newSupplierPhone.trim(),
        currentAdvanceBalance: 0,
        code: '',
        createdAt: '',
        updatedAt: '',
      };
    }
    return suppliers.find((s) => s.id === supplierId);
  }, [suppliers, supplierId, newSupplierName, newSupplierVillage, newSupplierPhone]);

  const previousAdvanceBalance = currentSupplier?.currentAdvanceBalance || 0;

  const totalGoodsValue = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
  }, [items]);

  // Advance deduction logic
  const advanceDeducted = Math.min(previousAdvanceBalance, totalGoodsValue);
  const netCalculatedGoodsDue = Math.max(0, totalGoodsValue - advanceDeducted);
  const netCashPaidToSupplier = paymentMode === 'CREDIT' ? 0 : netCalculatedGoodsDue;
  const supplierPayableAmount = paymentMode === 'CREDIT' ? netCalculatedGoodsDue : 0;
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
    if (isSubmitting) return;

    if (supplierId === '__NEW__') {
      if (!newSupplierName.trim()) {
        alert('ကုန်ပစ္စည်းပေးသွင်းသူ / ကုန်သည် အမည် ထည့်သွင်းပေးပါ');
        return;
      }
    } else if (!currentSupplier) {
      alert('ကုန်ပစ္စည်းပေးသွင်းသူ ရွေးချယ်ပေးပါ');
      return;
    }

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
    const existingTxs = existingTransactions;
    const finalSupplierId = supplierId === '__NEW__' ? '__NEW__' : currentSupplier.id;
    const finalSupplierName = supplierId === '__NEW__' ? newSupplierName.trim() : currentSupplier.name;
    const finalSupplierVillage = supplierId === '__NEW__' ? (newSupplierVillage.trim() || 'အထွေထွေ') : currentSupplier.village;
    const finalSupplierPhone = supplierId === '__NEW__' ? newSupplierPhone.trim() : currentSupplier.phone;

    const duplicate = findPotentialDuplicateTransaction(
      {
        supplierId: finalSupplierId,
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
    const voucherNo = generateVoucherNo('IN', entryDate);

    const newRecord: TransactionRecord = {
      id: generateStableId('tx'),
      voucherNo,
      date: entryDate,
      time: entryTime,
      supplierId: finalSupplierId,
      supplierName: finalSupplierName,
      supplierVillage: finalSupplierVillage,
      supplierPhone: finalSupplierPhone,
      type: 'COLLECTION_AND_SETTLEMENT',
      items: validItems,
      totalGoodsValue,
      previousAdvanceBalance,
      advanceDeducted,
      newAdvanceTaken,
      newAdvanceReason: newAdvanceReason.trim(),
      cashPaidToSupplier: netCashPaidToSupplier,
      netCashPaidToSupplier,
      netPayable: supplierPayableAmount,
      paymentMethod: paymentMode,
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold">ကုန်ပစ္စည်းပေးသွင်းသူ ရွေးချယ်ပါ *</label>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(true)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ ပေးသွင်းသူအသစ်</span>
                </button>
              </div>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="__NEW__" className="font-bold text-emerald-700 bg-emerald-50">
                  + ကုန်သည် / ပေးသွင်းသူအသစ် ထည့်ရန်...
                </option>
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

            {supplierId === '__NEW__' && (
              <div className="col-span-1 sm:col-span-2 p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <UserPlus className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>ကုန်သည် / ပေးသွင်းသူ အသစ်စာရင်းသွင်းရန်</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      အမည် *
                    </label>
                    <input
                      type="text"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder="ဥပမာ - ဦးဘကောင်း"
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ကျေးရွာ / မြို့နယ်
                    </label>
                    <input
                      type="text"
                      value={newSupplierVillage}
                      onChange={(e) => setNewSupplierVillage(e.target.value)}
                      placeholder="ဥပမာ - ကူကုန်း"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ဖုန်းနံပါတ်
                    </label>
                    <input
                      type="text"
                      value={newSupplierPhone}
                      onChange={(e) => setNewSupplierPhone(e.target.value)}
                      placeholder="09..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="text-[11px] text-purple-700 hover:text-purple-800 font-bold flex items-center gap-1 cursor-pointer bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ ကုန်ပစ္စည်းအသစ်</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ အကွက်ထပ်ထည့်မည်</span>
                </button>
              </div>
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
                    <NumericInput
                      placeholder="အရေအတွက်"
                      value={item.quantity === 0 ? '' : item.quantity}
                      onChangeValue={(val) => {
                        const updated = [...items];
                        updated[idx].quantity = Math.max(0, val);
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
                <NumericInput
                  placeholder="ငွေပမာဏ - 0"
                  value={newAdvanceTaken === 0 ? '' : newAdvanceTaken}
                  onChangeValue={(val) => setNewAdvanceTaken(Math.max(0, val))}
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

          {/* Payment Mode Selector */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-800 text-xs block">ငွေရှင်းပေးချေမှု ပုံစံ</span>
              <span className="text-[11px] text-slate-500">လက်ငင်းငွေချေ သို့မဟုတ် အကြွေးထားရှိခြင်း</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('CASH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  paymentMode === 'CASH'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                လက်ငင်းငွေချေ (CASH)
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('CREDIT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  paymentMode === 'CREDIT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                }`}
              >
                အကြွေးထားမည် (CREDIT / PAYABLE)
              </button>
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
            {paymentMode === 'CREDIT' ? (
              <div className="flex justify-between text-xs font-bold text-rose-400">
                <span>ပေးသွင်းသူသို့ ပေးရန်ကျန် (Payable):</span>
                <span>{formatMMK(supplierPayableAmount)}</span>
              </div>
            ) : netCashPaidToSupplier > 0 ? (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">ကုန်ပစ္စည်းပေးသွင်းသူသို့ လက်ငင်းရှင်းပေးငွေ:</span>
                <strong className="text-blue-300">{formatMMK(netCashPaidToSupplier)}</strong>
              </div>
            ) : null}
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
              placeholder={getNotePlaceholder('INBOUND_VOUCHER')}
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

        {/* Canonical Master Data Modals */}
        <SupplierMasterModal
          isOpen={isAddSupplierModalOpen}
          onClose={() => setIsAddSupplierModalOpen(false)}
          onSave={(newS) => {
            if (onAddSupplier) onAddSupplier(newS);
            setSupplierId(newS.id);
            setIsAddSupplierModalOpen(false);
          }}
          onSaveAndSelect={(newS) => {
            if (onAddSupplier) onAddSupplier(newS);
            setSupplierId(newS.id);
            setIsAddSupplierModalOpen(false);
          }}
          existingVillages={Array.from(new Set(suppliers.map((s) => s.village).filter(Boolean)))}
        />

        <ProductMasterModal
          isOpen={isAddProductModalOpen}
          onClose={() => setIsAddProductModalOpen(false)}
          onSave={(newP) => {
            if (onAddProduct) onAddProduct(newP);
            setItems((prev) => [
              ...prev,
              { productId: newP.id, quantity: 10, unitPrice: newP.defaultPrice || 0 },
            ]);
            setIsAddProductModalOpen(false);
          }}
          onSaveAndSelect={(newP) => {
            if (onAddProduct) onAddProduct(newP);
            setItems((prev) => [
              ...prev,
              { productId: newP.id, quantity: 10, unitPrice: newP.defaultPrice || 0 },
            ]);
            setIsAddProductModalOpen(false);
          }}
          availableCategories={Array.from(new Set(products.map((p) => p.category).filter(Boolean)))}
        />
      </div>
    </div>
  );
};
