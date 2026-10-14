/*
 * Storage on this device for sound files: music people add from their phone, and recorded Bible readings.
 * Uses IndexedDB, which can hold large audio files; nothing leaves the device.
 */
(function () {
  'use strict';
  const NAME = 'lamp-media', VERSION = 2;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('This browser cannot store files.')); return; }
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('music')) db.createObjectStore('music', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('voices')) {
          const s = db.createObjectStore('voices', { keyPath: 'id' });
          s.createIndex('key', 'key');        // 'book.chapter.verse'
          s.createIndex('reader', 'reader');
        }
        if (!db.objectStoreNames.contains('mylang')) db.createObjectStore('mylang', { keyPath: 'id' });   // Pray in my own language
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('Could not open storage.'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function tx(store, mode, fn) {
    const db = await open();
    const t = db.transaction(store, mode);
    const out = await fn(t.objectStore(store));
    await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage is full.')); });
    return out;
  }

  const put = (store, item) => tx(store, 'readwrite', s => req(s.put(item)));
  const get = (store, id) => tx(store, 'readonly', s => req(s.get(id)));
  const del = (store, id) => tx(store, 'readwrite', s => req(s.delete(id)));
  const all = store => tx(store, 'readonly', s => req(s.getAll()));
  const byIndex = (store, index, value) => tx(store, 'readonly', s => req(s.index(index).getAll(value)));
  /* everything except the audio itself, for lists */
  const list = async store => (await all(store)).map(x => { const o = Object.assign({}, x); delete o.blob; return o; });

  /* Ask the browser to keep these files even when space runs low. */
  async function persist() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } }
  async function usage() { try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) { return null; } }
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const size = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';

  window.MediaStore = { put, get, del, all, list, byIndex, persist, usage, uid, size };
})();
