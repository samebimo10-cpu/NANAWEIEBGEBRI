#!/usr/bin/env python3
"""Build the original-language texts and the Hebrew and Greek dictionaries.

Usage:  python3 tools/build_originals.py MORPHHB_DIR BYZ_DIR STRONGS_DIR

  MORPHHB_DIR  a checkout of https://github.com/openscriptures/morphhb
               (Westminster Leningrad Codex, public domain; lemmas and morphology CC BY 4.0)
  BYZ_DIR      a checkout of https://github.com/byztxt/byzantine-majority-text
               (Robinson-Pierpont Byzantine Greek New Testament 2018, public domain)
  STRONGS_DIR  holds strongs-greek-dictionary.js and strongs-hebrew-dictionary.js from
               https://github.com/openscriptures/strongs (Strong's 1890 dictionaries; digital edition CC BY-SA)

Writes js/orig/01.js … 66.js (Hebrew for books 1-39, Greek for 40-66, lined up with KJV verse numbers)
and js/lex/hebrew.js, js/lex/greek.js.
Each verse is a string of words separated by spaces; each word is "text|strong|morph".
"""
import csv, json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MHB, BYZ, STR = sys.argv[1:4]

OT = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth',
      'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab',
      'Zeph', 'Hag', 'Zech', 'Mal']
NT = ['MAT', 'MAR', 'LUK', 'JOH', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB',
      'JAM', '1PE', '2PE', '1JO', '2JO', '3JO', 'JUD', 'REV']


def kjv_book(i):
    src = open(os.path.join(ROOT, 'js', 'kjv', f'{i + 1:02d}.js'), encoding='utf-8').read()
    return json.loads(src[src.index('[['):src.rindex(']') + 1])


def write_book(i, lang, chapters, note):
    body = json.dumps(chapters, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(ROOT, 'js', 'orig', f'{i + 1:02d}.js'), 'w', encoding='utf-8') as f:
        f.write(f'/* {note} Book {i + 1}. */\nwindow.Orig&&Orig._add({i},"{lang}",{body});\n')


os.makedirs(os.path.join(ROOT, 'js', 'orig'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'js', 'lex'), exist_ok=True)

# ---------------- Hebrew (and Aramaic) Old Testament ----------------
CANT = re.compile('[֑-ֽ֯׀׃-׆]')   # cantillation marks and meteg; vowel points are kept
vmap = {}
for m in re.finditer(r'<verse wlc="([^"]+)" kjv="([^"]+)"', open(os.path.join(MHB, 'wlc', 'VerseMap.xml'), encoding='utf-8').read()):
    vmap[m.group(1)] = m.group(2)


def heb_strong(lemma):
    last = lemma.split('/')[-1].strip()
    m = re.match(r'(\d+)', last)
    prefixes = ''.join(p for p in lemma.split('/')[:-1] if re.fullmatch(r'[a-z]', p.strip()))
    if m:
        return prefixes + ('/' if prefixes else '') + 'H' + m.group(1)
    return lemma.replace('/', '').strip()        # a word made only of a prefix with a suffix, e.g. "l" (to him)


ot_stats = [0, 0]
for i, code in enumerate(OT):
    kjv = kjv_book(i)
    out = [[''] * len(ch) for ch in kjv]
    xml = open(os.path.join(MHB, 'wlc', code + '.xml'), encoding='utf-8').read()
    xml = re.sub(r'<note\b.*?</note>', '', xml, flags=re.S)        # leave out marginal readings (qere) and notes
    for vm in re.finditer(r'<verse osisID="([^"]+)">(.*?)</verse>', xml, re.S):
        osis, inner = vm.group(1), vm.group(2)
        target = vmap.get(osis, osis).split('!')[0]   # "!a"/"!b" marks a verse split between two KJV verses
        _, c, v = target.split('.')
        c, v = int(c), int(v)
        words = []
        for wm in re.finditer(r'<w lemma="([^"]*)"[^>]*morph="([^"]*)"[^>]*>([^<]*)</w>(<seg type="x-maqqef">)?', inner):
            lemma, morph, text, maq = wm.groups()
            text = unicodedata.normalize('NFC', CANT.sub('', text)).replace('/', '')
            if maq:
                text += '־'
            words.append(f'{text}|{heb_strong(lemma)}|{morph}')
        if c > len(out) or v > len(out[c - 1]):
            ot_stats[1] += 1
            c = min(c, len(out)); v = len(out[c - 1])
        out[c - 1][v - 1] = (out[c - 1][v - 1] + ' ' + ' '.join(words)).strip()
    ot_stats[0] += sum(1 for ch in out for t in ch if not t)
    write_book(i, 'he', out, 'Westminster Leningrad Codex (public domain), with lemmas and morphology from the Open Scriptures Hebrew Bible (CC BY 4.0).')
print('Hebrew: empty KJV verses', ot_stats[0], '| verses merged', ot_stats[1])

# ---------------- Greek New Testament ----------------
TOK = re.compile(r'(\S+)\s+((?:\d+\s+)+)\{([^}]+)\}')
nt_stats = [0, 0, 0]
for j, code in enumerate(NT):
    i = 39 + j
    kjv = kjv_book(i)
    out = [[''] * len(ch) for ch in kjv]
    acc = {}
    with open(os.path.join(BYZ, 'csv-unicode', 'ccat', 'no-variants', code + '.csv'), encoding='utf-8') as f:
        for row in csv.DictReader(f):
            acc[(int(row['chapter']), int(row['verse']))] = [w for w in row['text'].replace('¶', ' ').split() if w.strip()]
    with open(os.path.join(BYZ, 'csv-unicode', 'strongs', 'with-parsing', code + '.csv'), encoding='utf-8') as f:
        for row in csv.DictReader(f):
            c, v = int(row['chapter']), int(row['verse'])
            accented = acc.get((c, v), [])
            if code == 'ROM' and c == 14 and v > 23:     # the Byzantine text has the closing doxology here; the KJV has it at 16:25-27
                c, v = 16, v + 1
            toks = [(w, nums.split()[0], parse) for w, nums, parse in TOK.findall(row['text'])]
            if len(accented) == len(toks):
                toks = [(a, s, p) for a, (_, s, p) in zip(accented, toks)]
            else:
                nt_stats[2] += 1
            words = ' '.join(f'{w}|G{int(s)}|{p}' for w, s, p in toks)
            if c > len(out) or v > len(out[c - 1]):
                nt_stats[1] += 1
                c = min(c, len(out)); v = len(out[c - 1])
            out[c - 1][v - 1] = (out[c - 1][v - 1] + ' ' + words).strip()
    nt_stats[0] += sum(1 for ch in out for t in ch if not t)
    write_book(i, 'el', out, 'Robinson-Pierpont Byzantine Greek New Testament, 2018 (public domain).')
print('Greek: empty KJV verses', nt_stats[0], '| verses merged', nt_stats[1], '| verses shown without accents', nt_stats[2])

# ---------------- Strong's dictionaries ----------------
for lang, fname, var, out_name in [('H', 'strongs-hebrew-dictionary.js', 'strongsHebrewDictionary', 'hebrew'),
                                   ('G', 'strongs-greek-dictionary.js', 'strongsGreekDictionary', 'greek')]:
    src = open(os.path.join(STR, fname), encoding='utf-8').read()
    data = json.loads(src[src.index('{', src.index(var)):src.rindex('}') + 1])
    lex = {}
    for k, e in data.items():
        definition, derivation = (e.get('strongs_def') or '').strip(), (e.get('derivation') or '').strip()
        # In the Greek data the first part of the definition often sits in "derivation", after its first ";"
        if lang == 'G' and ';' in derivation:
            head, rest = derivation.split(';', 1)
            if rest.strip():
                derivation, definition = head.strip() + ';', (rest.strip().rstrip(';') + '; ' + definition).strip().rstrip(';').replace(';  ', '; ')
        kjv = re.sub(r'(^|[\s(,])X\s', r'\1', (e.get('kjv_def') or '').strip())   # "X" marks an idiom in Strong's
        lex[k] = [e.get('lemma', ''), e.get('xlit') or e.get('translit', ''), e.get('pron', ''), definition, kjv, derivation]
    body = json.dumps(lex, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(ROOT, 'js', 'lex', out_name + '.js'), 'w', encoding='utf-8') as f:
        f.write(f"/* Strong's {'Hebrew and Chaldee' if lang == 'H' else 'Greek'} Dictionary, James Strong, 1890 (public domain). "
                f"Digital edition by Open Scriptures (CC BY-SA). Entries: [lemma, transliteration, pronunciation, definition, KJV renderings, derivation]. */\n"
                f'window.Orig&&Orig._lex("{lang}",{body});\n')
    print(out_name, len(lex), 'entries')

size = lambda d: sum(os.path.getsize(os.path.join(d, x)) for x in os.listdir(d)) / 1e6
print(f"orig {size(os.path.join(ROOT, 'js', 'orig')):.1f} MB, lex {size(os.path.join(ROOT, 'js', 'lex')):.1f} MB")
