/**
 * Thermal POS Receipt Printer Service (ESC/POS & Web Bluetooth)
 * Supports 58mm (32 chars) and 80mm (48 chars) thermal receipt printers.
 * Compatible with Sunmi, Xprinter, Zjiang, Rongta, MPT-II, and generic Bluetooth POS printers.
 */

export interface ThermalReceiptData {
  shopName: string;
  tagline?: string;
  phone?: string;
  address?: string;
  voucherType: 'INBOUND' | 'SALE';
  voucherNo: string;
  date: string;
  time: string;
  personName: string; // Supplier or Merchant
  personLabel: string; // 'ကုန်ပစ္စည်းပေးသွင်းသူ' or 'ကုန်သည်'
  townOrVillage?: string;
  items: Array<{
    name: string;
    qty: number;
    unit?: string;
    unitPrice: number;
    subtotal: number;
  }>;
  totalGoodsValue: number;
  advanceDeducted?: number; // for Inbound
  cashPaidToSupplier?: number; // for Inbound
  newAdvanceTaken?: number; // for Inbound
  remainingAdvanceBalance?: number; // for Inbound
  discount?: number; // for Sale
  deliveryFee?: number; // for Sale
  grandTotal?: number; // for Sale
  cashPaidByMerchant?: number; // for Sale
  remainingReceivableBalance?: number; // for Sale
  paymentMethod?: string;
  notes?: string;
  footerMessage?: string;
}

export class ThermalPrinterService {
  // Check if Web Bluetooth is available
  static isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Format receipt text for 58mm (32 characters per line)
   */
  static formatReceiptText58mm(data: ThermalReceiptData): string {
    const divider = '--------------------------------';
    const lines: string[] = [];

    lines.push(data.shopName.toUpperCase());
    if (data.tagline) lines.push(data.tagline);
    if (data.phone) lines.push(`Ph: ${data.phone}`);
    if (data.address) lines.push(data.address);
    lines.push(divider);

    lines.push(data.voucherType === 'INBOUND' ? '*** ကုန်သိမ်း ငွေရှင်းဖြတ်ပိုင်း ***' : '*** လက်ကားအရောင်း ဖြတ်ပိုင်း ***');
    lines.push(`ဘောင်ချာ: ${data.voucherNo}`);
    lines.push(`ရက်စွဲ  : ${data.date} (${data.time})`);
    lines.push(`${data.personLabel}: ${data.personName}`);
    if (data.townOrVillage) lines.push(`ဒေသ    : ${data.townOrVillage}`);
    lines.push(divider);

    lines.push('ပစ္စည်းအမည်         အရေ တန်ဖိုး');
    lines.push(divider);

    data.items.forEach((item) => {
      const name = item.name.length > 18 ? item.name.substring(0, 18) : item.name;
      const qty = `${item.qty} ${item.unit || ''}`.trim();
      const val = `${item.subtotal.toLocaleString()} Ks`;
      lines.push(`${name}`);
      lines.push(`  ${qty} x @${item.unitPrice.toLocaleString()} = ${val}`);
    });

    lines.push(divider);
    lines.push(`ကုန်တန်ဖိုးစုစုပေါင်း: ${data.totalGoodsValue.toLocaleString()} Ks`);

    if (data.voucherType === 'INBOUND') {
      if (data.advanceDeducted !== undefined) {
        lines.push(`အကြိုငွေမှ နုတ်ယူငွေ: (-) ${data.advanceDeducted.toLocaleString()} Ks`);
      }
      if (data.cashPaidToSupplier !== undefined) {
        lines.push(`အပိုပေးငွေ (လက်ငင်း) : ${data.cashPaidToSupplier.toLocaleString()} Ks`);
      }
      if (data.newAdvanceTaken && data.newAdvanceTaken > 0) {
        lines.push(`အကြိုငွေအသစ် ထုတ်ငွေ: (+) ${data.newAdvanceTaken.toLocaleString()} Ks`);
      }
      if (data.remainingAdvanceBalance !== undefined) {
        lines.push(divider);
        lines.push(`လက်ကျန် အကြိုငွေ: ${data.remainingAdvanceBalance.toLocaleString()} Ks`);
      }
    } else {
      if (data.deliveryFee && data.deliveryFee > 0) {
        lines.push(`ဂိတ်ပို့ခ/သယ်ယူခ : (+) ${data.deliveryFee.toLocaleString()} Ks`);
      }
      if (data.discount && data.discount > 0) {
        lines.push(`လျှော့စျေး         : (-) ${data.discount.toLocaleString()} Ks`);
      }
      if (data.grandTotal !== undefined) {
        lines.push(`ကျသင့်ငွေစုစုပေါင်း : ${data.grandTotal.toLocaleString()} Ks`);
      }
      if (data.cashPaidByMerchant !== undefined) {
        lines.push(`ကုန်သည်ပေးငွေ     : ${data.cashPaidByMerchant.toLocaleString()} Ks`);
      }
      if (data.remainingReceivableBalance !== undefined) {
        lines.push(divider);
        lines.push(`ရရန်ကျန်ငွေ       : ${data.remainingReceivableBalance.toLocaleString()} Ks`);
      }
    }

    lines.push(divider);
    lines.push(data.footerMessage || 'ရွှေလက်ရာ မင်္ဂလာပါ - ကုန်ရောင်းကုန်ဝယ် ဒီရေအလား တိုးတက်ပါစေ');
    lines.push('\n\n\n'); // Paper feed spacing

    return lines.join('\n');
  }

  /**
   * Connect to Web Bluetooth Printer and send raw ESC/POS bytes
   */
  static async printViaBluetooth(data: ThermalReceiptData): Promise<{ success: boolean; message: string }> {
    if (!this.isBluetoothSupported()) {
      return {
        success: false,
        message: 'ယခု Browser သို့မဟုတ် စက်တွင် Web Bluetooth API ကို အသုံးမပြုနိုင်ပါ။ ကျေးဇူးပြု၍ Slip ပရင့်ကို အသုံးပြုပါ။',
      };
    }

    try {
      // Prompt user to select Bluetooth printer
      const navBluetooth = (navigator as unknown as { bluetooth: { requestDevice: (opt: unknown) => Promise<unknown> } }).bluetooth;
      const device = (await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Common printer service
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ],
      })) as { gatt?: { connect: () => Promise<unknown> }; name?: string };

      if (!device || !device.gatt) {
        return { success: false, message: 'ပရင်တာ ချိတ်ဆက်မှု မအောင်မြင်ပါ' };
      }

      const server = (await device.gatt.connect()) as {
        getPrimaryServices: () => Promise<Array<{ getCharacteristics: () => Promise<Array<{ properties: { write?: boolean; writeWithoutResponse?: boolean }; writeValue: (val: Uint8Array) => Promise<void> }>> }>>;
      };

      const services = await server.getPrimaryServices();
      let writeChar: { writeValue: (val: Uint8Array) => Promise<void> } | null = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        return { success: false, message: 'ပရင်တာတွင် စာရိုက်ထုတ်ခွင့် Characteristic မတွေ့ရှိပါ' };
      }

      // Encode text to bytes with ESC/POS commands
      const receiptText = this.formatReceiptText58mm(data);
      const encoder = new TextEncoder();
      const textBytes = encoder.encode(receiptText);

      // ESC/POS commands: Init (0x1B, 0x40), Feed & Cut (0x1D, 0x56, 0x41, 0x03)
      const initCommand = new Uint8Array([0x1b, 0x40]);
      const cutCommand = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x41, 0x03]);

      await writeChar.writeValue(initCommand);

      // Send chunks of max 512 bytes for Bluetooth MTU
      const chunkSize = 128;
      for (let i = 0; i < textBytes.length; i += chunkSize) {
        const chunk = textBytes.slice(i, i + chunkSize);
        await writeChar.writeValue(chunk);
      }

      await writeChar.writeValue(cutCommand);

      return {
        success: true,
        message: `${device.name || 'Bluetooth Printer'} သို့ ဖြတ်ပိုင်း အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('User cancelled') || errorMsg.includes('cancel')) {
        return { success: false, message: 'ပရင်တာ ရွေးချယ်မှုကို အသုံးပြုသူမှ ပယ်ဖျက်လိုက်ပါသည်' };
      }
      return {
        success: false,
        message: `Bluetooth ပရင့် ချိတ်ဆက်မှု အဆင်မပြေပါ (${errorMsg})။ Slip Print ဖြင့် အသုံးပြုနိုင်ပါသည်။`,
      };
    }
  }
}
