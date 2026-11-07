// The gating: verbs off by default, per-kind gates opened by drills (with the small-pool rule) or by hand, the clean start, the verb question, the -μι gate.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/parse'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'), Kd = await import('/lexiko/js/kinds.js'), Dm = (await import('/lexiko/js/data.js')).D, St = (await import('/lexiko/js/store.js')).store, Mo = await import('/lexiko/js/morph.js');
    const o = {};
    await K.setSetting('gates', {}); K.K.gateAcc = {};
    o.off = [K.verbsOn(), K.gateOpen('row:pres-act'), K.gateOpen('ptc:pres-act')];
    // a participle tag for the formOpen check
    let tag = null, n = null; for (const f of Dm.forms) { for (const a of f.an) { const d = Mo.decode(a.m); if (d && d.slots && d.slots.mood === 'P' && Kd.ptcKey(d.slots) === 'pres-act') { tag = a.m; n = a.s; break; } } if (tag) break; }
    o.tag = [tag, n, Kd.gateKeyOfTag(tag, n)];
    o.formOff = K.formOpen([tag], n);
    await K.setGate('verbs', true);
    o.on = [K.verbsOn(), K.gateOpen('row:pres-act'), K.gateOpen('row:aor1-act'), K.gateOpen('ptc:pres-act'), K.gateOpen('mi')];
    o.formOn = K.formOpen([tag], n);
    // small pool: 5 right answers open it
    let opened = false; for (let i = 0; i < 4; i++) opened = opened || await K.noteDrill('ptc:pres-act', true, 3);
    o.small4 = [opened, K.gateOpen('ptc:pres-act')];
    opened = await K.noteDrill('ptc:pres-act', true, 3); o.small5 = [opened, K.gateOpen('ptc:pres-act'), K.formOpen([tag], n)];
    // big pool: needs 15, and 85%
    let big = false; for (let i = 0; i < 14; i++) big = big || await K.noteDrill('inf:pres-act', true, 100);
    o.big14 = [big, K.gateOpen('inf:pres-act')];
    big = await K.noteDrill('inf:pres-act', true, 100); o.big15 = [big, K.gateOpen('inf:pres-act')];
    for (let i = 0; i < 15; i++) await K.noteDrill('sub:pres-act', i % 5 !== 0 ? true : false, 100);       // 12 of 15 = 80%
    o.weak = K.gateOpen('sub:pres-act');
    // by hand
    await K.setGate('imp:pres-act', true); o.hand = K.gateOpen('imp:pres-act');
    await K.setGate('ptc:pres-act', false); o.untick = [K.gateOpen('ptc:pres-act'), K.formOpen([tag], n)];
    // -μι
    const mi = [...Dm.lexByN.entries()].find(([, L]) => L.head === 'δίδωμι')[0];
    o.mi = [K.miHeld(mi)]; await K.setGate('mi', true); o.mi.push(K.miHeld(mi));
    // the question: once, once more after a week, then never
    await K.setGate('verbs', false); await K.setSetting('verbAsk', { n: 0, t: 0 });
    const t0 = 1e12; o.ask = [K.verbAskDue(t0)]; await K.noteVerbAsk(t0); o.ask.push(K.verbAskDue(t0 + 864e5), K.verbAskDue(t0 + 8 * 864e5)); await K.noteVerbAsk(t0 + 8 * 864e5); o.ask.push(K.verbAskDue(t0 + 99 * 864e5));
    // verbs off: no verb form in a daily session
    await K.setSetting('gates', {}); await K.setSetting('level', 50); let verbForms = 0, all = 0;
    K.K.settings.sessionSize = 60; K.K.settings.parseNewPerDay = 60;
    for (let i = 0; i < 5; i++) for (const x of P.buildParseSession({})) { all++; const L = Dm.lexByN.get(Dm.forms[x.id].an[0].s); if (L && L.verb) verbForms++; }
    o.session = [verbForms, all];
    // the clean start
    await K.setSetting('gates', { verbs: true, 'ptc:aor1-act': true }); await St.set('gatesInit', false); await K.bootGates();
    o.clean = [Object.keys(K.K.settings.gates).length, await St.get('gatesInit')];
    o.keys = Kd.allGateKeys().length;
    return o;
  });
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  ok(r.off.every((x) => x === false), 'everything is off at the start: ' + r.off);
  ok(r.tag[2] === 'ptc:pres-act', 'gate key of a participle tag: ' + r.tag);
  ok(!r.formOff, 'a participle is not asked while verbs are off');
  ok(r.on[0] && r.on[1] && !r.on[2] && !r.on[3] && !r.on[4], 'verbs on: present active open, nothing else: ' + r.on);
  ok(!r.formOn, 'a participle is still closed after verbs are turned on');
  ok(!r.small4[0] && !r.small4[1], 'a small pool: four answers do not open it: ' + r.small4);
  ok(r.small5[0] && r.small5[1] && r.small5[2], 'a small pool of 3: five right answers open it: ' + r.small5);
  ok(!r.big14[0] && !r.big14[1], 'a large pool: 14 answers do not open it: ' + r.big14);
  ok(r.big15[0] && r.big15[1], 'a large pool: 15 right answers open it: ' + r.big15);
  ok(!r.weak, '12 of 15 (80%) does not open it');
  ok(r.hand, 'ticking opens a gate');
  ok(!r.untick[0] && !r.untick[1], 'unticking closes it: ' + r.untick);
  ok(r.mi[0] === true && r.mi[1] === false, '-μι verbs are held until ticked: ' + r.mi);
  ok(r.ask[0] === true && r.ask[1] === false && r.ask[2] === true && r.ask[3] === false, 'the question: once, again after a week, then never: ' + r.ask);
  ok(r.session[1] > 0 && r.session[0] === 0, 'no verb form in a session while verbs are off: ' + r.session);
  ok(r.clean[0] === 0 && r.clean[1] === true, 'the clean start resets the gates: ' + r.clean);
  ok(r.keys === 56, 'gate keys: ' + r.keys);
  // the Indicative page: every chart row, grouped, each with its own drill
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setSetting('gates', { verbs: true }); });
  await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForTimeout(500); await p.goto('http://localhost:8123/lexiko/#/parse'); await p.waitForTimeout(1200);
  const link = await p.locator('a.li:has-text("Indicative")').getAttribute('href');
  await p.goto('http://localhost:8123/lexiko/' + link); await p.waitForTimeout(800);
  const ind = await p.evaluate(() => ({ h: location.hash, rows: document.querySelectorAll('#view .list .li').length, drills: [...document.querySelectorAll('#view .list a.btn')].map((a) => a.getAttribute('href')), open: [...document.querySelectorAll('#view .chip.good')].length, text: document.getElementById('view').innerText }));
  ok(link === '#/parse/kinds/ind' && ind.rows === 20 && ind.drills.length === 20 && ind.drills.every((d) => /^#\/learn\/charts\/run\/[a-z0-9-]+$/.test(d)), 'the Indicative page lists the 20 chart rows, each with a drill: ' + JSON.stringify({ link, rows: ind.rows }));
  ok(!/\bdue\b/.test(ind.text), 'chart squares are not called "due" on the Indicative page: ' + ind.text.slice(0, 160).replace(/\n/g, ' | '));
  ok(ind.open === 1 && /Present active/.test(ind.text) && /0 of 5 squares learned/.test(ind.text), 'only present active is open at first, and progress reads "0 of 5 squares learned"');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
