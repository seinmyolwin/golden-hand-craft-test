import React, { useState } from 'react';
import { SoftDeletedItem } from '../types';
import { X, Trash2, RotateCcw, Search, AlertCircle } from 'lucide-react';

interface DeletedHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedItems: SoftDeletedItem[];
  onRestore: (item: SoftDeletedItem) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyTrash: () => void;
}

export const DeletedHistoryModal: React.FC<DeletedHistoryModalProps> = ({
  isOpen,
  onClose,
  deletedItems = [],
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filtered = (deletedItems || []).filter((it) => {
    if (!it) return false;
    return (
      (it.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.type || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 max-h-[85vh] flex flex-col">
        <div className="px-4 py-3 bg-rose-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-sm font-bold">အမှိုက်ပုံး / ဖျက်ပြီးသော စာရင်းများ</h3>
              <p className="text-[11px] text-rose-300">မှားယွင်းဖျက်မိပါက ပြန်လည်ရယူနိုင်သည် (Recycle Bin)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-rose-900 hover:bg-rose-800 text-rose-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <input
            type="text"
            placeholder="ဖျက်ထားသော စာရင်း ရှာမည်..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs focus:outline-none"
          />
          {deletedItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('အမှိုက်ပုံးရှိ စာရင်းအားလုံးကို အပြီးတိုင် ဖျက်ပစ်လိုပါသလား?')) {
                  onEmptyTrash();
                }
              }}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-bold whitespace-nowrap cursor-pointer"
            >
              အမှိုက်ပုံးရှင်းမည်
            </button>
          )}
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-2 text-xs">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">ဖျက်ထားသော အချက်အလက် မရှိပါ</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-medium">
                      {item.type}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ဖျက်ခဲ့သည့်အချိန်: {item.deletedAt}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRestore(item)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ပြန်ယူမည်</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('အပြီးတိုင် ဖျက်လိုပါသလား?')) {
                        onPermanentDelete(item.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
