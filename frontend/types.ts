export interface Milestone {
  id: string;
  name: string;
  desc: string;
  earned: boolean;
  progress_pct: number;
  points: number;
}

export interface Preferences {
  allergies: string[];
  diet: string;
  household_size: number;
  budget_tier: string;
  training_goal: string;
  upcoming_event: { type: string; date: string } | null;
  power_available: boolean;
  heritage_optin: boolean;
}

export interface Profile {
  customer_id: string;
  name: string;
  health_score: number;
  score_change: number;
  trend: 'up' | 'down' | 'flat';
  nudge_text: string;
  avg_weekly_spend: number;
  preferred_retailer: string;
  healthy_ratio: number;
  profile_completeness: number;
  preferences: Preferences;
  milestones: Milestone[];
}

export interface PantryItem {
  name: string;
  category: string; // e.g., 'Proteins', 'Carbohydrates', 'Fats & Oils', 'Produce'
  is_healthy: boolean;
  is_healthyfood: boolean;
  days_until_expiry: number;
  photo: string;
  allergen_conflict?: boolean;
  diet_conflict?: boolean;
}

export interface PantryResponse {
  items: PantryItem[];
}

export interface MissingItem {
  name: string;
  retailer: string;
  is_healthyfood: boolean;
}

export interface RecipeIngredient {
  name: string;
  amount: string;
  alternative?: string;
}

export interface Recipe {
  name: string;
  photo: string;
  prep_time_category: string;
  cook_time_minutes: number;
  cooking_method: string;
  diet_tags: string[];
  all_in_pantry: boolean;
  missing_items: MissingItem[];
  ingredients: RecipeIngredient[];
  health_benefit: string;
  allergy_safe: boolean;
  uses_expiring: boolean;
  servings: number;
  calories: number;
  budget_savings_rand: number;
  steps: string[];
}

export interface RecipeResponse {
  recipes: Recipe[];
}

export interface WeeklyScore {
  week: string;
  score: number;
}

export interface BasketSplit {
  healthy_spend: number;
  unhealthy_spend: number;
}

export interface SavingsBreakdown {
  healthyfood_cashback: number;   // HealthyFood cashback earned on healthy spend
  waste_avoided: number;          // value of expiring items rescued into meals
  smart_swaps: number;            // saved by choosing cheaper healthy alternatives
  total: number;
}

export interface ProgressResponse {
  weekly_scores: WeeklyScore[];
  basket_split: BasketSplit;
  healthyfood_adoption_pct: number;
  total_vitality_points: number;
  savings?: SavingsBreakdown;
  monthly_savings_trend?: { month: string; amount: number }[];
  shopping_list: MissingItem[];
}

export interface HeritageDish {
  name: string;
  origin: string;
  context: string;
  photo: string;
  ingredients_have: string[];
  ingredients_needed: string[];
}

export interface HeritageResponse {
  celebration: string | null;
  days_away: number;
  dish: HeritageDish | null;
}

export interface CommunityActivity {
  who: string;
  what: string;
  when: string;
}

export interface CommunityChallenge {
  id: string;
  name: string;
  theme: string;
  days_left: number;
  bonus_points: number;
  participants: number;
  collective_goal: number;
  collective_done: number;
  joined: boolean;
  you_cooked: boolean;
  neighbours: string[];
  recent_activity: CommunityActivity[];
}

export interface UpcomingChallenge {
  name: string;
  starts: string;
  desc: string;
}

export interface CommunityResponse {
  active_challenge: CommunityChallenge;
  upcoming: UpcomingChallenge[];
}

export interface ShoppingListItem {
  name: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimated_cost: number;
  is_healthyfood: boolean;
}

export interface ShoppingListResponse {
  items: ShoppingListItem[];
  total_cost: number;
  budget_target: number;
  budget_status: 'under' | 'at' | 'over';
  priority_note: string;
}
