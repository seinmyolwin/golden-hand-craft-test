/**
 * Shwe Let Yar - Enterprise RBAC & Financial Operation Authorization Service
 * Phase 18C Implementation
 *
 * Enforces strict Domain & Service layer authorization for OWNER vs USER roles.
 * UI hiding alone is NEVER considered security.
 *
 * Architecture:
 * UI -> Authorization / Use Case -> Domain Service -> Repository -> Dexie Transaction
 */

import {
  UserRole,
  AppUser,
  UserSession,
  PermissionAction,
  AppLockSettings,
} from '../types';
import { db } from '../db/database';
import { recordAuditEvent } from './auditTrailService';
import { getStoredAppLockSettings } from '../utils/storage';
import { verifyAppLockPin } from './cryptoSecurity';

export class AuthorizationError extends Error {
  public readonly action: PermissionAction | string;
  public readonly effectiveRole: UserRole | string;
  public readonly code: string;

  constructor(
    action: PermissionAction | string,
    effectiveRole: UserRole | string,
    customMessage?: string
  ) {
    const roleLabel =
      effectiveRole === 'OWNER'
        ? 'ဆိုင်ရှင် (Owner)'
        : effectiveRole === 'USER'
        ? 'ဝန်ထမ်း (Staff/User)'
        : 'အကောင့်မရှိသူ (Unknown)';

    const msg =
      customMessage ||
      `ခွင့်ပြုချက်မရှိပါ: "${action}" လုပ်ဆောင်ချက်အား ${roleLabel} အဆင့်ဖြင့် ဆောင်ရွက်ခွင့်မရှိပါ။ ဆိုင်ရှင် (OWNER) ခွင့်ပြုချက် လိုအပ်ပါသည်။`;

    super(msg);
    this.name = 'AuthorizationError';
    this.action = action;
    this.effectiveRole = effectiveRole;
    this.code = 'PERMISSION_DENIED';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

// Canonical Default System Users
export const DEFAULT_OWNER_USER: AppUser = {
  id: 'user_owner',
  username: 'owner',
  displayName: 'ဆိုင်ရှင် (Owner)',
  role: 'OWNER',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_STAFF_USER: AppUser = {
  id: 'user_staff',
  username: 'staff',
  displayName: 'အရောင်း/ဝန်ထမ်း (Staff)',
  role: 'USER',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const OWNER_PERMISSIONS: ReadonlySet<PermissionAction> = new Set<PermissionAction>([
  'ACCESS_SETTINGS',
  'ACCESS_AUDIT_HISTORY',
  'MANAGE_MASTER_DATA',
  'DELETE_MASTER_DATA',
  'VOID_TRANSACTION',
  'DELETE_FINANCIAL_RECORD',
  'STOCK_TRANSFER',
  'STOCK_ADJUSTMENT',
  'CASH_ADJUSTMENT',
  'DAILY_CLOSING_CORRECTION',
  'PROCESS_RETURN_REFUND',
  'BACKUP_EXPORT',
  'BACKUP_RESTORE',
  'BUSINESS_INITIALIZATION',
  'DATABASE_REPAIR',
  'CLEAR_DATABASE',
  'MANAGE_USERS',
  'OPERATIONAL_DATA_ENTRY',
]);

const USER_PERMISSIONS: ReadonlySet<PermissionAction> = new Set<PermissionAction>([
  'OPERATIONAL_DATA_ENTRY',
]);

export const SESSION_STORAGE_KEY = 'shwe_let_yar_rbac_session';
export const SETTING_USERS_KEY = 'rbac_users';
export const SETTING_ACTIVE_SESSION_KEY = 'rbac_active_session';

// In-memory active session cache
let memorySession: UserSession | null = null;

/**
 * Initializes and retrieves all persisted users from Dexie db.settings table.
 */
export async function getPersistedUsers(): Promise<AppUser[]> {
  try {
    const record = await db.settings.get(SETTING_USERS_KEY);
    if (record && Array.isArray(record.value) && record.value.length > 0) {
      return record.value as AppUser[];
    }
  } catch (err) {
    console.warn('Failed to read users from db.settings, using defaults:', err);
  }

  // Fallback bootstrap
  const initialUsers: AppUser[] = [DEFAULT_OWNER_USER, DEFAULT_STAFF_USER];
  try {
    await db.settings.put({
      key: SETTING_USERS_KEY,
      value: initialUsers,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to bootstrap users to db.settings:', err);
  }
  return initialUsers;
}

/**
 * Persists an updated list of users to Dexie db.settings table.
 * Requires OWNER authorization.
 * Enforces Last Owner Protection (must retain at least one active OWNER).
 */
export async function savePersistedUsers(users: AppUser[]): Promise<void> {
  await enforcePermission('MANAGE_USERS', 'သုံးစွဲသူ အကောင့်များ ပြင်ဆင်သိမ်းဆည်းခြင်း');

  if (!Array.isArray(users) || users.length === 0) {
    throw new AuthorizationError(
      'MANAGE_USERS',
      'OWNER',
      'သုံးစွဲသူစာရင်း မရှိပါ။ အနည်းဆုံး ဆိုင်ရှင် (Owner) အကောင့် တစ်ခု ရှိရပါမည်။'
    );
  }

  const activeOwners = users.filter((u) => u.role === 'OWNER' && u.isActive !== false);
  if (activeOwners.length < 1) {
    throw new AuthorizationError(
      'MANAGE_USERS',
      'OWNER',
      'စနစ်တွင် အနည်းဆုံး အသုံးပြုနိုင်သော ပိုင်ရှင် (Active Owner) အကောင့် တစ်ခု ရှိရပါမည်။'
    );
  }

  await db.settings.put({
    key: SETTING_USERS_KEY,
    value: users,
    updatedAt: new Date().toISOString(),
  });
}

function safeGetSessionStorage(key: string): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }
  } catch {
    // Ignore storage errors in test or restricted environments
  }
  return null;
}

function safeSetSessionStorage(key: string, value: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors in test or restricted environments
  }
}

function safeRemoveSessionStorage(key: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors in test or restricted environments
  }
}

/**
 * Resolves current user session from canonical storage and validates its authenticity.
 * Never blindly trusts caller parameters or client-side role claims in sessionStorage/Dexie.
 * The effective role is ALWAYS derived from the canonical AppUser record in rbac_users.
 *
 * CRITICAL SECURITY INVARIANT:
 * If there is NO valid authenticated local session in memory, sessionStorage, or Dexie,
 * this function returns `null`. It NEVER silently manufactures an authenticated OWNER session.
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  const canonicalUsers = await getPersistedUsers();

  const validateAndBuildSession = (candidate: Partial<UserSession> | null): UserSession | null => {
    if (!candidate || !candidate.userId) return null;
    const canonicalUser = canonicalUsers.find((u) => u.id === candidate.userId);
    if (!canonicalUser || canonicalUser.isActive === false) return null;

    // Canonical role enforcement: role ALWAYS matches database truth, never client claim
    return {
      userId: canonicalUser.id,
      username: canonicalUser.username,
      displayName: canonicalUser.displayName,
      role: canonicalUser.role,
      loginTimestamp: candidate.loginTimestamp || new Date().toISOString(),
    };
  };

  // 1. Check memory session
  if (memorySession) {
    const validatedMemory = validateAndBuildSession(memorySession);
    if (validatedMemory) {
      memorySession = validatedMemory;
      return validatedMemory;
    }
    memorySession = null;
  }

  // 2. Check sessionStorage for tab persistence
  const raw = safeGetSessionStorage(SESSION_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<UserSession>;
      const validatedSession = validateAndBuildSession(parsed);
      if (validatedSession) {
        memorySession = validatedSession;
        safeSetSessionStorage(SESSION_STORAGE_KEY, JSON.stringify(validatedSession));
        return validatedSession;
      }
    } catch {
      // Ignore JSON parse error
    }
    safeRemoveSessionStorage(SESSION_STORAGE_KEY);
  }

  // 3. Check database active session setting
  try {
    const sessionRecord = await db.settings.get(SETTING_ACTIVE_SESSION_KEY);
    if (sessionRecord && sessionRecord.value) {
      const dbCandidate = sessionRecord.value as Partial<UserSession>;
      const validatedSession = validateAndBuildSession(dbCandidate);
      if (validatedSession) {
        memorySession = validatedSession;
        safeSetSessionStorage(SESSION_STORAGE_KEY, JSON.stringify(validatedSession));
        return validatedSession;
      }
    }
  } catch (err) {
    console.warn('Failed to load active session from db.settings:', err);
  }

  // 4. No valid active session exists. Return null without silent auto-authentication.
  return null;
}

/**
 * Clears the current active session from memory, sessionStorage, and Dexie settings.
 */
export async function clearCurrentSession(): Promise<void> {
  memorySession = null;
  safeRemoveSessionStorage(SESSION_STORAGE_KEY);
  try {
    await db.settings.delete(SETTING_ACTIVE_SESSION_KEY);
  } catch {
    // Ignore error in restricted/offline environments
  }
}

/**
 * Explicit First-Run / Onboarding Bootstrap Helper:
 * Establishes the initial Owner session during explicit application startup or onboarding.
 * Strictly separates account existence bootstrap from active session authentication.
 */
export async function bootstrapInitialOwnerSession(): Promise<UserSession> {
  const canonicalUsers = await getPersistedUsers();
  const ownerUser =
    canonicalUsers.find((u) => u.role === 'OWNER' && u.isActive !== false) ||
    DEFAULT_OWNER_USER;

  const initialSession: UserSession = {
    userId: ownerUser.id,
    username: ownerUser.username,
    displayName: ownerUser.displayName,
    role: ownerUser.role,
    loginTimestamp: new Date().toISOString(),
  };

  await setCurrentSession(initialSession);
  return initialSession;
}

/**
 * Updates the current active session in memory, sessionStorage, and Dexie settings.
 * Validates the session against canonical AppUser records to prevent arbitrary role setting.
 */
export async function setCurrentSession(session: Partial<UserSession> | null): Promise<UserSession | null> {
  if (!session || !session.userId) {
    await clearCurrentSession();
    return null;
  }

  const canonicalUsers = await getPersistedUsers();
  const canonicalUser = canonicalUsers.find((u) => u.id === session.userId);

  if (!canonicalUser || canonicalUser.isActive === false) {
    await clearCurrentSession();
    throw new AuthorizationError(
      'AUTHENTICATION',
      'UNKNOWN',
      'အသုံးပြုသူ အကောင့် မရှိပါ သို့မဟုတ် ပိတ်ထားပါသည်'
    );
  }

  // Enforce canonical role
  const validatedSession: UserSession = {
    userId: canonicalUser.id,
    username: canonicalUser.username,
    displayName: canonicalUser.displayName,
    role: canonicalUser.role,
    loginTimestamp: session.loginTimestamp || new Date().toISOString(),
  };

  memorySession = validatedSession;
  safeSetSessionStorage(SESSION_STORAGE_KEY, JSON.stringify(validatedSession));
  try {
    await db.settings.put({
      key: SETTING_ACTIVE_SESSION_KEY,
      value: validatedSession,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to persist session to db.settings:', err);
  }

  return validatedSession;
}

/**
 * Returns the effective user role ('OWNER' | 'USER' | 'UNAUTHENTICATED') after resolving canonical session.
 */
export async function getEffectiveRole(): Promise<UserRole | 'UNAUTHENTICATED'> {
  const session = await getCurrentSession();
  return session ? session.role : 'UNAUTHENTICATED';
}

/**
 * Pure check: Does a given role possess a permission?
 */
export function hasPermission(role: UserRole | string, action: PermissionAction): boolean {
  if (role === 'OWNER') {
    return OWNER_PERMISSIONS.has(action);
  }
  if (role === 'USER') {
    return USER_PERMISSIONS.has(action);
  }
  return false;
}

/**
 * Checks if current active session has a specific permission.
 */
export async function checkPermission(action: PermissionAction): Promise<boolean> {
  const session = await getCurrentSession();
  if (!session) return false;
  return hasPermission(session.role, action);
}

/**
 * Core Service-Level Gateway: Enforces that the current session has permission for an action.
 * If unauthorized, records an audit event and throws AuthorizationError.
 */
export async function enforcePermission(
  action: PermissionAction,
  context?: string
): Promise<UserSession> {
  const session = await getCurrentSession();

  if (!session || !session.userId) {
    throw new AuthorizationError(
      action,
      'UNAUTHENTICATED',
      'တရားဝင် session မရှိပါ။ စနစ်သို့ ပြန်လည်ဝင်ရောက်ပေးပါ'
    );
  }

  if (!hasPermission(session.role, action)) {
    // Log unauthorized attempt to audit trail asynchronously
    try {
      await recordAuditEvent(
        {
          action: 'ခွင့်ပြုချက်မရှိဘဲ လုပ်ဆောင်ရန် ကြိုးပမ်းမှု ငြင်းပယ်ခြင်း (Access Denied)',
          actionType: 'SYSTEM_ACTION',
          details: `အကောင့်: ${session.displayName} (${session.username}) | ရာထူး: ${session.role} | လိုအပ်သော ခွင့်ပြုချက်: ${action} | အကြောင်းအရာ: ${context || 'Denied'}`,
          referenceType: 'SECURITY',
          referenceId: session.userId,
          timestamp: new Date().toISOString(),
        },
        db
      );
    } catch {
      // Never allow audit logging failure to mask the authorization rejection
    }

    throw new AuthorizationError(action, session.role);
  }

  return session;
}

/**
 * Enforces that the current session is an OWNER.
 * Short-cut for critical owner-only operations.
 */
export async function requireOwner(actionName?: string): Promise<UserSession> {
  return enforcePermission('ACCESS_SETTINGS', actionName);
}

/**
 * Enforces that a valid authenticated session (USER or OWNER) exists.
 */
export async function requireUserOrOwner(actionName?: string): Promise<UserSession> {
  const session = await getCurrentSession();
  if (!session || !session.userId || (session.role !== 'OWNER' && session.role !== 'USER')) {
    throw new AuthorizationError(
      actionName || 'AUTHENTICATION',
      'UNAUTHENTICATED',
      'တရားဝင် session မရှိပါ။ ပြန်လည်ဝင်ရောက်ပေးပါ'
    );
  }
  return session;
}

/**
 * Authenticates and switches the active user session.
 * Prevents unauthorized privilege escalation:
 * - Switching from USER to OWNER requires verification of the Owner PIN if configured.
 */
export async function switchUserSession(
  targetRoleOrUserId: 'OWNER' | 'USER' | string,
  credentials?: { pin?: string }
): Promise<UserSession> {
  const currentSession = await getCurrentSession();
  const users = await getPersistedUsers();

  let targetUser: AppUser | undefined;

  if (targetRoleOrUserId === 'OWNER') {
    targetUser = users.find((u) => u.role === 'OWNER') || DEFAULT_OWNER_USER;
  } else if (targetRoleOrUserId === 'USER') {
    targetUser = users.find((u) => u.role === 'USER') || DEFAULT_STAFF_USER;
  } else {
    targetUser = users.find((u) => u.id === targetRoleOrUserId || u.username === targetRoleOrUserId);
  }

  if (!targetUser || !targetUser.isActive) {
    throw new Error('သတ်မှတ်ထားသော အကောင့်ကို ရှာမတွေ့ပါ သို့မဟုတ် ပိတ်ထားပါသည်');
  }

  // Privilege Escalation Check: If promoting to OWNER from USER or unauthenticated state
  const isPrivilegeEscalation = targetUser.role === 'OWNER' && (!currentSession || currentSession.role !== 'OWNER');
  if (isPrivilegeEscalation) {
    let lockSettings: AppLockSettings = getStoredAppLockSettings();
    try {
      const dbLockRecord = await db.settings.get('appLockSettings');
      if (dbLockRecord && dbLockRecord.value) {
        lockSettings = { ...lockSettings, ...(dbLockRecord.value as any) };
      }
    } catch {}

    const isLockEnabled = Boolean(lockSettings.enabled || (lockSettings as any).isEnabled);
    if (isLockEnabled && (lockSettings.pinHash || lockSettings.passcode || lockSettings.pin)) {
      if (!credentials?.pin) {
        throw new AuthorizationError(
          'ROLE_ESCALATION_REJECTED',
          currentSession?.role || 'UNAUTHENTICATED',
          'ဆိုင်ရှင် (Owner) အဖြစ် ပြောင်းလဲရန် ဆိုင်ရှင် PIN ရိုက်ထည့်ပေးရန် လိုအပ်ပါသည်'
        );
      }
      const isPinValid = await verifyAppLockPin(credentials.pin, lockSettings);
      if (!isPinValid) {
        // Record failed escalation in audit trail
        try {
          await recordAuditEvent(
            {
              action: 'ဆိုင်ရှင်အဖြစ် ပြောင်းလဲရန် PIN မှားယွင်းမှု (Escalation Denied)',
              actionType: 'SYSTEM_ACTION',
              details: `ကြိုးပမ်းသူ: ${currentSession?.displayName || 'Unauthenticated'} | မှားယွင်းသော PIN ဖြင့် ကြိုးပမ်းသည်`,
              referenceType: 'SECURITY',
              referenceId: currentSession?.userId || 'unauthenticated',
              timestamp: new Date().toISOString(),
            },
            db
          );
        } catch {}
        throw new AuthorizationError(
          'ROLE_ESCALATION_REJECTED',
          currentSession?.role || 'UNAUTHENTICATED',
          'ဆိုင်ရှင် PIN မှားယွင်းနေပါသည်။ ရာထူးတိုးမြှင့်ခွင့် ငြင်းပယ်ပါသည်'
        );
      }
    }
  }

  const nowIso = new Date().toISOString();
  const newSession: UserSession = {
    userId: targetUser.id,
    username: targetUser.username,
    displayName: targetUser.displayName,
    role: targetUser.role,
    loginTimestamp: nowIso,
  };

  await setCurrentSession(newSession);

  // Log successful session switch
  try {
    await recordAuditEvent(
      {
        action: 'အသုံးပြုသူ အကောင့်ပြောင်းလဲခြင်း (Session Switched)',
        actionType: 'SYSTEM_ACTION',
        details: `ယခင်: ${currentSession ? `${currentSession.displayName} (${currentSession.role})` : 'Unauthenticated'} -> လက်ရှိ: ${newSession.displayName} (${newSession.role})`,
        referenceType: 'SECURITY',
        referenceId: newSession.userId,
        timestamp: nowIso,
      },
      db
    );
  } catch {}

  return newSession;
}

/**
 * Convenient helper to switch into Staff (USER) mode.
 */
export async function loginAsStaff(): Promise<UserSession> {
  return switchUserSession('USER');
}

/**
 * Convenient helper to switch into Owner (OWNER) mode.
 */
export async function loginAsOwner(pin?: string): Promise<UserSession> {
  return switchUserSession('OWNER', { pin });
}

/**
 * Explicit testing/reset helper to safely override active session.
 */
export async function resetSessionForTesting(role: UserRole = 'OWNER'): Promise<UserSession> {
  const initialUsers: AppUser[] = [
    { ...DEFAULT_OWNER_USER, isActive: true },
    { ...DEFAULT_STAFF_USER, isActive: true },
  ];
  try {
    await db.settings.put({
      key: SETTING_USERS_KEY,
      value: initialUsers,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Ignore db error in unit tests
  }

  const session: UserSession = {
    userId: role === 'OWNER' ? DEFAULT_OWNER_USER.id : DEFAULT_STAFF_USER.id,
    username: role === 'OWNER' ? DEFAULT_OWNER_USER.username : DEFAULT_STAFF_USER.username,
    displayName: role === 'OWNER' ? DEFAULT_OWNER_USER.displayName : DEFAULT_STAFF_USER.displayName,
    role,
    loginTimestamp: new Date().toISOString(),
  };
  await setCurrentSession(session);
  return session;
}
