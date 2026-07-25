import React, { useEffect, useState } from 'react';
import { getCommunity } from '../api';
import { CommunityResponse } from '../types';
import { useProfile } from '../context/ProfileContext';
import { Users, Calendar, CheckCircle } from 'lucide-react';

const TogetherScreen: React.FC = () => {
  const { profile, addToast } = useProfile();
  const [community, setCommunity] = useState<CommunityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cooked, setCooked] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const loadData = async () => {
      const data = await getCommunity(profile.customer_id);
      setCommunity(data);
      setCooked(data.active_challenge.you_cooked);
      setLoading(false);
    };
    loadData();
  }, [profile]);

  if (loading || !community) return <div className="p-6 text-[var(--ink-muted)] font-medium">Loading community...</div>;

  const active = community.active_challenge;
  const progressPct = Math.min(100, Math.round((active.collective_done / active.collective_goal) * 100));

  const handleCooked = () => {
    setCooked(true);
    addToast("Meal counted! Your neighbourhood is 1 closer 🎉");
  };

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="bg-[var(--navy)] pt-12 pb-6 px-6 shadow-md">
        <h1 className="text-2xl font-bold text-white">Cook Together</h1>
        <p className="text-[var(--navy-tint)] mt-1 opacity-90 text-sm leading-relaxed">
          Collaborative cook-alongs with your neighbourhood — everyone who joins in wins.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Active Challenge Hero Card */}
        <div className="bg-gradient-to-br from-[var(--navy)] to-[var(--navy-deep)] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="bg-[var(--teal)] text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">
              Active Now
            </span>
            <div className="flex items-center text-sm font-medium opacity-90">
              <Calendar size={14} className="mr-1" /> {active.days_left} days left
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2 relative z-10">{active.name}</h2>
          <p className="text-[var(--navy-tint)] text-sm mb-6 relative z-10">{active.theme}</p>

          <div className="bg-white/10 rounded-xl p-4 mb-6 backdrop-blur-sm relative z-10">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span>Our neighbourhood goal</span>
              <span>{active.collective_done + (cooked ? 1 : 0)}/{active.collective_goal} meals</span>
            </div>
            <div className="w-full bg-black/20 h-2.5 rounded-full overflow-hidden mb-3">
              <div 
                className="bg-[var(--healthy-green)] h-full rounded-full transition-all duration-1000" 
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-[var(--navy-tint)] opacity-90">
              When we reach {active.collective_goal} healthy meals, everyone earns <span className="text-[var(--gold)] font-bold">+{active.bonus_points} Vitality points</span>.
            </p>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex -space-x-2">
              {active.neighbours.slice(0, 4).map((initials, idx) => (
                <div key={idx} className="w-8 h-8 rounded-full bg-[var(--bg)] text-[var(--navy)] border-2 border-[var(--navy-deep)] flex items-center justify-center text-[10px] font-bold">
                  {initials}
                </div>
              ))}
              <div className="w-8 h-8 rounded-full bg-[var(--teal)] text-white border-2 border-[var(--navy-deep)] flex items-center justify-center text-[10px] font-bold">
                +{active.participants - 4}
              </div>
            </div>
            
            {cooked ? (
              <button className="bg-[var(--healthy-green)] text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center">
                <CheckCircle size={16} className="mr-1.5" /> Your meal is counted
              </button>
            ) : (
              <button onClick={handleCooked} className="bg-white text-[var(--navy)] font-bold py-2 px-4 rounded-lg text-sm shadow-sm hover:bg-[var(--navy-tint)] transition-colors">
                👨‍🍳 I cooked my dish
              </button>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[var(--navy)] flex items-center">
            <Users size={18} className="mr-2" /> Neighbourhood Activity
          </h3>
          <div className="discovery-card space-y-4">
            {active.recent_activity.map((act, idx) => (
              <div key={idx} className="flex items-start border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-[var(--navy-tint)] text-[var(--navy)] flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0">
                  {act.who.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm text-[var(--ink)]"><span className="font-bold">{act.who}</span> {act.what}</p>
                  <p className="text-xs text-[var(--ink-muted)] mt-0.5">{act.when}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-[var(--navy)]">Coming Up</h3>
          {community.upcoming.map((up, idx) => (
            <div key={idx} className="discovery-card border-l-4 border-l-[var(--teal)]">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-[var(--ink)]">{up.name}</h4>
                <span className="text-xs font-bold text-[var(--teal)] bg-[#E6F6FA] px-2 py-0.5 rounded">Starts {up.starts}</span>
              </div>
              <p className="text-sm text-[var(--ink-muted)]">{up.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-[var(--ink-muted)] italic px-4 pt-4">
          Cook-alongs are collaborative, not competitive. Everyone who takes part earns the reward together.
        </p>
      </div>
    </div>
  );
};

export default TogetherScreen;
