"""Developer check: classify a real frame with a scene's LUT and write a false-colour preview.

Usage: python preview_match.py <scene-id> <image> [maxDistance] [minChroma]
Writes _cache/preview_<scene>.png and prints class shares. Mirrors the browser algorithm.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from colour import srgb_to_lab, chroma
from scenes import by_id

ROOT = Path(__file__).resolve().parent


def main():
    sid, img_path = sys.argv[1], sys.argv[2]
    scene = by_id(sid)
    max_d = float(sys.argv[3]) if len(sys.argv) > 3 else scene["match"]["maxDistance"]
    min_c = float(sys.argv[4]) if len(sys.argv) > 4 else scene["match"]["minChroma"]
    lut = json.loads((ROOT.parent / "app/public/luts" / f"{sid}.json").read_text(encoding="utf-8"))
    img = Image.open(img_path).convert("RGB")
    w = 384
    img = img.resize((w, round(w * img.height / img.width)), Image.BILINEAR)
    lab = srgb_to_lab(np.asarray(img))
    h, wd, _ = lab.shape
    flat = lab.reshape(-1, 3)
    best = np.full(len(flat), np.inf)
    cls = np.full(len(flat), -1)
    for k, c in enumerate(lut["classes"]):
        s = srgb_to_lab(np.array(c["rgb"]))
        d = np.sqrt(((flat[:, None, :] - s[None, :, :]) ** 2).sum(-1)).min(1)
        better = d < best
        best[better] = d[better]
        cls[better] = k
    valid = (best <= max_d) & (chroma(flat) >= min_c)
    cls[~valid] = -1
    out = np.zeros((len(flat), 3), np.uint8)
    for k, c in enumerate(lut["classes"]):
        out[cls == k] = c["swatch"]
        print(f"  {c['id']:12s} {np.mean(cls == k) * 100:5.1f}%")
    print(f"  unmatched    {np.mean(cls == -1) * 100:5.1f}%")
    dest = ROOT / "_cache" / f"preview_{sid}.png"
    Image.fromarray(out.reshape(h, wd, 3)).save(dest)
    print("wrote", dest)


if __name__ == "__main__":
    main()
