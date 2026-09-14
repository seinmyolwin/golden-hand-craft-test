import LZString from 'lz-string';

/**
 * CRC-32 Table implementation using standard IEEE 802.3 polynomial (0xEDB88320)
 */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Calculates 8-character hexadecimal CRC-32 checksum of a given string.
 */
export function calculateCrc32(str: string): string {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ (code & 0xFF)) & 0xFF];
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0').toLowerCase();
}

/**
 * Generates a random alphanumeric session ID (default 6 characters).
 */
export function generateSessionId(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Default chunk size in characters (~800 bytes, well within QR Level L safe capacity margin)
 */
export const QR_CHUNK_SIZE_DEFAULT = 800;

/**
 * Maximum threshold of chunks before switching to direct Zapya / JSON file transfer
 */
export const MAX_QR_CHUNKS_THRESHOLD = 150;

export interface EncodeQrOptions {
  chunkSize?: number;
  sessionId?: string;
}

export interface QrFrameInfo {
  sessionId: string;
  chunkIndex: number;
  totalChunks: number;
  checksum: string;
  chunkData: string;
}

/**
 * Calculates the number of chunks that a payload would produce after LZString compression.
 */
export function calculateRequiredChunks(payload: object, chunkSize = QR_CHUNK_SIZE_DEFAULT): {
  compressedLength: number;
  totalChunks: number;
  isOverLimit: boolean;
} {
  const jsonStr = JSON.stringify(payload);
  const compressed = LZString.compressToBase64(jsonStr) || '';
  const totalChunks = Math.max(1, Math.ceil(compressed.length / chunkSize));
  return {
    compressedLength: compressed.length,
    totalChunks,
    isOverLimit: totalChunks > MAX_QR_CHUNKS_THRESHOLD,
  };
}

/**
 * Compresses an object and splits it into QR-friendly frame strings.
 * Frame format: SLY|<sessionId>|<chunkIndex>|<totalChunks>|<checksum>|<chunkData>
 */
export function encodeForQrTransfer(payload: object, options?: EncodeQrOptions): string[] {
  const chunkSize = options?.chunkSize || QR_CHUNK_SIZE_DEFAULT;
  const jsonStr = JSON.stringify(payload);
  const compressed = LZString.compressToBase64(jsonStr) || '';
  const checksum = calculateCrc32(compressed);
  const sessionId = options?.sessionId || generateSessionId(6);

  if (compressed.length === 0) {
    return [`SLY|${sessionId}|0|1|${checksum}|`];
  }

  const totalChunks = Math.ceil(compressed.length / chunkSize);
  const chunks: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunkData = compressed.slice(i * chunkSize, (i + 1) * chunkSize);
    chunks.push(`SLY|${sessionId}|${i}|${totalChunks}|${checksum}|${chunkData}`);
  }

  return chunks;
}

/**
 * Parses a single scanned QR string into its constituent frame components.
 */
export function parseQrFrame(rawText: string): QrFrameInfo | null {
  if (!rawText || typeof rawText !== 'string' || !rawText.startsWith('SLY|')) {
    return null;
  }

  const parts = rawText.split('|');
  if (parts.length < 5) {
    return null;
  }

  const sessionId = parts[1];
  const chunkIndex = parseInt(parts[2], 10);
  const totalChunks = parseInt(parts[3], 10);

  if (
    !sessionId ||
    isNaN(chunkIndex) ||
    isNaN(totalChunks) ||
    totalChunks <= 0 ||
    chunkIndex < 0 ||
    chunkIndex >= totalChunks
  ) {
    return null;
  }

  // Format: SLY|<sessionId>|<chunkIndex>|<totalChunks>|<checksum>|<chunkData>
  if (parts.length >= 6 && parts[4].length === 8) {
    const checksum = parts[4].toLowerCase();
    const chunkData = parts.slice(5).join('|');
    return { sessionId, chunkIndex, totalChunks, checksum, chunkData };
  }

  // Fallback format without explicit checksum header in slot 4
  const chunkData = parts.slice(4).join('|');
  return { sessionId, chunkIndex, totalChunks, checksum: '', chunkData };
}

/**
 * Reassembles chunks from a Map, verifies checksum, decompresses and parses JSON.
 * Returns null if incomplete, corrupted or invalid.
 */
export function decodeQrChunks(
  chunks: Map<number, string>,
  totalChunks: number,
  checksum?: string
): object | null {
  if (!chunks || chunks.size !== totalChunks || totalChunks <= 0) {
    return null;
  }

  let compressed = '';
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks.get(i);
    if (chunk === undefined) {
      return null;
    }
    compressed += chunk;
  }

  if (checksum) {
    const computedCrc = calculateCrc32(compressed);
    if (computedCrc.toLowerCase() !== checksum.toLowerCase()) {
      return null;
    }
  }

  try {
    const decompressed = LZString.decompressFromBase64(compressed);
    if (!decompressed) {
      return null;
    }
    return JSON.parse(decompressed);
  } catch {
    return null;
  }
}

export type QrReceiverResult =
  | { status: 'COMPLETE'; data: any; progress: { received: number; total: number; sessionId: string } }
  | { status: 'IN_PROGRESS'; progress: { received: number; total: number; sessionId: string } }
  | { status: 'INVALID'; error?: string }
  | { status: 'CHECKSUM_FAILED'; error?: string };

/**
 * Stateful receiver to accumulate incoming animated QR frames.
 * Handles out-of-order frames, session switching, legacy JSON single QR, and checksum validation.
 */
export class QrChunkReceiver {
  private currentSessionId: string | null = null;
  private totalChunks: number = 0;
  private checksum: string = '';
  private chunks: Map<number, string> = new Map();

  public reset(): void {
    this.currentSessionId = null;
    this.totalChunks = 0;
    this.checksum = '';
    this.chunks.clear();
  }

  public getProgress(): { received: number; total: number; sessionId: string | null } {
    return {
      received: this.chunks.size,
      total: this.totalChunks,
      sessionId: this.currentSessionId,
    };
  }

  public processFrame(rawText: string): QrReceiverResult {
    if (!rawText || typeof rawText !== 'string') {
      return { status: 'INVALID', error: 'Empty frame' };
    }

    // Support legacy unchunked raw JSON QR if received
    if (!rawText.startsWith('SLY|')) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === 'object') {
          return {
            status: 'COMPLETE',
            data: parsed,
            progress: { received: 1, total: 1, sessionId: 'legacy' },
          };
        }
      } catch {
        return { status: 'INVALID', error: 'Unrecognized format' };
      }
    }

    const frame = parseQrFrame(rawText);
    if (!frame) {
      return { status: 'INVALID', error: 'Invalid frame format' };
    }

    // If new sessionId received mid-scan, discard old partial set and start fresh
    if (this.currentSessionId !== null && this.currentSessionId !== frame.sessionId) {
      this.chunks.clear();
      this.currentSessionId = frame.sessionId;
      this.totalChunks = frame.totalChunks;
      this.checksum = frame.checksum;
    } else if (this.currentSessionId === null) {
      this.currentSessionId = frame.sessionId;
      this.totalChunks = frame.totalChunks;
      this.checksum = frame.checksum;
    }

    if (frame.checksum && !this.checksum) {
      this.checksum = frame.checksum;
    }

    // Accumulate the chunk
    this.chunks.set(frame.chunkIndex, frame.chunkData);

    // If all chunks received, attempt decoding
    if (this.chunks.size === this.totalChunks) {
      const decoded = decodeQrChunks(this.chunks, this.totalChunks, this.checksum);
      if (decoded) {
        const completedSession = this.currentSessionId || frame.sessionId;
        const total = this.totalChunks;
        this.reset();
        return {
          status: 'COMPLETE',
          data: decoded,
          progress: { received: total, total, sessionId: completedSession },
        };
      } else {
        this.reset();
        return {
          status: 'CHECKSUM_FAILED',
          error: 'Checksum verification failed (corrupted data)',
        };
      }
    }

    return {
      status: 'IN_PROGRESS',
      progress: {
        received: this.chunks.size,
        total: this.totalChunks,
        sessionId: this.currentSessionId || frame.sessionId,
      },
    };
  }
}
