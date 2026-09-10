import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveSecretHash,
  verifySecretHash,
  derivePinCredentials,
  verifyAppLockPin,
  generateSecureRecoveryKey,
  deriveRecoveryCredentials,
  verifyAppLockRecoveryKey,
  calculateLockoutDelaySeconds,
  checkAppLockout,
  handleFailedAttempt,
  handleSuccessfulUnlock,
  migrateLegacyAppLockSettings,
  SECURITY_DISCLOSURE_EN,
  SECURITY_DISCLOSURE_MY,
} from '../services/cryptoSecurity';
import { AppLockSettings } from '../types';

describe('Local App-Lock Cryptographic Security Engine', () => {
  it('derives consistent salted hashes using PBKDF2-SHA256', async () => {
    const secret = '5678';
    const salt = 'random-test-salt-12345';
    const hash1 = await deriveSecretHash(secret, salt);
    const hash2 = await deriveSecretHash(secret, salt);

    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64); // 256-bit SHA256 hex string
    expect(hash1).toBe(hash2);

    const isValid = await verifySecretHash(secret, salt, hash1);
    expect(isValid).toBe(true);

    const isWrongValid = await verifySecretHash('9999', salt, hash1);
    expect(isWrongValid).toBe(false);
  });

  it('correctly creates PIN credentials and verifies PIN matches', async () => {
    const creds = await derivePinCredentials('9182');
    expect(creds.salt).toBeDefined();
    expect(creds.hash).toBeDefined();
    expect(creds.hash.length).toBe(64);

    const settings: AppLockSettings = {
      enabled: true,
      pinSalt: creds.salt,
      pinHash: creds.hash,
      isPinInitialized: true,
    };

    const correctMatch = await verifyAppLockPin('9182', settings);
    expect(correctMatch).toBe(true);

    const wrongMatch = await verifyAppLockPin('1234', settings);
    expect(wrongMatch).toBe(false);
  });

  it('generates unambiguous formatted recovery keys and validates them', async () => {
    const key = generateSecureRecoveryKey();
    expect(key).toMatch(/^SLY-[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    const recCreds = await deriveRecoveryCredentials(key);
    expect(recCreds.salt).toBeDefined();
    expect(recCreds.hash).toBeDefined();

    const settings: AppLockSettings = {
      enabled: true,
      recoverySalt: recCreds.salt,
      recoveryHash: recCreds.hash,
      recoveryKey: key,
    };

    // Verifies exact match
    expect(await verifyAppLockRecoveryKey(key, settings)).toBe(true);
    // Verifies lowercase / spaces normalization
    const unformatted = key.toLowerCase().replace(/-/g, ' ');
    expect(await verifyAppLockRecoveryKey(unformatted, settings)).toBe(true);
    // Rejects invalid keys
    expect(await verifyAppLockRecoveryKey('SLY-0000-0000', settings)).toBe(false);
  });

  it('enforces lockout delays with progressive backoff on failed attempts', () => {
    expect(calculateLockoutDelaySeconds(1)).toBe(0);
    expect(calculateLockoutDelaySeconds(3)).toBe(0);
    expect(calculateLockoutDelaySeconds(5)).toBe(30); // 5th attempt locks for 30s
    expect(calculateLockoutDelaySeconds(6)).toBe(60);
    expect(calculateLockoutDelaySeconds(7)).toBe(120);
    expect(calculateLockoutDelaySeconds(8)).toBe(300);
    expect(calculateLockoutDelaySeconds(10)).toBe(300); // capped at 300s
  });

  it('handles failed unlock attempts by setting session lockouts and incrementing counter', () => {
    let settings: AppLockSettings = {
      enabled: true,
      failedAttempts: 0,
    };

    for (let i = 1; i <= 4; i++) {
      const res = handleFailedAttempt(settings);
      settings = res.updatedSettings;
      expect(res.lockoutSeconds).toBe(0);
      expect(settings.failedAttempts).toBe(i);
    }

    // 5th attempt triggers lockout
    const res5 = handleFailedAttempt(settings);
    settings = res5.updatedSettings;
    expect(res5.lockoutSeconds).toBe(30);
    expect(settings.lockedUntilTimestamp).toBeDefined();

    const lockStatus = checkAppLockout(settings);
    expect(lockStatus.isLocked).toBe(true);
    expect(lockStatus.remainingSeconds).toBeGreaterThan(0);

    // On successful unlock, failed attempts and lockouts are cleared
    const unlocked = handleSuccessfulUnlock(settings);
    expect(unlocked.failedAttempts).toBe(0);
    expect(unlocked.lockedUntilTimestamp).toBeUndefined();
    expect(unlocked.lastUnlockedAt).toBeDefined();
  });

  it('migrates legacy plaintext passcodes into salted verifiers and cleans plaintext values', async () => {
    const legacySettings: AppLockSettings = {
      enabled: true,
      passcode: '7741',
      pin: '7741',
      recoveryKey: 'SLY-LEGACY-KEY1',
    };

    const migrated = await migrateLegacyAppLockSettings(legacySettings);
    expect(migrated.pinSalt).toBeDefined();
    expect(migrated.pinHash).toBeDefined();
    expect(migrated.recoverySalt).toBeDefined();
    expect(migrated.recoveryHash).toBeDefined();
    expect(migrated.isPinInitialized).toBe(true);

    // Plaintext passcode/pin must be purged
    expect(migrated.passcode).toBeUndefined();
    expect(migrated.pin).toBeUndefined();

    // Verify migrated PIN works
    const isPinValid = await verifyAppLockPin('7741', migrated);
    expect(isPinValid).toBe(true);
  });

  it('includes clear and honest security disclosures', () => {
    expect(SECURITY_DISCLOSURE_EN).toContain('local screen lock provides privacy against casual unauthorized viewing');
    expect(SECURITY_DISCLOSURE_EN).toContain('not equivalent to hardware-level operating system full disk encryption');
    expect(SECURITY_DISCLOSURE_MY).toContain('Local Screen Lock သာဖြစ်ပါသည်');
  });
});
