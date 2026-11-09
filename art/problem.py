"""Problem: a business owner at his desk, chin on hand, buried under every part of the business."""
from okart import *  # noqa: F401,F403

e = Editorial(1600, 1100, seed=23, stock=PAPER)
PX = 800

def band(p, q, w):
    """a straight limb from p to q, w wide, as polygon points"""
    dx, dy = q[0] - p[0], q[1] - p[1]; L = np.hypot(dx, dy); nx, ny = -dy / L * w / 2, dx / L * w / 2
    return [(p[0] + nx, p[1] + ny), (q[0] + nx, q[1] + ny), (q[0] - nx, q[1] - ny), (p[0] - nx, p[1] - ny)]


# silhouettes first: inks only darken, so anything light is knocked out of the inks behind it
torso_pts = spline([(670, 840), (676, 640), (712, 578), (800, 560), (888, 578), (924, 640), (930, 840)], 10)
torso = e.poly(torso_pts)
head = e.circle(PX, 430, 72)
lid_pts = [(676, 700), (924, 700), (936, 836), (664, 836)]
lid = e.poly(lid_pts)
upper, fore = band((900, 600), (1004, 806), 46), band((1004, 806), (858, 530), 40)
arm = np.maximum.reduce([e.poly(upper), e.poly(fore), e.circle(1004, 806, 23)])
front = np.maximum.reduce([torso, head, lid, arm, e.circle(852, 520, 28), e.rrect(782, 486, 818, 566, 12)])

# 1 backdrop: sand blob and the orange sun behind his head
e.fill(e.blob(PX, 560, 520, 430, rough=0.06) * (1 - front), SAND, density=0.75)
sun = e.circle(PX, 500, 320) * (1 - front)
e.fill(sun, ORANGE)
e.halftone(sun * np.clip((e.XX - PX + e.YY - 500 + 100) / 500, 0, 1), RUST, cell=13, angle=0.6, amount=0.5)
e.stage('backdrop')

# 2 the desk
e.fill(e.rrect(150, 830, 1450, 872, 10), UMBER)
e.halftone(e.rrect(150, 830, 1450, 872, 10) * np.clip((e.XX - 150) / 1300, 0, 1), INK, cell=8, angle=0.3, amount=0.45)
e.line([(150, 830), (1450, 830)], INK, 4)
e.fill(e.rrect(200, 872, 1400, 896, 6), UMBER, density=0.7)
for lx in (230, 1350):
    e.fill(e.rrect(lx, 896, lx + 26, 1100, 6), UMBER)
e.stage('desk')

# 3 the owner: shirt, head, glasses, eyes rolled up
e.fill(torso * (1 - arm), CARD, density=0.95)
e.halftone(torso * np.clip((e.XX - PX) / 140, 0, 1), SAND, cell=8, angle=0.8, amount=0.7)
e.line(torso_pts, INK, 4)
e.line([(772, 566), (800, 600), (828, 566)], INK, 3)                       # collar
e.fill(e.rrect(782, 486, 818, 566, 12), SKIN)                               # neck
e.fill(head, SKIN)
e.halftone(head * np.clip((e.XX - PX) / 72, 0, 1), RUST, cell=7, angle=0.4, amount=0.3)
hair = spline([(728, 448), (722, 380), (760, 340), (820, 336), (868, 366), (876, 420), (858, 392), (820, 380), (770, 386), (746, 420)], 10)
e.fill(e.poly(hair), INK)
for gx in (772, 828):                                                       # round glasses, eyes rolled up
    e.line([(gx + np.cos(a) * 22, 430 + np.sin(a) * 22) for a in np.linspace(0, 2 * np.pi, 36)], INK, 3)
    e.fill(e.circle(gx + 2, 420, 6), INK)
e.line([(794, 430), (806, 430)], INK, 3, wobble=0.2)
e.line([(788, 474), (812, 470)], INK, 3, wobble=0.3)                        # flat little mouth
e.stage('owner')

# 4 laptop, the arm propping his chin, the props on the desk
e.fill(lid * (1 - arm), SLATE)
e.halftone(lid * (1 - arm) * np.clip((e.YY - 700) / 140, 0, 1), INK, cell=9, angle=0.6, amount=0.4)
e.line(lid_pts, INK, 4, closed=True)
e.fill(e.circle(PX, 768, 16), ORANGE)
e.fill(arm, CARD, density=0.95)
e.halftone(arm * np.clip((e.XX - 930) / 80, 0, 1), SAND, cell=8, angle=0.8, amount=0.7)
e.line(upper, INK, 3, closed=True); e.line(fore, INK, 3, closed=True)
e.fill(e.circle(852, 520, 28), SKIN)
e.line([(852 + np.cos(a) * 28, 520 + np.sin(a) * 28) for a in np.linspace(0, 2 * np.pi, 30)], INK, 3)
for k, (x0, x1, c) in enumerate([(270, 520, UMBER), (284, 506, RUST), (262, 512, SLATE)]):   # books
    y = 830 - (k + 1) * 34
    e.fill(e.rrect(x0, y, x1, y + 32, 6), c); e.line([(x0, y), (x1, y), (x1, y + 32), (x0, y + 32), (x0, y)], INK, 3)
mug = e.rrect(560, 742, 628, 830, 10)
e.fill(mug, RUST); e.line([(560, 742), (628, 742), (628, 830), (560, 830), (560, 742)], INK, 3.5)
e.line([(628 + np.cos(a) * 24, 784 + np.sin(a) * 24) for a in np.linspace(-1.4, 1.4, 20)], INK, 6)
for k in range(9):                                                                        # the paper pile
    y = 830 - (k + 1) * 15
    dx = (k * 37 % 17) - 8
    e.fill(e.rrect(1120 + dx, y, 1360 + dx, y + 13, 3), CARD, density=0.95)
    e.line([(1120 + dx, y), (1360 + dx, y), (1360 + dx, y + 13), (1120 + dx, y + 13), (1120 + dx, y)], INK, 2.5)
e.fill(e.rrect(1040, 760, 1090, 830, 8), OCHRE)
e.line([(1048, 760), (1032, 700)], INK, 5); e.line([(1078, 760), (1094, 706)], ORANGE, 5)
e.stage('desk-things')

# 5 loose papers in the air and the tangle of thoughts over his head
def sheet(cx, cy, rot):
    c, s = np.cos(rot), np.sin(rot)
    pts = [(cx + c * x - s * y, cy + s * x + c * y) for x, y in [(-46, -58), (46, -58), (46, 58), (-46, 58)]]
    e.fill(e.poly(pts), CARD, density=0.95)
    e.line(pts, INK, 3, closed=True)
    for k in range(3):
        y = -30 + k * 22
        e.line([(cx + c * -28 - s * y, cy + s * -28 + c * y), (cx + c * 24 - s * y, cy + s * 24 + c * y)], SAND if k else INK, 3, wobble=0.3)
for (x, y, r) in [(470, 300, -0.35), (1120, 290, 0.3), (420, 560, 0.5), (1190, 560, -0.45), (980, 160, 0.15)]:
    sheet(x, y, r)
tang = []
for k, a in enumerate(np.linspace(0, 9 * np.pi, 140)):
    r = 18 + 40 * (0.5 + 0.5 * np.sin(a * 0.37)) + 6 * np.sin(a * 3.1)
    tang.append((PX + np.cos(a) * r, 236 + np.sin(a) * r * 0.55))
e.line(tang, INK, 3, wobble=1.2)
e.line([(PX, 280), (PX - 6, 318)], INK, 3)
e.stars([(300, 160, 14), (1330, 180, 16), (1440, 700, 12)], INK)

save_webp(e, 'problem', 1400, stages=True)
