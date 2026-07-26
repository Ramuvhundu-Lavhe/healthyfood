import React from 'react';
import { Home, ShoppingBasket, ChefHat, ShoppingCart, Users, TrendingUp, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'pantry', label: 'Pantry', icon: ShoppingBasket },
    { id: 'recipes', label: 'Recipes', icon: ChefHat },
    { id: 'shopping', label: 'Shop', icon: ShoppingCart },
    { id: 'together', label: 'Group', icon: Users },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'profile', label: 'Me', icon: User },
  ];

  return (
    <div className="absolute bottom-0 w-full bg-[var(--navy)] h-[76px] pb-4 z-50 shadow-[0_-4px_20px_rgba(0,47,108,0.15)]">
      {/* Cap inner width on tablet+ so tabs don't stretch across a huge desktop viewport */}
      <div className="h-full max-w-3xl mx-auto flex justify-around items-center px-1 md:px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-[var(--teal)]' : 'text-[var(--navy-tint)] opacity-70'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-medium md:text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
