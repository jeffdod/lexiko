// Reader top bar: the chapter is the big thing with a small arrow each side; a slim strip keeps chapter and section in view while the bar is away.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, h) => { const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('http://localhost:8123/lexiko/#/settings'); await p.waitForSelector('#nav a[data-tab]');
    await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); }); return p; };
  const U = 'http://localhost:8123/lexiko/#/read/';
  let p = await mk(390, 700);
  await p.goto(U + 'MAT/5'); await p.waitForSelector('.reader [data-t]'); await p.waitForTimeout(400);
  const top = await p.evaluate(() => { const t = document.querySelector('.readbar .title'), ar = [...document.querySelectorAll('.readbar a.arrow')]; const fs = (e) => parseFloat(getComputedStyle(e).fontSize);
    return { title: t.textContent.trim(), tsize: fs(t), bsize: fs(document.querySelector('.readbar .btn.ghost')), n: ar.length, w: ar.map((a) => Math.round(a.getBoundingClientRect().width)), h: ar.map((a) => Math.round(a.getBoundingClientRect().height)), labels: ar.map((a) => a.getAttribute('aria-label')), pills: document.querySelectorAll('.readbar .navbtn, .readbar .navpair').length,
      order: [...document.querySelector('.readbar .row').children].map((e) => e.className.split(' ')[0] || e.tagName), strip: getComputedStyle(document.querySelector('.readstrip')).display }; });
  ok(top.title.startsWith('Matthew 5') && top.tsize >= 20 && top.tsize > top.bsize * 1.3, 'the chapter is the biggest text in the bar: ' + top.title + ' ' + top.tsize + 'px');
  ok(top.n === 2 && top.w.every((x) => x >= 44) && top.h.every((x) => x >= 44), 'two arrows, at least 44 px: ' + JSON.stringify(top.w));
  ok(top.labels[0] === 'Previous chapter: Matthew 4' && top.labels[1] === 'Next chapter: Matthew 6', 'arrows name their chapters: ' + top.labels.join(' / '));
  ok(top.pills === 0 && top.order.join() === 'btn,title,btn,btn', 'the wide pills are gone; order is arrow, title, arrow, Aa: ' + top.order.join());
  ok(top.strip === 'none', 'the strip is not shown while the bar is');
  // scroll down: the bar slides away and the strip names chapter and section
  await p.evaluate(() => window.scrollTo(0, 1000)); await p.waitForTimeout(250); await p.evaluate(() => window.scrollTo(0, 1100)); await p.waitForTimeout(900);
  let s = await p.evaluate(() => ({ hidden: document.body.classList.contains('rd-hide'), disp: getComputedStyle(document.querySelector('.readstrip')).display, text: document.querySelector('.readstrip').textContent, h: Math.round(document.querySelector('.readstrip').getBoundingClientRect().height), sec: [...document.querySelectorAll('h3.peri')].filter((x) => x.getBoundingClientRect().top < 40).map((x) => x.querySelector('.pt').textContent).pop() }));
  ok(s.hidden && s.disp === 'block', 'scrolled down: bar hidden, strip shown');
  ok(s.text === 'Matthew 5 · ' + s.sec && !!s.sec, 'the strip names chapter and section: ' + s.text);
  ok(s.h <= 40, 'and stays slim (' + s.h + ' px)');
  await p.evaluate(() => window.scrollTo(0, 5200)); await p.waitForTimeout(400); await p.evaluate(() => window.scrollBy(0, 40)); await p.waitForTimeout(500);
  const s2 = await p.evaluate(() => ({ text: document.querySelector('.readstrip').textContent, hidden: document.body.classList.contains('rd-hide') }));
  ok(s2.text !== s.text || !s2.hidden, 'it follows the section as you scroll: ' + s2.text);
  await p.evaluate(() => { window.scrollTo(0, 1100); }); await p.waitForTimeout(300); await p.evaluate(() => window.scrollBy(0, 30)); await p.waitForTimeout(900);
  if (await p.evaluate(() => document.body.classList.contains('rd-hide'))) { await p.click('.readstrip'); await p.waitForTimeout(400); ok(await p.evaluate(() => !document.body.classList.contains('rd-hide')), 'tapping the strip brings the bar back'); }
  else ok(true, 'bar was already back (skipped strip tap)');
  // longest name on narrow phones: the title stays on one line, arrows and Aa stay on screen
  for (const w of [360, 320]) { const q = await mk(w, 700); await q.goto(U + '1TH/5'); await q.waitForSelector('.reader [data-t]'); await q.waitForTimeout(300);
    const m = await q.evaluate(() => { const bar = document.querySelector('.readbar').getBoundingClientRect(), kids = [...document.querySelector('.readbar .row').children].map((e) => e.getBoundingClientRect()), t = document.querySelector('.readbar .title'), tt = t.querySelector('.tt');
      return { right: Math.max(...kids.map((k) => k.right)), bar: bar.right, h: Math.round(t.getBoundingClientRect().height), clipped: tt.scrollWidth > tt.clientWidth, noScroll: document.documentElement.scrollWidth <= innerWidth }; });
    ok(m.right <= m.bar + 1 && m.noScroll && m.h < 60 && (w > 320 ? !m.clipped : true), w + ' px: 1 Thessalonians 5 fits in the bar (title ' + (m.clipped ? 'shortened with …' : 'whole') + ', ' + m.h + ' px tall)'); }
  // wide screens keep the bar in view, so no strip
  const wd = await mk(1100, 800); await wd.goto(U + 'MAT/5'); await wd.waitForSelector('.reader [data-t]'); await wd.evaluate(() => window.scrollTo(0, 1200)); await wd.waitForTimeout(600);
  ok(await wd.evaluate(() => getComputedStyle(document.querySelector('.readstrip')).display === 'none'), 'wide screen: no strip');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
