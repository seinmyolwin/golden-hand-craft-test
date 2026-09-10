import React, { useState, useEffect } from 'react';
import { Supplier } from '../../types';
import { generateStableId } from '../../utils/idGenerator';
import { parseBilingualNumber } from '../../utils/storage';
import { Users, X, Check, Plus, AlertCircle } from 'lucide-react';

interface SupplierMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierToEdit?: Supplier | null;
  onSave: (supplier: Supplier) => void;
  onSaveAndSelect?: (supplier: Supplier) => void;
  existingVillages?: string[];
}

const COMMON_VILLAGES = [
  'ကူနီ',
  'မြင်းကပါ',
  'ရွာသစ်',
  'တောင်ဘီ',
  'အရှေ့ရွာ',
  'အနောက်ရွာ',
  'ညောင်ဦး',
  'ပုဂံ',
];

export const SupplierMasterModal: React.FC<SupplierMasterModalProps> = ({
  isOpen,
  onClose,
  supplierToEdit,
  onSave,
  onSaveAndSelect,
  existingVillages = [],
}) => {
  const isEditing = Boolean(supplierToEdit);

  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [village, setVillage] = useState<string>('ကူနီ');
  const [phone, setPhone] = useState<string>('');
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const villageOptions = Array.from(new Set([...existingVillages.filter(Boolean), ...COMMON_VILLAGES]));

  useEffect(() => {
    if (supplierToEdit) {
      setName(supplierToEdit.name || '');
      setCode(supplierToEdit.code || '');
      setVillage(supplierToEdit.village || 'ကူနီ');
      setPhone(supplierToEdit.phone || '');
      setAdvanceBalance(supplierToEdit.advanceBalance || 0);
      setNotes(supplierToEdit.notes || '');
      setActive(supplierToEdit.active !== false);
    } else {
      setName('');
      setCode(`SUP-${Math.floor(100 + Math.random() * 900)}`);
      setVillage(villageOptions[0] || 'ကူနီ');
      setPhone('');
      setAdvanceBalance(0);
      setNotes('');
      setActive(true);
    }
    setError('');
  }, [supplierToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent, shouldSelect = false) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('ကုန်ပစ္စည်းပေးသွင်းသူအမည် ဖြည့်သွင်းရန် လိုအပ်ပါသည်');
      return;
    }

    const cleanVillage = village.trim() || 'ကူနီ';

    const finalSupplier: Supplier = {
      id: supplierToEdit ? supplierToEdit.id : generateStableId('sup'),
      code: code.trim() || undefined,
      name: cleanName,
      village: cleanVillage,
      phone: phone.trim() || '09-',
      advanceBalance: isEditing ? (supplierToEdit?.advanceBalance || 0) : Math.max(0, advanceBalance || 0),
      notes: notes.trim() || undefined,
      active,
      createdAt: supplierToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(finalSupplier);
    if (shouldSelect && onSaveAndSelect) {
      onSaveAndSelect(finalSupplier);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEditing ? 'ကုန်ပစ္စည်းပေးသွင်းသူ အချက်အလက် ပြင်ဆင်ခြင်း' : 'ကုန်ပစ္စည်းပေးသွင်းသူ အသစ်ထည့်သွင်းခြင်း'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEditing ? `ID: ${supplierToEdit?.id}` : 'အခြေခံ ပေးသွင်းသူ စာရင်းသွင်းခြင်း'}
              </p>
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

        {/* Form Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1 overscroll-contain">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier Name & Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-700 font-bold mb-1">
                ပေးသွင်းသူအမည် <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="ဥပမာ - ဦးမောင်မောင်"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">ကုဒ် / နံပါတ်</label>
              <input
                type="text"
                placeholder="SUP-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Village & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                ကျေးရွာ / ရပ်ကွက် <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="supplier-villages-list"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="ရွာအမည် ရိုက်/ရွေးပါ"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <datalist id="supplier-villages-list">
                {villageOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">ဖုန်းနံပါတ်</label>
              <input
                type="tel"
                placeholder="09-123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Advance Balance (ငွေကြိုထုတ်) */}
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
            <label className="block text-amber-900 font-bold mb-1">
              စတင်ငွေကြိုယူ လက်ကျန် (Initial Advance Balance)
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              disabled={isEditing}
              value={advanceBalance === 0 ? '' : advanceBalance}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAdvanceBalance(Math.max(0, parseBilingualNumber(e.target.value)))}
              className={`w-full px-3 py-2 border rounded-lg text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isEditing
                  ? 'bg-amber-100/50 text-amber-700 border-amber-200 cursor-not-allowed'
                  : 'bg-white text-amber-900 border-amber-300'
              }`}
            />
            <span className="text-[10px] text-amber-700 block mt-1">
              {isEditing
                ? 'ငွေကြိုယူ လက်ကျန်ကို ကုန်သိမ်းမှု သို့မဟုတ် ငွေထုတ်ပေးမှုများမှတစ်ဆင့် အလိုအလျောက် တွက်ချက်ထိန်းသိမ်းပါသည်'
                : 'စတင်စာရင်းဖွင့်ချိန်တွင် ပေးသွင်းသူထံမှ ကြိုယူထားသော ငွေလက်ကျန်ရှိပါက ထည့်သွင်းပါ (မရှိပါက သုည ထားပါ)'}
            </span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
            <textarea
              rows={2}
              placeholder="ပေးသွင်းသူနှင့် သက်ဆိုင်သော အခြားမှတ်ချက်များ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="supplier-active-toggle"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="supplier-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
              လက်ရှိ ပေးသွင်းနေဆဲ (Active Supplier)
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
            >
              မလုပ်တော့ပါ
            </button>

            {onSaveAndSelect && !isEditing && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg shadow-xs cursor-pointer transition-colors flex items-center gap-1"
              >
                <span>သိမ်းပြီး ရွေးချယ်မည်</span>
              </button>
            )}

            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
            >
              {isEditing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isEditing ? 'ပြင်ဆင်မှု သိမ်းဆည်းမည်' : 'အသစ်ထည့်သွင်းမည်'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
