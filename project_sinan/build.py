#!/usr/bin/env python3
"""Build the Sinan case study, v6.

  index.html         one portable file: frames, fonts, flow chart and log inlined
  index.linked.html  same page, frames referenced from ./assets/

Nothing quoted on this page is typed by hand. `ai-generation/*.json` are the real
sidecars Sinan writes on every run: model, parameters, full prompt, price,
timestamp, task id. This reads them and emits them as one array. The page derives
its prompts, character counts, prices and receipt totals from that array at
runtime, so the page and the files cannot drift apart.

The flow chart is authored once at
  ../supporting-assets/sinan-system-flow-v6.svg
and injected verbatim. Edit it there, not in the page.
"""
import base64, json, pathlib, re, subprocess, sys, tempfile

HERE   = pathlib.Path(__file__).resolve().parent      # .../Sinan case study/sinan-case-study-v6
CASE   = HERE.parent                                  # .../Sinan case study
ROOT   = CASE.parent                                  # .../AI-KITS
GEN    = ROOT / "ai-generation"
WEB    = ROOT / "identity page design/web page/images"
FLOW   = CASE / "supporting-assets" / "sinan-system-flow-v6.svg"
DIRECT = CASE / "supporting-assets" / "meja-direction"
ASSETS = HERE / "assets"
FONTS  = HERE / "fonts"

# sidecar stem -> css var for its frame, or None where the run produced nothing
# the page shows. Order is irrelevant; the array is sorted on the real timestamp.
# `None` means the run is part of the record but the page shows no frame for
# it. Those are not padding: the reader is told there is a written reason for
# every attempt that did not ship, and these are those attempts.
RUNS = {
    # 9 Aug 2026 · Simpul
    "0809 identity-key-visual-gradient 01":      None,
    "0809 identity-key-visual-constellation 01": "sx2",
    "0809 identity-plate1-hero 01":              "s01",
    "0809 identity-plate1-hero 02":              "s02",
    "0809 identity-plate1-hero 03":              "s03",
    "0809 identity-plate1-hero 04":              "s04",
    "0809 identity-plate2-mark 01":              "ssparse",
    "0809 identity-plate4-constellation 01":     None,
    "0809 identity-plate4-constellation 02":     "sdense",
    "0809 identity-hero-loop 01":                None,
    # 11 Aug 2026 · Meja
    "0811 meja-control-undirected 01": "mctrl",
    "0811 meja-terr-chaos 01":         "tchaos",
    "0811 meja-terr-sanctuary 01":     None,
    "0811 meja-terr-tradition 01":     "ttrad",
    "0811 meja-terr-occasion 01":      "tocc",
    "0811 meja-hero-directed 01":      None,
    "0811 meja-detail-hands 01":       None,
    "0811 meja-signage 01":            None,
    "0811 meja2-terr-generosity 01":   None,
    "0811 meja2-hero-warm 01":         None,
    "0811 meja2-detail-warm 01":       None,
    # 13 Aug 2026 · Meja, two more frames off the same decision
    "0813 meja2-table-overhead 01":    None,
    "0813 meja2-plate-carried 01":     None,
    # 14 Aug 2026 · Simpul, the mirrored plate. 01 drifted into a ridge, so
    # the exclusion went into the prompt and 02 is the one that shipped.
    "0814 identity-plate5-mirrored 01": None,
    "0814 identity-plate5-mirrored 02": "s05",
}

# css var -> (source, output filename, target width, jpeg quality)
ASSET_SPEC = {
    "sx2":     (GEN / "0809 identity-key-visual-constellation 01.png", "sx2.jpg",     420, 72),
    "s01":     (GEN / "0809 identity-plate1-hero 01.png",              "s01.jpg",     640, 74),
    "s02":     (GEN / "0809 identity-plate1-hero 02.png",              "s02.jpg",     640, 74),
    "s03":     (WEB / "plate-hero.png",                                "s03.jpg",    1180, 76),
    "s04":     (GEN / "0809 identity-plate1-hero 04.png",              "s04.jpg",     640, 74),
    "s05":     (GEN / "0814 identity-plate5-mirrored 02.png",          "s05.jpg",     460, 74),
    "ssparse": (WEB / "plate-mark.png",                                "ssparse.jpg", 460, 74),
    "sdense":  (WEB / "plate-constellation.png",                       "sdense.jpg",  460, 74),
    "mctrl":   (GEN / "0811 meja-control-undirected 01.png", "mctrl.jpg",  860, 76),
    "tchaos":  (GEN / "0811 meja-terr-chaos 01.png",         "tchaos.jpg", 400, 73),
    "ttrad":   (GEN / "0811 meja-terr-tradition 01.png",     "ttrad.jpg",  400, 73),
    "tocc":    (GEN / "0811 meja-terr-occasion 01.png",      "tocc.jpg",   400, 73),
}

# Delivered straight into assets/ rather than generated here, so they are used
# byte-for-byte: sips would flatten webp to jpeg and cannot touch webm at all.
PASSTHROUGH = {
    "mj1":    ("meja01.webp",         "image/webp"),
    "mj2":    ("meja02.webp",         "image/webp"),
    "mj3":    ("meja03.webp",         "image/webp"),
    "mj4":    ("meja04.webp",         "image/webp"),
    "mjgen":  ("meja_generous.webp",  "image/webp"),
}
VIDEO = ("simpul-video.webm", "video/webm")

# family -> (file, css font-weight descriptor). Inter is the variable cut,
# subsetted to Latin, so one file covers every weight the page uses.
FONT_SPEC = {
    "Inter":   (FONTS / "Inter-subset.woff2", "100 900"),
    "Ibrand":  (FONTS / "Ibrand.woff2",       "400"),
    "Granger": (FONTS / "Granger.woff2",      "400"),
}

PORTRAIT_CANDIDATES = [HERE / "portrait" / n for n in
                       ("mimar-sinan.jpg", "mimar-sinan.png", "mimar-sinan.jpeg")]
PORTRAIT_FALLBACK = "linear-gradient(160deg,#F4F4F5,#E8E8EC 55%,#D4D4D8)"


def resize(src: pathlib.Path, dest: pathlib.Path, width: int, quality: int) -> bytes:
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(quality),
         "-Z", str(width), str(src), "--out", str(dest)],
        check=True, capture_output=True)
    return dest.read_bytes()


def read_log() -> list:
    """Every figure the page quotes comes out of here."""
    out = []
    for stem, var in RUNS.items():
        f = GEN / f"{stem}.json"
        if not f.exists():
            sys.exit(f"sidecar missing: {f}")
        d = json.loads(f.read_text())
        prompt = (d.get("prompt") or "").strip()
        if not prompt:
            sys.exit(f"sidecar has no prompt: {f}")
        out.append({
            "id":      stem,
            "t":       d["created"],
            "model":   d["model"],
            "usd":     d.get("estimated_cost_usd"),
            "credits": d.get("estimated_credits"),
            "chars":   len(prompt),
            "task":    (d.get("task_id") or "")[:10],
            "prompt":  prompt,
            "img":     var,
        })
    out.sort(key=lambda r: r["t"])
    return out


def read_direction() -> list:
    """The written direction for the Meja set.

    These are not run records and carry no task id, model or price: the Meja
    frames on the page are finished photography, and this is the direction they
    were shot against. Character counts are still measured from the real text
    rather than typed into the page, same as everything else.
    """
    out = []
    for f in sorted(DIRECT.glob("*.json")):
        d = json.loads(f.read_text())
        prompt = (d.get("prompt") or "").strip()
        if not prompt:
            sys.exit(f"direction file has no prompt: {f}")
        out.append({"id": d["id"], "kind": "direction",
                    "chars": len(prompt), "prompt": prompt, "usd": None})
    if not out:
        sys.exit(f"no direction files found in {DIRECT}")
    return out


def flowchart() -> str:
    if not FLOW.exists():
        sys.exit(f"flow chart missing: {FLOW}")
    svg = re.sub(r"^\s*<\?xml.*?\?>\s*", "", FLOW.read_text(), flags=re.S)
    if "<svg" not in svg:
        sys.exit("flow chart has no <svg> root")
    return svg.strip()


def main() -> None:
    src_html = HERE / "index.src.html"
    if not src_html.exists():
        sys.exit("index.src.html not found")
    for var, (src, *_r) in ASSET_SPEC.items():
        if not src.exists():
            sys.exit(f"missing source for --{var}: {src}")
    for var, (name, _mime) in PASSTHROUGH.items():
        if not (ASSETS / name).exists():
            sys.exit(f"missing hand-placed asset for --{var}: assets/{name}")
    if not (ASSETS / VIDEO[0]).exists():
        sys.exit(f"missing hand-placed asset: assets/{VIDEO[0]}")

    ASSETS.mkdir(parents=True, exist_ok=True)
    template = src_html.read_text()

    # ---- the log ----
    log = read_log()
    total = sum(r["usd"] or 0 for r in log)
    chars = sum(r["chars"] for r in log)
    print(f"Log: {len(log)} runs, {log[0]['t']} to {log[-1]['t']}, "
          f"${total:.4f}, {chars:,} characters of direction")

    direction = read_direction()
    print(f"Direction: {len(direction)} Meja briefs, "
          f"{sum(d['chars'] for d in direction):,} characters (no runs attached)")
    log = log + direction
    log_block = "window.LOG=" + json.dumps(log, separators=(",", ":"), ensure_ascii=False) + ";"
    if "</script" in log_block:
        sys.exit("log data contains a script terminator")

    # ---- fonts ----
    faces = []
    for family, (path, weight) in FONT_SPEC.items():
        if not path.exists():
            print(f"  !! font missing, skipping: {path.name}", file=sys.stderr); continue
        raw = path.read_bytes()
        faces.append(f'@font-face{{font-family:"{family}";'
                     f'src:url("data:font/woff2;base64,{base64.b64encode(raw).decode()}") format("woff2");'
                     f'font-weight:{weight};font-style:normal;font-display:swap;}}')
        print(f"  font  {family:9s} {len(raw)/1024:6.1f} KB  weight {weight}")

    # ---- portrait ----
    portrait = next((p for p in PORTRAIT_CANDIDATES if p.exists()), None)
    portrait_inline = portrait_linked = PORTRAIT_FALLBACK
    if portrait:
        with tempfile.TemporaryDirectory() as td:
            raw = resize(portrait, pathlib.Path(td) / "p.jpg", 520, 80)
        (ASSETS / "mimar-sinan.jpg").write_bytes(raw)
        portrait_inline = 'url("data:image/jpeg;base64,' + base64.b64encode(raw).decode() + '")'
        portrait_linked = 'url("assets/mimar-sinan.jpg")'
        print(f"  portrait        {len(raw)/1024:7.1f} KB")
    else:
        print("  !! no portrait found — drop it at portrait/mimar-sinan.jpg and rebuild")

    # ---- frames ----
    print("Encoding:")
    inline, linked, bytes_total = [], [], 0
    for var, (src, name, width, quality) in ASSET_SPEC.items():
        raw = resize(src, ASSETS / name, width, quality)
        bytes_total += len(raw)
        inline.append(f'  --{var}:url("data:image/jpeg;base64,{base64.b64encode(raw).decode()}");')
        linked.append(f'  --{var}:url("assets/{name}");')
        print(f"  --{var:8s} {name:16s} {len(raw)/1024:7.1f} KB")

    for var, (name, mime) in PASSTHROUGH.items():
        raw = (ASSETS / name).read_bytes()
        bytes_total += len(raw)
        inline.append(f'  --{var}:url("data:{mime};base64,{base64.b64encode(raw).decode()}");')
        linked.append(f'  --{var}:url("assets/{name}");')
        print(f"  --{var:8s} {name:20s} {len(raw)/1024:7.1f} KB  (as delivered)")

    vraw = (ASSETS / VIDEO[0]).read_bytes()
    video_inline = f"data:{VIDEO[1]};base64," + base64.b64encode(vraw).decode()
    video_linked = f"assets/{VIDEO[0]}"
    print(f"  video    {VIDEO[0]:20s} {len(vraw)/1024:7.1f} KB  (as delivered)")

    fc = flowchart()
    for lines, port, vid, out in ((inline, portrait_inline, video_inline, "index.html"),
                                  (linked, portrait_linked, video_linked, "index.linked.html")):
        block = ":root{\n" + "\n".join(lines) + f"\n  --portrait:{port};\n}}"
        page = (template.replace("{{CSS_IMAGES}}", block)
                        .replace("{{FONT_FACES}}", "\n".join(faces))
                        .replace("{{FLOWCHART}}", fc)
                        .replace("{{LOG_DATA}}", log_block)
                        .replace("{{SIMPUL_VIDEO}}", vid))
        if "{{" in page:
            sys.exit(f"unreplaced placeholder near: {page[page.index('{{'):page.index('{{')+40]!r}")
        (HERE / out).write_text(page)
        print(f"\nwrote {out:20s} {len(page.encode())/1024/1024:.2f} MB")

    print(f"assets/            {bytes_total/1024:.0f} KB across "
          f"{len(ASSET_SPEC) + len(PASSTHROUGH)} frames")


if __name__ == "__main__":
    main()
