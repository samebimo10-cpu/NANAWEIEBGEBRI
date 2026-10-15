"""
Word-study index for the Greek and Hebrew compendium: for every Strong's number, where it is used (each verse, in
order) and in which grammatical forms. Read from the tagged original text in js/orig/*.js (Westminster Leningrad
Codex with Open Scriptures morphology; Robinson-Pierpont Byzantine Greek). Writes js/lex/usage-he.js and
js/lex/usage-el.js, loaded only when a word is studied.

Format per word: [verses, forms]
  verses: one string, each verse as base-36 "b.c.v" joined by "," (b = 0-based book), a verse once even if the
          word comes twice in it; the total number of times it occurs is kept separately.
  forms:  [[morphology code, count], ...] most common first (up to 8)
"""
import json, os, re
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
b36 = lambda n: format(n, 'x') if False else (lambda x: '0' if x == 0 else ''.join('0123456789abcdefghijklmnopqrstuvwxyz'[d] for d in digits(x)))(n)


def digits(x):
    out = []
    while x:
        out.append(x % 36); x //= 36
    return out[::-1]


def build(lang, books):
    verses, count, forms = defaultdict(list), Counter(), defaultdict(Counter)
    for b in books:
        src = open(os.path.join(ROOT, 'js', 'orig', '%02d.js' % (b + 1)), encoding='utf-8').read()
        data = json.loads(src[src.index('['):src.rindex(']') + 1])
        for c, ch in enumerate(data):
            for v, line in enumerate(ch):
                if not line: continue
                seen = set()
                for tok in line.split(' '):
                    parts = tok.split('|')
                    if len(parts) < 3: continue
                    for s in re.findall(r'[HG]\d+', parts[1]):
                        s = s[0] + str(int(s[1:]))
                        count[s] += 1
                        m = parts[2]
                        if lang == 'he':   # the morphology of the word itself, not its joined prefixes
                            segs = (m[1:] if m[:1] in ('H', 'A') else m).split('/')
                            main = [x for x in segs if not x.startswith('S')] or segs   # drop pronoun endings
                            m = main[-1]                                                 # prefixes come first
                        forms[s][m] += 1
                        if s not in seen:
                            seen.add(s); verses[s].append('%s.%s.%s' % (b36(b), b36(c + 1), b36(v + 1)))
    out = {s: [count[s], ','.join(verses[s]), [[m, n] for m, n in forms[s].most_common(8)]] for s in verses}
    name = 'usage-%s.js' % lang
    js = ('/* Where each Strong\'s word is used and in which forms, read from the %s text (public domain).\n'
          ' * Built by tools/build_compendium.py. [occurrences, verses "b.c.v" in base 36, [[form, count]]] */\n'
          'window.Orig&&Orig._usage("%s",%s);\n') % ('Hebrew (Westminster Leningrad Codex, morphology: Open Scriptures Hebrew Bible, CC BY 4.0)' if lang == 'he' else 'Greek (Robinson-Pierpont Byzantine)', lang, json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    open(os.path.join(ROOT, 'js', 'lex', name), 'w', encoding='utf-8').write(js)
    print(name, len(out), 'words', sum(count.values()), 'occurrences', len(js) // 1024, 'KB')


if __name__ == '__main__':
    build('he', range(0, 39))
    build('el', range(39, 66))
