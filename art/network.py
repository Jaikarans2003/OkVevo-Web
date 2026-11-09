"""Networks: one network's head office in the middle, dashed lines out to the businesses it serves; every shop
wears a small orange OkVevo badge (each runs its own deployment). Stages drive the page's draw-on loop."""
from okart import *  # noqa: F401,F403

e = Editorial(1400, 1000, seed=53, stock=PAPER)
CX, CY = 700, 500
N = 8
ANG = np.linspace(-np.pi / 2, 3 * np.pi / 2, N, endpoint=False)
RX, RY = 520, 370
SHOPS = [(CX + np.cos(a) * RX, CY + np.sin(a) * RY) for a in ANG]
INKS = [TEAL, OCHRE, RUST, OLIVE, SLATE, ORANGE, UMBER, TEAL]

# 1 the ground the network covers
e.fill(e.blob(CX, CY, 600, 430, rough=0.05), SAND, density=0.6)
e.stage('ground')

# 2 head office: a tall building, windows knocked out of the ink, a flag on top
x0, y0, x1, y1 = CX - 92, CY - 120, CX + 92, CY + 110
wins = np.maximum.reduce([e.rrect(x0 + 24 + c * 50, y0 + 26 + r * 50, x0 + 56 + c * 50, y0 + 56 + r * 50, 4) for c in range(3) for r in range(3)])
door = e.rrect(CX - 22, y1 - 56, CX + 22, y1, 6)
body = e.rrect(x0, y0, x1, y1, 10) * (1 - wins) * (1 - door)
e.fill(body, INK)
e.halftone(body * np.clip((e.XX - CX) / 92, 0, 1), INK, cell=8, amount=0.3)
e.fill(wins, PEACH, density=0.95)
e.fill(door, ORANGE)
e.line(rr_pts(x0, y0, x1, y1, 10), INK, 4, closed=True)
e.line([(CX, y0), (CX, y0 - 70)], INK, 4)
flag = [(CX + 2, y0 - 70), (CX + 54, y0 - 56), (CX + 2, y0 - 40)]
e.fill(e.poly(flag), ORANGE); e.line(flag, INK, 3, closed=True)
e.fill(e.ellipse(CX, y1 + 8, 130, 14), SAND)
e.stage('office')

# 3 the network: dashed lines from the office to every business
for (sx, sy) in SHOPS:
    dx, dy = sx - CX, sy - CY; L = np.hypot(dx, dy); ux, uy = dx / L, dy / L
    a, b = (CX + ux * 150, CY + uy * 140), (sx - ux * 92, sy - uy * 84)
    e.dashes([a, ((a[0] + b[0]) / 2 + uy * 18, (a[1] + b[1]) / 2 - ux * 18), b], ORANGE, 4, dash=12, gap=10)
e.stage('lines')


def shop(sx, sy, ink):
    """a small storefront: striped awning in its ink, a door, a window, and the OkVevo badge"""
    bx0, by0, bx1, by1 = sx - 58, sy - 30, sx + 58, sy + 56
    win = e.rrect(sx + 4, sy - 12, sx + 44, sy + 22, 4)
    dr = e.rrect(sx - 44, sy - 8, sx - 12, sy + 56, 4)
    e.fill(e.rrect(bx0, by0, bx1, by1, 6) * (1 - win) * (1 - dr), CARD, density=0.95)
    e.fill(win, SAND, density=0.9); e.fill(dr, ink)
    e.line(rr_pts(bx0, by0, bx1, by1, 6), INK, 3.5, closed=True)
    e.line(rr_pts(sx + 4, sy - 12, sx + 44, sy + 22, 4), INK, 2.5, closed=True)
    for k in range(6):                                       # awning stripes: ink, paper, ink...
        if k % 2 == 0:
            xa = sx - 70 + k * 23.3
            e.fill(e.poly([(xa, sy - 64), (xa + 23.3, sy - 64), (xa + 26, sy - 30), (xa - 2, sy - 30)]), ink)
    awn = [(sx - 70, sy - 64), (sx + 70, sy - 64), (sx + 72, sy - 30), (sx - 72, sy - 30)]
    e.line(awn, INK, 3.5, closed=True)
    e.fill(e.circle(sx + 58, sy - 66, 17), ORANGE)                       # the badge: OkVevo running here
    e.line([(sx + 58 + np.cos(t) * 17, sy - 66 + np.sin(t) * 17) for t in np.linspace(0, 2 * np.pi, 30)], INK, 3)
    e.line([(sx + 50, sy - 66), (sx + 56, sy - 59), (sx + 67, sy - 73)], INK, 3, wobble=0.2)
    e.fill(e.ellipse(sx, sy + 64, 80, 9), SAND)


# 4 the businesses, two at a time
for k in range(0, N, 2):
    for j in (k, k + 1):
        shop(*SHOPS[j], INKS[j])
    e.stage(f'shops-{k}')

e.stars([(120, 120, 16), (1290, 110, 14), (1310, 900, 12), (90, 880, 12)], INK)
for (x, y, r, c) in [(260, 500, 10, ORANGE), (1150, 520, 9, TEAL), (700, 930, 9, OCHRE)]:
    e.fill(e.circle(x, y, r), c)

save_webp(e, 'network', 1400, stages=True)
