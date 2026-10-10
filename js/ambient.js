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

  /* ---------------- Controls ---------------- */
  function start(k) {
    k = OLD[k] || k;
    clearTimeout(previewTimer);
    if (kind === k) return;
    const c = ctx(); if (!c) return;
    setup(c);
    clear(); kind = k; current = '';
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(master.gain.value, c.currentTime); master.gain.linearRampToValueAtTime(volume, c.currentTime + 2.5);
    ({ calm, stream, hymns, pad, rain }[k] || (() => {}))(c);
    changed();
  }
  function stop() {
    clearTimeout(previewTimer);
    if (!ac || !master || !kind) return;
    kind = ''; current = '';
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
    setTimeout(() => { if (!kind) clear(); }, 1600);
    changed();
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (ac && master && kind) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(volume, ac.currentTime, 0.2); }
  }
  /* a short sample in the settings */
  function preview(k) { start(k); clearTimeout(previewTimer); previewTimer = setTimeout(stop, 8000); }
  const track = k => TRACKS.find(t => t[0] === (OLD[k] || k));

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
        <label class="flabel" for="musVol">Volume</label>
        <input type="range" id="musVol" min="0" max="100" value="${Math.round(volume * 100)}" class="vol">
        <label class="check-row"><input type="checkbox" id="musListen" ${o.ambient ? 'checked' : ''}> Play ${esc((track(o.ambient || kind || 'calm') || TRACKS[0])[2].toLowerCase())} when I listen to the Bible read aloud</label>
        <p class="muted small">Hymn tunes are in the public domain. All music here is generated, not recorded.</p>
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
    const refresh = () => { const body = document.getElementById('modalBody'); if (body && body.querySelector('.music-panel')) { body.innerHTML = html(); bind(); } };
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
  }
  listeners.push(pill);
  if (window.Core && window.Core.state && typeof window.Core.state.musicVolume === 'number') volume = window.Core.state.musicVolume;

  /* how loud the music is right now (0 to 1), for checks */
  function level() {
    if (!meter) return 0;
    const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
    return Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length);
  }

  window.Ambient = { openPanel, level, TRACKS, HYMNS, start, stop, preview, setVolume, volume: () => volume, track, playing: () => kind, nowPlaying: () => current, onChange: fn => listeners.push(fn) };
})();
