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
     then a gentle limiter so loud chords never distort. */
  function setup(c) {
    if (master) return;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.25;
    limiter.connect(c.destination);
    master = c.createGain(); master.gain.value = 0; master.connect(limiter);
    meter = c.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
    dry = c.createGain(); dry.gain.value = 0.8; dry.connect(master);
    verb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len, k = 0.35 * Math.pow(1 - x, 2) + 0.02;   // a low-pass that closes over time
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x, 3) * (i < 40 ? i / 40 : 1);
      }
    }
    verb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 1.1;
    verb.connect(wet).connect(master);
    warmPiano(c);
  }
  const every = (fn, ms) => { timers.push(setInterval(fn, ms)); };
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  function clear() {
    timers.forEach(t => { clearInterval(t); clearTimeout(t); }); timers = [];
    nodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { /* already stopped */ } });
    nodes = [];
  }
  const keep = n => { nodes.push(n); if (nodes.length > 400) nodes.splice(0, 200); return n; };

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
  function piano(c, midi, t, vel = 0.5, len = 4) {
    const a = anchor(midi), buf = samples.get(a);
    if (buf && typeof buf === 'object') {
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf; s.playbackRate.value = Math.pow(2, (midi - a) / 12);
      // the recording fades by itself; let the damper come down at the end of the note
      const end = t + Math.max(0.5, len * (midi > 72 ? 0.7 : 1));
      g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, end, 0.18);
      s.connect(g); g.connect(dry); g.connect(verb);
      s.start(t); s.stop(Math.min(end + 1.2, t + buf.duration / s.playbackRate.value)); keep(s);
      return;
    }
    const out = c.createGain(), tone = c.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 1800 + vel * 1600; tone.Q.value = 0.3;
    out.connect(tone); tone.connect(dry); tone.connect(verb);
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
  const hs = { sel: null, one: 0, easy: false, shuffle: false, drums: true, show: 'all', verses: 2, worship: 'devotional' };   // sel: ticked hymn numbers (null = all); one: the hymn on repeat
  try { Object.assign(hs, JSON.parse(localStorage.getItem('lamp-hymns') || '{}')); } catch (e) { /* defaults */ }
  if (!['all', 'hymns', 'devotional'].includes(hs.show)) hs.show = 'all';
  const saveHymns = () => { try { localStorage.setItem('lamp-hymns', JSON.stringify(hs)); } catch (e) { /* not saved */ } };
  const HYMNAL = () => window.HYMNAL || [];
  const hymnBy = n => HYMNAL().find(h => h.n === n);
  const shown = () => HYMNAL().filter(h => hs.show === 'hymns' ? !h.theme : hs.show === 'devotional' ? !!h.theme : true);
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
   * The way a worship pianist plays these songs to hold an atmosphere of prayer:
   *  - left hand in open voicings, root, 5th and 9th (C-G-D), spacious and never muddy, keeping the hymn's own
   *    bass line, so its inversions (I/5, V/7…) still smooth the way from chord to chord;
   *  - the tune on top, and gentle upward arpeggios in the right hand instead of block chords;
   *  - a warm, quiet pad under the piano that sustains the harmony through the silences. */
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
    // a new chord where the bass moves (very short passing bass notes stay in the chord before)
    const cuts = [];
    bassLine.forEach(n => { if (!cuts.length || n[0] - cuts[cuts.length - 1].st >= 18) cuts.push({ st: n[0], bass: n[2] }); });
    if (!cuts.length || cuts[0].st > 0) cuts.unshift({ st: 0, bass: bassLine.length ? bassLine[0][2] : 48 });
    const out = melody.map(n => n.slice());
    cuts.forEach((cut, i) => {
      const a = cut.st, b = i + 1 < cuts.length ? cuts[i + 1].st : end, len = b - a;
      if (len <= 0) return;
      const ch = chordAt(notes, a, b, cut.bass % 12), root = ch.root;
      // left hand: the bass as the hymn has it (low and open), then the 5th and 9th of the chord above it
      let lo = cut.bass; while (lo > 47) lo -= 12; while (lo < 36) lo += 12;
      const up = (from, pc) => from + 1 + ((pc - from - 1) % 12 + 12) % 12;   // the first note above 'from' with this pitch
      const fifth = up(lo, lo % 12 === (root + 7) % 12 ? root : (root + 7) % 12), ninth = up(Math.max(fifth, lo + 9), (root + 2) % 12);
      out.push([a, len, lo, 3, 0.3], [a + 2, len, fifth, 3, 0.17], [a + 4, len, ninth, 2, 0.13]);
      // right hand: a gentle upward arpeggio, 1-5-9-3 style, beneath the tune, one note each eighth
      let base = ninth + 1; while ((base % 12) !== root) base++;
      const arp = [base, base + 7, base + 14, base + 12 + ch.third];
      for (let x = 0, k = 0; x < len; x += 12, k++) {
        const top = (melody.find(n => n[0] <= a + x && a + x < n[0] + n[1]) || [0, 0, 84])[2];
        let m = arp[k % arp.length]; while (m >= top - 1) m -= 12;
        if (m > ninth) out.push([a + x, Math.max(12, len - x), m, 1, k % arp.length === 0 ? 0.13 : 0.1]);
      }
      // the pad: root, 3rd, 5th and 9th held softly in the middle
      [root, root + ch.third, root + 7, root + 14].forEach((pc, j) => { let m = 55 + ((pc - 55) % 12 + 12) % 12; out.push([a, len, m, 5, j ? 0.05 : 0.06]); });
    });
    return out.sort((x, y) => x[0] - y[0]);
  }
  /* a warm, slow pad: two softly detuned voices through a gentle filter */
  function padTone(c, midi, t, len, vel) {
    const g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + Math.min(0.9, len * 0.4)); g.gain.setValueAtTime(vel, t + len); g.gain.linearRampToValueAtTime(0, t + len + 1.4);
    f.connect(g); g.connect(dry); g.connect(verb);
    [-5, 5].forEach((cents, i) => {
      const o = c.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = hz(midi); o.detune.value = cents;
      o.connect(f); o.start(t); o.stop(t + len + 1.5); keep(o);
    });
  }
  function score(h) {
    if (h.backing) return backing(h);
    const a = h.notes;
    let notes = [];
    for (let i = 0; i < a.length; i += 4) notes.push([a[i], a[i + 1], a[i + 2], a[i + 3]]);
    if (worshipOn(h)) notes = worshipify(notes, h);
    // at least two verses (each with its chorus), a breath of two beats between them, the last chord held longer
    const n = Math.max(2, hs.verses || 2), span = h.len + 48, all = [];
    for (let v = 0; v < n; v++) notes.forEach(x => {
      const y = x.slice(); y[0] += v * span;
      if (v === n - 1 && x[0] + x[1] >= h.len - 2) y[1] = Math.round(x[1] * 1.8);
      all.push(y);
    });
    return { notes: all, len: (n - 1) * span + h.len + 24, bpm: h.bpm, verses: n, verseLen: span };
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
      const d = score(h), sh = shiftFor(h), spt = 60 / (d.bpm * (d.pace || PACE)) / 24;   // seconds per tick
      const t0 = c.currentTime + 0.4, notes = d.notes;
      let k = 0, verse = 0;
      const label = () => { current = h.title + (d.verses > 1 ? ` · verse ${verse} of ${d.verses}` : '') + (hs.one ? ' (repeat)' : ''); changed(); };
      // schedule a little ahead at a time, so a long hymn does not start hundreds of sounds at once
      const pump = () => {
        if (token !== hymnToken || kind !== 'hymns') return;
        const v = Math.min(d.verses || 1, 1 + Math.floor(Math.max(0, c.currentTime - t0) / (d.verseLen * spt)));
        if (v !== verse) { verse = v; label(); }
        const horizon = c.currentTime + 1.6;
        while (k < notes.length && t0 + notes[k][0] * spt < horizon) {
          const [st, du, m, v, vel] = notes[k++], at = Math.max(t0 + st * spt, c.currentTime + 0.01);
          if (v === 4) { if (hs.drums !== false) drum(c, m, at, vel); }
          else if (v === 5) padTone(c, m + sh, at, du * spt, vel);
          else piano(c, m + sh, at, vel || VEL[v] || 0.2, Math.max(du * spt < 0.3 ? 0.6 : 1.2, du * spt * 1.3 + 0.4));
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
    const esc = window.Core.escapeHTML, list = shown(), sel = ticked().length, looping = kind === 'hymns' && !hs.one;
    if (!HYMNAL().length) return '<p class="muted small">The hymns could not be loaded.</p>';
    const tab = (k, label) => `<button class="chip ${hs.show === k ? 'active' : ''}" data-show="${k}">${label}</button>`;
    return `
      <p class="muted small">Each song plays at least two verses, each with its chorus (choose 2, 3 or 4 verses). Tap 🔂 to play one song over and over. Or tick the ones you want and tap <b>Play selected</b> (it plays the ticked songs in the list you are viewing) (or a song's name to start there): they play one after another, then start again from the first.</p>
      <div class="chips hy-show">${tab('all', 'All')}${tab('hymns', 'Hymns')}${tab('devotional', 'Devotional & spirituals')}</div>
      <div class="chips hy-verses"><span class="muted small">🕊️ Worship style:</span>${[['off', 'Off'], ['devotional', 'Devotional songs'], ['all', 'All songs']].map(([k, l]) => `<button class="chip ${(hs.worship || 'devotional') === k ? 'active' : ''}" data-worship="${k}">${l}</button>`).join('')}</div>
      <div class="chips hy-verses"><span class="muted small">Verses:</span>${[2, 3, 4].map(n => `<button class="chip ${(hs.verses || 2) === n ? 'active' : ''}" data-verses="${n}">${n}</button>`).join('')}</div>
      <div class="row gap wrap hy-tools">
        <button class="btn ${looping ? 'ghost' : 'primary'} small" id="hyPlaySel">${looping ? '⏸ Stop' : `▶ Play selected (${sel})`}</button>
        <button class="btn ghost small" id="hyAll">Tick these</button>
        <button class="btn ghost small" id="hyNone">Untick these</button>
        <button class="btn ghost small ${hs.shuffle ? 'on' : ''}" id="hyShuffle" aria-pressed="${hs.shuffle}">🔀 Shuffle</button>
        <button class="btn ghost small ${hs.easy ? 'on' : ''}" id="hyEasy" aria-pressed="${hs.easy}">🎼 ${hs.easy ? 'Easy keys' : 'Main keys'}</button>
        ${HYMNAL().some(h => h.backing) ? `<button class="btn ghost small ${hs.drums !== false ? 'on' : ''}" id="hyDrums" aria-pressed="${hs.drums !== false}">🥁 Drums ${hs.drums !== false ? 'on' : 'off'}</button>` : ''}
      </div>
      <div class="hy-list">${list.map(h => {
        const playing = kind === 'hymns' && hymnNow === h.n, ticks = !hs.sel || hs.sel.includes(h.n);
        const what = h.backing ? '🎹 keyboard backing' : h.composed ? '🎵 new tune' : '🎼 full hymn';
        return `<div class="hy-row ${playing ? 'on' : ''}">
          <input type="checkbox" class="hy-tick" data-sel="${h.n}" ${ticks ? 'checked' : ''} aria-label="Include ${esc(h.title)}">
          <button class="hy-name hy-loop" data-n="${h.n}"><b>${h.n}. ${esc(h.title)}</b><small>${h.theme ? '<i>' + esc(h.theme) + '</i> · ' : ''}${keyName(hymnKey(h))} · ${esc(h.ts)} · ${esc(h.prog)} · ${what}${playing ? (hs.one ? ' · 🔂 on repeat' : ' · ▶ in the loop') : ''}</small></button>
          <button class="hy-play" data-n="${h.n}" aria-label="${playing && hs.one ? 'Stop' : 'Play ' + esc(h.title) + ' on repeat'}">${playing && hs.one ? '⏸' : '🔂'}</button>
        </div>`;
      }).join('')}</div>
      <p class="muted small"><b>🕊️ Worship style</b> plays the way a worship pianist would: open left-hand chords (root, 5th and 9th) that keep the hymn's own bass line, gentle upward arpeggios under the tune instead of block chords, and a warm pad beneath that sustains the harmony.</p>
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
      });
      on('#hyAll', () => { const all = HYMNAL().map(h => h.n), cur = hs.sel || all; hs.sel = [...new Set(cur.concat(shown().map(h => h.n)))]; if (hs.sel.length === all.length) hs.sel = null; saveHymns(); drawHymns(); });
      on('#hyNone', () => { const vis = shown().map(h => h.n); hs.sel = (hs.sel || HYMNAL().map(h => h.n)).filter(n => !vis.includes(n)); saveHymns(); drawHymns(); });
      on('#hyDrums', () => { hs.drums = hs.drums === false; saveHymns(); drawHymns(); });
      host.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => { hs.show = b.dataset.show; saveHymns(); drawHymns(); }));
      host.querySelectorAll('[data-worship]').forEach(b => b.addEventListener('click', () => { hs.worship = b.dataset.worship; saveHymns(); if (kind === 'hymns') playHymn(hymnNow, !!hs.one); else drawHymns(); }));
      host.querySelectorAll('[data-verses]').forEach(b => b.addEventListener('click', () => { hs.verses = +b.dataset.verses; saveHymns(); if (kind === 'hymns') playHymn(hymnNow, !!hs.one); else drawHymns(); }));
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

  window.Ambient = { arrangement: n => { const h = hymnBy(n), a = h.notes, x = []; for (let i = 0; i < a.length; i += 4) x.push(a.slice(i, i + 4)); return worshipify(x, h); }, peak: () => { if (!meter) return 0; const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); return d.reduce((a, x) => Math.max(a, Math.abs(x)), 0) / Math.max(0.01, master.gain.value); }, nodeCount: () => nodes.length, sampled: () => [...samples.values()].filter(x => typeof x === 'object').length, openPanel, addFiles, playable, myMusic: () => loadList(), player: () => player, level, TRACKS, HYMNAL, playHymn, nextHymn: () => hymnSkip(1), hymnState: () => Object.assign({ now: hymnNow }, hs), start, stop, preview, setVolume, volume: () => volume, track, playing: () => kind, nowPlaying: () => current, onChange: fn => listeners.push(fn) };
})();
