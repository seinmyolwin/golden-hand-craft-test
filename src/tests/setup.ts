import { beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { resetSessionForTesting } from '../services/authorizationService';

// Polyfill localStorage & sessionStorage for tests
if (typeof localStorage === 'undefined' || !localStorage.getItem) {
  const store: Record<string, string> = {};
  const lsMock = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  (globalThis as any).localStorage = lsMock;
}

if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (!(globalThis as any).window.localStorage) {
  (globalThis as any).window.localStorage = (globalThis as any).localStorage;
}

if (typeof sessionStorage === 'undefined' || !sessionStorage.getItem) {
  const sessionStore: Record<string, string> = {};
  const ssMock = {
    getItem: (key: string) => (key in sessionStore ? sessionStore[key] : null),
    setItem: (key: string, value: string) => {
      sessionStore[key] = String(value);
    },
    removeItem: (key: string) => {
      delete sessionStore[key];
    },
    clear: () => {
      for (const k of Object.keys(sessionStore)) delete sessionStore[k];
    },
  };
  (globalThis as any).sessionStorage = ssMock;
}
if (!(globalThis as any).window.sessionStorage) {
  (globalThis as any).window.sessionStorage = (globalThis as any).sessionStorage;
}

// By default in test suites, start each test with an authorized OWNER test session
beforeEach(async () => {
  try {
    await resetSessionForTesting('OWNER');
  } catch {
    // Ignore in tests that clear or customize db
  }
});
