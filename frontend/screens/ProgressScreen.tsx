import React, { useEffect, useState } from 'react';
import { getProgress } from '../api';
import { ProgressResponse } from '../types';
import { useProfile } from '../context/ProfileContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Star, CheckCircle, Lock, TrendingUp, ShoppingBag, PiggyBank, Sparkles, Leaf, ArrowLeftRight } from 'lucide-react';

const ProgressScreen: React.FC = () => {
  const { profile } = useProfile();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const loadData = async () => {
      const data = await getProgress(profile.customer_id);
      setProgress(data);
      setLoading(false);
    };
    loadData();
  }, [profile]);

  if (loading || !progress || !profile) return <div className="p-6 text-[var(--ink-muted)] font-medium">Loading progress...</div>;

  const pieData = [
    { name: 'Healthy', value: progress.basket_split.healthy_spend },
    { name: 'Less Healthy', value: progress.basket_split.unhealthy_spend }
  ];
  const COLORS = ['var(--healthy-green)', 'var(--alert-red)'];
  const totalSpend = progress.basket_split.healthy_spend + progress.basket_split.unhealthy_spend;
  const healthyPct = Math.round((progress.basket_split.healthy_spend / totalSpend) * 100);

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="bg-[var(--navy)] pt-12 pb-6 px-6 shadow-md flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">My Progress</h1>
          <p className="text-[var(--navy-tint)] mt-1 opacity-90 text-sm">Keep up the good work!</p>
        </div>
      </div>

      {/* Vitality Banner */}
      <div className="bg-gradient-to-r from-[#C9A227] to-[#E8C347] px-6 py-3 flex items-center justify-center text-white shadow-sm">
        <Star size={20} className="mr-2 fill-current" />
        <span className="font-bold">{progress.total_vitality_points} Vitality points earned</span>
      </div>

      <div className="p-6 space-y-6">
        {/* Savings — headline value card */}
        {progress.savings && (
          <div className="discovery-card" style={{ background: 'linear-gradient(150deg, #002F6C 0%, #001B40 100%)', border: 'none' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--teal)' }}>
                Your savings this month
              </span>
              <PiggyBank size={18} color="var(--teal)" />
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-extrabold text-white">R{progress.savings.total}</span>
              <span className="text-sm text-white/70">saved by eating well</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white/90">
                  <Sparkles size={15} color="var(--teal)" /> HealthyFood cashback
                </span>
                <span className="font-bold text-white">R{progress.savings.healthyfood_cashback}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white/90">
                  <Leaf size={15} color="#4ADE80" /> Waste avoided
                </span>
                <span className="font-bold text-white">R{progress.savings.waste_avoided}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white/90">
                  <ArrowLeftRight size={15} color="#FBBF24" /> Smart swaps
                </span>
                <span className="font-bold text-white">R{progress.savings.smart_swaps}</span>
              </div>
            </div>

            {progress.monthly_savings_trend && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                <div className="flex items-end justify-between gap-2" style={{ height: 44 }}>
                  {progress.monthly_savings_trend.map((m) => {
                    const max = Math.max(...progress.monthly_savings_trend!.map(x => x.amount));
                    const h = Math.round((m.amount / max) * 38) + 4;
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <div style={{ width: '70%', height: h, background: 'var(--teal)', borderRadius: 4, opacity: 0.85 }} />
                        <span className="text-[10px] text-white/60">{m.month}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-white/60 text-center mt-2">
                  Your savings grow as your healthy habits do
                </p>
              </div>
            )}
          </div>
        )}

        {/* Line Chart: Health Score */}
        <div className="discovery-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-[var(--navy)]">Health Score Trend</h2>
            <span className="text-xs font-bold text-[var(--healthy-green)] bg-[#E8F3ED] px-2 py-1 rounded">Improving</span>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progress.weekly_scores} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-muted)', fontSize: 12, fontWeight: 500 }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-muted)', fontSize: 12, fontWeight: 500 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: 'var(--navy)', fontWeight: 'bold' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="var(--navy)" 
                  strokeWidth={4}
                  dot={{ r: 4, fill: 'var(--navy)', strokeWidth: 2, stroke: 'white' }}
                  activeDot={{ r: 6, fill: 'var(--teal)', stroke: 'white' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Basket Split */}
        <div className="discovery-card">
          <h2 className="text-lg font-bold text-[var(--navy)] mb-2">This week's basket</h2>
          <div className="flex items-center justify-between">
            <div className="h-[120px] w-[120px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={40}
                    outerRadius={55}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-lg font-bold text-[var(--navy)]">{healthyPct}%</span>
              </div>
            </div>
            <div className="flex-1 pl-6 space-y-3">
              <div>
                <div className="flex items-center text-sm font-bold text-[var(--ink)]">
                  <div className="w-3 h-3 rounded-full bg-[var(--healthy-green)] mr-2"></div>
                  Healthy
                </div>
                <p className="text-xs text-[var(--ink-muted)] ml-5 font-medium">R {progress.basket_split.healthy_spend}</p>
              </div>
              <div>
                <div className="flex items-center text-sm font-bold text-[var(--ink)]">
                  <div className="w-3 h-3 rounded-full bg-[var(--alert-red)] mr-2"></div>
                  Less healthy
                </div>
                <p className="text-xs text-[var(--ink-muted)] ml-5 font-medium">R {progress.basket_split.unhealthy_spend}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--ink-muted)]">HealthyFood adoption:</span>
            <span className="font-bold text-[var(--healthy-green)] flex items-center">
              {progress.healthyfood_adoption_pct}% <TrendingUp size={14} className="ml-1" />
            </span>
          </div>
        </div>

        {/* Smart Shopping List */}
        {progress.shopping_list.length > 0 && (
          <div className="discovery-card border-[var(--teal)]">
            <h2 className="text-lg font-bold text-[var(--navy)] mb-3 flex items-center">
              <ShoppingBag size={18} className="mr-2" /> Smart Shopping List
            </h2>
            <div className="space-y-2">
              {progress.shopping_list.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[var(--bg)] p-3 rounded-lg">
                  <div>
                    <p className="font-semibold text-[var(--ink)] text-sm">{item.name}</p>
                    <p className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider mt-0.5">{item.retailer}</p>
                  </div>
                  {item.is_healthyfood && (
                    <span className="bg-[#E8F3ED] text-[var(--healthy-green)] text-[10px] font-bold px-2 py-1 rounded-full border border-[var(--healthy-green)]">
                      HealthyFood
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones List */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--navy)]">All Milestones</h2>
          <div className="space-y-3">
            {profile.milestones.map((milestone) => (
              <div 
                key={milestone.id} 
                className={`discovery-card flex items-start p-4 ${!milestone.earned ? 'opacity-80 bg-[var(--bg)] border-transparent' : ''}`}
              >
                <div className={`p-2.5 rounded-full mr-4 flex-shrink-0 ${milestone.earned ? 'bg-[#E8F3ED]' : 'bg-white border border-[var(--line)]'}`}>
                  {milestone.earned ? (
                    <CheckCircle className="text-[var(--healthy-green)]" size={20} />
                  ) : (
                    <Lock className="text-[var(--ink-muted)]" size={20} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-[var(--ink)] text-sm">{milestone.name}</h3>
                    {milestone.earned && (
                      <span className="text-[10px] font-bold bg-[#FFF9E6] text-[var(--gold)] px-2 py-0.5 rounded-full border border-[var(--gold)]">
                        +{milestone.points} pts
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] mb-2">{milestone.desc}</p>
                  
                  {!milestone.earned && (
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-[var(--ink-muted)] mb-1">
                        <span>Progress</span>
                        <span>{milestone.progress_pct}%</span>
                      </div>
                      <div className="w-full bg-[var(--line)] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[var(--teal)] h-full rounded-full" 
                          style={{ width: `${milestone.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressScreen;
