import React, { useState, useMemo } from 'react';
import {
  Product,
  TransactionRecord,
  SaleRecord,
  StockAdjustmentRecord,
  PeerTradeRecord,
  MerchantPurchaseRecord,
  RawMaterialPreset,
  RawMaterialStockStat,
  CategoryDomain,
} from '../types';
import {
  computeAllProductsStock,
  computeRawMaterialsStock,
  ProductStockStats,
  exportInventoryCSV,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/storage';
import { formatMMK, formatNumberOnly } from '../utils/currency';
import { generateStableId } from '../utils/idGenerator';
import {
  calculateAllProductsStockLedgerSummaries,
  exportAllProductsStockLedgerSummaryCSV,
} from '../services/stockLedgerService';
import { ProductStockLedgerModal } from './ProductStockLedgerModal';
import { ProductMasterModal } from './master/ProductMasterModal';
import { CategoryManageModal } from './CategoryManageModal';
import { NumericInput, getNotePlaceholder } from './NumericInput';
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
  FileSpreadsheet,
  Boxes,
  Tag,
} from 'lucide-react';

interface InventoryTabProps {
  products: Product[];
  transactions: TransactionRecord[];
  sales: SaleRecord[];
  stockAdjustments: StockAdjustmentRecord[];
  peerTrades?: PeerTradeRecord[];
  merchantPurchases?: MerchantPurchaseRecord[];
  rawMaterialPresets?: RawMaterialPreset[];
  onUpdateProduct?: (product: Product) => void;
  onAddProduct?: (product: Product) => void;
  onAddStockAdjustment?: (adjustment: StockAdjustmentRecord) => void;
  onSaveAdjustment?: (adjustment: StockAdjustmentRecord) => void;
  onOpenNewSale?: () => void;
  onOpenNewSupplierCollection?: () => void;
}

export type MaterialSectionType = 'ALL' | 'FINISHED' | 'RAW_MATERIALS';

export const getProductMaterialType = (product: { name: string; category?: string }): 'FINISHED' => {
  return 'FINISHED';
};

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products = [],
  transactions = [],
  sales = [],
  stockAdjustments = [],
  peerTrades = [],
  merchantPurchases = [],
  rawMaterialPresets = [],
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
  const [isCategoryManageModalOpen, setIsCategoryManageModalOpen] = useState<boolean>(false);
  const [categoryModalDomain, setCategoryModalDomain] = useState<CategoryDomain>('FINISHED_GOODS');

  const allStockStats: ProductStockStats[] = useMemo(() => {
    return computeAllProductsStock(
      products || [],
      transactions || [],
      sales || [],
      stockAdjustments || [],
      [],
      peerTrades || []
    );
  }, [products, transactions, sales, stockAdjustments, peerTrades]);

  // Compute Raw Material Stock from Inflows and Outflows
  const rawMaterialStocks: RawMaterialStockStat[] = useMemo(() => {
    return computeRawMaterialsStock(
      rawMaterialPresets || [],
      merchantPurchases || [],
      transactions || [],
      sales || [],
      stockAdjustments || []
    );
  }, [rawMaterialPresets, merchantPurchases, transactions, sales, stockAdjustments]);

  const rawMaterialsTotalValuation = useMemo(() => {
    return rawMaterialStocks.reduce((sum, s) => sum + (s.estimatedValuation || 0), 0);
  }, [rawMaterialStocks]);

  const rawMaterialsTotalUnits = useMemo(() => {
    return rawMaterialStocks.reduce((sum, s) => sum + (s.currentStock || 0), 0);
  }, [rawMaterialStocks]);

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

    (allStockStats || []).forEach((stat) => {
      if (!stat) return;
      finishedCapital += stat.procurementValue || 0;
      finishedUnits += stat.currentStock || 0;
      finishedItems.push(stat);
    });

    return {
      finished: {
        type: 'FINISHED' as const,
        label: 'ကုန်ချောပစ္စည်းများ',
        subLabel: 'ယွန်း၊ ဝါးထည်၊ ကြိမ်ထည်၊ ပန်းပု စသည့် ထုတ်လုပ်ပြီး ပစ္စည်းများ',
        itemsCount: finishedItems.length,
        units: finishedUnits,
        capital: finishedCapital,
        items: finishedItems,
      },
      rawMaterials: {
        type: 'RAW_MATERIALS' as const,
        label: 'ကုန်ကြမ်းပစ္စည်းများ',
        subLabel: 'ဝါး၊ ကြိမ်၊ ကော်၊ ဆေး သိုလှောင်ကုန်ကြမ်းများ',
        itemsCount: rawMaterialStocks.length,
        units: rawMaterialsTotalUnits,
        capital: rawMaterialsTotalValuation,
        items: rawMaterialStocks,
      },
    };
  }, [allStockStats, rawMaterialStocks, rawMaterialsTotalUnits, rawMaterialsTotalValuation]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (products || []).forEach((p) => {
      if (p && p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredRawMaterials = useMemo(() => {
    return rawMaterialStocks.filter((stat) => {
      const matchesSearch =
        stat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (stat.categoryLabel || '').toLowerCase().includes(searchQuery.toLowerCase());
      let matchesStatus = true;
      if (statusFilter === 'in_stock') matchesStatus = stat.status === 'IN_STOCK';
      if (statusFilter === 'low_stock') matchesStatus = stat.status === 'LOW_STOCK';
      if (statusFilter === 'out_of_stock') matchesStatus = stat.status === 'OUT_OF_STOCK';
      return matchesSearch && matchesStatus;
    });
  }, [rawMaterialStocks, searchQuery, statusFilter]);

  const filteredStock = useMemo(() => {
    return allStockStats.filter((stat) => {
      const matchesGroup = selectedMaterialGroup === 'ALL' || selectedMaterialGroup === 'FINISHED';
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
      id: generateStableId('adj'),
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
                  {matType === 'FINISHED' ? 'ကုန်ချော' : matType === 'BAMBOO' ? 'ဝါး' : 'ကြိမ်'}
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

  const renderRawMaterialCard = (stat: RawMaterialStockStat) => {
    const isLow = stat.status === 'LOW_STOCK';
    const isOut = stat.status === 'OUT_OF_STOCK';

    return (
      <div
        key={stat.id}
        className={`bg-white rounded-xl border p-4 shadow-2xs transition-all hover:shadow-xs flex flex-col justify-between ${
          isOut
            ? 'border-rose-300 bg-rose-50/20'
            : isLow
            ? 'border-amber-300 bg-amber-50/20'
            : 'border-slate-200'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                {stat.categoryLabel || 'ကုန်ကြမ်း'}
              </span>
              <h4 className="font-bold text-slate-850 text-sm mt-1.5 line-clamp-1">{stat.name}</h4>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                isOut
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : isLow
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isOut ? 'ကုန်နေပါသည်' : isLow ? 'လက်ကျန်နည်း' : 'လက်ကျန်ရှိ'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">ဝယ်ယူရရှိမှု (+):</span>
              <span className="font-bold text-slate-700">
                {formatNumberOnly(stat.totalInflow)} {stat.defaultUnit}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">ထုတ်ပေး/ရောင်းချ (-):</span>
              <span className="font-bold text-slate-700">
                {formatNumberOnly(stat.totalOutflow)} {stat.defaultUnit}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">လက်ကျန် (Stock)</span>
            <span
              className={`text-lg font-black ${
                isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {formatNumberOnly(stat.currentStock)}{' '}
              <span className="text-xs font-normal text-slate-500">{stat.defaultUnit}</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-medium">ခန့်မှန်းတန်ဖိုး</span>
            <span className="text-sm font-bold text-emerald-700">
              {formatMMK(stat.estimatedValuation)}
            </span>
          </div>
        </div>
      </div>
    );
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => exportInventoryCSV(allStockStats)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer transition-colors"
              title="လက်ကျန်စာရင်း (Inventory CSV) ထုတ်ယူမည်"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExportAllLedgerSummary}
              className="px-2.5 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded-lg border border-emerald-700/60 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="ပစ္စည်းအားလုံး၏ စာရင်းစာအုပ် အနှစ်ချုပ် (All Products Stock Ledger Summary CSV) ထုတ်ယူမည်"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Ledger အနှစ်ချုပ်</span>
            </button>
          </div>
        </div>
      </div>

      {/* Capital Breakdown & Material Segment Cards */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-850 text-white rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-700/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/80 border border-emerald-600/40 px-2.5 py-0.5 rounded-full">
                လက်ကျန်အရင်းတန်ဖိုး စုစုပေါင်း (Total Capital)
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
              <span>{formatMMK(summaryMetrics.totalProcurementValue + rawMaterialsTotalValuation)}</span>
              <span className="text-xs sm:text-sm font-normal text-slate-300">
                (ကုန်ချော {formatMMK(summaryMetrics.totalProcurementValue)} + ကုန်ကြမ်း {formatMMK(rawMaterialsTotalValuation)})
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

        {/* 2 Interactive Material Category Cards */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Finished Goods Card */}
            <button
              type="button"
              onClick={() => setSelectedMaterialGroup(selectedMaterialGroup === 'FINISHED' ? 'ALL' : 'FINISHED')}
              className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden group ${
                selectedMaterialGroup === 'FINISHED'
                  ? 'bg-emerald-950/90 border-emerald-400 ring-2 ring-emerald-500/50 shadow-md'
                  : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <span className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>{groupCalculations.finished.label}</span>
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {groupCalculations.finished.subLabel}
                  </span>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 bg-slate-700 text-slate-200">
                  {groupCalculations.finished.itemsCount} မျိုး
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-700/60">
                <div>
                  <span className="text-[10px] text-emerald-400 block font-medium">လက်ကျန် အရင်းတန်ဖိုး</span>
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {formatMMK(groupCalculations.finished.capital)}
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-300 hover:underline">
                  {selectedMaterialGroup === 'FINISHED' ? '✓ ရွေးချယ်ထားသည်' : 'ကြည့်ရှုရန် နှိပ်ပါ →'}
                </span>
              </div>
            </button>

            {/* Raw Material Inventory Card */}
            <button
              type="button"
              onClick={() => setSelectedMaterialGroup(selectedMaterialGroup === 'RAW_MATERIALS' ? 'ALL' : 'RAW_MATERIALS')}
              className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden group ${
                selectedMaterialGroup === 'RAW_MATERIALS'
                  ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-500/50 shadow-md'
                  : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-400" />
                    <span>{groupCalculations.rawMaterials.label}</span>
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {groupCalculations.rawMaterials.subLabel}
                  </span>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 bg-slate-700 text-slate-200">
                  {groupCalculations.rawMaterials.itemsCount} မျိုး
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-700/60">
                <div>
                  <span className="text-[10px] text-amber-400 block font-medium">သိုလှောင်မှု အရင်းတန်ဖိုး</span>
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {formatMMK(groupCalculations.rawMaterials.capital)}
                  </span>
                </div>
                <span className="text-xs font-semibold text-amber-300 hover:underline">
                  {selectedMaterialGroup === 'RAW_MATERIALS' ? '✓ ရွေးချယ်ထားသည်' : 'ကြည့်ရှုရန် နှိပ်ပါ →'}
                </span>
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMaterialGroup === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ပစ္စည်းအားလုံး ({allStockStats.length + rawMaterialStocks.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedMaterialGroup('FINISHED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMaterialGroup === 'FINISHED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ကုန်ချောပစ္စည်းများ ({groupCalculations.finished.itemsCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedMaterialGroup('RAW_MATERIALS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMaterialGroup === 'RAW_MATERIALS'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ကုန်ကြမ်းပစ္စည်းများ ({groupCalculations.rawMaterials.itemsCount})
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 flex-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              အမျိုးအစား အားလုံး
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
          <button
            type="button"
            onClick={() => {
              setCategoryModalDomain(selectedMaterialGroup === 'RAW_MATERIALS' ? 'RAW_MATERIAL' : 'FINISHED_GOODS');
              setIsCategoryManageModalOpen(true);
            }}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 shadow-2xs"
            title="ကုန်ချောနှင့် ကုန်ကြမ်း အုပ်စုခွဲ အမျိုးအစားများအား အသစ်ထည့်/ပြင်ဆင်မည်"
          >
            <Tag className="w-3.5 h-3.5 text-amber-700" />
            <span>အုပ်စုခွဲများ စီမံမည်</span>
          </button>
        </div>
        </div>
      </div>

      {/* Categorized Stock Presentation */}
      {filteredStock.length === 0 && filteredRawMaterials.length === 0 ? (
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
      ) : (
        <div className="space-y-6">
          {/* FINISHED GOODS SECTION */}
          {(selectedMaterialGroup === 'ALL' || selectedMaterialGroup === 'FINISHED') && filteredStock.length > 0 && (
            <div className="space-y-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      ကုန်ချောပစ္စည်းများ ({filteredStock.length} မျိုး)
                    </h3>
                    <p className="text-[11px] text-slate-500">ထုတ်လုပ်ပြီး အချောထည် အမျိုးအစားများအလိုက် စုစည်းထားပါသည်</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryModalDomain('FINISHED_GOODS');
                      setIsCategoryManageModalOpen(true);
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>ကုန်ချောအုပ်စုခွဲ ပြင်ရန်</span>
                  </button>
                  <span className="text-xs sm:text-sm font-black text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200">
                    စုစုပေါင်းတန်ဖိုး: {formatMMK(filteredStock.reduce((sum, s) => sum + (s.procurementValue || 0), 0))}
                  </span>
                </div>
              </div>

              {/* Group products by category under Finished Goods */}
              {Array.from(new Set(filteredStock.map((s) => s.product.category || 'အခြား'))).map((catName) => {
                const groupItems = filteredStock.filter((s) => (s.product.category || 'အခြား') === catName);
                const groupValuation = groupItems.reduce((sum, s) => sum + (s.procurementValue || 0), 0);
                return (
                  <div key={catName} className="space-y-2.5">
                    <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                          {catName}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                          {groupItems.length} မျိုး
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {formatMMK(groupValuation)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groupItems.map((stat) => renderProductCard(stat))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* RAW MATERIALS SECTION */}
          {(selectedMaterialGroup === 'ALL' || selectedMaterialGroup === 'RAW_MATERIALS') && filteredRawMaterials.length > 0 && (
            <div className="space-y-4 bg-amber-50/40 p-4 rounded-2xl border border-amber-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-amber-950">
                      ကုန်ကြမ်းပစ္စည်းများ ({filteredRawMaterials.length} မျိုး)
                    </h3>
                    <p className="text-[11px] text-amber-800/80">သိုလှောင်ထားသော ကုန်ကြမ်းအမျိုးအစားများအလိုက် စုစည်းထားပါသည်</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryModalDomain('RAW_MATERIAL');
                      setIsCategoryManageModalOpen(true);
                    }}
                    className="text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>ကုန်ကြမ်းအုပ်စုခွဲ ပြင်ရန်</span>
                  </button>
                  <span className="text-xs sm:text-sm font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                    စုစုပေါင်းတန်ဖိုး: {formatMMK(filteredRawMaterials.reduce((sum, s) => sum + (s.estimatedValuation || 0), 0))}
                  </span>
                </div>
              </div>

              {/* Group raw materials by categoryLabel */}
              {Array.from(new Set(filteredRawMaterials.map((s) => s.categoryLabel || 'ကုန်ကြမ်း'))).map((catName) => {
                const groupItems = filteredRawMaterials.filter((s) => (s.categoryLabel || 'ကုန်ကြမ်း') === catName);
                const groupValuation = groupItems.reduce((sum, s) => sum + (s.estimatedValuation || 0), 0);
                return (
                  <div key={catName} className="space-y-2.5">
                    <div className="bg-white px-3.5 py-2 rounded-xl border border-amber-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                          {catName}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                          {groupItems.length} မျိုး
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {formatMMK(groupValuation)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groupItems.map((stat) => renderRawMaterialCard(stat))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                <NumericInput
                  placeholder="အရေအတွက် - 10"
                  value={adjustQty === 0 ? '' : adjustQty}
                  onChangeValue={(val) => setAdjustQty(Math.max(0, val))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">အကြောင်းပြချက်</label>
                <input
                  type="text"
                  placeholder={getNotePlaceholder('STOCK_ADJUSTMENT')}
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

      {/* Category Management Modal */}
      <CategoryManageModal
        isOpen={isCategoryManageModalOpen}
        onClose={() => setIsCategoryManageModalOpen(false)}
        products={products}
        initialDomain={categoryModalDomain}
        onCategoriesChanged={() => {
          // Trigger re-render if needed
        }}
      />

      {/* Canonical Product Master Modal */}
      <ProductMasterModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSave={(newProd) => {
          if (onAddProduct) onAddProduct(newProd);
        }}
        availableCategories={Array.from(new Set(products.map((p) => p.category).filter(Boolean)))}
      />

      {/* Professional Auditable Stock Movement Ledger Modal */}
      <ProductStockLedgerModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedProductForHistory(null);
        }}
        product={selectedProductForHistory}
        transactions={transactions}
        sales={sales}
        stockAdjustments={stockAdjustments}
        merchantPurchases={merchantPurchases}
        peerTrades={peerTrades}
        onOpenStockAdjust={(prod) => {
          setSelectedProductForAdjust(prod);
          setIsAdjustModalOpen(true);
        }}
      />
    </div>
  );
};
