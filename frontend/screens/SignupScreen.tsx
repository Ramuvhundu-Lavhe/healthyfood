import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, UserPlus, Check } from 'lucide-react';
import { Preferences } from '../types';

interface SignupScreenProps {
  onSwitchToLogin: () => void;
}

const ALLERGEN_OPTIONS = ['dairy', 'nuts', 'eggs', 'gluten', 'soy', 'fish', 'shellfish', 'seafood'];
const DIET_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'none', label: 'No restriction', desc: 'Everything welcome' },
  { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat or fish' },
  { value: 'vegan', label: 'Vegan', desc: 'No animal products' },
  { value: 'halal', label: 'Halal', desc: 'Halal-compliant meals' },
  { value: 'diabetic', label: 'Diabetic', desc: 'Low-GI, low-sugar' },
  { value: 'banting', label: 'Banting / Low-carb', desc: 'High-fat, low-carb' },
];
const BUDGET_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'low', label: 'Tight', desc: 'R150/week groceries' },
  { value: 'medium', label: 'Moderate', desc: 'R300/week' },
  { value: 'high', label: 'Comfortable', desc: 'R500+/week' },
];

const SignupScreen: React.FC<SignupScreenProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [diet, setDiet] = useState('none');
  const [householdSize, setHouseholdSize] = useState(2);
  const [budgetTier, setBudgetTier] = useState('medium');
  const [powerAvailable, setPowerAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAllergy = (a: string) => {
    setAllergies(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const preferences: Partial<Preferences> = {
        allergies,
        diet,
        household_size: householdSize,
        budget_tier: budgetTier,
        power_available: powerAvailable,
      };
      await register({
        username: username.trim(),
        password,
        name: name.trim() || username.trim(),
        preferences,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Signup failed. Try a different username.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-[var(--navy-deep)] to-[var(--navy)] flex flex-col">
      <div className="pt-12 pb-6 px-6 text-center">
        <div className="inline-flex bg-white/10 p-3 rounded-2xl mb-3">
          <Sparkles className="text-[var(--teal)]" size={24} />
        </div>
        <h1 className="text-2xl font-bold text-white">Create your profile</h1>
        <p className="text-[var(--navy-tint)] mt-1 text-sm">Tell us how you eat — we'll never suggest anything unsafe.</p>
      </div>

      <div className="flex-1 bg-[var(--bg)] rounded-t-3xl px-6 pt-6 pb-10 overflow-y-auto md:px-8">
        <div className="w-full md:max-w-lg md:mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account */}
          <div>
            <h3 className="text-xs uppercase tracking-wide font-bold text-[var(--ink-muted)] mb-2">Account</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Username"
                className="w-full px-4 py-3 bg-white border border-[var(--line)] rounded-xl focus:border-[var(--teal)] outline-none"
              />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Display name (optional)"
                className="w-full px-4 py-3 bg-white border border-[var(--line)] rounded-xl focus:border-[var(--teal)] outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password (min 6 chars)"
                className="w-full px-4 py-3 bg-white border border-[var(--line)] rounded-xl focus:border-[var(--teal)] outline-none"
              />
            </div>
          </div>

          {/* Allergies */}
          <div>
            <h3 className="text-xs uppercase tracking-wide font-bold text-[var(--ink-muted)] mb-2">Allergies — nothing containing these will ever be suggested</h3>
            <div className="flex flex-wrap gap-2">
              {ALLERGEN_OPTIONS.map(a => {
                const active = allergies.includes(a);
                return (
                  <button
                    type="button"
                    key={a}
                    onClick={() => toggleAllergy(a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                      active
                        ? 'bg-[var(--alert-red)] text-white border-[var(--alert-red)]'
                        : 'bg-white text-[var(--ink)] border-[var(--line)]'
                    }`}
                  >
                    {active && <Check size={12} className="inline mr-1" />}
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diet */}
          <div>
            <h3 className="text-xs uppercase tracking-wide font-bold text-[var(--ink-muted)] mb-2">Diet</h3>
            <div className="grid grid-cols-2 gap-2">
              {DIET_OPTIONS.map(d => {
                const active = diet === d.value;
                return (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => setDiet(d.value)}
                    className={`text-left px-3 py-2 rounded-xl border-2 transition-colors ${
                      active
                        ? 'border-[var(--teal)] bg-[#E6F6FA]'
                        : 'border-[var(--line)] bg-white'
                    }`}
                  >
                    <div className={`text-sm font-bold ${active ? 'text-[var(--navy)]' : 'text-[var(--ink)]'}`}>{d.label}</div>
                    <div className="text-[10px] text-[var(--ink-muted)]">{d.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Household + Budget */}
          <div>
            <h3 className="text-xs uppercase tracking-wide font-bold text-[var(--ink-muted)] mb-2">Household</h3>
            <div className="flex items-center bg-white border border-[var(--line)] rounded-xl px-3 py-2">
              <span className="text-sm text-[var(--ink-muted)] flex-1">People to cook for</span>
              <button type="button" onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))} className="w-8 h-8 bg-[var(--bg)] rounded-full font-bold text-[var(--navy)]">−</button>
              <span className="w-8 text-center font-bold text-[var(--ink)]">{householdSize}</span>
              <button type="button" onClick={() => setHouseholdSize(Math.min(10, householdSize + 1))} className="w-8 h-8 bg-[var(--bg)] rounded-full font-bold text-[var(--navy)]">+</button>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wide font-bold text-[var(--ink-muted)] mb-2">Grocery budget</h3>
            <div className="grid grid-cols-3 gap-2">
              {BUDGET_OPTIONS.map(b => {
                const active = budgetTier === b.value;
                return (
                  <button
                    type="button"
                    key={b.value}
                    onClick={() => setBudgetTier(b.value)}
                    className={`text-left px-3 py-2 rounded-xl border-2 transition-colors ${
                      active
                        ? 'border-[var(--teal)] bg-[#E6F6FA]'
                        : 'border-[var(--line)] bg-white'
                    }`}
                  >
                    <div className={`text-sm font-bold ${active ? 'text-[var(--navy)]' : 'text-[var(--ink)]'}`}>{b.label}</div>
                    <div className="text-[10px] text-[var(--ink-muted)]">{b.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Load-shedding */}
          <label className="flex items-center bg-white border border-[var(--line)] rounded-xl px-3 py-3">
            <input type="checkbox" checked={powerAvailable} onChange={e => setPowerAvailable(e.target.checked)} className="w-4 h-4 mr-3 accent-[var(--teal)]" />
            <div className="flex-1">
              <div className="text-sm font-bold text-[var(--ink)]">I usually have power / gas when cooking</div>
              <div className="text-[11px] text-[var(--ink-muted)]">Uncheck for load-shedding-aware suggestions</div>
            </div>
          </label>

          {error && (
            <div className="bg-[#FFE9E4] border border-[var(--alert-red)]/30 text-[var(--alert-red)] text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full discovery-btn-primary flex items-center justify-center disabled:opacity-50"
          >
            <UserPlus size={18} className="mr-2" />
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--ink-muted)]">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-[var(--teal)] font-bold">Log in</button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default SignupScreen;
