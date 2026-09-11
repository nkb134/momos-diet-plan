/**
 * Every numeric threshold the validator and the UI use. Nothing is hardcoded
 * elsewhere. Values start from the validated 14-day reference plan; tune here.
 */

export type Training = 'lift' | 'swim' | 'rest';
export type CarbMode = 'strict' | 'moderate' | 'cycled';

/** Which carb ceiling applies. `cycled` is the default because flat low-carb
 *  intake across four lifting sessions and swimming degrades session quality. */
export const carbMode: CarbMode = 'cycled';

/** Per day-type targets. kcal is the centre of a ±energyTolerance band. */
export const dayTargets: Record<Training, { kcal: number; protein_g: number; netCarbs_g: [number, number]; fibre_g: number }> = {
  lift: { kcal: 2250, protein_g: 160, netCarbs_g: [150, 200], fibre_g: 35 }, // four lifting days a week
  swim: { kcal: 2100, protein_g: 155, netCarbs_g: [115, 160], fibre_g: 35 }, // swim + lift day
  rest: { kcal: 1900, protein_g: 150, netCarbs_g: [80, 120], fibre_g: 35 },  // two rest days a week
};

/** Net-carb ceilings by mode. `cycled` defers to dayTargets. */
export const carbCeilings: Record<Exclude<CarbMode, 'cycled'>, [number, number]> = {
  strict: [100, 120],   // flat, every day
  moderate: [140, 160], // flat, every day
};

/** Hard floor for the day's protein regardless of day type (rule 10). */
export const proteinFloor_g = 140;

/** Every main meal (breakfast, lunch, dinner) carries at least this much protein on its own (rule 10). */
export const mealProteinMin_g = 30;

/** Day energy must land within ± this fraction of the day-type kcal target (rule 13). */
export const energyTolerance = 0.10;

/** Per-slot guide targets shown in the UI against each meal. Not enforced. */
export const slotTargets = {
  breakfast: { kcal: 500, protein_g: 35 },
  lunch: { kcal: 700, protein_g: 50 },
  snack: { kcal: 300, protein_g: 25 },
  dinner: { kcal: 600, protein_g: 45 },
} as const;

export const dinner = {
  /** Dinner must be the lightest main meal. The reference plan proves this by
   *  net carbs, not kcal (several dinners are protein-heavy and out-kcal a
   *  light breakfast), so `netCarbs` is the default. Switch to `kcal` to
   *  enforce the stricter reading of rule 6. */
  lightestBy: 'netCarbs' as 'netCarbs' | 'kcal',
  /** Dinner recipes must declare this load; `hearty` is rejected outright (rule 6). */
  allowedLoads: ['light'] as const,
  /** Minimum dinner fibre in grams (rule 7). */
  fibreMin_g: 5,
  /** Ingredient keys that count as refined-carb bases; a dinner may not use them (rule 7). */
  refinedBases: ['rice_white', 'rava', 'poha'] as const,
};

/** A non-veg recipe may appear at most this many times in any rolling 7-day window (rule 5). */
export const nonVegMaxPer7Days = 4;

/** Share of dishes in any rolling 7-day window that must be Indian cuisine (rule 8). */
export const indianMinShare = 0.75;

/** Cuisine labels that count as non-Indian for rule 8. Everything else is Indian. */
export const nonIndianCuisines = ['Fusion', 'Indo-Chinese', 'Thai', 'Lebanese', 'Levantine', 'Mediterranean', 'Japanese', 'Korean', 'Italian', 'Mexican'];

/** Ordinary home kitchen only (rule 9). */
export const equipmentAllowlist = [
  'gas stove', 'kadhai', 'tawa', 'pressure cooker', 'pan', 'saucepan', 'pot', 'mixie', 'grinder',
  'idli stand', 'steamer', 'dhokla plate', 'skewers', 'grill pan', 'oven (optional)', 'airfryer (optional)',
  'microwave (optional)', 'bowl', 'knife', 'chopping board', 'ladle', 'whisk', 'strainer', 'muslin cloth', 'rolling pin', 'tongs',
] as const;

/** Slot names in day order. */
export const slots = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export const mainMeals = ['breakfast', 'lunch', 'dinner'] as const;
