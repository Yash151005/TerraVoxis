"""Write app/public/scenes/manifest.json from scenes.py, the SVS API pages and transcode results."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from scenes import SCENES

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "_cache"
OUT = ROOT.parent / "app" / "public" / "scenes" / "manifest.json"
APP_PUBLIC = ROOT.parent / "app" / "public"

PASS_THROUGH = ["tagline", "geo", "quantity", "match", "masks", "analysis", "events", "streams",
                "musical", "defaultProbes", "provenance", "description", "story", "credits"]


def build():
    scenes = []
    for s in SCENES:
        tpath = CACHE / f"transcode_{s['id']}.json"
        if not tpath.exists():
            print(f"[manifest] skip {s['id']}: not transcoded yet")
            continue
        t = json.loads(tpath.read_text(encoding="utf-8"))
        page = json.loads((CACHE / "api" / f"{s['svsId']}.json").read_text(encoding="utf-8"))
        entry = {
            "id": s["id"],
            "svsId": s["svsId"],
            "title": page["title"],
            "svsUrl": f"https://svs.gsfc.nasa.gov/{s['svsId']}/",
            "media": {k: v for k, v in t["media"].items() if k != "bytes"},
            "transcode": t["transcode"],
            "lut": f"luts/{s['id']}.json" if s.get("legend") else None,
            "scan": s.get("scan"),
        }
        for k in PASS_THROUGH:
            entry[k] = s.get(k)
        if entry["lut"] and not (APP_PUBLIC / entry["lut"]).exists():
            sys.exit(f"{s['id']}: missing {entry['lut']}; run build_lut.py")
        if len(entry["description"].split()) < 80 or len(entry["description"].split()) > 150:
            sys.exit(f"{s['id']}: description must be 80-150 words, has {len(entry['description'].split())}")
        scenes.append(entry)
    manifest = {"version": 1, "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "scenes": scenes}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[manifest] wrote {len(scenes)} scenes to {OUT.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    build()
