/*
 * Personal prayer life:
 *  - My requests: praying → answered (when and how) or past need (no longer relevant)
 *  - Led to pray: a journal of what the Lord lays on your heart to pray about
 *  - A shared dialog for recording how a prayer was answered, or why it is no longer needed
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const UI = () => window.UI;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const lordHTML = t => esc(t).replace(/LORD/g, '<span class="sc">Lord</span>');
  const fmt = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const days = (a, b) => Math.max(0, Math.round((b - a) / 86400000));
  const span = n => n === 0 ? 'the same day' : n === 1 ? '1 day' : n < 60 ? `${n} days` : n < 730 ? `${Math.round(n / 30)} months` : `${(n / 365).toFixed(1)} years`;
  const toInput = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fromInput = v => { if (!v) return Date.now(); const [y, m, d] = v.split('-').map(Number); const now = new Date(); return new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime(); };

  /* ================= Outcome dialog ================= */
  /* kind: 'answered' | 'passed'. Resolves to { at, text } or null if cancelled. */
  function outcome(kind, title, existing = {}) {
    const A = kind === 'answered';
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'ask-overlay';
      box.innerHTML = `<div class="ask-card outcome ${A ? 'answered' : 'passed'}" role="dialog" aria-modal="true">
        <div class="eyebrow">${A ? '🙌 Prayer answered' : '⌛ No longer needed'}</div>
        <h3>${esc(title)}</h3>
        <label class="flabel" for="ocDate">${A ? 'When was it answered?' : 'Since when?'}</label>
        <input type="date" class="search" id="ocDate" value="${toInput(existing.at || Date.now())}" max="${toInput(Date.now())}">
        <label class="flabel" for="ocText">${A ? 'How did God answer?' : 'What changed? (optional)'}</label>
        <textarea class="notes small-ta" id="ocText" maxlength="1500" placeholder="${A ? 'Describe what happened, so you can remember His faithfulness…' : 'e.g. the situation resolved another way, or my desire changed…'}">${esc(existing.text || '')}</textarea>
        <p class="oc-verse">${A
          ? '"For this child I prayed; and the <span class="sc">Lord</span> hath given me my petition which I asked of him" (1 Samuel 1:27)'
          : '"To every thing there is a season, and a time to every purpose under the heaven" (Ecclesiastes 3:1)'}</p>
        <div class="row end gap"><button class="btn ghost" data-a="0">Cancel</button><button class="btn primary" data-a="1">${A ? 'Save as answered' : 'Move to past needs'}</button></div>
      </div>`;
      document.body.appendChild(box);
      const done = v => { box.remove(); resolve(v); };
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-a]');
        if (!b) { if (e.target === box) done(null); return; }
        if (b.dataset.a === '0') return done(null);
        done({ at: fromInput(box.querySelector('#ocDate').value), text: box.querySelector('#ocText').value.trim() });
      });
      setTimeout(() => box.querySelector('#ocText').focus(), 50);
    });
  }

  /* ================= My requests ================= */
  let reqTab = 'open';
  function counts() {
    const r = state.requests;
    return { open: r.filter(x => x.status === 'open').length, answered: r.filter(x => x.status === 'answered').length, passed: r.filter(x => x.status === 'passed').length };
  }

  function renderRequests(host) {
    const c = counts();
    const list = state.requests.filter(r => r.status === reqTab).sort((a, b) =>
      reqTab === 'answered' ? b.answeredAt - a.answeredAt : reqTab === 'passed' ? b.passedAt - a.passedAt : b.created - a.created);
    host.innerHTML = `
      <div class="pl-head">
        <div><h2 class="section-title flush">My prayer requests</h2>
        <p class="muted small">"Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not." (Jeremiah 33:3)</p></div>
        <button class="btn primary" id="newReq">＋ New request</button>
      </div>
      <div class="seg req-tabs">
        <button class="seg-btn ${reqTab === 'open' ? 'active' : ''}" data-rt="open">🙏 Praying <span class="count">${c.open}</span></button>
        <button class="seg-btn ${reqTab === 'answered' ? 'active' : ''}" data-rt="answered">🙌 Answered <span class="count">${c.answered}</span></button>
        <button class="seg-btn ${reqTab === 'passed' ? 'active' : ''}" data-rt="passed">⌛ Past needs <span class="count">${c.passed}</span></button>
      </div>
      ${reqTab === 'passed' ? '<p class="muted small tab-note">Needs and wants that are no longer relevant. They are kept here so you can look back and see how your life and prayers have changed.</p>' : ''}
      ${reqTab === 'answered' && c.answered ? `<p class="muted small tab-note">${c.answered} answered prayer${c.answered === 1 ? '' : 's'}. Read these when you need to remember God's faithfulness.</p>` : ''}
      <div class="requests">${list.length ? list.map(card).join('') : empty()}</div>`;
    $('#newReq').addEventListener('click', () => editRequest());
    $$('[data-rt]').forEach(b => b.addEventListener('click', () => { reqTab = b.dataset.rt; Sound.play('tap'); renderRequests(host); }));
    const ef = $('#emptyNew'); ef && ef.addEventListener('click', () => editRequest());
    host.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act, b.dataset.id, host)));
  }

  function empty() {
    if (reqTab === 'open') return `<div class="empty-state"><div class="big-emoji">🙏</div><h3>What would you like to ask God for?</h3><p class="muted">Write down your personal requests. When God answers, record when and how.</p><button class="btn primary" id="emptyNew">Add my first request</button></div>`;
    if (reqTab === 'answered') return '<div class="empty-state small-empty"><p class="muted">No answered prayers recorded yet. When a request is answered, tap <b>✓ Answered</b> on it and write how God answered.</p></div>';
    return '<div class="empty-state small-empty"><p class="muted">Nothing here yet. When a need or want is no longer relevant, tap <b>⌛ No longer needed</b> on it.</p></div>';
  }

  function card(r) {
    const scripture = r.scripture ? `<div class="pscripture"><b>${esc(r.scripture.ref)}</b><p class="scripture">${lordHTML(r.scripture.text)}</p></div>` : '';
    const details = r.details ? `<p class="req-details">${esc(r.details)}</p>` : '';
    if (r.status === 'answered') return `
      <article class="req answered">
        <h4>${esc(r.title)}</h4>${details}
        <div class="req-meta">Asked ${fmt(r.created)} · <b class="ans">Answered ${fmt(r.answeredAt)}</b> · after ${span(days(r.created, r.answeredAt))}</div>
        <div class="how"><div class="how-label">How God answered</div><p>${r.answeredHow ? esc(r.answeredHow) : '<span class="muted">No details written.</span>'}</p></div>
        ${scripture}
        <div class="row gap wrap"><button class="btn ghost small" data-act="edit-answer" data-id="${r.id}">✏️ Edit answer</button><button class="btn ghost small" data-act="reopen" data-id="${r.id}">↺ Still praying</button><button class="btn ghost small danger" data-act="delete" data-id="${r.id}">Delete</button></div>
      </article>`;
    if (r.status === 'passed') return `
      <article class="req passed">
        <h4>${esc(r.title)}</h4>${details}
        <div class="req-meta">Asked ${fmt(r.created)} · No longer needed since ${fmt(r.passedAt)}</div>
        ${r.passedNote ? `<div class="how"><div class="how-label">What changed</div><p>${esc(r.passedNote)}</p></div>` : ''}
        <div class="row gap wrap"><button class="btn ghost small" data-act="reopen" data-id="${r.id}">↺ Pray for this again</button><button class="btn ghost small danger" data-act="delete" data-id="${r.id}">Delete</button></div>
      </article>`;
    const n = days(r.created, Date.now());
    return `
      <article class="req">
        <h4>${esc(r.title)}</h4>${details}
        <div class="req-meta">Asking since ${fmt(r.created)} (${span(n)})${r.prayedCount ? ` · prayed ${r.prayedCount} time${r.prayedCount === 1 ? '' : 's'}` : ''}${r.fromLeading ? ' · 🕊️ from Led to pray' : ''}</div>
        ${scripture}
        <div class="row gap wrap">
          <button class="btn primary small" data-act="prayed" data-id="${r.id}">🙏 I prayed</button>
          <button class="btn ghost small" data-act="answered" data-id="${r.id}">✓ Answered</button>
          <button class="btn ghost small" data-act="passed" data-id="${r.id}">⌛ No longer needed</button>
          <button class="btn ghost small" data-act="edit" data-id="${r.id}">Edit</button>
          <button class="btn ghost small danger" data-act="delete" data-id="${r.id}">Delete</button>
        </div>
      </article>`;
  }

  async function act(kind, id, host) {
    const r = state.requests.find(x => x.id === id);
    if (!r) return;
    if (kind === 'prayed') {
      const firstToday = !r.lastPrayed || window.Core.dateKey(new Date(r.lastPrayed)) !== window.Core.dateKey();
      r.prayedCount = (r.prayedCount || 0) + 1; r.lastPrayed = Date.now(); save();
      const firstPrayer = !window.Core.today().prayer;
      window.Core.markDaily('prayer');
      if (firstToday && firstPrayer) window.Core.addXP(10, 'Prayed');
      Sound.play('correct'); toast('🙏 Amen');
    }
    if (kind === 'answered' || kind === 'edit-answer') {
      const res = await outcome('answered', r.title, kind === 'edit-answer' ? { at: r.answeredAt, text: r.answeredHow } : {});
      if (!res) return;
      const wasOpen = r.status !== 'answered';
      Object.assign(r, { status: 'answered', answeredAt: Math.max(res.at, r.created), answeredHow: res.text }); save();
      if (wasOpen) { Sound.play('badge'); toast('Praise God for answered prayer! 🙌', 'level'); window.Core.addXP(15, 'Answered prayer'); reqTab = 'answered'; }
      window.Core.checkBadges();
    }
    if (kind === 'passed') {
      const res = await outcome('passed', r.title);
      if (!res) return;
      Object.assign(r, { status: 'passed', passedAt: Math.max(res.at, r.created), passedNote: res.text }); save();
      toast('Moved to past needs');
    }
    if (kind === 'reopen') { r.status = 'open'; save(); reqTab = 'open'; toast('Back on your praying list'); }
    if (kind === 'edit') return editRequest(r.id);
    if (kind === 'delete') {
      if (!(await UI().ask(`Delete "${r.title.slice(0, 60)}"?`, 'Delete'))) return;
      state.requests = state.requests.filter(x => x.id !== id); save();
    }
    renderRequests(host);
  }

  function editRequest(id, preset = {}) {
    const r = id ? state.requests.find(x => x.id === id) : null;
    UI().openModal(`
      <div class="pform">
        <div class="eyebrow">${r ? 'Edit request' : 'New prayer request'}</div>
        <h2>${r ? 'Edit your request' : 'What are you asking God for?'}</h2>
        <label class="flabel" for="rqTitle">Request</label>
        <input class="search" id="rqTitle" maxlength="140" placeholder="e.g. Wisdom for my exams, a job, healing for my back" value="${esc(r ? r.title : preset.title || '')}">
        <label class="flabel" for="rqDetails">Details <span class="muted">(optional)</span></label>
        <textarea class="notes small-ta" id="rqDetails" maxlength="1500" placeholder="Anything more you want to remember about this request">${esc(r ? r.details : preset.details || '')}</textarea>
        <label class="flabel" for="rqRef">A scripture to stand on <span class="muted">(optional)</span></label>
        <input class="search" id="rqRef" placeholder="e.g. Philippians 4:19" value="${esc(r && r.scripture ? r.scripture.ref : preset.ref || '')}">
        ${r ? '' : `<label class="flabel" for="rqDate">Since when have you been praying about it?</label><input type="date" class="search" id="rqDate" value="${toInput(Date.now())}" max="${toInput(Date.now())}">`}
        <div class="row end gap"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="rqSave">${r ? 'Save' : 'Add request'}</button></div>
      </div>`);
    setTimeout(() => $('#rqTitle') && $('#rqTitle').focus(), 60);
    $('#rqSave').addEventListener('click', async () => {
      const title = $('#rqTitle').value.trim();
      if (!title) { $('#rqTitle').classList.add('shake'); setTimeout(() => $('#rqTitle').classList.remove('shake'), 400); return; }
      const ref = $('#rqRef').value.trim();
      let scripture = r ? r.scripture : null;
      if (ref && (!scripture || scripture.ref !== ref)) {
        try { const res = await window.Bible.lookup(ref); scripture = { ref: res.ref, text: res.verses.map(v => v[1]).join(' ') }; }
        catch (e) { toast(e.message); return; }
      }
      if (!ref) scripture = null;
      const details = $('#rqDetails').value.trim();
      if (r) Object.assign(r, { title, details, scripture });
      else state.requests.push({ id: uid(), title, details, scripture, created: fromInput($('#rqDate').value), status: 'open', prayedCount: 0, lastPrayed: 0, fromLeading: preset.fromLeading || null });
      save(); window.Core.checkBadges(); Sound.play('correct');
      UI().closeModal();
      reqTab = 'open';
      if (!r) toast('🙏 Added to your prayer requests');
      const host = $('#requestsHost'); if (host) renderRequests(host);
      const lh = $('#leadingsHost'); if (lh) renderLeadings(lh);
    });
  }

  /* ================= Led to pray ================= */
  function dayLabel(t) {
    const k = window.Core.dateKey(new Date(t));
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (k === window.Core.dateKey()) return 'Today';
    if (k === window.Core.dateKey(y)) return 'Yesterday';
    return new Date(t).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function renderLeadings(host) {
    const items = state.leadings.slice().sort((a, b) => b.at - a.at);
    const groups = [];
    items.forEach(l => { const g = dayLabel(l.at); if (!groups.length || groups[groups.length - 1][0] !== g) groups.push([g, []]); groups[groups.length - 1][1].push(l); });
    host.innerHTML = `
      <div class="pl-head">
        <div><h2 class="section-title flush">Led to pray</h2>
        <p class="muted small">Write down what the Holy Spirit lays on your heart to pray about: a person, a place, a burden, a word.</p></div>
      </div>
      <section class="lead-compose">
        <p class="oc-verse">"Likewise the Spirit also helpeth our infirmities: for we know not what we should pray for as we ought: but the Spirit itself maketh intercession for us with groanings which cannot be uttered." (Romans 8:26)</p>
        <label class="flabel" for="ldText">What is the Lord leading you to pray about?</label>
        <textarea class="notes" id="ldText" maxlength="2000" placeholder="e.g. I woke up thinking about my cousin Tomi. I sense I should pray for her safety and her studies."></textarea>
        <div class="lead-row">
          <div><label class="flabel" for="ldFor">For <span class="muted">(optional)</span></label><input class="search" id="ldFor" maxlength="80" placeholder="A person, place or situation"></div>
          <div><label class="flabel" for="ldRef">Scripture that came to mind <span class="muted">(optional)</span></label><input class="search" id="ldRef" placeholder="e.g. Psalm 91:11"></div>
        </div>
        <div class="row end"><button class="btn primary" id="ldSave">Save to my journal</button></div>
      </section>
      ${groups.length ? groups.map(([g, list]) => `
        <h3 class="cat-title">${esc(g)}</h3>
        <div class="leadings">${list.map(l => `
          <article class="lead ${l.prayedAt ? 'prayed' : ''}">
            <div class="lead-time">${new Date(l.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${l.for ? ` · <span class="lead-for">for ${esc(l.for)}</span>` : ''}</div>
            <p class="lead-text">${esc(l.text)}</p>
            ${l.scripture ? `<div class="pscripture"><b>${esc(l.scripture.ref)}</b><p class="scripture">${lordHTML(l.scripture.text)}</p></div>` : ''}
            <div class="row gap wrap">
              ${l.prayedAt ? `<span class="pill ok">✓ Prayed ${esc(dayLabel(l.prayedAt).toLowerCase() === 'today' ? 'today' : 'on ' + fmt(l.prayedAt))}</span>` : `<button class="btn primary small" data-lact="prayed" data-id="${l.id}">🙏 I prayed about this</button>`}
              ${l.requestId ? '<span class="pill">📝 In my requests</span>' : `<button class="btn ghost small" data-lact="toreq" data-id="${l.id}">＋ Make it a prayer request</button>`}
              <button class="btn ghost small danger" data-lact="delete" data-id="${l.id}">Delete</button>
            </div>
          </article>`).join('')}</div>`).join('')
      : '<div class="empty-state small-empty"><p class="muted">Your entries will appear here, grouped by day.</p></div>'}`;
    $('#ldSave').addEventListener('click', async () => {
      const text = $('#ldText').value.trim();
      if (!text) { $('#ldText').classList.add('shake'); setTimeout(() => $('#ldText').classList.remove('shake'), 400); return; }
      const ref = $('#ldRef').value.trim();
      let scripture = null;
      if (ref) {
        try { const res = await window.Bible.lookup(ref); scripture = { ref: res.ref, text: res.verses.map(v => v[1]).join(' ') }; }
        catch (e) { toast(e.message); return; }
      }
      state.leadings.push({ id: uid(), at: Date.now(), text, for: $('#ldFor').value.trim(), scripture, prayedAt: 0, requestId: null });
      save(); window.Core.checkBadges(); Sound.play('correct'); toast('🕊️ Saved');
      renderLeadings(host);
    });
    host.querySelectorAll('[data-lact]').forEach(b => b.addEventListener('click', async () => {
      const l = state.leadings.find(x => x.id === b.dataset.id);
      if (!l) return;
      if (b.dataset.lact === 'prayed') { l.prayedAt = Date.now(); save(); window.Core.markDaily('prayer'); Sound.play('correct'); toast('🙏 Amen'); }
      if (b.dataset.lact === 'toreq') {
        const title = (l.for ? `For ${l.for}: ` : '') + l.text.split(/(?<=[.!?])\s/)[0].slice(0, 120);
        const rq = { id: uid(), title, details: l.text, scripture: l.scripture, created: l.at, status: 'open', prayedCount: l.prayedAt ? 1 : 0, lastPrayed: l.prayedAt || 0, fromLeading: l.id };
        state.requests.push(rq); l.requestId = rq.id; save();
        Sound.play('correct'); toast('📝 Added to My requests');
      }
      if (b.dataset.lact === 'delete') {
        if (!(await UI().ask('Delete this journal entry?', 'Delete'))) return;
        state.leadings = state.leadings.filter(x => x.id !== l.id); save();
      }
      renderLeadings(host);
    }));
  }

  window.Requests = { renderRequests, renderLeadings, outcome, editRequest };
})();
