"""
New tunes written for Lamp & Path, for the songs with no public-domain score, and a simple four-part harmoniser.

Melodies are written by scale degree (1-7; a comma lowers an octave, an apostrophe raises one) with a length in
beats, bar by bar, after the bar's chord (one chord, or two that share the bar). Each song has a verse and a chorus
over its chord progression. These are original tunes, not the traditional melodies; for Great Is Thy Faithfulness,
How Great Thou Art and Be Still, My Soul, whose melodies are still under copyright, deliberately so.
"""

COMPOSED = {
    # Be Still, My Soul (F): I - V - vi - IV - V - I
    26: dict(bpm=84, meter='4/4', verse="""
        I: 3:2 2:1 1:1 | V: 2:1 5,:1 7,:2 | vi: 1:2 3:1 6:1 | IV: 6:3 4:1 |
        I: 5:2 6:1 5:1 | V: 5:1 4:1 2:2 | IV V: 1:1 6,:1 7,:1 2:1 | I: 1:4""", chorus="""
        IV: 6:2 1':1 6:1 | I: 5:2 3:2 | vi: 3:1 6:1 1':1 6:1 | V: 5:4 |
        I: 5:1 1':1 1':1 7:1 | vi: 6:2 3:1 1:1 | IV V: 4:1 6:1 5:1 2:1 | I: 1:4"""),
    # Dear Lord and Father of Mankind (Eb): I - vi - ii - V7 - I
    27: dict(bpm=86, meter='4/4', verse="""
        I: 5,:1 1:1 3:1 2:1 | vi: 1:2 6,:2 | ii: 2:1 4:1 6:1 4:1 | V7: 5:2 4:2 |
        I: 3:2 5:1 3:1 | vi: 1:1 3:1 6:2 | ii V7: 4:1 2:1 7,:1 2:1 | I: 1:4""", chorus="""
        vi: 3:2 1:1 3:1 | ii: 4:2 2:2 | V7: 5:1 4:1 2:1 7,:1 | I: 1:2 3:2 |
        vi: 6:2 3:1 1:1 | ii: 2:1 4:1 6:2 | V7: 5:2 4:1 2:1 | I: 1:4"""),
    # Deeper, Deeper in the Love of Jesus (F): I - IV - I - V7 - I
    35: dict(bpm=104, meter='4/4', verse="""
        I: 1:1.5 3:.5 5:1 5:1 | IV: 6:1.5 1':.5 6:1 4:1 | I: 3:1.5 1:.5 3:1 5:1 | V7: 4:1.5 2:.5 5,:2 |
        I: 1:1.5 3:.5 5:1 1':1 | IV: 1':1.5 6:.5 4:2 | I V7: 3:1 5:1 4:1 2:1 | I: 1:4""", chorus="""
        I: 5:2 5:2 | IV: 6:2 6:2 | I: 5:1.5 3:.5 1:1 3:1 | V7: 2:4 |
        I: 5:2 5:2 | IV: 1':2 6:2 | I V7: 5:1 3:1 2:1 7,:1 | I: 1:4"""),
    # Give Me Jesus (Eb): I - vi - IV - I - V
    38: dict(bpm=76, meter='4/4', verse="""
        I: 5,:1 1:1 1:1 3:1 | vi: 3:2 1:1 6,:1 | IV: 1:2 6,:2 | I: 1:3 5,:1 |
        I: 5,:1 1:1 3:1 5:1 | vi: 6:2 3:1 1:1 | IV V: 1:1 6,:1 2:2 | I: 1:4""", chorus="""
        vi: 3:2 3:1 1:1 | IV: 1:2 6,:2 | I: 3:1 5:1 5:1 3:1 | V: 2:4 |
        vi: 3:2 1:1 3:1 | IV: 6:2 4:1 1:1 | I V: 3:1 1:1 2:2 | I: 1:4"""),
    # Steal Away to Jesus (F): I - IV - I - V7
    41: dict(bpm=80, meter='4/4', verse="""
        I: 1:2 3:1 5:1 | IV: 6:2 1':2 | I: 5:2 3:2 | V7: 2:3 5,:1 |
        I: 1:2 3:1 5:1 | IV: 6:2 1':1 6:1 | I V7: 5:1 3:1 2:2 | I: 1:4""", chorus="""
        I: 5:2 5:2 | IV: 6:1 1':1 6:2 | I: 5:1 3:1 1:2 | V7: 2:4 |
        I: 5:2 5:2 | IV: 6:1 1':1 6:1 4:1 | I V7: 3:1 1:1 2:1 5,:1 | I: 1:4"""),
    # Every Time I Feel the Spirit (G): I - IV - V - I
    44: dict(bpm=124, meter='4/4', verse="""
        I: 1:.5 1:.5 3:.5 5:1 5:.5 3:1 | IV: 4:.5 6:.5 6:1 6:.5 4:.5 1:1 | V: 5:.5 5:.5 7:1 5:.5 2:.5 2:1 | I: 3:1 1:3 |
        I: 5:.5 5:.5 5:.5 3:.5 5:1 1':1 | IV: 1':.5 6:.5 4:1 6:2 | V: 5:1 7,:1 2:1 5:1 | I: 1:4""", chorus="""
        I: 5:.5 5:.5 5:.5 5:.5 3:1 5:1 | IV: 6:.5 6:.5 1':1 6:2 | V: 7:.5 7:.5 5:1 2:1 5:1 | I: 1':2 5:2 |
        I: 5:.5 5:.5 5:.5 5:.5 3:1 5:1 | IV: 6:1 4:1 1:2 | V: 2:1.5 2:.5 5,:1 7,:1 | I: 1:4"""),
    # Great Is Thy Faithfulness (Eb, 3/4): I - IV - I - V7 - I
    2: dict(bpm=100, meter='3/4', verse="""
        I: 5:2 3:1 | IV: 4:2 6:1 | I: 5:3 | V7: 4:2 2:1 |
        I: 3:2 1:1 | IV: 1:1 6,:1 1:1 | V7: 2:2 7,:1 | I: 1:3""", chorus="""
        IV: 1':2 6:1 | I: 5:2 3:1 | IV: 4:1 6:1 1':1 | V7: 7:3 |
        I: 1':2 5:1 | IV: 6:2 4:1 | V7: 2:2 5,:1 | I: 1:3"""),
    # How Great Thou Art (Bb): I - IV - I - V7 - I
    3: dict(bpm=84, meter='4/4', verse="""
        I: 1:1 2:1 3:2 | IV: 4:1 6:1 1':2 | I: 5:2 3:1 1:1 | V7: 2:3 5,:1 |
        I: 3:1 4:1 5:2 | IV: 6:1 1':1 6:1 4:1 | I V7: 3:1 5:1 4:1 2:1 | I: 1:4""", chorus="""
        IV: 6:2 1':2 | I: 1':2 5:2 | IV: 4:1 6:1 1':1 6:1 | V7: 5:4 |
        I: 3:1 5:1 1':2 | IV: 6:2 4:2 | I V7: 3:1 1:1 2:2 | I: 1:4"""),
}

SCALE = [0, 2, 4, 5, 7, 9, 11]
CHORD = {'I': [0, 2, 4], 'ii': [1, 3, 5], 'iii': [2, 4, 6], 'IV': [3, 5, 0], 'V': [4, 6, 1], 'V7': [4, 6, 1, 3], 'vi': [5, 0, 2]}


def compose(num, key_pc, spec, tpq=24):
    """The melody plus alto, tenor and bass from the chords: notes as [start, length, midi, voice] in ticks."""
    bar_beats = int(spec['meter'].split('/')[0])
    tonic = 60 + key_pc if key_pc <= 7 else 48 + key_pc
    melody, chords, t = [], [], 0
    for section in (spec['verse'], spec['chorus']):
        for bar in [b.strip() for b in section.strip().split('|') if b.strip()]:
            names, notes = bar.split(':', 1)
            names = names.split()
            beats = 0
            for tok in notes.split():
                deg, dur = tok.rsplit(':', 1)
                d = int(deg.rstrip(",'")) + 7 * deg.count("'") - 7 * deg.count(',')
                du = round(float(dur) * tpq)
                melody.append([t + beats, du, tonic + SCALE[(d - 1) % 7] + 12 * ((d - 1) // 7)])
                beats += du
            if beats != bar_beats * tpq:
                raise ValueError('song %d: a bar of %s beats: %s' % (num, beats / tpq, bar))
            seg = beats // len(names)
            for i, n in enumerate(names):
                chords.append((t + i * seg, seg, n))
            t += beats
    # keep the tune in a comfortable singing range
    avg = sum(m[2] for m in melody) / len(melody)
    shift = 12 if avg < 64 else -12 if avg > 74 else 0
    melody = [[a, b, m + shift] for a, b, m in melody]
    tonic += shift
    out = [[a, b, m, 0] for a, b, m in melody]
    alto = tenor = bass = None
    for st, du, name in chords:
        pcs = [(tonic + SCALE[x]) % 12 for x in CHORD[name]]
        top = next(m for a, b, m in melody if a <= st < a + b)
        roots = [m for m in range(38, 53) if m % 12 == pcs[0]]
        bass = min(roots, key=lambda m: abs(m - (bass or 45)))

        def pick(lo, hi, prev, want):
            c = [m for m in range(lo, hi + 1) if m % 12 in pcs]
            # move as little as possible, and prefer not to double the tune's note
            return min(c, key=lambda m: abs(m - (prev or want)) + (1.5 if m % 12 == top % 12 else 0)) if c else None

        alto = pick(top - 9, top - 2, alto, top - 5) or alto
        tenor = pick(max(bass + 3, 50, (alto or top) - 12), (alto or top) - 2, tenor, 57) or tenor
        if name == 'V7' and all(x % 12 != pcs[3] for x in (top, alto or 0, tenor or 0)):
            sev = [m for m in range(max(bass + 3, 48), alto or top) if m % 12 == pcs[3]]
            if sev:
                tenor = sev[-1]
        for m, v in ((alto, 1), (tenor, 2), (bass, 3)):
            if m:
                out.append([st, du, m, v])
    out.sort(key=lambda n: (n[0], n[3]))
    return out, t
