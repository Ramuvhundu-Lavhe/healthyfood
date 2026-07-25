import React, { useEffect, useState, useRef, useMemo } from 'react';
import { getRecipes, getPantry, getSavedRecipes, saveRecipe, unsaveRecipe, recordCooked, addToShoppingList } from '../api';
import { Recipe } from '../types';
import { useProfile } from '../context/ProfileContext';
import StyledDropdown, { DropdownOption } from '../components/StyledDropdown';
import { Clock, CheckCircle, AlertTriangle, AlertCircle, X, ShoppingBasket, Zap, Target, ShieldCheck, Info, RefreshCw, Filter, Flame, PiggyBank, Sparkles, Search, Bot, Heart, Beef, Leaf, WheatOff, Dumbbell, Feather, Trophy, Flag, Mountain, Minus, Send } from 'lucide-react';

// Bi-directional substring match for "is this ingredient in the pantry?"
function ingredientInPantry(ingName: string, pantryNames: string[]): boolean {
  const i = String(ingName || '').toLowerCase().trim();
  if (!i) return false;
  return pantryNames.some(p => {
    const pn = p.toLowerCase().trim();
    return pn.includes(i) || i.includes(pn);
  });
}

// Check whether this ingredient triggers any of the user's allergies. Handles
// the named allergen groups (nuts / shellfish / fish / dairy / gluten / soy / eggs).
function ingredientAllergen(ingName: string, allergies: string[]): string | null {
  const n = String(ingName || '').toLowerCase();
  for (const a of allergies) {
    const al = a.toLowerCase().trim();
    if (!al) continue;
    if (n.includes(al)) return a;
    if (al === 'nuts' && /peanut|almond|cashew|walnut|pecan|pistachio|hazelnut|macadamia/.test(n)) return a;
    if (al === 'shellfish' && /prawn|shrimp|mussel|crab|lobster|calamari|oyster|clam/.test(n)) return a;
    if ((al === 'fish' || al === 'seafood') && /sardine|pilchard|tuna|mackerel|hake|snoek|salmon|anchovy/.test(n)) return a;
    if (al === 'dairy' && /milk|cheese|yog(h)?urt|cream|butter|whey|casein/.test(n)) return a;
    if (al === 'gluten' && /wheat|bread|pasta|flour|barley|couscous|bulgar/.test(n)) return a;
    if (al === 'eggs' && /\begg\b/.test(n)) return a;
    if (al === 'soy' && /soy|soya|tofu|edamame|tempeh/.test(n)) return a;
  }
  return null;
}

const SkeletonRecipeCard: React.FC = () => (
  <div className="discovery-card overflow-hidden p-0 animate-pulse">
    <div className="h-44 w-full bg-[var(--line)]/60" />
    <div className="p-4 space-y-3">
      <div className="h-5 w-3/4 bg-[var(--line)]/60 rounded" />
      <div className="flex gap-2">
        <div className="h-4 w-16 bg-[var(--line)]/50 rounded-full" />
        <div className="h-4 w-20 bg-[var(--line)]/50 rounded-full" />
      </div>
      <div className="h-4 w-1/2 bg-[var(--line)]/50 rounded" />
      <div className="h-10 w-full bg-[var(--line)]/40 rounded-lg" />
    </div>
  </div>
);


const RecipesScreen: React.FC = () => {
  const { profile, addToast, openAI } = useProfile();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [emptyPantry, setEmptyPantry] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [pantryNames, setPantryNames] = useState<string[]>([]);
  const [viewingSaved, setViewingSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState("Building recipes from your pantry...");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [selectedMissing, setSelectedMissing] = useState<Recipe | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [markingCooked, setMarkingCooked] = useState(false);
  // Memoize recipe results per filter combination so flipping back is instant
  const cacheRef = useRef<Map<string, Recipe[]>>(new Map());
  
  // Context Bar State
  const [powerOn, setPowerOn] = useState(profile?.preferences.power_available ?? true);
  const [goal, setGoal] = useState(profile?.preferences.training_goal ?? 'general');
  const [event, setEvent] = useState(profile?.preferences.upcoming_event?.type ?? 'none');
  const [diet, setDiet] = useState(profile?.preferences.diet ?? 'all');
  const [servings, setServings] = useState(profile?.preferences.household_size ?? 4);

  const fetchRecipes = async (searchPrompt?: string, force = false) => {
    if (!profile) return;
    const effectiveSearch = searchPrompt ?? searchQuery;
    const cacheKey = `${diet}|${goal}|${event}|${powerOn}|${effectiveSearch}`;

    // Cache hit — instant, no API call, no reflow
    if (!force && cacheRef.current.has(cacheKey)) {
      setRecipes(cacheRef.current.get(cacheKey)!);
      if (searchPrompt !== undefined) setActiveSearchTerm(searchPrompt);
      setLoading(false);
      return;
    }

    setLoading(true);
    setAgentStatus(effectiveSearch ? `Searching for "${effectiveSearch}"...` : "Building recipes from your pantry...");

    const statusTimer1 = setTimeout(() => setAgentStatus("Applying your diet, allergies & goals..."), 500);
    const statusTimer2 = setTimeout(() => setAgentStatus("Matching dish photos..."), 1200);

    try {
      const data: any = await getRecipes(profile.customer_id, {
        power: powerOn,
        goal,
        event,
        diet,
        search: effectiveSearch,
        refresh: force ? Date.now() : undefined,
      });
      cacheRef.current.set(cacheKey, data.recipes || []);
      setRecipes(data.recipes || []);
      setEmptyPantry(!!data.empty_pantry);
      if (searchPrompt !== undefined) setActiveSearchTerm(searchPrompt);
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
      addToast("Marked as cooked — future recipes will lean this way");
    } finally {
      setMarkingCooked(false);
      setViewRecipe(null);
    }
  };

  const [addingToList, setAddingToList] = useState(false);

  const handleAddToList = async () => {
    if (!selectedMissing || !profile || addingToList) return;
    const items = selectedMissing.missing_items.map(m => ({
      name: m.name,
      retailer: m.retailer,
      is_healthyfood: m.is_healthyfood,
      source_recipe: selectedMissing.name,
    }));
    if (!items.length) { setSelectedMissing(null); return; }
    setAddingToList(true);
    try {
      const res = await addToShoppingList(profile.customer_id, items);
      if (res.ok) {
        addToast(res.added > 0
          ? `${res.added} item${res.added === 1 ? '' : 's'} added to your shopping list`
          : `All ${items.length} items were already on your list`);
      } else {
        addToast('Could not update shopping list — please try again');
      }
    } finally {
      setAddingToList(false);
      setSelectedMissing(null);
    }
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

  const dietOptions: DropdownOption[] = [
    { value: 'all',        label: 'All Diets',   icon: Beef },
    { value: 'vegetarian', label: 'Vegetarian',  icon: Leaf },
    { value: 'vegan',      label: 'Vegan',       icon: Leaf },
    { value: 'banting',    label: 'Banting',     icon: WheatOff },
    { value: 'halal',      label: 'Halal',       icon: ShieldCheck },
  ];

  const goalOptions: DropdownOption[] = [
    { value: 'general', label: 'General', icon: Target },
    { value: 'build',   label: 'Build',   icon: Dumbbell },
    { value: 'lean',    label: 'Lean',    icon: Feather },
  ];

  const eventOptions: DropdownOption[] = [
    { value: 'none',     label: 'None',     icon: Minus },
    { value: 'marathon', label: 'Marathon', icon: Trophy },
    { value: 'match',    label: 'Match',    icon: Flag },
    { value: 'hike',     label: 'Hike',     icon: Mountain },
  ];

  return (
    <div className="pb-28 relative min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-[var(--navy)] pt-10 pb-5 px-6 shadow-md z-10">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white leading-tight">What can I cook?</h1>
            <p className="text-[var(--navy-tint)] opacity-80 text-xs mt-1">AI-generated · uses your pantry · respects your diet</p>
          </div>
          <button
            onClick={() => fetchRecipes(searchQuery, true)}
            disabled={loading}
            className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors border border-white/20 disabled:opacity-60"
            title="Generate fresh AI recipes"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Unified search + generate — one control, teal-ring on focus */}
        <form
          onSubmit={handleSearchSubmit}
          className="mt-4 flex items-center bg-white rounded-full px-1 py-1 focus-within:ring-2 focus-within:ring-[var(--teal)] shadow-sm"
        >
          <Search size={16} className="ml-3 mr-2 text-[var(--ink-muted)] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Winter soup, high protein…"
            className="flex-1 bg-transparent py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none min-w-0"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] flex-shrink-0"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-9 h-9 bg-[var(--teal)] hover:bg-[#0092A6] text-white rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-colors"
            aria-label="Generate recipes"
          >
            <Sparkles size={16} />
          </button>
        </form>
      </div>

      {/* Context Bar — standardized pill heights + right-edge fade mask */}
      <div
        className="bg-white border-b border-[var(--line)] px-4 py-3 flex items-center gap-2 overflow-x-auto hide-scrollbar shadow-sm z-10 sticky top-0"
        style={{ WebkitMaskImage: 'linear-gradient(to right, black 92%, transparent)', maskImage: 'linear-gradient(to right, black 92%, transparent)' }}
      >
        <button
          onClick={() => setViewingSaved(!viewingSaved)}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border-2 transition-colors ${
            viewingSaved
              ? 'bg-[var(--alert-red)] border-[var(--alert-red)] text-white'
              : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)]'
          }`}
        >
          <Heart size={13} className={viewingSaved ? 'fill-white' : ''} />
          <span>Saved ({savedRecipes.length})</span>
        </button>

        <button
          onClick={() => setPowerOn(!powerOn)}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border-2 transition-colors ${
            !powerOn
              ? 'bg-white border-[var(--teal)] text-[var(--navy)]'
              : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)]'
          }`}
        >
          <Zap size={14} className={!powerOn ? 'text-[var(--teal)]' : 'text-[var(--ink-muted)]'} />
          <span>{!powerOn ? 'Load-shedding' : 'Power On'}</span>
        </button>

        <StyledDropdown value={diet}  options={dietOptions}  onChange={setDiet}  triggerIcon={Filter} ariaLabel="Diet" />
        <StyledDropdown value={goal}  options={goalOptions}  onChange={setGoal}  labelPrefix="Goal: "  ariaLabel="Fitness goal" />
        <StyledDropdown value={event} options={eventOptions} onChange={setEvent} labelPrefix="Event: " ariaLabel="Upcoming event" />
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
                <p className="text-sm mt-1">Tap the heart on any recipe to save it here.</p>
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
          <>
            {/* Empty-pantry banner — recipes shown are starter shopping lists */}
            {emptyPantry && !viewingSaved && (
              <div className="discovery-card bg-gradient-to-br from-[#FFF8E6] to-white border-[var(--gold)] flex items-start">
                <div className="bg-[var(--gold)] p-2 rounded-full mr-3 flex-shrink-0">
                  <ShoppingBasket size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--navy)] text-sm">Your pantry is empty</p>
                  <p className="text-xs text-[var(--ink-muted)] mt-0.5 leading-snug">
                    Here are meals you could make. Every ingredient is on the shopping list — tap any recipe to see what to buy.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
        {activeList.length > 0 && (
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
                    {/* ALLERGEN WARNING — most urgent, sits above the title */}
                    {recipe.allergen_warnings && recipe.allergen_warnings.length > 0 && (
                      <div className="bg-[#FFE9E4] border-2 border-[var(--alert-red)] rounded-lg p-2.5 flex items-start">
                        <AlertTriangle size={16} className="text-[var(--alert-red)] mr-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[var(--alert-red)] uppercase tracking-wider">Allergy warning</p>
                          <p className="text-xs text-[var(--ink)] mt-0.5">
                            Contains <span className="font-bold text-[var(--alert-red)]">{recipe.allergen_warnings.join(', ')}</span> — you flagged this in your profile.
                          </p>
                        </div>
                      </div>
                    )}

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

                    {/* Allergen Safety (green when clear) */}
                    {recipe.allergy_safe && profile.preferences.allergies.length > 0 && (!recipe.allergen_warnings || recipe.allergen_warnings.length === 0) && (
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

      {/* Missing Items Modal — fixed positioning constrained to the app frame
          so it always covers the viewport regardless of scroll position. */}
      {selectedMissing && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--navy-deep)] bg-opacity-60 backdrop-blur-sm"
          onClick={() => setSelectedMissing(null)}
        >
          <div
            className="bg-white w-full max-w-[480px] mx-auto rounded-t-3xl p-6 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4 flex-shrink-0">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[var(--navy)]">Missing Items</h2>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5 truncate">For {selectedMissing.name}</p>
              </div>
              <button onClick={() => setSelectedMissing(null)} className="p-2 bg-[var(--bg)] rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)] flex-shrink-0" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 -mx-1 px-1">
              {selectedMissing.missing_items.length === 0 && (
                <p className="text-sm text-[var(--ink-muted)] text-center py-6">Nothing missing — you have everything you need.</p>
              )}
              {selectedMissing.missing_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-[var(--line)] pb-3 last:border-0">
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--ink)]">{item.name}</p>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">Available at <span className="font-semibold">{item.retailer}</span></p>
                  </div>
                  {item.is_healthyfood && (
                    <span className="bg-[#E8F3ED] text-[var(--healthy-green)] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[var(--healthy-green)] flex-shrink-0 ml-2">
                      HealthyFood
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleAddToList}
              disabled={addingToList || selectedMissing.missing_items.length === 0}
              className="w-full bg-[var(--healthy-green)] text-white font-bold py-3.5 rounded-xl flex items-center justify-center shadow-md disabled:opacity-50 flex-shrink-0"
            >
              <ShoppingBasket size={18} className="mr-2" />
              {addingToList ? 'Adding…' : 'Add to shopping list'}
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
            <div className="flex items-center flex-wrap text-[var(--ink-muted)] text-sm font-medium mb-4 gap-x-3 gap-y-1">
              <span className="flex items-center"><Clock size={16} className="mr-1" /> {viewRecipe.cook_time_minutes} mins</span>
              <span className="uppercase tracking-wider text-xs">{viewRecipe.cooking_method}</span>
              <span className="flex items-center"><Flame size={14} className="text-[var(--alert-red)] mr-1" /> {viewRecipe.calories} kcal</span>
            </div>

            {viewRecipe.allergen_warnings && viewRecipe.allergen_warnings.length > 0 && (
              <div className="bg-[#FFE9E4] border-2 border-[var(--alert-red)] rounded-xl p-3 mb-6 flex items-start">
                <AlertTriangle size={20} className="text-[var(--alert-red)] mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[var(--alert-red)] uppercase tracking-wider">Contains your allergens</p>
                  <p className="text-sm text-[var(--ink)] mt-0.5">
                    This recipe includes <span className="font-bold text-[var(--alert-red)]">{viewRecipe.allergen_warnings.join(', ')}</span>. Individual ingredients are flagged in the list below.
                  </p>
                </div>
              </div>
            )}

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
                const allergen = ingredientAllergen(ing.name, profile?.preferences.allergies || []);
                const isAlert = !inPantry || !!allergen;
                return (
                  <li key={idx} className={`flex flex-col p-3 rounded-lg border ${
                    allergen
                      ? 'bg-[#FFE9E4] border-2 border-[var(--alert-red)]'
                      : !inPantry
                        ? 'bg-[#FFE9E4] border-[var(--alert-red)]/40'
                        : 'bg-[var(--bg)] border-[var(--line)]'
                  }`}>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center min-w-0">
                        {isAlert
                          ? <AlertCircle size={16} className="text-[var(--alert-red)] mr-2 flex-shrink-0" />
                          : <CheckCircle size={16} className="text-[var(--healthy-green)] mr-2 flex-shrink-0" />}
                        <div className="min-w-0">
                          <span className={`font-bold ${isAlert ? 'text-[var(--alert-red)]' : 'text-[var(--ink)]'}`}>{ing.amount}</span>
                          <span className={`ml-2 ${isAlert ? 'text-[var(--alert-red)] font-semibold' : 'text-[var(--ink)]'}`}>{ing.name}</span>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        {allergen && (
                          <span className="text-[10px] font-bold bg-[var(--alert-red)] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                            {allergen} allergen
                          </span>
                        )}
                        {!inPantry && !allergen && (
                          <span className="text-[10px] font-bold bg-[var(--alert-red)] text-white px-2 py-0.5 rounded">BUY</span>
                        )}
                      </div>
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
              {markingCooked ? 'Logging…' : 'I cooked this'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipesScreen;
