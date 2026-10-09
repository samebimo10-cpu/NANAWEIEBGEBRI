/*
 * Bible Story Quest: a short 2D side-scrolling adventure through 12 Bible stories.
 * Run and jump through each story, collect fact scrolls and lamps of light, and at
 * the end read the KJV passage and answer the quiz (handled by the app).
 * Everything is drawn in code on a canvas; no image files are needed.
 */
(function () {
  'use strict';
  const H = 540, GROUND = 430, WATER_Y = 476, L = 3000;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = s => document.querySelector(s);
  const esc = s => window.Core.escapeHTML(s);
  const S = () => window.STORIES;
  const J = id => window.JOURNEY.find(l => l.id === id);

  let canvas, ctx, dpr = 1, hooks = {}, running = false, ready = false, inputEnabled = true;
  let last = 0, time = 0, mode = 'menu', menuIdx = 0, celebrated = null;
  let lv = null;                       // current level
  const keys = { left: false, right: false, jump: false };
  let jumpBuffer = 0;
  // One-hand mode (default): the pilgrim walks forward by himself; tap anywhere to jump, hold to jump higher.
  const oneHand = () => window.Core.state.storyOneHand !== false;

  /* ================= Progress ================= */
  const done = () => window.Core.state.completed;
  function unlockedIdx(i) { return i === 0 || !!done()[S()[i].id] || !!done()[S()[i - 1].id]; }
  function isUnlocked(loc) { const i = S().findIndex(s => s.id === loc.id); return i < 0 ? true : unlockedIdx(i); }
  function progress() { const n = S().findIndex(s => !done()[s.id]); return { done: done(), next: n < 0 ? S().length : n }; }

  /* ================= Level building ================= */
  function build(i) {
    const st = S()[i], th = st.theme, R = window.Core.rng(4000 + i * 131);
    const kind = th.kind || 'land';
    const segs = [], plats = [], rocks = [], coins = [], scrolls = [], props = [];
    let x;
    if (kind === 'sea') {
      segs.push({ x: -40, w: 420, y: GROUND, dock: true });
      x = 380;
      let prevY = GROUND;
      while (x < L - 900) {
        // neighbouring boats stay close in height, and gaps are narrower when climbing up
        const w = 150 + R() * 80, y = clamp(prevY + (R() - 0.5) * 50, GROUND - 48, GROUND - 6);
        x += y < prevY - 12 ? 72 + R() * 18 : 78 + R() * 32;
        prevY = y;
        plats.push({ x, w, y, base: y, boat: true, phase: R() * 6, amp: 5 + R() * 6, dy: 0 });
        coins.push({ x: x + w / 2, y: y - 70 });
        x += w;
      }
      const shoreEnd = st.id === 'galilee' ? L - 210 : L + 200;   // Galilee ends on a jetty beside Jesus' boat
      segs.push({ x: x + 100, w: shoreEnd - (x + 100), y: GROUND - 6, shore: true, dock: st.id === 'galilee' });
    } else {
      let y = GROUND;
      segs.push({ x: -40, w: 460, y });
      x = 420;
      const c0 = L * 0.22, c1 = L * 0.8;
      while (x < L - 600) {
        const inCorridor = kind === 'redsea' && x > c0 && x < c1;
        let ny = inCorridor ? GROUND + 10 + (R() - 0.5) * 16 : clamp(y + (R() - 0.5) * 100, GROUND - 70, GROUND + 15);
        if (ny < y - 44) ny = y - 44;
        // gaps stay comfortably jumpable; narrower when the far side is higher
        let gap = (!inCorridor && R() < 0.5) ? 80 + R() * 40 : 0;
        if (gap && ny < y - 10) gap = Math.min(gap, 85);
        if (gap) {
          for (let k = 0; k < 3; k++) coins.push({ x: x + gap * (k + 1) / 4, y: Math.min(y, ny) - 60 - Math.sin((k + 1) / 4 * Math.PI) * 50 });
          x += gap;
        }
        const w = 240 + R() * 300;
        segs.push({ x, w, y: ny });
        // rocks sit in the middle of wide ground, with room to land after jumping them
        if (w > 400 && R() < 0.65) rocks.push({ x: x + 140 + R() * (w - 420), w: 34 + R() * 18, h: 26 + R() * 20, y: ny });
        if (R() < 0.35) {
          const px = x + w * 0.3, py = ny - 115;
          plats.push({ x: px, w: 110, y: py, base: py, ledge: true, dy: 0 });
          for (let k = 0; k < 3; k++) coins.push({ x: px + 25 + k * 30, y: py - 34 });
        } else for (let k = 0; k < 3; k++) coins.push({ x: x + w * 0.55 + k * 34, y: ny - 46 });
        for (let px = x + 50; px < x + w - 40; px += 120 + R() * 90) props.push({ x: px, y: ny, type: th.props[Math.floor(R() * th.props.length)], s: 0.8 + R() * 0.5, seed: R() });
        y = ny; x += w;
      }
      segs.push({ x, w: L + 200 - x, y: GROUND - 6, final: true });
    }
    const goalX = L - 250;
    const level = { i, st, th, kind, segs, plats, rocks, coins, scrolls, props, goalX, coinCount: 0, scrollCount: 0,
      parts: [], fx: [], finishT: 0, weather: 1, flash: 0, nextFlash: 4, falls: 0 };
    // three fact scrolls along the way
    [0.24, 0.5, 0.74].forEach((f, k) => {
      const sx = L * f;
      // on the main path (ground or a boat), never on an optional ledge, so nobody misses a fact
      const path = segs.concat(plats.filter(q => q.boat)).filter(o => o.w > 80);
      let o = path.find(g => sx >= g.x + 30 && sx <= g.x + g.w - 30);
      if (!o) o = path.reduce((b, g) => Math.abs(g.x + g.w / 2 - sx) < Math.abs(b.x + b.w / 2 - sx) ? g : b);
      const px = o.x + clamp(sx - o.x, 40, o.w - 40);
      level.rocks.forEach(r => { if (Math.abs(r.x - px) < 50) r.x = clamp(r.x + 110, o.x + 60, o.x + o.w - 60); });
      scrolls.push({ x: px, y: o.y - 46, k, got: false, o });
    });
    level.coins.forEach(c => { c.got = false; c.ph = R() * 6; });
    return level;
  }

  function surfaceAt(level, x, snap) {
    let best = null;
    const consider = (o, top) => { if (x >= o.x && x <= o.x + o.w && (!best || top < best.y)) best = { x, y: top, o }; };
    level.segs.forEach(s => consider(s, s.y));
    level.plats.forEach(p => consider(p, p.y));
    if (!best && snap) {
      let nd = 1e9;
      level.plats.concat(level.segs).forEach(o => { const cx = o.x + o.w / 2, d = Math.abs(cx - x); if (d < nd) { nd = d; best = { x: cx, y: o.y, o }; } });
    }
    return best || { x, y: GROUND };
  }

  /* ================= Player ================= */
  const P = { x: 80, y: GROUND, vx: 0, vy: 0, w: 24, h: 58, onGround: true, ground: null, facing: 1, coyote: 0, anim: 0, land: 0, blink: 0, safe: null };

  function spawn() {
    Object.assign(P, { x: 90, y: GROUND, vx: 0, vy: 0, onGround: true, ground: lv.segs[0], facing: 1, coyote: 0, anim: 0, land: 0, blink: 0, safe: { o: lv.segs[0], dx: 130 } });
    camX = 0;
  }

  /* ================= Input ================= */
  function bindInput() {
    const map = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'jump', w: 'jump', ' ': 'jump', enter: 'jump' };
    window.addEventListener('keydown', e => {
      if (!running || mode !== 'play' || !inputEnabled) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = map[e.key.toLowerCase()];
      if (!k) return;
      e.preventDefault();
      if (k === 'jump' && !keys.jump) { jumpBuffer = 0.14; hideHint(); }
      keys[k] = true;
    });
    window.addEventListener('keyup', e => { const k = map[e.key.toLowerCase()]; if (k) keys[k] = false; });
    window.addEventListener('blur', resetKeys);
    document.querySelectorAll('#sqTouch [data-k]').forEach(b => {
      const k = b.dataset.k;
      const on = e => { e.preventDefault(); if (k === 'jump' && !keys.jump) jumpBuffer = 0.14; keys[k] = true; b.classList.add('down'); };
      const off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', on);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, off));
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    $('#sqBack').addEventListener('click', () => { window.Core.Sound.play('tap'); showMenu(); });
    const tapDown = e => {
      if (mode !== 'play' || !oneHand() || !inputEnabled) return;
      e.preventDefault();
      if (!keys.jump) jumpBuffer = 0.14;
      keys.jump = true; hideHint();
    };
    const tapUp = () => { if (oneHand()) keys.jump = false; };
    canvas.addEventListener('pointerdown', tapDown);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => canvas.addEventListener(ev, tapUp));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  function resetKeys() { keys.left = keys.right = keys.jump = false; jumpBuffer = 0; document.querySelectorAll('#sqTouch .down').forEach(b => b.classList.remove('down')); }

  /* ================= Update ================= */
  let camX = 0;
  function update(dt) {
    time += dt;
    if (!lv) return;
    // moving boats
    lv.plats.forEach(p => { if (p.boat) { const ny = p.base + Math.sin(time * 1.7 + p.phase) * p.amp * (lv.weather * 0.8 + 0.2); p.dy = ny - p.y; p.y = ny; } });
    if (mode === 'play') physics(dt);
    if (mode === 'finishing') {
      lv.finishT += dt;
      if (lv.finishT > 2.4) {
        const go = () => { mode = 'awaiting'; hooks.onFinish && hooks.onFinish(J(lv.st.id), { scrolls: lv.scrollCount, coins: lv.coinCount }); };
        const missed = lv.scrolls.filter(sc => !sc.got).map(sc => lv.st.facts[sc.k]);
        if (missed.length) {
          mode = 'fact';
          showCard(`<div class="sq-eyebrow">📜 Scrolls you passed by</div>${missed.map(f => `<p class="sq-fact small">${esc(f.text).replace(/LORD/g, '<span class="sc">Lord</span>')} <span class="sq-ref">${esc(f.ref)}</span></p>`).join('')}`, 'Read the passage ▶', go);
        } else go();
      }
    }
    if (lv.th.calm && mode !== 'play') lv.weather = Math.max(0, lv.weather - dt * 0.8);
    if (lv.th.rainbow) lv.weather = mode === 'play' ? clamp(1 - prog() * 0.9, 0.1, 1) : Math.max(0, lv.weather - dt * 0.5);
    // camera
    const viewW = canvas.width / scale();
    const target = mode === 'menu' ? camX + 26 * dt : P.x - viewW * 0.36 + P.facing * 30;
    camX = mode === 'menu' ? (camX + 26 * dt) % (L - viewW) : lerp(camX, clamp(target, 0, L - viewW), Math.min(1, dt * 5));
    // particles
    for (let k = lv.parts.length - 1; k >= 0; k--) {
      const p = lv.parts[k];
      p.t += dt;
      if (p.t > p.life) { lv.parts.splice(k, 1); continue; }
      p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    // lightning
    if (lv.th.weather === 'storm' && lv.weather > 0.3) {
      lv.nextFlash -= dt;
      if (lv.nextFlash < 0) { lv.flash = 1; lv.nextFlash = 4 + Math.random() * 5; }
    }
    lv.flash = Math.max(0, lv.flash - dt * 2.5);
  }

  function physics(dt) {
    if (!inputEnabled) resetKeys();
    // ride a moving boat
    if (P.onGround && P.ground && P.ground.boat) P.y += P.ground.dy;
    const dir = oneHand() ? (keys.left ? -1 : 1) : (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) { P.vx += dir * (P.onGround ? 2300 : 1500) * dt; P.facing = dir; }
    else { const fr = (P.onGround ? 2600 : 420) * dt; P.vx = Math.abs(P.vx) <= fr ? 0 : P.vx - Math.sign(P.vx) * fr; }
    const top = oneHand() && !keys.right ? 262 : 285;   // a steady, easy walking pace in one-hand mode
    P.vx = clamp(P.vx, -top, top);
    P.coyote = P.onGround ? 0.1 : Math.max(0, P.coyote - dt);
    if (jumpBuffer > 0 && P.coyote > 0) {
      P.vy = -690; P.onGround = false; P.coyote = 0; jumpBuffer = 0;
      window.Core.Sound.play('jump'); puff(P.x, P.y, 6);
    }
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (!keys.jump && P.vy < -260) P.vy = -260;      // tap for a small hop, hold for a high jump
    P.vy = Math.min(P.vy + 1850 * dt, 1100);
    // horizontal
    P.x += P.vx * dt;
    const solids = lv.segs.map(s => ({ x: s.x, y: s.y, w: s.w, h: 2000 })).concat(lv.rocks.map(r => ({ x: r.x - r.w / 2, y: r.y - r.h, w: r.w, h: r.h })));
    solids.forEach(s => {
      if (P.y > s.y + 2 && P.y - P.h < s.y + s.h && P.x + P.w / 2 > s.x && P.x - P.w / 2 < s.x + s.w) {
        if (P.vx > 0 || P.x < s.x + s.w / 2) P.x = s.x - P.w / 2; else P.x = s.x + s.w + P.w / 2;
        P.vx = 0;
      }
    });
    P.x = clamp(P.x, 16, L - 16);
    // vertical
    const prev = P.y, wasGround = P.onGround;
    P.y += P.vy * dt;
    P.onGround = false;
    if (P.vy >= 0) {
      const tops = solids.concat(lv.plats.map(p => ({ x: p.x, y: p.y, w: p.w, o: p })));
      tops.forEach(s => {
        if (P.x + P.w / 2 - 4 > s.x && P.x - P.w / 2 + 4 < s.x + s.w && prev <= s.y + 6 + (s.o && s.o.boat ? Math.abs(s.o.dy) + 2 : 0) && P.y >= s.y) {
          P.y = s.y; P.vy = 0; P.onGround = true; P.ground = s.o || lv.segs.find(g => g.x === s.x) || lv.rocks.find(r => r.x - r.w / 2 === s.x) || null;
        }
      });
    }
    if (P.onGround && !wasGround) { P.land = 0.12; puff(P.x, P.y, 8); }
    if (P.onGround && P.ground && P.ground.w > 60) P.safe = { o: P.ground, dx: clamp(P.x - P.ground.x, 30, P.ground.w - 30) };
    P.land = Math.max(0, P.land - dt);
    P.blink = Math.max(0, P.blink - dt);
    // walking animation and dust
    if (P.onGround && Math.abs(P.vx) > 20) { P.anim += dt * Math.abs(P.vx) / 22; if (Math.random() < dt * 8) puff(P.x - P.facing * 8, P.y, 1); }
    else if (P.onGround) P.anim = lerp(P.anim, Math.round(P.anim / Math.PI) * Math.PI, dt * 10);
    // fell into the sea or a gap: gently return to the last safe ground
    if (P.y > H + 90) {
      splash(P.x, WATER_Y);
      lv.falls++; (lv.fallX = lv.fallX || []).push(Math.round(P.x));
      const s = P.safe || { o: lv.segs[0], dx: 130 };
      // put the pilgrim back with room for a run-up before the gap (the middle of a boat)
      P.x = s.o.boat ? s.o.x + s.o.w / 2 : s.o.x + clamp(s.dx, 30, Math.max(30, s.o.w - 170)); P.y = s.o.y; P.vx = 0; P.vy = 0; P.blink = 1.2; P.onGround = true; P.ground = s.o;
      window.Core.Sound.play('wrong');
    }
    // lamps of light
    lv.coins.forEach(c => {
      if (!c.got && Math.abs(c.x - P.x) < 22 && Math.abs(c.y - (P.y - 30)) < 36) {
        c.got = true; lv.coinCount++; window.Core.Sound.play('coin');
        for (let k = 0; k < 10; k++) lv.parts.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160, g: 300, t: 0, life: 0.6, c: '255,225,140', r: 2.2 });
        hud();
      }
    });
    // fact scrolls
    lv.scrolls.forEach(sc => {
      if (!sc.got && Math.abs(sc.x - P.x) < 28 && Math.abs(sc.y - (P.y - 30)) < 50) {
        sc.got = true; lv.scrollCount++; hud(); showFact(sc.k);
      }
    });
    // reached the end of the story
    if (P.x >= lv.goalX - 70) startFinish();
  }

  function puff(x, y, n) { for (let k = 0; k < n; k++) lv.parts.push({ x: x + (Math.random() - 0.5) * 14, y: y - 2, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, g: 60, t: 0, life: 0.5, c: '220,200,160', r: 3 + Math.random() * 3, dust: 1 }); }
  function splash(x, y) { for (let k = 0; k < 22; k++) lv.parts.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 260, g: 900, t: 0, life: 0.9, c: '200,235,255', r: 2.5 }); }
  const prog = () => clamp(P.x / lv.goalX, 0, 1);

  /* ================= Finish & set pieces ================= */
  function startFinish() {
    if (mode !== 'play') return;
    mode = 'finishing'; lv.finishT = 0; lv.finished = true; resetKeys(); hideHint();
    P.vx = 0;
    const id = lv.st.id;
    window.Core.Sound.play(id === 'jericho' ? 'level' : 'complete');
    if (id === 'jericho') {
      const gx = lv.goalX + 10, gy = surfaceAt(lv, lv.goalX + 60).y;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) lv.fx.push({ x: gx + c * 26, y: gy - 22 - r * 22, vx: (Math.random() - 0.3) * 120, vy: -Math.random() * 120, rot: 0, vr: (Math.random() - 0.5) * 6, delay: (5 - r) * 0.08 + Math.random() * 0.2 });
    }
    hideCard();
    $('#sqTouch').classList.add('hidden');
  }

  /* ================= Rendering ================= */
  // on narrow (portrait) screens zoom out so at least ~600 units of the path are visible; extra height becomes sky
  const scale = () => Math.min(canvas.height / H, canvas.width / 440);
  function render() {
    const s = scale(), cw = canvas.width, chh = canvas.height;
    const viewW = cw / s, viewH = chh / s, extra = Math.max(0, viewH - H), offY = extra * 0.62, Y0 = -offY;   // extra height: most above as sky, some below as earth
    const th = lv.th, p = mode === 'menu' ? 0.4 : prog();
    ctx.setTransform(s, 0, 0, s, 0, offY * s);
    // sky
    let top = th.sky[0], bot = th.sky[1];
    const g = ctx.createLinearGradient(0, Y0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, Y0, viewW, viewH);
    if (th.calm) { ctx.fillStyle = `rgba(150,190,230,${(1 - lv.weather) * 0.5})`; ctx.fillRect(0, Y0, viewW, viewH); }
    if (th.sun === 'sunrise') { const w = ctx.createLinearGradient(0, H * 0.3, 0, H); w.addColorStop(0, 'rgba(255,170,90,0)'); w.addColorStop(1, `rgba(255,180,110,${0.25 + p * 0.45})`); ctx.fillStyle = w; ctx.fillRect(0, Y0, viewW, viewH); }
    drawStars(viewW, th);
    drawSun(viewW, th, p);
    drawClouds(viewW, th);
    drawRange(viewW, 0.15, 290, [44, 22, 11], th.far, 0.55, 11);
    drawRange(viewW, 0.42, 360, [30, 16, 8], th.mid, 0.25, 37, th);
    // world layer
    ctx.save(); ctx.translate(-camX, 0);
    if (lv.kind === 'redsea') drawSeaWalls(viewW);
    drawWater(viewW);
    if (th.fish) drawFish();
    lv.props.forEach(pr => { if (pr.x > camX - 80 && pr.x < camX + viewW + 80) drawProp(pr); });
    lv.segs.forEach(sg => { if (sg.x + sg.w > camX - 10 && sg.x < camX + viewW + 10) drawSeg(sg, th); });
    lv.rocks.forEach(r => { if (r.x > camX - 60 && r.x < camX + viewW + 60) drawRock(r); });
    lv.plats.forEach(pl => { if (pl.x + pl.w > camX && pl.x < camX + viewW) pl.boat ? drawBoat(pl) : drawLedge(pl, th); });
    drawGoal();
    lv.coins.forEach(c => { if (!c.got && c.x > camX - 20 && c.x < camX + viewW + 20) drawLamp(c); });
    lv.scrolls.forEach(sc => { if (!sc.got) drawScroll(sc); });
    if (mode !== 'menu') drawPlayer();
    lv.parts.forEach(pt => {
      const a = 1 - pt.t / pt.life;
      ctx.globalAlpha = pt.dust ? a * 0.45 : a;
      ctx.fillStyle = `rgb(${pt.c})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * (pt.dust ? 1 + pt.t * 2 : 1), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawFallingWall();
    ctx.restore();
    // weather & light
    drawWeather(viewW, th);
    if (th.dawn && mode !== 'menu') {
      const dark = (1 - p) * 0.78;
      if (dark > 0.01) {
        const px = P.x - camX, py = P.y - 30;
        const gr = ctx.createRadialGradient(px, py, 30, px, py, 260);
        gr.addColorStop(0, `rgba(5,8,25,${dark * 0.15})`); gr.addColorStop(1, `rgba(5,8,25,${dark})`);
        ctx.fillStyle = gr; ctx.fillRect(0, Y0, viewW, viewH);
      }
    }
    if (th.dark && !lv.finished) { ctx.fillStyle = 'rgba(20,5,10,0.28)'; ctx.fillRect(0, Y0, viewW, viewH); }
    if (lv.flash > 0) { ctx.fillStyle = `rgba(230,240,255,${lv.flash * 0.55})`; ctx.fillRect(0, Y0, viewW, viewH); }
    // vignette
    const v = ctx.createRadialGradient(viewW / 2, H / 2, H * 0.4, viewW / 2, H / 2, viewW * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v; ctx.fillRect(0, Y0, viewW, viewH);
  }

  // seeded star field
  let starField = null;
  function drawStars(viewW, th) {
    if (!th.stars && !th.dawn) return;
    if (!starField) { const R = window.Core.rng(9); starField = Array.from({ length: 140 }, () => ({ x: R() * 2400, y: R() * 300, r: 0.5 + R() * 1.4, p: R() * 6 })); }
    const a = th.dawn ? (1 - prog()) : 1;
    starField.forEach(st => {
      const x = ((st.x - camX * 0.03) % 2400 + 2400) % 2400;
      if (x > viewW) return;
      ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(time * 2 + st.p));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (th.bigStar) {
      const sx = lv.goalX - camX * 1 + 120, sy = 70;
      const bx = clamp(sx, viewW * 0.55, viewW - 60);
      const gl = ctx.createRadialGradient(bx, sy, 0, bx, sy, 90);
      gl.addColorStop(0, 'rgba(255,250,220,0.95)'); gl.addColorStop(0.2, 'rgba(255,240,180,0.35)'); gl.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, sy, 90, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(bx, sy); ctx.rotate(time * 0.15); ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 4 : (k % 4 === 0 ? 34 : 14), an = k / 16 * Math.PI * 2; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  function drawSun(viewW, th, p) {
    if (th.sun === 'none' || !th.sun) return;
    let x = viewW * 0.78 - camX * 0.02, y = 105, r = 34, col = '255,236,170';
    if (th.sun === 'sunrise') { y = 300 - p * 190 - (lv.finished ? 40 : 0); col = '255,200,120'; r = 40; }
    if (th.dawn) { x = viewW * 0.82; y = 330 - p * 230; }
    if (th.sun === 'dim') { col = '170,60,50'; }
    if (th.sun === 'moon') {
      ctx.fillStyle = 'rgba(240,240,220,0.95)'; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.sky[0]; ctx.beginPath(); ctx.arc(x + 11, y - 7, 23, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    gl.addColorStop(0, `rgba(${col},0.9)`); gl.addColorStop(0.25, `rgba(${col},0.35)`); gl.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function drawClouds(viewW, th) {
    const storm = th.weather === 'storm' || th.weather === 'rain';
    for (let k = 0; k < 7; k++) {
      const w = 160 + (k * 53) % 120, y = 40 + (k * 37) % 120;
      const x = ((k * 420 - camX * 0.22 + time * (6 + k)) % (viewW + 600) + viewW + 600) % (viewW + 600) - 300;
      ctx.fillStyle = storm ? `rgba(60,66,80,${0.55 * lv.weather + 0.15})` : 'rgba(255,255,255,0.22)';
      for (let b = 0; b < 4; b++) { ctx.beginPath(); ctx.ellipse(x + b * w / 4, y + (b % 2) * 8, w / 3.2, 22 + (b % 3) * 6, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // a scrolling silhouette range with optional props on top
  function drawRange(viewW, par, base, amps, color, haze, seed, th) {
    const off = camX * par;
    const hAt = x => base - (Math.sin(x * 0.0042 + seed) * amps[0] + Math.sin(x * 0.011 + seed * 2) * amps[1] + Math.sin(x * 0.027 + seed * 3) * amps[2]);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, H + 400);
    for (let sx = 0; sx <= viewW + 8; sx += 8) ctx.lineTo(sx, hAt(sx + off));
    ctx.lineTo(viewW, H + 400); ctx.closePath(); ctx.fill();
    if (th) {
      // silhouettes of trees/houses on the mid hills
      const cell = 170;
      const first = Math.floor(off / cell) - 1;
      for (let c = first; c < first + viewW / cell + 3; c++) {
        const R = window.Core.rng(c * 7919 + seed);
        if (R() < 0.45) continue;
        const wx = c * cell + R() * cell, sx = wx - off;
        const type = th.props[Math.floor(R() * th.props.length)];
        drawSilhouette(type, sx, hAt(wx) + 4, 0.55 + R() * 0.3, shade(color, -0.25));
      }
    }
    const hz = ctx.createLinearGradient(0, base - 80, 0, H);
    hz.addColorStop(0, hexA(lv.th.sky[1], 0)); hz.addColorStop(1, hexA(lv.th.sky[1], haze));
    ctx.fillStyle = hz; ctx.fillRect(0, base - 80, viewW, H + 400);
  }

  function drawSilhouette(type, x, y, s, col) {
    ctx.fillStyle = col;
    if (type === 'palm') {
      ctx.fillRect(x - 2 * s, y - 60 * s, 4 * s, 60 * s);
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x + Math.cos(k * 1.3) * 16 * s, y - 62 * s + Math.sin(k * 1.3) * 5 * s, 18 * s, 5 * s, k * 1.3, 0, Math.PI * 2); ctx.fill(); }
    } else if (type === 'cedar') {
      ctx.beginPath(); ctx.moveTo(x, y - 70 * s); ctx.lineTo(x + 24 * s, y); ctx.lineTo(x - 24 * s, y); ctx.fill();
    } else if (type === 'house' || type === 'tent') {
      ctx.fillRect(x - 18 * s, y - 26 * s, 36 * s, 26 * s);
      if (type === 'tent') { ctx.beginPath(); ctx.moveTo(x - 24 * s, y); ctx.lineTo(x, y - 34 * s); ctx.lineTo(x + 24 * s, y); ctx.fill(); }
    } else {
      ctx.beginPath(); ctx.arc(x, y - 22 * s, 20 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 3 * s, y - 22 * s, 6 * s, 22 * s);
    }
  }

  function drawWater(viewW) {
    const storm = lv.th.weather === 'storm' ? lv.weather : 0;
    const amp = 4 + storm * 12;
    const x0 = camX - 20, x1 = camX + viewW + 20;
    const gr = ctx.createLinearGradient(0, WATER_Y - 20, 0, H);
    gr.addColorStop(0, lv.th.dark ? '#3a4a5a' : storm ? '#2f5068' : '#3f8fb8'); gr.addColorStop(1, '#0f2f4a');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x0, H + 400);
    for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, WATER_Y + Math.sin(x * 0.03 + time * 2.4) * amp + Math.sin(x * 0.011 - time * 1.3) * amp * 0.6);
    ctx.lineTo(x1, H + 400); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 10) { const y = WATER_Y + Math.sin(x * 0.03 + time * 2.4) * amp + Math.sin(x * 0.011 - time * 1.3) * amp * 0.6; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }

  function drawSeaWalls(viewW) {
    const c0 = L * 0.22, c1 = L * 0.8;
    if (c1 < camX || c0 > camX + viewW) return;
    const gr = ctx.createLinearGradient(0, 40, 0, GROUND);
    gr.addColorStop(0, 'rgba(70,160,210,0.95)'); gr.addColorStop(1, 'rgba(20,60,110,0.98)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(c0, GROUND + 20);
    ctx.quadraticCurveTo(c0 - 30, 160, c0 + 40, 70);
    for (let x = c0 + 40; x <= c1 - 40; x += 14) ctx.lineTo(x, 70 + Math.sin(x * 0.04 + time * 3) * 7);
    ctx.quadraticCurveTo(c1 + 30, 160, c1, GROUND + 20);
    ctx.closePath(); ctx.fill();
    // foam crest and fish inside the wall
    ctx.strokeStyle = 'rgba(230,250,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = c0 + 40; x <= c1 - 40; x += 14) { const y = 70 + Math.sin(x * 0.04 + time * 3) * 7; x === c0 + 40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,30,60,0.55)';
    for (let k = 0; k < 14; k++) {
      const fx = c0 + 80 + ((k * 151 + time * (20 + k * 3)) % (c1 - c0 - 160)), fy = 130 + (k * 47) % 230;
      ctx.beginPath(); ctx.ellipse(fx, fy, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - 12, fy); ctx.lineTo(fx - 20, fy - 6); ctx.lineTo(fx - 20, fy + 6); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.ellipse(c0 + 120 + k * 210, 200 + Math.sin(time + k) * 30, 60, 8, 0.3, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawFish() {
    const x = L * 0.45 + Math.sin(time * 0.3) * 300, y = WATER_Y + 40;
    ctx.fillStyle = 'rgba(15,30,45,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, 150, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 140, y); ctx.lineTo(x - 200, y - 32); ctx.lineTo(x - 196, y + 26); ctx.fill();
  }

  function drawSeg(sg, th) {
    const y = sg.y, x = sg.x, w = sg.w;
    const gr = ctx.createLinearGradient(0, y, 0, H + 200);
    gr.addColorStop(0, shade(th.ground, 0.1)); gr.addColorStop(1, shade(th.ground, -0.55));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x, H + 400); ctx.lineTo(x, y + 8); ctx.quadraticCurveTo(x, y, x + 8, y); ctx.lineTo(x + w - 8, y); ctx.quadraticCurveTo(x + w, y, x + w, y + 8); ctx.lineTo(x + w, H + 400); ctx.closePath(); ctx.fill();
    // strata and pebbles
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 6, y + k * 26 + 6); for (let xx = x + 6; xx < x + w - 6; xx += 30) ctx.lineTo(xx, y + k * 26 + 6 + Math.sin(xx * 0.05 + k) * 4); ctx.stroke(); }
    // top layer (grass / sand)
    ctx.fillStyle = th.top;
    ctx.beginPath(); ctx.moveTo(x, y + 10);
    for (let xx = x; xx <= x + w; xx += 12) ctx.lineTo(xx, y - 3 + Math.sin(xx * 0.3) * 2);
    ctx.lineTo(x + w, y + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(th.top, 0.25);
    ctx.fillRect(x + 4, y - 2, w - 8, 2);
    if (sg.dock) { ctx.fillStyle = '#7a5530'; for (let px = x + 20; px < x + w; px += 40) ctx.fillRect(px, y, 8, 60); ctx.fillStyle = '#9a6a3a'; ctx.fillRect(x, y - 6, w, 8); }
  }

  function drawRock(r) {
    const x = r.x, y = r.y, w = r.w, h = r.h;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + 4, y, w / 2 + 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a7f72';
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2 + 4, y - h * 0.7); ctx.lineTo(x - w / 6, y - h); ctx.lineTo(x + w / 3, y - h * 0.92); ctx.lineTo(x + w / 2, y - h * 0.4); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aea392'; ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, y - h * 0.7); ctx.lineTo(x - w / 6, y - h); ctx.lineTo(x + w / 3, y - h * 0.92); ctx.lineTo(x, y - h * 0.6); ctx.closePath(); ctx.fill();
  }

  function drawLedge(pl, th) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(pl.x + 4, pl.y + 14, pl.w, 6);
    ctx.fillStyle = '#9a8a72'; roundRect(pl.x, pl.y, pl.w, 16, 6); ctx.fill();
    ctx.fillStyle = th.top; roundRect(pl.x, pl.y - 3, pl.w, 7, 3); ctx.fill();
  }

  function drawBoat(pl) {
    const x = pl.x, y = pl.y, w = pl.w;
    const tilt = Math.sin(time * 1.7 + pl.phase) * 0.04 * (lv.weather + 0.2);
    ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate(tilt);
    ctx.fillStyle = '#6b4423';
    ctx.beginPath(); ctx.moveTo(-w / 2 - 8, -2); ctx.lineTo(w / 2 + 8, -2); ctx.quadraticCurveTo(w / 2, 26, w / 2 - 20, 28); ctx.lineTo(-w / 2 + 20, 28); ctx.quadraticCurveTo(-w / 2, 26, -w / 2 - 8, -2); ctx.fill();
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-w / 2 - 6, -4, w + 12, 5);
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1.5;
    for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 2, k * 8); ctx.lineTo(w / 2 - 2, k * 8); ctx.stroke(); }
    ctx.restore();
  }

  function drawProp(pr) {
    const x = pr.x, y = pr.y, s = pr.s;
    switch (pr.type) {
      case 'palm': {
        ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 8 * s, y - 40 * s, x + 6 * s, y - 80 * s); ctx.stroke();
        const sway = Math.sin(time * 1.5 + pr.seed * 6) * 0.08;
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI + k * (Math.PI / 6) + sway;
          ctx.fillStyle = k % 2 ? '#3f7d32' : '#4f9440';
          ctx.beginPath(); ctx.ellipse(x + 6 * s + Math.cos(a) * 18 * s, y - 80 * s + Math.sin(a) * 7 * s + 6 * s, 22 * s, 6 * s, a, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'cedar':
        ctx.fillStyle = '#5a3e26'; ctx.fillRect(x - 3 * s, y - 20 * s, 6 * s, 20 * s);
        [[0, 28], [20, 22], [38, 16], [54, 10]].forEach(([dy, w]) => { ctx.fillStyle = '#2f5f3a'; ctx.beginPath(); ctx.moveTo(x - w * s, y - (14 + dy) * s); ctx.lineTo(x, y - (40 + dy) * s); ctx.lineTo(x + w * s, y - (14 + dy) * s); ctx.fill(); });
        break;
      case 'tree': case 'olive': {
        const c = pr.type === 'olive' ? ['#7c9860', '#5a7344'] : ['#4f8f3c', '#356b2a'];
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 3 * s, y - 34 * s, 6 * s, 34 * s);
        [[0, -44, 18], [-14, -36, 13], [14, -36, 13], [0, -56, 12]].forEach(([dx, dy, r]) => { ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(x + dx * s + 2, y + dy * s + 3, r * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); });
        if (lv.st.id === 'eden') for (let k = 0; k < 4; k++) { ctx.fillStyle = '#e8463a'; ctx.beginPath(); ctx.arc(x + (k * 9 - 13) * s, y - (40 + (k % 2) * 10) * s, 2.6 * s, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'flower':
        for (let k = 0; k < 5; k++) { const fx = x + (k - 2) * 7 * s; ctx.strokeStyle = '#4f8a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx, y - 10 * s); ctx.stroke(); ctx.fillStyle = ['#ff8fb0', '#fff', '#ffd84d'][k % 3]; ctx.beginPath(); ctx.arc(fx, y - 11 * s, 3 * s, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'reed':
        ctx.strokeStyle = '#7a8a4a'; ctx.lineWidth = 2;
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + k * 4, y); ctx.quadraticCurveTo(x + k * 4 + Math.sin(time * 2 + k) * 4, y - 20 * s, x + k * 4 + 3, y - 34 * s); ctx.stroke(); }
        break;
      case 'shell':
        ctx.fillStyle = '#f2dcc0'; ctx.beginPath(); ctx.arc(x, y - 4, 6 * s, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#4f7a4a'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x + 18 + k * 5, y - 12 * s, 2.5, 13 * s, Math.sin(time * 2 + k) * 0.2, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'rock':
        ctx.fillStyle = '#8a7f72'; ctx.beginPath(); ctx.ellipse(x, y - 6 * s, 14 * s, 9 * s, 0, Math.PI, 0); ctx.fill();
        break;
      case 'sheep':
        for (let k = 0; k < 2; k++) {
          const sx = x + k * 26 * s, bob = Math.sin(time * 2 + k + pr.seed * 5);
          ctx.fillStyle = '#f4f1e8';
          [[-5, -10], [0, -12], [5, -10], [-2, -7], [3, -7]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(sx + a * s, y + (b + bob * 0.4) * s, 6 * s, 0, Math.PI * 2); ctx.fill(); });
          ctx.fillStyle = '#3a302a'; ctx.beginPath(); ctx.arc(sx + 10 * s, y - 11 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(sx - 4 * s, y - 4 * s, 2 * s, 4 * s); ctx.fillRect(sx + 4 * s, y - 4 * s, 2 * s, 4 * s);
        }
        break;
      case 'house':
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 22 * s, y - 40 * s, 44 * s, 40 * s);
        ctx.fillStyle = '#c9b48a'; ctx.fillRect(x - 24 * s, y - 44 * s, 48 * s, 5 * s);
        ctx.fillStyle = '#5a4128'; ctx.fillRect(x - 5 * s, y - 18 * s, 10 * s, 18 * s);
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 10 * s, y - 30 * s, 6 * s, 6 * s);
        break;
      case 'tent':
        ctx.fillStyle = '#d8c39a'; ctx.beginPath(); ctx.moveTo(x - 24 * s, y); ctx.lineTo(x, y - 30 * s); ctx.lineTo(x + 24 * s, y); ctx.fill();
        ctx.fillStyle = '#5b452c'; ctx.beginPath(); ctx.moveTo(x - 5 * s, y); ctx.lineTo(x, y - 12 * s); ctx.lineTo(x + 5 * s, y); ctx.fill();
        break;
    }
  }

  function drawLamp(c) {
    const y = c.y + Math.sin(time * 3 + c.ph) * 4;
    const gl = ctx.createRadialGradient(c.x, y, 0, c.x, y, 18);
    gl.addColorStop(0, 'rgba(255,230,150,0.9)'); gl.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(c.x, y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8862e'; ctx.beginPath(); ctx.ellipse(c.x, y + 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff2b8'; ctx.beginPath(); ctx.moveTo(c.x + 3, y + 1); ctx.quadraticCurveTo(c.x + 7, y - 5, c.x + 4, y - 10 - Math.sin(time * 12 + c.ph) * 1.5); ctx.quadraticCurveTo(c.x, y - 4, c.x + 3, y + 1); ctx.fill();
  }

  function drawScroll(sc) {
    if (sc.o && sc.o.boat) sc.y = sc.o.y - 46;
    const y = sc.y + Math.sin(time * 2.2 + sc.k) * 6;
    const gl = ctx.createRadialGradient(sc.x, y, 0, sc.x, y, 44);
    gl.addColorStop(0, 'rgba(255,235,160,0.65)'); gl.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sc.x, y, 44, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(sc.x, y); ctx.rotate(Math.sin(time * 1.6 + sc.k) * 0.1);
    ctx.fillStyle = '#f4e4bc'; ctx.fillRect(-14, -10, 28, 20);
    ctx.fillStyle = '#c99a52'; roundRect(-19, -12, 7, 24, 3); ctx.fill(); roundRect(12, -12, 7, 24, 3); ctx.fill();
    ctx.strokeStyle = '#9b7a4a'; ctx.lineWidth = 1.2; for (let k = -5; k <= 5; k += 3.5) { ctx.beginPath(); ctx.moveTo(-9, k); ctx.lineTo(9, k); ctx.stroke(); }
    ctx.fillStyle = '#b8372f'; ctx.beginPath(); ctx.arc(0, 10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ---- the pilgrim ---- */
  function drawPlayer() {
    if (P.blink > 0 && Math.floor(P.blink * 12) % 2) return;
    const x = P.x, y = P.y, f = P.facing;
    const moving = P.onGround && Math.abs(P.vx) > 20;
    const air = !P.onGround;
    const sw = moving ? Math.sin(P.anim) : 0;
    const breathe = !moving && !air ? Math.sin(time * 2.4) * 0.8 : 0;
    const squash = P.land > 0 ? 1 - P.land * 0.9 : air ? 1.05 : 1;
    // shadow
    const surf = surfaceAt(lv, x);
    const sd = clamp((surf.y - y) / 200, 0, 1);
    ctx.fillStyle = `rgba(20,10,0,${0.28 * (1 - sd)})`; ctx.beginPath(); ctx.ellipse(x, surf.y, 14 * (1 - sd * 0.5), 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(x, y); ctx.scale(f, squash); ctx.translate(0, -Math.abs(Math.cos(P.anim)) * (moving ? 2.5 : 0) + breathe);
    const skin = '#c98f63', robe = '#6d3f8a', robe2 = '#8a5aa6', cloak = '#e9dcc0';
    // back leg + arm
    leg(-1, air ? -0.9 : -sw * 0.7, air);
    arm(-1, air ? -1.6 : sw * 0.8, '#5b3274');
    // robe
    ctx.fillStyle = robe;
    const hem = Math.sin(P.anim) * (moving ? 3 : 0);
    ctx.beginPath(); ctx.moveTo(-9, -44); ctx.quadraticCurveTo(-12, -24, -12 + hem, -14); ctx.lineTo(12 + hem, -14); ctx.quadraticCurveTo(11, -26, 9, -44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = robe2; ctx.beginPath(); ctx.moveTo(1, -44); ctx.lineTo(9, -44); ctx.quadraticCurveTo(11, -26, 12 + hem, -14); ctx.lineTo(4 + hem, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = cloak; ctx.beginPath(); ctx.moveTo(-9, -45); ctx.lineTo(-4, -45); ctx.lineTo(-7 + hem, -16); ctx.lineTo(-11 + hem, -16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = getAccent(); ctx.fillRect(-10, -31, 21, 3.5);
    // front leg in front of robe hem
    leg(1, air ? 0.5 : sw * 0.7, air);
    // head + headscarf
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(1, -52, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.ellipse(4, -46, 4.5, 3, 0.2, 0, Math.PI * 2); ctx.fill(); // beard
    ctx.fillStyle = cloak; ctx.beginPath(); ctx.arc(-0.5, -54, 8.6, Math.PI * 0.92, Math.PI * 2.08); ctx.lineTo(-7, -42 + hem * 0.3); ctx.lineTo(-9, -46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = getAccent(); ctx.fillRect(-8.5, -57, 17, 2.4);
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(4.5, -53, 1.1, 0, Math.PI * 2); ctx.fill();
    // front arm with staff
    const fa = air ? -2.1 : -sw * 0.8;
    ctx.save(); ctx.translate(2, -42); ctx.rotate(fa * 0.5);
    ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(10, 30); ctx.stroke();
    ctx.restore();
    arm(1, fa, robe2);
    ctx.restore();
  }
  function leg(side, a, air) {
    ctx.save(); ctx.translate(side * 3, -22); ctx.rotate(a);
    ctx.strokeStyle = '#a8764e'; ctx.lineWidth = 4.2; ctx.lineCap = 'round';
    const knee = air ? 0.9 : Math.max(0, -a) * 0.9 + 0.1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 11); ctx.lineTo(Math.sin(knee) * -6, 11 + Math.cos(knee) * 10); ctx.stroke();
    ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.ellipse(Math.sin(knee) * -6 + 2, 11 + Math.cos(knee) * 10 + 1, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function arm(side, a, col) {
    ctx.save(); ctx.translate(side * 2 + 1, -42); ctx.rotate(a * 0.6);
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, 14); ctx.stroke();
    ctx.fillStyle = '#c98f63'; ctx.beginPath(); ctx.arc(4, 17, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  let accentCache = null, accentAt = 0;
  function getAccent() {
    if (!accentCache || time - accentAt > 2) { accentCache = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#f2c14e'; accentAt = time; }
    return accentCache;
  }

  /* ---- story set pieces at the end of each level ---- */
  function drawGoal() {
    const gx = lv.goalX, gy = surfaceAt(lv, gx + 60).y, t = lv.finishT, fin = !!lv.finished;
    const id = lv.st.id;
    ctx.save();
    switch (id) {
      case 'eden': {
        rays(gx + 80, 0, 0.18 + (fin ? 0.25 : 0));
        ctx.fillStyle = '#4f9fd0'; ctx.fillRect(gx - 40, gy - 3, 260, 6);
        ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.moveTo(gx + 70, gy); ctx.quadraticCurveTo(gx + 76, gy - 80, gx + 64, gy - 130); ctx.lineTo(gx + 96, gy - 130); ctx.quadraticCurveTo(gx + 86, gy - 80, gx + 100, gy); ctx.fill();
        [[80, -170, 60], [40, -150, 40], [122, -150, 40], [60, -205, 34], [104, -205, 34]].forEach(([dx, dy, r]) => { ctx.fillStyle = '#2e6b2c'; ctx.beginPath(); ctx.arc(gx + dx + 4, gy + dy + 4, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.arc(gx + dx, gy + dy, r, 0, Math.PI * 2); ctx.fill(); });
        for (let k = 0; k < 9; k++) { ctx.fillStyle = `rgba(230,60,50,${0.75 + 0.25 * Math.sin(time * 2 + k)})`; ctx.beginPath(); ctx.arc(gx + 30 + (k * 37) % 110, gy - 150 - (k * 23) % 70, 5, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'ararat': {
        ctx.fillStyle = '#5f5446'; ctx.beginPath(); ctx.moveTo(gx - 60, gy); ctx.lineTo(gx + 90, gy - 120); ctx.lineTo(gx + 260, gy); ctx.fill();
        ctx.fillStyle = '#7a4b25'; ctx.beginPath(); ctx.moveTo(gx + 10, gy - 110); ctx.lineTo(gx + 190, gy - 110); ctx.lineTo(gx + 170, gy - 70); ctx.lineTo(gx + 30, gy - 70); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9a6634'; ctx.fillRect(gx + 50, gy - 140, 100, 30); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(gx + 60, gy - 130, 80, 6);
        const ra = lv.th.rainbow ? clamp((prog() - 0.6) * 2.5, 0, 1) * 0.6 + (fin ? 0.3 : 0) : 0;
        ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#8e44ad'].forEach((c, k) => { ctx.strokeStyle = c; ctx.globalAlpha = ra; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(gx + 100, gy - 60, 230 - k * 7, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); });
        ctx.globalAlpha = 1;
        if (fin) { const dx = gx + 100 + Math.cos(time * 2) * 80, dy = gy - 230 + Math.sin(time * 3) * 20; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(dx, dy, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(dx - 2, dy - 4, 8, 3, Math.sin(time * 14) * 0.6, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'redsea': {
        ['#e8dcc0', '#d8c39a', '#e8dcc0'].forEach((c, k) => { ctx.fillStyle = c; const tx = gx + 40 + k * 60; ctx.beginPath(); ctx.moveTo(tx - 26, gy); ctx.lineTo(tx, gy - 34); ctx.lineTo(tx + 26, gy); ctx.fill(); });
        const fx = gx + 210, h = 260;
        const gr = ctx.createLinearGradient(0, gy - h, 0, gy);
        gr.addColorStop(0, 'rgba(255,120,40,0)'); gr.addColorStop(0.3, 'rgba(255,170,60,0.9)'); gr.addColorStop(1, 'rgba(255,240,180,0.95)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(fx - 18, gy);
        for (let yy = gy; yy > gy - h; yy -= 12) ctx.lineTo(fx - 18 - Math.sin(yy * 0.06 + time * 6) * 6, yy);
        for (let yy = gy - h; yy < gy; yy += 12) ctx.lineTo(fx + 18 + Math.sin(yy * 0.07 + time * 5) * 6, yy);
        ctx.fill();
        glow(fx, gy - 120, 120, '255,170,60', 0.35);
        break;
      }
      case 'jericho': {
        if (!fin || t < 0.3) {
          const x0 = gx + 10;
          ctx.fillStyle = '#b89a6a'; ctx.fillRect(x0, gy - 132, 234, 132);
          ctx.strokeStyle = 'rgba(80,60,30,0.35)'; ctx.lineWidth = 1.5;
          for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) ctx.strokeRect(x0 + c * 26 + (r % 2) * 13 - 13, gy - 22 - r * 22, 26, 22);
          [x0 - 14, x0 + 100, x0 + 214].forEach(tx => { ctx.fillStyle = '#a3865a'; ctx.fillRect(tx, gy - 170, 34, 170); ctx.fillStyle = '#d2b886'; for (let c = 0; c < 4; c++) ctx.fillRect(tx + c * 9, gy - 178, 6, 9); });
          ctx.fillStyle = '#c03a2b'; ctx.fillRect(x0 + 180, gy - 110, 4, 22);
        }
        break;
      }
      case 'elah': {
        const fall = fin ? clamp((t - 0.8) / 0.9, 0, 1) : 0;
        if (fin && t < 0.9) { const k = clamp(t / 0.8, 0, 1); const sx = lerp(P.x + 20, gx + 120, k), sy = lerp(P.y - 40, gy - 190, k) - Math.sin(k * Math.PI) * 60; ctx.fillStyle = '#cfcabd'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.save(); ctx.translate(gx + 140, gy); ctx.rotate(fall * 1.45);
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-20, -90, 16, 90); ctx.fillRect(4, -90, 16, 90);
        ctx.fillStyle = '#b8863a'; ctx.fillRect(-28, -170, 56, 84);
        ctx.fillStyle = '#d8a858'; ctx.fillRect(-28, -170, 56, 10);
        ctx.fillStyle = '#c98f63'; ctx.beginPath(); ctx.arc(0, -188, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b8863a'; ctx.beginPath(); ctx.arc(0, -194, 21, Math.PI, 0); ctx.fill(); ctx.fillRect(-3, -222, 6, 14);
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-40, -230); ctx.lineTo(-30, 0); ctx.stroke();
        ctx.fillStyle = '#c0a050'; ctx.beginPath(); ctx.moveTo(-44, -244); ctx.lineTo(-36, -226); ctx.lineTo(-48, -228); ctx.fill();
        ctx.fillStyle = '#9a7a3a'; ctx.beginPath(); ctx.ellipse(34, -130, 14, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'nineveh': {
        ctx.fillStyle = '#b88a55'; [[0, 70, 46], [24, 46, 36], [44, 26, 28]].forEach(([dy, w, h]) => ctx.fillRect(gx + 120 - w, gy - dy - h, w * 2, h));
        ctx.fillStyle = '#c4975f'; ctx.fillRect(gx - 20, gy - 60, 80, 60); ctx.fillRect(gx + 180, gy - 54, 70, 54);
        ctx.fillStyle = '#3b6fb6'; ctx.fillRect(gx + 104, gy - 102, 32, 6);
        break;
      }
      case 'babylon': {
        ctx.fillStyle = '#2d5fa8'; ctx.fillRect(gx - 30, gy - 120, 70, 120);
        ctx.fillStyle = '#e8c35a'; for (let k = 0; k < 5; k++) ctx.fillRect(gx - 24 + k * 13, gy - 90, 8, 4);
        ctx.fillStyle = '#3a2f26'; ctx.beginPath(); ctx.ellipse(gx + 160, gy + 4, 110, 26, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#8a7a60'; ctx.fillRect(gx + 50, gy - 6, 220, 8);
        [[110, 0], [170, 1], [220, 0]].forEach(([dx, k]) => { const lx = gx + dx, ly = gy - 6; ctx.fillStyle = '#d8a24a'; ctx.beginPath(); ctx.ellipse(lx, ly - 8, 22, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a06a28'; ctx.beginPath(); ctx.arc(lx + (k ? -20 : 20), ly - 14, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d8a24a'; ctx.beginPath(); ctx.arc(lx + (k ? -22 : 22), ly - 13, 7, 0, Math.PI * 2); ctx.fill(); });
        const a = 0.35 + (fin ? 0.45 : 0) + Math.sin(time * 2) * 0.05;
        glow(gx + 160, gy - 70, 120, '255,250,220', a);
        ctx.fillStyle = `rgba(255,255,240,${a + 0.2})`; ctx.beginPath(); ctx.ellipse(gx + 160, gy - 70, 10, 28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(gx + 140, gy - 82, 22, 8, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(gx + 180, gy - 82, 22, 8, 0.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bethlehem': {
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(gx + 30, gy - 80, 150, 80);
        ctx.fillStyle = '#4a3018'; ctx.beginPath(); ctx.moveTo(gx + 16, gy - 76); ctx.lineTo(gx + 105, gy - 120); ctx.lineTo(gx + 194, gy - 76); ctx.fill();
        ctx.fillStyle = '#2a1a0c'; ctx.fillRect(gx + 70, gy - 60, 70, 60);
        glow(gx + 105, gy - 24, 70, '255,220,140', 0.8);
        ctx.fillStyle = '#d7b86a'; ctx.fillRect(gx + 88, gy - 18, 34, 10);
        ctx.strokeStyle = 'rgba(255,245,200,0.18)'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(gx + 105, gy - 120); ctx.lineTo(gx + 105, -50); ctx.stroke();
        break;
      }
      case 'galilee': {
        const bx = gx + 120, by = WATER_Y - 6 + Math.sin(time * 1.7) * 6 * (lv.weather + 0.2);
        ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.moveTo(bx - 110, by - 20); ctx.lineTo(bx + 110, by - 20); ctx.quadraticCurveTo(bx + 90, by + 14, bx + 70, by + 16); ctx.lineTo(bx - 70, by + 16); ctx.quadraticCurveTo(bx - 90, by + 14, bx - 110, by - 20); ctx.fill();
        ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx - 30, by - 20); ctx.lineTo(bx - 30, by - 150); ctx.stroke();
        ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.moveTo(bx - 27, by - 145); ctx.quadraticCurveTo(bx + 30, by - 100, bx - 26, by - 40); ctx.fill();
        [[-80, '#8a4d3a'], [-60, '#3f5f8a'], [60, '#6a3a6a'], [85, '#3a6a5a']].forEach(([dx, c]) => { ctx.fillStyle = c; ctx.fillRect(bx + dx - 6, by - 44, 12, 24); ctx.fillStyle = '#c99a70'; ctx.beginPath(); ctx.arc(bx + dx, by - 50, 6, 0, Math.PI * 2); ctx.fill(); });
        glow(bx + 20, by - 60, 70, '255,250,230', 0.45);
        ctx.fillStyle = '#f7f4ec'; ctx.fillRect(bx + 12, by - 68, 16, 48); ctx.fillStyle = '#c99a70'; ctx.beginPath(); ctx.arc(bx + 20, by - 74, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f7f4ec'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx + 24, by - 60); ctx.lineTo(bx + 40, by - 86 - (fin ? 6 : 0)); ctx.stroke();
        break;
      }
      case 'golgotha': {
        ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(gx + 130, gy, 170, 70, 0, Math.PI, 0); ctx.fill();
        if (fin) rays(gx + 130, gy - 260, 0.25);
        [[70, 0.75], [130, 1], [190, 0.75]].forEach(([dx, s]) => { ctx.fillStyle = '#2a1a10'; ctx.fillRect(gx + dx - 4 * s, gy - 60 - 120 * s, 8 * s, 120 * s); ctx.fillRect(gx + dx - 34 * s, gy - 60 - 98 * s, 68 * s, 7 * s); });
        break;
      }
      case 'tomb': {
        ctx.fillStyle = '#8f8472'; ctx.beginPath(); ctx.ellipse(gx + 110, gy, 150, 120, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#a99d88'; ctx.beginPath(); ctx.ellipse(gx + 96, gy - 10, 110, 90, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#1f1812'; ctx.beginPath(); ctx.moveTo(gx + 80, gy); ctx.lineTo(gx + 80, gy - 50); ctx.arc(gx + 110, gy - 50, 30, Math.PI, 0); ctx.lineTo(gx + 140, gy); ctx.fill();
        glow(gx + 110, gy - 40, 110, '255,250,220', 0.6 + (fin ? 0.3 : 0));
        ctx.fillStyle = '#7d705f'; ctx.beginPath(); ctx.arc(gx + 200, gy - 34, 36, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#948672'; ctx.beginPath(); ctx.arc(gx + 197, gy - 37, 28, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'upperroom': {
        ctx.fillStyle = '#efe2c4'; ctx.fillRect(gx + 20, gy - 160, 180, 160);
        ctx.fillStyle = '#cdb88e'; ctx.fillRect(gx + 14, gy - 166, 192, 8); ctx.fillRect(gx + 20, gy - 82, 180, 5);
        ctx.fillStyle = '#5a4128'; ctx.fillRect(gx + 95, gy - 44, 30, 44);
        ctx.fillStyle = '#ffd27a'; [[50, -130], [150, -130], [50, -60], [150, -60]].forEach(([dx, dy]) => ctx.fillRect(gx + dx, gy + dy, 18, 18));
        ctx.strokeStyle = '#b8a27a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(gx + 200, gy); ctx.lineTo(gx + 250, gy - 80); ctx.stroke();
        const n = fin ? 9 : 5;
        for (let k = 0; k < n; k++) flame(gx + 40 + k * (140 / (n - 1)), gy - 186 - Math.sin(time * 3 + k) * 5, 1 + (fin ? 0.3 : 0));
        break;
      }
    }
    // goal marker
    if (mode === 'play') {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
      ctx.fillStyle = '#fff4c8'; ctx.font = '700 16px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText('▼', gx - 70, gy - 70 + Math.sin(time * 4) * 4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawFallingWall() {
    if (lv.st.id !== 'jericho' || !lv.finished) return;
    const t = lv.finishT;
    if (t < 0.3) return;
    const gy = surfaceAt(lv, lv.goalX + 60).y;
    lv.fx.forEach(b => {
      const tt = Math.max(0, Math.min(t, 2.2) - 0.3 - b.delay);
      const x = b.x + b.vx * tt, y = Math.min(gy - 8, b.y + b.vy * tt + 500 * tt * tt);
      ctx.save(); ctx.translate(x + 13, y + 11); ctx.rotate(b.vr * tt);
      ctx.fillStyle = '#b89a6a'; ctx.fillRect(-13, -11, 26, 22); ctx.strokeStyle = 'rgba(80,60,30,0.4)'; ctx.strokeRect(-13, -11, 26, 22);
      ctx.restore();
    });
    if (t < 1.4) { ctx.fillStyle = `rgba(210,190,150,${0.5 * (1.4 - t)})`; ctx.beginPath(); ctx.ellipse(lv.goalX + 120, gy - 40, 220, 80, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  function rays(x, y, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const an = Math.PI / 2 + (k - 3) * 0.12 + Math.sin(time * 0.5 + k) * 0.02;
      ctx.fillStyle = `rgba(255,240,190,${a * (0.6 + 0.4 * Math.sin(time + k))})`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an - 0.04) * 520, y + Math.sin(an - 0.04) * 520); ctx.lineTo(x + Math.cos(an + 0.04) * 520, y + Math.sin(an + 0.04) * 520); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function glow(x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function flame(x, y, s) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 16 * s);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(0.45, '#ff9c2a'); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 7 * s, y + 6 * s); ctx.quadraticCurveTo(x - 6 * s, y - 8 * s, x + Math.sin(time * 9 + x) * 3, y - 22 * s); ctx.quadraticCurveTo(x + 7 * s, y - 6 * s, x + 7 * s, y + 6 * s); ctx.closePath(); ctx.fill();
  }

  /* ---- weather, drawn in screen space ---- */
  let drops = null;
  function drawWeather(viewW, th) {
    const w = th.weather, k = lv.weather;
    if (!drops) drops = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8, p: Math.random() * 6 }));
    if ((w === 'rain' || w === 'storm') && k > 0.02) {
      ctx.strokeStyle = `rgba(200,215,235,${0.55 * k})`; ctx.lineWidth = 1.3;
      ctx.beginPath();
      drops.forEach(d => { const x = ((d.x * viewW - camX * 0.6 - time * 120 * d.s) % viewW + viewW) % viewW, y = ((d.y + time * 1.4 * d.s) % 1) * H; ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 16); });
      ctx.stroke();
    }
    if (w === 'wind' || w === 'sparks' || w === 'storm') {
      ctx.strokeStyle = `rgba(255,255,255,${w === 'storm' ? 0.18 * k : 0.22})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) { const d = drops[i]; const x = ((d.x * viewW * 1.4 + time * 380 * d.s) % (viewW + 300)) - 150, y = 60 + d.y * 380; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40, y - 6, x + 90, y); ctx.stroke(); }
    }
    if (w === 'sparks') drops.slice(0, 40).forEach(d => { const x = ((d.x * viewW - camX * 0.3) % viewW + viewW) % viewW, y = H - ((d.y * H + time * 60 * d.s) % H); ctx.fillStyle = `rgba(255,${150 + Math.floor(d.s * 80)},60,${0.7})`; ctx.beginPath(); ctx.arc(x, y, 1.6 * d.s, 0, Math.PI * 2); ctx.fill(); });
    if (w === 'fireflies') drops.slice(0, 30).forEach(d => { const x = ((d.x * viewW + Math.sin(time * 0.7 + d.p) * 30 - camX * 0.2) % viewW + viewW) % viewW, y = 260 + d.y * 200 + Math.sin(time + d.p) * 12; const a = 0.4 + 0.6 * Math.sin(time * 3 + d.p); ctx.fillStyle = `rgba(210,255,140,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); });
    if (w === 'dust') drops.slice(0, 40).forEach(d => { const x = ((d.x * viewW + time * 18 * d.s - camX * 0.3) % viewW + viewW) % viewW, y = 120 + d.y * 360 + Math.sin(time + d.p) * 10; ctx.fillStyle = 'rgba(240,220,180,0.25)'; ctx.beginPath(); ctx.arc(x, y, 1.5 * d.s, 0, Math.PI * 2); ctx.fill(); });
    if (w === 'petals') drops.slice(0, 26).forEach(d => { const x = ((d.x * viewW + time * 30 * d.s - camX * 0.3) % viewW + viewW) % viewW, y = (d.y * H + time * 40 * d.s) % H; ctx.save(); ctx.translate(x, y); ctx.rotate(time * d.s + d.p); ctx.fillStyle = 'rgba(255,190,210,0.8)'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
  }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hexA(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
  function shade(h, f) { const c = hexRgb(h).map(v => clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255)); return `rgb(${c[0]},${c[1]},${c[2]})`; }

  /* ================= HUD, cards, menu (HTML) ================= */
  function hud() {
    $('#sqScrolls').textContent = `${lv.scrollCount}/3`;
    $('#sqCoins').textContent = lv.coinCount;
    $('#sqProg').style.width = Math.round(prog() * 100) + '%';
  }
  function showCard(html, btnLabel, onGo) {
    const c = $('#sqCard');
    c.innerHTML = `<div class="sq-card-inner">${html}<button class="btn primary" id="sqGo">${btnLabel}</button></div>`;
    c.classList.remove('hidden');
    resetKeys();
    // tap anywhere on the card (or around it) to continue: easy with one thumb
    let done = false;
    const go = e => { if (done) return; if (e) e.stopPropagation(); done = true; hideCard(); onGo && onGo(); };
    $('#sqGo').addEventListener('click', go);
    c.onclick = go;
    setTimeout(() => { const b = $('#sqGo'); if (b) b.focus(); }, 50);
  }
  function hideCard() { $('#sqCard').classList.add('hidden'); }

  function showFact(k) {
    const f = lv.st.facts[k];
    mode = 'fact';
    window.Core.Sound.play('open');
    showCard(`<div class="sq-eyebrow">📜 Fact scroll ${k + 1} of 3</div><p class="sq-fact">${esc(f.text).replace(/LORD/g, '<span class="sc">Lord</span>')}</p><div class="sq-ref">${esc(f.ref)}</div>`, 'Continue ▶', () => { mode = 'play'; });
  }

  function startStory(i) {
    if (!unlockedIdx(i)) return;
    menuIdx = i;
    lv = build(i); spawn();
    starField = null;
    mode = 'intro';
    $('#sqMenu').classList.add('hidden');
    $('#sqHud').classList.remove('hidden');
    $('#sqTitle').textContent = lv.st.title;
    $('#sqRef').textContent = lv.st.ref;
    hud();
    const st = lv.st;
    showCard(`<div class="sq-eyebrow">Story ${i + 1} of ${S().length} · ${esc(st.ref)}</div><h2 class="sq-h">${st.icon} ${esc(st.title)}</h2><p>${esc(st.goal)}</p>
      <p class="sq-howto">${oneHand()
        ? (touch() ? '✋ One-hand play: you walk by yourself. <b>Tap anywhere to jump</b>, and hold to jump higher.' : '✋ One-hand play: you walk by yourself. Press <b>Space</b> or click to jump, and hold to jump higher.')
        : (touch() ? 'Use ◀ ▶ to walk and ⤒ to jump. Hold ⤒ to jump higher.' : 'Use ← → or A D to walk, and Space or ↑ to jump. Hold to jump higher.')} Collect the 3 📜 fact scrolls and the ✨ lamps.</p>`, 'Begin ▶', () => {
      mode = 'play';
      if (touch() && !oneHand()) $('#sqTouch').classList.remove('hidden');
      if (oneHand()) showHint();
    });
  }
  const touch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  let hintT = null;
  function showHint() {
    const h = $('#sqHint'); if (!h) return;
    h.textContent = touch() ? '👆 Tap anywhere to jump' : 'Space or click to jump';
    h.classList.remove('hidden'); clearTimeout(hintT); hintT = setTimeout(hideHint, 4000);
  }
  function hideHint() { const h = $('#sqHint'); if (h) h.classList.add('hidden'); }

  function showMenu() {
    mode = 'menu'; resetKeys(); hideCard(); hideHint();
    $('#sqHud').classList.add('hidden'); $('#sqTouch').classList.add('hidden');
    const pr = progress();
    const stars = S().reduce((a, s) => a + (done()[s.id] || 0), 0);
    const name = window.Personal && window.Personal.name();
    menuIdx = Math.min(pr.next, S().length - 1);
    lv = build(menuIdx); starField = null; camX = 0;
    const m = $('#sqMenu');
    m.innerHTML = `
      <div class="sq-menu-inner">
        <div class="sq-head">
          <div><div class="sq-eyebrow">Bible Story Quest</div><h1>${name ? `${esc(name)}'s` : 'Your'} journey through Scripture</h1>
          <p>Twelve short stories from Creation to Pentecost. Run, jump and collect facts, then read the passage and answer three questions.</p></div>
          <div class="sq-side">
          <button class="sq-hand ${oneHand() ? 'on' : ''}" id="sqHand" aria-pressed="${oneHand()}"><span>✋</span><span><b>One-hand play</b><small>${oneHand() ? 'On: walks by itself, tap to jump' : 'Off: ◀ ▶ and jump buttons'}</small></span><i class="sq-switch"></i></button>
          <div class="sq-score"><b>${Object.keys(done()).filter(id => S().some(s => s.id === id)).length}/${S().length}</b><span>stories</span><b>★ ${stars}/${S().length * 3}</b><span>stars</span></div>
          </div>
        </div>
        <div class="sq-grid">${S().map((s, i) => {
          const st = done()[s.id] || 0, un = unlockedIdx(i), nx = i === pr.next;
          return `<button class="sq-story ${un ? '' : 'locked'} ${nx ? 'next' : ''} ${celebrated === s.id ? 'just' : ''}" data-i="${i}" style="--s1:${s.theme.sky[0]};--s2:${s.theme.sky[1]};--g:${s.theme.mid}" ${un ? '' : 'aria-disabled="true"'}>
            <span class="sq-num">${i + 1}</span>
            <span class="sq-icon">${un ? s.icon : '🔒'}</span>
            <span class="sq-t">${esc(s.title)}</span>
            <span class="sq-r">${esc(s.ref)}</span>
            <span class="sq-stars">${[0, 1, 2].map(k => `<i class="${k < st ? 'on' : ''}">★</i>`).join('')}</span>
            ${nx ? '<span class="sq-play">▶ Play</span>' : ''}
          </button>`;
        }).join('')}</div>
      </div>`;
    m.classList.remove('hidden');
    $('#sqHand').addEventListener('click', () => {
      window.Core.state.storyOneHand = !oneHand(); window.Core.save(); window.Core.Sound.play('tap');
      window.Core.toast(oneHand() ? '✋ One-hand play on: tap anywhere to jump' : 'One-hand play off: use ◀ ▶ and the jump button');
      showMenu();
    });
    m.querySelectorAll('.sq-story').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (!unlockedIdx(i)) { window.Core.toast(`🔒 Finish "${S()[i - 1].title}" first`); window.Core.Sound.play('wrong'); return; }
      window.Core.Sound.play('tap'); startStory(i);
    }));
    celebrated = null;
  }

  /* ================= Loop & API ================= */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.033, (ts - (last || ts)) / 1000);
    last = ts;
    if (mode !== 'fact' && mode !== 'intro') update(dt); else time += dt;
    if (lv) render();
    requestAnimationFrame(loop);
  }

  function init(cv, h) {
    canvas = cv; ctx = canvas.getContext('2d'); hooks = h || {};
    bindInput();
    window.addEventListener('resize', () => { if (running) resize(); });
    ready = true;
    showMenu();
    return Promise.resolve();
  }
  function setActive(on) {
    if (!ready) return;
    if (on) {
      if (mode === 'awaiting') showMenu();
      if (!running) { running = true; last = 0; resize(); requestAnimationFrame(loop); }
    } else { running = false; resetKeys(); }
  }

  window.Game = {
    init, setActive, isUnlocked, progress,
    get ready() { return ready; },
    setInputEnabled: v => { inputEnabled = v; if (!v) resetKeys(); },
    celebrate(id) {
      celebrated = id;
      const i = S().findIndex(s => s.id === id);
      showMenu();
      if (i >= 0 && i + 1 < S().length) window.Core.toast(`🔓 Next story unlocked: ${S()[i + 1].title}`, 'level');
    },
    playStory(id) { const i = S().findIndex(s => s.id === id); if (i >= 0) startStory(i); },
    hasStory: id => S().some(s => s.id === id),
    showMenu,
    // read-only state for automated tests
    _debug: () => lv && ({ x: P.x, y: P.y, vx: P.vx, onGround: P.onGround, mode, goal: lv.goalX, scrolls: lv.scrollCount, coins: lv.coinCount, falls: lv.falls,
      ahead: [40, 80, 120].map(d => { const xx = P.x + d; const o = lv.segs.concat(lv.plats.filter(q => q.boat)).find(g => xx >= g.x && xx <= g.x + g.w); return o ? o.y : null; }),
      rockAhead: lv.rocks.some(r => r.x - P.x > 0 && r.x - P.x < 75),
      near: { segs: lv.segs.filter(g => g.x < P.x + 400 && g.x + g.w > P.x - 300).map(g => [Math.round(g.x), Math.round(g.w), Math.round(g.y)]), rocks: lv.rocks.filter(r => Math.abs(r.x - P.x) < 400).map(r => [Math.round(r.x), Math.round(r.w), Math.round(r.h), r.y]), plats: lv.plats.filter(q => Math.abs(q.x - P.x) < 400).map(q => [Math.round(q.x), q.w, Math.round(q.y)]) } })
  };
})();
