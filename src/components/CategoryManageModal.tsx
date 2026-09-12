import React, { useState, useEffect } from 'react';
import { Product, MasterDataCategory, CategoryDomain } from '../types';
import { X, Plus, Edit2, Trash2, Check, Tag, AlertCircle, Power, RotateCcw } from 'lucide-react';
import { masterDataService } from '../services/masterDataService';

interface CategoryManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  onUpdateProduct?: (product: Product) => void;
  onCategoriesChanged?: () => void;
  initialDomain?: CategoryDomain;
}

export const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  isOpen,
  onClose,
  products = [],
  onUpdateProduct,
  onCategoriesChanged,
  initialDomain = 'FINISHED_GOODS',
}) => {
  const [domain, setDomain] = useState<CategoryDomain>(initialDomain);
  const [categories, setCategories] = useState<MasterDataCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [newCatName, setNewCatName] = useState<string>('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const loadCategories = async () => {
    setLoading(true);
    try {
      const list = await masterDataService.getMasterDataCategories(domain);
      setCategories(list);
    } catch (err: any) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDomain(initialDomain);
      loadCategories();
    }
  }, [isOpen, initialDomain]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [domain]);

  if (!isOpen) return null;

  const handleAddCategory = async () => {
    setErrorMsg('');
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    try {
      await masterDataService.addCategory(domain, trimmed);
      setNewCatName('');
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'အမျိုးအစား ထည့်သွင်း၍ မရပါ');
    }
  };

  const handleStartEdit = (cat: MasterDataCategory) => {
    setErrorMsg('');
    setEditingCatId(cat.id);
    setEditValue(cat.name);
  };

  const handleSaveEdit = async (cat: MasterDataCategory) => {
    setErrorMsg('');
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === cat.name) {
      setEditingCatId(null);
      return;
    }

    try {
      await masterDataService.renameCategory(cat.id, trimmed);
      setEditingCatId(null);
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'အမည် ပြောင်းလဲ၍ မရပါ');
    }
  };

  const handleToggleActive = async (cat: MasterDataCategory) => {
    setErrorMsg('');
    try {
      if (cat.active) {
        await masterDataService.deactivateCategory(cat.id);
      } else {
        await masterDataService.reactivateCategory(cat.id);
      }
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'အဆင့် အပြောင်းအလဲ လုပ်၍ မရပါ');
    }
  };

  const handleDeleteCategory = async (cat: MasterDataCategory) => {
    setErrorMsg('');
    try {
      const res = await masterDataService.deleteCategorySafe(cat.id);
      if (res.message) {
        alert(res.message);
      }
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'ဖျက်ပစ်၍ မရပါ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                အမျိုးအစားများ စီမံခန့်ခွဲခြင်း (Category Master Data)
              </h3>
              <p className="text-[11px] text-slate-400">
                စနစ်၏ ပင်မ အမျိုးအစား စာရင်းများအား ပြင်ဆင်ပိတ်သိမ်းခြင်း
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

        {/* Domain Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setDomain('FINISHED_GOODS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              domain === 'FINISHED_GOODS'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            အချောထည် အမျိုးအစားများ (Finished Goods)
          </button>
          <button
            type="button"
            onClick={() => setDomain('RAW_MATERIAL')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              domain === 'RAW_MATERIAL'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            ကုန်ကြမ်း အမျိုးအစားများ (Raw Materials)
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Add New Category Box */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <label className="font-bold text-emerald-900 block">
              {domain === 'FINISHED_GOODS' ? 'အချောထည်' : 'ကုန်ကြမ်း'} အမျိုးအစား အသစ်ထည့်သွင်းရန်
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={
                  domain === 'FINISHED_GOODS'
                    ? 'ဥပမာ - ဝါးလက်မှု၊ ကျွန်းပန်းပု၊ ကြိမ်ခြင်း...'
                    : 'ဥပမာ - ဝါးကုန်ကြမ်း၊ ကြိမ်ကုန်ကြမ်း...'
                }
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
                className={`px-3.5 py-2 ${
                  domain === 'FINISHED_GOODS'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                } text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ${
                  !newCatName.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>ထည့်မည်</span>
              </button>
            </div>
          </div>

          {/* Current Categories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-600 font-bold px-1">
              <span>လက်ရှိအမျိုးအစားများ ({categories.length})</span>
              <span className="text-[11px] font-normal text-slate-500">အခြေအနေ / အပြောင်းအလဲ</span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400 font-semibold">
                ဒေတာ ရယူနေပါသည်...
              </div>
            ) : categories.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl">
                အမျိုးအစား တစ်ခုမျှ မရှိသေးပါ
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                {categories.map((cat) => {
                  const isEditing = editingCatId === cat.id;
                  const refCount = domain === 'FINISHED_GOODS'
                    ? products.filter((p) => p.categoryId === cat.id || p.category === cat.name).length
                    : 0;

                  return (
                    <div
                      key={cat.id}
                      className={`p-2.5 flex items-center justify-between gap-3 transition-colors ${
                        !cat.active ? 'bg-slate-50/80 opacity-75' : 'hover:bg-slate-50'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(cat);
                              if (e.key === 'Escape') setEditingCatId(null);
                            }}
                            autoFocus
                            className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-500 rounded-lg text-xs font-bold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                            title="သိမ်းမည်"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                            title="မလုပ်တော့ပါ"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`font-bold text-xs sm:text-sm truncate ${
                              !cat.active ? 'text-slate-400 line-through' : 'text-slate-800'
                            }`}>
                              {cat.name}
                            </span>
                            {domain === 'FINISHED_GOODS' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 shrink-0">
                                {refCount} မျိုး
                              </span>
                            )}
                            {cat.active ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                အသုံးပြုနိုင်သည်
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300 shrink-0">
                                ပိတ်ထားသည်
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(cat)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                              title="အမည်ပြင်မည်"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(cat)}
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                cat.active
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={cat.active ? 'ပိတ်ထားမည် (Deactivate)' : 'ပြန်ဖွင့်မည် (Reactivate)'}
                            >
                              {cat.active ? <Power className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="ဖျက်မည်"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              အသုံးပြုထားပြီးသော အမျိုးအစားများကို အပြီးတိုင် ဖျက်မည့်အစား ပိတ်ထား (Deactivate) မည်ဖြစ်ပြီး၊ သမိုင်းဝင် စာရင်းဇယားများနှင့် ဘဏ္ဍာရေး အစီရင်ခံစာများ တိကျမှု ပျက်စီးမည် မဟုတ်ပါ။
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg cursor-pointer text-xs transition-colors"
          >
            ပြီးပါပြီ
          </button>
        </div>
      </div>
    </div>
  );
};
