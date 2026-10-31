#!/usr/bin/env python3
"""Generate favicon.svg (glyph outlined from Lexiko Serif Bold), icon SVG sources and favicon.ico."""
import sys, os, struct
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shim'))
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
font = TTFont(os.path.join(ROOT, 'fonts/lexiko-serif-bold.woff2'))
gs = font.getGlyphSet(); name = font.getBestCmap()[0x3BB]
bp = BoundsPen(gs); gs[name].draw(bp); x0, y0, x1, y1 = bp.bounds

def lambda_path(size, frac, dx=0, dy=0):
    """path for λ scaled to `frac` of `size`, centred, y flipped."""
    s = size * frac / (y1 - y0)
    w, h = (x1 - x0) * s, (y1 - y0) * s
    ox, oy = (size - w) / 2 + dx, (size - h) / 2 + dy
    pen = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    gs[name].draw(TransformPen(pen, (s, 0, 0, -s, ox - x0 * s, oy + y1 * s)))
    return pen.getCommands()

def icon_svg(size, frac, radius, glyph_dy=0):
    rx = size * radius
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f7a9c"/>'
            '<stop offset="1" stop-color="#17445f"/></linearGradient></defs>'
            '<rect width="%d" height="%d" rx="%.1f" fill="url(#g)"/>'
            '<path d="%s" fill="#f7f1e3"/>'
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#e0b765"/></svg>') % (
        size, size, size, size, size, size, rx, lambda_path(size, frac, dy=glyph_dy),
        size * 0.30, size * 0.865, size * 0.40, size * 0.028, size * 0.014)

out = os.path.join(ROOT, 'icons'); os.makedirs(out, exist_ok=True)
open(os.path.join(ROOT, 'favicon.svg'), 'w').write(icon_svg(512, 0.60, 0.22, glyph_dy=-12))
open(os.path.join(out, 'icon-any.svg'), 'w').write(icon_svg(512, 0.60, 0.22, glyph_dy=-12))
open(os.path.join(out, 'icon-full.svg'), 'w').write(icon_svg(512, 0.56, 0.0, glyph_dy=-12))       # full-bleed: apple-touch + maskable
open(os.path.join(out, 'icon-maskable.svg'), 'w').write(icon_svg(512, 0.44, 0.0, glyph_dy=-6))   # glyph kept inside the 80% safe zone
print('svgs written; lambda bounds', (x0, y0, x1, y1))
