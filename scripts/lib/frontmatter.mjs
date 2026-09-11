import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
/** Read and write recipe frontmatter without touching the body. */
export function readFm(file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no frontmatter`);
  return { fm: parse(m[1]), body: m[2] };
}
export function writeFm(file, fm, body = '') {
  writeFileSync(file, `---\n${stringify(fm, { lineWidth: 0 })}---\n${body}`);
}
