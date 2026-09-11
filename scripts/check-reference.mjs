#!/usr/bin/env node
/** Diffs engine output for every plan meal against 14-day-diet-plan.md. */
import { readFileSync } from 'node:fs';
import { loadTable, loadRecipes, loadPlan, root } from './lib/load.mjs';
import { entryMacros, roundMacros } from '../src/lib/macros.mjs';

const md = readFileSync(`${root}14-day-diet-plan.md`, 'utf8');
const ref = {}; // `${week}|${day}|${slot}` -> {protein, nc, fibre, kcal}
let week = 0, day = '';
for (const line of md.split('\n')) {
  const w = line.match(/^## Week (\d)/); if (w) week = +w[1];
  const d = line.match(/^### (\w+) —/); if (d) day = d[1];
  const m = line.match(/^\| (Breakfast|Lunch|Snack|Dinner) \| .*? \| (\d+) g \| (\d+) g \| (\d+) g \| (\d+) \|/);
  if (m) ref[`${week}|${day}|${m[1].toLowerCase()}`] = { protein: +m[2], nc: +m[3], fibre: +m[4], kcal: +m[5] };
}
const table = loadTable(), recipes = loadRecipes();
let mismatches = 0, checked = 0;
for (const w of loadPlan()) for (const d of w.days) for (const [slot, e] of Object.entries(d.meals)) {
  const r = ref[`${w.week}|${d.day}|${slot}`]; if (!r) continue;
  const m = roundMacros(entryMacros(recipes[e.veg], e, table).macros); checked++;
  const diff = [['protein', m.protein_g, r.protein], ['netCarbs', m.netCarbs_g, r.nc], ['fibre', m.fibre_g, r.fibre], ['kcal', m.kcal, r.kcal]].filter(([k, a, b]) => Math.abs(a - b) > (k === 'kcal' ? 8 : 1));
  if (diff.length) { mismatches++; console.log(`week ${w.week} ${d.day} ${slot} (${e.veg}): ` + diff.map(([k, a, b]) => `${k} engine ${a} vs ref ${b}`).join(', ')); }
}
console.log(`check-reference: ${checked} meals compared, ${mismatches} mismatch(es) beyond ±1 g / ±8 kcal`);
process.exit(mismatches ? 1 : 0);
