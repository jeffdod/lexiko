// Hints for easily confused verb forms (js/verbhints.js) in the "Where did this go wrong?" fold: each pair gets its own plain rule,
// shown only when the answer and the quiz word really are that pair; the rest keep the older rules.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  // cases: quiz tag, the slot answered wrongly, the wrong answer, and the start of the rule text that must appear
  const CASES = [
    ['2nd aorist active vs imperfect', 'V-2AAI-3S', 'tense', 'I', /^A 2nd aorist uses a different stem from the present\. The imperfect keeps the present stem\./],
    ['imperfect vs 2nd aorist (answer side)', 'V-IAI-3S', 'tense', 'A', /^A 2nd aorist uses a different stem from the present\. The imperfect/],
    ['2nd aorist participle vs present', 'V-2AAP-NSM', 'tense', 'P', /^Outside the indicative there is no augment, and a 2nd aorist takes the same endings as the present\./],
    ['2nd aorist infinitive vs present', 'V-2AAN', 'tense', 'P', /^Outside the indicative there is no augment, and a 2nd aorist/],
    ['2nd aorist imperative vs present', 'V-2AAM-2S', 'tense', 'P', /^Outside the indicative there is no augment, and a 2nd aorist/],
    ['2nd aorist subjunctive vs present', 'V-2AAS-3S', 'tense', 'P', /^Outside the indicative there is no augment, and a 2nd aorist/],
    ['1st aorist participle vs present', 'V-AAP-NSM', 'tense', 'P', /^A 1st aorist has the tense marker -σ- /],
    ['1st aorist imperative vs present', 'V-AAM-2S', 'tense', 'P', /^A 1st aorist has the tense marker -σ- /],
    ['aorist participle vs perfect', 'V-AAP-NSM', 'tense', 'R', /^The perfect keeps its reduplication in every mood\./],
    ['perfect participle vs aorist', 'V-RAP-NSM', 'tense', 'A', /^The perfect keeps its reduplication in every mood\./],
    ['present participle vs perfect', 'V-PAP-NSM', 'tense', 'R', /^Look at the front of the word: the perfect has reduplication/],
    ['perfect infinitive vs present', 'V-RAN', 'tense', 'P', /^Look at the front of the word: the perfect has reduplication/],
    ['aorist middle subjunctive vs passive', 'V-AMS-3S', 'voice', 'P', /^The aorist passive has -θη- \(-η- in the 2nd aorist\) and takes active-looking endings\./],
    ['aorist passive subjunctive vs middle', 'V-APS-3S', 'voice', 'M', /^The aorist passive has -θη-/],
    ['aorist passive participle vs active', 'V-APP-NSM', 'voice', 'A', /The aorist passive is the exception: it ends in -θεις, -θεισα, -θεν but is passive\.$/],
    ['present middle/passive participle vs active', 'V-PMP-NSM', 'voice', 'A', /^A middle or passive participle ends in -μενος, -μενη, -μενον\. An active participle does not\.$/],
    ['aorist passive infinitive vs active', 'V-APN', 'voice', 'A', /^A middle or passive infinitive ends in -σθαι\./],
    ['present passive vs middle, spelled alike', 'V-PPI-3S', 'voice', 'M', /^These two forms look exactly the same\. Only the context decides\. Choose “Middle or passive” when you cannot tell\.$/],
    ['infinitive answered as indicative', 'V-AAN', 'mood', 'I', /^An infinitive has no person, number, case or gender\. Look at the ending: -ειν, -σαι, -ναι or -σθαι/],
    ['indicative answered as infinitive', 'V-AAI-3S', 'mood', 'N', /^An infinitive has no person, number, case or gender\./],
    ['subjunctive, active answered as middle', 'V-PAS-3S', 'voice', 'M', /^Look at the ending\. Middle and passive subjunctives end in -μαι, -ται, -νται/],
    ['imperative, active answered as middle', 'V-PAM-2S', 'voice', 'M', /^Look at the ending\. Middle and passive imperatives have -σθ-/],
    ['present vs imperfect: the front', 'V-PAI-3S', 'tense', 'I', /^Look at the front of the word\. This word has nothing in front of the stem; an imperfect active has an augment in front/],
    ['present vs perfect: the front', 'V-PAI-3S', 'tense', 'R', /^Look at the front of the word\. This word has nothing in front of the stem; an? (1st )?perfect active has reduplication in front/],
    ['imperfect vs 1st aorist: the marker', 'V-IAI-3S', 'tense', 'A', /^Look at what follows the stem\. This word has no tense marker; a 1st aorist active has the tense marker -σα-\./],
    ['aorist passive vs middle: the marker', 'V-API-3S', 'voice', 'M', /^Look at what follows the stem\. This word has the tense marker -θη-; /],
    ['present active vs middle/passive: the ending', 'V-PAI-3S', 'voice', 'M', /^Look at the ending\. This word ends in -ω, -εις, -ει, -ομεν, -ετε, -ουσι; a present middle\/passive ends in -μαι, -σαι, -ται/],
    ['subjunctive vs indicative', 'V-AAS-3S', 'mood', 'I', /^The subjunctive has long vowels in its endings/],
    ['indicative vs subjunctive', 'V-AAI-3S', 'mood', 'S', /^The subjunctive has long vowels in its endings/],
    ['imperative vs indicative', 'V-AAM-2S', 'mood', 'I', /^Imperatives are the only forms with endings like -τω, -τωσαν, -σθω\./],
    ['participle vs indicative', 'V-AAP-NSM', 'mood', 'I', /^A participle is the only verb form that declines\./],
    ['1st singular present, subjunctive vs indicative', 'V-PAS-1S', 'mood', 'I', /^These two forms look exactly the same\. Only the context decides\.$/],
    ['2nd plural present, indicative vs imperative', 'V-PAM-2P', 'mood', 'I', /^These two forms look exactly the same\. Only the context decides\.$/],
  ];
  const out = await p.evaluate(async (cases) => {
    const M = await import('/lexiko/js/parse-model.js'), { D } = await import('/lexiko/js/data.js'), W = await import('/lexiko/js/whywrong.js');
    const res = [];
    for (const [name, tag, slot, val] of cases) {
      const rules = []; let n = 0, shown = 0;
      for (let i = 0; i < D.forms.length && n < 400; i++) {
        if (D.forms[i].an[0].m !== tag) continue;
        const it = M.buildItem(M.mergeForms(D.forms, [i])); if (!it) continue;
        const best = M.check(it, {}).best; if (!best) continue; n++;
        const ans = { ...best.slots }; ans[slot] = val;
        const r = M.check(it, ans); const el = W.whyWrong(it, r); if (!el) continue; shown++;
        const rule = el.querySelector('.whyrule'); rules.push({ rule: rule ? rule.textContent : null, quiz: D.forms[i].plain, text: el.textContent });
      }
      res.push({ name, tag, tried: n, shown, rules });
    }
    return res;
  }, CASES.map((c) => c.slice(0, 4)));
  out.forEach((r, i) => {
    const re = CASES[i][4];
    ok(r.shown > 0, r.name + ': a missed form of this kind gives a fold (tried ' + r.tried + ', folds ' + r.shown + ')');
    const hit = r.rules.filter((x) => x.rule && re.test(x.rule));
    ok(hit.length > 0, r.name + ': some fold carries the hint (' + hit.length + '/' + r.shown + ')' + (hit.length ? '' : ' first rules: ' + JSON.stringify(r.rules.slice(0, 2).map((x) => x.rule))));
  });
  // a spelled-alike pair shows the word as the learner's reading, not "no form like that"
  const sa = out.find((r) => /spelled alike/.test(r.name)); const alike = sa ? sa.rules.filter((x) => /exactly the same/.test(x.rule || '')) : [];
  ok(alike.length > 0 && alike.every((x) => !/no form like that/.test(x.text)), 'spelled-alike pair shows the word under "You answered"');
  // liquid and -μι verbs have no σ in the 1st aorist: that hint never appears for them
  const wrongAor1 = await p.evaluate(async () => {
    const M = await import('/lexiko/js/parse-model.js'), { D } = await import('/lexiko/js/data.js'), W = await import('/lexiko/js/whywrong.js'), F = await import('/lexiko/js/families.js');
    let bad = 0, liq = 0;
    for (let i = 0; i < D.forms.length; i++) {
      if (!/^V-A[AMP][PMNS]/.test(D.forms[i].an[0].m) || !F.isLiquidVerb(D.forms[i].an[0].s)) continue;
      const it = M.buildItem(M.mergeForms(D.forms, [i])); if (!it) continue;
      const best = M.check(it, {}).best; if (!best || !'SMNP'.includes(best.slots.mood) || best.slots.second) continue;
      liq++; const r = M.check(it, { ...best.slots, tense: 'P' }); const el = W.whyWrong(it, r);
      if (el && /tense marker -σ-/.test(el.textContent)) bad++;
    }
    return { bad, liq };
  });
  ok(wrongAor1.liq > 3 && wrongAor1.bad === 0, 'no -σ- hint for liquid verbs (' + wrongAor1.liq + ' checked, ' + wrongAor1.bad + ' wrong)');
  // older rules are unchanged: an indicative aorist passive missed as imperfect still gets the chart-row rule; person errors still say "compare how the two words end"
  const old = await p.evaluate(async () => {
    const M = await import('/lexiko/js/parse-model.js'), { D } = await import('/lexiko/js/data.js'), W = await import('/lexiko/js/whywrong.js');
    const i = D.forms.findIndex((f) => f.an[0].m === 'V-API-3S'); const it = M.buildItem(M.mergeForms(D.forms, [i])); const best = M.check(it, {}).best;
    const a = W.whyWrong(it, M.check(it, { ...best.slots, tense: 'I' })), b = W.whyWrong(it, M.check(it, { ...best.slots, person: '1' }));
    return { a: a ? a.textContent : '', b: b ? b.textContent : '' };
  });
  ok(/This word has the tense marker -θη-; an imperfect [a-z\/]+ has no tense marker/.test(old.a), 'an indicative pair names the one clue: ' + old.a.slice(-160));
  ok(/compare how the two words end/.test(old.b), 'person errors still get the ending rule');
  const clues = await p.evaluate(async () => {
    const M = await import('/lexiko/js/parse-model.js'), { D } = await import('/lexiko/js/data.js'), W = await import('/lexiko/js/whywrong.js');
    const bare = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let multi = 0, contractEnd = 0, alikeFront = 0, n = 0, c = 0, a = 0;
    for (let i = 0; i < D.forms.length; i++) {
      const m = D.forms[i].an[0].m; if (!/^V-[PIA][AMP]I-3S$/.test(m)) continue;
      const it = M.buildItem(M.mergeForms(D.forms, [i])); if (!it) continue;
      const best = M.check(it, {}).best; if (!best) continue;
      for (const [slot, val] of [['tense', 'P'], ['tense', 'I'], ['tense', 'A'], ['tense', 'R'], ['voice', 'M'], ['voice', 'A']]) {
        if (best.slots[slot] === val) continue;
        const el = W.whyWrong(it, M.check(it, { ...best.slots, [slot]: val })); if (!el) continue; n++;
        const r = el.querySelector('.whyrule'); if (!r) continue;
        if ((r.textContent.match(/Look at /g) || []).length > 1) multi++;
        const L = D.lexByN.get(it.strongs);
        if (/^Look at the ending/.test(r.textContent) && L && /[αεο]ω$/.test(bare(L.head)) && /pres|impf|present|imperfect/i.test(r.textContent)) contractEnd++;
      }
    }
    return { multi, contractEnd, n };
  });
  ok(clues.n > 300 && clues.multi === 0, 'every indicative rule names one clue only (' + clues.n + ' misses checked, ' + clues.multi + ' with two clues)');
  ok(clues.contractEnd === 0, 'contract verbs never get the plain-ending list in the present or imperfect (' + clues.contractEnd + ')');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'verbhints: FAILED' : 'verbhints: ok');
})();
