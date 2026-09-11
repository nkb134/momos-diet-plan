#!/usr/bin/env node
/**
 * Build-time rule checks (brief rules 1–14). Logic lives in lib/validate.mjs.
 * Run with: node --experimental-strip-types scripts/validate-plan.mjs [--quiet]
 */
import { loadTable, loadRecipes, loadPlan } from './lib/load.mjs';
import { runValidation, formatTable } from './lib/validate.mjs';

const quiet = process.argv.includes('--quiet');
const { errors, warnings, rows, days } = runValidation({ table: loadTable(), recipes: loadRecipes(), weeks: loadPlan() });
if (!quiet || errors.length) console.log('\n' + formatTable(rows) + '\n');
if (!quiet) for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  console.error(`\nvalidate-plan: ${errors.length} problem(s)\n` + errors.map((e) => `  ✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`validate-plan: ${days.length} days, ${Object.keys(loadRecipes()).length} recipes, all rules pass${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
