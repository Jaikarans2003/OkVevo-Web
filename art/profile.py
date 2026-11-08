"""Profile: your OkVevo badge on a lanyard, a portrait, your details as ruled lines, a pen beside it.
Stages drive the portal's draw-on loop."""
from okart import *  # noqa: F401,F403

e = Editorial(1200, 1000, seed=19, stock=PAPER)
CX = 600

e.fill(e.blob(CX, 580, 500, 360, rough=0.05), SAND, density=0.6)
e.fill(e.circle(300, 280, 90), PEACH, density=0.85)
e.stage('ground')

# 2 the lanyard straps and the clip
for side in (-1, 1):
    e.line([(CX + side * 230, 0), (CX + side * 120, 120), (CX + side * 26, 250)], ORANGE, 18, wobble=1.2)
e.fill(e.rrect(CX - 34, 236, CX + 34, 300, 10), SLATE)
e.line(rr_pts(CX - 34, 236, CX + 34, 300, 10), INK, 3.5, closed=True)
e.stage('lanyard')

# 3 the badge: a printed card with a teal header band and a punched slot
bx0, by0, bx1, by1 = CX - 210, 290, CX + 210, 860
slot = e.rrect(CX - 46, by0 + 22, CX + 46, by0 + 40, 9)
card = e.rrect(bx0, by0, bx1, by1, 30) * (1 - slot)
band = card * (e.YY < by0 + 130)
e.fill(card * (1 - band), CARD, density=0.95)
e.fill(band, TEAL)
e.halftone(band, INK, cell=8, amount=0.2)
e.line(rr_pts(bx0, by0, bx1, by1, 30, n=10), INK, 5, closed=True)
e.line(rr_pts(CX - 46, by0 + 22, CX + 46, by0 + 40, 9), INK, 2.5, closed=True)
e.line([(bx0 + 4, by0 + 130), (bx1 - 4, by0 + 130)], INK, 3.5)
e.stage('badge')

# 4 the portrait: a round frame, a head and shoulders
pcx, pcy, pr = CX, by0 + 250, 110
frame = e.circle(pcx, pcy, pr)
person = (e.circle(pcx, pcy - 22, 42) + e.ellipse(pcx, pcy + 92, 82, 62)) * frame
e.fill(frame * (1 - np.clip(person, 0, 1)), PEACH, density=0.95)
e.fill(np.clip(person, 0, 1), OCHRE)
e.halftone(np.clip(person, 0, 1) * np.clip((e.XX - pcx + 40) / 120, 0, 1), RUST, cell=8, amount=0.4)
e.line([(pcx + np.cos(t) * pr, pcy + np.sin(t) * pr) for t in np.linspace(0, 2 * np.pi, 60)], INK, 4.5)
e.stage('portrait')

# 5 your details: ruled lines, the name line bold, and the OkVevo badge mark
e.line([(CX - 130, by0 + 410), (CX + 130, by0 + 410)], INK, 12, wobble=0.6)
for k, w in enumerate([190, 150, 170]):
    e.line([(CX - w / 2 - 20, by0 + 460 + k * 34), (CX + w / 2 - 20, by0 + 460 + k * 34)], INK, 4, wobble=0.6)
e.fill(e.circle(bx1 - 60, by1 - 60, 24), ORANGE)
e.line([(bx1 - 60 + np.cos(t) * 24, by1 - 60 + np.sin(t) * 24) for t in np.linspace(0, 2 * np.pi, 30)], INK, 3)
e.line([(bx1 - 71, by1 - 60), (bx1 - 63, by1 - 51), (bx1 - 48, by1 - 70)], INK, 3.5, wobble=0.2)
e.stage('details')

# 6 a pen leaning on it, sparkles
pen = [(930, 400), (968, 414), (880, 760), (842, 746)]
e.fill(e.poly(pen), RUST)
e.line(pen, INK, 4, closed=True)
tip = [(842, 746), (880, 760), (850, 808)]
e.fill(e.poly(tip), CARD); e.line(tip, INK, 3.5, closed=True)
e.fill(e.rrect(924, 392, 976, 428, 6), OCHRE)
e.stars([(170, 520, 14), (1040, 260, 16), (1060, 860, 12), (200, 840, 11)], INK)
for (x, y, r, c) in [(1000, 560, 9, TEAL), (180, 660, 8, ORANGE)]:
    e.fill(e.circle(x, y, r), c)
e.stage('pen')

save_webp(e, 'profile', 1100, stages=True)
