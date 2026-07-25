/**
 * HealthyFood Companion — Data API
 * Discovery Gradhack 2026
 *
 * Reads the real purchase-transactions Excel, computes health scores,
 * pantry, progress and profile from actual data, and serves the exact
 * endpoints the React frontend expects. Recipe generation calls Gemini
 * through the existing Vertex proxy (server.js); if the AI is unavailable
 * it falls back to sensible recipes so a demo never breaks.
 *
 * Run:  node --env-file=.env.local data-server.js
 * Port: DATA_API_PORT (default 5001)
 *
 * Put the transactions file next to this script as: transactions.xlsx
 * (or set TRANSACTIONS_FILE in .env.local)
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());                 // hackathon: allow the frontend from anywhere
app.use(express.json());

const PORT = process.env.PORT || process.env.DATA_API_PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'gradhack-demo-secret-change-me';
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TX_FILE = process.env.TRANSACTIONS_FILE || path.join(__dirname, 'transactions.xlsx');

// ───────────────────────── Health classification ─────────────────────────
const HEALTHY_CATEGORIES = new Set([
  'Whole grains and high-fibre starchy foods',
  'Animal protein',
  'Fruit and vegetables',
  'Dairy',
  'Legumes',
  'Oils, nuts and seeds',
]);
const UNHEALTHY_CATEGORY = 'Unhealthy foods';

// Shelf life (days) by main category — for pantry expiry estimation
const SHELF_LIFE = {
  'Fruit and vegetables': 7,
  'Dairy': 10,
  'Animal protein': 5,
  'Whole grains and high-fibre starchy foods': 60,
  'Legumes': 60,
  'Oils, nuts and seeds': 60,
  'Unhealthy foods': 30,
};

// Photo lookup — curated dish→Unsplash map first, then Pollinations as a last resort.
// Curated URLs are stable and actually look like the dish, which the generator often doesn't.
const PHOTO_FALLBACK = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80';

const DISH_PHOTO_MAP = [
  // Meat/fish dishes
  { match: /pizza/i,                url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80' },
  { match: /burger/i,               url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80' },
  { match: /curry/i,                url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80' },
  { match: /stir[- ]?fry|skillet/i, url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80' },
  { match: /stew|pot(jie)?|potjiekos/i, url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80' },
  { match: /soup/i,                 url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80' },
  { match: /pasta|spaghetti|penne|noodle/i, url: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' },
  { match: /roast|baked/i,          url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80' },
  { match: /grill(ed)?|braai/i,     url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80' },
  { match: /chicken/i,              url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' },
  { match: /beef|steak|ostrich/i,   url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80' },
  { match: /salmon|tuna/i,          url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80' },
  { match: /sardine|pilchard/i,     url: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800&q=80' },
  { match: /fish|hake|snoek/i,      url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' },
  { match: /egg|omelette|frittata/i,url: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80' },
  // Bowls / salads / wraps
  { match: /bowl/i,                 url: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=800&q=80' },
  { match: /salad/i,                url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80' },
  { match: /wrap|burrito|taco/i,    url: 'https://images.unsplash.com/photo-1626082927389-6cd097cee6a6?w=800&q=80' },
  { match: /sandwich|toast/i,       url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80' },
  // Breakfast
  { match: /pancake|waffle/i,       url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80' },
  { match: /smoothie|shake/i,       url: 'https://images.unsplash.com/photo-1546039907-7fa05f864c02?w=800&q=80' },
  { match: /oat|porridge|muesli/i,  url: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=800&q=80' },
  { match: /breakfast/i,            url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' },
  // Legumes / grains / vegetarian
  { match: /lentil|dal|dhal/i,      url: 'https://images.unsplash.com/photo-1585659722983-3a681d8f0c5f?w=800&q=80' },
  { match: /bean|chickpea|hummus/i, url: 'https://images.unsplash.com/photo-1552862750-746b8fdae3f0?w=800&q=80' },
  { match: /samp|umngqusho|mngqusho|maize|pap/i, url: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=800&q=80' },
  { match: /rice|risotto/i,         url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80' },
  { match: /couscous|bulgar|quinoa|buckwheat/i, url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&q=80' },
  { match: /vegetable|veggie|veg\b/i, url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80' },
  { match: /morogo|spinach|greens/i, url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&q=80' },
  { match: /tofu|tempeh/i,          url: 'https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=800&q=80' },
  // Fruit / snack
  { match: /fruit|apple|banana|berry/i, url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&q=80' },
];

export function photoForRecipe(name = '', ingredients = []) {
  const ingNames = Array.isArray(ingredients)
    ? ingredients.map(i => typeof i === 'string' ? i : (i?.name || '')).filter(Boolean).join(' ')
    : '';
  const searchText = `${name} ${ingNames}`;
  for (const entry of DISH_PHOTO_MAP) {
    if (entry.match.test(searchText)) return entry.url;
  }
  return PHOTO_FALLBACK;
}

function photoFor(name = '') {
  return photoForRecipe(name, []);
}


// ───────────────────────── Load & shape the data ─────────────────────────
// In-memory store built once at startup from the Excel.
const DB = {
  customers: {},   // customer_id -> { name, retailer, baskets:[...] }
  prefs: {},       // customer_id -> preferences (mutable at runtime)
  loaded: false,
  error: null,
};

function col(row, ...names) {
  // tolerant column lookup across slight header variations
  for (const n of names) {
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === n.trim().toLowerCase()) return row[key];
    }
  }
  return undefined;
}

function loadExcel() {
  try {
    if (!fs.existsSync(TX_FILE)) {
      DB.error = `Transactions file not found at ${TX_FILE}. Serving computed demo data.`;
      console.warn('[data-api] ' + DB.error);
      seedDemoFallback();
      return;
    }
    const wb = xlsx.readFile(TX_FILE);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    for (const row of rows) {
      const cid = String(col(row, 'Customer ID') || '').trim();
      if (!cid) continue;
      const name = String(col(row, 'Customer name') || '').trim();
      const retailer = String(col(row, 'Retailer') || '').trim();
      const basketId = String(col(row, 'Basket ID') || '').trim();
      const dateRaw = col(row, 'Purchase date');
      const item = String(col(row, 'Food / item') || col(row, 'Food/item') || '').trim();
      const mainCat = String(col(row, 'Main category') || '').trim();
      const subCat = String(col(row, 'Section / subcategory') || col(row, 'Section/subcategory') || '').trim();
      const qty = Number(col(row, 'Quantity')) || 1;
      const unit = Number(col(row, 'Unit price (ZAR)') || col(row, 'Unit price')) || 0;
      const line = Number(col(row, 'Line total (ZAR)') || col(row, 'Line total')) || unit * qty;

      // parse date (already ISO in the sheet; xlsx may give a Date or a string)
      let date;
      if (dateRaw instanceof Date) date = dateRaw;
      else if (typeof dateRaw === 'number') date = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
      else date = new Date(String(dateRaw));
      if (isNaN(date)) date = new Date();

      if (!DB.customers[cid]) DB.customers[cid] = { customer_id: cid, name, retailer, baskets: {} };
      const c = DB.customers[cid];
      if (name && !c.name) c.name = name;
      if (retailer && !c.retailer) c.retailer = retailer;
      if (!c.baskets[basketId]) c.baskets[basketId] = { basket_id: basketId, date, items: [] };
      c.baskets[basketId].items.push({
        name: item, main_category: mainCat, sub_category: subCat,
        qty, unit_price: unit, line_total: line,
        is_healthy: HEALTHY_CATEGORIES.has(mainCat),
        is_healthyfood: HEALTHY_CATEGORIES.has(mainCat),
      });
    }

    // finalise: turn basket maps into sorted arrays, default prefs
    for (const cid of Object.keys(DB.customers)) {
      const c = DB.customers[cid];
      c.baskets = Object.values(c.baskets).sort((a, b) => a.date - b.date);
      // Only seed defaults if the persistent DB has no prefs yet for this customer.
      if (!db.getPrefs(cid)) db.setPrefs(cid, defaultPrefs());
      DB.prefs[cid] = defaultPrefs(); // in-memory mirror for legacy readers
    }
    DB.loaded = true;
    console.log(`[data-api] Loaded ${Object.keys(DB.customers).length} customers from ${path.basename(TX_FILE)}`);
  } catch (e) {
    DB.error = 'Failed to parse Excel: ' + e.message;
    console.error('[data-api] ' + DB.error);
    seedDemoFallback();
  }
}

function defaultPrefs() {
  return {
    allergies: [], diet: 'none', household_size: 4, budget_tier: 'medium',
    training_goal: 'general', upcoming_event: null, power_available: true, heritage_optin: true,
  };
}

// If no Excel is present, synthesise one realistic customer so the API still runs.
function seedDemoFallback() {
  const cid = 'CUST-001';
  DB.customers[cid] = {
    customer_id: cid, name: 'Aisha Van Wyk', retailer: 'Checkers',
    baskets: [
      demoBasket('BASK-1', 21, [
        ['Sardines Ace', 'Animal protein', 163.8],
        ['Buckwheat Pouyoukas', 'Whole grains and high-fibre starchy foods', 117.63],
        ['Fresh vegetables Colavita', 'Fruit and vegetables', 180.99],
        ['Ice cream Sasko', 'Unhealthy foods', 67.69],
      ]),
      demoBasket('BASK-2', 14, [
        ['Samp and beans', 'Legumes', 90],
        ['Tinned tomatoes Tastic', 'Fruit and vegetables', 56.37],
        ['Olive oil', 'Oils, nuts and seeds', 89],
        ['Fizzy drink', 'Unhealthy foods', 54],
      ]),
      demoBasket('BASK-3', 7, [
        ['Fresh fish Ace', 'Animal protein', 203.25],
        ['Fresh fruit', 'Fruit and vegetables', 70],
        ['Maize meal', 'Whole grains and high-fibre starchy foods', 64],
        ['Sugary cereal', 'Unhealthy foods', 55],
      ]),
      demoBasket('BASK-4', 1, [
        ['Ostrich Iwisa', 'Animal protein', 147.86],
        ['Fresh vegetables', 'Fruit and vegetables', 60.33],
        ['Eggs', 'Animal protein', 52],
      ]),
    ],
  };
  DB.prefs[cid] = defaultPrefs();
  if (!db.getPrefs(cid)) db.setPrefs(cid, defaultPrefs());
  DB.loaded = true;
}
function demoBasket(id, daysAgo, items) {
  const date = new Date(Date.now() - daysAgo * 86400 * 1000);
  return {
    basket_id: id, date,
    items: items.map(([name, main_category, line_total]) => ({
      name, main_category, sub_category: '', qty: 1, unit_price: line_total, line_total,
      is_healthy: HEALTHY_CATEGORIES.has(main_category),
      is_healthyfood: HEALTHY_CATEGORIES.has(main_category),
    })),
  };
}

// ───────────────────────── Derived computations ─────────────────────────
function basketScore(basket) {
  const total = basket.items.reduce((s, i) => s + i.line_total, 0);
  if (total <= 0) return 0;
  const healthy = basket.items.filter(i => i.is_healthy).reduce((s, i) => s + i.line_total, 0);
  return Math.round((healthy / total) * 100);
}

function weeklyScores(customer) {
  // group baskets into up to 4 recent weeks
  const scored = customer.baskets.map(b => ({ date: b.date, score: basketScore(b) }));
  const last4 = scored.slice(-4);
  return last4.map((s, i) => ({ week: `W${i + 1}`, score: s.score }));
}

function computeProfile(cid) {
  const c = DB.customers[cid];
  const scores = weeklyScores(c);
  const health_score = scores.length ? scores[scores.length - 1].score : 0;
  const first = scores.length ? scores[0].score : health_score;
  const score_change = health_score - first;

  const allSpend = c.baskets.flatMap(b => b.items);
  const totalSpend = allSpend.reduce((s, i) => s + i.line_total, 0);
  const healthySpend = allSpend.filter(i => i.is_healthy).reduce((s, i) => s + i.line_total, 0);
  const healthy_ratio = totalSpend ? Math.round((healthySpend / totalSpend) * 100) : 0;
  const weeks = Math.max(1, c.baskets.length);
  const avg_weekly_spend = Math.round(totalSpend / weeks);

  const prefsSet = db.getPrefs(cid) || DB.prefs[cid] || defaultPrefs();
  const completeness = 50
    + (prefsSet.allergies.length ? 10 : 0)
    + (prefsSet.diet !== 'none' ? 15 : 0)
    + (prefsSet.upcoming_event ? 15 : 0)
    + (prefsSet.training_goal !== 'general' ? 10 : 0);

  const trend = score_change > 1 ? 'up' : score_change < -1 ? 'down' : 'flat';

  return {
    customer_id: cid,
    name: c.name || 'Customer',
    health_score,
    score_change,
    trend,
    nudge_text: buildNudge(c.name, health_score, trend, healthy_ratio),
    avg_weekly_spend,
    preferred_retailer: c.retailer || 'Checkers',
    healthy_ratio,
    profile_completeness: Math.min(100, completeness),
    preferences: prefsSet,
    milestones: buildMilestones(cid, health_score, healthy_ratio),
  };
}

function buildNudge(name, score, trend, ratio) {
  const first = (name || '').split(' ')[0] || 'there';
  if (trend === 'up') return `Nice work, ${first} — your health score is climbing and ${ratio}% of your basket is now HealthyFood. Keep choosing whole grains and lean protein and you'll hit your next milestone soon.`;
  if (trend === 'down') return `${first}, your basket dipped a little this week — no stress. Adding one or two more fresh or whole-grain items next shop will bring your score right back up.`;
  return `Steady going, ${first}. You're holding a ${score} health score — a couple of smart swaps this week could push you into your next milestone.`;
}

function buildMilestones(cid, score, ratio) {
  const cooked = db.getCooked(cid);
  const saved = db.getSaved(cid);
  const prefs = db.getPrefs(cid) || defaultPrefs();
  const cookedCount = cooked.length;
  const savedCount = saved.length;
  const uniqueRecipes = new Set(cooked.map(c => String(c.recipe_name || '').toLowerCase())).size;
  const hasAllergies = (prefs.allergies || []).length > 0;
  const hasDiet = prefs.diet && prefs.diet !== 'none';

  const weekAgo = Date.now() - 7 * 86400 * 1000;
  const cookedThisWeek = cooked.filter(c => c.cooked_at > weekAgo).length;

  const monthAgo = Date.now() - 30 * 86400 * 1000;
  const cookedThisMonth = cooked.filter(c => c.cooked_at > monthAgo).length;

  const pct = (n, target) => Math.min(100, Math.round((n / target) * 100));

  return [
    // Foundation
    { id: 'first-step',      name: 'First Step',            desc: 'Sign up and start your journey',
      earned: true, progress_pct: 100, points: 100 },
    { id: 'profile-set',     name: 'Profile Perfected',     desc: 'Set a dietary preference',
      earned: hasDiet, progress_pct: hasDiet ? 100 : 0, points: 100 },
    { id: 'allergen-safe',   name: 'Safety First',          desc: 'Register your allergies so we can protect you',
      earned: hasAllergies, progress_pct: hasAllergies ? 100 : 50, points: 100 },

    // Score-based
    { id: 'consistent',      name: 'Consistent Shopper',    desc: 'Reach a 60+ health score',
      earned: score >= 60, progress_pct: pct(score, 60), points: 250 },
    { id: 'hero',            name: 'HealthyFood Hero',      desc: 'Hit an 80% healthy basket',
      earned: score >= 80, progress_pct: pct(score, 80), points: 500 },

    // Cook-based (uses real db data)
    { id: 'pantry-pro',      name: 'Pantry Pro',            desc: 'Cook 5 meals from your pantry',
      earned: cookedCount >= 5, progress_pct: pct(cookedCount, 5), points: 300 },
    { id: 'weekly-cook',     name: 'Weekly Warrior',        desc: 'Cook 3+ meals this week',
      earned: cookedThisWeek >= 3, progress_pct: pct(cookedThisWeek, 3), points: 200 },
    { id: 'iron-chef',       name: 'Iron Chef',             desc: 'Cook 10 different recipes',
      earned: uniqueRecipes >= 10, progress_pct: pct(uniqueRecipes, 10), points: 500 },
    { id: 'diverse-diner',   name: 'Diverse Diner',         desc: 'Try 20+ recipes in a month',
      earned: cookedThisMonth >= 20, progress_pct: pct(cookedThisMonth, 20), points: 400 },

    // Save + explore
    { id: 'recipe-collector',name: 'Recipe Collector',      desc: 'Save 10 recipes to your favourites',
      earned: savedCount >= 10, progress_pct: pct(savedCount, 10), points: 200 },

    // Waste + heritage
    { id: 'zero-waste',      name: 'Zero Waste Hero',       desc: 'Use all expiring items in a week',
      earned: false, progress_pct: ratio > 75 ? 40 : 10, points: 200 },
    { id: 'heritage',        name: 'Heritage Cook',         desc: 'Cook a traditional heritage dish',
      earned: cooked.some(c => /umngqusho|potjie|morogo|pap|samp|braai/i.test(c.recipe_name || '')),
      progress_pct: cooked.some(c => /umngqusho|potjie|morogo|pap|samp|braai/i.test(c.recipe_name || '')) ? 100 : 0,
      points: 300 },
  ];
}

function computePantry(cid) {
  const c = DB.customers[cid];
  const now = Date.now();
  const seen = new Map();
  // items from the last 30 days, most recent first
  const recent = [...c.baskets].reverse();
  for (const b of recent) {
    const ageDays = Math.floor((now - b.date) / 86400000);
    if (ageDays > 30) continue;
    for (const it of b.items) {
      if (seen.has(it.name)) continue;
      const shelf = SHELF_LIFE[it.main_category] ?? 30;
      const days_until_expiry = Math.max(0, shelf - ageDays);
      if (days_until_expiry <= 0) continue; // assume consumed
      seen.set(it.name, {
        name: it.name,
        category: it.main_category,
        is_healthy: it.is_healthy,
        is_healthyfood: it.is_healthyfood,
        days_until_expiry,
        photo: photoFor(it.name),
        allergen_conflict: false,
        diet_conflict: false,
      });
    }
  }
  // Merge in user-added pantry items (from the persistent store)
  const added = db.getPantryAdditions(cid);
  for (const a of added) {
    if (seen.has(a.name)) continue;
    seen.set(a.name, {
      name: a.name,
      category: a.category || 'Added manually',
      is_healthy: HEALTHY_CATEGORIES.has(a.category || ''),
      is_healthyfood: HEALTHY_CATEGORIES.has(a.category || ''),
      days_until_expiry: a.days_until_expiry ?? 14,
      photo: photoFor(a.name),
      allergen_conflict: false,
      diet_conflict: false,
    });
  }
  // apply allergy / diet flags
  const prefs = db.getPrefs(cid) || DB.prefs[cid] || defaultPrefs();
  const items = [...seen.values()].map(i => applyConflicts(i, prefs));
  // sort: expiring first, then healthy
  items.sort((a, b) => a.days_until_expiry - b.days_until_expiry);
  return { items };
}

function applyConflicts(item, prefs) {
  const n = item.name.toLowerCase();
  let allergen_conflict = false, diet_conflict = false;
  for (const a of prefs.allergies) {
    const al = a.toLowerCase().trim();
    if (!al) continue;
    // Named allergen groups (expand a category to its common members)
    if (al === 'shellfish' && (n.includes('prawn') || n.includes('shrimp') || n.includes('mussel') || n.includes('crab') || n.includes('lobster') || n.includes('calamari'))) allergen_conflict = true;
    if ((al === 'fish' || al === 'seafood') && (n.includes('fish') || n.includes('sardine') || n.includes('pilchard') || n.includes('tuna') || n.includes('mackerel') || n.includes('hake') || n.includes('snoek'))) allergen_conflict = true;
    if (al === 'dairy' && (n.includes('milk') || n.includes('cheese') || n.includes('yoghurt') || n.includes('yogurt') || n.includes('cream') || n.includes('butter'))) allergen_conflict = true;
    if (al === 'nuts' && (n.includes('nut') || n.includes('peanut') || n.includes('almond') || n.includes('cashew') || n.includes('pecan'))) allergen_conflict = true;
    if (al === 'gluten' && (n.includes('wheat') || n.includes('bread') || n.includes('pasta') || n.includes('flour') || n.includes('barley'))) allergen_conflict = true;
    if (al === 'eggs' && n.includes('egg')) allergen_conflict = true;
    if (al === 'soy' && (n.includes('soy') || n.includes('soya') || n.includes('tofu'))) allergen_conflict = true;
    // Catch-all: any allergy term that appears literally in the item name.
    // This makes the filter safe even for terms outside the named groups.
    if (n.includes(al)) allergen_conflict = true;
  }
  if ((prefs.diet === 'vegan' || prefs.diet === 'vegetarian') &&
      (item.category === 'Animal protein')) diet_conflict = true;
  if (prefs.diet === 'vegan' && item.category === 'Dairy') diet_conflict = true;
  return { ...item, allergen_conflict, diet_conflict };
}

function computeProgress(cid) {
  const c = DB.customers[cid];
  const scores = weeklyScores(c);
  const recentBasket = c.baskets[c.baskets.length - 1];
  const items = recentBasket ? recentBasket.items : [];
  const healthy_spend = Math.round(items.filter(i => i.is_healthy).reduce((s, i) => s + i.line_total, 0));
  const unhealthy_spend = Math.round(items.filter(i => !i.is_healthy).reduce((s, i) => s + i.line_total, 0));
  const total = healthy_spend + unhealthy_spend;

  // Savings, computed from real spend:
  //  • HealthyFood cashback: ~25% back on healthy spend (Discovery HealthyFood mechanic)
  //  • Waste avoided: value of expiring perishables the app helped cook instead of bin
  //  • Smart swaps: modest saving from suggested cheaper healthy alternatives
  const pantry = computePantry(cid).items;
  const expiringValue = Math.round(
    pantry.filter(i => i.days_until_expiry <= 3 && i.is_healthy).length * 42
  ); // avg perishable value rescued
  const cashback = Math.round(healthy_spend * 0.25);
  const swaps = Math.round(healthy_spend * 0.08);
  const savingsTotal = cashback + expiringValue + swaps;

  return {
    weekly_scores: scores,
    basket_split: { healthy_spend, unhealthy_spend },
    healthyfood_adoption_pct: total ? Math.round((healthy_spend / total) * 100) : 0,
    total_vitality_points: 350 + scores.reduce((s, w) => s + w.score, 0),
    savings: {
      healthyfood_cashback: cashback,
      waste_avoided: expiringValue,
      smart_swaps: swaps,
      total: savingsTotal,
    },
    monthly_savings_trend: [
      { month: 'Apr', amount: Math.round(savingsTotal * 0.45) },
      { month: 'May', amount: Math.round(savingsTotal * 0.73) },
      { month: 'Jun', amount: savingsTotal },
    ],
    shopping_list: [
      { name: 'Low-sodium stock', retailer: c.retailer || 'Checkers', is_healthyfood: true },
      { name: 'Wholewheat pasta', retailer: c.retailer || 'Checkers', is_healthyfood: true },
    ],
  };
}

// ───────────────────────── Heritage calendar ─────────────────────────
const SA_DAYS = [
  { name: 'Human Rights Day', m: 3, d: 21 },
  { name: 'Freedom Day', m: 4, d: 27 },
  { name: 'Africa Day', m: 5, d: 25 },
  { name: 'Youth Day', m: 6, d: 16 },
  { name: "Women's Day", m: 8, d: 9 },
  { name: 'Heritage Day', m: 9, d: 24 },
];
const HERITAGE_DISHES = {
  "Women's Day": { name: 'Umngqusho', origin: 'Xhosa', context: 'Slow-cooked samp and beans — humble, hearty, and a complete protein when combined. A dish shared across South African kitchens for generations.', photo: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=800&q=80', ingredients_have: ['Samp and beans', 'Tinned tomatoes', 'Olive oil'], ingredients_needed: ['Onions'] },
  'Heritage Day': { name: 'Potjiekos', origin: 'Widely shared', context: 'A slow-simmered one-pot stew cooked over coals — the very spirit of a South African braai gathering.', photo: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=800&q=80', ingredients_have: ['Fresh vegetables', 'Tinned tomatoes'], ingredients_needed: ['Meat of choice', 'Potatoes'] },
  'Africa Day': { name: 'Morogo & Pap', origin: 'Widely shared', context: 'Wild leafy greens with maize meal — deeply traditional and exceptionally nutrient-dense.', photo: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=800&q=80', ingredients_have: ['Maize meal', 'Fresh vegetables'], ingredients_needed: ['Morogo (spinach works too)'] },
};
function computeHeritage() {
  const now = new Date();
  for (const day of SA_DAYS) {
    const target = new Date(now.getFullYear(), day.m - 1, day.d);
    const diff = Math.ceil((target - now) / 86400000);
    if (diff >= 0 && diff <= 5) {
      const dish = HERITAGE_DISHES[day.name] || HERITAGE_DISHES["Women's Day"];
      return { celebration: day.name, days_away: diff, dish };
    }
  }
  return { celebration: null, days_away: -1, dish: null };
}

// ───────────────────────── Community (static-ish) ─────────────────────────
function computeCommunity() {
  return {
    active_challenge: {
      id: 'c1', name: 'Heritage Week Cook-Along',
      theme: 'Cook one traditional South African dish from your pantry',
      days_left: 4, bonus_points: 500, participants: 34,
      collective_goal: 100, collective_done: 61, joined: true, you_cooked: false,
      neighbours: ['TM', 'SN', 'LK', 'PD', 'JV', 'RM'],
      recent_activity: [
        { who: 'Thandi M.', what: 'cooked morogo with maize meal', when: '2h ago' },
        { who: 'Sipho N.', what: 'shared a potjiekos photo', when: '5h ago' },
        { who: 'Lerato K.', what: 'joined the cook-along', when: 'yesterday' },
      ],
    },
    upcoming: [{ name: 'Zero-Waste Week', starts: '18 Aug', desc: 'Cook only from what you already have' }],
  };
}

// ───────────────────────── Recipes via Gemini (Google AI Studio) ─────────────────────────
const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

async function callGemini(promptText) {
  if (!genAI) throw new Error('GEMINI_API_KEY not set — using fallback');
  const response = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: promptText,
    config: { responseMimeType: 'application/json', temperature: 0.6 },
  });
  const text = response.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// Classifies a raw pantry-item name into one of the HEALTHY_CATEGORIES
// (or 'Unhealthy foods'). Falls back to a keyword rule if Gemini is unavailable.
async function categorizePantryItem(name) {
  const CATEGORIES = [
    'Fruit and vegetables',
    'Animal protein',
    'Dairy',
    'Whole grains and high-fibre starchy foods',
    'Legumes',
    'Oils, nuts and seeds',
    'Unhealthy foods',
  ];
  // Rule-based first (fast + deterministic for well-known items)
  const n = name.toLowerCase();
  if (/chocolate|sweet|candy|chips|crisp|soda|cola|fizzy|ice cream|cookie|biscuit|rusks?|cake|pastry/.test(n)) return 'Unhealthy foods';
  if (/onion|garlic|tomato|spinach|carrot|pepper|fruit|vegetable|salad|lettuce|cucumber|potato|apple|banana|orange|grape|berry|mango|avocado|leek|celery|broccoli|cauliflower|kale|beet/.test(n)) return 'Fruit and vegetables';
  if (/chicken|beef|fish|tuna|sardine|mince|steak|egg|ostrich|pork|lamb|mackerel|hake|snoek|prawn|pilchard/.test(n)) return 'Animal protein';
  if (/yogurt|yoghurt|milk|cheese|cream|amasi|maas/.test(n)) return 'Dairy';
  if (/samp|maize|couscous|rice|noodle|pasta|bulgar|buckwheat|oats|bread|quinoa|barley/.test(n)) return 'Whole grains and high-fibre starchy foods';
  if (/bean|lentil|chickpea|split pea/.test(n)) return 'Legumes';
  if (/oil|nut|seed|olive|almond|cashew|pecan|peanut/.test(n)) return 'Oils, nuts and seeds';
  // Fall back to Gemini if enabled
  if (!genAI) return 'Fruit and vegetables';
  try {
    const out = await callGemini(`Classify this pantry item into exactly ONE of these South African HealthyFood categories: ${CATEGORIES.join(' | ')}. Item: "${name}". Return strict JSON: {"category": "..."}. No preamble.`);
    const cat = out?.category;
    return CATEGORIES.includes(cat) ? cat : 'Fruit and vegetables';
  } catch (_) {
    return 'Fruit and vegetables';
  }
}

// Ingredients/terms strictly forbidden by each diet — used to filter Gemini output
// AND to reject fallback recipes. Regexes are word-boundary based to avoid false positives
// (e.g. "milk thistle" wouldn't be catastrophic on a vegan diet but the risk of a real
// dairy leak outweighs a few false rejects).
const DIET_FORBIDDEN = {
  vegan:        /\b(chicken|beef|pork|lamb|mutton|ostrich|game|meat|bacon|ham|sausage|salami|fish|tuna|sardine|pilchard|snoek|mackerel|hake|salmon|prawn|shrimp|mussel|calamari|crab|lobster|anchovy|egg|milk|cheese|yog(h)?urt|cream|butter|whey|casein|gelatin|honey)\b/i,
  vegetarian:   /\b(chicken|beef|pork|lamb|mutton|ostrich|game|meat|bacon|ham|sausage|salami|fish|tuna|sardine|pilchard|snoek|mackerel|hake|salmon|prawn|shrimp|mussel|calamari|crab|lobster|anchovy|gelatin)\b/i,
  pescatarian:  /\b(chicken|beef|pork|lamb|mutton|ostrich|game|meat|bacon|ham|sausage|salami|gelatin)\b/i,
  halal:        /\b(pork|bacon|ham|prosciutto|salami|pepperoni|lard|alcohol|wine|beer|rum|whisky|whiskey|vodka|liqueur|brandy|sake)\b/i,
  banting:      /\b(bread|pasta|rice|maize|samp|couscous|noodle|potato|sugar|honey|banana|oats|cereal|flour|wheat)\b/i,
  diabetic:     /\b(sugar|syrup|honey|dessert|candy|cake|cookie|biscuit|chocolate|soda|cola|fizzy)\b/i,
};

function dietCompatible(recipe, diet) {
  if (!diet || diet === 'none' || diet === 'all') return true;
  const forbidden = DIET_FORBIDDEN[String(diet).toLowerCase()];
  if (!forbidden) return true;
  // Check name, ingredients, steps — but not health_benefit (marketing copy)
  const parts = [
    recipe.name || '',
    (recipe.ingredients || []).map(i => (typeof i === 'string' ? i : i.name)).join(' '),
    (recipe.missing_items || []).map(i => (typeof i === 'string' ? i : i.name)).join(' '),
    (recipe.steps || []).join(' '),
  ].join(' ');
  return !forbidden.test(parts);
}

async function generateRecipes(cid, query = {}) {
  const pantry = computePantry(cid).items;
  const prefs = db.getPrefs(cid) || DB.prefs[cid] || defaultPrefs();
  const safePantry = pantry.filter(i => !i.allergen_conflict && !i.diet_conflict).map(i => i.name);
  const expiring = pantry.filter(i => i.days_until_expiry <= 3 && !i.allergen_conflict && !i.diet_conflict).map(i => i.name);

  // Learning signal: recent cooks + explicit reviews
  const cooked = db.getCooked(cid).slice(0, 8).map(c => c.recipe_name);
  const liked = db.getLikedRecipes(cid);
  const disliked = db.getDislikedRecipes(cid);

  const userQuery = query.search || query.q || query.prompt || '';
  const searchPrompt = userQuery ? `User custom craving/search request: "${userQuery}". Build recipes specifically matching this request while strictly utilizing the user's pantry items below.` : '';

  const historyBlock = (cooked.length || liked.length || disliked.length) ? `
Recent cooking history — recipes user has actually cooked (suggest similar styles): ${cooked.join(', ') || 'none'}
Liked recipes (lean into these flavours/techniques): ${liked.join(', ') || 'none'}
Disliked recipes (AVOID recipes similar to these): ${disliked.join(', ') || 'none'}` : '';

  const dietRule = prefs.diet && prefs.diet !== 'none' && prefs.diet !== 'all'
    ? `HARD DIETARY CONSTRAINT — the user follows a ${prefs.diet} diet. NEVER include or reference: ` + ({
        vegan: 'meat, poultry, fish, seafood, eggs, dairy (milk, cheese, yoghurt, cream, butter), honey, gelatin.',
        vegetarian: 'meat, poultry, fish, seafood, or gelatin.',
        pescatarian: 'meat or poultry.',
        halal: 'pork, bacon, ham, prosciutto, alcohol, wine, beer, spirits.',
        banting: 'bread, pasta, rice, maize/samp/couscous, potatoes, sugar, honey, oats, wheat/flour.',
        diabetic: 'added sugar, syrup, honey, sugary drinks, sweets/desserts/cakes/cookies.',
      }[String(prefs.diet).toLowerCase()] || 'anything the user cannot eat.') + ' If a pantry item violates this diet, exclude it and pick alternatives.'
    : '';

  const prompt = `You are the Discovery HealthyFood AI Agent & Recipe Search Assistant for South Africa.
CRITICAL: You MUST construct recipes using the user's EXACT pantry inventory below:
User Pantry Items: ${safePantry.join(', ')}
Expiring Soon (MUST prioritize using these): ${expiring.join(', ') || 'none'}
Household size: ${prefs.household_size}
${dietRule}
Allergies to avoid completely (HARD RULE — never include or suggest these or foods that contain them): ${prefs.allergies.join(', ') || 'none'}
Context: event=${query.event || 'none'}, goal=${query.goal || 'general'}, power=${query.power || 'on'}.
${historyBlock}
${searchPrompt}

Rule: Ingredients MUST specify exact items from the user's pantry (e.g. "${safePantry[0] || 'Fresh Vegetables'}", "${safePantry[1] || 'Sardines'}"). Do NOT use generic names like "Protein" or "Grains".
Return strict JSON format:
{
  "recipes": [
    {
      "name": "Recipe Title",
      "photo": "",
      "prep_time_category": "15 Min Quick Meals",
      "cook_time_minutes": 15,
      "cooking_method": "⚡ Quick",
      "diet_tags": ["pescatarian", "halal"],
      "all_in_pantry": true,
      "missing_items": [],
      "ingredients": [{"name": "${safePantry[0] || 'Fresh Vegetables'}", "amount": "1 cup", "alternative": "Tinned Veg"}],
      "health_benefit": "High in nutrients for heart health.",
      "allergy_safe": true,
      "uses_expiring": true,
      "servings": ${prefs.household_size},
      "calories": 420,
      "budget_savings_rand": 45,
      "steps": ["Detailed step 1 with technique and timing", "Detailed step 2", "..."]
    }
  ]
}
Generate 6 diverse personalized recipes — vary cooking methods (bake, stir-fry, boil, no-cook, one-pot) and meal types (light, hearty, quick, slow) so the user has real choice. When the user's search names an ingredient (e.g. "chicken"), return several distinct dishes featuring that ingredient (soups, bowls, curries, salads, roasts).
Only pantry ingredients (plus 1-2 common staples in missing_items if necessary).
STEPS QUALITY: 5-8 steps per recipe. Each step is 1-2 sentences, includes specifics — heat level (medium / high), timing (e.g. "5 minutes until softened"), technique (stir, fold, baste), and visual cues (golden brown, aromatic, reduced by half). No vague steps like "cook until done". Start steps with an action verb.
No preamble.`;

  const out = await callGemini(prompt);
  const dislikedLower = new Set(disliked.map(d => d.toLowerCase()));
  const recipes = (out.recipes || []).map(r => ({
    ...r,
    photo: photoForRecipe(r.name, r.ingredients),
  })).filter(r => {
    // Hard allergen re-check on the AI output
    const text = JSON.stringify(r).toLowerCase();
    if (prefs.allergies.some(a => a && text.includes(a.toLowerCase()))) return false;
    // Hard diet re-check — vegan users NEVER see meat/fish/dairy etc.
    if (!dietCompatible(r, prefs.diet)) return false;
    // Exclude anything that matches a previously disliked recipe by name
    if (dislikedLower.has(String(r.name).toLowerCase())) return false;
    return true;
  });
  if (!recipes.length) throw new Error('no safe recipes generated');
  return { recipes };
}

// ───────────────────────── Auth (persistent) ─────────────────────────
function seedDemoUser() {
  // Only seed if not already in the persistent store
  if (!db.userExists('aisha')) {
    db.createUser('aisha', { hash: bcrypt.hashSync('demo123', 8), customer_id: 'CUST-001', name: 'Aisha' });
  }
}

// Attaches req.user if a valid Bearer token is present. Never blocks.
function authOptional(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch (_) { /* ignore */ }
  }
  next();
}

// Requires a valid Bearer token; 401 otherwise.
function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (e) { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

app.use(authOptional);

// ───────────────────────── Routes ─────────────────────────
app.get('/health', (req, res) => res.json({
  ok: true, loaded: DB.loaded, customers: Object.keys(DB.customers).length,
  data_source: DB.error ? 'computed-demo' : 'excel', note: DB.error || 'ok',
}));

app.post('/auth/register', (req, res) => {
  const { username, password, name, preferences } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });
  if (db.userExists(username)) return res.status(409).json({ error: 'username already taken' });

  const customer_id = db.allocateCustomerId();
  db.createUser(username, {
    hash: bcrypt.hashSync(password, 8),
    customer_id,
    name: name || username,
  });

  // Seed prefs (or defaults) — this is where signup collects allergies/diet
  const seededPrefs = { ...defaultPrefs(), ...(preferences || {}) };
  db.setPrefs(customer_id, seededPrefs);

  // Create an empty customer stub so all downstream computations work
  if (!DB.customers[customer_id]) {
    DB.customers[customer_id] = { customer_id, name: name || username, retailer: 'Checkers', baskets: [] };
  }

  const token = jwt.sign({ username: username.toLowerCase(), customer_id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, customer_id, name: name || username, preferences: seededPrefs });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const u = db.getUser(username);
  if (!u || !bcrypt.compareSync(password, u.hash)) {
    return res.status(401).json({ error: 'invalid username or password' });
  }
  const token = jwt.sign({ username: u.username, customer_id: u.customer_id }, JWT_SECRET, { expiresIn: '24h' });
  const name = DB.customers[u.customer_id]?.name || u.name || u.username;
  res.json({ token, customer_id: u.customer_id, name, preferences: db.getPrefs(u.customer_id) || defaultPrefs() });
});

app.get('/auth/me', authRequired, (req, res) => {
  const cid = req.user.customer_id;
  const u = db.getUser(req.user.username);
  if (!u) return res.status(404).json({ error: 'user not found' });
  res.json({
    username: u.username,
    customer_id: cid,
    name: DB.customers[cid]?.name || u.name || u.username,
    preferences: db.getPrefs(cid) || defaultPrefs(),
  });
});

function resolveCid(req) {
  // Prefer authenticated user's customer_id when present
  if (req.user?.customer_id) {
    const c = req.user.customer_id;
    // Ensure a customer stub exists for new users who haven't loaded transaction data
    if (!DB.customers[c]) {
      DB.customers[c] = { customer_id: c, name: req.user.username, retailer: 'Checkers', baskets: [] };
    }
    return c;
  }
  const cid = req.params.customerId;
  if (DB.customers[cid]) return cid;
  const keys = Object.keys(DB.customers);
  return keys.includes('CUST-001') ? 'CUST-001' : keys[0];
}

app.get('/profile/:customerId', (req, res) => {
  try { res.json(computeProfile(resolveCid(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/profile/:customerId/preferences', (req, res) => {
  const cid = resolveCid(req);
  const updated = db.setPrefs(cid, req.body || {});
  DB.prefs[cid] = updated; // keep legacy mirror in sync
  res.json(updated);
});

app.get('/pantry/:customerId', (req, res) => {
  try { res.json(computePantry(resolveCid(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/pantry/:customerId/add', async (req, res) => {
  const cid = resolveCid(req);
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });

  // Auto-categorize if not provided
  let category = req.body?.category;
  if (!category) {
    try { category = await categorizePantryItem(name); }
    catch (_) { category = 'Fruit and vegetables'; }
  }

  db.addPantryItem(cid, {
    name,
    category,
    days_until_expiry: req.body?.days_until_expiry ?? 14,
  });
  res.json(computePantry(cid));
});

app.delete('/pantry/:customerId/item/:name', (req, res) => {
  const cid = resolveCid(req);
  const removed = db.removePantryItem(cid, req.params.name);
  res.json({ ok: true, removed, pantry: computePantry(cid) });
});

// Standalone category classifier — frontend can preview before adding
app.post('/pantry/categorize', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const category = await categorizePantryItem(name);
    res.json({ name, category });
  } catch (e) {
    res.json({ name, category: 'Fruit and vegetables', note: 'fallback' });
  }
});

// ── Cooked tracking ──
app.post('/cooked/:customerId', (req, res) => {
  const cid = resolveCid(req);
  const { recipe_name, ingredients, tags } = req.body || {};
  if (!recipe_name) return res.status(400).json({ error: 'recipe_name required' });
  db.addCooked(cid, { recipe_name, ingredients: ingredients || [], tags: tags || [] });
  res.json({ ok: true, cooked: db.getCooked(cid).slice(0, 10) });
});
app.get('/cooked/:customerId', (req, res) => {
  const cid = resolveCid(req);
  res.json({ items: db.getCooked(cid) });
});

// ── Saved recipes (per-user, isolated) ──
app.get('/saved/:customerId', (req, res) => {
  const cid = resolveCid(req);
  res.json({ items: db.getSaved(cid) });
});
app.post('/saved/:customerId', (req, res) => {
  const cid = resolveCid(req);
  const recipe = req.body?.recipe;
  if (!recipe?.name) return res.status(400).json({ error: 'recipe (with a name) required' });
  db.addSaved(cid, recipe);
  res.json({ ok: true, items: db.getSaved(cid) });
});
app.delete('/saved/:customerId/:name', (req, res) => {
  const cid = resolveCid(req);
  const removed = db.removeSaved(cid, decodeURIComponent(req.params.name));
  res.json({ ok: true, removed, items: db.getSaved(cid) });
});

// ── Reviews (like/dislike) ──
app.post('/reviews/:customerId', (req, res) => {
  const cid = resolveCid(req);
  const { recipe_name, rating, tags } = req.body || {};
  if (!recipe_name || (rating !== 1 && rating !== -1)) {
    return res.status(400).json({ error: 'recipe_name and rating (1 or -1) required' });
  }
  db.setReview(cid, recipe_name, { rating, tags: tags || [] });
  res.json({ ok: true, reviews: db.getReviews(cid) });
});
app.get('/reviews/:customerId', (req, res) => {
  const cid = resolveCid(req);
  res.json({ reviews: db.getReviews(cid) });
});

app.get('/recipes/:customerId', async (req, res) => {
  const cid = resolveCid(req);
  try {
    const data = await generateRecipes(cid, req.query);
    res.json(data);
  } catch (e) {
    console.warn('[data-api] recipe AI fallback:', e.message);
    res.json(fallbackRecipes(cid, req.query));
  }
});

function fallbackRecipes(cid, query = {}) {
  const prefs = db.getPrefs(cid) || DB.prefs[cid] || defaultPrefs();
  // Respect BOTH allergens and diet when choosing pantry basis
  const pantry = computePantry(cid).items.filter(i => !i.allergen_conflict && !i.diet_conflict);
  const names = pantry.map(i => i.name);
  const has = (kw) => names.find(n => n.toLowerCase().includes(kw));
  const userSearch = (query.search || query.q || '').trim().toLowerCase();

  const recipes = [];

  // Diet-safe defaults — used when the pantry doesn't have a diet-appropriate item
  const dietDefaults = {
    vegan:       { protein: 'Lentils',   dairy: null,          egg: null },
    vegetarian:  { protein: 'Lentils',   dairy: 'Yoghurt',     egg: 'Eggs' },
    pescatarian: { protein: 'Sardines',  dairy: 'Yoghurt',     egg: 'Eggs' },
    halal:       { protein: 'Chicken',   dairy: 'Yoghurt',     egg: 'Eggs' },
    banting:     { protein: 'Chicken',   dairy: 'Cheese',      egg: 'Eggs' },
    diabetic:    { protein: 'Chicken',   dairy: 'Yoghurt',     egg: 'Eggs' },
    none:        { protein: 'Chicken',   dairy: 'Yoghurt',     egg: 'Eggs' },
    all:         { protein: 'Chicken',   dairy: 'Yoghurt',     egg: 'Eggs' },
  };
  const dd = dietDefaults[String(prefs.diet || 'none').toLowerCase()] || dietDefaults.none;

  // Pick a diet-appropriate protein from pantry, else fall back to a safe default
  const isVegan = prefs.diet === 'vegan';
  const isVeggie = isVegan || prefs.diet === 'vegetarian';
  const protein = (
    (!isVeggie && (has('sardine') || has('fish') || has('ostrich') || has('chicken'))) ||
    (!isVegan && has('egg')) ||
    has('bean') || has('lentil') || has('chickpea') ||
    (isVeggie ? dd.protein : (names[0] || dd.protein))
  );
  const grain = has('buckwheat') || has('samp') || has('maize') || has('couscous') || has('noodle') || has('bulgar') || has('rice') || (prefs.diet === 'banting' ? 'Cauliflower' : (names[1] || 'Wholewheat Couscous'));
  const veg = has('vegetable') || has('tomato') || has('fruit') || has('spinach') || (names[2] || 'Fresh Vegetables');

  if (userSearch.includes('soup') || userSearch.includes('stew') || userSearch.includes('warm')) {
    recipes.push(mkRecipe(`Pantry ${capitalize(userSearch)} with ${veg}`, ['⏳ Long cook', 35], [veg, grain, 'Tinned Tomatoes'], 'Immunity boosting warm meal using your pantry items.', true));
    recipes.push(mkRecipe(`Hearty ${grain} & ${veg} Pot`, ['🔥 Gas-friendly', 25], [veg, 'Tinned Tomatoes', grain], 'Slow-release energy with deep South African flavors.', false));
    recipes.push(mkRecipe(`Zero-Waste ${protein} Soup`, ['⚡ Quick', 20], [protein, veg, 'Plain Dried Herbs'], 'Reduces food waste while delivering complete protein.', true));
  } else if (userSearch.includes('protein') || userSearch.includes('workout') || userSearch.includes('muscle')) {
    recipes.push(mkRecipe(`High-Protein ${protein} & ${grain} Bowl`, ['⚡ Quick', 15], [protein, grain, veg], 'High Omega-3s and lean protein for muscle recovery.', true));
    recipes.push(mkRecipe(`Searing ${protein} & ${veg} Skillet`, ['⚡ Quick', 12], [protein, veg, 'Olive Oil'], 'Low-carb, high-protein meal made from your pantry.', false));
    recipes.push(mkRecipe(`Power ${grain} & ${protein} Salad`, ['❄ No-cook', 10], [protein, grain, veg], 'Nutrient dense energy meal packed with iron.', true));
  } else if (userSearch) {
    const s = capitalize(userSearch);
    recipes.push(mkRecipe(`Pantry ${s} with ${protein}`, ['⚡ Quick', 15], [protein, grain, veg], `Custom AI recipe for ${userSearch} using your pantry.`, true));
    recipes.push(mkRecipe(`Savory ${s} Medley`, ['🔥 Gas-friendly', 20], [grain, veg, 'Olive Oil'], `Pantry staples reworked around ${userSearch}.`, false));
    recipes.push(mkRecipe(`Quick ${veg} & ${protein} Stir-Fry`, ['⚡ Quick', 10], [protein, veg], `Fast healthy meal customized to your available items.`, true));
    recipes.push(mkRecipe(`${s} Bowl with ${grain}`, ['⚡ Quick', 12], [protein, grain, veg], `A bowl-style ${userSearch} dish balancing protein and slow carbs.`, false));
    recipes.push(mkRecipe(`Hearty ${s} & ${grain} Pot`, ['⏳ Long cook', 40], [protein, grain, veg, 'Tinned Tomatoes'], `Slow-cooked ${userSearch} for comfort and depth of flavor.`, true));
    recipes.push(mkRecipe(`Zesty ${s} & ${veg} Salad`, ['❄ No-cook', 8], [veg, protein, 'Olive Oil'], `Light, no-cook ${userSearch} salad — perfect quick lunch.`, false));
    recipes.push(mkRecipe(`Roast ${s} with ${veg}`, ['🔥 Oven', 35], [protein, veg, 'Olive Oil'], `A more traditional ${userSearch} roast, uses items you have.`, false));
  } else {
    recipes.push(mkRecipe(`${protein} & ${veg} with ${grain}`, ['⚡ Quick', 15], [protein, grain, veg, 'Olive Oil'], 'High in protein and Omega-3s using your pantry items.', true));
    recipes.push(mkRecipe(`Hearty ${veg} & ${grain} Stew`, ['⏳ Long cook', 45], [grain, veg, 'Tinned Tomatoes'], 'Rich in fibre and antioxidants with zero waste.', false));
    recipes.push(mkRecipe(`Fresh Fruit & ${grain} Breakfast Bowl`, ['❄ No-cook', 5], ['Fresh Fruit', grain], 'Vitamins and complex carbs from your pantry to start your day.', false));
    recipes.push(mkRecipe(`One-pot ${protein} & ${grain}`, ['🔥 One-pot', 25], [protein, grain, veg], 'Weeknight one-pot — minimal washing up, maximum nutrition.', false));
    recipes.push(mkRecipe(`${veg} & ${grain} Wrap`, ['⚡ Quick', 8], [veg, grain, 'Olive Oil'], 'Quick lunch wrap with what you have on hand.', false));
    recipes.push(mkRecipe(`Zero-waste ${protein} bake`, ['🔥 Oven', 30], [protein, veg, 'Tinned Tomatoes'], 'Baked and forgiving — uses items before they turn.', true));
  }

  const wantedMax = userSearch ? 8 : 6;
  // Filter out anything that violates the user's diet
  return { recipes: recipes.filter(r => dietCompatible(r, prefs.diet)).slice(0, wantedMax) };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mkRecipe(name, [method, mins], ingredientNames, benefit, expiring) {
  const ingredients = ingredientNames.map(n => ({ name: typeof n === 'string' ? n : n.name, amount: '1 portion' }));
  const first = ingredients[0]?.name || 'main ingredient';
  const second = ingredients[1]?.name || 'accompaniment';
  const rest = ingredients.slice(2).map(i => i.name).join(', ') || 'remaining pantry items';
  const isQuick = mins <= 15;
  const isNoCook = /No[- ]cook/i.test(method);

  const steps = isNoCook ? [
    `Wash and roughly chop ${first} and ${second} into bite-sized pieces — about the size of a R2 coin.`,
    `Combine the chopped ${first}, ${second} and ${rest} in a large mixing bowl.`,
    `Drizzle with 1 tablespoon of olive oil and squeeze over half a lemon (or a splash of vinegar). Toss gently for even coverage.`,
    `Season with sea salt, black pepper, and any fresh or dried herbs you have — build flavor a pinch at a time and taste.`,
    `Let the mixture rest for 3-5 minutes so the flavors marry before serving.`,
    `Plate up and finish with a final crack of pepper. Serves ${4}.`,
  ] : [
    `Prep your ingredients first: chop ${first} into even bite-sized pieces, slice ${second} thinly, and set the rest (${rest}) within arm's reach.`,
    `Warm 1 tablespoon of oil in a heavy pan over medium heat until it shimmers — about 60 seconds.`,
    `Add ${first} and cook for ${Math.max(4, Math.floor(mins / 4))} minutes, stirring occasionally, until it starts to color at the edges and smells fragrant.`,
    `Stir in ${second} and the remaining ${rest}. Season with salt, pepper, and any spices you have (a teaspoon of paprika or curry powder lifts most pantry dishes).`,
    `Add a splash of water or stock (about 100ml), cover, and simmer on low for ${isQuick ? Math.max(4, mins - 5) : Math.max(10, mins - 10)} minutes so the flavors deepen. Stir once halfway through.`,
    `Taste and adjust seasoning — a squeeze of lemon at the end brightens everything. If it looks dry, add a splash more water; if too wet, uncover for the last 2 minutes.`,
    `Rest off the heat for 2 minutes, then plate up and serve while warm. Serves ${4}.`,
  ];

  return {
    name,
    photo: photoForRecipe(name, ingredients),
    prep_time_category: `${mins} Min Meals`,
    cook_time_minutes: mins,
    cooking_method: method,
    diet_tags: ['halal', 'healthyfood'],
    all_in_pantry: true,
    missing_items: [],
    ingredients,
    health_benefit: benefit,
    allergy_safe: true,
    uses_expiring: expiring,
    servings: 4,
    calories: 380,
    budget_savings_rand: 35,
    steps,
  };
}


app.get('/progress/:customerId', (req, res) => {
  try { res.json(computeProgress(resolveCid(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/heritage/today', (req, res) => res.json(computeHeritage()));
app.get('/community/:customerId', (req, res) => res.json(computeCommunity()));

// ───────────────────────── Smart Shopping List ─────────────────────────
// Rough ZAR retail estimates by category — good enough for a total.
const COST_BY_CATEGORY = {
  'Fruit and vegetables': 25,
  'Animal protein': 70,
  'Dairy': 30,
  'Whole grains and high-fibre starchy foods': 40,
  'Legumes': 25,
  'Oils, nuts and seeds': 55,
  'Unhealthy foods': 30,
};
const DEFAULT_COST = 30;

const BUDGET_TARGET_BY_TIER = { low: 150, medium: 300, high: 500 };

// HealthyFood staples that are broadly useful when a pantry gap exists.
const STAPLE_SUGGESTIONS = [
  { name: 'Onions', category: 'Fruit and vegetables', is_healthyfood: false },
  { name: 'Garlic', category: 'Fruit and vegetables', is_healthyfood: false },
  { name: 'Plain Yoghurt', category: 'Dairy', is_healthyfood: true },
  { name: 'Lentils', category: 'Legumes', is_healthyfood: true },
];

function categoryFor(name = '') {
  const n = name.toLowerCase();
  if (/onion|garlic|tomato|spinach|carrot|pepper|fruit|veg|salad|lettuce|cucumber|potato/.test(n)) return 'Fruit and vegetables';
  if (/chicken|beef|fish|tuna|sardine|mince|steak|egg|ostrich|pork|lamb/.test(n)) return 'Animal protein';
  if (/yogurt|yoghurt|milk|cheese|cream/.test(n)) return 'Dairy';
  if (/samp|maize|couscous|rice|noodle|pasta|bulgar|buckwheat|oats|bread/.test(n)) return 'Whole grains and high-fibre starchy foods';
  if (/bean|lentil|chickpea|pea/.test(n)) return 'Legumes';
  if (/oil|nut|seed|olive|avocado/.test(n)) return 'Oils, nuts and seeds';
  return 'Fruit and vegetables';
}

function estimateCost(name, category) {
  return COST_BY_CATEGORY[category] || DEFAULT_COST;
}

function computeShoppingList(cid) {
  const prefs = DB.prefs[cid] || defaultPrefs();
  const pantry = computePantry(cid).items;
  const items = [];
  const seen = new Set();

  const push = (item) => {
    const key = item.name.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  // Priority 1 — expiring perishables: suggest fresh replacements
  const expiring = pantry.filter(i => i.days_until_expiry <= 3 && i.is_healthy);
  for (const ex of expiring) {
    push({
      name: `Fresh ${ex.name}`,
      category: ex.category,
      priority: 'high',
      reason: `Your ${ex.name} expires in ${ex.days_until_expiry} day${ex.days_until_expiry === 1 ? '' : 's'} — replace on your next shop`,
      estimated_cost: estimateCost(ex.name, ex.category),
      is_healthyfood: ex.is_healthyfood,
    });
  }

  // Priority 2 — missing items across a set of pantry recipes
  const suggested = fallbackRecipes(cid, {}).recipes;
  for (const r of suggested) {
    for (const m of (r.missing_items || [])) {
      const cat = categoryFor(m.name);
      push({
        name: m.name,
        category: cat,
        priority: 'medium',
        reason: `Needed for "${r.name}"`,
        estimated_cost: estimateCost(m.name, cat),
        is_healthyfood: !!m.is_healthyfood,
      });
    }
  }

  // Priority 3 — category gaps based on diet
  const pantryCats = new Set(pantry.map(i => i.category));
  if (!pantryCats.has('Legumes') && prefs.diet !== 'banting') {
    push({
      name: 'Lentils',
      category: 'Legumes',
      priority: 'low',
      reason: 'No legumes in your pantry — great cheap plant protein',
      estimated_cost: estimateCost('Lentils', 'Legumes'),
      is_healthyfood: true,
    });
  }
  if (!pantryCats.has('Dairy') && !prefs.allergies?.includes('dairy')) {
    push({
      name: 'Plain Yoghurt',
      category: 'Dairy',
      priority: 'low',
      reason: 'No dairy in your pantry — good source of calcium and probiotics',
      estimated_cost: estimateCost('Plain Yoghurt', 'Dairy'),
      is_healthyfood: true,
    });
  }
  if (!pantry.some(i => /onion|garlic/i.test(i.name))) {
    push({
      name: 'Onions & Garlic',
      category: 'Fruit and vegetables',
      priority: 'low',
      reason: 'Kitchen staples that stretch every meal',
      estimated_cost: 25,
      is_healthyfood: false,
    });
  }

  // Sort: high → medium → low
  const rank = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => rank[a.priority] - rank[b.priority]);

  const total = items.reduce((s, i) => s + (i.estimated_cost || 0), 0);
  const target = BUDGET_TARGET_BY_TIER[prefs.budget_tier] || BUDGET_TARGET_BY_TIER.medium;
  const status = total < target * 0.9 ? 'under' : total > target * 1.1 ? 'over' : 'at';

  const highCount = items.filter(i => i.priority === 'high').length;
  const priority_note = highCount
    ? `${highCount} item${highCount === 1 ? '' : 's'} in your pantry expire this week — buy fresh replacements first.`
    : 'No urgent expiries — you can spread this shop out.';

  return {
    items,
    total_cost: total,
    budget_target: target,
    budget_status: status,
    priority_note,
  };
}

app.get('/shopping-list/:customerId', (req, res) => {
  try { res.json(computeShoppingList(resolveCid(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ───────────────────────── Boot ─────────────────────────
loadExcel();
seedDemoUser();
app.listen(PORT, () => {
  console.log(`\n  HealthyFood Data API → http://localhost:${PORT}`);
  console.log(`  Health check         → http://localhost:${PORT}/health`);
  console.log(`  Demo login           → aisha / demo123`);
  console.log(`  Data source          → ${DB.error ? 'computed demo (no Excel found)' : 'transactions.xlsx'}\n`);
});
