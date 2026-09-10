import React, { useState } from 'react';
import { ShopSettings } from '../types';
import { X, Store, Save, Phone, MapPin, Tag } from 'lucide-react';

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
  const [tagline, setTagline] = useState(shopSettings.tagline || 'မြန်မာ့လက်မှု ယွန်းထည်နှင့် ဝါးနှီးလုပ်ငန်း');
  const [phone, setPhone] = useState(shopSettings.phone || '09-123456789');
  const [address, setAddress] = useState(shopSettings.address || 'ပုဂံမြို့ဟောင်း၊ မန္တလေးတိုင်း');

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
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold">ဆိုင်ရှင်နှင့် ဆိုင်အချက်အလက် ပြင်ဆင်ခြင်း</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">ဆိုင်အမည် *</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm"
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">ဆောင်ပုဒ် / လုပ်ငန်းအမျိုးအစား</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">ဖုန်းနံပါတ်</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">လိပ်စာ / တည်နေရာ</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>သိမ်းဆည်းမည်</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
