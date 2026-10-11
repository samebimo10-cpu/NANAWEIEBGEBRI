/*
 * Background music for reading, studying and listening, generated in the browser (no audio files, works offline):
 *  - Deep calm piano: slow, warm chords and a wandering melody, with soft reverb
 *  - Running stream: flowing water with trickles and droplets
 *  - Hymns ("special music"): 27 public-domain hymns in four-part harmony, one on repeat or several in a loop
 *  - Soft strings, and rain
 */
(function () {
  'use strict';
  const TRACKS = [
    ['calm', '🎹', 'Deep calm piano', 'Slow, warm piano for study and prayer'],
    ['stream', '🏞️', 'Running stream', 'Flowing water and gentle trickles'],
    ['hymns', '⛪', 'Hymns', '27 well-loved hymns in four parts, played on piano'],
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

  /* ---------------- 3. Hymns ----------------
   * 27 public-domain hymns in four parts (js/data/hymns.js), played on the piano in the key from the hymn list.
   * Play one hymn on repeat, or the hymns you tick one after another in a loop. */
  const KEYPC = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  const hs = { sel: null, one: 0, easy: false, shuffle: false };   // sel: ticked hymn numbers (null = all); one: the hymn on repeat
  try { Object.assign(hs, JSON.parse(localStorage.getItem('lamp-hymns') || '{}')); } catch (e) { /* defaults */ }
  const saveHymns = () => { try { localStorage.setItem('lamp-hymns', JSON.stringify(hs)); } catch (e) { /* not saved */ } };
  const HYMNAL = () => window.HYMNAL || [];
  const hymnBy = n => HYMNAL().find(h => h.n === n);
  const ticked = () => HYMNAL().filter(h => !hs.sel || hs.sel.includes(h.n));
  const keyName = k => k.replace('b', '♭').replace('#', '♯') + ' major';
  const hymnKey = h => hs.easy ? h.easy : h.key;
  function shiftFor(h) { const s = (KEYPC[hymnKey(h)] - KEYPC[h.key] + 12) % 12; return s > 6 ? s - 12 : s; }
  const PACE = 0.85;                      // a little slower than congregational singing: calm, for prayer
  const VEL = [0.46, 0.19, 0.19, 0.3];    // melody clear, inner voices soft, a warm bass
  const DEG = { I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16] };

  /* For the two hymns whose tunes are still under copyright: a quiet meditation on their chord progression only. */
  function chordPiece(h) {
    const T = 24, [bn, bd] = h.ts.split('/').map(Number);
    const beat = bd === 8 ? T / 2 : T * 4 / bd, bar = bn * beat;
    const steps = h.prog.split(/\s*[–-]\s*/).map(x => x.trim()).filter(Boolean);
    const root = 43 + ((KEYPC[h.key] - 7 + 12) % 12);   // G2 to F#3
    const notes = []; let t = 0, top = root + 28;
    const chordBar = (deg, seventh) => {
      const tones = deg.map(x => root + 12 + x).concat(seventh ? [root + 12 + deg[0] + 10] : []);
      notes.push([t, bar, root + deg[0] - (deg[0] > 6 ? 12 : 0), 3]);
      // a soft top line that moves to the nearest note of each chord
      const cands = []; deg.forEach(x => [24, 36].forEach(o => cands.push(root + x + o)));
      top = cands.filter(m => m >= 64 && m <= 79).sort((a, z) => Math.abs(a - top) - Math.abs(z - top))[0] || top;
      notes.push([t, bar, top, 0]);
      for (let i = 0; i < bn; i++) notes.push([t + i * beat, beat * 1.5, tones[(i * 2 + (i > 2 ? 1 : 0)) % tones.length], 1]);
      t += bar;
    };
    for (let round = 0; round < 2; round++) steps.forEach(st => { const d = DEG[st.replace(/[^IViv]/g, '')] || DEG.I; chordBar(d, /7/.test(st)); chordBar(d, /7/.test(st)); });
    notes.push([t, bar * 2, root, 3], [t, bar * 2, root + 12 + 4, 1], [t, bar * 2, root + 12 + 7, 1], [t, bar * 2, root + 24, 0]);
    return { notes, len: t + bar * 2, bpm: bd === 8 ? 100 : 76 };
  }
  function score(h) {
    if (h.chordsOnly) return chordPiece(h);
    const a = h.notes, notes = [];
    for (let i = 0; i < a.length; i += 4) notes.push([a[i], a[i + 1], a[i + 2], a[i + 3]]);
    return { notes, len: h.len, bpm: h.bpm };
  }
  let hymnNow = 0, hymnToken = 0, hymnSkip = () => {}, hymnFrom = 0;
  function hymns(c) {
    let order = (hs.one ? [hymnBy(hs.one)].filter(Boolean) : ticked()).map(h => h.n);
    if (!order.length) order = HYMNAL().map(h => h.n);
    if (!order.length) return;
    if (!hs.one && hs.shuffle) order.sort(() => Math.random() - 0.5);
    let pos = 0, iv = null;
    const playAt = i => {
      const token = ++hymnToken;
      if (kind !== 'hymns') return;
      pos = (i + order.length) % order.length;
      const h = hymnBy(order[pos]); hymnNow = h.n;
      current = h.title + (hs.one ? ' (repeat)' : '');
      changed();
      const d = score(h), sh = shiftFor(h), spt = 60 / (d.bpm * PACE) / 24;   // seconds per tick
      const t0 = c.currentTime + 0.4, notes = d.notes;
      let k = 0;
      // schedule a little ahead at a time, so a long hymn does not start hundreds of sounds at once
      const pump = () => {
        if (token !== hymnToken || kind !== 'hymns') return;
        const horizon = c.currentTime + 1.6;
        while (k < notes.length && t0 + notes[k][0] * spt < horizon) {
          const [st, du, m, v] = notes[k++];
          piano(c, m + sh, Math.max(t0 + st * spt, c.currentTime + 0.01), VEL[v] || 0.2, Math.max(1.2, du * spt * 1.3 + 0.4));
        }
        if (k >= notes.length && c.currentTime > t0 + d.len * spt + 2.2) playAt(hs.one ? pos : pos + 1);   // a short rest, then on
      };
      if (iv) clearInterval(iv);
      pump(); iv = setInterval(pump, 250); timers.push(iv);
    };
    hymnSkip = n => { if (kind === 'hymns') playAt(pos + n); };
    const from = hymnFrom ? order.indexOf(hymnFrom) : 0; hymnFrom = 0;
    playAt(Math.max(0, from));
  }
  /* play one hymn (alone = on repeat), or the ticked hymns starting from this one */
  function playHymn(n, alone) {
    hs.one = alone ? n : 0; saveHymns();
    hymnFrom = n;
    if (kind === 'hymns') { clear(); hymns(ac); } else start('hymns');
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
  /* Downloaded music often arrives with no type or an odd one (WhatsApp, Telegram, browsers),
     so instead of trusting the name, ask this phone whether it can actually play the file. */
  const SOUND_EXT = /\.(mp3|m4a|m4b|aac|wav|ogg|oga|opus|flac|webm|weba|mp4|3gp|3gpp|amr|wma|mka|caf|aiff?)$/i;
  function playable(f) {
    if (/^(image|text)\//.test(f.type) || /\.(pdf|docx?|xlsx?|pptx?|zip|apk|jpe?g|png|gif|txt|json|html?)$/i.test(f.name)) return Promise.resolve(false);
    return new Promise(res => {
      const a = new Audio(), url = URL.createObjectURL(f);
      let done = false;
      const end = ok => { if (done) return; done = true; clearTimeout(t); a.removeAttribute('src'); a.load(); URL.revokeObjectURL(url); res(ok); };
      const t = setTimeout(() => end(/^(audio|video)\//.test(f.type) || SOUND_EXT.test(f.name)), 6000);
      a.preload = 'metadata';
      a.onloadedmetadata = () => end(true);
      a.onerror = () => end(false);
      a.src = url;
    });
  }
  async function addFiles(files) {
    let added = 0, skipped = 0;
    for (const f of files) {
      if (!(await playable(f))) { skipped++; continue; }
      try {
        await window.MediaStore.put('music', { id: window.MediaStore.uid('m'), name: f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '), type: f.type, size: f.size, blob: f, added: Date.now() + added });
        added++;
      } catch (e) { window.Core.toast('Not enough space on this phone for more music'); break; }
    }
    window.MediaStore.persist();
    await loadList();
    if (added) window.Core.toast(`🎶 Added ${added} file${added === 1 ? '' : 's'} to My music`);
    if (skipped) window.Core.toast(`${skipped} file${skipped === 1 ? '' : 's'} could not be played on this phone and ${skipped === 1 ? 'was' : 'were'} skipped`);
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
  function hymnsHTML() {
    const esc = window.Core.escapeHTML, list = HYMNAL(), sel = ticked().length, looping = kind === 'hymns' && !hs.one;
    if (!list.length) return '<p class="muted small">The hymns could not be loaded.</p>';
    return `
      <p class="muted small">Tap 🔂 to play one hymn over and over. Or tick the hymns you want and tap <b>Play selected</b> (or a hymn's name to start there): they play one after another, then start again from the first.</p>
      <div class="row gap wrap hy-tools">
        <button class="btn ${looping ? 'ghost' : 'primary'} small" id="hyPlaySel">${looping ? '⏸ Stop' : `▶ Play selected (${sel})`}</button>
        <button class="btn ghost small" id="hyAll">Tick all</button>
        <button class="btn ghost small" id="hyNone">Clear</button>
        <button class="btn ghost small ${hs.shuffle ? 'on' : ''}" id="hyShuffle" aria-pressed="${hs.shuffle}">🔀 Shuffle</button>
        <button class="btn ghost small ${hs.easy ? 'on' : ''}" id="hyEasy" aria-pressed="${hs.easy}">🎼 ${hs.easy ? 'Easy keys' : 'Main keys'}</button>
      </div>
      <div class="hy-list">${list.map(h => {
        const playing = kind === 'hymns' && hymnNow === h.n, ticks = !hs.sel || hs.sel.includes(h.n);
        return `<div class="hy-row ${playing ? 'on' : ''}">
          <input type="checkbox" class="hy-tick" data-sel="${h.n}" ${ticks ? 'checked' : ''} aria-label="Include ${esc(h.title)}">
          <button class="hy-name hy-loop" data-n="${h.n}"><b>${h.n}. ${esc(h.title)}</b><small>${keyName(hymnKey(h))} · ${h.ts} · ${esc(h.prog)}${h.chordsOnly ? ' · chords only' : ''}${playing ? (hs.one ? ' · 🔂 on repeat' : ' · ▶ in the loop') : ''}</small></button>
          <button class="hy-play" data-n="${h.n}" aria-label="${playing && hs.one ? 'Stop' : 'Play ' + esc(h.title) + ' on repeat'}">${playing && hs.one ? '⏸' : '🔂'}</button>
        </div>`;
      }).join('')}</div>
      <p class="muted small">Played on piano in four-part harmony (soprano, alto, tenor, bass) from public-domain scores (the freehymns project). <b>Great Is Thy Faithfulness</b> (1923) and <b>How Great Thou Art</b> (1949) are still under copyright in most countries, so for those two only the chord progression is played, not the tune.</p>`;
  }
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
        <h3 class="section-title">⛪ Hymns</h3>
        <div id="hymnList">${hymnsHTML()}</div>
        <h3 class="section-title">🎶 My music</h3>
        <div id="myMusic"><p class="muted small">Loading…</p></div>
        <label class="flabel" for="musVol">Volume</label>
        <input type="range" id="musVol" min="0" max="100" value="${Math.round(volume * 100)}" class="vol">
        <label class="check-row"><input type="checkbox" id="musListen" ${o.ambient ? 'checked' : ''}> Play ${esc((track(o.ambient || kind || 'calm') || TRACKS[0])[2].toLowerCase())} when I listen to the Bible read aloud</label>
        <p class="muted small">The sounds above are generated on your phone. Music you add stays on this phone and is never uploaded.</p>
      </div>`;
    window.UI.openModal(html());
    const bind = () => {
      document.querySelectorAll('.music-panel .track').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'hymns' && kind !== 'hymns') { hs.one = 0; saveHymns(); }
        if (kind === k) stop(); else { start(k); if (store().ambient) { store().ambient = k; window.Core.save(); } }
        refresh();
      }));
      document.getElementById('musVol').addEventListener('input', e => { setVolume(e.target.value / 100); window.Core.state.musicVolume = volume; });
      document.getElementById('musVol').addEventListener('change', () => window.Core.save());
      document.getElementById('musListen').addEventListener('change', e => { store().ambient = e.target.checked ? (kind || 'calm') : ''; window.Core.save(); });
      bindHymns();
    };
    const drawHymns = () => { const host = document.getElementById('hymnList'); if (host) { host.innerHTML = hymnsHTML(); bindHymns(); } };
    const bindHymns = () => {
      const host = document.getElementById('hymnList'); if (!host) return;
      const on = (id, f) => { const b = host.querySelector(id); if (b) b.addEventListener('click', f); };
      on('#hyPlaySel', () => {
        if (kind === 'hymns' && !hs.one) { stop(); return; }
        if (!ticked().length) { window.Core.toast('Tick the hymns you want first'); return; }
        playHymn(ticked()[0].n, false);
      });
      on('#hyAll', () => { hs.sel = null; saveHymns(); drawHymns(); });
      on('#hyNone', () => { hs.sel = []; saveHymns(); drawHymns(); });
      on('#hyShuffle', () => { hs.shuffle = !hs.shuffle; saveHymns(); drawHymns(); });
      on('#hyEasy', () => {
        hs.easy = !hs.easy; saveHymns();
        if (kind === 'hymns') playHymn(hymnNow, !!hs.one); else drawHymns();
      });
      host.querySelectorAll('[data-sel]').forEach(cb => cb.addEventListener('change', () => {
        const n = +cb.dataset.sel, cur = hs.sel || HYMNAL().map(h => h.n);
        hs.sel = cb.checked ? [...new Set(cur.concat(n))] : cur.filter(x => x !== n);
        if (hs.sel.length === HYMNAL().length) hs.sel = null;
        saveHymns(); drawHymns();
      }));
      host.querySelectorAll('.hy-play').forEach(b => b.addEventListener('click', () => {
        const n = +b.dataset.n;
        if (kind === 'hymns' && hymnNow === n && hs.one === n) stop(); else playHymn(n, true);
      }));
      host.querySelectorAll('.hy-loop').forEach(b => b.addEventListener('click', () => {
        const n = +b.dataset.n;
        playHymn(n, !ticked().some(h => h.n === n));   // a ticked hymn starts the loop here; an unticked one plays on its own
      }));
    };
    const drawMine = async () => {
      const host = document.getElementById('myMusic'); if (!host) return;
      await loadList();
      const use = await window.MediaStore.usage();
      if (!document.getElementById('myMusic')) return;
      const total = myList.reduce((a, x) => a + (x.size || 0), 0);
      host.innerHTML = `
        <p class="muted small">Play your own songs, worship music or sermons from this phone. They play like a music player, so they can usually keep going with the screen locked.</p>
        <p class="muted small">Can't see your downloaded songs? Tap <b>📁 Browse all files</b>, open the menu (☰) and choose <b>Downloads</b>, <b>Music</b>, your phone's storage or a WhatsApp/Telegram folder. You can pick many songs at once by pressing and holding.</p>
        <div class="row gap wrap">
          <label class="btn primary small add-music">＋ Add music<input type="file" id="musFiles" accept="audio/*,video/mp4,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.amr,.3gp,.wma,.webm" multiple hidden></label>
          <label class="btn ghost small add-music">📁 Browse all files<input type="file" id="musAny" multiple hidden></label>
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
      host.querySelectorAll('#musFiles, #musAny').forEach(inp => inp.addEventListener('change', async e => {
        const files = [...e.target.files]; e.target.value = '';
        if (!files.length) return;
        window.Core.toast(`Adding ${files.length} file${files.length === 1 ? '' : 's'}…`);
        const n = await addFiles(files); drawMine(); if (n && !kind) start('mine');
      }));
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
    if (kind === 'hymns' && !hs.one) {
      const skip = document.createElement('button'); skip.className = 'mp-next'; skip.textContent = '⏭'; skip.setAttribute('aria-label', 'Next hymn');
      skip.addEventListener('click', () => hymnSkip(1)); el.appendChild(skip);
    }
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

  window.Ambient = { openPanel, addFiles, playable, myMusic: () => loadList(), player: () => player, level, TRACKS, HYMNAL, playHymn, nextHymn: () => hymnSkip(1), hymnState: () => Object.assign({ now: hymnNow }, hs), start, stop, preview, setVolume, volume: () => volume, track, playing: () => kind, nowPlaying: () => current, onChange: fn => listeners.push(fn) };
})();
