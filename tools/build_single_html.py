#!/usr/bin/env python3
"""Build one self-contained HTML file of the whole app (styles, fonts, code and the full KJV).

Usage:  python3 tools/build_single_html.py [output.html]
The result opens straight from a phone or computer with no internet and no server.
"""
import base64, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'lamp-and-path.html')
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

def data_uri(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(os.path.join(ROOT, path), 'rb').read()).decode()

def safe_js(src):
    return src.replace('</script', '<\\/script')

html = read('index.html')

# fonts + styles inline
fonts = re.sub(r'url\(([^)]+\.woff2)\)', lambda m: f"url({data_uri('fonts/' + m.group(1), 'font/woff2')})", read('fonts/fonts.css'))
css = fonts + '\n' + read('css/styles.css')
icon = data_uri('icons/icon.svg', 'image/svg+xml')
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="stylesheet" href="fonts/fonts.css">', '', html)
html = html.replace('<link rel="stylesheet" href="css/styles.css">', f'<style>\n{css}\n</style>')
html = html.replace('href="icons/icon.svg"', f'href="{icon}"')

# scripts inline; the whole Bible is added right after the Bible engine so every book is already loaded
def inline(m):
    path = m.group(1)
    out = f'<script>\n{safe_js(read(path))}\n</script>'
    if path == 'js/bible.js':
        books = ''.join(safe_js(read(f'js/kjv/{i:02d}.js')) for i in range(1, 67))
        out += f'\n<script>\n{books}\n</script>'
    return out
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
html = html.replace("icon: 'icons/icon.svg', badge: 'icons/icon.svg'", f"icon: '{icon}'")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(html)
print(f'{OUT}  ({os.path.getsize(OUT) / 1e6:.1f} MB)')
