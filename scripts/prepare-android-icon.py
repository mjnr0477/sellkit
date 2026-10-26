#!/usr/bin/env python3
"""Generate Android launcher resources from VYBORA's existing V brand mark."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("android/app/src/main/res")
SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
BG_TOP, BG_BOTTOM = (14, 12, 31), (54, 29, 103)
AQUA, VIOLET, PINK = (75, 244, 207), (145, 91, 255), (255, 105, 190)

def make_icon(size):
    scale = 4
    n = size * scale
    image = Image.new("RGBA", (n, n))
    pixels = image.load()
    for y in range(n):
        t = y / max(1, n - 1)
        c = tuple(round(BG_TOP[i] * (1-t) + BG_BOTTOM[i] * t) for i in range(3)) + (255,)
        for x in range(n):
            pixels[x, y] = c
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = n / 2, n / 2
    for radius, alpha in [(n*.29, 12), (n*.23, 14), (n*.17, 18)]:
        draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), fill=(145, 91, 255, alpha))
    width = max(5, int(n * .105))
    left = [(n*.27, n*.27), (n*.49, n*.72)]
    right = [(n*.49, n*.72), (n*.75, n*.27)]
    for offset, alpha, thick in [(3, 32, width*2), (0, 255, width)]:
        draw.line([(x, y+offset*scale) for x,y in left], fill=(*AQUA, alpha), width=thick, joint="curve")
        draw.line([(x, y+offset*scale) for x,y in right], fill=(*VIOLET, alpha), width=thick, joint="curve")
    draw.line([(n*.60, n*.52), (n*.75, n*.27)], fill=(*PINK, 245), width=max(2, width//3))
    return image.resize((size, size), Image.Resampling.LANCZOS)

for density, size in SIZES.items():
    directory = ROOT / f"mipmap-{density}"
    directory.mkdir(parents=True, exist_ok=True)
    icon = make_icon(size)
    icon.save(directory / "ic_launcher.png", optimize=True)
    icon.save(directory / "ic_launcher_round.png", optimize=True)
    icon.save(directory / "ic_launcher_foreground.png", optimize=True)

values = ROOT / "values"
values.mkdir(parents=True, exist_ok=True)
(values / "vybora_icon_colors.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<resources><color name="vybora_icon_background">#100C20</color></resources>
''', encoding="utf-8")
drawable = ROOT / "drawable"
drawable.mkdir(parents=True, exist_ok=True)
(drawable / "vybora_icon_foreground.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <path android:strokeColor="#4BF4CF" android:strokeWidth="11"
        android:strokeLineCap="round" android:strokeLineJoin="round"
        android:fillColor="#00000000" android:pathData="M29,29 L54,79" />
    <path android:strokeColor="#915BFF" android:strokeWidth="11"
        android:strokeLineCap="round" android:strokeLineJoin="round"
        android:fillColor="#00000000" android:pathData="M54,79 L82,29" />
    <path android:strokeColor="#FF69BE" android:strokeWidth="3.5"
        android:strokeLineCap="round" android:fillColor="#00000000"
        android:pathData="M66,57 L82,29" />
</vector>
''', encoding="utf-8")
adaptive = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/vybora_icon_background" />
    <foreground android:drawable="@drawable/vybora_icon_foreground" />
</adaptive-icon>
'''
anydpi = ROOT / "mipmap-anydpi-v26"
anydpi.mkdir(parents=True, exist_ok=True)
(anydpi / "ic_launcher.xml").write_text(adaptive, encoding="utf-8")
(anydpi / "ic_launcher_round.xml").write_text(adaptive, encoding="utf-8")
print("Generated VYBORA launcher icons from the existing V brand for all Android densities.")
