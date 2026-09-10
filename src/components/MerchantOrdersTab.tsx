import React, { useState, useMemo } from 'react';
import { MerchantOrder, Merchant, Product, OrderStatus } from '../types';
import {
  formatMMK,
  formatNumberOnly,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/storage';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  Plus,
  Search,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  Filter,
  X,
  Building2,
  Trash2,
} from 'lucide-react';

interface MerchantOrdersTabProps {
  orders: MerchantOrder[];
  merchants: Merchant[];
  products: Product[];
  onAddOrder: (order: MerchantOrder) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onConvertOrderToSale: (order: MerchantOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
}

export const MerchantOrdersTab: React.FC<MerchantOrdersTabProps> = ({
  orders = [],
  merchants = [],
  products = [],
  onAddOrder,
  onUpdateOrderStatus,
  onConvertOrderToSale,
  onDeleteOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New Order Form
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
  const [deliveryDueDate, setDeliveryDueDate] = useState<string>(getTodayDateString());
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: products[0]?.id || '', quantity: 10 },
  ]);
  const [orderNotes, setOrderNotes] = useState<string>('');

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((ord) => {
      if (!ord) return false;
      const matchesSearch =
        (ord.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ord.merchantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ord.merchantTown || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const pendingCount = (orders || []).filter((o) => o && o.status === 'PENDING').length;
  const preparingCount = (orders || []).filter((o) => o && o.status === 'PREPARING').length;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const merchant = merchants.find((m) => m.id === selectedMerchantId) || merchants[0];
    if (!merchant) return;

    const validItems = orderItems
      .map((it) => {
        const p = products.find((prod) => prod.id === it.productId);
        if (!p || it.quantity <= 0) return null;
        const unitPrice = p.defaultWholesalePrice || Math.round(p.defaultPrice * 1.25);
        return {
          productId: p.id,
          productName: p.name,
          quantity: it.quantity,
          unit: p.unit,
          unitPrice,
          subtotal: it.quantity * unitPrice,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null);

    if (validItems.length === 0) {
      alert('အနည်းဆုံး ကုန်ပစ္စည်း ၁ မျိုး ထည့်သွင်းပေးပါ');
      return;
    }

    const totalEstValue = validItems.reduce((sum, it) => sum + it.subtotal, 0);

    const newOrder: MerchantOrder = {
      id: `ord-${Date.now()}`,
      orderNumber: `ORD-${Date.now().toString().slice(-4)}`,
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantTown: merchant.town,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      deliveryDueDate: deliveryDueDate || getTodayDateString(),
      items: validItems,
      totalEstimatedValue: totalEstValue,
      status: 'PENDING',
      notes: orderNotes.trim(),
    };

    onAddOrder(newOrder);
    setIsAddModalOpen(false);
    setOrderItems([{ productId: products[0]?.id || '', quantity: 10 }]);
    setOrderNotes('');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ကုန်သည်အော်ဒါ မှာယူမှုများ
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  {orders.length} စောင်
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                ဖောက်သည်များထံမှ ကြိုတင်အော်ဒါများ၊ ထုပ်ပိုးပြင်ဆင်မှုနှင့် ပို့ဆောင်ရက်ချိန်း
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (merchants.length > 0 && !selectedMerchantId) {
                setSelectedMerchantId(merchants[0].id);
              }
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ အော်ဒါအသစ် ရေးသွင်းမည်</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="အော်ဒါနံပါတ် / ကုန်သည်အမည် / မြို့နယ်ဖြင့် ရှာမည်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              အားလုံး ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              စောင့်ဆိုင်းဆဲ ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PREPARING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === 'PREPARING'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ပြင်ဆင်ဆဲ ({preparingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DELIVERED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === 'DELIVERED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ပို့ဆောင်ပြီး
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">အော်ဒါမှတ်တမ်း မရှိသေးပါ</p>
          </div>
        ) : (
          filteredOrders.map((ord) => (
            <div
              key={ord.id}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-indigo-300 transition-all space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 font-extrabold rounded text-xs">
                    {ord.orderNumber}
                  </span>
                  <span className="text-xs text-slate-500">
                    မှာယူရက်: {ord.date} {ord.time}
                  </span>
                  {ord.deliveryDueDate && (
                    <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ရက်ချိန်း: {ord.deliveryDueDate}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {ord.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(ord.id, 'PREPARING')}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded cursor-pointer transition-colors"
                    >
                      ပြင်ဆင်မှုစတင်မည်
                    </button>
                  )}
                  {ord.status === 'PREPARING' && (
                    <button
                      type="button"
                      onClick={() => onConvertOrderToSale(ord)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>အရောင်းဘောင်ချာသို့ ပြောင်းမည်</span>
                    </button>
                  )}
                  {ord.status === 'DELIVERED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ပို့ဆောင်ပြီး
                    </span>
                  )}
                  {onDeleteOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`အော်ဒါ ${ord.orderNumber} ကို ဖျက်လိုပါသလား?`)) {
                          onDeleteOrder(ord.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    {ord.merchantName}
                    <span className="text-[11px] px-2 py-0.5 bg-white border border-slate-200 text-indigo-700 rounded-full font-bold">
                      <MapPin className="w-3 h-3 inline mr-0.5" />
                      {ord.merchantTown}
                    </span>
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">ခန့်မှန်းတန်ဖိုး</span>
                  <span className="text-sm font-extrabold text-indigo-900">
                    {formatMMK(ord.totalEstimatedValue)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-xs">
                {ord.items.map((it, idx) => (
                  <div key={idx} className="p-2 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="font-bold text-slate-800">{it.productName}</span>
                    <span className="text-slate-600 font-semibold">
                      {it.quantity} {it.unit}
                    </span>
                  </div>
                ))}
              </div>

              {ord.notes && (
                <div className="text-xs text-slate-500 italic">
                  မှတ်ချက်: {ord.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Order Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="px-4 py-3 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-300" />
                <h3 className="text-sm font-bold">အော်ဒါအသစ် မှတ်တမ်းတင်ခြင်း</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-indigo-800 hover:bg-indigo-700 text-indigo-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ကုန်သည် ရွေးချယ်ပါ *</label>
                <select
                  value={selectedMerchantId}
                  onChange={(e) => setSelectedMerchantId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                  required
                >
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.town})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ပို့ဆောင်ရမည့်ရက်ချိန်း *</label>
                <input
                  type="date"
                  value={deliveryDueDate}
                  onChange={(e) => setDeliveryDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">မှာယူသော ပစ္စည်းများ</label>
                <div className="space-y-2">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[index].productId = e.target.value;
                          setOrderItems(updated);
                        }}
                        className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[index].quantity = parseInt(e.target.value, 10) || 1;
                          setOrderItems(updated);
                        }}
                        className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                        placeholder="အရေအတွက်"
                      />
                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderItems(orderItems.filter((_, i) => i !== index));
                          }}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setOrderItems([...orderItems, { productId: products[0]?.id || '', quantity: 10 }]);
                    }}
                    className="text-xs text-indigo-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>နောက်ထပ် ပစ္စည်းထည့်မည်</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  placeholder="ဥပမာ - ကားဂိတ်သို့ အချိန်မီ ပို့ပေးရန်"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  အော်ဒါသိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
