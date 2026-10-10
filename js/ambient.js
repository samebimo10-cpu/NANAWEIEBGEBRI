/*
 * Gentle background music for listening to the Bible, generated in the browser (no audio files):
 * soft strings, a slow piano, or rain.
 */
(function () {
  'use strict';
  let ac = null, master = null, timer = null, nodes = [], kind = '', previewTimer = null;
  const CHORDS = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]];   // C, Am, F, G (MIDI notes)
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function ctx() {
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function clear() {
    clearInterval(timer); timer = null;
    nodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { /* already stopped */ } });
    nodes = [];
  }

  function pad(c) {
    let i = 0;
    const play = () => {
      const t = c.currentTime;
      CHORDS[i++ % CHORDS.length].forEach((m, k) => [0, 7].forEach(cents => {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = k === 0 ? 'sine' : 'triangle'; o.frequency.value = hz(m); o.detune.value = cents;
        f.type = 'lowpass'; f.frequency.value = 900;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2.5); g.gain.linearRampToValueAtTime(0.04, t + 6); g.gain.linearRampToValueAtTime(0, t + 9.5);
        o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 10);
        nodes.push(o);
      }));
    };
    play(); timer = setInterval(play, 8000);
  }

  function piano(c) {
    let i = 0, step = 0;
    const note = (m, t, v) => {
      [1, 2, 3].forEach((h, k) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = hz(m) * h;
        const a = v / (k * 2.5 + 1);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2 - k);
        o.connect(g).connect(master); o.start(t); o.stop(t + 3.3);
        nodes.push(o);
      });
    };
    const play = () => {
      const ch = CHORDS[Math.floor(i / 4) % CHORDS.length], t = c.currentTime;
      const pattern = [0, 2, 1, 3];
      note(ch[pattern[step % 4]] + 12, t, 0.09);
      if (step % 4 === 0) note(ch[0] - 12, t, 0.07);
      step++; i++;
      if (nodes.length > 60) nodes = nodes.slice(-30);
    };
    play(); timer = setInterval(play, 1400);
  }

  function rain(c) {
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let n = 0; n < len; n++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[n] = last * 3.2; }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = 0.35;
    src.connect(f).connect(g).connect(master); src.start();
    nodes.push(src);
  }

  function start(k) {
    if (kind === k && timer !== null || (kind === k && k === 'rain' && nodes.length)) return;
    const c = ctx(); if (!c) return;
    clear(); kind = k;
    if (!master) { master = c.createGain(); master.connect(c.destination); }
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(0, c.currentTime); master.gain.linearRampToValueAtTime(0.6, c.currentTime + 2);
    ({ pad, piano, rain }[k] || (() => {}))(c);
  }
  function stop() {
    clearTimeout(previewTimer);
    if (!ac || !master || !kind) return;
    kind = '';
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0, ac.currentTime + 1.2);
    setTimeout(() => { if (!kind) clear(); }, 1300);
  }
  /* a short sample in the settings */
  function preview(k) { start(k); clearTimeout(previewTimer); previewTimer = setTimeout(stop, 6000); }

  window.Ambient = { start, stop, preview, playing: () => kind };
})();
