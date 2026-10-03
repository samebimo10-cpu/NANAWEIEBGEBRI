/*
 * The Pilgrim's Journey — a procedurally rendered, explorable map of the Bible lands.
 * The terrain is generated once with value noise into an offscreen canvas. Trees, landmarks,
 * water, weather, day/night lighting and particles are drawn live each frame.
 */
(function () {
  'use strict';

  const W = 4800, H = 3200, RES = 3;
  const MW = Math.ceil(W / RES), MH = Math.ceil(H / RES);

  /* ---------------- Noise ---------------- */
  function hash(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------- Geography ---------------- */
  const SEAS = [
    { x: 1100, y: 1700, rx: 900, ry: 520 },   // Mediterranean
    { x: 1800, y: 1560, rx: 200, ry: 460 },   // Levantine basin
    { x: 100, y: 1700, rx: 500, ry: 760 },    // western Mediterranean
    { x: 1150, y: 800, rx: 220, ry: 520 },    // Aegean
    { x: 150, y: 800, rx: 300, ry: 700 },     // Ionian
    { x: 1720, y: 2640, rx: 70, ry: 330 },    // Gulf of Suez
    { x: 2235, y: 2610, rx: 55, ry: 330 },    // Gulf of Aqaba
    { x: 2000, y: 3160, rx: 470, ry: 270 },   // Red Sea
    { x: 4600, y: 2650, rx: 500, ry: 380, a: -0.35 }, // Persian Gulf
    { x: 2100, y: 30, rx: 700, ry: 220 }      // Black Sea
  ].map(s => Object.assign({ c: Math.cos(s.a || 0), s: Math.sin(s.a || 0), m: Math.min(s.rx, s.ry) }, s));
  const LAKES = [
    { x: 2500, y: 1120, rx: 78, ry: 118 },    // Sea of Galilee
    { x: 2490, y: 1790, rx: 58, ry: 165 }     // Dead Sea
  ];
  const ISLANDS = [
    { x: 1250, y: 1150, rx: 95, ry: 70 },     // Patmos
    { x: 1700, y: 1450, rx: 165, ry: 55, a: -0.25 }, // Cyprus
    { x: 1050, y: 1480, rx: 240, ry: 45, a: 0.05 }   // Crete
  ].map(s => Object.assign({ c: Math.cos(s.a || 0), s: Math.sin(s.a || 0) }, s));
  const PEAKS = [
    { x: 3450, y: 330, r: 320, h: 1.2 },   // Ararat
    { x: 3150, y: 240, r: 280, h: 0.55 }, { x: 2780, y: 250, r: 300, h: 0.5 }, { x: 2380, y: 300, r: 260, h: 0.45 },
    { x: 2600, y: 800, r: 170, h: 0.55 }, { x: 2660, y: 620, r: 170, h: 0.5 }, // Lebanon / Hermon
    { x: 1980, y: 2760, r: 210, h: 0.85 }, { x: 2100, y: 2580, r: 150, h: 0.5 }, // Sinai
    { x: 4350, y: 1000, r: 270, h: 0.6 }, { x: 4520, y: 1350, r: 260, h: 0.55 }, { x: 4600, y: 700, r: 260, h: 0.6 }, // Zagros
    { x: 650, y: 600, r: 240, h: 0.5 }, { x: 480, y: 900, r: 180, h: 0.42 }, // Greece
    { x: 2250, y: 1760, r: 260, h: 0.26 }, { x: 2330, y: 1250, r: 160, h: 0.22 } // Judean & Galilean hills
  ];
  const RIVERS = [
    { w: 13, pts: [[1060, 3200], [1080, 2900], [1020, 2650], [1060, 2420], [1000, 2215]] },         // Nile
    { w: 8, pts: [[2500, 1232], [2478, 1350], [2506, 1470], [2484, 1560], [2490, 1632]] },           // Jordan
    { w: 12, pts: [[3250, 520], [3150, 800], [3280, 1100], [3550, 1400], [3830, 1700], [4150, 2000], [4300, 2200], [4380, 2325]] }, // Euphrates
    { w: 11, pts: [[3550, 560], [3660, 880], [3820, 1200], [4060, 1500], [4200, 1800], [4300, 2100], [4380, 2325]] }               // Tigris
  ];
  const SEGS = [];
  RIVERS.forEach(r => { for (let i = 0; i < r.pts.length - 1; i++) SEGS.push([r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]]); });

  function seaDist(x, y) { // normalised distance (<1 = water) and world depth
    let best = 9, depth = 0;
    for (let i = 0; i < SEAS.length; i++) {
      const s = SEAS[i];
      let dx = x - s.x, dy = y - s.y;
      if (s.a) { const rx = dx * s.c + dy * s.s, ry = -dx * s.s + dy * s.c; dx = rx; dy = ry; }
      const d = Math.sqrt((dx / s.rx) * (dx / s.rx) + (dy / s.ry) * (dy / s.ry));
      if (d < best) { best = d; depth = (1 - d) * s.m; }
    }
    seaDist.depth = depth;
    return best;
  }
  function ellD(e, x, y) {
    let dx = x - e.x, dy = y - e.y;
    if (e.a) { const rx = dx * e.c + dy * e.s, ry = -dx * e.s + dy * e.c; dx = rx; dy = ry; }
    return Math.sqrt((dx / e.rx) * (dx / e.rx) + (dy / e.ry) * (dy / e.ry));
  }
  function riverDist(x, y) {
    let best = 1e9;
    for (let i = 0; i < SEGS.length; i++) {
      const [ax, ay, bx, by] = SEGS[i];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1);
      const dx = x - (ax + vx * t), dy = y - (ay + vy * t);
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  function elevation(x, y, n) {
    let e = 0;
    for (let i = 0; i < PEAKS.length; i++) {
      const p = PEAKS[i], dx = x - p.x, dy = y - p.y, dd = dx * dx + dy * dy;
      if (dd < p.r * p.r) { const t = 1 - Math.sqrt(dd) / p.r; e += p.h * t * t * (0.65 + 0.7 * n); }
    }
    return e;
  }

  /* Biome codes */
  const B = { DEEP: 0, SHALLOW: 1, BEACH: 2, DESERT: 3, STEPPE: 4, GRASS: 5, LUSH: 6, ROCK: 7, SNOW: 8 };

  let terrain, waterMask, biome, rdist, miniBase;

  function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  const C = {
    deep: [18, 64, 112], mid: [33, 118, 160], shallow: [86, 186, 196], foam: [190, 232, 226],
    beach: [233, 214, 160], desert: [220, 190, 135], desert2: [204, 167, 108], steppe: [190, 178, 112],
    grass: [140, 172, 88], lush: [88, 140, 66], rock: [138, 124, 106], rock2: [110, 98, 86], snow: [244, 246, 250]
  };

  function generateTerrain(onProgress) {
    return new Promise(resolve => {
      terrain = document.createElement('canvas');
      terrain.width = MW; terrain.height = MH;
      const tctx = terrain.getContext('2d');
      const img = tctx.createImageData(MW, MH);
      const data = img.data;
      waterMask = new Uint8Array(MW * MH);
      biome = new Uint8Array(MW * MH);
      rdist = new Uint16Array(MW * MH);
      const height = new Float32Array(MW * MH);
      const cols = new Float32Array(MW * MH * 3);

      let py = 0;
      const ROWS = 40;
      function chunk() {
        const end = Math.min(MH, py + ROWS);
        for (; py < end; py++) {
          const wy = py * RES + RES / 2;
          for (let px = 0; px < MW; px++) {
            const wx = px * RES + RES / 2;
            const i = py * MW + px;
            const n1 = fbm(wx / 380, wy / 380, 4);
            const n2 = fbm(wx / 110 + 31.7, wy / 110 - 17.3, 3);
            let d = seaDist(wx + (n1 - 0.5) * 110 + (n2 - 0.5) * 30, wy + (n2 - 0.5) * 90);
            let depth = seaDist.depth;
            for (const isl of ISLANDS) {
              const di = ellD(isl, wx + (n2 - 0.5) * 40, wy + (n1 - 0.5) * 40);
              if (di < 1) { d = Math.max(d, 1 + (1 - di) * 0.25); }
            }
            let lake = 9;
            for (const l of LAKES) lake = Math.min(lake, ellD(l, wx + (n2 - 0.5) * 22, wy + (n1 - 0.5) * 22));

            let col;
            if (d < 1 || lake < 1) {
              waterMask[i] = 1;
              const dep = lake < 1 ? (1 - lake) * 70 : depth;
              const t = clamp(dep / 260, 0, 1);
              col = t < 0.25 ? mix(C.shallow, C.mid, t / 0.25) : mix(C.mid, C.deep, (t - 0.25) / 0.75);
              if (dep < 7) col = mix(C.foam, col, dep / 7);
              col = mix(col, [col[0] * 0.85, col[1] * 0.92, col[2]], n2);
              biome[i] = t < 0.2 ? B.SHALLOW : B.DEEP;
              height[i] = -0.05 - t * 0.1;
            } else {
              const rd = riverDist(wx, wy);
              rdist[i] = Math.min(65535, rd | 0);
              const coast = Math.min(d - 1, lake - 1);
              let e = elevation(wx, wy, n1) + (n2 - 0.5) * 0.14 + (n1 - 0.5) * 0.1;
              let m = 0.62 - (wy / H) * 0.55 + Math.exp(-rd / 85) * 0.85 + (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.2;
              if (coast < 0.06) m += (0.06 - coast) * 2.5;
              if (wx > 2650 && wy > 1150) m -= 0.38 * smooth(1150, 1500, wy) * smooth(2650, 2950, wx);
              if (wy > 2150) m -= 0.35;
              if (wx < 1450) m += 0.12;
              if (wx > 2100 && wx < 2700 && wy > 900 && wy < 1500) m += 0.18; // Galilee
              let b;
              if (m < 0.18) { col = mix(C.desert, C.desert2, clamp(n2 * 1.4 - 0.2, 0, 1)); b = B.DESERT; }
              else if (m < 0.36) { col = mix(C.desert, C.steppe, (m - 0.18) / 0.18); b = B.STEPPE; }
              else if (m < 0.62) { col = mix(C.steppe, C.grass, smooth(0.36, 0.62, m)); b = B.GRASS; }
              else { col = mix(C.grass, C.lush, smooth(0.62, 0.95, m)); b = B.LUSH; }
              if (coast < 0.035 && e < 0.25) { col = mix(C.beach, col, coast / 0.035); if (coast < 0.02) b = B.BEACH; }
              if (e > 0.32) { col = mix(col, mix(C.rock, C.rock2, n2), smooth(0.32, 0.6, e)); if (e > 0.45) b = B.ROCK; }
              if (e > 0.82) { col = mix(col, C.snow, smooth(0.82, 0.98, e)); b = B.SNOW; }
              biome[i] = b;
              height[i] = e;
            }
            cols[i * 3] = col[0]; cols[i * 3 + 1] = col[1]; cols[i * 3 + 2] = col[2];
          }
        }
        onProgress && onProgress(py / MH * 0.85);
        if (py < MH) { setTimeout(chunk, 0); return; }

        // Hill shading pass (light from the north-west)
        for (let y = 0; y < MH; y++) {
          for (let x = 0; x < MW; x++) {
            const i = y * MW + x;
            const a = height[Math.max(0, y - 1) * MW + Math.max(0, x - 1)];
            const b = height[Math.min(MH - 1, y + 1) * MW + Math.min(MW - 1, x + 1)];
            let shade = waterMask[i] ? 1 : clamp(1 + (a - b) * 9, 0.7, 1.3);
            const g = 0.97 + hash(x, y) * 0.06;
            data[i * 4] = clamp(cols[i * 3] * shade * g, 0, 255);
            data[i * 4 + 1] = clamp(cols[i * 3 + 1] * shade * g, 0, 255);
            data[i * 4 + 2] = clamp(cols[i * 3 + 2] * shade * g, 0, 255);
            data[i * 4 + 3] = 255;
          }
        }
        tctx.putImageData(img, 0, 0);
        drawRivers(tctx);
        onProgress && onProgress(0.95);

        miniBase = document.createElement('canvas');
        miniBase.width = 240; miniBase.height = 160;
        const mc = miniBase.getContext('2d');
        mc.imageSmoothingQuality = 'high';
        mc.drawImage(terrain, 0, 0, 240, 160);
        resolve();
      }
      chunk();
    });
  }

  function strokeSmooth(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l[0], l[1]);
    g.stroke();
  }

  function drawRivers(g) {
    g.save();
    g.scale(1 / RES, 1 / RES);
    g.lineCap = 'round'; g.lineJoin = 'round';
    RIVERS.forEach(r => {
      g.strokeStyle = 'rgba(70,130,50,0.28)'; g.lineWidth = r.w * 9; strokeSmooth(g, r.pts);
      g.strokeStyle = 'rgba(60,120,45,0.35)'; g.lineWidth = r.w * 4; strokeSmooth(g, r.pts);
      g.strokeStyle = '#2f7fa8'; g.lineWidth = r.w; strokeSmooth(g, r.pts);
      g.strokeStyle = 'rgba(160,220,235,0.6)'; g.lineWidth = r.w * 0.35; strokeSmooth(g, r.pts);
    });
    g.restore();
  }

  function cellIndex(x, y) {
    const px = clamp((x / RES) | 0, 0, MW - 1), py = clamp((y / RES) | 0, 0, MH - 1);
    return py * MW + px;
  }
  function isWater(x, y) { return waterMask[cellIndex(x, y)] === 1; }

  /* ---------------- Sprites ---------------- */
  function makeSprite(w, h, ax, ay, fn) {
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    fn(g, w, h);
    return { c, w, h, ax, ay };
  }
  function shadow(g, x, y, rx, ry, a = 0.22) {
    g.fillStyle = `rgba(30,20,10,${a})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }
  function blob(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

  const SPRITES = {};
  function buildSprites() {
    const R = Math.random;
    SPRITES.palm = [0, 1, 2].map(() => makeSprite(56, 76, 26, 70, g => {
      shadow(g, 34, 70, 18, 5);
      const lean = (R() - 0.5) * 14;
      g.strokeStyle = '#7a5530'; g.lineWidth = 4.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(26, 70); g.quadraticCurveTo(22 + lean * 0.3, 46, 28 + lean, 24); g.stroke();
      g.strokeStyle = '#5e3f22'; g.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const t = i / 8, y = 68 - t * 44, x = 26 + (lean + 2) * t * t; g.beginPath(); g.moveTo(x - 2.5, y); g.lineTo(x + 2.5, y - 1.5); g.stroke(); }
      const cx = 28 + lean, cy = 24;
      [-2.8, -2.25, -1.6, -1.0, -0.4, 0.2, 0.75].forEach((a, k) => {
        const len = 20 + R() * 6, ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len * 0.6 + 9;
        const mx = cx + Math.cos(a) * len * 0.55, my = cy + Math.sin(a) * len * 0.55 - 4;
        g.fillStyle = k % 2 ? '#3f7d32' : '#4f9440';
        g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(mx - 3, my - 4, ex, ey); g.quadraticCurveTo(mx + 2, my + 3, cx, cy); g.fill();
      });
      blob(g, cx - 2, cy + 3, 2.4, '#6b4423'); blob(g, cx + 2, cy + 4, 2.4, '#7a5028');
    }));
    const roundTree = (canopy, dark, light, trunk = '#6b4a2b') => makeSprite(50, 58, 25, 54, g => {
      shadow(g, 29, 54, 18, 5.5);
      g.fillStyle = trunk; g.fillRect(23, 34, 5, 20);
      const blobs = [[25, 26, 13], [16, 31, 10], [34, 31, 10], [20, 20, 9], [31, 19, 9]];
      blobs.forEach(([x, y, r]) => blob(g, x + 1, y + 2, r, dark));
      blobs.forEach(([x, y, r]) => blob(g, x, y, r, canopy));
      blobs.forEach(([x, y, r]) => blob(g, x - r * 0.3, y - r * 0.35, r * 0.45, light));
    });
    SPRITES.olive = [roundTree('#86a066', '#5f7a4a', '#a8bf86', '#5d4a37'), roundTree('#7c9860', '#5a7344', '#9fb87c', '#5d4a37')];
    SPRITES.tree = [roundTree('#4f8f3c', '#356b2a', '#73b257'), roundTree('#5a9a40', '#3c7330', '#7dbb5c')];
    SPRITES.cedar = [0, 1].map(() => makeSprite(46, 72, 23, 68, g => {
      shadow(g, 27, 68, 16, 5);
      g.fillStyle = '#5a3e26'; g.fillRect(21, 50, 5, 18);
      const layers = [[56, 21], [44, 18], [33, 14], [23, 10], [14, 6]];
      layers.forEach(([y, w]) => {
        g.fillStyle = '#244d30'; g.beginPath(); g.moveTo(23 - w, y + 2); g.lineTo(23, y - 14); g.lineTo(23 + w, y + 2); g.closePath(); g.fill();
        g.fillStyle = '#336b40'; g.beginPath(); g.moveTo(23 - w + 2, y); g.lineTo(23, y - 14); g.lineTo(23 + w * 0.3, y); g.closePath(); g.fill();
      });
    }));
    SPRITES.bush = [['#6c9447', '#4d6f33'], ['#a39a5b', '#7e7642'], ['#5f8a3f', '#456a2e']].map(([c, d]) => makeSprite(30, 22, 15, 19, g => {
      shadow(g, 17, 19, 12, 3.5);
      [[9, 13, 6], [16, 11, 7], [22, 14, 5]].forEach(([x, y, r]) => blob(g, x, y + 1, r, d));
      [[9, 13, 6], [16, 11, 7], [22, 14, 5]].forEach(([x, y, r]) => blob(g, x, y, r * 0.85, c));
    }));
    SPRITES.rock = [0, 1, 2].map(() => makeSprite(34, 26, 17, 22, g => {
      shadow(g, 19, 22, 14, 4);
      const pts = [[4, 21], [6, 11], [13, 5], [22, 6], [29, 12], [30, 21]].map(([x, y]) => [x + (R() - 0.5) * 3, y + (R() - 0.5) * 3]);
      g.fillStyle = '#8a7f72'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
      g.fillStyle = '#aea392'; g.beginPath(); g.moveTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.lineTo(pts[3][0], pts[3][1]); g.lineTo(18, 13); g.closePath(); g.fill();
      g.fillStyle = '#6d6358'; g.beginPath(); g.moveTo(pts[4][0], pts[4][1]); g.lineTo(pts[5][0], pts[5][1]); g.lineTo(18, 21); g.lineTo(20, 13); g.closePath(); g.fill();
    }));
    SPRITES.flowers = [['#e85d5d', '#fff'], ['#f5d142', '#fff'], ['#b783e8', '#f5d142']].map(([a, b]) => makeSprite(26, 16, 13, 14, g => {
      g.strokeStyle = '#5b8a3a'; g.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const x = 3 + R() * 20, y = 6 + R() * 8;
        g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y); g.stroke();
        blob(g, x, y, 1.8, i % 3 ? a : b);
      }
    }));
    SPRITES.grass = [0, 1].map(() => makeSprite(24, 16, 12, 15, g => {
      g.strokeStyle = '#5f8c3d'; g.lineWidth = 1.2; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const x = 4 + R() * 16; g.beginPath(); g.moveTo(x, 15); g.quadraticCurveTo(x + (R() - 0.5) * 4, 9, x + (R() - 0.5) * 7, 3 + R() * 5); g.stroke(); }
    }));
    // Cloud
    SPRITES.cloud = makeSprite(260, 130, 130, 65, g => {
      for (let i = 0; i < 14; i++) {
        const x = 50 + R() * 160, y = 45 + R() * 40, r = 24 + R() * 30;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    });
    SPRITES.cloudShadow = makeSprite(260, 130, 130, 65, g => {
      g.drawImage(SPRITES.cloud.c, 0, 0, 260, 130);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#000'; g.fillRect(0, 0, 260, 130);
    });
  }

  function makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 1400; i++) {
      const v = Math.random() > 0.5 ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.5})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 1.5, 1);
    }
    return c;
  }

  /* ---------------- World objects ---------------- */
  let decor = [], glints = [], clouds = [], houses = [];
  const JERUSALEM = { x: 2245, y: 1615, r: 95 };

  function placeDecor() {
    const rand = window.Core.rng(777);
    const sites = window.JOURNEY;
    decor = [];
    for (let k = 0; k < 9000 && decor.length < 3200; k++) {
      const x = 40 + rand() * (W - 80), y = 40 + rand() * (H - 80);
      const i = cellIndex(x, y);
      if (waterMask[i]) continue;
      if (sites.some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < 75 * 75)) continue;
      if ((x - JERUSALEM.x) ** 2 + (y - JERUSALEM.y) ** 2 < (JERUSALEM.r + 25) ** 2) continue;
      if (riverDist(x, y) < 14) continue;
      const b = biome[i], rd = rdist[i], r = rand();
      let type = null;
      if (b === B.SNOW) continue;
      if (b === B.ROCK) type = r < 0.45 ? 'rock' : (y < 1100 && r < 0.6 ? 'cedar' : null);
      else if (b === B.BEACH) type = r < 0.25 ? 'palm' : null;
      else if (b === B.DESERT) {
        if (rd < 140) type = r < 0.7 ? 'palm' : r < 0.85 ? 'bush' : null;
        else type = r < 0.1 ? 'rock' : r < 0.16 ? 'bush' : null;
      } else if (b === B.STEPPE) type = r < 0.25 ? 'bush' : r < 0.38 ? 'olive' : r < 0.46 ? 'rock' : r < 0.6 ? 'grass' : (rd < 120 && r < 0.75 ? 'palm' : null);
      else if (b === B.GRASS) type = r < 0.25 ? 'olive' : r < 0.42 ? 'tree' : r < 0.55 ? 'bush' : r < 0.68 ? 'flowers' : r < 0.85 ? 'grass' : null;
      else if (b === B.LUSH) type = (y < 1150 && r < 0.3) ? 'cedar' : r < 0.6 ? 'tree' : r < 0.72 ? 'bush' : r < 0.84 ? 'flowers' : 'grass';
      if (!type) continue;
      const vars = SPRITES[type];
      decor.push({ x, y, spr: vars[(rand() * vars.length) | 0], s: 0.8 + rand() * 0.5, flip: rand() < 0.5 });
    }
    glints = [];
    for (let k = 0; k < 40000 && glints.length < 2600; k++) {
      const x = rand() * W, y = rand() * H;
      if (isWater(x, y)) glints.push({ x, y, p: rand() * Math.PI * 2, l: 6 + rand() * 10, sp: 0.6 + rand() * 1.2 });
    }
    clouds = [];
    for (let k = 0; k < 14; k++) clouds.push({ x: rand() * W, y: rand() * H, s: 1.2 + rand() * 1.8, v: 8 + rand() * 10 });
    houses = [];
    for (let k = 0; k < 400 && houses.length < 26; k++) {
      const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * (JERUSALEM.r - 18);
      const x = JERUSALEM.x + Math.cos(a) * rr, y = JERUSALEM.y + Math.sin(a) * rr;
      if (sites.some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < 34 * 34)) continue;
      if (houses.some(h => (h.x - x) ** 2 + (h.y - y) ** 2 < 18 * 18)) continue;
      houses.push({ x, y, w: 11 + rand() * 7, h: 8 + rand() * 5, lit: rand() < 0.7 });
    }
  }

  /* ---------------- State ---------------- */
  let canvas, ctx, mini, mctx, hooks = {};
  let dpr = 1, zoom = 1, time = 0, last = 0, running = false, ready = false, inputEnabled = true;
  const player = { x: 3880, y: 1660, facing: 1, phase: 0, moving: false };
  const cam = { x: 3880, y: 1660 };
  const keys = {};
  let target = null, targetLoc = null, pointerHeld = false, pointerStart = null, pointerWorld = null;
  let nearLoc = null, lastSave = 0, fade = 0, fadeTo = null;
  const particles = [], rings = [];
  let grain, grainPattern;

  const DAY_LENGTH = 300; // seconds for a full day/night cycle
  let dayClock = 0.08;

  function progress() {
    const done = window.Core.state.completed;
    const next = window.JOURNEY.findIndex(l => !done[l.id]);
    return { done, next: next === -1 ? window.JOURNEY.length : next };
  }
  function isUnlocked(loc) {
    const { done, next } = progress();
    return !!done[loc.id] || window.JOURNEY.indexOf(loc) <= next;
  }

  /* ---------------- Init ---------------- */
  async function init(cv, miniCanvas, h, onProgress) {
    canvas = cv; ctx = canvas.getContext('2d');
    mini = miniCanvas; mctx = mini.getContext('2d');
    hooks = h || {};
    buildSprites();
    grain = makeGrain();
    await generateTerrain(onProgress);
    placeDecor();
    grainPattern = ctx.createPattern(grain, 'repeat');
    const saved = window.Core.state.player;
    if (saved && saved.x) { player.x = saved.x; player.y = saved.y; }
    cam.x = player.x; cam.y = player.y;
    zoom = window.innerWidth < 700 ? 0.85 : 1;
    resize();
    window.addEventListener('resize', resize);
    bindInput();
    ready = true;
    onProgress && onProgress(1);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    mini.width = mini.clientWidth * dpr; mini.height = mini.clientHeight * dpr;
  }

  function screenToWorld(sx, sy) {
    const r = canvas.getBoundingClientRect();
    return { x: cam.x + (sx - r.left - r.width / 2) / zoom, y: cam.y + (sy - r.top - r.height / 2) / zoom };
  }

  function locAt(wx, wy, radius = 60) {
    let best = null, bd = radius * radius;
    window.JOURNEY.forEach(l => { const d = (l.x - wx) ** 2 + (l.y - 20 - wy) ** 2; if (d < bd) { bd = d; best = l; } });
    return best;
  }

  function bindInput() {
    window.addEventListener('keydown', e => {
      if (!running || !inputEnabled) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; target = null; targetLoc = null; e.preventDefault(); }
      if ((k === 'e' || k === 'enter' || k === ' ') && nearLoc) { e.preventDefault(); tryOpen(nearLoc); }
      if (k === '+' || k === '=') setZoom(zoom * 1.15);
      if (k === '-') setZoom(zoom / 1.15);
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    canvas.addEventListener('pointerdown', e => {
      if (!inputEnabled) return;
      canvas.setPointerCapture(e.pointerId);
      pointerHeld = true;
      pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      pointerWorld = screenToWorld(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', e => {
      if (!pointerHeld) return;
      pointerWorld = screenToWorld(e.clientX, e.clientY);
      if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 12) { target = pointerWorld; targetLoc = null; }
    });
    const up = e => {
      if (!pointerHeld) return;
      pointerHeld = false;
      const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
      if (moved < 12) {
        const w = screenToWorld(e.clientX, e.clientY);
        const loc = locAt(w.x, w.y, 55 / Math.min(1, zoom));
        if (loc) {
          if (Math.hypot(loc.x - player.x, loc.y - player.y) < 85) { target = null; tryOpen(loc); }
          else { target = { x: loc.x, y: loc.y + 34 }; targetLoc = loc; }
        } else { target = w; targetLoc = null; }
        spawnTapRing(w.x, w.y);
      } else { target = null; }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { pointerHeld = false; target = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });

    mini.addEventListener('click', e => {
      const r = mini.getBoundingClientRect();
      const wx = (e.clientX - r.left) / r.width * W, wy = (e.clientY - r.top) / r.height * H;
      let best = null, bd = 160 * 160;
      window.JOURNEY.forEach(l => { const d = (l.x - wx) ** 2 + (l.y - wy) ** 2; if (d < bd) { bd = d; best = l; } });
      if (best) travelTo(best.id);
    });
  }

  function setZoom(z) { zoom = clamp(z, 0.45, 1.8); }

  function tryOpen(loc) {
    if (!isUnlocked(loc)) {
      const { next } = progress();
      window.Core.toast(`🔒 First complete: ${window.JOURNEY[next].name}`);
      window.Core.Sound.play('wrong');
      return;
    }
    keysReset();
    hooks.onOpen && hooks.onOpen(loc);
  }
  function keysReset() { for (const k in keys) keys[k] = false; target = null; targetLoc = null; }

  function travelTo(id) {
    const loc = window.JOURNEY.find(l => l.id === id);
    if (!loc) return;
    if (!isUnlocked(loc)) { tryOpen(loc); return; }
    fadeTo = { x: loc.x, y: loc.y + 45 };
    fade = 0.0001;
    keysReset();
  }

  /* ---------------- Particles ---------------- */
  function spawn(p) { if (particles.length < 600) particles.push(p); }
  function spawnTapRing(x, y) { rings.push({ x, y, t: 0, max: 0.5, r: 22, col: '255,240,200' }); }
  function celebrate(id) {
    const l = window.JOURNEY.find(j => j.id === id);
    if (!l) return;
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 220;
      spawn({ x: l.x, y: l.y - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 120, life: 0, max: 1.2 + Math.random() * 1.2, size: 2 + Math.random() * 3, col: Math.random() < 0.7 ? '255,215,110' : '255,255,255' });
    }
    rings.push({ x: l.x, y: l.y, t: 0, max: 1.4, r: 260, col: '255,215,120' });
    rings.push({ x: l.x, y: l.y, t: -0.25, max: 1.4, r: 180, col: '255,255,255' });
  }

  /* ---------------- Update ---------------- */
  function update(dt) {
    time += dt;
    dayClock = (dayClock + dt / DAY_LENGTH) % 1;

    if (fade > 0) {
      fade += dt * 2.2;
      if (fadeTo && fade >= 1) { player.x = fadeTo.x; player.y = fadeTo.y; cam.x = player.x; cam.y = player.y; fadeTo = null; }
      if (fade >= 2) fade = 0;
    }

    let vx = 0, vy = 0;
    if (inputEnabled) {
      if (keys.arrowleft || keys.a) vx -= 1;
      if (keys.arrowright || keys.d) vx += 1;
      if (keys.arrowup || keys.w) vy -= 1;
      if (keys.arrowdown || keys.s) vy += 1;
      if (pointerHeld && pointerWorld && performance.now() - pointerStart.t > 180) { target = pointerWorld; targetLoc = null; }
      if (!vx && !vy && target) {
        const dx = target.x - player.x, dy = target.y - player.y, d = Math.hypot(dx, dy);
        if (d < 6) {
          const tl = targetLoc; target = null; targetLoc = null;
          if (tl) tryOpen(tl);
        } else { vx = dx / d; vy = dy / d; }
      }
    }
    const len = Math.hypot(vx, vy);
    const onWater = isWater(player.x, player.y);
    player.moving = len > 0.01;
    if (player.moving) {
      vx /= len; vy /= len;
      const sp = (onWater ? 250 : 210);
      player.x = clamp(player.x + vx * sp * dt, 30, W - 30);
      player.y = clamp(player.y + vy * sp * dt, 30, H - 30);
      if (Math.abs(vx) > 0.15) player.facing = vx < 0 ? -1 : 1;
      player.phase += dt * 11;
      if (!onWater && Math.random() < dt * 14) spawn({ x: player.x - vx * 8 + (Math.random() - 0.5) * 6, y: player.y, vx: -vx * 15, vy: -10, life: 0, max: 0.6, size: 3 + Math.random() * 3, col: '200,180,140', dust: 1 });
      if (onWater && Math.random() < dt * 20) spawn({ x: player.x - vx * 18, y: player.y + 4, vx: -vx * 20 + (Math.random() - 0.5) * 20, vy: -vy * 20, life: 0, max: 0.9, size: 2 + Math.random() * 2, col: '230,250,255', dust: 1 });
    }
    player.onWater = onWater;

    const k = Math.min(1, dt * 4);
    cam.x += (player.x - cam.x) * k;
    cam.y += (player.y - cam.y) * k;

    // proximity
    let near = null, nd = 90 * 90;
    window.JOURNEY.forEach(l => { const d = (l.x - player.x) ** 2 + (l.y - player.y) ** 2; if (d < nd) { nd = d; near = l; } });
    if (near !== nearLoc) { nearLoc = near; hooks.onNear && hooks.onNear(near, near ? !isUnlocked(near) : false); }

    // ambient particles: sparkles around the next site, fireflies at night
    const { next } = progress();
    const nl = window.JOURNEY[next];
    if (nl && Math.random() < dt * 12) {
      const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 40;
      spawn({ x: nl.x + Math.cos(a) * r, y: nl.y + Math.sin(a) * r * 0.5, vx: 0, vy: -25 - Math.random() * 25, life: 0, max: 1.6, size: 1.5 + Math.random() * 2, col: '255,225,140', glow: 1 });
    }
    const night = nightness();
    if (night > 0.3 && Math.random() < dt * 10 * night) {
      spawn({ x: cam.x + (Math.random() - 0.5) * 900, y: cam.y + (Math.random() - 0.5) * 700, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 0, max: 3 + Math.random() * 2, size: 1.6, col: '210,255,140', glow: 1, firefly: 1 });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      if (p.g) p.vy += p.g * dt;
      if (p.firefly) { p.vx += (Math.random() - 0.5) * 30 * dt; p.vy += (Math.random() - 0.5) * 30 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].max) rings.splice(i, 1); }
    clouds.forEach(c => { c.x += c.v * dt; if (c.x > W + 400) c.x = -400; });

    if (time - lastSave > 3) {
      lastSave = time;
      const s = window.Core.state;
      if (!s.player || Math.abs(s.player.x - player.x) + Math.abs(s.player.y - player.y) > 4) {
        s.player = { x: Math.round(player.x), y: Math.round(player.y) };
        try { localStorage.setItem('lamp-and-path-v1', JSON.stringify(s)); } catch (e) { /* ignore */ }
      }
    }
  }

  function nightness() {
    const sun = Math.cos(dayClock * Math.PI * 2);
    return 1 - smooth(-0.35, 0.15, sun);
  }
  function duskness() {
    const sun = Math.cos(dayClock * Math.PI * 2);
    return Math.max(0, 1 - Math.abs(sun + 0.1) / 0.3);
  }

  /* ---------------- Rendering ---------------- */
  function render() {
    const cw = canvas.width, ch = canvas.height;
    const s = dpr * zoom;
    const vw = cw / s, vh = ch / s;
    const vx0 = cam.x - vw / 2, vy0 = cam.y - vh / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#123f6c';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(s, 0, 0, s, -vx0 * s, -vy0 * s);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // terrain
    const sx = clamp(Math.floor(vx0 / RES) - 1, 0, MW - 1), sy = clamp(Math.floor(vy0 / RES) - 1, 0, MH - 1);
    const ex = clamp(Math.ceil((vx0 + vw) / RES) + 1, 1, MW), ey = clamp(Math.ceil((vy0 + vh) / RES) + 1, 1, MH);
    if (ex > sx && ey > sy) ctx.drawImage(terrain, sx, sy, ex - sx, ey - sy, sx * RES, sy * RES, (ex - sx) * RES, (ey - sy) * RES);

    // fine grain texture for crispness
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = grainPattern;
    ctx.fillRect(vx0, vy0, vw, vh);
    ctx.globalAlpha = 1;

    const inView = (x, y, m) => x > vx0 - m && x < vx0 + vw + m && y > vy0 - m && y < vy0 + vh + m;

    // water glints
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < glints.length; i++) {
      const gl = glints[i];
      if (!inView(gl.x, gl.y, 20)) continue;
      const a = Math.sin(time * gl.sp + gl.p);
      if (a < 0.4) continue;
      ctx.globalAlpha = (a - 0.4) * 0.9;
      const off = Math.sin(time * 0.5 + gl.p) * 4;
      ctx.beginPath(); ctx.moveTo(gl.x - gl.l / 2 + off, gl.y); ctx.quadraticCurveTo(gl.x + off, gl.y - 2.5, gl.x + gl.l / 2 + off, gl.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // cloud shadows on the ground
    clouds.forEach(c => {
      const cx = c.x + 120, cy = c.y + 160;
      if (!inView(cx, cy, 260 * c.s)) return;
      ctx.globalAlpha = 0.13;
      ctx.drawImage(SPRITES.cloudShadow.c, cx - 130 * c.s, cy - 65 * c.s, 260 * c.s, 130 * c.s);
    });
    ctx.globalAlpha = 1;

    if (inView(JERUSALEM.x, JERUSALEM.y, 160)) drawJerusalem();
    drawTrail();

    // depth-sorted objects
    const list = [];
    for (let i = 0; i < decor.length; i++) { const d = decor[i]; if (inView(d.x, d.y, 80)) list.push(d); }
    window.JOURNEY.forEach(l => { if (inView(l.x, l.y, 260)) list.push({ x: l.x, y: l.y, loc: l }); });
    list.push({ x: player.x, y: player.y, player: true });
    list.sort((a, b) => a.y - b.y);
    const prog = progress();
    for (const o of list) {
      if (o.player) drawPlayer();
      else if (o.loc) drawLandmark(o.loc, prog);
      else {
        const sp = o.spr, w = sp.w * o.s, h = sp.h * o.s;
        if (o.flip) { ctx.save(); ctx.translate(o.x, 0); ctx.scale(-1, 1); ctx.drawImage(sp.c, -sp.ax * o.s, o.y - sp.ay * o.s, w, h); ctx.restore(); }
        else ctx.drawImage(sp.c, o.x - sp.ax * o.s, o.y - sp.ay * o.s, w, h);
      }
    }

    // labels on top
    window.JOURNEY.forEach((l, i) => {
      if (!inView(l.x, l.y, 200)) return;
      const d = Math.hypot(l.x - player.x, l.y - player.y);
      if (i === prog.next || d < 380 || zoom < 0.7 || prog.done[l.id]) drawLabel(l, i, prog);
    });

    // particles
    for (const p of particles) {
      if (!inView(p.x, p.y, 20)) continue;
      const t = p.life / p.max;
      const a = p.firefly ? Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(p.life * 8)) : (1 - t);
      ctx.globalAlpha = clamp(a, 0, 1) * (p.dust ? 0.5 : 1);
      ctx.fillStyle = `rgb(${p.col})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.dust ? (0.6 + t) : 1), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    rings.forEach(r => {
      if (r.t < 0) return;
      const t = r.t / r.max;
      ctx.strokeStyle = `rgba(${r.col},${(1 - t) * 0.8})`;
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * t, r.r * t * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    });

    // clouds
    clouds.forEach(c => {
      if (!inView(c.x, c.y, 260 * c.s)) return;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(SPRITES.cloud.c, c.x - 130 * c.s, c.y - 65 * c.s, 260 * c.s, 130 * c.s);
    });
    ctx.globalAlpha = 1;

    // lighting: dusk tint, night, and light sources
    const night = nightness(), dusk = duskness();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dusk > 0) { ctx.fillStyle = `rgba(255,120,50,${dusk * 0.16})`; ctx.fillRect(0, 0, cw, ch); }
    if (night > 0) { ctx.fillStyle = `rgba(10,16,52,${night * 0.6})`; ctx.fillRect(0, 0, cw, ch); }
    ctx.setTransform(s, 0, 0, s, -vx0 * s, -vy0 * s);
    ctx.globalCompositeOperation = 'lighter';
    const light = (x, y, r, col, a) => {
      if (!inView(x, y, r)) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    window.JOURNEY.forEach((l, i) => {
      const pulse = 0.85 + 0.15 * Math.sin(time * 3 + i);
      if (i === prog.next) light(l.x, l.y - 30, 170, '255,200,90', (0.18 + night * 0.4) * pulse);
      else if (prog.done[l.id]) light(l.x, l.y - 20, 110, '255,170,70', (0.05 + night * 0.4) * pulse);
    });
    if (night > 0.05) {
      if (inView(JERUSALEM.x, JERUSALEM.y, 150)) houses.forEach(h => { if (h.lit) light(h.x, h.y - 3, 26, '255,190,90', night * 0.45); });
      light(player.x + player.facing * 10, player.y - 22, 120, '255,200,120', night * 0.55);
      particles.forEach(p => { if (p.glow) light(p.x, p.y, 10, p.firefly ? '200,255,120' : '255,220,140', 0.5 * (1 - p.life / p.max)); });
    }
    ctx.globalCompositeOperation = 'source-over';

    // guide arrow toward the next site
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const nl = window.JOURNEY[prog.next];
    if (nl) drawGuide(nl, vx0, vy0, vw, vh);

    if (fade > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(20,14,40,${fade < 1 ? fade : 2 - fade})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  function drawGuide(nl, vx0, vy0, vw, vh) {
    const sxp = (nl.x - vx0) * zoom, syp = (nl.y - vy0) * zoom;
    const cw = vw * zoom, ch = vh * zoom;
    if (sxp > 0 && sxp < cw && syp > 0 && syp < ch) return;
    const cx = cw / 2, cy = ch / 2;
    const ang = Math.atan2(syp - cy, sxp - cx);
    const m = 46;
    const tx = clamp(cx + Math.cos(ang) * 2000, m, cw - m), ty = clamp(cy + Math.sin(ang) * 2000, m + 10, ch - m - 40);
    const bob = Math.sin(time * 4) * 4;
    ctx.save();
    ctx.translate(tx + Math.cos(ang) * bob, ty + Math.sin(ang) * bob);
    ctx.rotate(ang);
    ctx.shadowColor = 'rgba(255,200,80,0.9)'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    const dist = Math.round(Math.hypot(nl.x - player.x, nl.y - player.y) / 10);
    ctx.font = '600 12px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    const lx = clamp(tx - Math.cos(ang) * 34, 80, cw - 80), ly = clamp(ty - Math.sin(ang) * 30, 30, ch - 50);
    const label = `${nl.name} · ${dist} mi`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,30,0.75)'; ctx.strokeText(label, lx, ly);
    ctx.fillStyle = '#ffe9b0'; ctx.fillText(label, lx, ly);
  }

  function drawTrail() {
    const J = window.JOURNEY;
    const { done, next } = progress();
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < J.length - 1; i++) {
      const a = J[i], b = J[i + 1];
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
      if (done[b.id]) { ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,214,120,0.55)'; ctx.lineWidth = 4; }
      else if (i + 1 === next) { ctx.setLineDash([10, 12]); ctx.lineDashOffset = -time * 30; ctx.strokeStyle = 'rgba(255,230,160,0.85)'; ctx.lineWidth = 3.5; }
      else { ctx.setLineDash([4, 14]); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawJerusalem() {
    const { x, y, r } = JERUSALEM;
    ctx.save();
    shadowE(x, y + 6, r + 8, (r + 8) * 0.62, 0.25);
    ctx.fillStyle = '#d8c7a0';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,130,95,0.5)'; ctx.lineWidth = 1;
    for (let k = -r; k < r; k += 12) { ctx.beginPath(); ctx.moveTo(x + k, y - r * 0.6); ctx.lineTo(x + k + 10, y + r * 0.6); ctx.stroke(); }
    houses.forEach(h => {
      ctx.fillStyle = 'rgba(60,40,20,0.25)'; ctx.fillRect(h.x - h.w / 2 + 2, h.y - h.h + 3, h.w, h.h);
      ctx.fillStyle = '#efe2c4'; ctx.fillRect(h.x - h.w / 2, h.y - h.h, h.w, h.h);
      ctx.fillStyle = '#cdb88e'; ctx.fillRect(h.x - h.w / 2, h.y - h.h, h.w, 3);
      ctx.fillStyle = h.lit && nightness() > 0.3 ? '#ffd27a' : '#6b5638'; ctx.fillRect(h.x - 1.5, h.y - h.h + 4, 3, 3);
    });
    // walls with towers
    ctx.strokeStyle = '#b39a6c'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d9c597'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y - 2, r, r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
      const tx = x + Math.cos(a) * r, ty = y + Math.sin(a) * r * 0.62;
      ctx.fillStyle = '#a88e60'; ctx.fillRect(tx - 6, ty - 12, 12, 14);
      ctx.fillStyle = '#d6c08f'; ctx.fillRect(tx - 6, ty - 14, 12, 4);
    }
    ctx.restore();
  }

  function shadowE(x, y, rx, ry, a) { ctx.fillStyle = `rgba(30,20,10,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

  function drawLabel(l, i, prog) {
    const done = prog.done[l.id];
    const locked = !done && i > prog.next;
    ctx.font = `600 ${i === prog.next ? 15 : 13}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    const txt = (locked ? '🔒 ' : done ? '★'.repeat(done) + ' ' : '') + l.name;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(25,15,35,0.7)';
    ctx.strokeText(txt, l.x, l.y + 30);
    ctx.fillStyle = locked ? '#d5d0dc' : i === prog.next ? '#ffe39a' : '#fff4dc';
    ctx.fillText(txt, l.x, l.y + 30);
  }

  /* ---------------- Landmarks ---------------- */
  function drawLandmark(l, prog) {
    const i = window.JOURNEY.indexOf(l);
    const done = prog.done[l.id];
    const isNext = i === prog.next;
    const locked = !done && !isNext;
    const x = l.x, y = l.y;
    ctx.save();

    // glowing base ring
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = locked ? 'rgba(230,230,240,0.35)' : isNext ? `rgba(255,215,110,${0.55 + pulse * 0.45})` : 'rgba(255,200,110,0.75)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, 46, 17, 0, 0, Math.PI * 2); ctx.stroke();
    if (isNext) {
      ctx.strokeStyle = `rgba(255,235,170,${0.5 * (1 - pulse)})`;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 46 + pulse * 22, 17 + pulse * 8, 0, 0, Math.PI * 2); ctx.stroke();
    }

    if (locked) ctx.globalAlpha = 0.82;
    ICONS[l.icon] ? ICONS[l.icon](x, y, done, l) : ICONS.pillar(x, y, done, l);
    ctx.globalAlpha = 1;

    // light beam and floating scroll for the next site
    if (isNext) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y - 340, 0, y);
      g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(1, `rgba(255,220,120,${0.22 + pulse * 0.12})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 12, y - 340); ctx.lineTo(x + 12, y - 340); ctx.lineTo(x + 30, y); ctx.lineTo(x - 30, y); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      drawScroll(x, y - 92 + Math.sin(time * 2.4) * 5);
    }
    if (done) drawLamp(x + 34, y + 2);
    ctx.restore();
  }

  function drawScroll(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 1.7) * 0.08);
    ctx.shadowColor = 'rgba(255,210,100,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#f4e4bc'; ctx.fillRect(-13, -9, 26, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c99a52'; roundRect(-17, -11, 6, 22, 3); roundRect(11, -11, 6, 22, 3);
    ctx.strokeStyle = '#9b7a4a'; ctx.lineWidth = 1;
    for (let k = -5; k <= 5; k += 3.5) { ctx.beginPath(); ctx.moveTo(-9, k); ctx.lineTo(9, k); ctx.stroke(); }
    ctx.fillStyle = '#b8372f'; ctx.beginPath(); ctx.arc(0, 9, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }

  function drawLamp(x, y) {
    shadowE(x, y + 1, 7, 2.5, 0.25);
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath(); ctx.ellipse(x, y - 3, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8703a';
    ctx.beginPath(); ctx.ellipse(x - 1, y - 5, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    const f = Math.sin(time * 12 + x) * 1.2;
    const g = ctx.createRadialGradient(x + 6, y - 10, 0, x + 6, y - 10, 9);
    g.addColorStop(0, '#fff6c8'); g.addColorStop(0.4, '#ffbf3f'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x + 4, y - 5); ctx.quadraticCurveTo(x + 9 + f, y - 10, x + 6 + f, y - 17); ctx.quadraticCurveTo(x + 3, y - 10, x + 4, y - 5); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, y - 10, 8, 0, Math.PI * 2); ctx.fill();
  }

  function poly(pts, fill) { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([a, b], k) => k ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fill(); }

  const ICONS = {
    garden(x, y) {
      shadowE(x + 6, y, 44, 12, 0.25);
      ctx.fillStyle = '#6b4a2b';
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x - 2, y - 30, x - 6, y - 46); ctx.lineTo(x + 6, y - 46); ctx.quadraticCurveTo(x + 2, y - 30, x + 6, y); ctx.fill();
      [[0, -66, 30], [-22, -54, 20], [22, -54, 20], [-12, -80, 18], [14, -80, 18]].forEach(([dx, dy, r]) => blob(ctx, x + dx + 2, y + dy + 3, r, '#2e6b2c'));
      [[0, -66, 30], [-22, -54, 20], [22, -54, 20], [-12, -80, 18], [14, -80, 18]].forEach(([dx, dy, r]) => blob(ctx, x + dx, y + dy, r, '#3f8f3a'));
      [[0, -66, 30], [-22, -54, 20], [22, -54, 20]].forEach(([dx, dy, r]) => blob(ctx, x + dx - r * 0.3, y + dy - r * 0.35, r * 0.4, '#6cc05a'));
      [[-14, -60], [12, -70], [-4, -84], [22, -52], [-26, -50], [4, -56]].forEach(([dx, dy], k) => {
        const glow = 0.7 + 0.3 * Math.sin(time * 2 + k);
        blob(ctx, x + dx, y + dy, 4, `rgba(230,60,50,${glow})`);
        blob(ctx, x + dx - 1, y + dy - 1, 1.4, '#ffd0c0');
      });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; blob(ctx, x + Math.cos(a) * 36, y + Math.sin(a) * 12, 2.6, k % 2 ? '#fff' : '#ffd84d'); }
    },
    mountain(x, y, done, l) {
      const big = l.id === 'sinai' ? 1 : 0.9;
      shadowE(x + 8, y, 52, 13, 0.25);
      poly([[x - 50 * big, y], [x - 6, y - 84 * big], [x + 52 * big, y]], '#7d6c5a');
      poly([[x - 6, y - 84 * big], [x + 52 * big, y], [x + 8, y]], '#5f5144');
      poly([[x - 6, y - 84 * big], [x - 20, y - 56 * big], [x - 10, y - 60 * big], [x - 2, y - 52 * big], [x + 10, y - 62 * big]], l.id === 'ararat' ? '#f6f8fb' : '#a8957c');
      if (l.id === 'sinai') {
        // cloud and lightning glow at the summit
        ctx.globalAlpha = 0.85;
        blob(ctx, x - 14, y - 92, 14, '#cfd3dc'); blob(ctx, x + 4, y - 96, 17, '#dfe2e8'); blob(ctx, x + 20, y - 90, 12, '#cfd3dc');
        ctx.globalAlpha = 1;
        if (Math.sin(time * 1.3) > 0.97) { ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 86); ctx.lineTo(x - 6, y - 70); ctx.lineTo(x + 2, y - 70); ctx.lineTo(x - 4, y - 58); ctx.stroke(); }
        // tablets
        ctx.fillStyle = '#e9e2d2'; roundRect(x + 18, y - 22, 10, 16, 4); roundRect(x + 29, y - 22, 10, 16, 4);
      } else {
        // the ark resting on the mountainside, and a rainbow
        ctx.fillStyle = '#7a4b25'; ctx.beginPath(); ctx.moveTo(x + 6, y - 30); ctx.lineTo(x + 40, y - 30); ctx.lineTo(x + 34, y - 20); ctx.lineTo(x + 12, y - 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9a6634'; ctx.fillRect(x + 14, y - 38, 18, 8);
        ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#8e44ad'].forEach((c, k) => {
          ctx.strokeStyle = c; ctx.globalAlpha = 0.35; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y - 10, 92 - k * 3, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
    },
    ziggurat(x, y) {
      shadowE(x + 8, y, 50, 13, 0.25);
      [[48, 16, '#b88a55', '#9a6f40'], [36, 15, '#c4975f', '#a57a48'], [24, 14, '#cfa36a', '#b08350']].forEach(([w, h], k) => {
        const yy = y - k * 15;
        ctx.fillStyle = k === 0 ? '#9a6f40' : k === 1 ? '#a57a48' : '#b08350'; ctx.fillRect(x - w, yy - h, w * 2, h);
        ctx.fillStyle = k === 0 ? '#b88a55' : k === 1 ? '#c4975f' : '#cfa36a'; ctx.fillRect(x - w, yy - h, w * 2, 4);
      });
      ctx.fillStyle = '#e0c08a'; ctx.fillRect(x - 6, y - 45, 12, 45);
      ctx.fillStyle = '#d9b26b'; ctx.fillRect(x - 10, y - 56, 20, 11);
      ctx.fillStyle = '#3b6fb6'; ctx.fillRect(x - 10, y - 58, 20, 3);
    },
    pyramid(x, y) {
      shadowE(x + 14, y, 54, 12, 0.25);
      poly([[x - 48, y], [x + 4, y - 62], [x + 22, y]], '#e2c48a');
      poly([[x + 4, y - 62], [x + 22, y], [x + 54, y - 4]], '#b8955d');
      poly([[x - 2, y - 55], [x + 4, y - 62], [x + 9, y - 56]], '#f5e2b0');
      // parted waters motif
      ctx.fillStyle = '#4aa3c7'; ctx.fillRect(x - 64, y + 8, 12, 4); ctx.fillRect(x + 50, y + 8, 12, 4);
      ctx.strokeStyle = '#d7f3ff'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const o = Math.sin(time * 2 + k) * 2; ctx.beginPath(); ctx.moveTo(x - 64, y - 4 - k * 8 + o); ctx.quadraticCurveTo(x - 58, y - 10 - k * 8 + o, x - 52, y - 4 - k * 8 + o); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 50, y - 4 - k * 8 - o); ctx.quadraticCurveTo(x + 56, y - 10 - k * 8 - o, x + 62, y - 4 - k * 8 - o); ctx.stroke(); }
    },
    city(x, y, done) {
      shadowE(x + 6, y, 50, 13, 0.25);
      if (done) {
        // the walls have fallen down flat
        for (let k = 0; k < 9; k++) { ctx.fillStyle = k % 2 ? '#a88d63' : '#c2a676'; ctx.save(); ctx.translate(x - 40 + k * 10, y - 4 - (k % 3) * 2); ctx.rotate((k % 3 - 1) * 0.5); ctx.fillRect(-6, -4, 12, 7); ctx.restore(); }
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 10, y - 26, 20, 18); ctx.fillStyle = '#c03a2b'; ctx.fillRect(x - 10, y - 30, 20, 4);
      } else {
        ctx.fillStyle = '#b89a6a'; ctx.fillRect(x - 44, y - 30, 88, 30);
        ctx.fillStyle = '#d2b886'; ctx.fillRect(x - 44, y - 30, 88, 5);
        [-44, -6, 32].forEach(dx => { ctx.fillStyle = '#a3865a'; ctx.fillRect(x + dx, y - 46, 14, 46); ctx.fillStyle = '#d2b886'; for (let c = 0; c < 3; c++) ctx.fillRect(x + dx + c * 5, y - 50, 3, 5); });
        ctx.fillStyle = '#5a4128'; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 6, y - 14); ctx.arc(x, y - 14, 6, Math.PI, 0); ctx.lineTo(x + 6, y); ctx.fill();
        ctx.fillStyle = '#c03a2b'; ctx.fillRect(x + 20, y - 26, 4, 10); // the scarlet cord
      }
      // trumpets
      ctx.strokeStyle = '#e6c25a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 56, y - 6); ctx.quadraticCurveTo(x - 62, y - 20, x - 52, y - 26); ctx.stroke();
    },
    tent(x, y) {
      shadowE(x + 4, y, 50, 12, 0.22);
      [[-26, '#e8dcc0', '#c9b894'], [20, '#d8c39a', '#b5a078']].forEach(([dx, c1, c2]) => {
        poly([[x + dx - 20, y], [x + dx, y - 30], [x + dx + 20, y]], c1);
        poly([[x + dx, y - 30], [x + dx + 20, y], [x + dx + 4, y]], c2);
        poly([[x + dx - 4, y], [x + dx, y - 12], [x + dx + 4, y]], '#5b452c');
      });
      // five smooth stones and a sling
      [[-6, 8], [0, 10], [6, 8], [-3, 13], [4, 13]].forEach(([dx, dy]) => blob(ctx, x + dx, y + dy - 4, 2.6, '#cfcabd'));
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 14, y + 4); ctx.quadraticCurveTo(x + 22, y + 12, x + 32, y + 2); ctx.stroke();
    },
    sheep(x, y) {
      shadowE(x, y, 46, 12, 0.18);
      // shepherd's crook
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + 4, y - 44); ctx.arc(x - 3, y - 44, 7, 0, Math.PI, true); ctx.stroke();
      [[-28, -2], [-14, 8], [18, 4], [30, -6], [-34, 10]].forEach(([dx, dy], k) => {
        const bob = Math.sin(time * 2 + k) * 1;
        const sx = x + dx, sy = y + dy + bob;
        shadowE(sx + 2, sy + 2, 10, 3, 0.2);
        [[-5, -7], [0, -9], [5, -7], [-2, -4], [3, -4]].forEach(([a, b]) => blob(ctx, sx + a, sy + b, 5, '#f7f4ec'));
        blob(ctx, sx + (k % 2 ? -9 : 9), sy - 8, 3.5, '#3a302a');
        ctx.fillStyle = '#3a302a'; ctx.fillRect(sx - 4, sy - 2, 2, 4); ctx.fillRect(sx + 3, sy - 2, 2, 4);
      });
      // still waters
      ctx.fillStyle = 'rgba(80,170,200,0.8)'; ctx.beginPath(); ctx.ellipse(x - 8, y + 22, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    },
    temple(x, y) {
      shadowE(x + 8, y, 54, 13, 0.25);
      ctx.fillStyle = '#d9c9a3'; ctx.fillRect(x - 46, y - 10, 92, 10);
      ctx.fillStyle = '#f2ead6'; ctx.fillRect(x - 30, y - 56, 60, 46);
      ctx.fillStyle = '#e1d4b4'; ctx.fillRect(x + 12, y - 56, 18, 46);
      for (let k = 0; k < 5; k++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 26 + k * 11, y - 50, 4, 40); }
      ctx.fillStyle = '#e8b93c'; ctx.fillRect(x - 33, y - 62, 66, 7);
      ctx.fillStyle = '#ffd860'; ctx.fillRect(x - 33, y - 62, 66, 2);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 6, y - 30, 12, 20);
      // smoke of incense
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 3; k++) blob(ctx, x + Math.sin(time + k) * 4, y - 70 - k * 9 - (time * 6 % 9), 5 + k * 2, '#ffffff');
      ctx.globalAlpha = 1;
    },
    gate(x, y) {
      shadowE(x + 8, y, 50, 12, 0.25);
      ctx.fillStyle = '#2d5fa8'; ctx.fillRect(x - 40, y - 52, 80, 52);
      ctx.fillStyle = '#244d8a'; ctx.fillRect(x - 46, y - 64, 16, 64); ctx.fillRect(x + 30, y - 64, 16, 64);
      ctx.fillStyle = '#e8c35a'; for (let c = 0; c < 4; c++) { ctx.fillRect(x - 46 + c * 4.5, y - 68, 3, 4); ctx.fillRect(x + 30 + c * 4.5, y - 68, 3, 4); }
      ctx.fillStyle = '#1a2f52'; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x - 13, y - 26); ctx.arc(x, y - 26, 13, Math.PI, 0); ctx.lineTo(x + 13, y); ctx.fill();
      ctx.fillStyle = '#e8c35a';
      for (let k = 0; k < 4; k++) { ctx.fillRect(x - 36 + k * 6, y - 44, 4, 3); ctx.fillRect(x + 18 + k * 6, y - 44, 4, 3); }
      // a lion
      const lx = x - 26, ly = y - 18;
      ctx.fillStyle = '#e0b04a'; ctx.fillRect(lx - 6, ly - 4, 12, 5); blob(ctx, lx + 7, ly - 4, 4, '#e0b04a');
    },
    star(x, y) {
      shadowE(x + 6, y, 46, 12, 0.24);
      ctx.fillStyle = '#7a5532'; ctx.fillRect(x - 30, y - 30, 60, 30);
      poly([[x - 38, y - 28], [x, y - 52], [x + 38, y - 28]], '#5e3f22');
      ctx.fillStyle = '#3a2614'; ctx.fillRect(x - 14, y - 22, 28, 22);
      const g = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 18);
      g.addColorStop(0, 'rgba(255,230,150,0.9)'); g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 18, y - 28, 36, 28);
      ctx.fillStyle = '#d7b86a'; ctx.fillRect(x - 8, y - 8, 16, 6); // manger
      // the star
      const sy = y - 104 + Math.sin(time * 1.5) * 3;
      ctx.save(); ctx.translate(x, sy); ctx.rotate(time * 0.2);
      ctx.shadowColor = '#fff3b0'; ctx.shadowBlur = 22; ctx.fillStyle = '#fffbe6';
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const r = k % 2 ? 4 : (k % 4 === 0 ? 20 : 11), a = k / 16 * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,240,180,0.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, sy + 10); ctx.lineTo(x, y - 52); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    },
    hill(x, y) {
      shadowE(x + 6, y, 52, 13, 0.18);
      ctx.fillStyle = '#5f9a45'; ctx.beginPath(); ctx.ellipse(x, y, 52, 30, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#76b257'; ctx.beginPath(); ctx.ellipse(x - 8, y - 4, 38, 22, 0, Math.PI, 0); ctx.fill();
      // a teacher and gathered listeners
      ctx.fillStyle = '#f4f1e8'; ctx.fillRect(x - 3, y - 40, 6, 12); blob(ctx, x, y - 43, 3.5, '#d9a77a');
      [[-30, -6, '#8a4d3a'], [-20, -12, '#3f5f8a'], [-8, -16, '#7a6a3a'], [12, -14, '#6a3a6a'], [24, -10, '#3a6a5a'], [34, -4, '#8a6a3a'], [-14, -2, '#5a4a8a'], [6, -4, '#8a3a3a']].forEach(([dx, dy, c]) => {
        ctx.fillStyle = c; ctx.fillRect(x + dx - 2.5, y + dy - 6, 5, 6); blob(ctx, x + dx, y + dy - 8, 2.4, '#c99a70');
      });
      for (let k = 0; k < 8; k++) blob(ctx, x - 40 + k * 11, y - 2 + (k % 2) * 3, 1.8, k % 2 ? '#fff' : '#ffd84d');
    },
    boat(x, y) {
      const bob = Math.sin(time * 1.8) * 2.5, tilt = Math.sin(time * 1.3) * 0.06;
      ctx.save(); ctx.translate(x, y + bob); ctx.rotate(tilt);
      ctx.fillStyle = 'rgba(10,40,70,0.3)'; ctx.beginPath(); ctx.ellipse(4, 4, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.moveTo(-36, -10); ctx.lineTo(36, -10); ctx.quadraticCurveTo(30, 4, 20, 4); ctx.lineTo(-22, 4); ctx.quadraticCurveTo(-32, 2, -36, -10); ctx.fill();
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-34, -12, 68, 3);
      ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -66); ctx.stroke();
      ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.moveTo(2, -62); ctx.quadraticCurveTo(26, -40, 4, -16); ctx.closePath(); ctx.fill();
      [-20, -10, 14, 24].forEach((dx, k) => { ctx.fillStyle = ['#8a4d3a', '#3f5f8a', '#6a3a6a', '#3a6a5a'][k]; ctx.fillRect(dx - 2.5, -20, 5, 9); blob(ctx, dx, -22, 2.6, '#c99a70'); });
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) { const r = ((time * 16 + k * 14) % 42); ctx.globalAlpha = 1 - r / 42; ctx.beginPath(); ctx.ellipse(x, y + 4, 40 + r, 9 + r * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
    house(x, y) {
      shadowE(x + 6, y, 36, 10, 0.22);
      ctx.fillStyle = '#e9dcc0'; ctx.fillRect(x - 24, y - 34, 48, 34);
      ctx.fillStyle = '#cdb88e'; ctx.fillRect(x - 26, y - 38, 52, 5);
      ctx.fillStyle = '#5a4128'; ctx.fillRect(x - 5, y - 18, 10, 18);
      const lit = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.fillStyle = `rgba(255,${200 + lit * 30},100,1)`; ctx.fillRect(x + 10, y - 26, 7, 7); ctx.fillRect(x - 17, y - 26, 7, 7);
      // a lamp on the rooftop
      drawLamp(x - 6, y - 38);
      // crescent moon above
      ctx.fillStyle = '#f7f1d0'; ctx.beginPath(); ctx.arc(x + 22, y - 66, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(30,40,80,0.9)'; ctx.beginPath(); ctx.arc(x + 26, y - 69, 7, 0, Math.PI * 2); ctx.fill();
    },
    tomb(x, y, done, l) {
      shadowE(x + 6, y, 46, 12, 0.22);
      ctx.fillStyle = '#9a8c78'; ctx.beginPath(); ctx.ellipse(x, y, 44, 40, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#b3a58f'; ctx.beginPath(); ctx.ellipse(x - 6, y - 6, 32, 28, 0, Math.PI, 0); ctx.fill();
      const open = l.id === 'tomb' || done;
      ctx.fillStyle = '#1f1812'; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 10, y - 14); ctx.arc(x, y - 14, 10, Math.PI, 0); ctx.lineTo(x + 10, y); ctx.fill();
      if (open) {
        const g = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 24);
        g.addColorStop(0, 'rgba(255,250,220,0.95)'); g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 10, 24, 0, Math.PI * 2); ctx.fill();
        blob(ctx, x + 28, y - 10, 13, '#7d705f'); blob(ctx, x + 27, y - 11, 10, '#948672'); // stone rolled away
      } else {
        blob(ctx, x, y - 12, 13, '#7d705f'); blob(ctx, x - 1, y - 13, 10, '#948672');
      }
      if (l.id === 'tomb') for (let k = 0; k < 6; k++) blob(ctx, x - 34 + k * 13, y + 6 + (k % 2) * 3, 2.4, k % 2 ? '#fff' : '#f7d8f0');
    },
    cross(x, y) {
      shadowE(x + 6, y, 50, 12, 0.24);
      ctx.fillStyle = '#8a7b62'; ctx.beginPath(); ctx.ellipse(x, y, 48, 26, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#a1927a'; ctx.beginPath(); ctx.ellipse(x - 6, y - 4, 34, 18, 0, Math.PI, 0); ctx.fill();
      [[-24, -18, 0.75], [0, -24, 1], [24, -18, 0.75]].forEach(([dx, dy, s]) => {
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(x + dx - 2.5 * s, y + dy - 52 * s, 5 * s, 52 * s);
        ctx.fillRect(x + dx - 16 * s, y + dy - 42 * s, 32 * s, 4.5 * s);
      });
      const g = ctx.createRadialGradient(x, y - 66, 0, x, y - 66, 40);
      g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 66, 40, 0, Math.PI * 2); ctx.fill();
    },
    flame(x, y) {
      ICONS.house(x, y);
      for (let k = 0; k < 5; k++) {
        const fx = x - 26 + k * 13, fy = y - 52 - Math.sin(time * 3 + k) * 4;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10);
        g.addColorStop(0, '#fff3c0'); g.addColorStop(0.45, '#ff9c2a'); g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(fx - 5, fy + 4); ctx.quadraticCurveTo(fx - 4, fy - 6, fx + Math.sin(time * 9 + k) * 2, fy - 14); ctx.quadraticCurveTo(fx + 5, fy - 4, fx + 5, fy + 4); ctx.closePath(); ctx.fill();
      }
      // rushing wind
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) { const o = (time * 60 + k * 30) % 90; ctx.beginPath(); ctx.moveTo(x - 60 + o, y - 80 + k * 8); ctx.quadraticCurveTo(x - 40 + o, y - 88 + k * 8, x - 24 + o, y - 80 + k * 8); ctx.stroke(); }
    },
    road(x, y) {
      shadowE(x, y, 44, 10, 0.18);
      ctx.fillStyle = '#c9b183'; ctx.beginPath(); ctx.moveTo(x - 50, y + 10); ctx.lineTo(x - 14, y - 40); ctx.lineTo(x + 14, y - 40); ctx.lineTo(x + 50, y + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8f7f6a'; roundRect(x + 22, y - 26, 10, 22, 3);
      // light from heaven
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y - 140, 0, y);
      g.addColorStop(0, 'rgba(255,255,230,0.7)'); g.addColorStop(1, 'rgba(255,250,200,0.05)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 6, y - 140); ctx.lineTo(x + 6, y - 140); ctx.lineTo(x + 26, y); ctx.lineTo(x - 26, y); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#7a3b2b'; ctx.fillRect(x - 10, y - 6, 20, 5); blob(ctx, x - 12, y - 4, 3, '#c99a70'); // Saul fallen to the earth
    },
    pillar(x, y, done, l) {
      shadowE(x + 6, y, 48, 12, 0.22);
      ctx.fillStyle = '#d8d0bf'; ctx.fillRect(x - 44, y - 8, 88, 8);
      const n = l.id === 'corinth' ? 5 : 4;
      for (let k = 0; k < n; k++) {
        const px = x - 34 + k * (68 / (n - 1)), h = (l.id === 'corinth' && k === n - 1) ? 28 : 54;
        ctx.fillStyle = '#efe8d8'; ctx.fillRect(px - 4.5, y - 8 - h, 9, h);
        ctx.fillStyle = '#cfc6b2'; ctx.fillRect(px + 1.5, y - 8 - h, 3, h);
        ctx.fillStyle = '#fff'; ctx.fillRect(px - 6.5, y - 12 - h, 13, 4);
      }
      ctx.fillStyle = '#efe8d8'; ctx.fillRect(x - 40, y - 72, l.id === 'corinth' ? 58 : 80, 8);
      if (l.id === 'philippi') { // prison chains
        ctx.strokeStyle = '#6d6d72'; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x - 50 + k * 5, y - 18 + k * 3, 3, 2, 0.6, 0, Math.PI * 2); ctx.stroke(); }
      }
    },
    island(x, y) {
      shadowE(x + 6, y, 44, 11, 0.2);
      ctx.fillStyle = '#8f8472'; ctx.beginPath(); ctx.ellipse(x, y, 42, 34, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#a99d88'; ctx.beginPath(); ctx.ellipse(x - 8, y - 4, 28, 22, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#2a201a'; ctx.beginPath(); ctx.ellipse(x + 6, y - 6, 9, 11, 0, Math.PI, 0); ctx.fill();
      const g = ctx.createRadialGradient(x + 6, y - 8, 0, x + 6, y - 8, 14);
      g.addColorStop(0, 'rgba(255,220,140,0.9)'); g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 6, y - 8, 14, 0, Math.PI * 2); ctx.fill();
      // new Jerusalem shining in the sky
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(time);
      ctx.fillStyle = '#fff4c4'; ctx.fillRect(x - 22, y - 104, 44, 14);
      for (let k = 0; k < 5; k++) ctx.fillRect(x - 22 + k * 10, y - 110, 4, 6);
      ctx.globalAlpha = 1;
    }
  };

  /* ---------------- Player ---------------- */
  function drawPlayer() {
    const x = player.x, y = player.y;
    const step = player.moving ? Math.sin(player.phase) : 0;
    const bob = player.moving ? Math.abs(Math.cos(player.phase)) * 2 : Math.sin(time * 2) * 0.6;
    ctx.save();
    if (player.onWater) {
      const rock = Math.sin(time * 2) * 0.05;
      ctx.translate(x, y); ctx.rotate(rock); ctx.translate(-x, -y);
      ctx.fillStyle = 'rgba(10,40,70,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 3, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a4d26'; ctx.beginPath(); ctx.moveTo(x - 22, y - 8); ctx.lineTo(x + 22, y - 8); ctx.quadraticCurveTo(x + 18, y + 3, x + 10, y + 3); ctx.lineTo(x - 12, y + 3); ctx.quadraticCurveTo(x - 19, y + 1, x - 22, y - 8); ctx.fill();
      ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - player.facing * 6, y - 8); ctx.lineTo(x - player.facing * 6, y - 52); ctx.stroke();
      ctx.fillStyle = '#f2ead6'; ctx.beginPath(); ctx.moveTo(x - player.facing * 5, y - 50); ctx.quadraticCurveTo(x - player.facing * 5 + player.facing * 18, y - 34, x - player.facing * 5, y - 14); ctx.closePath(); ctx.fill();
    } else {
      shadowE(x, y, 11, 4, 0.3);
    }
    ctx.translate(x, y); ctx.scale(1.35, 1.35); ctx.translate(-x, -y);
    const by = y - (player.onWater ? 8 : 0) - bob;
    if (!player.onWater) {
      ctx.fillStyle = '#4a3020';
      ctx.beginPath(); ctx.ellipse(x - 3 + step * 3, y - 1, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 3 - step * 3, y - 1, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    const f = player.facing;
    // staff
    ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + f * 10, by - 2 + step); ctx.lineTo(x + f * 12, by - 40 + step); ctx.stroke();
    // robe
    ctx.fillStyle = '#7b4b8f';
    ctx.beginPath(); ctx.moveTo(x - 8, by - 3); ctx.lineTo(x - 6, by - 24); ctx.quadraticCurveTo(x, by - 28, x + 6, by - 24); ctx.lineTo(x + 8, by - 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9a68ad'; ctx.fillRect(x - 6 + (f > 0 ? 0 : 6), by - 24, 6, 21);
    ctx.fillStyle = '#e8c35a'; ctx.fillRect(x - 7, by - 15, 14, 2.5); // golden sash
    // arm
    ctx.strokeStyle = '#7b4b8f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + f * 3, by - 21); ctx.lineTo(x + f * 10, by - 16 + step); ctx.stroke();
    // head + headscarf
    blob(ctx, x, by - 31, 6, '#d9a77a');
    ctx.fillStyle = '#f1e7cf';
    ctx.beginPath(); ctx.arc(x - f * 1, by - 33, 7, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(x - f * 7, by - 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c99a52'; ctx.fillRect(x - 7, by - 35, 14, 2);
    blob(ctx, x + f * 2.6, by - 30.5, 1, '#2a1a10');
    // lantern (glows at night)
    const n = nightness();
    if (n > 0.2) { ctx.fillStyle = '#e8c35a'; ctx.fillRect(x + f * 11 - 2.5, by - 14, 5, 6); blob(ctx, x + f * 11, by - 11, 2, '#fff2b0'); }
    ctx.restore();
  }

  /* ---------------- Minimap ---------------- */
  let miniTick = 0;
  function renderMini() {
    if (++miniTick % 6) return;
    const w = mini.width, h = mini.height;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(miniBase, 0, 0, w, h);
    const sx = w / W, sy = h / H;
    const { done, next } = progress();
    mctx.strokeStyle = 'rgba(255,220,140,0.6)'; mctx.lineWidth = 1 * dpr; mctx.setLineDash([2 * dpr, 2 * dpr]);
    mctx.beginPath(); window.JOURNEY.forEach((l, i) => i ? mctx.lineTo(l.x * sx, l.y * sy) : mctx.moveTo(l.x * sx, l.y * sy)); mctx.stroke();
    mctx.setLineDash([]);
    window.JOURNEY.forEach((l, i) => {
      const r = (i === next ? 3.6 : 2.4) * dpr;
      mctx.fillStyle = done[l.id] ? '#ffc94d' : i === next ? (Math.sin(time * 5) > 0 ? '#fff6c8' : '#ffd36e') : 'rgba(240,240,255,0.55)';
      mctx.beginPath(); mctx.arc(l.x * sx, l.y * sy, r, 0, Math.PI * 2); mctx.fill();
    });
    const vw = canvas.width / (dpr * zoom), vh = canvas.height / (dpr * zoom);
    mctx.strokeStyle = 'rgba(255,255,255,0.7)'; mctx.lineWidth = 1 * dpr;
    mctx.strokeRect((cam.x - vw / 2) * sx, (cam.y - vh / 2) * sy, vw * sx, vh * sy);
    mctx.fillStyle = '#ff6b8a';
    mctx.beginPath(); mctx.arc(player.x * sx, player.y * sy, 3 * dpr, 0, Math.PI * 2); mctx.fill();
    mctx.strokeStyle = '#fff'; mctx.stroke();
  }

  /* ---------------- Loop ---------------- */
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    update(dt);
    render();
    renderMini();
    requestAnimationFrame(loop);
  }

  function setActive(on) {
    if (!ready) return;
    if (on && !running) { running = true; last = 0; resize(); requestAnimationFrame(loop); }
    if (!on) { running = false; keysReset(); }
  }

  function timeOfDay() {
    const t = dayClock;
    if (t < 0.2 || t > 0.85) return '☀️ Day';
    if (t < 0.3) return '🌇 Evening';
    if (t < 0.7) return '🌙 Night';
    return '🌅 Dawn';
  }

  window.Game = {
    init, setActive, celebrate, travelTo, isUnlocked, progress, timeOfDay,
    zoomIn: () => setZoom(zoom * 1.2), zoomOut: () => setZoom(zoom / 1.2),
    setInputEnabled: v => { inputEnabled = v; if (!v) keysReset(); },
    walkToNext() {
      const { next } = progress(); const l = window.JOURNEY[next];
      if (!l) return null;
      target = { x: l.x, y: l.y + 34 }; targetLoc = l;
      return l;
    },
    centerOnNext() { const { next } = progress(); const l = window.JOURNEY[next]; if (l) travelTo(l.id); },
    get ready() { return ready; }
  };
})();
