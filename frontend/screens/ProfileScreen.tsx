import React, { useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { ShieldCheck, ChevronDown, ChevronUp, Info, Settings, Activity, Check, Leaf, Beef, WheatOff } from 'lucide-react';

const ALLERGY_OPTIONS = ['nuts', 'dairy', 'gluten', 'shellfish', 'eggs', 'soy'];

const DIET_OPTIONS = [
  { id: 'none', label: 'No Restrictions', icon: Beef },
  { id: 'vegetarian', label: 'Vegetarian', icon: Leaf },
  { id: 'vegan', label: 'Vegan', icon: Leaf },
  { id: 'banting', label: 'Banting', icon: Beef },
  { id: 'halal', label: 'Halal', icon: ShieldCheck },
];

const ProfileScreen: React.FC = () => {
  const { profile, updateProfile, addToast } = useProfile();
  const [showInfo, setShowInfo] = useState(false);
  
  if (!profile) return null;

  const toggleAllergy = (allergy: string) => {
    const current = profile.preferences.allergies;
    const updated = current.includes(allergy)
      ? current.filter(a => a !== allergy)
      : [...current, allergy];
      
    updateProfile({
      ...profile,
      preferences: { ...profile.preferences, allergies: updated }
    });
    
    if (!current.includes(allergy)) {
      addToast(`Recipes will never include ${allergy}`);
    }
  };

  const updatePreference = (key: string, value: any) => {
    updateProfile({
      ...profile,
      preferences: { ...profile.preferences, [key]: value }
    });
  };

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="bg-[var(--navy)] pt-12 pb-6 px-6 shadow-md">
        <h1 className="text-2xl font-bold text-white">Dietary Specifications</h1>
        <p className="text-[var(--navy-tint)] mt-1 opacity-90 text-sm">Personalise your nutrition journey</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Connected Banner & Derived Stats */}
        <div className="discovery-card bg-gradient-to-br from-[#E8F3ED] to-[#D4EAD9] border border-[var(--healthy-green)] space-y-3">
          <div className="flex items-center text-[var(--healthy-green)] font-bold text-sm">
            <ShieldCheck size={20} className="mr-2" />
            Connected to Discovery HealthyFood Data
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--healthy-green)]/20 text-center">
            <div className="bg-white/80 p-2 rounded-lg">
              <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold">Avg Weekly</p>
              <p className="font-bold text-[var(--navy)] text-xs mt-0.5">R{profile.avg_weekly_spend}</p>
            </div>
            <div className="bg-white/80 p-2 rounded-lg">
              <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold">Retailer</p>
              <p className="font-bold text-[var(--navy)] text-xs mt-0.5">{profile.preferred_retailer}</p>
            </div>
            <div className="bg-white/80 p-2 rounded-lg">
              <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold">Healthy Spend</p>
              <p className="font-bold text-[var(--healthy-green)] text-xs mt-0.5">{profile.healthy_ratio}%</p>
            </div>
          </div>
        </div>

        {/* Profile Completeness Indicator */}
        <div className="discovery-card">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[var(--navy)] uppercase tracking-wider">Profile Completeness</span>
            <span className="text-xs font-bold text-[var(--teal)]">{profile.profile_completeness}%</span>
          </div>
          <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden">
            <div 
              className="bg-[var(--teal)] h-full rounded-full transition-all duration-500"
              style={{ width: `${profile.profile_completeness}%` }}
            />
          </div>
        </div>

        {/* Dietary Preference Cards */}
        <div className="discovery-card space-y-4">
          <h2 className="text-lg font-bold text-[var(--navy)] flex items-center border-b border-[var(--line)] pb-3">
            <Settings size={18} className="mr-2" /> Diet Selection
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">Select your primary diet to filter recipes and menus automatically.</p>
          
          <div className="grid grid-cols-2 gap-3">
            {DIET_OPTIONS.map(diet => {
              const isSelected = profile.preferences.diet === diet.id;
              const Icon = diet.icon;
              return (
                <button
                  key={diet.id}
                  onClick={() => updatePreference('diet', diet.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? 'bg-[var(--navy)] border-[var(--navy)] text-white shadow-md scale-[1.02]' 
                      : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--teal)]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <Icon size={20} className={isSelected ? 'text-[var(--teal)]' : 'text-[var(--ink-muted)]'} />
                    {isSelected && <Check size={16} className="text-[var(--teal)]" />}
                  </div>
                  <span className="font-bold text-sm">{diet.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Allergies */}
        <div className="discovery-card space-y-4">
          <h2 className="text-lg font-bold text-[var(--navy)] flex items-center border-b border-[var(--line)] pb-3">
            <WheatOff size={18} className="mr-2" /> Allergies & Exclusions
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">We will strictly exclude these from your recommendations.</p>
          
          <div className="flex flex-wrap gap-2">
            {ALLERGY_OPTIONS.map(allergy => {
              const isSelected = profile.preferences.allergies.includes(allergy);
              return (
                <button
                  key={allergy}
                  onClick={() => toggleAllergy(allergy)}
                  className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors flex items-center ${
                    isSelected 
                      ? 'bg-[var(--alert-red)] text-white border-[var(--alert-red)] shadow-sm' 
                      : 'bg-[var(--bg)] text-[var(--ink-muted)] border-[var(--line)]'
                  }`}
                >
                  {isSelected && <Check size={14} className="mr-1.5" />}
                  <span className="capitalize">{allergy}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Other Preferences */}
        <div className="discovery-card space-y-5">
          <h2 className="text-lg font-bold text-[var(--navy)] flex items-center border-b border-[var(--line)] pb-3">
            <Activity size={18} className="mr-2" /> Household & Training Goals
          </h2>

          {/* Training Goal */}
          <div>
            <label className="block text-sm font-bold text-[var(--ink)] mb-1">Training & Health Goal</label>
            <p className="text-xs text-[var(--ink-muted)] mb-3">Adjusts nutrient ratios for recipes</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'general', label: 'General' },
                { id: 'build', label: '💪 Build' },
                { id: 'lean', label: '🏃 Lean' },
              ].map(g => (
                <button
                  key={g.id}
                  onClick={() => updatePreference('training_goal', g.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                    profile.preferences.training_goal === g.id
                      ? 'bg-[var(--navy)] text-white border-[var(--navy)] shadow-sm'
                      : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--teal)]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Household Size */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
            <div>
              <label className="block text-sm font-bold text-[var(--ink)]">Household Size</label>
              <p className="text-xs text-[var(--ink-muted)]">Scales recipe servings</p>
            </div>
            <div className="flex items-center bg-[var(--bg)] border border-[var(--line)] rounded-lg w-fit">
              <button onClick={() => updatePreference('household_size', Math.max(1, profile.preferences.household_size - 1))} className="px-4 py-2 text-[var(--navy)] font-bold text-lg">-</button>
              <span className="px-4 font-bold text-[var(--ink)]">{profile.preferences.household_size}</span>
              <button onClick={() => updatePreference('household_size', profile.preferences.household_size + 1)} className="px-4 py-2 text-[var(--navy)] font-bold text-lg">+</button>
            </div>
          </div>

          {/* Heritage Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
            <div>
              <p className="text-sm font-bold text-[var(--ink)]">Heritage Discovery Cards</p>
              <p className="text-xs text-[var(--ink-muted)]">Show traditional recipes on celebration days</p>
            </div>
            <button 
              onClick={() => updatePreference('heritage_optin', !profile.preferences.heritage_optin)}
              className={`w-12 h-6 rounded-full transition-colors relative ${profile.preferences.heritage_optin ? 'bg-[var(--teal)]' : 'bg-[var(--line)]'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${profile.preferences.heritage_optin ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Health Classification Info */}
        <div className="discovery-card">
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="w-full flex justify-between items-center text-left"
          >
            <div className="flex items-center">
              <Info size={18} className="text-[var(--navy)] mr-2" />
              <span className="font-bold text-[var(--navy)] text-sm">How we classify food</span>
            </div>
            {showInfo ? <ChevronUp size={18} className="text-[var(--ink-muted)]" /> : <ChevronDown size={18} className="text-[var(--ink-muted)]" />}
          </button>
          
          {showInfo && (
            <div className="mt-4 space-y-3 text-sm border-t border-[var(--line)] pt-3 animate-slide-up">
              <p className="text-xs text-[var(--ink-muted)] mb-3">Based on Discovery HealthyFood catalogue categories. Your health score is the share of basket spend in healthy categories.</p>
              <div>
                <span className="font-bold text-[var(--healthy-green)] flex items-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--healthy-green)] mr-2"></div> Healthy
                </span>
                <p className="text-[var(--ink-muted)] text-xs pl-4">Whole grains & high-fibre starches, Animal protein, Fruit & vegetables, Dairy, Legumes, Oils/nuts/seeds.</p>
              </div>
              <div>
                <span className="font-bold text-[var(--alert-red)] flex items-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--alert-red)] mr-2"></div> Flagged
                </span>
                <p className="text-[var(--ink-muted)] text-xs pl-4">Sugary foods, Sugary drinks, High-fat baked & fried, High-salt snacks & condiments.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
