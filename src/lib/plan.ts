/**
 * Typed helpers over the content collections: computed day macros, today
 * detection, shopping lists. The arithmetic lives in macros.mjs.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { entryMacros, roundMacros, sumMacros } from './macros.mjs';
import { slots, dayTargets, type Training } from '../nutrition.config';
import { planConfig } from '../plan.config';
import { AISLES } from '../../scripts/lib/ingredient-meta.mjs';

export type Recipe = CollectionEntry<'recipes'>['data'];
export type Slot = (typeof slots)[number];
export interface Macros { kcal: number; protein_g: number; carbs_g: number; fibre_g: number; netCarbs_g: number; fat_g: number }
export interface Per100 { kcal: number; protein_g: number; carb_g: number; fibre_g: number; fat_g: number }

export interface MealView {
  slot: Slot;
  recipe: Recipe;
  grams: Record<string, number>;   // per person, this day
  macros: Macros;                  // per person, this day
  addOn?: { recipe: Recipe; grams: Record<string, number>; macros: Macros };
}
export interface DayView {
  week: number; day: string; date: string; training: Training;
  meals: MealView[]; totals: Macros; targets: (typeof dayTargets)[Training];
}

let cache: Promise<{ recipes: Record<string, Recipe>; table: Record<string, Per100 & { name: string; aisle: string; hint: string }>; days: DayView[] }> | null = null;

export function loadPlan() {
  if (cache) return cache;
  cache = (async () => {
    const recipes: Record<string, Recipe> = {};
    for (const r of await getCollection('recipes')) recipes[r.data.slug] = r.data;
    const table: Record<string, any> = {};
    for (const i of await getCollection('ingredients')) table[i.id] = i.data;
    const days: DayView[] = [];
    for (const w of (await getCollection('plan')).sort((a, b) => a.data.week - b.data.week)) {
      for (const d of w.data.days) {
        const meals: MealView[] = [];
        for (const slot of slots) {
          const e = d.meals[slot];
          const recipe = recipes[e.veg];
          if (!recipe) throw new Error(`plan references unknown recipe ${e.veg}`);
          const { grams, macros } = entryMacros(recipe as any, e, table);
          const mv: MealView = { slot, recipe, grams, macros: roundMacros(macros) };
          if (e.nonVegAddOn) {
            const a = recipes[e.nonVegAddOn];
            if (a) { const x = entryMacros(a as any, { portion: 1 }, table); mv.addOn = { recipe: a, grams: x.grams, macros: roundMacros(x.macros) }; }
          }
          meals.push(mv);
        }
        days.push({ week: w.data.week, day: d.day, date: d.date, training: d.training, meals, totals: roundMacros(sumMacros(meals.map((m) => m.macros))), targets: dayTargets[d.training] });
      }
    }
    return { recipes, table, days };
  })();
  return cache;
}

/** ISO date for "today" in the plan's time zone. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: planConfig.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' });
}

export interface ShoppingLine { key: string; name: string; grams: number; hint: string }
export type ShoppingList = { aisle: string; label: string; lines: ShoppingLine[] }[];

/** Grouped, deduped shopping list. Veg dishes cook for `serves` people; add-ons for 1. */
export function shoppingList(days: DayView[], table: Record<string, { name: string; aisle: string; hint: string }>, includeAddOns = true): ShoppingList {
  const totals: Record<string, number> = {};
  for (const d of days) for (const m of d.meals) {
    for (const [k, g] of Object.entries(m.grams)) totals[k] = (totals[k] ?? 0) + g * m.recipe.serves;
    if (includeAddOns && m.addOn) for (const [k, g] of Object.entries(m.addOn.grams)) totals[k] = (totals[k] ?? 0) + g * m.addOn.recipe.serves;
  }
  const groups: Record<string, ShoppingLine[]> = {};
  for (const [key, grams] of Object.entries(totals)) {
    const row = table[key]; if (!row) continue;
    (groups[row.aisle] ??= []).push({ key, name: row.name, grams: Math.round(grams), hint: row.hint });
  }
  return Object.entries(AISLES).filter(([a]) => groups[a]).map(([aisle, label]) => ({ aisle, label, lines: groups[aisle]!.sort((a, b) => b.grams - a.grams) }));
}

export const slotLabel: Record<Slot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
export const trainingLabel: Record<Training, string> = { lift: 'Lift day', swim: 'Swim + lift', rest: 'Rest day' };
