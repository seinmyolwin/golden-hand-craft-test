/**
 * Filename Sanitization and Deterministic Voucher/Ledger Filename Generators
 * Compliant with Phase 24 and Burmese Commerce OS Filesystem Standards.
 */

// Illegal characters across Windows, Android, iOS, macOS, and Linux filesystems:
// / \ : * ? " < > | and control characters (0x00-0x1F, 0x7F)
const ILLEGAL_FILENAME_CHARS_REGEX = /[/\\:*?"<>|\x00-\x1F\x7F]/g;

/**
 * Sanitizes a filename string while fully preserving Burmese unicode characters,
 * numbers, hyphens, underscores, and safe spaces.
 */
export function sanitizeFilename(rawName: string, replacement: string = '-'): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'voucher';
  }

  let cleaned = rawName
    .replace(ILLEGAL_FILENAME_CHARS_REGEX, replacement)
    // Collapse multiple consecutive replacement chars or spaces
    .replace(/[-_\s]{2,}/g, (match) => (match.includes('-') ? '-' : ' '))
    .trim();

  // Remove leading or trailing dots, dashes, or spaces which are invalid on Windows/Android
  cleaned = cleaned.replace(/^[.\-\s]+|[.\-\s]+$/g, '');

  if (!cleaned) {
    return 'voucher';
  }

  // Cap filename length to 150 characters to prevent filesystem path-length overflow
  return cleaned.slice(0, 150);
}

/**
 * Generates a deterministic voucher filename matching Burmese convention:
 * `<ကုန်သည်/customer or supplier name>-<YYYY-MM-DD>-ဘောင်ချာ`
 *
 * Example: `ဦးဘ-2026-09-14-ဘောင်ချာ.pdf`
 */
export function generateVoucherFilename(
  counterpartName: string | undefined | null,
  date: string | undefined | null,
  voucherType: 'SALE' | 'INBOUND' | 'PURCHASE' | 'RETURN' | 'QR' = 'SALE',
  extension: string = ''
): string {
  const cleanName = (counterpartName || '').trim() || (voucherType === 'INBOUND' ? 'ကုန်သွင်းသူ' : 'ကုန်သည်');
  const cleanDate = (date || '').trim() || new Date().toISOString().split('T')[0];
  
  let baseName = '';
  if (voucherType === 'QR') {
    baseName = `${cleanName}-${cleanDate}-ဘောင်ချာ-QR`;
  } else {
    baseName = `${cleanName}-${cleanDate}-ဘောင်ချာ`;
  }

  const sanitized = sanitizeFilename(baseName);
  if (!extension) {
    return sanitized;
  }
  const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
  return `${sanitized}${cleanExt}`;
}

/**
 * Generates a deterministic ledger export filename matching convention:
 * `ကုန်စာရင်းချုပ်-YYYY-MM-DD-ဆိုင်အမည်`
 */
export function generateLedgerFilename(
  shopName: string | undefined | null,
  date: string | undefined | null,
  extension: string = 'csv'
): string {
  const cleanShop = (shopName || '').trim() || 'ရွှေလက်ရာ';
  const cleanDate = (date || '').trim() || new Date().toISOString().split('T')[0];
  const baseName = `ကုန်စာရင်းချုပ်-${cleanDate}-${cleanShop}`;
  const sanitized = sanitizeFilename(baseName);
  const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
  return `${sanitized}${cleanExt}`;
}
