// Dacus app trailer, v2: a phone-free, photo-driven cut on a 128 BPM grid.
// Writes both compositions plus timeline.json, which music.py reads so the score hits every cut.
//   index.html                              9:16 (1080x1920)
//   ../dacus-trailer-landscape/index.html   16:9 (1920x1080)
// Usage: node build.mjs
import fs from 'node:fs';

const DURATION = 15;

// Finale phone mockup: a 390x844pt screen drawn 540px wide, plus status bar and bezel (scaled down by GSAP).
const SCREEN_W = 540;
const STATUS_H = 61;
const SHOT_H = Math.round((SCREEN_W * 2532) / 1170);
const BEZEL = 14;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = STATUS_H + SHOT_H + BEZEL * 2;
const B = 60 / 128; // one beat
const at = (beats) => +(beats * B).toFixed(4);

// ---------- the cut, in beats ----------
const T = {
  line: at(1), // red roof line draws
  tot: at(2), // TOT
  pentru: at(2.5), // PENTRU
  casa: at(3), // CASĂ.
  strobe: at(3.5), // photo strobe, one per 16th
  strobeStep: at(0.25),
  storm: at(5), // product storm
  stormZoom: at(9.2), // the bulb card flies at the lens
  search: at(10), // card becomes the search bar
  typing: at(11), // letters on 16ths
  results: at(12.75),
  whip: at(13.6), // whip pan out
  depts: at(14), // department slats
  flip1: at(15),
  flip2: at(16),
  deptsOut: at(17.5),
  cart: at(18), // add to cart
  price: at(19),
  press: at(20),
  added: at(20.5),
  iris: at(21.5),
  loyalty: at(22),
  points: at(22.5),
  tiers: at(24),
  collapse: at(24.6),
  silence: at(25), // tape stop, black
  drop: at(26), // logo drop
  end: DURATION,
};

const STORE = JSON.parse(fs.readFileSync(new URL('assets/store/manifest.json', import.meta.url), 'utf8'));
const productById = Object.fromEntries(STORE.products.map((p) => [p.id, p]));
const STORM = ['cafetiera-prin', 'masina-de', 'polizor-unghiular', 'plafonier', 'baterie-lavoar', 'set-chei', 'ghiveci', 'aspirator', 'fierbator', 'tigaie', 'scaun', 'lampa', 'prelungitor', 'ciocan', 'surubelnita', 'mixer', 'boxa', 'trotineta', 'canapea', 'drujba', 'cort', 'bec-led'];
const RESULTS = ['bec-led', 'plafonier', 'lampa', 'cort'];
const STROBE = [
  ['constructii-si-renovare', 'Construcții'],
  ['electrice-si-iluminat', 'Electrice'],
  ['casa-si-gradina', 'Grădină'],
  ['baie-si-instalatii', 'Baie'],
  ['bucatarie-si-dining', 'Bucătărie'],
  ['mobilier', 'Mobilier'],
];
// Department slats: three sets, five slats each.
const SLATS = [
  ['constructii-si-renovare', 'Construcții și Renovare'],
  ['electrice-si-iluminat', 'Electrice și Iluminat'],
  ['casa-si-gradina', 'Casă și Grădină'],
  ['baie-si-instalatii', 'Baie și Instalații'],
  ['bucatarie-si-dining', 'Bucătărie și Dining'],
  ['mobilier', 'Mobilier'],
  ['scule-si-unelte', 'Scule și Unelte'],
  ['electronice-gadgeturi', 'Electronice'],
  ['curatenie-si-intretinere', 'Curățenie'],
  ['jucarii-si-copii', 'Jucării și Copii'],
  ['auto-si-moto', 'Auto și Moto'],
  ['craciun', 'Crăciun'],
  ['casa-si-gradina', 'Grădină și Exterior'],
  ['electrice-si-iluminat', 'Iluminat'],
  ['constructii-si-renovare', 'Gresie și Faianță'],
];

const price = (value) => value.toFixed(2).replace('.', ',') + ' RON';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Deterministic placement for the product tunnel.
const mulberry = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const LAYOUTS = {
  portrait: {
    file: 'index.html',
    id: 'dacus-trailer-portrait',
    W: 1080,
    H: 1920,
    portrait: true,
  },
  landscape: {
    file: '../dacus-trailer-landscape/index.html',
    id: 'dacus-trailer-landscape',
    W: 1920,
    H: 1080,
    portrait: false,
  },
};

const words = (text) =>
  text
    .split(' ')
    .map((w) => `<span class="m"><span class="w">${w}</span></span>`)
    .join(' ');

const html = (L) => {
  const { W, H, portrait: P } = L;
  const rand = mulberry(42);

  // ----- per-orientation geometry -----
  const g = P
    ? {
        bigTot: 430, bigPentru: 250, bigCasa: 330, strobeLabel: 130,
        count: 250, countSub: 100,
        ring: [430, 780], card: 300,
        head: { left: 70, top: 150, width: 940, align: 'center', size: 118 },
        bar: { x: 70, y: 560, w: 940, h: 150 },
        rows: { x: 70, y: 770, w: 940, h: 190, gap: 22 },
        cartCard: { x: 230, y: 420, s: 620 }, cartHead: { left: 70, top: 120, width: 940, align: 'center' },
        cartInfo: { left: 70, top: 1080, width: 940, align: 'center' },
        bag: { x: 935, y: 145 },
        loyCard: { x: 90, y: 600, w: 900, h: 560 }, loyHead: { left: 70, top: 170, width: 940, align: 'center' },
        tiers: { left: 90, top: 1250, width: 900 },
        logo: 660, logoY: 470,
        phones: { cx: 540, top: 880, scale: 0.62, side: 0.5, dx: 300 },
        burstC: { x: 540, y: 1300, rx: 480, ry: 600, minY: 860 },
      }
    : {
        bigTot: 520, bigPentru: 400, bigCasa: 460, strobeLabel: 150,
        count: 300, countSub: 110,
        ring: [820, 430], card: 280,
        head: { left: 130, top: 0, width: 660, align: 'left', size: 118 },
        bar: { x: 880, y: 150, w: 920, h: 130 },
        rows: { x: 880, y: 330, w: 920, h: 140, gap: 14 },
        cartCard: { x: 1100, y: 230, s: 620 }, cartHead: { left: 130, top: 170, width: 860, align: 'left' },
        cartInfo: { left: 130, top: 520, width: 860, align: 'left' },
        bag: { x: 1790, y: 120 },
        loyCard: { x: 880, y: 230, w: 920, h: 560 }, loyHead: { left: 130, top: 0, width: 680, align: 'left' },
        tiers: { left: 880, top: 850, width: 920 },
        logo: 700, logoY: 455,
        phones: { cx: 1400, top: 160, scale: 0.6, side: 0.5, dx: 290 },
        burstC: { x: 1400, y: 540, rx: 560, ry: 440, minX: 980 },
      };

  const tunnel = STORM.map((id, i) => {
    const angle = (i / STORM.length) * Math.PI * 2 * 2.3 + rand() * 0.6;
    const radius = 0.75 + rand() * 0.45;
    return {
      id,
      x: Math.round(Math.cos(angle) * g.ring[0] * radius),
      y: Math.round(Math.sin(angle) * g.ring[1] * radius),
      z: Math.round(-600 - (i / STORM.length) * 4200 - rand() * 300),
      r: Math.round((rand() - 0.5) * 40),
      spin: Math.round((rand() - 0.5) * 90),
    };
  });
  // Product cards orbit the phones; any that would land on the lockup are left out.
  const burst = STORM.map((id, i) => {
    const angle = (i / STORM.length) * Math.PI * 2 + 0.2;
    const c = g.burstC;
    return { id, x: Math.round(Math.cos(angle) * c.rx), y: Math.round(Math.sin(angle) * c.ry), r: Math.round((rand() - 0.5) * 30) };
  }).filter((b) => (P ? b.y + g.burstC.y > g.burstC.minY : b.x + g.burstC.x > g.burstC.minX));

  const slatCount = 5;
  const slatSize = (P ? H : W) / slatCount;
  const iris = P ? { x: 540, y: 1520 } : { x: 400, y: 800 };

  const css = `
      @font-face { font-family: 'Barlow'; font-weight: 500; src: url('assets/fonts/Barlow_500Medium.ttf') format('truetype'); }
      @font-face { font-family: 'Barlow'; font-weight: 600; src: url('assets/fonts/Barlow_600SemiBold.ttf') format('truetype'); }
      @font-face { font-family: 'Barlow'; font-weight: 700; src: url('assets/fonts/Barlow_700Bold.ttf') format('truetype'); }
      @font-face { font-family: 'Barlow'; font-weight: 800; src: url('assets/fonts/Barlow_800ExtraBold.ttf') format('truetype'); }
      @font-face { font-family: 'Barlow'; font-weight: 900; src: url('assets/fonts/Barlow_900Black.ttf') format('truetype'); }
      @font-face { font-family: 'Barlow'; font-weight: 900; font-style: italic; src: url('assets/fonts/Barlow_900Black_Italic.ttf') format('truetype'); }
      :root { --red: #d20a11; --ink: #141414; --paper: #f5f5f7; --muted: #8a8a8f; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #000; font-family: 'Barlow', sans-serif; color: var(--ink); }
      #cam { position: absolute; inset: 0; }
      .scene { position: absolute; inset: 0; overflow: hidden; }
      /* Stacking: each transition needs the outgoing scene on top (slats open onto the cart, the cart irises onto loyalty). */
      #s1 { z-index: 1; } #s2 { z-index: 2; } #s3 { z-index: 3; } #s6 { z-index: 4; } #s5 { z-index: 5; } #s4 { z-index: 6; } #s7 { z-index: 7; }
      .full { position: absolute; inset: 0; }
      .center { display: flex; align-items: center; justify-content: center; }
      .m { display: inline-block; overflow: hidden; vertical-align: top; padding: 0.12em 0.04em 0.16em; margin: -0.12em -0.04em -0.16em; }
      .w { display: inline-block; }
      .hidden { visibility: hidden; }

      /* S1 cold open */
      #s1 { background: #000; }
      #roofline { position: absolute; left: ${W / 2 - 300}px; top: ${H / 2 - 170}px; width: 600px; height: 340px; overflow: visible; }
      .hit { font-weight: 900; letter-spacing: -0.04em; line-height: 0.9; text-transform: uppercase; }
      #hit-tot { background: #000; color: #fff; font-size: ${g.bigTot}px; }
      #hit-pentru { background: var(--red); color: #fff; font-size: ${g.bigPentru}px; font-style: italic; }
      #hit-casa { background: #fff; color: var(--ink); font-size: ${g.bigCasa}px; }
      #hit-casa b { color: var(--red); }
      .strobe { background-size: cover; background-position: center; }
      .strobe::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%); }
      .strobe span {
        position: absolute; left: ${P ? 60 : 110}px; bottom: ${P ? 120 : 90}px; z-index: 1;
        color: #fff; font-weight: 900; font-style: italic; text-transform: uppercase;
        font-size: ${g.strobeLabel}px; letter-spacing: -0.03em; line-height: 0.9;
      }
      .strobe span::after { content: ''; display: block; width: 140px; height: 16px; margin-top: 18px; background: var(--red); }

      /* S2 product storm */
      #s2 { background: radial-gradient(ellipse at 50% 50%, #ffffff 0%, #ececf0 100%); }
      .tunnel { position: absolute; inset: 0; perspective: 1300px; }
      .space { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform-style: preserve-3d; }
      .pcard {
        position: absolute; width: ${g.card}px; height: ${g.card}px; margin: ${-g.card / 2}px 0 0 ${-g.card / 2}px;
        background: #fff; border-radius: 40px; overflow: hidden;
        box-shadow: 0 40px 80px -30px rgba(20, 20, 20, 0.35);
      }
      .pcard img { width: 100%; height: 100%; object-fit: contain; padding: 22px; display: block; }
      #count-wrap { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      #count-big { font-size: ${g.count}px; font-weight: 900; letter-spacing: -0.05em; line-height: 0.9; font-variant-numeric: tabular-nums; }
      #count-big i { font-style: normal; color: var(--red); }
      #count-sub { font-size: ${g.countSub}px; font-weight: 800; letter-spacing: -0.03em; margin-top: 10px; }
      #zoom-card { position: absolute; left: 50%; top: 50%; width: 300px; height: 300px; margin: -150px 0 0 -150px; background: #fff; border-radius: 40px; overflow: hidden; }
      #zoom-card img { width: 100%; height: 100%; object-fit: contain; padding: 22px; }

      /* S3 search */
      #s3 { background: var(--ink); }
      #s3-content { position: absolute; inset: 0; }
      #bar-bg { position: absolute; inset: 0; background: #fff; }
      #bar {
        position: absolute; left: ${g.bar.x}px; top: ${g.bar.y}px; width: ${g.bar.w}px; height: ${g.bar.h}px;
        display: flex; align-items: center; gap: 30px; padding: 0 50px;
        font-size: ${Math.round(g.bar.h * 0.46)}px; font-weight: 600; color: var(--ink);
      }
      .glass { position: relative; width: ${Math.round(g.bar.h * 0.38)}px; height: ${Math.round(g.bar.h * 0.38)}px; border: 7px solid var(--ink); border-radius: 50%; flex: none; }
      .glass::after { content: ''; position: absolute; width: 7px; height: 26px; background: var(--ink); right: -12px; bottom: -22px; transform: rotate(-45deg); border-radius: 4px; }
      #caret { width: 5px; height: ${Math.round(g.bar.h * 0.5)}px; background: var(--red); margin-left: -22px; }
      .row {
        position: absolute; left: ${g.rows.x}px; width: ${g.rows.w}px; height: ${g.rows.h}px;
        background: #fff; border-radius: 34px; display: flex; align-items: center; gap: 30px; padding: 0 26px;
        transform-origin: 50% 0%;
      }
      .row img { width: ${g.rows.h - 40}px; height: ${g.rows.h - 40}px; object-fit: contain; background: #f3f3f3; border-radius: 22px; padding: 10px; flex: none; }
      .row div { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .row b { font-size: ${P ? 36 : 32}px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row i { font-style: normal; font-size: ${P ? 46 : 38}px; font-weight: 800; }
      .row mark { background: none; color: var(--red); }
      .head { position: absolute; display: flex; flex-direction: column; gap: 18px; justify-content: center; }
      .head h2 { font-weight: 900; letter-spacing: -0.04em; line-height: 0.95; }
      .head p { font-weight: 600; font-size: 46px; letter-spacing: -0.01em; }
      #s3-head { left: ${g.head.left}px; width: ${g.head.width}px; ${P ? `top: ${g.head.top}px; height: 360px;` : 'top: 0; height: 1080px;'} text-align: ${g.head.align}; color: #fff; }
      #s3-head h2 { font-size: ${g.head.size}px; }
      #s3-head p { color: #9a9aa0; }

      /* S4 department slats */
      #s4 { background: transparent; }
      #slats { position: absolute; inset: 0; }
      .slat { position: absolute; overflow: hidden; background: #000; ${P ? `left: 0; width: ${W}px; height: ${slatSize + 1}px;` : `top: 0; height: ${H}px; width: ${slatSize + 1}px;`} }
      .ph { position: absolute; inset: 0; background-size: cover; background-position: center; }
      .ph::after { content: ''; position: absolute; inset: 0; background: linear-gradient(${P ? '90deg' : '180deg'}, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.6) 100%); }
      .ph span {
        position: absolute; z-index: 1; color: #fff; font-weight: 800; font-size: ${P ? 46 : 40}px; letter-spacing: -0.01em; text-shadow: 0 2px 18px rgba(0,0,0,0.65);
        ${P ? 'right: 50px; bottom: 34px; text-align: right;' : 'left: 34px; bottom: 60px; right: 20px;'}
      }
      #dept-card {
        position: absolute; left: 50%; top: 50%; transform-origin: 50% 50%;
        background: #fff; border-radius: 36px; padding: 44px 64px; text-align: center;
        box-shadow: 0 50px 100px -30px rgba(0,0,0,0.6);
      }
      #dept-card h2 { font-size: ${P ? 88 : 110}px; font-weight: 900; letter-spacing: -0.04em; line-height: 0.95; white-space: nowrap; }
      #dept-card h2 b { color: var(--red); }

      /* S5 cart */
      #s5 { background: transparent; }
      #s5-in { position: absolute; inset: 0; background: var(--red); color: #fff; }
      #cart-card { position: absolute; left: ${g.cartCard.x}px; top: ${g.cartCard.y}px; width: ${g.cartCard.s}px; height: ${g.cartCard.s}px; background: #fff; border-radius: 60px; overflow: hidden; box-shadow: 0 60px 120px -40px rgba(60, 0, 0, 0.7); }
      #cart-card img { width: 100%; height: 100%; object-fit: contain; padding: 50px; }
      #cart-head { position: absolute; left: ${g.cartHead.left}px; top: ${g.cartHead.top}px; width: ${g.cartHead.width}px; text-align: ${g.cartHead.align}; }
      #cart-head h2 { font-size: ${P ? 120 : 130}px; font-weight: 900; letter-spacing: -0.04em; line-height: 0.95; }
      #cart-info { position: absolute; left: ${g.cartInfo.left}px; top: ${g.cartInfo.top}px; width: ${g.cartInfo.width}px; text-align: ${g.cartInfo.align}; display: flex; flex-direction: column; align-items: ${P ? 'center' : 'flex-start'}; gap: 14px; }
      #cart-name { font-size: 40px; font-weight: 600; opacity: 0.85; }
      #cart-price { font-size: ${P ? 150 : 140}px; font-weight: 900; letter-spacing: -0.04em; line-height: 0.95; }
      #cart-btn { margin-top: 26px; position: relative; display: flex; align-items: center; justify-content: center; gap: 20px; width: ${P ? 700 : 620}px; height: 140px; border-radius: 70px; background: var(--ink); color: #fff; font-size: 50px; font-weight: 800; }
      #ripple { position: absolute; left: 50%; top: 50%; width: 200px; height: 200px; margin: -100px 0 0 -100px; border-radius: 50%; border: 8px solid #fff; opacity: 0; }
      #bag { position: absolute; left: ${g.bag.x - 75}px; top: ${g.bag.y - 75}px; width: 150px; height: 150px; border-radius: 50%; background: #fff; }
      #bag i { position: absolute; left: 44px; top: 56px; width: 62px; height: 54px; border: 8px solid var(--ink); border-radius: 6px 6px 14px 14px; }
      #bag i::before { content: ''; position: absolute; left: 10px; top: -30px; width: 26px; height: 26px; border: 8px solid var(--ink); border-bottom: none; border-radius: 20px 20px 0 0; }
      #bag b { position: absolute; right: -6px; top: -6px; width: 56px; height: 56px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 34px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
      #toast { position: absolute; left: ${g.cartCard.x + g.cartCard.s / 2}px; top: ${g.cartCard.y + g.cartCard.s / 2 - 55}px; display: flex; align-items: center; gap: 22px; padding: 26px 44px 26px 30px; border-radius: 60px; background: var(--ink); color: #fff; font-size: 44px; font-weight: 700; white-space: nowrap; box-shadow: 0 30px 60px -20px rgba(0,0,0,0.5); }
      #toast .tick { width: 54px; height: 54px; border-radius: 50%; background: #fff; position: relative; }
      #toast .tick::after { content: ''; position: absolute; left: 18px; top: 10px; width: 14px; height: 26px; border: solid var(--ink); border-width: 0 7px 7px 0; transform: rotate(45deg); }

      /* S6 loyalty */
      #s6 { background: #0b0b0c; color: #fff; }
      #s6-in { position: absolute; inset: 0; }
      #loy-head { left: ${g.loyHead.left}px; width: ${g.loyHead.width}px; ${P ? `top: ${g.loyHead.top}px; height: 380px;` : 'top: 0; height: 1080px;'} text-align: ${g.loyHead.align}; }
      #loy-head h2 { font-size: 112px; }
      #loy-head p { color: #9a9aa0; }
      .stage { position: absolute; inset: 0; perspective: 1800px; }
      #loy-card {
        position: absolute; left: ${g.loyCard.x}px; top: ${g.loyCard.y}px; width: ${g.loyCard.w}px; height: ${g.loyCard.h}px;
        border-radius: 56px; overflow: hidden; padding: 60px 64px;
        background: linear-gradient(135deg, #2a2a2d 0%, #141415 60%);
        box-shadow: 0 0 0 2px rgba(255,255,255,0.08), 0 80px 140px -40px rgba(210, 10, 17, 0.45);
        display: flex; flex-direction: column; justify-content: space-between;
      }
      #loy-card .roof { position: absolute; right: -60px; top: -40px; width: 360px; height: 220px; }
      #loy-card small { font-size: 30px; font-weight: 700; letter-spacing: 0.08em; color: #b9b9be; }
      #loy-points { font-size: 230px; font-weight: 900; letter-spacing: -0.05em; line-height: 0.85; font-variant-numeric: tabular-nums; }
      #loy-points em { font-style: normal; font-size: 64px; font-weight: 800; letter-spacing: -0.01em; color: var(--red); margin-left: 16px; }
      #loy-card .foot { display: flex; justify-content: space-between; font-size: 34px; font-weight: 600; color: #d6d6da; }
      #tiers { position: absolute; left: ${g.tiers.left}px; top: ${g.tiers.top}px; width: ${g.tiers.width}px; display: flex; gap: 20px; }
      .tier { flex: 1; height: 120px; border-radius: 60px; display: flex; align-items: center; justify-content: center; font-size: 42px; font-weight: 800; background: #1d1d1f; color: #8a8a8f; }

      /* S7 logo */
      #s7 { background: #000; }
      #s7-bg { position: absolute; inset: 0; background: #fff; }
      #burst { position: absolute; left: ${g.burstC.x}px; top: ${g.burstC.y}px; width: 0; height: 0; }
      .bcard { position: absolute; width: 170px; height: 170px; margin: -85px 0 0 -85px; background: #fff; border-radius: 30px; overflow: hidden; box-shadow: 0 24px 50px -20px rgba(20,20,20,0.35); }
      .bcard img { width: 100%; height: 100%; object-fit: contain; padding: 14px; }
      #lockup { position: absolute; ${P ? 'left: 0; right: 0;' : 'left: 130px; width: 820px;'} top: ${g.logoY - (P ? 120 : 140)}px; display: flex; flex-direction: column; align-items: ${P ? 'center' : 'flex-start'}; gap: 30px; text-align: ${P ? 'center' : 'left'}; }
      #lockup img { width: ${g.logo}px; height: auto; }
      #lockup h3 { font-size: ${P ? 110 : 120}px; font-weight: 900; letter-spacing: -0.04em; line-height: 0.95; }
      #lockup p { font-size: 48px; font-weight: 700; color: var(--red); letter-spacing: 0.02em; }
      #flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
      #shock { position: absolute; left: ${P ? 540 : 130 + g.logo / 2}px; top: ${g.logoY}px; width: 400px; height: 400px; margin: -200px 0 0 -200px; border-radius: 50%; border: 18px solid var(--red); opacity: 0; }
      /* Finale phones: the real app */
      #phones { position: absolute; inset: 0; perspective: 2200px; }
      .phone { position: absolute; width: ${PHONE_W}px; height: ${PHONE_H}px; transform-origin: 50% 0%; }
      .phone .frame {
        width: 100%; height: 100%; border-radius: 88px; padding: ${BEZEL}px; background: #0c0c0d;
        box-shadow: 0 0 0 2px #b9b9be, 0 0 0 5px #8e8e93, 0 0 0 6px #d8d8dc, 0 80px 140px -40px rgba(20, 20, 20, 0.45);
      }
      .phone .display { position: relative; width: ${SCREEN_W}px; height: ${STATUS_H + SHOT_H}px; border-radius: 74px; overflow: hidden; background: #fff; padding-top: ${STATUS_H}px; }
      .phone .display img { display: block; width: ${SCREEN_W}px; height: ${SHOT_H}px; }
      .phone .island { position: absolute; left: 50%; top: 13px; width: 132px; height: 38px; margin-left: -66px; background: #000; border-radius: 20px; }
      .phone .clock { position: absolute; left: 56px; top: 14px; font-size: 25px; font-weight: 600; color: #000; }
      #phone-l, #phone-r { left: ${g.phones.cx - PHONE_W / 2}px; top: ${g.phones.top + 70}px; }
      #phone-c { left: ${g.phones.cx - PHONE_W / 2}px; top: ${g.phones.top}px; }
  `;

  const phoneEl = (id, screen) =>
    `<div class="phone" id="${id}"><div class="frame"><div class="display"><img src="assets/screens/${screen}.png" alt="" /><i class="island"></i><span class="clock">9:41</span></div></div></div>`;

  const roofSvg = (id, stroke = 18) =>
    `<svg ${id ? `id="${id}"` : ''} viewBox="0 0 600 340" class="${id ? '' : 'roof'}" fill="none"><path ${id ? 'id="roofpath"' : ''} d="M20 320 L300 40 L580 320" stroke="#d20a11" stroke-width="${stroke}" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;

  const body = `
      <div id="cam">
        <!-- S1 cold open -->
        <div class="scene clip" id="s1" data-start="0" data-duration="${(T.storm + 0.1).toFixed(3)}" data-track-index="1">
          ${roofSvg('roofline')}
          <div class="full center hit hidden" id="hit-tot">Tot</div>
          <div class="full center hit hidden" id="hit-pentru">pentru</div>
          <div class="full center hit hidden" id="hit-casa">Casă<b>.</b></div>
${STROBE.map(([photo, label], i) => `          <div class="full strobe hidden" id="strobe-${i}" style="background-image:url('assets/store/photos/${photo}.jpg')"><span>${label}</span></div>`).join('\n')}
        </div>

        <!-- S2 product storm -->
        <div class="scene clip" id="s2" data-start="${(T.storm - 0.05).toFixed(3)}" data-duration="${(T.search - T.storm + 0.3).toFixed(3)}" data-track-index="2">
          <div class="tunnel"><div class="space" id="space">
${tunnel.map((c, i) => `            <div class="pcard" id="t-${i}"><img src="assets/store/products/${c.id}.jpg" alt="" /></div>`).join('\n')}
          </div></div>
          <div id="count-wrap">
            <div id="count-big"><span class="m"><span class="w"><span id="count">17.000</span><i>+</i></span></span></div>
            <div id="count-sub">${words('produse. Un singur loc.')}</div>
          </div>
          <div id="zoom-card"><img src="assets/store/products/bec-led.jpg" alt="" /></div>
        </div>

        <!-- S3 search -->
        <div class="scene clip" id="s3" data-start="${T.search.toFixed(3)}" data-duration="${(T.depts - T.search + 0.25).toFixed(3)}" data-track-index="3">
          <div id="s3-content">
            <div class="head" id="s3-head"><h2>${words('Găsești orice.')}</h2><p id="s3-sub">Din prima căutare.</p></div>
${RESULTS.map((id, i) => {
  const p = productById[id];
  const top = g.rows.y + i * (g.rows.h + g.rows.gap);
  const name = esc(p.name).replace(/(led)/i, '<mark>$1</mark>');
  return `            <div class="row" id="row-${i}" style="top:${top}px"><img src="assets/store/products/${id}.jpg" alt="" /><div><b>${name}</b><i>${price(p.price)}</i></div></div>`;
}).join('\n')}
            <div id="bar-bg"></div>
            <div id="bar"><span class="glass"></span><span id="typed">led</span><span id="caret"></span></div>
          </div>
        </div>

        <!-- S4 departments -->
        <div class="scene clip" id="s4" data-start="${(T.depts - 0.2).toFixed(3)}" data-duration="${(T.cart - T.depts + 0.45).toFixed(3)}" data-track-index="4">
          <div id="slats">
${Array.from({ length: slatCount }, (_, i) => {
  const pos = Math.round(i * slatSize);
  const layers = [0, 1, 2]
    .map((set) => {
      const [photo, label] = SLATS[set * slatCount + i];
      const focus = P ? `${30 + i * 10}% 50%` : `50% ${40 + (i % 3) * 10}%`;
      return `<div class="ph${set ? ' hidden' : ''}" id="ph-${i}-${set}" style="background-image:url('assets/store/photos/${photo}.jpg');background-position:${focus}"><span>${label}</span></div>`;
    })
    .join('');
  return `            <div class="slat" id="slat-${i}" style="${P ? `top:${pos}px` : `left:${pos}px`}">${layers}</div>`;
}).join('\n')}
          </div>
          <div id="dept-card"><h2>${words('Totul, pe')}<br />${words('departamente<b>.</b>')}</h2></div>
        </div>

        <!-- S5 add to cart (under S4: the slats open onto it) -->
        <div class="scene clip" id="s5" data-start="${(T.deptsOut - 0.05).toFixed(3)}" data-duration="${(T.loyalty - T.deptsOut + 0.3).toFixed(3)}" data-track-index="5">
          <div id="s5-in">
            <div id="cart-head"><h2>${words('Un gest.')}<br />${words('În coș.')}</h2></div>
            <div class="stage"><div id="cart-card"><img src="assets/store/products/cafetiera-prin.jpg" alt="" /></div></div>
            <div id="cart-info">
              <div id="cart-name">Cafetieră Teesa AROMA 100</div>
              <div id="cart-price"><span class="w">${price(productById['cafetiera-prin'].price)}</span></div>
              <div id="cart-btn"><span id="ripple"></span>Adaugă în coș</div>
            </div>
            <div id="bag"><i></i><b id="bag-count">1</b></div>
            <div id="toast"><span class="tick"></span>Adăugat în coș</div>
          </div>
        </div>

        <!-- S6 loyalty -->
        <div class="scene clip" id="s6" data-start="${(T.iris - 0.05).toFixed(3)}" data-duration="${(T.silence - T.iris + 0.15).toFixed(3)}" data-track-index="6">
          <div id="s6-in">
            <div class="head" id="loy-head"><h2>${words('Puncte la fiecare comandă.')}</h2><p id="loy-sub">100 de puncte = 5 RON.</p></div>
            <div class="stage">
              <div id="loy-card">
                ${roofSvg(null, 26)}
                <small>PROGRAM DE FIDELITATE</small>
                <div id="loy-points"><span id="points">0</span><em>puncte</em></div>
                <div class="foot"><span>1 RON = 1 punct</span><span>DACUS</span></div>
              </div>
            </div>
            <div id="tiers"><div class="tier" id="tier-0">Bronze</div><div class="tier" id="tier-1">Silver</div><div class="tier" id="tier-2">Gold</div></div>
          </div>
        </div>

        <!-- S7 logo -->
        <div class="scene clip" id="s7" data-start="${(T.silence - 0.05).toFixed(3)}" data-duration="${(DURATION - T.silence + 0.05).toFixed(3)}" data-track-index="7">
          <div id="s7-bg"></div>
          <div id="burst">
${burst.map((c, i) => `            <div class="bcard" id="b-${i}"><img src="assets/store/products/${c.id}.jpg" alt="" /></div>`).join('\n')}
          </div>
          <div id="phones">
            ${phoneEl('phone-l', 'departments')}
            ${phoneEl('phone-r', 'product-added')}
            ${phoneEl('phone-c', 'home')}
          </div>
          <div id="shock"></div>
          <div id="lockup">
            <img id="logo" src="assets/dacus-logo.png" alt="Dacus" />
            <h3 id="lockup-title">${words('Aplicația Dacus.')}</h3>
            <p id="lockup-url">Tot pentru casă · dacus.ro</p>
          </div>
          <div id="flash"></div>
        </div>
      </div>
      <audio id="bgm" class="clip" src="assets/audio/bgm.wav" data-start="0" data-duration="${DURATION}" data-track-index="9"></audio>`;

  const script = `
      const T = ${JSON.stringify(T)};
      const G = ${JSON.stringify({ W, H, P, tunnel, burst, slatCount, iris, bar: g.bar, cartCard: g.cartCard, bag: g.bag, logoY: g.logoY, phones: g.phones })};
      const tl = gsap.timeline({ paused: true });
      const show = (t, at) => tl.set(t, { autoAlpha: 1 }, at);
      const hide = (t, at) => tl.set(t, { autoAlpha: 0 }, at);
      const wordsIn = (scope, at, stagger = 0.06) =>
        tl.fromTo(scope + ' .w', { yPercent: 125 }, { yPercent: 0, duration: 0.7, ease: 'expo.out', stagger }, at);

      // ================= S1 cold open =================
      const roof = document.getElementById('roofpath');
      const roofLen = roof.getTotalLength();
      gsap.set(roof, { strokeDasharray: roofLen, strokeDashoffset: roofLen });
      tl.to(roof, { strokeDashoffset: 0, duration: T.tot - T.line - 0.05, ease: 'expo.out' }, T.line);
      tl.fromTo('#roofline', { scale: 1 }, { scale: 1.12, duration: T.tot - T.line, ease: 'none' }, T.line);
      hide('#roofline', T.tot);
      // Word hits, one per 8th, each a hard cut with a punch-in.
      [['#hit-tot', T.tot], ['#hit-pentru', T.pentru], ['#hit-casa', T.casa]].forEach(([el, t], i, all) => {
        show(el, t);
        tl.fromTo(el, { scale: 1.35, filter: 'blur(12px)' }, { scale: 1, filter: 'blur(0px)', duration: 0.22, ease: 'expo.out' }, t);
        if (i < all.length - 1) hide(el, all[i + 1][1]);
      });
      hide('#hit-casa', T.strobe);
      // Photo strobe on 16ths, labels slamming, a slow push through all of it.
      ${JSON.stringify(STROBE.map((_, i) => i))}.forEach((i) => {
        const t = T.strobe + i * T.strobeStep;
        const el = '#strobe-' + i;
        show(el, t);
        tl.fromTo(el, { scale: 1.18 - i * 0.02 }, { scale: 1.08 - i * 0.02, duration: T.strobeStep, ease: 'none' }, t);
        tl.fromTo(el + ' span', { xPercent: -12, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.09, ease: 'power2.out' }, t);
        if (i < 5) hide(el, t + T.strobeStep);
      });
      // Zoom-through the last photo into white.
      tl.to('#strobe-5', { scale: 3.2, filter: 'blur(26px)', duration: T.storm - (T.strobe + 5 * T.strobeStep), ease: 'expo.in' }, T.strobe + 5 * T.strobeStep);

      // ================= S2 product storm =================
      G.tunnel.forEach((c, i) => gsap.set('#t-' + i, { x: c.x, y: c.y, z: c.z, rotation: c.r }));
      tl.fromTo('#space', { z: -400 }, { z: 4300, duration: T.stormZoom - T.storm + 0.3, ease: 'power1.in' }, T.storm);
      G.tunnel.forEach((c, i) => tl.fromTo('#t-' + i, { rotationY: 0 }, { rotationY: c.spin, duration: T.search - T.storm, ease: 'none' }, T.storm));
      tl.fromTo('#s2', { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none' }, T.storm - 0.05);
      wordsIn('#count-big', T.storm + 0.05);
      const counter = { v: 0 };
      tl.fromTo(counter, { v: 0 }, {
        v: 17000, duration: 1.1, ease: 'expo.out',
        onUpdate: () => { document.getElementById('count').textContent = String(Math.round(counter.v / 100) * 100).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.'); },
      }, T.storm + 0.1);
      wordsIn('#count-sub', T.storm + 0.45, 0.07);
      tl.to('#count-wrap', { scale: 0.85, opacity: 0, filter: 'blur(10px)', duration: 0.3, ease: 'power2.in' }, T.stormZoom - 0.1);
      // The bulb card flies at the lens and fills the frame white.
      tl.fromTo('#zoom-card', { scale: 0.05, rotation: -25, opacity: 0 }, { scale: 9, rotation: 0, opacity: 1, duration: T.search - T.stormZoom, ease: 'expo.in' }, T.stormZoom);

      // ================= S3 search =================
      const b = G.bar;
      tl.fromTo('#bar-bg',
        { clipPath: 'inset(0px 0px 0px 0px round 0px)' },
        { clipPath: 'inset(' + b.y + 'px ' + (G.W - b.x - b.w) + 'px ' + (G.H - b.y - b.h) + 'px ' + b.x + 'px round ' + b.h / 2 + 'px)', duration: 0.55, ease: 'expo.inOut' },
        T.search);
      tl.fromTo('#bar', { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }, T.search + 0.45);
      // Typing on 16ths.
      const typed = { n: 0 };
      tl.fromTo(typed, { n: 0 }, {
        n: 3, duration: T.strobeStep * 3, ease: 'steps(3)',
        onUpdate: () => { document.getElementById('typed').textContent = 'led'.slice(0, Math.round(typed.n)); },
      }, T.typing);
      tl.fromTo('#caret', { opacity: 1 }, { opacity: 0, duration: 0.23, ease: 'steps(1)', repeat: 7, yoyo: true }, T.search + 0.5);
      wordsIn('#s3-head h2', T.search + 0.5);
      tl.fromTo('#s3-sub', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, T.search + 0.8);
      // Results cascade out of the bar, tilting up into place.
      [0, 1, 2, 3].forEach((i) => {
        tl.fromTo('#row-' + i,
          { y: -(140 + i * 60), rotationX: -70, opacity: 0, transformPerspective: 1200 },
          { y: 0, rotationX: 0, opacity: 1, duration: 0.6, ease: 'expo.out' },
          T.results + i * 0.06);
      });
      // Whip pan out.
      tl.to('#s3-content', { x: -G.W * 1.1, skewX: 18, filter: 'blur(28px)', duration: T.depts - T.whip + 0.08, ease: 'power3.in' }, T.whip);

      // ================= S4 departments =================
      const axis = G.P ? 'scaleY' : 'scaleX';
      tl.fromTo('#slats', { x: G.W * 0.9, skewX: -16, filter: 'blur(26px)' }, { x: 0, skewX: 0, filter: 'blur(0px)', duration: 0.45, ease: 'expo.out' }, T.depts - 0.08);
      for (let i = 0; i < G.slatCount; i++) {
        tl.fromTo('#slat-' + i, { [G.P ? 'x' : 'y']: (i % 2 ? 1 : -1) * 260 }, { [G.P ? 'x' : 'y']: 0, duration: 0.6, ease: 'expo.out' }, T.depts - 0.05 + i * 0.03);
        // Slow drift inside each slat.
        tl.fromTo('#slat-' + i + ' .ph', { scale: 1.12 }, { scale: 1.0, duration: T.deptsOut - T.depts + 0.4, ease: 'none' }, T.depts);
        // Two cascading flips to new departments.
        [T.flip1, T.flip2].forEach((ft, set) => {
          const t0 = ft - 0.12 + i * 0.04;
          tl.to('#slat-' + i, { [axis]: 0, duration: 0.12, ease: 'power2.in' }, t0);
          hide('#ph-' + i + '-' + set, t0 + 0.12);
          show('#ph-' + i + '-' + (set + 1), t0 + 0.12);
          tl.to('#slat-' + i, { [axis]: 1, duration: 0.2, ease: 'power2.out' }, t0 + 0.12);
        });
        // Out: the slats snap shut from the middle outward, opening onto red.
        const order = Math.abs(i - (G.slatCount - 1) / 2);
        tl.to('#slat-' + i, { [axis]: 0, duration: 0.22, ease: 'expo.in' }, T.deptsOut + order * 0.05);
      }
      gsap.set('#dept-card', { xPercent: -50, yPercent: -50 });
      tl.fromTo('#dept-card', { scale: 0.4, rotation: -8, opacity: 0 }, { scale: 1, rotation: -3, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, T.depts + 0.3);
      wordsIn('#dept-card h2', T.depts + 0.36, 0.05);
      tl.to('#dept-card', { rotation: 3, duration: 0.3, ease: 'back.out(3)' }, T.flip1 + 0.35);
      tl.to('#dept-card', { rotation: -2, duration: 0.28, ease: 'back.out(3)' }, T.flip2 + 0.35);
      tl.to('#dept-card', { scale: 0, rotation: 12, duration: 0.25, ease: 'back.in(2)' }, T.deptsOut - 0.05);

      // ================= S5 add to cart =================
      tl.fromTo('#cart-card', { y: G.H * 0.5, rotationX: 60, rotationZ: -12, scale: 0.6 }, { y: 0, rotationX: 0, rotationZ: 0, scale: 1, duration: 0.8, ease: 'expo.out' }, T.cart);
      tl.fromTo('#cart-card', { rotationY: -10 }, { rotationY: 10, duration: 1.4, ease: 'sine.inOut', immediateRender: false }, T.cart + 0.4);
      wordsIn('#cart-head h2', T.cart + 0.1, 0.07);
      tl.fromTo('#cart-name', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' }, T.cart + 0.3);
      tl.fromTo('#cart-price .w', { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'expo.out' }, T.price);
      tl.fromTo('#cart-info', { x: 0 }, { keyframes: { x: [0, -14, 12, -8, 5, 0] }, duration: 0.3, ease: 'none' }, T.price + 0.02);
      tl.fromTo('#cart-btn', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2.2)' }, T.price + 0.1);
      tl.to('#cart-btn', { scale: 0.9, duration: 0.08, ease: 'power2.in' }, T.press - 0.08);
      tl.to('#cart-btn', { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' }, T.press);
      tl.fromTo('#ripple', { scale: 0.2, opacity: 1 }, { scale: 3.4, opacity: 0, duration: 0.6, ease: 'expo.out' }, T.press);
      // The product dives into the bag.
      const card = G.cartCard;
      const toBagX = G.bag.x - (card.x + card.s / 2);
      const toBagY = G.bag.y - (card.y + card.s / 2);
      tl.to('#cart-card', { x: toBagX, y: toBagY, scale: 0.08, rotationZ: 30, duration: 0.45, ease: 'power3.in' }, T.press + 0.06);
      tl.fromTo('#bag', { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2.5)' }, T.press - 0.2);
      tl.to('#bag', { scale: 1.25, duration: 0.1, ease: 'power2.out', yoyo: true, repeat: 1 }, T.added);
      tl.fromTo('#bag-count', { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' }, T.added);
      gsap.set('#toast', { xPercent: -50 });
      tl.fromTo('#toast', { scale: 0.3, opacity: 0, y: 60 }, { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, T.added + 0.05);
      // Iris out onto the loyalty scene, closing on the button.
      tl.fromTo('#s5-in',
        { clipPath: 'circle(150% at ' + G.iris.x + 'px ' + G.iris.y + 'px)' },
        { clipPath: 'circle(0% at ' + G.iris.x + 'px ' + G.iris.y + 'px)', duration: T.loyalty - T.iris, ease: 'power3.in' },
        T.iris);

      // ================= S6 loyalty =================
      tl.fromTo('#loy-card', { rotationY: -95, rotationX: 15, scale: 0.7, opacity: 0 }, { rotationY: 0, rotationX: 0, scale: 1, opacity: 1, duration: 0.9, ease: 'expo.out' }, T.loyalty);
      tl.to('#loy-card', { rotationY: -6, duration: 1.2, ease: 'sine.inOut' }, T.loyalty + 0.9);
      wordsIn('#loy-head h2', T.loyalty + 0.05, 0.05);
      tl.fromTo('#loy-sub', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, T.loyalty + 0.4);
      const pts = { v: 0 };
      tl.fromTo(pts, { v: 0 }, {
        v: 109, duration: 0.9, ease: 'expo.out',
        onUpdate: () => { document.getElementById('points').textContent = String(Math.round(pts.v)); },
      }, T.points);
      ['#tier-0', '#tier-1', '#tier-2'].forEach((el, i) => {
        const t = T.tiers + i * T.strobeStep;
        tl.fromTo(el, { backgroundColor: '#1d1d1f', color: '#8a8a8f', scale: 1 }, { backgroundColor: '#d20a11', color: '#ffffff', scale: 1.08, duration: 0.08, ease: 'power2.out' }, t);
        if (i < 2) tl.to(el, { backgroundColor: '#1d1d1f', color: '#8a8a8f', scale: 1, duration: 0.1 }, t + T.strobeStep);
      });
      tl.fromTo('#tiers', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' }, T.loyalty + 0.5);
      // Everything collapses to a point: the beat drops out.
      tl.to('#s6-in', { scale: 0, rotation: 8, filter: 'blur(14px)', duration: T.silence - T.collapse, ease: 'expo.in' }, T.collapse);

      // ================= S7 drop + logo =================
      gsap.set('#s7-bg', { autoAlpha: 0 });
      show('#s7-bg', T.drop);
      tl.fromTo('#flash', { opacity: 1 }, { opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, T.drop);
      tl.fromTo('#logo', { scale: 3.2, filter: 'blur(20px)', opacity: 0 }, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 0.5, ease: 'expo.out' }, T.drop);
      tl.fromTo('#cam', { x: 0, y: 0 }, { keyframes: { x: [0, 18, -14, 10, -6, 3, 0], y: [0, -12, 10, -7, 4, -2, 0] }, duration: 0.45, ease: 'none' }, T.drop);
      tl.fromTo('#shock', { scale: 0.2, opacity: 0.9 }, { scale: 4.5, opacity: 0, duration: 0.8, ease: 'expo.out' }, T.drop);
      G.burst.forEach((c, i) => {
        tl.fromTo('#b-' + i, { x: 0, y: 0, scale: 0.2, rotation: 0, opacity: 0 },
          { x: c.x, y: c.y, scale: 1, rotation: c.r, opacity: 1, duration: 0.9, ease: 'expo.out' }, T.drop + 0.02 + (i % 3) * 0.02);
        tl.to('#b-' + i, { x: c.x * 1.12, y: c.y * 1.12, rotation: c.r * 1.6, duration: T.end - T.drop - 0.9, ease: 'sine.out' }, T.drop + 0.92);
      });
      // The real app rises out of the drop: three phones fanning out.
      const ph = G.phones;
      gsap.set('#phones', { autoAlpha: 0 });
      show('#phones', T.drop);
      tl.fromTo('#phone-c', { y: G.H * 0.75, rotationX: 45, scale: ph.scale * 0.85 }, { y: 0, rotationX: 0, scale: ph.scale, duration: 1.1, ease: 'expo.out' }, T.drop + 0.05);
      [['#phone-l', -1], ['#phone-r', 1]].forEach(([el, side]) => {
        tl.fromTo(el,
          { x: 0, y: G.H * 0.75, rotationX: 45, rotationY: 0, rotationZ: 0, scale: ph.side * 0.85 },
          { x: side * ph.dx, y: 0, rotationX: 0, rotationY: -side * 16, rotationZ: side * 8, scale: ph.side, duration: 1.2, ease: 'expo.out' },
          T.drop + 0.16);
      });
      tl.fromTo('#phones', { y: 0 }, { y: -18, duration: T.end - T.drop - 1.1, ease: 'sine.inOut' }, T.drop + 1.1);
      wordsIn('#lockup-title', T.drop + 0.35, 0.08);
      tl.fromTo('#lockup-url', { opacity: 0, y: 20, scale: 1.15 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'expo.out' }, T.drop + 0.6);
      tl.fromTo('#lockup', { scale: 1 }, { scale: 1.04, duration: T.end - T.drop, ease: 'sine.inOut' }, T.drop);

      tl.set({}, {}, ${DURATION});
      window.__timelines = window.__timelines || {};
      window.__timelines['${L.id}'] = tl;
      tl.seek(0);`;

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>${css}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${L.id}" data-start="0" data-duration="${DURATION}" data-width="${W}" data-height="${H}">${body}
    </div>
    <script>${script}
    </script>
  </body>
</html>
`;
};

// The landscape project shares this project's assets (copied, not committed twice).
fs.cpSync(new URL('assets', import.meta.url), new URL('../dacus-trailer-landscape/assets', import.meta.url), { recursive: true });

for (const layout of Object.values(LAYOUTS)) {
  fs.writeFileSync(new URL(layout.file, import.meta.url), html(layout), 'utf8');
  console.log('wrote', layout.file);
}
fs.writeFileSync(new URL('timeline.json', import.meta.url), JSON.stringify({ bpm: 128, beat: B, ...T }, null, 2));
console.log('wrote timeline.json');
