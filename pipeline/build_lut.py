"""Turn each scene's legend image into a colour lookup table (app/public/luts/<id>.json).

Continuous legends: the colour strip is cropped (crop rectangle in LEGEND_CROPS below),
each column is averaged over the middle rows of the strip, and the result is resampled
to 256 entries from vmin to vmax.

Categorical legends: each class swatch is averaged over its rectangle. Because the GEOS
aerosol rendering draws each class with brightness proportional to concentration over a
dark background, every class also gets darker copies of its swatch colour
(BRIGHTNESS_LEVELS). These are derived from the legend, not from the data image.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from colour import srgb_to_lab, hue_deg, chroma
from scenes import SCENES

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "_cache"
OUT = ROOT.parent / "app" / "public" / "luts"

# (left, top, right, bottom) in legend pixels; right and bottom exclusive.
# ocean: sst_ecco2_cbar.png is 310x95. The colour strip, inside its 1-px black border,
# runs x = 15..290 and y = 29..67. The "0" and "32" labels sit under its two ends.
# We take the middle rows only (y 36..60) to stay clear of the border's antialiasing.
LEGEND_CROPS = {"ocean": (15, 36, 291, 60)}

# aerosols: Aerosols_cbar.png is 1500x300. Swatch rectangles, inset from rounded corners.
CATEGORY_SWATCHES = {
    "aerosols": [
        ("blackCarbon", "Black carbon / smoke", (225, 165, 380, 210)),
        ("dust", "Dust", (520, 165, 675, 210)),
        ("seaSalt", "Sea salt", (822, 165, 977, 210)),
        ("sulfate", "Sulfate", (1116, 165, 1271, 210)),
    ]
}
BRIGHTNESS_LEVELS = [1.0, 0.7, 0.45, 0.28]


def build_continuous(scene, img):
    box = LEGEND_CROPS[scene["id"]]
    strip = np.asarray(img.convert("RGB").crop(box)).astype(np.float64)
    cols = strip.mean(axis=0)  # (width, 3)
    n = 256
    xs = np.linspace(0, len(cols) - 1, n)
    rgb = np.stack([np.interp(xs, np.arange(len(cols)), cols[:, k]) for k in range(3)], axis=1)
    rgb = np.clip(np.round(rgb), 0, 255).astype(int)
    q = scene["quantity"]
    lab = srgb_to_lab(rgb)
    return {
        "kind": "continuous",
        "n": n,
        "vmin": q["vmin"],
        "vmax": q["vmax"],
        "source": {"file": scene["legend"]["file"], "crop": list(box)},
        "rgb": rgb.tolist(),
    }, lab


def build_categorical(scene, img):
    arr = np.asarray(img.convert("RGB")).astype(np.float64)
    classes = []
    for cid, label, (l, t, r, b) in CATEGORY_SWATCHES[scene["id"]]:
        patch = arr[t:b, l:r].reshape(-1, 3)
        if patch.std(axis=0).max() > 3:
            sys.exit(f"Swatch {cid} is not uniform (std {patch.std(axis=0)}); check its rectangle.")
        base = patch.mean(axis=0)
        samples = [np.clip(np.round(base * k), 0, 255).astype(int).tolist() for k in BRIGHTNESS_LEVELS]
        classes.append({"id": cid, "label": label, "swatch": samples[0], "rgb": samples})
    return {
        "kind": "categorical",
        "source": {"file": scene["legend"]["file"], "brightnessLevels": BRIGHTNESS_LEVELS},
        "classes": classes,
    }


def check_ocean(lut, lab):
    rgb = np.array(lut["rgb"])
    first, last = rgb[0], rgb[-1]
    assert first[2] > first[0] and first[2] > first[1], f"ocean LUT does not start blue: {first}"
    assert last[0] > last[1] and last[0] > last[2], f"ocean LUT does not end red: {last}"
    h = hue_deg(lab)
    # Hue must be unique along the scale for hue matching: it should fall steadily from blue to red.
    dh = np.diff(np.unwrap(np.radians(h)))
    print(f"  ocean LUT: {first.tolist()} -> {last.tolist()}; hue {h[0]:.0f} -> {h[-1]:.0f} deg; "
          f"monotone steps {np.mean(dh <= 0.01) * 100:.0f}%; min chroma {chroma(lab).min():.0f}")


def run(scene_ids=None):
    OUT.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        if scene_ids and scene["id"] not in scene_ids:
            continue
        if not scene.get("legend"):
            print(f"[lut] {scene['id']}: no legend (event scene); skipped")
            continue
        img = Image.open(CACHE / scene["id"] / scene["legend"]["file"])
        if scene["legend"]["kind"] == "continuous":
            lut, lab = build_continuous(scene, img)
            if scene["id"] == "ocean":
                check_ocean(lut, lab)
        else:
            lut = build_categorical(scene, img)
            for c in lut["classes"]:
                print(f"  {scene['id']} class {c['id']}: swatch {c['swatch']}")
        path = OUT / f"{scene['id']}.json"
        path.write_text(json.dumps(lut, separators=(",", ":")), encoding="utf-8")
        print(f"[lut] wrote {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    run(sys.argv[1:] or None)
