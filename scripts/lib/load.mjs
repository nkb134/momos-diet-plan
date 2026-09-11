/** Shared loaders for the Node scripts: ingredient table, recipes, plan. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const root = fileURLToPath(new URL('../..', import.meta.url));

export function loadTable() {
  return parse(readFileSync(`${root}src/data/ingredients.yaml`, 'utf8'));
}

export function loadRecipes() {
  const dir = `${root}src/content/recipes/`;
  const out = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const src = readFileSync(dir + f, 'utf8');
    const m = src.match(/^---\n([\s\S]*?)\n---/);
    if (!m) throw new Error(`${f}: missing frontmatter`);
    const fm = parse(m[1]);
    fm.__file = f;
    out[fm.slug] = fm;
  }
  return out;
}

export function loadPlan() {
  const dir = `${root}src/content/plan/`;
  return readdirSync(dir).filter((x) => x.endsWith('.yaml')).sort()
    .map((f) => parse(readFileSync(dir + f, 'utf8')));
}

export function imageExists(recipe) {
  return !!recipe.image && existsSync(`${root}src/assets/recipes/${recipe.image}`);
}
