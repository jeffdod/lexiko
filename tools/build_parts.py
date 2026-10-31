#!/usr/bin/env python3
"""Turn the principal-parts spreadsheet into data/parts.json.
usage: python3 tools/build_parts.py Greek_Verbs_Principal_Parts.xlsx
Output rows: [strongs, lemma, present, future, aorist, perfect, perfect mid/pas, aorist passive]  (null = not printed).
Several spreadsheet rows can share one Strong's number (ἀγγέλλω / ἀπαγγέλλω); the row chosen for a number is the one whose
lemma matches the lexicon headword, else (if none matches) the one whose printed forms occur most in the text."""
import sys, json, unicodedata, collections, pathlib
import openpyxl
ROOT = pathlib.Path(__file__).resolve().parent.parent
sk = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c)).lower().replace('ς', 'σ').replace('­', '').strip()
ws = openpyxl.load_workbook(sys.argv[1]).worksheets[0]
rows = []
for r in ws.iter_rows(min_row=5, values_only=True):
    if not r[0]: continue
    parts = [None if (p is None or str(p).strip() in ('', '---')) else str(p).strip() for p in r[2:8]]
    rows.append({'lemma': str(r[0]).strip(), 'n': int(r[1]) if r[1] else None, 'parts': parts})
lex = {r[0]: r for r in json.load(open(ROOT / 'data/lexicon.json'))}
forms = json.load(open(ROOT / 'data/forms.json'))
freq = collections.defaultdict(lambda: collections.Counter())          # strongs -> skeleton of form -> count
for f in forms: freq[f[2]][sk(f[0])] += f[1]
by = collections.defaultdict(list)
for r in rows:
    if r['n'] in lex: by[r['n']].append(r)
out, ambiguous = [], []
for n, rs in sorted(by.items()):
    head = sk(lex[n][1].split(',')[0])
    exact = [r for r in rs if sk(r['lemma']) == head]
    if exact: pick = exact[0]
    elif len(rs) == 1: pick = rs[0]
    else:
        score = lambda r: sum(freq[n][sk(p)] for p in r['parts'] if p)
        pick = max(rs, key=score); ambiguous.append((n, lex[n][1], [r['lemma'] for r in rs], pick['lemma']))
    out.append([n, pick['lemma'], *pick['parts']])
(ROOT / 'data/parts.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
unused = [r['lemma'] for r in rows if r['n'] not in lex or not any(o[1] == r['lemma'] and o[0] == r['n'] for o in out)]
print(len(rows), 'spreadsheet rows ->', len(out), 'lexicon verbs;', len(unused), 'rows not used')
print('chosen by frequency (check):', ambiguous)
print('not used:', unused[:60])
