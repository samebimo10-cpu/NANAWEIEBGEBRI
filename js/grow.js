/*
 * Grow: everything for going deeper in the Word.
 *  reading plans · a word for how I feel · Scripture memory (spaced repetition) · topical studies
 *  S.O.A.P. journal · evening reflection · sermon notes · Ebenezer (my faith story) · my week with God
 *  plus the study passages with quizzes and the books of the Bible.
 * Scripture is stored as references and read from the bundled KJV, so the wording is always exact.
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const B = () => window.Bible;
  const UI = () => window.UI;
  const lordHTML = t => esc(t).replace(/LORD/g, '<span class="sc">Lord</span>');

  /* ---------------- Dates ---------------- */
  const todayKey = () => window.Core.dateKey();
  const keyDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = keyDate(k); d.setDate(d.getDate() + n); return window.Core.dateKey(d); };
  const daysBetween = (a, b) => Math.round((keyDate(b) - keyDate(a)) / 86400000);
  const fmtDate = (k, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => keyDate(k).toLocaleDateString(undefined, opts);
  const fmtTime = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const uid = p => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

  /* ---------------- Scripture blocks ----------------
   * <div class="vref" data-ref="John 3:16"></div> is filled with the KJV text and small actions. */
  async function fillRefs(host, opts = {}) {
    const els = Array.from((host || document).querySelectorAll('.vref:not(.filled)'));
    await Promise.all(els.map(async el => {
      el.classList.add('filled');
      const ref = el.dataset.ref;
      try {
        const r = await B().lookup(ref);
        const text = r.verses.map(v => v[1]).join(' ');
        const numbered = r.verses.length > 1 ? r.verses.map(([n, t]) => `<sup>${n}</sup>${lordHTML(t)}`).join(' ') : lordHTML(text);
        const plain = el.dataset.plain === '1';
        el.innerHTML = `<blockquote class="scripture">${numbered}</blockquote>
          <div class="vref-foot"><b>${esc(r.ref)}</b>${plain ? '' : `<span class="vref-acts">
            <button class="mini" data-va="open" title="Read in context">📜</button>
            <button class="mini" data-va="mem" title="Memorize">🧠</button>
            <button class="mini" data-va="card" title="Share as an image">🖼️</button>
            <button class="mini" data-va="listen" title="Listen">🔊</button></span>`}</div>`;
        el.querySelectorAll('[data-va]').forEach(b => b.addEventListener('click', e => {
          e.stopPropagation();
          const a = b.dataset.va;
          if (a === 'open') { UI().closeModal(); window.Reader.openRef(r.ref); }
          if (a === 'mem') addMemory(r.ref);
          if (a === 'card') window.Cards.verse(r.ref, text);
          if (a === 'listen') window.Core.Speech.speak(r.ref + '. ' + text);
        }));
        if (opts.onText) opts.onText(el, r, text);
      } catch (e) { el.innerHTML = `<p class="muted small">${esc(ref)}: ${esc(e.message)}</p>`; }
    }));
  }
  const vref = (ref, plain) => `<div class="vref" data-ref="${esc(ref)}"${plain ? ' data-plain="1"' : ''}><p class="muted small">${esc(ref)}…</p></div>`;

  /* ================= Reading plans ================= */
  const range = (b0, b1) => { const out = []; for (let b = b0; b <= b1; b++) for (let c = 1; c <= B().CHAPTERS[b]; c++) out.push([b, c]); return out; };
  const split = (list, days) => Array.from({ length: days }, (_, i) => list.slice(Math.floor(i * list.length / days), Math.floor((i + 1) * list.length / days)));
  const schedules = {};
  function schedule(id) {
    if (schedules[id]) return schedules[id];
    let s;
    if (id === 'start21') s = window.START21.map(r => { const p = B().parse(r); return [[p.b, p.c]]; });
    else if (id === 'gospels30') s = split(range(39, 42), 30);
    else if (id === 'pp31') { const ps = split(range(18, 18), 31); s = ps.map((d, i) => [[19, i + 1], ...d]); }
    else if (id === 'nt90') s = split(range(39, 65), 90);
    else s = split(range(0, 65), 365);
    return (schedules[id] = s);
  }
  const chKey = (b, c) => `${b}.${c}`;
  const chName = (b, c) => `${B().NAMES[b]} ${c}`;
  const planDef = id => window.PLANS.find(p => p.id === id);

  function planStatus() {
    const p = state.plan;
    if (!p) return null;
    const def = planDef(p.id), days = schedule(p.id);
    const isDone = i => days[i].every(([b, c]) => p.read[chKey(b, c)]);
    const doneDays = days.filter((_, i) => isDone(i)).length;
    const dayNow = Math.min(days.length - 1, Math.max(0, daysBetween(p.start, todayKey())));
    let next = days.findIndex((_, i) => !isDone(i));
    if (next < 0) next = days.length - 1;
    let behind = 0;
    for (let i = 0; i < dayNow; i++) if (!isDone(i)) behind++;
    return { p, def, days, isDone, doneDays, dayNow, next, behind, complete: doneDays === days.length };
  }

  function startPlan(id) {
    state.plan = { id, start: todayKey(), read: {} };
    save(); Sound.play('open');
    toast(`🗓️ ${planDef(id).name} started. Day 1 is ready.`);
  }

  function checkPlanComplete() {
    const st = planStatus();
    if (!st || !st.complete) return;
    state.plansDone.push({ id: st.p.id, at: Date.now() });
    state.milestones.push({ id: uid('m'), date: todayKey(), title: `Finished the reading plan "${st.def.name}"`, story: `Started ${fmtDate(st.p.start)}.`, ref: 'Psalm 119:105', kind: 'plan' });
    state.plan = null;
    save();
    window.Core.addXP(100, 'Reading plan complete');
    setTimeout(() => {
      Sound.play('level');
      UI().openModal(`<div class="result"><div class="big-emoji">🎉</div><h2>Plan complete!</h2>
        <p class="lead">You finished <b>${esc(st.def.name)}</b>${window.Personal.name() ? ', ' + esc(window.Personal.name()) : ''}.</p>
        ${vref('2 Timothy 4:7', true)}
        <p class="muted small">It has been added to your Ebenezer timeline.</p>
        <div class="row center"><button class="btn primary" data-close>Amen</button></div></div>`, { cls: 'parchment' });
      fillRefs($('#modalBody'));
    }, 400);
  }

  /* Called by the Bible reader's "I've read this chapter" button. */
  function markRead(b, c) {
    const k = chKey(b, c), t = todayKey();
    const before = planStatus();
    const firstToday = !state.readLog[k] || window.Core.dateKey(new Date(state.readLog[k])) !== t;
    state.readLog[k] = Date.now();
    if (firstToday) state.readHist[t] = (state.readHist[t] || 0) + 1;
    let inPlan = false;
    if (state.plan && schedule(state.plan.id).some(d => d.some(([pb, pc]) => pb === b && pc === c))) { state.plan.read[k] = true; inPlan = true; }
    save();
    const firstRead = !window.Core.today().read;
    window.Core.markDaily('read');
    if (firstToday) window.Core.addXP(firstRead ? 15 : 5, 'Chapter read');
    Sound.play('correct');
    if (inPlan && before && !before.isDone(before.next) && planStatus().isDone(before.next)) setTimeout(() => toast(`✓ Day ${before.next + 1} of your plan is complete`, 'level'), 700);
    checkPlanComplete();
    window.Core.checkBadges();
  }
  const isRead = (b, c) => !!state.readLog[chKey(b, c)];

  /* The next chapter in the plan after this one (for the reader's "Next in plan" button). */
  function nextInPlan(b, c) {
    const st = planStatus();
    if (!st) return null;
    const day = st.days[st.next];
    const left = day.filter(([pb, pc]) => !st.p.read[chKey(pb, pc)] && !(pb === b && pc === c));
    return left.length ? left[0] : null;
  }

  function plansHTML() {
    const st = planStatus();
    let html = '';
    if (st) {
      const day = st.days[st.next];
      html += `
        <section class="plan-now">
          <div class="plan-head">
            <div><div class="eyebrow">${st.def.icon} ${esc(st.def.name)}</div>
            <h2>Day ${st.next + 1} <span class="muted">of ${st.days.length}</span></h2></div>
            <div class="plan-pct"><b>${Math.round(st.doneDays / st.days.length * 100)}%</b><small>${st.doneDays} of ${st.days.length} days</small></div>
          </div>
          <div class="track-bar"><i style="width:${st.doneDays / st.days.length * 100}%"></i></div>
          ${st.behind > 1 ? `<div class="gentle">🌿 You are ${st.behind} days behind, and that is all right. God is not counting. Keep reading at your own pace, or <button class="link-btn" id="planCatch">move the plan so today is day ${st.next + 1}</button>.</div>` : ''}
          <div class="ch-list">${day.map(([b, c]) => `<div class="ch-item ${st.p.read[chKey(b, c)] ? 'done' : ''}">
            <button class="ch-open" data-b="${b}" data-c="${c}">${st.p.read[chKey(b, c)] ? '✓' : '📖'} ${esc(chName(b, c))}</button>
            <button class="ch-tick" data-b="${b}" data-c="${c}" title="Mark as read" aria-label="Mark ${esc(chName(b, c))} as read">${st.p.read[chKey(b, c)] ? '✓' : '○'}</button></div>`).join('')}</div>
          <p class="muted small">Tap a chapter to read it. At the end of the chapter, tap <b>✓ I've read this chapter</b>.</p>
          <details class="plan-all"><summary>See all ${st.days.length} days</summary><div class="plan-days" id="planDays"></div></details>
          <div class="row end"><button class="btn ghost small danger" id="planStop">Stop this plan</button></div>
        </section>`;
    }
    html += `<h2 class="section-title">${st ? 'Other plans' : 'Choose a reading plan'}</h2>
      <div class="plan-grid">${window.PLANS.filter(p => !st || p.id !== st.p.id).map(p => {
        const done = state.plansDone.filter(x => x.id === p.id).length;
        return `<button class="plan-card" data-plan="${p.id}"><span class="pc-ic">${p.icon}</span><b>${esc(p.name)}</b><small>${p.days} days${done ? ` · ✓ finished ${done > 1 ? done + ' times' : ''}` : ''}</small><p>${esc(p.desc)}</p></button>`;
      }).join('')}</div>`;
    return html;
  }

  function bindPlans(host) {
    host.querySelectorAll('.ch-open').forEach(b => b.addEventListener('click', () => window.Reader.open(+b.dataset.b, +b.dataset.c)));
    host.querySelectorAll('.ch-tick').forEach(b => b.addEventListener('click', () => {
      const bb = +b.dataset.b, cc = +b.dataset.c;
      if (state.plan.read[chKey(bb, cc)]) { delete state.plan.read[chKey(bb, cc)]; save(); } else markRead(bb, cc);
      render();
    }));
    const catchUp = host.querySelector('#planCatch');
    if (catchUp) catchUp.addEventListener('click', () => {
      const st = planStatus();
      state.plan.start = addDays(todayKey(), -st.next); save();
      toast('🌿 Plan moved. Today is a fresh start.');
      render();
    });
    const stop = host.querySelector('#planStop');
    if (stop) stop.addEventListener('click', async () => {
      if (!(await UI().ask('Stop this reading plan? Your read chapters stay in your history.', 'Stop plan'))) return;
      state.plan = null; save(); render();
    });
    const all = host.querySelector('.plan-all');
    if (all) all.addEventListener('toggle', () => {
      if (!all.open) return;
      const st = planStatus();
      host.querySelector('#planDays').innerHTML = st.days.map((d, i) => `<div class="pd ${st.isDone(i) ? 'done' : ''} ${i === st.next ? 'now' : ''}"><b>Day ${i + 1}</b><span>${d.map(([b, c]) => esc(chName(b, c))).join(', ')}</span></div>`).join('');
    });
    host.querySelectorAll('[data-plan]').forEach(b => b.addEventListener('click', async () => {
      if (state.plan && !(await UI().ask(`Switch to "${planDef(b.dataset.plan).name}"? Your current plan's progress will be cleared.`, 'Switch plan'))) return;
      startPlan(b.dataset.plan); render();
    }));
  }

  /* ================= A word for how I feel ================= */
  function feelingsHTML(sel) {
    const f = window.FEELINGS.find(x => x.id === sel);
    const chips = `<div class="feel-grid">${window.FEELINGS.map(x => `<button class="feel ${x.id === sel ? 'active' : ''}" data-feel="${x.id}"><span>${x.icon}</span>${esc(x.name)}</button>`).join('')}</div>`;
    if (!f) return `<p class="muted">Choose what is closest to how you feel. God's Word speaks to every season of the heart.</p>${chips}`;
    return `${chips}
      <section class="feel-word">
        <div class="eyebrow">${f.icon} When you feel ${esc(f.name.toLowerCase())}</div>
        ${f.refs.map(r => vref(r)).join('')}
        <div class="reflect"><div class="reflect-label">Pray</div><p>${esc(f.prayer)}</p></div>
        <div class="row gap wrap"><button class="btn primary" id="feelPrayed">🙏 Amen, I prayed</button><button class="btn ghost" id="feelLead">🕊️ Write what's on my heart</button></div>
      </section>`;
  }
  function bindFeelings(host, sel) {
    host.querySelectorAll('[data-feel]').forEach(b => b.addEventListener('click', () => { Sound.play('tap'); section = 'feel'; arg = b.dataset.feel; render(); setTimeout(() => { const w = $('.feel-word'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }));
    fillRefs(host);
    const p = host.querySelector('#feelPrayed');
    if (p) p.addEventListener('click', () => {
      const first = !window.Core.today().prayer;
      window.Core.markDaily('prayer');
      if (first) window.Core.addXP(10, 'Prayed');
      Sound.play('correct'); toast('🙏 Amen. He hears you.');
    });
    const l = host.querySelector('#feelLead');
    if (l) l.addEventListener('click', () => UI().openPrayerTab('led'));
  }

  /* ================= Scripture memory (spaced repetition) ================= */
  const INTERVALS = [1, 3, 7, 14, 30, 60, 120];   // days until the next review after each success
  const due = () => (state.memory || []).filter(m => m.due <= todayKey());

  async function addMemory(ref) {
    let r;
    try { r = await B().lookup(ref); } catch (e) { toast(e.message); return false; }
    if (r.verses.length > 6) { toast('Choose up to 6 verses to memorize at a time'); return false; }
    if (state.memory.some(m => m.ref === r.ref)) { toast(`🧠 ${r.ref} is already in your memory verses`); return false; }
    state.memory.push({ id: uid('mv'), ref: r.ref, added: Date.now(), level: 0, due: todayKey(), reviews: 0, lastReview: 0 });
    save(); Sound.play('correct');
    toast(`🧠 Added ${r.ref} to memory verses`);
    return true;
  }

  const firstLetters = t => t.replace(/LORD/g, 'Lord').split(/\s+/).map(w => w.replace(/^([^A-Za-z]*[A-Za-z])[A-Za-z’']*/, '$1')).join(' ');

  function memoryHTML() {
    const list = state.memory.slice().sort((a, b) => a.due.localeCompare(b.due));
    const d = due().length;
    return `
      <section class="mem-top">
        <div><h2>${d ? `${d} verse${d === 1 ? '' : 's'} to review today` : 'All caught up ✓'}</h2>
        <p class="muted small">Review a verse when it is due. Each time you remember it, the next review waits longer: 1, 3, 7, 14, 30 days and more. This is how verses move into long-term memory.</p></div>
        ${d ? '<button class="btn primary" id="memReview">🧠 Review now</button>' : ''}
      </section>
      <div class="add-row"><input class="search" id="memRef" placeholder="Add a verse, e.g. Psalm 119:11"><button class="btn primary" id="memAdd">Add</button></div>
      ${list.length ? `<div class="mem-list">${list.map(m => `<div class="mem-item">
        <div class="mem-main"><b>${esc(m.ref)}</b>
          <span class="lvl-dots" title="Strength ${m.level} of 7">${Array.from({ length: 7 }, (_, i) => `<i class="${i < m.level ? 'on' : ''}"></i>`).join('')}</span>
          <small class="muted">${m.level >= 5 ? '💗 Hidden in your heart · ' : ''}${m.due <= todayKey() ? '<b class="due">Due now</b>' : 'Next review ' + fmtDate(m.due, { day: 'numeric', month: 'short' })}</small></div>
        <div class="mem-acts"><button class="mini" data-mem="practice" data-id="${m.id}" title="Practise">▶</button><button class="mini" data-mem="del" data-id="${m.id}" title="Remove">✕</button></div>
      </div>`).join('')}</div>` : `<div class="empty-state small-empty"><p class="muted">No memory verses yet. Add one above, or in the Bible tap a verse and choose 🧠 Memorize.</p>
        <div class="chips">${['Psalm 119:11', 'John 3:16', 'Proverbs 3:5-6', 'Philippians 4:13', 'Joshua 1:9', 'Romans 8:28'].map(r => `<button class="chip ref" data-sugg="${r}">＋ ${r}</button>`).join('')}</div></div>`}`;
  }

  function bindMemory(host) {
    const add = async () => { const v = host.querySelector('#memRef').value.trim(); if (v && await addMemory(v)) render(); };
    host.querySelector('#memAdd').addEventListener('click', add);
    host.querySelector('#memRef').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    host.querySelectorAll('[data-sugg]').forEach(b => b.addEventListener('click', async () => { if (await addMemory(b.dataset.sugg)) render(); }));
    const rv = host.querySelector('#memReview');
    if (rv) rv.addEventListener('click', () => review(due().map(m => m.id)));
    host.querySelectorAll('[data-mem]').forEach(b => b.addEventListener('click', async () => {
      const m = state.memory.find(x => x.id === b.dataset.id);
      if (b.dataset.mem === 'practice') review([m.id], true);
      if (b.dataset.mem === 'del' && await UI().ask(`Remove ${m.ref} from your memory verses?`, 'Remove')) { state.memory = state.memory.filter(x => x !== m); save(); render(); }
    }));
  }

  /* Review session: see the reference, recall the verse, then check yourself. */
  async function review(ids, practice) {
    const queue = ids.slice();
    let n = 0, remembered = 0;
    const next = async () => {
      if (!queue.length) {
        Sound.play('complete');
        $('#modalBody').innerHTML = `<div class="result"><div class="big-emoji">💗</div><h2>${practice ? 'Practice done' : 'Review complete'}</h2>
          <p class="lead">${remembered} of ${n} remembered.</p>${vref('Psalm 119:11', true)}
          <div class="row center"><button class="btn primary" data-close>Done</button></div></div>`;
        fillRefs($('#modalBody'));
        UI().onModalClose(() => { if (UI().current() === 'grow') render(); if (UI().current() === 'daily') UI().refresh(); });
        return;
      }
      const id = queue.shift();
      const m = state.memory.find(x => x.id === id);
      if (!m) return next();
      n++;
      let r;
      try { r = await B().lookup(m.ref); } catch (e) { return next(); }
      const text = r.verses.map(v => v[1]).join(' ');
      const html = `<div class="mem-card">
        <div class="eyebrow">🧠 Memory verse ${n} of ${n + queue.length}</div>
        <h2 class="mem-ref">${esc(m.ref)}</h2>
        <p class="muted">Say the verse aloud or in your heart, then check yourself.</p>
        <div class="mem-hint hidden" id="memHint">${esc(firstLetters(text))}</div>
        <blockquote class="scripture hidden" id="memText">${lordHTML(text)}</blockquote>
        <div class="row center gap wrap" id="memStep1"><button class="btn ghost" id="memShowHint">💡 First letters</button><button class="btn primary" id="memShow">Show the verse</button></div>
        <div class="row center gap wrap hidden" id="memStep2"><button class="btn ghost" id="memAgain">Still learning</button><button class="btn primary" id="memGot">✓ I remembered it</button></div>
      </div>`;
      if (document.querySelector('#modal.open .mem-card, #modal.open .result')) $('#modalBody').innerHTML = html; else UI().openModal(html, { cls: 'parchment' });
      $('#memShowHint').addEventListener('click', () => $('#memHint').classList.remove('hidden'));
      $('#memShow').addEventListener('click', () => {
        $('#memText').classList.remove('hidden'); $('#memStep1').classList.add('hidden'); $('#memStep2').classList.remove('hidden');
        window.Core.Speech.speak(m.ref + '. ' + text);
      });
      const grade = ok => {
        window.Core.Speech.stop();
        if (!practice || m.due <= todayKey()) {
          if (ok) { m.due = addDays(todayKey(), INTERVALS[Math.min(m.level, INTERVALS.length - 1)]); m.level = Math.min(7, m.level + 1); }
          else { m.level = Math.max(0, m.level - 1); m.due = addDays(todayKey(), 1); }
          m.reviews++; m.lastReview = Date.now();
          if (ok && !window.Core.today().memory) window.Core.addXP(10, 'Memory verse');
          window.Core.today().memory = true;
          save(); window.Core.checkBadges();
        }
        if (ok) remembered++;
        Sound.play(ok ? 'correct' : 'tap');
        next();
      };
      $('#memGot').addEventListener('click', () => grade(true));
      $('#memAgain').addEventListener('click', () => grade(false));
    };
    next();
  }

  /* ================= Topical studies ================= */
  function topicsHTML(sel) {
    const t = window.TOPICS.find(x => x.id === sel);
    if (!t) return `<p class="muted">Short guided paths through Scripture. Six passages each, with a note on what each one teaches, and a question to take to God.</p>
      <div class="topic-grid">${window.TOPICS.map(x => {
        const p = state.topics[x.id] || {};
        return `<button class="topic-card ${p.done ? 'done' : ''}" data-topic="${x.id}"><span class="pc-ic">${x.icon}</span><b>${esc(x.name)}</b><small>${esc(x.intro)}</small>
          <span class="topic-prog">${p.done ? '✓ Finished' : p.step ? `Step ${p.step + 1} of ${x.steps.length}` : `${x.steps.length} steps`}</span></button>`;
      }).join('')}</div>`;
    const p = state.topics[t.id] || { step: 0 };
    const i = Math.min(p.step || 0, t.steps.length);
    if (i >= t.steps.length) return `
      <section class="topic-step">
        <div class="eyebrow">${t.icon} ${esc(t.name)} · Reflect</div>
        <h2>${esc(t.question)}</h2>
        <textarea class="notes" id="topicAns" placeholder="Write your answer to God…">${esc(p.answer || '')}</textarea>
        <div class="row gap end wrap"><button class="btn ghost" id="topicBack">← Back</button><button class="btn primary" id="topicFinish">${p.done ? 'Save' : '✓ Finish this study'}</button></div>
      </section>`;
    const [ref, note] = t.steps[i];
    return `
      <section class="topic-step">
        <div class="eyebrow">${t.icon} ${esc(t.name)} · Step ${i + 1} of ${t.steps.length}</div>
        <div class="steps-dots">${t.steps.map((_, k) => `<i class="${k < i ? 'on' : k === i ? 'now' : ''}"></i>`).join('')}<i class="${p.done ? 'on' : ''}"></i></div>
        ${vref(ref)}
        <div class="reflect"><div class="reflect-label">What this teaches</div><p>${esc(note)}</p></div>
        <div class="row gap end wrap">${i ? '<button class="btn ghost" id="topicBack">← Back</button>' : ''}<button class="btn primary" id="topicNext">Next →</button></div>
      </section>`;
  }
  function bindTopics(host, sel) {
    host.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => { arg = b.dataset.topic; render(); }));
    if (!sel) return;
    fillRefs(host);
    const t = window.TOPICS.find(x => x.id === sel);
    const p = state.topics[sel] = state.topics[sel] || { step: 0 };
    const go = d => { p.step = Math.max(0, Math.min(t.steps.length, (p.step || 0) + d)); p.at = Date.now(); save(); Sound.play('tap'); render(); $('#view-grow').scrollTop = 0; };
    const nx = host.querySelector('#topicNext'); if (nx) nx.addEventListener('click', () => go(1));
    const bk = host.querySelector('#topicBack'); if (bk) bk.addEventListener('click', () => go(-1));
    const fin = host.querySelector('#topicFinish');
    if (fin) fin.addEventListener('click', () => {
      const first = !p.done;
      p.answer = host.querySelector('#topicAns').value.trim(); p.done = true; p.at = Date.now(); save();
      if (first) { window.Core.addXP(40, 'Topical study'); Sound.play('complete'); }
      toast(first ? `✓ You finished "${t.name}"` : '✓ Saved');
      window.Core.checkBadges();
      arg = null; render();
    });
  }

  /* ================= S.O.A.P. journal ================= */
  function soapHTML() {
    const list = state.soap.slice().sort((a, b) => b.at - a.at);
    return `
      <p class="muted"><b>S</b>cripture: write down the verse. <b>O</b>bservation: what does it say? <b>A</b>pplication: what does it mean for my life today? <b>P</b>rayer: talk to God about it.</p>
      <div class="row"><button class="btn primary" id="soapNew">✍️ New journal entry</button></div>
      ${list.length ? `<div class="soap-list">${list.map(e => `<details class="soap-item">
        <summary><b>${esc(e.ref || 'Journal')}</b><span class="muted small">${fmtTime(e.at)}</span></summary>
        ${e.ref ? vref(e.ref, true) : ''}
        ${e.observation ? `<h4>👁️ Observation</h4><p>${esc(e.observation)}</p>` : ''}
        ${e.application ? `<h4>🌱 Application</h4><p>${esc(e.application)}</p>` : ''}
        ${e.prayer ? `<h4>🙏 Prayer</h4><p>${esc(e.prayer)}</p>` : ''}
        <div class="row gap"><button class="btn ghost small" data-soap="edit" data-id="${e.id}">Edit</button><button class="btn ghost small danger" data-soap="del" data-id="${e.id}">Delete</button></div>
      </details>`).join('')}</div>` : '<div class="empty-state small-empty"><p class="muted">No entries yet. In the Bible, tap a verse and choose ✍️ Journal, or start one here.</p></div>'}`;
  }
  function bindSoap(host) {
    host.querySelector('#soapNew').addEventListener('click', () => soapEditor());
    host.querySelectorAll('.soap-item').forEach(d => d.addEventListener('toggle', () => { if (d.open) fillRefs(d); }));
    host.querySelectorAll('[data-soap]').forEach(b => b.addEventListener('click', async () => {
      const e = state.soap.find(x => x.id === b.dataset.id);
      if (b.dataset.soap === 'edit') soapEditor(e);
      if (b.dataset.soap === 'del' && await UI().ask('Delete this journal entry?', 'Delete')) { state.soap = state.soap.filter(x => x !== e); save(); render(); }
    }));
  }

  function soapEditor(entry, ref) {
    const e = entry || { ref: ref || '', observation: '', application: '', prayer: '' };
    UI().openModal(`
      <div class="pform soap-form">
        <div class="eyebrow">S.O.A.P. journal</div>
        <h2>${entry ? 'Edit entry' : 'Time with God'}</h2>
        <label class="flabel" for="soS">📜 Scripture</label>
        <input class="search" id="soS" placeholder="e.g. James 1:22" value="${esc(e.ref)}">
        <div id="soPrev"></div>
        <label class="flabel" for="soO">👁️ Observation: what does it say?</label>
        <textarea class="notes" id="soO" placeholder="Who is speaking? What is happening? What stands out?">${esc(e.observation)}</textarea>
        <label class="flabel" for="soA">🌱 Application: what will I do?</label>
        <textarea class="notes" id="soA" placeholder="How does this change today? What should I believe, stop or start?">${esc(e.application)}</textarea>
        <label class="flabel" for="soP">🙏 Prayer</label>
        <textarea class="notes" id="soP" placeholder="Lord, …">${esc(e.prayer)}</textarea>
        <div class="row end gap"><button class="btn primary" id="soSave">Save entry</button></div>
      </div>`, { cls: 'parchment' });
    const prev = () => {
      const v = $('#soS').value.trim();
      $('#soPrev').innerHTML = v && B().parse(v) ? vref(v, true) : '';
      fillRefs($('#soPrev'));
    };
    let t; $('#soS').addEventListener('input', () => { clearTimeout(t); t = setTimeout(prev, 500); });
    prev();
    $('#soSave').addEventListener('click', async () => {
      const raw = $('#soS').value.trim();
      let refNorm = raw;
      if (raw) { try { refNorm = (await B().lookup(raw)).ref; } catch (err) { toast(err.message); return; } }
      const data = { ref: refNorm, observation: $('#soO').value.trim(), application: $('#soA').value.trim(), prayer: $('#soP').value.trim() };
      if (!data.ref && !data.observation && !data.application && !data.prayer) { toast('Write something first'); return; }
      if (entry) Object.assign(entry, data);
      else {
        state.soap.push(Object.assign({ id: uid('s'), at: Date.now() }, data));
        if (!window.Core.today().soap) window.Core.addXP(20, 'Journal');
        window.Core.today().soap = true;
      }
      save(); window.Core.checkBadges(); Sound.play('correct');
      UI().closeModal(); toast('✍️ Journal saved');
      if (UI().current() === 'grow') { section = 'soap'; render(); }
    });
  }

  /* ================= Evening reflection ================= */
  function eveningHTML() {
    const r = state.reflections[todayKey()] || { grateful: ['', '', ''], saw: '', sorry: '', tomorrow: '' };
    const past = Object.entries(state.reflections).filter(([k]) => k !== todayKey()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
    return `
      <section class="evening">
        <div class="eyebrow">🌙 ${fmtDate(todayKey(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h2>Look back over today with God</h2>
        <label class="flabel">Three things I am thankful for</label>
        ${[0, 1, 2].map(i => `<input class="search grat" data-i="${i}" maxlength="140" placeholder="${['Thank You, Lord, for…', 'And for…', 'And for…'][i]}" value="${esc(r.grateful[i] || '')}">`).join('')}
        <label class="flabel" for="evSaw">Where did I see God at work today?</label>
        <textarea class="notes" id="evSaw">${esc(r.saw)}</textarea>
        <label class="flabel" for="evSorry">Anything to confess or let go of?</label>
        <textarea class="notes" id="evSorry" placeholder="1 John 1:9: He is faithful and just to forgive.">${esc(r.sorry)}</textarea>
        <label class="flabel" for="evTom">Tomorrow, with God's help, I will…</label>
        <input class="search" id="evTom" maxlength="160" value="${esc(r.tomorrow)}">
        <div class="row end"><button class="btn primary" id="evSave">${state.reflections[todayKey()] ? 'Update' : 'Save and rest'} 🌙</button></div>
      </section>
      ${past.length ? `<h2 class="section-title">Past evenings</h2><div class="soap-list">${past.map(([k, x]) => `<details class="soap-item"><summary><b>${fmtDate(k, { weekday: 'short', day: 'numeric', month: 'short' })}</b><span class="muted small">${esc((x.grateful || []).filter(Boolean).join(' · ').slice(0, 60))}</span></summary>
        ${(x.grateful || []).filter(Boolean).length ? `<h4>🙏 Thankful for</h4><ul>${x.grateful.filter(Boolean).map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${x.saw ? `<h4>✨ Saw God at work</h4><p>${esc(x.saw)}</p>` : ''}${x.tomorrow ? `<h4>🌅 Tomorrow</h4><p>${esc(x.tomorrow)}</p>` : ''}</details>`).join('')}</div>` : ''}`;
  }
  function bindEvening(host) {
    host.querySelector('#evSave').addEventListener('click', () => {
      const first = !state.reflections[todayKey()];
      state.reflections[todayKey()] = {
        grateful: Array.from(host.querySelectorAll('.grat')).map(x => x.value.trim()),
        saw: host.querySelector('#evSaw').value.trim(), sorry: host.querySelector('#evSorry').value.trim(),
        tomorrow: host.querySelector('#evTom').value.trim(), at: Date.now()
      };
      save();
      if (first) window.Core.addXP(15, 'Evening reflection');
      window.Core.checkBadges();
      Sound.play('bell');
      UI().openModal(`<div class="result"><div class="big-emoji">🌙</div><h2>Rest well${window.Personal.name() ? ', ' + esc(window.Personal.name()) : ''}</h2>${vref('Psalm 4:8', true)}
        <div class="row center"><button class="btn primary" data-close>Good night</button></div></div>`, { cls: 'parchment' });
      fillRefs($('#modalBody'));
      render();
    });
  }

  /* ================= Sermon notes ================= */
  const REF_RX = /\b((?:[1-3]\s?)?[A-Z][a-z]{1,15}(?:\s+of\s+[A-Z][a-z]+)?)\.?\s+(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?\b/g;
  function linkRefs(text) {
    return esc(text).replace(REF_RX, (m) => {
      const r = B().parse(m.replace(/\.(?=\s)/, ''));
      if (!r) return m;
      return `<button class="ref-link" data-ref="${esc(B().refString(r.b, r.c, r.v1, r.v2))}">${m}</button>`;
    });
  }
  function sermonsHTML() {
    const list = state.sermons.slice().sort((a, b) => b.at - a.at);
    return `
      <p class="muted">Take notes at church or while listening to a message. Bible references you type (like <b>Romans 8:28</b> or <b>Ps 23</b>) become links you can tap.</p>
      <div class="row"><button class="btn primary" id="serNew">🎤 New sermon notes</button></div>
      ${list.length ? `<div class="soap-list">${list.map(s => `<details class="soap-item">
        <summary><b>${esc(s.title || 'Sermon')}</b><span class="muted small">${s.preacher ? esc(s.preacher) + ' · ' : ''}${fmtTime(s.at)}</span></summary>
        <div class="sermon-notes">${linkRefs(s.notes || '')}</div>
        <div class="row gap"><button class="btn ghost small" data-ser="edit" data-id="${s.id}">Edit</button><button class="btn ghost small danger" data-ser="del" data-id="${s.id}">Delete</button></div>
      </details>`).join('')}</div>` : '<div class="empty-state small-empty"><p class="muted">No sermon notes yet.</p></div>'}`;
  }
  function bindRefLinks(host) {
    host.querySelectorAll('.ref-link').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      UI().openModal(`<div class="note-modal"><div class="eyebrow">Scripture</div>${vref(b.dataset.ref)}</div>`, { cls: 'parchment' });
      fillRefs($('#modalBody'));
    }));
  }
  function bindSermons(host) {
    host.querySelector('#serNew').addEventListener('click', () => sermonEditor());
    bindRefLinks(host);
    host.querySelectorAll('[data-ser]').forEach(b => b.addEventListener('click', async () => {
      const s = state.sermons.find(x => x.id === b.dataset.id);
      if (b.dataset.ser === 'edit') sermonEditor(s);
      if (b.dataset.ser === 'del' && await UI().ask('Delete these sermon notes?', 'Delete')) { state.sermons = state.sermons.filter(x => x !== s); save(); render(); }
    }));
  }
  function sermonEditor(s) {
    const e = s || { title: '', preacher: '', notes: '' };
    UI().openModal(`
      <div class="pform">
        <div class="eyebrow">🎤 Sermon notes</div>
        <label class="flabel" for="seT">Title or theme</label>
        <input class="search" id="seT" maxlength="100" value="${esc(e.title)}" placeholder="e.g. Walking by faith">
        <label class="flabel" for="seP">Preacher or church <span class="muted">(optional)</span></label>
        <input class="search" id="seP" maxlength="80" value="${esc(e.preacher)}">
        <label class="flabel" for="seN">Notes</label>
        <textarea class="notes tall" id="seN" placeholder="Main points, scriptures (e.g. Hebrews 11:6), what God is saying to me…">${esc(e.notes)}</textarea>
        <div class="muted small" id="seRefs"></div>
        <div class="row end"><button class="btn primary" id="seSave">Save notes</button></div>
      </div>`);
    const showRefs = () => {
      const found = [];
      ($('#seN').value.match(REF_RX) || []).forEach(m => { const r = B().parse(m.replace(/\.(?=\s)/, '')); if (r) { const k = B().refString(r.b, r.c, r.v1, r.v2); if (!found.includes(k)) found.push(k); } });
      $('#seRefs').innerHTML = found.length ? `Scriptures found: ${found.map(f => `<button class="ref-link" data-ref="${esc(f)}">${esc(f)}</button>`).join(' ')}` : '';
    };
    let t; $('#seN').addEventListener('input', () => { clearTimeout(t); t = setTimeout(showRefs, 400); });
    showRefs();
    $('#seSave').addEventListener('click', () => {
      const data = { title: $('#seT').value.trim(), preacher: $('#seP').value.trim(), notes: $('#seN').value };
      if (!data.title && !data.notes.trim()) { toast('Write something first'); return; }
      if (s) Object.assign(s, data); else { state.sermons.push(Object.assign({ id: uid('se'), at: Date.now() }, data)); window.Core.addXP(10, 'Sermon notes'); }
      save(); Sound.play('correct'); UI().closeModal(); toast('🎤 Notes saved');
      if (UI().current() === 'grow') { section = 'sermons'; render(); }
    });
  }

  /* ================= Ebenezer: my faith story ================= */
  function timelineItems() {
    const items = state.milestones.map(m => ({ kind: m.kind || 'milestone', date: m.date, title: m.title, story: m.story, ref: m.ref, id: m.id }));
    state.requests.filter(r => r.status === 'answered').forEach(r => items.push({ kind: 'answered', date: window.Core.dateKey(new Date(r.answeredAt || r.created)), title: r.title, story: r.answeredHow, id: r.id }));
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }
  const KIND_IC = { milestone: '🪨', answered: '🙌', fast: '🍞', plan: '🗓️' };
  function ebenezerHTML() {
    const items = timelineItems();
    let year = null;
    return `
      ${vref('1 Samuel 7:12', true)}
      <p class="muted">Samuel set up a stone and called it Ebenezer, "the stone of help". Record the moments God has helped you: when you came to faith, your baptism, healings, provision, answered prayers. On hard days, read them again.</p>
      <div class="row"><button class="btn primary" id="ebNew">🪨 Add a milestone</button></div>
      ${items.length ? `<div class="timeline">${items.map(it => {
        const y = it.date.slice(0, 4);
        const head = y !== year ? `<div class="tl-year">${y}</div>` : '';
        year = y;
        return `${head}<div class="tl-item ${it.kind}"><span class="tl-dot">${KIND_IC[it.kind] || '🪨'}</span><div class="tl-body">
          <small class="muted">${fmtDate(it.date, { day: 'numeric', month: 'long' })}${it.kind === 'answered' ? ' · answered prayer' : ''}</small>
          <b>${esc(it.title)}</b>${it.story ? `<p>${esc(it.story)}</p>` : ''}${it.ref ? `<button class="ref-link" data-ref="${esc(it.ref)}">${esc(it.ref)}</button>` : ''}
          ${it.kind === 'answered' ? `<button class="mini" data-eb="card" data-id="${it.id}" title="Testimony card">🖼️</button>` : `<button class="mini" data-eb="del" data-id="${it.id}" title="Remove">✕</button>`}
        </div></div>`;
      }).join('')}</div>` : '<div class="empty-state small-empty"><p class="muted">Your timeline is empty. Add the day you gave your life to Christ, or something God has done for you.</p></div>'}`;
  }
  function bindEbenezer(host) {
    fillRefs(host);
    bindRefLinks(host);
    host.querySelector('#ebNew').addEventListener('click', () => milestoneEditor());
    host.querySelectorAll('[data-eb]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.eb === 'card') { const r = state.requests.find(x => x.id === b.dataset.id); if (r) window.Cards.testimony(r); return; }
      if (await UI().ask('Remove this milestone?', 'Remove')) { state.milestones = state.milestones.filter(m => m.id !== b.dataset.id); save(); render(); }
    }));
  }
  function milestoneEditor() {
    UI().openModal(`
      <div class="pform">
        <div class="eyebrow">🪨 Ebenezer</div>
        <h2>"Hitherto hath the Lord helped us"</h2>
        <label class="flabel" for="msD">When?</label>
        <input class="search" type="date" id="msD" value="${todayKey()}" max="${todayKey()}">
        <label class="flabel" for="msT">What did God do?</label>
        <input class="search" id="msT" maxlength="120" placeholder="e.g. I gave my life to Jesus · I was baptized · He healed my son">
        <div class="chips">${['I gave my life to Jesus', 'I was baptized', 'God healed me', 'God provided', 'God protected me', 'A new beginning'].map(x => `<button class="chip" data-ms="${x}">${x}</button>`).join('')}</div>
        <label class="flabel" for="msS">The story <span class="muted">(optional)</span></label>
        <textarea class="notes" id="msS" placeholder="What happened? How did you see God's hand?"></textarea>
        <label class="flabel" for="msR">A scripture for this moment <span class="muted">(optional)</span></label>
        <input class="search" id="msR" placeholder="e.g. Psalm 40:2">
        <div class="row end"><button class="btn primary" id="msSave">Set up this stone</button></div>
      </div>`);
    document.querySelectorAll('[data-ms]').forEach(c => c.addEventListener('click', () => { $('#msT').value = c.dataset.ms; }));
    $('#msSave').addEventListener('click', async () => {
      const title = $('#msT').value.trim();
      if (!title) { toast('Write what God did'); return; }
      let ref = $('#msR').value.trim();
      if (ref) { try { ref = (await B().lookup(ref)).ref; } catch (e) { toast(e.message); return; } }
      const date = $('#msD').value || todayKey();
      state.milestones.push({ id: uid('m'), date: date > todayKey() ? todayKey() : date, title, story: $('#msS').value.trim(), ref, kind: 'milestone' });
      save(); window.Core.addXP(10, 'Ebenezer'); window.Core.checkBadges(); Sound.play('badge');
      UI().closeModal(); toast('🪨 Added to your timeline');
      if (UI().current() === 'grow') { section = 'ebenezer'; render(); }
    });
  }
  /* Milestones and answered prayers that happened on this day in an earlier year. */
  function anniversaries() {
    const t = todayKey(), md = t.slice(5);
    return timelineItems().filter(it => it.date.slice(5) === md && it.date < t.slice(0, 4)).map(it => Object.assign({ years: +t.slice(0, 4) - +it.date.slice(0, 4) }, it));
  }

  /* ================= My week with God ================= */
  function weekStats() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i - 6));
    const from = keyDate(days[0]).getTime();
    const inWeek = t => t >= from;
    const daily = k => state.daily[k] || {};
    return {
      days,
      active: days.map(k => Object.keys(daily(k)).length > 0),
      chapters: days.reduce((a, k) => a + (state.readHist[k] || 0), 0),
      prayed: days.filter(k => daily(k).prayer).length,
      memory: state.memory.filter(m => m.lastReview && inWeek(m.lastReview)).length,
      journal: state.soap.filter(e => inWeek(e.at)).length,
      reflections: days.filter(k => state.reflections[k]).length,
      highlights: Object.values(state.highlights).filter(h => h.at && inWeek(h.at)).length,
      answered: state.requests.filter(r => r.status === 'answered' && inWeek(r.answeredAt || 0)).length,
      sermons: state.sermons.filter(s => inWeek(s.at)).length
    };
  }
  function weekHTML() {
    const w = weekStats();
    const activeDays = w.active.filter(Boolean).length;
    const msg = activeDays >= 6 ? 'What a faithful week. Like a tree planted by the rivers of water, you are being rooted in Him.'
      : activeDays >= 3 ? 'Step by step, day by day. God is growing something in you, even when you cannot see it.'
        : activeDays >= 1 ? 'Every moment you gave to God this week mattered. Tomorrow is a fresh page.'
          : 'This week was quiet, and that is all right. His mercies are new every morning. Begin again today with one chapter.';
    const ref = activeDays >= 6 ? 'Psalm 1:3' : activeDays >= 3 ? 'Philippians 1:6' : activeDays >= 1 ? 'Galatians 6:9' : 'Lamentations 3:22-23';
    const stat = (n, label, ic) => `<div class="wk-stat"><span>${ic}</span><b>${n}</b><small>${label}</small></div>`;
    return `
      <section class="week">
        <div class="eyebrow">${fmtDate(w.days[0], { day: 'numeric', month: 'short' })} to ${fmtDate(w.days[6], { day: 'numeric', month: 'short' })}</div>
        <h2>${window.Personal.name() ? esc(window.Personal.name()) + ', your' : 'Your'} week with God</h2>
        <div class="wk-days">${w.days.map((k, i) => `<div class="wk-day ${w.active[i] ? 'on' : ''}"><i></i><small>${keyDate(k).toLocaleDateString(undefined, { weekday: 'narrow' })}</small></div>`).join('')}</div>
        <div class="wk-grid">
          ${stat(w.chapters, 'chapters read', '📖')}${stat(w.prayed, 'days of prayer', '🙏')}${stat(w.memory, 'verses reviewed', '🧠')}
          ${stat(w.journal, 'journal entries', '✍️')}${stat(w.reflections, 'evening reflections', '🌙')}${stat(w.highlights, 'verses highlighted', '🖍️')}
          ${w.answered ? stat(w.answered, 'prayers answered', '🙌') : ''}${w.sermons ? stat(w.sermons, 'sermons noted', '🎤') : ''}
        </div>
        <p class="lead center">${msg}</p>
        ${vref(ref, true)}
      </section>`;
  }

  /* ================= Hub & navigation ================= */
  const SECTIONS = [
    ['plans', '🗓️', 'Reading plans', () => { const st = planStatus(); return st ? `${st.def.name} · day ${st.next + 1}` : 'Bible in a Year, the Gospels and more'; }],
    ['feel', '💛', 'A word for how I feel', () => 'Scripture and a prayer for your heart'],
    ['memory', '🧠', 'Memory verses', () => { const d = due().length; return d ? `${d} to review today` : `${state.memory.length} verse${state.memory.length === 1 ? '' : 's'}`; }],
    ['topics', '🧭', 'Topical studies', () => `${window.TOPICS.length} guided studies`],
    ['soap', '✍️', 'S.O.A.P. journal', () => `${state.soap.length} entr${state.soap.length === 1 ? 'y' : 'ies'}`],
    ['evening', '🌙', 'Evening reflection', () => state.reflections[todayKey()] ? '✓ Done tonight' : 'Gratitude and rest'],
    ['sermons', '🎤', 'Sermon notes', () => `${state.sermons.length} saved`],
    ['ebenezer', '🪨', 'My faith story', () => `${timelineItems().length} milestones`],
    ['week', '📊', 'My week with God', () => 'Your last seven days'],
    ['dict', '🔤', 'Hebrew & Greek dictionary', () => 'Every word of the original Bible, explained'],
    ['passages', '📖', 'Study passages & quizzes', () => `${Object.keys(state.completed).length} of ${window.JOURNEY.length} completed`],
    ['books', '📚', 'Books of the Bible', () => 'All 66, with summaries']
  ];
  let section = null, arg = null;

  function render() {
    const page = $('#growPage');
    if (!page) return;
    const s = SECTIONS.find(x => x[0] === section);
    if (!s) {
      section = null;
      page.innerHTML = `
        <section class="hero slim"><div><div class="eyebrow">Grow</div><h1>Go deeper in the Word</h1>
          <p class="muted">"But grow in grace, and in the knowledge of our Lord and Saviour Jesus Christ." (2 Peter 3:18)</p></div></section>
        <div class="grow-grid">${SECTIONS.map(([k, ic, name, sub]) => `<button class="grow-tile" data-sec="${k}"><span class="gt-ic">${ic}</span><span class="gt-t"><b>${name}</b><small>${esc(sub())}</small></span>${k === 'memory' && due().length ? `<span class="count">${due().length}</span>` : ''}</button>`).join('')}</div>`;
      page.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => { Sound.play('tap'); open(b.dataset.sec); }));
      return;
    }
    const back = arg && (section === 'topics') ? '← Topics' : '← Grow';
    page.innerHTML = `
      <div class="grow-head"><button class="btn ghost small" id="growBack">${back}</button><h1>${s[1]} ${s[2]}</h1></div>
      <div id="growBody"></div>`;
    $('#growBack').addEventListener('click', () => { if (arg && section === 'topics') arg = null; else { section = null; arg = null; } render(); $('#view-grow').scrollTop = 0; });
    const body = $('#growBody');
    switch (section) {
      case 'plans': body.innerHTML = plansHTML(); bindPlans(body); break;
      case 'feel': body.innerHTML = feelingsHTML(arg); bindFeelings(body, arg); break;
      case 'memory': body.innerHTML = memoryHTML(); bindMemory(body); break;
      case 'topics': body.innerHTML = topicsHTML(arg); bindTopics(body, arg); break;
      case 'soap': body.innerHTML = soapHTML(); bindSoap(body); break;
      case 'evening': body.innerHTML = eveningHTML(); bindEvening(body); break;
      case 'sermons': body.innerHTML = sermonsHTML(); bindSermons(body); break;
      case 'ebenezer': body.innerHTML = ebenezerHTML(); bindEbenezer(body); break;
      case 'week': body.innerHTML = weekHTML(); fillRefs(body); state.weekSeen = todayKey(); save(); break;
      case 'passages': UI().renderPassages(body); break;
      case 'dict': window.Orig.renderDictionary(body); break;
      case 'books': UI().renderBooks(body); break;
    }
  }

  function open(sec, a) {
    section = sec; arg = a || null;
    if (UI().current() === 'grow') { render(); } else UI().show('grow');
    const v = $('#view-grow'); if (v) v.scrollTop = 0;
  }

  /* ================= Cards on the Daily page ================= */
  function birthdayToday() {
    const b = (state.profile || {}).birthday;
    return !!b && b === todayKey().slice(5);
  }

  function renderDaily(top, host) {
    const t = todayKey();
    const name = window.Personal.name();
    let topHTML = '';
    if (birthdayToday()) topHTML += `<section class="soft-card bday"><div class="big-emoji">🎂</div><div><div class="eyebrow">Happy birthday${name ? ', ' + esc(name) : ''}!</div><h3>A blessing for your new year</h3>${vref('Numbers 6:24-26', true)}</div></section>`;
    const last = state.streak.last;
    if (last && last < addDays(t, -1) && !window.Core.today().verse) {
      const gap = daysBetween(last, t);
      topHTML += `<section class="soft-card comeback"><div class="big-emoji">🌅</div><div><div class="eyebrow">Welcome back${name ? ', ' + esc(name) : ''}</div>
        <h3>${gap > 14 ? 'It has been a while, and He has been waiting for you with open arms.' : 'No guilt, no pressure. Today is a fresh start.'}</h3>${vref('Lamentations 3:22-23', true)}</div></section>`;
    }
    anniversaries().forEach(a => {
      topHTML += `<section class="soft-card anniv"><div class="big-emoji">${KIND_IC[a.kind] || '🪨'}</div><div><div class="eyebrow">${a.years} year${a.years === 1 ? '' : 's'} ago today</div>
        <h3>${esc(a.title)}</h3>${a.story ? `<p class="muted">${esc(a.story)}</p>` : ''}<p class="small">Remember what God has done. "Hitherto hath the Lord helped us." (1 Samuel 7:12)</p></div></section>`;
    });
    top.innerHTML = topHTML;
    fillRefs(top);

    const st = planStatus();
    const d = due().length;
    const hour = new Date().getHours();
    const sunday = new Date().getDay() === 0;
    host.innerHTML = `
      ${st ? `<section class="cta-card plan-cta">
          <div><div class="eyebrow">${st.def.icon} ${esc(st.def.name)} · Day ${st.next + 1}${st.isDone(st.next) ? ' ✓' : ''}</div>
          <h3>${st.days[st.next].map(([b, c]) => `<span class="${st.p.read[chKey(b, c)] ? 'read' : ''}">${esc(chName(b, c))}</span>`).join(', ')}</h3>
          ${st.behind > 1 ? `<small class="muted">🌿 ${st.behind} days behind. Read at your own pace.</small>` : ''}</div>
          <button class="btn primary" id="dPlan">${st.isDone(st.next) ? 'Open plan' : 'Read today →'}</button></section>`
        : `<section class="cta-card plan-cta"><div><div class="eyebrow">🗓️ Reading plan</div><h3>Read through the Bible, one day at a time</h3></div><button class="btn primary" id="dPlanStart">Choose a plan →</button></section>`}
      ${d ? `<section class="cta-card alt"><div><div class="eyebrow">🧠 Scripture memory</div><h3>${d} verse${d === 1 ? '' : 's'} ready to review</h3></div><button class="btn primary" id="dMem">Review →</button></section>` : ''}
      <section class="feel-strip"><div class="eyebrow">💛 How is your heart today?</div>
        <div class="feel-row">${window.FEELINGS.map(f => `<button class="feel" data-dfeel="${f.id}"><span>${f.icon}</span>${esc(f.name)}</button>`).join('')}</div></section>
      ${hour >= 17 && !state.reflections[t] ? `<section class="cta-card night"><div><div class="eyebrow">🌙 Evening reflection</div><h3>Three thanks, one look back, then rest</h3></div><button class="btn ghost" id="dEve">Reflect →</button></section>` : ''}
      ${sunday && state.weekSeen !== t ? `<section class="cta-card alt"><div><div class="eyebrow">📊 Sunday</div><h3>Your week with God</h3></div><button class="btn ghost" id="dWeek">See my week →</button></section>` : ''}`;
    const on = (id, fn) => { const el = host.querySelector(id); if (el) el.addEventListener('click', fn); };
    on('#dPlan', () => {
      const s = planStatus();
      const left = s.days[s.next].find(([b, c]) => !s.p.read[chKey(b, c)]);
      if (left && !s.isDone(s.next)) window.Reader.open(left[0], left[1]); else open('plans');
    });
    on('#dPlanStart', () => open('plans'));
    on('#dMem', () => review(due().map(m => m.id)));
    on('#dEve', () => open('evening'));
    on('#dWeek', () => open('week'));
    host.querySelectorAll('[data-dfeel]').forEach(b => b.addEventListener('click', () => open('feel', b.dataset.dfeel)));
  }

  window.Grow = { home: () => { section = null; arg = null; }, render, open, renderDaily, fillRefs, vref, markRead, isRead, nextInPlan, planStatus, addMemory, soapEditor, review, due, schedule, weekStats, anniversaries, linkRefs, birthdayToday, addDays };
})();
