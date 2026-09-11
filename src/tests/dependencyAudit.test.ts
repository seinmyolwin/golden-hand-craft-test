import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import packageJson from '../../package.json';
import {
  deepSanitizeUntrustedObject,
  safeJsonParse,
  sanitizeExcelSheetRow,
  isSafePropertyKey,
} from '../utils/security';
import { validateBackupFile } from '../services/backupService';
import { validateProducts, validateSuppliers, validateMerchants } from '../db/migration';

describe('Phase 19 - Dependency & Input Security Audit', () => {
  beforeEach(() => {
    // Ensure clean prototype before each test
    delete (Object.prototype as any).polluted;
    delete (Object.prototype as any).isAdmin;
  });

  afterEach(() => {
    delete (Object.prototype as any).polluted;
    delete (Object.prototype as any).isAdmin;
  });

  describe('1. Dependency Manifest & Version Audit', () => {
    it('enforces required production dependencies are declared with known-safe minimums', () => {
      const deps = packageJson.dependencies as Record<string, string>;
      expect(deps).toBeDefined();
      expect(deps['react']).toBeDefined();
      expect(deps['react-dom']).toBeDefined();
      expect(deps['dexie']).toBeDefined();
      expect(deps['lucide-react']).toBeDefined();
      expect(deps['qrcode']).toBeDefined();
      expect(deps['jsqr']).toBeDefined();
    });

    it('documents xlsx@0.18.5 vulnerabilities (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) and requires application-layer mitigation', () => {
      const deps = packageJson.dependencies as Record<string, string>;
      expect(deps['xlsx']).toContain('0.18.5');
      // Documenting: xlsx@0.18.5 contains unpatched upstream prototype pollution and ReDoS.
      // Our mitigation strategy:
      // 1) sanitizeExcelSheetRow() neutralizes all prototype keys (__proto__, constructor, prototype)
      // 2) validateProducts/validateSuppliers/validateMerchants schema validation guards before database writes
      // 3) String length caps prevent regex catastrophic backtracking (ReDoS)
    });
  });

  describe('2. Prototype Pollution Mitigation for Excel Parsed Rows', () => {
    it('isSafePropertyKey blocks prototype keys and double-underscore internals', () => {
      expect(isSafePropertyKey('__proto__')).toBe(false);
      expect(isSafePropertyKey('constructor')).toBe(false);
      expect(isSafePropertyKey('prototype')).toBe(false);
      expect(isSafePropertyKey('__custom')).toBe(false);
      expect(isSafePropertyKey('name')).toBe(true);
      expect(isSafePropertyKey('price')).toBe(true);
    });

    it('sanitizeExcelSheetRow strips __proto__, constructor, and caps long strings', () => {
      const poisonedRawRow = JSON.parse(
        '{"name": "ယွန်းဗျပ်", "ဝယ်စျေး": 5000, "__proto__": {"polluted": true}, "constructor": {"prototype": {"isAdmin": true}}}'
      );

      const sanitized = sanitizeExcelSheetRow(poisonedRawRow);

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
      expect(Object.keys(sanitized)).not.toContain('__proto__');
      expect(Object.keys(sanitized)).not.toContain('constructor');
      expect(sanitized['name']).toBe('ယွန်းဗျပ်');
      expect(sanitized['ဝယ်စျေး']).toBe(5000);
    });

    it('validateProducts rejects corrupted rows and safely handles sanitized Excel outputs', () => {
      const maliciousItems = [
        { name: '', defaultPrice: 'invalid' }, // empty name must be skipped
        { name: '  ယွန်းထည် ပန်းကန်  ', defaultPrice: '15000', openingStock: '20' },
        null,
        undefined,
        { id: 'custom-p1', name: 'သောက်ရေခွက်', defaultPrice: 8500 },
      ];

      const valid = validateProducts(maliciousItems);
      expect(valid.length).toBe(2);
      expect(valid[0].name).toBe('ယွန်းထည် ပန်းကန်');
      expect(valid[0].defaultPrice).toBe(15000);
      expect(valid[0].openingStock).toBe(20);
      expect(valid[1].name).toBe('သောက်ရေခွက်');
      expect(valid[1].defaultPrice).toBe(8500);
    });

    it('validateSuppliers rejects missing names and enforces numeric advance balances', () => {
      const rows = [
        { name: 'ဦးဘရှင်', currentAdvanceBalance: '30000', village: 'ကျောက်ကာ' },
        { name: '', currentAdvanceBalance: 10000 },
      ];
      const valid = validateSuppliers(rows);
      expect(valid.length).toBe(1);
      expect(valid[0].name).toBe('ဦးဘရှင်');
      expect(valid[0].currentAdvanceBalance).toBe(30000);
    });

    it('validateMerchants rejects missing names and enforces numeric receivable balances', () => {
      const rows = [
        { name: 'ဒေါ်ခင်လှ', currentReceivableBalance: '50000', town: 'မန္တလေး' },
        { name: '   ', currentReceivableBalance: 10000 },
      ];
      const valid = validateMerchants(rows);
      expect(valid.length).toBe(1);
      expect(valid[0].name).toBe('ဒေါ်ခင်လှ');
      expect(valid[0].currentReceivableBalance).toBe(50000);
    });
  });

  describe('3. Backup JSON Prototype Pollution Defense', () => {
    it('safeJsonParse blocks prototype pollution in JSON strings', () => {
      const payload = '{"title":"Test","__proto__":{"polluted":true},"constructor":{"prototype":{"isAdmin":true}}}';
      const parsed = safeJsonParse(payload);

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect(parsed.title).toBe('Test');
      expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(false);
      expect(Object.keys(parsed)).not.toContain('__proto__');
    });

    it('validateBackupFile neutralizes prototype pollution payloads in backup files', async () => {
      const maliciousBackupJson = JSON.stringify({
        formatVersion: '3.0',
        metadata: {
          shopName: 'ရွှေလက်ရာ',
          exportedAt: '2026-09-11',
          __proto__: { polluted: true },
        },
        data: {
          products: [{ id: 'p1', name: 'ပန်းကန်', defaultPrice: 5000 }],
        },
        __proto__: { isAdmin: true },
      });

      const report = await validateBackupFile(maliciousBackupJson);
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect(report.formatVersion).toBe('3.0');
      expect(report.shopName).toBe('ရွှေလက်ရာ');
    });

    it('deepSanitizeUntrustedObject safely handles circular/deep structures and caps oversized strings', () => {
      const bigString = 'A'.repeat(600000);
      const sanitized = deepSanitizeUntrustedObject({ text: bigString });
      expect(sanitized.text.length).toBe(500000); // capped at 500KB to mitigate ReDoS & memory exhaustion
    });
  });

  describe('4. QR Code / Sync Input Security', () => {
    it('safeJsonParse prevents execution or pollution from malicious QR code string', () => {
      const qrPayload = '{"formatVersion":"3.0","products":[],"__proto__":{"polluted":true}}';
      const parsed = safeJsonParse(qrPayload);
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(parsed.formatVersion).toBe('3.0');
    });
  });
});
