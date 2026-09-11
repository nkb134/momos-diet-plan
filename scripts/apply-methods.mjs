#!/usr/bin/env node
/** Merge <scratch>/methods/<slug>.json (written by the method authors) into recipe frontmatter. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { readFm, writeFm } from './lib/frontmatter.mjs';
import { root } from './lib/load.mjs';
const dir = process.argv[2];
if (!dir || !existsSync(dir)) { console.error('usage: apply-methods.mjs <dir of slug.json>'); process.exit(1); }
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const file = `${root}src/content/recipes/${j.slug}.md`;
  if (!existsSync(file)) { console.warn(`skip ${j.slug}: no recipe file`); continue; }
  const { fm, body } = readFm(file);
  for (const k of ['region', 'prepMin', 'cookMin', 'difficulty', 'tags', 'equipment', 'swaps', 'steps', 'notes']) if (j[k] !== undefined) fm[k] = j[k];
  if (j.household) for (const i of fm.ingredients) if (j.household[i.key]) i.household = j.household[i.key];
  writeFm(file, fm, body); n++;
}
console.log(`apply-methods: ${n} recipe(s) updated`);
