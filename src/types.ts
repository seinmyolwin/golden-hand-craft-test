export type CategoryDomain = 'FINISHED_GOODS' | 'RAW_MATERIAL';

export interface MasterDataCategory {
  id: string;
  name: string;
  domain: CategoryDomain;
  active: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  code?: string; // P-001, P-XL-002 etc.
  name: string;
  defaultPrice: number; // Procurement / Buy Price in MMK
  defaultWholesalePrice?: number; // Wholesale selling price in MMK
  unit: string; // e.g. ထည်, ချပ်, လုံး
  category: string;
  categoryId?: string;
  openingStock?: number; // Starting inventory count
  currentStock?: number; // Real-time available stock
  minStockAlert?: number; // Low stock alert threshold
  avgCostPrice?: number; // Weighted average unit cost price in MMK
  costPrice?: number; // Cost unit price
  isUserCreated?: boolean; // Added manually/via import during Go-Live setup
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  revision?: number;
}

export interface Supplier {
  id: string;
  code?: string; // S-001, S-002 etc.
  name: string;
  phone: string;
  village: string; // ကျေးရွာ
  notes?: string;
  initialAdvance?: number; // Initial opening advance balance
  currentAdvanceBalance?: number; // Current remaining advance/debt owed by supplier
  advanceBalance?: number;
  payableBalance?: number; // ပေးရန်ကျန်
  totalAdvanceDeducted?: number;
  active?: boolean;
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
  code?: string; // M-001, M-002 etc.
  name: string; // e.g. ရွှေမန္တလေး ယွန်းဆိုင်
  town: string; // e.g. မန္တလေး, ရန်ကုန်, ပုဂံ
  phone: string;
  address?: string;
  ownerOrContact?: string; // ပိုင်ရှင် သို့မဟုတ် ဆက်သွယ်ရမည့်သူ
  contactPerson?: string;
  notes?: string;
  role?: MerchantRole; // 'BUYER' (ဝယ်ယူသူ), 'SUPPLIER' (ကုန်ကြမ်းရောင်းသူ), 'BOTH' (နှစ်မျိုးလုံး)
  currentReceivableBalance?: number; // Remaining debt/receivable owed by merchant to business
  receivableBalance?: number;
  payableBalance?: number; // လုပ်ငန်းမှ ကုန်သည်သို့ ပေးရန်ကျန်
  totalPurchasesValue?: number; // Cumulative goods sold to merchant
  totalPaidAmount?: number; // Cumulative total payment made by merchant
  totalPurchasedFromMerchant?: number; // ကုန်သည်ထံမှ ဝယ်ယူခဲ့သော ကုန်ကြမ်းတန်ဖိုး
  active?: boolean;
  auditEntry?: AuditLogEntry;
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

export interface RawMaterialStockStat {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  defaultUnit: string;
  unitPrice: number;
  totalInflow: number; // Purchased from merchants / suppliers
  totalOutflow: number; // Issued to suppliers as advance + sold directly
  currentStock: number; // Inflow - Outflow
  estimatedValuation: number; // currentStock * unitPrice
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
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
  supplierPhone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type?: 'COLLECTION_AND_SETTLEMENT' | 'ADVANCE_ONLY' | 'CASH_PAYMENT_ONLY' | 'RAW_MATERIAL_CREDIT' | 'SUPPLIER_REPAYMENT' | string;
  items: CollectionItem[]; // Finished goods collected OR raw material items sold
  // Financial calculation breakdown
  totalGoodsValue?: number; // ပေးသွင်းကုန်ပစ္စည်းတန်ဖိုး
  totalAmount?: number;
  previousAdvanceBalance?: number; // ယခင်အကြိုငွေကျန်
  advanceDeducted?: number; // အကြိုငွေမှ နုတ်ယူငွေ
  cashPaidToSupplier?: number; // အပိုပေးငွေ
  netCashPaidToSupplier?: number;
  newAdvanceTaken?: number; // အကြိုငွေအသစ် ထုတ်ယူငွေ
  newAdvanceReason?: string; // အကြိုငွေယူရသည့် အကြောင်းပြချက်
  // Raw material credits & repayments
  materialItems?: CollectionItem[]; // ကုန်ကြမ်းပစ္စည်းများ
  rawMaterialItems?: RawMaterialItem[];
  rawMaterialDeductions?: any[];
  rawMaterialDeductionTotal?: number;
  materialTotalValue?: number; // ကုန်ကြမ်းတန်ဖိုး
  cashRepaymentReceived?: number; // ကုန်ပစ္စည်းပေးသွင်းသူမှ လာရောက်ဆပ်ငွေ
  paidAmount?: number;
  netPayable?: number;
  paymentMethod?: PaymentMethod | string;
  remainingAdvanceBalance?: number; // လက်ကျန် အကြိုငွေစာရင်း
  attachmentPhotos?: string[]; // ဓာတ်ပုံ သို့မဟုတ် ပြေစာ/လက်မှတ် ပုံများ
  notes?: string;
  status?: 'COMPLETED' | 'CANCELLED' | string;
  cancellationReason?: string;
  cancelledAt?: string;
  idempotencyKey?: string;
  createdAt?: string;
  updatedAt?: string;
  revision?: number;
  auditEntry?: AuditLogEntry;
}

export interface SaleRecord {
  id: string;
  voucherNo: string; // e.g. SALE-20260831-001
  type?: 'RETAIL' | 'WHOLESALE' | 'MERCHANT' | string;
  merchantId?: string;
  merchantName?: string;
  merchantTown?: string;
  merchantPhone?: string;
  customerName?: string;
  customerPhone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  items: SaleItem[];
  // Financial breakdown
  totalItemsCount?: number;
  totalGoodsValue?: number; // ကုန်ပစ္စည်းတန်ဖိုးစုစုပေါင်း
  totalAmount?: number;
  subtotal?: number;
  deliveryFee?: number; // သယ်ယူပို့ဆောင်ခ/ဂိတ်ပို့ခ
  discount?: number; // လျှော့စျေး
  grandTotal?: number; // ကျသင့်ငွေစုစုပေါင်း
  previousReceivableBalance?: number; // ယခင်ရရန်ကျန်ငွေ
  cashPaidByMerchant?: number; // ကုန်သည်ပေးငွေ
  paidAmount?: number;
  paymentMethod?: PaymentMethod | string;
  paymentType?: PaymentMethod | string;
  remainingReceivableBalance?: number; // ကုန်သည်ထံမှ ရရန်ကျန်ငွေ
  remainingReceivable?: number;
  balance?: number;
  // Transport & Delivery details
  deliveryVehicle?: string; // တင်ပေးလိုက်သည့်ကား / ယာဉ်အမှတ် / ဂိတ်
  driverOrContact?: string; // ယာဉ်မောင်း / ဆက်သွယ်ရမည့်သူ
  driverPhone?: string; // ဆက်သွယ်ရမည့် ဖုန်းနံပါတ်
  attachmentPhotos?: string[]; // ကားဂိတ်ပြေစာ သို့မဟုတ် ကုန်ပစ္စည်း ပုံများ
  notes?: string;
  status?: 'COMPLETED' | 'CANCELLED' | string;
  cancellationReason?: string;
  cancelledAt?: string;
  idempotencyKey?: string;
  createdAt?: string;
  updatedAt?: string;
  revision?: number;
  auditEntry?: AuditLogEntry;
}

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
  | 'PURCHASE_CANCELLED_REVERSAL'
  | 'SALES_RETURN_INBOUND'
  | 'PURCHASE_RETURN_OUTBOUND'
  | 'SALES_RETURN_CANCELLED_REVERSAL'
  | 'PURCHASE_RETURN_CANCELLED_REVERSAL';

export interface StockMovementRecord {
  id: string;
  productId: string;
  productName: string;
  movementType: StockMovementType;
  quantity: number; // Positive magnitude
  direction: 'IN' | 'OUT' | 'ADJUST' | 'INITIAL';
  signedQuantity: number; // positive for in, negative for out
  referenceType: 'OPENING' | 'TRANSACTION' | 'SALE' | 'PURCHASE' | 'PEER_TRADE' | 'STOCK_ADJUSTMENT' | 'MANUAL';
  referenceId: string;
  referenceVoucherNo?: string;
  counterpartName?: string;
  unit?: string;
  unitPrice?: number;
  totalValue?: number;
  transactionDate: string; // YYYY-MM-DD
  transactionTime?: string; // HH:mm
  createdAt: string; // ISO string
  reason?: string;
  notes?: string;
  reversalOf?: string; // ID of original stock movement if this is a reversal
  status: 'COMPLETED' | 'CANCELLED' | 'REVERSED';
  idempotencyKey: string;
  schemaVersion: number;
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
  status?: 'COMPLETED' | 'CANCELLED' | string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt?: string;
  revision?: number;
  auditEntry?: AuditLogEntry;
}

export type CashMovementType =
  | 'OPENING_FLOAT'
  | 'SALE_PAYMENT_IN'
  | 'SUPPLIER_PAYOUT'
  | 'SUPPLIER_ADVANCE_GIVEN'
  | 'SUPPLIER_REPAYMENT_IN'
  | 'MERCHANT_PURCHASE_PAYOUT'
  | 'MERCHANT_DEBT_COLLECTION_IN'
  | 'EXPENSE_PAYOUT'
  | 'INCOME_IN'
  | 'DIRECT_CASH_IN'
  | 'DIRECT_CASH_OUT'
  | 'SALE_CANCELLED_CASH_REVERSAL'
  | 'TRANSACTION_CANCELLED_CASH_REVERSAL'
  | 'PURCHASE_CANCELLED_CASH_REVERSAL'
  | 'MANUAL_CASH_ADJUSTMENT'
  | 'DAILY_CLOSING_CORRECTION'
  | 'SALES_RETURN_REFUND_OUT'
  | 'PURCHASE_RETURN_RECOVERY_IN'
  | 'SALES_RETURN_CANCELLED_CASH_REVERSAL'
  | 'PURCHASE_RETURN_CANCELLED_CASH_REVERSAL';

export type CashReferenceType =
  | 'SALE'
  | 'TRANSACTION'
  | 'PURCHASE'
  | 'MERCHANT_PAYMENT'
  | 'SUPPLIER_ADVANCE'
  | 'EXPENSE'
  | 'INCOME'
  | 'DIRECT'
  | 'MANUAL_ADJUSTMENT'
  | 'DAILY_CLOSING'
  | 'DAILY_CLOSING_CORRECTION'
  | 'RETURN'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'OPENING';

export interface CashMovementRecord {
  id: string;
  amount: number; // Positive magnitude
  direction: 'IN' | 'OUT';
  signedAmount: number; // Positive for IN (+), negative for OUT (-)
  type: CashMovementType;
  typeLabelMy?: string;
  referenceType: CashReferenceType;
  referenceId: string;
  referenceVoucherNo?: string;
  counterpartName?: string;
  paymentMethod?: PaymentMethod | string;
  category?: string;
  description: string;
  transactionDate: string; // YYYY-MM-DD
  transactionTime?: string; // HH:mm
  notes?: string;
  reversalOf?: string; // ID of original cash movement if this is a reversal
  status: 'COMPLETED' | 'CANCELLED' | 'REVERSED';
  idempotencyKey: string;
  schemaVersion: number;
  createdAt: string; // ISO string
}

export interface DailyClosingRecord {
  id: string; // e.g. closing_2026-09-10
  closingDate: string; // YYYY-MM-DD
  openingCash: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedClosingCash: number; // openingCash + totalCashIn - totalCashOut
  actualCountedCash: number;
  difference: number; // actualCountedCash - expectedClosingCash (0 = balanced)
  breakdown?: {
    salesCash?: number;
    debtCollectionCash?: number;
    otherIncomeCash?: number;
    supplierCashPayout?: number;
    supplierAdvanceCash?: number;
    purchaseCashPayout?: number;
    expensesCash?: number;
    reversalsNet?: number;
    directCashNet?: number;
  };
  notes?: string;
  status: 'CLOSED' | 'REOPENED_ADJUSTED';
  closedAt: string; // ISO string
  closedBy?: string;
  deviceId?: string;
  correctionReason?: string;
  correctedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CashLedgerEntry {
  id: string;
  transactionDate: string;
  transactionTime: string;
  timestamp: number;
  type: CashMovementType;
  typeLabelMy: string;
  direction: 'IN' | 'OUT';
  amount: number; // Positive magnitude
  signedAmount: number; // Positive for IN, negative for OUT
  previousBalance: number;
  balanceAfter: number;
  referenceType: CashReferenceType;
  referenceId: string;
  referenceVoucherNo?: string;
  counterpartName?: string;
  paymentMethod?: string;
  category?: string;
  description: string;
  notes?: string;
  status: 'COMPLETED' | 'CANCELLED' | 'REVERSED';
  idempotencyKey: string;
}

export interface DailyCashSummary {
  date: string;
  openingCash: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashFlow: number; // totalCashIn - totalCashOut
  expectedClosingCash: number;
  actualCountedCash?: number;
  difference?: number;
  isClosed: boolean;
  closingRecord?: DailyClosingRecord;
  entriesCount: number;
  entries: CashLedgerEntry[];
}

export interface CashLedgerFilterOptions {
  startDate?: string;
  endDate?: string;
  typeFilter?: 'ALL' | 'IN' | 'OUT' | CashMovementType;
  paymentMethodFilter?: string;
  searchQuery?: string;
}

export interface CashLedgerSummary {
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashFlow: number;
  closingBalance: number;
  totalEntriesCount: number;
  entries: CashLedgerEntry[];
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

export type NotificationSoundTheme = 'BELL' | 'CHIME' | 'DIGITAL' | string;

export interface ShopSettings {
  shopName: string;
  tagline?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  branchCode?: string;
  branchName?: string;
  defaultLandingTab?: string;
  soundEnabled?: boolean;
  soundTheme?: NotificationSoundTheme;
  isLiveConfirmed?: boolean;
  hideSampleDataButtons?: boolean;
  thermalPrinterWidth?: '58mm' | '80mm';
  receiptFooterNote?: string;
  rawMaterialPresets?: RawMaterialPreset[];
  staffAllowedTabs?: ActiveTab[];
  auditRetentionPeriod?: '10_DAYS' | '3_MONTHS' | '4_MONTHS' | '5_MONTHS' | '1_YEAR' | 'FOREVER';
}

// ============================================================================
// Phase 18A: Business Initialization & Opening Position Types
// ============================================================================

export type InitializationState =
  | 'NOT_INITIALIZED'
  | 'SETUP_IN_PROGRESS'
  | 'READY_FOR_CONFIRMATION'
  | 'ACTIVE';

export interface OpeningCashPosition {
  cashAmount: number; // MMK in hand
  bankAmount?: number; // MMK in bank
  notes?: string;
}

export interface OpeningReceivablePosition {
  merchantId: string;
  merchantName: string;
  merchantTown?: string;
  amount: number; // MMK merchant owes business
  notes?: string;
}

export interface OpeningPayablePosition {
  counterpartId?: string;
  supplierId?: string;
  supplierName?: string;
  merchantId?: string;
  merchantName?: string;
  counterpartName: string;
  amount: number; // MMK business owes counterpart
  notes?: string;
}

export interface OpeningAdvancePosition {
  type: 'SUPPLIER_ADVANCE' | 'MERCHANT_ADVANCE' | 'WORKER_ADVANCE' | 'OTHER_ADVANCE';
  counterpartId?: string;
  counterpartName: string;
  amount: number; // Cash advance
  notes?: string;
}

export interface OpeningRawMaterialPosition {
  id?: string;
  presetId?: string;
  category?: string;
  name: string; // e.g. "ဝါး", "ကြိမ်"
  unit: string;
  quantity: number;
  unitPrice: number;
  totalValue: number; // quantity * unitPrice
  notes?: string;
}

export interface OpeningFinishedGoodsPosition {
  productId: string;
  productName: string;
  category?: string;
  unit: string;
  quantity: number;
  unitPrice: number; // Valuation price
  totalValue: number; // quantity * unitPrice
  notes?: string;
}

export interface OpeningIssuedMaterialPosition {
  workerId?: string;
  workerName: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  totalValue?: number;
  cashAdvance?: number; // Cash advance given with materials
  notes?: string;
}

export interface OpeningPosition {
  cash: OpeningCashPosition;
  receivables: OpeningReceivablePosition[];
  payables: OpeningPayablePosition[];
  advances: OpeningAdvancePosition[];
  rawMaterials: OpeningRawMaterialPosition[];
  finishedGoods: OpeningFinishedGoodsPosition[];
  issuedMaterials: OpeningIssuedMaterialPosition[];
  openingCapital: number; // Total opening capital / equity position in MMK
  notes?: string;
}

export interface BusinessInitializationRecord {
  id: string; // 'current_business'
  state: InitializationState;
  businessName: string;
  tagline?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  businessType?: string;
  accountingStartDate: string; // YYYY-MM-DD
  activationTimestamp?: string; // ISO string
  activationDate?: string; // YYYY-MM-DD
  operationId?: string; // Idempotency key
  openingPosition: OpeningPosition;
  createdAt: string;
  updatedAt: string;
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
  status?: 'COMPLETED' | 'CANCELLED' | string;
  cancellationReason?: string;
  cancelledAt?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt?: string;
  revision?: number;
  auditEntry?: AuditLogEntry;
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
  auditEntry?: AuditLogEntry;
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
  // Cryptographic Verifier Material (PBKDF2-SHA256 salted hashes)
  pinSalt?: string;
  pinHash?: string;
  recoverySalt?: string;
  recoveryHash?: string;
  recoveryKeyDisplay?: string;
  isPinInitialized?: boolean;
  // Legacy fields (for migration only, removed once migrated)
  passcode?: string;
  pin?: string;
  recoveryKey?: string;
  hint?: string;
  recoveryQuestion?: string;
  recoveryAnswer?: string;
  // Lockout and Session Behavior
  autoLockMinutes?: number; // 0 = immediate/blur, 1 = 1min, 5 = 5mins, 15 = 15mins, 30 = 30mins, -1 = never
  lockOnStartup?: boolean;
  failedAttempts?: number;
  lockedUntilTimestamp?: number; // Epoch ms timestamp for exponential lockout
  lastUnlockedAt?: string;
  lastResetAt?: string;
}

// ============================================================================
// Phase 16: Returns, Refunds & Reversal Types
// ============================================================================

export type ReturnType = 'SALES_RETURN' | 'PURCHASE_RETURN';
export type ReturnStatus = 'COMPLETED' | 'CANCELLED';

export interface ReturnItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  reason?: string;
}

export interface ReturnRecord {
  id: string;
  returnNo: string; // e.g. RET-20260911-001 or PRET-20260911-001
  type: ReturnType;
  referenceType: 'SALE' | 'PURCHASE' | 'TRANSACTION';
  referenceId: string;
  referenceVoucherNo: string;
  merchantId?: string;
  merchantName?: string;
  supplierId?: string;
  supplierName?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  items: ReturnItem[];
  totalReturnAmount: number;
  cashRefundAmount: number;
  creditAdjustmentAmount: number;
  refundPaymentMethod?: PaymentMethod | string;
  reason?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  idempotencyKey: string;
  status: ReturnStatus;
  schemaVersion: number;
  createdAt: string;
  updatedAt?: string;
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
    peerTrades?: number;
    peerTransactions?: number;
    stockMovements?: number;
    cashMovements?: number;
    dailyClosings?: number;
    returnsAndRefunds?: number;
    auditLogs?: number;
    softDeletedItems?: number;
    attachments?: number;
    rawMaterialPresets?: number;
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
    peerTrades?: PeerTradeRecord[];
    shopSettings: ShopSettings;
    stockMovements?: StockMovementRecord[];
    cashMovements?: CashMovementRecord[];
    dailyClosings?: DailyClosingRecord[];
    returnsAndRefunds?: ReturnRecord[];
    auditLogs?: AuditLogEntry[];
    softDeletedItems?: SoftDeletedItem[];
    attachments?: AttachmentRecord[];
    rawMaterialPresets?: RawMaterialPreset[];
    rbacUsers?: AppUser[];
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

export type ActiveTab = 'daily' | 'inventory' | 'sales' | 'purchases' | 'orders' | 'peers' | 'merchants' | 'suppliers' | 'history' | 'reports' | 'backup' | 'products' | 'retail';

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
  | 'retail'
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
  | 'REPORTS'
  | 'RETAIL';

export type SoftDeletedEntityType =
  | 'PRODUCT'
  | 'SUPPLIER'
  | 'MERCHANT'
  | 'TRANSACTION'
  | 'SALE'
  | 'PURCHASE'
  | 'ORDER'
  | 'PEER_TRADE'
  | string;

export interface SoftDeletedItem {
  id: string;
  originalId: string;
  name: string;
  type: SoftDeletedEntityType | 'TRANSACTION' | 'SALE' | string;
  deletedAt: string;
  reason?: string;
  data: any;
  auditEntry?: AuditLogEntry;
}

export type AuditActionType =
  | 'SALE'
  | 'PURCHASE'
  | 'STOCK_MOVEMENT'
  | 'CASH_MOVEMENT'
  | 'RETURN'
  | 'REFUND'
  | 'REVERSAL'
  | 'DAILY_CLOSING'
  | 'DAILY_CLOSING_CORRECTION'
  | 'PRODUCT_CHANGE'
  | 'MASTER_DATA_CHANGE'
  | 'DATABASE_REPAIR'
  | 'DATABASE_RECOVERY'
  | 'BACKUP_RESTORE'
  | 'SYSTEM_ACTION'
  | string;

export interface AuditLogEntry {
  id: string;
  action: string;
  actionType?: AuditActionType;
  details: string;
  description?: string;
  timestamp: string;
  entityType?: string;
  entityId?: string;
  referenceType?: string;
  referenceId?: string;
  referenceVoucherNo?: string;
  amount?: number;
  quantity?: number;
  metadata?: Record<string, any>;
  performer?: string;
  createdAt?: string;
  schemaVersion?: number;
}

export type PeerTradeStatus = 'OPEN' | 'PENDING' | 'REPAID' | 'RETRIEVED' | 'SETTLED' | string;

export interface PeerTradeItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  agreedUnitPrice: number;
  subtotal: number;
}

export interface PeerTradeRecord {
  id: string;
  voucherNo?: string;
  tradeType: 'BORROW_IN' | 'LEND_OUT';
  date: string;
  time: string;
  peerShopName: string;
  peerTraderName?: string;
  peerLocation?: string;
  merchantId?: string;
  merchantName?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  agreedUnitPrice?: number;
  items?: PeerTradeItem[];
  totalTradeValue?: number;
  status: PeerTradeStatus;
  notes?: string;
  settledDate?: string;
  settledTime?: string;
  settledType?: 'REPAID' | 'RETRIEVED' | 'CASH_SETTLED' | string;
  settledNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  auditEntry?: AuditLogEntry;
}

export interface SettingRecord {
  key: string;
  value: any;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  voucherId: string;
  ownerId?: string;
  blob?: Blob;
  thumbnail?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  caption?: string;
  createdAt: string;
  imageBase64?: string;
}

export interface BackupMetadata {
  shopName: string;
  shopOwner?: string;
  appName: string;
  totalRecords: number;
  counts: {
    products: number;
    suppliers: number;
    merchants: number;
    transactions: number;
    sales: number;
    merchantPurchases: number;
    orders: number;
    stockAdjustments: number;
    peerTrades: number;
    softDeletedItems: number;
    auditLogs: number;
    rawMaterialPresets: number;
    attachments?: number;
    stockMovements?: number;
    cashMovements?: number;
    dailyClosings?: number;
    returnsAndRefunds?: number;
  };
  dateRange?: {
    earliest: string;
    latest: string;
  };
  customNotes?: string;
}

export interface BackupDataPayload {
  products: Product[];
  suppliers: Supplier[];
  merchants: Merchant[];
  transactions: TransactionRecord[];
  sales: SaleRecord[];
  merchantPurchases: MerchantPurchaseRecord[];
  orders: MerchantOrder[];
  stockAdjustments: StockAdjustmentRecord[];
  peerTrades: PeerTradeRecord[];
  softDeletedItems: SoftDeletedItem[];
  auditLogs: AuditLogEntry[];
  rawMaterialPresets: RawMaterialPreset[];
  stockMovements?: StockMovementRecord[];
  cashMovements?: CashMovementRecord[];
  dailyClosings?: DailyClosingRecord[];
  returnsAndRefunds?: ReturnRecord[];
  shopSettings: ShopSettings;
  businessInitialization?: BusinessInitializationRecord;
  appLockSettings?: AppLockSettings;
  backupReminderSettings?: BackupReminderSettings;
  productCategories?: string[];
  rawMaterialCategories?: string[];
  masterDataCategories?: MasterDataCategory[];
  attachments?: AttachmentRecord[];
  rbacUsers?: AppUser[];
  rbac_users?: AppUser[];
}

export interface VersionedBackupFile {
  formatVersion: '3.0' | '2.0' | '1.0' | string;
  appVersion: string;
  exportedAt: string;
  databaseSchemaVersion: number;
  checksum?: string;
  metadata: BackupMetadata;
  data: BackupDataPayload;
}

export interface BackupValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'ERROR' | 'FATAL';
}

export interface BackupValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface EntityComparisonCount {
  inBackup: number;
  inCurrentDb: number;
  toAdd: number;
  toUpdate: number;
  toPreserve: number;
}

export interface BackupValidationReport {
  isValid: boolean;
  isCorrupted: boolean;
  isEncrypted?: boolean;
  rawEncryptedPayload?: any;
  formatVersion: string;
  detectedSchemaVersion: number;
  checksumValid: boolean;
  exportedAt: string;
  shopName: string;
  appName: string;
  totalRecords: number;
  errors: BackupValidationError[];
  warnings: BackupValidationWarning[];
  counts: BackupMetadata['counts'];
  dateRange?: { earliest: string; latest: string };
  comparison?: {
    products: EntityComparisonCount;
    suppliers: EntityComparisonCount;
    merchants: EntityComparisonCount;
    transactions: EntityComparisonCount;
    sales: EntityComparisonCount;
    orders: EntityComparisonCount;
    returnsAndRefunds?: EntityComparisonCount;
  };
  normalizedData?: BackupDataPayload;
}

export type HealthCheckSeverity = 'PASS' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export type HealthCheckCategory =
  | 'DATABASE'
  | 'DATA_INTEGRITY'
  | 'REFERENCES'
  | 'FINANCIAL'
  | 'STOCK'
  | 'ATTACHMENTS'
  | 'BACKUP'
  | 'AUDIT_TRAIL';

export type HealthOverallStatus = 'HEALTHY' | 'ATTENTION' | 'DEGRADED' | 'CRITICAL';

export interface HealthCheckResult {
  id: string;
  category: HealthCheckCategory;
  severity: HealthCheckSeverity;
  code: string;
  title: string;
  message: string;
  entity?: string;
  recordId?: string;
  relatedRecordIds?: string[];
  details?: string | Record<string, any>;
  detectedAt: string;
}

export interface StorageEstimateInfo {
  usageBytes?: number;
  quotaBytes?: number;
  usageFormatted?: string;
  quotaFormatted?: string;
}

export interface DatabaseHealthReport {
  appVersion: string;
  databaseName: string;
  databaseSchemaVersion: number;
  generatedAt: string;
  durationMs: number;
  overallStatus: HealthOverallStatus;
  totalChecks: number;
  passedChecks: number;
  infoCount: number;
  warningCount: number;
  errorCount: number;
  criticalCount: number;
  tableCounts: Record<string, number>;
  storageEstimate?: StorageEstimateInfo;
  summaryByCategory: Record<
    HealthCheckCategory,
    {
      total: number;
      pass: number;
      info: number;
      warn: number;
      error: number;
      critical: number;
    }
  >;
  results: HealthCheckResult[];
}

// ============================================================================
// Phase 13: Safe Database Repair & Recovery Types
// ============================================================================

export type RepairSafetyLevel = 'LEVEL_A' | 'LEVEL_B' | 'LEVEL_C';

export type RepairStatus =
  | 'PREVIEW'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'REJECTED';

export type RepairType =
  | 'REASSIGN_BROKEN_SUPPLIER_REF'
  | 'REASSIGN_BROKEN_MERCHANT_REF'
  | 'REASSIGN_BROKEN_PRODUCT_REF'
  | 'DELETE_ORPHAN_ATTACHMENT'
  | 'REASSIGN_ORPHAN_ATTACHMENT'
  | 'REMOVE_BROKEN_ATTACHMENT_REF'
  | 'RESTORE_MISSING_UNIT'
  | 'NORMALIZE_MERCHANT_ROLE'
  | 'REPAIR_CORRUPT_BACKUP_METADATA'
  | 'DELETE_PAYLOADLESS_ATTACHMENT'
  | 'MANUAL_REVIEW_ONLY';

export interface RepairAction {
  repairId: string;
  repairType: RepairType;
  targetEntity: string;
  targetRecordId: string;
  affectedRecordIds: string[];
  reason: string;
  diagnosticCode: string;
  beforeSnapshot: Record<string, any>;
  proposedAfterSnapshot: Record<string, any>;
  safetyLevel: RepairSafetyLevel;
  createdAt: string;
  status: RepairStatus;
  selectedOption?: string;
  error?: string;
  backupId?: string;
}

export interface RepairAuditDetails {
  repairId: string;
  repairType: RepairType;
  entity: string;
  recordId: string;
  affectedRecords: string[];
  beforeSummary: Record<string, any>;
  afterSummary: Record<string, any>;
  reason: string;
  diagnosticCode: string;
  result: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  backupId?: string;
  appVersion: string;
}

export interface RepairCapability {
  code: string;
  title: string;
  repairAvailable: boolean;
  safetyLevel: RepairSafetyLevel;
  isAutomatic: boolean;
  requiresUserConfirmation: boolean;
  description: string;
}

// ============================================================================
// Phase 18C: RBAC & Financial Operation Authorization Types
// ============================================================================

export type UserRole = 'OWNER' | 'USER';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  pinSalt?: string;
  pinHash?: string;
  isActive: boolean;
  allowedTabs?: ActiveTab[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  allowedTabs?: ActiveTab[];
  loginTimestamp: string;
  sessionToken?: string;
  token?: string;
}

export type PermissionAction =
  | 'ACCESS_SETTINGS'
  | 'ACCESS_AUDIT_HISTORY'
  | 'MANAGE_MASTER_DATA'
  | 'DELETE_MASTER_DATA'
  | 'VOID_TRANSACTION'
  | 'DELETE_FINANCIAL_RECORD'
  | 'STOCK_TRANSFER'
  | 'STOCK_ADJUSTMENT'
  | 'CASH_ADJUSTMENT'
  | 'DAILY_CLOSING_CORRECTION'
  | 'PROCESS_RETURN_REFUND'
  | 'BACKUP_EXPORT'
  | 'BACKUP_RESTORE'
  | 'BUSINESS_INITIALIZATION'
  | 'DATABASE_REPAIR'
  | 'CLEAR_DATABASE'
  | 'MANAGE_USERS'
  | 'OPERATIONAL_DATA_ENTRY';


