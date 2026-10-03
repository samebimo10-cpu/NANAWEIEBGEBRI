/* Core utilities: persistence, progress/XP, streaks, badges, sound, toasts, speech. */
(function () {
  const KEY = 'lamp-and-path-v1';
  const DEFAULTS = {
    xp: 0,
    completed: {},     // locationId -> best stars (1-3)
    readCount: 0,
    perfectQuizzes: 0,
    daily: {},         // 'YYYY-MM-DD' -> { verse, quiz, scramble, blank, books, prayer }
    streak: { count: 0, last: null, best: 0 },
    notes: {},         // locationId -> text
    journal: [],       // { id, text, date, answered }
    prayers: 0,
    scrambles: 0,
    badges: [],
    player: null,      // { x, y }
    sound: true,
    introSeen: false
  };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), raw);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  const state = load();
  const listeners = [];

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
    listeners.forEach(fn => fn(state));
  }

  function dateKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function daySeed(d = new Date()) {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Levels ---------- */
  const TITLES = ['Seeker', 'Listener', 'Learner', 'Disciple', 'Scribe', 'Shepherd', 'Pilgrim', 'Psalmist', 'Teacher', 'Elder', 'Prophet', 'Apostle'];
  function levelFor(xp) { return Math.floor(Math.sqrt(xp / 60)) + 1; }
  function xpForLevel(l) { return (l - 1) * (l - 1) * 60; }
  function levelInfo() {
    const level = levelFor(state.xp);
    const base = xpForLevel(level), next = xpForLevel(level + 1);
    return { level, title: TITLES[Math.min(level - 1, TITLES.length - 1)], progress: (state.xp - base) / (next - base), toNext: next - state.xp };
  }

  function addXP(n, reason) {
    const before = levelFor(state.xp);
    state.xp += n;
    save();
    toast(`+${n} XP${reason ? ' · ' + reason : ''}`, 'xp');
    const after = levelFor(state.xp);
    if (after > before) {
      setTimeout(() => {
        toast(`Level ${after}! You are now a ${levelInfo().title}.`, 'level');
        Sound.play('level');
      }, 600);
    }
    checkBadges();
  }

  /* ---------- Daily + streak ---------- */
  function today() {
    const k = dateKey();
    if (!state.daily[k]) state.daily[k] = {};
    return state.daily[k];
  }

  function markDaily(activity) {
    const k = dateKey();
    const t = today();
    const first = !t[activity];
    t[activity] = true;
    if (state.streak.last !== k) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      state.streak.count = state.streak.last === dateKey(y) ? state.streak.count + 1 : 1;
      state.streak.last = k;
      state.streak.best = Math.max(state.streak.best || 0, state.streak.count);
      if (state.streak.count > 1) setTimeout(() => toast(`🔥 ${state.streak.count}-day streak!`, 'level'), 900);
    }
    save();
    checkBadges();
    return first;
  }

  function currentStreak() {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (state.streak.last === dateKey() || state.streak.last === dateKey(y)) return state.streak.count;
    return 0;
  }

  /* ---------- Badges ---------- */
  const OT = () => window.JOURNEY.filter(l => l.testament === 'OT').map(l => l.id);
  const NT = () => window.JOURNEY.filter(l => l.testament === 'NT').map(l => l.id);
  const BADGES = [
    { id: 'firstlight', icon: '🌅', name: 'First Light', desc: 'Complete the Garden of Eden', test: s => !!s.completed.eden },
    { id: 'covenant', icon: '🌈', name: 'Covenant Keeper', desc: 'Visit the Mountains of Ararat', test: s => !!s.completed.ararat },
    { id: 'law', icon: '📜', name: 'Tablets of Stone', desc: 'Complete Mount Sinai', test: s => !!s.completed.sinai },
    { id: 'psalmist', icon: '🐑', name: 'Psalmist', desc: 'Complete Psalm 23 in the hills of Judah', test: s => !!s.completed.judah },
    { id: 'ot', icon: '🏺', name: 'Old Testament Pilgrim', desc: 'Complete every Old Testament site', test: s => OT().every(id => s.completed[id]) },
    { id: 'gospel', icon: '✝️', name: 'Gospel Walker', desc: 'Complete the empty tomb', test: s => !!s.completed.tomb },
    { id: 'apostle', icon: '⛵', name: 'Apostle\'s Road', desc: 'Complete every New Testament site', test: s => NT().every(id => s.completed[id]) },
    { id: 'pilgrim', icon: '👑', name: 'Faithful Pilgrim', desc: 'Earn 3 stars at every site', test: s => window.JOURNEY.every(l => s.completed[l.id] === 3) },
    { id: 'streak3', icon: '🔥', name: 'Kindled', desc: 'Reach a 3-day streak', test: s => (s.streak.best || 0) >= 3 },
    { id: 'streak7', icon: '🕯️', name: 'Burning Lamp', desc: 'Reach a 7-day streak', test: s => (s.streak.best || 0) >= 7 },
    { id: 'streak30', icon: '🌟', name: 'Unquenchable', desc: 'Reach a 30-day streak', test: s => (s.streak.best || 0) >= 30 },
    { id: 'prayer5', icon: '🙏', name: 'Prayer Warrior', desc: 'Finish 5 guided prayer sessions', test: s => s.prayers >= 5 },
    { id: 'quiz10', icon: '🎯', name: 'Quiz Master', desc: 'Score 10 perfect quizzes', test: s => s.perfectQuizzes >= 10 },
    { id: 'memory', icon: '🧩', name: 'Hidden in My Heart', desc: 'Solve 5 verse scrambles', test: s => s.scrambles >= 5 },
    { id: 'journal', icon: '📖', name: 'Remembrancer', desc: 'Write 5 prayer journal entries', test: s => s.journal.length >= 5 }
  ];

  function checkBadges() {
    let changed = false;
    BADGES.forEach(b => {
      if (!state.badges.includes(b.id) && b.test(state)) {
        state.badges.push(b.id);
        changed = true;
        setTimeout(() => { toast(`${b.icon} Badge earned: ${b.name}`, 'award'); Sound.play('badge'); }, 1200);
      }
    });
    if (changed) save();
  }

  /* ---------- Toasts ---------- */
  function toast(msg, kind = '') {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2800);
  }

  /* ---------- Sound (generated with WebAudio, no files needed) ---------- */
  const Sound = (() => {
    let ac = null;
    function ctx() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(freq, start, dur, type = 'sine', vol = 0.12) {
      const c = ctx(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      const t = c.currentTime + start;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    }
    const SEQ = {
      correct: [[659, 0, .25], [880, .08, .35]],
      wrong: [[220, 0, .25, 'triangle'], [196, .1, .3, 'triangle']],
      open: [[523, 0, .4], [784, .05, .5], [1046, .1, .6]],
      complete: [[523, 0, .5], [659, .12, .5], [784, .24, .5], [1046, .36, .9]],
      level: [[392, 0, .4], [523, .1, .4], [659, .2, .4], [784, .3, .4], [1046, .4, 1]],
      badge: [[880, 0, .3], [1175, .1, .5], [1568, .2, .7]],
      tap: [[740, 0, .08, 'triangle', .05]],
      bell: [[528, 0, 2.5, 'sine', .1], [1056, 0, 1.5, 'sine', .03]]
    };
    return {
      play(name) {
        if (!state.sound) return;
        (SEQ[name] || []).forEach(([f, s, d, type, v]) => tone(f, s, d, type, v));
      }
    };
  })();

  /* ---------- Read aloud ---------- */
  const Speech = {
    supported: 'speechSynthesis' in window,
    speaking: false,
    speak(text, onEnd) {
      if (!this.supported) { toast('Read-aloud is not supported on this device'); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/LORD/g, 'Lord'));
      u.rate = 0.92; u.pitch = 1;
      const voices = speechSynthesis.getVoices();
      const v = voices.find(v => /en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
      if (v) u.voice = v;
      u.onend = u.onerror = () => { this.speaking = false; onEnd && onEnd(); };
      this.speaking = true;
      speechSynthesis.speak(u);
    },
    stop() { if (this.supported) speechSynthesis.cancel(); this.speaking = false; }
  };

  window.Core = { state, save, dateKey, daySeed, rng, shuffle, escapeHTML, levelInfo, addXP, today, markDaily, currentStreak, BADGES, checkBadges, toast, Sound, Speech, onChange: fn => listeners.push(fn) };
})();
