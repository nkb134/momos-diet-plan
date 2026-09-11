#!/usr/bin/env node
/**
 * Interactive scaffolder: asks the recipe fields in order, validates against
 * the same rules as the Zod schema, and writes src/content/recipes/<slug>.md.
 * Then run `npm run compute-macros` to fill in the macros.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { existsSync } from 'node:fs';
import { writeFm } from './lib/frontmatter.mjs';
import { loadTable, root } from './lib/load.mjs';

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (q, def = '', check = () => true) => {
  for (;;) {
    const a = (await rl.question(`${q}${def ? ` [${def}]` : ''}: `)).trim() || def;
    const err = check(a); if (err === true) return a; console.log(`  ${err}`);
  }
};
const table = loadTable();
const title = await ask('Title', '', (a) => a.length > 1 || 'required');
const slug = await ask('Slug', title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), (a) => (/^[a-z0-9-]+$/.test(a) && !existsSync(`${root}src/content/recipes/${a}.md`)) || 'lowercase-hyphenated and not already used');
const diet = await ask('Diet (veg | egg | nonveg)', 'veg', (a) => ['veg', 'egg', 'nonveg'].includes(a) || 'veg, egg or nonveg');
const meals = (await ask('Meals (comma: breakfast,lunch,snack,dinner)', 'lunch', (a) => a.split(',').every((m) => ['breakfast', 'lunch', 'snack', 'dinner'].includes(m.trim())) || 'unknown slot')).split(',').map((s) => s.trim());
const cuisine = await ask('Cuisine', 'North Indian');
const region = await ask('Region', '');
const load = await ask('Load (light | moderate | hearty)', 'moderate', (a) => ['light', 'moderate', 'hearty'].includes(a) || 'light, moderate or hearty');
const prepMin = +(await ask('Prep minutes', '10', (a) => /^\d+$/.test(a) || 'number'));
const cookMin = +(await ask('Cook minutes', '20', (a) => /^\d+$/.test(a) || 'number'));
const serves = +(await ask('Serves', diet === 'veg' ? '2' : '1', (a) => /^[1-8]$/.test(a) || '1 to 8'));
console.log('Ingredients: enter "<key> <grams per serving>" per line, empty line to finish. Keys must exist in ingredients.yaml.');
const ingredients = [];
for (;;) {
  const line = (await rl.question('  ingredient: ')).trim(); if (!line) break;
  const [key, qty] = line.split(/\s+/);
  if (!table[key]) { console.log(`  unknown key "${key}"; known: ${Object.keys(table).slice(0, 8).join(', ')} …`); continue; }
  if (!/^\d+(\.\d+)?$/.test(qty ?? '')) { console.log('  grams required'); continue; }
  ingredients.push({ item: table[key].name, key, qty: +qty, unit: 'g', household: '' });
}
if (!ingredients.length) { console.log('at least one ingredient'); process.exit(1); }
const anchor = await ask('Anchor ingredient key (the protein the plan scales)', ingredients[0].key, (a) => ingredients.some((i) => i.key === a) || 'must be one of the ingredients');
console.log('Steps: one per line, empty line to finish.');
const steps = []; for (;;) { const s = (await rl.question(`  ${steps.length + 1}. `)).trim(); if (!s) break; steps.push(s); }
rl.close();
const fm = { title, slug, diet, meals, cuisine, region, image: `${slug}.jpg`, imageCredit: { name: '', url: '', license: '' }, video: null, prepMin, cookMin, serves,
  macros: { kcal: 0, protein_g: 0, carbs_g: 0, fibre_g: 0, netCarbs_g: 0, fat_g: 0 }, load, anchor, tags: [], difficulty: 'easy', equipment: ['gas stove', 'kadhai'], ingredients, swaps: [], steps, notes: '' };
writeFm(`${root}src/content/recipes/${slug}.md`, fm);
console.log(`\nwrote src/content/recipes/${slug}.md — now: npm run compute-macros && add src/assets/recipes/${slug}.jpg`);
