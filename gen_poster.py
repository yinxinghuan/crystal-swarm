#!/usr/bin/env python3
"""Generate Crystal Swarm poster via platform gen-image."""
import json
import os
import ssl
import subprocess
import time
import urllib.request
from pathlib import Path

from PIL import Image

API_URL = "https://chat.aiwaves.tech/aigram/api/gen-image"
HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}

HERE = Path(__file__).parent
RAW = HERE / "_poster_raw.png"
OUT_GAME = HERE / "public" / "poster.png"
OUT_LIST = Path("/Users/yin/code/games/games/posters/crystal-swarm.png")
SIZE = 1024
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE

PROMPT = (
    "Standalone square digital key visual, 1:1, edge-to-edge cinematic scene filling the "
    "entire canvas. The top center contains one clean headline. The headline says Crystal "
    "Swarm in title case, with a normal blank space between the two words, and then the "
    "headline stops with empty sky after the word Swarm. "
    "Use luminous crystal-glass typography, crisp white letters with cyan glow, premium and "
    "beautiful. Under the title, "
    "show a cinematic deep-space swarm of translucent low-poly crystals: one huge refractive "
    "cyan crystal in the middle, smaller crystal shards orbiting in perspective, hot magenta "
    "gems, pearl highlights, soft gold reflections, glossy facets, volumetric bloom and "
    "dramatic depth. The artwork contains no extra writing, no numbers, no tiny letters, no "
    "punctuation marks, no symbols, no logos, no user interface, no border, no frame, and no "
    "decorative corners."
)


def call_gen_image(prompt, timeout=360, retries=3):
    data = json.dumps({"prompt": prompt}).encode()
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API_URL, data=data, method="POST", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as response:
                body = json.loads(response.read())
            url = body.get("url")
            if not url:
                raise RuntimeError(f"gen-image response has no url: {body}")
            return url
        except Exception as exc:
            last = exc
            print(f"retry {attempt + 1}/{retries}: {exc}", flush=True)
            time.sleep(8 * (attempt + 1))
    raise last


def download_image(url, out):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90, context=_SSL) as response:
        data = response.read()
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".png"
    tmp = out.with_suffix(".download" + ext)
    tmp.write_bytes(data)
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(out)], check=True, capture_output=True)
    tmp.unlink()


def fit_square(img):
    img = img.convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    inset = int(os.environ.get("CRYSTAL_POSTER_INSET", "58"))
    if inset > 0:
        img = img.crop((inset, inset, side - inset, side - inset))
    return img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def compose():
    poster = fit_square(Image.open(RAW))
    OUT_GAME.parent.mkdir(parents=True, exist_ok=True)
    OUT_LIST.parent.mkdir(parents=True, exist_ok=True)
    poster.save(OUT_GAME, "PNG", optimize=True)
    poster.save(OUT_LIST, "PNG", optimize=True)
    print(f"wrote {OUT_GAME}")
    print(f"wrote {OUT_LIST}")


def main():
    if os.environ.get("CRYSTAL_POSTER_USE_RAW") == "1" and RAW.exists():
        print(f"using existing raw {RAW}", flush=True)
    else:
        print("generating Crystal Swarm key art...", flush=True)
        url = call_gen_image(PROMPT)
        print(url, flush=True)
        download_image(url, RAW)
    compose()


if __name__ == "__main__":
    main()
