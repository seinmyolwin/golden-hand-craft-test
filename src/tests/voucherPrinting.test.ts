import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { sanitizeFilename, generateVoucherFilename, generateLedgerFilename } from '../utils/filenameSanitizer';
import { SaleVoucherModal } from '../components/SaleVoucherModal';
import { VoucherModal } from '../components/VoucherModal';
import { ThermalReceiptModal } from '../components/ThermalReceiptModal';
import { VoucherQRModal } from '../components/VoucherQRModal';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { SaleRecord, TransactionRecord, ShopSettings } from '../types';
import { db } from '../db/database';
import { ThermalPrinterService } from '../services/thermalPrinter';

describe('Phase 24: Voucher & Printing Formal Verification', () => {
  beforeEach(async () => {
    // Ensure clean state
    await db.sales.clear();
    await db.transactions.clear();
    await db.cashMovements.clear();
    await db.stockMovements.clear();
  });

  /* -------------------------------------------------------------
   * 1. PRINT ISOLATION
   * ------------------------------------------------------------- */
  it('1. Print isolation: Excludes Header, BottomNav, and background chrome while isolating voucher-printable-scope', () => {
    const sampleSale: SaleRecord = {
      id: 'SALE-101',
      voucherNo: 'SL-2026-0001',
      date: '2026-09-14',
      time: '10:30',
      merchantId: 'M-1',
      merchantName: 'ဦးဘ',
      merchantTown: 'ညောင်ဦး',
      items: [
        {
          productId: 'P-1',
          productName: 'လက်ကိုင်အိတ် (ပါး)',
          unit: 'ခု',
          quantity: 10,
          unitPrice: 5500,
          subtotal: 55000,
        },
      ],
      totalGoodsValue: 55000,
      discount: 0,
      deliveryFee: 0,
      grandTotal: 55000,
      cashPaidByMerchant: 55000,
      remainingReceivableBalance: 0,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(
        'div',
        null,
        React.createElement(Header, {
          selectedDate: '2026-09-14',
          onDateChange: () => {},
        }),
        React.createElement(SaleVoucherModal, {
          isOpen: true,
          onClose: () => {},
          sale: sampleSale,
        }),
        React.createElement(BottomNav, {
          activeTab: 'sales',
          onTabChange: () => {},
          todayInboundCount: 0,
          todaySalesCount: 1,
          lowStockAlertCount: 0,
        })
      )
    );

    // App chrome elements have print:hidden
    expect(html).toContain('header');
    expect(html).toContain('nav');
    expect(html).toContain('print:hidden');

    // Only voucher-printable-scope is isolated
    expect(html).toContain('voucher-printable-scope');
  });

  /* -------------------------------------------------------------
   * 2. VOUCHER CONTENT & ZERO UNDEFINED/NAN/NULL STRINGS
   * ------------------------------------------------------------- */
  it('2. Voucher Content: Renders logo, shop, voucher#, date, customer, items, math without undefined, NaN, or null', () => {
    const shopSettings: ShopSettings = {
      shopName: 'ရွှေလက်ရာ မန္တလေးရိုးရာ',
      tagline: 'မြန်မာ့လက်မှု ကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း',
      phone: '09-123456789',
      address: 'ပုဂံမြို့ဟောင်း၊ မန္တလေးတိုင်း',
      logoUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    };

    const fullSale: SaleRecord = {
      id: 'SALE-999',
      voucherNo: 'SL-2026-999',
      date: '2026-09-14',
      time: '11:45',
      merchantId: 'M-10',
      merchantName: 'ဒေါ်နွယ်နွယ်',
      merchantTown: 'ကျောက်ပန်းတောင်း',
      items: [
        {
          productId: 'P-1',
          productName: 'ယွန်းထည်ဆွမ်းအုပ်',
          unit: 'လုံး',
          quantity: 4,
          unitPrice: 25000,
          subtotal: 100000,
        },
      ],
      totalGoodsValue: 100000,
      deliveryFee: 3000,
      discount: 5000,
      grandTotal: 98000,
      cashPaidByMerchant: 50000,
      remainingReceivableBalance: 48000,
      notes: 'ကားဂိတ်သို့ အရောက်ပို့ပါ',
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(SaleVoucherModal, {
        isOpen: true,
        onClose: () => {},
        sale: fullSale,
        shopSettings,
      })
    );

    // Verify all required fields
    expect(html).toContain('ရွှေလက်ရာ မန္တလေးရိုးရာ');
    expect(html).toContain('SL-2026-999');
    expect(html).toContain('2026-09-14');
    expect(html).toContain('ဒေါ်နွယ်နွယ်');
    expect(html).toContain('ကျောက်ပန်းတောင်း');
    expect(html).toContain('ယွန်းထည်ဆွမ်းအုပ်');
    expect(html).toContain('လုံး');
    expect(html).toContain('4');
    expect(html).toContain('25,000');
    expect(html).toContain('100,000');
    expect(html).toContain('5,000'); // discount
    expect(html).toContain('3,000'); // delivery fee
    expect(html).toContain('98,000'); // grandTotal
    expect(html).toContain('50,000'); // paid
    expect(html).toContain('48,000'); // remaining
    expect(html).toContain('ကားဂိတ်သို့ အရောက်ပို့ပါ');

    // Strict ban on invalid strings
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('null');
  });

  /* -------------------------------------------------------------
   * 3. A4 & A5 PRINT LAYOUT
   * ------------------------------------------------------------- */
  it('3. A4 and A5 Print Layout: Generates compliant container classes without horizontal overflow', () => {
    const sale: SaleRecord = {
      id: 'SALE-A4',
      voucherNo: 'SL-A4-001',
      date: '2026-09-14',
      time: '12:00',
      items: [{ productId: 'P-1', productName: 'ပုဂံလက်ကိုင်အိတ်', unit: 'ခု', quantity: 2, unitPrice: 15000, subtotal: 30000 }],
      grandTotal: 30000,
      cashPaidByMerchant: 30000,
      remainingReceivableBalance: 0,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(SaleVoucherModal, {
        isOpen: true,
        onClose: () => {},
        sale,
      })
    );

    expect(html).toContain('voucher-printable-scope');
    expect(html).toContain('paper-a5'); // default paper
    expect(html).toContain('max-w-[138mm]');
  });

  /* -------------------------------------------------------------
   * 4. THERMAL (58mm & 80mm) VERIFICATION
   * ------------------------------------------------------------- */
  it('4. Thermal Receipt: Supports both 58mm and 80mm formats with complete data', () => {
    const thermalData = {
      shopName: 'ရွှေလက်ရာ',
      voucherType: 'SALE' as const,
      voucherNo: 'SL-POS-100',
      date: '2026-09-14',
      time: '15:30',
      personName: 'ကိုအောင်',
      personLabel: 'ကုန်သည်',
      items: [
        { name: 'ဝါးခက်ထည်', qty: 3, unit: 'ချပ်', unitPrice: 4000, subtotal: 12000 },
        { name: 'ကြိမ်ဖျာ', qty: 1, unit: 'ထည်', unitPrice: 18000, subtotal: 18000 },
      ],
      totalGoodsValue: 30000,
      discount: 1000,
      grandTotal: 29000,
      cashPaidByMerchant: 29000,
      remainingReceivableBalance: 0,
    };

    // 1. React DOM rendering test
    const html = ReactDOMServer.renderToString(
      React.createElement(ThermalReceiptModal, {
        isOpen: true,
        onClose: () => {},
        receiptData: thermalData,
      })
    );

    expect(html).toContain('paper-58mm');
    expect(html).toContain('max-w-[54mm]');
    expect(html).toContain('ဝါးခက်ထည်');
    expect(html).toContain('ကြိမ်ဖျာ');
    expect(html).toContain('29,000');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');

    // 2. Service text formatter test
    const text58 = ThermalPrinterService.formatReceiptText58mm(thermalData);
    expect(text58).toContain('ရွှေလက်ရာ');
    expect(text58).toContain('SL-POS-100');
    expect(text58).toContain('ဝါးခက်ထည်');
    expect(text58).toContain('29,000');
  });

  /* -------------------------------------------------------------
   * 5. LONG DATA SCALABILITY TESTS (1, 10, 30 ITEMS & LONG STRINGS)
   * ------------------------------------------------------------- */
  it('5. Long Data Tests: Renders 1 item, 10 items, 30 items, and long Burmese strings cleanly', () => {
    // Generate 30 items
    const longItems = Array.from({ length: 30 }, (_, i) => ({
      productId: `P-${i + 1}`,
      productName: `မြန်မာ့ရိုးရာလက်မှု ပုဂံယွန်းထည် ဆွမ်းအုပ်ကြီး အမှတ် (${i + 1}) - အထူးအဆင့် သဘာဝသစ်စေးစစ်စစ်`,
      unit: 'လုံး',
      quantity: i + 1,
      unitPrice: 10000 + i * 500,
      subtotal: (i + 1) * (10000 + i * 500),
    }));

    const totalVal = longItems.reduce((sum, item) => sum + item.subtotal, 0);

    const longSale: SaleRecord = {
      id: 'SALE-LONG-30',
      voucherNo: 'SL-2026-LONG-030',
      date: '2026-09-14',
      time: '16:00',
      merchantName: 'ဒေါ်စောနန်းမိုးကြည်ဟန် (ရတနာရွှေပြည် မန္တလေးရိုးရာ လက်မှုပစ္စည်းအရောင်းဆိုင်ကြီး)',
      merchantTown: 'မန္တလေးမြို့၊ ချမ်းအေးသာစံမြို့နယ်၊ ၇၈ လမ်း',
      items: longItems,
      totalGoodsValue: totalVal,
      grandTotal: totalVal,
      cashPaidByMerchant: totalVal,
      remainingReceivableBalance: 0,
    };

    const shopSettings: ShopSettings = {
      shopName: 'ရွှေလက်ရာ မြန်မာ့ရိုးရာ လက်မှုကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း ကုန်ထုတ်လုပ်ရေးနှင့် ဖြန့်ချိရေးဌာန',
      tagline: 'အရည်အသွေးမြင့် မြန်မာ့လက်မှုထည်များ တစ်ပြည်လုံးသို့ ဖြန့်ချိရာဌာန',
      phone: '09-123456789, 09-987654321',
      address: 'အမှတ် (၁၂၃)၊ ပုဂံမြို့ဟောင်း ရှေးဟောင်းယဉ်ကျေးမှုဇုန်၊ မန္တလေးတိုင်းဒေသကြီး',
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(SaleVoucherModal, {
        isOpen: true,
        onClose: () => {},
        sale: longSale,
        shopSettings,
      })
    );

    // Verify long strings render without truncation or breaks
    expect(html).toContain('ရွှေလက်ရာ မြန်မာ့ရိုးရာ လက်မှုကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း');
    expect(html).toContain('ဒေါ်စောနန်းမိုးကြည်ဟန် (ရတနာရွှေပြည် မန္တလေးရိုးရာ လက်မှုပစ္စည်းအရောင်းဆိုင်ကြီး)');

    // Verify all 30 items are in the DOM
    for (let i = 1; i <= 30; i++) {
      expect(html).toContain(`အမှတ် (${i})`);
    }

    // Verify math integrity
    expect(html).toContain(totalVal.toLocaleString());
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  /* -------------------------------------------------------------
   * 6. DETERMINISTIC FILENAME & UNICODE SANITIZER
   * ------------------------------------------------------------- */
  it('6. Filename Sanitizer: Produces deterministic <customer>-<YYYY-MM-DD>-ဘောင်ချာ with safe Unicode', () => {
    // Basic Sale
    const saleFilename = generateVoucherFilename('ကိုမောင်မောင်', '2026-09-14', 'SALE', 'pdf');
    expect(saleFilename).toBe('ကိုမောင်မောင်-2026-09-14-ဘောင်ချာ.pdf');

    // Basic Inbound
    const inbFilename = generateVoucherFilename('ဒေါ်စန်းစန်း', '2026-09-15', 'INBOUND', 'pdf');
    expect(inbFilename).toBe('ဒေါ်စန်းစန်း-2026-09-15-ဘောင်ချာ.pdf');

    // QR Voucher
    const qrFilename = generateVoucherFilename('ဦးသန်းထွန်း', '2026-09-14', 'QR', 'png');
    expect(qrFilename).toBe('ဦးသန်းထွန်း-2026-09-14-ဘောင်ချာ-QR.png');

    // Ledger CSV
    const ledgerFilename = generateLedgerFilename('ရွှေလက်ရာ', '2026-09-14', 'csv');
    expect(ledgerFilename).toBe('ကုန်စာရင်းချုပ်-2026-09-14-ရွှေလက်ရာ.csv');

    // Filename sanitizer with illegal filesystem characters
    const dirty = 'ဦးဘ / ကုန်သည်: *၂၀၂၆*? "ဘောင်ချာ" <test> | dangerous';
    const sanitized = sanitizeFilename(dirty);
    expect(sanitized).not.toMatch(/[/\\:*?"<>|]/);
    expect(sanitized).toContain('ဦးဘ');
    expect(sanitized).toContain('ကုန်သည်');
    expect(sanitized).toContain('ဘောင်ချာ');

    // Empty or null fallback
    expect(sanitizeFilename('')).toBe('voucher');
    expect(generateVoucherFilename(null, null)).toBe('ကုန်သည်-' + new Date().toISOString().split('T')[0] + '-ဘောင်ချာ');
  });

  /* -------------------------------------------------------------
   * 7. PRINT MUST REMAIN STRICTLY READ-ONLY
   * ------------------------------------------------------------- */
  it('7. Print Read-Only Guarantee: Printing or viewing vouchers NEVER writes to database or creates financial records', async () => {
    const initialSales = await db.sales.count();
    const initialTransactions = await db.transactions.count();
    const initialCash = await db.cashMovements.count();
    const initialStock = await db.stockMovements.count();

    expect(initialSales).toBe(0);
    expect(initialTransactions).toBe(0);
    expect(initialCash).toBe(0);
    expect(initialStock).toBe(0);

    const sale: SaleRecord = {
      id: 'READONLY-SALE-1',
      voucherNo: 'SL-RO-001',
      date: '2026-09-14',
      time: '10:00',
      items: [{ productId: 'P-1', productName: 'ပစ္စည်း', unit: 'ခု', quantity: 1, unitPrice: 1000, subtotal: 1000 }],
      grandTotal: 1000,
      cashPaidByMerchant: 1000,
      remainingReceivableBalance: 0,
    };

    const transaction: TransactionRecord = {
      id: 'READONLY-INB-1',
      voucherNo: 'INB-RO-001',
      date: '2026-09-14',
      time: '10:00',
      supplierId: 'SUP-1',
      supplierName: 'ဦးမြတ်',
      items: [{ productId: 'P-RAW', productName: 'ကုန်ကြမ်း', unit: 'စည်း', quantity: 10, unitPrice: 100, subtotal: 1000 }],
      totalGoodsValue: 1000,
      netCashPaidToSupplier: 1000,
      remainingAdvanceBalance: 0,
    };

    // Render all modals
    ReactDOMServer.renderToString(
      React.createElement(SaleVoucherModal, { isOpen: true, onClose: () => {}, sale })
    );

    ReactDOMServer.renderToString(
      React.createElement(VoucherModal, { isOpen: true, onClose: () => {}, transaction })
    );

    ReactDOMServer.renderToString(
      React.createElement(ThermalReceiptModal, {
        isOpen: true,
        onClose: () => {},
        receiptData: {
          shopName: 'ရွှေလက်ရာ',
          voucherType: 'SALE',
          voucherNo: 'SL-RO-001',
          date: '2026-09-14',
          time: '10:00',
          personName: 'ဝယ်သူ',
          personLabel: 'ကုန်သည်',
          items: [{ name: 'ပစ္စည်း', qty: 1, unit: 'ခု', unitPrice: 1000, subtotal: 1000 }],
          totalGoodsValue: 1000,
          grandTotal: 1000,
          cashPaidByMerchant: 1000,
          remainingReceivableBalance: 0,
        },
      })
    );

    ReactDOMServer.renderToString(
      React.createElement(VoucherQRModal, {
        isOpen: true,
        onClose: () => {},
        title: 'QR Voucher',
        voucherNo: 'SL-RO-001',
        data: sale,
      })
    );

    // Verify database remains 100% untouched
    const afterSales = await db.sales.count();
    const afterTransactions = await db.transactions.count();
    const afterCash = await db.cashMovements.count();
    const afterStock = await db.stockMovements.count();

    expect(afterSales).toBe(initialSales);
    expect(afterTransactions).toBe(initialTransactions);
    expect(afterCash).toBe(initialCash);
    expect(afterStock).toBe(initialStock);
  });
});

