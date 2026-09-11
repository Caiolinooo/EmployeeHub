"""
Best-effort Companion mascot layer cutouts from idle_stand for human Rive Editor bones.

Does NOT produce a bone-skinned .riv — only RGBA layer PNGs + region hints.
Output: docs/assets/companion-mascot/cutouts/
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "images" / "companion-mascot" / "body" / "idle_stand.png"
OUT = ROOT / "docs" / "assets" / "companion-mascot" / "cutouts"


def alpha_bbox(img: Image.Image, threshold: int = 8):
    a = img.split()[-1]
    return a.point(lambda p: 255 if p > threshold else 0).getbbox()


def is_blue_book(r: int, g: int, b: int, a: int) -> bool:
    if a < 20:
        return False
    # Navy / cover blues dominate book_core (not near-black limbs)
    return b > 70 and b >= r + 15 and b >= g and (r + g + b) > 120


def is_dark_limb(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    return r < 55 and g < 55 and b < 70 and (r + g + b) < 140


def build_masks(src: Image.Image):
    w, h = src.size
    px = src.load()
    book = Image.new("L", (w, h), 0)
    limbs = Image.new("L", (w, h), 0)
    bp = book.load()
    lp = limbs.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_blue_book(r, g, b, a):
                bp[x, y] = 255
            elif is_dark_limb(r, g, b, a):
                lp[x, y] = 255
            elif a > 20:
                # Cover text / spring / logo / face — keep with book_core
                bp[x, y] = 255
    book = book.filter(ImageFilter.MaxFilter(3))
    limbs = limbs.filter(ImageFilter.MaxFilter(3))
    return book, limbs


def split_left_right(mask: Image.Image, y0: int, y1: int):
    """Split a limb mask into left/right by opaque centroid midline in a band."""
    w, h = mask.size
    band = mask.crop((0, y0, w, y1))
    bbox = band.getbbox()
    left = Image.new("L", (w, h), 0)
    right = Image.new("L", (w, h), 0)
    if not bbox:
        return left, right
    mid_x = (bbox[0] + bbox[2]) // 2
    px = mask.load()
    lp = left.load()
    rp = right.load()
    for y in range(h):
        for x in range(w):
            v = px[x, y]
            if v < 8:
                continue
            if x <= mid_x:
                lp[x, y] = v
            else:
                rp[x, y] = v
    return left, right


def apply_mask(src: Image.Image, mask: Image.Image) -> Image.Image:
    out = src.copy()
    r, g, b, a = out.split()
    a = ImageChops.multiply(a, mask)
    out.putalpha(a)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    bbox = alpha_bbox(src)
    if not bbox:
        raise SystemExit("idle_stand has no opaque pixels")
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0

    book_mask, limb_mask = build_masks(src)

    # Arms ≈ upper/mid limb band; legs ≈ lower limb band
    arm_band_y0 = y0 + int(bh * 0.22)
    arm_band_y1 = y0 + int(bh * 0.68)
    leg_band_y0 = y0 + int(bh * 0.62)
    leg_band_y1 = y1

    arm_mask = Image.new("L", (w, h), 0)
    leg_mask = Image.new("L", (w, h), 0)
    lp = limb_mask.load()
    ap = arm_mask.load()
    gp = leg_mask.load()
    for y in range(h):
        for x in range(w):
            v = lp[x, y]
            if v < 8:
                continue
            if arm_band_y0 <= y < arm_band_y1:
                ap[x, y] = v
            if leg_band_y0 <= y <= leg_band_y1:
                gp[x, y] = v

    arm_l, arm_r = split_left_right(arm_mask, arm_band_y0, arm_band_y1)
    leg_l, leg_r = split_left_right(leg_mask, leg_band_y0, leg_band_y1)

    # Soften edges slightly for import into Rive
    for mname, m in [
        ("book", book_mask),
        ("arm_l", arm_l),
        ("arm_r", arm_r),
        ("leg_l", leg_l),
        ("leg_r", leg_r),
    ]:
        pass

    layers = {
        "book_core": book_mask,
        "arm_left": arm_l,
        "arm_right": arm_r,
        "leg_left": leg_l,
        "leg_right": leg_r,
    }

    meta = {
        "source": str(SRC.relative_to(ROOT)).replace("\\", "/"),
        "canvas": {"w": w, "h": h},
        "opaque_bbox": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
        "method": (
            "color+spatial alpha cutouts from idle_stand "
            "(best-effort prep for human Rive Editor bones — NOT a finished rig)"
        ),
        "layers": {},
        "bone_hint": [
            "root → spine (book_core pivot at center)",
            "spine → arm_L / arm_R (stick limbs; optional hand tips)",
            "spine → leg_L / leg_R",
            "Keep face painted on book_core — do NOT reintroduce face overlays",
        ],
    }

    src.save(OUT / "idle_stand_source.png")
    preview = src.copy()

    colors = {
        "book_core": (0, 140, 255, 70),
        "arm_left": (255, 180, 0, 110),
        "arm_right": (255, 100, 0, 110),
        "leg_left": (80, 220, 120, 110),
        "leg_right": (40, 180, 90, 110),
    }

    for name, mask in layers.items():
        cut = apply_mask(src, mask)
        cut_path = OUT / f"{name}.png"
        cut.save(cut_path)
        bb = alpha_bbox(cut)
        meta["layers"][name] = {
            "file": cut_path.name,
            "opaque_bbox": (
                {"x0": bb[0], "y0": bb[1], "x1": bb[2], "y1": bb[3]} if bb else None
            ),
            "opaque_pixels": sum(1 for p in mask.tobytes() if p > 8),
        }
        if bb:
            overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            od = ImageDraw.Draw(overlay)
            od.rectangle(bb, outline=colors[name][:3] + (230,), width=1)
            # tint opaque mask region
            tint = Image.new("RGBA", (w, h), colors[name])
            tint.putalpha(ImageChops.multiply(mask, Image.new("L", (w, h), colors[name][3])))
            preview = Image.alpha_composite(preview, tint)
            preview = Image.alpha_composite(preview, overlay)
            draw = ImageDraw.Draw(preview)
            draw.text((bb[0] + 1, max(0, bb[1] - 8)), name, fill=(255, 255, 255, 230))

    preview.save(OUT / "cutout_regions_preview.png")
    (OUT / "cutout-meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote cutouts -> {OUT}")
    for name, info in meta["layers"].items():
        print(f"  - {name}: {info['opaque_pixels']} px")


if __name__ == "__main__":
    main()
