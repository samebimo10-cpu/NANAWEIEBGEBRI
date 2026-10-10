/*
 * Shareable image cards: a verse card, and a testimony card for an answered prayer.
 * Drawn on a canvas on the device, then shared to WhatsApp or other apps, or saved.
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const W = 1080, H = 1350;

  const STYLES = [
    ['night', 'Night', ['#2b1e52', '#120c24'], '#fff6e0', '#f2c14e'],
    ['dawn', 'Dawn', ['#ffb36b', '#7a3f8f'], '#ffffff', '#fff1c4'],
    ['parchment', 'Parchment', ['#f6ecd2', '#e2cc98'], '#3b2a17', '#9a5a1c'],
    ['sea', 'Sea', ['#1d6f8f', '#0b2742'], '#f2fbff', '#9fe3ff'],
    ['olive', 'Olive', ['#4d6b3a', '#1e2c17'], '#f7f3e3', '#e8d27a']
  ];
  let styleId = 'night';

  async function fontsReady() {
    try {
      await Promise.race([Promise.all([
        document.fonts.load('italic 60px "EB Garamond"'), document.fonts.load('60px "EB Garamond"'),
        document.fonts.load('700 40px "Cinzel"'), document.fonts.load('90px "Great Vibes"')
      ]), new Promise(r => setTimeout(r, 1200))]);
    } catch (e) { /* fall back to system fonts */ }
  }

  function wrap(ctx, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  /* Fit a block of text into a box by shrinking the font until it fits. */
  function fitText(ctx, text, font, maxW, maxH, start, min) {
    let size = start, lines;
    for (; size >= min; size -= 2) {
      ctx.font = font(size);
      lines = wrap(ctx, text, maxW);
      if (lines.length * size * 1.32 <= maxH) break;
    }
    return { size: Math.max(size, min), lines };
  }

  function background(ctx, st) {
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, st[2][0]); g.addColorStop(1, st[2][1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // soft glow, like lamplight
    const r = ctx.createRadialGradient(W * 0.78, H * 0.16, 10, W * 0.78, H * 0.16, 520);
    r.addColorStop(0, 'rgba(255, 220, 140, 0.35)'); r.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    // frame
    ctx.strokeStyle = st[4]; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
    ctx.strokeRect(46, 46, W - 92, H - 92);
    ctx.globalAlpha = 0.25; ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.globalAlpha = 1;
  }

  function lamp(ctx, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-34, 6); ctx.quadraticCurveTo(-34, -6, 0, -8); ctx.quadraticCurveTo(30, -8, 40, 0);
    ctx.lineTo(56, -10); ctx.lineTo(50, 4); ctx.quadraticCurveTo(30, 20, 0, 20); ctx.quadraticCurveTo(-30, 20, -34, 6); ctx.fill();
    ctx.fillStyle = '#ffcf5a';
    ctx.beginPath(); ctx.moveTo(54, -40); ctx.quadraticCurveTo(66, -22, 54, -12); ctx.quadraticCurveTo(42, -22, 54, -40); ctx.fill();
    ctx.restore();
  }

  function footer(ctx, st) {
    ctx.textAlign = 'center';
    ctx.fillStyle = st[3]; ctx.globalAlpha = 0.65;
    ctx.font = '600 26px "Cinzel", Georgia, serif';
    ctx.fillText((window.Personal ? window.Personal.appTitle() : 'Lamp & Path').toUpperCase(), W / 2, H - 92);
    ctx.globalAlpha = 1;
  }

  function drawVerse(canvas, ref, text, st) {
    const ctx = canvas.getContext('2d');
    background(ctx, st);
    lamp(ctx, W / 2 - 10, 190, 1.3, st[4]);
    const body = text.replace(/LORD/g, 'Lord');
    const box = { x: 130, y: 300, w: W - 260, h: 760 };
    const fit = fitText(ctx, `“${body}”`, sz => `italic ${sz}px "EB Garamond", Georgia, serif`, box.w, box.h, 76, 30);
    ctx.font = `italic ${fit.size}px "EB Garamond", Georgia, serif`;
    ctx.fillStyle = st[3]; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const lh = fit.size * 1.32;
    const total = fit.lines.length * lh;
    let y = box.y + (box.h - total) / 2 + fit.size;
    fit.lines.forEach(l => { ctx.fillText(l, W / 2, y); y += lh; });
    ctx.fillStyle = st[4];
    ctx.font = '700 40px "Cinzel", Georgia, serif';
    ctx.fillText(ref.toUpperCase(), W / 2, Math.min(y + 50, H - 190));
    ctx.font = '600 24px Inter, system-ui, sans-serif'; ctx.globalAlpha = 0.7;
    ctx.fillText('KING JAMES VERSION', W / 2, Math.min(y + 92, H - 150));
    ctx.globalAlpha = 1;
    footer(ctx, st);
  }

  function drawTestimony(canvas, req, verse, st) {
    const ctx = canvas.getContext('2d');
    background(ctx, st);
    ctx.textAlign = 'center';
    ctx.fillStyle = st[4];
    ctx.font = '90px "Great Vibes", cursive';
    ctx.fillText('God answered', W / 2, 220);
    ctx.font = '600 26px Inter, system-ui, sans-serif'; ctx.globalAlpha = 0.75; ctx.fillStyle = st[3];
    const asked = new Date(req.created), ans = new Date(req.answeredAt || Date.now());
    const days = Math.max(1, Math.round((ans - asked) / 86400000));
    ctx.fillText(`PRAYED FOR ${days} DAY${days === 1 ? '' : 'S'} · ANSWERED ${ans.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}`, W / 2, 280);
    ctx.globalAlpha = 1;
    let y = 360;
    let fit = fitText(ctx, req.title, sz => `700 ${sz}px "EB Garamond", Georgia, serif`, W - 240, 220, 60, 34);
    ctx.font = `700 ${fit.size}px "EB Garamond", Georgia, serif`; ctx.fillStyle = st[3];
    fit.lines.forEach(l => { y += fit.size * 1.25; ctx.fillText(l, W / 2, y); });
    if (req.answeredHow) {
      y += 40;
      fit = fitText(ctx, req.answeredHow, sz => `italic ${sz}px "EB Garamond", Georgia, serif`, W - 260, 380, 46, 28);
      ctx.font = `italic ${fit.size}px "EB Garamond", Georgia, serif`;
      fit.lines.forEach(l => { y += fit.size * 1.3; ctx.fillText(l, W / 2, y); });
    }
    if (verse) {
      y = Math.max(y + 70, H - 380);
      ctx.strokeStyle = st[4]; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(W / 2 - 80, y - 40); ctx.lineTo(W / 2 + 80, y - 40); ctx.stroke(); ctx.globalAlpha = 1;
      fit = fitText(ctx, `“${verse.text.replace(/LORD/g, 'Lord')}”`, sz => `italic ${sz}px "EB Garamond", Georgia, serif`, W - 260, 170, 36, 24);
      ctx.font = `italic ${fit.size}px "EB Garamond", Georgia, serif`; ctx.fillStyle = st[3];
      fit.lines.forEach(l => { y += fit.size * 1.3; ctx.fillText(l, W / 2, y); });
      ctx.fillStyle = st[4]; ctx.font = '700 28px "Cinzel", Georgia, serif';
      ctx.fillText(verse.ref.toUpperCase(), W / 2, y + 50);
    }
    footer(ctx, st);
  }

  /* The card editor: preview, style picker, share and save. */
  async function open(kind, draw, filename, shareText) {
    await fontsReady();
    window.UI.openModal(`
      <div class="card-maker">
        <div class="eyebrow">${kind === 'testimony' ? 'Testimony card' : 'Verse card'}</div>
        <canvas id="cardCanvas" width="${W}" height="${H}" class="card-canvas"></canvas>
        <div class="theme-row center">${STYLES.map(s => `<button class="theme-dot ${s[0] === styleId ? 'active' : ''}" data-st="${s[0]}" style="--c1:${s[2][0]};--c2:${s[2][1]}" title="${s[1]}" aria-label="${s[1]}"></button>`).join('')}</div>
        <div class="row gap center wrap">
          <button class="btn primary" id="cardShare">📤 Share</button>
          <button class="btn ghost" id="cardSave">💾 Save image</button>
        </div>
        <p class="muted small center" id="cardHint">Share to WhatsApp, your status, or anywhere. If sharing is not available, save the image and send it from your photos.</p>
      </div>`);
    const canvas = $('#cardCanvas');
    const redraw = () => draw(canvas, STYLES.find(s => s[0] === styleId) || STYLES[0]);
    redraw();
    $$('.card-maker .theme-dot').forEach(b => b.addEventListener('click', () => {
      styleId = b.dataset.st;
      $$('.card-maker .theme-dot').forEach(x => x.classList.toggle('active', x === b));
      redraw();
    }));
    const blob = () => new Promise(res => canvas.toBlob(res, 'image/png'));
    const counted = () => { state.cardsShared = (state.cardsShared || 0) + 1; save(); window.Core.checkBadges(); };
    $('#cardShare').addEventListener('click', async () => {
      try {
        const b = await blob();
        const file = new File([b], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText });
          counted();
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      saveImage(await blob(), filename);
      counted();
    });
    $('#cardSave').addEventListener('click', async () => { saveImage(await blob(), filename); counted(); });
  }

  function saveImage(b, filename) {
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => a.remove(), 500);
    const hint = $('#cardHint');
    if (hint) hint.innerHTML = `✓ Image saved. On iPhone, if nothing downloaded, <a href="${url}" target="_blank" rel="noopener">open the image</a>, then press and hold it to save.`;
    toast('💾 Image saved');
  }

  function verse(ref, text) {
    const name = ref.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '');
    open('verse', (c, st) => drawVerse(c, ref, text, st), `${name}.png`, `${ref} (KJV)`);
  }

  async function testimony(req) {
    let v = null;
    try { const r = await window.Bible.lookup(window.TESTIMONY_REF); v = { ref: r.ref, text: r.verses.map(x => x[1]).join(' ') }; } catch (e) { /* card without the verse */ }
    open('testimony', (c, st) => drawTestimony(c, req, v, st), 'God-answered.png', `God answered: ${req.title}`);
  }

  window.Cards = { verse, testimony, STYLES };
})();
