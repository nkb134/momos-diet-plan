#!/usr/bin/env node
/** Parses a GitHub issue-form body (env BODY) into src/content/recipes/<slug>.md. */
import { appendFileSync } from 'node:fs';
import { writeFm } from './lib/frontmatter.mjs';
import { loadTable, root } from './lib/load.mjs';

const body = process.env.BODY ?? '';
const section = (label) => { const m = body.match(new RegExp(`### ${label}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`)); return (m?.[1] ?? '').trim(); };
const title = section('Title');
if (!title) { console.error('no title'); process.exit(1); }
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const diet = section('Diet') || 'veg';
const meals = [...section('Meal slots').matchAll(/- \[[xX]\] (\w+)/g)].map((m) => m[1]);
const [prepMin, cookMin] = section('Prep and cook minutes').split(/[,\s]+/).map((x) => +x || 0);
const serves = +(section('Serves') || (diet === 'veg' ? 2 : 1));
const table = loadTable();
const ingredients = section('Ingredients').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [key, qty] = l.split(/\s+/);
  if (!table[key]) throw new Error(`unknown ingredient key "${key}"`);
  return { item: table[key].name, key, qty: +qty, unit: 'g', household: '' };
});
const steps = section('Steps').split('\n').map((s) => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
const fm = { title, slug, diet, meals: meals.length ? meals : ['lunch'], cuisine: section('Cuisine') || 'North Indian', region: '', image: `${slug}.jpg`,
  imageCredit: { name: '', url: '', license: '' }, video: null, prepMin, cookMin, serves,
  macros: { kcal: 0, protein_g: 0, carbs_g: 0, fibre_g: 0, netCarbs_g: 0, fat_g: 0 }, load: section('Load') || 'moderate', anchor: section('Anchor ingredient key') || ingredients[0]?.key,
  tags: [], difficulty: 'easy', equipment: ['gas stove', 'kadhai'], ingredients, swaps: [], steps, notes: section('Notes').replace(/_No response_/, '') };
writeFm(`${root}src/content/recipes/${slug}.md`, fm);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitle=${title}\n`);
console.log(`wrote ${slug}.md`);
