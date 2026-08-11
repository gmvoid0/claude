#!/usr/bin/env python3
"""
Generate S.A.M's PNG icons.

Pure stdlib (zlib + struct) so it runs anywhere without Pillow. Rendered at 4x
and downsampled for antialiasing.

The shape is a superellipse rather than a rounded rectangle — that is what
gives Apple's icons their continuous, non-pinched corners. Over it: a vertical
blue gradient, three ascending bars, and the classic gloss, which is a
white overlay bounded by a downward-bulging arc and fading as it descends.

Usage: python3 tools/make-icons.py
"""

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "extension", "icons")
SIZES = (16, 48, 128)
SS = 4  # supersample factor

# Squircle exponent. 2 is an ellipse, infinity is a square; Apple sits ~4-5.
SQUIRCLE_N = 4.6

# Vertical gradient, top to bottom.
GRAD_TOP = (0x5A, 0xA9, 0xFF)
GRAD_BOTTOM = (0x0A, 0x64, 0xD8)

# Ascending bars: (x-center, top edge, bottom edge) in unit coordinates.
BAR_W = 0.155
BAR_BOTTOM = 0.775
BARS = [(0.275, 0.575), (0.50, 0.435), (0.725, 0.255)]

GLOSS_STRENGTH = 0.30


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


def inside_squircle(u, v):
    """u, v in 0..1. |x|^n + |y|^n <= 1 about the centre."""
    x = abs(2.0 * u - 1.0)
    y = abs(2.0 * v - 1.0)
    return (x ** SQUIRCLE_N + y ** SQUIRCLE_N) <= 1.0


def inside_rounded_bar(u, v, cx, top):
    """A bar with fully rounded ends, as a stadium shape."""
    half = BAR_W / 2.0
    if not (cx - half <= u <= cx + half):
        return False
    if not (top <= v <= BAR_BOTTOM):
        return False
    # Round the two ends by testing against a circle of radius `half`.
    if v < top + half:
        dy = (top + half) - v
        return (u - cx) ** 2 + dy ** 2 <= half ** 2
    if v > BAR_BOTTOM - half:
        dy = v - (BAR_BOTTOM - half)
        return (u - cx) ** 2 + dy ** 2 <= half ** 2
    return True


def gloss_alpha(u, v):
    """
    White overlay above a downward-bulging arc, fading as it descends.
    Zero below the arc, strongest at the very top.
    """
    arc = 0.54 - 0.15 * (2.0 * u - 1.0) ** 2
    if v >= arc:
        return 0.0
    return GLOSS_STRENGTH * (1.0 - v / arc)


def sample(u, v):
    """Colour at unit coordinates as (r, g, b, a)."""
    if not inside_squircle(u, v):
        return (0, 0, 0, 0)

    # Base vertical gradient.
    r = GRAD_TOP[0] + (GRAD_BOTTOM[0] - GRAD_TOP[0]) * v
    g = GRAD_TOP[1] + (GRAD_BOTTOM[1] - GRAD_TOP[1]) * v
    b = GRAD_TOP[2] + (GRAD_BOTTOM[2] - GRAD_TOP[2]) * v

    # Bars.
    for cx, top in BARS:
        if inside_rounded_bar(u, v, cx, top):
            r, g, b = 255.0, 255.0, 255.0
            break

    # Gloss over everything, the way Apple's icons layer it.
    a = gloss_alpha(u, v)
    if a > 0:
        r = r + (255.0 - r) * a
        g = g + (255.0 - g) * a
        b = b + (255.0 - b) * a

    return (int(round(r)), int(round(g)), int(round(b)), 255)


def render(size):
    big = size * SS
    rows = []

    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = a = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    u = (x * SS + sx + 0.5) / big
                    v = (y * SS + sy + 0.5) / big
                    pr, pg, pb, pa = sample(u, v)
                    # Premultiply so edges blend correctly against transparency.
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            if a == 0:
                row.append((0, 0, 0, 0))
            else:
                n = SS * SS
                row.append((
                    int(round(r / a)),
                    int(round(g / a)),
                    int(round(b / a)),
                    int(round(a / n)),
                ))
        rows.append(row)
    return rows


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        write_png(path, size, size, render(size))
        print(f"wrote {os.path.relpath(path)} ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main()
