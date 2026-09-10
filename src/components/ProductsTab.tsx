import React, { useState, useMemo, useEffect } from 'react';
import { Product } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  parseBilingualNumber,
  getStoredProductCategories,
} from '../utils/storage';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Tag,
  DollarSign,
  Layers,
  FileSpreadsheet,
  SlidersHorizontal,
} from 'lucide-react';
import { CategoryManageModal } from './CategoryManageModal';

interface ProductsTabProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onOpenExcelImport?: () => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onOpenExcelImport,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(36);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('ယွန်းထည်');
  const [defaultPrice, setDefaultPrice] = useState<number>(0);
  const [defaultWholesalePrice, setDefaultWholesalePrice] = useState<number>(0);
  const [unit, setUnit] = useState<string>('ထည်');
  const [openingStock, setOpeningStock] = useState<number>(50);
  const [minStockAlert, setMinStockAlert] = useState<number>(15);

  const categories = useMemo(() => {
    const set = new Set<string>(getStoredProductCategories());
    (products || []).forEach((p) => {
      if (p && p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products, isCategoryModalOpen]);

  const filteredProducts = useMemo(() => {
    return (products || []).filter((p) => {
      if (!p) return false;
      const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Reset display limit when filter changes for instant high performance
  useEffect(() => {
    setDisplayLimit(36);
  }, [searchQuery, selectedCategory]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setCategory('ယွန်းထည်');
    setDefaultPrice(0);
    setDefaultWholesalePrice(0);
    setUnit('ထည်');
    setOpeningStock(0);
    setMinStockAlert(15);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setDefaultPrice(p.defaultPrice);
    setDefaultWholesalePrice(p.defaultWholesalePrice || Math.round(p.defaultPrice * 1.25));
    setUnit(p.unit);
    setOpeningStock(p.openingStock || 0);
    setMinStockAlert(p.minStockAlert || 15);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingProduct) {
      const updated: Product = {
        ...editingProduct,
        name: name.trim(),
        category: category.trim() || 'ယွန်းထည်',
        defaultPrice: defaultPrice || 0,
        defaultWholesalePrice: defaultWholesalePrice || Math.round((defaultPrice || 0) * 1.25),
        unit: unit.trim() || 'ထည်',
        openingStock: openingStock || 0,
        minStockAlert: minStockAlert || 15,
      };
      onUpdateProduct(updated);
    } else {
      const newProd: Product = {
        id: `p-${Date.now()}`,
        name: name.trim(),
        category: category.trim() || 'ယွန်းထည်',
        defaultPrice: defaultPrice || 0,
        defaultWholesalePrice: defaultWholesalePrice || Math.round((defaultPrice || 0) * 1.25),
        unit: unit.trim() || 'ထည်',
        openingStock: openingStock || 0,
        currentStock: openingStock || 0,
        minStockAlert: minStockAlert || 15,
        active: true,
      };
      onAddProduct(newProd);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ကုန်ပစ္စည်းများနှင့် စျေးနှုန်းသတ်မှတ်ချက်
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  {products.length} မျိုး
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                ယွန်းထည်၊ ဝါးထည်၊ ကြိမ်ထည်ပစ္စည်းများ ဝယ်စျေးနှင့် ရောင်းစျေး စီမံခြင်း
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenExcelImport && (
            <button
              type="button"
              onClick={onOpenExcelImport}
              className="px-3.5 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-600/60 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel ဖြင့် သွင်းမည်</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ ပစ္စည်းအသစ် ထည့်သွင်းမည်</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ပစ္စည်းအမည်ဖြင့် ရှာဖွေမည်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              အမျိုးအစားအားလုံး
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="အမျိုးအစား စီမံပြင်ဆင်ရန်"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>အမျိုးအစား ပြင်ဆင်ရန်</span>
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredProducts.slice(0, displayLimit).map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    {product.name}
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium inline-block mt-1">
                    {product.category}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(product)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {onDeleteProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`ပစ္စည်း "${product.name}" ကို ဖျက်လိုပါသလား?`)) {
                          onDeleteProduct(product.id);
                        }
                      }}
                      className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">ပုံမှန်ဝယ်စျေး (ကုန်သိမ်း)</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatMMK(product.defaultPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">လက္ကားရောင်းစျေး</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {formatMMK(product.defaultWholesalePrice || Math.round(product.defaultPrice * 1.25))}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-xs text-slate-500 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span>ယူနစ်: <strong className="text-slate-700">{product.unit}</strong></span>
                  <span>စတင်လက်ကျန်: <strong className="text-slate-700">{product.openingStock || 0} {product.unit}</strong></span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded">
                  <span>အနည်းဆုံးရှိရမည့်လက်ကျန်:</span>
                  <strong className="font-bold">{product.minStockAlert || 15} {product.unit}</strong>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls for Large Scale Datasets */}
      {filteredProducts.length > displayLimit && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 mt-2 text-xs">
          <span className="text-slate-600">
            စုစုပေါင်း <strong>{filteredProducts.length}</strong> မျိုးအနက် <strong>{displayLimit}</strong> မျိုး ပြသထားပါသည်
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDisplayLimit((prev) => prev + 36)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              နောက်ထပ် ၃၆ မျိုး ကြည့်မည် (+36)
            </button>
            <button
              type="button"
              onClick={() => setDisplayLimit(filteredProducts.length)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors"
            >
              အားလုံးကြည့်မည် ({filteredProducts.length})
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  {editingProduct ? 'ပစ္စည်းအချက်အလက် ပြင်ဆင်ခြင်း' : 'ပစ္စည်းအသစ် ထည့်သွင်းခြင်း'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ပစ္စည်းအမည် *</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ကွမ်းအစ် ၇ လက်မ (ပန်းချီ)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">အမျိုးအစား *</label>
                  <input
                    type="text"
                    list="product-category-list"
                    placeholder="ဥပမာ - ယွန်းထည်"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <datalist id="product-category-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ရေတွက်ယူနစ် *</label>
                  <input
                    type="text"
                    placeholder="ဥပမာ - ထည်"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    ဝယ်စျေး (ကျပ်) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={defaultPrice === 0 ? '' : defaultPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseBilingualNumber(e.target.value);
                      const price = isNaN(val) ? 0 : Math.max(0, val);
                      setDefaultPrice(price);
                      if (!editingProduct) {
                        setDefaultWholesalePrice(Math.round(price * 1.25));
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    လက္ကားရောင်းစျေး (ကျပ်) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={defaultWholesalePrice === 0 ? '' : defaultWholesalePrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseBilingualNumber(e.target.value);
                      setDefaultWholesalePrice(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-blue-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    အဖွင့်လက်ကျန် (Opening Stock)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={openingStock === 0 ? '' : openingStock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseBilingualNumber(e.target.value);
                      setOpeningStock(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    အနည်းဆုံးသတိပေးလက်ကျန်
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={minStockAlert === 0 ? '' : minStockAlert}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseBilingualNumber(e.target.value);
                      setMinStockAlert(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  သိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Category Management Modal */}
      <CategoryManageModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        products={products}
        onUpdateProduct={onUpdateProduct}
      />
    </div>
  );
};
