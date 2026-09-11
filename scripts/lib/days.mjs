/**
 * Resolve a human day reference to a plan day. Dependency-free so the
 * Cloudflare Worker and the Node scripts share it.
 * Accepts: "today", "tomorrow", "sat", "saturday", "w2 sat", "week 2 saturday",
 * "2026-09-19", "19", "19 sep".
 * @param {string} input
 * @param {{date:string, day:string, week:number}[]} days
 * @param {string} todayIso  YYYY-MM-DD in the plan's zone
 */
export function resolveDay(input, days, todayIso) {
  const s = (input || '').trim().toLowerCase();
  if (!s || s === 'today') return days.find((d) => d.date === todayIso) ?? null;
  if (s === 'tomorrow') { const i = days.findIndex((d) => d.date === todayIso); return i >= 0 ? days[i + 1] ?? null : null; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return days.find((d) => d.date === s) ?? null;
  const dom = s.match(/^(\d{1,2})(?:\s+([a-z]+))?$/);
  if (dom) {
    const n = +dom[1];
    return days.find((d) => +d.date.slice(8, 10) === n && (!dom[2] || monthName(d.date).startsWith(dom[2].slice(0, 3)))) ?? null;
  }
  const m = s.match(/^(?:w(?:eek)?\s*(\d)\s+)?([a-z]+)$/);
  if (!m) return null;
  const week = m[1] ? +m[1] : null;
  const name = m[2].slice(0, 3);
  const matches = days.filter((d) => d.day.toLowerCase().startsWith(name) && (week === null || d.week === week));
  if (!matches.length) return null;
  if (week !== null || matches.length === 1) return matches[0];
  // no week given: prefer today or the next occurrence, else the first
  const upcoming = matches.find((d) => d.date >= todayIso);
  return upcoming ?? matches[0];
}

function monthName(iso) {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][+iso.slice(5, 7) - 1];
}

export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
export function resolveSlot(input) {
  const s = (input || '').trim().toLowerCase();
  return SLOTS.find((x) => x.startsWith(s.slice(0, 3))) ?? null;
}

/** "YYYY-MM-DD" for now in a time zone, without Intl surprises. */
export function todayInZone(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
