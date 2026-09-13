import React, { useState, useEffect, useMemo } from 'react';
import {
  SaleRecord,
  MerchantPurchaseRecord,
  Product,
  ReturnRecord,
  ReturnItem,
} from '../types';
import {
  processSalesReturnAtomic,
  processPurchaseReturnAtomic,
  cancelReturnAtomic,
  getReturnedQuantitiesForVoucher,
} from '../services/returnsService';
import { db } from '../db/database';
import { formatMMK, getTodayDateString } from '../utils/storage';
import {
  X,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Package,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Info,
  Calendar,
  User,
} from 'lucide-react';
import { NumericInput, getNotePlaceholder } from './NumericInput';

interface ReturnRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: SaleRecord[];
  merchantPurchases: MerchantPurchaseRecord[];
  products: Product[];
  initialSelectedSale?: SaleRecord | null;
  initialSelectedPurchase?: MerchantPurchaseRecord | null;
  onReturnSuccess?: () => void;
}

export const ReturnRefundModal: React.FC<ReturnRefundModalProps> = ({
  isOpen,
  onClose,
  sales = [],
  merchantPurchases = [],
  products: _products = [],
  initialSelectedSale = null,
  initialSelectedPurchase = null,
  onReturnSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'sales_return' | 'purchase_return' | 'history'>(
    initialSelectedPurchase ? 'purchase_return' : 'sales_return'
  );

  // Sales Return Form State
  const [selectedSaleVoucherNo, setSelectedSaleVoucherNo] = useState<string>('');
  const [saleSearch, setSaleSearch] = useState<string>('');
  const [saleReturnItems, setSaleReturnItems] = useState<{
    productId: string;
    productName: string;
    soldQty: number;
    alreadyReturnedQty: number;
    returnQty: number;
    unitPrice: number;
    unit: string;
  }[]>([]);
  const [saleCashRefund, setSaleCashRefund] = useState<string>('');
  const [saleReturnReason, setSaleReturnReason] = useState<string>('');

  // Purchase Return Form State
  const [selectedPurchaseNo, setSelectedPurchaseNo] = useState<string>('');
  const [purchaseSearch, setPurchaseSearch] = useState<string>('');
  const [purchaseReturnItems, setPurchaseReturnItems] = useState<{
    productId: string;
    productName: string;
    purchasedQty: number;
    alreadyReturnedQty: number;
    returnQty: number;
    unitPrice: number;
    unit: string;
  }[]>([]);
  const [purchaseCashRecovered, setPurchaseCashRecovered] = useState<string>('');
  const [purchaseReturnReason, setPurchaseReturnReason] = useState<string>('');

  // Return History State
  const [returnHistory, setReturnHistory] = useState<ReturnRecord[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Processing & Status State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync initial selections if provided
  useEffect(() => {
    if (initialSelectedSale) {
      setActiveTab('sales_return');
      setSelectedSaleVoucherNo(initialSelectedSale.voucherNo);
    } else if (initialSelectedPurchase) {
      setActiveTab('purchase_return');
      setSelectedPurchaseNo(initialSelectedPurchase.purchaseNo);
    }
  }, [initialSelectedSale, initialSelectedPurchase, isOpen]);

  // Load return history from database
  const loadHistory = async () => {
    try {
      if (db.returnsAndRefunds) {
        const records = await db.returnsAndRefunds.toArray();
        records.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        setReturnHistory(records);
      }
    } catch (e) {
      console.error('Failed to load return history', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  // Handle sale selection & compute returnable items
  const activeSale = useMemo(() => {
    return sales.find((s) => s.voucherNo === selectedSaleVoucherNo) || null;
  }, [sales, selectedSaleVoucherNo]);

  useEffect(() => {
    let isMounted = true;
    if (activeSale && activeSale.items) {
      getReturnedQuantitiesForVoucher(activeSale.id).then((returnedMap) => {
        if (!isMounted) return;
        const items = activeSale.items.map((it) => {
          const alreadyReturnedQty = returnedMap[it.productId] || 0;
          return {
            productId: it.productId,
            productName: it.productName,
            soldQty: it.quantity,
            alreadyReturnedQty,
            returnQty: 0,
            unitPrice: it.unitPrice,
            unit: it.unit || 'ခု',
          };
        });
        setSaleReturnItems(items);
      });
    } else {
      setSaleReturnItems([]);
    }
    return () => {
      isMounted = false;
    };
  }, [activeSale]);

  // Auto-calculate suggested sale cash refund
  const totalSaleReturnValue = useMemo(() => {
    return saleReturnItems.reduce((sum, item) => sum + item.returnQty * item.unitPrice, 0);
  }, [saleReturnItems]);

  useEffect(() => {
    setSaleCashRefund(totalSaleReturnValue > 0 ? String(totalSaleReturnValue) : '');
  }, [totalSaleReturnValue]);

  // Handle purchase selection & compute returnable items
  const activePurchase = useMemo(() => {
    return merchantPurchases.find((p) => p.purchaseNo === selectedPurchaseNo) || null;
  }, [merchantPurchases, selectedPurchaseNo]);

  useEffect(() => {
    let isMounted = true;
    if (activePurchase && activePurchase.items) {
      getReturnedQuantitiesForVoucher(activePurchase.id).then((returnedMap) => {
        if (!isMounted) return;
        const items = activePurchase.items.map((it) => {
          const alreadyReturnedQty = returnedMap[it.productId] || 0;
          return {
            productId: it.productId,
            productName: it.productName,
            purchasedQty: it.quantity,
            alreadyReturnedQty,
            returnQty: 0,
            unitPrice: it.unitPrice,
            unit: it.unit || 'ခု',
          };
        });
        setPurchaseReturnItems(items);
      });
    } else {
      setPurchaseReturnItems([]);
    }
    return () => {
      isMounted = false;
    };
  }, [activePurchase]);

  // Auto-calculate suggested purchase cash recovery
  const totalPurchaseReturnValue = useMemo(() => {
    return purchaseReturnItems.reduce((sum, item) => sum + item.returnQty * item.unitPrice, 0);
  }, [purchaseReturnItems]);

  useEffect(() => {
    setPurchaseCashRecovered(totalPurchaseReturnValue > 0 ? String(totalPurchaseReturnValue) : '');
  }, [totalPurchaseReturnValue]);

  // Submit Sales Return
  const handleConfirmSalesReturn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!activeSale) {
      setErrorMessage('မူလ အရောင်းဘောက်ချာကို ရွေးချယ်ပါ');
      return;
    }

    const validItems: ReturnItem[] = saleReturnItems
      .filter((it) => it.returnQty > 0)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.returnQty,
        unitPrice: it.unitPrice,
        subtotal: it.returnQty * it.unitPrice,
        unit: it.unit,
      }));

    if (validItems.length === 0) {
      setErrorMessage('အနည်းဆုံး ပစ္စည်း (၁) မျိုး၏ ပြန်အပ်အရေအတွက် ထည့်သွင်းပါ');
      return;
    }

    // Check for quantity limits
    for (const item of saleReturnItems) {
      const maxReturnable = item.soldQty - item.alreadyReturnedQty;
      if (item.returnQty > maxReturnable) {
        setErrorMessage(
          `"${item.productName}" ၏ ပြန်အပ်အရေအတွက် (${item.returnQty}) သည် ပြန်အပ်နိုင်သော ပမာဏ (${maxReturnable}) ထက် ပိုလွန်နေပါသည်`
        );
        return;
      }
    }

    const cashRefundNum = Number(saleCashRefund) || 0;

    try {
      setIsSubmitting(true);
      const returnRecord = await processSalesReturnAtomic({
        saleId: activeSale.id,
        items: validItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          reason: i.reason,
        })),
        cashRefundAmount: cashRefundNum,
        reason: saleReturnReason || 'ဝယ်သူမှ ပစ္စည်းပြန်အပ်ခြင်း',
        date: getTodayDateString(),
      });

      setSuccessMessage(
        `အရောင်းပြန်အပ်ခြင်း မှတ်တမ်းအမှတ် (${returnRecord.returnNo}) အား အောင်မြင်စွာ သိမ်းဆည်းပြီးဖြစ်ပါသည်။ စတော့နှင့် ငွေသားစာရင်းများ ပြင်ဆင်ပြီးပါပြီ။`
      );

      // Reset form
      setSelectedSaleVoucherNo('');
      setSaleReturnItems([]);
      setSaleCashRefund('');
      setSaleReturnReason('');
      await loadHistory();
      if (onReturnSuccess) onReturnSuccess();
    } catch (e: any) {
      setErrorMessage(e.message || 'အရောင်းပြန်အပ်ခြင်း ဆောင်ရွက်ရာတွင် အမှားအယွင်း ရှိပါသည်');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Purchase Return
  const handleConfirmPurchaseReturn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!activePurchase) {
      setErrorMessage('မူလ ဝယ်ယူမှုဘောက်ချာကို ရွေးချယ်ပါ');
      return;
    }

    const validItems: ReturnItem[] = purchaseReturnItems
      .filter((it) => it.returnQty > 0)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.returnQty,
        unitPrice: it.unitPrice,
        subtotal: it.returnQty * it.unitPrice,
        unit: it.unit,
      }));

    if (validItems.length === 0) {
      setErrorMessage('အနည်းဆုံး ပစ္စည်း (၁) မျိုး၏ ပြန်အပ်အရေအတွက် ထည့်သွင်းပါ');
      return;
    }

    for (const item of purchaseReturnItems) {
      const maxReturnable = item.purchasedQty - item.alreadyReturnedQty;
      if (item.returnQty > maxReturnable) {
        setErrorMessage(
          `"${item.productName}" ၏ ပြန်အပ်အရေအတွက် (${item.returnQty}) သည် ပြန်အပ်နိုင်သော ပမာဏ (${maxReturnable}) ထက် ပိုလွန်နေပါသည်`
        );
        return;
      }
    }

    const cashRecoveredNum = Number(purchaseCashRecovered) || 0;

    try {
      setIsSubmitting(true);
      const returnRecord = await processPurchaseReturnAtomic({
        purchaseId: activePurchase.id,
        referenceType: 'PURCHASE',
        items: validItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          reason: i.reason,
        })),
        cashRecoveryAmount: cashRecoveredNum,
        reason: purchaseReturnReason || 'ကုန်သည်/ဒိုင်သို့ ပစ္စည်းပြန်အပ်ခြင်း',
        date: getTodayDateString(),
      });

      setSuccessMessage(
        `ဝယ်ယူမှုပြန်အပ်ခြင်း မှတ်တမ်းအမှတ် (${returnRecord.returnNo}) အား အောင်မြင်စွာ သိမ်းဆည်းပြီးဖြစ်ပါသည်။ စတော့နှင့် ငွေသားစာရင်းများ ပြင်ဆင်ပြီးပါပြီ။`
      );

      // Reset form
      setSelectedPurchaseNo('');
      setPurchaseReturnItems([]);
      setPurchaseCashRecovered('');
      setPurchaseReturnReason('');
      await loadHistory();
      if (onReturnSuccess) onReturnSuccess();
    } catch (e: any) {
      setErrorMessage(e.message || 'ဝယ်ယူမှုပြန်အပ်ခြင်း ဆောင်ရွက်ရာတွင် အမှားအယွင်း ရှိပါသည်');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel/Reverse a Return
  const handleCancelReturn = async (returnRecord: ReturnRecord) => {
    if (
      !window.confirm(
        `ပြန်အပ်မှုမှတ်တမ်း (${returnRecord.returnNo}) ကို ပယ်ဖျက်လိုသည်မှာ သေချာပါသလား?\n\nစတော့နှင့် ငွေသားစာရင်းများအား မူလအတိုင်း ပြန်လည်ညှိနှိုင်းပေးမည် ဖြစ်ပါသည်။`
      )
    ) {
      return;
    }

    const reason = window.prompt('ပယ်ဖျက်ရသည့် အကြောင်းအရင်း ရေးသားပါ:', 'ပြန်အပ်စာရင်း မှားယွင်းရေးသွင်းမိခြင်း');
    if (!reason) return;

    try {
      setIsSubmitting(true);
      await cancelReturnAtomic(returnRecord.id, reason);
      setSuccessMessage(`ပြန်အပ်မှုမှတ်တမ်း (${returnRecord.returnNo}) ကို အောင်မြင်စွာ ပယ်ဖျက်ပြီး လျှော်ကြေးစာရင်း ထည့်သွင်းပြီးပါပြီ။`);
      await loadHistory();
      if (onReturnSuccess) onReturnSuccess();
    } catch (e: any) {
      setErrorMessage(e.message || 'ပယ်ဖျက်ရာတွင် အမှားအယွင်း ရှိပါသည်');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Sale Vouchers for Dropdown/Search
  const filteredSalesOptions = useMemo(() => {
    const q = saleSearch.toLowerCase().trim();
    return sales.filter((s) => {
      if (!q) return true;
      return (
        s.voucherNo.toLowerCase().includes(q) ||
        (s.merchantName || '').toLowerCase().includes(q) ||
        (s.merchantTown || '').toLowerCase().includes(q)
      );
    });
  }, [sales, saleSearch]);

  // Filtered Purchase Vouchers for Dropdown/Search
  const filteredPurchaseOptions = useMemo(() => {
    const q = purchaseSearch.toLowerCase().trim();
    return merchantPurchases.filter((p) => {
      if (!q) return true;
      return (
        p.purchaseNo.toLowerCase().includes(q) ||
        (p.supplierName || p.merchantName || '').toLowerCase().includes(q)
      );
    });
  }, [merchantPurchases, purchaseSearch]);

  // Filtered Return History
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    return returnHistory.filter((r) => {
      if (!q) return true;
      return (
        r.returnNo.toLowerCase().includes(q) ||
        r.originalVoucherNo.toLowerCase().includes(q) ||
        (r.partyName || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
      );
    });
  }, [returnHistory, historySearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>ပစ္စည်းပြန်အပ်နှင့် ငွေပြန်အမ်း/ပြန်ရ စာရင်း</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Phase 16
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                အရောင်း/ဝယ်ယူမှု ပြန်အပ်ခြင်း၊ စတော့နှင့် ငွေသားစာရင်းများ သီးခြားအလိုအလျောက် ညှိနှိုင်းခြင်း
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('sales_return')}
            className={`px-4 py-2.5 font-bold text-xs rounded-t-xl flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'sales_return'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            <span>အရောင်း ပြန်အပ်/ငွေပြန်အမ်း (Sales Return)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('purchase_return')}
            className={`px-4 py-2.5 font-bold text-xs rounded-t-xl flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'purchase_return'
                ? 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-blue-600" />
            <span>ဝယ်ယူမှု ပြန်အပ်/ငွေပြန်ရ (Purchase Return)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
            className={`px-4 py-2.5 font-bold text-xs rounded-t-xl flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-amber-700 border-t-2 border-amber-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4 text-amber-600" />
            <span>ပြန်အပ်မှု မှတ်တမ်းများ ({returnHistory.length})</span>
          </button>
        </div>

        {/* Global Banner Messages */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab 1: Sales Return */}
        {activeTab === 'sales_return' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Step 1: Select Original Sale Voucher */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                ၁။ မူလ အရောင်းဘောက်ချာ ရွေးချယ်ပါ
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ဘောက်ချာအမှတ် သို့မဟုတ် ဝယ်သူအမည်ဖြင့် ရှာဖွေပါ..."
                    value={saleSearch}
                    onChange={(e) => setSaleSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <select
                value={selectedSaleVoucherNo}
                onChange={(e) => setSelectedSaleVoucherNo(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="">-- အရောင်းဘောက်ချာ ရွေးပါ ({filteredSalesOptions.length} စောင်) --</option>
                {filteredSalesOptions.map((s) => (
                  <option key={s.id} value={s.voucherNo}>
                    [{s.voucherNo}] - {s.merchantName} ({s.merchantTown || 'မြို့မဖော်ပြထား'}) - {s.date} - {formatMMK(s.grandTotal)}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Sale Preview */}
            {activeSale && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-xs text-slate-800">
                      ဘောက်ချာအမှတ်: {activeSale.voucherNo}
                    </span>
                    <span className="text-2xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                      {activeSale.date}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-emerald-800">
                    စုစုပေါင်း: {formatMMK(activeSale.grandTotal)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>ဝယ်သူ: <strong>{activeSale.merchantName}</strong></span>
                  </div>
                  {activeSale.merchantTown && (
                    <div className="flex items-center gap-1">
                      <span>မြို့နယ်: <strong>{activeSale.merchantTown}</strong></span>
                    </div>
                  )}
                </div>

                {/* Return Quantity Form Items Table */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-800">
                    ၂။ ပြန်အပ်လိုသော ပစ္စည်းနှင့် အရေအတွက် သတ်မှတ်ပါ
                  </label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="p-2.5">ပစ္စည်းအမည်</th>
                          <th className="p-2.5 text-center">ရောင်းပြီး</th>
                          <th className="p-2.5 text-center">ပြန်အပ်ပြီး</th>
                          <th className="p-2.5 text-center">ပြန်အပ်နိုင်</th>
                          <th className="p-2.5 text-center w-28">ပြန်အပ်မည့် Qty</th>
                          <th className="p-2.5 text-right">နှုန်း</th>
                          <th className="p-2.5 text-right">ပြန်အမ်းငွေ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {saleReturnItems.map((item, idx) => {
                          const maxReturnable = Math.max(0, item.soldQty - item.alreadyReturnedQty);
                          const itemSubtotal = item.returnQty * item.unitPrice;
                          return (
                            <tr key={item.productId} className="hover:bg-slate-50">
                              <td className="p-2.5 font-semibold text-slate-800">
                                {item.productName}
                              </td>
                              <td className="p-2.5 text-center text-slate-600 font-mono">
                                {item.soldQty} {item.unit}
                              </td>
                              <td className="p-2.5 text-center text-amber-700 font-mono">
                                {item.alreadyReturnedQty > 0 ? `${item.alreadyReturnedQty} ${item.unit}` : '-'}
                              </td>
                              <td className="p-2.5 text-center text-emerald-700 font-mono font-bold">
                                {maxReturnable} {item.unit}
                              </td>
                              <td className="p-2.5 text-center">
                                <NumericInput
                                  value={item.returnQty || ''}
                                  onChangeValue={(val) => {
                                    const updated = [...saleReturnItems];
                                    updated[idx].returnQty = Math.min(val, maxReturnable);
                                    setSaleReturnItems(updated);
                                  }}
                                  disabled={maxReturnable === 0}
                                  className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100"
                                  placeholder="0"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-600">
                                {formatMMK(item.unitPrice)}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                                {formatMMK(itemSubtotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Refund & Reason Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-emerald-200">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ၃။ ဝယ်သူသို့ လက်ငင်း ပြန်အမ်းငွေပမာဏ (ကျပ်)
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <NumericInput
                        value={saleCashRefund}
                        onChange={(e) => setSaleCashRefund(e.target.value)}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-2xs text-slate-500">
                      အကြံပြုချက်: ပြန်အပ်ပစ္စည်း တန်ဖိုး စုစုပေါင်း ({formatMMK(totalSaleReturnValue)})
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ၄။ ပြန်အပ်ရသည့် အကြောင်းအရင်း / မှတ်ချက်
                    </label>
                    <input
                      type="text"
                      value={saleReturnReason}
                      onChange={(e) => setSaleReturnReason(e.target.value)}
                      placeholder={getNotePlaceholder('SALES_RETURN')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Action Submit Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleConfirmSalesReturn}
                    disabled={isSubmitting || totalSaleReturnValue === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'သိမ်းဆည်းနေပါသည်...'
                        : 'အရောင်းပြန်အပ်ခြင်း အတည်ပြုမည်'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Purchase Return */}
        {activeTab === 'purchase_return' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Step 1: Select Original Purchase Voucher */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                ၁။ မူလ ကုန်သည်/ဒိုင် ဝယ်ယူမှုဘောက်ချာ ရွေးချယ်ပါ
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ဝယ်ယူမှုအမှတ် သို့မဟုတ် ကုန်သည်အမည်ဖြင့် ရှာဖွေပါ..."
                    value={purchaseSearch}
                    onChange={(e) => setPurchaseSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <select
                value={selectedPurchaseNo}
                onChange={(e) => setSelectedPurchaseNo(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="">-- ဝယ်ယူမှုဘောက်ချာ ရွေးပါ ({filteredPurchaseOptions.length} စောင်) --</option>
                {filteredPurchaseOptions.map((p) => (
                  <option key={p.id} value={p.purchaseNo}>
                    [{p.purchaseNo}] - {p.supplierName || p.merchantName} - {p.date} - {formatMMK(p.totalAmount)}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Purchase Preview */}
            {activePurchase && (
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-700" />
                    <span className="font-bold text-xs text-slate-800">
                      ဝယ်ယူမှုအမှတ်: {activePurchase.purchaseNo}
                    </span>
                    <span className="text-2xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                      {activePurchase.date}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-blue-800">
                    စုစုပေါင်း: {formatMMK(activePurchase.totalAmount)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>ပေးသွင်းသူ: <strong>{activePurchase.supplierName || activePurchase.merchantName}</strong></span>
                  </div>
                </div>

                {/* Return Quantity Form Items Table */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-800">
                    ၂။ ပြန်အပ်လိုသော ကုန်ကြမ်း/ပစ္စည်းနှင့် အရေအတွက် သတ်မှတ်ပါ
                  </label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="p-2.5">ကုန်ပစ္စည်းအမည်</th>
                          <th className="p-2.5 text-center">ဝယ်ယူခဲ့</th>
                          <th className="p-2.5 text-center">ပြန်အပ်ပြီး</th>
                          <th className="p-2.5 text-center">ပြန်အပ်နိုင်</th>
                          <th className="p-2.5 text-center w-28">ပြန်အပ်မည့် Qty</th>
                          <th className="p-2.5 text-right">နှုန်း</th>
                          <th className="p-2.5 text-right">ပြန်ရမည့်ငွေ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {purchaseReturnItems.map((item, idx) => {
                          const maxReturnable = Math.max(0, item.purchasedQty - item.alreadyReturnedQty);
                          const itemSubtotal = item.returnQty * item.unitPrice;
                          return (
                            <tr key={item.productId} className="hover:bg-slate-50">
                              <td className="p-2.5 font-semibold text-slate-800">
                                {item.productName}
                              </td>
                              <td className="p-2.5 text-center text-slate-600 font-mono">
                                {item.purchasedQty} {item.unit}
                              </td>
                              <td className="p-2.5 text-center text-amber-700 font-mono">
                                {item.alreadyReturnedQty > 0 ? `${item.alreadyReturnedQty} ${item.unit}` : '-'}
                              </td>
                              <td className="p-2.5 text-center text-blue-700 font-mono font-bold">
                                {maxReturnable} {item.unit}
                              </td>
                              <td className="p-2.5 text-center">
                                <NumericInput
                                  value={item.returnQty || ''}
                                  onChangeValue={(val) => {
                                    const updated = [...purchaseReturnItems];
                                    updated[idx].returnQty = Math.min(val, maxReturnable);
                                    setPurchaseReturnItems(updated);
                                  }}
                                  disabled={maxReturnable === 0}
                                  className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                                  placeholder="0"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-600">
                                {formatMMK(item.unitPrice)}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-blue-700">
                                {formatMMK(itemSubtotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Refund & Reason Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-blue-200">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ၃။ ကုန်သည်/ဒိုင်ထံမှ လက်ငင်း ပြန်ရရှိငွေပမာဏ (ကျပ်)
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <NumericInput
                        value={purchaseCashRecovered}
                        onChange={(e) => setPurchaseCashRecovered(e.target.value)}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-2xs text-slate-500">
                      အကြံပြုချက်: ပြန်အပ်ကုန်ကြမ်း တန်ဖိုး စုစုပေါင်း ({formatMMK(totalPurchaseReturnValue)})
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ၄။ ပြန်အပ်ရသည့် အကြောင်းအရင်း / မှတ်ချက်
                    </label>
                    <input
                      type="text"
                      value={purchaseReturnReason}
                      onChange={(e) => setPurchaseReturnReason(e.target.value)}
                      placeholder={getNotePlaceholder('PURCHASE_RETURN')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Action Submit Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleConfirmPurchaseReturn}
                    disabled={isSubmitting || totalPurchaseReturnValue === 0}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'သိမ်းဆည်းနေပါသည်...'
                        : 'ဝယ်ယူမှုပြန်အပ်ခြင်း အတည်ပြုမည်'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: History & Reversals */}
        {activeTab === 'history' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ပြန်အပ်အမှတ် သို့မဟုတ် ဘောက်ချာအမှတ်ဖြင့် ရှာပါ..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>ပြန်အပ်မှု မှတ်တမ်းများ မရှိသေးပါ</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((rec) => {
                  const isSales = rec.returnType === 'SALES_RETURN';
                  const isCancelled = rec.status === 'CANCELLED';

                  return (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-xl border text-xs space-y-2 transition-all ${
                        isCancelled
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : isSales
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-blue-50/40 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-2xs ${
                              isSales
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isSales ? 'အရောင်းပြန်အပ်' : 'ဝယ်ယူမှုပြန်အပ်'}
                          </span>
                          <span className="font-bold text-slate-900 font-mono">
                            {rec.returnNo}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-600">
                            မူလဘောက်ချာ: <strong>{rec.originalVoucherNo}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-2xs">
                            {rec.date}
                          </span>
                          {isCancelled ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold text-2xs">
                              ပယ်ဖျက်ပြီး
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCancelReturn(rec)}
                              disabled={isSubmitting}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-2xs rounded-lg transition-colors cursor-pointer"
                            >
                              ပယ်ဖျက်မည် (Reverse)
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <div>
                          <span>အဖွဲ့အစည်း/ဝယ်သူ: <strong>{rec.partyName || '-'}</strong></span>
                        </div>
                        <div className="font-mono font-bold">
                          {isSales
                            ? `ပြန်အမ်းငွေ: ${formatMMK(rec.cashRefundedAmount)}`
                            : `ပြန်ရငွေ: ${formatMMK(rec.cashRecoveredAmount)}`}
                        </div>
                      </div>

                      {rec.items && rec.items.length > 0 && (
                        <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                          <span className="font-semibold text-2xs text-slate-500 block mb-1">
                            ပြန်အပ်ခဲ့သော ပစ္စည်းများ:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {rec.items.map((it) => (
                              <span
                                key={it.productId}
                                className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-2xs font-mono"
                              >
                                {it.productName}: <strong>{it.quantity} {it.unit || 'ခု'}</strong> x {formatMMK(it.unitPrice)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {rec.reason && (
                        <p className="text-2xs text-slate-500 italic">
                          အကြောင်းအရင်း: {rec.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-2xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>
              ပြန်အပ်မှု မှတ်တမ်းများသည် Stock Ledger နှင့် Cash Ledger များတွင် သီးခြား လျှော်ကြေးစာရင်းအဖြစ် အလိုအလျောက် သွားရောက်ထည့်သွင်းပါသည်
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
