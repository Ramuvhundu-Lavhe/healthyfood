import React, { useState } from 'react';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import PantryScreen from './screens/PantryScreen';
import RecipesScreen from './screens/RecipesScreen';
import ShoppingListScreen from './screens/ShoppingListScreen';
import TogetherScreen from './screens/TogetherScreen';
import ProgressScreen from './screens/ProgressScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import AIAssistant from './components/AIAssistant';
import { ProfileProvider } from './context/ProfileContext';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen onNavigate={setActiveTab} />;
      case 'pantry':
        return <PantryScreen onNavigateToRecipes={() => setActiveTab('recipes')} />;
      case 'recipes':
        return <RecipesScreen />;
      case 'shopping':
        return <ShoppingListScreen />;
      case 'together':
        return <TogetherScreen />;
      case 'progress':
        return <ProgressScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto hide-scrollbar relative">
        {renderScreen()}
      </div>
      <AIAssistant />
      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
};

const AuthGate: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  return (
    <div className="flex-1 overflow-y-auto hide-scrollbar">
      {mode === 'login'
        ? <LoginScreen onSwitchToSignup={() => setMode('signup')} />
        : <SignupScreen onSwitchToLogin={() => setMode('login')} />}
    </div>
  );
};

const Shell: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--ink-muted)]">
        Loading…
      </div>
    );
  }

  return user ? (
    <ProfileProvider>
      <AppContent />
    </ProfileProvider>
  ) : <AuthGate />;
};

// Responsive app frame:
//   Phone (<768px):  constrained 480px width, phone-in-frame look with shadow
//   Tablet (≥768px): fills viewport up to 768px, no shadow, immersive
//   Desktop (≥1024px): fills viewport up to 1152px
const App: React.FC = () => {
  return (
    <div className="mx-auto h-[100dvh] bg-[var(--bg)] relative flex flex-col overflow-hidden text-[var(--ink)] font-sans max-w-[480px] shadow-2xl md:max-w-3xl md:shadow-none lg:max-w-6xl">
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </div>
  );
};

export default App;
