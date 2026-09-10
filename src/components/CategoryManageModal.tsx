import React, { useState } from 'react';
import { Product } from '../types';
import { X, Plus, Edit2, Trash2, Check, Tag, AlertCircle } from 'lucide-react';
import {
  getStoredProductCategories,
  saveStoredProductCategories,
} from '../utils/storage';

interface CategoryManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onCategoriesChanged?: () => void;
}

export const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  isOpen,
  onClose,
  products = [],
  onUpdateProduct,
  onCategoriesChanged,
}) => {
  const [categories, setCategories] = useState<string[]>(() => {
    const stored = getStoredProductCategories();
    const fromProducts = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    const merged = Array.from(new Set([...stored, ...fromProducts]));
    return merged;
  });

  const [newCatName, setNewCatName] = useState<string>('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  if (!isOpen) return null;

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      alert('ဤအမျိုးအစား အမည် ရှိပြီးသားဖြစ်ပါသည်');
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveStoredProductCategories(updated);
    setNewCatName('');
    if (onCategoriesChanged) onCategoriesChanged();
  };

  const handleStartEdit = (cat: string) => {
    setEditingCat(cat);
    setEditValue(cat);
  };

  const handleSaveEdit = (oldCat: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldCat) {
      setEditingCat(null);
      return;
    }

    if (categories.some((c) => c !== oldCat && c.toLowerCase() === trimmed.toLowerCase())) {
      alert('ဤအမျိုးအစား အမည် ရှိပြီးသားဖြစ်ပါသည်');
      return;
    }

    // Update categories list
    const updated = categories.map((c) => (c === oldCat ? trimmed : c));
    setCategories(updated);
    saveStoredProductCategories(updated);

    // Update all matching products
    const affectedProducts = products.filter((p) => p.category === oldCat);
    affectedProducts.forEach((p) => {
      onUpdateProduct({
        ...p,
        category: trimmed,
      });
    });

    setEditingCat(null);
    if (onCategoriesChanged) onCategoriesChanged();
  };

  const handleDeleteCategory = (cat: string) => {
    const affectedCount = products.filter((p) => p.category === cat).length;
    if (affectedCount > 0) {
      const confirmDelete = window.confirm(
        `"${cat}" အမျိုးအစားတွင် ကုန်ပစ္စည်း ${affectedCount} မျိုး ရှိနေပါသည်။ ဖျက်သိမ်းပြီး ၎င်းပစ္စည်းများကို "အထွေထွေ" သို့ ပြောင်းလဲလိုပါသလား?`
      );
      if (!confirmDelete) return;

      // Reassign affected products to 'အထွေထွေ'
      products
        .filter((p) => p.category === cat)
        .forEach((p) => {
          onUpdateProduct({
            ...p,
            category: 'အထွေထွေ',
          });
        });
    }

    const updated = categories.filter((c) => c !== cat);
    if (!updated.includes('အထွေထွေ') && affectedCount > 0) {
      updated.push('အထွေထွေ');
    }
    setCategories(updated);
    saveStoredProductCategories(updated);
    if (onCategoriesChanged) onCategoriesChanged();
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
                ကုန်ပစ္စည်း အမျိုးအစား (Category) စီမံခြင်း
              </h3>
              <p className="text-[11px] text-slate-400">
                စိတ်ကြိုက် အမျိုးအစားအသစ် ထည့်သွင်းခြင်းနှင့် အမည်ပြောင်းလဲခြင်း
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

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Add New Category Box */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <label className="font-bold text-emerald-900 block">
              အမျိုးအစား အသစ်ထည့်သွင်းရန်
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ဥပမာ - ဝါးလက်မှု၊ ကျွန်းပန်းပု၊ ကြိမ်ခြင်း..."
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
                className={`px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ${
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
              <span className="text-[11px] font-normal text-slate-500">ပစ္စည်းအရေအတွက်</span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                const isEditing = editingCat === cat;

                return (
                  <div
                    key={cat}
                    className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(cat);
                            if (e.key === 'Escape') setEditingCat(null);
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
                          onClick={() => setEditingCat(null)}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                          title="မလုပ်တော့ပါ"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs sm:text-sm">{cat}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            {count} မျိုး
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
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
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              အမျိုးအစား အမည်ကို ပြင်ဆင်လိုက်ပါက ၎င်းအမျိုးအစားဝင် ကုန်ပစ္စည်းအားလုံး၏ စာရင်းတွင် အလိုအလျောက် ပြောင်းလဲပေးမည်ဖြစ်ပါသည်။
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
