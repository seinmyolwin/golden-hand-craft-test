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
  isLive?: boolean;
  onOpenRevertLiveStatus?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isLive = false,
  onOpenRevertLiveStatus,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shwe_let_yar_header_collapsed') === 'true';
    }
    return false;
  });

  const isActuallyCollapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('shwe_let_yar_header_collapsed', String(next));
        } catch (e) {
          // ignore
        }
        return next;
      });
    }
  };

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

  // =========================================================================
  // MINI COLLAPSED BAR: Ultra-compact header with prominent Arrow button
  // =========================================================================
  if (isActuallyCollapsed) {
    return (
      <header
        id="global-header-collapsed"
        className="sticky top-0 z-30 bg-emerald-900/95 backdrop-blur-md text-white shadow-md border-b border-emerald-700/80 select-none transition-all animate-in slide-in-from-top-2 duration-200"
      >
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1 flex items-center justify-between gap-2">
          {/* Left: Branding & Date */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <Logo
              size="xs"
              className="w-7 h-7 rounded-lg border border-amber-400/70 shadow-xs cursor-pointer hover:scale-105 transition-transform shrink-0 bg-slate-950/40"
              onClick={handleEditProfile}
              alt={shopName}
            />
            <button
              type="button"
              onClick={handleEditProfile}
              className="font-black text-xs sm:text-sm text-white hover:text-amber-200 transition-colors truncate text-left max-w-[130px] sm:max-w-[220px]"
              title="ဆိုင်အချက်အလက် ပြင်ဆင်ရန်"
            >
              {shopName}
            </button>
            <span className="text-emerald-400 text-xs hidden sm:inline">•</span>
            <span className="text-emerald-200 text-xs font-bold hidden sm:inline">{selectedDate}</span>
          </div>

          {/* Center: Prominent Arrow Button to Expand (မျှာလေး နှိပ်ပြီး Header ဖော်မည်) */}
          <button
            id="header-expand-arrow-btn"
            type="button"
            onClick={handleToggleCollapse}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-md border border-amber-300 cursor-pointer transition-all hover:scale-105 animate-pulse"
            title="Header အပြည့်အစုံ ပြန်ဖော်မည် (မျှာလေးကို နှိပ်ပါ)"
            aria-label="Header ပြန်ဖော်မည်"
          >
            <ChevronDown className="w-4 h-4 stroke-[3] text-slate-950 animate-bounce" />
            <span className="whitespace-nowrap font-black">Header ဖော်မည်</span>
          </button>

          {/* Right: Quick actions so cashier/shop operations are seamlessly available */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {isLive && onOpenRevertLiveStatus && (
              <button
                type="button"
                onClick={onOpenRevertLiveStatus}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-950 text-emerald-200 border border-emerald-400/60 rounded-lg text-[10px] font-black cursor-pointer hover:bg-emerald-900"
                title="တိုက်ရိုက်အသုံးပြုနေသည် (Live Status) - နှိပ်၍ ပြင်ဆင်ရန်/ဖြုတ်ရန်"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>LIVE 🟢</span>
              </button>
            )}

            {handleOpenEntry && (
              <button
                type="button"
                onClick={handleOpenEntry}
                className="flex items-center gap-0.5 px-2 py-1 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-black text-[11px] rounded-lg shadow-2xs border border-emerald-200 cursor-pointer transition-all"
                title="ကုန်သိမ်းအသစ် ရေးသွင်းမည်"
              >
                <ArrowDownLeft className="w-3 h-3 stroke-[3] text-emerald-700" />
                <span className="hidden sm:inline">ကုန်သိမ်း</span>
                {todayInboundCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded-full text-[9px] font-black">
                    {todayInboundCount}
                  </span>
                )}
              </button>
            )}

            {handleOpenSale && (
              <button
                type="button"
                onClick={handleOpenSale}
                className="flex items-center gap-0.5 px-2 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-[11px] rounded-lg shadow-2xs border border-blue-400/50 cursor-pointer transition-all"
                title="အရောင်းအသစ် ရေးသွင်းမည်"
              >
                <ArrowUpRight className="w-3 h-3 stroke-[3]" />
                <span className="hidden sm:inline">အရောင်း</span>
                {todaySalesCount > 0 && (
                  <span className="bg-blue-900 text-blue-100 px-1 py-0.2 rounded-full text-[9px] font-black">
                    {todaySalesCount}
                  </span>
                )}
              </button>
            )}

            {lowStockCount > 0 && onOpenLowStockAlert && (
              <button
                type="button"
                onClick={onOpenLowStockAlert}
                className="px-1.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] rounded-lg border border-amber-300 shadow-2xs animate-pulse"
                title={`ကုန်ပစ္စည်း (${lowStockCount}) မျိုး လိုအပ်`}
              >
                လို ({lowStockCount})
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

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

              <div className="min-w-0 flex-1 space-y-1">
                {/* Shop Title, Network Status & Owner Name */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="text-base sm:text-lg md:text-xl font-black text-white hover:text-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer text-left tracking-tight group truncate max-w-[160px] min-[400px]:max-w-[220px] sm:max-w-none"
                    title="ဆိုင်ရှင်နှင့် ဆိုင်အချက်အလက် ပြင်ဆင်ရန် နှိပ်ပါ"
                    aria-label="ဆိုင်အချက်အလက် ပြင်ဆင်ရန်"
                  >
                    <span className="truncate">{shopName}</span>
                    <Edit3 className="w-3.5 h-3.5 text-emerald-300 opacity-80 group-hover:opacity-100 shrink-0" />
                  </button>

                  {/* Online / Offline Status Badge */}
                  {isOnline ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/70 text-emerald-200 border border-emerald-400/40 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/90 text-rose-200 border border-rose-400/50 shrink-0 whitespace-nowrap">
                      <WifiOff className="w-3 h-3 text-rose-300" />
                      <span>Offline</span>
                    </span>
                  )}

                  {/* Dedicated Owner Name Field */}
                  {ownerName && (
                    <div className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-100 text-xs shadow-2xs shrink-0">
                      <User className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="text-emerald-200/90 font-medium text-xs">ဆိုင်ရှင်:</span>
                      <strong className="text-white font-bold tracking-wide truncate max-w-[130px] sm:max-w-[200px]">
                        {ownerName}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Contact Address, Phone Number & Tagline */}
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-emerald-100/90 flex-wrap pt-0.5">
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
            <div className="flex items-center gap-3 md:hidden shrink-0">
              {/* Quick Notification Bell for Pending Orders on Mobile (Touch target at least 44x44px) */}
              <button
                id="header-mobile-orders-bell-btn"
                type="button"
                onClick={onOpenOrderNotification || onNavigateToOrders}
                className={`relative w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  pendingOrdersCount > 0
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md ring-2 ring-amber-300/80 animate-pulse'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/40'
                }`}
                title={pendingOrdersCount > 0 ? `အော်ဒါအသစ် (${pendingOrdersCount}) စောင်` : 'အော်ဒါမှတ်တမ်း'}
                aria-label="အော်ဒါမှတ်တမ်း"
              >
                <Bell className="w-5 h-5 stroke-[2.5]" />
                {pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-black rounded-full border border-white">
                    {pendingOrdersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowMobileTools(!showMobileTools)}
                className={`flex items-center gap-1 px-2.5 py-2 min-h-[44px] rounded-xl text-xs font-bold border cursor-pointer transition-all ${
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
            className={`w-full ${
              showMobileTools ? 'flex' : 'hidden md:flex'
            } flex-col gap-1.5 sm:gap-2 pt-1.5 md:pt-0 border-t border-emerald-700/40 md:border-t-0`}
          >
            {/* ROW 1 (Top Row) */}
            <div className="w-full flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {/* Offline Status Indicator */}
              <OfflineIndicator className="text-white shrink-0" />

              {/* In-App PWA Install Button */}
              <PWAInstallButton className="shrink-0" />

              {/* Version Update Button */}
              {onOpenUpdateModal && (
                <button
                  id="header-update-btn"
                  type="button"
                  onClick={onOpenUpdateModal}
                  className={`h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold border shadow-2xs cursor-pointer transition-all shrink-0 ${
                    hasPendingUpdate
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 animate-bounce shadow-md font-extrabold'
                      : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-100 border-emerald-400/50'
                  }`}
                  title="ဗားရှင်းအသစ် စစ်ဆေးခြင်း / အဆင့်မြှင့်တင်ခြင်း"
                  aria-label="ဗားရှင်းအသစ် စစ်ဆေးခြင်း"
                >
                  <Sparkles className={`w-3.5 h-3.5 shrink-0 ${hasPendingUpdate ? 'text-amber-950 fill-amber-950' : 'text-amber-300'}`} />
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
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-100 border border-emerald-400/50 shadow-2xs cursor-pointer transition-all shrink-0"
                  title="အက်ပ်အသုံးပြုနည်း လမ်းညွှန် ဖတ်ရှုမည်"
                  aria-label="အက်ပ်အသုံးပြုနည်း လမ်းညွှန်"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="whitespace-nowrap">လမ်းညွှန်</span>
                </button>
              )}

              {/* Smart Insights Button */}
              {onOpenInsights && (
                <button
                  id="header-insights-btn"
                  type="button"
                  onClick={onOpenInsights}
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-teal-950/80 hover:bg-teal-900 text-teal-100 border border-teal-400/50 shadow-2xs cursor-pointer transition-all shrink-0"
                  title="စမတ်သုံးသပ်ချက် - ရောင်းအားအကောင်းဆုံးနှင့် ကုန်ပစ္စည်းပေးသွင်းသူကြိုငွေ စောင့်ကြည့်မှု"
                  aria-label="စမတ်သုံးသပ်ချက်"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                  <span className="whitespace-nowrap">သုံးသပ်ချက်</span>
                </button>
              )}

              {/* Audit Trail Button */}
              {onOpenAuditLogs && (
                <button
                  id="header-audit-logs-btn"
                  type="button"
                  onClick={onOpenAuditLogs}
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-slate-950/80 hover:bg-slate-900 text-slate-200 border border-slate-700 cursor-pointer shadow-2xs transition-all shrink-0"
                  title="လုပ်ငန်းဆောင်ရွက်မှု Audit မှတ်တမ်းအပြည့်အစုံ ကြည့်မည်"
                  aria-label="Audit Trail မှတ်တမ်း"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="whitespace-nowrap">Audit Trail</span>
                </button>
              )}
            </div>

            {/* ROW 2 (Bottom Row) */}
            <div className="w-full flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {/* QR Sync Button */}
              {onOpenQRSync && (
                <button
                  id="header-qr-sync-btn"
                  type="button"
                  onClick={onOpenQRSync}
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-100 border border-emerald-400/50 shadow-2xs cursor-pointer transition-all shrink-0"
                  title="QR Code ဖြင့် အင်တာနက်မလိုဘဲ ဘောင်ချာ စာရင်းသွင်း/ထုတ်ယူမည်"
                  aria-label="QR Code Sync"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="whitespace-nowrap">QR Sync</span>
                </button>
              )}

              {/* WiFi / Hotspot Sync Button */}
              {handleSync && (
                <button
                  id="header-sync-btn"
                  type="button"
                  onClick={handleSync}
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-100 border border-emerald-400/50 cursor-pointer shadow-2xs transition-all shrink-0"
                  title="WiFi / Hotspot ဒေတာ Sync"
                  aria-label="WiFi / Hotspot Sync"
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse shrink-0" />
                  <span className="whitespace-nowrap">Sync</span>
                </button>
              )}

              {/* Zapya Transfer Button */}
              {handleZapya && (
                <button
                  id="header-zapya-btn"
                  type="button"
                  onClick={handleZapya}
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-purple-950/80 hover:bg-purple-900 text-purple-100 border border-purple-400/50 cursor-pointer shadow-2xs transition-all shrink-0"
                  title="Zapya / Bluetooth ဖြင့် App တစ်ခုလုံးပို့မည်"
                  aria-label="Zapya Transfer"
                >
                  <Share2 className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                  <span className="whitespace-nowrap">Zapya</span>
                </button>
              )}

              {/* User Role Switch Button */}
              {currentSession && onOpenUserSwitch && (
                <button
                  id="header-user-role-badge-btn"
                  type="button"
                  onClick={onOpenUserSwitch}
                  className={`h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold border shadow-2xs cursor-pointer transition-all shrink-0 ${
                    currentSession.role === 'OWNER'
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 shadow-amber-900/40'
                      : 'bg-teal-950/80 hover:bg-teal-900 text-teal-100 border-teal-400/50'
                  }`}
                  title="အသုံးပြုသူ အကောင့် / ရာထူးပြောင်းရန် နှိပ်ပါ"
                  aria-label="အသုံးပြုသူ ရာထူးပြောင်းရန်"
                >
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                    currentSession.role === 'OWNER' ? 'bg-slate-950 text-amber-300' : 'bg-teal-400 text-slate-950'
                  }`}>
                    {currentSession.role === 'OWNER' ? (
                      <Shield className="w-2.5 h-2.5" />
                    ) : (
                      <User className="w-2.5 h-2.5" />
                    )}
                  </div>
                  <span className="whitespace-nowrap">
                    {currentSession.role === 'OWNER' ? 'ဆိုင်ရှင် (Owner)' : 'ဝန်ထမ်း (Staff)'}
                  </span>
                  <span className="text-[10px] font-semibold opacity-90 underline decoration-dotted whitespace-nowrap">
                    ပြောင်းမည်
                  </span>
                </button>
              )}

              {/* Lock App / Security Settings Button */}
              {(onLockApp || onOpenAppLockSettings) && (
                <button
                  id="header-lock-app-btn"
                  type="button"
                  onClick={onLockApp || onOpenAppLockSettings}
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-slate-950/80 hover:bg-slate-900 text-slate-200 border border-slate-700 cursor-pointer shadow-2xs transition-all shrink-0"
                  title="လုံခြုံရေး App မျက်နှာပြင် Lock ချမည် / စကားဝှက် ဆက်တင်"
                  aria-label="လုံခြုံရေး App Lock"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="whitespace-nowrap">{appLockEnabled ? 'Locked' : 'Lock'}</span>
                </button>
              )}

              {/* Quick Recycle Bin / Deleted Records Button */}
              {handleOpenTrash && (
                <button
                  id="header-deleted-history-btn"
                  type="button"
                  onClick={handleOpenTrash}
                  className={`h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs shrink-0 ${
                    deletedHistoryCount > 0
                      ? 'bg-rose-700 hover:bg-rose-600 text-white border-rose-400/50 animate-pulse'
                      : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-100 border-emerald-400/50'
                  }`}
                  title={`ဖျက်ထားသောမှတ်တမ်းများ (Recycle Bin) ကြည့်မည် - ${deletedHistoryCount} ခု`}
                  aria-label="ဖျက်ထားသောမှတ်တမ်းများ"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                  <span className="whitespace-nowrap">အမှိုက်ပုံး</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    deletedHistoryCount > 0 ? 'bg-white text-rose-700' : 'bg-emerald-900 text-emerald-200'
                  }`}>
                    {deletedHistoryCount}
                  </span>
                </button>
              )}
            </div>
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
              className={`hidden md:flex relative w-11 h-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
              <Bell className="w-5 h-5 stroke-[2.5]" />
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-black rounded-full shadow-xs border border-white">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            {/* Start App / Zero Settings Button or Live Status Indicator */}
            {isLive ? (
              <button
                id="header-live-status-btn"
                type="button"
                onClick={onOpenRevertLiveStatus}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-950/90 hover:bg-emerald-900 active:scale-95 text-emerald-100 border border-emerald-400/70 shadow-xs cursor-pointer transition-all"
                title="တိုက်ရိုက်အသုံးပြုနေသည် (Live Status) - နှိပ်၍ ဆက်တင်ပြင်ဆင်ရန် သို့မဟုတ် Live Status ယာယီဖြုတ်ရန်"
                aria-label="တိုက်ရိုက်အသုံးပြုနေသည်"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="whitespace-nowrap font-bold text-[11px] sm:text-xs">LIVE STATUS 🟢</span>
              </button>
            ) : onOpenZeroSettings ? (
              <button
                id="header-zero-start-btn"
                type="button"
                onClick={onOpenZeroSettings}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 shadow-xs border border-amber-300 cursor-pointer transition-all animate-pulse"
                title="အက်ပ်ကို လက်တွေ့ စတင်အသုံးပြုမည် (လက်ကျန်အားလုံး 0 သုည သတ်မှတ်ချက်)"
                aria-label="စတင်အသုံးပြုမည်"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                <span className="whitespace-nowrap hidden sm:inline">စတင်အသုံးပြုမည်</span>
                <span className="whitespace-nowrap sm:hidden">စတင်မည်</span>
              </button>
            ) : null}

            {/* Quick Collapse Header Arrow Button (မျှာလေး နှိပ်ပြီး Header ဝှက်မည်) */}
            <button
              id="header-collapse-quick-btn"
              type="button"
              onClick={handleToggleCollapse}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-950/90 hover:bg-emerald-900 active:scale-95 text-emerald-100 border border-emerald-500/50 cursor-pointer shadow-2xs transition-all shrink-0 hover:text-amber-200"
              title="Header ဝှက်မည် (Click arrow to hide header)"
              aria-label="Header ဝှက်မည်"
            >
              <ChevronUp className="w-4 h-4 text-amber-300 stroke-[2.5]" />
              <span className="whitespace-nowrap font-bold hidden sm:inline">Header ဝှက်မည်</span>
            </button>
          </div>
        </div>

        {/* Bottom Center Arrow Collapse Handle (မျှာလေး) */}
        <div className="flex justify-center -mb-2 pt-0.5">
          <button
            id="header-collapse-handle-btn"
            type="button"
            onClick={handleToggleCollapse}
            className="group flex items-center gap-1.5 px-4 py-0.5 bg-emerald-900 hover:bg-emerald-950 active:scale-95 text-emerald-200 hover:text-amber-300 rounded-full border border-emerald-700/80 shadow-xs text-[11px] font-bold cursor-pointer transition-all hover:px-5"
            title="Header မျက်နှာပြင် ဝှက်မည် (Click arrow to hide header)"
            aria-label="Header ဝှက်မည်"
          >
            <ChevronUp className="w-3.5 h-3.5 text-amber-300 group-hover:-translate-y-0.5 transition-transform" />
            <span>Header ဝှက်မည်</span>
          </button>
        </div>
      </div>
    </header>
  );
};
