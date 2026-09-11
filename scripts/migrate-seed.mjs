#!/usr/bin/env node
/**
 * One-time (re-runnable) migration: diet-chart-seed.yaml ->
 *   src/data/ingredients.yaml, src/content/plan/week-NN.yaml,
 *   src/content/recipes/<slug>.md (skeleton only, never overwrites an
 *   existing recipe file so authored methods are safe).
 *
 * Days are rotated so the plan starts on planConfig.startDate (a Saturday):
 * each seed week becomes [Sat, Sun, Mon, Tue, Wed, Thu, Fri] of that week.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { INGREDIENT_META } from './lib/ingredient-meta.mjs';
import { planConfig } from '../src/plan.config.ts';

import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const seed = parse(readFileSync(`${root}diet-chart-seed.yaml`, 'utf8'));

// --- ingredients ---------------------------------------------------------
const ingredients = {};
for (const [key, row] of Object.entries(seed.ingredients)) {
  const meta = INGREDIENT_META[key];
  if (!meta) throw new Error(`no metadata for ingredient ${key}`);
  ingredients[key] = { name: meta.name, aisle: meta.aisle, hint: meta.hint, ...row };
}
mkdirSync(`${root}src/data`, { recursive: true });
writeFileSync(`${root}src/data/ingredients.yaml`,
  '# Per 100 g. Sources recorded per row (IFCT 2017 / USDA FDC). Edited by hand only for `source`.\n' +
  stringify(ingredients, { lineWidth: 0 }));

// --- plan ---------------------------------------------------------------
const order = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const start = new Date(planConfig.startDate + 'T00:00:00Z');
mkdirSync(`${root}src/content/plan`, { recursive: true });
for (const w of seed.plan) {
  const days = order.map((name, i) => {
    const d = w.days.find((x) => x.day === name);
    if (!d) throw new Error(`week ${w.week} has no ${name}`);
    const date = new Date(start.getTime() + ((w.week - 1) * 7 + i) * 86400000).toISOString().slice(0, 10);
    const meals = {};
    for (const [slot, m] of Object.entries(d.meals)) {
      meals[slot] = { veg: m.veg, portion: m.portion ?? 1, anchorGrams: m.anchorGrams ?? {} };
      if (m.nonVegAddOn) meals[slot].nonVegAddOn = m.nonVegAddOn;
    }
    return { day: name, date, training: d.training, meals };
  });
  const file = `${root}src/content/plan/week-${String(w.week).padStart(2, '0')}.yaml`;
  writeFileSync(file, `# Week ${w.week}. Generated from diet-chart-seed.yaml; portion and anchorGrams are fixed.\n` +
    stringify({ week: w.week, title: `Week ${w.week}`, days }, { lineWidth: 0 }));
}

// --- recipes (skeletons) -------------------------------------------------
mkdirSync(`${root}src/content/recipes`, { recursive: true });
let created = 0;
for (const [slug, r] of Object.entries(seed.recipes)) {
  const file = `${root}src/content/recipes/${slug}.md`;
  if (existsSync(file)) continue;
  const fm = {
    title: r.title,
    slug,
    diet: r.diet,
    meals: r.meals,
    cuisine: r.cuisine,
    region: '',
    image: `${slug}.jpg`,
    imageCredit: { name: '', url: '', license: '' },
    video: null,
    prepMin: 0,
    cookMin: 0,
    serves: r.diet === 'veg' ? 2 : 1,
    macros: { kcal: 0, protein_g: 0, carbs_g: 0, fibre_g: 0, netCarbs_g: 0, fat_g: 0 },
    load: r.load,
    anchor: r.anchor,
    tags: [],
    difficulty: 'easy',
    equipment: [],
    ingredients: Object.entries(r.ingredients).map(([key, qty]) => ({
      item: INGREDIENT_META[key].name, key, qty, unit: 'g', household: '',
    })),
    swaps: [],
    steps: [],
    notes: '',
  };
  writeFileSync(file, `---\n${stringify(fm, { lineWidth: 0 })}---\n`);
  created++;
}
console.log(`ingredients: ${Object.keys(ingredients).length}, weeks: ${seed.plan.length}, recipe files created: ${created}`);
