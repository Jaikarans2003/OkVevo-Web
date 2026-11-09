"""Login: a door left open, warm light spilling onto the mat, a key in the air: come on in.
Stages drive the portal's draw-on loop."""
from okart import *  # noqa: F401,F403

e = Editorial(1200, 1000, seed=71, stock=PAPER)
CX = 600

# 1 the ground and a low sun behind the wall
e.fill(e.blob(CX, 610, 520, 330, rough=0.05), SAND, density=0.6)
e.fill(e.circle(860, 260, 120), PEACH, density=0.85)
e.stage('ground')

# 2 the doorway: an arch-topped frame, the room beyond glowing orange
fx0, fy0, fx1, fy1 = CX - 170, 230, CX + 170, 800


def arch(x0, y0, x1, y1):
    """mask + outline of a round-topped arch: semicircle on top, straight sides down to y1"""
    r = (x1 - x0) / 2
    m = np.maximum(e.circle(x0 + r, y0 + r, r), e.rrect(x0, y0 + r, x1, y1, 1))
    pts = [(x0, y1)] + [(x0 + r - np.cos(t) * r, y0 + r - np.sin(t) * r) for t in np.linspace(0, np.pi, 30)] + [(x1, y1)]
    return m, pts


outer, outer_pts = arch(fx0, fy0, fx1, fy1 + 20)
opening, opening_pts = arch(fx0 + 26, fy0 + 26, fx1 - 26, fy1)
e.fill(outer * (1 - opening), CARD, density=0.95)
e.fill(opening, ORANGE, density=0.9)
e.halftone(opening * np.clip((e.YY - fy0) / (fy1 - fy0), 0, 1), RUST, cell=9, amount=0.5)
e.line(outer_pts, INK, 5)
e.line(opening_pts, INK, 3.5)
e.line([(fx0 - 80, fy1 + 20), (fx1 + 80, fy1 + 20)], INK, 5)
e.stage('doorway')

# 3 the light falling out across the floor
spill = e.poly([(fx0 + 30, fy1 + 22), (fx1 - 30, fy1 + 22), (fx1 + 150, 960), (fx0 - 150, 960)])
e.fill(spill, PEACH, density=0.9)
e.halftone(spill * np.clip((e.YY - fy1) / 160, 0, 1), ORANGE, cell=10, amount=0.35)
e.stage('light')

# 4 the door itself, swung open towards us on its left hinge
hx = fx0 + 26
door = [(hx, fy0 + 120), (hx - 150, fy0 + 60), (hx - 150, fy1 + 70), (hx, fy1)]
e.fill(e.poly(door), TEAL)
panel = [(hx - 30, fy0 + 160), (hx - 120, fy0 + 125), (hx - 120, fy0 + 330), (hx - 30, fy0 + 350)]
panel2 = [(hx - 30, fy0 + 400), (hx - 120, fy0 + 385), (hx - 120, fy1 + 20), (hx - 30, fy1 - 20)]
e.halftone(e.poly(door), INK, cell=8, amount=0.18)
e.line(door, INK, 4.5, closed=True)
e.line(panel, INK, 3, closed=True)
e.line(panel2, INK, 3, closed=True)
e.fill(e.circle(hx - 128, fy0 + 365, 11), OCHRE)
e.line([(hx - 128 + np.cos(t) * 11, fy0 + 365 + np.sin(t) * 11) for t in np.linspace(0, 2 * np.pi, 24)], INK, 2.5)
e.stage('door')

# 5 a mat at the threshold and a plant keeping the door
mat = e.rrect(CX - 140, fy1 + 52, CX + 140, fy1 + 104, 10)
e.fill(mat, OLIVE)
for k in range(1, 7):
    x = CX - 140 + k * 40
    e.line([(x, fy1 + 58), (x, fy1 + 98)], CARD, 3, wobble=0.3)
e.line(rr_pts(CX - 140, fy1 + 52, CX + 140, fy1 + 104, 10), INK, 3.5, closed=True)
px, py = fx1 + 140, fy1 + 20
pot = [(px - 58, py - 120), (px + 58, py - 120), (px + 42, py), (px - 42, py)]
e.fill(e.poly(pot), RUST)
e.line(pot, INK, 4, closed=True)
for (dx, dy, r, c) in [(-48, -230, 46, OLIVE), (34, -260, 52, TEAL), (-6, -320, 40, OLIVE)]:
    leaf = e.blob(px + dx, py + dy, r * 0.62, r, rough=0.1, rot=dx / 120)
    e.fill(leaf, c)
    e.line([(px, py - 120), (px + dx * 0.8, py + dy + r * 0.6)], INK, 3, wobble=0.6)
e.stage('mat-plant')

# 6 the key, floating, and a few sparkles
kx, ky = 150, 200
e.fill(e.circle(kx, ky, 40) * (1 - e.circle(kx, ky, 16)), OCHRE)
e.line([(kx + np.cos(t) * 40, ky + np.sin(t) * 40) for t in np.linspace(0, 2 * np.pi, 36)], INK, 4)
e.line([(kx + np.cos(t) * 16, ky + np.sin(t) * 16) for t in np.linspace(0, 2 * np.pi, 20)], INK, 3)
e.line([(kx + 40, ky + 6), (kx + 170, ky + 52)], INK, 7, wobble=0.4)
e.line([(kx + 128, ky + 38), (kx + 118, ky + 66)], INK, 6, wobble=0.3)
e.line([(kx + 156, ky + 48), (kx + 148, ky + 72)], INK, 6, wobble=0.3)
e.stars([(170, 560, 14), (1040, 470, 16), (1010, 120, 12), (560, 120, 11)], INK)
e.stage('key')

save_webp(e, 'login', 1100, stages=True)
