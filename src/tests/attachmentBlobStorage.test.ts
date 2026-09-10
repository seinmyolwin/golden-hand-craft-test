import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import {
  validateAttachmentFile,
  processImageInput,
  saveAttachmentRecord,
  getAttachmentsForVoucher,
  deleteAttachmentSafely,
  cleanupOrphanAttachments,
  migrateLegacyAttachments,
  formatStorageError,
  isQuotaExceededError,
  MAX_ATTACHMENT_SIZE_BYTES,
  blobToBase64,
  base64ToBlob,
} from '../services/attachmentService';
import { createCompleteBackup, validateBackupFile, executeSafeRestore } from '../services/backupService';

// Ensure localStorage is mocked if running in pure Node vitest environment
if (typeof localStorage === 'undefined') {
  const storageMap = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, val: string) => storageMap.set(key, String(val)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
    key: (idx: number) => Array.from(storageMap.keys())[idx] || null,
    length: 0,
  } as any;
}

describe('Attachment & Photo Storage Engine Audit', () => {
  beforeEach(async () => {
    await db.attachments.clear();
    await db.transactions.clear();
    await db.sales.clear();
    await db.merchantPurchases.clear();
    await db.orders.clear();
  });

  it('1. Requirement 1: Validates file type and rejects invalid non-image files', () => {
    const invalidFile = new File(['text content'], 'doc.txt', { type: 'text/plain' });
    expect(() => validateAttachmentFile(invalidFile)).toThrow(/မမှန်ကန်သော ဖိုင်အမျိုးအစား/);
  });

  it('2. Requirement 2: Validates maximum file size limit (15MB)', () => {
    // Create dummy oversized Blob (16MB)
    const largeBlob = new Blob([new Uint8Array(16 * 1024 * 1024)], { type: 'image/jpeg' });
    expect(() => validateAttachmentFile(largeBlob)).toThrow(/ဓာတ်ပုံ ပမာဏ ကြီးလွန်းပါသည်/);

    // Valid 2MB Blob
    const validBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'image/jpeg' });
    expect(() => validateAttachmentFile(validBlob)).not.toThrow();
  });

  it('3 & 4. Requirement 3 & 4: Processes images, compresses and generates thumbnails', async () => {
    const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const processed = await processImageInput(mockBase64);

    expect(processed.blob).toBeInstanceOf(Blob);
    expect(processed.blob.size).toBeGreaterThan(0);
    expect(processed.thumbnail).toBeDefined();
    expect(typeof processed.thumbnail).toBe('string');
    expect(processed.mimeType).toBeDefined();
    expect(processed.width).toBeGreaterThan(0);
    expect(processed.height).toBeGreaterThan(0);
  });

  it('5 & 6. Requirement 5 & 6: Saves attachments as IndexedDB Blobs with metadata without memory leaks', async () => {
    const sampleBlob = base64ToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    
    const record = await saveAttachmentRecord({
      voucherId: 'vch_1001',
      ownerId: 'tx_1001',
      input: sampleBlob,
      caption: 'Delivery Receipt Photo',
    });

    expect(record.id).toBeDefined();
    expect(record.voucherId).toBe('vch_1001');
    expect(record.ownerId).toBe('tx_1001');
    expect(record.blob).toBeInstanceOf(Blob);
    expect(record.thumbnail).toBeDefined();
    expect(record.caption).toBe('Delivery Receipt Photo');

    const fetched = await getAttachmentsForVoucher('vch_1001');
    expect(fetched).toHaveLength(1);
    expect(fetched[0].id).toBe(record.id);
  });

  it('7. Requirement 7: Cleans up orphan attachments not linked to active business records', async () => {
    // Save orphan attachment with non-existent voucher
    await saveAttachmentRecord({
      voucherId: 'vch_orphan_999',
      ownerId: 'tx_orphan_999',
      input: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });

    // Create an active transaction with linked voucher
    await db.transactions.put({
      id: 'tx_active_1',
      voucherNo: 'vch_active_1',
      supplierId: 'sup_1',
      supplierName: 'ဦးဘ',
      date: '2026-03-30',
      time: '10:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      totalGoodsValue: 10000,
      previousAdvanceBalance: 0,
      advanceDeducted: 0,
      newAdvanceTaken: 0,
      netCashPaidToSupplier: 10000,
      remainingAdvanceBalance: 0,
    });

    // Save linked active attachment
    await saveAttachmentRecord({
      voucherId: 'vch_active_1',
      ownerId: 'tx_active_1',
      input: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });

    expect(await db.attachments.count()).toBe(2);

    const deletedOrphans = await cleanupOrphanAttachments();
    expect(deletedOrphans).toBe(1);
    expect(await db.attachments.count()).toBe(1);

    const remaining = await db.attachments.toArray();
    expect(remaining[0].voucherId).toBe('vch_active_1');
  });

  it('8. Requirement 8: Prevents deleting an attachment referenced by an active business record', async () => {
    await db.sales.put({
      id: 'sale_100',
      voucherNo: 'vch_sale_100',
      merchantId: 'merch_1',
      merchantName: 'မန္တလေး ကုန်သည်',
      merchantTown: 'မန္တလေး',
      date: '2026-03-30',
      time: '11:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      totalItemsCount: 0,
      totalGoodsValue: 50000,
      grandTotal: 50000,
      cashPaidByMerchant: 50000,
      remainingReceivableBalance: 0,
    });

    const att = await saveAttachmentRecord({
      voucherId: 'vch_sale_100',
      ownerId: 'sale_100',
      input: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });

    // Attempting delete without force should fail because sale record references it
    await expect(deleteAttachmentSafely(att.id)).rejects.toThrow(/အသုံးပြုနေဆဲဖြစ်သဖြင့် ဖျက်၍မရပါ/);

    // Force delete should succeed if explicitly specified
    await deleteAttachmentSafely(att.id, { force: true });
    expect(await db.attachments.count()).toBe(0);
  });

  it('9 & 10. Requirement 9 & 10: Safely migrates legacy base64 attachments to IndexedDB Blobs', async () => {
    // Put legacy attachment into DB containing only imageBase64
    const legacyId = 'legacy_att_1';
    const legacyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await db.attachments.put({
      id: legacyId,
      voucherId: 'vch_legacy',
      imageBase64: legacyBase64,
      createdAt: new Date().toISOString(),
    });

    const initial = await db.attachments.get(legacyId);
    expect(initial?.blob).toBeUndefined();

    const migratedCount = await migrateLegacyAttachments();
    expect(migratedCount).toBe(1);

    const updated = await db.attachments.get(legacyId);
    expect(updated?.blob).toBeInstanceOf(Blob);
    expect(updated?.blob?.size).toBeGreaterThan(0);
    expect(updated?.thumbnail).toBeDefined();
    // Verify old data is preserved for safety
    expect(updated?.imageBase64).toBe(legacyBase64);
  });

  it('11. Requirement 11: Safely includes attachment Blobs in backup creation and restore', async () => {
    const sampleBlob = base64ToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    
    await saveAttachmentRecord({
      voucherId: 'vch_backup_test',
      input: sampleBlob,
      caption: 'Backup test photo',
    });

    // Create complete backup file
    const backupFile = await createCompleteBackup();
    expect(backupFile.data.attachments).toBeDefined();
    expect(backupFile.data.attachments.length).toBe(1);
    expect(backupFile.data.attachments[0].imageBase64).toBeDefined();

    // Clear DB
    await db.attachments.clear();
    expect(await db.attachments.count()).toBe(0);

    // Restore backup
    const report = await validateBackupFile(JSON.stringify(backupFile));
    expect(report.isValid).toBe(true);
    await executeSafeRestore(report, 'OVERWRITE');
    expect(await db.attachments.count()).toBe(1);

    const restored = await db.attachments.toArray();
    expect(restored[0].blob).toBeInstanceOf(Blob);
    expect(restored[0].blob?.size).toBeGreaterThan(0);
    expect(restored[0].caption).toBe('Backup test photo');
  });

  it('12. Requirement 12: Handles storage quota error explicitly with localized error feedback', () => {
    const quotaErr = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    expect(isQuotaExceededError(quotaErr)).toBe(true);

    const formatted = formatStorageError(quotaErr);
    expect(formatted.message).toContain('သိုလှောင်မှု ပမာဏ ပြည့်သွားပါပြီ');
  });
});
