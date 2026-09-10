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
