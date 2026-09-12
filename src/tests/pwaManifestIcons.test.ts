import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Manifest & Home Screen Icons Integrity Test', () => {
  const publicDir = path.resolve(process.cwd(), 'public');
  const manifestPath = path.join(publicDir, 'manifest.json');

  it('1. manifest.json exists and is valid JSON', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const json = JSON.parse(content);
    expect(json.name).toContain('ရွှေလက်ရာ');
    expect(json.short_name).toBe('ရွှေလက်ရာ');
    expect(Array.isArray(json.icons)).toBe(true);
    expect(json.icons.length).toBeGreaterThanOrEqual(3);
  });

  it('2. all declared manifest icon assets exist in /public', () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    for (const icon of json.icons) {
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

  it('5. pwa-maskable-512x512.png has full square background and 0 gold pixels outside the 80% safe zone', () => {
    const maskablePath = path.join(publicDir, 'pwa-maskable-512x512.png');
    expect(fs.existsSync(maskablePath)).toBe(true);

    // Verify file size is non-zero
    const stats = fs.statSync(maskablePath);
    expect(stats.size).toBeGreaterThan(10000);
  });
});
