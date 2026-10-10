#!/usr/bin/env python3
"""Convert public-domain English Bibles into the app's per-book files, lined up with KJV verse numbers.

Usage:  python3 tools/build_versions.py SOURCE_DIR
SOURCE_DIR holds the JSON files from https://github.com/scrollmapper/bible_databases (formats/json):
ASV.json, YLT.json, Darby.json, BBE.json, Webster.json, BSB.json.
Writes js/ver/<id>/01.js … 66.js and prints any verses that do not line up with the KJV.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
VERSIONS = [  # id, source file, full name
    ('bsb', 'BSB', 'Berean Standard Bible (public domain)'),
    ('asv', 'ASV', 'American Standard Version, 1901 (public domain)'),
    ('ylt', 'YLT', "Young's Literal Translation, 1898 (public domain)"),
    ('darby', 'Darby', 'Darby Bible, 1889 (public domain)'),
    ('webster', 'Webster', 'Webster Bible, 1833 (public domain)'),
    ('bbe', 'BBE', 'Bible in Basic English, 1949/1964 (public domain in the USA)'),
]


def kjv_book(i):
    src = open(os.path.join(ROOT, 'js', 'kjv', f'{i + 1:02d}.js'), encoding='utf-8').read()
    return json.loads(src[src.index('[['):src.rindex(']') + 1])


def clean(t):
    t = re.sub(r'<[^>]+>', '', t)            # stray markup
    t = re.sub(r'\{([^}]*)\}', r'\1', t)      # {added words}
    t = t.replace('¶', '').replace('¶', '')
    t = re.sub(r'(?<=[a-z])(God)', r' \1', t)   # the Darby source lost the space before "God" ("ofGod")
    return re.sub(r'\s+', ' ', t).strip()


for vid, fname, full in VERSIONS:
    data = json.load(open(os.path.join(SRC, fname + '.json'), encoding='utf-8'))['books']
    assert len(data) == 66, (vid, len(data))
    out_dir = os.path.join(ROOT, 'js', 'ver', vid)
    os.makedirs(out_dir, exist_ok=True)
    missing = extra = 0
    for i, book in enumerate(data):
        kjv = kjv_book(i)
        chapters = [[''] * len(ch) for ch in kjv]
        for ch in book['chapters']:
            c = ch['chapter']
            if c > len(chapters):
                extra += len(ch['verses']); continue
            row = chapters[c - 1]
            for v in ch['verses']:
                n, t = v['verse'], clean(v['text'])
                if n <= len(row):
                    row[n - 1] = (row[n - 1] + ' ' + t).strip() if row[n - 1] else t
                elif row:
                    row[-1] = (row[-1] + ' ' + t).strip(); extra += 1   # keep the words, under the last KJV verse
        missing += sum(1 for ch in chapters for t in ch if not t)
        body = json.dumps(chapters, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(out_dir, f'{i + 1:02d}.js'), 'w', encoding='utf-8') as f:
            f.write(f'/* {full}. Book {i + 1}. */\nwindow.Bible&&Bible._addVer("{vid}",{i},{body});\n')
    size = sum(os.path.getsize(os.path.join(out_dir, x)) for x in os.listdir(out_dir))
    print(f'{vid}: empty verses {missing}, merged extra verses {extra}, {size / 1e6:.1f} MB')
