// IndexedDB persistence: settings (kv), SRS cards, review log. Plus persistence request, backup, import.
const DB_NAME = 'lexiko', DB_VER = 1;
let dbp = null, memory = null;       // memory fallback if IndexedDB is unavailable (e.g. some private modes)

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch((e) => { console.warn('lexiko: falling back to in-memory storage:', e); memory = { kv: new Map(), cards: new Map(), log: [] }; return null; });
  return dbp;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const txDone = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export const store = {
  get usingMemory() { return !!memory; },
  async get(k) {
    const db = await open();
    if (!db) return memory.kv.get(k);
    const r = await wrap(db.transaction('kv').objectStore('kv').get(k));
    return r ? r.v : undefined;
  },
  async set(k, v) {
    const db = await open();
    if (!db) { memory.kv.set(k, v); return; }
    const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ k, v }); await txDone(tx);
  },
  async allCards() {
    const db = await open();
    if (!db) return [...memory.cards.values()];
    return wrap(db.transaction('cards').objectStore('cards').getAll());
  },
  async putCards(cards) {
    const db = await open();
    if (!db) { cards.forEach((c) => memory.cards.set(c.id, c)); return; }
    const tx = db.transaction('cards', 'readwrite'); const os = tx.objectStore('cards');
    cards.forEach((c) => os.put(c)); await txDone(tx);
  },
  async addLog(entries) {
    const db = await open();
    if (!db) { memory.log.push(...entries); return; }
    const tx = db.transaction('log', 'readwrite'); const os = tx.objectStore('log');
    entries.forEach((e) => os.add(e)); await txDone(tx);
  },
  async allLog() {
    const db = await open();
    if (!db) return memory.log.slice();
    return wrap(db.transaction('log').objectStore('log').getAll());
  },
  async allKV() {
    const db = await open();
    if (!db) return Object.fromEntries(memory.kv);
    const rows = await wrap(db.transaction('kv').objectStore('kv').getAll());
    return Object.fromEntries(rows.map((r) => [r.k, r.v]));
  },
  async clearAll() {
    const db = await open();
    if (!db) { memory = { kv: new Map(), cards: new Map(), log: [] }; return; }
    const tx = db.transaction(['kv', 'cards', 'log'], 'readwrite');
    ['kv', 'cards', 'log'].forEach((n) => tx.objectStore(n).clear()); await txDone(tx);
  },
};

/* ---------- ask the OS not to evict our data ---------- */
export async function requestPersistence() {
  const info = { supported: !!(navigator.storage && navigator.storage.persist), persisted: false, usage: null, quota: null };
  try {
    if (info.supported) {
      info.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    }
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate(); info.usage = e.usage; info.quota = e.quota;
    }
  } catch (e) { console.warn('persist:', e); }
  return info;
}

/* ---------- backup / restore ---------- */
export const BACKUP_FORMAT = 'lexiko-backup';

export async function makeBackup() {
  const [kv, cards, log] = await Promise.all([store.allKV(), store.allCards(), store.allLog()]);
  return { format: BACKUP_FORMAT, version: 1, exported: new Date().toISOString(), kv, cards, log };
}

export function validateBackup(o) {
  if (!o || o.format !== BACKUP_FORMAT) throw new Error('This file is not a lexiko backup.');
  if (!o.kv || typeof o.kv !== 'object' || !Array.isArray(o.cards) || !Array.isArray(o.log)) throw new Error('The backup file is incomplete or damaged.');
  for (const c of o.cards) if (!c || typeof c.id !== 'string' || typeof c.due !== 'number') throw new Error('The backup contains an invalid card.');
  return o;
}

/** mode 'replace' wipes local data first; 'merge' keeps the newer card per id and unions the log. */
export async function importBackup(o, mode = 'merge') {
  validateBackup(o);
  if (mode === 'replace') {
    await store.clearAll();
    for (const [k, v] of Object.entries(o.kv)) await store.set(k, v);
    await store.putCards(o.cards);
    if (o.log.length) await store.addLog(o.log);
    return { cards: o.cards.length, log: o.log.length };
  }
  const local = new Map((await store.allCards()).map((c) => [c.id, c]));
  const take = o.cards.filter((c) => !local.has(c.id) || (c.last || 0) > (local.get(c.id).last || 0));
  await store.putCards(take);
  const have = new Set((await store.allLog()).map((e) => e.t + '|' + e.id));
  const newLog = o.log.filter((e) => !have.has(e.t + '|' + e.id));
  if (newLog.length) await store.addLog(newLog);
  // daily aggregates: take the larger count per day per field
  const daily = (await store.get('daily')) || {}, theirs = o.kv.daily || {};
  for (const [d, v] of Object.entries(theirs)) {
    const m = daily[d] || (daily[d] = {});
    for (const [f, n] of Object.entries(v)) m[f] = Math.max(m[f] || 0, n);
  }
  await store.set('daily', daily);
  for (const k of ['settings', 'goal', 'read', 'parseStats']) {            // fill in anything the device lacks
    if (o.kv[k] !== undefined && (await store.get(k)) === undefined) await store.set(k, o.kv[k]);
  }
  if (o.kv.read) {                                            // union of chapters marked read
    const mine = (await store.get('read')) || {}; Object.assign(mine, o.kv.read, mine); await store.set('read', mine);
  }
  return { cards: take.length, log: newLog.length };
}
