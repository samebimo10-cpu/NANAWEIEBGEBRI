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
    ['hymns', '⛪', 'Hymns & songs', 'Hymns and devotional songs, two verses or more'],
    ['pad', '🎻', 'Soft strings', 'A warm, slowly changing chord'],
    ['rain', '🌧️', 'Rain', 'Steady, soft rain']
  ];
  const OLD = { piano: 'calm' };   // earlier name for the piano track

  let ac = null, master = null, meter = null, verb = null, dry = null, timers = [], nodes = [], kind = '', previewTimer = null, volume = 0.7;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const listeners = [];
  const changed = () => listeners.forEach(f => f(kind));

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      // 'playback' asks the phone for larger sound buffers: steadier sound, no crackle when it is busy
      try { ac = new AC({ latencyHint: 'playback' }); } catch (e) { ac = new AC(); }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  /* A soft hall: a convolution reverb from a decaying impulse that grows darker as it fades (no hiss),
     then a gentle limiter so loud chords never distort. The piano and the pad each have their own path,
     so the worship sounds can colour them separately. */
  let pianoIn = null, pianoTone = null, padIn = null, wet = null;
  function hallIR(c, secs, dark) {
    const len = Math.floor(c.sampleRate * secs), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len, k = dark * Math.pow(1 - x, 2) + 0.02;   // a low-pass that closes over time
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x, 3) * (i < 40 ? i / 40 : 1);
      }
    }
    return ir;
  }
  function setup(c) {
    if (master) return;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.25;
    limiter.connect(c.destination);
    master = c.createGain(); master.gain.value = 0; master.connect(limiter);
    meter = c.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
    dry = c.createGain(); dry.gain.value = 0.8; dry.connect(master);
    verb = c.createConvolver(); verb.buffer = hallIR(c, 2.4, 0.35);
    wet = c.createGain(); wet.gain.value = 1.1;
    verb.connect(wet).connect(master);
    // the piano's own path (its tone colour changes with the worship sound)
    pianoTone = c.createBiquadFilter(); pianoTone.type = 'lowpass'; pianoTone.frequency.value = 20000; pianoTone.Q.value = 0.2;
    pianoIn = pianoTone; pianoTone.connect(dry); pianoTone.connect(verb);
    // the pad's path: kept out of the low end (high-passed at 200 Hz) and well under the piano
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 200; hp.Q.value = 0.5;
    padIn = c.createGain(); padIn.gain.value = 1; padIn.connect(hp); hp.connect(dry); hp.connect(verb);
    warmPiano(c);
  }
  /* The three worship sounds (patch combinations), and the everyday sound for everything else. */
  const ATMOS = {
    prayer: { name: 'Contemplative prayer', sub: 'dark felt piano, soft warm pad, large hall', piano: 1500, pad: 'warm', hall: [3.6, 0.3], wet: 0.8, mute: 1 },
    adoration: { name: 'Solemn adoration', sub: 'classical grand, slow bowed strings, cathedral', piano: 7000, pad: 'strings', hall: [5.2, 0.4], wet: 1.25, mute: 1 },
    sanctuary: { name: 'Sacred sanctuary', sub: 'muted upright, choir "aahs", ambient space', piano: 1100, pad: 'choir', hall: [4.2, 0.22], wet: 1.0, mute: 0.55 }
  };
  let atmosNow = '';
  function applyAtmos(c, key) {
    if (!pianoTone || atmosNow === (key || '')) return;
    atmosNow = key || '';
    const a = ATMOS[key], t = c.currentTime;
    pianoTone.frequency.setTargetAtTime(a ? a.piano : 20000, t, 0.1);
    wet.gain.setTargetAtTime(a ? a.wet : 1.1, t, 0.3);
    verb.buffer = a ? hallIR(c, a.hall[0], a.hall[1]) : hallIR(c, 2.4, 0.35);
  }
  const every = (fn, ms) => { timers.push(setInterval(fn, ms)); };
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  function clear() {
    timers.forEach(t => { clearInterval(t); clearTimeout(t); }); timers = [];
    nodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { /* already stopped */ } });
    nodes = [];
  }
  let rendering = false;   // true while a song is being drawn offline: those sounds are not ours to stop
  const keep = n => { if (rendering) return n; nodes.push(n); if (nodes.length > 400) nodes.splice(0, 200); return n; };

  /* ---------------- A gentle piano voice ----------------
   * Each note is drawn once, ahead of time, into a short recording (every third key; the keys between play it a
   * little faster or slower). Playing a note is then one light sound source instead of a stack of oscillators,
   * so phones keep up and the sound stays clean. Until the recordings are ready, the notes are made live. */
  const SR = 22050, samples = new Map();
  const anchor = m => Math.max(24, Math.min(105, Math.round((m - 21) / 3) * 3 + 21));
  function partials(c, out, midi, t, vel, len) {
    const f = hz(midi);
    [[1, 1, 1], [2, 0.42, 0.75], [3, 0.18, 0.55], [4, 0.08, 0.4], [5, 0.04, 0.3]].forEach(([h, amp, decay]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * h * (1 + 0.0004 * h * h);
      const a = vel * amp * 0.27, d = Math.max(0.6, len * decay * (midi > 72 ? 0.7 : 1));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.012);
      g.gain.exponentialRampToValueAtTime(a * 0.35, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); if (c === ac) keep(o);
    });
  }
  function warmPiano(c) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    for (let m = 24; m <= 105; m += 3) {
      if (samples.has(m)) continue;
      const secs = m < 60 ? 6 : m < 76 ? 5 : 3.5;
      try {
        const oc = new OAC(1, Math.ceil(SR * secs), SR), tone = oc.createBiquadFilter();
        tone.type = 'lowpass'; tone.frequency.value = Math.min(2600, hz(m) * 9); tone.Q.value = 0.3; tone.connect(oc.destination);
        partials(oc, tone, m, 0, 1, secs);
        samples.set(m, 'pending');
        Promise.resolve(oc.startRendering()).then(buf => samples.set(m, buf)).catch(() => samples.delete(m));
      } catch (e) { return; }
    }
  }
  function piano(c, midi, t, vel = 0.5, len = 4, damp = 0.18) {
    const a = anchor(midi), buf = samples.get(a);
    if (buf && typeof buf === 'object') {
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf; s.playbackRate.value = Math.pow(2, (midi - a) / 12);
      // the recording fades by itself; let the damper come down at the end of the note
      const end = t + Math.max(0.5, len * (midi > 72 ? 0.7 : 1));
      g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, end, damp);
      s.connect(g); g.connect(pianoIn || dry); if (!pianoIn) g.connect(verb);
      s.start(t); s.stop(Math.min(end + 1.2, t + buf.duration / s.playbackRate.value)); keep(s);
      return;
    }
    const out = c.createGain(), tone = c.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 1800 + vel * 1600; tone.Q.value = 0.3;
    out.connect(tone); tone.connect(pianoIn || dry); if (!pianoIn) tone.connect(verb);
    partials(c, out, midi, t, vel, len);
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
  const hs = { sel: null, one: 0, easy: false, shuffle: false, drums: true, show: 'all', verses: 2, worship: 'devotional', atmos: 'prayer' };   // sel: ticked hymn numbers (null = all); one: the hymn on repeat
  try { Object.assign(hs, JSON.parse(localStorage.getItem('lamp-hymns') || '{}')); } catch (e) { /* defaults */ }
  if (!['all', 'hymns', 'devotional', '1906'].includes(hs.show)) hs.show = 'all';
  const saveHymns = () => { try { localStorage.setItem('lamp-hymns', JSON.stringify(hs)); } catch (e) { /* not saved */ } };
  let hymnalAll = null;
  const HYMNAL = () => {
    const a = window.HYMNAL || [], b = window.HYMNAL_1906 || [];
    if (!hymnalAll || hymnalAll.n !== a.length + b.length) { hymnalAll = a.concat(b); hymnalAll.n = a.length + b.length; }
    return hymnalAll;
  };
  /* Hymns of Worship and Service (1906) is a separate file, loaded only when the hymn list is opened. */
  let book1906 = null;
  function load1906() {
    if (window.HYMNAL_1906) return Promise.resolve();
    if (book1906) return book1906;
    book1906 = new Promise(res => {
      const inline = document.getElementById('hymns1906-src');
      if (inline) { try { new Function(inline.textContent)(); } catch (e) { /* not loaded */ } res(); return; }
      const s = document.createElement('script'); s.src = 'js/data/hymns1906.js';
      s.onload = () => res(); s.onerror = () => { book1906 = null; res(); };
      document.head.appendChild(s);
    });
    return book1906;
  }
  const hymnBy = n => HYMNAL().find(h => h.n === n);
  let hymnQuery = '';
  const shown = () => {
    const q = hymnQuery.trim().toLowerCase();
    return HYMNAL().filter(h => (hs.show === 'hymns' ? !h.theme && !h.book : hs.show === 'devotional' ? !!h.theme : hs.show === '1906' ? !!h.book : true) &&
      (!q || (h.title + ' ' + (h.tune || '') + ' ' + (h.section || '') + ' ' + (h.book ? h.no : h.n)).toLowerCase().includes(q)));
  };
  const ticked = () => shown().filter(h => !hs.sel || hs.sel.includes(h.n));   // ticked, in the list being shown
  const keyName = k => k.replace('b', '♭').replace('#', '♯') + ' major';
  const hymnKey = h => hs.easy ? h.easy : h.key;
  function shiftFor(h) { const s = (KEYPC[hymnKey(h)] - KEYPC[h.key] + 12) % 12; return s > 6 ? s - 12 : s; }
  const PACE = 0.85;                      // a little slower than congregational singing: calm, for prayer
  const VEL = [0.46, 0.19, 0.19, 0.3];    // melody clear, inner voices soft, a warm bass
  const DEG = { I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16] };

  /* ---------------- Keyboard backing ----------------
   * For songs with no public-domain score (and the two hymns whose tunes are still under copyright): the song's
   * chords in its key, played in its keyboard style, for singing along. */
  const STYLE = st => {
    st = (st || '').toLowerCase();
    if (/afro-?beat/.test(st)) return 'afrobeat';
    if (/highlife|afro-praise|mid-tempo|joyful|^praise/.test(st)) return 'highlife';
    if (/syncopated/.test(st)) return 'syncmarch';
    if (/march|processional/.test(st)) return 'march';
    if (/ballad/.test(st)) return 'ballad';
    if (/worship|meditative|slow praise/.test(st)) return 'worship';
    return 'hymn';
  };
  const STYLE_BPM = { hymn: 76, march: 96, syncmarch: 104, highlife: 112, afrobeat: 116, worship: 66, ballad: 72 };
  // a close chord near middle C, moving as little as possible from the last one
  function voicing(pcs, prev) {
    let best = null, cost = 1e9;
    for (let lo = 53; lo <= 61; lo++) {
      const ch = pcs.map(pc => lo + ((pc - lo) % 12 + 12) % 12).sort((x, y) => x - y);
      const c2 = prev ? ch.reduce((acc, m, i) => acc + Math.abs(m - prev[Math.min(i, prev.length - 1)]), 0) : Math.abs(ch[0] - 57);
      if (c2 < cost) { cost = c2; best = ch; }
    }
    return best;
  }
  function backing(h) {
    const sty = STYLE(h.backing), T = 24;
    const [bn, bd] = (h.ts.match(/(\d+)\/(\d+)/) || [0, 4, 4]).slice(1).map(Number);
    const beat = bd === 8 ? T / 2 : T * 4 / bd, bar = bn * beat, three = bn === 3;
    const steps = h.prog.split(/\s*[–-]\s*/).map(x => x.trim()).filter(Boolean).map(x => ({ deg: DEG[x.replace(/[^IViv]/g, '')] || DEG.I, sev: /7/.test(x) }));
    const key = KEYPC[h.key], notes = [];
    const add = (st, du, m, v, vel) => notes.push([st, du, m, v, vel]);
    let t = 0, prev = null, top = 72;
    const perVerse = Math.max(1, Math.round(8 / steps.length)), rounds = perVerse * Math.max(2, hs.verses || 2);
    const playBar = ({ deg, sev }, last) => {
      const pcs = deg.map(x => (key + x) % 12).concat(sev ? [(key + deg[0] + 10) % 12] : []);
      const ch = voicing(pcs, prev); prev = ch;
      const bass = 36 + (key + deg[0]) % 12, fifth = bass + 7, hi = ch.map(m => m + 12);
      const cands = []; pcs.forEach(pc => [60, 72].forEach(o => cands.push(o + pc)));
      top = cands.filter(m => m >= 64 && m <= 79).sort((x, y) => Math.abs(x - top) - Math.abs(y - top))[0] || top;
      const chord = (st, du, vel) => ch.forEach(m => add(t + st, du, m, 1, vel));
      if (last) { add(t, bar * 2, bass, 3, 0.3); add(t, bar * 2, bass - 12, 3, 0.18); chord(0, bar * 2, 0.17); add(t, bar * 2, top, 0, 0.26); t += bar * 2; return; }
      if (sty === 'hymn') {
        const hits = three ? [[0, 48], [48, 24]] : bn === 4 ? [[0, 48], [48, 48]] : [[0, bar]];
        hits.forEach(([st, du]) => { add(t + st, du, bass, 3, 0.4); add(t + st, du, bass - 12, 3, 0.16); chord(st, du, 0.26); add(t + st, du, top, 0, 0.4); });
      } else if (sty === 'worship' || sty === 'ballad') {
        add(t, bar, bass, 3, 0.34); chord(0, bar, 0.1);
        const arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]];
        for (let i = 0; i < bn * 2; i++) add(t + i * beat / 2, beat * 1.4, arp[i % arp.length], 1, i % 2 ? 0.16 : 0.21);
        if (sty === 'ballad') { add(t, 1, 1, 4, 0.5); add(t + beat * (three ? 2 : 2), 1, 5, 4, 0.3); add(t + beat * (three ? 2.5 : 2.5), 1, 1, 4, 0.3); }
      } else if (sty === 'march' || sty === 'syncmarch') {
        add(t, beat, bass, 3, 0.32); if (!three) add(t + beat * 2, beat, fifth, 3, 0.26);
        for (let i = three ? 1 : 0; i < bn; i++) chord(i * beat, beat * 0.75, i === 0 ? 0.2 : 0.15);
        if (sty === 'syncmarch') {
          chord(beat * 1.5, beat * 0.5, 0.14);
          for (let i = 0; i < bn; i++) { add(t + i * beat, 1, i % 2 ? 5 : 1, 4, i % 2 ? 0.45 : 0.6); add(t + i * beat + beat / 2, 1, 2, 4, 0.35); }
        }
      } else {   // highlife and afro-beat: bouncing bass, guitar-like picking on the off-beats, light percussion
        const e = beat / 2;
        if (three) { add(t, beat, bass, 3, 0.32); chord(beat, e, 0.15); chord(beat * 2, e, 0.15); }
        else {
          add(t, e * 1.5, bass, 3, 0.32); add(t + e * 2.5, e, fifth, 3, 0.24); add(t + e * 4, e * 1.5, bass + 12, 3, 0.26); add(t + e * 7, e, fifth, 3, 0.22);
          const pick = [hi[2], hi[1], hi[2], hi[0], hi[2], hi[1], hi[2], hi[0]];
          pick.forEach((m, i) => add(t + i * e, e * 0.9, m, 1, i % 2 ? 0.15 : 0.1));
          chord(e * 3, e, 0.13); chord(e * 5, e, 0.13);
        }
        const div = sty === 'afrobeat' ? beat / 4 : e;
        for (let x = 0; x < bar; x += div) add(t + x, 1, 2, 4, (x / div) % 2 ? 0.5 : 0.3);   // shaker
        add(t, 1, 1, 4, 0.6); if (!three) add(t + e * 3, 1, 1, 4, 0.45);                       // kick
        (three ? [e * 3, e * 5] : sty === 'afrobeat' ? [e * 1.5, e * 3, e * 5.5, e * 7] : [e * 3, e * 6, e * 7]).forEach((x, i) => add(t + x, 1, i % 2 ? 4 : 3, 4, 0.45));   // congas
        if (sty === 'afrobeat' && !three) [beat, beat * 3].forEach(x => add(t + x, 1, 5, 4, 0.4));
      }
      t += bar;
    };
    for (let r = 0; r < rounds; r++) steps.forEach(stp => playBar(stp, false));
    playBar({ deg: DEG.I, sev: false }, true);
    notes.sort((x, y) => x[0] - y[0]);
    return { notes, len: t, bpm: STYLE_BPM[sty], pace: 1, verses: rounds / perVerse, verseLen: perVerse * steps.length * bar };
  }
  /* light percussion: 1 kick, 2 shaker, 3 high conga, 4 low conga, 5 rim */
  let noiseBuf = null;
  function drum(c, type, t, vel) {
    vel *= 0.55;
    const g = c.createGain(); g.connect(dry);
    if (type === 1) {
      const o = c.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(g); o.start(t); o.stop(t + 0.36); keep(o);
    } else if (type === 2 || type === 5) {
      if (!noiseBuf) noiseBuf = noiseBuffer(c, 1, false);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), dur = type === 2 ? 0.045 : 0.07;
      s.buffer = noiseBuf; f.type = type === 2 ? 'highpass' : 'bandpass'; f.frequency.value = type === 2 ? 6500 : 1900; f.Q.value = type === 2 ? 0.7 : 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * (type === 2 ? 0.16 : 0.35), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g); s.start(t, Math.random() * 0.9); s.stop(t + dur + 0.01); keep(s);
    } else {
      const o = c.createOscillator(), f0 = type === 3 ? 340 : 230;
      o.frequency.setValueAtTime(f0 * 1.35, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.03);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(verb); o.start(t); o.stop(t + 0.22); keep(o);
    }
  }
  /* ---------------- Worship style ----------------
   * The way a worship pianist keeps an atmosphere of reverent prayer:
   *  - spacious voicings: root and 5th low in the left hand (keeping the hymn's own bass line, so inversions
   *    like I/5 and V/7 still smooth the changes), the 3rd and 9th high in the right hand, the middle left open;
   *  - the tune on top, gentle upward arpeggios (1-5-9-3) instead of block chords;
   *  - quiet dynamics (p to mp), the sustain pedal changed on every chord, so chords never blur;
   *  - gentle tension and release: suspensions resolving into the chord (sus2 → 3, sus4 → 3);
   *  - a warm pad about a quarter as loud as the piano, kept out of the low end, swelling in after the piano. */
  const worshipOn = h => hs.worship === 'all' || ((hs.worship || 'devotional') === 'devotional' && !!h.theme);
  function chordAt(notes, a, b, bassPc) {
    const w = new Array(12).fill(0);
    notes.forEach(([st, du, m, v]) => { const o = Math.min(b, st + du) - Math.max(a, st); if (o > 0) w[m % 12] += o * (v === 3 ? 2 : v === 0 ? 1.2 : 1); });
    let best = { score: -1e9 };
    for (let r = 0; r < 12; r++) for (const third of [4, 3]) {
      const tones = [r, (r + third) % 12, (r + 7) % 12], allowed = tones.concat([(r + 10) % 12, (r + 2) % 12]);
      const score = w[r] * 1.25 + w[tones[1]] + w[tones[2]] * 0.8 + (r === bassPc ? 2 : 0) - w.reduce((acc, x, pc) => acc + (allowed.includes(pc) ? 0 : x * 0.9), 0);
      if (score > best.score) best = { score, root: r, third };
    }
    return best;
  }
  function worshipify(notes, h) {
    const melody = notes.filter(n => n[3] === 0), bassLine = notes.filter(n => n[3] === 3).sort((x, y) => x[0] - y[0]);
    const end = Math.max(...notes.map(n => n[0] + n[1]));
    const triple = /^(3\/4|6\/8|9\/8|3\/2)$/.test(h.meter || h.ts || '');
    const cuts = [];
    bassLine.forEach(n => { if (!cuts.length || n[0] - cuts[cuts.length - 1].st >= 18) cuts.push({ st: n[0], bass: n[2] }); });
    if (!cuts.length || cuts[0].st > 0) cuts.unshift({ st: 0, bass: bassLine.length ? bassLine[0][2] : 48 });
    const out = melody.map(n => [n[0], n[1], n[2], 0, 0.34]);   // the tune, played gently (mp)
    const up = (from, pc) => from + 1 + ((pc - from - 1) % 12 + 12) % 12;      // the first note above 'from' with this pitch
    const tuneAt = x => (melody.find(n => n[0] <= x && x < n[0] + n[1]) || [0, 0, 84])[2];
    let susTurn = 0;
    cuts.forEach((cut, i) => {
      const a = cut.st, b = i + 1 < cuts.length ? cuts[i + 1].st : end, len = b - a;
      if (len <= 0) return;
      const ch = chordAt(notes, a, b, cut.bass % 12), root = ch.root, thirdPc = (root + ch.third) % 12, ninthPc = (root + 2) % 12;
      // left hand: the bass (low, open) and the 5th above it (the root, when the hymn's bass is already the 5th)
      let lo = cut.bass; while (lo > 47) lo -= 12; while (lo < 36) lo += 12;
      const second = up(lo, lo % 12 === (root + 7) % 12 ? root : (root + 7) % 12);
      out.push([a, len, lo, 3, 0.22], [a + 2, len, second, 3, 0.14]);
      // right hand, high: the 3rd (around E4) and the 9th (around D5), under the tune; the middle stays open
      const top = tuneAt(a);
      const third = up(top > 69 ? 59 : 54, thirdPc), ninth = up(third + 6, ninthPc);   // around E4 and D5; a little lower under a low tune
      const hasThird = third < top - 1 && thirdPc !== top % 12, hasNinth = ninth < top - 1;
      if (hasNinth) out.push([a + 3, len - 3, ninth, 2, 0.1]);
      if (hasThird) {
        // tension and release: on longer chords, a suspension that resolves into the 3rd
        const sus = len >= 36 ? (susTurn++ % 2 ? 'sus2' : 'sus4') : '';
        const susNote = sus === 'sus4' ? third + (ch.third === 4 ? 1 : 2) : third - (ch.third === 4 ? 2 : 1);   // 4 falls to 3, 2 rises to 3
        const tuneClash = [susNote % 12, thirdPc].some(pc => melody.some(n => n[0] < a + 24 && n[0] + n[1] > a && n[2] % 12 === pc));
        if (sus && !tuneClash && susNote < top - 1) {
          const held = Math.min(24, Math.floor(len / 2));
          out.push([a + 3, held, susNote, 1, 0.1], [a + 3 + held, len - 3 - held, third, 1, 0.09]);
        } else out.push([a + 3, len - 3, third, 1, 0.1]);
      }
      // gentle upward arpeggio, 1-5-9-3, above the middle of the keyboard and under the tune:
      // eighth notes in 3/4 and 6/8, quarter notes in 4/4
      const step = triple ? 12 : 24, base = up(54, root), arp = [base, base + 7, base + 14, base + 12 + ch.third];
      for (let x = step, k = 1; x < len; x += step, k++) {
        const m = arp[k % arp.length];
        if (m < tuneAt(a + x) - 1) out.push([a + x, len - x, m, 1, 0.08]);
      }
      // the pad: root, 5th, 9th and the octave, in the middle, swelling in softly
      [root, root + 7, root + 2, root].forEach((pc, j) => { const m = 55 + ((pc - 55) % 12 + 12) % 12 + (j === 3 ? 12 : 0); out.push([a, len, m, 5, 1]); });
    });
    return out.sort((x, y) => x[0] - y[0]);
  }
  /* The pad layer: warm (soft analog), strings (slow bowed) or choir "aahs". It swells in after the piano and
     lets go at each chord change, like lifting the pedal, so two chords never blur into each other. */
  const PAD_MIX = 0.022;
  function padTone(c, midi, t, len, type) {
    const g = c.createGain(), f = c.createBiquadFilter(), f0 = hz(midi);
    const attack = Math.min(type === 'strings' ? 1.6 : 1.2, Math.max(0.3, len * 0.6)), lvl = PAD_MIX * (type === 'choir' ? 2.5 : type === 'strings' ? 0.62 : 0.37);   // about 30/70 against the piano
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + attack); g.gain.setValueAtTime(lvl, t + Math.max(attack, len));
    g.gain.linearRampToValueAtTime(0, t + Math.max(attack, len) + 0.35);
    const stop = t + Math.max(attack, len) + 0.4;
    g.connect(padIn || dry);
    if (type === 'choir') {
      // a voice-like "ah": a soft buzz through two vowel formants
      const v1 = c.createBiquadFilter(), v2 = c.createBiquadFilter();
      v1.type = v2.type = 'bandpass'; v1.frequency.value = 750; v2.frequency.value = 1150; v1.Q.value = 6; v2.Q.value = 8;
      f.type = 'lowpass'; f.frequency.value = 2400;
      v1.connect(f); v2.connect(f); f.connect(g);
      [-7, 7].forEach(cents => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = cents; o.connect(v1); o.connect(v2); o.start(t); o.stop(stop); keep(o); });
    } else {
      f.type = 'lowpass'; f.frequency.value = type === 'strings' ? 1500 : 850; f.Q.value = 0.4; f.connect(g);
      [-6, 6].forEach((cents, i) => {
        const o = c.createOscillator(); o.type = type === 'strings' ? 'sawtooth' : i ? 'sine' : 'triangle';
        o.frequency.value = f0; o.detune.value = cents; o.connect(f); o.start(t); o.stop(stop); keep(o);
        if (type === 'strings') { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 4.8 + i * 0.4; lg.gain.value = 5; l.connect(lg).connect(o.detune); l.start(t); l.stop(stop); keep(l); }
      });
    }
  }
  function score(h) {
    if (h.backing) return backing(h);
    const a = h.notes;
    let notes = [];
    for (let i = 0; i < a.length; i += 4) notes.push([a[i], a[i + 1], a[i + 2], a[i + 3]]);
    const worship = worshipOn(h);
    if (worship) notes = worshipify(notes, h);
    // at least two verses (each with its chorus), a breath of two beats between them, the last chord held longer
    const n = Math.max(2, hs.verses || 2), span = h.len + 48, all = [];
    for (let v = 0; v < n; v++) notes.forEach(x => {
      const y = x.slice(); y[0] += v * span;
      if (v === n - 1 && x[0] + x[1] >= h.len - 2) y[1] = Math.round(x[1] * 1.8);
      all.push(y);
    });
    return { notes: all, len: (n - 1) * span + h.len + 24, bpm: h.bpm, verses: n, verseLen: span, worship };
  }
  /* ---------------- Playing the songs ----------------
   * Each song is drawn ahead of time into a sound file on the phone (offline, with the same piano, pad and hall),
   * then played like a music player: phones keep it going with the screen off and show it on the lock screen.
   * Where a phone cannot draw sound offline, the notes are played live instead (keep the screen on then). */
  let hymnNow = 0, hymnToken = 0, hymnSkip = () => {}, hymnFrom = 0, layerMute = '', song = null, hymnAudio = null, hymnPos = 0;
  const LEAD = 0.3;
  function playNotes(c, d, t0, spt, sh, live) {
    const atm = ATMOS[hs.atmos] || ATMOS.prayer;
    return (st, du, m, v, vel) => {
      const at = live ? Math.max(t0 + st * spt, c.currentTime + 0.01) : t0 + st * spt;
      if (v === 4) { if (hs.drums !== false) drum(c, m, at, vel); }
      else if (v === 5) { if (layerMute !== 'pad') padTone(c, m + sh, at, du * spt, atm.pad); }
      else if (layerMute === 'piano') return;
      // worship style: legato pedalling, lifted on every chord change, so nothing blurs
      else if (d.worship) piano(c, m + sh, at, vel || VEL[v] || 0.2, du * spt * (atm.mute < 1 && v === 0 ? 0.9 : 1) + 0.06, 0.06);
      else piano(c, m + sh, at, vel || VEL[v] || 0.2, Math.max(du * spt < 0.3 ? 0.6 : 1.2, du * spt * 1.3 + 0.4));
    };
  }
  /* the hall, piano path and pad path, built in another (offline) context */
  function graph(c, key) {
    const a = ATMOS[key], limiter = c.createDynamicsCompressor(), out = c.createGain();
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.25;
    limiter.connect(c.destination); out.connect(limiter);
    const g = { dry: c.createGain(), verb: c.createConvolver() };
    g.dry.gain.value = 0.8; g.dry.connect(out);
    g.verb.buffer = a ? hallIR(c, a.hall[0], a.hall[1]) : hallIR(c, 2.4, 0.35);
    const w = c.createGain(); w.gain.value = a ? a.wet : 1.1; g.verb.connect(w); w.connect(out);
    g.pianoIn = c.createBiquadFilter(); g.pianoIn.type = 'lowpass'; g.pianoIn.frequency.value = a ? a.piano : 20000; g.pianoIn.Q.value = 0.2;
    g.pianoIn.connect(g.dry); g.pianoIn.connect(g.verb);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 200; hp.Q.value = 0.5;
    g.padIn = c.createGain(); g.padIn.connect(hp); hp.connect(g.dry); hp.connect(g.verb);
    return g;
  }
  function withGraph(g, fn) {
    const saved = [dry, verb, pianoIn, padIn];
    dry = g.dry; verb = g.verb; pianoIn = g.pianoIn; padIn = g.padIn; rendering = true;
    try { fn(); } finally { [dry, verb, pianoIn, padIn] = saved; rendering = false; }
  }
  function wavBlob(buf) {
    const ch = buf.numberOfChannels, n = buf.length, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, x) => { for (let i = 0; i < x.length; i++) data.setUint8(o + i, x.charCodeAt(i)); };
    str(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); data.setUint32(16, 16, true);
    data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, buf.sampleRate, true);
    data.setUint32(28, buf.sampleRate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    str(36, 'data'); data.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const x = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2; }
    return new Blob([data], { type: 'audio/wav' });
  }
  async function samplesReady() {
    for (let i = 0; i < 40 && [...samples.values()].some(x => typeof x !== 'object'); i++) await new Promise(r => setTimeout(r, 100));
  }
  const songKey = h => [h.n, hs.verses, hs.easy, hs.worship, hs.atmos, hs.drums, layerMute].join('|');
  const prepared = new Map();
  async function prepare(h) {
    const key = songKey(h);
    if (prepared.has(key)) return prepared.get(key);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || !ac) return null;
    await samplesReady();
    const d = score(h), spt = 60 / (d.bpm * (d.pace || PACE)) / 24, secs = LEAD + d.len * spt + 3.5;
    const oc = new OAC(1, Math.ceil(secs * SR), SR);
    withGraph(graph(oc, d.worship ? (hs.atmos in ATMOS ? hs.atmos : 'prayer') : ''), () => {
      const play = playNotes(oc, d, LEAD, spt, shiftFor(h), false);
      d.notes.forEach(n => play(...n));
    });
    const buf = await Promise.resolve(oc.startRendering());
    const out = { url: URL.createObjectURL(wavBlob(buf)), d, spt, h, key };
    prepared.set(key, out);
    for (const [k, v] of prepared) { if (prepared.size <= 3) break; if (v !== song) { URL.revokeObjectURL(v.url); prepared.delete(k); } }
    return out;
  }
  function getHymnAudio() {
    if (hymnAudio) return hymnAudio;
    hymnAudio = new Audio(); hymnAudio.preload = 'auto';
    hymnAudio.addEventListener('ended', () => { if (kind === 'hymns' && song && !song.live) hymnSkip(1, true); });
    hymnAudio.addEventListener('timeupdate', () => verseLabel());
    ['play', 'pause'].forEach(e => hymnAudio.addEventListener(e, () => { if (kind === 'hymns') changed(); }));
    mediaHandlers();
    return hymnAudio;
  }
  /* where we are in the song, in ticks from its start (for the verse count and the words) */
  function songTicks() {
    if (!song) return null;
    const t = song.live ? (ac ? ac.currentTime - song.t0 : 0) : (hymnAudio ? hymnAudio.currentTime - LEAD : 0);
    return t / song.spt;
  }
  let verseShown = 0;
  function verseLabel(force) {
    if (!song || kind !== 'hymns') return;
    const d = song.d, v = Math.min(d.verses || 1, 1 + Math.floor(Math.max(0, songTicks()) / d.verseLen));
    if (v === verseShown && !force) return;
    verseShown = v;
    current = song.h.title + (d.verses > 1 ? ` · verse ${v} of ${d.verses}` : '') + (hs.one ? ' (repeat)' : '');
    changed();
  }
  function hymns(c) {
    let order = (hs.one ? [hymnBy(hs.one)].filter(Boolean) : ticked()).map(h => h.n);
    if (!order.length) order = HYMNAL().map(h => h.n);
    if (!order.length) return;
    if (!hs.one && hs.shuffle) order.sort(() => Math.random() - 0.5);
    let iv = null;
    const el = getHymnAudio();
    if (!el.dataset.unlocked) {   // phones let a player start later only if it first played during a tap
      el.dataset.unlocked = '1';
      try { el.src = URL.createObjectURL(wavBlob(c.createBuffer(1, 2205, 22050))); el.play().catch(() => {}); } catch (e) { /* fine */ }
    }
    const fromFile = (s, at) => {
      song = s;
      el.src = s.url; el.loop = !!hs.one; el.volume = volume;
      if (at) { const seek = () => { try { el.currentTime = at; } catch (e) { /* not yet */ } }; seek(); el.addEventListener('loadedmetadata', seek, { once: true }); }
      el.play().catch(e => { if (e && e.name === 'NotAllowedError') window.Core.toast('Tap ▶ to start the music'); });
      if ('mediaSession' in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: s.h.title, artist: 'Hymns & songs', album: (window.Personal && window.Personal.appTitle()) || 'Lamp & Path' });
      }
    };
    const playAt = i => {
      const token = ++hymnToken;
      if (kind !== 'hymns') return;
      hymnPos = (i + order.length) % order.length;
      const h = hymnBy(order[hymnPos]); hymnNow = h.n;
      if (iv) { clearInterval(iv); iv = null; }
      el.pause(); verseShown = 0;
      const readyNext = () => { if (!hs.one && order.length > 1) setTimeout(() => { if (token === hymnToken) prepare(hymnBy(order[(hymnPos + 1) % order.length])).catch(() => {}); }, 2500); };
      const ready = prepared.get(songKey(h));
      if (ready) { fromFile(ready, 0); verseLabel(true); readyNext(); return; }
      // start at once, played live, while the sound file is being made; then carry on from the file
      const d = score(h), spt = 60 / (d.bpm * (d.pace || PACE)) / 24, t0 = c.currentTime + LEAD;
      applyAtmos(c, d.worship ? (hs.atmos in ATMOS ? hs.atmos : 'prayer') : '');
      master.gain.cancelScheduledValues(c.currentTime); master.gain.setTargetAtTime(volume, c.currentTime, 0.05);
      song = { live: true, d, spt, h, t0 };
      const play = playNotes(c, d, t0, spt, shiftFor(h), true);
      let k = 0;
      const pump = () => {
        if (token !== hymnToken || kind !== 'hymns' || !song || !song.live) return;
        verseLabel();
        const horizon = c.currentTime + 1.6;
        while (k < d.notes.length && t0 + d.notes[k][0] * spt < horizon) play(...d.notes[k++]);
        if (k >= d.notes.length && c.currentTime > t0 + d.len * spt + 2.2) playAt(hs.one ? hymnPos : hymnPos + 1);   // a short rest, then on
      };
      pump(); iv = setInterval(pump, 250); timers.push(iv);
      verseLabel(true);
      prepare(h).then(s => {
        if (!s || token !== hymnToken || kind !== 'hymns' || !song || !song.live) return;
        const at = LEAD + Math.max(0, c.currentTime - t0) + 0.08;
        if (at > LEAD + d.len * spt) return;   // nearly over: let the live playing finish it
        clearInterval(iv); iv = null;
        fromFile(s, at);
        // let the live notes fade as the file takes over
        master.gain.cancelScheduledValues(c.currentTime); master.gain.setTargetAtTime(0, c.currentTime + 0.05, 0.06);
        setTimeout(() => { if (kind === 'hymns' && song && !song.live) { clear(); } }, 600);
        readyNext();
      }).catch(() => {});
    };
    hymnSkip = (n, auto) => { if (kind === 'hymns') playAt(hymnPos + n); };
    const from = hymnFrom ? order.indexOf(hymnFrom) : 0; hymnFrom = 0;
    playAt(Math.max(0, from));
  }
  /* ---------------- Sing along ----------------
   * The words on a calm, dark screen: the line being sung large and lit, the next one waiting below.
   * The words follow the music line by line (each line starts on the note the score marks for it). */
  let wordsTimer = null;
  function openWords() {
    let el = document.getElementById('singAlong');
    if (!el) {
      el = document.createElement('div'); el.id = 'singAlong'; el.className = 'sing';
      el.innerHTML = `<div class="sing-top"><div><div class="sing-title"></div><div class="sing-verse"></div></div><button class="sing-x" aria-label="Close the words">✕</button></div>
        <div class="sing-lines" aria-live="polite"></div>
        <div class="sing-foot"><button class="sing-btn" data-k="prev" aria-label="Previous song">⏮</button><button class="sing-btn big" data-k="play" aria-label="Pause or play">⏸</button><button class="sing-btn" data-k="next" aria-label="Next song">⏭</button></div>`;
      document.body.appendChild(el);
      el.querySelector('.sing-x').addEventListener('click', closeWords);
      el.querySelectorAll('.sing-btn').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'play') { if (kind === 'hymns' && hymnAudio && song && !song.live) hymnAudio.paused ? hymnAudio.play() : hymnAudio.pause(); else if (kind === 'hymns') stop(); }
        else hymnSkip(k === 'next' ? 1 : -1);
      }));
    }
    el.classList.remove('hidden'); el.dataset.pass = '';
    document.body.classList.add('singing');
    clearInterval(wordsTimer); wordsTimer = setInterval(drawWords, 200); drawWords();
  }
  function closeWords() {
    clearInterval(wordsTimer); wordsTimer = null;
    const el = document.getElementById('singAlong'); if (el) el.classList.add('hidden');
    document.body.classList.remove('singing');
  }
  function drawWords() {
    const el = document.getElementById('singAlong'); if (!el || el.classList.contains('hidden')) return;
    const esc = window.Core.escapeHTML, h = song ? song.h : hymnBy(hymnNow), lines = el.querySelector('.sing-lines');
    const playBtn = el.querySelector('[data-k="play"]');
    playBtn.textContent = kind === 'hymns' && hymnAudio && song && !song.live && hymnAudio.paused ? '▶' : '⏸';
    el.querySelector('.sing-title').textContent = h ? h.title : '';
    if (kind !== 'hymns' || !h) { el.querySelector('.sing-verse').textContent = 'Not playing'; return; }
    if (!song) { el.querySelector('.sing-verse').textContent = 'Getting ready…'; return; }
    const w = h.words;
    if (!w) {
      el.querySelector('.sing-verse').textContent = '';
      if (el.dataset.pass !== 'none') { el.dataset.pass = 'none'; lines.innerHTML = `<p class="sl-note">${h.composed ? 'This is a new tune written for the app, so there are no words that go with it line by line.' : 'The words of this song are not available here.'}</p>`; }
      return;
    }
    const d = song.d, ticks = Math.max(0, songTicks() + 0.25 / song.spt);   // show each line a moment early
    const vi = Math.min((d.verses || 1) - 1, Math.floor(ticks / d.verseLen)), within = ticks - vi * d.verseLen;
    const pass = w.passes[vi % w.passes.length];
    el.querySelector('.sing-verse').textContent = (d.verses > 1 ? `Verse ${vi + 1} of ${d.verses}` : '') + (w.passes.length > (d.verses || 1) ? ` · the hymn has ${w.passes.length}` : '');
    const key = h.n + ':' + vi;
    if (el.dataset.pass !== key) {
      el.dataset.pass = key;
      lines.innerHTML = pass.map((l, i) => `<p class="sl" data-i="${i}">${esc(l)}</p>`).join('');
    }
    let cur = -1;
    if (w.starts) w.starts.forEach((st, i) => { if (within >= st) cur = i; });
    else cur = Math.min(pass.length - 1, Math.floor(within / (d.verseLen / pass.length)));
    const after = within > (w.starts ? w.starts[w.starts.length - 1] : 0) + d.verseLen * 0.02 && cur === pass.length - 1 && within > d.verseLen - 48;
    lines.querySelectorAll('.sl').forEach((p, i) => {
      p.classList.toggle('now', i === cur && !after); p.classList.toggle('past', i < cur || (after && i === cur)); p.classList.toggle('next', i === cur + 1);
    });
    const now = lines.querySelector('.sl.now') || lines.querySelector('.sl.next');
    if (now && now.dataset.i !== lines.dataset.shown) { lines.dataset.shown = now.dataset.i; now.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  function stopHymnAudio() { hymnToken++; if (hymnAudio) hymnAudio.pause(); song = null; }
  /* play one hymn (alone = on repeat), or the ticked hymns starting from this one */
  function playHymn(n, alone) {
    hs.one = alone ? n : 0; saveHymns();
    hymnFrom = n;
    if (kind === 'hymns') { clear(); stopHymnAudio(); kind = 'hymns'; hymns(ac); } else start('hymns');
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
    mediaHandlers();
    return player;
  }
  /* the lock-screen and headphone controls, for My music and the hymns */
  function mediaHandlers() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession, el = () => kind === 'mine' ? player : kind === 'hymns' ? hymnAudio : null;
    const on = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* not supported */ } };
    on('play', () => { const e = el(); if (e) e.play(); });
    on('pause', () => { const e = el(); if (e) e.pause(); });
    on('nexttrack', () => { if (kind === 'hymns') hymnSkip(1); else nextMine(1); });
    on('previoustrack', () => { if (kind === 'hymns') hymnSkip(-1); else nextMine(-1); });
    on('stop', () => stop());
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
      if (kind === 'hymns') stopHymnAudio();
      if (kind && kind !== 'mine') fadeOutGenerated();
      const i = from ? myList.findIndex(x => x.id === from) : (kind === 'mine' ? myIndex : 0);
      playMine(i < 0 ? 0 : i);
      return;
    }
    if (kind === 'mine') { stopMine(); kind = ''; }
    if (kind === k) return;
    if (kind === 'hymns') stopHymnAudio();
    const c = ctx(); if (!c) return;
    setup(c);
    if (k !== 'hymns') applyAtmos(c, '');
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
    if (kind === 'hymns') { stopHymnAudio(); if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; }
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
    if (hymnAudio) hymnAudio.volume = volume;
    if (ac && master && kind) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(volume, ac.currentTime, 0.2); }
  }
  /* a short sample in the settings */
  function preview(k) { start(k); clearTimeout(previewTimer); previewTimer = setTimeout(stop, 8000); }
  const track = k => (OLD[k] || k) === 'mine' ? MINE : TRACKS.find(t => t[0] === (OLD[k] || k));

  /* ---------------- The music panel and the "now playing" bar ---------------- */
  function hymnRows(list) {
    const esc = window.Core.escapeHTML;
    if (!list.length) return '<p class="muted small">No songs match.</p>';
    return list.map(h => {
      const playing = kind === 'hymns' && hymnNow === h.n, ticks = !hs.sel || hs.sel.includes(h.n);
      const what = (h.backing ? '🎹 keyboard backing' : h.composed ? '🎵 new tune' : '🎼 full hymn') + (h.words ? ' · 📜 words' : '');
      const about = h.book ? `${esc(h.tune)} · ${esc(h.hymnMeter || '')} · ${esc(h.section || '')} · ${keyName(hymnKey(h))}` : `${h.theme ? '<i>' + esc(h.theme) + '</i> · ' : ''}${keyName(hymnKey(h))} · ${esc(h.ts)} · ${esc(h.prog)}`;
      return `<div class="hy-row ${playing ? 'on' : ''}">
        <input type="checkbox" class="hy-tick" data-sel="${h.n}" ${ticks ? 'checked' : ''} aria-label="Include ${esc(h.title)}">
        <button class="hy-name hy-loop" data-n="${h.n}"><b>${h.book ? '📖 No. ' + h.no : h.n}. ${esc(h.title)}</b><small>${about} · ${what}${playing ? (hs.one ? ' · 🔂 on repeat' : ' · ▶ in the loop') : ''}</small></button>
        <button class="hy-play" data-n="${h.n}" aria-label="${playing && hs.one ? 'Stop' : 'Play ' + esc(h.title) + ' on repeat'}">${playing && hs.one ? '⏸' : '🔂'}</button>
      </div>`;
    }).join('');
  }
  function hymnsHTML() {
    const esc = window.Core.escapeHTML, list = shown(), sel = ticked().length, looping = kind === 'hymns' && !hs.one;
    if (!HYMNAL().length) return '<p class="muted small">The hymns could not be loaded.</p>';
    const tab = (k, label) => `<button class="chip ${hs.show === k ? 'active' : ''}" data-show="${k}">${label}</button>`;
    return `
      <p class="muted small">Each song plays at least two verses, each with its chorus (choose 2, 3 or 4 verses). Tap 🔂 to play one song over and over. Or tick the ones you want and tap <b>Play selected</b> (it plays the ticked songs in the list you are viewing) (or a song's name to start there): they play one after another, then start again from the first.</p>
      <div class="chips hy-show">${tab('all', 'All')}${tab('hymns', 'Hymns')}${tab('devotional', 'Devotional & spirituals')}${tab('1906', '📖 1906 Hymnal')}</div>
      <div class="chips hy-verses"><span class="muted small">🕊️ Worship style:</span>${[['off', 'Off'], ['devotional', 'Devotional songs'], ['all', 'All songs']].map(([k, l]) => `<button class="chip ${(hs.worship || 'devotional') === k ? 'active' : ''}" data-worship="${k}">${l}</button>`).join('')}</div>
      ${(hs.worship || 'devotional') !== 'off' ? `<div class="chips hy-verses"><span class="muted small">🎹 Worship sound:</span>${Object.entries(ATMOS).map(([k, a]) => `<button class="chip ${(hs.atmos || 'prayer') === k ? 'active' : ''}" data-atmos="${k}" title="${a.sub}">${a.name}</button>`).join('')}</div>
      <p class="muted small hy-atmos">${(ATMOS[hs.atmos] || ATMOS.prayer).sub}</p>` : ''}
      <div class="chips hy-verses"><span class="muted small">Verses:</span>${[2, 3, 4].map(n => `<button class="chip ${(hs.verses || 2) === n ? 'active' : ''}" data-verses="${n}">${n}</button>`).join('')}</div>
      <div class="row gap wrap hy-tools">
        <button class="btn ${looping ? 'ghost' : 'primary'} small" id="hyPlaySel">${looping ? '⏸ Stop' : `▶ Play selected (${sel})`}</button>
        <button class="btn ghost small" id="hyAll">Tick these</button>
        <button class="btn ghost small" id="hyNone">Untick these</button>
        <button class="btn ghost small ${hs.shuffle ? 'on' : ''}" id="hyShuffle" aria-pressed="${hs.shuffle}">🔀 Shuffle</button>
        <button class="btn ghost small ${hs.easy ? 'on' : ''}" id="hyEasy" aria-pressed="${hs.easy}">🎼 ${hs.easy ? 'Easy keys' : 'Main keys'}</button>
        <button class="btn ghost small" id="hyWords">📜 Sing along</button>
        <button class="btn ghost small ${hs.autoWords !== false ? 'on' : ''}" id="hyAutoWords" aria-pressed="${hs.autoWords !== false}">📜 Words open by themselves: ${hs.autoWords !== false ? 'on' : 'off'}</button>
        ${HYMNAL().some(h => h.backing) ? `<button class="btn ghost small ${hs.drums !== false ? 'on' : ''}" id="hyDrums" aria-pressed="${hs.drums !== false}">🥁 Drums ${hs.drums !== false ? 'on' : 'off'}</button>` : ''}
      </div>
      <input type="search" class="search hy-search" id="hySearch" placeholder="Search by title, tune or number" value="${esc(hymnQuery)}" aria-label="Search the hymns">
      <div class="hy-list">${hymnRows(list)}</div>
      ${hs.show === '1906' || hs.show === 'all' ? `<p class="muted small"><b>📖 1906 Hymnal</b>: ${(window.HYMNAL_1906 || []).length || 'the'} hymns from <i>Hymns of Worship and Service</i> (New York: The Century Co., 1906), the ones whose tunes have a clean public-domain score. The numbers are the book's.</p>` : ''}
      <p class="muted small"><b>🕊️ Worship style</b> plays the way a worship pianist keeps a reverent atmosphere: quiet (p to mp), with open voicings (root and 5th low, 3rd and 9th high, the middle left clear), gentle upward arpeggios under the tune, suspensions that resolve (sus2 → 3, sus4 → 3), the pedal changed on every chord, and a warm pad about a quarter as loud as the piano, kept out of the bass. Choose the sound: <b>Contemplative prayer</b>, <b>Solemn adoration</b> or <b>Sacred sanctuary</b>.</p>
      <p class="muted small"><b>🎼 Full hymns</b> play the hymn tune in four-part harmony (soprano, alto, tenor, bass) from public-domain scores (the freehymns project). <b>🎵 New tunes</b> are melodies written for this app, in four parts over each song's chords, for songs with no public-domain score. They are not the traditional melodies: <b>Great Is Thy Faithfulness</b> (1923), <b>How Great Thou Art</b> (1949) and <b>Be Still, My Soul</b> (sung to Sibelius's <i>Finlandia</i>) are still under copyright in many countries, so their usual tunes cannot be included.</p>`;
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
        <h3 class="section-title">⛪ Hymns &amp; songs</h3>
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
        if (!ticked().length) { window.Core.toast('Tick the songs you want first'); return; }
        playHymn(ticked()[0].n, false);
        if (hs.autoWords !== false) openWords();
      });
      on('#hyAll', () => { const all = HYMNAL().map(h => h.n), cur = hs.sel || all; hs.sel = [...new Set(cur.concat(shown().map(h => h.n)))]; if (hs.sel.length === all.length) hs.sel = null; saveHymns(); drawHymns(); });
      on('#hyNone', () => { const vis = shown().map(h => h.n); hs.sel = (hs.sel || HYMNAL().map(h => h.n)).filter(n => !vis.includes(n)); saveHymns(); drawHymns(); });
      on('#hyDrums', () => { hs.drums = hs.drums === false; saveHymns(); drawHymns(); });
      host.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => { hs.show = b.dataset.show; saveHymns(); drawHymns(); }));
      host.querySelectorAll('[data-worship]').forEach(b => b.addEventListener('click', () => { hs.worship = b.dataset.worship; saveHymns(); if (kind === 'hymns') playHymn(hymnNow, !!hs.one); else drawHymns(); }));
      host.querySelectorAll('[data-atmos]').forEach(b => b.addEventListener('click', () => { hs.atmos = b.dataset.atmos; saveHymns(); if (kind === 'hymns') playHymn(hymnNow, !!hs.one); else drawHymns(); }));
      host.querySelectorAll('[data-verses]').forEach(b => b.addEventListener('click', () => { hs.verses = +b.dataset.verses; saveHymns(); if (kind === 'hymns') playHymn(hymnNow, !!hs.one); else drawHymns(); }));
      on('#hyShuffle', () => { hs.shuffle = !hs.shuffle; saveHymns(); drawHymns(); });
      on('#hyEasy', () => {
        hs.easy = !hs.easy; saveHymns();
        if (kind === 'hymns') playHymn(hymnNow, !!hs.one); else drawHymns();
      });
      bindRows(host);
      const search = host.querySelector('#hySearch');
      if (search) search.addEventListener('input', () => {
        hymnQuery = search.value;
        const box = host.querySelector('.hy-list'); box.innerHTML = hymnRows(shown()); bindRows(box);
        const ps = host.querySelector('#hyPlaySel'); if (ps && !(kind === 'hymns' && !hs.one)) ps.textContent = `▶ Play selected (${ticked().length})`;
      });
      on('#hyWords', () => { if (kind === 'hymns') openWords(); else window.Core.toast('Play a song first'); });
      on('#hyAutoWords', () => { hs.autoWords = hs.autoWords === false; saveHymns(); drawHymns(); });
    };
    const bindRows = host => {
      host.querySelectorAll('[data-sel]').forEach(cb => cb.addEventListener('change', () => {
        const n = +cb.dataset.sel, cur = hs.sel || HYMNAL().map(h => h.n);
        hs.sel = cb.checked ? [...new Set(cur.concat(n))] : cur.filter(x => x !== n);
        if (hs.sel.length === HYMNAL().length) hs.sel = null;
        saveHymns(); drawHymns();
      }));
      const sing = n => { const h = hymnBy(n); if (hs.autoWords !== false && h && h.words) openWords(); };
      host.querySelectorAll('.hy-play').forEach(b => b.addEventListener('click', () => {
        const n = +b.dataset.n;
        if (kind === 'hymns' && hymnNow === n && hs.one === n) stop(); else { playHymn(n, true); sing(n); }
      }));
      host.querySelectorAll('.hy-loop').forEach(b => b.addEventListener('click', () => {
        const n = +b.dataset.n;
        playHymn(n, !ticked().some(h => h.n === n));   // a ticked hymn starts the loop here; an unticked one plays on its own
        sing(n);
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
    if (!window.HYMNAL_1906) load1906().then(() => { if (window.HYMNAL_1906) drawHymns(); });
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
    if (kind === 'hymns' && song && !song.live && hymnAudio) {
      const b = el.querySelector('.mp-stop');
      b.textContent = hymnAudio.paused ? '▶' : '⏸';
      b.onclick = e => { e.stopImmediatePropagation(); hymnAudio.paused ? hymnAudio.play() : hymnAudio.pause(); };
    }
    if (kind === 'hymns' && song && song.h.words) {
      const w = document.createElement('button'); w.className = 'mp-next'; w.textContent = '📜'; w.setAttribute('aria-label', 'Sing along: show the words');
      w.addEventListener('click', openWords); el.appendChild(w);
    }
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

  window.Ambient = { load1906, openWords, closeWords, hymnAudio: () => hymnAudio, song: () => song && { title: song.h.title, live: !!song.live, ticks: songTicks() }, layer: x => { layerMute = x || ''; }, arrangement: n => { const h = hymnBy(n), a = h.notes, x = []; for (let i = 0; i < a.length; i += 4) x.push(a.slice(i, i + 4)); return worshipify(x, h); }, peak: () => { if (!meter) return 0; const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); return d.reduce((a, x) => Math.max(a, Math.abs(x)), 0) / Math.max(0.01, master.gain.value); }, nodeCount: () => nodes.length, sampled: () => [...samples.values()].filter(x => typeof x === 'object').length, openPanel, addFiles, playable, myMusic: () => loadList(), player: () => player, level, TRACKS, HYMNAL, playHymn, nextHymn: () => hymnSkip(1), hymnState: () => Object.assign({ now: hymnNow }, hs), start, stop, preview, setVolume, volume: () => volume, track, playing: () => kind, nowPlaying: () => current, onChange: fn => listeners.push(fn) };
})();
