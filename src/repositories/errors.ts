export class BusinessIntegrityError extends Error {
  public readonly code: string;
  public readonly safeUserMessage: string;

  constructor(message: string, code: string = 'BUSINESS_INTEGRITY_ERROR', safeUserMessage?: string) {
    super(message);
    this.name = 'BusinessIntegrityError';
    this.code = code;
    this.safeUserMessage = safeUserMessage || message;
    Object.setPrototypeOf(this, BusinessIntegrityError.prototype);
  }
}

export class IdempotencyConflictError extends BusinessIntegrityError {
  constructor(message: string = 'Duplicate operation detected. This transaction was already processed.') {
    super(message, 'DUPLICATE_OPERATION', 'ဤငွေစာရင်း/ဘောက်ချာအား ယခင်က ထည့်သွင်းထားပြီးဖြစ်ပါသည် (ထပ်မံထည့်သွင်း၍မရပါ)');
    this.name = 'IdempotencyConflictError';
    Object.setPrototypeOf(this, IdempotencyConflictError.prototype);
  }
}

export class EntityNotFoundError extends BusinessIntegrityError {
  constructor(entityName: string, id: string) {
    const msg = `${entityName} with ID "${id}" was not found.`;
    const userMsg = `ရှာမတွေ့ပါ: ${entityName} (ID: ${id}) စာရင်းမရှိတော့ပါ`;
    super(msg, 'ENTITY_NOT_FOUND', userMsg);
    this.name = 'EntityNotFoundError';
    Object.setPrototypeOf(this, EntityNotFoundError.prototype);
  }
}

export class InvalidStateTransitionError extends BusinessIntegrityError {
  constructor(message: string, userMsg?: string) {
    super(message, 'INVALID_STATE_TRANSITION', userMsg || message);
    this.name = 'InvalidStateTransitionError';
    Object.setPrototypeOf(this, InvalidStateTransitionError.prototype);
  }
}

export class AccountingInvariantError extends BusinessIntegrityError {
  constructor(message: string, userMsg?: string) {
    super(message, 'ACCOUNTING_INVARIANT_VIOLATION', userMsg || 'စာရင်းတွက်ချက်မှု မမှန်ကန်ပါ။ စစ်ဆေးပေးပါ');
    this.name = 'AccountingInvariantError';
    Object.setPrototypeOf(this, AccountingInvariantError.prototype);
  }
}

export class DailyClosingLockedError extends BusinessIntegrityError {
  constructor(date: string, operation?: string) {
    const msg = `Date ${date} has already been closed and locked. Mutation ${operation ? `(${operation})` : ''} is rejected.`;
    const userMsg = `ရက်စွဲ ${date} အတွက် နေ့စဉ်စာရင်း ပိတ်သိမ်းပြီးဖြစ်သဖြင့် စာရင်းအသစ်ရေးသွင်းခြင်း သို့မဟုတ် ပြင်ဆင်ခြင်း မပြုလုပ်နိုင်ပါ`;
    super(msg, 'CLOSED_PERIOD_LOCKED', userMsg);
    this.name = 'DailyClosingLockedError';
    Object.setPrototypeOf(this, DailyClosingLockedError.prototype);
  }
}

/**
 * Centralized error-message helper for safe user-facing alerts & notifications.
 * If the error is a BusinessIntegrityError (or derivative), returns its localized safeUserMessage.
 * Otherwise returns a clear Burmese fallback message.
 */
export function getSafeErrorMessage(err: unknown, fallbackMessage?: string): string {
  if (err instanceof BusinessIntegrityError && err.safeUserMessage) {
    return err.safeUserMessage;
  }
  if (err instanceof Error && err.message) {
    return fallbackMessage ? `${fallbackMessage}: ${err.message}` : err.message;
  }
  if (typeof err === 'string' && err.trim().length > 0) {
    return fallbackMessage ? `${fallbackMessage}: ${err}` : err;
  }
  return fallbackMessage || 'စနစ်ချို့ယွင်းချက် ဖြစ်ပွားခဲ့ပါသည် (လုပ်ဆောင်ချက် မအောင်မြင်ပါ)';
}

