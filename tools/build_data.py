#!/usr/bin/env python3
"""Build lexiko's static data from the RP text + Dodson lexicon.

usage: build_data.py RP_DIR DODSON_XML USER_LEXICON OUT_DIR
Outputs (all UTF-8 JSON, compact):
  lexicon.json   lexemes keyed by Strong's number (Dodson headword/gloss + RP frequency)
  forms.json     every distinct word form (soft-hyphenated) with its RP analyses and count
  text/XXX.json  one file per book: token streams of form ids
  books.json     book list with chapter/verse/token counts
  meta.json      version + provenance
Token integer = formId * 16 + p;  p&7: 0 none, 1 ',', 2 '.', 3 '·', 4 ';'   p&8: an em-dash follows the word (source marker '-' or '_'), with no space after it
"""
import sys, os, json, re, collections, datetime
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rp
from beta import to_unicode
import unicodedata
from hyph import hyphenate

PUNCT_CODE = {'': 0, ',': 1, '.': 2, '·': 3, ';': 4}

def load_user_lexicon(path):
    """Tab-separated: Strong's, Beta Code headword (with endings), gloss."""
    out = {}
    with open(path, encoding='latin-1', newline='') as f:
        for ln in f:
            p = ln.rstrip('\r\n').split('\t')
            if len(p) != 3: continue
            parts = [x.strip() for x in p[1].split(',')]
            def conv(w):
                return w.lower() if w.startswith('(') and w.endswith(')') else to_unicode(w)  # annotation, e.g. (ACC.)
            try:
                uni = ', '.join(' '.join(conv(w) for w in x.split(' ')) for x in parts)
            except ValueError:
                uni = None   # e.g. 5516 (the numeral 666): headword taken from Dodson
            out[int(p[0])] = (uni, p[2].strip())
    return out


def norm_head(s):
    return unicodedata.normalize('NFC', s).lower()


def main(rp_dir, dodson_xml, user_lex, out_dir):
    books = rp.load_all(rp_dir)
    # ---- Dodson ----
    ns = '{http://www.crosswire.org/2008/TEIOSIS/namespace}'
    dodson = {}
    for e in ET.parse(dodson_xml).getroot().iter(ns + 'entry'):
        n = int(e.get('n').split('|')[1].strip())
        orth = (e.find(ns + 'orth').text or '').strip()
        brief = full = ''
        for d in e.findall(ns + 'def'):
            txt = re.sub(r'\s+', ' ', ''.join(d.itertext())).strip()
            if d.get('role') == 'brief': brief = txt
            elif d.get('role') == 'full': full = txt
        dodson[n] = (orth, brief, full)
    user = load_user_lexicon(user_lex)
    head_mismatch = []
    # ---- frequencies / pos / forms ----
    freq = collections.Counter(); pos = collections.defaultdict(collections.Counter)
    first = {}; per_book = collections.defaultdict(collections.Counter)
    forms, form_id, form_count = [], {}, collections.Counter()
    hy_cache = {}
    book_out = {}
    for code, verses in books.items():
        for ch, vs, toks in verses:
            for t in toks:
                s0, m0 = t['analyses'][0]
                freq[s0] += 1; pos[s0][m0.split('-')[0]] += 1
                per_book[s0][code] += 1
                first.setdefault(s0, (code, ch, vs))
    for code, verses in books.items():
        chapters = collections.OrderedDict()
        for ch, vs, toks in verses:
            ints = []
            for t in toks:
                w = t['word']
                if w not in hy_cache: hy_cache[w] = hyphenate(w)
                key = (hy_cache[w], tuple(t['analyses']))
                if key not in form_id:
                    form_id[key] = len(forms); forms.append(key)
                fid = form_id[key]; form_count[fid] += 1
                ints.append(fid * 16 + PUNCT_CODE[t['punct']] + (8 if t['flag'] else 0))
            chapters.setdefault(ch, []).append([vs, ints])
        book_out[code] = [[c, v] for c, v in chapters.items()]
    # ---- lexicon: only lexemes that occur in the RP text ----
    lex = []
    for n in sorted(freq):
        orth, d_brief, full = dodson[n]
        u_head, brief = user[n]
        if u_head is not None and norm_head(u_head) != norm_head(orth): head_mismatch.append((n, u_head, orth))
        if not brief: brief = d_brief
        p = pos[n].most_common(1)[0][0]
        lex.append([n, u_head or orth, brief, full if full != brief else '', freq[n], p])
    os.makedirs(os.path.join(out_dir, 'text'), exist_ok=True)
    def dump(name, obj):
        with open(os.path.join(out_dir, name), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    dump('lexicon.json', lex)
    dump('forms.json', [[w, form_count[i]] + [x for a in an for x in a] for i, (w, an) in enumerate(forms)])
    meta_books = []
    for prefix, code, name in rp.BOOKS:
        v = books[code]
        dump('text/%s.json' % code, book_out[code])
        meta_books.append({'code': code, 'name': name,
                           'chapters': [[c, len(vv)] for c, vv in book_out[code]],
                           'tokens': sum(len(t['analyses']) and 1 for _, _, ts in v for t in ts)})
    dump('books.json', meta_books)
    dump('meta.json', {
        'built': datetime.date.today().isoformat(), 'tokens': sum(b['tokens'] for b in meta_books),
        'forms': len(forms), 'lexemes': len(lex), 'verses': sum(len(v) for v in books.values()),
        'text': 'Robinson-Pierpont Majority Text Greek New Testament (supplied by the project owner, CCAT Beta Code with Strong\'s numbers and RP parsing codes)',
        'lexicon': 'Glosses: project owner\'s lexicon (a Dodson Greek-English Lexicon derivative); long definitions and Unicode headwords: Dodson Greek-English Lexicon (public domain / CC0), biblicalhumanities/Dodson-Greek-Lexicon',
        'tokenEncoding': 'formId*16 + p; p&7 punct (1 comma,2 period,3 ano teleia,4 question); p&8 em-dash follows the word (no space after)',
    })
    print('headword mismatches (user lexicon vs Dodson):', len(head_mismatch), head_mismatch[:15])
    print('lexemes', len(lex), 'forms', len(forms), 'tokens', sum(freq.values()))

if __name__ == '__main__':
    main(*sys.argv[1:5])
