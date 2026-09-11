#!/usr/bin/env node
/**
 * Applies one Telegram bot command to the plan or recipe files, runs the
 * validator, and writes a reply. Used by .github/workflows/bot-command.yml.
 *
 *   node --experimental-strip-types scripts/bot-apply.mjs '<json payload>' [--dry-run]
 *
 * Payload: { command: "swap", args: ["w1 tue", "dinner", "palak-tofu-jowar"], text: "" }
 * Exit 0 with reply in bot-reply.txt; a failed validation also exits 0 but
 * writes nothing to disk and says so in the reply. Exit 1 only on bad input.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { loadTable, loadRecipes, loadPlan, root } from './lib/load.mjs';
import { runValidation, formatTable } from './lib/validate.mjs';
import { resolveDay, resolveSlot, todayInZone } from './lib/days.mjs';
import { entryMacros, roundMacros } from '../src/lib/macros.mjs';
import { planConfig } from '../src/plan.config.ts';

const dryRun = process.argv.includes('--dry-run');
const payload = JSON.parse(process.argv[2] ?? '{}');
const ALLOWED = ['swap', 'addon', 'training', 'portion', 'out', 'recipe', 'validate'];
const command = String(payload.command ?? '').toLowerCase();
const args = (payload.args ?? []).map(String);
// Second line of defence behind the Worker: only known commands, only plain characters in args.
if (!ALLOWED.includes(command)) { console.log(`✗ Unknown command "${command}".`); process.exit(1); }
if (args.some((a) => !/^[A-Za-z0-9 _.:/-]{0,64}$/.test(a))) { console.log('✗ Arguments may only contain letters, digits, spaces, and _ . : / -'); process.exit(1); }
const table = loadTable();
const recipes = loadRecipes();
const weeks = loadPlan();
const flatDays = weeks.flatMap((w) => w.days.map((d) => ({ ...d, week: w.week })));
const today = todayInZone(planConfig.timeZone);
const PORTIONS = [1, 0.9, 1.1, 0.8, 1.2, 0.75, 1.25, 0.7, 1.3];

const reply = (text, changed = false) => {
  writeFileSync(`${root}bot-reply.txt`, text);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, { flag: 'a' });
  console.log(text);
};
const fatal = (msg) => { reply(`✗ ${msg}`); process.exit(0); };

function findDay(ref) {
  const d = resolveDay(ref, flatDays, today);
  if (!d) fatal(`I don't know which day "${ref}" is. Try "tue", "w2 sat", "2026-09-19", or "today".`);
  return d;
}
function planDay(date) {
  for (const w of weeks) for (const d of w.days) if (d.date === date) return { w, d };
  throw new Error('day not found');
}
function savePlan() {
  if (dryRun) return;
  for (const w of weeks) {
    const file = `${root}src/content/plan/week-${String(w.week).padStart(2, '0')}.yaml`;
    writeFileSync(file, `# Week ${w.week}. Generated from diet-chart-seed.yaml; portion and anchorGrams are fixed.\n` + stringify({ week: w.week, title: w.title, days: w.days }, { lineWidth: 0 }));
  }
}
function validate() { return runValidation({ table, recipes, weeks }); }
function dayRow(rows, date) { return rows.find((r) => r.date === date); }
function mealLine(r, e) { const m = roundMacros(entryMacros(r, e, table).macros); return `${r.title} · ${m.protein_g} g protein, ${m.kcal} kcal, ${m.netCarbs_g} g net carbs, ${m.fibre_g} g fibre`; }

/** Try portions for one meal until the whole plan validates. Returns the portion used or null. */
function fitPortion(date, slot) {
  const { d } = planDay(date);
  const e = d.meals[slot];
  const original = { ...e };
  for (const p of PORTIONS) {
    e.portion = p; e.anchorGrams = {};
    if (validate().errors.length === 0) return p;
  }
  Object.assign(e, original);
  return null;
}

const handlers = {
  swap([dayRef, slotRef, slug]) {
    const d = findDay(dayRef); const slot = resolveSlot(slotRef);
    if (!slot) fatal('Slot must be breakfast, lunch, snack or dinner.');
    const r = recipes[slug];
    if (!r) fatal(`No recipe "${slug}". Send /recipes ${slot} for the list.`);
    if (r.diet !== 'veg') fatal(`${r.title} is non-veg; use /addon to attach it.`);
    const { d: pd } = planDay(d.date);
    const before = mealLine(recipes[pd.meals[slot].veg], pd.meals[slot]);
    const beforeErrors = validate().errors.length;
    pd.meals[slot].veg = slug;
    const p = fitPortion(d.date, slot);
    if (p === null) {
      const v = validate();
      const row = dayRow(v.rows, d.date);
      pd.meals[slot] = { ...pd.meals[slot] };
      return reply(`✗ ${r.title} does not fit ${d.day} ${slot} at any portion between 0.7 and 1.3. Nothing changed.\n\nClosest attempt:\n<pre>${formatTable(row ? [row] : [], { compact: true })}\n${(row?.problems ?? v.errors.slice(0, 4)).join('\n')}</pre>`);
    }
    savePlan();
    const v = validate();
    return reply(`✓ ${d.day} ${d.date} ${slot}\nwas: ${before}\nnow: ${mealLine(r, pd.meals[slot])}${p !== 1 ? `\nportion set to ${p} to keep the day inside the rules` : ''}\n\n<pre>${formatTable([dayRow(v.rows, d.date)], { compact: true })}</pre>${beforeErrors ? '\n(note: the plan had failures before this change too)' : ''}`, true);
  },
  addon([dayRef, slotRef, slug]) {
    const d = findDay(dayRef); const slot = resolveSlot(slotRef);
    if (!slot) fatal('Slot must be breakfast, lunch, snack or dinner.');
    const { d: pd } = planDay(d.date);
    if (!slug || slug === 'none' || slug === 'off') { delete pd.meals[slot].nonVegAddOn; }
    else { const r = recipes[slug]; if (!r) fatal(`No recipe "${slug}".`); if (r.diet === 'veg') fatal(`${r.title} is veg; add-ons are non-veg. Use /swap for veg dishes.`); pd.meals[slot].nonVegAddOn = slug; }
    const v = validate();
    if (v.errors.length) return reply(`✗ That breaks a rule, nothing changed:\n<pre>${v.errors.slice(0, 5).join('\n')}</pre>`);
    savePlan();
    return reply(`✓ ${d.day} ${slot} add-on ${slug && slug !== 'none' && slug !== 'off' ? `set to ${recipes[slug].title}` : 'removed'}.`, true);
  },
  training([dayRef, kind]) {
    const d = findDay(dayRef); const k = (kind || '').toLowerCase();
    if (!['lift', 'swim', 'rest'].includes(k)) fatal('Training must be lift, swim or rest.');
    const { d: pd } = planDay(d.date);
    const was = pd.training; pd.training = k;
    const v = validate(); const row = dayRow(v.rows, d.date);
    if (row && !row.ok) { pd.training = was; return reply(`✗ Making ${d.day} a ${k} day breaks its targets, nothing changed:\n<pre>${formatTable([row], { compact: true })}\n${row.problems.join('\n')}</pre>\nSwap a meal first, then retry.`); }
    savePlan();
    return reply(`✓ ${d.day} ${d.date} is now a ${k} day.\n<pre>${formatTable([row], { compact: true })}</pre>`, true);
  },
  portion([dayRef, slotRef, n]) {
    const d = findDay(dayRef); const slot = resolveSlot(slotRef); const p = Number(n);
    if (!slot || !(p > 0.3 && p < 3)) fatal('Usage: /portion <day> <slot> <0.5–2.0>');
    const { d: pd } = planDay(d.date);
    const was = pd.meals[slot].portion; pd.meals[slot].portion = p;
    const v = validate(); const row = dayRow(v.rows, d.date);
    if (row && !row.ok) { pd.meals[slot].portion = was; return reply(`✗ Portion ${p} breaks the day, nothing changed:\n<pre>${row.problems.join('\n')}</pre>`); }
    savePlan();
    return reply(`✓ ${d.day} ${slot} portion ${was} → ${p}.\n<pre>${formatTable([row], { compact: true })}</pre>`, true);
  },
  out([key, range = 'all']) {
    if (!table[key]) fatal(`"${key}" is not an ingredient key. Examples: paneer_lowfat, tofu, soya_chunks, palak.`);
    const wk = /^w(\d)$/.exec(range)?.[1];
    const changes = [], stuck = [];
    for (const w of weeks) {
      if (wk && w.week !== +wk) continue;
      for (const d of w.days) for (const slot of Object.keys(d.meals)) {
        const e = d.meals[slot]; const r = recipes[e.veg];
        if (!r.ingredients.some((i) => i.key === key)) continue;
        const cur = roundMacros(entryMacros(r, e, table).macros);
        const candidates = Object.values(recipes)
          .filter((c) => c.diet === 'veg' && c.meals.includes(slot) && c.slug !== r.slug && !c.ingredients.some((i) => i.key === key))
          .map((c) => ({ c, m: c.macros, score: Math.abs(c.macros.protein_g - cur.protein_g) * 3 + Math.abs(c.macros.kcal - cur.kcal) / 10 }))
          .sort((a, b) => a.score - b.score).slice(0, 6);
        const original = { ...e };
        let done = false;
        for (const { c } of candidates) {
          e.veg = c.slug;
          const p = fitPortion(d.date, slot);
          if (p !== null) { changes.push(`${d.day} ${d.date} ${slot}: ${r.title} → ${c.title}${p !== 1 ? ` (portion ${p})` : ''}`); done = true; break; }
        }
        if (!done) { Object.assign(e, original); stuck.push(`${d.day} ${d.date} ${slot}: ${r.title} (no fitting alternative)`); }
      }
    }
    if (!changes.length && !stuck.length) return reply(`Nothing in ${range === 'all' ? 'the plan' : range} uses ${table[key].name}.`);
    if (changes.length) savePlan();
    return reply(`${changes.length ? `✓ Replaced ${table[key].name} in ${changes.length} meal(s):\n` + changes.join('\n') : ''}${stuck.length ? `\n\n✗ Could not replace:\n${stuck.join('\n')}` : ''}`, changes.length > 0);
  },
  recipe([], text) {
    // same key: value format as the issue form, one field per line; ingredients and steps as blocks
    const body = text || '';
    const field = (k) => (body.match(new RegExp(`^${k}:\\s*(.+)$`, 'im'))?.[1] ?? '').trim();
    const block = (k) => { const m = body.match(new RegExp(`^${k}:\\s*\\n([\\s\\S]*?)(?=^\\w+:|\\s*$)`, 'im')); return (m?.[1] ?? '').split('\n').map((s) => s.replace(/^[-\d.)\s]+/, '').trim()).filter(Boolean); };
    const title = field('title'); if (!title) fatal('Recipe needs a "title:" line. Send /help recipe for the format.');
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const file = `${root}src/content/recipes/${slug}.md`;
    if (existsSync(file)) fatal(`A recipe called ${slug} already exists.`);
    const diet = field('diet') || 'veg';
    const ingredients = block('ingredients').map((l) => { const [key, qty] = l.split(/\s+/); if (!table[key]) fatal(`Unknown ingredient key "${key}".`); return { item: table[key].name, key, qty: +qty || 0, unit: 'g', household: '' }; });
    if (!ingredients.length) fatal('Recipe needs an "ingredients:" block with "<key> <grams per serving>" lines.');
    const meals = (field('meals') || 'lunch').split(/[,\s]+/).map((m) => resolveSlot(m)).filter(Boolean);
    const [prepMin, cookMin] = (field('time') || '10 20').split(/[,\s]+/).map((x) => +x || 0);
    const fm = { title, slug, diet, meals, cuisine: field('cuisine') || 'North Indian', region: field('region'), image: `${slug}.jpg`, imageCredit: { name: '', url: '', license: '' }, video: null, prepMin, cookMin,
      serves: +(field('serves') || (diet === 'veg' ? 2 : 1)), macros: { kcal: 0, protein_g: 0, carbs_g: 0, fibre_g: 0, netCarbs_g: 0, fat_g: 0 }, load: field('load') || 'moderate', anchor: field('anchor') || ingredients[0].key,
      tags: [], difficulty: 'easy', equipment: ['gas stove', 'kadhai'], ingredients, swaps: [], steps: block('steps'), notes: field('notes') };
    const macros = roundMacros(entryMacros(fm, { portion: 1 }, table).macros); fm.macros = macros;
    if (!dryRun) writeFileSync(file, `---\n${stringify(fm, { lineWidth: 0 })}---\n`);
    return reply(`✓ Recipe ${slug} written: ${macros.protein_g} g protein, ${macros.kcal} kcal, ${macros.netCarbs_g} g net carbs, ${macros.fibre_g} g fibre per serving. Put it on a day with /swap. Add a photo at src/assets/recipes/${slug}.jpg when you can.`, true);
  },
  validate() {
    const v = validate();
    return reply(v.errors.length ? `✗ ${v.errors.length} problem(s)\n<pre>${formatTable(v.rows.filter((r) => !r.ok), { compact: true })}\n${v.errors.slice(0, 8).join('\n')}</pre>` : `✓ All 14 rules pass for ${v.rows.length} days.\n<pre>${formatTable(v.rows, { compact: true })}</pre>`);
  },
};

const h = handlers[command];
if (!h) fatal(`Unknown command "${command}".`);
h(args, payload.text);
