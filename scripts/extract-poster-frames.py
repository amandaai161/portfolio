#!/usr/bin/env python3
"""
Extract frame 1 of each project thumbnail webm to a .webp poster.

WHY THIS EXISTS. The four selected-project thumbnails on the homepage are webm
clips that rest on their first frame and animate on hover. Without a poster the
browser has to download the whole clip -- about 1.9MB across the four -- before
it can show anything at all, and a phone, which has no hover and will never play
them, would pay that in full. The poster is what a phone loads instead.

WHY IT IS A BROWSER SCRIPT. There is no ffmpeg on this machine and PIL cannot
read webm, so the only webm decoder available is the browser's own. This serves
a page that decodes each clip, draws frame 0 to a canvas, encodes a webp, and
POSTs it back here to be written to images/.

RE-RUN THIS whenever the webm files change, or the posters will show the old
first frame while the clips play the new one.

    python3 scripts/extract-poster-frames.py
    # then open http://localhost:8499/ and wait for "done"

Development only. Nothing in build-offline.py depends on it.
"""
import http.server, json, pathlib, socketserver, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
NAMES = ["identity", "aspire", "kayn", "nobi"]
QUALITY = 0.92

PAGE = """<!doctype html><meta charset="utf-8"><title>poster frames</title>
<style>body{font:14px/1.6 ui-monospace,monospace;margin:40px;max-width:70ch}
img{max-width:320px;display:block;border:1px solid #ccc;margin:8px 0}
.row{margin-bottom:24px}</style>
<h1>Extracting poster frames</h1><div id="log"></div>
<script>
const NAMES = %(names)s, QUALITY = %(quality)s;
const log = m => { document.getElementById('log').insertAdjacentHTML('beforeend', m); };

/* Seek rather than play: a background tab never presents frames, so
   requestVideoFrameCallback would never fire, but `seeked` still does. */
function frameZero(src) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.src = src; v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.addEventListener('error', () => reject(new Error('load failed: ' + src)));
    v.addEventListener('loadeddata', () => {
      const done = () => {
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(v, 0, 0);
        /* Does the clip carry alpha? If any pixel is not fully opaque the webp
           has to keep the alpha channel, and the CSS ground shows through. */
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let translucent = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 255) translucent++;
        resolve({ canvas: c, w: c.width, h: c.height, translucent });
      };
      v.addEventListener('seeked', done, { once: true });
      try { v.currentTime = 0; } catch (e) { done(); }
    });
  });
}

(async () => {
  for (const name of NAMES) {
    const src = '/images/thumbnail_' + name + '.webm';
    try {
      const { canvas, w, h, translucent } = await frameZero(src);
      const url = canvas.toDataURL('image/webp', QUALITY);
      const res = await fetch('/save', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dataUrl: url }) });
      const out = await res.json();
      log('<div class="row"><b>' + name + '</b> &middot; ' + w + '&times;' + h +
          ' &middot; ' + out.bytes + ' bytes &middot; ' +
          (translucent ? translucent + ' translucent px' : 'fully opaque') +
          '<img src="' + url + '"></div>');
    } catch (e) {
      log('<div class="row"><b>' + name + '</b> FAILED: ' + e.message + '</div>');
    }
  }
  log('<p><b>done</b></p>');
})();
</script>""" % {"names": json.dumps(NAMES), "quality": QUALITY}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            body = PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/save":
            self.send_error(404)
            return
        import base64
        n = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(n))
        name = payload["name"]
        if name not in NAMES:                      # never write a path we did not ask for
            self.send_error(400, "unknown name")
            return
        head, _, b64 = payload["dataUrl"].partition(",")
        if "image/webp" not in head:
            self.send_error(400, "expected image/webp, got " + head)
            return
        raw = base64.b64decode(b64)
        out = IMAGES / ("thumbnail_%s_poster.webp" % name)
        out.write_bytes(raw)
        print("wrote %s (%d bytes)" % (out.name, len(raw)), flush=True)
        body = json.dumps({"ok": True, "bytes": len(raw)}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8499
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as srv:
        print("open http://localhost:%d/ — ctrl-c when it says done" % port, flush=True)
        srv.serve_forever()
