// Backup reminder and automatic folder backup. node tools/test_backup.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(300); await k.setSetting('levelAsked', true);
    const F = await import('./js/fsrs.js'); for (let i = 0; i < 20; i++) { const id = 'w:' + (1000 + i); const c = { ...F.newCard(id), state: 'review', stability: 3, reps: 2, last: Date.now() - 864e5, due: Date.now() + 864e5 }; k.K.cards.set(id, c); (await import('./js/store.js')).store.putCards([c]); } });
  const home = async () => { await p.goto(URL + '#/settings'); await p.goto(URL + '#/home'); await p.waitForTimeout(400); };
  const set = (o) => p.evaluate(async (o) => { const k = await import('./js/know.js'); for (const [a, v] of Object.entries(o)) await k.setSetting(a, v); }, o);
  const banner = async () => (await p.locator('.banner:has-text("Back up your progress")').count()) === 1;
  const D = 864e5, now = Date.now();
  await set({ lastBackup: now - 5 * D, backupReminder: true, backupSnooze: 0 }); await home();
  ok(await banner() && /5 days ago/.test(await p.textContent('.banner')), 'banner after 5 days with progress since');
  await set({ lastBackup: now - 3 * D }); await home(); ok(!(await banner()), 'no banner at 3 days');
  await set({ lastBackup: now - 5 * D, backupReminder: false }); await home(); ok(!(await banner()), 'no banner when reminders are off');
  await set({ backupReminder: true }); await home(); await p.click('.banner button:text-is("Not now")'); await p.waitForTimeout(300);
  ok(!(await banner()), 'Not now hides it'); await set({}); await p.reload(); await ready(); ok(!(await banner()), 'and it stays hidden');
  await set({ backupSnooze: now - 1 }); await home(); ok(await banner(), 'it returns after the snooze');
  await set({ lastBackup: now }); await p.evaluate(async () => { const k = await import('./js/know.js'); for (const c of k.K.cards.values()) c.last = Date.now() - 20 * 864e5; }); await set({ lastBackup: now - 10 * D }); await home();
  ok(!(await banner()), 'no banner when nothing was studied since the last backup');
  await set({ lastBackup: 0 }); await home(); ok(await banner() && /not made a backup/.test(await p.textContent('.banner')), 'never backed up (15+ words studied): banner says so');

  // Settings
  await p.goto(URL + '#/settings'); await p.waitForSelector('h2:text-is("Your data")');
  const sv = await p.textContent('#view'); ok(/Remind me to back up/.test(sv) && /Back up automatically|Automatic backup/.test(sv), 'Settings: reminder toggle and automatic backup shown');
  await p.click('#view button:text-is("Off")'); await p.waitForTimeout(200);
  ok(await p.evaluate(async () => (await import('./js/know.js')).K.settings.backupReminder) === false, 'Settings: reminder can be turned off');
  ok(!/(null|undefined)/.test(await p.textContent('#view')), 'Settings: no stray null/undefined');

  // automatic backup with a pretend folder
  const r = await p.evaluate(async () => {
    const B = await import('./js/backup.js'), k = await import('./js/know.js'), S = await import('./js/store.js');
    const files = new Map(); let perm = 'granted';
    const dir = { name: 'sync', async queryPermission() { return perm; }, async requestPermission() { perm = 'granted'; return perm; },
      async getFileHandle(n) { return { async createWritable() { let t = ''; return { async write(x) { t += x; }, async close() { files.set(n, t); } }; } }; } };
    const out = {};
    out.offBefore = await B.autoState();
    await B.useHandle(dir); await k.setSetting('autoBackup', true); await k.setSetting('lastAuto', 0); await k.setSetting('lastDated', 0);
    out.state = await B.autoState();
    out.w1 = await B.writeAuto(true); out.names1 = [...files.keys()];
    const bk = JSON.parse(files.get('lexiko-backup.json')); out.fmt = bk.format; out.noHandle = !('autoBackupDir' in bk.kv); out.cards = bk.cards.length;
    files.clear(); out.w2 = await B.writeAuto(true); out.names2 = [...files.keys()];                 // within a week: rolling file only
    await k.setSetting('lastDated', Date.now() - 8 * 864e5); files.clear(); await B.writeAuto(true); out.names3 = [...files.keys()];
    files.clear(); out.skipSoon = await B.writeAuto(false); out.filesSoon = files.size;             // too soon, nothing new
    perm = 'prompt'; out.perm = await B.autoState(); files.clear(); out.noWrite = await B.writeAuto(true); out.filesNoPerm = files.size;
    out.allowed = await B.allowAuto(); out.after = await B.autoState();
    await B.stopAuto(); out.stopped = await B.autoState(); out.saved = k.K.settings.lastBackup > 0;
    return out; });
  ok(r.offBefore === 'off' && r.state === 'on', 'auto: off until a folder is chosen, then on', JSON.stringify([r.offBefore, r.state]));
  ok(r.w1 && r.fmt === 'lexiko-backup' && r.noHandle && r.cards >= 20 && r.names1.includes('lexiko-backup.json') && r.names1.length === 2 && r.names1.some((n) => /^lex-\d{6}-\d{4}\.json$/.test(n)), 'auto: rolling file plus a dated copy, a valid backup without the folder handle', JSON.stringify(r.names1));
  ok(r.w2 && r.names2.length === 1 && r.names2[0] === 'lexiko-backup.json', 'auto: within a week only the rolling file is rewritten');
  ok(r.names3.length === 2, 'auto: a new dated copy after a week');
  ok(r.skipSoon === false && r.filesSoon === 0, 'auto: nothing written when too soon or nothing new');
  ok(r.perm === 'needs-permission' && r.noWrite === false && r.filesNoPerm === 0, 'auto: no write without permission');
  ok(r.allowed === true && r.after === 'on', 'auto: one tap on Allow brings it back');
  ok(r.stopped === 'off', 'auto: turning it off works'); ok(r.saved, 'auto: counts as the last backup');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
