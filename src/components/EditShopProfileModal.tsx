import React, { useState } from 'react';
import { ShopSettings, NotificationSoundTheme } from '../types';
import { X, Store, Save, Phone, MapPin, Tag, Building, ShieldCheck, Sparkles, LayoutDashboard, Volume2, VolumeX } from 'lucide-react';
import { playNotificationSound } from '../utils/audio';

interface EditShopProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopSettings: ShopSettings;
  onSave: (settings: ShopSettings) => void;
}

export const EditShopProfileModal: React.FC<EditShopProfileModalProps> = ({
  isOpen,
  onClose,
  shopSettings,
  onSave,
}) => {
  const [shopName, setShopName] = useState(shopSettings.shopName || 'ရွှေလက်ရာ');
  const [ownerName, setOwnerName] = useState(shopSettings.ownerName || '');
  const [tagline, setTagline] = useState(shopSettings.tagline || 'မြန်မာ့လက်မှု ကုန်ချောနှင့် ဝါးနှီးလုပ်ငန်း');
  const [phone, setPhone] = useState(shopSettings.phone || '09-123456789');
  const [address, setAddress] = useState(shopSettings.address || 'ပုဂံမြို့ဟောင်း၊ မန္တလေးတိုင်း');
  const [branchCode, setBranchCode] = useState(shopSettings.branchCode || 'BR-01');
  const [branchName, setBranchName] = useState(shopSettings.branchName || 'ရွှေလက်ရာ ပင်မဆိုင်');
  const [defaultLandingTab, setDefaultLandingTab] = useState(shopSettings.defaultLandingTab || 'daily');
  const [soundEnabled, setSoundEnabled] = useState(shopSettings.soundEnabled ?? true);
  const [soundTheme, setSoundTheme] = useState<NotificationSoundTheme>(shopSettings.soundTheme || 'BELL');
  const [isLiveConfirmed, setIsLiveConfirmed] = useState(shopSettings.isLiveConfirmed ?? false);
  const [hideSampleDataButtons, setHideSampleDataButtons] = useState(shopSettings.hideSampleDataButtons ?? false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...shopSettings,
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      tagline: tagline.trim(),
      phone: phone.trim(),
      address: address.trim(),
      branchCode: branchCode.trim(),
      branchName: branchName.trim(),
      defaultLandingTab,
      soundEnabled,
      soundTheme,
      isLiveConfirmed,
      hideSampleDataButtons: isLiveConfirmed ? true : hideSampleDataButtons,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 flex flex-col max-h-[92vh]">
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold">ဆိုင်ရှင်နှင့် ဆိုင်အချက်အလက် စီမံခြင်း</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">ဆိုင်အမည် / လုပ်ငန်းအမည် *</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">ပိုင်ရှင်အမည် (ဆိုင်ရှင်)</label>
              <input
                type="text"
                placeholder="ဥပမာ - ဦးရွှေမောင် / ဒေါ်မြသန်း"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">ဖုန်းနံပါတ်</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">ဆိုင်ခွဲကုတ် (Branch Code)</label>
              <input
                type="text"
                placeholder="ဥပမာ - BR-01"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">ဆိုင်ခွဲအမည် (Branch Name)</label>
              <input
                type="text"
                placeholder="ဥပမာ - ရွှေလက်ရာ ပင်မဆိုင် (မင်းဘူး)"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">ဆောင်ပုဒ် / လုပ်ငန်းအမျိုးအစား</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">လိပ်စာ / တည်နေရာ</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">အက်ပ်စဖွင့်ရာတွင် ပထမဆုံးပြသမည့် စာမျက်နှာ (Default Tab)</label>
              <select
                value={defaultLandingTab}
                onChange={(e) => setDefaultLandingTab(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="daily">📦 နေ့စဉ် ကုန်သိမ်းခြင်း (Daily Collection)</option>
                <option value="sales">🚚 အရောင်းဘောင်ချာ ထုတ်ယူခြင်း (Sales)</option>
                <option value="inventory">📊 လက်ကျန် ကုန်ပစ္စည်းစာရင်း (Inventory Stock)</option>
                <option value="purchases">🪵 ဝါး/ကြိမ် ကုန်ကြမ်းဝယ်ယူမှု (Raw Material Purchases)</option>
                <option value="orders">📝 အော်ဒါစီမံခန့်ခွဲမှု (Merchant Orders)</option>
                <option value="reports">📈 ဘဏ္ဍာရေး အစီရင်ခံစာနှင့် အနှစ်ချုပ် (Reports & Financials)</option>
              </select>
            </div>
          </div>

          {/* Notification Sound Settings Section */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                <span>စာရင်းသွင်းမှု အတည်ပြု အသံစနစ် (Notification Sound)</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setSoundEnabled(enabled);
                    if (enabled) playNotificationSound(soundTheme, true);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
                <span className="text-xs font-bold text-emerald-900">
                  {soundEnabled ? 'ဖွင့်ထားသည် (On)' : 'ပိတ်ထားသည် (Off)'}
                </span>
              </label>
            </div>

            <p className="text-[11px] text-emerald-800 leading-relaxed">
              ကုန်သိမ်း၊ အရောင်း၊ အော်ဒါ၊ ကုန်စရင်းညှိ သွင်းယူမှု အတည်ဖြစ်ပါက အသံမြည်၍ အသိပေးမည်ဖြစ်ရာ နှစ်ခါထပ်သွင်းမိခြင်းမှ ကာကွယ်ပေးပါသည်။
            </p>

            {soundEnabled && (
              <div className="space-y-2 pt-2 border-t border-emerald-200/80">
                <label className="block text-slate-700 font-bold text-[11px]">အသံအမျိုးအစား ရွေးချယ်ရန် (Sound Effect)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSoundTheme('BELL');
                      playNotificationSound('BELL', true);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                      soundTheme === 'BELL'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs">🔔 အသံ ၁</div>
                      <div className="text-[10px] opacity-80">ခေါင်းလောင်းသံ (Crisp Bell)</div>
                    </div>
                    {soundTheme === 'BELL' && <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSoundTheme('CHIME');
                      playNotificationSound('CHIME', true);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                      soundTheme === 'CHIME'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs">🎵 အသံ ၂</div>
                      <div className="text-[10px] opacity-80">ငြိမ့်ညောင်းသံ (Musical Chime)</div>
                    </div>
                    {soundTheme === 'CHIME' && <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSoundTheme('DIGITAL');
                      playNotificationSound('DIGITAL', true);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                      soundTheme === 'DIGITAL'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs">⚡ အသံ ၃</div>
                      <div className="text-[10px] opacity-80">ဒီဂျစ်တယ် (Modern Beep)</div>
                    </div>
                    {soundTheme === 'DIGITAL' && <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => playNotificationSound(soundTheme, true)}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>အသံစမ်းသပ်နားထောင်မည် (Test Sound)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Business Confirmation & Auto-Disabling Sample Data */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2.5 mt-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>လက်တွေ့လုပ်ငန်း စတင်အသုံးပြုမှု အတည်ပြုခြင်း</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              ဆိုင်ဒေတာ ထည့်သွင်းပြီးပါက အတည်ပြုပြီး လက်တွေ့စတင်သုံးစွဲမည်ကို ရွေးချယ်နိုင်ပါသည်။ ၎င်းကို ရွေးချယ်ပါက နမူနာဒေတာ ခလုတ်များနှင့် လူသစ် ၁၀၀ စမ်းသပ်ထည့်ခလုတ်များကို အလိုအလျောက် ပိတ်ထားပေးမည်ဖြစ်ပါသည်။
            </p>
            <div className="space-y-2 pt-1 border-t border-amber-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isLiveConfirmed}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsLiveConfirmed(checked);
                    if (checked) setHideSampleDataButtons(true);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
                <span className="font-bold text-slate-900 text-xs">
                  ဆိုင်ဒေတာ အတည်ပြုပြီး လက်တွေ့စတင်အသုံးပြုမည် (Confirm & Start Real Business)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideSampleDataButtons || isLiveConfirmed}
                  disabled={isLiveConfirmed}
                  onChange={(e) => setHideSampleDataButtons(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-700 focus:ring-slate-500 cursor-pointer accent-slate-700"
                />
                <span className="text-[11px] text-slate-700 font-semibold">
                  နမူနာဒေတာ ခလုတ်များကို ပိတ်ထားမည် (Hide Demo Data Buttons)
                </span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>ဆိုင်အချက်အလက် သိမ်းဆည်းမည်</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
