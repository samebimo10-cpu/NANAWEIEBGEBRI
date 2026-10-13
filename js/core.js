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
    introSeen: false,
    highlights: {},    // 'book.chapter.verse' -> { color, text, at }
    verseNotes: {},    // 'book.chapter.verse' -> { text, at }
    bibleLast: { b: 0, c: 1 },
    bibleFont: 1.2,
    people: [],        // prayer list: { id, name, category, reasons[], scriptures[], notes, prayedCount, lastPrayed }
    reminders: [],     // { id, kind 'reminder'|'alarm', time 'HH:MM', days [0-6], label, personId, sound, snooze, enabled, lastFired, snoozeUntil }
    requests: [],      // { id, title, details, scripture, created, status 'open'|'answered'|'passed', answeredAt, answeredHow, passedAt, passedNote, prayedCount, lastPrayed }
    leadings: [],      // { id, at, text, for, scripture, prayedAt, requestId }
    readLog: {},       // 'book.chapter' -> last time it was read (ms)
    readHist: {},      // 'YYYY-MM-DD' -> chapters read that day
    plan: null,        // { id, start 'YYYY-MM-DD', read: { 'book.chapter': true } }
    plansDone: [],     // { id, at }
    memory: [],        // { id, ref, added, level 0-6, due 'YYYY-MM-DD', reviews, lastReview }
    soap: [],          // { id, at, ref, observation, application, prayer }
    reflections: {},   // 'YYYY-MM-DD' -> { grateful [3], saw, sorry, tomorrow, at }
    sermons: [],       // { id, at, title, preacher, notes }
    milestones: [],    // { id, date 'YYYY-MM-DD', title, story, ref, kind 'milestone'|'fast'|'plan' }
    fasts: [],         // { id, start ms, days, type, focus, notes { dayIndex: text }, status 'active'|'done'|'ended', endedAt }
    topics: {},        // topicId -> { step, done, answer, at }
    cardsShared: 0,
    // schema 2 (cleanup and growth release)
    schema: 2,
    family: [],        // { id, name, role 'adult'|'child' }        (Family altar)
    familyLog: {},     // 'YYYY-MM-DD' -> true
    partner: null,     // { code, partnerId, since }                (Prayer partner)
    seasons: {},       // 'seasonId-year' -> { day, done [] }       (Seasons)
    myLang: { name: '', prayers: [] },   // { id, title, text, ref, audioId, onDaily }   (Pray in my own language)
    letters: [],       // { id, text, refs, written, opens, opened, reply }               (Letters to my future self)
    packs: {}          // packId -> { version, bytes, installed }
  };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), raw);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  /* Before an older saved state is changed for the first time by this version, a copy is kept aside. */
  let migrated = false;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && (raw.schema || 1) < 2) {
      if (!localStorage.getItem(KEY + '-schema1')) localStorage.setItem(KEY + '-schema1', localStorage.getItem(KEY));
      migrated = true;
    }
  } catch (e) { /* nothing saved yet */ }
  const state = load();
  // Schema 2: nothing is recomputed. XP and level stay (only the title words change), the prayer count is
  // kept but no longer shown, and the daily steps are read from the same daily flags as before.
  if (migrated) state.schema = 2;
  // Older versions kept a simple prayer journal; move those entries into My requests once.
  if (!state.journalMigrated) {
    (state.journal || []).forEach(j => {
      const at = new Date(j.date).getTime() || Date.now();
      state.requests.push({ id: 'j' + j.id, title: j.text, details: '', scripture: null, created: at,
        status: j.answered ? 'answered' : 'open', answeredAt: j.answered ? at : 0, answeredHow: '', prayedCount: 0, lastPrayed: 0 });
    });
    state.journalMigrated = true;
  }
  const listeners = [];

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
    listeners.forEach(fn => fn(state));
  }
  if (migrated) save();

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
  /* Growth, not rank: the titles follow the tree of Psalm 1:3 (church offices are not earned in an app). */
  const TITLES = ['Seed', 'Sprout', 'Rooted', 'Growing', 'Branch', 'Budding', 'Fruitful', 'Evergreen', 'Planted', 'Deep Roots', 'Shade Tree', 'Cedar of Lebanon'];
  const TITLE_VERSES = [
    ['Mark 4:31', 'It is like a grain of mustard seed, which, when it is sown in the earth, is less than all the seeds that be in the earth.'],
    ['Mark 4:28', 'For the earth bringeth forth fruit of herself; first the blade, then the ear, after that the full corn in the ear.'],
    ['Colossians 2:7', 'Rooted and built up in him, and stablished in the faith, as ye have been taught, abounding therein with thanksgiving.'],
    ['2 Peter 3:18', 'But grow in grace, and in the knowledge of our Lord and Saviour Jesus Christ.'],
    ['John 15:5', 'I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit.'],
    ['Song of Solomon 2:12', 'The flowers appear on the earth; the time of the singing of birds is come.'],
    ['Colossians 1:10', 'That ye might walk worthy of the Lord unto all pleasing, being fruitful in every good work.'],
    ['Psalm 1:3', 'And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither.'],
    ['Psalm 92:13', 'Those that be planted in the house of the LORD shall flourish in the courts of our God.'],
    ['Jeremiah 17:8', 'For he shall be as a tree planted by the waters, and that spreadeth out her roots by the river.'],
    ['Mark 4:32', 'It groweth up, and becometh greater than all herbs, and shooteth out great branches; so that the fowls of the air may lodge under the shadow of it.'],
    ['Psalm 92:12', 'The righteous shall flourish like the palm tree: he shall grow like a cedar in Lebanon.']
  ];
  function levelFor(xp) { return Math.floor(Math.sqrt(xp / 60)) + 1; }
  function xpForLevel(l) { return (l - 1) * (l - 1) * 60; }
  function levelInfo() {
    const level = levelFor(state.xp);
    const base = xpForLevel(level), next = xpForLevel(level + 1);
    const i = Math.min(level - 1, TITLES.length - 1);
    return { level, title: TITLES[i], verse: { ref: TITLE_VERSES[i][0], text: TITLE_VERSES[i][1] }, progress: (state.xp - base) / (next - base), toNext: next - state.xp };
  }

  function addXP(n, reason) {
    const before = levelFor(state.xp);
    state.xp += n;
    save();
    toast(`+${n} XP${reason ? ' · ' + reason : ''}`, 'xp');
    const after = levelFor(state.xp);
    if (after > before) {
      setTimeout(() => {
        const li = levelInfo();
        toast(`🌱 Level ${after}: ${li.title}. "${li.verse.text.split(/[;:.]/)[0]}" (${li.verse.ref})`, 'level');
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
  const J = () => window.JOURNEY || [];
  const PASS = t => J().filter(l => l.testament === t).map(l => l.id);
  const BADGES = [
    { id: 'firstlight', icon: '🌅', name: 'First Light', desc: 'Complete your first study passage and quiz', test: s => Object.keys(s.completed).length >= 1 },
    { id: 'reader', icon: '📖', name: 'Daily Bread', desc: 'Read 10 chapters of the Bible', test: s => Object.keys(s.readLog || {}).length >= 10 },
    { id: 'reader100', icon: '🏛️', name: 'Bereans', desc: 'Read 100 chapters of the Bible', test: s => Object.keys(s.readLog || {}).length >= 100 },
    { id: 'plan', icon: '🗓️', name: 'Finisher', desc: 'Complete a reading plan', test: s => (s.plansDone || []).length >= 1 },
    { id: 'heart', icon: '💗', name: 'Written on My Heart', desc: 'Learn 3 memory verses well (reviewed 3 times)', test: s => (s.memory || []).filter(m => m.level >= 3).length >= 3 },
    { id: 'soap', icon: '✍️', name: 'Devoted', desc: 'Write 5 S.O.A.P. journal entries', test: s => (s.soap || []).length >= 5 },
    { id: 'evening', icon: '🌙', name: 'Evening Sacrifice', desc: 'Write 7 evening reflections', test: s => Object.keys(s.reflections || {}).length >= 7 },
    { id: 'topic', icon: '🧭', name: 'Rightly Dividing', desc: 'Finish a topical study', test: s => Object.values(s.topics || {}).some(t => t.done) },
    { id: 'ebenezer', icon: '🪨', name: 'Ebenezer', desc: 'Record 3 milestones of God\'s faithfulness', test: s => (s.milestones || []).length >= 3 },
    { id: 'fast', icon: '🍞', name: 'Not by Bread Alone', desc: 'Complete a fast', test: s => (s.fasts || []).some(f => f.status === 'done') },
    { id: 'sharer', icon: '🖼️', name: 'Light on a Hill', desc: 'Share a verse or testimony card', test: s => (s.cardsShared || 0) >= 1 },
    { id: 'ot', icon: '🏺', name: 'Old Testament Explorer', desc: 'Complete every Old Testament study passage', test: s => PASS('OT').length > 0 && PASS('OT').every(id => s.completed[id]) },
    { id: 'apostle', icon: '🔥', name: 'New Testament Explorer', desc: 'Complete every New Testament study passage', test: s => PASS('NT').length > 0 && PASS('NT').every(id => s.completed[id]) },
    { id: 'pilgrim', icon: '👑', name: 'Faithful Pilgrim', desc: 'Earn 3 stars on all 23 study passages', test: s => J().length > 0 && J().every(l => s.completed[l.id] === 3) },
    { id: 'streak3', icon: '🔥', name: 'Kindled', desc: 'Reach a 3-day streak', test: s => (s.streak.best || 0) >= 3 },
    { id: 'streak7', icon: '🕯️', name: 'Burning Lamp', desc: 'Reach a 7-day streak', test: s => (s.streak.best || 0) >= 7 },
    { id: 'streak30', icon: '🌟', name: 'Unquenchable', desc: 'Reach a 30-day streak', test: s => (s.streak.best || 0) >= 30 },
    { id: 'prayer5', icon: '🙏', name: 'Prayer Warrior', desc: 'Finish 5 guided prayer sessions', test: s => s.prayers >= 5 },
    { id: 'quiz10', icon: '🎯', name: 'Quiz Master', desc: 'Score 10 perfect quizzes', test: s => s.perfectQuizzes >= 10 },
    { id: 'memory', icon: '🧩', name: 'Hidden in My Heart', desc: 'Solve 5 verse scrambles', test: s => s.scrambles >= 5 },
    { id: 'journal', icon: '📖', name: 'Remembrancer', desc: 'Write 5 prayer requests or "Led to pray" entries', test: s => (s.requests || []).length + (s.leadings || []).length >= 5 },
    { id: 'watchman', icon: '⏰', name: 'Watchman', desc: 'Set a wake-up prayer alarm', test: s => (s.reminders || []).some(r => r.kind === 'alarm') },
    { id: 'testimony', icon: '📜', name: 'Testimony', desc: 'Record how God answered 3 prayers', test: s => (s.requests || []).filter(r => r.status === 'answered' && r.answeredHow).length >= 3 },
    { id: 'marker', icon: '🖍️', name: 'Treasure Marker', desc: 'Highlight 10 verses in the Bible', test: s => Object.keys(s.highlights || {}).length >= 10 },
    { id: 'intercessor', icon: '🤲', name: 'Intercessor', desc: 'Add 5 people to your prayer list', test: s => (s.people || []).length >= 5 },
    { id: 'answered', icon: '🙌', name: 'He Answers', desc: 'Mark a prayer request as answered', test: s => (s.people || []).some(p => p.reasons.some(r => r.answered)) || (s.requests || []).some(r => r.status === 'answered') }
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
    while (host.children.length >= 3) host.firstChild.remove();
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
      u.rate = (state.readerOpts && state.readerOpts.rate) || 0.95; u.pitch = 1;
      const v = this.voice();
      if (v) u.voice = v;
      u.onend = u.onerror = () => { this.speaking = false; onEnd && onEnd(); };
      this.speaking = true;
      speechSynthesis.speak(u);
    },
    stop() { if (this.supported) speechSynthesis.cancel(); this.speaking = false; },
    /* English voices, the most natural-sounding first (Premium, Enhanced, Natural, Neural, Siri, Google online) */
    natural: v => /premium|enhanced|natural|neural|siri|wavenet|online|google/i.test(v.name),
    voices() {
      if (!this.supported) return [];
      const rank = v => (this.natural(v) ? 0 : 2) + (v.localService === false ? 0 : 0.5);
      return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    },
    /* the voice chosen in reading options, or the best English voice on this device */
    voice() {
      if (!this.supported) return null;
      const all = speechSynthesis.getVoices(), want = state.readerOpts && state.readerOpts.voice;
      const en = this.voices();
      return (want && all.find(v => v.name === want)) || en.find(v => this.natural(v)) || all.find(v => /en-GB/i.test(v.lang)) || en[0] || null;
    }
  };

  window.Core = { state, save, dateKey, daySeed, rng, shuffle, escapeHTML, levelInfo, addXP, today, markDaily, currentStreak, BADGES, checkBadges, toast, Sound, Speech, onChange: fn => listeners.push(fn) };
})();
