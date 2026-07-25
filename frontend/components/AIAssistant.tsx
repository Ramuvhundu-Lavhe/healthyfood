import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, Clock, Users, CheckCircle, ShoppingCart, ChefHat, Flame, ThumbsUp, ThumbsDown, Check, Heart, AlertCircle } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { Recipe } from '../types';
import { getRecipes, recordCooked, recordReview, saveRecipe, unsaveRecipe, getSavedRecipes, getPantry, chatWithAI } from '../api';

// Bi-directional substring match — handles brand names vs generic pantry items
function ingredientInPantry(ingName: string, pantryNames: string[]): boolean {
  const i = String(ingName || '').toLowerCase().trim();
  if (!i) return false;
  return pantryNames.some(p => {
    const pn = p.toLowerCase().trim();
    return pn.includes(i) || i.includes(pn);
  });
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  recipes?: Recipe[];
}

// Recipe intent detection — permissive keyword match.
// Matches when the user is asking for food/cooking help vs a generic nutrition question.
const RECIPE_INTENT = /\b(recipe|cook|make|prep(are)?|meal|dish|dinner|lunch|breakfast|supper|snack|bowl|stir[- ]?fry|curry|stew|soup|salad|roast|bake|grill|fry|saute|sauté|chicken|beef|fish|pork|lamb|pasta|rice|noodle|couscous|samp|maize|bulgar|tuna|sardine|egg|veggie|vegetable|umngqusho|potjie|braai|morogo|pap|smoothie|shake|hungry|craving|feed|serve|dinner|lunch|breakfast|hungry|eat|feast)\b/i;

function isRecipeIntent(text: string): boolean {
  return RECIPE_INTENT.test(text);
}

const RecipeChatCard: React.FC<{
  recipe: Recipe;
  customerId: string;
  onToast: (msg: string) => void;
  pantryNames: string[];
  isSavedInit: boolean;
  onSaveToggle: (recipeName: string, saved: boolean) => void;
}> = ({ recipe, customerId, onToast, pantryNames, isSavedInit, onSaveToggle }) => {
  const [cooked, setCooked] = useState(false);
  const [rating, setRating] = useState<0 | 1 | -1>(0);
  const [saved, setSaved] = useState(isSavedInit);

  const markCooked = async () => {
    setCooked(true);
    onToast(`Nice — logged "${recipe.name}" as cooked`);
    await recordCooked(customerId, recipe.name, recipe.ingredients.map(i => i.name));
  };

  const submitRating = async (r: 1 | -1) => {
    setRating(r);
    onToast(r > 0 ? 'Thanks — we\'ll suggest more like this' : 'Got it — you\'ll see less like this');
    await recordReview(customerId, recipe.name, r);
  };

  const toggleSave = async () => {
    if (saved) {
      setSaved(false);
      onToast(`Removed "${recipe.name}" from saved`);
      onSaveToggle(recipe.name, false);
      await unsaveRecipe(customerId, recipe.name);
    } else {
      setSaved(true);
      onToast(`Saved "${recipe.name}"`);
      onSaveToggle(recipe.name, true);
      await saveRecipe(customerId, recipe);
    }
  };

  return (
  <div className="mt-3 bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
    <div className="relative h-32 w-full bg-[var(--bg)]">
      <img
        src={recipe.photo}
        alt={recipe.name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80'; }}
      />
      {recipe.uses_expiring && (
        <div className="absolute top-2 left-2 bg-[var(--gold)] text-[var(--navy-deep)] text-[10px] font-bold px-2 py-1 rounded-full flex items-center">
          <Flame size={10} className="mr-1" /> USES EXPIRING
        </div>
      )}
      <button
        onClick={toggleSave}
        className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm"
        aria-label={saved ? 'Unsave' : 'Save'}
      >
        <Heart size={16} className={saved ? 'text-[var(--alert-red)] fill-[var(--alert-red)]' : 'text-[var(--ink-muted)]'} />
      </button>
    </div>
    <div className="p-3">
      {/* ALLERGEN WARNING — the most important thing to say */}
      {recipe.allergen_warnings && recipe.allergen_warnings.length > 0 && (
        <div className="bg-[#FFE9E4] border-2 border-[var(--alert-red)] rounded-lg p-2 mb-2 flex items-start">
          <AlertCircle size={14} className="text-[var(--alert-red)] mr-1.5 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[var(--alert-red)] uppercase tracking-wider">Allergy warning</p>
            <p className="text-[11px] text-[var(--ink)] mt-0.5">
              Contains <span className="font-bold text-[var(--alert-red)]">{recipe.allergen_warnings.join(', ')}</span>
            </p>
          </div>
        </div>
      )}

      <h4 className="font-bold text-[var(--ink)] text-sm leading-tight">{recipe.name}</h4>

      <div className="flex items-center flex-wrap gap-2 mt-2 text-[10px] text-[var(--ink-muted)]">
        <span className="flex items-center bg-[var(--bg)] px-2 py-0.5 rounded-full">
          <Clock size={10} className="mr-1" /> {recipe.cook_time_minutes} min
        </span>
        <span className="flex items-center bg-[var(--bg)] px-2 py-0.5 rounded-full">
          <Users size={10} className="mr-1" /> serves {recipe.servings}
        </span>
        <span className="bg-[var(--bg)] px-2 py-0.5 rounded-full">{recipe.cooking_method}</span>
      </div>

      <p className="text-[11px] text-[var(--ink-muted)] mt-2 italic">{recipe.health_benefit}</p>

      {/* Ingredients — red when NOT in pantry */}
      <div className="mt-3">
        <p className="text-[10px] font-bold text-[var(--ink)] uppercase tracking-wide mb-1 flex items-center">
          <CheckCircle size={11} className="mr-1 text-[var(--healthy-green)]" /> Ingredients
        </p>
        <ul className="space-y-0.5">
          {recipe.ingredients.map((ing, i) => {
            const inPantry = ingredientInPantry(ing.name, pantryNames);
            return (
              <li key={i} className={`text-[11px] flex justify-between ${inPantry ? 'text-[var(--ink)]' : 'text-[var(--alert-red)]'}`}>
                <span className="flex items-center">
                  {inPantry
                    ? <CheckCircle size={10} className="mr-1 text-[var(--healthy-green)]" />
                    : <AlertCircle size={10} className="mr-1" />}
                  {ing.name}
                  {!inPantry && <span className="ml-1 text-[9px] font-bold bg-[#FFE9E4] px-1 py-0.5 rounded">BUY</span>}
                </span>
                <span className="opacity-70">{ing.amount}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Missing items — the "what to buy" ask */}
      {recipe.missing_items && recipe.missing_items.length > 0 && (
        <div className="mt-3 bg-[#FFF8E6] border border-[var(--gold)]/40 rounded-lg p-2">
          <p className="text-[10px] font-bold text-[var(--navy-deep)] uppercase tracking-wide mb-1 flex items-center">
            <ShoppingCart size={11} className="mr-1" /> Still need to buy
          </p>
          <ul className="space-y-0.5">
            {recipe.missing_items.map((m, i) => (
              <li key={i} className="text-[11px] text-[var(--ink)] flex items-center justify-between">
                <span>• {m.name}</span>
                {m.is_healthyfood && (
                  <span className="text-[9px] font-bold text-[var(--teal)] bg-white px-1.5 py-0.5 rounded">HF</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      <details className="mt-3">
        <summary className="text-[10px] font-bold text-[var(--teal)] uppercase tracking-wide cursor-pointer flex items-center">
          <ChefHat size={11} className="mr-1" /> Steps ({recipe.steps.length})
        </summary>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          {recipe.steps.map((s, i) => (
            <li key={i} className="text-[11px] text-[var(--ink)] leading-relaxed">{s}</li>
          ))}
        </ol>
      </details>

      {/* Cooked + Review actions */}
      <div className="mt-3 pt-3 border-t border-[var(--line)]">
        {!cooked ? (
          <button
            onClick={markCooked}
            className="w-full bg-[var(--navy)] text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center"
          >
            <Check size={14} className="mr-1.5" /> I cooked this
          </button>
        ) : rating === 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--ink-muted)]">How was it?</span>
            <div className="flex gap-2">
              <button
                onClick={() => submitRating(1)}
                className="p-1.5 bg-[#E8F3ED] rounded-lg text-[var(--healthy-green)] hover:bg-[var(--healthy-green)] hover:text-white transition-colors"
                aria-label="Liked it"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => submitRating(-1)}
                className="p-1.5 bg-[#FFE9E4] rounded-lg text-[var(--alert-red)] hover:bg-[var(--alert-red)] hover:text-white transition-colors"
                aria-label="Didn't like it"
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--ink-muted)] text-center">
            {rating > 0 ? '✓ We\'ll suggest more like this' : '✓ You\'ll see less like this'}
          </p>
        )}
      </div>
    </div>
  </div>
  );
};

const AIAssistant: React.FC = () => {
  const { isAIOpen, closeAI, openAI, aiInitialMessage, profile, addToast } = useProfile();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: "Hi! I'm your HealthyFood Companion. Ask me to build a recipe from your pantry — try \"quick dinner\", \"sardine bowl\", or \"something with samp\"." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pantryNames, setPantryNames] = useState<string[]>([]);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load pantry + saved recipes once we have a profile — used to render each recipe card
  useEffect(() => {
    if (!profile) return;
    getPantry(profile.customer_id).then(p => setPantryNames(p.items.map(i => i.name)));
    getSavedRecipes(profile.customer_id).then(s =>
      setSavedNames(new Set(s.items.map(r => String(r.name).toLowerCase().trim())))
    );
  }, [profile?.customer_id]);

  const handleSaveToggle = (recipeName: string, saved: boolean) => {
    const key = recipeName.toLowerCase().trim();
    setSavedNames(prev => {
      const next = new Set(prev);
      if (saved) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isAIOpen) {
      scrollToBottom();
      if (aiInitialMessage) {
        setInput(aiInitialMessage);
      }
    }
  }, [messages, isAIOpen, aiInitialMessage]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Route 1: recipe intent → hit /recipes with the user's query.
    // Returns a pantry-grounded recipe list, or an empty-pantry message.
    if (isRecipeIntent(userMsg.text) && profile) {
      try {
        const data: any = await getRecipes(profile.customer_id, { search: userMsg.text });
        const recipes = (data?.recipes || []).slice(0, 2);
        let introText: string;
        if (data?.empty_pantry) {
          introText = "Your pantry is empty — add a few items to the Pantry tab and I'll build recipes from what you have.";
        } else if (recipes.length) {
          introText = `Here's what I'd cook from your pantry for "${userMsg.text}":`;
        } else {
          introText = "I couldn't build a recipe for that from your current pantry. Try adding more items or ask a broader question.";
        }
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: introText,
          recipes,
        }]);
      } catch (e) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: "The recipe service is unreachable right now — try again shortly.",
        }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Route 2: general nutrition Q&A → backend /ai/chat (server-side Gemini).
    // No client-side hardcoded fallback — if AI is genuinely down we say so.
    try {
      const res = await chatWithAI(userMsg.text);
      if (res.reply) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: res.reply!,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: res.error || "The AI assistant is unavailable right now. Please try again shortly.",
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => openAI()}
        className={`absolute bottom-24 right-4 w-14 h-14 bg-[var(--teal)] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-40 ${isAIOpen ? 'hidden' : 'flex'}`}
      >
        <Sparkles size={24} />
      </button>

      {/* Chat Modal */}
      {isAIOpen && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[var(--bg)] animate-slide-up">
          {/* Header */}
          <div className="bg-[var(--navy)] text-white px-4 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center">
              <div className="bg-white/20 p-2 rounded-full mr-3">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">HealthyFood AI</h2>
                <p className="text-[var(--navy-tint)] text-xs opacity-90">Recipes from your pantry · nutrition Q&A</p>
              </div>
            </div>
            <button onClick={closeAI} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${msg.recipes && msg.recipes.length ? 'max-w-[92%]' : 'max-w-[80%]'} rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[var(--navy)] text-white rounded-tr-sm'
                    : 'bg-white text-[var(--ink)] border border-[var(--line)] rounded-tl-sm'
                }`}>
                  <div>{msg.text}</div>
                  {msg.recipes && profile && msg.recipes.map((r, idx) => (
                    <RecipeChatCard
                      key={idx}
                      recipe={r}
                      customerId={profile.customer_id}
                      onToast={addToast}
                      pantryNames={pantryNames}
                      isSavedInit={savedNames.has(String(r.name).toLowerCase().trim())}
                      onSaveToggle={handleSaveToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[var(--line)] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex space-x-1">
                  <div className="w-2 h-2 bg-[var(--teal)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-[var(--teal)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-[var(--teal)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white p-4 border-t border-[var(--line)] shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center bg-[var(--bg)] border border-[var(--line)] rounded-full px-2 py-1 focus-within:border-[var(--teal)] transition-colors">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask for a recipe or diet tip..."
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-[var(--ink)]"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-[var(--teal)] text-white p-2 rounded-full disabled:opacity-50 transition-opacity"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
