/*
 * Study helps: cross-references, book overviews, and a map of Bible places.
 */
(function () {
  'use strict';
  const { escapeHTML: esc, Sound } = window.Core;
  const $ = s => document.querySelector(s);
  const B = () => window.Bible;
  const UI = () => window.UI;
  const lordHTML = t => esc(t).replace(/LORD/g, '<span class="sc">Lord</span>');

  /* ---------------- Cross-references (OpenBible.info) ---------------- */
  const xrefs = {}, waiting = {};
  function _xref(b, data) { xrefs[b] = data; (waiting[b] || []).forEach(w => w.res(data)); delete waiting[b]; }
  function loadXref(b) {
    if (xrefs[b]) return Promise.resolve(xrefs[b]);
    return new Promise((res, rej) => {
      if (waiting[b]) { waiting[b].push({ res, rej }); return; }
      waiting[b] = [{ res, rej }];
      const fail = () => { const w = waiting[b] || []; delete waiting[b]; w.forEach(x => x.rej(new Error('Could not load cross-references. Check your connection.'))); };
      const nn = String(b + 1).padStart(2, '0');
      const s = document.createElement('script');
      const inline = document.getElementById('xref-src-' + nn);
      if (window.BIBLE_BUNDLES) { if (!loadXref.bundle) { loadXref.bundle = true; s.src = window.BIBLE_BUNDLES + 'xref.js'; s.onerror = () => { loadXref.bundle = false; fail(); }; document.head.appendChild(s); } return; }
      if (inline) { s.textContent = inline.textContent; document.head.appendChild(s); return; }
      s.src = `js/xref/${nn}.js`; s.async = true; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  const parseX = r => { const [b, c, v] = r.split('.'); const [v1, v2] = v.split('-').map(Number); return { b: +b, c: +c, v1, v2: v2 || v1 }; };

  async function crossRefs(b, c, v) {
    UI().openModal('<div class="xrefs"><p class="muted">Finding related verses…</p></div>', { cls: 'parchment' });
    let list;
    try { const data = await loadXref(b); list = (data[c - 1] && data[c - 1][v - 1] || '').split(' ').filter(Boolean).map(parseX); }
    catch (e) { $('#modalBody').innerHTML = `<div class="xrefs"><p class="muted">${esc(e.message)}</p></div>`; return; }
    await Promise.all([...new Set([b, ...list.map(x => x.b)])].map(i => B().load(i))).catch(() => null);
    if (!document.querySelector('#modal:not(.hidden) #modalBody .xrefs')) return;
    const text = (x) => { const out = []; for (let n = x.v1; n <= x.v2 && n < x.v1 + 4; n++) out.push(B().text(x.b, x.c, n) || ''); return out.join(' ') + (x.v2 >= x.v1 + 4 ? ' …' : ''); };
    $('#modalBody').innerHTML = `
      <div class="xrefs">
        <div class="eyebrow">Cross-references</div>
        <h2>${esc(B().refString(b, c, v, v))}</h2>
        <blockquote class="scripture">${lordHTML(B().text(b, c, v) || '')}</blockquote>
        ${list.length ? `<p class="muted small">Scripture explains Scripture. These are the verses Bible readers most often link to this one.</p>
          <div class="results">${list.map(x => `<button class="result-item" data-b="${x.b}" data-c="${x.c}" data-v="${x.v1}" data-v2="${x.v2}"><b>${esc(B().refString(x.b, x.c, x.v1, x.v2))}</b><span>${lordHTML(text(x))}</span></button>`).join('')}</div>`
          : '<p class="muted">No cross-references are listed for this verse.</p>'}
        <p class="muted small">Cross-references: OpenBible.info (CC BY).</p>
      </div>`;
    document.querySelectorAll('#modalBody .result-item').forEach(el => el.addEventListener('click', () => { UI().closeModal(); window.Reader.open(+el.dataset.b, +el.dataset.c, +el.dataset.v, +el.dataset.v2); }));
  }

  /* ---------------- Book overviews ---------------- */
  function overviewHTML(b) {
    const o = window.OVERVIEWS[b];
    const name = B().NAMES[b];
    const chRange = r => r.includes(':') ? `${r}` : (r.includes('-') ? `Chapters ${r}` : `Chapter ${r}`);
    const firstCh = r => +String(r).split(/[-:]/)[0];
    return `
      <div class="overview">
        <div class="eyebrow">${b < 39 ? 'Old' : 'New'} Testament · ${esc(window.BOOKS[b][1])} · book ${b + 1} of 66</div>
        <h2>${esc(name)}</h2>
        <p class="lead">${esc(o.theme)}</p>
        <div class="ov-facts"><div><b>Written by</b><span>${esc(o.author)}</span></div><div><b>When</b><span>${esc(o.date)}</span></div><div><b>Chapters</b><span>${B().CHAPTERS[b]}</span></div></div>
        <h3 class="section-title">Outline</h3>
        <ol class="ov-outline">${o.outline.map(([t, r]) => `<li><button class="ov-sec" data-c="${firstCh(r)}"><span>${esc(t)}</span><small>${esc(chRange(r))}</small></button></li>`).join('')}</ol>
        <h3 class="section-title">Key verse</h3>
        <div class="vref" data-ref="${esc(o.key)}" data-plain="1"><p class="muted small">${esc(o.key)}…</p></div>
        <div class="row gap wrap"><button class="btn primary" id="ovRead">📖 Start reading ${esc(name)}</button></div>
        <p class="muted small">Authors and dates follow the traditional view; where they are uncertain, the overview says so.</p>
      </div>`;
  }
  function overview(b) {
    UI().openModal(overviewHTML(b), { cls: 'parchment' });
    window.Grow.fillRefs($('#modalBody'));
    document.querySelectorAll('#modalBody .ov-sec').forEach(el => el.addEventListener('click', () => { UI().closeModal(); window.Reader.open(b, +el.dataset.c); }));
    $('#ovRead').addEventListener('click', () => { UI().closeModal(); window.Reader.open(b, 1); });
  }

  /* ---------------- Map of Bible places ---------------- */
  let mapView = null;
  function renderMap(host) {
    const P = window.PLACES;
    host.innerHTML = `
      <p class="muted">The lands of the Bible, with today’s borders drawn faintly. Tap a place to read what happened there. Drag to move, pinch or use ＋ and － to zoom.</p>
      <div class="map-wrap">
        <canvas id="bibleMap" aria-label="Map of Bible places"></canvas>
        <div class="map-btns">
          <button class="icon-btn sm" id="mapIn" aria-label="Zoom in">＋</button>
          <button class="icon-btn sm" id="mapOut" aria-label="Zoom out">－</button>
          <button class="icon-btn sm" id="mapHoly" title="The Holy Land" aria-label="Show the Holy Land">✡</button>
          <button class="icon-btn sm" id="mapAll" title="The whole Bible world" aria-label="Show the whole Bible world">🌍</button>
        </div>
      </div>
      <div id="mapInfo"></div>
      <input class="search" id="mapFind" placeholder="Find a place, e.g. Bethlehem, Ephesus">
      <div class="place-list" id="placeList"></div>
      <p class="muted small">Map: Natural Earth (public domain). Sites marked "probable" or "traditional" are not certain.</p>`;
    const list = host.querySelector('#placeList');
    const drawList = q => {
      const f = (q || '').toLowerCase();
      list.innerHTML = P.filter(p => !f || (p[0] + ' ' + p[6] + ' ' + p[4]).toLowerCase().includes(f)).map(p => `<button class="place-item" data-p="${esc(p[0])}"><b>${esc(p[0])}</b><small>${esc(p[6])}</small></button>`).join('') || '<p class="muted">No place found.</p>';
      list.querySelectorAll('.place-item').forEach(el => el.addEventListener('click', () => { select(P.find(p => p[0] === el.dataset.p), true); host.querySelector('.map-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    };
    drawList('');
    host.querySelector('#mapFind').addEventListener('input', e => drawList(e.target.value));

    const canvas = host.querySelector('#bibleMap');
    const ctx = canvas.getContext('2d');
    const M = window.MAP_SHAPES;
    const K = Math.cos(33 * Math.PI / 180);       // keep shapes true at the latitude of the Holy Land
    const view = mapView || { lon: 35.4, lat: 31.9, z: 0 };   // z: pixels per degree of latitude (0 = fit)
    mapView = view;
    let W = 0, H = 0, dpr = 1, selected = null;
    const fitAll = () => { view.lon = 31; view.lat = 34; view.z = 0; };
    const fitHoly = () => { view.lon = 35.35; view.lat = 31.95; view.z = Math.min(W / (3.4 * K), H / 3.6); };
    const X = lon => W / 2 + (lon - view.lon) * K * view.z;
    const Y = lat => H / 2 - (lat - view.lat) * view.z;
    // never show beyond the edge of the map data
    const minZ = () => Math.max(W / ((M.bbox[2] - M.bbox[0]) * K), H / (M.bbox[3] - M.bbox[1]));
    const clamp = () => {
      view.z = Math.max(minZ(), Math.min(view.z, 900));
      const hw = W / 2 / (K * view.z), hh = H / 2 / view.z;
      view.lon = Math.max(M.bbox[0] + hw, Math.min(M.bbox[2] - hw, view.lon));
      view.lat = Math.max(M.bbox[1] + hh, Math.min(M.bbox[3] - hh, view.lat));
    };
    function size() {
      const r = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      if (!view.z) fitHoly();
      clamp(); draw();
    }
    function path(flat, close) {
      ctx.beginPath();
      for (let i = 0; i < flat.length; i += 2) { const x = X(flat[i]), y = Y(flat[i + 1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      if (close) ctx.closePath();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#a9cfe3'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f1e6c8'; ctx.strokeStyle = '#9c8456'; ctx.lineWidth = 1;
      M.land.forEach(r => { path(r, true); ctx.fill(); ctx.stroke(); });
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(110, 80, 50, 0.35)'; ctx.lineWidth = 0.8;
      M.borders.forEach(r => { path(r, true); ctx.stroke(); }); ctx.restore();
      ctx.fillStyle = '#a9cfe3'; ctx.strokeStyle = '#6f9fbd';
      M.lakes.forEach(r => { path(r, true); ctx.fill(); ctx.stroke(); });
      ctx.strokeStyle = '#5f97bf'; ctx.lineWidth = Math.max(1, Math.min(2.5, view.z / 60));
      M.rivers.forEach(([, r]) => { path(r, false); ctx.stroke(); });
      // modern country names
      ctx.fillStyle = 'rgba(90, 70, 50, 0.45)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `italic ${Math.max(10, Math.min(15, view.z / 9))}px Inter, system-ui, sans-serif`;
      const labels = M.countries.filter(c => !/Vatican|Qatar|Bahrain|N\. Cyprus/.test(c[0])).concat([['Italy', 14.8, 41.2], ['Iran', 49.5, 34.0]]);
      labels.forEach(([n, lon, lat]) => { const x = X(lon), y = Y(lat); if (x > -50 && x < W + 50 && y > -20 && y < H + 20) ctx.fillText(n.toUpperCase(), x, y); });
      // places; labels that would overlap are left out (zoom in to see them)
      const fs = Math.max(11, Math.min(15, view.z / 6));
      const boxes = [];
      const order = window.PLACES.slice().sort((a, b) => (b === selected) - (a === selected));
      const labelled = new Set();
      ctx.font = `600 ${fs}px "EB Garamond", Georgia, serif`;
      order.forEach(p => {
        const x = X(p[2]), y = Y(p[1]);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
        const w = ctx.measureText(p[0]).width, r = [x + 6, y - 6 - fs * 0.8, x + 9 + w, y - 6 + fs * 0.3];
        if (boxes.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) return;
        boxes.push(r); labelled.add(p);
      });
      window.PLACES.forEach(p => {
        const x = X(p[2]), y = Y(p[1]);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
        const sel = selected === p;
        ctx.beginPath(); ctx.arc(x, y, sel ? 7 : p[3] === 'mountain' ? 4.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = sel ? '#c0392b' : p[3] === 'mountain' ? '#7a5a2a' : p[3] === 'water' ? '#2f6f9a' : '#b8741a';
        ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        if (labelled.has(p)) {
          ctx.font = `${sel ? '700 ' : '600 '}${fs}px "EB Garamond", Georgia, serif`;
          ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 250, 235, 0.9)'; ctx.fillStyle = '#3b2410';
          ctx.strokeText(p[0], x + 7, y - 6); ctx.fillText(p[0], x + 7, y - 6);
        }
      });
    }
    function select(p, center) {
      selected = p;
      if (!p) { host.querySelector('#mapInfo').innerHTML = ''; draw(); return; }
      if (center) { view.lon = p[2]; view.lat = p[1]; view.z = Math.max(view.z, 70); clamp(); }
      draw();
      Sound.play('tap');
      const info = host.querySelector('#mapInfo');
      info.innerHTML = `<section class="place-card">
        <div class="eyebrow">${{ city: 'City', mountain: 'Mountain', water: 'Water', island: 'Island' }[p[3]] || 'Place'} · today: ${esc(p[6])}</div>
        <h3>${esc(p[0])}</h3><p>${esc(p[4])}</p>
        ${p[5].map(r => `<div class="vref" data-ref="${esc(r)}"><p class="muted small">${esc(r)}…</p></div>`).join('')}
        <div class="row gap wrap"><button class="btn ghost small" id="placeSearch">🔎 Every mention of ${esc(p[0].replace(/\s*\(.*\)$/, '').replace(/^Mount /, ''))}</button></div>
      </section>`;
      window.Grow.fillRefs(info);
      info.querySelector('#placeSearch').addEventListener('click', () => window.Reader.openSearch(p[0].replace(/\s*\(.*\)$/, '').replace(/^Mount /, '').replace(/ River$/, '')));
    }
    // gestures
    const pts = new Map();
    let moved = false, last = null;
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); moved = false; last = null; });
    canvas.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pts.size === 1) {
        const dx = e.offsetX - prev[0], dy = e.offsetY - prev[1];
        if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
        view.lon -= dx / (K * view.z); view.lat += dy / view.z;
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (last) view.z *= d / last;
        last = d; moved = true;
      }
      clamp(); draw();
    });
    const up = e => {
      if (pts.size === 1 && !moved) {
        let best = null, bd = 18;
        window.PLACES.forEach(p => { const d = Math.hypot(X(p[2]) - e.offsetX, Y(p[1]) - e.offsetY); if (d < bd) { bd = d; best = p; } });
        select(best, false);
      }
      pts.delete(e.pointerId); if (pts.size < 2) last = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); last = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); view.z *= e.deltaY < 0 ? 1.15 : 1 / 1.15; clamp(); draw(); }, { passive: false });
    const zoom = f => { view.z *= f; clamp(); draw(); };
    host.querySelector('#mapIn').addEventListener('click', () => zoom(1.5));
    host.querySelector('#mapOut').addEventListener('click', () => zoom(1 / 1.5));
    host.querySelector('#mapHoly').addEventListener('click', () => { fitHoly(); clamp(); draw(); });
    host.querySelector('#mapAll').addEventListener('click', () => { fitAll(); clamp(); draw(); });
    requestAnimationFrame(size);
    if (window.ResizeObserver) new ResizeObserver(() => size()).observe(canvas);
  }

  window.Study = { _xref, loadXref, crossRefs, overview, overviewHTML, renderMap };
})();
