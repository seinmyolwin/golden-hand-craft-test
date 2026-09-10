import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  X,
  Wifi,
  Smartphone,
  Check,
  Copy,
  Download,
  Upload,
  QrCode,
  Camera,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Info,
  Radio,
} from 'lucide-react';
import { exportAllDataJSON } from '../utils/storage';

interface LocalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (data: any) => void;
}

type SyncTab = 'QR_CODE' | 'WIFI_GUIDE' | 'TEXT_CODE';

export const LocalSyncModal: React.FC<LocalSyncModalProps> = ({
  isOpen,
  onClose,
  onImportData,
}) => {
  const [activeTab, setActiveTab] = useState<SyncTab>('QR_CODE');
  const [syncCode, setSyncCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentBackupData = () => {
    try {
      return {
        shweLetYarSync: true,
        version: '5.0',
        timestamp: new Date().toISOString(),
        suppliers: JSON.parse(localStorage.getItem('ledger_suppliers_v1') || '[]'),
        merchants: JSON.parse(localStorage.getItem('ledger_merchants_v1') || '[]'),
        products: JSON.parse(localStorage.getItem('ledger_products_v1') || '[]'),
        transactions: JSON.parse(localStorage.getItem('ledger_transactions_v1') || '[]'),
        sales: JSON.parse(localStorage.getItem('ledger_sales_v1') || '[]'),
        merchantPurchases: JSON.parse(localStorage.getItem('ledger_merchant_purchases_v1') || '[]'),
        orders: JSON.parse(localStorage.getItem('ledger_orders_v1') || '[]'),
        productCategories: JSON.parse(localStorage.getItem('ledger_product_categories_v2') || '[]'),
        rawMaterialCategories: JSON.parse(localStorage.getItem('ledger_raw_material_categories_v2') || '[]'),
        shopSettings: JSON.parse(localStorage.getItem('ledger_shop_settings_v1') || '{}'),
      };
    } catch {
      return null;
    }
  };

  const currentBackupString = () => {
    const data = currentBackupData();
    return data ? JSON.stringify(data) : '';
  };

  // Generate lightweight sync QR code
  useEffect(() => {
    if (isOpen && activeTab === 'QR_CODE') {
      setIsGeneratingQR(true);
      try {
        const full = currentBackupData();
        // Create concise summary payload or full data string
        const jsonStr = JSON.stringify(full);
        QRCode.toDataURL(jsonStr, {
          errorCorrectionLevel: 'L',
          width: 300,
          margin: 1,
        })
          .then((url) => {
            setQrDataUrl(url);
            setIsGeneratingQR(false);
          })
          .catch((err) => {
            console.error('QR generation failed:', err);
            // If data is very large for a single QR, fall back to showing instructions and code
            setIsGeneratingQR(false);
          });
      } catch {
        setIsGeneratingQR(false);
      }
    }
  }, [isOpen, activeTab]);

  // Clean up camera stream when unmounting or switching tabs
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
    setIsScanning(false);
  };

  const startCamera = async () => {
    setScanError('');
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

          if (code && code.data) {
            try {
              const parsed = JSON.parse(code.data);
              stopCamera();
              onImportData(parsed);
              setSuccessMsg('QR Code ဖြင့် စာရင်းများ အောင်မြင်စွာ ကူးယူပြီးပါပြီ!');
              setTimeout(() => {
                onClose();
              }, 1500);
              return;
            } catch {
              // Not JSON QR, keep scanning
            }
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentBackupString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(syncCode.trim());
      onImportData(parsed);
      setSuccessMsg('အချက်အလက်များ အောင်မြင်စွာ ချိတ်ဆက်ကူးယူပြီးပါပြီ');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      alert('ထည့်သွင်းထားသော စာရင်းကုဒ် ပုံစံမမှန်ကန်ပါ');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                ဖုန်းအချင်းချင်း စာရင်းချိတ်ဆက်ခြင်း
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50">
                  Offline Sync
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                အင်တာနက်မလိုဘဲ Wi-Fi / Hotspot ဖြင့် ဖုန်းနှစ်လုံး အချက်အလက် ကူးယူနည်း
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

        {/* Tab Selection */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveTab('QR_CODE');
            }}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'QR_CODE'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>QR Scan ဖြင့် တိုက်ရိုက်ကူးမည်</span>
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
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>Wi-Fi Hotspot လမ်းညွှန်</span>
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
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Copy className="w-3.5 h-3.5 text-blue-400" />
            <span>စာရင်းကုဒ် / ဖိုင်ဖြင့် သွင်းမည်</span>
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

          {/* TAB 1: QR CODE */}
          {activeTab === 'QR_CODE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Send Phone */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center space-y-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    ၁
                  </div>
                  <span className="font-bold text-xs text-slate-900">ပေးပို့မည့်ဖုန်းတွင် QR ထုတ်ပြပါ</span>

                  {qrDataUrl ? (
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                      <img
                        src={qrDataUrl}
                        alt="Sync QR"
                        className="w-40 h-40 object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                      {isGeneratingQR ? 'QR ဖန်တီးနေပါသည်...' : 'QR အဆင်သင့်မဖြစ်သေးပါ'}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    ဤ QR ထဲတွင် နောက်ဆုံး သိမ်းထားသော စာရင်းအချက်အလက်များ ပါဝင်ပါသည်
                  </p>
                </div>

                {/* Receive Phone */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center space-y-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                    ၂
                  </div>
                  <span className="font-bold text-xs text-slate-900">လက်ခံမည့်ဖုန်းမှ Scan ဖတ်ပါ</span>

                  {isScanning ? (
                    <div className="relative w-full aspect-square max-w-[180px] bg-black rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-4 border-2 border-emerald-400 rounded-lg animate-pulse pointer-events-none" />
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

          {/* TAB 2: WIFI GUIDE */}
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
                  <span className="font-bold text-slate-900 block text-xs">အဆင့် ၃: QR Code သို့မဟုတ် Zapya ဖြင့် ပေးပို့ပါ</span>
                  <p className="text-[11px] text-slate-600">
                    အထက်ပါ <strong>"QR Scan ဖြင့် တိုက်ရိုက်ကူးမည်"</strong> တက်ဘ်ကို အသုံးပြု၍ဖြစ်စေ၊ Zapya ဖြင့် JSON ဖိုင်ကို ပေးပို့၍ဖြစ်စေ ချက်ချင်း စာရင်းလွှဲပြောင်းနိုင်ပါသည်။
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEXT CODE & FILE */}
          {activeTab === 'TEXT_CODE' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">၁။ မိမိစက်မှ စာရင်းကုဒ် ထုတ်ယူမည်</span>
                  <button
                    type="button"
                    onClick={exportAllDataJSON}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON ဖိုင် သိမ်းယူမည်</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'ကုဒ်ကူးယူပြီးပါပြီ (Copied to Clipboard)' : 'စာရင်းကုဒ် ကူးယူမည် (Copy Code)'}</span>
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-xs block">၂။ အခြားဖုန်းမှ ကူးလာသော စာရင်းကုဒ် ထည့်သွင်းမည်</span>
                <textarea
                  rows={4}
                  placeholder="အခြားဖုန်းမှ ရရှိထားသော စာရင်းကုဒ် (JSON Code) ကို ဤနေရာတွင် Paste ချပါ..."
                  value={syncCode}
                  onChange={(e) => setSyncCode(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-[11px] focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!syncCode.trim()}
                  className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    syncCode.trim()
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-sm'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>စာရင်း အသစ်သွင်းယူမည် (Import Data)</span>
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
