export interface Product {
  id: string;
  name: string;
  defaultPrice: number; // Procurement / Buy Price in MMK
  defaultWholesalePrice?: number; // Wholesale selling price in MMK
  unit: string; // e.g. ထည်, ချပ်, လုံး
  category: string;
  openingStock?: number; // Starting inventory count
  currentStock?: number; // Real-time available stock
  minStockAlert?: number; // Low stock alert threshold
  active: boolean;
}

export interface Supplier {
  id: string;
  code: string; // S-001, S-002 etc.
  name: string;
  phone: string;
  village: string; // ကျေးရွာ
  notes?: string;
  initialAdvance?: number; // Initial opening advance balance
  currentAdvanceBalance: number; // Current remaining advance/debt owed by supplier
  totalGoodsValueDelivered?: number; // Cumulative goods delivered
  totalGoodsDeliveredValue?: number;
  totalAdvanceGiven?: number; // Cumulative total advance received by supplier
  totalAdvancesGiven?: number;
  totalMaterialCreditGiven?: number; // ထုတ်ပေးထားသော ဝါး/ကြိမ်တန်ဖိုး
  totalRepaymentReceived?: number; // ပြန်လည်ပေးဆပ်ငွေ
  createdAt: string;
  updatedAt: string;
}

export type MerchantRole = 'BUYER' | 'SUPPLIER' | 'BOTH';

export interface Merchant {
  id: string;
  code: string; // M-001, M-002 etc.
  name: string; // e.g. ရွှေမန္တလေး ယွန်းဆိုင်
  town: string; // e.g. မန္တလေး, ရန်ကုန်, ပုဂံ
  phone: string;
  address?: string;
  ownerOrContact?: string; // ပိုင်ရှင် သို့မဟုတ် ဆက်သွယ်ရမည့်သူ
  notes?: string;
  role?: MerchantRole; // 'BUYER' (ဝယ်ယူသူ), 'SUPPLIER' (ကုန်ကြမ်းရောင်းသူ), 'BOTH' (နှစ်မျိုးလုံး)
  currentReceivableBalance: number; // Remaining debt/receivable owed by merchant to business
  payableBalance?: number; // လုပ်ငန်းမှ ကုန်သည်သို့ ပေးရန်ကျန်
  totalPurchasesValue: number; // Cumulative goods sold to merchant
  totalPaidAmount: number; // Cumulative total payment made by merchant
  totalPurchasedFromMerchant?: number; // ကုန်သည်ထံမှ ဝယ်ယူခဲ့သော ကုန်ကြမ်းတန်ဖိုး
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit: string;
}

export type TransactionItem = CollectionItem;

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // Wholesale sale unit price
  costPrice?: number; // Cost unit price for profit calculation
  subtotal: number;
  unit: string;
}

export type PaymentMethod = 'CASH' | 'KPAY' | 'WAVE' | 'BANK_TRANSFER' | 'KBZPAY' | 'WAVEPAY' | 'OFFSET_GOODS';

export interface RawMaterialPreset {
  id: string;
  category: 'BAMBOO' | 'RATTAN' | 'CASH_ADVANCE' | 'OTHER' | string;
  categoryLabel: string; // e.g. "ဝါးကုန်ကြမ်း", "ကြိမ်ကုန်ကြမ်း", "ငွေကြိုယူ", "အခြားကုန်ကြမ်း"
  name: string;
  defaultUnit: string;
  defaultUnitPrice: number;
  isCustom?: boolean;
}

export interface RawMaterialItem {
  id?: string;
  productId?: string;
  name: string;
  productName?: string;
  category?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue?: number;
  subtotal?: number;
}

export interface TransactionRecord {
  id: string;
  voucherNo: string;
  supplierId: string;
  supplierName: string;
  supplierVillage?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type?: 'COLLECTION_AND_SETTLEMENT' | 'ADVANCE_ONLY' | 'CASH_PAYMENT_ONLY' | 'RAW_MATERIAL_CREDIT' | 'SUPPLIER_REPAYMENT' | string;
  items: CollectionItem[]; // Finished goods collected OR raw material items sold
  // Financial calculation breakdown
  totalGoodsValue: number; // ပေးသွင်းကုန်ပစ္စည်းတန်ဖိုး
  previousAdvanceBalance: number; // ယခင်အကြိုငွေကျန်
  advanceDeducted: number; // အကြိုငွေမှ နုတ်ယူငွေ
  cashPaidToSupplier?: number; // အပိုပေးငွေ
  netCashPaidToSupplier?: number;
  newAdvanceTaken: number; // အကြိုငွေအသစ် ထုတ်ယူငွေ
  newAdvanceReason?: string; // အကြိုငွေယူရသည့် အကြောင်းပြချက်
  // Raw material credits & repayments
  materialItems?: CollectionItem[]; // ကုန်ကြမ်းပစ္စည်းများ
  rawMaterialItems?: RawMaterialItem[];
  materialTotalValue?: number; // ကုန်ကြမ်းတန်ဖိုး
  cashRepaymentReceived?: number; // ကုန်ပစ္စည်းပေးသွင်းသူမှ လာရောက်ဆပ်ငွေ
  paymentMethod?: PaymentMethod | string;
  remainingAdvanceBalance: number; // လက်ကျန် အကြိုငွေစာရင်း
  attachmentPhotos?: string[]; // ဓာတ်ပုံ သို့မဟုတ် ပြေစာ/လက်မှတ် ပုံများ
  notes?: string;
  createdAt?: string;
}

export interface SaleRecord {
  id: string;
  voucherNo: string; // e.g. SALE-20260831-001
  merchantId: string;
  merchantName: string;
  merchantTown: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  items: SaleItem[];
  // Financial breakdown
  totalItemsCount: number;
  totalGoodsValue?: number; // ကုန်ပစ္စည်းတန်ဖိုးစုစုပေါင်း
  deliveryFee?: number; // သယ်ယူပို့ဆောင်ခ/ဂိတ်ပို့ခ
  discount?: number; // လျှော့စျေး
  grandTotal: number; // ကျသင့်ငွေစုစုပေါင်း
  previousReceivableBalance?: number; // ယခင်ရရန်ကျန်ငွေ
  cashPaidByMerchant: number; // ကုန်သည်ပေးငွေ
  paymentMethod?: PaymentMethod | string;
  remainingReceivableBalance: number; // ကုန်သည်ထံမှ ရရန်ကျန်ငွေ
  // Transport & Delivery details
  deliveryVehicle?: string; // တင်ပေးလိုက်သည့်ကား / ယာဉ်အမှတ် / ဂိတ်
  driverOrContact?: string; // ယာဉ်မောင်း / ဆက်သွယ်ရမည့်သူ
  driverPhone?: string; // ဆက်သွယ်ရမည့် ဖုန်းနံပါတ်
  attachmentPhotos?: string[]; // ကားဂိတ်ပြေစာ သို့မဟုတ် ကုန်ပစ္စည်း ပုံများ
  notes?: string;
  createdAt?: string;
}

export interface StockAdjustmentRecord {
  id: string;
  date: string;
  time: string;
  productId: string;
  productName: string;
  type: 'IN_ADJUSTMENT' | 'OUT_ADJUSTMENT' | 'DAMAGE' | 'INITIAL';
  quantity: number; // positive or negative
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  totalSuppliersVisited: number;
  totalGoodsCount: number;
  totalGoodsValue: number;
  totalAdvanceDeducted: number;
  totalNewAdvanceGiven: number;
  totalCashPaid: number;
  totalMaterialCreditGiven?: number;
  totalRepaymentReceived?: number;
  itemCounts: { [productId: string]: { name: string; count: number; unit: string; totalValue: number } };
}

export interface ShopSettings {
  shopName: string;
  tagline?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  thermalPrinterWidth?: '58mm' | '80mm';
  receiptFooterNote?: string;
  rawMaterialPresets?: RawMaterialPreset[];
}

export interface BackupReminderSettings {
  enabled: boolean;
  reminderTime: string; // HH:mm e.g. "17:30"
  lastDismissedDate?: string; // YYYY-MM-DD
  snoozedUntilTimestamp?: number; // ms timestamp
}

export interface DeletedRecord {
  id: string;
  entityType: 'SUPPLIER' | 'MERCHANT' | 'PRODUCT' | 'TRANSACTION' | 'SALE' | 'BULK_CLEAR';
  entityName: string;
  entityCode?: string;
  deletedAt: string;
  deletedDate: string; // YYYY-MM-DD
  deletedTime: string; // HH:mm
  reason?: string;
  summary: string;
  data: any;
}

export interface MerchantPurchaseRecord {
  id: string;
  purchaseNo: string; // e.g. PUR-20260904-001
  merchantId: string;
  merchantName: string;
  merchantTown: string;
  sellerPhone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  items: CollectionItem[];
  totalAmount: number;
  paidAmount: number;
  remainingPayableBalance: number;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

export interface MerchantOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  agreedPrice: number;
  unitPrice?: number;
  subtotal: number;
  unit: string;
}

export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface MerchantOrder {
  id: string;
  orderNo?: string; // e.g. ORD-20260904-001
  orderNumber?: string;
  merchantId: string;
  merchantName: string;
  merchantTown: string;
  orderDate?: string; // YYYY-MM-DD
  deliveryTargetDate?: string; // YYYY-MM-DD
  deliveryDueDate?: string;
  date?: string;
  time?: string;
  items: MerchantOrderItem[];
  totalOrderAmount?: number;
  totalEstimatedValue?: number;
  advanceDeposit?: number; // ကြိုတင်စရန်ငွေ
  status: OrderStatus;
  deliveredDate?: string;
  saleVoucherId?: string;
  destinationNote?: string; // e.g. အောင်မင်္ဂလာ အဝေးပြေးဂိတ်
  notes?: string;
  createdAt?: string;
}

export interface PeerTrader {
  id: string;
  name: string;
  shopName?: string;
  town: string;
  phone: string;
  currentBalance: number; // Positive = receivable, negative = payable
  netLentCount?: number;
  netBorrowedCount?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PeerTransactionType =
  | 'BORROW_FROM_PEER' // မိတ်ဖက်ထံမှ ကုန်ချေးယူခြင်း (Inbound stock)
  | 'LEND_TO_PEER' // မိတ်ဖက်သို့ ကုန်ချေးပေးခြင်း (Outbound stock)
  | 'RETURN_TO_PEER' // မိတ်ဖက်ထံ ကုန်ချေးပြန်ဆပ်ခြင်း (Outbound stock)
  | 'RECEIVE_RETURN_FROM_PEER' // မိတ်ဖက်ထံမှ ချေးငွေ/ကုန် ပြန်လက်ခံခြင်း (Inbound stock)
  | 'BUY_FROM_PEER' // မိတ်ဖက်ထံမှ ကုန်ဝယ်ခြင်း
  | 'SELL_TO_PEER' // မိတ်ဖက်သို့ ကုန်ရောင်းခြင်း
  | 'SETTLEMENT_CASH' // မိတ်ဖက်အချင်းချင်း ငွေရှင်းခြင်း
  | 'LEND'
  | 'BORROW';

export interface PeerTransaction {
  id: string;
  voucherNo: string;
  peerTraderId: string;
  peerTraderName: string;
  traderId?: string;
  traderName?: string;
  type: PeerTransactionType;
  date: string;
  time: string;
  items: CollectionItem[];
  totalAmount?: number;
  totalValue?: number;
  paidAmount?: number;
  cashSettled?: number;
  balanceAfter?: number;
  notes?: string;
  status?: 'ACTIVE' | 'SETTLED' | 'COMPLETED';
  createdAt: string;
}

export interface AppLockSettings {
  enabled: boolean;
  passcode: string; // e.g. "1234"
  pin?: string;
  hint?: string;
  recoveryKey: string; // Secret Password Recovery Key e.g. "SLY-9824-7361"
  recoveryQuestion?: string; // e.g. "ဆိုင်ပိုင်ရှင် အမည်"
  recoveryAnswer?: string;
  autoLockMinutes?: number;
  lastResetAt?: string;
}

export interface AutoRecoverySnapshot {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  reason: string;
  recordCounts: {
    products: number;
    suppliers: number;
    merchants: number;
    transactions: number;
    sales: number;
    stockAdjustments: number;
    orders?: number;
    peerTransactions?: number;
  };
  data: {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    stockAdjustments: StockAdjustmentRecord[];
    merchantOrders?: MerchantOrder[];
    merchantPurchases?: MerchantPurchaseRecord[];
    peerTraders?: PeerTrader[];
    peerTransactions?: PeerTransaction[];
    shopSettings: ShopSettings;
  };
}

export interface SyncPacket {
  shopId: string;
  shopName: string;
  senderDeviceId: string;
  senderDeviceName: string;
  timestamp: number;
  version: string;
  data: {
    products: Product[];
    suppliers: Supplier[];
    merchants: Merchant[];
    transactions: TransactionRecord[];
    sales: SaleRecord[];
    stockAdjustments: StockAdjustmentRecord[];
    merchantOrders?: MerchantOrder[];
    merchantPurchases?: MerchantPurchaseRecord[];
    peerTraders?: PeerTrader[];
    peerTransactions?: PeerTransaction[];
    shopSettings: ShopSettings;
  };
}

export type ActiveTab = 'daily' | 'inventory' | 'sales' | 'purchases' | 'orders' | 'peers' | 'merchants' | 'suppliers' | 'history' | 'reports' | 'backup' | 'products';

export type TabType =
  | 'daily'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'orders'
  | 'peers'
  | 'merchants'
  | 'suppliers'
  | 'history'
  | 'reports'
  | 'backup'
  | 'products'
  | 'PICKUP'
  | 'MERCHANT_SALES'
  | 'PURCHASES'
  | 'ORDERS'
  | 'PEER_TRADING'
  | 'INVENTORY'
  | 'SUPPLIERS'
  | 'MERCHANTS'
  | 'PRODUCTS'
  | 'HISTORY'
  | 'REPORTS';

export interface SoftDeletedItem {
  id: string;
  originalId: string;
  name: string;
  type: string;
  deletedAt: string;
  data: any;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  entityType?: string;
  entityId?: string;
}

export type PeerTradeStatus = 'OPEN' | 'PENDING' | 'REPAID' | 'RETRIEVED' | 'SETTLED' | string;

export interface PeerTradeRecord {
  id: string;
  tradeType: 'BORROW_IN' | 'LEND_OUT';
  date: string;
  time: string;
  peerShopName: string;
  peerLocation: string;
  merchantId?: string;
  merchantName?: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  agreedUnitPrice: number;
  totalTradeValue: number;
  status: PeerTradeStatus;
  notes?: string;
  settledDate?: string;
  settledTime?: string;
  settledType?: 'REPAID' | 'RETRIEVED' | 'CASH_SETTLED' | string;
  settledNotes?: string;
}

