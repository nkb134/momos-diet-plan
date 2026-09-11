#!/usr/bin/env node
/** Runs Lighthouse (mobile) against the built site served by `astro preview` and prints the scores. */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const base = '/momos-diet-plan/';
const preview = spawn('npx', ['astro', 'preview', '--port', '4399'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const pages = { chart: `http://localhost:4399${base}`, recipe: `http://localhost:4399${base}recipes/chana-dhokla-curd/`, library: `http://localhost:4399${base}library/` };
const results = {};
try {
  for (const [name, url] of Object.entries(pages)) {
    const out = `./.lighthouse-${name}.json`;
    await new Promise((res, rej) => {
      const p = spawn('npx', ['lighthouse', url, '--quiet', '--chrome-flags=--headless=new --no-sandbox', '--only-categories=performance,accessibility,best-practices,seo', '--form-factor=mobile', '--screenEmulation.mobile', `--output=json`, `--output-path=${out}`], { stdio: 'inherit' });
      p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`lighthouse exit ${c}`))));
    });
    const j = JSON.parse((await import('node:fs')).readFileSync(out, 'utf8'));
    results[name] = Object.fromEntries(Object.entries(j.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  }
} finally { preview.kill(); }
console.table(results);
writeFileSync('./lighthouse-scores.json', JSON.stringify(results, null, 2));
