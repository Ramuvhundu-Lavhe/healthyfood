import React, { useEffect, useState, useRef } from 'react';
import { getRecipes, getPantry, getSavedRecipes, saveRecipe, unsaveRecipe, recordCooked } from '../api';
import { Recipe } from '../types';
import { useProfile } from '../context/ProfileContext';
import { Clock, CheckCircle, AlertTriangle, AlertCircle, X, ShoppingBasket, Zap, Target, Users, ShieldCheck, Info, RefreshCw, Filter, Flame, PiggyBank, Sparkles, ChevronDown, Search, Wand2, Bot, Heart } from 'lucide-react';

// Bi-directional substring match for "is this ingredient in the pantry?"
function ingredientInPantry(ingName: string, pantryNames: string[]): boolean {
  const i = String(ingName || '').toLowerCase().trim();
  if (!i) return false;
  return pantryNames.some(p => {
    const pn = p.toLowerCase().trim();
    return pn.includes(i) || i.includes(pn);
  });
}

// Native-select dropdown styled to match the pill chips. Native selects avoid
// the overflow-clip bug the custom dropdown had inside the horizontal scroller,
// and give us free keyboard + mobile-picker support.
const CustomDropdown = ({ value, options, onChange, icon: Icon, labelPrefix = "" }: any) => (
  <div className="relative flex-shrink-0">
    {Icon && (
      <Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`appearance-none bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] py-1.5 rounded-full text-xs font-bold hover:border-[var(--teal)] focus:border-[var(--teal)] outline-none transition-colors cursor-pointer ${Icon ? 'pl-8' : 'pl-3'} pr-7`}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {labelPrefix}{opt.label}
        </option>
      ))}
    </select>
    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
  </div>
);

const RecipesScreen: React.FC = () => {
  const { profile, addToast, openAI } = useProfile();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [pantryNames, setPantryNames] = useState<string[]>([]);
  const [viewingSaved, setViewingSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState("🔍 AI Agent searching web & matching pantry...");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [selectedMissing, setSelectedMissing] = useState<Recipe | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [markingCooked, setMarkingCooked] = useState(false);
  
  // Context Bar State
  const [powerOn, setPowerOn] = useState(profile?.preferences.power_available ?? true);
  const [goal, setGoal] = useState(profile?.preferences.training_goal ?? 'general');
  const [event, setEvent] = useState(profile?.preferences.upcoming_event?.type ?? 'none');
  const [diet, setDiet] = useState(profile?.preferences.diet ?? 'all');
  const [servings, setServings] = useState(profile?.preferences.household_size ?? 4);

  const fetchRecipes = async (searchPrompt?: string) => {
    if (!profile) return;
    setLoading(true);
    
    // Animate agent status messages for realistic feedback
    setAgentStatus(searchPrompt ? `🔍 AI Agent searching web for "${searchPrompt}"...` : "🔍 AI Agent scanning pantry & web recipes...");
    
    const statusTimer1 = setTimeout(() => {
      setAgentStatus("👩‍🍳 Synthesizing custom tailored recipes...");
    }, 400);

    const statusTimer2 = setTimeout(() => {
      setAgentStatus("📸 Generating matching dish visual depictions...");
    }, 800);

    try {
      const data = await getRecipes(profile.customer_id, {
        power: powerOn,
        goal,
        event,
        diet,
        search: searchPrompt ?? searchQuery,
        refresh: Date.now()
      });
      setRecipes(data.recipes);
      if (searchPrompt !== undefined) {
        setActiveSearchTerm(searchPrompt);
      }
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(statusTimer1);
      clearTimeout(statusTimer2);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!viewingSaved) fetchRecipes();
  }, [profile, powerOn, goal, event, diet]);

  // Load pantry + saved recipes once we know the customer
  useEffect(() => {
    if (!profile) return;
    getPantry(profile.customer_id).then(p => setPantryNames(p.items.map(i => i.name)));
    refreshSaved();
  }, [profile?.customer_id]);

  const refreshSaved = async () => {
    if (!profile) return;
    const data = await getSavedRecipes(profile.customer_id);
    setSavedRecipes(data.items);
    setSavedNames(new Set(data.items.map(r => String(r.name).toLowerCase().trim())));
  };

  const toggleSave = async (recipe: Recipe) => {
    if (!profile) return;
    const key = recipe.name.toLowerCase().trim();
    const isCurrentlySaved = savedNames.has(key);
    // Optimistic UI
    setSavedNames(prev => {
      const next = new Set(prev);
      if (isCurrentlySaved) next.delete(key); else next.add(key);
      return next;
    });
    if (isCurrentlySaved) {
      addToast(`Removed "${recipe.name}" from saved`);
      await unsaveRecipe(profile.customer_id, recipe.name);
    } else {
      addToast(`Saved "${recipe.name}"`);
      await saveRecipe(profile.customer_id, recipe);
    }
    refreshSaved();
  };

  if (!profile) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    fetchRecipes(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearchTerm("");
    fetchRecipes("");
  };

  const handleCooked = async () => {
    if (!viewRecipe || !profile || markingCooked) return;
    setMarkingCooked(true);
    try {
      await recordCooked(profile.customer_id, viewRecipe.name, viewRecipe.ingredients.map(i => i.name));
      addToast("Marked as cooked — future recipes will lean this way 🎉");
    } finally {
      setMarkingCooked(false);
      setViewRecipe(null);
    }
  };

  const handleAddToList = () => {
    setSelectedMissing(null);
    addToast("Items added to shopping list");
  };

  const handleAskAI = (recipeName: string) => {
    openAI(`Can you give me some tips on how to perfectly prepare the ${recipeName}?`);
  };

  // Which list are we rendering?
  const activeList = viewingSaved ? savedRecipes : recipes;

  // Group recipes by prep_time_category
  const groupedRecipes = activeList.reduce((acc, recipe) => {
    const cat = recipe.prep_time_category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(recipe);
    return acc;
  }, {} as Record<string, Recipe[]>);

  const dietOptions = [
    { value: 'all', label: 'All Diets' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'banting', label: 'Banting' },
    { value: 'halal', label: 'Halal' }
  ];

  const goalOptions = [
    { value: 'general', label: 'General' },
    { value: 'build', label: '💪 Build' },
    { value: 'lean', label: '🏃 Lean' }
  ];

  const eventOptions = [
    { value: 'none', label: 'None' },
    { value: 'marathon', label: '🏅 Marathon' },
    { value: 'match', label: '⚽ Match' },
    { value: 'hike', label: '🥾 Hike' }
  ];

  return (
    <div className="pb-28 relative min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-[var(--navy)] pt-10 pb-5 px-6 shadow-md z-10">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              What can I cook?
            </h1>
            <p className="text-[var(--navy-tint)] mt-1 opacity-90 text-xs">AI Agent recipe generation & web search · matched visuals</p>
          </div>
          <button 
            onClick={() => fetchRecipes(searchQuery)}
            disabled={loading}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors border border-white/20"
            title="Generate fresh AI recipes"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            AI Refresh
          </button>
        </div>

        {/* AI Agent & Web Search Form */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--navy-tint)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask AI agent or search web (e.g. winter soup, high protein)..."
              className="w-full bg-black/20 border border-white/20 rounded-full pl-9 pr-8 py-2 text-xs text-white placeholder:text-[var(--navy-tint)]/70 focus:outline-none focus:border-[var(--teal)] transition-colors"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--navy-tint)] hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--teal)] hover:bg-[#0092A6] text-white px-3.5 py-2 rounded-full text-xs font-bold flex items-center transition-colors shadow-sm"
          >
            <Wand2 size={13} className="mr-1.5" />
            Generate
          </button>
        </form>
      </div>

      {/* Context Bar */}
      <div className="bg-white border-b border-[var(--line)] px-4 py-3 flex space-x-2 overflow-x-auto hide-scrollbar shadow-sm z-10 sticky top-0">
        <button
          onClick={() => setViewingSaved(!viewingSaved)}
          className={`flex-shrink-0 flex items-center px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
            viewingSaved ? 'bg-[var(--alert-red)] text-white border-[var(--alert-red)]' : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)]'
          }`}
        >
          <Heart size={13} className={`mr-1.5 ${viewingSaved ? 'fill-white' : ''}`} />
          Saved ({savedRecipes.length})
        </button>
        <button
          onClick={() => setPowerOn(!powerOn)}
          className={`flex-shrink-0 flex items-center px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
            !powerOn ? 'bg-[var(--navy)] text-white border-[var(--navy)]' : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)]'
          }`}
        >
          <Zap size={14} className="mr-1.5" />
          {!powerOn ? 'Load-shedding' : 'Power On'}
        </button>

        <CustomDropdown value={diet} options={dietOptions} onChange={setDiet} icon={Filter} />
        <CustomDropdown value={goal} options={goalOptions} onChange={setGoal} labelPrefix="Goal: " />
        <CustomDropdown value={event} options={eventOptions} onChange={setEvent} labelPrefix="Event: " />
      </div>

      {/* Active Search Badge */}
      {activeSearchTerm && (
        <div className="mx-6 mt-4 bg-gradient-to-r from-[var(--navy)] to-[#1E293B] text-white rounded-lg p-3 flex justify-between items-center shadow-sm animate-fade-in">
          <div className="flex items-center text-xs font-medium">
            <Bot size={16} className="text-[var(--teal)] mr-2 flex-shrink-0" />
            <span>AI Agent Results for: <strong className="text-[var(--teal)]">"{activeSearchTerm}"</strong></span>
          </div>
          <button onClick={handleClearSearch} className="text-white/70 hover:text-white text-xs font-bold underline ml-2">
            Reset
          </button>
        </div>
      )}

      {/* Event Info Card */}
      {event !== 'none' && (
        <div className="mx-6 mt-4 bg-[#E6F6FA] border border-[var(--teal)] rounded-lg p-3 flex items-start animate-fade-in">
          <Info size={16} className="text-[var(--teal)] mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[var(--ink)] font-medium">
            Event mode: {event} coming up — recipes favour slow-release carbohydrates.
          </p>
        </div>
      )}

      {/* Content */}
      <div className="p-6 space-y-8 flex-1">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#E6F6FA] text-[var(--teal)] flex items-center justify-center animate-bounce shadow-md">
              <Sparkles size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[var(--navy)] animate-pulse">{agentStatus}</p>
              <p className="text-xs text-[var(--ink-muted)]">Using Gemini AI agent & recipe search to match dish contents</p>
            </div>
          </div>
        ) : activeList.length === 0 ? (
          <div className="text-center text-[var(--ink-muted)] py-10">
            {viewingSaved ? (
              <>
                <Heart size={32} className="mx-auto text-[var(--line)] mb-2" />
                <p className="font-bold text-[var(--ink)]">No saved recipes yet</p>
                <p className="text-sm mt-1">Tap the ♥ on any recipe to save it here.</p>
                <button onClick={() => setViewingSaved(false)} className="text-[var(--teal)] font-bold mt-3 underline">Browse recipes</button>
              </>
            ) : (
              <>
                <p>No recipes found matching your prompt and filters.</p>
                <button onClick={handleClearSearch} className="text-[var(--teal)] font-bold mt-2 underline">Clear Search & Filters</button>
              </>
            )}
          </div>
        ) : (
          Object.entries(groupedRecipes).map(([category, categoryRecipes]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-lg font-bold text-[var(--navy)] border-b border-[var(--line)] pb-2 flex justify-between items-center">
                <span>{category}</span>
                <span className="text-xs font-normal text-[var(--ink-muted)] flex items-center">
                  <Bot size={12} className="mr-1 text-[var(--teal)]" /> AI matched dish photos
                </span>
              </h2>
              {categoryRecipes.map((recipe, idx) => (
                <div key={idx} className="discovery-card overflow-hidden p-0 flex flex-col">
                  <div className="h-44 w-full relative bg-slate-100">
                    <img
                      src={recipe.photo}
                      alt={recipe.name}
                      className="w-full h-full object-cover transition-opacity duration-300"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          `https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80`;
                      }}
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        onClick={() => toggleSave(recipe)}
                        className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:scale-110 transition-transform"
                        aria-label={savedNames.has(recipe.name.toLowerCase().trim()) ? 'Unsave' : 'Save'}
                      >
                        <Heart
                          size={16}
                          className={savedNames.has(recipe.name.toLowerCase().trim())
                            ? 'text-[var(--alert-red)] fill-[var(--alert-red)]'
                            : 'text-[var(--ink-muted)]'
                          }
                        />
                      </button>
                      <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md flex items-center text-xs font-bold text-[var(--ink)] shadow-sm">
                        <Clock size={12} className="mr-1" /> {recipe.cook_time_minutes}m
                      </div>
                    </div>
                    {/* Diet Tags Overlay */}
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                      {recipe.diet_tags.map(tag => (
                        <span key={tag} className="bg-[var(--navy)]/80 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div>
                      <h3 className="font-bold text-[var(--navy)] text-lg leading-tight mb-2">{recipe.name}</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-[var(--bg)] text-[var(--ink-muted)] text-[10px] font-bold px-2 py-1 rounded border border-[var(--line)] uppercase tracking-wider">
                          {recipe.cooking_method}
                        </span>
                        {recipe.uses_expiring && (
                          <span className="bg-[#FFFDF5] text-[var(--amber)] text-[10px] font-bold px-2 py-1 rounded border border-[var(--amber)] uppercase tracking-wider">
                            Uses expiring items
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats Row: Calories & Savings */}
                    <div className="flex items-center space-x-4 text-xs font-bold text-[var(--ink-muted)]">
                      <div className="flex items-center">
                        <Flame size={14} className="text-[var(--alert-red)] mr-1" />
                        {recipe.calories} kcal
                      </div>
                      <div className="flex items-center text-[var(--healthy-green)]">
                        <PiggyBank size={14} className="mr-1" />
                        Saves R{recipe.budget_savings_rand}
                      </div>
                    </div>

                    {/* Status Chip */}
                    <div>
                      {recipe.all_in_pantry ? (
                        <span className="inline-flex items-center bg-[#E8F3ED] text-[var(--healthy-green)] text-xs font-bold px-2.5 py-1 rounded-full">
                          <CheckCircle size={12} className="mr-1" /> All items in pantry
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-[#FFFDF5] border border-[var(--amber)] text-[var(--amber)] text-xs font-bold px-2.5 py-1 rounded-full">
                          <AlertTriangle size={12} className="mr-1" /> Needs {recipe.missing_items.length} item{recipe.missing_items.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[var(--ink)] italic border-l-2 border-[var(--teal)] pl-3 bg-[var(--bg)] py-2 pr-2 rounded-r-lg">
                      "{recipe.health_benefit}"
                    </p>

                    {/* Allergen Safety */}
                    {recipe.allergy_safe && profile.preferences.allergies.length > 0 && (
                      <div className="flex items-center text-[var(--healthy-green)] text-xs font-medium">
                        <ShieldCheck size={14} className="mr-1" /> Safe for your allergies
                      </div>
                    )}

                    <div className="flex space-x-3 pt-2 mt-auto">
                      <button onClick={() => setViewRecipe(recipe)} className="discovery-btn-primary flex-1 text-sm py-2.5">
                        View recipe
                      </button>
                      {!recipe.all_in_pantry && (
                        <button 
                          onClick={() => setSelectedMissing(recipe)}
                          className="discovery-btn-secondary flex-1 text-sm py-2.5"
                        >
                          Missing items?
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Missing Items Modal */}
      {selectedMissing && (
        <div className="absolute inset-0 z-50 flex items-end bg-[var(--navy-deep)] bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white w-full rounded-t-3xl p-6 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--navy)]">Missing Items</h2>
              <button onClick={() => setSelectedMissing(null)} className="p-2 bg-[var(--bg)] rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)]">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 mb-8">
              {selectedMissing.missing_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-[var(--line)] pb-3 last:border-0">
                  <div>
                    <p className="font-bold text-[var(--ink)]">{item.name}</p>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">Available at <span className="font-semibold">{item.retailer}</span></p>
                  </div>
                  {item.is_healthyfood && (
                    <span className="bg-[#E8F3ED] text-[var(--healthy-green)] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[var(--healthy-green)]">
                      HealthyFood
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button 
              onClick={handleAddToList}
              className="w-full bg-[var(--healthy-green)] text-white font-bold py-3.5 rounded-xl flex items-center justify-center shadow-md"
            >
              <ShoppingBasket size={18} className="mr-2" /> Add to shopping list
            </button>
          </div>
        </div>
      )}

      {/* View Recipe Modal */}
      {viewRecipe && (
        <div className="absolute inset-0 z-50 flex flex-col bg-white animate-slide-up overflow-hidden">
          <div className="relative h-64 flex-shrink-0">
            <img
              src={viewRecipe.photo}
              alt={viewRecipe.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent"></div>
            <button onClick={() => setViewRecipe(null)} className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white p-2 rounded-full">
              <X size={24} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 pb-28">
            <h2 className="text-2xl font-bold text-[var(--navy)] mb-2">{viewRecipe.name}</h2>
            <div className="flex items-center text-[var(--ink-muted)] text-sm font-medium mb-6">
              <Clock size={16} className="mr-1" /> {viewRecipe.cook_time_minutes} mins
              <span className="mx-3">•</span>
              <span className="uppercase tracking-wider text-xs">{viewRecipe.cooking_method}</span>
              <span className="mx-3">•</span>
              <Flame size={14} className="text-[var(--alert-red)] mr-1" /> {viewRecipe.calories} kcal
            </div>

            <div className="flex items-center justify-between bg-[var(--bg)] p-4 rounded-xl mb-8 border border-[var(--line)]">
              <span className="font-bold text-[var(--ink)]">Servings</span>
              <div className="flex items-center bg-white border border-[var(--line)] rounded-lg">
                <button onClick={() => setServings(Math.max(1, servings - 1))} className="px-4 py-1.5 text-[var(--navy)] font-bold text-lg">-</button>
                <span className="px-4 font-bold text-[var(--ink)]">{servings}</span>
                <button onClick={() => setServings(servings + 1)} className="px-4 py-1.5 text-[var(--navy)] font-bold text-lg">+</button>
              </div>
            </div>

            {/* Ingredients Section — red-flag anything NOT in the pantry */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--navy)]">Ingredients</h3>
              <div className="flex items-center text-[10px] font-bold text-[var(--ink-muted)] gap-3">
                <span className="flex items-center"><CheckCircle size={11} className="text-[var(--healthy-green)] mr-1" /> In pantry</span>
                <span className="flex items-center"><AlertCircle size={11} className="text-[var(--alert-red)] mr-1" /> Need to buy</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              {viewRecipe.ingredients.map((ing, idx) => {
                const inPantry = ingredientInPantry(ing.name, pantryNames);
                return (
                  <li key={idx} className={`flex flex-col p-3 rounded-lg border ${
                    inPantry
                      ? 'bg-[var(--bg)] border-[var(--line)]'
                      : 'bg-[#FFE9E4] border-[var(--alert-red)]/40'
                  }`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        {inPantry
                          ? <CheckCircle size={16} className="text-[var(--healthy-green)] mr-2 flex-shrink-0" />
                          : <AlertCircle size={16} className="text-[var(--alert-red)] mr-2 flex-shrink-0" />}
                        <div>
                          <span className={`font-bold ${inPantry ? 'text-[var(--ink)]' : 'text-[var(--alert-red)]'}`}>{ing.amount}</span>
                          <span className={`ml-2 ${inPantry ? 'text-[var(--ink)]' : 'text-[var(--alert-red)] font-semibold'}`}>{ing.name}</span>
                        </div>
                      </div>
                      {!inPantry && (
                        <span className="text-[10px] font-bold bg-[var(--alert-red)] text-white px-2 py-0.5 rounded">BUY</span>
                      )}
                    </div>
                    {ing.alternative && (
                      <div className="mt-2 flex items-start text-xs">
                        <RefreshCw size={12} className="text-[var(--teal)] mr-1.5 mt-0.5 flex-shrink-0" />
                        <span className="text-[var(--ink-muted)]">
                          <span className="font-bold text-[var(--teal)]">Alternative:</span> {ing.alternative}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Instructions Section */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--navy)]">Instructions</h3>
              <button 
                onClick={() => handleAskAI(viewRecipe.name)}
                className="flex items-center text-xs font-bold text-[var(--teal)] bg-[#E6F6FA] px-3 py-1.5 rounded-full"
              >
                <Sparkles size={12} className="mr-1" /> Ask AI for tips
              </button>
            </div>
            <div className="space-y-4">
              {viewRecipe.steps.map((step, idx) => (
                <div key={idx} className="flex">
                  <div className="w-6 h-6 rounded-full bg-[var(--navy-tint)] text-[var(--navy)] flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-[var(--ink)] leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-[var(--line)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex gap-2">
            <button
              onClick={() => toggleSave(viewRecipe)}
              className={`px-4 py-3.5 rounded-lg border-2 font-bold flex items-center justify-center transition-colors ${
                savedNames.has(viewRecipe.name.toLowerCase().trim())
                  ? 'border-[var(--alert-red)] text-[var(--alert-red)] bg-[#FFE9E4]'
                  : 'border-[var(--line)] text-[var(--ink)] bg-white'
              }`}
              aria-label="Save recipe"
            >
              <Heart size={20} className={savedNames.has(viewRecipe.name.toLowerCase().trim()) ? 'fill-[var(--alert-red)]' : ''} />
            </button>
            <button onClick={handleCooked} disabled={markingCooked} className="flex-1 discovery-btn-primary py-3.5 text-lg disabled:opacity-60">
              {markingCooked ? 'Logging…' : '👨‍🍳 I cooked this'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipesScreen;
