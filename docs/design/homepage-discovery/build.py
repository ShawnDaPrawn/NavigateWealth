#!/usr/bin/env python3
"""
Build the Navigate Wealth homepage design-direction PDF.

Takes `direction.html` (a template full of {{TOKEN}} placeholders), inlines every
asset it needs as a data URI so the result is self-contained, then prints it to a
landscape PDF with headless Chromium.

    python3 docs/design/homepage-discovery/build.py

Outputs, next to this script:
    direction.built.html   self-contained page (open in any browser)
    Navigate-Wealth-Homepage-Design-Direction.pdf   1600x900 landscape
"""

from __future__ import annotations

import base64
import io
import math
import mimetypes
import re
import shutil
import subprocess
import sys

from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SRC_ASSETS = REPO / "src" / "assets"
OPTIMIZED = REPO / "public" / "img" / "optimized"
BRAND = REPO / "public" / "brand-assets"

TEMPLATE = HERE / "direction.html"
BUILT = HERE / "direction.built.html"
PDF = HERE / "Navigate-Wealth-Homepage-Design-Direction.pdf"

FONT_CSS_URL = (
    "https://fonts.googleapis.com/css2"
    "?family=Cormorant+Garamond:wght@300;400;500;600;700"
    "&family=Inter:wght@300;400;500;600;700;800&display=swap"
)
FONT_CACHE = HERE / ".fonts"

CHROME_CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    shutil.which("chromium") or "",
    shutil.which("chromium-browser") or "",
    shutil.which("google-chrome") or "",
]


# ── assets ───────────────────────────────────────────────────────────────────


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if path.suffix == ".webp":
        mime = "image/webp"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def photo(asset_hash: str, width: int = 768) -> str:
    """Service/hero photography — prefer the pre-optimized webp variants."""
    for candidate in (
        OPTIMIZED / f"{asset_hash}-{width}.webp",
        OPTIMIZED / f"{asset_hash}-1024.webp",
    ):
        if candidate.exists():
            return data_uri(candidate)
    for ext in (".jpg", ".png"):
        candidate = SRC_ASSETS / f"{asset_hash}{ext}"
        if candidate.exists():
            return data_uri(candidate)
    raise FileNotFoundError(f"no asset for {asset_hash}")


def logo(asset_hash: str, width: int = 260) -> str:
    """Provider logos ship as multi-hundred-KB PNGs; downscale before embedding."""
    source = SRC_ASSETS / f"{asset_hash}.png"
    try:
        from PIL import Image
    except ImportError:
        return data_uri(source)

    img = Image.open(source).convert("RGBA")
    if img.width > width:
        img = img.resize((width, max(1, round(img.height * width / img.width))), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# Google only serves woff2 (and the per-subset comments we parse) to a browser UA.
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def fetch(url: str) -> bytes:
    """curl rather than urllib — it already trusts this environment's proxy CA."""
    return subprocess.run(
        ["curl", "-sSfL", "-H", f"User-Agent: {UA}", url], check=True, capture_output=True
    ).stdout


def fonts_css() -> str:
    """Inline the latin variable fonts as base64 so the PDF embeds them."""
    FONT_CACHE.mkdir(exist_ok=True)
    css = None
    faces = []
    for family, slug in (("Cormorant Garamond", "cormorant"), ("Inter", "inter")):
        cached = FONT_CACHE / f"{slug}.woff2"
        if not cached.exists():
            if css is None:
                css = fetch(FONT_CSS_URL).decode()
            url = None
            for subset, block in re.findall(
                r"/\*\s*([a-z\-]+)\s*\*/\s*(@font-face\s*\{[^}]+\})", css
            ):
                if subset == "latin" and f"'{family}'" in block:
                    url = re.search(r"url\((https://[^)]+)\)", block).group(1)
                    break
            if not url:
                raise RuntimeError(f"could not locate a latin subset for {family}")
            cached.write_bytes(fetch(url))
        b64 = base64.b64encode(cached.read_bytes()).decode()
        # One variable file per family covers the whole weight range.
        faces.append(
            f"@font-face{{font-family:'{family}';font-style:normal;font-weight:100 900;"
            f"font-display:block;src:url(data:font/woff2;base64,{b64}) format('woff2');}}"
        )
    return "\n".join(faces)


def sail_path() -> str:
    """The `d` of the Navigate Wealth sail mark, lifted from the brand SVG."""
    svg = (BRAND / "navigate-wealth-icon-only-light.svg").read_text()
    return re.search(r'<path[^>]*\sd="([^"]+)"', svg).group(1)


# ── generated ornament ───────────────────────────────────────────────────────


def compass_rose(size: int = 1000) -> str:
    """A portolan wind rose: 32 rhumb lines, graduated ring, eight-point star."""
    c = size / 2
    r = size / 2 - 6
    parts: list[str] = []

    for ring, opacity in ((r, 0.55), (r * 0.94, 0.3), (r * 0.7, 0.22), (r * 0.34, 0.3)):
        parts.append(
            f'<circle cx="{c:.1f}" cy="{c:.1f}" r="{ring:.1f}" fill="none" '
            f'stroke="currentColor" stroke-opacity="{opacity}" stroke-width="1"/>'
        )

    # 32 rhumb lines radiating from the centre to the outer ring.
    for i in range(32):
        angle = math.radians(i * 360 / 32)
        x, y = c + r * math.sin(angle), c - r * math.cos(angle)
        weight = 0.34 if i % 8 == 0 else (0.2 if i % 4 == 0 else 0.1)
        parts.append(
            f'<line x1="{c:.1f}" y1="{c:.1f}" x2="{x:.1f}" y2="{y:.1f}" '
            f'stroke="currentColor" stroke-opacity="{weight}" stroke-width="1"/>'
        )

    # Graduated degree ticks around the limb.
    for i in range(72):
        angle = math.radians(i * 5)
        inner = r * (0.94 if i % 6 else 0.88)
        parts.append(
            f'<line x1="{c + inner * math.sin(angle):.1f}" y1="{c - inner * math.cos(angle):.1f}" '
            f'x2="{c + r * math.sin(angle):.1f}" y2="{c - r * math.cos(angle):.1f}" '
            f'stroke="currentColor" stroke-opacity="0.4" stroke-width="1"/>'
        )

    # Eight-point star, alternating long cardinal and short ordinal rays.
    star = r * 0.66
    for i in range(8):
        angle = math.radians(i * 45)
        tip = star if i % 2 == 0 else star * 0.62
        waist = star * 0.16
        tx, ty = c + tip * math.sin(angle), c - tip * math.cos(angle)
        left = angle - math.pi / 2
        right = angle + math.pi / 2
        lx, ly = c + waist * math.sin(left), c - waist * math.cos(left)
        rx, ry = c + waist * math.sin(right), c - waist * math.cos(right)
        fill = 0.16 if i % 2 == 0 else 0.07
        parts.append(
            f'<path d="M{c:.1f} {c:.1f} L{lx:.1f} {ly:.1f} L{tx:.1f} {ty:.1f} Z" '
            f'fill="currentColor" fill-opacity="{fill}"/>'
            f'<path d="M{c:.1f} {c:.1f} L{rx:.1f} {ry:.1f} L{tx:.1f} {ty:.1f} Z" '
            f'fill="currentColor" fill-opacity="{fill / 2.4:.3f}"/>'
            f'<path d="M{lx:.1f} {ly:.1f} L{tx:.1f} {ty:.1f} L{rx:.1f} {ry:.1f}" fill="none" '
            f'stroke="currentColor" stroke-opacity="0.5" stroke-width="1"/>'
        )

    parts.append(
        f'<circle cx="{c:.1f}" cy="{c:.1f}" r="{r * 0.05:.1f}" fill="currentColor" fill-opacity="0.5"/>'
    )
    for label, (dx, dy) in {
        "N": (0, -r * 0.79),
        "E": (r * 0.79, 0),
        "S": (0, r * 0.79),
        "O": (-r * 0.79, 0),
    }.items():
        parts.append(
            f'<text x="{c + dx:.1f}" y="{c + dy + 7:.1f}" text-anchor="middle" '
            f'font-family="Cormorant Garamond, serif" font-size="26" fill="currentColor" '
            f'fill-opacity="0.65" letter-spacing="1">{label}</text>'
        )

    return (
        f'<svg class="rose" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg" '
        f'aria-hidden="true">{"".join(parts)}</svg>'
    )


def rope_rule(width: int = 240) -> str:
    """A Manueline cable-moulding rule, tiled horizontally as a section divider."""
    unit, height = 24, 14
    strands = []
    for offset in (0, unit / 2):
        d = []
        for i in range(width // unit + 2):
            x = i * unit + offset
            d.append(f"M{x:.1f} 7 C{x + 6:.1f} 1,{x + 18:.1f} 13,{x + 24:.1f} 7")
        strands.append(
            f'<path d="{" ".join(d)}" fill="none" stroke="currentColor" '
            f'stroke-opacity="{0.9 if offset else 0.55}" stroke-width="1.1"/>'
        )
    return (
        f'<svg class="rope" viewBox="0 0 {width} {height}" preserveAspectRatio="none" '
        f'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{"".join(strands)}</svg>'
    )


def azulejo(size: int = 96) -> str:
    """Portuguese tile geometry, reduced to a hairline quatrefoil for watermarks."""
    h = size / 2
    q = size / 4
    return (
        "data:image/svg+xml;base64,"
        + base64.b64encode(
            (
                f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
                f'viewBox="0 0 {size} {size}">'
                f'<g fill="none" stroke="#8A6A25" stroke-width="1" stroke-opacity="0.5">'
                f'<circle cx="{h}" cy="{h}" r="{q}"/>'
                f'<circle cx="0" cy="{h}" r="{q}"/><circle cx="{size}" cy="{h}" r="{q}"/>'
                f'<circle cx="{h}" cy="0" r="{q}"/><circle cx="{h}" cy="{size}" r="{q}"/>'
                f'<path d="M0 0 L{size} {size} M{size} 0 L0 {size}" stroke-opacity="0.18"/>'
                f'<circle cx="{h}" cy="{h}" r="2.5" fill="#8A6A25" stroke="none" fill-opacity="0.4"/>'
                f"</g></svg>"
            ).encode()
        ).decode()
    )


# ── build ────────────────────────────────────────────────────────────────────

PHOTOS = {
    "family": "8a93f2fa219696290136738d0dc439f43b6c6235",
    "retirement": "b0b37f186d8c48117bede379a79e329626b6ac95",
    "investment": "fc6a85769d1248cdde73b1d2252674e730f0655a",
    "estate": "482a45127e501f4b3cecd244241cff6024f47011",
    "tax": "7f33deddff0f6240cb18dcef045f830436c30355",
    "benefits": "dc2935371f93dc2f6da2f85cfa093001ca172d63",
    "cashback": "1f32a99aadd795f3c7f5c530f916c758d6ccb6f0",
    "medical": "0e2b917f64eba502a24068ea5244bd25b0dfc9d5",
}

LOGOS = {
    "discovery": "ec22996319fc583c67408cd6d525bfd9d80a3c28",
    "oldmutual": "eeda4aac6f4cf8965f899a22c841c57c87562d12",
    "sanlam": "ad6ef49da98c4f2ada1c11054e5db1894b83bf2e",
    "liberty": "babc74c9965824d11fb6fe0aa9dd0133e10fd66b",
    "momentum": "658982ebed7e0dfaed88848d4c25d44da4ec2b0d",
    "allangray": "fd6511affe61694a459c9045604285d749d7eec8",
    "brightrock": "7f3a830d4aaf877636e790293960ff63a842e4fa",
    "hollard": "b0906bc7f1c0d8e245965e6df2752c0454fc4f4f",
    "stanlib": "e599bccdec66ed4c52fa231161e6088f3e4c4b94",
    "capitallegacy": "c505e16f603199f9f6e099328fa60863eea2b0a4",
    "sygnia": "eb0a94d1f9889b9024b3266d68e2e1ceae56294e",
    "just": "b97811d5cc1be8c99fd6e9de8a94e3fa8dcff34a",
}


def main() -> int:
    html = TEMPLATE.read_text()

    tokens = {
        "{{FONTS}}": fonts_css,
        "{{SAIL_PATH}}": sail_path,
        "{{COMPASS_ROSE}}": compass_rose,
        "{{ROPE_RULE}}": rope_rule,
        "{{AZULEJO}}": azulejo,
        "{{IMG:flag}}": lambda: photo("543ae964645db88228743731ee3eebbbc2e3686e"),
    }
    for name, asset_hash in PHOTOS.items():
        tokens[f"{{{{IMG:{name}}}}}"] = lambda h=asset_hash: photo(h)
    for name, asset_hash in LOGOS.items():
        tokens[f"{{{{LOGO:{name}}}}}"] = lambda h=asset_hash: logo(h)

    for token, resolve in tokens.items():
        if token in html:
            html = html.replace(token, resolve())

    leftover = set(re.findall(r"\{\{[A-Z]+:?[a-zA-Z_]*\}\}", html))
    if leftover:
        print(f"warning: unresolved tokens {sorted(leftover)}", file=sys.stderr)

    BUILT.write_text(html)
    print(f"built {BUILT.relative_to(REPO)} — {BUILT.stat().st_size / 1e6:.1f} MB")

    chrome = next((c for c in CHROME_CANDIDATES if c and Path(c).exists()), None)
    if not chrome:
        print("no chromium found; skipping PDF", file=sys.stderr)
        return 1

    subprocess.run(
        [
            chrome,
            "--headless",
            "--no-sandbox",
            "--disable-gpu",
            "--font-render-hinting=none",
            "--force-color-profile=srgb",
            "--virtual-time-budget=20000",
            "--no-pdf-header-footer",
            "--generate-pdf-document-outline",
            f"--print-to-pdf={PDF}",
            BUILT.as_uri(),
        ],
        check=True,
        capture_output=True,
    )
    print(f"wrote {PDF.relative_to(REPO)} — {PDF.stat().st_size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
