import axios from 'axios';
import { Profile, PantryResponse, Recipe, RecipeResponse, ProgressResponse, HeritageResponse, CommunityResponse, ShoppingListResponse, Preferences } from './types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5001';
const toApiUrl = (path: string) => `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;

// Attach auth token from localStorage to every request
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('hf_token');
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch (_) { /* ignore */ }
  return config;
});

// --- MOCK DATA ---
const mockProfile: Profile = {
  customer_id: 'CUST-001',
  name: 'Aisha Van Wyk',
  health_score: 78,
  score_change: 14,
  trend: 'up',
  nudge_text: "Three weeks straight above 70, Aisha. Your fish and whole-grain choices are doing real work for your heart health — and you're only 2 points from your best score ever.",
  avg_weekly_spend: 1050,
  preferred_retailer: 'Checkers',
  healthy_ratio: 78,
  profile_completeness: 80,
  preferences: {
    allergies: [],
    diet: 'none',
    household_size: 4,
    budget_tier: 'medium',
    training_goal: 'general',
    upcoming_event: null,
    power_available: true,
    heritage_optin: true
  },
  milestones: [
    { id: 'm1', name: 'First Step', desc: 'Start your journey', earned: true, progress_pct: 100, points: 100 },
    { id: 'm2', name: 'Consistent Shopper', desc: 'Shop healthy 3 weeks in a row', earned: true, progress_pct: 100, points: 250 },
    { id: 'm3', name: 'HealthyFood Hero', desc: 'Reach an 80% healthy basket', earned: false, progress_pct: 97, points: 500 },
    { id: 'm4', name: 'Pantry Pro', desc: 'Cook 5 meals from your pantry', earned: false, progress_pct: 60, points: 300 },
    { id: 'm5', name: 'Zero Waste', desc: 'Use all expiring items in a week', earned: false, progress_pct: 0, points: 200 }
  ]
};

const mockPantry: PantryResponse = {
  items: [
    // Expiring soon — perishables (drives the "cook this first" waste story)
    { name: 'Fresh Vegetables', category: 'Fruit and vegetables', is_healthy: true, is_healthyfood: true, days_until_expiry: 2, photo: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80' },
    { name: 'Fresh Fruit', category: 'Fruit and vegetables', is_healthy: true, is_healthyfood: true, days_until_expiry: 4, photo: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&q=80' },
    { name: 'Sardines', category: 'Animal protein', is_healthy: true, is_healthyfood: true, days_until_expiry: 3, photo: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800&q=80' },
    // Whole grains & starches
    { name: 'Wholewheat Couscous', category: 'Whole grains and high-fibre starchy foods', is_healthy: true, is_healthyfood: true, days_until_expiry: 120, photo: 'https://images.unsplash.com/photo-1612257999691-3d9e9b0e3b0e?w=800&q=80' },
    { name: 'Samp and Beans', category: 'Whole grains and high-fibre starchy foods', is_healthy: true, is_healthyfood: true, days_until_expiry: 300, photo: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=800&q=80' },
    { name: 'Maize Meal', category: 'Whole grains and high-fibre starchy foods', is_healthy: true, is_healthyfood: true, days_until_expiry: 180, photo: 'https://images.unsplash.com/photo-1614961233913-a5113a4a34ed?w=800&q=80' },
    { name: 'Bulgar Wheat', category: 'Whole grains and high-fibre starchy foods', is_healthy: true, is_healthyfood: true, days_until_expiry: 150, photo: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&q=80' },
    { name: 'Wholewheat Noodles', category: 'Whole grains and high-fibre starchy foods', is_healthy: true, is_healthyfood: true, days_until_expiry: 200, photo: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=800&q=80' },
    // Produce (tinned) & fats
    { name: 'Tinned Tomatoes', category: 'Fruit and vegetables', is_healthy: true, is_healthyfood: true, days_until_expiry: 365, photo: 'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=800&q=80' },
    { name: 'Plain Dried Herbs', category: 'Fruit and vegetables', is_healthy: true, is_healthyfood: true, days_until_expiry: 240, photo: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800&q=80' },
    { name: 'Olive Oil', category: 'Oils, nuts and seeds', is_healthy: true, is_healthyfood: true, days_until_expiry: 120, photo: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80' },
    // Less healthy — the treats Aisha actually bought (gives the health score contrast)
    { name: 'Chocolates', category: 'Unhealthy foods', is_healthy: false, is_healthyfood: false, days_until_expiry: 90, photo: 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=800&q=80' },
    { name: 'Ice Cream', category: 'Unhealthy foods', is_healthy: false, is_healthyfood: false, days_until_expiry: 30, photo: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80' },
    { name: 'Rusks', category: 'Unhealthy foods', is_healthy: false, is_healthyfood: false, days_until_expiry: 60, photo: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=800&q=80' }
  ]
};

const mockRecipes: RecipeResponse = {
  recipes: [
    {
      name: 'Sardine & Veg Stir-fry with Buckwheat',
      photo: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
      prep_time_category: '15 Min Quick Meals',
      cook_time_minutes: 15,
      cooking_method: '⚡ Quick',
      diet_tags: ['pescatarian', 'banting', 'halal'],
      all_in_pantry: true,
      missing_items: [],
      ingredients: [
        { name: 'Sardines', amount: '1 tin', alternative: 'Tinned Tuna or Mackerel' },
        { name: 'Buckwheat', amount: '1 cup', alternative: 'Quinoa or Brown Rice' },
        { name: 'Fresh Vegetables', amount: '2 cups', alternative: 'Frozen Mixed Veg' },
        { name: 'Olive Oil', amount: '1 tbsp' }
      ],
      health_benefit: 'High in Omega-3s for heart health.',
      allergy_safe: true,
      uses_expiring: true,
      servings: 4,
      calories: 420,
      budget_savings_rand: 45,
      steps: [
        'Rinse 1 cup of buckwheat under cold water. Boil in 2 cups of lightly salted water for 10-12 minutes until tender, then drain.',
        'Heat 1 tbsp of olive oil in a large pan over medium-high heat.',
        'Add the fresh vegetables and sauté for 4-5 minutes until they begin to soften but retain a crunch.',
        'Carefully add the sardines (drained of excess oil/water). Sear for exactly 2 minutes on each side to warm through without breaking them apart.',
        'Serve the warm sardine and vegetable mix over a bed of the cooked buckwheat.'
      ]
    },
    {
      name: 'Hearty Tomato & Bean Stew',
      photo: 'https://images.unsplash.com/photo-1548943487-a2e4f43b4850?w=800&q=80',
      prep_time_category: '45 Min Hearty Meals',
      cook_time_minutes: 45,
      cooking_method: '⏳ Long cook',
      diet_tags: ['vegan', 'vegetarian', 'halal'],
      all_in_pantry: false,
      missing_items: [
        { name: 'Low-sodium stock', retailer: 'Checkers', is_healthyfood: true }
      ],
      ingredients: [
        { name: 'Tinned Tomatoes', amount: '1 tin' },
        { name: 'Beans (from Samp & Beans)', amount: '1 cup', alternative: 'Lentils or Chickpeas' },
        { name: 'Low-sodium stock', amount: '1 cup', alternative: 'Water with mixed herbs' },
        { name: 'Olive Oil', amount: '1 tbsp' }
      ],
      health_benefit: 'Rich in fiber and antioxidants.',
      allergy_safe: true,
      uses_expiring: false,
      servings: 4,
      calories: 310,
      budget_savings_rand: 28,
      steps: [
        'If using dried beans from your samp mix, soak them overnight, then boil vigorously for 30 minutes until tender.',
        'In a heavy-bottomed pot, heat 1 tbsp olive oil over medium heat.',
        'Pour in the tinned tomatoes and 1 cup of low-sodium stock. Bring to a gentle simmer.',
        'Add the cooked beans to the tomato broth. Reduce heat to low, cover, and let it simmer gently for 15-20 minutes to allow flavors to meld.',
        'Season with black pepper and serve hot.'
      ]
    },
    {
      name: 'Fresh Fruit & Buckwheat Breakfast Bowl',
      photo: 'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=800&q=80',
      prep_time_category: '5 Min No-Cook',
      cook_time_minutes: 5,
      cooking_method: '❄ No-cook',
      diet_tags: ['vegetarian', 'halal'],
      all_in_pantry: true,
      missing_items: [],
      ingredients: [
        { name: 'Buckwheat (pre-cooked)', amount: '1/2 cup', alternative: 'Rolled Oats' },
        { name: 'Fresh Fruit', amount: '1 cup', alternative: 'Thawed Frozen Berries' },
        { name: 'Honey or Sweetener', amount: '1 tsp', alternative: 'Maple Syrup or Agave' }
      ],
      health_benefit: 'Great source of complex carbs and vitamins.',
      allergy_safe: true,
      uses_expiring: false,
      servings: 2,
      calories: 245,
      budget_savings_rand: 15,
      steps: [
        'Take 1/2 cup of leftover, pre-cooked buckwheat from the fridge and place it in a serving bowl.',
        'Wash and chop 1 cup of your fresh fruit into bite-sized pieces.',
        'Layer the fresh fruit generously over the cold buckwheat.',
        'Drizzle with 1 tsp of honey or your preferred sweetener and enjoy immediately.'
      ]
    }
  ]
};

const mockProgress: ProgressResponse = {
  weekly_scores: [
    { week: 'W1', score: 64 },
    { week: 'W2', score: 68 },
    { week: 'W3', score: 72 },
    { week: 'W4', score: 78 }
  ],
  basket_split: {
    healthy_spend: 820,
    unhealthy_spend: 230
  },
  healthyfood_adoption_pct: 78,
  total_vitality_points: 350,
  // HealthyFood gives up to 25% cashback on healthy items; the app adds waste-
  // avoidance and cheaper-swap savings on top. All rand figures, SA context.
  savings: {
    healthyfood_cashback: 205,   // ~25% back on R820 healthy spend
    waste_avoided: 168,          // expiring veg/fruit/sardines cooked, not binned
    smart_swaps: 92,             // cheaper healthy alternatives suggested
    total: 465
  },
  monthly_savings_trend: [
    { month: 'Apr', amount: 210 },
    { month: 'May', amount: 340 },
    { month: 'Jun', amount: 465 }
  ],
  shopping_list: [
    { name: 'Low-sodium stock', retailer: 'Checkers', is_healthyfood: true }
  ]
};

const mockHeritage: HeritageResponse = {
  celebration: "Women's Day",
  days_away: 2,
  dish: {
    name: 'Umngqusho',
    origin: 'Xhosa',
    context: 'Slow-cooked samp and beans — humble, hearty, and a complete protein when combined. A dish shared across South African kitchens for generations.',
    photo: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=800&q=80',
    ingredients_have: ['Samp and beans', 'Tinned tomatoes', 'Olive oil'],
    ingredients_needed: ['Onions', 'Beef stock']
  }
};

const mockCommunity: CommunityResponse = {
  active_challenge: {
    id: 'c1',
    name: 'Heritage Week Cook-Along',
    theme: 'Cook one traditional South African dish from your pantry',
    days_left: 4,
    bonus_points: 500,
    participants: 34,
    collective_goal: 100,
    collective_done: 61,
    joined: true,
    you_cooked: false,
    neighbours: ['TM', 'SN', 'LK', 'PD', 'JV', 'RM'],
    recent_activity: [
      { who: 'Thandi M.', what: 'cooked morogo with maize meal', when: '2h ago' },
      { who: 'Sipho N.', what: 'shared a potjiekos photo', when: '5h ago' },
      { who: 'Lerato K.', what: 'joined the cook-along', when: 'yesterday' }
    ]
  },
  upcoming: [
    { name: 'Zero-Waste Week', starts: '18 Aug', desc: 'Cook only from what you already have' }
  ]
};

// --- API CALLS ---
export const getProfile = async (customerId: string): Promise<Profile> => {
  try {
    const response = await axios.get(toApiUrl(`/profile/${customerId}`));
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch profile, using mock data');
    return mockProfile;
  }
};

export const getPantry = async (customerId: string): Promise<PantryResponse> => {
  try {
    const response = await axios.get(toApiUrl(`/pantry/${customerId}`));
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch pantry, using mock data');
    return mockPantry;
  }
};

export const getRecipes = async (customerId: string, params?: any): Promise<RecipeResponse> => {
  try {
    const response = await axios.get(toApiUrl(`/recipes/${customerId}`), { params });
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch recipes from server, using AI fallback generator');
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulating AI agent search latency

    let filteredRecipes = [...mockRecipes.recipes];
    const searchQuery = (params?.search || params?.q || '').trim().toLowerCase();

    if (searchQuery) {
      filteredRecipes = [
        {
          name: `Pantry ${searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1)} Special`,
          photo: `https://image.pollinations.ai/prompt/${encodeURIComponent('A freshly cooked gourmet plate of ' + searchQuery + ' featuring fresh vegetables and sardines, food photography, realistic, 8k')}`,
          prep_time_category: '15 Min Quick Meals',
          cook_time_minutes: 15,
          cooking_method: '⚡ Quick',
          diet_tags: ['healthyfood', 'halal'],
          all_in_pantry: true,
          missing_items: [],
          ingredients: [
            { name: 'Fresh Vegetables', amount: '2 cups', alternative: 'Tinned Tomatoes' },
            { name: 'Sardines', amount: '1 tin', alternative: 'Tinned Tuna' },
            { name: 'Wholewheat Couscous', amount: '1 cup', alternative: 'Samp and Beans' },
            { name: 'Olive Oil', amount: '1 tbsp' }
          ],
          health_benefit: `Dynamic AI recipe customized for "${searchQuery}" strictly using items from your pantry.`,
          allergy_safe: true,
          uses_expiring: true,
          servings: 4,
          calories: 410,
          budget_savings_rand: 40,
          steps: [
            `Gather your pantry items: Fresh Vegetables, Sardines, Wholewheat Couscous, and Olive Oil.`,
            `Sauté Fresh Vegetables and Sardines in Olive Oil over medium heat for 8-10 minutes.`,
            `Prepare Wholewheat Couscous with boiling water, combine with sautéed ingredients, and serve warm.`
          ]
        },
        ...mockRecipes.recipes.map(r => ({
          ...r,
          photo: `https://image.pollinations.ai/prompt/${encodeURIComponent('A gourmet plate of ' + r.name + ', food photography, realistic')}`
        }))
      ];
    } else {
      filteredRecipes = filteredRecipes.map(r => ({
        ...r,
        photo: `https://image.pollinations.ai/prompt/${encodeURIComponent('A gourmet plate of ' + r.name + ', food photography, realistic')}`
      }));
    }

    if (params?.power === false || params?.power === 'false') {
      filteredRecipes = filteredRecipes.filter(r => r.cooking_method.includes('No-cook') || r.cooking_method.includes('Quick'));
    }

    if (params?.diet && params.diet !== 'none' && params.diet !== 'all') {
      filteredRecipes = filteredRecipes.filter(r => r.diet_tags.includes(params.diet.toLowerCase()));
    }

    return { recipes: filteredRecipes };
  }
};

export const getProgress = async (customerId: string): Promise<ProgressResponse> => {
  try {
    const response = await axios.get(toApiUrl(`/progress/${customerId}`));
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch progress, using mock data');
    return mockProgress;
  }
};

export const getHeritage = async (): Promise<HeritageResponse> => {
  try {
    const response = await axios.get(toApiUrl('/heritage/today'));
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch heritage, using mock data');
    return mockHeritage;
  }
};

export const getCommunity = async (customerId: string): Promise<CommunityResponse> => {
  try {
    const response = await axios.get(toApiUrl(`/community/${customerId}`));
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch community, using mock data');
    return mockCommunity;
  }
};

// ─────────────── Auth ───────────────
export interface AuthResponse {
  token: string;
  customer_id: string;
  name: string;
  preferences: Preferences;
}

export const register = async (input: {
  username: string;
  password: string;
  name?: string;
  preferences?: Partial<Preferences>;
}): Promise<AuthResponse> => {
  const response = await axios.post(toApiUrl('/auth/register'), input);
  return response.data;
};

export const login = async (input: { username: string; password: string }): Promise<AuthResponse> => {
  const response = await axios.post(toApiUrl('/auth/login'), input);
  return response.data;
};

export const getMe = async (): Promise<{ username: string; customer_id: string; name: string; preferences: Preferences }> => {
  const response = await axios.get(toApiUrl('/auth/me'));
  return response.data;
};

// ─────────────── Saved recipes (per-user) ───────────────
export const getSavedRecipes = async (customerId: string): Promise<{ items: Recipe[] }> => {
  try {
    const response = await axios.get(toApiUrl(`/saved/${customerId}`));
    return response.data;
  } catch {
    return { items: [] };
  }
};

export const saveRecipe = async (customerId: string, recipe: Recipe): Promise<void> => {
  try { await axios.post(toApiUrl(`/saved/${customerId}`), { recipe }); }
  catch (e) { console.warn('saveRecipe failed:', (e as Error).message); }
};

export const unsaveRecipe = async (customerId: string, name: string): Promise<void> => {
  try { await axios.delete(toApiUrl(`/saved/${customerId}/${encodeURIComponent(name)}`)); }
  catch (e) { console.warn('unsaveRecipe failed:', (e as Error).message); }
};

// ─────────────── Cooked + Reviews ───────────────
export const recordCooked = async (customerId: string, recipe_name: string, ingredients?: string[]): Promise<void> => {
  try { await axios.post(toApiUrl(`/cooked/${customerId}`), { recipe_name, ingredients }); }
  catch (e) { console.warn('recordCooked failed:', (e as Error).message); }
};

export const recordReview = async (customerId: string, recipe_name: string, rating: 1 | -1): Promise<void> => {
  try { await axios.post(toApiUrl(`/reviews/${customerId}`), { recipe_name, rating }); }
  catch (e) { console.warn('recordReview failed:', (e as Error).message); }
};

// ─────────────── Pantry additions ───────────────
export class PantryClassifyError extends Error {
  code: string;
  constructor(message: string, code: string) { super(message); this.code = code; }
}

export const addPantryItem = async (customerId: string, name: string, category?: string): Promise<PantryResponse> => {
  try {
    const response = await axios.post(toApiUrl(`/pantry/${customerId}/add`), { name, category });
    return response.data;
  } catch (e: any) {
    // Backend refused (e.g. non-food). Surface the message so the UI can show it.
    const data = e?.response?.data;
    if (data?.error) throw new PantryClassifyError(data.error, data.code || 'ADD_FAILED');
    throw e;
  }
};

export const categorizePantryItem = async (name: string): Promise<{ name: string; category: string; unknown?: boolean; reason?: string }> => {
  try {
    const response = await axios.post(toApiUrl('/pantry/categorize'), { name });
    return response.data;
  } catch (e: any) {
    // 400 from backend = non-food / unrecognised. Return an unknown marker instead of guessing.
    const data = e?.response?.data;
    if (data?.error) return { name, category: '', unknown: true, reason: data.error };
    return { name, category: '', unknown: true };
  }
};

export const chatWithAI = async (message: string): Promise<{ reply?: string; error?: string; code?: string }> => {
  try {
    const response = await axios.post(toApiUrl('/ai/chat'), { message });
    return response.data;
  } catch (e: any) {
    const data = e?.response?.data;
    return {
      error: data?.error || 'AI is unavailable right now — please try again in a moment.',
      code: data?.code || 'AI_ERROR',
    };
  }
};

export const removePantryItem = async (customerId: string, name: string): Promise<PantryResponse> => {
  const response = await axios.delete(`${API_URL}/pantry/${customerId}/item/${encodeURIComponent(name)}`);
  return response.data.pantry;
};

export const addToShoppingList = async (
  customerId: string,
  items: { name: string; retailer?: string; is_healthyfood?: boolean; source_recipe?: string }[]
): Promise<{ ok: boolean; added: number; list?: ShoppingListResponse }> => {
  try {
    const response = await axios.post(toApiUrl(`/shopping-list/${customerId}/add`), { items });
    return response.data;
  } catch (e: any) {
    return { ok: false, added: 0 };
  }
};

export const removeShoppingItem = async (customerId: string, name: string): Promise<ShoppingListResponse | null> => {
  try {
    const response = await axios.delete(toApiUrl(`/shopping-list/${customerId}/item/${encodeURIComponent(name)}`));
    return response.data.list;
  } catch { return null; }
};

export const getShoppingList = async (customerId: string): Promise<ShoppingListResponse> => {
  try {
    const response = await axios.get(`${API_URL}/shopping-list/${customerId}`);
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch shopping list, using empty fallback');
    return {
      items: [
        { name: 'Onions', category: 'Fruit and vegetables', priority: 'high', reason: 'Kitchen staple, works with everything you have', estimated_cost: 15, is_healthyfood: false },
        { name: 'Fresh Vegetables', category: 'Fruit and vegetables', priority: 'high', reason: 'Your veggies expire in 2 days — replace on next shop', estimated_cost: 40, is_healthyfood: true },
        { name: 'Plain Yoghurt', category: 'Dairy', priority: 'medium', reason: 'No dairy in your pantry — calcium + probiotics', estimated_cost: 30, is_healthyfood: true },
        { name: 'Lentils', category: 'Legumes', priority: 'low', reason: 'Cheap plant protein, pairs with your grains', estimated_cost: 25, is_healthyfood: true },
      ],
      total_cost: 110,
      budget_target: 300,
      budget_status: 'under',
      priority_note: '2 items in your pantry expire this week — buy fresh replacements first.',
    };
  }
};
