/**
 * Cryptographically sound and collision-resistant ID and Voucher Number generator
 * Does NOT rely on array length, current list order, or sequential indices.
 */

export function generateCryptoRandomString(length: number = 6): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * Generate a unique and stable entity ID
 * Format: {prefix}_{timestamp}_{random}
 */
export function generateStableId(prefix: string = 'rec'): string {
  const ts = Date.now();
  const rand = generateCryptoRandomString(6).toLowerCase();
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Generate a unique, professional voucher number with date prefix
 * Format: {PREFIX}-{YYYYMMDD}-{RANDOM4}
 * e.g., SALE-20260909-8F2D, TX-20260909-A49E
 */
export function generateVoucherNo(prefix: string = 'VOUCHER', dateStr?: string): string {
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const now = dateStr ? new Date(dateStr) : new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateSegment = `${yyyy}${mm}${dd}`;
  const randomSuffix = generateCryptoRandomString(4);
  return `${cleanPrefix}-${dateSegment}-${randomSuffix}`;
}

/**
 * Generate an idempotency key for operation deduplication
 */
export function generateIdempotencyKey(operation: string, targetId: string, customToken?: string): string {
  const token = customToken || generateCryptoRandomString(8);
  return `${operation}:${targetId}:${token}`;
}
