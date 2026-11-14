"""Run the four pipeline steps in order: fetch, transcode, lookup tables, manifest.

Usage: python run_all.py [scene-id ...]
"""
import sys

import build_lut
import build_manifest
import fetch_svs
import transcode
from scenes import SCENES

if __name__ == "__main__":
    ids = sys.argv[1:] or None
    for s in SCENES:
        if ids and s["id"] not in ids:
            continue
        print(f"[fetch] {s['id']} (SVS {s['svsId']})")
        fetch_svs.fetch(s)
    transcode.run(ids)
    build_lut.run(ids)
    build_manifest.build()
