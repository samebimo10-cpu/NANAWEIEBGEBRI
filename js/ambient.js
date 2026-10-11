/*
 * Background music for reading, studying and listening, generated in the browser (no audio files, works offline):
 *  - Deep calm piano: slow, warm chords and a wandering melody, with soft reverb
 *  - Running stream: flowing water with trickles and droplets
 *  - Hymns ("special music"): public-domain hymn tunes played gently on piano
 *  - Soft strings, and rain
 */
(function () {
  'use strict';
  const TRACKS = [
    ['calm', '🎹', 'Deep calm piano', 'Slow, warm piano for study and prayer'],
    ['stream', '🏞️', 'Running stream', 'Flowing water and gentle trickles'],
    ['hymns', '⛪', 'Hymns', 'Amazing Grace, Joyful Joyful, Jesus Loves Me'],
    ['pad', '🎻', 'Soft strings', 'A warm, slowly changing chord'],
    ['rain', '🌧️', 'Rain', 'Steady, soft rain']
  ];
  const OLD = { piano: 'calm' };   // earlier name for the piano track

  let ac = null, master = null, meter = null, verb = null, dry = null, timers = [], nodes = [], kind = '', previewTimer = null, volume = 0.7;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const listeners = [];
  const changed = () => listeners.forEach(f => f(kind));

  function ctx() {
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  /* A soft hall: a convolution reverb from a decaying noise impulse. */
  function setup(c) {
    if (master) return;
    master = c.createGain(); master.gain.value = 0; master.connect(c.destination);
    meter = c.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
    dry = c.createGain(); dry.gain.value = 0.75; dry.connect(master);
    verb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 3.2), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.55;
    verb.connect(wet).connect(master);
  }
  const every = (fn, ms) => { timers.push(setInterval(fn, ms)); };
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  function clear() {
    timers.forEach(t => { clearInterval(t); clearTimeout(t); }); timers = [];
    nodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { /* already stopped */ } });
    nodes = [];
  }
  const keep = n => { nodes.push(n); if (nodes.length > 400) nodes.splice(0, 200); return n; };

  /* ---------------- A gentle piano voice ---------------- */
  function piano(c, midi, t, vel = 0.5, len = 4) {
    const f = hz(midi), out = c.createGain(), tone = c.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 1800 + vel * 1600; tone.Q.value = 0.3;
    out.connect(tone); tone.connect(dry); tone.connect(verb);
    // a few partials, slightly stretched like real strings, each fading at its own pace
    [[1, 1, 1], [2, 0.42, 0.75], [3, 0.18, 0.55], [4, 0.08, 0.4], [5, 0.04, 0.3]].forEach(([h, amp, decay]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * h * (1 + 0.0004 * h * h);
      const a = vel * amp * 0.27, d = Math.max(0.6, len * decay * (midi > 72 ? 0.7 : 1));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.012);
      g.gain.exponentialRampToValueAtTime(a * 0.35, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); keep(o);
    });
  }

  /* ---------------- 1. Deep calm piano ---------------- */
  // Db major, slow: Dbmaj9 – Bbm9 – Gbmaj7 – Absus4, the melody wanders on the pentatonic scale
  const CALM = [[49, 56, 60, 63, 65], [46, 53, 56, 60, 61], [42, 49, 53, 56, 58], [44, 51, 54, 56, 61]];
  const PENTA = [61, 63, 65, 68, 70, 73, 75, 77];
  function calm(c) {
    let bar = 0, step = 0, last = 3;
    const beat = 0.95;   // seconds: about 63 beats a minute, a resting heartbeat
    const tick = () => {
      const t = c.currentTime + 0.05, ch = CALM[bar % CALM.length];
      if (step === 0) {
        piano(c, ch[0] - 12, t, 0.42, 7); piano(c, ch[0], t + 0.02, 0.3, 6);
        ch.slice(1).forEach((m, k) => piano(c, m, t + 0.25 + k * 0.18, 0.22, 5.5));   // a slow, rolled chord
      }
      if (step === 2 || (step === 3 && Math.random() < 0.5) || (step === 1 && Math.random() < 0.35)) {
        last = Math.max(0, Math.min(PENTA.length - 1, last + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        piano(c, PENTA[last], t + Math.random() * 0.08, 0.3 + Math.random() * 0.12, 4.5);
      }
      step = (step + 1) % 4; if (step === 0) bar++;
    };
    tick(); every(tick, beat * 1000);
  }

  /* ---------------- 2. Running stream ---------------- */
  function noiseBuffer(c, seconds, brown) {
    const len = c.sampleRate * seconds, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return buf;
  }
  function stream(c) {
    // the body of the water: brown noise for depth, plus several moving bands of white noise for the rushing sound
    const base = c.createBufferSource(); base.buffer = noiseBuffer(c, 4, true); base.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const bg = c.createGain(); bg.gain.value = 0.55;
    base.connect(lp).connect(bg).connect(dry); base.start(); keep(base);
    const white = noiseBuffer(c, 3, false);
    [[900, 0.5, 0.18], [1700, 0.8, 0.12], [3200, 1.3, 0.07]].forEach(([freq, rate, amp]) => {
      const s = c.createBufferSource(); s.buffer = white; s.loop = true; s.loopStart = Math.random();
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
      const g = c.createGain(); g.gain.value = amp;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = rate * (0.8 + Math.random() * 0.4); lg.gain.value = freq * 0.35;
      lfo.connect(lg).connect(bp.frequency);
      const lfo2 = c.createOscillator(), lg2 = c.createGain(); lfo2.frequency.value = rate * 0.37; lg2.gain.value = amp * 0.5;
      lfo2.connect(lg2).connect(g.gain);
      s.connect(bp).connect(g).connect(dry); g.connect(verb);
      s.start(); lfo.start(); lfo2.start(); keep(s); keep(lfo); keep(lfo2);
    });
    // trickles and droplets: tiny rising "bloops" now and then
    const drop = () => {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const t = c.currentTime + Math.random() * 0.35, f = 600 + Math.random() * 1400;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.6 + Math.random()), t + 0.06);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.03, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g); g.connect(dry); g.connect(verb); o.start(t); o.stop(t + 0.12); keep(o);
      }
    };
    every(drop, 380);
  }

  /* ---------------- 3. Hymns ---------------- */
  // Public-domain hymn tunes. Notes as [MIDI, beats]; 0 is a rest. Chords per bar: I, IV, V or vi of the key.
  const HYMNS = [
    { name: 'Amazing Grace', tune: 'NEW BRITAIN (1835)', key: 55, beats: 3, tempo: 0.62,   // G major, 3/4
      pickup: [[62, 1]],
      bars: [[[67, 2], [71, 0.5], [67, 0.5]], [[71, 2], [69, 1]], [[67, 2], [64, 1]], [[62, 2], [62, 1]], [[67, 2], [71, 0.5], [67, 0.5]], [[71, 2], [69, 1]], [[74, 3]], [[74, 2], [71, 1]],
        [[74, 2], [71, 0.5], [67, 0.5]], [[71, 2], [69, 1]], [[67, 2], [64, 1]], [[62, 2], [62, 1]], [[67, 2], [71, 0.5], [67, 0.5]], [[71, 2], [69, 1]], [[67, 3]]],
      chords: ['I', 'I', 'IV', 'I', 'I', 'I', 'V', 'V', 'I', 'I', 'IV', 'I', 'I', 'V', 'I'] },
    { name: 'Joyful, Joyful, We Adore Thee', tune: 'HYMN TO JOY (Beethoven, 1824)', key: 48, beats: 4, tempo: 0.55,   // C major, 4/4
      pickup: [],
      bars: [[[64, 1], [64, 1], [65, 1], [67, 1]], [[67, 1], [65, 1], [64, 1], [62, 1]], [[60, 1], [60, 1], [62, 1], [64, 1]], [[64, 1.5], [62, 0.5], [62, 2]],
        [[64, 1], [64, 1], [65, 1], [67, 1]], [[67, 1], [65, 1], [64, 1], [62, 1]], [[60, 1], [60, 1], [62, 1], [64, 1]], [[62, 1.5], [60, 0.5], [60, 2]],
        [[62, 1], [62, 1], [64, 1], [60, 1]], [[62, 1], [64, 0.5], [65, 0.5], [64, 1], [60, 1]], [[62, 1], [64, 0.5], [65, 0.5], [64, 1], [62, 1]], [[60, 1], [62, 1], [55, 2]],
        [[64, 1], [64, 1], [65, 1], [67, 1]], [[67, 1], [65, 1], [64, 1], [62, 1]], [[60, 1], [60, 1], [62, 1], [64, 1]], [[62, 1.5], [60, 0.5], [60, 2]]],
      chords: ['I', 'V', 'I', 'V', 'I', 'V', 'I', 'I', 'V', 'V', 'V', 'V', 'I', 'V', 'I', 'I'] },
    { name: 'Jesus Loves Me', tune: 'JESUS LOVES ME (Bradbury, 1862)', key: 48, beats: 4, tempo: 0.6,   // C major, 4/4
      pickup: [],
      bars: [[[67, 1], [64, 1], [64, 1], [62, 1]], [[64, 1], [67, 1], [67, 2]], [[69, 1], [69, 1], [72, 1], [69, 1]], [[69, 1], [67, 1], [67, 2]],
        [[67, 1], [64, 1], [64, 1], [62, 1]], [[64, 1], [67, 1], [67, 2]], [[69, 1], [69, 1], [67, 1], [72, 1]], [[64, 1], [62, 1], [60, 2]]],
      chords: ['I', 'I', 'IV', 'I', 'I', 'I', 'IV', 'I'] }
  ];
  const TRIAD = { I: [0, 4, 7], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16] };
  let hymnIndex = 0;
  function hymns(c) {
    const playOne = () => {
      const h = HYMNS[hymnIndex % HYMNS.length]; hymnIndex++;
      current = h.name; changed();
      const q = h.tempo / 0.6 * 0.82;   // seconds per beat: slow and reverent
      let t = c.currentTime + 0.3;
      h.pickup.forEach(([m, d]) => { if (m) piano(c, m + 12, t, 0.42, 3); t += d * q; });
      h.bars.forEach((bar, i) => {
        const root = h.key, ch = TRIAD[h.chords[i]] || TRIAD.I;
        piano(c, root + ch[0] - 12, t, 0.3, h.beats * q + 1.5);                           // bass
        ch.forEach((x, k) => piano(c, root + 12 + x, t + 0.06 + k * 0.05, 0.14, h.beats * q + 1));   // soft chord
        bar.forEach(([m, d]) => { if (m) piano(c, m + 12, t, 0.44, Math.max(1.5, d * q * 1.6)); t += d * q; });
      });
      // a short pause, then the next hymn
      later(() => { if (kind === 'hymns') playOne(); }, (t - c.currentTime + 3.5) * 1000);
    };
    playOne();
  }
  let current = '';

  /* ---------------- Soft strings and rain ---------------- */
  const CHORDS = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]];
  function pad(c) {
    let i = 0;
    const play = () => {
      const t = c.currentTime;
      CHORDS[i++ % CHORDS.length].forEach((m, k) => [0, 7].forEach(cents => {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = k === 0 ? 'sine' : 'triangle'; o.frequency.value = hz(m); o.detune.value = cents;
        f.type = 'lowpass'; f.frequency.value = 900;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2.5); g.gain.linearRampToValueAtTime(0.04, t + 6); g.gain.linearRampToValueAtTime(0, t + 9.5);
        o.connect(f).connect(g); g.connect(dry); g.connect(verb); o.start(t); o.stop(t + 10); keep(o);
      }));
    };
    play(); every(play, 8000);
  }
  function rain(c) {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noiseBuffer(c, 2, true); src.loop = true; f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = 0.5;
    src.connect(f).connect(g).connect(dry); src.start(); keep(src);
  }

  /* ---------------- My music: sound files from this phone ----------------
   * Played through an ordinary audio player, so phones usually keep it going with the screen locked,
   * with play, pause and skip on the lock screen. */
  const MINE = ['mine', '🎶', 'My music', 'Songs and recordings from this phone'];
  let player = null, myList = [], myIndex = -1, myUrl = null;
  const mine = { shuffle: false, repeat: false };
  try { Object.assign(mine, JSON.parse(localStorage.getItem('lamp-mymusic') || '{}')); } catch (e) { /* defaults */ }
  const saveMine = () => { try { localStorage.setItem('lamp-mymusic', JSON.stringify(mine)); } catch (e) { /* not saved */ } };
  async function loadList() {
    try { myList = (await window.MediaStore.list('music')).sort((a, b) => a.added - b.added); } catch (e) { myList = []; }
    return myList;
  }
  function getPlayer() {
    if (player) return player;
    player = new Audio();
    player.preload = 'auto';
    player.addEventListener('ended', () => { if (kind === 'mine') nextMine(mine.repeat ? 0 : 1, true); });
    player.addEventListener('error', () => { if (kind === 'mine') { window.Core.toast('This file could not be played. Skipping it.'); nextMine(1, true); } });
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      const on = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* not supported */ } };
      on('play', () => { if (kind === 'mine') player.play(); });
      on('pause', () => { if (kind === 'mine') player.pause(); });
      on('nexttrack', () => nextMine(1));
      on('previoustrack', () => nextMine(-1));
      on('stop', () => stop());
    }
    return player;
  }
  async function playMine(i) {
    if (!myList.length) await loadList();
    if (!myList.length) { window.Core.toast('Add some music from your phone first'); return; }
    myIndex = (i + myList.length) % myList.length;
    const meta = myList[myIndex];
    let rec;
    try { rec = await window.MediaStore.get('music', meta.id); } catch (e) { rec = null; }
    if (!rec || !rec.blob) { window.Core.toast('That file is missing'); return; }
    const p = getPlayer();
    if (myUrl) URL.revokeObjectURL(myUrl);
    myUrl = URL.createObjectURL(rec.blob);
    p.src = myUrl; p.volume = volume;
    kind = 'mine'; current = meta.name;
    try { await p.play(); } catch (e) { if (e && e.name === 'NotAllowedError') window.Core.toast('Tap ▶ to start the music'); }
    if ('mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: meta.name, artist: 'My music', album: (window.Personal && window.Personal.appTitle()) || 'Lamp & Path' });
    }
    changed();
  }
  function nextMine(d, auto) {
    if (!myList.length) return;
    if (auto && !mine.repeat && !mine.shuffle && d > 0 && myIndex === myList.length - 1) { playMine(0); return; }   // the list repeats from the top
    if (d === 0) { playMine(myIndex); return; }
    if (mine.shuffle && myList.length > 1) { let j; do { j = Math.floor(Math.random() * myList.length); } while (j === myIndex); playMine(j); return; }
    playMine(myIndex + d);
  }
  function stopMine() { if (player) { player.pause(); } }
  async function addFiles(files) {
    let added = 0, skipped = 0;
    for (const f of files) {
      if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|weba)$/i.test(f.name)) { skipped++; continue; }
      try {
        await window.MediaStore.put('music', { id: window.MediaStore.uid('m'), name: f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '), type: f.type, size: f.size, blob: f, added: Date.now() + added });
        added++;
      } catch (e) { window.Core.toast('Not enough space on this phone for more music'); break; }
    }
    window.MediaStore.persist();
    await loadList();
    if (added) window.Core.toast(`🎶 Added ${added} file${added === 1 ? '' : 's'} to My music`);
    if (skipped) window.Core.toast(`${skipped} file${skipped === 1 ? ' was' : 's were'} not audio and ${skipped === 1 ? 'was' : 'were'} skipped`);
    return added;
  }
  async function removeMine(id) {
    const i = myList.findIndex(x => x.id === id);
    if (kind === 'mine' && i === myIndex) stop();
    await window.MediaStore.del('music', id);
    await loadList();
    if (myIndex > i) myIndex--;
  }

  /* ---------------- Controls ---------------- */
  function start(k, from) {
    k = OLD[k] || k;
    clearTimeout(previewTimer);
    if (k === 'mine') {
      if (kind && kind !== 'mine') fadeOutGenerated();
      const i = from ? myList.findIndex(x => x.id === from) : (kind === 'mine' ? myIndex : 0);
      playMine(i < 0 ? 0 : i);
      return;
    }
    if (kind === 'mine') { stopMine(); kind = ''; }
    if (kind === k) return;
    const c = ctx(); if (!c) return;
    setup(c);
    clear(); kind = k; current = '';
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(master.gain.value, c.currentTime); master.gain.linearRampToValueAtTime(volume, c.currentTime + 2.5);
    ({ calm, stream, hymns, pad, rain }[k] || (() => {}))(c);
    changed();
  }
  function fadeOutGenerated() {
    if (!ac || !master) return;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0, ac.currentTime + 1);
    setTimeout(() => { if (kind === 'mine' || !kind) clear(); }, 1100);
  }
  function stop() {
    clearTimeout(previewTimer);
    if (kind === 'mine') { stopMine(); kind = ''; current = ''; if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; changed(); return; }
    if (!ac || !master || !kind) return;
    kind = ''; current = '';
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
    setTimeout(() => { if (!kind) clear(); }, 1600);
    changed();
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (player) player.volume = volume;
    if (ac && master && kind) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(volume, ac.currentTime, 0.2); }
  }
  /* a short sample in the settings */
  function preview(k) { start(k); clearTimeout(previewTimer); previewTimer = setTimeout(stop, 8000); }
  const track = k => (OLD[k] || k) === 'mine' ? MINE : TRACKS.find(t => t[0] === (OLD[k] || k));

  /* ---------------- The music panel and the "now playing" bar ---------------- */
  const store = () => (window.Core.state.readerOpts = window.Core.state.readerOpts || {});
  function openPanel() {
    const esc = window.Core.escapeHTML, o = store();
    const html = () => `
      <div class="music-panel">
        <div class="eyebrow">🎵 Background music</div>
        <h2>Music for reading and prayer</h2>
        <p class="muted small">Made on your phone, so it works offline. Keep the app open: phones pause web-app sound when the screen locks.</p>
        <div class="track-list">${TRACKS.map(([k, ic, name, sub]) => `<button class="track ${kind === k ? 'on' : ''}" data-k="${k}">
          <span class="tr-ic">${ic}</span><span class="tr-main"><b>${esc(name)}</b><small>${esc(kind === k && current ? 'Now playing: ' + current : sub)}</small></span>
          <span class="tr-btn">${kind === k ? '⏸' : '▶'}</span></button>`).join('')}</div>
        <h3 class="section-title">🎶 My music</h3>
        <div id="myMusic"><p class="muted small">Loading…</p></div>
        <label class="flabel" for="musVol">Volume</label>
        <input type="range" id="musVol" min="0" max="100" value="${Math.round(volume * 100)}" class="vol">
        <label class="check-row"><input type="checkbox" id="musListen" ${o.ambient ? 'checked' : ''}> Play ${esc((track(o.ambient || kind || 'calm') || TRACKS[0])[2].toLowerCase())} when I listen to the Bible read aloud</label>
        <p class="muted small">The hymn tunes are in the public domain, and the sounds above are generated on your phone. Music you add stays on this phone and is never uploaded.</p>
      </div>`;
    window.UI.openModal(html());
    const bind = () => {
      document.querySelectorAll('.music-panel .track').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (kind === k) stop(); else { start(k); if (store().ambient) { store().ambient = k; window.Core.save(); } }
        refresh();
      }));
      document.getElementById('musVol').addEventListener('input', e => { setVolume(e.target.value / 100); window.Core.state.musicVolume = volume; });
      document.getElementById('musVol').addEventListener('change', () => window.Core.save());
      document.getElementById('musListen').addEventListener('change', e => { store().ambient = e.target.checked ? (kind || 'calm') : ''; window.Core.save(); });
    };
    const drawMine = async () => {
      const host = document.getElementById('myMusic'); if (!host) return;
      await loadList();
      const use = await window.MediaStore.usage();
      if (!document.getElementById('myMusic')) return;
      const total = myList.reduce((a, x) => a + (x.size || 0), 0);
      host.innerHTML = `
        <p class="muted small">Play your own songs, worship music or sermons from this phone. They play like a music player, so they can usually keep going with the screen locked.</p>
        <div class="row gap wrap">
          <label class="btn primary small add-music">＋ Add music from this phone<input type="file" id="musFiles" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac" multiple hidden></label>
          ${myList.length ? `<button class="btn ghost small ${kind === 'mine' ? 'on' : ''}" id="musPlayAll">${kind === 'mine' ? '⏸ Pause' : '▶ Play all'}</button>
          <button class="btn ghost small ${mine.shuffle ? 'on' : ''}" id="musShuffle" aria-pressed="${mine.shuffle}">🔀 Shuffle</button>
          <button class="btn ghost small ${mine.repeat ? 'on' : ''}" id="musRepeat" aria-pressed="${mine.repeat}">🔂 Repeat one</button>` : ''}
        </div>
        ${myList.length ? `<div class="my-list">${myList.map((m, i) => `<div class="my-row ${kind === 'mine' && i === myIndex ? 'on' : ''}">
          <button class="my-play" data-id="${m.id}" aria-label="Play ${esc(m.name)}">${kind === 'mine' && i === myIndex && player && !player.paused ? '⏸' : '▶'}</button>
          <span class="my-name">${esc(m.name)}<small>${window.MediaStore.size(m.size || 0)}</small></span>
          <button class="my-del" data-del="${m.id}" aria-label="Remove ${esc(m.name)}">✕</button></div>`).join('')}</div>
          <p class="muted small">${myList.length} file${myList.length === 1 ? '' : 's'} · ${window.MediaStore.size(total)}${use && use.quota ? ` · space left on this phone for the app: about ${window.MediaStore.size(Math.max(0, use.quota - use.usage))}` : ''}</p>`
        : '<p class="muted small">No music added yet.</p>'}`;
      host.querySelector('#musFiles').addEventListener('change', async e => { const n = await addFiles([...e.target.files]); e.target.value = ''; drawMine(); if (n && !kind) start('mine'); });
      const pa = host.querySelector('#musPlayAll'); if (pa) pa.addEventListener('click', () => { if (kind === 'mine' && player && !player.paused) { player.pause(); drawMine(); } else start('mine'); });
      const sh = host.querySelector('#musShuffle'); if (sh) sh.addEventListener('click', () => { mine.shuffle = !mine.shuffle; saveMine(); drawMine(); });
      const rp = host.querySelector('#musRepeat'); if (rp) rp.addEventListener('click', () => { mine.repeat = !mine.repeat; saveMine(); drawMine(); });
      host.querySelectorAll('.my-play').forEach(b => b.addEventListener('click', () => {
        const i = myList.findIndex(x => x.id === b.dataset.id);
        if (kind === 'mine' && i === myIndex && player) { player.paused ? player.play() : player.pause(); setTimeout(drawMine, 50); }
        else start('mine', b.dataset.id);
      }));
      host.querySelectorAll('.my-del').forEach(b => b.addEventListener('click', async () => {
        const m = myList.find(x => x.id === b.dataset.del);
        if (!(await window.UI.ask(`Remove "${m.name}" from My music? (The original file on your phone is not touched.)`, 'Remove'))) return;
        await removeMine(m.id); drawMine();
      }));
    };
    const refresh = () => { const body = document.getElementById('modalBody'); if (body && body.querySelector('.music-panel')) { body.innerHTML = html(); bind(); drawMine(); } };
    drawMine();
    bind();
    const off = () => refresh();
    listeners.push(off);
    window.UI.onModalClose(() => { const i = listeners.indexOf(off); if (i >= 0) listeners.splice(i, 1); });
  }
  function pill() {
    let el = document.getElementById('musicPill');
    if (!kind) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'musicPill'; el.className = 'music-pill';
      document.body.appendChild(el);
    }
    const t = track(kind);
    el.innerHTML = `<button class="mp-open" aria-label="Music settings"><span>${t[1]}</span><span class="mp-t">${window.Core.escapeHTML(current || t[2])}</span></button><button class="mp-stop" aria-label="Stop the music">⏸</button>`;
    el.querySelector('.mp-open').addEventListener('click', openPanel);
    el.querySelector('.mp-stop').addEventListener('click', stop);
    if (kind === 'mine' && player) {
      const b = el.querySelector('.mp-stop');
      b.textContent = player.paused ? '▶' : '⏸';
      b.onclick = e => { e.stopImmediatePropagation(); player.paused ? player.play() : player.pause(); };
      const skip = document.createElement('button'); skip.className = 'mp-next'; skip.textContent = '⏭'; skip.setAttribute('aria-label', 'Next song');
      skip.addEventListener('click', () => nextMine(1)); el.appendChild(skip);
    }
  }
  listeners.push(pill);
  if (window.Core && window.Core.state && typeof window.Core.state.musicVolume === 'number') volume = window.Core.state.musicVolume;

  /* how loud the music is right now (0 to 1), for checks */
  function level() {
    if (!meter) return 0;
    const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
    return Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length);
  }

  // keep the bar and panel in step with the player (lock-screen controls can pause it too)
  const sync = () => { if (kind === 'mine') changed(); };
  setTimeout(() => { const p = getPlayer(); p.addEventListener('play', sync); p.addEventListener('pause', sync); }, 0);

  window.Ambient = { openPanel, addFiles, myMusic: () => loadList(), player: () => player, level, TRACKS, HYMNS, start, stop, preview, setVolume, volume: () => volume, track, playing: () => kind, nowPlaying: () => current, onChange: fn => listeners.push(fn) };
})();
