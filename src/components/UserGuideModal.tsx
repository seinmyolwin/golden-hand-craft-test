import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  AlertTriangle,
  Users,
  Building2,
  Lock,
  Printer,
  Smartphone,
  CheckCircle2,
  Search,
  Truck,
  Phone,
  ShieldCheck,
  Zap,
  Sparkles,
  Layers,
  FileText,
  Check,
  Download,
  Upload,
  QrCode,
  DollarSign,
  Calendar,
  Eye,
  RefreshCw,
  Camera,
  Tag,
  Clock,
  HelpCircle,
  TrendingUp,
  Inbox,
  Share2,
} from 'lucide-react';
import { Logo } from './Logo';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenZeroReset?: () => void;
  onOpenNewEntry?: () => void;
  onOpenNewSale?: () => void;
}

type GuideChapter =
  | 'overview'
  | 'inbound'
  | 'raw_materials'
  | 'sales'
  | 'vouchers_print'
  | 'orders'
  | 'peer_trading'
  | 'inventory_alerts'
  | 'ledgers'
  | 'cash_closing'
  | 'backup_zapya'
  | 'security_lock'
  | 'zero_setup';

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenZeroReset,
  onOpenNewEntry,
  onOpenNewSale,
}) => {
  const [activeChapter, setActiveChapter] = useState<GuideChapter>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPrintMenu, setShowPrintMenu] = useState<boolean>(false);
  const [printAllChapters, setPrintAllChapters] = useState<boolean>(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintAllChapters(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrintCurrent = () => {
    setPrintAllChapters(false);
    setShowPrintMenu(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintAll = () => {
    setPrintAllChapters(true);
    setShowPrintMenu(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  if (!isOpen) return null;

  const chapters: {
    id: GuideChapter;
    number: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    {
      id: 'overview',
      number: '၀',
      title: 'စနစ်အကျဉ်းချုပ်နှင့် မျက်နှာပြင်ဖွဲ့စည်းပုံ',
      subtitle: 'ပင်မမျက်နှာပြင်၊ ခလုတ်များ၊ လုပ်ငန်းစဥ်အပြည့်အစုံ',
      icon: <BookOpen className="w-4 h-4 text-emerald-600" />,
    },
    {
      id: 'inbound',
      number: '၁',
      title: 'ကုန်သိမ်းဘောင်ချာ မိုဒယ်လ်',
      subtitle: 'ပစ္စည်းလက်ခံခြင်း၊ အကြိုငွေနုတ်ခြင်း၊ အပိုပေးငွေတွက်ချက်မှု',
      icon: <ArrowDownLeft className="w-4 h-4 text-emerald-600" />,
      badge: 'အဓိက',
    },
    {
      id: 'raw_materials',
      number: '၂',
      title: 'ဝါး/ကြိမ်ကုန်ကြမ်း & ငွေကြိုယူ မိုဒယ်လ်',
      subtitle: 'ဝါးပိုးဝါး၊ ကြိမ်၊ ကုန်ကြမ်းကြိုထုတ်နှင့် အကြိုငွေစာရင်း',
      icon: <Layers className="w-4 h-4 text-amber-600" />,
      badge: 'အသစ်',
    },
    {
      id: 'sales',
      number: '၃',
      title: 'လက်ကား/လက်လီ အရောင်း မိုဒယ်လ်',
      subtitle: 'ကုန်သည်ရွေးချယ်ခြင်း၊ ကားဂိတ်/ယာဉ်မောင်းနှင့် အကြွေးစာရင်း',
      icon: <ArrowUpRight className="w-4 h-4 text-blue-600" />,
      badge: 'အဓိက',
    },
    {
      id: 'vouchers_print',
      number: '၄',
      title: 'ဘောင်ချာ & Thermal Receipt ပရင့်စနစ်',
      subtitle: 'A4, A5 စာရွက်နှင့် 80mm/58mm အပူပေးစလစ် ပရင့်ထုတ်နည်း',
      icon: <Printer className="w-4 h-4 text-indigo-600" />,
    },
    {
      id: 'orders',
      number: '၅',
      title: 'ကုန်သည်အော်ဒါ & စရန်ငွေ မိုဒယ်လ်',
      subtitle: 'ကြိုတင်အော်ဒါ၊ စရန်ငွေမှတ်တမ်းနှင့် အရောင်းသို့တိုက်ရိုက်ပြောင်းခြင်း',
      icon: <Package className="w-4 h-4 text-purple-600" />,
    },
    {
      id: 'peer_trading',
      number: '၆',
      title: 'ဆိုင်ချင်း ကုန်ဖလှယ်မှု/အငှား မိုဒယ်လ်',
      subtitle: 'မိတ်ဆွေဆိုင်များထံမှ ကုန်ငှားယူခြင်းနှင့် ကုန်ငှားထုတ်ပေးခြင်း',
      icon: <Users className="w-4 h-4 text-cyan-600" />,
    },
    {
      id: 'inventory_alerts',
      number: '၇',
      title: 'ကုန်လက်ကျန် & အနိမ့်ဆုံးသတိပေးချက်',
      subtitle: 'ပစ္စည်းလက်ကျန် အဝင်/အထွက် လယ်ဂျာနှင့် Min Stock သတိပေးချက်',
      icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
      badge: 'သတိပေး',
    },
    {
      id: 'ledgers',
      number: '၈',
      title: 'ပေးသွင်းသူ & ကုန်သည် လယ်ဂျာ မိုဒယ်လ်',
      subtitle: 'အကြိုငွေအကောင့်ရှင်းတမ်းနှင့် ကုန်သည်အရောင်းအကြွေးစာရင်း',
      icon: <Building2 className="w-4 h-4 text-teal-600" />,
    },
    {
      id: 'cash_closing',
      number: '၉',
      title: 'ငွေသားစာရင်း & နေ့ချုပ်စစ်ဆေးမှု',
      subtitle: 'နေ့စဉ် ငွေသားအဝင်/အထွက်နှင့် နေ့ချုပ်စာရင်းကိုက်ညီမှု',
      icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
    },
    {
      id: 'backup_zapya',
      number: '၁၀',
      title: 'ဒေတာအရန်သိမ်း & Zapya/QR ကူးပြောင်းမှု',
      subtitle: 'Shwe let yar doc. ဖိုင်သိမ်းဆည်းခြင်းနှင့် ဖုန်းချင်းအော့ဖ်လိုင်းကူးနည်း',
      icon: <Smartphone className="w-4 h-4 text-indigo-600" />,
      badge: 'အရေးကြီး',
    },
    {
      id: 'security_lock',
      number: '၁၁',
      title: 'App Lock & အသုံးပြုသူအခန်းကဏ္ဍ',
      subtitle: 'ပင်နံပါတ်စကားဝှက်၊ Master Recovery Key နှင့် ရာထူးခွင့်ပြုချက်များ',
      icon: <Lock className="w-4 h-4 text-rose-600" />,
    },
    {
      id: 'zero_setup',
      number: '၁၂',
      title: 'စတင်အသုံးပြုမည် (Zero Setup & Go-Live)',
      subtitle: 'နမူနာဒေတာရှင်းလင်းခြင်း၊ စတင်လက်ကျန်ထည့်သွင်းခြင်းနှင့် လုပ်ငန်းစတင်ခြင်း',
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      badge: 'Go-Live',
    },
  ];

  const filteredChapters = chapters.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:p-0 print:bg-white print:overflow-visible modal-printable-backdrop">
      <div className="bg-white text-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col h-[92vh] print:h-auto print:max-w-none print:shadow-none print:border-none print:rounded-none print:overflow-visible modal-printable-container">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-emerald-800 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-emerald-900 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-amber-300/40 shrink-0">
              <Logo size="sm" alt="ရွှေလက်ရာ" className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
                <span>ရွှေလက်ရာ အသုံးပြုသူလက်စွဲလမ်းညွှန် (Complete Visual Guide)</span>
                <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                  မျက်နှာပြင်ပုံစံများဖြင့်
                </span>
              </h2>
              <p className="text-[11px] text-emerald-100">
                လုပ်ဆောင်ချက်နှင့် မိုဒယ်လ် (Modals) တစ်ခုချင်းစီ၏ Screen Shot ပုံစံများဖြင့် အလွယ်တကူ လေ့လာနိုင်ပါသည်
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintMenu(!showPrintMenu)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              title="လက်စွဲလမ်းညွှန်ကို PDF သို့မဟုတ် ပရင့်ထုတ်မည်"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">PDF / ပရင့်ထုတ်မည်</span>
              <span className="sm:hidden text-[10px] bg-amber-400 text-slate-950 px-1 py-0.2 rounded font-black">PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-emerald-900/80 hover:bg-emerald-700 text-emerald-200 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              title="ပိတ်မည်"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Subheader Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 print:hidden">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ရှာဖွေလိုသော အကြောင်းအရာ (ဥပမာ - ဘောင်ချာ၊ ကုန်သိမ်း၊ အရောင်း၊ Zapya)..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPrintMenu(!showPrintMenu)}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF / ပရင့် ရွေးချယ်မှု</span>
              </button>
              {showPrintMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-900 text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Printer className="w-4 h-4 text-emerald-600" />
                      <span>လက်စွဲလမ်းညွှန် PDF / ပရင့်ထုတ်ရန်</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPrintMenu(false)}
                      className="w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={handlePrintCurrent}
                      className="w-full text-left p-2.5 hover:bg-emerald-50 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors border border-transparent hover:border-emerald-200"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">လက်ရှိဖွင့်ထားသော အခန်း ထုတ်မည်</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {chapters.find((c) => c.id === activeChapter)?.title} ကိုသာ ထုတ်မည်
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintAll}
                      className="w-full text-left p-2.5 hover:bg-amber-50 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors border border-transparent hover:border-amber-200"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">လက်စွဲလမ်းညွှန် စာအုပ်အပြည့်အစုံ PDF ထုတ်မည်</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          မာတိကာနှင့် အခန်း ၁၃ ခန်းစလုံး၏ Screen Shot များပါဝင်သော PDF စာအုပ်ထုတ်မည်
                        </div>
                      </div>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl text-[10px] text-slate-600 mt-2 border border-slate-200/80 leading-relaxed">
                    💡 <strong>PDF သိမ်းနည်း:</strong> ပရင့်ဝင်းဒိုးတွင် <strong>Destination</strong> ကို <strong>"Save as PDF"</strong> ရွေးချယ်ပြီး သိမ်းဆည်းပါ။
                  </div>
                </div>
              )}
            </div>

            {onOpenZeroReset && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenZeroReset();
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>စတင်အသုံးပြုမည် (Zero Setup)</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden print:overflow-visible">
          {/* Navigation Sidebar */}
          <nav className="w-full md:w-72 bg-slate-100/90 border-b md:border-b-0 md:border-r border-slate-200 p-2 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col gap-1.5 print:hidden">
            {filteredChapters.map((ch) => {
              const isSelected = activeChapter === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChapter(ch.id)}
                  className={`flex items-start justify-between p-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap md:whitespace-normal cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 bg-white/60 border border-slate-200/50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`p-1 rounded-lg shrink-0 ${isSelected ? 'bg-white/10 text-amber-300' : 'bg-slate-100'}`}>
                      {ch.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-200 text-slate-700'}`}>
                          {ch.number}
                        </span>
                        <span className="line-clamp-1">{ch.title}</span>
                      </div>
                      <p className={`text-[10px] font-normal line-clamp-1 mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-slate-500'}`}>
                        {ch.subtitle}
                      </p>
                    </div>
                  </div>
                  {ch.badge && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase shrink-0 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {ch.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Guide Content Display */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-8 print:p-0 print:overflow-visible">
            {/* PRINT-ONLY COVER & HEADER */}
            <div className="hidden print:block mb-8">
              {printAllChapters ? (
                <div className="text-center py-6 border-b-2 border-slate-800 space-y-3">
                  <div className="flex justify-center mb-2">
                    <Logo size="lg" alt="ရွှေလက်ရာ" className="w-16 h-16" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-900">
                    ရွှေလက်ရာ - မြန်မာ့လက်မှု စာရင်းကိုင်စနစ်
                  </h1>
                  <p className="text-sm font-bold text-emerald-800">
                    လုပ်ငန်းခွင်သုံး စာရင်းကိုင်စနစ် မျက်နှာပြင်ပုံစံများပါဝင်သော ပြည့်စုံသည့် လက်စွဲလမ်းညွှန် (Complete Visual Manual)
                  </p>
                  <div className="inline-block bg-slate-100 px-3 py-1 rounded-lg text-xs font-semibold text-slate-700">
                    ရက်စွဲ: {new Date().toLocaleDateString('my-MM')} | ၁၀၀% အော့ဖ်လိုင်းသုံးစနစ် | စုစုပေါင်းအခန်း - ၁၃ ခန်း
                  </div>

                  {/* Table of Contents for Print */}
                  <div className="mt-6 pt-4 border-t border-slate-200 text-left">
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                      မာတိကာ (Table of Contents)
                    </h2>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      {chapters.map((t, idx) => (
                        <div key={t.id} className="flex justify-between py-1 border-b border-dotted border-slate-300">
                          <span>{t.title}</span>
                          <span className="font-mono text-slate-500">အခန်း ({idx})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Logo size="sm" alt="ရွှေလက်ရာ" className="w-9 h-9" />
                    <div>
                      <h2 className="text-sm font-black text-slate-900">ရွှေလက်ရာ - မြန်မာ့လက်မှု စာရင်းကိုင်စနစ်</h2>
                      <p className="text-xs font-bold text-emerald-800">{chapters.find((c) => c.id === activeChapter)?.title}</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-500">
                    <p>ရက်စွဲ: {new Date().toLocaleDateString('my-MM')}</p>
                    <p>အသုံးပြုသူ လက်စွဲလမ်းညွှန်</p>
                  </div>
                </div>
              )}
            </div>

            {/* CHAPTER 0: OVERVIEW & UI LAYOUT SCREENSHOT */}
            {(printAllChapters || activeChapter === 'overview') && (
              <section className={`space-y-6 ${printAllChapters ? 'pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>စနစ်အကျဉ်းချုပ် & အသုံးပြုသူ လမ်းညွှန်</span>
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-emerald-950">
                      ရွှေလက်ရာ - မြန်မာ့လက်မှု၊ ဝါးနှီးနှင့် ယွန်းထည် စာရင်းကိုင်စနစ်
                    </h3>
                    <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                      အင်တာနက်လိုင်းမလိုဘဲ ဖုန်းနှင့် ကွန်ပျူတာပေါ်တွင် ၁၀၀% အော့ဖ်လိုင်းအသုံးပြုနိုင်သည့် မြန်မာ့ရိုးရာ ကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်းသုံး လယ်ဂျာစနစ် ဖြစ်ပါသည်။ အောက်ပါ မျက်နှာပြင်ပုံစံများအတိုင်း အဆင့်ဆင့် အသုံးပြုနိုင်ပါသည်။
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto print:hidden">
                    {onOpenNewEntry && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenNewEntry();
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <ArrowDownLeft className="w-4 h-4 text-amber-300" />
                        <span>+ ကုန်သိမ်းဘောင်ချာ အသစ်စမ်းဖွင့်မည်</span>
                      </button>
                    )}
                    {onOpenNewSale && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenNewSale();
                        }}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <ArrowUpRight className="w-4 h-4 text-blue-200" />
                        <span>+ အရောင်းဘောင်ချာ အသစ်စမ်းဖွင့်မည်</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* VISUAL SCREENSHOT: MAIN HEADER & APP NAVIGATION */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      <span>[မျက်နှာပြင်ပုံစံ ၁] ပင်မခေါင်းစီးဘား (Header) နှင့် အောက်ခြေမီနူး (Navigation)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Main Dashboard Screen</span>
                  </div>

                  <div className="rounded-2xl border-2 border-emerald-500/80 bg-slate-900 p-3 sm:p-4 text-white shadow-xl space-y-3">
                    {/* Simulated Header */}
                    <div className="bg-emerald-800 rounded-xl p-3 border border-emerald-700/80 flex flex-wrap items-center justify-between gap-2 shadow-inner">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white/10 p-1 flex items-center justify-center border border-amber-300/40">
                          <Logo size="sm" alt="ရွှေလက်ရာ" className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                            <span>ရွှေလက်ရာ - မြန်မာ့လက်မှု</span>
                            <span className="text-[9px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full">● LIVE</span>
                          </div>
                          <div className="text-[10px] text-emerald-200">ကျောက်ပန်းတောင်းလမ်း၊ ညောင်ဦးမြို့နယ်</div>
                        </div>
                      </div>

                      {/* Header Quick Buttons */}
                      <div className="flex items-center gap-1.5">
                        <div className="px-2 py-1 bg-emerald-700 rounded-lg text-[10px] font-bold text-amber-300 border border-emerald-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>ယနေ့ရက်စွဲ</span>
                        </div>
                        <div className="px-2.5 py-1 bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-xs">
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>+ ကုန်သိမ်း</span>
                        </div>
                        <div className="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-xs">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>+ အရောင်း</span>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-emerald-900/80 flex items-center justify-center text-amber-300">
                          <Lock className="w-3 h-3" />
                        </div>
                      </div>
                    </div>

                    {/* Simulated Bottom Navigation */}
                    <div className="bg-slate-800 rounded-xl p-2 border border-slate-700 flex justify-between items-center text-[10px] overflow-x-auto gap-1">
                      <div className="px-2 py-1.5 bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 shrink-0">
                        <ArrowDownLeft className="w-3 h-3 text-amber-300" />
                        <span>နေ့စဥ်ကုန်သိမ်း</span>
                      </div>
                      <div className="px-2 py-1.5 text-slate-300 hover:text-white rounded-lg flex items-center gap-1 shrink-0">
                        <ArrowUpRight className="w-3 h-3 text-blue-400" />
                        <span>အရောင်း</span>
                      </div>
                      <div className="px-2 py-1.5 text-slate-300 hover:text-white rounded-lg flex items-center gap-1 shrink-0">
                        <Package className="w-3 h-3 text-purple-400" />
                        <span>အော်ဒါ</span>
                      </div>
                      <div className="px-2 py-1.5 text-slate-300 hover:text-white rounded-lg flex items-center gap-1 shrink-0">
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span>ကုန်ဖလှယ်</span>
                      </div>
                      <div className="px-2 py-1.5 text-slate-300 hover:text-white rounded-lg flex items-center gap-1 shrink-0">
                        <Tag className="w-3 h-3 text-amber-400" />
                        <span>ကုန်လက်ကျန်</span>
                      </div>
                      <div className="px-2 py-1.5 text-slate-300 hover:text-white rounded-lg flex items-center gap-1 shrink-0">
                        <Smartphone className="w-3 h-3 text-indigo-400" />
                        <span>အရန်သိမ်း</span>
                      </div>
                    </div>

                    {/* Visual Callout Legend */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] pt-1">
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700 flex items-start gap-1.5">
                        <span className="font-bold text-amber-400">① ပင်မခလုတ်များ:</span>
                        <span className="text-slate-300">"+ ကုန်သိမ်း" နှင့် "+ အရောင်း" တို့ကို မည်သည့်စာမျက်နှာမှမဆို တိုက်ရိုက်နှိပ်နိုင်ပါသည်။</span>
                      </div>
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700 flex items-start gap-1.5">
                        <span className="font-bold text-emerald-400">② ရက်စွဲရွေးချယ်မှု:</span>
                        <span className="text-slate-300">ရက်စွဲပြောင်းလိုက်ရုံဖြင့် ထိုရက်၏ စာရင်းဇယားနှင့် နေ့ချုပ်ကို အလိုအလျောက် ပြသပေးပါသည်။</span>
                      </div>
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700 flex items-start gap-1.5">
                        <span className="font-bold text-cyan-400">③ အောက်ခြေမီနူး:</span>
                        <span className="text-slate-300">ကုန်သိမ်း၊ အရောင်း၊ အော်ဒါ၊ ကုန်ဖလှယ်၊ လက်ကျန်၊ လယ်ဂျာစုံတို့ကို လျင်မြန်စွာ ကူးပြောင်းနိုင်ပါသည်။</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Core Workflow Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">၁။ ကုန်သိမ်းဘောင်ချာ စနစ်</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ပေးသွင်းသူထံမှ ကုန်ချောလက်ခံခြင်း၊ အကြိုငွေကျန်မှ နုတ်ယူခြင်း၊ လက်ငင်းအပိုပေးငွေနှင့် အကြိုငွေအသစ် ထုတ်ပေးခြင်းတို့ကို တွက်ချက်ပေးပါသည်။
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">၂။ ဝါး၊ ကြိမ်နှင့် ကုန်ကြမ်းကြိုထုတ်</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ယွန်းဆရာများနှင့် ဝါးနှီးလုပ်သားများထံသို့ ဝါးပိုးဝါး၊ ကြိမ်လုံး၊ ငွေကြိုယူမှုများကို သီးသန့်ဘောင်ချာဖြင့် ထုတ်ပေးပြီး အကြိုငွေထဲ အလိုအလျောက် ပေါင်းထည့်ပါသည်။
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">၃။ လက်ကားအရောင်းနှင့် ကားဂိတ်</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ကုန်သည်ဆိုင်များသို့ ကုန်ချောရောင်းချခြင်း၊ တင်ပေးလိုက်သည့် ကားဂိတ်အမည်၊ ယာဉ်မောင်းနှင့် ဖုန်းနံပါတ်တို့ကို ဘောင်ချာတွင် ထည့်သွင်းမှတ်တမ်းတင်နိုင်ပါသည်။
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 1: INBOUND PICKUP MODAL */}
            {(printAllChapters || activeChapter === 'inbound') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                      <span>အခန်း ၁။ ကုန်သိမ်းဘောင်ချာ မိုဒယ်လ် (Daily Inbound Pickup Modal)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      ကုန်ပစ္စည်းပေးသွင်းသူထံမှ ကုန်ပစ္စည်းလက်ခံခြင်း၊ အကြိုငွေနုတ်ယူခြင်းနှင့် ရှင်းတမ်းဘောင်ချာ ထုတ်ယူနည်း
                    </p>
                  </div>
                  {onOpenNewEntry && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenNewEntry();
                      }}
                      className="hidden sm:flex px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl items-center gap-1.5 cursor-pointer print:hidden"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 text-amber-300" />
                      <span>+ ကုန်သိမ်းဖွင့်မည်</span>
                    </button>
                  )}
                </div>

                {/* VISUAL SCREENSHOT: Inbound Modal */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၂] ကုန်သိမ်းဘောင်ချာ အသစ်ဖွင့်ခြင်း မိုဒယ်လ် (New Inbound Modal Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-emerald-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    {/* Modal Window Topbar */}
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-emerald-300 ml-1">
                          ကုန်သိမ်းဘောင်ချာ အသစ်ဖွင့်မည်
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded text-emerald-200 font-mono">
                        VCH-202609-0012
                      </span>
                    </div>

                    {/* Form Controls Screenshot */}
                    <div className="space-y-3 text-xs">
                      {/* Supplier Select Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1">
                            ① ကုန်ပစ္စည်းပေးသွင်းသူ (Supplier):
                          </label>
                          <div className="p-2 bg-slate-900 rounded-lg border border-emerald-500/80 text-white font-bold flex items-center justify-between">
                            <span>ဦးဘတင် (ကျောက်ပန်းတောင်းရွာ)</span>
                            <span className="text-xs text-slate-400">▼</span>
                          </div>
                        </div>
                        <div className="p-2 bg-amber-950/40 rounded-lg border border-amber-600/40 flex flex-col justify-center">
                          <span className="text-[10px] text-amber-300 font-bold">② ယခင် အကြိုငွေကျန် (Previous Advance):</span>
                          <span className="text-base font-extrabold text-amber-400">၇၅,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      {/* Items Table Mockup */}
                      <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-700 space-y-2">
                        <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between border-b border-slate-700 pb-1.5">
                          <span>③ ကုန်ပစ္စည်းများနှင့် အရေအတွက် ထည့်သွင်းဇယား</span>
                          <span className="text-[10px] text-emerald-400">+ ကုန်ပစ္စည်းထပ်ထည့်မည်</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-12 gap-1.5 p-2 bg-slate-900 rounded-lg text-[11px] items-center">
                            <span className="col-span-5 font-bold text-white">ယွန်း ကွမ်းအစ် (အကြီး)</span>
                            <span className="col-span-2 text-slate-300 font-mono text-center">၁၀ ထည်</span>
                            <span className="col-span-2 text-slate-400 font-mono text-right">@၄,၅၀၀</span>
                            <span className="col-span-3 font-bold text-emerald-400 text-right">၄၅,၀၀၀ ကျပ်</span>
                          </div>
                          <div className="grid grid-cols-12 gap-1.5 p-2 bg-slate-900 rounded-lg text-[11px] items-center">
                            <span className="col-span-5 font-bold text-white">ဝါးနှီး ယွန်းခွက် (အသေး)</span>
                            <span className="col-span-2 text-slate-300 font-mono text-center">၁၂ ထည်</span>
                            <span className="col-span-2 text-slate-400 font-mono text-right">@၂,၈၀၀</span>
                            <span className="col-span-3 font-bold text-emerald-400 text-right">၃၃,၆၀၀ ကျပ်</span>
                          </div>
                        </div>
                      </div>

                      {/* Settlement Calculations Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-slate-400 block mb-0.5">ပေးသွင်းကုန်တန်ဖိုး</span>
                          <span className="font-extrabold text-emerald-400 text-sm">၇၈,၆၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-rose-300 block mb-0.5">④ အကြိုငွေမှ နုတ်ယူငွေ</span>
                          <span className="font-extrabold text-rose-400 text-sm">- ၃၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-amber-300 block mb-0.5">⑤ အပိုပေးငွေ (လက်ငင်း)</span>
                          <span className="font-extrabold text-amber-400 text-sm">၄၈,၆၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-cyan-300 block mb-0.5">⑥ လက်ကျန် အကြိုငွေ</span>
                          <span className="font-extrabold text-cyan-400 text-sm">၄၅,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      {/* Action Buttons Mockup */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Camera className="w-3.5 h-3.5 text-slate-400" />
                          <span>ဓာတ်ပုံမှတ်တမ်းတွဲတင်နိုင်သည်</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 bg-slate-800 rounded-xl text-slate-300 font-bold">ပယ်ဖျက်မည်</div>
                          <div className="px-4 py-1.5 bg-emerald-600 rounded-xl text-white font-extrabold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>ဘောင်ချာ ထုတ်ယူသိမ်းဆည်းမည်</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Guide */}
                <div className="space-y-3 text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>အသုံးပြုရန် အဆင့်ဆင့် ညွှန်ကြားချက်:</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700">
                    <li>
                      <strong>ပေးသွင်းသူ ရွေးချယ်ခြင်း:</strong> မျက်နှာပြင်ထိပ်ရှိ <strong>"+ ကုန်သိမ်း"</strong> ခလုတ်ကို နှိပ်ပြီး ပေးသွင်းသူအမည်ကို ရွေးပါ။ ထိုသူ၏ ယခင်အကြိုငွေကျန်ကို အလိုအလျောက် ပြသပေးပါမည်။
                    </li>
                    <li>
                      <strong>ကုန်ပစ္စည်းများနှင့် အရေအတွက် ထည့်သွင်းခြင်း:</strong> ကုန်ပစ္စည်းအမည်၊ ရေတွက်ပုံယူနစ်၊ ဝယ်ယူစျေးနှုန်းနှင့် အရေအတွက်ကို ဖြည့်ပါ။ စုစုပေါင်း ပေးသွင်းတန်ဖိုးကို တွက်ချက်ပေးပါမည်။
                    </li>
                    <li>
                      <strong>အကြိုငွေမှ နုတ်ယူခြင်း (Advance Deducted):</strong> ယခုတစ်ကြိမ် ကုန်ဖိုးမှ နုတ်ယူမည့် အကြိုငွေပမာဏကို ထည့်ပါ။ ကျန်ငွေကို လက်ငင်း ပေးချေငွေအဖြစ် အလိုအလျောက် သတ်မှတ်ပေးပါမည်။
                    </li>
                    <li>
                      <strong>အကြိုငွေအသစ် ထုတ်ယူခြင်း (ရှိပါက):</strong> နောက်တစ်ကြိမ် ကုန်ပစ္စည်းပေးသွင်းရန် ပေးသွင်းသူမှ အကြိုငွေ ထပ်မံတောင်းခံပါက <strong>"အကြိုငွေအသစ်"</strong> အကွက်တွင် ဖြည့်စွက်ပြီး အကြောင်းပြချက် မှတ်တမ်းတင်နိုင်ပါသည်။
                    </li>
                    <li>
                      <strong>ဘောင်ချာ သိမ်းဆည်းခြင်းနှင့် Print ထုတ်ခြင်း:</strong> <strong>"ဘောင်ချာ ထုတ်ယူသိမ်းဆည်းမည်"</strong> နှိပ်ပါက စာရင်းများ အလိုအလျောက် Update ဖြစ်သွားပြီး ပရင့်ထုတ်နိုင်သော ဘောင်ချာ ချက်ချင်း ပွင့်လာပါမည်။
                    </li>
                  </ol>
                </div>
              </section>
            )}

            {/* CHAPTER 2: RAW MATERIALS & CASH ADVANCE MODAL */}
            {(printAllChapters || activeChapter === 'raw_materials') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-600" />
                    <span>အခန်း ၂။ ဝါး၊ ကြိမ်နှင့် ကုန်ကြမ်းကြိုထုတ် / ငွေကြိုယူ မိုဒယ်လ် (Raw Material & Cash Advance)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ကုန်ပစ္စည်းပေးသွင်းသူများထံသို့ ဝါး၊ ကြိမ်၊ အခြားကုန်ကြမ်းများ ကြိုတင်ထုတ်ပေးခြင်း သို့မဟုတ် ငွေကြိုထုတ်ပေးခြင်းတို့ကို ဘောင်ချာဖွင့်၍ အကြိုငွေစာရင်းထဲ တိုးမြှင့်မှတ်တမ်းတင်နည်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Raw Material Modal */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-amber-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၃] ကုန်ကြမ်းကြိုထုတ်ပေးခြင်း မိုဒယ်လ် (Raw Material Credit Modal Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-amber-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-amber-300 ml-1">
                          ဝါး၊ ကြိမ်ကုန်ကြမ်းနှင့် ငွေကြိုယူ ထုတ်ပေးမည်
                        </span>
                      </div>
                      <span className="text-[10px] bg-amber-800 px-2 py-0.5 rounded text-amber-200 font-mono">
                        RAW-202609-0004
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1">
                            ① ကုန်ပစ္စည်းပေးသွင်းသူ ရွေးချယ်မှု:
                          </label>
                          <div className="p-2 bg-slate-900 rounded-lg border border-amber-500/80 text-white font-bold flex items-center justify-between">
                            <span>ကိုအောင်မြင့် (ကျောက်ကာရွာ)</span>
                            <span className="text-xs text-slate-400">▼</span>
                          </div>
                        </div>
                        <div className="p-2 bg-amber-950/40 rounded-lg border border-amber-600/40 flex flex-col justify-center">
                          <span className="text-[10px] text-amber-300 font-bold">လက်ရှိ အကြိုငွေကျန်:</span>
                          <span className="text-base font-extrabold text-amber-400">၄၀,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">
                            ② အမျိုးအစား ရွေးချယ်မှု (Category)
                          </label>
                          <div className="p-2 bg-slate-900 rounded-lg border border-amber-500 text-amber-300 font-bold flex justify-between">
                            <span>ဝါးကုန်ကြမ်း (BAMBOO)</span>
                            <span className="text-slate-400">▼</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block pt-0.5">ရွေးနိုင်သည်များ: ဝါး၊ ကြိမ်၊ ငွေကြိုယူ၊ အခြား</span>
                        </div>

                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1">
                          <label className="text-[10px] text-slate-300 font-bold block">
                            ③ အမြန်ရွေး ကုန်ကြမ်းအမည် (Quick Preset)
                          </label>
                          <div className="p-2 bg-slate-900 rounded-lg border border-slate-600 text-white font-bold flex justify-between">
                            <span>ဝါးပိုးဝါး (အလုံးကြီး - ၃ ပေ)</span>
                            <span className="text-slate-400">▼</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block pt-0.5">တင်းဝါး၊ ကြိမ်နီ၊ ကြိမ်ခါး ကြိုတင်သတ်မှတ်ထားနိုင်</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-800/90 p-3 rounded-xl border border-slate-700 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block">④ အရေအတွက်</span>
                          <span className="font-mono font-bold text-white text-sm">၅၀ လုံး</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">⑤ တစ်လုံးစျေးနှုန်း</span>
                          <span className="font-mono font-bold text-white text-sm">၁,၂၀၀ ကျပ်</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-300 block">⑥ စုစုပေါင်း တန်ဖိုး</span>
                          <span className="font-mono font-extrabold text-amber-400 text-sm">၆၀,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-600/40 flex items-center justify-between text-xs">
                        <span className="text-emerald-300 font-bold">အကြိုငွေစာရင်းထဲ ပေါင်းထည့်ပြီးနောက် စုစုပေါင်း အကြိုငွေကျန်:</span>
                        <span className="text-base font-extrabold text-emerald-400">၁၀၀,၀၀၀ ကျပ်</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-sm text-slate-900">လုပ်ငန်းသုံး အကြံပြုချက်:</h4>
                  <p>
                    ကုန်ကြမ်းထုတ်ပေးရာတွင် ပေးသွင်းသူထံသို့ ငွေသားပေးခြင်းမဟုတ်ဘဲ ဝါး သို့မဟုတ် ကြိမ် ထုတ်ပေးခြင်းဖြစ်သော်လည်း ထိုတန်ဖိုးကို ပေးသွင်းသူ၏ အကြိုငွေ (Advance Ledger) ထဲသို့ အလိုအလျောက် ပေါင်းထည့်ပေးပါသည်။ နောင်တစ်ချိန် ကုန်ချောပြန်လည်သွင်းယူသည့်အခါ ထိုအကြိုငွေထဲမှ ပြန်လည်နုတ်ယူရှင်းလင်းနိုင်ပါသည်။
                  </p>
                </div>
              </section>
            )}

            {/* CHAPTER 3: SALES MODAL */}
            {(printAllChapters || activeChapter === 'sales') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <ArrowUpRight className="w-5 h-5 text-blue-600" />
                      <span>အခန်း ၃။ လက်ကားနှင့် လက်လီ အရောင်းဘောင်ချာ မိုဒယ်လ် (Sales & Delivery Modal)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      ကုန်သည်ဆိုင်များသို့ လက်ကားရောင်းချခြင်း၊ ကားဂိတ်/ယာဉ်မောင်း မှတ်တမ်းနှင့် အကြွေးကျန်စာရင်း ထိန်းသိမ်းနည်း
                    </p>
                  </div>
                  {onOpenNewSale && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenNewSale();
                      }}
                      className="hidden sm:flex px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl items-center gap-1.5 cursor-pointer print:hidden"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-blue-200" />
                      <span>+ အရောင်းဖွင့်မည်</span>
                    </button>
                  )}
                </div>

                {/* VISUAL SCREENSHOT: Sale Modal */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၄] အရောင်းဘောင်ချာ ဖွင့်ခြင်း မိုဒယ်လ် (New Sales Modal Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-blue-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-blue-300 ml-1">
                          အရောင်းဘောင်ချာ အသစ်ဖွင့်မည်
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded text-white font-bold">
                          လက်ကားအရောင်း (Wholesale)
                        </span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                          INV-202609-0045
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      {/* Customer Picker */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1">
                            ① ကုန်သည်ဆိုင် / ဝယ်သူ ရွေးချယ်မှု:
                          </label>
                          <div className="p-2 bg-slate-900 rounded-lg border border-blue-500 text-white font-bold flex items-center justify-between">
                            <span>မန္တလေး ယွန်းတိုက် (ဒေါ်ခင်သန်း)</span>
                            <span className="text-xs text-slate-400">▼</span>
                          </div>
                        </div>
                        <div className="p-2 bg-blue-950/40 rounded-lg border border-blue-600/40 flex flex-col justify-center">
                          <span className="text-[10px] text-blue-300 font-bold">② ယခင် အရောင်းအကြွေးကျန်ငွေ:</span>
                          <span className="text-base font-extrabold text-blue-400">၁၅၀,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      {/* Items Mockup */}
                      <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-700 space-y-2">
                        <div className="text-[11px] font-bold text-slate-300 border-b border-slate-700 pb-1.5 flex justify-between">
                          <span>③ ရောင်းချမည့် ပစ္စည်းများနှင့် စျေးနှုန်း</span>
                          <span className="text-[10px] text-blue-400">+ ပစ္စည်းထည့်မည်</span>
                        </div>
                        <div className="grid grid-cols-12 gap-1.5 p-2 bg-slate-900 rounded-lg text-[11px] items-center">
                          <span className="col-span-5 font-bold text-white">ယွန်း ကွမ်းအစ် (အကြီး)</span>
                          <span className="col-span-2 text-slate-300 text-center font-mono">၂၀ ထည်</span>
                          <span className="col-span-2 text-slate-400 text-right font-mono">@၇,၅၀၀</span>
                          <span className="col-span-3 font-bold text-blue-400 text-right">၁၅၀,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      {/* Delivery & Gate Details */}
                      <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-2">
                        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" />
                          <span>④ ကားဂိတ်နှင့် ပို့ဆောင်ရေး အချက်အလက် (ဘောင်ချာတွင် အလိုအလျောက်ပါဝင်မည်)</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className="p-1.5 bg-slate-900 rounded border border-slate-700">
                            <span className="text-[9px] text-slate-400 block">ကားဂိတ်အမည်</span>
                            <span className="font-bold text-white">ရွှေမန္တလာ ကားဂိတ်</span>
                          </div>
                          <div className="p-1.5 bg-slate-900 rounded border border-slate-700">
                            <span className="text-[9px] text-slate-400 block">ယာဉ်မောင်း/ကားနံပါတ်</span>
                            <span className="font-bold text-white">ကိုစိုးနိုင် (6K-8821)</span>
                          </div>
                          <div className="p-1.5 bg-slate-900 rounded border border-slate-700">
                            <span className="text-[9px] text-slate-400 block">ဂိတ်ဖုန်းနံပါတ်</span>
                            <span className="font-bold text-white">09-250123456</span>
                          </div>
                          <div className="p-1.5 bg-slate-900 rounded border border-slate-700">
                            <span className="text-[9px] text-slate-400 block">ကားတင်ခ (ကျပ်)</span>
                            <span className="font-bold text-white">၅,၀၀၀ ကျပ်</span>
                          </div>
                        </div>
                      </div>

                      {/* Payment Calculations */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">⑤ ယခုအရောင်းတန်ဖိုး</span>
                          <span className="font-extrabold text-blue-400 text-sm">၁၅၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-emerald-300 block">⑥ ယခုပေးချေငွေ (Cash)</span>
                          <span className="font-extrabold text-emerald-400 text-sm">၁၀၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-rose-300 block">⑦ စုစုပေါင်း ကျန်ငွေ</span>
                          <span className="font-extrabold text-rose-400 text-sm">၂၀၀,၀၀၀ ကျပ်</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-sm text-slate-900">အဓိက အချက်များ:</h4>
                  <ul className="list-disc list-inside space-y-1.5">
                    <li>ကုန်သည်မှ ပေးချေငွေအပြည့်မပေးပါက ကျန်ငွေကို ကုန်သည်၏ အကြွေးစာရင်းထဲ အလိုအလျောက် ပေါင်းထည့်ပေးပါသည်။</li>
                    <li>ကားဂိတ်ပို့ဆောင်ရေး အချက်အလက်များ ထည့်သွင်းထားပါက ပရင့်ထုတ်သည့် ဘောင်ချာတွင် ယာဉ်မောင်းအမည်နှင့် ဂိတ်ဖုန်းနံပါတ် တိကျစွာ ပါဝင်လာပါမည်။</li>
                  </ul>
                </div>
              </section>
            )}

            {/* CHAPTER 4: VOUCHER & THERMAL PRINTING */}
            {(printAllChapters || activeChapter === 'vouchers_print') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-indigo-600" />
                    <span>အခန်း ၄။ ဘောင်ချာနှင့် Thermal Receipt ပရင့်စနစ် (Voucher & Thermal Slip)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    A4, A5 ရုံးသုံးစာရွက်နှင့် 80mm / 58mm Bluetooth/USB အပူပေးစလစ် ပရင့်ထုတ်ယူနည်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Printable Voucher & Slip */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၅] ပရင့်ထုတ်ယူမည့် ဘောင်ချာနှင့် ဖြတ်ပိုင်းစလစ် မိုဒယ်လ် (Voucher Print Layout)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* A4 / A5 Voucher Mockup */}
                    <div className="rounded-2xl border-2 border-indigo-400 bg-white p-4 text-slate-900 shadow-xl space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase">A4 / A5 စာရွက် ဘောင်ချာ ပုံစံ</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">A5 Half-Sheet</span>
                      </div>

                      <div className="text-center space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-900">ရွှေလက်ရာ - မြန်မာ့လက်မှု ကုန်ချောရောင်းဝယ်ရေး</h4>
                        <p className="text-[10px] text-slate-500">ကျောက်ပန်းတောင်းလမ်း၊ ညောင်ဦးမြို့ | ဖုန်း: 09-123456789</p>
                        <div className="inline-block bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-800">
                          ကုန်သိမ်း/အရောင်း ရှင်းတမ်းဘောင်ချာ
                        </div>
                      </div>

                      <div className="flex justify-between text-[10px] border-y py-1 font-semibold">
                        <span>ဘောင်ချာအမှတ်: VCH-202609-0012</span>
                        <span>ရက်စွဲ: {new Date().toLocaleDateString('my-MM')}</span>
                      </div>

                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b">
                            <th className="p-1 text-left">စဥ်</th>
                            <th className="p-1 text-left">အမျိုးအမည်</th>
                            <th className="p-1 text-center">ခုရေ</th>
                            <th className="p-1 text-right">နှုန်း</th>
                            <th className="p-1 text-right">သင့်ငွေ</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-1">၁</td>
                            <td className="p-1 font-bold">ယွန်း ကွမ်းအစ် (အကြီး)</td>
                            <td className="p-1 text-center">၁၀</td>
                            <td className="p-1 text-right">၄,၅၀၀</td>
                            <td className="p-1 text-right font-bold">၄၅,၀၀၀</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-1">၂</td>
                            <td className="p-1 font-bold">ဝါးနှီး ယွန်းခွက်</td>
                            <td className="p-1 text-center">၁၂</td>
                            <td className="p-1 text-right">၂,၈၀၀</td>
                            <td className="p-1 text-right font-bold">၃၃,၆၀၀</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="space-y-1 text-[10px] pt-1 border-t">
                        <div className="flex justify-between">
                          <span>ပေးသွင်းကုန်တန်ဖိုး:</span>
                          <span className="font-bold">၇၈,၆၀၀ ကျပ်</span>
                        </div>
                        <div className="flex justify-between text-rose-600">
                          <span>အကြိုငွေမှ နုတ်ယူငွေ:</span>
                          <span className="font-bold">- ၃၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-extrabold text-xs pt-1 border-t">
                          <span>လက်ငင်း ပေးချေငွေ:</span>
                          <span>၄၈,၆၀၀ ကျပ်</span>
                        </div>
                      </div>

                      <div className="flex justify-between pt-4 text-[9px] text-slate-500">
                        <div>လက်ခံသူလက်မှတ်: ......................</div>
                        <div>စာရင်းကိုင်လက်မှတ်: ......................</div>
                      </div>
                    </div>

                    {/* 80mm / 58mm Thermal Slip Mockup */}
                    <div className="rounded-2xl border-2 border-slate-700 bg-slate-900 p-4 text-white shadow-xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                        <span className="text-[10px] font-bold text-amber-300 uppercase">80mm / 58mm Thermal Slip (အပူပေးစလစ်)</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">ESC/POS</span>
                      </div>

                      <div className="bg-white text-slate-900 p-3 rounded-lg font-mono text-[10px] space-y-1.5 shadow-md max-w-xs mx-auto">
                        <div className="text-center font-bold">
                          <div>*** ရွှေလက်ရာ ***</div>
                          <div className="text-[9px]">TEL: 09-123456789</div>
                          <div className="text-[8px] text-slate-500">--------------------------------</div>
                        </div>
                        <div className="flex justify-between text-[9px]">
                          <span>VCH: #0012</span>
                          <span>{new Date().toLocaleDateString('my-MM')}</span>
                        </div>
                        <div className="text-[8px] text-slate-500">--------------------------------</div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>ကွမ်းအစ် (ကြီး) x10</span>
                            <span className="font-bold">45,000</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ယွန်းခွက် x12</span>
                            <span className="font-bold">33,600</span>
                          </div>
                        </div>
                        <div className="text-[8px] text-slate-500">--------------------------------</div>
                        <div className="flex justify-between font-bold">
                          <span>TOTAL:</span>
                          <span>78,600 Ks</span>
                        </div>
                        <div className="flex justify-between text-rose-600">
                          <span>ADV DEDUCT:</span>
                          <span>-30,000 Ks</span>
                        </div>
                        <div className="flex justify-between font-extrabold text-[11px] pt-1 border-t border-slate-300">
                          <span>PAID CASH:</span>
                          <span>48,600 Ks</span>
                        </div>
                        <div className="text-center text-[8px] text-slate-500 pt-2">
                          ကျေးဇူးတင်ပါသည်
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-300 space-y-1">
                        <p className="text-amber-300 font-bold">💡 Bluetooth Thermal Printer ဖြင့် ထုတ်နည်း:</p>
                        <p className="text-[10px] text-slate-400">ဘောင်ချာဝင်းဒိုးရှိ "Thermal Receipt" ခလုတ်ကို နှိပ်ပြီး ချိတ်ဆက်ထားသော 80mm သို့မဟုတ် 58mm ပရင်တာသို့ တိုက်ရိုက် Print ထုတ်နိုင်ပါသည်။</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 5: ORDERS & ADVANCE DEPOSIT */}
            {(printAllChapters || activeChapter === 'orders') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    <span>အခန်း ၅။ ကုန်သည် ကြိုတင်အော်ဒါနှင့် စရန်ငွေ မိုဒယ်လ် (Merchant Orders & Deposit)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ကြိုတင်မှာယူမှုများ လက်ခံခြင်း၊ စရန်ငွေမှတ်တမ်းတင်ခြင်းနှင့် ပစ္စည်းအသင့်ဖြစ်ပါက အရောင်းဘောင်ချာသို့ တိုက်ရိုက်ပြောင်းလဲနည်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Order Management */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-purple-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၆] ကုန်သည် အော်ဒါမှတ်တမ်း မိုဒယ်လ် (Merchant Order Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-purple-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-purple-300 ml-1">
                          ကုန်သည် ကြိုတင်အော်ဒါ မှတ်တမ်းတင်မည်
                        </span>
                      </div>
                      <span className="text-[10px] bg-purple-800 px-2 py-0.5 rounded text-purple-200 font-mono">
                        ORD-202609-0008
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">ကုန်သည်အမည်</span>
                          <span className="font-bold text-white">မန္တလေး ယွန်းတိုက်</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">ပစ္စည်းပေးပို့ရမည့်ရက်</span>
                          <span className="font-bold text-amber-300">၂၅-၀၉-၂၀၂၆</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">အခြေအနေ (Status)</span>
                          <span className="inline-block bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
                            ● ထုတ်လုပ်ဆဲ (In Progress)
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-2">
                        <div className="text-[11px] font-bold text-slate-300">မှာယူထားသော ကုန်ပစ္စည်းစာရင်း</div>
                        <div className="p-2 bg-slate-900 rounded-lg flex justify-between items-center text-[11px]">
                          <span className="font-bold text-white">ယွန်း ကွမ်းအစ် (အကြီး) x ၅၀ ထည်</span>
                          <span className="font-bold text-purple-400">၂၂၅,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">စုစုပေါင်း အော်ဒါတန်ဖိုး</span>
                          <span className="font-extrabold text-white text-sm">၂၂၅,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-emerald-300 block">ရရှိထားသော စရန်ငွေ</span>
                          <span className="font-extrabold text-emerald-400 text-sm">၇၅,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-amber-300 block">ကျန်ရှိငွေ</span>
                          <span className="font-extrabold text-amber-400 text-sm">၁၅၀,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-purple-950/40 rounded-xl border border-purple-600/40 flex items-center justify-between">
                        <span className="text-[11px] text-purple-300 font-bold">ပစ္စည်းများ အဆင်သင့်ဖြစ်ပါက:</span>
                        <div className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-extrabold text-xs flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>အရောင်းဘောင်ချာသို့ တိုက်ရိုက်ပြောင်းမည်</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 6: PEER TRADING */}
            {(printAllChapters || activeChapter === 'peer_trading') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-600" />
                    <span>အခန်း ၆။ ဆိုင်ချင်း ကုန်ဖလှယ်မှု/အငှား မိုဒယ်လ် (Peer Consignment & Trading)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    မိတ်ဆွေယွန်းဆိုင်များထံမှ ကုန်ငှားယူခြင်း (Inbound) နှင့် မိမိဆိုင်မှ ကုန်ငှားထုတ်ပေးခြင်း (Outbound) ရှင်းတမ်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Peer Trading */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-cyan-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၇] ဆိုင်ချင်း ကုန်ဖလှယ်မှု စာရင်း မိုဒယ်လ် (Peer Trading Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-cyan-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-cyan-300 ml-1">
                          မိတ်ဆွေဆိုင် ကုန်ဖလှယ်မှု / အငှားစာရင်း
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-[10px] bg-emerald-700 px-2 py-0.5 rounded text-white font-bold">
                          + ကုန်ငှားယူမည်
                        </span>
                        <span className="text-[10px] bg-cyan-700 px-2 py-0.5 rounded text-white font-bold">
                          + ကုန်ငှားပေးမည်
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-white text-sm">ရွှေမင်းသား ယွန်းထည်ဆိုင်</div>
                          <div className="text-[10px] text-slate-400">ညောင်ဦးမြို့မစျေး | ဖုန်း: 09-450987654</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-cyan-300 font-bold block">စာရင်းလက်ကျန် အခြေအနေ:</span>
                          <span className="font-extrabold text-white text-sm">ပစ္စည်း ၅ ထည် (အငှားထုတ်ထားဆဲ)</span>
                        </div>
                      </div>

                      <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-700 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-300">မှတ်တမ်းတင်ထားသော ကုန်ဖလှယ်မှုများ</div>
                        <div className="p-2 bg-slate-900 rounded-lg flex justify-between items-center text-[11px]">
                          <div>
                            <span className="font-bold text-white">ယွန်း ကွမ်းအစ် (အကြီး) x ၅ ထည်</span>
                            <span className="text-[10px] text-slate-400 block">အငှားထုတ်ရက်: ၁၀-၀၉-၂၀၂၆</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-600/50 px-2 py-0.5 rounded">
                              မရှင်းရသေး
                            </span>
                            <span className="text-[10px] bg-cyan-600 px-2 py-1 rounded text-white font-bold">
                              ပြန်လည်လက်ခံ/ငွေရှင်းမည်
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 7: INVENTORY & LOW STOCK ALERTS */}
            {(printAllChapters || activeChapter === 'inventory_alerts') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>အခန်း ၇။ ကုန်လက်ကျန်နှင့် အနိမ့်ဆုံးသတိပေးချက် မိုဒယ်လ် (Inventory & Low Stock Alert)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ကုန်ပစ္စည်းလက်ကျန် အဝင်/အထွက် စောင့်ကြည့်ခြင်းနှင့် အနိမ့်ဆုံးရှိရမည့် လက်ကျန် (Min Stock Alert) အချက်ပေးစနစ်
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Inventory & Min Stock */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-rose-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၈] အနိမ့်ဆုံးလက်ကျန် သတိပေးချက် မိုဒယ်လ် (Low Stock Alert Modal Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-rose-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-rose-300 ml-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>ကုန်လက်ကျန် နည်းပါးနေသော ပစ္စည်းများ သတိပေးချက် (Low Stock Alert)</span>
                        </span>
                      </div>
                      <span className="text-[10px] bg-rose-900 text-rose-200 px-2 py-0.5 rounded-full font-bold">
                        ၂ မျိုး သတိပေးထားသည်
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Low Stock Item 1 */}
                      <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-600/40 flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-white text-sm">ယွန်း ကွမ်းအစ် (အကြီး)</div>
                          <div className="text-[10px] text-rose-300">
                            လက်ရှိကျန်: <strong className="text-white text-xs">၃ ထည်</strong> (အနည်းဆုံးထားရှိရန်: ၁၀ ထည်)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-0.5 rounded">
                            ၇ ထည် လိုအပ်
                          </span>
                          <div className="px-2.5 py-1 bg-emerald-600 rounded-lg text-white font-bold text-[10px]">
                            + ကုန်သိမ်းမည်
                          </div>
                        </div>
                      </div>

                      {/* Low Stock Item 2 */}
                      <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-600/40 flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-white text-sm">ဝါးနှီး ယွန်းခွက် (အသေး)</div>
                          <div className="text-[10px] text-amber-300">
                            လက်ရှိကျန်: <strong className="text-white text-xs">၅ ထည်</strong> (အနည်းဆုံးထားရှိရန်: ၁၅ ထည်)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-amber-600 text-slate-950 font-black px-2 py-0.5 rounded">
                            ၁၀ ထည် လိုအပ်
                          </span>
                          <div className="px-2.5 py-1 bg-emerald-600 rounded-lg text-white font-bold text-[10px]">
                            + ကုန်သိမ်းမည်
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 8: SUPPLIER & MERCHANT LEDGERS */}
            {(printAllChapters || activeChapter === 'ledgers') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-teal-600" />
                    <span>အခန်း ၈။ ပေးသွင်းသူနှင့် ကုန်သည် လယ်ဂျာ မိုဒယ်လ် (Ledger Statement Modals)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ပေးသွင်းသူ၏ အကြိုငွေစာရင်း အဝင်/အထွက် ရှင်းတမ်းနှင့် ကုန်သည်၏ အရောင်းအကြွေးစာရင်း လယ်ဂျာ ကြည့်ရှုနည်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Supplier Ledger */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-teal-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၉] ပေးသွင်းသူ အကြိုငွေ လယ်ဂျာရှင်းတမ်း (Supplier Ledger Modal Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-teal-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-teal-300 ml-1">
                          ပေးသွင်းသူ အကြိုငွေ လယ်ဂျာစာရင်း
                        </span>
                      </div>
                      <span className="text-[10px] bg-teal-800 text-teal-200 px-2 py-0.5 rounded font-bold">
                        ဦးဘတင် (ကျောက်ပန်းတောင်း)
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Summary Badges */}
                      <div className="grid grid-cols-3 gap-2 text-center bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                        <div>
                          <span className="text-[10px] text-slate-400 block">စုစုပေါင်း ကုန်သွင်းတန်ဖိုး</span>
                          <span className="font-extrabold text-emerald-400 text-sm">၃၅၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">စုစုပေါင်း အကြိုငွေထုတ်ယူမှု</span>
                          <span className="font-extrabold text-amber-400 text-sm">၁၈၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-cyan-300 block">လက်ရှိ အကြိုငွေကျန်</span>
                          <span className="font-extrabold text-cyan-400 text-sm">၄၅,၀၀၀ ကျပ်</span>
                        </div>
                      </div>

                      {/* Ledger History Rows */}
                      <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-700 space-y-1.5">
                        <div className="grid grid-cols-12 text-[10px] text-slate-400 border-b border-slate-700 pb-1">
                          <span className="col-span-3">ရက်စွဲ/ဘောင်ချာ</span>
                          <span className="col-span-4">အကြောင်းအရာ</span>
                          <span className="col-span-2 text-right">အဝင်/နုတ်</span>
                          <span className="col-span-3 text-right">အကြိုငွေကျန်</span>
                        </div>
                        <div className="grid grid-cols-12 text-[11px] p-1.5 bg-slate-900 rounded items-center">
                          <span className="col-span-3 font-mono text-slate-300">၁၄-၀၉-၂၀၂၆ (VCH-0012)</span>
                          <span className="col-span-4 font-bold text-white">ကုန်သိမ်း (နုတ်ယူငွေ)</span>
                          <span className="col-span-2 text-right font-bold text-rose-400">- ၃၀,၀၀၀</span>
                          <span className="col-span-3 text-right font-extrabold text-cyan-300">၄၅,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="grid grid-cols-12 text-[11px] p-1.5 bg-slate-900 rounded items-center">
                          <span className="col-span-3 font-mono text-slate-300">၁၀-၀၉-၂၀၂၆ (RAW-0004)</span>
                          <span className="col-span-4 font-bold text-amber-300">ဝါးပိုးဝါး ကြိုထုတ်</span>
                          <span className="col-span-2 text-right font-bold text-amber-400">+ ၆၀,၀၀၀</span>
                          <span className="col-span-3 text-right font-extrabold text-cyan-300">၇၅,၀၀၀ ကျပ်</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 9: CASH LEDGER & DAILY CLOSING */}
            {(printAllChapters || activeChapter === 'cash_closing') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <span>အခန်း ၉။ ငွေသားစာရင်းနှင့် နေ့ချုပ်စစ်ဆေးမှု (Cash Ledger & Daily Closing)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    နေ့စဉ် ငွေသားအဝင်/အထွက် လက်ကျန်စာရင်းနှင့် နေ့ချုပ်စာရင်းကိုက်ညီမှု စစ်ဆေးနည်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Cash Ledger */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၁၀] ငွေသားစာရင်း လယ်ဂျာ မိုဒယ်လ် (Cash Ledger Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-emerald-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-emerald-300 ml-1">
                          ယနေ့ ငွေသားအဝင်/အထွက် စာရင်း (Cash Ledger)
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded font-bold">
                        {new Date().toLocaleDateString('my-MM')}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">စတင်ငွေသားလက်ကျန်</span>
                          <span className="font-extrabold text-white text-sm">၅၀၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-emerald-300 block">ယနေ့ ငွေသားအဝင်</span>
                          <span className="font-extrabold text-emerald-400 text-sm">+ ၁၅၀,၀၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-rose-300 block">ယနေ့ ငွေသားအထွက်</span>
                          <span className="font-extrabold text-rose-400 text-sm">- ၄၈,၆၀၀ ကျပ်</span>
                        </div>
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                          <span className="text-[10px] text-amber-300 block">လက်ရှိ ငွေသားလက်ကျန်</span>
                          <span className="font-extrabold text-amber-400 text-sm">၆၀၁,၄၀၀ ကျပ်</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 10: BACKUP, RESTORE & ZAPYA */}
            {(printAllChapters || activeChapter === 'backup_zapya') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                    <span>အခန်း ၁၀။ Shwe let yar doc. ဒေတာအရန်သိမ်းနှင့် Zapya ကူးပြောင်းခြင်း (Backup & Zapya Transfer)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ဖိုင်ဒေါင်းလုဒ်ရယူခြင်း၊ အလိုအလျောက် snapshot ပြန်လည်ရယူခြင်းနှင့် ဖုန်းတစ်လုံးမှတစ်လုံးသို့ QR Code ဖြင့် ကူးပြောင်းနည်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: Backup & Zapya */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၁၁] ဒေတာအရန်သိမ်းခြင်းနှင့် Zapya Transfer မိုဒယ်လ် (Backup & QR Transfer)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Backup Download Card */}
                    <div className="rounded-2xl border-2 border-indigo-500 bg-slate-900 p-4 text-white shadow-xl space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                        <Download className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-xs text-indigo-300">ဖိုင်အဖြစ် အရန်သိမ်းဆည်းခြင်း (Download Backup)</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong>"Shwe let yar doc."</strong> ဖိုဒါထဲသို့ စာရင်းအချက်အလက်အားလုံးကို <code>.json</code> ဖိုင်အဖြစ် လုံခြုံစွာ ဒေါင်းလုဒ်သိမ်းဆည်းနိုင်ပါသည်။
                      </p>
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
                        <div>
                          <div className="font-mono text-xs text-white">shwe_let_yar_backup_2026.json</div>
                          <div className="text-[10px] text-slate-400">အရွယ်အစား: 245 KB (စာရင်းအပြည့်အစုံ)</div>
                        </div>
                        <div className="px-3 py-1.5 bg-indigo-600 rounded-lg text-white font-bold text-xs flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" />
                          <span>ဒေါင်းလုဒ်ရယူမည်</span>
                        </div>
                      </div>
                    </div>

                    {/* Zapya / QR Code Chunk Transfer */}
                    <div className="rounded-2xl border-2 border-cyan-500 bg-slate-900 p-4 text-white shadow-xl space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                        <QrCode className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-xs text-cyan-300">Zapya / QR Code ဖြင့် ဖုန်းချင်းကူးပြောင်းခြင်း</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        အင်တာနက်လုံးဝမလိုဘဲ ဖုန်းတစ်လုံးမှ QR Code ပြသပြီး အခြားဖုန်းဖြင့် စကန်ဖတ်ရုံဖြင့် စာရင်းဒေတာများ ချက်ချင်း ကူးပြောင်းနိုင်ပါသည်။
                      </p>
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-white rounded p-1 flex items-center justify-center">
                            <QrCode className="w-8 h-8 text-slate-950" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">QR Code Chunk Sync</div>
                            <div className="text-[10px] text-cyan-300">Chunk 1 of 3 (Ready)</div>
                          </div>
                        </div>
                        <div className="px-3 py-1.5 bg-cyan-600 rounded-lg text-white font-bold text-xs">
                          စကန်ဖတ်မည်
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 11: SECURITY, RBAC & APP LOCK */}
            {(printAllChapters || activeChapter === 'security_lock') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-rose-600" />
                    <span>အခန်း ၁၁။ App Lock နှင့် လုံခြုံရေးစကားဝှက် (App Lock & User Security)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ပင်နံပါတ်စကားဝှက် သတ်မှတ်ခြင်း၊ အသုံးပြုသူရာထူးခွဲခြားခြင်းနှင့် Password မေ့သွားပါက Recovery Key ဖြင့် ပြန်လည်ရယူနည်း
                  </p>
                </div>

                {/* VISUAL SCREENSHOT: App Lock Screen */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-rose-600" />
                    <span>[မျက်နှာပြင်ပုံစံ ၁၂] App Lock Screen နှင့် ပင်နံပါတ် သွင်းယူမှု (PIN Lock Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-rose-500 bg-slate-900 p-4 sm:p-6 text-white shadow-xl max-w-md mx-auto text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-white">ရွှေလက်ရာ စာရင်းစနစ်ကို သော့ခတ်ထားပါသည်</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">ဆက်လက်အသုံးပြုရန် ဂဏန်း ၄ လုံး သို့မဟုတ် စကားဝှက် ထည့်ပါ</p>
                    </div>

                    {/* PIN Dots Mockup */}
                    <div className="flex justify-center gap-3 py-2">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm" />
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm" />
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm" />
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-700 border border-slate-600" />
                    </div>

                    {/* Keypad Mockup */}
                    <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto text-sm font-bold">
                      {['၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉', 'C', '၀', '⌫'].map((k, i) => (
                        <div key={i} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 cursor-pointer">
                          {k}
                        </div>
                      ))}
                    </div>

                    <div className="p-2.5 bg-amber-950/40 rounded-xl border border-amber-600/40 text-[10px] text-amber-300 text-left space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Master Password Recovery Key:</span>
                      </div>
                      <p className="text-slate-300">
                        စကားဝှက်မေ့သွားပါက သတ်မှတ်ထားသော Recovery Key ကို အသုံးပြု၍ ချက်ချင်း Reset ပြုလုပ်နိုင်ပါသည်။
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CHAPTER 12: ZERO SETUP & GO-LIVE */}
            {(printAllChapters || activeChapter === 'zero_setup') && (
              <section className={`space-y-6 ${printAllChapters ? 'print-page-break pt-8 pb-8' : ''}`}>
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <span>အခန်း ၁၂။ စတင်အသုံးပြုမည် (Zero Setup & Go-Live)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      နမူနာဒေတာများ ရှင်းလင်းခြင်း၊ စတင်လက်ကျန်ထည့်သွင်းခြင်းနှင့် လုပ်ငန်းစတင်ရန် ပြင်ဆင်ခြင်း
                    </p>
                  </div>
                  {onOpenZeroReset && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenZeroReset();
                      }}
                      className="hidden sm:flex px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl items-center gap-1.5 cursor-pointer print:hidden"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Zero Setup စတင်မည်</span>
                    </button>
                  )}
                </div>

                {/* VISUAL SCREENSHOT: Zero Setup Modal */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-amber-500" />
                    <span>[မျက်နှာပြင်ပုံစံ ၁၃] စတင်အသုံးပြုမည် မိုဒယ်လ် (Zero Setup & Go-Live Screen)</span>
                  </div>

                  <div className="rounded-2xl border-2 border-amber-500 bg-slate-900 p-3 sm:p-5 text-white shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-amber-300 ml-1">
                          စတင်အသုံးပြုမည် (Go-Live Business Setup)
                        </span>
                      </div>
                      <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black">
                        STEP 1 OF 2
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-600/50 space-y-1.5">
                        <h5 className="font-extrabold text-amber-300 text-sm">လုပ်ငန်းလက်တွေ့ စာရင်းသွင်းရန် အဆင်သင့်ဖြစ်ပါသလား?</h5>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          နမူနာစာရင်းများကို အပြီးတိုင်ရှင်းလင်းပြီး မိမိဆိုင်၏ ပေးသွင်းသူများ၊ ကုန်သည်များ၊ ကုန်ပစ္စည်းလက်ကျန်များနှင့် စတင်ငွေသားစာရင်းကို ထည့်သွင်းကာ စတင်နိုင်ပါသည်။
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block">၁။ စတင်ငွေသားလက်ကျန်</span>
                          <div className="p-1.5 bg-slate-900 rounded border border-slate-600 text-emerald-400 font-mono font-bold">
                            ၅၀၀,၀၀၀ ကျပ်
                          </div>
                        </div>
                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block">၂။ ပေးသွင်းသူအကြိုငွေ စတင်ကျန်</span>
                          <div className="p-1.5 bg-slate-900 rounded border border-slate-600 text-amber-400 font-mono font-bold">
                            သတ်မှတ်မည်
                          </div>
                        </div>
                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block">၃။ ကုန်ပစ္စည်းစတင်လက်ကျန်</span>
                          <div className="p-1.5 bg-slate-900 rounded border border-slate-600 text-cyan-400 font-mono font-bold">
                            လက်ကျန်ထည့်မည်
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
