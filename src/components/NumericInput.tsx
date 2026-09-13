import React, { forwardRef } from 'react';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onChangeValue?: (val: number, raw: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  allowNegative?: boolean;
  allowDecimal?: boolean;
  prefixSymbol?: React.ReactNode;
  suffixLabel?: React.ReactNode;
  containerClassName?: string;
}

/**
 * Reusable NumericInput Component
 * - Automatically selects all text onFocus for quick overwriting
 * - Sets proper inputMode ('numeric' or 'decimal')
 * - Supports currency/unit prefixes and suffixes
 * - Normalizes empty values to 0 or empty string as needed
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onChangeValue,
      onChange,
      onFocus,
      allowNegative = false,
      allowDecimal = true,
      prefixSymbol,
      suffixLabel,
      containerClassName = '',
      className = '',
      min,
      max,
      step,
      disabled,
      placeholder = '0',
      ...rest
    },
    ref
  ) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
      if (onFocus) {
        onFocus(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e);
      }
      if (onChangeValue) {
        const raw = e.target.value;
        const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
        onChangeValue(isNaN(parsed) ? 0 : parsed, raw);
      }
    };

    const inputElement = (
      <input
        ref={ref}
        type="number"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        min={min ?? (allowNegative ? undefined : 0)}
        max={max}
        step={step ?? (allowDecimal ? 'any' : '1')}
        disabled={disabled}
        placeholder={placeholder}
        className={
          prefixSymbol || suffixLabel
            ? `w-full bg-transparent focus:outline-none text-slate-900 font-mono ${className}`
            : className
        }
        {...rest}
      />
    );

    if (!prefixSymbol && !suffixLabel) {
      return inputElement;
    }

    return (
      <div
        className={`flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 transition-all ${
          disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''
        } ${containerClassName}`}
      >
        {prefixSymbol && <span className="text-slate-400 font-semibold text-xs shrink-0 select-none">{prefixSymbol}</span>}
        {inputElement}
        {suffixLabel && <span className="text-slate-500 font-medium text-xs shrink-0 select-none">{suffixLabel}</span>}
      </div>
    );
  }
);

NumericInput.displayName = 'NumericInput';

/**
 * Context-appropriate default note placeholder mapping for Burmese Myanmar Handicrafts & Bamboo POS
 */
export type NoteFormContext =
  | 'INBOUND_VOUCHER'
  | 'SALE_VOUCHER'
  | 'STOCK_ADJUSTMENT'
  | 'RAW_MATERIAL_ISSUE'
  | 'RAW_MATERIAL_PURCHASE'
  | 'ADVANCE_PAYMENT'
  | 'RETURN_REFUND'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'CASH_ADVANCE'
  | 'CASH_ENTRY'
  | 'PEER_TRADE'
  | 'DAILY_CLOSING';

export const NOTE_PLACEHOLDERS: Record<NoteFormContext, string> = {
  INBOUND_VOUCHER: 'ဥပမာ - ကုန်ပစ္စည်း အရည်အသွေး ကောင်းမွန်၊ အချောထည် (၁၀၀) ခု သွင်းယူလက်ခံသည်',
  SALE_VOUCHER: 'ဥပမာ - မန္တလေးဆိုင်ခွဲ ပို့ဆောင်ရန်၊ ငွေသားချေပြီး / ကုန်သည်လက်ကျန် အကြွေးမှတ်သည်',
  STOCK_ADJUSTMENT: 'ဥပမာ - နှစ်ကုန် စာရင်းစစ် လက်ကျန်ညှိနှိုင်းခြင်း / ပျက်စီးဆုံးရှုံးမှု နုတ်ပယ်ခြင်း',
  RAW_MATERIAL_ISSUE: 'ဥပမာ - ခြင်းရက်လုပ်ငန်းအတွက် အကြမ်းဝါး (၅၀) လုံး အလုပ်သမားသို့ ထုတ်ပေးခြင်း',
  RAW_MATERIAL_PURCHASE: 'ဥပမာ - ရွာသစ်မှ တိုက်ရိုက်ဝယ်ယူသော ဝါးလုံး (၂၀၀) နှင့် ကြိမ်ကုန်ကြမ်းများ',
  ADVANCE_PAYMENT: 'ဥပမာ - လက်ခကြိုထုတ်ငွေ / ပစ္စည်းကြိုတင်မှာယူရန် စပေါ်ငွေ ကြိုတင်ပေးချေခြင်း',
  CASH_ADVANCE: 'ဥပမာ - လက်ခကြိုထုတ်ငွေ / ပစ္စည်းကြိုတင်မှာယူရန် စပေါ်ငွေ ကြိုတင်ပေးချေခြင်း',
  RETURN_REFUND: 'ဥပမာ - အရည်အသွေး မပြည့်မီ၍ ပစ္စည်းပြန်အပ်ပြီး ငွေပြန်လည်လက်ခံရရှိခြင်း',
  SALES_RETURN: 'ဥပမာ - ဖောက်သည်ထံမှ ပစ္စည်းချွတ်ယွင်းမှုကြောင့် ပြန်လည်လက်ခံခြင်း',
  PURCHASE_RETURN: 'ဥပမာ - ကုန်ကြမ်းပေးသွင်းသူထံ ကုန်ပစ္စည်းမကိုက်ညီ၍ ပြန်ပို့အပ်နှံခြင်း',
  CASH_ENTRY: 'ဥပမာ - ဆိုင်အသုံးစရိတ် / ဆိုင်ရှင်ထည့်ဝင်ငွေ / ဘဏ်မှ ငွေသားထုတ်ယူခြင်း',
  PEER_TRADE: 'ဥပမာ - မိတ်ဖက်ဆိုင်မှ ပစ္စည်းအပြန်အလှန် လဲလှယ်ခြင်း / ညှိနှိုင်းရောင်းချခြင်း',
  DAILY_CLOSING: 'ဥပမာ - ညနေပိုင်း ဆိုင်ပိတ် စာရင်းစစ်ခြင်း၊ ကုန်နှင့် ငွေလက်ကျန် ကိုက်ညီမှုရှိပါသည်',
};

export function getNotePlaceholder(context: NoteFormContext, customDefault?: string): string {
  return NOTE_PLACEHOLDERS[context] || customDefault || 'မှတ်ချက် ရေးသွင်းပါ (လိုအပ်ပါက)...';
}
