// Sanity check for js/stem.js and js/parse-model.js against the real data: node tools/test_stem.mjs [form ...]
import fs from 'node:fs';
import { explain } from '../js/stem.js';
import { buildItem, check, groupForms, mergeForms } from '../js/parse-model.js';
import { decode } from '../js/morph.js';
const J = (p) => JSON.parse(fs.readFileSync(new URL('../data/' + p, import.meta.url)));
const lex = new Map(J('lexicon.json').map((r) => [r[0], r]));
const forms = J('forms.json').map((r) => { const an = []; for (let i = 2; i < r.length; i += 2) an.push({ s: r[i], m: r[i + 1] }); return { w: r[0].replace(/­/g, ''), count: r[1], an }; });
const want = process.argv.slice(2);
let n = 0, ok = 0, crash = 0, notes = 0, personOnNonVerb = 0;
for (const f of forms) {
  const item = buildItem(f); if (!item) continue; n++;
  if (item.group !== 'V') for (const v of item.valid) {                   // what is asked must follow the RP code
    const pos = v.code[0] === 'P' || v.code[0] === 'F' || v.code[0] === 'S' ? v.code[0] : 'other', explicit = pos === 'F' || pos === 'S' || /^P-[123]/.test(v.code);
    if (v.keys.includes('person') !== explicit) personOnNonVerb++;
    if (v.code.startsWith('S-') !== v.keys.includes('possessorNumber')) personOnNonVerb++;
  }
  try {
    const d = item.valid[0].d, L = lex.get(f.an[0].s);
    const ex = explain(L[1], f.w, d); if (ex.length) notes++;
    const res = check(item, Object.fromEntries(item.valid[0].keys.map((k) => [k, item.valid[0].slots[k]]))); if (res.full) ok++;
    if (want.includes(f.w)) console.log(f.w, '<-', L[1], item.valid.map((v) => v.code).join(' | '), '\n  ' + ex.join('\n  '));
  } catch (e) { crash++; console.log('CRASH', f.w, e.message); }
}
console.log({ drillable: n, selfCheckFull: ok, withNotes: notes, crash, personOnNonVerb });
if (personOnNonVerb) { console.log('FAIL: person/possessor asked where the RP code does not have it (or missing where it does)'); process.exit(1); }

// Every reading of the same written form must be accepted (τὰ is stored as T-NPN and T-APN in separate rows).
{
  const { canon, members } = groupForms(forms);
  const merged = (w) => { const i = forms.findIndex((f) => f.w === w); return buildItem(mergeForms(forms, members.get(canon[i]))); };
  const ta = merged('τὰ'), codes = ta.valid.map((v) => v.code);
  const full = (it, code, ans) => check(it, ans).full;
  const bad = [];
  if (!(codes.includes('T-NPN') && codes.includes('T-APN'))) bad.push('τὰ: ' + codes.join());
  if (!full(ta, 'T-NPN', { case: 'N', number: 'P', gender: 'N' })) bad.push('τὰ nominative plural neuter rejected');
  if (!full(ta, 'T-APN', { case: 'A', number: 'P', gender: 'N' })) bad.push('τὰ accusative plural neuter rejected');
  const multi = [...members.values()].filter((ids) => ids.length > 1).length;
  console.log({ groupedForms: multi, ta: codes });
  if (bad.length) { console.log('FAIL:', bad); process.exit(1); }
}

// Verb breakdowns must be built from the form's own letters (no other verbs' examples).
{
  const { breakdown } = await import('../js/stem.js');
  const bad = [];
  const t = (head, form, code, wantPieces, forbid = []) => {
    const b = breakdown(head, form, decode(code)), got = b.pieces.map((p) => p.text.normalize('NFC')).join('+'), txt = b.notes.join(' ');
    if (wantPieces && got !== wantPieces) bad.push(form + ': pieces ' + got + ' ≠ ' + wantPieces);
    for (const w of forbid) if (txt.includes(w)) bad.push(form + ': note mentions ' + w);
  };
  t('λύω', 'ἐλύθην', 'V-API-1S', 'ἐ+λύ+θη+ν', ['ἔμεινα', 'λέ-λυ-κα']);
  t('λύω', 'ἔλυσαν', 'V-AAI-3P', 'ἔ+λυ+σα+ν');
  t('λύω', 'ἐλύσατο', 'V-AMI-3S', 'ἐ+λύ+σα+το');
  t('λύω', 'λύομεν', 'V-PAI-1P', 'λύ+ο+μεν');
  t('ἀποστέλλω', 'ἀπέστειλεν', 'V-AAI-3S', null, ['2nd aorist']);
  t('βάλλω', 'ἔβαλεν', 'V-2AAI-3S', null, ['liquid']);
  if (bad.length) { console.log('FAIL:', bad); process.exit(1); }
  console.log('breakdown checks ok');
}
