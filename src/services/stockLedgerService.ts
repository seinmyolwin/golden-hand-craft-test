import {
  Product,
  TransactionRecord,
  SaleRecord,
  StockAdjustmentRecord,
  PeerTradeRecord,
  MerchantPurchaseRecord,
} from '../types';
import { formatMMK, formatNumberOnly } from '../utils/storage';

export type StockMovementType =
  | 'OPENING_BALANCE'
  | 'SUPPLIER_INBOUND'
  | 'MERCHANT_OUTBOUND'
  | 'MERCHANT_PURCHASE_INBOUND'
  | 'PEER_BORROW_IN'
  | 'PEER_LEND_OUT'
  | 'PEER_RETURN_IN'
  | 'PEER_RETURN_OUT'
  | 'STOCK_ADJUSTMENT_IN'
  | 'STOCK_ADJUSTMENT_OUT'
  | 'DAMAGE_LOSS'
  | 'TRANSACTION_CANCELLED_REVERSAL'
  | 'SALE_CANCELLED_REVERSAL'
  | 'PURCHASE_CANCELLED_REVERSAL';

export interface StockLedgerEntry {
  id: string;
  productId: string;
  productName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timestamp: number;
  movementType: StockMovementType;
  typeLabelMy: string;
  direction: 'IN' | 'OUT' | 'ADJUST' | 'INITIAL';
  quantity: number; // Positive magnitude
  signedQuantity: number; // Positive for inflow, negative for outflow
  previousBalance: number;
  balanceAfter: number;
  referenceVoucherNo: string;
  referenceId: string;
  counterpartName: string;
  unit: string;
  unitPrice?: number;
  totalValue?: number;
  notes?: string;
  status: 'ACTIVE' | 'CANCELLED';
}

export interface ProductStockLedgerSummary {
  product: Product;
  openingBalance: number;
  totalInflowQty: number;
  totalOutflowQty: number;
  totalAdjustmentNetQty: number;
  calculatedClosingBalance: number;
  recordedCurrentStock: number;
  discrepancy: number; // recorded - calculated (0 means perfectly balanced)
  isBalanced: boolean;
  totalInflowValue: number;
  totalOutflowValue: number;
  currentStockCostValuation: number; // at default buy price
  currentStockWholesaleValuation: number; // at wholesale price
  entriesCount: number;
  entries: StockLedgerEntry[];
}

export interface StockLedgerFilterOptions {
  startDate?: string;
  endDate?: string;
  movementTypeFilter?: 'ALL' | 'INBOUND' | 'OUTBOUND' | 'PEER' | 'ADJUSTMENT' | 'DAMAGE';
  searchQuery?: string;
}

/**
 * Maps movement type to descriptive Myanmar label
 */
export function getMovementTypeLabel(type: StockMovementType): string {
  switch (type) {
    case 'OPENING_BALANCE':
      return 'စတင်လက်ကျန် (Opening Stock)';
    case 'SUPPLIER_INBOUND':
      return 'ကုန်သိမ်းအဝင် (Supplier Inbound)';
    case 'MERCHANT_OUTBOUND':
      return 'အရောင်းအထွက် (Merchant Sale)';
    case 'MERCHANT_PURCHASE_INBOUND':
      return 'ကုန်ကြမ်းဝယ်ယူအဝင် (Purchase Inbound)';
    case 'PEER_BORROW_IN':
      return 'မိတ်ဖက်ဆိုင်မှ ချေးယူအဝင် (Borrow In)';
    case 'PEER_LEND_OUT':
      return 'မိတ်ဖက်ဆိုင်သို့ ချေးငှားအထွက် (Lend Out)';
    case 'PEER_RETURN_IN':
      return 'မိတ်ဖက်ဆိုင်မှ ပြန်ပေးအဝင် (Return In)';
    case 'PEER_RETURN_OUT':
      return 'မိတ်ဖက်ဆိုင်သို့ ပြန်ဆပ်အထွက် (Return Out)';
    case 'STOCK_ADJUSTMENT_IN':
      return 'လက်ကျန်ညှိ အဝင်တိုး (Adjustment In)';
    case 'STOCK_ADJUSTMENT_OUT':
      return 'လက်ကျန်ညှိ အထွက်လျှော့ (Adjustment Out)';
    case 'DAMAGE_LOSS':
      return 'ပျက်စီး/ဆုံးရှုံး စာရင်းထုတ် (Damage/Loss)';
    case 'TRANSACTION_CANCELLED_REVERSAL':
      return 'ကုန်သိမ်းပယ်ဖျက် ပြန်နုတ် (Collection Cancelled)';
    case 'SALE_CANCELLED_REVERSAL':
      return 'အရောင်းပယ်ဖျက် ပြန်ဖြည့် (Sale Cancelled)';
    case 'PURCHASE_CANCELLED_REVERSAL':
      return 'ဝယ်ယူမှုပယ်ဖျက် ပြန်နုတ် (Purchase Cancelled)';
    default:
      return type;
  }
}

/**
 * Builds chronological raw events for a specific product
 */
export function buildRawProductMovements(
  product: Product,
  transactions: TransactionRecord[] = [],
  sales: SaleRecord[] = [],
  stockAdjustments: StockAdjustmentRecord[] = [],
  merchantPurchases: MerchantPurchaseRecord[] = [],
  peerTrades: PeerTradeRecord[] = []
): Omit<StockLedgerEntry, 'previousBalance' | 'balanceAfter'>[] {
  const pId = product.id;
  const rawEvents: Omit<StockLedgerEntry, 'previousBalance' | 'balanceAfter'>[] = [];

  // 1. Initial Opening Stock Event (if > 0 or product has createdAt)
  const openingStock = product.openingStock ?? 0;
  if (openingStock > 0 || product.createdAt) {
    const createdDate = product.createdAt ? product.createdAt.split('T')[0] : '2026-01-01';
    const createdTime = product.createdAt && product.createdAt.includes('T')
      ? product.createdAt.split('T')[1].substring(0, 5)
      : '00:00';
    const ts = new Date(product.createdAt || `${createdDate}T00:00:00Z`).getTime() || 0;

    rawEvents.push({
      id: `open-${product.id}`,
      productId: product.id,
      productName: product.name,
      date: createdDate,
      time: createdTime,
      timestamp: ts,
      movementType: 'OPENING_BALANCE',
      typeLabelMy: getMovementTypeLabel('OPENING_BALANCE'),
      direction: 'INITIAL',
      quantity: openingStock,
      signedQuantity: openingStock,
      referenceVoucherNo: 'INIT-BALANCE',
      referenceId: product.id,
      counterpartName: 'လုပ်ငန်းစတင်လက်ကျန် (Initial Setup)',
      unit: product.unit,
      unitPrice: product.defaultPrice,
      totalValue: openingStock * (product.defaultPrice || 0),
      notes: 'စတင်ချိန် ကုန်ပစ္စည်းလက်ကျန် စာရင်း',
      status: 'ACTIVE',
    });
  }

  // 2. Inbound Transactions (Collections from Suppliers)
  (transactions || []).forEach((tx) => {
    if (!tx || !Array.isArray(tx.items)) return;
    const isCancelled = tx.status === 'CANCELLED';

    tx.items.forEach((item) => {
      if (!item || item.productId !== pId) return;
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return;

      const date = tx.date || '2026-01-01';
      const time = tx.time || '00:00';
      const ts = new Date(`${date}T${time}:00Z`).getTime() || Date.now();
      const unitPrice = Number(item.unitPrice) || product.defaultPrice || 0;

      if (!isCancelled) {
        rawEvents.push({
          id: `tx-${tx.id}-${item.productId}`,
          productId: pId,
          productName: product.name,
          date,
          time,
          timestamp: ts,
          movementType: 'SUPPLIER_INBOUND',
          typeLabelMy: getMovementTypeLabel('SUPPLIER_INBOUND'),
          direction: 'IN',
          quantity: qty,
          signedQuantity: qty,
          referenceVoucherNo: tx.voucherNo || `TX-${tx.id.substring(0, 6)}`,
          referenceId: tx.id,
          counterpartName: `${tx.supplierName || 'ပေးသွင်းသူ'} (${tx.supplierVillage || ''})`.trim(),
          unit: item.unit || product.unit,
          unitPrice,
          totalValue: qty * unitPrice,
          notes: tx.notes || 'ကုန်ပစ္စည်းပေးသွင်းသူထံမှ ကုန်သိမ်းဆည်းခြင်း',
          status: 'ACTIVE',
        });
      }
    });
  });

  // 3. Outbound Sales (To Merchants)
  (sales || []).forEach((sale) => {
    if (!sale || !Array.isArray(sale.items)) return;
    const isCancelled = sale.status === 'CANCELLED';

    sale.items.forEach((item) => {
      if (!item || item.productId !== pId) return;
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return;

      const date = sale.date || '2026-01-01';
      const time = sale.time || '00:00';
      const ts = new Date(`${date}T${time}:00Z`).getTime() || Date.now();
      const unitPrice = Number(item.unitPrice) || product.defaultWholesalePrice || product.defaultPrice || 0;

      if (!isCancelled) {
        rawEvents.push({
          id: `sale-${sale.id}-${item.productId}`,
          productId: pId,
          productName: product.name,
          date,
          time,
          timestamp: ts,
          movementType: 'MERCHANT_OUTBOUND',
          typeLabelMy: getMovementTypeLabel('MERCHANT_OUTBOUND'),
          direction: 'OUT',
          quantity: qty,
          signedQuantity: -qty,
          referenceVoucherNo: sale.voucherNo || `SALE-${sale.id.substring(0, 6)}`,
          referenceId: sale.id,
          counterpartName: `${sale.merchantName || 'ကုန်သည်'} (${sale.merchantTown || ''})`.trim(),
          unit: item.unit || product.unit,
          unitPrice,
          totalValue: qty * unitPrice,
          notes: sale.notes || 'ကုန်သည်သို့ လက္ကားရောင်းချခြင်း',
          status: 'ACTIVE',
        });
      }
    });
  });

  // 4. Inbound Purchases (From Merchants / Raw Material Sellers)
  (merchantPurchases || []).forEach((purchase) => {
    if (!purchase || !Array.isArray(purchase.items)) return;
    const isCancelled = purchase.status === 'CANCELLED';

    purchase.items.forEach((item) => {
      if (!item || item.productId !== pId) return;
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return;

      const date = purchase.date || '2026-01-01';
      const time = purchase.time || '00:00';
      const ts = new Date(`${date}T${time}:00Z`).getTime() || Date.now();
      const unitPrice = Number(item.unitPrice) || product.defaultPrice || 0;

      if (!isCancelled) {
        rawEvents.push({
          id: `pur-${purchase.id}-${item.productId}`,
          productId: pId,
          productName: product.name,
          date,
          time,
          timestamp: ts,
          movementType: 'MERCHANT_PURCHASE_INBOUND',
          typeLabelMy: getMovementTypeLabel('MERCHANT_PURCHASE_INBOUND'),
          direction: 'IN',
          quantity: qty,
          signedQuantity: qty,
          referenceVoucherNo: purchase.purchaseNo || `PUR-${purchase.id.substring(0, 6)}`,
          referenceId: purchase.id,
          counterpartName: `${purchase.merchantName || 'ကုန်သည်'} (${purchase.merchantTown || ''})`.trim(),
          unit: item.unit || product.unit,
          unitPrice,
          totalValue: qty * unitPrice,
          notes: purchase.notes || 'ကုန်ကြမ်းဝယ်ယူမှု စာရင်း',
          status: 'ACTIVE',
        });
      }
    });
  });

  // 5. Peer Trading Movements
  (peerTrades || []).forEach((trade) => {
    if (!trade || trade.productId !== pId) return;
    const qty = Math.abs(Number(trade.quantity) || 0);
    if (qty <= 0) return;

    const date = trade.date || '2026-01-01';
    const time = trade.time || '00:00';
    const ts = new Date(`${date}T${time}:00Z`).getTime() || Date.now();
    const isBorrowIn = trade.tradeType === 'BORROW_IN';

    rawEvents.push({
      id: `peer-${trade.id}`,
      productId: pId,
      productName: product.name,
      date,
      time,
      timestamp: ts,
      movementType: isBorrowIn ? 'PEER_BORROW_IN' : 'PEER_LEND_OUT',
      typeLabelMy: getMovementTypeLabel(isBorrowIn ? 'PEER_BORROW_IN' : 'PEER_LEND_OUT'),
      direction: isBorrowIn ? 'IN' : 'OUT',
      quantity: qty,
      signedQuantity: isBorrowIn ? qty : -qty,
      referenceVoucherNo: trade.voucherNo || `PEER-${trade.id.substring(0, 6)}`,
      referenceId: trade.id,
      counterpartName: `မိတ်ဖက်ဆိုင် - ${trade.peerShopName || trade.peerTraderName || 'မိတ်ဖက်'}`,
      unit: trade.unit || product.unit,
      unitPrice: product.defaultPrice,
      totalValue: qty * (product.defaultPrice || 0),
      notes: trade.notes || (isBorrowIn ? 'မိတ်ဖက်ထံမှ ချေးယူခြင်း' : 'မိတ်ဖက်သို့ ချေးငှားခြင်း'),
      status: 'ACTIVE',
    });
  });

  // 6. Stock Adjustments (Manual In, Out, Damage)
  (stockAdjustments || []).forEach((adj) => {
    if (!adj || adj.productId !== pId) return;
    if (adj.status === 'CANCELLED') return;

    const date = adj.date || '2026-01-01';
    const time = adj.time || '00:00';
    const ts = new Date(`${date}T${time}:00Z`).getTime() || Date.now();
    const isDamage = adj.type === 'DAMAGE';
    const isIn = adj.type === 'IN_ADJUSTMENT' || (adj.quantity > 0 && !isDamage);
    const absQty = Math.abs(Number(adj.quantity) || 0);

    const movementType: StockMovementType = isDamage
      ? 'DAMAGE_LOSS'
      : isIn
      ? 'STOCK_ADJUSTMENT_IN'
      : 'STOCK_ADJUSTMENT_OUT';

    rawEvents.push({
      id: `adj-${adj.id}`,
      productId: pId,
      productName: product.name,
      date,
      time,
      timestamp: ts,
      movementType,
      typeLabelMy: getMovementTypeLabel(movementType),
      direction: isDamage || !isIn ? 'OUT' : 'IN',
      quantity: absQty,
      signedQuantity: isDamage || !isIn ? -absQty : absQty,
      referenceVoucherNo: `ADJ-${adj.id.substring(0, 6)}`,
      referenceId: adj.id,
      counterpartName: 'စာရင်းညှိနှိုင်းမှု (Internal Adjustment)',
      unit: product.unit,
      unitPrice: product.defaultPrice,
      totalValue: absQty * (product.defaultPrice || 0),
      notes: adj.reason || (isDamage ? 'ပစ္စည်းပျက်စီးမှု စာရင်းထုတ်' : 'လက်ကျန်စာရင်း ညှိနှိုင်းပြင်ဆင်ခြင်း'),
      status: 'ACTIVE',
    });
  });

  return rawEvents;
}

/**
 * Calculates complete, sequential running balance stock ledger for a product
 */
export function calculateProductStockLedger(
  product: Product,
  transactions: TransactionRecord[] = [],
  sales: SaleRecord[] = [],
  stockAdjustments: StockAdjustmentRecord[] = [],
  merchantPurchases: MerchantPurchaseRecord[] = [],
  peerTrades: PeerTradeRecord[] = [],
  filterOptions?: StockLedgerFilterOptions
): ProductStockLedgerSummary {
  const rawEvents = buildRawProductMovements(
    product,
    transactions,
    sales,
    stockAdjustments,
    merchantPurchases,
    peerTrades
  );

  // Sort chronologically by date ascending, then time ascending, then timestamp
  rawEvents.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    if (a.time !== b.time) {
      return a.time.localeCompare(b.time);
    }
    return a.timestamp - b.timestamp;
  });

  let runningBalance = 0;
  let totalInflowQty = 0;
  let totalOutflowQty = 0;
  let totalAdjustmentNetQty = 0;
  let totalInflowValue = 0;
  let totalOutflowValue = 0;

  const fullEntries: StockLedgerEntry[] = rawEvents.map((event) => {
    const prev = runningBalance;
    runningBalance += event.signedQuantity;

    if (event.movementType === 'OPENING_BALANCE') {
      // Opening balance tracked separately
    } else if (event.signedQuantity > 0 && event.direction === 'IN') {
      totalInflowQty += event.quantity;
      totalInflowValue += event.totalValue || 0;
    } else if (event.signedQuantity < 0 && (event.direction === 'OUT' || event.movementType === 'DAMAGE_LOSS')) {
      totalOutflowQty += event.quantity;
      totalOutflowValue += event.totalValue || 0;
    } else {
      totalAdjustmentNetQty += event.signedQuantity;
    }

    return {
      ...event,
      previousBalance: prev,
      balanceAfter: runningBalance,
    };
  });

  const calculatedClosingBalance = runningBalance;
  const recordedCurrentStock = typeof product.currentStock === 'number'
    ? product.currentStock
    : product.openingStock ?? 0;
  const discrepancy = recordedCurrentStock - calculatedClosingBalance;
  const isBalanced = Math.abs(discrepancy) === 0;

  const currentStockCostValuation = Math.max(0, calculatedClosingBalance) * (product.defaultPrice || 0);
  const currentStockWholesaleValuation = Math.max(0, calculatedClosingBalance) * (product.defaultWholesalePrice || Math.round((product.defaultPrice || 0) * 1.25));

  // Apply filters if requested (reverse chronologically for UI display: newest first)
  let displayedEntries = [...fullEntries].reverse();

  if (filterOptions) {
    if (filterOptions.startDate) {
      displayedEntries = displayedEntries.filter((e) => e.date >= filterOptions.startDate!);
    }
    if (filterOptions.endDate) {
      displayedEntries = displayedEntries.filter((e) => e.date <= filterOptions.endDate!);
    }
    if (filterOptions.movementTypeFilter && filterOptions.movementTypeFilter !== 'ALL') {
      switch (filterOptions.movementTypeFilter) {
        case 'INBOUND':
          displayedEntries = displayedEntries.filter((e) => e.direction === 'IN' || e.movementType === 'OPENING_BALANCE');
          break;
        case 'OUTBOUND':
          displayedEntries = displayedEntries.filter((e) => e.movementType === 'MERCHANT_OUTBOUND');
          break;
        case 'PEER':
          displayedEntries = displayedEntries.filter((e) => e.movementType.startsWith('PEER_'));
          break;
        case 'ADJUSTMENT':
          displayedEntries = displayedEntries.filter((e) => e.movementType === 'STOCK_ADJUSTMENT_IN' || e.movementType === 'STOCK_ADJUSTMENT_OUT');
          break;
        case 'DAMAGE':
          displayedEntries = displayedEntries.filter((e) => e.movementType === 'DAMAGE_LOSS');
          break;
      }
    }
    if (filterOptions.searchQuery && filterOptions.searchQuery.trim()) {
      const q = filterOptions.searchQuery.toLowerCase().trim();
      displayedEntries = displayedEntries.filter((e) =>
        e.referenceVoucherNo.toLowerCase().includes(q) ||
        e.counterpartName.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.typeLabelMy.toLowerCase().includes(q)
      );
    }
  }

  return {
    product,
    openingBalance: product.openingStock ?? 0,
    totalInflowQty,
    totalOutflowQty,
    totalAdjustmentNetQty,
    calculatedClosingBalance,
    recordedCurrentStock,
    discrepancy,
    isBalanced,
    totalInflowValue,
    totalOutflowValue,
    currentStockCostValuation,
    currentStockWholesaleValuation,
    entriesCount: fullEntries.length,
    entries: displayedEntries,
  };
}

/**
 * Computes stock ledger summary for all products
 */
export function calculateAllProductsStockLedgerSummaries(
  products: Product[] = [],
  transactions: TransactionRecord[] = [],
  sales: SaleRecord[] = [],
  stockAdjustments: StockAdjustmentRecord[] = [],
  merchantPurchases: MerchantPurchaseRecord[] = [],
  peerTrades: PeerTradeRecord[] = []
): ProductStockLedgerSummary[] {
  return products.map((prod) =>
    calculateProductStockLedger(
      prod,
      transactions,
      sales,
      stockAdjustments,
      merchantPurchases,
      peerTrades
    )
  );
}

/**
 * Exports a single product's detailed stock ledger to CSV
 */
export function exportProductStockLedgerCSV(summary: ProductStockLedgerSummary): void {
  const prod = summary.product;
  const bom = '\uFEFF';
  const header = [
    'စဉ် (No.)',
    'ရက်စွဲ (Date)',
    'အချိန် (Time)',
    'လှုပ်ရှားမှုအမျိုးအစား (Movement Type)',
    'ဘောင်ချာအမှတ် (Voucher No)',
    'ဆက်စပ်သူ/အကြောင်းအရာ (Party / Reason)',
    'အဝင်အရေအတွက် (+In)',
    'အထွက်အရေအတွက် (-Out)',
    'လက်ကျန်အရေအတွက် (Running Balance)',
    'ယူနစ် (Unit)',
    'တစ်ယူနစ်တန်ဖိုး (Unit Price MMK)',
    'စုစုပေါင်းတန်ဖိုး (Total Value MMK)',
    'မှတ်ချက် (Notes)',
  ].join(',');

  const rows = summary.entries.map((entry, idx) => {
    const inQty = entry.signedQuantity > 0 ? entry.quantity : '';
    const outQty = entry.signedQuantity < 0 ? entry.quantity : '';
    const cleanNotes = (entry.notes || '').replace(/"/g, '""');
    const cleanParty = (entry.counterpartName || '').replace(/"/g, '""');

    return [
      idx + 1,
      entry.date,
      entry.time,
      `"${entry.typeLabelMy}"`,
      `"${entry.referenceVoucherNo}"`,
      `"${cleanParty}"`,
      inQty,
      outQty,
      entry.balanceAfter,
      `"${entry.unit}"`,
      entry.unitPrice || 0,
      entry.totalValue || 0,
      `"${cleanNotes}"`,
    ].join(',');
  });

  const metadataHeader = [
    `"ပစ္စည်းအမည် (Product Name): ${prod.name}"`,
    `"အမျိုးအစား (Category): ${prod.category} | ယူနစ် (Unit): ${prod.unit}"`,
    `"စတင်လက်ကျန် (Opening): ${summary.openingBalance} | စုစုပေါင်းအဝင်: +${summary.totalInflowQty} | စုစုပေါင်းအထွက်: -${summary.totalOutflowQty}"`,
    `"လက်ရှိလက်ကျန် (Current Stock): ${summary.calculatedClosingBalance} ${prod.unit} | အရင်းတန်ဖိုး: ${formatMMK(summary.currentStockCostValuation)}"`,
    '',
  ].join('\n');

  const csvContent = bom + metadataHeader + '\n' + header + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = prod.name.replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `Stock_Ledger_${safeName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports all products inventory ledger summary to CSV
 */
export function exportAllProductsStockLedgerSummaryCSV(summaries: ProductStockLedgerSummary[]): void {
  const bom = '\uFEFF';
  const header = [
    'စဉ်',
    'ကုန်ပစ္စည်းအမည်',
    'အမျိုးအစား',
    'ယူနစ်',
    'စတင်လက်ကျန် (Opening)',
    'စုစုပေါင်းအဝင် (+In)',
    'စုစုပေါင်းအထွက် (-Out)',
    'ညှိနှိုင်းမှုရလဒ် (+/-)',
    'တွက်ချက်လက်ကျန် (Calc Balance)',
    'မှတ်တမ်းလက်ကျန် (Recorded Stock)',
    'ကွာဟချက် (Discrepancy)',
    'ကိုက်ညီမှုအခြေအနေ',
    'ဝယ်စျေး (Cost Price)',
    'လက္ကားရောင်းစျေး (Wholesale Price)',
    'လက်ကျန်အရင်းတန်ဖိုး (Cost Valuation)',
    'ရောင်းချနိုင်ခြေတန်ဖိုး (Wholesale Valuation)',
  ].join(',');

  const rows = summaries.map((s, idx) => {
    const p = s.product;
    return [
      idx + 1,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.unit}"`,
      s.openingBalance,
      s.totalInflowQty,
      s.totalOutflowQty,
      s.totalAdjustmentNetQty,
      s.calculatedClosingBalance,
      s.recordedCurrentStock,
      s.discrepancy,
      s.isBalanced ? '"ကိုက်ညီပါသည် (Balanced)"' : '"ကွာဟချက်ရှိပါသည် (Discrepancy)"',
      p.defaultPrice || 0,
      p.defaultWholesalePrice || 0,
      s.currentStockCostValuation,
      s.currentStockWholesaleValuation,
    ].join(',');
  });

  const csvContent = bom + header + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `All_Products_Stock_Ledger_Summary_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
