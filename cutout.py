"""Cut the white studio background out of the cup shots -> transparent PNGs.

1) Border flood-fill (thresh tuned so the cup's cream bottom band ~(246,240,232)
   survives while the pure-white background is removed).
2) Bottom-region clean-up: remove the near-white reflection/shadow under the base
   (the cream band is warmer -> kept; the white reflection -> removed).
3) Erode 1px (kill anti-alias halo) + feather alpha for smooth edges.

Run:  python cutout.py   (reads white-bg originals already copied into assets/cup/)
"""
import glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SENTINEL = (255, 0, 255)
THRESH = 32

files = sorted(glob.glob("assets/cup/cup-*.png"))
if not files:
    raise SystemExit("No assets/cup/cup-*.png found")

for f in files:
    im = Image.open(f).convert("RGB")
    w, h = im.size

    flood = im.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        ImageDraw.floodfill(flood, s, SENTINEL, thresh=THRESH)

    arr = np.array(flood)
    is_bg = (arr[:, :, 0] == 255) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 255)
    alpha = np.where(is_bg, 0, 255).astype("uint8")

    # hard-cut just below the cup base (drops the reflection/shadow under the cup
    # without touching the cream band, whatever its brightness)
    rowcount = (alpha > 0).sum(axis=1)
    if rowcount.max() > 0:
        rows = np.where(rowcount > 0.5 * rowcount.max())[0]
        base = int(rows.max())
        alpha[base + 1:, :] = 0

    aimg = Image.fromarray(alpha, "L")
    aimg = aimg.filter(ImageFilter.MedianFilter(5))    # despeckle / smooth edge
    aimg = aimg.filter(ImageFilter.MinFilter(3))       # erode ~1px (kill halo)
    aimg = aimg.filter(ImageFilter.GaussianBlur(0.9))  # feather

    out = im.convert("RGBA")
    out.putalpha(aimg)
    out.save(f)
    print("cut:", f)

print("DONE")
