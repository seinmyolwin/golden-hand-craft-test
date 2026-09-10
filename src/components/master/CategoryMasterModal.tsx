import React, { useState } from 'react';
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_RAW_MATERIAL_CATEGORIES,
  saveStoredProductCategories,
  saveStoredRawMaterialCategories,
} from '../../utils/storage';
import { Layers, X, Plus, Trash2, RotateCcw, Check, AlertCircle } from 'lucide-react';

interface CategoryMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCategories: string[];
  rawMaterialCategories: string[];
  onUpdateProductCategories: (categories: string[]) => void;
  onUpdateRawMaterialCategories: (categories: string[]) => void;
  activeProductCategoriesInUse?: string[];
}

export const CategoryMasterModal: React.FC<CategoryMasterModalProps> = ({
  isOpen,
  onClose,
  productCategories,
  rawMaterialCategories,
  onUpdateProductCategories,
  onUpdateRawMaterialCategories,
  activeProductCategoriesInUse = [],
}) => {
  const [activeTab, setActiveTab] = useState<'PRODUCT' | 'RAW_MATERIAL'>('PRODUCT');
  const [newProdCat, setNewProdCat] = useState<string>('');
  const [newRawCat, setNewRawCat] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleAddProductCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newProdCat.trim();
    if (!clean) return;
    if (productCategories.includes(clean)) {
      setError('ဤအမျိုးအစား အမည် ထည့်သွင်းထားပြီးဖြစ်ပါသည်');
      return;
    }
    const updated = [...productCategories, clean];
    onUpdateProductCategories(updated);
    saveStoredProductCategories(updated);
    setNewProdCat('');
    setError('');
    setSuccessMsg('ကုန်ပစ္စည်းအမျိုးအစား အသစ်ထည့်သွင်းပြီးပါပြီ');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleDeleteProductCategory = (catToDelete: string) => {
    if (activeProductCategoriesInUse.includes(catToDelete)) {
      setError(`"${catToDelete}" အမျိုးအစားကို ကုန်ပစ္စည်းများတွင် အသုံးပြုထားဆဲဖြစ်သဖြင့် ဖျက်၍မရပါ`);
      return;
    }
    if (productCategories.length <= 1) {
      setError('အနည်းဆုံး အမျိုးအစား (၁) ခု ရှိရပါမည်');
      return;
    }
    const updated = productCategories.filter((c) => c !== catToDelete);
    onUpdateProductCategories(updated);
    saveStoredProductCategories(updated);
    setError('');
    setSuccessMsg('အမျိုးအစား ဖျက်ပစ်ပြီးပါပြီ');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleAddRawCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRawCat.trim();
    if (!clean) return;
    if (rawMaterialCategories.includes(clean)) {
      setError('ဤကုန်ကြမ်းအမျိုးအစား အမည် ထည့်သွင်းထားပြီးဖြစ်ပါသည်');
      return;
    }
    const updated = [...rawMaterialCategories, clean];
    onUpdateRawMaterialCategories(updated);
    saveStoredRawMaterialCategories(updated);
    setNewRawCat('');
    setError('');
    setSuccessMsg('ကုန်ကြမ်းအမျိုးအစား အသစ်ထည့်သွင်းပြီးပါပြီ');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleDeleteRawCategory = (catToDelete: string) => {
    if (rawMaterialCategories.length <= 1) {
      setError('အနည်းဆုံး ကုန်ကြမ်းအမျိုးအစား (၁) ခု ရှိရပါမည်');
      return;
    }
    const updated = rawMaterialCategories.filter((c) => c !== catToDelete);
    onUpdateRawMaterialCategories(updated);
    saveStoredRawMaterialCategories(updated);
    setError('');
    setSuccessMsg('ကုန်ကြမ်းအမျိုးအစား ဖျက်ပစ်ပြီးပါပြီ');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleResetToDefaults = () => {
    if (confirm('မူလသတ်မှတ်ချက်အတိုင်း အမျိုးအစားများကို ပြန်လည်သတ်မှတ်လိုပါသလား?')) {
      if (activeTab === 'PRODUCT') {
        onUpdateProductCategories(DEFAULT_PRODUCT_CATEGORIES);
        saveStoredProductCategories(DEFAULT_PRODUCT_CATEGORIES);
      } else {
        onUpdateRawMaterialCategories(DEFAULT_RAW_MATERIAL_CATEGORIES);
        saveStoredRawMaterialCategories(DEFAULT_RAW_MATERIAL_CATEGORIES);
      }
      setSuccessMsg('မူလအတိုင်း ပြန်လည်သတ်မှတ်ပြီးပါပြီ');
      setTimeout(() => setSuccessMsg(''), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">အမျိုးအစား စီမံခန့်ခွဲမှု</h3>
              <p className="text-[11px] text-slate-400">Categories & Groups Master</p>
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

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('PRODUCT');
              setError('');
            }}
            className={`flex-1 py-2.5 text-center cursor-pointer transition-colors border-b-2 ${
              activeTab === 'PRODUCT'
                ? 'border-emerald-600 text-emerald-800 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ကုန်ပစ္စည်း အမျိုးအစား ({productCategories.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('RAW_MATERIAL');
              setError('');
            }}
            className={`flex-1 py-2.5 text-center cursor-pointer transition-colors border-b-2 ${
              activeTab === 'RAW_MATERIAL'
                ? 'border-emerald-600 text-emerald-800 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ကုန်ကြမ်း အမျိုးအစား ({rawMaterialCategories.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-3.5 text-xs overflow-y-auto flex-1 overscroll-contain">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add Category Form */}
          {activeTab === 'PRODUCT' ? (
            <form onSubmit={handleAddProductCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="ကုန်ပစ္စည်းအမျိုးအစားသစ်..."
                value={newProdCat}
                onChange={(e) => {
                  setNewProdCat(e.target.value);
                  if (error) setError('');
                }}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ထည့်မည်</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddRawCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="ကုန်ကြမ်းအမျိုးအစားသစ်..."
                value={newRawCat}
                onChange={(e) => {
                  setNewRawCat(e.target.value);
                  if (error) setError('');
                }}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ထည့်မည်</span>
              </button>
            </form>
          )}

          {/* Category List */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500 block">လက်ရှိ အမျိုးအစားများ</span>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              {(activeTab === 'PRODUCT' ? productCategories : rawMaterialCategories).map((cat) => {
                const isInUse = activeTab === 'PRODUCT' && activeProductCategoriesInUse.includes(cat);
                return (
                  <div key={cat} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-100/70 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{cat}</span>
                      {isInUse && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-medium">
                          အသုံးပြုထားသည်
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        activeTab === 'PRODUCT'
                          ? handleDeleteProductCategory(cat)
                          : handleDeleteRawCategory(cat)
                      }
                      disabled={isInUse}
                      className={`p-1.5 rounded transition-colors ${
                        isInUse
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer'
                      }`}
                      title={isInUse ? 'ကုန်ပစ္စည်းများတွင် အသုံးပြုထားဆဲဖြစ်သည်' : 'ဖျက်ပစ်မည်'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>မူလအတိုင်း ပြန်ထားမည်</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold cursor-pointer transition-colors"
          >
            ပြီးပါပြီ
          </button>
        </div>
      </div>
    </div>
  );
};
