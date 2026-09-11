/**
 * Macro engine. Plain JS with JSDoc so both Astro (TS) and the Node scripts
 * import the same code. Every number on the site comes from here.
 *
 * Contract (from the brief): apply `portion` to the whole recipe first, then
 * overwrite each ingredient named in `anchorGrams` with that exact gram value.
 * Net carbs = carbs − fibre. Sums are rounded once, at the end.
 */

/** @typedef {{ kcal:number, protein_g:number, carb_g:number, fibre_g:number, fat_g:number }} Per100 */
/** @typedef {{ kcal:number, protein_g:number, carbs_g:number, fibre_g:number, netCarbs_g:number, fat_g:number }} Macros */

/**
 * Grams of each ingredient for one plate of a plan entry.
 * @param {Record<string, number>} baseGrams  per-serving grams from the recipe
 * @param {number} portion
 * @param {Record<string, number>} anchorGrams
 * @returns {Record<string, number>}
 */
export function gramsForEntry(baseGrams, portion = 1, anchorGrams = {}) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const [key, g] of Object.entries(baseGrams)) out[key] = g * portion;
  for (const [key, g] of Object.entries(anchorGrams)) {
    if (!(key in out)) throw new Error(`anchorGrams names "${key}" which is not an ingredient of this recipe`);
    out[key] = g;
  }
  return out;
}

/**
 * Sum macros for a set of ingredient grams against the per-100g table.
 * Throws if an ingredient is missing from the table (rule 14).
 * @param {Record<string, number>} grams
 * @param {Record<string, Per100>} table
 * @returns {Macros}
 */
export function macrosFromGrams(grams, table) {
  let kcal = 0, protein = 0, carbs = 0, fibre = 0, fat = 0;
  for (const [key, g] of Object.entries(grams)) {
    const row = table[key];
    if (!row) throw new Error(`ingredient "${key}" is not in the ingredient table`);
    const f = g / 100;
    kcal += row.kcal * f;
    protein += row.protein_g * f;
    carbs += row.carb_g * f;
    fibre += row.fibre_g * f;
    fat += row.fat_g * f;
  }
  return { kcal, protein_g: protein, carbs_g: carbs, fibre_g: fibre, netCarbs_g: carbs - fibre, fat_g: fat };
}

/** @param {Macros} m @returns {Macros} */
export function roundMacros(m) {
  return {
    kcal: Math.round(m.kcal),
    protein_g: Math.round(m.protein_g),
    carbs_g: Math.round(m.carbs_g),
    fibre_g: Math.round(m.fibre_g),
    netCarbs_g: Math.round(m.netCarbs_g),
    fat_g: Math.round(m.fat_g),
  };
}

/** @param {Macros[]} list @returns {Macros} */
export function sumMacros(list) {
  const z = { kcal: 0, protein_g: 0, carbs_g: 0, fibre_g: 0, netCarbs_g: 0, fat_g: 0 };
  for (const m of list) for (const k of Object.keys(z)) z[/** @type {keyof Macros} */ (k)] += m[/** @type {keyof Macros} */ (k)];
  return z;
}

/**
 * Macros for one plan entry.
 * @param {{ ingredients: {key:string, qty:number}[] }} recipe
 * @param {{ portion?: number, anchorGrams?: Record<string, number> }} entry
 * @param {Record<string, Per100>} table
 */
export function entryMacros(recipe, entry, table) {
  const base = Object.fromEntries(recipe.ingredients.map((i) => [i.key, i.qty]));
  const grams = gramsForEntry(base, entry.portion ?? 1, entry.anchorGrams ?? {});
  return { grams, macros: macrosFromGrams(grams, table) };
}
