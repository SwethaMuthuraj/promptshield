import struct, zlib, os

def make_png(size):
    r, g, b = 124, 58, 237
    rows = b""
    for y in range(size):
        row = bytes([0])
        for x in range(size):
            cx = abs(x - size // 2) / (size // 2)
            cy = abs(y - size // 2) / (size // 2)
            if cx < 0.6 and cy < 0.6:
                row += bytes([min(r+40,255), min(g+30,255), min(b+10,255), 255])
            else:
                row += bytes([r, g, b, 255])
        rows += row

    comp = zlib.compress(rows, 9)

    def chunk(name, data):
        c = name + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png  = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", comp)
    png += chunk(b"IEND", b"")
    return png

os.makedirs("icons", exist_ok=True)
for s in [16, 48, 128]:
    with open(f"icons/icon{s}.png", "wb") as f:
        f.write(make_png(s))
    print(f"Created icons/icon{s}.png")

print("Done!")