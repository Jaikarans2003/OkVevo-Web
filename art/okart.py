"""Shared setup for the landing-page illustrations, painted with the claude-drawing skill's
risograph editorial style (no image model). Run any art/*.py with python3; output lands in public/art/.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '.cursor', 'skills', 'claude-drawing', 'lib'))

import numpy as np
from PIL import Image, ImageFilter
from editorial import Editorial  # noqa: E402
from core import spline  # noqa: E402

# brand + section inks, all printed on the page's paper colour
PAPER = '#f4f2ee'
INK, ORANGE, SAND, PEACH = '#2a2a2a', '#ff6f20', '#e3dcd6', '#ffd9bf'
TEAL, RUST, OCHRE, OLIVE, UMBER, SLATE = '#2c5a55', '#a8422f', '#c9962e', '#5c6d4a', '#6b4a35', '#4a5a63'
SKIN, CARD = '#f2c4a8', '#fbf7f1'


def out_dir(name):
    d = os.path.join(HERE, '..', 'public', 'art', name)
    os.makedirs(d, exist_ok=True)
    return d


def inv(h):
    """the ink to paint so that, once a dark=True image is inverted, this colour is what prints"""
    return '#' + ''.join(f'{255 - int(h[i:i + 2], 16):02x}' for i in (1, 3, 5))


def save_webp(e, name, width, stages=False, dark=False):
    """final image as webp scaled to `width`.
    stages=True instead writes layer-0 (the first stage, opaque) plus one transparent layer per later stage
    holding only the pixels that stage inked; stacked in order they rebuild the final image (the draw-on effect)."""
    d = out_dir(name)
    h = round(e.H * width / e.W)
    paper = np.array([int(PAPER[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

    def inks(im):
        # divide the paper out (paper -> white): the page prints this with mix-blend-mode: multiply,
        # so the inks land on the page's own paper and texture and no sheet edge ever shows.
        # dark=True art is painted with inv() inks on white and inverted here (paper -> black),
        # for mix-blend-mode: screen on a dark section: light inks on dark stock.
        a = np.asarray(im.resize((width, h), Image.LANCZOS), np.float32)
        a = 255 - np.clip(a / 255 * 255, 0, 255) if dark else np.clip(a / paper * 255, 0, 255)
        if not dark:  # the stock's faint mottle would otherwise print as webp blocks: bare paper must be pure white
            a = np.where(a.min(2, keepdims=True) > 243, 255, a)
        return a.astype(np.int16)

    if not stages:
        Image.fromarray(inks(e.composite()).astype(np.uint8)).save(os.path.join(d, 'final.webp'), 'WEBP', quality=84, method=6)
        print(name, f'{width}x{h}')
        return
    frames = [inks(im) for _, im in e.stages] + [inks(e.composite())]
    Image.fromarray(frames[0].astype(np.uint8)).save(os.path.join(d, 'layer-0.webp'), 'WEBP', quality=84, method=6)
    for i in range(1, len(frames)):
        changed = (np.abs(frames[i] - frames[i - 1]).max(2) > 3).astype(np.uint8) * 255
        changed = np.asarray(Image.fromarray(changed).filter(ImageFilter.MaxFilter(3)))
        rgba = np.dstack([frames[i].astype(np.uint8), changed])
        Image.fromarray(rgba, 'RGBA').save(os.path.join(d, f'layer-{i}.webp'), 'WEBP', quality=84, method=6)
    print(name, len(frames), 'layers', f'{width}x{h}')


def rr_pts(x0, y0, x1, y1, r, n=8):
    """outline points of a rounded rectangle, to ink the edge of an e.rrect fill"""
    pts = []
    for cx, cy, a0 in [(x1 - r, y0 + r, -np.pi / 2), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, np.pi / 2), (x0 + r, y0 + r, np.pi)]:
        pts += [(cx + np.cos(a) * r, cy + np.sin(a) * r) for a in np.linspace(a0, a0 + np.pi / 2, n)]
    return pts


def gear(e, cx, cy, r, teeth=10, hole=0.34):
    pts = []
    for k in range(teeth * 4):
        a = k / (teeth * 4) * 2 * np.pi
        rr = r if (k % 4) in (1, 2) else r * 0.8
        pts.append((cx + np.cos(a) * rr, cy + np.sin(a) * rr))
    return e.poly(pts) * (1 - e.circle(cx, cy, r * hole)), pts
