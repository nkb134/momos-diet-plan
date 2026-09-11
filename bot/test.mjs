import assert from 'node:assert/strict';
import { parseCommand, readReply } from './src/commands.mjs';
const plan = { timeZone: 'Asia/Kolkata', days: [
  { date: '2026-09-12', day: 'Saturday', week: 1, training: 'rest', totals: { kcal: 1956, protein_g: 144, netCarbs_g: 115, fibre_g: 38 }, targets: { kcal: 1900, protein_g: 150, netCarbs_g: [80, 120], fibre_g: 35 }, meals: [{ slot: 'breakfast', slug: 'a', title: 'A', macros: { kcal: 1, protein_g: 2, netCarbs_g: 3, fibre_g: 4 }, addOn: null }], shopping: [{ label: 'Dairy', lines: [{ name: 'Paneer', grams: 200, hint: '' }] }] },
  { date: '2026-09-19', day: 'Saturday', week: 2, training: 'rest', totals: { kcal: 1, protein_g: 1, netCarbs_g: 1, fibre_g: 1 }, targets: { kcal: 1, protein_g: 1, netCarbs_g: [0, 1], fibre_g: 1 }, meals: [], shopping: [] },
], weeks: [{ week: 1, shopping: [] }] };
const index = [{ slug: 'a', title: 'Aloo Methi', diet: 'veg', meals: ['lunch'], ingredients: ['Potato'], macros: { protein_g: 8, kcal: 320 } }];
assert.deepEqual(parseCommand('/swap w2 sat dinner palak-tofu-jowar'), { command: 'swap', args: ['w2 sat', 'dinner', 'palak-tofu-jowar'], text: 'w2 sat dinner palak-tofu-jowar' });
assert.deepEqual(parseCommand('/training@MomoBot tue rest').args, ['tue', 'rest']);
assert.equal(parseCommand('hello'), null);
assert.equal(parseCommand('/recipe\ntitle: X').text, 'title: X');
assert.match(readReply(parseCommand('/day w2 sat'), { plan, index, siteUrl: 'https://x/' }), /Saturday 2026-09-19/);
assert.match(readReply(parseCommand('/day 12 sep'), { plan, index, siteUrl: 'https://x/' }), /2026-09-12/);
assert.match(readReply(parseCommand('/shop sat'), { plan, index, siteUrl: 'https://x/' }), /Paneer — 200 g/);
assert.match(readReply(parseCommand('/find potato'), { plan, index, siteUrl: 'https://x/' }), /aloo-methi|Aloo Methi/);
assert.equal(readReply(parseCommand('/swap x y z'), { plan, index, siteUrl: 'https://x/' }), null);
assert.match(readReply(parseCommand('/help'), { plan, index, siteUrl: 'https://x/' }), /\/swap/);
console.log('bot tests pass');
