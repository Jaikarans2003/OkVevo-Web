"""Download: an orange arrow drops into a laptop whose screen shows the app window filling a progress bar.
Stages drive the download page's draw-on loop; the arrow (layer 4) keeps bobbing."""
from okart import *  # noqa: F401,F403

e = Editorial(1200, 1000, seed=41, stock=PAPER)

e.fill(e.blob(600, 600, 540, 320, rough=0.05), SAND, density=0.6)
e.fill(e.ellipse(600, 860, 470, 32), SAND)
e.stage('ground')

# 1 the laptop: lid, screen, base and trackpad
screen = e.rrect(320, 300, 880, 670, 12)
e.fill(e.rrect(290, 270, 910, 700, 28) * (1 - screen), INK)
e.fill(screen, CARD, density=0.95)
base = [(230, 712), (970, 712), (1040, 790), (160, 790)]
e.fill(e.poly(base), CARD, density=0.9)
e.halftone(e.poly(base), INK, cell=8, amount=0.18)
e.line(base, INK, 5, closed=True)
e.line(rr_pts(290, 270, 910, 700, 28, n=10), INK, 5, closed=True)
e.line(rr_pts(520, 735, 680, 772, 10, n=6), INK, 3, closed=True)
e.stage('laptop')

# 2 the app window on screen: title bar dots and two chat bubbles
e.fill(e.rrect(370, 330, 830, 640, 14), '#ffffff', density=0.9)
e.fill(e.rrect(370, 330, 830, 372, 14), PEACH)
e.line(rr_pts(370, 330, 830, 640, 14, n=8), INK, 4, closed=True)
for k, c in enumerate([ORANGE, OCHRE, TEAL]):
    e.fill(e.circle(398 + k * 26, 351, 8), c)
e.fill(e.rrect(400, 398, 650, 440, 18), SAND)
e.fill(e.rrect(560, 458, 800, 500, 18), ORANGE)
for (x0, x1, y) in [(422, 610, 419), (582, 770, 479)]:
    e.line([(x0, y), (x1, y)], INK, 3, wobble=0.5)
e.stage('window')

# 3 the progress bar, most of the way there
e.fill(e.rrect(400, 560, 690, 594, 17), TEAL)
e.line(rr_pts(400, 560, 800, 594, 17, n=6), INK, 4, closed=True)
e.stage('progress')

# 4 the download arrow dropping in, with motion dashes either side
arrow = [(565, 40), (635, 40), (635, 140), (690, 140), (600, 238), (510, 140), (565, 140)]
e.fill(e.poly(arrow), ORANGE)
e.line(arrow, INK, 5, closed=True)
for x in (470, 730):
    e.dashes([(x, 30), (x, 190)], INK, 3, dash=12, gap=10)
e.stage('arrow')

e.stars([(180, 260, 14), (1050, 330, 12), (120, 560, 10), (980, 120, 11)], INK)
for (x, y, r, c) in [(1010, 520, 8, ORANGE), (200, 420, 8, OLIVE)]:
    e.fill(e.circle(x, y, r), c)

save_webp(e, 'download', 1100, stages=True)
