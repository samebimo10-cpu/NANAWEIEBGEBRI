/* Application shell: navigation, HUD, scripture reader, quizzes, daily games, study and prayer. */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, Speech, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const J = window.JOURNEY;

  /* ================= Navigation ================= */
  const VIEWS = ['daily', 'bible', 'prayer', 'study', 'journey'];
  let current = null;

  function show(view) {
    if (!VIEWS.includes(view)) view = 'daily';
    current = view;
    VIEWS.forEach(v => $('#view-' + v).classList.toggle('active', v === view));
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (window.Game.ready) window.Game.setActive(view === 'journey' && !modalOpen);
    if (view === 'daily') renderDaily();
    if (view === 'study') renderStudy();
    if (view === 'prayer') renderPrayer();
    if (view === 'bible') window.Reader.render(); else window.Reader.stop();
    if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
    Speech.stop();
  }

  /* ================= HUD ================= */
  function updateHUD() {
    const li = window.Core.levelInfo();
    $('#lvl').textContent = li.level;
    $('#lvlTitle').textContent = li.title;
    $('#xpfill').style.width = Math.round(li.progress * 100) + '%';
    $('#streak').textContent = window.Core.currentStreak();
  }
  window.Core.onChange(updateHUD);

  /* ================= Modal ================= */
  let modalOpen = false, modalOnClose = null;
  function openModal(html, opts = {}) {
    const m = $('#modal');
    $('#modalBody').innerHTML = html;
    m.classList.remove('hidden');
    m.querySelector('.modal-card').className = 'modal-card' + (opts.cls ? ' ' + opts.cls : '');
    requestAnimationFrame(() => m.classList.add('open'));
    modalOpen = true;
    modalOnClose = opts.onClose || null;
    if (window.Game.ready) window.Game.setActive(false);
    $('#modalBody').scrollTop = 0;
    m.querySelector('.modal-card').scrollTop = 0;
  }
  function closeModal() {
    const m = $('#modal');
    m.classList.remove('open');
    modalOpen = false;
    Speech.stop();
    stopPrayerTimer();
    setTimeout(() => { if (!modalOpen) m.classList.add('hidden'); }, 250);
    const cb = modalOnClose; modalOnClose = null;
    if (window.Game.ready && current === 'journey') { window.Game.setActive(true); window.Game.setInputEnabled(true); }
    cb && cb();
  }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOpen) closeModal(); });

  /* ================= Scripture rendering ================= */
  function passageHTML(passages) {
    return passages.map(p => `
      <div class="passage">
        <div class="passage-ref">${esc(p.ref)} <span class="kjv">KJV</span></div>
        <p class="scripture">${p.verses.map(([n, t]) => `<sup>${n}</sup>${esc(t).replace(/LORD/g, '<span class="sc">Lord</span>')}`).join(' ')}</p>
      </div>`).join('');
  }
  function passageText(passages) { return passages.map(p => p.ref + '. ' + p.verses.map(v => v[1]).join(' ')).join(' '); }
  function verseHTML(text) { return esc(text).replace(/LORD/g, '<span class="sc">Lord</span>'); }

  function contextHTML(loc) {
    const c = loc.context;
    return `
      <div class="context">
        <h4>📍 Setting</h4><p>${esc(c.setting)}</p>
        <h4>📚 Background</h4><p>${esc(c.background)}</p>
        <h4>✨ Key themes</h4><div class="chips">${c.themes.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        <h4>🔗 Read further</h4><div class="chips">${c.related.map(t => `<span class="chip ref">${esc(t)}</span>`).join('')}</div>
      </div>`;
  }

  function bindListen(btn, text) {
    btn.addEventListener('click', () => {
      if (Speech.speaking) { Speech.stop(); btn.textContent = '🔊 Listen'; return; }
      btn.textContent = '⏹ Stop';
      Speech.speak(text, () => { btn.textContent = '🔊 Listen'; });
    });
  }

  /* ================= Journey: reader + quiz ================= */
  function openLocation(loc) {
    window.Game.setInputEnabled(false);
    Sound.play('open');
    const idx = J.indexOf(loc);
    const stars = state.completed[loc.id] || 0;
    openModal(`
      <div class="reader">
        <div class="reader-head">
          <div class="eyebrow">${loc.testament === 'OT' ? 'Old Testament' : 'New Testament'} · ${esc(loc.region)}${window.STORIES.some(x => x.id === loc.id) ? ` · Story ${window.STORIES.findIndex(x => x.id === loc.id) + 1} of ${window.STORIES.length}` : ''}</div>
          <h2>${esc(loc.name)}</h2>
          ${stars ? `<div class="stars-row">${starIcons(stars)}</div>` : ''}
        </div>
        ${passageHTML(loc.passages)}
        <div class="row gap">
          <button class="btn ghost" id="listenBtn">🔊 Listen</button>
          <button class="btn ghost" id="ctxBtn">📖 Context &amp; background</button>
        </div>
        <div id="ctxBox" class="collapse">${contextHTML(loc)}</div>
        <div class="reflect"><div class="reflect-label">Reflect</div><p>${esc(loc.reflect)}</p></div>
        <div class="row end gap wrap">
          <button class="btn ghost" id="fullCh">📜 Read the whole chapter</button>
          <button class="btn primary" id="quizBtn">Take the quiz ✦</button>
        </div>
      </div>`, { cls: 'parchment' });
    bindListen($('#listenBtn'), passageText(loc.passages));
    $('#ctxBtn').addEventListener('click', () => $('#ctxBox').classList.toggle('open'));
    $('#fullCh').addEventListener('click', () => { closeModal(); window.Reader.openRef(loc.passages[0].ref.replace(/\s*–.*$/, '')); });
    $('#quizBtn').addEventListener('click', () => {
      Speech.stop();
      state.readLocs = state.readLocs || {};
      if (!state.readLocs[loc.id]) { state.readLocs[loc.id] = true; state.readCount++; window.Core.addXP(10, 'Scripture read'); }
      runQuiz($('#modalBody'), loc.quiz, {
        title: loc.name,
        onDone: score => finishLocation(loc, score)
      });
    });
  }

  function starIcons(n, total = 3) {
    let s = '';
    for (let i = 0; i < total; i++) s += `<span class="star ${i < n ? 'on' : ''}">★</span>`;
    return s;
  }

  /* Generic quiz runner. questions: [{q, options, answer, explain?, ref?}] */
  function runQuiz(host, questions, { title, onDone }) {
    let i = 0, score = 0;
    function step() {
      const q = questions[i];
      const order = window.Core.shuffle(q.options.map((_, k) => k));
      host.innerHTML = `
        <div class="quiz">
          <div class="quiz-top">
            <span class="eyebrow">${esc(title)} · Quiz</span>
            <span class="quiz-count">${i + 1} / ${questions.length}</span>
          </div>
          <div class="quiz-progress"><i style="width:${(i / questions.length) * 100}%"></i></div>
          <h3 class="quiz-q">${esc(q.q)}</h3>
          <div class="options">${order.map(k => `<button class="option" data-k="${k}">${esc(q.options[k])}</button>`).join('')}</div>
          <div class="explain hidden" id="explain"></div>
          <div class="row end"><button class="btn primary hidden" id="nextQ">${i + 1 < questions.length ? 'Next →' : 'See results'}</button></div>
        </div>`;
      host.querySelectorAll('.option').forEach(btn => btn.addEventListener('click', () => {
        const k = +btn.dataset.k;
        const ok = k === q.answer;
        if (ok) score++;
        Sound.play(ok ? 'correct' : 'wrong');
        host.querySelectorAll('.option').forEach(b => {
          b.disabled = true;
          if (+b.dataset.k === q.answer) b.classList.add('correct');
        });
        if (!ok) btn.classList.add('wrong');
        const ex = host.querySelector('#explain');
        ex.innerHTML = `<strong>${ok ? '✓ Correct!' : '✗ Not quite.'}</strong> ${q.explain ? esc(q.explain) : ''}${q.ref ? ` <span class="muted">(${esc(q.ref)})</span>` : ''}`;
        ex.className = 'explain ' + (ok ? 'good' : 'bad');
        host.querySelector('#nextQ').classList.remove('hidden');
        host.querySelector('#nextQ').focus();
      }));
      host.querySelector('#nextQ').addEventListener('click', () => {
        i++;
        if (i < questions.length) step(); else onDone(score);
      });
    }
    step();
  }

  function finishLocation(loc, score) {
    const total = loc.quiz.length;
    const passed = score >= Math.ceil(total * 2 / 3);
    const prev = state.completed[loc.id] || 0;
    const firstTime = passed && !prev;
    let gained = 0;
    if (passed && score > prev) {
      gained = (score - prev) * 15 + (firstTime ? 25 : 0);
      state.completed[loc.id] = score;
      if (score === total) state.perfectQuizzes++;
      save();
    }
    window.Core.markDaily('journey');
    if (gained) window.Core.addXP(gained, firstTime ? 'Site completed' : 'Better score');
    const STORIES = window.STORIES;
    const isStory = STORIES.some(x => x.id === loc.id);
    const nextStory = STORIES.find(x => !state.completed[x.id]);
    if (passed) Sound.play('complete'); else Sound.play('wrong');
    $('#modalBody').innerHTML = `
      <div class="result">
        <div class="result-stars">${starIcons(score, total)}</div>
        <h2>${passed ? (score === total ? 'Perfect!' : 'Well done!') : 'Keep seeking'}</h2>
        <p class="lead">You answered ${score} of ${total} correctly.</p>
        ${passed
          ? `<p>${firstTime ? `You completed <strong>${esc(loc.name)}</strong>.` : 'Your progress has been saved.'} ${isStory && nextStory && firstTime ? `Next story: <strong>${esc(nextStory.title)}</strong>.` : ''}</p>`
          : `<p>Read the passage once more. "Thy word is a lamp unto my feet." Then try again.</p>`}
        <div class="row center gap">
          ${passed
            ? `<button class="btn primary" id="contBtn">${isStory ? 'Back to the stories →' : 'Continue →'}</button>`
            : `<button class="btn ghost" id="rereadBtn">📖 Read again</button><button class="btn primary" id="retryBtn">Retry quiz</button>`}
        </div>
      </div>`;
    if (passed) {
      $('#contBtn').addEventListener('click', () => {
        closeModal();
        if (firstTime && isStory) { window.Game.celebrate(loc.id); if (STORIES.every(x => state.completed[x.id])) setTimeout(journeyComplete, 1600); }
      });
    } else {
      $('#rereadBtn').addEventListener('click', () => openLocation(loc));
      $('#retryBtn').addEventListener('click', () => runQuiz($('#modalBody'), loc.quiz, { title: loc.name, onDone: s => finishLocation(loc, s) }));
    }
    updateHUD();
  }

  function journeyComplete() {
    openModal(`
      <div class="result">
        <div class="big-emoji">👑</div>
        <h2>Story Quest complete${window.Personal.name() ? ', ' + esc(window.Personal.name()) : ''}</h2>
        <p class="lead">You have journeyed from Creation to Pentecost, through twelve stories of God's faithfulness.</p>
        <p class="scripture center">"I have fought a good fight, I have finished my course, I have kept the faith."<br><span class="muted">2 Timothy 4:7</span></p>
        <p>Replay any story to earn three stars, and keep up your daily reading and prayer.</p>
        <div class="row center"><button class="btn primary" data-close>Amen</button></div>
      </div>`, { cls: 'parchment' });
  }

  /* ================= Daily ================= */
  function dailyPicks() {
    const seed = window.Core.daySeed();
    const r1 = window.Core.rng(seed);
    const verse = window.DAILY_VERSES[Math.floor(r1() * window.DAILY_VERSES.length)];
    const quiz = window.Core.shuffle(window.QUIZ_BANK, window.Core.rng(seed * 7 + 1)).slice(0, 5);
    const short = window.DAILY_VERSES.filter(v => v.text.split(/\s+/).length <= 26);
    const scramble = short[Math.floor(window.Core.rng(seed * 13 + 3)() * short.length)];
    const blankPool = window.DAILY_VERSES.filter(v => v !== verse);
    const blank = blankPool[Math.floor(window.Core.rng(seed * 17 + 5)() * blankPool.length)];
    const books = window.Core.shuffle(window.BOOKS.map((b, i) => i), window.Core.rng(seed * 19 + 7)).slice(0, 5);
    return { verse, quiz, scramble, blank, books, seed };
  }

  const DAILY_ACTS = [
    ['verse', '📜', 'Verse'], ['quiz', '❓', 'Quiz'], ['scramble', '🧩', 'Scramble'],
    ['blank', '✍️', 'Fill-in'], ['books', '📚', 'Books'], ['prayer', '🙏', 'Prayer']
  ];

  function renderDaily() {
    const d = dailyPicks();
    const t = window.Core.today();
    const doneCount = DAILY_ACTS.filter(([k]) => t[k]).length;
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    $('#dailyPage').innerHTML = `
      <section class="hero">
        <div>
          <div class="eyebrow">${esc(date)}</div>
          <h1>${greet}, ${esc(window.Personal.name() || 'pilgrim')}</h1>
          <p class="muted">Six small steps each day: read, play, pray.</p>
        </div>
        <div class="hero-stats">
          <div class="flame-big">🔥<span>${window.Core.currentStreak()}</span></div>
          <div class="muted small">day streak · best ${state.streak.best || 0}</div>
        </div>
      </section>
      <div class="daily-track">${DAILY_ACTS.map(([k, ic, name]) => `<div class="dot ${t[k] ? 'done' : ''}" title="${name}"><span>${t[k] ? '✓' : ic}</span><small>${name}</small></div>`).join('')}</div>
      <div class="track-bar"><i style="width:${doneCount / DAILY_ACTS.length * 100}%"></i></div>

      <section class="verse-card">
        <div class="eyebrow">Verse of the day</div>
        <blockquote class="scripture big">${verseHTML(d.verse.text)}</blockquote>
        <div class="verse-ref">${esc(d.verse.ref)} <span class="kjv">KJV</span></div>
        <div class="row gap center">
          <button class="btn ghost" id="vListen">🔊 Listen</button>
          <button class="btn ghost" id="vContext">📜 Read in context</button>
          <button class="btn primary" id="vRead" ${t.verse ? 'disabled' : ''}>${t.verse ? '✓ Read today' : 'Amen, I have read it (+5 XP)'}</button>
        </div>
      </section>

      <h2 class="section-title">Daily Bible games</h2>
      <div class="game-grid">
        ${gameCard('quiz', '❓', 'Daily Quiz', 'Five questions from across the whole Bible.', t.quiz)}
        ${gameCard('scramble', '🧩', 'Verse Scramble', 'Put a verse back in the right order.', t.scramble)}
        ${gameCard('blank', '✍️', 'Fill the Blank', 'Choose the missing words of a verse.', t.blank)}
        ${gameCard('books', '📚', 'Books in Order', 'Tap five books in their Bible order.', t.books)}
      </div>

      <section class="cta-card">
        <div>
          <div class="eyebrow">🎮 Bible Story Quest</div>
          <h3>${esc((window.STORIES.find(x => !state.completed[x.id]) || { title: 'Replay any story to earn 3 stars' }).title)}</h3>
        </div>
        <button class="btn primary" id="goJourney">Play →</button>
      </section>
      <section class="cta-card alt">
        <div>
          <div class="eyebrow">Daily prayer</div>
          <h3>${t.prayer ? 'You have prayed today ✓' : 'Take a few minutes with God'}</h3>
        </div>
        <button class="btn ghost" id="goPrayer">Guided prayer →</button>
      </section>`;
    bindListen($('#vListen'), d.verse.ref + '. ' + d.verse.text);
    $('#vContext').addEventListener('click', () => window.Reader.openRef(d.verse.ref));
    $('#vRead').addEventListener('click', () => {
      if (window.Core.markDaily('verse')) window.Core.addXP(5, 'Verse of the day');
      Sound.play('correct');
      renderDaily();
    });
    $$('.game-card').forEach(c => c.addEventListener('click', () => {
      const g = c.dataset.game;
      if (g === 'quiz') playDailyQuiz(d);
      if (g === 'scramble') playScramble(d.scramble);
      if (g === 'blank') playBlank(d.blank, d.seed);
      if (g === 'books') playBooks(d.books);
    }));
    $('#goJourney').addEventListener('click', () => show('journey'));
    $('#goPrayer').addEventListener('click', () => show('prayer'));
  }

  function gameCard(id, icon, name, desc, done) {
    return `<button class="game-card ${done ? 'done' : ''}" data-game="${id}">
      <div class="gc-icon">${icon}</div>
      <div class="gc-body"><h3>${name}</h3><p>${desc}</p></div>
      <div class="gc-status">${done ? '✓ Done' : 'Play'}</div>
    </button>`;
  }

  function dailyReward(key, xp, label) {
    const first = !window.Core.today()[key];
    window.Core.markDaily(key);
    if (first && xp) window.Core.addXP(xp, label);
    return first;
  }

  function playDailyQuiz(d) {
    openModal('<div id="dq"></div>');
    const qs = d.quiz.map(q => Object.assign({}, q, { explain: '' }));
    runQuiz($('#dq'), qs, {
      title: 'Daily Quiz',
      onDone: score => {
        const first = !window.Core.today().quiz;
        window.Core.markDaily('quiz');
        if (first) { window.Core.addXP(score * 6 + (score === 5 ? 10 : 0), 'Daily quiz'); if (score === 5) { state.perfectQuizzes++; save(); window.Core.checkBadges(); } }
        Sound.play(score >= 3 ? 'complete' : 'wrong');
        $('#dq').innerHTML = `<div class="result">
          <div class="result-stars">${starIcons(score, 5)}</div>
          <h2>${score === 5 ? 'Flawless!' : score >= 3 ? 'Well done!' : 'Keep studying!'}</h2>
          <p class="lead">${score} of 5 correct${first ? '' : ' (practice round)'}.</p>
          <p class="muted">A new quiz arrives tomorrow. You can replay today's for practice.</p>
          <div class="row center"><button class="btn primary" data-close>Done</button></div></div>`;
      }
    });
    modalOnClose = () => { if (current === 'daily') renderDaily(); };
  }

  /* ---- Verse Scramble ---- */
  function playScramble(v) {
    const words = v.text.split(/\s+/);
    const nChunks = Math.min(8, Math.max(4, Math.ceil(words.length / 3)));
    const size = Math.ceil(words.length / nChunks);
    const chunks = [];
    for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size).join(' '));
    let bank = chunks.map((c, i) => ({ c, i }));
    do { bank = window.Core.shuffle(bank); } while (bank.every((b, k) => b.i === k) && bank.length > 1);
    let placed = [];
    let hints = 0;
    openModal(`<div class="scramble">
      <div class="eyebrow">Verse Scramble</div>
      <h3>Tap the pieces in the right order</h3>
      <p class="muted">${esc(v.ref)}</p>
      <div class="answer-area" id="answer"></div>
      <div class="bank" id="bank"></div>
      <div class="explain hidden" id="sMsg"></div>
      <div class="row gap center"><button class="btn ghost" id="hintBtn">💡 Hint</button><button class="btn ghost" id="resetBtn">↺ Reset</button></div>
    </div>`);
    modalOnClose = () => { if (current === 'daily') renderDaily(); };
    function draw() {
      $('#answer').innerHTML = placed.length ? placed.map((p, k) => `<button class="tile placed ${p.locked ? 'locked' : ''}" data-k="${k}">${esc(p.c)}</button>`).join('') : '<span class="placeholder">Your verse will appear here…</span>';
      $('#bank').innerHTML = bank.map((p, k) => `<button class="tile" data-k="${k}">${esc(p.c)}</button>`).join('');
      $$('#bank .tile').forEach(t => t.addEventListener('click', () => { Sound.play('tap'); placed.push(bank.splice(+t.dataset.k, 1)[0]); draw(); check(); }));
      $$('#answer .tile').forEach(t => t.addEventListener('click', () => { const p = placed[+t.dataset.k]; if (p.locked) return; Sound.play('tap'); bank.push(placed.splice(+t.dataset.k, 1)[0]); draw(); }));
    }
    function check() {
      if (bank.length) return;
      const ok = placed.every((p, k) => p.i === k);
      const msg = $('#sMsg');
      if (ok) {
        Sound.play('complete');
        const first = dailyReward('scramble', Math.max(8, 20 - hints * 4), 'Verse scramble');
        if (first) { state.scrambles++; save(); window.Core.checkBadges(); }
        $('#answer').classList.add('solved');
        msg.className = 'explain good';
        msg.innerHTML = `<strong>✓ Beautiful!</strong> <span class="scripture">${verseHTML(v.text)}</span> <em>${esc(v.ref)}</em><div class="row center"><button class="btn primary" data-close>Done</button></div>`;
        $('#hintBtn').disabled = $('#resetBtn').disabled = true;
      } else {
        Sound.play('wrong');
        $('#answer').classList.add('shake');
        setTimeout(() => $('#answer') && $('#answer').classList.remove('shake'), 500);
        msg.className = 'explain bad';
        msg.textContent = 'Not quite. Tap a piece to send it back, or use a hint.';
      }
    }
    $('#hintBtn').addEventListener('click', () => {
      // lock the next correct piece into place
      const pos = placed.findIndex((p, k) => p.i !== k);
      const want = pos === -1 ? placed.length : pos;
      bank = bank.concat(placed.splice(want));
      const bi = bank.findIndex(b => b.i === want);
      if (bi >= 0) { const p = bank.splice(bi, 1)[0]; p.locked = true; placed.push(p); hints++; Sound.play('tap'); }
      draw(); check();
    });
    $('#resetBtn').addEventListener('click', () => { bank = bank.concat(placed.filter(p => !p.locked)); placed = placed.filter(p => p.locked); draw(); $('#sMsg').className = 'explain hidden'; });
    draw();
  }

  /* ---- Fill the Blank ---- */
  function playBlank(v, seed) {
    const tokens = v.text.split(/(\s+)/);
    const clean = w => w.replace(/[^A-Za-z']/g, '');
    const cand = tokens.map((w, i) => ({ w: clean(w), i })).filter(o => o.w.length >= 4 && !/^(that|they|them|with|unto|have|shall|thee|thou|this|which|from|their|will)$/i.test(o.w));
    const rand = window.Core.rng(seed * 23 + 11);
    const picks = window.Core.shuffle(cand, rand).slice(0, Math.min(3, cand.length)).sort((a, b) => a.i - b.i);
    const pool = Array.from(new Set(window.DAILY_VERSES.flatMap(x => x.text.split(/\s+/).map(clean)).filter(w => w.length >= 4)));
    let cur = 0, correct = 0;
    const filled = {};
    openModal(`<div class="blank-game">
      <div class="eyebrow">Fill the Blank</div>
      <h3>Choose the missing words</h3>
      <blockquote class="scripture big" id="bVerse"></blockquote>
      <div class="verse-ref">${esc(v.ref)}</div>
      <div class="options" id="bOpts"></div>
      <div class="explain hidden" id="bMsg"></div>
    </div>`);
    modalOnClose = () => { if (current === 'daily') renderDaily(); };
    function drawVerse() {
      $('#bVerse').innerHTML = tokens.map((tk, i) => {
        const pk = picks.findIndex(p => p.i === i);
        if (pk === -1) return verseHTML(tk);
        const w = picks[pk].w, rest = tk.replace(w, '');
        if (filled[pk]) return `<span class="blank ${filled[pk]}">${esc(w)}</span>${esc(rest)}`;
        return `<span class="blank ${pk === cur ? 'active' : ''}">${'_'.repeat(Math.max(4, w.length))}</span>${esc(rest)}`;
      }).join('');
    }
    function drawOpts() {
      if (cur >= picks.length) return finish();
      const answer = picks[cur].w;
      const decoys = window.Core.shuffle(pool.filter(w => w.toLowerCase() !== answer.toLowerCase())).slice(0, 3);
      const opts = window.Core.shuffle([answer, ...decoys]);
      $('#bOpts').innerHTML = opts.map(o => `<button class="option" data-w="${esc(o)}">${esc(o)}</button>`).join('');
      $$('#bOpts .option').forEach(b => b.addEventListener('click', () => {
        const ok = b.dataset.w === answer;
        Sound.play(ok ? 'correct' : 'wrong');
        if (ok) correct++;
        filled[cur] = ok ? 'right' : 'missed';
        cur++;
        drawVerse();
        setTimeout(drawOpts, ok ? 250 : 700);
        if (!ok) { b.classList.add('wrong'); $$('#bOpts .option').forEach(x => { x.disabled = true; if (x.dataset.w === answer) x.classList.add('correct'); }); }
      }));
    }
    function finish() {
      $('#bOpts').innerHTML = '';
      dailyReward('blank', 5 * correct + 5, 'Fill the blank');
      Sound.play(correct === picks.length ? 'complete' : 'correct');
      const m = $('#bMsg');
      m.className = 'explain ' + (correct === picks.length ? 'good' : 'bad');
      m.innerHTML = `<strong>${correct} of ${picks.length} correct.</strong> Read the whole verse aloud once more to fix it in your heart.<div class="row center gap"><button class="btn ghost" id="bListen">🔊 Listen</button><button class="btn primary" data-close>Done</button></div>`;
      bindListen($('#bListen'), v.ref + '. ' + v.text);
    }
    drawVerse(); drawOpts();
  }

  /* ---- Books in Order ---- */
  function playBooks(indices) {
    const sorted = indices.slice().sort((a, b) => a - b);
    let pos = 0, lives = 3;
    openModal(`<div class="books-game">
      <div class="eyebrow">Books in Order</div>
      <h3>Tap these books in the order they appear in the Bible</h3>
      <div class="lives" id="lives"></div>
      <div class="book-tiles" id="bTiles">${window.Core.shuffle(indices).map(i => `<button class="book-tile" data-i="${i}"><span class="bt-name">${esc(window.BOOKS[i][0])}</span><span class="bt-sec">${esc(window.BOOKS[i][1])}</span></button>`).join('')}</div>
      <ol class="book-order" id="bOrder"></ol>
      <div class="explain hidden" id="bkMsg"></div>
    </div>`);
    modalOnClose = () => { if (current === 'daily') renderDaily(); };
    const drawLives = () => { $('#lives').innerHTML = '❤️'.repeat(lives) + '🤍'.repeat(3 - lives); };
    drawLives();
    $$('.book-tile').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      const i = +b.dataset.i;
      if (i === sorted[pos]) {
        Sound.play('correct');
        b.disabled = true; b.classList.add('correct');
        b.insertAdjacentHTML('afterbegin', `<span class="bt-num">${pos + 1}</span>`);
        $('#bOrder').insertAdjacentHTML('beforeend', `<li><strong>${esc(window.BOOKS[i][0])}</strong> <span class="muted">(book ${i + 1} of 66)</span>: ${esc(window.BOOKS[i][2])}</li>`);
        pos++;
        if (pos === sorted.length) end(true);
      } else {
        Sound.play('wrong');
        lives--; drawLives();
        b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 450);
        if (lives <= 0) end(false);
      }
    }));
    function end(win) {
      $$('.book-tile').forEach(b => b.disabled = true);
      if (win) dailyReward('books', 10 + lives * 3, 'Books in order');
      Sound.play(win ? 'complete' : 'wrong');
      const m = $('#bkMsg');
      m.className = 'explain ' + (win ? 'good' : 'bad');
      m.innerHTML = win
        ? `<strong>✓ Correct order!</strong> The Bible has 39 Old Testament and 27 New Testament books.<div class="row center"><button class="btn primary" data-close>Done</button></div>`
        : `<strong>Out of hearts.</strong> The right order was: ${sorted.map(i => esc(window.BOOKS[i][0])).join(' → ')}.<div class="row center gap"><button class="btn ghost" id="bkRetry">Try again</button><button class="btn primary" data-close>Done</button></div>`;
      if (!win) $('#bkRetry').addEventListener('click', () => playBooks(indices));
    }
  }

  /* ================= Study ================= */
  let studyTab = 'passages', studyFilter = '', bookFilter = 'All';
  function renderStudy() {
    const page = $('#studyPage');
    page.innerHTML = `
      <section class="hero slim">
        <div><div class="eyebrow">Study &amp; understanding</div><h1>Open the Word</h1>
        <p class="muted">Every passage comes with its setting, background and key themes. Write your own notes as you go.</p></div>
      </section>
      <div class="seg">
        <button class="seg-btn ${studyTab === 'passages' ? 'active' : ''}" data-t="passages">Passages</button>
        <button class="seg-btn ${studyTab === 'books' ? 'active' : ''}" data-t="books">Books of the Bible</button>
      </div>
      <div id="studyBody"></div>`;
    $$('.seg-btn').forEach(b => b.addEventListener('click', () => { studyTab = b.dataset.t; renderStudy(); }));
    if (studyTab === 'passages') renderPassageList(); else renderBooks();
  }

  function renderPassageList() {
    const body = $('#studyBody');
    body.innerHTML = `<input class="search" id="sSearch" placeholder="Search passages, places, themes…" value="${esc(studyFilter)}">
      <div id="pList"></div>`;
    const draw = () => {
      const f = studyFilter.toLowerCase();
      const match = l => !f || [l.name, l.region, ...l.passages.map(p => p.ref), ...l.context.themes, ...l.passages.flatMap(p => p.verses.map(v => v[1]))].join(' ').toLowerCase().includes(f);
      const group = (t, label) => {
        const items = J.filter(l => l.testament === t && match(l));
        if (!items.length) return '';
        return `<h2 class="section-title">${label}</h2><div class="plist">${items.map(l => {
          const st = state.completed[l.id] || 0;
          const unlocked = window.Game.isUnlocked(l);
          return `<button class="pcard" data-id="${l.id}">
            <div class="pc-top"><span class="pc-region">${esc(l.region)}</span>${st ? `<span class="pc-stars">${'★'.repeat(st)}</span>` : unlocked ? '' : '<span class="pc-lock">🔒 on map</span>'}</div>
            <h3>${esc(l.name)}</h3>
            <div class="pc-refs">${l.passages.map(p => esc(p.ref)).join(' · ')}</div>
            <p>${esc(l.passages[0].verses[0][1].slice(0, 110))}${l.passages[0].verses[0][1].length > 110 ? '…' : ''}</p>
            ${state.notes[l.id] ? '<div class="pc-note">📝 Has notes</div>' : ''}
          </button>`;
        }).join('')}</div>`;
      };
      const html = group('OT', 'Old Testament') + group('NT', 'New Testament');
      $('#pList').innerHTML = html || '<p class="muted center">No passages match your search.</p>';
      $$('.pcard').forEach(c => c.addEventListener('click', () => openStudy(J.find(l => l.id === c.dataset.id))));
    };
    $('#sSearch').addEventListener('input', e => { studyFilter = e.target.value; draw(); });
    draw();
  }

  function openStudy(loc) {
    const unlocked = window.Game.isUnlocked(loc);
    openModal(`
      <div class="reader">
        <div class="reader-head">
          <div class="eyebrow">Study · ${esc(loc.region)}</div>
          <h2>${esc(loc.name)}</h2>
        </div>
        ${passageHTML(loc.passages)}
        <div class="row gap"><button class="btn ghost" id="listenBtn">🔊 Listen</button></div>
        ${contextHTML(loc)}
        <div class="reflect"><div class="reflect-label">Reflect</div><p>${esc(loc.reflect)}</p></div>
        <label class="notes-label" for="notes">📝 My notes</label>
        <textarea id="notes" class="notes" placeholder="What is God showing you in this passage?">${esc(state.notes[loc.id] || '')}</textarea>
        <div class="muted small" id="saved">Notes are saved on this device.</div>
        <div class="row end gap">
          <button class="btn ghost" id="fullCh">📜 Read the whole chapter</button>
          ${window.Game.hasStory(loc.id) ? (unlocked ? '<button class="btn primary" id="goMap">🎮 Play this story</button>' : '<span class="muted small">🔒 Unlocks in Bible Story Quest</span>') : ''}
        </div>
      </div>`, { cls: 'parchment' });
    bindListen($('#listenBtn'), passageText(loc.passages));
    let tmr;
    $('#notes').addEventListener('input', e => {
      clearTimeout(tmr);
      tmr = setTimeout(() => { state.notes[loc.id] = e.target.value; save(); $('#saved').textContent = '✓ Saved'; }, 400);
    });
    $('#fullCh').addEventListener('click', () => { closeModal(); window.Reader.openRef(loc.passages[0].ref.replace(/\s*–.*$/, '')); });
    if (unlocked && window.Game.hasStory(loc.id)) $('#goMap').addEventListener('click', () => { closeModal(); show('journey'); window.Game.playStory(loc.id); });
  }

  function renderBooks() {
    const sections = ['All', ...Array.from(new Set(window.BOOKS.map(b => b[1])))];
    $('#studyBody').innerHTML = `
      <div class="chips filter">${sections.map(s => `<button class="chip ${s === bookFilter ? 'active' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="books">${window.BOOKS.map((b, i) => (bookFilter === 'All' || b[1] === bookFilter) ? `
        <div class="book ${i < 39 ? 'ot' : 'nt'}">
          <div class="book-num">${i + 1}</div>
          <div><h3>${esc(b[0])}</h3><div class="book-sec">${esc(b[1])} · ${i < 39 ? 'Old' : 'New'} Testament</div><p>${esc(b[2])}</p></div>
        </div>` : '').join('')}</div>`;
    $$('.chips.filter .chip').forEach(c => c.addEventListener('click', () => { bookFilter = c.dataset.s; renderBooks(); }));
  }

  /* ================= Prayer ================= */
  let prayerSecs = 60, prayerTimer = null;
  function stopPrayerTimer() { if (prayerTimer) { clearInterval(prayerTimer); prayerTimer = null; } }

  let prayerTab = 'pray';
  const PRAYER_TABS = [['pray', '🙏 Pray'], ['requests', '📝 My requests'], ['led', '🕊️ Led to pray'], ['people', '🤲 Who I pray for'], ['reminders', '⏰ Alarms']];
  function renderPrayer() {
    if (!PRAYER_TABS.some(t => t[0] === prayerTab)) prayerTab = 'pray';
    const t = window.Core.today();
    const head = `
      <section class="hero slim">
        <div><div class="eyebrow">Prayer</div><h1>Pray without ceasing</h1>
        <p class="muted">"Lord, teach us to pray." (Luke 11:1)</p></div>
        <div class="hero-stats"><div class="flame-big">🙏<span>${state.prayers}</span></div><div class="muted small">sessions prayed</div></div>
      </section>
      <div class="seg ptabs">${PRAYER_TABS.map(([k, l]) => `<button class="seg-btn ${prayerTab === k ? 'active' : ''}" data-pt="${k}">${l}${k === 'people' && state.people.length ? ` <span class="count">${state.people.length}</span>` : ''}${k === 'requests' && state.requests.some(r => r.status === 'open') ? ` <span class="count">${state.requests.filter(r => r.status === 'open').length}</span>` : ''}${k === 'reminders' && state.reminders.filter(r => r.enabled).length ? ` <span class="count">${state.reminders.filter(r => r.enabled).length}</span>` : ''}</button>`).join('')}</div>`;
    const bindTabs = () => $$('.ptabs .seg-btn').forEach(b => b.addEventListener('click', () => { prayerTab = b.dataset.pt; Sound.play('tap'); renderPrayer(); }));
    if (prayerTab === 'people') { $('#prayerPage').innerHTML = head + '<div id="peopleHost"></div>'; bindTabs(); window.PrayList.renderPeople($('#peopleHost')); return; }
    if (prayerTab === 'reminders') { $('#prayerPage').innerHTML = head + '<div id="remindersHost"></div>'; bindTabs(); window.PrayList.renderReminders($('#remindersHost')); return; }
    if (prayerTab === 'requests') { $('#prayerPage').innerHTML = head + '<div id="requestsHost"></div>'; bindTabs(); window.Requests.renderRequests($('#requestsHost')); return; }
    if (prayerTab === 'led') { $('#prayerPage').innerHTML = head + '<div id="leadingsHost"></div>'; bindTabs(); window.Requests.renderLeadings($('#leadingsHost')); return; }
    $('#prayerPage').innerHTML = head + `
      <section class="acts-card">
        <div class="acts-letters">${window.ACTS_STEPS.map(s => `<div class="acts-l" style="--c:${s.color}"><b>${s.key}</b><small>${s.name}</small></div>`).join('')}</div>
        <h2>Guided prayer</h2>
        <p>Walk through Adoration, Confession, Thanksgiving and Supplication. Each step has a scripture and a gentle timer.</p>
        <div class="row gap center wrap">
          <div class="seg small">${[30, 60, 120].map(s => `<button class="seg-btn ${prayerSecs === s ? 'active' : ''}" data-s="${s}">${s < 60 ? s + 's' : s / 60 + ' min'}</button>`).join('')}</div>
          <button class="btn primary" id="startPrayer">${t.prayer ? 'Pray again' : 'Begin guided prayer'}</button>
        </div>
      </section>

      <h2 class="section-title">Prayers from Scripture</h2>
      <div class="prayer-list">${window.SCRIPTURE_PRAYERS.map((p, i) => `
        <details class="prayer-item">
          <summary><span>${esc(p.title)}</span><span class="muted small">${esc(p.ref)}</span></summary>
          <p class="scripture">${verseHTML(p.text)}</p>
          <div class="row gap"><button class="btn ghost small" data-listen="${i}">🔊 Pray along</button><button class="btn ghost small" data-ctx="${esc(p.ref)}">📜 In context</button></div>
        </details>`).join('')}</div>

      <section class="cta-card alt">
        <div><div class="eyebrow">Intercession</div><h3>${state.people.length ? `${state.people.length} ${state.people.length === 1 ? 'person' : 'people'} on your prayer list` : 'Start a prayer list'}</h3></div>
        <button class="btn ghost" id="goPeople">Who I pray for →</button>
      </section>`;
    bindTabs();
    $$('.acts-card .seg-btn').forEach(b => b.addEventListener('click', () => { prayerSecs = +b.dataset.s; renderPrayer(); }));
    $('#startPrayer').addEventListener('click', () => guidedPrayer(0));
    $$('[data-listen]').forEach(b => { const p = window.SCRIPTURE_PRAYERS[+b.dataset.listen]; bindListen(b, p.text); });
    $$('[data-ctx]').forEach(b => b.addEventListener('click', () => window.Reader.openRef(b.dataset.ctx)));
    $('#goPeople').addEventListener('click', () => { prayerTab = 'people'; renderPrayer(); });
  }

  function guidedPrayer(stepIdx) {
    stopPrayerTimer();
    const steps = window.ACTS_STEPS;
    if (stepIdx >= steps.length) return prayerDone();
    const s = steps[stepIdx];
    const C = 2 * Math.PI * 54;
    const html = `
      <div class="pray-step" style="--c:${s.color}">
        <div class="eyebrow">Step ${stepIdx + 1} of ${steps.length}</div>
        <div class="timer">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="track"/><circle cx="60" cy="60" r="54" class="ring" id="ring" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
          <div class="timer-inner"><b>${s.key}</b><span id="tLeft">${fmt(prayerSecs)}</span></div>
        </div>
        <h2>${s.name}</h2>
        <p class="lead">${esc(s.prompt)}</p>
        <blockquote class="scripture">${verseHTML(s.verse.text)}<br><span class="muted small">${esc(s.verse.ref)}</span></blockquote>
        <p class="breathe" id="breathe">Breathe in…</p>
        <div class="row center gap">
          <button class="btn ghost" id="pPause">⏸ Pause</button>
          <button class="btn primary" id="pNext">${stepIdx + 1 < steps.length ? 'Next step →' : 'Finish 🙏'}</button>
        </div>
      </div>`;
    if (!modalOpen) openModal(html, { cls: 'prayer-modal' }); else $('#modalBody').innerHTML = html;
    if (stepIdx === 0) Sound.play('bell');
    let left = prayerSecs, paused = false, tick = 0;
    prayerTimer = setInterval(() => {
      if (paused) return;
      tick++;
      if (tick % 4 === 0 && $('#breathe')) $('#breathe').textContent = (tick / 4) % 2 ? 'Breathe out…' : 'Breathe in…';
      if (tick % 1 === 0) {
        left = Math.max(0, left - 1);
        if ($('#tLeft')) $('#tLeft').textContent = fmt(left);
        if ($('#ring')) $('#ring').setAttribute('stroke-dashoffset', String(C * (1 - left / prayerSecs)));
        if (left === 0) { stopPrayerTimer(); Sound.play('bell'); if ($('#pNext')) $('#pNext').classList.add('pulse'); }
      }
    }, 1000);
    $('#pPause').addEventListener('click', e => { paused = !paused; e.target.textContent = paused ? '▶ Resume' : '⏸ Pause'; });
    $('#pNext').addEventListener('click', () => guidedPrayer(stepIdx + 1));
  }
  function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function prayerDone() {
    const first = !window.Core.today().prayer;
    state.prayers++; save();
    window.Core.markDaily('prayer');
    if (first) window.Core.addXP(20, 'Guided prayer');
    window.Core.checkBadges();
    Sound.play('complete');
    $('#modalBody').innerHTML = `
      <div class="result">
        <div class="big-emoji">🕊️</div>
        <h2>Amen</h2>
        <p class="scripture center">${verseHTML(window.SCRIPTURE_PRAYERS[2].text)}<br><span class="muted small">Numbers 6:24-26</span></p>
        <div class="row center"><button class="btn primary" data-close>Go in peace</button></div>
      </div>`;
    modalOnClose = () => { if (current === 'prayer') renderPrayer(); };
  }

  /* ================= Profile ================= */
  function openProfile() {
    const li = window.Core.levelInfo();
    const done = J.filter(l => state.completed[l.id]).length;
    const stars = J.reduce((a, l) => a + (state.completed[l.id] || 0), 0);
    openModal(`
      <div class="profile-view">
        <div class="pv-head">
          <div class="pv-level">${li.level}</div>
          <div>${window.Personal.name() ? `<div class="pv-name">${esc(window.Personal.name())}</div>` : ''}<div class="eyebrow">Level ${li.level}</div><h2>${li.title}</h2>
          <div class="xpbar big"><i style="width:${Math.round(li.progress * 100)}%"></i></div>
          <div class="muted small">${state.xp} XP · ${li.toNext} XP to next level</div></div>
        </div>
        <div class="stats">
          <div><b>${done}/${J.length}</b><span>Sites</span></div>
          <div><b>${stars}/${J.length * 3}</b><span>Stars</span></div>
          <div><b>${window.Core.currentStreak()}</b><span>Streak</span></div>
          <div><b>${state.streak.best || 0}</b><span>Best streak</span></div>
          <div><b>${state.prayers}</b><span>Prayers</span></div>
          <div><b>${state.perfectQuizzes}</b><span>Perfect quizzes</span></div>
        </div>
        <h3 class="section-title">Badges</h3>
        <div class="badges">${window.Core.BADGES.map(b => `<div class="badge ${state.badges.includes(b.id) ? 'earned' : ''}" title="${esc(b.desc)}"><div class="b-icon">${b.icon}</div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join('')}</div>
        <h3 class="section-title">Offline</h3>
        <p class="offline-row" id="offlineRow">Checking…</p>
        <h3 class="section-title">Settings</h3>
        <div class="row gap wrap">
          <button class="btn ghost" id="sndBtn">${state.sound ? '🔔 Sound on' : '🔕 Sound off'}</button>
          <button class="btn ghost" id="persBtn">✨ Personalize</button>
          <button class="btn ghost" id="instBtn">📲 Install app</button>
          <button class="btn ghost" id="exportBtn">💾 Back up my data</button>
          <label class="btn ghost" id="importLbl">📂 Restore backup<input type="file" id="importFile" accept="application/json,.json" hidden></label>
          <button class="btn ghost danger" id="resetBtn">Reset all progress</button>
        </div>
        <p class="muted small credit">All scripture is from the King James Version, which is in the public domain. Context notes and quizzes are original to this app.</p>
      </div>`);
    updateOfflineRow();
    $('#sndBtn').addEventListener('click', e => { state.sound = !state.sound; save(); e.target.textContent = state.sound ? '🔔 Sound on' : '🔕 Sound off'; Sound.play('tap'); });
    $('#persBtn').addEventListener('click', () => window.Personal.openSettings());
    $('#instBtn').addEventListener('click', () => window.Personal.install());
    $('#exportBtn').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }));
      a.download = `lamp-and-path-backup-${window.Core.dateKey()}.json`;
      document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
      toast('💾 Backup downloaded. Keep it somewhere safe.');
    });
    $('#importFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (typeof data !== 'object' || !('xp' in data)) throw new Error('bad file');
        if (!(await window.UI.ask('Replace everything on this device with this backup?', 'Replace'))) return;
        localStorage.setItem('lamp-and-path-v1', JSON.stringify(data));
        location.reload();
      } catch (err) { toast('That file is not a Lamp & Path backup'); }
    });
    $('#resetBtn').addEventListener('click', async () => {
      if (!(await window.UI.ask('This erases your journey, streaks, highlights, notes, prayer list and journal on this device.', 'Erase everything'))) return;
      localStorage.removeItem('lamp-and-path-v1');
      location.reload();
    });
  }

  /* Offline status, shown in the profile. */
  async function offlineStatus() {
    if (!('serviceWorker' in navigator) || !('caches' in window) || !location.protocol.startsWith('http')) {
      return { ok: false, text: 'Offline saving is not available here. Open the app from its own web address (for example GitHub Pages) and add it to your home screen.' };
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return { ok: false, text: 'Offline saving is not available in this viewer. Open the app from its own web address and add it to your home screen.' };
      const keys = await caches.keys();
      const bible = keys.includes('lamp-bible-v1') ? (await (await caches.open('lamp-bible-v1')).keys()).length : 0;
      const shell = keys.some(k => k.startsWith('lamp-shell-'));
      if (shell && bible >= 66) return { ok: true, text: '✓ Ready offline. The app, its fonts and all 66 books of the Bible are saved on this device.' };
      return { ok: false, text: `Saving for offline use… ${bible}/66 Bible books so far. Keep the app open while connected.` };
    } catch (e) { return { ok: false, text: 'Could not check offline status.' }; }
  }
  async function updateOfflineRow(text) {
    const row = document.getElementById('offlineRow');
    if (!row) return;
    if (text) { row.textContent = text; row.className = 'offline-row'; return; }
    const st = await offlineStatus();
    row.textContent = st.text;
    row.className = 'offline-row ' + (st.ok ? 'ok' : '');
  }

  /* In-page confirmation (browser confirm() dialogs are blocked in some viewers). */
  function ask(message, okLabel = 'OK') {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'ask-overlay';
      box.innerHTML = `<div class="ask-card" role="alertdialog" aria-modal="true">
        <p>${esc(message)}</p>
        <div class="row end gap"><button class="btn ghost" data-a="0">Cancel</button><button class="btn primary danger-fill" data-a="1">${esc(okLabel)}</button></div>
      </div>`;
      document.body.appendChild(box);
      const done = v => { box.remove(); window.removeEventListener('keydown', key, true); resolve(v); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      window.addEventListener('keydown', key, true);
      box.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === '1'); else if (e.target === box) done(false); });
      box.querySelector('[data-a="1"]').focus();
    });
  }

  window.UI = {
    openModal, closeModal, show, ask,
    refresh: () => { updateHUD(); if (current && current !== 'journey') show(current); },
    onModalClose: fn => { modalOnClose = fn; },
    startGuidedPrayer: () => guidedPrayer(0)
  };

  /* ================= Boot ================= */
  function boot() {
    $$('.tab').forEach(b => b.addEventListener('click', () => { Sound.play('tap'); show(b.dataset.view); }));
    $('#profileBtn').addEventListener('click', openProfile);
    $('#settingsBtn').addEventListener('click', () => window.Personal.openSettings());
    window.Personal.start();
    updateHUD();
    window.Game.init($('#world'), { onFinish: loc => { window.Core.Sound.play('open'); openLocation(loc); } });

    show(location.hash.slice(1) || 'daily');
    window.PrayList.startScheduler();
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.addEventListener('message', e => {
        const m = e.data || {};
        if (m.type === 'offline-progress') updateOfflineRow(`Saving the Bible for offline use… ${m.done}/${m.total} books`);
        if (m.type === 'offline-ready') {
          updateOfflineRow();
          if (m.bible === m.total && !state.offlineReady) {
            state.offlineReady = true; save();
            toast('✓ Ready to use offline: the app and all 66 books of the Bible are saved on this device', 'level');
          }
        }
      });
      navigator.serviceWorker.register('sw.js').then(reg => {
        // fill in anything missing (e.g. after an interrupted first download)
        navigator.serviceWorker.ready.then(r => r.active && r.active.postMessage('offline-check'));
        return reg;
      }).catch(() => {});
    }
  }

  boot();
})();
