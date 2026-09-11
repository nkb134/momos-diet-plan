/**
 * Calendar settings for the chart.
 *
 * The plan is anchored to a real calendar date so day 1 of week 1 maps to a
 * specific day, and "today" detection uses the plan's time zone rather than the
 * viewer's browser. Both are read by the chart and by the validator; nothing
 * else should hardcode a date or zone.
 */
export const planConfig = {
  /** ISO date of week 1, day 1. Saturday 12 September 2026. */
  startDate: '2026-09-12',
  /** IANA zone used to decide which day is "today". */
  timeZone: 'Asia/Kolkata',
} as const;
