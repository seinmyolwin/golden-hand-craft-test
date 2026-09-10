/**
 * Cryptographic Local Security Service
 * Utilizes standard Web Crypto API (SubtleCrypto) for salted PIN and recovery key hashing.
 * 
 * IMPORTANT ARCHITECTURAL SECURITY NOTICE:
 * A client-side browser/PWA passcode prevents casual physical shoulder surfing or inadvertent
 * viewing. It does NOT provide OS/hardware-level device encryption against an individual with
 * unrestricted developer access (DevTools / root filesystem access) to the host device.
 */

export interface HashedCredential {
  salt: string; // Hex string
  hash: string; // Hex string
}

/**
 * Generate cryptographically secure random salt
 */
export function generateSalt(byteLength: number = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(byteLength);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback if Web Crypto is unavailable
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Compute SHA-256 digest of input + salt using Web Crypto API
 */
export async function hashSecretWithSalt(secret: string, salt: string): Promise<string> {
  const normalized = secret.trim();
  const data = new TextEncoder().encode(`${salt}:${normalized}`);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Simple deterministic fallback for non-crypto test environments
  let hash = 0;
  const str = `${salt}:${normalized}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Verify input against stored salt and hash
 */
export async function verifySecret(input: string, storedSalt: string, storedHash: string): Promise<boolean> {
  if (!input || !storedSalt || !storedHash) return false;
  const computed = await hashSecretWithSalt(input, storedSalt);
  return computed.toLowerCase() === storedHash.toLowerCase();
}

/**
 * Generate a unique, user-specific recovery key (e.g. SLY-4921-8835)
 * No hardcoded default secrets in source code!
 */
export function generateUniqueRecoveryKey(): string {
  const part1 = Math.floor(1000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `SLY-${part1}-${part2}`;
}

export const SECURITY_DISCLOSURE_MY =
  'သတိပြုရန်: ဤ Passcode/PIN စနစ်သည် ဖုန်း/ကွန်ပျူတာ အနီးရှိ အခြားသူများ မတော်တဆ ဝင်ကြည့်ခြင်းမှ ကာကွယ်ပေးသော Local Screen Lock သာဖြစ်ပါသည်။ စက်ကို အပြည့်အဝ ကိုင်တွယ်သုံးစွဲခွင့်ရှိသူ သို့မဟုတ် Developer Tools အသုံးပြုသူများထံမှ Hardware/OS အဆင့် ဒေတာကုဒ်ဝှက်ခြင်း (Device Full Encryption) နှင့် တူညီမှုမရှိပါ။';

export const SECURITY_DISCLOSURE_EN =
  'Security Notice: This local screen lock provides privacy against casual unauthorized viewing. It is not equivalent to hardware-level operating system full disk encryption.';
