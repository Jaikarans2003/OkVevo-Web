"""Pillars, for the charcoal section: an orange roof held up by five inked columns, in light inks on dark stock.
Painted with inv() inks on white and inverted on save (dark=True); the page screens it onto the charcoal.
Labels are set in HTML."""
from okart import *  # noqa: F401,F403

e = Editorial(1600, 920, seed=31, stock='#ffffff')
P = inv
LINE, DIM, SOFT = '#ece6de', '#4a443e', '#3a3530'
COLS = ['#4f8c84', '#d9a63c', '#c65a43', '#82986a', '#71889a']     # Technology, Finance, Marketing, Sales, Operations
XS = [260 + i * 270 for i in range(5)]
W2 = 58

# 1 ground: a soft glow behind the temple
e.fill(e.blob(800, 520, 760, 380, rough=0.05), P(SOFT), density=0.7)
e.stage('ground')

# 2 steps
for x0, x1, y0 in [(120, 1480, 830), (80, 1520, 866)]:
    m = e.rrect(x0, y0, x1, y0 + 36, 6)
    e.fill(m, P(DIM), density=0.95)
    e.halftone(m * np.clip((x1 - e.XX) / (x1 - x0), 0, 1), P('#6a625a'), cell=8, angle=0.3, amount=0.8)
    e.line(rr_pts(x0, y0, x1, y0 + 36, 6), P(LINE), 3, closed=True)
e.stage('steps')

# 3 five columns, each its own ink, fluted, lit from the left
for cx, ink in zip(XS, COLS):
    shaft = e.rrect(cx - W2, 330, cx + W2, 800, 8)
    e.fill(shaft, P(ink))
    e.halftone(shaft * np.clip((cx - e.XX + 20) / W2, 0, 1), P('#f4ece0'), cell=9, angle=0.7, amount=0.16)
    for fx in np.linspace(cx - W2 + 20, cx + W2 - 20, 4):
        e.line([(fx, 344), (fx, 786)], P('#1e1c1a'), 2.2, wobble=0.5)
    e.line(rr_pts(cx - W2, 330, cx + W2, 800, 8), P(LINE), 3, closed=True)
    for (y0, y1, ww) in [(300, 330, W2 + 22), (800, 830, W2 + 18)]:                # capital and base
        m = e.rrect(cx - ww, y0, cx + ww, y1, 8)
        e.fill(m, P(DIM), density=0.95)
        e.line(rr_pts(cx - ww, y0, cx + ww, y1, 8), P(LINE), 3, closed=True)
    e.line([(cx - W2 - 10, 316), (cx + W2 + 10, 316)], P(ink), 4, wobble=0.3)
e.stage('columns')

# 4 the roof: entablature and an orange pediment
ent = e.rrect(120, 236, 1480, 300, 8)
e.fill(ent, P(DIM), density=0.95)
e.line(rr_pts(120, 236, 1480, 300, 8), P(LINE), 3.5, closed=True)
for k in range(13):
    x = 170 + k * 105
    e.fill(e.rrect(x, 254, x + 40, 282, 4), P(ORANGE), density=0.85)
ped = [(100, 236), (800, 34), (1500, 236)]
tym = e.poly([(330, 214), (800, 84), (1270, 214)])                                  # tympanum, where the label sits
roof = e.poly(ped) * (1 - tym)
e.fill(roof, P(ORANGE))
e.halftone(roof * np.clip((800 - e.XX) / 700 + 0.15, 0, 1), P('#ffb07a'), cell=12, angle=0.6, amount=0.5)
e.fill(tym, P(PEACH), density=0.95)
e.line(ped + [ped[0]], P(LINE), 4)
e.line([(330, 214), (800, 84), (1270, 214), (330, 214)], P('#2a2a2a'), 3)
e.stage('roof')

e.stars([(90, 120, 16), (1500, 110, 14), (1540, 640, 12), (60, 560, 12)], P(LINE))
for (x, y, r, c) in [(1420, 60, 12, ORANGE), (200, 60, 10, COLS[0]), (1560, 420, 9, COLS[1])]:
    e.fill(e.circle(x, y, r), P(c))

save_webp(e, 'pillars', 1600, stages=True, dark=True)
