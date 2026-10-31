// Render PNG icons + social card from the SVG sources. Run: node tools/render_icons.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const svg = f => fs.readFileSync(path.join(root, f), 'utf8');
const fontUrl = 'file://' + path.join(root, 'fonts');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext();
  const page = await ctx.newPage();
  async function png(file, w, h, html, transparent) {
    await page.setViewportSize({ width: w, height: h });
    const tmp = path.join(require('os').tmpdir(), 'lexiko-render-' + path.basename(file) + '.html');
    fs.writeFileSync(tmp, html);
    await page.goto('file://' + tmp, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, file), omitBackground: !!transparent });
    console.log('wrote', file, w + 'x' + h);
  }
  const wrap = (inner, bg) => `<!doctype html><meta charset=utf-8><style>html,body{margin:0;padding:0;background:${bg||'transparent'}}svg{display:block}</style>${inner}`;
  const sized = (s, n) => s.replace(/width="512" height="512"/, `width="${n}" height="${n}"`);
  for (const n of [16, 32]) await png(`icons/favicon-${n}.png`, n, n, wrap(sized(svg('icons/icon-any.svg'), n)), true);
  await png('icons/icon-192.png', 192, 192, wrap(sized(svg('icons/icon-any.svg'), 192)), true);
  await png('icons/icon-512.png', 512, 512, wrap(sized(svg('icons/icon-any.svg'), 512)), true);
  await png('icons/icon-maskable-512.png', 512, 512, wrap(sized(svg('icons/icon-maskable.svg'), 512)));
  await png('icons/apple-touch-icon.png', 180, 180, wrap(sized(svg('icons/icon-full.svg'), 180)));
  const og = `<!doctype html><meta charset=utf-8><style>
  @font-face{font-family:LS;src:url(${fontUrl}/lexiko-serif-bold.woff2);font-weight:700}
  @font-face{font-family:LS;src:url(${fontUrl}/lexiko-serif-regular.woff2);font-weight:400}
  @font-face{font-family:LS;src:url(${fontUrl}/lexiko-serif-italic.woff2);font-weight:400;font-style:italic}
  html,body{margin:0}body{width:1200px;height:630px;position:relative;overflow:hidden;font-family:LS,serif;color:#f7f1e3;
   background:radial-gradient(900px 600px at 85% 110%,#2f7a9c55,transparent 70%),linear-gradient(135deg,#0f2f42,#17445f 60%,#1d5573)}
  .ico{position:absolute;left:84px;top:96px}.ico svg{width:200px;height:200px;filter:drop-shadow(0 12px 28px #0006)}
  h1{position:absolute;left:84px;top:300px;margin:0;font-size:150px;line-height:1;font-weight:700;letter-spacing:-2px}
  .tag{position:absolute;left:88px;top:462px;font-size:44px;font-weight:400;color:#f7f1e3}
  .sub{position:absolute;left:88px;top:528px;font-size:27px;font-style:italic;color:#e0b765}
  .gk{position:absolute;right:70px;top:92px;font-size:62px;color:#f7f1e3aa;text-align:right;line-height:1.35}
  .gk b{color:#e0b765;font-weight:400}
  </style><body><div class=ico>${svg('icons/icon-any.svg')}</div><h1>lexiko</h1>
  <div class=tag>Learn to read the Greek New Testament.</div>
  <div class=sub>Spaced repetition · parsing drills · a passage reader — free, offline, no login</div>
  <div class=gk>Ἐν ἀρχῇ ἦν<br>ὁ <b>λόγος</b></div></body>`;
  await png('icons/og-image.png', 1200, 630, og);
  await b.close();
})();
