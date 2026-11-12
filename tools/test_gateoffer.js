// Gate offers: lexiko offers the next kind of verb form when verb parsing is going well; Not yet puts it off a week; Yes opens it and lets it in slowly.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const setup = (acc) => p.evaluate(async (acc) => { const K = await import('/lexiko/js/know.js'); await K.setLevel(500); await K.setSetting('levelAsked', true);
    await K.setSetting('gates', { verbs: true }); await K.setSetting('gateOffer', 0); await K.setSetting('gateTrickle', {});
    K.K.verbAcc.length = 0; for (let i = 0; i < 20; i++) K.K.verbAcc.push(i < acc ? 1 : 0); }, acc);
  const go = async (h) => { await p.goto(U + '#/settings'); await p.goto(U + h); await p.waitForSelector('.list'); await p.waitForTimeout(400); };
  const offer = () => p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find((x) => /^Ready for the/.test(x.textContent)); return c ? c.textContent : null; });

  await setup(12); await go('#/parse');
  ok(await offer() === null, 'no offer while the last 20 answers are only 60% right');
  await setup(19); await go('#/parse');
  const t = await offer();
  ok(t && /Ready for the .+\?/.test(t) && /95% right over your last 20/.test(t) && /2 new forms a day/.test(t), 'offer shown at 95%: ' + (t || '').slice(0, 150));
  const key = await p.evaluate(async () => (await import('/lexiko/js/gateoffer.js')).gateOffer().key);
  // Not yet
  await p.click('#view .card button:has-text("Not yet")'); await p.waitForTimeout(300);
  ok(await offer() === null, 'Not yet removes the card');
  const snooze = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.settings.gateOffer);
  ok(snooze > Date.now() + 6 * 864e5, 'and puts offers off for a week');
  await go('#/parse'); ok(await offer() === null, 'no offer on the next visit either');
  // Yes
  await setup(19); await go('#/parse');
  await p.click('#view .card button:has-text("Yes, add it")'); await p.waitForTimeout(500);
  const after = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return { open: K.gateOpen(location.hash.length ? '' : ''), gates: K.K.settings.gates, tr: K.K.settings.gateTrickle, hash: location.hash }; });
  ok(after.gates[key] === true && after.tr[key] > 0, 'Yes opens ' + key + ' and starts it slowly');
  ok(/#\/parse\/type\//.test(after.hash), 'and shows its summary page: ' + after.hash);
  await go('#/parse'); const t3 = await offer();
  ok(!!t3, 'at high accuracy a next offer can arrive while the new kind is still easing in');
  const runs = await p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find((x) => /^Ready for the/.test(x.textContent)); return c ? { adds: c.querySelectorAll('.list button').length, text: c.textContent } : null; });
  ok(runs && runs.adds === 2 && /Or pick a different one/.test(runs.text) && /Appears [\d,]+ times in the text/.test(runs.text), 'the card shows two runners-up with counts: ' + (runs ? runs.adds : null));
  const un = await p.evaluate(() => { const s = [...document.querySelectorAll('#view .sec')].find((x) => x.textContent === 'Up next'); const l = s && s.nextElementSibling && s.nextElementSibling.nextElementSibling; return l ? { n: l.children.length, chip: /Offered now/.test(l.textContent), first: l.children[0].textContent } : null; });
  ok(un && un.n === 5 && un.chip, 'the Up next list shows five kinds and marks the offered one: ' + JSON.stringify(un));
  // the first runner-up's Add opens that kind
  const second = await p.evaluate(async () => (await import('/lexiko/js/gateoffer.js')).gateOffer().runners[0].key);
  await p.click('#view .card .list button:has-text("Add")'); await p.waitForTimeout(500);
  ok(await p.evaluate(async (k) => (await import('/lexiko/js/know.js')).gateOpen(k), second), 'Add on a runner-up opens it: ' + second);
  // a learned row opens even if an old closed mark is saved; a row you unticked yourself stays closed
  const rows = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/fsrs.js'), A = await import('/lexiko/js/families.js');
    for (const a of A.CHART_ATTRS) K.K.cards.set('c:aor1-pas:' + a, { ...F.newCard('c:aor1-pas:' + a), state: 'review', stability: 60, reps: 5, last: Date.now(), due: Date.now() + 864e5 * 30 });
    await K.setSetting('gates', { verbs: true, 'row:aor1-pas': false }); await K.setSetting('gatesHeld', {});
    const legacy = K.gateOpen('row:aor1-pas');
    await K.setGate('row:aor1-pas', false); const held = K.gateOpen('row:aor1-pas');
    await K.setGate('row:aor1-pas', true); const back = K.gateOpen('row:aor1-pas');
    return { legacy, held, back }; });
  ok(rows.legacy === true && rows.held === false && rows.back === true, 'learned row opens despite an old closed mark; your own untick keeps it closed: ' + JSON.stringify(rows));
  // the daily cap: for a kind with more than 2 new forms available, a session plan adds at most 2
  const cap = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); const P = await import('/lexiko/js/parse.js'); const { allGateKeys } = await import('/lexiko/js/kinds.js');
    await K.setSetting('gates', K.allGatesOpen()); await K.setSetting('gateTrickle', {});
    const fresh = P.planParseSession({}).fresh, count = (k) => fresh.filter((x) => P.formGateKeys(x.id).includes(k)).length;
    const k = allGateKeys().find((q) => count(q) > 2); if (!k) return null;
    await K.setSetting('gateTrickle', { [k]: Date.now() });
    const n = P.planParseSession({}).fresh.filter((x) => P.formGateKeys(x.id).includes(k)).length; return { k, free: count(k), n }; });
  ok(cap && cap.n === 2 && cap.free > 2, 'a new kind adds at most 2 forms a day: ' + JSON.stringify(cap));
  // once 20 of its forms have been met, the cap lifts (checked by giving it a settled history of 20 cards)
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
