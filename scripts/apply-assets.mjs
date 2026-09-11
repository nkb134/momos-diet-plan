#!/usr/bin/env node
/** Merge image credits (images-*.json) and videos (videos-*.json) into recipe frontmatter. */
import { readFileSync, existsSync } from 'node:fs';
import { readFm, writeFm } from './lib/frontmatter.mjs';
import { root } from './lib/load.mjs';
const [, , ...files] = process.argv;
const images = {}, videos = {};
for (const f of files) {
  const arr = JSON.parse(readFileSync(f, 'utf8'));
  for (const r of arr) {
    if ('youtubeId' in r) { if (r.ok && (!videos[r.slug] || !videos[r.slug].preferred)) videos[r.slug] = r; }
    else if (r.ok) images[r.slug] = r;
  }
}
let ni = 0, nv = 0;
for (const slug of new Set([...Object.keys(images), ...Object.keys(videos)])) {
  const file = `${root}src/content/recipes/${slug}.md`;
  if (!existsSync(file)) continue;
  const { fm, body } = readFm(file);
  const im = images[slug];
  if (im) { fm.image = `${slug}.jpg`; fm.imageCredit = { name: im.author || '', url: im.pageUrl || '', license: im.license || '' }; ni++; }
  const v = videos[slug];
  if (v) { fm.video = { youtubeId: v.youtubeId, title: v.title || '', channel: v.channel || '', isShort: v.isShort !== false }; nv++; }
  writeFm(file, fm, body);
}
console.log(`apply-assets: ${ni} image credit(s), ${nv} video(s) applied`);
