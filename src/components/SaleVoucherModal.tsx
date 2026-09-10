import React, { useRef, useState } from 'react';
import { SaleRecord, ShopSettings } from '../types';
import { formatMMK, formatNumberOnly } from '../utils/storage';
import { X, Printer, Truck, Phone, QrCode, Receipt, FileText } from 'lucide-react';
import { Logo } from './Logo';
import { ThermalReceiptData } from '../services/thermalPrinter';

interface SaleVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleRecord | null;
  shopSettings?: ShopSettings;
  onOpenThermalReceipt?: (data: ThermalReceiptData) => void;
  onOpenQR?: (voucherNo: string, data: unknown) => void;
}

export const SaleVoucherModal: React.FC<SaleVoucherModalProps> = ({
  isOpen,
  onClose,
  sale,
  shopSettings,
  onOpenThermalReceipt,
  onOpenQR,
}) => {
  const [paperSize, setPaperSize] = useState<'A4' | 'A5' | '80mm' | '58mm'>('A5');
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const shopName = shopSettings?.shopName || 'ရွှေလက်ရာ';
  const tagline = shopSettings?.tagline || 'မြန်မာ့လက်မှု ယွန်းထည်နှင့် ဝါးနှီးလုပ်ငန်း';
  const phone = shopSettings?.phone || '09-123456789';
  const address = shopSettings?.address || 'ပုဂံမြို့ဟောင်း၊ မန္တလေးတိုင်း';

  const handlePrint = () => {
    const existingStyle = document.getElementById('dynamic-sale-print-style');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.id = 'dynamic-sale-print-style';
    let sizeRule = 'size: A5 portrait;';
    if (paperSize === 'A4') sizeRule = 'size: A4 portrait;';
    else if (paperSize === '80mm') sizeRule = 'size: 80mm auto;';
    else if (paperSize === '58mm') sizeRule = 'size: 58mm auto;';

    style.innerHTML = `
      @media print {
        @page {
          ${sizeRule}
          margin: 0 !important;
        }
        body, html {
          height: auto !important;
          max-height: 100vh !important;
          overflow: hidden !important;
        }
        .voucher-printable-scope {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('dynamic-sale-print-style');
      if (s) s.remove();
    }, 1500);
  };

  const handleThermalPrint = () => {
    if (!onOpenThermalReceipt) return;
    const items = (sale.items || []).map((item) => ({
      name: item.productName,
      qty: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal || item.quantity * item.unitPrice,
    }));

    onOpenThermalReceipt({
      shopName,
      tagline,
      phone,
      address,
      voucherType: 'SALE',
      voucherNo: sale.voucherNo,
      date: sale.date,
      time: sale.time,
      personName: sale.merchantName,
      personLabel: 'ကုန်သည်',
      townOrVillage: sale.merchantTown,
      items,
      totalGoodsValue: sale.totalGoodsValue || sale.grandTotal,
      discount: sale.discount,
      deliveryFee: sale.deliveryFee,
      grandTotal: sale.grandTotal,
      cashPaidByMerchant: sale.cashPaidByMerchant,
      remainingReceivableBalance: sale.remainingReceivableBalance,
      footerMessage: shopSettings?.receiptFooterNote,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col max-h-[96vh]">
        {/* Actions Bar */}
        <div className="px-3.5 py-2.5 bg-blue-950 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-200">
            <Truck className="w-4 h-4 text-blue-400" />
            <span>အရောင်းဘောင်ချာ</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenThermalReceipt && (
              <button
                type="button"
                onClick={handleThermalPrint}
                className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Bluetooth / Thermal POS ဖြတ်ပိုင်းထုတ်မည်"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thermal</span>
              </button>
            )}
            {onOpenQR && (
              <button
                type="button"
                onClick={() => onOpenQR(sale.voucherNo, sale)}
                className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="QR Code ထုတ်ယူမည်"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">QR</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print (၁ ရွက်)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-blue-900 hover:bg-blue-800 text-blue-200 flex items-center justify-center cursor-pointer transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper Size Selector (Print-friendly single page controls) */}
        <div className="px-3.5 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs print:hidden">
          <div className="flex items-center gap-1 text-slate-600 font-semibold">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>စာရွက်ဆိုဒ်:</span>
          </div>
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300">
            <button
              type="button"
              onClick={() => setPaperSize('A5')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                paperSize === 'A5' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="A5 စာရွက်တစ်ဝက် (အကြံပြုထားသော ဆိုဒ်)"
            >
              A5 (စာရွက်ဝက်)
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('A4')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                paperSize === 'A4' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="A4 စာရွက်အပြည့်"
            >
              A4 (စာရွက်ကြီး)
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('80mm')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                paperSize === '80mm' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="80mm Thermal POS ပရင်တာ"
            >
              80mm POS
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('58mm')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                paperSize === '58mm' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="58mm အိတ်ဆောင် ပရင်တာ"
            >
              58mm POS
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div
          ref={printRef}
          className={`voucher-printable-scope paper-${paperSize.toLowerCase()} p-4 sm:p-5 space-y-3 bg-white text-slate-900 flex-1 overflow-y-auto ${
            paperSize === '58mm' ? 'text-[10px] max-w-[280px] mx-auto' : paperSize === '80mm' ? 'text-[11px] max-w-[360px] mx-auto' : 'text-xs'
          }`}
        >
          {/* Header */}
          <div className="text-center border-b border-dashed border-slate-300 pb-2.5 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Logo size="sm" className="w-7 h-7 rounded-xl shadow-xs shrink-0" alt={shopName} />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{shopName}</h2>
            </div>
            <p className="text-[11px] text-slate-600 font-medium">{tagline}</p>
            <p className="text-[10px] text-slate-500">{address} • {phone}</p>
            <div className="inline-block mt-0.5 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">
              ကုန်သည်အရောင်းပြေစာ (SALES INVOICE)
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-slate-200 pb-2">
            <div>
              <span className="text-slate-500">ဘောင်ချာ: </span>
              <strong className="font-mono text-slate-800">{sale.voucherNo}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500">ရက်စွဲ: </span>
              <strong className="text-slate-800">{sale.date} ({sale.time})</strong>
            </div>
            <div>
              <span className="text-slate-500">ဖောက်သည်/ကုန်သည်: </span>
              <strong className="text-slate-900">{sale.merchantName}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500">မြို့နယ်: </span>
              <strong className="text-slate-800">{sale.merchantTown}</strong>
            </div>
          </div>

          {/* Transport & Delivery Vehicle Contact Box */}
          {(sale.deliveryVehicle || sale.driverOrContact || sale.driverPhone) && (
            <div className="p-2 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px] space-y-1">
              {sale.deliveryVehicle && (
                <div className="flex items-center gap-1.5 text-blue-950 font-medium">
                  <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>တင်ပေးလိုက်သည့်ကား/ဂိတ်: <strong>{sale.deliveryVehicle}</strong></span>
                </div>
              )}
              {(sale.driverOrContact || sale.driverPhone) && (
                <div className="flex items-center gap-1.5 text-blue-950 font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    ယာဉ်မောင်း/ဆက်သွယ်ရန်: <strong>{sale.driverOrContact || ''}</strong>
                    {sale.driverPhone && <span className="ml-1 font-mono text-emerald-800">({sale.driverPhone})</span>}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] text-slate-600 uppercase">
                  <th className="py-1">ကုန်ပစ္စည်း</th>
                  <th className="py-1 text-center">အရေအတွက်</th>
                  <th className="py-1 text-right">စျေးနှုန်း</th>
                  <th className="py-1 text-right">ကျသင့်ငွေ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sale.items && sale.items.map((item, idx) => (
                  <tr key={idx} className="py-1">
                    <td className="py-1 font-semibold text-slate-900">{item.productName}</td>
                    <td className="py-1 text-center font-bold text-slate-700">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1 text-right text-slate-600">
                      {formatNumberOnly(item.unitPrice)}
                    </td>
                    <td className="py-1 text-right font-extrabold text-slate-900">
                      {formatNumberOnly(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Settlement */}
          <div className="space-y-1.5 pt-2 border-t border-slate-300 text-xs">
            <div className="flex justify-between font-bold text-slate-900">
              <span>စုစုပေါင်း ကျသင့်ငွေ:</span>
              <span className="text-base font-extrabold text-blue-900">{formatMMK(sale.grandTotal)}</span>
            </div>

            <div className="flex justify-between text-emerald-800 text-[11px] font-semibold">
              <span>လက်ငင်း/လွှဲငွေ ပေးချေပြီး:</span>
              <span>- {formatMMK(sale.cashPaidByMerchant)}</span>
            </div>

            <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between items-center text-sm font-black">
              <span className="text-slate-900">ကျန်ရှိမည့် ရရန်ငွေ (အကြွေး):</span>
              <span className={sale.remainingReceivableBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                {formatMMK(sale.remainingReceivableBalance)}
              </span>
            </div>

            {sale.notes && (
              <div className="text-[10px] text-slate-500 italic pt-1">
                မှတ်ချက်: {sale.notes}
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="pt-8 grid grid-cols-2 text-center text-[10px] text-slate-500">
            <div>
              <div className="w-24 border-b border-slate-300 mx-auto mb-1" />
              <span>ဝယ်သူ ကုန်သည် လက်မှတ်</span>
            </div>
            <div>
              <div className="w-24 border-b border-slate-300 mx-auto mb-1" />
              <span>အရောင်းမန်နေဂျာ လက်မှတ်</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
