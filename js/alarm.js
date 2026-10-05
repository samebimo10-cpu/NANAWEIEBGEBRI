/*
 * Wake-up alarms: loud, repeating alarm sounds (generated with WebAudio, no files),
 * a full-screen ringing screen with snooze, and "bedside mode", which keeps the
 * screen on overnight so the alarm can ring. Phones do not let a closed web app
 * make sound, so bedside mode is what makes waking someone up reliable.
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, toast } = window.Core;
  const $ = s => document.querySelector(s);

  const SOUNDS = [
    ['bells', '🔔 Church bells'],
    ['chimes', '🎐 Gentle chimes (gets louder)'],
    ['trumpet', '🎺 Trumpet call (loudest)']
  ];

  /* Verses for waking (KJV, checked against the bundled Bible text). */
  const MORNING = [
    ['Psalm 5:3', 'My voice shalt thou hear in the morning, O LORD; in the morning will I direct my prayer unto thee, and will look up.'],
    ['Mark 1:35', 'And in the morning, rising up a great while before day, he went out, and departed into a solitary place, and there prayed.'],
    ['Psalm 57:8', 'Awake up, my glory; awake, psaltery and harp: I myself will awake early.'],
    ['Psalm 63:1', 'O God, thou art my God; early will I seek thee: my soul thirsteth for thee, my flesh longeth for thee in a dry and thirsty land, where no water is;'],
    ['Isaiah 50:4', 'The Lord GOD hath given me the tongue of the learned, that I should know how to speak a word in season to him that is weary: he wakeneth morning by morning, he wakeneth mine ear to hear as the learned.']
  ];
  const NIGHT = [
    ['Psalm 119:62', 'At midnight I will rise to give thanks unto thee because of thy righteous judgments.'],
    ['Acts 16:25', 'And at midnight Paul and Silas prayed, and sang praises unto God: and the prisoners heard them.'],
    ['Luke 6:12', 'And it came to pass in those days, that he went out into a mountain to pray, and continued all night in prayer to God.'],
    ['Psalm 130:6', 'My soul waiteth for the Lord more than they that watch for the morning: I say, more than they that watch for the morning.']
  ];

  /* ---------------- Audio engine ---------------- */
  let ac = null, master = null;
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) {
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain();
      master.gain.value = 0.3;
      master.connect(comp).connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  // Browsers only allow sound after the person has touched the page, so unlock audio on the first touch.
  const unlock = () => { const c = audio(); if (c) { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { once: true, capture: true }));

  function note(freq, t, dur, { type = 'sine', vol = 0.5, partials = null } = {}) {
    const c = ac;
    const list = partials || [[1, 1]];
    list.forEach(([mult, amp]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }

  // One cycle of each sound; returns its length in seconds.
  const PATTERNS = {
    bells(t) {
      const BELL = [[1, 1], [2, 0.5], [2.4, 0.35], [3, 0.25], [4.2, 0.15], [0.5, 0.4]];
      [523.25, 392, 440, 293.66].forEach((f, i) => note(f, t + i * 0.55, 2.4, { partials: BELL, vol: 0.45 }));
      return 3.2;
    },
    chimes(t) {
      [523.25, 587.33, 659.25, 783.99, 880, 1046.5].forEach((f, i) => note(f, t + i * 0.2, 1.4, { partials: [[1, 1], [3, 0.2]], vol: 0.4 }));
      return 2.4;
    },
    trumpet(t) {
      const seq = [[392, 0.18], [392, 0.18], [392, 0.18], [523.25, 0.6], [0, 0.15], [392, 0.18], [523.25, 0.9]];
      let x = t;
      seq.forEach(([f, d]) => { if (f) note(f, x, d + 0.05, { type: 'sawtooth', vol: 0.28, partials: [[1, 1], [2, 0.4]] }); x += d + 0.04; });
      return 3.0;
    }
  };

  let ringTimer = null, ringStart = 0, ringing = null, vibTimer = null, autoStop = null;

  function startSound(kind) {
    const c = audio();
    if (!c) return;
    ringStart = c.currentTime;
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(0.25, c.currentTime);
    master.gain.linearRampToValueAtTime(1.0, c.currentTime + 45);   // gets louder over 45 seconds
    const pat = PATTERNS[kind] || PATTERNS.bells;
    let next = c.currentTime + 0.05;
    const loop = () => {
      while (next < c.currentTime + 1.5) next += pat(next) + 0.6;
    };
    loop();
    ringTimer = setInterval(loop, 400);
    if (navigator.vibrate) { navigator.vibrate([900, 400, 900, 400, 900]); vibTimer = setInterval(() => navigator.vibrate([900, 400, 900, 400, 900]), 4000); }
  }
  function stopSound() {
    clearInterval(ringTimer); ringTimer = null;
    clearInterval(vibTimer); vibTimer = null;
    if (navigator.vibrate) navigator.vibrate(0);
    if (ac && master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(0, ac.currentTime); setTimeout(() => { if (!ringTimer) master.gain.value = 0.3; }, 300); }
  }

  function preview(kind) {
    if (ringing) return;
    const c = audio();
    if (!c) { toast('Sound is not supported on this device'); return; }
    master.gain.setValueAtTime(0.6, c.currentTime);
    (PATTERNS[kind] || PATTERNS.bells)(c.currentTime + 0.05);
    setTimeout(() => { if (!ringTimer && master) master.gain.value = 0.3; }, 3500);
  }

  /* ---------------- Ringing screen ---------------- */
  function verseFor(date) {
    const h = date.getHours();
    const pool = (h >= 22 || h < 4) ? NIGHT : MORNING;
    return pool[(date.getDate() + h) % pool.length];
  }

  function ring(r) {
    if (ringing) stop(false);
    ringing = r;
    const now = new Date();
    const [ref, text] = verseFor(now);
    const person = r.personId ? state.people.find(p => p.id === r.personId) : null;
    const snooze = r.snooze || 5;
    const el = document.createElement('div');
    el.className = 'alarm-screen';
    el.id = 'alarmScreen';
    el.innerHTML = `
      <div class="alarm-inner">
        <div class="alarm-ring">⏰</div>
        <div class="alarm-time" id="alarmClock">${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</div>
        <h1 class="alarm-label">${esc(r.label || 'Time to pray')}</h1>
        ${person ? `<p class="alarm-for">Pray for ${esc(person.name)}</p>` : ''}
        <blockquote class="alarm-verse">${esc(text).replace(/LORD/g, '<span class="sc">Lord</span>').replace(/GOD/g, '<span class="sc">God</span>')}<span class="av-ref">${esc(ref)}</span></blockquote>
        <button class="btn primary big" id="alarmUp">I'm awake. Let's pray</button>
        <button class="btn ghost big" id="alarmSnooze">😴 Snooze ${snooze} minutes</button>
      </div>`;
    document.body.appendChild(el);
    const tick = setInterval(() => { const c = $('#alarmClock'); if (c) c.textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); else clearInterval(tick); }, 1000);
    startSound(r.sound || 'bells');
    keepAwake(true);
    $('#alarmUp').addEventListener('click', () => {
      stop(true);
      window.Core.markDaily('prayer');
      if (person) window.PrayList.prayFor(person.id);
      else { window.UI.show('prayer'); setTimeout(() => window.UI.startGuidedPrayer(), 60); }
    });
    $('#alarmSnooze').addEventListener('click', () => {
      const real = state.reminders.find(x => x.id === r.id);
      const until = Date.now() + snooze * 60000;
      if (real) { real.snoozeUntil = until; save(); }
      else setTimeout(() => ring(r), snooze * 60000);
      stop(false);
      toast(`😴 Snoozing. Ringing again at ${new Date(until).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
    });
    // stop by itself after 10 minutes so it never rings all day
    autoStop = setTimeout(() => { if (ringing === r) { stop(false); toast(`⏰ Missed alarm: ${r.label || 'Prayer time'}`, 'level'); } }, 10 * 60000);
  }

  function stop(awake) {
    stopSound();
    clearTimeout(autoStop);
    ringing = null;
    const el = $('#alarmScreen'); if (el) el.remove();
    if (!bedside) keepAwake(false);
    if (awake) { window.Core.Sound.play('complete'); exitBedside(); }
  }

  /* ---------------- Bedside mode ---------------- */
  let bedside = false, lock = null, clockTimer = null;

  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !lock) {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      }
      if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (bedside || ringing)) keepAwake(true); });

  function nextAlarm() {
    const now = new Date();
    let best = null;
    state.reminders.filter(r => r.enabled && r.kind === 'alarm').forEach(r => {
      const [h, m] = r.time.split(':').map(Number);
      for (let d = 0; d <= 7; d++) {
        const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m);
        if (t > now && r.days.includes(t.getDay())) { if (!best || t < best.at) best = { at: t, r }; break; }
      }
    });
    return best;
  }

  function startBedside() {
    unlock();
    bedside = true;
    keepAwake(true);
    const el = document.createElement('div');
    el.className = 'bedside';
    el.id = 'bedside';
    const n = nextAlarm();
    el.innerHTML = `
      <div class="bedside-inner">
        <div class="bed-clock" id="bedClock"></div>
        <div class="bed-date" id="bedDate"></div>
        <div class="bed-next">${n
          ? `⏰ ${esc(n.at.toLocaleDateString(undefined, { weekday: 'long' }))} at ${esc(n.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))} · ${esc(n.r.label || 'Prayer alarm')}<br><small>in ${Math.floor((n.at - Date.now()) / 3600000)} h ${Math.floor(((n.at - Date.now()) % 3600000) / 60000)} min</small>`
          : 'No wake-up alarm is set. Exit and add one under ⏰ Alarms.'}</div>
        <p class="bed-tips">Leave the phone on charge with this screen open and the volume up. ${'wakeLock' in navigator ? 'The screen stays on, dimmed.' : 'This browser cannot keep the screen on by itself, so set your screen timeout to "Never" while charging.'}</p>
        <div class="bed-actions">
          <button class="btn ghost small" id="bedTest">🔊 Test the alarm sound</button>
          <button class="btn ghost small" id="bedExit">Exit bedside mode</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const draw = () => {
      const d = new Date();
      const c = $('#bedClock'); if (!c) return;
      c.textContent = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      $('#bedDate').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    };
    draw();
    clockTimer = setInterval(draw, 1000);
    // tap to brighten for a few seconds
    let dimT;
    el.addEventListener('pointerdown', () => { el.classList.add('bright'); clearTimeout(dimT); dimT = setTimeout(() => el.classList.remove('bright'), 6000); });
    el.classList.add('bright'); dimT = setTimeout(() => el.classList.remove('bright'), 6000);
    $('#bedTest').addEventListener('click', e => { e.stopPropagation(); const a = n ? n.r.sound : 'bells'; preview(a || 'bells'); });
    $('#bedExit').addEventListener('click', e => { e.stopPropagation(); exitBedside(); });
    toast('🌙 Bedside mode on. Good night!');
  }

  function exitBedside() {
    if (!bedside) return;
    bedside = false;
    clearInterval(clockTimer);
    const el = $('#bedside'); if (el) el.remove();
    if (!ringing) keepAwake(false);
  }

  window.Alarm = {
    SOUNDS, ring, stop, preview, startBedside, exitBedside, nextAlarm,
    get isBedside() { return bedside; },
    get isRinging() { return !!ringing; }
  };
})();
