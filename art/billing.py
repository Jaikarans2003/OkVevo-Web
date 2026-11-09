"""Billing: the two credit buckets as two jars. The plan jar (orange) refills every cycle; the top-up jar (teal)
keeps what you bought. Coins drop in, a receipt curls out. Stages drive the portal's draw-on loop."""
from okart import *  # noqa: F401,F403

e = Editorial(1200, 1000, seed=37, stock=PAPER)

e.fill(e.blob(600, 640, 540, 300, rough=0.05), SAND, density=0.6)
e.fill(e.ellipse(600, 860, 430, 34), SAND)
e.stage('ground')


def jar(cx, top, bot, w, level, ink, coin):
    """a glass jar: lid, shoulders, a fill line at `level` (0..1) of coins in `ink`, highlights knocked out"""
    x0, x1 = cx - w / 2, cx + w / 2
    body = e.rrect(x0, top + 60, x1, bot, 46)
    neck = e.rrect(cx - w * 0.32, top + 20, cx + w * 0.32, top + 90, 14)
    glass = np.maximum(body, neck)
    fy = bot - (bot - top - 80) * level
    contents = body * (e.YY > fy)
    shine = e.rrect(x0 + 26, top + 100, x0 + 46, bot - 60, 10)
    e.fill(glass * (1 - contents) * (1 - shine), CARD, density=0.55)
    e.fill(contents * (1 - shine), ink, density=0.92)
    for r in range(5):                                         # coin rims showing through the glass
        for c in range(4):
            x = x0 + 44 + c * (w - 88) / 3 + (r % 2) * 18
            y = bot - 40 - r * 46
            if y > fy + 20:
                e.line([(x + np.cos(t) * 20, y + np.sin(t) * 9) for t in np.linspace(0, 2 * np.pi, 20)], coin, 3, wobble=0.3)
    e.line(rr_pts(x0, top + 60, x1, bot, 46, n=10), INK, 5, closed=True)
    e.line([(x0 + 4, fy), (x1 - 4, fy)], INK, 3, wobble=0.8)
    lid = e.rrect(cx - w * 0.38, top - 6, cx + w * 0.38, top + 30, 10)
    e.fill(lid, INK)
    e.halftone(lid, CARD, cell=7, amount=0.25)
    e.fill(e.ellipse(cx, bot + 6, w * 0.6, 12), SAND)


# 2 the plan jar, mostly full
jar(420, 300, 800, 250, 0.72, ORANGE, RUST)
e.stage('plan-jar')

# 3 the top-up jar, partly full
jar(800, 380, 800, 210, 0.42, TEAL, CARD)
e.stage('topup-jar')


def coin(x, y, r=34, ink=OCHRE):
    e.fill(e.circle(x, y, r), ink)
    e.line([(x + np.cos(t) * r, y + np.sin(t) * r) for t in np.linspace(0, 2 * np.pi, 36)], INK, 4)
    e.line([(x + np.cos(t) * r * 0.62, y + np.sin(t) * r * 0.62) for t in np.linspace(0, 2 * np.pi, 28)], INK, 2.5)
    e.line([(x, y - r * 0.3), (x, y + r * 0.3)], INK, 4, wobble=0.2)


# 4 coins on the way in
e.dashes([(250, 120), (330, 160), (400, 250)], INK, 3, dash=10, gap=9)
e.dashes([(980, 170), (900, 230), (820, 330)], INK, 3, dash=10, gap=9)
coin(230, 110)
coin(1000, 160, 30)
e.stage('coins')

# 5 a short stack and a receipt curling out of it
for k in range(4):
    y = 840 - k * 22
    e.fill(e.ellipse(1040, y, 52, 16), OCHRE)
    e.line([(1040 + np.cos(t) * 52, y + np.sin(t) * 16) for t in np.linspace(0, 2 * np.pi, 30)], INK, 3)
rc = [(110, 560), (250, 540), (262, 820), (230, 846), (196, 822), (164, 848), (132, 824), (122, 600)]
e.fill(e.poly(rc), CARD, density=0.95)
e.line(rc, INK, 3.5, closed=True)
for k in range(5):
    y = 600 + k * 40
    e.line([(146, y), (226 - (k % 2) * 28, y - 2)], INK, 3, wobble=0.5)
e.fill(e.circle(196, 790, 9), ORANGE)
e.stage('receipt')

e.stars([(600, 150, 14), (1120, 600, 12), (80, 400, 12), (660, 300, 9)], INK)
for (x, y, r, c) in [(560, 230, 8, ORANGE), (1130, 420, 8, OLIVE)]:
    e.fill(e.circle(x, y, r), c)

save_webp(e, 'billing', 1100, stages=True)
