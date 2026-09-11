#!/usr/bin/env node
/**
 * Build-time rule checks (brief rules 1–14). Every threshold comes from
 * src/nutrition.config.ts. Prints a per-day table of actuals against targets
 * and exits 1 naming the offending week/day/meal when anything fails.
 * Run with: node --experimental-strip-types scripts/validate-plan.mjs [--quiet]
 */
import { loadTable, loadRecipes, loadPlan, imageExists } from './lib/load.mjs';
import { entryMacros, roundMacros, sumMacros } from '../src/lib/macros.mjs';
import * as cfg from '../src/nutrition.config.ts';

const quiet = process.argv.includes('--quiet');
const table = loadTable();
const recipes = loadRecipes();
const weeks = loadPlan();
const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

// rule 14: every ingredient in every recipe exists in the table
for (const r of Object.values(recipes)) {
  for (const i of r.ingredients) if (!table[i.key]) fail(`recipe ${r.slug}`, `ingredient "${i.key}" missing from ingredients.yaml`);
  // rule 9: equipment allowlist
  for (const e of r.equipment ?? []) if (!cfg.equipmentAllowlist.includes(e)) fail(`recipe ${r.slug}`, `equipment "${e}" not on the home-kitchen allowlist`);
  // rule 4: image present, else placeholder (warn only)
  if (!imageExists(r)) warnings.push(`recipe ${r.slug}: no image at src/assets/recipes/${r.image || '(none)'}; placeholder will be used`);
}

const ceilingFor = (training) => cfg.carbMode === 'cycled' ? cfg.dayTargets[training].netCarbs_g : cfg.carbCeilings[cfg.carbMode];

/** flat list of days across weeks, in order, with computed meals */
const days = [];
for (const w of weeks) {
  for (const d of w.days) {
    const where = `week ${w.week} ${d.day} (${d.date})`;
    const meals = {};
    for (const slot of cfg.slots) {
      const e = d.meals[slot];
      if (!e || !e.veg) { fail(where, `${slot} has no veg entry (rule 1)`); continue; }
      const r = recipes[e.veg];
      if (!r) { fail(where, `${slot} references unknown recipe "${e.veg}" (rule 3)`); continue; }
      if (r.diet !== 'veg') fail(where, `${slot} veg entry "${e.veg}" is not a veg recipe (rule 2)`);
      let m;
      try { m = roundMacros(entryMacros(r, e, table).macros); } catch (err) { fail(where, `${slot}: ${err.message}`); continue; }
      meals[slot] = { recipe: r, macros: m, entry: e };
      if (e.nonVegAddOn) {
        const a = recipes[e.nonVegAddOn];
        if (!a) fail(where, `${slot} add-on references unknown recipe "${e.nonVegAddOn}" (rule 3)`);
        else if (a.diet === 'veg') fail(where, `${slot} add-on "${e.nonVegAddOn}" is a veg recipe; add-ons are non-veg (rule 2)`);
        else meals[slot].addOn = { recipe: a, macros: roundMacros(entryMacros(a, { portion: 1 }, table).macros) };
      }
    }
    days.push({ where, week: w.week, day: d, meals });
  }
}

const rows = [];
for (const { where, day, meals } of days) {
  const slotsOk = cfg.slots.every((s) => meals[s]);
  if (!slotsOk) continue;
  const t = cfg.dayTargets[day.training];
  const total = roundMacros(sumMacros(cfg.slots.map((s) => meals[s].macros)));
  const [lo, hi] = ceilingFor(day.training);
  const row = { where, training: day.training, ...total, targetKcal: t.kcal, protFloor: cfg.proteinFloor_g, ncLo: lo, ncHi: hi, fibreMin: t.fibre_g, ok: true };
  const bad = (msg) => { row.ok = false; fail(where, msg); };

  // rule 10
  if (total.protein_g < cfg.proteinFloor_g) bad(`protein ${total.protein_g} g is under the ${cfg.proteinFloor_g} g floor (rule 10)`);
  for (const s of cfg.mainMeals) if (meals[s].macros.protein_g < cfg.mealProteinMin_g) bad(`${s} "${meals[s].recipe.title}" has ${meals[s].macros.protein_g} g protein, under the ${cfg.mealProteinMin_g} g per-meal minimum (rule 10)`);
  // rule 11
  if (total.netCarbs_g > hi) bad(`net carbs ${total.netCarbs_g} g exceed the ${hi} g ${day.training}-day ceiling (rule 11)`);
  // rule 12
  if (total.fibre_g < t.fibre_g) bad(`fibre ${total.fibre_g} g is under the ${t.fibre_g} g floor (rule 12)`);
  const dn = meals.dinner.macros;
  if (!(dn.netCarbs_g <= meals.breakfast.macros.netCarbs_g && dn.netCarbs_g <= meals.lunch.macros.netCarbs_g)) bad(`dinner net carbs ${dn.netCarbs_g} g are not the lowest of the main meals (rule 12)`);
  // rule 13
  const dev = Math.abs(total.kcal - t.kcal) / t.kcal;
  if (dev > cfg.energyTolerance) bad(`energy ${total.kcal} kcal is ${Math.round(dev * 100)}% from the ${t.kcal} kcal target, over ±${cfg.energyTolerance * 100}% (rule 13)`);
  // rule 6
  const dr = meals.dinner.recipe;
  if (!cfg.dinner.allowedLoads.includes(dr.load)) bad(`dinner "${dr.title}" has load "${dr.load}"; dinner must be ${cfg.dinner.allowedLoads.join('/')} (rule 6)`);
  if (cfg.dinner.lightestBy === 'kcal' && !(dn.kcal < meals.breakfast.macros.kcal && dn.kcal < meals.lunch.macros.kcal)) bad(`dinner ${dn.kcal} kcal is not below breakfast and lunch (rule 6)`);
  // rule 7
  if (dn.fibre_g < cfg.dinner.fibreMin_g) bad(`dinner fibre ${dn.fibre_g} g is under the ${cfg.dinner.fibreMin_g} g dinner floor (rule 7)`);
  for (const i of dr.ingredients) if (cfg.dinner.refinedBases.includes(i.key)) bad(`dinner "${dr.title}" is built on refined carb "${i.key}" (rule 7)`);
  rows.push(row);
}

// rules 5 and 8: rolling 7-day windows
for (let i = 0; i + 7 <= days.length; i++) {
  const win = days.slice(i, i + 7);
  const nonVeg = {};
  let dishes = 0, indian = 0;
  for (const d of win) for (const s of cfg.slots) {
    const m = d.meals[s]; if (!m) continue;
    dishes++; if (!cfg.nonIndianCuisines.includes(m.recipe.cuisine)) indian++;
    if (m.addOn) { nonVeg[m.addOn.recipe.slug] = (nonVeg[m.addOn.recipe.slug] ?? 0) + 1; dishes++; if (!cfg.nonIndianCuisines.includes(m.addOn.recipe.cuisine)) indian++; }
  }
  const label = `${win[0].where} → ${win[6].where}`;
  for (const [slug, n] of Object.entries(nonVeg)) if (n > cfg.nonVegMaxPer7Days) fail(label, `non-veg "${slug}" appears ${n}× in a 7-day window, max ${cfg.nonVegMaxPer7Days} (rule 5)`);
  if (dishes && indian / dishes < cfg.indianMinShare) fail(label, `Indian share ${Math.round((indian / dishes) * 100)}% is under ${cfg.indianMinShare * 100}% (rule 8)`);
}

// report
if (!quiet || errors.length) {
  const pad = (s, n) => String(s).padStart(n);
  console.log('\nday                                   train   kcal (target)   protein (floor)   net carbs (range)   fibre (min)');
  for (const r of rows) {
    console.log(`${r.ok ? '  ' : '✗ '}${r.where.padEnd(36)}${r.training.padEnd(6)} ${pad(r.kcal, 6)} (${r.targetKcal})   ${pad(r.protein_g, 5)} g (${r.protFloor})     ${pad(r.netCarbs_g, 5)} g (${r.ncLo}–${r.ncHi})    ${pad(r.fibre_g, 4)} g (${r.fibreMin})`);
  }
  console.log('');
}
for (const w of warnings) if (!quiet) console.warn(`warning: ${w}`);
if (errors.length) {
  console.error(`\nvalidate-plan: ${errors.length} problem(s)\n` + errors.map((e) => `  ✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`validate-plan: ${days.length} days, ${Object.keys(recipes).length} recipes, all rules pass${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
