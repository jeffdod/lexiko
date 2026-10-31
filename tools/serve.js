// Tiny static server that mounts the repo at /lexiko/ (like GitHub Pages project sites). usage: node tools/serve.js [port]
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(__dirname, '..'), port = +process.argv[2] || 8123, prefix = '/lexiko/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(302, { Location: prefix }); return res.end(); }
  if (!u.startsWith(prefix)) { res.writeHead(404); return res.end('not found'); }
  let f = path.join(root, u.slice(prefix.length)); if (f.endsWith(path.sep) || u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || f.includes(path.sep + 'sources') || f.includes(path.sep + '.git')) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const h = { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (/json|javascript|html|css|svg/.test(h['Content-Type']) && /gzip/.test(req.headers['accept-encoding'] || '')) { h['Content-Encoding'] = 'gzip'; data = zlib.gzipSync(data); }
    res.writeHead(200, h); res.end(data);
  });
}).listen(port, () => console.log('serving http://localhost:' + port + prefix));
