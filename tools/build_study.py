#!/usr/bin/env python3
"""Build cross-references per book, lined up with KJV verse numbers.

Usage:  python3 tools/build_study.py XREF_TXT

  XREF_TXT  cross_references.txt from OpenBible.info (CC BY), as mirrored by scrollmapper/bible_databases
            (sources/extras/cross_references.txt)

Writes js/xref/01.js … 66.js.
"""
import collections, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XREF = sys.argv[1]

OSIS = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth',
        'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab',
        'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess',
        '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev']
IDX = {o: i for i, o in enumerate(OSIS)}
NAMES = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
         '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
         'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
         'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
         'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
         'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']
NIDX = {n: i for i, n in enumerate(NAMES)}
NIDX['Psalm'] = 18; NIDX['Song of Songs'] = 21


def kjv_shape(i):
    src = open(os.path.join(ROOT, 'js', 'kjv', f'{i + 1:02d}.js'), encoding='utf-8').read()
    return [len(ch) for ch in json.loads(src[src.index('[['):src.rindex(']') + 1])]


SHAPES = [kjv_shape(i) for i in range(66)]
valid = lambda b, c, v: 0 <= b < 66 and 1 <= c <= len(SHAPES[b]) and 1 <= v <= SHAPES[b][c - 1]

# ---------------- Cross-references ----------------
PER_VERSE, MIN_VOTES = 10, 2
refs = collections.defaultdict(list)
for line in open(XREF, encoding='utf-8'):
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 3 or not parts[2].lstrip('-').isdigit():
        continue
    votes = int(parts[2])
    if votes < MIN_VOTES:
        continue
    fb, fc, fv = parts[0].split('.')
    to = parts[1].split('-')
    tb, tc, tv = to[0].split('.')
    if fb not in IDX or tb not in IDX:
        continue
    b, c, v = IDX[fb], int(fc), int(fv)
    t = (IDX[tb], int(tc), int(tv))
    if not valid(b, c, v) or not valid(*t):
        continue
    end = ''
    if len(to) > 1:
        eb, ec, ev = to[1].split('.')
        if IDX.get(eb) == t[0] and int(ec) == t[1] and int(ev) > t[2]:
            end = '-' + ev
    refs[(b, c, v)].append((votes, f'{t[0]}.{t[1]}.{t[2]}{end}'))

os.makedirs(os.path.join(ROOT, 'js', 'xref'), exist_ok=True)
total = 0
for b in range(66):
    out = [[''] * n for n in SHAPES[b]]
    for c, n in enumerate(SHAPES[b], 1):
        for v in range(1, n + 1):
            best = sorted(refs.get((b, c, v), []), key=lambda x: -x[0])[:PER_VERSE]
            out[c - 1][v - 1] = ' '.join(r for _, r in best)
            total += len(best)
    body = json.dumps(out, separators=(',', ':'))
    with open(os.path.join(ROOT, 'js', 'xref', f'{b + 1:02d}.js'), 'w', encoding='utf-8') as f:
        f.write(f'/* Cross-references from OpenBible.info (CC BY), the most helpful {PER_VERSE} for each verse. Book {b + 1}. Each entry: book.chapter.verse[-end]. */\n'
                f'window.Study&&Study._xref({b},{body});\n')
print('cross-references:', total)

size = lambda d: sum(os.path.getsize(os.path.join(ROOT, 'js', d, x)) for x in os.listdir(os.path.join(ROOT, 'js', d))) / 1e6
print(f'xref {size("xref"):.1f} MB')
