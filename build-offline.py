#!/usr/bin/env python3
"""
Generate ../portfolio_v3_offline/ — a copy of this site that opens from the
filesystem, with no server and no internet.

v3 equivalent of portfolio_v1/build-offline.py. This folder stays the
deployable source and is not modified. The same handful of things only
work over HTTP, and each needs the same fix as v1:

  1. Asset paths are root-absolute (/css/…). Over file:// a leading slash
     means the root of the disk, so every stylesheet, script and image
     misses. Rewritten to depth-correct relative paths. v3 is a single
     page at the root today, so the rewrite is a no-op depth-wise
     ("./css/…"), but it is depth-aware the way v1's is in case more
     pages land under a subdirectory later.
  2. v1 also strips ?v= cache-busters, because a file:// URL has no query
     string and Chrome would look for a file literally named
     "styles.css?v=16". The about page came over from v1 carrying those
     tags on its three stylesheets and both scripts, so the strip is load-
     bearing again; the homepage tags nothing.
  3. Links point at extensionless routes (/about). Only a server maps
     those to index.html, so they are rewritten to about/index.html (same
     as v1) and now actually resolve — the about page exists in v3 as of
     the port from v1. /project/* still does not, and those links 404 in
     the offline copy, which is expected and does not break page load.
  4. Figtree comes from Google Fonts, and Lenis + the two GSAP builds
     come from unpkg. All three need a network origin that file:// does
     not have — and a file:// page has an opaque origin, so Chrome blocks
     @font-face across origins even for a same-folder .woff2. Figtree is
     copied pre-inlined (as data: URIs) from portfolio_v1_offline, which
     already built it. Lenis and both GSAP files are copied from this
     folder's own vendor/ (vendored once, alongside this script — see
     README note below) and referenced with a relative path.

vendor/ note: portfolio_v3/index.html itself still points at the unpkg
CDNs, same as v1/index.html still points at unpkg for Lenis — the
deployable source is unchanged. portfolio_v3/vendor/ holds local copies
of gsap@3.12.5, ScrollTrigger@3.12.5 (downloaded from unpkg) and
lenis@1.1.18 (copied from portfolio_v1/vendor/lenis.min.js) purely so
this script has something to copy into the offline build without
touching the network or the source HTML.

Usage:  python3 build-offline.py
"""
import base64, pathlib, re, shutil, sys

SRC = pathlib.Path(__file__).parent.resolve()
OUT = SRC.parent / "portfolio_v3_offline"
V1_OFFLINE = SRC.parent / "portfolio_v1_offline"
FONT_CSS = "css/fonts-offline.css"

# Matched INDEPENDENTLY, not as one consecutive three-line block. The previous
# version required the two preconnects and the stylesheet link to be adjacent
# lines; adding an ordinary HTML comment between them silently stopped the whole
# substitution matching, so the "offline" build shipped still pointing at
# fonts.googleapis.com — and said nothing, because a regex that matches zero
# times is not an error. Found by loading the built copy and watching it make a
# network request. The verify step at the end of build() is the real fix: it
# fails the build if any network font/script reference survives, whatever the
# markup happens to look like.
GOOGLE_PRECONNECT = re.compile(
    r'[ \t]*<link rel="preconnect" href="https://fonts\.g[^>]*>\n')
GOOGLE_CSS = re.compile(
    r'[ \t]*<link[^>]*href="https://fonts\.googleapis\.com[^"]*"[^>]*>\n')
UNPKG = re.compile(
    r'https://unpkg\.com/(?:gsap@3\.12\.5/dist/(gsap\.min\.js|ScrollTrigger\.min\.js)'
    r'|lenis@1\.1\.18/dist/(lenis\.min\.js))')
ASSET = re.compile(r'((?:src|href|srcset|poster)=")/((?:css|js|images|favico)[^"]*)"')
ROUTE = re.compile(r'(href=")/([^"]*)"')

PAGES = sorted(SRC.glob("index.html")) + sorted(SRC.glob("*/index.html")) \
      + sorted(SRC.glob("*/*/index.html"))


def rewrite(html: str, depth: int) -> str:
    up = "../" * depth

    html = GOOGLE_PRECONNECT.sub("", html)
    html = GOOGLE_CSS.sub(
        f'  <link rel="stylesheet" href="{up}{FONT_CSS}" />\n', html)

    # unpkg CDN scripts -> vendored relative copies.
    html = UNPKG.sub(lambda m: f'{up}vendor/{m.group(1) or m.group(2)}', html)

    # Assets: make relative and drop any ?v= cache-buster.
    html = ASSET.sub(lambda m: f'{m.group(1)}{up}{m.group(2).split("?")[0]}"', html)

    # Routes: /about -> about/index.html, / -> index.html
    def route(m):
        path = m.group(2)
        if path.startswith(("css/", "js/", "images/", "favico")):
            return m.group(0)                      # already handled above
        target = f'{path.rstrip("/")}/index.html' if path else "index.html"
        return f'{m.group(1)}{up}{target}"'
    html = ROUTE.sub(route, html)
    return html


def main():
    if not (V1_OFFLINE / FONT_CSS).exists():
        sys.exit(f"missing {V1_OFFLINE / FONT_CSS} — build portfolio_v1_offline first")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    ignore = shutil.ignore_patterns(".DS_Store")
    for d in ("css", "js", "images"):
        shutil.copytree(SRC / d, OUT / d, ignore=ignore)
    shutil.copy2(SRC / "favico.svg", OUT / "favico.svg")

    (OUT / "vendor").mkdir()
    for name in ("gsap.min.js", "ScrollTrigger.min.js", "lenis.min.js"):
        shutil.copy2(SRC / "vendor" / name, OUT / "vendor" / name)

    (OUT / "css").mkdir(exist_ok=True)
    shutil.copy2(V1_OFFLINE / FONT_CSS, OUT / FONT_CSS)

    for page in PAGES:
        rel = page.relative_to(SRC)
        dest = OUT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(rewrite(page.read_text(encoding="utf-8"),
                                len(rel.parts) - 1), encoding="utf-8")

    # ---- verify: nothing in the built copy may need the network ----------
    # A file:// page has no network and an opaque origin, so ANY surviving
    # http(s) reference to a stylesheet, script or font is a broken offline
    # build. This is checked rather than assumed because the failure mode is
    # silent: the rewrites above are regex substitutions, and a regex that
    # matches nothing rewrites nothing and raises nothing. Exactly that
    # happened once — an HTML comment inserted between the font <link> tags
    # stopped the old single-block pattern matching, and the build cheerfully
    # produced a copy that still fetched Figtree from Google.
    leaks = []
    for f in list(OUT.rglob("*.html")) + list(OUT.rglob("*.css")):
        for m in re.finditer(r'https?://[^"\')\s]+', f.read_text()):
            url = m.group(0)
            if re.search(r'fonts\.(googleapis|gstatic)\.com|unpkg\.com'
                         r'|\.(css|js|woff2?|ttf|otf)(\?|$)', url):
                leaks.append(f"{f.relative_to(OUT)}: {url[:80]}")
    if leaks:
        print("OFFLINE BUILD IS NOT OFFLINE — these still need the network:")
        for l in leaks:
            print("   ", l)
        sys.exit(1)

    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"{OUT.name}/  {len(PAGES)} page(s)  {total/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
