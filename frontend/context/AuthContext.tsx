import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthResponse, register as apiRegister, login as apiLogin, getMe } from '../api';
import { Preferences } from '../types';

interface AuthUser {
  username: string;
  customer_id: string;
  name: string;
  preferences: Preferences;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: {
    username: string;
    password: string;
    name: string;
    preferences: Partial<Preferences>;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const persistAuth = (r: AuthResponse) => {
  try {
    localStorage.setItem('hf_token', r.token);
    localStorage.setItem('hf_user', JSON.stringify({
      username: '', // filled in on rehydrate via /auth/me
      customer_id: r.customer_id,
      name: r.name,
      preferences: r.preferences,
    }));
  } catch (_) { /* storage disabled */ }
};

const clearAuth = () => {
  try {
    localStorage.removeItem('hf_token');
    localStorage.removeItem('hf_user');
  } catch (_) { /* noop */ }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token exists, try to hydrate the current user
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const token = localStorage.getItem('hf_token');
        if (!token) return;
        const me = await getMe();
        if (!cancelled) setUser({
          username: me.username,
          customer_id: me.customer_id,
          name: me.name,
          preferences: me.preferences,
        });
      } catch (_) {
        clearAuth();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    bootstrap();
    // If no token, we're not loading anything — flip immediately
    if (!localStorage.getItem('hf_token')) setLoading(false);
    return () => { cancelled = true; };
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiLogin({ username, password });
    persistAuth(res);
    setUser({ username, customer_id: res.customer_id, name: res.name, preferences: res.preferences });
  };

  const register = async (input: {
    username: string;
    password: string;
    name: string;
    preferences: Partial<Preferences>;
  }) => {
    const res = await apiRegister(input);
    persistAuth(res);
    setUser({
      username: input.username,
      customer_id: res.customer_id,
      name: res.name,
      preferences: res.preferences,
    });
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
