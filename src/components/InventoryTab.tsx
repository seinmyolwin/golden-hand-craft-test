import React, { useState, useMemo } from 'react';
import { Product, TransactionRecord, SaleRecord, StockAdjustmentRecord, PeerTradeRecord } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  computeAllProductsStock,
  ProductStockStats,
  exportInventoryCSV,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/storage';
import {
  Layers,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Search,
  Plus,
  SlidersHorizontal,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  History,
  TrendingUp,
} from 'lucide-react';

interface InventoryTabProps {
  products: Product[];
  transactions: TransactionRecord[];
  sales: SaleRecord[];
  stockAdjustments: StockAdjustmentRecord[];
  peerTrades?: PeerTradeRecord[];
  onUpdateProduct?: (product: Product) => void;
  onAddProduct?: (product: Product) => void;
  onAddStockAdjustment?: (adjustment: StockAdjustmentRecord) => void;
  onSaveAdjustment?: (adjustment: StockAdjustmentRecord) => void;
  onOpenNewSale?: () => void;
  onOpenNewSupplierCollection?: () => void;
}

export type MaterialSectionType = 'ALL' | 'FINISHED' | 'BAMBOO' | 'RATTAN';

export const getProductMaterialType = (product: { name: string; category?: string }): 'FINISHED' | 'BAMBOO' | 'RATTAN' => {
  const name = (product.name || '').toLowerCase();
  const cat = (product.category || '').toLowerCase();
  if (name.includes('ဝါး') || (!cat.includes('ယွန်း') && cat.includes('ဝါး'))) return 'BAMBOO';
  if (name.includes('ကြိမ်') || (!cat.includes('ယွန်း') && cat.includes('ကြိမ်'))) return 'RATTAN';
  return 'FINISHED';
};

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products = [],
  transactions = [],
  sales = [],
  stockAdjustments = [],
  peerTrades = [],
  onUpdateProduct,
  onAddProduct,
  onAddStockAdjustment,
  onSaveAdjustment,
  onOpenNewSale,
  onOpenNewSupplierCollection,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMaterialGroup, setSelectedMaterialGroup] = useState<MaterialSectionType>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'IN_ADJUSTMENT' | 'OUT_ADJUSTMENT' | 'DAMAGE'>('IN_ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState<string>('');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState<boolean>(false);
  const [newProdName, setNewProdName] = useState<string>('');
  const [newBuyPrice, setNewBuyPrice] = useState<number>(0);
  const [newSellPrice, setNewSellPrice] = useState<number>(0);
  const [newUnit, setNewUnit] = useState<string>('ထည်');
  const [newCategory, setNewCategory] = useState<string>('ယွန်းထည်');
  const [newOpeningStock, setNewOpeningStock] = useState<number>(0);

  const allStockStats: ProductStockStats[] = useMemo(() => {
    return computeAllProductsStock(products || [], transactions || [], sales || [], stockAdjustments || [], [], [], peerTrades || []);
  }, [products, transactions, sales, stockAdjustments, peerTrades]);

  const summaryMetrics = useMemo(() => {
    let totalItemsStock = 0;
    let totalProcurementValue = 0;
    let totalPotentialSalesValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInflowQty = 0;
    let totalOutflowQty = 0;

    (allStockStats || []).forEach((stat) => {
      if (!stat) return;
      totalItemsStock += stat.currentStock || 0;
      totalProcurementValue += stat.procurementValue || 0;
      totalPotentialSalesValue += stat.potentialSalesValue || 0;
      totalInflowQty += stat.totalInflow || 0;
      totalOutflowQty += stat.totalOutflow || 0;
      if (stat.status === 'OUT_OF_STOCK') outOfStockCount++;
      if (stat.status === 'LOW_STOCK') lowStockCount++;
    });

    return {
      totalItemsStock,
      totalProcurementValue,
      totalPotentialSalesValue,
      lowStockCount,
      outOfStockCount,
      totalInflowQty,
      totalOutflowQty,
    };
  }, [allStockStats]);

  const groupCalculations = useMemo(() => {
    let finishedCapital = 0;
    let finishedUnits = 0;
    const finishedItems: ProductStockStats[] = [];

    let bambooCapital = 0;
    let bambooUnits = 0;
    const bambooItems: ProductStockStats[] = [];

    let rattanCapital = 0;
    let rattanUnits = 0;
    const rattanItems: ProductStockStats[] = [];

    (allStockStats || []).forEach((stat) => {
      if (!stat) return;
      const type = getProductMaterialType(stat.product);
      if (type === 'BAMBOO') {
        bambooCapital += stat.procurementValue || 0;
        bambooUnits += stat.currentStock || 0;
        bambooItems.push(stat);
      } else if (type === 'RATTAN') {
        rattanCapital += stat.procurementValue || 0;
        rattanUnits += stat.currentStock || 0;
        rattanItems.push(stat);
      } else {
        finishedCapital += stat.procurementValue || 0;
        finishedUnits += stat.currentStock || 0;
        finishedItems.push(stat);
      }
    });

    return {
      finished: {
        type: 'FINISHED' as const,
        label: 'ယွန်းထည်ပစ္စည်းများ',
        subLabel: 'ကွမ်းအစ်၊ ဆွမ်းအုပ်၊ ပန်းကန် စသည်',
        itemsCount: finishedItems.length,
        units: finishedUnits,
        capital: finishedCapital,
        items: finishedItems,
      },
      bamboo: {
        type: 'BAMBOO' as const,
        label: 'ဝါးထည်နှင့် ဝါးကုန်ကြမ်း',
        subLabel: 'ခမောက်၊ ဗန်း၊ နှီးလိပ်၊ ဝါးပိုးဝါး',
        itemsCount: bambooItems.length,
        units: bambooUnits,
        capital: bambooCapital,
        items: bambooItems,
      },
      rattan: {
        type: 'RATTAN' as const,
        label: 'ကြိမ်ထည်နှင့် ကြိမ်ကုန်ကြမ်း',
        subLabel: 'ကြိမ်တောင်း၊ ကြိမ်ဗန်း၊ ကြိမ်လုံးစည်း',
        itemsCount: rattanItems.length,
        units: rattanUnits,
        capital: rattanCapital,
        items: rattanItems,
      },
    };
  }, [allStockStats]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (products || []).forEach((p) => {
      if (p && p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredStock = useMemo(() => {
    return allStockStats.filter((stat) => {
      const matType = getProductMaterialType(stat.product);
      const matchesGroup = selectedMaterialGroup === 'ALL' || matType === selectedMaterialGroup;
      const matchesSearch =
        stat.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stat.product.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || stat.product.category === selectedCategory;
      let matchesStatus = true;
      if (statusFilter === 'in_stock') matchesStatus = stat.status === 'IN_STOCK';
      if (statusFilter === 'low_stock') matchesStatus = stat.status === 'LOW_STOCK';
      if (statusFilter === 'out_of_stock') matchesStatus = stat.status === 'OUT_OF_STOCK';
      return matchesGroup && matchesSearch && matchesCat && matchesStatus;
    });
  }, [allStockStats, selectedMaterialGroup, searchQuery, selectedCategory, statusFilter]);

  const handlePerformAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust || adjustQty <= 0) return;

    const currentStat = allStockStats.find((s) => s.product.id === selectedProductForAdjust.id);
    const prevStock = currentStat ? currentStat.currentStock : (selectedProductForAdjust.openingStock || 0);
    const delta = adjustType === 'IN_ADJUSTMENT' ? adjustQty : -adjustQty;
    const newStock = prevStock + delta;

    const defaultReason =
      adjustType === 'DAMAGE'
        ? 'ပျက်စီးစာရင်းထုတ်'
        : adjustType === 'IN_ADJUSTMENT'
        ? 'လက်ကျန်စာရင်းတိုး'
        : 'လက်ကျန်စာရင်းလျှော့';

    const adjRecord: StockAdjustmentRecord = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      productId: selectedProductForAdjust.id,
      productName: selectedProductForAdjust.name,
      type: adjustType,
      quantity: delta,
      previousStock: prevStock,
      newStock,
      reason: adjustReason.trim() || defaultReason,
      createdAt: new Date().toISOString(),
    };

    if (onAddStockAdjustment) {
      onAddStockAdjustment(adjRecord);
    } else if (onSaveAdjustment) {
      onSaveAdjustment(adjRecord);
    }

    setIsAdjustModalOpen(false);
    setSelectedProductForAdjust(null);
    setAdjustQty(0);
    setAdjustReason('');
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    const createdProd: Product = {
      id: `p-${Date.now()}`,
      name: newProdName.trim(),
      defaultPrice: newBuyPrice || 0,
      defaultWholesalePrice: newSellPrice || Math.round((newBuyPrice || 0) * 1.25),
      unit: newUnit.trim() || 'ထည်',
      category: newCategory.trim() || 'ယွန်းထည်',
      openingStock: newOpeningStock || 0,
      currentStock: newOpeningStock || 0,
      minStockAlert: 15,
      active: true,
    };

    if (onAddProduct) {
      onAddProduct(createdProd);
    }
    setIsAddProductModalOpen(false);
    setNewProdName('');
    setNewBuyPrice(0);
    setNewSellPrice(0);
    setNewOpeningStock(0);
  };

  const productMovementHistory = useMemo(() => {
    if (!selectedProductForHistory) return [];
    const pId = selectedProductForHistory.id;
    const events: {
      id: string;
      date: string;
      time: string;
      type: 'IN' | 'OUT' | 'ADJUST';
      partyName: string;
      quantity: number;
      price: number;
      unit: string;
      note?: string;
    }[] = [];

    (transactions || []).forEach((tx) => {
      if (!tx) return;
      (tx.items || []).forEach((item) => {
        if (item && item.productId === pId) {
          events.push({
            id: `${tx.id}-${item.productId}`,
            date: tx.date,
            time: tx.time,
            type: 'IN',
            partyName: `${tx.supplierName} (ကုန်သိမ်း)`,
            quantity: item.quantity,
            price: item.unitPrice,
            unit: item.unit,
            note: tx.voucherNo,
          });
        }
      });
    });

    (sales || []).forEach((s) => {
      if (!s) return;
      (s.items || []).forEach((item) => {
        if (item && item.productId === pId) {
          events.push({
            id: `${s.id}-${item.productId}`,
            date: s.date,
            time: s.time,
            type: 'OUT',
            partyName: `${s.merchantName} (${s.merchantTown}) အရောင်း`,
            quantity: item.quantity,
            price: item.unitPrice,
            unit: item.unit,
            note: s.voucherNo,
          });
        }
      });
    });

    (stockAdjustments || []).forEach((adj) => {
      if (adj && adj.productId === pId) {
        events.push({
          id: adj.id,
          date: adj.date,
          time: adj.time,
          type: 'ADJUST',
          partyName: 'လက်ကျန်ပြင်ဆင်မှု',
          quantity: adj.quantity,
          price: 0,
          unit: selectedProductForHistory.unit,
          note: adj.reason,
        });
      }
    });

    return events.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [selectedProductForHistory, transactions, sales, stockAdjustments]);

  const renderProductCard = (stat: ProductStockStats) => {
    const isLow = stat.status === 'LOW_STOCK';
    const isOut = stat.status === 'OUT_OF_STOCK';
    const matType = getProductMaterialType(stat.product);

    return (
      <div
        key={stat.product.id}
        className={`bg-white rounded-xl border p-3.5 shadow-2xs flex flex-col justify-between transition-all hover:border-emerald-300 ${
          isOut
            ? 'border-rose-300 bg-rose-50/30'
            : isLow
            ? 'border-amber-300 bg-amber-50/20'
            : 'border-slate-200'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
                {stat.product.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium inline-block">
                  {stat.product.category}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    matType === 'FINISHED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : matType === 'BAMBOO'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {matType === 'FINISHED' ? 'ယွန်းထည်' : matType === 'BAMBOO' ? 'ဝါး' : 'ကြိမ်'}
                </span>
              </div>
            </div>
            <div>
              {isOut ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  <XCircle className="w-3 h-3" />
                  ပြတ်
                </span>
              ) : isLow ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <AlertTriangle className="w-3 h-3" />
                  နည်း
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  ရှိ
                </span>
              )}
            </div>
          </div>

          <div className="my-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 block">လက်ရှိလက်ကျန်</span>
              <span className={`text-xl font-extrabold ${isOut ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-emerald-800'}`}>
                {formatNumberOnly(stat.currentStock)}{' '}
                <span className="text-xs font-medium text-slate-600">{stat.product.unit}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">အရင်းတန်ဖိုး</span>
              <span className="text-xs font-bold text-slate-800">
                {formatMMK(stat.procurementValue)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 bg-slate-100/70 rounded text-[11px] text-slate-600 mb-2">
            <div className="text-center">
              <span className="block text-[10px] text-slate-400">အစ</span>
              <span className="font-semibold text-slate-700">{stat.openingStock}</span>
            </div>
            <div className="text-center border-x border-slate-200">
              <span className="block text-[10px] text-emerald-600">အဝင် (+)</span>
              <span className="font-bold text-emerald-800">+{stat.totalInflow}</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-blue-600">အရောင်း (-)</span>
              <span className="font-bold text-blue-800">-{stat.totalOutflow}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 px-1 py-1">
            <div>
              <span className="text-[10px] text-slate-400 block">ဝယ်စျေး:</span>
              <span className="font-bold text-slate-800">{formatMMK(stat.product.defaultPrice)}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">လက္ကားရောင်းစျေး:</span>
              <span className="font-bold text-blue-700">
                {formatMMK(stat.product.defaultWholesalePrice || Math.round(stat.product.defaultPrice * 1.25))}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedProductForHistory(stat.product);
              setIsHistoryModalOpen(true);
            }}
            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>အဝင်/အထွက်</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedProductForAdjust(stat.product);
              setIsAdjustModalOpen(true);
            }}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span>လက်ကျန်ညှိ</span>
          </button>
        </div>
      </div>
    );
  };

  const finishedFilteredItems = filteredStock.filter((s) => getProductMaterialType(s.product) === 'FINISHED');
  const bambooFilteredItems = filteredStock.filter((s) => getProductMaterialType(s.product) === 'BAMBOO');
  const rattanFilteredItems = filteredStock.filter((s) => getProductMaterialType(s.product) === 'RATTAN');

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ကုန်ပစ္စည်းလက်ကျန် စီမံခန့်ခွဲမှု
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  {products.length} မျိုး
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                ကုန်ပစ္စည်းပေးသွင်းသူအဝင်၊ ကုန်သည်အရောင်းနှင့် အချိန်နှင့်တစ်ပြေးညီ လက်ကျန်စစ်ဆေးခြင်း
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewSupplierCollection}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
            title="ကုန်သိမ်းအသစ် ရေးသွင်းမည်"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            <span>+ ကုန်သိမ်း</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewSale}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
            title="အရောင်းအသစ် ရေးသွင်းမည်"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>+ အရောင်း</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddProductModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>ပစ္စည်းသစ်ထည့်</span>
          </button>
          <button
            type="button"
            onClick={() => exportInventoryCSV(allStockStats)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer transition-colors"
            title="Excel/CSV ထုတ်ယူမည်"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Capital Breakdown & Material Segment Cards */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-850 text-white rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-700/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/80 border border-emerald-600/40 px-2.5 py-0.5 rounded-full">
                လက်ကျန်အရင်းတန်ဖိုး (Total Capital)
              </span>
              {selectedMaterialGroup !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedMaterialGroup('ALL')}
                  className="text-xs text-amber-300 hover:text-white underline cursor-pointer"
                >
                  (အားလုံးကြည့်မည်)
                </button>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 flex items-baseline gap-2 flex-wrap">
              <span>{formatMMK(summaryMetrics.totalProcurementValue)}</span>
              <span className="text-xs sm:text-sm font-normal text-slate-300">
                (ပစ္စည်း {allStockStats.length} မျိုး၊ စုစုပေါင်း {formatNumberOnly(summaryMetrics.totalItemsStock)} ထည်)
              </span>
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-3 bg-slate-800/90 rounded-xl border border-slate-700 shrink-0">
            <span className="text-[11px] text-slate-400">လက္ကားရောင်းရငွေ ခန့်မှန်း</span>
            <span className="text-base sm:text-lg font-bold text-blue-300">
              {formatMMK(summaryMetrics.totalPotentialSalesValue)}
            </span>
          </div>
        </div>

        {/* 3 Interactive Material Category Cards */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Finished Goods Card */}
            <button
              type="button"
              onClick={() => setSelectedMaterialGroup(selectedMaterialGroup === 'FINISHED' ? 'ALL' : 'FINISHED')}
              className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden group ${
                selectedMaterialGroup === 'FINISHED'
                  ? 'bg-emerald-950/90 border-emerald-400 ring-2 ring-emerald-500/50 shadow-md'
                  : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    {groupCalculations.finished.label}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {groupCalculations.finished.subLabel}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold shrink-0 bg-slate-700 text-slate-300">
                  {groupCalculations.finished.itemsCount} မျိုး
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 block font-medium">အရင်းတန်ဖိုး</span>
                  <span className="text-lg sm:text-xl font-black text-white">
                    {formatMMK(groupCalculations.finished.capital)}
                  </span>
                </div>
              </div>
            </button>

            {/* Bamboo Raw Material Card */}
            <button
              type="button"
              onClick={() => setSelectedMaterialGroup(selectedMaterialGroup === 'BAMBOO' ? 'ALL' : 'BAMBOO')}
              className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden group ${
                selectedMaterialGroup === 'BAMBOO'
                  ? 'bg-green-950/90 border-green-400 ring-2 ring-green-500/50 shadow-md'
                  : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <span className="text-xs font-bold text-green-300 flex items-center gap-1.5">
                    {groupCalculations.bamboo.label}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {groupCalculations.bamboo.subLabel}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold shrink-0 bg-slate-700 text-slate-300">
                  {groupCalculations.bamboo.itemsCount} မျိုး
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-green-400 block font-medium">အရင်းတန်ဖိုး</span>
                  <span className="text-lg sm:text-xl font-black text-white">
                    {formatMMK(groupCalculations.bamboo.capital)}
                  </span>
                </div>
              </div>
            </button>

            {/* Rattan Raw Material Card */}
            <button
              type="button"
              onClick={() => setSelectedMaterialGroup(selectedMaterialGroup === 'RATTAN' ? 'ALL' : 'RATTAN')}
              className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden group ${
                selectedMaterialGroup === 'RATTAN'
                  ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-500/50 shadow-md'
                  : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    {groupCalculations.rattan.label}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {groupCalculations.rattan.subLabel}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold shrink-0 bg-slate-700 text-slate-300">
                  {groupCalculations.rattan.itemsCount} မျိုး
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 block font-medium">အရင်းတန်ဖိုး</span>
                  <span className="text-lg sm:text-xl font-black text-white">
                    {formatMMK(groupCalculations.rattan.capital)}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedMaterialGroup('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMaterialGroup === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            အားလုံး ({allStockStats.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedMaterialGroup('FINISHED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMaterialGroup === 'FINISHED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ယွန်းထည် ({groupCalculations.finished.itemsCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedMaterialGroup('BAMBOO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMaterialGroup === 'BAMBOO'
                ? 'bg-green-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ဝါးထည် ({groupCalculations.bamboo.itemsCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedMaterialGroup('RATTAN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMaterialGroup === 'RATTAN'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ကြိမ်ထည် ({groupCalculations.rattan.itemsCount})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ပစ္စည်းအမည် / အမျိုးအစားဖြင့် ရှာမည်..."
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
              အားလုံး
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
          </div>
        </div>
      </div>

      {/* Categorized Stock Presentation */}
      {filteredStock.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">ရှာဖွေမှုနှင့် ကိုက်ညီသော ကုန်ပစ္စည်းမရှိပါ</h3>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedMaterialGroup('ALL');
              setStatusFilter('all');
            }}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            စစ်ထုတ်မှု ပြန်လည်ရှင်းထုတ်မည်
          </button>
        </div>
      ) : selectedMaterialGroup === 'ALL' ? (
        <div className="space-y-6">
          {finishedFilteredItems.length > 0 && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-white p-3 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {groupCalculations.finished.label} ({finishedFilteredItems.length} မျိုး)
                </h3>
                <span className="text-xs sm:text-sm font-black text-emerald-900">
                  {formatMMK(groupCalculations.finished.capital)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {finishedFilteredItems.map((stat) => renderProductCard(stat))}
              </div>
            </div>
          )}

          {bambooFilteredItems.length > 0 && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-green-50 via-slate-50 to-white p-3 rounded-xl border border-green-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {groupCalculations.bamboo.label} ({bambooFilteredItems.length} မျိုး)
                </h3>
                <span className="text-xs sm:text-sm font-black text-green-900">
                  {formatMMK(groupCalculations.bamboo.capital)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bambooFilteredItems.map((stat) => renderProductCard(stat))}
              </div>
            </div>
          )}

          {rattanFilteredItems.length > 0 && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-amber-50 via-slate-50 to-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {groupCalculations.rattan.label} ({rattanFilteredItems.length} မျိုး)
                </h3>
                <span className="text-xs sm:text-sm font-black text-amber-900">
                  {formatMMK(groupCalculations.rattan.capital)}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rattanFilteredItems.map((stat) => renderProductCard(stat))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStock.map((stat) => renderProductCard(stat))}
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedProductForAdjust && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">လက်ကျန် စာရင်းညှိမည်</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePerformAdjustment} className="p-4 space-y-3.5 text-xs flex-1 overflow-y-auto overscroll-contain">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">ကုန်ပစ္စည်း</span>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {selectedProductForAdjust.name} ({selectedProductForAdjust.unit})
                </div>
                <span className="text-xs text-emerald-700 font-semibold">
                  လက်ရှိလက်ကျန်: {allStockStats.find((s) => s.product.id === selectedProductForAdjust.id)?.currentStock || 0} {selectedProductForAdjust.unit}
                </span>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">ညှိနှိုင်းမှုပုံစံ</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('IN_ADJUSTMENT')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                      adjustType === 'IN_ADJUSTMENT'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    + အဝင်တိုး
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('OUT_ADJUSTMENT')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                      adjustType === 'OUT_ADJUSTMENT'
                        ? 'bg-blue-50 text-blue-800 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    - အထွက်လျှော့
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DAMAGE')}
                    className={`py-2 px-2 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                      adjustType === 'DAMAGE'
                        ? 'bg-rose-50 text-rose-800 border-rose-500 ring-1 ring-rose-500'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    ပျက်စီး
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">အရေအတွက် ({selectedProductForAdjust.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="အရေအတွက် - 10"
                  value={adjustQty === 0 ? '' : adjustQty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setAdjustQty(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">အကြောင်းပြချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ကုန်ပစ္စည်း ပျက်စီးသွားသဖြင့် စာရင်းမှထုတ်ခြင်း"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  အတည်ပြုမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">ကုန်ပစ္စည်း အသစ်ထည့်သွင်းခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်ပစ္စည်းအမည် *</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ယွန်း ကွမ်းအစ် (အကြီး)"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">အမျိုးအစား</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ယွန်းထည်">ယွန်းထည်</option>
                    <option value="ဝါးထည်">ဝါးထည်</option>
                    <option value="ကြိမ်ထည်">ကြိမ်ထည်</option>
                    <option value="ကုန်ကြမ်း (ဝါး)">ကုန်ကြမ်း (ဝါး)</option>
                    <option value="ကုန်ကြမ်း (ကြိမ်)">ကုန်ကြမ်း (ကြိမ်)</option>
                    <option value="အခြား">အခြား</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ရေတွက်ပုံ (ယူနစ်)</label>
                  <input
                    type="text"
                    placeholder="ထည် / လုံး / ချပ်"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ဝယ်စျေး / ကုန်ကျစရိတ် (ကျပ်)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newBuyPrice === 0 ? '' : newBuyPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewBuyPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ရောင်းစျေး / လက်ကားစျေး (ကျပ်)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newSellPrice === 0 ? '' : newSellPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewSellPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">စတင်လက်ကျန် အရေအတွက် (Opening Stock)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newOpeningStock === 0 ? '' : newOpeningStock}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewOpeningStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">မရှိသေးပါက သုည (၀) ထားရှိနိုင်ပါသည်</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>သိမ်းဆည်းမည်</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
