#!/usr/bin/env python3
"""Build the Bible-lands map outline from Natural Earth (public domain), clipped and simplified.

Usage:  python3 tools/build_map.py NATURAL_EARTH_DIR
NATURAL_EARTH_DIR holds these GeoJSON files from https://github.com/nvkelso/natural-earth-vector (geojson/):
ne_10m_land, ne_10m_lakes, ne_10m_rivers_lake_centerlines, ne_50m_admin_0_countries.
Writes js/data/map.js.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NE = sys.argv[1]
W, S, E, N = 8.0, 21.0, 52.0, 43.0          # Italy to Persia, Egypt to the Black Sea


def load(name):
    return json.load(open(os.path.join(NE, name + '.geojson'), encoding='utf-8'))['features']


def rings(geom):
    if geom['type'] == 'Polygon':
        return geom['coordinates']
    if geom['type'] == 'MultiPolygon':
        return [r for poly in geom['coordinates'] for r in poly]
    return []


def lines(geom):
    if geom['type'] == 'LineString':
        return [geom['coordinates']]
    if geom['type'] == 'MultiLineString':
        return geom['coordinates']
    return []


def clip(ring):
    """Sutherland-Hodgman clip of a polygon ring to the map rectangle."""
    def edge(pts, inside, cut):
        out = []
        for i, p in enumerate(pts):
            q = pts[i - 1]
            if inside(p):
                if not inside(q):
                    out.append(cut(q, p))
                out.append(p)
            elif inside(q):
                out.append(cut(q, p))
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    pts = [tuple(p[:2]) for p in ring]
    for inside, cut in [(lambda p: p[0] >= W, at_x(W)), (lambda p: p[0] <= E, at_x(E)),
                        (lambda p: p[1] >= S, at_y(S)), (lambda p: p[1] <= N, at_y(N))]:
        if not pts:
            break
        pts = edge(pts, inside, cut)
    return pts


def simplify(pts, tol):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, idx = 0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def pack(pts):
    return [round(v, 3) for p in pts for v in p]


def area(pts):
    return abs(sum(pts[i - 1][0] * p[1] - p[0] * pts[i - 1][1] for i, p in enumerate(pts))) / 2


land = []
for f in load('ne_10m_land'):
    for r in rings(f['geometry']):
        c = clip(r)
        if len(c) >= 3 and area(c) > 0.004:
            land.append(pack(simplify(c, 0.012)))

lakes = []
for f in load('ne_10m_lakes'):
    name = f['properties'].get('name') or ''
    for r in rings(f['geometry']):
        c = clip(r)
        if len(c) >= 3 and (area(c) > 0.02 or name in ('Sea of Galilee', 'Dead Sea')):
            lakes.append(pack(simplify(c, 0.004)))

rivers = []
for f in load('ne_10m_rivers_lake_centerlines'):
    name = f['properties'].get('name') or ''
    if name not in ('Jordan', 'Nile', 'Euphrates', 'Tigris', 'Orontes', 'Litani', 'Halys', 'Kizilirmak', 'Karun', 'Pison'):
        continue
    for ln in lines(f['geometry']):
        pts = [tuple(p[:2]) for p in ln if W - 1 <= p[0] <= E + 1 and S - 1 <= p[1] <= N + 1]
        if len(pts) >= 2:
            rivers.append([name, pack(simplify(pts, 0.01))])

borders, countries = [], []
for f in load('ne_50m_admin_0_countries'):
    p = f['properties']
    name = p.get('NAME') or p.get('name') or ''
    lon, lat = p.get('LABEL_X'), p.get('LABEL_Y')
    for r in rings(f['geometry']):
        c = clip(r)
        if len(c) >= 3 and area(c) > 0.05:
            borders.append(pack(simplify(c, 0.02)))
    if lon is not None and W + 0.5 <= lon <= E - 0.5 and S + 0.5 <= lat <= N - 0.5:
        countries.append([name, round(lon, 2), round(lat, 2)])

out = {'bbox': [W, S, E, N], 'land': land, 'lakes': lakes, 'rivers': rivers, 'borders': borders, 'countries': countries}
body = json.dumps(out, separators=(',', ':'))
path = os.path.join(ROOT, 'js', 'data', 'map.js')
with open(path, 'w', encoding='utf-8') as f:
    f.write('/* Map of the Bible lands: coastlines, lakes, rivers and modern borders from Natural Earth (public domain), clipped and simplified. Coordinates are [lon, lat, lon, lat, ...]. */\n'
            f'window.MAP_SHAPES={body};\n')
print(f'land {len(land)} rings, lakes {len(lakes)}, rivers {len(rivers)}, borders {len(borders)}, countries {len(countries)}; {os.path.getsize(path) / 1e3:.0f} KB')
