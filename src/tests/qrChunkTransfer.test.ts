import { describe, it, expect } from 'vitest';
import { db } from '../db/database';
import { executeSyncMerge, persistMergedDataToDatabase, buildLatestSyncPackage } from '../services/syncMergeService';
import {
  encodeForQrTransfer,
  decodeQrChunks,
  parseQrFrame,
  calculateCrc32,
  QrChunkReceiver,
  calculateRequiredChunks,
} from '../utils/qrChunkTransfer';

describe('Phase 21 — Chunked & Animated QR Transfer Tests', () => {
  // Test A: Small Object (< 1 chunk)
  it('a. Encodes a small object (< 1 chunk) and decodes back with deep equality', () => {
    const smallPayload = {
      version: '1.0.0',
      shweLetYarSync: true,
      shopSettings: {
        shopName: 'ရွှေလက်ရာ',
        ownerName: 'ဒေါ်အေးအေး',
        phone: '09123456789',
      },
      products: [
        { id: 'p1', name: 'ဝါးခမောက်', salePrice: 8500, stock: 45 },
        { id: 'p2', name: 'ကြိမ်တောင်း', salePrice: 15000, stock: 20 },
      ],
    };

    const chunks = encodeForQrTransfer(smallPayload);
    expect(chunks.length).toBe(1);

    const frame = parseQrFrame(chunks[0]);
    expect(frame).not.toBeNull();
    expect(frame?.chunkIndex).toBe(0);
    expect(frame?.totalChunks).toBe(1);
    expect(frame?.sessionId.length).toBe(6);

    const chunkMap = new Map<number, string>();
    chunkMap.set(frame!.chunkIndex, frame!.chunkData);

    const decoded = decodeQrChunks(chunkMap, frame!.totalChunks, frame!.checksum);
    expect(decoded).toEqual(smallPayload);
  });

  // Test B: Large Object (500 realistic sales records forcing 50+ chunks)
  it('b. Encodes a large 500-sales dataset (50+ chunks) and decodes all chunks in order', () => {
    const sales = [];
    for (let i = 1; i <= 500; i++) {
      sales.push({
        id: `sale-${i}-${Date.now()}`,
        invoiceNo: `INV-2026-09-${String(i).padStart(4, '0')}`,
        date: '2026-09-14',
        time: '14:30:00',
        customerName: `ဝယ်သူ ဦးမင်းခန့်ဇော် အမှတ် (${i})`,
        customerPhone: '09791234567',
        items: [
          {
            productId: `prod-${(i % 25) + 1}`,
            productName: `မြန်မာ့ရိုးရာ ဝါးထရံ အချောထည် အထူးပြုလုပ်ချက် (ဒီဇိုင်း #${(i % 12) + 1})`,
            category: 'BAMBOO',
            quantity: 30,
            unitPrice: 18000,
            totalPrice: 540000,
            laborCost: 2500,
            materialCost: 9500,
          },
          {
            productId: `prod-${((i + 1) % 25) + 1}`,
            productName: `သဘာဝ ကြိမ်ခွေ ပန်းအလှဆင်ခြင်း လက်ရာစုံ အကြီးစား`,
            category: 'CANE',
            quantity: 12,
            unitPrice: 32000,
            totalPrice: 384000,
            laborCost: 4500,
            materialCost: 16000,
          },
          {
            productId: `prod-${((i + 2) % 25) + 1}`,
            productName: `ရိုးရာ ဝါးခမောက် ချောမွတ်အဆင့်မြင့် အနားကွပ်ပါ`,
            category: 'BAMBOO',
            quantity: 20,
            unitPrice: 9500,
            totalPrice: 190000,
            laborCost: 1800,
            materialCost: 5200,
          },
        ],
        totalAmount: 1114000,
        paidAmount: 1000000,
        creditAmount: 114000,
        discount: 10000,
        tax: 0,
        status: 'PARTIAL',
        paymentMethod: 'CASH',
        notes: `ဆိုင်ခွဲ #${i} အတွက် ရောင်းချမှု - အမြန်ပို့ဆောင်ရန် အထူးမှာယူထားခြင်း ဖြစ်ပါသည်`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const largePayload = {
      version: '1.0.0',
      shweLetYarSync: true,
      timestamp: '2026-09-14T10:00:00.000Z',
      shopSettings: {
        shopName: 'ရွှေလက်ရာ ရိုးရာလက်မှုလုပ်ငန်း ပင်မဆိုင်ကြီး',
        ownerName: 'ဦးဘရွှေ',
        phone: '09790000001',
      },
      sales,
      products: Array.from({ length: 30 }, (_, p) => ({
        id: `prod-${p + 1}`,
        name: `ထုတ်ကုန် #${p + 1} အဆင့်မြင့် ရိုးရာလက်မှု`,
        category: p % 2 === 0 ? 'BAMBOO' : 'CANE',
        salePrice: 28000,
        laborCost: 3500,
        materialCost: 12000,
        currentStock: 150,
      })),
    };

    const chunkAnalysis = calculateRequiredChunks(largePayload);
    console.log(`[Large 500-sales Dataset Chunk Analysis]: Compressed length: ${chunkAnalysis.compressedLength} bytes, Total chunks generated: ${chunkAnalysis.totalChunks}`);

    // Verify it produces 50+ chunks
    expect(chunkAnalysis.totalChunks).toBeGreaterThanOrEqual(50);

    const chunkStrings = encodeForQrTransfer(largePayload);
    expect(chunkStrings.length).toBe(chunkAnalysis.totalChunks);

    // Feed to QrChunkReceiver in order
    const receiver = new QrChunkReceiver();
    let finalResult = null;

    for (let i = 0; i < chunkStrings.length; i++) {
      const res = receiver.processFrame(chunkStrings[i]);
      if (i < chunkStrings.length - 1) {
        expect(res.status).toBe('IN_PROGRESS');
        if (res.status === 'IN_PROGRESS') {
          expect(res.progress.received).toBe(i + 1);
          expect(res.progress.total).toBe(chunkStrings.length);
        }
      } else {
        expect(res.status).toBe('COMPLETE');
        if (res.status === 'COMPLETE') {
          finalResult = res.data;
        }
      }
    }

    expect(finalResult).toEqual(largePayload);
  });

  // Test C: Decode with chunks fed in reverse / random order
  it('c. Decodes correctly when chunks are received in reverse or randomized order', () => {
    const payload = {
      testTitle: 'Randomized Chunks Assembly',
      items: Array.from({ length: 200 }, (_, i) => ({
        id: `item-${i}`,
        title: `ထုတ်ကုန်အသေးစိတ် #${i} ရိုးရာဝါးခမောက်နှင့် ပန်းအလှဆင် လက်ရာစုံ`,
        sku: `SKU-RANDOM-${i}-${Date.now()}`,
        price: (i + 1) * 1250,
        description: `မြန်မာ့ရိုးရာ လက်မှုပစ္စည်း ထုတ်လုပ်မှု အသေးစိတ် မှတ်တမ်းအမှတ် ${i}`,
        tags: ['ရိုးရာ', 'လက်မှု', 'ဝါး', 'ကြိမ်', `အမျိုးအစား_${i % 10}`],
      })),
    };

    const chunkStrings = encodeForQrTransfer(payload, { chunkSize: 400 });
    expect(chunkStrings.length).toBeGreaterThanOrEqual(5);

    // Shuffle chunks randomly
    const shuffled = [...chunkStrings].sort(() => Math.random() - 0.5);

    const receiver = new QrChunkReceiver();
    let finalResult = null;

    for (const frame of shuffled) {
      const res = receiver.processFrame(frame);
      if (res.status === 'COMPLETE') {
        finalResult = res.data;
      }
    }

    expect(finalResult).toEqual(payload);
  });

  // Test D: Corrupted chunk (checksum mismatch)
  it('d. Returns CHECKSUM_FAILED when one chunk is corrupted and does not throw or return corrupt data', () => {
    const payload = {
      title: 'Corruption resistance test',
      data: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Record ${i} with long descriptive text for test coverage verification`,
        date: '2026-09-14',
      })),
    };

    const chunkStrings = encodeForQrTransfer(payload, { chunkSize: 300 });
    expect(chunkStrings.length).toBeGreaterThanOrEqual(2);

    // Corrupt the 2nd chunk data
    const frameToCorrupt = parseQrFrame(chunkStrings[1]);
    expect(frameToCorrupt).not.toBeNull();

    const corruptedData = 'CorruptedTrashPayload' + frameToCorrupt!.chunkData.slice(21);
    const corruptedFrameStr = `SLY|${frameToCorrupt!.sessionId}|${frameToCorrupt!.chunkIndex}|${frameToCorrupt!.totalChunks}|${frameToCorrupt!.checksum}|${corruptedData}`;

    const receiver = new QrChunkReceiver();
    let sawChecksumFailure = false;

    for (let i = 0; i < chunkStrings.length; i++) {
      const frameStr = i === 1 ? corruptedFrameStr : chunkStrings[i];
      const res = receiver.processFrame(frameStr);
      if (res.status === 'CHECKSUM_FAILED') {
        sawChecksumFailure = true;
      }
    }

    expect(sawChecksumFailure).toBe(true);
    expect(receiver.getProgress().received).toBe(0); // auto-reset upon failure
  });

  // Test E: Two interleaved sessionIds
  it('e. Handles two interleaved sessionIds properly by resetting on session change and completing the full session', () => {
    const session1Payload = { session: 'Session A', shopName: 'ရွှေလက်ရာ ဆိုင်ခွဲ (၁)' };
    const session2Payload = { session: 'Session B', shopName: 'ရွှေလက်ရာ ဆိုင်ခွဲ (၂)' };

    const chunks1 = encodeForQrTransfer(session1Payload, { sessionId: 'SESS01' });
    const chunks2 = encodeForQrTransfer(session2Payload, { sessionId: 'SESS02' });

    const receiver = new QrChunkReceiver();

    // Feed partial chunks from Session 1
    const res1 = receiver.processFrame(chunks1[0]);
    if (res1.status === 'IN_PROGRESS') {
      expect(res1.progress.sessionId).toBe('SESS01');
    } else if (res1.status === 'COMPLETE') {
      expect(res1.data).toEqual(session1Payload);
    }

    // Now switch to Session 2 and feed all of Session 2
    let session2Result = null;
    for (const c2 of chunks2) {
      const r2 = receiver.processFrame(c2);
      if (r2.status === 'COMPLETE') {
        session2Result = r2.data;
      }
    }

    expect(session2Result).toEqual(session2Payload);
  });

  // Test 4: Duplicate frame → no duplicate count/record
  it('4. Duplicate frame processing does not duplicate progress count or alter integrity', () => {
    const payload = { test: 'duplicate frame guard', numbers: [1, 2, 3] };
    const chunks = encodeForQrTransfer(payload, { chunkSize: 20 });
    expect(chunks.length).toBeGreaterThan(1);

    const receiver = new QrChunkReceiver();
    // Feed frame 0 twice
    receiver.processFrame(chunks[0]);
    const progressAfter1st = receiver.getProgress();
    receiver.processFrame(chunks[0]);
    const progressAfterDup = receiver.getProgress();

    expect(progressAfterDup.received).toBe(progressAfter1st.received);
    expect(progressAfterDup.received).toBe(1);
  });

  // Test 5: Missing frame → clear incomplete status
  it('5. Missing frame results in IN_PROGRESS status and does not prematurely complete', () => {
    const payload = { test: 'missing frame test', items: Array.from({ length: 50 }, (_, i) => i) };
    const chunks = encodeForQrTransfer(payload, { chunkSize: 50 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    const receiver = new QrChunkReceiver();
    // Feed only first 2 chunks out of N
    const res1 = receiver.processFrame(chunks[0]);
    const res2 = receiver.processFrame(chunks[1]);

    expect(res1.status).toBe('IN_PROGRESS');
    expect(res2.status).toBe('IN_PROGRESS');
    expect(receiver.getProgress().received).toBe(2);
    expect(receiver.getProgress().total).toBe(chunks.length);
  });

  // Test 8: Malformed frame & wrong totalChunks → rejected
  it('8. Malformed frame headers or invalid chunk index are safely rejected', () => {
    expect(parseQrFrame('NOT_SLY|data')).toBeNull();
    expect(parseQrFrame('SLY|S1|abc|xyz|checksum|data')).toBeNull();
    expect(parseQrFrame('SLY|S1|5|3|checksum|data')).toBeNull(); // chunkIndex > totalChunks
    expect(parseQrFrame('')).toBeNull();
  });

  // Test 9 & 15: Very large dataset → calculates overLimit and recommends file transfer fallback
  it('9 & 15. Very large dataset flags isOverLimit and guides fallback to file transfer', () => {
    // Generate dataset large enough to exceed MAX_QR_CHUNKS_THRESHOLD (150 chunks)
    const hugeDataset = {
      sales: Array.from({ length: 15000 }, (_, i) => ({
        id: `sale-${i}-${Date.now()}`,
        amount: 50000 + i,
        desc: `Stress test long transaction record #${i} with extended unique payload to exceed QR frame count`,
      })),
    };

    const chunkAnalysis = calculateRequiredChunks(hugeDataset);
    expect(chunkAnalysis.totalChunks).toBeGreaterThan(150);
    expect(chunkAnalysis.isOverLimit).toBe(true);
  });

  // Test 10: Receiver timeout / reset clears internal map and state
  it('10. Receiver reset clears all accumulated state and progress cleanly', () => {
    const multiChunkPayload = { test: 'reset check', items: Array.from({ length: 100 }, (_, i) => `item-${i}`) };
    const chunks = encodeForQrTransfer(multiChunkPayload, { chunkSize: 50 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const receiver = new QrChunkReceiver();
    const res = receiver.processFrame(chunks[0]);
    expect(res.status).toBe('IN_PROGRESS');
    expect(receiver.getProgress().received).toBe(1);

    receiver.reset();
    const cleanProgress = receiver.getProgress();
    expect(cleanProgress.received).toBe(0);
    expect(cleanProgress.total).toBe(0);
    expect(cleanProgress.sessionId).toBeNull();
  });

  // Test 11 & 14: QR scanning is strictly read-only and does not write to DB
  it('11 & 14. Scanning or processing QR frames is strictly read-only (0 DB writes / 0 financial records created)', async () => {
    const countBeforeSales = await db.sales.count();
    const countBeforeTx = await db.transactions.count();
    const countBeforeCash = await db.cashMovements.count();

    const payload = {
      shweLetYarSync: true,
      sales: [{ id: 'SALE-SCANNED-1', grandTotal: 999999, date: '2026-09-14' }],
      cashMovements: [{ id: 'CASH-SCANNED-1', amount: 999999, type: 'IN' }],
    };

    const chunks = encodeForQrTransfer(payload);
    const receiver = new QrChunkReceiver();
    for (const chunk of chunks) {
      receiver.processFrame(chunk);
    }

    // Assert DB counts remained completely unchanged
    expect(await db.sales.count()).toBe(countBeforeSales);
    expect(await db.transactions.count()).toBe(countBeforeTx);
    expect(await db.cashMovements.count()).toBe(countBeforeCash);
  });

  // Test 12 & 13: Payload checksum validated before merge & safe sync service execution
  it('12 & 13. Merges valid QR payloads safely through executeSyncMerge with set-union integrity', async () => {
    const syncPayload = {
      version: '1.0.0',
      shweLetYarSync: true,
      shopSettings: { shopName: 'ရွှေလက်ရာ မန္တလေး' },
      products: [
        { id: 'PROD-QR-1', name: 'ဝါးခြင်း', salePrice: 5000, currentStock: 20, isDeleted: false },
      ],
      sales: [
        { id: 'SALE-QR-1', voucherNo: 'SL-QR-001', grandTotal: 5000, date: '2026-09-14' },
      ],
      cashMovements: [
        { id: 'CASH-QR-1', amount: 5000, type: 'IN', date: '2026-09-14' },
      ],
    };

    const chunks = encodeForQrTransfer(syncPayload);
    const receiver = new QrChunkReceiver();
    let decodedData: any = null;

    for (const chunk of chunks) {
      const res = receiver.processFrame(chunk);
      if (res.status === 'COMPLETE') {
        decodedData = res.data;
      }
    }

    expect(decodedData).not.toBeNull();
    expect(decodedData.shweLetYarSync).toBe(true);

    // Merge through safe sync merge service
    const localPkg = await buildLatestSyncPackage();
    const mergeResult = await executeSyncMerge(localPkg, decodedData, { mode: 'MERGE' });

    expect(mergeResult.success).toBe(true);
    expect(mergeResult.mergedData.products.some((p: any) => p.id === 'PROD-QR-1')).toBe(true);

    // Persist to Dexie DB
    await persistMergedDataToDatabase(mergeResult.mergedData, 'MERGE');

    // Verify record in Dexie DB
    const savedProd = await db.products.get('PROD-QR-1');
    expect(savedProd?.name).toBe('ဝါးခြင်း');
  });
});
