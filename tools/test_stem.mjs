// Sanity check for js/stem.js and js/parse-model.js against the real data: node tools/test_stem.mjs [form ...]
import fs from 'node:fs';
import { explain } from '../js/stem.js';
import { buildItem, check } from '../js/parse-model.js';
import { decode } from '../js/morph.js';
const J = (p) => JSON.parse(fs.readFileSync(new URL('../data/' + p, import.meta.url)));
const lex = new Map(J('lexicon.json').map((r) => [r[0], r]));
const forms = J('forms.json').map((r) => { const an = []; for (let i = 2; i < r.length; i += 2) an.push({ s: r[i], m: r[i + 1] }); return { w: r[0].replace(/­/g, ''), count: r[1], an }; });
const want = process.argv.slice(2);
let n = 0, ok = 0, crash = 0, notes = 0, personOnNonVerb = 0;
for (const f of forms) {
  const item = buildItem(f); if (!item) continue; n++;
  if (item.group !== 'V' && item.valid.some((v) => v.keys.includes('person'))) personOnNonVerb++;
  try {
    const d = item.valid[0].d, L = lex.get(f.an[0].s);
    const ex = explain(L[1], f.w, d); if (ex.length) notes++;
    const res = check(item, Object.fromEntries(item.valid[0].keys.map((k) => [k, item.valid[0].slots[k]]))); if (res.full) ok++;
    if (want.includes(f.w)) console.log(f.w, '<-', L[1], item.valid.map((v) => v.code).join(' | '), '\n  ' + ex.join('\n  '));
  } catch (e) { crash++; console.log('CRASH', f.w, e.message); }
}
console.log({ drillable: n, selfCheckFull: ok, withNotes: notes, crash, personOnNonVerb });
if (personOnNonVerb) { console.log('FAIL: only verbs may be asked for person'); process.exit(1); }
