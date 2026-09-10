import React, { useState } from 'react';
import { Printer, X, Bluetooth, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { ThermalReceiptData, ThermalPrinterService } from '../services/thermalPrinter';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ThermalReceiptData;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
}) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [btStatus, setBtStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handlePrintSlip = () => {
    window.print();
  };

  const handleBluetoothPrint = async () => {
    setIsPrintingBt(true);
    setBtStatus({ type: 'info', text: 'Bluetooth ပရင်တာ ရှာဖွေချိတ်ဆက်နေပါသည်...' });

    const result = await ThermalPrinterService.printViaBluetooth(receiptData);
    setIsPrintingBt(false);
    if (result.success) {
      setBtStatus({ type: 'success', text: result.message });
      setTimeout(() => setBtStatus(null), 5000);
    } else {
      setBtStatus({ type: 'error', text: result.message });
    }
  };

  const copyReceiptText = () => {
    const text = ThermalPrinterService.formatReceiptText58mm(receiptData);
    navigator.clipboard.writeText(text);
    setBtStatus({ type: 'success', text: 'ဖြတ်ပိုင်း စာသားများကို ကူးယူပြီးပါပြီ (Clipboard Copied)' });
    setTimeout(() => setBtStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Thermal POS ဖြတ်ပိုင်း</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {paperWidth}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Bluetooth သို့မဟုတ် Slip Printer ဖြင့် ချက်ချင်းထုတ်နိုင်ပါသည်</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper width controls */}
        <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between text-xs print:hidden">
          <span className="text-slate-400">စက္ကူအရွယ်အစား:</span>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1 rounded font-medium text-xs transition ${
                paperWidth === '58mm'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              58mm (အိတ်ဆောင်)
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1 rounded font-medium text-xs transition ${
                paperWidth === '80mm'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              80mm (ကောင်တာသုံး)
            </button>
          </div>
        </div>

        {/* Status notification */}
        {btStatus && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center gap-2 print:hidden ${
              btStatus.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30'
                : btStatus.type === 'error'
                ? 'bg-rose-500/20 text-rose-300 border-b border-rose-500/30'
                : 'bg-blue-500/20 text-blue-300 border-b border-blue-500/30'
            }`}
          >
            {btStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span className="leading-tight">{btStatus.text}</span>
          </div>
        )}

        {/* Scrollable Receipt Body */}
        <div className="p-4 overflow-y-auto bg-slate-950 flex justify-center flex-1">
          <div
            id="thermal-printable-receipt"
            className={`bg-[#fffdf7] text-slate-900 font-mono text-[11px] leading-relaxed p-4 rounded shadow-lg border border-slate-300 select-text ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
            style={{
              fontFamily: '"Padauk", "Courier New", Courier, monospace',
            }}
          >
            {/* Store Title */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
              <h2 className="font-extrabold text-sm tracking-wider uppercase">{receiptData.shopName}</h2>
              {receiptData.tagline && <p className="text-[10px] text-slate-600">{receiptData.tagline}</p>}
              {receiptData.phone && <p className="text-[10px] text-slate-600">ဖုန်း: {receiptData.phone}</p>}
              {receiptData.address && <p className="text-[9px] text-slate-500">{receiptData.address}</p>}
            </div>

            {/* Voucher Header */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
              <div className="text-center font-bold text-xs bg-slate-100 py-0.5 rounded">
                {receiptData.voucherType === 'INBOUND' ? 'ကုန်သိမ်း ငွေရှင်းဖြတ်ပိုင်း' : 'လက်ကားအရောင်း ဖြတ်ပိုင်း'}
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">ဘောင်ချာနံပါတ်:</span>
                <span className="font-bold">{receiptData.voucherNo}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">ရက်စွဲ/အချိန်:</span>
                <span>
                  {receiptData.date} ({receiptData.time})
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">{receiptData.personLabel}:</span>
                <span className="font-bold">{receiptData.personName}</span>
              </div>
              {receiptData.townOrVillage && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600">ဒေသ/ရွာ:</span>
                  <span>{receiptData.townOrVillage}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] text-slate-700 border-b border-slate-300 pb-1">
                <span>ပစ္စည်းအမည်</span>
                <span className="text-right">သင့်ငွေ</span>
              </div>
              {receiptData.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-medium text-[10px] text-slate-900">{item.name}</div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>
                      {item.qty} {item.unit || ''} × @{item.unitPrice.toLocaleString()}
                    </span>
                    <span className="font-semibold text-slate-900">{item.subtotal.toLocaleString()} Ks</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>ကုန်တန်ဖိုးစုစုပေါင်း:</span>
                <span>{receiptData.totalGoodsValue.toLocaleString()} Ks</span>
              </div>

              {receiptData.voucherType === 'INBOUND' ? (
                <>
                  {receiptData.advanceDeducted !== undefined && (
                    <div className="flex justify-between text-rose-700">
                      <span>အကြိုငွေမှ နုတ်ယူငွေ:</span>
                      <span>(-) {receiptData.advanceDeducted.toLocaleString()} Ks</span>
                    </div>
                  )}
                  {receiptData.cashPaidToSupplier !== undefined && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>အပိုပေးငွေ (လက်ငင်း):</span>
                      <span>{receiptData.cashPaidToSupplier.toLocaleString()} Ks</span>
                    </div>
                  )}
                  {receiptData.newAdvanceTaken !== undefined && receiptData.newAdvanceTaken > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>အကြိုငွေအသစ် ထုတ်ငွေ:</span>
                      <span>(+) {receiptData.newAdvanceTaken.toLocaleString()} Ks</span>
                    </div>
                  )}
                  {receiptData.remainingAdvanceBalance !== undefined && (
                    <div className="flex justify-between font-extrabold border-t border-slate-300 pt-1 text-slate-950 text-xs">
                      <span>လက်ကျန် အကြိုငွေ:</span>
                      <span>{receiptData.remainingAdvanceBalance.toLocaleString()} Ks</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {receiptData.deliveryFee !== undefined && receiptData.deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>ဂိတ်ပို့ခ/သယ်ယူခ:</span>
                      <span>(+) {receiptData.deliveryFee.toLocaleString()} Ks</span>
                    </div>
                  )}
                  {receiptData.discount !== undefined && receiptData.discount > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>လျှော့စျေး:</span>
                      <span>(-) {receiptData.discount.toLocaleString()} Ks</span>
                    </div>
                  )}
                  {receiptData.grandTotal !== undefined && (
                    <div className="flex justify-between font-bold text-slate-950">
                      <span>ကျသင့်ငွေစုစုပေါင်း:</span>
                      <span>{receiptData.grandTotal.toLocaleString()} Ks</span>
                    </div>
                  )}
                  {receiptData.cashPaidByMerchant !== undefined && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>ကုန်သည်ပေးငွေ:</span>
                      <span>{receiptData.cashPaidByMerchant.toLocaleString()} Ks</span>
                    </div>
                  )}
                  {receiptData.remainingReceivableBalance !== undefined && (
                    <div className="flex justify-between font-extrabold border-t border-slate-300 pt-1 text-amber-900 text-xs">
                      <span>ရရန်ကျန်ငွေ:</span>
                      <span>{receiptData.remainingReceivableBalance.toLocaleString()} Ks</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Blessing */}
            <div className="text-center pt-3 pb-1 space-y-1">
              <p className="text-[10px] text-slate-700 font-medium">
                {receiptData.footerMessage || 'ရွှေလက်ရာ မင်္ဂလာပါ - ကုန်ရောင်းကုန်ဝယ် ဒီရေအလား တိုးတက်ပါစေ'}
              </p>
              <div className="font-mono text-[9px] text-slate-400 tracking-widest pt-1">
                - - - - - - - - - - - - - - -
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 bg-slate-800 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <button
            onClick={copyReceiptText}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>စာသား ကူးယူမည်</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBluetoothPrint}
              disabled={isPrintingBt}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>{isPrintingBt ? 'ချိတ်ဆက်နေသည်...' : 'Bluetooth ပရင်တာ'}</span>
            </button>

            <button
              onClick={handlePrintSlip}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Slip ပရင့် / PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
