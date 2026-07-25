import React, { useEffect, useState } from 'react';
import { HeritageResponse } from '../types';
import { getHeritage } from '../api';
import { useProfile } from '../context/ProfileContext';
import CircularProgress from '../components/CircularProgress';
import { CheckCircle, Lock, ArrowUp, Sparkles, X, Heart, ChevronRight } from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { profile } = useProfile();
  const [heritage, setHeritage] = useState<HeritageResponse | null>(null);
  const [showHeritage, setShowHeritage] = useState(true);

  useEffect(() => {
    if (profile?.preferences.heritage_optin) {
      getHeritage().then(setHeritage);
    }
  }, [profile?.preferences.heritage_optin]);

  if (!profile) return null;

  const earnedMilestone = profile.milestones.find(m => m.earned);
  const lockedMilestone = profile.milestones.find(m => !m.earned);

  return (
    <div className="pb-28">
      {/* Header Area */}
      <div className="bg-gradient-to-b from-[var(--navy-deep)] to-[var(--navy)] pt-12 pb-8 px-6 rounded-b-3xl shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[var(--navy-tint)] text-sm font-medium opacity-80">Good morning,</p>
            <h1 className="text-2xl font-bold text-white">
              {profile.name.split(' ')[0]}
            </h1>
            <p className="text-[var(--teal)] text-xs font-medium mt-1">HealthyFood Companion · {profile.preferred_retailer} shopper</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white text-[var(--navy)] flex items-center justify-center text-lg font-bold shadow-inner">
            {profile.name.charAt(0)}
          </div>
        </div>
      </div>

      <div className="px-6 -mt-6 space-y-6">
        {/* Health Score Section */}
        <div className="discovery-card flex flex-col items-center justify-center py-8">
          <CircularProgress score={profile.health_score} />
          {profile.trend === 'up' && (
            <div className="mt-6 flex items-center text-[var(--healthy-green)] font-bold bg-[#E8F3ED] px-4 py-1.5 rounded-full text-sm">
              <ArrowUp size={16} className="mr-1" />
              +{profile.score_change} from last month
            </div>
          )}
        </div>

        {/* AI Nudge Card */}
        <div className="discovery-card border-l-4 border-l-[var(--teal)] flex items-start">
          <div className="bg-[#E6F6FA] p-2 rounded-full mr-4 mt-1 flex-shrink-0">
            <Sparkles className="text-[var(--teal)]" size={20} />
          </div>
          <p className="text-[var(--ink)] leading-relaxed text-sm font-medium">
            {profile.nudge_text}
          </p>
        </div>

        {/* Heritage / Celebration Card */}
        {showHeritage && heritage?.celebration && heritage.dish && (
          <div className="discovery-card bg-gradient-to-br from-[#FFFDF5] to-[#FFF9E6] border-[var(--gold)] relative overflow-hidden p-0">
            <div className="h-32 w-full relative">
              <img 
                src={heritage.dish.photo} 
                alt={heritage.dish.name} 
                className="w-full h-full object-cover" 
                loading="lazy" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=800&q=80'; }} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <button 
                onClick={() => setShowHeritage(false)}
                className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/20 rounded-full p-1"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-3 left-4 flex items-center">
                <Heart className="text-[var(--alert-red)] mr-2" size={16} fill="currentColor" />
                <span className="text-xs font-bold text-white uppercase tracking-wider shadow-sm">
                  {heritage.celebration}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-[var(--ink)] text-lg mb-1">Have you heard of {heritage.dish.name}?</h3>
              <p className="text-sm text-[var(--ink-muted)] mb-3 leading-relaxed">
                {heritage.dish.context}
              </p>
              <div className="bg-white rounded-lg p-3 text-sm border border-[var(--line)]">
                <div className="flex items-start text-[var(--healthy-green)] font-medium">
                  <CheckCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                  <span>You already have: {heritage.dish.ingredients_have.join(', ')}</span>
                </div>
              </div>
              <div className="mt-4 flex space-x-3">
                <button onClick={() => onNavigate('recipes')} className="discovery-btn-primary flex-1 text-sm py-2.5">See recipe</button>
                <button onClick={() => setShowHeritage(false)} className="discovery-btn-secondary flex-1 text-sm py-2.5">Not now</button>
              </div>
            </div>
          </div>
        )}

        {/* Milestones Preview */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-[var(--navy)]">Your Milestones</h2>
            <button onClick={() => onNavigate('progress')} className="text-[var(--teal)] text-sm font-bold flex items-center">
              View all <ChevronRight size={16} />
            </button>
          </div>
          
          {earnedMilestone && (
            <div className="discovery-card flex items-center">
              <div className="bg-[#E8F3ED] p-2.5 rounded-full mr-4">
                <CheckCircle className="text-[var(--healthy-green)]" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-[var(--ink)]">{earnedMilestone.name}</h3>
                <div className="flex items-center mt-1">
                  <span className="text-xs font-bold bg-[#FFF9E6] text-[var(--gold)] px-2 py-0.5 rounded-full border border-[var(--gold)]">
                    +{earnedMilestone.points} pts
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {lockedMilestone && (
            <div className="discovery-card flex items-center opacity-90">
              <div className="bg-[var(--bg)] p-2.5 rounded-full mr-4">
                <Lock className="text-[var(--ink-muted)]" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[var(--ink)]">{lockedMilestone.name}</h3>
                <p className="text-xs text-[var(--ink-muted)] mb-2 font-medium">
                  You're at {lockedMilestone.progress_pct}% — almost there!
                </p>
                <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-[var(--teal)] h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${lockedMilestone.progress_pct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
