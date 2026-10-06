/*
 * Personalization and installing:
 *  - first-run welcome that asks the person's name
 *  - a welcome screen each time the app opens, writing their name in calligraphy
 *  - settings: name, app title, greeting, colour theme, welcome animation
 *  - install the app (Android/desktop prompt, iPhone steps) and share it with others
 */
(function () {
  'use strict';
  const { state, save, escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* The public web address people install from (GitHub Pages for this repository). */
  const APP_URL = 'https://samebimo10-cpu.github.io/NANAWEIEBGEBRI/';

  const THEMES = [
    ['gold', 'Lamp gold', '#f2c14e', '#ffdf8a', '#c8862e'],
    ['rose', 'Rose', '#f28ba8', '#ffc6d6', '#c4527a'],
    ['emerald', 'Emerald', '#4fd1a1', '#aaf0d6', '#22906a'],
    ['sky', 'Sky', '#6db7ff', '#c2e1ff', '#2f7ccc'],
    ['violet', 'Violet', '#b197fc', '#ddd2ff', '#7c5ce0'],
    ['crimson', 'Crimson', '#ff7a6b', '#ffc3bb', '#c44536']
  ];
  const GREETINGS = [
    ['time', 'Good morning / afternoon / evening'],
    ['grace', 'Grace and peace'],
    ['bless', 'The Lord bless thee'],
    ['welcome', 'Welcome back'],
    ['shalom', 'Shalom']
  ];

  if (!state.profile) state.profile = {};
  const P = () => Object.assign({ name: '', title: '', theme: 'gold', greeting: 'time', splash: true, asked: false }, state.profile);

  function name() { return (P().name || '').trim(); }
  function appTitle() { return (P().title || '').trim() || 'Lamp & Path'; }
  function timeGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  function greeting() {
    switch (P().greeting) {
      case 'grace': return 'Grace and peace';
      case 'bless': return 'The Lord bless thee';
      case 'welcome': return 'Welcome back';
      case 'shalom': return 'Shalom';
      default: return timeGreeting();
    }
  }

  /* ---------------- Theme & title ---------------- */
  function apply() {
    const t = THEMES.find(x => x[0] === P().theme) || THEMES[0];
    const r = document.documentElement.style;
    r.setProperty('--gold', t[2]); r.setProperty('--gold2', t[3]); r.setProperty('--gold-deep', t[4]);
    const brand = $('.brand span');
    if (brand) {
      const title = appTitle();
      brand.innerHTML = title === 'Lamp & Path' ? 'Lamp <em>&amp;</em> Path' : esc(title);
    }
    document.title = name() ? `${appTitle()} · ${name()}` : `${appTitle()}: Bible Journey`;
  }

  /* ---------------- Welcome splash with the name in calligraphy ---------------- */
  function verseOfDay() {
    const v = window.DAILY_VERSES;
    const seed = window.Core.daySeed();
    return v[Math.floor(window.Core.rng(seed)() * v.length)];
  }

  async function splash(force) {
    const n = name();
    if (!n || (!P().splash && !force)) return;
    try { await Promise.race([document.fonts.load('120px "Great Vibes"'), new Promise(r => setTimeout(r, 900))]); } catch (e) { /* use fallback */ }
    const v = verseOfDay();
    const long = n.length > 11;
    const el = document.createElement('div');
    el.className = 'splash';
    el.innerHTML = `
      <div class="splash-inner">
        <svg class="splash-lamp" viewBox="0 0 64 64" aria-hidden="true"><use href="#lamp"/></svg>
        <div class="splash-greet">${esc(greeting())},</div>
        <svg class="sig" viewBox="0 0 1000 300" role="img" aria-label="${esc(n)}">
          <defs><linearGradient id="sigFill" x1="0" x2="1"><stop offset="0" style="stop-color:var(--gold2)"/><stop offset=".5" style="stop-color:#fff8e6"/><stop offset="1" style="stop-color:var(--gold)"/></linearGradient></defs>
          <text x="500" y="200" text-anchor="middle" class="sig-text" ${long ? 'textLength="940" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(n)}</text>
        </svg>
        <p class="splash-verse">"${esc(v.text).replace(/LORD/g, '<span class="sc">Lord</span>')}"<span>${esc(v.ref)}</span></p>
        <small class="splash-tap">Tap to continue</small>
      </div>`;
    document.body.appendChild(el);
    Sound.play('open');
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      el.classList.add('out');
      setTimeout(() => { el.remove(); maybeInstallBanner(); }, 600);
    };
    el.addEventListener('click', close);
    setTimeout(close, 4600);
  }

  /* ---------------- First run: ask the name ---------------- */
  function onboard() {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'onboard';
      el.innerHTML = `
        <form class="onboard-card" id="obForm">
          <svg class="splash-lamp" viewBox="0 0 64 64" aria-hidden="true"><use href="#lamp"/></svg>
          <h1>Welcome</h1>
          <p class="muted">"Thy word is a lamp unto my feet, and a light unto my path." (Psalm 119:105)</p>
          <label class="flabel" for="obName">What is your name?</label>
          <input class="search ob-name" id="obName" maxlength="40" autocomplete="given-name" placeholder="Your first name" required>
          <label class="flabel">Choose your colour</label>
          <div class="theme-row">${THEMES.map(t => `<button type="button" class="theme-dot ${t[0] === 'gold' ? 'active' : ''}" data-t="${t[0]}" style="--c1:${t[2]};--c2:${t[4]}" title="${t[1]}" aria-label="${t[1]}"></button>`).join('')}</div>
          <button class="btn primary big" type="submit">Begin</button>
          <button class="link-btn" type="button" id="obSkip">Skip for now</button>
        </form>`;
      document.body.appendChild(el);
      let theme = 'gold';
      $$('.onboard .theme-dot').forEach(b => b.addEventListener('click', () => {
        theme = b.dataset.t; $$('.onboard .theme-dot').forEach(x => x.classList.toggle('active', x === b));
        state.profile.theme = theme; apply();
      }));
      setTimeout(() => $('#obName') && $('#obName').focus(), 200);
      const finish = n => {
        Object.assign(state.profile, { name: n, theme, asked: true });
        save(); apply();
        el.classList.add('out');
        setTimeout(() => { el.remove(); resolve(); }, 450);
      };
      $('#obForm').addEventListener('submit', e => { e.preventDefault(); const n = $('#obName').value.trim(); if (n) finish(n); });
      $('#obSkip').addEventListener('click', () => finish(''));
    });
  }

  async function start() {
    apply();
    if (!P().asked) { await onboard(); await splash(true); }
    else if (name()) await splash(false);
    else maybeInstallBanner();
  }

  /* ---------------- Settings ---------------- */
  function openSettings() {
    const p = P();
    window.UI.openModal(`
      <div class="pform settings">
        <div class="eyebrow">Make it yours</div>
        <h2>Personalize</h2>
        <label class="flabel" for="sName">Your name</label>
        <input class="search" id="sName" maxlength="40" placeholder="Your first name" value="${esc(p.name)}">
        <label class="flabel" for="sGreet">Greeting</label>
        <select class="search" id="sGreet">${GREETINGS.map(([k, l]) => `<option value="${k}" ${p.greeting === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <label class="flabel">Colour</label>
        <div class="theme-row">${THEMES.map(t => `<button type="button" class="theme-dot ${p.theme === t[0] ? 'active' : ''}" data-t="${t[0]}" style="--c1:${t[2]};--c2:${t[4]}" title="${t[1]}" aria-label="${t[1]}"></button>`).join('')}</div>
        <label class="flabel" for="sTitle">App title <span class="muted">(optional)</span></label>
        <input class="search" id="sTitle" maxlength="30" placeholder="Lamp & Path" value="${esc(p.title)}">
        <label class="check-row"><input type="checkbox" id="sSplash" ${p.splash ? 'checked' : ''}> Show my name each time the app opens</label>
        <div class="row gap wrap">
          <button class="btn ghost" id="sPreview">▶ Preview welcome</button>
          <button class="btn primary" id="sSave">Save</button>
        </div>
        <h3 class="section-title">Install &amp; share</h3>
        <div class="row gap wrap">
          <button class="btn primary" id="sInstall">📲 Install app</button>
          <button class="btn ghost" id="sShare">🔗 Share with someone</button>
        </div>
      </div>`);
    let theme = p.theme;
    $$('.settings .theme-dot').forEach(b => b.addEventListener('click', () => {
      theme = b.dataset.t; $$('.settings .theme-dot').forEach(x => x.classList.toggle('active', x === b));
      state.profile.theme = theme; apply();
    }));
    const collect = () => Object.assign(state.profile, {
      name: $('#sName').value.trim(), title: $('#sTitle').value.trim(), greeting: $('#sGreet').value,
      theme, splash: $('#sSplash').checked, asked: true
    });
    $('#sSave').addEventListener('click', () => { collect(); save(); apply(); Sound.play('correct'); toast(name() ? `✓ Saved. Welcome, ${name()}!` : '✓ Saved'); window.UI.closeModal(); window.UI.refresh(); });
    $('#sPreview').addEventListener('click', () => { collect(); save(); apply(); splash(true); });
    $('#sInstall').addEventListener('click', install);
    $('#sShare').addEventListener('click', share);
  }

  /* ---------------- Install ---------------- */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; maybeInstallBanner(); });
  window.addEventListener('appinstalled', () => { deferred = null; state.installed = true; save(); hideBanner(); toast(`✓ ${appTitle()} is installed. Find it on your home screen.`, 'level'); });

  const ua = navigator.userAgent;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/.test(ua);
  const inAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|MicroMessenger|; wv\)/i.test(ua);
  const isHosted = () => location.protocol === 'https:' && !/claude\.ai|claudeusercontent/.test(location.host);
  function shareUrl() { return isHosted() ? location.origin + location.pathname.replace(/index\.html$/, '') : APP_URL; }

  async function install() {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => ({}));
      deferred = null;
      if (choice && choice.outcome === 'accepted') return;
    }
    installHelp();
  }

  function installHelp() {
    const url = shareUrl();
    let body;
    if (isStandalone()) body = `<p class="lead">✓ You are already using the installed app.</p>`;
    else if (!isHosted()) body = `
      <p>This copy was opened as a file or inside a preview, and phones only install apps from a web address.</p>
      <ol class="steps"><li>Open this link in <b>Chrome</b> (Android) or <b>Safari</b> (iPhone):</li></ol>
      ${linkBox(url)}
      <p class="muted small">Then come back to this screen and tap <b>Install app</b>.</p>`;
    else if (inAppBrowser()) body = `
      <p>You opened the app inside another app (such as WhatsApp or Instagram), which cannot install it.</p>
      <ol class="steps"><li>Tap the <b>⋮</b> or <b>…</b> menu at the top.</li><li>Choose <b>Open in browser</b> (or Open in Chrome / Safari).</li><li>Tap <b>📲 Install app</b> again there.</li></ol>
      ${linkBox(url)}`;
    else if (isIOS()) body = `
      <ol class="steps">
        <li>Open this page in <b>Safari</b>.</li>
        <li>Tap the <b>Share</b> button <span class="kbd-ic">⬆︎</span> at the bottom (or top) of the screen.</li>
        <li>Scroll and tap <b>Add to Home Screen</b> <span class="kbd-ic">＋</span>.</li>
        <li>Tap <b>Add</b>. The lamp icon appears on your home screen.</li>
      </ol>
      <p class="muted small">Open it from the home-screen icon from now on. Your name, notes and prayers are kept safely there. On iOS 16.4 or newer, Chrome and Edge on iPhone can do this too, from their Share menu.</p>`;
    else if (isAndroid()) body = `
      <ol class="steps">
        <li>In <b>Chrome</b>, tap the <b>⋮</b> menu at the top right.</li>
        <li>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</li>
        <li>Tap <b>Install</b>. The lamp icon appears with your apps.</li>
      </ol>`;
    else body = `
      <ol class="steps">
        <li>In <b>Chrome</b> or <b>Edge</b>, click the install icon <span class="kbd-ic">⊕</span> at the right of the address bar.</li>
        <li>Or open the browser menu and choose <b>Install ${esc(appTitle())}</b>.</li>
      </ol>`;
    window.UI.openModal(`
      <div class="install-help">
        <img class="install-icon" src="${document.querySelector('link[rel="apple-touch-icon"]') ? document.querySelector('link[rel="apple-touch-icon"]').href : ''}" alt="">
        <div class="eyebrow">Install</div>
        <h2>Put ${esc(appTitle())} on your home screen</h2>
        ${body}
        <p class="muted small">Once installed it opens like any other app, full screen, and works with no internet.</p>
        <h3 class="section-title">Share it</h3>
        <p class="muted small">Send the link. Each person gets their own copy with their own name, notes and prayers.</p>
        <div class="row gap wrap"><button class="btn ghost" id="ihShare">🔗 Share the app</button></div>
      </div>`);
    $('#ihShare').addEventListener('click', share);
    bindCopy();
  }

  function linkBox(url) {
    return `<div class="link-box"><input class="search" id="appLink" readonly value="${esc(url)}"><button class="btn primary small" id="copyLink">Copy link</button></div>`;
  }
  function bindCopy() {
    const b = $('#copyLink'); if (!b) return;
    b.addEventListener('click', async () => {
      const inp = $('#appLink');
      try { await navigator.clipboard.writeText(inp.value); toast('🔗 Link copied'); }
      catch (e) { inp.focus(); inp.select(); toast('Select the link and copy it'); }
    });
  }

  async function share() {
    const url = shareUrl();
    const text = `${name() ? name() + ' shared ' : ''}${appTitle()}: the King James Bible, a Bible journey game, daily Bible games and a prayer journal with wake-up prayer alarms. Free, and works offline.`;
    if (navigator.share) {
      try { await navigator.share({ title: appTitle(), text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    window.UI.openModal(`
      <div class="install-help">
        <div class="eyebrow">Share</div>
        <h2>Share ${esc(appTitle())}</h2>
        <p>Send this link by WhatsApp, text or email. People open it, enter their own name, and can install it.</p>
        ${linkBox(url)}
      </div>`);
    bindCopy();
  }

  /* ---------------- Install banner ---------------- */
  function maybeInstallBanner() {
    if (isStandalone() || state.installDismissed || $('.install-banner') || $('.splash') || $('.onboard')) return;
    if (!deferred && !(isHosted() && (isIOS() || isAndroid()))) return;
    const bar = document.createElement('div');
    bar.className = 'install-banner';
    bar.innerHTML = `<img src="${document.querySelector('link[rel="apple-touch-icon"]').href}" alt=""><div><b>Install ${esc(appTitle())}</b><small>Opens like an app and works offline</small></div>
      <button class="btn primary small" id="ibInstall">Install</button><button class="ib-close" id="ibClose" aria-label="Not now">×</button>`;
    document.body.appendChild(bar);
    $('#ibInstall').addEventListener('click', () => { hideBanner(); install(); });
    $('#ibClose').addEventListener('click', () => { state.installDismissed = true; save(); hideBanner(); });
  }
  function hideBanner() { const b = $('.install-banner'); if (b) b.remove(); }

  window.Personal = { start, apply, name, greeting, timeGreeting, appTitle, openSettings, install, share, splash, isStandalone, APP_URL };
})();
