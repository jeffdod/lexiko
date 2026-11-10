// What a kind drill does to the gates: each first-try answer counts toward that kind, and passing opens it for daily parsing.
import { noteDrill, gateOpen, gateStats, passNeed, verbsOn, FAM_ACC } from './know.js';
import { participleForms, infinitiveForms, subjunctiveForms, imperativeForms } from './parse.js';
import { FAMILY, kindName } from './kinds.js';
import { toast } from './util.js';

const FORMS = { ptc: participleForms, inf: infinitiveForms, sub: subjunctiveForms, imp: imperativeForms };
/** How many forms of this kind there are in the verbs you know (a small number shortens the pass mark). */
export const poolForms = (fam, key) => FORMS[fam](key, { ignoreLevel: true });
export const poolOf = (fam, key) => poolForms(fam, key).length;
/** One first-try answer in a "Which kind is it?" drill; says so when that opens the kind. Does nothing while verb parsing is off. */
export async function noteKind(fam, key, ok) {
  if (!verbsOn()) return false;
  const gk = fam + ':' + key, opened = await noteDrill(gk, ok, poolOf(fam, key));
  if (opened) toast(kindName(fam, key) + ' ' + FAMILY[fam].name.toLowerCase() + ' now open in daily parsing.', 8000);
  return opened;
}
/** A line for the results page about one kind: where it stands. */
export function kindLine(fam, key) {
  const gk = fam + ':' + key, name = kindName(fam, key);
  if (gateOpen(gk)) return name + ': open in daily parsing.';
  const s = gateStats(gk), need = passNeed(poolOf(fam, key));
  return name + ': ' + (s.n < need ? (need - s.n) + ' more answers to check it' : 'opens at ' + Math.round(FAM_ACC * 100) + '% (you: ' + Math.round(s.acc * 100) + '%)') + '.';
}
