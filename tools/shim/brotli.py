"""Minimal stand-in for the `brotli` PyPI module using Node's built-in zlib Brotli.
Only what fontTools' WOFF2 reader/writer needs. Used because PyPI is unreachable in the build sandbox."""
import subprocess
MODE_GENERIC, MODE_TEXT, MODE_FONT = 0, 1, 2

_NODE_C = ("const z=require('zlib');const c=[];process.stdin.on('data',d=>c.push(d)).on('end',()=>{"
           "const b=Buffer.concat(c);const o=z.brotliCompressSync(b,{params:{"
           "[z.constants.BROTLI_PARAM_MODE]:%d,[z.constants.BROTLI_PARAM_QUALITY]:%d,"
           "[z.constants.BROTLI_PARAM_LGWIN]:%d,[z.constants.BROTLI_PARAM_SIZE_HINT]:b.length}});"
           "process.stdout.write(o)})")
_NODE_D = ("const z=require('zlib');const c=[];process.stdin.on('data',d=>c.push(d)).on('end',()=>{"
           "process.stdout.write(z.brotliDecompressSync(Buffer.concat(c)))})")

def compress(data, mode=MODE_GENERIC, quality=11, lgwin=22, lgblock=0):
    return subprocess.run(['node', '-e', _NODE_C % (mode, quality, lgwin)], input=bytes(data),
                          capture_output=True, check=True).stdout

def decompress(data):
    return subprocess.run(['node', '-e', _NODE_D], input=bytes(data), capture_output=True, check=True).stdout

Decompressor = None
