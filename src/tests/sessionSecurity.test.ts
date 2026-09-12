import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import {
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession,
  switchUserSession,
  SESSION_STORAGE_KEY,
  SETTING_ACTIVE_SESSION_KEY,
  DEFAULT_OWNER_USER,
} from '../services/authorizationService';
import { derivePinCredentials } from '../services/cryptoSecurity';
import { saveAppLockSettings } from '../utils/storage';
import { AppLockSettings, UserSession } from '../types';

describe('Phase 18C.1 — Session Security & Anti-Bypass Verification Engine', () => {
  beforeEach(async () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
    await clearCurrentSession();
  });

  it('a. Forge sessionStorage with {userId: "user_owner"} (no token) -> getCurrentSession returns null', async () => {
    await clearCurrentSession();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId: DEFAULT_OWNER_USER.id }));
    }
    const session = await getCurrentSession();
    expect(session).toBeNull();
  });

  it('b. Forge sessionStorage with stale/mismatched token -> rejected and cleared', async () => {
    await clearCurrentSession();
    const canonicalSession: UserSession = {
      userId: DEFAULT_OWNER_USER.id,
      username: DEFAULT_OWNER_USER.username,
      displayName: DEFAULT_OWNER_USER.displayName,
      role: 'OWNER',
      loginTimestamp: new Date().toISOString(),
      sessionToken: 'valid_canonical_token_12345',
    };
    await db.settings.put({
      key: SETTING_ACTIVE_SESSION_KEY,
      value: canonicalSession,
      updatedAt: new Date().toISOString(),
    });

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ userId: DEFAULT_OWNER_USER.id, sessionToken: 'stale_forged_token_99999' })
      );
    }

    const session = await getCurrentSession();
    expect(session).toBeNull();
    if (typeof sessionStorage !== 'undefined') {
      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('c. Valid PIN login -> session token matches canonical store and returns OWNER', async () => {
    await clearCurrentSession();
    const pinCreds = await derivePinCredentials('1234');
    const lockSettings: AppLockSettings = {
      enabled: true,
      isPinInitialized: true,
      pinSalt: pinCreds.salt,
      pinHash: pinCreds.hash,
    };
    saveAppLockSettings(lockSettings);
    await db.settings.put({ key: 'appLockSettings', value: lockSettings, updatedAt: new Date().toISOString() });

    const newSession = await switchUserSession('OWNER', { pin: '1234' });
    expect(newSession).toBeDefined();
    expect(newSession.role).toBe('OWNER');
    expect(newSession.sessionToken).toBeDefined();

    const canonicalDb = await db.settings.get(SETTING_ACTIVE_SESSION_KEY);
    expect(canonicalDb?.value?.sessionToken).toBe(newSession.sessionToken);

    const retrievedSession = await getCurrentSession();
    expect(retrievedSession).toBeDefined();
    expect(retrievedSession?.role).toBe('OWNER');
    expect(retrievedSession?.sessionToken).toBe(newSession.sessionToken);
  });

  it('d. getCurrentSession returns null after previously set state -> calling effect updates state to null', async () => {
    await setCurrentSession({
      userId: DEFAULT_OWNER_USER.id,
      username: DEFAULT_OWNER_USER.username,
      displayName: DEFAULT_OWNER_USER.displayName,
      role: 'OWNER',
      sessionToken: 'temp_token_abc',
    });

    let currentSessionState: UserSession | null = await getCurrentSession();
    expect(currentSessionState).not.toBeNull();

    await clearCurrentSession();

    const session = await getCurrentSession();
    currentSessionState = session;

    expect(session).toBeNull();
    expect(currentSessionState).toBeNull();
  });

  it('e. Recovery-key unlock path -> grants valid Owner session without pin via recoveryKeyVerified', async () => {
    await clearCurrentSession();
    const lockSettings: AppLockSettings = {
      enabled: true,
      isPinInitialized: true,
      pinSalt: 'some-salt',
      pinHash: 'some-hash',
      recoveryKeyDisplay: 'RECOV-1234-5678',
    };
    saveAppLockSettings(lockSettings);

    const session = await switchUserSession('OWNER', { recoveryKeyVerified: true });
    expect(session).toBeDefined();
    expect(session.role).toBe('OWNER');
    expect(session.sessionToken).toBeDefined();

    const activeSession = await getCurrentSession();
    expect(activeSession?.role).toBe('OWNER');
  });
});
