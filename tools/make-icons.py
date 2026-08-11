#!/usr/bin/env python3
"""
Generate the extension's PNG icons.

Pure stdlib (zlib + struct) so it runs anywhere without Pillow. Draws at 4x
and downsamples for antialiasing.

Usage: python3 tools/make-icons.py
"""

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "extension", "icons")
SIZES = (16, 48, 128)
SS = 4  # supersample factor

NAVY = (15, 23, 42, 255)
BARS = [
    (0.27, 0.58, (56, 189, 248, 255)),   # x-center, top (0=top), colour
    (0.50, 0.44, (45, 212, 191, 255)),
    (0.73, 0.26, (74, 222, 128, 255)),
]
BAR_W = 0.16
BAR_BOTTOM = 0.78
CORNER_R = 0.20


def write_png(path, width, height, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter type: none
        for px in row:
            raw += bytes(px)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    blob = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(blob)


def inside_rounded_rect(u, v, r):
    """u, v in 0..1. True when the point is inside a rounded unit square."""
    if r <= 0:
        return True
    cx = min(max(u, r), 1 - r)
    cy = min(max(v, r), 1 - r)
    dx, dy = u - cx, v - cy
    return dx * dx + dy * dy <= r * r + 1e-9


def sample(u, v):
    """Colour at unit coordinates, or None for transparent."""
    if not inside_rounded_rect(u, v, CORNER_R):
        return (0, 0, 0, 0)

    for cx, top, colour in BARS:
        half = BAR_W / 2
        if cx - half <= u <= cx + half and top <= v <= BAR_BOTTOM:
            return colour

    return NAVY


def render(size):
    big = size * SS
    acc = [[(0, 0, 0, 0)] * size for _ in range(size)]

    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    u = (x * SS + sx + 0.5) / big
                    v = (y * SS + sy + 0.5) / big
                    pr, pg, pb, pa = sample(u, v)
                    # Premultiply so edges blend against transparency correctly.
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            n = SS * SS
            if a == 0:
                row.append((0, 0, 0, 0))
            else:
                row.append((round(r / a), round(g / a), round(b / a), round(a / n)))
        acc[y] = row
    return acc


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        write_png(path, size, size, render(size))
        print(f"wrote {os.path.relpath(path)} ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main()
