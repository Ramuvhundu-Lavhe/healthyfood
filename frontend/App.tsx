import React, { useState } from 'react';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import PantryScreen from './screens/PantryScreen';
import RecipesScreen from './screens/RecipesScreen';
import ShoppingListScreen from './screens/ShoppingListScreen';
import TogetherScreen from './screens/TogetherScreen';
import ProgressScreen from './screens/ProgressScreen';
import ProfileScreen from './screens/ProfileScreen';
import AIAssistant from './components/AIAssistant';
import { ProfileProvider } from './context/ProfileContext';

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
    <div className="max-w-[480px] mx-auto h-[100dvh] bg-[var(--bg)] relative shadow-2xl flex flex-col overflow-hidden text-[var(--ink)] font-sans">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto hide-scrollbar relative">
        {renderScreen()}
      </div>
      
      {/* AI Assistant FAB & Modal */}
      <AIAssistant />

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ProfileProvider>
      <AppContent />
    </ProfileProvider>
  );
};

export default App;
