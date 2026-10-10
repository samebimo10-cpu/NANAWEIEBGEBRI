/*
 * Fasting companion (in Prayer): start a fast with a length, type and focus,
 * get a scripture for each day, keep a short note each day, and finish with a milestone.
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);

  const TYPES = [
    ['partial', 'Partial fast', 'Skip one or more meals each day'],
    ['daniel', 'Daniel fast', 'Vegetables, fruit and water only (Daniel 1:12)'],
    ['sunset', 'Sunrise to sunset', 'No food from morning until evening'],
    ['full', 'Water only', 'Only with good health, and for a short time'],
    ['media', 'Media fast', 'Put down social media, TV or games, and give the time to God']
  ];
  const DAY = 86400000;
  const midnight = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

  function active() { return (state.fasts || []).find(f => f.status === 'active') || null; }
  function dayIndex(f) { return Math.max(0, Math.round((midnight(Date.now()) - midnight(f.start)) / DAY)); }

  function render(host) {
    const f = active();
    const past = (state.fasts || []).filter(x => x.status !== 'active').sort((a, b) => b.start - a.start);
    host.innerHTML = `
      ${f ? activeHTML(f) : startHTML()}
      ${past.length ? `<h2 class="section-title">Past fasts</h2>
        <div class="fast-past">${past.map(x => `<div class="fast-row ${x.status}">
          <b>${x.status === 'done' ? '✓' : '◐'} ${esc(typeName(x.type))} · ${x.days} day${x.days === 1 ? '' : 's'}</b>
          <span class="muted small">${new Date(x.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}${x.focus ? ' · ' + esc(x.focus) : ''}${x.status === 'ended' ? ' · ended early' : ''}</span>
        </div>`).join('')}</div>` : ''}`;
    if (f) bindActive(host, f); else bindStart(host);
  }

  const typeName = k => (TYPES.find(t => t[0] === k) || TYPES[0])[1];

  function startHTML() {
    return `
      <section class="fast-card">
        <div class="eyebrow">🍞 Fasting companion</div>
        <h2>"Is not this the fast that I have chosen?"</h2>
        <p class="muted">Set aside food or distractions to seek God. You get a scripture for each day, a place to write what He shows you, and a reminder of why you began.</p>
        <label class="flabel" for="fDays">How long?</label>
        <div class="seg small" id="fDays">${[1, 3, 7, 21, 40].map((d, i) => `<button class="seg-btn ${i === 1 ? 'active' : ''}" data-d="${d}">${d} day${d === 1 ? '' : 's'}</button>`).join('')}</div>
        <label class="flabel" for="fType">What kind of fast?</label>
        <div class="kind-list" id="fType">${TYPES.map((t, i) => `<label class="kind-opt"><input type="radio" name="ftype" value="${t[0]}" ${i === 0 ? 'checked' : ''}><span><b>${t[1]}</b><small>${t[2]}</small></span></label>`).join('')}</div>
        <label class="flabel" for="fFocus">What are you seeking God about?</label>
        <input class="search" id="fFocus" maxlength="120" placeholder="e.g. direction for my family, healing for Mum, a closer walk">
        <p class="caution">⚕️ Please fast wisely. If you are pregnant, nursing, diabetic, on medication, or have any health condition, speak to a doctor first and choose a partial or media fast. Always drink water.</p>
        <div class="row end"><button class="btn primary" id="fStart">Begin my fast</button></div>
      </section>`;
  }

  function bindStart(host) {
    let days = 3;
    host.querySelectorAll('#fDays .seg-btn').forEach(b => b.addEventListener('click', () => {
      days = +b.dataset.d;
      host.querySelectorAll('#fDays .seg-btn').forEach(x => x.classList.toggle('active', x === b));
    }));
    host.querySelector('#fStart').addEventListener('click', () => {
      const type = (host.querySelector('input[name="ftype"]:checked') || {}).value || 'partial';
      state.fasts.push({ id: 'f' + Date.now(), start: Date.now(), days, type, focus: host.querySelector('#fFocus').value.trim(), notes: {}, status: 'active' });
      save(); Sound.play('bell'); toast('🍞 Your fast has begun. The Lord be with you.');
      render(host);
    });
  }

  function activeHTML(f) {
    const d = dayIndex(f);
    const over = d >= f.days;
    const day = Math.min(d, f.days - 1);
    const ref = window.FAST_REFS[day % window.FAST_REFS.length];
    return `
      <section class="fast-card active">
        <div class="fast-top">
          <div><div class="eyebrow">🍞 ${esc(typeName(f.type))}</div>
          <h2>${over ? 'Your fast is complete' : `Day ${day + 1} of ${f.days}`}</h2>
          ${f.focus ? `<p class="fast-focus">Seeking God for: <b>${esc(f.focus)}</b></p>` : ''}</div>
          <div class="fast-ring" style="--p:${Math.min(1, (d + (over ? 0 : 0.5)) / f.days)}"><span>${Math.min(d + 1, f.days)}/${f.days}</span></div>
        </div>
        <div class="vref" data-ref="${esc(ref)}"></div>
        <label class="flabel" for="fNote">What is God showing you today?</label>
        <textarea class="notes" id="fNote" placeholder="Write a few words…">${esc(f.notes[day] || '')}</textarea>
        <div class="muted small" id="fSaved">Saved on this device.</div>
        <p class="muted small">When hunger comes, let it turn you to prayer. "Man shall not live by bread alone." (Matthew 4:4)</p>
        <div class="row gap end wrap">
          ${over ? '' : '<button class="btn ghost" id="fEnd">End early</button>'}
          ${d >= f.days - 1 ? `<button class="btn primary" id="fDone">${over ? '✓ Finish and remember it' : '✓ I have completed my fast'}</button>` : `<span class="muted small">${f.days - d - 1} more day${f.days - d - 1 === 1 ? '' : 's'} to go. Come back each day for a new scripture.</span>`}
        </div>
      </section>`;
  }

  function bindActive(host, f) {
    const day = Math.min(dayIndex(f), f.days - 1);
    window.Grow.fillRefs(host);
    let t;
    host.querySelector('#fNote').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { f.notes[day] = e.target.value; save(); const s = host.querySelector('#fSaved'); if (s) s.textContent = '✓ Saved'; }, 400);
    });
    const end = host.querySelector('#fEnd');
    if (end) end.addEventListener('click', async () => {
      if (!(await window.UI.ask('End this fast now? There is no shame in stopping. God sees your heart.', 'End fast'))) return;
      f.status = 'ended'; f.endedAt = Date.now(); save();
      toast('Fast ended. Well done for seeking Him.');
      render(host);
    });
    const done = host.querySelector('#fDone');
    if (done) done.addEventListener('click', () => {
      f.status = 'done'; f.endedAt = Date.now();
      state.milestones.push({ id: 'm' + Date.now(), date: window.Core.dateKey(), title: `Completed a ${f.days}-day fast (${typeName(f.type)})`, story: f.focus ? `Sought the Lord for: ${f.focus}` : '', ref: 'Matthew 6:18', kind: 'fast' });
      save();
      Sound.play('complete');
      window.Core.addXP(30, 'Fast completed');
      toast('🪨 Added to your Ebenezer timeline', 'level');
      render(host);
    });
  }

  window.Fast = { render, active, dayIndex };
})();
