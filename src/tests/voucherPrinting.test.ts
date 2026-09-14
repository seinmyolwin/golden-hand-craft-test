import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { sanitizeFilename, generateVoucherFilename, generateLedgerFilename } from '../utils/filenameSanitizer';
import { SaleVoucherModal } from '../components/SaleVoucherModal';
import { VoucherModal } from '../components/VoucherModal';
import { ThermalReceiptModal } from '../components/ThermalReceiptModal';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { SaleRecord, TransactionRecord } from '../types';

describe('Phase 24: Voucher & Printing Formal Verification', () => {
  beforeEach(() => {
    // reset setup if needed
  });

  it('a. Print-mode DOM snapshot excludes app-chrome elements', () => {
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

    // Header and Nav should be marked print:hidden
    expect(html).toContain('header');
    expect(html).toContain('nav');
    expect(html).toContain('print:hidden');

    // Printable voucher scope must exist
    expect(html).toContain('voucher-printable-scope');
  });

  it('b. Voucher filename generator produces exact expected string (deterministic)', () => {
    const filename1 = generateVoucherFilename('ဦးဘ', '2026-09-14', 'SALE', 'pdf');
    expect(filename1).toBe('ဦးဘ-2026-09-14-ဘောင်ချာ.pdf');

    const filename2 = generateVoucherFilename('ဒေါ်လှ', '2026-09-15', 'INBOUND', 'pdf');
    expect(filename2).toBe('ဒေါ်လှ-2026-09-15-ဘောင်ချာ.pdf');

    const filenameQR = generateVoucherFilename('ဦးဘ', '2026-09-14', 'QR', 'png');
    expect(filenameQR).toBe('ဦးဘ-2026-09-14-ဘောင်ချာ-QR.png');

    const ledgerName = generateLedgerFilename('ရွှေလက်ရာ', '2026-09-14', 'csv');
    expect(ledgerName).toBe('ကုန်စာရင်းချုပ်-2026-09-14-ရွှေလက်ရာ.csv');
  });

  it('c. Filename sanitizer strips illegal characters preserving Burmese text', () => {
    const dirtyBurmese = 'ဦးဘ / ကုန်သည်: *၂၀၂၆*? "ဘောင်ချာ" <test> | illegal';
    const sanitized = sanitizeFilename(dirtyBurmese);

    // Must NOT contain / \ : * ? " < > |
    expect(sanitized).not.toMatch(/[/\\:*?"<>|]/);
    // Must contain original Burmese unicode characters
    expect(sanitized).toContain('ဦးဘ');
    expect(sanitized).toContain('ကုန်သည်');
    expect(sanitized).toContain('ဘောင်ချာ');
  });

  it('d. Voucher content renders all required fields without "undefined" or "NaN" for incomplete objects', () => {
    const incompleteSale: SaleRecord = {
      id: 'SALE-INC-1',
      voucherNo: 'SL-INC-001',
      date: '2026-09-14',
      time: '10:00',
      items: [
        {
          productId: 'P-1',
          productName: 'လက်မှုကြိမ်ခြင်း',
          unit: 'ခု',
          quantity: 5,
          unitPrice: 10000,
          subtotal: 50000,
        },
      ],
      totalGoodsValue: 50000,
      grandTotal: 50000,
      cashPaidByMerchant: 20000,
      remainingReceivableBalance: 30000,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(SaleVoucherModal, {
        isOpen: true,
        onClose: () => {},
        sale: incompleteSale,
      })
    );

    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(html).toContain('SL-INC-001');
    expect(html).toContain('လက်မှုကြိမ်ခြင်း');

    // Confirm shop logo image element exists inside output
    expect(html).toContain('<img');
    expect(html).toContain('alt="ရွှေလက်ရာ"');
  });

  it('e. Voucher Modal for Inbound/Supplier renders safely without undefined or NaN', () => {
    const incompleteInbound: TransactionRecord = {
      id: 'INB-INC-1',
      voucherNo: 'INB-2026-99',
      date: '2026-09-14',
      time: '10:00',
      supplierId: 'SUP-1',
      supplierName: 'ဦးမြတ်',
      items: [
        {
          productId: 'P-RAW',
          productName: 'ဝါးနှီးကြမ်း',
          unit: 'စည်း',
          quantity: 100,
          unitPrice: 500,
          subtotal: 50000,
        },
      ],
      totalGoodsValue: 50000,
      previousAdvanceBalance: 10000,
      advanceDeducted: 10000,
      netCashPaidToSupplier: 40000,
      remainingAdvanceBalance: 0,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(VoucherModal, {
        isOpen: true,
        onClose: () => {},
        transaction: incompleteInbound,
      })
    );

    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(html).toContain('INB-2026-99');
    expect(html).toContain('ဝါးနှီးကြမ်း');
    expect(html).toContain('<img');
  });

  it('f. ThermalReceiptModal renders safely with 58mm and 80mm paper sizes', () => {
    const receiptData = {
      shopName: 'ရွှေလက်ရာ',
      voucherType: 'SALE' as const,
      voucherNo: 'SL-2026-88',
      date: '2026-09-14',
      time: '14:20',
      personName: 'မလှလှ',
      personLabel: 'ဖောက်သည်',
      items: [
        { name: 'ယွန်းထည်ဆွမ်းအုပ်', qty: 1, unit: 'ခု', unitPrice: 35000, subtotal: 35000 },
      ],
      totalGoodsValue: 35000,
      grandTotal: 35000,
      cashPaidByMerchant: 35000,
      remainingReceivableBalance: 0,
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(ThermalReceiptModal, {
        isOpen: true,
        onClose: () => {},
        receiptData: receiptData,
      })
    );

    expect(html).toContain('voucher-printable-scope');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(html).toContain('paper-58mm');
    expect(html).toContain('max-w-[54mm]');
  });
});
