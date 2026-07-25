import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile } from '../types';
import { getProfile } from '../api';
import { useAuth } from './AuthContext';

interface ToastMessage {
  id: number;
  message: string;
}

interface ProfileContextType {
  profile: Profile | null;
  updateProfile: (updated: Profile) => void;
  addToast: (message: string) => void;
  refreshProfile: () => Promise<void>;

  // AI Assistant State
  isAIOpen: boolean;
  aiInitialMessage: string;
  openAI: (initialMessage?: string) => void;
  closeAI: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // AI State
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState('');

  const refreshProfile = async () => {
    if (!user?.customer_id) return;
    try {
      const data = await getProfile(user.customer_id);
      setProfile(data);
    } catch (e) {
      console.warn('refreshProfile failed', e);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [user?.customer_id]);

  const updateProfile = (updated: Profile) => {
    setProfile(updated);
  };

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const openAI = (initialMessage: string = '') => {
    setAiInitialMessage(initialMessage);
    setIsAIOpen(true);
  };

  const closeAI = () => {
    setIsAIOpen(false);
    setAiInitialMessage('');
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, addToast, refreshProfile, isAIOpen, aiInitialMessage, openAI, closeAI }}>
      {children}
      {/* Toast Container */}
      <div className="absolute bottom-24 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none space-y-2 px-4">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-[var(--navy-deep)] text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up flex items-center w-full max-w-sm">
            {toast.message}
          </div>
        ))}
      </div>
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
