import React, { useState, useEffect } from 'react';
import { Merchant } from '../../types';
import { generateStableId } from '../../utils/idGenerator';
import { parseBilingualNumber } from '../../utils/storage';
import { Building2, X, Check, Plus, AlertCircle } from 'lucide-react';

interface MerchantMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantToEdit?: Merchant | null;
  onSave: (merchant: Merchant) => void;
  onSaveAndSelect?: (merchant: Merchant) => void;
  existingTowns?: string[];
}

const COMMON_TOWNS = [
  'မန္တလေး',
  'ရန်ကုန်',
  'နေပြည်တော်',
  'ပုဂံ',
  'ညောင်ဦး',
  'ပခုက္ကူ',
  'မုံရွာ',
  'ပြင်ဦးလွင်',
  'တောင်ကြီး',
  'မိတ္ထီလာ',
  'စစ်ကိုင်း',
  'မကွေး',
];

export const MerchantMasterModal: React.FC<MerchantMasterModalProps> = ({
  isOpen,
  onClose,
  merchantToEdit,
  onSave,
  onSaveAndSelect,
  existingTowns = [],
}) => {
  const isEditing = Boolean(merchantToEdit);

  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [town, setTown] = useState<string>('မန္တလေး');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [role, setRole] = useState<'BUYER' | 'SUPPLIER' | 'BOTH'>('BUYER');
  const [receivableBalance, setReceivableBalance] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const townOptions = Array.from(new Set([...existingTowns.filter(Boolean), ...COMMON_TOWNS]));

  useEffect(() => {
    if (merchantToEdit) {
      setName(merchantToEdit.name || '');
      setCode(merchantToEdit.code || '');
      setTown(merchantToEdit.town || 'မန္တလေး');
      setPhone(merchantToEdit.phone || '');
      setAddress(merchantToEdit.address || '');
      setContactPerson(merchantToEdit.contactPerson || '');
      setRole(merchantToEdit.role || 'BUYER');
      setReceivableBalance(merchantToEdit.receivableBalance || 0);
      setNotes(merchantToEdit.notes || '');
      setActive(merchantToEdit.active !== false);
    } else {
      setName('');
      setCode(`MER-${Math.floor(100 + Math.random() * 900)}`);
      setTown(townOptions[0] || 'မန္တလေး');
      setPhone('');
      setAddress('');
      setContactPerson('');
      setRole('BUYER');
      setReceivableBalance(0);
      setNotes('');
      setActive(true);
    }
    setError('');
  }, [merchantToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent, shouldSelect = false) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('ကုန်သည်အမည် / ဆိုင်အမည် ဖြည့်သွင်းရန် လိုအပ်ပါသည်');
      return;
    }

    const cleanTown = town.trim() || 'မန္တလေး';

    const finalMerchant: Merchant = {
      id: merchantToEdit ? merchantToEdit.id : generateStableId('m'),
      code: code.trim() || undefined,
      name: cleanName,
      town: cleanTown,
      phone: phone.trim() || '09-',
      address: address.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      role,
      receivableBalance: isEditing ? (merchantToEdit?.receivableBalance || 0) : Math.max(0, receivableBalance || 0),
      notes: notes.trim() || undefined,
      active,
      createdAt: merchantToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(finalMerchant);
    if (shouldSelect && onSaveAndSelect) {
      onSaveAndSelect(finalMerchant);
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
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEditing ? 'ကုန်သည် အချက်အလက် ပြင်ဆင်ခြင်း' : 'ကုန်သည် အသစ်ထည့်သွင်းခြင်း'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEditing ? `ID: ${merchantToEdit?.id}` : 'အခြေခံ ကုန်သည်/ဖောက်သည် စာရင်းသွင်းခြင်း'}
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

          {/* Merchant Name & Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-700 font-bold mb-1">
                ကုန်သည်အမည် / ဆိုင်အမည် <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="ဥပမာ - ဒေါ်ခင်စန်း (ရွှေမင်းသမီး)"
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
                placeholder="MER-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Town & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                မြို့နယ် / ဒေသ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="merchant-towns-list"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="မြို့အမည် ရိုက်/ရွေးပါ"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <datalist id="merchant-towns-list">
                {townOptions.map((t) => (
                  <option key={t} value={t} />
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

          {/* Role & Contact Person */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">လုပ်ငန်းအခန်းကဏ္ဍ</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'BUYER' | 'SUPPLIER' | 'BOTH')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="BUYER">ကုန်ဝယ်ဖောက်သည် (Buyer)</option>
                <option value="SUPPLIER">ကုန်ကြမ်းရောင်းသူ (Material Supplier)</option>
                <option value="BOTH">နှစ်မျိုးလုံး (Buyer & Supplier)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">ဆက်သွယ်ရန်ပုဂ္ဂိုလ်</label>
              <input
                type="text"
                placeholder="ဆိုင်ရှင်/မန်နေဂျာ အမည်"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">ဆိုင်လိပ်စာ</label>
            <input
              type="text"
              placeholder="ဥပမာ - ၇၈ လမ်း၊ ၃၁-၃၂ ကြား၊ မန္တလေး"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Initial Receivable Balance (ရရန်ကျန်ငွေ) */}
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200">
            <label className="block text-blue-900 font-bold mb-1">
              စတင်ရရန်ကျန်ငွေ (Initial Receivable Balance)
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              disabled={isEditing}
              value={receivableBalance === 0 ? '' : receivableBalance}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setReceivableBalance(Math.max(0, parseBilingualNumber(e.target.value)))}
              className={`w-full px-3 py-2 border rounded-lg text-sm font-black font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isEditing
                  ? 'bg-blue-100/50 text-blue-700 border-blue-200 cursor-not-allowed'
                  : 'bg-white text-blue-900 border-blue-300'
              }`}
            />
            <span className="text-[10px] text-blue-700 block mt-1">
              {isEditing
                ? 'ရရန်ကျန်ငွေကို အရောင်းဘောင်ချာများနှင့် ငွေလက်ခံမှုများမှတစ်ဆင့် အလိုအလျောက် ထိန်းသိမ်းပါသည်'
                : 'စတင်စာရင်းဖွင့်ချိန်တွင် ကုန်သည်ထံမှ ရရန်ကျန်ငွေဟောင်း ရှိပါက ထည့်သွင်းပါ (မရှိပါက သုည ထားပါ)'}
            </span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
            <textarea
              rows={2}
              placeholder="ကုန်သည်ဆိုင်ရာ အခြားမှတ်ချက်များ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="merchant-active-toggle"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="merchant-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
              လက်ရှိ ရောင်းဝယ်နေဆဲ (Active Merchant)
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
