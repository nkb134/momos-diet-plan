import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';
import { parse } from 'yaml';
import { equipmentAllowlist } from './nutrition.config';

const macros = z.object({
  kcal: z.number(), protein_g: z.number(), carbs_g: z.number(),
  fibre_g: z.number(), netCarbs_g: z.number(), fat_g: z.number(),
});

const ingredient = z.object({
  item: z.string(),
  key: z.string().regex(/^[a-z_]+$/),
  qty: z.number().nonnegative(),
  unit: z.string().default('g'),
  household: z.string().default(''),
  note: z.string().default(''),
});

export const recipeSchema = z.object({
  title: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  diet: z.enum(['veg', 'egg', 'nonveg']),
  meals: z.array(z.enum(['breakfast', 'lunch', 'snack', 'dinner'])).min(1),
  cuisine: z.string(),
  region: z.string().default(''),
  image: z.string().default(''),
  imageCredit: z.object({ name: z.string().default(''), url: z.string().default(''), license: z.string().default('') }).default({ name: '', url: '', license: '' }),
  /** YouTube id of a Short showing a similar method; optional. */
  video: z.object({ youtubeId: z.string().regex(/^[\w-]{11}$/), title: z.string().default(''), channel: z.string().default(''), isShort: z.boolean().default(true) }).nullable().default(null),
  prepMin: z.number().int().nonnegative(),
  cookMin: z.number().int().nonnegative(),
  /** People the listed quantities feed. Veg dishes cook for 2, non-veg add-ons for 1. `qty` is per serving. */
  serves: z.number().int().positive(),
  macros,
  load: z.enum(['light', 'moderate', 'hearty']),
  anchor: z.string().regex(/^[a-z_]+$/),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),
  equipment: z.array(z.enum(equipmentAllowlist)).default([]),
  ingredients: z.array(ingredient).min(1),
  swaps: z.array(z.object({ for: z.string(), use: z.string(), why: z.string().default('') })).default([]),
  steps: z.array(z.string()).default([]),
  notes: z.string().default(''),
});

const mealEntry = z.object({
  veg: z.string(),
  portion: z.number().positive().default(1),
  anchorGrams: z.record(z.string(), z.number().nonnegative()).default({}),
  nonVegAddOn: z.string().optional(),
});

export const planSchema = z.object({
  week: z.number().int().positive(),
  title: z.string(),
  days: z.array(z.object({
    day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    date: z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    training: z.enum(['lift', 'swim', 'rest']),
    meals: z.object({ breakfast: mealEntry, lunch: mealEntry, snack: mealEntry, dinner: mealEntry }),
  })).length(7),
});

const ingredientRow = z.object({
  name: z.string(), aisle: z.string(), hint: z.string().default(''),
  kcal: z.number(), protein_g: z.number(), carb_g: z.number(), fibre_g: z.number(), fat_g: z.number(),
  source: z.string(),
});

export const collections = {
  recipes: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/recipes' }), schema: recipeSchema }),
  plan: defineCollection({ loader: glob({ pattern: '**/*.yaml', base: './src/content/plan' }), schema: planSchema }),
  ingredients: defineCollection({
    loader: file('./src/data/ingredients.yaml', {
      parser: (text) => {
        // yaml map -> array of {id, ...row}
        return Object.entries(parse(text)).map(([id, row]) => ({ id, ...(row as object) }));
      },
    }),
    schema: ingredientRow,
  }),
};
