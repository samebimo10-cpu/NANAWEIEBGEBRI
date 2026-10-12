#!/usr/bin/env python3
"""
Build js/data/hymns.js: public-domain hymns in four parts, for the app's hymn player.

The scores come from the freehymns project (https://github.com/freehymns/hymns), ABC files marked
"Public Domain". Each hymn is moved into the key the app plays it in, and every note is stored as
  start, length (in 1/24 of a quarter note), MIDI pitch, voice (0 soprano, 1 alto, 2 tenor, 3 bass)

Usage:
  git clone --depth 1 https://github.com/freehymns/hymns.git /tmp/freehymns
  python3 tools/build_hymns.py /tmp/freehymns/music
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from new_tunes import COMPOSED, compose   # noqa: E402
from fractions import Fraction as F

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/freehymns/music'
TPQ = 24   # ticks per quarter note

# number, title, freehymns file, tune name, primary key, easy key, time (as usually printed), common progression
HYMNS = [
    (1, 'Amazing Grace', 'n/NewBritain', 'NEW BRITAIN', 'G', 'F', '3/4', 'I – IV – I – V7'),
    (2, 'Great Is Thy Faithfulness', None, 'FAITHFULNESS', 'Eb', 'D', '3/4', 'I – IV – I – V7 – I'),
    (3, 'How Great Thou Art', None, 'O STORE GUD', 'Bb', 'A', '4/4', 'I – IV – I – V7 – I'),
    (4, 'Blessed Assurance', 'a/Assurance', 'ASSURANCE', 'D', 'C', '9/8', 'I – IV – I – V – I'),
    (5, 'It Is Well With My Soul', 'v/VilleDuHavre', 'VILLE DU HAVRE', 'C', 'Bb', '4/4', 'I – V – IV – I'),
    (6, 'Holy, Holy, Holy! Lord God Almighty', 'n/Nicaea', 'NICAEA', 'D', 'C', '4/4', 'I – vi – ii – V7 – I'),
    (7, 'What a Friend We Have in Jesus', 'e/Erie', 'CONVERSE', 'F', 'Eb', '4/4', 'I – IV – I – V – I'),
    (8, 'To God Be the Glory', 't/ToGodBeTheGlory', 'TO GOD BE THE GLORY', 'Ab', 'G', '3/4', 'I – V – I – IV – V7 – I'),
    (9, 'Rock of Ages', 't/Toplady', 'TOPLADY', 'Bb', 'A', '3/4', 'I – IV – I – V7 – I'),
    (10, 'Leaning on the Everlasting Arms', 'l/LeaningOnTheEverlastingArms', 'SHOWALTER', 'Ab', 'G', '4/4', 'I – IV – I – V – I'),
    (11, 'Be Thou My Vision', 's/Slane', 'SLANE', 'Eb', 'D', '3/4', 'I – vi – IV – I – V'),
    (12, 'When I Survey the Wondrous Cross', 'h/Hamburg', 'HAMBURG', 'F', 'Eb', '4/4', 'I – IV – I – ii – V7 – I'),
    (13, 'Crown Him with Many Crowns', 'd/Diademata', 'DIADEMATA', 'D', 'C', '4/4', 'I – IV – V – vi – ii – V – I'),
    (14, "'Tis So Sweet to Trust in Jesus", 't/TisSoSweetToTrustInJesus', 'TRUST IN JESUS', 'Ab', 'G', '4/4', 'I – IV – I – V7 – I'),
    (15, 'The Old Rugged Cross', 'the/TheOldRuggedCross', 'OLD RUGGED CROSS', 'Bb', 'A', '6/8', 'I – IV – I – V7 – I'),
    (16, 'Softly and Tenderly Jesus Is Calling', 's/SoftlyAndTenderlyJesusIsCalling', 'THOMPSON', 'Ab', 'G', '6/8', 'I – IV – I – V7 – I'),
    (17, 'A Mighty Fortress Is Our God', 'an/AMightyFortressIsOurGod', 'EIN FESTE BURG', 'C', 'D', '4/4', 'I – V – vi – IV – V – I'),
    (18, 'Take My Life and Let It Be', 'h/Hendon', 'HENDON', 'F', 'G', '4/4', 'I – ii – V7 – I'),
    (19, 'Guide Me, O Thou Great Jehovah', 'c/CwmRhondda', 'CWM RHONDDA', 'Ab', 'G', '4/4', 'I – IV – I – V – I'),
    (20, 'Pass Me Not, O Gentle Savior', 'p/PassMeNotOGentleSavior', 'PASS ME NOT', 'Ab', 'G', '4/4', 'I – IV – I – V7 – I'),
    (21, 'Come, Thou Fount of Every Blessing', 'n/Nettleton', 'NETTLETON', 'D', 'C', '3/4', 'I – V – IV – I'),
    (22, 'Jesus Paid It All', 'j/JesusPaidItAll', 'ALL TO CHRIST', 'Eb', 'D', '3/4', 'I – V – I – IV – V7 – I'),
    (23, 'Standing on the Promises', 's/StandingOnThePromises', 'PROMISES', 'Bb', 'A', '4/4', 'I – IV – I – V7 – I'),
    (24, 'Count Your Blessings', 'c/CountYourBlessings', 'BLESSINGS', 'Eb', 'D', '2/4', 'I – V – I – IV – V – I'),
    (25, 'Praise to the Lord, the Almighty', 'l/LobeDenHerren', 'LOBE DEN HERREN', 'G', 'F', '3/4', 'I – IV – V – vi – I'),
    # two the app already played before the lists here
    (45, 'Joyful, Joyful, We Adore Thee', 'o/OdeToJoy', 'HYMN TO JOY', 'G', 'F', '4/4', 'I – V – I'),
    (46, 'Jesus Loves Me', 'j/JesusLovesMe', 'JESUS LOVES ME', 'C', 'D', '4/4', 'I – IV – I – V – I'),
]
# Devotional hymns and spirituals: number, title, freehymns file (None: keyboard backing), key, easy key, time,
# keyboard style for a backing, chords, theme. Take My Life and Let It Be is already number 18 above.
DEVOTIONAL = [
    (26, 'Be Still, My Soul', None, 'F', 'Eb', '4/4', 'Traditional Hymn', 'I - V - vi - IV - V - I', "Resting in God's sovereign stillness"),
    (27, 'Dear Lord and Father of Mankind', None, 'Eb', 'D', '4/4', 'Traditional Hymn', 'I - vi - ii - V7 - I', 'Inner calm, quiet trust and peace'),
    (28, 'More Love to Thee, O Christ', 'm/MoreLoveToThee', 'G', 'F', '4/4', None, 'I - IV - I - V7 - I', 'Heartfelt devotion and personal love'),
    (29, 'In the Secret of His Presence', 'i/InTheSecretOfHisPresence', 'Eb', 'D', '3/4', None, 'I - IV - I - V7 - I', 'Quiet fellowship and sanctuary'),
    (30, 'My Jesus, I Love Thee', 'g/Gordon', 'F', 'Eb', '4/4', None, 'I - IV - I - V - I', 'Adoration and declaration of love'),
    (31, 'I Need Thee Every Hour', 'i_/INeedTheeEveryHour', 'Ab', 'G', '3/4', None, 'I - IV - I - V7 - I', 'Dependence and desperate seeking'),
    (32, 'I Surrender All', 'i_/ISurrenderAll', 'D', 'C', '4/4', None, 'I - V - vi - IV - I', 'Absolute surrender and altar devotion'),
    (33, 'I Am Thine, O Lord (Draw Me Nearer)', 'd/DrawMeNearer', 'Ab', 'G', '4/4', None, 'I - IV - I - V7 - I', "Drawing closer to God's presence"),
    (34, 'Sweet Hour of Prayer', 's/SweetHour', 'C', 'Bb', '6/8', None, 'I - IV - I - V - I', 'Intimate intercession and communion'),
    (35, 'Deeper, Deeper in the Love of Jesus', None, 'F', 'Eb', '4/4', 'Traditional Hymn', 'I - IV - I - V7 - I', 'Maturing in spiritual depth and love'),
    (36, 'Nearer, My God, to Thee', 'b/Bethany', 'G', 'F', '6/8', None, 'I - IV - I - V7 - I', 'Drawing near through all trials'),
    (37, 'Close to Thee', 'c/CloseToThee', 'G', 'F', '3/4', None, 'I - IV - I - V - I', 'Walking step by step with Christ'),
    (38, 'Give Me Jesus', None, 'Eb', 'D', '4/4', 'Meditative', 'I - vi - IV - I - V', 'Denying the world for Christ alone'),
    (39, 'Just a Closer Walk with Thee', 'j/JustACloserWalkWithThee', 'C', 'Bb', '4/4', None, 'I - V7 - I - IV - I', 'Daily intimacy and guidance'),
    (40, 'Fairest Lord Jesus', 'c/CrusadersHymn', 'Eb', 'D', '4/4', None, 'I - V - vi - IV - V - I', "Contemplation of Christ's beauty"),
    (41, 'Steal Away to Jesus', None, 'F', 'Eb', '4/4', 'Meditative', 'I - IV - I - V7', 'Quiet, meditative prayer chant'),
    (42, 'Were You There When They Crucified My Lord?', 'w/WereYouThere', 'F', 'Eb', '4/4', None, 'I - IV - vi - V - I', 'Deep reflection on the Cross'),
    (43, 'Deep River', 'd/DeepRiver', 'D', 'C', '4/4', None, 'I - IV - V - vi - I', 'Peace, quiet meditation and hope'),
    (44, 'Every Time I Feel the Spirit', None, 'G', 'F', '4/4', 'Hymnal March', 'I - IV - V - I', 'Inner awakening and devotion'),
]
# Be Still, My Soul is sung to Sibelius's FINLANDIA (Sibelius died in 1957), still under copyright in many countries
# until 2028, so it plays as a keyboard backing for now. The other backings have no public-domain score here.

# Great Is Thy Faithfulness (Runyan, 1923) and How Great Thou Art (Hine, 1949) are still under copyright in most
# countries, so the app plays only their chord progressions (from the table above), not the melodies.

# quarter notes a minute where the score's playback tempo is too slow or missing
TEMPO = {11: 100, 15: 75}

PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
SHARPS, FLATS = 'FCGDAEB', 'BEADGCF'
KEY_SIG = {'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7, 'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7}
KEY_PC = {k: (PC[k[0]] + (1 if k.endswith('#') else -1 if k.endswith('b') else 0)) % 12 for k in KEY_SIG}


def key_accidentals(k):
    k = k.strip().split()[0] if k.strip() else 'C'
    minor = k.endswith('m') and not k.endswith('maj')
    if minor:
        k = k[:-1]
        # relative major
        rel = [n for n, p in KEY_PC.items() if p == (KEY_PC[k] + 3) % 12]
        k = sorted(rel, key=lambda n: abs(KEY_SIG[n]))[0]
    n = KEY_SIG[k]
    acc = {}
    for i in range(abs(n)):
        acc[(SHARPS if n > 0 else FLATS)[i]] = 1 if n > 0 else -1
    return k, acc


def parse_len(s):
    if not s:
        return F(1)
    m = re.fullmatch(r'(\d*)(/*)(\d*)', s)
    num = int(m.group(1)) if m.group(1) else 1
    slashes = len(m.group(2))
    if m.group(3):
        return F(num, int(m.group(3)))
    return F(num, 2 ** slashes)


TOKEN = re.compile(r"""
    (?P<field>\[[A-Za-z]:[^\]]*\])
  | (?P<deco>![^!]*!)
  | (?P<annot>"[^"]*")
  | (?P<grace>\{[^}]*\})
  | (?P<chord>\[(?:[\^_=]*[A-Ga-g][,']*[\d/]*-?\s*)+\](?P<clen>[\d/]*)(?P<ctie>-?))
  | (?P<note>(?P<acc>\^\^|__|\^|_|=)?(?P<let>[A-Ga-g])(?P<oct>[,']*)(?P<len>[\d/]*)(?P<tie>-?))
  | (?P<rest>[zx](?P<rlen>[\d/]*))
  | (?P<bar>:?\|[\]|:]?|::|\[\|)
  | (?P<tuplet>\(\d)
  | (?P<mark>§)
  | (?P<skip>[()\s\\.~yHTMLRSOPuv>`])
""", re.X)


def parse_voice(body, unit, keyacc, info=None):
    """Return a list of [start, dur, midi, tie] in whole-note fractions, plus bar lengths.
    With info: also the time at each line mark (§) and each sounding note or chord (for lining up the words)."""
    marks, events, tied = [], [], set()
    t = F(0)
    out, bars, bar_start = [], [], F(0)
    local = {}
    silent = False
    tuplet = None   # (factor, remaining)

    def pitch(acc, let, octs):
        up = let.islower()
        L = let.upper()
        midi = 60 + PC[L] + (12 if up else 0) + 12 * octs.count("'") - 12 * octs.count(',')
        keyname = (L, midi // 12)
        if acc:
            a = {'^': 1, '^^': 2, '_': -1, '__': -2, '=': 0}[acc]
            local[keyname] = a
        a = local.get(keyname, keyacc.get(L, 0))
        return midi + a

    pos = 0
    while pos < len(body):
        m = TOKEN.match(body, pos)
        if not m:
            raise ValueError('cannot read: ' + body[pos:pos + 30])
        pos = m.end()
        g = m.lastgroup
        if g == 'mark':
            marks.append(t)
            continue
        if g in ('field', 'annot', 'grace', 'skip'):
            if g == 'field' and m.group(0)[1] == 'K':
                _, keyacc = key_accidentals(m.group(0)[3:-1])
            continue
        if g == 'deco':
            if m.group(0) == '!silent!':
                silent = True
            continue
        if g == 'tuplet':
            n = int(m.group(0)[1:])
            tuplet = [F({2: 3, 3: 2, 4: 3, 6: 2}.get(n, n - 1), n), n]
            continue
        if g == 'bar':
            bars.append(t - bar_start)
            bar_start = t
            local = {}
            continue
        factor = F(1)
        if tuplet:
            factor = tuplet[0]
            tuplet[1] -= 1
            if tuplet[1] == 0:
                tuplet = None
        if g == 'rest':
            t += parse_len(m.group('rlen')) * unit * factor
            silent = False
            continue
        if g == 'note':
            d = parse_len(m.group('len')) * unit * factor
            midi = pitch(m.group('acc'), m.group('let'), m.group('oct'))
            if not silent:
                out.append([t, d, midi, bool(m.group('tie'))])
            events.append((t, midi in tied, silent))
            tied = {midi} if m.group('tie') else set()
            silent = False
            t += d
            continue
        if g == 'chord':
            inner = m.group(0)[1:m.group(0).rindex(']')]
            clen = parse_len(m.group('clen')) * unit * factor
            longest = F(0)
            pitches, ties = [], set()
            for nm in re.finditer(r"(\^\^|__|\^|_|=)?([A-Ga-g])([,']*)([\d/]*)(-?)", inner):
                d = parse_len(nm.group(4)) * clen
                midi = pitch(nm.group(1), nm.group(2), nm.group(3))
                if not silent:
                    out.append([t, d, midi, bool(nm.group(5) or m.group('ctie'))])
                pitches.append(midi)
                if nm.group(5) or m.group('ctie'):
                    ties.add(midi)
                longest = max(longest, d) if longest else d
            events.append((t, max(pitches) in tied, silent))
            tied = ties
            silent = False
            t += longest
            continue
    if t > bar_start:
        bars.append(t - bar_start)
    # join tied notes
    notes = sorted(out, key=lambda n: (n[0], n[2]))
    merged = []
    open_ties = {}
    for n in notes:
        prev = open_ties.pop(n[2], None)
        if prev is not None and prev[0] + prev[1] == n[0]:
            prev[1] += n[1]
            if n[3]:
                open_ties[n[2]] = prev
            continue
        merged.append(n)
        if n[3]:
            open_ties[n[2]] = n
    if info is not None:
        info.update(marks=marks, events=events)
    return merged, t, bars


def parse_file(path):
    text = open(path, encoding='utf-8').read()
    head, voices, cur = {}, {}, None
    order, wtok = [], {}
    for raw in text.split('\n'):
        line = raw.split('%')[0].rstrip() if not raw.startswith('%%') else ''
        if not line.strip():
            continue
        m = re.match(r'^([A-Za-z+]):\s?(.*)$', line)
        if m:
            k, v = m.group(1), m.group(2)
            if k == 'V':
                cur = v.split()[0]
                if cur not in voices:
                    voices[cur] = []
                    order.append(cur)
                continue
            if k in 'w+':
                if cur is not None and cur == order[0] and voices[cur]:
                    wtok.setdefault(len(voices[cur]) - 1, []).extend(v.split())
                continue
            if k == 'W':
                continue
            if cur is None:
                head.setdefault(k, v)
            elif k == 'K':
                voices[cur].append('[K:%s]' % v)
            continue
        if cur is None:
            cur = '1'
            voices[cur] = []
            order.append(cur)
        voices[cur].append(line)
    unit = F(head.get('L', '1/8').strip())
    key, keyacc = key_accidentals(head.get('K', 'C'))
    meter = head.get('M', '4/4').strip()
    q = re.search(r'(\d+)/(\d+)\s*=\s*(\d+)', head.get('Q', ''))
    bpm = int(q.group(3)) * F(int(q.group(1)), int(q.group(2))) * 4 if q else None   # quarter notes a minute
    parts, info = [], {}
    for v in order:
        body = ' § '.join(voices[v])
        notes, total, bars = parse_voice(body, unit, keyacc, info if v == order[0] else None)
        parts.append((v, notes, total, bars))
    return dict(key=key, meter=meter, bpm=bpm, parts=parts, title=head.get('T', ''), words=(info, wtok, len(voices[order[0]])))


def line_starts(words, skip_silent=True, count_ties=True):
    """When each line of words begins: lyric codes like A1 B1 C1 mark the first syllable of lines A, B, C.
    Returns ({letter: time}, how many music lines did not line up)."""
    info, wtok, nlines = words
    marks, events = info.get('marks', []), info.get('events', [])
    bounds = [F(0)] + marks + [F(10 ** 6)]
    starts, bad, counts = {}, 0, {}
    for li, toks in wtok.items():
        lo, hi = bounds[li], bounds[li + 1]
        onsets = [t for t, cont, sil in events if lo <= t < hi and (count_ties or not cont) and not (skip_silent and sil)]
        k = 0
        for tok in toks:
            if tok == '|':
                continue
            name = tok.rstrip('_')
            mm = re.fullmatch(r'([A-Z])(\d+)', name)
            if mm:
                counts[mm.group(1)] = max(counts.get(mm.group(1), 0), int(mm.group(2)))
            if k < len(onsets) and re.fullmatch(r'[A-Z]1', name):
                starts.setdefault(name[0], onsets[k])
            k += 1 + (len(tok) - len(name)) if name else 1
        if k != len(onsets):
            bad += 1
    line_starts.counts = counts
    return starts, bad


# ---------------------------------------------------------------------------------------------------------------
# Words for singing along: public-domain texts from the freehymns project (en/*.txt), lined up with the music by the
# lyric codes in the scores (A1 = first syllable of line A).
WORDS_DIR = os.path.join(os.path.dirname(SRC.rstrip('/')), 'en')
WORDS_FILE = {   # where the text file name differs from the title
    6: 'h/HolyHolyHoly', 30: 'l/LordJesusILoveThee', 31: 'i_/INeedTheeEveryHour', 33: 'd/DrawMeNearer',
    21: 'c/ComeThouFountOfEvryBlessing', 4: 'b/BlessedAssurance',
}
NO_WORDS = {2, 3}
# lines the text files leave out because they are the same in every verse
VERSE_ENDS = {36: ['Near-er, my God, to Thee,', 'Near-er, my God, to Thee,', 'Near-er to Thee!']}   # Great Is Thy Faithfulness and How Great Thou Art: words still under copyright


def find_words(num, title):
    if num in WORDS_FILE:
        p = os.path.join(WORDS_DIR, WORDS_FILE[num] + '.txt')
        return p if os.path.exists(p) else None
    key = re.sub(r'[^a-z]', '', title.lower().replace("'", '').replace('’', ''))
    best = None
    for f in sorted(os.listdir(WORDS_DIR)):
        if not os.path.isdir(os.path.join(WORDS_DIR, f)):
            continue
        for g in os.listdir(os.path.join(WORDS_DIR, f)):
            path = os.path.join(WORDS_DIR, f, g)
            first = open(path, encoding='utf-8').readline()
            k = re.sub(r'[^a-z]', '', first.lower().replace('’', '').replace("'", ''))
            if k == key:
                return path
            if not best and k and key.startswith(k) and len(k) > 10:
                best = path
    return best


def read_words(path):
    """Verses and refrain from a freehymns text: [[lines of verse 1], ...], [refrain lines], refrain-is-its-own-pass."""
    verses, refrain, own_pass, cur, skip = [], [], False, None, False
    clean = lambda line: re.sub(r'\s+', ' ', re.sub(r'(?<=\w)-(?=\w)', '', line.replace('/:', '').replace(':/', '').replace('=', ''))).strip()
    for raw in open(path, encoding='utf-8').read().split('\n')[1:]:
        line = raw.strip()
        if line == '---':
            break
        m = re.match(r'^(Verse \d+|Refrain|Chorus)\s*:(.*)$', line)
        if m:
            skip = False
            if m.group(2).strip():
                if m.group(1) in ('Refrain', 'Chorus') and not refrain and re.match(r'^0@A1$', m.group(2).strip()):
                    own_pass = True
                else:
                    skip = True
                    continue
            if m.group(1).startswith('Verse'):
                cur = []
                verses.append(cur)
            elif not refrain:
                cur = refrain
            else:
                skip = True
            continue
        if line.startswith('_:') or line.startswith('Road Map'):
            skip = True
            continue
        if not line:
            if skip:
                skip = False
            continue
        if not skip and cur is not None:
            cur.append(line.replace('/:', '').replace(':/', ''))
    return [v for v in verses if v], refrain, own_pass


def clean_line(line):
    line = line.replace("-'", "'").replace('=', '')
    return re.sub(r'\s+', ' ', re.sub(r'(?<=\w)-(?=\w)', '', line)).strip()


def by_syllables(lines, counts):
    """Cut a verse into the music's phrases by counting syllables (the texts mark them with hyphens)."""
    syl = []   # [text, ends a word]
    for line in lines:
        words = line.split()
        for wi, w in enumerate(words):
            joined = w.endswith('=')
            parts = [x for x in re.split(r'(?<=\w)-(?=[\w’\'])', w.rstrip('=')) if x]
            for pi, part in enumerate(parts):
                syl.append([part, pi == len(parts) - 1])
            if joined and syl:
                syl[-1].append('join')
    # "be,= dear": two words sung on one note
    merged = []
    for x in syl:
        if merged and len(merged[-1]) > 2:
            merged[-1] = [merged[-1][0] + ' ' + x[0], x[1]]
        else:
            merged.append(x)
    if sum(counts) != len(merged):
        return None
    out, i = [], 0
    for c in counts:
        text = ''
        for part, end in merged[i:i + c]:
            text += part + (' ' if end else '')
        out.append(clean_line(text))
        i += c
    return out


def split_lines(lines, n):
    """Where a line of text spans two musical phrases, split it at the comma nearest its middle."""
    lines = list(lines)
    while len(lines) < n:
        best = None
        for i, l in enumerate(lines):
            cuts = [m.end() for m in re.finditer(r'[,;:!?]\s', l)]
            for c in cuts:
                score = abs(c - len(l) / 2) - len(l)
                if best is None or score < best[0]:
                    best = (score, i, c)
        if not best:
            break
        _, i, c = best
        lines[i:i + 1] = [lines[i][:c].strip(), lines[i][c:].strip()]
    return lines


def words_for(num, title, h):
    if num in NO_WORDS:
        return None
    path = find_words(num, title)
    if not path:
        return None
    verses, refrain, own = read_words(path)
    if not verses:
        return None
    verses = [v + VERSE_ENDS.get(num, []) for v in verses]
    starts, bad = line_starts(h['words'])
    letters = sorted(starts)
    ticks = [int(starts[k] * 4 * TPQ) for k in letters]
    if own and refrain:
        passes = []
        for v in verses:
            passes += [v, refrain]
    else:
        passes = [v + refrain for v in verses]
    counts = [line_starts.counts.get(k, 0) for k in letters]
    fitted = []
    for p in passes:
        if len(p) == len(ticks):
            fitted.append([clean_line(x) for x in p])
        else:
            fitted.append(by_syllables(p, counts) or split_lines([clean_line(x) for x in p], len(ticks)))
    passes = fitted
    exact = all(len(p) == len(ticks) for p in passes)
    return dict(starts=ticks if exact else None, passes=passes, file=os.path.basename(path)), exact


def nearest_shift(src, dst):
    s = (KEY_PC[dst] - KEY_PC[src]) % 12
    return s - 12 if s > 6 else s


def build():
    out = []
    problems = []
    rows = [(num, title, None, path, tune, key, easy, ts, None, prog) for num, title, path, tune, key, easy, ts, prog in HYMNS]
    rows += [(num, title, theme, path, None, key, easy, ts, style, prog.replace(' - ', ' – ')) for num, title, path, key, easy, ts, style, prog, theme in DEVOTIONAL]
    rows.sort(key=lambda r: r[0])
    for num, title, theme, path, tune, key, easy, ts, style, prog in rows:
        item = dict(n=num, title=title, key=key, easy=easy, ts=ts, prog=prog)
        if tune: item['tune'] = tune
        if theme: item['theme'] = theme
        if style: item['style'] = style
        if num in COMPOSED:
            spec = COMPOSED[num]
            flat, total = compose(num, KEY_PC[key], spec, TPQ)
            enc = []
            for n in flat:
                enc += n
            item.update(meter=spec['meter'], bpm=spec['bpm'], len=total, composed=True, notes=enc)
            print('%2d %-38s new tune  %s  notes %d' % (num, title, spec['meter'], len(flat)))
            out.append(item)
            continue
        if not path:
            item['backing'] = style or 'Traditional Hymn'
            out.append(item)
            continue
        h = parse_file(os.path.join(SRC, path + '.abc'))
        shift = nearest_shift(h['key'], key)
        totals = [p[2] for p in h['parts'] if p[1]]
        if len(set(totals)) != 1:
            problems.append('%s: voices end at different times %s' % (title, [str(x) for x in totals]))
        num_, den_ = (int(x) for x in h['meter'].split('/'))
        barlen = F(num_, den_)
        for v, notes, total, bars in h['parts']:
            odd = [i for i, b in enumerate(bars) if b != barlen and 0 < i < len(bars) - 1]
            if odd:
                problems.append('%s voice %s: bars %s are %s long, not %s' % (title, v, odd[:5], [str(bars[i]) for i in odd[:5]], barlen))
        # voices in score order: the first is the melody. Where the melody line also carries the alto in chords,
        # the lower notes of each chord are alto.
        voiced = [p for p in h['parts'] if p[1]]
        flat = []
        for vi, (v, notes, total, bars) in enumerate(voiced):
            top = {}
            for st, d, midi, _ in notes:
                top[st] = max(top.get(st, 0), midi)
            for st, d, midi, _ in notes:
                a, b = st * 4 * TPQ, d * 4 * TPQ
                if a.denominator != 1 or b.denominator != 1:
                    problems.append('%s: note timing finer than 1/%d quarter' % (title, TPQ))
                voice = min(vi, 3)
                if vi == 0 and midi < top[st]:
                    voice = 1
                flat.append([int(a), int(b), midi + shift, voice])
        flat.sort(key=lambda n: (n[0], n[3]))
        enc = []
        for n in flat:
            enc += n
        item.update(meter=h['meter'], bpm=int(TEMPO.get(num) or h['bpm'] or 100), len=int(max(totals) * 4 * TPQ), source=os.path.basename(path), notes=enc)
        w = words_for(num, title, h)
        if w:
            item['words'] = {k: v for k, v in w[0].items() if k != 'file' and v is not None}
            print('   words: %s, %d verses, %s' % (w[0]['file'], len(w[0]['passes']), 'lined up' if w[1] else 'NOT lined up (%s lines vs %d starts)' % ([len(p) for p in w[0]['passes']], len(line_starts(h['words'])[0]))))
        else:
            print('   words: none')
        melody = [n for n in flat if n[3] == 0][:12]
        print('%2d %-38s %s->%s %+d  %s  bpm %s  notes %d  melody %s' % (num, title, h['key'], key, shift, h['meter'], item['bpm'], len(flat),
              ' '.join('CDEFGAB'[[0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][n[2] % 12]] + ('#' if n[2] % 12 in (1, 3, 6, 8, 10) else '') for n in melody)))
        out.append(item)
    for p in problems:
        print('CHECK:', p)
    js = ('/* Public-domain hymns in four parts, built by tools/build_hymns.py from the freehymns project\n'
          ' * (https://github.com/freehymns/hymns, scores marked "Public Domain").\n'
          ' * notes: start, length (1/%d of a quarter note), MIDI pitch, voice (0 soprano … 3 bass), repeated. */\n'
          'window.HYMNAL = %s;\n') % (TPQ, json.dumps(out, separators=(',', ':'), ensure_ascii=False))
    dest = os.path.join(ROOT, 'js', 'data', 'hymns.js')
    open(dest, 'w', encoding='utf-8').write(js)
    print(dest, len(js) // 1024, 'KB')


if __name__ == '__main__':
    build()
