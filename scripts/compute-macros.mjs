#!/usr/bin/env node
/**
 * Derives per-serving macros for every recipe from its ingredient quantities
 * and src/data/ingredients.yaml, and writes them back into frontmatter.
 * Fails if a recipe uses an ingredient missing from the table.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { macrosFromGrams, roundMacros } from '../src/lib/macros.mjs';

import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const table = parse(readFileSync(`${root}src/data/ingredients.yaml`, 'utf8'));
const dir = `${root}src/content/recipes/`;
let changed = 0, errors = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
  const src = readFileSync(dir + f, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) { console.error(`${f}: no frontmatter`); errors++; continue; }
  const fm = parse(m[1]);
  try {
    const grams = Object.fromEntries(fm.ingredients.map((i) => [i.key, i.qty]));
    const macros = roundMacros(macrosFromGrams(grams, table));
    if (JSON.stringify(macros) !== JSON.stringify(fm.macros)) {
      fm.macros = macros;
      writeFileSync(dir + f, `---\n${stringify(fm, { lineWidth: 0 })}---\n${m[2]}`);
      changed++;
    }
  } catch (e) {
    console.error(`${f}: ${e.message}`); errors++;
  }
}
console.log(`compute-macros: ${changed} recipe(s) updated, ${errors} error(s)`);
if (errors) process.exit(1);
