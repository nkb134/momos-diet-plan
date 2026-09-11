/**
 * Pure command parsing and read-only replies for the Telegram bot. No I/O,
 * so it is testable in Node and bundled into the Worker by Wrangler.
 */
import { resolveDay, resolveSlot, todayInZone } from '../../scripts/lib/days.mjs';

export const WRITE_COMMANDS = ['swap', 'addon', 'training', 'portion', 'out', 'recipe', 'validate'];
export const READ_COMMANDS = ['start', 'help', 'today', 'tomorrow', 'day', 'week', 'shop', 'recipes', 'find'];

export function parseCommand(text) {
  const m = (text || '').trim().match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  if (!m) return null;
  const command = m[1].toLowerCase();
  const rest = m[2].trim();
  // recipe carries a multi-line body; everything else is space-separated args
  if (command === 'recipe') return { command, args: [], text: rest };
  const firstLine = rest.split('\n')[0];
  // allow "w2 sat" style day refs: join a leading "w<n>" or "week <n>" with the next token
  const tokens = firstLine.split(/\s+/).filter(Boolean);
  const args = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase();
    if ((/^w\d$/.test(t) || t === 'week') && tokens[i + 1]) { args.push(`${t === 'week' ? 'w' + tokens[i + 1] : t} ${tokens[t === 'week' ? i + 2 : i + 1] ?? ''}`.trim()); i += t === 'week' ? 2 : 1; }
    else args.push(tokens[i]);
  }
  return { command, args, text: rest };
}

export const HELP = `Momo's Diet Plan bot

Read
/today · /tomorrow · /day <day> — meals and totals
/week <1|2> — every day's totals
/shop <day|w1|w2> — shopping list by aisle
/recipes <slot> — veg recipes that can fill a slot
/find <word> — search recipe titles

Change (validated before anything is saved)
/swap <day> <slot> <slug> — put a veg recipe on a day
/addon <day> <slot> <slug|none> — non-veg add-on on or off
/training <day> <lift|swim|rest>
/portion <day> <slot> <0.7–1.3>
/out <ingredient_key> [w1|w2] — replace every meal using it
/recipe — new recipe; send /help recipe for the format
/validate — run all 14 rules

Days: tue, w2 sat, 2026-09-19, 19 sep, today.`;

export const HELP_RECIPE = `Send /recipe followed by lines like:

title: Aloo Methi
diet: veg
meals: lunch, dinner
cuisine: North Indian
load: moderate
time: 10 20
serves: 2
anchor: paneer_lowfat
ingredients:
paneer_lowfat 120
methi_leaves 100
oil 5
steps:
Heat oil, crackle jeera.
Add methi, cook until wilted.
notes: keeps two days`;

const fmtMacros = (m) => `${m.protein_g}P ${m.netCarbs_g}NC ${m.fibre_g}F ${m.kcal}kcal`;

export function dayReply(d, siteUrl) {
  const lines = [`<b>${d.day} ${d.date}</b> · ${d.training} day`, ...d.meals.map((m) => `${cap(m.slot)}: ${m.title} — ${fmtMacros(m.macros)}${m.addOn ? `\n  + add-on: ${m.addOn.title} (+${m.addOn.macros.protein_g}P, +${m.addOn.macros.kcal}kcal)` : ''}`)];
  const t = d.totals, g = d.targets;
  lines.push(`Total: ${t.protein_g}/${g.protein_g} g protein · ${t.netCarbs_g} g net carbs (${g.netCarbs_g[0]}–${g.netCarbs_g[1]}) · ${t.fibre_g}/${g.fibre_g} g fibre · ${t.kcal}/${g.kcal} kcal`);
  lines.push(`${siteUrl}#${d.date}`);
  return lines.join('\n');
}

export function weekReply(plan, week) {
  const days = plan.days.filter((d) => d.week === week);
  if (!days.length) return `No week ${week}.`;
  return `<b>Week ${week}</b>\n<pre>${days.map((d) => `${d.day.slice(0, 3)} ${d.date.slice(5)} ${d.training.padEnd(4)} ${String(d.totals.kcal).padStart(4)} P${String(d.totals.protein_g).padStart(3)} NC${String(d.totals.netCarbs_g).padStart(3)} F${String(d.totals.fibre_g).padStart(2)}`).join('\n')}</pre>`;
}

export function shopReply(list, title) {
  return `<b>${title}</b>\n` + list.map((g) => `\n<b>${g.label}</b>\n` + g.lines.map((l) => `• ${l.name} — ${l.grams} g${l.hint ? ` (${l.hint})` : ''}`).join('\n')).join('\n');
}

export function recipesReply(index, slot) {
  const s = resolveSlot(slot);
  const rows = index.filter((r) => r.diet === 'veg' && (!s || r.meals.includes(s))).sort((a, b) => b.macros.protein_g - a.macros.protein_g);
  if (!rows.length) return 'No recipes for that slot.';
  return `<b>${s ? cap(s) : 'All'} · veg · by protein</b>\n` + rows.slice(0, 40).map((r) => `<code>${r.slug}</code> — ${r.macros.protein_g}P ${r.macros.kcal}kcal`).join('\n');
}

export function findReply(index, q) {
  const w = (q || '').toLowerCase();
  const rows = index.filter((r) => r.title.toLowerCase().includes(w) || r.ingredients.some((i) => i.toLowerCase().includes(w)));
  return rows.length ? rows.slice(0, 25).map((r) => `<code>${r.slug}</code> — ${r.title} (${r.diet})`).join('\n') : `Nothing matches "${q}".`;
}

/** Route a parsed command against plan.json / search.json; returns a reply string or null if it is a write command. */
export function readReply(parsed, { plan, index, siteUrl }) {
  const { command, args } = parsed;
  const today = todayInZone(plan.timeZone);
  const day = (ref) => resolveDay(ref, plan.days, today);
  switch (command) {
    case 'start': case 'help': return args[0] === 'recipe' ? HELP_RECIPE : HELP;
    case 'today': { const d = day('today'); return d ? dayReply(d, siteUrl) : `Today (${today}) is outside the plan.`; }
    case 'tomorrow': { const d = day('tomorrow'); return d ? dayReply(d, siteUrl) : 'Tomorrow is outside the plan.'; }
    case 'day': { const d = day(args.join(' ')); return d ? dayReply(d, siteUrl) : `Which day? Try "tue", "w2 sat" or a date.`; }
    case 'week': return weekReply(plan, +args[0] || 1);
    case 'shop': {
      const a = (args[0] || 'today').toLowerCase();
      const wk = /^w(\d)$/.exec(a)?.[1];
      if (wk) { const w = plan.weeks.find((x) => x.week === +wk); return w ? shopReply(w.shopping, `Week ${wk} shopping list`) : `No week ${wk}.`; }
      const d = day(a); return d ? shopReply(d.shopping, `${d.day} ${d.date}`) : 'Which day?';
    }
    case 'recipes': return recipesReply(index, args[0]);
    case 'find': return findReply(index, args.join(' '));
    default: return WRITE_COMMANDS.includes(command) ? null : `Unknown command. ${HELP}`;
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
