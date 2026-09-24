import React, { useState, useMemo, useEffect } from 'react';
import {
  Product,
  TransactionRecord,
  SaleRecord,
  StockAdjustmentRecord,
  MerchantPurchaseRecord,
  PeerTradeRecord,
} from '../types';
import {
  getStoredProductCategories,
  DEFAULT_PRODUCT_CATEGORIES,
} from '../utils/storage';
import { formatMMK } from '../utils/currency';
import { masterDataService } from '../services/masterDataService';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Tag,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import { CategoryManageModal } from './CategoryManageModal';
import { ProductMasterModal } from './master/ProductMasterModal';
import { ProductStockLedgerModal } from './ProductStockLedgerModal';
import {
  calculateAllProductsStockLedgerSummaries,
  exportAllProductsStockLedgerSummaryCSV,
} from '../services/stockLedgerService';

interface ProductsTabProps {
  products?: Product[];
  transactions?: TransactionRecord[];
  sales?: SaleRecord[];
  stockAdjustments?: StockAdjustmentRecord[];
  merchantPurchases?: MerchantPurchaseRecord[];
  peerTrades?: PeerTradeRecord[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onOpenExcelImport?: () => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products = [] as Product[],
  transactions = [] as TransactionRecord[],
  sales = [] as SaleRecord[],
  stockAdjustments = [] as StockAdjustmentRecord[],
  merchantPurchases = [] as MerchantPurchaseRecord[],
  peerTrades = [] as PeerTradeRecord[],
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

  // Stock Ledger Modal State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState<boolean>(false);
  const [selectedProductForLedger, setSelectedProductForLedger] = useState<Product | null>(null);

  const [masterCategories, setMasterCategories] = useState<string[]>([]);

  useEffect(() => {
    masterDataService.getMasterDataCategories('FINISHED_GOODS', true)
      .then((cats) => setMasterCategories(cats.map((c) => c.name)))
      .catch(console.error);
  }, [isCategoryModalOpen]);

  const categories = useMemo(() => {
    const set = new Set<string>(masterCategories.length > 0 ? masterCategories : getStoredProductCategories());
    (products || []).forEach((p) => {
      if (p && p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products, masterCategories, isCategoryModalOpen]);

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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleExportAllLedgerSummary = () => {
    const summaries = calculateAllProductsStockLedgerSummaries(
      products || [],
      transactions || [],
      sales || [],
      stockAdjustments || [],
      merchantPurchases || [],
      peerTrades || []
    );
    exportAllProductsStockLedgerSummaryCSV(summaries);
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
                ကုန်ချော၊ ဝါးထည်၊ ကြိမ်ထည်ပစ္စည်းများ ဝယ်စျေးနှင့် ရောင်းစျေး စီမံခြင်း
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
            onClick={handleExportAllLedgerSummary}
            className="px-3 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded-lg border border-emerald-700/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            title="ပစ္စည်းအားလုံး၏ စာရင်းစာအုပ် အနှစ်ချုပ် (All Products Stock Ledger Summary CSV) ထုတ်ယူမည်"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Ledger အနှစ်ချုပ် CSV</span>
          </button>
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
                    onClick={() => {
                      setSelectedProductForLedger(product);
                      setIsLedgerModalOpen(true);
                    }}
                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                    title="Stock Ledger (စာရင်းစာအုပ်) ကြည့်မည်"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(product)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    title="ကုန်ပစ္စည်း အချက်အလက် ပြင်ဆင်မည်"
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
                      title="ပစ္စည်း ဖျက်မည်"
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

      {/* Canonical Product Master Modal for Add/Edit */}
      <ProductMasterModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        initialProduct={editingProduct}
        onSave={(savedProd) => {
          if (editingProduct) {
            onUpdateProduct(savedProd);
          } else {
            onAddProduct(savedProd);
          }
        }}
        availableCategories={categories}
      />

      {/* Professional Auditable Stock Movement Ledger Modal */}
      <ProductStockLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => {
          setIsLedgerModalOpen(false);
          setSelectedProductForLedger(null);
        }}
        product={selectedProductForLedger}
        transactions={transactions}
        sales={sales}
        stockAdjustments={stockAdjustments}
        merchantPurchases={merchantPurchases}
        peerTrades={peerTrades}
      />

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
