/* Bible reader: browse the full KJV, highlight, take notes, search, listen, and send verses to the prayer list. */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const B = () => window.Bible;
  const UI = () => window.UI;

  const COLORS = [
    ['yellow', '#ffe066', 'Yellow'], ['green', '#8ce99a', 'Green'], ['blue', '#74c0fc', 'Blue'],
    ['pink', '#faa2c1', 'Pink'], ['purple', '#b197fc', 'Purple']
  ];
  let cur = null;           // { b, c }
  const sel = new Set();    // selected verse numbers
  let reading = null;       // read-aloud state
  let pendingFlash = null;  // verses to flash on the next render

  const lordHTML = t => esc(t).replace(/LORD/g, '<span class="sc">Lord</span>');

  /* ---------------- Main view ---------------- */
  function render() {
    if (!cur) cur = Object.assign({ b: 0, c: 1 }, state.bibleLast);
    const host = $('#biblePage');
    host.innerHTML = `
      <div class="bible-bar">
        <button class="bk-pick" id="bkPick"><span id="bkName">${esc(B().NAMES[cur.b])} ${cur.c}</span> <span class="caret">▾</span></button>
        <div class="bar-actions">
          <button class="icon-btn sm" id="bSearch" title="Search the Bible">🔍</button>
          <button class="icon-btn sm" id="bMarks" title="My highlights &amp; notes">🖍️</button>
          <button class="icon-btn sm" id="bListen" title="Listen to this chapter">🔊</button>
          <button class="icon-btn sm" id="bSmaller" title="Smaller text">A−</button>
          <button class="icon-btn sm" id="bBigger" title="Larger text">A+</button>
        </div>
      </div>
      <div class="bible-scroll" id="bibleScroll">
        <article class="chapter" id="chapter" style="font-size:${state.bibleFont}rem"><p class="muted">Loading…</p></article>
        <div class="ch-nav">
          <button class="btn ghost" id="prevCh">← Previous</button>
          <button class="btn ghost" id="nextCh">Next →</button>
        </div>
        <p class="muted small center kjv-note">King James Version · public domain</p>
      </div>
      <div class="sel-bar hidden" id="selBar"></div>`;
    $('#bkPick').addEventListener('click', openPicker);
    $('#bSearch').addEventListener('click', () => openSearch());
    $('#bMarks').addEventListener('click', () => openMarks());
    $('#bListen').addEventListener('click', toggleListen);
    $('#bSmaller').addEventListener('click', () => setFont(-0.1));
    $('#bBigger').addEventListener('click', () => setFont(0.1));
    $('#prevCh').addEventListener('click', () => step(-1));
    $('#nextCh').addEventListener('click', () => step(1));
    const f = pendingFlash || [];
    pendingFlash = null;
    drawChapter(f[0], f[1]);
  }

  function setFont(d) {
    state.bibleFont = Math.round(Math.min(1.9, Math.max(0.9, state.bibleFont + d)) * 10) / 10;
    save();
    const ch = $('#chapter'); if (ch) ch.style.fontSize = state.bibleFont + 'rem';
  }

  function step(d) {
    let { b, c } = cur;
    c += d;
    if (c < 1) { if (b === 0) return; b--; c = B().CHAPTERS[b]; }
    if (c > B().CHAPTERS[b]) { if (b === 65) return; b++; c = 1; }
    open(b, c);
  }

  async function drawChapter(flashFrom, flashTo) {
    stopListen();
    sel.clear(); updateSelBar();
    const { b, c } = cur;
    const art = $('#chapter');
    if (!art) return;
    $('#bkName').textContent = `${B().NAMES[b]} ${c}`;
    $('#prevCh').disabled = b === 0 && c === 1;
    $('#nextCh').disabled = b === 65 && c === B().CHAPTERS[65];
    let book;
    try { book = await B().load(b); } catch (e) { art.innerHTML = `<p class="muted">${esc(e.message)}</p><button class="btn ghost" id="retryLoad">Try again</button>`; $('#retryLoad').onclick = () => drawChapter(); return; }
    if (cur.b !== b || cur.c !== c) return; // navigated away while loading
    const verses = book[c - 1];
    art.innerHTML = `
      <h1 class="ch-title"><span class="ch-book">${esc(B().NAMES[b])}</span><span class="ch-num">${c}</span></h1>
      <p class="verses">${verses.map((t, i) => verseSpan(b, c, i + 1, t)).join(' ')}</p>`;
    art.querySelectorAll('.v').forEach(el => el.addEventListener('click', e => {
      if (e.target.classList.contains('note-ic')) { openNote(+el.dataset.v); return; }
      const v = +el.dataset.v;
      sel.has(v) ? sel.delete(v) : sel.add(v);
      el.classList.toggle('selected', sel.has(v));
      Sound.play('tap');
      updateSelBar();
    }));
    const scroller = $('#bibleScroll');
    if (flashFrom) {
      const el = art.querySelector(`.v[data-v="${flashFrom}"]`);
      if (el) {
        scroller.scrollTop = Math.max(0, el.offsetTop - 120);
        for (let v = flashFrom; v <= (flashTo || flashFrom); v++) {
          const x = art.querySelector(`.v[data-v="${v}"]`);
          if (x) { x.classList.add('flash'); setTimeout(() => x.classList.remove('flash'), 2600); }
        }
      }
    } else scroller.scrollTop = 0;
  }

  function verseSpan(b, c, v, t) {
    const k = B().key(b, c, v);
    const h = state.highlights[k];
    const n = state.verseNotes[k];
    return `<span class="v${h ? ' hl-' + h.color : ''}" data-v="${v}"><sup>${v}</sup>${lordHTML(t)}${n ? '<span class="note-ic" title="View note">📝</span>' : ''}</span>`;
  }

  function refreshVerse(v) {
    const el = document.querySelector(`#chapter .v[data-v="${v}"]`);
    if (!el) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = verseSpan(cur.b, cur.c, v, B().text(cur.b, cur.c, v));
    const nu = tmp.firstChild;
    if (sel.has(v)) nu.classList.add('selected');
    el.replaceWith(nu);
    nu.addEventListener('click', e => {
      if (e.target.classList.contains('note-ic')) { openNote(v); return; }
      sel.has(v) ? sel.delete(v) : sel.add(v);
      nu.classList.toggle('selected', sel.has(v));
      Sound.play('tap');
      updateSelBar();
    });
  }

  /* ---------------- Selection actions ---------------- */
  function selRef() {
    const vs = [...sel].sort((a, b) => a - b);
    if (!vs.length) return '';
    const parts = [];
    let start = vs[0], prev = vs[0];
    for (let i = 1; i <= vs.length; i++) {
      if (vs[i] === prev + 1) { prev = vs[i]; continue; }
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = prev = vs[i];
    }
    return `${B().NAMES[cur.b]} ${cur.c}:${parts.join(', ')}`;
  }
  function selText() { return [...sel].sort((a, b) => a - b).map(v => B().text(cur.b, cur.c, v)).join(' '); }

  function updateSelBar() {
    const bar = $('#selBar');
    if (!bar) return;
    if (!sel.size) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = `
      <div class="sel-ref">${esc(selRef())}</div>
      <div class="sel-colors">${COLORS.map(([k, hex, name]) => `<button class="swatch" data-c="${k}" style="--sw:${hex}" title="Highlight ${name}"></button>`).join('')}
        <button class="swatch clear" data-c="" title="Remove highlight">⌫</button></div>
      <div class="sel-actions">
        <button class="btn ghost small" id="sNote">📝 Note</button>
        <button class="btn ghost small" id="sPray">🙏 Pray this</button>
        <button class="btn ghost small" id="sCopy">📋 Copy</button>
        <button class="btn ghost small" id="sListen">🔊</button>
        <button class="btn ghost small" id="sClose">✕</button>
      </div>`;
    bar.querySelectorAll('.swatch').forEach(s => s.addEventListener('click', () => highlight(s.dataset.c)));
    $('#sNote').addEventListener('click', () => openNote(Math.min(...sel)));
    $('#sCopy').addEventListener('click', copySel);
    $('#sPray').addEventListener('click', () => window.PrayList.pickPersonFor({ ref: selRef(), text: selText() }));
    $('#sListen').addEventListener('click', () => window.Core.Speech.speak(selRef() + '. ' + selText()));
    $('#sClose').addEventListener('click', clearSel);
  }

  function clearSel() {
    sel.forEach(v => { const el = document.querySelector(`#chapter .v[data-v="${v}"]`); if (el) el.classList.remove('selected'); });
    sel.clear(); updateSelBar();
  }

  function highlight(color) {
    const vs = [...sel];
    vs.forEach(v => {
      const k = B().key(cur.b, cur.c, v);
      if (color) state.highlights[k] = { color, text: B().text(cur.b, cur.c, v), at: Date.now() };
      else delete state.highlights[k];
    });
    save();
    window.Core.checkBadges();
    Sound.play(color ? 'correct' : 'tap');
    vs.forEach(refreshVerse);
    clearSel();
    if (color) toast(`🖍️ Highlighted ${vs.length > 1 ? vs.length + ' verses' : 'verse'}`);
  }

  async function copySel() {
    const txt = `"${selText()}" (${selRef()}, KJV)`;
    try { await navigator.clipboard.writeText(txt); toast('📋 Copied'); }
    catch (e) {
      UI().openModal(`<div class="note-modal"><div class="eyebrow">Copy</div><h3>Select the text and copy it</h3><textarea class="notes" id="copyTxt" readonly>${esc(txt)}</textarea></div>`);
      const t = $('#copyTxt'); t.focus(); t.select();
    }
    clearSel();
  }

  function openNote(v) {
    const k = B().key(cur.b, cur.c, v);
    const existing = state.verseNotes[k];
    const ref = sel.size ? selRef() : `${B().NAMES[cur.b]} ${cur.c}:${v}`;
    const text = sel.size ? selText() : B().text(cur.b, cur.c, v);
    UI().openModal(`
      <div class="note-modal">
        <div class="eyebrow">Note</div>
        <h3>${esc(existing ? existing.ref : ref)}</h3>
        <blockquote class="scripture">${lordHTML(existing && existing.verseText ? existing.verseText : text)}</blockquote>
        <textarea id="vNote" class="notes" placeholder="What is God saying to you through this verse?">${esc(existing ? existing.text : '')}</textarea>
        <div class="row gap end">
          ${existing ? '<button class="btn ghost danger" id="vDel">Delete note</button>' : ''}
          <button class="btn primary" id="vSave">Save note</button>
        </div>
      </div>`, { cls: 'parchment' });
    setTimeout(() => $('#vNote') && $('#vNote').focus(), 50);
    $('#vSave').addEventListener('click', () => {
      const t = $('#vNote').value.trim();
      if (t) state.verseNotes[k] = { text: t, ref: existing ? existing.ref : ref, verseText: existing ? existing.verseText : text, at: Date.now() };
      else delete state.verseNotes[k];
      save();
      Sound.play('correct');
      UI().closeModal();
      if (cur.b === +k.split('.')[0] && cur.c === +k.split('.')[1]) { refreshVerse(v); clearSel(); }
      toast(t ? '📝 Note saved' : 'Note removed');
    });
    const del = $('#vDel');
    if (del) del.addEventListener('click', () => { delete state.verseNotes[k]; save(); UI().closeModal(); refreshVerse(v); toast('Note deleted'); });
  }

  /* ---------------- Book / chapter picker ---------------- */
  function openPicker() {
    const grid = (from, to) => B().NAMES.slice(from, to).map((n, i) => `<button class="bk-btn ${from + i === cur.b ? 'active' : ''}" data-b="${from + i}">${esc(n)}</button>`).join('');
    UI().openModal(`
      <div class="picker">
        <div class="eyebrow">Choose a book</div>
        <input class="search" id="bkFilter" placeholder="Type a book or reference, e.g. John 3:16">
        <h3 class="section-title">Old Testament</h3>
        <div class="bk-grid">${grid(0, 39)}</div>
        <h3 class="section-title">New Testament</h3>
        <div class="bk-grid nt">${grid(39, 66)}</div>
      </div>`);
    $$('.bk-btn').forEach(btn => btn.addEventListener('click', () => chapterPicker(+btn.dataset.b)));
    const f = $('#bkFilter');
    f.addEventListener('input', () => {
      const q = f.value.trim().toLowerCase();
      $$('.bk-btn').forEach(btn => { btn.style.display = !q || btn.textContent.toLowerCase().includes(q.replace(/\s*\d+.*$/, '')) ? '' : 'none'; });
    });
    f.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const r = B().parse(f.value);
      if (r) { UI().closeModal(); open(r.b, r.c, r.v1, r.v2); } else toast('Reference not recognised');
    });
  }

  function chapterPicker(b) {
    const n = B().CHAPTERS[b];
    if (n === 1) { UI().closeModal(); open(b, 1); return; }
    $('#modalBody').innerHTML = `
      <div class="picker">
        <button class="btn ghost small" id="backBk">← Books</button>
        <h2 class="picker-title">${esc(B().NAMES[b])}</h2>
        <p class="muted small">${esc(window.BOOKS[b][2])}</p>
        <div class="ch-grid">${Array.from({ length: n }, (_, i) => `<button class="ch-btn ${b === cur.b && i + 1 === cur.c ? 'active' : ''}" data-c="${i + 1}">${i + 1}</button>`).join('')}</div>
      </div>`;
    $('#backBk').addEventListener('click', openPicker);
    $$('.ch-btn').forEach(btn => btn.addEventListener('click', () => { UI().closeModal(); open(b, +btn.dataset.c); }));
  }

  /* ---------------- Search ---------------- */
  let lastQuery = '', lastScope = 'all';
  function openSearch(q) {
    UI().openModal(`
      <div class="bsearch">
        <div class="eyebrow">Search the whole Bible</div>
        <div class="search-row">
          <input class="search" id="sq" placeholder='Words, e.g. faith hope · or "exact phrase" · or a reference' value="${esc(q || lastQuery)}">
          <button class="btn primary" id="sGo">Search</button>
        </div>
        <div class="chips filter">${[['all', 'Whole Bible'], ['OT', 'Old Testament'], ['NT', 'New Testament']].map(([k, l]) => `<button class="chip ${lastScope === k ? 'active' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
        <div id="sProg" class="loading hidden"><div class="load-track"><i id="sBar"></i></div><small>Opening all 66 books… (only the first time)</small></div>
        <div id="sRes"></div>
      </div>`);
    const go = async () => {
      const query = $('#sq').value.trim();
      if (!query) return;
      lastQuery = query;
      const r = B().parse(query);
      if (r && /\d/.test(query)) { UI().closeModal(); open(r.b, r.c, r.v1, r.v2); return; }
      const needsLoad = B().NAMES.some((_, i) => !B().isLoaded(i));
      if (needsLoad) $('#sProg').classList.remove('hidden');
      $('#sRes').innerHTML = '';
      try {
        const res = await B().search(query, { testament: lastScope === 'all' ? null : lastScope, onProgress: p => { const bar = $('#sBar'); if (bar) bar.style.width = Math.round(p * 100) + '%'; } });
        if (!$('#sRes')) return;
        $('#sProg').classList.add('hidden');
        const rx = new RegExp('(' + res.words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
        $('#sRes').innerHTML = res.total
          ? `<p class="muted small">${res.total} verse${res.total === 1 ? '' : 's'} found${res.total > res.results.length ? ` · showing first ${res.results.length}` : ''}</p>
             <div class="results">${res.results.map(x => `<button class="result-item" data-b="${x.b}" data-c="${x.c}" data-v="${x.v}"><b>${esc(B().NAMES[x.b])} ${x.c}:${x.v}</b><span>${esc(x.text).replace(rx, '<mark>$1</mark>')}</span></button>`).join('')}</div>`
          : '<p class="muted center">No verses found. Try fewer or different words.</p>';
        $$('.result-item').forEach(el => el.addEventListener('click', () => { UI().closeModal(); open(+el.dataset.b, +el.dataset.c, +el.dataset.v); }));
      } catch (e) { $('#sProg').classList.add('hidden'); $('#sRes').innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    };
    $('#sGo').addEventListener('click', go);
    $('#sq').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    $$('.bsearch .chip').forEach(c => c.addEventListener('click', () => { lastScope = c.dataset.s; $$('.bsearch .chip').forEach(x => x.classList.toggle('active', x === c)); if ($('#sq').value.trim()) go(); }));
    setTimeout(() => $('#sq') && $('#sq').focus(), 50);
    if (q) go();
  }

  /* ---------------- Highlights & notes ---------------- */
  let marksTab = 'hl', marksColor = '';
  function openMarks() {
    const parseKey = k => k.split('.').map(Number);
    const hl = Object.entries(state.highlights).filter(([, h]) => !marksColor || h.color === marksColor).sort((a, b) => b[1].at - a[1].at);
    const notes = Object.entries(state.verseNotes).sort((a, b) => b[1].at - a[1].at);
    const html = `
      <div class="marks">
        <div class="eyebrow">My Bible</div>
        <div class="seg"><button class="seg-btn ${marksTab === 'hl' ? 'active' : ''}" data-t="hl">🖍️ Highlights (${Object.keys(state.highlights).length})</button><button class="seg-btn ${marksTab === 'notes' ? 'active' : ''}" data-t="notes">📝 Notes (${notes.length})</button></div>
        ${marksTab === 'hl' ? `
          <div class="chips filter"><button class="chip ${!marksColor ? 'active' : ''}" data-col="">All</button>${COLORS.map(([k, hex, n]) => `<button class="chip ${marksColor === k ? 'active' : ''}" data-col="${k}"><i class="dotc" style="background:${hex}"></i>${n}</button>`).join('')}</div>
          <div class="results">${hl.length ? hl.map(([k, h]) => { const [b, c, v] = parseKey(k); return `<button class="result-item hlitem" data-k="${k}" style="--hc:${(COLORS.find(x => x[0] === h.color) || COLORS[0])[1]}"><b>${esc(B().NAMES[b])} ${c}:${v}</b><span>${lordHTML(h.text || '')}</span></button>`; }).join('') : '<p class="muted center">No highlights yet. In the Bible, tap a verse and choose a colour.</p>'}</div>`
        : `<div class="results">${notes.length ? notes.map(([k, n]) => `<button class="result-item" data-k="${k}"><b>${esc(n.ref)}</b><span class="note-txt">${esc(n.text)}</span><span class="muted small">${lordHTML((n.verseText || '').slice(0, 140))}${(n.verseText || '').length > 140 ? '…' : ''}</span></button>`).join('') : '<p class="muted center">No notes yet. Tap a verse, then 📝 Note.</p>'}</div>`}
      </div>`;
    if (document.querySelector('.marks')) $('#modalBody').innerHTML = html; else UI().openModal(html);
    $$('.marks .seg-btn').forEach(b => b.addEventListener('click', () => { marksTab = b.dataset.t; openMarks(); }));
    $$('.marks [data-col]').forEach(b => b.addEventListener('click', () => { marksColor = b.dataset.col; openMarks(); }));
    $$('.marks .result-item').forEach(el => el.addEventListener('click', () => { const [b, c, v] = parseKey(el.dataset.k); UI().closeModal(); open(b, c, v); }));
  }

  /* ---------------- Listen (verse by verse, following along) ---------------- */
  function toggleListen() { reading ? stopListen() : startListen(); }
  function startListen() {
    if (!('speechSynthesis' in window)) { toast('Read-aloud is not supported on this device'); return; }
    const { b, c } = cur;
    if (!B().isLoaded(b)) return;
    reading = { v: 1, b, c };
    $('#bListen').textContent = '⏹';
    speechSynthesis.cancel();
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => /en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    const next = () => {
      if (!reading || reading.b !== cur.b || reading.c !== cur.c) return stopListen();
      const t = B().text(b, c, reading.v);
      $$('#chapter .v.reading').forEach(x => x.classList.remove('reading'));
      if (t === undefined) return stopListen();
      const el = document.querySelector(`#chapter .v[data-v="${reading.v}"]`);
      if (el) { el.classList.add('reading'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      const u = new SpeechSynthesisUtterance((reading.v === 1 ? `${B().NAMES[b]} chapter ${c}. ` : '') + t.replace(/LORD/g, 'Lord'));
      u.rate = 0.92; if (voice) u.voice = voice;
      u.onend = () => { if (reading) { reading.v++; next(); } };
      u.onerror = () => stopListen();
      speechSynthesis.speak(u);
    };
    next();
  }
  function stopListen() {
    if (!reading) return;
    reading = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    $$('#chapter .v.reading').forEach(x => x.classList.remove('reading'));
    const b = $('#bListen'); if (b) b.textContent = '🔊';
  }

  /* ---------------- Public ---------------- */
  function open(b, c, v1, v2) {
    cur = { b, c };
    state.bibleLast = { b, c }; save();
    if (!$('#chapter')) { pendingFlash = [v1, v2]; render(); }
    else drawChapter(v1, v2);
  }
  function openRef(ref) {
    const r = B().parse(ref);
    if (!r) return false;
    cur = { b: r.b, c: r.c };
    state.bibleLast = { b: r.b, c: r.c }; save();
    pendingFlash = [r.v1, r.v2];
    UI().show('bible');   // renders the chapter and flashes the verses
    return true;
  }

  window.Reader = { render, open, openRef, stop: stopListen, openSearch };
})();
