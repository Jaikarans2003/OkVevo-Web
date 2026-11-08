"""How it works, for the olive section: one road through the five steps of the service, a printed stop for
each, in light inks on dark stock. Painted with inv() inks on white and inverted on save (dark=True); the page
screens it onto the olive. Labels are set in HTML."""
from okart import *  # noqa: F401,F403
from PIL import ImageDraw

e = Editorial(1600, 700, seed=41, stock='#ffffff')
P = inv
LINE, DIM, ROAD = '#ece6de', '#3c3833', '#4a443e'
L_TEAL, L_OCHRE, L_RUST, L_OLIVE, L_SLATE = '#4f8c84', '#d9a63c', '#c65a43', '#82986a', '#71889a'
XS = [160, 480, 800, 1120, 1440]
YS = [300, 430, 300, 430, 300]
INKS = [ORANGE, L_TEAL, L_OCHRE, L_RUST, SAND]      # Start, Designs, Deploys, Knows the domain, Always (sand: the section is olive)
R = 104

# 1 the road, broken where a stop sits on it
road = spline([(-40, 380)] + list(zip(XS, YS)) + [(1640, 360)], 18)
discs = np.maximum.reduce([e.circle(x, y, R + 2) for x, y in zip(XS, YS)])
band = Image.new('L', (e.W, e.H), 0)                       # the road as one band, cut out under every disc
ImageDraw.Draw(band).line([tuple(p) for p in road], fill=255, width=70, joint='curve')
e.fill(np.asarray(band, np.float32) / 255 * (1 - discs), P(ROAD))
runs, run = [], []
for p in road:
    if min(np.hypot(p[0] - x, p[1] - y) for x, y in zip(XS, YS)) > R + 4:
        run.append(tuple(p))
    elif run:
        runs.append(run); run = []
runs.append(run)
for r in runs:
    if len(r) > 1:
        e.dashes(r, P(LINE), 3, dash=18, gap=14)
e.stage('road')


def stop(k):
    """a printed disc: a dim fill, a light rim, the step's ink plate off-register behind it"""
    cx, cy = XS[k], YS[k]
    disc = e.circle(cx, cy, R)
    e.fill(e.circle(cx + 12, cy + 12, R) * (1 - disc), P(INKS[k]))
    e.fill(disc, P(DIM), density=0.97)
    e.line([(cx + np.cos(a) * R, cy + np.sin(a) * R) for a in np.linspace(0, 2 * np.pi, 80)], P(LINE), 3.5)
    return cx, cy


# 2 Start: a flag planted at the beginning
cx, cy = stop(0)
e.line([(cx - 30, cy + 62), (cx - 30, cy - 62)], P(LINE), 6)
flag = [(cx - 28, cy - 60), (cx + 56, cy - 34), (cx - 28, cy - 6)]
e.fill(e.poly(flag), P(ORANGE)); e.halftone(e.poly(flag) * np.clip((cy - e.YY) / 60, 0, 1), P('#ffb07a'), cell=7, amount=0.5)
e.line(flag, P(LINE), 3, closed=True)
e.fill(e.ellipse(cx - 30, cy + 64, 36, 9), P(ROAD))
e.stage('start')

# 3 Designs: a blueprint and a pencil
cx, cy = stop(1)
sheet = e.rrect(cx - 62, cy - 48, cx + 50, cy + 46, 6)
e.fill(sheet, P(L_TEAL))
e.line(rr_pts(cx - 62, cy - 48, cx + 50, cy + 46, 6), P(LINE), 3, closed=True)
for (a, b) in [((cx - 44, cy - 28), (cx + 4, cy - 28)), ((cx + 4, cy - 28), (cx + 4, cy + 26)), ((cx - 44, cy + 2), (cx + 32, cy + 2)), ((cx - 44, cy - 28), (cx - 44, cy + 26)), ((cx - 44, cy + 26), (cx + 32, cy + 26))]:
    e.line([a, b], P(LINE), 2.5, wobble=0.4)
pen = [(cx + 30, cy + 58), (cx + 74, cy - 40), (cx + 90, cy - 33), (cx + 46, cy + 65)]
e.fill(e.poly(pen), P(L_OCHRE)); e.line(pen, P(LINE), 2.5, closed=True)
e.fill(e.poly([(cx + 30, cy + 58), (cx + 46, cy + 65), (cx + 32, cy + 80)]), P(LINE))
e.stage('designs')

# 4 Deploys: a plug going into its socket
cx, cy = stop(2)
body = e.rrect(cx - 56, cy - 26, cx + 6, cy + 26, 10)
e.fill(body, P(L_OCHRE)); e.halftone(body * np.clip((cy - e.YY) / 26, 0, 1), P('#f1d58a'), cell=7, amount=0.4)
e.line(rr_pts(cx - 56, cy - 26, cx + 6, cy + 26, 10), P(LINE), 3, closed=True)
for py in (cy - 12, cy + 12):
    e.line([(cx + 6, py), (cx + 30, py)], P(LINE), 6, wobble=0.2)
sock = e.rrect(cx + 36, cy - 40, cx + 62, cy + 40, 8)
e.fill(sock, P(L_SLATE)); e.line(rr_pts(cx + 36, cy - 40, cx + 62, cy + 40, 8), P(LINE), 3, closed=True)
e.line(spline([(cx - 56, cy), (cx - 80, cy + 10), (cx - 70, cy + 52), (cx - 30, cy + 70)], 10), P(LINE), 5)
e.stars([(cx + 30, cy - 46, 10)], P(ORANGE), 4)
e.stage('deploys')

# 5 Knows the domain: an open book
cx, cy = stop(3)
left = [(cx - 70, cy - 36), (cx, cy - 26), (cx, cy + 50), (cx - 70, cy + 40)]
right = [(cx, cy - 26), (cx + 70, cy - 36), (cx + 70, cy + 40), (cx, cy + 50)]
e.fill(e.poly(left), P(L_RUST)); e.fill(e.poly(right), P(L_RUST), density=0.75)
e.line(left, P(LINE), 3, closed=True); e.line(right, P(LINE), 3, closed=True)
for k in range(3):
    y = cy - 12 + k * 16
    e.line([(cx - 56, y - 6), (cx - 12, y)], P(LINE), 2, wobble=0.3)
    e.line([(cx + 12, y), (cx + 56, y - 6)], P(LINE), 2, wobble=0.3)
e.fill(e.poly([(cx + 40, cy - 34), (cx + 54, cy - 36), (cx + 54, cy - 8), (cx + 47, cy - 15), (cx + 40, cy - 8)]), P(ORANGE))
e.stage('knows')

# 6 Always: arrows going round and round
cx, cy = stop(4)
for a0, ink in [(0.3, SAND), (np.pi + 0.3, ORANGE)]:
    arc = [(cx + np.cos(a) * 52, cy + np.sin(a) * 52) for a in np.linspace(a0, a0 + 2.4, 30)]
    e.line(arc, P(ink), 14, wobble=0.3)
    ex, ey = arc[-1]; a1 = a0 + 2.4
    tx, ty = -np.sin(a1), np.cos(a1)
    head = [(ex + tx * 22, ey + ty * 22), (ex - ty * 18 - tx * 6, ey + tx * 18 - ty * 6), (ex + ty * 18 - tx * 6, ey - tx * 18 - ty * 6)]
    e.fill(e.poly(head), P(ink))
e.stage('always')

e.stars([(70, 130, 14), (1530, 120, 16), (820, 620, 12)], P(LINE))
for (x, y, r, c) in [(330, 600, 10, ORANGE), (1290, 610, 9, L_TEAL), (640, 110, 9, L_OCHRE)]:
    e.fill(e.circle(x, y, r), P(c))

save_webp(e, 'how', 1600, stages=True, dark=True)
