/*
 * The Bible in its original languages, with Strong's Hebrew and Greek dictionaries.
 *  - Old Testament: Westminster Leningrad Codex (Hebrew and Aramaic)
 *  - New Testament: Robinson-Pierpont Byzantine Greek text
 * Each word carries its Strong's number and grammar, so a tap shows what it means.
 */
(function () {
  'use strict';
  const { escapeHTML: esc, Sound, toast } = window.Core;
  const $ = s => document.querySelector(s);
  const B = () => window.Bible;
  const UI = () => window.UI;

  const books = {}, langs = {}, waiting = {};
  const lex = {}, lexWaiting = {};

  /* ---------------- Loading ---------------- */
  function _add(i, lang, data) {
    books[i] = data; langs[i] = lang;
    (waiting[i] || []).forEach(w => w.res(data));
    delete waiting[i];
  }
  function _lex(lang, data) {
    lex[lang] = data;
    (lexWaiting[lang] || []).forEach(w => w.res(data));
    delete lexWaiting[lang];
  }
  function inject(src, inlineId, onerror) {
    const s = document.createElement('script');
    const inline = inlineId && document.getElementById(inlineId);
    if (inline) { s.textContent = inline.textContent; document.head.appendChild(s); return; }
    s.src = src; s.async = true; s.onerror = onerror;
    document.head.appendChild(s);
  }
  let bundleAsked = { orig: false };
  function load(i) {
    if (books[i]) return Promise.resolve(books[i]);
    return new Promise((res, rej) => {
      if (waiting[i]) { waiting[i].push({ res, rej }); return; }
      waiting[i] = [{ res, rej }];
      const fail = () => { const w = waiting[i] || []; delete waiting[i]; w.forEach(x => x.rej(new Error('Could not load the original-language text. Check your connection.'))); };
      if (window.BIBLE_BUNDLES) {
        const part = i < 39 ? 'orig-ot' : 'orig-nt';
        if (!bundleAsked[part]) { bundleAsked[part] = true; inject(window.BIBLE_BUNDLES + part + '.js', null, () => { bundleAsked[part] = false; fail(); }); }
        return;
      }
      const nn = String(i + 1).padStart(2, '0');
      inject(`js/orig/${nn}.js`, `orig-src-${nn}`, fail);
    });
  }
  function loadLex(lang) {
    if (lex[lang]) return Promise.resolve(lex[lang]);
    return new Promise((res, rej) => {
      if (lexWaiting[lang]) { lexWaiting[lang].push({ res, rej }); return; }
      lexWaiting[lang] = [{ res, rej }];
      const name = lang === 'H' ? 'hebrew' : 'greek';
      const fail = () => { const w = lexWaiting[lang] || []; delete lexWaiting[lang]; w.forEach(x => x.rej(new Error('Could not load the dictionary. Check your connection.'))); };
      inject(window.BIBLE_BUNDLES ? window.BIBLE_BUNDLES + 'lex-' + name + '.js' : `js/lex/${name}.js`, `lex-src-${name}`, fail);
    });
  }
  const langOf = b => b < 39 ? 'he' : 'el';

  /* ---------------- Words ---------------- */
  // "text|strong|morph" -> { text, strong, prefixes, morph }
  function parseWord(w) {
    const [text, s = '', morph = ''] = w.split('|');
    const m = s.match(/^([a-z]*)\/?([HG]\d+)?$/);
    return { text, strong: m && m[2] ? m[2] : '', prefixes: m ? m[1] : s, morph };
  }
  async function verseWords(b, c, v) {
    const book = await load(b);
    const t = book[c - 1] && book[c - 1][v - 1];
    return t ? t.split(' ').map(parseWord) : [];
  }
  const entry = s => { const L = lex[s[0]]; return L && L[s] ? L[s] : null; };   // [lemma, translit, pron, def, kjv, derivation]
  /* A short meaning to show under each word: the start of Strong's definition, tidied. */
  function gloss(s) {
    const e = entry(s);
    if (!e) return '';
    let d = (e[3] || '').replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
      .replace(/^\s*(properly|literally|specially|especially|figuratively|a primary (particle|verb|preposition|word)|apparently a primary (particle|verb|word)|a prolonged form of [^;]*);?,?\s*/i, '')
      .replace(/^\s*(properly|literally),?\s*/i, '');
    const parts = d.split(/[;,:]|\bi\.e\.|\bby implication\b/).map(x => x.trim()).filter(Boolean);
    while (parts.length > 1 && /^(demonstrative|causative|adverbial|neuter|masculine|feminine|plural|emphatic|intensive|interrogative|relative|negative|conjunctional|a particle|particle)$/i.test(parts[0])) parts.shift();
    d = parts[0] || '';
    if (!d || d.length > 28) d = (e[4] || '').replace(/\[idiom\]\s*/g, '').split(/[,;]/)[0].replace(/[().+]/g, '').trim() || d.slice(0, 28);
    return d;
  }

  /* ---------------- Grammar (morphology) ---------------- */
  const HEB_PREFIX = { b: 'in, with, by', c: 'and', d: 'the', i: 'is it? (question)', k: 'like, as', l: 'to, for', m: 'from', s: 'who, which' };
  const G = { m: 'masculine', f: 'feminine', b: 'masculine or feminine', c: 'common', n: 'neuter' };
  const NUM = { s: 'singular', p: 'plural', d: 'dual' };
  const STATE = { a: 'absolute', c: 'construct', d: 'determined' };
  const PERS = { 1: '1st person', 2: '2nd person', 3: '3rd person' };
  const HSTEM = { q: 'Qal', N: 'Niphal', p: 'Piel', P: 'Pual', h: 'Hiphil', H: 'Hophal', t: 'Hithpael', o: 'Polel', O: 'Polal', r: 'Hithpolel', m: 'Poel', M: 'Poal', k: 'Palel', K: 'Pulal', Q: 'Qal passive', l: 'Pilpel', L: 'Polpal', f: 'Hithpalpel', D: 'Nithpael', j: 'Pealal', i: 'Pilel', u: 'Hothpaal', c: 'Tiphil', v: 'Hishtaphel', w: 'Nithpalel', y: 'Nithpoel', z: 'Hithpoel' };
  const ASTEM = { q: 'Peal', Q: 'Peil', u: 'Hithpeel', p: 'Pael', P: 'Ithpaal', M: 'Hithpaal', a: 'Aphel', h: 'Haphel', s: 'Saphel', e: 'Shaphel', H: 'Hophal', i: 'Ithpeel', t: 'Hishtaphel', v: 'Ishtaphel', w: 'Hithaphel', o: 'Polel', z: 'Ithpoel', r: 'Hithpolel', f: 'Hithpalpel', b: 'Hephal', c: 'Tiphel', m: 'Poel', l: 'Palpel', L: 'Ithpalpel', O: 'Ithpolel', G: 'Ittaphal' };
  const HTYPE = { p: 'perfect', q: 'sequential perfect', i: 'imperfect', w: 'sequential imperfect (wayyiqtol)', h: 'cohortative', j: 'jussive', v: 'imperative', r: 'active participle', s: 'passive participle', a: 'infinitive absolute', c: 'infinitive construct' };
  function hebSeg(seg, aram) {
    const p = seg[0], r = seg.slice(1);
    const gns = x => [G[x[0]], NUM[x[1]], STATE[x[2]]].filter(Boolean).join(', ');
    const pgn = x => [PERS[x[0]], G[x[1]], NUM[x[2]]].filter(Boolean).join(', ');
    switch (p) {
      case 'A': return [{ a: 'adjective', c: 'number', g: 'gentilic adjective', o: 'ordinal number' }[r[0]] || 'adjective', gns(r.slice(1))].filter(Boolean).join(': ');
      case 'C': return 'conjunction';
      case 'D': return 'adverb';
      case 'N': return r[0] === 'p' ? 'proper name' + (G[r[1]] ? ` (${G[r[1]]})` : '') : [{ c: 'noun', g: 'gentilic noun' }[r[0]] || 'noun', gns(r.slice(1))].filter(Boolean).join(': ');
      case 'P': return [{ d: 'demonstrative pronoun', f: 'indefinite pronoun', i: 'interrogative pronoun', p: 'personal pronoun', r: 'relative pronoun' }[r[0]] || 'pronoun', pgn(r.slice(1))].filter(Boolean).join(': ');
      case 'R': return r[0] === 'd' ? 'preposition with the article' : 'preposition';
      case 'S': return [{ d: 'directional ending (toward)', h: 'paragogic he', n: 'paragogic nun', p: 'pronoun suffix' }[r[0]] || 'suffix', pgn(r.slice(1))].filter(Boolean).join(': ');
      case 'T': return { a: 'particle of affirmation', d: 'the (article)', e: 'particle of exhortation', i: 'question particle', j: 'interjection', m: 'demonstrative particle', n: 'negative particle', o: 'sign of the direct object', r: 'relative particle' }[r[0]] || 'particle';
      case 'V': {
        const stem = (aram ? ASTEM : HSTEM)[r[0]] || '', type = HTYPE[r[1]] || '';
        const rest = r.slice(2);
        const detail = /[rs]/.test(r[1]) ? gns(rest) : /[ac]/.test(r[1]) ? '' : pgn(rest);
        return ['verb', [stem, type].filter(Boolean).join(' '), detail].filter(Boolean).join(': ');
      }
      default: return seg;
    }
  }
  function hebMorph(code) {
    if (!code) return '';
    const aram = code[0] === 'A';
    return (aram ? 'Aramaic. ' : '') + code.slice(1).split('/').map(s => hebSeg(s, aram)).join(' + ');
  }
  const GCASE = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
  const GNUM = { S: 'singular', P: 'plural' };
  const GGEN = { M: 'masculine', F: 'feminine', N: 'neuter' };
  const GTENSE = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect', X: 'no tense' };
  const GVOICE = { A: 'active', M: 'middle', P: 'passive', E: 'middle or passive', D: 'middle (deponent)', O: 'passive (deponent)', N: 'middle or passive (deponent)', Q: 'impersonal active', X: 'no voice' };
  const GMOOD = { I: 'indicative', S: 'subjunctive', O: 'optative', M: 'imperative', N: 'infinitive', P: 'participle', R: 'participle (imperative sense)' };
  const GPOS = { N: 'noun', A: 'adjective', T: 'article', P: 'personal pronoun', R: 'relative pronoun', C: 'reciprocal pronoun', D: 'demonstrative pronoun', K: 'correlative pronoun', I: 'interrogative pronoun', X: 'indefinite pronoun', Q: 'correlative or interrogative pronoun', F: 'reflexive pronoun', S: 'possessive pronoun' };
  const GWORD = { ADV: 'adverb', CONJ: 'conjunction', COND: 'conditional particle', PRT: 'particle', PREP: 'preposition', INJ: 'interjection', ARAM: 'Aramaic word', HEB: 'Hebrew word', 'N-PRI': 'proper name (indeclinable)', 'A-NUI': 'number (indeclinable)', 'N-LI': 'letter (indeclinable)', 'N-OI': 'noun (indeclinable)' };
  function grkMorph(code) {
    if (!code) return '';
    const base = code.replace(/-(ATT|ABB|C|S|I|N|K|P)$/, '');
    if (GWORD[code]) return GWORD[code];
    if (GWORD[base]) return GWORD[base];
    const parts = code.split('-');
    const extra = { C: 'comparative', S: 'superlative', N: 'negative', I: 'interrogative', ATT: 'Attic form' }[parts[parts.length - 1]];
    if (parts[0] === 'V') {
      let t = parts[1] || '';
      const second = t[0] === '2';
      if (second) t = t.slice(1);
      const tense = (second ? 'second ' : '') + (GTENSE[t[0]] || ''), voice = GVOICE[t[1]] || '', mood = GMOOD[t[2]] || '';
      const d = parts[2] || '';
      const detail = /^[123]/.test(d) ? [PERS[d[0]], GNUM[d[1]]].filter(Boolean).join(', ') : [GCASE[d[0]], GNUM[d[1]], GGEN[d[2]]].filter(Boolean).join(', ');
      return ['verb', [tense, voice, mood].filter(Boolean).join(' '), detail].filter(Boolean).join(': ');
    }
    const pos = GPOS[parts[0]] || parts[0];
    let d = parts[1] || '';
    let person = '';
    if (/^[123]/.test(d)) { person = PERS[d[0]]; d = d.slice(1); }
    const detail = [person, GCASE[d[0]], GNUM[d[1]], GGEN[d[2]]].filter(Boolean).join(', ');
    return [pos, detail, extra].filter(Boolean).join(': ');
  }
  const morphText = (lang, code) => lang === 'he' ? hebMorph(code) : grkMorph(code);

  /* ---------------- Rendering ---------------- */
  function wordsHTML(words, lang, cls = 'ow') {
    return words.map((w, i) => `<span class="${cls}" data-wi="${i}">${esc(w.text)}</span>`).join(' ');
  }
  /* Original-language line under a verse in the reader. */
  function lineHTML(b, c, v) {
    const book = books[b];
    const t = book && book[c - 1] && book[c - 1][v - 1];
    if (!book) return '';
    const lang = langs[b];
    if (!t) return `<span class="v-orig empty" lang="${lang === 'he' ? 'he' : 'grc'}">${lang === 'he' ? 'In the Hebrew, this verse is joined to the one next to it.' : 'This verse is not in the Byzantine Greek text, or is joined to the one next to it.'}</span>`;
    return `<span class="v-orig ${lang}" lang="${lang === 'he' ? 'he' : 'grc'}" dir="${lang === 'he' ? 'rtl' : 'ltr'}">${wordsHTML(t.split(' ').map(parseWord), lang)}</span>`;
  }

  /* Word study: what a word means, its grammar, and where else it is used. */
  async function openWord(b, c, v, wi) {
    const words = await verseWords(b, c, v);
    const w = words[wi];
    if (!w) return;
    const lang = langOf(b);
    await loadLex(lang === 'he' ? 'H' : 'G').catch(() => null);
    showEntry(w.strong, { word: w, lang, ref: B().refString(b, c, v, v) });
  }

  function linkStrongs(text) {
    return esc(text).replace(/\b([HG])0*(\d+)\b/g, (m, l, n) => `<button class="sref" data-s="${l}${n}">${l}${n}</button>`);
  }

  /* ---------------- Word study compendium ----------------
   * For one Strong's word: what it means, where it comes from (its roots and the words built from it), how it is
   * used (how often, in which grammatical forms, how the KJV renders it) and where (by book, its first use, and
   * every verse). Usage comes from js/lex/usage-he.js / usage-el.js, built from the tagged original text. */
  const usage = {}, usageWaiting = {};
  function _usage(lang, data) { usage[lang] = data; (usageWaiting[lang] || []).forEach(w => w.res(data)); delete usageWaiting[lang]; }
  function loadUsage(lang) {
    if (usage[lang]) return Promise.resolve(usage[lang]);
    return new Promise((res, rej) => {
      if (usageWaiting[lang]) { usageWaiting[lang].push({ res, rej }); return; }
      usageWaiting[lang] = [{ res, rej }];
      const fail = () => { const w = usageWaiting[lang] || []; delete usageWaiting[lang]; w.forEach(x => x.rej(new Error('Could not load the word index. Check your connection.'))); };
      inject(window.BIBLE_BUNDLES ? window.BIBLE_BUNDLES + 'usage-' + lang + '.js' : `js/lex/usage-${lang}.js`, `usage-src-${lang}`, fail);
    });
  }
  const refsIn = text => [...new Set((text || '').match(/\b[HG]0*\d+\b/g) || [])].map(r => r[0] + String(+r.slice(1)));
  /* words built from each word, read from the "comes from" notes of the whole dictionary */
  const children = {};
  function family(L) {
    if (children[L]) return children[L];
    const kids = {};
    Object.entries(lex[L] || {}).forEach(([k, e]) => refsIn(e[5]).forEach(r => { if (r !== k) (kids[r] = kids[r] || []).push(k); }));
    return (children[L] = kids);
  }
  /* the chain of roots: this word ← the word it comes from ← … */
  function rootChain(s) {
    const chain = [], seen = new Set([s]);
    let cur = s;
    for (let i = 0; i < 5; i++) {
      const e = entry(cur); if (!e) break;
      const next = refsIn(e[5]).find(r => !seen.has(r) && entry(r));
      if (!next) break;
      chain.push(next); seen.add(next); cur = next;
    }
    return chain;
  }
  const decodeRefs = str => (str || '').split(',').filter(Boolean).map(x => x.split('.').map(n => parseInt(n, 36))).map(([b, c, v]) => [b, c, v]);
  const lemmaChip = k => { const e = entry(k); return e ? `<button class="wchip" data-s="${k}"><span class="${k[0] === 'H' ? 'he' : 'el'}" dir="${k[0] === 'H' ? 'rtl' : 'ltr'}">${esc(e[0])}</span><b>${esc(e[1])}</b><small>${esc(gloss(k))}</small></button>` : ''; };
  /* what kind of word it is, from the form it takes most often */
  function kindOf(lang, forms) {
    if (!forms || !forms.length) return '';
    const t = morphText(lang, lang === 'he' ? 'H' + forms[0][0] : forms[0][0]);
    return t.split(/[:,(]/)[0].replace(/^Aramaic\.\s*/, '').trim();
  }
  let study = null;   // the word being studied: { s, refs, page, book }
  async function showEntry(strong, ctx = {}) {
    const L = strong ? strong[0] : (ctx.lang === 'he' ? 'H' : 'G'), lang = L === 'H' ? 'he' : 'el', dir = L === 'H' ? 'rtl' : 'ltr';
    const loading = '<div class="lex-card"><p class="muted">Opening the word study…</p></div>';
    if (document.querySelector('#modal.open .lex-card, #modal.open .interlinear')) $('#modalBody').innerHTML = loading; else UI().openModal(loading, { cls: 'parchment' });
    let u = null;
    if (strong) {
      await loadLex(L).catch(() => null);
      u = await loadUsage(lang).then(d => d[strong] || null).catch(() => null);
    }
    const e = strong ? entry(strong) : null;
    const w = ctx.word;
    const prefixes = w && w.prefixes ? w.prefixes.split('').map(p => HEB_PREFIX[p] ? `<span class="chip">${esc(p === 'd' ? 'הַ' : p === 'c' ? 'וְ' : p === 'b' ? 'בְּ' : p === 'l' ? 'לְ' : p === 'k' ? 'כְּ' : p === 'm' ? 'מִ' : p === 's' ? 'שֶׁ' : 'הֲ')} = ${esc(HEB_PREFIX[p])}</span>` : '').join('') : '';
    const refs = u ? decodeRefs(u[1]) : [];
    study = { s: strong, refs, page: 0, book: -1 };
    const roots = strong ? rootChain(strong) : [];
    const kids = strong ? (family(L)[strong] || []).slice().sort((a, b) => ((usage[lang] || {})[b] || [0])[0] - ((usage[lang] || {})[a] || [0])[0]) : [];
    const sibs = roots.length ? (family(L)[roots[0]] || []).filter(k => k !== strong && !kids.includes(k)).slice(0, 18) : [];
    const kind = u ? kindOf(lang, u[2]) : '';
    const primitive = e && /primitive (root|word|particle|verb)|primary (word|verb|particle|preposition)/i.test(e[5] + ' ' + e[3]);
    const foreign = e && /of (Hebrew|Aramaic|Chaldee|Latin|foreign|Egyptian|Persian) origin/i.exec(e[5] || '');
    const byBook = {}; refs.forEach(([b]) => { byBook[b] = (byBook[b] || 0) + 1; });
    const bookList = Object.keys(byBook).map(Number).sort((a, b) => a - b);
    const most = bookList.slice().sort((a, b) => byBook[b] - byBook[a]);
    const maxB = Math.max(1, ...Object.values(byBook));
    const first = refs[0];
    if (first) await B().load(first[0]).catch(() => null);
    const html = `
      <div class="lex-card study">
        <div class="eyebrow">${L === 'H' ? 'Hebrew' : 'Greek'} word study${ctx.ref ? ' · ' + esc(ctx.ref) : ''}</div>
        ${w ? `<div class="lex-word ${lang}" dir="${dir}">${esc(w.text)}</div>` : ''}
        ${e ? `<div class="lex-lemma"><span class="${lang}" dir="${dir}">${esc(e[0])}</span>
          <span class="lex-xlit">${esc(e[1])}</span>${e[2] ? `<span class="muted small">say: ${esc(e[2])}</span>` : ''}
          <span class="pill">Strong's ${esc(strong)}</span>${kind ? `<span class="pill soft">${esc(kind)}</span>` : ''}</div>` : strong ? `<p class="muted">No dictionary entry for ${esc(strong)}.</p>` : ''}
        ${w && w.morph ? `<div class="lex-row"><b>Here</b><span>${esc(morphText(lang, w.morph))}</span></div>` : ''}
        ${prefixes ? `<div class="lex-row"><b>Joined to</b><span class="chips">${prefixes}</span></div>` : ''}
        ${u ? `<div class="study-stats"><div><b>${u[0].toLocaleString()}</b><small>time${u[0] === 1 ? '' : 's'} in the ${L === 'H' ? 'Old' : 'New'} Testament</small></div><div><b>${refs.length.toLocaleString()}</b><small>verse${refs.length === 1 ? '' : 's'}</small></div><div><b>${bookList.length}</b><small>book${bookList.length === 1 ? '' : 's'}</small></div></div>` : ''}

        ${e && e[3] ? `<section class="study-sec"><h3>📖 Meaning</h3><p>${linkStrongs(e[3])}</p></section>` : ''}

        ${e ? `<section class="study-sec"><h3>🌱 Origin</h3>
          ${e[5] ? `<p>${linkStrongs(e[5])}</p>` : ''}
          ${roots.length ? `<div class="root-chain"><span class="rc-this ${lang}" dir="${dir}">${esc(e[0])}</span>${roots.map(r => `<span class="rc-arrow">←</span>${lemmaChip(r)}`).join('')}</div>
            <p class="muted small">${roots.length === 1 ? 'It comes from this word.' : 'Each word comes from the next: follow the line back to the root.'}</p>`
            : primitive ? `<p class="muted small">A root word: it is not built from another ${L === 'H' ? 'Hebrew' : 'Greek'} word. Other words grow from it.</p>`
            : foreign ? `<p class="muted small">A word taken over from another language.</p>` : ''}
        </section>` : ''}

        ${kids.length || sibs.length ? `<section class="study-sec"><h3>🌳 Word family</h3>
          ${kids.length ? `<p class="muted small">${kids.length} word${kids.length === 1 ? ' is' : 's are'} built from it:</p><div class="wchips">${kids.slice(0, 24).map(lemmaChip).join('')}</div>${kids.length > 24 ? `<p class="muted small">…and ${kids.length - 24} more.</p>` : ''}` : ''}
          ${sibs.length ? `<p class="muted small">Words from the same root (${esc(entry(roots[0])[1])}):</p><div class="wchips">${sibs.map(lemmaChip).join('')}</div>` : ''}
        </section>` : ''}

        ${e || u ? `<section class="study-sec"><h3>🗣️ How it is used</h3>
          ${e && e[4] ? `<p class="muted small">How the King James Version translates it:</p><div class="chips">${e[4].replace(/\[idiom\]\s*/g, '').replace(/\.$/, '').split(/,\s*(?![^()]*\))/).filter(Boolean).slice(0, 30).map(x => `<span class="chip">${esc(x.trim())}</span>`).join('')}</div>` : ''}
          ${u && u[2].length ? `<p class="muted small">The forms it takes in the text:</p><div class="forms">${u[2].map(([m, n]) => `<div class="form-row"><span>${esc(morphText(lang, lang === 'he' ? 'H' + m : m) || m)}</span><i style="--w:${Math.round(n / u[2][0][1] * 100)}%"></i><b>${n}</b></div>`).join('')}</div>` : ''}
        </section>` : ''}

        ${refs.length ? `<section class="study-sec"><h3>📍 Where it is used</h3>
          ${first ? `<div class="first-use"><small>First used</small><button class="result-item" data-b="${first[0]}" data-c="${first[1]}" data-v="${first[2]}"><b>${esc(B().NAMES[first[0]])} ${first[1]}:${first[2]}</b><span>${esc(B().text(first[0], first[1], first[2]) || '')}</span></button></div>` : ''}
          ${most.length > 1 ? `<p class="muted small">Most often in ${most.slice(0, 3).map(b => `<b>${esc(B().NAMES[b])}</b> (${byBook[b]})`).join(', ')}.</p>` : ''}
          <div class="book-bars">${bookList.map(b => `<button class="bbar" data-book="${b}" title="${esc(B().NAMES[b])}: ${byBook[b]} verse${byBook[b] === 1 ? '' : 's'}"><span>${esc(B().SHORT ? B().SHORT[b] : B().NAMES[b])}</span><i style="--w:${Math.max(4, Math.round(byBook[b] / maxB * 100))}%"></i><b>${byBook[b]}</b></button>`).join('')}</div>
          <div id="lexUsesOut"></div>
        </section>` : ''}

        <p class="muted small lex-credit">Strong's ${L === 'H' ? 'Hebrew and Chaldee' : 'Greek'} Dictionary (1890). ${L === 'H' ? 'Hebrew text: Westminster Leningrad Codex; grammar: Open Scriptures Hebrew Bible.' : 'Greek text: Robinson-Pierpont Byzantine Textform.'} Counts are from the original text.</p>
      </div>`;
    if (!document.querySelector('#modal.open .lex-card')) return;   // closed while loading
    $('#modalBody').innerHTML = html;
    $('#modalBody').scrollTop = 0; document.querySelector('#modal .modal-card').scrollTop = 0;
    Sound.play('tap');
    const body = $('#modalBody');
    body.querySelectorAll('.sref, .wchip').forEach(btn => btn.addEventListener('click', () => showEntry(btn.dataset.s)));
    body.querySelectorAll('.first-use .result-item').forEach(el => el.addEventListener('click', () => { UI().closeModal(); window.Reader.open(+el.dataset.b, +el.dataset.c, +el.dataset.v); }));
    body.querySelectorAll('.bbar').forEach(el => el.addEventListener('click', () => {
      const bk = +el.dataset.book;
      study.book = study.book === bk ? -1 : bk; study.page = 0;
      body.querySelectorAll('.bbar').forEach(x => x.classList.toggle('on', +x.dataset.book === study.book));
      findUses(strong);
    }));
    if (refs.length) findUses(strong);
  }

  /* The verses where the word is used: all of them, or one book's, 40 at a time with the KJV text. */
  async function findUses(strong) {
    const out = $('#lexUsesOut'); if (!out) return;
    if (!study || study.s !== strong) {
      const u = await loadUsage(strong[0] === 'H' ? 'he' : 'el').catch(() => null);
      study = { s: strong, refs: u && u[strong] ? decodeRefs(u[strong][1]) : [], page: 0, book: -1 };
    }
    const list = study.book < 0 ? study.refs : study.refs.filter(r => r[0] === study.book);
    const per = 40, from = study.page * per, page = list.slice(from, from + per);
    out.innerHTML = '<p class="muted small">Opening the verses…</p>';
    await Promise.all([...new Set(page.map(h => h[0]))].map(b => B().load(b).catch(() => null)));
    if (!$('#lexUsesOut')) return;
    const pages = Math.ceil(list.length / per);
    out.innerHTML = `<p class="muted small">${study.book < 0 ? 'Every verse' : 'In ' + esc(B().NAMES[study.book])} · ${list.length} verse${list.length === 1 ? '' : 's'}${pages > 1 ? ` · page ${study.page + 1} of ${pages}` : ''}${study.book >= 0 ? ' · <button class="link-btn" id="usesAll">show all books</button>' : ' · tap a book above to see only its verses'}</p>
      <div class="results">${page.map(([b, c, v]) => `<button class="result-item" data-b="${b}" data-c="${c}" data-v="${v}"><b>${esc(B().NAMES[b])} ${c}:${v}</b><span>${esc(B().text(b, c, v) || '')}</span></button>`).join('')}</div>
      ${pages > 1 ? `<div class="row gap center"><button class="btn ghost small" id="usesPrev" ${study.page ? '' : 'disabled'}>← Earlier</button><button class="btn ghost small" id="usesNext" ${study.page + 1 < pages ? '' : 'disabled'}>Later →</button></div>` : ''}`;
    out.querySelectorAll('.result-item').forEach(el => el.addEventListener('click', () => { UI().closeModal(); window.Reader.open(+el.dataset.b, +el.dataset.c, +el.dataset.v); }));
    const go = d => { study.page += d; findUses(strong); out.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    const p = $('#usesPrev'), n = $('#usesNext'), all = $('#usesAll');
    if (p) p.addEventListener('click', () => go(-1));
    if (n) n.addEventListener('click', () => go(1));
    if (all) all.addEventListener('click', () => { study.book = -1; study.page = 0; document.querySelectorAll('.bbar').forEach(x => x.classList.remove('on')); findUses(strong); });
  }

  /* Interlinear: each original word with its meaning and grammar, for the chosen verses. */
  async function interlinear(b, c, vs) {
    const lang = langOf(b);
    UI().openModal('<div class="interlinear"><p class="muted">Opening the original text…</p></div>', { cls: 'parchment' });
    let rows;
    try {
      await Promise.all([load(b), loadLex(lang === 'he' ? 'H' : 'G'), B().load(b)]);
      rows = await Promise.all(vs.map(v => verseWords(b, c, v)));
    } catch (e) { $('#modalBody').innerHTML = `<div class="interlinear"><p class="muted">${esc(e.message)}</p></div>`; return; }
    if (!document.querySelector('#modal:not(.hidden) #modalBody .interlinear')) return;
    $('#modalBody').innerHTML = `
      <div class="interlinear">
        <div class="eyebrow">${lang === 'he' ? 'Hebrew' : 'Greek'} · word by word</div>
        <h2>${esc(B().refString(b, c, vs[0], vs[vs.length - 1]))}</h2>
        ${vs.map((v, k) => `
          <div class="il-verse">
            <p class="il-kjv"><sup>${v}</sup>${esc(B().text(b, c, v) || '')}</p>
            ${rows[k].length ? `<div class="il-words ${lang}" dir="${lang === 'he' ? 'rtl' : 'ltr'}">${rows[k].map((w, i) => {
              const e = w.strong ? entry(w.strong) : null;
              return `<button class="il-w" data-v="${v}" data-wi="${i}">
                <span class="il-o" lang="${lang === 'he' ? 'he' : 'grc'}">${esc(w.text)}</span>
                <span class="il-x" dir="ltr">${esc(e ? e[1] : '')}</span>
                <span class="il-g" dir="ltr">${esc(gloss(w.strong) || (w.prefixes && !w.strong ? w.prefixes.split('').map(p => HEB_PREFIX[p] || '').join(' + ') : ''))}</span>
                <span class="il-s" dir="ltr">${esc(w.strong)}</span></button>`;
            }).join('')}</div>` : `<p class="muted small">${lang === 'he' ? 'In the Hebrew, this verse is joined to the one next to it.' : 'This verse is not in the Byzantine Greek text, or is joined to the one next to it.'}</p>`}
          </div>`).join('')}
        <p class="muted small">Tap a word for its full meaning, grammar and every place it is used. ${lang === 'he' ? 'Hebrew reads from right to left.' : ''}</p>
      </div>`;
    document.querySelectorAll('#modalBody .il-w').forEach(el => el.addEventListener('click', () => openWord(b, c, +el.dataset.v, +el.dataset.wi)));
  }

  /* ---------------- The dictionary page (in Grow) ---------------- */
  const strip = s => s.normalize('NFD').replace(/[̀-֑ͯ-ׇ]/g, '').toLowerCase();
  // match the way people spell a word by ear: "shalom" finds Strong's "shâlôwm", "chesed" finds "cheçed"
  const loose = s => strip(s.replace(/ç/gi, 's')).replace(/[ʼʻ'’`\-\s]/g, '').replace(/ᵉ/g, 'e')
    .replace(/ow/g, 'o').replace(/uw/g, 'u').replace(/iy/g, 'i').replace(/kh|ch/g, 'h').replace(/c/g, 'k')
    .replace(/ph/g, 'f').replace(/th/g, 't').replace(/[yu]/g, 'i').replace(/(.)\1/g, '$1');
  let lastQuery = '';
  async function renderDictionary(host) {
    host.innerHTML = `
      <p class="muted">A study compendium of every word in the Hebrew Old Testament and the Greek New Testament. Each word opens with its <b>meaning</b>, its <b>origin</b> (the root it grows from and the words built from it), <b>how it is used</b> (its forms and how the KJV translates it) and <b>where</b> (every book and verse, and where it first appears).</p>
      <p class="muted small">Search by English meaning (<i>love</i>, <i>peace</i>), by Strong's number (<b>H7965</b>, <b>G26</b>), or by the Hebrew or Greek word or its sound (<i>shalom</i>, <i>agape</i>). Or tap any word in the Bible with 🔤 Hebrew/Greek turned on.</p>
      <div class="add-row"><input class="search" id="dictQ" placeholder="e.g. grace, H2617, G5485, chesed" value="${esc(lastQuery)}"><button class="btn primary" id="dictGo">Search</button></div>
      <div class="chips">${[['G26', 'agapē · love'], ['H7965', 'shalom · peace'], ['H2617', 'chesed · lovingkindness'], ['G5485', 'charis · grace'], ['H3068', 'YHWH · the LORD'], ['G4102', 'pistis · faith'], ['H539', 'aman · believe'], ['G3056', 'logos · word'], ['H7307', 'ruach · spirit'], ['G1515', 'eirēnē · peace'], ['H1288', 'barak · bless'], ['G4991', 'sōtēria · salvation']].map(([s, l]) => `<button class="chip ref" data-s="${s}">${esc(l)}</button>`).join('')}</div>
      <div id="dictOut"></div>
      <section class="study-browse" id="dictFamilies"></section>
      <p class="muted small lex-credit">Strong's Hebrew and Greek dictionaries (James Strong, 1890; public domain), digital edition by Open Scriptures (CC BY-SA). Hebrew text: Westminster Leningrad Codex (public domain), with grammar from the Open Scriptures Hebrew Bible (CC BY 4.0). Greek text: Robinson-Pierpont Byzantine Textform 2018 (public domain). Counts of use are from these texts.</p>`;
    // the great root words: the ones with the largest families of words built from them
    Promise.all([loadLex('H'), loadLex('G')]).then(() => {
      const box = host.querySelector('#dictFamilies'); if (!box) return;
      const top = L => Object.entries(family(L)).filter(([k]) => entry(k)).sort((a, b) => b[1].length - a[1].length).slice(0, 12);
      box.innerHTML = `<h3>🌳 Great word families</h3><p class="muted small">Root words that many other words grow from. Open one to see its family.</p>
        ${['H', 'G'].map(L => `<p class="muted small"><b>${L === 'H' ? 'Hebrew' : 'Greek'}</b></p><div class="wchips">${top(L).map(([k, kids]) => lemmaChip(k).replace('</small></button>', ` · ${kids.length} words</small></button>`)).join('')}</div>`).join('')}`;
      box.querySelectorAll('.wchip').forEach(b => b.addEventListener('click', () => showEntry(b.dataset.s)));
    }).catch(() => {});
    const go = async () => {
      const q = host.querySelector('#dictQ').value.trim();
      lastQuery = q;
      const out = host.querySelector('#dictOut');
      if (!q) { out.innerHTML = ''; return; }
      out.innerHTML = '<p class="muted">Searching…</p>';
      try { await Promise.all([loadLex('H'), loadLex('G')]); await Promise.all([loadUsage('he'), loadUsage('el')]).catch(() => null); } catch (e) { out.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
      const m = q.match(/^([HhGg])\s*0*(\d+)$/);
      if (m) { showEntry(m[1].toUpperCase() + m[2]); out.innerHTML = ''; return; }
      const sq = strip(q), lq = loose(q);
      const results = [];
      ['H', 'G'].forEach(L => Object.entries(lex[L]).forEach(([k, e]) => {
        const lemma = strip(e[0]), xl = strip(e[1]), kjv = (e[4] || '').toLowerCase(), def = (e[3] || '').toLowerCase();
        let score = 0;
        const lx = loose(e[1]);
        if (lemma === sq || xl === sq || lx === lq) score = 100;
        else if (xl.startsWith(sq) || lemma.startsWith(sq) || (lq.length > 3 && lx.startsWith(lq))) score = 60;
        else if (new RegExp('(^|[^a-z])' + sq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(kjv)) score = 40;
        else if (def.includes(sq)) score = 15;
        const used = ((usage[L === 'H' ? 'he' : 'el'] || {})[k] || [0])[0];   // the commonly used words first
        if (score) results.push([score + Math.min(12, Math.log10(1 + used) * 4) - (e[4] || '').length / 1000, k, e]);
      }));
      results.sort((a, b) => b[0] - a[0]);
      out.innerHTML = results.length ? `<p class="muted small">${results.length} entr${results.length === 1 ? 'y' : 'ies'}${results.length > 80 ? ' · showing the best 80' : ''}</p>
        <div class="dict-list">${results.slice(0, 80).map(([, k, e]) => `<button class="dict-item" data-s="${k}">
          <span class="dict-lemma ${k[0] === 'H' ? 'he' : 'el'}" dir="${k[0] === 'H' ? 'rtl' : 'ltr'}">${esc(e[0])}</span>
          <span class="dict-main"><b>${esc(e[1])}</b> <span class="pill">${k}</span>${(usage[k[0] === 'H' ? 'he' : 'el'] || {})[k] ? ` <span class="muted small">· used ${usage[k[0] === 'H' ? 'he' : 'el'][k][0]}×</span>` : ''}<small>${esc((e[4] || e[3] || '').replace(/\[idiom\]\s*/g, '').slice(0, 110))}</small></span></button>`).join('')}</div>`
        : '<p class="muted center">No entries found. Try another English word, or a Strong\'s number like G26.</p>';
      out.querySelectorAll('.dict-item').forEach(b => b.addEventListener('click', () => showEntry(b.dataset.s)));
    };
    host.querySelector('#dictGo').addEventListener('click', go);
    host.querySelector('#dictQ').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    host.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => showEntry(b.dataset.s)));
    if (lastQuery) go();
  }

  window.Orig = { _add, _lex, _usage, loadUsage, load, loadLex, isLoaded: i => !!books[i], langOf, verseWords, parseWord, entry, gloss, morphText, lineHTML, openWord, showEntry, interlinear, renderDictionary, findUses };
})();
