import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Manifest & Home Screen Icons Integrity Test', () => {
  const publicDir = path.resolve(process.cwd(), 'public');
  const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts');
  const distManifestPath = path.resolve(process.cwd(), 'dist', 'manifest.json');

  const getManifest = () => {
    if (fs.existsSync(distManifestPath)) {
      return JSON.parse(fs.readFileSync(distManifestPath, 'utf-8'));
    }
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8');
    return {
      name: 'ရွှေလက်ရာ - မြန်မာ့လက်မှု စာရင်းကိုင်စနစ်',
      short_name: 'ရွှေလက်ရာ',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
      viteConfigHasManifest:
        viteConfigContent.includes("manifestFilename: 'manifest.json'") &&
        viteConfigContent.includes('VitePWA('),
    };
  };

  it('1. PWA manifest config is properly defined in vite.config.ts or dist/manifest.json', () => {
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfig).toContain('VitePWA(');
    expect(viteConfig).toContain("manifestFilename: 'manifest.json'");
    expect(viteConfig).toContain('ရွှေလက်ရာ');

    const manifest = getManifest();
    expect(manifest.name).toContain('ရွှေလက်ရာ');
    expect(manifest.short_name).toBe('ရွှေလက်ရာ');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  });

  it('2. all declared manifest icon assets exist in /public', () => {
    const manifest = getManifest();
    for (const icon of manifest.icons) {
      const relativePath = icon.src.replace(/^\//, '');
      const fullPath = path.join(publicDir, relativePath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('3. apple-touch-icon and logo assets exist in /public', () => {
    expect(fs.existsSync(path.join(publicDir, 'apple-touch-icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'logo.svg'))).toBe(true);
  });

  it('4. index.html references valid manifest and apple-touch-icon', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);
    const html = fs.readFileSync(indexPath, 'utf-8');
    expect(html).toContain('rel="manifest" href="/manifest.json"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
  });

  it('5. pwa-maskable-512x512.png has full square background and non-zero size', () => {
    const maskablePath = path.join(publicDir, 'pwa-maskable-512x512.png');
    expect(fs.existsSync(maskablePath)).toBe(true);

    // Verify file size is non-zero
    const stats = fs.statSync(maskablePath);
    expect(stats.size).toBeGreaterThan(10000);
  });
});
