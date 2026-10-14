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
  const OPT_DEFAULTS = { ver: 'kjv', par: '', orig: false, gloss: true, cont: true, sleep: 0, page: 'parchment', font: 'serif', spacing: 'normal', layout: 'flow', voice: '', rate: 0.95, ambient: '' };
  const PAGES = [['parchment', 'Parchment'], ['white', 'White'], ['sepia', 'Sepia'], ['night', 'Night']];
  const FONTS = [['serif', 'Garamond'], ['classic', 'Georgia'], ['sans', 'Clean sans'], ['readable', 'Easy to read']];
  const SPACING = [['compact', 'Compact', 1.6], ['normal', 'Normal', 1.85], ['roomy', 'Roomy', 2.2]];
  const hlName = k => ((state.hlLabels || {})[k] || '').trim() || (COLORS.find(c => c[0] === k) || [, , k])[2];
  const opts = () => {
    const o = state.readerOpts || (state.readerOpts = {});
    if ('web' in o) { if (o.web && !o.par) o.par = 'web'; delete o.web; }   // older setting: modern English side by side
    Object.keys(OPT_DEFAULTS).forEach(k => { if (!(k in o)) o[k] = OPT_DEFAULTS[k]; });
    const has = id => B().VERSIONS.some(v => v.id === id);   // a single-file copy may not hold every version
    if (!has(o.ver)) o.ver = 'kjv';
    if (o.par && !has(o.par)) o.par = '';
    return o;
  };
  // a version that does not have this book yet is read in the KJV
  const ver = () => { const o = opts(); return B().hasBook(o.ver, cur.b) ? o.ver : 'kjv'; };
  const vtext = (b, c, v) => B().verText(ver(), b, c, v);
  const abbr = () => B().version(ver()).abbr;
  const MISSING = 'This verse is not in the manuscripts this translation follows.';
  // very common words that need no underline every time they appear
  const GLOSS_SKIP = new Set(['hath', 'doth', 'saith', 'lest', 'verily', 'spake', 'thereof', 'therein', 'wherefore', 'abide']);
  function kjvHTML(t) {
    let h = esc(t);
    if (ver() === 'lpa') h = h.replace(/\[([^\]]+)\]/g, '<span class="amp">[$1]</span>');   // the fuller meanings, set apart
    if (opts().gloss && window.GLOSSARY && (ver() === 'kjv' || ver() === 'webster')) {
      h = h.replace(/\b([A-Za-z]+)\b/g, w => {
        const k = w.toLowerCase();
        return window.GLOSSARY[k] && !GLOSS_SKIP.has(k) ? `<span class="gw" data-w="${k}">${w}</span>` : w;
      });
    }
    return h.replace(/LORD/g, '<span class="sc">Lord</span>');
  }
  let continueListening = false, sleepUntil = 0, wakeLock = null;

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
          <button class="ver-chip" id="bVer" title="Choose a Bible version">${esc(B().version(opts().ver).abbr)} ▾</button>
          <button class="icon-btn sm" id="bListen" title="Listen to this chapter">🔊</button>
          <button class="icon-btn sm" id="bOpts" title="Text size, modern English, sleep timer">Aa</button>
        </div>
      </div>
      <div class="bible-scroll" id="bibleScroll">
        <article class="chapter" id="chapter" style="font-size:${state.bibleFont}rem"><p class="muted">Loading…</p></article>
        <div class="ch-nav">
          <button class="btn ghost" id="prevCh">← Previous</button>
          <button class="btn ghost" id="nextCh">Next →</button>
        </div>
        <p class="muted small center kjv-note" id="kjvNote">King James Version · public domain</p>
      </div>
      <div class="sel-bar hidden" id="selBar"></div>`;
    $('#bkPick').addEventListener('click', openPicker);
    $('#bSearch').addEventListener('click', () => openSearch());
    $('#bMarks').addEventListener('click', () => openMarks());
    $('#bListen').addEventListener('click', toggleListen);
    $('#bOpts').addEventListener('click', openOptions);
    $('#bVer').addEventListener('click', openVersions);
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
    applyLook();
    $('#bkName').textContent = `${B().NAMES[b]} ${c}`;
    $('#prevCh').disabled = b === 0 && c === 1;
    $('#nextCh').disabled = b === 65 && c === B().CHAPTERS[65];
    let book;
    const o = opts();
    try {
      book = await B().loadVersion(ver(), b);
      await B().load(b);   // the KJV is always kept for highlights and notes
      if (o.par && o.par !== ver()) await B().loadVersion(o.par, b).catch(() => null);
      if (o.orig) await window.Orig.load(b).catch(() => null);
      if (window.Voices) await window.Voices.loadIndex().catch(() => null);
    } catch (e) { art.innerHTML = `<p class="muted">${esc(e.message)}</p><button class="btn ghost" id="retryLoad">Try again</button>`; $('#retryLoad').onclick = () => drawChapter(); return; }
    if (cur.b !== b || cur.c !== c) return; // navigated away while loading
    const verses = book[c - 1];
    const par = o.par && o.par !== ver() && B().verText(o.par, b, c, 1) !== undefined;
    const orig = o.orig && window.Orig.isLoaded(b);
    const main = B().version(ver()), side = par ? B().version(o.par) : null;
    const notYet = o.ver !== ver() ? `<p class="ver-notyet">The ${esc(B().version(o.ver).name)} ${(bs => bs.length === 27 && bs[0] === 39 ? 'has the New Testament so far' : bs.length <= 4 ? `has ${bs.map(x => esc(B().NAMES[x])).join(', ')} so far` : `does not have ${esc(B().NAMES[cur.b])} yet (${bs.length} books so far)`)(B().version(o.ver).books)}. Here is the KJV.</p>` : '';
    art.innerHTML = `
      <h1 class="ch-title"><span class="ch-book">${esc(B().NAMES[b])}</span><span class="ch-num">${c}</span></h1>
      ${c === 1 && window.OVERVIEWS ? `<button class="about-book" id="aboutBook"><span>ℹ️</span><span><b>About ${esc(B().NAMES[b])}</b><small>${esc((t => t.indexOf(':') > 0 && t.indexOf(':') < 40 ? t.split(':')[0] : t.slice(0, 60).replace(/\s+\S*$/, '') + '…')(window.OVERVIEWS[b].theme))} · ${esc(window.OVERVIEWS[b].author)}</small></span><span>›</span></button>` : ''}
      ${par || orig ? `<div class="par-key"><span>${esc(main.abbr)}</span>${side ? `<span class="w">${esc(side.abbr)} · ${esc(side.name)}</span>` : ''}${orig ? `<span class="o">${b < 39 ? 'Hebrew' : 'Greek'} · tap a word</span>` : ''}</div>` : ''}
      ${notYet}
      <p class="verses${par || orig ? ' parallel' : ''}">${verses.map((t, i) => verseSpan(b, c, i + 1, t)).join(' ')}</p>
      <div class="read-done-row" id="readRow"></div>`;
    $('#bVer').textContent = main.abbr + ' ▾';
    if ($('#kjvNote')) $('#kjvNote').textContent = [main, side].filter(Boolean).map(v => `${v.name} (${v.year})`).join(' and ') + ([main, side].some(v => v && v.id === 'lpa') ? ' · LPA is our own study rendering, made with AI help from public-domain sources' : ' · public domain') + (orig ? ` · ${b < 39 ? 'Hebrew: Westminster Leningrad Codex' : 'Greek: Robinson-Pierpont Byzantine text'}` : '');
    drawReadRow();
    const ab = $('#aboutBook'); if (ab) ab.addEventListener('click', () => window.Study.overview(b));
    art.querySelectorAll('.v').forEach(el => el.addEventListener('click', e => verseClick(e, el)));
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
    if (continueListening) { continueListening = false; startListen(true); }
  }

  function verseClick(e, el) {
    if (e.target.classList.contains('note-ic')) { openNote(+el.dataset.v); return; }
    const g = e.target.closest('.gw');
    if (g) { glossPop(g); return; }
    if (e.target.closest('.vc-ic')) { window.Voices.playVerse(cur.b, cur.c, +el.dataset.v); return; }
    const ow = e.target.closest('.ow');
    if (ow) { window.Orig.openWord(cur.b, cur.c, +el.dataset.v, +ow.dataset.wi); return; }
    const v = +el.dataset.v;
    sel.has(v) ? sel.delete(v) : sel.add(v);
    el.classList.toggle('selected', sel.has(v));
    Sound.play('tap');
    updateSelBar();
  }

  /* The meaning of an old word, in a small bubble. */
  function glossPop(el) {
    const old = document.querySelector('.gloss-pop'); if (old) old.remove();
    const pop = document.createElement('div');
    pop.className = 'gloss-pop';
    pop.innerHTML = `<b>${esc(el.textContent)}</b> means <span>${esc(window.GLOSSARY[el.dataset.w])}</span>`;
    document.body.appendChild(pop);
    const r = el.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    const above = r.top > 120;
    pop.style.top = (above ? r.top - 10 : r.bottom + 10) + 'px';
    pop.classList.add(above ? 'above' : 'below');
    Sound.play('tap');
    const close = ev => { if (ev && ev.target === el) return; pop.remove(); document.removeEventListener('click', close, true); };
    setTimeout(() => document.addEventListener('click', close, true), 0);
    setTimeout(() => { if (pop.isConnected) close(); }, 6000);
  }

  /* "I've read this chapter", and what to read next. */
  function drawReadRow() {
    const row = $('#readRow');
    if (!row || !window.Grow) return;
    const { b, c } = cur;
    const last = state.readLog && state.readLog[`${b}.${c}`];
    const today = last && window.Core.dateKey(new Date(last)) === window.Core.dateKey();
    const nxt = window.Grow.nextInPlan(b, c);
    const inPlanToday = (() => { const st = window.Grow.planStatus(); return st && st.days[st.next].some(([pb, pc]) => pb === b && pc === c); })();
    row.innerHTML = today
      ? `<div class="read-done">✓ Read today</div>${nxt ? `<button class="btn primary" id="readNext">Next in your plan: ${esc(B().NAMES[nxt[0]])} ${nxt[1]} →</button>` : ''}`
      : `<button class="btn primary big" id="readDone">✓ I've read this chapter</button>${last ? `<small class="muted">Last read ${new Date(last).toLocaleDateString()}</small>` : ''}${inPlanToday ? '<small class="muted">Part of today\'s reading plan</small>' : ''}`;
    if (window.Connect && window.Connect.canShare()) {
      const t = document.createElement('button'); t.className = 'btn ghost'; t.id = 'talkBtn'; t.textContent = '💬 Discuss this chapter with the group';
      t.addEventListener('click', () => window.Connect.discuss(b, c)); row.appendChild(t);
    }
    const d = $('#readDone');
    if (d) d.addEventListener('click', () => { window.Grow.markRead(b, c); drawReadRow(); });
    const n = $('#readNext');
    if (n) n.addEventListener('click', () => open(nxt[0], nxt[1]));
  }

  function verseSpan(b, c, v, t) {
    const k = B().key(b, c, v);
    const h = state.highlights[k];
    const n = state.verseNotes[k];
    const o = opts();
    const web = o.par && o.par !== ver() ? B().verText(o.par, b, c, v) : undefined;
    const orig = o.orig && window.Orig.isLoaded(b) ? window.Orig.lineHTML(b, c, v) : '';
    const body = t ? kjvHTML(t) : `<span class="v-missing">${MISSING}</span>`;
    const bm = (state.bookmarks || {})[k] ? '<span class="bm-ic" title="Bookmarked">🔖</span>' : '';
    const vc = window.Voices && window.Voices.has(b, c, v) ? '<button class="vc-ic" title="Play the recorded reading" aria-label="Play the recorded reading of verse ' + v + '">🎙️</button>' : '';
    return `<span class="v${h ? ' hl-' + h.color : ''}" data-v="${v}"><sup>${v}</sup>${bm}${body}${n ? '<span class="note-ic" title="View note">📝</span>' : ''}${vc}${web !== undefined && o.par ? `<span class="v-web">${web ? esc(web).replace(/\[([^\]]+)\]/g, '<span class="amp">[$1]</span>') : `<i>${MISSING}</i>`}</span>` : ''}${orig}</span>`;
  }

  function refreshVerse(v) {
    const el = document.querySelector(`#chapter .v[data-v="${v}"]`);
    if (!el) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = verseSpan(cur.b, cur.c, v, vtext(cur.b, cur.c, v));
    const nu = tmp.firstChild;
    if (sel.has(v)) nu.classList.add('selected');
    el.replaceWith(nu);
    nu.addEventListener('click', e => verseClick(e, nu));
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
  function selText() { return [...sel].sort((a, b) => a - b).map(v => vtext(cur.b, cur.c, v) || B().text(cur.b, cur.c, v)).join(' '); }

  /* The verse menu: highlight colours, Note, Pray this, Share card, Copy, and More (everything else). */
  let moreUse = {};
  try { moreUse = JSON.parse(localStorage.getItem('lamp-verse-more') || '{}'); } catch (e) { moreUse = {}; }
  function moreItems() {
    const items = [
      ['sXref', '🔗 Cross-refs'], ['sCmp', '📚 Compare'], ['sOrig', `🔤 ${cur.b < 39 ? 'Hebrew' : 'Greek'}`], ['sMem', '🧠 Memorize'],
      ['sSoap', '✍️ Journal'], ['sBm', `🔖 ${(state.bookmarks || {})[B().key(cur.b, cur.c, Math.min(...sel))] ? 'Remove bookmark' : 'Bookmark'}`],
      ['sRec', '🎙️ Record'], ['sListen', '🔊 Listen']
    ];
    if (window.Connect && window.Connect.canAsk()) items.push(['sAsk', '✨ Ask']);
    return items.map((x, i) => [...x, i]).sort((a, b) => (moreUse[b[0]] || 0) - (moreUse[a[0]] || 0) || a[2] - b[2]);
  }
  function updateSelBar() {
    const bar = $('#selBar');
    if (!bar) return;
    if (!sel.size) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = `
      <div class="sel-ref">${esc(selRef())}</div>
      <div class="sel-colors">${COLORS.map(([k, hex]) => `<button class="swatch" data-c="${k}" style="--sw:${hex}" title="Highlight: ${esc(hlName(k))}" aria-label="Highlight: ${esc(hlName(k))}"></button>`).join('')}
        <button class="swatch clear" data-c="" title="Remove highlight">⌫</button></div>
      <div class="sel-actions">
        <button class="btn ghost small" id="sNote">📝 Note</button>
        <button class="btn ghost small" id="sPray">🙏 Pray this</button>
        <button class="btn ghost small" id="sCard">🖼️ Share card</button>
        <button class="btn ghost small" id="sCopy">📋 Copy</button>
        <button class="btn ghost small" id="sMore" aria-expanded="false">⋯ More</button>
        <button class="btn ghost small sel-x" id="sClose" aria-label="Close">✕</button>
      </div>
      <div class="sel-more hidden" id="selMore">${moreItems().map(([id, label]) => `<button class="btn ghost small" id="${id}" data-more="${id}">${label}</button>`).join('')}</div>`;
    bar.querySelectorAll('.swatch').forEach(s => s.addEventListener('click', () => highlight(s.dataset.c)));
    $('#sMore').addEventListener('click', () => { const m = $('#selMore'), open = m.classList.toggle('hidden'); $('#sMore').setAttribute('aria-expanded', String(!open)); });
    // the More sheet keeps the most used actions first (counted on this phone)
    bar.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', () => { moreUse[b.dataset.more] = (moreUse[b.dataset.more] || 0) + 1; try { localStorage.setItem('lamp-verse-more', JSON.stringify(moreUse)); } catch (e) { /* not kept */ } }, true));
    $('#sNote').addEventListener('click', () => openNote(Math.min(...sel)));
    $('#sCopy').addEventListener('click', copySel);
    const sa = $('#sAsk'); if (sa) sa.addEventListener('click', () => { const r = selRef(), t = selText(); clearSel(); window.Connect.ask({ ref: r, text: t }); });
    $('#sRec').addEventListener('click', () => { const v = Math.min(...sel); clearSel(); window.Voices.studio(cur.b, cur.c, v); });
    $('#sXref').addEventListener('click', () => { const v = Math.min(...sel); clearSel(); window.Study.crossRefs(cur.b, cur.c, v); });
    $('#sBm').addEventListener('click', () => {
      const v = Math.min(...sel), k = B().key(cur.b, cur.c, v);
      state.bookmarks = state.bookmarks || {};
      if (state.bookmarks[k]) { delete state.bookmarks[k]; toast('Bookmark removed'); }
      else { state.bookmarks[k] = { at: Date.now(), ref: `${B().NAMES[cur.b]} ${cur.c}:${v}`, text: (vtext(cur.b, cur.c, v) || B().text(cur.b, cur.c, v) || '').slice(0, 200) }; toast('🔖 Bookmarked'); }
      save(); Sound.play('tap'); refreshVerse(v); clearSel();
    });
    $('#sOrig').addEventListener('click', () => { const vs = [...sel].sort((a, b) => a - b).slice(0, 6); clearSel(); window.Orig.interlinear(cur.b, cur.c, vs); });
    $('#sCmp').addEventListener('click', () => { const vs = [...sel].sort((a, b) => a - b).slice(0, 4); clearSel(); compare(cur.b, cur.c, vs); });
    const contiguous = () => { const vs = [...sel].sort((a, b) => a - b); return vs[vs.length - 1] - vs[0] === vs.length - 1; };
    const rangeRef = () => { const vs = [...sel].sort((a, b) => a - b); return B().refString(cur.b, cur.c, vs[0], vs[vs.length - 1]); };
    $('#sCard').addEventListener('click', () => { const r = selRef(), t = selText(); clearSel(); window.Cards.verse(r, t); });
    $('#sMem').addEventListener('click', async () => {
      if (!contiguous()) { toast('Select verses that are next to each other'); return; }
      if (await window.Grow.addMemory(rangeRef())) clearSel();
    });
    $('#sSoap').addEventListener('click', () => { const r = contiguous() ? rangeRef() : selRef(); clearSel(); window.Grow.soapEditor(null, r); });
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
    const txt = `"${selText()}" (${selRef()}, ${abbr()})`;
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
    const text = sel.size ? selText() : (vtext(cur.b, cur.c, v) || B().text(cur.b, cur.c, v));
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
        ${window.OVERVIEWS ? '<button class="btn ghost small" id="bkAbout">ℹ️ About this book</button>' : ''}
        <div class="ch-grid">${Array.from({ length: n }, (_, i) => `<button class="ch-btn ${b === cur.b && i + 1 === cur.c ? 'active' : ''}" data-c="${i + 1}">${i + 1}</button>`).join('')}</div>
      </div>`;
    $('#backBk').addEventListener('click', openPicker);
    const ab = $('#bkAbout'); if (ab) ab.addEventListener('click', () => window.Study.overview(b));
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
    const bms = Object.entries(state.bookmarks || {}).sort((a, b) => b[1].at - a[1].at);
    const html = `
      <div class="marks">
        <div class="eyebrow">My Bible</div>
        <div class="seg"><button class="seg-btn ${marksTab === 'hl' ? 'active' : ''}" data-t="hl">🖍️ Highlights (${Object.keys(state.highlights).length})</button><button class="seg-btn ${marksTab === 'notes' ? 'active' : ''}" data-t="notes">📝 Notes (${notes.length})</button><button class="seg-btn ${marksTab === 'bm' ? 'active' : ''}" data-t="bm">🔖 Bookmarks (${bms.length})</button></div>
        ${marksTab === 'hl' ? `
          <div class="chips filter"><button class="chip ${!marksColor ? 'active' : ''}" data-col="">All</button>${COLORS.map(([k, hex]) => `<button class="chip ${marksColor === k ? 'active' : ''}" data-col="${k}"><i class="dotc" style="background:${hex}"></i>${esc(hlName(k))}</button>`).join('')}<button class="chip" id="hlNames">✏️ Name colours</button></div>
          <div class="results">${hl.length ? hl.map(([k, h]) => { const [b, c, v] = parseKey(k); return `<button class="result-item hlitem" data-k="${k}" style="--hc:${(COLORS.find(x => x[0] === h.color) || COLORS[0])[1]}"><b>${esc(B().NAMES[b])} ${c}:${v}</b><span>${lordHTML(h.text || '')}</span></button>`; }).join('') : '<p class="muted center">No highlights yet. In the Bible, tap a verse and choose a colour.</p>'}</div>`
        : marksTab === 'bm' ? `<div class="results">${bms.length ? bms.map(([k, m]) => `<button class="result-item" data-k="${k}"><b>🔖 ${esc(m.ref)}</b><span>${lordHTML(m.text || '')}</span></button>`).join('') : '<p class="muted center">No bookmarks yet. Tap a verse, then 🔖 Bookmark.</p>'}</div>`
        : `<div class="results">${notes.length ? notes.map(([k, n]) => `<button class="result-item" data-k="${k}"><b>${esc(n.ref)}</b><span class="note-txt">${esc(n.text)}</span><span class="muted small">${lordHTML((n.verseText || '').slice(0, 140))}${(n.verseText || '').length > 140 ? '…' : ''}</span></button>`).join('') : '<p class="muted center">No notes yet. Tap a verse, then 📝 Note.</p>'}</div>`}
      </div>`;
    if (document.querySelector('#modal.open .marks')) $('#modalBody').innerHTML = html; else UI().openModal(html);
    $$('.marks .seg-btn').forEach(b => b.addEventListener('click', () => { marksTab = b.dataset.t; openMarks(); }));
    $$('.marks [data-col]').forEach(b => b.addEventListener('click', () => { marksColor = b.dataset.col; openMarks(); }));
    const hn = $('#hlNames'); if (hn) hn.addEventListener('click', nameColours);
    $$('.marks .result-item').forEach(el => el.addEventListener('click', () => { const [b, c, v] = parseKey(el.dataset.k); UI().closeModal(); open(b, c, v); }));
  }

  /* Give each highlight colour a meaning, e.g. yellow = promises. */
  function nameColours() {
    const L = state.hlLabels || {};
    $('#modalBody').innerHTML = `
      <div class="pform marks">
        <div class="eyebrow">My Bible</div>
        <h2>What does each colour mean to you?</h2>
        <p class="muted small">For example: yellow for promises, green for commands, blue for prayers, pink for God's love, purple for prophecy.</p>
        ${COLORS.map(([k, hex, n]) => `<div class="hl-name-row"><i class="dotc big" style="background:${hex}"></i><input class="search" data-k="${k}" maxlength="24" placeholder="${n}" value="${esc(L[k] || '')}"></div>`).join('')}
        <div class="row end gap"><button class="btn ghost" id="hlBack">Back</button><button class="btn primary" id="hlSave">Save</button></div>
      </div>`;
    $('#hlBack').addEventListener('click', openMarks);
    $('#hlSave').addEventListener('click', () => {
      state.hlLabels = {};
      document.querySelectorAll('#modalBody input[data-k]').forEach(i => { if (i.value.trim()) state.hlLabels[i.dataset.k] = i.value.trim(); });
      save(); toast('✓ Colour names saved'); openMarks();
    });
  }

  /* Page style: background, typeface, line spacing and layout. */
  function applyLook() {
    const o = opts(), art = $('#chapter'), page = $('#biblePage');
    if (!art) return;
    art.className = `chapter page-${o.page} font-${o.font} layout-${o.layout}`;
    art.style.lineHeight = (SPACING.find(x => x[0] === o.spacing) || SPACING[1])[2];
    if (page) page.classList.toggle('night', o.page === 'night');
  }

  /* ---------------- Listen (verse by verse, following along) ---------------- */
  function toggleListen() { reading ? stopListen() : startListen(); }
  let speakGen = 0;   // each utterance gets a number, so events from a cancelled one are ignored
  function startListen(continuing) {
    if (!('speechSynthesis' in window)) { toast('Read-aloud is not supported on this device'); return; }
    const { b, c } = cur;
    if (vtext(b, c, 1) === undefined) return;
    reading = { v: 1, b, c, paused: false };
    $('#bListen').textContent = '⏹';
    if (!continuing) sleepUntil = opts().sleep ? Date.now() + opts().sleep * 60000 : 0;
    keepAwake();
    window.Core.Speech.stopAll();
    if (opts().ambient && window.Ambient) window.Ambient.start(opts().ambient);
    if (opts().screen !== false) ListenScreen.show();
    if (window.Voices) window.Voices.loadIndex().then(speakVerse, speakVerse); else speakVerse();
  }
  /* Read the current verse, then move on. */
  function speakVerse() {
    if (!reading || reading.paused) return;
    const { b, c } = reading;
    if (reading.b !== cur.b || reading.c !== cur.c) return stopListen();
    if (sleepUntil && Date.now() >= sleepUntil) { stopListen(); toast('🌙 Sleep timer: reading stopped. Good night.'); return; }
    const t = vtext(b, c, reading.v);
    $$('#chapter .v.reading').forEach(x => x.classList.remove('reading'));
    if (t === undefined) {   // end of the chapter
      const last = b === 65 && c === B().CHAPTERS[65];
      if (opts().cont && !last) {
        const keep = sleepUntil;
        stopListen(true);
        sleepUntil = keep;
        continueListening = true;
        step(1);
        return;
      }
      return stopListen();
    }
    if (!t) { reading.v++; return speakVerse(); }   // a verse this translation leaves out
    const el = document.querySelector(`#chapter .v[data-v="${reading.v}"]`);
    if (el) { el.classList.add('reading'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    ListenScreen.update();
    const gen = ++speakGen;
    // a verse someone has recorded plays in their own voice; the phone's voice reads the rest
    const recd = window.Voices && window.Voices.useRecordings() && window.Voices.pick(b, c, reading.v);
    if (recd) {
      ListenScreen.voice(window.Voices.reader(recd.readerId).name);
      window.Voices.play(recd).then(ok => {
        if (gen !== speakGen || !reading || reading.paused) return;
        if (ok) { reading.v++; speakVerse(); } else { speakGen++; ttsVerse(b, c, t, speakGen); }
      });
      return;
    }
    ListenScreen.voice('');
    ttsVerse(b, c, t, gen);
  }
  function ttsVerse(b, c, t, gen) {
    // the chapter is announced first, with a pause before the first verse
    const text = (reading.v === 1 ? `${B().NAMES[b]}, chapter ${c}. ` : '') + t;
    window.Core.Speech.read(text, {}, () => { if (gen !== speakGen || !reading || reading.paused) return; reading.v++; speakVerse(); });
  }
  // a short clip read elsewhere in the app (or the phone) took the voice: pause, so the reading can carry on from here
  window.Core.Speech.onReaderInterrupted(() => { if (reading && !reading.paused) { reading.paused = true; speakGen++; if (window.Voices) window.Voices.stopAll(); ListenScreen.update(); } });
  function pauseListen() {
    if (!reading || reading.paused) return;
    reading.paused = true; speakGen++;
    if (window.Voices) window.Voices.stopAll();
    window.Core.Speech.stopAll();
    ListenScreen.update();
  }
  function resumeListen() {
    if (!reading || !reading.paused) return;
    reading.paused = false; keepAwake();
    speakVerse();
  }
  /* Jump to another verse: d = -1 or +1 */
  function skipVerse(d) {
    if (!reading) return;
    reading.v = Math.max(1, Math.min(countVerses(), reading.v + d));
    speakGen++; window.Core.Speech.stopAll(); if (window.Voices) window.Voices.stopAll();
    if (!reading.paused) speakVerse(); else ListenScreen.update();
  }
  const countVerses = () => { let n = 0; while (vtext(reading.b, reading.c, n + 1) !== undefined) n++; return n; };
  /* Keep the screen awake while reading; phones release this when the app is hidden, so ask again on return. */
  function keepAwake() {
    if (!wakeLock && navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener && l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !reading) return;
    keepAwake();
    // if the phone silenced the voice while hidden, carry on from the same verse
    if (!reading.paused && window.Core.Speech.owner() !== 'reader' && !(window.Voices && window.Voices.busy())) { speakGen++; speakVerse(); }
  });
  function stopListen(continuing) {
    if (!reading) return;
    reading = null;
    sleepUntil = 0;
    speakGen++;
    if (!continuing && wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    window.Core.Speech.stopAll();
    if (window.Voices) window.Voices.stopAll();
    $$('#chapter .v.reading').forEach(x => x.classList.remove('reading'));
    const b = $('#bListen'); if (b) b.textContent = '🔊';
    if (!continuing) ListenScreen.hide();
  }

  /* ---------------- The listening screen ----------------
   * A dark, dim screen while the Bible is read aloud: the verse being read, a clock, and big controls.
   * It keeps the phone awake with little light, for the bedside, the car or a pocket. */
  const ListenScreen = (() => {
    let el = null, dimTimer = null, clockTimer = null, hidden = false;
    const fmt = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    function wake() {
      if (!el) return;
      el.classList.remove('dim');
      clearTimeout(dimTimer);
      dimTimer = setTimeout(() => el && el.classList.add('dim'), 12000);
    }
    function show() {
      hidden = false;
      if (el) { update(); wake(); return; }
      el = document.createElement('div');
      el.className = 'listen-screen';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Listening');
      el.innerHTML = `
        <div class="ls-top"><span class="ls-clock" id="lsClock"></span><span class="ls-sleep" id="lsSleep"></span></div>
        <div class="ls-main">
          <div class="ls-ref" id="lsRef"></div>
          <div class="ls-voice" id="lsVoice"></div>
          <p class="ls-verse" id="lsVerse"></p>
          <div class="ls-prog"><i id="lsProg"></i></div>
        </div>
        <div class="ls-controls">
          <button class="ls-btn" id="lsPrev" aria-label="Previous verse">⏮</button>
          <button class="ls-btn big" id="lsPlay" aria-label="Pause">⏸</button>
          <button class="ls-btn" id="lsNext" aria-label="Next verse">⏭</button>
        </div>
        <div class="ls-row">
          <button class="ls-small" id="lsMusic">🎵 Music</button>
          <button class="ls-small" id="lsTimer">🌙 Sleep timer</button>
          <button class="ls-small" id="lsPage">📖 Show the page</button>
          <button class="ls-small stop" id="lsStop">⏹ Stop</button>
        </div>
        <p class="ls-hint">Keep this screen open: phones stop reading aloud when the screen locks. It dims by itself to save battery; tap to brighten.</p>`;
      document.body.appendChild(el);
      document.body.classList.add('listening');
      el.addEventListener('pointerdown', wake);
      el.querySelector('#lsPlay').addEventListener('click', () => { reading && reading.paused ? resumeListen() : pauseListen(); update(); });
      el.querySelector('#lsPrev').addEventListener('click', () => skipVerse(-1));
      el.querySelector('#lsNext').addEventListener('click', () => skipVerse(1));
      el.querySelector('#lsStop').addEventListener('click', () => stopListen());
      el.querySelector('#lsPage').addEventListener('click', () => { hidden = true; el.classList.add('away'); showPill(); });
      el.querySelector('#lsMusic').addEventListener('click', () => window.Ambient && window.Ambient.openPanel());
      el.querySelector('#lsTimer').addEventListener('click', cycleTimer);
      clockTimer = setInterval(tick, 15000);
      tick(); update(); wake();
    }
    function cycleTimer() {
      const steps = [0, 10, 20, 30, 60];
      const left = sleepUntil ? Math.round((sleepUntil - Date.now()) / 60000) : 0;
      const nextMin = steps.find(m => m > left) || 0;
      sleepUntil = nextMin ? Date.now() + nextMin * 60000 : 0;
      toast(nextMin ? `🌙 Reading will stop in ${nextMin} minutes` : 'Sleep timer off');
      tick();
    }
    function tick() {
      if (!el) return;
      el.querySelector('#lsClock').textContent = fmt(new Date());
      const left = sleepUntil ? Math.max(0, Math.ceil((sleepUntil - Date.now()) / 60000)) : 0;
      el.querySelector('#lsSleep').textContent = left ? `🌙 ${left} min left` : '';
      el.querySelector('#lsTimer').textContent = left ? `🌙 ${left} min` : '🌙 Sleep timer';
    }
    function update() {
      const pill = document.getElementById('listenPill');
      if (pill) pill.querySelector('.lp-t').textContent = reading ? `${B().NAMES[reading.b]} ${reading.c}:${reading.v}` : '';
      if (!el || !reading) return;
      const t = vtext(reading.b, reading.c, reading.v) || '';
      const n = countVerses();
      el.querySelector('#lsRef').textContent = `${B().NAMES[reading.b]} ${reading.c}:${reading.v} · ${B().version(ver()).abbr}`;
      el.querySelector('#lsVerse').innerHTML = lordHTML(t);
      el.querySelector('#lsProg').style.width = (n ? reading.v / n * 100 : 0) + '%';
      el.querySelector('#lsPlay').textContent = reading.paused ? '▶' : '⏸';
      el.querySelector('#lsPlay').setAttribute('aria-label', reading.paused ? 'Resume' : 'Pause');
      el.classList.toggle('paused', !!reading.paused);
      tick();
    }
    /* a small bar to come back to the listening screen while looking at the page */
    function showPill() {
      if (document.getElementById('listenPill')) return;
      const p = document.createElement('div');
      p.id = 'listenPill'; p.className = 'listen-pill';
      p.innerHTML = `<button class="lp-open">🔊 <span class="lp-t"></span></button><button class="lp-stop" aria-label="Stop reading">⏹</button>`;
      document.body.appendChild(p);
      p.querySelector('.lp-open').addEventListener('click', () => { hidden = false; p.remove(); el && el.classList.remove('away'); wake(); });
      p.querySelector('.lp-stop').addEventListener('click', () => stopListen());
      update();
    }
    function hide() {
      clearTimeout(dimTimer); clearInterval(clockTimer);
      document.body.classList.remove('listening');
      if (el) { el.classList.add('closing'); const e = el; setTimeout(() => e.remove(), 300); el = null; }
      const p = document.getElementById('listenPill'); if (p) p.remove();
    }
    const voice = name => { const v = el && el.querySelector('#lsVoice'); if (v) v.textContent = name ? `🎙️ Read by ${name}` : ''; };
    return { show: () => { if (!hidden) show(); else update(); }, update, hide, voice };
  })();

  /* ---------------- Reading options ---------------- */
  function openOptions() {
    const o = opts();
    const sw = (id, on, label, sub) => `<label class="opt-row"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i class="switch"></i></label>`;
    UI().openModal(`
      <div class="pform reader-opts">
        <div class="eyebrow">Reading</div>
        <h2>Aa · Reading options</h2>
        <div class="opt-row"><span><b>Text size</b><small id="fontVal">${Math.round(state.bibleFont * 100)}%</small></span>
          <span class="row gap"><button class="icon-btn sm" id="bSmaller" title="Smaller text">A−</button><button class="icon-btn sm" id="bBigger" title="Larger text">A+</button></span></div>
        <h3 class="section-title">Page</h3>
        <label class="flabel">Page colour</label>
        <div class="seg small wrap-seg" id="oPage">${PAGES.map(([k, l]) => `<button class="seg-btn ${o.page === k ? 'active' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
        <label class="flabel">Typeface</label>
        <div class="seg small wrap-seg" id="oFont">${FONTS.map(([k, l]) => `<button class="seg-btn ${o.font === k ? 'active' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
        <label class="flabel">Line spacing</label>
        <div class="seg small wrap-seg" id="oSpacing">${SPACING.map(([k, l]) => `<button class="seg-btn ${o.spacing === k ? 'active' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
        <label class="flabel">Layout</label>
        <div class="seg small wrap-seg" id="oLayout"><button class="seg-btn ${o.layout === 'flow' ? 'active' : ''}" data-v="flow">Paragraph</button><button class="seg-btn ${o.layout === 'verse' ? 'active' : ''}" data-v="verse">Verse by verse</button></div>
        <h3 class="section-title">Version</h3>
        <div class="opt-row" id="oVerRow"><span><b>Reading</b><small>${esc(B().version(o.ver).name)} (${esc(B().version(o.ver).year)})</small></span><button class="btn ghost small" id="oVer">Change</button></div>
        <label class="flabel" for="oPar">Side by side</label>
        <select class="search" id="oPar"><option value="">Nothing (one version)</option>${B().VERSIONS.map(v => `<option value="${v.id}" ${o.par === v.id ? 'selected' : ''}>${esc(v.abbr)} · ${esc(v.name)}</option>`).join('')}</select>
        <h3 class="section-title">Understanding the text</h3>
        ${sw('oOrig', o.orig, 'Hebrew and Greek under each verse', 'The original-language words. Tap any word for its meaning, grammar and every place it is used')}
        ${sw('oGloss', o.gloss, 'Explain old KJV words', 'Old words like "shew" and "charity" are underlined. Tap one to see its meaning')}
        <h3 class="section-title">Listening</h3>
        ${sw('oCont', o.cont, 'Keep reading into the next chapter', 'Listen through a whole book')}
        ${sw('oScreen', o.screen !== false, 'Listening screen', 'A dim screen with big controls while reading aloud, for the bedside or the car')}
        <label class="flabel" for="oVoice">Voice</label>
        <select class="search" id="oVoice"></select>
        <small class="muted" id="oVoiceNote"></small>
        <details class="voice-help"><summary>🗣️ Get a more natural, human-sounding voice</summary>
          <p class="muted small">Phones come with a plain voice and keep far better ones as free downloads. After adding one, choose it above (★).</p>
          <ul class="muted small">
            <li><b>Android:</b> Settings → search “Text-to-speech” → Preferred engine: <b>Speech Services by Google</b> → ⚙️ → Install voice data → English → download a voice, then pick it in Speech Services (the voices marked high quality sound most natural).</li>
            <li><b>iPhone / iPad:</b> Settings → Accessibility → Spoken Content → Voices → English → choose a voice marked <b>Enhanced</b> or <b>Premium</b> and tap to download.</li>
            <li><b>Windows:</b> open the app in Microsoft Edge: its <b>Natural</b> voices (Aria, Guy, Sonia…) appear here by themselves.</li>
            <li><b>Mac:</b> System Settings → Accessibility → Spoken Content → System voice → Manage voices → download a Premium or Enhanced English voice.</li>
          </ul>
          <p class="muted small">For a real human voice, record readings with family or church in <b>Grow → Worship & voices → Bible Voices</b>: recorded verses always play in that person’s voice.</p>
        </details>
        <label class="flabel">Speed</label>
        <div class="seg small wrap-seg" id="oRate">${[[0.75, 'Slow'], [0.95, 'Normal'], [1.15, 'Brisk'], [1.4, 'Fast']].map(([r, l]) => `<button class="seg-btn ${Math.abs((o.rate || 0.95) - r) < 0.01 ? 'active' : ''}" data-v="${r}">${l}</button>`).join('')}</div>
        <div class="opt-row"><span><b>🎵 Background music</b><small>${o.ambient && window.Ambient.track(o.ambient) ? 'Plays while you listen: ' + esc(window.Ambient.track(o.ambient)[2]) : 'Calm piano, running stream, hymns and more'}</small></span><button class="btn ghost small" id="oMusic">Choose</button></div>
        <div class="row gap"><button class="btn ghost small" id="oTry">▶ Try the voice</button></div>
        <div class="opt-row"><span><b>🌙 Sleep timer</b><small>Stop reading aloud after a while</small></span></div>
        <div class="seg small" id="oSleep">${[0, 10, 20, 30, 60].map(m => `<button class="seg-btn ${o.sleep === m ? 'active' : ''}" data-m="${m}">${m ? m + ' min' : 'Off'}</button>`).join('')}</div>
        <div class="row end gap wrap">${reading ? '' : '<button class="btn ghost" id="oListen">🔊 Start listening</button>'}<button class="btn primary" data-close>Done</button></div>
      </div>`);
    $('#bSmaller').addEventListener('click', () => { setFont(-0.1); $('#fontVal').textContent = Math.round(state.bibleFont * 100) + '%'; });
    $('#bBigger').addEventListener('click', () => { setFont(0.1); $('#fontVal').textContent = Math.round(state.bibleFont * 100) + '%'; });
    const redraw = () => { save(); const y = $('#bibleScroll') ? $('#bibleScroll').scrollTop : 0; drawChapter().then(() => { if ($('#bibleScroll')) $('#bibleScroll').scrollTop = y; }); };
    const pick = (id, key, num, after) => document.querySelectorAll(`#${id} .seg-btn`).forEach(btn => btn.addEventListener('click', () => {
      o[key] = num ? +btn.dataset.v : btn.dataset.v; save();
      document.querySelectorAll(`#${id} .seg-btn`).forEach(x => x.classList.toggle('active', x === btn));
      after && after();
    }));
    pick('oPage', 'page', false, applyLook);
    pick('oFont', 'font', false, applyLook);
    pick('oSpacing', 'spacing', false, applyLook);
    pick('oLayout', 'layout', false, applyLook);
    pick('oRate', 'rate', true);
    $('#oMusic').addEventListener('click', () => window.Ambient.openPanel());
    // phones often finish loading their voices a moment after the app opens, so fill the list when they arrive
    const fillVoices = () => {
      const sel = $('#oVoice'); if (!sel) return;
      const vs = window.Core.Speech.voices();
      sel.innerHTML = `<option value="">Best English voice on this device</option>` + vs.map(v => `<option value="${esc(v.name)}" ${o.voice === v.name ? 'selected' : ''}>${window.Core.Speech.natural(v) ? '★ ' : ''}${esc(v.name)} (${esc(v.lang)})</option>`).join('');
      $('#oVoiceNote').textContent = vs.length ? `${vs.length} English voice${vs.length === 1 ? '' : 's'} on this device. ★ marks natural-sounding ones.` : 'Loading voices…';
    };
    fillVoices();
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', fillVoices);
      UI().onModalClose(() => speechSynthesis.removeEventListener('voiceschanged', fillVoices));
      setTimeout(fillVoices, 800);
    }
    $('#oVoice').addEventListener('change', e => { o.voice = e.target.value; save(); toast(e.target.value ? `🔊 Voice: ${e.target.value}` : '🔊 Using the best voice on this device'); });
    $('#oTry').addEventListener('click', () => window.Core.Speech.speak('The LORD is my shepherd; I shall not want.'));
    $('#oPar').addEventListener('change', e => { o.par = e.target.value; redraw(); });
    $('#oOrig').addEventListener('change', e => { o.orig = e.target.checked; redraw(); });
    $('#oVer').addEventListener('click', openVersions);
    $('#oGloss').addEventListener('change', e => { o.gloss = e.target.checked; redraw(); });
    $('#oCont').addEventListener('change', e => { o.cont = e.target.checked; save(); });
    $('#oScreen').addEventListener('change', e => { o.screen = e.target.checked; save(); });
    document.querySelectorAll('#oSleep .seg-btn').forEach(btn => btn.addEventListener('click', () => {
      o.sleep = +btn.dataset.m; save();
      document.querySelectorAll('#oSleep .seg-btn').forEach(x => x.classList.toggle('active', x === btn));
      if (reading) sleepUntil = o.sleep ? Date.now() + o.sleep * 60000 : 0;
      toast(o.sleep ? `🌙 Reading aloud will stop after ${o.sleep} minutes` : 'Sleep timer off');
    }));
    const l = $('#oListen'); if (l) l.addEventListener('click', () => { UI().closeModal(); startListen(); });
  }

  /* ---------------- Versions ---------------- */
  function openVersions() {
    const o = opts();
    UI().openModal(`
      <div class="versions">
        <div class="eyebrow">Bible versions</div>
        <h2>Choose what to read</h2>
        <p class="muted small">All of these are free to read, share and keep offline: the published versions are in the public domain, and the LPA is our own.</p>
        <div class="ver-list">${B().VERSIONS.map(v => `<button class="ver-item ${o.ver === v.id ? 'active' : ''}" data-ver="${v.id}">
          <span class="ver-abbr">${esc(v.abbr)}</span><span class="ver-main"><b>${esc(v.name)}</b><small>${esc(v.year)} · ${esc(v.note)}</small></span>${o.ver === v.id ? '<span class="pill ok">Reading</span>' : ''}</button>`).join('')}</div>
        <div class="ver-orig"><b>🔤 Hebrew and Greek</b><p class="muted small">The Old Testament in Hebrew (Westminster Leningrad Codex) and the New Testament in Greek (Robinson-Pierpont Byzantine text), with Strong's dictionary. Turn it on in <b>Aa</b>, or tap verses and choose 🔤.</p></div>
      </div>`);
    document.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => {
      o.ver = b.dataset.ver; if (o.par === o.ver) o.par = ''; save();
      UI().closeModal(); Sound.play('tap');
      toast(`📖 Reading the ${B().version(o.ver).name}`);
      drawChapter();
    }));
  }

  /* The selected verses in every version, one under another. */
  async function compare(b, c, vs) {
    UI().openModal('<div class="compare"><p class="muted">Opening every version…</p></div>', { cls: 'parchment' });
    const loaded = await Promise.all(B().VERSIONS.map(v => B().loadVersion(v.id, b).then(() => true).catch(() => false)));
    if (!document.querySelector('#modal:not(.hidden) #modalBody .compare')) return;
    $('#modalBody').innerHTML = `
      <div class="compare">
        <div class="eyebrow">Compare versions</div>
        <h2>${esc(B().refString(b, c, vs[0], vs[vs.length - 1]))}</h2>
        ${B().VERSIONS.map((v, i) => loaded[i] ? `<div class="cmp-item"><div class="cmp-head"><b>${esc(v.abbr)}</b><span class="muted small">${esc(v.name)} (${esc(v.year)})</span></div>
          <p class="scripture">${vs.map(n => { const t = B().verText(v.id, b, c, n); return `${vs.length > 1 ? `<sup>${n}</sup>` : ''}${t ? lordHTML(t) : `<i class="muted">${MISSING}</i>`}`; }).join(' ')}</p></div>` : '').join('')}
        <div class="row gap wrap"><button class="btn ghost" id="cmpOrig">🔤 See the ${b < 39 ? 'Hebrew' : 'Greek'}</button></div>
      </div>`;
    $('#cmpOrig').addEventListener('click', () => window.Orig.interlinear(b, c, vs));
  }

  /* ---------------- Public ---------------- */
  function open(b, c, v1, v2) {
    cur = { b, c };
    state.bibleLast = { b, c }; save();
    if (UI().current() !== 'bible') { pendingFlash = [v1, v2]; UI().show('bible'); return; }
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

  window.Reader = { render, open, openRef, stop: stopListen, openSearch, refreshRow: () => drawReadRow(),
    refreshVoices: () => window.Voices && window.Voices.loadIndex(true).then(() => { if (!cur) return; $$('#chapter .v').forEach(el => refreshVerse(+el.dataset.v)); }) };
})();
