import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { generateStableId } from '../../utils/idGenerator';
import {
  DEFAULT_PRODUCT_CATEGORIES,
  formatMMK,
  parseBilingualNumber,
} from '../../utils/storage';
import { masterDataService } from '../../services/masterDataService';
import { Package, X, Check, Plus, AlertCircle } from 'lucide-react';

interface ProductMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSave: (product: Product) => void;
  onSaveAndSelect?: (product: Product) => void;
  availableCategories?: string[];
}

const COMMON_UNITS = ['ထည်', 'လုံး', 'ချပ်', 'စည်း', 'ခွေ', 'ပုလင်း', 'ဗူး', 'စုံ', 'ခု'];

export const ProductMasterModal: React.FC<ProductMasterModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSave,
  onSaveAndSelect,
  availableCategories = DEFAULT_PRODUCT_CATEGORIES,
}) => {
  const [masterCats, setMasterCats] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      masterDataService.getMasterDataCategories('FINISHED_GOODS', true)
        .then((cats) => setMasterCats(cats.map((c) => c.name)))
        .catch(console.error);
    }
  }, [isOpen]);

  const categoriesList = masterCats.length > 0 ? masterCats : availableCategories;

  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>(DEFAULT_PRODUCT_CATEGORIES[0] || 'ကုန်ချော');
  const [unit, setUnit] = useState<string>('ထည်');
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [minStockAlert, setMinStockAlert] = useState<number>(10);
  const [active, setActive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setCategory(productToEdit.category || DEFAULT_PRODUCT_CATEGORIES[0] || 'ကုန်ချော');
      setUnit(productToEdit.unit || 'ထည်');
      setBuyPrice(productToEdit.defaultPrice || 0);
      setSellPrice(productToEdit.defaultWholesalePrice || Math.round((productToEdit.defaultPrice || 0) * 1.25));
      setOpeningStock(productToEdit.openingStock || 0);
      setMinStockAlert(productToEdit.minStockAlert ?? 10);
      setActive(productToEdit.active !== false);
      setNotes(productToEdit.notes || '');
    } else {
      setName('');
      setCategory(availableCategories[0] || 'ကုန်ချော');
      setUnit('ထည်');
      setBuyPrice(0);
      setSellPrice(0);
      setOpeningStock(0);
      setMinStockAlert(10);
      setActive(true);
      setNotes('');
    }
    setError('');
  }, [productToEdit, isOpen, availableCategories]);

  if (!isOpen) return null;

  const handleBuyPriceChange = (valStr: string) => {
    const val = Math.max(0, parseBilingualNumber(valStr));
    setBuyPrice(val);
    // Auto-calculate suggested wholesale price with 25% profit if sellPrice was 0 or tied to previous
    if (!isEditing || sellPrice === 0 || sellPrice === Math.round(buyPrice * 1.25)) {
      setSellPrice(Math.round(val * 1.25));
    }
  };

  const handleSubmit = (e: React.FormEvent, shouldSelect = false) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('ကုန်ပစ္စည်းအမည် ဖြည့်သွင်းရန် လိုအပ်ပါသည်');
      return;
    }

    const cleanUnit = unit.trim() || 'ထည်';
    const cleanCat = category.trim() || 'ကုန်ချော';

    const finalProduct: Product = {
      id: productToEdit ? productToEdit.id : generateStableId('p'),
      name: cleanName,
      category: cleanCat,
      unit: cleanUnit,
      defaultPrice: buyPrice || 0,
      defaultWholesalePrice: sellPrice || Math.round((buyPrice || 0) * 1.25),
      openingStock: isEditing ? (productToEdit?.openingStock || 0) : Math.max(0, openingStock || 0),
      currentStock: isEditing
        ? (typeof productToEdit?.currentStock === 'number' ? productToEdit.currentStock : openingStock)
        : Math.max(0, openingStock || 0),
      minStockAlert: Math.max(1, minStockAlert || 10),
      active,
      notes: notes.trim() || undefined,
      createdAt: productToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(finalProduct);
    if (shouldSelect && onSaveAndSelect) {
      onSaveAndSelect(finalProduct);
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
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEditing ? 'ကုန်ပစ္စည်း အချက်အလက် ပြင်ဆင်ခြင်း' : 'ကုန်ပစ္စည်း အသစ်ထည့်သွင်းခြင်း'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEditing ? `ID: ${productToEdit?.id}` : 'အခြေခံ ကုန်ပစ္စည်း စာရင်းသွင်းခြင်း'}
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

          {/* Product Name */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              ကုန်ပစ္စည်းအမည် <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="ဥပမာ - ယွန်း ကွမ်းအစ် (အလတ်)"
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

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">အမျိုးအစား</label>
              <input
                type="text"
                list="product-categories-list"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="အမျိုးအစား ရွေး/ရိုက်ပါ"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="product-categories-list">
                {availableCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">ရေတွက်ပုံယူနစ်</label>
              <input
                type="text"
                list="product-units-list"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ထည် / လုံး / ချပ်"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="product-units-list">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Pricing: Buy Price & Wholesale Price */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                ဝယ်စျေး / အရင်း (ကျပ်)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={buyPrice === 0 ? '' : buyPrice}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleBuyPriceChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ကုန်သိမ်းအဝင် ဝယ်ယူစျေး
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                လက္ကားရောင်းစျေး (ကျပ်)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={sellPrice === 0 ? '' : sellPrice}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setSellPrice(Math.max(0, parseBilingualNumber(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-black text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-blue-600 block mt-0.5">
                အမြတ် ၂၅% အကြံပြုစျေး
              </span>
            </div>
          </div>

          {/* Stock Quantities & Alert */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                စတင်လက်ကျန် (Opening Stock)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                disabled={isEditing}
                value={openingStock === 0 ? '' : openingStock}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setOpeningStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isEditing
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-900 border-slate-300'
                }`}
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {isEditing ? 'စတင်လက်ကျန် ပြင်ခွင့်မရှိပါ' : 'မရှိသေးပါက သုည (၀) ထားပါ'}
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                လက်ကျန်နည်း သတိပေးသတ်မှတ်ချက်
              </label>
              <input
                type="number"
                min="1"
                placeholder="10"
                value={minStockAlert}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setMinStockAlert(Math.max(1, parseInt(e.target.value, 10) || 10))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ဤပမာဏအောက်လျော့လျှင် သတိပေးမည်
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
            <textarea
              rows={2}
              placeholder="ပစ္စည်းဆိုင်ရာ အသေးစိတ် အချက်အလက်များ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="product-active-toggle"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="product-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
              လက်ရှိ အသုံးပြုနေဆဲ ကုန်ပစ္စည်း (Active Product)
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
