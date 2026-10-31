// Settings: theme, level, study options, data protection / backup / restore, install help, about & licenses.
import { D } from './data.js';
import { K, setting, setSetting, setLevel } from './know.js';
import { store, requestPersistence, makeBackup, importBackup, validateBackup } from './store.js';
import { h, clear, toast, icon, pct } from './util.js';

const fmt = (n) => n.toLocaleString('en-US');
export const LEVELS = [null, 1000, 500, 250, 100, 50, 30, 20, 10, 5];

export function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const isDarkMeta = /dark/.test(m.media || ''); m.content = t === 'auto' || !t ? (isDarkMeta ? '#12161b' : '#f6f2ea') : (dark ? '#12161b' : '#f6f2ea');
  });
}

function levelStats(level) {
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

/** Short, sortable file name, e.g. lex-261031-0553.json (year-month-day, then time), so the newest is obvious in the Files app. */
function backupName(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return 'lex-' + p(d.getFullYear() % 100) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json';
}

function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export function renderSettings(view) {
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
    let data; try { data = validateBackup(JSON.parse(await f.text())); } catch (e) { return toast(e.message || 'That file can’t be read.'); }
    const dlg = h('dialog', h('h2', 'Restore backup'), h('p', 'Backup from ' + new Date(data.exported).toLocaleString() + ' with ' + data.cards.length + ' cards.'),
      h('p.small.muted', '“Merge” keeps the most recent result for each word on both sides. “Replace” wipes this device first.'),
      h('div.row.wrap', h('button.btn.primary', { onclick: async () => { dlg.close(); await importBackup(data, 'merge'); toast('Merged — reloading…'); setTimeout(() => location.reload(), 700); } }, 'Merge'),
        h('button.btn.danger', { onclick: async () => { dlg.close(); await importBackup(data, 'replace'); toast('Restored — reloading…'); setTimeout(() => location.reload(), 700); } }, 'Replace'),
        h('button.btn.ghost', { onclick: () => dlg.close() }, 'Cancel')));
    document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
  });
  const markBackedUp = async () => {
    await setSetting('lastBackup', Date.now());
    const el = document.querySelector('#bk-last'); if (el) el.textContent = 'Last backup: ' + new Date(K.settings.lastBackup).toLocaleString();
  };
  const doBackup = async () => {
    const data = await makeBackup(), json = JSON.stringify(data), name = backupName();
    const blob = new Blob([json], { type: 'application/json' });
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/.test(navigator.userAgent)) { await navigator.share({ files: [file], title: 'lexiko backup' }); await markBackedUp(); return toast('Backup shared'); }
    } catch (e) { if (e && e.name === 'AbortError') return; }      // cancelled the share sheet: not a backup
    download(blob, name); await markBackedUp(); toast('Backup downloaded');
  };

  const installBtn = h('button.btn', { hidden: !window.__installEvt, onclick: async () => { const e = window.__installEvt; if (!e) return; e.prompt(); await e.userChoice; window.__installEvt = null; installBtn.hidden = true; } }, icon('download', 18), 'Install app');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  clear(view).append(h('div.pagehead', h('h1', 'Settings')), h('div.stack',
    h('div.card', h('h2', 'Appearance'), seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], setting('theme'), async (v) => { await setSetting('theme', v); applyTheme(v); })),
    h('div.card.stack', h('h2', 'Your level'), h('p.muted.small', 'I already know every word that occurs at least this many times. lexiko will still spot-check some of them now and then.'),
      levelPicker(),
      h('div.row.between', h('div', h('b', 'Spot-checks'), h('div.muted.small', 'How often words you’ve claimed to know are mixed into sessions.')),
        seg([[0, 'Off'], [0.06, 'Light'], [0.12, 'Normal'], [0.2, 'More']], setting('probeRate'), (v) => setSetting('probeRate', v)))),
    h('div.card.stack', h('h2', 'Studying'),
      h('div.row.between', h('b', 'Quiz style'), seg([['flash', 'Flashcards'], ['choice', 'Multiple choice']], setting('mode'), (v) => setSetting('mode', v))),
      h('div.row.between', h('b', 'New words per day'), h('input', { type: 'number', min: 0, max: 100, value: setting('newPerDay'), style: { width: '5rem' }, onchange: (e) => setSetting('newPerDay', Math.max(0, Math.min(100, +e.target.value || 0))) })),
      h('div.row.between', h('div', h('b', 'Memory target'), h('div.muted.small', 'Higher = more reviews, fewer forgotten words.')),
        seg([[0.85, '85%'], [0.9, '90%'], [0.95, '95%']], setting('retention'), (v) => setSetting('retention', v)))),
    h('div.card.stack', h('h2', 'Your data'), persistLine,
      h('div.row.wrap', h('button.btn', { onclick: () => refreshPersist(true) }, 'Protect my data'),
        h('button.btn.primary', { onclick: doBackup }, icon('download', 18), 'Back up progress'), h('button.btn', { onclick: () => fileIn.click() }, icon('upload', 18), 'Restore…'), fileIn),
      h('div.muted.small', { id: 'bk-last' }, lastBackup ? 'Last backup: ' + new Date(lastBackup).toLocaleString() : 'No backup yet. Your progress lives only on this device — back it up now and then.'),
      h('div.muted.small', store.usingMemory ? '⚠ This browser is blocking storage, so progress will be lost when you close the page.' : 'Stored in this browser (IndexedDB). No account, no server.')),
    h('div.card.stack', h('h2', 'Install'), installBtn,
      h('p.muted.small', standalone ? '✓ You’re running the installed app.' : ios ? 'On iPhone/iPad: tap the Share button, then “Add to Home Screen”. It then opens full-screen and works offline.' : 'Use your browser’s “Install app” / “Add to Home Screen” option to run lexiko full-screen, offline, with no browser bars.')),
    h('div.card.stack', h('h2', 'About'),
      h('p.small', 'lexiko — free, offline, no login. Greek text: Robinson–Pierpont Byzantine Textform with Strong’s numbers and RP morphology. Glosses: a Dodson Greek–English Lexicon derivative (public domain). Type: Gentium Porsonic by SIL Global, SIL Open Font License 1.1, modified web subset renamed “Lexiko Serif”.'),
      h('p.small.muted', 'Scheduling uses the open FSRS algorithm. ' + fmt(D.lex.length) + ' words · ' + fmt(D.totalTokens) + ' tokens · ' + (K.cards.size ? [...K.cards.keys()].filter((k) => k.startsWith('w:')).length + ' words studied.' : 'nothing studied yet.')),
      h('div.row.wrap', h('button.btn.sm', { onclick: showLicense }, 'Font license'), h('a.btn.sm', { href: 'https://github.com/jeffdod/lexiko', target: '_blank', rel: 'noopener' }, 'Source'),
        h('button.btn.sm.danger', { onclick: async () => { if (confirm('Erase ALL progress and settings on this device? Back up first if unsure.') && confirm('Really erase everything?')) { await store.clearAll(); try { localStorage.removeItem('lexiko-theme'); } catch { /* ignore */ } location.reload(); } } }, 'Erase everything')))));
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
