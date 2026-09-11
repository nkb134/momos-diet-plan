/**
 * Deterministic SVG placeholder for a recipe without a photo. Palette and
 * geometry are derived from the slug, so the same recipe always gets the
 * same card. Returned as a data URI usable in <img src>.
 */
export function placeholderDataUri(slug: string, title: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 60)) % 360;
  const bg = `oklch(92% 0.05 ${hue})`;
  const fg = `oklch(45% 0.13 ${hue})`;
  const ring = `oklch(75% 0.12 ${hue2})`;
  const words = title.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 18) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const text = lines.slice(0, 3).map((l, i) =>
    `<text x="60" y="${560 + i * 64}" font-family="Georgia, serif" font-size="56" fill="${fg}">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`).join('');
  const r = 150 + (h % 80);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
<rect width="1024" height="768" fill="${bg}"/>
<circle cx="${700 + (h % 120)}" cy="${260 + (h % 90)}" r="${r}" fill="none" stroke="${ring}" stroke-width="28"/>
<circle cx="${700 + (h % 120)}" cy="${260 + (h % 90)}" r="${r * 0.45}" fill="${ring}" opacity="0.6"/>
${text}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
