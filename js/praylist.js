/* "Who I'm praying for" list, prayer reminders (notifications + calendar), and the reminder scheduler. */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const UI = () => window.UI;
  const lordHTML = t => esc(t).replace(/LORD/g, '<span class="sc">Lord</span>');

  const CATEGORIES = [
    ['family', '👨‍👩‍👧', 'Family', '#f2c14e'],
    ['friends', '🤝', 'Friends', '#5fd3a6'],
    ['church', '⛪', 'Church', '#9b8cff'],
    ['work', '💼', 'Work & School', '#6db7ff'],
    ['healing', '🩺', 'Sick & Healing', '#ff8fa3'],
    ['salvation', '✝️', 'Salvation', '#ffb36b'],
    ['leaders', '🏛️', 'Leaders & Nation', '#8fd3ff'],
    ['missions', '🌍', 'Missions', '#7ee08a'],
    ['myself', '🙋', 'Myself', '#e0a3ff'],
    ['other', '🕊️', 'Other', '#cfc6dd']
  ];
  const cat = id => CATEGORIES.find(c => c[0] === id) || CATEGORIES[CATEGORIES.length - 1];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const person = id => state.people.find(p => p.id === id);
  const initials = n => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  function ago(t) {
    if (!t) return 'Not prayed for yet';
    const d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return 'Prayed for today';
    if (d === 1) return 'Prayed for yesterday';
    return `Prayed for ${d} days ago`;
  }

  /* ================= People list ================= */
  let filter = 'all';
  function renderPeople(host) {
    const people = state.people;
    const due = people.slice().sort((a, b) => (a.lastPrayed || 0) - (b.lastPrayed || 0)).slice(0, 3);
    const present = CATEGORIES.filter(c => people.some(p => p.category === c[0]));
    host.innerHTML = `
      <div class="pl-head">
        <div><h2 class="section-title flush">Who I'm praying for</h2>
        <p class="muted small">Keep the people on your heart, what you are asking God for, and the scriptures you are praying over them.</p></div>
        <button class="btn primary" id="addPerson">＋ Add person</button>
      </div>
      ${people.length ? `
        <div class="today-pray">
          <div class="eyebrow">Today, pray for</div>
          <div class="today-list">${due.map(p => `<button class="today-chip" data-pray="${p.id}"><span class="avatar sm" style="--ac:${cat(p.category)[3]}">${esc(initials(p.name))}</span>${esc(p.name)}</button>`).join('')}</div>
        </div>
        <div class="chips filter">${[['all', '', 'All']].concat(present.map(c => [c[0], c[1], c[2]])).map(([k, ic, n]) => `<button class="chip ${filter === k ? 'active' : ''}" data-f="${k}">${ic} ${esc(n)}</button>`).join('')}</div>
        ${CATEGORIES.filter(c => filter === 'all' || filter === c[0]).map(c => {
          const list = people.filter(p => p.category === c[0]);
          if (!list.length) return '';
          return `<h3 class="cat-title">${c[1]} ${esc(c[2])}</h3><div class="people">${list.map(personCard).join('')}</div>`;
        }).join('')}`
      : `<div class="empty-state">
          <div class="big-emoji">🤲</div>
          <h3>Your prayer list is empty</h3>
          <p class="muted">"I exhort therefore, that, first of all, supplications, prayers, intercessions, and giving of thanks, be made for all men" (1 Timothy 2:1)</p>
          <button class="btn primary" id="addFirst">Add the first person</button>
        </div>`}`;
    const add = $('#addPerson'); add && add.addEventListener('click', () => editPerson());
    const af = $('#addFirst'); af && af.addEventListener('click', () => editPerson());
    $$('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; renderPeople(host); }));
    $$('.person-card').forEach(c => c.addEventListener('click', e => { if (e.target.closest('[data-pray]')) return; openPerson(c.dataset.id); }));
    $$('[data-pray]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); prayFor(b.dataset.pray); }));
  }

  function personCard(p) {
    const c = cat(p.category);
    const open = p.reasons.filter(r => !r.answered).length;
    const answered = p.reasons.length - open;
    return `<div class="person-card" data-id="${p.id}" role="button" tabindex="0">
      <span class="avatar" style="--ac:${c[3]}">${esc(initials(p.name))}</span>
      <div class="pc-main">
        <h4>${esc(p.name)}</h4>
        <div class="pc-meta">${open} request${open === 1 ? '' : 's'}${answered ? ` · ${answered} answered 🙌` : ''} · ${p.scriptures.length} scripture${p.scriptures.length === 1 ? '' : 's'}</div>
        <div class="pc-ago">${ago(p.lastPrayed)}</div>
      </div>
      <button class="btn primary small" data-pray="${p.id}">Pray</button>
    </div>`;
  }

  function refreshList() {
    const host = $('#peopleHost');
    if (host) renderPeople(host);
  }

  /* ================= Add / edit person ================= */
  function editPerson(id, preset) {
    const p = id ? person(id) : null;
    UI().openModal(`
      <div class="pform">
        <div class="eyebrow">${p ? 'Edit' : 'Add to my prayer list'}</div>
        <h2>${p ? esc(p.name) : 'Who are you praying for?'}</h2>
        <label class="flabel">Name</label>
        <input class="search" id="pName" maxlength="60" placeholder="e.g. Mum, Pastor James, my neighbour Ada" value="${p ? esc(p.name) : ''}">
        <label class="flabel">Group</label>
        <div class="cat-grid">${CATEGORIES.map(c => `<button class="cat-btn ${(p ? p.category : 'family') === c[0] ? 'active' : ''}" data-c="${c[0]}" style="--ac:${c[3]}">${c[1]}<span>${esc(c[2])}</span></button>`).join('')}</div>
        ${p ? '' : `
        <label class="flabel">What are you praying for? <span class="muted">(optional)</span></label>
        <textarea class="notes small-ta" id="pReason" maxlength="400" placeholder="e.g. Healing after surgery, a new job, to know Jesus…"></textarea>
        <label class="flabel">A scripture to pray over them <span class="muted">(optional)</span></label>
        <input class="search" id="pScripture" placeholder="e.g. Numbers 6:24-26 or Phil 4:19" value="${preset ? esc(preset.ref) : ''}">`}
        <div class="row end gap"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="pSave">${p ? 'Save' : 'Add to list'}</button></div>
      </div>`);
    let category = p ? p.category : 'family';
    $$('.cat-btn').forEach(b => b.addEventListener('click', () => { category = b.dataset.c; $$('.cat-btn').forEach(x => x.classList.toggle('active', x === b)); }));
    setTimeout(() => $('#pName') && $('#pName').focus(), 60);
    $('#pSave').addEventListener('click', async () => {
      const name = $('#pName').value.trim();
      if (!name) { $('#pName').classList.add('shake'); setTimeout(() => $('#pName').classList.remove('shake'), 400); return; }
      if (p) {
        p.name = name; p.category = category; save();
        openPerson(p.id); refreshList(); return;
      }
      const np = { id: uid(), name, category, reasons: [], scriptures: [], notes: '', prayedCount: 0, lastPrayed: 0, created: Date.now() };
      const reason = $('#pReason').value.trim();
      if (reason) np.reasons.push({ id: uid(), text: reason, date: Date.now(), answered: false });
      const sref = $('#pScripture').value.trim();
      if (preset && sref === preset.ref) np.scriptures.push({ id: uid(), ref: preset.ref, text: preset.text });
      else if (sref) {
        try { const r = await window.Bible.lookup(sref); np.scriptures.push({ id: uid(), ref: r.ref, text: r.verses.map(v => v[1]).join(' ') }); }
        catch (e) { toast('Scripture not added: ' + e.message); }
      }
      state.people.push(np); save(); window.Core.checkBadges();
      Sound.play('correct');
      toast(`🤲 ${name} added to your prayer list`);
      openPerson(np.id); refreshList();
    });
  }

  /* ================= Person detail ================= */
  function openPerson(id) {
    const p = person(id);
    if (!p) return;
    const c = cat(p.category);
    const reminders = state.reminders.filter(r => r.personId === p.id);
    const html = `
      <div class="pdetail">
        <div class="pd-head">
          <span class="avatar lg" style="--ac:${c[3]}">${esc(initials(p.name))}</span>
          <div class="pd-title">
            <h2>${esc(p.name)}</h2>
            <div class="muted small">${c[1]} ${esc(c[2])} · ${ago(p.lastPrayed)}${p.prayedCount ? ` · ${p.prayedCount} time${p.prayedCount === 1 ? '' : 's'} in all` : ''}</div>
          </div>
        </div>
        <div class="row gap wrap">
          <button class="btn primary" id="pdPray">🙏 Pray for ${esc(p.name)} now</button>
          <button class="btn ghost" id="pdRemind">🔔 Remind me${reminders.length ? ` (${reminders.length})` : ''}</button>
          <button class="btn ghost small" id="pdEdit">✏️ Edit</button>
          <button class="btn ghost small danger" id="pdDel">Delete</button>
        </div>

        <h3 class="section-title">Prayer requests</h3>
        <div class="reasons">${p.reasons.length ? p.reasons.map(r => `
          <div class="reason ${r.answered ? 'answered' : ''}">
            <p>${esc(r.text)}</p>
            <div class="muted small">Added ${fmtDate(r.date)}${r.answered ? ` · <span class="ans">Answered ${fmtDate(r.answeredAt || r.date)} 🙌</span>` : ''}</div>
            <div class="row gap"><button class="btn ghost small" data-ans="${r.id}">${r.answered ? 'Mark not answered' : '✓ Answered'}</button><button class="btn ghost small danger" data-rdel="${r.id}">Remove</button></div>
          </div>`).join('') : '<p class="muted small">No requests yet. What would you like to ask God for?</p>'}</div>
        <div class="add-row">
          <textarea class="notes small-ta" id="newReason" maxlength="400" placeholder="Add a request, e.g. peace in their marriage"></textarea>
          <button class="btn ghost" id="addReason">＋ Add request</button>
        </div>

        <h3 class="section-title">Scriptures I'm praying over ${esc(p.name)}</h3>
        <div class="pscriptures">${p.scriptures.length ? p.scriptures.map(s => `
          <div class="pscripture">
            <div class="ps-head"><b>${esc(s.ref)}</b><span><button class="link-btn" data-read="${esc(s.ref)}">Open in Bible</button> · <button class="link-btn danger" data-sdel="${s.id}">Remove</button></span></div>
            <p class="scripture">${lordHTML(s.text)}</p>
          </div>`).join('') : '<p class="muted small">No scriptures yet. Add a reference below, or in the Bible tap a verse and choose "🙏 Pray this".</p>'}</div>
        <div class="add-row">
          <div class="search-row"><input class="search" id="newRef" placeholder="Reference, e.g. Isaiah 41:10 or 3 John 2"><button class="btn ghost" id="lookRef">Look up</button></div>
          <div id="refPreview"></div>
        </div>

        <h3 class="section-title">Notes</h3>
        <textarea class="notes" id="pNotes" placeholder="Anything to remember: how they are doing, how God has answered…">${esc(p.notes || '')}</textarea>
        <div class="muted small" id="pSaved">Saved on this device.</div>
      </div>`;
    if (document.querySelector('.pdetail') || document.querySelector('.pform') || document.querySelector('.praying') || document.querySelector('.picker-person')) {
      $('#modalBody').innerHTML = html;
      document.querySelector('.modal-card').scrollTop = 0;
    } else UI().openModal(html);
    UI().onModalClose(refreshList);

    $('#pdPray').addEventListener('click', () => prayFor(p.id));
    $('#pdRemind').addEventListener('click', () => editReminder(null, p.id));
    $('#pdEdit').addEventListener('click', () => editPerson(p.id));
    $('#pdDel').addEventListener('click', () => {
      if (!confirm(`Remove ${p.name} from your prayer list?`)) return;
      state.people = state.people.filter(x => x.id !== p.id);
      state.reminders.forEach(r => { if (r.personId === p.id) r.personId = null; });
      save(); UI().closeModal(); refreshList();
    });
    $('#addReason').addEventListener('click', () => {
      const t = $('#newReason').value.trim(); if (!t) return;
      p.reasons.unshift({ id: uid(), text: t, date: Date.now(), answered: false }); save();
      Sound.play('tap'); openPerson(p.id);
    });
    $$('[data-ans]').forEach(b => b.addEventListener('click', () => {
      const r = p.reasons.find(x => x.id === b.dataset.ans);
      r.answered = !r.answered; r.answeredAt = r.answered ? Date.now() : null; save();
      if (r.answered) { Sound.play('badge'); toast('Praise God for answered prayer! 🙌'); window.Core.checkBadges(); }
      openPerson(p.id);
    }));
    $$('[data-rdel]').forEach(b => b.addEventListener('click', () => { p.reasons = p.reasons.filter(x => x.id !== b.dataset.rdel); save(); openPerson(p.id); }));
    $$('[data-sdel]').forEach(b => b.addEventListener('click', () => { p.scriptures = p.scriptures.filter(x => x.id !== b.dataset.sdel); save(); openPerson(p.id); }));
    $$('[data-read]').forEach(b => b.addEventListener('click', () => { UI().closeModal(); window.Reader.openRef(b.dataset.read); }));

    let found = null;
    const look = async () => {
      const ref = $('#newRef').value.trim(); if (!ref) return;
      $('#refPreview').innerHTML = '<p class="muted small">Looking up…</p>';
      try {
        const r = await window.Bible.lookup(ref);
        found = { ref: r.ref, text: r.verses.map(v => v[1]).join(' ') };
        $('#refPreview').innerHTML = `<div class="pscripture preview"><b>${esc(found.ref)}</b><p class="scripture">${r.verses.map(([n, t]) => `<sup>${n}</sup>${lordHTML(t)}`).join(' ')}</p><button class="btn primary small" id="addRef">＋ Add to ${esc(p.name)}'s scriptures</button></div>`;
        $('#addRef').addEventListener('click', () => { p.scriptures.push(Object.assign({ id: uid() }, found)); save(); Sound.play('correct'); openPerson(p.id); });
      } catch (e) { $('#refPreview').innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
    };
    $('#lookRef').addEventListener('click', look);
    $('#newRef').addEventListener('keydown', e => { if (e.key === 'Enter') look(); });
    let tmr;
    $('#pNotes').addEventListener('input', e => { clearTimeout(tmr); tmr = setTimeout(() => { p.notes = e.target.value; save(); $('#pSaved').textContent = '✓ Saved'; }, 400); });
  }

  /* ================= Pray for a person ================= */
  function prayFor(id) {
    const p = person(id);
    if (!p) return;
    const open = p.reasons.filter(r => !r.answered);
    const html = `
      <div class="praying">
        <div class="eyebrow">Praying for</div>
        <span class="avatar lg center-av" style="--ac:${cat(p.category)[3]}">${esc(initials(p.name))}</span>
        <h2>${esc(p.name)}</h2>
        <p class="lead muted">"Lord, I lift ${esc(p.name)} up to You. You know them, and You love them more than I do."</p>
        ${open.length ? `<h3 class="section-title">Ask</h3><ul class="ask-list">${open.map(r => `<li>${esc(r.text)}</li>`).join('')}</ul>` : ''}
        ${p.scriptures.length ? `<h3 class="section-title">Pray the Word over them</h3>${p.scriptures.map(s => `<blockquote class="scripture">${lordHTML(s.text)}<br><span class="muted small">${esc(s.ref)}</span></blockquote>`).join('')}` : ''}
        ${!open.length && !p.scriptures.length ? '<p class="muted">Tip: add requests and scriptures to make this time more focused.</p>' : ''}
        <h3 class="section-title">Give thanks</h3>
        <p class="muted">Thank God for ${esc(p.name)}, and for every prayer He has already answered.</p>
        <div class="row center gap wrap">
          <button class="btn ghost" id="prListen">🔊 Pray along</button>
          <button class="btn primary" id="prAmen">Amen, I prayed for ${esc(p.name)}</button>
        </div>
      </div>`;
    if (document.querySelector('#modal.open')) { $('#modalBody').innerHTML = html; document.querySelector('.modal-card').scrollTop = 0; }
    else UI().openModal(html, { cls: 'prayer-modal' });
    UI().onModalClose(refreshList);
    Sound.play('bell');
    const spoken = `Lord, I lift ${p.name} up to you. ` + open.map(r => r.text).join('. ') + '. ' + p.scriptures.map(s => s.text).join(' ') + ' Amen.';
    const lb = $('#prListen');
    lb.addEventListener('click', () => {
      if (window.Core.Speech.speaking) { window.Core.Speech.stop(); lb.textContent = '🔊 Pray along'; return; }
      lb.textContent = '⏹ Stop';
      window.Core.Speech.speak(spoken, () => { lb.textContent = '🔊 Pray along'; });
    });
    $('#prAmen').addEventListener('click', () => {
      window.Core.Speech.stop();
      const firstToday = !p.lastPrayed || window.Core.dateKey(new Date(p.lastPrayed)) !== window.Core.dateKey();
      p.prayedCount = (p.prayedCount || 0) + 1;
      p.lastPrayed = Date.now();
      save();
      const firstPrayer = !window.Core.today().prayer;
      window.Core.markDaily('prayer');
      if (firstToday) window.Core.addXP(firstPrayer ? 15 : 5, `Prayed for ${p.name}`);
      Sound.play('complete');
      openPerson(p.id);
    });
  }

  /* Choose (or create) a person to pray a scripture over. Called from the Bible reader. */
  function pickPersonFor(scripture) {
    UI().openModal(`
      <div class="picker-person">
        <div class="eyebrow">Pray this scripture for…</div>
        <blockquote class="scripture">${lordHTML(scripture.text)}<br><span class="muted small">${esc(scripture.ref)}</span></blockquote>
        <div class="people mini">${state.people.map(p => `<button class="person-card" data-id="${p.id}"><span class="avatar" style="--ac:${cat(p.category)[3]}">${esc(initials(p.name))}</span><div class="pc-main"><h4>${esc(p.name)}</h4><div class="pc-meta">${cat(p.category)[1]} ${esc(cat(p.category)[2])}</div></div></button>`).join('')}</div>
        <div class="row center"><button class="btn primary" id="newForScripture">＋ Someone new</button></div>
      </div>`);
    $$('.picker-person .person-card').forEach(c => c.addEventListener('click', () => {
      const p = person(c.dataset.id);
      if (!p.scriptures.some(s => s.ref === scripture.ref)) p.scriptures.push({ id: uid(), ref: scripture.ref, text: scripture.text });
      save(); Sound.play('correct');
      toast(`🙏 ${scripture.ref} added to ${p.name}'s scriptures`);
      UI().closeModal();
    }));
    $('#newForScripture').addEventListener('click', () => editPerson(null, scripture));
  }

  /* ================= Reminders ================= */
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function daysText(days) {
    const s = days.slice().sort();
    if (s.length === 7) return 'Every day';
    if (s.join() === '1,2,3,4,5') return 'Weekdays';
    if (s.join() === '0,6') return 'Weekends';
    return s.map(d => DAY[d]).join(', ');
  }
  function timeText(t) {
    const [h, m] = t.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function notifStatus() {
    if (!('Notification' in window)) return { cls: 'warn', html: 'This browser cannot show notifications. Use <b>📅 Add to calendar</b> on a reminder, and your phone\'s calendar will alert you instead.' };
    if (Notification.permission === 'granted') return { cls: 'ok', html: '✓ Notifications are on. Lamp & Path alerts you while it is open, including in a background tab. <b>For reminders even when the app is closed</b>, tap <b>📅 Add to calendar</b> on a reminder.' };
    if (Notification.permission === 'denied') return { cls: 'warn', html: 'Notifications are blocked for this site in your browser settings. You can still use <b>📅 Add to calendar</b> for reliable reminders.' };
    return { cls: 'ask', html: 'Turn on notifications so your reminders can alert you.', btn: true };
  }

  function renderReminders(host) {
    const st = notifStatus();
    const list = state.reminders.slice().sort((a, b) => a.time.localeCompare(b.time));
    host.innerHTML = `
      <div class="pl-head">
        <div><h2 class="section-title flush">Prayer reminders</h2>
        <p class="muted small">"Evening, and morning, and at noon, will I pray" (Psalm 55:17)</p></div>
        <button class="btn primary" id="addRem">＋ New reminder</button>
      </div>
      <div class="notif-banner ${st.cls}">${st.html}${st.btn ? ' <button class="btn primary small" id="enableNotif">Enable notifications</button>' : ''}</div>
      ${list.length ? `<div class="reminders">${list.map(r => {
        const p = r.personId ? person(r.personId) : null;
        return `<div class="rem ${r.enabled ? '' : 'off'}">
          <div class="rem-time">${esc(timeText(r.time))}</div>
          <div class="rem-main"><b>${esc(r.label || 'Prayer time')}</b><div class="muted small">${esc(daysText(r.days))}${p ? ` · for ${esc(p.name)}` : ''}</div></div>
          <label class="switch" title="On / off"><input type="checkbox" data-tog="${r.id}" ${r.enabled ? 'checked' : ''}><span></span></label>
          <div class="rem-actions">
            <button class="btn ghost small" data-ics="${r.id}">📅 Add to calendar</button>
            <button class="btn ghost small" data-redit="${r.id}">Edit</button>
            <button class="btn ghost small danger" data-rmdel="${r.id}">Delete</button>
          </div>
        </div>`;
      }).join('')}</div>`
      : `<div class="empty-state small-empty"><p class="muted">No reminders yet. Start with one of these:</p>
          <div class="row center gap wrap">
            <button class="btn ghost" data-preset="06:30|Morning prayer">🌅 Morning 6:30</button>
            <button class="btn ghost" data-preset="12:00|Midday prayer">☀️ Noon 12:00</button>
            <button class="btn ghost" data-preset="21:00|Evening prayer">🌙 Evening 9:00</button>
          </div></div>`}
      <div class="row center"><button class="btn ghost small" id="testRem">🔔 Send a test reminder</button></div>`;
    $('#addRem').addEventListener('click', () => editReminder());
    const en = $('#enableNotif'); en && en.addEventListener('click', async () => { await requestPermission(); renderReminders(host); });
    $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const [time, label] = b.dataset.preset.split('|');
      state.reminders.push({ id: uid(), time, label, days: [0, 1, 2, 3, 4, 5, 6], personId: null, enabled: true, lastFired: null });
      save(); Sound.play('correct'); toast(`🔔 ${label} set for ${timeText(time)}`);
      maybeAskPermission(); renderReminders(host);
    }));
    $$('[data-tog]').forEach(c => c.addEventListener('change', () => { const r = state.reminders.find(x => x.id === c.dataset.tog); r.enabled = c.checked; save(); renderReminders(host); }));
    $$('[data-redit]').forEach(b => b.addEventListener('click', () => editReminder(b.dataset.redit)));
    $$('[data-rmdel]').forEach(b => b.addEventListener('click', () => { if (!confirm('Delete this reminder?')) return; state.reminders = state.reminders.filter(x => x.id !== b.dataset.rmdel); save(); renderReminders(host); }));
    $$('[data-ics]').forEach(b => b.addEventListener('click', () => downloadICS(state.reminders.find(x => x.id === b.dataset.ics))));
    $('#testRem').addEventListener('click', () => fire({ id: 'test', label: 'Test reminder', time: '00:00', days: [], personId: state.people[0] ? state.people[0].id : null }, true));
  }

  function refreshReminders() { const h = $('#remindersHost'); if (h) renderReminders(h); }

  function editReminder(id, personId) {
    const r = id ? state.reminders.find(x => x.id === id) : null;
    const days = new Set(r ? r.days : [0, 1, 2, 3, 4, 5, 6]);
    const pid = r ? r.personId : personId || '';
    const p = pid ? person(pid) : null;
    UI().openModal(`
      <div class="pform">
        <div class="eyebrow">${r ? 'Edit reminder' : 'New prayer reminder'}</div>
        <h2>When would you like to pray?</h2>
        <label class="flabel">Time</label>
        <input type="time" class="search time-in" id="rTime" value="${r ? r.time : '07:00'}">
        <label class="flabel">Days</label>
        <div class="days">${DAY.map((d, i) => `<button class="day ${days.has(i) ? 'on' : ''}" data-d="${i}">${d}</button>`).join('')}</div>
        <div class="row gap"><button class="link-btn" id="dAll">Every day</button> · <button class="link-btn" id="dWk">Weekdays</button></div>
        <label class="flabel">Label</label>
        <input class="search" id="rLabel" maxlength="60" placeholder="e.g. Morning prayer" value="${esc(r ? r.label : (p ? `Pray for ${p.name}` : 'Prayer time'))}">
        <label class="flabel">Pray for <span class="muted">(optional)</span></label>
        <select class="search" id="rPerson"><option value="">Nobody in particular (guided prayer)</option>${state.people.map(x => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <div class="row end gap"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="rSave">Save reminder</button></div>
      </div>`);
    $('#rPerson').addEventListener('change', e => {
      const lab = $('#rLabel'), np = person(e.target.value);
      if (!lab.value.trim() || lab.value === 'Prayer time' || /^Pray for /.test(lab.value)) lab.value = np ? `Pray for ${np.name}` : 'Prayer time';
    });
    const paint = () => $$('.day').forEach(b => b.classList.toggle('on', days.has(+b.dataset.d)));
    $$('.day').forEach(b => b.addEventListener('click', () => { const d = +b.dataset.d; days.has(d) ? days.delete(d) : days.add(d); paint(); }));
    $('#dAll').addEventListener('click', () => { [0, 1, 2, 3, 4, 5, 6].forEach(d => days.add(d)); paint(); });
    $('#dWk').addEventListener('click', () => { days.clear(); [1, 2, 3, 4, 5].forEach(d => days.add(d)); paint(); });
    $('#rSave').addEventListener('click', () => {
      const time = $('#rTime').value;
      if (!time || !days.size) { toast('Choose a time and at least one day'); return; }
      const data = { time, days: [...days].sort(), label: $('#rLabel').value.trim() || 'Prayer time', personId: $('#rPerson').value || null };
      if (r) { Object.assign(r, data); if (r.lastFired && r.lastFired.endsWith(time) === false) r.lastFired = null; }
      else state.reminders.push(Object.assign({ id: uid(), enabled: true, lastFired: null }, data));
      save(); Sound.play('correct');
      toast(`🔔 Reminder set: ${timeText(time)}, ${daysText(data.days)}`);
      UI().closeModal();
      maybeAskPermission();
      refreshReminders();
    });
  }

  async function requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
  }
  function maybeAskPermission() {
    if ('Notification' in window && Notification.permission === 'default') requestPermission().then(refreshReminders);
  }

  /* Calendar file so the phone/computer calendar can remind even when the app is closed. */
  function downloadICS(r) {
    const p = r.personId ? person(r.personId) : null;
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const [h, m] = r.time.split(':');
    const start = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${h}${m}00`;
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const rule = r.days.length === 7 ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${r.days.map(d => BY[d]).join(',')}`;
    const escI = s => s.replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    let desc = 'Time to pray. Open Lamp & Path for guided prayer.';
    if (p) {
      desc = `Pray for ${p.name}.`;
      const open = p.reasons.filter(x => !x.answered).map(x => '• ' + x.text);
      if (open.length) desc += '\n\nRequests:\n' + open.join('\n');
      if (p.scriptures.length) desc += '\n\nScriptures:\n' + p.scriptures.map(s => `${s.ref}: ${s.text}`).join('\n');
    }
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lamp and Path//Prayer Reminder//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', `UID:${r.id}@lamp-and-path`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT10M', `RRULE:${rule}`,
      `SUMMARY:${escI('🙏 ' + (r.label || 'Prayer time'))}`, `DESCRIPTION:${escI(desc)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${escI(r.label || 'Time to pray')}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = (r.label || 'prayer-reminder').replace(/[^\w]+/g, '-').toLowerCase() + '.ics';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('📅 Calendar file downloaded. Open it to add the repeating reminder.');
  }

  /* ================= Scheduler ================= */
  function check() {
    const now = new Date();
    const key = window.Core.dateKey(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    state.reminders.forEach(r => {
      if (!r.enabled || !r.days.includes(now.getDay())) return;
      const [h, m] = r.time.split(':').map(Number);
      const rMin = h * 60 + m;
      const stamp = key + ' ' + r.time;
      // fire on time, or catch up if the app was opened up to an hour late
      if (nowMin >= rMin && nowMin - rMin <= 60 && r.lastFired !== stamp) {
        r.lastFired = stamp; save();
        fire(r, false);
      }
    });
  }

  function fire(r, isTest) {
    const p = r.personId ? person(r.personId) : null;
    const title = `🙏 ${r.label || 'Time to pray'}`;
    let body = p ? `Take a moment to pray for ${p.name}.` : 'Take a few minutes with God.';
    if (p && p.scriptures.length) body += ` "${p.scriptures[0].text.slice(0, 120)}" (${p.scriptures[0].ref})`;
    Sound.play('bell');
    if ('Notification' in window && Notification.permission === 'granted') {
      const opts = { body, icon: 'icons/icon.svg', badge: 'icons/icon.svg', tag: 'prayer-' + r.id, data: { url: './index.html#prayer' } };
      const viaSW = navigator.serviceWorker && navigator.serviceWorker.controller
        ? navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts))
        : Promise.reject();
      viaSW.catch(() => { try { new Notification(title, opts); } catch (e) { /* ignore */ } });
    } else if (isTest) toast('Notifications are off, so you will only see this in the app');
    // in-app prompt as well
    if (document.querySelector('#modal.open')) { toast(`🔔 ${r.label || 'Time to pray'}`, 'level'); return; }
    UI().openModal(`
      <div class="result">
        <div class="big-emoji">🔔</div>
        <div class="eyebrow">${isTest ? 'Test reminder' : 'Prayer reminder'}</div>
        <h2>${esc(r.label || 'Time to pray')}</h2>
        <p class="lead">${esc(p ? `Take a moment to pray for ${p.name}.` : 'Come away and spend a few minutes with God.')}</p>
        <p class="scripture center">"Pray without ceasing."<br><span class="muted small">1 Thessalonians 5:17</span></p>
        <div class="row center gap"><button class="btn ghost" data-close>Not now</button><button class="btn primary" id="remGo">Pray now</button></div>
      </div>`, { cls: 'prayer-modal' });
    $('#remGo').addEventListener('click', () => {
      if (p) prayFor(p.id);
      else { UI().closeModal(); UI().show('prayer'); setTimeout(() => UI().startGuidedPrayer(), 50); }
    });
  }

  function startScheduler() {
    check();
    setInterval(check, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  window.PrayList = { renderPeople, renderReminders, pickPersonFor, startScheduler, openPerson, prayFor, editReminder, CATEGORIES };
})();
