import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { getStoredShopSettings, saveStoredShopSettings, DEFAULT_SHOP_SETTINGS } from '../utils/storage';

// Polyfill localStorage for Node Vitest test runner
const memoryStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  length: 0,
  key: () => null,
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
  (globalThis as any).window = globalThis;
}

describe('Production Offline PWA Audit & Offline Capability Test Suite', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.orders.clear();
    await db.merchants.clear();
    await db.suppliers.clear();
  });

  afterEach(async () => {
    await db.products.clear();
    await db.orders.clear();
  });

  describe('1. Production Build Asset Audit', () => {
    const distPath = path.resolve(__dirname, '../../dist');

    it('verifies dist directory exists and contains index.html, sw.js, and manifest', () => {
      expect(fs.existsSync(distPath)).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'sw.js'))).toBe(true);
      
      const manifestExists =
        fs.existsSync(path.join(distPath, 'manifest.webmanifest')) ||
        fs.existsSync(path.join(distPath, 'manifest.json'));
      expect(manifestExists).toBe(true);
    });

    it('verifies all generated JS and CSS bundle assets exist in dist/assets', () => {
      const assetsPath = path.join(distPath, 'assets');
      expect(fs.existsSync(assetsPath)).toBe(true);
      
      const assetFiles = fs.readdirSync(assetsPath);
      const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));
      const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));

      expect(jsFiles.length).toBeGreaterThan(0);
      expect(cssFiles.length).toBeGreaterThan(0);
    });

    it('verifies all PWA icons exist in dist root with non-zero size', () => {
      const requiredIcons = [
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
        'apple-touch-icon.png',
        'logo.png',
        'logo.svg',
        'favicon.ico',
      ];

      for (const icon of requiredIcons) {
        const iconPath = path.join(distPath, icon);
        expect(fs.existsSync(iconPath)).toBe(true);
        const stat = fs.statSync(iconPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Service Worker Code Audit', () => {
    const swPath = path.resolve(__dirname, '../../dist/sw.js');

    it('verifies sw.js contains precache manifest with hashed JS, CSS, HTML, and icons', () => {
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain('precacheAndRoute');
      expect(swContent).toContain('index.html');
      expect(swContent).toContain('assets/');
      expect(swContent).toContain('pwa-192x192.png');
      expect(swContent).toContain('pwa-512x512.png');
    });

    it('verifies sw.js contains SKIP_WAITING message listener and cleanupOutdatedCaches', () => {
      const swContent = fs.readFileSync(swPath, 'utf-8');

      expect(swContent).toContain('SKIP_WAITING');
      expect(swContent).toContain('cleanupOutdatedCaches');
      expect(swContent).toContain('NavigationRoute');
    });
  });

  describe('3. External Dependency Audit (Strict Zero-Remote Requirement)', () => {
    it('verifies index.html contains ZERO external fonts, CDN scripts, or remote CSS', () => {
      const htmlPath = path.resolve(__dirname, '../../index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

      expect(htmlContent).not.toContain('fonts.googleapis.com');
      expect(htmlContent).not.toContain('fonts.gstatic.com');
      expect(htmlContent).not.toContain('cdnjs.cloudflare.com');
      expect(htmlContent).not.toContain('unpkg.com');
      expect(htmlContent).not.toContain('cdn.jsdelivr.net');
    });

    it('verifies generated JS bundle contains no Google Fonts or remote analytics URLs', () => {
      const distAssets = path.resolve(__dirname, '../../dist/assets');
      const files = fs.readdirSync(distAssets);
      const mainJs = files.find((f) => f.endsWith('.js'));
      expect(mainJs).toBeDefined();

      const jsContent = fs.readFileSync(path.join(distAssets, mainJs!), 'utf-8');
      expect(jsContent).not.toContain('fonts.googleapis.com');
      expect(jsContent).not.toContain('google-analytics.com');
      expect(jsContent).not.toContain('googletagmanager.com');
    });
  });

  describe('4. Simulated Offline Operations (DevTools Network = Offline)', () => {
    it('executes Dexie IndexedDB read, write, and query transactions while offline', async () => {
      // Simulate navigator.onLine = false
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      expect(navigator.onLine).toBe(false);

      // 1. Create product offline
      const productId = await db.products.add({
        id: 'prod-offline-1',
        name: 'အော့ဖ်လိုင်း ယွန်းပန်းကန်',
        category: 'ယွန်းထည်',
        defaultPrice: 15000,
        openingStock: 50,
        currentStock: 50,
        unit: 'ခု',
        active: true,
        updatedAt: new Date().toISOString(),
      });

      expect(productId).toBe('prod-offline-1');

      // 2. Query product offline
      const fetched = await db.products.get('prod-offline-1');
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe('အော့ဖ်လိုင်း ယွန်းပန်းကန်');
      expect(fetched?.currentStock).toBe(50);

      // 3. Perform update offline
      await db.products.update('prod-offline-1', { currentStock: 45 });
      const updated = await db.products.get('prod-offline-1');
      expect(updated?.currentStock).toBe(45);

      // 4. Test storage preferences offline
      saveStoredShopSettings({
        ...DEFAULT_SHOP_SETTINGS,
        shopName: 'အော့ဖ်လိုင်း လက်မှုဆိုင်',
      });

      const storedShop = getStoredShopSettings();
      expect(storedShop.shopName).toBe('အော့ဖ်လိုင်း လက်မှုဆိုင်');

      // Restore navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true,
      });
    });
  });
});
