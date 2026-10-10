/*
 * Features that need the claude.ai app link: they light up only there, and stay hidden elsewhere
 * (the installed app, GitHub Pages, the offline file).
 *  - Ask about a passage: Claude answers with history and context, citing verses you can tap to check.
 *  - Prayer wall: share requests with the people the app link is shared with, and pray for each other.
 *  - Group discussion: talk about a chapter together, and read the same plan.
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const B = () => window.Bible;
  const UI = () => window.UI;
  const C = { ai: null, db: null, user: null, me: null, ready: false };

  /* ---------------- Start-up: find out what this view can do ---------------- */
  async function init() {
    if (!window.claude || !window.claude.use) return;
    const [ai, db, user] = await Promise.all(['sample', 'db', 'user'].map(n => window.claude.use(n).catch(() => null)));
    C.ai = ai; C.db = db; C.user = user;
    if (user) { try { C.me = await user.me(); } catch (e) { C.me = null; } }
    C.ready = true;
    if (ai || db) {
      const cur = UI().current && UI().current();
      if (cur === 'grow') window.Grow.render();
      if (cur === 'bible' && window.Reader) window.Reader.refreshRow && window.Reader.refreshRow();
    }
  }
  setTimeout(init, 0);

  const canAsk = () => !!C.ai;
  const canShare = () => !!(C.db && C.me && C.me.id);
  const names = async ids => { try { return C.user ? await C.user.profiles([...new Set(ids)]) : {}; } catch (e) { return {}; } };
  const when = t => { const d = (Date.now() - t) / 60000; return d < 1 ? 'just now' : d < 60 ? `${Math.round(d)} min ago` : d < 1440 ? `${Math.round(d / 60)} h ago` : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
  const errText = e => ({
    not_granted: 'Asking Claude was not allowed for this page.', sampling_disabled: 'Asking Claude is not available on this account.',
    rate_limited: 'Too many questions just now. Please try again in a little while.', session_expired: 'Please sign in to Claude again.',
    refused: 'Claude could not answer that. Try asking in a different way.', prompt_too_large: 'That passage is too long. Choose fewer verses.'
  })[e && e.code] || 'Something went wrong. Please try again.';

  /* ---------------- Ask about a passage (Claude) ---------------- */
  const RULES = `You are a careful Bible study helper inside a Bible app. Answer the reader's question about the passage given.
- Explain plainly, warmly and briefly (about 120-250 words unless more is asked for), in simple English.
- Give historical, cultural, geographical and language background where it helps, and what the text says in its context.
- Support every point from Scripture: cite verses as references in parentheses, like (John 3:16) or (Romans 8:28-30), using full book names. Readers will tap them to check, so cite only verses you are sure of.
- Do not invent facts, quotations or sources. If something is uncertain or debated, say so, and where Christians hold different views, describe the main views fairly without choosing for the reader.
- Do not claim new revelation or add teaching beyond what Scripture supports. Encourage the reader to search the Scriptures (Acts 17:11) and to talk with their pastor on personal or pastoral matters.
- Use plain paragraphs. You may use short "- " bullet lines. No headings, no tables.`;

  function answerHTML(text) {
    return text.split(/\n{2,}/).map(par => {
      const lines = par.split('\n');
      if (lines.every(l => /^\s*[-•*]\s+/.test(l))) return `<ul>${lines.map(l => `<li>${window.Grow.linkRefs(l.replace(/^\s*[-•*]\s+/, '').replace(/\*\*/g, ''))}</li>`).join('')}</ul>`;
      return `<p>${window.Grow.linkRefs(par.replace(/\*\*/g, '')).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }

  /* opts: { ref, text } for a passage, or nothing for a free question */
  function ask(opts = {}) {
    if (!canAsk()) return;
    const turns = [];
    const passage = opts.ref ? `Passage (${B().version((state.readerOpts || {}).ver || 'kjv').abbr}): ${opts.ref}\n"${opts.text}"` : '';
    const starters = opts.ref
      ? ['What is happening here, and why does it matter?', 'What was the background when this was written?', 'What do the key words mean in the original language?', 'How does this point to Jesus?', 'How can I apply this today?']
      : ['How can I know God’s will?', 'Who wrote the book of Hebrews?', 'What is the difference between the Old and New Covenants?', 'Why did Jesus speak in parables?'];
    UI().openModal(`
      <div class="ask-ai">
        <div class="eyebrow">✨ Ask about the Bible</div>
        <h2>${opts.ref ? esc(opts.ref) : 'Ask a Bible question'}</h2>
        ${opts.ref ? `<blockquote class="scripture">${esc(opts.text).replace(/LORD/g, '<span class="sc">Lord</span>')}</blockquote>` : ''}
        <div class="chat" id="aiChat"></div>
        <div class="chips" id="aiStarters">${starters.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="add-row"><input class="search" id="aiQ" placeholder="Type your question…" maxlength="500"><button class="btn primary" id="aiGo">Ask</button></div>
        <p class="muted small">Answers come from Claude, an AI. They cite verses: tap them to check against the Bible. Test everything by Scripture (1 Thessalonians 5:21).</p>
      </div>`, { cls: 'parchment' });
    let ctl = null;
    const chat = $('#aiChat');
    const send = async q => {
      q = (q || '').trim();
      if (!q) return;
      if (ctl) ctl.abort();
      $('#aiStarters').classList.add('hidden');
      $('#aiQ').value = '';
      turns.push({ role: 'user', content: q });
      const qEl = document.createElement('div'); qEl.className = 'bubble me'; qEl.textContent = q; chat.appendChild(qEl);
      const aEl = document.createElement('div'); aEl.className = 'bubble ai'; aEl.innerHTML = '<span class="thinking">Thinking…</span> <button class="link-btn" data-stop>Stop</button>'; chat.appendChild(aEl);
      aEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      ctl = new AbortController();
      aEl.querySelector('[data-stop]').addEventListener('click', () => ctl && ctl.abort());
      const input = [{ role: 'user', content: RULES + (passage ? '\n\n' + passage : '') }, ...turns.slice(-8)];
      if (input[1] && input[1].role === 'assistant') input.splice(1, 1);
      try {
        const { text, truncated } = await C.ai(input, { cache: false, signal: ctl.signal, onText: ({ text }) => { aEl.innerHTML = answerHTML(text); } });
        aEl.innerHTML = answerHTML(text) + (truncated ? '<p class="muted small">The answer was cut short. Ask for less at a time.</p>' : '');
        turns.push({ role: 'assistant', content: text });
        bindRefs(aEl);
      } catch (e) {
        if (e && e.code === 'cancelled') { aEl.innerHTML = e.text ? answerHTML(e.text) + '<p class="muted small">Stopped.</p>' : '<p class="muted small">Stopped.</p>'; }
        else aEl.innerHTML = (e && e.text ? answerHTML(e.text) : '') + `<p class="muted small">${esc(errText(e))}</p>`;
        turns.pop();
        bindRefs(aEl);
      }
      ctl = null;
    };
    const bindRefs = el => el.querySelectorAll('.ref-link').forEach(btn => btn.addEventListener('click', async () => {
      try {
        const r = await B().lookup(btn.dataset.ref);
        let box = btn.nextElementSibling;
        if (box && box.classList.contains('ref-pop')) { box.remove(); return; }
        box = document.createElement('span'); box.className = 'ref-pop';
        box.innerHTML = `${esc(r.verses.map(v => v[1]).join(' '))} <button class="link-btn">Open in Bible</button>`;
        box.querySelector('button').addEventListener('click', () => { UI().closeModal(); window.Reader.openRef(r.ref); });
        btn.after(box);
      } catch (err) { toast(err.message); }
    }));
    $('#aiGo').addEventListener('click', () => send($('#aiQ').value));
    $('#aiQ').addEventListener('keydown', e => { if (e.key === 'Enter') send($('#aiQ').value); });
    document.querySelectorAll('#aiStarters [data-q]').forEach(b => b.addEventListener('click', () => send(b.dataset.q)));
    UI().onModalClose(() => ctl && ctl.abort());
  }

  /* ---------------- Prayer wall (shared) ---------------- */
  let wallUnsub = null, amenUnsub = null, wall = [], amens = [];
  function renderWall(host) {
    if (!canShare()) { host.innerHTML = '<p class="muted">The prayer wall works in the app link on claude.ai, for people the link is shared with.</p>'; return; }
    host.innerHTML = `
      <p class="muted">Share a prayer request with everyone who uses this app link, and pray for one another (James 5:16). Only people the owner has shared the link with can see it.</p>
      <div class="pform wall-new">
        <textarea class="notes" id="wallText" maxlength="600" placeholder="What would you like prayer for?"></textarea>
        <label class="check-row"><input type="checkbox" id="wallAnon"> Post without my name</label>
        <div class="row end"><button class="btn primary" id="wallPost">🙏 Ask for prayer</button></div>
      </div>
      <div id="wallList"><p class="muted">Loading…</p></div>`;
    const list = host.querySelector('#wallList');
    const draw = async () => {
      if (!host.isConnected) return;
      const count = {}, mine = new Set();
      amens.forEach(a => { count[a.pid] = (count[a.pid] || 0) + 1; if (a.by === C.me.id) mine.add(a.pid); });
      const ppl = await names(wall.map(w => w.by));
      list.innerHTML = wall.length ? wall.map(w => `
        <article class="wall-item ${w.answered ? 'answered' : ''}">
          <div class="wall-head"><b>${w.anon ? 'Someone' : esc((ppl[w.by] && ppl[w.by].name) || 'Someone')}</b><span class="muted small">${when(w.at)}</span>${w.answered ? '<span class="pill ok">🙌 Answered</span>' : ''}</div>
          <p>${esc(w.text)}</p>
          <div class="row gap wrap">
            <button class="btn ${mine.has(w.id) ? 'primary' : 'ghost'} small" data-amen="${w.id}">🙏 ${mine.has(w.id) ? 'I prayed' : 'I’ll pray'}${count[w.id] ? ` · ${count[w.id]}` : ''}</button>
            ${w.by === C.me.id ? `${w.answered ? '' : `<button class="btn ghost small" data-ans="${w.id}">🙌 God answered</button>`}<button class="btn ghost small danger" data-del="${w.id}">Delete</button>` : ''}
          </div>
        </article>`).join('') : '<div class="empty-state small-empty"><p class="muted">No requests yet. Be the first to ask for prayer.</p></div>';
      list.querySelectorAll('[data-amen]').forEach(b => b.addEventListener('click', async () => {
        const ref = C.db.doc(`amens/${b.dataset.amen}_${C.me.id}`);
        try {
          if (mine.has(b.dataset.amen)) await ref.delete(); else { await ref.set({ pid: b.dataset.amen, by: C.me.id, at: Date.now() }); Sound.play('correct'); toast('🙏 Amen. Thank you for praying.'); }
        } catch (e) { toast('Could not save. You may only be able to read this wall.'); }
      }));
      list.querySelectorAll('[data-ans]').forEach(b => b.addEventListener('click', async () => { try { await C.db.doc('prayers/' + b.dataset.ans).update({ answered: true, answeredAt: Date.now() }); Sound.play('badge'); } catch (e) { toast('Could not save.'); } }));
      list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        if (!(await UI().ask('Delete this prayer request from the wall?', 'Delete'))) return;
        try { await C.db.doc('prayers/' + b.dataset.del).delete(); } catch (e) { toast('Could not delete.'); }
      }));
    };
    if (wallUnsub) wallUnsub(); if (amenUnsub) amenUnsub();
    wallUnsub = C.db.collection('prayers').orderBy('at', 'desc').limit(100).onSnapshot(s => { wall = s.docs.map(d => Object.assign({ id: d.id }, d.data())); draw(); }, () => { list.innerHTML = '<p class="muted">The prayer wall is not available right now.</p>'; });
    amenUnsub = C.db.collection('amens').limit(1000).onSnapshot(s => { amens = s.docs.map(d => d.data()); draw(); }, () => {});
    host.querySelector('#wallPost').addEventListener('click', async () => {
      const text = host.querySelector('#wallText').value.trim();
      if (!text) { toast('Write your prayer request first'); return; }
      try {
        await C.db.collection('prayers').add({ text, by: C.me.id, anon: host.querySelector('#wallAnon').checked, at: Date.now(), answered: false });
        host.querySelector('#wallText').value = '';
        Sound.play('bell'); toast('🙏 Shared. Others can now pray with you.');
      } catch (e) { toast(e && e.code === 'quota_exceeded' ? 'The wall is full. Ask the owner to clear old requests.' : 'Could not post. You may only be able to read this wall.'); }
    });
  }

  /* ---------------- Group: discuss a chapter, read one plan together ---------------- */
  let talkUnsub = null;
  function discuss(b, c) {
    if (!canShare()) return;
    const key = `${b}.${c}`;
    UI().openModal(`
      <div class="talk">
        <div class="eyebrow">💬 Group discussion</div>
        <h2>${esc(B().NAMES[b])} ${c}</h2>
        <p class="muted small">Share what stood out to you. Everyone with this app link can read it.</p>
        <div id="talkList"><p class="muted">Loading…</p></div>
        <textarea class="notes" id="talkText" maxlength="800" placeholder="What is God showing you in this chapter?"></textarea>
        <div class="row end"><button class="btn primary" id="talkPost">Post</button></div>
      </div>`);
    const list = $('#talkList');
    if (talkUnsub) talkUnsub();
    talkUnsub = C.db.collection('talk').where('ch', '==', key).orderBy('at', 'asc').limit(200).onSnapshot(async s => {
      const rows = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      const ppl = await names(rows.map(r => r.by));
      if (!document.querySelector('#modal:not(.hidden) .talk')) return;
      list.innerHTML = rows.length ? rows.map(r => `<div class="talk-item"><div class="wall-head"><b>${esc((ppl[r.by] && ppl[r.by].name) || 'Someone')}</b><span class="muted small">${when(r.at)}</span>${r.by === C.me.id ? `<button class="link-btn danger" data-tdel="${r.id}">Delete</button>` : ''}</div><p>${window.Grow.linkRefs(r.text)}</p></div>`).join('')
        : '<p class="muted">No one has posted on this chapter yet.</p>';
      list.querySelectorAll('[data-tdel]').forEach(x => x.addEventListener('click', () => C.db.doc('talk/' + x.dataset.tdel).delete().catch(() => toast('Could not delete.'))));
    }, () => { list.innerHTML = '<p class="muted">Discussion is not available right now.</p>'; });
    UI().onModalClose(() => { if (talkUnsub) { talkUnsub(); talkUnsub = null; } });
    $('#talkPost').addEventListener('click', async () => {
      const text = $('#talkText').value.trim();
      if (!text) return;
      try { await C.db.collection('talk').add({ ch: key, text, by: C.me.id, at: Date.now() }); $('#talkText').value = ''; Sound.play('tap'); }
      catch (e) { toast('Could not post. You may only be able to read here.'); }
    });
  }

  let groupUnsub = null, groupPlan = null;
  function renderGroup(host) {
    if (!canShare()) { host.innerHTML = '<p class="muted">Group reading works in the app link on claude.ai, for people the link is shared with.</p>'; return; }
    host.innerHTML = `
      <p class="muted">Read the same plan together. Everyone sees today’s chapters, and each chapter has a discussion (💬 at the end of the chapter in the Bible).</p>
      <div id="groupPlan"><p class="muted">Loading…</p></div>
      <h2 class="section-title">Recent discussion</h2>
      <div id="groupTalk"><p class="muted">Loading…</p></div>`;
    const drawPlan = () => {
      const el = host.querySelector('#groupPlan'); if (!el) return;
      if (!groupPlan || !groupPlan.id) {
        el.innerHTML = `<div class="empty-state small-empty"><p class="muted">No group plan yet.</p>${C.me.canEdit ? `<div class="chips">${window.PLANS.map(p => `<button class="chip" data-gp="${p.id}">${p.icon} ${esc(p.name)}</button>`).join('')}</div>` : '<p class="muted small">The owner of this app link can choose one.</p>'}</div>`;
      } else {
        const days = window.Grow.schedule(groupPlan.id), def = window.PLANS.find(p => p.id === groupPlan.id) || { name: 'Plan', icon: '🗓️' };
        const d = Math.min(days.length - 1, Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - new Date(groupPlan.start + 'T00:00:00')) / 864e5)));
        el.innerHTML = `<section class="plan-now"><div class="eyebrow">${def.icon} Group plan · ${esc(def.name)}</div><h2>Day ${d + 1} <span class="muted">of ${days.length}</span></h2>
          <div class="ch-list">${days[d].map(([b, c]) => `<div class="ch-item"><button class="ch-open" data-b="${b}" data-c="${c}">📖 ${esc(B().NAMES[b])} ${c}</button><button class="ch-tick" data-tb="${b}" data-tc="${c}" title="Discuss" aria-label="Discuss">💬</button></div>`).join('')}</div>
          ${C.me.canEdit ? '<div class="row end"><button class="btn ghost small danger" id="gpStop">Stop group plan</button></div>' : ''}</section>`;
        el.querySelectorAll('.ch-open').forEach(x => x.addEventListener('click', () => window.Reader.open(+x.dataset.b, +x.dataset.c)));
        el.querySelectorAll('[data-tb]').forEach(x => x.addEventListener('click', () => discuss(+x.dataset.tb, +x.dataset.tc)));
        const st = el.querySelector('#gpStop'); if (st) st.addEventListener('click', () => C.db.doc('group/plan').set({ id: '' }).catch(() => toast('Could not save.')));
      }
      el.querySelectorAll('[data-gp]').forEach(x => x.addEventListener('click', async () => {
        try { await C.db.doc('group/plan').set({ id: x.dataset.gp, start: window.Core.dateKey(), by: C.me.id }); toast('🗓️ Group plan started'); } catch (e) { toast('Only the owner or editors can choose the group plan.'); }
      }));
    };
    if (groupUnsub) groupUnsub();
    groupUnsub = C.db.doc('group/plan').onSnapshot(s => { groupPlan = s.exists ? s.data() : null; drawPlan(); }, () => {});
    C.db.collection('talk').orderBy('at', 'desc').limit(20).get().then(async s => {
      const rows = s.docs.map(d => d.data());
      const ppl = await names(rows.map(r => r.by));
      const el = host.querySelector('#groupTalk'); if (!el) return;
      el.innerHTML = rows.length ? rows.map(r => { const [b, c] = r.ch.split('.').map(Number); return `<button class="result-item" data-b="${b}" data-c="${c}"><b>${esc(B().NAMES[b])} ${c} · ${esc((ppl[r.by] && ppl[r.by].name) || 'Someone')}</b><span>${esc(r.text.slice(0, 160))}</span></button>`; }).join('') : '<p class="muted">No discussion yet.</p>';
      el.querySelectorAll('.result-item').forEach(x => x.addEventListener('click', () => discuss(+x.dataset.b, +x.dataset.c)));
    }).catch(() => {});
  }

  window.Connect = { canAsk, canShare, ask, renderWall, discuss, renderGroup, ready: () => C.ready };
})();
