/*
 * Bible Voices: several people read the Bible aloud verse by verse, the app records each verse,
 * and the recordings play back in their own voices when the Bible is read aloud.
 * Recordings are kept on this device (IndexedDB). To combine readers from different phones,
 * each person exports their recordings to a file and the others import it.
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const B = () => window.Bible;
  const UI = () => window.UI;
  const MS = () => window.MediaStore;
  const TOTAL = 31102;
  const key = (b, c, v) => `${b}.${c}.${v}`;

  /* ---------------- Readers ---------------- */
  const V = () => (state.voices = state.voices || { readers: [], current: '', prefer: '', use: true });
  function readers() {
    const v = V();
    if (!v.readers.length) {
      const n = (window.Personal && window.Personal.name()) || 'Reader 1';
      v.readers.push({ id: MS().uid('r'), name: n }); v.current = v.readers[0].id; save();
    }
    if (!v.readers.some(r => r.id === v.current)) v.current = v.readers[0].id;
    return v.readers;
  }
  const reader = id => readers().find(r => r.id === id) || { id, name: 'Reader' };
  const currentReader = () => reader(V().current);

  /* ---------------- The index of recordings (metadata only; audio is loaded when played) ---------------- */
  let index = null;   // key -> [meta]
  async function loadIndex(force) {
    if (index && !force) return index;
    index = {};
    try { (await MS().list('voices')).forEach(m => { (index[m.key] = index[m.key] || []).push(m); }); } catch (e) { /* storage unavailable */ }
    return index;
  }
  const has = (b, c, v) => !!(index && index[key(b, c, v)] && index[key(b, c, v)].length);
  /* which recording of a verse to play: the preferred reader's if there is one, else the newest */
  function pick(b, c, v) {
    const list = index && index[key(b, c, v)];
    if (!list || !list.length) return null;
    const pref = V().prefer;
    return (pref && list.filter(m => m.readerId === pref).sort((a, z) => z.at - a.at)[0]) || list.slice().sort((a, z) => z.at - a.at)[0];
  }
  const useRecordings = () => V().use !== false;

  /* ---------------- Playback ---------------- */
  let audio = null, audioUrl = null, playToken = 0;
  function stopAll() { playToken++; if (audio) { audio.pause(); audio.onended = audio.onerror = null; } }
  /* Play one recording; resolves true when it finished, false if it failed or was stopped. */
  async function play(meta) {
    stopAll();
    const my = ++playToken;
    let rec;
    try { rec = await MS().get('voices', meta.id); } catch (e) { rec = null; }
    if (my !== playToken) return false;
    if (!rec || !rec.blob) return false;
    if (!audio) audio = new Audio();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(rec.blob);
    audio.src = audioUrl;
    return new Promise(res => {
      audio.onended = () => res(my === playToken);
      audio.onerror = () => res(false);
      audio.play().catch(() => res(false));
    });
  }

  /* ---------------- Recording studio ---------------- */
  const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  function bestType() {
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }
  /* the next verse after (b, c, v) in Bible order */
  function after(b, c, v) {
    const n = B().text(b, c, v + 1) !== undefined ? [b, c, v + 1] : c < B().CHAPTERS[b] ? [b, c + 1, 1] : b < 65 ? [b + 1, 1, 1] : null;
    return n;
  }
  /* the first verse from the start of the Bible (or from b, c) that nobody has recorded yet */
  async function nextUnrecorded(fromB = 0, fromC = 1) {
    await loadIndex();
    for (let b = fromB; b < 66; b++) {
      const book = await B().load(b);
      for (let c = b === fromB ? fromC : 1; c <= book.length; c++) for (let v = 1; v <= book[c - 1].length; v++) if (!has(b, c, v)) return [b, c, v];
    }
    return null;
  }

  let stream = null, rec = null, chunks = [], meterRaf = 0, take = null, startedAt = 0;
  function stopMic() {
    cancelAnimationFrame(meterRaf);
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* stopped */ } }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  async function studio(b, c, v, opts = {}) {
    await Promise.all([B().load(b), loadIndex()]);
    readers();
    take = null;
    const t = B().text(b, c, v);
    if (t === undefined) { toast('That verse does not exist'); return; }
    const existing = (index[key(b, c, v)] || []).slice().sort((a, z) => z.at - a.at);
    const html = `
      <div class="studio">
        <div class="eyebrow">🎙️ Bible Voices · recording</div>
        <div class="st-who">Reader: <select class="search" id="stReader">${readers().map(r => `<option value="${r.id}" ${r.id === V().current ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}<option value="__new">＋ Add a reader…</option></select></div>
        <h2>${esc(B().refString(b, c, v, v))}</h2>
        <p class="st-verse">${esc(t).replace(/LORD/g, '<span class="sc">Lord</span>')}</p>
        ${existing.length ? `<p class="muted small">Already recorded by ${existing.map(m => esc(reader(m.readerId).name)).join(', ')}. You can add your own reading too.</p>` : ''}
        ${canRecord() ? `
        <div class="st-meter"><i id="stLevel"></i></div>
        <div class="st-controls">
          <button class="st-rec" id="stRec" aria-label="Record">●</button>
          <span class="st-time" id="stTime">Tap ● and read the verse aloud</span>
        </div>
        <div class="row center gap wrap hidden" id="stAfter">
          <button class="btn ghost" id="stPlay">▶ Listen back</button>
          <button class="btn ghost" id="stRedo">↺ Record again</button>
          <button class="btn primary" id="stSave">✓ Save${opts.chain === false ? '' : ' & next verse'}</button>
        </div>` : `<p class="muted">Recording with the microphone is not available here. Record the verse with your phone's voice recorder, then add the file:</p>`}
        <div class="row center gap wrap">
          <label class="btn ghost small">📂 Use an audio file<input type="file" id="stFile" accept="audio/*" hidden></label>
          ${opts.chain === false ? '' : '<button class="btn ghost small" id="stSkip">Skip this verse →</button>'}
        </div>
        <p class="muted small">Read clearly, at a calm pace. Recordings stay on this phone; export them from Bible Voices to share.</p>
      </div>`;
    if (document.querySelector('#modal:not(.hidden) .studio')) $('#modalBody').innerHTML = html; else UI().openModal(html, { cls: 'parchment' });
    UI().onModalClose(() => { stopMic(); stopAll(); if (UI().current() === 'grow') window.Grow.render(); if (UI().current() === 'bible' && window.Reader.refreshVoices) window.Reader.refreshVoices(); });
    const goNext = () => { const n = after(b, c, v); if (n && opts.chain !== false) studio(n[0], n[1], n[2], opts); else UI().closeModal(); };
    const keep = async (blob, type, dur) => {
      try {
        await MS().put('voices', { id: MS().uid('vc'), key: key(b, c, v), b, c, v, ver: 'kjv', readerId: V().current, type, size: blob.size, dur, at: Date.now(), blob });
        MS().persist();
        await loadIndex(true);
        Sound.play('correct');
        const done = Object.keys(index).length;
        if (done === 1 || done % 50 === 0) toast(`🎙️ ${done.toLocaleString()} verse${done === 1 ? '' : 's'} recorded so far`);
        if (!window.Core.today().voice) window.Core.addXP(10, 'Bible Voices');
        window.Core.today().voice = true; save();
        return true;
      } catch (e) { toast('Not enough space on this phone to save the recording'); return false; }
    };
    $('#stReader').addEventListener('change', async e => {
      if (e.target.value === '__new') {
        const n = await askName();
        if (n) { const r = { id: MS().uid('r'), name: n }; V().readers.push(r); V().current = r.id; save(); }
        studio(b, c, v, opts); return;
      }
      V().current = e.target.value; save();
    });
    $('#stFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      if (await keep(f, f.type, 0)) { toast('✓ Saved'); goNext(); }
    });
    const skip = $('#stSkip'); if (skip) skip.addEventListener('click', goNext);
    if (!canRecord()) return;
    const recBtn = $('#stRec'), time = $('#stTime');
    recBtn.addEventListener('click', async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (err) { time.textContent = err && err.name === 'NotAllowedError' ? 'Please allow the microphone for this app, then try again.' : 'The microphone could not be opened.'; return; }
      stopAll();
      const type = bestType();
      rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
      chunks = [];
      rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onstop = () => {
        const dur = (Date.now() - startedAt) / 1000;
        take = { blob: new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }), type: rec.mimeType || type, dur };
        stopMic();
        recBtn.classList.remove('on'); recBtn.textContent = '●';
        time.textContent = `Recorded ${dur.toFixed(1)} seconds`;
        $('#stAfter').classList.remove('hidden');
      };
      rec.start(250); startedAt = Date.now();
      recBtn.classList.add('on'); recBtn.textContent = '■'; $('#stAfter').classList.add('hidden');
      // level meter and timer
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an);
        const d = new Uint8Array(an.fftSize);
        const tick = () => {
          an.getByteTimeDomainData(d);
          let peak = 0; for (const x of d) peak = Math.max(peak, Math.abs(x - 128));
          const el = $('#stLevel'); if (el) el.style.width = Math.min(100, peak / 128 * 160) + '%';
          if ($('#stTime') && rec && rec.state === 'recording') $('#stTime').textContent = `Recording… ${((Date.now() - startedAt) / 1000).toFixed(1)} s · tap ■ to stop`;
          if (rec && rec.state === 'recording') meterRaf = requestAnimationFrame(tick); else ac.close();
        };
        tick();
      } catch (err) { /* no meter */ }
    });
    $('#stPlay').addEventListener('click', () => {
      if (!take) return;
      if (!audio) audio = new Audio();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(take.blob); audio.src = audioUrl; audio.play().catch(() => {});
    });
    $('#stRedo').addEventListener('click', () => { take = null; $('#stAfter').classList.add('hidden'); recBtn.click(); });
    $('#stSave').addEventListener('click', async () => { if (take && await keep(take.blob, take.type, take.dur)) goNext(); });
  }
  function askName() {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'ask-overlay';
      box.innerHTML = `<form class="ask-card"><p><b>New reader</b></p><input class="search" id="rdName" maxlength="40" placeholder="Name" required>
        <div class="row end gap"><button type="button" class="btn ghost" data-a="0">Cancel</button><button class="btn primary">Add</button></div></form>`;
      document.body.appendChild(box);
      const done = v => { box.remove(); resolve(v); };
      box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); done(box.querySelector('#rdName').value.trim()); });
      box.querySelector('[data-a="0"]').addEventListener('click', () => done(''));
      setTimeout(() => box.querySelector('#rdName').focus(), 50);
    });
  }

  /* ---------------- Sharing between phones: export and import ---------------- */
  const b64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
  async function exportFile(filter) {
    const metas = (await MS().list('voices')).filter(filter || (() => true));
    if (!metas.length) { toast('There are no recordings to export'); return; }
    toast(`Preparing ${metas.length} recording${metas.length === 1 ? '' : 's'}…`);
    const items = [];
    for (const m of metas) { const r = await MS().get('voices', m.id); if (r && r.blob) items.push(Object.assign({}, m, { reader: reader(m.readerId).name, audio: await b64(r.blob) })); }
    const data = JSON.stringify({ app: 'lamp-and-path', kind: 'bible-voices', version: 1, exported: Date.now(), items });
    const blob = new Blob([data], { type: 'application/json' });
    const name = `bible-voices-${window.Core.dateKey()}-${items.length}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Bible Voices recordings' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
    toast(`💾 Saved ${name} (${MS().size(blob.size)}). Send it to the other readers.`);
  }
  async function importFile(f) {
    let data;
    try { data = JSON.parse(await f.text()); } catch (e) { toast('That is not a Bible Voices file'); return; }
    if (!data || data.kind !== 'bible-voices' || !Array.isArray(data.items)) { toast('That is not a Bible Voices file'); return; }
    await loadIndex();
    const have = new Set(Object.values(index).flat().map(m => m.id));
    let added = 0;
    for (const it of data.items) {
      if (have.has(it.id) || !it.audio || !it.key) continue;
      // match the reader by name, adding them if they are new to this phone
      let r = readers().find(x => x.name.toLowerCase() === String(it.reader || 'Reader').toLowerCase());
      if (!r) { r = { id: it.readerId || MS().uid('r'), name: String(it.reader || 'Reader').slice(0, 40) }; V().readers.push(r); }
      const bin = atob(it.audio), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: it.type || 'audio/webm' });
      try { await MS().put('voices', { id: it.id, key: it.key, b: it.b, c: it.c, v: it.v, ver: it.ver || 'kjv', readerId: r.id, type: it.type, size: blob.size, dur: it.dur || 0, at: it.at || Date.now(), blob }); added++; }
      catch (e) { toast('Not enough space on this phone for all the recordings'); break; }
    }
    save(); MS().persist();
    await loadIndex(true);
    toast(added ? `🎙️ Added ${added} recording${added === 1 ? '' : 's'}` : 'These recordings were already on this phone');
  }

  /* ---------------- The Bible Voices page (in Grow) ---------------- */
  async function render(host) {
    host.innerHTML = '<p class="muted">Loading…</p>';
    await loadIndex(true);
    readers();
    const metas = Object.values(index).flat();
    const verses = Object.keys(index).length;
    const byReader = {}; metas.forEach(m => { byReader[m.readerId] = (byReader[m.readerId] || 0) + 1; });
    const byBook = new Array(66).fill(0); Object.keys(index).forEach(k => byBook[+k.split('.')[0]]++);
    const VERSES_IN = [1533, 1213, 859, 1288, 959, 658, 618, 85, 810, 695, 816, 719, 942, 822, 280, 406, 167, 1070, 2461, 915, 222, 117, 1292, 1364, 154, 1273, 357, 197, 73, 146, 21, 48, 105, 47, 56, 53, 38, 211, 55, 1071, 678, 1151, 879, 1007, 433, 437, 257, 149, 155, 104, 95, 89, 47, 113, 83, 46, 25, 303, 108, 105, 61, 105, 13, 14, 25, 404];
    const size = metas.reduce((a, m) => a + (m.size || 0), 0);
    const next = await nextUnrecorded();
    host.innerHTML = `
      <p class="muted">Read the whole Bible aloud together, verse by verse. Each verse you record plays in your own voice whenever the Bible is read aloud in this app. Family, friends or a church group can share the work.</p>
      <section class="plan-now vb-progress">
        <div class="plan-head"><div><div class="eyebrow">🎙️ Bible Voices</div><h2>${verses.toLocaleString()} <span class="muted">of ${TOTAL.toLocaleString()} verses</span></h2></div>
          <div class="plan-pct"><b>${(verses / TOTAL * 100).toFixed(verses && verses / TOTAL < 0.01 ? 2 : 1)}%</b><small>${metas.length.toLocaleString()} recording${metas.length === 1 ? '' : 's'} · ${MS().size(size)}</small></div></div>
        <div class="track-bar"><i style="width:${Math.max(verses ? 0.5 : 0, verses / TOTAL * 100)}%"></i></div>
        <div class="row gap wrap">
          ${next ? `<button class="btn primary" id="vbNext">🎙️ Continue: ${esc(B().refString(next[0], next[1], next[2], next[2]))}</button>` : '<span class="pill ok">🎉 The whole Bible is recorded!</span>'}
          <button class="btn ghost" id="vbChoose">📖 Record a chapter I choose</button>
        </div>
        ${canRecord() ? '' : '<p class="muted small">This browser cannot use the microphone here. You can still add recordings made with your phone’s voice recorder.</p>'}
      </section>
      <h2 class="section-title">Readers</h2>
      <div class="vb-readers">${readers().map(r => `<div class="vb-reader ${r.id === V().current ? 'on' : ''}"><b>${esc(r.name)}</b><small>${(byReader[r.id] || 0).toLocaleString()} verse${byReader[r.id] === 1 ? '' : 's'}</small>
        ${r.id === V().current ? '<span class="pill ok">Recording as</span>' : `<button class="btn ghost small" data-use="${r.id}">Record as</button>`}</div>`).join('')}
        <button class="btn ghost small" id="vbAdd">＋ Add a reader</button></div>
      <label class="flabel" for="vbPrefer">When a verse has several readings, play</label>
      <select class="search" id="vbPrefer"><option value="">The newest reading</option>${readers().map(r => `<option value="${r.id}" ${V().prefer === r.id ? 'selected' : ''}>${esc(r.name)}'s reading, when there is one</option>`).join('')}</select>
      <label class="check-row"><input type="checkbox" id="vbUse" ${useRecordings() ? 'checked' : ''}> Use recorded voices when the Bible is read aloud</label>
      <h2 class="section-title">Books</h2>
      <div class="vb-books">${B().NAMES.map((n, i) => `<button class="vb-book" data-b="${i}" title="${esc(n)}: ${byBook[i]} of ${VERSES_IN[i]} verses" style="--p:${byBook[i] / VERSES_IN[i]}"><span>${esc(B().SHORT[i])}</span><small>${byBook[i] ? Math.max(1, Math.round(byBook[i] / VERSES_IN[i] * 100)) + '%' : ''}</small></button>`).join('')}</div>
      <h2 class="section-title">Share with other readers</h2>
      <p class="muted small">Recordings are kept on this phone. To put everyone's readings together, each reader exports their recordings and sends the file (for example by WhatsApp); the others import it.</p>
      <div class="row gap wrap">
        <button class="btn ghost" id="vbExportMine">📤 Export ${esc(currentReader().name)}'s recordings</button>
        <button class="btn ghost" id="vbExportAll">📤 Export all recordings</button>
        <label class="btn ghost">📥 Import recordings<input type="file" id="vbImport" accept="application/json,.json" hidden></label>
      </div>`;
    const go = id => host.querySelector(id);
    if (go('#vbNext')) go('#vbNext').addEventListener('click', () => studio(next[0], next[1], next[2]));
    go('#vbChoose').addEventListener('click', () => { toast('Choose a chapter, then tap a verse and 🎙️ Record'); window.Reader.open(V().lastB || 42, V().lastC || 1); });
    host.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => { V().current = b.dataset.use; save(); render(host); }));
    go('#vbAdd').addEventListener('click', async () => { const n = await askName(); if (n) { const r = { id: MS().uid('r'), name: n }; V().readers.push(r); V().current = r.id; save(); render(host); } });
    go('#vbPrefer').addEventListener('change', e => { V().prefer = e.target.value; save(); });
    go('#vbUse').addEventListener('change', e => { V().use = e.target.checked; save(); });
    host.querySelectorAll('.vb-book').forEach(el => el.addEventListener('click', async () => {
      const b = +el.dataset.b, n = await nextUnrecorded(b, 1);
      if (n && n[0] === b) studio(n[0], n[1], n[2]); else { toast(`${B().NAMES[b]} is fully recorded`); window.Reader.open(b, 1); }
    }));
    go('#vbExportMine').addEventListener('click', () => { const id = V().current; exportFile(m => m.readerId === id); });
    go('#vbExportAll').addEventListener('click', () => exportFile());
    go('#vbImport').addEventListener('change', async e => { const f = e.target.files[0]; if (f) { await importFile(f); render(host); } });
  }

  /* chapter marks for the reader: which verses have recordings */
  async function chapterMarks(b, c) {
    await loadIndex();
    V().lastB = b; V().lastC = c;
    const out = {};
    Object.keys(index).forEach(k => { const [kb, kc, kv] = k.split('.').map(Number); if (kb === b && kc === c) out[kv] = index[k].length; });
    return out;
  }
  async function playVerse(b, c, v) { await loadIndex(); const m = pick(b, c, v); if (m) { toast(`🎙️ ${reader(m.readerId).name}`); play(m); } }

  window.Voices = { busy: () => !!(audio && !audio.paused), render, studio, loadIndex, has, pick, play, stopAll, useRecordings, chapterMarks, playVerse, reader, exportFile, importFile, canRecord };
})();
