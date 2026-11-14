"""Transcode NASA media for the web (rules in docs/MASTER_BUILD_PROMPT.md section 5.3).

Video: H.264 yuv420p, no audio, +faststart, keyframe every 15 frames, 30 fps.
Flat 2:1 scenes scale to 1024x512; others to height 720. Output must be <= 20 MB:
start at CRF 23 and raise by 2 up to 31; if still too large, trim to 90 s.
A poster JPEG is taken from the frame at one third of the duration.
Images: copied if under 5 MB, else resized to 1920 wide.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from PIL import Image

from scenes import SCENES

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "_cache"
MEDIA = ROOT.parent / "app" / "public" / "media"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
CAP = 20 * 1000 * 1000  # 20 MB


def probe_duration(path):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    if not m:
        sys.exit(f"Could not read duration of {path}")
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def encode(src, dest, scale, crf, trim):
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src)]
    if trim:
        cmd += ["-t", str(trim)]
    cmd += [
        "-vf", f"scale={scale},fps=30",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
        "-pix_fmt", "yuv420p", "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
        "-an", "-movflags", "+faststart", str(dest),
    ]
    subprocess.run(cmd, check=True)
    return dest.stat().st_size


def transcode_video(scene, src):
    dest = MEDIA / f"{scene['id']}.mp4"
    scale = "1024:512" if scene["media"]["flat"] else "-2:720"
    trim = None
    crf = 23
    while True:
        size = encode(src, dest, scale, crf, trim)
        print(f"  CRF {crf}{' trim ' + str(trim) + 's' if trim else ''}: {size / 1e6:.1f} MB")
        if size <= CAP:
            break
        if crf < 31:
            crf += 2
        elif trim is None:
            trim = 90
        else:
            sys.exit(f"{scene['id']}: still over 20 MB at CRF 31 trimmed to 90 s")
    duration = probe_duration(dest)
    poster = MEDIA / f"{scene['id']}.jpg"
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{duration / 3:.2f}",
                    "-i", str(dest), "-frames:v", "1", "-q:v", "3", str(poster)], check=True)
    w, h = Image.open(poster).size
    return {
        "media": {"kind": "video", "src": f"media/{dest.name}", "poster": f"media/{poster.name}",
                  "width": w, "height": h, "duration": round(duration, 3), "bytes": size},
        "transcode": {"crf": crf, "trimmedSeconds": trim, "sourceFile": src.name},
    }


def copy_image(scene, src):
    ext = src.suffix.lower()
    dest = MEDIA / f"{scene['id']}{ext}"
    img = Image.open(src)
    if src.stat().st_size < 5 * 1000 * 1000:
        shutil.copyfile(src, dest)
    else:
        img = img.resize((1920, round(1920 * img.height / img.width)), Image.LANCZOS)
        img.save(dest)
    w, h = Image.open(dest).size
    # The still is its own poster; a small JPEG keeps the Jukebox page light.
    poster = MEDIA / f"{scene['id']}-poster.jpg"
    Image.open(dest).convert("RGB").resize((960, round(960 * h / w)), Image.LANCZOS).save(poster, quality=82)
    return {
        "media": {"kind": "image", "src": f"media/{dest.name}", "poster": f"media/{poster.name}",
                  "width": w, "height": h, "duration": 0, "bytes": dest.stat().st_size},
        "transcode": {"crf": None, "trimmedSeconds": None, "sourceFile": src.name},
    }


def run(scene_ids=None):
    MEDIA.mkdir(parents=True, exist_ok=True)
    results = {}
    for scene in SCENES:
        if scene_ids and scene["id"] not in scene_ids:
            continue
        src = CACHE / scene["id"] / scene["media"]["file"]
        if not src.exists():
            sys.exit(f"Missing {src}; run fetch_svs.py first")
        print(f"[transcode] {scene['id']}")
        info = transcode_video(scene, src) if scene["media"]["kind"] == "video" else copy_image(scene, src)
        results[scene["id"]] = info
        (CACHE / f"transcode_{scene['id']}.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
    return results


if __name__ == "__main__":
    run(sys.argv[1:] or None)
