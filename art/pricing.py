"""Pricing: three plan cards fanned out, Starter (ochre) and Max (teal) behind, Pro (orange) raised in front
with a star badge. Stages drive the pricing page's draw-on loop; each card bobs on its own beat."""
from okart import *  # noqa: F401,F403

e = Editorial(1200, 1000, seed=53, stock=PAPER)

e.fill(e.blob(600, 600, 540, 320, rough=0.05), SAND, density=0.6)
e.fill(e.ellipse(600, 880, 440, 30), SAND)
e.stage('ground')


def card(cx, cy, w, h, ang, band, lines):
    """a tilted plan card: coloured header band, a price bar, then `lines` ticked feature rows"""
    ca, sa = np.cos(ang), np.sin(ang)

    def at(x, y):
        return (cx + x * ca - y * sa, cy + x * sa + y * ca)

    hw, hh = w / 2, h / 2
    body = [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)]
    head = [at(-hw, -hh), at(hw, -hh), at(hw, -hh + h * 0.24), at(-hw, -hh + h * 0.24)]
    e.fill(e.poly(body), CARD, density=0.97)
    e.fill(e.poly(head), band)
    e.line(body, INK, 5, closed=True)
    e.line([at(-hw * 0.7, -hh + h * 0.36), at(hw * 0.1, -hh + h * 0.36)], INK, 9, wobble=0.4)
    for k in range(lines):
        y = -hh + h * (0.52 + k * 0.13)
        e.line([at(-hw * 0.72, y), at(-hw * 0.62, y + 12), at(-hw * 0.48, y - 12)], INK, 4, wobble=0.2)
        e.line([at(-hw * 0.36, y), at(hw * 0.62, y)], INK, 3, wobble=0.5)


card(262, 560, 270, 390, -0.14, OCHRE, 3)
e.stage('starter')
card(938, 560, 270, 390, 0.14, TEAL, 3)
e.stage('max')
card(600, 500, 290, 460, 0.0, ORANGE, 4)
e.stage('pro')

# the "most popular" star badge pinned on Pro
star = [(600 + np.cos(a) * r, 222 + np.sin(a) * r)
        for a, r in zip(np.linspace(-np.pi / 2, 3 * np.pi / 2, 11)[:-1], [58, 26] * 5)]
e.fill(e.poly(star), OCHRE)
e.line(star, INK, 4, closed=True)
e.stage('badge')

e.stars([(150, 260, 14), (1060, 250, 12), (420, 160, 10), (1110, 860, 11)], INK)
for (x, y, r, c) in [(780, 170, 8, ORANGE), (90, 820, 8, OLIVE), (1120, 420, 7, RUST)]:
    e.fill(e.circle(x, y, r), c)

save_webp(e, 'pricing', 1100, stages=True)
