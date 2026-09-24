import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  X,
  Wifi,
  Check,
  Copy,
  Download,
  Upload,
  QrCode,
  Camera,
  ShieldCheck,
  RefreshCw,
  Info,
  Radio,
  Share2,
  GitMerge,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Send,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { safeJsonParse } from '../utils/security';
import { getSafeErrorMessage } from '../utils/errors';
import {
  executeSyncMerge,
  buildLatestSyncPackage,
  persistMergedDataToDatabase,
  loadCompleteLocalData,
  SyncMergeMode,
  SyncMergeResult,
} from '../services/syncMergeService';
import { db } from '../db/database';
import {
  encodeForQrTransfer,
  calculateRequiredChunks,
  QrChunkReceiver,
  MAX_QR_CHUNKS_THRESHOLD,
} from '../utils/qrChunkTransfer';

function isValidSyncPayload(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (data.shweLetYarSync || data.formatVersion || data.version || data.data) return true;
  if (
    Array.isArray(data.products) ||
    Array.isArray(data.suppliers) ||
    Array.isArray(data.merchants) ||
    Array.isArray(data.transactions) ||
    Array.isArray(data.sales)
  ) {
    return true;
  }
  return false;
}

interface LocalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (data: any, mode?: 'MERGE' | 'OVERWRITE') => void;
}

type SyncTab = 'SEND_RECEIVE' | 'QR_CODE' | 'WIFI_GUIDE' | 'TEXT_CODE';

export const LocalSyncModal: React.FC<LocalSyncModalProps> = ({
  isOpen,
  onClose,
  onImportData,
}) => {
  const [activeTab, setActiveTab] = useState<SyncTab>('SEND_RECEIVE');
  const [syncCode, setSyncCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);

  // Chunked Animated QR State (Sender Side)
  const [chunkQrUrls, setChunkQrUrls] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState<boolean>(true);
  const [isQrOverLimit, setIsQrOverLimit] = useState<boolean>(false);
  const [qrOverLimitCount, setQrOverLimitCount] = useState<number>(0);
  const [animationSpeedMs, setAnimationSpeedMs] = useState<number>(350);

  // Network Detection State
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Pending Import State for Merge vs Overwrite Confirmation Dialog
  const [pendingIncomingPayload, setPendingIncomingPayload] = useState<any | null>(null);
  const [isConfirmingMode, setIsConfirmingMode] = useState<boolean>(false);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // Return Sync Package State (Auto-Ready after merge/overwrite)
  const [returnPackageReady, setReturnPackageReady] = useState<boolean>(false);
  const [, setLastMergeResult] = useState<SyncMergeResult | null>(null);

  // Camera and Scanning Receiver State
  const receiverRef = useRef<QrChunkReceiver>(new QrChunkReceiver());
  const [scanProgress, setScanProgress] = useState<{ received: number; total: number; sessionId: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Detect Network
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Generate Chunked Animated QR Codes
  const generateSyncQR = useCallback(async () => {
    try {
      setIsGeneratingQR(true);
      const pkg = await buildLatestSyncPackage();
      const analysis = calculateRequiredChunks(pkg);

      if (analysis.isOverLimit) {
        setIsQrOverLimit(true);
        setQrOverLimitCount(analysis.totalChunks);
        setChunkQrUrls([]);
        setIsGeneratingQR(false);
        return;
      }

      setIsQrOverLimit(false);
      setQrOverLimitCount(analysis.totalChunks);
      const chunkStrings = encodeForQrTransfer(pkg);

      const urls = await Promise.all(
        chunkStrings.map((str) =>
          QRCode.toDataURL(str, {
            errorCorrectionLevel: 'L',
            width: 320,
            margin: 1,
          })
        )
      );

      setChunkQrUrls(urls);
      setCurrentChunkIndex(0);
      setIsGeneratingQR(false);
    } catch (err) {
      console.error('QR chunk generation error:', err);
      setIsGeneratingQR(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && (activeTab === 'QR_CODE' || activeTab === 'SEND_RECEIVE')) {
      generateSyncQR();
    }
  }, [isOpen, activeTab, generateSyncQR]);

  // 3. Sender QR Animation Loop
  useEffect(() => {
    if (activeTab !== 'QR_CODE' && !returnPackageReady) return;
    if (chunkQrUrls.length <= 1 || !isPlayingAnimation) return;

    const interval = setInterval(() => {
      setCurrentChunkIndex((prev) => (prev + 1) % chunkQrUrls.length);
    }, animationSpeedMs);

    return () => clearInterval(interval);
  }, [activeTab, chunkQrUrls.length, isPlayingAnimation, animationSpeedMs, returnPackageReady]);

  // 4. Clean up camera on unmount or tab switch
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    receiverRef.current.reset();
    setScanProgress(null);
    setIsScanning(false);
  };

  const startCamera = async () => {
    setScanError('');
    receiverRef.current.reset();
    setScanProgress(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setScanError('ကင်မရာ ဖွင့်၍မရပါ (ခွင့်ပြုချက် လိုအပ်သည်)');
      setIsScanning(false);
    }
  };

  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.height = videoRef.current.videoHeight;
          canvas.width = videoRef.current.videoWidth;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && typeof code.data === 'string' && code.data.length < 2000000) {
            const result = receiverRef.current.processFrame(code.data);

            if (result.status === 'COMPLETE') {
              stopCamera();
              setPendingIncomingPayload(result.data);
              setIsConfirmingMode(true);
              return;
            } else if (result.status === 'IN_PROGRESS') {
              setScanProgress(result.progress);
              setScanError('');
            } else if (result.status === 'CHECKSUM_FAILED') {
              setScanError('ဒေတာ စစ်ဆေးမှု မအောင်မြင်ပါ (Checksum error) - ထပ်ကြိုးစားပါ');
              setScanProgress(null);
            }
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  // Direct File Packaging & Send
  const handleSendData = async () => {
    try {
      setIsPackaging(true);
      const pkg = await buildLatestSyncPackage();
      const jsonStr = JSON.stringify(pkg, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const filename = `shwe-let-yar-sync-${nowStr}.json`;

      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'ရွှေလက်ရာ စာရင်း ချိတ်ဆက်ဖိုင်',
          text: `ရွှေလက်ရာ စာရင်း နောက်ဆုံးအခြေအနေ (${new Date().toLocaleDateString('my-MM')})`,
          files: [file],
        });
        setSuccessMsg('ဒေတာဖိုင် ပေးပို့ရန် မျှဝေပြီးပါပြီ');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessMsg('နောက်ဆုံး စာရင်းဖိုင်ကို ဒေါင်းလုဒ်သိမ်းဆည်းပြီးပါပြီ (Zapya / Bluetooth ဖြင့် ပေးပို့နိုင်ပါသည်)');
      }
      setIsPackaging(false);
    } catch (err) {
      console.error('Send data packaging error:', err);
      setIsPackaging(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      const pkg = await buildLatestSyncPackage();
      await navigator.clipboard.writeText(JSON.stringify(pkg));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy code error:', err);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = safeJsonParse(content);
        if (!isValidSyncPayload(parsed)) {
          alert('ရွေးချယ်ထားသော ဖိုင်သည် ရွှေလက်ရာ စာရင်းဖိုင် ပုံစံမဟုတ်ပါ');
          return;
        }
        setPendingIncomingPayload(parsed);
        setIsConfirmingMode(true);
      } catch {
        alert('ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက် ဖြစ်ပေါ်ပါသည်');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTextCodeImport = () => {
    try {
      const trimmed = syncCode.trim();
      if (!trimmed || trimmed.length > 5000000) {
        alert('ထည့်သွင်းထားသော စာရင်းကုဒ် ပမာဏ အလွန်များပြားနေပါသည်');
        return;
      }
      const parsed = safeJsonParse(trimmed);
      if (!isValidSyncPayload(parsed)) {
        alert('ထည့်သွင်းထားသော စာရင်းကုဒ် ပုံစံမမှန်ကန်ပါ (Invalid Sync Payload)');
        return;
      }
      setPendingIncomingPayload(parsed);
      setIsConfirmingMode(true);
    } catch {
      alert('ထည့်သွင်းထားသော စာရင်းကုဒ် ပုံစံမမှန်ကန်ပါ');
    }
  };

  // Smart Merge or Overwrite Confirmation
  const handleConfirmSyncMode = async (mode: SyncMergeMode) => {
    if (!pendingIncomingPayload) return;
    setIsMerging(true);

    try {
      const localSnapshot = await loadCompleteLocalData();

      const mergeResult = await executeSyncMerge(localSnapshot, pendingIncomingPayload, { mode });

      if (mergeResult.success) {
        await persistMergedDataToDatabase(mergeResult.mergedData, { mode });
        onImportData(mergeResult.mergedData, mode);

        // Auto-prepare Return Sync Package for the sending device
        const updatedPackage = await buildLatestSyncPackage();
        const returnAnalysis = calculateRequiredChunks(updatedPackage);

        if (returnAnalysis.isOverLimit) {
          setIsQrOverLimit(true);
          setQrOverLimitCount(returnAnalysis.totalChunks);
          setChunkQrUrls([]);
        } else {
          setIsQrOverLimit(false);
          setQrOverLimitCount(returnAnalysis.totalChunks);
          const returnChunkStrings = encodeForQrTransfer(updatedPackage);
          const returnUrls = await Promise.all(
            returnChunkStrings.map((str) =>
              QRCode.toDataURL(str, {
                errorCorrectionLevel: 'L',
                width: 320,
                margin: 1,
              })
            )
          );
          setChunkQrUrls(returnUrls);
          setCurrentChunkIndex(0);
        }

        setLastMergeResult(mergeResult);
        setReturnPackageReady(true);
        setIsConfirmingMode(false);
        setPendingIncomingPayload(null);
        setSuccessMsg(mergeResult.message);
      } else {
        alert(mergeResult.message || 'စာရင်း ပေါင်းစည်းမှု မအောင်မြင်ပါ');
        setIsConfirmingMode(false);
      }
    } catch (err: any) {
      console.error('Merge execution error:', err);
      alert(getSafeErrorMessage(err, 'ပေါင်းစည်းမှု ချို့ယွင်းချက်'));
      setIsConfirmingMode(false);
    } finally {
      setIsMerging(false);
    }
  };

  const getIncomingSummary = (payload: any) => {
    if (!payload) return null;
    const raw = payload.data || payload;
    return {
      shopName: payload.shopName || raw.shopSettings?.name || 'အခြားဖုန်း/စက်',
      timestamp: payload.timestamp ? new Date(payload.timestamp).toLocaleString('my-MM') : 'မသိရှိပါ',
      productsCount: Array.isArray(raw.products) ? raw.products.length : 0,
      transactionsCount: Array.isArray(raw.transactions) ? raw.transactions.length : 0,
      salesCount: Array.isArray(raw.sales) ? raw.sales.length : 0,
      suppliersCount: Array.isArray(raw.suppliers) ? raw.suppliers.length : 0,
      merchantsCount: Array.isArray(raw.merchants) ? raw.merchants.length : 0,
      ordersCount: Array.isArray(raw.orders) ? raw.orders.length : 0,
    };
  };

  if (!isOpen) return null;

  const incomingSummary = getIncomingSummary(pendingIncomingPayload);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold">ဖုန်းအချင်းချင်း စာရင်းချိတ်ဆက်ခြင်း</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 font-semibold">
                  Offline QR / File Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                အော့ဖ်လိုင်း QR / ဖိုင်ဖြင့် ဖုန်းနှစ်လုံး အပြန်အလှန် စာရင်းကူးယူ ပေါင်းစည်းခြင်း (Offline QR / File Transfer)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Status Detection Banner */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="font-semibold text-slate-700">
              {isOnline ? 'Wi-Fi / Hotspot ချိတ်ဆက်မှု တွေ့ရှိပါသည်' : 'အော့ဖ်လိုင်းမုဒ် (Offline QR / File Transfer)'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>ပို့ရန် အဆင်သင့်</span>
          </span>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-50 p-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('SEND_RECEIVE');
            }}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'SEND_RECEIVE'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>တိုက်ရိုက်ပေးပို့ / လက်ခံမည်</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('QR_CODE');
            }}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'QR_CODE'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Animated QR ဖြင့် ကူးမည်</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('WIFI_GUIDE');
            }}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'WIFI_GUIDE'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-amber-500" />
            <span>Hotspot လမ်းညွှန်</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('TEXT_CODE');
            }}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'TEXT_CODE'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Copy className="w-3.5 h-3.5 text-blue-500" />
            <span>စာရင်းကုဒ် / ဖိုင်</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-bold animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* CONFIRMATION DIALOG: Merge vs Overwrite */}
          {isConfirmingMode && incomingSummary && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3.5 border border-slate-700 shadow-xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-100">စာရင်းထည့်သွင်းမှု ပုံစံ ရွေးချယ်ပါ</h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingMode(false);
                    setPendingIncomingPayload(null);
                  }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  မလုပ်ဆောင်ပါ
                </button>
              </div>

              {/* Incoming Payload Summary */}
              <div className="p-3 bg-slate-800/80 rounded-xl text-[11px] space-y-1.5 border border-slate-700">
                <div className="flex justify-between text-slate-300">
                  <span>ပေးပို့သူဆိုင်/စက်:</span>
                  <span className="font-bold text-emerald-300">{incomingSummary.shopName}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>အချိန်:</span>
                  <span className="font-mono text-slate-200">{incomingSummary.timestamp}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900/60 p-1.5 rounded">
                    <span className="text-slate-400 block text-[10px]">ကုန်ပစ္စည်း</span>
                    <span className="font-bold text-white text-xs">{incomingSummary.productsCount}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded">
                    <span className="text-slate-400 block text-[10px]">ဝယ်ယူမှု</span>
                    <span className="font-bold text-white text-xs">{incomingSummary.transactionsCount}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded">
                    <span className="text-slate-400 block text-[10px]">အရောင်း</span>
                    <span className="font-bold text-white text-xs">{incomingSummary.salesCount}</span>
                  </div>
                </div>
              </div>

              {/* Two Option Cards */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isMerging}
                  onClick={() => handleConfirmSyncMode('MERGE')}
                  className="w-full p-3.5 bg-emerald-950/80 hover:bg-emerald-900 border-2 border-emerald-500 rounded-xl text-left transition-all cursor-pointer group flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-200">
                        ၁။ စမတ်ပေါင်းစည်းမည် (Smart Merge)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold">
                        အကြံပြုချက်
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                      လက်ရှိစက်ရှိ စာရင်းများနှင့် ပေးပို့လာသော စာရင်းများကို မပျောက်ပျက်စေဘဲ ပေါင်းစည်းမည် (Newer Wins + Disjoint Union).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isMerging}
                  onClick={() => {
                    if (window.confirm('သတိပြုရန်: လက်ရှိစက်ရှိ စာရင်းများကို အကုန်ဖျက်ပြီး ပေးပို့လာသော ဖိုင်ဖြင့် အစားထိုးပါမည်လား?')) {
                      handleConfirmSyncMode('OVERWRITE');
                    }
                  }}
                  className="w-full p-3 bg-slate-800/80 hover:bg-rose-950/50 border border-slate-700 hover:border-rose-500 rounded-xl text-left transition-all cursor-pointer flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/30">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <span className="text-xs font-bold text-slate-200">
                      ၂။ အားလုံး အစားထိုးမည် (Clean Overwrite)
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      လက်ရှိစက်ရှိ စာရင်းများကို အကုန်ဖျက်၍ ပေးပို့လာသော စာရင်းဖိုင်ဖြင့် အပြည့်အစုံ အစားထိုးမည်။
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* RETURN SYNC PACKAGE AUTO-READY BANNER */}
          {returnPackageReady && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-900">
                <RotateCcw className="w-5 h-5 text-emerald-600 animate-spin" style={{ animationDuration: '3s' }} />
                <h4 className="text-xs font-extrabold">ကျန်စက်သို့ ပြန်လည်ပေးပို့ရန် အဆင်သင့်ဖြစ်ပါသည်</h4>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                စာရင်းများ အောင်မြင်စွာ ပေါင်းစည်းပြီးပါပြီ! ပေါင်းစည်းထားသော နောက်ဆုံးစာရင်းကို ကျန်ဖုန်းဆီသို့ ပြန်လည်ပေးပို့နိုင်ရန် ပက်ကေ့ဂျ် အဆင်သင့် ထုတ်ပေးထားပါသည်။
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendData}
                  className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ကျန်စက်ဆီ ပြန်ပို့မည် (Send Back)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('QR_CODE')}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ကျန်ဖုန်းမှ ကူးရန် QR ပြမည်</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: SEND & RECEIVE HUB */}
          {activeTab === 'SEND_RECEIVE' && !isConfirmingMode && (
            <div className="space-y-4">
              {/* Send Card */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>၁။ ဒေတာ ပေးပို့ခြင်း (Send Latest Update)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  မိမိစက်ရှိ နောက်ဆုံး အရောင်း၊ အဝယ်နှင့် ပစ္စည်းစာရင်းများကို အခြားဖုန်းသို့ Zapya, Bluetooth သို့မဟုတ် File Share ဖြင့် ချက်ချင်း ပေးပို့နိုင်ပါသည်။
                </p>

                <button
                  type="button"
                  onClick={handleSendData}
                  disabled={isPackaging}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
                >
                  {isPackaging ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span>{isPackaging ? 'ဒေတာ ထုပ်ပိုးနေပါသည်...' : 'ဒေတာပို့မည် (Send / Share Data File)'}</span>
                </button>
              </div>

              {/* Receive Card */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-extrabold text-xs">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>၂။ ဒေတာ လက်ခံသွင်းယူခြင်း (Receive & Merge)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  အခြားဖုန်းမှ Zapya သို့မဟုတ် Bluetooth ဖြင့် ပေးပို့လာသော JSON ဖိုင်ကို ရွေးချယ်၍ဖြစ်စေ၊ ကင်မရာဖြင့် QR Scan ဖတ်၍ဖြစ်စေ စာရင်းပေါင်းစည်းနိုင်ပါသည်။
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>ဖိုင် ရွေးချယ်မည်</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('QR_CODE');
                      startCamera();
                    }}
                    className="py-2.5 px-3 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>QR Scan ဖတ်မည်</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANIMATED QR CODE */}
          {activeTab === 'QR_CODE' && !isConfirmingMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Send Phone QR (Animated Chunk Transfer) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center space-y-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    ၁
                  </div>
                  <span className="font-bold text-xs text-slate-900">ပေးပို့မည့်ဖုန်းတွင် QR ထုတ်ပြပါ</span>

                  {isQrOverLimit ? (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-left space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-amber-900 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>ဒေတာ များနေလို့ QR နဲ့ မကူးနိုင်ပါ</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        စက်ရှိ စာရင်းပမာဏ များပြားနေသောကြောင့် (Chunk {qrOverLimitCount} ခု &gt; {MAX_QR_CHUNKS_THRESHOLD}) QR ဖြင့် အပြည့်အစုံ မကူးနိုင်ပါ။
                      </p>
                      <p className="text-[11px] text-slate-700 font-medium">
                        👉 <strong>Text Code</strong> tab ကနေ JSON file ကို <strong>Zapya / Bluetooth</strong> ဖြင့် အလွယ်တကူ ပို့ဆောင်နိုင်ပါသည်။
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('TEXT_CODE')}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-colors"
                      >
                        စာရင်းကုဒ် / ဖိုင် (Text Code) သို့ သွားမည်
                      </button>
                    </div>
                  ) : chunkQrUrls.length > 0 ? (
                    <div className="w-full space-y-2">
                      {/* Animated QR Container */}
                      <div className="relative bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                        <img
                          src={chunkQrUrls[currentChunkIndex]}
                          alt={`Sync QR Chunk ${currentChunkIndex + 1}`}
                          className="w-40 h-40 object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />

                        {/* Chunk Progress Badge Overlay */}
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-slate-900/85 text-emerald-300 text-[10px] font-mono font-bold shadow-xs">
                          Chunk {currentChunkIndex + 1} / {chunkQrUrls.length}
                        </div>

                        {/* Visual Progress Bar */}
                        {chunkQrUrls.length > 1 && (
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-200"
                              style={{
                                width: `${((currentChunkIndex + 1) / chunkQrUrls.length) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Animation Controls (Pause / Play, Next, Prev, Restart) */}
                      {chunkQrUrls.length > 1 && (
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setCurrentChunkIndex(0)}
                            title="ပြန်စမည် (Restart)"
                            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer text-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentChunkIndex(
                                (prev) => (prev - 1 + chunkQrUrls.length) % chunkQrUrls.length
                              )
                            }
                            title="ယခင် (Previous)"
                            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer text-xs"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPlayingAnimation(!isPlayingAnimation)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white cursor-pointer font-bold text-xs flex items-center gap-1 shadow-2xs"
                          >
                            {isPlayingAnimation ? (
                              <>
                                <Pause className="w-3.5 h-3.5 text-amber-400" />
                                <span>ခေတ္တရပ်မည်</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 text-emerald-400" />
                                <span>ဆက်ဖွင့်မည်</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentChunkIndex((prev) => (prev + 1) % chunkQrUrls.length)
                            }
                            title="ရှေ့သို့ (Next)"
                            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer text-xs"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-500 leading-tight">
                        {chunkQrUrls.length > 1
                          ? `လက်ခံမည့်ဖုန်းမှ Scan ဖတ်နေစဉ် ဤ QR အလှည့်ကျ ပြသနေမှုကို ကင်မရာဖြင့် ချိန်ထားပါ (Chunk ${chunkQrUrls.length} ခုလုံး ရောက်သည်အထိ)`
                          : 'နောက်ဆုံး သိမ်းထားသော စာရင်းအချက်အလက်များ ပါဝင်ပါသည်'}
                      </p>
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                      {isGeneratingQR ? 'QR ဖန်တီးနေပါသည်...' : 'QR အဆင်သင့်မဖြစ်သေးပါ'}
                    </div>
                  )}
                </div>

                {/* Receive Phone Camera */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center space-y-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                    ၂
                  </div>
                  <span className="font-bold text-xs text-slate-900">လက်ခံမည့်ဖုန်းမှ Scan ဖတ်ပါ</span>

                  {isScanning ? (
                    <div className="relative w-full aspect-square max-w-[180px] bg-black rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-4 border-2 border-emerald-400 rounded-lg animate-pulse pointer-events-none" />

                      {/* Live Chunk Scan Counter on Camera Overlay */}
                      {scanProgress && (
                        <div className="absolute bottom-2 inset-x-2 bg-slate-900/90 text-white rounded-lg p-1.5 text-center shadow-lg border border-slate-700 space-y-1">
                          <div className="flex items-center justify-between text-[11px] px-1 font-bold text-emerald-300">
                            <span>ရရှိမှု:</span>
                            <span>
                              {scanProgress.received} / {scanProgress.total} Chunks
                            </span>
                          </div>
                          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-400 h-full transition-all duration-150"
                              style={{
                                width: `${Math.min(100, (scanProgress.received / scanProgress.total) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2 border border-slate-200">
                      <Camera className="w-8 h-8 text-slate-400" />
                      <span className="text-[11px]">ကင်မရာ ပိတ်ထားသည်</span>
                    </div>
                  )}

                  {scanError && (
                    <p className="text-[11px] text-rose-600 font-semibold">{scanError}</p>
                  )}

                  <button
                    type="button"
                    onClick={isScanning ? stopCamera : startCamera}
                    className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      isScanning
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isScanning ? 'ကင်မရာ ပိတ်မည်' : 'ကင်မရာဖြင့် QR Scan ဖတ်မည်'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WIFI GUIDE */}
          {activeTab === 'WIFI_GUIDE' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">အင်တာနက်ဖိုးမကုန်ဘဲ ဖုန်းချင်း စာရင်းကူးနည်း:</span>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    ရွာများ သို့မဟုတ် လိုင်းမကောင်းသည့် နေရာများတွင် ဖုန်းတစ်လုံးမှ Hotspot (ကိုယ်ပိုင် Wi-Fi လွှင့်စက်) ဖွင့်၍ အခြားဖုန်းမှ ထို Wi-Fi ကို ချိတ်ဆက်လိုက်ရုံဖြင့် ဖုန်းနှစ်လုံး အပြန်အလှန် ချိတ်ဆက်နိုင်ပါသည်။
                  </p>
                </div>
              </div>

              <div className="space-y-2 font-medium text-slate-700">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block text-xs">အဆင့် ၁: ပင်မဖုန်းတွင် Hotspot ဖွင့်ပါ</span>
                  <p className="text-[11px] text-slate-600">
                    ဖုန်း Setting &gt; Personal Hotspot (သို့) Wi-Fi Hotspot ကို ဖွင့်ပါ။ (အင်တာနက် ဒေတာ ဖွင့်စရာ မလိုပါ)
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block text-xs">အဆင့် ၂: အခြားဖုန်းမှ ထို Hotspot သို့ ချိတ်ဆက်ပါ</span>
                  <p className="text-[11px] text-slate-600">
                    ဒုတိယဖုန်း၏ Wi-Fi ထဲဝင်၍ ပထမဖုန်း၏ Hotspot အမည်ကို ရှာဖွေပြီး ချိတ်ဆက်လိုက်ပါ။
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block text-xs">အဆင့် ၃: စာရင်းဖိုင် (Zapya / Bluetooth) သို့မဟုတ် Animated QR ဖြင့် ပို့ပါ</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    စာရင်းဒေတာ အနည်းငယ်အတွက် <strong>Animated QR Code</strong> ဖြင့် အလှည့်ကျ စကင်ဖတ်နိုင်ပါသည်။ စာရင်းဒေတာ အလွန်များပြားသည့် ဆိုင်ကြီးများ (Large Dataset) အတွက် <strong>"ဒေတာပို့မည်" (Zapya / Bluetooth)</strong> သို့မဟုတ် <strong>စာရင်းကုဒ် / ဖိုင် (Text Code)</strong> ဖြင့် ပေးပို့ခြင်းသည် အမြန်ဆုံးနှင့် အစိတ်ချရဆုံး ဖြစ်ပါသည်။
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEXT CODE & FILE */}
          {activeTab === 'TEXT_CODE' && !isConfirmingMode && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">၁။ မိမိစက်မှ စာရင်းကုဒ် ထုတ်ယူမည်</span>
                  <button
                    type="button"
                    onClick={handleSendData}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ဖိုင် ဒေါင်းလုဒ်ဆွဲမည်</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'ကုဒ်ကူးယူပြီးပါပြီ (Copied)' : 'စာရင်းကုဒ် ကူးယူမည် (Copy Code)'}</span>
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-xs block">၂။ အခြားဖုန်းမှ ကူးလာသော စာရင်းကုဒ် ထည့်သွင်းမည်</span>
                <textarea
                  rows={3}
                  placeholder="အခြားဖုန်းမှ ရရှိထားသော စာရင်းကုဒ် (JSON Code) ကို ဤနေရာတွင် Paste ချပါ..."
                  value={syncCode}
                  onChange={(e) => setSyncCode(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-[11px] focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTextCodeImport}
                  disabled={!syncCode.trim()}
                  className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    syncCode.trim()
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-sm'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>စာရင်း စစ်ဆေးသွင်းယူမည် (Proceed to Merge)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>စာရင်းများအားလုံး လုံခြုံစွာ သိမ်းဆည်းထားပါသည်</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
