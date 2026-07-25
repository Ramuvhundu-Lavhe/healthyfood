/**
 * File-backed JSON store.
 * Zero native deps, atomic writes via rename, debounced saves.
 * Persists across process restarts. Good for demo / low-scale workloads.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_STATE = {
  users: {},          // usernameLower -> { hash, customer_id, name, created_at }
  prefs: {},          // customer_id -> preferences object
  cooked: {},         // customer_id -> [{ recipe_name, ingredients, cooked_at }]
  reviews: {},        // customer_id -> { recipe_name -> { rating: 1|-1, tags, reviewed_at } }
  pantry_added: {},   // customer_id -> [{ name, category, added_at }]
  shopping_added: {}, // customer_id -> [{ name, retailer, is_healthyfood, source_recipe, added_at }]
  saved: {},          // customer_id -> [{ ...recipe, saved_at }] (per-user isolated)
  next_customer_num: 100,
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let saveTimer = null;

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state = { ...DEFAULT_STATE, ...parsed };
      for (const k of Object.keys(DEFAULT_STATE)) {
        if (state[k] === undefined || state[k] === null) state[k] = DEFAULT_STATE[k];
      }
      console.log(`[db] loaded ${Object.keys(state.users).length} users, ${Object.keys(state.prefs).length} pref profiles`);
    } else {
      console.log(`[db] fresh state (no ${DB_FILE})`);
    }
  } catch (e) {
    console.error('[db] load failed, starting fresh:', e.message);
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) {
      console.error('[db] save failed:', e.message);
    }
  }, 200);
}

function saveSync() {
  clearTimeout(saveTimer);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('[db] saveSync failed:', e.message);
  }
}

// Flush on shutdown so the last write isn't lost.
process.on('SIGTERM', saveSync);
process.on('SIGINT', () => { saveSync(); process.exit(0); });
process.on('beforeExit', saveSync);

load();

export const db = {
  // Users
  getUser: (username) => state.users[String(username || '').toLowerCase()] || null,
  createUser: (username, user) => {
    const key = String(username).toLowerCase();
    state.users[key] = { ...user, username: key, created_at: Date.now() };
    save();
    return state.users[key];
  },
  userExists: (username) => Boolean(state.users[String(username || '').toLowerCase()]),
  allocateCustomerId: () => {
    const n = state.next_customer_num++;
    save();
    return `CUST-${String(n).padStart(3, '0')}`;
  },

  // Prefs
  getPrefs: (cid) => state.prefs[cid] || null,
  setPrefs: (cid, prefs) => {
    state.prefs[cid] = { ...(state.prefs[cid] || {}), ...prefs };
    save();
    return state.prefs[cid];
  },

  // Cooked history — most recent first
  addCooked: (cid, entry) => {
    if (!state.cooked[cid]) state.cooked[cid] = [];
    state.cooked[cid].unshift({ ...entry, cooked_at: Date.now() });
    state.cooked[cid] = state.cooked[cid].slice(0, 50);
    save();
  },
  getCooked: (cid) => state.cooked[cid] || [],

  // Reviews — one per recipe
  setReview: (cid, recipeName, review) => {
    if (!state.reviews[cid]) state.reviews[cid] = {};
    state.reviews[cid][recipeName] = { ...review, reviewed_at: Date.now() };
    save();
  },
  getReviews: (cid) => state.reviews[cid] || {},
  getDislikedRecipes: (cid) =>
    Object.entries(state.reviews[cid] || {}).filter(([, r]) => r.rating < 0).map(([name]) => name),
  getLikedRecipes: (cid) =>
    Object.entries(state.reviews[cid] || {}).filter(([, r]) => r.rating > 0).map(([name]) => name),

  // Manually added pantry items
  addPantryItem: (cid, item) => {
    if (!state.pantry_added[cid]) state.pantry_added[cid] = [];
    // De-dup by lowercased name
    const key = String(item.name || '').toLowerCase().trim();
    state.pantry_added[cid] = state.pantry_added[cid].filter(i => i.name.toLowerCase().trim() !== key);
    state.pantry_added[cid].unshift({ ...item, added_at: Date.now() });
    save();
  },
  getPantryAdditions: (cid) => state.pantry_added[cid] || [],
  removePantryItem: (cid, name) => {
    if (!state.pantry_added[cid]) return false;
    const before = state.pantry_added[cid].length;
    const key = String(name).toLowerCase().trim();
    state.pantry_added[cid] = state.pantry_added[cid].filter(i => i.name.toLowerCase().trim() !== key);
    if (state.pantry_added[cid].length < before) { save(); return true; }
    return false;
  },

  // Shopping list — user-added items from Missing-items modal etc.
  addShoppingItems: (cid, items) => {
    if (!state.shopping_added[cid]) state.shopping_added[cid] = [];
    const existing = new Set(state.shopping_added[cid].map(i => String(i.name).toLowerCase().trim()));
    let added = 0;
    for (const it of items) {
      const key = String(it.name || '').toLowerCase().trim();
      if (!key || existing.has(key)) continue;
      state.shopping_added[cid].push({
        name: String(it.name),
        retailer: it.retailer || 'Any grocer',
        is_healthyfood: Boolean(it.is_healthyfood),
        source_recipe: it.source_recipe || null,
        added_at: Date.now(),
      });
      existing.add(key);
      added++;
    }
    if (added > 0) save();
    return added;
  },
  removeShoppingItem: (cid, name) => {
    if (!state.shopping_added[cid]) return false;
    const key = String(name).toLowerCase().trim();
    const before = state.shopping_added[cid].length;
    state.shopping_added[cid] = state.shopping_added[cid].filter(i => i.name.toLowerCase().trim() !== key);
    if (state.shopping_added[cid].length < before) { save(); return true; }
    return false;
  },
  getShoppingAdditions: (cid) => state.shopping_added[cid] || [],

  // Saved recipes — per customer, isolated across users
  addSaved: (cid, recipe) => {
    if (!state.saved[cid]) state.saved[cid] = [];
    const key = String(recipe.name || '').toLowerCase().trim();
    state.saved[cid] = state.saved[cid].filter(r => String(r.name).toLowerCase().trim() !== key);
    state.saved[cid].unshift({ ...recipe, saved_at: Date.now() });
    state.saved[cid] = state.saved[cid].slice(0, 100);
    save();
  },
  removeSaved: (cid, name) => {
    if (!state.saved[cid]) return false;
    const before = state.saved[cid].length;
    const key = String(name).toLowerCase().trim();
    state.saved[cid] = state.saved[cid].filter(r => String(r.name).toLowerCase().trim() !== key);
    if (state.saved[cid].length < before) { save(); return true; }
    return false;
  },
  getSaved: (cid) => state.saved[cid] || [],
  isSaved: (cid, name) => {
    const key = String(name || '').toLowerCase().trim();
    return (state.saved[cid] || []).some(r => String(r.name).toLowerCase().trim() === key);
  },
};
