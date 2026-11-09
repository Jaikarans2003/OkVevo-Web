"""Hero: the five pillars of a business orbiting one OkVevo core. Stages drive the page's draw-on effect."""
from okart import *  # noqa: F401,F403

e = Editorial(1600, 1200, seed=11, stock=PAPER)
CX, CY = 800, 610

ang = np.deg2rad([-90, -18, 54, 126, 198])
RX, RY = 560, 410
pos = [(CX + np.cos(a) * RX, CY + np.sin(a) * RY) for a in ang]
x0, y0, x1, y1 = CX - 170, CY - 125, CX + 170, CY + 125
win = e.rrect(x0, y0, x1, y1, 30)
hole = 1 - win                                  # inks multiply, so the light window is knocked out of what's behind it

# 1 backdrop: a sand disc, the orange sun behind the core
e.fill(e.circle(CX, CY, 520) * hole, SAND, density=0.8)
sun = e.circle(CX + 40, CY - 30, 300) * hole
e.fill(sun, ORANGE)
e.halftone(sun * np.clip((e.XX - CX + e.YY - CY + 120) / 520, 0, 1), RUST, cell=13, angle=0.6, amount=0.55)
e.stage('backdrop')

# 2 the orbit (broken where a pillar sits), and spokes from each pillar to the core
t = np.linspace(0, 2 * np.pi, 240)
run = []
for (x, y) in zip(CX + np.cos(t) * RX, CY + np.sin(t) * RY):
    if min(np.hypot(x - px, y - py) for px, py in pos) > 125:
        run.append((x, y))
    elif len(run) > 1:
        e.dashes(run, INK, 3, dash=18, gap=14); run = []
if len(run) > 1: e.dashes(run, INK, 3, dash=18, gap=14)
for (x, y) in pos:
    dx, dy = CX - x, CY - y; L = np.hypot(dx, dy); ux, uy = dx / L, dy / L
    a, b = (x + ux * 130, y + uy * 130), (CX - ux * 200, CY - uy * 150)
    e.dashes([a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 10), b], ORANGE, 4, dash=12, gap=10)
e.stage('orbit')

# 3 the core: one app window holding all five
e.fill(win, CARD, density=0.95)
dots = np.maximum.reduce([e.circle(x0 + 34 + k * 26, y0 + 28, 8) for k in range(3)])
e.fill(win * (e.YY < y0 + 56) * (1 - dots), INK)
e.line(rr_pts(x0, y0, x1, y1, 30), INK, 4, closed=True)
for k, c in enumerate([ORANGE, OCHRE, OLIVE]):
    e.fill(e.circle(x0 + 34 + k * 26, y0 + 28, 8), c)
for k, c in enumerate([TEAL, OCHRE, RUST, OLIVE, SLATE]):
    yy = y0 + 72 + k * 33
    if k == 1: e.fill(e.rrect(x0 + 22, yy - 4, x1 - 22, yy + 24, 12), PEACH, density=0.9)
    e.fill(e.circle(x0 + 44, yy + 10, 10), c, density=0.98)
    e.fill(e.rrect(x0 + 66, yy + 4, x1 - 40 - (k % 3) * 40, yy + 16, 6), INK if k == 1 else SAND, density=0.8)
e.stage('core')

# 4 the five pillars, one object each
S = 92
# Technology: a gear
gx, gy = pos[0]
gm, gp = gear(e, gx, gy, S)
e.fill(gm, TEAL)
e.halftone(gm * np.clip((e.XX - gx) / S, 0, 1), INK, cell=9, angle=0.8, amount=0.45)
e.line(gp, INK, 4, closed=True)
e.line([(gx + np.cos(a) * S * 0.34, gy + np.sin(a) * S * 0.34) for a in np.linspace(0, 2 * np.pi, 40)], INK, 3)
e.stage('technology')

# Finance: a stack of coins
fx, fy = pos[1]
R, top, bot = S * 0.85, fy - 50, fy + 60
stack = np.maximum.reduce([e.ellipse(fx, top, R, 28), e.rrect(fx - R, top, fx + R, bot, 2), e.ellipse(fx, bot, R, 28)])
e.fill(stack, OCHRE)
e.halftone(stack * np.clip((e.XX - fx) / R, 0, 1), RUST, cell=8, angle=0.4, amount=0.5)
e.line([(fx + np.cos(a) * R, top + np.sin(a) * 28) for a in np.linspace(0, 2 * np.pi, 60)], INK, 3.5)
e.line([(fx + np.cos(a) * R * 0.55, top + np.sin(a) * 15) for a in np.linspace(0, 2 * np.pi, 40)], INK, 2.5)
for yy in (top + 36, top + 72, bot):
    e.line([(fx + np.cos(a) * R, yy + np.sin(a) * 28) for a in np.linspace(0, np.pi, 30)], INK, 3)
e.line([(fx - R, top), (fx - R, bot)], INK, 3.5)
e.line([(fx + R, top), (fx + R, bot)], INK, 3.5)
e.stage('finance')

# Marketing: a megaphone with sound arcs
mx, my = pos[2]
cone = [(mx - 70, my - 22), (mx + 50, my - 72), (mx + 50, my + 72), (mx - 70, my + 22)]
e.fill(e.poly(cone), RUST)
e.halftone(e.poly(cone) * np.clip((e.YY - my) / 70, 0, 1), INK, cell=8, angle=0.7, amount=0.45)
e.line(cone, INK, 4, closed=True)
e.fill(e.rrect(mx - 100, my - 26, mx - 68, my + 26, 8), INK)
e.line([(mx - 40, my + 24), (mx - 30, my + 78), (mx - 8, my + 78), (mx - 10, my + 32)], INK, 4)
for k, r in enumerate([40, 70]):
    e.line([(mx + 60 + np.cos(a) * r, my + np.sin(a) * r) for a in np.linspace(-0.9, 0.9, 20)], ORANGE if k else INK, 4)
e.stage('marketing')

# Sales: a little chart card, bars climbing, arrow up
sx, sy = pos[3]
card = e.rrect(sx - 100, sy - 80, sx + 100, sy + 80, 18)
e.fill(card, CARD, density=0.9)
e.line([(sx - 82, sy - 80), (sx + 82, sy - 80), (sx + 100, sy - 62), (sx + 100, sy + 62), (sx + 82, sy + 80), (sx - 82, sy + 80), (sx - 100, sy + 62), (sx - 100, sy - 62), (sx - 82, sy - 80)], INK, 4)
for k, h in enumerate([40, 70, 105]):
    bx = sx - 64 + k * 50
    e.fill(e.rrect(bx, sy + 58 - h, bx + 32, sy + 58, 5), OLIVE)
e.line([(sx - 70, sy + 20), (sx - 10, sy - 18), (sx + 20, sy - 4), (sx + 76, sy - 58)], ORANGE, 6)
e.line([(sx + 50, sy - 60), (sx + 78, sy - 60), (sx + 78, sy - 32)], ORANGE, 6)
e.stage('sales')

# Operations: a clipboard with ticked list
ox, oy = pos[4]
board = e.rrect(ox - 78, oy - 100, ox + 78, oy + 100, 14)
e.fill(board, SLATE)
e.halftone(board * np.clip((e.XX - ox) / 78, 0, 1), INK, cell=8, angle=0.5, amount=0.4)
e.fill(e.rrect(ox - 58, oy - 74, ox + 58, oy + 84, 6), CARD, density=0.97)
e.fill(e.rrect(ox - 36, oy - 112, ox + 36, oy - 82, 8), INK)
for k in range(3):
    ly = oy - 40 + k * 40
    e.line([(ox - 42, ly), (ox - 30, ly + 12), (ox - 12, ly - 12)], ORANGE, 5, wobble=0.4)
    e.line([(ox, ly), (ox + 44, ly)], INK, 4, wobble=0.6)
e.line([(ox - 64, oy - 100), (ox + 64, oy - 100), (ox + 78, oy - 86), (ox + 78, oy + 86), (ox + 64, oy + 100), (ox - 64, oy + 100), (ox - 78, oy + 86), (ox - 78, oy - 86), (ox - 64, oy - 100)], INK, 4)
e.stage('operations')

# 5 finishing marks
e.stars([(260, 220, 18), (1340, 180, 14), (1430, 980, 16), (190, 900, 12)], INK)
for (x, y, r, c) in [(1400, 420, 14, ORANGE), (240, 600, 12, OCHRE), (1150, 1080, 10, TEAL), (420, 1080, 11, RUST)]:
    e.fill(e.circle(x, y, r), c)

save_webp(e, 'hero', 1400, stages=True)
