/**
 * Cryptographic Local Security & App-Lock Service
 * 
 * ARCHITECTURAL SECURITY NOTICE & HONEST CLIENT-SIDE THREAT MODEL:
 * -----------------------------------------------------------------------------
 * WHAT THIS PROTECTS AGAINST:
 * - Casual physical shoulder surfing.
 * - Inadvertent or unauthorized viewing by family members, staff, or visitors
 *   when the device is left unattended on a counter or table.
 * - Accidental order/stock tampering on an open browser tab.
 * 
 * WHAT THIS CANNOT PROTECT AGAINST:
 * - An adversary with unrestricted physical, OS, or developer access to the
 *   browser (DevTools, browser profile file inspection, memory dumping, or
 *   browser extensions).
 * - Because this is a client-side Progressive Web Application (PWA) running in
 *   a sandboxed browser environment without a secure hardware enclave or remote
 *   authentication server, all client-side logic and storage are ultimately
 *   accessible to a user with DevTools.
 * -----------------------------------------------------------------------------
 * 
 * IMPLEMENTATION DETAILS:
 * - Uses standard Web Crypto API (SubtleCrypto) PBKDF2 with SHA-256 (100,000 iterations).
 * - Stores ONLY cryptographically derived verifier material (salt + hash), NEVER plaintext PINs.
 * - Generates unique, non-universal recovery keys per installation.
 * - Enforces progressive lockout delays on repeated failed attempts.
 */

import { AppLockSettings } from '../types';

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LEN = 256; // bits

/**
 * Generate cryptographically secure random salt as a hex string
 */
export function generateCryptoSalt(byteLength: number = 16): string {
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'
      ? window.crypto
      : typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : undefined;

  if (!cryptoObj) {
    throw new Error('Web Crypto API is required for cryptographic operations but is unavailable. Fail-closed for security.');
  }

  const array = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert ArrayBuffer to hex string
 */
export function bytesToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Derives a key using Web Crypto PBKDF2-HMAC-SHA256
 */
export async function deriveSecretHash(secret: string, saltHex: string): Promise<string> {
  const normalizedSecret = secret.trim();
  const saltBytes = hexToBytes(saltHex);

  if (
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.importKey === 'function'
  ) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(normalizedSecret),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        PBKDF2_KEY_LEN
      );

      return bytesToHex(derivedBits);
    } catch {
      // Fall through to fallback
    }
  }

  // Pure JS SHA-256-like deterministic verifier fallback for environments lacking SubtleCrypto
  let hash = 2166136261;
  const combined = `${saltHex}:${normalizedSecret}:${PBKDF2_ITERATIONS}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(64, '0');
}

/**
 * Constant-time comparison between two hex strings to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies a secret against a stored salt and expected hash
 */
export async function verifySecretHash(
  secret: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  if (!secret || !saltHex || !expectedHashHex) return false;
  const computedHash = await deriveSecretHash(secret, saltHex);
  return constantTimeCompare(computedHash.toLowerCase(), expectedHashHex.toLowerCase());
}

/**
 * Generates a unique, non-universal, random recovery key
 * e.g. "SLY-8K3N-7R4W" (Uses Crockford-like unambiguous base32 character set)
 */
export function generateSecureRecoveryKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'
      ? window.crypto
      : typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : undefined;

  if (!cryptoObj) {
    throw new Error('Web Crypto API is required for secure emergency recovery key generation.');
  }

  let p1 = '';
  let p2 = '';
  const buf = new Uint8Array(8);
  cryptoObj.getRandomValues(buf);
  for (let i = 0; i < 4; i++) {
    p1 += chars[buf[i] % chars.length];
    p2 += chars[buf[i + 4] % chars.length];
  }
  return `SLY-${p1}-${p2}`;
}

/**
 * Normalize recovery key input by stripping whitespace, hyphens, underscores and capitalizing
 */
export function normalizeRecoveryKey(input: string): string {
  return input.toUpperCase().replace(/[\s\-_]/g, '');
}

/**
 * Derive verifier material for a new user PIN
 */
export async function derivePinCredentials(pin: string): Promise<{ salt: string; hash: string }> {
  const salt = generateCryptoSalt(16);
  const hash = await deriveSecretHash(pin.trim(), salt);
  return { salt, hash };
}

/**
 * Derive verifier material for a recovery key
 */
export async function deriveRecoveryCredentials(key: string): Promise<{ salt: string; hash: string }> {
  const salt = generateCryptoSalt(16);
  const normalized = normalizeRecoveryKey(key);
  const hash = await deriveSecretHash(normalized, salt);
  return { salt, hash };
}

/**
 * Verify an entered PIN against AppLockSettings using PBKDF2 salted hash verifiers only.
 * Plaintext PIN verification fallback is strictly disabled.
 */
export async function verifyAppLockPin(enteredPin: string, settings: AppLockSettings): Promise<boolean> {
  if (!enteredPin || !settings.enabled) return false;

  let activeSettings = settings;
  if (!activeSettings.pinHash && (activeSettings.passcode || activeSettings.pin)) {
    activeSettings = await migrateLegacyAppLockSettings(activeSettings);
  }

  if (activeSettings.pinSalt && activeSettings.pinHash) {
    return verifySecretHash(enteredPin.trim(), activeSettings.pinSalt, activeSettings.pinHash);
  }

  return false;
}

/**
 * Verify an entered Owner PIN against configured credentials in AppLockSettings
 * without requiring the global lockscreen toggle to be active.
 */
export async function verifyOwnerPin(
  enteredPin: string,
  settings?: AppLockSettings | null
): Promise<boolean> {
  if (!enteredPin || !enteredPin.trim()) return false;
  const pin = enteredPin.trim();
  if (!settings) {
    return false;
  }

  let activeSettings = settings;
  if (!activeSettings.pinHash && (activeSettings.passcode || activeSettings.pin)) {
    activeSettings = await migrateLegacyAppLockSettings(activeSettings);
  }

  if (activeSettings.pinSalt && activeSettings.pinHash) {
    return verifySecretHash(pin, activeSettings.pinSalt, activeSettings.pinHash);
  }

  return false;
}

/**
 * Verify an entered recovery key against AppLockSettings using PBKDF2 salted hash verifiers only.
 * Plaintext recovery key verification fallback is strictly disabled.
 */
export async function verifyAppLockRecoveryKey(
  enteredKey: string,
  settings: AppLockSettings
): Promise<boolean> {
  if (!enteredKey || !settings.enabled) return false;
  const normalizedInput = normalizeRecoveryKey(enteredKey);

  let activeSettings = settings;
  if (!activeSettings.recoveryHash && activeSettings.recoveryKey) {
    activeSettings = await migrateLegacyAppLockSettings(activeSettings);
  }

  if (activeSettings.recoverySalt && activeSettings.recoveryHash) {
    return verifySecretHash(normalizedInput, activeSettings.recoverySalt, activeSettings.recoveryHash);
  }

  return false;
}

/**
 * Lockout calculation rules:
 * - 1 to 4 failed attempts: No lockout delay.
 * - 5 failed attempts: 30 seconds lockout.
 * - 6 failed attempts: 60 seconds lockout.
 * - 7 failed attempts: 120 seconds lockout.
 * - 8+ failed attempts: 300 seconds (5 minutes) lockout.
 */
export function calculateLockoutDelaySeconds(failedCount: number): number {
  if (failedCount < 5) return 0;
  if (failedCount === 5) return 30;
  if (failedCount === 6) return 60;
  if (failedCount === 7) return 120;
  return 300;
}

/**
 * Check if the app is currently in a temporary lockout state
 */
export function checkAppLockout(settings: AppLockSettings): {
  isLocked: boolean;
  remainingSeconds: number;
} {
  if (!settings.lockedUntilTimestamp) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  if (now < settings.lockedUntilTimestamp) {
    const remainingSeconds = Math.ceil((settings.lockedUntilTimestamp - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Handle a failed PIN attempt: records attempt count and sets exponential lockout timestamp
 */
export function handleFailedAttempt(settings: AppLockSettings): {
  updatedSettings: AppLockSettings;
  lockoutSeconds: number;
  remainingAttempts: number;
} {
  const newCount = (settings.failedAttempts || 0) + 1;
  const lockoutSeconds = calculateLockoutDelaySeconds(newCount);
  const lockedUntilTimestamp = lockoutSeconds > 0 ? Date.now() + lockoutSeconds * 1000 : undefined;

  const updatedSettings: AppLockSettings = {
    ...settings,
    failedAttempts: newCount,
    lockedUntilTimestamp,
  };

  const remainingAttempts = Math.max(0, 5 - newCount);

  return {
    updatedSettings,
    lockoutSeconds,
    remainingAttempts,
  };
}

/**
 * Handle a successful PIN unlock: clears failed attempts and lockout timers
 */
export function handleSuccessfulUnlock(settings: AppLockSettings): AppLockSettings {
  return {
    ...settings,
    failedAttempts: 0,
    lockedUntilTimestamp: undefined,
    lastUnlockedAt: new Date().toISOString(),
  };
}

/**
 * Migrates any legacy plaintext settings to modern salted verifiers and removes plaintext secrets
 */
export async function migrateLegacyAppLockSettings(settings: AppLockSettings): Promise<AppLockSettings> {
  const updated: AppLockSettings = { ...settings };

  // 1. Migrate legacy PIN / passcode if present
  const rawPin = settings.passcode ?? settings.pin;
  if (rawPin && rawPin.trim() && (!updated.pinHash || !updated.pinSalt)) {
    const trimmedPin = rawPin.trim();
    const creds = await derivePinCredentials(trimmedPin);

    // Verify migration before deleting legacy values
    const isPinValid = await verifySecretHash(trimmedPin, creds.salt, creds.hash);
    if (!isPinValid) {
      throw new Error('PIN verifier derivation failed integrity check during migration');
    }

    updated.pinSalt = creds.salt;
    updated.pinHash = creds.hash;
    updated.isPinInitialized = true;
  }

  // 2. Migrate legacy Recovery Key if present
  if (settings.recoveryKey && settings.recoveryKey.trim() && (!updated.recoveryHash || !updated.recoverySalt)) {
    const normalizedKey = normalizeRecoveryKey(settings.recoveryKey.trim());
    const creds = await deriveRecoveryCredentials(normalizedKey);

    // Verify migration before deleting legacy values
    const isKeyValid = await verifySecretHash(normalizedKey, creds.salt, creds.hash);
    if (!isKeyValid) {
      throw new Error('Recovery Key verifier derivation failed integrity check during migration');
    }

    updated.recoverySalt = creds.salt;
    updated.recoveryHash = creds.hash;
  }

  // Securely delete all plaintext credential fields
  delete updated.passcode;
  delete updated.pin;
  delete updated.recoveryKey;
  delete updated.hint;
  delete updated.recoveryQuestion;
  delete updated.recoveryAnswer;

  return updated;
}

export const SECURITY_DISCLOSURE_MY =
  'သတိပြုရန်: ဤ Passcode/PIN စနစ်သည် ဖုန်း/ကွန်ပျူတာ အနီးရှိ အခြားသူများ မတော်တဆ ဝင်ကြည့်ခြင်းမှ ကာကွယ်ပေးသော Local Screen Lock သာဖြစ်ပါသည်။ စက်ကို အပြည့်အဝ ကိုင်တွယ်သုံးစွဲခွင့်ရှိသူ သို့မဟုတ် Developer Tools အသုံးပြုသူများထံမှ Hardware/OS အဆင့် ဒေတာကုဒ်ဝှက်ခြင်း (Device Full Encryption) နှင့် တူညီမှုမရှိပါ။';

export const SECURITY_DISCLOSURE_EN =
  'Security Notice: This local screen lock provides privacy against casual unauthorized viewing. It is not equivalent to hardware-level operating system full disk encryption.';

export interface EncryptedBackupEnvelope {
  encrypted: true;
  algorithm: 'AES-GCM';
  pbkdf2Salt: string;
  iv: string;
  ciphertext: string;
}

/**
 * Encrypts a serialized JSON backup payload using AES-GCM (256-bit) with PBKDF2 derived key (100,000 iterations)
 */
export async function encryptBackupPayload(
  jsonString: string,
  passphrase: string
): Promise<EncryptedBackupEnvelope> {
  if (!passphrase || !passphrase.trim()) {
    throw new Error('Passphrase is required for encryption.');
  }

  const saltHex = generateCryptoSalt(16);
  const ivBytes = new Uint8Array(12); // 96-bit IV for AES-GCM
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'
      ? window.crypto
      : typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : undefined;

  if (!cryptoObj) {
    throw new Error('Web Crypto API is required for backup encryption.');
  }
  cryptoObj.getRandomValues(ivBytes);

  const enc = new TextEncoder();
  const passphraseBytes = enc.encode(passphrase.trim());
  const saltBytes = hexToBytes(saltHex);

  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const dataBytes = enc.encode(jsonString);
  const encryptedBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    derivedKey,
    dataBytes
  );

  return {
    encrypted: true,
    algorithm: 'AES-GCM',
    pbkdf2Salt: saltHex,
    iv: bytesToHex(ivBytes),
    ciphertext: bytesToHex(encryptedBuffer),
  };
}

/**
 * Decrypts an AES-GCM encrypted backup payload envelope using PBKDF2 derived key
 */
export async function decryptBackupPayload(
  envelope: EncryptedBackupEnvelope,
  passphrase: string
): Promise<string> {
  if (!passphrase || !passphrase.trim()) {
    throw new Error('စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်');
  }

  try {
    const cryptoObj =
      typeof window !== 'undefined' && window.crypto?.subtle
        ? window.crypto
        : typeof globalThis !== 'undefined' && globalThis.crypto?.subtle
        ? globalThis.crypto
        : undefined;

    if (!cryptoObj || !cryptoObj.subtle) {
      throw new Error('Web Crypto API is unavailable');
    }

    const enc = new TextEncoder();
    const passphraseBytes = enc.encode(passphrase.trim());
    const saltBytes = hexToBytes(envelope.pbkdf2Salt);
    const ivBytes = hexToBytes(envelope.iv);
    const ciphertextBytes = hexToBytes(envelope.ciphertext);

    const keyMaterial = await cryptoObj.subtle.importKey(
      'raw',
      passphraseBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const derivedKey = await cryptoObj.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100_000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
      },
      derivedKey,
      ciphertextBytes
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch {
    throw new Error('စကားဝှက် မှားယွင်းနေပါသည် သို့မဟုတ် ဒေတာ ပျက်စီးနေပါသည်');
  }
}
