/*
 * The full King James Bible: loading, reference parsing, lookup and search.
 * Each book lives in js/kjv/NN.js and is loaded on demand with a <script> tag,
 * so it works from a web server, offline (service worker), or straight from file://.
 */
(function () {
  'use strict';
  const NAMES = window.BOOKS.map(b => b[0]);
  const CHAPTERS = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22];
  const SHORT = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1 Sam', '2 Sam', '1 Kgs', '2 Kgs', '1 Chr', '2 Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1 Cor', '2 Cor', 'Gal', 'Eph', 'Phil', 'Col', '1 Thess', '2 Thess', '1 Tim', '2 Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1 Pet', '2 Pet', '1 John', '2 John', '3 John', 'Jude', 'Rev'];

  const cache = {};
  const waiting = {};

  function _add(i, data) {
    cache[i] = data;
    (waiting[i] || []).forEach(w => w.res(data));
    delete waiting[i];
  }

  function load(i) {
    if (cache[i]) return Promise.resolve(cache[i]);
    return new Promise((res, rej) => {
      if (waiting[i]) { waiting[i].push({ res, rej }); return; }
      waiting[i] = [{ res, rej }];
      const s = document.createElement('script');
      s.src = `js/kjv/${String(i + 1).padStart(2, '0')}.js`;
      s.async = true;
      s.onerror = () => {
        const w = waiting[i] || [];
        delete waiting[i];
        s.remove();
        w.forEach(x => x.rej(new Error(`Could not load ${NAMES[i]}. Check your connection.`)));
      };
      document.head.appendChild(s);
    });
  }

  async function loadAll(onProgress) {
    let done = 0;
    const queue = NAMES.map((_, i) => i);
    async function worker() {
      while (queue.length) {
        const i = queue.shift();
        await load(i);
        done++;
        onProgress && onProgress(done / NAMES.length);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  /* ---------- Reference parsing ---------- */
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALIAS = {};
  NAMES.forEach((n, i) => { ALIAS[norm(n)] = i; ALIAS[norm(SHORT[i])] = i; });
  Object.assign(ALIAS, {
    gn: 0, ge: 0, ex: 1, exo: 1, lv: 2, le: 2, nm: 3, nu: 3, dt: 4, de: 4, jos: 5, jdg: 6, jg: 6, rth: 7, ru: 7,
    '1sa': 8, '1samuel': 8, '2sa': 9, '1ki': 10, '1kings': 10, '2ki': 11, '1ch': 12, '2ch': 13, ne: 15, est: 16, es: 16, jb: 17,
    ps: 18, psa: 18, psalm: 18, pss: 18, pr: 19, prv: 19, ec: 20, ecc: 20, qoh: 20, so: 21, sos: 21, songofsongs: 21, canticles: 21, song: 21,
    is: 22, je: 23, la: 24, eze: 25, ezk: 25, dn: 26, da: 26, ho: 27, jl: 28, am: 29, ob: 30, jnh: 31, jon: 31, mi: 32, na: 33, hb: 34,
    zep: 35, hg: 36, zec: 37, ml: 38, mt: 39, mat: 39, mk: 40, mr: 40, mrk: 40, lk: 41, lu: 41, luk: 41, jn: 42, jhn: 42, joh: 42, ac: 43, act: 43,
    ro: 44, rm: 44, '1co': 45, '2co': 46, ga: 47, ep: 48, php: 49, pp: 49, philippians: 49, phil: 49, co: 50, '1th': 51, '1thes': 51, '2th': 52, '2thes': 52,
    '1ti': 53, '2ti': 54, ti: 55, tit: 55, phm: 56, philem: 56, he: 57, jm: 58, ja: 58, jam: 58, '1pe': 59, '1pt': 59, '2pe': 60, '2pt': 60,
    '1jn': 61, '1jo': 61, '2jn': 62, '2jo': 62, '3jn': 63, '3jo': 63, jud: 64, jude: 64, re: 65, rv: 65, revelations: 65, apocalypse: 65
  });
  // allow "I John", "First Corinthians", "1st Peter"
  function normalizeBook(s) {
    let t = s.trim().toLowerCase()
      .replace(/^(first|1st|i)\s+/, '1 ').replace(/^(second|2nd|ii)\s+/, '2 ').replace(/^(third|3rd|iii)\s+/, '3 ');
    return norm(t);
  }
  function findBook(s) {
    const k = normalizeBook(s);
    if (!k) return -1;
    if (k in ALIAS) return ALIAS[k];
    const hit = NAMES.findIndex(n => norm(n).startsWith(k));
    return hit;
  }

  /* Returns { b, c, v1, v2 } (v1/v2 null means the whole chapter) or null. */
  function parse(ref) {
    if (!ref) return null;
    const m = String(ref).trim().match(/^(\d?\s*[A-Za-z][A-Za-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/);
    if (!m) {
      const b = findBook(String(ref));
      return b >= 0 ? { b, c: 1, v1: null, v2: null } : null;
    }
    const b = findBook(m[1]);
    if (b < 0) return null;
    let c = +m[2];
    if (CHAPTERS[b] === 1 && m[3] === undefined) return { b, c: 1, v1: c, v2: c }; // "Jude 24"
    if (c < 1 || c > CHAPTERS[b]) return null;
    const v1 = m[3] ? +m[3] : null;
    let v2 = m[4] ? +m[4] : v1;
    if (v1 && v2 < v1) v2 = v1;
    return { b, c, v1, v2 };
  }

  function refString(b, c, v1, v2) {
    let s = `${NAMES[b]} ${c}`;
    if (v1) s += `:${v1}${v2 && v2 !== v1 ? '-' + v2 : ''}`;
    return s;
  }

  /* Look up a reference. Resolves to { ref, b, c, v1, v2, verses: [[n, text]] } */
  async function lookup(refText) {
    const r = parse(refText);
    if (!r) throw new Error('I could not understand that reference. Try e.g. "John 3:16" or "Psalm 23".');
    const book = await load(r.b);
    const ch = book[r.c - 1];
    let v1 = r.v1 || 1, v2 = r.v2 || ch.length;
    if (v1 > ch.length) throw new Error(`${NAMES[r.b]} ${r.c} has only ${ch.length} verses.`);
    v2 = Math.min(v2, ch.length);
    const verses = [];
    for (let v = v1; v <= v2; v++) verses.push([v, ch[v - 1]]);
    return { ref: refString(r.b, r.c, r.v1 ? v1 : null, r.v1 ? v2 : null), b: r.b, c: r.c, v1, v2, verses };
  }

  function text(b, c, v) { return cache[b] && cache[b][c - 1] ? cache[b][c - 1][v - 1] : undefined; }

  /* Search the whole Bible. Loads every book the first time. */
  async function search(query, { limit = 400, onProgress, testament } = {}) {
    const q = query.trim();
    if (q.length < 2) return { results: [], total: 0 };
    await loadAll(onProgress);
    const words = q.toLowerCase().replace(/[’']/g, "'").split(/\s+/).filter(Boolean);
    const phrase = /^".*"$/.test(q) ? q.slice(1, -1).toLowerCase() : null;
    const results = [];
    let total = 0;
    for (let b = 0; b < 66; b++) {
      if (testament === 'OT' && b > 38) break;
      if (testament === 'NT' && b < 39) continue;
      const book = cache[b];
      for (let c = 0; c < book.length; c++) {
        for (let v = 0; v < book[c].length; v++) {
          const t = book[c][v].toLowerCase().replace(/’/g, "'");
          const ok = phrase ? t.includes(phrase) : words.every(w => t.includes(w));
          if (ok) { total++; if (results.length < limit) results.push({ b, c: c + 1, v: v + 1, text: book[c][v] }); }
        }
      }
    }
    return { results, total, words: phrase ? [phrase] : words };
  }

  window.Bible = { NAMES, SHORT, CHAPTERS, _add, load, loadAll, parse, lookup, refString, text, search, isLoaded: i => !!cache[i], key: (b, c, v) => `${b}.${c}.${v}` };
})();
