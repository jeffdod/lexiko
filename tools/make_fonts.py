#!/usr/bin/env python3
"""Subset + convert Gentium Porsonic (SIL OFL 1.1) to woff2 for the web.

The OFL reserves the names "Gentium" and "SIL". Subsetting is a modification, so the web family is
renamed "Lexiko Serif"; copyright, license text and license URL (name IDs 0, 13, 14) are preserved verbatim.
usage: make_fonts.py SRC_DIR OUT_DIR
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shim'))
from fontTools.ttLib import TTFont
from fontTools import subset

FAMILY = 'Lexiko Serif'
FILES = {  # source file -> (output, subfamily)
    'GentiumPorsonic-Regular.ttf': ('lexiko-serif-regular.woff2', 'Regular'),
    'GentiumPorsonic-Italic.ttf': ('lexiko-serif-italic.woff2', 'Italic'),
    'GentiumPorsonic-Bold.ttf': ('lexiko-serif-bold.woff2', 'Bold'),
    'GentiumPorsonic-BoldItalic.ttf': ('lexiko-serif-bolditalic.woff2', 'Bold Italic'),
}
UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x100, 0x180)) +
            list(range(0x300, 0x370)) + list(range(0x370, 0x400)) + list(range(0x1F00, 0x2000)) +
            list(range(0x2010, 0x2028)) + [0x2030, 0x2039, 0x203A, 0x2044, 0x00AD, 0x0387, 0x037E, 0x2212, 0x2192, 0x2190, 0x2713, 0x00D7])


def main(src, out):
    os.makedirs(out, exist_ok=True)
    for fn, (outname, sub) in FILES.items():
        opts = subset.Options()
        opts.layout_features = ['*']          # keep all OpenType features (mark positioning, Greek alternates)
        opts.hinting = False
        opts.desubroutinize = False
        opts.name_IDs = ['*']
        opts.name_legacy = False
        opts.notdef_outline = True
        opts.glyph_names = False
        opts.flavor = 'woff2'
        opts.drop_tables += ['Graphite', 'Silf', 'Glat', 'Gloc', 'Sill', 'Feat']   # Graphite is not used by browsers
        font = TTFont(os.path.join(src, fn))
        sub_ = subset.Subsetter(opts)
        sub_.populate(unicodes=UNICODES)
        sub_.subset(font)
        # rename (RFN rule); keep 0 copyright, 13 license, 14 license URL, 9 designer, 8/11/12 vendor info
        full = '%s %s' % (FAMILY, sub) if sub != 'Regular' else FAMILY
        ps = (FAMILY + '-' + sub).replace(' ', '')
        for rec in list(font['name'].names):
            if rec.platformID != 3:
                font['name'].removeNames(platformID=rec.platformID, nameID=rec.nameID); continue
            nid = rec.nameID
            if nid in (1, 16): rec.string = FAMILY if nid == 16 or sub in ('Regular', 'Italic', 'Bold', 'Bold Italic') else FAMILY
            elif nid in (2, 17): rec.string = sub
            elif nid == 3: rec.string = '%s;modified web subset (SIL OFL 1.1)' % ps
            elif nid == 4: rec.string = full
            elif nid == 6: rec.string = ps
            elif nid in (21, 22, 25): font['name'].removeNames(nameID=nid)
        font.flavor = 'woff2'
        dest = os.path.join(out, outname)
        font.save(dest)
        print('%-32s %7d bytes (source %d)' % (outname, os.path.getsize(dest), os.path.getsize(os.path.join(src, fn))))

if __name__ == '__main__':
    main(*sys.argv[1:3])
