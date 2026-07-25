import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, LogIn } from 'lucide-react';

interface LoginScreenProps {
  onSwitchToSignup: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToSignup }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter a username and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-[var(--navy-deep)] to-[var(--navy)] flex flex-col">
      <div className="pt-16 pb-8 px-6 text-center">
        <div className="inline-flex bg-white/10 p-3 rounded-2xl mb-4">
          <Sparkles className="text-[var(--teal)]" size={28} />
        </div>
        <h1 className="text-3xl font-bold text-white">HealthyFood</h1>
        <p className="text-[var(--navy-tint)] mt-1 text-sm">Your personal food companion</p>
      </div>

      <div className="flex-1 bg-[var(--bg)] rounded-t-3xl px-6 pt-8 pb-10">
        <h2 className="text-2xl font-bold text-[var(--ink)]">Welcome back</h2>
        <p className="text-[var(--ink-muted)] text-sm mt-1 mb-6">Log in to see your pantry, recipes and shopping list.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--ink-muted)] uppercase tracking-wide">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full mt-1 px-4 py-3 bg-white border border-[var(--line)] rounded-xl focus:border-[var(--teal)] outline-none text-[var(--ink)]"
              placeholder="e.g. aisha"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--ink-muted)] uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-white border border-[var(--line)] rounded-xl focus:border-[var(--teal)] outline-none text-[var(--ink)]"
              placeholder="At least 6 characters"
            />
          </div>

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
            <LogIn size={18} className="mr-2" />
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--ink-muted)]">
          New here?{' '}
          <button onClick={onSwitchToSignup} className="text-[var(--teal)] font-bold">Create an account</button>
        </div>

        <div className="mt-8 bg-white rounded-xl border border-[var(--line)] p-3">
          <p className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wide mb-1">Demo login</p>
          <p className="text-sm text-[var(--ink)]"><span className="font-bold">aisha</span> / <span className="font-bold">demo123</span> — full transaction history</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
