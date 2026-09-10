import React from 'react';
import {
  Calendar,
  Plus,
  Wifi,
  WifiOff,
  PackageCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  User,
  MapPin,
  Phone,
  Trash2,
  Share2,
  Radio,
  Lock,
  ShoppingBag,
  Bell,
  BookOpen,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  QrCode,
} from 'lucide-react';
import { ShopSettings } from '../types';
import { Logo } from './Logo';
import { getTodayDateString } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenNewSupplierCollection?: () => void;
  onOpenNewMerchantSale?: () => void;
  onOpenNewEntry?: () => void;
  onOpenNewSale?: () => void;
  todayInboundCount?: number;
  todaySalesCount?: number;
  shopSettings?: ShopSettings;
  onOpenEditShopProfile?: () => void;
  onOpenEditProfile?: () => void;
  deletedHistoryCount?: number;
  onOpenDeletedHistory?: () => void;
  onOpenAuditLogs?: () => void;
  onOpenSyncModal?: () => void;
  onOpenLocalSync?: () => void;
  onOpenZapyaModal?: () => void;
  onOpenZapya?: () => void;
  onOpenBackup?: () => void;
  onOpenClearData?: () => void;
  onLockApp?: () => void;
  isAppLocked?: boolean;
  appLockEnabled?: boolean;
  onOpenAppLockSettings?: () => void;
  onNavigateToOrders?: () => void;
  onOpenOrderNotification?: () => void;
  pendingOrdersCount?: number;
  onOpenUserGuide?: () => void;
  onOpenZeroSettings?: () => void;
  lowStockCount?: number;
  onOpenLowStockAlert?: () => void;
  onOpenInsights?: () => void;
  onOpenQRSync?: () => void;
  isOnline?: boolean;
  hasPendingUpdate?: boolean;
  onOpenUpdateModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDate,
  onDateChange,
  onOpenNewSupplierCollection,
  onOpenNewMerchantSale,
  onOpenNewEntry,
  onOpenNewSale,
  todayInboundCount = 0,
  todaySalesCount = 0,
  shopSettings,
  onOpenEditShopProfile,
  onOpenEditProfile,
  deletedHistoryCount = 0,
  onOpenDeletedHistory,
  onOpenAuditLogs,
  onOpenSyncModal,
  onOpenLocalSync,
  onOpenZapyaModal,
  onOpenZapya,
  onOpenBackup,
  onOpenClearData,
  onLockApp,
  isAppLocked,
  appLockEnabled,
  onOpenAppLockSettings,
  onNavigateToOrders,
  onOpenOrderNotification,
  pendingOrdersCount = 0,
  onOpenUserGuide,
  onOpenZeroSettings,
  lowStockCount = 0,
  onOpenLowStockAlert,
  onOpenInsights,
  onOpenQRSync,
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true,
  hasPendingUpdate = false,
  onOpenUpdateModal,
}) => {
  const handleOpenEntry = onOpenNewEntry || onOpenNewSupplierCollection;
  const handleOpenSale = onOpenNewSale || onOpenNewMerchantSale;
  const handleEditProfile = onOpenEditProfile || onOpenEditShopProfile;
  const handleOpenTrash = onOpenAuditLogs || onOpenDeletedHistory;
  const handleSync = onOpenLocalSync || onOpenSyncModal;
  const handleZapya = onOpenZapya || onOpenZapyaModal;

  const shopName = shopSettings?.shopName?.trim() || 'ရွှေလက်ရာ';
  const ownerName = shopSettings?.ownerName?.trim() || 'ဦးစိန်မျိုးလွင်';
  const phone = shopSettings?.phone?.trim() || '09-123456789';
  const address = shopSettings?.address?.trim() || 'ပုဂံမြို့ဟောင်း၊ မန္တလေးတိုင်း';
  const tagline = shopSettings?.tagline?.trim() || 'မြန်မာ့လက်မှု ယွန်းထည်နှင့် ဝါးနှီးလုပ်ငန်း';

  return (
    <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md border-b border-emerald-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5">
        {/* Row 1: Brand / Shop Info & System Utility Tools */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-emerald-700/60">
          {/* Brand Identity Block - Prominent & Protected from Squeezing */}
          <div className="flex items-start sm:items-center gap-3">
            <Logo
              size="md"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-amber-400/60 shadow-md cursor-pointer hover:scale-105 hover:border-amber-300 transition-all shrink-0 bg-slate-950/40"
              onClick={handleEditProfile}
              alt={shopName}
            />

            <div className="space-y-0.5">
              {/* Main Title, Owner Badge, Online Status & Edit Icon */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleEditProfile}
                  className="text-base sm:text-lg font-black text-white hover:text-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer text-left tracking-tight group"
                  title="ဆိုင်ရှင်နှင့် ဆိုင်အချက်အလက် ပြင်ဆင်ရန် နှိပ်ပါ"
                >
                  <span>{shopName}</span>
                  <Edit3 className="w-3.5 h-3.5 text-emerald-300 opacity-80 group-hover:opacity-100 shrink-0" />
                </button>

                {/* Owner Name Pill */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-amber-300 border border-amber-400/40 shadow-2xs">
                  <User className="w-3 h-3 text-amber-300 shrink-0" />
                  <span>ပိုင်ရှင်: {ownerName}</span>
                </span>

                {/* Online / Offline Status */}
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-200 border border-emerald-400/30 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="hidden xs:inline">Online</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-200 border border-rose-400/40 shrink-0">
                    <WifiOff className="w-3 h-3 text-rose-300" />
                    <span className="hidden xs:inline">Offline</span>
                  </span>
                )}
              </div>

              {/* Contact Address, Phone Number & Tagline */}
              <div className="flex items-center gap-2 text-xs text-emerald-100/90 flex-wrap">
                {address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-300 shrink-0" />
                    <span>{address}</span>
                  </span>
                )}
                {phone && (
                  <>
                    <span className="text-emerald-500">•</span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-300 shrink-0" />
                      <span>{phone}</span>
                    </span>
                  </>
                )}
                {tagline && (
                  <>
                    <span className="text-emerald-500 hidden lg:inline">•</span>
                    <span className="text-emerald-200/80 hidden lg:inline text-[11px]">{tagline}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Side of Row 1: System Quick Tools */}
          <div className="flex items-center gap-1.5 self-start md:self-auto flex-wrap shrink-0">
            {/* Offline Status Indicator */}
            <OfflineIndicator className="text-white" />

            {/* In-App PWA Install Button */}
            <PWAInstallButton />

            {/* Version Update Button */}
            {onOpenUpdateModal && (
              <button
                id="header-update-btn"
                type="button"
                onClick={onOpenUpdateModal}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border shadow-xs cursor-pointer transition-all ${
                  hasPendingUpdate
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 animate-bounce shadow-md font-extrabold'
                    : 'bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border-emerald-500/50'
                }`}
                title="ဗားရှင်းအသစ် စစ်ဆေးခြင်း / အဆင့်မြှင့်တင်ခြင်း"
              >
                <Sparkles className={`w-3 h-3 ${hasPendingUpdate ? 'text-amber-950 fill-amber-950' : 'text-amber-300'}`} />
                <span className="whitespace-nowrap">
                  {hasPendingUpdate ? 'Update ရပါပြီ' : 'v2.5.0'}
                </span>
              </button>
            )}

            {/* User Guide Button */}
            {onOpenUserGuide && (
              <button
                id="header-guide-btn"
                type="button"
                onClick={onOpenUserGuide}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border border-emerald-500/50 shadow-xs cursor-pointer transition-all"
                title="အက်ပ်အသုံးပြုနည်း လမ်းညွှန် ဖတ်ရှုမည်"
              >
                <BookOpen className="w-3 h-3 text-emerald-300" />
                <span className="hidden sm:inline whitespace-nowrap">လမ်းညွှန်</span>
              </button>
            )}

            {/* Smart Insights Button */}
            {onOpenInsights && (
              <button
                id="header-insights-btn"
                type="button"
                onClick={onOpenInsights}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-teal-900/80 hover:bg-teal-800 text-teal-100 border border-teal-500/50 shadow-xs cursor-pointer transition-all"
                title="စမတ်သုံးသပ်ချက် - ရောင်းအားအကောင်းဆုံးနှင့် ကုန်ပစ္စည်းပေးသွင်းသူကြိုငွေ စောင့်ကြည့်မှု"
              >
                <TrendingUp className="w-3 h-3 text-teal-300" />
                <span className="hidden md:inline whitespace-nowrap">သုံးသပ်ချက်</span>
              </button>
            )}

            {/* QR Sync Button */}
            {onOpenQRSync && (
              <button
                id="header-qr-sync-btn"
                type="button"
                onClick={onOpenQRSync}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border border-emerald-500/50 shadow-xs cursor-pointer transition-all"
                title="QR Code ဖြင့် အင်တာနက်မလိုဘဲ ဘောင်ချာ စာရင်းသွင်း/ထုတ်ယူမည်"
              >
                <QrCode className="w-3 h-3 text-emerald-300" />
                <span className="hidden lg:inline whitespace-nowrap">QR Sync</span>
              </button>
            )}

            {/* WiFi / Hotspot Sync Button */}
            {handleSync && (
              <button
                id="header-sync-btn"
                type="button"
                onClick={handleSync}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border border-emerald-500/50 cursor-pointer shadow-xs transition-all"
                title="WiFi / Hotspot ဒေတာ Sync"
              >
                <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />
                <span className="hidden sm:inline whitespace-nowrap">Sync</span>
              </button>
            )}

            {/* Zapya Transfer Button */}
            {handleZapya && (
              <button
                id="header-zapya-btn"
                type="button"
                onClick={handleZapya}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-purple-900/80 hover:bg-purple-800 text-purple-100 border border-purple-500/50 cursor-pointer shadow-xs transition-all"
                title="Zapya / Bluetooth ဖြင့် App တစ်ခုလုံးပို့မည်"
              >
                <Share2 className="w-3 h-3 text-purple-200" />
                <span className="hidden sm:inline whitespace-nowrap">Zapya</span>
              </button>
            )}

            {/* Lock App / Security Settings Button */}
            {(onLockApp || onOpenAppLockSettings) && (
              <button
                id="header-lock-app-btn"
                type="button"
                onClick={onLockApp || onOpenAppLockSettings}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer shadow-xs transition-all"
                title="လုံခြုံရေး App မျက်နှာပြင် Lock ချမည် / စကားဝှက် ဆက်တင်"
              >
                <Lock className="w-3 h-3 text-amber-300" />
                <span className="hidden sm:inline">{appLockEnabled ? 'Locked' : 'Lock'}</span>
              </button>
            )}

            {/* Quick Recycle Bin / Deleted Records Button */}
            {handleOpenTrash && (
              <button
                id="header-deleted-history-btn"
                type="button"
                onClick={handleOpenTrash}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer border shadow-xs ${
                  deletedHistoryCount > 0
                    ? 'bg-rose-700 hover:bg-rose-600 text-white border-rose-400/50 animate-pulse'
                    : 'bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border-emerald-500/50'
                }`}
                title={`ဖျက်ထားသောမှတ်တမ်းများ (Recycle Bin) ကြည့်မည် - ${deletedHistoryCount} ခု`}
              >
                <Trash2 className="w-3 h-3 text-rose-200" />
                <span className="hidden sm:inline whitespace-nowrap">အမှိုက်ပုံး</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  deletedHistoryCount > 0 ? 'bg-white text-rose-700' : 'bg-emerald-950 text-emerald-200'
                }`}>
                  {deletedHistoryCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date Selector & Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
          {/* Left: Prominent Date Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-emerald-950/80 border border-emerald-400/60 rounded-xl px-3 py-1.5 text-xs text-white shadow-inner">
              <Calendar className="w-4 h-4 mr-2 text-amber-300 shrink-0" />
              <span className="text-emerald-200 mr-2 font-semibold text-xs whitespace-nowrap">ရက်စွဲ:</span>
              <input
                id="header-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              />
            </div>

            {selectedDate !== getTodayDateString() && (
              <button
                type="button"
                onClick={() => onDateChange(getTodayDateString())}
                className="px-2.5 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="ယနေ့ရက်စွဲသို့ အမြန်ပြန်သွားမည်"
              >
                ဒီနေ့ရက်သို့ ပြန်သွားမည်
              </button>
            )}
          </div>

          {/* Right: Operational Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Inbound Button */}
            {handleOpenEntry && (
              <button
                id="header-new-inbound-btn"
                type="button"
                onClick={handleOpenEntry}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-extrabold text-xs rounded-lg shadow-sm transition-all duration-150 cursor-pointer border border-emerald-200"
                title="ကုန်သိမ်းအသစ် ရေးသွင်းမည်"
              >
                <ArrowDownLeft className="w-4 h-4 stroke-[3] text-emerald-700" />
                <span className="whitespace-nowrap">+ ကုန်သိမ်း</span>
                {todayInboundCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full text-[10px] font-black border border-emerald-300">
                    {todayInboundCount}
                  </span>
                )}
              </button>
            )}

            {/* Quick Outbound Sale Button */}
            {handleOpenSale && (
              <button
                id="header-new-sale-btn"
                type="button"
                onClick={handleOpenSale}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all duration-150 cursor-pointer border border-blue-400/40"
                title="ကုန်သည်အရောင်းအသစ် ရေးသွင်းမည်"
              >
                <ArrowUpRight className="w-4 h-4 stroke-[3] text-white" />
                <span className="whitespace-nowrap">+ အရောင်း</span>
                {todaySalesCount > 0 && (
                  <span className="bg-blue-900 text-blue-100 px-1.5 py-0.2 rounded-full text-[10px] font-black border border-blue-400/40">
                    {todaySalesCount}
                  </span>
                )}
              </button>
            )}

            {/* Low Stock Alert Button */}
            {lowStockCount > 0 && onOpenLowStockAlert && (
              <button
                id="header-low-stock-alert-btn"
                type="button"
                onClick={onOpenLowStockAlert}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md ring-2 ring-amber-300/80 animate-bounce cursor-pointer transition-all"
                title={`ကုန်ပစ္စည်း (${lowStockCount}) မျိုး အနည်းဆုံးလက်ကျန်ထက် လျော့နည်းနေပါသည်!`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 stroke-[3]" />
                <span className="whitespace-nowrap">ပစ္စည်းလို ({lowStockCount})</span>
              </button>
            )}

            {/* Notification Bell for Pending Orders */}
            <button
              id="header-orders-notification-bell-btn"
              type="button"
              onClick={onOpenOrderNotification || onNavigateToOrders}
              className={`relative p-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                pendingOrdersCount > 0
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md ring-2 ring-amber-300/80 animate-pulse'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40'
              }`}
              title={
                pendingOrdersCount > 0
                  ? `အော်ဒါအသစ် (${pendingOrdersCount}) စောင် စောင့်ဆိုင်းနေပါသည်`
                  : 'အော်ဒါမှတ်တမ်း'
              }
            >
              <Bell className="w-3.5 h-3.5 stroke-[2.5]" />
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-black rounded-full shadow-xs border border-white">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            {/* Start App / Zero Settings Button */}
            {onOpenZeroSettings && (
              <button
                id="header-zero-start-btn"
                type="button"
                onClick={onOpenZeroSettings}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 shadow-xs border border-amber-300 cursor-pointer transition-all"
                title="အက်ပ်ကို လက်တွေ့ စတင်အသုံးပြုမည် (လက်ကျန်အားလုံး 0 သုည သတ်မှတ်ချက်)"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                <span className="whitespace-nowrap">စတင်အသုံးပြုမည်</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

