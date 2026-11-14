"""Look up each scene on the SVS page API and download its media and legend, with resume."""
import json
import os
import sys
from pathlib import Path

import requests

from scenes import SCENES

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "_cache"
API = "https://svs.gsfc.nasa.gov/api/{}"
HEADERS = {"User-Agent": "TerraVoxis-pipeline/1.0 (NASA Space Apps 2026; educational)"}


def api_json(svs_id):
    path = CACHE / "api" / f"{svs_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        r = requests.get(API.format(svs_id), headers=HEADERS, timeout=60)
        r.raise_for_status()
        path.write_bytes(r.content)
    return json.loads(path.read_text(encoding="utf-8"))


def instances(page):
    for group in page.get("media_groups", []):
        for item in group.get("items", []):
            inst = item.get("instance")
            if inst and inst.get("filename"):
                yield inst


def resolve(page, filename):
    found = [i for i in instances(page) if i["filename"] == filename]
    if not found:
        names = sorted({i["filename"] for i in instances(page)})
        sys.exit(f"File '{filename}' not found on SVS {page.get('id')}. Available:\n  " + "\n  ".join(names))
    url = found[0]["url"]
    if url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    return url, found[0]


def download(url, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    head = requests.head(url, headers=HEADERS, timeout=60, allow_redirects=True)
    total = int(head.headers.get("content-length", 0))
    if dest.exists() and (total == 0 or dest.stat().st_size == total):
        print(f"  cached {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")
        return dest
    have = part.stat().st_size if part.exists() else 0
    headers = dict(HEADERS)
    if have:
        headers["Range"] = f"bytes={have}-"
    with requests.get(url, headers=headers, stream=True, timeout=120) as r:
        if r.status_code == 200 and have:
            have = 0  # server ignored the range; start over
        r.raise_for_status()
        with open(part, "ab" if have else "wb") as f:
            done = have
            last = 0
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
                done += len(chunk)
                if total and done - last > 20e6:
                    print(f"  {dest.name}: {done / 1e6:.0f} / {total / 1e6:.0f} MB", flush=True)
                    last = done
    os.replace(part, dest)
    print(f"  downloaded {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")
    return dest


def fetch(scene):
    page = api_json(scene["svsId"])
    out = {"page": page}
    url, inst = resolve(page, scene["media"]["file"])
    out["media"] = download(url, CACHE / scene["id"] / scene["media"]["file"])
    out["mediaInstance"] = inst
    if scene.get("legend"):
        url, _ = resolve(page, scene["legend"]["file"])
        out["legend"] = download(url, CACHE / scene["id"] / scene["legend"]["file"])
    return out


if __name__ == "__main__":
    wanted = sys.argv[1:]
    for s in SCENES:
        if wanted and s["id"] not in wanted:
            continue
        print(f"[fetch] {s['id']} (SVS {s['svsId']})")
        fetch(s)
