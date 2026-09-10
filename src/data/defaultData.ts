import { Product, Supplier, TransactionRecord, Merchant, SaleRecord, StockAdjustmentRecord, MerchantOrder, PeerTrader } from '../types';

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'p-1', name: 'ယွန်း ကွမ်းအစ် (အကြီး)', defaultPrice: 4500, defaultWholesalePrice: 5300, unit: 'ထည်', category: 'ယွန်းထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-2', name: 'ယွန်း ကွမ်းအစ် (အသေး)', defaultPrice: 2800, defaultWholesalePrice: 3400, unit: 'ထည်', category: 'ယွန်းထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-3', name: 'ယွန်း ဆွမ်းအုပ် (အလတ်)', defaultPrice: 3500, defaultWholesalePrice: 4300, unit: 'ထည်', category: 'ယွန်းထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-4', name: 'ယွန်း လက်ဖက်အုပ် (ရိုးရာ)', defaultPrice: 5000, defaultWholesalePrice: 6000, unit: 'ထည်', category: 'ယွန်းထည်', openingStock: 0, currentStock: 0, minStockAlert: 10, active: true },
  { id: 'p-5', name: 'ယွန်း ပန်းကန်ပြား', defaultPrice: 3200, defaultWholesalePrice: 3900, unit: 'ချပ်', category: 'ယွန်းထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-6', name: 'ဝါးခမောက် (ရိုးရိုး)', defaultPrice: 2200, defaultWholesalePrice: 2800, unit: 'လုံး', category: 'ဝါးထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-7', name: 'ဝါးဗန်း (အချော)', defaultPrice: 3000, defaultWholesalePrice: 3800, unit: 'ချပ်', category: 'ဝါးထည်', openingStock: 0, currentStock: 0, minStockAlert: 12, active: true },
  { id: 'p-8', name: 'ကြိမ်တောင်း (လက်ကိုင်ပါ)', defaultPrice: 6000, defaultWholesalePrice: 7400, unit: 'လုံး', category: 'ကြိမ်ထည်', openingStock: 0, currentStock: 0, minStockAlert: 10, active: true },
  { id: 'p-9', name: 'ကြိမ်ဗန်း (အဝိုင်း)', defaultPrice: 3800, defaultWholesalePrice: 4600, unit: 'ချပ်', category: 'ကြိမ်ထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-10', name: 'ဝါးနှီးခြင်း (အကြီး)', defaultPrice: 3800, defaultWholesalePrice: 4600, unit: 'လုံး', category: 'ဝါးထည်', openingStock: 0, currentStock: 0, minStockAlert: 15, active: true },
  { id: 'p-11', name: 'ဝါးယပ်တောင် (အလှဆင်)', defaultPrice: 4200, defaultWholesalePrice: 5100, unit: 'ချပ်', category: 'ဝါးထည်', openingStock: 0, currentStock: 0, minStockAlert: 12, active: true },
  // ကုန်ကြမ်းပစ္စည်းများ (Raw Materials)
  { id: 'p-12', name: 'ဝါးနှီးလိပ် (ကုန်ကြမ်း)', defaultPrice: 1500, defaultWholesalePrice: 2000, unit: 'လိပ်', category: 'ကုန်ကြမ်း (ဝါး)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
  { id: 'p-13', name: 'ကြိမ်လုံးစည်း (ကုန်ကြမ်း)', defaultPrice: 2500, defaultWholesalePrice: 3200, unit: 'စည်း', category: 'ကုန်ကြမ်း (ကြိမ်)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
  { id: 'p-14', name: 'ဝါးပိုးဝါးချောင်း (ကုန်ကြမ်း)', defaultPrice: 1200, defaultWholesalePrice: 1600, unit: 'ချောင်း', category: 'ကုန်ကြမ်း (ဝါး)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
  { id: 'p-15', name: 'ကြိမ်ကြိုးလိပ် (ကုန်ကြမ်း)', defaultPrice: 1000, defaultWholesalePrice: 1400, unit: 'လိပ်', category: 'ကုန်ကြမ်း (ကြိမ်)', openingStock: 0, currentStock: 0, minStockAlert: 20, active: true },
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
  {
    id: 's-4',
    code: 'S-004',
    name: 'ဦးဝင်းမောင်',
    phone: '09-420445566',
    village: 'သရက်ပင်ရွာ',
    notes: 'ကြိမ်တောင်း အဓိက ထုတ်လုပ်သူ',
    initialAdvance: 0,
    currentAdvanceBalance: 0,
    totalGoodsValueDelivered: 0,
    totalAdvanceGiven: 0,
    createdAt: '2026-08-06',
    updatedAt: '2026-08-31',
  },
  {
    id: 's-5',
    code: 'S-005',
    name: 'ဒေါ်စန်းနွယ်',
    phone: '09-960778899',
    village: 'ညောင်ဦးအရှေ့ရွာ',
    notes: 'လက်ဖက်အုပ် ပေးသွင်းသူ',
    initialAdvance: 0,
    currentAdvanceBalance: 0,
    totalGoodsValueDelivered: 0,
    totalAdvanceGiven: 0,
    createdAt: '2026-08-08',
    updatedAt: '2026-08-31',
  },
  {
    id: 's-6',
    code: 'S-006',
    name: 'ကိုမင်းမင်း',
    phone: '09-770334455',
    village: 'တောင်ကုန်းရွာ',
    notes: 'ဝါးဗန်းနှင့် ယပ်တောင်',
    initialAdvance: 0,
    currentAdvanceBalance: 0,
    totalGoodsValueDelivered: 0,
    totalAdvanceGiven: 0,
    createdAt: '2026-08-10',
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
  {
    id: 'm-4',
    code: 'M-004',
    name: 'သီရိမင်္ဂလာ လက်မှုကုန်စုံ',
    town: 'တောင်ကြီး',
    phone: '09-960778811',
    address: 'စျေးပိုင်းရပ်၊ တောင်ကြီး',
    ownerOrContact: 'ကိုစိုင်းအောင်ခမ်း',
    notes: 'ကြိမ်တောင်း အဓိကဝယ်',
    currentReceivableBalance: 0,
    totalPurchasesValue: 0,
    totalPaidAmount: 0,
    createdAt: '2026-08-06',
    updatedAt: '2026-08-31',
  },
];

export const INITIAL_TRANSACTIONS: TransactionRecord[] = [];

export const INITIAL_SALES: SaleRecord[] = [];

export const INITIAL_STOCK_ADJUSTMENTS: StockAdjustmentRecord[] = [];

export const INITIAL_MERCHANT_ORDERS: MerchantOrder[] = [];

export const INITIAL_PEER_TRADERS: PeerTrader[] = [];

export function generate100SampleSuppliers(): Supplier[] {
  const villages = [
    'ကျောက်ပန်းတောင်းရွာ',
    'ပလင်းရွာ',
    'အင်ကြင်းကုန်း',
    'သရက်ပင်ရွာ',
    'ညောင်ဦးအရှေ့ရွာ',
    'တောင်ကုန်းရွာ',
    'ရွှေစည်းခုံရွာ',
    'မင်းနန်သူရွာ',
    'မြင်းကပါရွာ',
    'ဖွားစောရွာ',
  ];

  const firstNames = ['ဦး', 'ဒေါ်', 'ကို', 'မ'];
  const baseNames = [
    'ဘတင်', 'သန်းခင်', 'အောင်မျိုး', 'ဝင်းမောင်', 'စန်းနွယ်', 'မင်းမင်း', 'ကျော်သူ', 'လှမိုး',
    'ခင်မောင်', 'အေးအေး', 'တင်တင်', 'သန်းဇော်', 'မောင်မောင်', 'စိုးစိုး', 'သန်းထွန်း', 'ဇော်ဝင်း',
    'ချစ်ဆွေ', 'မြသန်း', 'အေးသန်း', 'တင်အောင်', 'အောင်ဆန်း', 'ညွန့်ဝေ', 'စန်းစန်း', 'မြင့်ဆွေ',
    'ဌေးလွင်', 'အောင်ကြည်', 'ခင်စိုး', 'ကျော်စိုး', 'မင်းဇော်', 'လှလှ',
  ];

  const notesList = [
    'ကွမ်းအစ် ပေးသွင်းသူ',
    'ဆွမ်းအုပ် ပေးသွင်းသူ',
    'ကြိမ်တောင်း ပေးသွင်းသူ',
    'ဝါးခမောက် ပေးသွင်းသူ',
    'ဝါးဗန်း ပေးသွင်းသူ',
    'ယပ်တောင် ပေးသွင်းသူ',
    'လက်ဖက်အုပ် ပေးသွင်းသူ',
    'ဝါးနှီးခြင်း ပေးသွင်းသူ',
  ];

  const generated: Supplier[] = [...INITIAL_SUPPLIERS];

  for (let i = INITIAL_SUPPLIERS.length + 1; i <= 100; i++) {
    const code = `S-${String(i).padStart(3, '0')}`;
    const prefix = firstNames[i % firstNames.length];
    const name = `${prefix}${baseNames[i % baseNames.length]}${i > 30 ? ` (${i})` : ''}`;
    const village = villages[i % villages.length];
    const phone = `09-${200000000 + i * 7391}`;
    const note = notesList[i % notesList.length];

    const hasAdvance = i % 4 !== 0;
    const initialAdvance = hasAdvance ? ((i * 13) % 20 + 5) * 10000 : 0;
    const delivered = ((i * 17) % 30 + 10) * 10000;
    const currentBalance = hasAdvance ? Math.max(0, Math.round((initialAdvance * 0.45) / 1000) * 1000) : 0;
    const totalAdvanceGiven = initialAdvance + (i % 2 === 0 ? 50000 : 0);

    generated.push({
      id: `s-${i}`,
      code,
      name,
      phone,
      village,
      notes: note,
      initialAdvance,
      currentAdvanceBalance: currentBalance,
      totalGoodsValueDelivered: delivered,
      totalAdvanceGiven,
      createdAt: '2026-08-01',
      updatedAt: '2026-08-31',
    });
  }

  return generated;
}
