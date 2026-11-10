"""WOFF (Version 1) in TTF umwandeln, für die Schriften im PDF. Aufruf: python3 woff2ttf.py ein.woff aus.ttf"""
import struct, sys, zlib

def convert(src, dst):
    data = open(src, 'rb').read()
    sig, flavor, length, num, _, total = struct.unpack('>4sIIHHI', data[:20])
    assert sig == b'wOFF', 'keine WOFF-Datei'
    tables = []
    for i in range(num):
        tag, off, comp, orig, chk = struct.unpack('>4sIIII', data[44 + i * 20: 64 + i * 20])
        raw = data[off:off + comp]
        tables.append((tag, zlib.decompress(raw) if comp < orig else raw, chk))
    tables.sort(key=lambda t: t[0])
    es = max(k for k in range(16) if 2 ** k <= num)
    sr = 2 ** es * 16
    out = bytearray(struct.pack('>IHHHH', flavor, num, sr, es, num * 16 - sr))
    offset = 12 + 16 * num
    body = bytearray()
    for tag, tdata, chk in tables:
        out += struct.pack('>4sIII', tag, chk, offset + len(body), len(tdata))
        body += tdata + b'\0' * ((4 - len(tdata) % 4) % 4)
    open(dst, 'wb').write(bytes(out + body))

if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2])
