#!/usr/bin/env python3
"""
Local preview server for this folder.

Exists only because python3 -m http.server sends no cache directives at all,
which lets a browser hold on to a stale copy of a .js or .css file across
reloads — repeatedly, and silently: the page keeps running the previous
version of a file that has already changed on disk, so a change looks like it
"did nothing" when in fact it was never fetched. Every response here carries
no-store, so a reload always reflects what is actually on disk.

Development only. build-offline.py is what produces the shippable copy, and
nothing about this file is part of it.

Usage:  python3 devserver.py [port]
"""
import functools, http.server, pathlib, socketserver, sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        """Serve /404.html for a miss, so the real page can be previewed here.

        Static hosts do this by convention; SimpleHTTPRequestHandler returns its
        own plain-text page, which meant the 404 design could only be checked by
        visiting /404.html directly -- not by actually getting one.
        """
        if code == 404:
            page = pathlib.Path(self.directory) / "404.html"
            if page.is_file():
                body = page.read_bytes()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, fmt, *args):        # keep the console readable
        if "GET" in (fmt % args) and " 200 " in (fmt % args):
            return
        super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8412
    root = pathlib.Path(__file__).parent.resolve()
    handler = functools.partial(NoCacheHandler, directory=str(root))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving {root} at http://127.0.0.1:{port} (no-store)")
        httpd.serve_forever()
