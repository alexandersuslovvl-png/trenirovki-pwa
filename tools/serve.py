"""Локальный сервер для разработки: без HTTP-кэша, чтобы правки сразу были видны.

python tools/serve.py [порт]   (по умолчанию 8765)
"""
import functools, http.server, pathlib, sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
root = pathlib.Path(__file__).resolve().parent.parent
handler = functools.partial(NoCache, directory=str(root))
http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
