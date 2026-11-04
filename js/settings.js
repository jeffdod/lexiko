// Settings: theme, level, study options, data protection / backup / restore, install help, about & licenses.
import { clockNow } from './clock.js';
import { D } from './data.js';
import { K, setting, setSetting, setLevel, studiedCount, getParseStats } from './know.js';
import { paceOptions } from './pace.js';
import { store, requestPersistence, makeBackup, importBackup, validateBackup, ENC_FORMAT, canLock, lockBackup, unlockBackup } from './store.js';
import { h, clear, toast, icon, pct, fold, fmt } from './util.js';
import { renderDev } from './timetravel.js';
import { runBackup, autoSupported, autoState, chooseFolder, stopAuto, allowAuto, folderName, writeAuto, AUTO_FILE } from './backup.js';

export const LEVELS = [null, 1000, 500, 250, 100, 50, 30, 20, 10, 5];

export function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const isDarkMeta = /dark/.test(m.media || ''); m.content = t === 'auto' || !t ? (isDarkMeta ? '#12161b' : '#f6f2ea') : (dark ? '#12161b' : '#f6f2ea');
  });
}

export function levelStats(level) {
  if (level == null) return { words: 0, cov: 0 };
  let words = 0, tok = 0;
  for (const L of D.lex) if (L.freq >= level) { words++; tok += L.freq; }
  return { words, cov: tok / D.totalTokens };
}

export function levelPicker(onChange) {
  const wrap = h('div.levels');
  const draw = () => {
    clear(wrap).append(...LEVELS.map((lv) => {
      const st = levelStats(lv);
      return h('button.lvl', { 'aria-pressed': setting('level') === lv, onclick: async () => { await setLevel(lv); draw(); onChange && onChange(lv); } },
        lv == null ? 'Just starting' : lv + '+', h('small', lv == null ? 'no words yet' : fmt(st.words) + ' words · ' + pct(st.cov) + ' of text'));
    }));
  };
  draw(); return wrap;
}

const seg = (opts, cur, onPick) => {
  const el = h('div.seg');
  opts.forEach(([v, t]) => el.append(h('button', { 'aria-pressed': cur === v, onclick: async () => { await onPick(v); [...el.children].forEach((b, i) => b.setAttribute('aria-pressed', opts[i][0] === v)); } }, t)));
  return el;
};

export function renderSettings(view, params = []) {
  if (params[0] === 'dev') return void renderDev(view);
  const persistLine = h('div.muted.small', 'Checking storage…');
  const refreshPersist = async (ask) => {
    const info = ask ? await requestPersistence() : await requestPersistence();
    persistLine.textContent = !info.supported ? 'This browser can’t be asked to protect storage. Make backups regularly.'
      : (info.persisted ? '✓ Storage is protected: the browser won’t clear your progress to free space.' : 'Storage is not protected yet — the browser may clear it if the device runs low on space. Installing the app to your home screen helps; so do regular backups.')
        + (info.usage != null ? ' (Using ' + (info.usage / 1048576).toFixed(1) + ' MB.)' : '');
  };
  refreshPersist();
  const lastBackup = K.settings.lastBackup;
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; fileIn.value = ''; if (!f) return;
    let data;
    try {
      data = JSON.parse(await f.text());
      if (data && data.format === ENC_FORMAT) {                                  // a passphrase-protected backup
        if (!canLock()) return toast('This browser can’t open protected backups here. Open lexiko from its web address (https) instead.');
        data = await askUnlock(data); if (!data) return;
      }
      data = validateBackup(data);
    } catch (e) { return toast(e.message || 'That file can’t be read.'); }
    const dlg = h('dialog', h('h2', 'Restore backup'), h('p', 'Backup from ' + new Date(data.exported).toLocaleString() + ' with ' + data.cards.length + ' cards.'),
      h('p.small.muted', '“Merge” keeps the most recent result for each word on both sides. “Replace” wipes this device first.'),
      h('div.row.wrap', h('button.btn.primary', { onclick: async () => { dlg.close(); await importBackup(data, 'merge'); toast('Merged — reloading…'); setTimeout(() => location.reload(), 700); } }, 'Merge'),
        h('button.btn.danger', { onclick: async () => { dlg.close(); await importBackup(data, 'replace'); toast('Restored — reloading…'); setTimeout(() => location.reload(), 700); } }, 'Replace'),
        h('button.btn.ghost', { onclick: () => dlg.close() }, 'Cancel')));
    document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
  });
  const passIn = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Optional passphrase', 'aria-label': 'Optional passphrase for the backup', style: { width: '100%' } });
  const doBackup = () => runBackup(passIn.value);

  const installBtn = h('button.btn', { hidden: !window.__installEvt, onclick: async () => { const e = window.__installEvt; if (!e) return; e.prompt(); await e.userChoice; window.__installEvt = null; installBtn.hidden = true; } }, icon('download', 18), 'Install app');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const levelLine = () => { const lv = setting('level'); return lv == null ? 'Just starting: no words marked as known' : 'I know words used ' + lv + '+ times (' + fmt(levelStats(lv).words) + ' words)'; };
  const levelCard = () => {
    const card = h('div.card.stack'), draw = (open) => {
      clear(card).append(h('div.row.between', h('div', h('h2', 'Your level'), h('div.muted.small', { id: 'lvl-line', style: { marginTop: '.2rem' } }, levelLine())),
        h('button.btn.ghost.sm', { 'aria-expanded': open, onclick: () => draw(!open) }, open ? 'Done' : 'Change ›')));
      if (open) card.append(h('p.muted.small', 'I already know every word that occurs at least this many times. lexiko will still spot-check some of them now and then.'), levelPicker(() => { card.querySelector('#lvl-line').textContent = levelLine(); }));
    };
    draw(false); return card;
  };
  const autoBox = h('div.stack');
  const drawAuto = async () => {
    const st = await autoState(), name = await folderName();
    clear(autoBox);
    if (!autoSupported()) { autoBox.append(h('div.muted.small', h('b', 'Automatic backup'), h('br'), 'This browser can’t save to a folder by itself, so lexiko will remind you to back up instead. On a computer with Chrome or Edge you can turn on automatic backup.')); return; }
    autoBox.append(h('div.row.between', h('div', h('b', 'Back up automatically'), h('div.muted.small', st === 'off' ? 'Keeps a backup file up to date in a folder you choose, such as one synced by iCloud, Dropbox, OneDrive or Google Drive.' : 'Saves to: ' + name)),
      st === 'off' ? h('button.btn.sm', { onclick: async () => { if (await chooseFolder()) { await writeNow(); drawAuto(); } } }, 'Choose folder…') : h('button.btn.sm', { 'aria-label': 'Turn off automatic backup', onclick: async () => { await stopAuto(); drawAuto(); } }, 'Turn off')));
    if (st === 'needs-permission') autoBox.append(h('div.muted.small', 'Your browser has paused automatic backup. Tap to allow it again.'), h('button.btn', { onclick: async () => { if (await allowAuto()) toast('Automatic backup is on'); drawAuto(); } }, 'Allow automatic backup'));
    if (st !== 'off') autoBox.append(h('div.muted.small', 'One file, ' + AUTO_FILE + ', is kept up to date, plus a dated copy about once a week. Automatic backups are not locked with a passphrase.'),
      h('button.btn.ghost.sm', { onclick: async () => { if (await chooseFolder()) { await writeNow(); drawAuto(); } } }, 'Choose a different folder ›'));
  };
  const writeNow = async () => { const ok = await writeAuto(true); if (ok) { toast('Backed up to your folder'); const el = document.querySelector('#bk-last'); if (el) el.textContent = 'Last backup: ' + new Date(K.settings.lastBackup).toLocaleString(); } };
  drawAuto();
  const parseNoteEl = h('div.muted.small');
  const parseNote = async () => { const st = await getParseStats(); parseNoteEl.textContent = setting('parseMode') === 'auto' ? 'Automatic: verbs ' + (st.mode.verb || 'guided') + ', nouns, adjectives & pronouns ' + (st.mode.other || 'guided') + '.' : ''; };
  parseNote();
  clear(view).append(h('div.pagehead', h('h1', 'Settings')), h('div.stack',
    h('a.card.flat.row.between', { href: '#/help', style: { textDecoration: 'none', color: 'inherit' } }, h('b', 'How lexiko works'), h('span.muted', '›')),
    h('div.card.stack', h('h2', 'Your data'),
      h('div.muted.small', { id: 'bk-last' }, lastBackup ? 'Last backup: ' + new Date(lastBackup).toLocaleString() : 'No backup yet. Your progress lives only on this device — back it up now and then.'),
      h('div.row.wrap', h('button.btn.primary', { onclick: doBackup }, icon('download', 18), 'Back up progress'), h('button.btn', { onclick: () => fileIn.click() }, icon('upload', 18), 'Restore…'), fileIn),
      autoBox,
      h('div.row.between', h('div', h('b', 'Remind me to back up'), h('div.muted.small', 'A note on Home when it has been over 4 days and you have made progress.')),
        seg([[true, 'On'], [false, 'Off']], setting('backupReminder') !== false, (v) => setSetting('backupReminder', v))),
      canLock() ? fold('Lock the backup with a passphrase (optional)', h('label.field', 'Passphrase', passIn),
        h('div.muted.small', 'Leave it empty for an ordinary backup. If you set one, you’ll need the same passphrase to restore, and lexiko can’t recover it for you: it isn’t stored anywhere.')) : null,
      fold('Where backups go, and storage', h('p.muted.small', { id: 'bk-where' }, ios ? 'On iPhone/iPad: tap Back up progress, then choose “Save to Files” in the menu that appears, and pick a folder in iCloud Drive (a folder named lexiko works well). To restore later, tap Restore… and choose that file. Backup names start with “lex” and end with the date, so the newest is easy to find.'
        : /Android/.test(navigator.userAgent) ? 'On Android: tap Back up progress, then choose where to save it (for example Drive or Files). To restore later, tap Restore… and choose that file. Backup names start with “lex” and end with the date.'
        : 'On a computer the backup is saved to your Downloads folder. Copy it somewhere safe (a cloud drive or a USB stick). To restore later, click Restore… and choose that file. Backup names start with “lex” and end with the date.'),
        persistLine, h('div.row.wrap', h('button.btn.sm', { onclick: () => refreshPersist(true) }, 'Protect my data')),
        h('div.muted.small', store.usingMemory ? '⚠ This browser is blocking storage, so progress will be lost when you close the page.' : 'Stored in this browser (IndexedDB). No account, no server.'))),
    h('div.card', h('h2', 'Appearance'), seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], setting('theme'), async (v) => { await setSetting('theme', v); applyTheme(v); })),
    levelCard(),
    h('div.card.stack', h('h2', 'Studying'),
      h('div.row.between', h('b', 'Quiz style'), seg([['flash', 'Flashcards'], ['choice', 'Multiple choice']], setting('mode'), (v) => setSetting('mode', v))),
      h('div.row.between', h('b', 'New words per day'), h('input', { type: 'number', min: 0, max: 40, 'aria-label': 'New words per day', value: setting('newPerDay'), style: { width: '5rem' }, onchange: (e) => setSetting('newPerDay', Math.max(0, Math.min(40, +e.target.value || 0))) })),
      ...paceOptions('words', 'words', () => renderSettings(view))),
    h('div.card.stack', h('h2', 'Parsing'),
      h('div.row.between.wrap', h('div', h('b', 'Style'), h('div.muted.small', 'Guided asks one part at a time. Quick shows all parts at once. Auto moves up when you’re reliable.')),
        seg([['auto', 'Auto'], ['guided', 'Guided'], ['quick', 'Quick']], setting('parseMode'), async (v) => { await setSetting('parseMode', v); parseNote(); })), parseNoteEl,
      h('div.row.between', h('b', 'New forms per day'), h('select', { 'aria-label': 'New forms per day', onchange: (e) => setSetting('parseNewPerDay', +e.target.value) }, [5, 10, 15, 20, 30].map((n) => h('option', { value: n, selected: n === setting('parseNewPerDay') }, n)))),
      ...paceOptions('parse', 'forms', () => renderSettings(view))),
    fold('Advanced',
      h('div.row.between', h('div', h('b', 'Spot-checks'), h('div.muted.small', 'How often words you’ve said you know are mixed into sessions to check them.')),
        seg([[0, 'Off'], [0.06, 'Light'], [0.12, 'Normal'], [0.2, 'More']], setting('probeRate'), (v) => setSetting('probeRate', v))),
      h('div.row.between', h('div', h('b', 'Memory target'), h('div.muted.small', 'Higher = more reviews, fewer forgotten words.')),
        seg([[0.85, '85%'], [0.9, '90%'], [0.95, '95%']], setting('retention'), (v) => setSetting('retention', v)))),
    standalone ? null : h('div.card.stack', h('h2', 'Install'), installBtn,
      h('p.muted.small', ios ? 'On iPhone/iPad: tap the Share button, then “Add to Home Screen”. It then opens full-screen and works offline.' : 'Use your browser’s “Install app” / “Add to Home Screen” option to run lexiko full-screen, offline, with no browser bars.')),
    fold('About lexiko',
      h('p.small', 'lexiko — free, offline, no login. Greek text: Robinson–Pierpont Byzantine Textform with Strong’s numbers and RP morphology. Glosses: a Dodson Greek–English Lexicon derivative (public domain), with case notes added for prepositions. Type: Gentium Porsonic by SIL Global, SIL Open Font License 1.1, modified web subset renamed “Lexiko Serif”.'),
      h('p.small.muted', 'Scheduling uses the open FSRS algorithm. ' + fmt(D.lex.length) + ' words · ' + fmt(D.totalTokens) + ' tokens · ' + (studiedCount('w:') ? studiedCount('w:') + ' words studied.' : 'nothing studied yet.')),
      h('div.row.wrap', h('button.btn.sm', { onclick: showLicense }, 'Font license'), h('a.btn.sm', { href: 'https://github.com/jeffdod/lexiko', target: '_blank', rel: 'noopener' }, 'Source'),
        h('button.btn.sm.danger', { onclick: async () => { if (confirm('Erase ALL progress and settings on this device? Back up first if unsure.') && confirm('Really erase everything?')) { await store.clearAll(); try { localStorage.removeItem('lexiko-theme'); } catch { /* ignore */ } location.replace(location.pathname + location.search); /* back to Home, so the first-run questions appear */ } } }, 'Erase everything')))));
}

/** Ask for the passphrase of a locked backup; resolves with the decrypted backup, or null if cancelled. */
function askUnlock(enc) {
  return new Promise((resolve) => {
    const pass = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Backup passphrase', style: { width: '100%' } });
    const msg = h('div.small', { style: { color: 'var(--bad)', minHeight: '1.2em' } });
    const dlg = h('dialog', h('h2', 'This backup is locked'), h('p.small', 'Enter the passphrase you chose when you made it.'), pass, msg,
      h('div.row.wrap', { style: { marginTop: '.6rem' } },
        h('button.btn.primary', { onclick: async () => { try { const o = await unlockBackup(enc, pass.value); done = true; dlg.close(); resolve(o); } catch { msg.textContent = 'That passphrase doesn’t open this backup.'; } } }, 'Unlock'),
        h('button.btn.ghost', { onclick: () => dlg.close() }, 'Cancel')));
    let done = false;
    dlg.addEventListener('close', () => { dlg.remove(); if (!done) resolve(null); });
    pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') dlg.querySelector('.btn.primary').click(); });
    document.body.append(dlg); dlg.showModal(); pass.focus();
  });
}

/** The license opens inside the app (a plain link to the .txt file would leave the installed app with no way back). */
async function showLicense() {
  const pre = h('pre.license', 'Loading…');
  const dlg = h('dialog.sheet', h('h2', 'Font license'), pre, h('div.row', { style: { marginTop: '.8rem' } }, h('button.btn.primary.block', { onclick: () => dlg.close() }, 'Close')));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg); dlg.showModal();
  try { const r = await fetch('fonts/OFL.txt'); if (!r.ok) throw new Error(r.status); pre.textContent = await r.text(); }
  catch { pre.textContent = 'The license text could not be loaded. It is the SIL Open Font License 1.1: https://openfontlicense.org'; }
}
