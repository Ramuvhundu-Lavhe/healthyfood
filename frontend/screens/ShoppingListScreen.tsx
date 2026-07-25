import React, { useEffect, useState } from 'react';
import { ShoppingListResponse, ShoppingListItem } from '../types';
import { getShoppingList } from '../api';
import { useProfile } from '../context/ProfileContext';
import { ShoppingCart, AlertTriangle, Check, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const PRIORITY_STYLES: Record<ShoppingListItem['priority'], { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  high: { bg: '#FFE9E4', text: '#C8442E', icon: <AlertTriangle size={11} />, label: 'URGENT' },
  medium: { bg: '#FFF8E6', text: '#B7871A', icon: <ShoppingCart size={11} />, label: 'RECIPE' },
  low: { bg: '#E6F6FA', text: '#007A94', icon: <Sparkles size={11} />, label: 'BOOST' },
};

const BUDGET_STYLES: Record<ShoppingListResponse['budget_status'], { color: string; icon: React.ReactNode; label: string }> = {
  under: { color: 'var(--healthy-green)', icon: <TrendingDown size={16} />, label: 'Under budget' },
  at: { color: 'var(--amber)', icon: <Minus size={16} />, label: 'On budget' },
  over: { color: 'var(--alert-red)', icon: <TrendingUp size={16} />, label: 'Over budget' },
};

const ShoppingListScreen: React.FC = () => {
  const { profile, addToast } = useProfile();
  const [list, setList] = useState<ShoppingListResponse | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    getShoppingList(profile.customer_id).then(setList);
  }, [profile?.customer_id]);

  const toggle = (name: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        addToast(`Got "${name}" — nice one`);
      }
      return next;
    });
  };

  if (!list) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-24 bg-white rounded-2xl animate-pulse" />
        <div className="h-16 bg-white rounded-2xl animate-pulse" />
        <div className="h-16 bg-white rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Group by category for aisle-style presentation
  const byCategory: Record<string, ShoppingListItem[]> = {};
  list.items.forEach(i => {
    (byCategory[i.category] ||= []).push(i);
  });
  const categories = Object.keys(byCategory);

  const budget = BUDGET_STYLES[list.budget_status];
  const remainingCost = list.items
    .filter(i => !checked.has(i.name))
    .reduce((s, i) => s + i.estimated_cost, 0);
  const completedCount = checked.size;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="bg-gradient-to-b from-[var(--navy-deep)] to-[var(--navy)] pt-12 pb-8 px-6 rounded-b-3xl shadow-md">
        <div className="flex items-center mb-1">
          <ShoppingCart className="text-[var(--teal)] mr-2" size={22} />
          <h1 className="text-2xl font-bold text-white">Shopping List</h1>
        </div>
        <p className="text-[var(--navy-tint)] text-sm opacity-80">Smart-picked from your pantry gaps and expiring items</p>
      </div>

      <div className="px-6 -mt-6 space-y-6">
        {/* Budget summary */}
        <div className="discovery-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-[var(--ink-muted)] font-medium uppercase tracking-wide">Estimated total</p>
              <p className="text-3xl font-bold text-[var(--ink)]">
                R{remainingCost.toFixed(0)}
                {completedCount > 0 && (
                  <span className="text-xs font-normal text-[var(--ink-muted)] ml-2">
                    (of R{list.total_cost.toFixed(0)} · {completedCount} in cart)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${budget.color}22`, color: budget.color }}>
              {budget.icon}
              <span className="ml-1">{budget.label}</span>
            </div>
          </div>
          <div className="w-full h-2 bg-[var(--bg)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (remainingCost / list.budget_target) * 100)}%`,
                backgroundColor: budget.color,
              }}
            />
          </div>
          <p className="text-[11px] text-[var(--ink-muted)] mt-2">
            Weekly target: R{list.budget_target} · Based on your {profile?.preferences.budget_tier || 'medium'} budget tier
          </p>
        </div>

        {/* Priority note */}
        {list.priority_note && (
          <div className="discovery-card border-l-4 border-l-[var(--amber)] flex items-start">
            <div className="bg-[#FFF8E6] p-2 rounded-full mr-3 mt-0.5 flex-shrink-0">
              <AlertTriangle className="text-[var(--amber)]" size={16} />
            </div>
            <p className="text-[var(--ink)] leading-relaxed text-sm">{list.priority_note}</p>
          </div>
        )}

        {/* Aisles */}
        {categories.map(cat => (
          <div key={cat}>
            <h3 className="text-xs uppercase tracking-wide font-bold text-[var(--ink-muted)] mb-2 px-1">{cat}</h3>
            <div className="discovery-card p-0 overflow-hidden">
              {byCategory[cat].map((item, idx) => {
                const done = checked.has(item.name);
                const style = PRIORITY_STYLES[item.priority];
                return (
                  <button
                    key={item.name}
                    onClick={() => toggle(item.name)}
                    className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                      idx > 0 ? 'border-t border-[var(--line)]' : ''
                    } ${done ? 'bg-[#F8FBF9]' : 'hover:bg-[var(--bg)]'}`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center flex-shrink-0 transition-colors ${
                      done ? 'bg-[var(--healthy-green)] border-[var(--healthy-green)]' : 'border-[var(--line)]'
                    }`}>
                      {done && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className={`font-semibold text-sm ${done ? 'line-through text-[var(--ink-muted)]' : 'text-[var(--ink)]'}`}>
                          {item.name}
                        </span>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center"
                          style={{ backgroundColor: style.bg, color: style.text }}
                        >
                          {style.icon}
                          <span className="ml-1">{style.label}</span>
                        </span>
                        {item.is_healthyfood && (
                          <span className="text-[9px] font-bold text-[var(--teal)] bg-[#E6F6FA] px-1.5 py-0.5 rounded">HF</span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-0.5 ${done ? 'text-[var(--ink-muted)] line-through' : 'text-[var(--ink-muted)]'}`}>{item.reason}</p>
                    </div>
                    <div className={`text-sm font-bold ml-2 ${done ? 'text-[var(--ink-muted)] line-through' : 'text-[var(--ink)]'}`}>
                      R{item.estimated_cost}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {list.items.length === 0 && (
          <div className="discovery-card text-center py-8">
            <Check size={32} className="text-[var(--healthy-green)] mx-auto mb-2" />
            <p className="font-bold text-[var(--ink)]">Nothing urgent to buy</p>
            <p className="text-sm text-[var(--ink-muted)] mt-1">Your pantry is well-stocked. Come back after your next cook.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShoppingListScreen;
