import React from 'react';
import { ActiveTab } from '../types';
import {
  ArrowDownLeft,
  Package,
  Truck,
  Building2,
  Users,
  History,
  FileText,
  Database,
  ShoppingBag,
  ArrowRightLeft,
  Boxes,
} from 'lucide-react';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  todayInboundCount: number;
  todaySalesCount: number;
  lowStockAlertCount: number;
  pendingOrdersCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  todayInboundCount,
  todaySalesCount,
  lowStockAlertCount,
  pendingOrdersCount = 0,
}) => {
  const navItems = [
    {
      id: 'daily' as ActiveTab,
      label: 'ကုန်သိမ်း',
      sublabel: 'Inbound',
      icon: ArrowDownLeft,
      badge: todayInboundCount > 0 ? todayInboundCount : undefined,
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'လက်ကျန်',
      sublabel: 'Stock',
      icon: Package,
      badge: lowStockAlertCount > 0 ? '!' : undefined,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'orders' as ActiveTab,
      label: 'အော်ဒါ',
      sublabel: 'Orders',
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      badgeColor: 'bg-indigo-600',
    },
    {
      id: 'sales' as ActiveTab,
      label: 'အရောင်း',
      sublabel: 'Sales',
      icon: Truck,
      badge: todaySalesCount > 0 ? todaySalesCount : undefined,
      badgeColor: 'bg-blue-600',
    },
    {
      id: 'purchases' as ActiveTab,
      label: 'ကုန်ကြမ်းဝယ်',
      sublabel: 'Purchases',
      icon: Boxes,
    },
    {
      id: 'peers' as ActiveTab,
      label: 'ကုန်ဖလှယ်',
      sublabel: 'Peers',
      icon: ArrowRightLeft,
    },
    {
      id: 'merchants' as ActiveTab,
      label: 'ကုန်သည်',
      sublabel: 'Merchants',
      icon: Building2,
    },
    {
      id: 'suppliers' as ActiveTab,
      label: 'ပေးသွင်းသူ',
      sublabel: 'Suppliers',
      icon: Users,
    },
    {
      id: 'history' as ActiveTab,
      label: 'မှတ်တမ်း',
      sublabel: 'History',
      icon: History,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'အစီရင်ခံစာ',
      sublabel: 'Reports',
      icon: FileText,
    },
    {
      id: 'backup' as ActiveTab,
      label: 'ဆက်တင်',
      sublabel: 'Backup',
      icon: Database,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg pb-safe">
      <div className="max-w-5xl mx-auto px-1 sm:px-2">
        <div className="flex items-center justify-between overflow-x-auto scrollbar-none py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-1.5 min-w-[58px] sm:flex-1 relative transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {item.badge !== undefined && (
                    <span
                      className={`absolute -top-1.5 -right-2 px-1 py-0.1 min-w-[15px] text-center ${
                        item.badgeColor || 'bg-emerald-600'
                      } text-white text-[10px] font-extrabold rounded-full shadow-2xs ${
                        item.id === 'orders' ? 'animate-bounce ring-1 ring-amber-400 bg-indigo-600' : ''
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] mt-1 leading-tight whitespace-nowrap">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0.5 w-6 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
