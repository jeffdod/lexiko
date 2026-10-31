# lexiko

Learn to read the Greek New Testament. A free, offline-first Progressive Web App: no login, no server, hosted as static files on GitHub Pages.

**Status: phases 1–2.** Reader, vocabulary SRS (FSRS), levels, passage readiness, goals, backup/restore, PWA shell.
**Planned:** parsing module (guided tense → voice → mood… tree, per-slot scoring, stem-change explanations), principal parts, pericope divisions, form-level SRS.

## Use it
Open `https://jeffdod.github.io/lexiko/` and "Add to Home Screen" / "Install app". It then runs full-screen and fully offline.

## Deploy (GitHub Pages)
1. Push this folder's contents to the repo root (`main`).
2. Repo → Settings → Pages → *Deploy from a branch* → `main` / `(root)`. (Free Pages requires a public repo.)
3. `.nojekyll` is included. All paths are relative, so it works under `/lexiko/` or a custom domain.

## Rebuild after changes (needs Python 3 + fontTools, Node)
```
python3 tools/build_data.py sources/rp sources/lexicon/dodson.xml sources/lexicon/user-lexicon.txt data   # RP + lexicon -> data/*.json
python3 tools/build_pericopes.py sources/pericopes/kretzmann.txt data                                  # section headings -> data/pericopes.json
python3 tools/make_fonts.py <GentiumPorsonic dir> fonts                                               # subset + rename + woff2
python3 tools/make_icons.py && node tools/render_icons.js                                              # icons, favicon, social card
python3 tools/build_sw.py        # ALWAYS run after changing any app file: regenerates the offline precache list/version
node tools/serve.js &            # local test server at http://localhost:8123/lexiko/
node tools/test_smoke.js         # end-to-end test in headless Chromium (needs playwright)
```
Users get new versions automatically: the service worker notices a changed `sw-assets.js`, downloads the update, and shows an "Update ready — Reload" banner.

## How it works
* `data/` – `lexicon.json` (5,381 lexemes: Strong's no., headword, gloss, frequency), `forms.json` (20,591 distinct word forms with soft hyphens and RP parsing; alternate parsings kept), `text/XXX.json` (one token stream per book, ints = form id × 16 + punctuation (0–4) + 8 if an em-dash follows the word; in the Beta source a trailing `-` or `_` marks that dash, and the following space is dropped). `pericopes.json` holds 589 section headings; each runs to the verse before the next heading.
* Words are keyed by **Strong's number**; frequencies are counted from the RP text itself.
* A word is *known* if you have a mature SRS card for it, or (no card yet) its frequency ≥ your declared level. Missing a "known" word in a check-in demotes it to learning.
* Passage readiness = share of the running words you know. ≥98 % Ready · 95–98 % Comfortable · 90–95 % Stretch · 80–90 % Challenging.
* Progress is stored in IndexedDB; the app requests persistent storage and offers JSON backup/restore (merge or replace).

## Sources and licences
* **Greek text:** Robinson–Pierpont Majority Text (CCAT Beta Code with Strong's and RP morphology codes) — the 2026 edition, released into the **public domain on 16 Aug 2026**, so the full text is published here (`sources/rp/`).
* **Section headings:** Kretzmann pericope list (`sources/pericopes/kretzmann.txt`), supplied by the project owner.
* **Glosses:** the project owner's lexicon, a derivative of the **Dodson Greek–English Lexicon** (public domain / CC0, via biblicalhumanities/Dodson-Greek-Lexicon). Long definitions come from Dodson.
* **Font:** Gentium Porsonic © SIL Global, **SIL Open Font License 1.1** (`fonts/OFL.txt`). The woff2 files are a modified subset, so the OFL's reserved names "Gentium"/"SIL" are not used: the web family is called **Lexiko Serif**; copyright and licence text remain inside the font files.
* **Scheduling:** FSRS (open algorithm, default parameters).
* App code: licence to be chosen by the owner.
