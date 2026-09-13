import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Product,
  SaleRecord,
  Merchant,
  UserSession,
  ShopSettings,
  SaleItem,
  AuditLogEntry,
} from '../types';
import {
  formatMMK,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/storage';
import { generateStableId } from '../utils/idGenerator';
import { saleRepo, productRepo } from '../repositories';
import { recordAuditEvent } from '../services/auditTrailService';
import {
  ShoppingCart,
  QrCode,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Banknote,
  User,
  Phone,
  X,
  Package,
  Sparkles,
  Zap,
} from 'lucide-react';

interface RetailCartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface RetailSalesTabProps {
  products: Product[];
  merchants?: Merchant[];
  sales?: SaleRecord[];
  currentSession?: UserSession | null;
  shopSettings?: ShopSettings;
  onSaleCompleted?: (sale: SaleRecord) => void;
  onOpenVoucher?: (sale: SaleRecord) => void;
}

export const RetailSalesTab: React.FC<RetailSalesTabProps> = ({
  products = [],
  merchants = [],
  currentSession,
  shopSettings,
  onSaleCompleted,
  onOpenVoucher,
}) => {
  // State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<RetailCartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('လက်လီဝယ်သူ');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'KPAY' | 'WAVE' | 'BANK'>('CASH');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<SaleRecord | null>(null);

  // Barcode / QR Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const scannerContainerId = 'retail-qr-reader';
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchQuery =
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.id || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchQuery && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    const total = cartSubtotal - (discountAmount || 0);
    return Math.max(0, total);
  }, [cartSubtotal, discountAmount]);

  const changeAmount = useMemo(() => {
    if (amountPaid <= 0 || amountPaid < grandTotal) return 0;
    return amountPaid - grandTotal;
  }, [amountPaid, grandTotal]);

  // Add Item to Cart
  const handleAddToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const updated = [...prevCart];
        const newQty = updated[existingIndex].quantity + 1;
        const price = updated[existingIndex].unitPrice;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          subtotal: newQty * price,
        };
        return updated;
      } else {
        const price = product.defaultPrice || product.defaultWholesalePrice || 0;
        return [
          ...prevCart,
          {
            product,
            quantity: 1,
            unitPrice: price,
            subtotal: price,
          },
        ];
      }
    });
  };

  // Update Cart Quantity
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          return {
            ...item,
            quantity: newQty,
            subtotal: newQty * item.unitPrice,
          };
        }
        return item;
      })
    );
  };

  // Update Unit Price
  const handleUpdateUnitPrice = (productId: string, newPrice: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          return {
            ...item,
            unitPrice: Math.max(0, newPrice),
            subtotal: item.quantity * Math.max(0, newPrice),
          };
        }
        return item;
      })
    );
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  // Clear Cart
  const handleClearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setAmountPaid(0);
  };

  // Handle Barcode Scan Success
  const handleBarcodeScanned = (scannedText: string) => {
    const code = scannedText.trim().toLowerCase();
    const matchedProduct = products.find(
      (p) =>
        (p.code || '').toLowerCase() === code ||
        (p.id || '').toLowerCase() === code ||
        (p.barcode || '').toLowerCase() === code ||
        (p.name || '').toLowerCase() === code
    );

    if (matchedProduct) {
      handleAddToCart(matchedProduct);
      setIsScannerOpen(false);
    } else {
      alert(`Barcode/QR Code "${scannedText}" အတွက် ကုန်ပစ္စည်း ရှာမတွေ့ပါ`);
    }
  };

  // Initialize Camera Scanner
  useEffect(() => {
    if (isScannerOpen) {
      const timer = setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner(
            scannerContainerId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              supportedScanTypes: [],
            },
            /* verbose= */ false
          );

          scanner.render(
            (decodedText) => {
              handleBarcodeScanned(decodedText);
              try {
                scanner.clear();
              } catch (e) {
                console.error(e);
              }
            },
            (error) => {
              // Ignore scan errors during scanning
            }
          );
          scannerRef.current = scanner;
        } catch (err) {
          console.error('QR Scanner init error:', err);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            scannerRef.current.clear();
          } catch (e) {
            console.error(e);
          }
        }
      };
    }
  }, [isScannerOpen]);

  // Checkout Handler (Repository Pattern + Atomic Transaction + Protection against Silent Skips)
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('ဈေးဝယ်ခြင်းတောင်း ထဲတွင် ကုန်ပစ္စည်းမရှိသေးပါ');
      return;
    }

    // Check stock warnings (no silent skipping)
    const stockWarnings: string[] = [];
    cart.forEach((item) => {
      if ((item.product.currentStock || 0) < item.quantity) {
        stockWarnings.push(
          `${item.product.name} (လက်ကျန်: ${item.product.currentStock || 0} ${item.product.unit} / ရောင်းမည်: ${item.quantity} ${item.product.unit})`
        );
      }
    });

    if (stockWarnings.length > 0) {
      const confirmMsg = `အောက်ပါ ကုန်ပစ္စည်းများ လက်ကျန်ထက် ပိုမိုရောင်းချနေပါသည် -\n\n${stockWarnings.join('\n')}\n\nဆက်လက် ရောင်းချပါမည်လား?`;
      if (!confirm(confirmMsg)) {
        return;
      }
    }

    setIsProcessing(true);

    try {
      const saleId = generateStableId('sal');
      const voucherNo = `RETAIL-${Date.now().toString().slice(-6)}`;
      const performer = currentSession?.username || 'Retail POS User';

      const saleItems: SaleItem[] = cart.map((ci) => ({
        productId: ci.product.id,
        productName: ci.product.name,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        subtotal: ci.subtotal,
        unit: ci.product.unit || 'ခု',
      }));

      const auditLog: AuditLogEntry = {
        id: generateStableId('audit'),
        timestamp: new Date().toISOString(),
        action: 'CREATE_RETAIL_SALE',
        actionType: 'SALE_CREATE',
        entityType: 'SALE',
        entityId: saleId,
        performer,
        referenceVoucherNo: voucherNo,
        details: `လက်လီအရောင်း voucher ${voucherNo} - ကျသင့်ငွေ ${formatMMK(grandTotal)}`,
        metadata: {
          itemsCount: saleItems.length,
          paymentMethod,
          customerName,
          amountPaid,
          changeAmount,
        },
      };

      const newSaleRecord: SaleRecord = {
        id: saleId,
        voucherNo,
        date: getTodayDateString(),
        time: getCurrentTimeString(),
        type: 'RETAIL',
        customerName: customerName.trim() || 'လက်လီဝယ်သူ',
        customerPhone: customerPhone.trim() || '-',
        items: saleItems,
        subtotal: cartSubtotal,
        discount: discountAmount,
        grandTotal,
        paymentType: paymentMethod,
        paidAmount: amountPaid > 0 ? amountPaid : grandTotal,
        balance: 0,
        status: 'PAID',
        notes: `Retail POS Checkout - ${paymentMethod}`,
        createdAt: new Date().toISOString(),
        auditEntry: auditLog,
      };

      // Atomic Repository Execution (Guarantees ACID transactions across sales, stock, and audit)
      await saleRepo.saveSaleAtomic(newSaleRecord);

      setLastCompletedSale(newSaleRecord);
      if (onSaleCompleted) {
        onSaleCompleted(newSaleRecord);
      }

      // Clear Cart
      setCart([]);
      setDiscountAmount(0);
      setAmountPaid(0);
      setCustomerName('လက်လီဝယ်သူ');
      setCustomerPhone('');

      alert(`လက်လီအရောင်း အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ!\nဘောင်ချာနံပါတ်: ${voucherNo}\nစုစုပေါင်း: ${formatMMK(grandTotal)}`);
    } catch (err: any) {
      console.error('Retail Sale Atomic Transaction Error:', err);
      alert(`လက်လီအရောင်း သိမ်းဆည်းရာတွင် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့သည်: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top POS Control Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
              <span>လက်လီအရောင်း (Retail POS)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Atomic Transaction
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              မြန်ဆန်သော Barcode/QR Scanning စနစ်နှင့် အလိုအလျောက် ပစ္စည်းလက်ကျန်/ငွေစာရင်း ချိန်ညှိမှု
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <QrCode className="w-4 h-4" />
            <span>Barcode/QR ဖတ်မည်</span>
          </button>

          {lastCompletedSale && (
            <button
              type="button"
              onClick={() => onOpenVoucher?.(lastCompletedSale)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>နောက်ဆုံးဘောင်ချာ ထုတ်မည်</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Retail POS Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Product Selection Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Category Filter */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ကုန်ပစ္စည်းအမည်၊ Barcode သို့မဟုတ် ကုတ်ဖြင့် ရှာရန်..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                အားလုံး ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                    selectedCategory === cat
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                ရှာဖွေမှုနှင့် ကိုက်ညီသော ကုန်ပစ္စည်း မရှိပါ
              </div>
            ) : (
              filteredProducts.map((p) => {
                const price = p.defaultPrice || p.defaultWholesalePrice || 0;
                const stock = p.currentStock || 0;
                const isLowStock = stock <= (p.minStockAlert || 5);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddToCart(p)}
                    className="p-3 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-400 rounded-2xl text-left transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between group space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {p.code || 'NO-CODE'}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                            isLowStock
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {stock} {p.unit}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-900 line-clamp-2 mt-1">
                        {p.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="font-extrabold text-xs text-slate-900">{formatMMK(price)}</span>
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 group-hover:bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                        +
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: POS Cart & Checkout Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  ဝယ်ယူသည့် စာရင်း ({cart.length} မျိုး)
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ဖျက်မည်</span>
                </button>
              )}
            </div>

            {/* Customer Info Form */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>ဝယ်သူအမည်</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>ဖုန်းနံပါတ်</span>
                </label>
                <input
                  type="text"
                  placeholder="09-xxxxxxxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  ဘယ်ဘက်မှ ကုန်ပစ္စည်းကို နှိပ်၍ တောင်းထဲသို့ ထည့်ပါ
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{item.product.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatMMK(item.unitPrice)} x {item.quantity} {item.product.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="px-2 py-1 text-slate-700 hover:bg-slate-100 cursor-pointer font-bold"
                        >
                          -
                        </button>
                        <span className="px-2 font-extrabold text-slate-900">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="px-2 py-1 text-slate-700 hover:bg-slate-100 cursor-pointer font-bold"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-extrabold text-slate-900 text-right w-16">
                        {formatMMK(item.subtotal)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Checkout Totals & Payment Section */}
          <div className="space-y-3 pt-3 border-t border-slate-200 text-xs">
            {/* Payment Method Selector */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">ငွေချေစနစ် ရွေးပါ</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['CASH', 'KPAY', 'WAVE', 'BANK'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1.5 rounded-lg font-bold border text-center cursor-pointer transition-all ${
                      paymentMethod === method
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculations Grid */}
            <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex justify-between text-slate-600">
                <span>စုစုပေါင်း ကျသင့်ငွေ:</span>
                <span className="font-bold">{formatMMK(cartSubtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>လျော့ဈေး (Discount):</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount === 0 ? '' : discountAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDiscountAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-24 px-2 py-0.5 bg-white border border-slate-300 rounded font-bold text-right focus:outline-none"
                  placeholder="0"
                />
              </div>

              <div className="flex justify-between font-extrabold text-sm text-slate-900 border-t border-slate-200 pt-1.5">
                <span>အသားတင် ကျသင့်ငွေ:</span>
                <span className="text-emerald-700">{formatMMK(grandTotal)}</span>
              </div>

              {paymentMethod === 'CASH' && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-bold">ပေးငွေ (Received)</label>
                    <input
                      type="number"
                      min="0"
                      value={amountPaid === 0 ? '' : amountPaid}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setAmountPaid(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-right focus:outline-none"
                      placeholder={grandTotal.toString()}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-bold">အပြန်ငွေ (Change)</label>
                    <div className="py-1 px-2 bg-emerald-100/70 border border-emerald-300 rounded font-extrabold text-emerald-900 text-right">
                      {formatMMK(changeAmount)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={isProcessing || cart.length === 0}
              onClick={handleCheckout}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span>စာရင်းသွင်းနေပါသည်...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <span>ရောင်းချမည် (Checkout - {formatMMK(grandTotal)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Barcode/QR Camera Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Barcode / QR Scanner</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div id={scannerContainerId} className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100"></div>
              <p className="text-xs text-slate-500 text-center font-medium">
                ဖုန်း/ကွန်ပျူတာ ကင်မရာရှေ့တွင် Barcode သို့မဟုတ် QR Code ကို တည့်တည့်ပြပေးပါ
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
