/*
 * Pray in my own language: prayers you write or record in your own language or dialect
 * (Pidgin, Ijaw, Igbo, Yoruba, Twi, ...), heard in your own voice.
 *  - one prayer is shown on the Daily page each day (the ones you choose)
 *  - a set can be shared with family or church as one small file, recordings included
 * Nothing is translated by machine and nothing is shipped: every prayer is the person's own.
 * Recordings live in IndexedDB (MediaStore 'mylang'); the words live in state.myLang.
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const UI = () => window.UI;
  const MS = () => window.MediaStore;
  const L = () => {
    if (!state.myLang || typeof state.myLang !== 'object') state.myLang = { name: '', prayers: [] };
    if (!Array.isArray(state.myLang.prayers)) state.myLang.prayers = [];
    return state.myLang;
  };
  const langName = () => (L().name || '').trim();
  const inLang = () => langName() ? `in ${esc(langName())}` : 'in my own language';

  /* ---------------- Playing a recording ---------------- */
  let audio = null, audioUrl = null;
  function stop() { if (audio) { audio.pause(); audio.currentTime = 0; } }
  async function playBlob(blob, btn) {
    if (window.Voices) window.Voices.stopAll();
    if (!audio) audio = new Audio();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audio.src = audioUrl;
    if (btn) { btn.textContent = '■ Stop'; audio.onended = audio.onpause = () => { btn.textContent = '▶ Listen'; }; }
    audio.play().catch(() => toast('This recording could not be played'));
  }
  async function playPrayer(p, btn) {
    if (audio && !audio.paused && btn && btn.textContent.startsWith('■')) { stop(); return; }
    const r = p.audioId && await MS().get('mylang', p.audioId).catch(() => null);
    if (r && r.blob) return playBlob(r.blob, btn);
    // no recording yet: read the words aloud with the phone's voice
    window.Core.Speech.speak(p.text);
  }

  /* ---------------- Recording ---------------- */
  const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  function bestType() {
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }
  let stream = null, rec = null, chunks = [], raf = 0, startedAt = 0;
  function stopMic() {
    cancelAnimationFrame(raf);
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* stopped */ } }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
  /* Wires the ● button; onTake receives { blob, type, dur } */
  function bindRecorder(btn, label, onTake) {
    btn.addEventListener('click', async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (err) { label.textContent = err && err.name === 'NotAllowedError' ? 'Please allow the microphone for this app, then try again.' : 'The microphone could not be opened.'; return; }
      stop();
      const type = bestType();
      rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
      chunks = [];
      rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onstop = () => {
        const dur = (Date.now() - startedAt) / 1000;
        const t = rec.mimeType || type || 'audio/webm';
        stopMic();
        btn.classList.remove('on'); btn.textContent = '●';
        onTake({ blob: new Blob(chunks, { type: t }), type: t, dur });
      };
      rec.start(250); startedAt = Date.now();
      btn.classList.add('on'); btn.textContent = '■';
      const tick = () => {
        if (!rec || rec.state !== 'recording') return;
        label.textContent = `Recording… ${((Date.now() - startedAt) / 1000).toFixed(0)} s · tap ■ to stop`;
        raf = requestAnimationFrame(tick);
      };
      tick();
    });
  }
  const dur = s => s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.max(1, Math.round(s))} s`;

  /* ---------------- The page (in a modal) ---------------- */
  function open() { UI().openModal('<div id="mlHost" class="mylang"></div>', { cls: 'mylang-modal', onClose: () => { stop(); stopMic(); } }); list(); }

  function list() {
    const host = $('#mlHost'); if (!host) return;
    const ps = L().prayers;
    host.innerHTML = `
      <div class="eyebrow">🗣️ Pray in my own language</div>
      <h2>${langName() ? esc(langName()) : 'My language'}</h2>
      <label class="ml-lang">The language I pray in
        <input class="search" id="mlLang" maxlength="40" placeholder="e.g. Pidgin, Ijaw, Igbo, Yoruba, Twi" value="${esc(langName())}"></label>
      <p class="muted small">Write or record prayers the way you pray at home. They play in your own voice, and the ones you choose appear on the Daily page, one each day.</p>
      <div class="row gap wrap"><button class="btn primary" id="mlNew">＋ New prayer</button></div>
      <div class="ml-list">${ps.length ? ps.map((p, i) => `
        <article class="ml-item" data-i="${i}">
          <div class="ml-top"><b>${esc(p.title || 'Prayer')}</b>${p.audioId ? ' <span class="ml-badge">🎙️</span>' : ''}${p.onDaily ? ' <span class="ml-badge">☀️ Daily</span>' : ''}</div>
          <p class="ml-text">${esc(p.text)}</p>
          ${p.ref ? `<p class="muted small">📖 ${esc(p.ref)}</p>` : ''}
          <div class="row gap wrap">
            <button class="btn ghost small" data-play="${i}">▶ Listen</button>
            <button class="btn ghost small" data-edit="${i}">✏️ Edit</button>
            <button class="btn ghost small" data-del="${i}">🗑️</button>
          </div>
        </article>`).join('') : '<p class="muted ml-empty">No prayers yet. Start with a short one: a thank-you, a blessing over your family, the Lord’s Prayer as your grandmother prayed it.</p>'}</div>
      <section class="ml-share">
        <h3>Share with family or church</h3>
        <p class="muted small">Send your prayers, with the recordings, as one file over WhatsApp or email. On the other phone, open this page and choose “Add a shared set”.</p>
        <div class="row gap wrap">
          <button class="btn ghost" id="mlExport" ${ps.length ? '' : 'disabled'}>📤 Share my prayers</button>
          <label class="btn ghost">📥 Add a shared set<input type="file" id="mlImport" accept=".json,application/json" hidden></label>
        </div>
      </section>`;
    $('#mlLang').addEventListener('change', e => { L().name = e.target.value.trim().slice(0, 40); save(); list(); refreshDaily(); });
    $('#mlNew').addEventListener('click', () => edit(-1));
    host.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => playPrayer(ps[+b.dataset.play], b)));
    host.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => edit(+b.dataset.edit)));
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const p = ps[+b.dataset.del];
      if (!(await UI().ask(`Delete “${p.title || 'this prayer'}”${p.audioId ? ' and its recording' : ''}?`, 'Delete'))) return;
      if (p.audioId) await MS().del('mylang', p.audioId).catch(() => {});
      ps.splice(ps.indexOf(p), 1); save(); list(); refreshDaily();
    }));
    $('#mlExport').addEventListener('click', exportPack);
    $('#mlImport').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) { await importPack(f); list(); refreshDaily(); } });
  }

  function edit(i) {
    const host = $('#mlHost'); if (!host) return;
    const p = i >= 0 ? L().prayers[i] : { title: '', text: '', ref: '', onDaily: true };
    let take = null, dropAudio = false, refText = p.refText || '';
    host.innerHTML = `
      <div class="eyebrow">🗣️ ${i >= 0 ? 'Edit prayer' : 'New prayer'} ${inLang()}</div>
      <form id="mlForm" class="ml-form">
        <label>Title<input class="search" id="mlTitle" maxlength="60" placeholder="e.g. Morning blessing" value="${esc(p.title)}"></label>
        <label>Your prayer<textarea class="search" id="mlText" rows="6" maxlength="4000" placeholder="Write it as you would pray it aloud" required>${esc(p.text)}</textarea></label>
        <label>A scripture to pray with it <span class="muted small">(optional)</span><input class="search" id="mlRef" maxlength="40" placeholder="e.g. Psalm 23" value="${esc(p.ref || '')}"></label>
        <p class="muted small" id="mlRefOut">${refText ? esc(refText) : ''}</p>
        <div class="ml-rec">
          <div class="eyebrow">🎙️ Your voice</div>
          ${canRecord() ? `<div class="row gap center"><button type="button" class="st-rec" id="mlRec" aria-label="Record">●</button><span class="muted small" id="mlRecLbl">${p.audioId ? 'Your recording is saved · ● to record again' : 'Tap ● and pray it aloud'}</span></div>` : '<p class="muted small">This browser cannot use the microphone here. You can add a recording made with your phone’s voice recorder.</p>'}
          <div class="row gap wrap">
            <button type="button" class="btn ghost small ${p.audioId ? '' : 'hidden'}" id="mlListen">▶ Listen</button>
            <button type="button" class="btn ghost small ${p.audioId ? '' : 'hidden'}" id="mlDrop">↺ Remove recording</button>
            <label class="btn ghost small">🎵 Use an audio file<input type="file" id="mlFile" accept="audio/*" hidden></label>
          </div>
        </div>
        <label class="ml-check"><input type="checkbox" id="mlDaily" ${p.onDaily ? 'checked' : ''}> Show on the Daily page</label>
        <div class="row end gap"><button type="button" class="btn ghost" id="mlCancel">Cancel</button><button class="btn primary">Save</button></div>
      </form>`;
    const lbl = $('#mlRecLbl'), listen = $('#mlListen'), drop = $('#mlDrop');
    const got = t => { take = t; dropAudio = false; listen.classList.remove('hidden'); drop.classList.remove('hidden'); if (lbl) lbl.textContent = `Recorded ${dur(t.dur)} · ▶ to listen, ● to record again`; };
    if (canRecord()) bindRecorder($('#mlRec'), lbl, got);
    $('#mlFile').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (window.Ambient && window.Ambient.playable && !(await window.Ambient.playable(f))) { toast('That file could not be played on this phone. Choose a sound recording.'); return; }
      got({ blob: f, type: f.type || 'audio/mpeg', dur: 0 });
      if (lbl) lbl.textContent = `Using ${f.name}`;
    });
    listen.addEventListener('click', async () => {
      if (take) return playBlob(take.blob, listen);
      if (p.audioId && !dropAudio) { const r = await MS().get('mylang', p.audioId).catch(() => null); if (r) playBlob(r.blob, listen); }
    });
    drop.addEventListener('click', () => { stop(); take = null; dropAudio = true; listen.classList.add('hidden'); drop.classList.add('hidden'); if (lbl) lbl.textContent = 'Tap ● and pray it aloud'; });
    $('#mlRef').addEventListener('change', async e => {
      const v = e.target.value.trim(); refText = '';
      if (!v) { $('#mlRefOut').textContent = ''; return; }
      try { const r = await window.Bible.lookup(v); e.target.value = r.ref; refText = r.verses.map(x => x[1]).join(' ').slice(0, 600); $('#mlRefOut').textContent = refText; }
      catch (err) { $('#mlRefOut').textContent = err.message; }
    });
    $('#mlCancel').addEventListener('click', () => { stop(); stopMic(); list(); });
    $('#mlForm').addEventListener('submit', async e => {
      e.preventDefault();
      stopMic();
      const text = $('#mlText').value.trim(); if (!text) return;
      const ref = $('#mlRef').value.trim();
      if (ref && !refText) { try { const r = await window.Bible.lookup(ref); refText = r.verses.map(x => x[1]).join(' ').slice(0, 600); } catch (err) { /* keep the reference as written */ } }
      const out = Object.assign({}, p, { id: p.id || MS().uid('ml'), title: $('#mlTitle').value.trim() || text.split(/\s+/).slice(0, 5).join(' '), text, ref, refText, onDaily: $('#mlDaily').checked, at: p.at || Date.now() });
      try {
        if ((take || dropAudio) && p.audioId) { await MS().del('mylang', p.audioId).catch(() => {}); out.audioId = null; }
        if (take) {
          const id = MS().uid('mla');
          await MS().put('mylang', { id, type: take.type, size: take.blob.size, dur: take.dur, blob: take.blob });
          out.audioId = id; out.dur = take.dur; MS().persist();
        }
      } catch (err) { toast('Not enough space on this phone for the recording'); return; }
      if (i >= 0) L().prayers[i] = out; else L().prayers.unshift(out);
      save(); Sound.play('correct'); toast('✓ Prayer saved'); list(); refreshDaily();
    });
    setTimeout(() => { const t = $('#mlTitle'); if (t && i < 0 && !$('#mlForm').contains(document.activeElement)) t.focus(); }, 60);
  }

  /* ---------------- Daily page card ---------------- */
  let dailyEl = null;
  function todays() {
    const ps = L().prayers.filter(p => p.onDaily);
    return ps.length ? ps[window.Core.daySeed() % ps.length] : null;
  }
  function renderDaily(el) {
    dailyEl = el; if (!el) return;
    const p = todays();
    if (!p) { el.innerHTML = ''; return; }
    const t = window.Core.today();
    el.innerHTML = `
      <section class="ml-daily">
        <div class="eyebrow">🗣️ Today’s prayer ${inLang()}</div>
        <h3>${esc(p.title || 'Prayer')}</h3>
        <p class="ml-text">${esc(p.text)}</p>
        ${p.ref ? `<p class="muted small">📖 ${esc(p.ref)}${p.refText ? ` · ${esc(p.refText.length > 160 ? p.refText.slice(0, 157) + '…' : p.refText)}` : ''}</p>` : ''}
        <div class="row gap wrap">
          <button class="btn ghost" id="mlDPlay">▶ ${p.audioId ? 'Listen' : 'Read aloud'}</button>
          <button class="btn primary" id="mlDAmen" ${t.prayer ? 'disabled' : ''}>${t.prayer ? '✓ Amen' : '🙏 Amen'}</button>
          <button class="btn ghost small" id="mlDOpen">All my prayers →</button>
        </div>
      </section>`;
    $('#mlDPlay').addEventListener('click', e => playPrayer(p, p.audioId ? e.currentTarget : null));
    $('#mlDAmen').addEventListener('click', () => { window.Core.markDaily('prayer'); Sound.play('correct'); UI().refresh(); });
    $('#mlDOpen').addEventListener('click', open);
  }
  function refreshDaily() { if (dailyEl && document.body.contains(dailyEl)) renderDaily(dailyEl); }

  /* ---------------- Sharing: a language pack ---------------- */
  const b64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
  async function exportPack() {
    const ps = L().prayers;
    if (!ps.length) { toast('There are no prayers to share yet'); return; }
    toast('Preparing your prayers…');
    const prayers = [];
    for (const p of ps) {
      const r = p.audioId && await MS().get('mylang', p.audioId).catch(() => null);
      prayers.push({ title: p.title, text: p.text, ref: p.ref || '', refText: p.refText || '', dur: p.dur || 0, audio: r && r.blob ? { type: r.type || r.blob.type, data: await b64(r.blob) } : null });
    }
    const author = window.Personal ? window.Personal.name() : '';
    const data = JSON.stringify({ app: 'lamp-and-path', kind: 'mylang-pack', version: 1, language: langName(), author, exported: Date.now(), prayers });
    const blob = new Blob([data], { type: 'application/json' });
    const slug = (langName() || 'my-language').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prayers';
    const name = `prayers-${slug}-${window.Core.dateKey()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `Prayers ${langName() ? 'in ' + langName() : ''}`.trim() }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
    toast(`💾 Saved ${name} (${MS().size(blob.size)}). Send it to your family or church.`);
  }
  async function importPack(f) {
    let data;
    try { data = JSON.parse(await f.text()); } catch (e) { toast('That is not a shared prayer set'); return 0; }
    if (!data || data.kind !== 'mylang-pack' || !Array.isArray(data.prayers)) { toast('That is not a shared prayer set'); return 0; }
    const n = data.prayers.length, lang = String(data.language || '').slice(0, 40), by = String(data.author || '').slice(0, 40);
    if (!(await UI().ask(`Add ${n} prayer${n === 1 ? '' : 's'}${lang ? ' in ' + lang : ''}${by ? ' from ' + by : ''}?`, 'Add'))) return 0;
    const have = new Set(L().prayers.map(p => (p.title + '\n' + p.text).toLowerCase()));
    let added = 0;
    for (const it of data.prayers) {
      if (!it || !it.text) continue;
      const k = (String(it.title || '') + '\n' + it.text).toLowerCase();
      if (have.has(k)) continue;
      const p = { id: MS().uid('ml'), title: String(it.title || '').slice(0, 60), text: String(it.text).slice(0, 4000), ref: String(it.ref || '').slice(0, 40), refText: String(it.refText || '').slice(0, 600), onDaily: true, at: Date.now(), from: by, dur: it.dur || 0 };
      if (it.audio && it.audio.data) {
        try {
          const bin = atob(it.audio.data), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: it.audio.type || 'audio/webm' });
          const id = MS().uid('mla');
          await MS().put('mylang', { id, type: blob.type, size: blob.size, dur: it.dur || 0, blob });
          p.audioId = id;
        } catch (e) { toast('Not enough space on this phone for all the recordings'); }
      }
      L().prayers.push(p); have.add(k); added++;
    }
    if (!langName() && lang) L().name = lang;
    save(); MS().persist();
    toast(added ? `🗣️ Added ${added} prayer${added === 1 ? '' : 's'}` : 'These prayers were already on this phone');
    return added;
  }

  window.MyLang = { open, renderDaily, exportPack, importPack, playPrayer, todays, stop };
})();
