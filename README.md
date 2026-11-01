# lexiko

Build your Greek vocabulary. Read the Greek New Testament better. A free, offline-first Progressive Web App: no login, no server, hosted as static files on GitHub Pages.

**Status: phases 1–2.** Reader, vocabulary SRS (FSRS), levels, passage readiness, goals, backup/restore, PWA shell.
**Planned:** more reference charts (participles, non-indicative moods).

## Use it
Open `https://lexiko.org/` and "Add to Home Screen" / "Install app". It then runs full-screen and fully offline.

## Deploy (GitHub Pages)
1. Push this folder's contents to the repo root (`main`).
2. Repo → Settings → Pages → *Deploy from a branch* → `main` / `(root)`. (Free Pages requires a public repo.)
3. `.nojekyll` is included. All paths are relative, so it works under `/lexiko/` or a custom domain.

## Rebuild after changes (needs Python 3 + fontTools, Node)
```
python3 tools/build_data.py sources/rp sources/lexicon/Dodson-Ulrik.txt sources/lexicon/user-lexicon.txt data   # RP + lexicon -> data/*.json
python3 tools/build_pericopes.py sources/pericopes/kretzmann.txt data                                  # section headings -> data/pericopes.json
python3 tools/make_fonts.py <GentiumPorsonic dir> fonts                                               # subset + rename + woff2
python3 tools/make_icons.py && node tools/render_icons.js                                              # icons, favicon, social card
python3 tools/build_sw.py        # ALWAYS run after changing any app file: regenerates the offline precache list/version
node tools/serve.js &            # local test server at http://localhost:8123/lexiko/ (or double-click preview.command / preview.bat)
node tools/test_smoke.js         # end-to-end test in headless Chromium (needs playwright)
```

### Prepositions that take several cases
`sources/lexicon/Dodson-Ulrik.txt` is the single source of both the short (brief) and long definitions. Tag the parts of a preposition's definition in either column with `gen:`, `dat:` or `acc:` (for example `(a) gen: through, (b) acc: on account of`). When the short gloss has two or more different cases, the preposition is learned as one word per case ("διά + genitive", "διά + accusative"), each with its own review schedule, short gloss and long definition. The reader popup shows the sense for the case the preposition governs in that verse (it looks at the next case-bearing word, and shows every sense when that is unclear). A preposition with only one case, or none, stays a single word: the question screen shows just the word (no "+ case"), and its definition is shown exactly as written in your file, tag included. Quizzes test the short gloss; the long definition appears after answering only when it adds something, and sits behind "More" when it is long. Rebuild the data (command above), then `python3 tools/build_sw.py`.

Users get new versions automatically: the service worker notices a changed `sw-assets.js`, downloads the update, and shows an "Update ready — Reload" banner.

## How it works
* `data/` – `lexicon.json` (5,381 lexemes: Strong's no., headword, gloss, frequency), `forms.json` (20,591 distinct word forms with soft hyphens and RP parsing; alternate parsings kept), `text/XXX.json` (one token stream per book, ints = form id × 16 + punctuation (0–4) + 8 if an em-dash follows the word; in the Beta source a trailing `-` or `_` marks that dash, and the following space is dropped). `pericopes.json` holds 589 section headings; each runs to the verse before the next heading.
* Words are keyed by **Strong's number**; frequencies are counted from the RP text itself.
* A word is *known* if you have a mature SRS card for it, or (no card yet) its frequency ≥ your declared level. Missing a "known" word in a check-in demotes it to learning.
* Passage readiness = share of the running words you know. ≥98 % Ready · 95–98 % Comfortable · 90–95 % Stretch · 80–90 % Challenging.
* Progress is stored in IndexedDB; the app requests persistent storage and offers JSON backup/restore (merge or replace).

## Principal parts
`#/parts` drills the six principal parts of ~1,300 verbs (`data/parts.json`, built by `python3 tools/build_parts.py <spreadsheet.xlsx>`; each part printed for a verb is one FSRS card `p:<strongs>:<slot>`). Several spreadsheet rows can share one Strong's number, so a row is chosen by matching the lexicon headword (else by how often its forms occur). Two question types: *recognise* (see a part → pick the verb → pick which part) and *recall* (verb + part name → pick the form from plausible look-alikes, or remember it and rate yourself). *Auto* starts with multiple choice and moves to self-graded flashcards at ≥85 % over 20 answers (back below 60 % over 12). Pools: verbs you're learning, or the verbs of a passage. `js/parts.js`; tests: `node tools/test_parts.js`.

## Learn pages
`#/learn` has one **Start** button and three topics (Vocabulary `#/learn/words`, Parsing `#/parse`, Principal parts `#/parts`). `js/smart.js` decides what Start does: reviews that are due, then new material, then **Reinforce** (your shakiest cards), then a preview — so it never says there is nothing to do. Each topic page has the same single button, a *Preview new* link, and collapsed *Study a passage* and *Options* sections.

## Strengthen weak spots, look ahead and charts
Vocabulary, parsing and principal parts each have *Strengthen weak spots* (your shakiest cards) and *Look ahead* (a few cards you haven't started). Neither ever writes a card, counter or statistic, so the spaced schedule is untouched. Quiz screens have a **Charts** button (`js/charts.js`): the master verb chart and primary/secondary endings, as tables; after an answer the row that builds the part is highlighted.

## Parsing practice
`#/parse` quizzes the parts of a form in a fixed order (verbs: tense → voice → mood → person → number; infinitives stop after mood; participles continue with case → number → gender; other words: case → number → gender). Every parsing listed for the form under the same lexeme is accepted, each part is scored separately, and every form has its own FSRS card (`f:<form>:<strongs>`). *Guided* asks one part at a time with instant feedback and a hint; *Quick* shows all parts at once; *Auto* starts guided and switches (per verbs / other words) once you're ≥85 % reliable over 20 forms, and back below 60 %. Code: `js/parse-model.js` (slots, matching, grading), `js/parse.js` (UI). `node tools/test_stem.mjs [form…]` checks them against the whole text.

## Sources and licences
* **Greek text:** Robinson–Pierpont Byzantine Textform (CCAT Beta Code with Strong's and RP morphology codes) — the 2026 edition, released into the **public domain on 16 Aug 2026**, so the full text is published here (`sources/rp/`).
* **Section headings:** Kretzmann pericope list (`sources/pericopes/kretzmann.txt`), supplied by the project owner.
* **Glosses:** the project owner's lexicon, a derivative of the **Dodson Greek–English Lexicon** (public domain / CC0, via biblicalhumanities/Dodson-Greek-Lexicon). Long definitions come from Dodson.
* **Font:** Gentium Porsonic © SIL Global, **SIL Open Font License 1.1** (`fonts/OFL.txt`). The woff2 files are a modified subset, so the OFL's reserved names "Gentium"/"SIL" are not used: the web family is called **Lexiko Serif**; copyright and licence text remain inside the font files.
* **Scheduling:** FSRS (open algorithm, default parameters).
* App code: licence to be chosen by the owner.

## First run and search
A brand-new user (no level chosen, nothing studied) sees two plain questions first (`js/welcome.js`): how much Greek they know (which sets the level) and what they want to do first. **Search** (`#/search`, `js/search.js`, the magnifier on Home) finds a word by Greek form with or without accents, by English meaning, or by Strong's number, and shows its meaning, where it occurs and its forms; all Greek shown comes from the text and lexicon data.

## Home, shortcuts, word groups, learning curve, locked backups
* **Home** leads with one main button (what to do now), then your reading goal (or where you left off), a small learning-curve chart, and a folded "Good next reads".
* **Keyboard** (computers): in vocabulary sessions Space shows the answer, 1–4 rate it (or choose an option), Space continues; parsing and principal-parts quizzes already take Enter and 1–4.
* **Study by how common** (Learn › Vocabulary): `#/learn/set/<min>/<max>` teaches the words you don't know yet that occur between min and max times.
* **Learning curve** (`js/growth.js`, Home and Progress): cumulative words started, rebuilt from the per-day counts lexiko already keeps (so it has history from day one).
* **Locked backups**: in Settings an optional passphrase encrypts the backup file (AES-GCM, key from PBKDF2-SHA256, 250,000 rounds; `js/store.js`). The passphrase is never stored; restoring asks for it. Needs a secure context (https or localhost).

## Settings, help, noun endings and accessibility
* **Settings** keeps the everyday choices up front (look, level, quiz style, new words per day, backup). Spot-check rate and memory target sit under *Advanced*; the passphrase, where backups go and storage status are folded under *Your data*.
* **How lexiko works** (`#/help`, `js/help.js`) is a short, plain-language page linked from Home and Settings.
* **Noun endings** (Charts › Noun endings) are the two charts from the user's grammar (Master Case Ending Chart): the bare endings, and the endings with the stem vowel, each for the first/second and the third declension (`js/charts.js`). They are fixed data, not computed. A parsing answer for a noun or adjective has a **Noun chart** button that opens this tab with the matching case and number row shaded. **Contractions** (fourth tab) is the contraction chart from the same grammar: single vowels, and vowels with diphthongs.
* **Preposition cases:** a preposition that governs a name or number with no case ending (for example a proper name) looks at the word after it; about 25 occurrences (idioms and the like) remain "unsure" and the reader then shows every sense.
* **Accessibility checks:** `node tools/test_a11y.js` checks, in light and dark at phone size, that every control has a name, tap targets are at least 40px and text contrast is at least 4.5:1 (3:1 for large text).
* The Dodson-Ulrik file supplies every gloss; `sources/lexicon/user-lexicon.txt` still supplies the headwords.
* **Progress** opens with one calm sentence: how much of the goal passage is known (or, with no goal, how many words you know and how much of the New Testament text they cover, and how far to the next round number).
* **Undo**: a vocabulary session shows “Undo last answer” (or the U key) after each answer; it restores the card, the review log and today's counts (`undoRate` in `js/know.js`). One step only; parsing and principal-parts answers are graded automatically, so they have no undo.
* **Updates**: the app re-checks for a new version whenever it returns to the front and once an hour, and offers “Update ready”.
