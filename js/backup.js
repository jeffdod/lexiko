// Backups: the one-tap backup (download or share sheet), the automatic folder backup (Chrome/Edge on a computer),
// and the reminder logic for Home. Nothing here uploads anything: files only go where the person chooses.
import { clockNow } from './clock.js';
import { K, setSetting } from './know.js';
import { store, makeBackup, lockBackup } from './store.js';
import { toast } from './util.js';

export const DAY = 864e5;
export const REMIND_AFTER_DAYS = 4, SNOOZE_DAYS = 3, DATED_EVERY_DAYS = 7, AUTO_GAP_MS = 10 * 60 * 1000;
export const AUTO_FILE = 'lexiko-backup.json';

const pad = (n) => String(n).padStart(2, '0');
/** Short, sortable file name, e.g. lex-261031-0553.json (year-month-day, then time), so the newest is obvious in the Files app. */
export function backupName(locked = false, d = new Date()) {
  return 'lex-' + pad(d.getFullYear() % 100) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + (locked ? '-locked' : '') + '.json';
}
export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export async function markBackedUp() {
  await setSetting('lastBackup', clockNow());
  const el = document.querySelector('#bk-last'); if (el) el.textContent = 'Last backup: ' + new Date(K.settings.lastBackup).toLocaleString();
}

/** Back up now: the share sheet on phones, a download elsewhere. Resolves false if the person cancelled the share sheet. */
export async function runBackup(pass = '') {
  const plain = await makeBackup(), data = pass ? await lockBackup(plain, pass) : plain, json = JSON.stringify(data), name = backupName(!!pass);
  const blob = new Blob([json], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/.test(navigator.userAgent)) { await navigator.share({ files: [file], title: 'lexiko backup' }); await markBackedUp(); toast('Backup shared'); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }      // cancelled the share sheet: not a backup
  download(blob, name); await markBackedUp(); toast('Backup downloaded'); return true;
}

/* ---------- reminder ---------- */
/** Has anything been learned or reviewed since `t`? */
export function progressSince(t) { for (const c of K.cards.values()) if ((c.last || 0) > t) return true; return false; }
export function backupDue(studiedWords) {
  const s = K.settings, last = s.lastBackup, now = clockNow();
  if (s.backupReminder === false) return false;
  if (s.backupSnooze && now < s.backupSnooze) return false;
  if (!last) return studiedWords >= 15;
  return now - last > REMIND_AFTER_DAYS * DAY && progressSince(last);
}
export const snoozeBackupReminder = () => setSetting('backupSnooze', clockNow() + SNOOZE_DAYS * DAY);

/* ---------- automatic backup to a chosen folder ---------- */
export const autoSupported = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
let dir, loaded = false;                                       // the folder handle (kept in IndexedDB, never in a backup file)
async function load() { if (!loaded) { loaded = true; try { dir = (await store.get('autoBackupDir')) || null; } catch { dir = null; } } return dir; }
export async function useHandle(handle) { loaded = true; dir = handle; try { await store.set('autoBackupDir', handle); } catch { /* a handle that can't be stored still works this session */ } }
export const folderName = async () => ((await load()) || {}).name || '';
export async function chooseFolder() {
  try { const h = await window.showDirectoryPicker({ id: 'lexiko-backup', mode: 'readwrite' }); await useHandle(h); await setSetting('autoBackup', true); return h.name; }
  catch (e) { if (e && e.name === 'AbortError') return null; toast('That folder can’t be used. Try a new folder inside Documents.'); return null; }
}
export async function stopAuto() { await setSetting('autoBackup', false); loaded = true; dir = null; try { await store.set('autoBackupDir', undefined); } catch { /* ignore */ } }
/** 'on' | 'off' | 'needs-permission' */
export async function autoState() {
  if (!K.settings.autoBackup) return 'off';
  const h = await load(); if (!h) return 'off';
  try { return (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'on' : 'needs-permission'; } catch { return 'needs-permission'; }
}
export async function allowAuto() {                            // must be called from a tap
  const h = await load(); if (!h) return false;
  try { if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') return false; } catch { return false; }
  return writeAuto(true);
}
async function put(h, name, text) { const f = await h.getFileHandle(name, { create: true }), w = await f.createWritable(); await w.write(text); await w.close(); }
/** Write the rolling file (and a dated copy about once a week). Quietly does nothing when there is nothing new or no permission. */
export async function writeAuto(force = false) {
  if ((await autoState()) !== 'on') return false;
  const now = clockNow(), s = K.settings;
  if (!force) { if (s.lastAuto && now - s.lastAuto < AUTO_GAP_MS) return false; if (s.lastAuto && !progressSince(s.lastAuto)) return false; }
  try {
    const text = JSON.stringify(await makeBackup()), h = await load();
    await put(h, AUTO_FILE, text);
    if (!s.lastDated || now - s.lastDated >= DATED_EVERY_DAYS * DAY) { await put(h, backupName(false, new Date(now)), text); await setSetting('lastDated', now); }
    await setSetting('lastAuto', now); await setSetting('lastBackup', now);
    return true;
  } catch (e) { console.warn('lexiko: automatic backup failed', e); return false; }
}
let started = false;
/** Called once at start-up: save when the page is hidden or closed, and when moving back to Home. */
export function startAutoBackup() {
  if (started) return; started = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeAuto(); });
  window.addEventListener('hashchange', () => { if (/^#\/(home)?$/.test(location.hash) || location.hash === '') writeAuto(); });
  setTimeout(writeAuto, 5000);
}
