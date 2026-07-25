import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MessageSquare, X, Send, Bot, User, Sparkles, Clock, Users, CheckCircle, ShoppingCart, ChefHat, Flame } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { Recipe } from '../types';
import { getRecipes } from '../api';

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

const RecipeChatCard: React.FC<{ recipe: Recipe }> = ({ recipe }) => (
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
    </div>
    <div className="p-3">
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

      {/* From your pantry */}
      <div className="mt-3">
        <p className="text-[10px] font-bold text-[var(--healthy-green)] uppercase tracking-wide mb-1 flex items-center">
          <CheckCircle size={11} className="mr-1" /> From your pantry
        </p>
        <ul className="space-y-0.5">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="text-[11px] text-[var(--ink)] flex justify-between">
              <span>• {ing.name}</span>
              <span className="text-[var(--ink-muted)]">{ing.amount}</span>
            </li>
          ))}
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
    </div>
  </div>
);

const AIAssistant: React.FC = () => {
  const { isAIOpen, closeAI, openAI, aiInitialMessage, profile } = useProfile();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: "Hi! I'm your HealthyFood Companion. Ask me to build a recipe from your pantry — try \"quick dinner\", \"sardine bowl\", or \"something with samp\"." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

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

    // Route 1: recipe intent → hit /recipes with the user's query
    // This uses their REAL pantry and returns "missing items" to buy.
    if (isRecipeIntent(userMsg.text) && profile) {
      try {
        const data = await getRecipes(profile.customer_id, { search: userMsg.text });
        const recipes = (data?.recipes || []).slice(0, 2);
        const introText = recipes.length
          ? `Here's what I'd cook from your pantry for "${userMsg.text}":`
          : "I couldn't build a recipe for that from your current pantry. Try something like \"quick dinner\" or \"chicken bowl\".";
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
          text: "Recipe service is unreachable right now — but check the Recipes tab for suggestions from your pantry.",
        }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Route 2: general nutrition Q&A → Gemini chat
    try {
      if (!ai) throw new Error('Gemini API key not configured');
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: 'You are the Discovery HealthyFood Companion AI. Answer questions about nutrition, cooking techniques, and healthy eating. Keep answers concise, friendly, and aligned with Discovery Vitality focus on whole foods, lean proteins, and reducing sugar/salt. Format with short paragraphs.',
        }
      });

      const response = await chat.sendMessage({ message: userMsg.text });

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I'm sorry, I couldn't process that."
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      const q = userMsg.text.toLowerCase();
      let fallback =
        "Based on your pantry, a great choice is a Sardine & Veg Stir-fry with Buckwheat — high in omega-3s, ready in 15 minutes, and it uses your items that are expiring soon.";
      if (q.includes('sugar') || q.includes('diabet'))
        fallback = "To lower sugar, swap sugary drinks for water with lemon, and choose whole fruit over fruit juice. Your buckwheat and samp are excellent low-GI carbohydrates for steady energy.";
      else if (q.includes('salt') || q.includes('sodium') || q.includes('pressure') || q.includes('hypertension'))
        fallback = "For lower salt, cook with herbs, garlic and lemon instead of stock cubes, and rinse tinned beans before use. Your fresh vegetables and olive oil are naturally low in sodium.";
      else if (q.includes('protein') || q.includes('build') || q.includes('muscle'))
        fallback = "For more protein on a budget, your sardines and samp-and-beans are ideal — beans and grains together form a complete protein. Aim to include a protein source in every meal.";
      else if (q.includes('budget') || q.includes('cheap') || q.includes('afford') || q.includes('save'))
        fallback = "To eat well for less, cook in batches from staples you already own — samp, beans, tinned tomatoes and buckwheat stretch a long way.";
      else if (q.includes('heritage') || q.includes('umngqusho') || q.includes('traditional'))
        fallback = "Umngqusho — traditional samp and beans — is a wonderful heritage dish and a complete plant protein. You already have the samp and beans in your pantry.";
      else if (q.includes('expir') || q.includes('waste') || q.includes('going off'))
        fallback = "Your fresh vegetables and sardines are expiring soon — a Sardine & Veg Stir-fry uses both today, so nothing goes to waste.";

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: fallback
      }]);
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
                  {msg.recipes && msg.recipes.map((r, idx) => (
                    <RecipeChatCard key={idx} recipe={r} />
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
