import { db } from './database';
import { MIGRATION_FLAG_KEY } from './migration';

export type DatabaseState =
  | 'NOT_INITIALIZED'
  | 'INITIALIZED_EMPTY'
  | 'LOADED'
  | 'CORRUPT'
  | 'MIGRATION_REQUIRED'
  | 'MIGRATION_FAILED'
  | 'INCOMPLETE_MIGRATION';

export const DB_INITIALIZED_KEY = 'shwe_let_yar_db_initialized_v1';

export interface DatabaseStatus {
  state: DatabaseState;
  isFreshInstall: boolean;
  isEmpty: boolean;
  isCorrupt: boolean;
  migrationStatus: 'NOT_NEEDED' | 'REQUIRED' | 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  counts: {
    products: number;
    suppliers: number;
    merchants: number;
    transactions: number;
    sales: number;
    orders: number;
    purchases: number;
    stockAdjustments: number;
    peerTrades: number;
  };
  errorMessage?: string;
}

/**
 * Audit and determine exact database state
 */
export async function auditDatabaseState(overrideDb?: any): Promise<DatabaseStatus> {
  const activeDb = overrideDb || db;
  let isCorrupt = false;
  let errorMessage: string | undefined;

  // 1. Test database health
  try {
    await activeDb.settings.limit(1).toArray();
  } catch (err: any) {
    isCorrupt = true;
    errorMessage = `Database query error: ${err?.message || String(err)}`;
  }

  if (isCorrupt) {
    return {
      state: 'CORRUPT',
      isFreshInstall: false,
      isEmpty: true,
      isCorrupt: true,
      migrationStatus: 'FAILED',
      counts: { products: 0, suppliers: 0, merchants: 0, transactions: 0, sales: 0, orders: 0, purchases: 0, stockAdjustments: 0, peerTrades: 0 },
      errorMessage,
    };
  }

  // 2. Count current records in IndexedDB
  let counts = {
    products: 0,
    suppliers: 0,
    merchants: 0,
    transactions: 0,
    sales: 0,
    orders: 0,
    purchases: 0,
    stockAdjustments: 0,
    peerTrades: 0,
  };

  try {
    const [p, s, m, t, sl, o, pur, adj, pt] = await Promise.all([
      activeDb.products.count(),
      activeDb.suppliers.count(),
      activeDb.merchants.count(),
      activeDb.transactions.count(),
      activeDb.sales.count(),
      activeDb.orders.count(),
      activeDb.merchantPurchases.count(),
      activeDb.stockAdjustments.count(),
      activeDb.peerTrades.count(),
    ]);
    counts = { products: p, suppliers: s, merchants: m, transactions: t, sales: sl, orders: o, purchases: pur, stockAdjustments: adj, peerTrades: pt };
  } catch (err: any) {
    return {
      state: 'CORRUPT',
      isFreshInstall: false,
      isEmpty: true,
      isCorrupt: true,
      migrationStatus: 'FAILED',
      counts,
      errorMessage: `Failed counting records: ${err?.message || String(err)}`,
    };
  }

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  // 3. Check migration flag and init flag
  const migrationFlag = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(MIGRATION_FLAG_KEY) : null;
  const initFlag = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(DB_INITIALIZED_KEY) : null;

  let migrationStatus: DatabaseStatus['migrationStatus'] = 'NOT_NEEDED';
  if (migrationFlag === 'FAILED') migrationStatus = 'FAILED';
  else if (migrationFlag === 'IN_PROGRESS') migrationStatus = 'IN_PROGRESS';
  else if (migrationFlag === 'COMPLETED') migrationStatus = 'COMPLETED';

  // Check for legacy localStorage data needing migration
  let hasLegacyData = false;
  if (typeof window !== 'undefined' && window.localStorage && migrationFlag !== 'COMPLETED') {
    const legacyKeys = ['ledger_products_v2', 'ledger_suppliers_v2', 'ledger_transactions_v2', 'ledger_sales_v2', 'ledger_products_v1'];
    for (const k of legacyKeys) {
      const val = localStorage.getItem(k);
      if (val && val !== '[]' && val !== 'null') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasLegacyData = true;
            break;
          }
        } catch {}
      }
    }
  }

  if (hasLegacyData && migrationFlag !== 'COMPLETED') {
    migrationStatus = 'REQUIRED';
  }

  // Determine state
  let state: DatabaseState = 'NOT_INITIALIZED';

  if (migrationFlag === 'FAILED') {
    state = 'MIGRATION_FAILED';
  } else if (migrationFlag === 'IN_PROGRESS') {
    state = 'INCOMPLETE_MIGRATION';
  } else if (hasLegacyData && migrationFlag !== 'COMPLETED') {
    state = 'MIGRATION_REQUIRED';
  } else if (initFlag || migrationFlag === 'COMPLETED') {
    if (totalRecords === 0) {
      state = 'INITIALIZED_EMPTY';
    } else {
      state = 'LOADED';
    }
  } else {
    // Neither initFlag nor migration completed flag exists
    if (totalRecords > 0) {
      state = 'LOADED';
      markDatabaseInitialized();
    } else {
      state = 'NOT_INITIALIZED';
    }
  }

  return {
    state,
    isFreshInstall: state === 'NOT_INITIALIZED',
    isEmpty: totalRecords === 0,
    isCorrupt: false,
    migrationStatus,
    counts,
  };
}

export function markDatabaseInitialized(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(DB_INITIALIZED_KEY, new Date().toISOString());
    localStorage.setItem(MIGRATION_FLAG_KEY, 'COMPLETED');
  }
}
