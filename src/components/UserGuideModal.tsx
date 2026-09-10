import React, { useState } from 'react';
import {
  X,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  AlertTriangle,
  Users,
  Building2,
  Share2,
  Lock,
  RotateCcw,
  Printer,
  Smartphone,
  CheckCircle2,
  Search,
  Truck,
  Phone,
  ShieldCheck,
  Zap,
  DollarSign,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Logo } from './Logo';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenZeroReset?: () => void;
  onOpenNewEntry?: () => void;
  onOpenNewSale?: () => void;
}

type GuideTab =
  | 'overview'
  | 'inbound'
  | 'raw_materials'
  | 'sales'
  | 'inventory_alerts'
  | 'orders'
  | 'peer_trading'
  | 'backup_offline'
  | 'security_lock'
  | 'zero_setup';

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenZeroReset,
  onOpenNewEntry,
  onOpenNewSale,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPrintMenu, setShowPrintMenu] = useState<boolean>(false);
  const [printAllChapters, setPrintAllChapters] = useState<boolean>(false);

  React.useEffect(() => {
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

  const tabs: { id: GuideTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'စနစ်အကျဉ်းချုပ်', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'inbound', label: '၁။ ကုန်သိမ်းဘောင်ချာ မိုဒယ်လ်', icon: <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> },
    { id: 'raw_materials', label: '၂။ ဝါး/ကြိမ်ကုန်ကြမ်း & ငွေကြိုယူ', icon: <Layers className="w-4 h-4 text-amber-600" />, badge: 'အသစ်' },
    { id: 'sales', label: '၃။ လက်ကားအရောင်းနှင့် ကားဂိတ်', icon: <ArrowUpRight className="w-4 h-4 text-blue-600" /> },
    { id: 'inventory_alerts', label: '၄။ ကုန်လက်ကျန်နှင့် သတိပေးချက်', icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
    { id: 'orders', label: '၅။ အော်ဒါမှတ်တမ်းနှင့် စရန်ငွေ', icon: <Package className="w-4 h-4 text-purple-600" /> },
    { id: 'peer_trading', label: '၆။ ဆိုင်ချင်း အငှားကုန်ဖလှယ်မှု', icon: <Users className="w-4 h-4 text-cyan-600" /> },
    { id: 'backup_offline', label: '၇။ Shwe let yar doc. & Zapya', icon: <Smartphone className="w-4 h-4 text-indigo-600" /> },
    { id: 'security_lock', label: '၈။ App Lock နှင့် စကားဝှက်', icon: <Lock className="w-4 h-4 text-rose-600" /> },
    { id: 'zero_setup', label: '၉။ စတင်အသုံးပြုမည် & ဒေတာစီမံခန့်ခွဲမှု', icon: <Sparkles className="w-4 h-4 text-amber-500" />, badge: 'အရေးကြီး' },
  ];

  const filteredTabs = tabs.filter(
    (tab) =>
      tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tab.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:p-0 print:bg-white print:overflow-visible modal-printable-backdrop">
      <div className="bg-white text-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200 flex flex-col h-[92vh] print:h-auto print:max-w-none print:shadow-none print:border-none print:rounded-none print:overflow-visible modal-printable-container">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-emerald-800 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-emerald-900 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-amber-300/40">
              <Logo size="sm" alt="ရွှေလက်ရာ" className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
                <span>ရွှေလက်ရာ လက်စွဲလမ်းညွှန် (Complete User Guide)</span>
                <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                  မြန်မာလို
                </span>
              </h2>
              <p className="text-[11px] text-emerald-100">
                မျက်နှာပြင်ပုံစံ (Screen Shots) များဖြင့် အဆင့်ဆင့် အသုံးပြုပုံ ရှင်းလင်းချက်
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
              placeholder="ရှာဖွေလိုသောအကြောင်းအရာ (ဥပမာ - ဘောင်ချာ၊ ကားဂိတ်၊ သတိပေးချက်)..."
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
                <span>PDF / ပရင့်ထုတ်မည်</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded">PDF</span>
              </button>
              {showPrintMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-900 text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Printer className="w-4 h-4 text-emerald-600" />
                      <span>လက်စွဲလမ်းညွှန် PDF / ပရင့် ရွေးချယ်မှု</span>
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
                        <div className="font-bold text-slate-900 text-xs">လက်ရှိအခန်း ပရင့်/PDF ထုတ်မည်</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          ယခုဖွင့်ထားသော ({tabs.find((t) => t.id === activeTab)?.label}) ကိုသာ ထုတ်မည်
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
                        <div className="font-bold text-slate-900 text-xs">လက်စွဲစာအုပ် အပြည့်အစုံ PDF ထုတ်မည်</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          မာတိကာနှင့် အခန်း ၉ ခန်းစလုံး (စာမျက်နှာအစုံ) ကို စာအုပ်အဖြစ် PDF ထုတ်မည်
                        </div>
                      </div>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl text-[10px] text-slate-600 mt-2 border border-slate-200/80 leading-relaxed">
                    💡 <strong>PDF သိမ်းနည်း:</strong> ပရင့်ဝင်းဒိုး ပွင့်လာပါက <strong>Destination</strong> နေရာတွင် <strong>"Save as PDF"</strong> (သို့မဟုတ် "PDF အဖြစ်သိမ်းဆည်းမည်") ကို ရွေးချယ်ပြီး <strong>Save</strong> ကို နှိပ်ပါ။
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
                <span>စတင်အသုံးပြုမည် (Zero Reset)</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Body with Sidebar and Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden print:overflow-visible">
          {/* Navigation Sidebar */}
          <nav className="w-full md:w-64 bg-slate-100/80 border-b md:border-b-0 md:border-r border-slate-200 p-2 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col gap-1 print:hidden">
            {filteredTabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={isSelected ? 'text-amber-300' : ''}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Guide Content Display */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 print:p-0 print:overflow-visible">
            {/* PRINT-ONLY COVER & HEADER */}
            <div className="hidden print:block mb-8">
              {printAllChapters ? (
                <div className="text-center py-6 border-b-2 border-slate-800 space-y-3">
                  <div className="flex justify-center mb-2">
                    <Logo size="lg" alt="ရွှေလက်ရာ" className="w-16 h-16" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-900">
                    ရွှေလက်ရာ - မြန်မာ့ရိုးရာ ယွန်းထည်နှင့် ဝါးနှီးလုပ်ငန်း
                  </h1>
                  <p className="text-sm font-bold text-emerald-800">
                    လုပ်ငန်းခွင်သုံး စာရင်းကိုင်စနစ် အသုံးပြုသူလက်စွဲလမ်းညွှန် (Complete Operations Manual)
                  </p>
                  <div className="inline-block bg-slate-100 px-3 py-1 rounded-lg text-xs font-semibold text-slate-700">
                    ရက်စွဲ: {new Date().toLocaleDateString('my-MM')} | အော့ဖ်လိုင်းသုံးစနစ် | စုစုပေါင်းအခန်း - ၉ ခန်း
                  </div>

                  {/* Table of Contents for Print */}
                  <div className="mt-6 pt-4 border-t border-slate-200 text-left">
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                      မာတိကာ (Table of Contents)
                    </h2>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                      {tabs.map((t, idx) => (
                        <div key={t.id} className="flex justify-between py-1 border-b border-dotted border-slate-300">
                          <span>{t.label}</span>
                          <span className="font-mono text-slate-500">အခန်း ({idx + 1})</span>
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
                      <p className="text-xs font-bold text-emerald-800">{tabs.find((t) => t.id === activeTab)?.label}</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-500">
                    <p>ရက်စွဲ: {new Date().toLocaleDateString('my-MM')}</p>
                    <p>အသုံးပြုသူ လက်စွဲလမ်းညွှန်</p>
                  </div>
                </div>
              )}
            </div>
            {/* OVERVIEW */}
            {(printAllChapters || activeTab === 'overview') && (
              <div className={`space-y-5 ${printAllChapters ? 'pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                      မြန်မာ့ရိုးရာ ယွန်းထည်နှင့် ဝါးနှီးလုပ်ငန်းသုံး လယ်ဂျာ
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-emerald-950">
                      ရွှေလက်ရာ အက်ပ်ဖြင့် လုပ်ငန်းစာရင်းများကို စနစ်တကျ ထိန်းသိမ်းပါ
                    </h3>
                    <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                      အင်တာနက်လိုင်း မရှိသည့် အခြေအနေတွင်ပင် ဖုန်း သို့မဟုတ် ကွန်ပျူတာပေါ်တွင် ၁၀၀% အော့ဖ်လိုင်း သုံးနိုင်ပြီး ကုန်ပစ္စည်းပေးသွင်းသူ အကြိုငွေစာရင်း၊ ကုန်သည်လက်ကား ရောင်းချမှု၊ ကားဂိတ်ပို့ဆောင်မှု၊ ပစ္စည်းလက်ကျန် အနိမ့်ဆုံး သတိပေးချက်များနှင့် Shwe let yar doc. ဖိုင်တွဲထဲ အရန်သိမ်းဆည်းမှုများကို ပြည့်စုံစွာ ဆောင်ရွက်ပေးနိုင်ပါသည်။
                    </p>
                  </div>
                </div>

                {/* Core Workflow Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">ကုန်ပစ္စည်းပေးသွင်းသူထံမှ ကုန်သိမ်းခြင်း</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ပေးသွင်းကုန်ပစ္စည်းတန်ဖိုးတွက်ချက်ပြီး ယခင်အကြိုငွေကျန်မှ နုတ်ယူခြင်း၊ အပိုပေးငွေနှင့် အကြိုငွေအသစ် ထုတ်ပေးခြင်းများကို တစ်မျက်နှာတည်းတွင် အလိုအလျောက် တွက်ချက်ပေးပါသည်။
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">ကုန်သည် လက်ကားအရောင်းနှင့် ကားဂိတ်</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ကုန်သည်ဆိုင်ပိုင်ရှင်/ဆက်သွယ်ရမည့်သူ၊ တင်ပေးလိုက်သည့်ကား၊ ယာဉ်မောင်းအမည်နှင့် ဖုန်းနံပါတ်တို့ကို ဘောင်ချာတွင် ထည့်သွင်းမှတ်တမ်းတင်နိုင်ပြီး Print ထုတ်နိုင်ပါသည်။
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">အနိမ့်ဆုံးလက်ကျန်နှင့် သတိပေးချက်</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ကုန်ပစ္စည်းတမျိုးချင်းစီတွင် အနည်းဆုံးရှိရမည့် လက်ကျန် (Min Stock) သတ်မှတ်ထားနိုင်ပြီး သတ်မှတ်ချက်အောက် ရောက်ပါက ဦးစားပေးဝယ်ယူရန် အလိုအလျောက် အချက်ပေးပါသည်။
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">ဆိုင်ချင်း ကုန်ဖလှယ်မှု/အငှားရောင်း</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      အော်ဒါလော၍ မိတ်ဆွေယွန်းဆိုင်များထံမှ ပစ္စည်းငှားထုတ်ခြင်း သို့မဟုတ် မိမိဆိုင်မှ ပစ္စည်းငှားပေးခြင်းများကို အပြန်အလှန် စာရင်းရှင်းတမ်းဖြင့် ထိန်းသိမ်းပေးပါသည်။
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">Shwe let yar doc. ဖိုင်တွဲ အရန်သိမ်းခြင်း</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ဖုန်း၏ Download ထဲရှိ Shwe let yar doc. ဖိုင်တွဲထဲသို့ JSON ဖိုင်အဖြစ် အလွယ်တကူ ဒေါင်းလုဒ်သိမ်းဆည်းနိုင်ပြီး Zapya ဖြင့် အင်တာနက်မလိုဘဲ ဖုန်းအချင်းချင်း ပို့နိုင်ပါသည်။
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                      <Lock className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">App Lock & Emergency Recovery</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      ၄ လုံးပါ စကားဝှက် (PIN) ဖြင့် လုံခြုံစွာ Lock ချနိုင်ပြီး စကားဝှက်မေ့သွားပါက သီးသန့် အရေးပေါ် Recovery Key (SLY-xxxx-xxxx) ဖြင့် အချိန်မရွေး ပြန်ဖွင့်နိုင်ပါသည်။
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* INBOUND VOUCHER GUIDE */}
            {(printAllChapters || activeTab === 'inbound') && (
              <div className={`space-y-5 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                    <span>၁။ ကုန်သိမ်းဘောင်ချာ ဖွင့်နည်း (Inbound Pickup & Advance Settlement)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ကုန်ပစ္စည်းပေးသွင်းသူထံမှ ကုန်ပစ္စည်းလက်ခံခြင်း၊ အကြိုငွေနုတ်ယူခြင်းနှင့် ငွေရှင်းတွက်ချက်မှု အဆင့်ဆင့်
                  </p>
                </div>

                {/* SCREEN SHOT MOCKUP 1: Inbound Modal */}
                <div className="rounded-2xl border-2 border-emerald-400 bg-slate-900 p-3 sm:p-4 text-white shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-[11px] font-mono text-emerald-300 ml-2">
                        [မျက်နှာပြင်ပုံစံ - ကုန်သိမ်းဘောင်ချာ မိုဒယ်လ်]
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-700 px-2 py-0.5 rounded text-white font-bold">
                      + ကုန်သိမ်းခလုတ်
                    </span>
                  </div>

                  {/* Mockup UI Inner Box */}
                  <div className="bg-slate-850 rounded-xl p-3 sm:p-4 border border-slate-700 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400">ကုန်ပစ္စည်းပေးသွင်းသူ ရွေးချယ်မှု:</span>
                        <div className="font-bold text-white text-sm">ဦးဘတင် (ကျောက်ပန်းတောင်းရွာ)</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400">ယခင် အကြိုငွေကျန်:</span>
                        <div className="font-bold text-amber-300 text-sm">၇၅,၀၀၀ ကျပ်</div>
                      </div>
                    </div>

                    {/* Table mockup */}
                    <div className="bg-slate-900 rounded-lg p-2 border border-slate-700 space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                        <span>ကုန်ပစ္စည်း</span>
                        <span>အရေအတွက်</span>
                        <span>စျေးနှုန်း</span>
                        <span>ကျသင့်ငွေ</span>
                      </div>
                      <div className="flex justify-between font-bold text-white py-1">
                        <span>ယွန်း ကွမ်းအစ် (အကြီး)</span>
                        <span>၁၀ ထည်</span>
                        <span>၄,၅၀၀</span>
                        <span className="text-emerald-400">၄၅,၀၀၀ ကျပ်</span>
                      </div>
                      <div className="flex justify-between font-bold text-white py-1">
                        <span>ယွန်း ကွမ်းအစ် (အသေး)</span>
                        <span>၁၂ ထည်</span>
                        <span>၂,၈၀၀</span>
                        <span className="text-emerald-400">၃၃,၆၀၀ ကျပ်</span>
                      </div>
                    </div>

                    {/* Calculation breakdown mockup */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                        <span className="text-[10px] text-slate-400 block">ပေးသွင်းကုန်တန်ဖိုး</span>
                        <span className="font-bold text-emerald-400">၇၈,၆၀၀ ကျပ်</span>
                      </div>
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                        <span className="text-[10px] text-slate-400 block">အကြိုငွေမှ နုတ်ယူငွေ</span>
                        <span className="font-bold text-rose-300">- ၃၀,၀၀၀ ကျပ်</span>
                      </div>
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                        <span className="text-[10px] text-slate-400 block">အပိုပေးငွေ</span>
                        <span className="font-bold text-amber-300">၄၈,၆၀၀ ကျပ်</span>
                      </div>
                      <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                        <span className="text-[10px] text-slate-400 block">လက်ကျန် အကြိုငွေ</span>
                        <span className="font-bold text-cyan-300">၅၅,၀၀၀ ကျပ်</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step by step description */}
                <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <h4 className="font-bold text-sm text-slate-900">လိုက်နာဆောင်ရွက်ရန် အဆင့်များ:</h4>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>
                      <strong>ကုန်ပစ္စည်းပေးသွင်းသူ ရွေးချယ်ခြင်း:</strong> မျက်နှာပြင်ထိပ်ရှိ <strong>"+ ကုန်သိမ်း"</strong> ခလုတ်ကို နှိပ်ပြီး ပေးသွင်းသူအမည်ကို ရွေးပါ။ ထိုသူ၏ ယခင်အကြိုငွေကျန်ကို အလိုအလျောက် ပြသပေးပါမည်။
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
              </div>
            )}

            {/* RAW MATERIAL CREDIT & CASH ADVANCE GUIDE */}
            {(printAllChapters || activeTab === 'raw_materials') && (
              <div className={`space-y-5 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-600" />
                    <span>၂။ ဝါး၊ ကြိမ်နှင့် ကုန်ကြမ်းကြိုထုတ် / ငွေကြိုယူ မိုဒယ်လ် (Raw Material Credit & Cash Advance)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ကုန်ပစ္စည်းပေးသွင်းသူများထံသို့ ဝါး၊ ကြိမ်၊ အခြားကုန်ကြမ်းများ ကြိုတင်ထုတ်ပေးခြင်း သို့မဟုတ် ငွေကြိုထုတ်ပေးခြင်းတို့ကို ဘောင်ချာဖွင့်၍ အကြိုငွေစာရင်းထဲ တိုးမြှင့်မှတ်တမ်းတင်နည်း
                  </p>
                </div>

                {/* SCREEN SHOT MOCKUP: Raw Material Modal */}
                <div className="rounded-2xl border-2 border-amber-400 bg-slate-900 p-3 sm:p-4 text-white shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-[11px] font-mono text-amber-300 ml-2">
                        [မျက်နှာပြင်ပုံစံ - ဝါးကြိမ်ကုန်ကြမ်းကြိုထုတ်ပေးခြင်း မိုဒယ်လ်]
                      </span>
                    </div>
                    <span className="text-[10px] bg-amber-600 px-2 py-0.5 rounded text-white font-bold">
                      + ကုန်ကြမ်းထုတ်ပေးမည် ခလုတ်
                    </span>
                  </div>

                  {/* Mockup Modal Frame */}
                  <div className="bg-slate-850 rounded-xl p-3 sm:p-4 border border-slate-700 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400">ကုန်ပစ္စည်းပေးသွင်းသူ (ရွာ/လိပ်စာ):</span>
                        <div className="font-bold text-white text-sm">ကိုအောင်မြင့် (ကျောက်ကာရွာ)</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400">လက်ရှိ အကြိုငွေကျန်:</span>
                        <div className="font-bold text-amber-300 text-sm">၄၀,၀၀၀ ကျပ်</div>
                      </div>
                    </div>

                    {/* Inputs Mockup */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 bg-slate-800/90 rounded-lg border border-slate-700 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">
                          ၁။ အမျိုးအစား ရွေးချယ်မှု (Category Dropdown)
                        </span>
                        <div className="p-1.5 bg-slate-900 rounded border border-amber-500/50 text-amber-300 font-bold flex items-center justify-between">
                          <span>ဝါးကုန်ကြမ်း (BAMBOO)</span>
                          <span className="text-[10px] text-slate-400 font-normal">▼</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-0.5">
                          ရွေးချယ်နိုင်သည်များ - ဝါးကုန်ကြမ်း၊ ကြိမ်ကုန်ကြမ်း၊ ငွေကြိုယူ၊ အခြားကုန်ကြမ်း
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-800/90 rounded-lg border border-slate-700 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">
                          ၂။ ကုန်ကြမ်းပစ္စည်းအမည် (Presets & Custom)
                        </span>
                        <div className="p-1.5 bg-slate-900 rounded border border-slate-600 text-white font-bold flex items-center justify-between">
                          <span>ဝါးပိုးဝါး (အလုံး)</span>
                          <span className="text-[10px] text-slate-400 font-normal">▼</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-0.5">
                          Preset ထဲမှ ရွေးနိုင်သလို စာရိုက်ထည့်၍လည်း စိတ်ကြိုက်ထည့်နိုင်သည်
                        </div>
                      </div>
                    </div>

                    {/* Line Item Mockup */}
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700 space-y-2">
                      <div className="flex justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                        <span>ပစ္စည်း / အကြောင်းအရာ</span>
                        <span>အရေအတွက်</span>
                        <span>ပေါက်ဈေး</span>
                        <span>ကျသင့်ငွေ</span>
                      </div>
                      <div className="flex justify-between font-bold text-white items-center py-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          ဝါးပိုးဝါး (အလုံး)
                        </span>
                        <span>၂၀ လုံး</span>
                        <span>၃,၅၀၀ ကျပ်</span>
                        <span className="text-amber-300 font-mono">၇၀,၀၀၀ ကျပ်</span>
                      </div>
                      <div className="flex justify-between font-bold text-white items-center py-1 border-t border-slate-800/80">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          ကြိမ်လုံးကြီး
                        </span>
                        <span>၂ စည်း</span>
                        <span>၁၂,၀၀၀ ကျပ်</span>
                        <span className="text-amber-300 font-mono">၂၄,၀၀၀ ကျပ်</span>
                      </div>
                    </div>

                    {/* Total and Balance Update Mockup */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2.5 bg-amber-950/40 rounded-lg border border-amber-600/40">
                        <span className="text-[10px] text-amber-200 block">ယခု ထုတ်ပေးသည့် ကုန်ကြမ်းတန်ဖိုး စုစုပေါင်း</span>
                        <span className="font-extrabold text-sm text-amber-300">၉၄,၀၀၀ ကျပ်</span>
                      </div>
                      <div className="p-2.5 bg-emerald-950/40 rounded-lg border border-emerald-600/40">
                        <span className="text-[10px] text-emerald-200 block">ထုတ်ပေးပြီးနောက် အကြိုငွေ စုစုပေါင်းလက်ကျန်</span>
                        <span className="font-extrabold text-sm text-emerald-300">၁၃၄,၀၀၀ ကျပ်</span>
                      </div>
                    </div>

                    <div className="p-2 bg-slate-800 rounded text-[11px] text-slate-300 flex items-center justify-between">
                      <span>ထုတ်ပေးမည့် ဘောင်ချာအမျိုးအစား:</span>
                      <span className="font-bold text-amber-400">ဘောင်ချာနံပါတ်: MAT-20260905-001 (ကုန်ကြမ်းကြိုထုတ်ပြေစာ)</span>
                    </div>
                  </div>
                </div>

                {/* Important Instructions */}
                <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <h4 className="font-bold text-sm text-slate-900">အဓိက အသုံးပြုနည်းနှင့် မှတ်သားဖွယ်ရာများ:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                      <div className="font-bold text-amber-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-600" />
                        <span>၁။ အမျိုးအစား ၄ မျိုး ရွေးချယ်မှု</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        <strong>"ဝါးကုန်ကြမ်း"</strong>၊ <strong>"ကြိမ်ကုန်ကြမ်း"</strong>၊ <strong>"ငွေကြိုယူ"</strong>၊ <strong>"အခြားကုန်ကြမ်း"</strong> ဟူ၍ အတိအကျ ခွဲခြားထားပါသည်။ သစ်စေးကို ဖြုတ်ထားပြီး လိုအပ်ပါက အခြားကုန်ကြမ်းတွင် ထည့်သွင်းနိုင်ပါသည်။
                      </p>
                    </div>

                    <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                      <div className="font-bold text-blue-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span>၂။ "ငွေကြိုယူ" (Cash Advance) သီးသန့် အလိုအလျောက် သတ်မှတ်ခြင်း</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        အမျိုးအစားတွင် <strong>"ငွေကြိုယူ"</strong> ကို ရွေးချယ်လိုက်ပါက ယူနစ်ကို <strong>"ကျပ်"</strong> အဖြစ်လည်းကောင်း၊ ပေါက်ဈေးကို <strong>"၁ ကျပ်"</strong> အဖြစ်လည်းကောင်း စနစ်မှ အလိုအလျောက် သတ်မှတ်ပေးပြီး ကုန်ပစ္စည်းပေးသွင်းသူယူမည့် ငွေပမာဏကိုသာ တိုက်ရိုက်ရိုက်ထည့်ပေးရန် လိုအပ်ပါသည်။
                      </p>
                    </div>

                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                      <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span>၃။ အကြိုငွေစာရင်း အလိုအလျောက် တိုးခြင်း</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        ကုန်ကြမ်းကြိုထုတ်ပေးမှု (သို့မဟုတ်) ငွေကြိုယူမှု အတည်ပြုလိုက်ပါက ကုန်ပစ္စည်းပေးသွင်းသူ၏ အကြိုငွေလက်ကျန်တွင် ချက်ချင်း တိုးသွားပြီး နောက်တစ်ကြိမ် ကုန်သိမ်းဘောင်ချာ ဖွင့်သောအခါ အဆိုပါငွေကို ပြန်လည်နုတ်ယူရှင်းလင်းနိုင်ပါသည်။
                      </p>
                    </div>

                    <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
                      <div className="font-bold text-purple-950 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                        <span>၄။ ဆက်တင်တွင် စိတ်ကြိုက် ကုန်ကြမ်းအမည်များ ထည့်သွင်းစီမံခြင်း</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        <strong>"ဆက်တင် (Settings)"</strong> Tab ရှိ <strong>"ဝါး၊ ကြိမ်နှင့် ကုန်ကြမ်းကြိုထုတ် အမျိုးအစားများ စိတ်ကြိုက်စီမံခြင်း"</strong> ကဏ္ဍတွင် မိမိဆိုင်သုံး ကုန်ကြမ်းအမည်များ၊ ယူနစ်နှင့် ပေါက်ဈေးများကို စိတ်ကြိုက် အသစ်ထည့်ခြင်း၊ ဖျက်ပယ်ခြင်း ပြုလုပ်ထားနိုင်ပါသည်။
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SALES & CAR DELIVERY GUIDE */}
            {(printAllChapters || activeTab === 'sales') && (
              <div className={`space-y-5 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-blue-600" />
                    <span>၃။ လက်ကားအရောင်းဘောင်ချာနှင့် ကားဂိတ်ပို့ဆောင်မှု (Wholesale Sales & Delivery)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ကုန်သည်ရွေးချယ်ခြင်း၊ ကားဂိတ်/ယာဉ်မောင်း/ဖုန်းနံပါတ် ဖြည့်သွင်းခြင်းနှင့် ဘောင်ချာထုတ်နည်း
                  </p>
                </div>

                {/* SCREEN SHOT MOCKUP 2: Sales Voucher */}
                <div className="rounded-2xl border-2 border-blue-400 bg-slate-900 p-3 sm:p-4 text-white shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-[11px] font-mono text-blue-300 ml-2">
                        [မျက်နှာပြင်ပုံစံ - လက်ကားအရောင်းဘောင်ချာ (Sales Invoice)]
                      </span>
                    </div>
                    <span className="text-[10px] bg-blue-700 px-2 py-0.5 rounded text-white font-bold">
                      + အရောင်းဖွင့်
                    </span>
                  </div>

                  {/* Mockup Voucher Document */}
                  <div className="bg-white text-slate-900 rounded-xl p-4 border border-slate-300 space-y-2.5 text-xs shadow-md">
                    <div className="text-center border-b border-dashed border-slate-300 pb-2">
                      <div className="font-extrabold text-sm text-slate-900">ရွှေလက်ရာ ယွန်းထည်တိုက်</div>
                      <div className="text-[10px] text-slate-500">ကုန်သည်အရောင်းပြေစာ (SALES INVOICE)</div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-slate-200 pb-2">
                      <div>
                        <span className="text-slate-500">ဖောက်သည်/ကုန်သည်: </span>
                        <strong>ရွှေမန္တလေး ယွန်းဆိုင် (မန္တလေး)</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">ပိုင်ရှင်/ဆက်သွယ်ရသူ: </span>
                        <strong className="text-blue-800">ဒေါ်နွယ်နွယ်ဝင်း (09-250112233)</strong>
                      </div>
                    </div>

                    {/* Transport & Car Delivery Banner */}
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-blue-900">
                        <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>တင်ပေးလိုက်သည့်ကား: <strong>ရွှေမန္တလာ အဝေးပြေး 3B-5591</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-blue-900">
                        <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>ယာဉ်မောင်း/ဖုန်း: <strong>ကိုအောင်ကျော် (09-790123456)</strong></span>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                      <span>စုစုပေါင်း ကျသင့်ငွေ:</span>
                      <span className="text-blue-900 text-sm font-extrabold">၁၂၂,၅၀၀ ကျပ်</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-emerald-800">
                      <span>ပေးချေပြီးငွေ (KPAY):</span>
                      <span>၅၀,၀၀၀ ကျပ်</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-rose-700 font-bold border-t border-dashed pt-1">
                      <span>ကျန်ရှိမည့် ရရန်ငွေ (အကြွေး):</span>
                      <span>၇၂,၅၀၀ ကျပ်</span>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  <h4 className="font-bold text-sm text-slate-900">အရောင်းဘောင်ချာ ဖွင့်ရာတွင် အဓိက သတိပြုရန်:</h4>
                  <ul className="list-disc list-inside space-y-1.5">
                    <li>
                      <strong>ကုန်သည်ဆိုင်ပိုင်ရှင် / ဆက်သွယ်ရမည့်သူ:</strong> ကုန်သည်ရွေးလိုက်သည်နှင့် ဆက်သွယ်ရမည့် ပုဂ္ဂိုလ်အမည်ကို အလိုအလျောက် ဖော်ပြပေးပါသည်။
                    </li>
                    <li>
                      <strong>တင်ပေးလိုက်သည့်ကားနှင့် ယာဉ်မောင်းဖုန်း:</strong> အဝေးပြေးကားဂိတ်ဖြင့် ပစ္စည်းတင်ပို့ရာတွင် <strong>"တင်ပေးလိုက်သည့်ကား/ယာဉ်အမှတ်"</strong> နှင့် <strong>"ယာဉ်မောင်းဖုန်းနံပါတ်"</strong> ကို မဖြစ်မနေ ထည့်သွင်းထားပါက ကုန်သည်မှ ပစ္စည်းမရောက်သေးကြောင်း မေးမြန်းသည့်အခါ အလွယ်တကူ စစ်ဆေးအကြောင်းကြားနိုင်ပါသည်။
                    </li>
                    <li>
                      <strong>လက်ကားစျေးနှုန်း (Wholesale Price):</strong> ကုန်ပစ္စည်းတစ်ခုချင်းစီ၏ သတ်မှတ်လက်ကားစျေးနှုန်းကို အလိုအလျောက် ယူပေးသော်လည်း လိုအပ်ပါက ဘောင်ချာထဲတွင် စျေးနှုန်း ပြင်ဆင်နိုင်ပါသည်။
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* INVENTORY & LOW STOCK ALERTS */}
            {(printAllChapters || activeTab === 'inventory_alerts') && (
              <div className={`space-y-5 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>၄။ လက်ကျန်ကုန်ပစ္စည်းနှင့် အနိမ့်ဆုံးသတိပေးချက် (Inventory & Reorder Alert)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    အနည်းဆုံးရှိရမည့် လက်ကျန်သတ်မှတ်ခြင်းနှင့် ဦးစားပေး ထပ်မံမှာယူ/ဝယ်ယူရန် သတိပေးချက် ထုတ်ယူခြင်း
                  </p>
                </div>

                {/* SCREEN SHOT MOCKUP 3: Inventory Priority Alert Card */}
                <div className="rounded-2xl border-2 border-amber-400 bg-slate-900 p-3 sm:p-4 text-white shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="text-[11px] font-mono text-amber-300">
                      [မျက်နှာပြင်ပုံစံ - နောက်ထပ် ဦးစားပေးဝယ်ယူရန် သတိပေးချက် (Priority Reorder Alert)]
                    </span>
                    <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded text-white font-bold animate-pulse">
                      လက်ကျန်နည်းသတိပေးချက်
                    </span>
                  </div>

                  {/* Priority Alert Banner mockup */}
                  <div className="bg-amber-950/80 border border-amber-500/50 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-amber-200">
                          အနိမ့်ဆုံး သတ်မှတ်ချက်အောက် ရောက်နေသော ကုန်ပစ္စည်းများ (၃ မျိုး)
                        </span>
                      </div>
                      <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-bold">
                        ဦးစားပေး အပ်နှံရန်
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-amber-500/30 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white">ယွန်း ကွမ်းအစ် (အကြီး)</div>
                          <div className="text-[11px] text-rose-400">
                            လက်ရှိကျန်: <strong>၄ ထည်</strong> (အနည်းဆုံး: ၁၅ ထည်)
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-emerald-600 text-white rounded">
                          + ကုန်သိမ်းမည်
                        </span>
                      </div>

                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-amber-500/30 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white">ယွန်း လက်ဖက်အုပ် (ရိုးရာ)</div>
                          <div className="text-[11px] text-rose-400">
                            လက်ရှိကျန်: <strong>၃ ထည်</strong> (အနည်းဆုံး: ၁၂ ထည်)
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-emerald-600 text-white rounded">
                          + ကုန်သိမ်းမည်
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Steps */}
                <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  <h4 className="font-bold text-sm text-slate-900">အနိမ့်ဆုံးလက်ကျန် သတ်မှတ်ပုံ:</h4>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      <strong>ပစ္စည်းပြင်ဆင်ရန်:</strong> <strong>"ပစ္စည်းစာရင်း"</strong> သို့မဟုတ် <strong>"ဆက်တင် (Settings)"</strong> Tab ရှိ Product Master တွင် မိမိလိုချင်သော ပစ္စည်းဘေးရှိ <strong>"ပြင်မည် (Edit)"</strong> ကို နှိပ်ပါ။
                    </li>
                    <li>
                      <strong>အနိမ့်ဆုံးသတိပေးလက်ကျန် (Min Stock Alert):</strong> ထိုပစ္စည်းအတွက် ဆိုင်တွင် အမြဲ အနည်းဆုံး ရှိနေသင့်သော အရေအတွက် (ဥပမာ - ၁၅ ထည်) ကို သတ်မှတ်ထည့်သွင်းပါ။
                    </li>
                    <li>
                      <strong>အလိုအလျောက် သတိပေးခြင်း:</strong> အရောင်းဘောင်ချာများ ဖွင့်ထုတ်လိုက်သဖြင့် ပစ္စည်းလက်ကျန်သည် သတ်မှတ်ထားသော အနိမ့်ဆုံးအရေအတွက်အောက်သို့ လျော့နည်းသွားပါက မျက်နှာပြင်တွင် <strong>"နောက်ထပ် ဦးစားပေးဝယ်ယူရန် သတိပေးချက်"</strong> အနီရောင်/အဝါရောင် ကတ်ပြား ချက်ချင်း ထွက်ပေါ်လာမည်ဖြစ်ပါသည်။
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* ORDERS & ADVANCE DEPOSITS */}
            {(printAllChapters || activeTab === 'orders') && (
              <div className={`space-y-4 text-xs text-slate-700 leading-relaxed ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    <span>၅။ အော်ဒါမှတ်တမ်းနှင့် စရန်ငွေ စီမံခန့်ခွဲမှု (Merchant Orders & Deposits)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ကြိုတင်အော်ဒါလက်ခံခြင်း၊ စရန်ငွေမှတ်တမ်းတင်ခြင်းနှင့် အရောင်းဘောင်ချာသို့ ပြောင်းလဲခြင်း
                  </p>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                  <div className="font-bold text-purple-950 text-sm">အော်ဒါလုပ်ဆောင်ချက်များ:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>အော်ဒါသစ် ထည့်သွင်းရာတွင် ကုန်သည်အမည်၊ ပစ္စည်းနှင့် စရန်ငွေ (Deposit) ကို ထည့်သွင်းနိုင်သည်။</li>
                    <li>ပေးပို့ရမည့် ပစ်မှတ်ရက်စွဲ (Delivery Target Date) သတ်မှတ်ထားနိုင်သဖြင့် ရက်မလွန်စေရန် စောင့်ကြည့်နိုင်သည်။</li>
                    <li>ပစ္စည်းအသင့်ဖြစ်ပါက <strong>"အရောင်းဘောင်ချာသို့ ပြောင်းမည် (Convert to Sale)"</strong> ခလုတ်ကို နှိပ်ရုံဖြင့် လက်ကားအရောင်းဘောင်ချာ အဖြစ် တိုက်ရိုက် ပြောင်းပေးပါသည်။</li>
                  </ul>
                </div>
              </div>
            )}

            {/* PEER TRADING */}
            {(printAllChapters || activeTab === 'peer_trading') && (
              <div className={`space-y-4 text-xs text-slate-700 leading-relaxed ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-600" />
                    <span>၆။ ဆိုင်ချင်း အငှားကုန်ဖလှယ်မှု စာရင်း (Peer Trading / Borrow & Lend)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    အနီးနားရှိ မိတ်ဆွေယွန်းဆိုင်များနှင့် ပစ္စည်းအငှားရောင်းချခြင်းနှင့် စာရင်းရှင်းတမ်း
                  </p>
                </div>

                <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl space-y-2">
                  <div className="font-bold text-cyan-950 text-sm">ဆိုင်ချင်း ကုန်ဖလှယ်မှု အကျဉ်း:</div>
                  <p>
                    ပုဂံ၊ မန္တလေးရှိ ရိုးရာယွန်းထည်ဆိုင်များသည် အော်ဒါလောသည့်အခါ မိတ်ဆွေဆိုင်များထံမှ ပစ္စည်းခေတ္တငှားယူထုတ်ပေးရလေ့ရှိပါသည်။
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>ငှားယူခြင်း (BORROW):</strong> မိတ်ဆွေဆိုင်ထံမှ ပစ္စည်းယူလာခြင်း (မိမိဘက်မှ ပေးရန်ကျန်)</li>
                    <li><strong>ငှားပေးခြင်း (LEND):</strong> မိတ်ဆွေဆိုင်သို့ ပစ္စည်းထုတ်ပေးလိုက်ခြင်း (မိမိဘက်မှ ရရန်ကျန်)</li>
                    <li><strong>စာရင်းရှင်းမည် (Settle):</strong> နောက်ပိုင်းတွင် ပစ္စည်းပြန်ပေးသည်ဖြစ်စေ၊ ငွေရှင်းသည်ဖြစ်စေ စာရင်းကို အကျေရှင်းနိုင်ပါသည်။</li>
                  </ul>
                </div>
              </div>
            )}

            {/* BACKUP & OFFLINE ZAPYA */}
            {(printAllChapters || activeTab === 'backup_offline') && (
              <div className={`space-y-5 ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                    <span>၇။ Shwe let yar doc. ဖိုင်တွဲနှင့် Zapya ဖြင့် အရန်သိမ်းခြင်း (Backup & Restore)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ဖုန်းတွင်းသို့ JSON ဖိုင်ဒေါင်းလုဒ်သိမ်းခြင်းနှင့် အင်တာနက်မလိုဘဲ ဖုန်းအချင်းချင်း ဒေတာလွှဲနည်း
                  </p>
                </div>

                {/* Shwe let yar doc folder instructions */}
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                    <Smartphone className="w-4 h-4 text-indigo-700" />
                    <span>Shwe let yar doc. Folder လမ်းညွှန်ချက်:</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    ဖုန်း၏ <strong>File Manager</strong> သို့မဟုတ် <strong>Files App</strong> ရှိ <strong>Download</strong> ဖိုင်တွဲထဲတွင်{' '}
                    <strong className="bg-white px-2 py-0.5 rounded border border-indigo-300 font-mono text-indigo-900">
                      Shwe let yar doc.
                    </strong>{' '}
                    ဟူသော ဖိုင်တွဲတစ်ခု ဆောက်ထားပါ။
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    ဆက်တင် Tab ရှိ <strong>"Shwe let yar doc. ထဲ ဒေါင်းလုဒ်သိမ်းမည်"</strong> ခလုတ်ကို နှိပ်လိုက်ပါက{' '}
                    <strong className="text-indigo-900 font-mono">Shwe_let_yar_doc_backup_[ရက်စွဲ].json</strong> အမည်ဖြင့် စာရင်းအားလုံးကို ဖုန်းထဲသို့ ဒေါင်းလုဒ်ရယူပေးပါမည်။ ထိုဖိုင်ကို Shwe let yar doc. folder ထဲသို့ ရွှေ့သိမ်းထားနိုင်ပါသည်။
                  </p>
                </div>

                {/* Zapya Transfer */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-purple-950 font-bold text-sm">
                    <Share2 className="w-4 h-4 text-purple-700" />
                    <span>Zapya / Bluetooth ဖြင့် အင်တာနက်မလိုဘဲ အခြားဖုန်းသို့ ပို့ခြင်း:</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    မျက်နှာပြင်ထိပ်ရှိ <strong>"Zapya"</strong> ခလုတ်ကို နှိပ်ပြီး Backup JSON ဖိုင်ကို ဒေါင်းလုဒ်ယူပါ။ ထို့နောက် <strong>Zapya App</strong> သို့မဟုတ် <strong>Bluetooth / ShareMe</strong> ဖြင့် အခြားဖုန်းသို့ အင်တာနက်လုံးဝမလိုဘဲ ပေးပို့ပြီး အဆိုပါဖုန်းတွင် <strong>"မိတ္တူဖိုင်မှ စာရင်းပြန်သွင်းမည်"</strong> ကို နှိပ်၍ ပြန်လည်သွင်းယူနိုင်ပါသည်။
                  </p>
                </div>
              </div>
            )}

            {/* SECURITY APP LOCK */}
            {(printAllChapters || activeTab === 'security_lock') && (
              <div className={`space-y-4 text-xs text-slate-700 leading-relaxed ${printAllChapters ? 'print-page-break pt-8 pb-8 border-b-2 border-slate-300' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-rose-600" />
                    <span>၈။ လုံခြုံရေး App Lock နှင့် အရေးပေါ် Recovery Key</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ဆိုင်စာရင်းများ မပေါက်ကြားစေရန် စကားဝှက်ခံခြင်းနှင့် မေ့သွားပါက ဖြေရှင်းနည်း
                  </p>
                </div>

                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="font-bold text-rose-950 text-sm">စကားဝှက် သတ်မှတ်ခြင်း:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>မူလစကားဝှက်မှာ <strong>1234</strong> ဖြစ်ပြီး ဆက်တင်တွင် စိတ်ကြိုက် ၄ လုံး ပြောင်းနိုင်ပါသည်။</li>
                    <li>စကားဝှက်မေ့သွားပါက အရေးပေါ် ပြန်လည်ရယူရေးကီး (ဥပမာ - <strong>SLY-8842-9173</strong>) ကို ရိုက်ထည့်၍ ချက်ချင်း Reset ချနိုင်ပါသည်။</li>
                    <li>Recovery Key ကို ဘေးကင်းလုံခြုံသော မှတ်စုစာအုပ်တွင် ကူးယူသိမ်းဆည်းထားသင့်ပါသည်။</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ZERO SETUP & START FRESH */}
            {(printAllChapters || activeTab === 'zero_setup') && (
              <div className={`space-y-5 text-xs text-slate-700 leading-relaxed ${printAllChapters ? 'print-page-break pt-8' : ''}`}>
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <span>၉။ ဒေတာ စီမံခန့်ခွဲမှု ရွေးချယ်စရာ (၃) ခု ရှင်းလင်းချက် (Data Setup Options)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ဆက်တင် (Settings) ရှိ နမူနာဒေတာထည့်ခြင်း၊ ဆိုင်စာရင်းသစ်စတင်ခြင်းနှင့် ဒေတာအားလုံးရှင်းထုတ်ခြင်းတို့၏ ကွဲပြားချက်များ
                  </p>
                </div>

                {/* 3 Cards Explanation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border-2 border-emerald-300 bg-emerald-50/50 space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      စမ်းသပ်ရန်
                    </span>
                    <h4 className="font-bold text-slate-900 text-xs">၁။ နမူနာဒေတာ သွင်းမည်</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      အက်ပ်ကို မသုံးမီ စမ်းသပ်လေ့လာလိုသူများအတွက် ကုန်သိမ်း၊ အရောင်း၊ ဝါးကြိမ်၊ အော်ဒါ နမူနာစာရင်းများကို သင့်တင့်မျှတစွာ ထည့်သွင်းပေးပါသည်။
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border-2 border-amber-400 bg-amber-50/60 space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-400">
                      ဆိုင်သုံးရန် (အကြံပြုချက်)
                    </span>
                    <h4 className="font-bold text-slate-950 text-xs">၂။ ဆိုင်စာရင်းသစ် စတင်မည် (Zero Settings)</h4>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      ဆိုင်အမည်၊ ကုန်ပစ္စည်းနှင့် မိတ်ဆွေစာရင်းကို မဖျက်ဘဲ လက်ကျန်ပစ္စည်း၊ အကြွေး၊ အကြိုငွေ အားလုံးကို ၀ (သုည) သတ်မှတ်ပြီး စာရင်းအသစ် စတင်ပါသည်။
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border-2 border-rose-300 bg-rose-50/50 space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                      အပြီးတိုင်ဖျက်ရန်
                    </span>
                    <h4 className="font-bold text-rose-950 text-xs">၃။ ဒေတာအားလုံး ရှင်းထုတ်မည်</h4>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      အက်ပ်ကို စက်ဆင်ခါစအတိုင်း အကုန်ရှင်းထုတ်လိုပါက အသုံးပြုရန် ဖြစ်ပြီး မဖျက်မီ အလိုအလျောက် Snapshot အရန်သိမ်းပေးပါသည်။
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-3">
                  <div className="font-black text-amber-950 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>ဆိုင်စာရင်း အသစ်စတင်ရာတွင် ပြုလုပ်ပေးမည့်အချက်များ:</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-1.5 font-medium">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ကုန်လက်ကျန်အားလုံး သုည (၀) အဖြစ် သတ်မှတ်ပေးပါမည်။</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ကုန်ပစ္စည်းပေးသွင်းသူများထံ ပေးရန်ကျန် အကြိုငွေအားလုံး သုည (၀) သို့ ပြောင်းပေးပါမည်။</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ကုန်သည်များထံမှ ရရန်ကျန်ငွေအားလုံး သုည (၀) သို့ ပြောင်းပေးပါမည်။</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ယခင် နမူနာဘောင်ချာများနှင့် အရောင်းစာရင်းများကို ရှင်းထုတ်ပေးပါမည်။</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-900">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>ဆိုင်အမည်၊ ဆိုင်ရှင်အမည်နှင့် ကုန်ပစ္စည်းပေးသွင်းသူ/ကုန်သည်/ကုန်ပစ္စည်း အမည်များကို ဆက်လက် ထိန်းသိမ်းပေးထားပါမည် (အသစ်ပြန်ရိုက်စရာမလိုပါ)။</span>
                    </div>
                  </div>

                  {onOpenZeroReset && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenZeroReset();
                        }}
                        className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>ယခုချက်ချင်း စတင်အသုံးပြုမည် (စာရင်းများ အားလုံး သုည သတ်မှတ်မည်)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
