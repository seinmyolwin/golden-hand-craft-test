import React, { useState } from 'react';
import {
  Calendar,
  WifiOff,
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
  Bell,
  BookOpen,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  QrCode,
  Shield,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ShopSettings, UserSession } from '../types';
import { Logo } from './Logo';
import { getTodayDateString } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { CURRENT_APP_VERSION } from '../constants/version';

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
  currentSession?: UserSession | null;
  onOpenUserSwitch?: () => void;
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
  currentSession,
  onOpenUserSwitch,
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
  const [showMobileTools, setShowMobileTools] = useState(false);

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
  const tagline = shopSettings?.tagline?.trim() || 'မြန်မာ့လက်မှု ကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း';

  const hasSecondaryAlerts = hasPendingUpdate || deletedHistoryCount > 0 || lowStockCount > 0 || pendingOrdersCount > 0;

  return (
    <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md border-b border-emerald-900 select-none">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2 space-y-1.5 sm:space-y-2">
        {/* ========================================================================= */}
        {/* ROW 1: PRIMARY BRANDING & SYSTEM BAR (Responsive for Mobile/Tablet/Desktop) */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 sm:gap-2 pb-1.5 border-b border-emerald-700/60">
          {/* Brand Identity Block */}
          <div className="flex items-center justify-between min-w-0 w-full md:w-auto">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Logo
                size="md"
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border-2 border-amber-400/60 shadow-md cursor-pointer hover:scale-105 hover:border-amber-300 transition-all shrink-0 bg-slate-950/40"
                onClick={handleEditProfile}
                alt={shopName}
              />

              <div className="min-w-0 flex-1 space-y-0.5">
                {/* Shop Title, Owner Pill & Status */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="text-sm sm:text-base md:text-lg font-black text-white hover:text-amber-200 transition-colors flex items-center gap-1 cursor-pointer text-left tracking-tight group truncate max-w-[140px] min-[400px]:max-w-[200px] sm:max-w-none"
                    title="ဆိုင်ရှင်နှင့် ဆိုင်အချက်အလက် ပြင်ဆင်ရန် နှိပ်ပါ"
                    aria-label="ဆိုင်အချက်အလက် ပြင်ဆင်ရန်"
                  >
                    <span className="truncate">{shopName}</span>
                    <Edit3 className="w-3.5 h-3.5 text-emerald-300 opacity-80 group-hover:opacity-100 shrink-0" />
                  </button>

                  {/* Active User / Role Pill & Switch Button */}
                  {currentSession && (
                    <button
                      id="header-user-role-badge-btn"
                      type="button"
                      onClick={onOpenUserSwitch}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border shadow-xs cursor-pointer transition-all hover:scale-105 ${
                        currentSession.role === 'OWNER'
                          ? 'bg-amber-950/90 text-amber-300 border-amber-400/50 hover:bg-amber-900/90'
                          : 'bg-slate-950/90 text-emerald-300 border-emerald-400/50 hover:bg-slate-900'
                      }`}
                      title="အသုံးပြုသူ အကောင့်ပြောင်းရန် နှိပ်ပါ"
                    >
                      {currentSession.role === 'OWNER' ? (
                        <Shield className="w-3 h-3 text-amber-300 shrink-0" />
                      ) : (
                        <User className="w-3 h-3 text-emerald-300 shrink-0" />
                      )}
                      <span className="truncate max-w-[120px] sm:max-w-none">
                        {currentSession.role === 'OWNER' ? 'ဆိုင်ရှင် (Owner)' : 'ဝန်ထမ်း (Staff)'}
                      </span>
                      <span className="text-[9px] opacity-75 underline">ပြောင်းမည်</span>
                    </button>
                  )}

                  {/* Online / Offline Status Badge */}
                  {isOnline ? (
                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/60 text-emerald-200 border border-emerald-400/30 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-200 border border-rose-400/40 shrink-0 whitespace-nowrap">
                      <WifiOff className="w-3 h-3 text-rose-300" />
                      <span>Offline</span>
                    </span>
                  )}
                </div>

                {/* Contact Address, Phone Number & Tagline */}
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-emerald-100/90 flex-wrap">
                  {address && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[160px] md:max-w-none">
                      <MapPin className="w-3 h-3 text-amber-300 shrink-0" />
                      <span className="truncate">{address}</span>
                    </span>
                  )}
                  {phone && (
                    <>
                      <span className="text-emerald-500">•</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Phone className="w-3 h-3 text-emerald-300 shrink-0" />
                        <span>{phone}</span>
                      </span>
                    </>
                  )}
                  {tagline && (
                    <>
                      <span className="text-emerald-500 hidden lg:inline">•</span>
                      <span className="text-emerald-200/80 hidden lg:inline text-[11px] truncate max-w-[260px]">
                        {tagline}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Secondary Controls Toggle Button */}
            <div className="flex items-center gap-1.5 md:hidden shrink-0">
              {/* Quick Notification Bell for Pending Orders on Mobile */}
              <button
                id="header-mobile-orders-bell-btn"
                type="button"
                onClick={onOpenOrderNotification || onNavigateToOrders}
                className={`relative p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  pendingOrdersCount > 0
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md ring-2 ring-amber-300/80 animate-pulse'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40'
                }`}
                title={pendingOrdersCount > 0 ? `အော်ဒါအသစ် (${pendingOrdersCount}) စောင်` : 'အော်ဒါမှတ်တမ်း'}
                aria-label="အော်ဒါမှတ်တမ်း"
              >
                <Bell className="w-4 h-4 stroke-[2.5]" />
                {pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-red-600 text-white text-[9px] font-black rounded-full border border-white">
                    {pendingOrdersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowMobileTools(!showMobileTools)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                  showMobileTools
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-100 border-emerald-500/50'
                }`}
                title="စနစ်ထိန်းချုပ်မှုများ ကြည့်ရန်/သိမ်းရန်"
                aria-label="စနစ်ထိန်းချုပ်မှုများ ကြည့်ရန်/သိမ်းရန်"
              >
                <MoreHorizontal className="w-4 h-4" />
                <span className="text-[11px] font-bold">စနစ်</span>
                {hasSecondaryAlerts && !showMobileTools && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
                {showMobileTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* System Control Badges & Auxiliary Tools */}
          {/* Always visible on md (tablet/desktop); collapsible on mobile (< 768px) */}
          <div
            className={`w-full md:w-auto ${
              showMobileTools ? 'flex' : 'hidden md:flex'
            } flex-wrap items-center gap-1.5 pt-1.5 md:pt-0 border-t border-emerald-700/40 md:border-t-0`}
          >
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
                aria-label="ဗားရှင်းအသစ် စစ်ဆေးခြင်း"
              >
                <Sparkles className={`w-3 h-3 ${hasPendingUpdate ? 'text-amber-950 fill-amber-950' : 'text-amber-300'}`} />
                <span className="whitespace-nowrap">
                  {hasPendingUpdate ? 'Update ရပါပြီ' : `v${CURRENT_APP_VERSION}`}
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
                aria-label="အက်ပ်အသုံးပြုနည်း လမ်းညွှန်"
              >
                <BookOpen className="w-3 h-3 text-emerald-300" />
                <span className="whitespace-nowrap">လမ်းညွှန်</span>
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
                aria-label="စမတ်သုံးသပ်ချက်"
              >
                <TrendingUp className="w-3 h-3 text-teal-300" />
                <span className="whitespace-nowrap">သုံးသပ်ချက်</span>
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
                aria-label="QR Code Sync"
              >
                <QrCode className="w-3 h-3 text-emerald-300" />
                <span className="whitespace-nowrap">QR Sync</span>
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
                aria-label="WiFi / Hotspot Sync"
              >
                <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />
                <span className="whitespace-nowrap">Sync</span>
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
                aria-label="Zapya Transfer"
              >
                <Share2 className="w-3 h-3 text-purple-200" />
                <span className="whitespace-nowrap">Zapya</span>
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
                aria-label="လုံခြုံရေး App Lock"
              >
                <Lock className="w-3 h-3 text-amber-300" />
                <span>{appLockEnabled ? 'Locked' : 'Lock'}</span>
              </button>
            )}

            {/* Audit Trail Button */}
            {onOpenAuditLogs && (
              <button
                id="header-audit-logs-btn"
                type="button"
                onClick={onOpenAuditLogs}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer shadow-xs transition-all"
                title="လုပ်ငန်းဆောင်ရွက်မှု Audit မှတ်တမ်းအပြည့်အစုံ ကြည့်မည်"
                aria-label="Audit Trail မှတ်တမ်း"
              >
                <Shield className="w-3 h-3 text-emerald-400" />
                <span className="whitespace-nowrap">Audit Trail</span>
              </button>
            )}

            {/* Quick Recycle Bin / Deleted Records Button */}
            {handleOpenTrash && (
              <button
                id="header-deleted-history-btn"
                type="button"
                onClick={handleOpenTrash}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-xs ${
                  deletedHistoryCount > 0
                    ? 'bg-rose-700 hover:bg-rose-600 text-white border-rose-400/50 animate-pulse'
                    : 'bg-emerald-900/80 hover:bg-emerald-850 text-emerald-100 border-emerald-500/50'
                }`}
                title={`ဖျက်ထားသောမှတ်တမ်းများ (Recycle Bin) ကြည့်မည် - ${deletedHistoryCount} ခု`}
                aria-label="ဖျက်ထားသောမှတ်တမ်းများ"
              >
                <Trash2 className="w-3 h-3 text-rose-200" />
                <span className="whitespace-nowrap">အမှိုက်ပုံး</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  deletedHistoryCount > 0 ? 'bg-white text-rose-700' : 'bg-emerald-950 text-emerald-200'
                }`}>
                  {deletedHistoryCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ROW 2: DATE SELECTOR & PRIMARY POS OPERATIONS (Ultra Compact & Responsive) */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5">
          {/* Left: Prominent Date Selector */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center bg-emerald-950/80 border border-emerald-400/60 rounded-xl px-2.5 py-1 text-xs text-white shadow-inner">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-amber-300 shrink-0" />
              <span className="text-emerald-200 mr-1.5 font-semibold text-xs whitespace-nowrap">ရက်စွဲ:</span>
              <input
                id="header-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                aria-label="ရက်စွဲ ရွေးချယ်ရန်"
              />
            </div>

            {selectedDate !== getTodayDateString() && (
              <button
                type="button"
                onClick={() => onDateChange(getTodayDateString())}
                className="px-2 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                title="ယနေ့ရက်စွဲသို့ အမြန်ပြန်သွားမည်"
                aria-label="ယနေ့ရက်စွဲသို့ ပြန်သွားရန်"
              >
                ဒီနေ့ရက်သို့
              </button>
            )}
          </div>

          {/* Right: Operational Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Quick Inbound Button */}
            {handleOpenEntry && (
              <button
                id="header-new-inbound-btn"
                type="button"
                onClick={handleOpenEntry}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer border border-emerald-200"
                title="ကုန်သိမ်းအသစ် ရေးသွင်းမည်"
                aria-label="ကုန်သိမ်းအသစ် ရေးသွင်းရန်"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3] text-emerald-700" />
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
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer border border-blue-400/40"
                title="ကုန်သည်အရောင်းအသစ် ရေးသွင်းမည်"
                aria-label="ကုန်သည်အရောင်းအသစ် ရေးသွင်းရန်"
              >
                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3] text-white" />
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
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md ring-2 ring-amber-300/80 animate-bounce cursor-pointer transition-all"
                title={`ကုန်ပစ္စည်း (${lowStockCount}) မျိုး အနည်းဆုံးလက်ကျန်ထက် လျော့နည်းနေပါသည်!`}
                aria-label="ကုန်ပစ္စည်း လိုအပ်ချက် သတိပေးချက်"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 stroke-[3]" />
                <span className="whitespace-nowrap">လို ({lowStockCount})</span>
              </button>
            )}

            {/* Notification Bell for Pending Orders (Hidden on mobile primary row since it's in header right) */}
            <button
              id="header-orders-notification-bell-btn"
              type="button"
              onClick={onOpenOrderNotification || onNavigateToOrders}
              className={`hidden md:flex relative p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                pendingOrdersCount > 0
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md ring-2 ring-amber-300/80 animate-pulse'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40'
              }`}
              title={
                pendingOrdersCount > 0
                  ? `အော်ဒါအသစ် (${pendingOrdersCount}) စောင် စောင့်ဆိုင်းနေပါသည်`
                  : 'အော်ဒါမှတ်တမ်း'
              }
              aria-label="အော်ဒါမှတ်တမ်း"
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
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 shadow-xs border border-amber-300 cursor-pointer transition-all"
                title="အက်ပ်ကို လက်တွေ့ စတင်အသုံးပြုမည် (လက်ကျန်အားလုံး 0 သုည သတ်မှတ်ချက်)"
                aria-label="စတင်အသုံးပြုမည်"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                <span className="whitespace-nowrap hidden sm:inline">စတင်အသုံးပြုမည်</span>
                <span className="whitespace-nowrap sm:hidden">စတင်မည်</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
