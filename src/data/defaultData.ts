import { Product, Supplier, TransactionRecord, Merchant, SaleRecord, StockAdjustmentRecord, MerchantOrder, PeerTrader } from '../types';

export const DEFAULT_PRODUCTS: Product[] = [
  // ကုန်ချော (၃ မျိုး)
  { id: 'p-1', name: 'ယွန်း ကွမ်းအစ် (အကြီး)', defaultPrice: 4500, defaultWholesalePrice: 5300, unit: 'ထည်', category: 'ကုန်ချော', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-2', name: 'ယွန်း ကွမ်းအစ် (အသေး)', defaultPrice: 2800, defaultWholesalePrice: 3400, unit: 'ထည်', category: 'ကုန်ချော', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-3', name: 'ယွန်း ဆွမ်းအုပ် (အလတ်)', defaultPrice: 3500, defaultWholesalePrice: 4300, unit: 'ထည်', category: 'ကုန်ချော', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  // ဝါးထည် (၃ မျိုး)
  { id: 'p-4', name: 'ဝါးခမောက် (ရိုးရိုး)', defaultPrice: 2200, defaultWholesalePrice: 2800, unit: 'လုံး', category: 'ဝါးထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-5', name: 'ဝါးဗန်း (အချော)', defaultPrice: 3000, defaultWholesalePrice: 3800, unit: 'ချပ်', category: 'ဝါးထည်', openingStock: 0, currentStock: 0, minStockAlert: 12, active: true },
  { id: 'p-6', name: 'ဝါးနှီးခြင်း (အကြီး)', defaultPrice: 3800, defaultWholesalePrice: 4600, unit: 'လုံး', category: 'ဝါးထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  // ကြိမ်ထည် (၃ မျိုး)
  { id: 'p-7', name: 'ကြိမ်တောင်း (လက်ကိုင်ပါ)', defaultPrice: 6000, defaultWholesalePrice: 7400, unit: 'လုံး', category: 'ကြိမ်ထည်', openingStock: 0, currentStock: 0, minStockAlert: 10, active: true },
  { id: 'p-8', name: 'ကြိမ်ဗန်း (အဝိုင်း)', defaultPrice: 3800, defaultWholesalePrice: 4600, unit: 'ချပ်', category: 'ကြိမ်ထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-9', name: 'ကြိမ်ခုံ (အလှ)', defaultPrice: 7500, defaultWholesalePrice: 9000, unit: 'လုံး', category: 'ကြိမ်ထည်', openingStock: 0, currentStock: 0, minStockAlert: 10, active: true },
  // ကုန်ကြမ်း (ဝါး) (၂ မျိုး)
  { id: 'p-10', name: 'ဝါးနှီးလိပ် (ကုန်ကြမ်း)', defaultPrice: 1500, defaultWholesalePrice: 2000, unit: 'လိပ်', category: 'ကုန်ကြမ်း (ဝါး)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
  { id: 'p-11', name: 'ဝါးပိုးဝါးချောင်း (ကုန်ကြမ်း)', defaultPrice: 1200, defaultWholesalePrice: 1600, unit: 'ချောင်း', category: 'ကုန်ကြမ်း (ဝါး)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
  // ကုန်ကြမ်း (ကြိမ်) (၂ မျိုး)
  { id: 'p-12', name: 'ကြိမ်လုံးစည်း (ကုန်ကြမ်း)', defaultPrice: 2500, defaultWholesalePrice: 3200, unit: 'စည်း', category: 'ကုန်ကြမ်း (ကြိမ်)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
  { id: 'p-13', name: 'ကြိမ်ကြိုးလိပ် (ကုန်ကြမ်း)', defaultPrice: 1000, defaultWholesalePrice: 1400, unit: 'လိပ်', category: 'ကုန်ကြမ်း (ကြိမ်)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 's-1',
    code: 'S-001',
    name: 'ဦးဘတင်',
    phone: '09-450123456',
    village: 'ကျောက်ပန်းတောင်းရွာ',
    notes: 'ကွမ်းအစ် အဓိက ပေးသွင်းသူ',
    initialAdvance: 0,
    currentAdvanceBalance: 0,
    totalGoodsValueDelivered: 0,
    totalAdvanceGiven: 0,
    createdAt: '2026-08-01',
    updatedAt: '2026-08-31',
  },
  {
    id: 's-2',
    code: 'S-002',
    name: 'ဒေါ်သန်းခင်',
    phone: '09-250987654',
    village: 'ပလင်းရွာ',
    notes: 'ဆွမ်းအုပ် နှင့် ဗန်းရက်သူ',
    initialAdvance: 0,
    currentAdvanceBalance: 0,
    totalGoodsValueDelivered: 0,
    totalAdvanceGiven: 0,
    createdAt: '2026-08-02',
    updatedAt: '2026-08-31',
  },
  {
    id: 's-3',
    code: 'S-003',
    name: 'ကိုအောင်မျိုး',
    phone: '09-790112233',
    village: 'အင်ကြင်းကုန်း',
    notes: 'ဝါးခမောက် ရက်သူ',
    initialAdvance: 0,
    currentAdvanceBalance: 0,
    totalGoodsValueDelivered: 0,
    totalAdvanceGiven: 0,
    createdAt: '2026-08-05',
    updatedAt: '2026-08-31',
  },
];

export const INITIAL_MERCHANTS: Merchant[] = [
  {
    id: 'm-1',
    code: 'M-001',
    name: 'ရွှေမန္တလေး ယွန်းဆိုင်',
    town: 'မန္တလေး',
    phone: '09-250112233',
    address: '၇၈ လမ်း၊ မန္တလေး',
    ownerOrContact: 'ဒေါ်နွယ်နွယ်ဝင်း (ဆိုင်ပိုင်ရှင်)',
    notes: 'လစဥ်ပုံမှန် ကွမ်းအစ် အော်ဒါရှိ',
    currentReceivableBalance: 0,
    totalPurchasesValue: 0,
    totalPaidAmount: 0,
    createdAt: '2026-08-01',
    updatedAt: '2026-08-31',
  },
  {
    id: 'm-2',
    code: 'M-002',
    name: 'ပုဂံရတနာ အမှတ်တရဆိုင်',
    town: 'ပုဂံ',
    phone: '09-450334455',
    address: 'သီရိပစ္စယာလမ်း၊ ပုဂံမြို့သစ်',
    ownerOrContact: 'ဦးကျော်ဇင် (မန်နေဂျာ)',
    notes: 'ငွေရှင်းတိကျသူ',
    currentReceivableBalance: 0,
    totalPurchasesValue: 0,
    totalPaidAmount: 0,
    createdAt: '2026-08-03',
    updatedAt: '2026-08-31',
  },
  {
    id: 'm-3',
    code: 'M-003',
    name: 'ရန်ကုန် ရိုးရာလက်မှုတိုက်',
    town: 'ရန်ကုန်',
    phone: '09-790556677',
    address: 'ဗိုလ်ချုပ်စျေး၊ ရန်ကုန်',
    ownerOrContact: 'ဒေါ်အေးအေးသင်း',
    notes: 'အဝေးပြေးဂိတ်မှ ပစ္စည်းပို့ရန်',
    currentReceivableBalance: 0,
    totalPurchasesValue: 0,
    totalPaidAmount: 0,
    createdAt: '2026-08-04',
    updatedAt: '2026-08-31',
  },
];

export const INITIAL_TRANSACTIONS: TransactionRecord[] = [];

export const INITIAL_SALES: SaleRecord[] = [];

export const INITIAL_STOCK_ADJUSTMENTS: StockAdjustmentRecord[] = [];

export const INITIAL_MERCHANT_ORDERS: MerchantOrder[] = [];

export const INITIAL_PEER_TRADERS: PeerTrader[] = [];

export function generate100SampleSuppliers(): Supplier[] {
  return [];
}
