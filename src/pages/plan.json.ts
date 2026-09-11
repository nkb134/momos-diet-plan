import type { APIRoute } from 'astro';
import { loadPlan, shoppingList } from '../lib/plan';
import { planConfig } from '../plan.config';

/** Machine-readable plan for the Telegram bot's read-only commands. */
export const GET: APIRoute = async () => {
  const { days, table } = await loadPlan();
  const out = {
    startDate: planConfig.startDate,
    timeZone: planConfig.timeZone,
    days: days.map((d) => ({
      date: d.date, day: d.day, week: d.week, training: d.training, totals: d.totals, targets: d.targets,
      meals: d.meals.map((m) => ({
        slot: m.slot, slug: m.recipe.slug, title: m.recipe.title, minutes: m.recipe.prepMin + m.recipe.cookMin, macros: m.macros,
        addOn: m.addOn ? { slug: m.addOn.recipe.slug, title: m.addOn.recipe.title, macros: m.addOn.macros } : null,
      })),
      shopping: shoppingList([d], table),
    })),
    weeks: [...new Set(days.map((d) => d.week))].map((w) => ({ week: w, shopping: shoppingList(days.filter((d) => d.week === w), table) })),
  };
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
};
