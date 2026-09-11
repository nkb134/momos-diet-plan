/**
 * The 14 plan rules as a function so the CLI, the bot, and tests share it.
 * Thresholds come from src/nutrition.config.ts. Returns errors, warnings,
 * and a per-day row table; never exits the process.
 */
import { entryMacros, roundMacros, sumMacros } from '../../src/lib/macros.mjs';
import * as cfg from '../../src/nutrition.config.ts';
import { imageExists } from './load.mjs';

export function runValidation({ table, recipes, weeks }) {
  const errors = [], warnings = [], rows = [];
  const fail = (where, msg) => errors.push(`${where}: ${msg}`);

  for (const r of Object.values(recipes)) {
    for (const i of r.ingredients) if (!table[i.key]) fail(`recipe ${r.slug}`, `ingredient "${i.key}" missing from ingredients.yaml (rule 14)`);
    for (const e of r.equipment ?? []) if (!cfg.equipmentAllowlist.includes(e)) fail(`recipe ${r.slug}`, `equipment "${e}" not on the home-kitchen allowlist (rule 9)`);
    if (!imageExists(r)) warnings.push(`recipe ${r.slug}: no image; placeholder will be used (rule 4)`);
  }
  const ceilingFor = (t) => cfg.carbMode === 'cycled' ? cfg.dayTargets[t].netCarbs_g : cfg.carbCeilings[cfg.carbMode];

  const days = [];
  for (const w of weeks) for (const d of w.days) {
    const where = `week ${w.week} ${d.day} (${d.date})`;
    const meals = {};
    for (const slot of cfg.slots) {
      const e = d.meals[slot];
      if (!e || !e.veg) { fail(where, `${slot} has no veg entry (rule 1)`); continue; }
      const r = recipes[e.veg];
      if (!r) { fail(where, `${slot} references unknown recipe "${e.veg}" (rule 3)`); continue; }
      if (r.diet !== 'veg') fail(where, `${slot} veg entry "${e.veg}" is not a veg recipe (rule 2)`);
      if (!r.meals.includes(slot)) warnings.push(`${where}: ${slot} recipe "${e.veg}" is not tagged for ${slot}`);
      let m;
      try { m = roundMacros(entryMacros(r, e, table).macros); } catch (err) { fail(where, `${slot}: ${err.message}`); continue; }
      meals[slot] = { recipe: r, macros: m, entry: e };
      if (e.nonVegAddOn) {
        const a = recipes[e.nonVegAddOn];
        if (!a) fail(where, `${slot} add-on references unknown recipe "${e.nonVegAddOn}" (rule 3)`);
        else if (a.diet === 'veg') fail(where, `${slot} add-on "${e.nonVegAddOn}" is a veg recipe (rule 2)`);
        else meals[slot].addOn = { recipe: a, macros: roundMacros(entryMacros(a, { portion: 1 }, table).macros) };
      }
    }
    days.push({ where, week: w.week, day: d, meals });
  }

  for (const { where, day, meals } of days) {
    if (!cfg.slots.every((s) => meals[s])) continue;
    const t = cfg.dayTargets[day.training];
    const total = roundMacros(sumMacros(cfg.slots.map((s) => meals[s].macros)));
    const [lo, hi] = ceilingFor(day.training);
    const row = { where, date: day.date, training: day.training, ...total, targetKcal: t.kcal, protFloor: cfg.proteinFloor_g, ncLo: lo, ncHi: hi, fibreMin: t.fibre_g, ok: true, problems: [] };
    const bad = (msg) => { row.ok = false; row.problems.push(msg); fail(where, msg); };
    if (total.protein_g < cfg.proteinFloor_g) bad(`protein ${total.protein_g} g under the ${cfg.proteinFloor_g} g floor (rule 10)`);
    for (const s of cfg.mainMeals) if (meals[s].macros.protein_g < cfg.mealProteinMin_g) bad(`${s} "${meals[s].recipe.title}" has ${meals[s].macros.protein_g} g protein, under the ${cfg.mealProteinMin_g} g minimum (rule 10)`);
    if (total.netCarbs_g > hi) bad(`net carbs ${total.netCarbs_g} g exceed the ${hi} g ${day.training}-day ceiling (rule 11)`);
    if (total.fibre_g < t.fibre_g) bad(`fibre ${total.fibre_g} g under the ${t.fibre_g} g floor (rule 12)`);
    const dn = meals.dinner.macros;
    if (!(dn.netCarbs_g <= meals.breakfast.macros.netCarbs_g && dn.netCarbs_g <= meals.lunch.macros.netCarbs_g)) bad(`dinner net carbs ${dn.netCarbs_g} g not the lowest of the main meals (rule 12)`);
    const dev = Math.abs(total.kcal - t.kcal) / t.kcal;
    if (dev > cfg.energyTolerance) bad(`energy ${total.kcal} kcal is ${Math.round(dev * 100)}% from ${t.kcal}, over ±${cfg.energyTolerance * 100}% (rule 13)`);
    const dr = meals.dinner.recipe;
    if (!cfg.dinner.allowedLoads.includes(dr.load)) bad(`dinner "${dr.title}" has load "${dr.load}" (rule 6)`);
    if (cfg.dinner.lightestBy === 'kcal' && !(dn.kcal < meals.breakfast.macros.kcal && dn.kcal < meals.lunch.macros.kcal)) bad(`dinner ${dn.kcal} kcal not below breakfast and lunch (rule 6)`);
    if (dn.fibre_g < cfg.dinner.fibreMin_g) bad(`dinner fibre ${dn.fibre_g} g under ${cfg.dinner.fibreMin_g} g (rule 7)`);
    for (const i of dr.ingredients) if (cfg.dinner.refinedBases.includes(i.key)) bad(`dinner "${dr.title}" built on refined carb "${i.key}" (rule 7)`);
    rows.push(row);
  }

  for (let i = 0; i + 7 <= days.length; i++) {
    const win = days.slice(i, i + 7);
    const nonVeg = {}; let dishes = 0, indian = 0;
    for (const d of win) for (const s of cfg.slots) {
      const m = d.meals[s]; if (!m) continue;
      dishes++; if (!cfg.nonIndianCuisines.includes(m.recipe.cuisine)) indian++;
      if (m.addOn) { nonVeg[m.addOn.recipe.slug] = (nonVeg[m.addOn.recipe.slug] ?? 0) + 1; dishes++; if (!cfg.nonIndianCuisines.includes(m.addOn.recipe.cuisine)) indian++; }
    }
    const label = `${win[0].where} → ${win[6].where}`;
    for (const [slug, n] of Object.entries(nonVeg)) if (n > cfg.nonVegMaxPer7Days) fail(label, `non-veg "${slug}" appears ${n}× in 7 days, max ${cfg.nonVegMaxPer7Days} (rule 5)`);
    if (dishes && indian / dishes < cfg.indianMinShare) fail(label, `Indian share ${Math.round((indian / dishes) * 100)}% under ${cfg.indianMinShare * 100}% (rule 8)`);
  }
  return { errors, warnings, rows, days };
}

export function formatTable(rows, { compact = false } = {}) {
  const pad = (s, n) => String(s).padStart(n);
  const out = [];
  if (!compact) out.push('day                                   train   kcal (target)   protein (floor)   net carbs (range)   fibre (min)');
  for (const r of rows) {
    if (compact) out.push(`${r.ok ? ' ' : '✗'} ${r.where.replace(/^week (\d) (\w{3})\w* \((\d{4}-)?(\d{2}-\d{2})\)/, 'w$1 $2 $4')} ${r.training.padEnd(4)} ${pad(r.kcal, 4)} P${pad(r.protein_g, 3)} NC${pad(r.netCarbs_g, 3)}/${r.ncHi} F${pad(r.fibre_g, 2)}`);
    else out.push(`${r.ok ? '  ' : '✗ '}${r.where.padEnd(36)}${r.training.padEnd(6)} ${pad(r.kcal, 6)} (${r.targetKcal})   ${pad(r.protein_g, 5)} g (${r.protFloor})     ${pad(r.netCarbs_g, 5)} g (${r.ncLo}–${r.ncHi})    ${pad(r.fibre_g, 4)} g (${r.fibreMin})`);
  }
  return out.join('\n');
}
