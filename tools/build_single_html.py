#!/usr/bin/env python3
"""Build the app as one self-contained HTML file, or as a page plus a few bundle files.

Usage:
  python3 tools/build_single_html.py [output.html] [--versions kjv,bsb,web | --versions all] [--no-original]
      One file that opens straight from a phone or computer, with no internet and no server.
      By default it holds the KJV, the BSB and the WEB, plus the Hebrew and Greek with the dictionaries.
  python3 tools/build_single_html.py --bundles OUT_DIR
      A page (OUT_DIR/index.html, without the outer html/head/body tags) and OUT_DIR/bundle/*.js,
      one file per Bible version, for hosts that publish a page with a few files beside it.
"""
import base64, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
BUNDLES = None
if '--bundles' in args:
    BUNDLES = args[args.index('--bundles') + 1]
VERSIONS = ['kjv', 'bsb', 'web']
if '--versions' in args:
    v = args[args.index('--versions') + 1]
    VERSIONS = ['kjv', 'bsb', 'web', 'asv', 'ylt', 'darby', 'webster', 'bbe'] if v == 'all' else ['kjv'] + [x for x in v.split(',') if x != 'kjv']
ORIGINAL = '--no-original' not in args
positional = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] not in ('--versions', '--bundles'))]
OUT = positional[0] if positional else os.path.join(ROOT, 'dist', 'lamp-and-path.html')

read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
path_of = lambda vid: vid if vid in ('kjv', 'web') else 'ver/' + vid


def data_uri(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(os.path.join(ROOT, path), 'rb').read()).decode()


def safe_js(src):
    return src.replace('</script', '<\\/script')


html = read('index.html')

# fonts + styles inline
fonts = re.sub(r'url\(([^)]+\.woff2)\)', lambda m: f"url({data_uri('fonts/' + m.group(1), 'font/woff2')})", read('fonts/fonts.css'))
css = fonts + '\n' + read('css/styles.css')
icon = data_uri('icons/icon.svg', 'image/svg+xml')
html = re.sub(r'href="icons/([^"]+\.png)"', lambda m: f'href="{data_uri("icons/" + m.group(1), "image/png")}"', html)
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="stylesheet" href="fonts/fonts.css">', '', html)
html = html.replace('<link rel="stylesheet" href="css/styles.css">', f'<style>\n{css}\n</style>')
html = html.replace('href="icons/icon.svg"', f'href="{icon}"')


def inline(m):
    path = m.group(1)
    out = f'<script>\n{safe_js(read(path))}\n</script>'
    if path == 'js/bible.js':
        if BUNDLES:
            return "<script>window.BIBLE_BUNDLES = 'bundle/';</script>\n" + out
        out = f"<script>window.ONLY_VERSIONS = {VERSIONS!r};</script>\n" + out
        # the KJV runs at once; other versions, the Hebrew, Greek and dictionaries are kept as text and run only when opened
        books = ''.join(safe_js(read(f'js/kjv/{i:02d}.js')) for i in range(1, 67))
        out += f'\n<script>\n{books}\n</script>'
        for vid in VERSIONS[1:]:
            out += ''.join(f'\n<script type="text/plain" id="{vid}-src-{i:02d}">{safe_js(read(f"js/{path_of(vid)}/{i:02d}.js"))}</script>' for i in range(1, 67))
        out += ''.join(f'\n<script type="text/plain" id="xref-src-{i:02d}">{safe_js(read(f"js/xref/{i:02d}.js"))}</script>' for i in range(1, 67))
        if ORIGINAL:
            out += ''.join(f'\n<script type="text/plain" id="orig-src-{i:02d}">{safe_js(read(f"js/orig/{i:02d}.js"))}</script>' for i in range(1, 67))
            out += ''.join(f'\n<script type="text/plain" id="lex-src-{n}">{safe_js(read(f"js/lex/{n}.js"))}</script>' for n in ('hebrew', 'greek'))
    return out


html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
html = html.replace("icon: 'icons/icon.svg', badge: 'icons/icon.svg'", f"icon: '{icon}'")

if BUNDLES:
    # page without its own html/head/body: the host wraps it
    head_end = html.index('</head>')
    head, rest = html[:head_end], html[head_end + len('</head>'):]
    head = re.sub(r'<!doctype html>\s*', '', head, flags=re.I)
    head = re.sub(r'<html[^>]*>\s*', '', head).replace('<head>', '', 1)
    head = re.sub(r'\s*<meta charset="utf-8">', '', head)
    head = re.sub(r'\s*<meta name="viewport"[^>]*>', '', head)
    title = re.search(r'<title>.*?</title>', head).group(0)
    head = title + '\n' + head.replace(title, '', 1)
    rest = re.sub(r'^\s*<body>', '', rest, count=1).replace('</body>', '').replace('</html>', '')
    os.makedirs(os.path.join(BUNDLES, 'bundle'), exist_ok=True)
    open(os.path.join(BUNDLES, 'index.html'), 'w', encoding='utf-8').write(head.strip() + '\n' + rest.strip() + '\n')
    groups = {vid: [f'js/{path_of(vid)}/{i:02d}.js' for i in range(1, 67)] for vid in ['kjv', 'bsb', 'web', 'asv', 'ylt', 'darby', 'webster', 'bbe']}
    groups['orig-ot'] = [f'js/orig/{i:02d}.js' for i in range(1, 40)]
    groups['orig-nt'] = [f'js/orig/{i:02d}.js' for i in range(40, 67)]
    groups['xref'] = [f'js/xref/{i:02d}.js' for i in range(1, 67)]
    groups['lex-hebrew'] = ['js/lex/hebrew.js']
    groups['lex-greek'] = ['js/lex/greek.js']
    for name, files in groups.items():
        open(os.path.join(BUNDLES, 'bundle', name + '.js'), 'w', encoding='utf-8').write('\n'.join(read(f) for f in files))
    for f in sorted(os.listdir(os.path.join(BUNDLES, 'bundle'))):
        print(f'bundle/{f}  ({os.path.getsize(os.path.join(BUNDLES, "bundle", f)) / 1e6:.1f} MB)')
    print(f'{BUNDLES}/index.html  ({os.path.getsize(os.path.join(BUNDLES, "index.html")) / 1e6:.1f} MB)')
else:
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print(f'{OUT}  ({os.path.getsize(OUT) / 1e6:.1f} MB) · versions: {", ".join(VERSIONS)}{" · Hebrew and Greek" if ORIGINAL else ""}')
