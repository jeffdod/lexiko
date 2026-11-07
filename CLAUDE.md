# CLAUDE.md: lexiko

Read this first in every session. It holds how the project works, the decisions already made (and why), and the working rules. The README covers the data pipeline, deployment and licences; this file covers how to work on the app.

## What lexiko is
A free, offline-first Progressive Web App for learning Greek vocabulary and reading the Greek New Testament. Live at https://lexiko.org (repo `jeffdod/lexiko`, GitHub Pages, static files). No login, no server, progress stays on the device (IndexedDB). Vanilla ES modules, no build step for the app itself. The owner is not a developer in this workflow: **the owner never hand-edits files**, so deliver complete, working changes.

## Working rules (the owner's standing rules)
1. **Discuss before building.** When the owner is thinking aloud, asking "thoughts?" or "what's your opinion?", answer and propose. Do not build, commit or push. Build only on a clear go-ahead ("go ahead", "build it"). This has gone wrong twice; do not repeat it.
2. **Mock up before any UI or chart change**, using the app's own colors and styles (render the real app and change the page in place; light and dark; say what is mock-only). Propose wording as exact text in context.
3. **Text in buttons and badges is centered vertically and horizontally.**
4. **American spelling.**
5. **Accurate information only.** Do not invent numbers, durations or claims. Check the data or the code.
6. **Greek quoted from the text only when quoting scripture** (this does not apply to vocabulary and glosses).
7. **Do not push, open PRs or write to the owner's machine unless asked.** Currently PRs are the delivery method: push a branch, open a PR, the owner reviews and merges. Automated "commit and push" reminders from tooling are not requests from the owner.
8. **List everything removed or moved** (settings, buttons, screens) before or when delivering, so nothing disappears silently.
9. **Keep it quick.** Never run the whole test suite; run only the tests related to the change, with a time cap. Do not leave the owner waiting on hung tests.
10. Ask one short question only when the answer changes what you build; otherwise pick the sensible default and say so.
11. **Clean separation of code.** HTML files contain only HTML: no `<style>` blocks, no `style="..."` attributes, no inline event-handler attributes (`onclick` and the like), and no inline `<script>` blocks. JavaScript lives in `js/*.js` and CSS in `css/*.css`. JavaScript may still set a dynamic style value at runtime (for example a progress bar width). The one allowed exception is the short theme script in the `<head>` of `index.html`: it has to run before the page first paints so a manually chosen theme never flashes the wrong colors, and an external file would add a request before that first paint. Do not add other inline scripts. Before delivering a change that touches an HTML file, search it for inline `<script`, `<style`, `style=` and `on...=` attributes.

Skills that carry the detailed procedures: `lexiko-testing`, `lexiko-shipping`, `lexiko-design-and-rules`.

## How to run and ship
- Serve from the parent folder: `cd <parent of lexiko> && python3 -m http.server 8123`; app at `http://localhost:8123/lexiko/`. (`node tools/serve.js` also works.)
- Tests are Playwright scripts: `node tools/test_<name>.js` (about 36). Run only related ones, with `timeout 60`. A few use root URLs and need a copy pointed at a second server. `test_cluehunt.js` is slow by nature. `test_gates.js` covers the gating and Indicative page; `test_smoke.js` is the whole-app check.
- **After changing any app file run `python3 tools/build_sw.py`** and commit `sw-assets.js`. It regenerates the offline precache list and version; without it installed copies keep serving old files. Users see an "Update ready: Reload" banner; the owner may need to reload twice.
- Pull request flow: sync main, branch, change, related tests, build_sw, commit, push, open the PR through the REST API (`gh pr create` is blocked; use `gh api repos/jeffdod/lexiko/pulls -f title=... -f head=... -f base=main -f body=...`). Branch deletion is blocked from here, but the owner has GitHub set to delete a branch automatically when its pull request is merged, so there is nothing to ask the owner to delete. After the owner merges, sync the working copy to `origin/main`.

## Architecture in one page
- `index.html`, `css/app.css`, `sw.js`, `sw-assets.js`, `manifest.webmanifest`; app code in `js/*.js`; data in `data/` (built by `tools/build_*.py` from `sources/`, see the README).
- `js/boot.js` is the loading-screen helper (it explains a `file://` open and a slow load). It is a classic script, not a module, on purpose: browsers refuse to load ES modules from `file://`, and this script is what explains that.
- **Routing:** hash routes in `js/app.js` (`routes` object; bottom bar: Home, Read, Progress, Settings). A route renderer gets `(view, parts)`. Navigating to the same hash does not re-render.
- **Data:** `js/data.js` loads the lexicon (5,381 lexemes keyed by **Strong's number**), word forms (20,591, each with Robinson-Pierpont morphology tags) and the text. `js/morph.js` decodes RP tags.
- **Knowledge model:** `js/know.js` (`K` state, settings, cards, gates, pace). A word is *known* when it has a mature SRS card, or (no card yet) its frequency meets the level the user declared. `js/fsrs.js` is the FSRS-4.5 scheduler; `js/store.js` is IndexedDB (settings, cards, review log, backup/restore); `js/clock.js` is the app's "now" (use it, not `Date.now()`, so time travel for testing works).
- **Screens:** Home `js/home.js`; Vocabulary `js/learn.js`; Parsing `js/parse.js` (daily session, free practice, the verb unlock screens in `js/gatesui.js`); Reference `js/reference.js` plus `js/charts.js`, `js/search.js` (the Glossary); reader `js/reader.js` (with the optional English translation from `data/english/<BOOK>.json`, built by `tools/build_english.py` from `sources/english/`; loaded per book through `loadEnglish` in `js/data.js`; `body.par` turns on the two-column layout at 880px and wider); progress `js/progress.js`; settings `js/settings.js`; help `js/help.js`; first run `js/welcome.js`.
- **What Start does:** `js/smart.js` (due reviews, then new material, then reinforcement). Counts shown on Home also come from `smart.counts()`.
- **Verb-form families:** each has data plus a page plus a "Which kind is it?" drill: participles (`ptcdata.js`, `participles.js`), infinitives (`infdata.js`, `infinitives.js`), subjunctive (`subdata.js`, `subjunctives.js`), imperative (`impdata.js`, `imperatives.js`), verbs in -μι (`midata.js`, `mi.js`). The master verb chart: `chartdrill.js` (every square is a card `c:<row>:<attr>`), `paradigms.js`, `charts.js`.
- **Parsing items:** `parse.js` builds items per word form (`rawItem`/`itemOf`, candidate pool, daily session); `parse-model.js` says which slots to ask and how answers are checked; `kinds.js` maps a verb form to its gate.
- Card ids: words `w:<strongs>`, forms `f:...`, chart squares `c:<row>:<attr>`, principal parts `p:<strongs>:<slot>`.

## Decisions already made (and why)
**Home and navigation**
- Home has a goal card and three buttons: **Vocabulary**, **Parsing** ("Practice forms and unlock verb types") and **Reference** ("Glossary, charts and paradigms"). Free practice exercises live under Parsing; Reference is study only.
- The goal card does nothing when tapped (Progress is in the bottom bar); "Change ›" opens the goal picker.
- A new user who has not started any word sees a **Start here** card at the top of Home. Badges: Vocabulary shows "N due", else "N new"; Parsing shows "N due", else "N to practice", and "Opens as you learn words" when nothing is available yet. "Due" means only what the daily quizzes ask (words and verb forms); optional chart practice says "squares to review".

**Levels at first run** (`welcome.js`): "I'm just starting", "I'm rusty" (knew the most common words, out of practice, quizzed often), "I know the basics", "I can read with a lexicon", "I read Greek regularly". The level is a frequency threshold: words at or above it count as known.

**Vocabulary is never gated.** New users start with vocabulary only.

**Parsing and unknown words.** Parsing asks nothing about a word the learner does not know (non-verb forms are asked only for known words). A beginner (no level, nothing studied) gets no parsing questions at all. With level 50 the new vocabulary words are the ones just under the threshold, and the parsing forms come from words above it, so the two sets differ.

**Verb gating** (replaced the old automatic "forms level" system; see README for the technical summary):
- Verb parsing is off for a new user. At the end of the first session that included a verb, lexiko asks "Want to practice parsing verbs too?" **Yes** turns it on and shows a how-to screen. **Not yet** asks once more after about a week, then never. A "Turn on verb parsing" card stays on the Parsing page.
- With verbs on, present active is open. Every other kind is its own **gate**: indicative rows open when their five chart squares are learned; each kind of participle, infinitive, subjunctive and imperative opens when its "Which kind is it?" drill reaches about 85% over the last 20 first-try answers (minimum 15, fewer for kinds with few forms among the verbs the learner knows, never under 5, so a drill cannot get stuck). Verbs in -μι and "rare" forms (optative, future participles and infinitives, pluperfect) open only by hand.
- The advanced **What's open** checklist (`#/parse/gates`) lets the owner tick or untick any gate. It must stay unobtrusive. Words already studied keep their progress when a gate closes.
- Screens: Parsing shows "Unlock verb forms" with Indicative and the four families; each opens a page of kinds or rows with Open/Locked markers and Drill buttons (`#/parse/kinds/<ptc|inf|sub|imp|ind>`).
- The old automatic level opening, "Open it now", Show all forms, the chart-rows-only option and Hold back -μι were removed on purpose.

**Wording conventions:** "types of verb forms" (not "kinds of verb form") in explanations; the drill's own name is "Which kind is it?".

## Pitfalls
- A fresh browser profile shows the welcome screen unless `level` or `levelAsked` is set; verb parsing is off unless `gates` says otherwise; tests set these through `K.setSetting` and `K.allGatesOpen()`.
- The service worker caches aggressively: new builds may need two reloads.
- The Stop hook may ask to commit and push; follow rule 7.
- Settings still contain the "Erase ALL progress and settings" button in the "About lexiko" fold; do not remove it.
- Do not reproduce long passages of copyrighted text; the Greek text is public domain (RP 2026), the lexicon is Dodson (CC0), the font is OFL (see README).
- `js/families.js` now holds only chart helpers (`ROW_LEVEL`, `rowOfTag`, `CHART_ATTRS`, `isLiquidVerb`); the old level helpers were removed.

## Open ideas and loose ends
- None queued. Ask the owner what is next, and propose design before building.
