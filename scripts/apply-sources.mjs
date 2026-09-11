#!/usr/bin/env node
/** Write verified `source` strings from sources.json into src/data/ingredients.yaml (values untouched). */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { root } from './lib/load.mjs';
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const file = `${root}src/data/ingredients.yaml`;
const table = parse(readFileSync(file, 'utf8'));
let n = 0;
for (const r of src) if (table[r.key] && r.source) { table[r.key].source = r.source; n++; }
writeFileSync(file, '# Per 100 g. Sources recorded per row (IFCT 2017 / USDA FDC). Edited by hand only for `source`.\n' + stringify(table, { lineWidth: 0 }));
console.log(`apply-sources: ${n} row(s) sourced`);
